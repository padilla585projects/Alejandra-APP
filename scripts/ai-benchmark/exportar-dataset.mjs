// ADR-0029 — Exportación MANUAL del dataset privado de entrenamiento (solo lectura).
//
// Solo lo ejecuta Adrián, cuando quiera entrenar. Nunca escribe en R2 ni en D1, nunca borra.
//   1. Lista las claves de `dataset-bueno/` con la API REST de Cloudflare (wrangler 4 no tiene
//      `r2 object list`). Necesita un token de API con permiso «Workers R2 Storage: Read» en
//      CF_API_TOKEN (lo crea Adrián, nunca un agente). Alternativa sin token: --claves <fichero>
//      con una clave por línea.
//   2. Descarga cada objeto con `npx wrangler r2 object get <bucket>/<clave> --remote --pipe`
//      (requiere `wrangler login`).
//   3. Une los registros en UN fichero JSONL FUERA del repositorio (por defecto en %TEMP%).
//      Si --salida apunta dentro del repo, se niega: el repo es PÚBLICO.
//
// Uso:
//   node scripts/ai-benchmark/exportar-dataset.mjs --listar
//   node scripts/ai-benchmark/exportar-dataset.mjs [--mes 2026-10] [--empresa 7] [--salida C:\ruta\fuera\del\repo.jsonl]
//   node scripts/ai-benchmark/exportar-dataset.mjs --claves claves.txt
//
// Antes de entrenar: revisa a mano una muestra del JSONL. Al final se avisa de líneas que aún
// parecen llevar un email, teléfono o DNI (la anonimización es automática y no es perfecta).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CUENTA_CLOUDFLARE = 'd65ead2b2967bf68ff3848a36cd7b1b4'; // alejandra-agente/wrangler.toml
export const BUCKET = 'alejandra-app-files';
export const PREFIJO_BUENO = 'dataset-bueno/';
const RAIZ_REPO = fileURLToPath(new URL('../../', import.meta.url));
const MAX_CLAVES = 20000;

export function parsearArgs(argv) {
  const o = { listar: false, mes: null, empresa: null, salida: null, claves: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--listar') o.listar = true;
    else if (a === '--mes') o.mes = argv[++i];
    else if (a === '--empresa') o.empresa = argv[++i];
    else if (a === '--salida') o.salida = argv[++i];
    else if (a === '--claves') o.claves = argv[++i];
    else throw new Error(`Argumento desconocido: ${a}`);
  }
  if (o.mes != null && !/^\d{4}-\d{2}$/.test(o.mes)) throw new Error('--mes debe ser AAAA-MM');
  if (o.empresa != null && !/^[A-Za-z0-9_-]{1,40}$/.test(o.empresa)) throw new Error('--empresa debe ser el id de la empresa');
  return o;
}

// Prefijo de listado según los filtros (la ruta es dataset-bueno/e<empresa>/<aaaa-mm>/…).
export function prefijoListado({ empresa = null, mes = null } = {}) {
  if (empresa == null) return PREFIJO_BUENO;
  return `${PREFIJO_BUENO}e${empresa}/${mes ? mes + '/' : ''}`;
}

// Solo claves del dataset bueno con caracteres seguros (se pasan a un shell en Windows).
export function claveValida(k) {
  return typeof k === 'string' && k.startsWith(PREFIJO_BUENO) && /^[A-Za-z0-9/_.-]{1,300}$/.test(k) && !k.includes('..') && k.endsWith('.json');
}

export function filtrarClaves(claves, { mes = null } = {}) {
  return claves.filter(claveValida).filter(k => !mes || k.split('/')[2] === mes);
}

export function rutaDentroDelRepo(ruta, raiz = RAIZ_REPO) {
  const rel = relative(resolve(raiz), resolve(ruta));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export function salidaPorDefecto(ahora = new Date()) {
  return join(tmpdir(), `dataset-alejandra-${ahora.toISOString().slice(0, 10)}.jsonl`);
}

// Valida un registro y lo deja en una línea. Devuelve null si no tiene la forma esperada.
export function lineaJsonl(texto) {
  let r;
  try { r = JSON.parse(texto); } catch { return null; }
  if (!r || !Array.isArray(r.messages) || r.messages.length < 3 || !Array.isArray(r.tools)) return null;
  return JSON.stringify(r);
}

// Señales de dato personal que se hayan escapado (solo avisa; no modifica nada).
export function posiblesFugas(linea) {
  const s = [];
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(linea)) s.push('email');
  if (/(?<![\w+])(?:(?:\+|00)\s?34[\s.-]?)?[6789](?:[\s.-]?\d){8}(?![\w])/.test(linea)) s.push('telefono');
  if (/\b\d{8}[ -]?[TRWAGMYFPDXBNJZSQVHLCKE]\b/.test(linea)) s.push('dni');
  if (/https?:\/\//i.test(linea)) s.push('url');
  return s;
}

async function listarPorApi(prefijo) {
  const token = process.env.CF_API_TOKEN;
  if (!token) throw new Error('Falta CF_API_TOKEN (token de API con «Workers R2 Storage: Read»; lo crea Adrián). Alternativa: --claves <fichero>.');
  const cuenta = process.env.CF_ACCOUNT_ID || CUENTA_CLOUDFLARE;
  const claves = [];
  let cursor = '';
  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/r2/buckets/${BUCKET}/objects`);
    url.searchParams.set('prefix', prefijo);
    url.searchParams.set('per_page', '1000');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.success === false) throw new Error(`Listado R2 falló (HTTP ${res.status}): ${JSON.stringify(j.errors || j).slice(0, 300)}`);
    for (const o of j.result || []) if (o && o.key) claves.push(o.key);
    cursor = j.result_info?.is_truncated ? j.result_info.cursor : '';
  } while (cursor && claves.length < MAX_CLAVES);
  return claves;
}

function descargar(clave) {
  const r = spawnSync('npx', ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${clave}`, '--remote', '--pipe'], {
    encoding: 'utf8', shell: process.platform === 'win32', cwd: fileURLToPath(new URL('../../alejandra-agente/', import.meta.url)), maxBuffer: 4 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`wrangler r2 object get falló para ${clave}: ${(r.stderr || '').slice(0, 300)}`);
  return r.stdout;
}

async function main() {
  const o = parsearArgs(process.argv.slice(2));
  const claves = o.claves
    ? filtrarClaves(readFileSync(o.claves, 'utf8').split(/\r?\n/).map(s => s.trim()), o)
    : filtrarClaves(await listarPorApi(prefijoListado(o)), o);
  console.log(`${claves.length} registro(s) en ${prefijoListado(o)}${o.mes ? ` (mes ${o.mes})` : ''}`);
  if (o.listar) { for (const k of claves) console.log(`  ${k}`); return; }

  const salida = resolve(o.salida || salidaPorDefecto());
  if (rutaDentroDelRepo(salida)) throw new Error(`La salida ${salida} está dentro del repositorio (PÚBLICO). Usa una ruta fuera, p. ej. ${salidaPorDefecto()}`);

  const lineas = [];
  let invalidas = 0;
  const avisos = {};
  for (const k of claves) {
    const linea = lineaJsonl(descargar(k));
    if (!linea) { invalidas++; continue; }
    for (const f of posiblesFugas(linea)) avisos[f] = (avisos[f] || 0) + 1;
    lineas.push(linea);
  }
  writeFileSync(salida, lineas.join('\n') + (lineas.length ? '\n' : ''), 'utf8');
  console.log(`Escritas ${lineas.length} líneas en ${salida}${invalidas ? ` (${invalidas} objeto(s) con formato inesperado omitidos)` : ''}.`);
  if (Object.keys(avisos).length) console.warn(`⚠ Revisa a mano antes de entrenar, posibles datos sin anonimizar: ${JSON.stringify(avisos)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
