// IA-QUALITY-09 (03/10/2026): reglas puras de cotas y del resultado de las tools de
// planos, compartidas por los dos Workers (la API importa extraerCotasTexto/
// cotaCoincide desde aquí, igual que normalizarIdPlano desde lib.js). Sin I/O ni
// dependencias: el agente se despliega sin las dependencias npm de la API.

// Evita artefactos binarios (2800 mm → 2.8000000000000003 m) en comparaciones y prompts.
const aMetros = (valor, factor) => Math.round(valor * factor * 1e6) / 1e6;

// Medidas de longitud escritas en un texto ("3,5 m", "2800 mm", "40x20 m").
// Excluye secciones (mm2/mm²) y unidades compuestas. Devuelve metros.
export function extraerCotasTexto(texto) {
  const res = [];
  const t = String(texto || '');
  const factor = u => { const l = u.toLowerCase(); return l === 'mm' ? 0.001 : l === 'cm' ? 0.01 : 1; };
  const re = /([+-]?\d+(?:[.,]\d+)?)((?:\s*[x×]\s*[+-]?\d+(?:[.,]\d+)?)*)\s*(mm|cm|metros?|m)(?![a-z0-9²³/])/gi;
  for (const m of t.matchAll(re)) {
    const f = factor(/^metro/i.test(m[3]) ? 'm' : m[3]);
    const numeros = [m[1], ...(m[2] ? m[2].split(/[x×]/i).slice(1) : [])];
    for (const n of numeros) {
      const v = aMetros(Number(n.trim().replace(',', '.')), f);
      if (Number.isFinite(v)) res.push({ texto: m[0].trim(), valor_m: v });
    }
  }
  return res;
}

// Tolerancia de cota: 1 mm o 0,5 % (redondeos de presentación), nunca un cambio de unidad.
export function cotaCoincide(a, b) {
  return Math.abs(a - b) <= Math.max(0.001, Math.abs(b) * 0.005);
}

// Las cotas que el modelo declara deben estar escritas por el usuario (con unidad):
// el modelo no puede convertir un supuesto en una cota obligatoria del plano.
export function verificarCotasDeclaradas(cotas, fuentesHumanas = []) {
  if (cotas == null) return { ok: true, cotas_entrada: [] };
  if (!Array.isArray(cotas) || cotas.length > 40) return { ok: false, error: 'COTAS_INVALIDAS', mensaje: 'cotas debe ser una lista (máximo 40).' };
  const humanas = fuentesHumanas.filter(t => typeof t === 'string').flatMap(extraerCotasTexto);
  const factores = { mm: 0.001, cm: 0.01, m: 1 };
  const cotas_entrada = [];
  const no_aportadas = [];
  for (const c of cotas) {
    const valor = typeof c?.valor === 'string' ? Number(c.valor.replace(',', '.')) : c?.valor;
    const f = factores[String(c?.unidad || '').toLowerCase()];
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || !f) {
      return { ok: false, error: 'COTAS_INVALIDAS', mensaje: 'Cada cota necesita valor positivo y unidad mm, cm o m.' };
    }
    const valor_m = aMetros(valor, f);
    const etiqueta = typeof c.etiqueta === 'string' ? c.etiqueta.slice(0, 80) : '';
    if (!humanas.some(h => cotaCoincide(h.valor_m, valor_m))) no_aportadas.push(`${etiqueta ? etiqueta + ' ' : ''}${valor} ${c.unidad}`);
    else cotas_entrada.push({ etiqueta, valor_m });
  }
  if (no_aportadas.length) {
    return {
      ok: false, error: 'COTAS_NO_APORTADAS', cotas: no_aportadas,
      mensaje: 'No se ha generado ningún plano. Estas cotas no figuran con su unidad en lo que ha escrito el usuario: pregúntalas o quítalas; no las inventes ni cambies su unidad.',
    };
  }
  return { ok: true, cotas_entrada };
}

const INSTRUCCION_AVISOS = 'Solo puedes afirmar que el archivo contiene los avisos listados en avisos_en_archivo (comprobados en el SVG guardado). No atribuyas al archivo ningún otro aviso, nota o comprobación.';

// Resultado de generar_plano/editar_plano para el chat: avisos tomados del archivo
// validado por la API, nunca de lo que el modelo crea haber pedido.
export function resultadoPlanoVerificado(data) {
  const verificacion = data && data.verificacion_archivo;
  const avisos = verificacion && Array.isArray(verificacion.avisos_en_archivo) ? verificacion.avisos_en_archivo.slice() : null;
  if (!avisos) {
    return { ...data, avisos_en_archivo: [], verificacion_archivo: { valido: null, motivo: 'La API no devolvió la verificación del archivo.' },
      instruccion_avisos: 'No se pudo comprobar el contenido del archivo: no afirmes que contiene ningún aviso.' };
  }
  return { ...data, avisos_en_archivo: avisos, instruccion_avisos: INSTRUCCION_AVISOS };
}

export function errorPlanoNoGuardado(mensaje) {
  return {
    error: mensaje, plano_guardado: false,
    instruccion: 'No se ha guardado ningún archivo ni cambio. Explica el motivo al usuario; no digas que el plano existe ni describas su contenido.',
  };
}
