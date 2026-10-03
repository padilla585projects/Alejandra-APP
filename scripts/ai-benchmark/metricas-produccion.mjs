// ADR-0028 §Medición — métricas del pool de IA EN PRODUCCIÓN, sin escrituras nuevas en D1.
//
// Tres fuentes (todas de SOLO LECTURA; ninguna imprime contenido de mensajes):
//
//   --fuente d1 (por defecto)  Agrega lo que YA registra alejandra_token_uso (una fila por
//       llamada con tokens: el pool escribe modelo='ai_pool:<modelo real>' y proveedor
//       'ai_pool' en la misma fila que antes escribía Haiku/gpt-4o-mini). Da turnos resueltos
//       por el pool por uso y modelo real, y las llamadas a Haiku del router en la misma
//       ventana como PROXY del respaldo. No da los motivos del respaldo (no se guardan en D1).
//       Ejecuta `npx wrangler d1 execute alejandra-db --remote --json --command "SELECT ..."`
//       (requiere `wrangler login` y la autorización de lectura de D1 de CLAUDE.md).
//   --fuente tail              Escucha `npx wrangler tail alejandra-agente --format json`
//       durante --minutos N (por defecto 10) y agrega las líneas AIPOOL_METRICA: ok/respaldo/
//       omitido, MOTIVOS de respaldo, modelos reales y latencias. Solo ve lo que pasa mientras
//       escucha. Del evento de tail solo se leen esas líneas; el resto se descarta.
//   --fuente ae                Lee Workers Analytics Engine (dataset alejandra_ai_pool) por su
//       SQL API: lo mismo que tail pero histórico. Requiere activar el binding AI_POOL_AE
//       (comentado en alejandra-agente/wrangler.toml) y un token de API con permiso
//       Account > Account Analytics > Read en CF_API_TOKEN (lo crea Adrián, nunca un agente).
//
// Opciones: --horas N (1–720, por defecto 24) | --desde "AAAA-MM-DD[ HH:MM]" (UTC), --json.
// Ejemplos:
//   node scripts/ai-benchmark/metricas-produccion.mjs --horas 48
//   node scripts/ai-benchmark/metricas-produccion.mjs --fuente tail --minutos 15
//   CF_API_TOKEN=... node scripts/ai-benchmark/metricas-produccion.mjs --fuente ae --horas 168
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CUENTA_CLOUDFLARE = 'd65ead2b2967bf68ff3848a36cd7b1b4'; // alejandra-agente/wrangler.toml
export const DATASET_AE = 'alejandra_ai_pool';
const MODELO_ROUTER = 'claude-haiku-4-5';

// ── Ventana de tiempo (validada: acaba dentro de SQL) ───────────────────────────────
export function ventana({ horas = null, desde = null } = {}) {
  if (desde !== null && desde !== undefined) {
    const d = String(desde).trim();
    if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(d)) throw new Error('--desde debe ser "AAAA-MM-DD" o "AAAA-MM-DD HH:MM" (UTC)');
    return { tipo: 'desde', desde: d };
  }
  const h = horas === null || horas === undefined ? 24 : Number(horas);
  if (!Number.isInteger(h) || h < 1 || h > 720) throw new Error('--horas debe ser un entero entre 1 y 720');
  return { tipo: 'horas', horas: h };
}

// ── D1: alejandra_token_uso (solo columnas sin datos personales) ──────────────────────
export function consultaD1(v) {
  const filtro = v.tipo === 'desde' ? `created_at >= '${v.desde}'` : `created_at >= datetime('now', '-${v.horas} hours')`;
  return 'SELECT tipo, proveedor, modelo, COUNT(*) AS n, SUM(tokens_entrada) AS tokens_entrada, '
    + 'SUM(tokens_salida) AS tokens_salida, ROUND(SUM(coste_usd), 6) AS coste_usd, '
    + 'MIN(created_at) AS primera, MAX(created_at) AS ultima '
    + `FROM alejandra_token_uso WHERE ${filtro} GROUP BY tipo, proveedor, modelo ORDER BY tipo, n DESC`;
}

// Uso del pool (ADR-0028 §Alcance) al que corresponde cada `tipo` de alejandra_token_uso.
export function usoDeTipo(tipo) {
  const t = String(tipo || '');
  if (t === 'clasificacion') return 'router';
  if (t === 'chat_simple') return 'experto_simple';
  // chat_stream mezcla expertos: pool = experto simple resuelto por el pool, haiku = simple
  // por su respaldo Haiku, otros = expertos Sonnet.
  if (t === 'chat_stream') return 'chat_stream';
  if (t === 'chat_stream_fallback') return 'respaldo_anthropic';
  if (t === 'web_search') return 'buscar_web';
  if (t === 'cron_normal' || t === 'resumen_conversacion') return t;
  if (t.endsWith('_haiku_fallback')) return t.slice(0, -'_haiku_fallback'.length);
  if (t.startsWith('chat_')) return 'experto_' + t.slice(5);
  return t || 'desconocido';
}

const esPool = f => f.proveedor === 'ai_pool' || String(f.modelo || '').startsWith('ai_pool:');
const esHaiku = f => String(f.modelo || '').startsWith('claude-haiku');

export function agregarFilasD1(filas) {
  const usos = {};
  for (const f of filas) {
    const uso = usoDeTipo(f.tipo);
    const u = usos[uso] || (usos[uso] = { pool: 0, haiku: 0, otros: 0, modelosReales: {}, otrosModelos: {}, costeUsd: 0 });
    const n = Number(f.n) || 0;
    u.costeUsd += Number(f.coste_usd) || 0;
    if (esPool(f)) {
      u.pool += n;
      const real = String(f.modelo || '').replace(/^ai_pool:/, '') || 'desconocido';
      u.modelosReales[real] = (u.modelosReales[real] || 0) + n;
    } else if (esHaiku(f)) u.haiku += n;
    else { u.otros += n; u.otrosModelos[f.modelo] = (u.otrosModelos[f.modelo] || 0) + n; }
  }
  for (const u of Object.values(usos)) {
    const base = u.pool + u.haiku;
    u.tasaPool = base ? u.pool / base : null;
    u.costeUsd = Math.round(u.costeUsd * 1e6) / 1e6;
  }
  const router = usos.router || { pool: 0, haiku: 0 };
  return {
    usos,
    resumen: {
      turnosPool: Object.values(usos).reduce((s, u) => s + u.pool, 0),
      routerPool: router.pool,
      // Proxy de respaldo: cada clasificación por Haiku es un mensaje en el que el pool no
      // clasificó (respaldo, circuito abierto o pool apagado). Los resueltos por regex no
      // escriben fila, así que no cuentan en ninguno de los dos lados.
      routerHaikuProxyRespaldo: router.haiku,
      tasaRouterPool: router.pool + router.haiku ? router.pool / (router.pool + router.haiku) : null,
    },
  };
}

// Salida de `wrangler d1 execute --json`: [{ results: [...], success, meta }].
export function filasDeSalidaWrangler(texto) {
  const m = /\[\s*\{/.exec(texto);
  if (!m) throw new Error('wrangler no devolvió JSON');
  const ini = m.index;
  const datos = JSON.parse(texto.slice(ini));
  return (Array.isArray(datos) ? datos : [datos]).flatMap(r => r.results || []);
}

// wrangler tail --format json emite objetos JSON (a veces en varias líneas y partidos entre
// trozos de stdout): se separan contando llaves fuera de cadenas. Devuelve la función que
// recibe cada trozo; llama a onObjeto con cada objeto completo (los que no son JSON se ignoran).
export function crearLectorObjetosJson(onObjeto) {
  let buf = '';
  let pos = 0, prof = 0, inicio = -1, enCadena = false, escape = false;
  return trozo => {
    buf += trozo;
    for (; pos < buf.length; pos++) {
      const c = buf[pos];
      if (enCadena) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') enCadena = false; continue; }
      if (prof === 0) { if (c === '{') { inicio = pos; prof = 1; } continue; }
      if (c === '"') enCadena = true;
      else if (c === '{') prof++;
      else if (c === '}' && --prof === 0) {
        try { onObjeto(JSON.parse(buf.slice(inicio, pos + 1))); } catch (_) { /* no era JSON */ }
        inicio = -1;
      }
    }
    if (prof === 0) { buf = ''; pos = 0; }
    else if (inicio > 0) { buf = buf.slice(inicio); pos -= inicio; inicio = 0; }
  };
}

// ── tail: líneas AIPOOL_METRICA ─────────────────────────────────────────────────────
// Del evento JSON de `wrangler tail` solo se miran los mensajes de log que empiezan por
// AIPOOL_METRICA, y de cada uno solo los campos de la métrica (nunca contenido).
const CAMPOS_METRICA = ['uso', 'modelo', 'modeloReal', 'resultado', 'motivo', 'ms'];
export function metricasDeEventoTail(evento) {
  const out = [];
  for (const log of (evento && evento.logs) || []) {
    for (const m of [].concat(log.message || [])) {
      if (typeof m !== 'string' || !m.startsWith('AIPOOL_METRICA ')) continue;
      try {
        const d = JSON.parse(m.slice('AIPOOL_METRICA '.length));
        out.push(Object.fromEntries(CAMPOS_METRICA.map(k => [k, d[k] ?? null])));
      } catch (_) { /* línea rota: se ignora */ }
    }
  }
  return out;
}

function percentil(v, p) {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  return Math.round(o[Math.max(0, Math.ceil(o.length * p) - 1)]);
}

export function agregarMetricas(metricas) {
  const usos = {};
  for (const m of metricas) {
    const u = usos[m.uso || 'desconocido'] || (usos[m.uso || 'desconocido'] = { ok: 0, respaldo: 0, omitido: 0, motivos: {}, modelosReales: {}, msOk: [] });
    const r = ['ok', 'respaldo', 'omitido'].includes(m.resultado) ? m.resultado : 'respaldo';
    u[r]++;
    if (r !== 'ok' && m.motivo) u.motivos[m.motivo] = (u.motivos[m.motivo] || 0) + 1;
    if (m.modeloReal) u.modelosReales[m.modeloReal] = (u.modelosReales[m.modeloReal] || 0) + 1;
    if (r === 'ok' && Number.isFinite(m.ms)) u.msOk.push(m.ms);
  }
  for (const u of Object.values(usos)) {
    const total = u.ok + u.respaldo + u.omitido;
    u.total = total;
    u.tasaExito = total ? u.ok / total : null;
    u.p50MsOk = percentil(u.msOk, 0.5);
    u.p95MsOk = percentil(u.msOk, 0.95);
    delete u.msOk;
  }
  return { usos };
}

// ── Analytics Engine (SQL API) ──────────────────────────────────────────────────────
// blobs = [uso, resultado, motivo, modelo, modeloReal, worker], doubles = [ms (-1 sin dato), 1]
// (ver fijarSumideroMetricasPool en alejandra-agente/ai-pool.js). Muestreo adaptativo:
// los recuentos se ponderan con _sample_interval.
export function consultaAE(v) {
  const filtro = v.tipo === 'desde'
    ? `timestamp >= toDateTime('${v.desde.length === 10 ? v.desde + ' 00:00:00' : (v.desde.length === 16 ? v.desde + ':00' : v.desde)}')`
    : `timestamp > NOW() - INTERVAL '${v.horas}' HOUR`;
  return 'SELECT blob1 AS uso, blob2 AS resultado, blob3 AS motivo, blob5 AS modelo_real, blob6 AS worker, '
    + 'SUM(_sample_interval) AS n, '
    + 'SUM(IF(double1 >= 0, _sample_interval * double1, 0)) / SUM(IF(double1 >= 0, _sample_interval, 0)) AS ms_medio '
    + `FROM ${DATASET_AE} WHERE ${filtro} GROUP BY uso, resultado, motivo, modelo_real, worker ORDER BY uso, n DESC FORMAT JSON`;
}

export function agregarFilasAE(filas) {
  const usos = {};
  for (const f of filas) {
    const uso = f.uso || 'desconocido';
    const u = usos[uso] || (usos[uso] = { ok: 0, respaldo: 0, omitido: 0, motivos: {}, modelosReales: {}, workers: {} });
    const n = Number(f.n) || 0;
    const r = ['ok', 'respaldo', 'omitido'].includes(f.resultado) ? f.resultado : 'respaldo';
    u[r] += n;
    if (r !== 'ok' && f.motivo) u.motivos[f.motivo] = (u.motivos[f.motivo] || 0) + n;
    if (f.modelo_real) u.modelosReales[f.modelo_real] = (u.modelosReales[f.modelo_real] || 0) + n;
    if (f.worker) u.workers[f.worker] = (u.workers[f.worker] || 0) + n;
  }
  for (const u of Object.values(usos)) {
    u.total = u.ok + u.respaldo + u.omitido;
    u.tasaExito = u.total ? u.ok / u.total : null;
  }
  return { usos };
}

// ── Informe en texto (solo cifras y nombres de modelo/uso/motivo) ────────────────────
const pct = x => (x === null || x === undefined ? 'N/D' : (100 * x).toFixed(1) + ' %');
const lista = o => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', ') || '—';

export function informe(fuente, v, datos) {
  const ventanaTxt = v.tipo === 'desde' ? `desde ${v.desde} UTC` : `últimas ${v.horas} h`;
  const l = [`Métricas del pool de IA (ADR-0028) — fuente ${fuente}, ${ventanaTxt}`, ''];
  if (fuente === 'd1') {
    const r = datos.resumen;
    l.push(`Turnos resueltos por el pool: ${r.turnosPool}`);
    l.push(`Router: pool ${r.routerPool} · Haiku ${r.routerHaikuProxyRespaldo} (proxy de respaldo) · tasa pool ${pct(r.tasaRouterPool)}`);
    l.push('', 'uso | pool | haiku | otros | tasa pool | modelos reales del pool | coste USD');
    for (const [uso, u] of Object.entries(datos.usos).sort()) {
      l.push(`${uso} | ${u.pool} | ${u.haiku} | ${u.otros} | ${pct(u.tasaPool)} | ${lista(u.modelosReales)} | ${u.costeUsd}`);
    }
    l.push('', 'Los motivos del respaldo no están en D1: --fuente tail (en vivo) o --fuente ae (histórico).');
  } else {
    l.push('uso | total | ok | respaldo | omitido | tasa éxito | motivos de respaldo | modelos reales' + (fuente === 'tail' ? ' | p50/p95 ms ok' : ''));
    for (const [uso, u] of Object.entries(datos.usos).sort()) {
      l.push(`${uso} | ${u.total} | ${u.ok} | ${u.respaldo} | ${u.omitido} | ${pct(u.tasaExito)} | ${lista(u.motivos)} | ${lista(u.modelosReales)}` + (fuente === 'tail' ? ` | ${u.p50MsOk ?? 'N/D'}/${u.p95MsOk ?? 'N/D'}` : ''));
    }
    if (!Object.keys(datos.usos).length) l.push('(sin métricas en la ventana: ¿pool apagado o sin tráfico?)');
  }
  return l.join('\n');
}

// ── Ejecución ───────────────────────────────────────────────────────────────────────
const enWindows = process.platform === 'win32';

function leerD1(v) {
  const sql = consultaD1(v);
  if (!/^SELECT /.test(sql) || sql.includes(';') || sql.includes('"')) throw new Error('consulta no permitida');
  // Con shell (Windows/npx) la SQL va entre comillas dobles; no lleva ni " ni % ni ;.
  const args = ['wrangler', 'd1', 'execute', 'alejandra-db', '--remote', '--json', '--command', enWindows ? `"${sql}"` : sql];
  const r = spawnSync('npx', args, { encoding: 'utf8', shell: enWindows, cwd: fileURLToPath(new URL('../../alejandra-agente/', import.meta.url)), maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('wrangler d1 execute falló (¿wrangler login?): ' + String(r.stderr || '').split('\n').filter(Boolean).slice(-2).join(' '));
  return agregarFilasD1(filasDeSalidaWrangler(r.stdout));
}

function leerTail(minutos) {
  return new Promise((ok, ko) => {
    const hijo = spawn('npx', ['wrangler', 'tail', 'alejandra-agente', '--format', 'json'], { shell: enWindows, cwd: fileURLToPath(new URL('../../alejandra-agente/', import.meta.url)) });
    const metricas = [];
    const lector = crearLectorObjetosJson(ev => metricas.push(...metricasDeEventoTail(ev)));
    hijo.stdout.setEncoding('utf8');
    hijo.stdout.on('data', lector);
    hijo.on('error', ko);
    console.error(`Escuchando alejandra-agente ${minutos} min (Ctrl+C para cortar antes)...`);
    const fin = () => { try { hijo.kill(); } catch (_) {} ok(agregarMetricas(metricas)); };
    const t = setTimeout(fin, minutos * 60000);
    process.once('SIGINT', () => { clearTimeout(t); fin(); });
  });
}

async function leerAE(v, env = process.env, fetchImpl = fetch) {
  const token = env.CF_API_TOKEN;
  if (!token) throw new Error('Falta CF_API_TOKEN (token de API con Account > Account Analytics > Read; lo crea Adrián).');
  const cuenta = env.CF_ACCOUNT_ID || CUENTA_CLOUDFLARE;
  const r = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: consultaAE(v), signal: AbortSignal.timeout(30000),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`SQL API de Analytics Engine: HTTP ${r.status}` + (/does not exist|unknown table/i.test(texto) ? ' (el dataset aún no existe: ¿binding AI_POOL_AE activado y desplegado?)' : ''));
  return agregarFilasAE(JSON.parse(texto).data || []);
}

export function parsearArgs(argv) {
  const o = { fuente: 'd1', horas: null, desde: null, minutos: 10, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--fuente') o.fuente = argv[++i];
    else if (a === '--horas') o.horas = Number(argv[++i]);
    else if (a === '--desde') o.desde = argv[++i];
    else if (a === '--minutos') o.minutos = Number(argv[++i]);
    else throw new Error('opción desconocida: ' + a);
  }
  if (!['d1', 'tail', 'ae'].includes(o.fuente)) throw new Error('--fuente debe ser d1, tail o ae');
  if (!Number.isFinite(o.minutos) || o.minutos <= 0 || o.minutos > 120) throw new Error('--minutos entre 1 y 120');
  return o;
}

export async function main(argv = process.argv.slice(2)) {
  const o = parsearArgs(argv);
  const v = ventana(o);
  const datos = o.fuente === 'd1' ? leerD1(v) : o.fuente === 'tail' ? await leerTail(o.minutos) : await leerAE(v);
  console.log(o.json ? JSON.stringify({ fuente: o.fuente, ventana: v, ...datos }, null, 2) : informe(o.fuente, v, datos));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error('Error: ' + e.message); process.exit(1); });
}
export { leerAE as _leerAE };
