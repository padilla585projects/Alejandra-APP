/**
 * Verifier — ADR-0009, docs/architecture/04-MOTOR-DE-DECISION.md
 *
 * Responsabilidad: nombrar y exponer el contrato de los tres niveles de
 * verificación que ADR-0009 generaliza a partir de lo que ya existe en
 * producción (`CONFIRMO BORRADO`, el botón de Telegram de `alejandra_fixes`).
 * No responsabilidad: ejecutar acciones, sustituir esos mecanismos ya
 * probados, ni decidir cuándo se invoca — eso es del Motor de Decisión.
 *
 * El nivel determinista es el único con implementación real aquí: es una
 * condición programable que no depende de I/O. Revisión humana asíncrona y
 * explicabilidad dependen de un canal real (Telegram, D1 de `alejandra_trazas`)
 * que este paquete aislado no tiene — lanzan un error explícito citando la
 * dependencia que falta, mismo patrón que `context-engine.js`/`planner.js` en
 * F-1.2, para que no puedan usarse por accidente como si verificaran de verdad.
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
 * registrada con su razonamiento. El Director aceptó que este nivel NO
 * bloquea ninguna acción mientras no exista traza real — queda como deuda
 * explícita hasta F-4.1 (observabilidad). Este paquete aislado no persiste
 * nada; la persistencia real vive en `registrarTraza()` de cada Worker
 * (ADR-0014 §5, ya implementado fuera de `nucleo-cognitivo/`).
 * @returns {never}
 */
export function registrarExplicabilidad() {
  throw new Error(
    'Verifier: explicabilidad sin implementación real en este paquete aislado. ADR-0009 la ' +
    'deja como deuda explícita hasta F-4.1 (observabilidad); no bloquea ninguna acción. ' +
    'Motor de Decisión debe seguir operando sin invocar esta función mientras no exista traza.'
  );
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
