# TASKS — Cola operativa inmediata

Estado: **tareas activas**: F-0.2-CFG (pospuesta, ver decisión del Director) y ARC-011-FASE3-CHECKLISTS (paso 2 pospuesto, ver decisión del Director). **F-1.3-TOOL-PILOTO-MIGRADA completada (2026-08-02)**: `consultar_personal` migrada al formato de ADR-0010 sin cambiar comportamiento observable (114/114 pruebas del agente en verde) y pasa a la tabla de completadas, junto con F-1.3-TOOL-REGISTRY-ESQUELETO, F-1.2-NUCLEO-ESQUELETO, P-ARCH-002, ARC-008-TRAZAS-MIGRACION y ARC-013. Siguiente tarea abierta: **F-1.3-MIGRAR-RESTO-TOOLS** (migración incremental del resto del catálogo). No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

## Decisiones del Director — 2026-08-02 (ronda de desbloqueo del roadmap)

- **P-ARCH-002 — aprobada.** El componente de notificaciones temporales queda cerrado; desbloquea la siguiente rebanada de presentación.
- **ARC-014 — riesgo aceptado temporalmente.** Mientras el proyecto tenga un único mantenedor en fase de desarrollo, no se exige revisor distinto del solicitante. Se reabre en cuanto exista producción real o más de un mantenedor. Detalle en `ARCHITECT_BACKLOG.md`.
- **ARC-011-FASE3-CHECKLISTS (paso 2, aplicar contra D1) — pospuesta.** No se autoriza todavía; se retoma cuando exista una ventana específica para cambios de esquema con verificación de D1 antes y después, tras completar la validación de la interfaz y del núcleo cognitivo.
- **F-0.2-CFG — pospuesta.** Los secretos se mueven al entorno `production` cuando el proyecto entre en preproducción/producción estable. Mientras tanto se mantiene la configuración a nivel de repositorio; ningún agente debe conocer ni manipular los valores reales.

## Reglas

- Crear una tarea solo cuando esté aprobada para ejecución o revisión inmediata.
- Una tarea activa tiene una única rama y responsable actual.
- Actualizar al iniciar, bloquear, relevar, revisar y completar.

## Plantilla

```text
ID:
Título:
Fase:
Estado: pendiente | lista | en curso | bloqueada | en revisión | aprobada | completada | cancelada
Prioridad:
Rama:
Responsable actual:
Objetivo:
Criterios de aceptación:
Dependencias:
Bloqueos:
Archivos principales:
Pruebas:
Última actualización:
Siguiente acción exacta:
```

## TAREAS ACTIVAS

### F-1.3-MIGRAR-RESTO-TOOLS — Migración incremental del resto del catálogo de tools

- ID: F-1.3-MIGRAR-RESTO-TOOLS
- Título: Continuar la migración de ADR-0010 tras el piloto (`consultar_personal`)
- Fase: Época 1 — Núcleo Cognitivo (F-1.3)
- Estado: en curso
- Prioridad: Alta
- Rama: `feat/f-1.3-migrar-tools-<lote>` (una rama por lote, no una sola rama para las ~102 tools restantes)
- Responsable actual: Agente de Ingeniería
- Objetivo: añadir `acceso`/`cron`/`nivel_riesgo` (ADR-0010) a las tools restantes de `alejandra-agente/worker.js` (68) y `worker.js` raíz (34), tool por tool o en lotes pequeños y temáticos, sin cambiar comportamiento observable, hasta que los tres `Set` de `lib.js` puedan retirarse.
- Criterios de aceptación (por lote):
  1. Cada tool del lote recibe sus tres campos, consistentes con el `Set` en el que ya está hoy (p. ej. si está en `TOOLS_SOLO_DEV_VERIFICADO` → `acceso: 'dev_verificado'`; si está en `TOOLS_PROHIBIDAS_CRON` → `cron: 'prohibido'`).
  2. `nivel_riesgo` se declara según la matriz de ADR-0006 (N0 lectura, N1 escritura reversible propia, N2 escritura amplia/sale de la organización, N3 estructural — hoy solo aplica a capacidades administrativas de `worker.js` raíz, no del agente).
  3. Prueba negativa por lote (mismo patrón que la del piloto) que compara `filtrarToolsPorAuth`/`filtrarToolsCron` antes/después.
  4. Los `Set` de `lib.js` NO se retiran hasta que la última tool esté migrada.
  5. `worker.js` (raíz) tiene su propio mecanismo de gating independiente (regla de "dos cerebros"): su migración es un lote aparte, no se mezcla con la del agente.
- Dependencias: F-1.3-TOOL-PILOTO-MIGRADA completada (2026-08-02, `consultar_personal`).
- Bloqueos: ninguno. No toca D1, secretos ni infraestructura.
- Archivos principales: `alejandra-agente/worker.js`, `alejandra-agente/lib.js`, `alejandra-agente/lib.test.js`, y eventualmente `worker.js` raíz.
- Pruebas: `npm --prefix alejandra-agente test`; `node --check` sobre los ficheros tocados.
- Última actualización: 2026-08-02
- Progreso: **lote 2 completado (2026-08-02)** — 8 tools de solo lectura migradas (`buscar_documentos`, `buscar_tareas`, `consultar_inventario`, `buscar_precios`, `buscar_procedimientos`, `consultar_punch_list`, `buscar_proveedores`, `consultar_precios`), todas `acceso:'sesion'`, `cron:'permitido'`, `nivel_riesgo:'N0'`. **Lote 3 completado (2026-08-02)** — 7 tools públicas migradas (`buscar_web`, `calcular_cable`, `calcular_bandeja`, `calcular_proteccion`, `pensar`, `planificar`, `buscar_normativa`), todas `acceso:'publico'`, `cron:'permitido'`, `nivel_riesgo:'N0'`. **Lote 4 completado (2026-08-02)** — revisión individual del código de ejecución (no por nombre) de `gestionar_tarea`, `gestionar_rfi`, `gestionar_oc`, `gestionar_acta`, `gestionar_calidad` (CRUD acotado por `empresa_id`, N1) y `editar_plano` (N1); `marcar_plano` resultó ser **N0** pese al nombre — es solo lectura/análisis con Gemini, sin escritura en D1. Bug real encontrado y corregido de paso: `gestionar_calidad` (acción `resolver`) interpolaba `notas_resolucion` directo en el SQL en vez de usar `?`; corregido a parámetro, sin cambio de comportamiento. 23 tools migradas de 103 (piloto + lotes 2+3+4); quedan 46 en el agente y 34 en `worker.js` raíz.
- Progreso: **Lote 5 completado (2026-08-02)** — 12 tools de solo lectura más (`descubrir_herramientas`, `recuperar_conversacion`, `leer_estado`, `consultar_bd`, `listar_archivos`, `ver_archivo`, `consultar_conocimiento`, `ram_read`, `github_listar`, `github_leer`, `github_buscar`, `grep_codigo`), todas `N0` tras verificar que sus `case` no hacen ningún `INSERT`/`UPDATE`/`DELETE`/`fetch PUT` (las 4 de GitHub comparten bloque con `github_escribir`/`patch_codigo`, que sí escriben — verificado que ellas no). 35/103 tools migradas; quedan 34 en el agente y 34 en `worker.js` raíz.
- Deliberadamente sin clasificar todavía: `memory_save`, `memory_read`, `propose_mejora`, `tomar_decision` — escriben/leen `alejandra_memoria`, que es el dominio que gobierna ADR-0013 (memoria), no ADR-0010 (catálogo de tools). Clasificarlas aquí sin coordinar con esa tarea sería invadir su alcance; se dejan para cuando `memory.js` de `nucleo-cognitivo/` tenga persistencia real.
- **Lote 6 completado (2026-08-02)** — las 10 tools administrativas/`dev_verificado` más sensibles hasta ahora, cada una revisada línea a línea:
  - `ejecutar_deploy`: **N3** — literalmente el "despliegue" que ADR-0006 pone de ejemplo (PUT directo a la API de Cloudflare Workers).
  - `github_escribir`, `patch_codigo`, `rollback`, `test_endpoint`, `nexus_manage`: **N2** — cambian código fuente real, historia de git (`rollback` fuerza el ref de `main`), configuración de enrutamiento en vivo, o pueden invocar cualquier endpoint propio con cualquier método/body (`test_endpoint`); difíciles de deshacer sin otra acción humana.
  - `escribir_bd`: **N2** — coincide textualmente con la definición de N2 de ADR-0006: ya exige "CONFIRMO BORRADO `<código>`" del humano para DELETE/UPDATE masivo, en el propio código.
  - `verificar_deploy`, `configurar_alerta`: **N1** — solo lectura + una notificación propia (`verificar_deploy`), o CRUD de una fila ya con SQL validado como SELECT-only (`configurar_alerta`).
  - `validar_cambios_bd`: **N0** — solo ejecuta `SELECT`, verificado en el propio código.
  - `acceso`/`cron` de cada una copian exactamente su membresía real en `TOOLS_SOLO_DEV_VERIFICADO`/`TOOLS_REQUIEREN_SESION`/`TOOLS_PROHIBIDAS_CRON` (`lib.js`), sin inventar nada.
  - 45/103 tools migradas (piloto + lotes 2 a 6); quedan 24 en el agente y 34 en `worker.js` raíz.
- Siguiente acción exacta: revisar las 24 tools restantes del agente una por una (candidatas: `enviar_push`, `generar_informe`, `enviar_email`, `enviar_telegram_informe`, `iniciar_conversacion`, `subir_archivo`, `analizar_foto`, `generar_esquema`, `listar_esquemas`, `borrar_esquema`, `generar_grafico`, `preguntar_usuario`, `generar_plano`, `generar_documento`, `historico_materiales`, `exportar_datos`, `controlar_app`, `ram_save`, `ram_clear`) — `enviar_email`/`enviar_telegram_informe` probablemente N2 (sale de la organización, ADR-0006); no asumir N1 por defecto. Después: el catálogo de `worker.js` raíz (34 tools, gating independiente).

### ARC-011-FASE3-CHECKLISTS — Declarar la migración del vertical `checklists`

- ID: ARC-011-FASE3-CHECKLISTS
- Título: Primer vertical de la migración por fases de ARC-011 (ADR-0011)
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **en revisión — paso 1 (declarar) completo; falta autorización del Director para el paso 2 (aplicar)**
- Prioridad: Media
- Rama: `docs/arc-011-fase3-checklists`
- Responsable actual: Director del Proyecto (autorización para aplicar contra D1)
- Objetivo: declarar en una migración `.sql` versionada el esquema real —ya verificado en ARC-015— de las tablas del vertical `checklists` (`checklist_plantillas`, `checklists_plantillas`, `checklist_registros`, `checklist_ejecuciones`), siguiendo el ciclo de ADR-0011.
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con el esquema exacto verificado (`migrate_checklists.sql`, con la fuente `worker.js:línea` de cada `CREATE`), no el que el código debería crear.
  2. ✅ No se ejecuta contra D1 en esta tarea: eso es una migración y requiere autorización explícita del Director (ADR-0007).
  3. ✅ El DDL en runtime de este vertical se deja intacto (`worker.js:14196-14221` y `18122-18152`) hasta que la migración esté aplicada y verificada — ADR-0011 prohíbe retirarlo antes.
  4. ✅ Registrada en `migrate_manifiesto.json` (creado, formato de ADR-0011) como `aplicada: false`.
- Dependencias: ADR-0011 aceptado como estrategia (2026-08-02); ARC-013 y ARC-015 ya corregidos.
- Bloqueos: aplicar la migración contra D1 exige decisión del Director.
- Archivos principales: `migrate_checklists.sql` (nuevo), `migrate_manifiesto.json` (nuevo).
- Pruebas: verificación manual de que los 4 `CREATE TABLE IF NOT EXISTS` coinciden columna por columna con los `CREATE` de `worker.js` (14196, 14207, 18122, 18134); `node -e "JSON.parse(...)"` sobre el manifiesto.
- Última actualización: 2026-08-02
- Siguiente acción exacta: **pospuesta por decisión del Director (2026-08-02).** No se inicia el workflow de aplicación hasta que exista una ventana específica para cambios de esquema, con verificación de D1 antes y después, tras completar la validación de la interfaz y del núcleo cognitivo.

### F-0.2-CFG — Completar la configuración remota de entrega segura

- ID: F-0.2-CFG
- Título: Cerrar los controles remotos que F-0.1-R no pudo completar
- Fase: Época 0 — Fundación y entrega segura
- Estado: lista
- Prioridad: Alta
- Rama: `PENDIENTE` — es configuración remota; solo requiere rama si cambia documentación
- Responsable actual: Director del Proyecto (requiere manejar valores de secretos)
- Objetivo: que los secretos de producción queden acotados al entorno `production` y que el circuito manual de despliegue quede probado en vacío.
- Criterios de aceptación:
  1. Los secretos de Cloudflare y de aplicación recreados en el entorno `production` y retirados del nivel de repositorio **solo después** de verificarlos allí.
  2. Ensayo con confirmación errónea sobre un workflow de producción: el job debe salir `skipped`, sin ejecutar.
  3. ✅ **Decidido y aplicado el 2026-08-02: baja a 0.** El Director lo autorizó de forma expresa. Motivo: al ser un repositorio de un solo mantenedor, GitHub no permite auto-aprobar, así que cada merge exigía el bypass de administrador — fricción sin protección real. La protección efectiva sigue siendo el check `Syntax and agent tests` y la aprobación del entorno `production`, ambos intactos. Verificado tras el cambio: PR obligatoria, rama al día, sin force-push ni borrado, todo sin tocar.
  4. Decidir si la política de rama de `github-pages` sigue limitada a `main` o se amplía para publicar por tag.
  5. Nada desplegado ni migrado durante la validación.
- Dependencias: F-0.1-R completada; acceso a los valores reales de los secretos.
- Bloqueos: los valores de los secretos no son legibles desde la API; solo el Director puede reintroducirlos.
- Archivos principales: ninguno; es configuración remota.
- Pruebas: verificación en Actions de que el ensayo sale `skipped` y de que no se genera ningún despliegue.
- Última actualización: 2026-08-02
- Siguiente acción exacta: **pospuesta por decisión del Director (2026-08-02).** Se retoma cuando el proyecto entre en fase estable de preproducción/producción; mientras tanto se mantiene la configuración a nivel de repositorio y ningún agente maneja los valores reales.

## Completadas — pendientes de aprobación

| ID | Título | Estado | Evidencia |
|---|---|---|---|
| F-0.1 | Separación de CI, despliegues, secretos y migraciones D1 | Implementada e integrada | `a59a2c5`, `6d5d98c`, `96417a5`, `cce5224`. Validada: 6/6 YAML, `node --check` ×2, 85/85 tests, 5/5 criterios de entrega segura. |
| F-0.1-R | Activación y validación en GitHub remoto | Completada | PR #9 integrada. Workflows antiguos desactivados antes de integrar; CI verde en `push` y `pull_request`; ningún despliegue disparado; entorno `production` creado con revisor requerido; `main` protegida con PR obligatoria y check requerido. |
| GOV-001 | Consolidación del proceso operativo de ingeniería | Completada; en revisión | `f644a6b`, `80cc1ff`. `ENGINEERING_WORKFLOW.md` como proceso único; `AGENTS.md` conserva solo reglas del repositorio y remite a él. |
| ARC-011 (fases 1-2) | Inventario del esquema D1 y contraste con producción | Completada | PR #10. 173 DDL en código; 105/150 tablas solo existen porque el código las crea; 27 tablas reales sin declarar; 3 `ALTER` fallidos en silencio. Informe en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`. Fase 3: ver ADR-0011 (aceptado como estrategia) y tarea `ARC-011-FASE3-CHECKLISTS`. |
| ARC-012 | Tres columnas ausentes en producción | Completada | PR #11. Runs 30722027660, 30722072138 y 30722103191, verificados contra el esquema real. Cierra SEG-01 de verdad y restaura la retención RGPD. |
| ARC-013 | Retirar la supresión de errores del DDL en runtime | Completada y **desplegada** | `eb772ee` + posteriores. `runDDL()`/`ddlPaso()` en producción en los dos workers (`alejandra-app-api` `a5ccf770`, `alejandra-agente` `a67353ec`). Ningún DDL falla ya en silencio. |
| ARC-015 | Esquema descrito a Alejandra distinto del real | Cerrado | `5c8b2b9` + auditoría remota de Cloudflare. Esquema verificado contra D1 real: 57/60 correcto. |
| F-0.2 | Catálogo de rutas, checks de CI y contratos base | **Completada (2026-08-02)** | `2cc6f5b`, `16dd55d`, `7dcf084`, `42eb2c2`. 544 rutas inventariadas; inventario de bindings/secretos limpio; cuatro validaciones en CI; auditoría remota de Cloudflare cierra la fase. Hallazgo ARC-018 registrado, no bloqueante. |
| ADR-0004 | Motor de Decisión y modos cognitivos v1.0 | **Aceptado (2026-08-02)** | Arquitectura objetivo aceptada. Cierra F-1.1. Autoriza esqueleto/contratos, no activación (memoria/trazas siguen pendientes de ARC-002/ARC-008). |
| ADR-0006 | Matriz de riesgo y aprobación humana (ARC-001) | **Aceptado (2026-08-02)** | `run_migration` pasa a capacidad administrativa fuera del alcance autónomo. Desbloquea ADR-0004. |
| ADR-0008 | Definición de Nexo (ARC-003) | **Aceptado (2026-08-02)** | Nexo = capa de integración con sistemas externos (interpretación A). |
| ADR-0009 | Alcance de QA y verificación (ARC-004) | **Aceptado (2026-08-02)** | Tres niveles de verificación; explicabilidad como deuda hasta F-4.1. |
| ADR-0010 | Catálogo de tools y matriz de permisos (ARC-006) | **Aceptado (2026-08-02)** | `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool. |
| ADR-0011 | Migrador único y retirada del DDL en runtime (ARC-011 fase 3) | **Aceptado como estrategia (2026-08-02)** | Migración por vertical, empezando por `checklists`, al ritmo del roadmap. |
| ADR-0013 | Gobierno de memoria (ARC-002) | **Aceptado con modificaciones (2026-08-02)** | Memoria opt-in, candidatas pendientes de validación para inferencias, caducidad 6/12 meses, aprobación por rol para memoria compartida, supresión real sin versión archivada. |
| ADR-0014 | Observabilidad y trazas (ARC-008) | **Aceptado con modificaciones (2026-08-02)** | Tabla `alejandra_trazas` en D1, retención 30/90 días, minimización obligatoria, endpoint único en `alejandra-app-api`, `/health` de tres estados. |
| F-1.2 (interfaces memoria/trazas) | `memory.js` y contrato `registrarTraza()` en `nucleo-cognitivo/` | Completada | PR #20. Interfaces sin persistencia real, mismo patrón que `context-engine.js`/`planner.js`; 20 pruebas en verde. |
| ARC-008-TRAZAS-MIGRACION | Migración D1 de la tabla `alejandra_trazas` | Completada y verificada | PR #21 (declaración) + run 30746110357 (aplicación). Export previo de `alejandra-db` (8,1 MB) antes de aplicar; verificada contra el esquema real tras aplicar. Autorización del Director acotada a la única D1 existente; no se extiende a una futura producción separada. |
| ADR-0014 (implementación) | `registrarTraza()` real + `/health` de tres estados + `GET /admin/trazas`, en los dos Workers | Completada, desplegada y verificada | PR #24 (`alejandra-app-api`, run 30746614977) + PR #25 (`alejandra-agente`, run 30746733097). ARC-013 conectado a `alejandra_trazas`; `/health` verificado en vivo `healthy` en los dos; 110/110 tests del agente en verde. |
| fix/version-fallback-adr0014 | `index.html`: desactivar fallback de versión roto por el cambio de `/health` | Completada | PR #26. `hj.version` pasó a ser un UUID de despliegue; el fallback comparaba contra `APP_VERSION` y habría forzado recargas falsas (patrón de los incidentes de recarga infinita). Corregido en `main`; publicar a Pages sigue siendo un paso de entrega aparte. |
| P-ARCH-002 | Componente compartido de notificaciones temporales | **Aprobada por el Director (2026-08-02)** | `packages/design-system/src/components/toast.js`. API heredada `mostrarToast()` compatible, 12 invocaciones sin cambios, sin backend ni permisos afectados. Evidencia en `docs/architecture/FRONTEND_SLICE_TOAST.md`. Desbloquea la siguiente rebanada de presentación. |
| F-1.2-NUCLEO-ESQUELETO | Esqueleto, contratos e interfaces del núcleo cognitivo | Completada — verificada (2026-08-02) | `nucleo-cognitivo/`: Estado Cognitivo y Policy Engine implementados; Context Engine, Planner y Motor de Decisión como interfaces con error explícito; `memory.js` (ADR-0013 §8) y contrato `registrarTraza()` (ADR-0014 §5) añadidos en PR #20. Los 6 criterios de aceptación verificados contra el código: `node --check nucleo-cognitivo/src/*.js` y `node --test nucleo-cognitivo/test/*.js` (20/20 en verde). Cierra F-1.2 y desbloquea F-1.3. |
| F-1.3-TOOL-REGISTRY-ESQUELETO | Esqueleto y contratos del Tool Registry y Verifier | Completada (2026-08-02) | `nucleo-cognitivo/src/tool-registry.js` (validación pura ADR-0010: `acceso`/`cron`/`nivel_riesgo`, `registrarTool`, `filtrarToolsPorAcceso`, `filtrarToolsParaCron`) y `verifier.js` (nivel determinista real; revisión humana asíncrona y explicabilidad como interfaces con error explícito, ADR-0009; `nivelesRequeridosPara()`). 13 pruebas nuevas, 33/33 en verde. No migra ningún catálogo real de tools — eso es `F-1.3-TOOL-PILOTO-MIGRADA`. |
| F-1.3-TOOL-PILOTO-MIGRADA | Migrar `consultar_personal` como piloto de ADR-0010 | Completada (2026-08-02) | `TOOL_CONSULTAR_PERSONAL` (`alejandra-agente/worker.js`) declara `acceso:'sesion'`, `cron:'permitido'`, `nivel_riesgo:'N0'`. Hallazgo real corregido de paso: esos objetos se enviaban tal cual en `body.tools` de la API de Anthropic (`llamarAnthropic`); se extrajo `toolsParaAnthropic()` a `lib.js` para que solo viajen `name`/`description`/`input_schema`/`cache_control`, protegiendo también a las tools que se migren después. 4 pruebas nuevas en el agente (114/114 en verde) + 1 en `nucleo-cognitivo` que valida la declaración real copiada literalmente. Los tres `Set` de `lib.js` siguen intactos. |
