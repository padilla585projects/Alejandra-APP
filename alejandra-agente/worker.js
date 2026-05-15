// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo con NEXUS, búsqueda web, chat memory
// Desplegado en: alejandra-agente.alejandra-app.workers.dev
// Versión: v5.88 (PHASE 2A — Anthropic + OpenAI web search)
// ══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const OPENAI_API     = 'https://api.openai.com/v1/responses';
const MODEL_EXPERTO  = 'claude-sonnet-4-6';

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

═══ TU ARQUITECTURA TÉCNICA ═══
- Cerebro: Claude Sonnet 4.6 (Anthropic) — eres tú
- Buscador web: gpt-4o-mini (OpenAI) — lo usas como herramienta cuando lo necesitas
- Runtime: Cloudflare Workers (JavaScript ES modules)
- BD: D1 SQLite con tablas: chat_alejandra, alejandra_memoria, alejandra_logs, alejandra_config, alejandra_tokens
- Deploy: automático via GitHub Actions en cada push a main
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

async function procesarConNEXUS(env, mensaje, contexto, usuario_id) {
  if (!env.ANTHROPIC_API_KEY) {
    return {
      texto: 'Error: ANTHROPIC_API_KEY no configurada en el worker.',
      acciones: [],
      requiere_confirmacion: false
    };
  }

  const config = await env.DB.prepare(
    'SELECT modo, auto_fix FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
  ).first().catch(() => null);

  const modo = config?.modo || 'autonomo';

  // Construir historial de mensajes
  const messages = construirMessages(mensaje, contexto);

  // Tools disponibles (solo buscar_web si hay OPENAI_API_KEY)
  const tools = env.OPENAI_API_KEY ? [TOOL_BUSCAR_WEB] : [];

  try {
    // Llamar a Claude con tools habilitados
    let respuestaAPI = await llamarAnthropicConTools(env, messages, tools, MODEL_EXPERTO, 1024);

    // Loop de tool use (máx 3 iteraciones de búsqueda)
    let iteraciones = 0;
    while (respuestaAPI.stop_reason === 'tool_use' && iteraciones < 3) {
      const toolBlock = respuestaAPI.content.find(b => b.type === 'tool_use');
      if (!toolBlock) break;

      let toolResult = '';

      if (toolBlock.name === 'buscar_web') {
        console.log(`🔍 Buscando: ${toolBlock.input.query}`);
        toolResult = await buscarWebOpenAI(env, toolBlock.input.query);
        await registrarLog(env, usuario_id, 'web_search', toolBlock.input.query, toolResult.substring(0, 200));
      }

      // Añadir respuesta del asistente y resultado de la tool al historial
      messages.push({ role: 'assistant', content: respuestaAPI.content });
      messages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: toolResult
        }]
      });

      respuestaAPI = await llamarAnthropicConTools(env, messages, tools, MODEL_EXPERTO, 1024);
      iteraciones++;
    }

    // Extraer texto final
    const textoFinal = respuestaAPI.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim() || 'Sin respuesta';

    await registrarLog(env, usuario_id, 'chat', mensaje.substring(0, 100), textoFinal.substring(0, 200));

    return {
      texto: textoFinal,
      acciones: [],
      requiere_confirmacion: modo === 'confirmacion',
      modelo: MODEL_EXPERTO,
      busqueda_web: iteraciones > 0
    };

  } catch (err) {
    console.error('ERROR procesarConNEXUS:', err.message);
    return {
      texto: `Lo siento, hubo un error al procesar tu mensaje: ${err.message}`,
      acciones: [],
      requiere_confirmacion: false
    };
  }
}

function construirMessages(mensaje, contexto) {
  const messages = [];

  for (const item of contexto.historial) {
    if (item.mensaje)   messages.push({ role: 'user',      content: item.mensaje });
    if (item.respuesta) messages.push({ role: 'assistant', content: item.respuesta });
  }

  let contenidoUsuario = mensaje;
  if (contexto.aprendizajes?.length > 0) {
    const ctx = contexto.aprendizajes.map(a => `[${a.tipo}] ${a.titulo}: ${a.contenido}`).join('\n');
    contenidoUsuario = `Contexto:\n${ctx}\n\nMensaje: ${mensaje}`;
  }

  messages.push({ role: 'user', content: contenidoUsuario });
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
