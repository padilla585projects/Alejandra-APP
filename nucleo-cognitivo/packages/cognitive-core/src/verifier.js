/**
 * Verifier — ADR-0009, docs/architecture/04-MOTOR-DE-DECISION.md
 *
 * Responsabilidad: nombrar y exponer el contrato de los tres niveles de
 * verificación que ADR-0009 generaliza a partir de lo que ya existe en
 * producción (`CONFIRMO BORRADO`, el botón de Telegram de `alejandra_fixes`).
 * No responsabilidad: ejecutar acciones, sustituir esos mecanismos ya
 * probados, ni decidir cuándo se invoca — eso es del Motor de Decisión.
 *
 * Determinista y explicabilidad tienen implementación real aquí, ambas sin
 * I/O: determinista aplica una condición programable ya provista; explicabilidad
 * (ADR-0020 rebanada 3, 2026-08-07) valida que una decisión trae razonamiento
 * real (motivos/evidencia con contenido), no solo campos presentes. Revisión
 * humana asíncrona (ADR-0023, 2026-09-03) construye y valida la *solicitud*
 * que cada Worker persiste en `acciones_pendientes` y que un humano aprueba
 * por chat/Telegram/panel — también sin I/O: nunca devuelve `aprobado: true`,
 * porque una solicitud recién creada no está aprobada por definición.
 */

export const NIVELES_VERIFICACION = Object.freeze([
  'determinista', 'revision_humana_asincrona', 'explicabilidad',
]);

/**
 * Nivel determinista (ADR-0009): aplica una condición objetiva y programable
 * a un valor. No decide qué condición usar — la recibe como función pura,
 * igual que `CONFIRMO BORRADO` es una condición fija (¿el SQL es
 * destructivo?), no una que el modelo elige en tiempo de ejecución.
 * @param {(valor: unknown) => boolean} condicion
 * @param {unknown} valor
 * @returns {{nivel: 'determinista', aprobado: boolean}}
 */
export function verificarDeterminista(condicion, valor) {
  if (typeof condicion !== 'function') {
    throw new Error('verificarDeterminista requiere una condición (function) pura, no una decisión del modelo');
  }
  return { nivel: 'determinista', aprobado: condicion(valor) === true };
}

const RE_CODIGO_HEX6 = /^[0-9A-F]{6}$/;
const RE_FECHA_UTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * Nivel revisión humana asíncrona (ADR-0009 → ADR-0023, 2026-09-03): para
 * acciones N2, la acción NO se ejecuta — se construye una *solicitud* que el
 * Worker persiste en la cola `acciones_pendientes` y que un humano aprueba
 * por chat, Telegram o panel. Aquí solo se valida y se normaliza esa
 * solicitud, sin I/O (mismo criterio que `registrarExplicabilidad`): el
 * INSERT, la notificación y la ejecución diferida viven en cada Worker.
 *
 * Contrato: devuelve SIEMPRE `aprobado: false` — una solicitud recién
 * construida nunca está aprobada; el modelo no puede aprobar nada desde aquí.
 * Lanza si la solicitud no es completa: una revisión con datos a medias no
 * es una revisión.
 *
 * @param {{tool: string, input: object, resumen: string, codigo: string,
 *          caducaAt: string, solicitanteId: number|string, worker?: 'agente'|'api'}} solicitud
 * @returns {{nivel: 'revision_humana_asincrona', aprobado: false, solicitud: object}}
 */
export function solicitarRevisionHumanaAsincrona(solicitud) {
  if (!solicitud || typeof solicitud !== 'object') {
    throw new Error('Verifier: revisión humana asíncrona requiere una solicitud completa (ADR-0023, ADR-0009).');
  }
  const { tool, input, resumen, codigo, caducaAt, solicitanteId, worker = 'agente' } = solicitud;
  if (typeof tool !== 'string' || !tool.trim()) throw new Error('Verifier: solicitud N2 sin tool (ADR-0023).');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Verifier: solicitud N2 sin input exacto (ADR-0023).');
  if (typeof resumen !== 'string' || !resumen.trim()) throw new Error('Verifier: solicitud N2 sin resumen para el humano (ADR-0023).');
  if (typeof codigo !== 'string' || !RE_CODIGO_HEX6.test(codigo)) throw new Error('Verifier: solicitud N2 con código inválido, se espera hex6 en mayúsculas (ADR-0023).');
  if (typeof caducaAt !== 'string' || !RE_FECHA_UTC.test(caducaAt)) throw new Error('Verifier: solicitud N2 sin caducidad UTC "YYYY-MM-DD HH:MM:SS" (ADR-0023).');
  if (solicitanteId === undefined || solicitanteId === null || String(solicitanteId).trim() === '') throw new Error('Verifier: solicitud N2 sin solicitante (ADR-0023).');
  if (worker !== 'agente' && worker !== 'api') throw new Error('Verifier: solicitud N2 con worker desconocido (ADR-0023).');
  return {
    nivel: 'revision_humana_asincrona',
    aprobado: false,
    solicitud: Object.freeze({
      tool: tool.trim(),
      input: JSON.parse(JSON.stringify(input)),
      resumen: resumen.trim(),
      codigo,
      caducaAt,
      solicitanteId: String(solicitanteId),
      worker,
    }),
  };
}

/**
 * Nivel explicabilidad (ADR-0009): toda decisión N1 en adelante debe quedar
 * registrada con su razonamiento. F-4.1 (dashboard de trazas, `GET
 * /admin/trazas`) y `registrarTraza()` (ADR-0014 §5) ya están en producción
 * en los dos Workers, así que la deuda que dejaba esta función como stub
 * (2026-08-02) queda saldada en ADR-0020 rebanada 3 (2026-08-07): valida,
 * sin I/O, que una decisión trae un razonamiento real, no solo campos
 * presentes — motivos no vacíos y evidencia con contenido. La persistencia
 * en sí (INSERT en `alejandra_trazas`) sigue siendo responsabilidad de cada
 * Worker vía `registrarTraza()`, fuera de este paquete aislado.
 * @param {object} decision - forma de `tieneTrazaSuficiente()` (motor-decision.js)
 * @returns {{nivel: 'explicabilidad', aprobado: boolean}}
 */
export function registrarExplicabilidad(decision) {
  if (!decision || typeof decision !== 'object') {
    return { nivel: 'explicabilidad', aprobado: false };
  }
  const motivosOk = Array.isArray(decision.motivos)
    && decision.motivos.length > 0
    && decision.motivos.every((m) => typeof m === 'string' && m.trim().length > 0);
  const evidenciaOk = decision.evidencia
    && typeof decision.evidencia === 'object'
    && Object.keys(decision.evidencia).length > 0;
  return { nivel: 'explicabilidad', aprobado: motivosOk === true && evidenciaOk === true };
}

/**
 * Qué niveles de verificación exige ADR-0009 para un nivel de riesgo
 * declarado (ADR-0006). Función pura: no decide si la verificación pasa,
 * solo qué niveles aplican. N3 queda fuera de los tres niveles invocables —
 * ADR-0006 ya la saca del flujo autónomo del agente por completo (requiere
 * autorización del Director, no verificación en código).
 * @param {'N0'|'N1'|'N2'|'N3'} nivelRiesgo
 * @returns {string[]}
 */
export function nivelesRequeridosPara(nivelRiesgo) {
  switch (nivelRiesgo) {
    case 'N0':
      return [];
    case 'N1':
      return ['explicabilidad'];
    case 'N2':
      return ['revision_humana_asincrona', 'explicabilidad'];
    case 'N3':
      return ['fuera_del_alcance_autonomo'];
    default:
      throw new Error(
        `nivelesRequeridosPara: nivel_riesgo inválido o ausente ("${nivelRiesgo}"). ` +
        'ADR-0006 exige uno de: N0, N1, N2, N3.'
      );
  }
}
