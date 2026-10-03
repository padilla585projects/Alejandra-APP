// ══════════════════════════════════════════════════════════════════════════════
// ADR-0029 — Dataset de entrenamiento PRIVADO (E/S en R2, nunca en D1).
//
// Apagado por defecto: sin `DATASET_ENTRENAMIENTO="1"` en el entorno del Worker no se
// lee ni se escribe NADA (ni una operación de R2). Las funciones puras (anonimización,
// heurística de corrección, criterio de turno apto, formato del registro) viven en
// lib.js; aquí solo está el ciclo de vida de los objetos en R2:
//
//   dataset/e<empresa>/pendiente/<usuario_hash>.json   UNA ranura por usuario: el último
//                                                      turno apto, esperando veredicto.
//   dataset-bueno/e<empresa>/<yyyy-mm>/<id>.json       turnos promovidos («buenos»).
//   dataset-cuota/e<empresa>/<yyyy-mm-dd>.json         contador diario (escritura por etag).
//
// Ciclo: al terminar un turno, (1) se resuelve la ranura pendiente del usuario con el
// mensaje NUEVO: si es una corrección («no», «te has equivocado», «corrige»…) se descarta;
// si no, se promueve a dataset-bueno; (2) si el turno nuevo es apto y queda cuota, se
// escribe en la ranura. El cron promueve las ranuras con más de DATASET_HORAS_PROMOCION
// horas sin siguiente mensaje. Descartar o vaciar una ranura es SOBRESCRIBIRLA con un
// marcador vacío: este código nunca llama a `FILES.delete` (borrar en R2 es humano,
// ADR-0007; la retención la ejecuta Adrián, ver ADR-0029 §Retención).
// ══════════════════════════════════════════════════════════════════════════════

import { esCorreccionUsuario, evaluarTurnoDataset, construirRegistroDataset } from './lib.js';

const DATASET_MAX_DIA_EMPRESA = 100;        // turnos aptos capturados por empresa y día
const DATASET_HORAS_PROMOCION = 6;          // sin siguiente mensaje en 6 h → bueno
const DATASET_CRON_MAX_LISTADOS = 5;        // páginas de list() por ejecución del cron
const DATASET_CRON_MAX_PROMOCIONES = 50;    // promociones por ejecución del cron
const SAL_HASH = 'alejandra-dataset-v1:';

function datasetActivo(env) {
  return !!(env && String(env.DATASET_ENTRENAMIENTO ?? '').trim() === '1' && env.FILES);
}

async function hashCorto(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SAL_HASH + String(texto)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// El id de empresa va en la ruta (mismo patrón e<empresa>/ que ADR-0027, para poder
// atender un borrado por empresa); dentro del registro solo va su hash.
function segmentoEmpresa(empresa) {
  return 'e' + String(empresa ?? 'x').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
}
function clavePendiente(empresa, usuarioHash) {
  return `dataset/${segmentoEmpresa(empresa)}/pendiente/${usuarioHash}.json`;
}
function claveBueno(empresa, fechaIso, id) {
  return `dataset-bueno/${segmentoEmpresa(empresa)}/${fechaIso.slice(0, 7)}/${id}.json`;
}
function claveCuota(empresa, fechaIso) {
  return `dataset-cuota/${segmentoEmpresa(empresa)}/${fechaIso.slice(0, 10)}.json`;
}

const META_JSON = { httpMetadata: { contentType: 'application/json' } };

async function leerJson(env, key) {
  const o = await env.FILES.get(key);
  if (!o) return null;
  try { return { data: await o.json(), etag: o.etag }; } catch { return null; }
}

// Vacía la ranura sobrescribiéndola (sin borrar). El registro anterior deja de existir.
async function vaciarRanura(env, key, estado, ahora) {
  await env.FILES.put(key, JSON.stringify({ estado, ts: ahora }), { ...META_JSON, customMetadata: { estado: 'vacio', ts: String(ahora) } });
}

async function promover(env, key, pendiente, ahora) {
  const fechaIso = new Date(pendiente.ts || ahora).toISOString();
  const id = `${fechaIso.slice(0, 10)}-${pendiente.id || (await hashCorto(key + ahora))}`;
  await env.FILES.put(claveBueno(pendiente.empresa, fechaIso, id), JSON.stringify(pendiente.registro), {
    ...META_JSON, customMetadata: { origen: 'dataset-adr-0029' },
  });
  await vaciarRanura(env, key, 'promovido', ahora);
  return 'promovido';
}

// Resuelve la ranura pendiente del usuario a la vista de su mensaje nuevo.
async function resolverPendienteDataset(env, { empresa, usuario_id, mensaje, ahora = Date.now() }) {
  if (!datasetActivo(env)) return 'apagado';
  const key = clavePendiente(empresa, await hashCorto(usuario_id));
  const cur = await leerJson(env, key);
  if (!cur || cur.data?.estado !== 'pendiente' || !cur.data.registro) return 'sin_pendiente';
  const antiguedadMs = ahora - (+cur.data.ts || 0);
  if (antiguedadMs >= DATASET_HORAS_PROMOCION * 3600 * 1000) return promover(env, key, cur.data, ahora);
  if (esCorreccionUsuario(mensaje)) { await vaciarRanura(env, key, 'descartado', ahora); return 'descartado'; }
  return promover(env, key, cur.data, ahora);
}

// Reserva una plaza del cupo diario de la empresa (escritura condicional por etag).
async function reservarCuota(env, empresa, ahora, maximo = DATASET_MAX_DIA_EMPRESA) {
  const key = claveCuota(empresa, new Date(ahora).toISOString());
  for (let intento = 0; intento < 4; intento++) {
    const cur = await leerJson(env, key);
    const n = +(cur?.data?.n) || 0;
    if (n >= maximo) return false;
    const opts = { ...META_JSON };
    if (cur) opts.onlyIf = { etagMatches: cur.etag };
    const put = await env.FILES.put(key, JSON.stringify({ n: n + 1 }), opts);
    if (put) return true;
  }
  return false;
}

// Guarda el turno en la ranura pendiente si es apto y queda cupo.
async function capturarTurnoDataset(env, { empresa, usuario_id, mensaje, traza, toolsDisponibles = [], personas = [], ahora = Date.now() }) {
  if (!datasetActivo(env)) return { guardado: false, motivo: 'apagado' };
  const ev = evaluarTurnoDataset(traza);
  if (!ev.apto) return { guardado: false, motivo: ev.motivo };
  const fechaIso = new Date(ahora).toISOString();
  const registro = construirRegistroDataset({
    traza, mensaje, toolsDisponibles, personas,
    empresaHash: await hashCorto('empresa:' + empresa), fecha: fechaIso,
  });
  if (!registro) return { guardado: false, motivo: 'demasiado_grande' };
  if (!(await reservarCuota(env, empresa, ahora))) return { guardado: false, motivo: 'cupo_diario' };
  const usuarioHash = await hashCorto(usuario_id);
  const id = await hashCorto(`${usuarioHash}:${ahora}:${Math.random()}`);
  await env.FILES.put(clavePendiente(empresa, usuarioHash), JSON.stringify({ estado: 'pendiente', ts: ahora, id, empresa: String(empresa), registro }), {
    ...META_JSON, customMetadata: { estado: 'pendiente', ts: String(ahora) },
  });
  return { guardado: true, motivo: 'pendiente' };
}

// Punto de entrada tras un turno de /api/chat/stream. Nunca lanza.
async function procesarTurnoDataset(env, { empresa, usuario_id, mensaje, authOk, esCron, adjuntos, usuarioLabel, resp, ahora = Date.now() }) {
  if (!datasetActivo(env)) return { resuelto: 'apagado', guardado: false, motivo: 'apagado' };
  let resuelto = 'error';
  try { resuelto = await resolverPendienteDataset(env, { empresa, usuario_id, mensaje, ahora }); } catch (e) { console.warn('[dataset] resolver:', e.message); }
  const d = resp && resp._dataset;
  if (!d) return { resuelto, guardado: false, motivo: 'sin_traza' };
  const traza = {
    ...d, authOk: !!authOk, esCron: !!esCron,
    adjuntos: Array.isArray(adjuntos) ? adjuntos.length : 0,
    experto: resp.experto, modelo: resp.modelo, texto_final: resp.texto,
  };
  try {
    const r = await capturarTurnoDataset(env, { empresa, usuario_id, mensaje, traza, toolsDisponibles: d.tools || [], personas: usuarioLabel ? [usuarioLabel] : [], ahora });
    return { resuelto, ...r };
  } catch (e) {
    console.warn('[dataset] capturar:', e.message);
    return { resuelto, guardado: false, motivo: 'error' };
  }
}

// Cron: promueve las ranuras pendientes con más de DATASET_HORAS_PROMOCION horas.
async function promoverPendientesCaducados(env, ahora = Date.now()) {
  if (!datasetActivo(env)) return { promovidos: 0, apagado: true };
  let cursor, listados = 0, promovidos = 0;
  const limite = ahora - DATASET_HORAS_PROMOCION * 3600 * 1000;
  do {
    const r = await env.FILES.list({ prefix: 'dataset/', cursor, limit: 1000, include: ['customMetadata'] });
    listados++;
    for (const o of r.objects || []) {
      if (promovidos >= DATASET_CRON_MAX_PROMOCIONES) break;
      if (!o.key.includes('/pendiente/') || o.customMetadata?.estado !== 'pendiente') continue;
      if ((+o.customMetadata.ts || 0) > limite) continue;
      const cur = await leerJson(env, o.key);
      if (!cur || cur.data?.estado !== 'pendiente' || !cur.data.registro || (+cur.data.ts || 0) > limite) continue;
      await promover(env, o.key, cur.data, ahora);
      promovidos++;
    }
    cursor = r.truncated ? r.cursor : undefined;
  } while (cursor && listados < DATASET_CRON_MAX_LISTADOS && promovidos < DATASET_CRON_MAX_PROMOCIONES);
  return { promovidos, listados };
}

export {
  DATASET_MAX_DIA_EMPRESA,
  DATASET_HORAS_PROMOCION,
  datasetActivo,
  hashCorto,
  clavePendiente,
  claveBueno,
  claveCuota,
  resolverPendienteDataset,
  reservarCuota,
  capturarTurnoDataset,
  procesarTurnoDataset,
  promoverPendientesCaducados,
};
