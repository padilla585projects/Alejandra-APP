import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evaluarAccion, permitidoParaCron } from '../src/policy-engine.js';

test('Policy Engine: exige nivel_riesgo declarado, nunca lo infiere', () => {
  assert.throws(() => evaluarAccion({}), /declarada/);
  assert.throws(() => evaluarAccion({ nivel_riesgo: 'N9' }));
});

test('Policy Engine: N3 (p.ej. run_migration, ADR-0006) exige aprobación del Director', () => {
  const resultado = evaluarAccion({ nombre: 'run_migration', nivel_riesgo: 'N3' });
  assert.equal(resultado.requiereAprobacion, true);
  assert.equal(resultado.quienAprueba, 'director');
  assert.equal(resultado.permitidoParaCron, false);
});

test('Policy Engine: N0 no exige aprobación y el cron puede ejecutarlo', () => {
  const resultado = evaluarAccion({ nombre: 'consultar_personal', nivel_riesgo: 'N0' });
  assert.equal(resultado.requiereAprobacion, false);
  assert.equal(permitidoParaCron({ nivel_riesgo: 'N0' }), true);
});

test('Policy Engine: N2 no está permitido para el cron (ADR-0006)', () => {
  assert.equal(permitidoParaCron({ nivel_riesgo: 'N2' }), false);
});