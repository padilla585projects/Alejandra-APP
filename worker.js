// GestiBobina Worker v3.3
// Base de datos: Cloudflare D1
// IA: Gemini 1.5 Flash
// Sync: Google Sheets automático en cada cambio

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === '/scan' && method === 'POST')         return await handleScan(request, env);
      if (path === '/bobinas' && method === 'GET')       return await getBobinas(request, env);
      if (path === '/bobinas' && method === 'POST')      return await crearBobina(request, env, ctx);
      if (path.startsWith('/bobinas/') && method === 'PUT')    return await devolverBobina(decodeURIComponent(path.split('/bobinas/')[1]), request, env, ctx);
      if (path.startsWith('/bobinas/') && method === 'DELETE') return await eliminarBobina(decodeURIComponent(path.split('/bobinas/')[1]), env, ctx);
      if (path === '/proveedores' && method === 'GET')   return await getCatalogo('proveedores', env);
      if (path === '/proveedores' && method === 'POST')  return await addCatalogo('proveedores', request, env);
      if (path.startsWith('/proveedores/') && method === 'DELETE') return await deleteCatalogo('proveedores', path.split('/proveedores/')[1], env);
      if (path === '/tipos' && method === 'GET')         return await getCatalogo('tipos_cable', env);
      if (path === '/tipos' && method === 'POST')        return await addCatalogo('tipos_cable', request, env);
      if (path.startsWith('/tipos/') && method === 'DELETE') return await deleteCatalogo('tipos_cable', path.split('/tipos/')[1], env);
      if (path === '/export' && method === 'GET')        return await exportCSV(env);
      if (path === '/stats' && method === 'GET')         return await getStats(env);
      if (path === '/sync' && method === 'POST')         { await syncSheets(env); return json({ ok: true, mensaje: 'Sync completado' }); }
      if (path === '/sync-debug' && method === 'POST')  { return await syncSheetsDebug(env); }

      return err('Ruta no encontrada', 404);
    } catch (e) {
      console.error(e);
      return err(`Error interno: ${e.message}`, 500);
    }
  },
};

// ── Google Sheets Auth (JWT / Service Account) ───────────────────────────────

async function getGoogleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64 = obj => btoa(JSON.stringify(obj))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const header  = b64({ alg: 'RS256', typ: 'JWT' });
  const payload = b64(claim);
  const input   = `${header}.${payload}`;

  // Limpiar la clave PEM — manejo robusto de distintos formatos
  const pem = env.GOOGLE_PRIVATE_KEY
    .replace(/^["']|["']$/g, '')   // Quitar comillas si las tiene
    .replace(/\\n/g, '\n')         // \n escapado → salto de línea real
    .replace(/\\r/g, '');          // \r escapado

  // Extraer solo las líneas base64 (ignorar cabecera/pie)
  const pemBody = pem
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('-----'))
    .join('');

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

// ── Sync completo a Google Sheets ────────────────────────────────────────────

async function syncSheets(env) {
  if (!env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_SHEET_ID) return;

  try {
    const token = await getGoogleToken(env);
    const { results } = await env.DB.prepare('SELECT * FROM bobinas ORDER BY created_at DESC').all();

    const cabecera = [['Código', 'Proveedor', 'Tipo Cable', 'Fecha Entrada', 'Fecha Devolución', 'Estado', 'Notas']];
    const filas = results.map(b => [
      b.codigo, b.proveedor, b.tipo_cable,
      b.fecha_entrada, b.fecha_devolucion || '',
      b.estado, b.notas || '',
    ]);

    const values = [...cabecera, ...filas];
    const sheetId = env.GOOGLE_SHEET_ID;

    // 1. Limpiar hoja
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:Z:clear`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    // 2. Escribir datos
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    });

    console.log(`Sheets sincronizado: ${filas.length} bobinas`);
  } catch (e) {
    // No bloqueamos la respuesta si falla el sync
    console.error('Error sync Sheets:', e.message);
  }
}

// ── Sync Debug ───────────────────────────────────────────────────────────────

async function syncSheetsDebug(env) {
  const log = [];
  try {
    log.push('Verificando variables...');
    log.push(`GOOGLE_CLIENT_EMAIL: ${env.GOOGLE_CLIENT_EMAIL ? '✅' : '❌ NO DEFINIDA'}`);
    log.push(`GOOGLE_PRIVATE_KEY: ${env.GOOGLE_PRIVATE_KEY ? '✅ (' + env.GOOGLE_PRIVATE_KEY.length + ' chars)' : '❌ NO DEFINIDA'}`);
    log.push(`GOOGLE_SHEET_ID: ${env.GOOGLE_SHEET_ID ? '✅ ' + env.GOOGLE_SHEET_ID : '❌ NO DEFINIDA'}`);

    log.push('Obteniendo token Google...');
    const token = await getGoogleToken(env);
    log.push(`Token: ✅ (${token.slice(0,20)}...)`);

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
    log.push(`❌ ERROR: ${e.message}`);
    return json({ ok: false, log, error: e.message });
  }
}

// ── Escaneo IA ───────────────────────────────────────────────────────────────

async function handleScan(request, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return err('GEMINI_API_KEY no configurada', 500);

  const body = await request.json();
  const imageData = body.image;
  const mimeType = body.mimeType || 'image/jpeg';
  if (!imageData) return err('Se requiere imagen en base64');

  const prompt = `Eres un lector OCR especializado en matrículas de bobinas de cable eléctrico.
Extrae ÚNICAMENTE el código alfanumérico principal de la matrícula/etiqueta visible en la imagen.
El código suele ser una combinación de letras y números (ej: AB1234, C-2891-X, 45872-B).
Responde SOLO con el código, sin explicaciones, sin espacios extra, sin puntos al final.
Si no puedes leer ningún código, responde: NO_LEIDO`;

  const geminiBody = {
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: imageData } },
      { text: prompt }
    ]}],
    generationConfig: { temperature: 0, maxOutputTokens: 50 },
  };

  for (const model of ['gemini-1.5-flash', 'gemini-1.5-flash-8b']) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
    );
    const data = await res.json();
    if (res.ok) {
      return json({ codigo: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'NO_LEIDO', modelo: model });
    }
    if (res.status !== 429) return json({ error: 'Error Gemini', details: data }, res.status);
  }

  return err('Cuota de Gemini agotada. Usa el modo OCR.', 429);
}

// ── CRUD Bobinas ─────────────────────────────────────────────────────────────

async function getBobinas(request, env) {
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado');
  const buscar = url.searchParams.get('q');

  let sql = 'SELECT * FROM bobinas WHERE 1=1';
  const params = [];
  if (estado) { sql += ' AND estado = ?'; params.push(estado); }
  if (buscar) {
    sql += ' AND (codigo LIKE ? OR proveedor LIKE ? OR tipo_cable LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearBobina(request, env, ctx) {
  const { codigo, proveedor, tipo_cable, notas } = await request.json();
  if (!codigo || !proveedor || !tipo_cable) return err('Faltan campos: codigo, proveedor, tipo_cable');

  const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  try {
    await env.DB.prepare(
      'INSERT INTO bobinas (codigo, proveedor, tipo_cable, fecha_entrada, estado, notas) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(codigo.trim().toUpperCase(), proveedor, tipo_cable, fecha, 'activa', notas || '').run();

    // Sync asíncrono — no bloquea la respuesta
    ctx.waitUntil(syncSheets(env));

    return json({ ok: true, mensaje: `Bobina ${codigo} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`La bobina ${codigo} ya está registrada`, 409);
    throw e;
  }
}

async function devolverBobina(codigo, request, env, ctx) {
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (bobina.estado === 'devuelta') return err(`Bobina ${codigo} ya fue devuelta el ${bobina.fecha_devolucion}`, 409);

  const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  const { notas } = await request.json().catch(() => ({}));

  await env.DB.prepare(
    'UPDATE bobinas SET estado = ?, fecha_devolucion = ?, notas = ? WHERE codigo = ?'
  ).bind('devuelta', fecha, notas || bobina.notas || '', codigo).run();

  ctx.waitUntil(syncSheets(env));

  return json({ ok: true, mensaje: `Bobina ${codigo} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarBobina(codigo, env, ctx) {
  const bobina = await env.DB.prepare('SELECT id FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);

  await env.DB.prepare('DELETE FROM bobinas WHERE codigo = ?').bind(codigo).run();

  ctx.waitUntil(syncSheets(env));

  return json({ ok: true, mensaje: `Bobina ${codigo} eliminada` });
}

// ── Catálogos ────────────────────────────────────────────────────────────────

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

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getStats(env) {
  const total     = await env.DB.prepare('SELECT COUNT(*) as n FROM bobinas').first();
  const activas   = await env.DB.prepare('SELECT COUNT(*) as n FROM bobinas WHERE estado = ?').bind('activa').first();
  const devueltas = await env.DB.prepare('SELECT COUNT(*) as n FROM bobinas WHERE estado = ?').bind('devuelta').first();
  return json({ total: total.n, activas: activas.n, devueltas: devueltas.n });
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────

async function exportCSV(env) {
  const { results } = await env.DB.prepare('SELECT * FROM bobinas ORDER BY created_at DESC').all();
  const cab  = 'Código,Proveedor,Tipo Cable,Fecha Entrada,Fecha Devolución,Estado,Notas';
  const filas = results.map(b =>
    [b.codigo, b.proveedor, b.tipo_cable, b.fecha_entrada, b.fecha_devolucion || '', b.estado, b.notas || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv  = [cab, ...filas].join('\n');
  const fecha = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gestibobina_${fecha}.csv"`,
      ...CORS,
    },
  });
}
