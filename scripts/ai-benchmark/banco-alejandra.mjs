// ADR-0028 §Medición — banco de casos de Alejandra (scripts/ai-benchmark/casos-alejandra.json).
// Formato acordado con la sesión del pool (su evaluador es pool/tools/bench_alejandra.py en el
// repo ai-pool; este archivo puntúa EXACTAMENTE con las mismas reglas) para elegir con datos
// qué modelo hay detrás del alias `alejandra:1.0`:
//   [{ id, tipo: 'router'|'experto_simple'|'experto_tools',
//      mensajes: [{ role, content }...],              // conversación completa, system incluido
//      tools: [ esquemas OpenAI function REALES del agente, solo los relevantes ],
//      esperado: ... }]
// Formas de `esperado` y cómo se puntúan (todas las comparaciones ignoran mayúsculas y tildes,
// y solo se mira la PRIMERA llamada a herramienta):
//   - Router: { etiqueta: 'app' }. Se lee {"experto": "..."} del JSON o, si no, la primera palabra.
//   - Herramienta única: { herramienta: 'consultar_bd', argumentos: { query: ['partes_trabajo', 'empresa_id'] } }.
//     Argumento lista = deben aparecer todos los fragmentos; texto = subcadena; otro tipo
//     (número, booleano...) = igualdad. Claves no listadas: libres.
//   - Varios primeros pasos válidos: { herramienta: ['memory_read', 'memory_update'],
//     argumentos: { memory_update: { slug: 'horario-nave' } } }. Con los argumentos por
//     herramienta solo se comprueban los de la elegida; una herramienta sin entrada no exige nada.
//   - Texto: { respuesta_contiene: ['fuga|corriente residual|30 ?ma'], respuesta_no_contiene: ['rueda'] }.
//     Son EXPRESIONES REGULARES: todas las de contiene deben aparecer y ninguna de no_contiene.
//     Además (más exigente que el evaluador del pool) la respuesta tiene que ser texto, sin
//     tool_calls y sin fugas de sintaxis de tools.
// Todo con datos FICTICIOS (empresa demo, nombres inventados): nunca datos personales reales.
import { readFileSync } from 'node:fs';

export const RUTA_BANCO = new URL('./casos-alejandra.json', import.meta.url);
export const TIPOS_BANCO = ['router', 'experto_simple', 'experto_tools'];

export function cargarBancoAlejandra(ruta = RUTA_BANCO) {
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

// Minúsculas y sin tildes: «caída de TENSIÓN» → «caida de tension».
export function plegar(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Expresión regular de respuesta_contiene / respuesta_no_contiene sobre el texto plegado.
export function patronCoincide(patron, texto) {
  return new RegExp(plegar(patron)).test(plegar(texto));
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

// Etiqueta del router con la misma regla que el evaluador del pool: {"experto": "..."} del
// JSON o, si no hay, la primera palabra (solo letras).
export function etiquetaRouterBanco(texto) {
  const t = String(texto || '').trim();
  const m = /"experto"\s*:\s*"([^"]+)"/.exec(t);
  if (m) return m[1].trim().toLowerCase();
  if (!t) return '';
  return t.toLowerCase().split(/\s+/)[0].replace(/[^a-záéíóúñ]/g, '');
}

// ¿El valor real cumple lo esperado para una clave de argumentos?
export function argumentoCoincide(esperado, real) {
  if (real === undefined) return false;
  const texto = plegar(typeof real === 'string' ? real : JSON.stringify(real));
  if (Array.isArray(esperado)) return esperado.every(f => texto.includes(plegar(f)));
  if (typeof esperado === 'string') return texto.includes(plegar(esperado));
  if (esperado !== null && typeof esperado === 'object') return JSON.stringify(esperado) === JSON.stringify(real);
  return esperado === real;
}

// Herramientas válidas como primer paso y argumentos que se exigen a la elegida.
export function herramientasValidas(e) {
  return Array.isArray(e.herramienta) ? e.herramienta : [e.herramienta];
}

export function argumentosPorHerramienta(e) {
  const validas = herramientasValidas(e);
  const args = e.argumentos || {};
  return validas.some(h => Object.prototype.hasOwnProperty.call(args, h));
}

function argumentosExigidos(e, nombre) {
  const args = e.argumentos || {};
  return argumentosPorHerramienta(e) ? (args[nombre] || {}) : args;
}

// salida = { etiqueta?, texto?, toolCalls?: [{ name|function.name, arguments }] }
// Devuelve { pass, motivo } (motivo explica el fallo, nunca incluye contenido de la respuesta).
export function evaluarCasoBanco(caso, salida = {}) {
  const e = caso.esperado || {};
  const toolCalls = Array.isArray(salida.toolCalls) ? salida.toolCalls : [];
  if ('etiqueta' in e) {
    return plegar(salida.etiqueta) === plegar(e.etiqueta) ? { pass: true } : { pass: false, motivo: 'etiqueta_distinta' };
  }
  if ('respuesta_contiene' in e) {
    if (toolCalls.length) return { pass: false, motivo: 'tool_innecesaria' };
    const texto = salida.texto || '';
    if (!texto.trim()) return { pass: false, motivo: 'sin_texto' };
    if (!sinFuga(texto)) return { pass: false, motivo: 'fuga_sintaxis_tool' };
    if (!e.respuesta_contiene.every(p => patronCoincide(p, texto))) return { pass: false, motivo: 'falta_contenido' };
    if ((e.respuesta_no_contiene || []).some(p => patronCoincide(p, texto))) return { pass: false, motivo: 'contenido_prohibido' };
    return { pass: true };
  }
  if ('herramienta' in e) {
    if (!toolCalls.length) return { pass: false, motivo: 'sin_tool' };
    const nombre = nombreDe(toolCalls[0]);
    if (!herramientasValidas(e).includes(nombre)) return { pass: false, motivo: 'tool_distinta' };
    const args = argumentosDe(toolCalls[0]);
    if (!args) return { pass: false, motivo: 'argumentos_json_invalido' };
    for (const [k, v] of Object.entries(argumentosExigidos(e, nombre))) {
      if (!(k in args) || !argumentoCoincide(v, args[k])) return { pass: false, motivo: 'argumento_' + k };
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

const esObjeto = x => !!x && typeof x === 'object' && !Array.isArray(x);
const listaDeTextos = x => Array.isArray(x) && x.every(p => typeof p === 'string' && p);

function patronesInvalidos(lista) {
  return lista.filter(p => { try { new RegExp(plegar(p)); return false; } catch (_) { return true; } });
}

function validarArgumentos(err, f, nombre, argumentos) {
  const props = f.parameters.properties || {};
  for (const [k, v] of Object.entries(argumentos)) {
    if (!(k in props)) { err(`argumento ${k} no existe en el esquema de ${nombre}`); continue; }
    if (!tipoValido(v, props[k].type)) err(`argumento ${k} no encaja con el tipo ${props[k].type}`);
    if (Array.isArray(props[k].enum) && typeof v === 'string' && !props[k].enum.includes(v)) err(`argumento ${k} fuera del enum`);
  }
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
      if (!['respuesta_contiene', 'respuesta_contiene,respuesta_no_contiene'].includes(claves) || !listaDeTextos(e.respuesta_contiene) || !e.respuesta_contiene.length) {
        err('experto_simple debe esperar {respuesta_contiene: [regex], respuesta_no_contiene?: [regex]}');
        continue;
      }
      if ('respuesta_no_contiene' in e && (!listaDeTextos(e.respuesta_no_contiene) || !e.respuesta_no_contiene.length)) err('respuesta_no_contiene debe ser una lista de textos no vacía');
      const malos = patronesInvalidos([...e.respuesta_contiene, ...(e.respuesta_no_contiene || [])]);
      if (malos.length) err('expresión regular inválida: ' + malos.join(', '));
    } else if (c.tipo === 'experto_tools') {
      const h = e.herramienta;
      const formaH = typeof h === 'string' ? !!h : listaDeTextos(h) && h.length >= 2 && new Set(h).size === h.length;
      if (claves !== 'argumentos,herramienta' || !formaH || !esObjeto(e.argumentos)) { err('experto_tools debe esperar {herramienta: texto | [textos], argumentos}'); continue; }
      const validas = herramientasValidas(e);
      const faltan = validas.filter(n => !porNombre[n]);
      if (faltan.length) { err('la tool esperada no está en tools: ' + faltan.join(', ')); continue; }
      if (Array.isArray(h)) {
        // Varios primeros pasos: los argumentos van siempre por herramienta.
        for (const [nombre, args] of Object.entries(e.argumentos)) {
          if (!validas.includes(nombre)) { err(`con varias herramientas, argumentos se indexa por herramienta: ${nombre} no está en herramienta`); continue; }
          if (!esObjeto(args)) { err(`argumentos de ${nombre} debe ser un objeto`); continue; }
          validarArgumentos(err, porNombre[nombre], nombre, args);
        }
      } else {
        validarArgumentos(err, porNombre[h], h, e.argumentos);
      }
    }
  }
  return errores;
}
