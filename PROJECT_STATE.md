# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-08-03
- Estado: F-0.1 **integrada y activa en remoto**. ARC-011 fases 1 y 2 completadas; ARC-012 resuelto con tres migraciones aplicadas y verificadas. ARC-011 fase 3: **ocho verticales con el ciclo completo** y **seis más declarados (paso 1)** el 2026-08-03 (PR #70) — las 23 tablas "solo de código" que quedaban en el inventario original quedan todas declaradas, a la espera de autorización del Director para el paso 2.

## Autonomía de los agentes

**ADR-0007 (aceptado, 2026-08-02)** sustituye las prohibiciones absolutas por un criterio de
**reversibilidad**: el código se deshace, los datos no.

Autónomo: ramas, commits, `push`, PR y merge con CI en verde, pruebas, despliegue de Workers
y encadenar tareas ya aprobadas de `TASKS.md`. Requiere decisión humana: migraciones D1,
secretos, borrado de datos, borrado en R2 y abrir una fase nueva.

Se revisó la premisa de que el entorno fuera solo de desarrollo y **no se sostiene**: la app
opera con datos personales reales —ARC-012 restauró la retención RGPD el mismo día— por lo
que las salvaguardas sobre datos se mantienen íntegras. Lo que se retiró es la ceremonia
sobre acciones reversibles.

## Gobierno operativo

`ENGINEERING_WORKFLOW.md` está creado para revisión como proceso común de cualquier agente de ingeniería. Centraliza el procedimiento operativo y deja en `AGENTS.md` solo las reglas específicas del repositorio. No modifica arquitectura, código, infraestructura ni el estado de F-0.1.

## Entrega segura

CI (`ci.yml`), CD manual (Pages y Workers), migraciones D1 y configuración de secretos están separados en el repositorio. Un push/merge ya no activa los workflows de producción versionados.

**Activo en remoto desde el 2026-08-02** (PR #9). Los workflows antiguos se desactivaron antes de integrar, CI pasó en verde y no se disparó ningún despliegue durante el proceso. Se creó el entorno `production` con revisor requerido y se protegió `main` con PR obligatoria y check requerido.

Queda pendiente mover los secretos de repositorio a entorno y probar en vacío el circuito manual: la API no expone los valores de los secretos, así que recrearlos corresponde al Director. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

Los despliegues de Workers no llevan healthcheck automático: los `GET /health` actuales devuelven 200 sin comprobar D1/R2, por lo que darían por bueno un despliegue roto. La verificación es manual (runbook); Pages sí conserva healthcheck porque valida la versión servida.

## Esquema de datos — ARC-011 y ARC-012

**Fase 1 (análisis estático).** 173 sentencias DDL ejecutables desde código. **105 de las 150 tablas del sistema existen únicamente porque el código las crea en caliente**; ninguna migración versionada las declara. `schema_completo.sql` cubre menos de un tercio del esquema real. Detalle en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`.

**Fase 2 (contraste con D1 real, autorizado, solo metadatos).** 151 tablas en producción. **27 no las declara nadie** —incluidas `empresas`, `fichajes` e `incidencias`—, lo que confirma que **el esquema no es reproducible desde el repositorio**: es un riesgo de continuidad de negocio, no solo de gobierno técnico. De las 41 columnas `ALTER` del código, 38 estaban presentes y **3 habían fallado en silencio**.

**ARC-012 — resuelto el 2026-08-02.** Las tres columnas ausentes se aplicaron por el workflow manual y se verificaron contra el esquema real:

| Columna | Efecto del arreglo | Run |
|---|---|---|
| `planos.circuitos_json` | Repara 4 operaciones de planos rotas | 30722027660 |
| `inventario_seg.ubicacion` | Cierra SEG-01 **de verdad**: el fix del 25/07 nunca funcionó | 30722072138 |
| `empresas.retencion_config` | Restaura la retención RGPD, inoperante hasta entonces | 30722103191 |

El bloqueo de `migrate_008_plano_circuitos.sql` se retiró: partía de un diagnóstico por lectura de código sin contrastar con el esquema real, y la migración **era el arreglo, no el riesgo**.

Fue el primer uso real del circuito de entrega segura de F-0.1 y se comportó como estaba diseñado: los tres runs quedaron en `waiting` hasta aprobación del entorno.

## Estado de despliegue (2026-08-02, actualizado tras F-1.2/F-1.3)

**Los dos Workers están desplegados y respondiendo** (`/health: healthy`, D1 y R2 en verde,
verificado): `alejandra-app-api` versión `9cfb30c3-ff09-4200-959e-98a7eb27bbf4`,
`alejandra-agente` versión `74234d68-4e49-4368-a309-552f24ab22b0` — ambos con SHA `5e4f1c3`
(`main`, PR #49), aprobados por el Director. Llevan ARC-013, ARC-015, ARC-016, ARC-017,
ADR-0014 (`registrarTraza`, `/health` real de tres estados, `GET /admin/trazas`, healthcheck
automático post-despliegue) y ahora F-1.2/F-1.3 (metadato de ADR-0010 en 96/103 tools; el
núcleo cognitivo aislado en `nucleo-cognitivo/` sigue sin integrar en ninguno de los dos, tal
como exige el alcance de F-1.2). Verificación completa registrada en `HANDOFF.md`.

## ADR-0014 — implementado y verificado en producción (2026-08-02)

`registrarTraza()` conectado a ARC-013 (`runDDL()`/`ddlPaso()`) en los dos Workers: todo error real de DDL ahora también persiste en `alejandra_trazas` (`tipo='ddl_error'`), con minimización/redacción de email y teléfono antes de serializar, sin romper el `console.error` existente. `/health` rediseñado en ambos (`estado`: `healthy`/`degraded`/`unhealthy`, comprobando D1 y el objeto centinela `_healthcheck/centinela.txt` en R2), verificado en vivo:

| Worker | `/health` |
|---|---|
| `alejandra-app-api` | `{"estado":"healthy","d1":true,"r2":true,"version":"29d48103-..."}` |
| `alejandra-agente` | `{"estado":"healthy","d1":true,"r2":true,"version":"6f220f61-...", ...flags existentes}` |

`GET /admin/trazas` solo en `alejandra-app-api` (decisión del Director), protegido con `hasRole(s, 'superadmin', 'desarrollador')`, verificado en vivo (403 sin sesión). Versión derivada del binding nativo `version_metadata` de Cloudflare en los dos Workers — mismo id que `wrangler deployments list`, sin tocar el pipeline de CI. `alejandra-agente/lib.js` gana 16 pruebas nuevas (110/110 en verde).

**Bug encontrado y corregido en el mismo ciclo:** `index.html` comparaba el `version` de `/health` del agente contra `APP_VERSION` como *fallback* de actualización — al pasar `version` a ser un UUID de despliegue, esa comparación nunca coincidiría y forzaría una recarga en cada uso, el mismo patrón de los incidentes de recarga infinita del 22/04 y 26/04. Desactivado el *fallback* antes de que llegara a afectar a un usuario real (el código ya está en `main`; publicarlo a Pages es un paso de entrega aparte, no automático).

## ARC-018 — resuelto (2026-08-02)

`alejandra-worker` (fork huérfano, CORS abierto, escritura confirmada contra la `alejandra-db` real) borrado. Su bucket `alejandra-files` tenía 12 fotos únicas de una incidencia real (23/04) que nunca llegaron al sistema — migradas a `alejandra-app-files` y verificadas antes de vaciar y borrar el bucket. Detalle completo en `ARCHITECT_BACKLOG.md`.

## Riesgos activos

- Los secretos siguen a nivel de repositorio, no de entorno: cualquier workflow puede leerlos. **Pospuesto por decisión del Director (2026-08-02, F-0.2-CFG):** se mueven cuando el proyecto entre en fase estable de preproducción/producción; ningún agente maneja los valores reales mientras tanto.
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción, no las migraciones versionadas. Fases 1 y 2 verificadas. **Fase 3: `ADR-0011` aceptado el 2026-08-02** como estrategia (migración por vertical, empezando por `checklists`, con manifiesto de estado). Paso 1 (declarar `migrate_checklists.sql`) completo. **Paso 2 (aplicar contra D1) pospuesto por decisión del Director (2026-08-02):** se retoma cuando exista una ventana específica para cambios de esquema, con verificación de D1 antes y después.
- **ARC-014 (medio) — riesgo aceptado temporalmente por el Director (2026-08-02).** La aprobación del entorno `production` se concedió con la misma credencial que lanzó el workflow; un agente con token de administración puede aprobar su propio despliegue. Mientras el proyecto tenga un único mantenedor en desarrollo, se acepta sin mitigación adicional. Se reabre en cuanto exista producción real o más de un mantenedor: entonces será obligatorio un revisor de identidad distinta al solicitante. Detalle en `ARCHITECT_BACKLOG.md`.
- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- Migraciones raíz carecen de manifiesto único (ver propuesta en ADR-0011).
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Decisiones del Director — Época 1 (2026-08-02)

Los siete ADR de Época 1 quedaron **aceptados** el mismo día que se redactaron:

| ADR | Resuelve | Decisión |
|---|---|---|
| `ADR-0006` | ARC-001 | Matriz de riesgo N0–N3 aceptada. `run_migration` no se retira del catálogo, pero pasa a capacidad administrativa, fuera del alcance autónomo, sujeta a autorización explícita en cada uso. Desbloquea ADR-0004 |
| `ADR-0008` | ARC-003 | Nexo = interpretación A, capa de integración con sistemas externos. No es Motor de Decisión ni multiagente. Desbloquea F-2.2 |
| `ADR-0009` | ARC-004 | QA en tres niveles (determinista, revisión humana asíncrona, explicabilidad); explicabilidad queda como deuda hasta F-4.1, sin bloquear nada mientras tanto |
| `ADR-0010` | ARC-006 | Catálogo de tools: `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool, migración incremental, un registro por worker |
| `ADR-0011` | ARC-011 fase 3 | Aceptado **como estrategia**: migrador por vertical (empieza por `checklists`), manifiesto versionado. La implementación sigue el ritmo del roadmap; cada aplicación real contra D1 sigue exigiendo autorización aparte (ADR-0007) |
| `ADR-0004` | Motor de Decisión y modos cognitivos | Aceptado como arquitectura objetivo. Cierra **F-1.1** |
| `ADR-0013` | ARC-002 | Aceptado **con modificaciones**: memoria opt-in (hechos declarados, preferencias, procedimientos, correcciones); inferencias solo como candidata pendiente de validación; caducidad 6/12 meses; memoria compartida exige aprobación `encargado`+; supresión real sin versión archivada. D1 vía ADR-0011 |
| `ADR-0014` | ARC-008 | Aceptado **con modificaciones**: tabla `alejandra_trazas` en D1, retención 30/90 días diferenciada, minimización obligatoria, endpoint único en `alejandra-app-api`, `/health` con tres estados. Migración autorizada solo en desarrollo/pruebas |

Consecuencia: ARC-001, ARC-002, ARC-003, ARC-004, ARC-006 y ARC-008 quedan **cerrados** en `ARCHITECT_BACKLOG.md`. Ningún ADR de Época 1 queda `Propuesto`.

## Decisiones aún pendientes del Director

Ninguna decisión de las cuatro planteadas el 2026-08-02 sigue abierta: **P-ARCH-002** aprobada,
**ARC-014** aceptada como riesgo temporal, **ARC-011-FASE3-CHECKLISTS** (paso 2) y **`F-0.2-CFG`**
pospuestas hasta una fase de preproducción/producción estable. Detalle de cada una en `TASKS.md`
y `ARCHITECT_BACKLOG.md`.

## Época 1 — Núcleo Cognitivo (iniciada 2026-08-02)

**ADR-0004 aceptado** como arquitectura objetivo del Motor de Decisión. Cierra **F-1.1**.
Con ARC-001/002/003/004/006/008 cerrados, no queda ningún ADR de Época 1 propuesto que
bloquee el diseño del núcleo cognitivo.

**F-1.2 iniciada con esqueleto y contratos, ampliada el 2026-08-02.**
`nucleo-cognitivo/` es un paquete nuevo, aislado de `worker.js` y `alejandra-agente/worker.js`
— no se integra en producción. Incluye Estado Cognitivo (efímero, sin persistencia), Policy
Engine (clasificación de riesgo N0–N3 de ADR-0006, sin acceso a sesión real), y las interfaces
de Context Engine, Planner y Motor de Decisión (forma de datos definida, sin implementación
real). **Con ADR-0013 y ADR-0014 aceptados**, el esqueleto se amplió (PR #20) con la interfaz
`memory.js` (contrato de ADR-0013, sección 8) y el contrato inyectable `registrarTraza()` en
`motor-decision.js` (contrato de ADR-0014, sección 5) — ambos como interfaces sin persistencia
real todavía, mismo patrón que el resto del paquete; 20 pruebas en verde. Nexo, Capability/Tool
Registry, Verifier y QA siguen fuera de este entregable — pertenecen a F-1.3/F-2.2, no
abiertas. Las 5 «Decisiones abiertas» de `docs/architecture/04-MOTOR-DE-DECISION.md` siguen sin
resolver, para cuando F-1.2 tenga contexto concreto con el que decidirlas.

**ARC-008-TRAZAS-MIGRACION — completada y verificada (2026-08-02).** La tabla `alejandra_trazas`
(ADR-0014 §1) se aplicó contra `alejandra-db` (run `30746110357`), con export previo del estado
completo de la base (8,1 MB, en local) y validación posterior contra el esquema real: la tabla
y sus dos índices (`idx_trazas_ts`, `idx_trazas_tipo`) coinciden exactamente con lo declarado.
Ningún Worker escribe en ella todavía — la implementación de `registrarTraza()` por Worker y el
endpoint `GET /admin/trazas` son trabajo aparte, fuera del núcleo aislado.

## ARC-011 fase 3 — verificación de DDL silenciado y tercer vertical (2026-08-03)

**Segunda ronda de verificación de DDL silenciado, sin bugs nuevos.** Tras el 100% de acierto
de ARC-012 (3/3 columnas ausentes), se verificaron contra D1 real (autorizado por el Director,
solo metadatos) las 15 columnas/tabla restantes del inventario original: `reset_tokens` ×2,
`login_attempts.email`, `auth_nonces`, `partes_trabajo` ×2, `fotos_obra` ×2,
`escaneos_remotos.num_albaran`, y los 4 `departamento` restantes (`tareas_obra`,
`actas_reunion` ×2, `control_calidad`, `punch_list`). **Las 15 están presentes** — a diferencia
de ARC-012, esta ronda no encontró bugs activos. De paso se corrigió el estado desactualizado
de ARC-013 en `ARCHITECT_BACKLOG.md` (decía "pendiente de despliegue"; está desplegado desde
el 2026-08-02 y su dependencia de ARC-008 ya se cerró). Detalle en
`docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`.

**Tercer vertical completo: `calidad`.** `migrate_calidad.sql` declara `control_calidad`
(NEW-37) y `punch_list` (NEW-44), reutilizando el esquema ya verificado en la ronda anterior
(17 columnas cada una, incluida `departamento` incorporada al `CREATE`). Ciclo de 5 pasos
cerrado el mismo día (2026-08-03): aplicada contra D1 (run `30790988608`, no-op confirmado),
DDL en runtime retirado (`ensureCalidadTable()`/`ensurePunchListTable()`), verificado en
producción tras desplegar `worker.js` (run `30791398680`, versión `d26261b6-...`, `/health`
healthy, 17 columnas de cada tabla presentes). Tercer vertical con el ciclo completo, tras
`checklists` y `rfis`. Ver `TASKS.md` (`ARC-011-FASE3-CALIDAD`).

**Cuarto y quinto vertical completos: `tareas_obra` y `actas_reunion` — primer lote agrupado.**
Tras la observación del Director sobre el coste operativo de desplegar una vez por vertical, se
aplicaron ambas migraciones por separado (autorización propia cada una: `tareas_obra` run
`30798028360`, `actas_reunion` run `30798043436`), se retiró el DDL en runtime de las dos
(`ensureTareasObraTable()`/`ensureActasTable()`) y se verificaron **en un único despliegue**
de `worker.js` (run `30799296203`, versión `ae5317c5-ecaa-4471-8cb6-3297c8057e56`, `/health`
healthy, 16 columnas de `tareas_obra` y 23 de `actas_reunion` presentes). Mismo ciclo de 5
pasos de ADR-0011, misma barrera de autorización por migración D1 — solo se agrupó el paso 4.
Ver `TASKS.md` (`ARC-011-FASE3-TAREAS`, `ARC-011-FASE3-ACTAS`).

**Sexto, séptimo y octavo vertical completos: `ordenes_cambio`, `ordenes_compra`+`oc_lineas` y
`proveedores_gestion` — segundo lote agrupado.** Mismo patrón: tres migraciones aplicadas por
separado (`ordenes_cambio` run `30805220909`, `ordenes_compra` run `30805238082`,
`proveedores_gestion` run `30805254063`), DDL en runtime retirado de las tres
(`ensureOrdenesCambioTable()`/`ensureOcTable()`/`ensureProveedoresGestionTable()`) y verificadas
**en un único despliegue** (run `30806109041`, versión `1475c65b-d1b2-4db1-be3f-8f8b45386e00`,
`/health` healthy, 17+15+8+23 columnas presentes). **Ocho verticales de ARC-011 fase 3
completos en total.** Ver `TASKS.md` (`ARC-011-FASE3-OC-PROVEEDORES`).

**Nota operativa (2026-08-03):** el Director señaló que se estaban acumulando demasiados
despliegues seguidos en poco tiempo (5 despliegues del Worker raíz en menos de 14 horas). Los
siguientes lotes de ARC-011 fase 3 deben espaciarse más en el tiempo y agrupar más verticales
por despliegue de lo que se ha hecho hasta ahora (2-3 por lote).

**Tercer lote agrupado, paso 1 completo (2026-08-03, PR #70):** las 23 tablas restantes del
inventario original de ARC-011 que solo existían en código (patrón lazy) quedaron declaradas
en 6 verticales por dominio: `planificacion_produccion`, `finanzas_obra`,
`seguridad_cumplimiento`, `relaciones_obra`, `flota` y `nexus_experts` (este último aparte,
dominio distinto sin tenant, creado dentro de `runMigrations()` en vez de una función
`ensureXxxTable()`). Verificado verbatim contra `worker.js` línea por línea y, contra D1 real
(solo lectura), que ninguna de las 23 tablas existe todavía en producción — a diferencia de
los ocho verticales anteriores, el paso 2 de este lote no será un no-op. Ver `TASKS.md`
(`ARC-011-FASE3-LOTE3`). Misma sesión: **ARC-014 revisado sin cambios** (el Director confirmó
que ninguna condición de reapertura cambió) y **F-0.2-CFG** — el Director pidió mover los
secretos directamente ("muévelos tú"); se declinó por ser una acción prohibida para cualquier
agente (CLAUDE.md, reglas globales de seguridad de la sesión), sigue como tarea personal suya.

## Siguiente objetivo

ADR-0014 queda implementado de extremo a extremo (interfaz en `nucleo-cognitivo/`, tabla D1,
`registrarTraza()` real, `/health` de tres estados, `GET /admin/trazas`, todo desplegado y
verificado). **El healthcheck automático post-despliegue se reincorporó (PR #36):**
`deploy-worker.yml` y `deploy-alejandra-agente.yml` consultan `/health` tras desplegar
(con reintentos), fallan el job si el estado es `unhealthy` o no responde, y dejan una
advertencia visible si es `degraded`, sin bloquear. No sustituye la verificación manual
registrada en el handoff. No queda ningún pendiente de ADR-0014.

**F-1.2 verificada y cerrada (2026-08-02):** sus 6 criterios de aceptación se comprobaron
directamente contra `nucleo-cognitivo/` — `node --check` sobre los módulos y `node --test
nucleo-cognitivo/test/*.js` en verde (20/20). `TASKS.md` describía como pendiente un paso
(`registrarTraza()` real en los Workers) que ya estaba hecho desde PR #24/#25; corregido.

**F-1.3 abierta (2026-08-02)** por `ADR-0007` enmienda 1: sus dependencias (F-1.2, ARC-004,
ARC-006) están cerradas. **Primer entregable completado:** `nucleo-cognitivo/tool-registry.js`
(validación pura del metadato `acceso`/`cron`/`nivel_riesgo` de ADR-0010, `registrarTool`,
`filtrarToolsPorAcceso`, `filtrarToolsParaCron`) y `verifier.js` (nivel determinista real;
revisión humana asíncrona y explicabilidad como interfaces con error explícito, ADR-0009).
33/33 pruebas en verde. Sin migrar el catálogo real de tools de ningún Worker, sin integrarse
en producción.

**Segundo entregable completado (piloto):** `TOOL_CONSULTAR_PERSONAL`
(`alejandra-agente/worker.js`) migrada al formato de ADR-0010 (`acceso:'sesion'`,
`cron:'permitido'`, `nivel_riesgo:'N0'`), sin cambiar comportamiento observable. **Hallazgo
real corregido en el mismo ciclo:** esos objetos se envían tal cual dentro de `body.tools` a
la API de Anthropic (`llamarAnthropic`); sin sanear, el metadato de ADR-0010 habría viajado en
el JSON real de la API. Se extrajo `toolsParaAnthropic()` a `lib.js` (whitelist de
`name`/`description`/`input_schema`/`cache_control`), usada ya en el único punto que construye
`body.tools`, protegiendo también a las tools que se migren después. 114/114 pruebas del
agente en verde (4 nuevas) + 1 nueva en `nucleo-cognitivo` que valida la declaración real
copiada literalmente (sin importar entre paquetes). Los tres `Set` de `lib.js` siguen intactos
— ADR-0010 exige migración incremental hasta que la última tool esté migrada.

**`F-1.3-MIGRAR-RESTO-TOOLS` en curso — lotes 2, 3 y 4 completados (2026-08-02):** lote 2 (8
tools de solo lectura con sesión), lote 3 (7 tools públicas) y **lote 4** (5 tools
`gestionar_*` + `editar_plano`, N1 tras revisar el código de cada `case`: CRUD acotado por
`empresa_id`, una fila por operación). `marcar_plano` resultó ser **N0**, no N1: pese al
nombre, solo analiza con Gemini, sin escritura en D1 — exactamente el caso que exige leer el
código y no clasificar por patrón de nombre. **Bug real corregido de paso:** `gestionar_calidad`
(acción `resolver`) interpolaba `notas_resolucion` directo en el SQL en vez de un parámetro
`?`; corregido sin cambiar comportamiento observable. 117/117 pruebas del agente en verde.
23/103 tools migradas tras el lote 4. **Lote 5 completado (2026-08-02):** 12 tools de solo
lectura más (`descubrir_herramientas`, `recuperar_conversacion`, `leer_estado`,
`consultar_bd`, `listar_archivos`, `ver_archivo`, `consultar_conocimiento`, `ram_read`,
`github_listar`, `github_leer`, `github_buscar`, `grep_codigo`), verificando que ninguna
escribe (las 4 de GitHub comparten `case` con `github_escribir`/`patch_codigo`, que sí
escriben). 118/118 pruebas del agente en verde. 35/103 tools migradas tras el lote 5.

**Lote 6 completado (2026-08-02)** — las 10 tools administrativas más sensibles hasta ahora:
`ejecutar_deploy` (**N3**, literalmente "despliegue" per ADR-0006); `github_escribir`,
`patch_codigo`, `rollback`, `test_endpoint`, `nexus_manage` (**N2**, cambian código/historia
de git/config de enrutamiento en vivo o pueden invocar cualquier endpoint propio);
`escribir_bd` (**N2**, ya exige "CONFIRMO BORRADO" del humano en el propio código para
DELETE/UPDATE masivo — coincide textualmente con la definición de N2 de ADR-0006);
`verificar_deploy`/`configurar_alerta` (**N1**); `validar_cambios_bd` (**N0**, solo `SELECT`).
`acceso`/`cron` de cada una copian su membresía real en los tres `Set` de `lib.js`. 119/119
pruebas en verde. 45/103 tools migradas tras el lote 6.

**Lote 7 completado (2026-08-02):** `enviar_email`/`enviar_telegram_informe` (**N2**, salen
literalmente de la organización, el ejemplo textual de ADR-0006); `enviar_push`,
`iniciar_conversacion`, `controlar_app` (**N1**, se quedan dentro del ecosistema propio de la
app vía FCM/comandos acotados por `puedeNotificarUsuario`); `generar_informe`, `subir_archivo`,
`ram_save`, `ram_clear` (**N1**). 120/120 pruebas en verde. 54/103 tools migradas tras el lote 7.

**Lote 8 completado (2026-08-02) — CATÁLOGO DEL AGENTE COMPLETO.** Último lote:
`analizar_foto_obra`/`listar_esquemas`/`estado_obra` (**N0**); `generar_esquema_electrico`,
`borrar_esquema`, `generar_plano`, `generar_grafico`, `preguntar_usuario`, `generar_documento`,
`historico_materiales` (**N1**); `exportar_datos` (**N2** — exporta sin `LIMIT`, incluye PII
de personal, sin gate de confirmación humana todavía, anotado como pendiente). 121/121
pruebas en verde. **69/69 tools de `alejandra-agente/worker.js` migradas**
(`memory_save`/`memory_read`/`propose_mejora`/`tomar_decision` deliberadamente excluidas,
dominio ADR-0013).

**`F-1.3-MIGRAR-RESTO-TOOLS` completada (2026-08-02) — catálogo de `worker.js` raíz también
migrado.** 31/34 tools (`memory_save`/`memory_read`/`memory_delete` excluidas, mismo motivo).
Este catálogo es enteramente `acceso:'dev_verificado'`: `executeAITool()` solo se alcanza hoy
desde canales ya restringidos a Adrián (comentario propio del código, verificado antes de
delegar). Trabajo repartido en dos agentes en paralelo (worktrees aislados, sin tocar el mismo
tool) más 8 tools administrativas de más riesgo revisadas directamente: `sql_query`,
`run_migration` (**N3**, mandato explícito de ADR-0006/0010), `direct_fix`, `manage_user`,
`repo_write_file`, `propose_fix`, `self_audit`, `r2_delete`.

**Hallazgo real corregido de paso, el más relevante de la tarea:** `direct_fix` y
`repo_write_file` afirmaban en su `description` (visible al propio modelo, no solo al humano)
y en su mensaje de retorno que un commit se despliega automáticamente a Cloudflare/Pages en
~1 min/~30s — **falso desde F-0.1/ADR-0001** (2026-08-02): ningún workflow se dispara por push
a `main`, el despliegue exige `workflow_dispatch` manual con confirmación y aprobación del
entorno `production`. Sin corregir, esto podía hacer que Alejandra creyera (o le dijera a
Adrián) que un fix ya estaba en producción cuando solo estaba commiteado — el mismo patrón de
"estado percibido ≠ estado real" que ya causó los incidentes de recarga infinita del 22/04 y
26/04. Corregido en ambas tools.

**Hallazgo anotado, sin resolver (candidato a ADR aparte):** `sql_query` permite DDL
(`CREATE`/`ALTER`/`DROP`), con la misma barrera humana (`CONFIRMO BORRADO`) que `run_migration`,
pero sin la distinción N3 explícita que ADR-0006 sí le da a `run_migration` por su capacidad de
alterar el esquema. No se cambió su comportamiento en esta tarea, solo se documentó.

**96/103 tools totales con metadato ADR-0010** (65 en el agente + 31 en `worker.js` raíz); 7
excluidas a propósito (dominio ADR-0013). Ninguna migración cambia comportamiento observable —
los `Set`/gates existentes en cada Worker siguen siendo la fuente de verdad hasta que se
decida retirarlos. **No queda ninguna tarea activa de ingeniería sin decisión del Director
pendiente** (`F-0.2-CFG` y `ARC-011-FASE3-CHECKLISTS` paso 2 siguen pospuestas).

En paralelo, ARC-011 fase 3 (ADR-0011) sigue con su paso 1 completo (`migrate_checklists.sql`);
aplicarla contra D1 sigue requiriendo autorización del Director. `F-0.2-CFG` y `ARC-014` siguen
esperando decisión del Director, sin relación con el núcleo cognitivo.

## Época 2 — Conocimiento y Memoria (abierta 2026-08-02)

Con F-1.1, F-1.2 y F-1.3 completas, **la Época 1 queda cerrada**. Por `ADR-0007` enmienda 1
(apertura autónoma de fase cuando dependencias y ADR están cerrados), se abre **F-2.1**
(gobierno de memoria): sus dependencias (F-1.1, ARC-002) están cerradas y su modelo ya fue
aceptado por el Director en `ADR-0013` (con modificaciones), el mismo día.

**Primer entregable completado:** `migrate_memoria_gobernada.sql` declara (paso 1 de
ADR-0011, sin aplicar) la tabla `memoria_gobernada`, nueva y sin relación con la tabla legada
`alejandra_memoria` (usada hoy por `memory_save`/`memory_read`, dominio excluido a propósito
del catálogo ADR-0010). Las columnas cubren los siete elementos del contrato de ADR-0013:
aislamiento por `empresa_id`/`ambito`, procedencia (`origen`/`metodo`/`tarea_id`), `confianza`,
`caduca_en`, corrección versionada (`version_anterior_id`/`estado`) y `aprobada_por`. Registrada
en `migrate_manifiesto.json` como `aplicada: false`. Aplicarla contra D1 exige autorización
explícita del Director, igual que `checklists` — ver `TASKS.md` (`F-2.1-MEMORIA-DECLARAR`).

**ARC-008 §8 resuelto, paso 3 en curso (2026-08-02).** El bloqueo que impedía activar
`nucleo-cognitivo/src/memory.js` era la falta de trazabilidad completa de una decisión que
consulta memoria (ADR-0013 §8). Resuelto: `consultarMemoria()` real en los dos Workers lee
`memoria_gobernada` (empresa/categoría/ámbito/confianza, solo `confirmada` y no caducada) y
registra una traza `memoria_consulta` con los recuerdos exactos devueltos — la cadena
"decisión → consulta de memoria → recuerdos usados" queda completa en `alejandra_trazas`.
`listarCandidatasPendientes()`, `confirmarCandidata()` (traza `memoria_confirmacion`) y
`rechazarCandidata()` completan el CRUD sobre `memoria_gobernada` en ambos Workers. **Nada de
esto se expone todavía vía ninguna ruta ni tool** — son funciones internas listas para que una
tool futura las use, siguiendo la regla de "UNA Alejandra, DOS cerebros" (implementación
idéntica en los dos Workers). `nucleo-cognitivo/src/memory.js` pasa de lanzar error a aceptar
las cuatro funciones como dependencia inyectada (`inyectarMemoria()`), mismo patrón que
`registrarTraza()` en `motor-decision.js`; sin inyección devuelve `[]`/no-op. **Ninguno de los
dos Workers importa `nucleo-cognitivo/` todavía** — sigue prohibido por `CLAUDE.md`. 36/36
pruebas en verde en `nucleo-cognitivo`.

**`memoria_consultar` — primera tool de lectura sobre memoria gobernada, aprobada por el
Director (2026-08-02, "Opción A").** Solo lectura, `nivel_riesgo:'N0'`, `acceso:'sesion'`,
expuesta únicamente en `alejandra-agente/worker.js` (decisión consciente: el catálogo de
`worker.js` raíz es enteramente `dev_verificado`). `empresa_id` sale de la sesión, nunca del
input del modelo; `categoria` se valida contra la lista blanca de ADR-0013 §1 antes de tocar
la BD; nunca devuelve candidatas, caducadas ni memoria de otra empresa. Las tools legadas
`memory_save`/`memory_read` (tabla `alejandra_memoria`) quedan intactas — coexistencia
documentada en `HANDOFF.md`. La construcción del SQL se extrajo a
`construirConsultaMemoriaGobernada()` (`alejandra-agente/lib.js`), función pura con 15 pruebas
nuevas (aislamiento por tenant, caducidad, confianza, ausencia de resultados cruzados).
136/136 pruebas en `alejandra-agente`, `node --check` limpio en los dos Workers y en `lib.js`.
**Escritura sobre `memoria_gobernada` (candidatas, confirmación) queda pendiente de una
decisión específica posterior del Director** — no forma parte de este entregable.

## Arquitectura de presentación

`ADR-0012` fue aceptado el 2026-08-02. La arquitectura vigente
`docs/architecture/FRONTEND_ARCHITECTURE.md` define aplicaciones, features, sistema de diseño
y clientes API. P-ARCH-001 (indicador de salud) fue aprobado. **P-ARCH-002 (componente
compartido de notificaciones temporales) fue aprobado por el Director el 2026-08-02** — su
evidencia está en `docs/architecture/FRONTEND_SLICE_TOAST.md`. No es dependencia del Núcleo
Cognitivo y avanza en paralelo con backend/motor de decisión. Con P-ARCH-002 cerrada, queda
desbloqueada la siguiente rebanada de presentación (aún sin definir ni abrir).
