#!/usr/bin/env node
// F-0.2 — Inventario de bindings, secretos y migraciones.
//
// No lee NINGÚN valor real: solo nombres, desde `.env.example`, los `wrangler.toml` y el
// uso de `env.X` en el código. Nunca toca Cloudflare ni la red.
//
// El objetivo no es listar por listar, sino cruzar tres cosas que hoy nadie compara:
//
//   1. Secretos que el código usa pero nadie declara  → un despliegue limpio falla, y
//      falla en runtime, no al desplegar. Es el modo de fallo más caro.
//   2. Secretos declarados que ya no usa nadie        → superficie innecesaria. F-0.2 pide
//      explícitamente "secretos minimizados".
//   3. Bindings usados en código pero no en wrangler  → el Worker arranca y revienta al
//      primer uso.
//
//   node scripts/inventario-entorno.js           → informe
//   node scripts/inventario-entorno.js --check   → sale 1 si falta algo por declarar

const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// Nombres que `env.X` puede tener sin ser secreto: son bindings declarados en wrangler.
const BINDINGS = new Set(['DB', 'FILES', 'API_WEB', 'RATE_LIMIT_KV', 'ASSETS', 'CF_VERSION_METADATA']);

// Referencias en código que no son variables de entorno reales.
const FALSOS = new Set(['env', 'ctx', 'request']);

function declaradosEnEjemplo() {
  const out = new Set();
  for (const l of leer('.env.example').split('\n')) {
    const m = l.match(/^([A-Z][A-Z0-9_]*)=/);
    if (m) out.add(m[1]);
  }
  return out;
}

function usadosEnCodigo(archivo) {
  const src = leer(archivo);
  const out = new Set();
  for (const m of src.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\b/g)) out.add(m[1]);
  return out;
}

function bindingsDe(toml) {
  const src = leer(toml);
  return new Set([...src.matchAll(/^\s*binding\s*=\s*"([^"]+)"/gm)].map(m => m[1]));
}

const declarados = declaradosEnEjemplo();
const workers = [
  { nombre: 'alejandra-app-api', codigo: 'worker.js', toml: 'wrangler.toml' },
  { nombre: 'alejandra-agente', codigo: 'alejandra-agente/worker.js', toml: 'alejandra-agente/wrangler.toml' },
];

let problemas = 0;
const usadosTotal = new Set();

for (const w of workers) {
  const usados = usadosEnCodigo(w.codigo);
  const bindings = bindingsDe(w.toml);
  const secretosUsados = [...usados].filter(v => !BINDINGS.has(v) && !FALSOS.has(v));
  secretosUsados.forEach(s => usadosTotal.add(s));

  console.log(`\n═══ ${w.nombre} ═══`);
  console.log(`  bindings en wrangler: ${[...bindings].join(', ') || '(ninguno)'}`);
  console.log(`  secretos usados en código: ${secretosUsados.length}`);

  const bindingsUsadosSinDeclarar = [...usados].filter(v => BINDINGS.has(v) && !bindings.has(v));
  if (bindingsUsadosSinDeclarar.length) {
    problemas++;
    console.log(`  ⚠ BINDINGS usados en código y NO declarados en ${w.toml}: ${bindingsUsadosSinDeclarar.join(', ')}`);
    console.log('    El Worker desplegaría bien y fallaría al primer uso.');
  }

  const sinDeclarar = secretosUsados.filter(s => !declarados.has(s));
  if (sinDeclarar.length) {
    problemas++;
    console.log(`  ⚠ SECRETOS usados y NO declarados en .env.example: ${sinDeclarar.join(', ')}`);
    console.log('    Un despliegue en una cuenta limpia fallaría en runtime, no al desplegar.');
  }
}

const huerfanos = [...declarados].filter(d => !usadosTotal.has(d)).sort();
console.log(`\n═══ Declarados en .env.example y sin uso en ningún worker: ${huerfanos.length} ═══`);
if (huerfanos.length) {
  for (const h of huerfanos) console.log(`  ${h}`);
  console.log('\n  No es un fallo, pero F-0.2 pide minimizar secretos: cada uno que sobra');
  console.log('  amplía el radio de daño si se filtra. Revisar si son legacy.');
}

// Migraciones: sin manifiesto único, no se puede saber cuáles están aplicadas.
const sqlRaiz = fs.readdirSync(RAIZ).filter(f => f.endsWith('.sql'));
const sqlAgente = fs.readdirSync(path.join(RAIZ, 'alejandra-agente')).filter(f => f.endsWith('.sql'));
console.log(`\n═══ Migraciones versionadas ═══`);
console.log(`  raíz: ${sqlRaiz.length}   agente: ${sqlAgente.length}   total: ${sqlRaiz.length + sqlAgente.length}`);
console.log('  ⚠ No existe manifiesto: el repositorio NO sabe cuáles están aplicadas en D1.');
console.log('    Las del agente van numeradas (001-008); las de raíz no tienen orden.');
console.log('    Registrado como deuda en ARC-011 y ARC-005. Solo D1 puede resolverlo.');

if (process.argv.includes('--check') && problemas) {
  console.error(`\nFALLO: ${problemas} problema(s) de declaración.`);
  process.exit(1);
}
console.log(problemas ? '' : '\nSin secretos ni bindings usados sin declarar.');
