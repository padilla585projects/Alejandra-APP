import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validarDeclaracionTool,
  registrarTool,
  filtrarToolsPorAcceso,
  filtrarToolsParaCron,
  NIVELES_ACCESO,
  NIVELES_CRON,
} from '../src/tool-registry.js';

import {
  verificarDeterminista,
  solicitarRevisionHumanaAsincrona,
  registrarExplicabilidad,
  nivelesRequeridosPara,
  NIVELES_VERIFICACION,
} from '../src/verifier.js';

const toolValida = Object.freeze({
  name: 'consultar_personal',
  description: 'Consulta datos de personal de la empresa',
  input_schema: {},
  acceso: 'sesion',
  cron: 'permitido',
  nivel_riesgo: 'N0',
});

test('Tool Registry: valida una declaración completa (ADR-0010)', () => {
  assert.equal(validarDeclaracionTool(toolValida), true);
});

test('Tool Registry: rechaza una tool sin "acceso" declarado', () => {
  const { acceso, ...sinAcceso } = toolValida;
  assert.throws(() => validarDeclaracionTool(sinAcceso), /acceso/);
});

test('Tool Registry: rechaza una tool sin "nivel_riesgo" declarado', () => {
  const { nivel_riesgo, ...sinNivel } = toolValida;
  assert.throws(() => validarDeclaracionTool(sinNivel), /nivel_riesgo/);
});

test('Tool Registry: rechaza valores de "acceso"/"cron" fuera de la lista de ADR-0010', () => {
  assert.throws(() => validarDeclaracionTool({ ...toolValida, acceso: 'anonimo' }));
  assert.throws(() => validarDeclaracionTool({ ...toolValida, cron: 'siempre' }));
});

test('Tool Registry: registrarTool acumula sin mutar el catálogo original', () => {
  const vacio = [];
  const conUna = registrarTool(vacio, toolValida);
  assert.equal(vacio.length, 0, 'el catálogo original no debe mutar');
  assert.equal(conUna.length, 1);
  assert.equal(conUna[0].name, 'consultar_personal');
});

test('Tool Registry: rechaza un nombre de tool duplicado', () => {
  const catalogo = registrarTool([], toolValida);
  assert.throws(() => registrarTool(catalogo, toolValida), /ya está registrada/);
});

test('Tool Registry: filtrarToolsPorAcceso respeta público/sesión/dev_verificado', () => {
  const catalogo = [
    { ...toolValida, name: 'publica', acceso: 'publico' },
    { ...toolValida, name: 'con_sesion', acceso: 'sesion' },
    { ...toolValida, name: 'solo_dev', acceso: 'dev_verificado' },
  ];

  const sinSesion = filtrarToolsPorAcceso(catalogo, {});
  assert.deepEqual(sinSesion.map((t) => t.name), ['publica']);

  const conSesion = filtrarToolsPorAcceso(catalogo, { sesionValida: true });
  assert.deepEqual(conSesion.map((t) => t.name), ['publica', 'con_sesion']);

  const devVerificado = filtrarToolsPorAcceso(catalogo, { sesionValida: true, devVerificado: true });
  assert.deepEqual(devVerificado.map((t) => t.name), ['publica', 'con_sesion', 'solo_dev']);
});

test('Tool Registry: filtrarToolsParaCron excluye las prohibidas para cron (ADR-0006/0017)', () => {
  const catalogo = [
    { ...toolValida, name: 'permitida', cron: 'permitido' },
    { ...toolValida, name: 'prohibida', cron: 'prohibido' },
  ];
  assert.deepEqual(filtrarToolsParaCron(catalogo).map((t) => t.name), ['permitida']);
});

test('Tool Registry: NIVELES_ACCESO y NIVELES_CRON coinciden exactamente con ADR-0010', () => {
  assert.deepEqual(NIVELES_ACCESO, ['publico', 'sesion', 'dev_verificado']);
  assert.deepEqual(NIVELES_CRON, ['permitido', 'prohibido']);
});

test('Verifier: NIVELES_VERIFICACION coincide con los tres niveles de ADR-0009', () => {
  assert.deepEqual(NIVELES_VERIFICACION, ['determinista', 'revision_humana_asincrona', 'explicabilidad']);
});

test('Verifier: nivel determinista aplica una condición pura ya provista, no inventa una', () => {
  const esDestructivo = (sql) => /^(DELETE|DROP|TRUNCATE)/i.test(sql);
  assert.equal(verificarDeterminista(esDestructivo, 'SELECT 1').aprobado, false);
  assert.equal(verificarDeterminista(esDestructivo, 'DROP TABLE x').aprobado, true);
  assert.throws(() => verificarDeterminista('no es una función', 'x'));
});

test('Verifier: revisión humana asíncrona y explicabilidad lanzan error explícito (ADR-0009)', () => {
  assert.throws(() => solicitarRevisionHumanaAsincrona(), /ADR-0009/);
  assert.throws(() => registrarExplicabilidad(), /ADR-0009/);
});

test('Verifier: nivelesRequeridosPara sigue la tabla de ADR-0009/0006', () => {
  assert.deepEqual(nivelesRequeridosPara('N0'), []);
  assert.deepEqual(nivelesRequeridosPara('N1'), ['explicabilidad']);
  assert.deepEqual(nivelesRequeridosPara('N2'), ['revision_humana_asincrona', 'explicabilidad']);
  assert.deepEqual(nivelesRequeridosPara('N3'), ['fuera_del_alcance_autonomo']);
  assert.throws(() => nivelesRequeridosPara('N9'));
});
