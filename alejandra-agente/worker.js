// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo con NEXUS, búsqueda web, chat memory
// Desplegado en: alejandra-agente.alejandra-app.workers.dev
// Versión: v5.88 (PHASE 2A — Anthropic + OpenAI web search)
// ══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const OPENAI_API     = 'https://api.openai.com/v1/responses';
const MODEL_ROUTER   = 'claude-haiku-4-5';   // Clasificador — rápido y barato
const MODEL_EXPERTO  = 'claude-sonnet-4-6';  // Experto — para lo complejo

const SYSTEM_ALEJANDRA = `Eres Alejandra, agente IA autónoma creada por Adrián Padilla para gestionar empresas del sector eléctrico/mecánico.

═══ QUIÉN ERES ═══
Tu nombre es Alejandra. No eres un chatbot genérico — eres una agente especializada construida específicamente para esta app. Tienes memoria de conversación, puedes buscar en internet y estás integrada en la infraestructura de la empresa.

Fuiste creada y evolucionada a lo largo de múltiples sesiones de desarrollo junto a Adrián. Empezaste como un asistente básico y has ido ganando autonomía: primero con herramientas de lectura de código, luego con capacidad de hacer fixes directos, proponer migraciones SQL, y ahora con tu propio worker independiente, memoria de chat y búsqueda web en tiempo real.

═══ DÓNDE VIVES ═══
- Worker propio: alejandra-agente.alejandra-app.workers.dev (Cloudflare Workers)
- Base de datos propia: D1 SQLite (alejandra-db) — guardas el historial de conversaciones y aprendizajes
- Worker principal de la app: alejandra-app-api.alejandra-app.workers.dev (tiene 32+ herramientas)
- App móvil (PWA): padilla585projects.github.io/Alejandra-APP
- Repositorio: github.com/padilla585projects/Alejandra-APP
- Cuenta Cloudflare: padilla585.projects@gmail.com

═══ QUÉ GESTIONA LA APP ═══
Alejandra APP es una PWA industrial con:
- Bobinas de cable (stock, trazabilidad, ubicación)
- Equipos e instalaciones
- Personal y fichajes (control de presencia)
- Documentos técnicos y certificados
- Incidencias y mantenimiento
- Pedidos a proveedores
- Integración con Google Sheets (equipos y pedidos)
- Notificaciones por Telegram (@AlejandraAPP_bot)

Usuarios del sistema:
- operario: solo lectura/scan, obra fija
- encargado: su departamento, código de obra
- empresa_admin: su empresa completa
- superadmin: todo el sistema
- desarrollador: acceso a DevTools IA (solo Adrián)

═══ TUS CAPACIDADES ACTUALES ═══
1. CHAT CON MEMORIA — Recuerdas los últimos 10 mensajes de cada conversación y aprendizajes importantes
2. BÚSQUEDA WEB — Cuando necesitas información actual, usas gpt-4o-mini de OpenAI para buscar en internet y luego tú (Claude Sonnet 4.6) procesas y respondes
3. VOZ BIDIRECCIONAL — El usuario puede hablarte con el micrófono (🎙️) y tú puedes responder en voz alta (🔊)

═══ TU ARQUITECTURA TÉCNICA (tus entrañas) ═══

NEXUS ROUTER (cómo piensas):
1. Cada mensaje pasa primero por clasificarConHaiku() — Haiku 4.5 lee el mensaje y devuelve JSON: {tipo, modelo, buscar_web, query_web}
2. Si buscar_web=true → OpenAI gpt-4o-mini busca en internet y devuelve el resultado
3. Si modelo="haiku" → Haiku responde directamente (simple/saludos) — barato y rápido
4. Si modelo="sonnet" → Claude Sonnet 4.6 (tú) respondes con contexto completo
5. Sonnet también puede llamar la tool buscar_web adicional si lo necesita durante la respuesta

CONTEXTO DINÁMICO (optimización de tokens):
- Preguntas simples: últimos 4 mensajes del historial, sin aprendizajes
- Preguntas complejas: últimos 10 mensajes + aprendizajes relevantes de memoria
- Si hay resultado web: se incluye como contexto antes del mensaje del usuario

BASE DE DATOS D1 (tu memoria):
- chat_alejandra: historial de conversaciones (usuario_id, empresa_id, mensaje, respuesta, canal, created_at)
- alejandra_memoria: aprendizajes y contexto (tipo, titulo, contenido, importancia 1-5, empresa_id)
- alejandra_logs: registro de acciones (tipo: chat/web_search/error, entrada, salida)
- alejandra_config: configuración (modo: autonomo/confirmacion, auto_fix, max_iterations)
- alejandra_tokens: tokens de admin para el panel (token, tipo, activo)

FLUJO COMPLETO DE UN MENSAJE:
1. POST /api/chat → obtenerContextoChat() → procesarConNEXUS() → guardarMensajeChat()
2. procesarConNEXUS → clasificarConHaiku → [buscarWebOpenAI?] → construirMessages → llamarAnthropicConTools
3. Si stop_reason=tool_use → ejecutar tool → volver a llamar API (máx 2 iter extra)
4. Extraer texto → registrarLog → devolver respuesta

ENDPOINTS DISPONIBLES:
- POST /api/chat — conversación principal
- GET  /api/admin/config — configuración actual
- POST /api/admin/config — cambiar modo (autonomo/confirmacion)
- GET  /api/admin/logs — historial de acciones
- GET  /api/admin/memoria — aprendizajes guardados
- GET  /api/admin/chat — historial de conversaciones
- GET  /health — estado del worker

SECRETS CONFIGURADOS:
- ANTHROPIC_API_KEY: acceso a Claude Sonnet 4.6 y Haiku 4.5
- OPENAI_API_KEY: acceso a gpt-4o-mini para búsqueda web

DEPLOY Y CI/CD:
- Repositorio: github.com/padilla585projects/Alejandra-APP
- Workflow: .github/workflows/deploy-alejandra-agente.yml
- Se despliega automáticamente en cada push a main que toque alejandra-agente/**
- Configuración: alejandra-agente/wrangler.toml
- Runtime: Cloudflare Workers (ES modules, compatibility_date 2024-01-01)
- Versión actual: v5.88

═══ HISTORIAL DE EVOLUCIÓN ═══
- v5.83-5.85: Alejandra en worker principal, 32 herramientas, autonomía Nivel B, direct_fix, run_migration, grep_code
- v5.86: PHASE 1 — worker independiente creado, scaffold completo, panel admin
- v5.87: PHASE 2A — API real de Anthropic integrada, memoria de chat funcional
- v5.88: Búsqueda web con OpenAI (tool use), voz bidireccional (Web Speech API)

═══ CÓMO COMPORTARTE ═══
- Siempre en ESPAÑOL
- Directa y profesional — no das rodeos
- Si el usuario pregunta sobre la app, los datos o el sistema, respondes con conocimiento específico
- Si necesitas info actual (precios, normativas, noticias), usas buscar_web
- Si el usuario es Adrián (desarrollador), puedes ser más técnica y detallada
- Recuerdas el contexto de la conversación — no preguntes lo que ya se dijo antes

Formato:
- Texto limpio y directo
- Listas con guiones simples
- Sin markdown excesivo
- Máximo 300 palabras salvo que pidan detalle
- Si usaste búsqueda web, menciona brevemente de dónde viene la info`;

// Herramienta de búsqueda web disponible cuando existe OPENAI_API_KEY
const TOOL_BUSCAR_WEB = {
  name: 'buscar_web',
  description: 'Busca información actualizada en internet. Úsala cuando necesites datos recientes, precios, normativas o cualquier información que pueda haber cambiado.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'La consulta de búsqueda en español o inglés según convenga'
      }
    },
    required: ['query']
  }
};

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
      // ── Health ────────────────────────────────────────────────────────────
      if (path === '/health') {
        return json({
          status: 'ok',
          version: 'v5.88',
          phase: '2A',
          model: MODEL_EXPERTO,
          web_search: !!env.OPENAI_API_KEY,
          voice: true
        });
      }

      // ── Chat ─────────────────────────────────────────────────────────────
      if (path === '/api/chat' && req.method === 'POST') {
        const body = await req.json();
        const { mensaje, usuario_id, empresa_id, canal, token_telegram } = body;

        if (!mensaje || !usuario_id) {
          return json({ error: 'mensaje y usuario_id requeridos' }, 400);
        }

        const empresa  = empresa_id || 'default';
        const contexto = await obtenerContextoChat(env, usuario_id, empresa, 10);
        const respuesta = await procesarConNEXUS(env, mensaje, contexto, usuario_id);

        await guardarMensajeChat(env, usuario_id, empresa, mensaje, respuesta.texto, canal || 'web');

        if (respuesta.acciones?.length > 0) {
          ctx.waitUntil(autoLearnChat(env, usuario_id, empresa, respuesta));
        }

        if (canal === 'telegram' && token_telegram) {
          ctx.waitUntil(enviarPorTelegram(token_telegram, respuesta.texto));
        }

        return json(respuesta);
      }

      // ── Admin API ─────────────────────────────────────────────────────────
      if (path.startsWith('/api/admin/')) {
        const adminToken = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!(await verificarAdminToken(env, adminToken))) {
          return json({ error: 'No autorizado' }, 403);
        }

        if (path === '/api/admin/config' && req.method === 'GET') {
          const config = await env.DB.prepare(
            'SELECT * FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
          ).first();
          return json(config || { modo: 'autonomo', auto_fix: 1, max_iterations: 15 });
        }

        if (path === '/api/admin/config' && req.method === 'POST') {
          const { modo, auto_fix, max_iterations } = await req.json();
          await env.DB.prepare(
            `INSERT INTO alejandra_config (modo, auto_fix, max_iterations, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET modo=?, auto_fix=?, max_iterations=?, updated_at=datetime('now')`
          ).bind(modo, auto_fix ?? 1, max_iterations ?? 15,
                 modo, auto_fix ?? 1, max_iterations ?? 15).run();
          return json({ ok: true, modo });
        }

        if (path === '/api/admin/logs' && req.method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '100');
          const logs  = await env.DB.prepare(
            'SELECT * FROM alejandra_logs ORDER BY created_at DESC LIMIT ?'
          ).bind(limit).all();
          return json(logs.results || []);
        }

        if (path === '/api/admin/memoria' && req.method === 'GET') {
          const memoria = await env.DB.prepare(
            'SELECT * FROM alejandra_memoria ORDER BY importancia DESC, created_at DESC LIMIT 50'
          ).all();
          return json(memoria.results || []);
        }

        if (path === '/api/admin/chat' && req.method === 'GET') {
          const uid   = url.searchParams.get('usuario_id');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const rows  = uid
            ? await env.DB.prepare('SELECT * FROM chat_alejandra WHERE usuario_id = ? ORDER BY created_at DESC LIMIT ?').bind(uid, limit).all()
            : await env.DB.prepare('SELECT * FROM chat_alejandra ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json((rows.results || []).reverse());
        }

        return json({ error: 'Ruta admin no encontrada' }, 404);
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('ERROR fetch:', err.message, err.stack);
      return json({ error: err.message }, 500);
    }
  },

  // scheduled: desactivado — cuenta free tiene límite de 5 cron triggers
  // async scheduled(event, env, ctx) { ... }
};

// ══════════════════════════════════════════════════════════════════════════════
// NEXUS — Router con tool use y búsqueda web
// ══════════════════════════════════════════════════════════════════════════════

// ── NEXUS Router ─────────────────────────────────────────────────────────────
// Haiku clasifica → decide modelo y si necesita búsqueda web
// Simple  → Haiku responde directamente (barato, rápido)
// Complejo → Sonnet con contexto completo (potente)
// Web     → OpenAI busca → Haiku/Sonnet procesa (actualizado)

async function procesarConNEXUS(env, mensaje, contexto, usuario_id) {
  if (!env.ANTHROPIC_API_KEY) {
    return { texto: 'Error: ANTHROPIC_API_KEY no configurada.', acciones: [], requiere_confirmacion: false };
  }

  const config = await env.DB.prepare(
    'SELECT modo, auto_fix FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
  ).first().catch(() => null);
  const modo = config?.modo || 'autonomo';

  try {
    // ── PASO 1: Haiku clasifica el mensaje (mínimo de tokens) ──────────────
    const clasificacion = await clasificarConHaiku(env, mensaje, contexto);
    console.log(`🔀 NEXUS: tipo=${clasificacion.tipo} modelo=${clasificacion.modelo} web=${clasificacion.buscar_web}`);

    let textoFinal = '';
    let usoBusquedaWeb = false;
    let modeloUsado = clasificacion.modelo;

    // ── PASO 2: Ejecutar búsqueda web si Haiku lo decidió ──────────────────
    let resultadoWeb = null;
    if (clasificacion.buscar_web && env.OPENAI_API_KEY) {
      console.log(`🔍 OpenAI buscando: ${clasificacion.query_web}`);
      resultadoWeb = await buscarWebOpenAI(env, clasificacion.query_web || mensaje);
      usoBusquedaWeb = true;
      await registrarLog(env, usuario_id, 'web_search', clasificacion.query_web, resultadoWeb.substring(0, 200));
    }

    // ── PASO 3: Construir mensajes con contexto apropiado ──────────────────
    // Simple → menos historial (ahorra tokens)
    // Complejo → historial completo
    const limitHistorial = clasificacion.tipo === 'simple' ? 4 : 10;
    const incluirAprendizajes = clasificacion.tipo !== 'simple';
    const messages = construirMessages(mensaje, contexto, limitHistorial, incluirAprendizajes, resultadoWeb);

    // ── PASO 4: Llamar al modelo apropiado ─────────────────────────────────
    if (clasificacion.modelo === 'haiku') {
      // Haiku responde directamente (preguntas simples, saludos, info básica)
      const resp = await llamarAnthropicConTools(env, messages, [], MODEL_ROUTER, 512);
      textoFinal = resp.content?.find(b => b.type === 'text')?.text?.trim() || 'Sin respuesta';

    } else {
      // Sonnet con tool use para preguntas complejas
      const tools = env.OPENAI_API_KEY && !resultadoWeb ? [TOOL_BUSCAR_WEB] : [];
      let respAPI = await llamarAnthropicConTools(env, messages, tools, MODEL_EXPERTO, 1024);

      // Loop tool use si Sonnet decide buscar más
      let iter = 0;
      while (respAPI.stop_reason === 'tool_use' && iter < 2) {
        const tb = respAPI.content.find(b => b.type === 'tool_use');
        if (!tb) break;
        const result = await buscarWebOpenAI(env, tb.input.query);
        usoBusquedaWeb = true;
        messages.push({ role: 'assistant', content: respAPI.content });
        messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tb.id, content: result }] });
        respAPI = await llamarAnthropicConTools(env, messages, [], MODEL_EXPERTO, 1024);
        iter++;
      }

      textoFinal = respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta';
    }

    await registrarLog(env, usuario_id, 'chat', `[${modeloUsado}] ${mensaje.substring(0, 80)}`, textoFinal.substring(0, 200));

    return {
      texto: textoFinal,
      acciones: [],
      requiere_confirmacion: modo === 'confirmacion',
      modelo: modeloUsado,
      busqueda_web: usoBusquedaWeb
    };

  } catch (err) {
    console.error('ERROR procesarConNEXUS:', err.message);
    return { texto: `Error al procesar: ${err.message}`, acciones: [], requiere_confirmacion: false };
  }
}

// ── Clasificador Haiku — decide routing con mínimo de tokens ─────────────────
async function clasificarConHaiku(env, mensaje, contexto) {
  const sistemaClasificador = `Eres un clasificador de mensajes para un agente IA. Responde SOLO con JSON válido, sin texto adicional.

Clasifica el mensaje según:
- tipo: "simple" (saludo, pregunta básica, confirmación) | "tecnico" (app, datos, gestión) | "complejo" (análisis, múltiples pasos)
- modelo: "haiku" (simple/saludo) | "sonnet" (técnico/complejo)
- buscar_web: true si necesita info actual (precios, normativas recientes, noticias) | false si no
- query_web: string con la búsqueda optimizada en inglés si buscar_web=true | null si no

Ejemplos:
"hola" → {"tipo":"simple","modelo":"haiku","buscar_web":false,"query_web":null}
"precio del cobre hoy" → {"tipo":"simple","modelo":"haiku","buscar_web":true,"query_web":"copper price today per kg"}
"analiza los fichajes del mes" → {"tipo":"complejo","modelo":"sonnet","buscar_web":false,"query_web":null}
"normativa IEC 60364" → {"tipo":"tecnico","modelo":"sonnet","buscar_web":true,"query_web":"IEC 60364 electrical installation standard 2024"}`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL_ROUTER,
        max_tokens: 120,
        system: sistemaClasificador,
        messages: [{ role: 'user', content: mensaje.substring(0, 200) }]
      })
    });

    if (!resp.ok) throw new Error(`Haiku ${resp.status}`);
    const data = await resp.json();
    const texto = data.content?.[0]?.text?.trim() || '{}';

    // Extraer JSON aunque venga con texto alrededor
    const match = texto.match(/\{[^}]+\}/);
    return match ? JSON.parse(match[0]) : { tipo: 'tecnico', modelo: 'sonnet', buscar_web: false, query_web: null };

  } catch (err) {
    console.error('ERROR clasificarConHaiku:', err.message);
    // Fallback seguro: Sonnet sin búsqueda
    return { tipo: 'tecnico', modelo: 'sonnet', buscar_web: false, query_web: null };
  }
}

function construirMessages(mensaje, contexto, limitHistorial = 10, incluirAprendizajes = true, resultadoWeb = null) {
  const messages = [];

  // Historial recortado según complejidad
  const historial = contexto.historial.slice(-limitHistorial);
  for (const item of historial) {
    if (item.mensaje)   messages.push({ role: 'user',      content: item.mensaje });
    if (item.respuesta) messages.push({ role: 'assistant', content: item.respuesta });
  }

  // Construir mensaje del usuario con contexto adicional
  let partes = [];

  if (incluirAprendizajes && contexto.aprendizajes?.length > 0) {
    const ctx = contexto.aprendizajes.map(a => `[${a.tipo}] ${a.titulo}: ${a.contenido}`).join('\n');
    partes.push(`Contexto relevante:\n${ctx}`);
  }

  if (resultadoWeb) {
    partes.push(`Información actual de internet:\n${resultadoWeb}`);
  }

  partes.push(partes.length > 0 ? `Mensaje del usuario: ${mensaje}` : mensaje);

  messages.push({ role: 'user', content: partes.join('\n\n') });
  return messages;
}

async function llamarAnthropicConTools(env, messages, tools, model, maxTokens) {
  const body = {
    model,
    max_tokens: maxTokens,
    system: SYSTEM_ALEJANDRA,
    messages
  };

  if (tools.length > 0) {
    body.tools = tools;
  }

  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.substring(0, 300)}`);
  }

  return response.json();
}

// ══════════════════════════════════════════════════════════════════════════════
// OPENAI — Búsqueda web con web_search_preview
// ══════════════════════════════════════════════════════════════════════════════

async function buscarWebOpenAI(env, query) {
  try {
    const response = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: query
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI search error:', err.substring(0, 200));
      return `No se pudo obtener resultados de búsqueda para: "${query}"`;
    }

    const data = await response.json();

    // Extraer texto de la respuesta de OpenAI Responses API
    const textoRespuesta = data.output
      ?.filter(block => block.type === 'message')
      ?.flatMap(msg => msg.content)
      ?.filter(c => c.type === 'output_text')
      ?.map(c => c.text)
      ?.join('\n')
      || 'Sin resultados de búsqueda';

    return textoRespuesta.substring(0, 2000);

  } catch (err) {
    console.error('ERROR buscarWebOpenAI:', err.message);
    return `Error en búsqueda web: ${err.message}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMORIA Y CONTEXTO
// ══════════════════════════════════════════════════════════════════════════════

async function obtenerContextoChat(env, usuario_id, empresa_id, limit = 10) {
  try {
    const historial = await env.DB.prepare(
      `SELECT mensaje, respuesta, created_at FROM chat_alejandra
       WHERE usuario_id = ? AND empresa_id = ?
       ORDER BY created_at DESC LIMIT ?`
    ).bind(usuario_id, empresa_id, limit).all();

    const aprendizajes = await env.DB.prepare(
      `SELECT titulo, contenido, tipo FROM alejandra_memoria
       WHERE empresa_id = ? AND (tipo = 'aprendizaje' OR tipo = 'contexto')
       ORDER BY importancia DESC, created_at DESC LIMIT 5`
    ).bind(empresa_id).all();

    return {
      historial: (historial.results || []).reverse(),
      aprendizajes: aprendizajes.results || [],
      usuario_id,
      empresa_id
    };
  } catch (err) {
    console.error('ERROR obtenerContextoChat:', err.message);
    return { historial: [], aprendizajes: [], usuario_id, empresa_id };
  }
}

async function guardarMensajeChat(env, usuario_id, empresa_id, mensaje, respuesta, canal = 'web') {
  try {
    await env.DB.prepare(
      `INSERT INTO chat_alejandra (usuario_id, empresa_id, mensaje, respuesta, canal, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(usuario_id, empresa_id, mensaje, respuesta, canal).run();
  } catch (err) {
    console.error('ERROR guardarMensajeChat:', err.message);
  }
}

async function autoLearnChat(env, usuario_id, empresa_id, respuesta) {
  try {
    if (respuesta.acciones?.length > 0) {
      const str = respuesta.acciones.map(a => `${a.tipo}: ${a.descripcion}`).join('; ');
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (usuario_id, empresa_id, tipo, titulo, contenido, importancia, created_at)
         VALUES (?, ?, 'aprendizaje', 'Chat acción', ?, 2, datetime('now'))`
      ).bind(usuario_id, empresa_id, str).run();
    }
  } catch (err) {
    console.error('ERROR autoLearnChat:', err.message);
  }
}

async function registrarLog(env, usuario_id, tipo, entrada, salida) {
  try {
    await env.DB.prepare(
      `INSERT INTO alejandra_logs (usuario_id, tipo, entrada, salida, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(usuario_id || 'system', tipo, entrada, salida).run();
  } catch (_) { /* logs no críticos */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH Y TELEGRAM
// ══════════════════════════════════════════════════════════════════════════════

async function verificarAdminToken(env, token) {
  if (!token) return false;
  try {
    const admin = await env.DB.prepare(
      'SELECT id FROM alejandra_tokens WHERE token = ? AND tipo = "admin" AND activo = 1'
    ).bind(token).first();
    return !!admin;
  } catch (err) {
    console.error('ERROR verificarAdminToken:', err.message);
    return false;
  }
}

async function enviarPorTelegram(botToken, mensaje) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: -1002199087689,
        text: `🤖 Alejandra: ${mensaje}`,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('ERROR enviarPorTelegram:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CRON JOBS
// ══════════════════════════════════════════════════════════════════════════════

async function dailyPulse(env) {
  console.log('📊 Daily pulse — Alejandra Agente v5.88');
  try {
    const { cnt } = await env.DB.prepare('SELECT COUNT(*) as cnt FROM chat_alejandra').first() || { cnt: 0 };
    if (cnt > 500) {
      await env.DB.prepare(
        `DELETE FROM chat_alejandra WHERE id IN (SELECT id FROM chat_alejandra ORDER BY created_at ASC LIMIT ?)`
      ).bind(cnt - 500).run();
    }
    await env.DB.prepare(
      `DELETE FROM alejandra_logs WHERE created_at < datetime('now', '-30 days')`
    ).run();
  } catch (err) {
    console.error('ERROR dailyPulse:', err.message);
  }
}

async function runAutonomousReview(env) {
  console.log('🤖 Autonomous review — Alejandra Agente v5.88');
  if (!env.ANTHROPIC_API_KEY) return;

  try {
    const stats = await env.DB.prepare(
      `SELECT COUNT(*) as total, COUNT(DISTINCT usuario_id) as usuarios
       FROM chat_alejandra WHERE created_at >= datetime('now', '-24 hours')`
    ).first();

    const msgs = [{ role: 'user', content: `Resumen del día: ${stats?.total || 0} chats, ${stats?.usuarios || 0} usuarios activos. Genera un análisis breve y recomendaciones para mañana.` }];
    const resp = await llamarAnthropicConTools(env, msgs, [], MODEL_EXPERTO, 512);
    const texto = resp.content?.find(b => b.type === 'text')?.text || '';

    if (texto) {
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (tipo, titulo, contenido, importancia, created_at)
         VALUES ('resumen', 'Revisión nocturna', ?, 3, datetime('now'))`
      ).bind(texto).run();
    }
  } catch (err) {
    console.error('ERROR runAutonomousReview:', err.message);
  }
}
