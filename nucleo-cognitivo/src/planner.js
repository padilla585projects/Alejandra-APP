/**
 * Planner — docs/03-ARQUITECTURA-COGNITIVA.md
 *
 * Responsabilidad: formular el plan mínimo, precondiciones y criterio de éxito.
 * No responsabilidad: conceder permisos ni ejecutar directamente.
 *
 * Interfaz únicamente: un plan real necesita contexto de Context Engine y la
 * clasificación de Policy Engine para cada paso, y el primero sigue sin
 * implementación real en este esqueleto.
 *
 * @typedef {Object} PasoPlan
 * @property {string} descripcion
 * @property {'N0'|'N1'|'N2'|'N3'} nivelRiesgo
 * @property {boolean} tieneRollback
 *
 * @typedef {Object} Plan
 * @property {PasoPlan[]} pasos
 * @property {string} criterioExito
 */

/**
 * @param {object} _evaluacion
 * @returns {never}
 */
export function construirPlan(_evaluacion) {
  throw new Error(
    'Planner: interfaz definida, sin implementación. Requiere Context Engine y Policy ' +
    'Engine operando sobre datos reales — fuera del alcance del esqueleto de F-1.2.'
  );
}
