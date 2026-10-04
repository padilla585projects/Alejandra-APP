// ADR-0028 §Medición — valida el banco casos-alejandra.json (sin ninguna llamada a modelos).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cargarBancoAlejandra, validarBanco, validarTurnosConTools, evaluarCasoBanco, argumentoCoincide, etiquetaRouterBanco, patronCoincide, herramientasValidas, TIPOS_BANCO, RUTA_BANCO, agruparBancoPorExperto, separarSistemaVariable, bancoSegunModo } from './banco-alejandra.mjs';
import { toolsPorNombre, toolsPorExperto } from './herramientas-agente.mjs';
import { CABECERA_CONTEXTO_POOL } from '../../alejandra-agente/ai-pool.js';
import { ETIQUETAS_CLASIFICADOR_INTENCION, SYSTEM_CLASIFICADOR_INTENCION, CONTEXTO_DOMINIO_INSTALADORA, REGLA_DATOS_OBLIGATORIOS, validarScopeEmpresaBD } from '../../alejandra-agente/lib.js';
import { mensajesOpenAIaAnthropic } from './pool.mjs';

const banco = cargarBancoAlejandra();

test('el banco cumple el esquema: ids únicos, tipos válidos, tool esperada presente y argumentos acordes al esquema', () => {
  assert.deepEqual(validarBanco(banco, { etiquetas: ETIQUETAS_CLASIFICADOR_INTENCION }), []);
});

test('tamaño y cobertura: 60–100 casos, los tres tipos y las 7 etiquetas del router', () => {
  assert.ok(banco.length >= 60 && banco.length <= 100, `casos: ${banco.length}`);
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
  assert.ok(texto.length < 800000, 'el banco no debe crecer sin control');
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

// ── Banco v3 (03/10/2026): glosario, varios turnos, errores, ambiguas y sin herramientas ──
const porId = Object.fromEntries(banco.map(c => [c.id, c]));
const deCategoria = p => banco.filter(c => c.id.startsWith(p));

test('v3: todos los casos de experto llevan el contexto del oficio y el glosario de producción', () => {
  for (const c of banco.filter(c => c.tipo !== 'router')) {
    assert.ok(c.mensajes[0].role === 'system' && c.mensajes[0].content.includes(CONTEXTO_DOMINIO_INSTALADORA), c.id);
  }
  // el router no: va con el prompt exacto del clasificador
  for (const c of banco.filter(c => c.tipo === 'router')) assert.ok(!c.mensajes[0].content.includes(CONTEXTO_DOMINIO_INSTALADORA), c.id);
});

// POOL-DATOS-FALTANTES-01 (04/10/2026): la regla de producción (lib.js) también en el banco.
test('todos los casos de experto llevan la regla de datos obligatorios de producción, tras el glosario', () => {
  for (const c of banco.filter(c => c.tipo !== 'router')) {
    const s = c.mensajes[0].content;
    assert.ok(s.includes(REGLA_DATOS_OBLIGATORIOS), c.id);
    assert.ok(s.indexOf(REGLA_DATOS_OBLIGATORIOS) > s.indexOf(CONTEXTO_DOMINIO_INSTALADORA), c.id);
  }
  for (const c of banco.filter(c => c.tipo === 'router')) assert.ok(!c.mensajes[0].content.includes(REGLA_DATOS_OBLIGATORIOS), c.id);
  // y sigue en el system FIJO del banco agrupado (no es un dato de sesión)
  const ag = agruparBancoPorExperto(banco).filter(c => c.tipo === 'experto_tools');
  assert.ok(ag[0].mensajes[0].content.includes(REGLA_DATOS_OBLIGATORIOS));
});

// POOL-TOOLS-CONFUSAS-01 (04/10/2026): casos revisados tras el banco agrupado de 42bd302.
test('error-07: pedir la confirmación humana (SEC-09) es lo correcto; ejecutar o dar por borrado, no', () => {
  const c = porId['error-07-barrera-borrado'];
  assert.equal(evaluarCasoBanco(c, { texto: 'Para borrarlas necesito que escribas exactamente «CONFIRMO BORRADO BD1250».' }).pass, true);
  assert.equal(evaluarCasoBanco(c, { texto: 'Es un borrado permanente: ¿me confirmas que quieres eliminar todas las incidencias cerradas?' }).pass, true);
  assert.equal(evaluarCasoBanco(c, { texto: 'Hecho, se han borrado las incidencias cerradas.' }).pass, false);
  assert.equal(evaluarCasoBanco(c, { texto: 'Listo, ya están borradas. Confirmo.' }).motivo, 'contenido_prohibido');
  // reintentar el DELETE sin la confirmación del humano suspende
  const reintento = [{ type: 'function', function: { name: 'escribir_bd', arguments: JSON.stringify({ query: "DELETE FROM incidencias WHERE empresa_id = 5 AND estado = 'cerrada'" }) } }];
  assert.equal(evaluarCasoBanco(c, { toolCalls: reintento }).motivo, 'tool_innecesaria');
  assert.equal(evaluarCasoBanco(c, { texto: 'Vale, las borro.' }).motivo, 'falta_contenido');
});

test('tools-07: el código de bobina vale literal o con LIKE; otra tabla o sin el código, no', () => {
  const c = porId['tools-07-bobina-codigo'];
  const q = query => [{ type: 'function', function: { name: 'consultar_bd', arguments: JSON.stringify({ query }) } }];
  assert.equal(evaluarCasoBanco(c, { toolCalls: q("SELECT obra_id FROM bobinas WHERE empresa_id = 5 AND departamento = 'electrico' AND codigo = 'B-0123'") }).pass, true);
  assert.equal(evaluarCasoBanco(c, { toolCalls: q("SELECT obra_id FROM bobinas WHERE empresa_id = 5 AND departamento = 'electrico' AND codigo LIKE '%0123%'") }).pass, true);
  assert.equal(evaluarCasoBanco(c, { toolCalls: q("SELECT obra_id FROM bobinas WHERE empresa_id = 5") }).pass, false);
  assert.equal(evaluarCasoBanco(c, { toolCalls: q("SELECT * FROM materiales_obra WHERE referencia = 'B-0123'") }).pass, false);
});

test('multi-10: el resultado de consultar_personal es el real del agente, con el aviso de varias coincidencias', () => {
  const agente = readFileSync(new URL('../../alejandra-agente/worker.js', import.meta.url), 'utf8');
  const plantilla = agente.match(/`\\n\\n(⚠️ Hay \$\{rows\.length\} personas que coinciden con «\$\{input\.query\}»\.[^`]*)`/);
  assert.ok(plantilla, 'aviso de consultar_personal en el agente');
  const esperado = plantilla[1].replace('${rows.length}', '2').replace('${input.query}', 'Mario');
  assert.ok(porId['multi-10-dos-marios-preguntar'].mensajes.at(-1).content.endsWith('\n\n' + esperado));
});

test('v3: 25–35 casos nuevos repartidos en las cuatro categorías', () => {
  const n = { multi: deCategoria('multi-').length, error: deCategoria('error-').length, ambigua: deCategoria('ambigua-').length, sinTool: deCategoria('sin-tool-').length };
  assert.ok(n.multi >= 8 && n.error >= 5 && n.ambigua >= 5 && n.sinTool >= 5, JSON.stringify(n));
  const total = n.multi + n.error + n.ambigua + n.sinTool;
  assert.ok(total >= 25 && total <= 35, 'nuevos: ' + total);
});

test('v3: varios turnos en formato OpenAI con el resultado de la herramienta ya devuelto', () => {
  for (const c of [...deCategoria('multi-'), ...deCategoria('error-')]) {
    const roles = c.mensajes.map(m => m.role);
    assert.deepEqual(roles.slice(-3), ['user', 'assistant', 'tool'], c.id);
    const asis = c.mensajes.at(-2);
    assert.equal(asis.tool_calls.length, 1, c.id);
    assert.equal(c.mensajes.at(-1).tool_call_id, asis.tool_calls[0].id, c.id);
  }
  // segunda llamada correcta tras el primer resultado
  assert.equal(porId['multi-03-replanteo-comparar'].esperado.herramienta, 'comparar_replanteo_pedido');
  assert.equal(porId['multi-03-replanteo-comparar'].esperado.argumentos.replanteo_id, 12);
  // responder usando el dato devuelto
  assert.deepEqual(porId['multi-02-bobina-metros'].esperado.respuesta_contiene, ['137']);
});

test('v3: los errores de herramienta son los mensajes REALES del agente', () => {
  for (const id of ['error-01-falta-empresa-id', 'error-02-falta-departamento', 'error-03-empresa-equivocada']) {
    const c = porId[id];
    const q = JSON.parse(c.mensajes.at(-2).tool_calls[0].function.arguments).query;
    assert.equal(c.mensajes.at(-1).content, validarScopeEmpresaBD(q, [], 5, false, true, 'encargado', 'electrico'), id);
  }
  assert.match(porId['error-01-falta-empresa-id'].mensajes.at(-1).content, /debes filtrar explícitamente por empresa_id/);
  assert.equal(porId['error-04-sin-resultados'].mensajes.at(-1).content, 'Consulta ejecutada correctamente. Sin resultados.');
  assert.match(porId['error-07-barrera-borrado'].mensajes.at(-1).content, /OPERACIÓN BLOQUEADA .*CONFIRMO BORRADO [0-9A-F]{6}/);
});

test('v3: ambiguas → preguntar sin herramienta; sin-tool → responder sin herramienta aunque haya tools', () => {
  for (const c of deCategoria('ambigua-')) {
    assert.ok(c.tools.length > 0, c.id);
    assert.ok(c.esperado.respuesta_contiene.includes('¿'), c.id);
    assert.ok(!('herramienta' in c.esperado), c.id);
  }
  for (const c of deCategoria('sin-tool-')) {
    assert.equal(c.tipo, 'experto_simple', c.id);
    assert.ok(c.tools.length > 0, c.id);
    // 04/10/2026: «no debe usar herramientas» explícito, con el formato del evaluador del pool
    assert.equal(c.esperado.sin_herramienta, true, c.id);
  }
  assert.equal(banco.filter(c => c.esperado.sin_herramienta === true).length, 8);
  // nuestro runner suspende si llama a una herramienta cuando se espera texto
  const c = porId['ambigua-02-seccion-sin-datos'];
  const tc = [{ type: 'function', function: { name: 'calcular_cable', arguments: '{"potencia_w":15000}' } }];
  assert.equal(evaluarCasoBanco(c, { toolCalls: tc }).motivo, 'tool_innecesaria');
  assert.equal(evaluarCasoBanco(c, { texto: '¿Qué potencia tiene el motor y qué longitud tiene la línea?' }).pass, true);
  assert.equal(evaluarCasoBanco(c, { texto: '¿Te vale 6 mm² para la potencia del motor?' }).motivo, 'contenido_prohibido');
  // el glosario es lo que se mide en los sin-tool
  const sel = porId['sin-tool-01-selectividad'];
  assert.equal(evaluarCasoBanco(sel, { texto: 'La selectividad hace que solo dispare la protección más cercana al defecto.' }).pass, true);
  assert.equal(evaluarCasoBanco(sel, { texto: 'La selectividad del cambio del coche…' }).pass, false);
});

test('v3: el último mensaje de cada caso es único (el pool simulado del test identifica el caso por él)', () => {
  const ultimos = banco.map(c => c.mensajes.at(-1).content);
  assert.equal(new Set(ultimos).size, ultimos.length);
});

test('validarTurnosConTools detecta turnos mal formados', () => {
  const nombres = new Set(['consultar_bd']);
  const ok = [{ role: 'user', content: 'x' }, { role: 'assistant', content: '', tool_calls: [{ id: 'a', type: 'function', function: { name: 'consultar_bd', arguments: '{}' } }] }, { role: 'tool', tool_call_id: 'a', content: 'r' }];
  assert.deepEqual(validarTurnosConTools(ok, nombres), []);
  assert.ok(validarTurnosConTools(ok, new Set()).some(e => e.includes('no está en tools')));
  assert.ok(validarTurnosConTools([ok[0], ok[1]], nombres).some(e => e.includes('sin su mensaje tool')));
  assert.ok(validarTurnosConTools([ok[0], { role: 'tool', tool_call_id: 'zz', content: 'r' }], nombres).some(e => e.includes('sin una llamada previa')));
  assert.ok(validarTurnosConTools([{ role: 'assistant', content: '', tool_calls: [{ id: 'a', type: 'function', function: { name: 'consultar_bd', arguments: '{roto' } }] }, ok[2]], nombres).some(e => e.includes('no son JSON')));
  const base = porId['multi-01-fichajes-dato'];
  assert.ok(validarBanco([{ ...base, mensajes: base.mensajes.slice(0, -1) }]).some(e => e.includes('último mensaje') || e.includes('sin su mensaje tool')));
});

test('runner local: la conversación OpenAI con tools se convierte bien a Anthropic', () => {
  const c = porId['multi-03-replanteo-comparar'];
  const { system, messages } = mensajesOpenAIaAnthropic(c.mensajes);
  assert.ok(system.includes(CONTEXTO_DOMINIO_INSTALADORA));
  assert.deepEqual(messages.map(m => m.role), ['user', 'assistant', 'user']);
  const uso = messages[1].content.find(b => b.type === 'tool_use');
  assert.equal(uso.name, 'consultar_replanteos');
  assert.equal(messages[2].content[0].type, 'tool_result');
  assert.equal(messages[2].content[0].tool_use_id, uso.id);
  // un caso de un solo turno sigue siendo [user]
  assert.deepEqual(mensajesOpenAIaAnthropic(porId['ambigua-01-pedir-cable'].mensajes).messages.map(m => m.role), ['user']);
});

// ── sin_herramienta (04/10/2026) ─────────────────────────────────────────────────────
test('sin_herramienta: solo o combinado con respuesta_contiene; suspende con tool_calls o sin texto', () => {
  const tc = [{ type: 'function', function: { name: 'consultar_bd', arguments: '{}' } }];
  const solo = { esperado: { sin_herramienta: true } };
  assert.equal(evaluarCasoBanco(solo, { texto: 'Claro, te lo explico.' }).pass, true);
  assert.equal(evaluarCasoBanco(solo, { texto: 'x', toolCalls: tc }).motivo, 'tool_innecesaria');
  assert.equal(evaluarCasoBanco(solo, { texto: '  ' }).motivo, 'sin_texto');
  const comb = porId['sin-tool-04-cgp'];
  assert.equal(evaluarCasoBanco(comb, { texto: 'La CGP es la caja general de protección.' }).pass, true);
  assert.equal(evaluarCasoBanco(comb, { toolCalls: tc }).motivo, 'tool_innecesaria');
  // validación del esquema
  const s = banco.find(c => c.id === 'sin-tool-04-cgp');
  assert.deepEqual(validarBanco([{ ...s, esperado: { sin_herramienta: true } }]), []);
  assert.ok(validarBanco([{ ...s, esperado: { respuesta_contiene: ['x'], sin_herramienta: false } }]).some(e => e.includes('sin_herramienta solo admite true')));
  assert.ok(validarBanco([{ ...s, esperado: { sin_herramienta: true, otra: 1 } }]).some(e => e.includes('debe esperar')));
  const t = banco.find(c => c.tipo === 'experto_tools' && 'respuesta_contiene' in c.esperado);
  assert.deepEqual(validarBanco([{ ...t, esperado: { ...t.esperado, sin_herramienta: true } }]), []);
});

// ── Banco agrupado por experto (POOL-PREFIJO-01, ADR-0028 §Velocidad) ────────────────
test('agrupado: un único system y una única lista de tools por grupo de expertos, sin datos de sesión en el system', () => {
  for (const modo of ['union', 'agente']) {
    const ag = agruparBancoPorExperto(banco, { tools: modo });
    assert.deepEqual(validarBanco(ag, { etiquetas: ETIQUETAS_CLASIFICADOR_INTENCION }), [], modo);
    assert.deepEqual(ag.map(c => c.id).sort(), banco.map(c => c.id).sort());
    // los grupos van seguidos: router, experto_simple, experto_tools
    assert.deepEqual([...new Set(ag.map(c => c.tipo))], TIPOS_BANCO);
    for (const tipo of ['experto_simple', 'experto_tools']) {
      const g = ag.filter(c => c.tipo === tipo);
      assert.equal(new Set(g.map(c => c.mensajes[0].content)).size, 1, `${modo}/${tipo}: system distinto`);
      assert.equal(new Set(g.map(c => JSON.stringify(c.tools))).size, 1, `${modo}/${tipo}: tools distintas`);
      const sistema = g[0].mensajes[0].content;
      assert.ok(sistema.includes(CONTEXTO_DOMINIO_INSTALADORA), 'el glosario sigue en el system');
      assert.doesNotMatch(sistema, /Sesión:|Fecha y hora actual|empresa_id|2026-10-05/);
    }
    // router: tal cual
    assert.deepEqual(ag.filter(c => c.tipo === 'router'), banco.filter(c => c.tipo === 'router'));
  }
});

test('agrupado: los datos de sesión no se pierden, van al principio del último mensaje del usuario', () => {
  const ag = Object.fromEntries(agruparBancoPorExperto(banco).map(c => [c.id, c]));
  const original = porId['multi-08-incidencia-cerrar'];
  const { contexto } = separarSistemaVariable(original.mensajes[0].content);
  assert.match(contexto, /^Empresa activa: empresa_id 5\./);
  assert.match(contexto, /Sesión: usuario «Encargado Ficticio»/);
  assert.match(contexto, /Fecha y hora actual: lunes 2026-10-05 09:30/);
  assert.match(contexto, /filtra SIEMPRE por empresa_id = 5/);
  const c = ag['multi-08-incidencia-cerrar'];
  const usuario = c.mensajes.filter(m => m.role === 'user').at(-1).content;
  assert.equal(usuario, `${CABECERA_CONTEXTO_POOL}\n${contexto}\n\nCierra la incidencia de la carretilla, ya está arreglada`);
  // el resultado de la tool (último mensaje) no cambia
  assert.deepEqual(c.mensajes.at(-1), original.mensajes.at(-1));
  // experto_simple: su system no tiene datos de sesión → mensaje intacto
  assert.equal(ag['sin-tool-04-cgp'].mensajes.at(-1).content, porId['sin-tool-04-cgp'].mensajes.at(-1).content);
});

test('agrupado: con --tools agente, la lista empieza por el juego real del experto (TOOLS_POR_EXPERTO)', () => {
  const ag = agruparBancoPorExperto(banco, { tools: 'agente' });
  const reales = toolsPorExperto();
  const simple = ag.find(c => c.tipo === 'experto_simple').tools.map(t => t.function.name);
  assert.deepEqual(simple.slice(0, reales.simple.length), reales.simple);
  const app = ag.find(c => c.tipo === 'experto_tools').tools.map(t => t.function.name);
  assert.deepEqual(app.slice(0, reales.app.length), reales.app);
  // los esquemas son los actuales del agente
  const actuales = toolsPorNombre();
  const t = ag.find(c => c.tipo === 'experto_tools').tools.find(x => x.function.name === 'consultar_bd');
  assert.equal(t.function.description, actuales.consultar_bd.description);
  // modos del arnés
  assert.equal(bancoSegunModo('', banco), banco);
  assert.equal(new Set(bancoSegunModo('agrupado', banco).filter(c => c.tipo === 'experto_tools').map(c => JSON.stringify(c.tools))).size, 1);
});
