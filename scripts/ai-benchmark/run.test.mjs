import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { score, cost, summarize, run, request } from './run.mjs';

test('rechaza JSON inválido, campos extra, tipos y una decisión peligrosa', () => {
  assert.equal(score('{"accion":"rechazar","empresa":null}',{accion:'rechazar',empresa:null}),true);
  for (const output of ['texto','{"accion":"consultar","empresa":"B"}','{"accion":"rechazar","empresa":null,"extra":1}']) assert.equal(score(output,{accion:'rechazar',empresa:null}),false);
  assert.equal(score('{"cantidad":"12"}',{cantidad:12}),false);
});
test('cobra caché y todos los tokens de salida, sin inferir costes desconocidos', () => {
  assert.equal(cost('gpt-6.1-sol',{input:1000,cached:500,output:200}),.00305);
  assert.equal(cost('gpt-6.1-sol',null),null);
  assert.equal(cost('claude-haiku-4-5',{input:100,output:10,cacheWrite:20}),null);
});
test('no presenta errores como latencia o coste cero; cuenta fallos críticos', () => {
  const summary = summarize([{model:'gpt-6-luna',status:'http_404',group:'decision'}])[0];
  assert.equal(summary.accuracy,null); assert.equal(summary.p50Ms,null); assert.equal(summary.estimatedCostUsd,null);
  const s = summarize([{model:'gpt-6-luna',group:'decision',status:'completed',critical:true,pass:false,latencyMs:500,costUsd:.01}])[0];
  assert.equal(s.criticalFailures,1); assert.equal(s.costPerSuccessUsd,null);
});
test('Sol usa Responses; las herramientas reales y el almacenamiento están desactivados', () => {
  const spec = request('gpt-6.1-sol','prueba',768);
  assert.equal(spec.url,'https://api.openai.com/v1/responses');
  assert.equal(spec.body.store,false); assert.equal(spec.body.tools,undefined); assert.equal(spec.body.reasoning.effort,'low');
});
test('las salidas truncadas tienen coste aunque no resuelvan la tarea', () => {
  const summary=summarize([{model:'gpt-6.1-sol',group:'planos',status:'incomplete',pass:false,costUsd:.03}])[0];
  assert.equal(summary.completed,0); assert.equal(summary.accuracy,null);
  assert.equal(summary.estimatedCostUsd,.03); assert.equal(summary.costPerSuccessUsd,null);
});
test('no inicia llamadas cuando la reserva supera el presupuesto', async () => {
  const dir=await mkdtemp(join(tmpdir(),'alejandra-benchmark-budget-'));
  const previous=process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='synthetic-test-value';
  try {
    const result=await run({selected:['gpt-6-astra'],budget:.000001,outputDir:dir,fetchImpl:async()=>{throw new Error('No paid request permitted');}});
    assert.equal(result.rows[0].status,'budget_stop'); assert.equal(result.rows.length,1);
  } finally { if(previous===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=previous; await rm(dir,{recursive:true,force:true}); }
});
test('un error de proveedor no reintenta ni registra su cuerpo sensible', async () => {
  const dir = await mkdtemp(join(tmpdir(),'alejandra-benchmark-'));
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY='synthetic-test-value';
  let calls=0;
  try {
    const result=await run({selected:['gpt-6-luna'],outputDir:dir,fetchImpl:async()=>{ calls++; return {ok:false,status:403,json:()=>{throw new Error('must not read error body');}}; }});
    assert.equal(calls,1); assert.equal(result.rows.length,1); assert.equal(result.rows[0].status,'http_403');
    assert.equal(JSON.stringify(result).includes('synthetic-test-value'),false);
  } finally { if(previous===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=previous; await rm(dir,{recursive:true,force:true}); }
});
