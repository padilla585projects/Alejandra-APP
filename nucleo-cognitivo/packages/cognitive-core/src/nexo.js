// ADR-0021: Nexo v1 — Interfaz para nucleo-cognitivo
// Mismo patrón que memory.js: interfaz pura, se inyecta desde el Worker.

/**
 * Crea una instancia de Nexo con las fuentes registradas y el conector de trazas.
 * @param {Object} fuentes - Mapa de fuentes (desde nexo-fuentes.js)
 * @param {Function} registrarConsulta - Función para registrar consultas (registrarNexoConsulta)
 * @returns {Object} Interfaz de Nexo
 */
export function crearNexo(fuentes, registrarConsulta) {
  const stats = {};

  return {
    /**
     * Busca en una fuente específica.
     * @param {string} fuenteId - ID de la fuente
     * @param {Object} params - Parámetros de la consulta
     * @returns {Promise<Object>} Resultado de la consulta
     */
    async buscar(fuenteId, params) {
      const fuente = fuentes[fuenteId];
      if (!fuente) {
        return { ok: false, error: `Fuente "${fuenteId}" no registrada` };
      }
      // Acumular estadísticas locales
      stats[fuenteId] = stats[fuenteId] || { consultas: 0, aciertos: 0 };
      stats[fuenteId].consultas++;
      // La implementación real del conector se inyecta desde el Worker
      return { ok: true, fuente: fuente.nombre, params };
    },

    /**
     * Lista todas las fuentes registradas.
     * @returns {Array} Lista de fuentes con su metadato
     */
    listarFuentes() {
      return Object.values(fuentes).map(f => ({
        id: f.id,
        nombre: f.nombre,
        tipo: f.tipo,
        fiabilidad: f.fiabilidad,
        ttl_horas: f.ttl_horas,
        ambito: f.ambito,
        conector: f.conector,
        fallback: f.fallback,
      }));
    },

    /**
     * Estadísticas de uso de una fuente.
     * @param {string} fuenteId - ID de la fuente (opcional, todas si se omite)
     * @returns {Object} Estadísticas
     */
    estadisticas(fuenteId) {
      if (fuenteId) {
        return { fuente: fuenteId, ...(stats[fuenteId] || { consultas: 0, aciertos: 0 }) };
      }
      return { ...stats };
    },
  };
}
