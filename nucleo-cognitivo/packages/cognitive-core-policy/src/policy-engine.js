/**
 * Policy Engine — docs/03-ARQUITECTURA-COGNITIVA.md, ADR-0006
 *
 * Responsabilidad: decidir, a partir de un nivel de riesgo YA DECLARADO, qué
 * aprobación exige una acción y si el cron puede ejecutarla. No responsabilidad:
 * inventar contexto ni ejecutar negocio.
 *
 * ADR-0006 fue explícito: "el nivel debe ser una propiedad DECLARADA de la tool,
 * no una inferencia" — precisamente para que el propio modelo no pueda razonar su
 * salida a un nivel más permisivo. Por eso este módulo nunca calcula el nivel de
 * riesgo de una acción; solo aplica la regla de aprobación ya fijada en ADR-0006
 * para un nivel que otro componente (el catálogo de tools, ADR-0010) ya declaró.
 */

export const NIVELES_RIESGO = ['N0', 'N1', 'N2', 'N3'];

const REGLA_APROBACION = Object.freeze({
  N0: Object.freeze({ requiereAprobacion: false, quienAprueba: null, permitidoParaCron: true }),
  N1: Object.freeze({ requiereAprobacion: false, quienAprueba: 'usuario_propio', permitidoParaCron: true }),
  N2: Object.freeze({ requiereAprobacion: true, quienAprueba: 'usuario_o_encargado', permitidoParaCron: false }),
  N3: Object.freeze({ requiereAprobacion: true, quienAprueba: 'director', permitidoParaCron: false }),
});

/**
 * @param {{nivel_riesgo: 'N0'|'N1'|'N2'|'N3'}} accion — forma mínima; en el
 *   catálogo real (ADR-0010) llevará también `acceso` y `cron`.
 */
export function evaluarAccion(accion) {
  if (!accion || typeof accion !== 'object') {
    throw new Error('evaluarAccion requiere una acción con nivel_riesgo declarado');
  }
  const { nivel_riesgo } = accion;
  if (!NIVELES_RIESGO.includes(nivel_riesgo)) {
    throw new Error(
      `nivel_riesgo inválido o ausente: "${nivel_riesgo}". ADR-0006 exige que sea una ` +
      'propiedad declarada de la acción/tool, nunca inferida por este motor.'
    );
  }
  return { nivel_riesgo, ...REGLA_APROBACION[nivel_riesgo] };
}

/**
 * Regla propuesta por ADR-0006 para el cron: solo N0–N1, nunca N2 ni N3, porque
 * no hay humano al que pedir confirmación.
 */
export function permitidoParaCron(accion) {
  return evaluarAccion(accion).permitidoParaCron;
}
