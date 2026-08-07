// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — funciones puras extraídas de worker.js para poder testearlas
// de forma aislada (sin D1/KV/fetch reales). worker.js importa todo esto desde
// aquí; NO se duplica lógica entre los dos archivos.
//
// Criterio de qué vive aquí: solo funciones/constantes que NO tocan env.DB,
// env.RATE_LIMIT_KV, env.FILES ni hacen fetch() de verdad. Todo lo que necesita
// I/O real (registrarTokenUso, validarRateLimit, getAuth, etc.) se queda en
// worker.js y se prueba de forma manual/integración, no aquí.
// ══════════════════════════════════════════════════════════════════════════════

// SEC-AUDIT-01 (26/07/2026): comparación en tiempo constante para secretos de alto
// privilegio (ADMIN_TOKEN) — "===" sale en cuanto encuentra el primer carácter distinto,
// filtrando por temporización cuántos caracteres iniciales acertó un atacante.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Precios y coste (fix continuación 9: gpt-4o mal etiquetado/tarificado) ───
const PRECIOS_USD = {
  'claude-haiku-4-5':  { in: 1.00,  out: 5.00  },
  'claude-sonnet-4-6': { in: 3.00,  out: 15.00 },
  'gpt-4o-mini':       { in: 0.15,  out: 0.60  },
  // Antes faltaba: cuando llamarGPT4oFallback() entraba en juego, registrarTokenUso()
  // recibía el nombre del modelo Claude original (no 'gpt-4o'), así que este precio
  // nunca se llegaba a usar y el coste se calculaba mal con el precio de Claude.
  'gpt-4o':            { in: 2.50,  out: 10.00 },
  // Precio aproximado de grok-4 (xAI) a fecha de este fix -- revisar si xAI cambia tarifas.
  'grok-4':            { in: 3.00,  out: 15.00 }
};

// Precios en €/millón de tokens para modelos OpenRouter DE PAGO (sin sufijo ":free").
// Los modelos ":free" (los que usa hoy la cascada de llamarGPT4oFallback() y
// refrescarCascadaModelosGratis() en worker.js) cuestan 0 de verdad -- eso es lo que
// significa ":free" en OpenRouter -- así que no necesitan entrada aquí, se tarifican
// a 0 directamente en calcularCosteYProveedor(). Añadir aquí solo si en el futuro se
// usa un modelo OpenRouter de pago (formato "vendor/modelo" sin ":free").
const PRECIOS_EUR_OPENROUTER = {};

// Precio por defecto en €/millón para un modelo OpenRouter de pago sin entrada
// explícita en PRECIOS_EUR_OPENROUTER -- mismo criterio conservador que el defecto
// de PRECIOS_USD (mejor sobreestimar el gasto que perderlo de vista).
const PRECIO_EUR_OPENROUTER_DEFECTO = { in: 1.00, out: 5.00 };

// Tipo de cambio EUR→USD fijo para convertir los precios en € de OpenRouter (arriba)
// a los $ que exige la columna coste_usd de alejandra_token_uso -- esa columna se
// SUMa junto con las filas de Anthropic/OpenAI (que sí facturan en $ de verdad, ver
// worker.js:2065 y 2597/2604, /dev/ai-costes), así que coste_usd debe quedarse
// siempre en $ aunque la tabla de precios de origen esté en €. Ajustar aquí si el
// cambio real se mueve mucho.
const EUR_A_USD = 1.08;

// Calcula proveedor + coste USD para un uso de tokens. Pura: no toca D1.
// registrarTokenUso() en worker.js hace el INSERT con lo que esto devuelve.
// Fix: modelos con formato "vendor/modelo" (ej. "nvidia/nemotron-3-ultra-550b-a55b-20260604:free",
// "openai/gpt-oss-120b:free") o que terminan en ":free" vienen de OpenRouter, no de Anthropic --
// antes cualquier modelo que no empezara por "gpt" se etiquetaba "anthropic" a ciegas, corrompiendo
// las estadísticas de coste/proveedor en alejandra_token_uso.
function calcularCosteYProveedor(modelo, tokensEntrada, tokensSalida) {
  let proveedor;
  if (modelo.startsWith('claude')) proveedor = 'anthropic';
  else if (modelo.includes('/') || modelo.endsWith(':free')) proveedor = 'openrouter';
  else if (modelo.startsWith('gpt')) proveedor = 'openai';
  else if (modelo.startsWith('grok')) proveedor = 'xai';
  else proveedor = 'anthropic';

  let coste;
  if (proveedor === 'openrouter') {
    if (modelo.endsWith(':free')) {
      coste = 0;
    } else {
      const pEur = PRECIOS_EUR_OPENROUTER[modelo] || PRECIO_EUR_OPENROUTER_DEFECTO;
      coste = ((tokensEntrada * pEur.in + tokensSalida * pEur.out) / 1_000_000) * EUR_A_USD;
    }
  } else {
    const p = PRECIOS_USD[modelo] || { in: 1.00, out: 5.00 };
    coste = (tokensEntrada * p.in + tokensSalida * p.out) / 1_000_000;
  }
  return { proveedor, coste };
}

// ── Filtrado de tools por nivel de auth (dev verificado / sesión) ───────────
// configurar_alerta (fix continuación 14, IDOR/SQLi): la acción "crear" guarda un
// SQL arbitrario (condicion_sql) que "verificar" ejecuta directamente sin scope de
// empresa_id -- se restringe a dev verificado, igual que patch_codigo/rollback, en
// vez de dejarla abierta a cualquier sesión (ver validaciones extra en worker.js).
const TOOLS_SOLO_DEV_VERIFICADO = new Set(['patch_codigo', 'github_escribir', 'ejecutar_deploy', 'rollback', 'test_endpoint', 'configurar_alerta', 'nexus_manage']);
// exportar_datos (fix continuación 14, IDOR/SQLi): exportaba datos de TODAS las
// empresas sin filtro y con obra_id/fechas concatenados sin parametrizar -- ahora
// exige sesión como mínimo (el scope real por empresa_id se aplica en worker.js).
// listar_esquemas/borrar_esquema (fix continuación 17, IDOR): no filtraban por
// empresa_id en worker.js y ni siquiera exigían sesión -- cualquiera podía listar
// y borrar esquemas (y su archivo R2) de otra empresa. Ahora exigen sesión como
// mínimo (el scope real por empresa_id se aplica en worker.js, igual que
// exportar_datos).
// Fix continuación 19 (IDOR/exfiltración cross-empresa, 5 familias): ninguna de
// estas 12 tools exigía sesión y varias no filtraban por empresa_id/propiedad en
// absoluto -- historico_materiales y generar_informe exponían datos de TODAS las
// empresas; analizar_archivo/marcar_plano/enviar_email/enviar_telegram_informe
// permitían leer/reenviar archivos R2 de otra empresa conociendo su r2_key;
// crear_tarea_background/ver_tareas/completar_tarea permitían crear/leer/completar
// tareas en background de OTRO usuario; enviar_push/iniciar_conversacion/
// controlar_app permitían notificar/actuar sobre la app de un usuario de otra
// empresa. El scope real (empresa_id/usuario_id/propiedad de archivo, con bypass
// para dev verificado -- necesario para el cron cross-empresa) se aplica en
// worker.js; aquí se exige sesión como mínimo, igual que el resto de fixes.
// Fix continuación 20: subir_archivo escribía en CUALQUIER key de R2 sin
// customMetadata.usuario_id (por lo que puedeAccederArchivo() nunca podía
// determinar el dueño después) y sin comprobar si esa key ya pertenecía a otra
// empresa antes de sobrescribirla -- alcanzable por cualquier usuario
// autenticado de cualquier empresa (está en TOOLS_POR_EXPERTO de app/tecnico/
// completo/ingenieria). enviar_notificacion es código huérfano (no se ofrece
// en ningún TOOLS_POR_EXPERTO hoy) con el mismo patrón IDOR que enviar_push
// antes de continuación 19 -- se gatea igual por defensa en profundidad.
const TOOLS_REQUIEREN_SESION    = new Set([
  'consultar_bd', 'escribir_bd', 'listar_archivos', 'ver_archivo', 'exportar_datos', 'listar_esquemas', 'borrar_esquema',
  'historico_materiales', 'generar_informe', 'analizar_archivo', 'marcar_plano', 'enviar_email', 'enviar_telegram_informe',
  'crear_tarea_background', 'ver_tareas', 'completar_tarea', 'enviar_push', 'iniciar_conversacion', 'controlar_app',
  'subir_archivo', 'enviar_notificacion',
  // NEW-XXX (22/07/2026): generar_grafico expone datos agregados de la empresa
  // (aunque no muy sensibles) via una URL publica de QuickChart -- se exige
  // sesion como minimo, igual que el resto de tools de datos de esta lista.
  // preguntar_usuario queda ligada a un usuario_id concreto; sin sesion
  // cualquiera podria generar spam de notificaciones a Adrian por Telegram.
  'generar_grafico', 'preguntar_usuario',
  // SEC-AUDIT-01 (26/07/2026): memory_save no estaba aqui -- alcanzable sin sesion desde
  // /webhook/evento y POST / (rutas deliberadamente publicas, authOk=false). Guarda en
  // alejandra_memoria SIN empresa_id y ese contenido se inyecta luego como contexto de
  // confianza en el prompt de TODAS las conversaciones de TODAS las empresas (via
  // obtenerContextoChat) -- permitia envenenamiento de memoria global persistente por
  // prompt injection no autenticado. memory_read/leer_estado (exponen memoria/estado
  // interno) y propose_mejora/tomar_decision (tomar_decision puede auto-aplicar cambios
  // de config si confianza>=0.8) se gatean igual por defensa en profundidad.
  'memory_save', 'memory_read', 'propose_mejora', 'leer_estado', 'tomar_decision',

  // SEC-ANON-01 (02/08/2026): `/api/chat` y `/api/chat/stream` aceptan peticiones SIN
  // sesión a propósito, y sin sesión el `empresa_id` se toma del body sin verificar
  // (worker.js: `sesionAuth ? sesionAuth.empresa_id : (empresa_id || 'default')`).
  // Es decir: para cualquier tool acotada por empresa_id, ese acotamiento lo elige
  // quien llama. Un anónimo podía pedir datos de la empresa que quisiera.
  //
  // El gateo anterior cubría `consultar_bd` y `exportar_datos`, pero no estas, que
  // llegan a los mismos datos por la puerta de al lado. Se añaden todas las que leen o
  // escriben datos de empresa, más las de GitHub —que exponen código privado— y las de
  // estado interno del agente.
  //
  // Lo que se deja SIN gatear a propósito, porque no toca datos de nadie: `buscar_web`,
  // `buscar_normativa`, `pensar`, `planificar` y los cálculos de ingeniería
  // (`calcular_cable`, `calcular_bandeja`, `calcular_proteccion`). El chat anónimo
  // sigue siendo útil para consultas técnicas, que es para lo que existe.
  'analizar_foto_obra', 'buscar_documentos', 'buscar_precios', 'buscar_procedimientos',
  'buscar_proveedores', 'buscar_tareas', 'consultar_inventario', 'consultar_personal',
  'consultar_precios', 'consultar_punch_list', 'estado_obra', 'recuperar_conversacion',
  'consultar_conocimiento',
  'editar_plano', 'generar_documento', 'generar_esquema_electrico', 'generar_plano',
  'gestionar_acta', 'gestionar_calidad', 'gestionar_oc', 'gestionar_rfi', 'gestionar_tarea',
  'github_buscar', 'github_leer', 'github_listar', 'grep_codigo',
  'ram_clear', 'ram_read', 'ram_save', 'descubrir_herramientas', 'validar_cambios_bd',
  'verificar_deploy',

  // ARC-008 §8 / F-2.1 paso 3, decisión del Director (2026-08-02, "Opción A"): primera
  // tool de lectura sobre memoria_gobernada. empresa_id sale de la sesión, nunca del
  // input -- sin sesión no hay tenant al que acotar la consulta, mismo criterio que el
  // resto de esta lista.
  'memoria_consultar',

  // F-2.1 paso 3 (2026-08-04), decisión del Director: exponer la escritura sobre
  // memoria_gobernada. Mismo motivo que memoria_consultar -- empresa_id sale de la
  // sesión, y confirmar/rechazar exige además rol encargado+ (comprobado en
  // worker.js, esEncargadoOSuperior()).
  'memoria_listar_pendientes', 'memoria_confirmar_candidata', 'memoria_rechazar_candidata',
]);

// ADR-0020, rebanada 3 (2026-08-07, enmienda 2): allowlist curada de tools N1
// de LECTURA gobernadas por el Motor de Decisión (decidirInvocacionN1Lectura,
// nucleo-cognitivo/). `verificar_deploy` es la única tool ENTERA de solo
// lectura: su `case` solo hace `fetch` GET contra la API de GitHub Actions,
// sin `env.DB`/`env.R2` en ningún camino.
const TOOLS_N1_LECTURA_PILOTO = new Set(['verificar_deploy']);

// ADR-0020, rebanada 5 (2026-08-07): clasificación N1 POR INVOCACIÓN, no por
// tool. Las 6 tools CRUD compuestas (`accion` en el input) mezclan lectura y
// escritura en la misma declaración — auditados los `case` de las seis,
// `listar`/`resumen`/`consultar`/`comparar` solo hacen `SELECT` (más, en
// algunas, un `CREATE TABLE IF NOT EXISTS` idempotente de bootstrap vía
// `runDDL()`, no escritura de datos de negocio); el resto de acciones
// (`crear`/`actualizar`/`eliminar`/`aprobar`/`rechazar`/`resolver`/
// `completar`/`responder`/`registrar`/`crear_tareas_desde_acuerdos`) sí
// escriben. Cualquier tool/acción no listada aquí cae a escritura por
// defecto (fail-closed) — ver `esInvocacionN1DeLectura()`.
const ACCIONES_N1_LECTURA_POR_TOOL = new Map([
  ['gestionar_tarea', new Set(['listar'])],
  ['gestionar_rfi', new Set(['listar'])],
  ['gestionar_oc', new Set(['listar', 'resumen'])],
  ['gestionar_acta', new Set(['listar'])],
  ['gestionar_calidad', new Set(['listar', 'resumen'])],
  ['historico_materiales', new Set(['consultar', 'comparar'])],
]);

/**
 * Decide si UNA invocación concreta de una tool N1 es de solo lectura.
 * Dos caminos: (1) la tool entera está en `TOOLS_N1_LECTURA_PILOTO`
 * (`verificar_deploy`, sin parámetro `accion`); (2) la tool es CRUD
 * compuesta y su `input.accion` está en la allowlist de lectura de
 * `ACCIONES_N1_LECTURA_POR_TOOL`. Fail-closed: tool/acción desconocida o
 * `accion` ausente → false (se trata como escritura, gates legacy intactos).
 * @param {string} toolName
 * @param {object} input
 * @returns {boolean}
 */
function esInvocacionN1DeLectura(toolName, input) {
  if (TOOLS_N1_LECTURA_PILOTO.has(toolName)) return true;
  const accionesLectura = ACCIONES_N1_LECTURA_POR_TOOL.get(toolName);
  if (!accionesLectura) return false;
  const accion = input && typeof input.accion === 'string' ? input.accion : null;
  return accion !== null && accionesLectura.has(accion);
}

// SEC-CRON-01 / ARC-017 (02/08/2026): el cron llama al modelo con esDevVerificado=true,
// así que filtrarToolsPorAuth no le filtraba NADA. Seis veces al día, sin nadie delante,
// el modelo alcanzaba desplegar, hacer rollback, escribir en el repo y escribir en la BD
// de cualquier empresa. El motivo por defecto de un despliegue era, literalmente,
// «Deploy autónomo por Alejandra».
//
// El flag no se puede bajar sin más: `puedeNotificarUsuario` depende de él —el cron SÍ
// necesita poder avisar a cualquier usuario, y para eso está—. La barrera correcta es la
// LISTA de tools: lo que no se le ofrece al modelo, el modelo no lo puede invocar.
//
// Criterio: el cron no toma decisiones irreversibles ni de alcance amplio sin humano.
// Puede leer, analizar y avisar; no puede tocar producción, código, ni escribir datos
// cross-empresa por decisión propia. Es N0–N1 en los términos de ADR-0006.
//
// Sus escrituras deterministas NO pasan por aquí (`tareas_alejandra`, `alejandra_ram` se
// escriben con SQL directo), así que siguen funcionando igual.
//
// Si algún día el cron necesita de verdad una de estas, la vía correcta es un camino de
// código explícito y acotado, no dejar que lo decida el modelo.
const TOOLS_PROHIBIDAS_CRON = new Set([
  // Producción y código
  'patch_codigo', 'github_escribir', 'ejecutar_deploy', 'rollback', 'test_endpoint',
  // Escritura de datos y configuración
  'escribir_bd', 'configurar_alerta', 'nexus_manage',
  // tomar_decision con confianza>=0.8 y auto_aplicar escribe agente_config por su cuenta
  'tomar_decision',
  // F-2.1 paso 3 (2026-08-04): confirmar/rechazar una candidata de memoria ES la
  // validación humana que ADR-0013 §3 exige antes de que algo inferido pase a
  // memoria vigente -- que el cron las apruebe sin nadie delante contradice el
  // propósito de la propia barrera, no solo su nivel de riesgo.
  'memoria_confirmar_candidata', 'memoria_rechazar_candidata',
]);

// Se detecta por identidad, no por un flag que haya que acordarse de pasar: el cron
// siempre entra como usuario 'system' con empresa 'cron'.
function esInvocacionCron(usuario_id, empresa_id) {
  return String(usuario_id) === 'system' && String(empresa_id) === 'cron';
}

function filtrarToolsCron(tools) {
  return (tools || []).filter(t => !TOOLS_PROHIBIDAS_CRON.has(t.name));
}

function filtrarToolsPorAuth(tools, authOk, esDevVerificado) {
  return (tools || []).filter(t => {
    if (TOOLS_SOLO_DEV_VERIFICADO.has(t.name) && !esDevVerificado) return false;
    if (TOOLS_REQUIEREN_SESION.has(t.name) && !authOk) return false;
    return true;
  });
}

// F-1.3 (ADR-0010): el catálogo de tools se migra incrementalmente para llevar
// acceso/cron/nivel_riesgo como metadato declarado en la propia tool (ver
// nucleo-cognitivo/src/tool-registry.js). Ese objeto es el mismo que
// llamarAnthropic() envía tal cual en `body.tools` — sin este whitelist, el
// metadato de ADR-0010 viajaría dentro del JSON real que recibe la API de
// Anthropic. Se extrae aquí para poder testearlo antes de migrar ninguna
// tool: solo deja pasar los campos que la API de Anthropic espera.
function toolsParaAnthropic(tools) {
  const lista = tools || [];
  return lista.map((t, i) => {
    const limpia = { name: t.name, description: t.description, input_schema: t.input_schema };
    if (i === lista.length - 1) limpia.cache_control = { type: 'ephemeral' };
    return limpia;
  });
}

// Valida que una query sea SOLO SELECT (sin verbos de escritura). Extraída de la
// lógica ya usada en consultar_bd para poder reutilizarla también en
// configurar_alerta (condicion_sql) y exportar_datos (sql_custom) -- fix
// continuación 14, ambas tenían SQL arbitrario sin ninguna de estas dos
// comprobaciones. Devuelve null si es válida, o el motivo de rechazo.
function validarSoloSelectBD(query) {
  if (!/^SELECT\b/i.test(query || '')) {
    return 'Solo se permiten consultas SELECT (lectura). No se admite INSERT, UPDATE, DELETE, DROP ni otras operaciones de escritura.';
  }
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/i.test(query)) {
    return 'Consulta rechazada: contiene operaciones de escritura no permitidas.';
  }
  return null;
}

// ── Aislamiento por empresa_id para consultar_bd / escribir_bd (fix IDOR) ───
const TABLAS_EMPRESA_PERMITIDAS = new Set([
  'ai_usage', 'albaranes', 'alejandra_logs', 'archivos', 'bobinas', 'carnets', 'carpetas',
  'carretillas', 'chat_alejandra', 'chat_mensajes', 'checklist_plantillas', 'checklist_registros',
  'docs_dept', 'docs_notas', 'documentos_obra', 'energias_carretilla', 'epi_revisiones',
  'epis_asignados', 'eventos_calendario', 'fichajes', 'fotos_obra', 'herramientas', 'historial',
  'historial_carretillas', 'historial_herramientas', 'historial_mantenimientos', 'historial_pemp',
  'horarios_obra', 'incidencia_fotos', 'incidencias', 'inspecciones_seg', 'inventario_seg',
  'invitaciones', 'kits_herramientas', 'logs', 'materiales_obra', 'movimientos_seg', 'obras',
  'partes_trabajo', 'pedidos', 'pemp', 'permisos_trabajo', 'personal_externo',
  'procedimientos_obra', 'proveedores', 'push_subscriptions', 'reconocimientos_medicos',
  'repostajes', 'sugerencias', 'sync_dispositivos', 'sync_eventos', 'tipos_cable',
  'tipos_carretilla', 'tipos_herramienta', 'tipos_material_seg', 'tipos_pemp', 'turnos', 'usuarios',
]);
const COLUMNA_BLOQUEADA_BD = /\bpassword_hash\b/i;

function extraerTablasQuery(query) {
  const tablas = new Set();
  const patrones = [/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, /\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, /\bINTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, /\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi];
  for (const re of patrones) {
    let m;
    while ((m = re.exec(query)) !== null) tablas.add(m[1].toLowerCase());
  }
  return [...tablas];
}

// Devuelve null si la query es válida para un usuario no-developer, o un string
// con el motivo de rechazo (que el modelo verá como resultado de la tool y puede
// usar para corregir su siguiente intento, igual que los demás errores de consultar_bd/escribir_bd).
//
// bypassEmpresaActivo (fix continuación 15): antes esta función saltaba el
// aislamiento de forma incondicional para cualquier dev verificado, sin que
// hubiera ningún interruptor ni registro de cuándo se usaba. Ahora Adrian puede
// activar/desactivar ese bypass explícitamente desde panel.html/app (persistido
// en agente_config.dev_bypass_empresa_scope, ver worker.js), y cada cambio queda
// auditado en alejandra_logs. Default = true para no cambiar el comportamiento
// de quien no pase este argumento (todos los call sites existentes lo pasan ya,
// pero mantenemos el default por si se añade alguno nuevo sin pensarlo).
function validarScopeEmpresaBD(query, params, empresaId, esDevVerificado, bypassEmpresaActivo = true) {
  if (esDevVerificado && bypassEmpresaActivo) return null;
  if (COLUMNA_BLOQUEADA_BD.test(query)) {
    return 'Consulta rechazada: no se permite acceder a columnas sensibles (password_hash) sin sesión de desarrollador verificada.';
  }
  const tablas = extraerTablasQuery(query);
  if (tablas.length === 0) {
    return 'Consulta rechazada: no se pudo determinar la tabla de la consulta.';
  }
  for (const t of tablas) {
    if (!TABLAS_EMPRESA_PERMITIDAS.has(t)) {
      return `Consulta rechazada: la tabla "${t}" no está permitida sin sesión de desarrollador verificada.`;
    }
  }
  const literal = query.match(/\bempresa_id\s*=\s*'?(\d+)'?/i);
  if (literal) {
    if (String(parseInt(literal[1], 10)) !== String(parseInt(empresaId, 10))) {
      return 'Consulta rechazada: el filtro empresa_id no coincide con tu empresa.';
    }
    return null;
  }
  const posPlaceholder = query.search(/\bempresa_id\s*=\s*\?/i);
  if (posPlaceholder !== -1) {
    const idx = (query.slice(0, posPlaceholder).match(/\?/g) || []).length;
    const valor = (params || [])[idx];
    if (valor === undefined || String(parseInt(valor, 10)) !== String(parseInt(empresaId, 10))) {
      return 'Consulta rechazada: el valor pasado en params para empresa_id no coincide con tu empresa (o falta).';
    }
    return null;
  }
  return 'Consulta rechazada: debes filtrar explícitamente por empresa_id (ej. AND empresa_id = ?).';
}

// ── Consulta de memoria_gobernada (ARC-008 §8, tool memoria_consultar) ──────
// Orden de confianza (migrate_memoria_gobernada.sql: TEXT 'alta'|'media'|'baja', §4) —
// necesario porque SQLite no compara ese enum numéricamente por sí solo.
const RANGO_CONFIANZA = Object.freeze({ baja: 1, media: 2, alta: 3 });

// Construye SQL + binds para leer memoria_gobernada, extraído a función pura
// para poder probar aislamiento por tenant, caducidad y confianza sin D1 real
// (decisión del Director, 2026-08-02: "Añadir pruebas de aislamiento,
// caducidad, confianza y ausencia de resultados cruzados"). worker.js solo
// ejecuta el SQL devuelto; toda la lógica de qué filtrar vive aquí.
//
// Invariantes que SIEMPRE se cumplen, sin excepción ni bypass:
//   - empresa_id = ? es el primer filtro y el primer bind -- aislamiento por tenant.
//   - estado = 'confirmada' -- nunca candidatas pendientes ni sustituidas.
//   - caduca_en > ahora -- nunca memoria caducada.
function construirConsultaMemoriaGobernada({
  empresaId,
  ahora,
  consulta = '',
  categorias = [],
  ambito = null,
  confianzaMinima = null,
  limit = 10,
}) {
  const where = ['empresa_id = ?', 'estado = ?', 'caduca_en > ?'];
  const binds = [String(empresaId), 'confirmada', ahora];

  if (categorias.length > 0) {
    const placeholders = categorias.map(() => '?').join(',');
    where.push(`categoria IN (${placeholders})`);
    binds.push(...categorias.map(String));
  }
  if (ambito) {
    where.push('ambito = ?');
    binds.push(String(ambito));
  }
  if (confianzaMinima && RANGO_CONFIANZA[confianzaMinima] != null) {
    const aceptadas = Object.keys(RANGO_CONFIANZA)
      .filter((nivel) => RANGO_CONFIANZA[nivel] >= RANGO_CONFIANZA[confianzaMinima]);
    where.push(`confianza IN (${aceptadas.map(() => '?').join(',')})`);
    binds.push(...aceptadas);
  }
  if (consulta && consulta.trim()) {
    where.push('contenido LIKE ?');
    binds.push(`%${consulta.trim()}%`);
  }

  const limitSeguro = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const sql = `SELECT id, contenido, origen, categoria, confianza, fecha_creacion, caduca_en, ambito, metodo
               FROM memoria_gobernada WHERE ${where.join(' AND ')} ORDER BY fecha_creacion DESC LIMIT ?`;

  return { sql, binds: [...binds, limitSeguro] };
}

// construirQueryAprendizajesEmpresa — builder puro para los recuerdos de tipo
// 'aprendizaje'/'contexto' que injectaContextoChat.
//
// SEC-CHAT-CONTEXTO-LEGACY / ARC-016: la query legada de injectarContextoChat
// leía alejandra_memoria SIN filtro de empresa_id, inyectando aprendizajes de
// TODAS las empresas en el contexto del chat actual (fuga cross-tenant). Este
// builder impone `empresa_id = ?` de forma OBLIGATORIA y verificable — misma
// garantía que construirConsultaMemoriaGobernada, pero sobre la tabla legada
// `alejandra_memoria` (que sigue activa hasta que ADR-0011/0013 migren a
// memoria_gobernada, migración todavía NO aplicada por requerir autorización).
//
// empresa_id es obligatorio y sale de la sesión autenticada (nunca del input
// del modelo): si falta, la query devuelve 0 filas (fail-closed) en vez de
// filtrar globalmente.
function construirQueryAprendizajesEmpresa({ empresaId, limit = 10 }) {
  const limitSeguro = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  if (!empresaId) {
    return {
      sql: "SELECT titulo, contenido, tipo FROM alejandra_memoria WHERE 1=0",
      binds: [],
    };
  }
  const sql = `SELECT titulo, contenido, tipo FROM alejandra_memoria
               WHERE empresa_id = ? AND (tipo = 'aprendizaje' OR tipo = 'contexto')
               ORDER BY importancia DESC, created_at DESC LIMIT ?`;

  return { sql, binds: [String(empresaId), limitSeguro] };
}

// ── Barrera humana para escrituras destructivas en escribir_bd ──────────────
// Misma filosofía que la barrera del worker web (alejandra-app-api): la
// confirmación NUNCA la controla el modelo (que genera el tool_input) — debe
// venir del mensaje REAL del humano ("CONFIRMO BORRADO <código>"). El modelo no
// puede fabricar el mensaje del usuario, así que no puede autoconfirmarse.
//
// Alcance EQUILIBRADO (decidido con Adrián): escribir_bd se usa constantemente
// para escrituras rutinarias (INSERT de registros, UPDATE de una fila concreta),
// así que exigir código a TODO haría el asistente insufrible. Solo se exige
// confirmación para lo genuinamente catastrófico: cualquier DELETE, y los UPDATE
// masivos (sin WHERE o con WHERE trivialmente-cierto). Un UPDATE con WHERE real
// y los INSERT/REPLACE pasan sin fricción. DROP/ALTER/TRUNCATE ya los rechaza de
// plano escribir_bd antes de llegar aquí.
const FRASE_CONFIRMACION_DESTRUCTIVA = 'CONFIRMO BORRADO';

// Extrae los códigos de confirmación del mensaje real del humano. Formato:
// "CONFIRMO BORRADO <6 hex>". Devuelve un Set en mayúsculas. El modelo no puede
// inyectar esto: se deriva del mensaje del usuario, no del tool_input del LLM.
function extraerCodigosConfirmacion(mensajeHumano) {
  const codigos = new Set();
  if (typeof mensajeHumano !== 'string') return codigos;
  const re = /CONFIRMO\s+BORRADO\s+([0-9A-Fa-f]{6})\b/g;
  let m;
  while ((m = re.exec(mensajeHumano)) !== null) codigos.add(m[1].toUpperCase());
  return codigos;
}

// Código ligado a una operación concreta: SHA-256 del SQL normalizado (espacios
// colapsados + mayúsculas), primeros 6 hex. Así la confirmación del humano solo
// autoriza ESA operación exacta. Mismo algoritmo que el worker web para que la
// experiencia sea idéntica entre las dos Alejandras.
async function codigoConfirmacionOp(descriptor) {
  const norm = String(descriptor).replace(/\s+/g, ' ').trim().toUpperCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 6).toUpperCase();
}

// ¿El WHERE de la query es trivialmente-cierto (afecta a toda la tabla igual que
// sin WHERE)? Detecta un conjunto curado de disfraces obvios: 1=1, 5=5, 'a'='a',
// TRUE, col IS NOT NULL, col>0, col>=0, col LIKE '%'. No pretende ser exhaustivo
// (regex no puede distinguir de forma fiable un WHERE siempre-cierto arbitrario):
// en modo equilibrado el DELETE SIEMPRE pide confirmación, y para UPDATE cerramos
// los disfraces obvios de "sin filtro". Un WHERE real y acotado (id=?,
// num_albaran=?) devuelve false y el UPDATE pasa sin fricción.
function whereEsTrivialmenteCierto(sql) {
  const mWhere = /\bWHERE\b([\s\S]+)$/i.exec(String(sql || ''));
  if (!mWhere) return false;
  let cond = mWhere[1].replace(/;\s*$/, '').trim();
  while (/^\([\s\S]*\)$/.test(cond)) cond = cond.slice(1, -1).trim();
  const triviales = [
    /^(\d+)\s*=\s*\1$/i,                              // 1=1, 5=5
    /^'([^']*)'\s*=\s*'\1'$/i,                        // 'a'='a'
    /^true$/i,                                        // WHERE TRUE
    /^[a-z_][a-z0-9_]*\s+IS\s+NOT\s+NULL$/i,          // col IS NOT NULL
    /^[a-z_][a-z0-9_]*\s*>\s*0$/i,                    // id > 0
    /^[a-z_][a-z0-9_]*\s*>=\s*0$/i,                   // id >= 0
    /^[a-z_][a-z0-9_]*\s+LIKE\s+'%'$/i,               // col LIKE '%'
  ];
  return triviales.some((re) => re.test(cond));
}

// Regla EQUILIBRADA de escritura destructiva para escribir_bd. Devuelve el motivo
// (string) si la operación exige barrera humana, o null si puede pasar sin
// fricción. Solo mira INSERT/UPDATE/DELETE/REPLACE (los únicos verbos que
// escribir_bd permite; DROP/ALTER/TRUNCATE ya están rechazados antes).
function detectarEscrituraDestructivaBalanceada(query) {
  const sql = String(query || '').trim();
  if (/^\s*DELETE\s+FROM\b/i.test(sql)) {
    return /\bWHERE\b/i.test(sql) ? 'DELETE (borra filas)' : 'DELETE sin WHERE (borra toda la tabla)';
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    if (!/\bWHERE\b/i.test(sql)) return 'UPDATE sin WHERE (modifica toda la tabla)';
    if (whereEsTrivialmenteCierto(sql)) return 'UPDATE con filtro siempre-cierto (modifica toda la tabla)';
    return null; // UPDATE con WHERE real -> pasa sin fricción (modo equilibrado)
  }
  return null; // INSERT / REPLACE -> no destructivo
}

// ── Interruptor dev-bypass (fix continuación 15) ────────────────────────────
// Adrian pidió poder desactivar, SOLO para sí mismo (dev verificado), el rate
// limiting del chat y el aislamiento por empresa_id -- sin afectar a ningún
// otro usuario/empresa. Este helper decide la parte de rate limit; la parte de
// empresa_id vive en validarScopeEmpresaBD (arriba), reutilizando el mismo
// parámetro bypassActivo por consistencia. Pura para poder testear la decisión
// sin mockear KV/D1 -- worker.js lee el valor persistido en
// agente_config.dev_bypass_rate_limit y se lo pasa aquí.
function debeOmitirRateLimitDev(esDevVerificado, bypassActivo) {
  return !!esDevVerificado && !!bypassActivo;
}

// ── Allowlist de hosts para test_endpoint (defensa en profundidad anti-SSRF) ─
const HOSTS_PERMITIDOS_TEST_ENDPOINT = ['alejandra-app.workers.dev'];
function urlPermitidaTestEndpoint(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    return HOSTS_PERMITIDOS_TEST_ENDPOINT.some(
      (dominio) => host === dominio || host.endsWith(`.${dominio}`)
    );
  } catch (_) {
    return false;
  }
}

// ── Decisión de reintento para fetchAnthropicConReintentos ──────────────────
// Extraído como funciones puras para poder testear la lógica de decisión sin
// mockear fetch/setTimeout de verdad. fetchAnthropicConReintentos() en worker.js
// hace el fetch real y usa estas dos funciones para decidir qué hacer.
function esStatusReintentableAnthropic(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

// backoffMs: tabla de espera por intento (0-indexed). retryAfterHeader: valor
// crudo del header Retry-After (string o null/undefined). Devuelve ms a esperar,
// respetando Retry-After si viene y es válido, capado a 2000ms.
function calcularEsperaReintentoMs(intento, backoffMs, retryAfterHeader) {
  let espera = backoffMs[intento] ?? 1200;
  if (retryAfterHeader) {
    const seg = parseFloat(retryAfterHeader);
    if (!isNaN(seg) && seg > 0) espera = Math.min(seg * 1000, 2000);
  }
  return espera;
}

// ── ARC-008 / ADR-0014 (02/08/2026) — observabilidad y trazas ──────────────
// Minimización/redacción (ADR-0014 §2.1): antes de persistir cualquier
// detalle en `alejandra_trazas.detalle_json`, se enmascaran patrones de texto
// libre que puedan ser datos personales -- como mínimo, emails y teléfonos
// españoles (9 dígitos). Puras para poder testearlas sin mockear D1.
// registrarTraza() en worker.js las usa antes de hacer el INSERT real.
function redactarTexto(valor) {
  if (typeof valor !== 'string') return valor;
  let out = valor.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email-redactado]');
  // Teléfono español: 9 dígitos (típicamente agrupados en 3+3+3), con o sin
  // prefijo +34/0034 y con o sin espacios/guiones entre grupos, acotado por
  // límite de palabra para no comerse fragmentos de números más largos (ids,
  // importes, etc.). No se pretende cubrir todos los formatos internacionales
  // -- ADR-0014 pide "como mínimo" este patrón.
  out = out.replace(/(?<![\d+])(?:\+34[\s-]?|0034[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g, '[telefono-redactado]');
  return out;
}

// Recorre recursivamente un valor (típicamente el `detalle` de una traza) y
// aplica redactarTexto() a cada string que encuentra. Profundidad acotada
// para no colgarse con estructuras circulares o extremadamente anidadas --
// en ese caso devuelve el valor tal cual a partir del límite (mejor un campo
// sin redactar por caso extremo que una excepción que tumbe registrarTraza).
function redactarDetalle(valor, profundidad = 0) {
  if (profundidad > 6) return valor;
  if (typeof valor === 'string') return redactarTexto(valor);
  if (Array.isArray(valor)) return valor.map((v) => redactarDetalle(v, profundidad + 1));
  if (valor && typeof valor === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(valor)) out[k] = redactarDetalle(v, profundidad + 1);
    return out;
  }
  return valor;
}

// Extrae la tabla afectada por un DDL (CREATE TABLE / ALTER TABLE) para
// poder resumir un ddl_error en una línea legible sin parsear SQL completo.
// Devuelve null si no se reconoce el patrón (no bloquea el registro de la
// traza, solo empobrece el resumen).
function extraerTablaDDL(sql) {
  const s = String(sql || '');
  let m = /ALTER\s+TABLE\s+([a-zA-Z_][a-zA-Z0-9_]*)/i.exec(s);
  if (m) return m[1];
  m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/i.exec(s);
  if (m) return m[1];
  return null;
}

// Deriva el estado de /health (ADR-0014 §4) a partir de si D1 y el centinela
// de R2 respondieron dentro del presupuesto de tiempo. Pura: worker.js hace
// las comprobaciones reales (SELECT 1 / FILES.head) y le pasa los booleanos.
//   - D1 falla (sola o con R2) -> 'unhealthy' (nada funciona sin BD)
//   - Solo R2 falla            -> 'degraded'  (fotos/documentos afectados)
//   - Las dos responden        -> 'healthy'
function determinarEstadoSalud(d1Ok, r2Ok) {
  if (!d1Ok) return 'unhealthy';
  if (!r2Ok) return 'degraded';
  return 'healthy';
}

// ── Cache de Nexo v2 (F-2.3) ───────────────────────────────────────────────
// construirCacheKeyNormativa: construye una clave de cache determinista y
// redactada (sin PII) para cachear resultados de buscar_normativa en KV.
//
// - Normaliza (lowercase + trim) para que "Tema X" y "tema x" compartan cache.
// - Usa un hash simple de la consulta para evitar keys gigantes o con
//   caracteres especiales que rompan KV (espacios, símbolos, etc.).
// - Prefixa con "nxcache:" para aislar en el namespace de RATE_LIMIT_KV y poder
//   borrar/inspeccionar sin tocar las claves de rate-limit.
// - Redacta emails/teléfonos de la consulta con redactarTexto() para evitar
//   persistir PII en KV, siguiendo el mismo patrón que redactarDetalle/trazas.
const NX_CACHE_PREFIX = 'nxcache:';

function construirCacheKeyNormativa({ consulta, itc, tema }) {
  const inputNormalizado = [consulta, itc, tema]
    .filter((v) => v && String(v).trim())
    .map((v) => String(v).trim().toLowerCase())
    .join('|');
  const redactado = redactarTexto(inputNormalizado);
  let hash = 0;
  for (let i = 0; i < redactado.length; i++) {
    hash = ((hash << 5) - hash + redactado.charCodeAt(i)) | 0;
  }
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  return `${NX_CACHE_PREFIX}${hashHex}`;
}

export {
  timingSafeEqual,
  PRECIOS_USD,
  calcularCosteYProveedor,
  TOOLS_SOLO_DEV_VERIFICADO,
  TOOLS_REQUIEREN_SESION,
  TOOLS_N1_LECTURA_PILOTO,
  esInvocacionN1DeLectura,
  filtrarToolsPorAuth,
  TOOLS_PROHIBIDAS_CRON,
  esInvocacionCron,
  filtrarToolsCron,
  toolsParaAnthropic,
  TABLAS_EMPRESA_PERMITIDAS,
  COLUMNA_BLOQUEADA_BD,
  extraerTablasQuery,
  validarScopeEmpresaBD,
  validarSoloSelectBD,
  debeOmitirRateLimitDev,
  HOSTS_PERMITIDOS_TEST_ENDPOINT,
  urlPermitidaTestEndpoint,
  esStatusReintentableAnthropic,
  calcularEsperaReintentoMs,
  FRASE_CONFIRMACION_DESTRUCTIVA,
  extraerCodigosConfirmacion,
  codigoConfirmacionOp,
  whereEsTrivialmenteCierto,
  detectarEscrituraDestructivaBalanceada,
  redactarTexto,
  redactarDetalle,
  extraerTablaDDL,
  determinarEstadoSalud,
  construirCacheKeyNormativa,
  RANGO_CONFIANZA,
  construirConsultaMemoriaGobernada,
  construirQueryAprendizajesEmpresa,
};
