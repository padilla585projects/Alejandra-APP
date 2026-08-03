import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  consultarMemoria,
  listarCandidatasPendientes,
  confirmarCandidata,
  rechazarCandidata,
  inyectarMemoria,
  caducidadPorDefecto,
  CATEGORIAS_LISTA_BLANCA,
  METODOS_VALIDOS,
  ESTADOS_VALIDOS,
} from '../src/memory.js';

test('Memory: consultarMemoria sin implementación inyectada devuelve []', async () => {
  assert.deepEqual(await consultarMemoria({ empresaId: 'e1', consulta: 'x' }), []);
});

test('Memory: listarCandidatasPendientes sin implementación inyectada devuelve []', async () => {
  assert.deepEqual(await listarCandidatasPendientes({ empresaId: 'e1' }), []);
});

test('Memory: confirmarCandidata sin implementación inyectada no lanza', async () => {
  await assert.doesNotReject(() => confirmarCandidata({ id: '1', aprobadaPor: 'u1' }));
});

test('Memory: rechazarCandidata sin implementación inyectada no lanza', async () => {
  await assert.doesNotReject(() => rechazarCandidata({ id: '1' }));
});

test('Memory: inyectarMemoria conecta consultarMemoria a la implementación real', async () => {
  const recuerdosFalsos = [{ id: '1', contenido: 'x', estado: 'confirmada' }];
  inyectarMemoria({
    consultarMemoria: async (params) => {
      assert.equal(params.empresaId, 'e1');
      return recuerdosFalsos;
    },
  });
  assert.deepEqual(await consultarMemoria({ empresaId: 'e1' }), recuerdosFalsos);

  // Reset para no afectar otros tests del mismo proceso.
  inyectarMemoria({ consultarMemoria: async () => [] });
});

test('Memory: inyectarMemoria conecta confirmarCandidata a la implementación real', async () => {
  let llamado = null;
  inyectarMemoria({
    confirmarCandidata: async (params) => { llamado = params; },
  });
  await confirmarCandidata({ id: '5', aprobadaPor: 'u9' });
  assert.deepEqual(llamado, { id: '5', aprobadaPor: 'u9' });
});

test('Memory: la lista blanca de categorías coincide exactamente con ADR-0013 §1', () => {
  assert.deepEqual(CATEGORIAS_LISTA_BLANCA, [
    'hechos_operativos',
    'preferencias_trabajo',
    'procedimientos_internos',
    'correcciones',
  ]);
});

test('Memory: los métodos válidos coinciden exactamente con ADR-0013 §3', () => {
  assert.deepEqual(METODOS_VALIDOS, ['declarado', 'corregido', 'procedimiento', 'inferido']);
});

test('Memory: los estados válidos coinciden exactamente con ADR-0013 §1/§3', () => {
  assert.deepEqual(ESTADOS_VALIDOS, ['candidata_pendiente_validacion', 'confirmada']);
});

test('Memory: caducidadPorDefecto("procedimiento") es 12 meses (ADR-0013 §5)', () => {
  assert.equal(caducidadPorDefecto('procedimiento'), 12);
});

test('Memory: caducidadPorDefecto de cualquier otro método es 6 meses', () => {
  assert.equal(caducidadPorDefecto('declarado'), 6);
  assert.equal(caducidadPorDefecto('corregido'), 6);
  assert.equal(caducidadPorDefecto('inferido'), 6);
});

test('Memory: caducidadPorDefecto rechaza un método desconocido', () => {
  assert.throws(() => caducidadPorDefecto('inventado'));
});
