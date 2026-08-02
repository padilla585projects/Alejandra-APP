import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  consultarMemoria,
  listarCandidatasPendientes,
  confirmarCandidata,
  rechazarCandidata,
  caducidadPorDefecto,
  CATEGORIAS_LISTA_BLANCA,
  METODOS_VALIDOS,
  ESTADOS_VALIDOS,
} from '../src/memory.js';

test('Memory: consultarMemoria lanza un error explícito (sin persistencia real)', () => {
  assert.throws(
    () => consultarMemoria({ empresaId: 'e1', consulta: 'x', filtros: {} }),
    /ADR-0013/
  );
});

test('Memory: listarCandidatasPendientes lanza un error explícito', () => {
  assert.throws(() => listarCandidatasPendientes({ empresaId: 'e1' }), /ADR-0013/);
});

test('Memory: confirmarCandidata lanza un error explícito', () => {
  assert.throws(() => confirmarCandidata({ id: '1', aprobadaPor: 'u1' }), /ADR-0013/);
});

test('Memory: rechazarCandidata lanza un error explícito', () => {
  assert.throws(() => rechazarCandidata({ id: '1' }), /ADR-0013/);
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
