// ADR-0021: Nexo v1 — Registro de fuentes externas
// Cada fuente declara: id, nombre, tipo, fiabilidad, TTL, ámbito, conector y fallback.
// Este registro es consultado por las tools que ya existen (buscar_normativa, buscar_precios)
// para registrar trazas y coordinar fallback.

export const FUENTES_NEXO = {
  normativa_rebt: {
    id: 'normativa_rebt',
    nombre: 'REBT/ITC-BT (índice local)',
    tipo: 'normativa',
    fiabilidad: 'alta',
    ttl_horas: 168,
    ambito: 'españa',
    conector: 'buscar_normativa',
    fallback: 'buscar_web',
  },
  precios_distribuidores: {
    id: 'precios_distribuidores',
    nombre: 'Precios de distribuidores eléctricos',
    tipo: 'precios',
    fiabilidad: 'media',
    ttl_horas: 168,
    ambito: 'españa',
    conector: 'buscar_precios',
    fallback: null,
  },
  web_general: {
    id: 'web_general',
    nombre: 'Búsqueda web general (Google/Gemini)',
    tipo: 'general',
    fiabilidad: 'variable',
    ttl_horas: 24,
    ambito: 'global',
    conector: 'buscar_google',
    fallback: null,
  },
};

// Busca una fuente por ID
export function obtenerFuente(fuenteId) {
  return FUENTES_NEXO[fuenteId] || null;
}

// Busca una fuente por nombre de tool conectora
export function obtenerFuentePorConector(nombreTool) {
  return Object.values(FUENTES_NEXO).find(f => f.conector === nombreTool) || null;
}

// Lista todas las fuentes registradas
export function listarFuentes() {
  return Object.values(FUENTES_NEXO);
}
