/**
 * Memory — docs/decisions/ADR-0013-GOBIERNO-DE-MEMORIA.md
 *
 * Responsabilidad: dar a `nucleo-cognitivo/` una forma equivalente a la de
 * `policy-engine.js` para consumir memoria semántica de largo plazo (hechos,
 * preferencias, procedimientos, correcciones) una vez exista persistencia real.
 * No responsabilidad: acceder a D1 directamente, decidir políticas, ni ejecutar
 * negocio — igual que `context-engine.js` y `planner.js`.
 *
 * Cada Worker (`worker.js`, `alejandra-agente/worker.js`) inyecta su propia
 * implementación de `consultarMemoria()` que lee de D1 (`memoria_gobernada`).
 * El núcleo acepta esta dependencia inyectada pero no la implementa — mismo
 * patrón que `registrarTraza()` en motor-decision.js.
 *
 * @typedef {Object} Recuerdo
 * @property {string} id - identificador único
 * @property {string} contenido - el recuerdo en sí
 * @property {string} origen - `usuario_id` concreto, `system`, o una tool (ADR-0013 §3)
 * @property {string} categoria - una de CATEGORIAS_LISTA_BLANCA
 * @property {'alta'|'media'|'baja'|number} confianza - ADR-0013 §4
 * @property {string} fecha_creacion - ISO timestamp
 * @property {string} caduca_en - ISO timestamp (ADR-0013 §5)
 * @property {'personal'|'compartida'} ambito - ADR-0013 §2
 * @property {'candidata_pendiente_validacion'|'confirmada'} estado - ADR-0013 §3
 * @property {string} metodo - 'declarado'|'corregido'|'procedimiento'|'inferido'
 */

let _consultarMemoriaImpl = null;
let _listarCandidatasPendientesImpl = null;
let _confirmarCandidataImpl = null;
let _rechazarCandidataImpl = null;

/**
 * Inyectar las implementaciones reales de memoria (ARC-008 §8, ADR-0013 §8).
 * Se invoca una sola vez desde cada Worker al inicializar, con las funciones
 * que leen/escriben `memoria_gobernada` en D1. Los campos omitidos dejan su
 * función correspondiente en el comportamiento por defecto (ver cada función).
 * @param {{
 *   consultarMemoria?: Function,
 *   listarCandidatasPendientes?: Function,
 *   confirmarCandidata?: Function,
 *   rechazarCandidata?: Function,
 * }} impls
 */
export function inyectarMemoria(impls = {}) {
  if (impls.consultarMemoria) _consultarMemoriaImpl = impls.consultarMemoria;
  if (impls.listarCandidatasPendientes) _listarCandidatasPendientesImpl = impls.listarCandidatasPendientes;
  if (impls.confirmarCandidata) _confirmarCandidataImpl = impls.confirmarCandidata;
  if (impls.rechazarCandidata) _rechazarCandidataImpl = impls.rechazarCandidata;
}

/**
 * Categorías de la lista blanca de ADR-0013 §1. Todo recuerdo `declarado`,
 * `corregido` o `procedimiento` debe encajar en una de estas categorías; lo que
 * no encaje no se persiste, aunque el modelo lo considere relevante.
 */
export const CATEGORIAS_LISTA_BLANCA = Object.freeze([
  'hechos_operativos',
  'preferencias_trabajo',
  'procedimientos_internos',
  'correcciones',
]);

/**
 * Valores válidos de `metodo` — de dónde salió el recuerdo (ADR-0013 §3).
 */
export const METODOS_VALIDOS = Object.freeze([
  'declarado',
  'corregido',
  'procedimiento',
  'inferido',
]);

/**
 * Valores válidos de `estado` — máquina de estados de ADR-0013 §1/§3. Solo
 * `confirmada` es consultable por `consultarMemoria`.
 */
export const ESTADOS_VALIDOS = Object.freeze([
  'candidata_pendiente_validacion',
  'confirmada',
]);

/**
 * Caducidad por defecto en meses, según ADR-0013 §5 — decisión del Director:
 * 6 meses para cualquier recuerdo, salvo `metodo = 'procedimiento'` con
 * aprobación de `encargado` o superior, que se extiende a 12 meses. Función
 * pura, sin I/O — mismo criterio que `policy-engine.js` sobre metadato ya
 * declarado.
 * @param {'declarado'|'corregido'|'procedimiento'|'inferido'} metodo
 * @returns {number} meses
 */
export function caducidadPorDefecto(metodo) {
  if (!METODOS_VALIDOS.includes(metodo)) {
    throw new Error(
      `metodo inválido o ausente: "${metodo}". Válidos: ${METODOS_VALIDOS.join(', ')}.`
    );
  }
  return metodo === 'procedimiento' ? 12 : 6;
}

/**
 * Consultar recuerdos confirmados por empresa, categoría, ámbito y confianza.
 * Retorna solo recuerdos en estado 'confirmada' y aún no caducados.
 * La implementación real (en cada Worker) registra una traza del tipo
 * 'memoria_consulta' con los recuerdos consultados, vinculada a la decisión
 * que la solicitó (ARC-008 §8 — trazabilidad de decisiones que usan memoria).
 *
 * Si no hay implementación inyectada, retorna un array vacío en lugar de lanzar
 * error — permite que el Motor de Decisión continúe sin bloqueo, aunque sin
 * memoria disponible.
 *
 * @param {{empresaId: string, consulta?: string, categorias?: string[], ambito?: 'personal'|'compartida', confianzaMinima?: number}} params
 * @returns {Promise<Recuerdo[]>}
 */
export async function consultarMemoria(params) {
  if (!_consultarMemoriaImpl) {
    return [];
  }
  return await _consultarMemoriaImpl(params);
}

/**
 * Listar candidatas pendientes de validación por empresa (estado =
 * 'candidata_pendiente_validacion'). Solo la usan flujos de aprobación
 * (encargado+, ADR-0013 §2/§3) — nunca el propio Motor de Decisión al
 * responder, que solo lee memoria ya `confirmada` vía `consultarMemoria`.
 *
 * Sin implementación inyectada, retorna un array vacío.
 * @param {{empresaId: string}} params
 * @returns {Promise<Recuerdo[]>}
 */
export async function listarCandidatasPendientes(params) {
  if (!_listarCandidatasPendientesImpl) {
    return [];
  }
  return await _listarCandidatasPendientesImpl(params);
}

/**
 * Confirmar una candidata pendiente: pasa su `estado` a 'confirmada' y
 * registra `aprobada_por` (ADR-0013 §2/§3). No crea una fila nueva — es una
 * transición de estado sobre la fila existente, distinta de la corrección
 * versionada de §6 (que sí crea una fila nueva con `version_anterior_id`).
 *
 * Sin implementación inyectada, no hace nada (no hay candidata que confirmar
 * sin persistencia real).
 * @param {{id: string, aprobadaPor: string}} params
 * @returns {Promise<void>}
 */
export async function confirmarCandidata(params) {
  if (!_confirmarCandidataImpl) {
    return;
  }
  return await _confirmarCandidataImpl(params);
}

/**
 * Rechazar una candidata pendiente: la elimina sin persistir su contenido
 * como memoria vigente (ADR-0013 §1 — solo lo aprobado permanece).
 *
 * Sin implementación inyectada, no hace nada.
 * @param {{id: string}} params
 * @returns {Promise<void>}
 */
export async function rechazarCandidata(params) {
  if (!_rechazarCandidataImpl) {
    return;
  }
  return await _rechazarCandidataImpl(params);
}
