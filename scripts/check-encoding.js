#!/usr/bin/env node
// F-0.2 — Automatiza el check de encoding que `CLAUDE.md` describe como manual.
//
// El incidente del 13/05/2026 (panel.html y worker.js corrompidos por guardar con la
// codificación equivocada) costó horas. La comprobación existía, pero había que acordarse
// de ejecutarla.
//
// Analiza SOLO las líneas AÑADIDAS del diff, nunca ficheros enteros. Es deliberado:
// `worker.js` contiene la herramienta anti-corrupción de la propia Alejandra, que por
// necesidad incluye los patrones corruptos que busca. Un escaneo de fichero completo la
// marcaría siempre y el check acabaría desactivado por ruidoso.
//
//   node scripts/check-encoding.js              → compara contra origin/main
//   node scripts/check-encoding.js --staged     → comprueba lo que hay en el índice
//   node scripts/check-encoding.js <ref>        → compara contra otra referencia

const { execFileSync } = require('child_process');

// Marcadores de doble codificación UTF-8. Ver `CLAUDE.md`, sección CODIFICACIÓN.
//
// Las cuatro líneas de abajo llevan ESCAPE_AUTO porque contienen, necesariamente, los
// mismos patrones que buscan. Sin esa marca este script se delataría a sí mismo y habría
// roto el CI en la propia PR que lo introduce. Es el mismo problema que hace inviable
// escanear ficheros enteros: `worker.js` incluye la herramienta anti-corrupción de
// Alejandra, que también tiene que contener los patrones corruptos.
//
// La marca es deliberadamente fea y explícita: debe cantar en una revisión. Solo vale
// para código cuyo cometido sea definir o describir estos patrones. Usarla para «callar»
// una corrupción real es exactamente el fallo que este script existe para evitar.
const ESCAPE_AUTO = 'encoding-check-ignore';

const MARCADORES = [
  { re: /Ã[\x80-\xBF‚ƒ„…†‡ˆ‰Š‹ŒŽ''""•–—˜™š›œžŸ¡-ÿ]/, nombre: 'Ã + carácter (á é í ó ú ñ corruptas)' }, // encoding-check-ignore
  { re: /Â[^\w\s]/, nombre: 'Â suelto (¿ © ª corruptas)' },                                             // encoding-check-ignore
  { re: /â€[œ""¦"˜™]/, nombre: 'â€ (comillas o em-dash corruptos)' },                                    // encoding-check-ignore
  { re: /ï»¿/, nombre: 'BOM corrupta' },                                                                 // encoding-check-ignore
];

const args = process.argv.slice(2);
const staged = args.includes('--staged');
const ref = args.find(a => !a.startsWith('--')) || 'origin/main';

let diff;
try {
  diff = staged
    ? execFileSync('git', ['diff', '--staged', '--', '*.html', '*.js'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
    : execFileSync('git', ['diff', `${ref}...HEAD`, '--', '*.html', '*.js'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
} catch (e) {
  console.error(`No se pudo obtener el diff contra "${ref}": ${e.message}`);
  console.error('En CI hace falta fetch-depth: 0 para que la referencia base exista.');
  process.exit(2);
}

const hallazgos = [];
let ficheroActual = '';
for (const linea of diff.split('\n')) {
  if (linea.startsWith('+++ b/')) { ficheroActual = linea.slice(6); continue; }
  if (!linea.startsWith('+') || linea.startsWith('+++')) continue;
  if (linea.includes(ESCAPE_AUTO)) continue;
  for (const m of MARCADORES) {
    if (m.re.test(linea)) {
      hallazgos.push({ fichero: ficheroActual, marcador: m.nombre, linea: linea.slice(1, 120) });
      break;
    }
  }
}

if (!hallazgos.length) {
  console.log('Encoding OK — ninguna línea añadida contiene marcadores de corrupción.');
  process.exit(0);
}

console.error(`CORRUPCIÓN DE ENCODING: ${hallazgos.length} línea(s) añadidas.\n`);
for (const h of hallazgos) {
  console.error(`  ${h.fichero}`);
  console.error(`    ${h.marcador}`);
  console.error(`    ${h.linea}\n`);
}
console.error('NO commitear. Restaurar desde la última versión limpia y reaplicar los cambios');
console.error('a mano; nunca "arreglar" el encoding in-place. Ver CLAUDE.md.');
process.exit(1);
