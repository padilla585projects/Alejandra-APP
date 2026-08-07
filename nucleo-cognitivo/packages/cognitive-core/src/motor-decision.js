/**
 * Motor de Decisión — ADR-0004, docs/architecture/04-MOTOR-DE-DECISION.md
 *
 * Responsabilidad: elegir, para una solicitud normalizada, una de las salidas
 * controladas listadas en SALIDAS_VALIDAS. No responsabilidad: ejecutar,
 * conceder permisos, ni sustituir a Policy Engine, Planner, Verifier o QA.
 *
 * Coordina Context Engine y Planner, que en este esqueleto siguen siendo
 * interfaces sin implementar; por tanto `decidir()` tampoco puede implementarse
 * todavía sin fabricar una decisión sin fundamento real.
 */

import { nivelesRequeridosPara, registrarExplicabilidad } from './verifier.js';

export const SALIDAS_VALIDAS = Object.freeze([
  'respuesta_directa', 'solicitar_informacion', 'recuperar_contexto', 'consultar_memoria',
  'buscar_conocimiento', 'plan', 'solicitar_aprobacion', 'invocar_tool',
  'activar_colaboracion', 'rechazar', 'posponer',
]);

/**
 * Campos de traza obligatorios en toda decisión, tal como los fija
 * 04-MOTOR-DE-DECISION.md ("Responsabilidades, entradas y salidas" →
 * Trazabilidad). ARC-008 (observabilidad) sigue abierto: esto fija la FORMA que
 * debe tener una decisión, no implementa su persistencia ni consulta real. El
 * Director exigió explícitamente que ninguna decisión se tome sin esta forma.
 */
export const CAMPOS_TRAZA_OBLIGATORIOS = Object.freeze([
  'decision', 'motivos', 'evidencia', 'confianza', 'riesgo', 'permisos_efectivos',
  'modo', 'criterio_salida',
]);

/**
 * Comprueba que un objeto de decisión trae todos los campos de traza exigidos.
 * No valida su contenido — solo hace estructuralmente detectable la omisión de
 * un campo, que es la forma mínima de "decisión sin trazabilidad suficiente".
 * @param {object} decision
 * @returns {boolean}
 */
export function tieneTrazaSuficiente(decision) {
  if (!decision || typeof decision !== 'object') return false;
  return CAMPOS_TRAZA_OBLIGATORIOS.every((campo) => campo in decision);
}

/**
 * Primera rebanada ejecutable del Motor de Decisión (ADR-0020).
 * Decide únicamente sobre una invocación de tool ya seleccionada por el modelo.
 * No clasifica riesgo: exige el nivel declarado por el catálogo y solo gobierna
 * N0 en este piloto. Las tools N1-N3 continúan por sus gates legacy hasta que
 * tengan verificadores propios en una rebanada posterior.
 *
 * @param {{tool?: object, toolOfrecida: boolean, authOk: boolean, esDevVerificado: boolean, esCron: boolean, modo: string}} params
 * @returns {{aplicaPiloto: boolean, permitida: boolean, decision: object}}
 */
export function decidirInvocacionPilotoN0({
  tool,
  toolOfrecida,
  authOk = false,
  esDevVerificado = false,
  esCron = false,
  modo = 'conversacion',
} = {}) {
  const permisosEfectivos = Object.freeze({
    sesion_autenticada: authOk === true,
    desarrollador_verificado: esDevVerificado === true,
    cron: esCron === true,
  });
  const nombreTool = typeof tool?.name === 'string' ? tool.name : 'desconocida';

  if (toolOfrecida !== true) {
    return {
      aplicaPiloto: true,
      permitida: false,
      decision: {
        decision: 'rechazar',
        motivos: ['La tool no figura en el catálogo ofrecido a esta sesión.'],
        evidencia: { tool: nombreTool, ofrecida: false },
        confianza: 1,
        riesgo: 'no_evaluable',
        permisos_efectivos: permisosEfectivos,
        modo,
        criterio_salida: 'tool_no_ofrecida',
      },
    };
  }

  // El piloto no altera todavía N1-N3; el Worker conserva sus gates existentes.
  if (tool?.nivel_riesgo !== 'N0') {
    return {
      aplicaPiloto: false,
      permitida: true,
      decision: {
        decision: 'posponer',
        motivos: ['La tool queda fuera del piloto N0.'],
        evidencia: { tool: nombreTool, nivel_riesgo: tool?.nivel_riesgo ?? null },
        confianza: 1,
        riesgo: tool?.nivel_riesgo ?? 'no_evaluable',
        permisos_efectivos: permisosEfectivos,
        modo,
        criterio_salida: 'fuera_piloto_n0',
      },
    };
  }

  return {
    aplicaPiloto: true,
    permitida: true,
    decision: {
      decision: 'invocar_tool',
      motivos: ['Tool N0 declarada y ofrecida por el catálogo efectivo.'],
      evidencia: { tool: nombreTool, nivel_riesgo: 'N0', ofrecida: true },
      confianza: 1,
      riesgo: 'N0',
      permisos_efectivos: permisosEfectivos,
      modo,
      criterio_salida: 'tool_n0_ofrecida',
    },
  };
}

/**
 * Segunda rebanada ejecutable del Motor de Decisión (ADR-0020, rebanada 3,
 * 2026-08-07). Gobierna tools N1 de LECTURA ya identificadas por el Worker
 * (allowlist curada, este módulo no clasifica lectura/escritura por su cuenta
 * — la mayoría de tools N1 del catálogo mezclan lectura y escritura por
 * `accion`, decisión de alcance explícita en la enmienda 2). Exige, además de
 * lo que ya exige el piloto N0, que la decisión pase el nivel `explicabilidad`
 * que ADR-0009 fija para N1 (`nivelesRequeridosPara('N1')`).
 *
 * @param {{tool?: object, toolOfrecida: boolean, authOk: boolean, esDevVerificado: boolean, esCron: boolean, modo: string}} params
 * @returns {{aplicaPiloto: boolean, permitida: boolean, decision: object}}
 */
export function decidirInvocacionN1Lectura({
  tool,
  toolOfrecida,
  authOk = false,
  esDevVerificado = false,
  esCron = false,
  modo = 'conversacion',
} = {}) {
  const permisosEfectivos = Object.freeze({
    sesion_autenticada: authOk === true,
    desarrollador_verificado: esDevVerificado === true,
    cron: esCron === true,
  });
  const nombreTool = typeof tool?.name === 'string' ? tool.name : 'desconocida';

  if (toolOfrecida !== true) {
    return {
      aplicaPiloto: true,
      permitida: false,
      decision: {
        decision: 'rechazar',
        motivos: ['La tool no figura en el catálogo ofrecido a esta sesión.'],
        evidencia: { tool: nombreTool, ofrecida: false },
        confianza: 1,
        riesgo: 'no_evaluable',
        permisos_efectivos: permisosEfectivos,
        modo,
        criterio_salida: 'tool_no_ofrecida',
      },
    };
  }

  if (tool?.nivel_riesgo !== 'N1') {
    return {
      aplicaPiloto: false,
      permitida: true,
      decision: {
        decision: 'posponer',
        motivos: ['La tool queda fuera del piloto N1 de lectura.'],
        evidencia: { tool: nombreTool, nivel_riesgo: tool?.nivel_riesgo ?? null },
        confianza: 1,
        riesgo: tool?.nivel_riesgo ?? 'no_evaluable',
        permisos_efectivos: permisosEfectivos,
        modo,
        criterio_salida: 'fuera_piloto_n1_lectura',
      },
    };
  }

  if (authOk !== true) {
    return {
      aplicaPiloto: true,
      permitida: false,
      decision: {
        decision: 'rechazar',
        motivos: ['N1 de lectura exige sesión autenticada (ADR-0006).'],
        evidencia: { tool: nombreTool, nivel_riesgo: 'N1', authOk: false },
        confianza: 1,
        riesgo: 'N1',
        permisos_efectivos: permisosEfectivos,
        modo,
        criterio_salida: 'sin_sesion',
      },
    };
  }

  const decisionBase = {
    decision: 'invocar_tool',
    motivos: ['Tool N1 de lectura declarada, ofrecida por el catálogo efectivo y con sesión autenticada.'],
    evidencia: { tool: nombreTool, nivel_riesgo: 'N1', ofrecida: true },
    confianza: 1,
    riesgo: 'N1',
    permisos_efectivos: permisosEfectivos,
    modo,
    criterio_salida: 'tool_n1_lectura_ofrecida',
  };

  const requiereExplicabilidad = nivelesRequeridosPara('N1').includes('explicabilidad');
  const explicabilidad = requiereExplicabilidad ? registrarExplicabilidad(decisionBase) : { aprobado: true };

  if (!explicabilidad.aprobado) {
    return {
      aplicaPiloto: true,
      permitida: false,
      decision: {
        ...decisionBase,
        decision: 'rechazar',
        motivos: [...decisionBase.motivos, 'Explicabilidad (ADR-0009) no satisfecha: la decisión no trae razonamiento verificable.'],
        criterio_salida: 'explicabilidad_insuficiente',
      },
    };
  }

  return { aplicaPiloto: true, permitida: true, decision: decisionBase };
}

/**
 * Contrato de `registrarTraza` — ADR-0014 §5 ("El helper que necesita
 * `motor-decision.js`, sin romper el aislamiento actual"). No es un módulo
 * aparte: es una dependencia inyectada en `decidir()`, nunca un cliente de D1
 * importado por este archivo. `motor-decision.js` sigue sin saber si existe
 * D1, KV o nada; solo exige, vía `tieneTrazaSuficiente()`, que la decisión
 * traiga los ocho campos de `CAMPOS_TRAZA_OBLIGATORIOS` antes de pasarla al
 * helper. Cada Worker (`worker.js`, `alejandra-agente/worker.js`) implementa
 * su propio `registrarTraza()` que escribe en `alejandra_trazas` con
 * `tipo='decision'` — fuera de este paquete.
 *
 * Hasta que ADR-0014 se acepte y la migración de `alejandra_trazas` se
 * aplique, la única implementación válida de `registrarTraza()` es una que no
 * persiste nada (no-op o `console.error`).
 *
 * @callback RegistrarTraza
 * @param {object} decision - debe cumplir `tieneTrazaSuficiente(decision)`
 * @returns {Promise<void>}
 */

/**
 * @param {object} _solicitud
 * @param {object} [_opciones]
 * @param {RegistrarTraza} [_opciones.registrarTraza] - dependencia inyectada
 *   (ADR-0014 §5); `decidir()` solo la invoca una vez esté realmente
 *   implementada, y siempre después de comprobar `tieneTrazaSuficiente()`
 *   sobre la decisión resultante. Mientras `decidir()` siga sin implementar,
 *   este parámetro se acepta y se documenta, pero no se invoca.
 * @returns {never}
 */
export function decidir(_solicitud, _opciones = {}) {
  throw new Error(
    'Motor de Decisión: interfaz definida (ADR-0004), sin implementación real. ' +
    'Requiere Context Engine y Planner operativos — fuera del alcance del esqueleto de F-1.2.'
  );
}
