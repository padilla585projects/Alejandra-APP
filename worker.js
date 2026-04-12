// GestiBobina Worker - API completa
// Base de datos: Cloudflare D1
// IA: Gemini 1.5 Flash (tier gratuito)

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
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ── Escaneo IA ──────────────────────────────────────────────
      if (path === '/scan' && method === 'POST') {
        return await handleScan(request, env);
      }

      // ── Bobinas ─────────────────────────────────────────────────
      if (path === '/bobinas') {
        if (method === 'GET')  return await getBobinas(request, env);
        if (method === 'POST') return await crearBobina(request, env);
      }

      if (path.startsWith('/bobinas/') && method === 'PUT') {
        const codigo = decodeURIComponent(path.split('/bobinas/')[1]);
        return await devolverBobina(codigo, request, env);
      }

      if (path.startsWith('/bobinas/') && method === 'DELETE') {
        const codigo = decodeURIComponent(path.split('/bobinas/')[1]);
        return await eliminarBobina(codigo, env);
      }

      // ── Catálogos ────────────────────────────────────────────────
      if (path === '/proveedores' && method === 'GET') {
        return await getCatalogo('proveedores', env);
      }
      if (path === '/proveedores' && method === 'POST') {
        return await addCatalogo('proveedores', request, env);
      }
      if (path.startsWith('/proveedores/') && method === 'DELETE') {
        const id = path.split('/proveedores/')[1];
        return await deleteCatalogo('proveedores', id, env);
      }

      if (path === '/tipos' && method === 'GET') {
        return await getCatalogo('tipos_cable', env);
      }
      if (path === '/tipos' && method === 'POST') {
        return await addCatalogo('tipos_cable', request, env);
      }
      if (path.startsWith('/tipos/') && method === 'DELETE') {
        const id = path.split('/tipos/')[1];
        return await deleteCatalogo('tipos_cable', id, env);
      }

      // ── Exportar CSV ─────────────────────────────────────────────
      if (path === '/export' && method === 'GET') {
        return await exportCSV(env);
      }

      // ── Stats ────────────────────────────────────────────────────
      if (path === '/stats' && method === 'GET') {
        return await getStats(env);
      }

      return err('Ruta no encontrada', 404);

    } catch (e) {
      console.error(e);
      return err(`Error interno: ${e.message}`, 500);
    }
  },
};

// ── Handlers ────────────────────────────────────────────────────────────────

async function handleScan(request, env) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return err('GEMINI_API_KEY no configurada', 500);

  const body = await request.json();
  const imageData = body.image; // base64
  const mimeType = body.mimeType || 'image/jpeg';

  if (!imageData) return err('Se requiere imagen en base64');

  const prompt = `Eres un lector OCR especializado en matrículas de bobinas de cable eléctrico.
Extrae ÚNICAMENTE el código alfanumérico principal de la matrícula/etiqueta visible en la imagen.
El código suele ser una combinación de letras y números (ej: AB1234, C-2891-X, 45872-B).
Responde SOLO con el código, sin explicaciones, sin espacios extra, sin puntos al final.
Si no puedes leer ningún código, responde: NO_LEIDO`;

  const geminiBody = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageData } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 50,
    }
  };

  // Intentamos primero gemini-1.5-flash (mejor tier gratuito)
  const models = ['gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await res.json();

    if (res.ok) {
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'NO_LEIDO';
      return json({ codigo: texto, modelo: model });
    }

    // Si es 429 (cuota) probamos el siguiente modelo
    if (res.status !== 429) {
      return json({ error: 'Error Gemini', details: data, status: res.status }, res.status);
    }
  }

  return err('Cuota de Gemini agotada. Espera unos minutos e inténtalo de nuevo.', 429);
}

async function getBobinas(request, env) {
  const url = new URL(request.url);
  const estado = url.searchParams.get('estado'); // activa | devuelta
  const buscar = url.searchParams.get('q');

  let sql = 'SELECT * FROM bobinas WHERE 1=1';
  const params = [];

  if (estado) {
    sql += ' AND estado = ?';
    params.push(estado);
  }
  if (buscar) {
    sql += ' AND (codigo LIKE ? OR proveedor LIKE ? OR tipo_cable LIKE ?)';
    params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
  }

  sql += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(sql).bind(...params).all();
  return json(results);
}

async function crearBobina(request, env) {
  const body = await request.json();
  const { codigo, proveedor, tipo_cable, notas } = body;

  if (!codigo || !proveedor || !tipo_cable) {
    return err('Faltan campos: codigo, proveedor, tipo_cable');
  }

  const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

  try {
    await env.DB.prepare(
      'INSERT INTO bobinas (codigo, proveedor, tipo_cable, fecha_entrada, estado, notas) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(codigo.trim().toUpperCase(), proveedor, tipo_cable, fecha, 'activa', notas || '').run();

    return json({ ok: true, mensaje: `Bobina ${codigo} registrada` }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return err(`La bobina ${codigo} ya está registrada`, 409);
    }
    throw e;
  }
}

async function devolverBobina(codigo, request, env) {
  const bobina = await env.DB.prepare('SELECT * FROM bobinas WHERE codigo = ?').bind(codigo).first();

  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);
  if (bobina.estado === 'devuelta') return err(`Bobina ${codigo} ya fue devuelta el ${bobina.fecha_devolucion}`, 409);

  const fecha = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
  const body = await request.json().catch(() => ({}));
  const notas = body.notas || bobina.notas || '';

  await env.DB.prepare(
    'UPDATE bobinas SET estado = ?, fecha_devolucion = ?, notas = ? WHERE codigo = ?'
  ).bind('devuelta', fecha, notas, codigo).run();

  return json({ ok: true, mensaje: `Bobina ${codigo} devuelta correctamente`, fecha_devolucion: fecha });
}

async function eliminarBobina(codigo, env) {
  const bobina = await env.DB.prepare('SELECT id FROM bobinas WHERE codigo = ?').bind(codigo).first();
  if (!bobina) return err(`Bobina ${codigo} no encontrada`, 404);

  await env.DB.prepare('DELETE FROM bobinas WHERE codigo = ?').bind(codigo).run();
  return json({ ok: true, mensaje: `Bobina ${codigo} eliminada` });
}

async function getCatalogo(tabla, env) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${tabla} ORDER BY nombre`).all();
  return json(results);
}

async function addCatalogo(tabla, request, env) {
  const body = await request.json();
  const nombre = body.nombre?.trim();
  if (!nombre) return err('Falta el nombre');

  try {
    const r = await env.DB.prepare(`INSERT INTO ${tabla} (nombre) VALUES (?)`).bind(nombre).run();
    return json({ ok: true, id: r.meta.last_row_id, nombre }, 201);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return err(`"${nombre}" ya existe`, 409);
    throw e;
  }
}

async function deleteCatalogo(tabla, id, env) {
  await env.DB.prepare(`DELETE FROM ${tabla} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}

async function getStats(env) {
  const total = await env.DB.prepare('SELECT COUNT(*) as n FROM bobinas').first();
  const activas = await env.DB.prepare('SELECT COUNT(*) as n FROM bobinas WHERE estado = ?').bind('activa').first();
  const devueltas = await env.DB.prepare('SELECT COUNT(*) as n FROM bobinas WHERE estado = ?').bind('devuelta').first();

  return json({
    total: total.n,
    activas: activas.n,
    devueltas: devueltas.n,
  });
}

async function exportCSV(env) {
  const { results } = await env.DB.prepare('SELECT * FROM bobinas ORDER BY created_at DESC').all();

  const cabecera = 'Código,Proveedor,Tipo Cable,Fecha Entrada,Fecha Devolución,Estado,Notas';
  const filas = results.map(b =>
    [b.codigo, b.proveedor, b.tipo_cable, b.fecha_entrada, b.fecha_devolucion || '', b.estado, b.notas || '']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  );

  const csv = [cabecera, ...filas].join('\n');
  const fecha = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gestibobina_${fecha}.csv"`,
      ...CORS,
    },
  });
}
