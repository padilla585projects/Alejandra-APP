// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo, NEXUS router, prompts dinámicos
// URL: alejandra-agente.alejandra-app.workers.dev
// Versión: v5.89 (PHASE 2A — prompts modulares, optimización tokens)
// ══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const OPENAI_API    = 'https://api.openai.com/v1/responses';
const MODEL_ROUTER  = 'claude-haiku-4-5';   // Clasificador y respuestas simples
const MODEL_EXPERTO = 'claude-sonnet-4-6';  // Respuestas complejas y técnicas

// ── NEXUS MODULES — prompts dinámicos, solo los necesarios ───────────────────
// Cada módulo es independiente. El clasificador decide cuáles cargar.
// Así el system prompt nunca manda más tokens de los necesarios.

const NEXUS_MODULES = {
  base: `Eres Alejandra, agente IA autónoma para gestión industrial. Creada por Adrián Padilla (superadmin/desarrollador). Respondes siempre en español, directa y profesional. Tienes memoria de conversación, búsqueda web en tiempo real y voz bidireccional.`,

  app: `APP ALEJANDRA: gestiona bobinas de cable, equipos (PEMP, carretillas), personal, fichajes, documentos, incidencias y pedidos — sector eléctrico/mecánico, multi-empresa.
Roles: operario (lectura) · encargado (su depto) · empresa_admin (su empresa) · superadmin (todo) · desarrollador (solo Adrián).
Integraciones: Google Sheets, Telegram (@AlejandraAPP_bot), R2 (archivos), GitHub Actions (CI/CD).`,

  tecnica: `INFRAESTRUCTURA PROPIA:
- Worker: alejandra-agente.alejandra-app.workers.dev (Cloudflare Workers, ES modules)
- Worker principal: alejandra-app-api.alejandra-app.workers.dev (32+ tools, ~9400 líneas)
- BD D1: alejandra-db — tablas: chat_alejandra, alejandra_memoria, alejandra_logs, alejandra_config, alejandra_tokens
- Deploy: auto via GitHub Actions (deploy-alejandra-agente.yml) en push a main
- Repo: github.com/padilla585projects/Alejandra-APP | PWA: padilla585projects.github.io/Alejandra-APP`,

  nexus: `CÓMO FUNCIONO — NEXUS router (mis entrañas):
1. Cada msg → clasificarConHaiku() → JSON {experto, buscar_web, query_web, modulos[]}
2. Se ensambla system prompt SOLO con módulos necesarios (esta optimización)
3. simple → Haiku responde (~150 tokens prompt). complejo → Sonnet con módulos relevantes.
4. buscar_web=true → OpenAI gpt-4o-mini busca → resultado se pasa como contexto
5. Historial: 4 msgs para simple, 10 msgs para complejo — nunca más de lo necesario
SECRETS: ANTHROPIC_API_KEY (Claude) · OPENAI_API_KEY (búsqueda web)`,

  evolucion: `EVOLUCIÓN:
v5.83-85: worker principal, 32 tools, autonomía Nivel B (direct_fix, run_migration)
v5.86: PHASE 1 — worker independiente + panel admin
v5.87: API Anthropic real + memoria de chat D1
v5.88: OpenAI web search (tool use) + voz bidireccional (Web Speech API)
v5.89: NEXUS router real + prompts dinámicos por módulos (esta versión)`,

  web: `BÚSQUEDA WEB: usa buscar_web para info actual — precios materiales, normativas recientes, noticias del sector. OpenAI gpt-4o-mini realiza la búsqueda, tú procesas. Indica brevemente la fuente en la respuesta.`,

  formato: `Responde en español. Directo, sin markdown excesivo. Listas con guiones. Máx 300 palabras salvo que pidan detalle. Con Adrián (desarrollador) puedes ser más técnica.`
};

// Perfiles de experto: modelo + max_tokens + módulos a cargar
const NEXUS_EXPERTS = {
  simple:  { model: MODEL_ROUTER,  maxTokens: 400,  modules: ['base', 'formato'] },
  app:     { model: MODEL_EXPERTO, maxTokens: 800,  modules: ['base', 'app', 'formato'] },
  tecnico: { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'formato'] },
  web:     { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'web', 'formato'] },
  completo:{ model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'web', 'formato'] }
};

function buildSystemPrompt(modulos) {
  return modulos.map(m => NEXUS_MODULES[m] || '').filter(Boolean).join('\n\n');
}

// Tool de búsqueda web (solo disponible con OPENAI_API_KEY)
const TOOL_BUSCAR_WEB = {
  name: 'buscar_web',
  description: 'Busca información actualizada en internet. Úsala para precios, normativas recientes o cualquier dato que pueda haber cambiado.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Consulta de búsqueda (español o inglés según convenga)' }
    },
    required: ['query']
  }
};

// ── HTTP Handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(req, env, ctx) {
    const url  = new URL(req.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    try {
      if (path === '/health') {
        return json({ status: 'ok', version: 'v5.89', nexus: true, web_search: !!env.OPENAI_API_KEY, voice: true });
      }

      if (path === '/api/chat' && req.method === 'POST') {
        const body = await req.json();
        const { mensaje, usuario_id, empresa_id, canal, token_telegram } = body;
        if (!mensaje || !usuario_id) return json({ error: 'mensaje y usuario_id requeridos' }, 400);

        const empresa   = empresa_id || 'default';
        const contexto  = await obtenerContextoChat(env, usuario_id, empresa, 10);
        const respuesta = await procesarConNEXUS(env, mensaje, contexto, usuario_id);

        await guardarMensajeChat(env, usuario_id, empresa, mensaje, respuesta.texto, canal || 'web');
        if (respuesta.acciones?.length > 0) ctx.waitUntil(autoLearnChat(env, usuario_id, empresa, respuesta));
        if (canal === 'telegram' && token_telegram) ctx.waitUntil(enviarPorTelegram(token_telegram, respuesta.texto));

        return json(respuesta);
      }

      if (path.startsWith('/api/admin/')) {
        const adminToken = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!(await verificarAdminToken(env, adminToken))) return json({ error: 'No autorizado' }, 403);

        if (path === '/api/admin/config' && req.method === 'GET') {
          const c = await env.DB.prepare('SELECT * FROM alejandra_config ORDER BY updated_at DESC LIMIT 1').first();
          return json(c || { modo: 'autonomo', auto_fix: 1, max_iterations: 15 });
        }
        if (path === '/api/admin/config' && req.method === 'POST') {
          const { modo, auto_fix, max_iterations } = await req.json();
          await env.DB.prepare(
            `INSERT INTO alejandra_config (modo,auto_fix,max_iterations,updated_at) VALUES(?,?,?,datetime('now'))
             ON CONFLICT(id) DO UPDATE SET modo=?,auto_fix=?,max_iterations=?,updated_at=datetime('now')`
          ).bind(modo,auto_fix??1,max_iterations??15,modo,auto_fix??1,max_iterations??15).run();
          return json({ ok: true, modo });
        }
        if (path === '/api/admin/logs' && req.method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '100');
          const rows  = await env.DB.prepare('SELECT * FROM alejandra_logs ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json(rows.results || []);
        }
        if (path === '/api/admin/memoria' && req.method === 'GET') {
          const rows = await env.DB.prepare('SELECT * FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT 50').all();
          return json(rows.results || []);
        }
        if (path === '/api/admin/chat' && req.method === 'GET') {
          const uid   = url.searchParams.get('usuario_id');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const rows  = uid
            ? await env.DB.prepare('SELECT * FROM chat_alejandra WHERE usuario_id=? ORDER BY created_at DESC LIMIT ?').bind(uid,limit).all()
            : await env.DB.prepare('SELECT * FROM chat_alejandra ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json((rows.results||[]).reverse());
        }
        return json({ error: 'Ruta admin no encontrada' }, 404);
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('ERROR fetch:', err.message);
      return json({ error: err.message }, 500);
    }
  },

  // scheduled: desactivado — cuenta free tiene límite de 5 cron triggers
  // async scheduled(event, env, ctx) { ... }
};

// ══════════════════════════════════════════════════════════════════════════════
// NEXUS — Router con prompts dinámicos
// ══════════════════════════════════════════════════════════════════════════════

async function procesarConNEXUS(env, mensaje, contexto, usuario_id) {
  if (!env.ANTHROPIC_API_KEY) {
    return { texto: 'Error: ANTHROPIC_API_KEY no configurada.', acciones: [], requiere_confirmacion: false };
  }

  const config = await env.DB.prepare(
    'SELECT modo FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
  ).first().catch(() => null);
  const modo = config?.modo || 'autonomo';

  try {
    // PASO 1: Haiku clasifica — decide experto, módulos y si necesita web
    const clas = await clasificarConHaiku(env, mensaje);
    const expert = NEXUS_EXPERTS[clas.experto] || NEXUS_EXPERTS.app;
    console.log(`NEXUS: experto=${clas.experto} web=${clas.buscar_web} módulos=${expert.modules.join(',')}`);

    // PASO 2: Búsqueda web si Haiku lo decidió
    let resultadoWeb = null;
    let usoBusquedaWeb = false;
    if (clas.buscar_web && env.OPENAI_API_KEY) {
      resultadoWeb = await buscarWebOpenAI(env, clas.query_web || mensaje);
      usoBusquedaWeb = true;
      await registrarLog(env, usuario_id, 'web_search', clas.query_web, resultadoWeb.substring(0, 200));
    }

    // PASO 3: Ensamblar system prompt con SOLO los módulos necesarios
    const systemPrompt = buildSystemPrompt(expert.modules);

    // PASO 4: Construir historial — menos msgs para preguntas simples
    const limitHistorial   = clas.experto === 'simple' ? 4 : 10;
    const incluirAprendizajes = clas.experto !== 'simple';
    const messages = construirMessages(mensaje, contexto, limitHistorial, incluirAprendizajes, resultadoWeb);

    // PASO 5: Llamar al modelo apropiado
    let textoFinal = '';

    if (expert.model === MODEL_ROUTER) {
      // Haiku responde directo — sin tools, prompt mínimo
      const resp = await llamarAnthropic(env, messages, [], expert.model, expert.maxTokens, systemPrompt);
      textoFinal = resp.content?.find(b => b.type === 'text')?.text?.trim() || 'Sin respuesta';

    } else {
      // Sonnet — con tool use si no hemos buscado ya
      const tools = env.OPENAI_API_KEY && !resultadoWeb ? [TOOL_BUSCAR_WEB] : [];
      let respAPI = await llamarAnthropic(env, messages, tools, expert.model, expert.maxTokens, systemPrompt);

      // Loop tool use (máx 2 iteraciones extra)
      let iter = 0;
      while (respAPI.stop_reason === 'tool_use' && iter < 2) {
        const tb = respAPI.content.find(b => b.type === 'tool_use');
        if (!tb) break;
        const result = await buscarWebOpenAI(env, tb.input.query);
        usoBusquedaWeb = true;
        messages.push({ role: 'assistant', content: respAPI.content });
        messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tb.id, content: result }] });
        respAPI = await llamarAnthropic(env, messages, [], expert.model, expert.maxTokens, systemPrompt);
        iter++;
      }

      textoFinal = respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta';
    }

    await registrarLog(env, usuario_id, 'chat', `[${clas.experto}] ${mensaje.substring(0,80)}`, textoFinal.substring(0,200));

    return {
      texto: textoFinal,
      acciones: [],
      requiere_confirmacion: modo === 'confirmacion',
      modelo: expert.model,
      experto: clas.experto,
      busqueda_web: usoBusquedaWeb
    };

  } catch (err) {
    console.error('ERROR NEXUS:', err.message);
    return { texto: `Error: ${err.message}`, acciones: [], requiere_confirmacion: false };
  }
}

// ── Clasificador Haiku — decide experto y módulos con mínimo de tokens ────────
async function clasificarConHaiku(env, mensaje) {
  const sistema = `Clasificador de mensajes para agente IA. Responde SOLO con JSON válido.

Expertos disponibles:
- "simple": saludos, confirmaciones, preguntas triviales → usa Haiku
- "app": preguntas sobre la app, módulos, usuarios, funcionalidades → Sonnet
- "tecnico": arquitectura, código, deploy, DB, cómo funciona la IA → Sonnet
- "web": necesita info actual (precios, normativas, noticias) → Sonnet + OpenAI
- "completo": pregunta sobre sí misma, capacidades, historia → Sonnet

JSON: {"experto":"simple|app|tecnico|web|completo","buscar_web":bool,"query_web":"búsqueda optimizada en inglés o null"}

Ejemplos:
"hola" → {"experto":"simple","buscar_web":false,"query_web":null}
"qué módulos tiene la app" → {"experto":"app","buscar_web":false,"query_web":null}
"precio cable RZ1-K hoy" → {"experto":"web","buscar_web":true,"query_web":"RZ1-K cable price per meter 2025"}
"cómo funciona tu NEXUS" → {"experto":"tecnico","buscar_web":false,"query_web":null}
"quién eres y qué puedes hacer" → {"experto":"completo","buscar_web":false,"query_web":null}`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_ROUTER,
        max_tokens: 80,
        system: sistema,
        messages: [{ role: 'user', content: mensaje.substring(0, 200) }]
      })
    });

    if (!resp.ok) throw new Error(`Haiku ${resp.status}`);
    const data  = await resp.json();
    const texto = data.content?.[0]?.text?.trim() || '{}';
    const match = texto.match(/\{[^}]+\}/);
    return match ? JSON.parse(match[0]) : { experto: 'app', buscar_web: false, query_web: null };

  } catch (err) {
    console.error('ERROR clasificar:', err.message);
    return { experto: 'app', buscar_web: false, query_web: null };
  }
}

// ── Llamada a Anthropic ───────────────────────────────────────────────────────
async function llamarAnthropic(env, messages, tools, model, maxTokens, systemPrompt) {
  const body = { model, max_tokens: maxTokens, system: systemPrompt, messages };
  if (tools.length > 0) body.tools = tools;

  const resp = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${err.substring(0, 200)}`);
  }
  return resp.json();
}

// ── OpenAI — Búsqueda web ─────────────────────────────────────────────────────
async function buscarWebOpenAI(env, query) {
  try {
    const resp = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', tools: [{ type: 'web_search_preview' }], input: query })
    });

    if (!resp.ok) return `Sin resultados para: "${query}"`;
    const data = await resp.json();
    const texto = data.output
      ?.filter(b => b.type === 'message')
      ?.flatMap(m => m.content)
      ?.filter(c => c.type === 'output_text')
      ?.map(c => c.text)
      ?.join('\n') || 'Sin resultados';
    return texto.substring(0, 2000);
  } catch (err) {
    return `Error búsqueda web: ${err.message}`;
  }
}

// ── Contexto y mensajes ───────────────────────────────────────────────────────
function construirMessages(mensaje, contexto, limitHistorial = 10, incluirAprendizajes = true, resultadoWeb = null) {
  const messages = [];

  for (const item of contexto.historial.slice(-limitHistorial)) {
    if (item.mensaje)   messages.push({ role: 'user',      content: item.mensaje });
    if (item.respuesta) messages.push({ role: 'assistant', content: item.respuesta });
  }

  const partes = [];
  if (incluirAprendizajes && contexto.aprendizajes?.length > 0) {
    partes.push(`Contexto:\n${contexto.aprendizajes.map(a => `[${a.tipo}] ${a.titulo}: ${a.contenido}`).join('\n')}`);
  }
  if (resultadoWeb) partes.push(`Info actual de internet:\n${resultadoWeb}`);
  partes.push(partes.length > 0 ? `Usuario: ${mensaje}` : mensaje);

  messages.push({ role: 'user', content: partes.join('\n\n') });
  return messages;
}

async function obtenerContextoChat(env, usuario_id, empresa_id, limit = 10) {
  try {
    const historial = await env.DB.prepare(
      `SELECT mensaje,respuesta,created_at FROM chat_alejandra WHERE usuario_id=? AND empresa_id=? ORDER BY created_at DESC LIMIT ?`
    ).bind(usuario_id, empresa_id, limit).all();

    const aprendizajes = await env.DB.prepare(
      `SELECT titulo,contenido,tipo FROM alejandra_memoria WHERE empresa_id=? AND (tipo='aprendizaje' OR tipo='contexto') ORDER BY importancia DESC,created_at DESC LIMIT 5`
    ).bind(empresa_id).all();

    return { historial: (historial.results||[]).reverse(), aprendizajes: aprendizajes.results||[], usuario_id, empresa_id };
  } catch (err) {
    return { historial: [], aprendizajes: [], usuario_id, empresa_id };
  }
}

async function guardarMensajeChat(env, usuario_id, empresa_id, mensaje, respuesta, canal = 'web') {
  try {
    await env.DB.prepare(
      `INSERT INTO chat_alejandra (usuario_id,empresa_id,mensaje,respuesta,canal,created_at) VALUES(?,?,?,?,?,datetime('now'))`
    ).bind(usuario_id, empresa_id, mensaje, respuesta, canal).run();
  } catch (err) { console.error('guardarChat:', err.message); }
}

async function autoLearnChat(env, usuario_id, empresa_id, respuesta) {
  try {
    if (respuesta.acciones?.length > 0) {
      const str = respuesta.acciones.map(a => `${a.tipo}: ${a.descripcion}`).join('; ');
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (usuario_id,empresa_id,tipo,titulo,contenido,importancia,created_at) VALUES(?,?,'aprendizaje','Chat acción',?,2,datetime('now'))`
      ).bind(usuario_id, empresa_id, str).run();
    }
  } catch (err) { console.error('autoLearn:', err.message); }
}

async function registrarLog(env, usuario_id, tipo, entrada, salida) {
  try {
    await env.DB.prepare(
      `INSERT INTO alejandra_logs (usuario_id,tipo,entrada,salida,created_at) VALUES(?,?,?,?,datetime('now'))`
    ).bind(usuario_id||'system', tipo, entrada, salida).run();
  } catch (_) {}
}

// ── Auth y Telegram ───────────────────────────────────────────────────────────
async function verificarAdminToken(env, token) {
  if (!token) return false;
  try {
    const r = await env.DB.prepare('SELECT id FROM alejandra_tokens WHERE token=? AND tipo="admin" AND activo=1').bind(token).first();
    return !!r;
  } catch { return false; }
}

async function enviarPorTelegram(botToken, mensaje) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: -1002199087689, text: `Alejandra: ${mensaje}`, parse_mode: 'HTML' })
    });
  } catch (err) { console.error('Telegram:', err.message); }
}
