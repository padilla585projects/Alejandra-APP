import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearEstadoCognitivo, actualizarEstadoCognitivo } from '../src/estado-cognitivo.js';
import { construirContexto } from '../src/context-engine.js';
import { construirPlan } from '../src/planner.js';
import { decidir, decidirInvocacionPilotoN0, tieneTrazaSuficiente, CAMPOS_TRAZA_OBLIGATORIOS } from '../src/motor-decision.js';

test('Estado Cognitivo: se crea en fase percibir y es inmutable al actualizar', () => {
  const estado = crearEstadoCognitivo('tarea-1');
  assert.equal(estado.tareaId, 'tarea-1');
  assert.equal(estado.fase, 'percibir');

  const actualizado = actualizarEstadoCognitivo(estado, { fase: 'comprender' });
  assert.equal(actualizado.fase, 'comprender');
  assert.equal(estado.fase, 'percibir', 'el estado original no debe mutar');
});

test('Estado Cognitivo: rechaza fases desconocidas', () => {
  const estado = crearEstadoCognitivo('tarea-2');
  assert.throws(() => actualizarEstadoCognitivo(estado, { fase: 'inventada' }));
});

test('Estado Cognitivo: exige tareaId', () => {
  assert.throws(() => crearEstadoCognitivo());
});

test('Context Engine, Planner y Motor de Decisión son interfaces sin implementar', () => {
  assert.throws(() => construirContexto({}), /esqueleto de F-1\.2/);
  assert.throws(() => construirPlan({}), /esqueleto de F-1\.2/);
  assert.throws(() => decidir({}), /esqueleto de F-1\.2/);
});

test('Motor de Decisión: decidir() acepta registrarTraza inyectado sin invocarlo mientras no esté implementada', () => {
  let invocada = false;
  const registrarTraza = async () => { invocada = true; };
  assert.throws(() => decidir({}, { registrarTraza }), /esqueleto de F-1\.2/);
  assert.equal(invocada, false);
});

test('Motor de Decisión: el contrato exige los campos de traza de 04-MOTOR-DE-DECISION.md', () => {
  const decisionCompleta = Object.fromEntries(CAMPOS_TRAZA_OBLIGATORIOS.map((c) => [c, 'valor']));
  assert.equal(tieneTrazaSuficiente(decisionCompleta), true);

  const decisionIncompleta = { decision: 'responder' };
  assert.equal(tieneTrazaSuficiente(decisionIncompleta), false);

  assert.equal(tieneTrazaSuficiente(null), false);
});

test('Motor de Decisión: el piloto permite y deja trazada una tool N0 ofrecida', () => {
  const resultado = decidirInvocacionPilotoN0({
    tool: { name: 'consultar_personal', nivel_riesgo: 'N0' },
    toolOfrecida: true,
    authOk: true,
    modo: 'gestion',
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, true);
  assert.equal(resultado.decision.decision, 'invocar_tool');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

test('Motor de Decisión: el piloto rechaza una tool no ofrecida', () => {
  const resultado = decidirInvocacionPilotoN0({
    tool: { name: 'escribir_bd', nivel_riesgo: 'N2' },
    toolOfrecida: false,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'tool_no_ofrecida');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

test('Motor de Decisión: N1-N3 siguen fuera del piloto sin cambiar sus gates', () => {
  const resultado = decidirInvocacionPilotoN0({
    tool: { name: 'gestionar_tarea', nivel_riesgo: 'N1' },
    toolOfrecida: true,
  });
  assert.equal(resultado.aplicaPiloto, false);
  assert.equal(resultado.permitida, true);
  assert.equal(resultado.decision.criterio_salida, 'fuera_piloto_n0');
});