// ADR-0028 §Medición — valida el banco casos-alejandra.json (sin ninguna llamada a modelos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarBancoAlejandra, validarBanco, evaluarCasoBanco, argumentoCoincide, TIPOS_BANCO, RUTA_BANCO } from './banco-alejandra.mjs';
import { toolsPorNombre } from './herramientas-agente.mjs';
import { ETIQUETAS_CLASIFICADOR_INTENCION, SYSTEM_CLASIFICADOR_INTENCION } from '../../alejandra-agente/lib.js';

const banco = cargarBancoAlejandra();

test('el banco cumple el esquema: ids únicos, tipos válidos, tool esperada presente y argumentos acordes al esquema', () => {
  assert.deepEqual(validarBanco(banco, { etiquetas: ETIQUETAS_CLASIFICADOR_INTENCION }), []);
});

test('tamaño y cobertura: 30–60 casos, los tres tipos y las 7 etiquetas del router', () => {
  assert.ok(banco.length >= 30 && banco.length <= 60, `casos: ${banco.length}`);
  for (const t of TIPOS_BANCO) assert.ok(banco.some(c => c.tipo === t), 'falta el tipo ' + t);
  const etiquetas = new Set(banco.filter(c => c.tipo === 'router').map(c => c.esperado.etiqueta));
  assert.deepEqual([...etiquetas].sort(), [...ETIQUETAS_CLASIFICADOR_INTENCION].sort());
  const herramientas = new Set(banco.filter(c => c.tipo === 'experto_tools').map(c => c.esperado.herramienta));
  for (const h of ['consultar_bd', 'consultar_replanteos', 'memory_save', 'memory_read', 'generar_plano', 'buscar_web', 'delegar_tarea', 'estado_obra']) {
    assert.ok(herramientas.has(h), 'sin casos de ' + h);
  }
});

test('los casos de router usan el prompt REAL del clasificador de producción', () => {
  for (const c of banco.filter(c => c.tipo === 'router')) assert.ok(c.mensajes[0].content.startsWith(SYSTEM_CLASIFICADOR_INTENCION), c.id);
});

test('las tools del banco siguen existiendo en el agente con los mismos campos obligatorios', () => {
  // Si falla tras cambiar una tool: `node scripts/ai-benchmark/herramientas-agente.mjs --refrescar`
  const actuales = toolsPorNombre();
  for (const c of banco) for (const t of c.tools) {
    const real = actuales[t.function.name];
    assert.ok(real, `${c.id}: la tool ${t.function.name} ya no existe en alejandra-agente/worker.js`);
    assert.deepEqual([...(t.function.parameters.required || [])].sort(), [...(real.input_schema.required || [])].sort(), `${c.id}: required de ${t.function.name} desactualizado`);
  }
});

test('solo las tools relevantes en cada caso, nunca el catálogo entero', () => {
  for (const c of banco) assert.ok(c.tools.length <= 8, `${c.id}: ${c.tools.length} tools`);
});

test('anonimizado: sin emails, teléfonos ni DNI; solo la empresa demo', () => {
  const texto = readFileSync(RUTA_BANCO, 'utf8');
  // Solo el contenido de los casos (mensajes y esperado): las descripciones de las tools son del código.
  const propio = JSON.stringify(banco.map(c => ({ m: c.mensajes, e: c.esperado })));
  assert.doesNotMatch(propio, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/, 'email');
  assert.doesNotMatch(propio, /(?<!\d)[6789]\d{2}[ .]?\d{3}[ .]?\d{3}(?!\d)/, 'teléfono');
  assert.doesNotMatch(propio, /\b\d{8}[A-HJ-NP-TV-Z]\b|\b[XYZ]\d{7}[A-Z]\b/, 'DNI/NIE');
  assert.match(propio, /Constructora Demo S\.L\./);
  assert.match(propio, /empresa_id 5/);
  assert.ok(texto.length < 400000, 'el banco no debe crecer sin control');
});

test('evaluador: aciertos y fallos de cada tipo', () => {
  const router = { esperado: { etiqueta: 'app' } };
  assert.equal(evaluarCasoBanco(router, { etiqueta: 'app' }).pass, true);
  assert.equal(evaluarCasoBanco(router, { etiqueta: 'web' }).motivo, 'etiqueta_distinta');
  const simple = { esperado: { respuesta_contiene: ['diferencial', 'magnetot'] } };
  assert.equal(evaluarCasoBanco(simple, { texto: 'El Magnetotérmico protege… el diferencial también.' }).pass, true);
  assert.equal(evaluarCasoBanco(simple, { texto: 'El diferencial.' }).motivo, 'falta_contenido');
  assert.equal(evaluarCasoBanco(simple, { texto: 'x', toolCalls: [{ name: 'consultar_bd' }] }).motivo, 'tool_innecesaria');
  assert.equal(evaluarCasoBanco(simple, { texto: '<|tool_call|> diferencial magnetot' }).motivo, 'fuga_sintaxis_tool');
  const tools = { esperado: { herramienta: 'consultar_bd', argumentos: { query: ['fichajes', 'empresa_id'] } } };
  const tc = (name, args) => [{ type: 'function', function: { name, arguments: JSON.stringify(args) } }];
  assert.equal(evaluarCasoBanco(tools, { toolCalls: tc('consultar_bd', { query: 'SELECT * FROM fichajes WHERE empresa_id = 5' }) }).pass, true);
  assert.equal(evaluarCasoBanco(tools, { toolCalls: tc('consultar_bd', { query: 'SELECT * FROM fichajes' }) }).motivo, 'argumento_query');
  assert.equal(evaluarCasoBanco(tools, { toolCalls: tc('consultar_personal', { query: 'x' }) }).motivo, 'tool_distinta');
  assert.equal(evaluarCasoBanco(tools, { texto: 'Han fichado 12 personas.' }).motivo, 'sin_tool');
  assert.equal(evaluarCasoBanco(tools, { toolCalls: [{ function: { name: 'consultar_bd', arguments: '{roto' } }] }).motivo, 'argumentos_json_invalido');
  // Formato Anthropic (name + input objeto) también vale
  assert.equal(evaluarCasoBanco(tools, { toolCalls: [{ name: 'consultar_bd', arguments: { query: 'select 1 from FICHAJES where empresa_id=5' } }] }).pass, true);
});

test('evaluador: comparación de argumentos', () => {
  assert.equal(argumentoCoincide(14, '14'), true);
  assert.equal(argumentoCoincide(14, 15), false);
  assert.equal(argumentoCoincide('bandejas', 'bandejas'), true);
  assert.equal(argumentoCoincide('tension', 'caída de TENSIÓN'), true);
  assert.equal(argumentoCoincide('cierre|horario', 'horario de la nave'), true);
  assert.equal(argumentoCoincide(['viernes', '15'], 'Viernes cierre a las 15:00'), true);
  assert.equal(argumentoCoincide(['viernes', '15'], 'viernes'), false);
  assert.equal(argumentoCoincide('x', undefined), false);
});

test('validarBanco detecta errores típicos', () => {
  const base = banco.find(c => c.tipo === 'experto_tools');
  const dup = [base, base];
  assert.ok(validarBanco(dup).some(e => e.includes('id duplicado')));
  const sinTool = [{ ...base, tools: base.tools.filter(t => t.function.name !== base.esperado.herramienta) }];
  assert.ok(validarBanco(sinTool).some(e => e.includes('no está en tools')));
  const argMalo = [{ ...base, esperado: { ...base.esperado, argumentos: { no_existe: 1 } } }];
  assert.ok(validarBanco(argMalo).some(e => e.includes('no existe en el esquema')));
  const tipoMalo = [{ ...base, tipo: 'otro' }];
  assert.ok(validarBanco(tipoMalo).some(e => e.includes('tipo inválido')));
  const r = banco.find(c => c.tipo === 'router');
  assert.ok(validarBanco([{ ...r, esperado: { etiqueta: 'inventada' } }], { etiquetas: ETIQUETAS_CLASIFICADOR_INTENCION }).some(e => e.includes('etiqueta desconocida')));
});
