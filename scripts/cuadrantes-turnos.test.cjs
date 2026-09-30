const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

// Ejecuta el algoritmo real del Worker, sin importar su entrypoint ni acceder a D1.
const worker = readFileSync(resolve(__dirname, '../worker.js'), 'utf8');
function segmento(inicio, fin) {
  const a = worker.indexOf(inicio), b = worker.indexOf(fin, a);
  assert.ok(a >= 0 && b > a, `No se encontró ${inicio}`);
  return worker.slice(a, b);
}
const fuente = "const DIAS_SEMANA_LETRAS = ['D','L','M','X','J','V','S'];\n" +
  segmento('function calcHoras(', '// ── Horarios de obra') +
  segmento('function _hmToMin(', '// Algoritmo determinista de reparto') +
  segmento('function generarCuadranteTurnos(', 'const CUADRANTE_PALETA');
const generar = runInNewContext(fuente + '\ngenerarCuadranteTurnos');
const config = {
  hora_inicio: '07:00', hora_fin: '19:00', dias_semana: 'LMXJV',
  personas_simultaneas: 2, horas_objetivo_semana: 40, pausa_comida_min: 60,
  fecha_inicio: '2026-09-21', semanas: 3,
  trabajadoras: [1, 2, 3, 4].map(id => ({ id })),
};
function fechasEnZona(zona, cambios = {}) {
  const child = spawnSync(process.execPath, ['-e', fuente +
    '\nconsole.log(JSON.stringify(generarCuadranteTurnos(' + JSON.stringify({ ...config, ...cambios }) + ').asignaciones));'],
    { env: { ...process.env, TZ: zona }, encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout);
}

test('las fechas y turnos son iguales en UTC, Madrid y Los Ángeles', () => {
  const utc = fechasEnZona('UTC');
  assert.equal(utc[0].fecha, config.fecha_inicio);
  assert.deepEqual(fechasEnZona('Europe/Madrid'), utc);
  assert.deepEqual(fechasEnZona('America/Los_Angeles'), utc);
});

test('el cambio de hora conserva la semana natural y los días laborables', () => {
  const cambios = { fecha_inicio: '2026-10-23', semanas: 2 };
  const utc = fechasEnZona('UTC', cambios);
  assert.deepEqual(fechasEnZona('Europe/Madrid', cambios), utc);
  assert.deepEqual([...new Set(utc.map(a => a.fecha))], [
    '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    '2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05',
  ]);
});

test('cada persona conserva horario dentro de la semana y rota la siguiente', () => {
  const { asignaciones } = generar(config);
  for (const { id } of config.trabajadoras) {
    const turnos = semana => new Set(asignaciones.filter(a => a.trabajadora_id === id &&
      a.fecha >= semana && a.fecha < new Date(Date.parse(semana) + 7 * 86400000).toISOString().slice(0, 10))
      .map(a => a.hora_inicio + '-' + a.hora_fin));
    assert.equal(turnos('2026-09-21').size, 1);
    assert.equal(turnos('2026-09-28').size, 1);
    assert.notDeepEqual([...turnos('2026-09-21')], [...turnos('2026-09-28')]);
  }
});

test('el caso de cuatro PRL cubre dos puestos descontando la comida y suma 40 horas', () => {
  const { asignaciones } = generar({ ...config, semanas: 1 });
  const minutos = hm => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
  const lunes = asignaciones.filter(a => a.fecha === config.fecha_inicio);
  for (let m = 7 * 60; m < 19 * 60; m++) {
    const activas = lunes.filter(a => m >= minutos(a.hora_inicio) && m < minutos(a.hora_fin) &&
      !(m >= minutos(a.pausa_inicio) && m < minutos(a.pausa_fin)));
    assert.ok(activas.length >= 2, `Cobertura insuficiente en el minuto ${m}`);
  }
  for (const { id } of config.trabajadoras) {
    assert.equal(asignaciones.filter(a => a.trabajadora_id === id).reduce((n, a) => n + a.horas, 0), 40);
  }
});

test('desactivar comida no añade pausas ni horas extra de presencia', () => {
  for (const a of generar({ ...config, pausa_comida_min: 0 }).asignaciones) {
    assert.equal(a.pausa_inicio, null);
    assert.equal(a.pausa_fin, null);
  }
});
