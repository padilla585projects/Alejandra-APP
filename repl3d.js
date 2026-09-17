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
  const up = new THREE.Vector3(0, 1, 0), bySeg = {};
  obst.forEach(o => { if (o && o.seg != null && o.t != null) (bySeg[o.seg] = bySeg[o.seg] || []).push(o); });
  Object.values(bySeg).forEach(a => a.sort((x, y) => x.t - y.t));
  const out = [pts[0].clone()];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], segObst = bySeg[i - 1] || [];
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
    }
    out.push(b.clone());
  }
  return out;
}
function _replInstal3D(THREE, pts, opts) {
  opts = opts || {}; const tipo = opts.tipo || 'tubo', w = opts.w || 0.2, op = opts.opacity != null ? opts.opacity : 1;
  // LIMITACIÓN CONOCIDA: si hay obstáculos, _replConDesvios inserta puntos nuevos (los del
  // quiebro) y desplaza los índices -- opts.normales (abajo) sigue alineado a los puntos
  // ORIGINALES, así que en los tramos de quiebro se cae al respaldo de "arriba" genérico en vez
  // de la normal real. No pasa nada grave (no rompe, solo pierde precisión ahí) -- pero si algún
  // día se necesita perfecto también en los quiebros, _replConDesvios tendría que propagar la
  // normal del punto de origen a cada punto que inserta.
  if (opts.obstaculos) pts = _replConDesvios(THREE, pts, opts.obstaculos);
  const g = new THREE.Group();
  const M = (c, met, ro) => new THREE.MeshStandardMaterial({ color: c, metalness: met, roughness: ro, transparent: op < 1, opacity: op, side: THREE.DoubleSide });
  const matTubo = M(0xcdd4dd, .12, .7), matMetal = M(0x9aa7b6, .75, .45), matAcc = M(0x3b424d, .4, .6);
  const rTubo = Math.max(0.008, w / 2);
  // REJIBAND-DE-CARA-01 (17/09/2026): Adrián, probando en AR con un tramo casi vertical --
  // "el rejiband se ha colocado mirando hacia la cámara... perpendicular a la pared". Antes se
  // orientaba cada tramo con setFromUnitVectors(X, dir) -- da la rotación MÍNIMA de +X a la
  // dirección del tramo, pero no dice nada de en qué ángulo queda el "ancho" (eje local Z, donde
  // van los railes/paredes de rejiband, escalera, chapa, canal) alrededor de ese eje: para un
  // tramo casi vertical esa rotación mínima resulta -- por pura geometría del giro más corto --
  // en que el ancho acaba apuntando hacia la cámara/profundidad en vez de a lo largo de la
  // pared. Se construye la base a mano con una referencia "arriba" estable en vez de esa
  // rotación mínima.
  //
  // PARED-NORMAL-REAL-01 (17/09/2026): Adrián, después -- "no queda pegada a la pared como una
  // instalación real". El motivo: esta función solo recibía puntos (x,y,z), nunca la orientación
  // real de la superficie en cada uno -- así que no había forma de saber hacia qué lado cae la
  // pared, y el ancho/grosor se construían con una referencia "arriba del mundo" genérica, sin
  // relación con la pared física. opts.normales (opcional, un THREE.Vector3 por punto de pts, o
  // null si no se conoce -- el AR nativo SÍ la tiene, viene del eje Y de la pose de cada ancla de
  // ARCore, igual convención que normalDeQuat() en index.html) es la referencia real cuando existe
  // -- así el ancho (Z local) cae en el plano de la pared de verdad, y el alto/grosor (Y local)
  // apunta hacia fuera de la pared en vez de "hacia arriba" genérico. Sin normal (plano 2D de una
  // foto, o el propio AR antes de tener el dato) se mantiene el respaldo de arriba, que ya es
  // mejor que la rotación mínima de antes.
  const arribaMundo = new THREE.Vector3(0, 1, 0);
  const normales = opts.normales || [];
  // Separación de la pared para que el material no quede enterrado en ella ni flotando -- mismo
  // criterio que una abrazadera/soporte real (unos pocos cm de vuelo), no pegado a piel.
  const separacionPared = 0.03;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); if (len < 1e-3) continue;
    const dirN = dir.clone().normalize();
    const normalReal = normales[i - 1] || normales[i];
    let arriba;
    if (normalReal && normalReal.lengthSq() > 0.25) {
      arriba = normalReal.clone().normalize();
    } else {
      // Sin normal real (foto 2D, o tramo casi vertical con arriba degenerado): referencia fija.
      arriba = Math.abs(dirN.dot(arribaMundo)) > 0.999 ? new THREE.Vector3(0, 0, 1) : arribaMundo;
    }
    const zAxis = new THREE.Vector3().crossVectors(dirN, arriba).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, dirN).normalize();
    const sub = new THREE.Group();
    sub.position.copy(a).addScaledVector(dir, 0.5);
    if (normalReal && normalReal.lengthSq() > 0.25) sub.position.addScaledVector(yAxis, separacionPared);
    sub.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dirN, yAxis, zAxis));
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
  // del catálogo (worker.js) es una cuenta para la LISTA DE MATERIAL (cuántas cajas de registro
  // hacen falta cada 15 m o en los giros), no una orden de "dibuja una caja en cada vértice" --
  // aquí se estaba confundiendo ambas cosas. Las cajas de registro/mecanismo ya son complementos
  // que el usuario coloca a mano donde tocan de verdad (_replComplemento3D, 'caja_registro'/
  // 'caja_mecanismo'). En un codo de tubo solo debe verse el propio tubo doblando -- una esfera
  // algo más ancha que el tubo, como el bulto real de un accesorio de curva/codo atornillado.
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    if (tipo === 'tubo') { const codo = new THREE.Mesh(new THREE.SphereGeometry(rTubo * 1.15, 16, 16), matTubo); codo.position.copy(p); g.add(codo); }
    else { const codo = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, w), matMetal); codo.position.copy(p); g.add(codo); }
  }
  return g;
}
