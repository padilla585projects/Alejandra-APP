// Trazado realista del Replanteo (03/10/2026): prioridades 2-4 de
// docs/features/replanteo-instalacion-realista/README.md. Prueba las funciones REALES de
// repl3d.js (compartido por la vista 3D, el informe, el AR WebXR y el overlay del AR nativo):
// ángulos rectos con las normales guardadas, líneas en paralelo, superficie forzada por tramo y
// edición de puntos (pegar a techo/pared, esquivar instalación, elegir punto con un toque).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const THREE = require(resolve(__dirname, '../capacitor/android/app/src/main/assets/ar/three.min.js'));

const ctx = vm.createContext({ THREE, console });
vm.runInContext(readFileSync(resolve(__dirname, '../repl3d.js'), 'utf8'), ctx);
const R = name => vm.runInContext(name, ctx);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PARED = V(0, 0, 1);      // pared en z = -3 mirando a la sala (+Z)
const TECHO = V(0, -1, 0);     // techo en y = 2,5 mirando hacia abajo
const SUELO = V(0, 1, 0);
const J = x => JSON.parse(JSON.stringify(x));
const cerca = (a, b, eps = 1e-6) => a.distanceTo(b) < eps;
const ejeAlineado = d => { const n = d.clone().normalize(); return [n.x, n.y, n.z].filter(c => Math.abs(c) > 1e-6).length === 1; };
function tramos(pts) { const out = []; for (let i = 1; i < pts.length; i++) out.push(pts[i].clone().sub(pts[i - 1])); return out; }

test('pared → techo: sube vertical, gira 90° en la esquina y sigue horizontal (sin diagonal)', () => {
  const o = R('_replOrtogonalizar')(THREE, [V(0, 1, -3), V(0.05, 2.5, -2)], [PARED, TECHO]);
  assert.equal(o.pts.length, 3, 'un codo justo en la arista pared/techo');
  assert.ok(cerca(o.pts[1], V(0, 2.5, -3)), 'el codo está en la esquina real');
  assert.ok(cerca(o.pts[2], V(0, 2.5, -2)), '5 cm de lado son imprecisión de la mano: se endereza');
  tramos(o.pts).forEach(d => assert.ok(ejeAlineado(d), 'cada tramo va en un eje: ' + d.toArray()));
  assert.deepEqual(J(o.nSeg.map(n => n.toArray())), [PARED.toArray(), TECHO.toArray()]);
  assert.equal(R('_replLongitudTrazado')(THREE, [V(0, 1, -3), V(0.05, 2.5, -2)], { normales: [PARED, TECHO] }).toFixed(6), (1.5 + 1).toFixed(6),
    'se mide lo que de verdad lleva la instalación (1,5 m de subida + 1 m de techo), no la diagonal');
});

test('si además se desplaza a lo largo de la esquina, la recorre en vez de cruzar en diagonal', () => {
  const o = R('_replOrtogonalizar')(THREE, [V(0, 1, -3), V(1, 2.5, -2)], [PARED, TECHO]);
  assert.equal(o.pts.length, 4);
  assert.ok(cerca(o.pts[1], V(0, 2.5, -3)) && cerca(o.pts[2], V(1, 2.5, -3)) && cerca(o.pts[3], V(1, 2.5, -2)));
  tramos(o.pts).forEach(d => assert.ok(ejeAlineado(d)));
  assert.deepEqual(J(o.origen), [0, 0, 0], 'los tres tramos salen del tramo original 0');
});

test('en la misma pared: imprecisión → recto; cambio real de eje → L con el horizontal por arriba', () => {
  const O = R('_replOrtogonalizar');
  const recto = O(THREE, [V(0, 1, -3), V(0.08, 2, -3)], [PARED, PARED]);
  assert.equal(recto.pts.length, 2);
  assert.ok(cerca(recto.pts[1], V(0, 2, -3)), 'sube vertical, sin la diagonal de 8 cm');
  const sube = O(THREE, [V(0, 1, -3), V(1, 2, -3)], [PARED, PARED]);
  assert.ok(cerca(sube.pts[1], V(0, 2, -3)), 'subiendo: primero vertical');
  const baja = O(THREE, [V(0, 2, -3), V(1, 1, -3)], [PARED, PARED]);
  assert.ok(cerca(baja.pts[1], V(1, 2, -3)), 'bajando: primero horizontal (por arriba) y baja al final');
});

test('en techo usa los ejes de la sala que da una pared del trazado; sin pared no inventa orientación', () => {
  const O = R('_replOrtogonalizar');
  const conPared = O(THREE, [V(0, 1, -3), V(0, 2.5, -2.5), V(2, 2.5, -1)], [PARED, TECHO, TECHO]);
  tramos(conPared.pts).forEach(d => assert.ok(ejeAlineado(d), 'en techo también va paralelo a las paredes'));
  assert.ok(cerca(conPared.pts.at(-1), V(2, 2.5, -1)), 'el punto final marcado se respeta');
  const soloTecho = O(THREE, [V(0, 2.5, 0), V(2, 2.5, -1)], [TECHO, TECHO]);
  assert.equal(soloTecho.pts.length, 2, 'una recta entre dos puntos de techo ya es recta');
});

test('diagonal real pedida por tramo, y trazados sin normales (foto 2D) quedan exactamente igual', () => {
  const O = R('_replOrtogonalizar');
  const diag = O(THREE, [V(0, 1, -3), V(1, 2.5, -2)], [PARED, TECHO], { diagonales: [true] });
  assert.equal(diag.pts.length, 2);
  assert.ok(cerca(diag.pts[1], V(1, 2.5, -2)));
  const foto = [V(0, 0, 0), V(1, 0, 0.4), V(2, 0, 0)];
  const p = R('_replTrazadoPreparado')(THREE, foto, { w: 0.1 });
  assert.equal(p.lineas.length, 1);
  p.lineas[0].pts.forEach((q, i) => assert.ok(cerca(q, foto[i]), 'sin normales no se rectifica ni se separa de nada'));
  assert.ok(Math.abs(R('_replLongitudTrazado')(THREE, foto, {}) - (foto[0].distanceTo(foto[1]) + foto[1].distanceTo(foto[2]))) < 1e-9);
  const sinOrto = R('_replTrazadoPreparado')(THREE, [V(0, 1, -3), V(1, 2.5, -2)], { normales: [PARED, TECHO], ortogonal: false });
  assert.equal(sinOrto.centro.pts.length, 2);
});

test('el codo queda a 3 cm de las DOS superficies y los tramos siguen en ángulo recto', () => {
  const p = R('_replTrazadoPreparado')(THREE, [V(0, 1, -3), V(0, 2.5, -2)], { normales: [PARED, TECHO], w: 0.025 });
  const [a, c, b] = p.lineas[0].pts;
  const s = R('REPL_TRAZADO').separacionPared;
  assert.ok(cerca(c, V(0, 2.5 - s, -3 + s)), 'codo separado de pared y techo: ' + c.toArray());
  assert.ok(Math.abs(a.z - (-3 + s)) < 1e-9 && Math.abs(b.y - (2.5 - s)) < 1e-9);
  tramos(p.lineas[0].pts).forEach(d => assert.ok(ejeAlineado(d)));
});

test('varios tubos en paralelo: mismo recorrido, mismos giros y separación regular', () => {
  const pts = [V(0, 1, -3), V(0, 2.5, -2), V(1.5, 2.5, -1.2)];
  const w = 0.025, hueco = 0.02;
  const p = R('_replTrazadoPreparado')(THREE, pts, { normales: [PARED, TECHO, TECHO], w, paralelos: { n: 4, hueco_m: hueco } });
  assert.equal(p.lineas.length, 4);
  assert.ok(Math.abs(p.sepCentros - (w + hueco)) < 1e-12);
  const nv = p.lineas[0].pts.length;
  p.lineas.forEach(l => {
    assert.equal(l.pts.length, nv, 'todas con los mismos codos');
    tramos(l.pts).forEach(d => assert.ok(ejeAlineado(d), 'cada línea sigue en ángulo recto'));
  });
  // En cada vértice las líneas consecutivas guardan la misma separación (en los tramos rectos
  // exactamente la de centros; en los codos en ángulo recto el inglete la mantiene por tramo).
  for (let k = 1; k < 4; k++) {
    tramos(p.lineas[k].pts).forEach((d, i) => {
      const a0 = p.lineas[k - 1].pts[i], a1 = p.lineas[k].pts[i];
      const perp = a1.clone().sub(a0); perp.addScaledVector(d.clone().normalize(), -perp.dot(d.clone().normalize()));
      assert.ok(Math.abs(perp.length() - (w + hueco)) < 1e-9, 'separación perpendicular al tramo ' + perp.length());
    });
  }
  const g = R('_replInstal3D')(THREE, pts, { tipo: 'tubo', w, normales: [PARED, TECHO, TECHO], paralelos: { n: 4, hueco_m: hueco } });
  assert.equal(g.userData.trazado.lineas, 4);
  g.children.forEach(o => { o.updateMatrix(); assert.ok(Math.abs(o.matrix.determinant() - 1) < 1e-6, 'base válida'); });
  const opts = R('_replOpcionesTrazado')({ paralelos: { n: '3', hueco_m: 0.05 }, puntos_3d: [{ d: 1 }, {}, { d: 0 }] });
  assert.deepEqual(JSON.parse(JSON.stringify(opts)), { diagonales: [true, false, false], paralelos: { n: 3, hueco_m: 0.05 } });
  assert.equal(R('_replOpcionesTrazado')({ paralelos: { n: 1 } }).paralelos, null);
  assert.equal(R('_replOpcionesTrazado')({ paralelos: { n: 99 } }).paralelos.n, R('REPL_TRAZADO').maxParalelos);
});

test('un obstáculo del tramo original se recoloca en el mismo sitio del recorrido rectificado', () => {
  const pts = [V(0, 1, -3), V(0, 2.5, -2)];
  const o = R('_replOrtogonalizar')(THREE, pts, [PARED, TECHO]);
  const [ob] = R('_replRemapObstaculos')(o, [{ seg: 0, t: 0.8, accion: 'debajo', dimension_m: 0.2 }]);
  assert.equal(ob.seg, 1, '80% de 2,5 m = 2 m: ya va por el techo');
  assert.ok(Math.abs(ob.t - 0.5) < 1e-9);
  assert.equal(ob.accion, 'debajo');
  const d = R('_replDesviosSeg')(THREE, o.pts, o.nSeg, [ob]);
  assert.equal(d.pts.length, o.pts.length + 4);
  assert.equal(d.nSeg.length, d.pts.length - 1, 'cada tramo del quiebro conserva su normal');
  assert.deepEqual(J(d.nSeg.slice(1).map(n => n.toArray())), Array(5).fill(TECHO.toArray()));
  assert.equal(R('_replConDesvios')(THREE, pts, [{ seg: 0, t: 0.5 }]).length, 6, 'la API antigua sigue igual');
});

test('superficie forzada: el plano del primer punto manda aunque la profundidad caiga sobre otra cosa', () => {
  const cam = V(0, 1.5, 0);
  const plano = R('_replPlanoForzado')(THREE, 'techo', V(0.3, 2.5, -1), null, V(0, 0, -1));
  assert.deepEqual(J(plano.normal.toArray()), TECHO.toArray());
  // La profundidad de este fotograma dio una bandeja existente 40 cm por debajo del techo.
  const raro = V(0.8, 2.1, -1.2);
  const q = R('_replForzarAPlano')(THREE, plano, raro, cam);
  assert.ok(Math.abs(q.y - 2.5) < 1e-9, 'queda en el techo');
  const dir = raro.clone().sub(cam).normalize(), dq = q.clone().sub(cam).normalize();
  assert.ok(dir.distanceTo(dq) < 1e-9, 'en la misma dirección en la que apuntaba el usuario');
  // Sin hit ni profundidad: basta el rayo central de la cámara.
  const sinDato = R('_replForzarAPlano')(THREE, plano, cam.clone().add(V(0, 0.5, -1)), cam);
  assert.ok(Math.abs(sinDato.y - 2.5) < 1e-9);
  // Rayo casi paralelo al techo: proyección perpendicular, nunca un punto a kilómetros.
  const rasante = R('_replForzarAPlano')(THREE, plano, V(5, 1.55, 0), cam);
  assert.ok(Math.abs(rasante.y - 2.5) < 1e-9 && Math.abs(rasante.x - 5) < 1e-9);
  const pared = R('_replPlanoForzado')(THREE, 'pared', V(0, 1, -3), V(0, 1, 0), V(0.2, -0.1, -1));
  assert.ok(Math.abs(pared.normal.y) < 1e-9 && pared.normal.z > 0.9, 'una normal de suelo no vale para un tramo de pared');
  const real = R('_replPlanoForzado')(THREE, 'pared', V(0, 1, -3), V(0.1, 0, 1), V(0, 0, -1));
  assert.ok(real.normal.x > 0.09, 'si el plano detectado es de verdad una pared, se usa su normal');
});

test('pegar a techo/pared un punto ya colocado, y esquivar una instalación existente', () => {
  const planos = [{ pos: V(0, 2.5, -1), normal: TECHO, tipo: 'techo' }, { pos: V(0, 0, -1), normal: SUELO, tipo: 'suelo' },
                  { pos: V(0, 1.2, -3), normal: PARED, tipo: 'pared' }, { pos: V(0, 2.2, -1), normal: TECHO, tipo: 'techo', excluida: true }];
  const P = R('_replPegarASuperficie');
  const t = P(THREE, V(0.4, 2.1, -1.5), planos, 'techo');
  assert.ok(cerca(t.pos, V(0.4, 2.5, -1.5)) && cerca(t.normal, TECHO), 'sube al techo real, no al mueble descartado');
  const p = P(THREE, V(0.4, 1.4, -2.7), planos, 'pared');
  assert.ok(cerca(p.pos, V(0.4, 1.4, -3)));
  assert.equal(P(THREE, V(0, 0.2, 0), planos, 'techo'), null, 'a 2,3 m no salta: no hay techo cerca');
  // Instalación existente vista por la IA: esfera de 0,3 m en el techo.
  const inst = [{ pos: V(1, 2.45, -1), radio: 0.3, etiqueta: 'Bandeja existente' }];
  const e = R('_replEsquivarInstalacion')(THREE, V(1.1, 2.5, -1), TECHO, inst, 0.05);
  assert.ok(e && e.instalaciones[0].etiqueta === 'Bandeja existente');
  assert.ok(Math.abs(e.pos.y - 2.5) < 1e-9, 'sigue pegado al techo');
  assert.ok(e.pos.distanceTo(inst[0].pos) >= 0.35 - 1e-6, 'fuera de la instalación + margen');
  assert.ok(e.pos.x > 1.1, 'se aparta hacia el lado en el que ya estaba');
  assert.equal(R('_replEsquivarInstalacion')(THREE, V(3, 2.5, -1), TECHO, inst, 0.05), null);
});

test('un toque en pantalla elige el punto al que apunta, o ninguno', () => {
  const puntos = [V(0, 1, -2), V(0.5, 1, -2), V(1, 1, -2)];
  const C = R('_replPuntoMasCercano');
  assert.equal(C(THREE, puntos, V(0, 1, 0), V(0.5, 0, -2)), 1);
  assert.equal(C(THREE, puntos, V(0, 1, 0), V(0, 1, 0)), -1);
});

// ── worker.js: el material de N líneas en paralelo (trazado_json.paralelos) ─────────────────
test('el servidor multiplica el material por las líneas en paralelo, con tope y sin romper lo antiguo', () => {
  const src = readFileSync(resolve(__dirname, '../worker.js'), 'utf8');
  const ini = src.indexOf('function calcularMaterialReplanteo(');
  const fin = src.indexOf('function _parseReplanteoRow(');
  assert.ok(ini > 0 && fin > ini, 'cálculo de material presente en worker.js');
  const w = vm.createContext({ Math, Number, Array, Object, JSON, REPLANTEO_OBSTACULO_ACCIONES: ['debajo', 'esquivar', 'sujetar'],
    planosDeTrazado: () => [], planoDeTramo: () => 0, distanciaEnPlano: () => null });
  vm.runInContext(src.slice(ini, fin) + '\n;this.calc = calcularMaterialReplanteo;', w);
  const elemento = { nombre: 'Tubo rígido', reglas: { tramo_m: 3, codo_nombre: 'Curva', giro_min_grados: 30, union_nombre: 'Manguito', uniones_por_tramo: 1, desperdicio_pct: 0 } };
  const trazado = { puntos: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
  const uno = w.calc({ elemento, elemento_params: { diametro_mm: 25 }, trazado, longitud_manual_m: 6 });
  const cuatro = w.calc({ elemento, elemento_params: { diametro_mm: 25 }, trazado: { ...trazado, paralelos: { n: 4, hueco_m: 0.02 } }, longitud_manual_m: 6 });
  assert.equal(uno.paralelos, 1);
  assert.equal(cuatro.paralelos, 4);
  assert.equal(cuatro.longitud_m, uno.longitud_m, 'la longitud es la del recorrido, no la suma');
  assert.ok(uno.material.length >= 3);
  uno.material.forEach(m => {
    const m4 = cuatro.material.find(x => x.key === m.key);
    assert.equal(m4.cantidad, m.cantidad * 4, m.key);
    assert.match(m4.detalle, /×4 líneas en paralelo/);
  });
  assert.equal(w.calc({ elemento, elemento_params: {}, trazado: { ...trazado, paralelos: { n: 500 } }, longitud_manual_m: 6 }).paralelos, 12);
  assert.equal(w.calc({ elemento, elemento_params: {}, trazado: { ...trazado, paralelos: { n: 'x' } }, longitud_manual_m: 6 }).paralelos, 1);
});
