#!/usr/bin/env node
// F-0.2 — Catálogo de rutas de los dos Workers.
//
// Extrae de `worker.js` y `alejandra-agente/worker.js` cada ruta enrutada, su método, el
// handler que la atiende y qué comprobación de autorización hace ese handler.
//
// El objetivo NO es documentar por documentar: es que una ruta sin comprobación de
// autorización sea visible de un vistazo, y que añadir una nueva sin ella se note.
// ARC-006 pide catálogo de tools y matriz de permisos; esto es su equivalente HTTP.
//
// Solo lectura. No toca red, ni D1, ni R2.
//
//   node scripts/inventario-rutas.js            → informe legible
//   node scripts/inventario-rutas.js --json     → JSON
//   node scripts/inventario-rutas.js --check    → sale 1 si hay rutas sin autorización
//                                                 no declaradas en la lista de excepciones

const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

// Rutas que legítimamente no exigen sesión. Cada una necesita su motivo: si algo entra
// aquí sin justificación, es exactamente el agujero que este script busca.
const PUBLICAS = {
  '/': 'raíz informativa',
  '/health': 'healthcheck (no comprueba dependencias — ver ARC-008)',
  '/login': 'autenticación',
  '/logout': 'cierre de sesión',
  '/telegram-webhook': 'webhook de Telegram, valida por secreto propio',
  '/setup-telegram-webhook': 'configuración puntual de webhook',
  '/recuperar-password': 'recuperación de contraseña',
  '/reset-password': 'recuperación de contraseña',
  '/auth/google': 'OAuth',
  '/auth/google/callback': 'OAuth',
  '/auth/google/url': 'OAuth — devuelve la URL de consentimiento',
  '/auth/google/mobile-redirect': 'OAuth móvil',
  '/auth/google/check-nonce': 'OAuth — polling del nonce, el nonce es el secreto',
  '/version': 'versión servida',
  '/recuperar-pass': 'recuperación de contraseña',
  '/resetear-pass': 'recuperación de contraseña, el token del email es el secreto',
  '/verificar': 'acceso por código de obra — es el mecanismo de login del operario',
  '/acceso': 'acceso por código de obra',
  '/invitaciones/verificar': 'verificación de invitación antes del alta; el token es el secreto',
  '/empresas/registro': 'alta de empresa nueva',
  '/telegram/webhook': 'webhook de Telegram, valida por secreto propio',
  '/festivos': 'proxy de festivos nacionales (date.nager.at); no expone datos propios',
};

function extraer(archivo, etiqueta) {
  const src = fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
  const lineas = src.split('\n');
  const rutas = [];

  // Formas de enrutado usadas en los dos workers:
  //   if (path === '/x' && method === 'POST') return await handler(...)
  //   if (path.startsWith('/x/')) ...
  const reExacta = /path\s*===\s*'([^']+)'\s*&&\s*(?:method|req\.method)\s*===\s*'([A-Z]+)'/;
  const rePrefijo = /path\.startsWith\('([^']+)'\)/;
  const reHandler = /return\s+await\s+([A-Za-z_$][\w$]*)\s*\(/;

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    let ruta = null, metodo = null;

    const m1 = l.match(reExacta);
    if (m1) { ruta = m1[1]; metodo = m1[2]; }
    else {
      const m2 = l.match(rePrefijo);
      if (m2 && /\bif\s*\(/.test(l)) { ruta = m2[1] + '*'; metodo = '*'; }
    }
    if (!ruta) continue;

    // El handler suele estar en la misma línea; si no, en las 3 siguientes.
    let handler = null;
    for (let k = 0; k < 4 && i + k < lineas.length; k++) {
      const mh = lineas[i + k].match(reHandler);
      if (mh) { handler = mh[1]; break; }
    }
    rutas.push({ worker: etiqueta, ruta, metodo, handler, linea: i + 1 });
  }
  return { src, rutas };
}

// Señales de comprobación de autorización dentro de un fragmento de código.
function señalesEn(cuerpo) {
  const s = [];
  if (/getAuthContext\s*\(/.test(cuerpo)) s.push('getAuthContext');
  if (/getAuth\s*\(/.test(cuerpo)) s.push('getAuth');
  if (/getEmpresaFromRequest\s*\(/.test(cuerpo)) s.push('getEmpresaFromRequest');
  if (/_getAuthPlano\s*\(/.test(cuerpo)) s.push('_getAuthPlano');
  if (/hasRole\s*\(/.test(cuerpo)) s.push('hasRole');
  if (/isSuperadmin|isAdmin|isDev\b|esDevVerificado|requireDev/.test(cuerpo)) s.push('rol');
  if (/ADMIN_TOKEN|adminToken/.test(cuerpo)) s.push('admin-token');
  // SEC-08/SEC-09 endurecieron varios handlers con una consulta directa a `sesiones` en
  // vez de getAuth(). Cuenta como autorización: valida el token y su caducidad.
  if (/FROM sesiones WHERE token\s*=\s*\?/.test(cuerpo)) s.push('sesion-directa');
  return s;
}

// Algunas rutas se protegen INLINE en el router, no dentro del handler (p. ej. /sync-debug
// comprueba isSuperadmin antes de llamar a syncSheetsDebug). Mirar solo el cuerpo del
// handler daba falsos positivos, que es el peor defecto posible en un control de este tipo.
function autorizacionDe(src, nombre, lineasSrc, lineaRuta) {
  const enRouter = señalesEn(lineasSrc.slice(Math.max(0, lineaRuta - 1), lineaRuta + 6).join('\n'));
  if (enRouter.length) return enRouter.join('+') + ' (en router)';

  if (!nombre) return 'desconocida (handler no identificado)';
  const i = src.search(new RegExp(`(async\\s+)?function\\s+${nombre}\\s*\\(`));
  if (i === -1) return 'desconocida (función no encontrada)';

  // Cuerpo aproximado: hasta la siguiente declaración de función de nivel superior.
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(async\s+)?function\s+[A-Za-z_$]/);
  const cuerpo = resto.slice(0, fin === -1 ? 4000 : fin);

  const señales = señalesEn(cuerpo);
  return señales.length ? señales.join('+') : 'NINGUNA';
}

const salida = [];
for (const [archivo, etiqueta] of [['worker.js', 'api'], ['alejandra-agente/worker.js', 'agente']]) {
  const { src, rutas } = extraer(archivo, etiqueta);
  const lineasSrc = src.split('\n');
  for (const r of rutas) salida.push({ ...r, auth: autorizacionDe(src, r.handler, lineasSrc, r.linea) });
}

const sinAuth = salida.filter(r => r.auth === 'NINGUNA' && !PUBLICAS[r.ruta]);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rutas: salida, sinAutorizacion: sinAuth }, null, 2));
} else {
  const porWorker = {};
  for (const r of salida) (porWorker[r.worker] ??= []).push(r);
  for (const [w, rs] of Object.entries(porWorker)) {
    console.log(`\n═══ ${w} — ${rs.length} rutas ═══`);
    const conteo = {};
    for (const r of rs) conteo[r.auth] = (conteo[r.auth] || 0) + 1;
    for (const [a, n] of Object.entries(conteo).sort((x, y) => y[1] - x[1])) {
      console.log(`  ${String(n).padStart(4)}  ${a}`);
    }
  }
  console.log(`\n═══ Rutas sin autorización y no declaradas públicas: ${sinAuth.length} ═══`);
  for (const r of sinAuth) console.log(`  ${r.worker}  ${r.metodo.padEnd(6)} ${r.ruta}  →  ${r.handler || '?'}  (línea ${r.linea})`);
  console.log(`\nTotal: ${salida.length} rutas.`);
}

if (process.argv.includes('--check') && sinAuth.length) {
  console.error(`\nFALLO: ${sinAuth.length} rutas sin comprobación de autorización detectada.`);
  console.error('Si alguna es pública a propósito, declararla en PUBLICAS con su motivo.');
  process.exit(1);
}
