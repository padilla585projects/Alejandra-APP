// POOL-PREFIJO-01 (04/10/2026, ADR-0028 §Velocidad): todo lo que va al pool lleva un system
// IDÉNTICO byte a byte entre peticiones del mismo uso/experto y las mismas tools, para que
// llama.cpp reutilice el prefijo ya leído. Dos peticiones con usuarios, fechas y mensajes
// distintos deben producir el mismo system y las mismas tools (comparación de strings exacta).
// Todo con fetch simulado: ninguna llamada real al pool.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  poolChat, poolTexto, poolClasificar, poolRouterNexus, prepararConsultaBusqueda, poolCalentar,
  componerSistemaNexus, peticionPoolEstable, insertarContextoEnTurno, prefijoPoolDe, marcarPrefijoPool,
  CABECERA_CONTEXTO_POOL, AI_POOL_CALENTAMIENTO, circuitoPoolAbierto, metricasPool,
  _reiniciarCircuitoPool, _reiniciarMetricasPool, _reiniciarCalentamientoPool
} from './ai-pool.js';
import { SYSTEM_CLASIFICADOR_INTENCION, ETIQUETAS_CLASIFICADOR_INTENCION, CONTEXTO_DOMINIO_INSTALADORA } from './lib.js';

const ENV = { AI_POOL_KEY: 'clave-de-prueba' };
const agente = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const web = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

function chatOk(content, extra = {}) {
  const texto = JSON.stringify({ model: 'alejandra:1.0', choices: [{ message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }], usage: { prompt_tokens: 9, completion_tokens: 1 } });
  return { ok: true, status: 200, text: async () => texto };
}
function fallo(status) {
  return { ok: false, status, text: async () => JSON.stringify({ detail: 'x' }) };
}
function fetchQueDevuelve(r) {
  const llamadas = [];
  const f = vi.fn(async (url, init) => { llamadas.push(JSON.parse(init.body)); return typeof r === 'function' ? r() : r; });
  f.llamadas = llamadas;
  return f;
}

// Conversor mínimo Anthropic → OpenAI (mismo criterio que _agenteMsgsToOpenAI del agente para
// texto y resultados de tools) y tools Anthropic → OpenAI (mismo que _anthropicToolsToOpenAI).
function aOpenAI(messages, sistema) {
  const out = [{ role: 'system', content: sistema }];
  for (const m of messages) {
    const texto = typeof m.content === 'string' ? m.content
      : m.content.map(b => b.type === 'text' ? b.text : b.type === 'tool_result' ? String(b.content) : `[Intenté usar la herramienta "${b.name}"]`).join('\n');
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: texto });
  }
  return out;
}
const toolsAOpenAI = tools => tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description || '', parameters: t.input_schema } }));

// Módulos y tools de prueba con la forma real (texto por módulo, objetos de tool constantes).
const MODULOS = { base: 'BASE', dominio: CONTEXTO_DOMINIO_INSTALADORA, contexto_sesion: 'SESION', formato: 'FORMATO', prl_seguridad: 'MODULO PRL', seguridad_no_auth: 'NO AUTH', ie_motores: 'MODULO MOTORES' };
const L0 = ['base', 'dominio', 'formato'];
const SIMPLE = ['base', 'dominio', 'contexto_sesion', 'formato'];
const TOOLS = [
  { name: 'memory_read', description: 'Lee tu memoria. Detalle.', input_schema: { type: 'object', properties: { busqueda: { type: 'string' } } }, acceso: 'sesion' },
  { name: 'consultar_bd', description: 'Consulta la BD. Solo lectura.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, acceso: 'sesion' }
];
const FECHA_A = new Date('2026-10-04T07:15:00Z');
const FECHA_B = new Date('2026-12-31T22:59:00Z');

function sistemaDe({ modulos = SIMPLE, variables = [], ahora = FECHA_A, tools = TOOLS } = {}) {
  return componerSistemaNexus({ modulos: [...modulos, ...variables], modulosVariables: variables, modulosL0: L0, textoModulo: m => MODULOS[m] || '', tools, ahora });
}
// Mensajes como los de construirMessages: historial + turno actual con [Sesión: ...].
function mensajesDe(usuario, empresa, texto) {
  return [
    { role: 'user', content: 'mensaje anterior' },
    { role: 'assistant', content: 'respuesta anterior' },
    { role: 'user', content: `[Sesión: usuario="${usuario}", canal="PWA", rol="encargado", empresa_id="${empresa}"]\n\nUsuario: ${texto}` }
  ];
}

beforeEach(() => {
  _reiniciarCircuitoPool();
  _reiniciarMetricasPool();
  _reiniciarCalentamientoPool();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('componerSistemaNexus: Anthropic igual que antes, pool con system fijo', () => {
  it('los bloques de Anthropic conservan su forma: L0+L1 cacheado, fecha + catálogo sin caché', () => {
    const b = sistemaDe({ variables: ['prl_seguridad'] });
    expect(b).toHaveLength(2);
    expect(b[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(b[0].text).toBe(['BASE', CONTEXTO_DOMINIO_INSTALADORA, 'FORMATO', 'SESION', 'MODULO PRL'].join('\n\n'));
    expect(b[1].cache_control).toBeUndefined();
    expect(b[1].text.startsWith('FECHA Y HORA ACTUAL (real, del servidor): ')).toBe(true);
    expect(b[1].text).toContain('HERRAMIENTAS DISPONIBLES (2):\n- memory_read: Lee tu memoria\n- consultar_bd: Consulta la BD');
    // La versión del pool viaja fuera del JSON: Anthropic nunca la recibe.
    expect(JSON.stringify(b)).not.toMatch(/sistema|contexto/);
    expect(Object.keys(b)).toEqual(['0', '1']);
  });

  it('dos peticiones del experto con fechas y módulos dinámicos distintos → mismo system del pool', () => {
    const a = prefijoPoolDe(sistemaDe({ ahora: FECHA_A, variables: ['prl_seguridad'] }));
    const b = prefijoPoolDe(sistemaDe({ ahora: FECHA_B, variables: [] }));
    const c = prefijoPoolDe(sistemaDe({ ahora: FECHA_B, variables: ['ie_motores', 'prl_seguridad'] }));
    expect(a.sistema).toBe(b.sistema);
    expect(b.sistema).toBe(c.sistema);
    expect(a.sistema).toContain(CONTEXTO_DOMINIO_INSTALADORA); // glosario incluido, siempre igual
    expect(a.sistema).not.toMatch(/FECHA Y HORA|2026|MODULO PRL|MODULO MOTORES/);
    // Lo variable no se pierde: va al contexto del turno.
    expect(a.contexto).toMatch(/^FECHA Y HORA ACTUAL/);
    expect(a.contexto).toContain('MODULO PRL');
    expect(c.contexto).toContain('MODULO MOTORES');
    expect(a.contexto).not.toBe(b.contexto);
  });

  it('la clase de sesión (seguridad_no_auth) es fija por clase: igual entre dos anónimos', () => {
    const anon1 = prefijoPoolDe(sistemaDe({ modulos: [...SIMPLE, 'seguridad_no_auth'], ahora: FECHA_A }));
    const anon2 = prefijoPoolDe(sistemaDe({ modulos: [...SIMPLE, 'seguridad_no_auth'], ahora: FECHA_B, variables: ['prl_seguridad'] }));
    expect(anon1.sistema).toBe(anon2.sistema);
  });
});

describe('experto simple y respaldo de Anthropic: mismo system y mismas tools', () => {
  it('peticionPoolEstable: usuarios/fechas distintos → system y tools idénticos; contexto en el turno actual', () => {
    const p1 = peticionPoolEstable(sistemaDe({ ahora: FECHA_A }), mensajesDe('Ana', '1', 'hola'), TOOLS);
    const p2 = peticionPoolEstable(sistemaDe({ ahora: FECHA_B, variables: ['prl_seguridad'] }), mensajesDe('Luis', '7', '¿qué arnés uso?'), TOOLS);
    expect(p1.sistema).toBe(p2.sistema);
    expect(JSON.stringify(toolsAOpenAI(p1.tools))).toBe(JSON.stringify(toolsAOpenAI(p2.tools)));
    expect(p1.messages.slice(0, 2)).toEqual(p2.messages.slice(0, 2)); // historial intacto
    const ultimo = p2.messages.at(-1).content;
    expect(ultimo.startsWith(CABECERA_CONTEXTO_POOL + '\nFECHA Y HORA ACTUAL')).toBe(true);
    expect(ultimo).toContain('MODULO PRL');
    expect(ultimo).toContain('usuario="Luis"');
    expect(ultimo.endsWith('Usuario: ¿qué arnés uso?')).toBe(true);
  });

  it('poolChat de punta a punta (experto_simple y respaldo_anthropic): system y tools del cuerpo idénticos', async () => {
    for (const uso of ['experto_simple', 'respaldo_anthropic']) {
      const f = fetchQueDevuelve(chatOk('vale'));
      for (const [sys, msgs] of [[sistemaDe({ ahora: FECHA_A }), mensajesDe('Ana', '1', 'hola')], [sistemaDe({ ahora: FECHA_B, variables: ['ie_motores'] }), mensajesDe('Luis', '7', 'calcula el motor')]]) {
        const pet = peticionPoolEstable(sys, msgs, TOOLS);
        const r = await poolChat(ENV, { messages: aOpenAI(pet.messages, pet.sistema), tools: toolsAOpenAI(pet.tools), maxTokens: 600, uso }, { fetch: f });
        expect(r.ok).toBe(true);
      }
      const [a, b] = f.llamadas;
      expect(a.messages[0].role).toBe('system');
      expect(a.messages[0].content).toBe(b.messages[0].content);
      expect(JSON.stringify(a.tools)).toBe(JSON.stringify(b.tools));
      expect(a.messages[0].content.endsWith('\n/no_think')).toBe(true);
      expect(a.messages.at(-1).content).not.toBe(b.messages.at(-1).content);
    }
  });

  it('bucle de tools: el contexto no se mueve (va al turno humano, no al resultado de la tool) y no muta messages', () => {
    const base = mensajesDe('Ana', '1', 'busca la bobina');
    const conTool = [...base,
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'consultar_bd', input: { query: 'SELECT 1' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '1 registro' }] }];
    const copia = JSON.parse(JSON.stringify(conTool));
    const out = insertarContextoEnTurno(conTool, 'CTX');
    expect(conTool).toEqual(copia);
    expect(out[2].content.startsWith(CABECERA_CONTEXTO_POOL + '\nCTX\n\n')).toBe(true);
    expect(out[4]).toBe(conTool[4]);
    // contenido en bloques (adjuntos): bloque de texto delante
    const bloques = insertarContextoEnTurno([{ role: 'user', content: [{ type: 'text', text: 'hola' }] }], 'CTX');
    expect(bloques[0].content[0]).toEqual({ type: 'text', text: CABECERA_CONTEXTO_POOL + '\nCTX' });
  });

  it('vuelta sin tools (última iteración / cierre): se manda el juego completo y se marca toolsForzadas', () => {
    const p = peticionPoolEstable(sistemaDe(), mensajesDe('Ana', '1', 'x'), []);
    expect(p.tools.map(t => t.name)).toEqual(['memory_read', 'consultar_bd']);
    expect(p.toolsForzadas).toBe(true);
    const normal = peticionPoolEstable(sistemaDe(), mensajesDe('Ana', '1', 'x'), [TOOLS[1]]);
    expect(normal.tools.map(t => t.name)).toEqual(['memory_read', 'consultar_bd']); // completo y en orden fijo
    expect(normal.toolsForzadas).toBe(false);
    // nunca se añaden tools que el turno no tenía permitidas
    const ajena = { name: 'escribir_bd', description: 'x', input_schema: { type: 'object', properties: {} } };
    expect(peticionPoolEstable(sistemaDe(), mensajesDe('Ana', '1', 'x'), [ajena]).tools).toEqual([ajena]);
  });

  it('system sin marca (crons, ayudantes, reflexión) pasa tal cual', () => {
    const p = peticionPoolEstable('SYSTEM CONSTANTE', [{ role: 'user', content: 'u' }], TOOLS);
    expect(p).toEqual({ sistema: 'SYSTEM CONSTANTE', messages: [{ role: 'user', content: 'u' }], tools: TOOLS, toolsForzadas: false });
    expect(prefijoPoolDe(marcarPrefijoPool([], { sistema: 's' })).sistema).toBe('s');
  });
});

describe('router, router NEXUS, crons, resumen y reescritura: system fijo', () => {
  it('router del agente: mensajes distintos → mismo system', async () => {
    const f = fetchQueDevuelve(chatOk('{"experto":"app"}'));
    await poolClasificar(ENV, SYSTEM_CLASIFICADOR_INTENCION, 'Dani faltó hoy', ETIQUETAS_CLASIFICADOR_INTENCION, {}, { fetch: f });
    await poolClasificar(ENV, SYSTEM_CLASIFICADOR_INTENCION, 'ya llegó el pedido', ETIQUETAS_CLASIFICADOR_INTENCION, {}, { fetch: f });
    expect(f.llamadas[0].messages[0].content).toBe(f.llamadas[1].messages[0].content);
    expect(f.llamadas[0].messages[1].content).not.toBe(f.llamadas[1].messages[1].content);
  });

  it('router NEXUS: instrucciones en el system (fijo) y solo el mensaje en el user', async () => {
    const f = fetchQueDevuelve(chatOk('{"expert":"analista","compress_history":false}'));
    const sistema = 'INSTRUCCIONES JSON\nJSON requerido: {"expert":"<nombre>"}';
    await poolRouterNexus(ENV, { sistema, mensaje: 'Mensaje: "cuántos fichajes"' }, ['asistente', 'analista'], {}, { fetch: f });
    await poolRouterNexus(ENV, { sistema, mensaje: 'Mensaje: "despliega el worker"' }, ['asistente', 'analista'], {}, { fetch: f });
    expect(f.llamadas[0].messages[0].content).toBe(f.llamadas[1].messages[0].content);
    expect(f.llamadas[0].messages[0].content.startsWith(sistema)).toBe(true);
    expect(f.llamadas[0].messages[1].content).toBe('Mensaje: "cuántos fichajes"');
    // worker.js: el pool recibe {sistema, mensaje}; Haiku, el mismo prompt de siempre
    expect(web).toMatch(/poolRouterNexus\(env, \{ sistema: `\$\{NEXUS_ROUTER_INSTRUCCIONES\}\\n\$\{NEXUS_ROUTER_FORMATO\}`, mensaje: lineaMensaje \}/);
    expect(web).toMatch(/const routerPrompt = `\$\{NEXUS_ROUTER_INSTRUCCIONES\}\\n\$\{lineaMensaje\}\\n\$\{NEXUS_ROUTER_FORMATO\}`;/);
    const instr = web.match(/const NEXUS_ROUTER_INSTRUCCIONES = `([^`]*)`/)[1];
    expect(instr).not.toContain('${');
  });

  it('crons y resumen (poolTexto): datos distintos → mismo system; los system del agente son constantes', async () => {
    const f = fetchQueDevuelve(chatOk('SIN_ACCION'));
    await poolTexto(ENV, 'SYSTEM CRON', 'bobinas bajas: 3', { uso: 'cron_normal' }, { fetch: f });
    await poolTexto(ENV, 'SYSTEM CRON', 'incidencias: 9', { uso: 'cron_normal' }, { fetch: f });
    expect(f.llamadas[0].messages[0].content).toBe(f.llamadas[1].messages[0].content);
    // Ningún system que el agente manda al pool por poolTexto lleva interpolaciones.
    const systemCron = agente.match(/const systemCron = `([^`]*)`/)[1];
    const sistemaResumen = agente.match(/const sistema = `(Eres un asistente que resume[^`]*)`/)[1];
    expect(systemCron).not.toContain('${');
    expect(sistemaResumen).not.toContain('${');
    for (const literal of ['Comprime estos errores/soluciones', 'Resume esta conversación en máx 200 palabras']) {
      expect(agente).toMatch(new RegExp(`llamarTextoGratisConFallbackHaiku\\(\\s*env,\\s*'${literal.replace(/[/.]/g, '\\$&')}[^'$]*',`));
    }
  });

  it('reescritura de la consulta de búsqueda: fechas distintas → mismo system; la fecha va en el user', async () => {
    const f = fetchQueDevuelve(chatOk('{"query":"cobre precio","since":"year"}'));
    const FRASE = 'busca en internet a cuánto está hoy el precio del cobre por favor';
    await prepararConsultaBusqueda(ENV, FRASE, { ahora: FECHA_A }, { fetch: f });
    await prepararConsultaBusqueda(ENV, FRASE, { ahora: FECHA_B }, { fetch: f });
    expect(f.llamadas[0].messages[0].content).toBe(f.llamadas[1].messages[0].content);
    expect(f.llamadas[0].messages[0].content).not.toMatch(/2026/);
    expect(f.llamadas[0].messages[1].content).toBe(`Fecha de hoy: 2026-10-04.\nPetición: ${FRASE}`);
    expect(f.llamadas[1].messages[1].content.startsWith('Fecha de hoy: 2026-12-31.')).toBe(true);
  });
});

describe('calentamiento al abrir el chat', () => {
  const peticion = () => peticionPoolEstable(sistemaDe({ ahora: FECHA_A }), [{ role: 'user', content: 'Hola' }], TOOLS);

  it('manda el MISMO system y las MISMAS tools que la petición real, con max_tokens 1', async () => {
    const f = fetchQueDevuelve(chatOk(''));
    const pet = peticion();
    const r = await poolCalentar(ENV, { clave: 'usuario:3', messages: aOpenAI(pet.messages, pet.sistema), tools: toolsAOpenAI(pet.tools) }, { fetch: f });
    expect(r.ok).toBe(true);
    const real = peticionPoolEstable(sistemaDe({ ahora: FECHA_B, variables: ['prl_seguridad'] }), mensajesDe('Adrián', '1', '¿qué tal?'), TOOLS);
    await poolChat(ENV, { messages: aOpenAI(real.messages, real.sistema), tools: toolsAOpenAI(real.tools), uso: 'experto_simple' }, { fetch: f });
    const [cal, chat] = f.llamadas;
    expect(cal.max_tokens).toBe(1);
    expect(cal.messages[0].content).toBe(chat.messages[0].content);
    expect(JSON.stringify(cal.tools)).toBe(JSON.stringify(chat.tools));
    expect(Object.keys(cal).sort()).toEqual(['max_tokens', 'messages', 'model', 'tools']);
  });

  it('limitado a 1 por usuario cada intervalo por isolate', async () => {
    const f = fetchQueDevuelve(chatOk(''));
    const pet = peticion();
    const args = { messages: aOpenAI(pet.messages, pet.sistema), tools: toolsAOpenAI(pet.tools) };
    const t0 = 1_000_000;
    expect((await poolCalentar(ENV, { ...args, clave: 'usuario:3', ahora: t0 }, { fetch: f })).ok).toBe(true);
    expect((await poolCalentar(ENV, { ...args, clave: 'usuario:3', ahora: t0 + 60_000 }, { fetch: f })).motivo).toBe('limitado');
    expect((await poolCalentar(ENV, { ...args, clave: 'usuario:9', ahora: t0 + 60_000 }, { fetch: f })).ok).toBe(true);
    expect((await poolCalentar(ENV, { ...args, clave: 'usuario:3', ahora: t0 + AI_POOL_CALENTAMIENTO.intervaloMs }, { fetch: f })).ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('sin clave del pool o con el circuito abierto no llama; sus fallos no abren el circuito', async () => {
    const f = fetchQueDevuelve(fallo(503));
    const pet = peticion();
    const args = { messages: aOpenAI(pet.messages, pet.sistema), tools: toolsAOpenAI(pet.tools) };
    expect((await poolCalentar({}, { ...args, clave: 'usuario:1' }, { fetch: f })).omitido).toBe(true);
    for (let i = 0; i < 5; i++) await poolCalentar(ENV, { ...args, clave: 'usuario:' + i }, { fetch: f });
    expect(f).toHaveBeenCalledTimes(5);
    expect(circuitoPoolAbierto()).toBe(false);
    // Con el circuito abierto por fallos reales, el calentamiento ni lo intenta.
    for (let i = 0; i < 3; i++) await poolTexto(ENV, 's', 'u', {}, { fetch: fetchQueDevuelve(fallo(503)) });
    expect(circuitoPoolAbierto()).toBe(true);
    const g = fetchQueDevuelve(chatOk(''));
    expect((await poolCalentar(ENV, { ...args, clave: 'usuario:otro' }, { fetch: g })).motivo).toBe('no_disponible');
    expect(g).not.toHaveBeenCalled();
    expect(metricasPool().usos.calentamiento.respaldo).toBe(5);
  });

  it('la métrica del calentamiento no lleva contenido', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await poolCalentar(ENV, { clave: 'usuario:3', messages: [{ role: 'system', content: 'SECRETO-SYSTEM' }, { role: 'user', content: 'DATO-PRIVADO' }] }, { fetch: fetchQueDevuelve(chatOk('')) });
    const lineas = log.mock.calls.map(c => c.join(' ')).filter(l => l.startsWith('AIPOOL_METRICA'));
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toContain('"uso":"calentamiento"');
    expect(lineas[0]).not.toMatch(/SECRETO|DATO-PRIVADO|usuario:3/);
  });
});

describe('cableado en los workers (regla «dos cerebros»)', () => {
  it('el agente compone el system con componerSistemaNexus y pasa los módulos dinámicos en los dos bucles', () => {
    expect(agente).toMatch(/async function buildAnthropicSystemBlocks\(modulos, tools, env, modulosVariables = \[\]\)[\s\S]{0,2600}return componerSistemaNexus\(\{/);
    const llamadas = agente.match(/buildAnthropicSystemBlocks\(modulosFinal, tools, env, modulosDinamicos\)/g) || [];
    expect(llamadas).toHaveLength(2); // procesarConNEXUS y procesarConNEXUSStream
    expect(agente).not.toMatch(/buildAnthropicSystemBlocks\(modulosFinal, tools, env\)/);
  });

  it('_intentarPoolChat usa peticionPoolEstable y descarta tool_use en vueltas sin tools', () => {
    const cuerpo = agente.slice(agente.indexOf('async function _intentarPoolChat('), agente.indexOf('async function _intentarGrokFallback('));
    expect(cuerpo).toMatch(/const pet = peticionPoolEstable\(systemPrompt, messages, tools\);/);
    expect(cuerpo).toMatch(/_agenteMsgsToOpenAI\(pet\.messages, pet\.sistema, false\)/);
    expect(cuerpo).toMatch(/_anthropicToolsToOpenAI\(pet\.tools\)/);
    expect(cuerpo).toMatch(/pet\.toolsForzadas && content\.some\(b => b\.type === 'tool_use'\)\) \{[\s\S]{0,200}return null;/);
  });

  it('el calentamiento va en la carga del historial, en segundo plano y solo con el pool configurado', () => {
    const hist = agente.slice(agente.indexOf("if (path === '/api/chat/history' && req.method === 'GET')"), agente.indexOf("if (path === '/push-subscribe'"));
    expect(hist).toMatch(/if \(poolConfigurado\(env\) && ctx && [^\n]*\) \{\s*ctx\.waitUntil\(calentarPoolExpertoSimple\(env, sesion\.usuario_id, esDev\)\.catch\(\(\) => \{\}\)\);/);
    expect(hist.indexOf('calentarPoolExpertoSimple')).toBeGreaterThan(hist.indexOf('No puedes ver el historial de otro usuario'));
    const fn = agente.slice(agente.indexOf('async function calentarPoolExpertoSimple('), agente.indexOf('async function llamarGPT4oFallback('));
    expect(fn).toMatch(/filtrarToolsPorAuth\(TOOLS_POR_EXPERTO\.simple \|\| \[\], true, !!esDevVerificado\)/);
    expect(fn).toMatch(/buildAnthropicSystemBlocks\(expert\.modules, tools, env, \[\]\)/);
    expect(fn).toMatch(/poolCalentar\(env,/);
  });

});
