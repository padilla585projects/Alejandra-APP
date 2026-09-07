#!/usr/bin/env node
// DEPT-CONTROL-01 (07/09/2026) — Comprueba que la lista de departamentos válidos del Worker
// coincide con la de los dos frontends.
//
// `worker.js` valida el departamento que llega a `PUT /sesion/departamento` contra
// `DEPTS_VALIDOS`; `index.html` y `panel.html` ofrecen los suyos en `_DEPTS_CATALOG`. Cuando
// se añade un departamento nuevo al frontend y no al Worker, el PUT responde 400, el
// frontend se lo traga y la sesión de D1 se queda con el departamento anterior: a partir de
// ahí el usuario ve una cosa y el servidor decide con otra. Pasó con `oficina` (SEC-14,
// entonces la lista tenía 4 de 11) y volvió a pasar con `control`, que rompió el guardado de
// replanteos con «Elemento no válido para este departamento».
//
// Solo compara los conjuntos de claves. No lee datos ni contacta con nada.

const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

function fallar(msg) {
  console.error(msg);
  process.exit(1);
}

// Claves de un objeto literal `const _DEPTS_CATALOG = { clave: {...}, ... };`
function clavesCatalogo(fichero) {
  const src = leer(fichero);
  const i = src.indexOf('const _DEPTS_CATALOG = {');
  if (i < 0) fallar(`No se encontró _DEPTS_CATALOG en ${fichero}. Si se renombró, actualizar este script.`);
  const fin = src.indexOf('\n};', i);
  if (fin < 0) fallar(`No se encontró el cierre de _DEPTS_CATALOG en ${fichero}.`);
  const cuerpo = src.slice(i, fin);
  const claves = [...cuerpo.matchAll(/^\s{2}([a-z_]+):\s*\{/gm)].map(m => m[1]);
  if (!claves.length) fallar(`_DEPTS_CATALOG de ${fichero} salió vacío: el formato cambió.`);
  return new Set(claves);
}

// Strings de `const DEPTS_VALIDOS = [ '...', ... ];`
function clavesWorker() {
  const src = leer('worker.js');
  const m = src.match(/const DEPTS_VALIDOS = \[([\s\S]*?)\];/);
  if (!m) fallar('No se encontró DEPTS_VALIDOS en worker.js. Si se renombró, actualizar este script.');
  const claves = [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1]);
  if (!claves.length) fallar('DEPTS_VALIDOS salió vacío: el formato cambió.');
  return new Set(claves);
}

const fuentes = {
  'worker.js (DEPTS_VALIDOS)': clavesWorker(),
  'index.html (_DEPTS_CATALOG)': clavesCatalogo('index.html'),
  'panel.html (_DEPTS_CATALOG)': clavesCatalogo('panel.html'),
};

for (const [etiqueta, set] of Object.entries(fuentes)) {
  console.log(`  ${etiqueta.padEnd(30)} ${set.size} departamentos`);
}

const referencia = fuentes['worker.js (DEPTS_VALIDOS)'];
let problemas = 0;
for (const [etiqueta, set] of Object.entries(fuentes)) {
  if (set === referencia) continue;
  const sobran = [...set].filter(d => !referencia.has(d));
  const faltan = [...referencia].filter(d => !set.has(d));
  if (sobran.length) {
    problemas++;
    console.error(`\n${etiqueta} ofrece departamentos que el Worker rechazaría: ${sobran.join(', ')}`);
    console.error('  → añadirlos a DEPTS_VALIDOS en worker.js, o quitarlos del frontend.');
  }
  if (faltan.length) {
    problemas++;
    console.error(`\nEl Worker acepta departamentos que ${etiqueta} no ofrece: ${faltan.join(', ')}`);
    console.error('  → añadirlos al frontend, o quitarlos de DEPTS_VALIDOS.');
  }
}

if (problemas) {
  console.error('\nDESINCRONIZADO. Un departamento que el Worker no acepta hace que');
  console.error('PUT /sesion/departamento devuelva 400 y la sesión de D1 conserve el anterior:');
  console.error('el usuario ve un departamento y el servidor decide con otro (DEPT-CONTROL-01).');
  process.exit(1);
}
console.log(`\nDepartamentos sincronizados: ${[...referencia].sort().join(', ')}`);
