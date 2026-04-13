// Alejandra Worker v2.0
// Base de datos: Cloudflare D1
// IA: Gemini 2.0 Flash
// Sync: Google Sheets automático en cada cambio
// Multi-obra + Roles (superadmin / encargado / operario)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Code, X-Obra-Id, X-Usuario, X-Rol, X-Codigo',
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

// ── Auth helper ──────────────────────────────────────────────────────────────
function getAuth(request, env) {
  const adminCode = request.headers.get('X-Admin-Code');
  const obraId    = request.headers.get('X-Obra-Id');
  const usuario   = request.headers.get('X-Usuario');
  const rol       = request.headers.get('X-Rol');
  const codigo    = request.headers.get('X-Codigo');
  const isAdmin   = env.ADMIN_CODE && adminCode === env.ADMIN_CODE;
  const isSuperadmin = rol === 'superadmin' || isAdmin;
  const isEncargado  = rol === 'encargado';
  return {
    isAdmin,
    isSuperadmin,
    isEncargado,
    rol: rol || (isAdmin ? 'superadmin' : null),
    obraId: obraId ? parseInt(obraId) : null,
    usuario: usuario || '',
    codigo: codigo || '',
  };
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
      // ── Rutas públicas (sin auth) ──────────────────────────────────────────
      if (path === '/scan'        && method === 'POST') return await handleScan(request, env);
      if (path === '/ocr'         && method === 'POST') return await handleOCR(request, env);
      if (path === '/log'         && method === 'POST') return await guardarLog(request, env);
      if (path === '/verificar'   && method === 'POST') return await verificarAcceso(request, env);
      if (path === '/acceso'      && method === 'POST') return await verificarAcceso(request, env); // alias legacy

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
      if (path === '/proveedores'  && method === 'GET')   return await getCatalogo('proveedores', env);
      if (path === '/proveedores'  && method === 'POST')  return await addCatalogo('proveedores', request, env);
      if (path.startsWith('/proveedores/') && method === 'DELETE') return await deleteCatalogo('proveedores', path.split('/proveedores/')[1], env);

      if (path === '/tipos-cable'  && method === 'GET')   return await getCatalogo('tipos_cable', env);
      if (path === '/tipos-cable'  && method === 'POST')  return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos-cable/') && method === 'DELETE') return await deleteCatalogo('tipos_cable', path.split('/tipos-cable/')[1], env);

      // Legacy aliases for tipos-cable
      if (path === '/tipos'        && method === 'GET')   return await getCatalogo('tipos_cable', env);
      if (path === '/tipos'        && method === 'POST')  return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos/') && method === 'DELETE') return await deleteCatalogo('tipos_cable', path.split('/tipos/')[1], env);

      // ── Config ────────────────────────────────────────────────────────────
      if (path === '/config'       && method === 'GET')   return await getConfig(request, env);
      if (path === '/config'       && method === 'POST')  return await setConfig(request, env);

      // ── Export ────────────────────────────────────────────────────────────
      if (path === '/export'       && method === 'GET')   return await exportCSV(request, env);

      // ── Otros (legacy/extras) ─────────────────────────────────────────────
      if (path === '/logs'         && method === 'GET')   return await getLogs(request, env);
      if (path === '/historial'    && method === 'GET')   return await getHistorial(request, env);
      if (path === '/pemp/historial'         && method === 'GET') return await getHistorialTabla('historial_pemp', request, env);
      if (path === '/carretillas/historial'  && method === 'GET') return await getHistorialTabla('historial_carretillas', request, env);
      if (path === '/stats'        && method === 'GET')   return await getStats(request, env);
      if (path === '/sheet-id'     && method === 'GET')   return json({ id: env.GOOGLE_SHEET_ID || null });
      if (path === '/sync'         && method === 'POST')  { await syncSheets(env); return json({ ok: true, mensaje: 'Sync completado' }); }
      if (path === '/sync-debug'   && method === 'POST')  return await syncSheetsDebug(env);

      return err('Ruta no encontrada', 404);
    } catch (e) {
      console.error(e);
      return err(`Error interno: ${e.message}`, 500);
    }
  },
};

// ════════════════════════════════════════════════════════════════════════════
// VERIFICAR ACCESO
// ════════════════════════════════════════════════════════════════════════════

async function verificarAcceso(request, env) {
  const body = await request.json().catch(() => ({}));
  const codigo = body.codigo || body.code || '';
  const obraRef = body.obra_id || body.obra || null; // obra_id o nombre/codigo de obra

  if (!codigo) return err('Falta el código');

  // 1. ¿Es superadmin?
  if (env.ADMIN_CODE && codigo.trim() === env.ADMIN_CODE) {
    return json({ ok: true, rol: 'superadmin', nombre: 'Admin', obra_id: null, obra_nombre: null });
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
      return json({
        ok: true,
        nombre: usuario.nombre,
        rol: usuario.rol,
        obra_id: usuario.obra_id,
        obra_nombre: usuario.obra_nombre,
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
    if (obra) return json({ ok: true, tipo: 'obra', rol: 'operario', obra_id: obra.id, obra_nombre: obra.nombre, obra });
  } catch (_) {}

  return err('Código inválido', 401);
}

// ════════════════════════════════════════════════════════════════════════════
// OBRAS
// ════════════════════════════════════════════════════════════════════════════

async function getObras(request, env) {
  const { isSuperadmin, isAdmin } = getAuth(request, env);
  if (!isSuperadmin && !isAdmin) return err('No autorizado', 403);
  const { results } = await env.DB.prepare('SELECT * FROM obras ORDER BY nombre').all();
  return json(results);
}

async function crearObra(request, env) {
  const { isSuperadmin, isAdmin } = getAuth(request, env);
  if (!isSuperadmin && !isAdmin) return err('No autorizado', 403);
  const { nombre, codigo } = await request.json();
  if (!nombre?.trim() || !codigo?.trim()) return err('Faltan nombre y código');
  try {
    const r = await env.DB.prepare('INSERT INTO obras (nombre, codigo) VALUES (?, ?)')
      .bind(nombre.trim(), codigo.trim().toUpperCase()).run();
    return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim(), codigo: codigo.trim().toUpperCase() }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`El código "${codigo}" ya existe`, 409);
    throw e;
  }
}

async function eliminarObra(id, request, env) {
  const { isSuperadmin, isAdmin } = getAuth(request, env);
  if (!isSuperadmin && !isAdmin) return err('No autorizado', 403);
  await env.DB.prepare('UPDATE obras SET activa = 0 WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ════════════════════════════════════════════════════════════════════════════
// BOBINAS
// ════════════════════════════════════════════════════════════════════════════

async function getBobinas(request, env) {
  const { obraId } = getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');
  const obraFilter = obraId || null;

  let sql = 'SELECT * FROM bobinas WHERE 1=1';
  const params = [];
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
  const { obraId, usuario } = getAuth(request, env);
  const body = await request.json();
  const { codigo, proveedor, tipo_cable, notas, registrado_por } = body;
  if (!codigo || !proveedor || !tipo_cable) return err('Faltan campos: codigo, proveedor, tipo_cable');

  const obraFinal = body.obra_id ? parseInt(body.obra_id) : obraId;
  const fecha = fechaEspana();
  const reg = registrado_por || usuario || '';

  try {
    await env.DB.prepare(
      'INSERT INTO bobinas (codigo, proveedor, tipo_cable, fecha_entrada, estado, notas, registrado_por, obra_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(codigo.trim().toUpperCase(), proveedor, tipo_cable, fecha, 'activa', notas || '', reg, obraFinal || null).run();

    ctx.waitUntil(Promise.all([
      syncSheets(env),
      registrarHistorial(env, { obra_id: obraFinal, bobina_codigo: codigo.trim().toUpperCase(), accion: 'entrada', usuario: reg, notas: notas || '' }),
    ]));

    return json({ ok: true, mensaje: `Bobina ${codigo} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La bobina ${codigo} ya está registrada`, 409);
    throw e;
  }
}

async function editarBobina(codigo, request, env) {
  const { obraId } = getAuth(request, env);
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (obraId && bobina.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const proveedor  = body.proveedor  !== undefined ? body.proveedor  : bobina.proveedor;
  const tipo_cable = body.tipo_cable !== undefined ? body.tipo_cable : bobina.tipo_cable;
  const notas      = body.notas      !== undefined ? body.notas      : bobina.notas;
  const estado     = body.estado     !== undefined ? body.estado     : bobina.estado;

  await env.DB.prepare(
    'UPDATE bobinas SET proveedor = ?, tipo_cable = ?, notas = ?, estado = ? WHERE codigo = ?'
  ).bind(proveedor, tipo_cable, notas, estado, codigo).run();

  return json({ ok: true, mensaje: `Bobina ${codigo} actualizada` });
}

async function devolverBobina(codigo, request, env, ctx) {
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (bobina.estado === 'devuelta') return err(`Bobina ${codigo} ya fue devuelta el ${bobina.fecha_devolucion}`, 409);

  const fecha = fechaEspana();
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;

  await env.DB.prepare(
    'UPDATE bobinas SET estado = ?, fecha_devolucion = ?, notas = ?, devuelto_por = ? WHERE codigo = ?'
  ).bind('devuelta', fecha, notas || bobina.notas || '', devuelto_por || '', codigo).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env),
    registrarHistorial(env, { obra_id: bobina.obra_id, bobina_codigo: codigo, accion: 'devolucion', usuario: devuelto_por, notas: notas || '' }),
  ]));

  return json({ ok: true, mensaje: `Bobina ${codigo} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarBobina(codigo, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId } = getAuth(request, env);
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && bobina.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM bobinas WHERE codigo = ?').bind(codigo).run();

  ctx.waitUntil(Promise.all([
    syncSheets(env),
    registrarHistorial(env, { obra_id: bobina.obra_id, bobina_codigo: codigo, accion: 'eliminacion', usuario: '' }),
  ]));

  return json({ ok: true, mensaje: `Bobina ${codigo} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// PEMP
// ════════════════════════════════════════════════════════════════════════════

async function getPemp(request, env) {
  const { obraId } = getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');

  let sql = 'SELECT * FROM pemp WHERE 1=1';
  const params = [];
  if (obraId)  { sql += ' AND obra_id = ?'; params.push(obraId); }
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
  const { obraId, usuario } = getAuth(request, env);
  const body = await request.json();
  const {
    matricula, tipo, marca, proveedor, estado = 'activa',
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
        (matricula, tipo, marca, proveedor, estado, fecha_entrada, registrado_por, notas,
         fecha_ultima_revision, fecha_proxima_revision, obra_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      matricula.trim().toUpperCase(), tipo || '', marca || '', proveedor || '',
      estado, fecha, reg, notas || '',
      fecha_ultima_revision || null, fecha_proxima_revision || null,
      obraFinal || null
    ).run();

    const id = r.meta.last_row_id;

    ctx.waitUntil(
      registrarHistorialPemp(env, {
        obra_id: obraFinal, matricula: matricula.trim().toUpperCase(),
        accion: 'entrada', usuario: reg, notas: notas || '',
      })
    );

    return json({ ok: true, id, mensaje: `PEMP ${matricula} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La PEMP ${matricula} ya está registrada`, 409);
    throw e;
  }
}

async function editarPemp(id, request, env) {
  const { obraId } = getAuth(request, env);
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE id = ?').bind(id).first();
  if (!pemp) return err(`PEMP ${id} no encontrada`, 404);
  if (obraId && pemp.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const campos = ['matricula', 'tipo', 'marca', 'proveedor', 'estado', 'notas', 'fecha_ultima_revision', 'fecha_proxima_revision'];
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (sets.length === 0) return err('No hay campos para actualizar');
  vals.push(id);

  await env.DB.prepare(`UPDATE pemp SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true, mensaje: `PEMP ${id} actualizada` });
}

async function devolverPemp(id, request, env, ctx) {
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE id = ?').bind(id).first();
  if (!pemp) return err(`PEMP ${id} no encontrada`, 404);
  if (pemp.estado === 'devuelta') return err(`PEMP ${id} ya fue devuelta el ${pemp.fecha_devolucion}`, 409);

  const fecha = fechaEspana();
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;

  await env.DB.prepare(
    'UPDATE pemp SET estado = ?, fecha_devolucion = ?, devuelto_por = ?, notas = ? WHERE id = ?'
  ).bind('devuelta', fecha, devuelto_por || '', notas || pemp.notas || '', id).run();

  ctx.waitUntil(
    registrarHistorialPemp(env, {
      obra_id: pemp.obra_id, matricula: pemp.matricula,
      accion: 'devolucion', usuario: devuelto_por, notas: notas || '',
    })
  );

  return json({ ok: true, mensaje: `PEMP ${id} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarPemp(id, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId } = getAuth(request, env);
  const pemp = await env.DB.prepare('SELECT * FROM pemp WHERE id = ?').bind(id).first();
  if (!pemp) return err(`PEMP ${id} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && pemp.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM pemp WHERE id = ?').bind(id).run();
  return json({ ok: true, mensaje: `PEMP ${id} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// CARRETILLAS
// ════════════════════════════════════════════════════════════════════════════

async function getCarretillas(request, env) {
  const { obraId } = getAuth(request, env);
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');

  let sql = 'SELECT * FROM carretillas WHERE 1=1';
  const params = [];
  if (obraId)  { sql += ' AND obra_id = ?'; params.push(obraId); }
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
  const { obraId, usuario } = getAuth(request, env);
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
         fecha_ultima_revision, fecha_proxima_revision, obra_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      matricula.trim().toUpperCase(), tipo || '', marca || '', proveedor || '', energia || '',
      estado, fecha, reg, notas || '',
      fecha_ultima_revision || null, fecha_proxima_revision || null,
      obraFinal || null
    ).run();

    const id = r.meta.last_row_id;

    ctx.waitUntil(
      registrarHistorialCarretillas(env, {
        obra_id: obraFinal, matricula: matricula.trim().toUpperCase(),
        accion: 'entrada', usuario: reg, notas: notas || '',
      })
    );

    return json({ ok: true, id, mensaje: `Carretilla ${matricula} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La carretilla ${matricula} ya está registrada`, 409);
    throw e;
  }
}

async function editarCarretilla(id, request, env) {
  const { obraId } = getAuth(request, env);
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE id = ?').bind(id).first();
  if (!carretilla) return err(`Carretilla ${id} no encontrada`, 404);
  if (obraId && carretilla.obra_id !== obraId) return err('No autorizado', 403);

  const body = await request.json().catch(() => ({}));
  const campos = ['matricula', 'tipo', 'marca', 'proveedor', 'energia', 'estado', 'notas', 'fecha_ultima_revision', 'fecha_proxima_revision'];
  const sets = [];
  const vals = [];
  for (const c of campos) {
    if (body[c] !== undefined) { sets.push(`${c} = ?`); vals.push(body[c]); }
  }
  if (sets.length === 0) return err('No hay campos para actualizar');
  vals.push(id);

  await env.DB.prepare(`UPDATE carretillas SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  return json({ ok: true, mensaje: `Carretilla ${id} actualizada` });
}

async function devolverCarretilla(id, request, env, ctx) {
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE id = ?').bind(id).first();
  if (!carretilla) return err(`Carretilla ${id} no encontrada`, 404);
  if (carretilla.estado === 'devuelta') return err(`Carretilla ${id} ya fue devuelta el ${carretilla.fecha_devolucion}`, 409);

  const fecha = fechaEspana();
  const body = await request.json().catch(() => ({}));
  const { notas, devuelto_por } = body;

  await env.DB.prepare(
    'UPDATE carretillas SET estado = ?, fecha_devolucion = ?, devuelto_por = ?, notas = ? WHERE id = ?'
  ).bind('devuelta', fecha, devuelto_por || '', notas || carretilla.notas || '', id).run();

  ctx.waitUntil(
    registrarHistorialCarretillas(env, {
      obra_id: carretilla.obra_id, matricula: carretilla.matricula,
      accion: 'devolucion', usuario: devuelto_por, notas: notas || '',
    })
  );

  return json({ ok: true, mensaje: `Carretilla ${id} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarCarretilla(id, request, env, ctx) {
  const { isSuperadmin, isAdmin, obraId } = getAuth(request, env);
  const carretilla = await env.DB.prepare('SELECT * FROM carretillas WHERE id = ?').bind(id).first();
  if (!carretilla) return err(`Carretilla ${id} no encontrada`, 404);
  if (!isSuperadmin && !isAdmin && carretilla.obra_id !== obraId) return err('No autorizado', 403);

  await env.DB.prepare('DELETE FROM carretillas WHERE id = ?').bind(id).run();
  return json({ ok: true, mensaje: `Carretilla ${id} eliminada` });
}

// ════════════════════════════════════════════════════════════════════════════
// TRANSFERIR (bobinas / pemp / carretillas)
// ════════════════════════════════════════════════════════════════════════════

async function transferirRecurso(tabla, id, request, env) {
  const { isSuperadmin, isAdmin, isEncargado } = getAuth(request, env);
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
  const { isSuperadmin, isAdmin, isEncargado, obraId } = getAuth(request, env);

  let sql;
  const params = [];

  if (isSuperadmin || isAdmin) {
    sql = 'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE u.activo = 1 ORDER BY u.nombre';
  } else if (isEncargado && obraId) {
    sql = 'SELECT u.*, o.nombre as obra_nombre FROM usuarios u LEFT JOIN obras o ON u.obra_id = o.id WHERE u.obra_id = ? AND u.activo = 1 ORDER BY u.nombre';
    params.push(obraId);
  } else {
    return err('No autorizado', 403);
  }

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearUsuario(request, env) {
  const { isSuperadmin, isAdmin, isEncargado, obraId } = getAuth(request, env);
  if (!isSuperadmin && !isAdmin && !isEncargado) return err('No autorizado', 403);

  const body = await request.json();
  const { nombre, codigo, rol, obra_id } = body;
  if (!nombre?.trim() || !codigo?.trim()) return err('Faltan nombre y código');

  const obraFinal = obra_id ? parseInt(obra_id) : obraId;

  // Encargado solo puede crear usuarios de su propia obra
  if (isEncargado && !isSuperadmin && !isAdmin && obraFinal !== obraId) {
    return err('No autorizado para crear usuarios en otra obra', 403);
  }

  try {
    const r = await env.DB.prepare(
      'INSERT INTO usuarios (nombre, codigo, rol, obra_id, activo) VALUES (?, ?, ?, ?, 1)'
    ).bind(nombre.trim(), codigo.trim(), rol || 'operario', obraFinal || null).run();
    return json({ ok: true, id: r.meta.last_row_id, nombre: nombre.trim(), rol: rol || 'operario' }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`El código "${codigo}" ya existe`, 409);
    throw e;
  }
}

async function eliminarUsuario(id, request, env) {
  const { isSuperadmin, isAdmin, isEncargado, obraId } = getAuth(request, env);

  const usuario = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
  if (!usuario) return err('Usuario no encontrado', 404);

  if (!isSuperadmin && !isAdmin) {
    if (isEncargado && usuario.obra_id !== obraId) return err('No autorizado', 403);
    if (!isEncargado) return err('No autorizado', 403);
  }

  await env.DB.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').bind(id).run();
  return json({ ok: true, mensaje: 'Usuario eliminado' });
}

async function editarUsuario(id, request, env) {
  const { isSuperadmin, isAdmin, isEncargado, obraId } = getAuth(request, env);

  const usuario = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first();
  if (!usuario) return err('Usuario no encontrado', 404);

  if (!isSuperadmin && !isAdmin) {
    if (isEncargado && usuario.obra_id !== obraId) return err('No autorizado', 403);
    if (!isEncargado) return err('No autorizado', 403);
  }

  const body = await request.json().catch(() => ({}));
  const campos = ['nombre', 'codigo', 'rol', 'obra_id'];
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
  const { isSuperadmin, isAdmin } = getAuth(request, env);
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

async function getCatalogo(tabla, env) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${tabla} ORDER BY nombre`).all();
  return json(results);
}

async function addCatalogo(tabla, request, env) {
  const { nombre } = await request.json();
  if (!nombre?.trim()) return err('Falta el nombre');
  try {
    const r = await env.DB.prepare(`INSERT INTO ${tabla} (nombre) VALUES (?)`).bind(nombre.trim()).run();
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
  const { obraId } = getAuth(request, env);
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
  const { obraId } = getAuth(request, env);
  const url = new URL(request.url);
  const limit  = parseInt(url.searchParams.get('limit') || '100');
  const accion = url.searchParams.get('accion');
  const f      = obraId || null;

  let sql = 'SELECT * FROM historial WHERE 1=1';
  const params = [];
  if (f)      { sql += ' AND obra_id = ?'; params.push(f); }
  if (accion) { sql += ' AND accion = ?';  params.push(accion); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function getHistorialTabla(tabla, request, env) {
  const { obraId } = getAuth(request, env);
  const url = new URL(request.url);
  const limit  = parseInt(url.searchParams.get('limit') || '100');
  const accion = url.searchParams.get('accion');
  const f      = obraId || null;

  let sql = `SELECT * FROM ${tabla} WHERE 1=1`;
  const params = [];
  if (f)      { sql += ' AND obra_id = ?'; params.push(f); }
  if (accion) { sql += ' AND accion = ?';  params.push(accion); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════════════════════

async function getStats(request, env) {
  const { obraId } = getAuth(request, env);
  const f = obraId || null;
  const w = f ? ' AND obra_id = ?' : '';
  const p = f ? [f] : [];

  const [totalB, activasB, devueltasB, totalP, activasP, devueltasP, totalC, activasC, devueltasC] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) as n FROM bobinas WHERE 1=1${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM bobinas WHERE estado = 'activa'${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM bobinas WHERE estado = 'devuelta'${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM pemp WHERE 1=1${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM pemp WHERE estado = 'activa'${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM pemp WHERE estado = 'devuelta'${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM carretillas WHERE 1=1${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM carretillas WHERE estado = 'activa'${w}`).bind(...p).first(),
    env.DB.prepare(`SELECT COUNT(*) as n FROM carretillas WHERE estado = 'devuelta'${w}`).bind(...p).first(),
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

async function guardarLog(request, env) {
  try {
    const { nivel = 'info', origen, mensaje, detalle } = await request.json();
    await env.DB.prepare(
      'INSERT INTO logs (nivel, origen, mensaje, detalle) VALUES (?, ?, ?, ?)'
    ).bind(nivel, origen || 'app', mensaje, detalle ? JSON.stringify(detalle) : null).run();
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

async function getGoogleToken(env, scope = 'https://www.googleapis.com/auth/spreadsheets') {
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
  return data.access_token;
}

async function syncSheets(env) {
  if (!env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_SHEET_ID) return;

  try {
    const token   = await getGoogleToken(env);
    const sheetId = env.GOOGLE_SHEET_ID;
    const authH   = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Asegurar que existen las 3 pestañas fijas
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, { headers: authH });
    const meta = await metaRes.json();
    const sheetNames = (meta.sheets || []).map(s => s.properties.title);

    const tabsNecesarias = ['Bobinas', 'PEMP', 'Carretillas'];
    const requests = tabsNecesarias
      .filter(t => !sheetNames.includes(t))
      .map(t => ({ addSheet: { properties: { title: t } } }));

    if (requests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST', headers: authH, body: JSON.stringify({ requests }),
      });
    }

    const writeTab = async (tab, values) => {
      const range = `'${tab}'!A1`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:clear`,
        { method: 'POST', headers: authH });
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        { method: 'PUT', headers: authH, body: JSON.stringify({ values }) });
    };

    // ── BOBINAS ──────────────────────────────────────────────────────────────
    const { results: bobinas } = await env.DB.prepare(
      'SELECT b.*, o.nombre as obra_nombre FROM bobinas b LEFT JOIN obras o ON b.obra_id = o.id ORDER BY b.created_at DESC'
    ).all();
    await writeTab('Bobinas', [
      ['Obra', 'Código', 'Proveedor', 'Tipo Cable', 'Registrado por', 'Fecha Entrada', 'Devuelto por', 'Fecha Devolución', 'Estado', 'Notas'],
      ...bobinas.map(b => [b.obra_nombre || '', b.codigo, b.proveedor, b.tipo_cable, b.registrado_por || '', b.fecha_entrada, b.devuelto_por || '', b.fecha_devolucion || '', b.estado, b.notas || '']),
    ]);

    // ── PEMP ─────────────────────────────────────────────────────────────────
    const { results: pemp } = await env.DB.prepare(
      'SELECT p.*, o.nombre as obra_nombre FROM pemp p LEFT JOIN obras o ON p.obra_id = o.id ORDER BY p.created_at DESC'
    ).all();
    await writeTab('PEMP', [
      ['Obra', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Estado', 'Fecha Entrada', 'Devuelto por', 'Fecha Devolución', 'Últ. Revisión', 'Próx. Revisión', 'Registrado por', 'Notas'],
      ...pemp.map(p => [p.obra_nombre || '', p.matricula, p.tipo || '', p.marca || '', p.proveedor || '', p.estado, p.fecha_entrada, p.devuelto_por || '', p.fecha_devolucion || '', p.fecha_ultima_revision || '', p.fecha_proxima_revision || '', p.registrado_por || '', p.notas || '']),
    ]);

    // ── CARRETILLAS ───────────────────────────────────────────────────────────
    const { results: carretillas } = await env.DB.prepare(
      'SELECT c.*, o.nombre as obra_nombre FROM carretillas c LEFT JOIN obras o ON c.obra_id = o.id ORDER BY c.created_at DESC'
    ).all();
    await writeTab('Carretillas', [
      ['Obra', 'Matrícula', 'Tipo', 'Marca', 'Proveedor', 'Energía', 'Estado', 'Fecha Entrada', 'Devuelto por', 'Fecha Devolución', 'Últ. Revisión', 'Próx. Revisión', 'Registrado por', 'Notas'],
      ...carretillas.map(c => [c.obra_nombre || '', c.matricula, c.tipo || '', c.marca || '', c.proveedor || '', c.energia || '', c.estado, c.fecha_entrada, c.devuelto_por || '', c.fecha_devolucion || '', c.fecha_ultima_revision || '', c.fecha_proxima_revision || '', c.registrado_por || '', c.notas || '']),
    ]);

    console.log(`Sheets sincronizado: ${bobinas.length} bobinas, ${pemp.length} PEMP, ${carretillas.length} carretillas`);
  } catch (e) {
    console.error('Error sync Sheets:', e.message);
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
