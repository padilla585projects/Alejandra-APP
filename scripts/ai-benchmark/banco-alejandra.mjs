// ADR-0028 §Medición — banco de casos de Alejandra (scripts/ai-benchmark/casos-alejandra.json).
// Formato acordado con la sesión del pool para elegir con datos qué modelo hay detrás del
// alias `alejandra:1.0`:
//   [{ id, tipo: 'router'|'experto_simple'|'experto_tools',
//      mensajes: [{ role, content }...],              // conversación completa, system incluido
//      tools: [ esquemas OpenAI function REALES del agente, solo los relevantes ],
//      esperado: { etiqueta } | { respuesta_contiene: [...] } | { herramienta, argumentos } }]
// Reglas de evaluación (las mismas para el pool y para cualquier proveedor):
//   - etiqueta: la salida del router normalizada es exactamente esa etiqueta.
//   - respuesta_contiene: respuesta en TEXTO (sin tool_calls), sin fugas de sintaxis de tools,
//     y cada elemento aparece en ella. Un elemento puede llevar alternativas separadas por «|».
//     Comparación sin mayúsculas ni tildes.
//   - herramienta + argumentos: la PRIMERA tool llamada es esa, y cada clave de `argumentos`
//     está en sus argumentos: números/booleanos iguales; textos «contiene» (alternativas con
//     «|», sin mayúsculas ni tildes); una lista de textos = todos deben aparecer (p. ej. la SQL
//     de consultar_bd debe nombrar la tabla y filtrar por empresa_id). Claves no listadas: libres.
// Todo con datos FICTICIOS (empresa demo, nombres inventados): nunca datos personales reales.
import { readFileSync } from 'node:fs';

export const RUTA_BANCO = new URL('./casos-alejandra.json', import.meta.url);
export const TIPOS_BANCO = ['router', 'experto_simple', 'experto_tools'];

export function cargarBancoAlejandra(ruta = RUTA_BANCO) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

export function plegar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function contieneFragmento(texto, fragmento) {
  const t = plegar(texto);
  return String(fragmento).split('|').map(plegar).some(alt => alt && t.includes(alt));
}

const sinFuga = t => !/<\|[^|]*\|>|<tool_call>|"name"\s*:\s*"[a-z_]+"\s*,\s*"arguments"/.test(t || '');

function argumentosDe(tc) {
  const a = tc && (tc.arguments ?? (tc.function && tc.function.arguments) ?? tc.input);
  if (a && typeof a === 'object') return a;
  try { return JSON.parse(a || '{}') || {}; } catch (_) { return null; }
}

function nombreDe(tc) {
  return tc && (tc.name || (tc.function && tc.function.name)) || '';
}

// ¿El valor real cumple lo esperado para una clave de argumentos?
export function argumentoCoincide(esperado, real) {
  if (real === undefined || real === null) return false;
  if (typeof esperado === 'number') return Number(real) === esperado;
  if (typeof esperado === 'boolean') return real === esperado || String(real) === String(esperado);
  if (Array.isArray(esperado)) return esperado.every(f => contieneFragmento(typeof real === 'string' ? real : JSON.stringify(real), f));
  if (typeof esperado === 'string') return contieneFragmento(typeof real === 'string' ? real : JSON.stringify(real), esperado);
  return JSON.stringify(esperado) === JSON.stringify(real);
}

// salida = { etiqueta?, texto?, toolCalls?: [{ name|function.name, arguments }] }
// Devuelve { pass, motivo } (motivo explica el fallo, nunca incluye contenido de la respuesta).
export function evaluarCasoBanco(caso, salida = {}) {
  const e = caso.esperado || {};
  const toolCalls = Array.isArray(salida.toolCalls) ? salida.toolCalls : [];
  if ('etiqueta' in e) {
    return salida.etiqueta === e.etiqueta ? { pass: true } : { pass: false, motivo: 'etiqueta_distinta' };
  }
  if ('respuesta_contiene' in e) {
    if (toolCalls.length) return { pass: false, motivo: 'tool_innecesaria' };
    const texto = salida.texto || '';
    if (!texto.trim()) return { pass: false, motivo: 'sin_texto' };
    if (!sinFuga(texto)) return { pass: false, motivo: 'fuga_sintaxis_tool' };
    return e.respuesta_contiene.every(f => contieneFragmento(texto, f)) ? { pass: true } : { pass: false, motivo: 'falta_contenido' };
  }
  if ('herramienta' in e) {
    if (!toolCalls.length) return { pass: false, motivo: 'sin_tool' };
    if (nombreDe(toolCalls[0]) !== e.herramienta) return { pass: false, motivo: 'tool_distinta' };
    const args = argumentosDe(toolCalls[0]);
    if (!args) return { pass: false, motivo: 'argumentos_json_invalido' };
    for (const [k, v] of Object.entries(e.argumentos || {})) {
      if (!argumentoCoincide(v, args[k])) return { pass: false, motivo: 'argumento_' + k };
    }
    return { pass: true };
  }
  return { pass: false, motivo: 'esperado_desconocido' };
}

// Tipo JSON Schema de un valor (para validar `argumentos` contra el esquema de la tool).
function tipoValido(valor, tipoEsquema) {
  if (Array.isArray(valor)) return tipoEsquema === 'string' ? valor.every(x => typeof x === 'string') : tipoEsquema === 'array';
  if (tipoEsquema === 'integer') return Number.isInteger(valor);
  if (tipoEsquema === 'number') return typeof valor === 'number';
  if (tipoEsquema === 'string') return typeof valor === 'string';
  if (tipoEsquema === 'boolean') return typeof valor === 'boolean';
  if (tipoEsquema === 'object') return valor && typeof valor === 'object';
  return true; // sin tipo declarado
}

// Valida el banco entero. Devuelve la lista de errores (vacía = válido).
export function validarBanco(casos, { etiquetas = null } = {}) {
  const errores = [];
  if (!Array.isArray(casos)) return ['el banco no es un array'];
  const ids = new Set();
  for (const c of casos) {
    const id = c && c.id;
    const err = m => errores.push(`${id || '(sin id)'}: ${m}`);
    if (typeof id !== 'string' || !id) { err('id vacío'); continue; }
    if (ids.has(id)) err('id duplicado');
    ids.add(id);
    if (!TIPOS_BANCO.includes(c.tipo)) err('tipo inválido');
    if (!Array.isArray(c.mensajes) || !c.mensajes.length) err('sin mensajes');
    else {
      if (c.mensajes.some(m => !m || !['system', 'user', 'assistant', 'tool'].includes(m.role) || typeof m.content !== 'string')) err('mensaje mal formado');
      if (c.mensajes[c.mensajes.length - 1].role !== 'user') err('el último mensaje no es del usuario');
    }
    if (!Array.isArray(c.tools)) { err('tools no es un array'); continue; }
    const porNombre = {};
    for (const t of c.tools) {
      const f = t && t.function;
      if (!t || t.type !== 'function' || !f || typeof f.name !== 'string' || !f.parameters || f.parameters.type !== 'object') { err('tool mal formada'); continue; }
      if (porNombre[f.name]) err('tool repetida ' + f.name);
      porNombre[f.name] = f;
    }
    const e = c.esperado || {};
    const claves = Object.keys(e).sort().join(',');
    if (c.tipo === 'router') {
      if (claves !== 'etiqueta') err('router debe esperar {etiqueta}');
      else if (etiquetas && !etiquetas.includes(e.etiqueta)) err('etiqueta desconocida ' + e.etiqueta);
      if (c.tools.length) err('router sin tools');
    } else if (c.tipo === 'experto_simple') {
      if (claves !== 'respuesta_contiene' || !Array.isArray(e.respuesta_contiene) || !e.respuesta_contiene.length || e.respuesta_contiene.some(x => typeof x !== 'string' || !x)) err('experto_simple debe esperar {respuesta_contiene: [textos]}');
    } else if (c.tipo === 'experto_tools') {
      if (claves !== 'argumentos,herramienta' || typeof e.herramienta !== 'string' || !e.argumentos || typeof e.argumentos !== 'object' || Array.isArray(e.argumentos)) { err('experto_tools debe esperar {herramienta, argumentos}'); continue; }
      const f = porNombre[e.herramienta];
      if (!f) { err('la tool esperada no está en tools: ' + e.herramienta); continue; }
      const props = f.parameters.properties || {};
      for (const [k, v] of Object.entries(e.argumentos)) {
        if (!(k in props)) { err(`argumento ${k} no existe en el esquema de ${e.herramienta}`); continue; }
        if (!tipoValido(v, props[k].type)) err(`argumento ${k} no encaja con el tipo ${props[k].type}`);
        if (Array.isArray(props[k].enum) && typeof v === 'string' && !props[k].enum.includes(v)) err(`argumento ${k} fuera del enum`);
      }
    }
  }
  return errores;
}
