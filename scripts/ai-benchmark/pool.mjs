// ADR-0028 §Medición — compara el pool de IA propio con lo que usa hoy producción en las
// tareas que el pool asume, midiendo latencia, acierto y coste estimado. En el pool se mide
// el alias de producción `alejandra:1.0` y, aparte, los modelos concretos que puede tener
// detrás (qwen3.6, prisma), para decidir con datos a qué debe resolver el alias:
//   a) router de intención   pool alejandra:1.0 / prisma:1.0 / qwen3.6  vs  claude-haiku-4-5
//   b) experto «simple»      pool alejandra:1.0 / qwen3.6               vs  claude-haiku-4-5
//   c) buscar_web            pool /v1/tools/search      vs  gpt-4o-mini (web_search_preview) y Tavily
//   d) respaldo (tools)      pool alejandra:1.0 / qwen3.6               vs  grok-4 y gpt-4o
//   e) banco                 casos-alejandra.json (router, experto simple y experto con las tools
//                            REALES del agente) con los mismos candidatos de pool + Haiku y gpt-4o
// En las filas del pool se guarda `modeloReal` (cabecera X-AI-Pool-Model): qué respondió de verdad.
// Las llamadas al pool usan EL MISMO cliente que producción (alejandra-agente/ai-pool.js),
// con sus timeouts reales, así que un timeout aquí es un respaldo allí.
// Sin AI_POOL_KEY el pool se omite limpiamente (status omitido_sin_clave, no es fallo);
// igual con cualquier proveedor sin credenciales. Nunca registra claves ni cuerpos de error.
//
//   node scripts/ai-benchmark/pool.mjs   (vars: AI_POOL_KEY, AI_POOL_URL, ANTHROPIC_API_KEY,
//   OPENAI_API_KEY, TAVILY_API_KEY, XAI_API_KEY, BENCHMARK_REPEATS, BENCHMARK_BUDGET_USD,
//   BENCHMARK_OUTPUT, BENCHMARK_POOL_TIMEOUT_MS, BENCHMARK_TAREAS=router,banco,...)
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  AI_POOL_MODELO, AI_POOL_TIMEOUTS, poolConfigurado, poolChat,
  poolClasificar, poolBuscar, _reiniciarCircuitoPool, normalizarEtiquetaRouter
} from '../../alejandra-agente/ai-pool.js';
import { SYSTEM_CLASIFICADOR_INTENCION, ETIQUETAS_CLASIFICADOR_INTENCION } from '../../alejandra-agente/lib.js';
import { casosRouter, casosSimple, sistemaSimple, casosBusqueda, casosRespaldo, sistemaRespaldo, toolsRespaldo } from './pool-cases.mjs';
import { cargarBancoAlejandra, evaluarCasoBanco } from './banco-alejandra.mjs';

// Modelos concretos del pool que se miden además del alias (el alias puede resolver a ellos).
const POOL_QWEN = 'ai_pool:qwen3.6:35b-a3b';
const POOL_PRISMA = 'ai_pool:prisma:1.0';
const POOL_ALIAS = 'ai_pool:' + AI_POOL_MODELO;

// USD/MTok y USD por llamada de herramienta. El pool cuesta 0 por token (no incluye la
// electricidad de casa). Tarifas de herramienta de búsqueda: estimación a verificar en la
// factura del proveedor antes de decidir solo por coste.
export const tarifas = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'gpt-4o-mini-web': { input: .15, output: .6, porLlamada: .025 },
  'gpt-4o': { input: 2.5, output: 10 },
  'grok-4': { input: 3, output: 15 },
  'tavily': { porLlamada: .008 },
  pool: { input: 0, output: 0, porLlamada: 0 }
};

export const candidatos = {
  router: [POOL_ALIAS, POOL_PRISMA, POOL_QWEN, 'claude-haiku-4-5'],
  simple: [POOL_ALIAS, POOL_QWEN, 'claude-haiku-4-5'],
  buscar_web: ['ai_pool:tools/search', 'gpt-4o-mini-web', 'tavily'],
  respaldo: [POOL_ALIAS, POOL_QWEN, 'grok-4', 'gpt-4o'],
  // prisma no maneja tools: en los casos con tools su fila sale «respaldo» (igual que en producción).
  banco: [POOL_ALIAS, POOL_QWEN, POOL_PRISMA, 'claude-haiku-4-5', 'gpt-4o']
};

const credencial = c => c.startsWith('ai_pool:') ? 'AI_POOL_KEY'
  : c.startsWith('claude') ? 'ANTHROPIC_API_KEY'
  : c === 'tavily' ? 'TAVILY_API_KEY'
  : c === 'grok-4' ? 'XAI_API_KEY' : 'OPENAI_API_KEY';

export function costeEstimado(candidato, usage) {
  const t = candidato.startsWith('ai_pool:') ? tarifas.pool : tarifas[candidato];
  if (!t) return null;
  const porTokens = usage && (t.input || t.output) ? ((usage.input || 0) * (t.input || 0) + (usage.output || 0) * (t.output || 0)) / 1e6 : 0;
  return porTokens + (t.porLlamada || 0);
}

export function reserva(candidato) {
  // Cota superior conservadora para no pasar del presupuesto antes de saber el uso real.
  const t = candidato.startsWith('ai_pool:') ? tarifas.pool : tarifas[candidato];
  return ((t.input || 0) * 4000 + (t.output || 0) * 800) / 1e6 + (t.porLlamada || 0);
}

function percentil(valores, p) {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  return o[Math.max(0, Math.ceil(o.length * p) - 1)];
}

export function resumir(filas) {
  const claves = [...new Set(filas.map(f => f.tarea + '|' + f.candidato))];
  return claves.map(k => {
    const [tarea, candidato] = k.split('|');
    const items = filas.filter(f => f.tarea === tarea && f.candidato === candidato);
    const medidas = items.filter(f => !f.status.startsWith('omitido'));
    const aciertos = medidas.filter(f => f.pass);
    const completas = medidas.filter(f => f.status === 'ok');
    const costes = medidas.map(f => f.costUsd);
    const coste = costes.length && costes.every(c => c !== null) ? costes.reduce((a, b) => a + b, 0) : null;
    const motivos = {};
    for (const f of medidas.filter(f => f.status !== 'ok')) motivos[f.status] = (motivos[f.status] || 0) + 1;
    // Qué modelo real respondió (cabecera X-AI-Pool-Model) y por qué fallaron los casos medidos.
    const modelosReales = {};
    for (const f of medidas) if (f.modeloReal) modelosReales[f.modeloReal] = (modelosReales[f.modeloReal] || 0) + 1;
    const motivosError = {};
    for (const f of medidas) if (f.status === 'ok' && !f.pass && f.motivo) motivosError[f.motivo] = (motivosError[f.motivo] || 0) + 1;
    return {
      tarea, candidato, intentos: items.length, medidos: medidas.length, omitidos: items.length - medidas.length,
      completados: completas.length, aciertos: aciertos.length,
      acierto: medidas.length ? aciertos.length / medidas.length : null,
      p50Ms: percentil(completas.map(f => f.latencyMs), .5), p95Ms: percentil(completas.map(f => f.latencyMs), .95),
      costeUsd: coste, costePorAciertoUsd: coste !== null && aciertos.length ? coste / aciertos.length : null,
      motivosFallo: motivos, motivosError, modelosReales
    };
  });
}

// ── Llamadas (cada una devuelve { status, pass, latencyMs, usage, salida }) ──────────
async function anthropic(fetchImpl, system, mensaje, maxTokens) {
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': process.env.ANTHROPIC_API_KEY },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: mensaje }] })
  });
  if (!r.ok) return { status: 'http_' + r.status };
  const d = await r.json();
  return { status: 'ok', texto: (d.content || []).filter(b => b.type === 'text').map(b => b.text).join(''), usage: d.usage ? { input: d.usage.input_tokens, output: d.usage.output_tokens } : null };
}

async function chatOpenAICompat(fetchImpl, url, clave, modelo, messages, tools) {
  const r = await fetchImpl(url, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${clave}` },
    body: JSON.stringify({ model: modelo, max_tokens: 512, messages, ...(tools ? { tools, tool_choice: 'auto' } : {}) })
  });
  if (!r.ok) return { status: 'http_' + r.status };
  const d = await r.json();
  const m = d.choices?.[0]?.message || {};
  return { status: 'ok', texto: m.content || '', toolCalls: m.tool_calls || [], usage: d.usage ? { input: d.usage.prompt_tokens, output: d.usage.completion_tokens } : null };
}

// Anthropic con conversación y tools en formato OpenAI (para el banco).
async function anthropicConTools(fetchImpl, mensajes, tools, maxTokens) {
  const system = mensajes.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const messages = mensajes.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  const toolsA = (tools || []).map(t => ({ name: t.function.name, description: t.function.description || '', input_schema: t.function.parameters }));
  const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': process.env.ANTHROPIC_API_KEY },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: maxTokens, system, messages, ...(toolsA.length ? { tools: toolsA } : {}) })
  });
  if (!r.ok) return { status: 'http_' + r.status };
  const d = await r.json();
  const bloques = d.content || [];
  return {
    status: 'ok',
    texto: bloques.filter(b => b.type === 'text').map(b => b.text).join(''),
    toolCalls: bloques.filter(b => b.type === 'tool_use').map(b => ({ name: b.name, arguments: b.input || {} })),
    usage: d.usage ? { input: d.usage.input_tokens, output: d.usage.output_tokens } : null
  };
}

function etiquetaHaikuProduccion(texto) {
  // Mismo criterio que clasificarConHaiku en producción (primera etiqueta contenida).
  const t = (texto || '').trim().toLowerCase();
  return ETIQUETAS_CLASIFICADOR_INTENCION.find(v => t.includes(v)) || 'app';
}

const sinFuga = t => !/<\|[^|]*\|>|tool_call|"name"\s*:/.test(t || '');

async function ejecutarCaso(tarea, candidato, caso, { fetchImpl, envPool, poolTimeout }) {
  const opts = { fetch: fetchImpl };
  const esPool = candidato.startsWith('ai_pool:');
  const modeloPool = esPool ? candidato.slice('ai_pool:'.length) : null;
  if (esPool) _reiniciarCircuitoPool(); // medir cada caso, no el circuito
  const t0 = performance.now();
  const fin = r => ({ ...r, latencyMs: performance.now() - t0 });

  if (tarea === 'router') {
    if (esPool) {
      const r = await poolClasificar(envPool, SYSTEM_CLASIFICADOR_INTENCION, caso.mensaje, ETIQUETAS_CLASIFICADOR_INTENCION,
        { modelo: modeloPool, timeoutMs: poolTimeout ?? AI_POOL_TIMEOUTS.router, uso: 'benchmark_router' }, opts);
      if (!r) return fin({ status: 'respaldo', pass: false });
      return fin({ status: 'ok', pass: r.etiqueta === caso.esperado, salida: r.etiqueta, usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } });
    }
    const r = await anthropic(fetchImpl, SYSTEM_CLASIFICADOR_INTENCION, caso.mensaje, 30);
    if (r.status !== 'ok') return fin(r);
    const etiqueta = etiquetaHaikuProduccion(r.texto);
    return fin({ status: 'ok', pass: etiqueta === caso.esperado, salida: etiqueta, usage: r.usage });
  }

  if (tarea === 'simple') {
    const validar = t => !!t && t.length <= 1200 && caso.debe.test(t) && sinFuga(t);
    if (esPool) {
      const r = await poolChat(envPool, { messages: [{ role: 'system', content: sistemaSimple }, { role: 'user', content: caso.mensaje }], maxTokens: 600, timeoutMs: poolTimeout ?? AI_POOL_TIMEOUTS.simple, modelo: modeloPool, uso: 'benchmark_simple' }, opts);
      if (!r.ok) return fin({ status: r.motivo === 'timeout' ? 'timeout' : 'respaldo', pass: false });
      return fin({ status: 'ok', pass: validar(r.texto), salida: r.texto.slice(0, 300), usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } });
    }
    const r = await anthropic(fetchImpl, sistemaSimple, caso.mensaje, 600);
    if (r.status !== 'ok') return fin(r);
    return fin({ status: 'ok', pass: validar(r.texto), salida: r.texto.slice(0, 300), usage: r.usage });
  }

  if (tarea === 'banco') {
    const esRouter = caso.tipo === 'router';
    const tools = caso.tools && caso.tools.length ? caso.tools : undefined;
    const maxTokens = esRouter ? 24 : 600;
    const evaluar = (r, etiqueta) => {
      const ev = evaluarCasoBanco(caso, { etiqueta, texto: r.texto, toolCalls: r.toolCalls });
      return { status: 'ok', pass: ev.pass, motivo: ev.motivo || null };
    };
    const salidaCorta = r => ((r.toolCalls || []).map(t => t.function?.name || t.name).join(',') || r.texto || '').slice(0, 300);
    if (esPool) {
      const timeout = poolTimeout ?? (esRouter ? AI_POOL_TIMEOUTS.router : caso.tipo === 'experto_simple' ? AI_POOL_TIMEOUTS.simple : AI_POOL_TIMEOUTS.fallback);
      const r = await poolChat(envPool, { messages: caso.mensajes, tools, json: esRouter, ...(esRouter ? { temperature: 0 } : {}), maxTokens, timeoutMs: timeout, modelo: modeloPool, uso: 'benchmark_banco' }, opts);
      if (!r.ok) return fin({ status: r.motivo === 'timeout' ? 'timeout' : 'respaldo', pass: false, motivo: r.motivo, modeloReal: r.modeloReal || null });
      const etiqueta = esRouter ? normalizarEtiquetaRouter(r.texto, ETIQUETAS_CLASIFICADOR_INTENCION) : undefined;
      return fin({ ...evaluar(r, etiqueta), modeloReal: r.modeloReal || null, salida: salidaCorta(r), usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } });
    }
    const r = candidato === 'claude-haiku-4-5'
      ? await anthropicConTools(fetchImpl, caso.mensajes, tools, maxTokens)
      : await chatOpenAICompat(fetchImpl, 'https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY, candidato, caso.mensajes, tools);
    if (r.status !== 'ok') return fin(r);
    const etiqueta = esRouter ? (normalizarEtiquetaRouter(r.texto, ETIQUETAS_CLASIFICADOR_INTENCION) || etiquetaHaikuProduccion(r.texto)) : undefined;
    return fin({ ...evaluar(r, etiqueta), salida: salidaCorta(r), usage: r.usage });
  }

  if (tarea === 'buscar_web') {
    if (esPool) {
      const r = await poolBuscar(envPool, caso.query, { maxResultados: 5, timeoutMs: poolTimeout ?? AI_POOL_TIMEOUTS.search, uso: 'benchmark_search' }, opts);
      if (!r) return fin({ status: 'respaldo', pass: false });
      const blob = r.resultados.map(x => `${x.title} ${x.url} ${x.content}`).join('\n') + (r.answer || '');
      return fin({ status: 'ok', pass: caso.espera.test(blob), salida: r.resultados.map(x => x.url).slice(0, 5) });
    }
    if (candidato === 'tavily') {
      const resp = await fetchImpl('https://api.tavily.com/search', {
        method: 'POST', signal: AbortSignal.timeout(60000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: caso.query, search_depth: 'basic', max_results: 5, include_answer: true })
      });
      if (!resp.ok) return fin({ status: 'http_' + resp.status });
      const d = await resp.json();
      const blob = (d.results || []).map(x => `${x.title} ${x.url} ${x.content}`).join('\n') + (d.answer || '');
      return fin({ status: 'ok', pass: caso.espera.test(blob), salida: (d.results || []).map(x => x.url).slice(0, 5) });
    }
    const resp = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(60000),
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', store: false, tools: [{ type: 'web_search_preview' }], input: caso.query })
    });
    if (!resp.ok) return fin({ status: 'http_' + resp.status });
    const d = await resp.json();
    const texto = (d.output || []).filter(b => b.type === 'message').flatMap(m => m.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n');
    return fin({ status: 'ok', pass: caso.espera.test(texto), salida: texto.slice(0, 300), usage: d.usage ? { input: d.usage.input_tokens, output: d.usage.output_tokens } : null });
  }

  // tarea === 'respaldo'
  const messages = [{ role: 'system', content: sistemaRespaldo }, { role: 'user', content: caso.mensaje }];
  const validar = (texto, toolCalls) => {
    const nombres = (toolCalls || []).map(tc => tc.function?.name);
    return caso.tool ? nombres.includes(caso.tool) : (!nombres.length && caso.texto.test(texto || '') && sinFuga(texto));
  };
  if (esPool) {
    const r = await poolChat(envPool, { messages, tools: toolsRespaldo, maxTokens: 512, timeoutMs: poolTimeout ?? AI_POOL_TIMEOUTS.fallback, modelo: modeloPool, uso: 'benchmark_respaldo' }, opts);
    if (!r.ok) return fin({ status: r.motivo === 'timeout' ? 'timeout' : 'respaldo', pass: false, motivo: r.motivo, modeloReal: r.modeloReal || null });
    return fin({ status: 'ok', pass: validar(r.texto, r.toolCalls), modeloReal: r.modeloReal || null, salida: (r.toolCalls.map(t => t.function.name).join(',') || r.texto).slice(0, 300), usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } });
  }
  const [url, clave] = candidato === 'grok-4'
    ? ['https://api.x.ai/v1/chat/completions', process.env.XAI_API_KEY]
    : ['https://api.openai.com/v1/chat/completions', process.env.OPENAI_API_KEY];
  const r = await chatOpenAICompat(fetchImpl, url, clave, candidato, messages, toolsRespaldo);
  if (r.status !== 'ok') return fin(r);
  return fin({ status: 'ok', pass: validar(r.texto, r.toolCalls), salida: ((r.toolCalls || []).map(t => t.function?.name).join(',') || r.texto || '').slice(0, 300), usage: r.usage });
}

const casosPorTarea = { router: casosRouter, simple: casosSimple, buscar_web: casosBusqueda, respaldo: casosRespaldo, banco: cargarBancoAlejandra() };

export async function run({ tareas = Object.keys(candidatos), repeats = 1, budget = 1, outputDir = '.ai-benchmark-results/pool', fetchImpl = fetch, env = process.env } = {}) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3 || !Number.isFinite(budget) || budget < 0 || budget > 5) throw new Error('Invalid limits');
  await mkdir(outputDir, { recursive: true });
  const envPool = { AI_POOL_KEY: env.AI_POOL_KEY, AI_POOL_URL: env.AI_POOL_URL };
  const poolTimeout = env.BENCHMARK_POOL_TIMEOUT_MS ? Number(env.BENCHMARK_POOL_TIMEOUT_MS) : undefined;
  const filas = [];
  let gastado = 0;
  for (let rep = 0; rep < repeats; rep++) for (const tarea of tareas) for (const caso of casosPorTarea[tarea]) {
    for (const candidato of candidatos[tarea]) {
      const base = { tarea, candidato, caso: caso.id, repeat: rep };
      if (candidato.startsWith('ai_pool:') ? !poolConfigurado(envPool) : !env[credencial(candidato)]) {
        filas.push({ ...base, status: candidato.startsWith('ai_pool:') ? 'omitido_sin_clave' : 'omitido_sin_credenciales', pass: false, costUsd: null });
        continue;
      }
      if (gastado + reserva(candidato) > budget) { filas.push({ ...base, status: 'omitido_presupuesto', pass: false, costUsd: null }); continue; }
      let r;
      try { r = await ejecutarCaso(tarea, candidato, caso, { fetchImpl, envPool, poolTimeout }); }
      catch (e) { r = { status: e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'error_red_o_parseo', pass: false }; }
      // Una llamada de pago fallida puede haberse facturado igual: se reserva su cota.
      const costUsd = r.status === 'ok' ? costeEstimado(candidato, r.usage) : (candidato.startsWith('ai_pool:') ? 0 : null);
      gastado += costUsd ?? reserva(candidato);
      filas.push({ ...base, ...(caso.tipo ? { tipo: caso.tipo } : {}), status: r.status, pass: !!r.pass, motivo: r.motivo ?? null, modeloReal: r.modeloReal ?? null, latencyMs: r.latencyMs ?? null, usage: r.usage ?? null, costUsd, salida: r.salida ?? null });
      console.log(`${tarea} ${candidato} ${caso.id}: ${r.status}, acierto=${!!r.pass}`);
    }
  }
  const resumen = resumir(filas);
  const datos = {
    fecha: new Date().toISOString(), fixture: 'pool-adr0028-v2', repeats, presupuestoUsd: budget,
    poolConfigurado: poolConfigurado(envPool),
    timeoutsPool: poolTimeout ? { todos: poolTimeout } : AI_POOL_TIMEOUTS,
    limitaciones: [
      'Casos sintéticos: no son prompts completos de producción ni datos de empresas',
      'Banco casos-alejandra.json: prompts de sistema condensados y datos ficticios de la empresa demo; tools con los esquemas reales del agente',
      'Latencia HTTP total sin streaming; el pool con carga en frío puede tardar 20–120 s la primera vez',
      'Coste estimado por tarifa; el pool cuenta 0 por token (no incluye electricidad)',
      'Búsqueda web real: los resultados cambian con el tiempo'
    ],
    filas, resumen
  };
  await writeFile(`${outputDir}/results.json`, JSON.stringify(datos, null, 2) + '\n');
  const f = (v, d = 3) => v === null || v === undefined ? 'N/D' : Number(v).toFixed(d);
  await writeFile(`${outputDir}/report.md`, '# Pool propio vs proveedores actuales (ADR-0028)\n\n' +
    '| Tarea | Candidato | Medidos/intentos | Aciertos | % acierto | p50 s | p95 s | Coste USD | USD/acierto | Fallos | Modelo real |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|\n' +
    resumen.map(r => `| ${r.tarea} | ${r.candidato} | ${r.medidos}/${r.intentos} | ${r.aciertos} | ${f(r.acierto === null ? null : r.acierto * 100, 0)} | ${f(r.p50Ms === null ? null : r.p50Ms / 1000, 2)} | ${f(r.p95Ms === null ? null : r.p95Ms / 1000, 2)} | ${f(r.costeUsd, 5)} | ${f(r.costePorAciertoUsd, 5)} | ${Object.entries({ ...r.motivosFallo, ...r.motivosError }).map(([k, v]) => `${k}×${v}`).join(', ') || '—'} | ${Object.entries(r.modelosReales).map(([k, v]) => `${k}×${v}`).join(', ') || '—'} |`).join('\n') +
    '\n\nN/D = sin medición (no es cero). «omitido_*» no cuenta como fallo. Cómo leerlo: docs/decisions/ADR-0028-AI-POOL-PROPIO-CON-RESPALDO.md §Medición.\n');
  console.log(JSON.stringify(resumen, null, 2));
  return datos;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const tareas = process.env.BENCHMARK_TAREAS ? process.env.BENCHMARK_TAREAS.split(',').map(s => s.trim()).filter(t => candidatos[t]) : undefined;
    await run({
      ...(tareas && tareas.length ? { tareas } : {}),
      repeats: Number(process.env.BENCHMARK_REPEATS || 1),
      budget: Number(process.env.BENCHMARK_BUDGET_USD || 1),
      outputDir: process.env.BENCHMARK_OUTPUT || '.ai-benchmark-results/pool'
    });
  } catch { console.error('Pool benchmark failed; credentials and provider error bodies omitted.'); process.exitCode = 1; }
}
