// ── AI POOL PROPIO CON RESPALDO (ADR-0028, 03/10/2026) ─────────────────────────
// Cliente del pool de IA doméstico de Adrián (gateway compatible OpenAI detrás de
// Tailscale Funnel). Lo comparten LOS DOS cerebros: alejandra-agente/worker.js lo importa
// directamente y worker.js (alejandra-app-api) lo importa como ya hace con lib.js. Una sola
// implementación = las dos Alejandras se comportan igual ante el pool (regla «dos
// cerebros» de CLAUDE.md). También lo usa el benchmark (scripts/ai-benchmark/pool.mjs).
//
// REGLA OBLIGATORIA: el pool NUNCA es el único camino. Toda función de aquí devuelve
// `null`/`{ ok:false }` ante cualquier problema (sin clave, interruptor apagado, circuito
// abierto, timeout, HTTP de error, 503 model_unavailable / request_too_long_for_devices,
// JSON roto, respuesta vacía o con formato inesperado) y el llamador sigue por el camino
// de siempre (Haiku, Tavily, gpt-4o-mini, Grok/gpt-4o...). Nunca lanza.
//
// APAGADO POR DEFECTO: sin el secreto AI_POOL_KEY no se hace NINGUNA llamada al pool.
// AI_POOL_ENABLED="0" lo apaga aunque haya clave (interruptor de emergencia sin tocar el
// secreto). Quitar el secreto = todo vuelve exactamente a como estaba antes del ADR-0028.
//
// PRIVACIDAD (ADR-0028 §Privacidad): solo HTTPS, nunca se registra el contenido de las
// peticiones ni de las respuestas (solo uso, modelo, resultado, motivo, latencia y tokens),
// y los llamadores mandan el mínimo de datos que ya mandaban al proveedor de pago.

// URL por defecto como constante (no como [vars] de wrangler.toml): un bloque [vars] en
// wrangler.toml REEMPLAZA en cada `wrangler deploy` las variables de texto definidas en el
// panel de Cloudflare, y ninguno de los dos workers tiene hoy [vars] — añadirlo podría
// borrar en silencio variables que existan solo en el panel. Con la constante + override
// opcional `env.AI_POOL_URL` (variable de texto en el panel, si algún día cambia el host)
// no se toca la configuración actual de ningún worker.
export const AI_POOL_URL_DEFECTO = 'https://pve1.tail2c5046.ts.net';

// Modelos disponibles en el pool (03/10/2026). qwen3.6:35b-a3b es el mejor y el ÚNICO que
// soporta tools formato OpenAI (prisma:1.0 devuelve tool_calls null). prisma:1.0 es el más
// rápido con response_format json_object (~0,7 s frente a ~2,5 s de qwen) → se usa para los
// routers, que solo devuelven una etiqueta. gemma4:e4b queda como alternativa medible en el
// benchmark. qwen2.5:1.5b/0.5b existen pero son pequeños y lentos: no se usan.
export const AI_POOL_MODELO = 'qwen3.6:35b-a3b';
export const AI_POOL_MODELO_ROUTER = 'prisma:1.0';
export const AI_POOL_MODELOS_ALTERNATIVOS = ['prisma:1.0', 'gemma4:e4b'];

// Timeouts por uso (ms). Cortos donde hay un usuario esperando; el respaldo entra al
// momento si el pool no contesta a tiempo. Ojo: con carga en frío o GPU prestada la
// primera respuesta del pool tarda 20–120 s — en interactivo eso SIEMPRE cae al respaldo
// (correcto); en crons, donde nadie espera, el timeout es generoso.
export const AI_POOL_TIMEOUTS = {
  router: 8000,    // clasificador de intención (Haiku tarda ~1 s)
  simple: 12000,   // experto «simple» del chat en vivo
  fondo: 25000,    // tareas en segundo plano tras responder (límite de waitUntil ~30 s)
  cron: 120000,    // crons: nadie espera en pantalla, se absorbe la carga en frío
  fallback: 25000, // cadena de respaldo cuando cae Anthropic (prompt grande)
  search: 10000,   // /v1/tools/search con read=0 (read>0 tarda decenas de s: nunca en vivo)
  read: 15000      // /v1/tools/read de una sola página
};

// Circuito abierto simple, por isolate: tras N fallos SEGUIDOS se deja de llamar al pool
// durante un rato, para no sumar el timeout a cada petición mientras está caído.
export const AI_POOL_CIRCUITO = { umbralFallos: 3, enfriamientoMs: 5 * 60 * 1000 };

// Prefijo con el que se registra el modelo en alejandra_token_uso: calcularCosteYProveedor
// (lib.js) lo traduce a proveedor 'ai_pool' con coste 0. Así el uso del pool sustituye a la
// fila que ya se escribía para Haiku/gpt-4o-mini — nunca añade escrituras D1 por petición
// (incidente D1-ESCRITURAS-01).
export const AI_POOL_PREFIJO_MODELO = 'ai_pool:';

// Códigos de error «rápidos» del pool: el modelo no está cargado en ningún nodo o la
// petición no cabe en los dispositivos. Respaldo inmediato, sin reintentos.
export const AI_POOL_ERRORES_RAPIDOS = new Set(['model_unavailable', 'request_too_long_for_devices']);

const _circuito = { fallosSeguidos: 0, abiertoHasta: 0 };

export function estadoCircuitoPool() {
  return { ..._circuito };
}

// Solo para tests/benchmark: el estado vive en el isolate.
export function _reiniciarCircuitoPool() {
  _circuito.fallosSeguidos = 0;
  _circuito.abiertoHasta = 0;
}

export function circuitoPoolAbierto(ahora = Date.now()) {
  return _circuito.abiertoHasta > ahora;
}

function _registrarExito() {
  _circuito.fallosSeguidos = 0;
  _circuito.abiertoHasta = 0;
}

function _registrarFallo(ahora = Date.now()) {
  _circuito.fallosSeguidos++;
  if (_circuito.fallosSeguidos >= AI_POOL_CIRCUITO.umbralFallos) {
    _circuito.abiertoHasta = ahora + AI_POOL_CIRCUITO.enfriamientoMs;
    _circuito.fallosSeguidos = 0;
    console.log(`[AIPool] circuito abierto ${AI_POOL_CIRCUITO.enfriamientoMs / 1000}s tras ${AI_POOL_CIRCUITO.umbralFallos} fallos seguidos`);
  }
}

// ── Métricas de comparación (ADR-0028 §Medición) ─────────────────────────────────
// Sin filas D1 por petición: (1) una línea de log estructurada por uso del pool
// («AIPOOL_METRICA {json}», legible con `wrangler tail --format json` o Workers Logs) y
// (2) agregados en memoria por isolate, consultables en GET /api/admin/metrics/ai-pool
// del agente. Nunca incluyen contenido de prompts ni respuestas.
let _metricasDesde = new Date().toISOString();
const _metricas = new Map();

export function registrarMetricaPool({ uso = 'desconocido', resultado, motivo = '', ms = null, modelo = '' } = {}) {
  const res = resultado === 'ok' ? 'ok' : resultado === 'omitido' ? 'omitido' : 'respaldo';
  if (!_metricas.has(uso)) _metricas.set(uso, { ok: 0, respaldo: 0, omitido: 0, motivos: {}, msOk: [], msTotalOk: 0 });
  const m = _metricas.get(uso);
  m[res]++;
  if (res !== 'ok' && motivo) m.motivos[motivo] = (m.motivos[motivo] || 0) + 1;
  if (res === 'ok' && Number.isFinite(ms)) {
    m.msTotalOk += ms;
    m.msOk.push(ms);
    if (m.msOk.length > 200) m.msOk.shift(); // ventana para percentiles, memoria acotada
  }
  try {
    console.log('AIPOOL_METRICA ' + JSON.stringify({ uso, proveedor: 'ai_pool', modelo: modelo || AI_POOL_MODELO, resultado: res, motivo: motivo || null, ms: Number.isFinite(ms) ? Math.round(ms) : null }));
  } catch (_) {}
}

function _percentil(valores, p) {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return Math.round(orden[Math.max(0, Math.ceil(orden.length * p) - 1)]);
}

export function metricasPool() {
  const usos = {};
  for (const [uso, m] of _metricas) {
    const total = m.ok + m.respaldo + m.omitido;
    usos[uso] = {
      total, ok: m.ok, respaldo: m.respaldo, omitido: m.omitido,
      tasaExito: total ? m.ok / total : null,
      motivosRespaldo: { ...m.motivos },
      msMedioOk: m.ok ? Math.round(m.msTotalOk / m.ok) : null,
      p50MsOk: _percentil(m.msOk, 0.5), p95MsOk: _percentil(m.msOk, 0.95)
    };
  }
  return { desde: _metricasDesde, alcance: 'isolate', circuito: estadoCircuitoPool(), usos };
}

export function _reiniciarMetricasPool() {
  _metricas.clear();
  _metricasDesde = new Date().toISOString();
}

// Mismo saneado que ya se aplica a OPENROUTER_API_KEY/GEMINI_API_KEY: un BOM o espacio
// colado al pegar el secreto rompe la cabecera Authorization en silencio.
export function limpiarClavePool(valor) {
  if (typeof valor !== 'string') return '';
  return valor.replace(/[﻿​\r\n\t ]+/g, '').trim();
}

export function urlBasePool(env) {
  const override = env && typeof env.AI_POOL_URL === 'string' ? env.AI_POOL_URL.trim() : '';
  const base = override || AI_POOL_URL_DEFECTO;
  // Solo HTTPS: datos de empresa viajan a un servidor doméstico (ADR-0028 §Privacidad).
  if (!/^https:\/\/[^\s/]+/i.test(base)) return null;
  return base.replace(/\/+$/, '');
}

// ¿Está el pool configurado y encendido? Sin AI_POOL_KEY → false (cero llamadas).
export function poolConfigurado(env) {
  if (!env) return false;
  if (String(env.AI_POOL_ENABLED ?? '').trim() === '0') return false;
  if (!limpiarClavePool(env.AI_POOL_KEY)) return false;
  return !!urlBasePool(env);
}

// ¿Merece la pena intentarlo ahora? Configurado y con el circuito cerrado.
export function poolDisponible(env, ahora = Date.now()) {
  return poolConfigurado(env) && !circuitoPoolAbierto(ahora);
}

function _fetchDe(opts) {
  if (opts && typeof opts.fetch === 'function') return opts.fetch;
  return (...args) => fetch(...args);
}

function _codigoError(data) {
  if (!data || typeof data !== 'object') return '';
  const e = data.error;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') return String(e.code || e.type || '');
  // FastAPI: {"detail": "model_unavailable"} o {"detail": {"code": ...}}
  const d = data.detail;
  if (typeof d === 'string' && AI_POOL_ERRORES_RAPIDOS.has(d)) return d;
  if (d && typeof d === 'object' && !Array.isArray(d)) return String(d.code || d.error || '');
  return String(data.code || '');
}

// POST JSON al pool con timeout (AbortController), sin lanzar nunca.
// Devuelve { ok:true, data, ms } o { ok:false, motivo, ms?, status?, codigo?, omitido? }.
async function _postPool(env, ruta, body, timeoutMs, opts = {}) {
  if (!poolConfigurado(env)) return { ok: false, motivo: 'no_configurado', omitido: true };
  if (circuitoPoolAbierto()) return { ok: false, motivo: 'circuito_abierto', omitido: true };
  const url = urlBasePool(env) + ruta;
  const ctrl = new AbortController();
  const t0 = Date.now();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await _fetchDe(opts)(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${limpiarClavePool(env.AI_POOL_KEY)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    let data = null;
    let crudo = '';
    try { crudo = await resp.text(); } catch (_) { crudo = ''; }
    try { data = crudo ? JSON.parse(crudo) : null; } catch (_) { data = null; }
    const ms = Date.now() - t0;
    if (!resp.ok) {
      const codigo = _codigoError(data);
      _registrarFallo();
      return { ok: false, motivo: AI_POOL_ERRORES_RAPIDOS.has(codigo) ? codigo : 'http_' + resp.status, status: resp.status, codigo, ms };
    }
    if (!data || typeof data !== 'object') {
      _registrarFallo();
      return { ok: false, motivo: 'json_invalido', ms };
    }
    return { ok: true, data, ms };
  } catch (e) {
    _registrarFallo();
    return { ok: false, motivo: e && e.name === 'AbortError' ? 'timeout' : 'red', ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

// Emite la métrica de un intento. Los «no configurado» no se registran: con el pool
// apagado no hay ni una línea de log nueva.
function _metrica(uso, r, modelo) {
  if (r.motivo === 'no_configurado' || r.motivo === 'sin_mensajes') return;
  registrarMetricaPool({ uso, resultado: r.ok ? 'ok' : (r.omitido ? 'omitido' : 'respaldo'), motivo: r.ok ? '' : r.motivo, ms: r.ms, modelo });
}

// qwen3 puede devolver su razonamiento entre <think>…</think> dentro de content.
export function quitarRazonamiento(texto) {
  if (typeof texto !== 'string') return '';
  return texto.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
}

// Chat compatible OpenAI sin métrica (la emite quien lo llama).
async function _poolChatCrudo(env, { messages, maxTokens = 512, tools, timeoutMs = AI_POOL_TIMEOUTS.simple, sinRazonamiento = true, temperature, modelo = AI_POOL_MODELO, json = false } = {}, opts = {}) {
  if (!Array.isArray(messages) || !messages.length) return { ok: false, motivo: 'sin_mensajes', omitido: true };
  let msgs = messages;
  // Interruptor suave de Qwen3 para no gastar tokens/latencia en razonamiento (a confirmar
  // con la sesión del pool: si el gateway ya lo desactiva, es inocuo).
  if (sinRazonamiento && /^qwen3/i.test(modelo)) {
    const i = msgs.findIndex(m => m && m.role === 'system');
    if (i >= 0 && typeof msgs[i].content === 'string') {
      msgs = msgs.slice();
      msgs[i] = { ...msgs[i], content: msgs[i].content + '\n/no_think' };
    }
  }
  // Cuerpo mínimo: el pool rechaza campos desconocidos (422) y no admite streaming
  // (stream:true → 400), así que no se manda `stream` ni `tool_choice` (auto por defecto).
  const body = { model: modelo, messages: msgs, max_tokens: maxTokens };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (json) body.response_format = { type: 'json_object' };
  if (Array.isArray(tools) && tools.length) {
    // Solo qwen3.6 soporta tools en el pool: con otro modelo no se intenta (respaldo).
    if (!/^qwen3/i.test(modelo)) return { ok: false, motivo: 'modelo_sin_tools', omitido: true };
    body.tools = tools;
  }
  const r = await _postPool(env, '/openai/v1/chat/completions', body, timeoutMs, opts);
  if (!r.ok) return r;
  const data = r.data;
  if (data.error) {
    _registrarFallo();
    const codigo = _codigoError(data);
    return { ok: false, motivo: AI_POOL_ERRORES_RAPIDOS.has(codigo) ? codigo : 'error_en_cuerpo', codigo, ms: r.ms };
  }
  const mensaje = data.choices && data.choices[0] && data.choices[0].message;
  const texto = quitarRazonamiento(mensaje && mensaje.content);
  const toolCalls = mensaje && Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls.filter(tc => tc && tc.function && tc.function.name) : [];
  if (!mensaje || (!texto && !toolCalls.length)) {
    _registrarFallo();
    return { ok: false, motivo: 'respuesta_vacia', ms: r.ms };
  }
  _registrarExito();
  const modeloReal = typeof data.model === 'string' && data.model ? data.model : modelo;
  return {
    ok: true,
    ms: r.ms,
    mensaje: { ...mensaje, content: texto, tool_calls: toolCalls.length ? toolCalls : undefined },
    texto,
    toolCalls,
    modelo: modeloReal,
    modeloRegistro: AI_POOL_PREFIJO_MODELO + modeloReal,
    finishReason: data.choices[0].finish_reason || null,
    usage: {
      input_tokens: (data.usage && data.usage.prompt_tokens) || 0,
      output_tokens: (data.usage && data.usage.completion_tokens) || 0
    }
  };
}

// Chat compatible OpenAI. `messages` ya en formato OpenAI (system/user/assistant/tool).
// Devuelve { ok:true, mensaje, texto, toolCalls, modelo, modeloRegistro, usage, ms } o
// { ok:false, motivo }. Una respuesta sin texto ni tool_calls cuenta como inválida.
export async function poolChat(env, params = {}, opts = {}) {
  const r = await _poolChatCrudo(env, params, opts);
  _metrica(params.uso || 'chat', r, r.modelo);
  return r;
}

// Texto simple: system + user → texto (sin tools). null si hay que ir al respaldo.
export async function poolTexto(env, systemPrompt, userText, { maxTokens = 500, timeoutMs = AI_POOL_TIMEOUTS.cron, uso = 'texto' } = {}, opts = {}) {
  if (!poolConfigurado(env)) return null;
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: String(systemPrompt) });
  messages.push({ role: 'user', content: String(userText || '') });
  const r = await poolChat(env, { messages, maxTokens, timeoutMs, uso }, opts);
  if (!r.ok || !r.texto) return null;
  return { texto: r.texto, modelo: r.modelo, modeloRegistro: r.modeloRegistro, usage: r.usage, ms: r.ms };
}

// Normaliza la salida del clasificador: una sola etiqueta de `validos`, nada más.
// Acepta el JSON del modo json_object ({"experto":"app"}) o una palabra suelta («app.»,
// «"web"», «Web»). «creo que app», «app o web» o un JSON con otra clave → inválido
// (respaldo Haiku).
export function normalizarEtiquetaRouter(texto, validos) {
  let crudo = quitarRazonamiento(texto);
  const jsonMatch = crudo.match(/^\s*\{[\s\S]*\}\s*$/);
  if (jsonMatch) {
    let obj;
    try { obj = JSON.parse(jsonMatch[0]); } catch (_) { return null; }
    const v = obj && (obj.experto ?? obj.etiqueta ?? obj.label);
    if (typeof v !== 'string') return null;
    crudo = v;
  }
  const limpio = crudo.toLowerCase().replace(/[`"'«»*.,;:!¡¿?()[\]{}]/g, ' ').trim();
  if (!limpio || /\s/.test(limpio)) return null;
  return validos.includes(limpio) ? limpio : null;
}

// Instrucción añadida al prompt del router en modo json_object (el modo JSON exige que el
// prompt mencione JSON). No cambia la semántica: sigue siendo UNA etiqueta.
export const SUFIJO_ROUTER_JSON = '\nDevuelve SOLO un objeto JSON con la forma {"experto":"<una de las palabras anteriores>"}.';

// Router de intención del agente: una etiqueta de `validos` o null (→ Haiku).
export async function poolClasificar(env, systemPrompt, mensaje, validos, { timeoutMs = AI_POOL_TIMEOUTS.router, maxTokens = 24, uso = 'router', modelo = AI_POOL_MODELO_ROUTER } = {}, opts = {}) {
  if (!poolConfigurado(env)) return null;
  const r = await _poolChatCrudo(env, {
    messages: [{ role: 'system', content: String(systemPrompt) + SUFIJO_ROUTER_JSON }, { role: 'user', content: String(mensaje || '') }],
    maxTokens, timeoutMs, temperature: 0, modelo, json: true
  }, opts);
  if (!r.ok) { _metrica(uso, r); return null; }
  const etiqueta = normalizarEtiquetaRouter(r.texto, validos);
  if (!etiqueta) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: 'formato_invalido', ms: r.ms }, r.modelo);
    return null;
  }
  _metrica(uso, r, r.modelo);
  return { etiqueta, modelo: r.modelo, modeloRegistro: r.modeloRegistro, usage: r.usage, ms: r.ms };
}

// Router NEXUS de worker.js: espera JSON {"expert":"<nombre>","compress_history":<bool>}.
export function parsearRouterNexus(texto, expertosValidos) {
  const limpio = quitarRazonamiento(texto);
  const m = limpio.match(/\{[^{}]*\}/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch (_) { return null; }
  if (!obj || typeof obj.expert !== 'string' || !expertosValidos.includes(obj.expert)) return null;
  return { expert: obj.expert, compress_history: obj.compress_history === true };
}

export async function poolRouterNexus(env, prompt, expertosValidos, { timeoutMs = AI_POOL_TIMEOUTS.router, maxTokens = 64, uso = 'router_nexus', modelo = AI_POOL_MODELO_ROUTER } = {}, opts = {}) {
  if (!poolConfigurado(env)) return null;
  const r = await _poolChatCrudo(env, {
    messages: [{ role: 'system', content: 'Devuelve SOLO el objeto JSON pedido, sin texto adicional.' }, { role: 'user', content: String(prompt) }],
    maxTokens, timeoutMs, temperature: 0, modelo, json: true
  }, opts);
  if (!r.ok) { _metrica(uso, r); return null; }
  const parsed = parsearRouterNexus(r.texto, expertosValidos);
  if (!parsed) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: 'formato_invalido', ms: r.ms }, r.modelo);
    return null;
  }
  _metrica(uso, r, r.modelo);
  return { ...parsed, modelo: r.modelo, modeloRegistro: r.modeloRegistro, usage: r.usage, ms: r.ms };
}

// ── Herramientas del pool (contrato confirmado por la sesión del pool, 03/10/2026) ────
// Cuerpos ESTRICTOS (un campo desconocido → 422):
// POST /v1/tools/search {"query": 2–300 car., "results": 1–10, "read": 0–5, "question"}
//   → 200 {"query","results":[{"title","url","snippet",…}],"devices","took_s"}
//   results [] = sin resultados (200, no error) → aquí se trata como respaldo.
//   502 {"detail"} tras 3 intentos. read>0 tarda de decenas de s a 1–2 min: NO se usa.
// POST /v1/tools/read {"url": http(s) 8–2000, "question", "summarize": bool}
//   → 200 {"url","final_url","status","title","text","device","summary","took_s"}
//   → 200 {"url","error","device","took_s"} sin text si no pudo bajarla → fallo.
// El cliente sigue siendo tolerante con la forma de la respuesta (snippet/content/text…)
// por si el gateway evoluciona; la PETICIÓN, en cambio, solo lleva campos del contrato.
function _primerTexto(obj, campos) {
  for (const c of campos) {
    const v = obj && obj[c];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function normalizarResultadosBusqueda(data, maxResultados = 5) {
  const lista = Array.isArray(data) ? data
    : Array.isArray(data && data.results) ? data.results
    : Array.isArray(data && data.data) ? data.data
    : Array.isArray(data && data.items) ? data.items
    : Array.isArray(data && data.organic) ? data.organic
    : [];
  const resultados = [];
  for (const it of lista) {
    if (!it || typeof it !== 'object') continue;
    const url = _primerTexto(it, ['url', 'link', 'href']);
    if (!/^https?:\/\//i.test(url)) continue;
    resultados.push({
      title: _primerTexto(it, ['title', 'name']).slice(0, 200),
      url: url.slice(0, 500),
      content: _primerTexto(it, ['content', 'snippet', 'text', 'description', 'body']).slice(0, 500)
    });
    if (resultados.length >= maxResultados) break;
  }
  const answer = Array.isArray(data) ? '' : _primerTexto(data, ['answer', 'summary']).slice(0, 1500);
  return { answer, resultados };
}

export async function poolBuscar(env, query, { maxResultados = 5, timeoutMs = AI_POOL_TIMEOUTS.search, uso = 'search' } = {}, opts = {}) {
  const q = typeof query === 'string' ? query.trim().slice(0, 300).trim() : '';
  if (q.length < 2 || !poolConfigurado(env)) return null;
  const n = Math.min(10, Math.max(1, Math.trunc(maxResultados) || 5));
  const r = await _postPool(env, '/v1/tools/search', { query: q, results: n }, timeoutMs, opts);
  if (!r.ok) { _metrica(uso, r); return null; }
  if (r.data && r.data.error) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: _codigoError(r.data) || 'error_en_cuerpo', ms: r.ms }, 'tools/search');
    return null;
  }
  const norm = normalizarResultadosBusqueda(r.data, maxResultados);
  if (!norm.resultados.length && !norm.answer) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: 'sin_resultados', ms: r.ms }, 'tools/search');
    return null;
  }
  _registrarExito();
  _metrica(uso, r, 'tools/search');
  return { ...norm, ms: r.ms };
}

export async function poolLeer(env, url, { maxChars = 4000, timeoutMs = AI_POOL_TIMEOUTS.read, uso = 'read' } = {}, opts = {}) {
  const u = typeof url === 'string' ? url.trim() : '';
  if (!/^https?:\/\//i.test(u) || u.length < 8 || u.length > 2000 || !poolConfigurado(env)) return null;
  // summarize:false → sin pasada de LLM en el pool: solo el texto de la página (más rápido).
  const r = await _postPool(env, '/v1/tools/read', { url: u, summarize: false }, timeoutMs, opts);
  if (!r.ok) { _metrica(uso, r); return null; }
  const d = r.data || {};
  const texto = d.error ? '' : _primerTexto(d, ['text', 'summary', 'content', 'markdown', 'body']);
  if (!texto) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: d.error ? (_codigoError(d) || 'error_en_cuerpo') : 'sin_texto', ms: r.ms }, 'tools/read');
    return null;
  }
  _registrarExito();
  _metrica(uso, r, 'tools/read');
  return { url: u, titulo: _primerTexto(d, ['title', 'name']).slice(0, 200), texto: texto.slice(0, maxChars), ms: r.ms };
}

// Texto compacto para inyectar como contexto (mismo papel que el resumen de gpt-4o-mini).
export function formatearBusquedaPool(query, busqueda, lectura = null, maxChars = 2000) {
  const partes = [];
  if (busqueda && busqueda.answer) partes.push(busqueda.answer);
  for (const [i, r] of ((busqueda && busqueda.resultados) || []).entries()) {
    partes.push(`${i + 1}. ${r.title || r.url}\n${r.content || ''}\nFuente: ${r.url}`.trim());
  }
  if (lectura && lectura.texto) partes.push(`Extracto de ${lectura.url}:\n${lectura.texto}`);
  const texto = partes.join('\n\n').trim();
  return (texto || `Sin resultados para: "${query}"`).substring(0, maxChars);
}
