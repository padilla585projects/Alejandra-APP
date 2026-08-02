/**
 * Memory — docs/decisions/ADR-0013-GOBIERNO-DE-MEMORIA.md
 *
 * Responsabilidad: dar a `nucleo-cognitivo/` una forma equivalente a la de
 * `policy-engine.js` para consumir memoria semántica de largo plazo (hechos,
 * preferencias, procedimientos, correcciones) una vez exista persistencia real.
 * No responsabilidad: acceder a D1 directamente, decidir políticas, ni ejecutar
 * negocio — igual que `context-engine.js` y `planner.js`.
 *
 * Interfaz únicamente. ADR-0013 §8 define este contrato exacto para cuando (y
 * solo cuando) su esquema pase por el migrador único de ADR-0011 y se autorice
 * la migración correspondiente contra D1 (`CLAUDE.md`, "Qué requiere decisión
 * humana"). Hasta entonces, cada función lanza un error explícito citando la
 * dependencia real que falta — mismo criterio que el resto del esqueleto:
 * "Por qué las interfaces lanzan un error en vez de devolver un stub silencioso"
 * (`nucleo-cognitivo/README.md`).
 *
 * @typedef {Object} Recuerdo
 * @property {string} contenido
 * @property {string} origen - `usuario_id` concreto, `system`, o una tool (ADR-0013 §3)
 * @property {'alta'|'media'|'baja'|number} confianza - ADR-0013 §4
 * @property {string} fecha_creacion
 * @property {string|null} caduca_en - ADR-0013 §5; nunca `NULL` indefinido por defecto
 * @property {'personal'|'compartida'} ambito - ADR-0013 §2
 * @property {'candidata_pendiente_validacion'|'confirmada'} estado - ADR-0013 §3;
 *   `consultarMemoria` solo devuelve recuerdos en `estado = 'confirmada'`
 */

const MENSAJE_SIN_PERSISTENCIA =
  'requiere persistencia real en D1 (migrador único de ADR-0011) y la autorización de ' +
  'migración que exige CLAUDE.md — no implementado. Ver docs/decisions/ADR-0013-GOBIERNO-DE-MEMORIA.md §8.';

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
 * @param {{empresaId: string, consulta: string, filtros?: object}} _params
 * @returns {never}
 */
export function consultarMemoria(_params) {
  throw new Error(`Memory: consultarMemoria() ${MENSAJE_SIN_PERSISTENCIA}`);
}

/**
 * @param {{empresaId: string}} _params
 * @returns {never}
 */
export function listarCandidatasPendientes(_params) {
  throw new Error(`Memory: listarCandidatasPendientes() ${MENSAJE_SIN_PERSISTENCIA}`);
}

/**
 * @param {{id: string, aprobadaPor: string}} _params
 * @returns {never}
 */
export function confirmarCandidata(_params) {
  throw new Error(`Memory: confirmarCandidata() ${MENSAJE_SIN_PERSISTENCIA}`);
}

/**
 * @param {{id: string}} _params
 * @returns {never}
 */
export function rechazarCandidata(_params) {
  throw new Error(`Memory: rechazarCandidata() ${MENSAJE_SIN_PERSISTENCIA}`);
}
