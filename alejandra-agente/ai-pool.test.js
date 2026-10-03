// ADR-0028 — cliente del pool de IA propio. Todo con fetch simulado: ninguna llamada real.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AI_POOL_MODELO, AI_POOL_MODELO_ROUTER, AI_POOL_URL_DEFECTO, AI_POOL_CIRCUITO,
  poolConfigurado, urlBasePool, limpiarClavePool, poolChat, poolTexto, poolClasificar,
  poolRouterNexus, poolBuscar, poolLeer, normalizarEtiquetaRouter, parsearRouterNexus,
  normalizarResultadosBusqueda, formatearBusquedaPool, quitarRazonamiento,
  circuitoPoolAbierto, _reiniciarCircuitoPool, metricasPool, _reiniciarMetricasPool,
  prepararConsultaBusqueda, consultaBusquedaHeuristica, consultaNecesitaReescritura,
  validarConsultaReescrita, sinceHeuristico, normalizarNombreModeloPool, AI_POOL_SINCE_VALIDOS
} from './ai-pool.js';
import { calcularCosteYProveedor, ETIQUETAS_CLASIFICADOR_INTENCION, SYSTEM_CLASIFICADOR_INTENCION } from './lib.js';

const ENV = { AI_POOL_KEY: 'clave-de-prueba' };

function respuesta(status, cuerpo) {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return { ok: status >= 200 && status < 300, status, text: async () => texto };
}
function chatOk(content, extra = {}) {
  return respuesta(200, { model: AI_POOL_MODELO, choices: [{ message: { role: 'assistant', content, ...extra }, finish_reason: 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 3 } });
}
function fetchQueDevuelve(...respuestas) {
  const llamadas = [];
  const f = vi.fn(async (url, init) => {
    llamadas.push({ url, init, body: JSON.parse(init.body) });
    const r = respuestas.length > 1 ? respuestas.shift() : respuestas[0];
    return typeof r === 'function' ? r(url, init) : r;
  });
  f.llamadas = llamadas;
  return f;
}
// fetch que nunca contesta hasta que se aborta (simula carga en frío / pool colgado)
function fetchColgado() {
  return vi.fn((url, init) => new Promise((_, rechazar) => {
    init.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rechazar(e); });
  }));
}

beforeEach(() => {
  _reiniciarCircuitoPool();
  _reiniciarMetricasPool();
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ADR-0028: apagado por defecto — sin clave, cero llamadas', () => {
  it('sin AI_POOL_KEY ninguna función llama a fetch y todas piden respaldo', async () => {
    const f = fetchQueDevuelve(chatOk('app'));
    const opts = { fetch: f };
    expect(poolConfigurado({})).toBe(false);
    expect(await poolTexto({}, 's', 'u', {}, opts)).toBeNull();
    expect(await poolClasificar({}, 's', 'hola', ['app'], {}, opts)).toBeNull();
    expect(await poolRouterNexus({}, 'p', ['asistente'], {}, opts)).toBeNull();
    expect(await poolBuscar({}, 'rebt itc-bt-19', {}, opts)).toBeNull();
    expect(await poolLeer({}, 'https://www.boe.es/', {}, opts)).toBeNull();
    expect((await poolChat({}, { messages: [{ role: 'user', content: 'x' }] }, opts)).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
    // Apagado = ni una línea de métrica nueva
    expect(metricasPool().usos).toEqual({});
  });

  it('clave vacía, solo espacios/BOM o AI_POOL_ENABLED="0" también lo apagan', async () => {
    const f = fetchQueDevuelve(chatOk('app'));
    for (const env of [{ AI_POOL_KEY: '' }, { AI_POOL_KEY: '﻿  \n' }, { AI_POOL_KEY: 'x', AI_POOL_ENABLED: '0' }]) {
      expect(poolConfigurado(env)).toBe(false);
      expect(await poolTexto(env, 's', 'u', {}, { fetch: f })).toBeNull();
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('solo HTTPS: un AI_POOL_URL http:// desactiva el pool', async () => {
    const f = fetchQueDevuelve(chatOk('app'));
    const env = { ...ENV, AI_POOL_URL: 'http://pve1.tail2c5046.ts.net' };
    expect(urlBasePool(env)).toBeNull();
    expect(poolConfigurado(env)).toBe(false);
    expect(await poolTexto(env, 's', 'u', {}, { fetch: f })).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(urlBasePool(ENV)).toBe(AI_POOL_URL_DEFECTO);
    expect(urlBasePool({ ...ENV, AI_POOL_URL: 'https://otro.ts.net/' })).toBe('https://otro.ts.net');
  });

  it('limpia BOM/espacios de la clave antes de la cabecera Authorization', () => {
    expect(limpiarClavePool('﻿abc \r\n')).toBe('abc');
  });
});

describe('ADR-0028: con clave y pool sano se usa el pool', () => {
  it('chat: URL, Bearer, cuerpo mínimo (sin stream ni tool_choice) y uso en tokens', async () => {
    const f = fetchQueDevuelve(chatOk('Hola, ¿qué tal?'));
    const r = await poolTexto(ENV, 'Eres Alejandra', 'hola', { maxTokens: 50, uso: 'prueba' }, { fetch: f });
    expect(r.texto).toBe('Hola, ¿qué tal?');
    expect(r.modeloRegistro).toBe('ai_pool:' + AI_POOL_MODELO);
    expect(r.usage).toEqual({ input_tokens: 11, output_tokens: 3 });
    const { url, init, body } = f.llamadas[0];
    expect(url).toBe(AI_POOL_URL_DEFECTO + '/openai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer clave-de-prueba');
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model']);
    expect(body.model).toBe(AI_POOL_MODELO);
    // Interruptor suave de razonamiento solo para qwen3
    expect(body.messages[0].content.endsWith('/no_think')).toBe(true);
  });

  it('quita el razonamiento <think> de qwen3 del texto', async () => {
    const f = fetchQueDevuelve(chatOk('<think>pensando…</think>\nRespuesta'));
    expect((await poolTexto(ENV, 's', 'u', {}, { fetch: f })).texto).toBe('Respuesta');
    expect(quitarRazonamiento('a</think> b')).toBe('b');
  });

  it('router del agente: prisma:1.0 + json_object y etiqueta válida', async () => {
    const f = fetchQueDevuelve(chatOk('{"experto":"ingenieria"}'));
    const r = await poolClasificar(ENV, SYSTEM_CLASIFICADOR_INTENCION, 'calcula la sección del cable', ETIQUETAS_CLASIFICADOR_INTENCION, {}, { fetch: f });
    expect(r.etiqueta).toBe('ingenieria');
    const body = f.llamadas[0].body;
    expect(body.model).toBe(AI_POOL_MODELO_ROUTER);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.temperature).toBe(0);
    expect(body.messages[0].content).toContain('JSON');
    expect(body.messages[0].content.endsWith('/no_think')).toBe(false); // prisma no es qwen3
  });

  it('router NEXUS de worker.js: JSON con experto válido', async () => {
    const f = fetchQueDevuelve(chatOk('{"expert":"analista","compress_history":true}'));
    const r = await poolRouterNexus(ENV, 'prompt', ['asistente', 'analista'], {}, { fetch: f });
    expect(r).toMatchObject({ expert: 'analista', compress_history: true });
  });

  it('chat con tools solo con qwen3.6; con prisma ni se intenta', async () => {
    const tools = [{ type: 'function', function: { name: 'consultar_inventario', parameters: { type: 'object', properties: {} } } }];
    const f = fetchQueDevuelve(chatOk(null, { tool_calls: [{ id: 't1', type: 'function', function: { name: 'consultar_inventario', arguments: '{}' } }] }));
    const r = await poolChat(ENV, { messages: [{ role: 'user', content: 'stock?' }], tools }, { fetch: f });
    expect(r.ok).toBe(true);
    expect(r.toolCalls[0].function.name).toBe('consultar_inventario');
    expect(f.llamadas[0].body.tools).toEqual(tools);
    expect(f.llamadas[0].body.tool_choice).toBeUndefined();
    const f2 = fetchQueDevuelve(chatOk('x'));
    const r2 = await poolChat(ENV, { messages: [{ role: 'user', content: 'x' }], tools, modelo: 'prisma:1.0' }, { fetch: f2 });
    expect(r2.ok).toBe(false);
    expect(f2).not.toHaveBeenCalled();
  });

  it('search: cuerpo estricto {query, results} y mapeo de snippet', async () => {
    const f = fetchQueDevuelve(respuesta(200, { query: 'q', results: [{ title: 'ITC-BT-19', url: 'https://www.boe.es/x', snippet: 'Instalaciones interiores' }, { title: 'sin url' }], devices: ['pve1'], took_s: 1.2 }));
    const r = await poolBuscar(ENV, '  ITC-BT-19 caída de tensión  ', { maxResultados: 5 }, { fetch: f });
    expect(f.llamadas[0].url).toBe(AI_POOL_URL_DEFECTO + '/v1/tools/search');
    expect(f.llamadas[0].body).toEqual({ query: 'ITC-BT-19 caída de tensión', results: 5 });
    expect(r.resultados).toEqual([{ title: 'ITC-BT-19', url: 'https://www.boe.es/x', content: 'Instalaciones interiores' }]);
    expect(formatearBusquedaPool('q', r)).toContain('Fuente: https://www.boe.es/x');
  });

  it('search: recorta la query a 300 y no llama con menos de 2 caracteres', async () => {
    const f = fetchQueDevuelve(respuesta(200, { results: [{ url: 'https://a.es', snippet: 's' }] }));
    await poolBuscar(ENV, 'x'.repeat(500), { maxResultados: 50 }, { fetch: f });
    expect(f.llamadas[0].body.query.length).toBe(300);
    expect(f.llamadas[0].body.results).toBe(10);
    expect(await poolBuscar(ENV, 'a', {}, { fetch: f })).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('read: cuerpo {url, summarize:false} y devuelve el texto', async () => {
    const f = fetchQueDevuelve(respuesta(200, { url: 'https://a.es/p', final_url: 'https://a.es/p', status: 200, title: 'T', text: 'contenido', device: 'pve1', summary: null, took_s: 2 }));
    const r = await poolLeer(ENV, 'https://a.es/p', { maxChars: 4 }, { fetch: f });
    expect(f.llamadas[0].body).toEqual({ url: 'https://a.es/p', summarize: false });
    expect(r).toMatchObject({ titulo: 'T', texto: 'cont' });
  });
});

describe('ADR-0028: respaldo inmediato ante errores rápidos', () => {
  it('503 model_unavailable → null al momento (una sola llamada, sin reintentos)', async () => {
    const f = fetchQueDevuelve(respuesta(503, { error: { code: 'model_unavailable', message: 'no hay nodo' } }));
    expect(await poolTexto(ENV, 's', 'u', {}, { fetch: f })).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    expect(metricasPool().usos.texto.motivosRespaldo).toEqual({ model_unavailable: 1 });
  });

  it('503 request_too_long_for_devices (formato {"detail"}) → respaldo con su motivo', async () => {
    const f = fetchQueDevuelve(respuesta(503, { detail: 'request_too_long_for_devices' }));
    expect(await poolClasificar(ENV, 's', 'u', ['app'], {}, { fetch: f })).toBeNull();
    expect(metricasPool().usos.router.motivosRespaldo).toEqual({ request_too_long_for_devices: 1 });
  });

  it('429, 401, 422 y 502 → respaldo', async () => {
    for (const st of [429, 401, 422, 502]) {
      _reiniciarCircuitoPool();
      const f = fetchQueDevuelve(respuesta(st, { detail: 'x' }));
      expect(await poolBuscar(ENV, 'consulta', {}, { fetch: f })).toBeNull();
    }
  });

  it('timeout → respaldo (AbortController) y métrica "timeout"', async () => {
    const f = fetchColgado();
    const t0 = Date.now();
    expect(await poolTexto(ENV, 's', 'u', { timeoutMs: 30 }, { fetch: f })).toBeNull();
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(metricasPool().usos.texto).toMatchObject({ respaldo: 1, motivosRespaldo: { timeout: 1 } });
  });

  it('error de red → respaldo', async () => {
    const f = vi.fn(async () => { throw new TypeError('fetch failed'); });
    expect(await poolTexto(ENV, 's', 'u', {}, { fetch: f })).toBeNull();
  });
});

describe('ADR-0028: respuesta mal formada → respaldo', () => {
  it('cuerpo no JSON, sin choices, contenido vacío o error en cuerpo', async () => {
    for (const r of [respuesta(200, 'no soy json'), respuesta(200, { choices: [] }), chatOk(''), chatOk('<think>solo pienso</think>'), respuesta(200, { error: 'model_unavailable' })]) {
      _reiniciarCircuitoPool();
      expect(await poolTexto(ENV, 's', 'u', {}, { fetch: fetchQueDevuelve(r) })).toBeNull();
    }
  });

  it('router: frase, dos etiquetas, etiqueta inventada o JSON con otra clave → null (Haiku)', async () => {
    for (const salida of ['creo que app', 'app o web', 'ventas', '{"categoria":"app"}', '{"experto":"web y app"}']) {
      _reiniciarCircuitoPool();
      expect(await poolClasificar(ENV, 's', 'u', ETIQUETAS_CLASIFICADOR_INTENCION, {}, { fetch: fetchQueDevuelve(chatOk(salida)) })).toBeNull();
    }
    expect(metricasPool().usos.router.motivosRespaldo).toEqual({ formato_invalido: 5 });
  });

  it('normalizarEtiquetaRouter acepta palabra suelta o JSON correcto', () => {
    const v = ETIQUETAS_CLASIFICADOR_INTENCION;
    expect(normalizarEtiquetaRouter('App.', v)).toBe('app');
    expect(normalizarEtiquetaRouter('"web"', v)).toBe('web');
    expect(normalizarEtiquetaRouter('{"experto": "simple"}', v)).toBe('simple');
    expect(normalizarEtiquetaRouter('{"experto": ', v)).toBeNull();
  });

  it('router NEXUS: experto inventado o JSON roto → null', () => {
    expect(parsearRouterNexus('{"expert":"hacker"}', ['asistente'])).toBeNull();
    expect(parsearRouterNexus('nada', ['asistente'])).toBeNull();
    expect(parsearRouterNexus('{"expert":"asistente"}', ['asistente'])).toEqual({ expert: 'asistente', compress_history: false });
  });

  it('search con results [] o read con {"error"} sin text → respaldo', async () => {
    expect(await poolBuscar(ENV, 'nada', {}, { fetch: fetchQueDevuelve(respuesta(200, { query: 'nada', results: [], devices: [], took_s: 1 })) })).toBeNull();
    expect(await poolLeer(ENV, 'https://a.es/p', {}, { fetch: fetchQueDevuelve(respuesta(200, { url: 'https://a.es/p', error: 'timeout', device: 'pve1', took_s: 9 })) })).toBeNull();
    const u = metricasPool().usos;
    expect(u.search.motivosRespaldo).toEqual({ sin_resultados: 1 });
    expect(u.read.motivosRespaldo).toEqual({ timeout: 1 });
  });

  it('tolera otras formas de respuesta de búsqueda (array raíz, link/description)', () => {
    expect(normalizarResultadosBusqueda([{ link: 'https://x.es', name: 'X', description: 'd' }]).resultados)
      .toEqual([{ title: 'X', url: 'https://x.es', content: 'd' }]);
  });
});

describe('ADR-0028: circuito abierto por isolate', () => {
  it(`tras ${AI_POOL_CIRCUITO.umbralFallos} fallos seguidos deja de llamar; reabre pasado el enfriamiento`, async () => {
    const f = fetchQueDevuelve(respuesta(503, { error: { code: 'model_unavailable' } }));
    for (let i = 0; i < AI_POOL_CIRCUITO.umbralFallos; i++) expect(await poolTexto(ENV, 's', 'u', {}, { fetch: f })).toBeNull();
    expect(f).toHaveBeenCalledTimes(AI_POOL_CIRCUITO.umbralFallos);
    expect(circuitoPoolAbierto()).toBe(true);
    // Con el circuito abierto: respaldo sin tocar la red, y se cuenta como «omitido»
    expect(await poolTexto(ENV, 's', 'u', {}, { fetch: f })).toBeNull();
    expect(await poolBuscar(ENV, 'consulta', {}, { fetch: f })).toBeNull();
    expect(f).toHaveBeenCalledTimes(AI_POOL_CIRCUITO.umbralFallos);
    expect(metricasPool().usos.texto.omitido).toBe(1);
    // Pasado el enfriamiento vuelve a intentarlo
    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + AI_POOL_CIRCUITO.enfriamientoMs + 1);
    expect(circuitoPoolAbierto()).toBe(false);
    const f2 = fetchQueDevuelve(chatOk('vuelvo'));
    expect((await poolTexto(ENV, 's', 'u', {}, { fetch: f2 })).texto).toBe('vuelvo');
  });

  it('un éxito reinicia el contador de fallos seguidos', async () => {
    const malo = respuesta(503, { error: { code: 'model_unavailable' } });
    const f = fetchQueDevuelve(malo, malo, chatOk('ok'), malo, malo, chatOk('ok'));
    for (let i = 0; i < 6; i++) await poolTexto(ENV, 's', 'u', {}, { fetch: f });
    expect(circuitoPoolAbierto()).toBe(false);
    expect(f).toHaveBeenCalledTimes(6);
  });
});

describe('ADR-0028: medición sin D1 y coste 0', () => {
  it('metricasPool agrega ok/respaldo, motivos y latencias por uso', async () => {
    await poolTexto(ENV, 's', 'u', { uso: 'cron_normal' }, { fetch: fetchQueDevuelve(chatOk('SIN_ACCION')) });
    await poolTexto(ENV, 's', 'u', { uso: 'cron_normal' }, { fetch: fetchQueDevuelve(respuesta(429, { detail: 'rate' })) });
    const m = metricasPool();
    expect(m.alcance).toBe('isolate');
    expect(m.usos.cron_normal).toMatchObject({ total: 2, ok: 1, respaldo: 1, motivosRespaldo: { http_429: 1 } });
    expect(m.usos.cron_normal.p50MsOk).not.toBeNull();
  });

  it('la línea de log AIPOOL_METRICA no incluye contenido del prompt ni de la respuesta', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await poolTexto(ENV, 'SECRETO-DEL-PROMPT', 'DATO-DE-EMPRESA', {}, { fetch: fetchQueDevuelve(chatOk('RESPUESTA-PRIVADA')) });
    const lineas = log.mock.calls.map(c => c.join(' ')).filter(l => l.startsWith('AIPOOL_METRICA'));
    expect(lineas).toHaveLength(1);
    const dato = JSON.parse(lineas[0].slice('AIPOOL_METRICA '.length));
    expect(dato).toMatchObject({ uso: 'texto', proveedor: 'ai_pool', resultado: 'ok' });
    expect(lineas[0]).not.toMatch(/SECRETO|DATO-DE-EMPRESA|RESPUESTA-PRIVADA/);
  });

  it('calcularCosteYProveedor: ai_pool:* → proveedor ai_pool, coste 0', () => {
    expect(calcularCosteYProveedor('ai_pool:qwen3.6:35b-a3b', 1e6, 1e6)).toEqual({ proveedor: 'ai_pool', coste: 0 });
    expect(calcularCosteYProveedor('ai_pool:tools/search', 0, 0)).toEqual({ proveedor: 'ai_pool', coste: 0 });
    expect(calcularCosteYProveedor('claude-haiku-4-5', 1e6, 0).proveedor).toBe('anthropic');
  });
});

describe('ADR-0028: regla «dos cerebros»', () => {
  const agente = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  const web = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
  it('los dos workers importan el MISMO cliente del pool', () => {
    expect(agente).toMatch(/from '\.\/ai-pool\.js'/);
    expect(web).toMatch(/from '\.\/alejandra-agente\/ai-pool\.js'/);
  });
  it('cada uso del pool tiene su respaldo a continuación', () => {
    // router del agente → Haiku; router NEXUS → Haiku; web_search → Tavily; buscar_web → gpt-4o-mini
    expect(agente).toMatch(/poolClasificar\([\s\S]{0,900}CAPA 2b: Haiku/);
    expect(web).toMatch(/poolRouterNexus\([\s\S]{0,200}if \(rutaPool\)[\s\S]{0,200}api\.anthropic\.com/);
    expect(web).toMatch(/poolBuscar\([\s\S]{0,900}api\.tavily\.com/);
    expect(agente).toMatch(/poolBuscar\([\s\S]{0,1200}gpt-4o-mini/);
    // cadena cuando cae Anthropic: pool → Grok → OpenRouter → gpt-4o
    expect(agente).toMatch(/'respaldo_anthropic'\)[\s\S]{0,800}_intentarGrokFallback/);
  });
});
describe('03/10/2026: consulta corta para /v1/tools/search', () => {
  const FRASE = 'Busca en internet cuál es la última versión estable de Node.js y dime solo el número.';
  const HOY = new Date('2026-10-03T10:00:00Z');
  const CAMPOS_SEARCH = ['query', 'results', 'since'];

  it('frase larga → reescrita por el pool (prisma JSON) y con since=year', async () => {
    const f = fetchQueDevuelve(
      respuesta(200, { model: 'prisma:1.0', choices: [{ message: { role: 'assistant', content: '{"query":"Node.js latest LTS version","since":"year"}' }, finish_reason: 'stop' }] }),
      respuesta(200, { query: 'Node.js latest LTS version', results: [{ title: 'Node.js', url: 'https://nodejs.org/en', snippet: '24.11.0 LTS' }] })
    );
    const c = await prepararConsultaBusqueda(ENV, FRASE, { ahora: HOY }, { fetch: f });
    expect(c).toEqual({ query: 'Node.js latest LTS version', since: 'year', fuente: 'ai_pool' });
    // Petición de reescritura: modelo router, modo JSON, cuerpo mínimo
    const pet = f.llamadas[0];
    expect(pet.url).toBe(AI_POOL_URL_DEFECTO + '/openai/v1/chat/completions');
    expect(pet.body.model).toBe(AI_POOL_MODELO_ROUTER);
    expect(pet.body.response_format).toEqual({ type: 'json_object' });
    expect(Object.keys(pet.body).sort()).toEqual(['max_tokens', 'messages', 'model', 'response_format', 'temperature']);
    expect(pet.body.messages[1].content).toBe(FRASE);
    // La búsqueda lleva la consulta corta y el filtro
    await poolBuscar(ENV, c.query, { since: c.since }, { fetch: f });
    expect(f.llamadas[1].body).toEqual({ query: 'Node.js latest LTS version', results: 5, since: 'year' });
    const u = metricasPool().usos;
    expect(u.buscar_web_consulta.ok).toBe(1);
  });

  it('query corta (≤6 palabras, sin muletillas) → sin llamada de reescritura', async () => {
    const f = fetchQueDevuelve(chatOk('{"query":"x","since":null}'));
    const c = await prepararConsultaBusqueda(ENV, 'Node.js latest LTS version', { ahora: HOY }, { fetch: f });
    expect(f).not.toHaveBeenCalled();
    expect(c).toEqual({ query: 'Node.js latest LTS version', since: 'year', fuente: 'original' });
    expect(metricasPool().usos.buscar_web_consulta).toMatchObject({ omitido: 1, ok: 0 });
    const c2 = await prepararConsultaBusqueda(ENV, 'ITC-BT-19 caída de tensión', { ahora: HOY }, { fetch: f });
    expect(c2).toEqual({ query: 'ITC-BT-19 caída de tensión', since: null, fuente: 'original' });
    expect(f).not.toHaveBeenCalled();
    // Corta pero con muletilla → sí se reescribe
    expect(consultaNecesitaReescritura('busca precio cobre')).toBe(true);
    expect(consultaNecesitaReescritura('precio cobre hoy')).toBe(false);
  });

  it('pool de reescritura caído (timeout, HTTP, JSON inválido) → heurística determinista', async () => {
    vi.useFakeTimers();
    try {
      const pend = prepararConsultaBusqueda(ENV, FRASE, { ahora: HOY }, { fetch: fetchColgado() });
      await vi.advanceTimersByTimeAsync(4001);
      expect(await pend).toEqual({ query: 'última versión estable Node.js', since: 'year', fuente: 'heuristica' });
    } finally { vi.useRealTimers(); }
    const c503 = await prepararConsultaBusqueda(ENV, FRASE, { ahora: HOY }, { fetch: fetchQueDevuelve(respuesta(503, { error: { code: 'model_unavailable' } })) });
    expect(c503.fuente).toBe('heuristica');
    // Salida con campo extra, since inventado o texto libre → inválida
    for (const salida of ['{"query":"Node.js latest","since":"year","extra":1}', '{"query":"Node.js latest","since":"decade"}', 'Node.js latest version', '{"since":"year"}']) {
      const c = await prepararConsultaBusqueda(ENV, FRASE, { ahora: HOY }, { fetch: fetchQueDevuelve(chatOk(salida)) });
      expect(c).toEqual({ query: 'última versión estable Node.js', since: 'year', fuente: 'heuristica' });
    }
    const u = metricasPool().usos.buscar_web_consulta;
    expect(u.ok).toBe(0);
    expect(u.motivosRespaldo).toMatchObject({ timeout: 1, model_unavailable: 1, formato_invalido: 4 });
  });

  it('sin AI_POOL_KEY: ni reescritura ni métrica (apagado por defecto)', async () => {
    const f = fetchQueDevuelve(chatOk('{"query":"x","since":null}'));
    const c = await prepararConsultaBusqueda({}, FRASE, { ahora: HOY }, { fetch: f });
    expect(c.fuente).toBe('heuristica');
    expect(f).not.toHaveBeenCalled();
    expect(metricasPool().usos).toEqual({});
  });

  it('heurística: quita muletillas, signos y palabras vacías; ≤10 palabras; since por palabras clave', () => {
    expect(consultaBusquedaHeuristica('¿Me puedes decir por favor el precio del cobre en España hoy?', { ahora: HOY }))
      .toEqual({ query: 'precio cobre España hoy', since: 'month' });
    const larga = consultaBusquedaHeuristica('uno dos tres cuatro cinco seis siete ocho nueve diez once doce');
    expect(larga.query.split(' ')).toHaveLength(10);
    expect(consultaBusquedaHeuristica('busca en internet').query).toBe('busca en internet');
    expect(sinceHeuristico('noticias del sector eléctrico')).toBe('month');
    expect(sinceHeuristico('normativa vigente de baja tensión')).toBe('year');
    expect(sinceHeuristico('subvenciones autoconsumo 2026', { ahora: HOY })).toBe('year');
    expect(sinceHeuristico('reglamento baja tensión 2002', { ahora: HOY })).toBeNull();
    expect(sinceHeuristico('ITC-BT-19 caída de tensión')).toBeNull();
  });

  it('validación estricta de la salida del modelo', () => {
    expect(validarConsultaReescrita('{"query":"Node.js latest LTS version","since":"year"}')).toEqual({ query: 'Node.js latest LTS version', since: 'year' });
    expect(validarConsultaReescrita('{"query":"ITC-BT-19 caída de tensión","since":null}')).toEqual({ query: 'ITC-BT-19 caída de tensión', since: null });
    expect(validarConsultaReescrita('{"query":"ITC-BT-19"}')).toEqual({ query: 'ITC-BT-19', since: null });
    expect(validarConsultaReescrita('{"query":"x"}')).toBeNull();
    expect(validarConsultaReescrita('{"query":"' + 'palabra '.repeat(13).trim() + '"}')).toBeNull();
    expect(validarConsultaReescrita('{"query":"a\\nb c"}')).toBeNull();
    expect(validarConsultaReescrita('{"query":123}')).toBeNull();
    expect(validarConsultaReescrita('["Node.js"]')).toBeNull();
  });

  it('nunca se envían a /v1/tools/search campos fuera del contrato {query, results, since}', async () => {
    const f = fetchQueDevuelve(respuesta(200, { results: [{ url: 'https://a.es', snippet: 's' }] }));
    await poolBuscar(ENV, 'Node.js latest LTS version', { since: 'year', maxResultados: 3 }, { fetch: f });
    await poolBuscar(ENV, 'ITC-BT-19', { since: 'decade' }, { fetch: f });
    await poolBuscar(ENV, 'ITC-BT-19', { since: null }, { fetch: f });
    await poolBuscar(ENV, 'ITC-BT-19', { since: { $ne: 1 }, read: 3, question: 'q' }, { fetch: f });
    for (const ll of f.llamadas) {
      expect(ll.url).toBe(AI_POOL_URL_DEFECTO + '/v1/tools/search');
      for (const k of Object.keys(ll.body)) expect(CAMPOS_SEARCH).toContain(k);
      if ('since' in ll.body) expect(AI_POOL_SINCE_VALIDOS).toContain(ll.body.since);
    }
    expect(f.llamadas[0].body).toEqual({ query: 'Node.js latest LTS version', results: 3, since: 'year' });
    expect(f.llamadas[1].body).toEqual({ query: 'ITC-BT-19', results: 5 });
    expect(f.llamadas[3].body).toEqual({ query: 'ITC-BT-19', results: 5 });
  });

  it('la métrica de la reescritura no incluye la consulta ni la respuesta', async () => {
    const log = console.log;
    await prepararConsultaBusqueda(ENV, FRASE, { ahora: HOY }, { fetch: fetchQueDevuelve(chatOk('{"query":"Node.js latest LTS version","since":"year"}')) });
    const lineas = log.mock.calls.map(c => c.join(' ')).filter(l => l.startsWith('AIPOOL_METRICA'));
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).not.toMatch(/Node|versi|internet/i);
    expect(JSON.parse(lineas[0].slice('AIPOOL_METRICA '.length))).toMatchObject({ uso: 'buscar_web_consulta', resultado: 'ok' });
  });

  it('campo model de la respuesta: nombre («prisma:1.0») o ruta, los dos tolerados', async () => {
    expect(normalizarNombreModeloPool('prisma:1.0')).toBe('prisma:1.0');
    expect(normalizarNombreModeloPool('qwen3.6:35b-a3b')).toBe('qwen3.6:35b-a3b');
    expect(normalizarNombreModeloPool('/models/prisma-1.0.gguf')).toBe('prisma-1.0');
    expect(normalizarNombreModeloPool('C:\\pool\\modelos\\gemma4-e4b.gguf')).toBe('gemma4-e4b');
    expect(normalizarNombreModeloPool('')).toBe('');
    expect(normalizarNombreModeloPool(null)).toBe('');
    const r = await poolChat(ENV, { messages: [{ role: 'user', content: 'x' }] }, { fetch: fetchQueDevuelve(respuesta(200, { model: '/models/qwen3.6-35b.gguf', choices: [{ message: { role: 'assistant', content: 'hola' } }] })) });
    expect(r.modeloRegistro).toBe('ai_pool:qwen3.6-35b');
    const r2 = await poolChat(ENV, { messages: [{ role: 'user', content: 'x' }] }, { fetch: fetchQueDevuelve(respuesta(200, { model: 'prisma:1.0', choices: [{ message: { role: 'assistant', content: 'hola' } }] })) });
    expect(r2.modeloRegistro).toBe('ai_pool:prisma:1.0');
  });

  it('los dos workers reescriben antes de buscar en el pool y el respaldo recibe la query original', () => {
    const agente = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    const web = readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
    expect(agente).toMatch(/prepararConsultaBusqueda\(env, String\(query[\s\S]{0,200}poolBuscar\(env, consulta\.query, \{[^}]*since: consulta\.since/);
    expect(web).toMatch(/prepararConsultaBusqueda\(env, String\(query\)\)[\s\S]{0,200}poolBuscar\(env, consultaPool\.query, \{[^}]*since: consultaPool\.since/);
    expect(agente).toMatch(/input: query \}\)/);
    expect(web).toMatch(/api_key: env\.TAVILY_API_KEY, query, /);
  });
});
