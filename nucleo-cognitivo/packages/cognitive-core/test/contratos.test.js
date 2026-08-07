import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crearEstadoCognitivo, actualizarEstadoCognitivo } from '../src/estado-cognitivo.js';
import { construirContexto } from '../src/context-engine.js';
import { construirPlan } from '../src/planner.js';
import { decidir, decidirInvocacionPilotoN0, decidirInvocacionN1, decidirInvocacionN2N3, tieneTrazaSuficiente, CAMPOS_TRAZA_OBLIGATORIOS } from '../src/motor-decision.js';

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
    tool: { name: 'consultar_personal', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N0' },
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

// ARC-020, rebanada 2 (2026-08-07): el piloto gobierna TODO el catálogo N0 real del
// Worker, no solo consultar_personal. LISTA_N0 refleja las tools declaradas con
// `nivel_riesgo: 'N0'` en alejandra-agente/worker.js (escaneo _n0_scan.cjs).
// Copia literal, no importada desde alejandra-agente/ — nucleo-cognitivo/ se
// mantiene aislado. Si falla, la declaración real cambió y hay que sincronizar.
const LISTA_N0_CATALOGO = Object.freeze([
  'buscar_web', 'memory_read', 'listar_archivos', 'ver_archivo', 'leer_estado',
  'consultar_bd', 'calcular_cable', 'calcular_bandeja', 'calcular_proteccion',
  'analizar_foto_obra', 'listar_esquemas', 'estado_obra', 'pensar', 'planificar',
  'descubrir_herramientas', 'recuperar_conversacion', 'validar_cambios_bd',
  'github_listar', 'github_leer', 'github_buscar', 'grep_codigo', 'ram_read',
  'consultar_conocimiento', 'buscar_documentos', 'buscar_tareas',
  'memoria_consultar', 'memoria_listar_pendientes', 'consultar_inventario',
  'consultar_personal', 'buscar_precios', 'marcar_plano', 'buscar_normativa',
  'buscar_procedimientos', 'consultar_punch_list', 'buscar_proveedores',
  'consultar_precios',
]);

test('Motor de Decisión: acepta y traza toda tool N0 del catálogo real (ARC-020 rebanada 2)', () => {
  for (const nombre of LISTA_N0_CATALOGO) {
    const resultado = decidirInvocacionPilotoN0({
      tool: { name: nombre, description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N0' },
      toolOfrecida: true,
      authOk: true,
      modo: 'app',
    });
    assert.equal(resultado.aplicaPiloto, true, `${nombre} debe entrar al piloto`);
    assert.equal(resultado.permitida, true, `${nombre} debe ser permitida`);
    assert.equal(resultado.decision.decision, 'invocar_tool', `${nombre} debe decidir invocar_tool`);
    assert.equal(tieneTrazaSuficiente(resultado.decision), true, `${nombre} debe dejar traza suficiente`);
  }
});

test('Motor de Decisión: rechaza una tool N0 no ofrecida en el catálogo efectivo (ARC-2)', () => {
  const resultado = decidirInvocacionPilotoN0({
    tool: { name: 'consultar_bd', nivel_riesgo: 'N0' },
    toolOfrecida: false,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'tool_no_ofrecida');
});

// ADR-0020, rebanada 3 (2026-08-07, enmienda 2): piloto de tools N1. Nació
// acotado a lectura (`verificar_deploy` era la única N1 confirmada de solo
// lectura); la rebanada 7 (enmienda 6, más abajo) lo amplía a escritura —
// decidirInvocacionN1() ya no distingue, gobierna cualquier N1 ofrecida con
// sesión + metadato + explicabilidad, igual para lectura o escritura.

test('Motor de Decisión: rebanada 3 rechaza una tool N1 no ofrecida', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'verificar_deploy', nivel_riesgo: 'N1' },
    toolOfrecida: false,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'tool_no_ofrecida');
});

test('Motor de Decisión: rebanada 3 deja fuera tools que no son N1 (riesgo distinto)', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'consultar_bd', nivel_riesgo: 'N0' },
    toolOfrecida: true,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, false);
  assert.equal(resultado.permitida, true);
  assert.equal(resultado.decision.criterio_salida, 'fuera_piloto_n1');
});

test('Motor de Decisión: rebanada 3 rechaza N1 de lectura sin sesión autenticada', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'verificar_deploy', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' },
    toolOfrecida: true,
    authOk: false,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'sin_sesion');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

test('Motor de Decisión: rebanada 3 permite y deja traza con explicabilidad para N1 de lectura ofrecida con sesión', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'verificar_deploy', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' },
    toolOfrecida: true,
    authOk: true,
    modo: 'app',
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, true);
  assert.equal(resultado.decision.decision, 'invocar_tool');
  assert.equal(resultado.decision.criterio_salida, 'tool_n1_ofrecida');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

// ADR-0020, rebanada 4 (2026-08-07, enmienda 3): política determinista —
// metadato ausente/inválido bloquea, no se asume disponible. Solo se evalúa
// para tools que ya son candidatas del piloto (N0 o N1 lectura); una tool
// fuera de alcance sigue "posponer" sin que su metadato importe (ver el test
// de arriba con gestionar_tarea, que no declara acceso/cron a propósito).

test('Motor de Decisión: rebanada 4 rechaza una tool N0 ofrecida con metadato incompleto', () => {
  const resultado = decidirInvocacionPilotoN0({
    tool: { name: 'consultar_personal', nivel_riesgo: 'N0' }, // sin acceso/cron/description
    toolOfrecida: true,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'metadato_invalido');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

test('Motor de Decisión: rebanada 4 rechaza una tool N0 con "acceso" fuera de la lista de ADR-0010', () => {
  const resultado = decidirInvocacionPilotoN0({
    tool: { name: 'consultar_personal', description: 'x', acceso: 'inventado', cron: 'permitido', nivel_riesgo: 'N0' },
    toolOfrecida: true,
    authOk: true,
  });
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'metadato_invalido');
});

test('Motor de Decisión: rebanada 4 rechaza una tool N1 de lectura ofrecida con metadato incompleto', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'verificar_deploy', nivel_riesgo: 'N1' }, // sin acceso/cron/description
    toolOfrecida: true,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'metadato_invalido');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

// ADR-0020, rebanada 6 (2026-08-07, enmienda 5): refuerzo N2/N3. NUNCA
// permite nada de forma autónoma para N2/N3 (permitida siempre true en el
// caso "en alcance", que es "posponer y dejar traza", nunca "invocar_tool")
// — la barrera humana real (CONFIRMO BORRADO/CONFIRMO MIGRACION) sigue
// viviendo en cada tool sin tocarse. Objetivo único: dejar traza donde hoy
// no hay ninguna.

test('Motor de Decisión: refuerzo N2/N3 rechaza una tool no ofrecida', () => {
  const resultado = decidirInvocacionN2N3({
    tool: { name: 'escribir_bd', description: 'x', acceso: 'sesion', cron: 'prohibido', nivel_riesgo: 'N2' },
    toolOfrecida: false,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'tool_no_ofrecida');
});

test('Motor de Decisión: refuerzo N2/N3 deja fuera tools que no son N2 ni N3', () => {
  const resultado = decidirInvocacionN2N3({
    tool: { name: 'verificar_deploy', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' },
    toolOfrecida: true,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, false);
  assert.equal(resultado.permitida, true);
  assert.equal(resultado.decision.criterio_salida, 'fuera_alcance_n2_n3');
});

test('Motor de Decisión: refuerzo N2/N3 rechaza metadato inválido (política determinista)', () => {
  const resultado = decidirInvocacionN2N3({
    tool: { name: 'escribir_bd', nivel_riesgo: 'N2' }, // sin acceso/cron/description
    toolOfrecida: true,
    authOk: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'metadato_invalido');
});

test('Motor de Decisión: refuerzo N2 nunca permite invocar_tool — siempre posponer con traza, nunca autoriza', () => {
  const resultado = decidirInvocacionN2N3({
    tool: { name: 'escribir_bd', description: 'x', acceso: 'sesion', cron: 'prohibido', nivel_riesgo: 'N2' },
    toolOfrecida: true,
    authOk: true,
    modo: 'gestion',
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, true, 'no bloquea CONFIRMO BORRADO, que sigue viviendo en la tool');
  assert.equal(resultado.decision.decision, 'posponer');
  assert.notEqual(resultado.decision.decision, 'invocar_tool', 'el Motor NUNCA autoriza N2 por su cuenta');
  assert.equal(resultado.decision.criterio_salida, 'n2_revision_humana_no_implementada');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

test('Motor de Decisión: refuerzo N3 nunca permite invocar_tool — siempre posponer con traza, nunca autoriza', () => {
  const resultado = decidirInvocacionN2N3({
    tool: { name: 'run_migration', description: 'x', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N3' },
    toolOfrecida: true,
    authOk: true,
    esDevVerificado: true,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, true, 'no bloquea el flujo existente de la tool');
  assert.equal(resultado.decision.decision, 'posponer');
  assert.notEqual(resultado.decision.decision, 'invocar_tool', 'el Motor NUNCA autoriza N3 — mandato explícito de ADR-0006');
  assert.equal(resultado.decision.criterio_salida, 'n3_fuera_alcance_autonomo');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

// ADR-0020, rebanada 7 (2026-08-07, enmienda 6): decidirInvocacionN1() se
// amplía a ESCRITURA. ADR-0009 exige el mismo nivel `explicabilidad` para
// todo N1, sin distinguir lectura/escritura — la restricción anterior era
// cautela de pilotaje, no un límite real de riesgo (N1 = "reversible,
// acotado" por definición de ADR-0006). Cada `case` conserva sus propias
// comprobaciones de tenant/IDOR; el Motor solo añade trazabilidad encima.

test('Motor de Decisión: rebanada 7 permite y traza una tool N1 de ESCRITURA (gestionar_tarea/crear)', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'gestionar_tarea', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' },
    toolOfrecida: true,
    authOk: true,
    modo: 'app',
    esLectura: false,
  });
  assert.equal(resultado.aplicaPiloto, true);
  assert.equal(resultado.permitida, true);
  assert.equal(resultado.decision.decision, 'invocar_tool');
  assert.equal(resultado.decision.criterio_salida, 'tool_n1_ofrecida');
  assert.equal(resultado.decision.evidencia.es_lectura, false, 'la traza distingue lectura/escritura aunque no la use para decidir');
  assert.equal(tieneTrazaSuficiente(resultado.decision), true);
});

test('Motor de Decisión: rebanada 7 rechaza N1 de escritura sin sesión, igual que lectura', () => {
  const resultado = decidirInvocacionN1({
    tool: { name: 'gestionar_tarea', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' },
    toolOfrecida: true,
    authOk: false,
    esLectura: false,
  });
  assert.equal(resultado.permitida, false);
  assert.equal(resultado.decision.criterio_salida, 'sin_sesion');
});

test('Motor de Decisión: rebanada 7 — esLectura es informativo, no cambia el resultado (mismo authOk, misma tool, distinto esLectura)', () => {
  const base = { tool: { name: 'gestionar_tarea', description: 'x', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' }, toolOfrecida: true, authOk: true };
  const comoLectura = decidirInvocacionN1({ ...base, esLectura: true });
  const comoEscritura = decidirInvocacionN1({ ...base, esLectura: false });
  const sinClasificar = decidirInvocacionN1({ ...base });
  assert.equal(comoLectura.permitida, true);
  assert.equal(comoEscritura.permitida, true);
  assert.equal(sinClasificar.permitida, true);
  assert.equal(comoLectura.decision.evidencia.es_lectura, true);
  assert.equal(comoEscritura.decision.evidencia.es_lectura, false);
  assert.equal('es_lectura' in sinClasificar.decision.evidencia, false, 'sin esLectura explícito, no se inventa un valor');
});