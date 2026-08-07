// Shim transitorio: re-exporta desde el paquete @alejandra/cognitive-core.
// Mantiene compatibilidad con la importación existente en alejandra-agente/worker.js.
// Tras publicar el paquete e instalarlo como dependencia, esta ruta podrá retirarse
// y el worker importará directamente desde '@alejandra/cognitive-core/motor-decision'.
export { decidirInvocacionPilotoN0, tieneTrazaSuficiente } from '../packages/cognitive-core/src/motor-decision.js';