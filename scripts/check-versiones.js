#!/usr/bin/env node
// F-0.2 — Comprueba que los tres marcadores de versión de la app coinciden.
//
// `version.json`, `sw.js` (`alejandra-vX.XX`) e `index.html` (`APP_VERSION`) deben ir
// siempre sincronizados. Desincronizarlos provocó bucles de recarga infinita en
// producción los días 22/04 y 26/04/2026.
//
// El workflow de Pages ya lo comprueba antes de publicar, pero entonces el error aparece
// en el momento de desplegar. Aquí se detecta en la PR, que es cuando cuesta barato.
//
// Ojo: subir de versión es una decisión de entrega, no un paso de cada edición. Este
// script NO exige que la versión suba; solo que los tres valores coincidan entre sí.

const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

function extraer(fichero, re, etiqueta) {
  const m = leer(fichero).match(re);
  if (!m) {
    console.error(`No se encontró el marcador de versión en ${fichero} (${etiqueta}).`);
    console.error('Si el formato cambió a propósito, actualizar también este script.');
    process.exit(2);
  }
  return m[1];
}

const versiones = {
  'version.json': JSON.parse(leer('version.json')).v,
  'sw.js': extraer('sw.js', /alejandra-v([^']+)'/, "alejandra-vX.XX"),
  'index.html': extraer('index.html', /APP_VERSION = '([^']+)'/, 'APP_VERSION'),
};

const distintas = new Set(Object.values(versiones));
for (const [f, v] of Object.entries(versiones)) console.log(`  ${f.padEnd(14)} ${v}`);

if (distintas.size !== 1) {
  console.error('\nDESINCRONIZADO. Los tres marcadores deben tener el mismo valor.');
  console.error('Desincronizarlos causó bucles de recarga infinita en producción (22/04 y 26/04/2026).');
  process.exit(1);
}
console.log(`\nVersiones sincronizadas: ${[...distintas][0]}`);
