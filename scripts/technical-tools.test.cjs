const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { SaxesParser } = require('saxes');
let warningPolicy;

// Exercise the production functions without loading unrelated Worker bindings or UI.
function load(file, name, globals = {}) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`));
  assert.ok(match, `Missing production function ${name}`);
  return vm.runInNewContext(`${match[0]}; ${name}`, { SaxesParser, TextEncoder,
    _validarAvisosPlano: warningPolicy, ...globals });
}

warningPolicy = load('worker.js', '_validarAvisosPlano');

const calculatorSource = readFileSync(resolve(__dirname, '..', 'alejandra-agente/worker.js'), 'utf8');
const calculatorContext = vm.createContext({});
vm.runInContext(calculatorSource.slice(calculatorSource.indexOf('const AMPACIDAD_CU_XLPE ='),
  calculatorSource.indexOf('function calcularCable(')), calculatorContext);
const calculatorGlobals = vm.runInContext('({ AMPACIDAD_CU_XLPE, AMPACIDAD_CU_XLPE_ENTERRADO, FACTOR_TEMP_AIRE_XLPE, FACTOR_TEMP_TERRENO_XLPE, _interpolarFactorTemp, _factorAgrupamiento })', calculatorContext);
const calculate = load('alejandra-agente/worker.js', 'calcularProteccion', calculatorGlobals);
const cable = input => JSON.parse(load('alejandra-agente/worker.js', 'calcularCable', calculatorGlobals)(input));
const tray = input => JSON.parse(load('alejandra-agente/worker.js', 'calcularBandeja')(input));

test('cable rejects invalid physical inputs and values outside correction tables', () => {
  const valid = { potencia_w: 1000, tension_v: 230, longitud_m: 10 };
  for (const bad of [null, { potencia_w: 0 }, { tension_v: Infinity }, { longitud_m: -1 },
    { cos_phi: 0 }, { cos_phi: 1.1 }, { max_caida_pct: 0 }, { tipo_cable: 'steel' },
    { instalacion: 'unknown' }, { circuitos_agrupados: 0 }, { circuitos_agrupados: 21 },
    { temperatura_ambiente_c: 61 }, { sistema: 'unknown' }]) {
    assert.ok(cable(bad === null ? null : { ...valid, ...bad }).error, JSON.stringify(bad));
  }
});

test('cable respects explicit system and conservative grouping without certifying a complete installation', () => {
  const input = { potencia_w: 1000, tension_v: 230, longitud_m: 10, cos_phi: 1 };
  const mono = cable({ ...input, sistema: 'monofasico' });
  const tri = cable({ ...input, sistema: 'trifasico' });
  assert.equal(mono.cumple_norma, null);
  assert.equal(mono.cumple_criterios_calculados, true);
  assert.equal(tri.sistema_asumido_por_tension, false);
  assert.equal(calculatorGlobals._factorAgrupamiento(8), 0.7);
  assert.ok(calculatorGlobals._factorAgrupamiento(8) <= calculatorGlobals._factorAgrupamiento(6));
  assert.notEqual(mono.resumen, tri.resumen);
});

test('tray asks for radius and occupancy criterion instead of fabricating manufacturer limits', () => {
  const input = { ancho_mm: 300, alto_mm: 60, cables_diametro_mm: [10] };
  const missing = tray(input);
  assert.equal(missing.radio_minimo_mm, null);
  assert.equal(missing.desarrollo_curva_mm, null);
  assert.equal(missing.llenado_ok, null);
  assert.equal(missing.cumple_norma, null);
  assert.equal(missing.preguntas.length, 2);
  assert.equal(tray({ ...input, radio_interior_mm: 300 }).desarrollo_curva_mm, 707);
  assert.equal(tray({ ...input, tipo: 'curva_vertical', radio_interior_mm: 300 }).desarrollo_curva_mm, 518);
  assert.equal(tray({ ...input, llenado_maximo_pct: 40 }).llenado_ok, true);
  assert.equal(tray({ ...input, tipo: 'derivacion_T' }).dimensiones_accesorio, null);
});

test('tray rejects invalid dimensions, angles, diameters and overflow', () => {
  const valid = { ancho_mm: 300, alto_mm: 60 };
  for (const bad of [{ ancho_mm: 0 }, { alto_mm: NaN }, { angulo_grados: 0 },
    { radio_interior_mm: -1 }, { llenado_maximo_pct: 0 }, { tipo: 'unknown' },
    { cables_diametro_mm: [0] }, { cables_diametro_mm: '10' }, { ancho_mm: 1e308 }]) {
    assert.ok(tray({ ...valid, ...bad }).error, JSON.stringify(bad));
  }
});

test('protection refuses invalid supplied data and leaves differential selection pending', () => {
  for (const bad of [{ tension_v: 0 }, { tipo_carga: 'unknown' }, { instalacion: 'unknown' },
    { seccion_cable_mm2: 0 }, { seccion_cable_mm2: 3 }, { longitud_m: Infinity }]) {
    assert.ok(JSON.parse(calculate({ intensidad_nominal_a: 32, ...bad })).error);
  }
  const motor = JSON.parse(calculate({ intensidad_nominal_a: 32, tipo_carga: 'motor' }));
  assert.equal(motor.magnetotermico.calibre_a, null);
  assert.equal(motor.magnetotermico.calibre_candidato_a, 32);
  assert.equal(motor.seleccion_definitiva_autorizada, false);
  assert.equal(motor.magnetotermico.curva, null);
  assert.match(motor.magnetotermico.pregunta_curva, /arranque/);
  assert.equal(motor.diferencial.sensibilidad_ma, null);
  assert.equal(motor.cumple_norma, null);
  const coordination = JSON.parse(calculate({ intensidad_nominal_a: 32, seccion_cable_mm2: 1.5 }));
  assert.equal(coordination.coordinacion_cable.seccion_minima_mm2, 2.5);
});
test('a favourable tabulated comparison cannot turn a candidate into an authorised protection', () => {
  const result = JSON.parse(calculate({ intensidad_nominal_a: 26, seccion_cable_mm2: 10,
    instalacion: 'bandeja', tension_v: 230 }));
  assert.equal(result.coordinacion_cable.cumple, true);
  assert.equal(result.coordinacion_cable.calibre_candidato_a, 32);
  assert.equal(result.coordinacion_cable.calibre_proteccion_a, null);
  assert.equal(result.magnetotermico.calibre_a, null);
  assert.equal(result.seleccion_definitiva_autorizada, false);
  assert.match(result.decision_permitida, /No fijar/);
});

test('plan generation rejects truncated or ambiguous SVG instead of fabricating a closure', () => {
  const extract = load('worker.js', '_extraerSvgCompleto');
  assert.equal(extract('```xml\n<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>\n```'), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  for (const text of [null, '', '<svg><path d="M0', '<svg></svgarbage>', '<svg><svg></svg></svg>']) assert.throws(() => extract(text));
});

test('generation and editing share technical fidelity policy for missing heights and units', () => {
  const prepare = load('worker.js', '_prepararPlanoPrompt', {
    _PLANO_PROMPTS: { planta: 'example', bandejas: 'tray', unifilar: '{{SIMBOLOS}}' },
    _bloqueSimbolosDinamico: () => 'symbols',
  });
  for (const type of ['bandejas', 'unifilar', 'planta']) {
    const prompt = prepare(type, 'test');
    assert.match(prompt, /Y=2 m NO es una altura/);
    assert.match(prompt, /unica proporcion px\/m/);
    assert.match(prompt, /BORRADOR/);
    assert.match(prompt, /No inventes/);
    assert.match(prompt, /SVG estatico/);
  }
});

test('AI plans reject executable SVG instead of silently stripping dynamic drawing code', () => {
  const extract = load('worker.js', '_extraerSvgCompleto');
  for (const svg of [
    '<svg><g><script>for(let x=0;x<=1400;x+=50){draw(x)}</script></g></svg>',
    '<svg><script><![CDATA[drawGrid()]]></script></svg>',
    '<svg><s:script xmlns:s="http://www.w3.org/2000/svg">draw()</s:script></svg>',
    '<svg ONLOAD = "draw()"><path d="M0 0"/></svg>',
    '<svg><g onclick="draw()"/></svg>',
    '<svg><foreignObject><div>Interactive drawing</div></foreignObject></svg>',
  ]) assert.throws(() => extract(svg), /Plano no estatico/);
  const passive = '<svg><!-- do not use <script> --><defs><g id="tray"/></defs><use href="#tray"/><line x1="0" y1="0" x2="100" y2="0"/></svg>';
  assert.equal(extract(passive), passive);
});

test('XML validation rejects malformed tags, attributes, entities, characters and namespaces', () => {
  const extract = load('worker.js', '_extraerSvgCompleto');
  for (const svg of [
    '<svg><g></svg>', '<svg><text>A & B</text></svg>',
    '<svg><text>&undefined;</text></svg>', '<svg><g a="<"/></svg>',
    '<svg><text>bad\u0001</text></svg>', '<svg><g a="1" a="2"/></svg>',
    '<svg><g disabled/></svg>', '<svg><x:g/></svg>',
  ]) assert.throws(() => extract(svg), /Plano XML invalido/);
  assert.throws(() => extract('<!DOCTYPE svg><svg/>'), /declaraciones XML/);
  assert.throws(() => extract('x'.repeat(524289)), /demasiado grande/);
  assert.throws(() => extract(`<svg><text>${'á'.repeat(300000)}</text></svg>`), /demasiado grande/);
});

test('a technical plan requires draft and execution warnings in SVG text, not hidden metadata', () => {
  const extract = load('worker.js', '_extraerSvgCompleto');
  const draft = '<text>BORRADOR — pendiente de revisión técnica</text>';
  const warning = 'NO EJECUTAR EN OBRA';
  const wrap = inner => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  for (const hidden of [
    `<!-- ${warning} -->`, `<metadata>${warning}</metadata>`, `<title>${warning}</title>`,
    `<defs><text>${warning}</text></defs>`, `<text display="none">${warning}</text>`,
    `<g visibility="hidden"><text>${warning}</text></g>`, `<text style="opacity:0">${warning}</text>`,
    `<x:text xmlns:x="urn:non-svg">${warning}</x:text>`,
  ]) assert.throws(() => extract(wrap(draft + hidden), { tipo: 'bandejas' }), /sin aviso NO EJECUTAR/);
  assert.throws(() => extract(wrap(`<text>${warning}</text>`), { tipo: 'bandejas' }), /sin aviso de borrador/);
  assert.throws(() => extract(`<svg xmlns="urn:wrong">${draft}<text>${warning}</text></svg>`,
    { tipo: 'bandejas' }), /Plano XML invalido/);
  const valid = wrap(draft + '<text>NO <tspan>EJECUTAR</tspan> EN OBRA</text><text>A &amp; B</text>');
  assert.equal(extract(valid, { tipo: 'bandejas' }), valid);
  assert.equal(extract(wrap(draft), { tipo: 'gantt' }), wrap(draft));
});

test('missing warnings or malformed XML cannot persist a generated plan', async () => {
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg"><text>Plan without warning</text></svg>',
    '<svg><g a="<"/></svg>',
  ]) {
    let writes = 0;
    const generate = load('worker.js', '_generarPlanoInterno', {
      _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
      _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
      fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: svg }] }) }),
    });
    await assert.rejects(generate({ DB: { prepare: () => { writes++; throw new Error('Unexpected write'); } } },
      { tipo: 'planta', titulo: 'QA', descripcion: 'synthetic', empresa_id: 5, usuario_id: 7 }), /Plano (XML invalido|sin aviso)/);
    assert.equal(writes, 0);
  }
});

test('an executable provider response cannot persist a generated plan', async () => {
  let writes = 0;
  const generate = load('worker.js', '_generarPlanoInterno', {
    _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
    _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
    fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: '<svg><script>draw()</script></svg>' }] }) }),
  });
  await assert.rejects(generate({ DB: { prepare: () => { writes++; throw new Error('Unexpected write'); } } },
    { tipo: 'planta', titulo: 'QA', descripcion: 'synthetic', empresa_id: 5, usuario_id: 7 }), /Plano no estatico/);
  assert.equal(writes, 0);
});

test('AI editing rejects executable SVG without replacing the existing tenant-scoped plan', async () => {
  let reads = 0;
  const edit = load('worker.js', 'editarPlanoCircuitosREST', {
    _getAuthPlano: async () => ({ empresa_id: 5, rol: 'admin' }),
    _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
    _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
    _llamarAnthropicPlanoStream: async () => '<svg><g onload="draw()"/></svg>',
    err: (message, status) => ({ message, status }),
  });
  const result = await edit({ json: async () => ({ cambios: [{ circuito_id: 'C1', campo: 'notas', valor: 'QA' }] }) },
    { DB: { prepare(sql) {
      assert.match(sql, /^SELECT \* FROM planos WHERE id=\? AND empresa_id=\?$/);
      reads++;
      return { bind(id, company) {
        assert.equal(id, 28); assert.equal(company, 5);
        return { first: async () => ({ tipo: 'planta', titulo: 'QA', circuitos_json: '[]' }) };
      } };
    } } }, '/planos/28/circuitos');
  assert.equal(result.status, 502);
  assert.match(result.message, /Plano no estatico/);
  assert.equal(reads, 1, 'Only the scoped SELECT may run; no UPDATE on rejection');
});

test('AI editing rejects XML and missing warnings before updating the scoped plan', async () => {
  for (const svg of ['<svg><text>A & B</text></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><text>BORRADOR — pendiente de revision tecnica</text></svg>']) {
    let reads = 0;
    const edit = load('worker.js', 'editarPlanoCircuitosREST', {
      _getAuthPlano: async () => ({ empresa_id: 5, rol: 'admin' }),
      _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
      _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
      _llamarAnthropicPlanoStream: async () => svg, err: (message, status) => ({ message, status }),
    });
    const result = await edit({ json: async () => ({ cambios: [{ circuito_id: 'C1', campo: 'notas', valor: 'QA' }] }) },
      { DB: { prepare(sql) {
        assert.match(sql, /^SELECT \* FROM planos WHERE id=\? AND empresa_id=\?$/); reads++;
        return { bind(id, company) {
          assert.equal(id, 28); assert.equal(company, 5);
          return { first: async () => ({ tipo: 'planta', titulo: 'QA', circuitos_json: '[]' }) };
        } };
      } } }, '/planos/28/circuitos');
    assert.equal(result.status, 502);
    assert.match(result.message, /Plano (XML invalido|sin aviso)/);
    assert.equal(reads, 1);
  }
});

test('invalid final symbol injection is rejected before storing a generated plan', async () => {
  let writes = 0;
  const valid = '<svg xmlns="http://www.w3.org/2000/svg"><text>BORRADOR — pendiente de revision tecnica</text><text>NO EJECUTAR EN OBRA</text></svg>';
  const generate = load('worker.js', '_generarPlanoInterno', {
    _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
    _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
    IEC_SYMBOLS_DEFS: '<defs><g>', _normalizarColoresUseSvg: s => s, logAIUsage: () => {},
    fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: valid }] }) }),
  });
  await assert.rejects(generate({ DB: { prepare: () => { writes++; throw new Error('Unexpected write'); } } },
    { tipo: 'electrico', titulo: 'QA', descripcion: 'synthetic', empresa_id: 5, usuario_id: 7 }), /Plano XML invalido/);
  assert.equal(writes, 0);
});

test('an incomplete provider response cannot persist a plan', async () => {
  let writes = 0;
  const generate = load('worker.js', '_generarPlanoInterno', {
    _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
    _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
    fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: '<svg><path' }] }) }),
  });
  await assert.rejects(generate({ DB: { prepare: () => { writes++; throw new Error('Unexpected write'); } } },
    { tipo: 'planta', titulo: 'QA', descripcion: 'synthetic', empresa_id: 5, usuario_id: 7 }), /Plano incompleto/);
  assert.equal(writes, 0);
});

function editable(overrides = {}) {
  return { tagName: 'INPUT', type: 'text', disabled: false, readOnly: false, value: '',
    style: {}, matches: () => false, getAttribute: () => null, scrollIntoView() {},
    focus() {}, click() {}, dispatchEvent() {}, ...overrides };
}
test('floating controls remain accessible after restoring a position from a larger window', () => {
  const limit = load('panel.html', '_limitarPosicionFlotante');
  const pos = limit(1464.4, 663.8, 56, 56, 1536, 687);
  assert.equal(pos.top, 627);
  assert.equal(pos.left, 1464.4);
  const portrait = limit(1464, 663, 56, 56, 390, 844);
  assert.equal(portrait.left, 330);
  assert.equal(portrait.top, 663);
  const negative = limit(-20, -5, 56, 56, 390, 844);
  assert.equal(negative.left, 4);
  assert.equal(negative.top, 4);
  const tiny = limit(100, 100, 56, 56, 40, 40);
  assert.equal(tiny.left, 0);
  assert.equal(tiny.top, 0);
});
test('hidden FAB restoration uses CSS dimensions before it becomes visible', () => {
  const element = { style: { left: '1464.4px', top: '663.8px' }, offsetWidth: 0, offsetHeight: 0 };
  const adjust = load('panel.html', '_ajustarFabViewport', {
    _limitarPosicionFlotante: load('panel.html', '_limitarPosicionFlotante'),
    getComputedStyle: () => ({ width: '56px', height: '56px' }),
    window: { innerWidth: 1536, innerHeight: 687 },
  });
  adjust(element);
  assert.equal(element.style.top, '627px');
  const normal = { style: { left: '', top: '' } };
  adjust(normal);
  assert.equal(normal.style.left, '');
});
function officeAction(element) {
  return load('panel.html', '_alejandraFabEjecutarAccion', {
    document: { querySelector: () => element }, Event: class {},
    setTimeout: fn => { fn(); },
  });
}
test('Office preserves zero and refuses readonly, disabled and incompatible fields', async () => {
  const element = editable();
  await officeAction(element)({ tipo: 'rellenar', selector: '#qa', valor: 0 });
  assert.equal(element.value, '0');
  for (const invalid of [{ disabled: true }, { readOnly: true }, { type: 'file' },
    { tagName: 'DIV' }, { type: 'checkbox' }, { matches: () => true }]) {
    const control = editable(invalid);
    await assert.rejects(officeAction(control)({ tipo: 'rellenar', selector: '#qa', valor: 1 }));
    assert.equal(control.value, '');
  }
});
test('Office refuses disabled clicks and unavailable options without changing selection', async () => {
  let clicks = 0;
  await assert.rejects(officeAction(editable({ disabled: true, click: () => clicks++ }))({ tipo: 'click', selector: '#qa' }));
  assert.equal(clicks, 0);
  const select = editable({ tagName: 'SELECT', value: 'old', options: [
    { value: '0' }, { value: 'disabled', disabled: true },
    { value: 'group', parentElement: { disabled: true } },
  ] });
  for (const value of ['missing', 'disabled', 'group']) {
    await assert.rejects(officeAction(select)({ tipo: 'seleccionar', selector: '#qa', valor: value }));
    assert.equal(select.value, 'old');
  }
  await officeAction(select)({ tipo: 'seleccionar', selector: '#qa', valor: 0 });
  assert.equal(select.value, '0');
});

test('protection never proposes a smaller rating than the requested current', () => {
  for (const current of [0.5, 6, 6.1, 31, 32, 100, 124.9, 125]) {
    const result = JSON.parse(calculate({ intensidad_nominal_a: current }));
    assert.ok(result.magnetotermico.calibre_candidato_a >= current);
    assert.equal(result.magnetotermico.calibre_a, null);
  }
  for (const current of [125.1, 126, 200, 1000]) {
    const result = JSON.parse(calculate({ intensidad_nominal_a: current }));
    assert.equal(result.error, 'FUERA_DE_RANGO');
    assert.equal(result.magnetotermico, undefined);
    assert.equal(result.diferencial, undefined);
  }
});
test('protection rejects missing, nonnumeric, nonfinite and nonpositive current', () => {
  for (const current of [undefined, null, '32', NaN, Infinity, -Infinity, -1, 0]) {
    const result = JSON.parse(calculate({ intensidad_nominal_a: current }));
    assert.equal(result.error, 'INTENSIDAD_INVALIDA');
    assert.equal(result.magnetotermico, undefined);
  }
});

function office(execute) {
  const elements = {
    aleFabPlanStatus: { textContent: '' },
    aleFabPlanProgress: { style: {} },
  };
  const notifications = [];
  const window = {};
  const document = {
    createElement: () => ({ style: {}, remove() {} }),
    body: { appendChild(el) { elements[el.id] = el; } },
    getElementById: id => elements[id],
  };
  const run = load('panel.html', '_alejandraFabEjecutarPlan', {
    document, window, toast: (...args) => notifications.push(args),
    _alejandraFabEjecutarAccion: acc => execute(acc, window),
    setTimeout: (fn, ms) => { if (ms !== 2000) fn(); },
  });
  return { run, elements, notifications };
}
test('Office stops after a failed step and never reports completion', async () => {
  const executed = [];
  const ui = office(async acc => {
    executed.push(acc.desc);
    if (acc.desc === 'second') throw new Error('Missing control');
  });
  await ui.run({ acciones: ['first', 'second', 'third'].map(desc => ({ tipo: 'click', desc })) });
  assert.deepEqual(executed, ['first', 'second']);
  assert.match(ui.elements.aleFabPlanStatus.textContent, /Error.*2/);
  assert.ok(Math.abs(parseFloat(ui.elements.aleFabPlanProgress.style.width) - 100 / 3) < 1e-10);
  assert.equal(ui.notifications.some(([, type]) => type === 'ok'), false);
});
test('Office distinguishes completed and cancelled plans', async () => {
  const completed = office(async () => {});
  await completed.run({ acciones: [{ tipo: 'click' }, { tipo: 'click' }] });
  assert.equal(completed.elements.aleFabPlanStatus.textContent, 'Plan completado');
  assert.equal(completed.elements.aleFabPlanProgress.style.width, '100%');
  assert.equal(completed.notifications.filter(([, type]) => type === 'ok').length, 1);
  let count = 0;
  const cancelled = office(async (_, window) => { count++; window._alejandraFabAbortarPlan(); });
  await cancelled.run({ acciones: [{ tipo: 'click' }, { tipo: 'click' }] });
  assert.equal(count, 1);
  assert.equal(cancelled.elements.aleFabPlanStatus.textContent, 'Cancelado');
  assert.equal(cancelled.notifications.some(([, type]) => type === 'ok'), false);
});

test('Office rejects unsupported actions, missing scroll target and missing page', async () => {
  const action = load('panel.html', '_alejandraFabEjecutarAccion', {
    document: { querySelector: () => null, getElementById: () => null }, navTo() {},
  });
  for (const input of [{ tipo: 'unknown' }, { tipo: 'scroll', selector: '#missing' },
    { tipo: 'navegar' }, { tipo: 'navegar', destino: 'missing' }]) {
    await assert.rejects(action(input));
  }
});

test('tray catalog SQL excludes another tenant, owner and unowned or inactive rows', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE alejandra_memoria (
      empresa_id TEXT, usuario_id TEXT, tipo TEXT, titulo TEXT, contenido TEXT, importancia INTEGER);
      CREATE TABLE alejandra_conocimiento (
      empresa_id TEXT, creado_por TEXT, titulo TEXT, descripcion TEXT, tags TEXT, activo INTEGER);`);
    for (const [company, owner, label, active] of [
      ['1', '7', 'own', 1], ['2', '7', 'foreign-tenant', 1],
      ['1', '8', 'foreign-owner', 1], [null, '7', 'global', 1],
      ['1', null, 'unowned', 1], ['1', '7', 'inactive', 0],
    ]) {
      if (active) db.prepare('INSERT INTO alejandra_memoria VALUES (?, ?, ?, ?, ?, ?)')
        .run(company, owner, 'hecho', label, 'bandeja', 1);
      db.prepare('INSERT INTO alejandra_conocimiento VALUES (?, ?, ?, ?, ?, ?)')
        .run(company, owner, label, 'catalog', 'bandeja', active);
    }
    const queries = [];
    const env = { DB: { prepare(sql) {
      queries.push(sql);
      return { bind(...args) { return { async all() { return { results: db.prepare(sql).all(...args) }; } }; } };
    } } };
    const catalog = load('worker.js', '_obtenerCatalogoBandejas');
    const rows = await catalog(env, { empresa_id: 1, usuario_id: 7 });
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => row.titulo === 'own'));
    let prompt = '';
    const generate = load('worker.js', '_generarPlanoInterno', {
      _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
      _obtenerCatalogoBandejas: catalog,
      fetch: async (_, options) => {
        prompt = JSON.stringify(JSON.parse(options.body).messages);
        throw new Error('Stop before model response or database writes');
      },
    });
    await assert.rejects(generate(env, {
      tipo: 'bandejas', titulo: 'Test', descripcion: 'Test', empresa_id: 1, usuario_id: 7,
    }), /Stop before model/);
    assert.match(prompt, /own/);
    assert.doesNotMatch(prompt, /foreign-tenant|foreign-owner|global|unowned|inactive/);
    queries.length = 0;
    for (const scope of [{}, { empresa_id: 1 }, { usuario_id: 7 }, { empresa_id: 0, usuario_id: 7 }]) {
      assert.equal((await catalog(env, scope)).length, 0);
    }
    assert.equal(queries.length, 0, 'Missing scope must not query any context');
  } finally { db.close(); }
});

test('internal plan authentication rejects missing or malformed tenant instead of defaulting to 1', async () => {
  const auth = load('worker.js', '_getAuthPlano');
  const request = { headers: { get: () => 'test-internal-secret' } };
  const env = { AGENT_INTERNAL_SECRET: 'test-internal-secret' };
  for (const company of [undefined, null, '', 'default', '1junk', 0, -1, 1.5]) {
    assert.equal((await auth(request, env, { empresa_id: company })).empresa_id, null);
  }
  assert.equal((await auth(request, env, { empresa_id: '2', usuario_id: '7' })).empresa_id, 2);
});

test('plan generation uses session identity and refuses missing scope before calling the web Worker', async () => {
  const source = readFileSync(resolve(__dirname, '../alejandra-agente/worker.js'), 'utf8');
  const start = source.indexOf("case 'generar_plano':");
  const end = source.indexOf("case 'importar_plano_dxf':", start);
  assert.ok(start >= 0 && end > start);
  const sent = [];
  const run = vm.runInNewContext(`async (input, empresa_id, usuario_id, fuentesPlano = []) => {
    const sendSSE = null;
    switch ('generar_plano') { ${source.slice(start, end)} }
  }`, { validarDatosPlanoBandejas: load('alejandra-agente/lib.js', 'validarDatosPlanoBandejas'), env: { API_WEB: { async fetch(url, options) {
    sent.push(JSON.parse(options.body));
    return { ok: true, async json() { return { ok: true }; } };
  } } } });
  const input = { tipo: 'bandejas', titulo: 'Test', descripcion: 'Test', empresa_id: 2, usuario_id: '8' };
  assert.equal(JSON.parse(await run(input, 1, '7', ['altura de montaje: 2,8 m sobre suelo terminado'])).ok, true);
  assert.equal(sent[0].empresa_id, 1);
  assert.equal(sent[0].usuario_id, '7');
  for (const [company, owner] of [[null, '7'], ['default', '7'], [0, '7'], [1, null]]) {
    assert.ok(JSON.parse(await run(input, company, owner)).error);
  }
  assert.equal(sent.length, 1);
  const fakeData = { ...input, descripcion: 'altura=4 m FFL', fuentesPlano: ['h=4 m FFL'] };
  const missing = JSON.parse(await run(fakeData, 1, '7', ['X=2 m, Y=2 m. Plano de ejecución, no es un boceto preliminar']));
  assert.equal(missing.error, 'DATOS_TECNICOS_FALTANTES');
  assert.equal(missing.preguntas.length, 2);
  assert.equal(sent.length, 1, 'Missing human data must not call API_WEB or start generation');
  assert.equal(JSON.parse(await run(input, 1, '7', ['Haz un boceto preliminar'])).ok, true);
  assert.match(sent[1].descripcion, /No ejecutar en obra/);
});
