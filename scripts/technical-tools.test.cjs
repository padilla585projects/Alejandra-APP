const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

// Exercise the production functions without loading unrelated Worker bindings or UI.
function load(file, name, globals = {}) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`));
  assert.ok(match, `Missing production function ${name}`);
  return vm.runInNewContext(`${match[0]}; ${name}`, globals);
}

const calculate = load('alejandra-agente/worker.js', 'calcularProteccion');
test('protection never proposes a smaller rating than the requested current', () => {
  for (const current of [0.5, 6, 6.1, 31, 32, 100, 124.9, 125]) {
    const result = JSON.parse(calculate({ intensidad_nominal_a: current }));
    assert.ok(result.magnetotermico.calibre_a >= current);
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
  const run = vm.runInNewContext(`async (input, empresa_id, usuario_id) => {
    const sendSSE = null;
    switch ('generar_plano') { ${source.slice(start, end)} }
  }`, { env: { API_WEB: { async fetch(url, options) {
    sent.push(JSON.parse(options.body));
    return { ok: true, async json() { return { ok: true }; } };
  } } } });
  const input = { tipo: 'bandejas', titulo: 'Test', descripcion: 'Test', empresa_id: 2, usuario_id: '8' };
  assert.equal(JSON.parse(await run(input, 1, '7')).ok, true);
  assert.equal(sent[0].empresa_id, 1);
  assert.equal(sent[0].usuario_id, '7');
  for (const [company, owner] of [[null, '7'], ['default', '7'], [0, '7'], [1, null]]) {
    assert.ok(JSON.parse(await run(input, company, owner)).error);
  }
  assert.equal(sent.length, 1);
});
