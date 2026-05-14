// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo de Alejandra con NEXUS, 32 tools, chat memory
// Desplegado en: alejandra-agente.workers.dev
// Versión: v5.86 (PHASE 1)
// ══════════════════════════════════════════════════════════════════════════════

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;

    try {
      // ─────────────────────────────────────────────────────────────────────
      // RUTAS PÚBLICAS (sin autenticación)
      // ─────────────────────────────────────────────────────────────────────

      if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', version: 'v5.86' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // CHAT CON ALEJANDRA (endpoint principal)
      // ─────────────────────────────────────────────────────────────────────

      if (path === '/api/chat' && req.method === 'POST') {
        const body = await req.json();
        const { mensaje, usuario_id, empresa_id, canal, token_telegram } = body;

        if (!mensaje || !usuario_id) {
          return new Response(JSON.stringify({ error: 'mensaje y usuario_id requeridos' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Obtener contexto de chat (últimos 10 mensajes + aprendizajes)
        const contexto = await obtenerContextoChat(env, usuario_id, empresa_id, 10);

        // Procesar con NEXUS (Haiku router → Sonnet expertos)
        const respuesta = await procesarConNEXUS(env, mensaje, contexto, usuario_id);

        // Guardar en historial de chat
        await guardarMensajeChat(env, usuario_id, empresa_id, mensaje, respuesta.texto, canal);

        // Si hay acciones (direct_fix, migrations, etc) guardar en memoria
        if (respuesta.acciones && respuesta.acciones.length > 0) {
          await autoLearnChat(env, usuario_id, respuesta);
        }

        // Si es Telegram, enviar también por bot
        if (canal === 'telegram' && token_telegram) {
          ctx.waitUntil(enviarPorTelegram(token_telegram, respuesta.texto));
        }

        return new Response(JSON.stringify(respuesta), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // ─────────────────────────────────────────────────────────────────────
      // ADMIN PANEL API
      // ─────────────────────────────────────────────────────────────────────

      if (path.startsWith('/api/admin/')) {
        const adminToken = req.headers.get('Authorization')?.replace('Bearer ', '');
        const isAdmin = await verificarAdminToken(env, adminToken);

        if (!isAdmin) {
          return new Response(JSON.stringify({ error: 'No autorizado' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // GET /api/admin/config — obtener configuración actual
        if (path === '/api/admin/config' && req.method === 'GET') {
          const config = await env.DB.prepare(
            'SELECT * FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
          ).first();

          return new Response(JSON.stringify(config || { modo: 'autonomo', auto_fix: 1 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // POST /api/admin/config — actualizar modo (autonomo/confirmacion)
        if (path === '/api/admin/config' && req.method === 'POST') {
          const body = await req.json();
          const { modo, auto_fix, max_iterations } = body;

          await env.DB.prepare(
            `INSERT INTO alejandra_config (modo, auto_fix, max_iterations, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET modo=?, auto_fix=?, max_iterations=?, updated_at=datetime('now')`
          ).bind(modo, auto_fix || 1, max_iterations || 15, modo, auto_fix || 1, max_iterations || 15).run();

          return new Response(JSON.stringify({ ok: true, modo }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // GET /api/admin/logs — audit logs de acciones
        if (path === '/api/admin/logs' && req.method === 'GET') {
          const limit = url.searchParams.get('limit') || 100;
          const logs = await env.DB.prepare(
            `SELECT * FROM alejandra_logs ORDER BY created_at DESC LIMIT ?`
          ).bind(limit).all();

          return new Response(JSON.stringify(logs.results || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // GET /api/admin/memoria — aprendizajes y contexto
        if (path === '/api/admin/memoria' && req.method === 'GET') {
          const memoria = await env.DB.prepare(
            `SELECT * FROM alejandra_memoria ORDER BY importancia DESC, created_at DESC LIMIT 50`
          ).all();

          return new Response(JSON.stringify(memoria.results || []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // RUTAS NO ENCONTRADAS
      // ─────────────────────────────────────────────────────────────────────

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('ERROR:', err.message, err.stack);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async scheduled(event, env, ctx) {
    // Cron 07:00 — Daily pulse y garbage collection
    if (event.cron === '0 7 * * *') {
      ctx.waitUntil(dailyPulse(env));
    }

    // Cron 23:00 — Autonomous review con hasta 15 iteraciones
    if (event.cron === '0 23 * * *') {
      ctx.waitUntil(runAutonomousReview(env));
    }
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ══════════════════════════════════════════════════════════════════════════════

async function obtenerContextoChat(env, usuario_id, empresa_id, limit = 10) {
  try {
    // Últimos N mensajes de chat
    const historial = await env.DB.prepare(
      `SELECT mensaje, respuesta, created_at FROM chat_alejandra
       WHERE usuario_id = ? AND empresa_id = ?
       ORDER BY created_at DESC LIMIT ?`
    ).bind(usuario_id, empresa_id, limit).all();

    // Aprendizajes relevantes
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

async function procesarConNEXUS(env, mensaje, contexto, usuario_id) {
  // NEXUS router: Haiku 4.5 clasifica → 5 Sonnet 4.6 expertos
  // Por ahora, respuesta simple. En PHASE 2 integrar con Anthropic API

  const config = await env.DB.prepare(
    'SELECT modo, auto_fix FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
  ).first();

  const modo = config?.modo || 'autonomo';
  const auto_fix = config?.auto_fix || 1;

  return {
    texto: `Mensaje procesado. Modo: ${modo}, Auto-fix: ${auto_fix ? 'sí' : 'no'}. Mensaje: "${mensaje.substring(0, 50)}..."`,
    acciones: [],
    requiere_confirmacion: modo === 'confirmacion'
  };
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

async function autoLearnChat(env, usuario_id, respuesta) {
  // Registrar acciones/aprendizajes en memoria
  try {
    if (respuesta.acciones.length > 0) {
      const accionesStr = respuesta.acciones.map(a => `${a.tipo}: ${a.descripcion}`).join('; ');
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (usuario_id, tipo, titulo, contenido, importancia, created_at)
         VALUES (?, 'aprendizaje', 'Chat acción', ?, 2, datetime('now'))`
      ).bind(usuario_id, accionesStr).run();
    }
  } catch (err) {
    console.error('ERROR autoLearnChat:', err.message);
  }
}

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

async function enviarPorTelegram(token, mensaje) {
  try {
    const botToken = token; // Token del bot @AlejandraAPP_bot
    const chatId = -1002199087689; // Grupo Alejandra APP (obtenido de environment)

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🤖 Alejandra: ${mensaje}`,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('ERROR enviarPorTelegram:', err.message);
  }
}

async function dailyPulse(env) {
  console.log('📊 Daily pulse — Alejandra Agente');
  // Garbage collection de old chat history (keep last 500)
  try {
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM chat_alejandra'
    ).first();

    const count = countResult.cnt || 0;
    if (count > 500) {
      const toDelete = count - 500;
      await env.DB.prepare(
        `DELETE FROM chat_alejandra WHERE id IN (
          SELECT id FROM chat_alejandra ORDER BY created_at ASC LIMIT ?
        )`
      ).bind(toDelete).run();

      console.log(`🗑️  Deleted ${toDelete} old chat messages`);
    }
  } catch (err) {
    console.error('ERROR dailyPulse:', err.message);
  }
}

async function runAutonomousReview(env) {
  console.log('🤖 Autonomous review — Alejandra Agente');
  // Nightly review with up to 15 LLM iterations
  // PHASE 2: Implement full autonomous review logic
}
