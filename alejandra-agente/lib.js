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

// ── Precios y coste (fix continuación 9: gpt-4o mal etiquetado/tarificado) ───
const PRECIOS_USD = {
  'claude-haiku-4-5':  { in: 1.00,  out: 5.00  },
  'claude-sonnet-4-6': { in: 3.00,  out: 15.00 },
  'gpt-4o-mini':       { in: 0.15,  out: 0.60  },
  // Antes faltaba: cuando llamarGPT4oFallback() entraba en juego, registrarTokenUso()
  // recibía el nombre del modelo Claude original (no 'gpt-4o'), así que este precio
  // nunca se llegaba a usar y el coste se calculaba mal con el precio de Claude.
  'gpt-4o':            { in: 2.50,  out: 10.00 }
};

// Calcula proveedor + coste USD para un uso de tokens. Pura: no toca D1.
// registrarTokenUso() en worker.js hace el INSERT con lo que esto devuelve.
function calcularCosteYProveedor(modelo, tokensEntrada, tokensSalida) {
  const p = PRECIOS_USD[modelo] || { in: 1.00, out: 5.00 };
  const coste = (tokensEntrada * p.in + tokensSalida * p.out) / 1_000_000;
  const proveedor = modelo.startsWith('gpt') ? 'openai' : 'anthropic';
  return { proveedor, coste };
}

// ── Filtrado de tools por nivel de auth (dev verificado / sesión) ───────────
// configurar_alerta (fix continuación 14, IDOR/SQLi): la acción "crear" guarda un
// SQL arbitrario (condicion_sql) que "verificar" ejecuta directamente sin scope de
// empresa_id -- se restringe a dev verificado, igual que patch_codigo/rollback, en
// vez de dejarla abierta a cualquier sesión (ver validaciones extra en worker.js).
const TOOLS_SOLO_DEV_VERIFICADO = new Set(['patch_codigo', 'github_escribir', 'ejecutar_deploy', 'rollback', 'test_endpoint', 'configurar_alerta']);
// exportar_datos (fix continuación 14, IDOR/SQLi): exportaba datos de TODAS las
// empresas sin filtro y con obra_id/fechas concatenados sin parametrizar -- ahora
// exige sesión como mínimo (el scope real por empresa_id se aplica en worker.js).
// listar_esquemas/borrar_esquema (fix continuación 17, IDOR): no filtraban por
// empresa_id en worker.js y ni siquiera exigían sesión -- cualquiera podía listar
// y borrar esquemas (y su archivo R2) de otra empresa. Ahora exigen sesión como
// mínimo (el scope real por empresa_id se aplica en worker.js, igual que
// exportar_datos).
const TOOLS_REQUIEREN_SESION    = new Set(['consultar_bd', 'escribir_bd', 'listar_archivos', 'ver_archivo', 'exportar_datos', 'listar_esquemas', 'borrar_esquema']);
function filtrarToolsPorAuth(tools, authOk, esDevVerificado) {
  return (tools || []).filter(t => {
    if (TOOLS_SOLO_DEV_VERIFICADO.has(t.name) && !esDevVerificado) return false;
    if (TOOLS_REQUIEREN_SESION.has(t.name) && !authOk) return false;
    return true;
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

export {
  PRECIOS_USD,
  calcularCosteYProveedor,
  TOOLS_SOLO_DEV_VERIFICADO,
  TOOLS_REQUIEREN_SESION,
  filtrarToolsPorAuth,
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
};
