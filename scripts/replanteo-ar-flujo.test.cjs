// Flujo del AR WebXR de la PWA (index.html) con el código REAL, sin móvil: un DOM mínimo, three.js
// y repl3d.js. No sustituye a la prueba en un Android con ARCore (CLAUDE.md, "AR de Replanteo —
// verificar SIEMPRE en un dispositivo real"): comprueba que el pegamento de index.html no lanza
// y hace lo esperado al girar la pantalla, forzar la superficie del tramo, editar cualquier punto,
// elegir líneas en paralelo y perder la sesión inmersiva sin querer.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const THREE = require(resolve(__dirname, '../capacitor/android/app/src/main/assets/ar/three.min.js'));

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
function bloque(desde, hasta) {
  const ini = html.indexOf(desde), fin = html.indexOf(hasta, ini);
  assert.ok(ini > 0 && fin > ini, 'bloque presente en index.html: ' + desde);
  return html.slice(ini, fin + hasta.length);
}
const ayudas = bloque('const _REPL_HUECOS_M', 'window.replCambiarParalelos = replCambiarParalelos; window.replToggleTramoDiagonal = replToggleTramoDiagonal;');
const ar = bloque('let _ar = null;', 'window._replArActualizarMod = _replArActualizarMod;');

function entorno() {
  const els = {}, log = [], toasts = [];
  const el = id => (els[id] = els[id] || { id, style: { display: 'none' }, value: '', innerHTML: '', textContent: '', disabled: false,
    addEventListener() {}, removeEventListener() {}, getContext: () => null });
  const window = { innerWidth: 800, innerHeight: 360, addEventListener(n, f) { (window._ev[n] = window._ev[n] || []).push(f); },
    removeEventListener(n, f) { window._ev[n] = (window._ev[n] || []).filter(x => x !== f); }, _ev: {} };
  const ctx = vm.createContext({
    THREE, console, window, Math, JSON, Promise, setTimeout, Map,
    document: { getElementById: el, createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {}, measureText: () => ({ width: 10 }) }) }) },
    screen: { orientation: { type: 'landscape-primary', lock: () => Promise.resolve(), unlock() { log.push('unlock'); }, addEventListener() {}, removeEventListener() {} } },
    performance: { now: () => 1000 }, toast: m => toasts.push(m), _replLog: m => log.push(m),
    _escHtml: s => String(s), apiCall: async () => ({ ok: false, json: async () => ({}) }), getSession: () => null,
    _replCatalogo: [], _replCatalogoDept: 'electrico',
  });
  vm.runInContext(readFileSync(resolve(__dirname, '../repl3d.js'), 'utf8'), ctx);
  vm.runInContext(ayudas + '\n' + ar, ctx);
  return { ctx, els, el, log, toasts, run: s => vm.runInContext(s, ctx) };
}

// Sesión AR simulada ya en fase de marcado: cámara a 1,5 m mirando a una pared en z = -3, techo
// detectado a 2,5 m y una instalación existente (vista por la IA) colgando 40 cm bajo el techo.
function sesion(e, { rt } = {}) {
  e.ctx.__rt = rt || { width: 1080, height: 2340, viewport: new THREE.Vector4(), scissor: new THREE.Vector4(), texture: { image: {} } };
  e.ctx.__capa = { framebufferWidth: 1080, framebufferHeight: 2340 };
  e.run(`_ar = { THREE, grupo: new THREE.Group(), grupoIA: new THREE.Group(), puntos: [], normales: [], metodos: [], obstaculos: [], complementos: [],
    diagonales: [], supPunto: [], superficieForzada: 'auto', planoFijo: null, paralelos: null, sel: -1, color: '#f97316', anchoM: 0.025,
    elemento: { key: 'tubo_rigido' }, params: { diametro_mm: 25 }, capturas: [], fotosDoc: [],
    escaneo: { fase: 'marcado', instalaciones: [{ pos: new THREE.Vector3(0.6, 2.1, -1.5), radio: 0.3, etiqueta: 'Bandeja existente', tipo: 'bandeja' }], votos: {} },
    superficies: [{ tipo: 'techo', pos: new THREE.Vector3(0, 2.5, -1.5), normal: new THREE.Vector3(0, -1, 0), y: 2.5 },
                  { tipo: 'pared', pos: new THREE.Vector3(0, 1.2, -3), normal: new THREE.Vector3(0, 0, 1), y: 1.2 }],
    camPos: new THREE.Vector3(0, 1.5, 0), camDir: new THREE.Vector3(0, 0.5, -1).normalize(), hit: null, depthPos: null, planoHit: null,
    renderer: { getRenderTarget: () => __rt, xr: { getBaseLayer: () => __capa, getReferenceSpace: () => 'ref' } },
    session: { end: () => Promise.resolve() } };`);
}

test('girar la pantalla reajusta el búfer XR sin liberarlo ni perder los puntos', () => {
  const e = entorno();
  sesion(e);
  e.run(`_ar.puntos.push(new THREE.Vector3(0, 1, -3)); _ar.normales.push(new THREE.Vector3(0, 0, 1)); _ar.metodos.push('hit'); _ar.diagonales.push(false); _ar.supPunto.push(null);`);
  const rt = e.ctx.__rt;
  e.run('_replArAjustarTamano()');
  assert.equal(rt.width, 1080);
  e.ctx.__capa.framebufferWidth = 2340; e.ctx.__capa.framebufferHeight = 1080;   // Chrome redimensiona al girar
  e.run('_replArAlGirar(); _replArAjustarTamano()');
  assert.deepEqual([rt.width, rt.height, rt.viewport.z, rt.viewport.w, rt.texture.image.width], [2340, 1080, 2340, 1080, 2340]);
  assert.equal(e.run('_ar.puntos.length'), 1, 'los puntos siguen ahí');
  assert.ok(e.log.some(l => /búfer XR 1080x2340 -> 2340x1080/.test(l)));
});

test('superficie forzada a techo: la profundidad sobre una instalación existente no baja el punto', () => {
  const e = entorno();
  sesion(e);
  e.el('replArSuperficie').value = 'techo';
  e.run('replArCambiarSuperficie()');
  // La profundidad de este fotograma da la bandeja existente, 40 cm por debajo del techo.
  e.run(`_ar.depthPos = new THREE.Vector3(0.3, 2.1, -1.2);`);
  e.run('replArPunto()');
  const p1 = e.run('_ar.puntos[0]');
  assert.ok(Math.abs(p1.y - 2.5) < 1e-9, 'pegado al techo detectado: ' + p1.y);
  assert.equal(e.run('_ar.planoFijo.tipo'), 'techo');
  assert.deepEqual(e.run('_ar.normales[0].toArray()').map(x => +x.toFixed(6) + 0), [0, -1, 0]);
  // Siguiente punto: ni hit ni profundidad. Basta el rayo central sobre el plano ya fijado.
  e.run(`_ar.depthPos = null; _ar.camDir = new THREE.Vector3(1, 0.6, -1).normalize();`);
  e.run('replArPunto()');
  assert.equal(e.run('_ar.puntos.length'), 2);
  assert.ok(Math.abs(e.run('_ar.puntos[1].y') - 2.5) < 1e-9);
  assert.equal(e.run('_ar.metodos[1]'), 'forzado');
  assert.equal(e.els.replArSupChip.textContent, '🔒 techo fijado');
  // Cambiar la superficie empieza un tramo nuevo: el plano se suelta.
  e.el('replArSuperficie').value = 'auto';
  e.run('replArCambiarSuperficie()');
  assert.equal(e.run('_ar.planoFijo'), null);
});

test('editar CUALQUIER punto: pegar a techo, esquivar la instalación, diagonal y borrar', () => {
  const e = entorno();
  sesion(e);
  e.run(`[[0, 1, -3, 0, 0, 1], [0.05, 2.1, -2, 0, -1, 0], [1.2, 2.5, -2, 0, -1, 0]].forEach(([x, y, z, a, b, c]) => {
    _ar.puntos.push(new THREE.Vector3(x, y, z)); _ar.normales.push(new THREE.Vector3(a, b, c)); _ar.metodos.push('depth'); _ar.diagonales.push(false); _ar.supPunto.push(null); });`);
  const L0 = e.run('_replArLongitud()');
  e.run('replArPuntoSel(1)');
  assert.equal(e.els.replArPanelPunto.style.display, 'flex');
  assert.match(e.els.replArPuntoTitulo.textContent, /Punto 2 de 3/);
  e.run(`replArPuntoAccion('techo')`);
  assert.ok(Math.abs(e.run('_ar.puntos[1].y') - 2.5) < 1e-9, 'el punto que había caído 40 cm sube al techo');
  assert.match(e.els.replArEstado.textContent, /pegado al techo \(se ha movido 40 cm\)/);
  const L1 = e.run('_replArLongitud()');
  // Sube 1,5 m por la pared y 1 m por el techo (los 5 cm de lado se enderezan) y sigue 1,2 m por el
  // techo hasta el punto final marcado, que se respeta.
  assert.ok(Math.abs(L1 - (1.5 + 1 + 1.2)) < 1e-6, 'recorrido rectificado: ' + L1);
  assert.notEqual(L0, L1);
  e.run(`_ar.puntos[2].set(0.6, 2.5, -1.4)`);       // dentro de la instalación existente
  e.run('replArPuntoSel(2)');
  e.run(`replArPuntoAccion('esquivar')`);
  const p2 = e.run('_ar.puntos[2]');
  assert.ok(Math.abs(p2.y - 2.5) < 1e-9 && p2.distanceTo(new THREE.Vector3(0.6, 2.1, -1.5)) >= 0.35 - 1e-6);
  e.run('replArPuntoSel(0)');
  e.run(`replArPuntoAccion('diagonal')`);
  assert.equal(e.run('_ar.diagonales[0]'), true);
  assert.match(e.els.btnReplArPuntoDiag.textContent, /diagonal/);
  e.run(`replArPuntoAccion('borrar')`);
  assert.equal(e.run('_ar.puntos.length'), 2);
  assert.equal(e.run('_ar.diagonales.length'), 2);
  e.run('replArPuntoCerrar()');
  assert.equal(e.els.replArPanelPunto.style.display, 'none');
});

test('líneas en paralelo dentro del AR, y un toque en pantalla elige el punto tocado', () => {
  const e = entorno();
  sesion(e);
  e.run(`_ar.puntos.push(new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 2.5, -2)); _ar.normales.push(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0));
    _ar.metodos.push('hit', 'hit'); _ar.diagonales.push(false, false); _ar.supPunto.push(null, null);`);
  e.run('_replArLlenarTrazado()');
  assert.match(e.els.replArParalelos.innerHTML, /4 en paralelo/);
  e.el('replArParalelos').value = '4'; e.el('replArHueco').value = '0.02';
  e.run('replArCambiarParalelos()');
  assert.deepEqual(JSON.parse(JSON.stringify(e.run('_ar.paralelos'))), { n: 4, hueco_m: 0.02 });
  const inst = e.run('_ar.grupo.children').find(c => c.userData && c.userData.trazado);
  assert.equal(inst.userData.trazado.lineas, 4);
  const pose = { transform: { position: { x: 0, y: 1.5, z: 0 }, orientation: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, -2).normalize()) } };
  e.ctx.__ev = { frame: { getPose: () => pose }, inputSource: { targetRaySpace: {} } };
  e.run('_replArSelect(__ev)');
  assert.equal(e.run('_ar.sel'), 1, 'el toque apuntaba al punto del techo');
});

test('si la sesión inmersiva se cierra sola con un recorrido marcado, no se pierde el trabajo', () => {
  const e = entorno();
  sesion(e);
  e.run(`_ar.puntos.push(new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 2.5, -2)); _ar.normales.push(null, null); _ar.metodos.push('hit', 'hit'); _ar.diagonales.push(false, false); _ar.supPunto.push(null, null);`);
  e.run('_replArFinSesion()');
  assert.ok(e.toasts.some(t => /se conserva el trazado/.test(t)));
  assert.equal(e.run('_ar && _ar.sesionTerminada'), true, 'entra en replArTerminar sin volver a cerrar la sesión');
  // Un cierre pedido por el usuario no dispara el rescate.
  const e2 = entorno();
  sesion(e2);
  e2.run(`_ar.puntos.push(new THREE.Vector3(0, 1, -3), new THREE.Vector3(0, 2.5, -2)); _ar.cerrando = true;`);
  e2.run('_replArFinSesion()');
  assert.equal(e2.run('_ar'), null);
  assert.ok(e2.log.includes('unlock'), 'al salir del AR la orientación vuelve a la del manifest');
});
