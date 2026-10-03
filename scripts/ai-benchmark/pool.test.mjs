// ADR-0028 — arnés del benchmark del pool, con fetch simulado (ninguna llamada real).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run, resumir, costeEstimado, candidatos } from './pool.mjs';
import { casosRouter } from './pool-cases.mjs';

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
    assert.equal(r['router|ai_pool:prisma:1.0'].acierto, 1);
    assert.equal(r['router|ai_pool:prisma:1.0'].costeUsd, 0);
    assert.equal(r['router|claude-haiku-4-5'].medidos, 0);
    assert.equal(r['buscar_web|ai_pool:tools/search'].acierto, 1);
    // respaldo: f01 acierta (tool correcta), f02 falla (tool equivocada), f03 falla (debía ser texto)
    assert.equal(r['respaldo|ai_pool:qwen3.6:35b-a3b'].aciertos, 1);
    assert.ok(r['simple|ai_pool:qwen3.6:35b-a3b'].p50Ms !== null);
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
