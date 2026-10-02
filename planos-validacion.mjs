// IA-QUALITY-09 (03/10/2026): validador determinista del archivo SVG de un plano.
//
// QA ID 28: el chat afirmó un aviso QA que no estaba en el archivo. Un plano no se
// da por válido por lo que diga la respuesta del modelo: este módulo comprueba el
// ARCHIVO que se va a guardar (XML bien formado, elementos y atributos esperados,
// coordenadas numéricas finitas, viewBox coherente, cotas visibles) e incrusta los
// avisos obligatorios de forma determinista, sin depender de que el modelo los
// escriba. El resultado devuelve los avisos realmente presentes en el archivo.
//
// No acredita geometría completa, soportes, cargas ni cumplimiento normativo: solo
// que el archivo es coherente y que lo que se afirma de él está dentro.
import { SaxesParser } from 'saxes';
import { extraerCotasTexto, cotaCoincide } from './alejandra-agente/planos-cotas.js';

export { extraerCotasTexto, cotaCoincide };

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const ID_BLOQUE_AVISOS = 'alejandra-avisos-qa';
export const ID_METADATA_ALCANCE = 'alejandra-alcance-plano';
export const VERSION_VALIDADOR = 'planos-validacion v1';
const MAX_BYTES = 524288;
const TIPOS_DIMENSIONALES = new Set(['planta', 'bandejas', 'mecanico', 'planta_electrica', 'planta_industrial']);

// Errores de contenido del plano: el mensaje es explicativo y seguro para el usuario
// (no contiene detalles del proveedor de IA, ver ERROR-IA-OCULTO-01).
export class PlanoValidacionError extends Error {
  constructor(motivo) {
    super(/No se ha guardado/.test(motivo) ? motivo : `${motivo} No se ha guardado.`);
    this.name = 'PlanoValidacionError';
    this.validacionPlano = true;
  }
}

const fallo = motivo => { throw new PlanoValidacionError(motivo); };

const ELEMENTOS_SVG = new Set([
  'svg', 'g', 'defs', 'symbol', 'use', 'line', 'rect', 'circle', 'ellipse', 'polyline', 'polygon',
  'path', 'text', 'tspan', 'textPath', 'title', 'desc', 'metadata', 'style', 'marker', 'pattern',
  'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'image', 'filter',
  'feGaussianBlur', 'feOffset', 'feBlend', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode',
  'feColorMatrix', 'feDropShadow',
]);
// Coordenadas y tamaños: un valor vacío, NaN o Infinity aquí es un dibujo roto.
const ATRIBUTOS_GEOMETRIA = new Set(['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height']);
const ATRIBUTOS_NO_NEGATIVOS = new Set(['r', 'rx', 'ry', 'width', 'height']);
const ATRIBUTOS_LISTA_TEXTO = new Set(['x', 'y', 'dx', 'dy', 'rotate']);
const ATRIBUTOS_TEXTO_LIBRE = new Set(['id', 'class', 'font-family', 'href', 'aria-label', 'lang']);
const NUMERO = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:px|pt|pc|mm|cm|in|em|ex|rem|%)?$/i;
const NUMERO_PURO = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const NO_NUMERICO = /\b(?:NaN|-?Infinity|undefined)\b/;

export function normalizarTextoAviso(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

const escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Avisos que TODO plano generado por IA debe llevar dentro del archivo. Incluye el
// alcance de IA-QUALITY-08 (borrador_tecnico/boceto_preliminar, apto_para_ejecucion=false).
export function avisosObligatoriosPlano(contrato = {}) {
  const boceto = contrato && contrato.modo === 'boceto_preliminar';
  const avisos = [
    { id: 'borrador', texto: boceto ? 'BOCETO PRELIMINAR — datos pendientes' : 'BORRADOR — pendiente de revisión técnica' },
  ];
  if (!contrato || contrato.tipo !== 'gantt') avisos.push({ id: 'no_ejecutar', texto: 'NO EJECUTAR EN OBRA' });
  avisos.push({
    id: 'alcance',
    texto: boceto
      ? 'Tipo de documento: boceto preliminar · Apto para ejecución: NO'
      : 'Tipo de documento: borrador técnico generado por IA · Apto para ejecución: NO',
  });
  avisos.push({ id: 'revision', texto: 'Sin validación geométrica ni normativa. Requiere revisión de un técnico competente.' });
  if (contrato && contrato.anotacion_montaje) avisos.push({ id: 'montaje', texto: contrato.anotacion_montaje });
  return avisos;
}

export function alcanceArchivoPlano(contrato = {}) {
  const boceto = contrato && contrato.modo === 'boceto_preliminar';
  return { tipo_documento: boceto ? 'boceto_preliminar' : 'borrador_tecnico', apto_para_ejecucion: false };
}

// Cotas que el usuario aportó y el plano debe mostrar (valor en metros). Entrada
// de servidor a servidor: se rechaza en vez de corregirse.
export function normalizarCotasEntrada(cotas) {
  if (cotas == null) return [];
  if (!Array.isArray(cotas) || cotas.length > 40) fallo('Cotas de entrada invalidas.');
  return cotas.map(c => {
    const valor = c && c.valor_m;
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > 100000) fallo('Cotas de entrada invalidas.');
    const etiqueta = typeof c.etiqueta === 'string' ? c.etiqueta.replace(/[\u0000-\u001f<>&"]/g, ' ').trim().slice(0, 80) : '';
    return { etiqueta, valor_m: valor };
  });
}

function leerAtributosRaiz(tag) {
  const attrs = [];
  for (const m of tag.matchAll(/\s([\w:.-]+)\s*=\s*("[^"]*"|'[^']*')/g)) attrs.push([m[1], m[2].slice(1, -1)]);
  return attrs;
}

function parseLongitud(valor) {
  const m = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(String(valor || ''));
  return m ? { n: Number(m[1]), u: m[2] || '' } : null;
}

function parseViewBox(valor) {
  if (typeof valor !== 'string') return null;
  const partes = valor.trim().split(/[\s,]+/);
  if (partes.length !== 4 || !partes.every(p => NUMERO_PURO.test(p))) return null;
  const [x, y, w, h] = partes.map(Number);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || w > 1e7 || h > 1e7) return null;
  return { x, y, w, h };
}

const num = n => String(Math.round(n * 100) / 100);

// Añade al final del SVG un bloque visible con los avisos obligatorios, en una franja
// propia bajo el dibujo (amplía el viewBox, no tapa nada), y un <metadata> con el
// alcance en JSON. Determinista: mismo SVG y contrato, mismo resultado.
export function incrustarAvisosPlano(svg, contrato = {}) {
  if (typeof svg !== 'string') fallo('Plano sin contenido SVG.');
  if (svg.includes(ID_BLOQUE_AVISOS) || svg.includes(ID_METADATA_ALCANCE)) {
    fallo('Plano con identificadores reservados para los avisos del sistema.');
  }
  const inicio = svg.search(/<svg\b/i);
  if (inicio < 0) fallo('Plano sin contenedor SVG.');
  const finTag = /^<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(svg.slice(inicio));
  if (!finTag || /\/>$/.test(finTag[0])) fallo('Plano vacio: el contenedor SVG no tiene contenido.');
  const tag = finTag[0];
  const attrs = leerAtributosRaiz(tag);
  const get = nombre => (attrs.find(([k]) => k === nombre) || [])[1];
  let vb = parseViewBox(get('viewBox'));
  if (!vb) {
    if (get('viewBox') !== undefined) fallo('Plano con viewBox invalido.');
    const w = parseLongitud(get('width')), h = parseLongitud(get('height'));
    if (!w || !h || (w.u && w.u !== 'px') || (h.u && h.u !== 'px') || !(w.n > 0) || !(h.n > 0)) {
      fallo('Plano sin viewBox ni dimensiones numericas: no se puede verificar su encuadre.');
    }
    vb = { x: 0, y: 0, w: w.n, h: h.n };
  }
  const avisos = avisosObligatoriosPlano(contrato);
  const fs = Math.min(48, Math.max(4, vb.w / 55));
  const lh = fs * 1.45;
  const pad = fs * 0.8;
  const alto = pad * 2 + lh * avisos.length;
  const y0 = vb.y + vb.h;
  const nuevoVb = `${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h + alto)}`;

  const otros = attrs.filter(([k]) => k !== 'viewBox' && k !== 'height');
  const hAttr = get('height');
  const hLong = parseLongitud(hAttr);
  const nuevos = [...otros, ['viewBox', nuevoVb]];
  if (hAttr !== undefined) {
    // Altura absoluta: se amplía en la misma proporción para no deformar el dibujo.
    nuevos.push(['height', hLong && hLong.n > 0 ? `${num(hLong.n * (vb.h + alto) / vb.h)}${hLong.u}` : hAttr]);
  }
  const nuevoTag = `<svg ${nuevos.map(([k, v]) => `${k}="${escXml(v)}"`).join(' ')}>`;

  const lineas = avisos.map((a, i) => {
    const y = y0 + pad + lh * i + fs;
    const peso = i < 2 ? ' font-weight="bold"' : '';
    return `<text x="${num(vb.x + pad)}" y="${num(y)}" font-size="${num(fs)}"${peso} fill="#b00020" data-aviso="${a.id}">${escXml(a.texto)}</text>`;
  }).join('\n');
  const bloque = `<g id="${ID_BLOQUE_AVISOS}" font-family="Arial, Helvetica, sans-serif">
<rect x="${num(vb.x)}" y="${num(y0)}" width="${num(vb.w)}" height="${num(alto)}" fill="#fff4f4" stroke="#b00020" stroke-width="${num(Math.max(0.5, fs / 10))}"/>
${lineas}
</g>`;
  const meta = JSON.stringify({ ...alcanceArchivoPlano(contrato), avisos: avisos.map(a => a.id), validador: VERSION_VALIDADOR });
  const metadata = `<metadata id="${ID_METADATA_ALCANCE}">${escXml(meta)}</metadata>`;
  const cierre = svg.lastIndexOf('</svg');
  if (cierre < inicio) fallo('Plano incompleto: falta el cierre SVG.');
  return svg.slice(0, inicio) + nuevoTag + svg.slice(inicio + tag.length, cierre)
    + `${metadata}\n${bloque}\n` + svg.slice(cierre);
}

function comprobarAtributo(elemento, nombre, valor) {
  if (/^on/i.test(nombre)) fallo(`Plano no estatico: atributo de evento ${nombre}.`);
  if (/url\(\s*['"]?\s*(?!#)/i.test(valor)) fallo('Plano con recursos externos (url).');
  if (ATRIBUTOS_TEXTO_LIBRE.has(nombre) || nombre.startsWith('data-')) return;
  if (NO_NUMERICO.test(valor)) fallo(`Plano con valor no numerico en ${elemento} ${nombre}="${valor.slice(0, 40)}".`);
  const v = valor.trim();
  const esTexto = elemento === 'text' || elemento === 'tspan';
  if (esTexto && ATRIBUTOS_LISTA_TEXTO.has(nombre)) {
    if (!v || !v.split(/[\s,]+/).every(p => NUMERO.test(p))) fallo(`Plano con coordenada invalida en ${elemento} ${nombre}.`);
    return;
  }
  if (ATRIBUTOS_GEOMETRIA.has(nombre)) {
    if (!v) fallo(`Plano con coordenada vacia en ${elemento} ${nombre}.`);
    if (/^(?:auto|inherit)$/i.test(v) && (nombre === 'width' || nombre === 'height')) return;
    if (!NUMERO.test(v)) fallo(`Plano con coordenada invalida en ${elemento} ${nombre}="${v.slice(0, 40)}".`);
    if (ATRIBUTOS_NO_NEGATIVOS.has(nombre) && parseFloat(v) < 0) fallo(`Plano con dimension negativa en ${elemento} ${nombre}.`);
    if (!Number.isFinite(parseFloat(v))) fallo(`Plano con coordenada no finita en ${elemento} ${nombre}.`);
    return;
  }
  if (nombre === 'points') {
    const p = v.split(/[\s,]+/).filter(Boolean);
    if (p.length < 2 || p.length % 2 !== 0 || !p.every(n => NUMERO_PURO.test(n))) fallo(`Plano con puntos invalidos en ${elemento}.`);
    return;
  }
  if (nombre === 'd') {
    if (!v || !/^[MmZzLlHhVvCcSsQqTtAa0-9eE+\-.,\s]+$/.test(v) || !/^\s*[Mm]/.test(v)) fallo('Plano con trazado (path d) invalido.');
    return;
  }
  if (nombre === 'viewBox' && !parseViewBox(v)) fallo(`Plano con viewBox invalido en ${elemento}.`);
}

// Validación completa y determinista del archivo final. Lanza PlanoValidacionError
// con un motivo explicativo; si pasa, devuelve lo que el archivo contiene de verdad.
// opciones.estructural: solo estructura (DXF importado, sin contrato de avisos).
export function validarPlanoSvg(svg, contrato = {}, opciones = {}) {
  const estructural = !!opciones.estructural;
  if (typeof svg !== 'string' || !svg.trim()) fallo('Plano vacio.');
  if (new TextEncoder().encode(svg).byteLength > MAX_BYTES) fallo('Plano demasiado grande para validar.');
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(svg)) fallo('Plano con declaraciones XML no permitidas.');
  const parser = new SaxesParser({ xmlns: true });
  const pila = [];
  const ids = new Map();
  const usos = [];
  const textosDibujo = [];
  const textosBloque = [];
  let metadataAlcance = null;
  let raiz = null;
  let elementos = 0;
  let textoActual = null;

  parser.on('opentag', node => {
    elementos++;
    const padre = pila[pila.length - 1];
    const enMetadata = !!(padre && padre.metadata);
    const atributos = {};
    for (const a of Object.values(node.attributes)) atributos[a.prefix ? `${a.prefix}:${a.local}` : a.local] = a.value;
    if (!padre) {
      if (node.local !== 'svg' || node.uri !== SVG_NS) fallo('Plano sin raiz SVG con el namespace correcto.');
      raiz = atributos;
    }
    if (!enMetadata) {
      if (node.uri !== SVG_NS) fallo(`Plano con elemento no esperado <${node.name}>.`);
      if (!ELEMENTOS_SVG.has(node.local)) fallo(`Plano con elemento no esperado <${node.local}>.`);
      for (const a of Object.values(node.attributes)) {
        if (a.prefix === 'xmlns' || a.name === 'xmlns') continue;
        const nombre = a.local;
        comprobarAtributo(node.local, a.prefix === 'xlink' ? 'href' : nombre, a.value);
      }
      const href = atributos.href ?? atributos['xlink:href'];
      if (href !== undefined) {
        if (node.local === 'image') {
          if (!/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(href)) fallo('Plano con imagen externa: solo se admiten imagenes incrustadas.');
        } else if (!/^#[\w.:-]+$/.test(href)) fallo(`Plano con referencia externa en <${node.local}>.`);
        else if (node.local === 'use') usos.push(href.slice(1));
      }
    }
    const id = atributos.id;
    if (id !== undefined) ids.set(id, (ids.get(id) || 0) + 1);
    const oculto = atributos.display === 'none' || atributos.visibility === 'hidden' || atributos.opacity === '0'
      || /(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\s*;|\s*$))/i.test(atributos.style || '');
    const esBloque = id === ID_BLOQUE_AVISOS;
    if (esBloque && pila.length !== 1) fallo('Bloque de avisos fuera de su posicion.');
    const esMeta = id === ID_METADATA_ALCANCE;
    if (esMeta && (node.local !== 'metadata' || pila.length !== 1)) fallo('Metadatos de alcance fuera de su posicion.');
    const estado = {
      local: node.local,
      metadata: enMetadata || node.local === 'metadata',
      metaAlcance: esMeta,
      bloque: (padre && padre.bloque) || esBloque,
      texto: (padre && padre.texto) || ['text', 'tspan', 'textPath'].includes(node.local),
      oculto: (padre && padre.oculto) || oculto || ['defs', 'metadata', 'title', 'desc', 'style', 'symbol', 'marker', 'pattern', 'clipPath', 'mask'].includes(node.local),
      buffer: null,
    };
    if (estado.texto && !(padre && padre.texto)) { estado.buffer = []; textoActual = estado; }
    if (esMeta) estado.buffer = [];
    pila.push(estado);
  });
  parser.on('closetag', () => {
    const estado = pila.pop();
    if (estado.buffer && estado === textoActual) {
      const t = estado.buffer.join('').replace(/\s+/g, ' ').trim();
      if (t && !estado.oculto) (estado.bloque ? textosBloque : textosDibujo).push(t);
      textoActual = null;
    }
    if (estado.metaAlcance) {
      try { metadataAlcance = JSON.parse(estado.buffer.join('')); } catch (_) { fallo('Metadatos de alcance ilegibles.'); }
    }
  });
  const alTexto = t => {
    const estado = pila[pila.length - 1];
    if (!estado) return;
    if (estado.local === 'style' && /@import|url\(\s*['"]?\s*(?!#)/i.test(t)) fallo('Plano con recursos externos en estilos.');
    if (textoActual && !estado.metadata) textoActual.buffer.push(t);
    if (estado.metaAlcance) estado.buffer.push(t);
  };
  parser.on('text', alTexto);
  parser.on('cdata', alTexto);
  try { parser.write(svg).close(); }
  catch (e) {
    if (e && e.validacionPlano) throw e;
    fallo('Plano XML invalido; vuelve a generar el archivo completo.');
  }
  if (!raiz) fallo('Plano sin raiz SVG.');

  // viewBox coherente: obligatorio, finito y positivo; sin deformación declarada.
  const vb = parseViewBox(raiz.viewBox);
  if (!vb) fallo('Plano sin viewBox valido (cuatro numeros finitos con ancho y alto positivos).');
  const w = parseLongitud(raiz.width), h = parseLongitud(raiz.height);
  if (/^\s*none\b/i.test(raiz.preserveAspectRatio || '') && w && h && w.u === h.u && w.n > 0 && h.n > 0
      && Math.abs((w.n / h.n) / (vb.w / vb.h) - 1) > 0.01) {
    fallo('Plano deformado: proporcion de width/height distinta del viewBox con preserveAspectRatio="none".');
  }
  // Un id repetido solo rompe el dibujo si algo lo referencia (ambiguo) o es reservado.
  for (const [id, n] of ids) {
    if (n > 1 && (usos.includes(id) || id === ID_BLOQUE_AVISOS || id === ID_METADATA_ALCANCE)) {
      fallo(`Plano con identificador duplicado "${id}".`);
    }
  }
  for (const ref of usos) if (!ids.has(ref)) fallo(`Plano con simbolo inexistente (#${ref}).`);
  for (const t of [...textosDibujo, ...textosBloque]) {
    if (NO_NUMERICO.test(t)) fallo(`Plano con texto de valor no numerico: "${t.slice(0, 60)}".`);
  }

  const cotasDibujo = textosDibujo.flatMap(t => extraerCotasTexto(t).map(c => ({ ...c, origen: t })));
  const resultado = {
    valido: true,
    validador: VERSION_VALIDADOR,
    viewBox: vb,
    elementos,
    cotas_en_archivo: [...new Set(cotasDibujo.map(c => c.texto))].slice(0, 30),
  };
  if (estructural) return resultado;

  // Avisos obligatorios: deben estar, línea a línea, en el bloque visible del archivo.
  if ((ids.get(ID_BLOQUE_AVISOS) || 0) !== 1) fallo('Plano sin bloque de avisos obligatorios.');
  if (!metadataAlcance || metadataAlcance.apto_para_ejecucion !== false
      || metadataAlcance.tipo_documento !== alcanceArchivoPlano(contrato).tipo_documento) {
    fallo('Plano sin alcance declarado (apto_para_ejecucion=false) en el archivo.');
  }
  const presentes = new Set(textosBloque.map(normalizarTextoAviso));
  const faltan = avisosObligatoriosPlano(contrato).filter(a => !presentes.has(normalizarTextoAviso(a.texto)));
  if (faltan.length) fallo(`Plano sin avisos obligatorios en el archivo: ${faltan.map(a => a.texto).join(' | ')}.`);

  // Cotas: los planos con dimensiones deben mostrar alguna o declararse sin escala.
  const sinEscala = textosDibujo.some(t => /SIN ESCALA/.test(normalizarTextoAviso(t)));
  if (contrato && TIPOS_DIMENSIONALES.has(contrato.tipo) && !cotasDibujo.length && !sinEscala) {
    fallo('Plano sin textos de cota con unidad (mm, cm o m) ni declaracion "Esquema sin escala".');
  }
  const cotasEntrada = (contrato && contrato.cotas_entrada) || [];
  const ausentes = cotasEntrada.filter(c => !cotasDibujo.some(d => cotaCoincide(d.valor_m, c.valor_m)));
  if (ausentes.length) {
    fallo(`Plano sin las cotas aportadas por el usuario (o con otra unidad/escala): ${ausentes.map(c => `${c.etiqueta ? c.etiqueta + ' ' : ''}${c.valor_m} m`).join(', ')}.`);
  }
  resultado.avisos_en_archivo = textosBloque.slice();
  resultado.alcance_en_archivo = { tipo_documento: metadataAlcance.tipo_documento, apto_para_ejecucion: false };
  resultado.cotas_entrada_verificadas = cotasEntrada.map(c => ({ ...c }));
  return resultado;
}

// Paso final común a generación y edición: incrusta los avisos y valida el archivo
// resultante. Devuelve el SVG a guardar y la verificación para el resultado de la tool.
export function finalizarPlanoVerificado(svg, contrato = {}) {
  const final = incrustarAvisosPlano(svg, contrato);
  const verificacion = validarPlanoSvg(final, contrato);
  return { svg: final, verificacion };
}
