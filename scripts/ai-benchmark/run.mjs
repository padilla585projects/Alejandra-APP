import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { instructions, cases } from './cases.mjs';

// Tarifas Standard USD/MTok verificadas 2026-10-01; únicamente llamadas de texto.
// Fuentes y límites en docs/features/comparacion-modelos-ia.md.
export const models = {
  'gpt-4o-mini': { provider: 'openai', input: .15, cached: .075, output: .6 },
  'gpt-4o': { provider: 'openai', input: 2.5, cached: 1.25, output: 10 },
  'gpt-6-luna': { provider: 'openai', input: .1, cached: .01, output: .5 },
  'gpt-6.1-sol': { provider: 'openai', input: 2, cached: .1, output: 10 },
  'gpt-6-astra': { provider: 'openai', input: 10, cached: 1, output: 50 },
  'claude-haiku-4-5': { provider: 'anthropic', input: 1, cached: .1, output: 5 },
  'claude-sonnet-4-6': { provider: 'anthropic', input: 3, cached: .3, output: 15 },
};
export function score(text, expected) {
  try { return isDeepStrictEqual(JSON.parse(text), expected); }
  catch { return false; }
}
export function cost(model, usage) {
  const rate = models[model];
  if (!usage || !Number.isFinite(usage.input) || !Number.isFinite(usage.output)) return null;
  const cached = usage.cached || 0;
  // No se solicitan escrituras de caché. Si aparecen, no estimar el coste como cero.
  if (usage.cacheWrite) return null;
  return ((usage.input - cached) * rate.input + cached * rate.cached + usage.output * rate.output) / 1e6;
}
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}
export function summarize(rows) {
  return [...new Set(rows.map(r => r.model))].map(model => {
    const items = rows.filter(r => r.model === model);
    const completed = items.filter(r => r.status === 'completed');
    const successful = completed.filter(r => r.pass);
    const billed = items.filter(r => r.status === 'completed' || r.status === 'incomplete');
    const ambiguous = items.some(r => r.status === 'network_or_parse_error');
    const totalCost = !ambiguous && billed.length && billed.every(r => r.costUsd !== null) ? billed.reduce((n,r) => n+r.costUsd,0) : null;
    return { model, attempted: items.length, completed: completed.length, passed: successful.length,
      criticalFailures: completed.filter(r => r.critical && !r.pass).length,
      accuracy: completed.length ? successful.length / completed.length : null,
      successPerAttempt: items.length ? successful.length/items.length : null,
      p50Ms: percentile(completed.map(r => r.latencyMs), .5), p95Ms: percentile(completed.map(r => r.latencyMs), .95),
      estimatedCostUsd: totalCost, costPerSuccessUsd: successful.length && totalCost !== null ? totalCost / successful.length : null,
      groups: Object.fromEntries([...new Set(items.map(r => r.group))].map(group => {
        const subset = completed.filter(r => r.group === group);
        return [group, { completed: subset.length, passed: subset.filter(r => r.pass).length }];
      })) };
  });
}
export function request(model, prompt, maxOutput) {
  if (models[model].provider === 'anthropic') return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': process.env.ANTHROPIC_API_KEY },
    body: { model, max_tokens: maxOutput, system: instructions, messages: [{role:'user',content:prompt}] },
  };
  return {
    url: 'https://api.openai.com/v1/responses',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: { model, store: false, instructions, input: prompt, max_output_tokens: maxOutput,
      ...(model.startsWith('gpt-6') ? { reasoning: { effort: 'low' } } : {}) },
  };
}
export async function run({ selected = Object.keys(models), repeats = 1, budget = 2, outputDir = '.ai-benchmark-results', fetchImpl = fetch } = {}) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3 || !Number.isFinite(budget) || budget <= 0 || budget > 5) throw new Error('Invalid limits');
  if (!selected.length || selected.some(model => !models[model])) throw new Error('Unknown model');
  await mkdir(outputDir, {recursive:true});
  const rows = [], disabled = new Set();
  let spent = 0, uncertainBilling = false;
  const maxOutput = 768;
  const report = async () => {
    const data = { date: new Date().toISOString(), fixture: 'synthetic-v1', repeats, budgetUsd: budget,
      latency: 'HTTP total, no streaming/TTFT', limitations: ['Pilot of text tasks, not full production prompts or routing', 'No live web, tools execution, images, AR, audio or manufacturer accuracy', 'Token-rate estimate, not provider invoice', 'Failures and incomplete output cannot be counted as successful'],
      rows, summary: summarize(rows) };
    await writeFile(`${outputDir}/results.json`, JSON.stringify(data,null,2)+'\n');
    const format = (v,d=3) => v === null ? 'N/D' : v.toFixed(d);
    await writeFile(`${outputDir}/report.md`, '# Comparación IA — piloto sintético\n\n'+
      '| Modelo | Completadas/intentos | Exactas | Fallos críticos | p50 s | p95 s | Coste estimado USD |\n|---|---:|---:|---:|---:|---:|---:|\n'+
      data.summary.map(r => `| ${r.model} | ${r.completed}/${r.attempted} | ${r.passed} | ${r.criticalFailures} | ${format(r.p50Ms===null?null:r.p50Ms/1000)} | ${format(r.p95Ms===null?null:r.p95Ms/1000)} | ${format(r.estimatedCostUsd,6)} |`).join('\n')+
      '\n\nPiloto de texto sintético. No acredita calidad de visión, voz, búsqueda real, permisos del backend ni funcionamiento del AR. N/D significa sin medición; no cero. Revisar resultados por grupo y errores antes de comparar.\n');
    return data;
  };
  // Rota el orden para reducir sesgo por momento de ejecución. Sin reintentos pagados.
  for (let repeat=0;repeat<repeats;repeat++) for (let c=0;c<cases.length;c++) {
    const fixture = cases[c];
    const shift = (repeat+c)%selected.length;
    const ordered = [...selected.slice(shift),...selected.slice(0,shift)];
    for (const model of ordered) {
      if (disabled.has(model) || uncertainBilling) continue;
      const base = { model, caseId: fixture.id, group: fixture.group, critical: !!fixture.critical, repeat };
      const variable = models[model].provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
      if (!process.env[variable]) {
        rows.push({...base,status:'missing_credentials',pass:false,costUsd:null}); disabled.add(model); await report(); continue;
      }
      // UTF-8 bytes bound input tokens conservatively for these short text prompts.
      // API usage reconciles each call; timeout/network ambiguity stops further calls.
      const reservation = (Buffer.byteLength(instructions+fixture.prompt)+512)*models[model].input/1e6 + maxOutput*models[model].output/1e6;
      if (spent+reservation > budget) { rows.push({...base,status:'budget_stop',pass:false,costUsd:null}); disabled.add(model); await report(); continue; }
      const spec = request(model, fixture.prompt, maxOutput);
      const start = performance.now();
      try {
        const response = await fetchImpl(spec.url, {method:'POST',headers:spec.headers,body:JSON.stringify(spec.body),signal:AbortSignal.timeout(60000)});
        const latencyMs = performance.now()-start;
        if (!response.ok) {
          // Nunca registrar cuerpos de error, cabeceras de auth ni claves.
          rows.push({...base,status:`http_${response.status}`,latencyMs,pass:false,costUsd:null}); disabled.add(model);
        } else {
          const payload = await response.json();
          const anthropic = models[model].provider === 'anthropic';
          const text = anthropic ? (payload.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('') : (payload.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
          const u = payload.usage;
          const usage = !u ? null : anthropic ? { input: u.input_tokens+(u.cache_read_input_tokens||0), output:u.output_tokens, cached:u.cache_read_input_tokens||0, cacheWrite:u.cache_creation_input_tokens||0 } : { input:u.input_tokens,output:u.output_tokens,cached:u.input_tokens_details?.cached_tokens||0,reasoning:u.output_tokens_details?.reasoning_tokens||0 };
          const costUsd = cost(model,usage);
          const complete = anthropic ? payload.stop_reason==='end_turn' : payload.status==='completed';
          rows.push({...base,status:complete?'completed':'incomplete',returnedModel:payload.model,latencyMs:performance.now()-start,usage,costUsd,pass:complete&&score(text,fixture.expected),output:text});
          if (costUsd === null) uncertainBilling = true;
          else spent += costUsd;
        }
      } catch {
        rows.push({...base,status:'network_or_parse_error',latencyMs:performance.now()-start,pass:false,costUsd:null}); uncertainBilling = true;
      }
      await report();
      console.log(`${model} ${fixture.id}: ${rows.at(-1).status}, exact=${rows.at(-1).pass}`);
    }
  }
  const data = await report();
  console.log(JSON.stringify(data.summary,null,2));
  return data;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const data = await run({ repeats: Number(process.env.BENCHMARK_REPEATS || 1), budget: Number(process.env.BENCHMARK_BUDGET_USD || 2), outputDir: process.env.BENCHMARK_OUTPUT || '.ai-benchmark-results' });
    if (data.rows.some(r=>r.status!=='completed')) process.exitCode=2;
  } catch { console.error('Benchmark failed; credentials and provider error bodies omitted.'); process.exitCode=1; }
}
