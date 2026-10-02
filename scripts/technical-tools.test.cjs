const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { SaxesParser } = require('saxes');
let warningPolicy;
let mountingContract;
let idPlanoPolicy;

// Exercise the production functions without loading unrelated Worker bindings or UI.
function load(file, name, globals = {}) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`));
  assert.ok(match, `Missing production function ${name}`);
  return vm.runInNewContext(`${match[0]}; ${name}`, { SaxesParser, TextEncoder,
    _validarAvisosPlano: warningPolicy, _contratoMontajePlano: mountingContract,
    normalizarIdPlano: idPlanoPolicy, ...globals });
}

idPlanoPolicy = load('alejandra-agente/lib.js', 'normalizarIdPlano');
warningPolicy = load('worker.js', '_validarAvisosPlano');
mountingContract = load('worker.js', '_contratoMontajePlano');

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
  assert.equal(coordination.coordinacion_cable.seccion_candidata_tabular_mm2, 2.5);
  assert.equal(coordination.coordinacion_cable.cumple_comparacion_tabular, false);
  assert.equal(coordination.coordinacion_cable.cumple, null);
});
test('a favourable tabulated comparison cannot turn a candidate into an authorised protection', () => {
  const result = JSON.parse(calculate({ intensidad_nominal_a: 26, seccion_cable_mm2: 10,
    instalacion: 'bandeja', tension_v: 230 }));
  assert.equal(result.coordinacion_cable.cumple, null);
  assert.equal(result.coordinacion_cable.cumple_comparacion_tabular, true);
  assert.equal(result.coordinacion_cable.ampacidad_cable_a, null);
  assert.equal(result.coordinacion_cable.ampacidad_tabla_sin_factores_a, 76);
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

const montajeDescripcion = datos => 'QA\n\nDATOS VERIFICADOS EN TEXTO HUMANO (prevalecen sobre los ejemplos):\n' + JSON.stringify(datos);
const montajeConfirmado = { ok: true, modo: 'borrador_tecnico', altura_m: 2.8, referencia: 'FFL' };
const montajeSvg = notas => '<svg xmlns="http://www.w3.org/2000/svg"><text>BORRADOR — pendiente de revision tecnica</text><text>NO EJECUTAR EN OBRA</text>' + notas + '</svg>';

test('mounting contract preserves confirmed datum and refuses corrupt metadata without guessing legacy values', () => {
  const contract = mountingContract('bandejas', montajeDescripcion(montajeConfirmado));
  assert.equal(contract.altura_m, 2.8);
  assert.equal(contract.referencia, 'suelo terminado');
  assert.equal(mountingContract('bandejas', 'Altura 3 m sobre suelo terminado').anotacion_montaje, undefined);
  assert.equal(mountingContract('bandejas', montajeDescripcion({ ok: true, modo: 'boceto_preliminar' })).anotacion_montaje, undefined);
  for (const datos of [{ ...montajeConfirmado, ok: false }, { ...montajeConfirmado, altura_m: '2.8' },
    { ...montajeConfirmado, altura_m: null }, { ...montajeConfirmado, referencia: 'techo' }]) {
    assert.throws(() => mountingContract('bandejas', montajeDescripcion(datos)), /Datos de montaje/);
  }
  assert.throws(() => mountingContract('bandejas', montajeDescripcion(montajeConfirmado).slice(0, -1)), /incompletos/);
});

test('mounting annotation must retain height and datum together, with equivalent units and visible text', () => {
  const extract = load('worker.js', '_extraerSvgCompleto');
  const contract = mountingContract('bandejas', montajeDescripcion(montajeConfirmado));
  for (const annotation of ['2.8 m sobre suelo terminado', '2,80 metros desde FFL', '280 cm sobre pavimento terminado', '2800 mm sobre suelo terminado']) {
    const svg = montajeSvg(`<text>Altura de montaje: ${annotation}</text>`);
    assert.equal(extract(svg, contract), svg);
  }
  for (const notes of ['', '<text>Altura de montaje: 2.80 m</text><text>FFL</text>',
    '<text>Altura de montaje: 3 m sobre FFL</text>', '<text>Altura de montaje: 2.8 mm sobre FFL</text>',
    '<text>Altura de montaje: 2.8 m sobre cota 0 del proyecto</text>',
    '<metadata>Altura de montaje: 2.8 m sobre FFL</metadata>',
    '<text display="none">Altura de montaje: 2.8 m sobre FFL</text>',
    '<text>Altura de montaje: 2.8 m sobre FFL</text><text>Altura de montaje: 4 m sobre FFL</text>']) {
    assert.throws(() => extract(montajeSvg(notes), contract), /altura|referencia/);
  }
});

test('a provider omitting the confirmed mounting datum cannot insert a plan', async () => {
  let writes = 0;
  const generate = load('worker.js', '_generarPlanoInterno', {
    _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
    _obtenerCatalogoBandejas: async () => [], _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
    fetch: async () => ({ ok: true, json: async () => ({ content: [{ text: montajeSvg('<text>Altura de montaje: 2.80 m</text>') }] }) }),
  });
  await assert.rejects(generate({ DB: { prepare: () => { writes++; throw new Error('Unexpected write'); } } },
    { tipo: 'bandejas', titulo: 'QA', descripcion: montajeDescripcion(montajeConfirmado), empresa_id: 5, usuario_id: 7 }), /sin anotacion/);
  assert.equal(writes, 0);
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

test('editing a confirmed tray plan cannot overwrite it with a missing or changed mounting datum', async () => {
  for (const annotation of ['Altura de montaje: 2.8 m', 'Altura de montaje: 2.8 m sobre cota 0 del proyecto']) {
    let reads = 0;
    const edit = load('worker.js', 'editarPlanoCircuitosREST', {
      _getAuthPlano: async () => ({ empresa_id: 5, rol: 'admin' }),
      _ensurePlanosTable: async () => {}, _prepararPlanoPrompt: () => 'test',
      _extraerSvgCompleto: load('worker.js', '_extraerSvgCompleto'),
      _llamarAnthropicPlanoStream: async () => montajeSvg(`<text>${annotation}</text>`),
      err: (message, status) => ({ message, status }),
    });
    const result = await edit({ json: async () => ({ cambios: [{ circuito_id: 'C1', campo: 'notas', valor: 'QA' }] }) },
      { DB: { prepare(sql) {
        assert.match(sql, /^SELECT \* FROM planos WHERE id=\? AND empresa_id=\?$/);
        reads++;
        return { bind: (id, company) => {
          assert.equal(id, 31); assert.equal(company, 5);
          return { first: async () => ({ tipo: 'bandejas', titulo: 'QA', circuitos_json: '[]', descripcion: montajeDescripcion(montajeConfirmado) }) };
        } };
      } } }, '/planos/31/circuitos');
    assert.equal(result.status, 502);
    assert.match(result.message, /altura|referencia/);
    assert.equal(reads, 1, 'No UPDATE after rejection');
  }
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
  for (const company of [undefined, null, '', 'default', '1junk', '1e0', '0x1', true, [1], 0, -1, 1.5]) {
    assert.equal((await auth(request, env, { empresa_id: company })).empresa_id, null);
  }
  assert.equal((await auth(request, env, { empresa_id: '2', usuario_id: '7' })).empresa_id, 2);
});

test('CAD read shares strict authentication and never queries a default or foreign tenant', async () => {
  const queries = [];
  let sessionCompany = 2;
  const env = { AGENT_INTERNAL_SECRET: 'test-internal-secret', DB: { prepare(sql) {
    assert.match(sql, /WHERE id=\? AND empresa_id=\?/);
    return { bind(id, company) { queries.push([id, company]); return { async first() {
      return id === 7 && company === 2 ? { id: 7, empresa_id: 2 } : null;
    } }; } };
  } } };
  const auth = load('worker.js', '_getAuthPlano', { getAuth: async () => ({ empresa_id: sessionCompany }) });
  const read = load('worker.js', 'getPlano', { _getAuthPlano: auth,
    _ensurePlanosTable: async () => {}, err: (error, status) => ({ error, status }), json: data => data });
  const request = company => ({ headers: { get: name => name === 'X-Internal-Secret' ? 'test-internal-secret' : company } });
  for (const company of [null, '', 'default', '1junk', '1e0', '0x1', '0', '-1', '1.5']) {
    assert.equal((await read(request(company), env, '/planos/7')).status, 401);
  }
  assert.equal(queries.length, 0);
  assert.equal((await read(request('2'), env, '/planos/7')).plano.id, 7);
  assert.equal((await read(request('2'), env, '/planos/8')).status, 404);
  assert.deepEqual(queries, [[7, 2], [8, 2]]);
  queries.length = 0;
  assert.equal((await read(request('2'), env, '/planos/7junk')).status, 400);
  const normalRequest = { headers: { get: () => null } };
  assert.equal((await read(normalRequest, env, '/planos/7')).plano.id, 7);
  sessionCompany = null;
  queries.length = 0;
  assert.equal((await read(normalRequest, env, '/planos/7')).status, 401);
  assert.equal(queries.length, 0);
});

test('DXF import authorises metadata before fetching content and refuses unknown or changed ownership', async () => {
  let headMetadata, bodyMetadata, ownerCompany = 2;
  let sessionUser = 9;
  const calls = [], inserts = [];
  const env = { FILES: {
    async head() { calls.push('head'); return headMetadata === null ? null : { customMetadata: headMetadata }; },
    async get() { calls.push('get'); return { customMetadata: bodyMetadata, async text() { calls.push('text'); return 'synthetic DXF'; } }; },
  }, DB: { prepare(sql) { return { bind(...args) {
    if (sql.startsWith('SELECT')) return { async first() {
      calls.push('owner');
      if (ownerCompany === 'throw') throw new Error('Synthetic D1 unavailable');
      return { empresa_id: args[0] === 10 ? 1 : ownerCompany };
    } };
    return { async run() { inserts.push(args); return { meta: { last_row_id: 10 } }; } };
  } }; } } };
  const owner = load('worker.js', '_empresaDeArchivoPlano');
  const importer = load('worker.js', 'importarDxfREST', {
    _getAuthPlano: async () => ({ empresa_id: 2, usuario_id: sessionUser }),
    _empresaDeArchivoPlano: owner, _ensurePlanosTable: async () => {},
    DxfParser: class { parseSync() { calls.push('parse'); return { entities: [{ type: 'LINE' }] }; } },
    dxfEntidadesASvg: () => ({ svg: '<svg/>', totalEntidades: 1, sinSoporte: 0 }),
    _resumenDxf: () => 'synthetic', err: (error, status) => ({ error, status }), json: data => data,
  });
  const request = { async json() { return { key: 'synthetic.dxf' }; } };
  sessionUser = null;
  assert.equal((await importer(request, env)).status, 401);
  assert.equal(calls.length, 0);
  sessionUser = 9;
  for (const [metadata, company] of [[null, 2], [{}, 2], [{ usuario_id: '9junk' }, 2],
    [{ usuario_id: true }, 2], [{ usuario_id: '9' }, null], [{ usuario_id: '9' }, '2junk'],
    [{ usuario_id: '9' }, 'throw'], [{ usuario_id: '9' }, 1]]) {
    calls.length = 0;
    headMetadata = metadata;
    ownerCompany = company;
    assert.equal((await importer(request, env)).status, 404);
    assert.ok(!calls.includes('get') && !calls.includes('text') && !calls.includes('parse'));
    assert.equal(inserts.length, 0);
  }
  ownerCompany = 2;
  headMetadata = { usuario_id: '9', original_name: 'synthetic.dxf' };
  for (const changedMetadata of [{}, { usuario_id: '9junk' }, { usuario_id: '10' }]) {
    bodyMetadata = changedMetadata;
    calls.length = 0;
    assert.equal((await importer(request, env)).status, 404);
    assert.ok(!calls.includes('text') && !calls.includes('parse'));
    assert.equal(inserts.length, 0);
  }
  bodyMetadata = headMetadata;
  calls.length = 0;
  assert.equal((await importer(request, env)).ok, true);
  assert.deepEqual(calls, ['head', 'owner', 'get', 'owner', 'text', 'parse']);
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0][0], 2);
  assert.equal(inserts[0][1], 9);
});

test('DXF tools cannot pick a tenant and refuse invalid scope before any downstream operation', async () => {
  const source = readFileSync(resolve(__dirname, '../alejandra-agente/worker.js'), 'utf8');
  for (const [name, next] of [['importar_plano_dxf', 'analizar_plano_dxf'],
    ['analizar_plano_dxf', 'generar_grafico'], ['editar_plano', 'estado_obra']]) {
    const start = source.indexOf(`case '${name}':`);
    const end = source.indexOf(`case '${next}':`, start);
    assert.ok(start >= 0 && end > start);
    const sent = [], queried = [];
    const env = { DB: { prepare(sql) { return { bind(...args) {
      queried.push({ sql, args }); return { async all() { return { results: [{ id: 7 }] }; } };
    } }; } }, API_WEB: { async fetch(url, options) {
      sent.push({ url, options });
      return { ok: true, async json() { return { ok: true, plano: { origen: 'importado', metadatos: '{}' } }; } };
    } } };
    const run = vm.runInNewContext(`async (input, empresa_id, usuario_id) => {
      const sendSSE = null;
      switch ('${name}') { ${source.slice(start, end)} }
    }`, { env, normalizarIdPlano: idPlanoPolicy, alcancePlanoGenerado: load('alejandra-agente/lib.js', 'alcancePlanoGenerado') });
    const input = { key: 'synthetic.dxf', plano_id: 7, empresa_id: 1, cambios: [{ circuito_id: 'QA', campo: 'nombre', valor: 'Test' }] };
    for (const company of [null, '', 'default', '1junk', '1e0', true, [1], 0, -1, 1.5]) {
      assert.ok(JSON.parse(await run(input, company, '9')).error);
    }
    assert.ok(JSON.parse(await run(input, 2, null)).error);
    assert.equal(sent.length, 0);
    assert.equal(queried.length, 0);
    assert.equal(JSON.parse(await run(input, 2, '9')).ok, true);
    if (name === 'analizar_plano_dxf') assert.equal(sent[0].options.headers['X-Empresa-Id'], '2');
    else {
      const body = JSON.parse(sent[0].options.body);
      assert.equal(body.empresa_id, 2);
      assert.equal(body.usuario_id, '9');
    }
    if (name !== 'importar_plano_dxf') {
      for (const plano_id of ['7junk', '7/../../anything', true, -1, 1.5]) {
        assert.ok(JSON.parse(await run({ ...input, plano_id }, 2, '9')).error);
      }
      assert.equal(sent.length, 1);
    }
    if (name === 'editar_plano') {
      assert.equal(JSON.parse(await run({ ...input, plano_id: undefined, busqueda: 'Test' }, 2, '9')).ok, true);
      assert.match(queried[0].sql, /empresa_id=\?/);
      assert.deepEqual(queried[0].args, ['%Test%', 2]);
      assert.equal(JSON.parse(sent[1].options.body).empresa_id, 2);
    }
  }
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
  }`, { normalizarIdPlano: idPlanoPolicy, alcancePlanoGenerado: load('alejandra-agente/lib.js', 'alcancePlanoGenerado'),
    validarDatosPlanoBandejas: load('alejandra-agente/lib.js', 'validarDatosPlanoBandejas'), env: { API_WEB: { async fetch(url, options) {
    sent.push(JSON.parse(options.body));
    return { ok: true, async json() { return { ok: true }; } };
  } } } });
  const input = { tipo: 'bandejas', titulo: 'Test', descripcion: 'Test', empresa_id: 2, usuario_id: '8' };
  assert.equal(JSON.parse(await run(input, 1, '7', ['altura de montaje: 2,8 m sobre suelo terminado'])).ok, true);
  // IA-QUALITY-08: todo plano generado declara que no es apto para ejecución.
  const alcance = JSON.parse(await run(input, 1, '7', ['altura de montaje: 2,8 m sobre suelo terminado'])).alcance;
  assert.equal(alcance.apto_para_ejecucion, false);
  assert.equal(alcance.tipo_documento, 'borrador_tecnico');
  assert.equal(JSON.parse(await run(input, 1, '7', ['Haz un boceto preliminar'])).alcance.tipo_documento, 'boceto_preliminar');
  sent.length = sent.length - 2; // descartar las dos llamadas extra de esta comprobación
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
  for (const texto of [
    'No sé la altura; ejemplo altura 2.8 m sobre FFL',
    'Altura 2.8 m sobre FFL; otro tramo altura 3.2 m sobre FFL',
    'Altura 320 sin unidad',
    'Z=320 pulgadas sobre FFL',
    'Altura 3 m sobre FFL; otro tramo altura 320 sin unidad',
  ]) {
    const rechazo = JSON.parse(await run(fakeData, 1, '7', ['altura 4 m sobre FFL', texto]));
    assert.equal(rechazo.error, 'DATOS_TECNICOS_FALTANTES');
    assert.equal(sent.length, 1, 'Ambiguous or incomplete human data must not reach API_WEB');
  }
  assert.equal(JSON.parse(await run(input, 1, '7', ['Haz un boceto preliminar'])).ok, true);
  assert.match(sent[1].descripcion, /No ejecutar en obra/);
  assert.equal(JSON.parse(await run(input, 1, '7', ['altura 4 m sobre FFL', 'Corrijo altura -1 m sobre FFL'])).ok, true);
  const bloque = JSON.parse(sent[2].descripcion.split('DATOS VERIFICADOS EN TEXTO HUMANO (prevalecen sobre los ejemplos):\n')[1]);
  assert.equal(bloque.altura_m, -1);
});

test('D1-ESCRITURAS-01: dead session tokens are flagged once per window, D1 errors are not', async () => {
  const dedupe = load('alejandra-agente/lib.js', 'debeRegistrarTrazaToken');
  const traces = [], updates = [];
  let mode = 'missing';
  const env = { DB: { prepare(sql) { return { bind(...args) {
    if (sql.startsWith('UPDATE')) { updates.push(sql); return { run: async () => ({}) }; }
    return { async first() {
      if (mode === 'throw') throw new Error('Synthetic D1 unavailable');
      return mode === 'found' ? { usuario_id: 7, empresa_id: 2, rol: 'operario', departamento: 'electrico' } : null;
    } };
  } }; } } };
  const auth = load('worker.js', '_getAuthSinMemo', {
    URL, console, timingSafeEqual: () => false, debeRegistrarTrazaToken: dedupe,
    _trazasTokenVistas: new Map(), registrarTraza: async (_env, t) => { traces.push(t); },
  });
  const request = { method: 'GET', url: 'https://api.test/sync/eventos', headers: { get: n => n === 'X-Token' ? 'deadbeef00112233' : null } };
  for (let i = 0; i < 50; i++) assert.equal((await auth(request, env)).tokenInvalido, true);
  assert.equal(traces.length, 1);
  assert.equal(traces[0].detalle.token_prefijo, 'deadbeef');
  mode = 'throw';
  assert.equal((await auth(request, env)).tokenInvalido, false);
  mode = 'found';
  const ok = await auth(request, env);
  assert.equal(ok.empresa_id, 2);
  assert.equal(ok.tokenInvalido, undefined);
  assert.match(updates[0], /last_used < datetime\('now', '-5 minutes'\)/);
});
