// ADR-0028 §Medición — extrae los esquemas REALES de las tools del agente
// (alejandra-agente/worker.js, constantes `const TOOL_X = { name, description, input_schema, ... }`)
// y los convierte al formato OpenAI function que entiende el pool. Lo usan:
//   - el test del banco (casos-alejandra.test.mjs), para comprobar que cada tool del banco
//     existe todavía en el agente y que sus campos `required` no han cambiado;
//   - quien regenere o amplíe scripts/ai-benchmark/casos-alejandra.json.
// Solo LEE el código fuente: no importa el worker ni ejecuta nada de él salvo el literal del
// objeto de cada tool (datos estáticos), evaluado sin acceso a nada externo.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUTA_AGENTE = new URL('../../alejandra-agente/worker.js', import.meta.url);

// Devuelve el texto del literal `{ ... }` que empieza en `inicio` (índice de la llave),
// respetando cadenas y comentarios.
function literalObjeto(src, inicio) {
  let prof = 0;
  let i = inicio;
  let comilla = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (comilla) {
      if (c === '\\') { i++; continue; }
      if (c === comilla) comilla = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '\'' || c === '"' || c === '`') { comilla = c; continue; }
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return src.slice(inicio, i + 1); }
  }
  return null;
}

// Claves de primer nivel de `const AYUDANTES = {...}` (delegar_tarea las usa en su enum).
// Se sustituye el objeto por uno con las mismas claves y valores vacíos.
function ayudantesStub(src) {
  const ini = src.indexOf('const AYUDANTES = {');
  if (ini < 0) return {};
  const lit = literalObjeto(src, src.indexOf('{', ini)) || '';
  const claves = [...lit.matchAll(/^  ([a-z_]+): \{/gm)].map(x => x[1]);
  return Object.fromEntries(claves.map(k => [k, {}]));
}

// { TOOL_X: { name, description, input_schema, ... } } con las tools que se pueden evaluar
// como literal (las que dependen de otras constantes que no sean AYUDANTES se omiten).
export function toolsDelAgente(src = readFileSync(RUTA_AGENTE, 'utf8')) {
  const res = {};
  const AYUDANTES = ayudantesStub(src);
  const re = /^const (TOOL_[A-Z0-9_]+) = \{/gm;
  let m;
  while ((m = re.exec(src))) {
    const lit = literalObjeto(src, m.index + m[0].length - 1);
    if (!lit) continue;
    try {
      // eslint-disable-next-line no-new-func
      const obj = new Function('AYUDANTES', `"use strict"; return (${lit});`)(AYUDANTES);
      if (obj && typeof obj.name === 'string' && obj.input_schema) res[m[1]] = obj;
    } catch (_) { /* depende de otra constante: se omite */ }
  }
  return res;
}

// Mapa nombre_de_tool → definición.
export function toolsPorNombre(src) {
  const porNombre = {};
  for (const t of Object.values(toolsDelAgente(src))) porNombre[t.name] = t;
  return porNombre;
}

// Formato OpenAI function (el mismo que _anthropicToolsToOpenAI del agente: name,
// description, parameters = input_schema). Sin los metadatos internos (acceso, cron, nexo...).
export function aOpenAI(tool) {
  return { type: 'function', function: { name: tool.name, description: tool.description || '', parameters: tool.input_schema } };
}

// Sustituye los esquemas de las tools de cada caso del banco por los ACTUALES del agente
// (mismos nombres). Una tool que ya no exista se deja tal cual (el test lo detectará).
export function refrescarToolsDelBanco(casos, src) {
  const actuales = toolsPorNombre(src);
  return casos.map(c => ({ ...c, tools: (c.tools || []).map(t => actuales[t.function.name] ? aOpenAI(actuales[t.function.name]) : t) }));
}

// Nombres de tools de cada experto en TOOLS_POR_EXPERTO (por nombre de tool, no de constante).
export function toolsPorExperto(src = readFileSync(RUTA_AGENTE, 'utf8')) {
  const porConst = toolsDelAgente(src);
  const ini = src.indexOf('const TOOLS_POR_EXPERTO = {');
  if (ini < 0) return {};
  const lit = literalObjeto(src, src.indexOf('{', ini));
  const res = {};
  for (const linea of lit.split('\n')) {
    const mm = linea.match(/^\s*([a-z]+):\s*\[([^\]]*)\]/);
    if (!mm) continue;
    res[mm[1]] = mm[2].split(',').map(s => s.trim()).filter(Boolean).map(c => porConst[c] ? porConst[c].name : null).filter(Boolean);
  }
  return res;
}

// CLI: `node scripts/ai-benchmark/herramientas-agente.mjs --refrescar` reescribe
// casos-alejandra.json con los esquemas actuales de las tools (tras cambiar una tool del agente).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--refrescar')) {
  const { writeFileSync } = await import('node:fs');
  const ruta = new URL('./casos-alejandra.json', import.meta.url);
  const casos = JSON.parse(readFileSync(ruta, 'utf8'));
  const crlf = readFileSync(ruta, 'utf8').includes('\r\n');
  const json = JSON.stringify(refrescarToolsDelBanco(casos), null, 2) + '\n';
  writeFileSync(ruta, crlf ? json.replace(/\n/g, '\r\n') : json, 'utf8');
  console.log(`casos-alejandra.json: esquemas de tools refrescados (${casos.length} casos)`);
}
