# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-08-02
- Estado: F-0.1 **integrada y activa en remoto**. ARC-011 fases 1 y 2 completadas; ARC-012 resuelto con tres migraciones aplicadas y verificadas.

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

## Estado de despliegue (2026-08-02)

**Los dos Workers están desplegados y respondiendo** (`HTTP 200` verificado): `alejandra-app-api` versión `29d48103` (deployment id de Cloudflare), `alejandra-agente` versión `6f220f61`. Llevan ARC-013, ARC-015, ARC-016, ARC-017 y ahora ADR-0014 (`registrarTraza`, `/health` real de tres estados, `GET /admin/trazas`) en producción.

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
dominio ADR-0013). **65/103 tools totales migradas**; quedan 34 en `worker.js` raíz, con
gating independiente (regla de los dos cerebros).

En paralelo, ARC-011 fase 3 (ADR-0011) sigue con su paso 1 completo (`migrate_checklists.sql`);
aplicarla contra D1 sigue requiriendo autorización del Director. `F-0.2-CFG` y `ARC-014` siguen
esperando decisión del Director, sin relación con el núcleo cognitivo.

## Arquitectura de presentación

`ADR-0012` fue aceptado el 2026-08-02. La arquitectura vigente
`docs/architecture/FRONTEND_ARCHITECTURE.md` define aplicaciones, features, sistema de diseño
y clientes API. P-ARCH-001 (indicador de salud) fue aprobado. **P-ARCH-002 (componente
compartido de notificaciones temporales) fue aprobado por el Director el 2026-08-02** — su
evidencia está en `docs/architecture/FRONTEND_SLICE_TOAST.md`. No es dependencia del Núcleo
Cognitivo y avanza en paralelo con backend/motor de decisión. Con P-ARCH-002 cerrada, queda
desbloqueada la siguiente rebanada de presentación (aún sin definir ni abrir).
