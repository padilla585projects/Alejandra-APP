// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo con NEXUS, chat memory, herramientas
// Desplegado en: alejandra-agente.alejandra-app.workers.dev
// Versión: v5.87 (PHASE 2A — Anthropic API integrada)
// ══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL_ROUTER  = 'claude-haiku-4-5';   // Clasificador rápido
const MODEL_EXPERTO = 'claude-sonnet-4-6';  // Respuestas expertas

const SYSTEM_ALEJANDRA = `Eres Alejandra, agente IA autónoma integrada en una app de gestión industrial para empresas del sector eléctrico/mecánico.

Respondes en ESPAÑOL siempre. Eres directa, concisa y profesional.

Contexto de la app:
- Gestiona bobinas de cable, equipos, personal, fichajes, documentos e incidencias
- Los usuarios son operarios, encargados, empresa_admin y superadmin
- Tienes acceso a herramientas para consultar y modificar la base de datos

Cuando el usuario pide información o acciones:
1. Analiza qué necesita exactamente
2. Si puedes responder directamente, hazlo
3. Si necesitas ejecutar una herramienta, indícalo claramente
4. Mantén el hilo de la conversación usando el historial previo

Formato de respuesta:
- Sin markdown excesivo — texto claro y directo
- Para listas cortas usa guiones simples
- Para datos numéricos usa tablas solo si hay más de 3 filas
- Máximo 300 palabras salvo que el usuario pida más detalle`;

export default {
  async fetch(req, env, ctx) {
    const url  = new URL(req.url);
    const path = url.pathname;

    // CORS para el panel admin y la app
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
        return json({ status: 'ok', version: 'v5.87', phase: '2A', model: MODEL_EXPERTO });
      }

      // ── Chat ─────────────────────────────────────────────────────────────
      if (path === '/api/chat' && req.method === 'POST') {
        const body = await req.json();
        const { mensaje, usuario_id, empresa_id, canal, token_telegram } = body;

        if (!mensaje || !usuario_id) {
          return json({ error: 'mensaje y usuario_id requeridos' }, 400);
        }

        const empresa = empresa_id || 'default';
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
          const logs = await env.DB.prepare(
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
          const uid = url.searchParams.get('usuario_id');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const query = uid
            ? 'SELECT * FROM chat_alejandra WHERE usuario_id = ? ORDER BY created_at DESC LIMIT ?'
            : 'SELECT * FROM chat_alejandra ORDER BY created_at DESC LIMIT ?';
          const stmt = uid
            ? env.DB.prepare(query).bind(uid, limit)
            : env.DB.prepare(query).bind(limit);
          const rows = await stmt.all();
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

  async scheduled(event, env, ctx) {
    if (event.cron === '0 7 * * *') ctx.waitUntil(dailyPulse(env));
    if (event.cron === '0 23 * * *') ctx.waitUntil(runAutonomousReview(env));
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// NEXUS — Router inteligente con Anthropic API
// ══════════════════════════════════════════════════════════════════════════════

async function procesarConNEXUS(env, mensaje, contexto, usuario_id) {
  if (!env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY no configurada');
    return {
      texto: 'Error: Alejandra no tiene acceso a la API de IA. Configura ANTHROPIC_API_KEY como secret de Cloudflare.',
      acciones: [],
      requiere_confirmacion: false
    };
  }

  const config = await env.DB.prepare(
    'SELECT modo, auto_fix, max_iterations FROM alejandra_config ORDER BY updated_at DESC LIMIT 1'
  ).first();

  const modo = config?.modo || 'autonomo';

  // Construir historial de mensajes para la API
  const messages = construirMessages(mensaje, contexto);

  try {
    const respuestaTexto = await llamarAnthropicAPI(env, messages, MODEL_EXPERTO, 1024);

    // Registrar en logs
    await registrarLog(env, usuario_id, 'chat', mensaje.substring(0, 100), respuestaTexto.substring(0, 200));

    return {
      texto: respuestaTexto,
      acciones: [],
      requiere_confirmacion: modo === 'confirmacion',
      modelo: MODEL_EXPERTO
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

  // Añadir historial previo de chat
  for (const item of contexto.historial) {
    if (item.mensaje) messages.push({ role: 'user', content: item.mensaje });
    if (item.respuesta) messages.push({ role: 'assistant', content: item.respuesta });
  }

  // Construir el mensaje actual incluyendo contexto de aprendizajes si los hay
  let contenidoUsuario = mensaje;

  if (contexto.aprendizajes?.length > 0) {
    const aprendizajesStr = contexto.aprendizajes
      .map(a => `[${a.tipo}] ${a.titulo}: ${a.contenido}`)
      .join('\n');
    contenidoUsuario = `Contexto relevante:\n${aprendizajesStr}\n\nMensaje del usuario: ${mensaje}`;
  }

  messages.push({ role: 'user', content: contenidoUsuario });

  return messages;
}

async function llamarAnthropicAPI(env, messages, model, maxTokens = 1024) {
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: SYSTEM_ALEJANDRA,
      messages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data.content?.[0];

  if (!content || content.type !== 'text') {
    throw new Error('Respuesta inesperada de la API de Anthropic');
  }

  return content.text;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXTO Y MEMORIA
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
      const accionesStr = respuesta.acciones.map(a => `${a.tipo}: ${a.descripcion}`).join('; ');
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (usuario_id, empresa_id, tipo, titulo, contenido, importancia, created_at)
         VALUES (?, ?, 'aprendizaje', 'Chat acción', ?, 2, datetime('now'))`
      ).bind(usuario_id, empresa_id, accionesStr).run();
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
    ).bind(usuario_id, tipo, entrada, salida).run();
  } catch (_) {
    // silencioso — logs no críticos
  }
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
    const chatId = -1002199087689;
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

// ══════════════════════════════════════════════════════════════════════════════
// CRON JOBS
// ══════════════════════════════════════════════════════════════════════════════

async function dailyPulse(env) {
  console.log('📊 Daily pulse — Alejandra Agente v5.87');
  try {
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM chat_alejandra'
    ).first();
    const count = countResult?.cnt || 0;
    if (count > 500) {
      const toDelete = count - 500;
      await env.DB.prepare(
        `DELETE FROM chat_alejandra WHERE id IN (
           SELECT id FROM chat_alejandra ORDER BY created_at ASC LIMIT ?
         )`
      ).bind(toDelete).run();
      console.log(`🗑️ Deleted ${toDelete} old chat messages`);
    }
    // Limpiar logs mayores de 30 días
    await env.DB.prepare(
      `DELETE FROM alejandra_logs WHERE created_at < datetime('now', '-30 days')`
    ).run();
  } catch (err) {
    console.error('ERROR dailyPulse:', err.message);
  }
}

async function runAutonomousReview(env) {
  console.log('🤖 Autonomous review — Alejandra Agente v5.87');
  if (!env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY no configurada — saltando autonomous review');
    return;
  }

  try {
    // Obtener estadísticas del día para el resumen nocturno
    const statsHoy = await env.DB.prepare(
      `SELECT COUNT(*) as total_chats,
              COUNT(DISTINCT usuario_id) as usuarios_activos
       FROM chat_alejandra
       WHERE created_at >= datetime('now', '-24 hours')`
    ).first();

    const erroresHoy = await env.DB.prepare(
      `SELECT COUNT(*) as errores FROM alejandra_logs
       WHERE tipo = 'error' AND created_at >= datetime('now', '-24 hours')`
    ).first();

    const resumenMensaje = `Resumen del día:
- Chats procesados: ${statsHoy?.total_chats || 0}
- Usuarios activos: ${statsHoy?.usuarios_activos || 0}
- Errores registrados: ${erroresHoy?.errores || 0}

Genera un breve análisis de actividad y recomendaciones.`;

    const respuesta = await llamarAnthropicAPI(
      env,
      [{ role: 'user', content: resumenMensaje }],
      MODEL_EXPERTO,
      512
    );

    // Guardar resumen en memoria
    await env.DB.prepare(
      `INSERT INTO alejandra_memoria (tipo, titulo, contenido, importancia, created_at)
       VALUES ('resumen', 'Revisión nocturna', ?, 3, datetime('now'))`
    ).bind(respuesta).run();

    console.log('✅ Autonomous review completado');
  } catch (err) {
    console.error('ERROR runAutonomousReview:', err.message);
  }
}
