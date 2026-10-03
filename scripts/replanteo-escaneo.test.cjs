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
  const bucket = new Map(); let etag = 0; let llamadasIA = 0; let pagina = 1000; let listados = 0; let borrados = 0;
  const FILES = {
    async get(k) { const o = bucket.get(k); if (!o) return null; await null; return { etag: o.etag, httpMetadata: o.meta, body: o.body, json: async () => JSON.parse(o.body) }; },
    async put(k, body, opts = {}) {
      await null;
      const cur = bucket.get(k);
      if (opts.onlyIf && opts.onlyIf.etagMatches && (!cur || cur.etag !== opts.onlyIf.etagMatches)) return null;
      const o = { body: typeof body === 'string' ? body : body, etag: 'e' + (++etag), meta: opts.httpMetadata, uploaded: new Date(Date.now()) };
      bucket.set(k, o); return { etag: o.etag };
    },
    // Como el binding real: orden lexicográfico, delimiter, startAfter y paginación por cursor.
    async list({ prefix = '', delimiter, startAfter, cursor, limit } = {}) {
      listados++;
      const tam = Math.min(limit || 1000, pagina);
      let claves = [...bucket.keys()].filter(k => k.startsWith(prefix)).sort();
      if (startAfter) claves = claves.filter(k => k > startAfter);
      const prefijos = new Set();
      if (delimiter) claves = claves.filter(k => { const i = k.indexOf(delimiter, prefix.length); if (i < 0) return true; prefijos.add(k.slice(0, i + 1)); return false; });
      if (cursor) claves = claves.filter(k => k > cursor);   // el cursor real recuerda la posición, no un índice
      const trozo = claves.slice(0, tam);
      const truncated = tam < claves.length;
      return { objects: trozo.map(key => ({ key, uploaded: bucket.get(key).uploaded })), delimitedPrefixes: [...prefijos].sort(), truncated, cursor: truncated ? trozo[trozo.length - 1] : undefined };
    },
    async delete(k) { borrados++; (Array.isArray(k) ? k : [k]).forEach(x => bucket.delete(x)); },
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
  vm.runInContext(src.slice(ini, fin) + '\n;this.__w = { iniciarEscaneoReplanteo, frameEscaneoReplanteo, getEscaneoReplanteo, getEscaneoFrameReplanteo, _escaneoValidarParaReplanteo, _escaneoVincular, _escaneoBorrarDeReplanteo, _escaneoSanearAnalisis, ESCANEO_MAX_IA_SESION, _escaneoCaducidadSesion, _escaneoCaducidadCuota, _escaneoCaducidadPlan, _escaneoIdsEnTrazados, caducarEscaneosReplanteo, ESCANEO_CADUCIDAD_LIMITES };', ctx);
  return { w: ctx.__w, bucket, env: { FILES, ANTHROPIC_API_KEY: 'x' }, ia: () => llamadasIA,
    setPagina: n => { pagina = n; }, cuenta: () => ({ listados, borrados }) };
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

// ── ESCANEO-CADUCIDAD-01: caducidad de 30 días (autorizada por Adrián, 03/10/2026) ───────────
const DIA = 86400000;
const SID = 'a'.repeat(32);
const sesionBase = (extra = {}) => ({ v: 1, id: SID, empresa_id: 7, departamento: 'electrico', creado: new Date(0).toISOString(), frames: [], replanteo_id: null, ...extra });

test('caducidad: política pura de una sesión (ante la duda, no se borra)', () => {
  const { w } = cargarWorker();
  const ahora = Date.UTC(2026, 9, 3, 18);
  const objs = dias => [{ key: `e7/replanteo-escaneo/${SID}/sesion.json`, uploaded: new Date(ahora - dias * DIA) }];
  const D = (o, dias = 31) => w._escaneoCaducidadSesion({ empresaId: 7, sid: SID, sesion: sesionBase(), objetos: objs(dias), vinculadosD1: new Set(), ...o }, ahora);
  assert.equal(D({}, 31).borrar, true, 'sin vincular y 31 días: se borra');
  assert.equal(D({}, 29).borrar, false, 'sin vincular y 29 días: se conserva');
  assert.equal(D({ sesion: sesionBase({ replanteo_id: 55 }) }, 400).motivo, 'vinculada', 'vinculada: nunca, por vieja que sea');
  assert.equal(D({ vinculadosD1: new Set([SID]) }, 400).motivo, 'vinculada_d1', 'mencionada en un trazado_json: nunca');
  assert.equal(D({ vinculadosD1: null }, 400).motivo, 'd1_no_disponible', 'si D1 falla no se borra');
  assert.equal(D({ errorLectura: true, sesion: null }, 400).motivo, 'sesion_ilegible', 'error al leer sesion.json: no se borra');
  assert.equal(D({ sesion: null }, 400).borrar, false, 'sin sesion.json: no se borra');
  assert.equal(D({ sesion: sesionBase({ empresa_id: 8 }) }, 400).borrar, false, 'sesión de otra empresa: no se borra');
  const fresca = sesionBase({ frames: [{ n: 0, ts: new Date(ahora - 2 * DIA).toISOString() }] });
  assert.equal(D({ sesion: fresca }, 40).borrar, false, 'un fotograma reciente dentro de la sesión cuenta como actividad');
});

test('caducidad: contadores _cuota y ids en trazado_json', () => {
  const { w } = cargarWorker();
  const ahora = Date.UTC(2026, 9, 3, 18);
  assert.equal(w._escaneoCaducidadCuota('e7/replanteo-escaneo/_cuota/u11/2026-08-01.json', ahora), true, 'cuota vieja: se borra');
  assert.equal(w._escaneoCaducidadCuota('e7/replanteo-escaneo/_cuota/u11/2026-10-03.json', ahora), false, 'cuota de hoy: no');
  assert.equal(w._escaneoCaducidadCuota('e7/replanteo-escaneo/_cuota/u11/2026-09-04.json', ahora), false, 'cuota de hace 29 días: no');
  assert.equal(w._escaneoCaducidadCuota('e7/replanteo/0/foto.json', ahora), false, 'fuera de _cuota: nunca');
  const ids = w._escaneoIdsEnTrazados([{ trazado_json: JSON.stringify({ escaneo_id: SID, puntos: [] }) }, { trazado_json: 'no es json' }, { trazado_json: null }]);
  assert.ok(ids.has(SID));
});

test('caducidad: el plan respeta el tope de lecturas por ejecución y rota el orden', () => {
  const { w } = cargarWorker();
  const ahora = Date.UTC(2026, 9, 3, 18);
  const viejo = new Date(ahora - 60 * DIA);
  const sids = Array.from({ length: 10 }, (_, i) => i.toString(16).repeat(32));
  const objetos = sids.flatMap(s => [{ key: `e7/replanteo-escaneo/${s}/f0.jpg`, uploaded: viejo }, { key: `e7/replanteo-escaneo/${s}/sesion.json`, uploaded: viejo }]);
  objetos.push({ key: 'e7/replanteo-escaneo/_cuota/u1/2026-01-01.json', uploaded: viejo }, { key: 'e7/replanteo-escaneo/_cuota/u2/2026-01-02.json', uploaded: viejo });
  const p = w._escaneoCaducidadPlan(7, objetos, new Set([sids[0]]), ahora, { lecturas: 3, cuotas: 1 }, 0);
  assert.equal(p.candidatas.length, 3, 'tope de lecturas');
  assert.equal(p.cuotas.length, 1, 'tope de cuotas');
  assert.ok(!p.candidatas.some(c => c.sid === sids[0]), 'los vinculados en D1 ni se leen');
  const otra = w._escaneoCaducidadPlan(7, objetos, new Set(), ahora, { lecturas: 3, cuotas: 1 }, 4);
  assert.notEqual(otra.candidatas[0].sid, w._escaneoCaducidadPlan(7, objetos, new Set(), ahora, { lecturas: 3, cuotas: 1 }, 0).candidatas[0].sid, 'otro día empieza por otra sesión');
  assert.equal(w._escaneoCaducidadPlan(8, objetos, new Set(), ahora, { lecturas: 9, cuotas: 9 }, 0).candidatas.length, 0, 'claves de otra empresa: nunca');
});

test('caducidad: el cron borra solo escaneos sin replanteo de más de 30 días, con una sola escritura en D1', async () => {
  const { w, env, bucket, setPagina } = cargarWorker();
  const realNow = Date.now; let t = Date.UTC(2026, 7, 1, 10); Date.now = () => t;
  try {
    const crear = async () => (await w.iniciarEscaneoReplanteo(req(encargado, {}), env)).data.escaneo_id;
    const frame = sid => w.frameEscaneoReplanteo(req(encargado, { imagen: img, guardar: true, camara: cam }), env, `/replanteos/escaneo/${sid}/frame`);
    const abandonado = await crear(); await frame(abandonado);
    const vinculado = await crear(); await frame(vinculado); await w._escaneoVincular(env, encargado, vinculado, 55);
    const enTrazado = await crear(); await frame(enTrazado);       // replanteo guardado pero sin marcar en sesion.json
    const roto = await crear(); await frame(roto); bucket.get(`e7/replanteo-escaneo/${roto}/sesion.json`).body = '{roto';
    bucket.set('e9/replanteo/0/foto.jpg', { body: 'x', etag: 'z', uploaded: new Date(t) });  // otra carpeta: no se toca
    t += 29 * DIA;
    const reciente = await crear(); await frame(reciente);         // también deja la cuota de "hoy"
    t += 2 * DIA;                                                  // abandonado/vinculado/... con 31 días
    const escrituras = [];
    env.DB = { prepare: sql => ({ bind: (...a) => ({
      all: async () => { assert.match(sql, /^SELECT trazado_json FROM replanteos WHERE empresa_id = \?/); assert.deepEqual(a, [7]); return { results: [{ trazado_json: JSON.stringify({ escaneo_id: enTrazado }) }] }; },
      run: async () => { escrituras.push({ sql, a }); },
    }) }) };
    setPagina(5);                                                  // obliga a paginar
    const res = await w.caducarEscaneosReplanteo(env, t);
    const quedan = sid => [...bucket.keys()].some(k => k.includes(sid));
    assert.equal(quedan(abandonado), false, 'abandonado de 31 días: borrado entero');
    assert.ok(quedan(vinculado) && quedan(enTrazado) && quedan(roto) && quedan(reciente));
    assert.ok(bucket.has(`e7/replanteo-escaneo/${vinculado}/f0.jpg`), 'el fondo del informe sigue ahí');
    assert.ok(bucket.has('e9/replanteo/0/foto.jpg'));
    const cuotas = [...bucket.keys()].filter(k => k.includes('/_cuota/'));
    assert.deepEqual(cuotas.map(k => k.slice(-15)), ['2026-08-30.json'], 'la cuota vieja se borra; la de hace 2 días no');
    assert.equal(res.sesiones_borradas, 1);
    assert.equal(res.conservadas.sesion_ilegible, 1);
    assert.equal(res.conservadas.vinculada, 1);
    assert.equal(escrituras.length, 1, 'una sola escritura en D1 por ejecución');
    assert.match(escrituras[0].sql, /INSERT INTO logs/);
  } finally { Date.now = realNow; }
});

test('caducidad: tope de sesiones por ejecución, sigue la noche siguiente, y sin D1 no borra sesiones', async () => {
  const { w, env, bucket, cuenta } = cargarWorker();
  const realNow = Date.now; let t = Date.UTC(2026, 7, 1, 10); Date.now = () => t;
  try {
    const sids = [];
    for (let i = 0; i < 5; i++) {
      const u = { ...encargado, usuario_id: 100 + i };
      const sid = (await w.iniciarEscaneoReplanteo(req(u, {}), env)).data.escaneo_id; sids.push(sid);
      await w.frameEscaneoReplanteo(req(u, { imagen: img, guardar: true, camara: cam }), env, `/replanteos/escaneo/${sid}/frame`);
    }
    t += 40 * DIA;
    env.DB = { prepare: () => ({ bind: () => ({ all: async () => { throw new Error('D1 caída'); }, run: async () => {} }) }) };
    const sinD1 = await w.caducarEscaneosReplanteo(env, t);
    assert.equal(sinD1.sesiones_borradas, 0, 'sin poder comprobar D1 no se borra ninguna sesión');
    assert.equal(sinD1.cuotas_borradas, 5, 'las cuotas viejas sí (no dependen de replanteos)');
    env.DB = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), run: async () => {} }) }) };
    const lim = { ...w.ESCANEO_CADUCIDAD_LIMITES, sesiones: 2 };
    const antes = cuenta().borrados;
    const r1 = await w.caducarEscaneosReplanteo(env, t, lim);
    assert.equal(r1.sesiones_borradas, 2); assert.equal(r1.limite, true);
    assert.ok(cuenta().borrados - antes <= 3, 'un borrado por sesión (lote de claves), no uno por objeto');
    const r2 = await w.caducarEscaneosReplanteo(env, t + DIA, lim);
    const r3 = await w.caducarEscaneosReplanteo(env, t + 2 * DIA, lim);
    assert.equal(r1.sesiones_borradas + r2.sesiones_borradas + r3.sesiones_borradas, 5);
    assert.equal([...bucket.keys()].filter(k => k.startsWith('e7/')).length, 0);
  } finally { Date.now = realNow; }
});

test('caducidad: con el listado cortado por el tope nunca borra media sesión y acaba cubriéndolo todo', async () => {
  const { w, env, bucket, setPagina } = cargarWorker();
  const realNow = Date.now; let t = Date.UTC(2026, 7, 1, 10); Date.now = () => t;
  try {
    const sids = [];
    for (let i = 0; i < 8; i++) {
      const u = { ...encargado, usuario_id: 200 + i };
      const sid = (await w.iniciarEscaneoReplanteo(req(u, {}), env)).data.escaneo_id; sids.push(sid);
      await w.frameEscaneoReplanteo(req(u, { imagen: img, guardar: true, camara: cam }), env, `/replanteos/escaneo/${sid}/frame`);
    }
    t += 45 * DIA;
    env.DB = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }), run: async () => {} }) }) };
    setPagina(3);
    const lim = { ...w.ESCANEO_CADUCIDAD_LIMITES, paginas: 3 };
    for (let n = 0; n < 60 && [...bucket.keys()].some(k => /\/[a-f0-9]{32}\//.test(k)); n++) {
      await w.caducarEscaneosReplanteo(env, t + n * DIA, lim);
      for (const sid of sids) {
        const k = [...bucket.keys()].filter(x => x.includes(sid));
        assert.ok(k.length === 0 || k.length === 2, 'una sesión está entera o no está');
      }
    }
    assert.equal([...bucket.keys()].filter(k => /\/[a-f0-9]{32}\//.test(k)).length, 0, 'en varias noches se cubren todas');
  } finally { Date.now = realNow; }
});
