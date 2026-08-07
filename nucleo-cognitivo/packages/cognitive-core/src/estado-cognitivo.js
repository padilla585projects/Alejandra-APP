/**
 * Estado Cognitivo — docs/03-ARQUITECTURA-COGNITIVA.md
 *
 * Responsabilidad: mantener el estado EFÍMERO de una tarea en curso (fase, riesgo,
 * plan, evidencias, confianza). No responsabilidad: ser memoria persistente ni
 * fuente de verdad.
 *
 * Por diseño no importa ningún cliente de D1/R2/disco: vive solo en memoria de
 * proceso y se descarta con la tarea. Esto es lo que permite construirlo ya, sin
 * esperar a ARC-002 (gobierno de memoria) — no hay nada aquí que gobernar porque no
 * persiste.
 */

const FASES_VALIDAS = [
  'percibir', 'comprender', 'analizar', 'planificar', 'buscar_contexto',
  'buscar_conocimiento', 'seleccionar_herramientas', 'ejecutar', 'verificar', 'qa',
  'responder', 'aprender', 'proponer_mejoras',
];

/**
 * @param {string} tareaId
 * @returns {object} estado inicial en fase "percibir"
 */
export function crearEstadoCognitivo(tareaId) {
  if (!tareaId) throw new Error('crearEstadoCognitivo requiere tareaId');
  const ahora = Date.now();
  return {
    tareaId,
    fase: 'percibir',
    riesgo: null,
    plan: null,
    evidencias: [],
    confianza: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

/**
 * Devuelve un nuevo estado con los cambios aplicados. No muta el original —
 * el estado es un valor, no una referencia compartida entre etapas del ciclo.
 * @param {object} estado
 * @param {object} cambios
 */
export function actualizarEstadoCognitivo(estado, cambios = {}) {
  if (!estado || typeof estado !== 'object' || !estado.tareaId) {
    throw new Error('actualizarEstadoCognitivo requiere un estado creado con crearEstadoCognitivo');
  }
  if (cambios.fase && !FASES_VALIDAS.includes(cambios.fase)) {
    throw new Error(`Fase desconocida: "${cambios.fase}". Válidas: ${FASES_VALIDAS.join(', ')}`);
  }
  return { ...estado, ...cambios, actualizadoEn: Date.now() };
}

export { FASES_VALIDAS };
