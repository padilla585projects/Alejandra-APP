# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

**ADR-0023, ampliación para usuarios sin Telegram (2026-09-03, noche, continuación 2):** aviso
por push y pantalla "Pendientes de aprobar" en la app móvil (Ajustes → Sesión), v9.31,
desplegado. **Verificado en vivo (Chrome real de Adrián, app móvil `index.html` 9.31 con su sesión):** la sección aparece en Ajustes → Sesión con el historial; petición por chat desde la app (`usuario_id` = nombre, el agente resuelve el id real por el token) → `enviar_gmail` PENDIENTE (`C84FA9`) → la sección muestra la acción con badge 1 y botones → clic real en Aprobar (con `confirm()` auto-aceptado solo en la prueba) → fila #6 `aprobada` → cron a las 12:45:05 UTC → `ejecutada`, `resultado='ok'` → correo "Prueba ADR-0023 app movil" en la bandeja real (conector de Gmail, fecha 2026-09-03T12:45:05Z). Matiz anotado: la aprobación desde la app queda con `canal_decision='panel'` (endpoint compartido; distinguir `app` sería un cambio menor). El push a Adrián se envió (tiene token FCM en `alejandra_memoria`) pero no se pudo observar desde aquí: pendiente de que Adrián confirme si le llegó al móvil. Ver `CHANGELOG.md`/`HANDOFF.md`.

**ADR-0023 cerrado del todo (2026-09-03, noche, continuación):** canal Telegram y envío real
verificados con el usuario real de Adrián desde su Chrome (botón Aprobar → cron → correo en
su bandeja, comprobado con su conector de Gmail). De paso, dos bugs reales de producción en
`worker.js` raíz corregidos: la Alejandra dev de Telegram respondía siempre con error de API
(metadato ADR-0010 enviado a Anthropic) y la vinculación de Telegram no funcionaba (ruta del
webhook + rama dev antes que `/start`). Ver `HANDOFF.md`/`CHANGELOG.md`.

**ADR-0023 en producción y verificado (2026-09-03, noche):** migración autorizada y aplicada,
los dos Workers y Pages (9.30) desplegados, canales chat y panel + caducidad + idempotencia
verificados contra D1 real con el usuario de prueba. Fix de paso al prompt del ayudante
"correos". **Pendiente de Adrián:** vincular Telegram y probar botón + envío real. Ver
`TASKS.md`/`HANDOFF.md`.

**ADR-0023 aceptado e implementado en código (2026-09-03, tarde):** Adrián aceptó las seis
recomendaciones tal cual. Cola `acciones_pendientes` + aprobación por chat/Telegram/panel +
ejecutor único en el cron `*/5`, piloto `enviar_gmail`/`programar_correo`; los dos
manejadores del webhook de Telegram del raíz ya delegan en uno solo. **Pendiente y
bloqueado en decisión humana:** aplicar la migración D1 (autorización explícita), después
desplegar y verificar en vivo. Ver `TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`.

**ADR-0023 redactado, Propuesto (2026-09-03):** revisión humana asíncrona real para N2 —
cola `acciones_pendientes` en D1, aprobación por chat/Telegram/panel, ejecutor en el cron
`*/5` existente, piloto `enviar_gmail`/`programar_correo`. Pendiente de decisión del
Director (seis preguntas con recomendación en el ADR); no se toca código ni D1 hasta que
sea Aceptado. Hallazgo lateral por verificar: el webhook de Telegram registrado por el
código no atiende los botones de `alejandra_fixes` (`ARCHITECT_BACKLOG.md`, ARC-020).

**TAREAS-PROGRAMADAS-01, cerrada del todo (2026-09-03):** Alejandra programa correos y
recordatorios a hora exacta (tools en `alejandra-agente/worker.js`, cron de 5 min, tabla
`tareas_programadas`, endpoints en `worker.js`, pantalla "🕐 Mis Tareas Programadas" con
formulario "+ Nueva tarea" en `panel.html`, v9.29). El cron chocó con el límite de 5
cron triggers por cuenta de Workers Free; Adrián liberó el de `apex-worker`. Verificando
en vivo se arregló un bug real (token push no encontrado en recordatorios) y quedó
demostrado que el `CONFIRMO ENVIO` por chat es frágil en turnos largos — de ahí el
formulario directo. El 2026-09-03 Adrián confirmó que el correo programado de prueba llegó
a su bandeja real. Sin pendientes. Detalle en `PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`.

**GESTION-AUTO-CORREOS-01, cerrada de verdad (2026-09-01):** Adrián pidió que Alejandra
"administre completamente el correo" — alcance acotado con `AskUserQuestion` (enviar sigue
exigiendo confirmación humana; categorizar/archivar/marcar leído automático en cada
sincronización, sin borrar). Verificando en vivo aparecieron y se arreglaron **tres bugs
reales encadenados**: un enrutamiento erróneo por una regex ambigua ("bandeja" de cableado
vs. "bandeja" de correo) que dejaba inalcanzable el ayudante de Correos y llevó al modelo a
**inventarse correos ficticios 3 veces** (detectado por el propio modelo); `leer_gmail` sin
el id real de cada correo (causaba 404 siempre en `categorizar_correos`); y el ayudante
parándose a narrar en vez de ejecutar la tool. Verificado de extremo a extremo consultando
el estado real en D1 (no el texto del chat): 5/5 correos gestionados, categorías
coherentes. Detalle en `PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`.

**CORREOS-PANEL-01, cerrada de verdad (2026-08-31):** el Gmail real de Adrián estaba con el
token OAuth2 revocado; de paso se encontró y arregló un bug real (`GMAIL_OAUTH_SCOPES` sin
scope de email, causaba el "(sin email)" y rompía la deduplicación de cuentas). Tras el fix
y que Adrián reconectara, verificado de extremo a extremo con Claude in Chrome leyendo el
cuerpo real de las respuestas: sincronización real (`nuevos:5`) y "Organizar con Alejandra"
devolviendo un resumen real con datos concretos de sus correos. Detalle en
`PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`.

**CORREOS-PANEL-01 completada, desplegada y verificada (2026-08-17):** panel de correos por
usuario en `panel.html` (sincroniza Gmail real, categoriza dentro de la app, redacta/envía),
planificado con `EnterPlanMode` antes de tocar código. De paso, `BUGFIX-CACHE-PROMPT-01`
(bug real de caché de prompts + fuga parcial de detalle técnico en `delegar_tarea`,
encontrado corrigiendo un diagnóstico erróneo de la propia Alejandra) y dos pendientes
antiguos cerrados (informe de fichajes imprimible, Almacén viendo material de todos los
departamentos en el móvil). Detalle en `PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`.

**Expansión de Correos + TELECOM-NAV-01, desplegadas y verificadas (2026-08-17, misma
sesión):** a raíz de pruebas en vivo de Adrián sobre el panel de Correos — borrar, selección
múltiple, adjuntos, varias cuentas de Gmail con cambio rápido, avisos para las dos cuentas,
y dos bugs reales de producción corregidos (botón "Enviar" mal etiquetado, crash al adjuntar
archivos grandes). Después, a raíz de "arregla esto" sobre un modal de Racks/Cableado:
`TELECOM-NAV-01` — modales sin padding interior y un auto-refresh de 60s que devolvía al
usuario a la lista de IDFs al guardar un puerto en vez de a la vista de Puertos de la que
venía. Sin pendientes de esta ronda. Detalle en
`PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`/`CHANGELOG.md`.

**TELECOM-NAV-01, hardening antes de datos reales (2026-08-17, noche):** Adrián: "vamos a
empezar a meter datos de verdad y no puede fallar" — auditoría completa del módulo (backend
+ los dos frontends). Cerrada una brecha real: el backend permitía borrar por API a
cualquier usuario de telecom aunque ambos frontends ya restringían el botón a roles
responsables. Nombre y campos de puerto sin límite de longitud, alineados. Confirmación de
borrado con conteo de puertos ocupados. Verificado en producción con un usuario de prueba
real. Sin pendientes.

**TELECOM-NAV-01, toque profesional (2026-08-17, noche):** flujo completo crear
IDF→Rack→Módulo→Puerto verificado en vivo en los dos frontends (navegación correcta en
cada guardado). Mejoras visuales pedidas por Adrián: conteos por nivel, iconos por tipo de
módulo, breadcrumb con ruta completa, celdas de puerto de tamaño fijo en el informe (antes
enormes en páginas anchas). Verificado en producción, sin pendientes.

**Informe Semanal de Seguridad, ronda completa (2026-08-17, noche):** título del topbar
roto en 3 líneas y solapado con el contenido (fix global); botón "✏️ Plantilla" que nunca
abría el modal (`GET /mi-empresa` sin `ok:true`); tres huecos de paridad app/panel
cerrados en Office (iniciar informe de semana nueva, editar actividad, añadir foto extra);
pie de foto con título en `.docx`/impresión (migración D1: `informes_seg_fotos.titulo`).
Verificado en producción con un informe completo de prueba, sin pendientes.

**OBRA-AUTO-01 (2026-08-17, noche):** "las obras se deben de detectar solas en el panel
no? los usuarios ya tienen obras asignadas" — `GET /obras` da 403 a encargado/operario a
propósito, pero `cargarObrasPanel()` no lo manejaba con gracia y dejaba 130+ selectores de
obra del panel vacíos para estos roles (y rompía un mecanismo que ya ocultaba 4 selectores
especiales). Arreglado y extendido a la función genérica compartida. Verificado con un
usuario de prueba por rol, sin pendientes.

**Correos — marcar leídos en bloque (2026-08-17, noche):** "porque no ahí la opción de
marcar como leídos" / "entonces nunca se quita las notificaciones" — nuevo botón en la
barra de selección múltiple de "Mis Correos". Verificado en producción, sin pendientes.

**Sondas CPD (2026-08-17, noche):** mismo patrón de bug que Telecom (padding-cero en
modales + auto-refresh que sacaba al usuario del plano en el que trabajaba). Además,
plano sin ancho máximo artificial y controles de zoom para colocar sondas con precisión.
Verificado en producción, sin pendientes.

**Muñeco de EPIs (2026-08-17, noche):** el color de estado pintaba el relleno de cada
prenda (chaleco "ok" salía verde en vez de naranja/amarillo, botas "ok" salían verdes en
vez de negras/grises) — ahora el relleno usa el color real del EPI y el estado va en el
borde. Mismo fix en los dos frontends. Verificado en producción, sin pendientes.

**Repaso guiado de la app completado, desplegado y verificado (2026-08-13/14):** sesión larga
junto a Adrián — 4 bugs reales en `panel.html` (Documentos, dashboard, feedback del chat de
Alejandra, botón de scan remoto), compatibilidad con la plataforma CAE externa Nalanda
(`COMPAT-CAE-01`, puente manual — no tienen API pública), repaso departamento por departamento
del menú de `index.html` contra la curación ya existente en `panel.html`
(`APP-REPASO-DEPARTAMENTOS-01`), y una ronda de mejoras al Informe Semanal de Seguridad a raíz
de que una técnica real no entendía el flujo (`INFORMES-SEG-CIERRE-01`: navegar semanas,
editar actividades, cerrar/generar el documento también desde el móvil, crear/borrar informes
enteros desde Office). Pendientes explícitos: Almacén viendo material de otros departamentos
desde el móvil; plantilla del documento final del Informe Semanal editable por el usuario.
Detalle en `PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`.

**BOTONES-FEEDBACK-01 completada, desplegada y verificada (2026-08-13, tarde):** ~95 botones
"Guardar" sin feedback visual en los tres frontends, corregidos con un helper `conBoton()`
por archivo; de paso, corregido por separado un bug crítico de pérdida silenciosa de datos en
`apiCall()` (24 llamadas, 7 módulos, ~7 semanas en producción). Sin pendientes. Detalle en
`PROJECT_STATE.md`/`HANDOFF.md`/`TASKS.md`.

Foundation v0.1 aprobada. **F-0.1 activa en producción desde el 2026-08-02** (PR #9): workflows
antiguos retirados, `main` protegida, entorno `production` con revisor requerido. **F-0.2-CFG
completada (2026-08-04):** secretos ya movidos al entorno `production`, ensayo de confirmación
errónea probado (`skipped`), política de rama de `github-pages` ampliada a tags. Detalle en
`docs/runbooks/CI-CD-Y-MIGRACIONES.md`. Healthcheck automático post-despliegue reincorporado
(PR #36).

**ARC-011 fases 1-2 verificadas** (PR #10); **ARC-012 resuelto** (PR #11); **ARC-013, 015, 016,
017 corregidos, desplegados y verificados en producción.** **ARC-011 fase 3 completa: las 14
verticales tienen el ciclo de 5 pasos de ADR-0011 cerrado** (declarar, aplicar, retirar DDL en
runtime, verificar en producción, registrar en manifiesto) — no queda ninguna tarea de
ingeniería activa de ARC-011. **ARC-018 resuelto** (worker/bucket R2 huérfanos borrados).
**ARC-014**: riesgo aceptado temporalmente por el Director mientras haya un único mantenedor,
revisado sin cambios el 2026-08-03. **ARC-019 resuelto** (`ADR-0015` aceptado e implementado el
2026-08-04): `sql_query` sube a N3; `CREATE TABLE`/`CREATE INDEX` exige confirmación humana
(`CONFIRMO MIGRACION <código>`) en `sql_query`/`run_migration`, desplegado y verificado.

**F-0.2 completada** (2026-08-02): catálogo de rutas, CI de calidad y auditoría remota de
Cloudflare.

**Los ocho ADR de Época 1 aceptados** (2026-08-02): `ADR-0004`, `ADR-0006`, `ADR-0008`,
`ADR-0009`, `ADR-0010`, `ADR-0011` (como estrategia), `ADR-0013` y `ADR-0014` (estos dos con
modificaciones). Ningún ADR de Época 1 queda `Propuesto`. Cierran ARC-001, ARC-002, ARC-003,
ARC-004, ARC-006 y ARC-008, y con `ADR-0004` se cierra **F-1.1**.

**F-1.2 completada y verificada** (2026-08-02): `nucleo-cognitivo/`, paquete aislado con Estado
Cognitivo, Policy Engine, interfaces de Context Engine/Planner/Motor de Decisión, `memory.js`
(ADR-0013) y el contrato `registrarTraza()` (ADR-0014). `registrarTraza()` real, `/health` de
tres estados y `GET /admin/trazas` ya están desplegados en producción (ADR-0014, fuera del
paquete aislado, en cada Worker). **Excepción acotada por ADR-0020 (2026-08-06):** el adaptador
del Worker IA usa `decidirInvocacionPilotoN0()` para tools N0 ofrecidas y el rechazo de tools no
ofrecidas; no integra Context Engine, Planner, memoria propia ni los flujos N1–N3. PR #98
desplegada y verificada por el run 31089065117 (`/health` manual: `healthy`, D1/R2 disponibles).

**F-1.3 completada** (2026-08-02): Tool Registry (ADR-0010) y Verifier (ADR-0009) migrados a
todo el catálogo real de tools de los dos Workers (96/103, 7 excluidas a propósito). Cierra la
Época 1 completa.

**Época 2 (gobierno de memoria) — lectura y escritura completas y desplegadas.** Esquema
`memoria_gobernada` aplicado (ADR-0013). Lectura: `memoria_consultar` (N0, solo
`alejandra-agente`). **Escritura, decisión del Director (2026-08-04, "Exponer como tools
nuevas"):** `memoria_listar_pendientes` (N0), `memoria_confirmar_candidata`/
`memoria_rechazar_candidata` (N1, excluidas del cron), gate de rol `encargado`+, desplegadas y
verificadas en producción (PR #81). `memory.js` de `nucleo-cognitivo/` sigue sin persistencia
propia (la real vive en cada Worker), y el paquete sigue sin integrarse en ningún Worker.

**Presentación:** `ADR-0012` aceptado. P-ARCH-001 y P-ARCH-002 aprobados. **P-ARCH-003**
(consulta de versión remota compartida, `packages/design-system`) implementada, fusionada y
**publicada en Pages (2026-08-04)**. Queda sin definir ni abrir la siguiente rebanada.

No queda ninguna tarea de ingeniería activa sin decisión del Director pendiente.

**Migraciones D1 aplicadas (2026-08-02):** el Director autorizó en chat el paso 2 de
`migrate_checklists.sql` (ARC-011 fase 3) y `migrate_memoria_gobernada.sql` (F-2.1), sobre la
única D1 existente. Ambas verificadas columna por columna antes y después; ver `HANDOFF.md` y
`migrate_manifiesto.json`. **Vertical `checklists` completo:** el ciclo de 5 pasos de
ADR-0011 quedó cerrado el mismo día (DDL en runtime retirado, `worker.js` desplegado y
verificado en producción sin él) — plantilla probada para el próximo vertical.

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

**(2026-08-12, noche)** F-6.1 (ayudantes de Pedidos y Correos) verificado en vivo en
producción — cadena de bugs reales encontrados y corregidos en la propia verificación
(enrutamiento del clasificador, prompt del ayudante inventando capacidades/pidiendo
credenciales, fuga de detalle técnico a usuarios sin privilegio, scroll del chat). Detalle
completo en `PROJECT_STATE.md`/`TASKS.md`/`CHANGELOG.md`. **Único pendiente real:** el
Director habilita la Gmail API en el proyecto de Google Cloud correcto — paso manual, en
curso; tras eso, repetir la prueba de envío con `CONFIRMO ENVIO`.

Con `F-0.2-CFG`, las 14 verticales de ARC-011 fase 3, la escritura de `memoria_gobernada`
(F-2.1), `P-ARCH-003` y `ADR-0015`/ARC-019 cerrados y desplegados, **no queda ninguna otra
tarea de ingeniería activa fuera de lo anterior.** Lo demás abierto son decisiones exclusivas
del Director:

- **Definir la siguiente rebanada de presentación** tras P-ARCH-003 (aún sin proponer).
- **ARC-014** — revisar si cambian sus condiciones de reapertura (más de un mantenedor o
  producción real).
- **Siguiente rebanada del Motor de Decisión** — analizar las trazas N0 del piloto antes de
  proponerla. Sigue prohibido ampliar la integración a Context Engine, Planner, memoria propia o
  N1–N3 sin una nueva decisión explícita.

No ampliar la integración acotada de ADR-0020 ni activar memoria persistente propia en
`nucleo-cognitivo/`.
