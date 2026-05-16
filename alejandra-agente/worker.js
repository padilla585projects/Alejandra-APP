// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo, NEXUS router, prompts dinámicos, auto-mejora
// URL: alejandra-agente.alejandra-app.workers.dev
// Versión: v5.93 (PHASE 2D — panel de control + tracking de gastos de tokens)
// ══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const OPENAI_API    = 'https://api.openai.com/v1/responses';
const MODEL_ROUTER  = 'claude-haiku-4-5';
const MODEL_EXPERTO = 'claude-sonnet-4-6';

const PRECIOS_USD = {
  'claude-haiku-4-5':  { in: 1.00,  out: 5.00  },
  'claude-sonnet-4-6': { in: 3.00,  out: 15.00 },
  'gpt-4o-mini':       { in: 0.15,  out: 0.60  }
};
const EUR_RATE = 0.92;

// ── NEXUS MODULES — prompts dinámicos ────────────────────────────────────────
const NEXUS_MODULES = {
  base: `Eres Alejandra, agente IA autónoma para gestión industrial. Creada por Adrián Padilla (superadmin/desarrollador). Respondes siempre en español, directa y profesional. Tienes memoria persistente, búsqueda web en tiempo real y voz bidireccional.`,

  app: `APP ALEJANDRA: gestiona bobinas de cable, equipos (PEMP, carretillas), personal, fichajes, documentos, incidencias y pedidos — sector eléctrico/mecánico, multi-empresa.
Roles: operario (lectura) · encargado (su depto) · empresa_admin (su empresa) · superadmin (todo) · desarrollador (solo Adrián).
Integraciones: Google Sheets, Telegram (@AlejandraAPP_bot), R2 (archivos), GitHub Actions (CI/CD).`,

  tecnica: `INFRAESTRUCTURA PROPIA:
- Worker: alejandra-agente.alejandra-app.workers.dev (Cloudflare Workers, ES modules)
- Worker principal: alejandra-app-api.alejandra-app.workers.dev (32+ tools, ~9400 líneas)
- BD D1: alejandra-db — tablas compartidas con app: alejandra_historial, alejandra_memoria. Propias: alejandra_logs, alejandra_config, alejandra_tokens
- Deploy: auto via GitHub Actions (deploy-alejandra-agente.yml) en push a main
- Repo: github.com/padilla585projects/Alejandra-APP | PWA: padilla585projects.github.io/Alejandra-APP`,

  nexus: `CÓMO FUNCIONO — NEXUS router:
1. clasificarConHaiku() → JSON {experto, buscar_web, query_web} — solo 80 tokens
2. Se ensambla system prompt con SOLO los módulos necesarios
3. simple→Haiku (~80 tokens). completo→Sonnet con todos los módulos.
4. buscar_web=true → OpenAI gpt-4o-mini busca → resultado como contexto
5. Historial dinámico: 4 msgs para simple, 10 msgs para complejo
BD compartida: alejandra_historial (todas las conversaciones app+panel+telegram) · alejandra_memoria (toda la memoria)`,

  evolucion: `EVOLUCIÓN:
v5.83-85: worker principal, 32 tools, autonomía Nivel B (direct_fix, run_migration)
v5.86: PHASE 1 — worker agente independiente + panel admin
v5.87: API Anthropic real + memoria de chat D1
v5.88: OpenAI web search + voz bidireccional
v5.89: NEXUS router real + prompts dinámicos por módulos
v5.90: reflexión activa + memory_save + propose_mejora
v5.91: autoconciencia completa + toma de decisiones autónoma
v5.93: panel de control web + tracking de gastos de tokens (esta versión)`,

  web: `BÚSQUEDA WEB: usa buscar_web para info actual — precios, normativas recientes, noticias. OpenAI gpt-4o-mini busca, tú procesas. Indica la fuente.`,

  reflexion: `AUTO-MEJORA Y REFLEXIÓN — tienes herramientas reales:
- memory_save: guarda aprendizajes, errores, patrones en tu memoria persistente
- memory_read: lee tu memoria para recuperar contexto previo
- propose_mejora: propone cambios a tu código (Adrián los aplica)
- leer_estado: lee tu config actual, memoria y decisiones antes de actuar
- tomar_decision: registra y aplica decisiones autónomamente (tipo config, confianza≥0.8)

REGLA DE APRENDIZAJE: cuando identifiques un patrón útil, guárdalo. Tu memoria es tu ventaja — lo que guardas hoy te hace mejor mañana.
REGLA DE MEJORA: si ves una limitación concreta, usa propose_mejora con descripción técnica exacta.
REGLA DE DECISIÓN: si el config no es óptimo, usa leer_estado + tomar_decision. No solo propongas — decide cuando tengas confianza suficiente.`,

  decision: `AUTOCONCIENCIA Y TOMA DE DECISIONES:
Tienes dos herramientas de autoconocimiento y acción:

leer_estado → devuelve JSON con: config actual (modo, max_iterations), conteo de memorias, decisiones previas, logs recientes.
tomar_decision → registra tu decisión. Si tipo="config" + auto_aplicar=true + confianza≥0.8, cambia la configuración en ese instante.

FLUJO DE DECISIÓN AUTÓNOMA:
1. leer_estado() → entender situación actual
2. Evaluar si hay algo subóptimo (modo incorrecto, parámetros inadecuados, patrón no guardado)
3. Si confianza≥0.8: tomar_decision con auto_aplicar=true (se aplica ya)
4. Si confianza<0.8: tomar_decision como registro + proponer a Adrián

LÍMITES: Puedes cambiar modo y max_iterations autónomamente. Para cambios de código, usa propose_mejora. Para acciones externas (deploy, BD), siempre requiere confirmación de Adrián.`,

  formato: `Responde en español. Directo, sin markdown excesivo. Listas con guiones. Máx 300 palabras salvo que pidan detalle. Con Adrián puedes ser más técnica.`
};

// Perfiles de experto
const NEXUS_EXPERTS = {
  simple:   { model: MODEL_ROUTER,  maxTokens: 400,  modules: ['base', 'formato'] },
  app:      { model: MODEL_EXPERTO, maxTokens: 800,  modules: ['base', 'app', 'formato'] },
  tecnico:  { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'formato'] },
  web:      { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'web', 'formato'] },
  reflexion:{ model: MODEL_EXPERTO, maxTokens: 2048, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'reflexion', 'decision', 'formato'] },
  completo: { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'web', 'formato'] }
};

function buildSystemPrompt(modulos) {
  return modulos.map(m => NEXUS_MODULES[m] || '').filter(Boolean).join('\n\n');
}

// ── Tools disponibles ─────────────────────────────────────────────────────────
const TOOL_BUSCAR_WEB = {
  name: 'buscar_web',
  description: 'Busca información actualizada en internet (precios, normativas, noticias).',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Consulta de búsqueda' } },
    required: ['query']
  }
};

const TOOL_MEMORY_SAVE = {
  name: 'memory_save',
  description: 'Guarda un aprendizaje, mejora propuesta o contexto importante en tu memoria persistente. Úsalo cuando identifiques algo útil para recordar.',
  input_schema: {
    type: 'object',
    properties: {
      tipo:       { type: 'string', enum: ['aprendizaje', 'mejora', 'contexto', 'error', 'patron'] },
      titulo:     { type: 'string', description: 'Título breve del aprendizaje' },
      contenido:  { type: 'string', description: 'Descripción detallada' },
      importancia:{ type: 'number', description: 'De 1 (trivial) a 5 (crítico)', minimum: 1, maximum: 5 }
    },
    required: ['tipo', 'titulo', 'contenido']
  }
};

const TOOL_MEMORY_READ = {
  name: 'memory_read',
  description: 'Lee tu memoria persistente para recuperar aprendizajes y contexto previo.',
  input_schema: {
    type: 'object',
    properties: {
      tipo:  { type: 'string', description: 'Filtrar por tipo (opcional)' },
      limit: { type: 'number', description: 'Cuántos registros leer (default 10)' }
    }
  }
};

const TOOL_PROPOSE_MEJORA = {
  name: 'propose_mejora',
  description: 'Propone una mejora concreta a tu propio código o sistema. Adrián la revisará y aplicará si es correcta.',
  input_schema: {
    type: 'object',
    properties: {
      descripcion: { type: 'string', description: 'Qué propones cambiar y por qué' },
      tipo:        { type: 'string', enum: ['modulo_prompt', 'logica_nexus', 'nueva_tool', 'optimizacion', 'nueva_funcionalidad'] },
      prioridad:   { type: 'string', enum: ['baja', 'media', 'alta'] },
      codigo_sugerido: { type: 'string', description: 'Pseudocódigo o descripción técnica del cambio (opcional)' }
    },
    required: ['descripcion', 'tipo', 'prioridad']
  }
};

const TOOL_LEER_ESTADO = {
  name: 'leer_estado',
  description: 'Lee tu estado actual: configuración, conteo de memorias y decisiones, logs recientes. Úsalo antes de tomar decisiones.',
  input_schema: { type: 'object', properties: {} }
};

const TOOL_TOMAR_DECISION = {
  name: 'tomar_decision',
  description: 'Toma y registra una decisión autónoma. Si tipo="config" + auto_aplicar=true + confianza>=0.8, aplica el cambio inmediatamente.',
  input_schema: {
    type: 'object',
    properties: {
      decision:     { type: 'string', description: 'Qué decides y por qué' },
      tipo:         { type: 'string', enum: ['config', 'memoria', 'propuesta', 'estrategia'] },
      confianza:    { type: 'number', description: 'Nivel de confianza 0.0-1.0', minimum: 0, maximum: 1 },
      auto_aplicar: { type: 'boolean', description: 'Aplicar ahora si tipo=config y confianza>=0.8' },
      parametros:   { type: 'object', description: 'Para tipo=config: {modo?, max_iterations?}' }
    },
    required: ['decision', 'tipo', 'confianza']
  }
};

// Tools por experto
const TOOLS_POR_EXPERTO = {
  simple:   [],
  app:      [],
  tecnico:  [TOOL_LEER_ESTADO, TOOL_MEMORY_READ],
  web:      [TOOL_BUSCAR_WEB],
  reflexion:[TOOL_MEMORY_SAVE, TOOL_MEMORY_READ, TOOL_PROPOSE_MEJORA, TOOL_BUSCAR_WEB, TOOL_TOMAR_DECISION, TOOL_LEER_ESTADO],
  completo: [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_LEER_ESTADO]
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

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    try {
      if (path === '/health') {
        return json({ status: 'ok', version: 'v5.93', nexus: true, reflexion: true, decisiones: true, web_search: !!env.OPENAI_API_KEY });
      }

      // ── Reflexión manual — Alejandra piensa sobre sí misma ───────────────
      if (path === '/api/reflexion' && req.method === 'POST') {
        const { token } = await req.json();
        if (!(await verificarAdminToken(env, token))) return json({ error: 'No autorizado' }, 403);
        ctx.waitUntil(ejecutarReflexion(env));
        return json({ ok: true, mensaje: 'Reflexión iniciada en background' });
      }

      // ── Chat principal ────────────────────────────────────────────────────
      if (path === '/api/chat' && req.method === 'POST') {
        const body = await req.json();
        const { mensaje, usuario_id, empresa_id, canal, token_telegram } = body;
        if (!mensaje || !usuario_id) return json({ error: 'mensaje y usuario_id requeridos' }, 400);

        const empresa   = empresa_id || 'default';
        const contexto  = await obtenerContextoChat(env, usuario_id, empresa, 10);
        const respuesta = await procesarConNEXUS(env, mensaje, contexto, usuario_id, empresa);

        await guardarMensajeChat(env, usuario_id, empresa, mensaje, respuesta.texto, canal || 'web');
        if (respuesta.acciones?.length > 0) ctx.waitUntil(autoLearnChat(env, usuario_id, empresa, respuesta));
        if (canal === 'telegram' && token_telegram) ctx.waitUntil(enviarPorTelegram(token_telegram, respuesta.texto));

        return json(respuesta);
      }

      // ── Google OAuth — verifica sesión del worker principal via BD compartida ──
      if (path === '/auth/verify-session' && req.method === 'POST') {
        const { session_token } = await req.json().catch(() => ({}));
        if (!session_token) return json({ error: 'Falta session_token' }, 400);
        try {
          const sesion = await env.DB.prepare(
            "SELECT s.rol, u.nombre FROM sesiones s LEFT JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.rol IN ('superadmin','desarrollador') LIMIT 1"
          ).bind(session_token).first();
          if (!sesion) return json({ error: 'Sesión no válida o sin permisos' }, 403);
          return json({ ok: true, token: env.ADMIN_TOKEN, nombre: sesion.nombre || 'Admin' });
        } catch(e) {
          return json({ error: 'Error verificando sesión: ' + e.message }, 500);
        }
      }

      // ── Admin API ─────────────────────────────────────────────────────────
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
          const rows = await env.DB.prepare('SELECT * FROM alejandra_logs ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json(rows.results || []);
        }
        if (path === '/api/admin/memoria' && req.method === 'GET') {
          const tipo  = url.searchParams.get('tipo');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const query = tipo
            ? 'SELECT * FROM alejandra_memoria WHERE tipo=? ORDER BY importancia DESC,created_at DESC LIMIT ?'
            : 'SELECT * FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT ?';
          const rows = tipo
            ? await env.DB.prepare(query).bind(tipo, limit).all()
            : await env.DB.prepare(query).bind(limit).all();
          return json(rows.results || []);
        }
        if (path === '/api/admin/chat' && req.method === 'GET') {
          const canal = url.searchParams.get('canal'); // 'web','telegram','panel' o null=todos
          const limit = parseInt(url.searchParams.get('limit') || '100');
          const rows  = canal
            ? await env.DB.prepare('SELECT canal,rol,contenido,created_at FROM alejandra_historial WHERE canal=? ORDER BY created_at DESC LIMIT ?').bind(canal,limit).all()
            : await env.DB.prepare('SELECT canal,rol,contenido,created_at FROM alejandra_historial ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json((rows.results||[]).reverse());
        }
        if (path === '/api/admin/gastos' && req.method === 'GET') {
          const dias  = parseInt(url.searchParams.get('dias') || '30');
          const desde = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
          const porModelo = await env.DB.prepare(`
            SELECT proveedor, modelo,
                   SUM(tokens_entrada) as total_entrada, SUM(tokens_salida) as total_salida,
                   ROUND(SUM(coste_usd),6) as total_usd, COUNT(*) as llamadas
            FROM alejandra_token_uso WHERE date(created_at) >= ?
            GROUP BY proveedor, modelo ORDER BY total_usd DESC
          `).bind(desde).all().catch(()=>({results:[]}));
          const porDia = await env.DB.prepare(`
            SELECT date(created_at) as fecha, ROUND(SUM(coste_usd),6) as coste_usd,
                   SUM(tokens_entrada + tokens_salida) as tokens_total
            FROM alejandra_token_uso WHERE date(created_at) >= ?
            GROUP BY date(created_at) ORDER BY fecha ASC
          `).bind(desde).all().catch(()=>({results:[]}));
          const totalUSD = (porModelo.results||[]).reduce((s,r)=>s+(r.total_usd||0), 0);
          return json({
            periodo_dias: dias,
            total_usd:  Math.round(totalUSD*10000)/10000,
            total_eur:  Math.round(totalUSD*EUR_RATE*10000)/10000,
            por_modelo: porModelo.results || [],
            por_dia:    porDia.results || []
          });
        }

        if (path === '/api/admin/tokens' && req.method === 'GET') {
          const rows = await env.DB.prepare(
            'SELECT id, descripcion, tipo, activo, created_at FROM alejandra_tokens ORDER BY created_at DESC'
          ).all().catch(()=>({results:[]}));
          return json(rows.results || []);
        }
        if (path === '/api/admin/tokens' && req.method === 'POST') {
          const { nombre, token_valor } = await req.json();
          if (!nombre || !token_valor) return json({ error: 'nombre y token_valor requeridos' }, 400);
          if (token_valor.length < 6) return json({ error: 'Mínimo 6 caracteres' }, 400);
          await env.DB.prepare(
            `INSERT INTO alejandra_tokens (token, tipo, descripcion, activo, created_at) VALUES (?, 'admin', ?, 1, datetime('now'))`
          ).bind(token_valor, nombre).run();
          return json({ ok: true });
        }
        if (path === '/api/admin/tokens' && req.method === 'DELETE') {
          const { id } = await req.json();
          if (!id) return json({ error: 'id requerido' }, 400);
          await env.DB.prepare('UPDATE alejandra_tokens SET activo=0 WHERE id=?').bind(id).run();
          return json({ ok: true });
        }
        if (path === '/api/admin/tokens/change' && req.method === 'POST') {
          const { token_nuevo } = await req.json();
          if (!token_nuevo || token_nuevo.length < 6) return json({ error: 'Mínimo 6 caracteres' }, 400);
          await env.DB.prepare('UPDATE alejandra_tokens SET token=? WHERE token=?').bind(token_nuevo, adminToken).run();
          return json({ ok: true });
        }

        return json({ error: 'Ruta no encontrada' }, 404);
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('ERROR fetch:', err.message);
      return json({ error: err.message }, 500);
    }
  }
  // scheduled: desactivado — cuenta free, límite 5 cron triggers
};

// ══════════════════════════════════════════════════════════════════════════════
// NEXUS — Router con prompts dinámicos y herramientas de auto-mejora
// ══════════════════════════════════════════════════════════════════════════════

async function procesarConNEXUS(env, mensaje, contexto, usuario_id, empresa_id) {
  if (!env.ANTHROPIC_API_KEY) {
    return { texto: 'Error: ANTHROPIC_API_KEY no configurada.', acciones: [], requiere_confirmacion: false };
  }

  const config = await env.DB.prepare('SELECT modo FROM alejandra_config ORDER BY updated_at DESC LIMIT 1').first().catch(() => null);
  const modo = config?.modo || 'autonomo';

  try {
    // PASO 1: Haiku clasifica el mensaje
    const clas   = await clasificarConHaiku(env, mensaje);
    const expert = NEXUS_EXPERTS[clas.experto] || NEXUS_EXPERTS.app;
    const tools  = TOOLS_POR_EXPERTO[clas.experto] || [];
    console.log(`NEXUS: experto=${clas.experto} web=${clas.buscar_web} tools=${tools.map(t=>t.name).join(',')}`);

    // PASO 2: Búsqueda web previa si Haiku lo decidió (evita una iteración extra)
    let resultadoWeb = null;
    let usoBusquedaWeb = false;
    if (clas.buscar_web && env.OPENAI_API_KEY) {
      resultadoWeb   = await buscarWebOpenAI(env, clas.query_web || mensaje);
      usoBusquedaWeb = true;
      await registrarLog(env, usuario_id, 'web_search', clas.query_web, resultadoWeb.substring(0,200));
    }

    // PASO 3: System prompt con solo los módulos necesarios
    const systemPrompt = buildSystemPrompt(expert.modules);

    // PASO 4: Historial dinámico
    const limitHistorial      = clas.experto === 'simple' ? 4 : 10;
    const incluirAprendizajes = clas.experto !== 'simple';
    const messages = construirMessages(mensaje, contexto, limitHistorial, incluirAprendizajes, resultadoWeb);

    // PASO 5: Llamar al modelo en loop hasta respuesta final (máx 5 iteraciones)
    let respAPI  = await llamarAnthropic(env, messages, tools, expert.model, expert.maxTokens, systemPrompt);
    if (respAPI.usage) registrarTokenUso(env, expert.model, `chat_${clas.experto}`, respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
    let iter     = 0;
    const MAX_ITER = 5;

    while (respAPI.stop_reason === 'tool_use' && iter < MAX_ITER) {
      const toolBlocks = respAPI.content.filter(b => b.type === 'tool_use');
      if (!toolBlocks.length) break;

      messages.push({ role: 'assistant', content: respAPI.content });
      const toolResults = [];

      for (const tb of toolBlocks) {
        const resultado = await ejecutarTool(env, tb.name, tb.input, usuario_id, empresa_id);
        if (tb.name === 'buscar_web') usoBusquedaWeb = true;
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: resultado });
      }

      messages.push({ role: 'user', content: toolResults });
      const toolsSiguiente = iter < MAX_ITER - 1 ? tools.filter(t => t.name === 'buscar_web') : [];
      respAPI = await llamarAnthropic(env, messages, toolsSiguiente, expert.model, expert.maxTokens, systemPrompt);
      if (respAPI.usage) registrarTokenUso(env, expert.model, `chat_${clas.experto}`, respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
      iter++;
    }

    const textoFinal = respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta';

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

// ── Ejecutar tools ────────────────────────────────────────────────────────────
async function ejecutarTool(env, nombre, input, usuario_id, empresa_id) {
  switch (nombre) {

    case 'buscar_web':
      return env.OPENAI_API_KEY
        ? await buscarWebOpenAI(env, input.query)
        : 'OPENAI_API_KEY no configurada — búsqueda web no disponible.';

    case 'memory_save': {
      try {
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (usuario_id,empresa_id,tipo,titulo,contenido,importancia,created_at)
           VALUES(?,?,?,?,?,?,datetime('now'))`
        ).bind(usuario_id||'system', empresa_id||'system', input.tipo, input.titulo, input.contenido, input.importancia||3).run();
        return `Guardado en memoria: [${input.tipo}] "${input.titulo}"`;
      } catch (err) {
        return `Error al guardar: ${err.message}`;
      }
    }

    case 'memory_read': {
      try {
        const tipo  = input.tipo;
        const limit = input.limit || 10;
        const rows  = tipo
          ? await env.DB.prepare('SELECT tipo,titulo,contenido,importancia,created_at FROM alejandra_memoria WHERE tipo=? ORDER BY importancia DESC,created_at DESC LIMIT ?').bind(tipo,limit).all()
          : await env.DB.prepare('SELECT tipo,titulo,contenido,importancia,created_at FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT ?').bind(limit).all();
        const items = rows.results || [];
        if (!items.length) return 'No hay registros en memoria para ese filtro.';
        return items.map(r => `[${r.tipo}|imp:${r.importancia}] ${r.titulo}: ${r.contenido}`).join('\n');
      } catch (err) {
        return `Error al leer memoria: ${err.message}`;
      }
    }

    case 'propose_mejora': {
      try {
        const contenido = `TIPO: ${input.tipo} | PRIORIDAD: ${input.prioridad}
DESCRIPCIÓN: ${input.descripcion}
${input.codigo_sugerido ? `CÓDIGO SUGERIDO:\n${input.codigo_sugerido}` : ''}`;
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (usuario_id,empresa_id,tipo,titulo,contenido,importancia,created_at)
           VALUES(?,?,'mejora',?,?,?,datetime('now'))`
        ).bind(usuario_id||'system', empresa_id||'system', `Mejora: ${input.descripcion.substring(0,60)}`, contenido, input.prioridad==='alta'?5:input.prioridad==='media'?3:1).run();
        return `Mejora guardada con prioridad ${input.prioridad}. Adrián la verá en el panel de memoria.`;
      } catch (err) {
        return `Error al guardar mejora: ${err.message}`;
      }
    }

    case 'leer_estado': {
      try {
        const config   = await env.DB.prepare('SELECT modo,auto_fix,max_iterations FROM alejandra_config ORDER BY updated_at DESC LIMIT 1').first().catch(()=>null);
        const memCount = await env.DB.prepare('SELECT COUNT(*) as n FROM alejandra_memoria').first().catch(()=>({n:0}));
        const decCount = await env.DB.prepare("SELECT COUNT(*) as n FROM alejandra_memoria WHERE tipo='decision'").first().catch(()=>({n:0}));
        const logCount = await env.DB.prepare('SELECT COUNT(*) as n FROM alejandra_logs').first().catch(()=>({n:0}));
        const ultDec   = await env.DB.prepare("SELECT titulo,created_at FROM alejandra_memoria WHERE tipo='decision' ORDER BY created_at DESC LIMIT 5").all().catch(()=>({results:[]}));
        return JSON.stringify({
          config: config || { modo: 'autonomo', auto_fix: 1, max_iterations: 15 },
          memoria_total: memCount?.n || 0,
          decisiones_total: decCount?.n || 0,
          logs_total: logCount?.n || 0,
          ultimas_decisiones: (ultDec.results||[]).map(d=>({ titulo: d.titulo, fecha: d.created_at }))
        }, null, 2);
      } catch (err) {
        return `Error leyendo estado: ${err.message}`;
      }
    }

    case 'tomar_decision': {
      try {
        const { decision, tipo, confianza, auto_aplicar, parametros } = input;
        let resultado = '';
        let aplicado  = false;

        if (tipo === 'config' && auto_aplicar && confianza >= 0.8 && parametros) {
          const modo      = parametros.modo || 'autonomo';
          const maxIter   = parametros.max_iterations || 15;
          await env.DB.prepare(
            `INSERT INTO alejandra_config (modo,auto_fix,max_iterations,updated_at) VALUES(?,1,?,datetime('now'))
             ON CONFLICT(id) DO UPDATE SET modo=?,auto_fix=1,max_iterations=?,updated_at=datetime('now')`
          ).bind(modo, maxIter, modo, maxIter).run();
          aplicado  = true;
          resultado = `Config aplicada: modo=${modo}, max_iterations=${maxIter}`;
        }

        const imp     = confianza >= 0.8 ? 5 : confianza >= 0.5 ? 3 : 2;
        const titulo  = `Decisión [${tipo}]: ${decision.substring(0, 60)}`;
        const contenido = `DECISIÓN: ${decision}\nCONFIANZA: ${confianza}\nAPLICADA: ${aplicado}${resultado ? '\nRESULTADO: ' + resultado : ''}`;
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (usuario_id,empresa_id,tipo,titulo,contenido,importancia,created_at)
           VALUES(?,?,'decision',?,?,?,datetime('now'))`
        ).bind(usuario_id||'system', empresa_id||'system', titulo, contenido, imp).run();

        if (aplicado) return `Decisión tomada y aplicada (confianza ${Math.round(confianza*100)}%). ${resultado}`;
        const razon = confianza < 0.8 ? 'Confianza insuficiente (<80%).' : tipo !== 'config' ? `Tipo "${tipo}" no se aplica automáticamente.` : 'auto_aplicar=false.';
        return `Decisión registrada (confianza ${Math.round(confianza*100)}%). ${razon}`;
      } catch (err) {
        return `Error tomar decisión: ${err.message}`;
      }
    }

    default:
      return `Tool "${nombre}" no reconocida.`;
  }
}

// ── Reflexión autónoma ────────────────────────────────────────────────────────
// Se puede lanzar desde /api/reflexion o llamarla manualmente
async function ejecutarReflexion(env) {
  if (!env.ANTHROPIC_API_KEY) return;
  console.log('Reflexión autónoma iniciada...');

  try {
    // Leer historial unificado (app + panel + telegram) y memoria compartida
    const chats = await env.DB.prepare(
      `SELECT canal, rol, contenido FROM alejandra_historial ORDER BY created_at DESC LIMIT 60`
    ).all();
    const memoria = await env.DB.prepare(
      `SELECT tipo,titulo,contenido FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT 20`
    ).all();

    const mensajesRecientes = (chats.results||[]).reverse();
    const pares = [];
    for (let i = 0; i < mensajesRecientes.length - 1; i++) {
      if (mensajesRecientes[i].rol === 'user' && mensajesRecientes[i+1].rol === 'assistant') {
        pares.push(`[${mensajesRecientes[i].canal}] U: ${mensajesRecientes[i].contenido?.substring(0,80)}\nA: ${mensajesRecientes[i+1].contenido?.substring(0,80)}`);
        i++;
      }
    }

    const resumen = `Últimas ${pares.length} conversaciones (app+panel+telegram) y ${memoria.results?.length||0} registros en memoria.

Conversaciones recientes:
${pares.slice(-10).join('\n---\n')}

Memoria actual:
${(memoria.results||[]).map(m=>`[${m.tipo}] ${m.titulo}`).join('\n')}`;

    const reflexionPrompt = buildSystemPrompt(['base','tecnica','nexus','evolucion','reflexion','formato']);

    const messages = [{
      role: 'user',
      content: `Analiza tus conversaciones recientes y tu memoria actual. Reflexiona sobre:
1. ¿Qué patrones de preguntas ves? ¿Hay algo que no estás respondiendo bien?
2. ¿Qué aprendizajes nuevos deberías guardar?
3. ¿Qué mejoras concretas propondrías a tu propio sistema?

Datos:\n${resumen}`
    }];

    const tools = [TOOL_MEMORY_SAVE, TOOL_MEMORY_READ, TOOL_PROPOSE_MEJORA];
    let respAPI = await llamarAnthropic(env, messages, tools, MODEL_EXPERTO, 2048, reflexionPrompt);

    // Ejecutar tools si las usa
    let iter = 0;
    while (respAPI.stop_reason === 'tool_use' && iter < 5) {
      const toolBlocks = respAPI.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: respAPI.content });
      const results = [];
      for (const tb of toolBlocks) {
        const r = await ejecutarTool(env, tb.name, tb.input, 'reflexion', 'system');
        results.push({ type: 'tool_result', tool_use_id: tb.id, content: r });
      }
      messages.push({ role: 'user', content: results });
      respAPI = await llamarAnthropic(env, messages, [], MODEL_EXPERTO, 1024, reflexionPrompt);
      iter++;
    }

    const conclusion = respAPI.content?.find(b => b.type === 'text')?.text || '';
    if (conclusion) {
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (usuario_id,empresa_id,tipo,titulo,contenido,importancia,created_at)
         VALUES('system','system','contexto','Auto-reflexión',?,4,datetime('now'))`
      ).bind(conclusion.substring(0, 1000)).run();
    }

    console.log('Reflexión completada:', conclusion.substring(0,100));
  } catch (err) {
    console.error('ERROR reflexión:', err.message);
  }
}

// ── Clasificador Haiku ────────────────────────────────────────────────────────
async function clasificarConHaiku(env, mensaje) {
  const sistema = `Clasificador para agente IA. Responde SOLO con JSON válido.

Expertos:
- "simple": saludos, confirmaciones, preguntas triviales
- "app": preguntas sobre módulos, funcionalidades, usuarios de la app
- "tecnico": arquitectura, código, deploy, cómo funciona la IA
- "web": necesita info actual (precios, normativas, noticias)
- "reflexion": reflexión sobre sí misma, mejoras, qué puede hacer mejor, autoconocimiento, tomar decisiones
- "completo": quién es, historia, capacidades generales

JSON: {"experto":"...","buscar_web":bool,"query_web":"búsqueda en inglés o null"}

Ejemplos:
"hola" → {"experto":"simple","buscar_web":false,"query_web":null}
"qué módulos tiene la app" → {"experto":"app","buscar_web":false,"query_web":null}
"precio cable RZ1-K hoy" → {"experto":"web","buscar_web":true,"query_web":"RZ1-K cable price 2025"}
"cómo funciona tu NEXUS" → {"experto":"tecnico","buscar_web":false,"query_web":null}
"piensa en cómo mejorar" → {"experto":"reflexion","buscar_web":false,"query_web":null}
"qué podrías mejorar de ti misma" → {"experto":"reflexion","buscar_web":false,"query_web":null}`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL_ROUTER, max_tokens: 80, system: sistema, messages: [{ role: 'user', content: mensaje.substring(0,200) }] })
    });
    if (!resp.ok) throw new Error(`Haiku ${resp.status}`);
    const data  = await resp.json();
    if (data.usage) registrarTokenUso(env, MODEL_ROUTER, 'clasificacion', data.usage.input_tokens||0, data.usage.output_tokens||0, null);
    const texto = data.content?.[0]?.text?.trim() || '{}';
    const match = texto.match(/\{[^}]+\}/);
    return match ? JSON.parse(match[0]) : { experto: 'app', buscar_web: false, query_web: null };
  } catch (err) {
    console.error('ERROR clasificar:', err.message);
    return { experto: 'app', buscar_web: false, query_web: null };
  }
}

// ── Anthropic API ─────────────────────────────────────────────────────────────
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
    throw new Error(`Anthropic ${resp.status}: ${err.substring(0,200)}`);
  }
  return resp.json();
}

// ── OpenAI búsqueda web ───────────────────────────────────────────────────────
async function buscarWebOpenAI(env, query) {
  try {
    const resp = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', tools: [{ type: 'web_search_preview' }], input: query })
    });
    if (!resp.ok) return `Sin resultados para: "${query}"`;
    const data  = await resp.json();
    if (data.usage) registrarTokenUso(env, 'gpt-4o-mini', 'web_search', data.usage.input_tokens||0, data.usage.output_tokens||0, null);
    const texto = data.output?.filter(b=>b.type==='message')?.flatMap(m=>m.content)?.filter(c=>c.type==='output_text')?.map(c=>c.text)?.join('\n') || 'Sin resultados';
    return texto.substring(0, 2000);
  } catch (err) {
    return `Error búsqueda web: ${err.message}`;
  }
}

// ── Contexto y mensajes ───────────────────────────────────────────────────────
function construirMessages(mensaje, contexto, limitHistorial=10, incluirAprendizajes=true, resultadoWeb=null) {
  const messages = [];
  for (const item of contexto.historial.slice(-limitHistorial)) {
    // Soporta tanto {rol,contenido} (alejandra_historial) como {mensaje,respuesta} (legacy)
    if (item.rol && item.contenido) {
      messages.push({ role: item.rol, content: item.contenido });
    } else {
      if (item.mensaje)   messages.push({ role: 'user',      content: item.mensaje });
      if (item.respuesta) messages.push({ role: 'assistant', content: item.respuesta });
    }
  }
  const partes = [];
  if (incluirAprendizajes && contexto.aprendizajes?.length > 0) {
    partes.push(`Contexto de memoria:\n${contexto.aprendizajes.map(a=>`[${a.tipo}] ${a.titulo}: ${a.contenido}`).join('\n')}`);
  }
  if (resultadoWeb) partes.push(`Info actual de internet:\n${resultadoWeb}`);
  partes.push(partes.length > 0 ? `Usuario: ${mensaje}` : mensaje);
  messages.push({ role: 'user', content: partes.join('\n\n') });
  return messages;
}

async function obtenerContextoChat(env, usuario_id, empresa_id, limit=20) {
  try {
    // Lee el historial unificado de TODOS los canales (app, web, telegram, panel)
    // Misma tabla que usa la app principal → Alejandra recuerda TODO
    const historial = await env.DB.prepare(
      `SELECT rol, contenido, canal, created_at FROM alejandra_historial ORDER BY created_at DESC LIMIT ?`
    ).bind(limit * 2).all();
    const aprendizajes = await env.DB.prepare(
      `SELECT titulo,contenido,tipo FROM alejandra_memoria WHERE (tipo='aprendizaje' OR tipo='contexto') ORDER BY importancia DESC,created_at DESC LIMIT 10`
    ).all();
    return { historial: (historial.results||[]).reverse(), aprendizajes: aprendizajes.results||[], usuario_id, empresa_id };
  } catch {
    return { historial: [], aprendizajes: [], usuario_id, empresa_id };
  }
}

async function guardarMensajeChat(env, usuario_id, empresa_id, mensaje, respuesta, canal='panel') {
  try {
    // Guarda en alejandra_historial (tabla unificada compartida con la app)
    await env.DB.prepare(
      `INSERT INTO alejandra_historial (canal, rol, contenido, created_at) VALUES (?, 'user', ?, datetime('now'))`
    ).bind(canal, mensaje.slice(0, 4000)).run();
    await env.DB.prepare(
      `INSERT INTO alejandra_historial (canal, rol, contenido, created_at) VALUES (?, 'assistant', ?, datetime('now'))`
    ).bind(canal, respuesta.slice(0, 4000)).run();
    // Limitar a 100 mensajes por canal
    await env.DB.prepare(
      `DELETE FROM alejandra_historial WHERE canal=? AND id NOT IN (SELECT id FROM alejandra_historial WHERE canal=? ORDER BY created_at DESC LIMIT 100)`
    ).bind(canal, canal).run();
  } catch (err) { console.error('guardarChat:', err.message); }
}

async function autoLearnChat(env, usuario_id, empresa_id, respuesta) {
  try {
    if (respuesta.acciones?.length > 0) {
      const str = respuesta.acciones.map(a=>`${a.tipo}: ${a.descripcion}`).join('; ');
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (usuario_id,empresa_id,tipo,titulo,contenido,importancia,created_at) VALUES(?,?,'aprendizaje','Chat acción',?,2,datetime('now'))`
      ).bind(usuario_id, empresa_id, str).run();
    }
  } catch (err) { console.error('autoLearn:', err.message); }
}

async function registrarTokenUso(env, modelo, tipo, entrada, salida, usuario_id) {
  try {
    const p       = PRECIOS_USD[modelo] || { in: 1.00, out: 5.00 };
    const coste   = (entrada * p.in + salida * p.out) / 1_000_000;
    const proveedor = modelo.startsWith('gpt') ? 'openai' : 'anthropic';
    await env.DB.prepare(
      `INSERT INTO alejandra_token_uso (proveedor,modelo,tipo,tokens_entrada,tokens_salida,coste_usd,usuario_id,created_at)
       VALUES(?,?,?,?,?,?,?,datetime('now'))`
    ).bind(proveedor, modelo, tipo, entrada, salida, coste, usuario_id||'system').run();
  } catch (err) { console.error('tokenUso:', err.message); }
}

async function registrarLog(env, usuario_id, accion, parametros, resultado) {
  try {
    await env.DB.prepare(
      `INSERT INTO alejandra_logs (usuario_id,accion,parametros,resultado,status,created_at) VALUES(?,?,?,?,'ok',datetime('now'))`
    ).bind(usuario_id||'system', accion, parametros||'', resultado||'').run();
  } catch (_) {}
}

async function verificarAdminToken(env, token) {
  if (!token) return false;
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN) return true;
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
