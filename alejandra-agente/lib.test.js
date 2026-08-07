import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PRECIOS_USD,
  calcularCosteYProveedor,
  filtrarToolsPorAuth,
  filtrarToolsCron,
  toolsParaAnthropic,
  esInvocacionCron,
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
  TOOLS_SOLO_DEV_VERIFICADO,
  TOOLS_N1_LECTURA_PILOTO,
  esInvocacionN1DeLectura,
  redactarTexto,
  redactarDetalle,
  extraerTablaDDL,
  determinarEstadoSalud,
  construirConsultaMemoriaGobernada,
  construirQueryAprendizajesEmpresa,
  RANGO_CONFIANZA,
  construirCacheKeyNormativa,
} from './lib.js';

describe('aislamiento del contexto del chat', () => {
  it('no inyecta las tablas legacy globales en el prompt de sistema', () => {
    const worker = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    const inicio = worker.indexOf('async function buildAnthropicSystemBlocks');
    const fin = worker.indexOf('// ── Tools disponibles', inicio);
    const funcion = worker.slice(inicio, fin);

    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fin).toBeGreaterThan(inicio);
    expect(funcion).not.toMatch(/alejandra_(ram|errores|memoria|logs|historial)/);
  });
});

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

  // SEC-ANON-01 (02/08/2026): pruebas negativas de autorización.
  // `/api/chat` acepta peticiones sin sesión a propósito, y sin sesión el `empresa_id`
  // sale del body sin verificar. Estas tools estaban FUERA del gateo, así que un anónimo
  // podía leer datos de la empresa que eligiera y código privado de GitHub.
  // Si alguien las saca de TOOLS_REQUIEREN_SESION, este test tiene que romperse.
  it('sin sesión: ninguna tool de datos de empresa es alcanzable', () => {
    const datos = ['consultar_personal', 'consultar_inventario', 'estado_obra',
      'buscar_documentos', 'buscar_proveedores', 'consultar_precios',
      'consultar_punch_list', 'buscar_tareas', 'recuperar_conversacion']
      .map(name => ({ name }));
    expect(filtrarToolsPorAuth(datos, false, false)).toEqual([]);
  });

  it('sin sesión: ninguna tool que escriba datos de empresa es alcanzable', () => {
    const escritura = ['gestionar_tarea', 'gestionar_rfi', 'gestionar_oc', 'gestionar_acta',
      'gestionar_calidad', 'generar_documento', 'editar_plano']
      .map(name => ({ name }));
    expect(filtrarToolsPorAuth(escritura, false, false)).toEqual([]);
  });

  it('sin sesión: el código fuente de GitHub no es alcanzable', () => {
    const codigo = ['github_leer', 'github_listar', 'github_buscar', 'grep_codigo']
      .map(name => ({ name }));
    expect(filtrarToolsPorAuth(codigo, false, false)).toEqual([]);
  });

  it('sin sesión: siguen pasando las tools que no tocan datos de nadie', () => {
    // El chat anónimo existe por diseño y debe seguir sirviendo para consultas técnicas.
    const publicas = ['buscar_web', 'buscar_normativa', 'pensar', 'planificar',
      'calcular_cable', 'calcular_bandeja', 'calcular_proteccion'].map(name => ({ name }));
    expect(filtrarToolsPorAuth(publicas, false, false).map(t => t.name)).toEqual(
      publicas.map(t => t.name)
    );
  });

  // ARC-017 / SEC-CRON-01 (02/08/2026): el cron llama al modelo con esDevVerificado=true
  // seis veces al día y sin nadie delante. El flag no se puede bajar porque
  // puedeNotificarUsuario depende de él, así que la barrera es la lista de tools.
  it('el cron NO recibe tools de produccion ni de codigo, aunque venga como dev', () => {
    const peligrosas = ['ejecutar_deploy', 'rollback', 'patch_codigo', 'github_escribir',
      'nexus_manage', 'test_endpoint'].map(name => ({ name }));
    // Como dev verificado las recibiría todas...
    expect(filtrarToolsPorAuth(peligrosas, true, true)).toHaveLength(peligrosas.length);
    // ...pero el filtro del cron las quita.
    expect(filtrarToolsCron(filtrarToolsPorAuth(peligrosas, true, true))).toEqual([]);
  });

  it('el cron NO puede escribir en la BD ni cambiar su propia configuracion', () => {
    const escritura = ['escribir_bd', 'configurar_alerta', 'tomar_decision'].map(name => ({ name }));
    expect(filtrarToolsCron(filtrarToolsPorAuth(escritura, true, true))).toEqual([]);
  });

  it('el cron SI conserva lo que necesita para analizar y avisar', () => {
    const necesarias = ['consultar_bd', 'estado_obra', 'enviar_telegram_informe',
      'enviar_push', 'pensar', 'memory_read'].map(name => ({ name }));
    expect(filtrarToolsCron(filtrarToolsPorAuth(necesarias, true, true)).map(t => t.name))
      .toEqual(necesarias.map(t => t.name));
  });

  it('esInvocacionCron solo reconoce la identidad real del cron', () => {
    expect(esInvocacionCron('system', 'cron')).toBe(true);
    expect(esInvocacionCron('system', 1)).toBe(false);
    expect(esInvocacionCron('3', 'cron')).toBe(false);
    // Un usuario no puede hacerse pasar por el cron: su identidad sale de la sesión.
    expect(esInvocacionCron('anon:system', 'cron')).toBe(false);
  });

  it('con sesión: las tools de datos vuelven a estar disponibles (sin regresión)', () => {
    const datos = ['consultar_personal', 'estado_obra', 'github_leer'].map(name => ({ name }));
    expect(filtrarToolsPorAuth(datos, true, false).map(t => t.name)).toEqual(
      ['consultar_personal', 'estado_obra', 'github_leer']
    );
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

  // F-1.3/ADR-0010 (piloto de migración, consultar_personal): el metadato
  // acceso/cron/nivel_riesgo que añade el catálogo de tools NO debe cambiar
  // el resultado de filtrarToolsPorAuth/filtrarToolsCron, que solo miran
  // t.name — es la garantía de "sin cambiar su comportamiento observable"
  // que exige ADR-0010 para la migración incremental.
  it('el metadato de ADR-0010 (acceso/cron/nivel_riesgo) no cambia el filtrado por auth/cron', () => {
    const sinMetadato = { name: 'consultar_personal' };
    const conMetadato = { name: 'consultar_personal', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N0' };

    for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
      expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
        .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
    }
    expect(filtrarToolsCron([conMetadato])).toEqual([conMetadato]);
    expect(filtrarToolsCron([sinMetadato])).toEqual([sinMetadato]);
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 2 (2026-08-02): 8 tools de solo lectura que
  // ya exigían sesión, sin escritura de datos de negocio. Mismo criterio y
  // misma garantía que el piloto: el metadato de ADR-0010 no cambia el
  // resultado de filtrarToolsPorAuth/filtrarToolsCron.
  it('lote 2 (buscar_documentos, buscar_tareas, consultar_inventario, buscar_precios, buscar_procedimientos, consultar_punch_list, buscar_proveedores, consultar_precios): metadato ADR-0010 no cambia el filtrado', () => {
    const lote2 = [
      'buscar_documentos', 'buscar_tareas', 'consultar_inventario', 'buscar_precios',
      'buscar_procedimientos', 'consultar_punch_list', 'buscar_proveedores', 'consultar_precios',
    ];
    for (const name of lote2) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N0' };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
      }
      expect(filtrarToolsCron([conMetadato])).toEqual([conMetadato]);
    }
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 4 (2026-08-02): las 5 tools "gestionar_*"
  // (CRUD acotado por empresa_id, N1) más editar_plano (N1) y marcar_plano
  // (N0 — pese al nombre, es solo lectura/análisis, sin escritura en D1).
  // Todas exigían sesión (TOOLS_REQUIEREN_SESION) antes de esta migración.
  it('lote 4 (gestionar_tarea/rfi/oc/acta/calidad, editar_plano N1; marcar_plano N0): metadato ADR-0010 no cambia el filtrado', () => {
    const lote4 = [
      ['gestionar_tarea', 'N1'], ['gestionar_rfi', 'N1'], ['gestionar_oc', 'N1'],
      ['gestionar_acta', 'N1'], ['gestionar_calidad', 'N1'], ['editar_plano', 'N1'],
      ['marcar_plano', 'N0'],
    ];
    for (const [name, nivel_riesgo] of lote4) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'sesion', cron: 'permitido', nivel_riesgo };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
      }
      expect(filtrarToolsCron([conMetadato])).toEqual([conMetadato]);
    }
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 5 (2026-08-02): 12 tools de solo lectura
  // más, verificadas leyendo su case en el switch de ejecución (incluidas
  // github_listar/leer/buscar/grep_codigo, que comparten bloque con
  // github_escribir/patch_codigo pero no hacen ningún fetch PUT).
  it('lote 5 (descubrir_herramientas, recuperar_conversacion, leer_estado, consultar_bd, listar_archivos, ver_archivo, consultar_conocimiento, ram_read, github_listar/leer/buscar, grep_codigo): metadato ADR-0010 no cambia el filtrado', () => {
    const lote5 = [
      'descubrir_herramientas', 'recuperar_conversacion', 'leer_estado', 'consultar_bd',
      'listar_archivos', 'ver_archivo', 'consultar_conocimiento', 'ram_read',
      'github_listar', 'github_leer', 'github_buscar', 'grep_codigo',
    ];
    for (const name of lote5) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N0' };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
      }
      expect(filtrarToolsCron([conMetadato])).toEqual([conMetadato]);
    }
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 6 (2026-08-02): tools administrativas y de
  // escritura amplia, revisadas linea a linea antes de clasificar. Aqui
  // acceso/cron/nivel_riesgo varian por tool (a diferencia de los lotes
  // anteriores), asi que se verifica cada una contra su propio Set real.
  it('lote 6 (escribir_bd, validar_cambios_bd, github_escribir, test_endpoint, rollback, verificar_deploy, ejecutar_deploy, patch_codigo, nexus_manage, configurar_alerta): metadato ADR-0010 no cambia el filtrado', () => {
    const lote6 = [
      { name: 'escribir_bd', acceso: 'sesion', cron: 'prohibido', nivel_riesgo: 'N2' },
      { name: 'validar_cambios_bd', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N0' },
      { name: 'github_escribir', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N2' },
      { name: 'test_endpoint', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N2' },
      { name: 'rollback', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N2' },
      { name: 'verificar_deploy', acceso: 'sesion', cron: 'permitido', nivel_riesgo: 'N1' },
      { name: 'ejecutar_deploy', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N3' },
      { name: 'patch_codigo', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N2' },
      { name: 'nexus_manage', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N2' },
      { name: 'configurar_alerta', acceso: 'dev_verificado', cron: 'prohibido', nivel_riesgo: 'N1' },
    ];
    for (const { name, acceso, cron, nivel_riesgo } of lote6) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso, cron, nivel_riesgo };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
        expect(filtrarToolsCron(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado)).map(t => t.name))
          .toEqual(filtrarToolsCron(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado)).map(t => t.name));
      }
    }
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 7 (2026-08-02): notificaciones/generación
  // de contenido. enviar_email/enviar_telegram_informe salen de la
  // organización (N2, el ejemplo textual de ADR-0006); el resto se queda
  // dentro del ecosistema propio de la app (N1).
  it('lote 7 (ram_save/clear, enviar_push, generar_informe, enviar_email N2, enviar_telegram_informe N2, iniciar_conversacion, subir_archivo, controlar_app): metadato ADR-0010 no cambia el filtrado', () => {
    const lote7 = [
      { name: 'ram_save', nivel_riesgo: 'N1' },
      { name: 'ram_clear', nivel_riesgo: 'N1' },
      { name: 'enviar_push', nivel_riesgo: 'N1' },
      { name: 'generar_informe', nivel_riesgo: 'N1' },
      { name: 'enviar_email', nivel_riesgo: 'N2' },
      { name: 'enviar_telegram_informe', nivel_riesgo: 'N2' },
      { name: 'iniciar_conversacion', nivel_riesgo: 'N1' },
      { name: 'subir_archivo', nivel_riesgo: 'N1' },
      { name: 'controlar_app', nivel_riesgo: 'N1' },
    ];
    for (const { name, nivel_riesgo } of lote7) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'sesion', cron: 'permitido', nivel_riesgo };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
      }
      expect(filtrarToolsCron([conMetadato]).map(t => t.name)).toEqual([name]);
    }
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 8 (2026-08-02): último lote del agente.
  // exportar_datos es N2 (exporta sin LIMIT, incluye PII de personal);
  // preguntar_usuario es N1 pese a usar Telegram porque su destino es fijo
  // (no un chat_id arbitrario, a diferencia de enviar_telegram_informe).
  it('lote 8 (analizar_foto_obra, generar_esquema_electrico, listar/borrar_esquema, generar_plano, generar_grafico, preguntar_usuario, generar_documento, historico_materiales, exportar_datos N2): metadato ADR-0010 no cambia el filtrado', () => {
    const lote8 = [
      { name: 'analizar_foto_obra', nivel_riesgo: 'N0' },
      { name: 'generar_esquema_electrico', nivel_riesgo: 'N1' },
      { name: 'listar_esquemas', nivel_riesgo: 'N0' },
      { name: 'borrar_esquema', nivel_riesgo: 'N1' },
      { name: 'generar_plano', nivel_riesgo: 'N1' },
      { name: 'generar_grafico', nivel_riesgo: 'N1' },
      { name: 'preguntar_usuario', nivel_riesgo: 'N1' },
      { name: 'generar_documento', nivel_riesgo: 'N1' },
      { name: 'historico_materiales', nivel_riesgo: 'N1' },
      { name: 'exportar_datos', nivel_riesgo: 'N2' },
      { name: 'estado_obra', nivel_riesgo: 'N0' },
    ];
    for (const { name, nivel_riesgo } of lote8) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'sesion', cron: 'permitido', nivel_riesgo };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
      }
      expect(filtrarToolsCron([conMetadato]).map(t => t.name)).toEqual([name]);
    }
  });

  // F-1.3-MIGRAR-RESTO-TOOLS, lote 3 (2026-08-02): 7 tools públicas
  // (SEC-ANON-01 las dejó deliberadamente sin sesión porque no tocan datos de
  // nadie: búsqueda externa y cálculos de ingeniería deterministas).
  // acceso:'publico' — ausentes de los tres Set, así que el filtrado no
  // depende de authOk/esDevVerificado en absoluto, con o sin metadato.
  it('lote 3 (buscar_web, calcular_cable, calcular_bandeja, calcular_proteccion, pensar, planificar, buscar_normativa): metadato ADR-0010 no cambia el filtrado', () => {
    const lote3 = [
      'buscar_web', 'calcular_cable', 'calcular_bandeja', 'calcular_proteccion',
      'pensar', 'planificar', 'buscar_normativa',
    ];
    for (const name of lote3) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'publico', cron: 'permitido', nivel_riesgo: 'N0' };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
        // Público: siempre pasa, independientemente de authOk/esDevVerificado.
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado)).toEqual([conMetadato]);
      }
      expect(filtrarToolsCron([conMetadato])).toEqual([conMetadato]);
    }
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

// == SEC-10 (paridad SEC-01): gating dev-only de nexus_manage ==============
describe('SEC-10 gating nexus_manage', () => {
  it('nexus_manage esta en TOOLS_SOLO_DEV_VERIFICADO (regresion del hueco SEC-01)', () => {
    expect(TOOLS_SOLO_DEV_VERIFICADO.has('nexus_manage')).toBe(true);
  });

  it('un usuario NO-dev no recibe nexus_manage en la lista de tools ofrecidas', () => {
    const tools = [{ name: 'consultar_bd' }, { name: 'nexus_manage' }];
    const filtradas = filtrarToolsPorAuth(tools, true, false).map(t => t.name);
    expect(filtradas).not.toContain('nexus_manage');
  });

  it('el desarrollador verificado SI recibe nexus_manage', () => {
    const tools = [{ name: 'nexus_manage' }];
    const filtradas = filtrarToolsPorAuth(tools, true, true).map(t => t.name);
    expect(filtradas).toContain('nexus_manage');
  });
});

// == ADR-0014 / ARC-008 (02/08/2026): observabilidad y trazas ===============
describe('redactarTexto', () => {
  it('enmascara un email dentro de una frase', () => {
    expect(redactarTexto('contactar a juan.perez@obra.com para el parte'))
      .toBe('contactar a [email-redactado] para el parte');
  });

  it('enmascara un teléfono español de 9 dígitos sin separadores', () => {
    expect(redactarTexto('llamar al 612345678 antes de las 9')).toBe('llamar al [telefono-redactado] antes de las 9');
  });

  it('enmascara un teléfono con espacios y prefijo +34', () => {
    expect(redactarTexto('tel: +34 612 345 678')).toBe('tel: [telefono-redactado]');
  });

  it('NO toca un número que no sean 9 dígitos (ej. un id corto)', () => {
    expect(redactarTexto('albarán 12345')).toBe('albarán 12345');
  });

  it('deja intacto un texto sin datos sensibles', () => {
    expect(redactarTexto('se ha creado la tarea correctamente')).toBe('se ha creado la tarea correctamente');
  });

  it('valores no-string pasan sin cambios (no revienta con null/number)', () => {
    expect(redactarTexto(null)).toBeNull();
    expect(redactarTexto(42)).toBe(42);
    expect(redactarTexto(undefined)).toBeUndefined();
  });
});

describe('redactarDetalle', () => {
  it('redacta strings anidados dentro de objetos y arrays', () => {
    const out = redactarDetalle({
      mensaje_error: 'no such table',
      contacto: { email: 'a@b.com', notas: ['llamar a 612345678'] },
    });
    expect(out.contacto.email).toBe('[email-redactado]');
    expect(out.contacto.notas[0]).toBe('llamar a [telefono-redactado]');
    expect(out.mensaje_error).toBe('no such table');
  });

  it('no rompe con estructuras muy anidadas (límite de profundidad)', () => {
    let anidado = 'a@b.com';
    for (let i = 0; i < 10; i++) anidado = { nivel: anidado };
    expect(() => redactarDetalle(anidado)).not.toThrow();
  });

  it('deja pasar números/booleanos tal cual', () => {
    const out = redactarDetalle({ confianza: 0.8, ok: true });
    expect(out).toEqual({ confianza: 0.8, ok: true });
  });
});

describe('extraerTablaDDL', () => {
  it('extrae la tabla de un CREATE TABLE IF NOT EXISTS', () => {
    expect(extraerTablaDDL('CREATE TABLE IF NOT EXISTS rfis (id INTEGER)')).toBe('rfis');
  });

  it('extrae la tabla de un ALTER TABLE', () => {
    expect(extraerTablaDDL('ALTER TABLE tareas_obra ADD COLUMN prioridad TEXT')).toBe('tareas_obra');
  });

  it('devuelve null si no reconoce el patrón', () => {
    expect(extraerTablaDDL('SELECT 1')).toBeNull();
    expect(extraerTablaDDL('')).toBeNull();
  });
});

describe('determinarEstadoSalud (ADR-0014 §4, tres estados)', () => {
  it('healthy cuando D1 y R2 responden', () => {
    expect(determinarEstadoSalud(true, true)).toBe('healthy');
  });

  it('degraded cuando solo falla R2', () => {
    expect(determinarEstadoSalud(true, false)).toBe('degraded');
  });

  it('unhealthy cuando falla D1, aunque R2 responda', () => {
    expect(determinarEstadoSalud(false, true)).toBe('unhealthy');
  });

  it('unhealthy cuando fallan las dos', () => {
    expect(determinarEstadoSalud(false, false)).toBe('unhealthy');
  });
});

// ── toolsParaAnthropic (F-1.3/ADR-0010) ─────────────────────────────────────
describe('toolsParaAnthropic', () => {
  it('conserva name/description/input_schema y descarta el metadato de ADR-0010', () => {
    const tool = {
      name: 'consultar_personal',
      description: 'Busca personal',
      input_schema: { type: 'object', properties: {} },
      acceso: 'sesion',
      cron: 'permitido',
      nivel_riesgo: 'N0',
    };
    const [limpia] = toolsParaAnthropic([tool]);
    expect(limpia).toEqual({
      name: 'consultar_personal',
      description: 'Busca personal',
      input_schema: { type: 'object', properties: {} },
      cache_control: { type: 'ephemeral' },
    });
    expect(limpia.acceso).toBeUndefined();
    expect(limpia.cron).toBeUndefined();
    expect(limpia.nivel_riesgo).toBeUndefined();
  });

  it('solo añade cache_control a la última tool de la lista', () => {
    const tools = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
    const limpias = toolsParaAnthropic(tools);
    expect(limpias[0].cache_control).toBeUndefined();
    expect(limpias[1].cache_control).toBeUndefined();
    expect(limpias[2].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('lista vacía o null no rompe', () => {
    expect(toolsParaAnthropic(null)).toEqual([]);
    expect(toolsParaAnthropic([])).toEqual([]);
  });
});

// ── construirConsultaMemoriaGobernada (ARC-008 §8, tool memoria_consultar) ──
// Decisión del Director (2026-08-02): "Añadir pruebas de aislamiento, caducidad,
// confianza y ausencia de resultados cruzados". Esta función pura es la ÚNICA
// fuente del WHERE/binds que ejecuta consultarMemoria() contra D1 real -- probar
// aquí que nunca omite empresa_id/estado/caduca_en es probar el aislamiento real,
// sin necesitar un D1 real.
describe('construirConsultaMemoriaGobernada', () => {
  const AHORA = '2026-08-02T12:00:00.000Z';

  it('aislamiento: siempre filtra por empresa_id, primero y con el valor exacto pasado', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 42, ahora: AHORA });
    expect(sql).toMatch(/WHERE empresa_id = \?/);
    expect(binds[0]).toBe('42');
  });

  it('aislamiento: dos empresas distintas producen binds con empresa_id distinto, mismo SQL', () => {
    const a = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA });
    const b = construirConsultaMemoriaGobernada({ empresaId: 2, ahora: AHORA });
    expect(a.sql).toBe(b.sql);
    expect(a.binds[0]).toBe('1');
    expect(b.binds[0]).toBe('2');
    expect(a.binds[0]).not.toBe(b.binds[0]);
  });

  it('ausencia de resultados cruzados: no existe combinación de parámetros que omita empresa_id del WHERE', () => {
    const combinaciones = [
      {},
      { categorias: ['hechos_operativos'] },
      { ambito: 'compartida' },
      { confianzaMinima: 'alta' },
      { consulta: 'algo' },
      { categorias: ['correcciones'], ambito: 'personal', confianzaMinima: 'baja', consulta: 'x', limit: 5 },
    ];
    for (const extra of combinaciones) {
      const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 7, ahora: AHORA, ...extra });
      expect(sql).toMatch(/empresa_id = \?/);
      expect(binds[0]).toBe('7');
    }
  });

  it('caducidad: siempre exige caduca_en > ahora, con el timestamp exacto pasado', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA });
    expect(sql).toMatch(/caduca_en > \?/);
    expect(binds).toContain(AHORA);
  });

  it('caducidad: nunca se puede pedir memoria caducada ni con otro estado que "confirmada"', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA });
    expect(sql).toMatch(/estado = \?/);
    expect(binds).toContain('confirmada');
    // No hay ningún parámetro que permita pedir 'candidata_pendiente_validacion' o 'sustituido'.
    expect(binds).not.toContain('candidata_pendiente_validacion');
    expect(binds).not.toContain('sustituido');
  });

  it('confianza: "alta" solo acepta alta (nunca media ni baja)', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, confianzaMinima: 'alta' });
    expect(sql).toMatch(/confianza IN \(\?\)/);
    expect(binds).toContain('alta');
    expect(binds).not.toContain('media');
    expect(binds).not.toContain('baja');
  });

  it('confianza: "media" acepta media y alta, no baja', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, confianzaMinima: 'media' });
    expect(binds).toEqual(expect.arrayContaining(['media', 'alta']));
    expect(binds).not.toContain('baja');
  });

  it('confianza: "baja" acepta los tres niveles', () => {
    const { binds } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, confianzaMinima: 'baja' });
    expect(binds).toEqual(expect.arrayContaining(['baja', 'media', 'alta']));
  });

  it('confianza: sin confianzaMinima no añade filtro de confianza', () => {
    const { sql } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA });
    expect(sql).not.toMatch(/confianza IN/);
  });

  it('confianza: un valor desconocido se ignora en vez de romper o filtrar todo', () => {
    const { sql } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, confianzaMinima: 'urgente' });
    expect(sql).not.toMatch(/confianza IN/);
  });

  it('RANGO_CONFIANZA ordena baja < media < alta', () => {
    expect(RANGO_CONFIANZA.baja).toBeLessThan(RANGO_CONFIANZA.media);
    expect(RANGO_CONFIANZA.media).toBeLessThan(RANGO_CONFIANZA.alta);
  });

  it('categoría: filtra por IN con la lista exacta pasada', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({
      empresaId: 1, ahora: AHORA, categorias: ['hechos_operativos', 'correcciones'],
    });
    expect(sql).toMatch(/categoria IN \(\?,\?\)/);
    expect(binds).toEqual(expect.arrayContaining(['hechos_operativos', 'correcciones']));
  });

  it('ámbito: filtra solo cuando se pasa explícitamente', () => {
    const sinAmbito = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA });
    expect(sinAmbito.sql).not.toMatch(/ambito = \?/);
    const conAmbito = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, ambito: 'personal' });
    expect(conAmbito.sql).toMatch(/ambito = \?/);
    expect(conAmbito.binds).toContain('personal');
  });

  it('texto: consulta hace LIKE parametrizado sobre contenido, nunca interpolado', () => {
    const { sql, binds } = construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, consulta: "'; DROP TABLE x; --" });
    expect(sql).toMatch(/contenido LIKE \?/);
    expect(sql).not.toContain('DROP TABLE');
    expect(binds).toContain("%'; DROP TABLE x; --%");
  });

  it('límite: se acota entre 1 y 50 aunque se pida más o menos', () => {
    expect(construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, limit: 1000 }).binds.at(-1)).toBe(50);
    // limit: 0 es falsy en JS -- parseInt(0,10) || 10 cae al default, igual que "sin limit".
    expect(construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, limit: 0 }).binds.at(-1)).toBe(10);
    expect(construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA, limit: -5 }).binds.at(-1)).toBe(1);
    expect(construirConsultaMemoriaGobernada({ empresaId: 1, ahora: AHORA }).binds.at(-1)).toBe(10);
  });
});

// ── construirQueryAprendizajesEmpresa (SEC-CHAT-CONTEXTO-LEGACY / ARC-016) ───
// Aislamiento cross-tenant de los "aprendizajes"/"contexto" que obtenetContextoChat
// inyecta en el mensaje de usuario. La query legada leía alejandra_memoria sin
// filtro de empresa_id; este builder impone `empresa_id = ?` obligatorio.
describe('construirQueryAprendizajesEmpresa (aislamiento cross-tenant de aprendizajes)', () => {
  it('fail-closed: sin empresa_id devuelve WHERE 1=0 (0 filas), nunca un filtro global', () => {
    const { sql, binds } = construirQueryAprendizajesEmpresa({ empresaId: null });
    expect(sql).toMatch(/WHERE 1=0/);
    expect(binds).toEqual([]);
    // Garantía de seguridad: imposible obtener filas sin scoping de empresa.
    expect(sql).not.toMatch(/aprendizaje/);
  });

  it("fail-closed: empresa_id en blanco o 'default' sin tabla no devuelve global", () => {
    for (const bad of ['', undefined]) {
      const { sql, binds } = construirQueryAprendizajesEmpresa({ empresaId: bad });
      expect(sql).toMatch(/WHERE 1=0/);
      expect(binds).toEqual([]);
    }
  });

  it('aislamiento: empresa A y B producen binds distintos, mismo SQL', () => {
    const a = construirQueryAprendizajesEmpresa({ empresaId: 1 });
    const b = construirQueryAprendizajesEmpresa({ empresaId: 2 });
    expect(a.sql).toBe(b.sql);
    expect(a.binds[0]).toBe('1');
    expect(b.binds[0]).toBe('2');
    expect(a.binds[0]).not.toBe(b.binds[0]);
  });

  it('el WHERE siempre lleva empresa_id = ? antes que el filtro de tipo (imposible omitirlo)', () => {
    const { sql } = construirQueryAprendizajesEmpresa({ empresaId: 7 });
    expect(sql).toMatch(/WHERE empresa_id = \?/);
    expect(sql.indexOf('empresa_id = ?')).toBeLessThan(sql.indexOf("tipo = 'aprendizaje'"));
  });

  it('solo lee tipos aprendizaje/contexto (no fcm_token/mejora/decision/documento)', () => {
    const { sql } = construirQueryAprendizajesEmpresa({ empresaId: 7 });
    expect(sql).toMatch(/tipo = 'aprendizaje' OR tipo = 'contexto'/);
  });

  it('clampea limit a [1, 50] igual que construirConsultaMemoriaGobernada', () => {
    expect(construirQueryAprendizajesEmpresa({ empresaId: 1, limit: 1000 }).binds[1]).toBe(50);
    // limit: 0 es falsy en JS -- parseInt(0,10) || 10 cae al default, igual que "sin limit".
    expect(construirQueryAprendizajesEmpresa({ empresaId: 1, limit: 0 }).binds[1]).toBe(10);
    expect(construirQueryAprendizajesEmpresa({ empresaId: 1, limit: -5 }).binds[1]).toBe(1);
    expect(construirQueryAprendizajesEmpresa({ empresaId: 1 }).binds[1]).toBe(10);
    expect(construirQueryAprendizajesEmpresa({ empresaId: 1, limit: 7 }).binds[1]).toBe(7);
  });

  it('el bind de empresa_id es string (coherencia con TEXT) y el limit es numérico', () => {
    const { binds } = construirQueryAprendizajesEmpresa({ empresaId: 5, limit: 3 });
    expect(typeof binds[0]).toBe('string');
    expect(binds[0]).toBe('5');
    expect(typeof binds[1]).toBe('number');
    expect(binds[1]).toBe(3);
  });
});

// ── memoria_listar_pendientes / memoria_confirmar_candidata / memoria_rechazar_candidata ──
// F-2.1 paso 3 (2026-08-04), decisión del Director: exponer la escritura sobre
// memoria_gobernada. Las tres exigen sesión (TOOLS_REQUIEREN_SESION), igual que
// memoria_consultar; confirmar/rechazar además quedan excluidas del cron
// (TOOLS_PROHIBIDAS_CRON) porque aprobar una candidata sin humano delante
// contradice el propósito de la propia validación de ADR-0013 §3. El gate de rol
// encargado+ vive en worker.js (esEncargadoOSuperior), no en lib.js -- estas
// pruebas cubren solo el filtrado por sesión/cron que sí vive aquí.
describe('memoria_listar_pendientes / memoria_confirmar_candidata / memoria_rechazar_candidata', () => {
  it('las tres exigen sesión, con o sin metadato ADR-0010', () => {
    const nombres = ['memoria_listar_pendientes', 'memoria_confirmar_candidata', 'memoria_rechazar_candidata'];
    const niveles = { memoria_listar_pendientes: 'N0', memoria_confirmar_candidata: 'N1', memoria_rechazar_candidata: 'N1' };
    for (const name of nombres) {
      const sinMetadato = { name };
      const conMetadato = { name, acceso: 'sesion', cron: name === 'memoria_listar_pendientes' ? 'permitido' : 'prohibido', nivel_riesgo: niveles[name] };
      for (const [authOk, esDevVerificado] of [[true, true], [true, false], [false, true], [false, false]]) {
        expect(filtrarToolsPorAuth([conMetadato], authOk, esDevVerificado).map(t => t.name))
          .toEqual(filtrarToolsPorAuth([sinMetadato], authOk, esDevVerificado).map(t => t.name));
      }
      expect(filtrarToolsPorAuth([sinMetadato], false, false)).toEqual([]);
      expect(filtrarToolsPorAuth([sinMetadato], true, false)).toEqual([sinMetadato]);
    }
  });

  it('memoria_listar_pendientes SÍ está disponible para el cron; confirmar/rechazar NO', () => {
    expect(filtrarToolsCron([{ name: 'memoria_listar_pendientes' }])).toEqual([{ name: 'memoria_listar_pendientes' }]);
    expect(filtrarToolsCron([{ name: 'memoria_confirmar_candidata' }])).toEqual([]);
    expect(filtrarToolsCron([{ name: 'memoria_rechazar_candidata' }])).toEqual([]);
  });
});

// ── construirCacheKeyNormativa (F-2.3 Nexo v2: cache KV de buscar_normativa) ──
describe('construirCacheKeyNormativa', () => {
  it('prefija con nxcache: y devuelve hash hex de 8 chars', () => {
    const key = construirCacheKeyNormativa({ consulta: 'cable nyu', itc: '', tema: '' });
    expect(key.startsWith('nxcache:')).toBe(true);
    const hash = key.slice('nxcache:'.length);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('es determinista: misma entrada → misma key', () => {
    const a = construirCacheKeyNormativa({ consulta: 'cobranza instalar en obra', itc: '51', tema: 'iluminacion' });
    const b = construirCacheKeyNormativa({ consulta: 'cobranza instalar en obra', itc: '51', tema: 'iluminacion' });
    expect(a).toBe(b);
  });

  it('normaliza mayúsculas/minúsculas y espacios', () => {
    const a = construirCacheKeyNormativa({ consulta: 'Tema X', itc: '51', tema: 'iluminacion' });
    const b = construirCacheKeyNormativa({ consulta: 'tema x', itc: '51', tema: 'iluminacion' });
    expect(a).toBe(b);
  });

  it('diferencia inputs distintos', () => {
    const a = construirCacheKeyNormativa({ consulta: 'consulta A', itc: '', tema: '' });
    const b = construirCacheKeyNormativa({ consulta: 'consulta B', itc: '', tema: '' });
    expect(a).not.toBe(b);
  });

  it('redacta PII (email) antes de hashear — no persiste email en la key', () => {
    const conEmail = construirCacheKeyNormativa({ consulta: 'contacto@x.com tema', itc: '', tema: '' });
    const sinEmail = construirCacheKeyNormativa({ consulta: '[email-redactado] tema', itc: '', tema: '' });
    expect(conEmail).toBe(sinEmail);
    expect(conEmail).not.toMatch(/contacto@x\.com/);
  });

  it('ignora undefined/null/empty fields', () => {
    const a = construirCacheKeyNormativa({ consulta: 'tema x', itc: undefined, tema: null });
    const b = construirCacheKeyNormativa({ consulta: 'tema x', itc: '', tema: '' });
    expect(a).toBe(b);
  });
});

// ── ADR-0014 §2.1: redacción de trazas (PII en detalle/trazas) ─────────────
// Verifica que registrarTraza (que usa redactarTexto/redactarDetalle) no
// persiste emails ni teléfonos en texto plano. La construcción de la traza
// real vive en worker.js; estas pruebas validan las funciones puras que ella
// consume, garantizando defensa en profundidad sobre datos sensibleS.
describe('redactarTexto / redactarDetalle', () => {
  it('redacta emails con [email-redactado], conservando el texto aambiente', () => {
    expect(redactarTexto('contacto@x.com')).toBe('[email-redactado]');
    expect(redactarTexto('email admin@x.es aqui')).toBe('email [email-redactado] aqui');
    expect(redactarTexto('antes user@dominio.com después')).toBe('antes [email-redactado] después');
  });

  it('redacta teléfonos españoles (9 dígitos) con [telefono-redactado], conservando texto aambiente', () => {
    expect(redactarTexto('tel 600 123 456')).toBe('tel [telefono-redactado]');
    expect(redactarTexto('600123456')).toBe('[telefono-redactado]');
    expect(redactarTexto('+34 600 123 456')).toBe('[telefono-redactado]');
    expect(redactarTexto('llamar al 600 123 456 ahora')).toBe('llamar al [telefono-redactado] ahora');
  });

  it('no redacta IDs largos ni importes (>9 dígitos)', () => {
    expect(redactarTexto('obra 1234567890123')).toBe('obra 1234567890123');
    expect(redactarTexto('1500.50€')).toBe('1500.50€');
  });

  it('redacta recursivamente en objetos/arrays anidados (redactarDetalle)', () => {
    const input = { email: 'a@b.com', email2: 'email admin@x.es aqui', tel: '600 123 456', ok: true, anidado: { x: 'c@d.com' }, lista: ['e@f.com', 'sin email'] };
    const out = redactarDetalle(input);
    expect(out.email).toBe('[email-redactado]');
    expect(out.email2).toBe('email [email-redactado] aqui');
    expect(out.tel).toBe('[telefono-redactado]');
    expect(out.ok).toBe(true);
    expect(out.anidado).toEqual({ x: '[email-redactado]' });
    expect(out.lista).toEqual(['[email-redactado]', 'sin email']);
  });
});

// ── F-4.4 Wiring de telemetría de uso de tools ────────────────────────────────
// ejecutarToolConTelemetria envuelve ejecutarTool en los paths de herramienta con
// tráfico usuario, registrando feature_usage (D1 traza + KV counter cross-tenant).
// El path interno 'reflexion' (sistema, sin sesión usuario) debe seguir llamando
// a ejecutarTool directamente — no es telemetría de uso y no debe inflar métricas.
// Estas pruebas son de regresión estática sobre el texto de worker.js (misma
// técnica que 'aislamiento del contexto del chat'): bloquean slips donde quede
// un path usuario sin telemetría, o viceversa, un path sistema telemetrado.
describe('F-4.4 ejecutarToolConTelemetria wiring', () => {
  const worker = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');

  it('define el wrapper que envuelve ejecutarTool', () => {
    expect(worker).toContain('async function ejecutarToolConTelemetria(');
    // el wrapper delega al tool real y dispara la traza:
    expect(worker).toContain('await ejecutarTool(env, nombre, input,');
    expect(worker).toContain('registrarUsoTool(env, {');
  });

  it('envuelve exactamente los 3 paths con tráfico usuario', () => {
    const llamadas = worker.match(/await ejecutarToolConTelemetria\(/g) || [];
    expect(llamadas.length).toBe(3);
  });

  it('mantiene exactamente 2 llamadas directas a ejecutarTool (wrapper interno + reflexion interno)', () => {
    const directas = worker.match(/await ejecutarTool\(/g) || [];
    expect(directas.length).toBe(2);
  });

  it('mantiene el path interno "reflexion" fuera de la telemetría', () => {
    expect(worker).toContain("await ejecutarTool(env, tb.name, tb.input, 'reflexion', 'system'");
  });

  it('clasifica ok/error con el regex de detección de éxito JSON', () => {
    expect(worker).toContain('/"ok"\\s*:\\s*true/');
  });
});

// ── Nexo v1 (ADR-0021) — registro de fuentes externas ─────────────────────────
import {
  FUENTES_NEXO,
  obtenerFuente,
  obtenerFuentePorConector,
  listarFuentes,
} from './nexo-fuentes.js';

describe('Nexo v1 — registro de fuentes (ADR-0021)', () => {
  it('declara las 3 fuentes del piloto', () => {
    const fuentes = listarFuentes();
    expect(fuentes.length).toBe(3);
    const ids = fuentes.map(f => f.id).sort();
    expect(ids).toEqual(['normativa_rebt', 'precios_distribuidores', 'web_general']);
  });

  it('cada fuente tiene los campos obligatorios', () => {
    for (const f of listarFuentes()) {
      expect(f.id).toBeTruthy();
      expect(f.nombre).toBeTruthy();
      expect(f.tipo).toBeTruthy();
      expect(['alta', 'media', 'variable']).toContain(f.fiabilidad);
      expect(f.ttl_horas).toBeGreaterThan(0);
      expect(f.ambito).toBeTruthy();
      expect(f.conector).toBeTruthy();
    }
  });

  it('normativa_rebt declara fallback a buscar_web', () => {
    const f = obtenerFuente('normativa_rebt');
    expect(f).toBeTruthy();
    expect(f.fallback).toBe('buscar_web');
    expect(f.conector).toBe('buscar_normativa');
  });

  it('obtenerFuentePorConector resuelve por nombre de tool', () => {
    expect(obtenerFuentePorConector('buscar_normativa')?.id).toBe('normativa_rebt');
    expect(obtenerFuentePorConector('buscar_precios')?.id).toBe('precios_distribuidores');
    expect(obtenerFuentePorConector('buscar_google')?.id).toBe('web_general');
  });

  it('obtenerFuente devuelve null para fuente inexistente', () => {
    expect(obtenerFuente('no_existe')).toBeNull();
  });
});

// ── Nexo v1 — metadata `nexo` en tools ───────────────────────────────────────
describe('Nexo v1 — metadata nexo en tools (ADR-0021)', () => {
  it('buscar_normativa declara nexo.fuenteId y fallback', () => {
    const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    expect(src).toMatch(/name:\s*'buscar_normativa'[\s\S]*?nexo:\s*\{\s*fuenteId:\s*'normativa_rebt'/);
    expect(src).toMatch(/name:\s*'buscar_normativa'[\s\S]*?fallback:\s*'buscar_web'/);
  });

  it('buscar_precios declara nexo.fuenteId', () => {
    const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    expect(src).toMatch(/name:\s*'buscar_precios'[\s\S]*?nexo:\s*\{\s*fuenteId:\s*'precios_distribuidores'/);
  });
});

// ── ADR-0020 rebanada 3 — piloto N1 de lectura ──────────────────────────────
describe('ADR-0020 rebanada 3 — piloto N1 de lectura (ARC-020, enmienda 2)', () => {
  it('TOOLS_N1_LECTURA_PILOTO contiene únicamente verificar_deploy (alcance estrecho, deliberado)', () => {
    expect([...TOOLS_N1_LECTURA_PILOTO]).toEqual(['verificar_deploy']);
  });

  it('verificar_deploy está declarada nivel_riesgo N1 en el catálogo real', () => {
    const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    expect(src).toMatch(/name:\s*'verificar_deploy'[\s\S]{0,600}?nivel_riesgo:\s*'N1'/);
  });

  it('el case "verificar_deploy" no ejecuta SQL mutante ni escribe en R2 (confirma que es de solo lectura de negocio)', () => {
    const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    const inicio = src.indexOf("case 'verificar_deploy':");
    const fin = src.indexOf("\n    case 'nexus_manage':", inicio + 1);
    const cuerpo = src.slice(inicio, fin);
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fin).toBeGreaterThan(inicio);
    // Puede leer D1 (SELECT, ej. token FCM para avisar del resultado) pero no
    // debe mutar datos de negocio ni escribir en R2.
    expect(cuerpo).not.toMatch(/env\.DB\.prepare\(\s*[`'"]?\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i);
    expect(cuerpo).not.toMatch(/env\.R2\.(put|delete)/);
  });

  it('worker.js gobierna el piloto N1 de lectura vía evaluarInvocacionCognitiva (regresión de wiring)', () => {
    const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    expect(src).toMatch(/async function evaluarInvocacionCognitiva\(/);
    expect(src).toMatch(/decidirInvocacionN1Lectura/);
    expect(src).toMatch(/esInvocacionN1DeLectura\(toolName, input\)/);
    // Los 3 call sites (chat normal, streaming, recuperación de tool-use) deben
    // seguir invocando la función renombrada, no la N0 original, y pasar tb.input.
    const llamadas = src.match(/await evaluarInvocacionCognitiva\(env, tb\.name, tb\.input, tools/g) || [];
    expect(llamadas.length).toBe(3);
    expect(src).not.toMatch(/evaluarInvocacionCognitivaN0/);
  });
});

// ── ADR-0020 rebanada 5 — clasificación N1 por invocación ───────────────────
describe('ADR-0020 rebanada 5 — clasificación N1 por invocación (ARC-020, enmienda 4)', () => {
  it('verificar_deploy es de lectura sin importar el input (tool entera)', () => {
    expect(esInvocacionN1DeLectura('verificar_deploy', {})).toBe(true);
    expect(esInvocacionN1DeLectura('verificar_deploy', { worker: 'app' })).toBe(true);
  });

  it('las acciones "listar"/"resumen"/"consultar"/"comparar" de las tools CRUD compuestas son de lectura', () => {
    expect(esInvocacionN1DeLectura('gestionar_tarea', { accion: 'listar' })).toBe(true);
    expect(esInvocacionN1DeLectura('gestionar_rfi', { accion: 'listar' })).toBe(true);
    expect(esInvocacionN1DeLectura('gestionar_oc', { accion: 'listar' })).toBe(true);
    expect(esInvocacionN1DeLectura('gestionar_oc', { accion: 'resumen' })).toBe(true);
    expect(esInvocacionN1DeLectura('gestionar_acta', { accion: 'listar' })).toBe(true);
    expect(esInvocacionN1DeLectura('gestionar_calidad', { accion: 'listar' })).toBe(true);
    expect(esInvocacionN1DeLectura('gestionar_calidad', { accion: 'resumen' })).toBe(true);
    expect(esInvocacionN1DeLectura('historico_materiales', { accion: 'consultar' })).toBe(true);
    expect(esInvocacionN1DeLectura('historico_materiales', { accion: 'comparar' })).toBe(true);
  });

  it('las acciones de escritura de esas mismas tools NO son de lectura', () => {
    expect(esInvocacionN1DeLectura('gestionar_tarea', { accion: 'crear' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_tarea', { accion: 'actualizar' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_tarea', { accion: 'completar' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_tarea', { accion: 'eliminar' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_rfi', { accion: 'responder' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_oc', { accion: 'aprobar' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_oc', { accion: 'rechazar' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_acta', { accion: 'crear_tareas_desde_acuerdos' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_calidad', { accion: 'resolver' })).toBe(false);
    expect(esInvocacionN1DeLectura('historico_materiales', { accion: 'registrar' })).toBe(false);
  });

  it('fail-closed: accion ausente, desconocida o tool no clasificada nunca es lectura', () => {
    expect(esInvocacionN1DeLectura('gestionar_tarea', {})).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_tarea', { accion: 'inventada' })).toBe(false);
    expect(esInvocacionN1DeLectura('gestionar_tarea', null)).toBe(false);
    expect(esInvocacionN1DeLectura('enviar_push', { accion: 'listar' })).toBe(false);
  });

  it('las 6 acciones de lectura auditadas contra worker.js no ejecutan SQL mutante ni escriben en R2', () => {
    const src = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    const casosLectura = [
      { tool: 'gestionar_tarea', inicio: "case 'gestionar_tarea':", fin: "case 'gestionar_rfi':" },
      { tool: 'gestionar_rfi', inicio: "case 'gestionar_rfi':", fin: "case 'gestionar_oc':" },
      { tool: 'gestionar_oc', inicio: "case 'gestionar_oc':", fin: "case 'gestionar_acta':" },
      { tool: 'gestionar_acta', inicio: "case 'gestionar_acta':", fin: "case 'gestionar_calidad':" },
      { tool: 'gestionar_calidad', inicio: "case 'gestionar_calidad':", fin: "case 'analizar_archivo':" },
      { tool: 'historico_materiales', inicio: "case 'historico_materiales':", fin: "case 'configurar_alerta':" },
    ];
    for (const { tool, inicio: marcaInicio, fin: marcaFin } of casosLectura) {
      const inicio = src.indexOf(marcaInicio);
      const fin = src.indexOf(marcaFin, inicio + 1);
      expect(inicio, `case '${tool}' no encontrado`).toBeGreaterThanOrEqual(0);
      expect(fin, `case siguiente a '${tool}' no encontrado`).toBeGreaterThan(inicio);
      const cuerpo = src.slice(inicio, fin);
      const accionesLectura = [...ACCIONES_N1_LECTURA_POR_TOOL_TEST[tool]];
      for (const accion of accionesLectura) {
        // Dos patrones en el código real: `if (accion === 'x')` (la mayoría)
        // y `case 'x': {` dentro de un switch(accion) (historico_materiales).
        const marcaIf = `accion === '${accion}'`;
        const marcaCase = `case '${accion}': {`;
        const iIf = cuerpo.indexOf(marcaIf);
        const iCase = cuerpo.indexOf(marcaCase);
        const iAccion = iIf >= 0 ? iIf : iCase;
        const longitudMarca = iIf >= 0 ? marcaIf.length : marcaCase.length;
        expect(iAccion, `bloque de "${accion}" no encontrado en ${tool}`).toBeGreaterThanOrEqual(0);
        // Bloque hasta el siguiente disparador de acción (if o case) o fin del case.
        const siguienteIf = cuerpo.indexOf('if (accion ===', iAccion + longitudMarca);
        const siguienteCase = cuerpo.indexOf("\n          case '", iAccion + longitudMarca);
        const candidatos = [siguienteIf, siguienteCase].filter((i) => i > iAccion);
        const siguiente = candidatos.length ? Math.min(...candidatos) : -1;
        const bloque = cuerpo.slice(iAccion, siguiente > iAccion ? siguiente : cuerpo.length);
        expect(bloque, `${tool}/${accion} ejecuta SQL mutante`).not.toMatch(/env\.DB\.prepare\(\s*[`'"]?\s*(INSERT|UPDATE|DELETE)/i);
        expect(bloque, `${tool}/${accion} escribe en R2`).not.toMatch(/env\.R2\.(put|delete)/);
      }
    }
  });
});

// Copia literal de ACCIONES_N1_LECTURA_POR_TOOL (no exportado desde lib.js a
// propósito, es detalle interno) — si se desincroniza con la real, el test
// de arriba deja de auditar lo que de verdad gobierna el Motor.
const ACCIONES_N1_LECTURA_POR_TOOL_TEST = {
  gestionar_tarea: ['listar'],
  gestionar_rfi: ['listar'],
  gestionar_oc: ['listar', 'resumen'],
  gestionar_acta: ['listar'],
  gestionar_calidad: ['listar', 'resumen'],
  historico_materiales: ['consultar', 'comparar'],
};
