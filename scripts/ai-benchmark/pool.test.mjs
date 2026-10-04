// ADR-0028 — arnés del benchmark del pool, con fetch simulado (ninguna llamada real).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, resumir, costeEstimado, candidatos, diagnosticoRespuesta, DIAGNOSTICO_MAX_TEXTO } from './pool.mjs';
import { casosRouter } from './pool-cases.mjs';
import { cargarBancoAlejandra } from './banco-alejandra.mjs';

const silencio = () => { const orig = console.log; console.log = () => {}; return () => { console.log = orig; }; };
const json = (cuerpo, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(cuerpo), json: async () => cuerpo });

test('sin AI_POOL_KEY ni credenciales: todo se omite limpiamente y no hay ni una llamada', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  let llamadas = 0;
  const restaurar = silencio();
  try {
    const datos = await run({ outputDir: dir, env: {}, fetchImpl: async () => { llamadas++; return json({}); } });
    assert.equal(llamadas, 0);
    assert.equal(datos.poolConfigurado, false);
    assert.ok(datos.filas.every(f => f.status.startsWith('omitido')));
    assert.ok(datos.filas.filter(f => f.candidato.startsWith('ai_pool:')).every(f => f.status === 'omitido_sin_clave'));
    assert.match(await readFile(join(dir, 'report.md'), 'utf8'), /ADR-0028/);
  } finally { restaurar(); }
});

test('solo con AI_POOL_KEY: mide el pool, omite el resto y calcula acierto/latencia', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const urls = [];
  const fetchImpl = async (url, init) => {
    urls.push(url);
    const body = JSON.parse(init.body);
    if (url.endsWith('/v1/tools/search')) return json({ query: body.query, results: [{ title: 'ITC-BT-19 RZ1-K 842/2002', url: 'https://www.boe.es/x', snippet: 'caída de tensión' }] });
    const usuario = body.messages.at(-1).content;
    if (body.response_format) {
      const caso = casosRouter.find(c => c.mensaje === usuario);
      return json({ model: body.model, choices: [{ message: { content: JSON.stringify({ experto: caso.esperado }) } }], usage: { prompt_tokens: 50, completion_tokens: 5 } });
    }
    if (body.tools) return json({ model: body.model, choices: [{ message: { content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'consultar_inventario', arguments: '{}' } }] } }] });
    return json({ model: body.model, choices: [{ message: { content: 'Hola, bien. Un diferencial protege. Buenas noches, de nada.' } }] });
  };
  const restaurar = silencio();
  try {
    const datos = await run({ outputDir: dir, env: { AI_POOL_KEY: 'k' }, fetchImpl });
    assert.ok(urls.length > 0 && urls.every(u => u.startsWith('https://pve1.tail2c5046.ts.net/')));
    const r = Object.fromEntries(datos.resumen.map(x => [x.tarea + '|' + x.candidato, x]));
    assert.equal(r['router|ai_pool:alejandra:1.0'].acierto, 1);
    assert.equal(r['router|ai_pool:prisma:1.0'].acierto, 1);
    assert.equal(r['router|ai_pool:prisma:1.0'].costeUsd, 0);
    assert.equal(r['router|claude-haiku-4-5'].medidos, 0);
    assert.equal(r['buscar_web|ai_pool:tools/search'].acierto, 1);
    // respaldo: f01 acierta (tool correcta), f02 falla (tool equivocada), f03 falla (debía ser texto)
    assert.equal(r['respaldo|ai_pool:qwen3.6:35b-a3b'].aciertos, 1);
    assert.ok(r['simple|ai_pool:qwen3.6:35b-a3b'].p50Ms !== null);
  } finally { restaurar(); }
});

// Respuesta «perfecta» del pool para un caso del banco, con la cabecera X-AI-Pool-Model.
function respuestaPerfecta(caso, modeloReal) {
  const e = caso.esperado;
  // Primera alternativa de una regex del banco (todas empiezan por una palabra literal).
  const primera = f => String(f).split('|')[0];
  let message;
  if (e.etiqueta) message = { role: 'assistant', content: JSON.stringify({ experto: e.etiqueta }) };
  else if (e.respuesta_contiene) message = { role: 'assistant', content: e.respuesta_contiene.map(primera).join(' ') + '.' };
  else {
    const nombre = Array.isArray(e.herramienta) ? e.herramienta[0] : e.herramienta;
    const exigidos = Array.isArray(e.herramienta) ? (e.argumentos[nombre] || {}) : e.argumentos;
    const args = Object.fromEntries(Object.entries(exigidos).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : v]));
    message = { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: nombre, arguments: JSON.stringify(args) } }] };
  }
  const cuerpo = { model: 'alejandra:1.0', choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 2 } };
  return { ok: true, status: 200, headers: new Headers({ 'X-AI-Pool-Model': modeloReal }), text: async () => JSON.stringify(cuerpo), json: async () => cuerpo };
}

test('banco casos-alejandra.json: el pool perfecto acierta todo y se registra el modelo real', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const banco = cargarBancoAlejandra();
  const porMensaje = new Map(banco.map(c => [c.mensajes.at(-1).content, c]));
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    return respuestaPerfecta(porMensaje.get(body.messages.at(-1).content), body.model === 'alejandra:1.0' ? 'qwen3.6:35b-a3b' : body.model);
  };
  const restaurar = silencio();
  try {
    const datos = await run({ tareas: ['banco'], outputDir: dir, env: { AI_POOL_KEY: 'k' }, fetchImpl });
    const r = Object.fromEntries(datos.resumen.map(x => [x.candidato, x]));
    assert.equal(r['ai_pool:alejandra:1.0'].medidos, banco.length);
    assert.equal(r['ai_pool:alejandra:1.0'].acierto, 1);
    assert.deepEqual(r['ai_pool:alejandra:1.0'].modelosReales, { 'qwen3.6:35b-a3b': banco.length });
    // prisma no recibe tools: los casos con tools salen «respaldo», el resto se mide
    const conTools = banco.filter(c => c.tools.length).length;
    assert.equal(r['ai_pool:prisma:1.0'].motivosFallo.respaldo, conTools);
    assert.equal(r['ai_pool:prisma:1.0'].aciertos, banco.length - conTools);
    assert.equal(r['claude-haiku-4-5'].medidos, 0);
    assert.match(await readFile(join(dir, 'report.md'), 'utf8'), /qwen3\.6:35b-a3b×/);
  } finally { restaurar(); }
});

test('banco: si el alias resuelve a prisma en un caso con tools, cuenta como respaldo (modelo_real_sin_tools)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const banco = cargarBancoAlejandra();
  const fetchImpl = async () => {
    const cuerpo = { model: 'alejandra:1.0', choices: [{ message: { role: 'assistant', content: '{"experto":"app"}' } }] };
    return { ok: true, status: 200, headers: new Headers({ 'X-AI-Pool-Model': 'prisma:1.0' }), text: async () => JSON.stringify(cuerpo), json: async () => cuerpo };
  };
  const restaurar = silencio();
  try {
    const datos = await run({ tareas: ['banco'], outputDir: dir, env: { AI_POOL_KEY: 'k' }, fetchImpl });
    const filas = datos.filas.filter(f => f.candidato === 'ai_pool:alejandra:1.0' && f.tipo === 'experto_tools');
    assert.equal(filas.length, banco.filter(c => c.tipo === 'experto_tools').length);
    assert.ok(filas.every(f => f.status === 'respaldo' && f.motivo === 'modelo_real_sin_tools' && f.modeloReal === 'prisma:1.0'));
  } finally { restaurar(); }
});

// POOL-TOOLS-CONFUSAS-01 (04/10/2026): diagnóstico por caso para los «vacíos».
test('diagnosticoRespuesta: finish_reason, si hubo texto (recortado) y tool_calls, sin la respuesta entera', () => {
  const largo = 'x'.repeat(DIAGNOSTICO_MAX_TEXTO + 50);
  const d = diagnosticoRespuesta({ finishReason: 'stop', texto: largo, toolCalls: [] });
  assert.equal(d.finishReason, 'stop');
  assert.equal(d.conTexto, true);
  assert.equal(d.caracteresTexto, largo.length);
  assert.equal(d.textoInicio.length, DIAGNOSTICO_MAX_TEXTO + 1); // recortado + «…»
  assert.equal(d.toolCalls, 0);
  const t = diagnosticoRespuesta({ finishReason: 'tool_calls', texto: '  ', toolCalls: [
    { type: 'function', function: { name: 'programar_recordatorio', arguments: '{"fecha_hora":"2026-10-06 10:00"}' } },
    { name: 'calcular_cable', arguments: { potencia_w: 40000 } }
  ] });
  assert.deepEqual(t, { finishReason: 'tool_calls', conTexto: false, caracteresTexto: 2, textoInicio: null, toolCalls: 2, herramientas: ['programar_recordatorio', 'calcular_cable'], argumentosJson: true });
  assert.equal(diagnosticoRespuesta({ toolCalls: [{ function: { name: 'consultar_bd', arguments: '{roto' } }] }).argumentosJson, false);
  assert.equal(diagnosticoRespuesta({ detalle: 'tool_no_ofrecida' }).detalle, 'tool_no_ofrecida');
});

test('banco: cada fila del pool guarda el diagnóstico (vacía → respaldo respuesta_vacia con finish_reason; tool_call válida → herramientas)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const banco = cargarBancoAlejandra();
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    const nombre = body.tools && body.tools[0].function.name;
    const message = nombre
      ? { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: nombre, arguments: '{}' } }] }
      : { role: 'assistant', content: '   ' };
    const cuerpo = { model: 'alejandra:1.0', choices: [{ message, finish_reason: nombre ? 'tool_calls' : 'length' }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
    return { ok: true, status: 200, headers: new Headers({ 'X-AI-Pool-Model': 'qwen3.6:35b-a3b' }), text: async () => JSON.stringify(cuerpo), json: async () => cuerpo };
  };
  const restaurar = silencio();
  try {
    const datos = await run({ tareas: ['banco'], outputDir: dir, env: { AI_POOL_KEY: 'k' }, fetchImpl });
    const filas = datos.filas.filter(f => f.candidato === 'ai_pool:alejandra:1.0');
    assert.equal(filas.length, banco.length);
    for (const f of filas) assert.ok(f.diagnostico, f.caso);
    const vacia = filas.find(f => f.tipo === 'router');
    assert.equal(vacia.motivo, 'respuesta_vacia');
    assert.deepEqual({ fr: vacia.diagnostico.finishReason, t: vacia.diagnostico.conTexto }, { fr: 'length', t: false });
    const conTool = filas.find(f => f.tipo === 'experto_tools');
    assert.equal(conTool.status, 'ok');
    assert.equal(conTool.diagnostico.finishReason, 'tool_calls');
    assert.equal(conTool.diagnostico.toolCalls, 1);
    assert.equal(conTool.diagnostico.conTexto, false);
    const guardado = JSON.parse(await readFile(join(dir, 'results.json'), 'utf8'));
    assert.ok(guardado.filas.filter(f => f.candidato === 'ai_pool:alejandra:1.0').every(f => f.diagnostico));
  } finally { restaurar(); }
});

test('BENCHMARK_BANCO=agrupado: cada grupo de expertos manda el MISMO system y las MISMAS tools (prefijo estable)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const banco = cargarBancoAlejandra();
  // En el modo agrupado el contexto de sesión va delante del último mensaje del usuario:
  // el caso se identifica por cómo TERMINA el último mensaje.
  const originales = banco.map(c => [c.mensajes.at(-1).content, c]);
  const enviados = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.model === 'alejandra:1.0') enviados.push(body);
    const ultimo = body.messages.at(-1).content;
    const caso = originales.filter(([fin]) => ultimo.endsWith(fin)).sort((a, b) => b[0].length - a[0].length)[0][1];
    return respuestaPerfecta(caso, 'qwen3.6:35b-a3b');
  };
  const restaurar = silencio();
  try {
    const datos = await run({ tareas: ['banco'], outputDir: dir, env: { AI_POOL_KEY: 'k', BENCHMARK_BANCO: 'agrupado' }, fetchImpl });
    assert.equal(datos.banco, 'agrupado');
    const alias = datos.resumen.find(x => x.candidato === 'ai_pool:alejandra:1.0');
    assert.equal(alias.medidos, banco.length);
    assert.equal(alias.acierto, 1);
    // Orden del banco agrupado: router (sin tools), experto_simple y experto_tools.
    const conTools = enviados.filter(b => b.tools);
    const nSimple = banco.filter(c => c.tipo === 'experto_simple').length;
    assert.equal(conTools.length, nSimple + banco.filter(c => c.tipo === 'experto_tools').length);
    for (const tipo of ['experto_simple', 'experto_tools']) {
      const deTipo = tipo === 'experto_simple' ? conTools.slice(0, nSimple) : conTools.slice(nSimple);
      assert.equal(new Set(deTipo.map(b => b.messages[0].content)).size, 1, tipo + ': system distinto');
      assert.equal(new Set(deTipo.map(b => JSON.stringify(b.tools))).size, 1, tipo + ': tools distintas');
    }
  } finally { restaurar(); }
});

test('pool caído (503 model_unavailable) cuenta como respaldo, no rompe el benchmark', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const restaurar = silencio();
  try {
    const datos = await run({ tareas: ['router'], outputDir: dir, env: { AI_POOL_KEY: 'k' }, fetchImpl: async () => json({ error: { code: 'model_unavailable' } }, 503) });
    const pool = datos.resumen.find(x => x.candidato === 'ai_pool:prisma:1.0');
    assert.equal(pool.aciertos, 0);
    assert.deepEqual(pool.motivosFallo, { respaldo: casosRouter.length });
  } finally { restaurar(); }
});

test('presupuesto: los proveedores de pago se detienen al agotarlo', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pool-bench-'));
  const restaurar = silencio();
  try {
    const fetchImpl = async () => json({ content: [{ type: 'text', text: 'app' }], usage: { input_tokens: 4000, output_tokens: 0 } });
    const datos = await run({ tareas: ['router'], budget: 0.02, outputDir: dir, env: { ANTHROPIC_API_KEY: 'k' }, fetchImpl });
    const haiku = datos.filas.filter(f => f.candidato === 'claude-haiku-4-5');
    assert.ok(haiku.some(f => f.status === 'ok'));
    assert.ok(haiku.some(f => f.status === 'omitido_presupuesto'));
  } finally { restaurar(); }
});

test('coste estimado: pool 0, búsqueda de pago con tarifa por llamada', () => {
  assert.equal(costeEstimado('ai_pool:qwen3.6:35b-a3b', { input: 1e6, output: 1e6 }), 0);
  assert.equal(costeEstimado('claude-haiku-4-5', { input: 1e6, output: 0 }), 1);
  assert.equal(costeEstimado('tavily', null), .008);
  assert.ok(candidatos.router.includes('claude-haiku-4-5'));
  assert.deepEqual(resumir([{ tarea: 't', candidato: 'c', status: 'omitido_sin_clave', pass: false, costUsd: null }])[0].acierto, null);
});
