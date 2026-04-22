// Alejandra Worker v4.0 — Multi-tenant (empresa_id)
// Base de datos: Cloudflare D1
// IA: Gemini 2.0 Flash
// Sync: Google Sheets automático en cada cambio
// Multi-obra + Roles (superadmin / encargado / operario)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Code, X-Obra-Id, X-Usuario, X-Rol, X-Codigo, X-Departamento, X-Token',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

// ── Crypto helpers (PBKDF2) ──────────────────────────────────────────────────
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const toHex = b => Array.from(b).map(x => x.toString(16).padStart(2,'0')).join('');
  return toHex(salt) + ':' + toHex(new Uint8Array(hash));
}
async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  const hashHex2 = Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2,'0')).join('');
  return hashHex === hashHex2;
}

// ── Auth helper ──────────────────────────────────────────────────────────────
async function getAuth(request, env) {
  // 1. Token D1 (sistema nuevo)
  const xToken = request.headers.get('X-Token');
  if (xToken) {
    try {
      const sesion = await env.DB.prepare('SELECT * FROM sesiones WHERE token = ?').bind(xToken).first();
      if (sesion) {
        env.DB.prepare('UPDATE sesiones SET last_used = CURRENT_TIMESTAMP WHERE token = ?').bind(xToken).run();
        const isSuperadmin   = sesion.es_admin === 1 || sesion.rol === 'superadmin';
        const isEmpresaAdmin = sesion.rol === 'empresa_admin';
        // SA y EA pueden cambiar de dept sin hacer logout → preferir cabecera
        const deptHeader = request.headers.get('X-Departamento');
        const departamento = (isSuperadmin || isEmpresaAdmin)
          ? (deptHeader || sesion.departamento || 'electrico')
          : (sesion.departamento || 'electrico');
        return {
          isAdmin: sesion.es_admin === 1,
          isSuperadmin,
          isEmpresaAdmin,
          isEncargado: sesion.rol === 'encargado',
          isSeguridad: departamento === 'seguridad',
          rol: sesion.rol,
          obraId: sesion.obra_id || null,
          obra_id: sesion.obra_id || null,
          usuario_id: sesion.usuario_id || null,
          usuario: sesion.nombre || '',
          nombre: sesion.nombre || '',
          codigo: '',
          departamento,
          empresa_id: sesion.empresa_id || 1,
        };
      }
    } catch (e) { console.error('getAuth token:', e.message); }
  }
  // 2. Fallback legacy headers (compatibilidad)
  const adminCode    = request.headers.get('X-Admin-Code');
  const obraId       = request.headers.get('X-Obra-Id');
  const usuario      = request.headers.get('X-Usuario');
  const rol          = request.headers.get('X-Rol');
  const codigo       = request.headers.get('X-Codigo');
  const departamento = request.headers.get('X-Departamento') || 'electrico';
  const isAdmin      = env.ADMIN_CODE && adminCode === env.ADMIN_CODE;
  const isSuperadmin = rol === 'superadmin' || isAdmin;
  return {
    isAdmin,
    isSuperadmin,
    isEmpresaAdmin: rol === 'empresa_admin',
    isEncargado: rol === 'encargado',
    isSeguridad: departamento === 'seguridad',
    rol: rol || (isAdmin ? 'superadmin' : null),
    obraId: obraId ? parseInt(obraId) : null,
    obra_id: obraId ? parseInt(obraId) : null,
    usuario_id: null,
    usuario: usuario || '',
    nombre: usuario || '',
    codigo: codigo || '',
    departamento,
    empresa_id: 1,
  };
}

// ── Telegram ─────────────────────────────────────────────────────────────────
async function sendTelegram(env, mensaje) {
  try {
    const token  = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mensaje, parse_mode: 'HTML' }),
    });
  } catch (_) {}
}

// Envía una foto (base64 data URI) con caption y botones inline
async function sendTelegramFotoConBotones(env, caption, base64DataUri, botones) {
  try {
    const token  = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId || !base64DataUri) return;
    const match = base64DataUri.match(/^data:(image\/\w+);base64,(.+)$/s);
    if (!match) return;
    const [, mime, b64] = match;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: mime });
    const form  = new FormData();
    form.append('chat_id',    String(chatId));
    form.append('caption',    caption.slice(0, 1024));
    form.append('parse_mode', 'HTML');
    if (botones?.length) form.append('reply_markup', JSON.stringify({ inline_keyboard: botones }));
    form.append('photo', blob, 'idea.jpg');
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
  } catch (_) {}
}

// botones = [[{text, callback_data}, ...], ...]  (filas × columnas)
async function sendTelegramConBotones(env, mensaje, botones) {
  try {
    const token  = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, text: mensaje, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: botones }
      }),
    });
  } catch (_) {}
}

async function _tgAnswerCQ(env, cqId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cqId, text, show_alert: false })
    });
  } catch (_) {}
}

async function _tgEditMsg(env, chatId, msgId, newText) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId, message_id: msgId,
        text: newText, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }   // elimina los botones tras actuar
      })
    });
  } catch (_) {}
}

// Gestiona las pulsaciones de botones inline enviadas por Telegram
async function handleTelegramWebhook(request, env) {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!secret || secret !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('Unauthorized', { status: 401 });
  const update = await request.json().catch(() => null);
  if (!update?.callback_query) return new Response('OK');
  const cq     = update.callback_query;
  const data   = cq.data || '';
  const chatId = cq.message?.chat?.id;
  const msgId  = cq.message?.message_id;
  const orig   = cq.message?.text || '';
  const [accion, ...partes] = data.split(':');
  try {
    // ── Aprobación de solicitud de usuario ──────────────────────────────────
    if (accion === 'apr') {
      const [userId, empresaId, rol, dept] = partes;
      await env.DB.prepare(
        'UPDATE usuarios SET activo=1, google_pending=0, empresa_id=?, rol=?, departamento=? WHERE id=? AND google_pending=1'
      ).bind(parseInt(empresaId), rol, dept === 'null' ? null : dept, parseInt(userId)).run();
      await _tgAnswerCQ(env, cq.id, '✅ Usuario aprobado');
      await _tgEditMsg(env, chatId, msgId, orig + `\n\n✅ <b>APROBADO</b> — ${rol} · ${dept === 'null' ? '—' : dept}`);
    }
    else if (accion === 'rej') {
      const [userId] = partes;
      await env.DB.prepare('DELETE FROM usuarios WHERE id=? AND google_pending=1').bind(parseInt(userId)).run();
      await _tgAnswerCQ(env, cq.id, '❌ Solicitud rechazada');
      await _tgEditMsg(env, chatId, msgId, orig + '\n\n❌ <b>RECHAZADO</b>');
    }
    // ── Estado de sugerencia / idea ──────────────────────────────────────────
    else if (accion === 'idea_prog') {
      await env.DB.prepare('UPDATE sugerencias SET estado=? WHERE id=?').bind('en_progreso', parseInt(partes[0])).run();
      await _tgAnswerCQ(env, cq.id, '🔄 En progreso');
      await _tgEditMsg(env, chatId, msgId, orig + '\n\n🔄 <b>EN PROGRESO</b>');
    }
    else if (accion === 'idea_done') {
      await env.DB.prepare('UPDATE sugerencias SET estado=? WHERE id=?').bind('resuelto', parseInt(partes[0])).run();
      await _tgAnswerCQ(env, cq.id, '✅ Resuelta');
      await _tgEditMsg(env, chatId, msgId, orig + '\n\n✅ <b>RESUELTA</b>');
    }
    else if (accion === 'idea_close') {
      await env.DB.prepare('UPDATE sugerencias SET estado=? WHERE id=?').bind('cerrado', parseInt(partes[0])).run();
      await _tgAnswerCQ(env, cq.id, '🗑 Cerrada');
      await _tgEditMsg(env, chatId, msgId, orig + '\n\n🗑 <b>CERRADA</b>');
    }
  } catch (e) {
    await _tgAnswerCQ(env, cq.id, '❌ Error: ' + e.message);
  }
  return new Response('OK');
}

// Registra el webhook de Telegram (llamar una sola vez: GET /setup-telegram-webhook)
async function setupTelegramWebhook(request, env) {
  const token  = env.TELEGRAM_BOT_TOKEN;
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!token)  return json({ error: 'TELEGRAM_BOT_TOKEN no configurado' });
  if (!secret) return json({ error: 'TELEGRAM_WEBHOOK_SECRET no configurado' });
  const webhookUrl = 'https://alejandra-app-api.alejandra-app.workers.dev/telegram-webhook';
  const r = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['callback_query'] })
  });
  return json(await r.json());
}

function fechaEspana() {
  return new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    try {
      // ── Telegram webhook (sin auth — valida con secret header) ───────────────
      if (path === '/telegram-webhook'       && method === 'POST') return await handleTelegramWebhook(request, env);
      if (path === '/setup-telegram-webhook' && method === 'GET')  return await setupTelegramWebhook(request, env);

      // ── Rutas públicas (sin auth) ──────────────────────────────────────────
      if (path === '/scan'        && method === 'POST') return await handleScan(request, env);
      if (path === '/ocr'         && method === 'POST') return await handleOCR(request, env);
      if (path === '/log'         && method === 'POST') return await guardarLog(request, env);
      if (path === '/verificar'   && method === 'POST') return await verificarAcceso(request, env);
      if (path === '/auth/google/url'      && method === 'GET')  return googleAuthUrl(request, env);
      if (path === '/auth/google/callback' && method === 'POST') return await googleAuthCallback(request, env);
      if (path === '/usuarios/pendientes'  && method === 'GET')  return await getUsuariosPendientes(request, env);
      if (path === '/usuarios/pendientes/aprobar' && method === 'POST') return await aprobarUsuarioPendiente(request, env);
      if (path === '/usuarios/pendientes/rechazar' && method === 'POST') return await rechazarUsuarioPendiente(request, env);
      if (path === '/invitaciones'          && method === 'POST') return await crearInvitacion(request, env);
      if (path === '/invitaciones'          && method === 'GET')  return await listarInvitaciones(request, env);
      if (path === '/invitaciones/anular'   && method === 'POST') return await anularInvitacion(request, env);
      if (path === '/invitaciones/verificar'&& method === 'GET')  return await verificarInvitacion(request, env);
      if (path === '/acceso'      && method === 'POST') return await verificarAcceso(request, env); // alias legacy
      if (path === '/logout'      && method === 'POST') return await cerrarSesionServidor(request, env);
      if (path === '/sesiones'    && method === 'GET')  return await getSesionesActivas(request, env);
      if (path === '/sesiones/cerrar-todas' && method === 'POST') return await cerrarTodasSesiones(request, env);
      if (path === '/sesion/departamento'   && method === 'PUT')  return await actualizarSesionDepartamento(request, env);
      if (path === '/empresas/registro'  && method === 'POST') return await registrarEmpresa(request, env);
      if (path === '/empresas'           && method === 'GET')  return await getEmpresas(request, env);
      if (path === '/superadmin/empresa' && method === 'POST') return await superadminSeleccionarEmpresa(request, env);
      if (path === '/mi-empresa'         && method === 'GET')  return await getMiEmpresa(request, env);
      if (path === '/mi-empresa'         && method === 'PUT')  return await updateMiEmpresa(request, env);

      // ── Obras ──────────────────────────────────────────────────────────────
      if (path === '/obras'       && method === 'GET')    return await getObras(request, env);
      if (path === '/obras'       && method === 'POST')   return await crearObra(request, env);
      if (path.startsWith('/obras/') && method === 'DELETE') return await eliminarObra(path.split('/obras/')[1], request, env);

      // ── Bobinas ───────────────────────────────────────────────────────────
      if (path === '/bobinas'     && method === 'GET')    return await getBobinas(request, env);
      if (path === '/bobinas'     && method === 'POST')   return await crearBobina(request, env, ctx);

      if (path.startsWith('/bobinas/') && method === 'PUT') {
        const sub = decodeURIComponent(path.split('/bobinas/')[1]);
        if (sub.endsWith('/devolver'))    return await devolverBobina(sub.replace('/devolver', ''), request, env, ctx);
        if (sub.endsWith('/transferir'))  return await transferirRecurso('bobinas', sub.replace('/transferir', ''), request, env);
        return await editarBobina(sub, request, env);
      }
      if (path.startsWith('/bobinas/') && method === 'DELETE') {
        return await eliminarBobina(decodeURIComponent(path.split('/bobinas/')[1]), request, env, ctx);
      }

      // ── PEMP ──────────────────────────────────────────────────────────────
      if (path === '/pemp'        && method === 'GET')    return await getPemp(request, env);
      if (path === '/pemp'        && method === 'POST')   return await crearPemp(request, env, ctx);

      if (path.startsWith('/pemp/') && method === 'PUT') {
        const sub = decodeURIComponent(path.split('/pemp/')[1]);
        if (sub.endsWith('/devolver'))   return await devolverPemp(sub.replace('/devolver', ''), request, env, ctx);
        if (sub.endsWith('/transferir')) return await transferirRecurso('pemp', sub.replace('/transferir', ''), request, env);
        return await editarPemp(sub, request, env);
      }
      if (path.startsWith('/pemp/') && method === 'DELETE') {
        return await eliminarPemp(decodeURIComponent(path.split('/pemp/')[1]), request, env, ctx);
      }

      // ── Carretillas ───────────────────────────────────────────────────────
      if (path === '/carretillas'  && method === 'GET')   return await getCarretillas(request, env);
      if (path === '/carretillas'  && method === 'POST')  return await crearCarretilla(request, env, ctx);

      if (path.startsWith('/carretillas/') && method === 'PUT') {
        const sub = decodeURIComponent(path.split('/carretillas/')[1]);
        if (sub.endsWith('/devolver'))   return await devolverCarretilla(sub.replace('/devolver', ''), request, env, ctx);
        if (sub.endsWith('/transferir')) return await transferirRecurso('carretillas', sub.replace('/transferir', ''), request, env);
        return await editarCarretilla(sub, request, env);
      }
      if (path.startsWith('/carretillas/') && method === 'DELETE') {
        return await eliminarCarretilla(decodeURIComponent(path.split('/carretillas/')[1]), request, env, ctx);
      }

      // ── Usuarios ──────────────────────────────────────────────────────────
      if (path === '/usuarios'    && method === 'GET')    return await getUsuarios(request, env);
      if (path === '/usuarios'    && method === 'POST')   return await crearUsuario(request, env);
      if (path.startsWith('/usuarios/') && method === 'DELETE') {
        return await eliminarUsuario(path.split('/usuarios/')[1], request, env);
      }
      if (path.startsWith('/usuarios/') && method === 'PUT') {
        return await editarUsuario(path.split('/usuarios/')[1], request, env);
      }

      // ── Catálogos ─────────────────────────────────────────────────────────
      if (path === '/proveedores'  && method === 'GET')   return await getCatalogo('proveedores', env, request);
      if (path === '/proveedores'  && method === 'POST')  return await addCatalogo('proveedores', request, env);
      if (path.startsWith('/proveedores/') && method === 'DELETE') return await deleteCatalogo('proveedores', path.split('/proveedores/')[1], env);

      if (path === '/tipos-cable'  && method === 'GET')   return await getCatalogo('tipos_cable', env, request);
      if (path === '/tipos-cable'  && method === 'POST')  return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos-cable/') && method === 'DELETE') return await deleteCatalogo('tipos_cable', path.split('/tipos-cable/')[1], env);

      // Legacy aliases for tipos-cable
      if (path === '/tipos'        && method === 'GET')   return await getCatalogo('tipos_cable', env, request);
      if (path === '/tipos'        && method === 'POST')  return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos/') && method === 'DELETE') return await deleteCatalogo('tipos_cable', path.split('/tipos/')[1], env);

      if (path === '/tipos-pemp'           && method === 'GET')   return await getCatalogo('tipos_pemp', env, request);
      if (path === '/tipos-pemp'           && method === 'POST')  return await addCatalogo('tipos_pemp', request, env);
      if (path.startsWith('/tipos-pemp/')  && method === 'DELETE') return await deleteCatalogo('tipos_pemp', path.split('/tipos-pemp/')[1], env);

      if (path === '/tipos-carretilla'          && method === 'GET')   return await getCatalogo('tipos_carretilla', env, request);
      if (path === '/tipos-carretilla'          && method === 'POST')  return await addCatalogo('tipos_carretilla', request, env);
      if (path.startsWith('/tipos-carretilla/') && method === 'DELETE') return await deleteCatalogo('tipos_carretilla', path.split('/tipos-carretilla/')[1], env);

      if (path === '/energias-carretilla'          && method === 'GET')   return await getCatalogo('energias_carretilla', env, request);
      if (path === '/energias-carretilla'          && method === 'POST')  return await addCatalogo('energias_carretilla', request, env);
      if (path.startsWith('/energias-carretilla/') && method === 'DELETE') return await deleteCatalogo('energias_carretilla', path.split('/energias-carretilla/')[1], env);

      // ── Config ────────────────────────────────────────────────────────────
      if (path === '/config'       && method === 'GET')   return await getConfig(request, env);
      if (path === '/config'       && method === 'POST')  return await setConfig(request, env);

      // ── Export ────────────────────────────────────────────────────────────
      if (path === '/export'       && method === 'GET')   return await exportCSV(request, env);

      // ── Sugerencias ───────────────────────────────────────────────────────
      if (path === '/sugerencias'  && method === 'POST') return await guardarSugerencia(request, env);
      if (path === '/sugerencias'  && method === 'GET')  return await getSugerencias(request, env);
      if (path === '/sugerencias/marcar-todas' && method === 'PUT')    return await marcarTodasSugerencias(request, env);
      if (path === '/sugerencias/borrar-todas' && method === 'DELETE') return await borrarTodasSugerencias(request, env);
      if (path.startsWith('/sugerencias/') && method === 'PUT') {
        const sid = parseInt(path.split('/sugerencias/')[1]);
        return await marcarSugerenciaLeida(sid, request, env);
      }
      if (path.startsWith('/sugerencias/') && method === 'DELETE') {
        const sid = parseInt(path.split('/sugerencias/')[1]);
        return await eliminarSugerencia(sid, request, env);
      }

      // ── Buscar máquina (cross-departamento, para Seguridad) ───────────────
      if (path.startsWith('/buscar-maquina/') && method === 'GET') {
        const mat = decodeURIComponent(path.split('/buscar-maquina/')[1]);
        return await buscarMaquina(mat, request, env);
      }

      // ── Inventario Seguridad ───────────────────────────────────────────────
      if (path === '/inventario-seg'           && method === 'GET')    return await getInventarioSeg(request, env);
      if (path === '/inventario-seg'           && method === 'POST')   return await crearItemSeg(request, env);
      if (path.startsWith('/inventario-seg/')) {
        const segId = parseInt(path.split('/inventario-seg/')[1]);
        if (method === 'DELETE') return await eliminarItemSeg(segId, request, env);
        if (method === 'PUT')    return await moverItemSeg(segId, request, env);
      }
      if (path.startsWith('/buscar-item-seg/') && method === 'GET') {
        const cod = decodeURIComponent(path.split('/buscar-item-seg/')[1]);
        return await buscarItemSeg(cod, env);
      }
      if (path === '/tipos-material-seg'       && method === 'GET')    return await getCatalogo('tipos_material_seg', env, request);
      if (path === '/tipos-material-seg'       && method === 'POST')   return await addTipoMaterialSeg(request, env);
      if (path.startsWith('/tipos-material-seg/') && method === 'DELETE') {
        const tid = parseInt(path.split('/tipos-material-seg/')[1]);
        return await delCatalogo('tipos_material_seg', tid, env);
      }

      // ── Pedidos ──────────────────────────────────────────────────────────────
      if (path === '/pedidos' && method === 'GET')  return await getPedidos(request, env);
      if (path === '/pedidos' && method === 'POST') return await crearPedido(request, env);
      if (path.startsWith('/pedidos/')) {
        const pid = parseInt(path.split('/pedidos/')[1]);
        if (method === 'PUT')    return await actualizarPedido(pid, request, env);
        if (method === 'DELETE') return await eliminarPedido(pid, request, env);
      }

      // ── Herramientas ─────────────────────────────────────────────────────────
      if (path === '/tipos-herramienta' && method === 'GET')  return await getTiposHerramienta(request, env);
      if (path === '/tipos-herramienta' && method === 'POST') return await crearTipoHerramienta(request, env);
      if (path.startsWith('/tipos-herramienta/')) {
        const tid = parseInt(path.split('/tipos-herramienta/')[1]);
        if (method === 'DELETE') return await eliminarTipoHerramienta(tid, request, env);
      }
      if (path === '/kits-herramientas' && method === 'GET')  return await getKits(request, env);
      if (path === '/kits-herramientas' && method === 'POST') return await crearKit(request, env, ctx);
      if (path.startsWith('/kits-herramientas/')) {
        const kid = parseInt(path.split('/kits-herramientas/')[1]);
        if (method === 'GET')    return await getKit(kid, request, env);
        if (method === 'PUT')    return await actualizarKit(kid, request, env, ctx);
        if (method === 'DELETE') return await eliminarKit(kid, request, env, ctx);
      }
      if (path === '/herramientas' && method === 'GET')  return await getHerramientas(request, env);
      if (path === '/herramientas' && method === 'POST') return await crearHerramienta(request, env, ctx);
      if (path === '/herramientas/buscar' && method === 'GET') return await buscarHerramienta(request, env);
      if (path.startsWith('/herramientas/')) {
        const hid = parseInt(path.split('/herramientas/')[1]);
        if (method === 'GET')    return await getHerramienta(hid, request, env);
        if (method === 'PUT')    return await actualizarHerramienta(hid, request, env, ctx);
        if (method === 'DELETE') return await eliminarHerramienta(hid, request, env, ctx);
      }
      if (path === '/historial-herramientas' && method === 'GET') return await getHistorialHerramientas(request, env);

      // ── Archivos / R2 ────────────────────────────────────────────────────
      if (path === '/archivos' && method === 'GET')  return await listarArchivos(request, env);
      if (path === '/archivos' && method === 'POST') return await subirArchivo(request, env);
      if (path.startsWith('/archivos/')) {
        const aid = parseInt(path.split('/archivos/')[1]);
        if (method === 'GET')    return await descargarArchivo(aid, request, env);
        if (method === 'DELETE') return await borrarArchivo(aid, request, env);
      }

      // ── Documentación departamentos ───────────────────────────────────────
      if (path === '/carpetas' && method === 'GET')  return await listarCarpetas(request, env);
      if (path === '/carpetas' && method === 'POST') return await crearCarpeta(request, env);
      if (path.startsWith('/carpetas/')) {
        const cid = parseInt(path.split('/carpetas/')[1]);
        if (method === 'DELETE') return await borrarCarpeta(cid, request, env);
      }
      if (path === '/docs-dept' && method === 'GET')  return await listarDocsDept(request, env);
      if (path === '/docs-dept' && method === 'POST') return await subirDocDept(request, env);
      if (path.startsWith('/docs-dept/')) {
        const did = parseInt(path.split('/docs-dept/')[1]);
        if (method === 'GET')    return await descargarDocDept(did, request, env);
        if (method === 'DELETE') return await borrarDocDept(did, request, env);
      }

      // ── Personal ──────────────────────────────────────────────────────────
      if (path === '/horarios-obra' && method === 'GET')  return await getHorariosObra(request, env);
      if (path === '/horarios-obra' && method === 'POST') return await guardarHorarioObra(request, env);
      if (path.startsWith('/horarios-obra/')) {
        const hoid = parseInt(path.split('/horarios-obra/')[1]);
        if (method === 'PUT')    return await actualizarHorarioObra(hoid, request, env);
        if (method === 'DELETE') return await eliminarHorarioObra(hoid, request, env);
      }
      if (path === '/fichajes' && method === 'GET')  return await getFichajes(request, env);
      if (path === '/fichajes' && method === 'POST') return await crearFichaje(request, env);
      if (path.startsWith('/fichajes/')) {
        const fid = parseInt(path.split('/fichajes/')[1]);
        if (method === 'PUT')    return await actualizarFichaje(fid, request, env);
        if (method === 'DELETE') return await eliminarFichaje(fid, request, env);
      }
      if (path === '/personal/semana' && method === 'GET') return await getResumenSemana(request, env);
      if (path === '/personal/mes'    && method === 'GET') return await getResumenMes(request, env);
      if (path === '/personal/trabajadores' && method === 'GET') return await getTrabajadores(request, env);
      if (path === '/personal-externo' && method === 'GET')  return await getPersonalExterno(request, env);
      if (path === '/personal-externo' && method === 'POST') return await crearPersonalExterno(request, env);
      if (path.startsWith('/personal-externo/')) {
        const peid = parseInt(path.split('/personal-externo/')[1]);
        if (method === 'PUT')    return await actualizarPersonalExterno(peid, request, env);
        if (method === 'DELETE') return await eliminarPersonalExterno(peid, request, env);
      }

      // ── Otros (legacy/extras) ─────────────────────────────────────────────
      if (path === '/logs'         && method === 'GET')   return await getLogs(request, env);
      if (path === '/historial'    && method === 'GET')   return await getHistorial(request, env);
      if (path === '/pemp/historial'         && method === 'GET') return await getHistorialTabla('historial_pemp', request, env);
      if (path === '/carretillas/historial'  && method === 'GET') return await getHistorialTabla('historial_carretillas', request, env);
      if (path === '/stats'        && method === 'GET')   return await getStats(request, env);
      if (path === '/sheet-id'     && method === 'GET')   return json({ id: env.GOOGLE_SHEET_ID || null });
      if ((path === '/sync' || path === '/sync-sheets') && method === 'POST') { await Promise.all([syncSheets(env), syncPedidos(env)]); return json({ ok: true, mensaje: 'Sync completado' }); }
      if (path === '/sync-debug'   && method === 'POST')  return await syncSheetsDebug(env);

      // ── Backup / Restaurar ────────────────────────────────────────────────
      if (path === '/backup/inventario'    && method === 'GET')  return await backupInventario(request, env);
      if (path === '/backup/empresa'       && method === 'GET')  return await backupEmpresa(request, env);
      if (path === '/restaurar/inventario' && method === 'POST') return await restaurarInventario(request, env);
      if (path === '/restaurar/empresa'    && method === 'POST') return await restaurarEmpresa(request, env);

      return err('Ruta no encontrada', 404);
    } catch (e) {
      console.error(e);
      return err(`Error interno: ${e.message}`, 500);
    }
  },

  // ── Cron diario: alertas + cierre jornada ────────────────────────────────
  async scheduled(event, env, ctx) {
    if (event.cron === '0 18 * * *') {
      ctx.waitUntil(cierreAutomaticoJornada(env));
    } else {
      ctx.waitUntil(alertasDiarias(env));
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════
// VERIFICAR ACCESO
// ════════════════════════════════════════════════════════════════════════════

// Genera un token aleatorio seguro (64 hex chars)
function generarToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Crea una sesión en D1 y devuelve el token
async function crearSesion(env, { nombre, rol, obra_id, obra_nombre, departamento, es_admin, usuario_id, empresa_id }) {
  const token = generarToken();
  await env.DB.prepare(
    'INSERT INTO sesiones (token, usuario_id, nombre, rol, obra_id, obra_nombre, departamento, es_admin, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(token, usuario_id || null, nombre, rol, obra_id || null, obra_nombre || null, departamento || 'electrico', es_admin ? 1 : 0, empresa_id || 1).run();
  return token;
}

async function verificarAcceso(request, env) {
  const body = await request.json().catch(() => ({}));
  const codigo = body.codigo || body.code || '';
  const obraRef = body.obra_id || body.obra || null;

  // 1.5 Login por email + contraseña (empresa_admin y usuarios con email)
  const emailInput = (body.email || '').trim().toLowerCase();
  const passInput  = body.password || '';
  if (emailInput && passInput) {
    try {
      const u = await env.DB.prepare(
        'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE LOWER(u.email) = ? AND u.activo = 1 LIMIT 1'
      ).bind(emailInput).first();
      if (!u || !u.password_hash) return err('Email o contraseña incorrectos', 401);
      const valid = await verifyPassword(passInput, u.password_hash);
      if (!valid) return err('Email o contraseña incorrectos', 401);
      const dept = u.rol === 'empresa_admin' ? null : (u.departamento || 'electrico');
      const token = await crearSesion(env, {
        nombre: u.nombre, rol: u.rol, obra_id: u.obra_id, obra_nombre: u.obra_nombre,
        departamento: dept, es_admin: false, usuario_id: u.id, empresa_id: u.empresa_id || 1,
      });
      return json({ ok: true, nombre: u.nombre, rol: u.rol, obra_id: u.obra_id, obra_nombre: u.obra_nombre, departamento: dept, token });
    } catch(e) { return err('Error en login: ' + e.message, 500); }
  }

  if (!codigo) return err('Falta el código');

  // 1. ¿Es superadmin?
  if (env.ADMIN_CODE && codigo.trim() === env.ADMIN_CODE) {
    const token = await crearSesion(env, { nombre: 'Admin', rol: 'superadmin', obra_id: null, obra_nombre: null, departamento: null, es_admin: true, empresa_id: 1 });
    return json({ ok: true, rol: 'superadmin', nombre: 'Admin', obra_id: null, obra_nombre: null, token });
  }

  // 2. Buscar en tabla usuarios
  try {
    const usuario = await env.DB.prepare(
      'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE u.codigo = ? AND u.activo = 1'
    ).bind(codigo.trim()).first();

    if (usuario) {
      // Si se pasa obra de referencia, verificar que coincide
      if (obraRef) {
        const obraIdNum = parseInt(obraRef);
        const coincideId   = !isNaN(obraIdNum) && usuario.obra_id === obraIdNum;
        const coincideNombre = typeof obraRef === 'string' &&
          (usuario.obra_nombre?.toLowerCase() === obraRef.toLowerCase() ||
           String(usuario.obra_id) === String(obraRef));
        if (!coincideId && !coincideNombre) {
          return err('El usuario no pertenece a esa obra', 403);
        }
      }
      await sendTelegram(env, `👤 <b>Login</b>: ${usuario.nombre} (${usuario.rol})\n🏗 ${usuario.obra_nombre || '—'}  🔷 ${usuario.departamento || '—'}`);
      await logActividad(env, { nivel: 'info', origen: 'login', mensaje: `Login: ${usuario.nombre} (${usuario.rol})`, detalle: `obra: ${usuario.obra_nombre || '—'} | dept: ${usuario.departamento || '—'}`, empresa_id: usuario.empresa_id || 1 });
      const token = await crearSesion(env, {
        nombre: usuario.nombre, rol: usuario.rol,
        obra_id: usuario.obra_id, obra_nombre: usuario.obra_nombre,
        departamento: usuario.departamento || 'electrico',
        es_admin: false, usuario_id: usuario.id,
        empresa_id: usuario.empresa_id || 1,
      });
      return json({
        ok: true,
        nombre: usuario.nombre,
        rol: usuario.rol,
        obra_id: usuario.obra_id,
        obra_nombre: usuario.obra_nombre,
        departamento: usuario.departamento || 'electrico',
        token,
      });
    }
  } catch (e) {
    console.error('Error verificar usuario:', e.message);
  }

  // 3. Fallback legacy: código o nombre de obra
  try {
    const obra = await env.DB.prepare(
      'SELECT * FROM obras WHERE (codigo = ? OR LOWER(nombre) = LOWER(?)) AND activa = 1'
    ).bind(codigo.trim().toUpperCase(), codigo.trim()).first();
    if (obra) {
      const token = await crearSesion(env, { nombre: obra.nombre, rol: 'operario', obra_id: obra.id, obra_nombre: obra.nombre, departamento: 'electrico', es_admin: false, empresa_id: 1 });
      return json({ ok: true, tipo: 'obra', rol: 'operario', obra_id: obra.id, obra_nombre: obra.nombre, obra, token });
    }
  } catch (_) {}

  return err('Código inválido', 401);
}

async function actualizarSesionDepartamento(request, env) {
  const xToken = request.headers.get('X-Token');
  if (!xToken) return err('No autorizado', 403);
  const { departamento } = await request.json().catch(() => ({}));
  const validos = ['electrico', 'mecanicas', 'seguridad', 'personal'];
  if (!departamento || !validos.includes(departamento)) return err('Departamento inválido', 400);
  await env.DB.prepare('UPDATE sesiones SET departamento = ? WHERE token = ?').bind(departamento, xToken).run();
  return json({ ok: true });
}

async function cerrarSesionServidor(request, env) {
  const token = request.headers.get('X-Token');
  if (token) {
    try {
      await env.DB.prepare('DELETE FROM sesiones WHERE token = ?').bind(token).run();
    } catch (_) {}
  }
  return json({ ok: true });
}

async function getSesionesActivas(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin && !auth.isAdmin && !auth.isEncargado) return err('No autorizado', 403);
  const { results } = await env.DB.prepare(
    'SELECT id, nombre, rol, departamento, obra_nombre, last_used, created_at FROM sesiones WHERE empresa_id = ? ORDER BY last_used DESC'
  ).bind(auth.empresa_id).all();
  return json(results);
}

async function cerrarTodasSesiones(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin && !auth.isAdmin && !auth.isEmpresaAdmin) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { rol, excepto_token } = body;
  const miToken = request.headers.get('X-Token');
  if (rol) {
    await env.DB.prepare('DELETE FROM sesiones WHERE empresa_id = ? AND rol = ? AND token != ?')
      .bind(auth.empresa_id, rol, miToken || '').run();
  } else {
    await env.DB.prepare('DELETE FROM sesiones WHERE empresa_id = ? AND token != ?')
      .bind(auth.empresa_id, miToken || '').run();
  }
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// EMPRESAS — REGISTRO Y GESTIÓN
// ════════════════════════════════════════════════════════════════════════════

async function registrarEmpresa(request, env) {
  const body = await request.json().catch(() => ({}));
  const { empresa_nombre, sector, admin_nombre, email, password, obra_nombre } = body;
  if (!empresa_nombre?.trim() || !email?.trim() || !password || !admin_nombre?.trim())
    return err('Faltan datos obligatorios (empresa, nombre, email, contraseña)');
  if (password.length < 8) return err('La contraseña debe tener al menos 8 caracteres');

  const emailClean = email.trim().toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM usuarios WHERE LOWER(email) = ? LIMIT 1').bind(emailClean).first();
  if (existing) return err('Este email ya está registrado', 409);

  const slug = empresa_nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const hash = await hashPassword(password);

  // Crear empresa
  const empResult = await env.DB.prepare(
    'INSERT INTO empresas (nombre, slug, email, plan, activa) VALUES (?, ?, ?, ?, 1)'
  ).bind(empresa_nombre.trim(), slug, emailClean, 'basic').run();
  const empresa_id = empResult.meta.last_row_id;
  if (!empresa_id) return err('Error al crear la empresa, intenta de nuevo');

  // Crear primera obra (opcional)
  let obra_id = null, obra_nombre_final = null;
  if (obra_nombre?.trim()) {
    const codObra = Math.random().toString(36).substring(2, 8).toUpperCase();
    const obraResult = await env.DB.prepare(
      'INSERT INTO obras (nombre, codigo, activa, empresa_id) VALUES (?, ?, 1, ?)'
    ).bind(obra_nombre.trim(), codObra, empresa_id).run();
    obra_id = obraResult.meta.last_row_id;
    obra_nombre_final = obra_nombre.trim();
  }

  // Crear usuario admin
  const codAdmin = 'ADM' + empresa_id + '_' + Math.random().toString(36).substring(2,5).toUpperCase();
  await env.DB.prepare(
    'INSERT INTO usuarios (nombre, codigo, email, password_hash, rol, departamento, activo, empresa_id, obra_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
  ).bind(admin_nombre.trim(), codAdmin, emailClean, hash, 'empresa_admin', 'electrico', empresa_id, obra_id).run();

  const adminUser = await env.DB.prepare('SELECT id FROM usuarios WHERE LOWER(email) = ? LIMIT 1').bind(emailClean).first();
  const token = await crearSesion(env, {
    nombre: admin_nombre.trim(), rol: 'empresa_admin', obra_id, obra_nombre: obra_nombre_final,
    departamento: null, es_admin: false, usuario_id: adminUser.id, empresa_id,
  });

  await sendTelegram(env, `🏢 <b>Nueva empresa:</b> ${empresa_nombre}\n👤 ${admin_nombre} (${emailClean})\n🏗 Obra: ${obra_nombre_final || '—'}`);
  return json({ ok: true, token, rol: 'empresa_admin', nombre: admin_nombre.trim(), empresa_nombre: empresa_nombre.trim(), empresa_id, obra_id, obra_nombre: obra_nombre_final });
}

async function getEmpresas(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin) return err('Sin permisos', 403);
  const rows = await env.DB.prepare(
    'SELECT id, nombre, slug, email, plan, activa, created_at FROM empresas WHERE activa = 1 ORDER BY nombre'
  ).all();
  return json(rows.results || []);
}

async function superadminSeleccionarEmpresa(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin) return err('Sin permisos', 403);
  const body = await request.json();
  const empresa_id = parseInt(body.empresa_id);
  if (!empresa_id) return err('empresa_id requerido', 400);
  const empresa = await env.DB.prepare('SELECT id, nombre FROM empresas WHERE id = ?').bind(empresa_id).first();
  if (!empresa) return err('Empresa no encontrada', 404);
  const xToken = request.headers.get('X-Token');
  if (xToken) {
    await env.DB.prepare('UPDATE sesiones SET empresa_id = ? WHERE token = ?').bind(empresa_id, xToken).run();
  }
  return json({ ok: true, empresa_id: empresa.id, empresa_nombre: empresa.nombre });
}

async function getMiEmpresa(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id) return err('Sin empresa asignada', 403);
  const empresa = await env.DB.prepare('SELECT id, nombre, slug, email, telefono, direccion, cif, plan, activa, created_at, departamentos FROM empresas WHERE id = ?').bind(auth.empresa_id).first();
  if (!empresa) return err('Empresa no encontrada', 404);
  const obras    = (await env.DB.prepare('SELECT id, nombre, codigo FROM obras WHERE empresa_id = ? AND activa = 1 ORDER BY nombre').bind(auth.empresa_id).all()).results;
  const usuarios = (await env.DB.prepare('SELECT id, nombre, rol, departamento, obra_id FROM usuarios WHERE empresa_id = ? AND activo = 1 ORDER BY nombre').bind(auth.empresa_id).all()).results;
  return json({ empresa, obras, usuarios });
}

async function updateMiEmpresa(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id || (auth.rol !== 'empresa_admin' && !auth.isSuperadmin)) return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { nombre, email, telefono, direccion, cif, departamentos } = body;
  if (!nombre?.trim()) return err('Falta el nombre de la empresa');
  const campos = ['nombre = ?'];
  const vals   = [nombre.trim()];
  if (email         !== undefined) { campos.push('email = ?');         vals.push(email?.trim()     || null); }
  if (telefono      !== undefined) { campos.push('telefono = ?');      vals.push(telefono?.trim()  || null); }
  if (direccion     !== undefined) { campos.push('direccion = ?');     vals.push(direccion?.trim() || null); }
  if (cif           !== undefined) { campos.push('cif = ?');           vals.push(cif?.trim()       || null); }
  if (departamentos !== undefined) {
    const val = departamentos ? JSON.stringify(Array.isArray(departamentos) ? departamentos : departamentos) : null;
    campos.push('departamentos = ?'); vals.push(val);
  }
  vals.push(auth.empresa_id);
  await env.DB.prepare(`UPDATE empresas SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// OBRAS
// ════════════════════════════════════════════════════════════════════════════

async function getObras(request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const { results } = await env.DB.prepare('SELECT * FROM obras WHERE empresa_id = ? ORDER BY nombre').bind(empresa_id).all();
  return json(results);
}

async function crearObra(request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const { nombre, codigo } = await request.json();
  if (!nombre?.trim() || !codigo?.trim()) return err('Faltan nombre y código');
  try {
    const r = await env.DB.prepare('INSERT INTO obras (nombre, codigo, empresa_id) VALUES (?, ?, ?)')
      .bind(nombre.trim(), codigo.trim().toUpperCase(), empresa_id).run();
    return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim(), codigo: codigo.trim().toUpperCase() }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`El código "${codigo}" ya existe`, 409);
    throw e;
  }
}

async function eliminarObra(id, request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin) return err('No autorizado', 403);
  await env.DB.prepare('UPDATE obras SET activa = 0 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// BOBINAS
// ════════════════════════════════════════════════════════════════════════════

async function getBobinas(request, env) {
  const { obraId, isSuperadmin, isEmpresaAdmin, departamento, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraParamRaw = url.searchParams.get('obra_id');
  const obraParam = obraParamRaw ? parseInt(obraParamRaw) : null;
  // SA/EA can override obra via query param; regular users use their session obra
  const obraFilter = (isSuperadmin || isEmpresaAdmin) ? obraParam : (obraId || null);

  let sql = 'SELECT * FROM bobinas WHERE empresa_id = ?';
  const params = [empresa_id];
  if (!isSuperadmin) { sql += ' AND departamento = ?'; params.push(departamento); }
  if (obraFilter) { sql += ' AND obra_id = ?'; params.push(obraFilter); }
  if (estado)     { sql += ' AND estado = ?';  params.push(estado); }
  if (buscar) {
    sql += ' AND (codigo LIKE ? OR proveedor LIKE ? OR tipo_cable LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearBobina(request, env, ctx) {
  const { obraId, usuario, departamento, empresa_id } = await getAuth(request, env);
  const body = await request.json();
  const { codigo, proveedor, tipo_cable, notas, registrado_por, num_albaran } = body;
  if (!codigo || !proveedor || !tipo_cable) return err('Faltan campos: codigo, proveedor, tipo_cable');

  const obraFinal = body.obra_id ? parseInt(body.obra_id) : obraId;
  const fecha = fechaEspana();
  const reg = registrado_por || usuario || '';

  try {
    await env.DB.prepare(
      'INSERT INTO bobinas (codigo, proveedor, tipo_cable, fecha_entrada, estado, notas, registrado_por, obra_id, num_albaran, departamento, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(codigo.trim().toUpperCase(), proveedor, tipo_cable, fecha, 'activa', notas || '', reg, obraFinal || null, num_albaran || null, departamento, empresa_id).run();

    ctx.waitUntil(Promise.all([
      syncSheets(env, 'Elec-Bobinas'),
      registrarHistorial(env, { obra_id: obraFinal, bobina_codigo: codigo.trim().toUpperCase(), accion: 'entrada', usuario: reg, notas: notas || '' }),
      sendTelegram(env, `📦 <b>Nueva bobina registrada</b>\n🔖 ${codigo.trim().toUpperCase()}\n🔌 ${tipo_cable}  📦 ${proveedor}\n👤 ${reg}`),
    ]));

    return json({ ok: true, mensaje: `Bobina ${codigo} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La bobina ${codigo} ya está registrada`, 409);
    throw e;
  }
}

async function editarBobina(codigo, request, env) {
  const { obraId, isSuperadmin } = await getAuth(request, env);
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (obraId && !isSuperadmin && bobina.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const proveedor  = body.proveedor  !== undefined ? body.proveedor  : bobina.proveedor;
  const tipo_cable = body.tipo_cable !== undefined ? body.tipo_cable : bobina.tipo_cable;
  const notas      = body.notas      !== undefined ? body.notas      : bobina.notas;
  const estado     = body.estado     !== undefined ? body.estado     : bobina.estado;
  const obra_id    = body.obra_id    !== undefined ? (body.obra_id ? parseInt(body.obra_id) : null) : bobina.obra_id;
  const num_albaran  = body.num_albaran  !== undefined ? body.num_albaran  : bobina.num_albaran;
  const departamento = body.departamento !== undefined ? body.departamento : bobina.departamento;

  await env.DB.prepare(
    'UPDATE bobinas SET proveedor = ?, tipo_cable = ?, notas = ?, estado = ?, obra_id = ?, num_albaran = ?, departamento = ? WHERE codigo = ?'
  ).bind(proveedor, tipo_cable, notas, estado, obra_id, num_albaran || null, departamento, codigo).run();

  return json({ ok: true, mensaje: `Bobina ${codigo} actualizada` });
}

async function devolverBobina(codigo, request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;
  const fecha = fechaEspana();

  let bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();

  if (!bobina) {
    // Auto-crear como devuelta si no existe
    const { obraId } = await getAuth(request, env);
    await env.DB.prepare(
      `INSERT INTO bobinas (codigo, estado, fecha_entrada, fecha_devolucion, devuelto_por, notas, obra_id)
       VALUES (?, 'devuelta', ?, ?, ?, ?, ?)`
    ).bind(codigo.trim().toUpperCase(), fecha, fecha, devuelto_por || '', 'Creado automáticamente en devolución', obraId || null).run();
    bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
    ctx.waitUntil(Promise.all([
      syncSheets(env, 'Elec-Bobinas'),
      registrarHistorial(env, { obra_id: bobina?.obra_id, bobina_codigo: codigo, accion: 'devolucion', usuario: devuelto_por, notas: 'Auto-creado en devolución' }),
    ]));
    return json({ ok: true, mensaje: `Bobina ${codigo} no estaba registrada. Se ha creado y marcado como devuelta automáticamente`, fecha_devolucion: fecha });
  }

  if (bobina.estado === 'devuelta') return err(`Bobina ${codigo} ya fue devuelta el ${bobina.fecha_devolucion}`, 409);

  await env.DB.prepare(
    'UPDATE bobinas SET estado = ?, fecha_devolucion = ?, notas = ?, devuelto_por = ? WHERE codigo = ?'
  ).bind('devuelta', fecha, notas || bobina.notas || '', devuelto_por || '', codigo).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, 'Elec-Bobinas'),
    registrarHistorial(env, { obra_id: bobina.obra_id, bobina_codigo: codigo, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
    sendTelegram(env, `📤 <b>Bobina devuelta</b>\n🔖 ${codigo}\n👤 ${devuelto_por || '—'}`),
  ]));

  return json({ ok: true, mensaje: `Bobina ${codigo} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarBobina(codigo, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId } = await getAuth(request, env);
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && bobina.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM bobinas WHERE codigo = ?').bind(codigo).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, 'Elec-Bobinas'),
    registrarHistorial(env, { obra_id: bobina.obra_id, bobina_codigo: codigo, accion: 'eliminacion', usuario: '' }),
    sendTelegram(env, `🗑️ <b>Bobina eliminada</b>\n🔖 ${codigo}`),
  ]));

  return json({ ok: true, mensaje: `Bobina ${codigo} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// PEMP
// ════════════════════════════════════════════════════════════════════════════

async function getPemp(request, env) {
  const { obraId, isSuperadmin, isEmpresaAdmin, isSeguridad, departamento, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraParamRaw = url.searchParams.get('obra_id');
  const obraParam = obraParamRaw ? parseInt(obraParamRaw) : null;
  const obraFilter = (isSuperadmin || isEmpresaAdmin) ? obraParam : (obraId || null);

  let sql = 'SELECT * FROM pemp WHERE empresa_id = ?';
  const params = [empresa_id];
  // Superadmin ve todo; el resto solo su departamento
  if (!isSuperadmin) { sql += ' AND departamento = ?'; params.push(departamento); }
  if (obraFilter)  { sql += ' AND obra_id = ?'; params.push(obraFilter); }
  if (estado)  { sql += ' AND estado = ?';  params.push(estado); }
  if (buscar) {
    sql += ' AND (matricula LIKE ? OR tipo LIKE ? OR marca LIKE ? OR proveedor LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearPemp(request, env, ctx) {
  const { obraId, usuario, departamento, empresa_id } = await getAuth(request, env);
  const body = await request.json();
  const {
    matricula, tipo, marca, proveedor, energia, estado = 'activa',
    fecha_entrada, registrado_por, notas,
    fecha_ultima_revision, fecha_proxima_revision,
  } = body;

  if (!matricula) return err('Falta el campo: matricula');

  const obraFinal = body.obra_id ? parseInt(body.obra_id) : obraId;
  const fecha = fecha_entrada || fechaEspana();
  const reg = registrado_por || usuario || '';

  try {
    const r = await env.DB.prepare(
      `INSERT INTO pemp
        (matricula, tipo, marca, proveedor, energia, estado, fecha_entrada, registrado_por, notas,
         fecha_ultima_revision, fecha_proxima_revision, obra_id, departamento, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      matricula.trim().toUpperCase(), tipo || '', marca || '', proveedor || '', energia || '',
      estado, fecha, reg, notas || '',
      fecha_ultima_revision || null, fecha_proxima_revision || null,
      obraFinal || null, departamento, empresa_id
    ).run();

    const id = r.meta.last_row_id;

    ctx.waitUntil(Promise.all([
      syncSheets(env, tabForDept('pemp', departamento)),
      registrarHistorialPemp(env, {
        obra_id: obraFinal, matricula: matricula.trim().toUpperCase(),
        accion: 'entrada', usuario: reg, notas: notas || '',
      }),
      sendTelegram(env, `🏗 <b>Nueva PEMP registrada</b>\n🔖 ${matricula.trim().toUpperCase()}\n🔧 ${tipo || '—'}  🏭 ${marca || '—'}  ⚡ ${energia || '—'}\n👤 ${reg}`),
    ]));

    return json({ ok: true, id, mensaje: `PEMP ${matricula} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La PEMP ${matricula} ya está registrada`, 409);
    throw e;
  }
}

async function editarPemp(matricula, request, env) {
  const { obraId, isSuperadmin } = await getAuth(request, env);
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();
  if (!pemp) return err(`PEMP ${matricula} no encontrada`, 404);
  if (obraId && !isSuperadmin && pemp.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const campos = ['tipo', 'marca', 'proveedor', 'energia', 'estado', 'notas', 'fecha_ultima_revision', 'fecha_proxima_revision', 'obra_id', 'departamento'];
  let notifAveria = false, notifReparado = false;
  // Fechas automáticas según cambio de estado
  if (body.estado !== undefined) {
    if (body.estado === 'Averiada' && pemp.estado !== 'Averiada') {
      body.fecha_averia = fechaEspana();
      campos.push('fecha_averia');
      notifAveria = true;
    } else if (body.estado === 'Disponible' && pemp.estado === 'Averiada') {
      body.fecha_reparacion = fechaEspana();
      campos.push('fecha_reparacion');
      notifReparado = true;
    }
  }
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (sets.length === 0) return err('No hay campos para actualizar');
  vals.push(matricula);

  await env.DB.prepare(`UPDATE pemp SET ${sets.join(', ')} WHERE matricula = ?`).bind(...vals).run();
  if (notifAveria)   await sendTelegram(env, `🔴 <b>PEMP AVERIADA</b>\n🔖 ${matricula}\n🏗 Obra: ${pemp.obra_id || '—'}`);
  if (notifReparado) await sendTelegram(env, `🟢 <b>PEMP Reparada</b>\n🔖 ${matricula}`);
  return json({ ok: true, mensaje: `PEMP ${matricula} actualizada` });
}

async function devolverPemp(matricula, request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;
  const fecha = fechaEspana();

  let pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();

  if (!pemp) {
    // Auto-crear como devuelta si no existe
    const { obraId, departamento } = await getAuth(request, env);
    await env.DB.prepare(
      `INSERT INTO pemp (matricula, estado, fecha_entrada, fecha_devolucion, devuelto_por, notas, obra_id)
       VALUES (?, 'devuelta', ?, ?, ?, ?, ?)`
    ).bind(matricula.trim().toUpperCase(), fecha, fecha, devuelto_por || '', 'Creado automáticamente en devolución', obraId || null).run();
    pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();
    ctx.waitUntil(Promise.all([
      syncSheets(env, tabForDept('pemp', departamento)),
      registrarHistorialPemp(env, { obra_id: pemp?.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: 'Auto-creado en devolución' }),
    ]));
    return json({ ok: true, mensaje: `PEMP ${matricula} no estaba registrada. Se ha creado y marcado como devuelta automáticamente`, fecha_devolucion: fecha });
  }

  if (pemp.estado === 'devuelta') return err(`PEMP ${matricula} ya fue devuelta el ${pemp.fecha_devolucion}`, 409);

  await env.DB.prepare(
    'UPDATE pemp SET estado = ?, fecha_devolucion = ?, devuelto_por = ?, notas = ? WHERE matricula = ?'
  ).bind('devuelta', fecha, devuelto_por || '', notas || pemp.notas || '', matricula).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('pemp', pemp.departamento)),
    registrarHistorialPemp(env, { obra_id: pemp.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
    sendTelegram(env, `📤 <b>PEMP devuelta</b>\n🔖 ${matricula}\n👤 ${devuelto_por || '—'}`),
  ]));

  return json({ ok: true, mensaje: `PEMP ${matricula} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarPemp(matricula, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId } = await getAuth(request, env);
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();
  if (!pemp) return err(`PEMP ${matricula} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && pemp.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM pemp WHERE matricula = ?').bind(matricula).run();
  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('pemp', pemp.departamento)),
    sendTelegram(env, `🗑️ <b>PEMP eliminada</b>\n🔖 ${matricula}`),
  ]));
  return json({ ok: true, mensaje: `PEMP ${matricula} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// CARRETILLAS
// ════════════════════════════════════════════════════════════════════════════

async function getCarretillas(request, env) {
  const { obraId, isSuperadmin, isEmpresaAdmin, isSeguridad, departamento, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraParamRaw = url.searchParams.get('obra_id');
  const obraParam = obraParamRaw ? parseInt(obraParamRaw) : null;
  const obraFilter = (isSuperadmin || isEmpresaAdmin) ? obraParam : (obraId || null);

  let sql = 'SELECT * FROM carretillas WHERE empresa_id = ?';
  const params = [empresa_id];
  // Superadmin ve todo; el resto solo su departamento
  if (!isSuperadmin) { sql += ' AND departamento = ?'; params.push(departamento); }
  if (obraFilter)  { sql += ' AND obra_id = ?'; params.push(obraFilter); }
  if (estado)  { sql += ' AND estado = ?';  params.push(estado); }
  if (buscar) {
    sql += ' AND (matricula LIKE ? OR tipo LIKE ? OR marca LIKE ? OR proveedor LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearCarretilla(request, env, ctx) {
  const { obraId, usuario, departamento, empresa_id } = await getAuth(request, env);
  const body = await request.json();
  const {
    matricula, tipo, marca, proveedor, energia, estado = 'activa',
    fecha_entrada, registrado_por, notas,
    fecha_ultima_revision, fecha_proxima_revision,
  } = body;

  if (!matricula) return err('Falta el campo: matricula');

  const obraFinal = body.obra_id ? parseInt(body.obra_id) : obraId;
  const fecha = fecha_entrada || fechaEspana();
  const reg = registrado_por || usuario || '';

  try {
    const r = await env.DB.prepare(
      `INSERT INTO carretillas
        (matricula, tipo, marca, proveedor, energia, estado, fecha_entrada, registrado_por, notas,
         fecha_ultima_revision, fecha_proxima_revision, obra_id, departamento, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      matricula.trim().toUpperCase(), tipo || '', marca || '', proveedor || '', energia || '',
      estado, fecha, reg, notas || '',
      fecha_ultima_revision || null, fecha_proxima_revision || null,
      obraFinal || null, departamento, empresa_id
    ).run();

    const id = r.meta.last_row_id;

    ctx.waitUntil(Promise.all([
      syncSheets(env, tabForDept('carretilla', departamento)),
      registrarHistorialCarretillas(env, {
        obra_id: obraFinal, matricula: matricula.trim().toUpperCase(),
        accion: 'entrada', usuario: reg, notas: notas || '',
      }),
      sendTelegram(env, `🚜 <b>Nueva carretilla registrada</b>\n🔖 ${matricula.trim().toUpperCase()}\n🔧 ${tipo || '—'}  ⚡ ${energia || '—'}\n👤 ${reg}`),
    ]));

    return json({ ok: true, id, mensaje: `Carretilla ${matricula} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La carretilla ${matricula} ya está registrada`, 409);
    throw e;
  }
}

async function editarCarretilla(matricula, request, env) {
  const { obraId, isSuperadmin } = await getAuth(request, env);
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();
  if (!carretilla) return err(`Carretilla ${matricula} no encontrada`, 404);
  if (obraId && !isSuperadmin && carretilla.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const campos = ['tipo', 'marca', 'proveedor', 'energia', 'estado', 'notas', 'fecha_ultima_revision', 'fecha_proxima_revision', 'obra_id', 'departamento'];
  let notifAveria = false, notifReparado = false;
  if (body.estado !== undefined) {
    if (body.estado === 'Averiada' && carretilla.estado !== 'Averiada') {
      body.fecha_averia = fechaEspana();
      campos.push('fecha_averia');
      notifAveria = true;
    } else if (body.estado === 'Disponible' && carretilla.estado === 'Averiada') {
      body.fecha_reparacion = fechaEspana();
      campos.push('fecha_reparacion');
      notifReparado = true;
    }
  }
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (sets.length === 0) return err('No hay campos para actualizar');
  vals.push(matricula);

  await env.DB.prepare(`UPDATE carretillas SET ${sets.join(', ')} WHERE matricula = ?`).bind(...vals).run();
  if (notifAveria)   await sendTelegram(env, `🔴 <b>Carretilla AVERIADA</b>\n🔖 ${matricula}`);
  if (notifReparado) await sendTelegram(env, `🟢 <b>Carretilla Reparada</b>\n🔖 ${matricula}`);
  return json({ ok: true, mensaje: `Carretilla ${matricula} actualizada` });
}

async function devolverCarretilla(matricula, request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;
  const fecha = fechaEspana();

  let carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();

  if (!carretilla) {
    // Auto-crear como devuelta si no existe
    const { obraId, departamento } = await getAuth(request, env);
    await env.DB.prepare(
      `INSERT INTO carretillas (matricula, estado, fecha_entrada, fecha_devolucion, devuelto_por, notas, obra_id)
       VALUES (?, 'devuelta', ?, ?, ?, ?, ?)`
    ).bind(matricula.trim().toUpperCase(), fecha, fecha, devuelto_por || '', 'Creado automáticamente en devolución', obraId || null).run();
    carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();
    ctx.waitUntil(Promise.all([
      syncSheets(env, tabForDept('carretilla', departamento)),
      registrarHistorialCarretillas(env, { obra_id: carretilla?.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: 'Auto-creado en devolución' }),
    ]));
    return json({ ok: true, mensaje: `Carretilla ${matricula} no estaba registrada. Se ha creado y marcado como devuelta automáticamente`, fecha_devolucion: fecha });
  }

  if (carretilla.estado === 'devuelta') return err(`Carretilla ${matricula} ya fue devuelta el ${carretilla.fecha_devolucion}`, 409);

  await env.DB.prepare(
    'UPDATE carretillas SET estado = ?, fecha_devolucion = ?, devuelto_por = ?, notas = ? WHERE matricula = ?'
  ).bind('devuelta', fecha, devuelto_por || '', notas || carretilla.notas || '', matricula).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('carretilla', carretilla.departamento)),
    registrarHistorialCarretillas(env, { obra_id: carretilla.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
    sendTelegram(env, `📤 <b>Carretilla devuelta</b>\n🔖 ${matricula}\n👤 ${devuelto_por || '—'}`),
  ]));

  return json({ ok: true, mensaje: `Carretilla ${matricula} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarCarretilla(matricula, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId } = await getAuth(request, env);
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();
  if (!carretilla) return err(`Carretilla ${matricula} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && carretilla.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM carretillas WHERE matricula = ?').bind(matricula).run();
  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('carretilla', carretilla.departamento)),
    sendTelegram(env, `🗑️ <b>Carretilla eliminada</b>\n🔖 ${matricula}`),
  ]));
  return json({ ok: true, mensaje: `Carretilla ${matricula} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// TRANSFERIR (bobinas / pemp / carretillas)
// ════════════════════════════════════════════════════════════════════════════

async function transferirRecurso(tabla, id, request, env) {
  const { isSuperadmin, isAdmin, isEncargado } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEncargado) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const nueva_obra_id = body.nueva_obra_id;
  if (!nueva_obra_id) return err('Falta nueva_obra_id');

  // Verificar que la nueva obra existe
  const obra = await env.DB.prepare('SELECT id FROM obras WHERE id = ? AND activa = 1').bind(nueva_obra_id).first();
  if (!obra) return err(`Obra ${nueva_obra_id} no encontrada o inactiva`, 404);

  // Para bobinas la PK es codigo; para pemp y carretillas es id numérico
  let registro;
  if (tabla === 'bobinas') {
    registro = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(id).first();
    if (!registro) return err(`Bobina ${id} no encontrada`, 404);
    await env.DB.prepare('UPDATE bobinas SET obra_id = ? WHERE codigo = ?').bind(nueva_obra_id, id).run();
  } else {
    registro = await env.DB.prepare(`SELECT * FROM ${tabla} WHERE id = ?`).bind(id).first();
    if (!registro) return err(`Registro ${id} no encontrado`, 404);
    await env.DB.prepare(`UPDATE ${tabla} SET obra_id = ? WHERE id = ?`).bind(nueva_obra_id, id).run();
  }

  return json({ ok: true, mensaje: `Recurso transferido a obra ${nueva_obra_id}` });
}

// ════════════════════════════════════════════════════════════════════════════
// USUARIOS
// ════════════════════════════════════════════════════════════════════════════

async function getUsuarios(request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isEncargado, obraId, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const empresaParamRaw = url.searchParams.get('empresa_id');
  // Solo superadmin puede consultar usuarios de otra empresa via query param
  const empresaFiltro = (isSuperadmin && empresaParamRaw) ? parseInt(empresaParamRaw) : empresa_id;

  let sql;
  const params = [];

  if (isSuperadmin || isAdmin || isEmpresaAdmin) {
    sql = 'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE u.activo = 1 AND u.empresa_id = ? ORDER BY u.nombre';
    params.push(empresaFiltro);
  } else if (isEncargado && obraId) {
    sql = 'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE u.obra_id = ? AND u.activo = 1 AND u.empresa_id = ? ORDER BY u.nombre';
    params.push(obraId, empresa_id);
  } else {
    return err('No autorizado', 403);
  }

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearUsuario(request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isEncargado, obraId, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin && !isEncargado) return err('No autorizado', 403);

  const body = await request.json();
  const { nombre, codigo, rol, obra_id, departamento: deptBody } = body;
  if (!nombre?.trim() || !codigo?.trim()) return err('Faltan nombre y código');

  const obraFinal = obra_id ? parseInt(obra_id) : obraId;
  const deptFinal = deptBody || 'electrico';

  // Encargado solo puede crear usuarios de su propia obra (empresa_admin puede cualquiera)
  if (isEncargado && !isSuperadmin && !isAdmin && !isEmpresaAdmin && obraFinal !== obraId) {
    return err('No autorizado para crear usuarios en otra obra', 403);
  }

  try {
    const r = await env.DB.prepare(
      'INSERT INTO usuarios (nombre, codigo, rol, obra_id, departamento, activo, empresa_id) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).bind(nombre.trim(), codigo.trim(), rol || 'operario', obraFinal || null, deptFinal, empresa_id).run();
    return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim(), rol: rol || 'operario', departamento: deptFinal, codigo: codigo.trim() }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`El código "${codigo}" ya existe`, 409);
    throw e;
  }
}

async function eliminarUsuario(id, request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isEncargado, obraId } = await getAuth(request, env);

  const usuario = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
  if (!usuario) return err('Usuario no encontrado', 404);

  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin) {
    if (isEncargado && usuario.obra_id !== obraId) return err('No autorizado', 403);
    if (!isEncargado) return err('No autorizado', 403);
  }

  // Liberar credenciales únicas para que puedan reutilizarse en otro usuario
  await env.DB.prepare(
    'UPDATE usuarios SET activo = 0, email = NULL, password_hash = NULL, codigo = \'_del_\' || id WHERE id = ?'
  ).bind(id).run();
  return json({ ok: true, mensaje: 'Usuario eliminado' });
}

async function editarUsuario(id, request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isEncargado, obraId } = await getAuth(request, env);

  const usuario = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
  if (!usuario) return err('Usuario no encontrado', 404);

  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin) {
    if (isEncargado && usuario.obra_id !== obraId) return err('No autorizado', 403);
    if (!isEncargado) return err('No autorizado', 403);
  }

  const body = await request.json().catch(() => ({}));
  const campos = ['nombre', 'codigo', 'rol', 'obra_id', 'departamento'];
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (sets.length === 0) return err('No hay campos para actualizar');
  vals.push(id);

  try {
    await env.DB.prepare(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    return json({ ok: true, mensaje: 'Usuario actualizado' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err('El código ya existe', 409);
    throw e;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════

async function getConfig(request, env) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM config ORDER BY clave').all();
    const config = {};
    for (const row of results) config[row.clave] = row.valor;
    return json({ ok: true, config });
  } catch (e) {
    return json({ ok: true, config: {} });
  }
}

async function setConfig(request, env) {
  const { isSuperadmin, isAdmin } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const entries = Object.entries(body);
  if (entries.length === 0) return err('No hay claves para guardar');

  for (const [clave, valor] of entries) {
    try {
      await env.DB.prepare(
        'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
      ).bind(clave, String(valor)).run();
    } catch (e) {
      // Si la tabla config no existe, ignorar silenciosamente
      console.error('Config error:', e.message);
    }
  }
  return json({ ok: true, mensaje: 'Config guardada' });
}

// ════════════════════════════════════════════════════════════════════════════
// CATÁLOGOS (proveedores, tipos_cable)
// ════════════════════════════════════════════════════════════════════════════

async function getCatalogo(tabla, env, requestOrEmpresaId = null) {
  let empresa_id = 1;
  if (requestOrEmpresaId && typeof requestOrEmpresaId === 'object') {
    // Es un Request — hacer auth
    const auth = await getAuth(requestOrEmpresaId, env);
    empresa_id = auth.empresa_id || 1;
  } else if (typeof requestOrEmpresaId === 'number') {
    empresa_id = requestOrEmpresaId;
  }
  const { results } = await env.DB.prepare(`SELECT * FROM ${tabla} WHERE empresa_id = ? ORDER BY nombre`).bind(empresa_id).all();
  return json(results);
}

async function addCatalogo(tabla, request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id) return err('No autorizado', 403);
  if (auth.rol === 'operario') return err('Sin permisos', 403);
  const { nombre } = await request.json();
  if (!nombre?.trim()) return err('Falta el nombre');
  try {
    const r = await env.DB.prepare(`INSERT INTO ${tabla} (nombre, empresa_id) VALUES (?, ?)`).bind(nombre.trim(), auth.empresa_id).run();
    return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim() }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`"${nombre}" ya existe`, 409);
    throw e;
  }
}

async function deleteCatalogo(tabla, id, env) {
  await env.DB.prepare(`DELETE FROM ${tabla} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTAR CSV (bobinas + pemp + carretillas)
// ════════════════════════════════════════════════════════════════════════════

async function exportCSV(request, env) {
  const { obraId } = await getAuth(request, env);
  const url  = new URL(request.url);
  const tipo = url.searchParams.get('tipo'); // bobinas | pemp | carretillas | (vacío = todo)
  const f    = obraId || null;
  const fecha = new Date().toISOString().slice(0, 10);

  const escapeCSV = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const row = arr => arr.map(escapeCSV).join(',');

  const sections = [];

  if (!tipo || tipo === 'bobinas') {
    const sql = f
      ? 'SELECT * FROM bobinas WHERE obra_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM bobinas ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...(f ? [f] : [])).all();
    sections.push('=== BOBINAS ===');
    sections.push(row(['Código', 'Proveedor', 'Tipo Cable', 'Registrado por', 'Fecha Entrada', 'Devuelto por', 'Fecha Devolución', 'Estado', 'Notas', 'Obra ID']));
    for (const b of results) {
      sections.push(row([b.codigo, b.proveedor, b.tipo_cable, b.registrado_por, b.fecha_entrada, b.devuelto_por, b.fecha_devolucion, b.estado, b.notas, b.obra_id]));
    }
    sections.push('');
  }

  if (!tipo || tipo === 'pemp') {
    const sql = f
      ? 'SELECT * FROM pemp WHERE obra_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM pemp ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...(f ? [f] : [])).all();
    sections.push('=== PEMP ===');
    sections.push(row(['ID', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Estado', 'Fecha Entrada', 'Fecha Devolución', 'Última Revisión', 'Próxima Revisión', 'Registrado por', 'Devuelto por', 'Notas', 'Obra ID']));
    for (const p of results) {
      sections.push(row([p.id, p.matricula, p.tipo, p.marca, p.proveedor, p.estado, p.fecha_entrada, p.fecha_devolucion, p.fecha_ultima_revision, p.fecha_proxima_revision, p.registrado_por, p.devuelto_por, p.notas, p.obra_id]));
    }
    sections.push('');
  }

  if (!tipo || tipo === 'carretillas') {
    const sql = f
      ? 'SELECT * FROM carretillas WHERE obra_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM carretillas ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...(f ? [f] : [])).all();
    sections.push('=== CARRETILLAS ===');
    sections.push(row(['ID', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Energía', 'Estado', 'Fecha Entrada', 'Fecha Devolución', 'Última Revisión', 'Próxima Revisión', 'Registrado por', 'Devuelto por', 'Notas', 'Obra ID']));
    for (const c of results) {
      sections.push(row([c.id, c.matricula, c.tipo, c.marca, c.proveedor, c.energia, c.estado, c.fecha_entrada, c.fecha_devolucion, c.fecha_ultima_revision, c.fecha_proxima_revision, c.registrado_por, c.devuelto_por, c.notas, c.obra_id]));
    }
    sections.push('');
  }

  const csv = sections.join('\n');
  const nombreArchivo = tipo ? `alejandra_${tipo}_${fecha}.csv` : `alejandra_export_${fecha}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      ...CORS,
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// HISTORIAL
// ════════════════════════════════════════════════════════════════════════════

async function registrarHistorial(env, { obra_id, bobina_codigo, accion, usuario, notas }) {
  const fecha = fechaEspana();
  try {
    await env.DB.prepare(
      'INSERT INTO historial (obra_id, bobina_codigo, accion, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(obra_id || null, bobina_codigo, accion, usuario || '', notas || '', fecha).run();
  } catch (e) {
    console.error('Error historial bobinas:', e.message);
  }
}

async function registrarHistorialPemp(env, { obra_id, matricula, accion, usuario, notas }) {
  const fecha = fechaEspana();
  try {
    await env.DB.prepare(
      'INSERT INTO historial_pemp (obra_id, matricula, accion, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(obra_id || null, matricula, accion, usuario || '', notas || '', fecha).run();
  } catch (e) {
    console.error('Error historial PEMP:', e.message);
  }
}

async function registrarHistorialCarretillas(env, { obra_id, matricula, accion, usuario, notas }) {
  const fecha = fechaEspana();
  try {
    await env.DB.prepare(
      'INSERT INTO historial_carretillas (obra_id, matricula, accion, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(obra_id || null, matricula, accion, usuario || '', notas || '', fecha).run();
  } catch (e) {
    console.error('Error historial Carretillas:', e.message);
  }
}

async function getHistorial(request, env) {
  const { obraId, empresa_id, departamento, isSuperadmin, isEmpresaAdmin } = await getAuth(request, env);
  const url = new URL(request.url);
  const limit  = parseInt(url.searchParams.get('limit') || '100');
  const accion = url.searchParams.get('accion');

  // JOIN en bobina_codigo (bobina_id nunca se inserta en historial)
  let sql = `SELECT h.*, b.departamento FROM historial h LEFT JOIN bobinas b ON h.bobina_codigo = b.codigo AND b.empresa_id = ? WHERE h.empresa_id = ?`;
  const params = [empresa_id || 1, empresa_id || 1];
  if (obraId) { sql += ' AND h.obra_id = ?'; params.push(obraId); }
  if (accion) { sql += ' AND h.accion = ?';  params.push(accion); }

  // Usuarios normales ven solo su dept; SA/EA ven todo (o filtran por ?departamento=)
  const deptFiltro = (!isSuperadmin && !isEmpresaAdmin) ? departamento : (url.searchParams.get('departamento') || null);
  if (deptFiltro) { sql += ' AND b.departamento = ?'; params.push(deptFiltro); }

  sql += ' ORDER BY h.created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function getHistorialTabla(tabla, request, env) {
  const { obraId, empresa_id, departamento, isSuperadmin, isEmpresaAdmin } = await getAuth(request, env);
  const url = new URL(request.url);
  const limit  = parseInt(url.searchParams.get('limit') || '100');
  const accion = url.searchParams.get('accion');

  // INNER JOIN para obtener empresa_id y departamento de la máquina
  const mainTable = tabla === 'historial_pemp' ? 'pemp' : 'carretillas';
  let sql = `SELECT h.*, m.departamento FROM ${tabla} h INNER JOIN ${mainTable} m ON h.matricula = m.matricula AND m.empresa_id = ? WHERE 1=1`;
  const params = [empresa_id || 1];
  if (obraId) { sql += ' AND h.obra_id = ?'; params.push(obraId); }
  if (accion) { sql += ' AND h.accion = ?';  params.push(accion); }

  const deptFiltro = (!isSuperadmin && !isEmpresaAdmin) ? departamento : (url.searchParams.get('departamento') || null);
  if (deptFiltro) { sql += ' AND m.departamento = ?'; params.push(deptFiltro); }

  sql += ' ORDER BY h.created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════

async function getStats(request, env) {
  const { obraId, empresa_id } = await getAuth(request, env);
  const f = obraId || null;
  const w = f ? ' AND obra_id = ?' : '';
  // empresa_id siempre primero, obra_id opcional después
  const p = f ? [empresa_id, f] : [empresa_id];
  const baseW = ' AND empresa_id = ?' + w;

  const [totalB, activasB, devueltasB, totalP, activasP, devueltasP, totalC, activasC, devueltasC] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as n FROM bobinas WHERE 1=1${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM bobinas WHERE estado = 'activa'${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM bobinas WHERE estado = 'devuelta'${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM pemp WHERE 1=1${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM pemp WHERE estado = 'activa'${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM pemp WHERE estado = 'devuelta'${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM carretillas WHERE 1=1${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM carretillas WHERE estado = 'activa'${baseW}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM carretillas WHERE estado = 'devuelta'${baseW}`).bind(...p).first(),
  ]);

  return json({
    bobinas:     { total: totalB.n,   activas: activasB.n,   devueltas: devueltasB.n },
    pemp:        { total: totalP.n,   activas: activasP.n,   devueltas: devueltasP.n },
    carretillas: { total: totalC.n,   activas: activasC.n,   devueltas: devueltasC.n },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// SUGERENCIAS
// Tabla D1 necesaria:
// CREATE TABLE IF NOT EXISTS sugerencias (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   texto TEXT NOT NULL,
//   categoria TEXT,
//   usuario TEXT,
//   obra TEXT,
//   leida INTEGER DEFAULT 0,
//   created_at TEXT DEFAULT (datetime('now'))
// );
// ════════════════════════════════════════════════════════════════════════════

async function guardarSugerencia(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { texto, categoria, usuario, obra, foto } = body;
    if (!texto || !texto.trim()) return err('El texto de la sugerencia es obligatorio');
    // Intentar obtener departamento y empresa_id del token (silencioso si no hay sesión)
    let departamento = null, empresa_id_sug = 1;
    try {
      const auth = await getAuth(request, env);
      departamento = auth.departamento || null;
      if (auth.empresa_id) empresa_id_sug = auth.empresa_id;
    } catch {}
    const fotoVal = (foto && typeof foto === 'string' && foto.startsWith('data:image/')) ? foto : null;
    const rSug = await env.DB.prepare(
      'INSERT INTO sugerencias (texto, categoria, usuario, obra, departamento, empresa_id, estado, foto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(texto.trim().slice(0, 1000), categoria || null, usuario || null, obra || null, departamento, empresa_id_sug, 'pendiente', fotoVal).run();
    const ideaId = rSug.meta?.last_row_id;
    const catIcon = { mejora: '🔧', error: '🐛', nuevo: '✨', otro: '💬' };
    const icon = catIcon[categoria] || '💬';
    const tgMsg = `${icon} <b>Nueva sugerencia [${categoria || 'otro'}]</b>\n` +
      `👤 ${usuario || '—'}  🏗 ${obra || '—'}\n\n` +
      `${texto.trim().slice(0, 400)}`;
    const botonesIdea = ideaId ? [[
      { text: '🔄 En progreso', callback_data: `idea_prog:${ideaId}` },
      { text: '✅ Resuelto',    callback_data: `idea_done:${ideaId}` },
      { text: '🗑 Cerrar',     callback_data: `idea_close:${ideaId}` },
    ]] : null;
    if (fotoVal && ideaId) {
      await sendTelegramFotoConBotones(env, tgMsg, fotoVal, botonesIdea);
    } else if (ideaId) {
      await sendTelegramConBotones(env, tgMsg, botonesIdea);
    } else {
      await sendTelegram(env, tgMsg);
    }
    return json({ ok: true, mensaje: 'Sugerencia enviada. ¡Gracias!' });
  } catch (e) {
    return err('No se pudo guardar la sugerencia: ' + e.message);
  }
}

async function getSugerencias(request, env) {
  const { isSuperadmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const url = new URL(request.url);
  const estadoFilter    = url.searchParams.get('estado');
  const categoriaFilter = url.searchParams.get('categoria');
  const soloNoLeidas    = url.searchParams.get('noLeidas') === '1';
  const deptFilter      = url.searchParams.get('departamento');

  let sql = 'SELECT * FROM sugerencias WHERE empresa_id = ?';
  const params = [empresa_id];
  if (soloNoLeidas)    { sql += ' AND leida = 0'; }
  if (estadoFilter === 'pendiente') { sql += ' AND (estado = ? OR estado IS NULL)'; params.push(estadoFilter); }
  else if (estadoFilter)            { sql += ' AND estado = ?'; params.push(estadoFilter); }
  if (categoriaFilter) { sql += ' AND categoria = ?';     params.push(categoriaFilter); }
  if (deptFilter)      { sql += ' AND departamento = ?';  params.push(deptFilter); }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function marcarSugerenciaLeida(id, request, env) {
  const { isSuperadmin, isEmpresaAdmin } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const body    = await request.json().catch(() => ({}));
  const estado   = body.estado   || null;
  const respuesta = body.respuesta ?? null;
  const campos = ['leida = 1'];
  const vals   = [];
  if (estado)    { campos.push('estado = ?');    vals.push(estado); }
  if (respuesta !== null) { campos.push('respuesta = ?'); vals.push(respuesta); }
  vals.push(id);
  await env.DB.prepare(`UPDATE sugerencias SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true });
}

async function eliminarSugerencia(id, request, env) {
  const { isSuperadmin, isEmpresaAdmin } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  await env.DB.prepare('DELETE FROM sugerencias WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function marcarTodasSugerencias(request, env) {
  const { isSuperadmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  await env.DB.prepare("UPDATE sugerencias SET estado='resuelto', leida=1 WHERE empresa_id = ? AND estado != 'resuelto'").bind(empresa_id).run();
  return json({ ok: true });
}

async function borrarTodasSugerencias(request, env) {
  const { isSuperadmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  await env.DB.prepare('DELETE FROM sugerencias WHERE empresa_id = ?').bind(empresa_id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// BUSCAR MÁQUINA (cross-departamento, para Seguridad y consulta general)
// ════════════════════════════════════════════════════════════════════════════

async function buscarMaquina(matricula, request, env) {
  const mat = matricula.trim().toUpperCase();

  const [pemp, carretilla] = await Promise.all([
    env.DB.prepare(
      'SELECT p.*, o.nombre as obra_nombre FROM pemp p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.matricula = ?'
    ).bind(mat).first(),
    env.DB.prepare(
      'SELECT c.*, o.nombre as obra_nombre FROM carretillas c LEFT JOIN obras o ON c.obra_id = o.id WHERE c.matricula = ?'
    ).bind(mat).first(),
  ]);

  if (pemp) {
    const hist = await env.DB.prepare(
      'SELECT accion, usuario, notas, fecha FROM historial_pemp WHERE matricula = ? ORDER BY fecha DESC LIMIT 15'
    ).bind(mat).all();
    return json({ ok: true, tipo: 'pemp', data: pemp, historial: hist.results });
  }
  if (carretilla) {
    const hist = await env.DB.prepare(
      'SELECT accion, usuario, notas, fecha FROM historial_carretillas WHERE matricula = ? ORDER BY fecha DESC LIMIT 15'
    ).bind(mat).all();
    return json({ ok: true, tipo: 'carretilla', data: carretilla, historial: hist.results });
  }
  return json({ ok: false, error: `Matrícula ${mat} no encontrada` }, 404);
}

// Helper interno para registrar actividad desde el worker
async function logActividad(env, { nivel = 'info', origen = 'server', mensaje, detalle = '', empresa_id = 1 } = {}) {
  try {
    await env.DB.prepare(
      'INSERT INTO logs (nivel, origen, mensaje, detalle, empresa_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(nivel, origen, String(mensaje || '').slice(0, 500), String(detalle || '').slice(0, 1000), empresa_id || 1).run();
  } catch (_) {}
}

async function guardarLog(request, env) {
  try {
    const body = await request.json();
    const { nivel = 'info', origen, mensaje, detalle, usuario, rol, obra, url, ts } = body;
    const contexto = JSON.stringify({ detalle, usuario, rol, obra, url, ts });
    await env.DB.prepare(
      'INSERT INTO logs (nivel, origen, mensaje, detalle, empresa_id) VALUES (?, ?, ?, ?, ?)'
    ).bind(nivel, origen || 'cliente', String(mensaje || '').slice(0, 500), contexto, 1).run();
    if (nivel === 'error') {
      await sendTelegram(env,
        `🚨 <b>Error en Alejandra</b>\n` +
        `👤 ${usuario || '—'}  🏗 ${obra || '—'}\n` +
        `📋 ${String(mensaje || '').slice(0, 300)}`
      );
    }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false });
  }
}

async function getLogs(request, env) {
  const url   = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const nivel = url.searchParams.get('nivel');
  let sql = 'SELECT * FROM logs';
  const params = [];
  if (nivel) { sql += ' WHERE nivel = ?'; params.push(nivel); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS SYNC
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// PEDIDOS (#15)
// ════════════════════════════════════════════════════════════════════════════

async function getPedidos(request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const estadoFilter = url.searchParams.get('estado');
  const obraFilter   = url.searchParams.get('obra_id');

  let sql = 'SELECT p.*, o.nombre as obra_nombre FROM pedidos p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ?';
  const params = [empresa_id];
  sql += ' AND p.departamento = ?';
  params.push(departamento || 'electrico');
  if (estadoFilter) { sql += ' AND p.estado = ?';   params.push(estadoFilter); }
  if (obraFilter)   { sql += ' AND p.obra_id = ?';  params.push(parseInt(obraFilter)); }
  sql += ' ORDER BY p.created_at DESC LIMIT 500';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearPedido(request, env) {
  const { empresa_id, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  // Todos los roles (incluido operario) pueden crear pedidos
  const body = await request.json().catch(() => ({}));
  const { descripcion, referencia, cantidad, unidad, proveedor, obra_id, solicitado_por, notas } = body;
  if (!descripcion?.trim()) return err('La descripción es obligatoria');
  const dept = departamento || 'electrico';
  const r = await env.DB.prepare(
    'INSERT INTO pedidos (empresa_id, obra_id, departamento, referencia, descripcion, cantidad, unidad, proveedor, solicitado_por, notas) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obra_id||null, dept, referencia||null, descripcion.trim(), cantidad||1, unidad||'ud', proveedor||null, solicitado_por||null, notas||null).run();
  syncPedidos(env, tabForDept('pedido', dept));
  await sendTelegram(env, `📦 <b>Nuevo pedido</b> [${dept}]\n👤 ${solicitado_por||'—'}\n📝 ${descripcion.trim().slice(0,200)}`);
  return json({ ok: true, id: r.meta.last_row_id });
}

async function actualizarPedido(id, request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isEncargado } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  // Solo encargado/admin pueden cambiar el estado
  if (body.estado !== undefined && !isSuperadmin && !isEmpresaAdmin && !isEncargado) {
    return err('Sin permiso para cambiar el estado', 403);
  }
  const campos = [], vals = [];
  if (body.estado       !== undefined) { campos.push('estado = ?');          vals.push(body.estado); }
  if (body.notas        !== undefined) { campos.push('notas = ?');           vals.push(body.notas); }
  if (body.fecha_recepcion !== undefined) { campos.push('fecha_recepcion = ?'); vals.push(body.fecha_recepcion); }
  if (body.proveedor    !== undefined) { campos.push('proveedor = ?');       vals.push(body.proveedor); }
  if (body.referencia   !== undefined) { campos.push('referencia = ?');      vals.push(body.referencia); }
  if (body.descripcion  !== undefined) { campos.push('descripcion = ?');     vals.push(body.descripcion); }
  if (body.cantidad     !== undefined) { campos.push('cantidad = ?');        vals.push(body.cantidad); }
  if (body.unidad       !== undefined) { campos.push('unidad = ?');          vals.push(body.unidad); }
  if (!campos.length) return err('Sin campos para actualizar');
  vals.push(id);
  await env.DB.prepare(`UPDATE pedidos SET ${campos.join(', ')} WHERE id = ? AND empresa_id = ${empresa_id}`).bind(...vals).run();
  if (body.estado !== undefined) {
    const pedido = await env.DB.prepare('SELECT descripcion, departamento FROM pedidos WHERE id = ?').bind(id).first();
    const iconos = { solicitado: '📤', recibido: '✅', cancelado: '❌', pendiente: '⏳' };
    await sendTelegram(env,
      `${iconos[body.estado]||'📦'} <b>Pedido ${body.estado}</b> [${pedido?.departamento||'—'}]\n📝 ${(pedido?.descripcion||'').slice(0,200)}`
    );
  }
  syncPedidos(env);
  return json({ ok: true });
}

async function eliminarPedido(id, request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isEncargado } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (!isSuperadmin && !isEmpresaAdmin && !isEncargado) return err('Sin permiso', 403);
  const pedido = await env.DB.prepare('SELECT departamento FROM pedidos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  await env.DB.prepare('DELETE FROM pedidos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  syncPedidos(env, tabForDept('pedido', pedido?.departamento));
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════

function tabForDept(tipo, dept) {
  const d = (dept || '').toLowerCase();
  if (tipo === 'bobina')      return 'Elec-Bobinas';
  if (tipo === 'pemp')        return d === 'mecanicas' ? 'Mec-PEMP' : 'Elec-PEMP';
  if (tipo === 'carretilla')  return d === 'mecanicas' ? 'Mec-Carretillas' : 'Elec-Carretillas';
  if (tipo === 'pedido')      return d === 'mecanicas' ? 'Mec-Pedidos' : d === 'seguridad' ? 'Seg-Pedidos' : 'Elec-Pedidos';
  if (tipo === 'herramienta') return d === 'mecanicas' ? 'Mec-Herramientas' : 'Elec-Herramientas';
  if (tipo === 'kit')         return 'Kits';
  return 'Seg-Inventario';
}

let _gTokenCache = {};
async function getGoogleToken(env, scope = 'https://www.googleapis.com/auth/spreadsheets') {
  const cacheKey = scope;
  const cached = _gTokenCache[cacheKey];
  if (cached && cached.exp > Date.now()) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64 = obj => btoa(JSON.stringify(obj))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header  = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64(claim);
  const input   = `${header}.${payload}`;

  const pemBody = env.GOOGLE_PRIVATE_KEY
    .replace(/^["']|["']$/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s/g, '')
    .trim();

  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8', keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(input)
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${input}.${sigB64}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo obtener token de Google: ' + JSON.stringify(data));
  _gTokenCache[cacheKey] = { token: data.access_token, exp: Date.now() + 3500_000 };
  return data.access_token;
}

// ════════════════════════════════════════════════════════════════════════════
// HERRAMIENTAS
// ════════════════════════════════════════════════════════════════════════════

const AHORA = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

async function getTiposHerramienta(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const { results } = await env.DB.prepare(
    'SELECT * FROM tipos_herramienta WHERE empresa_id = ? ORDER BY nombre'
  ).bind(empresa_id).all();
  return json(results);
}

async function crearTipoHerramienta(request, env) {
  const { empresa_id, isAdmin, isSuperadmin, isEmpresaAdmin, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const { nombre } = await request.json().catch(() => ({}));
  if (!nombre?.trim()) return err('Falta el nombre');
  const r = await env.DB.prepare(
    'INSERT INTO tipos_herramienta (nombre, empresa_id) VALUES (?, ?)'
  ).bind(nombre.trim(), empresa_id).run();
  return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim() }, 201);
}

async function eliminarTipoHerramienta(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM tipos_herramienta WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

async function getKits(request, env) {
  const { empresa_id, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  let sql = 'SELECT k.*, o.nombre as obra_nombre FROM kits_herramientas k LEFT JOIN obras o ON k.obra_id = o.id WHERE k.empresa_id = ?';
  const params = [empresa_id];
  if (departamento) { sql += ' AND k.departamento = ?'; params.push(departamento); }
  const filtro   = url.searchParams.get('estado');
  const k_obra   = url.searchParams.get('obra_id');
  if (filtro)  { sql += ' AND k.estado = ?';    params.push(filtro); }
  if (k_obra)  { sql += ' AND k.obra_id = ?';   params.push(parseInt(k_obra)); }
  sql += ' ORDER BY k.numero_kit ASC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function getKit(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const kit = await env.DB.prepare(
    'SELECT k.*, o.nombre as obra_nombre FROM kits_herramientas k LEFT JOIN obras o ON k.obra_id = o.id WHERE k.id = ? AND k.empresa_id = ?'
  ).bind(id, empresa_id).first();
  if (!kit) return err('Kit no encontrado', 404);
  const { results: herramientas } = await env.DB.prepare(
    'SELECT h.*, t.nombre as tipo_nombre FROM herramientas h LEFT JOIN tipos_herramienta t ON h.tipo_id = t.id WHERE h.kit_id = ? AND h.empresa_id = ? ORDER BY t.nombre'
  ).bind(id, empresa_id).all();
  return json({ kit, herramientas });
}

async function crearKit(request, env, ctx) {
  const { empresa_id, departamento, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { numero_kit, nombre, obra_id, asignado_a, num_componentes, notas } = body;
  if (!numero_kit?.trim()) return err('Falta el número de kit');
  const dept = departamento || 'electrico';
  const ahora = AHORA();
  const r = await env.DB.prepare(
    'INSERT INTO kits_herramientas (empresa_id, numero_kit, nombre, obra_id, departamento, asignado_a, num_componentes, notas, fecha_alta, fecha_asignacion) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, numero_kit.trim(), nombre?.trim() || null, obra_id || null, dept,
    asignado_a?.trim() || null, num_componentes || 0, notas?.trim() || null, ahora,
    asignado_a?.trim() ? ahora : null
  ).run();
  await registrarHistorialKitHerr(env, empresa_id, r.meta.last_row_id, null, 'alta', null, 'disponible', userNombre || rol, 'Kit creado');
  ctx?.waitUntil(syncSheets(env, 'Kits'));
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarKit(id, request, env, ctx) {
  const { empresa_id, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const kit = await env.DB.prepare('SELECT * FROM kits_herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!kit) return err('Kit no encontrado', 404);

  const campos = []; const vals = [];
  const ahora = AHORA();

  if (body.numero_kit  !== undefined) { campos.push('numero_kit = ?');   vals.push(body.numero_kit.trim()); }
  if (body.nombre      !== undefined) { campos.push('nombre = ?');        vals.push(body.nombre?.trim() || null); }
  if (body.obra_id     !== undefined) { campos.push('obra_id = ?');       vals.push(body.obra_id || null); }
  if (body.departamento!== undefined) { campos.push('departamento = ?');  vals.push(body.departamento); }
  if (body.num_componentes !== undefined) { campos.push('num_componentes = ?'); vals.push(body.num_componentes); }
  if (body.notas       !== undefined) { campos.push('notas = ?');         vals.push(body.notas?.trim() || null); }

  // Asignación
  if (body.asignado_a !== undefined) {
    campos.push('asignado_a = ?'); vals.push(body.asignado_a?.trim() || null);
    if (body.asignado_a?.trim() && !kit.asignado_a) {
      campos.push('fecha_asignacion = ?'); vals.push(ahora);
      campos.push('fecha_devolucion = ?'); vals.push(null);
    }
  }
  // Devolución
  if (body.estado !== undefined) {
    const estadoAnterior = kit.estado;
    campos.push('estado = ?'); vals.push(body.estado);
    if (body.estado === 'disponible' && kit.asignado_a) {
      campos.push('fecha_devolucion = ?'); vals.push(ahora);
      campos.push('asignado_a = ?'); vals.push(null);
    }
    if (body.estado !== estadoAnterior) {
      await registrarHistorialKitHerr(env, empresa_id, id, null, 'cambio_estado', estadoAnterior, body.estado, userNombre || rol, body.notas_historial || null);
    }
  }

  if (!campos.length) return json({ ok: true });
  vals.push(id); vals.push(empresa_id);
  await env.DB.prepare(`UPDATE kits_herramientas SET ${campos.join(', ')} WHERE id = ? AND empresa_id = ?`).bind(...vals).run();
  ctx?.waitUntil(syncSheets(env, 'Kits'));
  return json({ ok: true });
}

async function eliminarKit(id, request, env, ctx) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || (rol !== 'encargado' && rol !== 'empresa_admin' && rol !== 'superadmin')) return err('Sin permisos', 403);
  await env.DB.prepare('UPDATE herramientas SET kit_id = NULL WHERE kit_id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  await env.DB.prepare('DELETE FROM kits_herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  ctx?.waitUntil(syncSheets(env, 'Kits'));
  return json({ ok: true });
}

async function getHerramientas(request, env) {
  const { empresa_id, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  let sql = `SELECT h.*, t.nombre as tipo_nombre, o.nombre as obra_nombre, k.numero_kit
             FROM herramientas h
             LEFT JOIN tipos_herramienta t ON h.tipo_id = t.id
             LEFT JOIN obras o ON h.obra_id = o.id
             LEFT JOIN kits_herramientas k ON h.kit_id = k.id
             WHERE h.empresa_id = ?`;
  const params = [empresa_id];
  if (departamento) { sql += ' AND h.departamento = ?'; params.push(departamento); }
  const estado  = url.searchParams.get('estado');
  const kit_id  = url.searchParams.get('kit_id');
  const obra_id = url.searchParams.get('obra_id');
  if (estado)  { sql += ' AND h.estado = ?';   params.push(estado); }
  if (kit_id)  { sql += ' AND h.kit_id = ?';   params.push(parseInt(kit_id)); }
  if (obra_id) { sql += ' AND h.obra_id = ?';  params.push(parseInt(obra_id)); }
  sql += ' ORDER BY t.nombre, h.marca, h.modelo';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function getHerramienta(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const h = await env.DB.prepare(
    `SELECT h.*, t.nombre as tipo_nombre, o.nombre as obra_nombre, k.numero_kit, k.nombre as kit_nombre
     FROM herramientas h
     LEFT JOIN tipos_herramienta t ON h.tipo_id = t.id
     LEFT JOIN obras o ON h.obra_id = o.id
     LEFT JOIN kits_herramientas k ON h.kit_id = k.id
     WHERE h.id = ? AND h.empresa_id = ?`
  ).bind(id, empresa_id).first();
  if (!h) return err('Herramienta no encontrada', 404);
  const { results: historial } = await env.DB.prepare(
    'SELECT * FROM historial_herramientas WHERE herramienta_id = ? AND empresa_id = ? ORDER BY fecha DESC LIMIT 15'
  ).bind(id, empresa_id).all();
  return json({ herramienta: h, historial });
}

async function buscarHerramienta(request, env) {
  const { empresa_id, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url  = new URL(request.url);
  const serie = url.searchParams.get('serie')?.trim();
  if (!serie) return err('Falta el número de serie');
  const h = await env.DB.prepare(
    `SELECT h.*, t.nombre as tipo_nombre, o.nombre as obra_nombre, k.numero_kit, k.nombre as kit_nombre
     FROM herramientas h
     LEFT JOIN tipos_herramienta t ON h.tipo_id = t.id
     LEFT JOIN obras o ON h.obra_id = o.id
     LEFT JOIN kits_herramientas k ON h.kit_id = k.id
     WHERE h.empresa_id = ? AND UPPER(h.numero_serie) = UPPER(?)`
  ).bind(empresa_id, serie).first();
  if (!h) return err('Herramienta no encontrada', 404);
  const { results: historial } = await env.DB.prepare(
    'SELECT * FROM historial_herramientas WHERE herramienta_id = ? AND empresa_id = ? ORDER BY fecha DESC LIMIT 10'
  ).bind(h.id, empresa_id).all();
  return json({ herramienta: h, historial });
}

async function crearHerramienta(request, env, ctx) {
  const { empresa_id, departamento, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { kit_id, tipo_id, marca, modelo, numero_serie, obra_id, asignado_a, alimentacion, notas } = body;
  const dept = departamento || body.departamento || 'electrico';
  const ahora = AHORA();
  const r = await env.DB.prepare(
    'INSERT INTO herramientas (empresa_id, kit_id, tipo_id, marca, modelo, numero_serie, departamento, obra_id, asignado_a, alimentacion, notas, fecha_alta, fecha_asignacion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, kit_id || null, tipo_id || null, marca?.trim() || null, modelo?.trim() || null,
    numero_serie?.trim() || null, dept, obra_id || null, asignado_a?.trim() || null,
    alimentacion || 'bateria', notas?.trim() || null, ahora, asignado_a?.trim() ? ahora : null
  ).run();
  const hid = r.meta.last_row_id;
  await registrarHistorialHerr(env, empresa_id, hid, kit_id || null, 'alta', null, 'disponible', userNombre || rol, 'Herramienta registrada');
  ctx?.waitUntil(syncSheets(env, tabForDept('herramienta', dept)));
  return json({ ok: true, id: hid }, 201);
}

async function actualizarHerramienta(id, request, env, ctx) {
  const { empresa_id, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const h = await env.DB.prepare('SELECT * FROM herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!h) return err('Herramienta no encontrada', 404);

  // Operarios solo pueden cambiar estado
  if (rol === 'operario' && Object.keys(body).some(k => !['estado', 'notas_historial'].includes(k))) {
    return err('Sin permisos para editar datos', 403);
  }

  const campos = []; const vals = [];
  const ahora = AHORA();

  if (body.kit_id      !== undefined) { campos.push('kit_id = ?');      vals.push(body.kit_id || null); }
  if (body.tipo_id     !== undefined) { campos.push('tipo_id = ?');     vals.push(body.tipo_id || null); }
  if (body.marca       !== undefined) { campos.push('marca = ?');       vals.push(body.marca?.trim() || null); }
  if (body.modelo      !== undefined) { campos.push('modelo = ?');      vals.push(body.modelo?.trim() || null); }
  if (body.numero_serie!== undefined) { campos.push('numero_serie = ?');vals.push(body.numero_serie?.trim() || null); }
  if (body.departamento!== undefined) { campos.push('departamento = ?');vals.push(body.departamento); }
  if (body.obra_id     !== undefined) { campos.push('obra_id = ?');     vals.push(body.obra_id || null); }
  if (body.alimentacion!== undefined) { campos.push('alimentacion = ?');vals.push(body.alimentacion); }
  if (body.notas       !== undefined) { campos.push('notas = ?');       vals.push(body.notas?.trim() || null); }

  // Asignación / devolución
  if (body.asignado_a !== undefined) {
    campos.push('asignado_a = ?'); vals.push(body.asignado_a?.trim() || null);
    if (body.asignado_a?.trim() && !h.asignado_a) {
      campos.push('fecha_asignacion = ?'); vals.push(ahora);
      campos.push('fecha_devolucion = ?'); vals.push(null);
    } else if (!body.asignado_a?.trim() && h.asignado_a) {
      campos.push('fecha_devolucion = ?'); vals.push(ahora);
    }
  }

  // Cambio de estado con fechas automáticas
  if (body.estado !== undefined && body.estado !== h.estado) {
    campos.push('estado = ?'); vals.push(body.estado);
    if (body.estado === 'averiado')      { campos.push('fecha_averia = ?');    vals.push(ahora); }
    if (body.estado === 'en_reparacion') { campos.push('fecha_averia = ?');    vals.push(h.fecha_averia || ahora); }
    if (body.estado === 'disponible' && (h.estado === 'averiado' || h.estado === 'en_reparacion')) {
      campos.push('fecha_reparacion = ?'); vals.push(ahora);
    }
    if (body.estado === 'disponible' && h.asignado_a) {
      campos.push('fecha_devolucion = ?'); vals.push(ahora);
      campos.push('asignado_a = ?'); vals.push(null);
    }
    await registrarHistorialHerr(env, empresa_id, id, h.kit_id, 'cambio_estado', h.estado, body.estado, userNombre || rol, body.notas_historial || null);
  }

  if (!campos.length) return json({ ok: true });
  vals.push(id); vals.push(empresa_id);
  await env.DB.prepare(`UPDATE herramientas SET ${campos.join(', ')} WHERE id = ? AND empresa_id = ?`).bind(...vals).run();
  ctx?.waitUntil(syncSheets(env, tabForDept('herramienta', body.departamento || h.departamento)));
  return json({ ok: true });
}

async function eliminarHerramienta(id, request, env, ctx) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || (rol !== 'encargado' && rol !== 'empresa_admin' && rol !== 'superadmin')) return err('Sin permisos', 403);
  const h = await env.DB.prepare('SELECT departamento FROM herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  await env.DB.prepare('DELETE FROM herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  ctx?.waitUntil(syncSheets(env, tabForDept('herramienta', h?.departamento)));
  return json({ ok: true });
}

async function getHistorialHerramientas(request, env) {
  const { empresa_id, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const hid = url.searchParams.get('herramienta_id');
  const kid = url.searchParams.get('kit_id');
  let sql = 'SELECT hh.*, h.numero_serie, h.marca, h.modelo FROM historial_herramientas hh LEFT JOIN herramientas h ON hh.herramienta_id = h.id WHERE hh.empresa_id = ?';
  const params = [empresa_id];
  if (hid) { sql += ' AND hh.herramienta_id = ?'; params.push(parseInt(hid)); }
  if (kid) { sql += ' AND hh.kit_id = ?'; params.push(parseInt(kid)); }
  sql += ' ORDER BY hh.fecha DESC LIMIT 50';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function registrarHistorialHerr(env, empresa_id, herramienta_id, kit_id, accion, estado_anterior, estado_nuevo, usuario, notas) {
  try {
    await env.DB.prepare(
      'INSERT INTO historial_herramientas (empresa_id, herramienta_id, kit_id, accion, estado_anterior, estado_nuevo, usuario, notas, fecha) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(empresa_id, herramienta_id, kit_id || null, accion, estado_anterior || null, estado_nuevo || null, usuario || null, notas || null, AHORA()).run();
  } catch {}
}

async function registrarHistorialKitHerr(env, empresa_id, kit_id, herramienta_id, accion, estado_anterior, estado_nuevo, usuario, notas) {
  try {
    await env.DB.prepare(
      'INSERT INTO historial_herramientas (empresa_id, herramienta_id, kit_id, accion, estado_anterior, estado_nuevo, usuario, notas, fecha) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(empresa_id, herramienta_id || null, kit_id, accion, estado_anterior || null, estado_nuevo || null, usuario || null, notas || null, AHORA()).run();
  } catch {}
}

// ════════════════════════════════════════════════════════════════════════════
// PERSONAL — Horarios, Fichajes, Resúmenes
// ════════════════════════════════════════════════════════════════════════════

// Devuelve {hora_entrada, hora_salida, horas_dia} para el día específico de un fichaje (MEJ-131)
function getHorarioParaDia(horario, fecha) {
  if (horario.horarios_dia) {
    try {
      const dias = JSON.parse(horario.horarios_dia);
      const letras = ['D','L','M','X','J','V','S'];
      const letra = letras[new Date(fecha + 'T00:00:00').getDay()];
      if (dias[letra]?.entrada) {
        const ent = dias[letra].entrada;
        const sal = dias[letra].salida;
        return { hora_entrada: ent, hora_salida: sal, horas_dia: calcHoras(ent, sal) };
      }
    } catch {}
  }
  return { hora_entrada: horario.hora_entrada, hora_salida: horario.hora_salida, horas_dia: horario.horas_dia };
}

// Devuelve minutos de diferencia (positivo = tarde, negativo = antes de hora)
function calcMinutosRetraso(horaEntrada, horaHorario) {
  if (!horaEntrada || !horaHorario) return 0;
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  return toMin(horaEntrada.slice(0,5)) - toMin(horaHorario.slice(0,5));
}

function calcHoras(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  const mins = (sh * 60 + sm) - (eh * 60 + em);
  return Math.max(0, Math.round(mins / 60 * 100) / 100);
}

// ── Horarios de obra ────────────────────────────────────────────────────────
async function getHorariosObra(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const obra_id = url.searchParams.get('obra_id');
  let sql = 'SELECT h.*, o.nombre as obra_nombre FROM horarios_obra h LEFT JOIN obras o ON h.obra_id = o.id WHERE h.empresa_id = ?';
  const params = [empresa_id];
  if (obra_id) { sql += ' AND h.obra_id = ?'; params.push(parseInt(obra_id)); }
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function guardarHorarioObra(request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { obra_id, hora_entrada, hora_salida, dias_semana, notas, horarios_dia } = body;
  if (!hora_entrada || !hora_salida) return err('Faltan horas');
  const horas_dia = calcHoras(hora_entrada, hora_salida);
  const hdStr = horarios_dia ? JSON.stringify(horarios_dia) : null;
  // Upsert: si ya existe horario para esa obra, actualizar
  const existe = obra_id ? await env.DB.prepare('SELECT id FROM horarios_obra WHERE empresa_id = ? AND obra_id = ?').bind(empresa_id, obra_id).first() : null;
  if (existe) {
    await env.DB.prepare('UPDATE horarios_obra SET hora_entrada=?,hora_salida=?,horas_dia=?,dias_semana=?,notas=?,horarios_dia=? WHERE id=?')
      .bind(hora_entrada, hora_salida, horas_dia, dias_semana||'LMXJV', notas||null, hdStr, existe.id).run();
    return json({ ok: true, id: existe.id });
  }
  const r = await env.DB.prepare('INSERT INTO horarios_obra (empresa_id,obra_id,hora_entrada,hora_salida,horas_dia,dias_semana,notas,horarios_dia) VALUES (?,?,?,?,?,?,?,?)')
    .bind(empresa_id, obra_id||null, hora_entrada, hora_salida, horas_dia, dias_semana||'LMXJV', notas||null, hdStr).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarHorarioObra(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { hora_entrada, hora_salida, dias_semana, notas, horarios_dia } = body;
  const horas_dia = calcHoras(hora_entrada, hora_salida);
  const hdStr = horarios_dia ? JSON.stringify(horarios_dia) : null;
  await env.DB.prepare('UPDATE horarios_obra SET hora_entrada=?,hora_salida=?,horas_dia=?,dias_semana=?,notas=?,horarios_dia=? WHERE id=? AND empresa_id=?')
    .bind(hora_entrada, hora_salida, horas_dia, dias_semana||'LMXJV', notas||null, hdStr, id, empresa_id).run();
  return json({ ok: true });
}

async function eliminarHorarioObra(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM horarios_obra WHERE id=? AND empresa_id=?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Personal externo ────────────────────────────────────────────────────────
async function getPersonalExterno(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const { results } = await env.DB.prepare(
    'SELECT p.*, o.nombre as obra_nombre FROM personal_externo p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ? AND p.activo = 1 ORDER BY p.nombre'
  ).bind(empresa_id).all();
  return json(results);
}

async function crearPersonalExterno(request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const { nombre, dni, obra_id, notas } = await request.json().catch(() => ({}));
  if (!nombre?.trim()) return err('Falta el nombre');
  const r = await env.DB.prepare('INSERT INTO personal_externo (empresa_id,nombre,dni,obra_id,notas) VALUES (?,?,?,?,?)')
    .bind(empresa_id, nombre.trim(), dni?.trim()||null, obra_id||null, notas?.trim()||null).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarPersonalExterno(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const campos = []; const vals = [];
  if (body.nombre   !== undefined) { campos.push('nombre=?');   vals.push(body.nombre.trim()); }
  if (body.dni      !== undefined) { campos.push('dni=?');      vals.push(body.dni?.trim()||null); }
  if (body.obra_id  !== undefined) { campos.push('obra_id=?');  vals.push(body.obra_id||null); }
  if (body.activo   !== undefined) { campos.push('activo=?');   vals.push(body.activo); }
  if (body.notas    !== undefined) { campos.push('notas=?');    vals.push(body.notas?.trim()||null); }
  if (!campos.length) return json({ ok: true });
  vals.push(id); vals.push(empresa_id);
  await env.DB.prepare(`UPDATE personal_externo SET ${campos.join(',')} WHERE id=? AND empresa_id=?`).bind(...vals).run();
  return json({ ok: true });
}

async function eliminarPersonalExterno(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('UPDATE personal_externo SET activo=0 WHERE id=? AND empresa_id=?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Trabajadores (usuarios app + externo) ──────────────────────────────────
async function getTrabajadores(request, env) {
  const { empresa_id, obra_id: obraAuth, isSuperadmin, isEmpresaAdmin, isAdmin, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const obra_id = url.searchParams.get('obra_id') || ((!isSuperadmin && !isEmpresaAdmin && !isAdmin) ? obraAuth : null);

  let sqlU = 'SELECT id, nombre, rol, departamento, obra_id, NULL as dni, "app" as tipo FROM usuarios WHERE empresa_id=? AND activo=1';
  const paramsU = [empresa_id];
  if (obra_id) { sqlU += ' AND obra_id=?'; paramsU.push(parseInt(obra_id)); }
  sqlU += ' ORDER BY nombre';

  let sqlP = 'SELECT id, nombre, NULL as rol, departamento, obra_id, dni, "externo" as tipo FROM personal_externo WHERE empresa_id=? AND activo=1';
  const paramsP = [empresa_id];
  if (obra_id) { sqlP += ' AND obra_id=?'; paramsP.push(parseInt(obra_id)); }
  sqlP += ' ORDER BY nombre';

  const [ru, rp] = await Promise.all([
    env.DB.prepare(sqlU).bind(...paramsU).all(),
    env.DB.prepare(sqlP).bind(...paramsP).all(),
  ]);
  return json([...ru.results, ...rp.results]);
}

// ── Fichajes ────────────────────────────────────────────────────────────────
async function getFichajes(request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isAdmin, obra_id: obraAuth, rol, usuario_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const fecha      = url.searchParams.get('fecha');
  const fecha_ini  = url.searchParams.get('fecha_ini');
  const fecha_fin  = url.searchParams.get('fecha_fin');
  const obra_id    = url.searchParams.get('obra_id');
  const uid        = url.searchParams.get('usuario_id');
  const peid       = url.searchParams.get('personal_externo_id');

  let sql = `SELECT f.*, u.nombre as nombre_usuario, pe.nombre as nombre_externo, o.nombre as obra_nombre
             FROM fichajes f
             LEFT JOIN usuarios u ON f.usuario_id = u.id
             LEFT JOIN personal_externo pe ON f.personal_externo_id = pe.id
             LEFT JOIN obras o ON f.obra_id = o.id
             WHERE f.empresa_id = ?`;
  const params = [empresa_id];

  // Operario: solo ve sus propios fichajes
  if (rol === 'operario') { sql += ' AND f.usuario_id = ?'; params.push(usuario_id); }
  else {
    if (uid)  { sql += ' AND f.usuario_id = ?';            params.push(parseInt(uid)); }
    if (peid) { sql += ' AND f.personal_externo_id = ?';   params.push(parseInt(peid)); }
    // encargado sin superadmin: solo su obra
    if (!isSuperadmin && !isEmpresaAdmin && !isAdmin && obraAuth) {
      sql += ' AND f.obra_id = ?'; params.push(obraAuth);
    } else if (obra_id) {
      sql += ' AND f.obra_id = ?'; params.push(parseInt(obra_id));
    }
  }
  if (fecha)     { sql += ' AND f.fecha = ?';        params.push(fecha); }
  if (fecha_ini) { sql += ' AND f.fecha >= ?';       params.push(fecha_ini); }
  if (fecha_fin) { sql += ' AND f.fecha <= ?';       params.push(fecha_fin); }
  sql += ' ORDER BY f.fecha DESC, f.hora_entrada ASC LIMIT 500';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearFichaje(request, env) {
  const { empresa_id, rol, nombre: encargadoNombre, obra_id: obraAuth, isSuperadmin, isEmpresaAdmin, isAdmin } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { usuario_id, personal_externo_id, obra_id, fecha, hora_entrada, hora_salida, estado, motivo, notas } = body;
  if (!fecha) return err('Falta la fecha');
  if (!usuario_id && !personal_externo_id) return err('Falta el trabajador');

  // Verificar duplicado
  const dup = await env.DB.prepare(
    'SELECT id FROM fichajes WHERE empresa_id=? AND fecha=? AND (usuario_id=? OR personal_externo_id=?)'
  ).bind(empresa_id, fecha, usuario_id||null, personal_externo_id||null).first();
  if (dup) return err('Ya existe un fichaje para este trabajador en esta fecha', 409);

  const horas = calcHoras(hora_entrada, hora_salida);
  // Calcular horas extra y detectar retraso según horario de obra
  let horas_extra = 0, minutos_retraso = 0;
  let estadoFinal = estado || 'presente';
  if (obra_id || obraAuth) {
    const horarioRow = await env.DB.prepare('SELECT * FROM horarios_obra WHERE empresa_id=? AND obra_id=?').bind(empresa_id, obra_id||obraAuth).first();
    if (horarioRow) {
      const hd = getHorarioParaDia(horarioRow, fecha);
      if (horas > 0) horas_extra = Math.max(0, Math.round((horas - hd.horas_dia) * 100) / 100);
      // Auto-detectar retraso: >5 min tarde y estado era presencia/presente
      if (hora_entrada && ['presencia','presente'].includes(estadoFinal)) {
        const mins = calcMinutosRetraso(hora_entrada, hd.hora_entrada);
        if (mins > 5) { minutos_retraso = mins; estadoFinal = 'retraso'; }
      }
    }
  }

  const r = await env.DB.prepare(
    'INSERT INTO fichajes (empresa_id,usuario_id,personal_externo_id,obra_id,fecha,hora_entrada,hora_salida,horas_trabajadas,horas_extra,minutos_retraso,estado,motivo,notas,registrado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, usuario_id||null, personal_externo_id||null, obra_id||obraAuth||null, fecha,
    hora_entrada||null, hora_salida||null, horas, horas_extra, minutos_retraso,
    estadoFinal, motivo?.trim()||null, notas?.trim()||null, encargadoNombre||rol
  ).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarFichaje(id, request, env) {
  const { empresa_id, rol, nombre: encargadoNombre, obra_id: obraAuth } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const campos = []; const vals = [];
  if (body.hora_entrada !== undefined) { campos.push('hora_entrada=?'); vals.push(body.hora_entrada||null); }
  if (body.hora_salida  !== undefined) { campos.push('hora_salida=?');  vals.push(body.hora_salida||null); }
  if (body.obra_id      !== undefined) { campos.push('obra_id=?');      vals.push(body.obra_id||null); }
  if (body.estado       !== undefined) { campos.push('estado=?');       vals.push(body.estado); }
  if (body.motivo       !== undefined) { campos.push('motivo=?');       vals.push(body.motivo?.trim()||null); }
  if (body.notas        !== undefined) { campos.push('notas=?');        vals.push(body.notas?.trim()||null); }

  // Recalcular horas, horas_extra y retraso si cambian las horas
  if (body.hora_entrada !== undefined || body.hora_salida !== undefined) {
    const f = await env.DB.prepare('SELECT * FROM fichajes WHERE id=? AND empresa_id=?').bind(id, empresa_id).first();
    if (f) {
      const ent = body.hora_entrada ?? f.hora_entrada;
      const sal = body.hora_salida  ?? f.hora_salida;
      const horas = calcHoras(ent, sal);
      campos.push('horas_trabajadas=?'); vals.push(horas);
      const horarioRow = f.obra_id ? await env.DB.prepare('SELECT * FROM horarios_obra WHERE empresa_id=? AND obra_id=?').bind(empresa_id, f.obra_id).first() : null;
      const hd = horarioRow ? getHorarioParaDia(horarioRow, f.fecha) : null;
      const horas_extra = hd ? Math.max(0, Math.round((horas - hd.horas_dia)*100)/100) : 0;
      campos.push('horas_extra=?'); vals.push(horas_extra);
      // Recalcular retraso si cambió hora_entrada
      if (body.hora_entrada !== undefined && hd) {
        const mins = calcMinutosRetraso(ent, hd.hora_entrada);
        campos.push('minutos_retraso=?'); vals.push(Math.max(0, mins));
        const estadoActual = body.estado ?? f.estado;
        if (['presencia','presente','retraso'].includes(estadoActual) && !body.estado) {
          const nuevoEstado = mins > 5 ? 'retraso' : 'presente';
          campos.push('estado=?'); vals.push(nuevoEstado);
        }
      }
    }
  }
  if (!campos.length) return json({ ok: true });
  vals.push(id); vals.push(empresa_id);
  await env.DB.prepare(`UPDATE fichajes SET ${campos.join(',')} WHERE id=? AND empresa_id=?`).bind(...vals).run();
  return json({ ok: true });
}

async function eliminarFichaje(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM fichajes WHERE id=? AND empresa_id=?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Resúmenes ────────────────────────────────────────────────────────────────
async function getResumenSemana(request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isAdmin, obra_id: obraAuth, rol, usuario_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  // lunes de la semana pedida
  const lunes = url.searchParams.get('lunes'); // formato YYYY-MM-DD
  const obra_id = url.searchParams.get('obra_id');
  if (!lunes) return err('Falta el parámetro lunes');

  // Calcular domingo
  const d = new Date(lunes + 'T00:00:00Z');
  const domingo = new Date(d); domingo.setUTCDate(d.getUTCDate() + 6);
  const domStr = domingo.toISOString().slice(0, 10);

  let sql = `SELECT f.*, u.nombre as nombre_usuario, pe.nombre as nombre_externo
             FROM fichajes f
             LEFT JOIN usuarios u ON f.usuario_id = u.id
             LEFT JOIN personal_externo pe ON f.personal_externo_id = pe.id
             WHERE f.empresa_id=? AND f.fecha>=? AND f.fecha<=?`;
  const params = [empresa_id, lunes, domStr];
  if (rol === 'operario') { sql += ' AND f.usuario_id=?'; params.push(usuario_id); }
  else if (!isSuperadmin && !isEmpresaAdmin && !isAdmin && obraAuth) {
    sql += ' AND f.obra_id=?'; params.push(obraAuth);
  } else if (obra_id) {
    sql += ' AND f.obra_id=?'; params.push(parseInt(obra_id));
  }
  sql += ' ORDER BY f.fecha ASC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ lunes, domingo: domStr, fichajes: results });
}

async function getResumenMes(request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isAdmin, obra_id: obraAuth, rol, usuario_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const anio = url.searchParams.get('anio') || new Date().getFullYear();
  const mes  = url.searchParams.get('mes')  || (new Date().getMonth() + 1);
  const obra_id = url.searchParams.get('obra_id');
  const mesStr = String(mes).padStart(2, '0');
  const inicio = `${anio}-${mesStr}-01`;
  const fin    = `${anio}-${mesStr}-31`;

  let sql = `SELECT f.*, u.nombre as nombre_usuario, pe.nombre as nombre_externo
             FROM fichajes f
             LEFT JOIN usuarios u ON f.usuario_id = u.id
             LEFT JOIN personal_externo pe ON f.personal_externo_id = pe.id
             WHERE f.empresa_id=? AND f.fecha>=? AND f.fecha<=?`;
  const params = [empresa_id, inicio, fin];
  if (rol === 'operario') { sql += ' AND f.usuario_id=?'; params.push(usuario_id); }
  else if (!isSuperadmin && !isEmpresaAdmin && !isAdmin && obraAuth) {
    sql += ' AND f.obra_id=?'; params.push(obraAuth);
  } else if (obra_id) {
    sql += ' AND f.obra_id=?'; params.push(parseInt(obra_id));
  }
  sql += ' ORDER BY f.fecha ASC, f.hora_entrada ASC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json({ anio, mes, fichajes: results });
}

// ════════════════════════════════════════════════════════════════════════════
// BACKUP / RESTAURAR
// ════════════════════════════════════════════════════════════════════════════

async function backupInventario(request, env) {
  const auth = await getAuth(request, env).catch(() => null);
  if (!auth?.empresa_id) return err('No autorizado', 401);
  const eid = auth.empresa_id;

  const [bobinas, pemp, carretillas, inv_seg, mov_seg, pedidos, herramientas, kits, hist_herr] = await Promise.all([
    env.DB.prepare('SELECT * FROM bobinas WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT * FROM pemp WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT * FROM carretillas WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT * FROM inventario_seg WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT m.* FROM movimientos_seg m JOIN inventario_seg i ON m.item_id=i.id WHERE i.empresa_id=? ORDER BY m.id').bind(eid).all().then(r=>r.results).catch(()=>[]),
    env.DB.prepare('SELECT * FROM pedidos WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT * FROM herramientas WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT * FROM kits_herramientas WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT h.* FROM historial_herramientas h JOIN herramientas t ON h.herramienta_id=t.id WHERE t.empresa_id=? ORDER BY h.id').bind(eid).all().then(r=>r.results).catch(()=>[]),
  ]);

  const payload = JSON.stringify({
    tipo: 'inventario', version: '1.0', fecha: new Date().toISOString(),
    bobinas, pemp, carretillas, inventario_seg: inv_seg, movimientos_seg: mov_seg,
    pedidos, herramientas, kits_herramientas: kits, historial_herramientas: hist_herr,
  });
  return new Response(payload, {
    headers: { ...CORS, 'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-inventario-${new Date().toISOString().slice(0,10)}.json"` }
  });
}

async function backupEmpresa(request, env) {
  const auth = await getAuth(request, env).catch(() => null);
  if (!auth?.empresa_id) return err('No autorizado', 401);
  const eid = auth.empresa_id;

  const [obras, usuarios, proveedores, tipos_cable, tipos_pemp, tipos_carretilla, energias, tipos_mat_seg, tipos_herr] = await Promise.all([
    env.DB.prepare('SELECT id,nombre,codigo,activa FROM obras WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre,rol,codigo,departamento FROM usuarios WHERE empresa_id=? ORDER BY id').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre FROM proveedores WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre FROM tipos_cable WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre FROM tipos_pemp WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre FROM tipos_carretilla WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre FROM energias_carretilla WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre,tipo FROM tipos_material_seg WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
    env.DB.prepare('SELECT id,nombre FROM tipos_herramienta WHERE empresa_id=? ORDER BY nombre').bind(eid).all().then(r=>r.results),
  ]);

  const payload = JSON.stringify({
    tipo: 'empresa', version: '1.0', fecha: new Date().toISOString(),
    obras, usuarios, proveedores, tipos_cable, tipos_pemp, tipos_carretilla,
    energias_carretilla: energias, tipos_material_seg: tipos_mat_seg, tipos_herramienta: tipos_herr,
  });
  return new Response(payload, {
    headers: { ...CORS, 'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="backup-empresa-${new Date().toISOString().slice(0,10)}.json"` }
  });
}

async function restaurarInventario(request, env) {
  const auth = await getAuth(request, env).catch(() => null);
  if (!auth?.empresa_id) return err('No autorizado', 401);
  if (auth.rol !== 'superadmin' && auth.rol !== 'empresa_admin' && !auth.isAdmin) return err('Sin permisos', 403);
  const eid = auth.empresa_id;

  const bk = await request.json();
  if (bk.tipo !== 'inventario') return err('Archivo no válido: se esperaba backup de inventario', 400);

  // 1. Borrar datos actuales
  await env.DB.batch([
    env.DB.prepare('DELETE FROM bobinas WHERE empresa_id=?').bind(eid),
    env.DB.prepare('DELETE FROM pemp WHERE empresa_id=?').bind(eid),
    env.DB.prepare('DELETE FROM carretillas WHERE empresa_id=?').bind(eid),
    env.DB.prepare('DELETE FROM pedidos WHERE empresa_id=?').bind(eid),
    env.DB.prepare('DELETE FROM herramientas WHERE empresa_id=?').bind(eid),
    env.DB.prepare('DELETE FROM kits_herramientas WHERE empresa_id=?').bind(eid),
  ]);
  // inventario_seg y movimientos_seg en cascada
  const invIds = await env.DB.prepare('SELECT id FROM inventario_seg WHERE empresa_id=?').bind(eid).all().then(r=>r.results.map(r=>r.id));
  if (invIds.length) {
    const chunks = [];
    for (let i=0; i<invIds.length; i+=50) chunks.push(invIds.slice(i,i+50));
    for (const chunk of chunks) {
      const ph = chunk.map(()=>'?').join(',');
      await env.DB.prepare(`DELETE FROM movimientos_seg WHERE item_id IN (${ph})`).bind(...chunk).run();
    }
    await env.DB.prepare('DELETE FROM inventario_seg WHERE empresa_id=?').bind(eid).run();
  }

  const batchInsert = async (rows, stmt) => {
    if (!rows?.length) return;
    const chunks = [];
    for (let i=0; i<rows.length; i+=50) chunks.push(rows.slice(i,i+50));
    for (const chunk of chunks) await env.DB.batch(chunk.map(r => stmt(r)));
  };

  // 2. Insertar desde backup (empresa_id siempre del usuario actual)
  await batchInsert(bk.bobinas, b => env.DB.prepare(
    'INSERT OR REPLACE INTO bobinas (id,codigo,num_albaran,proveedor,tipo_cable,obra_id,estado,registrado_por,devuelto_por,fecha_entrada,fecha_devolucion,notas,departamento,empresa_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(b.id,b.codigo,b.num_albaran||null,b.proveedor,b.tipo_cable,b.obra_id,b.estado,b.registrado_por||null,b.devuelto_por||null,b.fecha_entrada,b.fecha_devolucion||null,b.notas||null,b.departamento||'electrico',eid,b.created_at||new Date().toISOString()));

  await batchInsert(bk.pemp, p => env.DB.prepare(
    'INSERT OR REPLACE INTO pemp (id,matricula,tipo,marca,proveedor,energia,estado,fecha_entrada,registrado_por,notas,fecha_averia,fecha_reparacion,fecha_ultima_revision,fecha_proxima_revision,devuelto_por,fecha_devolucion,obra_id,departamento,empresa_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(p.id,p.matricula,p.tipo||'',p.marca||'',p.proveedor||'',p.energia||'',p.estado,p.fecha_entrada,p.registrado_por||null,p.notas||'',p.fecha_averia||null,p.fecha_reparacion||null,p.fecha_ultima_revision||null,p.fecha_proxima_revision||null,p.devuelto_por||null,p.fecha_devolucion||null,p.obra_id||null,p.departamento||'electrico',eid,p.created_at||new Date().toISOString()));

  await batchInsert(bk.carretillas, c => env.DB.prepare(
    'INSERT OR REPLACE INTO carretillas (id,matricula,tipo,marca,proveedor,energia,estado,fecha_entrada,registrado_por,notas,fecha_averia,fecha_reparacion,fecha_ultima_revision,fecha_proxima_revision,devuelto_por,fecha_devolucion,obra_id,departamento,empresa_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(c.id,c.matricula,c.tipo||'',c.marca||'',c.proveedor||'',c.energia||'',c.estado,c.fecha_entrada,c.registrado_por||null,c.notas||'',c.fecha_averia||null,c.fecha_reparacion||null,c.fecha_ultima_revision||null,c.fecha_proxima_revision||null,c.devuelto_por||null,c.fecha_devolucion||null,c.obra_id||null,c.departamento||'electrico',eid,c.created_at||new Date().toISOString()));

  await batchInsert(bk.inventario_seg, s => env.DB.prepare(
    'INSERT OR REPLACE INTO inventario_seg (id,tipo_material,modo,codigo,nombre,cantidad_total,cantidad_disponible,estado,fecha_entrada,fecha_caducidad,destino_actual,notas,registrado_por,empresa_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(s.id,s.tipo_material,s.modo,s.codigo||null,s.nombre||null,s.cantidad_total||1,s.cantidad_disponible||1,s.estado||'disponible',s.fecha_entrada||null,s.fecha_caducidad||null,s.destino_actual||null,s.notas||null,s.registrado_por||null,eid,s.created_at||new Date().toISOString()));

  await batchInsert(bk.pedidos, p => env.DB.prepare(
    'INSERT OR REPLACE INTO pedidos (id,empresa_id,obra_id,departamento,referencia,descripcion,cantidad,unidad,proveedor,solicitado_por,estado,notas,fecha_solicitud,fecha_recepcion,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(p.id,eid,p.obra_id||null,p.departamento||'electrico',p.referencia||null,p.descripcion||'',p.cantidad||1,p.unidad||'ud',p.proveedor||null,p.solicitado_por||null,p.estado||'pendiente',p.notas||null,p.fecha_solicitud||null,p.fecha_recepcion||null,p.created_at||new Date().toISOString()));

  await batchInsert(bk.kits_herramientas, k => env.DB.prepare(
    'INSERT OR REPLACE INTO kits_herramientas (id,empresa_id,numero_kit,nombre,obra_id,departamento,asignado_a,num_componentes,notas,fecha_alta,fecha_asignacion,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(k.id,eid,k.numero_kit||null,k.nombre||'',k.obra_id||null,k.departamento||'electrico',k.asignado_a||null,k.num_componentes||0,k.notas||null,k.fecha_alta||null,k.fecha_asignacion||null,k.created_at||new Date().toISOString()));

  await batchInsert(bk.herramientas, h => env.DB.prepare(
    'INSERT OR REPLACE INTO herramientas (id,empresa_id,kit_id,tipo_id,marca,modelo,numero_serie,departamento,obra_id,asignado_a,alimentacion,estado,notas,fecha_alta,fecha_asignacion,fecha_devolucion,fecha_averia,fecha_reparacion,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(h.id,eid,h.kit_id||null,h.tipo_id||null,h.marca||'',h.modelo||'',h.numero_serie||'',h.departamento||'electrico',h.obra_id||null,h.asignado_a||null,h.alimentacion||'',h.estado||'disponible',h.notas||null,h.fecha_alta||null,h.fecha_asignacion||null,h.fecha_devolucion||null,h.fecha_averia||null,h.fecha_reparacion||null,h.created_at||new Date().toISOString()));

  return json({ ok: true, mensaje: 'Inventario restaurado correctamente' });
}

async function restaurarEmpresa(request, env) {
  const auth = await getAuth(request, env).catch(() => null);
  if (!auth?.empresa_id) return err('No autorizado', 401);
  if (auth.rol !== 'superadmin' && auth.rol !== 'empresa_admin' && !auth.isAdmin) return err('Sin permisos', 403);
  const eid = auth.empresa_id;

  const bk = await request.json();
  if (bk.tipo !== 'empresa') return err('Archivo no válido: se esperaba backup de empresa', 400);

  const batchInsert = async (rows, stmt) => {
    if (!rows?.length) return;
    const chunks = [];
    for (let i=0; i<rows.length; i+=50) chunks.push(rows.slice(i,i+50));
    for (const chunk of chunks) await env.DB.batch(chunk.map(r => stmt(r)));
  };

  // Obras: upsert por id, forzar empresa_id actual
  await batchInsert(bk.obras, o => env.DB.prepare(
    'INSERT OR REPLACE INTO obras (id,nombre,codigo,activa,empresa_id) VALUES (?,?,?,?,?)'
  ).bind(o.id, o.nombre, o.codigo, o.activa??1, eid));

  // Catálogos: borrar los actuales e insertar los del backup
  const catalogos = [
    { tabla: 'proveedores',        rows: bk.proveedores,          stmt: r => env.DB.prepare('INSERT OR REPLACE INTO proveedores (id,nombre,empresa_id) VALUES (?,?,?)').bind(r.id,r.nombre,eid) },
    { tabla: 'tipos_cable',        rows: bk.tipos_cable,          stmt: r => env.DB.prepare('INSERT OR REPLACE INTO tipos_cable (id,nombre,empresa_id) VALUES (?,?,?)').bind(r.id,r.nombre,eid) },
    { tabla: 'tipos_pemp',         rows: bk.tipos_pemp,           stmt: r => env.DB.prepare('INSERT OR REPLACE INTO tipos_pemp (id,nombre,empresa_id) VALUES (?,?,?)').bind(r.id,r.nombre,eid) },
    { tabla: 'tipos_carretilla',   rows: bk.tipos_carretilla,     stmt: r => env.DB.prepare('INSERT OR REPLACE INTO tipos_carretilla (id,nombre,empresa_id) VALUES (?,?,?)').bind(r.id,r.nombre,eid) },
    { tabla: 'energias_carretilla',rows: bk.energias_carretilla,  stmt: r => env.DB.prepare('INSERT OR REPLACE INTO energias_carretilla (id,nombre,empresa_id) VALUES (?,?,?)').bind(r.id,r.nombre,eid) },
    { tabla: 'tipos_material_seg', rows: bk.tipos_material_seg,   stmt: r => env.DB.prepare('INSERT OR REPLACE INTO tipos_material_seg (id,nombre,tipo,descripcion,empresa_id) VALUES (?,?,?,?,?)').bind(r.id,r.nombre,r.tipo||'',r.descripcion||'',eid) },
    { tabla: 'tipos_herramienta',  rows: bk.tipos_herramienta,    stmt: r => env.DB.prepare('INSERT OR REPLACE INTO tipos_herramienta (id,nombre,empresa_id) VALUES (?,?,?)').bind(r.id,r.nombre,eid) },
  ];
  for (const cat of catalogos) await batchInsert(cat.rows, cat.stmt);

  return json({ ok: true, mensaje: 'Datos de empresa restaurados correctamente' });
}

// ════════════════════════════════════════════════════════════════════════════

async function syncSheets(env, tabs = null, empresa_id = 1) {
  if (!env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_SHEET_ID) return;

  try {
    const token   = await getGoogleToken(env);
    const sheetId = env.GOOGLE_SHEET_ID;
    const authH   = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const tabsNecesarias = ['Elec-Bobinas', 'Elec-PEMP', 'Elec-Carretillas', 'Mec-PEMP', 'Mec-Carretillas', 'Seg-Inventario', 'Elec-Herramientas', 'Mec-Herramientas', 'Kits'];
    const tabsAntiguas   = ['Bobinas', 'PEMP', 'Carretillas', '⚡ Bobinas', '⚡ PEMP', '⚡ Carretillas', '🔧 PEMP', '🔧 Carretillas'];
    const tabsToSync     = tabs ? (Array.isArray(tabs) ? tabs : [tabs]) : tabsNecesarias;

    // Metadata: nombres, IDs numéricos y frozenRowCount
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, { headers: authH });
    const meta = await metaRes.json();
    let sheetsActuales = meta.sheets || [];

    // Pestañas sin frozenRowCount → nunca tuvieron formato aplicado
    const tabsNeedFormat = new Set(
      tabsNecesarias.filter(t => {
        const s = sheetsActuales.find(sh => sh.properties.title === t);
        return !s || (s.properties.gridProperties?.frozenRowCount ?? 0) === 0;
      })
    );

    // Crear pestañas que faltan y borrar las antiguas en un solo batchUpdate
    const addReqs = tabsNecesarias
      .filter(t => !sheetsActuales.map(s => s.properties.title).includes(t))
      .map(t => ({ addSheet: { properties: { title: t } } }));
    const delReqs = sheetsActuales
      .filter(s => tabsAntiguas.includes(s.properties.title))
      .map(s => ({ deleteSheet: { sheetId: s.properties.sheetId } }));

    if (addReqs.length > 0 || delReqs.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST', headers: authH, body: JSON.stringify({ requests: [...addReqs, ...delReqs] }),
      }).then(r => r.body?.cancel());
      const m2 = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, { headers: authH })).json();
      sheetsActuales = m2.sheets || [];
    }

    const numIdMap = {};
    sheetsActuales.forEach(s => { numIdMap[s.properties.title] = s.properties.sheetId; });

    const writeTab = async (tab, values) => {
      if (!tabsToSync.includes(tab)) return;
      const range = `${tab}!A1`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`,
        { method: 'POST', headers: authH }).then(r => r.body?.cancel());
      const putRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        { method: 'PUT', headers: authH, body: JSON.stringify({ values }) });
      if (!putRes.ok) {
        const errBody = await putRes.text();
        throw new Error(`writeTab(${tab}) HTTP ${putRes.status}: ${errBody.slice(0, 200)}`);
      } else { await putRes.body?.cancel(); }
      if (numIdMap[tab] !== undefined) {
        await applyTabFormatting(sheetId, authH, tab, numIdMap[tab], values[0]?.length || 1);
      }
    };

    const cabBobinas     = ['Obra', 'Código', 'Nº Albarán', 'Proveedor', 'Tipo Cable', 'Registrado por', 'Fecha Entrada', 'Devuelto por', 'Fecha Devolución', 'Estado', 'Notas'];
    const cabPemp        = ['Obra', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Estado', 'Fecha Entrada', 'Fecha Avería', 'Fecha Reparación', 'Devuelto por', 'Fecha Devolución', 'Últ. Revisión', 'Próx. Revisión', 'Registrado por', 'Notas'];
    const cabCarretillas = ['Obra', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Energía', 'Estado', 'Fecha Entrada', 'Fecha Avería', 'Fecha Reparación', 'Devuelto por', 'Fecha Devolución', 'Últ. Revisión', 'Próx. Revisión', 'Registrado por', 'Notas'];
    const cabSegInv      = ['Tipo', 'Modo', 'Código/Serie', 'Nombre', 'Cantidad Total', 'Disponible', 'Estado', 'Fecha Entrada', 'Fecha Caducidad', 'Destino Actual', 'Registrado por', 'Notas'];
    const cabHerr        = ['Obra', 'Kit', 'Tipo', 'Marca', 'Modelo', 'Nº Serie', 'Asignado a', 'Alimentación', 'Estado', 'Fecha Alta', 'Fecha Asignación', 'Fecha Devolución', 'Fecha Avería', 'Fecha Reparación', 'Notas'];
    const cabKits        = ['Nº Kit', 'Nombre', 'Obra', 'Departamento', 'Asignado a', 'Componentes', 'Fecha Alta', 'Fecha Asignación', 'Estado', 'Fecha Devolución', 'Notas'];

    const fmtB    = b => [b.obra_nombre||'', b.codigo, b.num_albaran||'', b.proveedor, b.tipo_cable, b.registrado_por||'', b.fecha_entrada, b.devuelto_por||'', b.fecha_devolucion||'', b.estado, b.notas||''];
    const fmtP    = p => [p.obra_nombre||'', p.matricula, p.tipo||'', p.marca||'', p.proveedor||'', p.estado, p.fecha_entrada, p.fecha_averia||'', p.fecha_reparacion||'', p.devuelto_por||'', p.fecha_devolucion||'', p.fecha_ultima_revision||'', p.fecha_proxima_revision||'', p.registrado_por||'', p.notas||''];
    const fmtC    = c => [c.obra_nombre||'', c.matricula, c.tipo||'', c.marca||'', c.proveedor||'', c.energia||'', c.estado, c.fecha_entrada, c.fecha_averia||'', c.fecha_reparacion||'', c.devuelto_por||'', c.fecha_devolucion||'', c.fecha_ultima_revision||'', c.fecha_proxima_revision||'', c.registrado_por||'', c.notas||''];
    const fmtSeg  = s => [s.tipo_material, s.modo, s.codigo||'', s.nombre||'', s.cantidad_total||1, s.cantidad_disponible||1, s.estado||'disponible', s.fecha_entrada||'', s.fecha_caducidad||'', s.destino_actual||'', s.registrado_por||'', s.notas||''];
    const fmtHerr = h => [h.obra_nombre||'', h.kit_nombre||'', h.tipo_nombre||'', h.marca||'', h.modelo||'', h.numero_serie||'', h.asignado_a||'', h.alimentacion||'', h.estado||'disponible', h.fecha_alta||'', h.fecha_asignacion||'', h.fecha_devolucion||'', h.fecha_averia||'', h.fecha_reparacion||'', h.notas||''];
    const fmtKit  = k => [k.numero_kit||'', k.nombre||'', k.obra_nombre||'', k.departamento||'', k.asignado_a||'', k.num_componentes||0, k.fecha_alta||'', k.fecha_asignacion||'', k.estado||'disponible', k.fecha_devolucion||'', k.notas||''];

    // Solo ejecutar queries para las pestañas que toca sincronizar, en paralelo
    await Promise.all([
      tabsToSync.includes('Elec-Bobinas') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT b.*, o.nombre as obra_nombre FROM bobinas b LEFT JOIN obras o ON b.obra_id = o.id WHERE b.empresa_id = ? AND b.departamento = ? ORDER BY b.created_at DESC'
        ).bind(empresa_id, 'electrico').all();
        await writeTab('Elec-Bobinas', [cabBobinas, ...results.map(fmtB)]);
      })(),
      tabsToSync.includes('Elec-PEMP') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT p.*, o.nombre as obra_nombre FROM pemp p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ? AND p.departamento = ? ORDER BY p.created_at DESC'
        ).bind(empresa_id, 'electrico').all();
        await writeTab('Elec-PEMP', [cabPemp, ...results.map(fmtP)]);
      })(),
      tabsToSync.includes('Elec-Carretillas') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT c.*, o.nombre as obra_nombre FROM carretillas c LEFT JOIN obras o ON c.obra_id = o.id WHERE c.empresa_id = ? AND c.departamento = ? ORDER BY c.created_at DESC'
        ).bind(empresa_id, 'electrico').all();
        await writeTab('Elec-Carretillas', [cabCarretillas, ...results.map(fmtC)]);
      })(),
      tabsToSync.includes('Mec-PEMP') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT p.*, o.nombre as obra_nombre FROM pemp p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ? AND p.departamento = ? ORDER BY p.created_at DESC'
        ).bind(empresa_id, 'mecanicas').all();
        await writeTab('Mec-PEMP', [cabPemp, ...results.map(fmtP)]);
      })(),
      tabsToSync.includes('Mec-Carretillas') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT c.*, o.nombre as obra_nombre FROM carretillas c LEFT JOIN obras o ON c.obra_id = o.id WHERE c.empresa_id = ? AND c.departamento = ? ORDER BY c.created_at DESC'
        ).bind(empresa_id, 'mecanicas').all();
        await writeTab('Mec-Carretillas', [cabCarretillas, ...results.map(fmtC)]);
      })(),
      tabsToSync.includes('Seg-Inventario') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT * FROM inventario_seg WHERE empresa_id = ? ORDER BY tipo_material, created_at DESC'
        ).bind(empresa_id).all();
        await writeTab('Seg-Inventario', [cabSegInv, ...results.map(fmtSeg)]);
      })(),
      tabsToSync.includes('Elec-Herramientas') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT h.*, o.nombre as obra_nombre, t.nombre as tipo_nombre, k.nombre as kit_nombre FROM herramientas h LEFT JOIN obras o ON h.obra_id=o.id LEFT JOIN tipos_herramienta t ON h.tipo_id=t.id LEFT JOIN kits_herramientas k ON h.kit_id=k.id WHERE h.empresa_id=? AND h.departamento=? ORDER BY h.created_at DESC'
        ).bind(empresa_id, 'electrico').all();
        await writeTab('Elec-Herramientas', [cabHerr, ...results.map(fmtHerr)]);
      })(),
      tabsToSync.includes('Mec-Herramientas') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT h.*, o.nombre as obra_nombre, t.nombre as tipo_nombre, k.nombre as kit_nombre FROM herramientas h LEFT JOIN obras o ON h.obra_id=o.id LEFT JOIN tipos_herramienta t ON h.tipo_id=t.id LEFT JOIN kits_herramientas k ON h.kit_id=k.id WHERE h.empresa_id=? AND h.departamento=? ORDER BY h.created_at DESC'
        ).bind(empresa_id, 'mecanicas').all();
        await writeTab('Mec-Herramientas', [cabHerr, ...results.map(fmtHerr)]);
      })(),
      tabsToSync.includes('Kits') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT k.*, o.nombre as obra_nombre FROM kits_herramientas k LEFT JOIN obras o ON k.obra_id=o.id WHERE k.empresa_id=? ORDER BY k.numero_kit'
        ).bind(empresa_id).all();
        await writeTab('Kits', [cabKits, ...results.map(fmtKit)]);
      })(),
    ].filter(Boolean));

    console.log(`Sheets sync OK [${tabsToSync.join(', ')}]`);
  } catch (e) {
    console.error('Error sync Sheets:', e.message);
    try {
      await env.DB.prepare(
        'INSERT INTO logs (nivel, origen, mensaje, detalle) VALUES (?, ?, ?, ?)'
      ).bind('error', 'sync-sheets', 'Error sincronización Google Sheets', e.message).run();
    } catch (_) {}
  }
}

async function syncPedidos(env, tabs = null, empresa_id = 1) {
  if (!env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PEDIDOS_SHEET_ID) return;

  try {
    const token   = await getGoogleToken(env);
    const sheetId = env.GOOGLE_PEDIDOS_SHEET_ID;
    const authH   = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const tabsNecesarias = ['Elec-Pedidos', 'Mec-Pedidos', 'Seg-Pedidos'];
    const tabsToSync     = tabs ? (Array.isArray(tabs) ? tabs : [tabs]) : tabsNecesarias;

    // Metadata
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, { headers: authH });
    const meta = await metaRes.json();
    let sheetsActuales = meta.sheets || [];

    const tabsNeedFormat = new Set(
      tabsNecesarias.filter(t => {
        const s = sheetsActuales.find(sh => sh.properties.title === t);
        return !s || (s.properties.gridProperties?.frozenRowCount ?? 0) === 0;
      })
    );

    // Crear pestañas que faltan
    const addReqs = tabsNecesarias
      .filter(t => !sheetsActuales.map(s => s.properties.title).includes(t))
      .map(t => ({ addSheet: { properties: { title: t } } }));

    if (addReqs.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST', headers: authH, body: JSON.stringify({ requests: addReqs }),
      }).then(r => r.body?.cancel());
      const m2 = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, { headers: authH })).json();
      sheetsActuales = m2.sheets || [];
    }

    const numIdMap = {};
    sheetsActuales.forEach(s => { numIdMap[s.properties.title] = s.properties.sheetId; });

    const cab = ['Obra', 'Referencia', 'Descripción', 'Cantidad', 'Unidad', 'Proveedor', 'Estado', 'Solicitado por', 'Fecha Solicitud', 'Fecha Recepción', 'Notas'];
    const fmt = p => [p.obra_nombre||'', p.referencia||'', p.descripcion||'', p.cantidad||1, p.unidad||'ud', p.proveedor||'', p.estado||'pendiente', p.solicitado_por||'', p.fecha_solicitud||p.created_at||'', p.fecha_recepcion||'', p.notas||''];

    const writeTab = async (tab, values) => {
      if (!tabsToSync.includes(tab)) return;
      const range = `${tab}!A1`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`,
        { method: 'POST', headers: authH }).then(r => r.body?.cancel());
      const putRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        { method: 'PUT', headers: authH, body: JSON.stringify({ values }) });
      if (!putRes.ok) throw new Error(`writeTab(${tab}) HTTP ${putRes.status}: ${(await putRes.text()).slice(0, 200)}`);
      else await putRes.body?.cancel();
      if (numIdMap[tab] !== undefined) {
        await applyTabFormatting(sheetId, authH, tab, numIdMap[tab], values[0]?.length || 1);
      }
    };

    await Promise.all([
      tabsToSync.includes('Elec-Pedidos') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT p.*, o.nombre as obra_nombre FROM pedidos p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ? AND p.departamento = ? ORDER BY p.created_at DESC'
        ).bind(empresa_id, 'electrico').all();
        await writeTab('Elec-Pedidos', [cab, ...results.map(fmt)]);
      })(),
      tabsToSync.includes('Mec-Pedidos') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT p.*, o.nombre as obra_nombre FROM pedidos p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ? AND p.departamento = ? ORDER BY p.created_at DESC'
        ).bind(empresa_id, 'mecanicas').all();
        await writeTab('Mec-Pedidos', [cab, ...results.map(fmt)]);
      })(),
      tabsToSync.includes('Seg-Pedidos') && (async () => {
        const { results } = await env.DB.prepare(
          'SELECT p.*, o.nombre as obra_nombre FROM pedidos p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ? AND p.departamento = ? ORDER BY p.created_at DESC'
        ).bind(empresa_id, 'seguridad').all();
        await writeTab('Seg-Pedidos', [cab, ...results.map(fmt)]);
      })(),
    ].filter(Boolean));

    console.log(`Pedidos sync OK [${tabsToSync.join(', ')}]`);
  } catch (e) {
    console.error('Error sync Pedidos:', e.message);
    try {
      await env.DB.prepare('INSERT INTO logs (nivel, origen, mensaje, detalle) VALUES (?, ?, ?, ?)')
        .bind('error', 'sync-pedidos', 'Error sincronización Pedidos Sheets', e.message).run();
    } catch (_) {}
  }
}

async function applyTabFormatting(spreadsheetId, authH, tabName, numSheetId, numCols) {
  const headerBg = tabName.startsWith('Elec')
    ? { red: 1.0,   green: 0.851, blue: 0.4,   alpha: 1 }   // #FFD966 ámbar
    : tabName.startsWith('Mec')
    ? { red: 0.624, green: 0.773, blue: 0.910, alpha: 1 }   // #9FC5E8 azul
    : { red: 0.965, green: 0.698, blue: 0.420, alpha: 1 };  // #F6B26B naranja (Seg)

  // Columna "Estado" por pestaña (índice 0-based)
  const estadoColMap = {
    'Elec-Bobinas': 9, 'Elec-PEMP': 5, 'Elec-Carretillas': 6,
    'Mec-PEMP': 5,     'Mec-Carretillas': 6,
    'Seg-Inventario': 6, 'Elec-Pedidos': 6, 'Mec-Pedidos': 6, 'Seg-Pedidos': 6,
    'Elec-Herramientas': 8, 'Mec-Herramientas': 8, 'Kits': 8,
  };
  const estadoCol = estadoColMap[tabName] ?? -1;

  const requests = [
    // Cabecera: negrita + color de fondo
    {
      repeatCell: {
        range: { sheetId: numSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerBg,
            textFormat: { bold: true, fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)',
      },
    },
    // Congelar fila de cabecera
    {
      updateSheetProperties: {
        properties: { sheetId: numSheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Auto-ajustar anchos de columna
    {
      autoResizeDimensions: {
        dimensions: { sheetId: numSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: numCols },
      },
    },
  ];

  // Colores condicionales para columna Estado
  if (estadoCol >= 0) {
    const estadoRange = {
      sheetId: numSheetId, startRowIndex: 1,
      startColumnIndex: estadoCol, endColumnIndex: estadoCol + 1,
    };
    const reglas = [
      { valor: 'activa',         bg: { red: 0.714, green: 0.843, blue: 0.659, alpha: 1 } },  // verde
      { valor: 'disponible',     bg: { red: 0.714, green: 0.843, blue: 0.659, alpha: 1 } },  // verde
      { valor: 'recibido',       bg: { red: 0.714, green: 0.843, blue: 0.659, alpha: 1 } },  // verde
      { valor: 'Averiada',       bg: { red: 0.918, green: 0.600, blue: 0.600, alpha: 1 } },  // rojo
      { valor: 'averiado',       bg: { red: 0.918, green: 0.600, blue: 0.600, alpha: 1 } },  // rojo
      { valor: 'devuelta',       bg: { red: 0.839, green: 0.839, blue: 0.839, alpha: 1 } },  // gris
      { valor: 'cancelado',      bg: { red: 0.839, green: 0.839, blue: 0.839, alpha: 1 } },  // gris
      { valor: 'baja',           bg: { red: 0.839, green: 0.839, blue: 0.839, alpha: 1 } },  // gris
      { valor: 'perdido',        bg: { red: 0.800, green: 0.651, blue: 0.851, alpha: 1 } },  // morado
      { valor: 'pendiente',      bg: { red: 1.0,   green: 0.949, blue: 0.800, alpha: 1 } },  // amarillo
      { valor: 'solicitado',     bg: { red: 0.675, green: 0.843, blue: 0.902, alpha: 1 } },  // azul
      { valor: 'en_uso',         bg: { red: 0.675, green: 0.843, blue: 0.902, alpha: 1 } },  // azul
      { valor: 'en_reparacion',  bg: { red: 1.0,   green: 0.851, blue: 0.4,   alpha: 1 } },  // ámbar
    ];
    for (const r of reglas) {
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [estadoRange],
            booleanRule: {
              condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: r.valor }] },
              format: { backgroundColor: r.bg },
            },
          },
          index: 0,
        },
      });
    }
  }

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST', headers: authH, body: JSON.stringify({ requests }),
  }).then(r => r.body?.cancel());
}

async function syncSheetsDebug(env) {
  const log = [];
  try {
    log.push('Verificando variables...');
    log.push(`GOOGLE_CLIENT_EMAIL: ${env.GOOGLE_CLIENT_EMAIL ? 'OK' : 'NO DEFINIDA'}`);
    log.push(`GOOGLE_PRIVATE_KEY: ${env.GOOGLE_PRIVATE_KEY ? 'OK (' + env.GOOGLE_PRIVATE_KEY.length + ' chars)' : 'NO DEFINIDA'}`);
    log.push(`GOOGLE_SHEET_ID: ${env.GOOGLE_SHEET_ID ? 'OK ' + env.GOOGLE_SHEET_ID : 'NO DEFINIDA'}`);

    log.push('Obteniendo token Google...');
    const token = await getGoogleToken(env);
    log.push(`Token: OK (${token.slice(0, 20)}...)`);

    const { results } = await env.DB.prepare('SELECT * FROM bobinas ORDER BY created_at DESC').all();
    log.push(`Bobinas en DB: ${results.length}`);

    const values = [
      ['Código', 'Proveedor', 'Tipo Cable', 'Fecha Entrada', 'Fecha Devolución', 'Estado', 'Notas'],
      ...results.map(b => [b.codigo, b.proveedor, b.tipo_cable, b.fecha_entrada, b.fecha_devolucion || '', b.estado, b.notas || '']),
    ];

    log.push('Limpiando hoja...');
    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/A:Z:clear`,
      { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    const clearData = await clearRes.json();
    log.push(`Clear: ${clearRes.status} ${JSON.stringify(clearData).slice(0, 100)}`);

    log.push('Escribiendo datos...');
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}/values/A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      }
    );
    const writeData = await writeRes.json();
    log.push(`Write: ${writeRes.status} ${JSON.stringify(writeData).slice(0, 200)}`);

    return json({ ok: writeRes.ok, log });
  } catch (e) {
    log.push(`ERROR: ${e.message}`);
    return json({ ok: false, log, error: e.message });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// OCR / IA SCAN
// ════════════════════════════════════════════════════════════════════════════

async function handleOCR(request, env) {
  if (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    return err('Credenciales Google no configuradas', 500);
  }

  const { image, mimeType = 'image/jpeg' } = await request.json();
  if (!image) return err('Se requiere imagen en base64');

  try {
    const token = await getGoogleToken(env, 'https://www.googleapis.com/auth/cloud-vision');

    const res = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: image },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['es', 'en'] },
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) return json({ error: 'Error Cloud Vision', details: data }, res.status);

    const textoCompleto = data.responses?.[0]?.textAnnotations?.[0]?.description || '';
    if (!textoCompleto) return json({ codigo: 'NO_LEIDO' });

    const UI_WORDS = new Set([
      'PINCELES','CALIBRI','FORMAS','COLORES','COPILOT','CAPAS','RELLENO','FONDO',
      'COPIAR','PEGAR','ARCHIVO','EDITAR','VER','INSERTAR','INICIO','AYUDA',
      'FORMATO','HERRAMIENTAS','VENTANA','IMAGEN','TEXTO','DIBUJAR','SELECCIONAR',
      'SHAPES','COLORS','BRUSHES','LAYERS','FILL','TOOLS','EDIT','FILE','VIEW',
      'CANVAS','ZOOM','UNDO','REDO','COPY','PASTE','CUT','SELECT','CROP',
    ]);

    const lineas = textoCompleto
      .split('\n')
      .map(l => l.trim().toUpperCase().replace(/[^A-Z0-9\-\/]/g, ''))
      .filter(l => l.length >= 3 && !UI_WORDS.has(l));

    const patronBobina = /^[A-Z]{1,4}[-\/]?[0-9]{3,}[A-Z]{0,2}$/;
    const matricula = lineas.find(l => patronBobina.test(l))
      || lineas
          .filter(l => /[A-Z]/.test(l) && /[0-9]/.test(l))
          .sort((a, b) => (b.match(/[0-9]/g) || []).length - (a.match(/[0-9]/g) || []).length)[0]
      || lineas.sort((a, b) => b.length - a.length)[0]
      || 'NO_LEIDO';

    return json({ codigo: matricula, textoCompleto, metodo: 'Cloud Vision' });
  } catch (e) {
    return err(`Error OCR: ${e.message}`, 500);
  }
}

async function handleScan(request, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return err('GEMINI_API_KEY no configurada', 500);

  const body      = await request.json();
  const imageData = body.image;
  const mimeType  = body.mimeType || 'image/jpeg';
  if (!imageData) return err('Se requiere imagen en base64');

  const prompt = `Eres un lector OCR especializado en matrículas de bobinas de cable eléctrico.
Extrae ÚNICAMENTE el código alfanumérico principal de la matrícula/etiqueta visible en la imagen.
El código suele ser una combinación de letras y números (ej: AB1234, C-2891-X, 45872-B).
Responde SOLO con el código, sin explicaciones, sin espacios extra, sin puntos al final.
Si no puedes leer ningún código, responde: NO_LEIDO`;

  const geminiBody = {
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: imageData } },
      { text: prompt },
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 50 },
  };

  for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash-002', 'gemini-1.5-flash']) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
    );
    const data = await res.json();
    if (res.ok) {
      return json({ codigo: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'NO_LEIDO', modelo: model });
    }
    if (res.status !== 429 && res.status !== 404) return json({ error: 'Error Gemini', details: data }, res.status);
  }

  // Fallback a Cloud Vision si Gemini está agotado
  if (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    const ocrRequest = new Request('https://dummy/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, mimeType }),
    });
    const ocrResult = await handleOCR(ocrRequest, env);
    const ocrData   = await ocrResult.json();
    if (ocrData.codigo && ocrData.codigo !== 'NO_LEIDO') {
      return json({ ...ocrData, modelo: 'Cloud Vision (fallback)' });
    }
  }

  return err('Cuota de Gemini agotada. Usa el modo OCR.', 429);
}

// ════════════════════════════════════════════════════════════════════════════
// INVENTARIO SEGURIDAD
// ════════════════════════════════════════════════════════════════════════════

async function getInventarioSeg(request, env) {
  const { isSuperadmin, isSeguridad, isAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isSeguridad) return err('No autorizado', 403);
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  let sql = 'SELECT * FROM inventario_seg WHERE empresa_id = ?';
  const params = [empresa_id];
  if (q) { sql += ' AND (tipo_material LIKE ? OR codigo LIKE ? OR nombre LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function buscarItemSeg(codigo, env) {
  const item = await env.DB.prepare('SELECT * FROM inventario_seg WHERE codigo = ?').bind(codigo.trim().toUpperCase()).first();
  if (!item) return json({ ok: false, error: 'No encontrado' }, 404);
  const hist = await env.DB.prepare('SELECT * FROM movimientos_seg WHERE item_id = ? ORDER BY fecha DESC LIMIT 10').bind(item.id).all();
  return json({ ok: true, data: item, historial: hist.results });
}

async function crearItemSeg(request, env) {
  const { isSuperadmin, isSeguridad, isAdmin, usuario, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isSeguridad) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { tipo_material, modo = 'individual', codigo, nombre, cantidad_total = 1, fecha_entrada, fecha_caducidad, notas } = body;
  if (!tipo_material) return err('Falta tipo_material');
  if (modo === 'individual' && !codigo) return err('Falta el código identificador');
  const cod = codigo ? codigo.trim().toUpperCase() : null;
  const fecha = fecha_entrada || fechaEspana();
  const reg = usuario || '';
  try {
    const r = await env.DB.prepare(
      `INSERT INTO inventario_seg (tipo_material, modo, codigo, nombre, cantidad_total, cantidad_disponible, estado, fecha_entrada, fecha_caducidad, notas, registrado_por, empresa_id)
       VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?, ?, ?, ?, ?)`
    ).bind(tipo_material, modo, cod, nombre || tipo_material, cantidad_total, cantidad_total, fecha, fecha_caducidad || null, notas || '', reg, empresa_id).run();
    const id = r.meta.last_row_id;
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, usuario, fecha) VALUES (?, ?, ?, ?, ?)').bind(id, 'entrada', cantidad_total, reg, fecha).run();
    if (fecha_caducidad) {
      await sendTelegram(env, `📦 <b>Nuevo material Seguridad</b>\n🔖 ${cod || tipo_material}  📋 ${tipo_material}\n📅 Caduca: ${fecha_caducidad}\n👤 ${reg}`);
    }
    syncSheets(env, 'Seg-Inventario'); // fire & forget
    return json({ ok: true, id, mensaje: `${tipo_material} registrado` }, 201);
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return err(`El código ${cod} ya está registrado`, 409);
    throw e;
  }
}

async function moverItemSeg(id, request, env) {
  const { isSuperadmin, isSeguridad, isAdmin, usuario } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isSeguridad) return err('No autorizado', 403);
  const item = await env.DB.prepare('SELECT * FROM inventario_seg WHERE id = ?').bind(id).first();
  if (!item) return err('Item no encontrado', 404);
  const body = await request.json().catch(() => ({}));
  const { accion, cantidad = 1, destino, notas } = body;
  const fecha = fechaEspana();

  // Edición directa de campos del item (sin movimiento)
  if (accion === 'editar') {
    const { estado: nuevoEstado, destino_actual, notas: nuevasNotas } = body;
    const campos = [], vals = [];
    if (nuevoEstado !== undefined)   { campos.push('estado = ?');         vals.push(nuevoEstado); }
    if (destino_actual !== undefined) { campos.push('destino_actual = ?'); vals.push(destino_actual || null); }
    if (nuevasNotas !== undefined)    { campos.push('notas = ?');          vals.push(nuevasNotas || ''); }
    if (campos.length) {
      vals.push(id);
      await env.DB.prepare(`UPDATE inventario_seg SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
    }
    return json({ ok: true, mensaje: 'Item actualizado' });
  }

  if (accion === 'salida') {
    if (item.modo === 'individual') {
      if (item.estado !== 'disponible') return err('El item no está disponible', 409);
      await env.DB.prepare('UPDATE inventario_seg SET estado = ?, destino_actual = ? WHERE id = ?').bind('en_uso', destino || '', id).run();
    } else {
      const nueva = item.cantidad_disponible - cantidad;
      if (nueva < 0) return err(`No hay suficiente stock (disponible: ${item.cantidad_disponible})`, 409);
      await env.DB.prepare('UPDATE inventario_seg SET cantidad_disponible = ?, estado = ?, destino_actual = ? WHERE id = ?').bind(nueva, nueva === 0 ? 'en_uso' : 'disponible', destino || '', id).run();
    }
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, destino, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, 'salida', cantidad, destino || '', usuario || '', notas || '', fecha).run();
    if (destino) await sendTelegram(env, `📤 <b>Material Seguridad — Salida</b>\n🔖 ${item.codigo || item.nombre}  📋 ${item.tipo_material}\n🏗 Destino: ${destino}\n👤 ${usuario || '—'}`);
    syncSheets(env, 'Seg-Inventario');
    return json({ ok: true, mensaje: 'Salida registrada' });
  }

  if (accion === 'devolucion') {
    if (item.modo === 'individual') {
      await env.DB.prepare('UPDATE inventario_seg SET estado = ?, destino_actual = NULL WHERE id = ?').bind('disponible', id).run();
    } else {
      const nueva = Math.min(item.cantidad_disponible + cantidad, item.cantidad_total);
      await env.DB.prepare('UPDATE inventario_seg SET cantidad_disponible = ?, estado = ?, destino_actual = NULL WHERE id = ?').bind(nueva, 'disponible', id).run();
    }
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)').bind(id, 'devolucion', cantidad, usuario || '', notas || '', fecha).run();
    syncSheets(env, 'Seg-Inventario');
    return json({ ok: true, mensaje: 'Devolución registrada' });
  }

  if (accion === 'baja') {
    await env.DB.prepare('UPDATE inventario_seg SET estado = ? WHERE id = ?').bind('baja', id).run();
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)').bind(id, 'baja', cantidad, usuario || '', notas || '', fecha).run();
    await sendTelegram(env, `🗑️ <b>Material Seguridad — Baja</b>\n🔖 ${item.codigo || item.nombre}  📋 ${item.tipo_material}\n👤 ${usuario || '—'}`);
    syncSheets(env, 'Seg-Inventario');
    return json({ ok: true, mensaje: 'Dado de baja' });
  }

  return err('Acción no reconocida', 400);
}

async function eliminarItemSeg(id, request, env) {
  const { isSuperadmin } = await getAuth(request, env);
  if (!isSuperadmin) return err('Solo el superadmin puede eliminar', 403);
  await env.DB.prepare('DELETE FROM inventario_seg WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM movimientos_seg WHERE item_id = ?').bind(id).run();
  syncSheets(env, 'Seg-Inventario');
  return json({ ok: true, mensaje: 'Eliminado' });
}

async function addTipoMaterialSeg(request, env) {
  const { isSuperadmin, isSeguridad, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isSeguridad) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { nombre, tipo = 'individual', descripcion } = body;
  if (!nombre) return err('Falta el nombre');
  try {
    await env.DB.prepare('INSERT INTO tipos_material_seg (nombre, tipo, descripcion, empresa_id) VALUES (?, ?, ?, ?)').bind(nombre.trim(), tipo, descripcion || '', empresa_id).run();
    return json({ ok: true, mensaje: `Tipo "${nombre}" añadido` }, 201);
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return err(`El tipo "${nombre}" ya existe`, 409);
    throw e;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// CIERRE AUTOMÁTICO JORNADA (Cron 20:00 hora España)
// ════════════════════════════════════════════════════════════════════════════

async function cierreAutomaticoJornada(env) {
  try {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }); // YYYY-MM-DD
    // Fichajes con hora_entrada pero sin hora_salida
    const { results: abiertos } = await env.DB.prepare(
      `SELECT f.*, ho.hora_salida as horario_salida, ho.horas_dia as horario_horas_dia
       FROM fichajes f
       LEFT JOIN horarios_obra ho ON f.obra_id = ho.obra_id AND f.empresa_id = ho.empresa_id
       WHERE f.fecha = ? AND f.hora_entrada IS NOT NULL AND f.hora_entrada != ''
         AND (f.hora_salida IS NULL OR f.hora_salida = '')`
    ).bind(hoy).all();

    if (!abiertos.length) return;

    let cerrados = 0;
    for (const f of abiertos) {
      const horaSalida = f.horario_salida || '18:00';
      const horas = calcHoras(f.hora_entrada, horaSalida);
      const horas_extra = f.horario_horas_dia ? Math.max(0, Math.round((horas - f.horario_horas_dia)*100)/100) : 0;
      const notasActual = f.notas ? f.notas + ' | ' : '';
      await env.DB.prepare(
        `UPDATE fichajes SET hora_salida=?, horas_trabajadas=?, horas_extra=?, notas=? WHERE id=?`
      ).bind(horaSalida, horas, horas_extra, notasActual + '⏰ Cierre automático', f.id).run();
      cerrados++;
    }

    if (cerrados > 0) {
      await sendTelegram(env,
        `⏰ <b>Cierre automático de jornada</b>\n📅 ${hoy}\n✅ ${cerrados} fichaje${cerrados > 1 ? 's cerrados' : ' cerrado'} automáticamente con hora del horario de obra.`
      );
    }
  } catch (e) {
    console.error('Error cierre automático jornada:', e.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ALERTAS DIARIAS (Cron)
// ════════════════════════════════════════════════════════════════════════════

async function alertasDiarias(env) {
  try {
    const hoy = new Date();

    // 1. Máquinas averiadas hace más de 3 días sin reparar
    const [avPemp, avCarr] = await Promise.all([
      env.DB.prepare(`SELECT matricula, fecha_averia, obra_id FROM pemp WHERE estado = 'Averiada' AND fecha_averia IS NOT NULL`).all(),
      env.DB.prepare(`SELECT matricula, fecha_averia, obra_id FROM carretillas WHERE estado = 'Averiada' AND fecha_averia IS NOT NULL`).all(),
    ]);

    const DIAS_AVERIA = 3;
    const averiadas = [];
    for (const m of [...(avPemp.results||[]), ...(avCarr.results||[])]) {
      const dias = Math.floor((hoy - new Date(m.fecha_averia)) / 86400000);
      if (dias >= DIAS_AVERIA) averiadas.push(`🔖 ${m.matricula} — ${dias} días averiada`);
    }
    if (averiadas.length) {
      await sendTelegram(env,
        `⚠️ <b>Máquinas averiadas sin reparar (≥${DIAS_AVERIA} días)</b>\n\n` + averiadas.join('\n')
      );
    }

    // 2. Revisiones próximas (dentro de 15 días o ya vencidas)
    const DIAS_AVISO = 15;
    const limite = new Date(hoy); limite.setDate(limite.getDate() + DIAS_AVISO);
    const limiteStr = limite.toISOString().slice(0, 10);

    const [revPemp, revCarr] = await Promise.all([
      env.DB.prepare(`SELECT matricula, fecha_proxima_revision FROM pemp WHERE fecha_proxima_revision IS NOT NULL AND fecha_proxima_revision != '' AND fecha_proxima_revision <= ?`).bind(limiteStr).all(),
      env.DB.prepare(`SELECT matricula, fecha_proxima_revision FROM carretillas WHERE fecha_proxima_revision IS NOT NULL AND fecha_proxima_revision != '' AND fecha_proxima_revision <= ?`).bind(limiteStr).all(),
    ]);

    const revisiones = [];
    for (const m of [...(revPemp.results||[]), ...(revCarr.results||[])]) {
      const dias = Math.floor((new Date(m.fecha_proxima_revision) - hoy) / 86400000);
      if (dias < 0) revisiones.push(`🔖 ${m.matricula} — VENCIDA hace ${Math.abs(dias)} días`);
      else revisiones.push(`🔖 ${m.matricula} — vence en ${dias} días (${m.fecha_proxima_revision})`);
    }
    if (revisiones.length) {
      await sendTelegram(env,
        `📅 <b>Revisiones próximas o vencidas</b>\n\n` + revisiones.join('\n')
      );
    }

    // 3. Material Seguridad con caducidad próxima o vencida
    const DIAS_CAD = 30;
    const limiteCad = new Date(hoy); limiteCad.setDate(limiteCad.getDate() + DIAS_CAD);
    const limiteCadStr = limiteCad.toISOString().slice(0, 10);
    const matCad = await env.DB.prepare(
      `SELECT tipo_material, codigo, nombre, fecha_caducidad FROM inventario_seg
       WHERE fecha_caducidad IS NOT NULL AND fecha_caducidad != '' AND fecha_caducidad <= ? AND estado != 'baja'`
    ).bind(limiteCadStr).all();
    if (matCad.results?.length) {
      const lineas = matCad.results.map(m => {
        const dias = Math.floor((new Date(m.fecha_caducidad) - hoy) / 86400000);
        return dias < 0
          ? `⛔ ${m.codigo||m.nombre} (${m.tipo_material}) — CADUCADO hace ${Math.abs(dias)} días`
          : `⚠️ ${m.codigo||m.nombre} (${m.tipo_material}) — caduca en ${dias} días (${m.fecha_caducidad})`;
      });
      await sendTelegram(env, `🏷️ <b>Material Seguridad — Caducidad próxima</b>\n\n` + lineas.join('\n'));
    }

  } catch(e) {
    console.error('alertasDiarias error:', e.message);
  }
}

// ══════════════════════════════════════════════════════
// GOOGLE OAUTH
// ══════════════════════════════════════════════════════
function googleAuthUrl(request, env) {
  const url = new URL(request.url);
  const redirect_uri = url.searchParams.get('redirect_uri') || 'https://padilla585projects.github.io/Alejandra-APP/';
  if (!env.GOOGLE_OAUTH_CLIENT_ID) return err('Google OAuth no configurado', 503);
  const params = new URLSearchParams({
    client_id:     env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'online',
    prompt:        'select_account',
  });
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  return json({ url: authUrl });
}

async function googleAuthCallback(request, env) {
  const body = await request.json().catch(() => ({}));
  const { code, redirect_uri, inv_codigo } = body;
  if (!code) return err('Falta el código de autorización', 400);
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) return err('Google OAuth no configurado', 503);

  // Intercambiar código por tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri:  redirect_uri || 'https://padilla585projects.github.io/Alejandra-APP/',
      grant_type:    'authorization_code',
    }).toString(),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    const msg = tokenData.error_description || tokenData.error || 'token inválido';
    return err('Error al autenticar con Google: ' + msg, 401);
  }

  // Obtener info del usuario de Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer ' + tokenData.access_token },
  });
  const gUser = await userRes.json();
  if (!gUser.email) return err('No se pudo obtener el email de Google', 401);

  // Buscar usuario activo en D1 por email
  const u = await env.DB.prepare(
    'SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?) AND activo = 1 LIMIT 1'
  ).bind(gUser.email).first();

  if (!u) {
    // Si viene con código de invitación, registrar directamente
    if (inv_codigo) {
      const ahora = AHORA();
      const inv = await env.DB.prepare(
        'SELECT * FROM invitaciones WHERE codigo = ? AND usado = 0 AND expira_at > ?'
      ).bind(inv_codigo.toUpperCase(), ahora).first();
      if (!inv) return json({ ok: false, inv_error: true, msg: 'El enlace de invitación ha caducado o ya fue utilizado.' });

      const codigoUser = 'g_' + Date.now();
      await env.DB.prepare(
        'INSERT INTO usuarios (nombre, codigo, rol, departamento, activo, google_pending, email, empresa_id) VALUES (?,?,?,?,1,0,?,?)'
      ).bind(gUser.name || gUser.email, codigoUser, inv.rol, inv.departamento || null, gUser.email, inv.empresa_id).run();
      await env.DB.prepare('UPDATE invitaciones SET usado = 1 WHERE codigo = ?').bind(inv_codigo.toUpperCase()).run();

      const nuevoUser = await env.DB.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1 LIMIT 1').bind(gUser.email).first();
      const empresa = await env.DB.prepare('SELECT nombre FROM empresas WHERE id = ?').bind(inv.empresa_id).first();
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,'0')).join('');
      await env.DB.prepare(
        'INSERT INTO sesiones (token, usuario_id, empresa_id, nombre, rol, departamento, obra_id, created_at) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(token, nuevoUser.id, inv.empresa_id, gUser.name || gUser.email, inv.rol, inv.departamento || null, null, ahora).run();
      await sendTelegram(env, `✅ <b>Nuevo usuario registrado</b>\n👤 ${gUser.name || gUser.email}\n📧 ${gUser.email}\nRol: ${inv.rol} | Dpto: ${inv.departamento || '—'} | Empresa: ${empresa?.nombre || inv.empresa_id}`);
      return json({ ok: true, token, nombre: gUser.name || gUser.email, rol: inv.rol, departamento: inv.departamento || null, empresa_id: inv.empresa_id, empresa_nombre: empresa?.nombre || '', obra_id: null, obra_nombre: null });
    }

    // Sin invitación: crear solicitud pendiente para que el admin la apruebe
    const yaExiste = await env.DB.prepare(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) AND google_pending = 1 AND activo = 0 LIMIT 1'
    ).bind(gUser.email).first();
    if (yaExiste) {
      return json({ ok: false, pendiente: true, msg: 'Tu solicitud ya está pendiente de aprobación. El administrador la revisará pronto.' });
    }
    const codigoPend = 'g_pend_' + Date.now();
    const rIns = await env.DB.prepare(
      'INSERT INTO usuarios (nombre, codigo, rol, departamento, activo, google_pending, email, empresa_id) VALUES (?,?,?,NULL,0,1,?,NULL)'
    ).bind(gUser.name || gUser.email, codigoPend, 'pendiente', gUser.email).run();
    const pendingId = rIns.meta?.last_row_id;
    if (pendingId) {
      await sendTelegramConBotones(env,
        `🔔 <b>Solicitud de acceso con Google</b>\n👤 ${gUser.name || gUser.email}\n📧 ${gUser.email}`,
        [
          [
            { text: '✅ Operario Eléc (E3)', callback_data: `apr:${pendingId}:3:operario:electrico` },
            { text: '✅ Operario Eléc (E1)', callback_data: `apr:${pendingId}:1:operario:electrico` },
          ],
          [
            { text: '✅ Admin (E3)',          callback_data: `apr:${pendingId}:3:empresa_admin:null` },
            { text: '✅ Admin (E1)',           callback_data: `apr:${pendingId}:1:empresa_admin:null` },
          ],
          [{ text: '❌ Rechazar',             callback_data: `rej:${pendingId}` }]
        ]
      );
    } else {
      await sendTelegram(env, `🔔 <b>Solicitud de acceso con Google</b>\n👤 ${gUser.name || gUser.email}\n📧 ${gUser.email}\nRevisar en Ajustes → Usuarios → Solicitudes de acceso`);
    }
    return json({ ok: false, pendiente: true, msg: 'Solicitud enviada correctamente. El administrador debe aprobarla para que puedas acceder.' });
  }

  // Crear sesión
  const tokenArr = new Uint8Array(32);
  crypto.getRandomValues(tokenArr);
  const token = Array.from(tokenArr).map(b => b.toString(16).padStart(2,'0')).join('');
  const ahora = AHORA();
  await env.DB.prepare(
    'INSERT INTO sesiones (token, usuario_id, empresa_id, nombre, rol, departamento, obra_id, created_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(token, u.id, u.empresa_id, gUser.name || u.nombre, u.rol, u.departamento || null, u.obra_id || null, ahora).run();

  const obra    = u.obra_id    ? await env.DB.prepare('SELECT nombre FROM obras WHERE id = ?').bind(u.obra_id).first()       : null;
  const empresa = u.empresa_id ? await env.DB.prepare('SELECT nombre FROM empresas WHERE id = ?').bind(u.empresa_id).first() : null;

  return json({
    ok:             true,
    token,
    nombre:         gUser.name || u.nombre,
    rol:            u.rol,
    departamento:   u.departamento || null,
    empresa_id:     u.empresa_id,
    empresa_nombre: empresa ? empresa.nombre : '',
    obra_id:        u.obra_id   || null,
    obra_nombre:    obra        ? obra.nombre : null,
  });
}

async function crearInvitacion(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const { duracion_min, rol, departamento } = await request.json().catch(() => ({}));
  if (!duracion_min || !rol) return err('Faltan datos', 400);
  const codigo = Math.random().toString(36).slice(2,7).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
  const expira = new Date(Date.now() + duracion_min * 60000).toISOString().slice(0,19).replace('T',' ');
  await env.DB.prepare(
    'INSERT INTO invitaciones (codigo, empresa_id, rol, departamento, expira_at, creado_por) VALUES (?,?,?,?,?,?)'
  ).bind(codigo, s.empresa_id, rol, departamento || null, expira, s.usuario_id || null).run();
  return json({ ok: true, codigo, expira });
}

async function listarInvitaciones(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const ahora = AHORA();
  const { results } = await env.DB.prepare(
    'SELECT codigo, rol, departamento, expira_at, usado FROM invitaciones WHERE empresa_id = ? AND expira_at > ? ORDER BY expira_at DESC'
  ).bind(s.empresa_id, ahora).all();
  return json({ ok: true, invitaciones: results || [] });
}

async function anularInvitacion(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const { codigo } = await request.json().catch(() => ({}));
  if (!codigo) return err('Falta código', 400);
  await env.DB.prepare('DELETE FROM invitaciones WHERE codigo = ? AND empresa_id = ?').bind(codigo, s.empresa_id).run();
  return json({ ok: true });
}

async function verificarInvitacion(request, env) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get('codigo');
  if (!codigo) return err('Falta código', 400);
  const ahora = AHORA();
  const inv = await env.DB.prepare(
    'SELECT codigo, rol, departamento, expira_at FROM invitaciones WHERE codigo = ? AND usado = 0 AND expira_at > ?'
  ).bind(codigo.toUpperCase(), ahora).first();
  if (!inv) return json({ ok: false, msg: 'Enlace caducado o ya utilizado.' });
  const empresa = await env.DB.prepare('SELECT nombre FROM empresas WHERE id = (SELECT empresa_id FROM invitaciones WHERE codigo = ?)').bind(codigo.toUpperCase()).first();
  return json({ ok: true, rol: inv.rol, departamento: inv.departamento, expira_at: inv.expira_at, empresa_nombre: empresa?.nombre || '' });
}

async function getUsuariosPendientes(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const { results } = await env.DB.prepare(
    'SELECT id, nombre, email, created_at FROM usuarios WHERE google_pending = 1 AND activo = 0 ORDER BY created_at DESC'
  ).all();
  return json({ ok: true, pendientes: results || [] });
}

async function aprobarUsuarioPendiente(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const { id, empresa_id, rol, departamento } = await request.json().catch(() => ({}));
  if (!id || !empresa_id || !rol) return err('Faltan datos', 400);
  await env.DB.prepare(
    'UPDATE usuarios SET activo=1, google_pending=0, empresa_id=?, rol=?, departamento=? WHERE id=? AND google_pending=1'
  ).bind(empresa_id, rol, departamento || null, id).run();
  const u = await env.DB.prepare('SELECT nombre, email FROM usuarios WHERE id=?').bind(id).first();
  await sendTelegram(env, `✅ <b>Acceso aprobado</b>\n👤 ${u?.nombre || '—'}\n📧 ${u?.email || '—'}\nRol: ${rol} | Empresa ID: ${empresa_id}`);
  return json({ ok: true });
}

async function rechazarUsuarioPendiente(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const { id } = await request.json().catch(() => ({}));
  if (!id) return err('Falta id', 400);
  const u = await env.DB.prepare('SELECT nombre, email FROM usuarios WHERE id=? AND google_pending=1').bind(id).first();
  if (!u) return err('Solicitud no encontrada', 404);
  await env.DB.prepare('DELETE FROM usuarios WHERE id=? AND google_pending=1').bind(id).run();
  await sendTelegram(env, `❌ <b>Acceso rechazado</b>\n👤 ${u.nombre || '—'}\n📧 ${u.email || '—'}`);
  return json({ ok: true });
}

// ── R2 Archivos (NEW-03 + MEJ-13) ────────────────────────────────────────────

async function listarArchivos(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const herramienta_id = url.searchParams.get('herramienta_id');
  let sql, params;
  if (herramienta_id) {
    sql = 'SELECT * FROM archivos WHERE empresa_id = ? AND herramienta_id = ? ORDER BY created_at DESC';
    params = [empresa_id, parseInt(herramienta_id)];
  } else {
    sql = 'SELECT * FROM archivos WHERE empresa_id = ? AND herramienta_id IS NULL ORDER BY created_at DESC';
    params = [empresa_id];
  }
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function subirArchivo(request, env) {
  const { empresa_id, nombre: userNombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta el formulario', 400);
  const file = form.get('file');
  const herramienta_id = form.get('herramienta_id') || null;
  if (!file || !file.name) return err('Falta el archivo', 400);
  if (file.size > 52428800) return err('El archivo supera el límite de 50 MB', 413);
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = herramienta_id
    ? `e${empresa_id}/herr/${herramienta_id}/${ts}_${safeName}`
    : `e${empresa_id}/docs/${ts}_${safeName}`;
  await env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });
  const hid = herramienta_id ? parseInt(herramienta_id) : null;
  const r = await env.DB.prepare(
    'INSERT INTO archivos (empresa_id, herramienta_id, r2_key, nombre, mime, tamano, subido_por) VALUES (?,?,?,?,?,?,?)'
  ).bind(empresa_id, hid, r2Key, file.name, file.type || null, file.size || null, userNombre || rol).run();
  return json({ ok: true, id: r.meta.last_row_id, nombre: file.name }, 201);
}

async function descargarArchivo(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare('SELECT * FROM archivos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Archivo no encontrado', 404);
  const obj = await env.FILES.get(meta.r2_key);
  if (!obj) return err('Archivo no disponible en almacenamiento', 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': meta.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.nombre)}"`,
      'Cache-Control': 'private, max-age=3600',
      ...CORS,
    },
  });
}

async function borrarArchivo(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const meta = await env.DB.prepare('SELECT * FROM archivos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Archivo no encontrado', 404);
  await env.FILES.delete(meta.r2_key);
  await env.DB.prepare('DELETE FROM archivos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Documentación departamentos ───────────────────────────────────────────────

async function listarCarpetas(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const obra_id     = url.searchParams.get('obra_id');
  const departamento = url.searchParams.get('departamento');
  if (!obra_id || !departamento) return err('Faltan parámetros', 400);
  const { results } = await env.DB.prepare(
    'SELECT * FROM carpetas WHERE empresa_id = ? AND obra_id = ? AND departamento = ? ORDER BY nombre COLLATE NOCASE'
  ).bind(empresa_id, parseInt(obra_id), departamento).all();
  return json(results);
}

async function crearCarpeta(request, env) {
  const { empresa_id, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const { obra_id, departamento, nombre } = await request.json().catch(() => ({}));
  if (!obra_id || !departamento || !nombre?.trim()) return err('Faltan datos', 400);
  const existe = await env.DB.prepare(
    'SELECT id FROM carpetas WHERE empresa_id = ? AND obra_id = ? AND departamento = ? AND UPPER(nombre) = UPPER(?)'
  ).bind(empresa_id, parseInt(obra_id), departamento, nombre.trim()).first();
  if (existe) return err('Ya existe una carpeta con ese nombre', 409);
  const r = await env.DB.prepare(
    'INSERT INTO carpetas (empresa_id, obra_id, departamento, nombre, creado_por) VALUES (?,?,?,?,?)'
  ).bind(empresa_id, parseInt(obra_id), departamento, nombre.trim(), userNombre || rol).run();
  return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim() }, 201);
}

async function borrarCarpeta(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const carpeta = await env.DB.prepare('SELECT * FROM carpetas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!carpeta) return err('Carpeta no encontrada', 404);
  // Borrar todos los archivos R2 de la carpeta
  const { results: docs } = await env.DB.prepare('SELECT r2_key FROM docs_dept WHERE carpeta_id = ? AND empresa_id = ?').bind(id, empresa_id).all();
  await Promise.all(docs.map(d => env.FILES.delete(d.r2_key)));
  await env.DB.prepare('DELETE FROM docs_dept WHERE carpeta_id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  await env.DB.prepare('DELETE FROM carpetas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

async function listarDocsDept(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const carpeta_id = url.searchParams.get('carpeta_id');
  if (!carpeta_id) return err('Falta carpeta_id', 400);
  const { results } = await env.DB.prepare(
    'SELECT * FROM docs_dept WHERE carpeta_id = ? AND empresa_id = ? ORDER BY created_at DESC'
  ).bind(parseInt(carpeta_id), empresa_id).all();
  return json(results);
}

async function subirDocDept(request, env) {
  const { empresa_id, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta el formulario', 400);
  const file        = form.get('file');
  const carpeta_id  = form.get('carpeta_id');
  const descripcion = form.get('descripcion') || null;
  if (!file || !file.name || !carpeta_id) return err('Faltan datos', 400);
  if (file.size > 52428800) return err('El archivo supera el límite de 50 MB', 413);
  const carpeta = await env.DB.prepare('SELECT * FROM carpetas WHERE id = ? AND empresa_id = ?').bind(parseInt(carpeta_id), empresa_id).first();
  if (!carpeta) return err('Carpeta no encontrada', 404);
  const ts       = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key    = `e${empresa_id}/dept/${carpeta.departamento}/${carpeta.obra_id}/${carpeta_id}/${ts}_${safeName}`;
  await env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  const r = await env.DB.prepare(
    'INSERT INTO docs_dept (empresa_id, obra_id, departamento, carpeta_id, r2_key, nombre, mime, tamano, descripcion, subido_por) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, carpeta.obra_id, carpeta.departamento, parseInt(carpeta_id), r2Key, file.name,
    file.type || null, file.size || null, descripcion, userNombre || rol).run();
  return json({ ok: true, id: r.meta.last_row_id, nombre: file.name }, 201);
}

async function descargarDocDept(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare('SELECT * FROM docs_dept WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Documento no encontrado', 404);
  const obj = await env.FILES.get(meta.r2_key);
  if (!obj) return err('Archivo no disponible en almacenamiento', 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': meta.mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(meta.nombre)}"`,
      'Cache-Control': 'private, max-age=3600',
      ...CORS,
    },
  });
}

async function borrarDocDept(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const meta = await env.DB.prepare('SELECT * FROM docs_dept WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Documento no encontrado', 404);
  await env.FILES.delete(meta.r2_key);
  await env.DB.prepare('DELETE FROM docs_dept WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

