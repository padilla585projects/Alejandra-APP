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
//     tool_calls y sin fugas de sintaxis de tools. Vale para experto_simple y para experto_tools
//     (p. ej. responder con el dato que ya devolvió una herramienta, o preguntar ante una
//     petición ambigua).
//   - Sin herramientas: { sin_herramienta: true } (04/10/2026; el evaluador del pool ya lo
//     acepta), solo o con respuesta_contiene / respuesta_no_contiene: suspende si hay
//     tool_calls. Aquí, además, exige texto no vacío y sin fugas. Lo llevan los sin-tool-*.
// Banco v3 (03/10/2026): conversaciones de VARIOS TURNOS en formato OpenAI: mensajes
// { role: 'assistant', content: '', tool_calls: [{ id, type: 'function', function: { name,
// arguments } }] } seguidos de { role: 'tool', tool_call_id, content } con el resultado (o el
// error real) de la herramienta. El último mensaje puede ser del usuario o de una tool.
// Todo con datos FICTICIOS (empresa demo, nombres inventados): nunca datos personales reales.
//
// Banco AGRUPADO por experto (POOL-PREFIJO-01, ADR-0028 §Velocidad): agruparBancoPorExperto()
// mide el caso real de producción, en el que todas las peticiones de un experto llevan el
// MISMO system y la MISMA lista completa de tools (así llama.cpp reutiliza el prefijo y no
// relee 1.000–4.500 tokens en cada caso). Los datos de sesión del system (usuario, obra,
// empresa, fecha) pasan al principio del último mensaje del usuario, bajo la misma cabecera
// que producción. Cómo pasárselo al pool:
//   node scripts/ai-benchmark/banco-alejandra.mjs --agrupar [--tools agente] [--salida <ruta>]
//   BENCH_CASES=<ruta> python tools/bench_alejandra.py alejandra:1.0      (repo ai-pool)
// Por defecto escribe .ai-benchmark-results/casos-alejandra-agrupado.json (ignorado por git).
// --tools union (defecto): las tools de todos los casos del grupo, por nombre. --tools agente:
// el juego real del experto en TOOLS_POR_EXPERTO (simple → simple, experto_tools → app) más
// las que pidan los casos y no estén. En el arnés local: BENCHMARK_BANCO=agrupado (o
// agrupado-agente) con node scripts/ai-benchmark/pool.mjs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CABECERA_CONTEXTO_POOL } from '../../alejandra-agente/ai-pool.js';
import { toolsPorExperto, toolsPorNombre, aOpenAI } from './herramientas-agente.mjs';

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
  if ('respuesta_contiene' in e || e.sin_herramienta === true) {
    if (toolCalls.length) return { pass: false, motivo: 'tool_innecesaria' };
    const texto = salida.texto || '';
    if (!texto.trim()) return { pass: false, motivo: 'sin_texto' };
    if (!sinFuga(texto)) return { pass: false, motivo: 'fuga_sintaxis_tool' };
    if (!(e.respuesta_contiene || []).every(p => patronCoincide(p, texto))) return { pass: false, motivo: 'falta_contenido' };
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

// Turnos con herramientas (formato OpenAI): cada assistant con tool_calls bien formados, de
// tools que el caso ofrece y con argumentos JSON; cada mensaje tool responde a una llamada
// anterior aún sin respuesta (tool_call_id). Devuelve la lista de errores.
export function validarTurnosConTools(mensajes, nombresTools) {
  const errores = [];
  const pendientes = new Set();
  const vistos = new Set();
  for (const m of mensajes) {
    if (!m || typeof m !== 'object') continue;
    if (m.role === 'assistant' && 'tool_calls' in m) {
      if (!Array.isArray(m.tool_calls) || !m.tool_calls.length) { errores.push('tool_calls vacío o no es un array'); continue; }
      for (const tc of m.tool_calls) {
        const f = tc && tc.function;
        if (!tc || typeof tc.id !== 'string' || !tc.id || tc.type !== 'function' || !f || typeof f.name !== 'string' || typeof f.arguments !== 'string') { errores.push('tool_call mal formado'); continue; }
        if (vistos.has(tc.id)) errores.push('tool_call id repetido ' + tc.id);
        vistos.add(tc.id);
        if (!nombresTools.has(f.name)) errores.push(`tool_call a ${f.name}, que no está en tools`);
        try { JSON.parse(f.arguments); } catch (_) { errores.push(`argumentos de ${f.name} no son JSON`); }
        pendientes.add(tc.id);
      }
    } else if ('tool_calls' in m) {
      errores.push('tool_calls solo en mensajes assistant');
    }
    if (m.role === 'tool') {
      if (typeof m.tool_call_id !== 'string' || !pendientes.has(m.tool_call_id)) errores.push('mensaje tool sin una llamada previa que responder');
      else pendientes.delete(m.tool_call_id);
    } else if ('tool_call_id' in m) {
      errores.push('tool_call_id solo en mensajes tool');
    }
  }
  if (pendientes.size) errores.push('llamada a tool sin su mensaje tool de respuesta');
  return errores;
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
    if (!Array.isArray(c.tools)) { err('tools no es un array'); continue; }
    const nombresTools = new Set(c.tools.map(t => t && t.function && t.function.name));
    if (!Array.isArray(c.mensajes) || !c.mensajes.length) err('sin mensajes');
    else {
      if (c.mensajes.some(m => !m || !['system', 'user', 'assistant', 'tool'].includes(m.role) || typeof m.content !== 'string')) err('mensaje mal formado');
      if (!['user', 'tool'].includes(c.mensajes[c.mensajes.length - 1].role)) err('el último mensaje no es del usuario ni de una tool');
      for (const e of validarTurnosConTools(c.mensajes, nombresTools)) err(e);
    }
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
    } else if (c.tipo === 'experto_simple' || (c.tipo === 'experto_tools' && ('respuesta_contiene' in e || 'sin_herramienta' in e))) {
      const formas = ['respuesta_contiene', 'respuesta_contiene,respuesta_no_contiene', 'respuesta_contiene,sin_herramienta',
        'respuesta_contiene,respuesta_no_contiene,sin_herramienta', 'sin_herramienta', 'respuesta_no_contiene,sin_herramienta'];
      const contieneOk = !('respuesta_contiene' in e) || (listaDeTextos(e.respuesta_contiene) && e.respuesta_contiene.length > 0);
      if (!formas.includes(claves) || !contieneOk) {
        err(`${c.tipo} debe esperar {respuesta_contiene: [regex], respuesta_no_contiene?: [regex], sin_herramienta?: true}`);
        continue;
      }
      if ('sin_herramienta' in e && e.sin_herramienta !== true) err('sin_herramienta solo admite true');
      if ('respuesta_no_contiene' in e && (!listaDeTextos(e.respuesta_no_contiene) || !e.respuesta_no_contiene.length)) err('respuesta_no_contiene debe ser una lista de textos no vacía');
      const malos = patronesInvalidos([...(e.respuesta_contiene || []), ...(e.respuesta_no_contiene || [])]);
      if (malos.length) err('expresión regular inválida: ' + malos.join(', '));
      if (c.tipo === 'experto_tools' && !c.tools.length) err('experto_tools sin tools: usa experto_simple');
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

// ── Banco agrupado por experto (POOL-PREFIJO-01) ─────────────────────────────────────
// Líneas del system de los casos que son datos de sesión: en producción no van en el system
// (sería distinto en cada petición) sino al principio del mensaje del usuario del turno.
const RE_LINEA_SESION = /^(Sesión:|Fecha y hora actual:|En consultar_bd y escribir_bd filtra)/;
const RE_EMPRESA_ID = /\s*\(empresa_id (\d+)\)/;

// Separa un system del banco en { sistema (fijo), contexto (datos de sesión) }.
export function separarSistemaVariable(sistema) {
  const fijas = [];
  const variables = [];
  let empresa = '';
  for (const linea of String(sistema || '').split('\n')) {
    if (RE_LINEA_SESION.test(linea)) { variables.push(linea); continue; }
    const m = RE_EMPRESA_ID.exec(linea);
    if (m) { empresa = `Empresa activa: empresa_id ${m[1]}.`; fijas.push(linea.replace(RE_EMPRESA_ID, '')); continue; }
    fijas.push(linea);
  }
  if (empresa) variables.unshift(empresa);
  return { sistema: fijas.join('\n'), contexto: variables.join('\n') };
}

// Contexto al principio del ÚLTIMO mensaje del usuario (como insertarContextoEnTurno del pool).
function conContexto(mensajes, contexto) {
  if (!contexto) return mensajes;
  const i = mensajes.map(m => m.role).lastIndexOf('user');
  if (i < 0) return mensajes;
  const copia = mensajes.slice();
  copia[i] = { ...mensajes[i], content: `${CABECERA_CONTEXTO_POOL}\n${contexto}\n\n${mensajes[i].content}` };
  return copia;
}

const EXPERTO_DEL_GRUPO = { experto_simple: 'simple', experto_tools: 'app' };

// Lista fija de tools de cada grupo: 'union' = todas las de los casos del grupo, por nombre;
// 'agente' = TOOLS_POR_EXPERTO del agente (en su orden) + las de los casos que falten.
function toolsDelGrupo(casos, modo, src) {
  const porNombre = new Map();
  for (const c of casos) for (const t of c.tools || []) if (!porNombre.has(t.function.name)) porNombre.set(t.function.name, t);
  const union = [...porNombre.keys()].sort().map(n => porNombre.get(n));
  if (modo !== 'agente') return union;
  const experto = EXPERTO_DEL_GRUPO[casos[0] && casos[0].tipo];
  const nombres = (toolsPorExperto(src)[experto] || []);
  const actuales = toolsPorNombre(src);
  const lista = nombres.filter(n => actuales[n]).map(n => aOpenAI(actuales[n]));
  const vistos = new Set(lista.map(t => t.function.name));
  return [...lista, ...union.filter(t => !vistos.has(t.function.name))];
}

// Devuelve el banco agrupado: router, experto_simple y experto_tools seguidos (para que las
// peticiones de un mismo experto vayan juntas), con el MISMO system y la MISMA lista de tools
// dentro de cada grupo de expertos. Los casos de router no cambian (su system ya es fijo).
export function agruparBancoPorExperto(casos, { tools = 'union', src } = {}) {
  const salida = [];
  for (const tipo of TIPOS_BANCO) {
    const grupo = casos.filter(c => c.tipo === tipo);
    if (!grupo.length) continue;
    if (tipo === 'router') { salida.push(...grupo); continue; }
    const lista = toolsDelGrupo(grupo, tools, src);
    for (const c of grupo) {
      const sistemas = c.mensajes.filter(m => m.role === 'system').map(m => m.content).join('\n');
      const { sistema, contexto } = separarSistemaVariable(sistemas);
      const resto = conContexto(c.mensajes.filter(m => m.role !== 'system'), contexto);
      salida.push({ ...c, mensajes: [{ role: 'system', content: sistema }, ...resto], tools: lista });
    }
  }
  return salida;
}

// Banco según el modo del arnés: '' (tal cual), 'agrupado' o 'agrupado-agente'.
export function bancoSegunModo(modo = '', casos = cargarBancoAlejandra()) {
  if (modo === 'agrupado') return agruparBancoPorExperto(casos);
  if (modo === 'agrupado-agente') return agruparBancoPorExperto(casos, { tools: 'agente' });
  return casos;
}

// CLI: node scripts/ai-benchmark/banco-alejandra.mjs --agrupar [--tools agente] [--salida <ruta>]
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--agrupar')) {
  const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const modoTools = arg('--tools') === 'agente' ? 'agente' : 'union';
  const destino = resolve(arg('--salida') || fileURLToPath(new URL('../../.ai-benchmark-results/casos-alejandra-agrupado.json', import.meta.url)));
  const agrupado = agruparBancoPorExperto(cargarBancoAlejandra(), { tools: modoTools });
  const errores = validarBanco(agrupado);
  if (errores.length) { console.error('banco agrupado inválido:\n' + errores.join('\n')); process.exit(1); }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(agrupado, null, 2) + '\n', 'utf8');
  console.log(`banco agrupado (${agrupado.length} casos, tools ${modoTools}) → ${destino}`);
}
