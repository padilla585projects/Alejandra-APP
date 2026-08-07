/**
 * Context Engine — docs/03-ARQUITECTURA-COGNITIVA.md
 *
 * Responsabilidad: construir contexto relevante, actual y acotado por identidad
 * y tenant (empresa/obra/departamento). No responsabilidad: decidir políticas ni
 * mezclar tenants.
 *
 * Interfaz únicamente. La implementación real exige leer datos de producción
 * (D1) de forma acotada por tenant — eso es integración con datos reales, fuera
 * del alcance de un esqueleto que el Director pidió explícitamente que no
 * activara. Se define aquí solo la forma de la solicitud para que quede fijada
 * antes de construir sobre ella.
 *
 * @typedef {Object} SolicitudContexto
 * @property {string} empresaId
 * @property {string} [obraId]
 * @property {string} [departamentoId]
 * @property {string[]} camposNecesarios
 */

/**
 * @param {SolicitudContexto} _solicitud
 * @returns {never}
 */
export function construirContexto(_solicitud) {
  throw new Error(
    'Context Engine: interfaz definida, sin implementación. Requiere wiring real a D1 ' +
    'acotado por tenant — fuera del alcance del esqueleto de F-1.2.'
  );
}
