# TASKS — Cola operativa inmediata

Estado: **tareas activas**: F-0.2-CFG y ARC-011-FASE3-CHECKLISTS (paso 2), pospuestas por decisión del Director; y **F-2.1-MEMORIA-DECLARAR**, nueva, con su paso 1 (declarar) ya completo. **F-1.3-MIGRAR-RESTO-TOOLS completada (2026-08-02)**: los catálogos de tools de los dos Workers quedan migrados al completo a ADR-0010 (96/103 tools; 7 excluidas a propósito, dominio ADR-0013) y pasa a la tabla de completadas, junto con F-1.3-TOOL-REGISTRY-ESQUELETO, F-1.3-TOOL-PILOTO-MIGRADA, F-1.2-NUCLEO-ESQUELETO, P-ARCH-002, ARC-008-TRAZAS-MIGRACION y ARC-013. Con F-1.1/F-1.2/F-1.3 cerradas, **la Época 1 queda completa**; por ADR-0007 enmienda 1 se abre **F-2.1** (Época 2, gobierno de memoria), cuyo modelo ya está aceptado por el Director en ADR-0013. **No queda ninguna tarea activa de ingeniería sin decisión pendiente del Director**, salvo el paso 2 (aplicar contra D1) de F-2.1-MEMORIA-DECLARAR, que sigue el mismo circuito que `checklists`. No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

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

Ninguna tarea de migración de catálogo de tools sigue activa: **F-1.3-MIGRAR-RESTO-TOOLS se completó el 2026-08-02** (ver tabla de completadas). Quedan las tareas pospuestas por decisión del Director más **F-2.1-MEMORIA-DECLARAR**, abierta el mismo día.

### F-2.1-MEMORIA-DECLARAR — Declarar el esquema de Memory (ADR-0013)

- ID: F-2.1-MEMORIA-DECLARAR
- Título: Declarar en una migración `.sql` versionada el esquema de memoria gobernada de ADR-0013
- Fase: Época 2 — Conocimiento y Memoria (F-2.1), abierta el 2026-08-02 por ADR-0007 enmienda 1 al cerrarse F-1.1/F-1.2/F-1.3 (Época 1 completa)
- Estado: **paso 2 (aplicar) completado y verificado (2026-08-02); paso 3 (implementar `memory.js` real) bloqueado por ARC-008 §8**
- Prioridad: Crítica
- Rama: `feat/f21-memoria-declarar` (paso 1), `feat/migrar-checklists-memoria-d1` (paso 2, PR #52)
- Responsable actual: Agente de Ingeniería (paso 3 exige revisar los dos Workers antes de retomar)
- Objetivo: declarar y aplicar la tabla `memoria_gobernada`, con los siete elementos del contrato de ADR-0013 (privacidad/lista blanca, aislamiento por tenant, procedencia, confianza, caducidad, corrección versionada, borrado), siguiendo el ciclo de ADR-0011. Es una tabla **nueva**, sin relación con la legada `alejandra_memoria` (`memory_save`/`memory_read`, ya en producción, dominio excluido de ADR-0010).
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con las columnas de ADR-0013 §1-§6 (`migrate_memoria_gobernada.sql`), sin tocar la tabla legada.
  2. ✅ **Aplicada contra D1 (run `30758423450`, 2026-08-02)**, autorizada por el Director en chat. Circuito oficial: PR #52 (añade el archivo al selector cerrado) → `workflow_dispatch` con confirmación `APPLY_D1_MIGRATION` → aprobación del entorno `production` por el Director → `wrangler d1 execute --remote`.
  3. ✅ Verificado tras aplicar: 16 columnas + 2 índices (`idx_memoria_gobernada_empresa`, `idx_memoria_gobernada_caduca`) coinciden exactamente con la migración; 0 filas; el `CREATE TABLE` de `alejandra_memoria` (legada) no cambió.
  4. ✅ Ningún Worker escribe ni lee la tabla nueva todavía; `nucleo-cognitivo/src/memory.js` sigue siendo interfaz pura sin cambios.
  5. ✅ Registrada en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0013 aceptado con modificaciones (2026-08-02); ADR-0011 aceptado como estrategia.
- Bloqueos: la implementación real de `memory.js`/tools (paso 3, activar lectura/escritura) sigue exigiendo que ARC-008 permita trazabilidad completa de una decisión que consulte memoria (ADR-0013 §8) y revisar los dos Workers (regla de los dos cerebros). No es una decisión del Director pendiente; es trabajo de ingeniería sin desbloquear todavía por dependencia técnica real.
- Archivos principales: `migrate_memoria_gobernada.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`.
- Pruebas: `node -e "JSON.parse(...)"` sobre el manifiesto; verificación manual columna por columna antes y después contra D1 real.
- Última actualización: 2026-08-02
- Siguiente acción exacta: sin acción inmediata — el paso 3 (persistencia real) espera avance de ARC-008 §8. Ver `HANDOFF.md`.

### ARC-011-FASE3-CHECKLISTS — Migración del vertical `checklists`

- ID: ARC-011-FASE3-CHECKLISTS
- Título: Primer vertical de la migración por fases de ARC-011 (ADR-0011)
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **paso 2 (aplicar) completado y verificado (2026-08-02); paso 3 (retirar DDL en runtime del vertical) pendiente, siguiente unidad de trabajo del ciclo**
- Prioridad: Media
- Rama: `docs/arc-011-fase3-checklists` (paso 1), `feat/migrar-checklists-memoria-d1` (paso 2, PR #52)
- Responsable actual: Agente de Ingeniería
- Objetivo: declarar y aplicar en una migración `.sql` versionada el esquema real —ya verificado en ARC-015— de las tablas del vertical `checklists` (`checklist_plantillas`, `checklists_plantillas`, `checklist_registros`, `checklist_ejecuciones`), siguiendo el ciclo de ADR-0011.
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con el esquema exacto verificado (`migrate_checklists.sql`, con la fuente `worker.js:línea` de cada `CREATE`), no el que el código debería crear.
  2. ✅ **Aplicada contra D1 (run `30758297243`, 2026-08-02)**, autorizada por el Director en chat, circuito oficial (PR #52 → `workflow_dispatch` con `APPLY_D1_MIGRATION` → aprobación del entorno `production` por el Director → `wrangler d1 execute --remote`).
  3. ✅ Verificado antes y después: las 4 tablas ya existían (creadas por el DDL en runtime), columna por columna idénticas a la migración; `0 rows_written` confirma que fue un no-op aditivo.
  4. El DDL en runtime de este vertical se deja intacto (`worker.js:14196-14221` y `18122-18152`) — retirarlo es el **paso 3** del ciclo de ADR-0011, todavía no ejecutado.
  5. ✅ Registrada en `migrate_manifiesto.json` como `aplicada: true`.
- Dependencias: ADR-0011 aceptado como estrategia (2026-08-02); ARC-013 y ARC-015 ya corregidos.
- Bloqueos: ninguno para el paso 3 (retirar el `CREATE TABLE`/comentarlo con referencia a la migración) — es código reversible, autorizado por ADR-0007 sin necesitar nueva decisión del Director salvo que aparezca un riesgo no documentado.
- Archivos principales: `migrate_checklists.sql`, `migrate_manifiesto.json`, `.github/workflows/migrate-d1-agent.yml`, próximamente `worker.js` (paso 3).
- Pruebas: verificación manual columna por columna antes y después contra D1 real; `node -e "JSON.parse(...)"` sobre el manifiesto.
- Última actualización: 2026-08-02
- Siguiente acción exacta: ejecutar el paso 3 del ciclo de ADR-0011 (comentar el DDL en runtime de `worker.js:14196-14221`/`18122-18152` con referencia a `migrate_checklists.sql`, sin borrarlo) y el paso 4 (verificar el vertical en producción sin el DDL en caliente) como tarea de ingeniería independiente.

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
| F-1.3-MIGRAR-RESTO-TOOLS | Migración incremental de ADR-0010 al resto de ambos catálogos | Completada (2026-08-02) | **`alejandra-agente/worker.js`: 69/69 tools** (lotes 2-8, `memory_save`/`memory_read`/`propose_mejora`/`tomar_decision` excluidas a propósito, dominio ADR-0013), 121/121 pruebas en verde. **`worker.js` raíz: 31/34 tools** (`memory_save`/`memory_read`/`memory_delete` excluidas por el mismo motivo) — trabajo repartido entre dos agentes en paralelo (worktrees aislados) más las 8 tools administrativas más sensibles (`sql_query`, `run_migration`, `direct_fix`, `manage_user`, `repo_write_file`, `propose_fix`, `self_audit`, `r2_delete`) revisadas directamente. `run_migration` → `N3` (mandato explícito de ADR-0006/0010). **96/103 tools totales con metadato ADR-0010**, ninguna migración cambia comportamiento observable (los `Set`/gates existentes siguen siendo la fuente de verdad). Tres hallazgos reales corregidos de paso: (1) SQL sin parametrizar en `gestionar_calidad`/`resolver` (agente); (2) fuga de metadato a la API de Anthropic, resuelta con `toolsParaAnthropic()`; (3) **`direct_fix`/`repo_write_file` en `worker.js` raíz afirmaban en su `description` (visible al propio modelo) y en su mensaje de retorno que un commit se despliega automáticamente a Cloudflare/Pages — falso desde F-0.1/ADR-0001 (2026-08-02): ningún workflow se dispara por push a `main`. Corregido para no inducir a Alejandra a creer/decir que un fix ya está en producción cuando solo está commiteado.** Hallazgo anotado sin resolver: `sql_query` permite DDL (`CREATE`/`ALTER`/`DROP`) igual que `run_migration`, con la misma barrera humana pero sin la distinción N3 explícita que ADR-0006 sí le da a `run_migration` — candidato a revisión de ADR aparte. |
