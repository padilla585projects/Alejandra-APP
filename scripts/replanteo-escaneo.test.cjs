// ADR-0027 — Escaneo del entorno + IA de visión del AR del Replanteo.
// Prueba las funciones REALES de producción: la geometría compartida de repl3d.js (PWA, APK e
// informes) y los endpoints de worker.js con un R2 simulado que respeta las escrituras
// condicionales por etag (el límite de coste lo aplica el servidor, también ante ráfagas).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const THREE = require(resolve(__dirname, '../capacitor/android/app/src/main/assets/ar/three.min.js'));

// ── repl3d.js ──────────────────────────────────────────────────────────────────────────────
const repl = vm.createContext({ THREE, console });
vm.runInContext(readFileSync(resolve(__dirname, '../repl3d.js'), 'utf8'), repl);
const R = name => vm.runInContext(name, repl);

// Cámara en (0, 1.5, 0) mirando a -Z (hacia una pared en z = -3), 60° de campo, 4:3.
function camara(pos = [0, 1.5, 0], yaw = 0) {
  const pose = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
  const proj = new THREE.PerspectiveCamera(60, 4 / 3, 0.05, 50).projectionMatrix;
  return { pose: pose.toArray(), proj: proj.toArray(), w: 768, h: 576 };
}
const pared = { pos: new THREE.Vector3(0, 1.5, -3), normal: new THREE.Vector3(0, 0, 1) };

test('proyectar y desproyectar con la cámara del fotograma son inversos', () => {
  const cam = camara();
  const p = new THREE.Vector3(0.4, 1.9, -3);
  const q = R('_replEscaneoProyectar')(THREE, cam, p);
  assert.ok(q && q.u > 0.5 && q.v < 0.5, 'arriba a la derecha del centro de la imagen');
  assert.ok(Math.abs(q.dist - 3) < 1e-6);
  const rayo = R('_replEscaneoRayo')(THREE, cam, q.u, q.v);
  const corte = R('_replEscaneoCortarPlanos')(rayo, [pared], 8);
  assert.ok(corte && corte.pos.distanceTo(p) < 1e-4, 'el rayo vuelve al mismo punto de la pared');
  assert.equal(R('_replEscaneoProyectar')(THREE, cam, new THREE.Vector3(0, 1.5, 2)), null, 'detrás de la cámara no se proyecta');
});

test('la IA sitúa en 3D una instalación existente sobre la pared y avisa al marcar encima', () => {
  const cam = camara();
  const analisis = { instalaciones: [{ tipo: 'bandeja', etiqueta: 'Bandeja existente', bbox: [0.45, 0.3, 0.55, 0.36], confianza: 0.9 },
                                     { tipo: 'tubo', etiqueta: 'dudoso', bbox: [0.1, 0.1, 0.2, 0.2], confianza: 0.2 }] };
  const ubic = R('_replEscaneoUbicar')(THREE, analisis, cam, [pared], 0);
  assert.equal(ubic.length, 1, 'la de baja confianza no se sitúa');
  assert.ok(Math.abs(ubic[0].pos.z + 3) < 1e-4 && ubic[0].sobrePlano);
  assert.ok(ubic[0].radio >= 0.12 && ubic[0].radio <= 1.2);
  const lista = R('_replEscaneoFusionar')([], ubic);
  const otra = R('_replEscaneoFusionar')(lista, ubic);
  assert.equal(otra.length, 1, 'la misma instalación vista dos veces no se duplica');
  assert.equal(otra[0].veces, 2);
  assert.ok(R('_replEscaneoCercana')(otra, ubic[0].pos.clone().add(new THREE.Vector3(0.1, 0, 0))));
  assert.equal(R('_replEscaneoCercana')(otra, new THREE.Vector3(2.5, 0.2, -3)), null);
});

test('el escaneo se da por suficiente con IA, sin IA, y nunca bloquea a quien no tiene planos', () => {
  const S = R('_replEscaneoSuficiente');
  assert.equal(S({ planos: 0, framesIA: 0, iaActiva: true, segundos: 2 }).ok, false);
  assert.equal(S({ planos: 1, framesIA: 3, iaActiva: true, segundos: 9 }).ok, true);
  assert.equal(S({ planos: 0, framesIA: 5, iaActiva: true, segundos: 15 }).ok, true, 'pared lisa: la IA ya ve la sala');
  assert.equal(S({ planos: 1, framesIA: 0, iaActiva: false }).ok, false);
  assert.equal(S({ planos: 2, framesIA: 0, iaActiva: false }).ok, true);
});

test('la IA corrige suelo/techo y descarta muebles, pero no convierte una pared en suelo', () => {
  const C = R('_replEscaneoClasePlano');
  assert.equal(C('suelo', { techo: 3, suelo: 1 }), 'techo');
  assert.equal(C('suelo', { mueble: 3, suelo: 1 }), 'mueble');
  assert.equal(C('pared', { suelo: 4 }), 'pared');
  assert.equal(C('techo', undefined), 'techo');
});

test('el informe elige el fotograma que ve el recorrido, no uno que mira a otro lado', () => {
  const puntos = [new THREE.Vector3(-0.5, 2.2, -3), new THREE.Vector3(0.6, 2.2, -3)];
  const frames = [{ n: 0, camara: camara([0, 1.5, 0], Math.PI) }, { n: 1, camara: camara() }, { n: 2, camara: camara([0, 1.5, 0], Math.PI / 2) }];
  const m = R('_replEscaneoMejorFrame')(THREE, frames, puntos);
  assert.equal(m.frame.n, 1);
  assert.equal(m.visibles, 2);
  assert.equal(R('_replEscaneoMejorFrame')(THREE, [{ n: 0 }], puntos), null, 'sin matrices no hay fotograma válido');
});

// ── overlay del APK ────────────────────────────────────────────────────────────────────────
test('el overlay nativo pinta y libera las etiquetas de la IA', () => {
  const assets = resolve(__dirname, '../capacitor/android/app/src/main/assets/ar');
  const canvas2d = { fillRect() {}, fillText() {}, set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {} };
  const document = { getElementById: () => ({ style: {} }), createElement: () => ({ width: 0, height: 0, getContext: () => canvas2d }) };
  const window = { innerWidth: 360, innerHeight: 720, devicePixelRatio: 2, addEventListener() {} };
  let escena = null;
  const T = { ...THREE, WebGLRenderer: class { setPixelRatio() {} setClearColor() {} setSize() {} render(s) { escena = s; } } };
  const ctx = vm.createContext({ THREE: T, window, document, console });
  vm.runInContext(readFileSync(resolve(assets, 'repl3d.js'), 'utf8'), ctx);
  vm.runInContext(readFileSync(resolve(assets, 'overlay.html'), 'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1], ctx);
  window.actualizarCamara(new THREE.Matrix4().toArray(), new THREE.PerspectiveCamera().projectionMatrix.toArray());
  const datos = JSON.stringify({ instalaciones: [{ x: 0, y: 2, z: -3, radio: 0.3, etiqueta: 'Bandeja' }], planos: [{ x: 0, y: 1, z: -3, texto: 'Pared' }] });
  window.actualizarEscaneoIA(datos);
  const grupo = escena.children.filter(c => c.type === 'Group')[2];
  assert.equal(grupo.children.length, 3, 'etiqueta de plano + esfera + etiqueta de instalación');
  let liberadas = 0;
  grupo.children.forEach(o => { o.geometry && o.geometry.addEventListener('dispose', () => liberadas++); });
  window.actualizarEscaneoIA(datos);
  assert.ok(liberadas >= 1);
  assert.equal(grupo.children.length, 3);
  window.actualizarEscaneoIA('no es json');
});

// ── worker.js: endpoints con R2 simulado ───────────────────────────────────────────────────
function cargarWorker() {
  const src = readFileSync(resolve(__dirname, '../worker.js'), 'utf8');
  const ini = src.indexOf('const ESCANEO_IA_MODELO');
  const fin = src.indexOf('async function enviarReplanteoAPedidos');
  assert.ok(ini > 0 && fin > ini, 'bloque ADR-0027 presente en worker.js');
  const bucket = new Map(); let etag = 0; let llamadasIA = 0;
  const FILES = {
    async get(k) { const o = bucket.get(k); if (!o) return null; await null; return { etag: o.etag, httpMetadata: o.meta, body: o.body, json: async () => JSON.parse(o.body) }; },
    async put(k, body, opts = {}) {
      await null;
      const cur = bucket.get(k);
      if (opts.onlyIf && opts.onlyIf.etagMatches && (!cur || cur.etag !== opts.onlyIf.etagMatches)) return null;
      const o = { body: typeof body === 'string' ? body : body, etag: 'e' + (++etag), meta: opts.httpMetadata };
      bucket.set(k, o); return { etag: o.etag };
    },
    async list({ prefix }) { return { objects: [...bucket.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }; },
    async delete(k) { bucket.delete(k); },
  };
  const json = (data, status = 200) => ({ status, data });
  const err = (msg, status = 400) => ({ status, data: { ok: false, error: msg } });
  const fetch = async () => { llamadasIA++; return { ok: true, status: 200, json: async () => ({ content: [{ type: 'tool_use', name: 'clasificar_entorno',
    input: { superficies: [{ id: 'P1', clase: 'techo', confianza: 0.9 }, { id: 'P99', clase: 'techo' }], instalaciones: [{ tipo: 'bandeja', etiqueta: '<b>Bandeja</b>', bbox: [0.2, 0.2, 0.4, 0.3], confianza: 0.8 }], calidad: 'buena', resumen: 'Techo con bandeja' } }] }) }; };
  const ctx = vm.createContext({
    console, JSON, Date, Math, Number, String, Array, Set, Object, Uint8Array, atob, crypto: require('node:crypto').webcrypto, AbortSignal,
    fetch, json, err, CORS: {}, Response: class { constructor(b, o) { this.body = b; this.headers = o.headers; this.status = 200; } },
    getAuth: async req => req.auth, puedeEditarReplanteo: a => a.rol !== 'operario', puedeVerReplanteo: a => a.rol !== 'operario',
    isDeptPrivileged: a => a.rol === 'superadmin', _replanteoDeptDe: (a, d) => (a.rol === 'superadmin' && d) ? d : a.departamento,
  });
  vm.runInContext(src.slice(ini, fin) + '\n;this.__w = { iniciarEscaneoReplanteo, frameEscaneoReplanteo, getEscaneoReplanteo, getEscaneoFrameReplanteo, _escaneoValidarParaReplanteo, _escaneoVincular, _escaneoBorrarDeReplanteo, _escaneoSanearAnalisis, ESCANEO_MAX_IA_SESION };', ctx);
  return { w: ctx.__w, bucket, env: { FILES, ANTHROPIC_API_KEY: 'x' }, ia: () => llamadasIA };
}
const encargado = { empresa_id: 7, usuario_id: 11, rol: 'encargado', departamento: 'electrico', nombre: 'Ana' };
const req = (auth, body) => ({ auth, json: async () => body });
const img = 'data:image/jpeg;base64,' + Buffer.from('jpeg-falso').toString('base64');
const cam = camara();

test('la IA está acotada en el servidor: 40 por sesión, ni siquiera con ráfagas en paralelo', async () => {
  const { w, env, ia } = cargarWorker();
  const s = await w.iniciarEscaneoReplanteo(req(encargado, { plataforma: 'webxr' }), env);
  assert.equal(s.status, 201);
  const sid = s.data.escaneo_id;
  const ruta = `/replanteos/escaneo/${sid}/frame`;
  const realNow = Date.now; let t = 1e12; Date.now = () => t;
  try {
    // ráfaga simultánea: solo una entra (intervalo mínimo de 2,5 s entre análisis)
    const rafaga = await Promise.all(Array.from({ length: 8 }, () => w.frameEscaneoReplanteo(req(encargado, { imagen: img, analizar: true, planos: [{ id: 'P1', tipo: 'suelo' }] }), env, ruta)));
    assert.equal(rafaga.filter(r => r.data.analisis).length, 1);
    assert.equal(ia(), 1);
    const primero = rafaga.find(r => r.data.analisis).data.analisis;
    assert.deepEqual(primero.superficies.map(x => x.id), ['P1'], 'ids de plano que no se enviaron se descartan');
    assert.equal(primero.instalaciones[0].etiqueta.includes('<'), false, 'texto de la IA saneado');
    for (let i = 0; i < 60; i++) { t += 3000; await w.frameEscaneoReplanteo(req(encargado, { imagen: img, analizar: true }), env, ruta); }
    assert.equal(ia(), w.ESCANEO_MAX_IA_SESION);
    t += 3000;
    const extra = await w.frameEscaneoReplanteo(req(encargado, { imagen: img, analizar: true, guardar: true, camara: cam }), env, ruta);
    assert.equal(extra.data.analisis, null);
    assert.match(extra.data.motivo_sin_ia, /limite_sesion/);
    assert.equal(extra.data.guardado, 0, 'sin IA se siguen guardando fotogramas clave para el informe');
  } finally { Date.now = realNow; }
});

test('los fotogramas clave quedan en R2 de la empresa con su cámara, y con tope', async () => {
  const { w, env, bucket } = cargarWorker();
  const sid = (await w.iniciarEscaneoReplanteo(req(encargado, {}), env)).data.escaneo_id;
  const ruta = `/replanteos/escaneo/${sid}/frame`;
  for (let i = 0; i < 20; i++) await w.frameEscaneoReplanteo(req(encargado, { imagen: img, guardar: true, camara: cam }), env, ruta);
  const fin = await w.frameEscaneoReplanteo(req(encargado, { imagen: img, guardar: true, fase: 'final', camara: cam }), env, ruta);
  assert.equal(fin.data.guardado, 16, 'el final cabe aunque los normales estén llenos');
  const meta = await w.getEscaneoReplanteo(req(encargado), env, `/replanteos/escaneo/${sid}`);
  assert.equal(meta.data.escaneo.frames.length, 17);
  assert.deepEqual(meta.data.escaneo.frames[0].camara.pose.map(v => Math.round(v * 1e3) / 1e3), cam.pose.map(v => Math.round(v * 1e3) / 1e3));
  assert.ok([...bucket.keys()].every(k => k.startsWith('e7/replanteo-escaneo/')), 'todo bajo el prefijo de la empresa');
  const sinCamara = await w.frameEscaneoReplanteo(req(encargado, { imagen: img, guardar: true, camara: { pose: [1, 2], proj: [] } }), env, ruta);
  assert.equal(sinCamara.data.guardado, null, 'sin matrices válidas no se guarda como fotograma clave');
});

test('aislamiento: otra empresa, otro departamento u otro usuario no ven ni escriben el escaneo', async () => {
  const { w, env } = cargarWorker();
  const sid = (await w.iniciarEscaneoReplanteo(req(encargado, {}), env)).data.escaneo_id;
  await w.frameEscaneoReplanteo(req(encargado, { imagen: img, guardar: true, camara: cam }), env, `/replanteos/escaneo/${sid}/frame`);
  const otraEmpresa = { ...encargado, empresa_id: 8 };
  const otroDept = { ...encargado, departamento: 'mecanicas' };
  const otroUsuario = { ...encargado, usuario_id: 12 };
  assert.equal((await w.getEscaneoReplanteo(req(otraEmpresa), env, `/replanteos/escaneo/${sid}`)).status, 404);
  assert.equal((await w.getEscaneoReplanteo(req(otroDept), env, `/replanteos/escaneo/${sid}`)).status, 404);
  assert.equal((await w.getEscaneoFrameReplanteo(req(otraEmpresa), env, `/replanteos/escaneo/${sid}/frame/0`)).status, 404);
  assert.equal((await w.getEscaneoFrameReplanteo(req(encargado), env, `/replanteos/escaneo/${sid}/frame/0`)).status, 200);
  assert.equal((await w.frameEscaneoReplanteo(req(otroUsuario, { imagen: img }), env, `/replanteos/escaneo/${sid}/frame`)).status, 403);
  assert.equal((await w.getEscaneoReplanteo(req(otroUsuario), env, `/replanteos/escaneo/${sid}`)).status, 200, 'un compañero del mismo departamento sí ve el informe');
  assert.equal(await w._escaneoValidarParaReplanteo(env, otroDept, sid, 'mecanicas'), null);
  assert.equal(await w._escaneoValidarParaReplanteo(env, encargado, sid, 'electrico'), sid);
});

test('un escaneo se vincula a un solo replanteo, queda cerrado y se borra con él', async () => {
  const { w, env, bucket } = cargarWorker();
  const sid = (await w.iniciarEscaneoReplanteo(req(encargado, {}), env)).data.escaneo_id;
  const ruta = `/replanteos/escaneo/${sid}/frame`;
  await w.frameEscaneoReplanteo(req(encargado, { imagen: img, guardar: true, camara: cam }), env, ruta);
  await w._escaneoVincular(env, encargado, sid, 55);
  assert.equal(await w._escaneoValidarParaReplanteo(env, encargado, sid, 'electrico'), null, 'no se reutiliza en otro replanteo');
  assert.equal((await w.frameEscaneoReplanteo(req(encargado, { imagen: img }), env, ruta)).status, 409);
  await w._escaneoBorrarDeReplanteo(env, 7, sid, 99);
  assert.ok(bucket.size > 1, 'borrar OTRO replanteo no toca este escaneo');
  await w._escaneoBorrarDeReplanteo(env, 7, sid, 55);
  assert.equal([...bucket.keys()].filter(k => k.includes(sid)).length, 0);
});

test('límite diario de escaneos por usuario', async () => {
  const { w, env } = cargarWorker();
  let ultimo;
  for (let i = 0; i < 13; i++) ultimo = await w.iniciarEscaneoReplanteo(req(encargado, {}), env);
  assert.equal(ultimo.status, 429);
  assert.equal((await w.iniciarEscaneoReplanteo(req({ ...encargado, usuario_id: 99 }, {}), env)).status, 201, 'el límite es por usuario');
  assert.equal((await w.iniciarEscaneoReplanteo(req({ ...encargado, rol: 'operario' }, {}), env)).status, 403);
});
