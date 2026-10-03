// ADR-0029 — dataset de entrenamiento privado. Todo con R2 simulado: ninguna llamada real.
// Los datos personales de estos casos son INVENTADOS (no son de ningún usuario real).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsearArgs, prefijoListado, filtrarClaves, rutaDentroDelRepo, salidaPorDefecto, lineaJsonl, posiblesFugas,
} from '../scripts/ai-benchmark/exportar-dataset.mjs';
import {
  anonimizarTexto, anonimizarValor, crearContextoAnonimizacion, aprenderEntidades,
  esCorreccionUsuario, esBarreraConfirmacion, evaluarTurnoDataset, construirRegistroDataset,
  esClaveDatasetPrivada, DATASET_LIMITES,
} from './lib.js';
import {
  datasetActivo, procesarTurnoDataset, capturarTurnoDataset, resolverPendienteDataset,
  promoverPendientesCaducados, reservarCuota, clavePendiente, hashCorto,
  DATASET_MAX_DIA_EMPRESA, DATASET_HORAS_PROMOCION,
} from './dataset-entrenamiento.js';

// ── R2 simulado (get/put/list con etag y escritura condicional) ──────────────
function crearR2() {
  const objetos = new Map();
  let etagN = 0;
  const ops = { get: 0, put: 0, list: 0, delete: 0 };
  return {
    objetos, ops,
    async get(key) {
      ops.get++;
      const o = objetos.get(key);
      if (!o) return null;
      return { etag: o.etag, customMetadata: o.customMetadata, json: async () => JSON.parse(o.body), text: async () => o.body };
    },
    async put(key, body, opts = {}) {
      ops.put++;
      const cur = objetos.get(key);
      if (opts.onlyIf?.etagMatches && (!cur || cur.etag !== opts.onlyIf.etagMatches)) return null;
      const o = { body: String(body), etag: `e${++etagN}`, customMetadata: opts.customMetadata || {} };
      objetos.set(key, o);
      return { key, etag: o.etag };
    },
    async list({ prefix = '', cursor, limit = 1000 } = {}) {
      ops.list++;
      const claves = [...objetos.keys()].filter(k => k.startsWith(prefix)).sort();
      const desde = cursor ? +cursor : 0;
      const pagina = claves.slice(desde, desde + limit);
      const truncated = desde + limit < claves.length;
      return { objects: pagina.map(k => ({ key: k, customMetadata: objetos.get(k).customMetadata })), truncated, cursor: truncated ? String(desde + limit) : undefined };
    },
    async delete() { ops.delete++; throw new Error('el dataset nunca borra'); },
  };
}
const envCon = (R2, valor = '1') => ({ DATASET_ENTRENAMIENTO: valor, FILES: R2 });

const TOOLS = [
  { name: 'consultar_bd', description: 'Consulta SELECT', input_schema: { type: 'object', properties: { sql: { type: 'string' } } } },
  { name: 'listar_personal', description: 'Lista el personal', input_schema: { type: 'object', properties: {} } },
];
function trazaBuena(extra = {}) {
  return {
    authOk: true, esCron: false, adjuntos: 0, experto: 'app', modelo: 'claude-sonnet-4-6',
    texto_final: 'Tienes 3 bobinas en stock.', cortado: false, verificacionCorrigio: false,
    pasos: [{ texto: '', llamadas: [{ nombre: 'consultar_bd', input: { sql: 'SELECT COUNT(*) FROM bobinas' }, resultado: '{"ok":true,"filas":[{"n":3}]}', ok: true, permitida: true }] }],
    tools: TOOLS,
    ...extra,
  };
}
function respDe(traza) {
  return { texto: traza.texto_final, experto: traza.experto, modelo: traza.modelo, _dataset: { pasos: traza.pasos, cortado: traza.cortado, verificacionCorrigio: traza.verificacionCorrigio, busquedaPrevia: !!traza.busquedaPrevia, tools: traza.tools } };
}
const BASE = { empresa: 7, usuario_id: '42', authOk: true, esCron: false, adjuntos: null, usuarioLabel: 'Ramiro Inventado' };

// ══════════════════════════════════════════════════════════════════════════════
describe('anonimizarTexto — patrones', () => {
  const a = (t) => anonimizarTexto(t);

  it('emails', () => {
    expect(a('escribe a pepe.martin@obras-ejemplo.es ya')).toBe('escribe a <EMAIL> ya');
    expect(a('JUAN_X+obra@Mail.COM')).toBe('<EMAIL>');
  });

  it.each([
    '612345678', '612 345 678', '612-345-678', '612.345.678', '61 23 45 67 8',
    '+34612345678', '+34 612 345 678', '+34-612-34-56-78', '0034 612345678', '0034612345678',
    '712345678', '912345678', '91 123 45 67', '93-123-45-67', '876 54 32 10',
  ])('teléfono español %s', (tel) => {
    expect(a(`llama al ${tel} mañana`)).toBe('llama al <TELEFONO> mañana');
  });

  it('no confunde con teléfonos números cortos, fechas ni cantidades', () => {
    for (const t of ['30 mA', '300 mA', '2026-10-03', '1500 metros', '400 V', 'sección 2,5 mm2', '12345', 'bobina 512', '6.000.000 €']) {
      expect(a(t)).toBe(t);
    }
    expect(a('512345678')).toBe('512345678'); // empieza por 5: no es un móvil/fijo español
  });

  it.each([
    ['12345678Z', '<DNI>'], ['12345678-Z', '<DNI>'], ['12345678 Z', '<DNI>'],
    ['X1234567L', '<DNI>'], ['Y-1234567-X', '<DNI>'], ['Z 1234567 R', '<DNI>'],
    ['B12345678', '<CIF>'], ['A-1234567-0', '<CIF>'],
  ])('DNI/NIE/CIF %s', (doc, marcador) => {
    expect(a(`documento ${doc}.`)).toBe(`documento ${marcador}.`);
  });

  it('IBAN con y sin espacios', () => {
    expect(a('IBAN ES91 2100 0418 4502 0005 1332 gracias')).toBe('IBAN <IBAN> gracias');
    expect(a('ES9121000418450200051332')).toBe('<IBAN>');
    expect(a('ES91-2100-0418-4502-0005-1332')).toBe('<IBAN>');
  });

  it('tarjetas', () => {
    expect(a('tarjeta 4111 1111 1111 1111')).toBe('tarjeta <TARJETA>');
  });

  it('matrículas actuales y antiguas', () => {
    expect(a('la furgoneta 1234 BCD')).toBe('la furgoneta <MATRICULA>');
    expect(a('la furgoneta 1234-BCD')).toBe('la furgoneta <MATRICULA>');
    expect(a('la grúa 0000KLM')).toBe('la grúa <MATRICULA>');
    expect(a('coche M-1234-AB')).toBe('coche <MATRICULA>');
    // Con vocal no es matrícula actual (las matrículas no llevan vocales)
    expect(a('año 2026 ABC')).toBe('año 2026 ABC');
  });

  it('direcciones con número', () => {
    expect(a('Vivo en Calle Mayor 5, segundo')).toBe('Vivo en <DIRECCION>, segundo');
    expect(a('en c/ Alcalá, 45')).toBe('en <DIRECCION>');
    expect(a('Avda. de la Constitución, nº 12 B.')).toBe('<DIRECCION>.');
    expect(a('Avenida de América 3')).toBe('<DIRECCION>');
    expect(a('Pza. España 3')).toBe('<DIRECCION>');
    expect(a('Paseo de la Castellana número 200')).toBe('<DIRECCION>');
    expect(a('Ctra. de Toledo km 12')).toBe('<DIRECCION>');
    expect(a('Polígono Industrial Las Arenas s/n')).toBe('<DIRECCION>');
  });

  it('no toma por dirección palabras de vía sin número', () => {
    for (const t of ['la plaza de garaje', 'la ronda de revisión', 'por el camino de servicio', 'la calle está cortada']) {
      expect(a(t)).toBe(t);
    }
  });

  it('URLs (firmadas o no), tokens y claves', () => {
    expect(a('mira https://cuenta.r2.dev/e1/f.jpg?X-Amz-Signature=abc123 ya')).toBe('mira <URL> ya');
    expect(a('http://localhost:8787/api')).toBe('<URL>');
    expect(a('Authorization: Bearer abcDEF123456789xyz')).toBe('Authorization: Bearer <TOKEN>');
    expect(a('jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.c2lnbmF0dXJhLWZhbHNh')).toBe('jwt <TOKEN>');
    expect(a('clave sk-ant-api03-ABCDEFGHIJKLmnop')).toBe('clave <TOKEN>');
    expect(a('ghp_ABCDEFGHIJKLMNOP1234')).toBe('<TOKEN>');
    expect(a('hash 0123456789abcdef0123456789abcdef')).toBe('hash <TOKEN>');
    expect(a('password: Sup3rS3creta!')).toBe('<TOKEN>');
    expect(a('token=abcdef123456')).toBe('<TOKEN>');
  });

  it('imágenes en línea y rutas de ficheros del bucket', () => {
    expect(a('foto data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB fin')).toBe('foto <BINARIO> fin');
    expect(a('subido a chat_files/ramiro/foto.png')).toBe('subido a <ARCHIVO>');
    expect(a('e12/replanteo-escaneo/abc/f1.jpg')).toBe('<ARCHIVO>');
  });

  it('respeta el vocabulario técnico de la instaladora', () => {
    const t = 'Diferencial 30 mA tipo A, magnetotérmico C16, REBT ITC-BT-25, IP65, cuadro CGP, 3x2,5 mm2';
    expect(a(t)).toBe(t);
  });

  it('null y no-texto', () => {
    expect(anonimizarTexto(null)).toBe(null);
    expect(anonimizarTexto(612345678)).toBe('<TELEFONO>');
  });
});

describe('anonimizarTexto — nombres conocidos', () => {
  it('sustituye nombre completo y cada palabra, sin tildes ni mayúsculas, con marcador estable', () => {
    const ctx = crearContextoAnonimizacion({ personas: ['Ramiro Pérez Inventado', 'Lucía Gómez'] });
    expect(anonimizarTexto('Ramiro Pérez Inventado firmó', ctx)).toBe('<PERSONA_1> firmó');
    expect(anonimizarTexto('dile a ramiro y a PEREZ', ctx)).toBe('dile a <PERSONA_1> y a <PERSONA_1>');
    expect(anonimizarTexto('Lucia gomez y Lucía', ctx)).toBe('<PERSONA_2> y <PERSONA_2>');
  });

  it('no sustituye dentro de otras palabras', () => {
    const ctx = crearContextoAnonimizacion({ personas: ['Ana Sol'] });
    expect(anonimizarTexto('Ana revisa la solera y el panel solar', ctx)).toBe('<PERSONA_1> revisa la solera y el panel solar');
  });

  it('obras y empresas', () => {
    const ctx = crearContextoAnonimizacion({ obras: ['Hospital Norte', 'Nave Sur'], empresas: ['Instalaciones Ficticias S.L.'] });
    expect(anonimizarTexto('En Hospital Norte y en la nave sur para Instalaciones Ficticias S.L.', ctx))
      .toBe('En <OBRA_1> y en la <OBRA_2> para <EMPRESA>');
  });

  it('ignora nombres vacíos, cortos, numéricos o marcadores', () => {
    const ctx = crearContextoAnonimizacion({ personas: ['', 'Al', '123', '<PERSONA_1>', 'default', null] });
    expect(ctx.personas).toHaveLength(0);
  });

  it('aprende nombres de JSON por la clave y de texto «Operario: …»', () => {
    const ctx = crearContextoAnonimizacion();
    aprenderEntidades('{"filas":[{"nombre":"Tomás Ficticio","dni":"x","telefono":"x"},{"nombre":"Bobina RZ1","stock":3},{"obra":"Torre Inventada","cliente":"Cliente Falso SA"}]}', ctx);
    aprenderEntidades('Parte 12 — Operario: Germán Rodríguez — Obra: Parking Imaginario', ctx);
    expect(ctx.personas.map(p => p.texto)).toEqual(['Tomás Ficticio', 'Germán Rodríguez']);
    expect(ctx.obras.map(o => o.texto)).toEqual(['Torre Inventada', 'Parking Imaginario']);
    expect(ctx.empresas.map(e => e.texto)).toEqual(['Cliente Falso SA']);
  });
});

describe('anonimizarValor', () => {
  it('recorre objetos y arrays, conserva números y quita secretos y adjuntos', () => {
    const ctx = crearContextoAnonimizacion({ personas: ['Tomás Ficticio'] });
    const v = anonimizarValor({ sql: "SELECT * FROM personal WHERE nombre='Tomás Ficticio'", n: 3, ok: true, token: 'abc', adjuntos: ['chat_files/x.png'], lista: [{ email: 'a@b.es' }] }, ctx);
    expect(v).toEqual({ sql: "SELECT * FROM personal WHERE nombre='<PERSONA_1>'", n: 3, ok: true, token: '<TOKEN>', adjuntos: '<ADJUNTO_ELIMINADO>', lista: [{ email: '<EMAIL>' }] });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('esCorreccionUsuario', () => {
  it.each([
    'no', 'No, eso no', 'no es así', 'NO ES CORRECTO', 'mal', 'error', 'Incorrecto', 'eso no',
    'te has equivocado de obra', 'te equivocas', 'estás equivocada', 'corrige el total', 'corrígelo',
    'rectifica la fecha', 'está mal', 'no funciona', 'no me sirve', 'no has guardado nada',
    'te lo has inventado', 'eso no existe', 'otra vez mal', 'que no, que es la otra', '¡No!', 'no era eso',
  ])('detecta corrección: %s', (m) => expect(esCorreccionUsuario(m)).toBe(true));

  it.each([
    'vale gracias', 'perfecto', 'ahora dime las de noviembre', '¿y mañana?', 'genial, ahora el informe',
    'sí', 'nota: revisar el cuadro', 'normal', 'nombre del encargado', '',
  ])('no es corrección: %s', (m) => expect(esCorreccionUsuario(m)).toBe(false));
});

describe('esBarreraConfirmacion', () => {
  it('detecta las barreras de borrado, envío y revisión', () => {
    expect(esBarreraConfirmacion('⚠️ OPERACIÓN BLOQUEADA — requiere confirmación humana')).toBe(true);
    expect(esBarreraConfirmacion('⚠️ ENVÍO PENDIENTE DE CONFIRMACIÓN — para: x')).toBe(true);
    expect(esBarreraConfirmacion('escribe CONFIRMO BORRADO A1B2C3')).toBe(true);
    expect(esBarreraConfirmacion('{"ok":true}')).toBe(false);
  });
});

describe('evaluarTurnoDataset', () => {
  it('turno limpio → apto', () => expect(evaluarTurnoDataset(trazaBuena())).toEqual({ apto: true, motivo: 'ok' }));
  it.each([
    [{ authOk: false }, 'sin_sesion'],
    [{ esCron: true }, 'cron'],
    [{ adjuntos: 1 }, 'adjuntos'],
    [{ modelo: 'instant' }, 'saludo_instantaneo'],
    [{ texto_final: '' }, 'texto_vacio'],
    [{ texto_final: 'Error: timeout' }, 'texto_error'],
    [{ cortado: true }, 'cortado_timeout'],
    [{ verificacionCorrigio: true }, 'verificacion_corrigio'],
    [{ busquedaPrevia: true }, 'busqueda_web_previa'],
  ])('%o → %s', (extra, motivo) => expect(evaluarTurnoDataset(trazaBuena(extra)).motivo).toBe(motivo));

  it('tool con error, rechazada, con barrera o con imagen → no apto', () => {
    const conLlamada = (ll) => trazaBuena({ pasos: [{ texto: '', llamadas: [{ nombre: 'consultar_bd', input: {}, resultado: '{"ok":true}', ok: true, permitida: true, ...ll }] }] });
    expect(evaluarTurnoDataset(conLlamada({ ok: false, resultado: '{"ok":false,"error":"x"}' })).motivo).toBe('tool_error');
    expect(evaluarTurnoDataset(conLlamada({ resultado: '❌ No existe la tabla' })).motivo).toBe('tool_error');
    expect(evaluarTurnoDataset(conLlamada({ resultado: 'Error: SQLITE' })).motivo).toBe('tool_error');
    expect(evaluarTurnoDataset(conLlamada({ permitida: false, ok: false })).motivo).toBe('tool_rechazada');
    expect(evaluarTurnoDataset(conLlamada({ resultado: '⚠️ OPERACIÓN BLOQUEADA — requiere confirmación humana' })).motivo).toBe('barrera_confirmacion');
    expect(evaluarTurnoDataset(conLlamada({ resultado: '[{"type":"image","source":{}}]' })).motivo).toBe('imagen_en_tool');
  });
});

describe('construirRegistroDataset', () => {
  it('formato OpenAI completo y anonimizado en mensajes, argumentos y resultados', () => {
    const traza = trazaBuena({
      texto_final: 'Tomás Ficticio (612 345 678) está en Torre Inventada.',
      pasos: [{ texto: 'Lo miro.', llamadas: [{ nombre: 'listar_personal', input: { filtro: 'Tomás' }, resultado: JSON.stringify({ ok: true, filas: [{ nombre: 'Tomás Ficticio', telefono: '612345678', obra: 'Torre Inventada' }] }), ok: true, permitida: true }] }],
    });
    const r = construirRegistroDataset({ traza, mensaje: '¿Dónde está Tomás? Soy Ramiro Inventado', toolsDisponibles: TOOLS, personas: ['Ramiro Inventado'], empresaHash: 'abc', fecha: '2026-10-03T10:00:00Z' });
    const json = JSON.stringify(r);
    for (const prohibido of ['Tomás', 'Ficticio', 'Ramiro', '612', 'Torre Inventada']) expect(json).not.toContain(prohibido);
    expect(r.messages.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'assistant']);
    expect(r.messages[1].content).toBe('¿Dónde está <PERSONA_2>? Soy <PERSONA_1>');
    expect(r.messages[2].tool_calls[0]).toEqual({ id: 'call_1', type: 'function', function: { name: 'listar_personal', arguments: '{"filtro":"<PERSONA_2>"}' } });
    expect(r.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'call_1' });
    expect(r.messages[4].content).toBe('<PERSONA_2> (<TELEFONO>) está en <OBRA_1>.');
    expect(r.tools).toEqual([{ type: 'function', function: { name: 'listar_personal', description: 'Lista el personal', parameters: { type: 'object', properties: {} } } }]);
    expect(r.meta).toEqual({ experto: 'app', modelo: 'claude-sonnet-4-6', empresa_hash: 'abc', fecha: '2026-10-03', n_tools: 1, version: 1 });
  });

  it('el system no lleva datos de sesión', () => {
    const r = construirRegistroDataset({ traza: trazaBuena(), mensaje: 'hola', empresaHash: 'h', fecha: '2026-10-03' });
    expect(r.messages[0].content).toMatch(/^Eres Alejandra/);
    expect(r.messages[0].content).not.toMatch(/\d{4}-\d{2}-\d{2}|usuario|pantalla/i);
  });

  it('recorta resultados largos y descarta registros enormes', () => {
    const largo = 'x '.repeat(5000);
    const r = construirRegistroDataset({ traza: trazaBuena({ pasos: [{ texto: '', llamadas: [{ nombre: 'consultar_bd', input: {}, resultado: largo, ok: true, permitida: true }] }] }), mensaje: 'a', empresaHash: 'h', fecha: 'f' });
    expect(r.messages[3].content.length).toBeLessThanOrEqual(DATASET_LIMITES.resultadoTool + 20);
    const muchos = Array.from({ length: 60 }, () => ({ nombre: 'consultar_bd', input: { q: 'y'.repeat(1900) }, resultado: 'z '.repeat(1000), ok: true, permitida: true }));
    expect(construirRegistroDataset({ traza: trazaBuena({ pasos: [{ texto: '', llamadas: muchos }] }), mensaje: 'a', empresaHash: 'h', fecha: 'f' })).toBe(null);
  });
});

describe('esClaveDatasetPrivada', () => {
  it('reconoce los tres prefijos y nada más', () => {
    for (const k of ['dataset/e1/pendiente/x.json', 'dataset-bueno/e1/2026-10/a.json', 'dataset-cuota/e1/2026-10-03.json', '/dataset/x', 'DATASET/x', 'dataset', 'dataset-bueno/']) expect(esClaveDatasetPrivada(k)).toBe(true);
    for (const k of ['chat_files/dataset/x', 'e1/dataset/x', 'datasets.csv', '', null, 3]) expect(esClaveDatasetPrivada(k)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('dataset en R2 (simulado)', () => {
  it('interruptor apagado → cero operaciones de R2', async () => {
    for (const valor of [undefined, '', '0', 'true', 'si', '1 ']) {
      const R2 = crearR2();
      const env = valor === undefined ? { FILES: R2 } : envCon(R2, valor);
      if (valor === '1 ') { expect(datasetActivo(env)).toBe(true); continue; } // se recorta el espacio
      expect(datasetActivo(env)).toBe(false);
      const r = await procesarTurnoDataset(env, { ...BASE, mensaje: 'hola', resp: respDe(trazaBuena()) });
      expect(r.guardado).toBe(false);
      await resolverPendienteDataset(env, { ...BASE, mensaje: 'no' });
      await promoverPendientesCaducados(env);
      expect(R2.ops).toEqual({ get: 0, put: 0, list: 0, delete: 0 });
    }
  });

  it('turno bueno → pendiente; siguiente mensaje normal → promovido a dataset-bueno', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    const t0 = Date.parse('2026-10-03T10:00:00Z');
    const r1 = await procesarTurnoDataset(env, { ...BASE, mensaje: '¿cuántas bobinas?', resp: respDe(trazaBuena()), ahora: t0 });
    expect(r1).toMatchObject({ resuelto: 'sin_pendiente', guardado: true, motivo: 'pendiente' });
    const kp = clavePendiente(7, await hashCorto('42'));
    expect(kp).toMatch(/^dataset\/e7\/pendiente\/[0-9a-f]{16}\.json$/);
    expect(JSON.parse(R2.objetos.get(kp).body).estado).toBe('pendiente');

    const r2 = await procesarTurnoDataset(env, { ...BASE, mensaje: 'vale, ¿y de cable?', resp: { texto: 'x' }, ahora: t0 + 60000 });
    expect(r2.resuelto).toBe('promovido');
    const buenos = [...R2.objetos.keys()].filter(k => k.startsWith('dataset-bueno/'));
    expect(buenos).toHaveLength(1);
    expect(buenos[0]).toMatch(/^dataset-bueno\/e7\/2026-10\/2026-10-03-[0-9a-f]{16}\.json$/);
    const reg = JSON.parse(R2.objetos.get(buenos[0]).body);
    expect(reg.messages[1].content).toBe('¿cuántas bobinas?');
    expect(reg.meta.empresa_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(reg)).not.toContain('"empresa":');
    expect(JSON.parse(R2.objetos.get(kp).body).estado).toBe('promovido');
    expect(R2.ops.delete).toBe(0);
  });

  it('corrección del usuario → descartado (sin promover y sin borrar)', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    await procesarTurnoDataset(env, { ...BASE, mensaje: '¿cuántas bobinas?', resp: respDe(trazaBuena()), ahora: 1000 });
    const r = await resolverPendienteDataset(env, { ...BASE, mensaje: 'No, te has equivocado, son 5', ahora: 2000 });
    expect(r).toBe('descartado');
    expect([...R2.objetos.keys()].some(k => k.startsWith('dataset-bueno/'))).toBe(false);
    const kp = clavePendiente(7, await hashCorto('42'));
    expect(R2.objetos.get(kp).body).not.toContain('bobinas');
    expect(R2.ops.delete).toBe(0);
  });

  it('corrección que llega pasadas las horas de espera → ya cuenta como bueno', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    await procesarTurnoDataset(env, { ...BASE, mensaje: 'a', resp: respDe(trazaBuena()), ahora: 0 });
    expect(await resolverPendienteDataset(env, { ...BASE, mensaje: 'no', ahora: DATASET_HORAS_PROMOCION * 3600 * 1000 })).toBe('promovido');
  });

  it('turno con error de tool → no se guarda nada en la ranura', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    const traza = trazaBuena({ pasos: [{ texto: '', llamadas: [{ nombre: 'consultar_bd', input: {}, resultado: '{"ok":false,"error":"no such table"}', ok: false, permitida: true }] }] });
    const r = await procesarTurnoDataset(env, { ...BASE, mensaje: 'x', resp: respDe(traza) });
    expect(r).toMatchObject({ guardado: false, motivo: 'tool_error' });
    expect([...R2.objetos.keys()].filter(k => k.startsWith('dataset/'))).toHaveLength(0);
  });

  it('sin sesión, cron, adjuntos o barrera pendiente → no se guarda', async () => {
    for (const [extra, motivo] of [[{ authOk: false }, 'sin_sesion'], [{ esCron: true }, 'cron'], [{ adjuntos: ['chat_files/a.png'] }, 'adjuntos']]) {
      const R2 = crearR2();
      const r = await procesarTurnoDataset(envCon(R2), { ...BASE, ...extra, mensaje: 'x', resp: respDe(trazaBuena()) });
      expect(r.motivo).toBe(motivo);
    }
    const R2 = crearR2();
    const traza = trazaBuena({ pasos: [{ texto: '', llamadas: [{ nombre: 'escribir_bd', input: {}, resultado: '⚠️ OPERACIÓN BLOQUEADA — requiere confirmación humana', ok: true, permitida: true }] }] });
    expect((await procesarTurnoDataset(envCon(R2), { ...BASE, mensaje: 'borra', resp: respDe(traza) })).motivo).toBe('barrera_confirmacion');
  });

  it('límite diario por empresa', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    const ahora = Date.parse('2026-10-03T12:00:00Z');
    let guardados = 0;
    for (let i = 0; i < DATASET_MAX_DIA_EMPRESA + 5; i++) {
      const r = await capturarTurnoDataset(env, { empresa: 7, usuario_id: `u${i}`, mensaje: 'x', traza: trazaBuena(), toolsDisponibles: TOOLS, ahora });
      if (r.guardado) guardados++; else expect(r.motivo).toBe('cupo_diario');
    }
    expect(guardados).toBe(DATASET_MAX_DIA_EMPRESA);
    // Otra empresa tiene su propio cupo; al día siguiente se reinicia.
    expect((await capturarTurnoDataset(env, { empresa: 8, usuario_id: 'z', mensaje: 'x', traza: trazaBuena(), ahora })).guardado).toBe(true);
    expect((await capturarTurnoDataset(env, { empresa: 7, usuario_id: 'z', mensaje: 'x', traza: trazaBuena(), ahora: ahora + 86400000 })).guardado).toBe(true);
    expect(R2.objetos.has('dataset-cuota/e7/2026-10-03.json')).toBe(true);
  });

  it('reservarCuota respeta la escritura condicional por etag', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    // La primera escritura del día crea el contador sin condición (como ADR-0027): el
    // límite es exacto a partir de ahí.
    expect(await reservarCuota(env, 9, 0, 3)).toBe(true);
    const resultados = await Promise.all(Array.from({ length: 5 }, () => reservarCuota(env, 9, 0, 3)));
    expect(resultados.filter(Boolean).length).toBeLessThanOrEqual(3);
    expect(JSON.parse(R2.objetos.get('dataset-cuota/e9/1970-01-01.json').body).n).toBeLessThanOrEqual(3);
  });

  it('cron: promueve solo los pendientes de más de las horas de espera', async () => {
    const R2 = crearR2(); const env = envCon(R2);
    const h = 3600 * 1000;
    await capturarTurnoDataset(env, { empresa: 7, usuario_id: 'viejo', mensaje: 'x', traza: trazaBuena(), ahora: 0 });
    await capturarTurnoDataset(env, { empresa: 7, usuario_id: 'nuevo', mensaje: 'x', traza: trazaBuena(), ahora: 5 * h });
    const r = await promoverPendientesCaducados(env, DATASET_HORAS_PROMOCION * h + 1);
    expect(r.promovidos).toBe(1);
    expect([...R2.objetos.keys()].filter(k => k.startsWith('dataset-bueno/'))).toHaveLength(1);
    // Una segunda pasada no vuelve a promover la ranura ya vaciada.
    expect((await promoverPendientesCaducados(env, DATASET_HORAS_PROMOCION * h + 2)).promovidos).toBe(0);
    expect(R2.ops.delete).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('exportar-dataset.mjs (funciones puras; el script no se ejecuta)', () => {
  it('parsea argumentos y valida mes/empresa', () => {
    expect(parsearArgs(['--mes', '2026-10', '--empresa', '7'])).toMatchObject({ mes: '2026-10', empresa: '7', listar: false });
    expect(() => parsearArgs(['--mes', 'octubre'])).toThrow();
    expect(() => parsearArgs(['--empresa', '7; rm -rf'])).toThrow();
    expect(() => parsearArgs(['--borrar'])).toThrow();
  });
  it('prefijos y filtro de claves seguras', () => {
    expect(prefijoListado({})).toBe('dataset-bueno/');
    expect(prefijoListado({ empresa: '7', mes: '2026-10' })).toBe('dataset-bueno/e7/2026-10/');
    expect(filtrarClaves(['dataset-bueno/e7/2026-10/a.json', 'dataset-bueno/e7/2026-09/b.json', 'dataset/e7/pendiente/x.json', 'dataset-bueno/e7/2026-10/a b.json', 'dataset-bueno/../x.json'], { mes: '2026-10' }))
      .toEqual(['dataset-bueno/e7/2026-10/a.json']);
  });
  it('se niega a escribir dentro del repositorio', () => {
    const raiz = fileURLToPath(new URL('../', import.meta.url));
    expect(rutaDentroDelRepo(join(raiz, 'dataset.jsonl'), raiz)).toBe(true);
    expect(rutaDentroDelRepo(join(raiz, 'scripts', 'x.jsonl'), raiz)).toBe(true);
    expect(rutaDentroDelRepo(salidaPorDefecto(), raiz)).toBe(false);
  });
  it('valida registros y avisa de posibles fugas', () => {
    expect(lineaJsonl('no json')).toBe(null);
    expect(lineaJsonl('{"messages":[],"tools":[]}')).toBe(null);
    const ok = lineaJsonl(JSON.stringify({ messages: [{}, {}, {}], tools: [] }));
    expect(ok).not.toContain('\n');
    expect(posiblesFugas('<PERSONA_1> <TELEFONO>')).toEqual([]);
    expect(posiblesFugas('llama a 612345678 o a x@y.es')).toEqual(['email', 'telefono']);
  });
  it('el script solo lee: sin put/delete de wrangler ni D1', () => {
    const src = readFileSync(new URL('../scripts/ai-benchmark/exportar-dataset.mjs', import.meta.url), 'utf8');
    expect(src).not.toMatch(/'object',\s*'(?:put|delete)'/);
    expect(src).not.toMatch(/'d1'|d1 execute/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('cableado en worker.js', () => {
  const worker = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
  const modulo = readFileSync(new URL('./dataset-entrenamiento.js', import.meta.url), 'utf8');

  it('todas las llamadas al dataset van detrás de datasetActivo(env)', () => {
    for (const fn of ['procesarTurnoDataset(env', 'resolverPendienteDataset(env', 'promoverPendientesCaducados(env']) {
      const i = worker.indexOf(fn);
      expect(i).toBeGreaterThan(-1);
      expect(worker.slice(Math.max(0, i - 400), i)).toContain('datasetActivo(env)');
    }
  });

  it('el módulo no toca D1 ni borra en R2', () => {
    expect(modulo).not.toMatch(/env\.DB\b/);
    expect(modulo).not.toMatch(/FILES\.delete\s*\(/);
  });

  it('los prefijos del dataset no se sirven por /files/, ni por tools, ni en listados', () => {
    expect(worker).toMatch(/if \(esClaveDatasetPrivada\(key\)\) return new Response\('No encontrado', \{ status: 404 \}\);/);
    expect(worker).toContain('[input.key, input.prefix, input.r2_key, input.archivo_key].some(esClaveDatasetPrivada)');
    expect(worker).toContain('if (esClaveDatasetPrivada(obj.key)) continue;');
  });

  it('el turno en streaming devuelve la traza y marca las verificaciones que corrigen', () => {
    expect(worker).toContain('_dataset: { ...trazaDataset, cortado: cortadoPorTimeout }');
    expect(worker).toContain('if (r !== texto) trazaDataset.verificacionCorrigio = true;');
  });
});
