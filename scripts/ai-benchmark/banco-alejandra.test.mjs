// ADR-0028 §Medición — valida el banco casos-alejandra.json (sin ninguna llamada a modelos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarBancoAlejandra, validarBanco, evaluarCasoBanco, argumentoCoincide, etiquetaRouterBanco, patronCoincide, herramientasValidas, TIPOS_BANCO, RUTA_BANCO } from './banco-alejandra.mjs';
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
  const herramientas = new Set(banco.filter(c => c.tipo === 'experto_tools').flatMap(c => herramientasValidas(c.esperado)));
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
  assert.equal(evaluarCasoBanco(router, { etiqueta: 'APP' }).pass, true);
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

test('evaluador: comparación de argumentos (mismas reglas que bench_alejandra.py del pool)', () => {
  // otro tipo = igualdad estricta (un 14 no es el texto "14")
  assert.equal(argumentoCoincide(14, 14), true);
  assert.equal(argumentoCoincide(14, '14'), false);
  assert.equal(argumentoCoincide(14, 15), false);
  assert.equal(argumentoCoincide(true, true), true);
  // texto = subcadena, sin mayúsculas ni tildes; en argumentos «|» NO es alternativa
  assert.equal(argumentoCoincide('bandejas', 'bandejas'), true);
  assert.equal(argumentoCoincide('tension', 'caída de TENSIÓN'), true);
  assert.equal(argumentoCoincide('caída de tensión', 'CAIDA DE TENSION en el tramo'), true);
  assert.equal(argumentoCoincide('cierre|horario', 'horario de la nave'), false);
  // lista = deben aparecer todos los fragmentos
  assert.equal(argumentoCoincide(['viernes', '15'], 'Viernes cierre a las 15:00'), true);
  assert.equal(argumentoCoincide(['viernes', '15'], 'viernes'), false);
  assert.equal(argumentoCoincide(['partes_trabajo', 'empresa_id'], 'SELECT * FROM partes_trabajo WHERE obra_id = 14'), false);
  assert.equal(argumentoCoincide('x', undefined), false);
});

test('evaluador: varios primeros pasos válidos con argumentos por herramienta', () => {
  const caso = { esperado: { herramienta: ['memory_read', 'memory_update'], argumentos: { memory_update: { slug: 'horario-nave' } } } };
  const tc = (name, args) => [{ type: 'function', function: { name, arguments: JSON.stringify(args) } }];
  assert.equal(evaluarCasoBanco(caso, { toolCalls: tc('memory_read', { query: 'lo que sea' }) }).pass, true); // sin entrada: no exige nada
  assert.equal(evaluarCasoBanco(caso, { toolCalls: tc('memory_update', { slug: 'Horario-Nave', contenido: 'x' }) }).pass, true);
  assert.equal(evaluarCasoBanco(caso, { toolCalls: tc('memory_update', { slug: 'otra-nota' }) }).motivo, 'argumento_slug');
  assert.equal(evaluarCasoBanco(caso, { toolCalls: tc('memory_save', { contenido: 'x' }) }).motivo, 'tool_distinta');
  // solo cuenta la PRIMERA llamada
  assert.equal(evaluarCasoBanco(caso, { toolCalls: [...tc('memory_save', {}), ...tc('memory_read', {})] }).motivo, 'tool_distinta');
  // lista de herramientas con argumentos planos: se aplican a la elegida (como el pool)
  const plano = { esperado: { herramienta: ['generar_plano', 'estado_obra'], argumentos: { tipo: 'gantt' } } };
  assert.equal(evaluarCasoBanco(plano, { toolCalls: tc('generar_plano', { tipo: 'gantt' }) }).pass, true);
  assert.equal(evaluarCasoBanco(plano, { toolCalls: tc('generar_plano', { tipo: 'bandejas' }) }).motivo, 'argumento_tipo');
});

test('evaluador: respuesta_contiene / respuesta_no_contiene son regex sin mayúsculas ni tildes', () => {
  const caso = { esperado: { respuesta_contiene: ['diferencial', 'fuga|corriente residual|30 ?ma'], respuesta_no_contiene: ['rueda', 'temperatura'] } };
  assert.equal(evaluarCasoBanco(caso, { texto: 'El DIFERENCIAL corta si detecta una corriente residual (fuga) de 30 mA.' }).pass, true);
  assert.equal(evaluarCasoBanco(caso, { texto: 'El diferencial salta con 30mA.' }).pass, true);
  assert.equal(evaluarCasoBanco(caso, { texto: 'El diferencial protege la instalación.' }).motivo, 'falta_contenido');
  assert.equal(evaluarCasoBanco(caso, { texto: 'El diferencial detecta fugas y la temperatura.' }).motivo, 'contenido_prohibido');
  assert.equal(evaluarCasoBanco(caso, { texto: 'El diferencial y las ruedas: fuga.' }).motivo, 'contenido_prohibido');
  assert.equal(patronCoincide('caída de tensión', 'la CAIDA DE TENSION máxima'), true);
  assert.equal(patronCoincide('caida de tension', 'la caída de tensión máxima'), true);
  assert.equal(patronCoincide('magnetot', 'Magnetotérmico'), true);
});

test('evaluador: etiqueta del router como el pool ({"experto"} o la primera palabra)', () => {
  assert.equal(etiquetaRouterBanco('{"experto":"tecnico"}'), 'tecnico');
  assert.equal(etiquetaRouterBanco('{"experto": "Reflexion"}'), 'reflexion');
  assert.equal(etiquetaRouterBanco('completo, porque pregunta por ti'), 'completo');
  assert.equal(etiquetaRouterBanco('  App.'), 'app');
  assert.equal(etiquetaRouterBanco(''), '');
});

test('el banco usa las formas exigentes: pasos alternativos, regex técnicas y lo que no debe decir', () => {
  const porId = Object.fromEntries(banco.map(c => [c.id, c]));
  assert.deepEqual(porId['tools-20-replanteo-pedido'].esperado.herramienta, ['generar_pedido_replanteo', 'consultar_replanteos']);
  assert.deepEqual(porId['tools-23-memoria-actualizar'].esperado.herramienta, ['memory_update', 'memory_read']);
  assert.equal(porId['tools-23-memoria-actualizar'].esperado.argumentos.memory_update.slug, 'horario-nave');
  // tools-25: Gantt = generar_plano tipo gantt (o recuperar antes las fases con estado_obra), nunca gestionar_tarea
  const t25 = porId['tools-25-plano-gantt'].esperado;
  assert.deepEqual(t25.herramienta, ['generar_plano', 'estado_obra']);
  assert.equal(t25.argumentos.generar_plano.tipo, 'gantt');
  assert.ok(!t25.herramienta.includes('gestionar_tarea'));
  // tools-24: con la política de pedir datos críticos, el mensaje ya trae tipo/ancho de bandeja y referencia de altura
  const t24 = porId['tools-24-plano-bandejas'];
  assert.match(t24.mensajes.at(-1).content, /300x60/);
  assert.match(t24.mensajes.at(-1).content, /suelo terminado/);
  assert.equal(t24.esperado.herramienta, 'generar_plano');
  // técnicos: términos concretos y lo que NO debe aparecer
  const dif = porId['simple-03-diferencial'].esperado;
  assert.ok(dif.respuesta_contiene.some(p => /fuga/.test(p) && /corriente residual/.test(p) && /30 \?ma/.test(p)));
  assert.ok(dif.respuesta_no_contiene.includes('rueda') && dif.respuesta_no_contiene.includes('temperatura'));
  const mag = porId['simple-04-magneto-vs-diferencial'].esperado;
  assert.ok(mag.respuesta_contiene.some(p => /sobrecarga/.test(p) && /cortocircuito/.test(p)));
  assert.ok(mag.respuesta_no_contiene.includes('rueda'));
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
  const s = banco.find(c => c.tipo === 'experto_simple');
  assert.ok(validarBanco([{ ...s, esperado: { respuesta_contiene: ['(sin cerrar'] } }]).some(e => e.includes('expresión regular inválida')));
  assert.ok(validarBanco([{ ...s, esperado: { respuesta_contiene: ['x'], respuesta_no_contiene: [] } }]).some(e => e.includes('respuesta_no_contiene')));
  assert.ok(validarBanco([{ ...s, esperado: { respuesta_contiene: ['x'], otra: 1 } }]).some(e => e.includes('experto_simple debe esperar')));
  const multi = banco.find(c => c.id === 'tools-23-memoria-actualizar');
  assert.deepEqual(validarBanco([multi]), []);
  assert.ok(validarBanco([{ ...multi, esperado: { ...multi.esperado, argumentos: { slug: 'horario-nave' } } }]).some(e => e.includes('se indexa por herramienta')));
  assert.ok(validarBanco([{ ...multi, esperado: { ...multi.esperado, herramienta: ['memory_update', 'no_existe'] } }]).some(e => e.includes('no está en tools: no_existe')));
  assert.ok(validarBanco([{ ...multi, esperado: { ...multi.esperado, argumentos: { memory_update: { no_existe: 'x' } } } }]).some(e => e.includes('no existe en el esquema de memory_update')));
  assert.ok(validarBanco([{ ...multi, esperado: { ...multi.esperado, herramienta: ['memory_update'] } }]).some(e => e.includes('experto_tools debe esperar')));
});
