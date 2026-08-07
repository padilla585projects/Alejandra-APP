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
 * humana asíncrona sigue dependiendo de un canal real (Telegram) que este
 * paquete aislado no tiene — lanza un error explícito citando la dependencia
 * que falta, mismo patrón que `context-engine.js`/`planner.js` en F-1.2, para
 * que no pueda usarse por accidente como si verificara de verdad.
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

/**
 * Nivel revisión humana asíncrona (ADR-0009): para acciones N2, la acción
 * queda pendiente de confirmación antes de tener efecto irreversible — hoy
 * es el botón de Telegram sobre `alejandra_fixes`, con destino fijo a
 * `DEV_CHAT_ID` hasta que exista más de un revisor humano (decisión del
 * Director en ADR-0009). Ese canal vive en cada Worker, no en este paquete
 * aislado.
 * @returns {never}
 */
export function solicitarRevisionHumanaAsincrona() {
  throw new Error(
    'Verifier: revisión humana asíncrona sin implementación real en este paquete aislado. ' +
    'Requiere el canal ya en producción (Telegram/alejandra_fixes) de cada Worker — fuera ' +
    'del alcance de nucleo-cognitivo/ (ADR-0009).'
  );
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
