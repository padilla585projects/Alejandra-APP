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

// Modelo del pool (03/10/2026): `alejandra:1.0`, un ALIAS propio que mantiene la sesión del
// pool y que aparece en /openai/v1/models con "resolves_to". Hoy resuelve a qwen3.6:35b-a3b
// (maneja tools formato OpenAI); si ese no está cargado, a prisma:1.0 (rápido y bueno en JSON,
// pero NO devuelve tool_calls). Todos los usos (router, experto simple, crons, resumen,
// respaldo de Anthropic, reescritura de la consulta de búsqueda) piden este alias: qué hay
// detrás lo decide el pool con los datos del banco de casos (scripts/ai-benchmark/
// casos-alejandra.json), sin tocar código aquí. La cabecera de respuesta X-AI-Pool-Model dice
// qué modelo REAL respondió; se registra en la métrica y en alejandra_token_uso.
// Override opcional `env.AI_POOL_MODEL` (variable de texto del panel, no secreto) para fijar
// otro modelo sin desplegar; un valor con caracteres raros se ignora (se usa el alias).
export const AI_POOL_MODELO = 'alejandra:1.0';
// Modelos concretos medibles directamente en el benchmark (no se usan en producción).
export const AI_POOL_MODELOS_ALTERNATIVOS = ['qwen3.6:35b-a3b', 'prisma:1.0', 'gemma4:e4b'];
// Cabecera con el modelo real que respondió (la pone el gateway del pool).
export const AI_POOL_CABECERA_MODELO = 'X-AI-Pool-Model';

export function modeloPool(env) {
  const v = env && typeof env.AI_POOL_MODEL === 'string' ? env.AI_POOL_MODEL.trim() : '';
  return /^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/.test(v) ? v : AI_POOL_MODELO;
}

// Modelos del pool que NO devuelven tool_calls (prisma:1.0 los ignora). Con uno de ellos no se
// mandan tools, y si el alias resolvió a uno de ellos (cabecera X-AI-Pool-Model) en una
// petición con tools y no hay tool_calls, la respuesta no vale → respaldo.
export function modeloPoolSinTools(nombre) {
  return /^prisma[:\-]/i.test(String(nombre || ''));
}

// Interruptor suave de razonamiento de Qwen3: para qwen3* y para el alias (que hoy resuelve a
// qwen3.6). Si resuelve a prisma, el «/no_think» final es una línea inocua más del prompt.
function _admiteNoThink(nombre) {
  return /^(qwen3|alejandra)/i.test(String(nombre || ''));
}

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
  read: 15000,     // /v1/tools/read de una sola página
  documento: 15000 // /v1/tools/document (0,2–0,5 s en CPU; margen para PDF grandes)
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

// (3) Opcional: Workers Analytics Engine (NO es D1). Si el worker tiene el binding
// `AI_POOL_AE` (ver alejandra-agente/wrangler.toml), cada uso del pool escribe un punto con
// SOLO metadatos: blobs = [uso, resultado, motivo, modelo pedido, modelo real, worker],
// doubles = [ms (-1 si no hay), 1], indexes = [uso]. Sin binding no hace nada. Se lee con
// scripts/ai-benchmark/metricas-produccion.mjs --fuente ae (SQL API de Analytics Engine).
let _sumideroAE = null;
let _sumideroWorker = '';
export function fijarSumideroMetricasPool(dataset, worker = '') {
  _sumideroAE = dataset && typeof dataset.writeDataPoint === 'function' ? dataset : null;
  _sumideroWorker = String(worker || '').slice(0, 40);
}

function _escribirPuntoAE({ uso, resultado, motivo, modelo, modeloReal, ms }) {
  if (!_sumideroAE) return;
  try {
    _sumideroAE.writeDataPoint({
      blobs: [uso, resultado, motivo || '', modelo || '', modeloReal || '', _sumideroWorker].map(x => String(x).slice(0, 80)),
      doubles: [Number.isFinite(ms) ? Math.round(ms) : -1, 1],
      indexes: [String(uso).slice(0, 32)],
    });
  } catch (_) { /* las métricas nunca rompen una petición */ }
}

// `modelo` = lo que se pidió (el alias), `modeloReal` = lo que respondió según la cabecera
// X-AI-Pool-Model (o el campo `model` de la respuesta). null si no hubo respuesta del pool.
export function registrarMetricaPool({ uso = 'desconocido', resultado, motivo = '', ms = null, modelo = '', modeloReal = '' } = {}) {
  const res = resultado === 'ok' ? 'ok' : resultado === 'omitido' ? 'omitido' : 'respaldo';
  if (!_metricas.has(uso)) _metricas.set(uso, { ok: 0, respaldo: 0, omitido: 0, motivos: {}, msOk: [], msTotalOk: 0, modelosReales: {} });
  const m = _metricas.get(uso);
  m[res]++;
  if (res !== 'ok' && motivo) m.motivos[motivo] = (m.motivos[motivo] || 0) + 1;
  if (modeloReal) m.modelosReales[modeloReal] = (m.modelosReales[modeloReal] || 0) + 1;
  if (res === 'ok' && Number.isFinite(ms)) {
    m.msTotalOk += ms;
    m.msOk.push(ms);
    if (m.msOk.length > 200) m.msOk.shift(); // ventana para percentiles, memoria acotada
  }
  try {
    console.log('AIPOOL_METRICA ' + JSON.stringify({ uso, proveedor: 'ai_pool', modelo: modelo || AI_POOL_MODELO, modeloReal: modeloReal || null, resultado: res, motivo: motivo || null, ms: Number.isFinite(ms) ? Math.round(ms) : null }));
  } catch (_) {}
  _escribirPuntoAE({ uso, resultado: res, motivo: res !== 'ok' ? motivo : '', modelo: modelo || AI_POOL_MODELO, modeloReal, ms });
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
      p50MsOk: _percentil(m.msOk, 0.5), p95MsOk: _percentil(m.msOk, 0.95),
      modelosReales: { ...m.modelosReales }
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

// Modelo real según la cabecera X-AI-Pool-Model ('' si no viene o no hay cabeceras).
function _modeloDeCabecera(resp) {
  try {
    const h = resp && resp.headers;
    const v = h && typeof h.get === 'function' ? h.get(AI_POOL_CABECERA_MODELO) : '';
    return normalizarNombreModeloPool(v || '');
  } catch (_) { return ''; }
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
// Devuelve { ok:true, data, ms, modeloCabecera } o
// { ok:false, motivo, ms?, status?, codigo?, omitido?, modeloCabecera? }.
// `opts.estadosSinFallo`: estados HTTP que NO cuentan para el circuito (p. ej. 422 de
// /v1/tools/document = el pool funciona, el que no vale es el fichero).
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
    const modeloCabecera = _modeloDeCabecera(resp);
    if (!resp.ok) {
      const codigo = _codigoError(data);
      const sinFallo = Array.isArray(opts.estadosSinFallo) && opts.estadosSinFallo.includes(resp.status);
      if (!sinFallo) _registrarFallo();
      return { ok: false, motivo: AI_POOL_ERRORES_RAPIDOS.has(codigo) ? codigo : 'http_' + resp.status, status: resp.status, codigo, ms, modeloCabecera };
    }
    if (!data || typeof data !== 'object') {
      _registrarFallo();
      return { ok: false, motivo: 'json_invalido', ms, modeloCabecera };
    }
    return { ok: true, data, ms, modeloCabecera };
  } catch (e) {
    _registrarFallo();
    return { ok: false, motivo: e && e.name === 'AbortError' ? 'timeout' : 'red', ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

// Emite la métrica de un intento. Los «no configurado» no se registran: con el pool
// apagado no hay ni una línea de log nueva.
// `modelo` = lo pedido; el modelo real sale del resultado (cabecera o campo `model`).
function _metrica(uso, r, modelo) {
  if (r.motivo === 'no_configurado' || r.motivo === 'sin_mensajes') return;
  registrarMetricaPool({
    uso, resultado: r.ok ? 'ok' : (r.omitido ? 'omitido' : 'respaldo'), motivo: r.ok ? '' : r.motivo, ms: r.ms,
    modelo: modelo || r.modeloPedido || '', modeloReal: r.modeloReal || r.modeloCabecera || ''
  });
}

// El campo `model` de la respuesta es el NOMBRE del modelo («prisma:1.0») desde el 03/10/2026;
// antes el gateway podía devolver una ruta de fichero. Se acepta cualquiera de las dos formas:
// de una ruta («/models/prisma-1.0.gguf», «C:\\m\\x.gguf») se queda el último segmento sin la
// extensión .gguf; un nombre normal (con «:» o «/» de organización, p. ej. «org/modelo») se
// deja tal cual salvo que empiece por «/» o lleve «\\». Vacío o no-texto → '' (usa el pedido).
export function normalizarNombreModeloPool(valor) {
  if (typeof valor !== 'string') return '';
  let m = valor.trim();
  if (!m) return '';
  if (m.startsWith('/') || m.includes('\\') || /\.gguf$/i.test(m)) {
    const partes = m.split(/[\\/]+/).filter(Boolean);
    m = (partes.length ? partes[partes.length - 1] : '').replace(/\.gguf$/i, '');
  }
  return m.slice(0, 80);
}

// qwen3 puede devolver su razonamiento entre <think>…</think> dentro de content.
export function quitarRazonamiento(texto) {
  if (typeof texto !== 'string') return '';
  return texto.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*?<\/think>/i, '').trim();
}

// Chat compatible OpenAI sin métrica (la emite quien lo llama). Sin `modelo` explícito se
// pide modeloPool(env) (el alias alejandra:1.0 o el override AI_POOL_MODEL).
async function _poolChatCrudo(env, { messages, maxTokens = 512, tools, timeoutMs = AI_POOL_TIMEOUTS.simple, sinRazonamiento = true, temperature, modelo, json = false } = {}, opts = {}) {
  const modeloPedido = (typeof modelo === 'string' && modelo.trim()) ? modelo.trim() : modeloPool(env);
  if (!Array.isArray(messages) || !messages.length) return { ok: false, motivo: 'sin_mensajes', omitido: true, modeloPedido };
  let msgs = messages;
  // Interruptor suave de Qwen3 para no gastar tokens/latencia en razonamiento (a confirmar
  // con la sesión del pool: si el gateway ya lo desactiva, es inocuo).
  if (sinRazonamiento && _admiteNoThink(modeloPedido)) {
    const i = msgs.findIndex(m => m && m.role === 'system');
    if (i >= 0 && typeof msgs[i].content === 'string') {
      msgs = msgs.slice();
      msgs[i] = { ...msgs[i], content: msgs[i].content + '\n/no_think' };
    }
  }
  // Cuerpo mínimo: el pool rechaza campos desconocidos (422) y no admite streaming
  // (stream:true → 400), así que no se manda `stream` ni `tool_choice` (auto por defecto).
  const body = { model: modeloPedido, messages: msgs, max_tokens: maxTokens };
  if (typeof temperature === 'number') body.temperature = temperature;
  if (json) body.response_format = { type: 'json_object' };
  const conTools = Array.isArray(tools) && tools.length > 0;
  if (conTools) {
    // Un modelo que se sabe sin tools (prisma) ni se intenta: respaldo directo.
    if (modeloPoolSinTools(modeloPedido)) return { ok: false, motivo: 'modelo_sin_tools', omitido: true, modeloPedido };
    body.tools = tools;
  }
  const r = await _postPool(env, '/openai/v1/chat/completions', body, timeoutMs, opts);
  if (!r.ok) return { ...r, modeloPedido, modeloReal: r.modeloCabecera || '' };
  const data = r.data;
  // Modelo REAL: la cabecera X-AI-Pool-Model manda (el campo `model` puede repetir el alias).
  const modeloReal = r.modeloCabecera || normalizarNombreModeloPool(data.model) || modeloPedido;
  if (data.error) {
    _registrarFallo();
    const codigo = _codigoError(data);
    return { ok: false, motivo: AI_POOL_ERRORES_RAPIDOS.has(codigo) ? codigo : 'error_en_cuerpo', codigo, ms: r.ms, modeloPedido, modeloReal };
  }
  const mensaje = data.choices && data.choices[0] && data.choices[0].message;
  const texto = quitarRazonamiento(mensaje && mensaje.content);
  const toolCalls = mensaje && Array.isArray(mensaje.tool_calls) ? mensaje.tool_calls.filter(tc => tc && tc.function && tc.function.name) : [];
  if (!mensaje || (!texto && !toolCalls.length)) {
    _registrarFallo();
    return { ok: false, motivo: 'respuesta_vacia', ms: r.ms, modeloPedido, modeloReal };
  }
  // El alias resolvió a un modelo sin tools (p. ej. prisma:1.0) en una petición CON tools y no
  // hay tool_calls: su texto no ha podido consultar nada (riesgo de inventar datos) → respaldo.
  // El pool sí respondió, así que no cuenta para el circuito.
  if (conTools && !toolCalls.length && modeloPoolSinTools(modeloReal)) {
    return { ok: false, motivo: 'modelo_real_sin_tools', ms: r.ms, modeloPedido, modeloReal };
  }
  _registrarExito();
  return {
    ok: true,
    ms: r.ms,
    mensaje: { ...mensaje, content: texto, tool_calls: toolCalls.length ? toolCalls : undefined },
    texto,
    toolCalls,
    modelo: modeloReal,
    modeloPedido,
    modeloReal,
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
  _metrica(params.uso || 'chat', r, r.modeloPedido);
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
export async function poolClasificar(env, systemPrompt, mensaje, validos, { timeoutMs = AI_POOL_TIMEOUTS.router, maxTokens = 24, uso = 'router', modelo } = {}, opts = {}) {
  if (!poolConfigurado(env)) return null;
  const r = await _poolChatCrudo(env, {
    messages: [{ role: 'system', content: String(systemPrompt) + SUFIJO_ROUTER_JSON }, { role: 'user', content: String(mensaje || '') }],
    maxTokens, timeoutMs, temperature: 0, modelo, json: true
  }, opts);
  if (!r.ok) { _metrica(uso, r); return null; }
  const etiqueta = normalizarEtiquetaRouter(r.texto, validos);
  if (!etiqueta) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: 'formato_invalido', ms: r.ms, modeloPedido: r.modeloPedido, modeloReal: r.modeloReal });
    return null;
  }
  _metrica(uso, r);
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

export async function poolRouterNexus(env, prompt, expertosValidos, { timeoutMs = AI_POOL_TIMEOUTS.router, maxTokens = 64, uso = 'router_nexus', modelo } = {}, opts = {}) {
  if (!poolConfigurado(env)) return null;
  const r = await _poolChatCrudo(env, {
    messages: [{ role: 'system', content: 'Devuelve SOLO el objeto JSON pedido, sin texto adicional.' }, { role: 'user', content: String(prompt) }],
    maxTokens, timeoutMs, temperature: 0, modelo, json: true
  }, opts);
  if (!r.ok) { _metrica(uso, r); return null; }
  const parsed = parsearRouterNexus(r.texto, expertosValidos);
  if (!parsed) {
    _registrarFallo();
    _metrica(uso, { ok: false, motivo: 'formato_invalido', ms: r.ms, modeloPedido: r.modeloPedido, modeloReal: r.modeloReal });
    return null;
  }
  _metrica(uso, r);
  return { ...parsed, modelo: r.modelo, modeloRegistro: r.modeloRegistro, usage: r.usage, ms: r.ms };
}

// ── Herramientas del pool (contrato confirmado por la sesión del pool, 03/10/2026) ────
// Cuerpos ESTRICTOS (un campo desconocido → 422):
// POST /v1/tools/search {"query": 2–300 car., "results": 1–10, "read": 0–5, "question",
//   "since": "day"|"week"|"month"|"year" (opcional, filtro de fecha de DuckDuckGo, 03/10/2026)}
//   → 200 {"query","results":[{"title","url","snippet",…}],"devices","took_s"}
//   El cliente solo manda {query, results} y, si hay filtro válido, `since`.
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

export async function poolBuscar(env, query, { maxResultados = 5, timeoutMs = AI_POOL_TIMEOUTS.search, uso = 'search', since = null } = {}, opts = {}) {
  const q = typeof query === 'string' ? query.trim().slice(0, 300).trim() : '';
  if (q.length < 2 || !poolConfigurado(env)) return null;
  const n = Math.min(10, Math.max(1, Math.trunc(maxResultados) || 5));
  // Cuerpo estricto: `since` solo si es uno de los valores del contrato (si no, ni se manda).
  const cuerpo = { query: q, results: n };
  if (AI_POOL_SINCE_VALIDOS.includes(since)) cuerpo.since = since;
  const r = await _postPool(env, '/v1/tools/search', cuerpo, timeoutMs, opts);
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

// ── Consulta corta para /v1/tools/search (03/10/2026) ────────────────────────────────
// QA real: «Busca en internet cuál es la última versión estable de Node.js y dime solo el
// número.» se mandaba ENTERA como query (el router pone query_web = el mensaje recortado y el
// modelo a veces pasa la frase tal cual) y DuckDuckGo devolvía una versión obsoleta. Con
// «Node.js latest LTS version» el primer resultado es el correcto. Antes de buscar en el pool
// se convierte la petición en palabras clave (modelo del pool en modo JSON, timeout corto) y se
// decide el filtro de fecha `since`; si la reescritura falla, respaldo determinista sin IA.
// Solo afecta a la búsqueda del POOL: los respaldos (gpt-4o-mini, Tavily) reciben la petición
// original (ver los llamadores).
export const AI_POOL_SINCE_VALIDOS = ['day', 'week', 'month', 'year'];
export const AI_POOL_TIMEOUT_CONSULTA = 4000;
const _CONSULTA_MAX_PALABRAS = 10;      // respaldo determinista
const _CONSULTA_CORTA_PALABRAS = 6;     // ≤6 palabras y sin muletillas → no se reescribe
const _CONSULTA_IA_MAX_PALABRAS = 12;   // validación de la salida del modelo
const _CONSULTA_IA_MAX_CHARS = 120;

function _plegar(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Frases de petición que no aportan nada a un buscador (comparadas sin tildes ni mayúsculas).
// Se quitan primero las más largas.
const _MULETILLAS = [
  'busca en internet', 'buscar en internet', 'buscame en internet', 'busca en la web',
  'busca en google', 'busca por internet', 'mira en internet', 'consulta en internet',
  'dime solo el numero', 'dime solo la version', 'dime solo', 'solo el numero',
  'me puedes decir', 'puedes decirme', 'podrias decirme', 'me podrias decir', 'me dices',
  'quiero saber', 'necesito saber', 'me gustaria saber', 'por favor',
  'en internet', 'en la web', 'en google',
  'cual es', 'cuales son', 'que es', 'cual', 'cuales',
  'buscame', 'busca', 'buscar', 'busques', 'investiga', 'averigua', 'dime', 'dimelo',
  'puedes', 'podrias', 'sabes', 'porfa', 'gracias', 'oye', 'hola', 'alejandra'
].map(f => f.split(' ')).sort((a, b) => b.length - a.length);

const _VACIAS = new Set(['el', 'la', 'los', 'las', 'lo', 'un', 'una', 'unos', 'unas', 'de', 'del',
  'al', 'a', 'y', 'o', 'e', 'u', 'en', 'con', 'por', 'para', 'me', 'te', 'se', 'mi', 'tu', 'su',
  'que', 'es', 'son', 'solo', 'ahora', 'dice', 'dicen', 'sobre', 'como', 'the', 'of', 'and', 'please', 'tell', 'me', 'search', 'for']);

function _tokensConsulta(texto) {
  return String(texto || '')
    .replace(/[¿?¡!"«»“”‘’()[\]{}:;,]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^[.'`´\-]+|[.'`´]+$/g, ''))
    .filter(Boolean);
}

// Quita las muletillas de una lista de tokens. Devuelve { tokens, quitadas }.
function _quitarMuletillas(tokens) {
  const plegados = tokens.map(_plegar);
  const fuera = new Array(tokens.length).fill(false);
  let quitadas = 0;
  for (const frase of _MULETILLAS) {
    for (let i = 0; i + frase.length <= tokens.length; i++) {
      if (fuera[i]) continue;
      let coincide = true;
      for (let j = 0; j < frase.length; j++) {
        if (fuera[i + j] || plegados[i + j] !== frase[j]) { coincide = false; break; }
      }
      if (coincide) {
        for (let j = 0; j < frase.length; j++) fuera[i + j] = true;
        quitadas++;
      }
    }
  }
  return { tokens: tokens.filter((_, i) => !fuera[i]), quitadas };
}

// Heurística de `since` por palabras clave (sin IA). null si la petición no es temporal.
export function sinceHeuristico(texto, { ahora = new Date() } = {}) {
  const t = ' ' + _plegar(texto).replace(/[^a-z0-9ñ.\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  const hay = (lista) => lista.some(p => t.includes(' ' + p + ' '));
  if (hay(['noticias', 'noticia', 'hoy', 'ayer', 'esta semana', 'ultima hora', 'news', 'today', 'yesterday', 'this week'])) return 'month';
  if (hay(['ultima version', 'ultimas versiones', 'ultimo', 'ultima', 'ultimos', 'ultimas', 'actual',
    'actuales', 'actualmente', 'vigente', 'vigentes', 'precio', 'precios', 'cuesta', 'cuestan',
    'reciente', 'recientes', 'latest', 'current', 'newest', 'price', 'prices'])) return 'year';
  const anio = (ahora instanceof Date && !isNaN(ahora)) ? ahora.getFullYear() : new Date().getFullYear();
  const anios = (t.match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  if (anios.some(a => a >= anio)) return 'year';
  return null;
}

// ¿Merece la pena reescribirla? Más de 6 palabras o con muletillas de petición.
export function consultaNecesitaReescritura(texto) {
  const tokens = _tokensConsulta(texto);
  if (!tokens.length) return false;
  if (tokens.length > _CONSULTA_CORTA_PALABRAS) return true;
  return _quitarMuletillas(tokens).quitadas > 0;
}

// Respaldo determinista sin IA: sin muletillas ni signos, sin palabras vacías, ≤10 palabras.
// Conserva el idioma original (no traduce). Si no queda nada útil, devuelve el texto tal cual.
export function consultaBusquedaHeuristica(texto, { ahora = new Date() } = {}) {
  const original = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  const { tokens } = _quitarMuletillas(_tokensConsulta(original));
  const utiles = tokens.filter(w => !_VACIAS.has(_plegar(w)));
  let query = utiles.slice(0, _CONSULTA_MAX_PALABRAS).join(' ').trim();
  if (query.length < 2) query = original;
  return { query, since: sinceHeuristico(original, { ahora }) };
}

// Validación ESTRICTA de la salida del modelo: un objeto JSON con `query` (texto de 2–120
// caracteres, ≤12 palabras, una línea) y `since` opcional (null o uno de los valores del
// contrato). Cualquier otra clave, tipo o valor → null (respaldo determinista).
export function validarConsultaReescrita(texto) {
  const crudo = quitarRazonamiento(texto);
  if (!/^\s*\{[\s\S]*\}\s*$/.test(crudo)) return null;
  let obj;
  try { obj = JSON.parse(crudo); } catch (_) { return null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const claves = Object.keys(obj);
  if (!claves.includes('query') || claves.some(c => c !== 'query' && c !== 'since')) return null;
  if (typeof obj.query !== 'string' || /[\r\n]/.test(obj.query)) return null;
  const query = obj.query.replace(/\s+/g, ' ').replace(/[¿?¡!]+/g, '').trim();
  if (query.length < 2 || query.length > _CONSULTA_IA_MAX_CHARS) return null;
  if (query.split(' ').length > _CONSULTA_IA_MAX_PALABRAS) return null;
  const s = obj.since;
  let since = null;
  if (s === null || s === undefined) since = null;
  else if (typeof s === 'string' && AI_POOL_SINCE_VALIDOS.includes(s)) since = s;
  else return null;
  return { query, since };
}

export function systemConsultaBusqueda(ahora = new Date()) {
  const hoy = (ahora instanceof Date && !isNaN(ahora) ? ahora : new Date()).toISOString().slice(0, 10);
  return [
    'Conviertes la petición de un usuario en UNA consulta corta para un buscador web (DuckDuckGo).',
    'Reglas:',
    '- Entre 2 y 8 palabras clave. Sin muletillas («busca en internet», «dime», «por favor»), sin signos de pregunta.',
    '- En INGLÉS si el tema es técnico: software, versiones, programación, hardware, normas internacionales (IEC, ISO, IEEE).',
    '- En ESPAÑOL si el tema es local de España: empresas, normativa española (REBT, ITC-BT, BOE, CTE), precios en España, organismos, lugares.',
    '- Conserva tal cual nombres propios, códigos, referencias y números.',
    '- "since": "year" si pide lo último, lo actual, lo vigente, un precio o una versión; "month" si pide noticias, algo de hoy o de esta semana; null si no es temporal.',
    `Fecha de hoy: ${hoy}.`,
    'Ejemplo: «Busca en internet cuál es la última versión estable de Node.js y dime solo el número.» → {"query":"Node.js latest LTS version","since":"year"}',
    'Ejemplo: «¿Qué dice la ITC-BT-19 sobre la caída de tensión?» → {"query":"ITC-BT-19 caída de tensión","since":null}',
    'Devuelve SOLO un objeto JSON con la forma {"query":"...","since":null}, sin ninguna otra clave.'
  ].join('\n');
}

// Prepara la consulta para /v1/tools/search. Nunca lanza. Devuelve
// { query, since, fuente: 'original' | 'ai_pool' | 'heuristica' }.
// - Consulta ya corta (≤6 palabras, sin muletillas) → se usa tal cual, sin llamar al pool
//   (el `since` sale de la heurística: «precio cobre hoy» sigue llevando filtro).
// - Pool no disponible, timeout, error o salida inválida → heurística determinista.
// Métrica: uso 'buscar_web_consulta' (ok / respaldo + motivo / omitido, ms). Nunca contenido.
export async function prepararConsultaBusqueda(env, texto, { timeoutMs = AI_POOL_TIMEOUT_CONSULTA, uso = 'buscar_web_consulta', ahora = new Date() } = {}, opts = {}) {
  const original = typeof texto === 'string' ? texto.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  if (!original) return { query: '', since: null, fuente: 'original' };
  if (!consultaNecesitaReescritura(original)) {
    if (poolConfigurado(env)) registrarMetricaPool({ uso, resultado: 'omitido', motivo: 'consulta_corta', modelo: modeloPool(env) });
    return { query: original, since: sinceHeuristico(original, { ahora }), fuente: 'original' };
  }
  const heuristica = { ...consultaBusquedaHeuristica(original, { ahora }), fuente: 'heuristica' };
  if (!poolConfigurado(env)) return heuristica;
  const r = await _poolChatCrudo(env, {
    messages: [{ role: 'system', content: systemConsultaBusqueda(ahora) }, { role: 'user', content: original }],
    maxTokens: 60, timeoutMs, temperature: 0, json: true
  }, opts);
  if (!r.ok) { _metrica(uso, r); return heuristica; }
  const valida = validarConsultaReescrita(r.texto);
  if (!valida) {
    // El pool respondió (no se abre el circuito): solo la salida no sirve.
    _metrica(uso, { ok: false, motivo: 'formato_invalido', ms: r.ms, modeloPedido: r.modeloPedido, modeloReal: r.modeloReal });
    return heuristica;
  }
  _metrica(uso, r);
  return { ...valida, fuente: 'ai_pool' };
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

// ── Lectura de documentos: POST /v1/tools/document (POOL-DOCUMENTOS-01, 03/10/2026) ─────
// Contrato de la sesión del pool (cuerpo ESTRICTO, campo desconocido → 422):
//   {"filename":"albaran.pdf","data":"<base64>"} (≤20 MB) o {"object_id":"obj_…"};
//   "max_chars" opcional (1000–200000). Formatos: PDF con texto, .xlsx (valores), .docx, CSV
//   y texto. Respuesta {"type","pages","text" (Markdown con tablas),"tables":[{"page","rows"}],
//   "sheets":[{"name","rows"}],"needs_ocr":[páginas escaneadas sin texto],"truncated","chars",
//   "took_s"}; 0,2–0,5 s en CPU; 422 con motivo ante error.
// El pool NO hace OCR. Regla (ADR-0028 §Documentos):
//   - Imágenes (fotos de albaranes, partes, matrículas…) NUNCA pasan por aquí: siguen con
//     Gemini/Cloud Vision como siempre (tipoDocumentoPool devuelve null, cero llamadas).
//   - Si la respuesta trae `needs_ocr` no vacío (alguna o todas las páginas escaneadas) o el
//     texto sale vacío/corto, se devuelve null y el llamador manda EL DOCUMENTO ENTERO por el
//     camino de siempre (Gemini…). No se trocea por páginas: los Workers no tienen librería
//     para partir un PDF y un documento mezclado leído por dos vías daría un texto con huecos
//     o duplicado; lo sencillo y correcto es todo o nada.
//   - >20 MB → directo al respaldo, sin llamar.
// Métrica AIPOOL_METRICA uso 'documento' (ok / respaldo + motivo / omitido), sin contenido.
// El cliente solo usa la variante `data` (base64): `object_id` exigiría subir antes el fichero
// al almacén del pool, que hoy no se usa.
export const AI_POOL_DOCUMENTO_MAX_BYTES = 20 * 1024 * 1024;
export const AI_POOL_DOCUMENTO_MIN_CHARS = 20;          // menos texto útil que esto = «corto»
export const AI_POOL_DOCUMENTO_MAX_CHARS = [1000, 200000];
const _EXT_IMAGEN = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff', 'svg']);
const _MIME_DOCUMENTO = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/csv': 'csv',
  'text/plain': 'txt'
};
const _EXT_DOCUMENTO = { pdf: 'pdf', xlsx: 'xlsx', docx: 'docx', csv: 'csv', txt: 'txt' };

// ¿Puede leerlo el pool? Devuelve 'pdf'|'xlsx'|'docx'|'csv'|'txt' o null. Cualquier imagen
// (por MIME o por extensión), vídeo o audio → null. .xls (binario antiguo) → null.
export function tipoDocumentoPool(filename, mime) {
  const m = String(mime || '').toLowerCase().split(';')[0].trim();
  if (/^(image|video|audio)\//.test(m)) return null;
  const nombre = String(filename || '').toLowerCase();
  const ext = (nombre.match(/\.([a-z0-9]{1,5})$/) || [])[1] || '';
  if (_EXT_IMAGEN.has(ext)) return null;
  if (_MIME_DOCUMENTO[m]) return _MIME_DOCUMENTO[m];
  return _EXT_DOCUMENTO[ext] || null;
}

// Nombre que se manda al pool: solo el último segmento de la ruta (nunca la ruta R2 con el
// id de usuario/empresa), caracteres seguros y con la extensión del tipo para que el pool
// detecte el formato aunque la key no la lleve.
export function nombreDocumentoPool(filename, tipo) {
  const base = String(filename || '').split(/[\\/]+/).filter(Boolean).pop() || 'documento';
  let n = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(-120) || 'documento';
  if (tipo && !n.toLowerCase().endsWith('.' + tipo)) n = n.slice(0, 115) + '.' + tipo;
  return n;
}

function _bytesABase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function _bytesDeBase64(b64) {
  const limpio = b64.replace(/\s+/g, '');
  const relleno = limpio.endsWith('==') ? 2 : limpio.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(limpio.length * 3 / 4) - relleno);
}

// Lee un documento con el pool. `bytes` (Uint8Array/ArrayBuffer) o `base64`. Devuelve
// { tipo, paginas, texto, tablas, hojas, truncado, caracteres, ms } o null (= respaldo).
// Nunca lanza.
export async function poolLeerDocumento(env, { filename = '', mime = '', bytes = null, base64 = null, maxChars = 50000, timeoutMs = AI_POOL_TIMEOUTS.documento, uso = 'documento' } = {}, opts = {}) {
  try {
    const tipo = tipoDocumentoPool(filename, mime);
    if (!tipo || !poolConfigurado(env)) return null;
    let u8 = null;
    if (bytes instanceof Uint8Array) u8 = bytes;
    else if (bytes instanceof ArrayBuffer) u8 = new Uint8Array(bytes);
    const b64 = !u8 && typeof base64 === 'string' ? base64 : null;
    const tamano = u8 ? u8.length : b64 ? _bytesDeBase64(b64) : 0;
    if (!tamano) return null;
    if (tamano > AI_POOL_DOCUMENTO_MAX_BYTES) {
      registrarMetricaPool({ uso, resultado: 'omitido', motivo: 'demasiado_grande', modelo: 'tools/document' });
      return null;
    }
    const [minC, maxC] = AI_POOL_DOCUMENTO_MAX_CHARS;
    const max = Math.min(maxC, Math.max(minC, Math.trunc(Number(maxChars)) || 50000));
    const cuerpo = { filename: nombreDocumentoPool(filename, tipo), data: u8 ? _bytesABase64(u8) : b64.replace(/\s+/g, ''), max_chars: max };
    const r = await _postPool(env, '/v1/tools/document', cuerpo, timeoutMs, { ...opts, estadosSinFallo: [422] });
    if (!r.ok) { _metrica(uso, r, 'tools/document'); return null; }
    const d = r.data || {};
    if (d.error) {
      _registrarFallo();
      _metrica(uso, { ok: false, motivo: _codigoError(d) || 'error_en_cuerpo', ms: r.ms }, 'tools/document');
      return null;
    }
    // A partir de aquí el pool HA respondido bien: un escaneo o un documento vacío no es un
    // fallo del pool (no abre el circuito), solo un documento que necesita otra vía.
    _registrarExito();
    const texto = typeof d.text === 'string' ? d.text.trim() : '';
    if (Array.isArray(d.needs_ocr) && d.needs_ocr.length) {
      _metrica(uso, { ok: false, motivo: 'needs_ocr', ms: r.ms }, 'tools/document');
      return null;
    }
    if (texto.replace(/\s+/g, '').length < AI_POOL_DOCUMENTO_MIN_CHARS) {
      _metrica(uso, { ok: false, motivo: texto ? 'texto_corto' : 'sin_texto', ms: r.ms }, 'tools/document');
      return null;
    }
    _metrica(uso, r, 'tools/document');
    return {
      tipo: typeof d.type === 'string' && d.type ? d.type : tipo,
      paginas: Number.isFinite(d.pages) ? d.pages : null,
      texto: texto.slice(0, max),
      tablas: Array.isArray(d.tables) ? d.tables : [],
      hojas: Array.isArray(d.sheets) ? d.sheets : [],
      truncado: d.truncated === true || texto.length > max,
      caracteres: Number.isFinite(d.chars) ? d.chars : texto.length,
      ms: r.ms
    };
  } catch (_) {
    return null;
  }
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
