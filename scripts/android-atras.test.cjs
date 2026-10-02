const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { resolve } = require('node:path');

// ANDROID-ATRAS-02: ejecuta el código real del botón atrás de index.html (el mismo para el
// evento nativo 'backButton' de la APK y para 'popstate' de la PWA) contra un DOM mínimo.
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const ini = html.indexOf('const _CAPAS_ATRAS_IDS');
const fin = html.indexOf("window.addEventListener('popstate', function() {", ini);
assert.ok(ini > 0 && fin > ini, 'No se encontró el bloque del botón atrás en index.html');
const fuente = html.slice(ini, fin);

function crearEntorno({ sesion, pantalla, historial = [], capas = [], subpaneles = {}, nativo = true }) {
  const estado = { pantalla, sesion: sesion && { ...sesion }, historial: [...historial], log: [], toasts: [] };
  const elementos = {};
  for (const c of capas) {
    elementos[c.id] = {
      id: c.id, isConnected: true, abierta: true, onclickCierra: c.onclickCierra !== false,
      classList: { remove() {} }, style: {},
      hasAttribute(n) { return n === 'onclick' && this.onclickCierra; },
      getAttribute() { return null; },
      dispatchEvent() { this.abierta = false; estado.log.push('cerrar:' + this.id); },
      getClientRects() { return this.abierta ? [1] : []; },
      querySelectorAll() { return []; },
      compareDocumentPosition() { return 4; },
    };
  }
  for (const [id, display] of Object.entries(subpaneles)) elementos[id] = { id, style: { display } };
  const document = {
    querySelector(sel) {
      if (sel === '.screen.active') {
        const nombre = estado.pantalla;
        const id = nombre === 'ia' ? 'screenIA' : 'screen' + nombre.charAt(0).toUpperCase() + nombre.slice(1);
        return { id };
      }
      return null;
    },
    querySelectorAll(sel) { return sel === '.modal-overlay' ? capas.map(c => elementos[c.id]) : []; },
    getElementById(id) { return elementos[id] || null; },
  };
  const ctx = {
    document,
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    MouseEvent: function MouseEvent(tipo) { this.type = tipo; },
    getComputedStyle(el) {
      return { display: el.abierta === false ? 'none' : 'flex', visibility: 'visible', zIndex: '1100' };
    },
    getSession: () => estado.sesion,
    setSession: s => { estado.sesion = s; },
    _esNativo: () => nativo,
    _pendingDept: null,
    _backPressedOnce: false,
    _backPressTimer: null,
    resetearIntentoSalida() { ctx._backPressedOnce = false; },
    _applyScreen: n => { estado.pantalla = n; estado.log.push('pantalla:' + n); },
    irAtras: () => { const n = ctx._navHistory.pop(); estado.pantalla = n; estado.log.push('atras:' + n); },
    setupHomeModules() {}, cargarStatsHome() {}, renderHeader() {},
    segSelTab: t => { estado.log.push('seg:' + t); },
    personalSelTab: n => { estado.log.push('per:' + n); },
    alejandraAbrir() {}, abrirFotoSug() {},
    toast: t => estado.toasts.push(t),
    setTimeout: () => 1, clearTimeout() {},
    history: { back() { estado.log.push('history.back'); } },
    window: { Capacitor: { Plugins: { App: { exitApp() { estado.log.push('exitApp'); } } } } },
  };
  ctx._navHistory = estado.historial;
  runInNewContext(fuente.replace(/^const /gm, 'var ') + '\nthis._manejarBotonAtras = _manejarBotonAtras; this._pantallaSuperiorJerarquia = _pantallaSuperiorJerarquia;', ctx);
  // _navHistory es `let` global en index.html; aquí vive en el contexto para que el bloque lo reasigne.
  return { ctx, estado, atras: () => ctx._manejarBotonAtras() };
}

const SA = { rol: 'superadmin', empresa_id: 3, departamento: 'electrico' };
const EA = { rol: 'empresa_admin', empresa_id: 3, departamento: 'electrico' };
const ENC = { rol: 'encargado', empresa_id: 3, departamento: 'electrico' };

test('superadmin: pantalla → menú depto → selector depto → selector empresa → doble pulsación sale', () => {
  const { estado, atras } = crearEntorno({ sesion: SA, pantalla: 'ajustes' });
  atras(); assert.equal(estado.pantalla, 'home');
  atras(); assert.equal(estado.pantalla, 'dept');
  assert.equal(estado.sesion.departamento, null, 'al subir al selector se suelta el depto');
  atras(); assert.equal(estado.pantalla, 'empresaSel');
  atras(); assert.deepEqual(estado.toasts, ['Pulsa atrás de nuevo para salir']);
  assert.ok(!estado.log.includes('exitApp'));
  atras(); assert.ok(estado.log.includes('exitApp'));
});

test('empresa_admin: la raíz es el selector de departamento', () => {
  const { estado, atras } = crearEntorno({ sesion: EA, pantalla: 'pedidos' });
  atras(); assert.equal(estado.pantalla, 'home');
  atras(); assert.equal(estado.pantalla, 'dept');
  atras(); assert.equal(estado.toasts.length, 1);
  assert.equal(estado.pantalla, 'dept');
});

test('encargado: desde Ajustes vuelve a su menú en vez de salir', () => {
  const { estado, atras } = crearEntorno({ sesion: ENC, pantalla: 'ajustes' });
  atras(); assert.equal(estado.pantalla, 'home');
  assert.equal(estado.toasts.length, 0);
  atras(); assert.equal(estado.toasts.length, 1);
});

test('Seguridad y Personal: su pantalla propia es el menú del depto', () => {
  const seg = crearEntorno({ sesion: { ...ENC, departamento: 'seguridad' }, pantalla: 'ajustes' });
  seg.atras(); assert.equal(seg.estado.pantalla, 'seguridad');
  const per = crearEntorno({ sesion: { ...ENC, departamento: 'personal' }, pantalla: 'personal' });
  per.atras(); assert.equal(per.estado.toasts.length, 1);
});

test('el historial manda fuera de los selectores', () => {
  const { estado, atras } = crearEntorno({ sesion: ENC, pantalla: 'planos', historial: ['home', 'module'] });
  atras(); assert.equal(estado.pantalla, 'module');
  atras(); assert.equal(estado.pantalla, 'home');
});

test('en un selector se sube de nivel aunque haya historial', () => {
  const { estado, atras } = crearEntorno({ sesion: { ...SA, departamento: null }, pantalla: 'dept', historial: ['home', 'module'] });
  atras(); assert.equal(estado.pantalla, 'empresaSel');
});

test('un modal abierto se cierra antes de tocar la pantalla', () => {
  const { estado, atras } = crearEntorno({ sesion: ENC, pantalla: 'incidencias', historial: ['home'], capas: [{ id: 'modalIncidencia' }] });
  atras();
  assert.deepEqual(estado.log, ['cerrar:modalIncidencia']);
  assert.equal(estado.pantalla, 'incidencias');
  atras(); assert.equal(estado.pantalla, 'home');
});

test('un modal sin cierre propio se oculta como último recurso', () => {
  const { ctx, estado, atras } = crearEntorno({ sesion: ENC, pantalla: 'home', capas: [{ id: 'modalCpdInforme', onclickCierra: false }] });
  atras();
  assert.equal(ctx.document.getElementById('modalCpdInforme').style.display, 'none');
  assert.equal(estado.toasts.length, 0);
});

test('subpaneles internos: pestaña de Seguridad y panel de Personal vuelven a su menú', () => {
  const seg = crearEntorno({ sesion: { ...ENC, departamento: 'seguridad' }, pantalla: 'seguridad', subpaneles: { segPanelHome: 'none' } });
  seg.atras(); assert.deepEqual(seg.estado.log, ['seg:home']);
  const per = crearEntorno({ sesion: { ...ENC, departamento: 'personal' }, pantalla: 'personal', subpaneles: { perPanelHome: 'none' } });
  per.atras(); assert.deepEqual(per.estado.log, ['per:-1']);
});

test('sin sesión (login) también pide la doble pulsación en vez de ignorar el atrás', () => {
  const { estado, atras } = crearEntorno({ sesion: null, pantalla: 'home' });
  atras(); assert.equal(estado.toasts.length, 1);
  atras(); assert.ok(estado.log.includes('exitApp'));
});

test('PWA: en la raíz la segunda pulsación deja que el navegador resuelva el atrás', () => {
  const { atras } = crearEntorno({ sesion: ENC, pantalla: 'home', nativo: false });
  assert.equal(atras(), true);
  assert.equal(atras(), false);
});
