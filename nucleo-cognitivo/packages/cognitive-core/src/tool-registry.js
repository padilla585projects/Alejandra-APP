/**
 * Tool Registry — ADR-0010, docs/architecture/04-MOTOR-DE-DECISION.md
 *
 * Responsabilidad: validar que toda tool declarada trae el metadato que exige
 * ADR-0010 (`acceso`, `cron`, `nivel_riesgo`) y filtrar un catálogo ya
 * declarado según ese metadato. No responsabilidad: descubrir tools, leer el
 * catálogo real de ningún Worker, ni ejecutar ninguna tool.
 *
 * ADR-0010 es explícito: "toda tool declarada" debe traer `acceso` y
 * `nivel_riesgo" o "no se registra" — el equivalente, para tools, del
 * `--check` que ya aplica `scripts/inventario-rutas.js` a las rutas HTTP. Este
 * módulo no migra las 69+34 tools de `worker.js`/`alejandra-agente/worker.js`:
 * fija el contrato que esa migración incremental deberá cumplir, tool por
 * tool, sin retirar los `Set` de `lib.js` hasta que la última tool migre
 * (decisión del Director en ADR-0010).
 */

export const NIVELES_ACCESO = Object.freeze(['publico', 'sesion', 'dev_verificado']);
export const NIVELES_CRON = Object.freeze(['permitido', 'prohibido']);
export const NIVELES_RIESGO_VALIDOS = Object.freeze(['N0', 'N1', 'N2', 'N3']);

/**
 * @typedef {object} DeclaracionTool
 * @property {string} name
 * @property {string} description
 * @property {object} input_schema
 * @property {'publico'|'sesion'|'dev_verificado'} acceso
 * @property {'permitido'|'prohibido'} cron
 * @property {'N0'|'N1'|'N2'|'N3'} nivel_riesgo
 */

/**
 * Valida la forma de una declaración de tool contra ADR-0010. No valida que
 * la tool exista de verdad en ningún Worker, ni ejecuta nada — es una
 * comprobación estructural pura, igual que `evaluarAccion()` en
 * `policy-engine.js` sobre el nivel de riesgo.
 * @param {DeclaracionTool} tool
 * @returns {true}
 * @throws {Error} si falta un campo obligatorio o su valor no es válido.
 */
export function validarDeclaracionTool(tool) {
  if (!tool || typeof tool !== 'object') {
    throw new Error('validarDeclaracionTool requiere un objeto de declaración de tool');
  }
  if (typeof tool.name !== 'string' || tool.name.length === 0) {
    throw new Error('Tool sin "name": ADR-0010 exige un nombre para poder registrarla');
  }
  if (typeof tool.description !== 'string' || tool.description.length === 0) {
    throw new Error(`Tool "${tool.name}" sin "description"`);
  }
  if (!NIVELES_ACCESO.includes(tool.acceso)) {
    throw new Error(
      `Tool "${tool.name}": "acceso" inválido o ausente ("${tool.acceso}"). ADR-0010 exige ` +
      `uno de: ${NIVELES_ACCESO.join(', ')}.`
    );
  }
  if (!NIVELES_CRON.includes(tool.cron)) {
    throw new Error(
      `Tool "${tool.name}": "cron" inválido o ausente ("${tool.cron}"). ADR-0010 exige uno ` +
      `de: ${NIVELES_CRON.join(', ')}.`
    );
  }
  if (!NIVELES_RIESGO_VALIDOS.includes(tool.nivel_riesgo)) {
    throw new Error(
      `Tool "${tool.name}": "nivel_riesgo" inválido o ausente ("${tool.nivel_riesgo}"). ` +
      `ADR-0006 exige uno de: ${NIVELES_RIESGO_VALIDOS.join(', ')}, declarado, nunca inferido.`
    );
  }
  return true;
}

/**
 * Registra una tool ya validada en un catálogo inmutable. Rechaza nombres
 * duplicados: dos declaraciones con el mismo `name` son exactamente el fallo
 * que ADR-0010 quiere hacer estructuralmente imposible (una tool "olvidada"
 * en una migración incremental y vuelta a declarar con otro nivel).
 * @param {ReadonlyArray<DeclaracionTool>} catalogo
 * @param {DeclaracionTool} tool
 * @returns {DeclaracionTool[]} nuevo catálogo, sin mutar el original
 */
export function registrarTool(catalogo, tool) {
  if (!Array.isArray(catalogo)) {
    throw new Error('registrarTool requiere un catálogo (array) existente, aunque esté vacío');
  }
  validarDeclaracionTool(tool);
  if (catalogo.some((existente) => existente.name === tool.name)) {
    throw new Error(`Tool "${tool.name}" ya está registrada: los nombres deben ser únicos`);
  }
  return [...catalogo, tool];
}

/**
 * Equivalente puro de `filtrarToolsPorAuth()` (ADR-0010): decide, para un
 * catálogo ya declarado, qué tools son alcanzables según el contexto de
 * sesión. No consulta sesión real — recibe ya evaluado si hay sesión válida y
 * si la identidad es de desarrollador verificado, igual que `policy-engine.js`
 * nunca lee permisos reales.
 * @param {ReadonlyArray<DeclaracionTool>} catalogo
 * @param {{sesionValida?: boolean, devVerificado?: boolean}} contexto
 * @returns {DeclaracionTool[]}
 */
export function filtrarToolsPorAcceso(catalogo, contexto = {}) {
  if (!Array.isArray(catalogo)) {
    throw new Error('filtrarToolsPorAcceso requiere un catálogo (array)');
  }
  const sesionValida = contexto.sesionValida === true;
  const devVerificado = contexto.devVerificado === true;
  return catalogo.filter((tool) => {
    if (tool.acceso === 'publico') return true;
    if (tool.acceso === 'sesion') return sesionValida;
    if (tool.acceso === 'dev_verificado') return devVerificado;
    return false;
  });
}

/**
 * Equivalente puro de `filtrarToolsCron()` (ADR-0010): el cron solo alcanza
 * tools con `cron: 'permitido'`. No conoce `TOOLS_PROHIBIDAS_CRON` — ese
 * `Set` sigue siendo la fuente de verdad en producción hasta que la
 * migración incremental de ADR-0010 esté completa.
 * @param {ReadonlyArray<DeclaracionTool>} catalogo
 * @returns {DeclaracionTool[]}
 */
export function filtrarToolsParaCron(catalogo) {
  if (!Array.isArray(catalogo)) {
    throw new Error('filtrarToolsParaCron requiere un catálogo (array)');
  }
  return catalogo.filter((tool) => tool.cron === 'permitido');
}
