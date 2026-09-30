const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const assets = resolve(__dirname, '../capacitor/android/app/src/main/assets/ar');
const three = require(resolve(assets, 'three.min.js'));

test('el APK conserva exactamente la geometría y materiales actuales de la PWA', () => {
  assert.equal(readFileSync(resolve(assets, 'repl3d.js'), 'utf8'),
    readFileSync(resolve(__dirname, '../repl3d.js'), 'utf8'));
});

function overlay() {
  const events = {}, renders = [];
  const window = { innerWidth: 360, innerHeight: 720, devicePixelRatio: 4,
    addEventListener: (name, callback) => { events[name] = callback; } };
  const THREE = { ...three, WebGLRenderer: class {
    setPixelRatio() {} setClearColor() {} setSize() {}
    render(scene, camera) { renders.push({ scene, camera }); }
  } };
  const ctx = vm.createContext({ THREE, window, document: { getElementById: () => ({}) }, console });
  vm.runInContext(readFileSync(resolve(assets, 'repl3d.js'), 'utf8'), ctx);
  const html = readFileSync(resolve(assets, 'overlay.html'), 'utf8');
  const inline = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(inline, 'El overlay tiene que incluir su script real');
  vm.runInContext(inline[1], ctx);
  const view = new three.Matrix4().toArray();
  const projection = new three.PerspectiveCamera(65, 0.5, 0.1, 100).projectionMatrix.toArray();
  window.actualizarCamara(view, projection);
  return { window, events, scene: renders.at(-1).scene, camera: renders.at(-1).camera, ctx, projection };
}
function recursos(group) {
  const geometries = new Set(), materials = new Set();
  group.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
  });
  let geometriesDisposed = 0, materialsDisposed = 0;
  geometries.forEach(g => g.addEventListener('dispose', () => geometriesDisposed++));
  materials.forEach(m => m.addEventListener('dispose', () => materialsDisposed++));
  return () => ({ geometries: geometries.size, materials: materials.size, geometriesDisposed, materialsDisposed });
}
const path = JSON.stringify([
  { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
  { x: 0.001, y: 1, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
]);

test('rotar el canvas conserva la proyección real recibida de ARCore', () => {
  const o = overlay();
  o.window.innerWidth = 720; o.window.innerHeight = 360;
  o.events.resize();
  assert.deepEqual(o.camera.projectionMatrix.toArray(), o.projection);
});

test('rehacer el trazado libera cada geometría y material de la instalación anterior', () => {
  const o = overlay();
  o.window.actualizarContenido(path, 'tubo_rigido', '{"diametro_mm":25}', '[]', '[]');
  const group = o.scene.children.filter(c => c.type === 'Group').at(-1);
  const contar = recursos(group);
  o.window.actualizarContenido(path, 'tubo_rigido', '{"diametro_mm":25}', '[]', '[]');
  const n = contar();
  assert.ok(n.geometries > 0 && n.materials > 0);
  assert.equal(n.geometriesDisposed, n.geometries);
  assert.equal(n.materialsDisposed, n.materials);
});

test('el refresco de planos libera buffers y conserva sus materiales compartidos', () => {
  const o = overlay();
  const planes = JSON.stringify([{ cx: 0, cy: 0, cz: 0, qx: 0, qy: 0, qz: 0, qw: 1,
    poly: [-1, -1, 1, -1, 1, 1, -1, 1] }]);
  o.window.actualizarPlanos(planes);
  const group = o.scene.children.filter(c => c.type === 'Group')[1];
  const contar = recursos(group);
  o.window.actualizarPlanos(planes);
  const n = contar();
  assert.equal(n.geometriesDisposed, 2);
  assert.equal(n.materialsDisposed, 0);
  assert.equal(group.children.length, 2);
});

test('borrar complementos libera la geometría y los materiales anteriores', () => {
  const o = overlay();
  o.window.actualizarContenido('[]', 'tubo_rigido', '{}', '[]', '[{"key":"enchufe","x":0,"y":0,"z":0}]');
  const group = o.scene.children.filter(c => c.type === 'Group')[0];
  const contar = recursos(group);
  o.window.actualizarContenido('[]', 'tubo_rigido', '{}', '[]', '[]');
  const n = contar();
  assert.ok(n.geometries > 0);
  assert.equal(n.geometriesDisposed, n.geometries);
  assert.equal(n.materialsDisposed, n.materials);
  assert.equal(group.children.length, 0);
});

test('el asset nativo produce bases de rotación válidas en tramos paralelos a la normal', () => {
  const o = overlay();
  o.window.actualizarContenido(path, 'bandeja_rejilla', '{"ancho_mm":200}', '[]', '[]');
  const installation = o.scene.children.filter(c => c.type === 'Group').at(-1);
  assert.ok(installation.children.length > 0);
  installation.children.forEach(segment => {
    assert.ok(Math.abs(segment.quaternion.lengthSq() - 1) < 1e-6, 'Rotación degenerada');
    segment.updateMatrix();
    assert.ok(Math.abs(segment.matrix.determinant() - 1) < 1e-6, 'Base no invertible');
  });
});
