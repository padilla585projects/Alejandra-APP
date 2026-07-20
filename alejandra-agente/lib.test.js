import { describe, it, expect } from 'vitest';
import {
  PRECIOS_USD,
  calcularCosteYProveedor,
  filtrarToolsPorAuth,
  extraerTablasQuery,
  validarScopeEmpresaBD,
  validarSoloSelectBD,
  debeOmitirRateLimitDev,
  urlPermitidaTestEndpoint,
  esStatusReintentableAnthropic,
  calcularEsperaReintentoMs,
  extraerCodigosConfirmacion,
  codigoConfirmacionOp,
  whereEsTrivialmenteCierto,
  detectarEscrituraDestructivaBalanceada,
} from './lib.js';

// ── calcularCosteYProveedor (fix continuación 9) ────────────────────────────
describe('calcularCosteYProveedor', () => {
  it('deriva proveedor "anthropic" y precio correcto para un modelo Claude', () => {
    const r = calcularCosteYProveedor('claude-sonnet-4-6', 1_000_000, 0);
    expect(r.proveedor).toBe('anthropic');
    expect(r.coste).toBeCloseTo(3.00, 6);
  });

  it('regresión: gpt-4o se etiqueta "openai" y usa SU precio real, no el de Claude', () => {
    // Antes de la continuación 9, 'gpt-4o' no estaba en PRECIOS_USD y cualquier
    // llamada con ese modelo caía en el precio por defecto (1$/5$, el de Haiku).
    const r = calcularCosteYProveedor('gpt-4o', 1_000_000, 1_000_000);
    expect(r.proveedor).toBe('openai');
    expect(r.coste).toBeCloseTo(PRECIOS_USD['gpt-4o'].in + PRECIOS_USD['gpt-4o'].out, 6);
    expect(r.coste).toBeCloseTo(12.50, 6);
  });

  it('gpt-4o-mini también se deriva como "openai"', () => {
    expect(calcularCosteYProveedor('gpt-4o-mini', 0, 0).proveedor).toBe('openai');
  });

  it('modelo desconocido cae al precio por defecto (1$ in / 5$ out) sin romper', () => {
    const r = calcularCosteYProveedor('modelo-futuro-desconocido', 1_000_000, 1_000_000);
    expect(r.proveedor).toBe('anthropic'); // no empieza por "gpt"
    expect(r.coste).toBeCloseTo(6.00, 6);
  });

  it('coste es proporcional a los tokens de entrada y salida por separado', () => {
    const soloEntrada = calcularCosteYProveedor('claude-haiku-4-5', 2_000_000, 0);
    const soloSalida  = calcularCosteYProveedor('claude-haiku-4-5', 0, 2_000_000);
    expect(soloEntrada.coste).toBeCloseTo(2.00, 6);
    expect(soloSalida.coste).toBeCloseTo(10.00, 6);
  });

  // Fix: modelos "vendor/modelo" o ":free" se etiquetaban "anthropic" a ciegas
  // (cualquier cosa que no empezara por "gpt"), corrompiendo las estadísticas de
  // coste/proveedor de alejandra_token_uso cuando entraba en juego la cascada de
  // OpenRouter de llamarGPT4oFallback() en worker.js.
  it('modelo OpenRouter con formato "vendor/modelo:free" se deriva como "openrouter" y coste 0 (gratis de verdad)', () => {
    const r = calcularCosteYProveedor('nvidia/nemotron-3-ultra-550b-a55b:free', 1_000_000, 1_000_000);
    expect(r.proveedor).toBe('openrouter');
    expect(r.coste).toBe(0);
  });

  it('modelo OpenRouter "openai/..." NO se confunde con "openai" solo por el prefijo del vendor', () => {
    const r = calcularCosteYProveedor('openai/gpt-oss-120b:free', 1_000_000, 1_000_000);
    expect(r.proveedor).toBe('openrouter');
    expect(r.coste).toBe(0);
  });

  it('modelo OpenRouter de pago (sin ":free") se tarifica en € y se convierte a $ para coste_usd', () => {
    // Sin entrada explícita en PRECIOS_EUR_OPENROUTER, cae al defecto 1€ in / 5€ out
    // por millón de tokens, convertido a $ con el tipo de cambio fijo EUR_A_USD (1.08).
    const r = calcularCosteYProveedor('vendor/modelo-de-pago', 1_000_000, 0);
    expect(r.proveedor).toBe('openrouter');
    expect(r.coste).toBeCloseTo(1.08, 6);
  });
});

// ── filtrarToolsPorAuth ──────────────────────────────────────────────────────
describe('filtrarToolsPorAuth', () => {
  const tools = [
    { name: 'patch_codigo' },
    { name: 'consultar_bd' },
    { name: 'buscar_web' },
  ];

  it('sin auth ni dev: solo deja pasar tools públicas', () => {
    const r = filtrarToolsPorAuth(tools, false, false);
    expect(r.map(t => t.name)).toEqual(['buscar_web']);
  });

  it('con sesión pero sin dev verificado: deja consultar_bd pero no patch_codigo', () => {
    const r = filtrarToolsPorAuth(tools, true, false);
    expect(r.map(t => t.name)).toEqual(['consultar_bd', 'buscar_web']);
  });

  it('dev verificado sin sesión: deja patch_codigo pero no consultar_bd (requiere sesión aparte)', () => {
    const r = filtrarToolsPorAuth(tools, false, true);
    expect(r.map(t => t.name)).toEqual(['patch_codigo', 'buscar_web']);
  });

  it('dev verificado y con sesión: pasan todas', () => {
    const r = filtrarToolsPorAuth(tools, true, true);
    expect(r.map(t => t.name)).toEqual(['patch_codigo', 'consultar_bd', 'buscar_web']);
  });

  it('lista vacía o null no rompe', () => {
    expect(filtrarToolsPorAuth(null, true, true)).toEqual([]);
    expect(filtrarToolsPorAuth([], true, true)).toEqual([]);
  });

  // fix continuación 14 (IDOR/SQLi en configurar_alerta y exportar_datos):
  // configurar_alerta pasa a exigir dev verificado (igual que patch_codigo,
  // guardaba SQL arbitrario ejecutado sin scope); exportar_datos pasa a exigir
  // sesión como mínimo (exportaba datos de todas las empresas sin filtro).
  const toolsFix14 = [
    { name: 'configurar_alerta' },
    { name: 'exportar_datos' },
    { name: 'buscar_web' },
  ];

  it('configurar_alerta requiere dev verificado, no basta con sesión', () => {
    const r = filtrarToolsPorAuth(toolsFix14, true, false);
    expect(r.map(t => t.name)).toEqual(['exportar_datos', 'buscar_web']);
  });

  it('exportar_datos requiere sesión, no pasa sin auth aunque sea dev', () => {
    const r = filtrarToolsPorAuth(toolsFix14, false, true);
    expect(r.map(t => t.name)).toEqual(['configurar_alerta', 'buscar_web']);
  });

  it('con sesión y dev verificado pasan ambas', () => {
    const r = filtrarToolsPorAuth(toolsFix14, true, true);
    expect(r.map(t => t.name)).toEqual(['configurar_alerta', 'exportar_datos', 'buscar_web']);
  });

  it('sin sesión ni dev verificado, ninguna de las dos pasa', () => {
    const r = filtrarToolsPorAuth(toolsFix14, false, false);
    expect(r.map(t => t.name)).toEqual(['buscar_web']);
  });

  // fix continuación 17 (IDOR en listar_esquemas/borrar_esquema): antes ninguna
  // de las dos exigía siquiera sesión, y en worker.js no filtraban por
  // empresa_id -- ahora exigen sesión como mínimo (el scope real de empresa_id
  // se aplica en worker.js, igual que exportar_datos).
  const toolsFix17 = [
    { name: 'listar_esquemas' },
    { name: 'borrar_esquema' },
    { name: 'buscar_web' },
  ];

  it('listar_esquemas/borrar_esquema requieren sesión, no pasan sin auth', () => {
    const r = filtrarToolsPorAuth(toolsFix17, false, false);
    expect(r.map(t => t.name)).toEqual(['buscar_web']);
  });

  it('listar_esquemas/borrar_esquema pasan con sesión (sin necesitar dev verificado)', () => {
    const r = filtrarToolsPorAuth(toolsFix17, true, false);
    expect(r.map(t => t.name)).toEqual(['listar_esquemas', 'borrar_esquema', 'buscar_web']);
  });

  // fix continuación 19 (IDOR/exfiltración cross-empresa, 5 familias): ninguna de
  // estas 12 tools exigía sesión -- historico_materiales y generar_informe
  // exponían datos de todas las empresas; analizar_archivo/marcar_plano/
  // enviar_email/enviar_telegram_informe permitían leer/reenviar archivos R2 de
  // otra empresa; crear_tarea_background/ver_tareas/completar_tarea permitían
  // tocar tareas de otro usuario; enviar_push/iniciar_conversacion/controlar_app
  // permitían notificar/actuar sobre la app de un usuario de otra empresa. Ahora
  // las 12 exigen sesión como mínimo (el scope real por empresa_id/usuario_id/
  // propiedad de archivo se aplica en worker.js, con bypass para dev verificado).
  const toolsFix19 = [
    { name: 'historico_materiales' },
    { name: 'generar_informe' },
    { name: 'analizar_archivo' },
    { name: 'marcar_plano' },
    { name: 'enviar_email' },
    { name: 'enviar_telegram_informe' },
    { name: 'crear_tarea_background' },
    { name: 'ver_tareas' },
    { name: 'completar_tarea' },
    { name: 'enviar_push' },
    { name: 'iniciar_conversacion' },
    { name: 'controlar_app' },
    { name: 'buscar_web' },
  ];

  it('las 12 tools de continuación 19 requieren sesión, no pasan sin auth', () => {
    const r = filtrarToolsPorAuth(toolsFix19, false, false);
    expect(r.map(t => t.name)).toEqual(['buscar_web']);
  });

  it('las 12 tools de continuación 19 pasan con sesión (sin necesitar dev verificado)', () => {
    const r = filtrarToolsPorAuth(toolsFix19, true, false);
    expect(r.map(t => t.name)).toEqual([
      'historico_materiales', 'generar_informe', 'analizar_archivo', 'marcar_plano',
      'enviar_email', 'enviar_telegram_informe', 'crear_tarea_background', 'ver_tareas',
      'completar_tarea', 'enviar_push', 'iniciar_conversacion', 'controlar_app', 'buscar_web'
    ]);
  });

  it('las 12 tools de continuación 19 no requieren dev verificado si hay sesión', () => {
    const r = filtrarToolsPorAuth(toolsFix19, true, true);
    expect(r.length).toBe(toolsFix19.length);
  });

  // fix continuación 20: subir_archivo escribía en cualquier key de R2 sin
  // customMetadata.usuario_id ni comprobar si esa key ya pertenecía a otra
  // empresa, y no exigía sesión -- alcanzable por cualquier usuario autenticado
  // de cualquier empresa. enviar_notificacion es código huérfano (no se ofrece
  // en ningún TOOLS_POR_EXPERTO hoy) con el mismo patrón IDOR que enviar_push
  // antes de continuación 19. Ambas exigen sesión ahora como mínimo.
  const toolsFix20 = [
    { name: 'subir_archivo' },
    { name: 'enviar_notificacion' },
    { name: 'buscar_web' },
  ];

  it('subir_archivo/enviar_notificacion requieren sesión, no pasan sin auth', () => {
    const r = filtrarToolsPorAuth(toolsFix20, false, false);
    expect(r.map(t => t.name)).toEqual(['buscar_web']);
  });

  it('subir_archivo/enviar_notificacion pasan con sesión (sin necesitar dev verificado)', () => {
    const r = filtrarToolsPorAuth(toolsFix20, true, false);
    expect(r.map(t => t.name)).toEqual(['subir_archivo', 'enviar_notificacion', 'buscar_web']);
  });
});

// ── puedeNotificarUsuario (fix continuación 19: IDOR en enviar_push/
// iniciar_conversacion/controlar_app) -- esta función vive en worker.js (necesita
// env.DB real), así que aquí solo se documenta el contrato esperado a través del
// propio Set de gating; el comportamiento con D1 real se cubre con las pruebas
// manuales descritas en SESION.md/ALEJANDRA_AGENTE.txt (no se puede mockear D1
// sin duplicar demasiada infraestructura en este archivo de tests puros).

// ── Fix continuación 20 (no cubierto aquí, necesita env.DB/env.FILES reales,
// ver pruebas manuales en SESION.md/ALEJANDRA_AGENTE.txt) ────────────────────
// 1) subir_archivo ahora reutiliza puedeAccederArchivo() para bloquear la
//    sobrescritura de una key que ya pertenece a otra empresa, y guarda
//    customMetadata.usuario_id real al escribir (antes no guardaba ninguno).
// 2) enviar_notificacion ahora reutiliza puedeNotificarUsuario() igual que
//    enviar_push/iniciar_conversacion/controlar_app.
// 3) ejecutarTool() cambia su default de authOk=true (fail-open) a
//    authOk=false (fail-closed); ejecutarReflexion() -- el único call site que
//    no pasaba authOk/esDevVerificado explícitos -- ahora los pasa como
//    `false, false` para que quede documentado en el propio código.

// ── validarSoloSelectBD (fix continuación 14, reutilizada en configurar_alerta
// y exportar_datos, antes solo vivía inline dentro de consultar_bd) ──────────
describe('validarSoloSelectBD', () => {
  it('acepta un SELECT simple', () => {
    expect(validarSoloSelectBD('SELECT * FROM obras WHERE empresa_id = 1')).toBeNull();
  });

  it('es case-insensitive para el prefijo SELECT', () => {
    expect(validarSoloSelectBD('select * from obras')).toBeNull();
  });

  it('rechaza queries que no empiezan por SELECT', () => {
    expect(validarSoloSelectBD("UPDATE usuarios SET nombre='x'")).toMatch(/Solo se permiten consultas SELECT/);
    expect(validarSoloSelectBD('DELETE FROM obras')).toMatch(/Solo se permiten consultas SELECT/);
    expect(validarSoloSelectBD('DROP TABLE obras')).toMatch(/Solo se permiten consultas SELECT/);
  });

  it('rechaza un SELECT que contiene un verbo de escritura colado (ej. subquery o CTE con INSERT)', () => {
    const r = validarSoloSelectBD('SELECT * FROM obras; INSERT INTO logs (a) VALUES (1)');
    expect(r).toMatch(/operaciones de escritura no permitidas/);
  });

  it('detecta verbos de escritura sin importar mayúsculas/minúsculas', () => {
    const r = validarSoloSelectBD('SELECT * FROM obras where 1=1 update usuarios set x=1');
    expect(r).toMatch(/operaciones de escritura no permitidas/);
  });

  it('rechaza query vacía, null o undefined sin lanzar excepción', () => {
    expect(validarSoloSelectBD('')).toMatch(/Solo se permiten consultas SELECT/);
    expect(validarSoloSelectBD(null)).toMatch(/Solo se permiten consultas SELECT/);
    expect(validarSoloSelectBD(undefined)).toMatch(/Solo se permiten consultas SELECT/);
  });
});

// ── extraerTablasQuery ───────────────────────────────────────────────────────
describe('extraerTablasQuery', () => {
  it('detecta la tabla de un SELECT simple', () => {
    expect(extraerTablasQuery('SELECT * FROM obras WHERE id = 1')).toEqual(['obras']);
  });

  it('detecta múltiples tablas en un JOIN', () => {
    const tablas = extraerTablasQuery('SELECT * FROM obras o JOIN fichajes f ON f.obra_id = o.id');
    expect(tablas.sort()).toEqual(['fichajes', 'obras']);
  });

  it('detecta tabla de un UPDATE y de un INSERT INTO', () => {
    expect(extraerTablasQuery("UPDATE usuarios SET nombre='x' WHERE id=1")).toEqual(['usuarios']);
    expect(extraerTablasQuery("INSERT INTO logs (a) VALUES (1)")).toEqual(['logs']);
  });

  it('es case-insensitive y no duplica tablas repetidas', () => {
    const tablas = extraerTablasQuery('select * from Obras where empresa_id=1 union select * from obras where empresa_id=2');
    expect(tablas).toEqual(['obras']);
  });

  it('devuelve lista vacía si no reconoce ninguna tabla', () => {
    expect(extraerTablasQuery('PRAGMA table_info(x)')).toEqual([]);
  });
});

// ── validarScopeEmpresaBD (fix IDOR) ─────────────────────────────────────────
describe('validarScopeEmpresaBD', () => {
  it('dev verificado se salta toda la validación', () => {
    expect(validarScopeEmpresaBD('SELECT password_hash FROM usuarios', [], 5, true)).toBeNull();
  });

  it('rechaza acceso a password_hash sin dev verificado', () => {
    const r = validarScopeEmpresaBD('SELECT password_hash FROM usuarios WHERE empresa_id=1', [], 1, false);
    expect(r).toMatch(/columnas sensibles/);
  });

  it('rechaza tablas fuera de la allowlist (ej. sesiones, para evitar suplantación)', () => {
    const r = validarScopeEmpresaBD('SELECT * FROM sesiones WHERE empresa_id=1', [], 1, false);
    expect(r).toMatch(/no está permitida/);
  });

  it('rechaza si no se puede determinar ninguna tabla', () => {
    const r = validarScopeEmpresaBD('PRAGMA table_info(obras)', [], 1, false);
    expect(r).toMatch(/no se pudo determinar/);
  });

  it('rechaza si falta el filtro empresa_id por completo', () => {
    const r = validarScopeEmpresaBD('SELECT * FROM obras', [], 1, false);
    expect(r).toMatch(/debes filtrar explícitamente/);
  });

  it('rechaza si el empresa_id literal no coincide con el del que llama (núcleo del fix IDOR)', () => {
    const r = validarScopeEmpresaBD('SELECT * FROM obras WHERE empresa_id = 2', [], 1, false);
    expect(r).toMatch(/no coincide con tu empresa/);
  });

  it('acepta si el empresa_id literal coincide', () => {
    expect(validarScopeEmpresaBD('SELECT * FROM obras WHERE empresa_id = 1', [], 1, false)).toBeNull();
  });

  it('rechaza si el placeholder ? de empresa_id no coincide con params (o falta)', () => {
    const r1 = validarScopeEmpresaBD('SELECT * FROM obras WHERE empresa_id = ?', [2], 1, false);
    expect(r1).toMatch(/no coincide con tu empresa/);
    const r2 = validarScopeEmpresaBD('SELECT * FROM obras WHERE empresa_id = ?', [], 1, false);
    expect(r2).toMatch(/no coincide con tu empresa/);
  });

  it('acepta si el placeholder ? de empresa_id coincide con el params correspondiente', () => {
    // Dos placeholders antes del de empresa_id -> debe mirar el 3er valor de params (índice 2)
    const r = validarScopeEmpresaBD(
      'SELECT * FROM obras WHERE nombre = ? AND activo = ? AND empresa_id = ?',
      ['x', 1, 5],
      5,
      false
    );
    expect(r).toBeNull();
  });

  // ── bypassEmpresaActivo (fix continuación 15: interruptor dev-bypass) ──────
  it('dev verificado CON bypassEmpresaActivo=true se salta la validación (comportamiento histórico)', () => {
    expect(validarScopeEmpresaBD('SELECT * FROM obras', [], 1, true, true)).toBeNull();
  });

  it('dev verificado CON bypassEmpresaActivo omitido (default) se sigue saltando la validación', () => {
    // Backward-compat: los call sites que aún no pasen el 5º argumento no deben
    // cambiar de comportamiento.
    expect(validarScopeEmpresaBD('SELECT * FROM obras', [], 1, true)).toBeNull();
  });

  it('dev verificado CON bypassEmpresaActivo=false NO se salta la validación (se auto-restringe)', () => {
    const r = validarScopeEmpresaBD('SELECT * FROM obras', [], 1, true, false);
    expect(r).toMatch(/debes filtrar explícitamente/);
  });

  it('dev verificado con bypassEmpresaActivo=false pero query correctamente filtrada por su empresa: se acepta', () => {
    expect(validarScopeEmpresaBD('SELECT * FROM obras WHERE empresa_id = 1', [], 1, true, false)).toBeNull();
  });

  it('no-dev con bypassEmpresaActivo=true sigue sin poder saltarse la validación (el bypass es solo para dev)', () => {
    const r = validarScopeEmpresaBD('SELECT * FROM obras', [], 1, false, true);
    expect(r).toMatch(/debes filtrar explícitamente/);
  });
});

// ── debeOmitirRateLimitDev (fix continuación 15: interruptor dev-bypass) ────
describe('debeOmitirRateLimitDev', () => {
  it('dev verificado + bypass activo -> omite el rate limit', () => {
    expect(debeOmitirRateLimitDev(true, true)).toBe(true);
  });

  it('dev verificado + bypass inactivo -> NO omite el rate limit (comportamiento actual)', () => {
    expect(debeOmitirRateLimitDev(true, false)).toBe(false);
  });

  it('no-dev + bypass "activo" (valor de config irrelevante) -> NUNCA omite el rate limit', () => {
    // Aunque alguien manipulara el valor de config, sin esDevVerificado=true no hay bypass.
    expect(debeOmitirRateLimitDev(false, true)).toBe(false);
  });

  it('no-dev + bypass inactivo -> no omite', () => {
    expect(debeOmitirRateLimitDev(false, false)).toBe(false);
  });

  it('valores falsy no booleanos (undefined/null) se tratan como false', () => {
    expect(debeOmitirRateLimitDev(undefined, undefined)).toBe(false);
    expect(debeOmitirRateLimitDev(true, null)).toBe(false);
  });
});

// ── urlPermitidaTestEndpoint (allowlist anti-SSRF) ───────────────────────────
describe('urlPermitidaTestEndpoint', () => {
  it('acepta el host exacto permitido sobre https', () => {
    expect(urlPermitidaTestEndpoint('https://alejandra-app.workers.dev/health')).toBe(true);
  });

  it('acepta subdominios del host permitido', () => {
    expect(urlPermitidaTestEndpoint('https://alejandra-agente.alejandra-app.workers.dev/health')).toBe(true);
  });

  it('rechaza http (no https)', () => {
    expect(urlPermitidaTestEndpoint('http://alejandra-app.workers.dev/health')).toBe(false);
  });

  it('rechaza hosts arbitrarios (intento de SSRF)', () => {
    expect(urlPermitidaTestEndpoint('https://evil.example.com/')).toBe(false);
    expect(urlPermitidaTestEndpoint('https://169.254.169.254/latest/meta-data/')).toBe(false);
  });

  it('rechaza intento de bypass con dominio parecido (no es subdominio real)', () => {
    expect(urlPermitidaTestEndpoint('https://alejandra-app.workers.dev.evil.com/')).toBe(false);
    expect(urlPermitidaTestEndpoint('https://evilalejandra-app.workers.dev/')).toBe(false);
  });

  it('rechaza URLs malformadas, vacías o no-string sin lanzar excepción', () => {
    expect(urlPermitidaTestEndpoint('no-es-una-url')).toBe(false);
    expect(urlPermitidaTestEndpoint('')).toBe(false);
    expect(urlPermitidaTestEndpoint(null)).toBe(false);
    expect(urlPermitidaTestEndpoint(undefined)).toBe(false);
  });
});

// ── Decisión de reintento (fetchAnthropicConReintentos) ──────────────────────
describe('esStatusReintentableAnthropic', () => {
  it('considera reintentables 429, 500, 502, 503, 529', () => {
    for (const s of [429, 500, 502, 503, 529]) {
      expect(esStatusReintentableAnthropic(s)).toBe(true);
    }
  });

  it('no considera reintentables 200, 400, 401, 404', () => {
    for (const s of [200, 400, 401, 404]) {
      expect(esStatusReintentableAnthropic(s)).toBe(false);
    }
  });
});

describe('calcularEsperaReintentoMs', () => {
  const backoffMs = [400, 1200];

  it('usa la tabla de backoff cuando no hay header Retry-After', () => {
    expect(calcularEsperaReintentoMs(0, backoffMs, null)).toBe(400);
    expect(calcularEsperaReintentoMs(1, backoffMs, null)).toBe(1200);
  });

  it('respeta Retry-After si es válido, convertido a ms', () => {
    expect(calcularEsperaReintentoMs(0, backoffMs, '1')).toBe(1000);
  });

  it('capa Retry-After a 2000ms como máximo (no alargar demasiado la respuesta)', () => {
    expect(calcularEsperaReintentoMs(0, backoffMs, '30')).toBe(2000);
  });

  it('ignora Retry-After inválido o negativo y usa el backoff por defecto', () => {
    expect(calcularEsperaReintentoMs(0, backoffMs, 'no-numero')).toBe(400);
    expect(calcularEsperaReintentoMs(0, backoffMs, '-5')).toBe(400);
    expect(calcularEsperaReintentoMs(0, backoffMs, '0')).toBe(400);
  });

  it('usa 1200 como fallback si el intento excede la tabla de backoff', () => {
    expect(calcularEsperaReintentoMs(5, backoffMs, null)).toBe(1200);
  });
});

// ── Barrera humana anti-borrado en escribir_bd (alcance equilibrado) ─────────
describe('extraerCodigosConfirmacion', () => {
  it('extrae un código válido de 6 hex del mensaje humano', () => {
    const s = extraerCodigosConfirmacion('vale, CONFIRMO BORRADO 9F3C21 adelante');
    expect(s.has('9F3C21')).toBe(true);
    expect(s.size).toBe(1);
  });

  it('normaliza a mayúsculas y admite varios códigos', () => {
    const s = extraerCodigosConfirmacion('CONFIRMO BORRADO abc123 y CONFIRMO BORRADO DEF456');
    expect(s.has('ABC123')).toBe(true);
    expect(s.has('DEF456')).toBe(true);
  });

  it('devuelve Set vacío si no hay frase o el argumento no es string', () => {
    expect(extraerCodigosConfirmacion('borra la tabla porfa').size).toBe(0);
    expect(extraerCodigosConfirmacion(null).size).toBe(0);
    expect(extraerCodigosConfirmacion(undefined).size).toBe(0);
  });

  it('ignora códigos que no sean exactamente 6 hex', () => {
    expect(extraerCodigosConfirmacion('CONFIRMO BORRADO 12345').size).toBe(0);   // 5
    expect(extraerCodigosConfirmacion('CONFIRMO BORRADO ZZZZZZ').size).toBe(0);  // no hex
  });
});

describe('codigoConfirmacionOp', () => {
  it('es determinista y de 6 hex en mayúsculas para el mismo SQL', async () => {
    const a = await codigoConfirmacionOp('DELETE FROM x WHERE 1=1');
    const b = await codigoConfirmacionOp('DELETE FROM x WHERE 1=1');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9A-F]{6}$/);
  });

  it('ignora diferencias de espaciado y capitalización (normalización)', async () => {
    const a = await codigoConfirmacionOp('DELETE   FROM x   WHERE 1=1');
    const b = await codigoConfirmacionOp('delete from x where 1=1');
    expect(a).toBe(b);
  });

  it('cambia el código si cambia el SQL (código atado a la operación exacta)', async () => {
    const a = await codigoConfirmacionOp('DELETE FROM x WHERE id=1');
    const b = await codigoConfirmacionOp('DELETE FROM x WHERE id=2');
    expect(a).not.toBe(b);
  });
});

describe('whereEsTrivialmenteCierto', () => {
  it('detecta disfraces siempre-ciertos', () => {
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE 1=1')).toBe(true);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE 5=5')).toBe(true);
    expect(whereEsTrivialmenteCierto("UPDATE t SET a=1 WHERE 'x'='x'")).toBe(true);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE TRUE')).toBe(true);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE id IS NOT NULL')).toBe(true);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE id > 0')).toBe(true);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE (1=1)')).toBe(true);
  });

  it('NO marca como trivial un WHERE real y acotado', () => {
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE id=?')).toBe(false);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE num_albaran=632404024')).toBe(false);
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1 WHERE 1=1 AND rol=?')).toBe(false);
  });

  it('devuelve false si no hay WHERE', () => {
    expect(whereEsTrivialmenteCierto('UPDATE t SET a=1')).toBe(false);
  });
});

describe('detectarEscrituraDestructivaBalanceada', () => {
  it('bloquea CUALQUIER DELETE (con o sin WHERE)', () => {
    expect(detectarEscrituraDestructivaBalanceada('DELETE FROM bobinas')).toMatch(/DELETE/);
    expect(detectarEscrituraDestructivaBalanceada('DELETE FROM bobinas WHERE id=5')).toMatch(/DELETE/);
    expect(detectarEscrituraDestructivaBalanceada('DELETE FROM bobinas WHERE 1=1')).toMatch(/DELETE/);
  });

  it('bloquea UPDATE masivo (sin WHERE o con WHERE siempre-cierto)', () => {
    expect(detectarEscrituraDestructivaBalanceada('UPDATE usuarios SET rol=?')).toMatch(/UPDATE/);
    expect(detectarEscrituraDestructivaBalanceada("UPDATE usuarios SET rol='superadmin' WHERE 1=1")).toMatch(/UPDATE/);
  });

  it('PERMITE (null) un UPDATE con WHERE real — sin fricción en el día a día', () => {
    expect(detectarEscrituraDestructivaBalanceada('UPDATE tareas_alejandra SET estado=? WHERE id=?')).toBeNull();
    expect(detectarEscrituraDestructivaBalanceada('UPDATE fases_obra SET porcentaje=? WHERE id=? AND empresa_id=?')).toBeNull();
  });

  it('PERMITE (null) INSERT y REPLACE (no son destructivos)', () => {
    expect(detectarEscrituraDestructivaBalanceada('INSERT INTO bobinas (id) VALUES (?)')).toBeNull();
    expect(detectarEscrituraDestructivaBalanceada('REPLACE INTO turnos (id) VALUES (?)')).toBeNull();
  });

  it('regresión SEC-08: el DELETE ... WHERE 1=1 NO se cuela', () => {
    expect(detectarEscrituraDestructivaBalanceada('DELETE FROM bobinas WHERE 1=1')).not.toBeNull();
  });
});
