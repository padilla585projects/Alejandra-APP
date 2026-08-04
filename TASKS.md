# TASKS — Cola operativa inmediata

Estado: **Las 14 verticales de ARC-011 fase 3 completas** (ciclo de 5 pasos cerrado en todas): los ocho verticales anteriores más los seis del tercer lote agrupado (`planificacion_produccion`, `finanzas_obra`, `seguridad_cumplimiento`, `relaciones_obra`, `flota`, `nexus_experts` — ver `ARC-011-FASE3-LOTE3` abajo), cuyo paso 4 (desplegar y verificar en producción) se cerró el 2026-08-03 (run 30839201968, `/health` healthy, 23 tablas verificadas). **No queda ninguna tarea de ingeniería activa de ARC-011 fase 3.** **F-0.2-CFG — secretos movidos al entorno `production` (2026-08-04).** El Director ejecutó personalmente el checklist (`docs/runbooks/CHECKLIST-F02-CFG-SECRETOS-ENTORNO.md`): creó los 5 secretos en el entorno `production` el 2026-08-03, verificó con un despliegue exitoso, y borró la copia de nivel repositorio el 2026-08-04. Ningún agente leyó ni tocó valores reales. Quedan dos criterios menores de la tarea original (ensayo de confirmación errónea, política de rama de `github-pages`), sin fecha. **ARC-014 revisada el 2026-08-03: ninguna condición de reapertura cambió** (sigue en desarrollo, único mantenedor), permanece como riesgo aceptado sin acción de ingeniería. `F-2.1-MEMORIA-DECLARAR` queda con la tabla `memoria_gobernada` aplicada y verificada; su paso 3 (persistencia real) sigue bloqueado por ARC-008 §8, no por decisión del Director. **F-1.3-MIGRAR-RESTO-TOOLS completada (2026-08-02)**: los catálogos de tools de los dos Workers quedan migrados al completo a ADR-0010 (96/103 tools; 7 excluidas a propósito, dominio ADR-0013). Con F-1.1/F-1.2/F-1.3 cerradas, **la Época 1 queda completa**; por ADR-0007 enmienda 1 se abrió **F-2.1** (Época 2, gobierno de memoria), cuyo modelo ya está aceptado por el Director en ADR-0013. **Fix fuera del roadmap (2026-08-03, PR #76):** bug real reportado por Adrián en el chat de Alejandra de `panel.html` (repintado completo cada sondeo de 5s, causaba "salto" de mensajes) corregido — sondeo ahora compara firmas y solo añade mensajes nuevos al final; de paso se añadió mover/redimensionar el panel. **Paridad verificada (2026-08-04):** el patrón es exclusivo de este widget; `index.html`/`alejandra-panel.html` usan streaming SSE para el chat de Alejandra, sin sondeo de historial con repintado — no requieren el mismo fix. **No queda ninguna tarea activa de ingeniería sin decisión del Director pendiente; lo único abierto es su propia tarea administrativa (F-0.2-CFG) y decisiones exclusivamente suyas (siguiente rebanada de presentación tras P-ARCH-002).** No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

## Decisiones del Director — 2026-08-02 (ronda de desbloqueo del roadmap)

- **P-ARCH-002 — aprobada.** El componente de notificaciones temporales queda cerrado; desbloquea la siguiente rebanada de presentación.
- **ARC-014 — riesgo aceptado temporalmente.** Mientras el proyecto tenga un único mantenedor en fase de desarrollo, no se exige revisor distinto del solicitante. Se reabre en cuanto exista producción real o más de un mantenedor. Detalle en `ARCHITECT_BACKLOG.md`. **Revisada el 2026-08-03: el Director confirmó que ninguna de las dos condiciones cambió — sigue sin acción de ingeniería.**
- **ARC-011-FASE3-CHECKLISTS (paso 2, aplicar contra D1) — pospuesta.** No se autoriza todavía; se retoma cuando exista una ventana específica para cambios de esquema con verificación de D1 antes y después, tras completar la validación de la interfaz y del núcleo cognitivo. (Nota: esta postura quedó superada de hecho — el Director autorizó ese mismo paso 2 más tarde el 2026-08-02, ver tabla de completadas.)
- **F-0.2-CFG — pospuesta.** Los secretos se mueven al entorno `production` cuando el proyecto entre en preproducción/producción estable. Mientras tanto se mantiene la configuración a nivel de repositorio; ningún agente debe conocer ni manipular los valores reales. **Revisada el 2026-08-03: el Director pidió moverlos ahora ("muévelos tú"); se declinó ejecutar la acción porque entrar/mover secretos reales de Cloudflare/GitHub es una acción prohibida para cualquier agente (CLAUDE.md, "Los secretos no se leen, imprimen ni versionan"; reglas globales de seguridad de la sesión, categoría "Prohibido"). Sigue pendiente como tarea que solo el Director puede ejecutar personalmente en las UI de Cloudflare/GitHub.**

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

Ninguna tarea de migración de catálogo de tools sigue activa: **F-1.3-MIGRAR-RESTO-TOOLS se completó el 2026-08-02** (ver tabla de completadas). **Las 14 verticales de ARC-011 fase 3 completas** (`checklists`, `rfis`, `calidad`, `tareas_obra`, `actas_reunion`, `ordenes_cambio`, `ordenes_compra`, `proveedores_gestion`, `planificacion_produccion`, `finanzas_obra`, `seguridad_cumplimiento`, `relaciones_obra`, `flota`, `nexus_experts`), ciclo de 5 pasos cerrado en todas — ver `ARC-011-FASE3-LOTE3` abajo para el detalle del tercer lote, cuyo paso 4 (desplegar y verificar) se cerró el 2026-08-03 (run 30839201968, un único despliegue para los 6 verticales, siguiendo el criterio de agrupar que pidió el Director). **No queda ninguna tarea activa de ARC-011.**

### ARC-011-FASE3-LOTE3 — Declarar 6 verticales: `planificacion_produccion`, `finanzas_obra`, `seguridad_cumplimiento`, `relaciones_obra`, `flota`, `nexus_experts`

- ID: ARC-011-FASE3-PLANIFICACION-PRODUCCION, ARC-011-FASE3-FINANZAS-OBRA, ARC-011-FASE3-SEGURIDAD-CUMPLIMIENTO, ARC-011-FASE3-RELACIONES-OBRA, ARC-011-FASE3-FLOTA, ARC-011-FASE3-NEXUS-EXPERTS
- Título: Noveno a decimocuarto vertical de la migración por fases de ARC-011 (ADR-0011), tercer lote agrupado — cubre las últimas 23 tablas "solo de código" que quedaban sin declarar de ARC-011 fase 1/2 (ver `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`)
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **completada — ciclo de ADR-0011 (5 pasos) cerrado en los 6 verticales (2026-08-03)**
- Prioridad: Media
- Rama: (pendiente de PR)
- Responsable actual: —
- Objetivo: declarar el esquema de las 23 tablas restantes de ARC-011 que solo existen en `worker.js` (patrón lazy, nunca invocadas todavía en producción), agrupadas en 6 verticales por dominio de negocio:
  1. `planificacion_produccion`: `fases_obra`, `diario_obra`, `plan_semanal`, `rendimientos`, `field_reports`
  2. `finanzas_obra`: `presupuesto_obra`, `presupuesto_lineas`, `costes_obra`, `cobros_cliente`, `gastos_dietas`, `licitaciones`
  3. `seguridad_cumplimiento`: `registro_ambiental`, `seguros_obra`, `cae_documentacion`, `ausencias`, `libro_subcontratacion`, `toolbox_talks`
  4. `relaciones_obra`: `correspondencia`, `contactos_obra`, `lecciones_aprendidas`, `cierre_obra_items`
  5. `flota`: `flota_vehiculos`
  6. `nexus_experts`: `nexus_experts` (dominio distinto — telemetría de Nexus/ADR-0008, sin tenant — migrado aparte a propósito)
- Criterios de aceptación:
  1. ✅ Las 6 migraciones `.sql` escritas, cada `CREATE TABLE IF NOT EXISTS` verbatim contra worker.js (verificado línea por línea, no solo por subagente — incluida la columna generada `gastos_dietas.importe_km`).
  2. ✅ Verificado contra D1 real (solo lectura, `SELECT name FROM sqlite_master WHERE type='table' AND name IN (...)`, 2026-08-03): ninguna de las 23 tablas existe todavía en producción. A diferencia de los 8 verticales anteriores, el paso 2 de este lote **no será un no-op** sobre filas existentes — creará las tablas por primera vez.
  3. ✅ Registradas en `migrate_manifiesto.json` como `aplicada: false`.
  4. ✅ **Paso 2 (aplicar contra D1) completo (2026-08-03)**, autorizado por el Director en chat para los 6 verticales. Runs: `planificacion_produccion` [30836558620](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30836558620), `finanzas_obra` [30836563260](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30836563260), `seguridad_cumplimiento` [30836567914](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30836567914), `relaciones_obra` [30836573067](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30836573067), `flota` [30836578226](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30836578226), `nexus_experts` [30836583358](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30836583358). Las 23 tablas verificadas columna por columna tras aplicar vía `PRAGMA table_xinfo` (no `table_info`, que oculta la columna generada `gastos_dietas.importe_km`, `hidden=2`): todas coinciden exactamente con lo declarado.
  5. ✅ Paso 3 (retirar DDL en runtime) completo y **fusionado a `main`** (PR #75, 2026-08-03): las 6 funciones `ensureXxxTable()` (`ensureFasesObraTable`, `ensureDiarioObraTable`, `ensurePlanSemanalTable`, `ensureRendimientosTable`, `ensureFieldReportTable`, `ensurePresupuestoObraTable`, `ensurePresupuestoTable`, `ensureCostesObraTable`, `ensureCobrosClienteTable`, `ensureGastosDietasTable`, `ensureLicitacionesTable`, `ensureRegistroAmbientalTable`, `ensureSegurosObraTable`, `ensureCaeDocumentacionTable`, `ensureAusenciasTable`, `ensureLibroSubcontratacionTable`, `ensureToolboxTalksTable`, `ensureCorrespondenciaTable`, `ensureContactosObraTable`, `ensureLeccionesTable`, `ensureCierreObraTable`, `ensureFlorVehiculosTable`) comentadas, mismo patrón que los ocho verticales anteriores; el bloque de `nexus_experts` dentro de `runMigrations()` (try/catch de un solo uso) también comentado, con el mismo comentario explicativo, sin tocar los bloques vecinos (`ai_usage`, `alejandra_alert_cache`). CI verde (`Syntax and agent tests`), `node --check worker.js` limpio, verificación de encoding limpia, ninguna otra línea del archivo tocada (confirmado por diff).
  6. ✅ **Paso 4 (verificar en producción) completo (2026-08-03).** Autorizado por el Director (aprobación del entorno `production`). Desplegado `worker.js` (run [30839201968](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30839201968), versión `400421b4-06dd-4943-93d1-2c422c9b4f6a`, 2026-08-03T18:02:46Z), coincide con `wrangler deployments list`. `/health` → `healthy` (d1:true, r2:true). Las 23 tablas verificadas presentes tras el despliegue (`SELECT name FROM sqlite_master`, solo lectura, `rows_written: 0`).
  7. ✅ Registradas en `migrate_manifiesto.json` como `aplicada: true` tras el paso 2 (PR #73).
- Dependencias: ADR-0011 aceptado como estrategia; verticales anteriores como ciclo de referencia.
- Bloqueos: ninguno. Ciclo completo en los 6.
- Archivos principales: `migrate_planificacion_produccion.sql`, `migrate_finanzas_obra.sql`, `migrate_seguridad_cumplimiento.sql`, `migrate_relaciones_obra.sql`, `migrate_flota.sql`, `migrate_nexus_experts.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`.
- Pruebas: verificación manual línea por línea contra `worker.js` (23/23 tablas); verificación de existencia contra D1 real antes de aplicar (0 de 23 existían); verificación columna por columna tras aplicar vía `PRAGMA table_xinfo` (23/23 coinciden); `node --check worker.js` limpio tras retirar el DDL; verificación de encoding limpia; CI verde en PR #75; `/health` healthy y 23 tablas verificadas presentes tras el despliegue (run 30839201968).
- Última actualización: 2026-08-03
- Siguiente acción exacta: ninguna — los 6 verticales completos. **Con este lote, las 14 verticales de ARC-011 fase 3 (8 anteriores + estos 6) tienen el ciclo de 5 pasos cerrado.**

### ARC-011-FASE3-OC-PROVEEDORES — Migración agrupada de `ordenes_cambio`, `ordenes_compra` y `proveedores_gestion`

- ID: ARC-011-FASE3-ORDENES-CAMBIO, ARC-011-FASE3-ORDENES-COMPRA, ARC-011-FASE3-PROVEEDORES-GESTION
- Título: Sexto, séptimo y octavo vertical de la migración por fases de ARC-011 (ADR-0011), segundo lote agrupado tras `tareas_obra`/`actas_reunion`
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **completadas — ciclo de ADR-0011 (5 pasos) cerrado en las tres (2026-08-03)**
- Prioridad: Media
- Rama: `docs/arc011-fase3-oc-proveedores-declarar` (paso 1, PR #67), `feat/arc011-oc-proveedores-aplicar-retirar-ddl` (pasos 2-3, PR #68)
- Responsable actual: —
- Objetivo: declarar, aplicar y retirar el DDL en runtime de `ordenes_cambio` (`gestionar_oc`), `ordenes_compra`+`oc_lineas` y `proveedores_gestion`, siguiendo el ciclo completo de ADR-0011.
- Criterios de aceptación (los tres verticales):
  1. ✅ Migraciones `.sql` idempotentes verificadas contra D1 real: `migrate_ordenes_cambio.sql` (17 columnas), `migrate_ordenes_compra.sql` (15+8 columnas), `migrate_proveedores_gestion.sql` (23 columnas). Ninguna tiene `departamento`/DEPT-01.
  2. ✅ **Aplicadas contra D1** (`ordenes_cambio` run `30805220909`, `ordenes_compra` run `30805238082`, `proveedores_gestion` run `30805254063`, 2026-08-03), autorizadas por el Director en chat. `0 rows_written` en las tres.
  3. ✅ **DDL en runtime retirado** en las tres (PR #68): `ensureOrdenesCambioTable()`, `ensureOcTable()`, `ensureProveedoresGestionTable()` comentadas con referencia a su migración.
  4. ✅ **Verificado en producción en un único despliegue para los tres:** `worker.js` (run `30806109041`, versión `1475c65b-d1b2-4db1-be3f-8f8b45386e00`), `/health` → `healthy`, 17+15+8+23 columnas verificadas presentes.
  5. ✅ Registradas en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0011 aceptado como estrategia; verticales anteriores como ciclo de referencia.
- Bloqueos: ninguno. Ciclo completo en las tres.
- Archivos principales: `migrate_ordenes_cambio.sql`, `migrate_ordenes_compra.sql`, `migrate_proveedores_gestion.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`.
- Pruebas: verificación manual columna por columna antes y después contra D1 real; `node --check worker.js`; `/health` tras desplegar.
- Última actualización: 2026-08-03
- Siguiente acción exacta: ninguna — los tres verticales completos. **Antes del siguiente lote: espaciar más los despliegues y agrupar más verticales por despliegue, según lo señalado por el Director.**

### ARC-011-FASE3-TAREAS y ARC-011-FASE3-ACTAS — Migración agrupada de `tareas_obra` y `actas_reunion`

- ID: ARC-011-FASE3-TAREAS, ARC-011-FASE3-ACTAS
- Título: Cuarto y quinto vertical de la migración por fases de ARC-011 (ADR-0011), tras `checklists`, `rfis` y `calidad`
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **completadas — ciclo de ADR-0011 (5 pasos) cerrado para ambos verticales (2026-08-03)**
- Prioridad: Media
- Rama: `docs/arc011-fase3-tareas-actas-declarar` (paso 1, PR #64), `feat/arc011-tareas-actas-retirar-ddl-runtime` (paso 3, PR #65)
- Responsable actual: —
- Objetivo: declarar, aplicar y retirar el DDL en runtime del esquema real de `tareas_obra` (`gestionar_tarea`) y `actas_reunion` (`gestionar_acta`, NEW-49), siguiendo el ciclo completo de ADR-0011.
- **Primer par de verticales agrupados** (decisión operativa del Director, 2026-08-03): en vez de un despliegue de verificación por vertical, se aplicaron ambas migraciones por separado (cada una con su propia autorización) pero se retiró el DDL de las dos antes de un único despliegue de verificación — reduce las aprobaciones de entorno `production` sin cambiar la barrera de autorización por migración D1.
- Criterios de aceptación (ambos verticales):
  1. ✅ Migraciones `.sql` idempotentes con el esquema exacto verificado contra D1 real (`migrate_tareas_obra.sql`, 16 columnas; `migrate_actas_reunion.sql`, 23 columnas), incorporando `departamento` (DEPT-01) y el resto de columnas `ALTER` directamente en cada `CREATE`.
  2. ✅ **Aplicadas contra D1** (`tareas_obra` run `30798028360`, `actas_reunion` run `30798043436`, 2026-08-03), autorizadas por el Director en chat. Verificado antes y después: columnas idénticas en ambas; no-op confirmado.
  3. ✅ **DDL en runtime retirado** en ambas (PR #65): comentado, no borrado, en `ensureTareasObraTable()`/`ensureActasTable()`, con referencia a su migración.
  4. ✅ **Verificado en producción sin el DDL en caliente, en un único despliegue:** desplegado `worker.js` (run `30799296203`, versión `ae5317c5-ecaa-4471-8cb6-3297c8057e56`), `/health` → `healthy` (d1:true, r2:true), 16 columnas de `tareas_obra` y 23 de `actas_reunion` verificadas presentes tras el despliegue.
  5. ✅ Registradas en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0011 aceptado como estrategia; `checklists`/`rfis`/`calidad` como ciclo de referencia ya completo. Verificación de columnas reutilizó la lectura de D1 autorizada el 2026-08-03 para la segunda ronda de DDL silenciado.
- Bloqueos: ninguno. Ciclo completo en ambos.
- Archivos principales: `migrate_tareas_obra.sql`, `migrate_actas_reunion.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`.
- Pruebas: verificación manual columna por columna antes y después contra D1 real; `node --check worker.js`; `/health` tras desplegar.
- Última actualización: 2026-08-03
- Siguiente acción exacta: ninguna — ambos verticales completos. Primer par con despliegue de verificación agrupado, plantilla para futuros lotes.

### ARC-011-FASE3-CALIDAD — Migración del vertical `calidad`

- ID: ARC-011-FASE3-CALIDAD
- Título: Tercer vertical de la migración por fases de ARC-011 (ADR-0011), tras `checklists` y `rfis`
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **completada — ciclo de ADR-0011 (5 pasos) cerrado para este vertical (2026-08-03)**
- Prioridad: Media
- Rama: `docs/arc011-fase3-calidad-declarar` (paso 1, PR #59), `docs/arc011-calidad-aplicada` (paso 2, PR #61), `feat/arc011-calidad-retirar-ddl-runtime` (pasos 3-4, PR #62)
- Responsable actual: —
- Objetivo: declarar, aplicar y retirar el DDL en runtime del esquema real de `control_calidad` (NEW-37) y `punch_list` (NEW-44), único dominio de control de calidad de obra, siguiendo el ciclo completo de ADR-0011.
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS` ×2) con el esquema exacto verificado contra D1 real (`migrate_calidad.sql`), incorporando la columna `departamento` (DEPT-01) directamente en cada `CREATE`.
  2. ✅ **Aplicada contra D1 (run `30790988608`, 2026-08-03)**, autorizada por el Director en chat. Verificado antes y después: 17 columnas idénticas en cada tabla; `0 rows_written` confirma no-op.
  3. ✅ **DDL en runtime retirado**, autorizado por el Director en chat (2026-08-03): comentado, no borrado, en `ensureCalidadTable()`/`ensurePunchListTable()`, con referencia a la migración.
  4. ✅ **Verificado en producción sin el DDL en caliente:** desplegado `worker.js` (run `30791398680`, versión `d26261b6-bf34-4e5b-bef5-478653648930`), `/health` → `healthy` (d1:true, r2:true), las 17 columnas de cada tabla verificadas presentes tras el despliegue.
  5. ✅ Registrada en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0011 aceptado como estrategia; `checklists`/`rfis` como ciclo de referencia ya completo. Verificación de columnas reutilizó la lectura de D1 autorizada el 2026-08-03 para la segunda ronda de DDL silenciado (ver `ARCHITECT_BACKLOG.md`, ARC-013).
- Bloqueos: ninguno. Ciclo completo.
- Archivos principales: `migrate_calidad.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`.
- Pruebas: verificación manual columna por columna antes y después contra D1 real; `node --check worker.js`; `/health` tras desplegar.
- Última actualización: 2026-08-03
- Siguiente acción exacta: ninguna — vertical `calidad` completo. Tercer vertical con el ciclo de 5 pasos cerrado, tras `checklists` y `rfis`.

### ARC-011-FASE3-RFIS — Declarar la migración del vertical `rfis`

- ID: ARC-011-FASE3-RFIS
- Título: Segundo vertical de la migración por fases de ARC-011 (ADR-0011), tras `checklists`
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **completada — ciclo de ADR-0011 (5 pasos) cerrado para este vertical (2026-08-02)**
- Prioridad: Media
- Rama: `main` (paso 1), `feat/migrar-rfis-d1` (paso 2, PR #55), `feat/arc011-rfis-retirar-ddl-runtime` (pasos 3-4, PR #56)
- Responsable actual: —
- Objetivo: declarar, aplicar y retirar el DDL en runtime del esquema real de la tabla `rfis` (consultas técnicas de obra, NEW-34), única en su vertical, siguiendo el ciclo completo de ADR-0011.
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con el esquema exacto verificado contra D1 real (`migrate_rfis.sql`), incorporando en el mismo `CREATE` la columna `departamento` (añadida en runtime, DEPT-01) para evitar un `ALTER` no idempotente.
  2. ✅ **Aplicada contra D1 (run `30769663802`, 2026-08-02)**, autorizada por el Director en chat con condiciones explícitas. Verificado antes y después: 19 columnas idénticas; `0 rows_written` confirma no-op.
  3. ✅ **DDL en runtime retirado (PR #56)**, autorizado por el Director en chat (2026-08-02): comentado, no borrado, en `ensureRfisTable()`, con referencia a la migración.
  4. ✅ **Verificado en producción sin el DDL en caliente:** desplegado `worker.js` (run `30770291895`, versión `2fa16165-4623-4e26-ba5e-cfb2e448a23d`), `/health` → `healthy` (d1:true, r2:true), las 19 columnas de `rfis` siguen presentes tras el despliegue.
  5. ✅ Registrada en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0011 aceptado como estrategia (2026-08-02); `checklists` como ciclo de referencia ya completo.
- Bloqueos: ninguno. Ciclo completo.
- Archivos principales: `migrate_rfis.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`.
- Pruebas: verificación manual columna por columna antes y después contra D1 real; `node --check worker.js`; `/health` tras desplegar.
- Última actualización: 2026-08-02
- Siguiente acción exacta: ninguna — vertical `rfis` completo. Segundo vertical con el ciclo de 5 pasos cerrado, tras `checklists`.

### F-2.1-MEMORIA-ESCRITURA — Exponer confirmarCandidata/rechazarCandidata/listarCandidatasPendientes como tools

- ID: F-2.1-MEMORIA-ESCRITURA
- Título: Exponer la escritura sobre `memoria_gobernada` como tools de `alejandra-agente`, decisión del Director (2026-08-04)
- Fase: Época 2 — F-2.1 paso 3 (continuación de `F-2.1-MEMORIA-DECLARAR`)
- Estado: **completada (2026-08-04)**
- Prioridad: Media
- Rama: `PENDIENTE` (por commitear/PR)
- Responsable actual: —
- Objetivo: dar a Alejandra tres tools nuevas de solo `alejandra-agente/worker.js` (mismo criterio que `memoria_consultar`: no expuestas en `worker.js` raíz, catálogo `dev_verificado`) para que un humano con rol `encargado`+ pueda revisar y decidir sobre candidatas de memoria gobernada, sin que el modelo pueda auto-aprobar su propia inferencia.
- Criterios de aceptación:
  1. ✅ **Hallazgo real corregido antes de exponer:** `confirmarCandidata()`/`rechazarCandidata()` (`alejandra-agente/worker.js`, desde ARC-008 §8) filtraban solo por `id`/`estado`, sin `empresa_id` — un id de otra empresa se habría podido confirmar/rechazar igual, mismo patrón de fuga que ARC-016. Ambas funciones ahora exigen `empresaId` y lo añaden al `WHERE`; `rechazarCandidata()` además registra traza `memoria_rechazo` (antes no registraba ninguna).
  2. ✅ Tres tools nuevas (ADR-0010: `acceso`/`cron`/`nivel_riesgo`): `memoria_listar_pendientes` (N0, `cron:'permitido'`), `memoria_confirmar_candidata` (N1, `cron:'prohibido'`), `memoria_rechazar_candidata` (N1, `cron:'prohibido'`). Excluidas del cron a propósito: aprobar una candidata sin humano delante contradice el propósito de la validación que ADR-0013 §3 exige.
  3. ✅ Gate de rol `encargado`+ nuevo (`esEncargadoOSuperior()`, mismo patrón de consulta que `esDeveloperAgente()`), comprobado en cada `case` contra la BD por `usuario_id`, no contra lo que el modelo afirme.
  4. ✅ `empresa_id` sale siempre de la sesión (`resolverEid(empresa_id)`), nunca del input — mismo aislamiento por tenant que `memoria_consultar`.
  5. ✅ Añadidas a `TOOLS_REQUIEREN_SESION` (`lib.js`) las tres; `memoria_confirmar_candidata`/`memoria_rechazar_candidata` añadidas también a `TOOLS_PROHIBIDAS_CRON`.
  6. ✅ Cableadas en los cuatro `TOOLS_POR_EXPERTO` donde ya vivía `TOOL_MEMORIA_CONSULTAR` (`app`, `tecnico`, `completo`, `ingenieria`).
  7. ✅ Solo `alejandra-agente/worker.js` — mismo criterio documentado que `memoria_consultar` (el catálogo de `worker.js` raíz es enteramente `dev_verificado`).
- Dependencias: `F-2.1-MEMORIA-DECLARAR` (paso 2 aplicado), ARC-008 §8 (trazabilidad), decisión del Director 2026-08-04 ("Exponer como tools nuevas").
- Bloqueos: ninguno.
- Archivos principales: `alejandra-agente/worker.js`, `alejandra-agente/lib.js`, `alejandra-agente/lib.test.js`.
- Pruebas: `node --check` limpio en `worker.js`/`lib.js`; `npm --prefix alejandra-agente test` 138/138 en verde (2 nuevas: sesión obligatoria en las tres, exclusión del cron en confirmar/rechazar). El gate de rol (`esEncargadoOSuperior`) vive en `worker.js`, sin suite de tests dedicada — mismo patrón que `esDeveloperAgente()`, que tampoco la tiene.
- Última actualización: 2026-08-04
- Siguiente acción exacta: ninguna — pendiente de commit/PR/CI, sin desplegar todavía.

### F-2.1-MEMORIA-DECLARAR — Declarar el esquema de Memory (ADR-0013)

- ID: F-2.1-MEMORIA-DECLARAR
- Título: Declarar en una migración `.sql` versionada el esquema de memoria gobernada de ADR-0013
- Fase: Época 2 — Conocimiento y Memoria (F-2.1), abierta el 2026-08-02 por ADR-0007 enmienda 1 al cerrarse F-1.1/F-1.2/F-1.3 (Época 1 completa)
- Estado: **paso 2 (aplicar) completado y verificado (2026-08-02); paso 3 (implementar `memory.js` real) — ARC-008 §8 resuelto (2026-08-02), CRUD real en los dos Workers; escritura expuesta como tools el 2026-08-04 (ver `F-2.1-MEMORIA-ESCRITURA` arriba)**
- Prioridad: Crítica
- Rama: `feat/f21-memoria-declarar` (paso 1), `feat/migrar-checklists-memoria-d1` (paso 2, PR #52), `feat/arc008-consultarmemoria-real` (paso 3, ARC-008 §8)
- Responsable actual: — (siguiente decisión: qué tool(s) exponen esta memoria al modelo, fuera de esta tarea)
- Objetivo: declarar y aplicar la tabla `memoria_gobernada`, con los siete elementos del contrato de ADR-0013 (privacidad/lista blanca, aislamiento por tenant, procedencia, confianza, caducidad, corrección versionada, borrado), siguiendo el ciclo de ADR-0011. Es una tabla **nueva**, sin relación con la legada `alejandra_memoria` (`memory_save`/`memory_read`, ya en producción, dominio excluido de ADR-0010).
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con las columnas de ADR-0013 §1-§6 (`migrate_memoria_gobernada.sql`), sin tocar la tabla legada.
  2. ✅ **Aplicada contra D1 (run `30758423450`, 2026-08-02)**, autorizada por el Director en chat. Circuito oficial: PR #52 (añade el archivo al selector cerrado) → `workflow_dispatch` con confirmación `APPLY_D1_MIGRATION` → aprobación del entorno `production` por el Director → `wrangler d1 execute --remote`.
  3. ✅ Verificado tras aplicar: 16 columnas + 2 índices (`idx_memoria_gobernada_empresa`, `idx_memoria_gobernada_caduca`) coinciden exactamente con la migración; 0 filas; el `CREATE TABLE` de `alejandra_memoria` (legada) no cambió.
  4. ✅ Ningún Worker escribe ni lee la tabla nueva todavía; `nucleo-cognitivo/src/memory.js` sigue siendo interfaz pura sin cambios.
  5. ✅ Registrada en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0013 aceptado con modificaciones (2026-08-02); ADR-0011 aceptado como estrategia.
- Bloqueos: ninguno técnico. **ARC-008 §8 resuelto (2026-08-02):** `consultarMemoria()` real en los dos Workers registra una traza `memoria_consulta` con los recuerdos exactos devueltos, cerrando la trazabilidad completa que exigía ADR-0013 §8. `listarCandidatasPendientes()`/`confirmarCandidata()`/`rechazarCandidata()` completan el CRUD. `nucleo-cognitivo/src/memory.js` acepta las cuatro como dependencia inyectada (`inyectarMemoria()`), sin integrarse en ningún Worker (sigue prohibido por `CLAUDE.md`). **Primera tool expuesta al modelo — decisión del Director (2026-08-02, "Opción A"):** `memoria_consultar`, solo lectura, `nivel_riesgo:'N0'`, `acceso:'sesion'`, en `alejandra-agente/worker.js` únicamente (el catálogo de `worker.js` raíz es enteramente `dev_verificado`, decisión consciente documentada en `HANDOFF.md`, no omisión). Escritura (`confirmarCandidata`/`listarCandidatasPendientes`/`rechazarCandidata` como tools) queda **pendiente de una decisión específica posterior del Director**, tal como pidió explícitamente.
- Archivos principales: `migrate_memoria_gobernada.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`, `alejandra-agente/worker.js`, `alejandra-agente/lib.js`, `nucleo-cognitivo/src/memory.js`.
- Pruebas: `node -e "JSON.parse(...)"` sobre el manifiesto; verificación manual columna por columna antes y después contra D1 real; `node --check` en los dos Workers y en `lib.js`; `node --test nucleo-cognitivo/test/*.js` (36/36); `npm --prefix alejandra-agente test` (136/136, 15 nuevas: aislamiento por tenant, caducidad, confianza, ausencia de resultados cruzados sobre `construirConsultaMemoriaGobernada()`).
- Última actualización: 2026-08-02
- Siguiente acción exacta: sin acción inmediata sobre lectura (completa y verificada). Escritura sobre `memoria_gobernada` (candidatas, confirmación, memoria compartida) espera decisión específica del Director — no se ha propuesto todavía. Ver `HANDOFF.md`.

### ARC-011-FASE3-CHECKLISTS — Migración del vertical `checklists`

- ID: ARC-011-FASE3-CHECKLISTS
- Título: Primer vertical de la migración por fases de ARC-011 (ADR-0011)
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **completada — ciclo de ADR-0011 (5 pasos) cerrado para este vertical (2026-08-02)**
- Prioridad: Media
- Rama: `docs/arc-011-fase3-checklists` (paso 1), `feat/migrar-checklists-memoria-d1` (paso 2, PR #52), `feat/arc011-checklists-retirar-ddl-runtime` (pasos 3-4, PR #53)
- Responsable actual: —
- Objetivo: declarar, aplicar y retirar el DDL en runtime del esquema real —ya verificado en ARC-015— de las tablas del vertical `checklists` (`checklist_plantillas`, `checklists_plantillas`, `checklist_registros`, `checklist_ejecuciones`), siguiendo el ciclo completo de ADR-0011.
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con el esquema exacto verificado (`migrate_checklists.sql`, con la fuente `worker.js:línea` de cada `CREATE`), no el que el código debería crear.
  2. ✅ **Aplicada contra D1 (run `30758297243`, 2026-08-02)**, autorizada por el Director en chat, circuito oficial (PR #52 → `workflow_dispatch` con `APPLY_D1_MIGRATION` → aprobación del entorno `production` por el Director → `wrangler d1 execute --remote`). Verificado antes y después: las 4 tablas ya existían, columna por columna idénticas; `0 rows_written` confirma no-op aditivo.
  3. ✅ **DDL en runtime retirado (PR #53):** comentado, no borrado, en `runMigrations()` (`checklist_plantillas`/`checklist_registros`) y `ensureQATablas()` (`checklists_plantillas`/`checklist_ejecuciones`), con referencia a la migración. `ncrs_obra` (misma función, vertical distinto y sin migrar) queda intacta a propósito.
  4. ✅ **Verificado en producción sin el DDL en caliente:** desplegado `worker.js` (run `30759124864`, SHA `eecb657`), `/health` → `healthy` (d1:true, r2:true), las 4 tablas del vertical siguen presentes tras el despliegue.
  5. ✅ Registrada en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0011 aceptado como estrategia (2026-08-02); ARC-013 y ARC-015 ya corregidos.
- Bloqueos: ninguno. Ciclo completo.
- Archivos principales: `migrate_checklists.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, `worker.js`.
- Pruebas: verificación manual columna por columna antes y después contra D1 real; `node --check worker.js`; `/health` tras desplegar.
- Última actualización: 2026-08-02
- Siguiente acción exacta: ninguna — vertical `checklists` completo. Sirve de plantilla para el próximo vertical de ARC-011 fase 3 (candidato: el que tenga más riesgo/beneficio entre las tablas restantes con `CREATE` propio, no las 27 huérfanas todavía).

### F-0.2-CFG — Completar la configuración remota de entrega segura

- ID: F-0.2-CFG
- Título: Cerrar los controles remotos que F-0.1-R no pudo completar
- Fase: Época 0 — Fundación y entrega segura
- Estado: **completada (2026-08-04)** — los 4 criterios de comportamiento cerrados
- Prioridad: Alta
- Rama: `PENDIENTE` — es configuración remota; solo requiere rama si cambia documentación
- Responsable actual: — (cerrada)
- Objetivo: que los secretos de producción queden acotados al entorno `production` y que el circuito manual de despliegue quede probado en vacío.
- Criterios de aceptación:
  1. ✅ **Secretos recreados en el entorno `production` y retirados del repositorio (2026-08-04).** Los 5 secretos (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ADMIN_TOKEN`) se crearon en el entorno `production` el 2026-08-03 (18:32-18:46), verificados con un despliegue exitoso inmediatamente después (`Deploy API Worker`, run `30843489418`, 18:56, éxito). El Director borró la copia de nivel repositorio el 2026-08-04, ejecutándolo él mismo (`gh secret delete` o interfaz web) tras confirmar la verificación — ningún agente leyó ni tocó valores reales en ningún momento. Verificado en solo lectura tras el borrado: `gh secret list` (repositorio) vacío; `gh secret list --env production` con los 5 intactos.
  2. ✅ **Ensayo con confirmación errónea completado (2026-08-04).** `gh workflow run deploy-worker.yml -f ref=main -f confirmation=CONFIRMACION_INCORRECTA_ENSAYO`: run [30886880983](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30886880983), job `Deploy API Worker` → `skipped`, 0 pasos ejecutados, sin solicitud de aprobación del entorno `production`, sin despliegue. Confirma el comportamiento documentado en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.
  3. ✅ **Decidido y aplicado el 2026-08-02: baja a 0.** El Director lo autorizó de forma expresa. Motivo: al ser un repositorio de un solo mantenedor, GitHub no permite auto-aprobar, así que cada merge exigía el bypass de administrador — fricción sin protección real. La protección efectiva sigue siendo el check `Syntax and agent tests` y la aprobación del entorno `production`, ambos intactos. Verificado tras el cambio: PR obligatoria, rama al día, sin force-push ni borrado, todo sin tocar.
  4. ✅ **Decidido y aplicado el 2026-08-04: se amplía a tags.** El Director eligió permitir publicar `github-pages` también desde un tag, no solo `main`. Aplicado vía `gh api` (acción reversible de configuración de repositorio, autónoma bajo ADR-0007): `POST .../environments/github-pages/deployment-branch-policies` con `{name:'*', type:'tag'}`. Verificado tras el cambio: la política del entorno incluye `main` (branch) y `*` (tag).
  5. ✅ Nada desplegado ni migrado durante la validación — el ensayo del criterio 2 confirmó exactamente eso (job `skipped`, 0 pasos).
- Dependencias: F-0.1-R completada; acceso a los valores reales de los secretos.
- Bloqueos: ninguno. Cerrada.
- Archivos principales: ninguno; es configuración remota (entornos de GitHub).
- Pruebas: run 30886880983 (`skipped`, sin aprobación de entorno solicitada); lectura de `deployment-branch-policies` antes/después del criterio 4.
- Última actualización: 2026-08-04
- Siguiente acción exacta: ninguna — F-0.2-CFG completa.

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
| F-1.3-MIGRAR-RESTO-TOOLS | Migración incremental de ADR-0010 al resto de ambos catálogos | Completada (2026-08-02) | **`alejandra-agente/worker.js`: 69/69 tools** (lotes 2-8, `memory_save`/`memory_read`/`propose_mejora`/`tomar_decision` excluidas a propósito, dominio ADR-0013), 121/121 pruebas en verde. **`worker.js` raíz: 31/34 tools** (`memory_save`/`memory_read`/`memory_delete` excluidas por el mismo motivo) — trabajo repartido entre dos agentes en paralelo (worktrees aislados) más las 8 tools administrativas más sensibles (`sql_query`, `run_migration`, `direct_fix`, `manage_user`, `repo_write_file`, `propose_fix`, `self_audit`, `r2_delete`) revisadas directamente. `run_migration` → `N3` (mandato explícito de ADR-0006/0010). **96/103 tools totales con metadato ADR-0010**, ninguna migración cambia comportamiento observable (los `Set`/gates existentes siguen siendo la fuente de verdad). Tres hallazgos reales corregidos de paso: (1) SQL sin parametrizar en `gestionar_calidad`/`resolver` (agente); (2) fuga de metadato a la API de Anthropic, resuelta con `toolsParaAnthropic()`; (3) **`direct_fix`/`repo_write_file` en `worker.js` raíz afirmaban en su `description` (visible al propio modelo) y en su mensaje de retorno que un commit se despliega automáticamente a Cloudflare/Pages — falso desde F-0.1/ADR-0001 (2026-08-02): ningún workflow se dispara por push a `main`. Corregido para no inducir a Alejandra a creer/decir que un fix ya está en producción cuando solo está commiteado.** Hallazgo anotado sin resolver: `sql_query` permite DDL (`CREATE`/`ALTER`/`DROP`) igual que `run_migration`, con la misma barrera humana pero sin la distinción N3 explícita que ADR-0006 sí le da a `run_migration` — candidato a revisión de ADR aparte. |
| ARC-011-FASE3-LOTE3 | Tercer lote agrupado (23 tablas, 6 verticales) | Completada (2026-08-03) | Ver `ARC-011-FASE3-LOTE3` arriba. Ciclo de 5 pasos cerrado: declarado (PR #70), aplicado (run 30836558620 y siguientes), DDL en runtime retirado (PR #75), verificado en producción (run 30839201968, `/health` healthy, 23 tablas presentes). **Con este lote, las 14 verticales de ARC-011 fase 3 quedan completas.** |
| fix/panel-alejandra-chat-sync-drag-resize | Fix del salto del chat de Alejandra en `panel.html` + mover/redimensionar | Completada (2026-08-03); paridad verificada (2026-08-04) | PR #76. Bug real reportado por Adrián: el sondeo cada 5s repintaba toda la ventana del chat aunque solo hubiera un mensaje nuevo (incluido de otra plataforma, vía `alejandra_historial` compartida). `cargarAlejandraChat()` ahora compara firmas y solo añade mensajes nuevos al final. Único archivo tocado: `panel.html`. Paridad comprobada: `index.html`/`alejandra-panel.html` usan streaming SSE para el chat de Alejandra, no el patrón de sondeo-y-repintado — no necesitan el mismo fix. |
