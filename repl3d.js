// ══════════════════════════════════════════════════════════════════════════
// repl3d.js — Geometría 3D compartida del Replanteo (Three.js)
// ══════════════════════════════════════════════════════════════════════════
// PANEL-ALEJANDRA-REAL-01 / FASE-B-AR-01 (17/09/2026): extraído de index.html tal
// cual, sin cambiar ni una línea de lógica -- la PWA (vista 3D y AR WebXR, ambas en
// index.html) lo sigue usando exactamente igual que antes vía estas mismas funciones
// globales. El motivo de sacarlo a un archivo aparte es poder cargarlo TAMBIÉN desde
// el overlay del AR nativo de la APK (WebView transparente sobre la cámara de
// ARCore, ver capacitor/android/.../ar/), que no puede cargar index.html entero
// (29k líneas, todo el resto de la app) solo para pintar un tubo y unos accesorios.
//
// Funciones puras: reciben THREE (la librería, ya cargada por quien las llama) y
// los datos que necesitan como parámetros -- no tocan el DOM ni ningún estado
// global de index.html (_repl, _ar, etc.). _repl3DBuild() en index.html es la
// única que sigue ahí, porque esa sí lee _repl directamente; aquí solo vive lo
// reutilizable de verdad.

const REPL_COMPLEMENTOS = [
  { key: 'enchufe',      nombre: '🔌 Enchufe schuko',        marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'interruptor',  nombre: '💡 Interruptor',           marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'conmutador',   nombre: '💡 Conmutador',            marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'doble',        nombre: '💡 Doble interruptor',     marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'pulsador',     nombre: '🔘 Pulsador',              marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'regulador',    nombre: '🎚 Regulador',             marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'rj45',         nombre: '🌐 Toma de red RJ45',      marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'tv',           nombre: '📺 Toma de TV',            marca: 'Legrand/Simon', build: 'mecanismo' },
  { key: 'caja_mecanismo', nombre: '⬜ Caja de mecanismo',   marca: '',              build: 'caja_mec' },
  { key: 'caja_registro',  nombre: '📦 Caja de registro',    marca: '',              build: 'caja_reg' },
  { key: 'cuadro',       nombre: '🗄 Cuadro eléctrico',      marca: '',              build: 'cuadro' },
  { key: 'luminaria',    nombre: '💡 Luminaria',             marca: '',              build: 'luminaria' },
];

// Devuelve un THREE.Group con el complemento, orientado en su eje +Z hacia fuera de la superficie.
function _replComplemento3D(THREE, key) {
  const g = new THREE.Group();
  const c = REPL_COMPLEMENTOS.find(x => x.key === key) || REPL_COMPLEMENTOS[0];
  const plate = (w, h, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), new THREE.MeshStandardMaterial({ color: col, metalness: .1, roughness: .7 })); return m; };
  if (c.build === 'mecanismo') {
    g.add(plate(0.08, 0.08, 0xf2f2f2));                                   // placa (marco)
    if (key === 'enchufe') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.01, 24), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })); b.rotation.x = Math.PI / 2; b.position.z = 0.011; g.add(b);
      [-0.012, 0.012].forEach(x => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 12), new THREE.MeshStandardMaterial({ color: 0x222222 })); h.rotation.x = Math.PI / 2; h.position.set(x, 0, 0.013); g.add(h); }); }
    else if (key === 'rj45' || key === 'tv') { const b = plate(0.03, 0.03, 0xdddddd); b.position.z = 0.012; g.add(b); }
    else { const tecla = new THREE.Mesh(new THREE.BoxGeometry(key === 'doble' ? 0.024 : 0.05, 0.05, 0.012), new THREE.MeshStandardMaterial({ color: 0xffffff })); tecla.position.set(key === 'doble' ? -0.014 : 0, 0, 0.012); g.add(tecla);
      if (key === 'doble') { const t2 = tecla.clone(); t2.position.x = 0.014; g.add(t2); }
      if (key === 'regulador') { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 20), new THREE.MeshStandardMaterial({ color: 0xcccccc })); kn.rotation.x = Math.PI / 2; kn.position.z = 0.014; g.remove(g.children[1]); g.add(kn); } }
  } else if (c.build === 'caja_mec') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: 0xff8c00, metalness: .1, roughness: .8 }))); }
  else if (c.build === 'caja_reg') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.05), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: .1, roughness: .8 }))); }
  else if (c.build === 'cuadro') { g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.50, 0.11), new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: .3, roughness: .5 })));
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.44, 0.01), new THREE.MeshStandardMaterial({ color: 0x2b3542 })); p.position.z = 0.06; g.add(p); }
  else if (c.build === 'luminaria') { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 0.9 })); d.rotation.x = Math.PI / 2; g.add(d); }
  return g;
}

// Tipo de render de la instalación a partir del elemento del catálogo.
function _replTipoRender(key, params) {
  if (key === 'bandeja_rejilla') return 'rejiband';
  if (key === 'bandeja_escalera') return 'escalera';
  if (key === 'bandeja_chapa') return 'chapa';
  if (key === 'canal_pvc') return 'canal';
  if (key && key.indexOf('tubo') === 0) return 'tubo';
  return (params && params.diametro_mm) ? 'tubo' : 'tray';
}

// Render REALISTA compartido (AR y vista 3D): tubo hueco con grapas y cajas de registro en los
// codos; Rejiband como malla de varillas con borde; escalera con largueros y travesaños; chapa
// en perfil U; canal PVC. Soportes en las bandejas. pts = THREE.Vector3[] en metros.
// Inserta el QUIEBRO automático de la instalación al pasar un obstáculo: 'debajo' baja d y
// vuelve a subir (pasa por debajo); 'esquivar' se desvía d en horizontal; 'sujetar' no desvía.
function _replConDesvios(THREE, pts, obst) {
  if (!obst || !obst.length) return pts;
  return _replDesviosSeg(THREE, pts, [], obst).pts;
}
// Igual que _replConDesvios, pero arrastrando la normal real de cada tramo (nSeg[i] = normal del
// tramo i→i+1, o null) a los puntos del quiebro. Resuelve la antigua LIMITACIÓN CONOCIDA de
// _replInstal3D: antes las normales seguían alineadas a los puntos ORIGINALES y en los quiebros
// se caía al "arriba" genérico.
function _replDesviosSeg(THREE, pts, nSeg, obst) {
  const up = new THREE.Vector3(0, 1, 0), bySeg = {};
  (obst || []).forEach(o => { if (o && o.seg != null && o.t != null) (bySeg[o.seg] = bySeg[o.seg] || []).push(o); });
  Object.values(bySeg).forEach(a => a.sort((x, y) => x.t - y.t));
  const out = [pts[0].clone()], nOut = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], segObst = bySeg[i - 1] || [], n = (nSeg && nSeg[i - 1]) || null;
    const dir = b.clone().sub(a), len = dir.length() || 1, u = dir.clone().normalize();
    const right = new THREE.Vector3().crossVectors(u, up).normalize();
    let ultimo = -Infinity;                           // agrupa obstáculos casi en el mismo punto
    for (const o of segObst) {
      if (o.accion === 'sujetar') continue;
      const d = Math.max(0.1, +o.dimension_m || 0.3), hw = Math.min(0.15, len * 0.15);
      const s = Math.max(0, Math.min(1, o.t)) * len;   // posición a lo largo del tramo (m)
      if (s - ultimo < 2 * hw * 1.15) continue;        // demasiado cerca del anterior → se funde
      ultimo = s;
      const q = a.clone().addScaledVector(u, s);
      const off = o.accion === 'esquivar' ? right.clone().multiplyScalar(d) : up.clone().multiplyScalar(-d);
      const p1 = q.clone().addScaledVector(u, -hw), p2 = q.clone().addScaledVector(u, hw);
      out.push(p1, p1.clone().add(off), p2.clone().add(off), p2);
      nOut.push(n, n, n, n);
    }
    out.push(b.clone()); nOut.push(n);
  }
  return { pts: out, nSeg: nOut };
}

// ══════════════════════════════════════════════════════════════════════════
// Trazado realista (03/10/2026): ángulos rectos, líneas en paralelo y superficie forzada
// ══════════════════════════════════════════════════════════════════════════
// Prioridades 2-4 de docs/features/replanteo-instalacion-realista/README.md. Mismo criterio que
// el resto del archivo: funciones puras (THREE por parámetro), usadas a la vez por la vista 3D,
// el informe (index.html y panel.html), el AR WebXR y el overlay del AR nativo (copia exacta en
// assets/ar). El trazado GUARDADO no cambia: se rectifica al pintar y al medir, así que un
// replanteo antiguo también se ve en ángulo recto y se puede volver a la diagonal por tramo.
const REPL_TRAZADO = {
  snapM: 0.12,                                  // desvío lateral que se toma como imprecisión de la mano
  snapTan: Math.tan(25 * Math.PI / 180),        // ...siempre que el ángulo también sea pequeño
  separacionPared: 0.03,                        // vuelo de abrazadera/soporte respecto a la superficie
  huecoParaleloM: 0.03,                         // hueco por defecto entre líneas en paralelo
  maxParalelos: 12,
  maxPegarM: 1.5,                               // "pegar a techo/pared": no saltar a un plano más lejano
};

function _replN(n) { return (n && typeof n.lengthSq === 'function' && n.lengthSq() > 0.25) ? n.clone().normalize() : null; }
// Clase de superficie por su normal EXTERIOR (misma regla que SurfaceGeometry.type en Java).
function _replClaseNormal(n) { if (!n) return null; return n.y > 0.7 ? 'suelo' : (n.y < -0.7 ? 'techo' : 'pared'); }

// Ejes de trabajo de una superficie: en pared, horizontal (e1) y vertical (e2); en techo/suelo,
// los ejes de la sala sacados de una pared del propio trazado (sin pared conocida: null, no se
// inventa una orientación de la sala).
function _replEjesPlano(THREE, n, ejeSala) {
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(n.y) <= 0.7) {
    const v = up.clone().addScaledVector(n, -n.dot(up)).normalize();
    return { e1: new THREE.Vector3().crossVectors(v, n).normalize(), e2: v, pared: true };
  }
  if (!ejeSala) return null;
  const e1 = ejeSala.clone().addScaledVector(n, -n.dot(ejeSala));
  if (e1.lengthSq() < 1e-6) return null;
  e1.normalize();
  return { e1, e2: new THREE.Vector3().crossVectors(n, e1).normalize(), pared: false };
}

// Tramo a→b sobre UNA superficie (normal n): recto si la desviación es imprecisión de la mano,
// en L si de verdad cambia de eje. En pared sube primero o baja al final (el tramo horizontal va
// siempre por arriba, como se instala); en techo/suelo va primero el tramo más largo. Devuelve
// los puntos que siguen a `a`; el último sustituye a `b` (puede moverse <= snapM al enderezar).
function _replTramoEnPlano(THREE, a, b, n, ejes) {
  const d = b.clone().sub(a);
  const u = d.dot(ejes.e1), v = d.dot(ejes.e2), fuera = d.dot(n);
  const au = Math.abs(u), av = Math.abs(v), mayor = Math.max(au, av), menor = Math.min(au, av);
  if (mayor < 1e-3) return [b.clone()];
  const ejeU = ejes.e1.clone().multiplyScalar(u), ejeV = ejes.e2.clone().multiplyScalar(v);
  if (menor <= REPL_TRAZADO.snapM && menor <= mayor * REPL_TRAZADO.snapTan)
    return [a.clone().add(au >= av ? ejeU : ejeV).addScaledVector(n, fuera)];
  const primero = ejes.pared ? (v > 0 ? ejeV : ejeU) : (au >= av ? ejeU : ejeV);
  return [a.clone().add(primero), b.clone()];
}

// Tramo a→b entre DOS superficies que se cortan (pared→techo, suelo→pared, pared→pared en una
// esquina): sube/avanza perpendicular a la arista común, gira 90° justo en ella y sigue por la
// otra superficie. Si además hay desplazamiento a lo largo de la arista, la recorre (sin
// diagonales); si es pequeño, es imprecisión y se endereza. null si no aplica.
function _replTramoEntrePlanos(THREE, a, na, b, nb) {
  const c = na.dot(nb);
  if (Math.abs(c) > 0.5) return null;
  const l = new THREE.Vector3().crossVectors(na, nb);
  if (l.lengthSq() < 1e-6) return null;
  l.normalize();
  const d1 = na.dot(a), d2 = nb.dot(b), det = 1 - c * c;
  const p0 = na.clone().multiplyScalar((d1 - d2 * c) / det).add(nb.clone().multiplyScalar((d2 - d1 * c) / det));
  const c1 = p0.clone().addScaledVector(l, a.clone().sub(p0).dot(l));
  const c2 = p0.clone().addScaledVector(l, b.clone().sub(p0).dot(l));
  const L = a.distanceTo(b);
  // Una arista lejísimos significa un plano mal detectado: mejor la diagonal que un disparate.
  if (a.distanceTo(c1) > 2 * L + 1 || b.distanceTo(c2) > 2 * L + 1) return null;
  if (c1.distanceTo(c2) <= REPL_TRAZADO.snapM) return { pts: [c1, b.clone().add(c1.clone().sub(c2))], nSeg: [na, nb] };
  return { pts: [c1, c2, b.clone()], nSeg: [na, nb, nb] };
}

// Ortogonaliza un trazado con las normales REALES guardadas por punto (null donde no se sabe).
// opts.diagonales[i] = true respeta tal cual el tramo i (diagonal real pedida por el usuario).
// Devuelve { pts, nSeg (normal por tramo), origen (tramo original de cada tramo), rectificados }.
function _replOrtogonalizar(THREE, pts, normales, opts) {
  opts = opts || {};
  const diag = opts.diagonales || [], ns = (normales || []).map(_replN);
  let ejeSala = null;
  for (const n of ns) {
    if (n && Math.abs(n.y) <= 0.7) { const h = new THREE.Vector3(n.x, 0, n.z); if (h.lengthSq() > 1e-4) { ejeSala = h.normalize(); break; } }
  }
  const out = [pts[0].clone()], nSeg = [], origen = [];
  let rectificados = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i], na = ns[i - 1] || null, nb = ns[i] || null;
    let tramo = null;
    if (!diag[i - 1]) {
      if (na && nb && na.dot(nb) < 0.9) tramo = _replTramoEntrePlanos(THREE, a, na, b, nb);
      else if (na || nb) {
        const n = na || nb, ejes = _replEjesPlano(THREE, n, ejeSala);
        if (ejes) { const p = _replTramoEnPlano(THREE, a, b, n, ejes); tramo = { pts: p, nSeg: p.map(() => n) }; }
      }
    }
    if (!tramo) tramo = { pts: [b.clone()], nSeg: [na || nb] };
    else if (tramo.pts.length > 1 || tramo.pts[0].distanceTo(b) > 1e-3) rectificados++;
    tramo.pts.forEach((p, k) => {
      if (p.distanceTo(out[out.length - 1]) < 1e-3) { out[out.length - 1] = p; return; }
      out.push(p); nSeg.push(tramo.nSeg[k] || null); origen.push(i - 1);
    });
  }
  return { pts: out, nSeg, origen, rectificados };
}

// Los obstáculos se guardan sobre el tramo ORIGINAL (seg, t); tras rectificar, ese tramo puede
// ser varios: se recoloca en el mismo punto a lo largo del recorrido.
function _replRemapObstaculos(orto, obst) {
  const out = [];
  (obst || []).forEach(o => {
    if (!o || o.seg == null || o.t == null) return;
    const idx = [];
    orto.origen.forEach((s, k) => { if (s === o.seg) idx.push(k); });
    if (!idx.length) return;
    const lens = idx.map(k => orto.pts[k].distanceTo(orto.pts[k + 1]));
    let resto = Math.max(0, Math.min(1, +o.t)) * lens.reduce((s, x) => s + x, 0), j = 0;
    while (j < idx.length - 1 && resto > lens[j]) { resto -= lens[j]; j++; }
    out.push({ ...o, seg: idx[j], t: lens[j] > 0 ? Math.min(1, resto / lens[j]) : 0.5 });
  });
  return out;
}

// Base local de un tramo: X a lo largo, Y hacia fuera de la superficie (normal real si se
// conoce), Z el ancho (en el plano de la superficie).
// REJIBAND-DE-CARA-01 (17/09/2026): Adrián, probando en AR con un tramo casi vertical --
// "el rejiband se ha colocado mirando hacia la cámara... perpendicular a la pared". Antes se
// orientaba cada tramo con setFromUnitVectors(X, dir) -- da la rotación MÍNIMA de +X a la
// dirección del tramo, pero no dice nada de en qué ángulo queda el "ancho" (eje local Z, donde
// van los railes/paredes de rejiband, escalera, chapa, canal) alrededor de ese eje: para un
// tramo casi vertical esa rotación mínima resulta -- por pura geometría del giro más corto --
// en que el ancho acaba apuntando hacia la cámara/profundidad en vez de a lo largo de la
// pared. Se construye la base a mano con una referencia "arriba" estable.
//
// PARED-NORMAL-REAL-01 (17/09/2026): Adrián, después -- "no queda pegada a la pared como una
// instalación real". La normal real de la superficie (eje Y de la pose del ancla en el AR nativo,
// plano detectado en WebXR; null si no se conoce) es la referencia cuando existe -- así el ancho
// (Z local) cae en el plano de la pared de verdad, y el alto/grosor (Y local) apunta hacia fuera
// de la pared. Sin normal (plano 2D de una foto) se mantiene el respaldo de "arriba".
//
// GEOMETRIA-DEGENERADA-NORMAL-01 (18/09/2026): si el tramo va casi paralelo a la normal (dos
// puntos pegados a paredes distintas cerca de una esquina), cross(dirN, normal) sale casi nulo y
// la base se degenera (instalación invisible). Se exige |dot| < 0.98 para usar la normal real;
// si no, respaldo genérico SOLO para ese tramo.
function _replBaseTramo(THREE, a, b, normalReal) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const dirN = len > 0 ? dir.clone().divideScalar(len) : new THREE.Vector3(1, 0, 0);
  const arribaMundo = new THREE.Vector3(0, 1, 0);
  let arriba = null, usaNormalReal = false;
  if (normalReal && normalReal.lengthSq() > 0.25) {
    const nr = normalReal.clone().normalize();
    if (Math.abs(dirN.dot(nr)) < 0.98) { arriba = nr; usaNormalReal = true; }
  }
  if (!usaNormalReal) arriba = Math.abs(dirN.dot(arribaMundo)) > 0.999 ? new THREE.Vector3(0, 0, 1) : arribaMundo;
  const zAxis = new THREE.Vector3().crossVectors(dirN, arriba).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, dirN).normalize();
  return { len, dirN, yAxis, zAxis, usaNormalReal, normal: usaNormalReal ? arriba : null };
}

// Geometría final del trazado, sin mallas (se prueba en Node): rectifica en ángulo recto,
// recoloca obstáculos, inserta quiebros, separa de la superficie y reparte las líneas paralelas.
// opts: { normales (por punto), diagonales (por tramo original), ortogonal (false = tal cual se
//         marcó), obstaculos, paralelos: { n, hueco_m }, w (ancho/diámetro en m) }.
// Devuelve { centro: { pts, nSeg } (eje rectificado SIN quiebros: para medir y acotar),
//            lineas: [{ pts, nSeg }] (una por tubo/bandeja), nLineas, sepCentros, rectificados }.
function _replTrazadoPreparado(THREE, pts, opts) {
  opts = opts || {};
  const w = opts.w || 0.2, normales = opts.normales || [];
  let P = (pts || []).map(p => p.clone()), nSeg, obst = opts.obstaculos, rectificados = 0;
  if (P.length < 2) return { centro: { pts: P, nSeg: [] }, lineas: [], nLineas: 0, sepCentros: 0, rectificados: 0 };
  if (opts.ortogonal !== false && normales.some(n => n)) {
    const o = _replOrtogonalizar(THREE, P, normales, { diagonales: opts.diagonales });
    if (obst && obst.length) obst = _replRemapObstaculos(o, obst);
    P = o.pts; nSeg = o.nSeg; rectificados = o.rectificados;
  } else {
    nSeg = [];
    for (let i = 1; i < P.length; i++) nSeg.push(_replN(normales[i - 1]) || _replN(normales[i]));
  }
  const centro = { pts: P.map(p => p.clone()), nSeg: nSeg.slice() };
  if (obst && obst.length) { const d = _replDesviosSeg(THREE, P, nSeg, obst); P = d.pts; nSeg = d.nSeg; }
  // Fuera tramos de longitud nula: rompen la base local y el inglete de las paralelas.
  const Q = [P[0]], nQ = [];
  for (let i = 1; i < P.length; i++) { if (P[i].distanceTo(Q[Q.length - 1]) < 1e-3) continue; Q.push(P[i]); nQ.push(nSeg[i - 1] || null); }
  if (Q.length < 2) return { centro, lineas: [], nLineas: 0, sepCentros: 0, rectificados };
  const bases = [];
  for (let i = 1; i < Q.length; i++) bases.push(_replBaseTramo(THREE, Q[i - 1], Q[i], nQ[i - 1]));
  // Vuelo respecto a la superficie POR VÉRTICE (suma de las normales distintas de sus tramos): en
  // la esquina pared/techo el codo queda a 3 cm de las dos superficies y los dos tramos siguen en
  // ángulo recto, en vez de abrirse un hueco entre ellos como al desplazar cada tramo por su lado.
  const V = Q.map((q, j) => {
    const ns = [];
    [bases[j - 1], bases[j]].forEach(bs => { if (bs && bs.usaNormalReal && !ns.some(m => m.dot(bs.normal) > 0.95)) ns.push(bs.normal); });
    const p = q.clone(); ns.forEach(m => p.addScaledVector(m, REPL_TRAZADO.separacionPared)); return p;
  });
  // Líneas en paralelo: el mismo recorrido desplazado en el ancho (Z local), con inglete en cada
  // vértice para que todas giren a la vez sin abrirse ni cruzarse (mismos codos, misma separación).
  const par = opts.paralelos || {};
  const n = Math.max(1, Math.min(REPL_TRAZADO.maxParalelos, Math.round(+par.n || 1)));
  const hueco = (par.hueco_m != null && Number.isFinite(+par.hueco_m) && +par.hueco_m >= 0) ? +par.hueco_m : REPL_TRAZADO.huecoParaleloM;
  const sep = w + hueco;
  const lat = V.map((_, j) => {
    const za = bases[j - 1] ? bases[j - 1].zAxis : null, zb = bases[j] ? bases[j].zAxis : null;
    if (!za || !zb) return (za || zb).clone();
    const c = za.dot(zb);
    return c > -0.6 ? za.clone().add(zb).divideScalar(1 + c) : za.clone();
  });
  const lineas = [];
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * sep;
    lineas.push({ pts: V.map((p, j) => p.clone().addScaledVector(lat[j], off)), nSeg: nQ.slice() });
  }
  return { centro, lineas, nLineas: n, sepCentros: n > 1 ? sep : 0, rectificados };
}

// Longitud REAL del recorrido (rectificado en ángulo recto, sin quiebros de obstáculos, que el
// cálculo de material ya suma aparte): la que se mide en AR y se guarda como longitud_manual_m.
function _replLongitudTrazado(THREE, pts, opts) {
  const c = _replTrazadoPreparado(THREE, pts, { ...(opts || {}), obstaculos: null, paralelos: null }).centro.pts;
  let L = 0;
  for (let i = 1; i < c.length; i++) L += c[i - 1].distanceTo(c[i]);
  return L;
}

// Opciones de render guardadas en trazado_json (sin migración): `paralelos` { n, hueco_m } y, en
// cada punto de `puntos_3d`, `d: 1` si el tramo que EMPIEZA en él respeta la diagonal real.
function _replOpcionesTrazado(trazado) {
  const tr = trazado || {}, p3 = Array.isArray(tr.puntos_3d) ? tr.puntos_3d : [];
  const pr = tr.paralelos;
  const par = (pr && +pr.n > 1) ? { n: Math.min(REPL_TRAZADO.maxParalelos, Math.round(+pr.n)),
    hueco_m: (pr.hueco_m != null && Number.isFinite(+pr.hueco_m) && +pr.hueco_m >= 0) ? +pr.hueco_m : REPL_TRAZADO.huecoParaleloM } : null;
  return { diagonales: p3.map(p => !!(p && p.d)), paralelos: par };
}

// ── Superficie forzada por tramo y edición de puntos (prioridad 4) ──
// Adrián (18/09/2026, en obra): "la bandeja no detecta el techo... baja por debajo de
// instalaciones". El primer punto confirmado de un tramo en modo Techo/Pared/Suelo fija su
// plano; los siguientes se FUERZAN a él aunque el hit-test o la profundidad de ese fotograma den
// un dato raro (p. ej. la profundidad cae sobre una instalación existente bajo el techo).
function _replPlanoForzado(THREE, tipo, pos, normalDetectada, camDir) {
  const nd = _replN(normalDetectada);
  let n = null;
  if (nd && _replClaseNormal(nd) === tipo) n = nd;
  else if (tipo === 'techo') n = new THREE.Vector3(0, -1, 0);
  else if (tipo === 'suelo') n = new THREE.Vector3(0, 1, 0);
  else if (tipo === 'pared' && camDir) { const h = new THREE.Vector3(-camDir.x, 0, -camDir.z); if (h.lengthSq() > 1e-4) n = h.normalize(); }
  return (n && pos) ? { tipo, pos: pos.clone(), normal: n } : null;
}
// Lleva un punto candidato (hit/profundidad, o cualquier punto del rayo central) al plano fijado:
// corta el rayo cámara→punto con ese plano (donde apuntaba el usuario sobre ESA superficie); si
// el rayo es casi paralelo o queda detrás, proyección perpendicular.
function _replForzarAPlano(THREE, plano, p, camPos) {
  if (!plano) return p ? p.clone() : null;
  const n = plano.normal;
  if (camPos && p) {
    const dir = p.clone().sub(camPos), L = dir.length();
    if (L > 1e-4) {
      dir.divideScalar(L);
      const den = dir.dot(n);
      if (Math.abs(den) > 0.15) {
        const t = plano.pos.clone().sub(camPos).dot(n) / den;
        if (t > 0.05 && t < 15) return camPos.clone().addScaledVector(dir, t);
      }
    }
  }
  if (!p) return null;
  return p.clone().addScaledVector(n, -p.clone().sub(plano.pos).dot(n));
}
// "Pegar a techo/pared/suelo" un punto ya colocado: el plano detectado de ese tipo más cercano
// (proyección perpendicular, hasta maxDist). planos: [{ pos, normal, tipo?, excluida? }].
function _replPegarASuperficie(THREE, p, planos, tipo, maxDist) {
  const lim = maxDist == null ? REPL_TRAZADO.maxPegarM : maxDist;
  let mejor = null;
  (planos || []).forEach(pl => {
    if (!pl || pl.excluida) return;
    const n = _replN(pl.normal);
    if (!n || (pl.tipo || _replClaseNormal(n)) !== tipo) return;
    const d = p.clone().sub(pl.pos).dot(n);
    if (Math.abs(d) > lim) return;
    const q = p.clone().addScaledVector(n, -d);
    // Los planos son parches, no infinitos: penaliza el que queda lejos de su centro.
    const score = Math.abs(d) + 0.25 * Math.max(0, q.distanceTo(pl.pos) - 1.5);
    if (!mejor || score < mejor.score) mejor = { pos: q, normal: n, score };
  });
  return mejor ? { pos: mejor.pos, normal: mejor.normal } : null;
}
// "Esquivar instalación": desplaza el punto SOBRE su superficie (sin despegarlo) hasta quedar
// fuera de las instalaciones existentes que situó la IA del escaneo (radio + margen).
// instalaciones: [{ pos, radio, etiqueta }]. null si el punto no toca ninguna.
function _replEsquivarInstalacion(THREE, p, normal, instalaciones, margen) {
  const m = margen == null ? 0.05 : margen, n = _replN(normal);
  let q = p.clone();
  const tocadas = [];
  for (let it = 0; it < 4; it++) {
    let peor = null;
    (instalaciones || []).forEach(i => { const d = i.pos.distanceTo(q) - i.radio; if (d < m - 1e-4 && (!peor || d < peor.d)) peor = { i, d }; });
    if (!peor) break;
    const c = peor.i.pos, R = peor.i.radio + m;
    let h = 0, base = c.clone();
    if (n) { h = c.clone().sub(q).dot(n); base = c.clone().addScaledVector(n, -h); }
    const r = Math.sqrt(Math.max(0, R * R - h * h));
    const v = q.clone().sub(base);
    if (n) v.addScaledVector(n, -v.dot(n));
    if (v.lengthSq() < 1e-8) {
      if (n) v.crossVectors(n, Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
      else v.set(1, 0, 0);
    }
    q = base.addScaledVector(v.normalize(), r + 1e-3);
    if (!tocadas.includes(peor.i)) tocadas.push(peor.i);
  }
  return tocadas.length ? { pos: q, instalaciones: tocadas } : null;
}
// Punto colocado al que apunta un toque en pantalla (rayo origen+dir): índice, o -1 si ninguno
// cae dentro de `maxAng` radianes (por defecto ~7°).
function _replPuntoMasCercano(THREE, puntos, origen, dir, maxAng) {
  let mejor = -1, mejorAng = maxAng == null ? 0.12 : maxAng;
  const d = dir.clone().normalize();
  (puntos || []).forEach((p, i) => {
    const v = p.clone().sub(origen);
    if (v.lengthSq() < 1e-6) return;
    const ang = v.angleTo(d);
    if (ang < mejorAng) { mejorAng = ang; mejor = i; }
  });
  return mejor;
}

function _replInstal3D(THREE, pts, opts) {
  opts = opts || {}; const tipo = opts.tipo || 'tubo', w = opts.w || 0.2, op = opts.opacity != null ? opts.opacity : 1;
  // Ángulos rectos, obstáculos, vuelo de la superficie y paralelas: _replTrazadoPreparado.
  const prep = _replTrazadoPreparado(THREE, pts, opts);
  const g = new THREE.Group();
  const M = (c, met, ro) => new THREE.MeshStandardMaterial({ color: c, metalness: met, roughness: ro, transparent: op < 1, opacity: op, side: THREE.DoubleSide });
  const matTubo = M(0xcdd4dd, .12, .7), matMetal = M(0x9aa7b6, .75, .45), matAcc = M(0x3b424d, .4, .6);
  const rTubo = Math.max(0.008, w / 2);
  prep.lineas.forEach(linea => {
    const L = linea.pts;
    for (let i = 1; i < L.length; i++) {
      const bs = _replBaseTramo(THREE, L[i - 1], L[i], linea.nSeg[i - 1]), len = bs.len;
      if (len < 1e-3) continue;
      const sub = new THREE.Group();
      sub.position.copy(L[i - 1]).add(L[i]).multiplyScalar(0.5);
      sub.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(bs.dirN, bs.yAxis, bs.zAxis));
      g.add(sub);
      if (tipo === 'tubo') {
        sub.add(new THREE.Mesh(new THREE.CylinderGeometry(rTubo, rTubo, len, 20, 1, true).rotateZ(Math.PI / 2), matTubo));
        const n = Math.max(1, Math.floor(len / 0.6));                                   // grapas cada ~0,6 m
        for (let k = 1; k < n; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(rTubo * 1.2, rTubo * 0.22, 8, 14), matAcc); t.rotation.y = Math.PI / 2; t.position.x = -len / 2 + k * (len / n); sub.add(t); }
      } else if (tipo === 'rejiband') {
        const rr = 0.004;
        for (const zf of [-0.5, -0.17, 0.17, 0.5]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, len, 6).rotateZ(Math.PI / 2), matMetal); l.position.z = zf * w; sub.add(l); }
        const nt = Math.max(1, Math.floor(len / 0.1));
        for (let k = 0; k <= nt; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, w, 6).rotateX(Math.PI / 2), matMetal); c.position.x = -len / 2 + k * (len / nt); sub.add(c); }
        for (const zf of [-0.5, 0.5]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.5, rr * 1.5, len, 8).rotateZ(Math.PI / 2), matMetal); e.position.set(0, 0.03, zf * w); sub.add(e); }
      } else if (tipo === 'escalera') {
        for (const zf of [-0.5, 0.5]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.02), matMetal); rl.position.z = zf * w; sub.add(rl); }
        const nt = Math.max(1, Math.floor(len / 0.28));
        for (let k = 0; k <= nt; k++) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, w), matMetal); rung.position.x = -len / 2 + k * (len / nt); sub.add(rung); }
      } else if (tipo === 'chapa') {
        sub.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.006, w), matMetal));
        for (const zf of [-0.5, 0.5]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.006), matMetal); wall.position.set(0, 0.025, zf * w); sub.add(wall); }
      } else if (tipo === 'canal') {
        sub.add(new THREE.Mesh(new THREE.BoxGeometry(len, w * 0.7, w), M(0xeef1f5, .1, .7)));
      } else { sub.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, w), matMetal)); }
      if (tipo !== 'tubo' && tipo !== 'canal') { const ns = Math.floor(len / 1.5); for (let k = 1; k <= ns; k++) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, w * 1.1), matAcc); br.position.set(-len / 2 + k * (len / (ns + 1)), -0.03, 0); sub.add(br); } }
    }
    // CODO-SIN-CAJA-AUTO-01 (17/09/2026): Adrián -- "en cada punto pone una caja y no es así
    // siempre, las cajas las marco yo luego. El tiene que poner curvas." caja_cada_m en las reglas
    // del catálogo (worker.js) es una cuenta para la LISTA DE MATERIAL, no una orden de "dibuja
    // una caja en cada vértice". Las cajas de registro/mecanismo son complementos que el usuario
    // coloca a mano (_replComplemento3D). En un codo de tubo solo se ve el propio tubo doblando:
    // una esfera algo más ancha que el tubo, como el bulto real de un accesorio de curva.
    for (let i = 1; i < L.length - 1; i++) {
      const p = L[i];
      if (tipo === 'tubo') { const codo = new THREE.Mesh(new THREE.SphereGeometry(rTubo * 1.15, 16, 16), matTubo); codo.position.copy(p); g.add(codo); }
      else { const codo = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, w), matMetal); codo.position.copy(p); g.add(codo); }
    }
  });
  g.userData.trazado = { lineas: prep.nLineas, rectificados: prep.rectificados };
  return g;
}

// ══════════════════════════════════════════════════════════════════════════
// ADR-0027 — Escaneo del entorno + IA de visión en tiempo real (03/10/2026)
// ══════════════════════════════════════════════════════════════════════════
// Compartido por el AR WebXR de la PWA (index.html), el overlay del AR nativo de la APK
// (assets/ar/overlay.html, copia exacta de este archivo) y los informes (index.html y
// panel.html). Mismo criterio que el resto del archivo: funciones puras, THREE por parámetro,
// sin estado global. Convención de cámara de un fotograma: `camara.pose` es la matriz de
// MUNDO de la cámara (column-major, 16 números) y `camara.proj` su proyección -- las mismas
// matrices con las que se pintó el AR, así que proyectar/desproyectar con ellas encaja con la
// imagen real capturada en ese instante.
const REPL_ESCANEO = {
  intervaloMs: 3000,      // un fotograma a la IA cada 3 s (límite de coste aprobado por Adrián)
  maxIA: 40,              // tope por sesión; el servidor lo aplica igualmente
  minFramesIA: 3,         // fotogramas analizados antes de dar el escaneo por bueno
  minPlanosSinIA: 2,      // sin IA: basta con que ARCore confirme dos superficies
  maxGuardados: 16,       // fotogramas clave para el fondo del informe
  ladoImagen: 768,        // lado mayor del JPEG que se envía (coste y latencia)
  avisoM: 0.25,           // margen para avisar de que se marca sobre una instalación existente
};

// ¿Se puede dejar de escanear y empezar a marcar? e: { planos, framesIA, iaActiva, segundos }.
// Nunca bloquea para siempre: el cartel ofrece además "Continuar sin IA" (degradar, no bloquear).
function _replEscaneoSuficiente(e) {
  const planos = e.planos | 0, ia = e.framesIA | 0, seg = +e.segundos || 0;
  if (e.iaActiva) {
    if (ia >= REPL_ESCANEO.minFramesIA && planos >= 1) return { ok: true, texto: 'Entorno escaneado' };
    // Paredes lisas: ARCore puede no confirmar ningún plano aunque la IA ya vea la sala.
    if (ia >= REPL_ESCANEO.minFramesIA + 2 && seg >= 12) return { ok: true, texto: 'Entorno escaneado (pocas superficies confirmadas: marca con cuidado)' };
    const faltan = [];
    if (ia < REPL_ESCANEO.minFramesIA) faltan.push(`${REPL_ESCANEO.minFramesIA - ia} fotograma(s) más para la IA`);
    if (planos < 1) faltan.push('alguna superficie confirmada');
    return { ok: false, texto: 'Falta: ' + faltan.join(' y ') };
  }
  if (planos >= REPL_ESCANEO.minPlanosSinIA) return { ok: true, texto: 'Superficies detectadas (sin IA)' };
  return { ok: false, texto: `Falta: ${REPL_ESCANEO.minPlanosSinIA - planos} superficie(s) más` };
}

// Punto del mundo -> imagen del fotograma: { u, v } en 0..1 (v hacia abajo), delante y distancia.
function _replEscaneoProyectar(THREE, camara, p) {
  const vista = new THREE.Matrix4().fromArray(camara.pose).invert();
  const q = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(vista);
  const dist = -q.z;
  q.applyMatrix4(new THREE.Matrix4().fromArray(camara.proj));
  if (!(q.w > 0) || dist <= 0) return null;
  return { u: (q.x / q.w) * 0.5 + 0.5, v: 1 - ((q.y / q.w) * 0.5 + 0.5), dist };
}

// Rayo del mundo que pasa por (u, v) de la imagen de ese fotograma.
function _replEscaneoRayo(THREE, camara, u, v) {
  const pose = new THREE.Matrix4().fromArray(camara.pose);
  const enCamara = new THREE.Vector3(u * 2 - 1, (1 - v) * 2 - 1, 0.5).applyMatrix4(new THREE.Matrix4().fromArray(camara.proj).invert());
  const origen = new THREE.Vector3().setFromMatrixPosition(pose);
  const dir = enCamara.applyMatrix4(pose).sub(origen).normalize();
  return { origen, dir };
}

// Corta el rayo con los planos detectados ({pos, normal} en metros). Solo cuenta un corte
// razonablemente cerca del centro del plano (los planos de ARCore/WebXR son parches, no
// infinitos). Devuelve { pos, plano, t } del corte más cercano por delante, o null.
function _replEscaneoCortarPlanos(rayo, planos, maxDist) {
  let mejor = null;
  (planos || []).forEach(pl => {
    const den = rayo.dir.dot(pl.normal);
    if (Math.abs(den) < 1e-4) return;
    const t = pl.pos.clone().sub(rayo.origen).dot(pl.normal) / den;
    if (!(t > 0.1) || t > (maxDist || 8)) return;
    const pos = rayo.origen.clone().add(rayo.dir.clone().multiplyScalar(t));
    if (pos.distanceTo(pl.pos) > 3.5) return;
    if (!mejor || t < mejor.t) mejor = { pos, plano: pl, t };
  });
  return mejor;
}

// Instalaciones existentes que la IA vio en un fotograma -> posiciones 3D aproximadas.
// `distRespaldo` (p. ej. la profundidad del centro) se usa si el rayo no corta ningún plano.
function _replEscaneoUbicar(THREE, analisis, camara, planos, distRespaldo) {
  const out = [];
  ((analisis && analisis.instalaciones) || []).forEach(i => {
    if (!i.bbox || (i.confianza != null && i.confianza < 0.5)) return;
    const [x0, y0, x1, y1] = i.bbox;
    const rayo = _replEscaneoRayo(THREE, camara, (x0 + x1) / 2, (y0 + y1) / 2);
    const corte = _replEscaneoCortarPlanos(rayo, planos, 8);
    const t = corte ? corte.t : (distRespaldo > 0 ? distRespaldo : 0);
    if (!t) return;
    // Radio a partir del ancho angular de la caja: suficiente para avisar, no para medir.
    const a = _replEscaneoRayo(THREE, camara, x0, (y0 + y1) / 2).dir, b = _replEscaneoRayo(THREE, camara, x1, (y0 + y1) / 2).dir;
    const radio = Math.max(0.12, Math.min(1.2, Math.tan(a.angleTo(b) / 2) * t));
    out.push({ tipo: i.tipo, etiqueta: i.etiqueta, confianza: i.confianza, pos: rayo.origen.clone().add(rayo.dir.clone().multiplyScalar(t)), radio, sobrePlano: !!corte });
  });
  return out;
}

// Une lo nuevo con lo ya conocido: mismo tipo a menos de 0,5 m es la misma instalación vista
// otra vez (se promedia la posición). Tope para no crecer sin límite en una sesión larga.
function _replEscaneoFusionar(conocidas, nuevas) {
  const lista = (conocidas || []).slice();
  (nuevas || []).forEach(n => {
    const ya = lista.find(c => c.tipo === n.tipo && c.pos.distanceTo(n.pos) < 0.5);
    if (ya) { const k = ya.veces || 1; ya.pos.multiplyScalar(k).add(n.pos).multiplyScalar(1 / (k + 1)); ya.radio = Math.max(ya.radio, n.radio); ya.veces = k + 1; }
    else if (lista.length < 30) lista.push({ ...n, veces: 1 });
  });
  return lista;
}

// Instalación existente sobre la que cae un punto que se va a marcar, o null.
function _replEscaneoCercana(instalaciones, p, margen) {
  let mejor = null;
  (instalaciones || []).forEach(i => {
    const d = i.pos.distanceTo(p) - i.radio;
    if (d <= (margen == null ? REPL_ESCANEO.avisoM : margen) && (!mejor || d < mejor.d)) mejor = { inst: i, d };
  });
  return mejor ? mejor.inst : null;
}

// Clase final de un plano: la geometría manda en vertical/horizontal; la IA decide suelo vs
// techo en los horizontales y puede excluir un plano que en realidad es un mueble/mesa.
// votos: { pared: n, suelo: n, techo: n, mueble: n, otro: n }.
function _replEscaneoClasePlano(tipoGeom, votos) {
  const v = votos || {};
  const total = Object.keys(v).reduce((s, k) => s + (v[k] || 0), 0);
  if (!total) return tipoGeom;
  let mejor = null; Object.keys(v).forEach(k => { if (!mejor || v[k] > v[mejor]) mejor = k; });
  if ((mejor === 'mueble' || mejor === 'otro') && v[mejor] >= Math.max(1, total * 0.6)) return mejor;
  if (tipoGeom === 'pared') return 'pared';
  return (mejor === 'suelo' || mejor === 'techo') ? mejor : tipoGeom;
}

// Mejor fotograma clave para el informe: el que ve más puntos del recorrido dentro de la
// imagen; a igualdad, el que los encuadra mejor y el más tardío (al final ya está todo).
function _replEscaneoMejorFrame(THREE, frames, puntos) {
  let mejor = null;
  (frames || []).forEach((f, idx) => {
    if (!f || !f.camara || !f.camara.pose || !f.camara.proj) return;
    const vis = [];
    (puntos || []).forEach(p => { const q = _replEscaneoProyectar(THREE, f.camara, p); if (q && q.u > 0.02 && q.u < 0.98 && q.v > 0.02 && q.v < 0.98) vis.push(q); });
    let encuadre = 0;
    if (vis.length >= 2) {
      const us = vis.map(q => q.u), vs = vis.map(q => q.v);
      const area = (Math.max(...us) - Math.min(...us)) * (Math.max(...vs) - Math.min(...vs));
      encuadre = 1 - Math.min(1, Math.abs(area - 0.35) / 0.35);
    }
    const score = vis.length * 10 + encuadre * 5 + (f.fase === 'final' ? 2 : 0) + idx * 0.01;
    if (!mejor || score > mejor.score) mejor = { frame: f, visibles: vis.length, score };
  });
  return mejor;
}

// Pinta `objeto` (instalación en coordenadas de mundo AR) sobre la imagen real del fotograma,
// con la MISMA cámara con la que se capturó -- así la instalación queda donde se marcó, pegada a
// la pared/techo real, no "flotando". Marca además las instalaciones existentes que vio la IA.
// Devuelve un data URL JPEG, o null si no se puede (sin WebGL, imagen corrupta...).
function _replEscaneoComponer(THREE, objeto, frame, img, opts) {
  try {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    const s = Math.min(1, ((opts && opts.maxAncho) || 1400) / iw);
    const W = Math.round(iw * s), H = Math.round(ih * s);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333844, 1.2));
    const dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(1.5, 2.5, 1.5); scene.add(dl);
    scene.add(objeto);
    const cam = new THREE.PerspectiveCamera();
    cam.matrixAutoUpdate = false; cam.matrixWorldAutoUpdate = false;
    cam.matrixWorld.fromArray(frame.camara.pose); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    cam.projectionMatrix.fromArray(frame.camara.proj); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    renderer.render(scene, cam);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const c = out.getContext('2d');
    c.drawImage(img, 0, 0, W, H);
    c.drawImage(canvas, 0, 0);
    // Instalaciones existentes detectadas por la IA en ESTE fotograma (cajas discontinuas).
    c.lineWidth = Math.max(2, W / 500); c.font = `bold ${Math.max(12, Math.round(W / 70))}px sans-serif`; c.textBaseline = 'bottom';
    (frame.instalaciones || []).forEach(i => {
      if (!i.bbox || (i.confianza != null && i.confianza < 0.5)) return;
      const [x0, y0, x1, y1] = i.bbox;
      c.setLineDash([8, 6]); c.strokeStyle = '#facc15'; c.strokeRect(x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H); c.setLineDash([]);
      const t = 'Existente: ' + (i.etiqueta || i.tipo);
      const tw = c.measureText(t).width + 10, th = Math.max(16, Math.round(W / 55));
      c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(x0 * W, Math.max(0, y0 * H - th), tw, th);
      c.fillStyle = '#facc15'; c.fillText(t, x0 * W + 5, Math.max(th, y0 * H) - 2);
    });
    try { renderer.dispose(); } catch (_) {}
    return out.toDataURL('image/jpeg', 0.9);
  } catch (e) { return null; }
}

// Etiqueta flotante (sprite) para el AR en vivo: qué es cada superficie/instalación según la IA.
function _replEscaneoEtiqueta(THREE, txt, color) {
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0, 0, 320, 64);
  c.fillStyle = color || '#facc15'; c.fillRect(0, 0, 8, 64);
  c.font = 'bold 30px sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(String(txt).slice(0, 22), 164, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
  sp.scale.set(0.4, 0.08, 1);
  return sp;
}
