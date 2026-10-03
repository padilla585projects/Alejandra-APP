// ADR-0028 §Medición — métricas de producción del pool (sin llamadas reales ni a D1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ventana, consultaD1, usoDeTipo, agregarFilasD1, filasDeSalidaWrangler, metricasDeEventoTail,
  crearLectorObjetosJson, agregarMetricas, consultaAE, agregarFilasAE, informe, parsearArgs, _leerAE, DATASET_AE
} from './metricas-produccion.mjs';

test('ventana: valida horas y fecha (acaban dentro de SQL)', () => {
  assert.deepEqual(ventana({}), { tipo: 'horas', horas: 24 });
  assert.deepEqual(ventana({ horas: 48 }), { tipo: 'horas', horas: 48 });
  assert.deepEqual(ventana({ desde: '2026-10-03 08:00' }), { tipo: 'desde', desde: '2026-10-03 08:00' });
  assert.throws(() => ventana({ horas: 0 }));
  assert.throws(() => ventana({ horas: 1.5 }));
  assert.throws(() => ventana({ horas: 10000 }));
  assert.throws(() => ventana({ desde: "2026-10-03' OR 1=1 --" }));
  assert.throws(() => ventana({ desde: '03/10/2026' }));
});

test('consulta D1: un único SELECT agregado sobre alejandra_token_uso, sin columnas personales', () => {
  for (const v of [ventana({ horas: 24 }), ventana({ desde: '2026-10-03' })]) {
    const q = consultaD1(v);
    assert.match(q, /^SELECT /);
    assert.doesNotMatch(q, /;|"|%/); // va entre comillas dobles por la shell de Windows
    assert.doesNotMatch(q, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i);
    assert.match(q, /FROM alejandra_token_uso WHERE created_at >= /);
    assert.doesNotMatch(q, /usuario_id|empresa_id/);
    assert.match(q, /GROUP BY tipo, proveedor, modelo/);
  }
  assert.match(consultaD1(ventana({ horas: 6 })), /datetime\('now', '-6 hours'\)/);
});

test('el script no escribe en D1 ni en ningún sitio', () => {
  const src = readFileSync(new URL('./metricas-produccion.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(INSERT|UPDATE|DELETE FROM|DROP|ALTER TABLE)\b/);
  assert.doesNotMatch(src, /writeFile|appendFile/);
  assert.doesNotMatch(src, /--file/);
});

test('D1: turnos del pool por uso y modelo real; Haiku del router como proxy de respaldo', () => {
  const filas = [
    { tipo: 'clasificacion', proveedor: 'ai_pool', modelo: 'ai_pool:qwen3.6:35b-a3b', n: 80, coste_usd: 0 },
    { tipo: 'clasificacion', proveedor: 'ai_pool', modelo: 'ai_pool:prisma:1.0', n: 5, coste_usd: 0 },
    { tipo: 'clasificacion', proveedor: 'anthropic', modelo: 'claude-haiku-4-5', n: 15, coste_usd: 0.01 },
    { tipo: 'chat_stream', proveedor: 'ai_pool', modelo: 'ai_pool:qwen3.6:35b-a3b', n: 20, coste_usd: 0 },
    { tipo: 'chat_stream', proveedor: 'anthropic', modelo: 'claude-sonnet-4-6', n: 40, coste_usd: 1.2 },
    { tipo: 'web_search', proveedor: 'ai_pool', modelo: 'ai_pool:tools/search', n: 7, coste_usd: 0 },
    { tipo: 'web_search', proveedor: 'openai', modelo: 'gpt-4o-mini', n: 3, coste_usd: 0.03 },
    { tipo: 'destilacion_haiku_fallback', proveedor: 'anthropic', modelo: 'claude-haiku-4-5', n: 1, coste_usd: 0 },
  ];
  const r = agregarFilasD1(filas);
  assert.equal(r.resumen.turnosPool, 112);
  assert.equal(r.resumen.routerPool, 85);
  assert.equal(r.resumen.routerHaikuProxyRespaldo, 15);
  assert.equal(r.resumen.tasaRouterPool, 0.85);
  assert.deepEqual(r.usos.router.modelosReales, { 'qwen3.6:35b-a3b': 80, 'prisma:1.0': 5 });
  assert.equal(r.usos.chat_stream.otros, 40);
  assert.equal(r.usos.buscar_web.otros, 3);
  assert.equal(r.usos.destilacion.haiku, 1);
  assert.equal(usoDeTipo('chat_simple'), 'experto_simple');
  assert.equal(usoDeTipo('chat_ingenieria'), 'experto_ingenieria');
  const txt = informe('d1', ventana({}), r);
  assert.match(txt, /Turnos resueltos por el pool: 112/);
  assert.match(txt, /Haiku 15 \(proxy de respaldo\)/);
});

test('salida de wrangler --json (con avisos delante)', () => {
  const salida = 'Aviso de wrangler [x]\n[\n  {\n    "results": [{ "tipo": "clasificacion", "n": 3 }],\n    "success": true\n  }\n]';
  assert.deepEqual(filasDeSalidaWrangler(salida), [{ tipo: 'clasificacion', n: 3 }]);
  assert.throws(() => filasDeSalidaWrangler('sin json'));
});

test('tail: solo las líneas AIPOOL_METRICA y solo los campos de la métrica', () => {
  const evento = {
    event: { request: { url: 'https://x/api/chat/stream' } },
    logs: [
      { message: ['[Experto] mensaje del usuario: algo privado'] },
      { message: ['AIPOOL_METRICA {"uso":"router","proveedor":"ai_pool","modelo":"alejandra:1.0","modeloReal":"qwen3.6:35b-a3b","resultado":"ok","motivo":null,"ms":812,"contenido":"no debería estar"}'] },
      { message: ['AIPOOL_METRICA {roto'] },
    ],
  };
  const m = metricasDeEventoTail(evento);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0], { uso: 'router', modelo: 'alejandra:1.0', modeloReal: 'qwen3.6:35b-a3b', resultado: 'ok', motivo: null, ms: 812 });
  assert.doesNotMatch(JSON.stringify(m), /privado|no debería/);
});

test('tail: lector de objetos JSON partidos entre trozos y con llaves dentro de cadenas', () => {
  const objetos = [];
  const leer = crearLectorObjetosJson(o => objetos.push(o));
  const a = JSON.stringify({ logs: [{ message: ['texto con { y } y \\"comillas\\"'] }] }, null, 2);
  const b = JSON.stringify({ id: 2 });
  const todo = 'ruido inicial\n' + a + '\n' + b + '\n';
  for (let i = 0; i < todo.length; i += 7) leer(todo.slice(i, i + 7));
  assert.equal(objetos.length, 2);
  assert.equal(objetos[1].id, 2);
});

test('agregado de métricas: tasa, motivos, modelos reales y percentiles', () => {
  const ms = [100, 200, 300, 400, 1000];
  const r = agregarMetricas([
    ...ms.map(x => ({ uso: 'router', resultado: 'ok', ms: x, modeloReal: 'qwen3.6:35b-a3b' })),
    { uso: 'router', resultado: 'respaldo', motivo: 'timeout' },
    { uso: 'router', resultado: 'respaldo', motivo: 'timeout' },
    { uso: 'router', resultado: 'omitido', motivo: 'circuito_abierto' },
    { uso: 'experto_simple', resultado: 'respaldo', motivo: 'modelo_real_sin_tools', modeloReal: 'prisma:1.0' },
  ]);
  assert.equal(r.usos.router.total, 8);
  assert.equal(r.usos.router.tasaExito, 5 / 8);
  assert.deepEqual(r.usos.router.motivos, { timeout: 2, circuito_abierto: 1 });
  assert.equal(r.usos.router.p50MsOk, 300);
  assert.equal(r.usos.router.p95MsOk, 1000);
  assert.deepEqual(r.usos.experto_simple.modelosReales, { 'prisma:1.0': 1 });
  assert.match(informe('tail', ventana({}), r), /router \| 8 \| 5 \| 2 \| 1 \| 62\.5 % \| timeout×2, circuito_abierto×1/);
});

test('Analytics Engine: consulta ponderada por muestreo y agregado', () => {
  const q = consultaAE(ventana({ horas: 168 }));
  assert.match(q, new RegExp(`FROM ${DATASET_AE} WHERE timestamp > NOW\\(\\) - INTERVAL '168' HOUR`));
  assert.match(q, /SUM\(_sample_interval\) AS n/);
  assert.match(consultaAE(ventana({ desde: '2026-10-03' })), /toDateTime\('2026-10-03 00:00:00'\)/);
  const r = agregarFilasAE([
    { uso: 'router', resultado: 'ok', motivo: '', modelo_real: 'qwen3.6:35b-a3b', worker: 'alejandra-agente', n: 90 },
    { uso: 'router', resultado: 'respaldo', motivo: 'timeout', modelo_real: '', worker: 'alejandra-agente', n: 10 },
  ]);
  assert.equal(r.usos.router.tasaExito, 0.9);
  assert.deepEqual(r.usos.router.motivos, { timeout: 10 });
});

test('Analytics Engine: sin CF_API_TOKEN no llama a nada; con token usa la SQL API de la cuenta', async () => {
  let llamadas = 0;
  const fetchFalso = async (url, init) => {
    llamadas++;
    assert.match(url, /\/accounts\/d65ead2b2967bf68ff3848a36cd7b1b4\/analytics_engine\/sql$/);
    assert.equal(init.headers.Authorization, 'Bearer t');
    assert.match(init.body, /^SELECT /);
    return { ok: true, status: 200, text: async () => JSON.stringify({ data: [{ uso: 'router', resultado: 'ok', n: 3 }] }) };
  };
  await assert.rejects(() => _leerAE(ventana({}), {}, fetchFalso), /CF_API_TOKEN/);
  assert.equal(llamadas, 0);
  const r = await _leerAE(ventana({}), { CF_API_TOKEN: 't' }, fetchFalso);
  assert.equal(r.usos.router.ok, 3);
});

test('argumentos', () => {
  assert.deepEqual(parsearArgs([]), { fuente: 'd1', horas: null, desde: null, minutos: 10, json: false });
  assert.equal(parsearArgs(['--fuente', 'tail', '--minutos', '5']).minutos, 5);
  assert.throws(() => parsearArgs(['--fuente', 'kv']));
  assert.throws(() => parsearArgs(['--borrar']));
});
