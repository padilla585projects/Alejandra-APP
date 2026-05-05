// Alejandra Worker v4.0 — Multi-tenant (empresa_id)
// Base de datos: Cloudflare D1
// IA: Gemini 2.0 Flash
// Sync: Google Sheets automático en cada cambio
// Multi-obra + Roles (superadmin / encargado / operario)

const CORS = {
  'Access-Control-Allow-Origin': 'https://padilla585projects.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Code, X-Obra-Id, X-Usuario, X-Rol, X-Codigo, X-Departamento, X-Token',
  'Vary': 'Origin',
};

// Genera N bytes aleatorios criptográficamente seguros como string hex
function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  // 1. Token D1 (sistema nuevo) — acepta también ?token= en URL pero SOLO para GET (imágenes/docs)
  const tokenFromUrl = new URL(request.url).searchParams.get('token');
  const xToken = request.headers.get('X-Token') || (request.method === 'GET' ? tokenFromUrl : null);
  if (xToken) {
    try {
      const sesion = await env.DB.prepare(
        "SELECT * FROM sesiones WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
      ).bind(xToken).first();
      if (sesion) {
        env.DB.prepare("UPDATE sesiones SET last_used = CURRENT_TIMESTAMP, expires_at = datetime('now', '+30 days') WHERE token = ?").bind(xToken).run();
        const isSuperadmin   = sesion.es_admin === 1 || sesion.rol === 'superadmin' || sesion.rol === 'desarrollador';
        const isEmpresaAdmin = sesion.rol === 'empresa_admin' || sesion.rol === 'desarrollador';
        const isDesarrollador = sesion.rol === 'desarrollador';
        const deptHeader = request.headers.get('X-Departamento');
        const departamento = deptHeader || sesion.departamento || 'electrico';
        return {
          isAdmin: sesion.es_admin === 1,
          isSuperadmin,
          isEmpresaAdmin,
          isDesarrollador,
          isEncargado: sesion.rol === 'encargado',
          isJefeObra: sesion.rol === 'jefe_de_obra',
          isOficina: sesion.rol === 'oficina',
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
  const isAdmin = env.ADMIN_CODE && adminCode === env.ADMIN_CODE;
  // SEC-13: Los privilegios elevados SOLO se conceden por X-Admin-Code verificado contra env.
  // X-Rol es metadata informativa (departamento, logging) — NUNCA concede isAdmin/isSuperadmin.
  // Sin esto cualquier petición podría enviar "X-Rol: superadmin" y obtener acceso total.
  const isSuperadmin   = isAdmin;
  const isEmpresaAdmin = isAdmin;
  return {
    isAdmin,
    isSuperadmin,
    isEmpresaAdmin,
    isEncargado:   isAdmin ? false : rol === 'encargado',
    isJefeObra:    isAdmin ? false : rol === 'jefe_de_obra',
    isOficina:     isAdmin ? false : rol === 'oficina',
    isDesarrollador: false, // nunca por legacy headers
    isSeguridad: departamento === 'seguridad',
    rol: isAdmin ? 'superadmin' : (rol || 'operario'),
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

// Envía a un chat_id concreto (notificaciones personales)
async function sendTelegramToChat(env, chatId, mensaje) {
  try {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text: mensaje, parse_mode: 'HTML' }),
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
    else if (accion === 'herr_disp') {
      const hid = parseInt(partes[0]);
      await env.DB.prepare("UPDATE herramientas SET estado='disponible' WHERE id=?").bind(hid).run();
      await _tgAnswerCQ(env, cq.id, '✅ Marcada como disponible');
      await _tgEditMsg(env, chatId, msgId, orig + '\n\n✅ <b>DISPONIBLE</b>');
    }
  } catch (e) {
    await _tgAnswerCQ(env, cq.id, '❌ Error: ' + e.message);
  }
  return new Response('OK');
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

    // ── SEC-14: Rate limiting para X-Admin-Code (brute-force legacy path) ───────
    // Si llega X-Admin-Code pero no coincide → registrar intento; bloquear tras 5 en 15min
    {
      const xAdminCode = request.headers.get('X-Admin-Code');
      if (xAdminCode && env.ADMIN_CODE && xAdminCode !== env.ADMIN_CODE) {
        const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        try {
          const win = new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('T',' ').split('.')[0];
          const row = await env.DB.prepare(
            "SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND motivo = 'admin_brute' AND created_at > ?"
          ).bind(ip, win).first().catch(() => ({ cnt: 0 }));
          const cnt = row?.cnt ?? 0;
          env.DB.prepare('INSERT INTO login_attempts (ip, motivo) VALUES (?, ?)').bind(ip, 'admin_brute').run().catch(() => {});
          if (cnt >= 5) return err('Demasiados intentos. Espera 15 minutos.', 429);
        } catch (_) {}
      }
    }

    try {
      // ── Telegram webhook (sin auth — valida con secret header) ───────────────
      if (path === '/telegram-webhook'       && method === 'POST') return await handleTelegramWebhook(request, env);
      if (path === '/setup-telegram-webhook' && method === 'GET')  return await setupTelegramWebhook(request, env);

      // ── Rutas públicas (sin auth) ──────────────────────────────────────────
      if (path === '/scan'        && method === 'POST') return await handleScan(request, env);
      if (path === '/ocr'         && method === 'POST') return await handleOCR(request, env);
      if (path === '/log'         && method === 'POST') return await guardarLog(request, env);
      if (path === '/verificar'        && method === 'POST') return await verificarAcceso(request, env);
      if (path === '/recuperar-pass'   && method === 'POST') return await recuperarPass(request, env);
      if (path === '/resetear-pass'    && method === 'POST') return await resetearPass(request, env);
      if (path === '/auth/google/url'  && method === 'GET')  return googleAuthUrl(request, env);
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
      if (path === '/comparativa-obras'  && method === 'GET')  return await getComparativaObras(request, env);
      if (path === '/graficas'           && method === 'GET')  return await getGraficasData(request, env);
      if (path === '/buscar'             && method === 'GET')  return await buscarGlobal(request, env);

      // ── RGPD / Protección de datos ───────────────────────────────────────────
      if (path === '/rgpd/informe'          && method === 'GET')    return await rgpdInforme(request, env);
      if (path === '/rgpd/anonimizar'       && method === 'DELETE') return await rgpdAnonimizar(request, env);
      if (path === '/rgpd/config'           && method === 'GET')    return await rgpdGetConfig(request, env);
      if (path === '/rgpd/config'           && method === 'PUT')    return await rgpdSetConfig(request, env);
      if (path === '/rgpd/aplicar-retencion'&& method === 'POST')   return await rgpdAplicarRetencionEndpoint(request, env);

      // ── Telegram personal ────────────────────────────────────────────────────
      if (path === '/telegram/webhook'   && method === 'POST') return await telegramWebhook(request, env);
      if (path === '/telegram/vincular'  && method === 'POST') return await telegramVincular(request, env);
      if (path === '/telegram/estado'    && method === 'GET')  return await telegramEstado(request, env);
      if (path === '/telegram/desvincular' && method === 'POST') return await telegramDesvincular(request, env);
      if (path === '/telegram/notificar-turnos' && method === 'POST') return await notificarTurnosSemana(request, env);
      if (path === '/telegram/test'      && method === 'POST') return await telegramTest(request, env);
      if (path === '/admin/setup-telegram-webhook' && method === 'POST') return await setupTelegramWebhook(request, env);
      if (path === '/admin/login-attempts' && method === 'DELETE') return await adminBorrarLoginAttempts(request, env);
      if (path === '/admin/server-logs'   && method === 'DELETE') return await adminBorrarServerLogs(request, env);

      // ── Dev endpoints (superadmin/desarrollador) ─────────────────────────────
      if (path === '/dev/sql'           && method === 'POST')   return await devSQL(request, env);
      if (path === '/dev/table-counts'  && method === 'GET')    return await devTableCounts(request, env);
      if (path === '/dev/sesiones'      && method === 'GET')    return await devSesionesDetalle(request, env);
      if (path === '/dev/kill-session'  && method === 'DELETE') return await devKillSession(request, env);
      if (path === '/dev/login-history' && method === 'GET')    return await devLoginHistory(request, env);
      if (path === '/dev/kpis'          && method === 'GET')    return await devKPIs(request, env);
      if (path === '/dev/r2'            && method === 'GET')    return await devR2List(request, env);
      if (path === '/dev/r2'            && method === 'DELETE') return await devR2Delete(request, env);
      if (path === '/dev/cambiar-rol'   && method === 'PUT')    return await devCambiarRol(request, env);
      if (path === '/dev/activity'      && method === 'GET')    return await devActivity(request, env);

      // ── Log viewer (DevTools) ────────────────────────────────────────────────
      if (path === '/log'            && method === 'GET')  return await getLogsAdmin(request, env);

      // ── Foto de perfil ───────────────────────────────────────────────────────
      if (path.startsWith('/foto-perfil/')) {
        const parts = path.split('/');
        const tipo  = parts[2]; // 'usuario' | 'externo'
        const fid   = parseInt(parts[3]);
        if (method === 'POST') return await subirFotoPerfil(tipo, fid, request, env);
        if (method === 'GET')  return await getFotoPerfil(tipo, fid, request, env);
        if (method === 'DELETE') return await borrarFotoPerfil(tipo, fid, request, env);
      }

      // ── Obras ──────────────────────────────────────────────────────────────
      if (path === '/obras'       && method === 'GET')    return await getObras(request, env);
      if (path === '/obras'       && method === 'POST')   return await crearObra(request, env);
      if (path.startsWith('/obras/') && method === 'PUT')    return await actualizarObra(path.split('/obras/')[1], request, env);
      if (path.startsWith('/obras/') && method === 'DELETE') return await eliminarObra(path.split('/obras/')[1], request, env);

      // ── Bobinas ───────────────────────────────────────────────────────────
      if (path === '/bobinas'     && method === 'GET')    return await getBobinas(request, env);
      if (path === '/bobinas'     && method === 'POST')   return await crearBobina(request, env, ctx);

      if (path.startsWith('/bobinas/') && method === 'PUT') {
        const sub = decodeURIComponent(path.split('/bobinas/')[1]);
        if (sub.endsWith('/devolver'))    return await devolverBobina(sub.replace('/devolver', ''), request, env, ctx);
        if (sub.endsWith('/transferir'))  return await transferirRecurso('bobinas', sub.replace('/transferir', ''), request, env);
        return await editarBobina(sub, request, env, ctx);
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
        return await editarPemp(sub, request, env, ctx);
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
        return await editarCarretilla(sub, request, env, ctx);
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
      if (path.startsWith('/proveedores/') && method === 'DELETE') return await deleteCatalogo('proveedores', path.split('/proveedores/')[1], request, env);

      if (path === '/tipos-cable'  && method === 'GET')   return await getCatalogo('tipos_cable', env, request);
      if (path === '/tipos-cable'  && method === 'POST')  return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos-cable/')) {
        const tcId = parseInt(path.split('/tipos-cable/')[1]);
        if (method === 'DELETE') return await deleteCatalogo('tipos_cable', tcId, request, env);
        if (method === 'PUT')    return await actualizarTipoCable(tcId, request, env);
      }

      // Legacy aliases for tipos-cable
      if (path === '/tipos'        && method === 'GET')   return await getCatalogo('tipos_cable', env, request);
      if (path === '/tipos'        && method === 'POST')  return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos/') && method === 'DELETE') return await deleteCatalogo('tipos_cable', path.split('/tipos/')[1], request, env);

      if (path === '/tipos-pemp'           && method === 'GET')   return await getCatalogo('tipos_pemp', env, request);
      if (path === '/tipos-pemp'           && method === 'POST')  return await addCatalogo('tipos_pemp', request, env);
      if (path.startsWith('/tipos-pemp/')  && method === 'DELETE') return await deleteCatalogo('tipos_pemp', path.split('/tipos-pemp/')[1], request, env);

      if (path === '/tipos-carretilla'          && method === 'GET')   return await getCatalogo('tipos_carretilla', env, request);
      if (path === '/tipos-carretilla'          && method === 'POST')  return await addCatalogo('tipos_carretilla', request, env);
      if (path.startsWith('/tipos-carretilla/') && method === 'DELETE') return await deleteCatalogo('tipos_carretilla', path.split('/tipos-carretilla/')[1], request, env);

      if (path === '/energias-carretilla'          && method === 'GET')   return await getCatalogo('energias_carretilla', env, request);
      if (path === '/energias-carretilla'          && method === 'POST')  return await addCatalogo('energias_carretilla', request, env);
      if (path.startsWith('/energias-carretilla/') && method === 'DELETE') return await deleteCatalogo('energias_carretilla', path.split('/energias-carretilla/')[1], request, env);

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
      if (path === '/inventario-seg'           && method === 'POST')   return await crearItemSeg(request, env, ctx);
      if (path.startsWith('/inventario-seg/')) {
        const segId = parseInt(path.split('/inventario-seg/')[1]);
        if (method === 'DELETE') return await eliminarItemSeg(segId, request, env, ctx);
        if (method === 'PUT')    return await moverItemSeg(segId, request, env, ctx);
      }
      if (path.startsWith('/buscar-item-seg/') && method === 'GET') {
        const cod = decodeURIComponent(path.split('/buscar-item-seg/')[1]);
        return await buscarItemSeg(cod, request, env);
      }
      if (path === '/tipos-material-seg'       && method === 'GET')    return await getCatalogo('tipos_material_seg', env, request);
      if (path === '/tipos-material-seg'       && method === 'POST')   return await addTipoMaterialSeg(request, env);
      if (path.startsWith('/tipos-material-seg/') && method === 'DELETE') {
        const tid = parseInt(path.split('/tipos-material-seg/')[1]);
        return await deleteCatalogo('tipos_material_seg', tid, request, env);
      }

      // ── Pedidos ──────────────────────────────────────────────────────────────
      if (path === '/pedidos' && method === 'GET')  return await getPedidos(request, env);
      if (path === '/pedidos' && method === 'POST') return await crearPedido(request, env, ctx);
      if (path.startsWith('/pedidos/')) {
        const parts = path.split('/');  // ['','pedidos','5'] or ['','pedidos','5','albaranes']
        const pid = parseInt(parts[2]);
        if (parts[3] === 'albaranes') {
          if (method === 'GET')  return await getAlbaranesPedido(pid, request, env);
          if (method === 'POST') return await subirAlbaranPedido(pid, request, env);
        } else {
          if (method === 'PUT')    return await actualizarPedido(pid, request, env, ctx);
          if (method === 'DELETE') return await eliminarPedido(pid, request, env, ctx);
        }
      }
      if (path.startsWith('/albaranes/')) {
        const aid = parseInt(path.split('/albaranes/')[1]);
        if (method === 'GET')    return await getAlbaranFile(aid, request, env);
        if (method === 'DELETE') return await borrarAlbaran(aid, request, env);
      }

      // ── Herramientas ─────────────────────────────────────────────────────────
      if (path === '/tipos-herramienta' && method === 'GET')  return await getTiposHerramienta(request, env);
      if (path === '/tipos-herramienta' && method === 'POST') return await crearTipoHerramienta(request, env);
      if (path.startsWith('/tipos-herramienta/')) {
        const tid = parseInt(path.split('/tipos-herramienta/')[1]);
        if (method === 'DELETE') return await eliminarTipoHerramienta(tid, request, env);
        if (method === 'PUT')    return await actualizarTipoHerramienta(tid, request, env);
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
      if (path === '/alertas-stock'          && method === 'GET') return await getAlertasStock(request, env);
      if (path === '/obra-dashboard'         && method === 'GET') return await getObraDashboard(request, env);
      if (path === '/repostajes'             && method === 'GET')  return await getRepostajes(request, env);
      if (path === '/repostajes'             && method === 'POST') return await crearRepostaje(request, env, ctx);
      if (path === '/repostajes/resumen'     && method === 'GET')  return await getResumenRepostajes(request, env);

      // ── Calendario (NEW-13) ──────────────────────────────────────────────
      if (path === '/festivos'     && method === 'GET') return await getFestivos(request, env);
      if (path === '/calendario'   && method === 'GET') return await getEventos(request, env);
      if (path === '/calendario'   && method === 'POST') return await crearEvento(request, env);
      if (path.startsWith('/calendario/')) {
        const eid = parseInt(path.split('/calendario/')[1]);
        if (method === 'PUT')    return await actualizarEvento(eid, request, env);
        if (method === 'DELETE') return await eliminarEvento(eid, request, env);
      }

      // ── Mantenimiento preventivo equipos (NEW-15) ───────────────────────
      if (path === '/mantenimientos' && method === 'GET')  return await getMantenimientos(request, env);
      if (path === '/mantenimientos' && method === 'POST') return await crearMantenimiento(request, env);
      if (path.startsWith('/mantenimientos/')) {
        const _mparts = path.split('/');
        const _mid    = parseInt(_mparts[2]);
        if (_mparts[3] === 'adjunto' && method === 'GET') return await getAdjuntoMantenimiento(_mid, request, env);
        if (!_mparts[3] && method === 'DELETE') return await borrarMantenimiento(_mid, request, env);
      }

      // ── Checklist pre-uso equipos (NEW-21) ──────────────────────────────
      if (path === '/checklist-plantillas' && method === 'GET')  return await listarPlantillaChecklist(request, env);
      if (path === '/checklist-plantillas' && method === 'POST') return await crearPreguntaChecklist(request, env);
      if (path.startsWith('/checklist-plantillas/') && method === 'DELETE') {
        return await borrarPreguntaChecklist(parseInt(path.split('/checklist-plantillas/')[1]), request, env);
      }
      if (path === '/checklist-registros' && method === 'GET')  return await listarRegistrosChecklist(request, env);
      if (path === '/checklist-registros' && method === 'POST') return await crearRegistroChecklist(request, env);

      // ── Partes de trabajo (NEW-16) ──────────────────────────────────────
      if (path === '/partes-trabajo' && method === 'GET')  return await getPartesTrabajo(request, env);
      if (path === '/partes-trabajo' && method === 'POST') return await crearParteTrabajo(request, env);
      if (path.startsWith('/partes-trabajo/')) {
        const _ptid = parseInt(path.split('/partes-trabajo/')[1]);
        if (method === 'GET')    return await getParteTrabajo(_ptid, request, env);
        if (method === 'DELETE') return await eliminarParteTrabajo(_ptid, request, env);
      }

      // ── Galería de fotos por obra (NEW-17) ──────────────────────────────
      if (path === '/fotos-obra' && method === 'GET')  return await listarFotosObra(request, env);
      if (path === '/fotos-obra' && method === 'POST') return await subirFotoObra(request, env);
      if (path.startsWith('/fotos-obra/')) {
        const foid = parseInt(path.split('/fotos-obra/')[1]);
        if (method === 'GET')    return await getFotoObra(foid, request, env);
        if (method === 'DELETE') return await borrarFotoObra(foid, request, env);
      }

      // ── Incidencias (NEW-22) ─────────────────────────────────────────────
      if (path === '/incidencias' && method === 'GET')  return await getIncidencias(request, env);
      if (path === '/incidencias' && method === 'POST') return await crearIncidencia(request, env, ctx);
      if (path.startsWith('/incidencias/')) {
        const parts = path.split('/');
        const iid = parseInt(parts[2]);
        if (parts[3] === 'fotos') {
          if (method === 'GET')  return await getIncidenciaFotos(iid, request, env);
          if (method === 'POST') return await subirFotoIncidencia(iid, request, env);
        } else {
          if (method === 'PUT')    return await actualizarIncidencia(iid, request, env, ctx);
          if (method === 'DELETE') return await eliminarIncidencia(iid, request, env);
        }
      }
      if (path.startsWith('/incidencia-fotos/')) {
        const fid = parseInt(path.split('/incidencia-fotos/')[1]);
        if (method === 'GET')    return await getFotoIncidencia(fid, request, env);
        if (method === 'DELETE') return await borrarFotoIncidencia(fid, request, env);
      }

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
        if (method === 'PUT')    return await renombrarCarpeta(cid, request, env);
      }
      if (path === '/docs-dept' && method === 'GET')  return await listarDocsDept(request, env);
      if (path === '/docs-dept' && method === 'POST') return await subirDocDept(request, env);
      if (path.startsWith('/docs-dept/')) {
        const did = parseInt(path.split('/docs-dept/')[1]);
        if (method === 'GET')    return await descargarDocDept(did, request, env);
        if (method === 'PUT')    return await editarDocDept(did, request, env);
        if (method === 'DELETE') return await borrarDocDept(did, request, env);
      }
      if (path === '/docs-notas' && method === 'GET')  return await listarNotas(request, env);
      if (path === '/docs-notas' && method === 'POST') return await crearNota(request, env);
      if (path.startsWith('/docs-notas/')) {
        const nid = parseInt(path.split('/docs-notas/')[1]);
        if (method === 'PUT')    return await editarNota(nid, request, env);
        if (method === 'DELETE') return await borrarNota(nid, request, env);
      }
      if (path === '/admin/migrate' && method === 'POST') return await runMigrations(request, env);

      // ── Personal ──────────────────────────────────────────────────────────
      if (path === '/horarios-obra' && method === 'GET')  return await getHorariosObra(request, env);
      if (path === '/horarios-obra' && method === 'POST') return await guardarHorarioObra(request, env);
      if (path.startsWith('/horarios-obra/')) {
        const hoid = parseInt(path.split('/horarios-obra/')[1]);
        if (method === 'PUT')    return await actualizarHorarioObra(hoid, request, env);
        if (method === 'DELETE') return await eliminarHorarioObra(hoid, request, env);
      }
      if (path === '/fichajes' && method === 'GET')  return await getFichajes(request, env);
      if (path === '/fichajes' && method === 'POST') return await crearFichaje(request, env, ctx);
      if (path.startsWith('/fichajes/')) {
        const fid = parseInt(path.split('/fichajes/')[1]);
        if (method === 'PUT')    return await actualizarFichaje(fid, request, env, ctx);
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

      // ── EPIs asignados (NEW-23) ───────────────────────────────────────────
      if (path === '/epis-asignados' && method === 'GET')  return await getEpisAsignados(request, env);
      if (path === '/epis-asignados' && method === 'POST') return await crearEpiAsignado(request, env, ctx);
      if (path.startsWith('/epis-asignados/')) {
        const epid = parseInt(path.split('/epis-asignados/')[1]);
        if (method === 'PUT')    return await actualizarEpiAsignado(epid, request, env, ctx);
        if (method === 'DELETE') return await eliminarEpiAsignado(epid, request, env);
      }

      // ── Carnets y certificaciones (NEW-19) ───────────────────────────────
      if (path === '/carnets' && method === 'GET')  return await getCarnets(request, env);
      if (path === '/carnets' && method === 'POST') return await crearCarnet(request, env, ctx);
      if (path.startsWith('/carnets/')) {
        const cid = parseInt(path.split('/carnets/')[1]);
        if (method === 'PUT')    return await actualizarCarnet(cid, request, env, ctx);
        if (method === 'DELETE') return await eliminarCarnet(cid, request, env);
      }

      // ── Turnos (NEW-20) ───────────────────────────────────────────────────
      if (path === '/turnos' && method === 'GET')  return await getTurnos(request, env);
      if (path === '/turnos' && method === 'POST') return await upsertTurno(request, env, ctx);
      if (path.startsWith('/turnos/') && method === 'DELETE') {
        const tid = parseInt(path.split('/turnos/')[1]);
        return await eliminarTurno(tid, request, env);
      }

      // ── Chat interno (NEW-08) ─────────────────────────────────────────────
      if (path === '/chat' && method === 'GET')    return await getChatMensajes(request, env);
      if (path === '/chat' && method === 'POST')   return await enviarChatMensaje(request, env);
      if (path.startsWith('/chat/') && method === 'DELETE') {
        const cmid = parseInt(path.split('/chat/')[1]);
        return await borrarChatMensaje(cmid, request, env);
      }

      // ── Otros (legacy/extras) ─────────────────────────────────────────────
      if (path === '/logs'         && method === 'GET')   return await getLogs(request, env);
      if (path === '/historial'    && method === 'GET')   return await getHistorial(request, env);
      if (path === '/pemp/historial'         && method === 'GET') return await getHistorialTabla('historial_pemp', request, env);
      if (path === '/carretillas/historial'  && method === 'GET') return await getHistorialTabla('historial_carretillas', request, env);
      if (path === '/stats'        && method === 'GET')   return await getStats(request, env);
      if (path === '/sheet-id'     && method === 'GET')   return json({ id: env.GOOGLE_SHEET_ID || null });
      if ((path === '/sync' || path === '/sync-sheets') && method === 'POST') {
        const { empresa_id } = await getAuth(request, env);
        if (!empresa_id) return err('No autorizado', 403);
        await Promise.all([syncSheets(env), syncPedidos(env), syncRRHH(env)]);
        return json({ ok: true, mensaje: 'Sync completado' });
      }
      if (path === '/sync-debug'   && method === 'POST')  {
        const { isSuperadmin } = await getAuth(request, env);
        if (!isSuperadmin) return err('No autorizado', 403);
        return await syncSheetsDebug(env);
      }

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
    // Resync completo en cada cron — resiliencia ante fallos transitorios de Google API
    ctx.waitUntil(syncSheets(env));
    ctx.waitUntil(syncPedidos(env));
    ctx.waitUntil(syncRRHH(env)); // SYNC-03: fichajes, incidencias, carnets, EPIs, turnos, repostajes
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
    "INSERT INTO sesiones (token, usuario_id, nombre, rol, obra_id, obra_nombre, departamento, es_admin, empresa_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 days'))"
  ).bind(token, usuario_id || null, nombre, rol, obra_id || null, obra_nombre || null, departamento || 'electrico', es_admin ? 1 : 0, empresa_id || 1).run();
  return token;
}

// ════════════════════════════════════════════════════════════════════════════
// RECUPERACIÓN DE CONTRASEÑA (Resend)
// Para activar: añadir RESEND_API_KEY en Cloudflare Workers → Variables de entorno
// ════════════════════════════════════════════════════════════════════════════

async function enviarEmailResend(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.error('[Resend] RESEND_API_KEY no configurada en variables de entorno');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Alejandra App <noreply@resend.dev>',  // ← cambiar cuando tengas dominio propio
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[Resend] Error al enviar email:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Resend] Excepción:', e.message);
    return false;
  }
}

async function recuperarPass(request, env) {
  const { email } = await request.json().catch(() => ({}));
  if (!email) return err('Email requerido');

  // Buscar usuario por email (activo)
  const usuario = await env.DB.prepare(
    `SELECT id, nombre, empresa_id FROM usuarios WHERE email=? AND activo=1 LIMIT 1`
  ).bind(email.trim().toLowerCase()).first();

  // Respuesta siempre igual para no revelar si el email existe (seguridad)
  const okMsg = json({ ok: true, mensaje: 'Si ese email existe recibirás un enlace en breve' });

  if (!usuario) return okMsg;

  // Crear tabla si no existe (idempotente)
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      usuario_id INTEGER NOT NULL,
      empresa_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      usado INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run().catch(() => {});

  // Invalidar tokens anteriores de este usuario
  await env.DB.prepare(`UPDATE reset_tokens SET usado=1 WHERE usuario_id=? AND usado=0`)
    .bind(usuario.id).run();

  // Generar token seguro (32 chars hex)
  const tokenBytes = crypto.getRandomValues(new Uint8Array(16));
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  await env.DB.prepare(`
    INSERT INTO reset_tokens (token, usuario_id, empresa_id, expires_at)
    VALUES (?, ?, ?, datetime('now', '+2 hours'))
  `).bind(token, usuario.id, usuario.empresa_id).run();

  // URL del panel con el token
  const panelUrl = `https://padilla585projects.github.io/Alejandra-APP/panel.html?reset_token=${token}`;

  const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto">
    <tr><td style="background:#162032;border-radius:16px;padding:40px;border:1px solid #334155">
      <div style="text-align:center;margin-bottom:28px">
        <div style="font-size:32px;margin-bottom:8px">🔐</div>
        <div style="font-family:'Montserrat',Helvetica,Arial,sans-serif;font-weight:900;font-size:22px;color:#f97316">
          Alejandra Office
        </div>
        <div style="font-size:11px;color:#64748b;letter-spacing:2px;text-transform:uppercase;margin-top:4px">
          Recuperación de contraseña
        </div>
      </div>
      <p style="color:#e5e7eb;font-size:15px;margin:0 0 16px">Hola <strong>${usuario.nombre}</strong>,</p>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;line-height:1.6">
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Alejandra Office.
        El enlace es válido durante <strong style="color:#e5e7eb">2 horas</strong>.
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${panelUrl}" style="display:inline-block;background:#f97316;color:#fff;font-family:'Montserrat',Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;text-decoration:none;padding:14px 32px;border-radius:10px;text-transform:uppercase">
          Restablecer contraseña →
        </a>
      </div>
      <p style="color:#475569;font-size:12px;margin:0 0 8px;line-height:1.5">
        Si no puedes pulsar el botón, copia este enlace en tu navegador:
      </p>
      <p style="color:#64748b;font-size:11px;word-break:break-all;margin:0 0 24px;font-family:monospace">
        ${panelUrl}
      </p>
      <hr style="border:none;border-top:1px solid #1e2d40;margin:0 0 20px">
      <p style="color:#475569;font-size:12px;margin:0;text-align:center">
        Si no has solicitado esto, ignora este email. Tu contraseña no cambiará.
      </p>
    </td></tr>
    <tr><td style="text-align:center;padding-top:20px">
      <p style="color:#334155;font-size:11px;margin:0">Alejandra App · Sistema de gestión de obras</p>
    </td></tr>
  </table>
</body>
</html>`;

  const enviado = await enviarEmailResend(env, {
    to: email.trim().toLowerCase(),
    subject: '🔐 Restablecer contraseña — Alejandra Office',
    html,
  });

  if (!enviado && env.RESEND_API_KEY) {
    // Si hay key pero falló el envío, devolvemos error real
    return err('Error al enviar el email. Inténtalo de nuevo.', 500);
  }

  return okMsg;
}

async function resetearPass(request, env) {
  const { token, nueva_pass } = await request.json().catch(() => ({}));
  if (!token || !nueva_pass) return err('Datos incompletos');
  if (nueva_pass.length < 6) return err('La contraseña debe tener al menos 6 caracteres');

  // Verificar token válido, no usado y no expirado
  const reset = await env.DB.prepare(`
    SELECT rt.*, u.email, u.nombre FROM reset_tokens rt
    JOIN usuarios u ON u.id = rt.usuario_id
    WHERE rt.token=? AND rt.usado=0 AND rt.expires_at > datetime('now')
    LIMIT 1
  `).bind(token).first().catch(() => null);

  if (!reset) return err('El enlace no es válido o ha caducado. Solicita uno nuevo.');

  // Hash de la nueva contraseña — PBKDF2 igual que hashPassword() en verificarAcceso
  const hashHex = await hashPassword(nueva_pass);

  // Actualizar contraseña e invalidar token
  await Promise.all([
    env.DB.prepare(`UPDATE usuarios SET password=? WHERE id=?`).bind(hashHex, reset.usuario_id).run(),
    env.DB.prepare(`UPDATE reset_tokens SET usado=1 WHERE token=?`).bind(token).run(),
  ]);

  // Invalidar todas las sesiones activas de ese usuario
  await env.DB.prepare(`DELETE FROM sesiones WHERE usuario_id=?`).bind(reset.usuario_id).run().catch(() => {});

  return json({ ok: true, nombre: reset.nombre });
}

async function verificarAcceso(request, env) {
  // ── Rate limiting: máx 10 intentos por IP en 15 minutos ─────────────────
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  try {
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0];
    const { cnt } = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND created_at > ?"
    ).bind(ip, windowStart).first() || { cnt: 0 };
    if (cnt >= 10) return err('Demasiados intentos. Espera 15 minutos.', 429);
  } catch (_) {}

  const body = await request.json().catch(() => ({}));
  const codigo = body.codigo || body.code || '';
  const obraRef = body.obra_id || body.obra || null;

  // Helper: registrar intento fallido
  const registrarFallo = async (motivo) => {
    try {
      await env.DB.prepare('INSERT INTO login_attempts (ip, motivo) VALUES (?, ?)').bind(ip, motivo).run();
    } catch (_) {}
  };

  // 1.5 Login por email + contraseña (empresa_admin y usuarios con email)
  const emailInput = (body.email || '').trim().toLowerCase();
  const passInput  = body.password || '';
  if (emailInput && passInput) {
    try {
      const u = await env.DB.prepare(
        'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE LOWER(u.email) = ? AND u.activo = 1 LIMIT 1'
      ).bind(emailInput).first();
      if (!u || !u.password_hash) { await registrarFallo('email_invalido'); return err('Email o contraseña incorrectos', 401); }
      const valid = await verifyPassword(passInput, u.password_hash);
      if (!valid) { await registrarFallo('password_invalido'); return err('Email o contraseña incorrectos', 401); }
      const dept = u.rol === 'empresa_admin' ? null : (u.departamento || 'electrico');
      const token = await crearSesion(env, {
        nombre: u.nombre, rol: u.rol, obra_id: u.obra_id, obra_nombre: u.obra_nombre,
        departamento: dept, es_admin: false, usuario_id: u.id, empresa_id: u.empresa_id || 1,
      });
      // Login exitoso → limpiar intentos fallidos de esta IP
      env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run().catch(() => {});
      const empRow = u.empresa_id ? await env.DB.prepare('SELECT nombre FROM empresas WHERE id = ?').bind(u.empresa_id).first().catch(() => null) : null;
      return json({ ok: true, nombre: u.nombre, rol: u.rol, obra_id: u.obra_id, obra_nombre: u.obra_nombre, departamento: dept, token, empresa_id: u.empresa_id || 1, empresa_nombre: empRow?.nombre || '', usuario_id: u.id });
    } catch(e) { return err('Error en login: ' + e.message, 500); }
  }

  if (!codigo) return err('Falta el código');

  // 1. ¿Es superadmin?
  if (env.ADMIN_CODE && codigo.trim() === env.ADMIN_CODE) {
    const token = await crearSesion(env, { nombre: 'Admin', rol: 'superadmin', obra_id: null, obra_nombre: null, departamento: null, es_admin: true, empresa_id: 1 });
    env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run().catch(() => {});
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
          await registrarFallo('obra_no_coincide');
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
      env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run().catch(() => {});
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
      env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run().catch(() => {});
      return json({ ok: true, tipo: 'obra', rol: 'operario', obra_id: obra.id, obra_nombre: obra.nombre, obra, token });
    }
  } catch (_) {}

  await registrarFallo('codigo_invalido');
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
  if (!auth.isSuperadmin && !auth.isAdmin && !auth.isEncargado && !auth.isEmpresaAdmin) return err('No autorizado', 403);
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
  const { empresa_nombre, sector, admin_nombre, email, password, obra_nombre, departamentos } = body;
  if (!empresa_nombre?.trim() || !email?.trim() || !password || !admin_nombre?.trim())
    return err('Faltan datos obligatorios (empresa, nombre, email, contraseña)');
  if (password.length < 8) return err('La contraseña debe tener al menos 8 caracteres');

  const emailClean = email.trim().toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM usuarios WHERE LOWER(email) = ? LIMIT 1').bind(emailClean).first();
  if (existing) return err('Este email ya está registrado', 409);

  const slug = empresa_nombre.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const hash = await hashPassword(password);

  // #187: depts seleccionados en el wizard (lista de keys del catálogo). Si no, NULL = todos activos.
  const deptsJSON = (Array.isArray(departamentos) && departamentos.length) ? JSON.stringify(departamentos) : null;

  // Crear empresa
  const empResult = await env.DB.prepare(
    'INSERT INTO empresas (nombre, slug, email, plan, activa, departamentos) VALUES (?, ?, ?, ?, 1, ?)'
  ).bind(empresa_nombre.trim(), slug, emailClean, 'basic', deptsJSON).run();
  const empresa_id = empResult.meta.last_row_id;
  if (!empresa_id) return err('Error al crear la empresa, intenta de nuevo');

  // Crear primera obra (opcional)
  let obra_id = null, obra_nombre_final = null;
  if (obra_nombre?.trim()) {
    const codObra = randomHex(4).toUpperCase(); // 8 chars hex criptográficamente seguro
    const obraResult = await env.DB.prepare(
      'INSERT INTO obras (nombre, codigo, activa, empresa_id) VALUES (?, ?, 1, ?)'
    ).bind(obra_nombre.trim(), codObra, empresa_id).run();
    obra_id = obraResult.meta.last_row_id;
    obra_nombre_final = obra_nombre.trim();
  }

  // Crear usuario admin
  const codAdmin = 'ADM_' + randomHex(6).toUpperCase(); // 12 chars hex criptográficamente seguro
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
  const empresa = await env.DB.prepare('SELECT id, nombre, slug, email, telefono, direccion, cif, plan, activa, created_at, departamentos, informe_semanal, informe_dia, modulos_config FROM empresas WHERE id = ?').bind(auth.empresa_id).first();
  if (!empresa) return err('Empresa no encontrada', 404);
  const obras    = (await env.DB.prepare('SELECT id, nombre, codigo FROM obras WHERE empresa_id = ? AND activa = 1 ORDER BY nombre').bind(auth.empresa_id).all()).results;
  const usuarios = (await env.DB.prepare('SELECT id, nombre, rol, departamento, obra_id FROM usuarios WHERE empresa_id = ? AND activo = 1 ORDER BY nombre').bind(auth.empresa_id).all()).results;
  return json({ empresa, obras, usuarios });
}

async function updateMiEmpresa(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id || (auth.rol !== 'empresa_admin' && !auth.isSuperadmin)) return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { nombre, email, telefono, direccion, cif, departamentos, informe_semanal, informe_dia, modulos_config } = body;
  if (!nombre?.trim()) return err('Falta el nombre de la empresa');
  const campos = ['nombre = ?'];
  const vals   = [nombre.trim()];
  if (email             !== undefined) { campos.push('email = ?');             vals.push(email?.trim()       || null); }
  if (telefono          !== undefined) { campos.push('telefono = ?');          vals.push(telefono?.trim()    || null); }
  if (direccion         !== undefined) { campos.push('direccion = ?');         vals.push(direccion?.trim()   || null); }
  if (cif               !== undefined) { campos.push('cif = ?');               vals.push(cif?.trim()         || null); }
  if (departamentos     !== undefined) {
    const val = departamentos ? JSON.stringify(Array.isArray(departamentos) ? departamentos : departamentos) : null;
    campos.push('departamentos = ?'); vals.push(val);
  }
  if (informe_semanal   !== undefined) { campos.push('informe_semanal = ?');   vals.push(informe_semanal ? 1 : 0); }
  if (informe_dia       !== undefined) { campos.push('informe_dia = ?');       vals.push(informe_dia || 'lunes'); }
  if (modulos_config    !== undefined) { campos.push('modulos_config = ?');    vals.push(modulos_config ? JSON.stringify(modulos_config) : null); }
  vals.push(auth.empresa_id);
  await env.DB.prepare(`UPDATE empresas SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// COMPARATIVA ENTRE OBRAS (NEW-28)
// ════════════════════════════════════════════════════════════════════════════

async function getComparativaObras(request, env) {
  const { isSuperadmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const hoy = new Date().toISOString().slice(0, 10);
  const { results: obras } = await env.DB.prepare(
    'SELECT id, nombre, codigo FROM obras WHERE empresa_id = ? AND activa = 1 ORDER BY nombre'
  ).bind(empresa_id).all();
  const datos = await Promise.all(obras.map(async o => {
    const oid = o.id;
    const [fichajes, equipos, herramientas, incidencias, pedidos] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as n FROM fichajes WHERE empresa_id=? AND obra_id=? AND fecha=?')
        .bind(empresa_id, oid, hoy).first(),
      env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM pemp WHERE empresa_id=? AND obra_id=? AND estado IN ('mantenimiento','averiado'))
              + (SELECT COUNT(*) FROM carretillas WHERE empresa_id=? AND obra_id=? AND estado IN ('mantenimiento','averiado')) as n`
      ).bind(empresa_id, oid, empresa_id, oid).first(),
      env.DB.prepare("SELECT COUNT(*) as n FROM herramientas WHERE empresa_id=? AND obra_id=? AND estado != 'disponible'")
        .bind(empresa_id, oid).first(),
      env.DB.prepare("SELECT COUNT(*) as n FROM incidencias WHERE empresa_id=? AND obra_id=? AND estado IN ('abierta','en_progreso')")
        .bind(empresa_id, oid).first(),
      env.DB.prepare("SELECT COUNT(*) as n FROM pedidos WHERE empresa_id=? AND obra_id=? AND estado IN ('pendiente','solicitado')")
        .bind(empresa_id, oid).first(),
    ]);
    return {
      id: o.id, nombre: o.nombre, codigo: o.codigo,
      fichajes_hoy:        fichajes?.n    || 0,
      equipos_problema:    equipos?.n     || 0,
      herramientas_fuera:  herramientas?.n || 0,
      incidencias_abiertas: incidencias?.n || 0,
      pedidos_pendientes:  pedidos?.n     || 0,
    };
  }));
  return json(datos);
}

// ════════════════════════════════════════════════════════════════════════════
// OBRAS
// ════════════════════════════════════════════════════════════════════════════

async function getObras(request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isJefeObra, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin && !isJefeObra) return err('No autorizado', 403);
  const url   = new URL(request.url);
  const todas = url.searchParams.get('todas') === '1';
  let sql = 'SELECT * FROM obras WHERE empresa_id = ?';
  if (!todas) sql += ' AND activa = 1';
  sql += ' ORDER BY activa DESC, nombre';
  const { results } = await env.DB.prepare(sql).bind(empresa_id).all();
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

async function actualizarObra(id, request, env) {
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isJefeObra, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin && !isJefeObra) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const campos = ['nombre', 'codigo', 'direccion', 'responsable', 'fecha_inicio', 'fecha_fin', 'activa'];
  const sets = []; const vals = [];
  for (const c of campos) {
    if (c in body) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (!sets.length) return err('Nada que actualizar', 400);
  vals.push(parseInt(id)); vals.push(empresa_id);
  await env.DB.prepare(`UPDATE obras SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`).bind(...vals).run();
  return json({ ok: true });
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
  const { obraId, isSuperadmin, isEmpresaAdmin, isJefeObra, departamento, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraParamRaw = url.searchParams.get('obra_id');
  const obraParam = obraParamRaw ? parseInt(obraParamRaw) : null;
  // superadmin/empresa_admin pueden ver todas las obras (sin restricción de obraId de sesión)
  // jefe_de_obra se incluye en isAdminRole solo para el dept scoping (no para obra scoping)
  const isUnrestrictedAdmin = isSuperadmin || isEmpresaAdmin;
  const isAdminRole = isUnrestrictedAdmin || isJefeObra;
  const obraFilter = isUnrestrictedAdmin ? obraParam : (obraId || null);
  // Admins: dept filter solo si se pasa explícitamente (?departamento=X); operarios: siempre su dept
  const deptParam = url.searchParams.get('departamento');
  const deptFilter = deptParam || (!isAdminRole ? departamento : null);

  let sql = 'SELECT b.*, o.nombre as obra_nombre FROM bobinas b LEFT JOIN obras o ON b.obra_id = o.id WHERE b.empresa_id = ?';
  const params = [empresa_id];
  if (deptFilter) { sql += ' AND b.departamento = ?'; params.push(deptFilter); }
  if (obraFilter) { sql += ' AND b.obra_id = ?'; params.push(obraFilter); }
  if (estado)     { sql += ' AND b.estado = ?';  params.push(estado); }
  if (buscar) {
    sql += ' AND (b.codigo LIKE ? OR b.proveedor LIKE ? OR b.tipo_cable LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY b.created_at DESC';

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
      syncSheets(env, 'Elec-Bobinas', empresa_id),
      registrarHistorial(env, { obra_id: obraFinal, bobina_codigo: codigo.trim().toUpperCase(), accion: 'entrada', usuario: reg, notas: notas || '' }),
      sendTelegram(env, `📦 <b>Nueva bobina registrada</b>\n🔖 ${codigo.trim().toUpperCase()}\n🔌 ${tipo_cable}  📦 ${proveedor}\n👤 ${reg}`),
    ]));

    return json({ ok: true, mensaje: `Bobina ${codigo} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La bobina ${codigo} ya está registrada`, 409);
    throw e;
  }
}

async function editarBobina(codigo, request, env, ctx) {
  const { obraId, isSuperadmin, empresa_id } = await getAuth(request, env);
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

  ctx?.waitUntil(syncSheets(env, 'Elec-Bobinas', empresa_id));
  return json({ ok: true, mensaje: `Bobina ${codigo} actualizada` });
}

async function devolverBobina(codigo, request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;
  const fecha = fechaEspana();

  let bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();

  if (!bobina) {
    // Auto-crear como devuelta si no existe
    const { obraId, empresa_id: eid } = await getAuth(request, env);
    await env.DB.prepare(
      `INSERT INTO bobinas (codigo, estado, fecha_entrada, fecha_devolucion, devuelto_por, notas, obra_id, empresa_id)
       VALUES (?, 'devuelta', ?, ?, ?, ?, ?, ?)`
    ).bind(codigo.trim().toUpperCase(), fecha, fecha, devuelto_por || '', 'Creado automáticamente en devolución', obraId || null, eid || 1).run();
    bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
    ctx.waitUntil(Promise.all([
      syncSheets(env, 'Elec-Bobinas', eid || 1),
      registrarHistorial(env, { obra_id: bobina?.obra_id, bobina_codigo: codigo, accion: 'devolucion', usuario: devuelto_por, notas: 'Auto-creado en devolución' }),
    ]));
    return json({ ok: true, mensaje: `Bobina ${codigo} no estaba registrada. Se ha creado y marcado como devuelta automáticamente`, fecha_devolucion: fecha });
  }

  if (bobina.estado === 'devuelta') return err(`Bobina ${codigo} ya fue devuelta el ${bobina.fecha_devolucion}`, 409);

  await env.DB.prepare(
    'UPDATE bobinas SET estado = ?, fecha_devolucion = ?, notas = ?, devuelto_por = ? WHERE codigo = ?'
  ).bind('devuelta', fecha, notas || bobina.notas || '', devuelto_por || '', codigo).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, 'Elec-Bobinas', bobina.empresa_id),
    registrarHistorial(env, { obra_id: bobina.obra_id, bobina_codigo: codigo, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
    sendTelegram(env, `📤 <b>Bobina devuelta</b>\n🔖 ${codigo}\n👤 ${devuelto_por || '—'}`),
  ]));

  return json({ ok: true, mensaje: `Bobina ${codigo} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarBobina(codigo, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId, empresa_id } = await getAuth(request, env);
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && bobina.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM bobinas WHERE codigo = ?').bind(codigo).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, 'Elec-Bobinas', empresa_id || bobina.empresa_id),
    registrarHistorial(env, { obra_id: bobina.obra_id, bobina_codigo: codigo, accion: 'eliminacion', usuario: '' }),
    sendTelegram(env, `🗑️ <b>Bobina eliminada</b>\n🔖 ${codigo}`),
  ]));

  return json({ ok: true, mensaje: `Bobina ${codigo} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// PEMP
// ════════════════════════════════════════════════════════════════════════════

async function getPemp(request, env) {
  const { obraId, isSuperadmin, isEmpresaAdmin, isJefeObra, isSeguridad, departamento, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraParamRaw = url.searchParams.get('obra_id');
  const obraParam = obraParamRaw ? parseInt(obraParamRaw) : null;
  const isUnrestrictedAdmin = isSuperadmin || isEmpresaAdmin;
  const isAdminRole = isUnrestrictedAdmin || isJefeObra;
  const obraFilter = isUnrestrictedAdmin ? obraParam : (obraId || null);
  const deptParam = url.searchParams.get('departamento');
  const deptFilter = deptParam || (!isAdminRole ? departamento : null);

  let sql = 'SELECT p.*, o.nombre as obra_nombre FROM pemp p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ?';
  const params = [empresa_id];
  if (deptFilter)  { sql += ' AND p.departamento = ?'; params.push(deptFilter); }
  if (obraFilter)  { sql += ' AND p.obra_id = ?'; params.push(obraFilter); }
  if (estado)      { sql += ' AND p.estado = ?';  params.push(estado); }
  if (buscar) {
    sql += ' AND (p.matricula LIKE ? OR p.tipo LIKE ? OR p.marca LIKE ? OR p.proveedor LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY p.created_at DESC';

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
      syncSheets(env, tabForDept('pemp', departamento), empresa_id),
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

async function editarPemp(matricula, request, env, ctx) {
  const { obraId, isSuperadmin, empresa_id } = await getAuth(request, env);
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();
  if (!pemp) return err(`PEMP ${matricula} no encontrada`, 404);
  if (obraId && !isSuperadmin && pemp.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const campos = ['tipo', 'marca', 'proveedor', 'energia', 'estado', 'notas', 'fecha_ultima_revision', 'fecha_proxima_revision', 'obra_id', 'departamento', 'aviso_mantenimiento', 'dias_aviso_mant'];
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
  ctx?.waitUntil(syncSheets(env, tabForDept('pemp', body.departamento || pemp.departamento), empresa_id || pemp.empresa_id));
  return json({ ok: true, mensaje: `PEMP ${matricula} actualizada` });
}

async function devolverPemp(matricula, request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;
  const fecha = fechaEspana();

  let pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();

  if (!pemp) {
    // Auto-crear como devuelta si no existe
    const { obraId, departamento, empresa_id: eid } = await getAuth(request, env);
    await env.DB.prepare(
      `INSERT INTO pemp (matricula, estado, fecha_entrada, fecha_devolucion, devuelto_por, notas, obra_id, empresa_id)
       VALUES (?, 'devuelta', ?, ?, ?, ?, ?, ?)`
    ).bind(matricula.trim().toUpperCase(), fecha, fecha, devuelto_por || '', 'Creado automáticamente en devolución', obraId || null, eid || 1).run();
    pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();
    ctx.waitUntil(Promise.all([
      syncSheets(env, tabForDept('pemp', departamento), eid || 1),
      registrarHistorialPemp(env, { obra_id: pemp?.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: 'Auto-creado en devolución' }),
    ]));
    return json({ ok: true, mensaje: `PEMP ${matricula} no estaba registrada. Se ha creado y marcado como devuelta automáticamente`, fecha_devolucion: fecha });
  }

  if (pemp.estado === 'devuelta') return err(`PEMP ${matricula} ya fue devuelta el ${pemp.fecha_devolucion}`, 409);

  await env.DB.prepare(
    'UPDATE pemp SET estado = ?, fecha_devolucion = ?, devuelto_por = ?, notas = ? WHERE matricula = ?'
  ).bind('devuelta', fecha, devuelto_por || '', notas || pemp.notas || '', matricula).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('pemp', pemp.departamento), pemp.empresa_id),
    registrarHistorialPemp(env, { obra_id: pemp.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
    sendTelegram(env, `📤 <b>PEMP devuelta</b>\n🔖 ${matricula}\n👤 ${devuelto_por || '—'}`),
  ]));

  return json({ ok: true, mensaje: `PEMP ${matricula} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarPemp(matricula, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId, empresa_id } = await getAuth(request, env);
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE matricula = ?').bind(matricula).first();
  if (!pemp) return err(`PEMP ${matricula} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && pemp.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM pemp WHERE matricula = ?').bind(matricula).run();
  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('pemp', pemp.departamento), empresa_id || pemp.empresa_id),
    sendTelegram(env, `🗑️ <b>PEMP eliminada</b>\n🔖 ${matricula}`),
  ]));
  return json({ ok: true, mensaje: `PEMP ${matricula} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// CARRETILLAS
// ════════════════════════════════════════════════════════════════════════════

async function getCarretillas(request, env) {
  const { obraId, isSuperadmin, isEmpresaAdmin, isJefeObra, isSeguridad, departamento, empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraParamRaw = url.searchParams.get('obra_id');
  const obraParam = obraParamRaw ? parseInt(obraParamRaw) : null;
  const isUnrestrictedAdmin = isSuperadmin || isEmpresaAdmin;
  const isAdminRole = isUnrestrictedAdmin || isJefeObra;
  const obraFilter = isUnrestrictedAdmin ? obraParam : (obraId || null);
  const deptParam = url.searchParams.get('departamento');
  const deptFilter = deptParam || (!isAdminRole ? departamento : null);

  let sql = 'SELECT c.*, o.nombre as obra_nombre FROM carretillas c LEFT JOIN obras o ON c.obra_id = o.id WHERE c.empresa_id = ?';
  const params = [empresa_id];
  if (deptFilter)  { sql += ' AND c.departamento = ?'; params.push(deptFilter); }
  if (obraFilter)  { sql += ' AND c.obra_id = ?'; params.push(obraFilter); }
  if (estado)      { sql += ' AND c.estado = ?';  params.push(estado); }
  if (buscar) {
    sql += ' AND (c.matricula LIKE ? OR c.tipo LIKE ? OR c.marca LIKE ? OR c.proveedor LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY c.created_at DESC';

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
      syncSheets(env, tabForDept('carretilla', departamento), empresa_id),
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

async function editarCarretilla(matricula, request, env, ctx) {
  const { obraId, isSuperadmin, empresa_id } = await getAuth(request, env);
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();
  if (!carretilla) return err(`Carretilla ${matricula} no encontrada`, 404);
  if (obraId && !isSuperadmin && carretilla.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const campos = ['tipo', 'marca', 'proveedor', 'energia', 'estado', 'notas', 'fecha_ultima_revision', 'fecha_proxima_revision', 'obra_id', 'departamento', 'aviso_mantenimiento', 'dias_aviso_mant'];
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
  ctx?.waitUntil(syncSheets(env, tabForDept('carretilla', body.departamento || carretilla.departamento), empresa_id || carretilla.empresa_id));
  return json({ ok: true, mensaje: `Carretilla ${matricula} actualizada` });
}

async function devolverCarretilla(matricula, request, env, ctx) {
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;
  const fecha = fechaEspana();

  let carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();

  if (!carretilla) {
    // Auto-crear como devuelta si no existe
    const { obraId, departamento, empresa_id: eid } = await getAuth(request, env);
    await env.DB.prepare(
      `INSERT INTO carretillas (matricula, estado, fecha_entrada, fecha_devolucion, devuelto_por, notas, obra_id, empresa_id)
       VALUES (?, 'devuelta', ?, ?, ?, ?, ?, ?)`
    ).bind(matricula.trim().toUpperCase(), fecha, fecha, devuelto_por || '', 'Creado automáticamente en devolución', obraId || null, eid || 1).run();
    carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();
    ctx.waitUntil(Promise.all([
      syncSheets(env, tabForDept('carretilla', departamento), eid || 1),
      registrarHistorialCarretillas(env, { obra_id: carretilla?.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: 'Auto-creado en devolución' }),
    ]));
    return json({ ok: true, mensaje: `Carretilla ${matricula} no estaba registrada. Se ha creado y marcado como devuelta automáticamente`, fecha_devolucion: fecha });
  }

  if (carretilla.estado === 'devuelta') return err(`Carretilla ${matricula} ya fue devuelta el ${carretilla.fecha_devolucion}`, 409);

  await env.DB.prepare(
    'UPDATE carretillas SET estado = ?, fecha_devolucion = ?, devuelto_por = ?, notas = ? WHERE matricula = ?'
  ).bind('devuelta', fecha, devuelto_por || '', notas || carretilla.notas || '', matricula).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('carretilla', carretilla.departamento), carretilla.empresa_id),
    registrarHistorialCarretillas(env, { obra_id: carretilla.obra_id, matricula, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
    sendTelegram(env, `📤 <b>Carretilla devuelta</b>\n🔖 ${matricula}\n👤 ${devuelto_por || '—'}`),
  ]));

  return json({ ok: true, mensaje: `Carretilla ${matricula} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarCarretilla(matricula, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId, empresa_id } = await getAuth(request, env);
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE matricula = ?').bind(matricula).first();
  if (!carretilla) return err(`Carretilla ${matricula} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && carretilla.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM carretillas WHERE matricula = ?').bind(matricula).run();
  ctx.waitUntil(Promise.all([
    syncSheets(env, tabForDept('carretilla', carretilla.departamento), empresa_id || carretilla.empresa_id),
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

  const body = await request.json().catch(() => ({}));

  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin) {
    if (!isEncargado) return err('No autorizado', 403);
    // Encargado solo puede editar usuarios sin obra o de su propia obra
    if (usuario.obra_id !== null && usuario.obra_id !== obraId) return err('No autorizado', 403);
    // Encargado solo puede asignar su propia obra (no la de otro encargado)
    if (body.obra_id !== undefined && body.obra_id !== null && parseInt(body.obra_id) !== obraId) return err('No autorizado', 403);
  }
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

    // Si cambió obra_id, sincronizar todas las sesiones activas del usuario
    if (body.obra_id !== undefined) {
      const nuevaObraId = body.obra_id ? parseInt(body.obra_id) : null;
      const obraRow = nuevaObraId
        ? await env.DB.prepare('SELECT nombre FROM obras WHERE id = ?').bind(nuevaObraId).first()
        : null;
      await env.DB.prepare('UPDATE sesiones SET obra_id = ?, obra_nombre = ? WHERE usuario_id = ?')
        .bind(nuevaObraId, obraRow?.nombre || null, parseInt(id)).run();
    }

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
  const { isSuperadmin, isAdmin, isEmpresaAdmin, isDesarrollador } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEmpresaAdmin && !isDesarrollador) return err('No autorizado', 403);
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

// SEC-02: whitelist estricta de tablas permitidas en el catálogo
// Evita inyección de nombre de tabla vía el parámetro `tabla`
const CATALOG_WHITELIST = new Set([
  'proveedores', 'tipos_cable', 'tipos_pemp',
  'tipos_carretilla', 'energias_carretilla', 'tipos_material_seg',
]);

async function getCatalogo(tabla, env, requestOrEmpresaId = null) {
  if (!CATALOG_WHITELIST.has(tabla)) return err('Tabla no permitida', 400);
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
  if (!CATALOG_WHITELIST.has(tabla)) return err('Tabla no permitida', 400);
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

async function deleteCatalogo(tabla, id, request, env) {
  if (!CATALOG_WHITELIST.has(tabla)) return err('Tabla no permitida', 400);
  const { rol } = await getAuth(request, env);
  if (rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare(`DELETE FROM ${tabla} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTAR CSV (bobinas + pemp + carretillas)
// ════════════════════════════════════════════════════════════════════════════

async function exportCSV(request, env) {
  const { obraId, empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url  = new URL(request.url);
  const tipo = url.searchParams.get('tipo'); // bobinas | pemp | carretillas | (vacío = todo)
  const f    = obraId || null;
  const fecha = new Date().toISOString().slice(0, 10);

  const escapeCSV = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const row = arr => arr.map(escapeCSV).join(',');

  const sections = [];

  if (!tipo || tipo === 'bobinas') {
    const sql = f
      ? 'SELECT * FROM bobinas WHERE empresa_id = ? AND obra_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM bobinas WHERE empresa_id = ? ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...(f ? [empresa_id, f] : [empresa_id])).all();
    sections.push('=== BOBINAS ===');
    sections.push(row(['Código', 'Proveedor', 'Tipo Cable', 'Registrado por', 'Fecha Entrada', 'Devuelto por', 'Fecha Devolución', 'Estado', 'Notas', 'Obra ID']));
    for (const b of results) {
      sections.push(row([b.codigo, b.proveedor, b.tipo_cable, b.registrado_por, b.fecha_entrada, b.devuelto_por, b.fecha_devolucion, b.estado, b.notas, b.obra_id]));
    }
    sections.push('');
  }

  if (!tipo || tipo === 'pemp') {
    const sql = f
      ? 'SELECT * FROM pemp WHERE empresa_id = ? AND obra_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM pemp WHERE empresa_id = ? ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...(f ? [empresa_id, f] : [empresa_id])).all();
    sections.push('=== PEMP ===');
    sections.push(row(['ID', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Estado', 'Fecha Entrada', 'Fecha Devolución', 'Última Revisión', 'Próxima Revisión', 'Registrado por', 'Devuelto por', 'Notas', 'Obra ID']));
    for (const p of results) {
      sections.push(row([p.id, p.matricula, p.tipo, p.marca, p.proveedor, p.estado, p.fecha_entrada, p.fecha_devolucion, p.fecha_ultima_revision, p.fecha_proxima_revision, p.registrado_por, p.devuelto_por, p.notas, p.obra_id]));
    }
    sections.push('');
  }

  if (!tipo || tipo === 'carretillas') {
    const sql = f
      ? 'SELECT * FROM carretillas WHERE empresa_id = ? AND obra_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM carretillas WHERE empresa_id = ? ORDER BY created_at DESC';
    const { results } = await env.DB.prepare(sql).bind(...(f ? [empresa_id, f] : [empresa_id])).all();
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
  const { empresa_id } = await getAuth(request, env);
  const mat = matricula.trim().toUpperCase();

  const [pemp, carretilla, bobina] = await Promise.all([
    env.DB.prepare(
      'SELECT p.*, o.nombre as obra_nombre FROM pemp p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.matricula = ? AND p.empresa_id = ?'
    ).bind(mat, empresa_id).first(),
    env.DB.prepare(
      'SELECT c.*, o.nombre as obra_nombre FROM carretillas c LEFT JOIN obras o ON c.obra_id = o.id WHERE c.matricula = ? AND c.empresa_id = ?'
    ).bind(mat, empresa_id).first(),
    env.DB.prepare(
      'SELECT b.*, o.nombre as obra_nombre FROM bobinas b LEFT JOIN obras o ON b.obra_id = o.id WHERE b.codigo = ? AND b.empresa_id = ?'
    ).bind(mat, empresa_id).first(),
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
  if (bobina) {
    const hist = await env.DB.prepare(
      'SELECT accion, usuario, notas, fecha FROM historial WHERE bobina_codigo = ? ORDER BY fecha DESC LIMIT 15'
    ).bind(mat).all();
    return json({ ok: true, tipo: 'bobina', data: bobina, historial: hist.results });
  }
  return json({ ok: false, error: `${mat} no encontrado` }, 404);
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
  // SEC-08: requiere sesión válida — evita spam de logs y mensajes Telegram desde fuera
  const xTok = request.headers.get('X-Token');
  if (!xTok) return err('No autorizado', 401);
  const _s = await env.DB.prepare("SELECT id FROM sesiones WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(xTok).first().catch(() => null);
  if (!_s) return err('No autorizado', 401);
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

// ── DevTools: GET /log (admin) ────────────────────────────────────────────────
async function getLogsAdmin(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin && !auth.isEmpresaAdmin && !auth.isDesarrollador) return err('Sin acceso', 403);
  const url     = new URL(request.url);
  const limit   = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const nivel   = url.searchParams.get('nivel');
  const sinceId = parseInt(url.searchParams.get('since_id') || '0');
  const wheres = [];
  const params = [];
  if (nivel)   { wheres.push('nivel = ?');  params.push(nivel); }
  if (sinceId) { wheres.push('id > ?');     params.push(sinceId); }
  let sql = 'SELECT id, nivel, origen, mensaje, detalle, created_at FROM logs';
  if (wheres.length) sql += ' WHERE ' + wheres.join(' AND ');
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  try {
    const { results } = await env.DB.prepare(sql).bind(...params).all();
    return json({ ok: true, logs: results });
  } catch (e) { return err('Error al leer logs: ' + e.message, 500); }
}

// ── DevTools: DELETE /admin/server-logs ──────────────────────────────────────
async function adminBorrarServerLogs(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin && !auth.isDesarrollador) return err('Solo superadmin o desarrollador', 403);
  try {
    const res = await env.DB.prepare('DELETE FROM logs').run();
    return json({ ok: true, borrados: res.changes || 0 });
  } catch (e) { return err('Error al borrar logs: ' + e.message, 500); }
}

// ── DevTools: POST /telegram/test ────────────────────────────────────────────
async function telegramTest(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isDesarrollador && !auth.isSuperadmin) return err('Solo para desarrolladores', 403);
  try {
    const body = await request.json().catch(() => ({}));
    const msg = body.mensaje || '🛠️ Test desde Alejandra DevTools';
    await sendTelegram(env, msg);
    return json({ ok: true });
  } catch (e) { return err('Error Telegram: ' + e.message, 500); }
}

// ── DevTools: DELETE /admin/login-attempts ────────────────────────────────────
async function adminBorrarLoginAttempts(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isSuperadmin && !auth.isDesarrollador) return err('Solo superadmin o desarrollador', 403);
  try {
    const res = await env.DB.prepare('DELETE FROM login_attempts').run();
    return json({ ok: true, borrados: res.changes || 0 });
  } catch (e) { return err('Error al limpiar login_attempts: ' + e.message, 500); }
}

// ════════════════════════════════════════════════════════════════════════════
// GOOGLE SHEETS SYNC
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// PEDIDOS (#15)
// ════════════════════════════════════════════════════════════════════════════

async function getPedidos(request, env) {
  const auth = await getAuth(request, env);
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isJefeObra, isDesarrollador, departamento } = auth;
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const estadoFilter = url.searchParams.get('estado');
  const obraFilter   = url.searchParams.get('obra_id');
  const isAdminRole = isSuperadmin || isEmpresaAdmin || isJefeObra || isDesarrollador; // todos ven todos los depts con ?todos=1
  const todos       = url.searchParams.get('todos') === '1' && isAdminRole;
  const deptParam   = url.searchParams.get('departamento');

  let sql = 'SELECT p.*, o.nombre as obra_nombre FROM pedidos p LEFT JOIN obras o ON p.obra_id = o.id WHERE p.empresa_id = ?';
  const params = [empresa_id];
  if (!todos) {
    const deptFinal = deptParam || departamento || 'electrico';
    sql += ' AND p.departamento = ?'; params.push(deptFinal);
  } else if (deptParam) {
    // Admin con filtro explícito de dept
    sql += ' AND p.departamento = ?'; params.push(deptParam);
  }
  if (estadoFilter) { sql += ' AND p.estado = ?';  params.push(estadoFilter); }
  if (obraFilter)   { sql += ' AND p.obra_id = ?'; params.push(parseInt(obraFilter)); }
  sql += ' ORDER BY p.created_at DESC LIMIT 500';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearPedido(request, env, ctx) {
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
  ctx?.waitUntil(syncPedidos(env, tabForDept('pedido', dept), empresa_id));
  await sendTelegram(env, `📦 <b>Nuevo pedido</b> [${dept}]\n👤 ${solicitado_por||'—'}\n📝 ${descripcion.trim().slice(0,200)}`);
  return json({ ok: true, id: r.meta.last_row_id });
}

async function actualizarPedido(id, request, env, ctx) {
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
  vals.push(id); vals.push(empresa_id);
  await env.DB.prepare(`UPDATE pedidos SET ${campos.join(', ')} WHERE id = ? AND empresa_id = ?`).bind(...vals).run();
  let pedidoDept = null;
  if (body.estado !== undefined) {
    const pedido = await env.DB.prepare('SELECT descripcion, departamento FROM pedidos WHERE id = ?').bind(id).first();
    pedidoDept = pedido?.departamento;
    const iconos = { solicitado: '📤', recibido: '✅', cancelado: '❌', pendiente: '⏳' };
    await sendTelegram(env,
      `${iconos[body.estado]||'📦'} <b>Pedido ${body.estado}</b> [${pedido?.departamento||'—'}]\n📝 ${(pedido?.descripcion||'').slice(0,200)}`
    );
  }
  if (!pedidoDept) {
    const p = await env.DB.prepare('SELECT departamento FROM pedidos WHERE id = ?').bind(id).first();
    pedidoDept = p?.departamento;
  }
  ctx?.waitUntil(syncPedidos(env, tabForDept('pedido', pedidoDept), empresa_id));
  return json({ ok: true });
}

async function eliminarPedido(id, request, env, ctx) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isEncargado } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (!isSuperadmin && !isEmpresaAdmin && !isEncargado) return err('Sin permiso', 403);
  const pedido = await env.DB.prepare('SELECT departamento FROM pedidos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  await env.DB.prepare('DELETE FROM pedidos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  ctx?.waitUntil(syncPedidos(env, tabForDept('pedido', pedido?.departamento), empresa_id));
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

async function actualizarTipoHerramienta(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const minimo = parseInt(body.stock_minimo) || 0;
  await env.DB.prepare('UPDATE tipos_herramienta SET stock_minimo = ? WHERE id = ? AND empresa_id = ?').bind(minimo, id, empresa_id).run();
  return json({ ok: true });
}

async function actualizarTipoCable(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const minimo = parseInt(body.stock_minimo) || 0;
  await env.DB.prepare('UPDATE tipos_cable SET stock_minimo = ? WHERE id = ? AND empresa_id = ?').bind(minimo, id, empresa_id).run();
  return json({ ok: true });
}

async function getAlertasStock(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);

  // 1. Herramientas: tipos con menos disponibles que el mínimo
  const { results: herramientas } = await env.DB.prepare(`
    SELECT t.id, t.nombre, t.stock_minimo,
           COUNT(CASE WHEN h.estado = 'disponible' THEN 1 END) as disponibles
    FROM tipos_herramienta t
    LEFT JOIN herramientas h ON h.tipo_id = t.id AND h.empresa_id = t.empresa_id
    WHERE t.empresa_id = ? AND t.stock_minimo > 0
    GROUP BY t.id
    HAVING disponibles < t.stock_minimo
  `).bind(empresa_id).all();

  // 2. Inventario seg: items modo='cantidad' con stock bajo mínimo
  const { results: seguridad } = await env.DB.prepare(`
    SELECT id, nombre, tipo_material, cantidad_disponible, stock_minimo
    FROM inventario_seg
    WHERE empresa_id = ? AND modo = 'cantidad' AND stock_minimo > 0
      AND cantidad_disponible < stock_minimo AND estado != 'baja'
  `).bind(empresa_id).all();

  // 3. Bobinas: tipos_cable con menos bobinas activas que el mínimo
  const { results: bobinas } = await env.DB.prepare(`
    SELECT tc.id, tc.nombre, tc.stock_minimo,
           COUNT(b.id) as total_bobinas
    FROM tipos_cable tc
    LEFT JOIN bobinas b ON b.tipo_cable = tc.nombre AND b.empresa_id = tc.empresa_id
      AND b.estado NOT IN ('Dado de baja', 'baja')
    WHERE tc.empresa_id = ? AND tc.stock_minimo > 0
    GROUP BY tc.id
    HAVING total_bobinas < tc.stock_minimo
  `).bind(empresa_id).all();

  return json({ herramientas, seguridad, bobinas });
}

// ── Dashboard de obra (NEW-27) ────────────────────────────────────────────────
async function getObraDashboard(request, env) {
  const auth = await getAuth(request, env);
  const { empresa_id, obra_id, departamento } = auth;
  if (!empresa_id) return err('No autorizado', 403);

  const url = new URL(request.url);
  const queryObraId = url.searchParams.get('obra_id') ? parseInt(url.searchParams.get('obra_id')) : obra_id;
  const hoy = new Date().toISOString().slice(0, 10);

  const obraFilter   = queryObraId ? ' AND obra_id = ?' : '';
  const deptFilter   = departamento ? ' AND departamento = ?' : '';

  const buildParams = (base, ...extras) => {
    const p = [empresa_id];
    if (queryObraId) p.push(queryObraId);
    if (departamento) p.push(departamento);
    return [...p, ...extras];
  };

  const [fichajesHoy, equiposMant, herrFuera, pedidosPend, alertasHerr, alertasSeg, alertasBob, incidenciasAbiertas, proximoEvento] = await Promise.all([
    // Fichajes hoy
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM fichajes WHERE empresa_id=?${queryObraId ? ' AND obra_id=?' : ''} AND fecha=?`
    ).bind(...[empresa_id, ...(queryObraId ? [queryObraId] : []), hoy]).first(),

    // Equipos en mantenimiento (PEMP + carretillas)
    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM pemp WHERE empresa_id=? AND estado='mantenimiento'${queryObraId?' AND obra_id=?':''})
            + (SELECT COUNT(*) FROM carretillas WHERE empresa_id=? AND estado='mantenimiento'${queryObraId?' AND obra_id=?':''}) as n`
    ).bind(...[empresa_id, ...(queryObraId?[queryObraId]:[]), empresa_id, ...(queryObraId?[queryObraId]:[])]).first(),

    // Herramientas no disponibles (en uso / averiada / baja)
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM herramientas WHERE empresa_id=? AND estado != 'disponible'`
    ).bind(empresa_id).first(),

    // Pedidos pendientes/solicitados del departamento
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM pedidos WHERE empresa_id=?${queryObraId?' AND obra_id=?':''} AND estado IN ('pendiente','solicitado')${departamento?' AND departamento=?':''}`
    ).bind(...buildParams(empresa_id)).first(),

    // Alertas stock herramientas
    env.DB.prepare(`
      SELECT COUNT(*) as n FROM (
        SELECT t.id FROM tipos_herramienta t
        LEFT JOIN herramientas h ON h.tipo_id = t.id AND h.empresa_id = t.empresa_id
        WHERE t.empresa_id = ? AND t.stock_minimo > 0
        GROUP BY t.id HAVING COUNT(CASE WHEN h.estado='disponible' THEN 1 END) < t.stock_minimo
      )
    `).bind(empresa_id).first(),

    // Alertas stock seguridad
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM inventario_seg WHERE empresa_id=? AND modo='cantidad' AND stock_minimo>0 AND cantidad_disponible < stock_minimo AND estado!='baja'`
    ).bind(empresa_id).first(),

    // Alertas stock bobinas
    env.DB.prepare(`
      SELECT COUNT(*) as n FROM (
        SELECT tc.id FROM tipos_cable tc
        LEFT JOIN bobinas b ON b.tipo_cable=tc.nombre AND b.empresa_id=tc.empresa_id AND b.estado NOT IN ('Dado de baja','baja')
        WHERE tc.empresa_id=? AND tc.stock_minimo>0
        GROUP BY tc.id HAVING COUNT(b.id) < tc.stock_minimo
      )
    `).bind(empresa_id).first(),

    // Incidencias abiertas o en progreso
    env.DB.prepare(
      `SELECT COUNT(*) as n FROM incidencias WHERE empresa_id=?${queryObraId?' AND obra_id=?':''} AND estado IN ('abierta','en_progreso')${departamento?' AND departamento=?':''}`
    ).bind(...buildParams(empresa_id)).first(),

    // Próximo evento del calendario
    env.DB.prepare(
      `SELECT titulo, fecha, hora, tipo FROM eventos_calendario WHERE empresa_id=?${queryObraId?' AND (obra_id=? OR obra_id IS NULL)':''} AND fecha >= ? ORDER BY fecha ASC, hora ASC LIMIT 1`
    ).bind(...[empresa_id, ...(queryObraId?[queryObraId]:[]), hoy]).first(),
  ]);

  return json({
    fichajes_hoy:           fichajesHoy?.n || 0,
    equipos_mantenimiento:  equiposMant?.n || 0,
    herramientas_fuera:     herrFuera?.n  || 0,
    pedidos_pendientes:     pedidosPend?.n || 0,
    alertas_stock:          (alertasHerr?.n||0) + (alertasSeg?.n||0) + (alertasBob?.n||0),
    incidencias_abiertas:   incidenciasAbiertas?.n || 0,
    proximo_evento:         proximoEvento || null,
    obra_id:                queryObraId || null,
  });
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
  ctx?.waitUntil(syncSheets(env, 'Kits', empresa_id));
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
  ctx?.waitUntil(syncSheets(env, 'Kits', empresa_id));
  return json({ ok: true });
}

async function eliminarKit(id, request, env, ctx) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || (rol !== 'encargado' && rol !== 'empresa_admin' && rol !== 'superadmin')) return err('Sin permisos', 403);
  await env.DB.prepare('UPDATE herramientas SET kit_id = NULL WHERE kit_id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  await env.DB.prepare('DELETE FROM kits_herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  ctx?.waitUntil(syncSheets(env, 'Kits', empresa_id));
  return json({ ok: true });
}

async function getHerramientas(request, env) {
  const { empresa_id, departamento, isSuperadmin, isEmpresaAdmin, isJefeObra } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const isAdminRole = isSuperadmin || isEmpresaAdmin || isJefeObra;
  const todos = url.searchParams.get('todos') === '1' && (isSuperadmin || isEmpresaAdmin);
  const deptParam = url.searchParams.get('departamento');
  const deptFilter = deptParam || (!todos ? departamento : null);
  let sql = `SELECT h.*, t.nombre as tipo_nombre, o.nombre as obra_nombre, k.numero_kit
             FROM herramientas h
             LEFT JOIN tipos_herramienta t ON h.tipo_id = t.id
             LEFT JOIN obras o ON h.obra_id = o.id
             LEFT JOIN kits_herramientas k ON h.kit_id = k.id
             WHERE h.empresa_id = ?`;
  const params = [empresa_id];
  if (deptFilter) { sql += ' AND h.departamento = ?'; params.push(deptFilter); }
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
  ctx?.waitUntil(syncSheets(env, tabForDept('herramienta', dept), empresa_id));
  // Notificación Telegram con botón para marcar disponible
  const tipoRow = tipo_id ? await env.DB.prepare('SELECT nombre FROM tipos_herramienta WHERE id = ?').bind(tipo_id).first().catch(() => null) : null;
  const tipoNom = tipoRow?.nombre || body.modelo || 'herramienta';
  const obraRow = obra_id ? await env.DB.prepare('SELECT nombre FROM obras WHERE id = ?').bind(obra_id).first().catch(() => null) : null;
  ctx?.waitUntil(sendTelegramConBotones(env,
    `🔧 <b>Nueva herramienta registrada</b>\n📋 ${tipoNom}${marca ? ' · ' + marca : ''}${body.modelo ? ' · ' + body.modelo : ''}\n📍 ${obraRow?.nombre || '—'}\n👤 ${userNombre || rol}`,
    [[{ text: '✅ Disponible', callback_data: `herr_disp:${hid}` }]]
  ));
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

  // Alerta stock mínimo: si el tipo tiene stock_minimo y el estado pasa a no-disponible
  if (body.estado !== undefined && body.estado !== 'disponible' && h.tipo_id) {
    const tipo = await env.DB.prepare('SELECT nombre, stock_minimo FROM tipos_herramienta WHERE id = ? AND empresa_id = ?').bind(h.tipo_id, empresa_id).first().catch(() => null);
    if (tipo?.stock_minimo > 0) {
      const { results: disp } = await env.DB.prepare(
        "SELECT COUNT(*) as c FROM herramientas WHERE tipo_id = ? AND empresa_id = ? AND estado = 'disponible'"
      ).bind(h.tipo_id, empresa_id).all();
      const disponibles = disp[0]?.c ?? 0;
      if (disponibles < tipo.stock_minimo) {
        await sendTelegram(env, `⚠️ <b>Stock mínimo alcanzado — Herramientas</b>\n🔧 ${tipo.nombre}\n📉 Disponibles: <b>${disponibles}</b> (mínimo: ${tipo.stock_minimo})\n👤 ${userNombre || rol}`);
      }
    }
  }

  ctx?.waitUntil(syncSheets(env, tabForDept('herramienta', body.departamento || h.departamento), empresa_id));
  return json({ ok: true });
}

async function eliminarHerramienta(id, request, env, ctx) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id || (rol !== 'encargado' && rol !== 'empresa_admin' && rol !== 'superadmin')) return err('Sin permisos', 403);
  const h = await env.DB.prepare('SELECT departamento FROM herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  await env.DB.prepare('DELETE FROM herramientas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  ctx?.waitUntil(syncSheets(env, tabForDept('herramienta', h?.departamento), empresa_id));
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
  // foto_r2_key ya viene en SELECT p.* si la columna existe
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

  let sqlU = 'SELECT id, nombre, rol, departamento, obra_id, NULL as dni, "app" as tipo, foto_r2_key, CASE WHEN telegram_id IS NOT NULL THEN 1 ELSE 0 END as tiene_telegram FROM usuarios WHERE empresa_id=? AND activo=1';
  const paramsU = [empresa_id];
  if (obra_id) { sqlU += ' AND obra_id=?'; paramsU.push(parseInt(obra_id)); }
  sqlU += ' ORDER BY nombre';

  let sqlP = 'SELECT id, nombre, NULL as rol, departamento, obra_id, dni, "externo" as tipo, foto_r2_key, 0 as tiene_telegram FROM personal_externo WHERE empresa_id=? AND activo=1';
  const paramsP = [empresa_id];
  if (obra_id) { sqlP += ' AND obra_id=?'; paramsP.push(parseInt(obra_id)); }
  sqlP += ' ORDER BY nombre';

  const [ru, rp] = await Promise.all([
    env.DB.prepare(sqlU).bind(...paramsU).all(),
    env.DB.prepare(sqlP).bind(...paramsP).all(),
  ]);
  return json([...ru.results, ...rp.results]);
}

// ── EPIs asignados (NEW-23) ────────────────────────────────────────────────
async function getEpisAsignados(request, env) {
  const { empresa_id, obra_id: obraAuth, isSuperadmin, isEmpresaAdmin, isAdmin } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url     = new URL(request.url);
  const obra_id = url.searchParams.get('obra_id') || ((!isSuperadmin && !isEmpresaAdmin && !isAdmin) ? obraAuth : null);
  let sql = 'SELECT * FROM epis_asignados WHERE empresa_id=?';
  const params = [empresa_id];
  if (obra_id) { sql += ' AND obra_id=?'; params.push(parseInt(obra_id)); }
  sql += ' ORDER BY nombre_trabajador, tipo_epi';
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return json(rows.results);
}

async function crearEpiAsignado(request, env, ctx) {
  const { empresa_id, nombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const b = await request.json();
  const { obra_id, usuario_id, externo_id, nombre_trabajador, tipo_epi, talla, numero_serie, fecha_entrega, fecha_caducidad, proxima_revision, estado, observaciones } = b;
  if (!tipo_epi || !nombre_trabajador) return err('Faltan campos obligatorios');
  const r = await env.DB.prepare(
    'INSERT INTO epis_asignados (empresa_id,obra_id,usuario_id,externo_id,nombre_trabajador,tipo_epi,talla,numero_serie,fecha_entrega,fecha_caducidad,proxima_revision,estado,observaciones,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obra_id||null, usuario_id||null, externo_id||null, nombre_trabajador, tipo_epi, talla||null, numero_serie||null, fecha_entrega||null, fecha_caducidad||null, proxima_revision||null, estado||'activo', observaciones||null, nombre||rol||'').run();
  ctx?.waitUntil(syncRRHH(env, 'EPIs', empresa_id));
  return json({ ok: true, id: r.meta.last_row_id });
}

async function actualizarEpiAsignado(id, request, env, ctx) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const b = await request.json();
  const campos = [], vals = [];
  ['obra_id','usuario_id','externo_id','nombre_trabajador','tipo_epi','talla','numero_serie','fecha_entrega','fecha_caducidad','proxima_revision','estado','observaciones'].forEach(k => {
    if (b[k] !== undefined) { campos.push(`${k}=?`); vals.push(b[k]); }
  });
  if (!campos.length) return err('Sin cambios');
  vals.push(id, empresa_id);
  await env.DB.prepare(`UPDATE epis_asignados SET ${campos.join(',')} WHERE id=? AND empresa_id=?`).bind(...vals).run();
  ctx?.waitUntil(syncRRHH(env, 'EPIs', empresa_id));
  return json({ ok: true });
}

async function eliminarEpiAsignado(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM epis_asignados WHERE id=? AND empresa_id=?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Carnets y certificaciones (NEW-19) ─────────────────────────────────────
async function getCarnets(request, env) {
  const { empresa_id, obra_id: obraAuth, isSuperadmin, isEmpresaAdmin, isAdmin } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const obra_id = url.searchParams.get('obra_id') || ((!isSuperadmin && !isEmpresaAdmin && !isAdmin) ? obraAuth : null);
  let sql = 'SELECT * FROM carnets WHERE empresa_id=?';
  const params = [empresa_id];
  if (obra_id) { sql += ' AND obra_id=?'; params.push(parseInt(obra_id)); }
  sql += ' ORDER BY nombre_trabajador, tipo';
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return json(rows.results);
}

async function crearCarnet(request, env, ctx) {
  const { empresa_id, nombre, rol, obra_id: obraAuth } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const b = await request.json();
  const { obra_id, usuario_id, externo_id, nombre_trabajador, tipo, numero, fecha_obtencion, fecha_caducidad, dias_aviso, estado, notas } = b;
  if (!tipo || !nombre_trabajador) return err('Faltan campos obligatorios');
  const r = await env.DB.prepare(
    'INSERT INTO carnets (empresa_id,obra_id,usuario_id,externo_id,nombre_trabajador,tipo,numero,fecha_obtencion,fecha_caducidad,dias_aviso,estado,notas,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obra_id||obraAuth||null, usuario_id||null, externo_id||null, nombre_trabajador, tipo, numero||null, fecha_obtencion||null, fecha_caducidad||null, dias_aviso||30, estado||'vigente', notas||null, nombre||rol||'').run();
  ctx?.waitUntil(syncRRHH(env, 'Carnets', empresa_id));
  return json({ ok: true, id: r.meta.last_row_id });
}

async function actualizarCarnet(id, request, env, ctx) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const b = await request.json();
  const campos = [], vals = [];
  ['obra_id','usuario_id','externo_id','nombre_trabajador','tipo','numero','fecha_obtencion','fecha_caducidad','dias_aviso','estado','notas'].forEach(k => {
    if (b[k] !== undefined) { campos.push(`${k}=?`); vals.push(b[k]); }
  });
  if (!campos.length) return err('Sin cambios');
  vals.push(id, empresa_id);
  await env.DB.prepare(`UPDATE carnets SET ${campos.join(',')} WHERE id=? AND empresa_id=?`).bind(...vals).run();
  ctx?.waitUntil(syncRRHH(env, 'Carnets', empresa_id));
  return json({ ok: true });
}

async function eliminarCarnet(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM carnets WHERE id=? AND empresa_id=?').bind(id, empresa_id).run();
  return json({ ok: true });
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

async function crearFichaje(request, env, ctx) {
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
  ctx?.waitUntil(syncRRHH(env, 'Fichajes', empresa_id));
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarFichaje(id, request, env, ctx) {
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
  ctx?.waitUntil(syncRRHH(env, 'Fichajes', empresa_id));
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

    // Metadata: incluye bandedRanges y conditionalFormats para poder limpiarlos antes de re-aplicar
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties,bandedRanges,conditionalFormats)`;
    const metaRes = await fetch(metaUrl, { headers: authH });
    const meta = await metaRes.json();
    let sheetsActuales = meta.sheets || [];

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
      const m2 = await (await fetch(metaUrl, { headers: authH })).json();
      sheetsActuales = m2.sheets || [];
    }

    const sheetMetaMap = {};
    sheetsActuales.forEach(s => { sheetMetaMap[s.properties.title] = s; });

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
      if (sheetMetaMap[tab]) {
        await applyTabFormatting(sheetId, authH, tab, sheetMetaMap[tab], values[0]?.length || 1, values.length);
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

    // Metadata: incluye bandedRanges y conditionalFormats para limpiarlos antes de re-aplicar
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties,bandedRanges,conditionalFormats)`;
    const metaRes = await fetch(metaUrl, { headers: authH });
    const meta = await metaRes.json();
    let sheetsActuales = meta.sheets || [];

    // Crear pestañas que faltan
    const addReqs = tabsNecesarias
      .filter(t => !sheetsActuales.map(s => s.properties.title).includes(t))
      .map(t => ({ addSheet: { properties: { title: t } } }));

    if (addReqs.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST', headers: authH, body: JSON.stringify({ requests: addReqs }),
      }).then(r => r.body?.cancel());
      const m2 = await (await fetch(metaUrl, { headers: authH })).json();
      sheetsActuales = m2.sheets || [];
    }

    const sheetMetaMap = {};
    sheetsActuales.forEach(s => { sheetMetaMap[s.properties.title] = s; });

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
      if (sheetMetaMap[tab]) {
        await applyTabFormatting(sheetId, authH, tab, sheetMetaMap[tab], values[0]?.length || 1, values.length);
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

async function applyTabFormatting(spreadsheetId, authH, tabName, sheetMeta, numCols, numRows) {
  const numSheetId = sheetMeta.properties.sheetId;

  // Paleta por departamento (header oscuro + banda alterna clara)
  const palette = tabName.startsWith('Elec')
    ? { header: { red: 0.71, green: 0.51, blue: 0.04 }, band: { red: 1.0, green: 0.97, blue: 0.86 } }   // dorado
    : tabName.startsWith('Mec')
    ? { header: { red: 0.20, green: 0.40, blue: 0.62 }, band: { red: 0.91, green: 0.95, blue: 0.99 } }  // azul
    : { header: { red: 0.78, green: 0.40, blue: 0.10 }, band: { red: 1.0, green: 0.93, blue: 0.86 } };  // naranja (Seg)
  const headerBg = { ...palette.header, alpha: 1 };
  const bandFirst = { red: 1, green: 1, blue: 1, alpha: 1 };
  const bandSecond = { ...palette.band, alpha: 1 };

  // Columna "Estado" por pestaña (índice 0-based)
  const estadoColMap = {
    'Elec-Bobinas': 9, 'Elec-PEMP': 5, 'Elec-Carretillas': 6,
    'Mec-PEMP': 5,     'Mec-Carretillas': 6,
    'Seg-Inventario': 6, 'Elec-Pedidos': 6, 'Mec-Pedidos': 6, 'Seg-Pedidos': 6,
    'Elec-Herramientas': 8, 'Mec-Herramientas': 8, 'Kits': 8,
  };
  const estadoCol = estadoColMap[tabName] ?? -1;

  // Última columna asumida como "Notas" (wrap)
  const notasCol = numCols - 1;

  const fullRange = { sheetId: numSheetId, startRowIndex: 0, endRowIndex: Math.max(numRows, 1), startColumnIndex: 0, endColumnIndex: numCols };
  const dataRange = { sheetId: numSheetId, startRowIndex: 1, endRowIndex: Math.max(numRows, 1), startColumnIndex: 0, endColumnIndex: numCols };
  const headerRange = { sheetId: numSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols };

  const requests = [];

  // 1. RESET: borrar reglas condicionales y bandings previos para evitar acumulación
  const condCount = (sheetMeta.conditionalFormats || []).length;
  for (let i = condCount - 1; i >= 0; i--) {
    requests.push({ deleteConditionalFormatRule: { sheetId: numSheetId, index: i } });
  }
  for (const b of (sheetMeta.bandedRanges || [])) {
    requests.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });
  }

  // 2. Reset de formato en todo el rango usado (limpia formatos previos antes de reaplicar)
  requests.push({
    repeatCell: {
      range: fullRange,
      cell: { userEnteredFormat: {} },
      fields: 'userEnteredFormat',
    },
  });

  // 3. Header: fondo oscuro, texto blanco, centrado, fila más alta
  requests.push({
    repeatCell: {
      range: headerRange,
      cell: {
        userEnteredFormat: {
          backgroundColor: headerBg,
          textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1, green: 1, blue: 1 } },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP',
          padding: { top: 6, bottom: 6, left: 4, right: 4 },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,padding)',
    },
  });

  // 4. Altura de la fila de cabecera
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: numSheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 36 },
      fields: 'pixelSize',
    },
  });

  // 5. Datos: alineación + tamaño
  if (numRows > 1) {
    requests.push({
      repeatCell: {
        range: dataRange,
        cell: {
          userEnteredFormat: {
            textFormat: { fontSize: 10 },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'CLIP',
          },
        },
        fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)',
      },
    });

    // 6. Wrap solo en la columna Notas (última)
    requests.push({
      repeatCell: {
        range: { sheetId: numSheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: notasCol, endColumnIndex: notasCol + 1 },
        cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
        fields: 'userEnteredFormat.wrapStrategy',
      },
    });
  }

  // 7. Bordes finos en todo el rango
  if (numRows > 0) {
    const thin = { style: 'SOLID', colorStyle: { rgbColor: { red: 0.85, green: 0.85, blue: 0.85 } } };
    requests.push({
      updateBorders: {
        range: fullRange,
        top: thin, bottom: thin, left: thin, right: thin,
        innerHorizontal: thin, innerVertical: thin,
      },
    });
  }

  // 8. Banding zebra (solo si hay datos)
  if (numRows > 1) {
    requests.push({
      addBanding: {
        bandedRange: {
          range: dataRange,
          rowProperties: {
            firstBandColorStyle:  { rgbColor: bandFirst },
            secondBandColorStyle: { rgbColor: bandSecond },
          },
        },
      },
    });
  }

  // 9. Filtro automático en la cabecera (setBasicFilter reemplaza el existente)
  if (numRows > 1) {
    requests.push({ setBasicFilter: { filter: { range: fullRange } } });
  }

  // 10. Congelar fila de cabecera
  requests.push({
    updateSheetProperties: {
      properties: { sheetId: numSheetId, gridProperties: { frozenRowCount: 1 } },
      fields: 'gridProperties.frozenRowCount',
    },
  });

  // 11. Auto-ajustar anchos de columna
  requests.push({
    autoResizeDimensions: {
      dimensions: { sheetId: numSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: numCols },
    },
  });

  // 12. Limitar ancho máximo de la columna Notas (evita columnas gigantes)
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: numSheetId, dimension: 'COLUMNS', startIndex: notasCol, endIndex: notasCol + 1 },
      properties: { pixelSize: 280 },
      fields: 'pixelSize',
    },
  });

  // 13. Colores condicionales: pintar TODA la fila según el valor de la columna Estado
  if (estadoCol >= 0 && numRows > 1) {
    const colLetter = String.fromCharCode(65 + estadoCol); // A=0, B=1...
    const reglas = [
      { vals: ['activa', 'disponible', 'recibido'],   bg: { red: 0.85, green: 0.94, blue: 0.83 } }, // verde claro
      { vals: ['Averiada', 'averiado'],               bg: { red: 0.97, green: 0.80, blue: 0.80 } }, // rojo claro
      { vals: ['en_reparacion'],                       bg: { red: 1.00, green: 0.90, blue: 0.65 } }, // ámbar
      { vals: ['pendiente'],                           bg: { red: 1.00, green: 0.97, blue: 0.85 } }, // amarillo
      { vals: ['solicitado', 'en_uso'],                bg: { red: 0.83, green: 0.92, blue: 0.96 } }, // azul claro
      { vals: ['perdido'],                             bg: { red: 0.90, green: 0.83, blue: 0.93 } }, // morado claro
      { vals: ['devuelta', 'cancelado', 'baja'],       bg: { red: 0.93, green: 0.93, blue: 0.93 } }, // gris claro
    ];
    const rangeFila = { sheetId: numSheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols };
    for (const r of reglas) {
      const condicion = r.vals.length === 1
        ? `=$${colLetter}2="${r.vals[0]}"`
        : '=OR(' + r.vals.map(v => `$${colLetter}2="${v}"`).join(',') + ')';
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [rangeFila],
            booleanRule: {
              condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: condicion }] },
              format: { backgroundColor: r.bg },
            },
          },
          index: 0,
        },
      });
    }
  }

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST', headers: authH, body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    console.error(`applyTabFormatting(${tabName}) HTTP ${res.status}: ${errBody.slice(0, 300)}`);
  } else {
    await res.body?.cancel();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SYNC RRHH — Fichajes, Incidencias, Carnets, EPIs, Turnos, Repostajes (SYNC-03)
// ════════════════════════════════════════════════════════════════════════════
async function syncRRHH(env, tabs = null, empresa_id = 1) {
  if (!env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_SHEET_ID) return;
  try {
    const token   = await getGoogleToken(env);
    const sheetId = env.GOOGLE_SHEET_ID;
    const authH   = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    const tabsNecesarias = ['Fichajes', 'Incidencias', 'Carnets', 'EPIs', 'Turnos', 'Repostajes'];
    const tabsToSync     = tabs ? (Array.isArray(tabs) ? tabs : [tabs]) : tabsNecesarias;

    // Crear pestañas que faltan
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties,bandedRanges,conditionalFormats)`;
    let metaRes = await fetch(metaUrl, { headers: authH });
    let meta = await metaRes.json();
    let sheetsActuales = meta.sheets || [];
    const addReqs = tabsNecesarias
      .filter(t => tabsToSync.includes(t) && !sheetsActuales.map(s => s.properties.title).includes(t))
      .map(t => ({ addSheet: { properties: { title: t } } }));
    if (addReqs.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
        { method: 'POST', headers: authH, body: JSON.stringify({ requests: addReqs }) }).then(r => r.body?.cancel());
      const m2 = await (await fetch(metaUrl, { headers: authH })).json();
      sheetsActuales = m2.sheets || [];
    }
    const sheetMetaMap = {};
    sheetsActuales.forEach(s => { sheetMetaMap[s.properties.title] = s; });

    const writeTab = async (tab, values) => {
      if (!tabsToSync.includes(tab)) return;
      const range = `${tab}!A1`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`,
        { method: 'POST', headers: authH }).then(r => r.body?.cancel());
      const putRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        { method: 'PUT', headers: authH, body: JSON.stringify({ values }) });
      if (!putRes.ok) { const eb = await putRes.text(); throw new Error(`writeTab(${tab}) ${putRes.status}: ${eb.slice(0,200)}`); }
      else { await putRes.body?.cancel(); }
      if (sheetMetaMap[tab]) await applyTabFormatting(sheetId, authH, tab, sheetMetaMap[tab], values[0]?.length || 1, values.length);
    };

    const cabFichajes   = ['Obra', 'Fecha', 'Trabajador', 'Hora Entrada', 'Hora Salida', 'Horas', 'H. Extra', 'Retraso (min)', 'Estado', 'Motivo', 'Notas', 'Registrado por'];
    const cabIncid      = ['Obra', 'Fecha', 'Departamento', 'Título', 'Tipo', 'Gravedad', 'Estado', 'Reportado por', 'Asignado a', 'Resolución'];
    const cabCarnets    = ['Obra', 'Trabajador', 'Tipo', 'Número', 'Fecha Obtención', 'Fecha Caducidad', 'Estado', 'Notas'];
    const cabEPIs       = ['Obra', 'Trabajador', 'Tipo EPI', 'Talla', 'Nº Serie', 'Fecha Entrega', 'Fecha Caducidad', 'Próx. Revisión', 'Estado', 'Observaciones'];
    const cabTurnos     = ['Obra', 'Fecha', 'Trabajador', 'Turno'];
    const cabRepostajes = ['Obra', 'Fecha', 'Equipo', 'ID Equipo', 'Tipo', 'Cantidad', 'Unidad', 'Coste (€)', 'Usuario', 'Notas'];

    const fmtF = f => [f.obra_nombre||'', f.fecha||'', f.nombre_usuario||f.nombre_externo||'', f.hora_entrada||'', f.hora_salida||'', f.horas_trabajadas||0, f.horas_extra||0, f.minutos_retraso||0, f.estado||'', f.motivo||'', f.notas||'', f.registrado_por||''];
    const fmtI = i => [i.obra_nombre||'', i.fecha||'', i.departamento||'', i.titulo||'', i.tipo||'', i.gravedad||'', i.estado||'', i.reportado_por||'', i.asignado_a||'', i.resolucion||''];
    const fmtK = k => [k.obra_nombre||'', k.nombre_trabajador||'', k.tipo||'', k.numero||'', k.fecha_obtencion||'', k.fecha_caducidad||'', k.estado||'', k.notas||''];
    const fmtE = e => [e.obra_nombre||'', e.nombre_trabajador||'', e.tipo_epi||'', e.talla||'', e.numero_serie||'', e.fecha_entrega||'', e.fecha_caducidad||'', e.proxima_revision||'', e.estado||'', e.observaciones||''];
    const fmtT = t => [t.obra_nombre||'', t.fecha||'', t.nombre_trabajador||'', t.turno||''];
    const fmtR = r => [r.obra_nombre||'', r.fecha||'', r.equipo_tipo||'', String(r.equipo_id||''), r.tipo||'', r.cantidad||'', r.unidad||'', r.coste||'', r.usuario||'', r.notas||''];

    await Promise.all([
      tabsToSync.includes('Fichajes') && (async () => {
        const { results } = await env.DB.prepare(
          `SELECT f.*, u.nombre as nombre_usuario, pe.nombre as nombre_externo, o.nombre as obra_nombre
           FROM fichajes f LEFT JOIN usuarios u ON f.usuario_id=u.id LEFT JOIN personal_externo pe ON f.personal_externo_id=pe.id LEFT JOIN obras o ON f.obra_id=o.id
           WHERE f.empresa_id=? ORDER BY f.fecha DESC, f.hora_entrada ASC LIMIT 1000`
        ).bind(empresa_id).all();
        await writeTab('Fichajes', [cabFichajes, ...results.map(fmtF)]);
      })(),
      tabsToSync.includes('Incidencias') && (async () => {
        const { results } = await env.DB.prepare(
          `SELECT i.*, o.nombre as obra_nombre FROM incidencias i LEFT JOIN obras o ON i.obra_id=o.id WHERE i.empresa_id=? ORDER BY i.fecha DESC LIMIT 500`
        ).bind(empresa_id).all();
        await writeTab('Incidencias', [cabIncid, ...results.map(fmtI)]);
      })(),
      tabsToSync.includes('Carnets') && (async () => {
        const { results } = await env.DB.prepare(
          `SELECT c.*, o.nombre as obra_nombre FROM carnets c LEFT JOIN obras o ON c.obra_id=o.id WHERE c.empresa_id=? ORDER BY c.nombre_trabajador, c.tipo`
        ).bind(empresa_id).all();
        await writeTab('Carnets', [cabCarnets, ...results.map(fmtK)]);
      })(),
      tabsToSync.includes('EPIs') && (async () => {
        const { results } = await env.DB.prepare(
          `SELECT e.*, o.nombre as obra_nombre FROM epis_asignados e LEFT JOIN obras o ON e.obra_id=o.id WHERE e.empresa_id=? ORDER BY e.nombre_trabajador, e.tipo_epi`
        ).bind(empresa_id).all();
        await writeTab('EPIs', [cabEPIs, ...results.map(fmtE)]);
      })(),
      tabsToSync.includes('Turnos') && (async () => {
        const { results } = await env.DB.prepare(
          `SELECT t.*, o.nombre as obra_nombre FROM turnos t LEFT JOIN obras o ON t.obra_id=o.id WHERE t.empresa_id=? ORDER BY t.fecha DESC LIMIT 1000`
        ).bind(empresa_id).all();
        await writeTab('Turnos', [cabTurnos, ...results.map(fmtT)]);
      })(),
      tabsToSync.includes('Repostajes') && (async () => {
        const { results } = await env.DB.prepare(
          `SELECT r.*, o.nombre as obra_nombre FROM repostajes r LEFT JOIN obras o ON r.obra_id=o.id WHERE r.empresa_id=? ORDER BY r.fecha DESC LIMIT 500`
        ).bind(empresa_id).all();
        await writeTab('Repostajes', [cabRepostajes, ...results.map(fmtR)]);
      })(),
    ].filter(Boolean));
    console.log(`RRHH sync OK [${tabsToSync.join(', ')}]`);
  } catch (e) {
    console.error('Error sync RRHH:', e.message);
    try { await env.DB.prepare('INSERT INTO logs (nivel,origen,mensaje,detalle) VALUES (?,?,?,?)').bind('error','sync-rrhh','Error sync RRHH Sheets',e.message).run(); } catch (_) {}
  }
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

    const { results } = await env.DB.prepare('SELECT * FROM bobinas WHERE empresa_id = ? ORDER BY created_at DESC').bind(1).all();
    log.push(`Bobinas en DB (empresa 1): ${results.length}`);

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
  // SEC-09: requiere sesión válida — evita consumo de cuota de Cloud Vision sin autenticar
  const xTokOcr = request.headers.get('X-Token');
  if (!xTokOcr) return err('No autorizado', 401);
  const _sOcr = await env.DB.prepare("SELECT id FROM sesiones WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(xTokOcr).first().catch(() => null);
  if (!_sOcr) return err('No autorizado', 401);
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
  // SEC-09: requiere sesión válida — evita consumo de cuota de Gemini sin autenticar
  const xTokScan = request.headers.get('X-Token');
  if (!xTokScan) return err('No autorizado', 401);
  const _sScan = await env.DB.prepare("SELECT id FROM sesiones WHERE token = ? AND (expires_at IS NULL OR expires_at > datetime('now'))").bind(xTokScan).first().catch(() => null);
  if (!_sScan) return err('No autorizado', 401);
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
  const { isSuperadmin, isSeguridad, isAdmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isSeguridad && !isEmpresaAdmin) return err('No autorizado', 403);
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  let sql = 'SELECT * FROM inventario_seg WHERE empresa_id = ?';
  const params = [empresa_id];
  if (q) { sql += ' AND (tipo_material LIKE ? OR codigo LIKE ? OR nombre LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += ' ORDER BY created_at DESC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function buscarItemSeg(codigo, request, env) {
  const { empresa_id } = await getAuth(request, env);
  const item = await env.DB.prepare('SELECT * FROM inventario_seg WHERE codigo = ? AND empresa_id = ?').bind(codigo.trim().toUpperCase(), empresa_id).first();
  if (!item) return json({ ok: false, error: 'No encontrado' }, 404);
  const hist = await env.DB.prepare('SELECT * FROM movimientos_seg WHERE item_id = ? ORDER BY fecha DESC LIMIT 10').bind(item.id).all();
  return json({ ok: true, data: item, historial: hist.results });
}

async function crearItemSeg(request, env, ctx) {
  const { isSuperadmin, isSeguridad, isAdmin, isEmpresaAdmin, usuario, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isSeguridad && !isEmpresaAdmin) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { tipo_material, modo = 'individual', codigo, nombre, cantidad_total = 1, fecha_entrada, fecha_caducidad, notas, stock_minimo = 0 } = body;
  if (!tipo_material) return err('Falta tipo_material');
  if (modo === 'individual' && !codigo) return err('Falta el código identificador');
  const cod = codigo ? codigo.trim().toUpperCase() : null;
  const fecha = fecha_entrada || fechaEspana();
  const reg = usuario || '';
  try {
    const r = await env.DB.prepare(
      `INSERT INTO inventario_seg (tipo_material, modo, codigo, nombre, cantidad_total, cantidad_disponible, estado, fecha_entrada, fecha_caducidad, notas, registrado_por, empresa_id, stock_minimo)
       VALUES (?, ?, ?, ?, ?, ?, 'disponible', ?, ?, ?, ?, ?, ?)`
    ).bind(tipo_material, modo, cod, nombre || tipo_material, cantidad_total, cantidad_total, fecha, fecha_caducidad || null, notas || '', reg, empresa_id, parseInt(stock_minimo) || 0).run();
    const id = r.meta.last_row_id;
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, usuario, fecha) VALUES (?, ?, ?, ?, ?)').bind(id, 'entrada', cantidad_total, reg, fecha).run();
    if (fecha_caducidad) {
      await sendTelegram(env, `📦 <b>Nuevo material Seguridad</b>\n🔖 ${cod || tipo_material}  📋 ${tipo_material}\n📅 Caduca: ${fecha_caducidad}\n👤 ${reg}`);
    }
    ctx?.waitUntil(syncSheets(env, 'Seg-Inventario', empresa_id));
    return json({ ok: true, id, mensaje: `${tipo_material} registrado` }, 201);
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return err(`El código ${cod} ya está registrado`, 409);
    throw e;
  }
}

async function moverItemSeg(id, request, env, ctx) {
  const { isSuperadmin, isSeguridad, isAdmin, isEmpresaAdmin, usuario } = await getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isSeguridad && !isEmpresaAdmin) return err('No autorizado', 403);
  const item = await env.DB.prepare('SELECT * FROM inventario_seg WHERE id = ?').bind(id).first();
  if (!item) return err('Item no encontrado', 404);
  const body = await request.json().catch(() => ({}));
  const { accion, cantidad = 1, destino, notas } = body;
  const fecha = fechaEspana();

  // Edición directa de campos del item (sin movimiento)
  if (accion === 'editar') {
    const { estado: nuevoEstado, destino_actual, notas: nuevasNotas, stock_minimo: nuevoMin } = body;
    const campos = [], vals = [];
    if (nuevoEstado !== undefined)   { campos.push('estado = ?');         vals.push(nuevoEstado); }
    if (destino_actual !== undefined) { campos.push('destino_actual = ?'); vals.push(destino_actual || null); }
    if (nuevasNotas !== undefined)    { campos.push('notas = ?');          vals.push(nuevasNotas || ''); }
    if (nuevoMin !== undefined)       { campos.push('stock_minimo = ?');   vals.push(parseInt(nuevoMin) || 0); }
    if (campos.length) {
      vals.push(id);
      await env.DB.prepare(`UPDATE inventario_seg SET ${campos.join(', ')} WHERE id = ?`).bind(...vals).run();
      ctx?.waitUntil(syncSheets(env, 'Seg-Inventario', item.empresa_id));
    }
    return json({ ok: true, mensaje: 'Item actualizado' });
  }

  if (accion === 'salida') {
    let nuevaCantidad = null;
    if (item.modo === 'individual') {
      if (item.estado !== 'disponible') return err('El item no está disponible', 409);
      await env.DB.prepare('UPDATE inventario_seg SET estado = ?, destino_actual = ? WHERE id = ?').bind('en_uso', destino || '', id).run();
    } else {
      const nueva = item.cantidad_disponible - cantidad;
      if (nueva < 0) return err(`No hay suficiente stock (disponible: ${item.cantidad_disponible})`, 409);
      nuevaCantidad = nueva;
      await env.DB.prepare('UPDATE inventario_seg SET cantidad_disponible = ?, estado = ?, destino_actual = ? WHERE id = ?').bind(nueva, nueva === 0 ? 'en_uso' : 'disponible', destino || '', id).run();
    }
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, destino, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, 'salida', cantidad, destino || '', usuario || '', notas || '', fecha).run();
    if (destino) await sendTelegram(env, `📤 <b>Material Seguridad — Salida</b>\n🔖 ${item.codigo || item.nombre}  📋 ${item.tipo_material}\n🏗 Destino: ${destino}\n👤 ${usuario || '—'}`);
    // Alerta stock mínimo (modo cantidad)
    if (item.modo === 'cantidad' && item.stock_minimo > 0 && nuevaCantidad !== null && nuevaCantidad < item.stock_minimo) {
      await sendTelegram(env, `⚠️ <b>Stock mínimo alcanzado — Seguridad</b>\n📦 ${item.nombre || item.tipo_material}\n📉 Disponible: <b>${nuevaCantidad}</b> (mínimo: ${item.stock_minimo})\n👤 ${usuario || '—'}`);
    }
    ctx?.waitUntil(syncSheets(env, 'Seg-Inventario', item.empresa_id));
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
    ctx?.waitUntil(syncSheets(env, 'Seg-Inventario', item.empresa_id));
    return json({ ok: true, mensaje: 'Devolución registrada' });
  }

  if (accion === 'baja') {
    await env.DB.prepare('UPDATE inventario_seg SET estado = ? WHERE id = ?').bind('baja', id).run();
    await env.DB.prepare('INSERT INTO movimientos_seg (item_id, accion, cantidad, usuario, notas, fecha) VALUES (?, ?, ?, ?, ?, ?)').bind(id, 'baja', cantidad, usuario || '', notas || '', fecha).run();
    await sendTelegram(env, `🗑️ <b>Material Seguridad — Baja</b>\n🔖 ${item.codigo || item.nombre}  📋 ${item.tipo_material}\n👤 ${usuario || '—'}`);
    ctx?.waitUntil(syncSheets(env, 'Seg-Inventario', item.empresa_id));
    return json({ ok: true, mensaje: 'Dado de baja' });
  }

  return err('Acción no reconocida', 400);
}

async function eliminarItemSeg(id, request, env, ctx) {
  const { isSuperadmin, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin) return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM inventario_seg WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM movimientos_seg WHERE item_id = ?').bind(id).run();
  ctx?.waitUntil(syncSheets(env, 'Seg-Inventario', empresa_id));
  return json({ ok: true, mensaje: 'Eliminado' });
}

async function addTipoMaterialSeg(request, env) {
  const { isSuperadmin, isSeguridad, isEmpresaAdmin, empresa_id } = await getAuth(request, env);
  if (!isSuperadmin && !isSeguridad && !isEmpresaAdmin) return err('No autorizado', 403);
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

async function informeSemanal(empresa_id, empresa_nombre, env) {
  try {
    // Rango: semana anterior completa (lunes–domingo)
    const hoy  = new Date();
    const dow   = hoy.getDay(); // 0=dom … 6=sáb
    const diasDesdeL = dow === 0 ? 6 : dow - 1;
    const lunesEsta  = new Date(hoy); lunesEsta.setDate(hoy.getDate() - diasDesdeL);
    const lunesAnt   = new Date(lunesEsta); lunesAnt.setDate(lunesEsta.getDate() - 7);
    const domAnt     = new Date(lunesAnt);  domAnt.setDate(lunesAnt.getDate() + 6);
    const desde = lunesAnt.toISOString().slice(0,10);
    const hasta = domAnt.toISOString().slice(0,10);

    // 1. Fichajes semana pasada
    const { results: fichajes } = await env.DB.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN hora_entrada IS NOT NULL AND hora_salida IS NOT NULL
                  THEN ROUND((julianday(fecha||' '||hora_salida) - julianday(fecha||' '||hora_entrada)) * 24, 1)
                  ELSE 0 END) as horas,
              SUM(CASE WHEN minutos_retraso > 0 THEN minutos_retraso ELSE 0 END) as min_retraso
       FROM fichajes WHERE empresa_id = ? AND fecha >= ? AND fecha <= ?`
    ).bind(empresa_id, desde, hasta).all();
    const fich = fichajes?.[0] || {};
    const horasTotStr = fich.horas ? `${fich.horas.toFixed(1)}h` : '0h';
    const retrasoStr  = fich.min_retraso ? ` (⏱ ${Math.round(fich.min_retraso)} min retraso acum.)` : '';

    // 2. Herramientas fuera (asignadas)
    const { results: herrFuera } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM herramientas WHERE empresa_id = ? AND estado = 'fuera'`
    ).bind(empresa_id).all();
    const nHerrFuera = herrFuera?.[0]?.total || 0;

    // 3. Equipos en mantenimiento/averiados
    const [pempMant, carrMant] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as total FROM pemp WHERE empresa_id = ? AND estado IN ('Mantenimiento','Averiada')`).bind(empresa_id).all(),
      env.DB.prepare(`SELECT COUNT(*) as total FROM carretillas WHERE empresa_id = ? AND estado IN ('Mantenimiento','Averiada')`).bind(empresa_id).all(),
    ]);
    const nEquiposMant = (pempMant.results?.[0]?.total || 0) + (carrMant.results?.[0]?.total || 0);

    // 4. Incidencias abiertas
    const { results: incAb } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM incidencias WHERE empresa_id = ? AND estado != 'resuelta'`
    ).bind(empresa_id).all();
    const nIncAb = incAb?.[0]?.total || 0;

    // 5. Pedidos pendientes
    const { results: pedPend } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM pedidos WHERE empresa_id = ? AND estado = 'pendiente'`
    ).bind(empresa_id).all();
    const nPedPend = pedPend?.[0]?.total || 0;

    // 6. Stock bajo (bobinas + tipos_cable + tipos_herramienta + inventario_seg)
    let stockBajo = 0;
    try {
      const [sc, sh, ss] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as c FROM tipos_cable tc
          JOIN bobinas b ON b.tipo_cable = tc.nombre AND b.empresa_id = ?
          WHERE tc.stock_minimo > 0 GROUP BY tc.id HAVING COUNT(b.codigo) < tc.stock_minimo`).bind(empresa_id).all(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM tipos_herramienta th
          WHERE th.empresa_id = ? AND th.stock_minimo > 0
          AND (SELECT COUNT(*) FROM herramientas h WHERE h.tipo_id = th.id AND h.empresa_id = ? AND h.estado = 'disponible') < th.stock_minimo`).bind(empresa_id, empresa_id).all(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM inventario_seg WHERE empresa_id = ? AND stock_minimo > 0 AND cantidad_disponible < stock_minimo AND estado != 'baja'`).bind(empresa_id).all(),
      ]);
      stockBajo = (sc.results?.length || 0) + (sh.results?.length || 0) + (ss.results?.[0]?.c || 0);
    } catch {}

    // Composición del mensaje
    const semStr = `${desde} al ${hasta}`;
    let msg = `📊 <b>Informe semanal — ${empresa_nombre}</b>\n`;
    msg += `<i>Semana: ${semStr}</i>\n\n`;
    msg += `👷 <b>Fichajes:</b> ${fich.total || 0} registros · ${horasTotStr}${retrasoStr}\n`;
    msg += `🔧 <b>Equipos sin servicio:</b> ${nEquiposMant}\n`;
    msg += `🛠 <b>Herramientas fuera:</b> ${nHerrFuera}\n`;
    msg += `📦 <b>Pedidos pendientes:</b> ${nPedPend}\n`;
    msg += `🚨 <b>Incidencias abiertas:</b> ${nIncAb}\n`;
    if (stockBajo > 0) msg += `⚠️ <b>Alertas de stock bajo:</b> ${stockBajo}\n`;
    msg += `\n_Generado automáticamente por Alejandra App_`;

    await sendTelegram(env, msg);
  } catch(e) {
    console.error('informeSemanal error:', e.message);
  }
}

async function alertasDiarias(env) {
  try {
    const hoy = new Date();

    // 0-prev. Limpiar tokens caducados (reset_tokens y vincular_tokens)
    try {
      await env.DB.prepare("DELETE FROM reset_tokens WHERE expires_at < datetime('now')").run();
      await env.DB.prepare("DELETE FROM vincular_tokens WHERE expires_at < datetime('now')").run();
    } catch(e) { console.error('cleanup tokens error:', e.message); }

    // 0. Informe semanal — para cada empresa que lo tenga activado en el día de hoy
    const DIAS_ES = { 'lunes':1,'martes':2,'miércoles':3,'miercoles':3,'jueves':4,'viernes':5,'sábado':6,'sabado':6,'domingo':0 };
    const dowHoy  = hoy.getDay(); // 0=dom … 6=sáb
    try {
      const { results: empresasInf } = await env.DB.prepare(
        `SELECT id, nombre, informe_dia FROM empresas WHERE informe_semanal = 1 AND activa = 1`
      ).all();
      for (const emp of (empresasInf || [])) {
        const diaNum = DIAS_ES[( emp.informe_dia || 'lunes').toLowerCase()] ?? 1;
        if (diaNum === dowHoy) {
          await informeSemanal(emp.id, emp.nombre, env);
        }
      }
    } catch(e) { console.error('informeSemanal check error:', e.message); }

    // UX-06: obtener todas las empresas activas para filtrar alertas por empresa
    // (antes las queries mezclaban datos de TODAS las empresas sin indicar cuál)
    const { results: empresasActivas } = await env.DB.prepare(
      `SELECT id, nombre FROM empresas WHERE activa = 1`
    ).all().catch(() => ({ results: [] }));
    const empMap = {};
    for (const e of (empresasActivas || [])) empMap[e.id] = e.nombre;
    const empLabel = (eid) => empMap[eid] ? ` [${empMap[eid]}]` : '';

    // 1. Máquinas averiadas hace más de 3 días sin reparar
    const [avPemp, avCarr] = await Promise.all([
      env.DB.prepare(`SELECT matricula, fecha_averia, obra_id, empresa_id FROM pemp WHERE estado = 'Averiada' AND fecha_averia IS NOT NULL`).all(),
      env.DB.prepare(`SELECT matricula, fecha_averia, obra_id, empresa_id FROM carretillas WHERE estado = 'Averiada' AND fecha_averia IS NOT NULL`).all(),
    ]);

    const DIAS_AVERIA = 3;
    const averiadas = [];
    for (const m of [...(avPemp.results||[]), ...(avCarr.results||[])]) {
      const dias = Math.floor((hoy - new Date(m.fecha_averia)) / 86400000);
      if (dias >= DIAS_AVERIA) averiadas.push(`🔖 ${m.matricula}${empLabel(m.empresa_id)} — ${dias} días averiada`);
    }
    if (averiadas.length) {
      await sendTelegram(env,
        `⚠️ <b>Máquinas averiadas sin reparar (≥${DIAS_AVERIA} días)</b>\n\n` + averiadas.join('\n')
      );
    }

    // 2. Revisiones próximas — usa dias_aviso_mant por equipo (default 15) cuando aviso_mantenimiento=1
    const DIAS_AVISO_DEFAULT = 15;
    const maxLimite = new Date(hoy); maxLimite.setDate(maxLimite.getDate() + 365); // ventana amplia
    const maxLimiteStr = maxLimite.toISOString().slice(0, 10);

    const [revPemp, revCarr] = await Promise.all([
      env.DB.prepare(`SELECT matricula, fecha_proxima_revision, aviso_mantenimiento, dias_aviso_mant, empresa_id FROM pemp WHERE fecha_proxima_revision IS NOT NULL AND fecha_proxima_revision != '' AND fecha_proxima_revision <= ?`).bind(maxLimiteStr).all(),
      env.DB.prepare(`SELECT matricula, fecha_proxima_revision, aviso_mantenimiento, dias_aviso_mant, empresa_id FROM carretillas WHERE fecha_proxima_revision IS NOT NULL AND fecha_proxima_revision != '' AND fecha_proxima_revision <= ?`).bind(maxLimiteStr).all(),
    ]);

    const revisiones = [];
    for (const m of [...(revPemp.results||[]), ...(revCarr.results||[])]) {
      const aviso = m.aviso_mantenimiento !== undefined ? m.aviso_mantenimiento : 1;
      if (!aviso) continue;
      const diasAviso = m.dias_aviso_mant || DIAS_AVISO_DEFAULT;
      const dias = Math.floor((new Date(m.fecha_proxima_revision) - hoy) / 86400000);
      if (dias < 0) revisiones.push(`🔖 ${m.matricula}${empLabel(m.empresa_id)} — VENCIDA hace ${Math.abs(dias)} días`);
      else if (dias <= diasAviso) revisiones.push(`🔖 ${m.matricula}${empLabel(m.empresa_id)} — vence en ${dias} días (${m.fecha_proxima_revision})`);
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
      `SELECT tipo_material, codigo, nombre, fecha_caducidad, empresa_id FROM inventario_seg
       WHERE fecha_caducidad IS NOT NULL AND fecha_caducidad != '' AND fecha_caducidad <= ? AND estado != 'baja'`
    ).bind(limiteCadStr).all();
    if (matCad.results?.length) {
      const lineas = matCad.results.map(m => {
        const dias = Math.floor((new Date(m.fecha_caducidad) - hoy) / 86400000);
        return dias < 0
          ? `⛔ ${m.codigo||m.nombre} (${m.tipo_material})${empLabel(m.empresa_id)} — CADUCADO hace ${Math.abs(dias)} días`
          : `⚠️ ${m.codigo||m.nombre} (${m.tipo_material})${empLabel(m.empresa_id)} — caduca en ${dias} días (${m.fecha_caducidad})`;
      });
      await sendTelegram(env, `🏷️ <b>Material Seguridad — Caducidad próxima</b>\n\n` + lineas.join('\n'));
    }

    // 4. Carnets y certificaciones — caducidad próxima o vencida
    const carnetsCad = await env.DB.prepare(
      `SELECT c.nombre_trabajador, c.tipo, c.fecha_caducidad, c.dias_aviso, c.usuario_id,
              c.empresa_id, u.telegram_id
       FROM carnets c LEFT JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.fecha_caducidad IS NOT NULL AND c.fecha_caducidad != '' AND c.estado = 'vigente'`
    ).all();
    const carnetAlertas = [];
    for (const c of (carnetsCad.results || [])) {
      const dias = Math.floor((new Date(c.fecha_caducidad) - hoy) / 86400000);
      const aviso = c.dias_aviso || 30;
      let linea = null;
      if (dias < 0) linea = `⛔ ${c.nombre_trabajador}${empLabel(c.empresa_id)} — ${c.tipo} CADUCADO hace ${Math.abs(dias)} días`;
      else if (dias <= aviso) linea = `⚠️ ${c.nombre_trabajador}${empLabel(c.empresa_id)} — ${c.tipo} caduca en ${dias} días (${c.fecha_caducidad})`;
      if (linea) {
        carnetAlertas.push(linea);
        // Notificación personal al trabajador si tiene Telegram vinculado
        if (c.telegram_id) {
          const msg = dias < 0
            ? `📜 <b>Tu carnet ha caducado</b>\n\nTipo: ${c.tipo}\nCaducó: ${c.fecha_caducidad}\n\n⚠️ Renuévalo lo antes posible.`
            : `📜 <b>Tu carnet caduca pronto</b>\n\nTipo: ${c.tipo}\nCaduca: ${c.fecha_caducidad} (<b>${dias} días</b>)\n\nRecuerda renovarlo a tiempo.`;
          await sendTelegramToChat(env, c.telegram_id, msg);
        }
      }
    }
    if (carnetAlertas.length) {
      await sendTelegram(env, `📜 <b>Carnets y certificaciones — Caducidad próxima</b>\n\n` + carnetAlertas.join('\n'));
    }

    // 5. Eventos del calendario — hoy + recordatorios previos
    const hoyStr = hoy.toISOString().slice(0, 10);
    const { results: eventosHoy } = await env.DB.prepare(
      `SELECT e.titulo, e.hora, e.tipo, o.nombre as obra_nombre
       FROM eventos_calendario e LEFT JOIN obras o ON e.obra_id = o.id
       WHERE e.fecha = ? ORDER BY e.hora ASC`
    ).bind(hoyStr).all();
    if (eventosHoy.length) {
      const tipoIcon = { entrega:'📦', revision:'🔧', reunion:'👥', otro:'📅' };
      const lineas = eventosHoy.map(ev =>
        `${tipoIcon[ev.tipo]||'📅'} ${ev.titulo}${ev.hora ? ' — ' + ev.hora : ''}${ev.obra_nombre ? ' [' + ev.obra_nombre + ']' : ''}`
      );
      await sendTelegram(env, `📅 <b>Eventos de hoy (${hoyStr})</b>\n\n` + lineas.join('\n'));
    }
    // Recordatorios anticipados (recordatorio_dias > 0)
    const { results: recordatorios } = await env.DB.prepare(`
      SELECT e.titulo, e.fecha, e.hora, e.tipo, e.recordatorio_dias, o.nombre as obra_nombre
      FROM eventos_calendario e LEFT JOIN obras o ON e.obra_id = o.id
      WHERE e.recordatorio_dias > 0 AND e.fecha > ?
    `).bind(hoyStr).all();
    for (const ev of recordatorios) {
      const diasFaltan = Math.floor((new Date(ev.fecha) - hoy) / 86400000);
      if (diasFaltan === ev.recordatorio_dias) {
        const tipoIcon = { entrega:'📦', revision:'🔧', reunion:'👥', otro:'📅' };
        await sendTelegram(env,
          `⏰ <b>Recordatorio — faltan ${diasFaltan} día${diasFaltan===1?'':'s'}</b>\n${tipoIcon[ev.tipo]||'📅'} ${ev.titulo} (${ev.fecha}${ev.hora ? ' ' + ev.hora : ''})${ev.obra_nombre ? '\n🏗 ' + ev.obra_nombre : ''}`
        );
      }
    }

    // RGPD — aplicar retención automática a todas las empresas que la tengan activa
    try {
      const { results: empresasRgpd } = await env.DB.prepare(
        `SELECT id FROM empresas WHERE activa=1 AND retencion_config IS NOT NULL`
      ).all().catch(() => ({ results: [] }));
      for (const emp of (empresasRgpd || [])) {
        await rgpdAplicarRetencion(env, emp.id);
      }
    } catch(e) { console.error('rgpd retencion cron error:', e.message); }

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
      return json({ ok: true, token, nombre: gUser.name || gUser.email, rol: inv.rol, departamento: inv.departamento || null, empresa_id: inv.empresa_id, empresa_nombre: empresa?.nombre || '', obra_id: null, obra_nombre: null, usuario_id: nuevoUser?.id || null });
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
    usuario_id:     u.id,
  });
}

async function crearInvitacion(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','empresa_admin'].includes(s.rol)) return err('Sin permiso', 403);
  const { duracion_min, rol, departamento } = await request.json().catch(() => ({}));
  if (!duracion_min || !rol) return err('Faltan datos', 400);
  const codigo = randomHex(6).toUpperCase(); // 12 chars hex criptográficamente seguro
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

// ── Calendario (NEW-13) ───────────────────────────────────────────────────────

async function getFestivos(request, env) {
  const url  = new URL(request.url);
  const year = url.searchParams.get('year') || new Date().getFullYear();
  const com  = (url.searchParams.get('comunidad') || 'MD').toUpperCase();
  try {
    const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/ES`);
    if (!res.ok) return json([]);
    const all = await res.json();
    const filtered = all.filter(h => !h.counties || h.counties.includes(`ES-${com}`));
    return json(filtered.map(h => ({ date: h.date, name: h.localName, global: !h.counties })));
  } catch { return json([]); }
}

async function getEventos(request, env) {
  const { empresa_id, departamento, obra_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  let sql = 'SELECT e.*, o.nombre as obra_nombre FROM eventos_calendario e LEFT JOIN obras o ON e.obra_id = o.id WHERE e.empresa_id = ?';
  const params = [empresa_id];
  const dept = url.searchParams.get('departamento') || departamento;
  if (dept) { sql += ' AND e.departamento = ?'; params.push(dept); }
  const qObraId = url.searchParams.get('obra_id') || obra_id;
  if (qObraId) { sql += ' AND (e.obra_id = ? OR e.obra_id IS NULL)'; params.push(parseInt(qObraId)); }
  const desde = url.searchParams.get('desde');
  const hasta = url.searchParams.get('hasta');
  if (desde) { sql += ' AND e.fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND e.fecha <= ?'; params.push(hasta); }
  sql += ' ORDER BY e.fecha ASC, e.hora ASC';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearEvento(request, env) {
  const { empresa_id, obra_id, departamento, nombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { titulo, descripcion, tipo = 'otro', fecha, hora, recordatorio_dias = 1 } = body;
  if (!titulo?.trim()) return err('El título es obligatorio', 400);
  if (!fecha) return err('La fecha es obligatoria', 400);
  const dept     = body.departamento || departamento || 'electrico';
  const obraFinal = body.obra_id || obra_id || null;
  const r = await env.DB.prepare(
    'INSERT INTO eventos_calendario (empresa_id, obra_id, departamento, titulo, descripcion, tipo, fecha, hora, recordatorio_dias, creado_por) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obraFinal, dept, titulo.trim(), descripcion || null, tipo, fecha, hora || null, parseInt(recordatorio_dias) || 0, nombre || null).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarEvento(id, request, env) {
  const { empresa_id, nombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const ev = await env.DB.prepare('SELECT * FROM eventos_calendario WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!ev) return err('Evento no encontrado', 404);
  const puedeEditar = rol === 'encargado' || rol === 'empresa_admin' || rol === 'superadmin' || ev.creado_por === nombre;
  if (!puedeEditar) return err('Sin permisos', 403);
  const campos = [], vals = [];
  if (body.titulo)       { campos.push('titulo=?');       vals.push(body.titulo.trim()); }
  if (body.descripcion !== undefined) { campos.push('descripcion=?'); vals.push(body.descripcion || null); }
  if (body.tipo)         { campos.push('tipo=?');         vals.push(body.tipo); }
  if (body.fecha)        { campos.push('fecha=?');        vals.push(body.fecha); }
  if (body.hora !== undefined) { campos.push('hora=?');   vals.push(body.hora || null); }
  if (body.recordatorio_dias !== undefined) { campos.push('recordatorio_dias=?'); vals.push(parseInt(body.recordatorio_dias) || 0); }
  if (!campos.length) return json({ ok: true });
  vals.push(id, empresa_id);
  await env.DB.prepare(`UPDATE eventos_calendario SET ${campos.join(',')} WHERE id=? AND empresa_id=?`).bind(...vals).run();
  return json({ ok: true });
}

async function eliminarEvento(id, request, env) {
  const { empresa_id, nombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const ev = await env.DB.prepare('SELECT * FROM eventos_calendario WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!ev) return err('Evento no encontrado', 404);
  const puedeEliminar = rol === 'encargado' || rol === 'empresa_admin' || rol === 'superadmin' || ev.creado_por === nombre;
  if (!puedeEliminar) return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM eventos_calendario WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Incidencias (NEW-22) ──────────────────────────────────────────────────────

async function getIncidencias(request, env) {
  const auth = await getAuth(request, env);
  const { empresa_id, departamento, isSuperadmin, isEmpresaAdmin, isJefeObra, isDesarrollador } = auth;
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  let sql = 'SELECT i.*, o.nombre as obra_nombre FROM incidencias i LEFT JOIN obras o ON i.obra_id = o.id WHERE i.empresa_id = ?';
  const params = [empresa_id];
  // sin_dept=1 → admins/jefes pueden ver todas las incidencias sin filtrar por dept
  const sinDept = url.searchParams.get('sin_dept') === '1' && (isSuperadmin || isEmpresaAdmin || isJefeObra || isDesarrollador);
  if (!sinDept) {
    const dept = url.searchParams.get('departamento') || departamento;
    if (dept) { sql += ' AND i.departamento = ?'; params.push(dept); }
  }
  const estado = url.searchParams.get('estado');
  if (estado) { sql += ' AND i.estado = ?'; params.push(estado); }
  const obra_id = url.searchParams.get('obra_id');
  if (obra_id) { sql += ' AND i.obra_id = ?'; params.push(parseInt(obra_id)); }
  sql += ' ORDER BY i.created_at DESC LIMIT 500';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearIncidencia(request, env, ctx) {
  const auth = await getAuth(request, env);
  const { empresa_id, obra_id, departamento, nombre } = auth;
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { titulo, descripcion, tipo = 'otro', gravedad = 'media', asignado_a, fecha } = body;
  if (!titulo?.trim()) return err('El título es obligatorio', 400);
  const dept = body.departamento || departamento || 'electrico';
  const obraFinal = body.obra_id || obra_id || null;
  const fechaFinal = fecha || new Date().toISOString().slice(0, 10);
  const r = await env.DB.prepare(
    'INSERT INTO incidencias (empresa_id, obra_id, departamento, titulo, descripcion, tipo, gravedad, estado, reportado_por, asignado_a, fecha) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obraFinal, dept, titulo.trim(), descripcion || null, tipo, gravedad, 'abierta', nombre || null, asignado_a || null, fechaFinal).run();
  if (gravedad === 'alta') {
    const gravedadIcon = { baja: '🟢', media: '🟠', alta: '🔴' };
    await sendTelegram(env, `${gravedadIcon[gravedad]} <b>Incidencia ALTA [${dept}]</b>\n📋 ${titulo.trim()}\n${descripcion ? '📝 ' + descripcion.slice(0,200) + '\n' : ''}👤 ${nombre || '—'}`);
  }
  ctx?.waitUntil(syncRRHH(env, 'Incidencias', empresa_id));
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function actualizarIncidencia(id, request, env, ctx) {
  const { empresa_id, nombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const puedeGestionar = rol === 'encargado' || rol === 'empresa_admin' || rol === 'superadmin';
  const body = await request.json().catch(() => ({}));
  const inc = await env.DB.prepare('SELECT * FROM incidencias WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!inc) return err('Incidencia no encontrada', 404);
  // Solo admins/encargados pueden cambiar estado/asignación/resolución
  if ((body.estado || body.asignado_a !== undefined || body.resolucion !== undefined) && !puedeGestionar)
    return err('Sin permisos', 403);
  const campos = [], vals = [];
  if (body.titulo)       { campos.push('titulo=?');       vals.push(body.titulo.trim()); }
  if (body.descripcion !== undefined) { campos.push('descripcion=?'); vals.push(body.descripcion || null); }
  if (body.tipo)         { campos.push('tipo=?');         vals.push(body.tipo); }
  if (body.gravedad)     { campos.push('gravedad=?');     vals.push(body.gravedad); }
  if (body.estado)       { campos.push('estado=?');       vals.push(body.estado); }
  if (body.asignado_a !== undefined) { campos.push('asignado_a=?'); vals.push(body.asignado_a || null); }
  if (body.resolucion !== undefined) { campos.push('resolucion=?'); vals.push(body.resolucion || null); }
  if (!campos.length) return json({ ok: true });
  vals.push(id, empresa_id);
  await env.DB.prepare(`UPDATE incidencias SET ${campos.join(',')} WHERE id=? AND empresa_id=?`).bind(...vals).run();
  // Telegram al resolver
  if (body.estado === 'resuelta') {
    await sendTelegram(env, `✅ <b>Incidencia resuelta [${inc.departamento}]</b>\n📋 ${inc.titulo}\n${body.resolucion ? '📝 ' + body.resolucion.slice(0,200) : ''}`);
  }
  ctx?.waitUntil(syncRRHH(env, 'Incidencias', empresa_id));
  return json({ ok: true });
}

async function eliminarIncidencia(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol !== 'superadmin' && rol !== 'empresa_admin' && rol !== 'encargado') return err('Sin permisos', 403);
  // Borrar fotos de R2 primero
  const { results: fotos } = await env.DB.prepare('SELECT r2_key FROM incidencia_fotos WHERE incidencia_id = ? AND empresa_id = ?').bind(id, empresa_id).all();
  await Promise.all(fotos.map(f => env.FILES.delete(f.r2_key)));
  await env.DB.prepare('DELETE FROM incidencia_fotos WHERE incidencia_id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  await env.DB.prepare('DELETE FROM incidencias WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

async function getIncidenciaFotos(incidencia_id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const { results } = await env.DB.prepare(
    'SELECT * FROM incidencia_fotos WHERE empresa_id = ? AND incidencia_id = ? ORDER BY created_at ASC'
  ).bind(empresa_id, incidencia_id).all();
  return json(results);
}

async function subirFotoIncidencia(incidencia_id, request, env) {
  const { empresa_id, nombre: userNombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta el formulario', 400);
  const file = form.get('file');
  if (!file || !file.name) return err('Falta el archivo', 400);
  if (file.size > 20971520) return err('El archivo supera 20 MB', 413);
  const mime = file.type || 'image/jpeg';
  const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
  if (!allowed.includes(mime)) return err('Solo se permiten imágenes', 400);
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `e${empresa_id}/incidencias/${incidencia_id}/${ts}_${safeName}`;
  await env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: mime } });
  const r = await env.DB.prepare(
    'INSERT INTO incidencia_fotos (empresa_id, incidencia_id, r2_key, nombre_archivo, mime_type, subido_por) VALUES (?,?,?,?,?,?)'
  ).bind(empresa_id, incidencia_id, r2Key, file.name, mime, userNombre || rol).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function getFotoIncidencia(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare('SELECT * FROM incidencia_fotos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Foto no encontrada', 404);
  const obj = await env.FILES.get(meta.r2_key);
  if (!obj) return err('Archivo no disponible', 404);
  return new Response(obj.body, {
    headers: { 'Content-Type': meta.mime_type || 'image/jpeg', 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=3600', ...CORS }
  });
}

async function borrarFotoIncidencia(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare('SELECT * FROM incidencia_fotos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Foto no encontrada', 404);
  await env.FILES.delete(meta.r2_key);
  await env.DB.prepare('DELETE FROM incidencia_fotos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ── Albaranes de pedidos (NEW-25) ─────────────────────────────────────────────

async function getAlbaranesPedido(pedido_id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const { results } = await env.DB.prepare(
    'SELECT * FROM albaranes WHERE empresa_id = ? AND pedido_id = ? ORDER BY created_at ASC'
  ).bind(empresa_id, pedido_id).all();
  return json(results);
}

async function subirAlbaranPedido(pedido_id, request, env) {
  const { empresa_id, nombre: userNombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta el formulario', 400);
  const file = form.get('file');
  if (!file || !file.name) return err('Falta el archivo', 400);
  if (file.size > 20971520) return err('El archivo supera el límite de 20 MB', 413);
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
  const mime = file.type || 'application/octet-stream';
  if (!allowedMimes.includes(mime)) return err('Tipo de archivo no permitido', 400);
  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `e${empresa_id}/albaranes/${pedido_id}/${ts}_${safeName}`;
  await env.FILES.put(r2Key, file.stream(), {
    httpMetadata: { contentType: mime }
  });
  const fecha = new Date().toISOString().slice(0, 10);
  const r = await env.DB.prepare(
    'INSERT INTO albaranes (empresa_id, pedido_id, r2_key, nombre_archivo, mime_type, subido_por, fecha) VALUES (?,?,?,?,?,?,?)'
  ).bind(empresa_id, pedido_id, r2Key, file.name, mime, userNombre || rol, fecha).run();
  return json({ ok: true, id: r.meta.last_row_id, nombre_archivo: file.name, mime_type: mime }, 201);
}

async function getAlbaranFile(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare(
    'SELECT * FROM albaranes WHERE id = ? AND empresa_id = ?'
  ).bind(id, empresa_id).first();
  if (!meta) return err('Albarán no encontrado', 404);
  const obj = await env.FILES.get(meta.r2_key);
  if (!obj) return err('Archivo no disponible', 404);
  const inline = meta.mime_type?.startsWith('image/') || meta.mime_type === 'application/pdf';
  return new Response(obj.body, {
    headers: {
      'Content-Type': meta.mime_type || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(meta.nombre_archivo)}"`,
      'Cache-Control': 'private, max-age=3600',
      ...CORS,
    },
  });
}

async function borrarAlbaran(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare(
    'SELECT * FROM albaranes WHERE id = ? AND empresa_id = ?'
  ).bind(id, empresa_id).first();
  if (!meta) return err('Albarán no encontrado', 404);
  await env.FILES.delete(meta.r2_key);
  await env.DB.prepare('DELETE FROM albaranes WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
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
  const parent_id = url.searchParams.get('parent_id');
  let q, params;
  if (parent_id !== null && parent_id !== '') {
    q = 'SELECT * FROM carpetas WHERE empresa_id = ? AND obra_id = ? AND departamento = ? AND parent_id = ? ORDER BY nombre COLLATE NOCASE';
    params = [empresa_id, parseInt(obra_id), departamento, parseInt(parent_id)];
  } else {
    q = 'SELECT * FROM carpetas WHERE empresa_id = ? AND obra_id = ? AND departamento = ? AND (parent_id IS NULL OR parent_id = 0) ORDER BY nombre COLLATE NOCASE';
    params = [empresa_id, parseInt(obra_id), departamento];
  }
  const { results } = await env.DB.prepare(q).bind(...params).all();
  return json(results);
}

async function crearCarpeta(request, env) {
  const { empresa_id, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const { obra_id, departamento, nombre, parent_id } = await request.json().catch(() => ({}));
  if (!obra_id || !departamento || !nombre?.trim()) return err('Faltan datos', 400);
  const existe = await env.DB.prepare(
    'SELECT id FROM carpetas WHERE empresa_id = ? AND obra_id = ? AND departamento = ? AND UPPER(nombre) = UPPER(?) AND (parent_id IS NULL OR parent_id = 0)'
  ).bind(empresa_id, parseInt(obra_id), departamento, nombre.trim()).first();
  if (existe) return err('Ya existe una carpeta con ese nombre', 409);
  const r = await env.DB.prepare(
    'INSERT INTO carpetas (empresa_id, obra_id, departamento, nombre, creado_por, parent_id) VALUES (?,?,?,?,?,?)'
  ).bind(empresa_id, parseInt(obra_id), departamento, nombre.trim(), userNombre || rol, parent_id ? parseInt(parent_id) : null).run();
  return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim() }, 201);
}

async function borrarCarpeta(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const carpeta = await env.DB.prepare('SELECT * FROM carpetas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!carpeta) return err('Carpeta no encontrada', 404);
  await borrarCarpetaRecursive(id, empresa_id, env);
  return json({ ok: true });
}

async function listarDocsDept(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url = new URL(request.url);
  const carpeta_id  = url.searchParams.get('carpeta_id');
  const obra_id_p   = url.searchParams.get('obra_id');
  const dept_p      = url.searchParams.get('departamento');
  if (carpeta_id) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM docs_dept WHERE carpeta_id = ? AND empresa_id = ? ORDER BY created_at DESC'
    ).bind(parseInt(carpeta_id), empresa_id).all();
    return json(results);
  }
  if (obra_id_p && dept_p) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM docs_dept WHERE obra_id = ? AND departamento = ? AND carpeta_id IS NULL AND empresa_id = ? ORDER BY created_at DESC'
    ).bind(parseInt(obra_id_p), dept_p, empresa_id).all();
    return json(results);
  }
  return err('Falta carpeta_id o (obra_id + departamento)', 400);
}

async function subirDocDept(request, env) {
  const { empresa_id, rol, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta el formulario', 400);
  const file        = form.get('file');
  const carpeta_id  = form.get('carpeta_id') || null;
  const descripcion = form.get('descripcion') || null;
  const obra_id_f   = form.get('obra_id');
  const dept_f      = form.get('departamento');
  if (!file || !file.name) return err('Falta el archivo', 400);
  if (file.size > 52428800) return err('El archivo supera el límite de 50 MB', 413);
  let obraId, deptName;
  if (carpeta_id) {
    const carpeta = await env.DB.prepare('SELECT * FROM carpetas WHERE id = ? AND empresa_id = ?').bind(parseInt(carpeta_id), empresa_id).first();
    if (!carpeta) return err('Carpeta no encontrada', 404);
    obraId = carpeta.obra_id; deptName = carpeta.departamento;
  } else {
    if (!obra_id_f || !dept_f) return err('Falta carpeta_id o (obra_id + departamento)', 400);
    obraId = parseInt(obra_id_f); deptName = dept_f;
  }
  const ts       = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key    = `e${empresa_id}/dept/${deptName}/${obraId}/${carpeta_id || 'root'}/${ts}_${safeName}`;
  await env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  const r = await env.DB.prepare(
    'INSERT INTO docs_dept (empresa_id, obra_id, departamento, carpeta_id, r2_key, nombre, mime, tamano, descripcion, subido_por) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obraId, deptName, carpeta_id ? parseInt(carpeta_id) : null, r2Key, file.name,
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

async function editarDocDept(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const meta = await env.DB.prepare('SELECT id FROM docs_dept WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Documento no encontrado', 404);

  const sets = [], params = [];

  if (body.nombre !== undefined) {
    if (!body.nombre?.trim()) return err('El nombre es obligatorio', 400);
    sets.push('nombre = ?', 'descripcion = ?');
    params.push(body.nombre.trim(), body.descripcion?.trim() || null);
  }

  if (body.carpeta_id !== undefined) {
    const nuevaId = body.carpeta_id ? parseInt(body.carpeta_id) : null;
    if (nuevaId) {
      const dest = await env.DB.prepare('SELECT id FROM carpetas WHERE id = ? AND empresa_id = ?').bind(nuevaId, empresa_id).first();
      if (!dest) return err('Carpeta destino no encontrada', 404);
    }
    sets.push('carpeta_id = ?');
    params.push(nuevaId);
  }

  if (!sets.length) return json({ ok: true });
  params.push(id, empresa_id);
  await env.DB.prepare(`UPDATE docs_dept SET ${sets.join(', ')} WHERE id = ? AND empresa_id = ?`)
    .bind(...params).run();
  return json({ ok: true });
}

// ── Renombrar carpeta ─────────────────────────────────────────────────────────
async function renombrarCarpeta(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const { nombre } = await request.json().catch(() => ({}));
  if (!nombre?.trim()) return err('El nombre es obligatorio', 400);
  const carpeta = await env.DB.prepare('SELECT id FROM carpetas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!carpeta) return err('Carpeta no encontrada', 404);
  await env.DB.prepare('UPDATE carpetas SET nombre = ? WHERE id = ? AND empresa_id = ?').bind(nombre.trim(), id, empresa_id).run();
  return json({ ok: true });
}

// ── Borrar carpeta de forma recursiva (helper) ────────────────────────────────
async function borrarCarpetaRecursive(id, empresa_id, env) {
  const { results: docs } = await env.DB.prepare('SELECT r2_key FROM docs_dept WHERE carpeta_id = ? AND empresa_id = ?').bind(id, empresa_id).all();
  await Promise.all(docs.map(d => env.FILES.delete(d.r2_key)));
  await env.DB.prepare('DELETE FROM docs_dept  WHERE carpeta_id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  await env.DB.prepare('DELETE FROM docs_notas WHERE carpeta_id = ? AND empresa_id = ?').bind(id, empresa_id).run().catch(() => {});
  const { results: subs } = await env.DB.prepare('SELECT id FROM carpetas WHERE parent_id = ? AND empresa_id = ?').bind(id, empresa_id).all().catch(() => ({ results: [] }));
  for (const sub of subs) await borrarCarpetaRecursive(sub.id, empresa_id, env);
  await env.DB.prepare('DELETE FROM carpetas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
}

// ── Notas de texto (docs_notas) ───────────────────────────────────────────────
async function listarNotas(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url        = new URL(request.url);
  const carpeta_id = url.searchParams.get('carpeta_id');
  const obra_id_p  = url.searchParams.get('obra_id');
  const dept_p     = url.searchParams.get('departamento');
  if (carpeta_id) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM docs_notas WHERE carpeta_id = ? AND empresa_id = ? ORDER BY created_at DESC'
    ).bind(parseInt(carpeta_id), empresa_id).all();
    return json(results);
  }
  if (obra_id_p && dept_p) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM docs_notas WHERE obra_id = ? AND departamento = ? AND carpeta_id IS NULL AND empresa_id = ? ORDER BY created_at DESC'
    ).bind(parseInt(obra_id_p), dept_p, empresa_id).all();
    return json(results);
  }
  return err('Faltan parámetros', 400);
}

async function crearNota(request, env) {
  const { empresa_id, rol, obraId, departamento, nombre: userNombre } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const { titulo, contenido, carpeta_id, obra_id, departamento: dept_param } = await request.json().catch(() => ({}));
  if (!titulo?.trim()) return err('El título es obligatorio', 400);
  let obraIdFinal = parseInt(obra_id || obraId || 0) || null;
  let deptFinal   = dept_param || departamento || null;
  if (carpeta_id) {
    const cp = await env.DB.prepare('SELECT obra_id, departamento FROM carpetas WHERE id = ? AND empresa_id = ?').bind(parseInt(carpeta_id), empresa_id).first();
    if (cp) { obraIdFinal = cp.obra_id; deptFinal = cp.departamento; }
  }
  const r = await env.DB.prepare(
    'INSERT INTO docs_notas (empresa_id, obra_id, departamento, carpeta_id, titulo, contenido, creado_por, updated_at) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obraIdFinal, deptFinal, carpeta_id ? parseInt(carpeta_id) : null,
    titulo.trim(), contenido || '', userNombre || rol, AHORA()).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function editarNota(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const { titulo, contenido } = await request.json().catch(() => ({}));
  if (!titulo?.trim()) return err('El título es obligatorio', 400);
  const nota = await env.DB.prepare('SELECT id FROM docs_notas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!nota) return err('Nota no encontrada', 404);
  await env.DB.prepare('UPDATE docs_notas SET titulo = ?, contenido = ?, updated_at = ? WHERE id = ? AND empresa_id = ?')
    .bind(titulo.trim(), contenido || '', AHORA(), id, empresa_id).run();
  return json({ ok: true });
}

async function borrarNota(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM docs_notas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// TURNOS (NEW-20)
// ════════════════════════════════════════════════════════════════════════════

async function getTurnos(request, env) {
  const { empresa_id, obra_id: obraAuth } = await getAuth(request, env);
  const url    = new URL(request.url);
  const desde  = url.searchParams.get('desde');
  const hasta  = url.searchParams.get('hasta');
  const obraQp = url.searchParams.get('obra_id');
  const obra   = obraQp ? parseInt(obraQp) : (obraAuth || null);

  let sql = 'SELECT * FROM turnos WHERE empresa_id = ?';
  const params = [empresa_id];
  if (desde) { sql += ' AND fecha >= ?'; params.push(desde); }
  if (hasta) { sql += ' AND fecha <= ?'; params.push(hasta); }
  if (obra)  { sql += ' AND obra_id = ?'; params.push(obra); }
  sql += ' ORDER BY fecha, nombre_trabajador';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results || []);
}

async function upsertTurno(request, env, ctx) {
  const auth = await getAuth(request, env);
  if (!auth.isAdmin && !auth.isSuperadmin && !auth.isEmpresaAdmin && !auth.isEncargado) return err('Sin permisos', 403);
  const { empresa_id } = auth;
  const body = await request.json().catch(() => ({}));
  const { usuario_id, externo_id, nombre_trabajador, fecha, turno, obra_id } = body;
  if (!fecha) return err('Falta fecha');
  const obra = obra_id ? parseInt(obra_id) : (auth.obra_id || null);

  // Sin turno → eliminar
  if (!turno) {
    if (usuario_id)  await env.DB.prepare('DELETE FROM turnos WHERE empresa_id=? AND usuario_id=? AND fecha=?').bind(empresa_id, usuario_id, fecha).run();
    if (externo_id)  await env.DB.prepare('DELETE FROM turnos WHERE empresa_id=? AND externo_id=? AND fecha=?').bind(empresa_id, externo_id, fecha).run();
    return json({ ok: true, accion: 'borrado' });
  }

  // Buscar existente
  let existing = null;
  if (usuario_id)  existing = await env.DB.prepare('SELECT id FROM turnos WHERE empresa_id=? AND usuario_id=? AND fecha=?').bind(empresa_id, usuario_id, fecha).first();
  else if (externo_id) existing = await env.DB.prepare('SELECT id FROM turnos WHERE empresa_id=? AND externo_id=? AND fecha=?').bind(empresa_id, externo_id, fecha).first();

  if (existing) {
    await env.DB.prepare('UPDATE turnos SET turno=?, obra_id=? WHERE id=?').bind(turno, obra, existing.id).run();
    ctx?.waitUntil(syncRRHH(env, 'Turnos', empresa_id));
    return json({ ok: true, id: existing.id, accion: 'actualizado' });
  }
  const r = await env.DB.prepare(
    'INSERT INTO turnos (empresa_id,obra_id,usuario_id,externo_id,nombre_trabajador,fecha,turno) VALUES (?,?,?,?,?,?,?)'
  ).bind(empresa_id, obra, usuario_id||null, externo_id||null, nombre_trabajador||null, fecha, turno).run();
  ctx?.waitUntil(syncRRHH(env, 'Turnos', empresa_id));
  return json({ ok: true, id: r.meta.last_row_id, accion: 'creado' }, 201);
}

async function eliminarTurno(id, request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isAdmin && !auth.isSuperadmin && !auth.isEmpresaAdmin && !auth.isEncargado) return err('Sin permisos', 403);
  await env.DB.prepare('DELETE FROM turnos WHERE id=? AND empresa_id=?').bind(id, auth.empresa_id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// BÚSQUEDA GLOBAL
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// RGPD / LOPD — Protección de datos
// ════════════════════════════════════════════════════════════════════════════

async function rgpdInforme(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isEmpresaAdmin && !auth.isSuperadmin) return err('Sin permisos', 403);
  const url = new URL(request.url);
  const uid = parseInt(url.searchParams.get('usuario_id'));
  if (!uid) return err('usuario_id requerido');

  const eid = auth.empresa_id;

  // Queries con columnas correctas según el esquema real de la BD
  const [usuario, fichajes, carnets, epis, turnos, chat] = await Promise.all([
    env.DB.prepare(`SELECT id,nombre,email,rol,departamento,activo,created_at FROM usuarios WHERE id=? AND empresa_id=?`).bind(uid,eid).first(),
    env.DB.prepare(`SELECT id,fecha,hora_entrada,hora_salida,horas_trabajadas,horas_extra,minutos_retraso,estado,motivo,obra_id,created_at FROM fichajes WHERE usuario_id=? AND empresa_id=? ORDER BY fecha DESC LIMIT 500`).bind(uid,eid).all(),
    env.DB.prepare(`SELECT id,tipo,numero,fecha_obtencion,fecha_caducidad,estado,notas,created_at FROM carnets WHERE usuario_id=? AND empresa_id=? ORDER BY created_at DESC`).bind(uid,eid).all(),
    env.DB.prepare(`SELECT id,tipo_epi,talla,numero_serie,fecha_entrega,fecha_caducidad,proxima_revision,estado,observaciones,created_at FROM epis_asignados WHERE usuario_id=? AND empresa_id=? ORDER BY created_at DESC`).bind(uid,eid).all(),
    env.DB.prepare(`SELECT id,fecha,turno,obra_id FROM turnos WHERE usuario_id=? AND empresa_id=? ORDER BY fecha DESC LIMIT 200`).bind(uid,eid).all(),
    env.DB.prepare(`SELECT id,mensaje,obra_id,created_at FROM chat_mensajes WHERE usuario_id=? AND empresa_id=? ORDER BY created_at DESC LIMIT 200`).bind(uid,eid).all(),
  ]);

  if (!usuario) return err('Usuario no encontrado en esta empresa', 404);

  const informe = {
    generado_el: new Date().toISOString(),
    empresa_id: eid,
    datos_personales: usuario,
    fichajes: fichajes.results,
    carnets: carnets.results,
    epis_asignados: epis.results,
    turnos: turnos.results,
    mensajes_chat: chat.results,
    // repostajes no se indexan por usuario_id (solo por nombre), no se incluyen en DSAR
  };

  return new Response(JSON.stringify(informe, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dsar_usuario_${uid}_${new Date().toISOString().slice(0,10)}.json"`,
      'Access-Control-Allow-Origin': '*',
    }
  });
}

async function rgpdAnonimizar(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isEmpresaAdmin && !auth.isSuperadmin) return err('Sin permisos', 403);
  const url = new URL(request.url);
  const uid = parseInt(url.searchParams.get('usuario_id'));
  if (!uid) return err('usuario_id requerido');

  const eid = auth.empresa_id;
  const usuario = await env.DB.prepare(`SELECT id,nombre,foto_r2_key FROM usuarios WHERE id=? AND empresa_id=?`).bind(uid,eid).first();
  if (!usuario) return err('Usuario no encontrado', 404);

  const tag = `anonimizado_${uid}`;

  await Promise.all([
    // Anonimizar datos personales del usuario
    env.DB.prepare(`UPDATE usuarios SET nombre='Usuario anonimizado', email=NULL, password_hash=NULL, telegram_id=NULL, foto_r2_key=NULL, activo=0 WHERE id=? AND empresa_id=?`).bind(uid,eid).run(),
    // Anonimizar nombre en mensajes de chat
    env.DB.prepare(`UPDATE chat_mensajes SET usuario_nombre='Trabajador anonimizado' WHERE usuario_id=? AND empresa_id=?`).bind(uid,eid).run(),
    // Anonimizar nombre en carnets y EPIs (RGPD — también son datos personales)
    env.DB.prepare(`UPDATE carnets SET nombre_trabajador='Trabajador anonimizado' WHERE usuario_id=? AND empresa_id=?`).bind(uid,eid).run().catch(()=>{}),
    env.DB.prepare(`UPDATE epis_asignados SET nombre_trabajador='Trabajador anonimizado' WHERE usuario_id=? AND empresa_id=?`).bind(uid,eid).run().catch(()=>{}),
    env.DB.prepare(`UPDATE turnos SET nombre_trabajador='Trabajador anonimizado' WHERE usuario_id=? AND empresa_id=?`).bind(uid,eid).run().catch(()=>{}),
    // Borrar sesiones activas
    env.DB.prepare(`DELETE FROM sesiones WHERE usuario_id=?`).bind(uid).run(),
    // Borrar tokens de reset
    env.DB.prepare(`DELETE FROM reset_tokens WHERE usuario_id=?`).bind(uid).run().catch(()=>{}),
  ]);

  // Borrar foto de R2 si existe
  if (usuario.foto_r2_key) {
    await env.FILES.delete(usuario.foto_r2_key).catch(() => {});
  }

  await registrarLog(null, env, {
    nivel: 'warn',
    mensaje: `RGPD: usuario ${uid} (${usuario.nombre}) anonimizado por admin ${auth.usuario_id}`,
    empresa_id: eid,
  }).catch(() => {});

  return json({ ok: true, mensaje: `Datos de "${usuario.nombre}" anonimizados correctamente` });
}

async function rgpdGetConfig(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isEmpresaAdmin && !auth.isSuperadmin) return err('Sin permisos', 403);

  const empresa = await env.DB.prepare(`SELECT retencion_config FROM empresas WHERE id=?`).bind(auth.empresa_id).first().catch(() => null);
  const config = empresa?.retencion_config ? JSON.parse(empresa.retencion_config) : {};

  return json({
    ok: true,
    config: {
      activo:         config.activo         ?? false,
      fichajes_dias:  config.fichajes_dias  ?? 730,   // 2 años por defecto
      chat_dias:      config.chat_dias      ?? 365,
      logs_dias:      config.logs_dias      ?? 90,
    }
  });
}

async function rgpdSetConfig(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isEmpresaAdmin && !auth.isSuperadmin) return err('Sin permisos', 403);

  const body = await request.json().catch(() => ({}));
  const config = {
    activo:        !!body.activo,
    fichajes_dias: Math.max(30, parseInt(body.fichajes_dias) || 730),
    chat_dias:     Math.max(30, parseInt(body.chat_dias)     || 365),
    logs_dias:     Math.max(7,  parseInt(body.logs_dias)     || 90),
  };

  // Asegurarse de que la columna existe (migración on-the-fly)
  await env.DB.prepare(`ALTER TABLE empresas ADD COLUMN retencion_config TEXT`).run().catch(() => {});

  await env.DB.prepare(`UPDATE empresas SET retencion_config=? WHERE id=?`)
    .bind(JSON.stringify(config), auth.empresa_id).run();

  return json({ ok: true });
}

async function rgpdAplicarRetencionEndpoint(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isEmpresaAdmin && !auth.isSuperadmin) return err('Sin permisos', 403);
  const resultado = await rgpdAplicarRetencion(env, auth.empresa_id);
  return json({ ok: true, ...resultado });
}

// Llamada interna (también desde cron)
async function rgpdAplicarRetencion(env, empresa_id) {
  try {
    const empresa = await env.DB.prepare(`SELECT retencion_config FROM empresas WHERE id=?`).bind(empresa_id).first();
    if (!empresa?.retencion_config) return { saltado: true, motivo: 'sin config' };
    const config = JSON.parse(empresa.retencion_config);
    if (!config.activo) return { saltado: true, motivo: 'retención desactivada' };

    const [rFichajes, rChat, rLogs] = await Promise.all([
      env.DB.prepare(`DELETE FROM fichajes WHERE empresa_id=? AND fecha < date('now', '-' || ? || ' days')`)
        .bind(empresa_id, config.fichajes_dias).run(),
      env.DB.prepare(`DELETE FROM chat_mensajes WHERE empresa_id=? AND created_at < datetime('now', '-' || ? || ' days')`)
        .bind(empresa_id, config.chat_dias).run(),
      env.DB.prepare(`DELETE FROM logs WHERE empresa_id=? AND created_at < datetime('now', '-' || ? || ' days')`)
        .bind(empresa_id, config.logs_dias).run().catch(() => ({ meta: { changes: 0 } })),
    ]);

    return {
      fichajes_borrados: rFichajes.meta?.changes ?? 0,
      chat_borrados:     rChat.meta?.changes     ?? 0,
      logs_borrados:     rLogs.meta?.changes     ?? 0,
    };
  } catch(e) {
    console.error(`rgpdAplicarRetencion empresa ${empresa_id}:`, e.message);
    return { error: e.message };
  }
}

async function getGraficasData(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id) return err('No autorizado', 403);
  if (!auth.isEmpresaAdmin && !auth.isSuperadmin) return err('Sin permisos', 403);
  const eid = auth.empresa_id;

  const [fichajesDia, incEstado, pedEstado, bobEstado, pempEstado, carrEstado] = await Promise.all([
    env.DB.prepare(`
      SELECT date(entrada) as dia, COUNT(*) as n
      FROM fichajes WHERE empresa_id=? AND entrada >= date('now','-6 days')
      GROUP BY dia ORDER BY dia
    `).bind(eid).all(),
    env.DB.prepare(`SELECT estado, COUNT(*) as n FROM incidencias WHERE empresa_id=? GROUP BY estado`).bind(eid).all(),
    env.DB.prepare(`SELECT estado, COUNT(*) as n FROM pedidos WHERE empresa_id=? GROUP BY estado`).bind(eid).all(),
    env.DB.prepare(`SELECT estado, COUNT(*) as n FROM bobinas WHERE empresa_id=? GROUP BY estado`).bind(eid).all(),
    env.DB.prepare(`SELECT estado, COUNT(*) as n FROM pemp WHERE empresa_id=? GROUP BY estado`).bind(eid).all(),
    env.DB.prepare(`SELECT estado, COUNT(*) as n FROM carretillas WHERE empresa_id=? GROUP BY estado`).bind(eid).all(),
  ]);

  return json({
    ok: true,
    fichajes_dia:       fichajesDia.results,
    incidencias_estado: incEstado.results,
    pedidos_estado:     pedEstado.results,
    bobinas_estado:     bobEstado.results,
    pemp_estado:        pempEstado.results,
    carretillas_estado: carrEstado.results,
  });
}

async function buscarGlobal(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id) return err('No autorizado', 403);
  const q = new URL(request.url).searchParams.get('q')?.trim();
  if (!q || q.length < 2) return json([]);
  const like = `%${q}%`;
  const eid  = auth.empresa_id;

  const [inc, pemp, carr, herr, users, pedidos, obras] = await Promise.all([
    env.DB.prepare(`SELECT id,'incidencia' as tipo,titulo as nombre,tipo as subtipo,estado FROM incidencias WHERE empresa_id=? AND titulo LIKE ? LIMIT 5`).bind(eid,like).all(),
    env.DB.prepare(`SELECT id,'pemp' as tipo,matricula as nombre,tipo as subtipo,estado FROM pemp WHERE empresa_id=? AND (matricula LIKE ? OR marca LIKE ?) AND estado!='baja' LIMIT 5`).bind(eid,like,like).all(),
    env.DB.prepare(`SELECT id,'carretilla' as tipo,matricula as nombre,tipo as subtipo,estado FROM carretillas WHERE empresa_id=? AND (matricula LIKE ? OR marca LIKE ?) AND estado!='baja' LIMIT 5`).bind(eid,like,like).all(),
    env.DB.prepare(`SELECT h.id,'herramienta' as tipo,COALESCE(t.nombre,h.numero_serie,'—') as nombre,h.estado as subtipo,h.estado FROM herramientas h LEFT JOIN tipos_herramienta t ON h.tipo_id=t.id WHERE h.empresa_id=? AND (h.numero_serie LIKE ? OR t.nombre LIKE ?) LIMIT 5`).bind(eid,like,like).all(),
    env.DB.prepare(`SELECT id,'usuario' as tipo,nombre,rol as subtipo,NULL as estado FROM usuarios WHERE empresa_id=? AND nombre LIKE ? AND activo=1 LIMIT 5`).bind(eid,like).all(),
    env.DB.prepare(`SELECT id,'pedido' as tipo,descripcion as nombre,departamento as subtipo,estado FROM pedidos WHERE empresa_id=? AND descripcion LIKE ? LIMIT 5`).bind(eid,like).all(),
    env.DB.prepare(`SELECT id,'obra' as tipo,nombre,codigo as subtipo,CASE WHEN activa=1 THEN 'activa' ELSE 'cerrada' END as estado FROM obras WHERE empresa_id=? AND (nombre LIKE ? OR codigo LIKE ?) LIMIT 5`).bind(eid,like,like).all(),
  ]);
  return json([
    ...inc.results, ...pemp.results, ...carr.results,
    ...herr.results, ...users.results, ...pedidos.results, ...obras.results,
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// TELEGRAM PERSONAL (vinculación por deep link + webhook)
// ════════════════════════════════════════════════════════════════════════════

async function telegramVincular(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.usuario_id) return err('Solo usuarios de la app pueden vincular Telegram', 403);
  // Genera token aleatorio 8 chars alfanumérico
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const token = Array.from(bytes).map(b => b.toString(36).padStart(2,'0')).join('').slice(0,8).toUpperCase();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO vincular_tokens (token,usuario_id,empresa_id,expires_at) VALUES (?,?,?,datetime('now','+15 minutes'))"
  ).bind(token, auth.usuario_id, auth.empresa_id).run();
  return json({ ok: true, token, link: `https://t.me/AlejandraAPP_bot?start=${token}` });
}

async function telegramEstado(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.usuario_id) return json({ vinculado: false });
  const u = await env.DB.prepare('SELECT telegram_id FROM usuarios WHERE id=?').bind(auth.usuario_id).first();
  return json({ vinculado: !!u?.telegram_id });
}

async function telegramDesvincular(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.usuario_id) return err('Sin sesión', 403);
  await env.DB.prepare('UPDATE usuarios SET telegram_id=NULL WHERE id=?').bind(auth.usuario_id).run();
  return json({ ok: true });
}

async function telegramWebhook(request, env) {
  // Verificar que viene de Telegram con el secret derivado del token del bot
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_BOT_TOKEN?.split(':')[1]?.slice(0, 32) || '';
  if (!expectedSecret || secret !== expectedSecret) return json({ ok: true }); // rechazar — sin secret configurado rechaza todo
  const update = await request.json().catch(() => null);
  if (!update) return json({ ok: true });
  const msg    = update.message;
  if (!msg)    return json({ ok: true });
  const chatId = msg.chat?.id;
  const text   = (msg.text || '').trim();
  if (text.startsWith('/start')) {
    const token = text.split(' ')[1]?.toUpperCase().trim();
    if (token) {
      const record = await env.DB.prepare(
        "SELECT * FROM vincular_tokens WHERE token=? AND expires_at > datetime('now')"
      ).bind(token).first();
      if (record) {
        await env.DB.prepare('UPDATE usuarios SET telegram_id=? WHERE id=?').bind(String(chatId), record.usuario_id).run();
        await env.DB.prepare('DELETE FROM vincular_tokens WHERE token=?').bind(token).run();
        await sendTelegramToChat(env, chatId,
          '✅ <b>¡Cuenta vinculada!</b>\n\nDesde ahora recibirás notificaciones personales de <b>Alejandra App</b> directamente aquí:\n· Tus turnos de la semana\n· Carnets próximos a caducar\n· Avisos que te afecten directamente.');
      } else {
        await sendTelegramToChat(env, chatId,
          '❌ El código ha caducado o no es válido.\nGenera un nuevo enlace desde la app en <b>Ajustes → Sesión → Conectar Telegram</b>.');
      }
    } else {
      await sendTelegramToChat(env, chatId,
        '👋 Hola. Soy el bot de <b>Alejandra App</b>.\nPara vincular tu cuenta, pulsa "Conectar Telegram" desde la app y sigue el enlace que aparecerá.');
    }
  }
  return json({ ok: true });
}

async function setupTelegramWebhook(request, env) {
  const { isSuperadmin } = await getAuth(request, env);
  if (!isSuperadmin) return err('No autorizado', 403);
  const token  = env.TELEGRAM_BOT_TOKEN;
  if (!token) return err('TELEGRAM_BOT_TOKEN no configurado', 500);
  // Usa TELEGRAM_WEBHOOK_SECRET si está configurado, si no lo deriva del token
  const secret = env.TELEGRAM_WEBHOOK_SECRET || token.split(':')[1]?.slice(0, 32) || '';
  if (!secret) return err('No hay secret configurado para el webhook', 500);
  const webhookUrl = `https://alejandra-app-api.alejandra-app.workers.dev/telegram/webhook`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message', 'callback_query'] }),
  });
  const data = await res.json();
  return json({ ok: data.ok, result: data.description || data.result, webhookUrl, secret_configured: !!env.TELEGRAM_WEBHOOK_SECRET });
}

// Notificar turnos de una semana a los trabajadores vinculados con Telegram
async function notificarTurnosSemana(request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isAdmin && !auth.isSuperadmin && !auth.isEmpresaAdmin && !auth.isEncargado) return err('Sin permisos', 403);
  const { desde, hasta } = await request.json().catch(() => ({}));
  if (!desde || !hasta) return err('Falta desde/hasta', 400);
  const eid = auth.empresa_id;
  // Cargar turnos de la semana con datos de usuarios
  const { results: turnos } = await env.DB.prepare(
    'SELECT t.*, u.nombre as u_nombre, u.telegram_id FROM turnos t LEFT JOIN usuarios u ON t.usuario_id = u.id WHERE t.empresa_id=? AND t.fecha>=? AND t.fecha<=?'
  ).bind(eid, desde, hasta).all();
  // Agrupar por usuario (solo los con telegram_id)
  const porUsuario = {};
  for (const t of turnos) {
    if (!t.telegram_id) continue;
    if (!porUsuario[t.telegram_id]) porUsuario[t.telegram_id] = { nombre: t.u_nombre, dias: [] };
    porUsuario[t.telegram_id].dias.push({ fecha: t.fecha, turno: t.turno });
  }
  const LABEL = { 'mañana':'🌅 Mañana', tarde:'🌆 Tarde', noche:'🌙 Noche', libre:'💤 Libre' };
  const DIAS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let notificados = 0;
  for (const [chatId, data] of Object.entries(porUsuario)) {
    data.dias.sort((a,b) => a.fecha.localeCompare(b.fecha));
    const lineas = data.dias.map(d => {
      const fecha = new Date(d.fecha + 'T00:00:00');
      const dia   = DIAS_ES[fecha.getDay()];
      const num   = String(fecha.getDate()).padStart(2,'0') + '/' + String(fecha.getMonth()+1).padStart(2,'0');
      return `  ${dia} ${num}: ${LABEL[d.turno] || d.turno}`;
    }).join('\n');
    await sendTelegramToChat(env, chatId,
      `📅 <b>Tus turnos</b> (${desde.slice(5).replace('-','/')} – ${hasta.slice(5).replace('-','/')})\n\n${lineas}`);
    notificados++;
  }
  return json({ ok: true, notificados });
}

// ════════════════════════════════════════════════════════════════════════════
// FOTO DE PERFIL DE TRABAJADORES
// ════════════════════════════════════════════════════════════════════════════

async function subirFotoPerfil(tipo, id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta formulario', 400);
  const file = form.get('file');
  if (!file?.name) return err('Falta archivo', 400);
  if (file.size > 5242880) return err('Máximo 5 MB', 413);
  const mime = file.type || 'image/jpeg';
  if (!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime)) return err('Solo imágenes', 400);
  const r2Key = `e${empresa_id}/perfiles/${tipo}/${id}_${Date.now()}.jpg`;
  await env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: mime } });
  // Borrar foto anterior si existe
  let oldKey = null;
  if (tipo === 'usuario') {
    const u = await env.DB.prepare('SELECT foto_r2_key FROM usuarios WHERE id=? AND empresa_id=?').bind(id, empresa_id).first();
    oldKey = u?.foto_r2_key;
    await env.DB.prepare('UPDATE usuarios SET foto_r2_key=? WHERE id=? AND empresa_id=?').bind(r2Key, id, empresa_id).run();
  } else {
    const e = await env.DB.prepare('SELECT foto_r2_key FROM personal_externo WHERE id=? AND empresa_id=?').bind(id, empresa_id).first();
    oldKey = e?.foto_r2_key;
    await env.DB.prepare('UPDATE personal_externo SET foto_r2_key=? WHERE id=? AND empresa_id=?').bind(r2Key, id, empresa_id).run();
  }
  if (oldKey && oldKey !== r2Key) { try { await env.FILES.delete(oldKey); } catch {} }
  return json({ ok: true, r2Key });
}

async function getFotoPerfil(tipo, id, request, env) {
  const auth = await getAuth(request, env);
  if (!auth.empresa_id) return err('No autorizado', 403);
  let r2Key = null;
  if (tipo === 'usuario') {
    const u = await env.DB.prepare('SELECT foto_r2_key FROM usuarios WHERE id=? AND empresa_id=?').bind(id, auth.empresa_id).first();
    r2Key = u?.foto_r2_key;
  } else {
    const e = await env.DB.prepare('SELECT foto_r2_key FROM personal_externo WHERE id=? AND empresa_id=?').bind(id, auth.empresa_id).first();
    r2Key = e?.foto_r2_key;
  }
  if (!r2Key) return err('Sin foto', 404);
  const obj = await env.FILES.get(r2Key);
  if (!obj) return err('Archivo no disponible', 404);
  return new Response(obj.body, { headers: { 'Content-Type':'image/jpeg','Cache-Control':'private, max-age=86400',...CORS } });
}

async function borrarFotoPerfil(tipo, id, request, env) {
  const auth = await getAuth(request, env);
  if (!auth.isAdmin && !auth.isSuperadmin && !auth.isEmpresaAdmin && !auth.isEncargado) return err('Sin permisos', 403);
  let r2Key = null;
  if (tipo === 'usuario') {
    const u = await env.DB.prepare('SELECT foto_r2_key FROM usuarios WHERE id=? AND empresa_id=?').bind(id, auth.empresa_id).first();
    r2Key = u?.foto_r2_key;
    if (r2Key) await env.DB.prepare('UPDATE usuarios SET foto_r2_key=NULL WHERE id=?').bind(id).run();
  } else {
    const e = await env.DB.prepare('SELECT foto_r2_key FROM personal_externo WHERE id=? AND empresa_id=?').bind(id, auth.empresa_id).first();
    r2Key = e?.foto_r2_key;
    if (r2Key) await env.DB.prepare('UPDATE personal_externo SET foto_r2_key=NULL WHERE id=?').bind(id).run();
  }
  if (r2Key) { try { await env.FILES.delete(r2Key); } catch {} }
  return json({ ok: true });
}

// ── Migración v4.86 ───────────────────────────────────────────────────────────
async function runMigrations(request, env) {
  const { isSuperadmin } = await getAuth(request, env);
  if (!isSuperadmin) return err('No autorizado', 403);
  const results = [];
  try {
    await env.DB.prepare('ALTER TABLE carpetas ADD COLUMN parent_id INTEGER').run();
    results.push('carpetas.parent_id: añadido');
  } catch { results.push('carpetas.parent_id: ya existe'); }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS docs_notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id INTEGER NOT NULL,
      obra_id INTEGER,
      departamento TEXT,
      carpeta_id INTEGER,
      titulo TEXT NOT NULL,
      contenido TEXT,
      creado_por TEXT,
      updated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('docs_notas: creada');
  } catch(e) { results.push('docs_notas: ' + e.message); }
  // Tabla chat_mensajes
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS chat_mensajes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id  INTEGER NOT NULL,
      obra_id     INTEGER,
      usuario_id  INTEGER,
      usuario_nombre TEXT NOT NULL,
      rol         TEXT,
      mensaje     TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('chat_mensajes: creada');
  } catch(e) { results.push('chat_mensajes: ' + e.message); }
  // Tablas checklist (NEW-21)
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS checklist_plantillas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id  INTEGER NOT NULL,
      tipo_equipo TEXT NOT NULL,
      pregunta    TEXT NOT NULL,
      orden       INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('checklist_plantillas: creada');
  } catch(e) { results.push('checklist_plantillas: ' + e.message); }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS checklist_registros (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id  INTEGER NOT NULL,
      obra_id     INTEGER,
      tipo_equipo TEXT NOT NULL,
      equipo_id   INTEGER NOT NULL,
      equipo_mat  TEXT,
      resultado   TEXT NOT NULL,
      respuestas  TEXT NOT NULL,
      comentario  TEXT,
      realizado_por TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('checklist_registros: creada');
  } catch(e) { results.push('checklist_registros: ' + e.message); }
  // Mantenimiento preventivo (NEW-15) — columnas en pemp + carretillas + tabla historial
  try {
    await env.DB.prepare(`ALTER TABLE pemp ADD COLUMN aviso_mantenimiento INTEGER DEFAULT 1`).run();
    results.push('pemp.aviso_mantenimiento: añadida');
  } catch(e) { results.push('pemp.aviso_mantenimiento: ' + e.message); }
  try {
    await env.DB.prepare(`ALTER TABLE pemp ADD COLUMN dias_aviso_mant INTEGER DEFAULT 15`).run();
    results.push('pemp.dias_aviso_mant: añadida');
  } catch(e) { results.push('pemp.dias_aviso_mant: ' + e.message); }
  try {
    await env.DB.prepare(`ALTER TABLE carretillas ADD COLUMN aviso_mantenimiento INTEGER DEFAULT 1`).run();
    results.push('carretillas.aviso_mantenimiento: añadida');
  } catch(e) { results.push('carretillas.aviso_mantenimiento: ' + e.message); }
  try {
    await env.DB.prepare(`ALTER TABLE carretillas ADD COLUMN dias_aviso_mant INTEGER DEFAULT 15`).run();
    results.push('carretillas.dias_aviso_mant: añadida');
  } catch(e) { results.push('carretillas.dias_aviso_mant: ' + e.message); }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS historial_mantenimientos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id       INTEGER NOT NULL,
      tipo_equipo      TEXT NOT NULL,
      equipo_id        INTEGER,
      matricula        TEXT NOT NULL,
      obra_id          INTEGER,
      fecha_mant       TEXT NOT NULL,
      tipo_mant        TEXT NOT NULL DEFAULT 'preventivo',
      descripcion      TEXT,
      realizado_por    TEXT,
      adjunto_r2_key   TEXT,
      adjunto_nombre   TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('historial_mantenimientos: creada');
  } catch(e) { results.push('historial_mantenimientos: ' + e.message); }
  // Tabla fotos_obra (NEW-17)
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS fotos_obra (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id  INTEGER NOT NULL,
      obra_id     INTEGER,
      departamento TEXT,
      r2_key      TEXT NOT NULL,
      nombre      TEXT NOT NULL,
      mime_type   TEXT,
      tamano      INTEGER,
      comentario  TEXT,
      subido_por  TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('fotos_obra: creada');
  } catch(e) { results.push('fotos_obra: ' + e.message); }
  // Tabla partes_trabajo (NEW-16)
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS partes_trabajo (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id        INTEGER NOT NULL,
      obra_id           INTEGER,
      fecha             TEXT,
      cliente           TEXT,
      nombre_encargado  TEXT,
      direccion         TEXT,
      obra              TEXT,
      descripcion       TEXT,
      personal          TEXT DEFAULT '[]',
      material          TEXT DEFAULT '[]',
      firma_cliente     TEXT,
      firma_responsable TEXT,
      departamento      TEXT,
      creado_por        TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('partes_trabajo: creada');
  } catch(e) { results.push('partes_trabajo: ' + e.message); }
  // Seguridad: expiración de sesiones (CRIT-3)
  try {
    await env.DB.prepare('ALTER TABLE sesiones ADD COLUMN expires_at TEXT').run();
    results.push('sesiones.expires_at: añadida');
  } catch { results.push('sesiones.expires_at: ya existe'); }
  // Seguridad: rate limiting de login (CRIT-1)
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ip         TEXT NOT NULL,
      motivo     TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip, created_at)').run();
    results.push('login_attempts: creada');
  } catch(e) { results.push('login_attempts: ' + e.message); }
  // Gestión de turnos (NEW-20)
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS turnos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id       INTEGER NOT NULL,
      obra_id          INTEGER,
      usuario_id       INTEGER,
      externo_id       INTEGER,
      nombre_trabajador TEXT,
      fecha            TEXT NOT NULL,
      turno            TEXT NOT NULL,
      created_at       TEXT DEFAULT (datetime('now'))
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_turnos_empresa_fecha ON turnos (empresa_id, fecha)').run();
    results.push('turnos: creada');
  } catch(e) { results.push('turnos: ' + e.message); }
  // Informe semanal Telegram (NEW-18)
  try {
    await env.DB.prepare('ALTER TABLE empresas ADD COLUMN informe_semanal INTEGER DEFAULT 0').run();
    results.push('empresas.informe_semanal: añadida');
  } catch { results.push('empresas.informe_semanal: ya existe'); }
  try {
    await env.DB.prepare("ALTER TABLE empresas ADD COLUMN informe_dia TEXT DEFAULT 'lunes'").run();
    results.push('empresas.informe_dia: añadida');
  } catch { results.push('empresas.informe_dia: ya existe'); }
  // Módulos configurables (NEW-29)
  try {
    await env.DB.prepare('ALTER TABLE empresas ADD COLUMN modulos_config TEXT').run();
    results.push('empresas.modulos_config: añadida');
  } catch { results.push('empresas.modulos_config: ya existe'); }
  // Telegram personal (telegram_id en usuarios)
  try {
    await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN telegram_id TEXT').run();
    results.push('usuarios.telegram_id: añadida');
  } catch { results.push('usuarios.telegram_id: ya existe'); }
  // Tabla de tokens de vinculación de Telegram
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vincular_tokens (
      token       TEXT PRIMARY KEY,
      usuario_id  INTEGER NOT NULL,
      empresa_id  INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      expires_at  TEXT
    )`).run();
    results.push('vincular_tokens: creada');
  } catch(e) { results.push('vincular_tokens: ' + e.message); }
  // Foto de perfil en usuarios y personal_externo
  try {
    await env.DB.prepare('ALTER TABLE usuarios ADD COLUMN foto_r2_key TEXT').run();
    results.push('usuarios.foto_r2_key: añadida');
  } catch { results.push('usuarios.foto_r2_key: ya existe'); }
  try {
    await env.DB.prepare('ALTER TABLE personal_externo ADD COLUMN foto_r2_key TEXT').run();
    results.push('personal_externo.foto_r2_key: añadida');
  } catch { results.push('personal_externo.foto_r2_key: ya existe'); }
  // Carnets y certificaciones (NEW-19)
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS carnets (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id        INTEGER NOT NULL,
      obra_id           INTEGER,
      usuario_id        INTEGER,
      externo_id        INTEGER,
      nombre_trabajador TEXT NOT NULL,
      tipo              TEXT NOT NULL,
      numero            TEXT,
      fecha_obtencion   TEXT,
      fecha_caducidad   TEXT,
      dias_aviso        INTEGER DEFAULT 30,
      estado            TEXT DEFAULT 'vigente',
      notas             TEXT,
      created_by        TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    )`).run();
    results.push('carnets: creada');
  } catch(e) { results.push('carnets: ' + e.message); }

  return json({ ok: true, results });
}

// ══════════════════════════════════════════════════════════════════════════════
// PARTES DE TRABAJO (NEW-16)
// ══════════════════════════════════════════════════════════════════════════════

async function getPartesTrabajo(request, env) {
  const { empresa_id, isAdmin, isSuperadmin, isEmpresaAdmin, isEncargado } = await getAuth(request, env);
  if (!isAdmin && !isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const url = new URL(request.url);
  const obra_id = url.searchParams.get('obra_id');
  let sql = 'SELECT * FROM partes_trabajo WHERE empresa_id = ?';
  const params = [empresa_id];
  if (obra_id) { sql += ' AND obra_id = ?'; params.push(parseInt(obra_id)); }
  sql += ' ORDER BY fecha DESC, id DESC LIMIT 100';
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function getParteTrabajo(id, request, env) {
  const { empresa_id, isAdmin, isSuperadmin, isEmpresaAdmin } = await getAuth(request, env);
  if (!isAdmin && !isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const parte = await env.DB.prepare(
    'SELECT * FROM partes_trabajo WHERE id = ? AND empresa_id = ?'
  ).bind(id, empresa_id).first();
  if (!parte) return err('No encontrado', 404);
  return json(parte);
}

async function crearParteTrabajo(request, env) {
  const { empresa_id, isAdmin, isSuperadmin, isEmpresaAdmin, nombre, obra_id: obraAuth, departamento } = await getAuth(request, env);
  if (!isAdmin && !isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  const body = await request.json();
  const ahora = new Date().toISOString().slice(0,19).replace('T',' ');
  const r = await env.DB.prepare(
    `INSERT INTO partes_trabajo
     (empresa_id,obra_id,fecha,cliente,nombre_encargado,direccion,obra,descripcion,personal,material,firma_cliente,firma_responsable,departamento,creado_por,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    empresa_id,
    body.obra_id || obraAuth || null,
    body.fecha || ahora.slice(0,10),
    body.cliente || '',
    body.nombre_encargado || nombre || '',
    body.direccion || '',
    body.obra || '',
    body.descripcion || '',
    JSON.stringify(body.personal || []),
    JSON.stringify(body.material || []),
    body.firma_cliente || null,
    body.firma_responsable || null,
    body.departamento || departamento || '',
    nombre || '',
    ahora
  ).run();
  return json({ ok: true, id: r.meta.last_row_id });
}

async function eliminarParteTrabajo(id, request, env) {
  const { empresa_id, isAdmin, isSuperadmin, isEmpresaAdmin } = await getAuth(request, env);
  if (!isAdmin && !isSuperadmin && !isEmpresaAdmin) return err('No autorizado', 403);
  await env.DB.prepare('DELETE FROM partes_trabajo WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// MANTENIMIENTO PREVENTIVO EQUIPOS (NEW-15)
// ══════════════════════════════════════════════════════════════════════════════

async function getMantenimientos(request, env) {
  const { empresa_id } = await getAuth(request, env);
  const url = new URL(request.url);
  const tipo_equipo = url.searchParams.get('tipo_equipo');
  const matricula   = url.searchParams.get('matricula');
  const conds = ['empresa_id = ?'];
  const vals  = [empresa_id];
  if (tipo_equipo) { conds.push('tipo_equipo = ?'); vals.push(tipo_equipo); }
  if (matricula)   { conds.push('matricula = ?');   vals.push(matricula); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM historial_mantenimientos WHERE ${conds.join(' AND ')} ORDER BY fecha_mant DESC, id DESC LIMIT 100`
  ).bind(...vals).all();
  return json({ ok: true, registros: results || [] });
}

async function crearMantenimiento(request, env) {
  const { empresa_id, usuario, obra_id: obraAuth } = await getAuth(request, env);
  let body = {};
  let adjuntoKey = null;
  let adjuntoNombre = null;
  const ct = request.headers.get('content-type') || '';

  if (ct.includes('multipart/form-data')) {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) {
      if (k === 'file' && v instanceof File && v.size > 0) {
        adjuntoNombre = v.name;
        const ext = v.name.split('.').pop().toLowerCase();
        adjuntoKey = `mant/${empresa_id}/${Date.now()}_${randomHex(4)}.${ext}`;
        await env.R2.put(adjuntoKey, v.stream(), { httpMetadata: { contentType: v.type || 'application/octet-stream' } });
      } else {
        body[k] = v;
      }
    }
  } else {
    body = await request.json().catch(() => ({}));
  }

  const { tipo_equipo, equipo_id, matricula, fecha_mant, tipo_mant, descripcion, realizado_por, obra_id } = body;
  if (!matricula || !fecha_mant) return err('Faltan campos obligatorios (matricula, fecha_mant)');

  const obraFinal = obra_id ? parseInt(obra_id) : obraAuth;

  const r = await env.DB.prepare(
    `INSERT INTO historial_mantenimientos (empresa_id, tipo_equipo, equipo_id, matricula, obra_id, fecha_mant, tipo_mant, descripcion, realizado_por, adjunto_r2_key, adjunto_nombre)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    empresa_id,
    tipo_equipo || 'pemp',
    equipo_id ? parseInt(equipo_id) : null,
    matricula.trim().toUpperCase(),
    obraFinal || null,
    fecha_mant,
    tipo_mant || 'preventivo',
    descripcion || null,
    realizado_por || usuario || null,
    adjuntoKey,
    adjuntoNombre
  ).run();

  // Si es revisión → actualizar fecha_ultima_revision en la tabla del equipo
  if (tipo_mant === 'revision') {
    const tabla = (tipo_equipo === 'carretilla' || tipo_equipo === 'carretillas') ? 'carretillas' : 'pemp';
    await env.DB.prepare(`UPDATE ${tabla} SET fecha_ultima_revision = ? WHERE matricula = ?`)
      .bind(fecha_mant, matricula.trim().toUpperCase()).run().catch(() => {});
  }

  await sendTelegram(env,
    `🔧 <b>Mantenimiento registrado</b>\n🔖 ${matricula.trim().toUpperCase()} (${tipo_mant || 'preventivo'})\n📅 ${fecha_mant}\n👤 ${realizado_por || usuario || '—'}${descripcion ? '\n📝 ' + descripcion : ''}`
  );

  return json({ ok: true, id: r.meta.last_row_id, mensaje: 'Mantenimiento registrado' }, 201);
}

async function getAdjuntoMantenimiento(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  const reg = await env.DB.prepare('SELECT * FROM historial_mantenimientos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!reg || !reg.adjunto_r2_key) return err('Adjunto no encontrado', 404);
  const obj = await env.R2.get(reg.adjunto_r2_key);
  if (!obj) return err('Archivo no encontrado en almacenamiento', 404);
  const ct = obj.httpMetadata?.contentType || 'application/octet-stream';
  return new Response(obj.body, {
    headers: {
      'Content-Type': ct,
      'Content-Disposition': `inline; filename="${reg.adjunto_nombre || 'adjunto'}"`,
      ...CORS,
    },
  });
}

async function borrarMantenimiento(id, request, env) {
  const { empresa_id, isSuperadmin, isEmpresaAdmin, isEncargado } = await getAuth(request, env);
  if (!isSuperadmin && !isEmpresaAdmin && !isEncargado) return err('No autorizado', 403);
  const reg = await env.DB.prepare('SELECT * FROM historial_mantenimientos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!reg) return err('Registro no encontrado', 404);
  if (reg.adjunto_r2_key) {
    await env.R2.delete(reg.adjunto_r2_key).catch(() => {});
  }
  await env.DB.prepare('DELETE FROM historial_mantenimientos WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true, mensaje: 'Registro borrado' });
}

// ══════════════════════════════════════════════════════════════════════════════
// CHECKLIST PRE-USO EQUIPOS (NEW-21)
// ══════════════════════════════════════════════════════════════════════════════

const CHECKLIST_DEFAULTS = {
  pemp: [
    'Nivel de aceite', 'Batería / Combustible', 'Cinturón de seguridad',
    'Funcionamiento de mandos', 'Estado de neumáticos', 'Luces y señales', 'Estructura y plataforma'
  ],
  carretilla: [
    'Nivel de aceite', 'Batería / Gas', 'Estado de horquillas',
    'Frenos', 'Señal acústica', 'Estado de neumáticos', 'Luces'
  ]
};

async function listarPlantillaChecklist(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const tipo = new URL(request.url).searchParams.get('tipo') || null;
  const conds = ['empresa_id = ?'];
  const params = [empresa_id];
  if (tipo) { conds.push('tipo_equipo = ?'); params.push(tipo); }
  const { results } = await env.DB.prepare(
    `SELECT * FROM checklist_plantillas WHERE ${conds.join(' AND ')} ORDER BY tipo_equipo, orden, id`
  ).bind(...params).all();
  // Si no hay plantilla aún, devolver defaults
  if (!results.length && tipo && CHECKLIST_DEFAULTS[tipo]) {
    return json({ ok: true, preguntas: CHECKLIST_DEFAULTS[tipo].map((p, i) => ({ id: -(i+1), pregunta: p, tipo_equipo: tipo, es_default: true })) });
  }
  return json({ ok: true, preguntas: results });
}

async function crearPreguntaChecklist(request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (!['superadmin','empresa_admin','encargado'].includes(rol)) return err('No autorizado', 403);
  const { tipo_equipo, pregunta, orden } = await request.json().catch(() => ({}));
  if (!tipo_equipo || !pregunta) return err('Faltan campos', 400);
  const r = await env.DB.prepare(
    'INSERT INTO checklist_plantillas (empresa_id, tipo_equipo, pregunta, orden) VALUES (?,?,?,?)'
  ).bind(empresa_id, tipo_equipo, pregunta.trim(), orden || 0).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function borrarPreguntaChecklist(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (!['superadmin','empresa_admin','encargado'].includes(rol)) return err('No autorizado', 403);
  await env.DB.prepare('DELETE FROM checklist_plantillas WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

async function listarRegistrosChecklist(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url       = new URL(request.url);
  const equipo_id = url.searchParams.get('equipo_id') ? parseInt(url.searchParams.get('equipo_id')) : null;
  const tipo      = url.searchParams.get('tipo') || null;
  const conds     = ['empresa_id = ?'];
  const params    = [empresa_id];
  if (equipo_id) { conds.push('equipo_id = ?'); params.push(equipo_id); }
  if (tipo)      { conds.push('tipo_equipo = ?'); params.push(tipo); }
  params.push(50);
  const { results } = await env.DB.prepare(
    `SELECT * FROM checklist_registros WHERE ${conds.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params).all();
  return json({ ok: true, registros: results });
}

async function crearRegistroChecklist(request, env) {
  const { empresa_id, obra_id: sesionObra, nombre: userNombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const { tipo_equipo, equipo_id, equipo_mat, respuestas, comentario } = body;
  if (!tipo_equipo || !equipo_id || !respuestas) return err('Faltan campos', 400);
  const resp    = Array.isArray(respuestas) ? respuestas : [];
  const fallos  = resp.filter(r => r.ok === false);
  const resultado = fallos.length === 0 ? 'ok' : 'con_fallos';
  const obra_id = body.obra_id || sesionObra || null;
  const r = await env.DB.prepare(
    'INSERT INTO checklist_registros (empresa_id, obra_id, tipo_equipo, equipo_id, equipo_mat, resultado, respuestas, comentario, realizado_por) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obra_id, tipo_equipo, equipo_id, equipo_mat || null, resultado, JSON.stringify(resp), comentario || null, userNombre || rol).run();
  // Si hay fallos: marcar equipo como "mantenimiento" y notificar Telegram
  if (fallos.length > 0) {
    const tabla = tipo_equipo === 'pemp' ? 'pemp' : 'carretillas';
    await env.DB.prepare(`UPDATE ${tabla} SET estado = 'mantenimiento' WHERE id = ? AND empresa_id = ?`).bind(equipo_id, empresa_id).run();
    const fallosTexto = fallos.map(f => `• ${f.pregunta}`).join('\n');
    await sendTelegram(env, `⚠️ Checklist con FALLOS\nEquipo: ${equipo_mat || equipo_id} (${tipo_equipo})\nRealizado por: ${userNombre || rol}\n\nFallos:\n${fallosTexto}${comentario ? '\n\nComentario: ' + comentario : ''}`);
  }
  return json({ ok: true, id: r.meta.last_row_id, resultado }, 201);
}

// ══════════════════════════════════════════════════════════════════════════════
// GALERÍA DE FOTOS POR OBRA (NEW-17)
// ══════════════════════════════════════════════════════════════════════════════

async function listarFotosObra(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url    = new URL(request.url);
  const obraId = url.searchParams.get('obra_id') ? parseInt(url.searchParams.get('obra_id')) : null;
  const dept   = url.searchParams.get('departamento') || null;
  const conds  = ['empresa_id = ?'];
  const params = [empresa_id];
  if (obraId) { conds.push('obra_id = ?'); params.push(obraId); }
  if (dept)   { conds.push('departamento = ?'); params.push(dept); }
  params.push(200);
  const { results } = await env.DB.prepare(
    `SELECT * FROM fotos_obra WHERE ${conds.join(' AND ')} ORDER BY created_at DESC LIMIT ?`
  ).bind(...params).all();
  return json({ ok: true, fotos: results });
}

async function subirFotoObra(request, env) {
  const { empresa_id, obra_id: sesionObra, nombre: userNombre, rol, departamento } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const form = await request.formData().catch(() => null);
  if (!form) return err('Falta el formulario', 400);
  const file = form.get('file');
  if (!file || !file.name) return err('Falta el archivo', 400);
  if (file.size > 20971520) return err('El archivo supera 20 MB', 413);
  const mime = file.type || 'image/jpeg';
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!allowed.includes(mime)) return err('Solo se permiten imágenes', 400);
  const obra_id    = parseInt(form.get('obra_id') || sesionObra || 0) || null;
  const dept       = form.get('departamento') || departamento || null;
  const comentario = (form.get('comentario') || '').trim() || null;
  const ts         = Date.now();
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key      = `e${empresa_id}/galeria/${obra_id || 0}/${ts}_${safeName}`;
  await env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: mime } });
  const r = await env.DB.prepare(
    'INSERT INTO fotos_obra (empresa_id, obra_id, departamento, r2_key, nombre, mime_type, tamano, comentario, subido_por) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obra_id, dept, r2Key, file.name, mime, file.size, comentario, userNombre || rol).run();
  return json({ ok: true, id: r.meta.last_row_id }, 201);
}

async function getFotoObra(id, request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const meta = await env.DB.prepare('SELECT * FROM fotos_obra WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Foto no encontrada', 404);
  const obj = await env.FILES.get(meta.r2_key);
  if (!obj) return err('Archivo no disponible', 404);
  return new Response(obj.body, {
    headers: { 'Content-Type': meta.mime_type || 'image/jpeg', 'Content-Disposition': 'inline', 'Cache-Control': 'private, max-age=3600', ...CORS }
  });
}

async function borrarFotoObra(id, request, env) {
  const { empresa_id, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const isAdmin = ['superadmin', 'empresa_admin', 'encargado'].includes(rol);
  if (!isAdmin) return err('No autorizado', 403);
  const meta = await env.DB.prepare('SELECT * FROM fotos_obra WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!meta) return err('Foto no encontrada', 404);
  await env.FILES.delete(meta.r2_key);
  await env.DB.prepare('DELETE FROM fotos_obra WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).run();
  return json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// CHAT INTERNO (NEW-08)
// ══════════════════════════════════════════════════════════════════════════════

async function getChatMensajes(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url    = new URL(request.url);
  const limit  = Math.min(parseInt(url.searchParams.get('limit') || '60'), 100);
  const since  = url.searchParams.get('since') || null;
  const obraId = url.searchParams.get('obra_id') ? parseInt(url.searchParams.get('obra_id')) : null;

  const conds  = ['empresa_id = ?'];
  const params = [empresa_id];
  if (obraId) { conds.push('obra_id = ?'); params.push(obraId); }
  if (since)  { conds.push('created_at > ?'); params.push(since); }
  params.push(limit);

  const order = since ? 'ASC' : 'DESC';
  const q = `SELECT cm.*, o.nombre AS obra_nombre, u.foto_r2_key
             FROM chat_mensajes cm
             LEFT JOIN obras o ON o.id = cm.obra_id
             LEFT JOIN usuarios u ON u.id = cm.usuario_id
             WHERE ${conds.join(' AND ')}
             ORDER BY cm.created_at ${order} LIMIT ?`;
  const rows = await env.DB.prepare(q).bind(...params).all();
  const msgs = since ? rows.results : rows.results.reverse();
  return json({ ok: true, mensajes: msgs });
}

async function enviarChatMensaje(request, env) {
  const auth = await getAuth(request, env);
  const { empresa_id, usuario_id, nombre, rol } = auth;
  if (!empresa_id) return err('No autorizado', 403);
  const body = await request.json().catch(() => ({}));
  const mensaje = (body.mensaje || '').trim();
  if (!mensaje) return err('Mensaje vacío', 400);
  if (mensaje.length > 500) return err('Mensaje demasiado largo (máx 500 caracteres)', 400);
  const obra_id = body.obra_id || auth.obra_id || null;
  await env.DB.prepare(
    'INSERT INTO chat_mensajes (empresa_id, obra_id, usuario_id, usuario_nombre, rol, mensaje) VALUES (?,?,?,?,?,?)'
  ).bind(empresa_id, obra_id, usuario_id || null, nombre || 'Usuario', rol || '', mensaje).run();
  return json({ ok: true });
}

async function borrarChatMensaje(id, request, env) {
  const { empresa_id, usuario_id, isSuperadmin, rol } = await getAuth(request, env);
  const msg = await env.DB.prepare('SELECT * FROM chat_mensajes WHERE id = ? AND empresa_id = ?').bind(id, empresa_id).first();
  if (!msg) return err('Mensaje no encontrado', 404);
  // Solo puede borrar el autor o superadmin/empresa_admin
  if (!isSuperadmin && rol !== 'empresa_admin' && msg.usuario_id !== usuario_id) return err('No autorizado', 403);
  await env.DB.prepare('DELETE FROM chat_mensajes WHERE id = ?').bind(id).run();
  return json({ ok: true });
}


// ════════════════════════════════════════════════════════════════════════════
// REPOSTAJES / CARGAS (NEW-26)
// ════════════════════════════════════════════════════════════════════════════

async function getRepostajes(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url        = new URL(request.url);
  const equipoTipo = url.searchParams.get('equipo_tipo');
  const equipoId   = url.searchParams.get('equipo_id');
  const limit      = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  let sql = 'SELECT * FROM repostajes WHERE empresa_id = ?';
  const params = [empresa_id];
  if (equipoTipo) { sql += ' AND equipo_tipo = ?'; params.push(equipoTipo); }
  if (equipoId)   { sql += ' AND equipo_id = ?';   params.push(equipoId); }
  sql += ' ORDER BY fecha DESC, id DESC LIMIT ?';
  params.push(limit);
  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearRepostaje(request, env, ctx) {
  const { empresa_id, obra_id, nombre, rol } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  if (rol === 'operario') return err('Sin permisos', 403);
  const body = await request.json().catch(() => ({}));
  const { equipo_tipo, equipo_id, tipo, cantidad, unidad, coste, notas, fecha } = body;
  if (!equipo_tipo || !equipo_id || !tipo) return err('Faltan campos obligatorios');
  const fechaFinal = fecha || fechaEspana();
  const obraFinal  = body.obra_id || obra_id || null;
  const r = await env.DB.prepare(
    'INSERT INTO repostajes (empresa_id, obra_id, equipo_tipo, equipo_id, tipo, cantidad, unidad, coste, usuario, notas, fecha) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(empresa_id, obraFinal, equipo_tipo, equipo_id, tipo,
    cantidad ? parseFloat(cantidad) : null,
    unidad || null,
    coste  ? parseFloat(coste)  : null,
    nombre || rol || '',
    notas  || null,
    fechaFinal
  ).run();
  // Telegram si hay coste
  if (coste && parseFloat(coste) > 0) {
    const emoji = tipo === 'combustible' ? '⛽' : '🔋';
    await sendTelegram(env, `${emoji} <b>Repostaje registrado</b>\n🚜 ${equipo_tipo.toUpperCase()} ${equipo_id}\n📦 ${cantidad ? cantidad + ' ' + (unidad||'') : ''} · 💶 ${parseFloat(coste).toFixed(2)}€\n👤 ${nombre || rol || '—'}`);
  }
  ctx?.waitUntil(syncRRHH(env, 'Repostajes', empresa_id));
  return json({ ok: true, id: r.meta.last_row_id });
}

async function getResumenRepostajes(request, env) {
  const { empresa_id } = await getAuth(request, env);
  if (!empresa_id) return err('No autorizado', 403);
  const url        = new URL(request.url);
  const equipoTipo = url.searchParams.get('equipo_tipo');
  const equipoId   = url.searchParams.get('equipo_id');
  if (!equipoTipo || !equipoId) return err('Faltan equipo_tipo y equipo_id');
  const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [totalRow, mesRow] = await Promise.all([
    env.DB.prepare(
      'SELECT COALESCE(SUM(cantidad),0) as total_cantidad, COALESCE(SUM(coste),0) as total_coste, COUNT(*) as total_repostajes FROM repostajes WHERE empresa_id=? AND equipo_tipo=? AND equipo_id=?'
    ).bind(empresa_id, equipoTipo, equipoId).first(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(cantidad),0) as mes_cantidad, COALESCE(SUM(coste),0) as mes_coste FROM repostajes WHERE empresa_id=? AND equipo_tipo=? AND equipo_id=? AND strftime('%Y-%m',fecha)=?"
    ).bind(empresa_id, equipoTipo, equipoId, mesActual).first(),
  ]);
  return json({ ...totalRow, ...mesRow });
}

// ══════════════════════════════════════════════════════════════════════
// DEV TOOLS — endpoints solo para superadmin/desarrollador
// ══════════════════════════════════════════════════════════════════════

async function devSQL(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const { sql } = await request.json().catch(() => ({}));
  if (!sql) return err('Falta SQL', 400);
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA')) {
    return err('Solo se permiten consultas SELECT o PRAGMA', 403);
  }
  try {
    const result = await env.DB.prepare(sql).all();
    return json({ ok: true, results: result.results, meta: result.meta });
  } catch (e) {
    return json({ ok: false, error: e.message });
  }
}

async function devTableCounts(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const tables = [
    'usuarios','empresas','obras','bobinas','herramientas','seguridad_items',
    'epis','carretillas','pemp','fichajes','incidencias','pedidos','turnos',
    'mantenimientos','repostajes','kits','sesiones','invitaciones','carnets',
    'logs','login_attempts','reset_tokens','vincular_tokens','sugerencias'
  ];
  const counts = {};
  await Promise.all(tables.map(async t => {
    try {
      const r = await env.DB.prepare(`SELECT COUNT(*) as n FROM ${t}`).first();
      counts[t] = r?.n ?? 0;
    } catch { counts[t] = null; }
  }));
  return json({ ok: true, counts });
}

async function devSesionesDetalle(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const rows = await env.DB.prepare(`
    SELECT s.token, s.nombre, s.rol, s.empresa_id, s.created_at, s.last_used,
           u.email, e.nombre as empresa_nombre
    FROM sesiones s
    LEFT JOIN usuarios u ON u.id = s.usuario_id
    LEFT JOIN empresas e ON e.id = s.empresa_id
    ORDER BY s.created_at DESC
    LIMIT 100
  `).all();
  return json({ ok: true, sesiones: rows.results });
}

async function devKillSession(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const { token } = await request.json().catch(() => ({}));
  if (!token) return err('Falta token', 400);
  if (token === (await getAuth(request, env))?.token) return err('No puedes matar tu propia sesión', 403);
  await env.DB.prepare('DELETE FROM sesiones WHERE token = ?').bind(token).run();
  return json({ ok: true });
}

async function devLoginHistory(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const rows = await env.DB.prepare(
    'SELECT email, intentos, bloqueado_hasta FROM login_attempts ORDER BY intentos DESC LIMIT 100'
  ).all();
  return json({ ok: true, history: rows.results });
}

async function devKPIs(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const [empresas, usuarios, obras, bobinas, fichajesHoy, incAbiertas, sesiones, invitaciones] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as n FROM empresas WHERE activo = 1").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM usuarios WHERE activo = 1").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM obras WHERE estado = 'activa'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM bobinas").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM fichajes WHERE DATE(entrada) = DATE('now')").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM incidencias WHERE estado = 'abierta'").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM sesiones").first(),
    env.DB.prepare("SELECT COUNT(*) as n FROM invitaciones WHERE usado = 0 AND expira_at > datetime('now')").first(),
  ]);
  return json({ ok: true, kpis: {
    empresas: empresas?.n ?? 0,
    usuarios: usuarios?.n ?? 0,
    obras: obras?.n ?? 0,
    bobinas: bobinas?.n ?? 0,
    fichajes_hoy: fichajesHoy?.n ?? 0,
    incidencias_abiertas: incAbiertas?.n ?? 0,
    sesiones_activas: sesiones?.n ?? 0,
    invitaciones_activas: invitaciones?.n ?? 0,
  }});
}

async function devR2List(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  if (!env.R2) return json({ ok: true, objects: [], truncated: false });
  const listed = await env.R2.list({ limit: 500 });
  const objects = listed.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded?.toISOString?.() || o.uploaded }));
  return json({ ok: true, objects, truncated: listed.truncated });
}

async function devR2Delete(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const { key } = await request.json().catch(() => ({}));
  if (!key) return err('Falta key', 400);
  if (!env.R2) return err('R2 no configurado', 503);
  await env.R2.delete(key);
  return json({ ok: true });
}

async function devCambiarRol(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const { usuario_id, rol } = await request.json().catch(() => ({}));
  const rolesValidos = ['superadmin','empresa_admin','encargado','jefe_de_obra','oficina','operario','desarrollador'];
  if (!usuario_id || !rolesValidos.includes(rol)) return err('Datos inválidos', 400);
  if (Number(usuario_id) === Number(s.usuario_id)) return err('No puedes cambiar tu propio rol desde aquí', 403);
  const u = await env.DB.prepare('SELECT id FROM usuarios WHERE id = ?').bind(usuario_id).first();
  if (!u) return err('Usuario no encontrado', 404);
  await env.DB.prepare('UPDATE usuarios SET rol = ? WHERE id = ?').bind(rol, usuario_id).run();
  return json({ ok: true });
}

async function devActivity(request, env) {
  const s = await getAuth(request, env);
  if (!s || !['superadmin','desarrollador'].includes(s.rol)) return err('Sin permiso', 403);
  const [fichajes, incidencias] = await Promise.all([
    env.DB.prepare(`
      SELECT DATE(entrada) as dia, COUNT(*) as total
      FROM fichajes WHERE entrada >= DATE('now', '-30 days')
      GROUP BY DATE(entrada) ORDER BY dia
    `).all(),
    env.DB.prepare(`
      SELECT DATE(fecha) as dia, COUNT(*) as total
      FROM incidencias WHERE fecha >= DATE('now', '-30 days')
      GROUP BY DATE(fecha) ORDER BY dia
    `).all(),
  ]);
  return json({ ok: true, fichajes: fichajes.results, incidencias: incidencias.results });
}
