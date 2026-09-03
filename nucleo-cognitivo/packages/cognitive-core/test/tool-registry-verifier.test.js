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

test('Verifier: revisión humana asíncrona construye una solicitud validada y NUNCA aprobada (ADR-0023)', () => {
  const base = {
    tool: 'enviar_gmail',
    input: { para: 'a@b.c', asunto: 'Hola', cuerpo: 'x' },
    resumen: 'Enviar correo a a@b.c — "Hola"',
    codigo: 'AB12CD',
    caducaAt: '2026-09-04 10:00:00',
    solicitanteId: 3,
  };
  const r = solicitarRevisionHumanaAsincrona(base);
  assert.equal(r.nivel, 'revision_humana_asincrona');
  assert.equal(r.aprobado, false, 'una solicitud recién creada nunca está aprobada');
  assert.equal(r.solicitud.worker, 'agente', 'worker por defecto: agente');
  assert.equal(r.solicitud.solicitanteId, '3', 'solicitante normalizado a string');
  assert.deepEqual(r.solicitud.input, base.input, 'input exacto, copiado');
  assert.notEqual(r.solicitud.input, base.input, 'copia, no la misma referencia');
  assert.ok(Object.isFrozen(r.solicitud), 'la solicitud es inmutable');
  // El resultado no ofrece ninguna vía para "aprobar": ni campo ni método.
  assert.equal(typeof r.aprobar, 'undefined');
  assert.equal(typeof r.solicitud.aprobar, 'undefined');
});

test('Verifier: revisión humana asíncrona rechaza solicitudes incompletas o mal formadas (ADR-0023)', () => {
  const base = {
    tool: 'enviar_gmail', input: { para: 'a@b.c' }, resumen: 'r', codigo: 'AB12CD',
    caducaAt: '2026-09-04 10:00:00', solicitanteId: 3,
  };
  assert.throws(() => solicitarRevisionHumanaAsincrona(), /ADR-0023/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, tool: '' }), /sin tool/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, input: null }), /sin input/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, input: [1] }), /sin input/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, resumen: '  ' }), /sin resumen/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, codigo: 'ab12cd' }), /código inválido/, 'minúsculas no valen: el Set de chat normaliza a mayúsculas');
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, codigo: 'AB12C' }), /código inválido/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, caducaAt: '2026-09-04T10:00:00Z' }), /caducidad/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, solicitanteId: null }), /sin solicitante/);
  assert.throws(() => solicitarRevisionHumanaAsincrona({ ...base, worker: 'otro' }), /worker desconocido/);
});

test('Verifier: explicabilidad valida razonamiento real, no solo campos presentes (ADR-0020 rebanada 3)', () => {
  assert.equal(registrarExplicabilidad().aprobado, false);
  assert.equal(registrarExplicabilidad({}).aprobado, false);
  assert.equal(registrarExplicabilidad({ motivos: [], evidencia: { x: 1 } }).aprobado, false, 'motivos vacío no basta');
  assert.equal(registrarExplicabilidad({ motivos: ['  '], evidencia: { x: 1 } }).aprobado, false, 'motivo en blanco no cuenta');
  assert.equal(registrarExplicabilidad({ motivos: ['ok'], evidencia: {} }).aprobado, false, 'evidencia vacía no basta');
  assert.equal(registrarExplicabilidad({ motivos: ['ok'], evidencia: { x: 1 } }).aprobado, true);
});

test('Verifier: nivelesRequeridosPara sigue la tabla de ADR-0009/0006', () => {
  assert.deepEqual(nivelesRequeridosPara('N0'), []);
  assert.deepEqual(nivelesRequeridosPara('N1'), ['explicabilidad']);
  assert.deepEqual(nivelesRequeridosPara('N2'), ['revision_humana_asincrona', 'explicabilidad']);
  assert.deepEqual(nivelesRequeridosPara('N3'), ['fuera_del_alcance_autonomo']);
  assert.throws(() => nivelesRequeridosPara('N9'));
});

// F-1.3-TOOL-PILOTO-MIGRADA: copia literal de la declaración real de
// TOOL_CONSULTAR_PERSONAL en alejandra-agente/worker.js (piloto de migración,
// 2026-08-02). No se importa desde alejandra-agente/ a propósito —
// nucleo-cognitivo/ se mantiene aislado, sin dependencias cruzadas con ningún
// Worker. Si este test falla, es porque la declaración real cambió y esta
// copia quedó desactualizada: hay que sincronizarla a mano.
test('Tool Registry: la declaración real de consultar_personal (piloto ADR-0010) valida', () => {
  const toolConsultarPersonal = {
    name: 'consultar_personal',
    description: 'Busca personal por nombre, departamento o puesto. Devuelve nombre, rol, contacto y departamento.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Nombre, DNI o palabra clave a buscar' },
        departamento: { type: 'string', description: 'Filtrar por departamento (opcional, ej: "electrico", "prl")' },
        activos_solo: { type: 'boolean', description: 'Solo mostrar personal activo (default true)' },
        limit: { type: 'number', description: 'Máximo de resultados (default 10, max 50)' },
      },
      required: ['query'],
    },
    acceso: 'sesion',
    cron: 'permitido',
    nivel_riesgo: 'N0',
  };
  assert.equal(validarDeclaracionTool(toolConsultarPersonal), true);
});
