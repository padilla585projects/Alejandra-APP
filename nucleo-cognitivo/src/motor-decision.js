/**
 * Motor de Decisión — ADR-0004, docs/architecture/04-MOTOR-DE-DECISION.md
 *
 * Responsabilidad: elegir, para una solicitud normalizada, una de las salidas
 * controladas listadas en SALIDAS_VALIDAS. No responsabilidad: ejecutar,
 * conceder permisos, ni sustituir a Policy Engine, Planner, Verifier o QA.
 *
 * Coordina Context Engine y Planner, que en este esqueleto siguen siendo
 * interfaces sin implementar; por tanto `decidir()` tampoco puede implementarse
 * todavía sin fabricar una decisión sin fundamento real.
 */

export const SALIDAS_VALIDAS = Object.freeze([
  'respuesta_directa', 'solicitar_informacion', 'recuperar_contexto', 'consultar_memoria',
  'buscar_conocimiento', 'plan', 'solicitar_aprobacion', 'invocar_tool',
  'activar_colaboracion', 'rechazar', 'posponer',
]);

/**
 * Campos de traza obligatorios en toda decisión, tal como los fija
 * 04-MOTOR-DE-DECISION.md ("Responsabilidades, entradas y salidas" →
 * Trazabilidad). ARC-008 (observabilidad) sigue abierto: esto fija la FORMA que
 * debe tener una decisión, no implementa su persistencia ni consulta real. El
 * Director exigió explícitamente que ninguna decisión se tome sin esta forma.
 */
export const CAMPOS_TRAZA_OBLIGATORIOS = Object.freeze([
  'decision', 'motivos', 'evidencia', 'confianza', 'riesgo', 'permisos_efectivos',
  'modo', 'criterio_salida',
]);

/**
 * Comprueba que un objeto de decisión trae todos los campos de traza exigidos.
 * No valida su contenido — solo hace estructuralmente detectable la omisión de
 * un campo, que es la forma mínima de "decisión sin trazabilidad suficiente".
 * @param {object} decision
 * @returns {boolean}
 */
export function tieneTrazaSuficiente(decision) {
  if (!decision || typeof decision !== 'object') return false;
  return CAMPOS_TRAZA_OBLIGATORIOS.every((campo) => campo in decision);
}

/**
 * @param {object} _solicitud
 * @returns {never}
 */
export function decidir(_solicitud) {
  throw new Error(
    'Motor de Decisión: interfaz definida (ADR-0004), sin implementación real. ' +
    'Requiere Context Engine y Planner operativos — fuera del alcance del esqueleto de F-1.2.'
  );
}
