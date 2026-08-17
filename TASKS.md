# TASKS — Cola operativa inmediata

Estado (actualizado 2026-08-17): **CORREOS-PANEL-01 completada, desplegada y verificada —
pendiente solo que Adrián pruebe en vivo la sincronización real con su Gmail** (yo no tengo
su sesión, solo pude probar con la cuenta de prueba sin Gmail conectado). Sesión que empezó
confirmando que la Gmail API ya funciona (F6.1-AYUDANTES-CORREOS cerrado del todo), pidió
un informe de fichajes imprimible y que Almacén viera material de todos los departamentos
desde el móvil (dos pendientes antiguos, ambos cerrados), y terminó con Adrián pegando una
conversación real donde pidió "un panel para correos por usuario, donde alejandra pueda
organizarlos y escribir" — planificado con `EnterPlanMode`/`AskUserQuestion` antes de tocar
código, con dos decisiones explícitas: sin permisos nuevos de Google ("organizar" es una
categoría propia de la app, nunca toca el Gmail real) y pensado desde ya para cualquier
usuario con Gmail conectado, no solo Adrián.

- **BUGFIX-CACHE-PROMPT-01**: al pedirle a Adrián que revisara un correo real de Anthropic
  sobre baja tasa de acierto de caché de prompts, Alejandra le dijo que probablemente
  faltaba `cache_control` en las llamadas — **falso, verificado leyendo el código**: está
  bien aplicado en los dos Workers. La causa real, encontrada al investigar: dentro del
  bucle de iteraciones de `tool_use` de `delegar_tarea`, la primera llamada a
  `llamarAnthropic()` usaba `promptAyudante` (con la regla de `esDevVerificado` añadida en
  `AYUDANTE-DETALLE-TECNICO-01` esta misma sesión) pero las llamadas siguientes del MISMO
  bucle usaban `ayudante.systemPrompt` a secas — contenido de sistema distinto entre la 1ª y
  la 2ª+ llamada de una sola delegación (cache miss garantizado) y, más grave, reabría
  parcialmente la fuga de detalle técnico que cerró esa tarea (a partir de la 2ª vuelta el
  modelo perdía la instrucción de qué puede/no puede revelar). Fix de una línea, 207/207
  tests, desplegado.
- **CORREOS-PANEL-01**: página nueva "📧 Mis Correos" en `panel.html` — sincroniza el Gmail
  real (con caché en D1, `gmail_mensajes_cache`, migración aditiva autorizada), filtra por
  categoría, marca leído/categoriza por correo (dentro de la app, nunca en Gmail real),
  redacta y envía (reutiliza `/internal/gmail/enviar`, ya soportaba sesión real), y
  "Organizar con Alejandra" delega en el chat real. Nueva tool `categorizar_correos` del
  ayudante "correos" (`alejandra-agente/worker.js`). Detalle técnico completo en
  `HANDOFF.md`.
- **CORREOS-PANEL-01 (expansión, 2026-08-17):** a raíz de que Adrián probó el panel en vivo
  — borrar correo (con confirmación), selección múltiple, adjuntos al redactar, varias
  cuentas de Gmail con cambio rápido (`gmail_cuentas`), avisos de correo nuevo para las dos
  cuentas. Dos bugs reales de producción corregidos: botón "Guardar"→"Enviar" en el
  compose, y un crash ("Maximum call stack size exceeded") al adjuntar archivos por un
  `_b64u()` mal implementado para buffers grandes.
- **TELECOM-NAV-01 (2026-08-17):** en Racks/Cableado (`panel.html`), modales sin padding
  interior + auto-refresh de 60s que reseteaba la navegación al guardar un puerto (volvía a
  la lista de IDFs en vez de a Puertos). Corregido, desplegado y verificado en vivo.
- **TELECOM-NAV-01, hardening (2026-08-17, noche):** Adrián, antes de meter datos reales:
  "no puede fallar". Auditoría del módulo completo — el backend permitía borrar por API a
  cualquier usuario de telecom aunque la UI restringiera el botón a roles responsables
  (cerrado, alineado a la misma lista de roles en los dos frontends); nombre y campos de
  puerto sin límite de longitud (alineado a 160/1000, backend+frontend); confirmación de
  borrado de patch panel/cuadro ahora avisa cuántos puertos tienen datos. Verificado en
  producción con un usuario de prueba real.
- **TELECOM-NAV-01, toque profesional (2026-08-17, noche):** verificado en vivo el flujo
  completo de crear IDF→Rack→Módulo→Puerto en los dos frontends (clics reales no
  funcionaban en el navegador interno de esta sesión — se reprodujo llamando las mismas
  funciones que disparan los botones, ver `HANDOFF.md`), navegación correcta en cada
  guardado. A petición de Adrián, mejoras visuales: conteos por nivel (racks/módulos),
  iconos por tipo de módulo, breadcrumb con ruta completa, y celdas de puerto de tamaño
  fijo en el informe (antes se hacían enormes en páginas anchas). Verificado en
  producción con datos de prueba, borrados al terminar. Sin pendientes.
- **Informe Semanal de Seguridad, ronda completa (2026-08-17, noche):** título del topbar
  que se rompía en 3 líneas y se solapaba con el contenido (`.topbar-title` sin
  `white-space:nowrap`, fix global); botón "✏️ Plantilla" que nunca abría el modal
  (`GET /mi-empresa` sin `ok:true`, patrón estándar de la API roto ahí); tres huecos de
  paridad app/panel cerrados en Office (iniciar informe de semana nueva, editar actividad,
  añadir foto extra); pie de foto con título en el `.docx`/impresión (migración D1
  autorizada: `informes_seg_fotos.titulo`). Todo verificado en producción con datos de
  prueba reales (informe completo creado/editado/con fotos/borrado en los dos frontends).
  Sin pendientes.
- **OBRA-AUTO-01 (2026-08-17, noche):** "las obras se deben de detectar solas en el panel
  no? los usuarios ya tienen obras asignadas" — causa raíz encontrada: `GET /obras` da 403
  a encargado/operario a propósito (decisión ya tomada antes), pero `cargarObrasPanel()`
  no manejaba ese error con gracia y abortaba silenciosamente, dejando 130+ selectores de
  obra del panel vacíos para estos roles (más el mecanismo que YA ocultaba 4 selectores
  especiales, roto por el mismo motivo). Arreglado el manejo del error y extendido el
  criterio de "ocultar si no puede elegir de verdad" a la función genérica. Verificado con
  un usuario de prueba real por rol. Sin pendientes.
- Siguiente acción exacta: que Adrián entre a "Mis Correos" en Office, pulse "🔄
  Sincronizar" y confirme que aparecen sus correos reales; luego probar categorizar a mano,
  "Organizar con Alejandra", y enviar un correo de prueba real.

Estado (actualizado 2026-08-14, mediodía): Sesión larga de repaso manual de la app junto a Adrián ("vamos a revisar la
app, tiene cosillas que arreglar" → "vamos departamento por departamento"), más varios
bugs encontrados de paso y una ronda de peticiones nuevas sobre el Informe Semanal de
Seguridad. Todo completado, desplegado (Pages + los dos Workers) y verificado en vivo
contra producción (navegador real, con sesión de Adrián) salvo donde se indica lo
contrario. Resumen (detalle completo en `HANDOFF.md`/`CHANGELOG.md`):

- **DOCS-TABS-DEPT-02 + DASHBOARD-KPIS-VACIOS-01 + DELEGACION-SSE-01:** tres bugs
  encontrados en cadena revisando `panel.html` con Adrián en vivo — pestañas de Documentos
  ignorando el departamento elegido por un admin, dashboard principal con 4 KPIs que nunca
  se actualizaban (campos que el backend no mandaba o mandaba con otro nombre), y
  `delegar_tarea` sin ningún aviso en el chat mientras el ayudante trabajaba ("Pensando"
  en silencio). Los tres corregidos y desplegados.
- **COMPAT-CAE-01:** Adrián enseñó su tarjeta real de Nalanda (plataforma CAE que exige un
  cliente suyo) y pidió compatibilidad. Investigado que Nalanda no tiene API pública —
  puente manual (ficha imprimible + pictogramas en la tarjeta con QR), no integración
  automática.
- **APP-REPASO-DEPARTAMENTOS-01:** repaso completo, departamento por departamento, del
  menú de `index.html` contra la curación que ya existía en `panel.html`
  (`_MENU_ROL_DEPT_CONFIG`) — Control, Ingeniería, Obra Civil/Albañilería/Pintura/
  Carpintería y Almacén, cada uno confirmado con Adrián antes de tocar código. De paso:
  bug de flexbox en las tarjetas del selector de departamento (chevron empujado fuera de
  la tarjeta con nombres largos), tarjeta "Alejandra IA" redundante eliminada de todos los
  departamentos, y RdP/Hormigonado/Formación — que no tenían ningún criterio de pertenencia
  por departamento (pendiente ya anotado sin decidir) — reasignados a Seguridad/Obra
  Civil/Personal respectivamente.
- **AYUDA-PANTALLA-01:** `index.html` mandaba a Alejandra el id crudo de la pantalla
  actual, sin descripción — a diferencia de `panel.html`, que ya tenía ~90 páginas
  documentadas. Mismo patrón replicado (31 pantallas), sin tocar el backend.
- **INFORMES-SEG-CIERRE-01:** a raíz de que Katy (técnico real) no entendía el flujo del
  Informe Semanal ("no veo el botón para generar informe" / "el flujo no está claro"),
  ronda larga de mejoras: navegar a semanas anteriores y editar actividades ya guardadas
  (antes solo crear/borrar), cerrar y generar el documento final (Word y PDF) también
  desde `index.html` (antes solo desde Office), crear y borrar informes semanales enteros
  desde `panel.html` (antes solo desde el móvil, y sin poder borrar ninguno), y
  placeholders de ejemplo en los 3 campos de texto libre del cierre.
- **FAB-SCAN-OCULTO-01:** botón flotante de escaneo remoto en Office oculto mientras no
  haya ningún móvil conectado (antes visible siempre, pulsarlo sin móvil solo daba error).
- **Pendiente sin decidir, anotado durante la sesión:** que Almacén pueda ver el material
  de TODOS los departamentos (no solo el suyo) desde el móvil, como ya hace en
  `panel.html` (`filtroDeptModal`); plantilla del Informe Semanal (documento final)
  editable por el usuario en vez de fija en el código; agrupación de Albañilería/Pintura/
  Carpintería bajo Obra Civil, quedó descartada la jerarquía real de datos, aplicada solo
  la agrupación visual.

Estado (actualizado 2026-08-13, tarde): **BOTONES-FEEDBACK-01 completada, desplegada y
verificada.** Adrián probó el informe semanal de Seguridad recién construido, el botón
Guardar tardó y "le di más veces. Me ha generado 3 entradas más" — un solo bug real de UX
escaló a petición explícita: "necesitamos feedback en los botones que pulsamos en toda la
suite para saber que funcionan... lanza varios agentes para ver lo de los botones en toda la
app". Tres agentes de exploración (uno por frontend) auditaron `index.html`, `panel.html` y
`alejandra-panel.html` de forma independiente y encontraron **~95 sitios** sin ningún
indicio de "en curso" en su botón Guardar — muy por encima de la estimación inicial.
- **Hallazgo colateral crítico durante esa misma auditoría (ya corregido y desplegado por
  separado, commit `7d83661`):** `apiCall(path, options)` solo acepta DOS argumentos, pero
  24 llamadas en 7 módulos (Tareas de obra, Órdenes de Cambio, Actas de Reunión, Control de
  Calidad/Deficiencias, Subcontratas, Presupuesto de obra, RFIs) le pasaban TRES —
  `apiCall(ruta, 'POST', body)`. El método quedaba sin definir (GET por defecto) y el body se
  perdía entero, mientras la UI mostraba "guardado ✓" — dato nunca persistido. Introducido en
  el commit `2639128` (24/06/2026) — casi 7 semanas en producción. Corregido antes que el
  propio backlog de feedback en botones, por ser mucho más grave (pérdida silenciosa de
  datos, no solo UX).
- **Fix aplicado (commit `91cff7e`):** helper `conBoton(btn, fn, textoOcupado)` — deshabilita
  el botón, cambia su texto y restaura el estado en un `finally` — añadido una vez por
  archivo (`index.html`, `panel.html`, `alejandra-panel.html`) y aplicado con un cambio de
  una sola línea en el `onclick`/`onsubmit` de cada sitio, sin tocar el cuerpo de cada
  función `async`. Cobertura: `index.html` ~55 sitios (Seguridad, Personal/Fichajes,
  Bobinas/PEMP/Herramientas/Pedidos, Calendario/Diario/Partes/Telecom, Admin/Ajustes/
  catálogos, prioridad media), `panel.html` ~47 sitios (los tres patrones de modal de gestión
  de obra + informe semanal de Seguridad), `alejandra-panel.html` 4 sitios (config, password,
  crear usuario, revocar token).
- Verificación: sintaxis de los tres archivos comprobada (extracción de `<script>` +
  `new Function()`); sin patrones de encoding corrupto en el diff. Desplegado en Pages
  (`gh workflow run pages.yml`, ref `91cff7ecafe6b8ae86a0a0b06cf928913d60fedb`, run
  `31684170658`, éxito). No requiere cambios de backend ni migración D1.
- Siguiente acción exacta: ninguna urgente. `worker.js`/`alejandra-agente/worker.js` no se
  tocaron en este backlog — no requieren nuevo despliegue de Worker.

Estado (actualizado 2026-08-13): **INFORMES-SEG-SEMANAL-01 completada, desplegada y
verificada en producción de extremo a extremo.** Adrián: "sabes que ellos tienen que hacer
informes, creo que semanales... es un informe a nivel interno para los técnicos de cada
obra, tengo una plantilla... por si de alguna manera podemos facilitar hacerlo al técnico".
Pasó la plantilla real (Word, `S31 Informe semanal.docx`) y se calcó su estructura: cabecera
de control de documento, Aspectos críticos/Observaciones/Otros puntos en texto libre, tabla
día-a-día de actividad+contratista+foto. Alcance elegido: generación real del documento
final (PDF y `.docx`, a elegir), no solo agilizar la recogida de datos.
- **Migración D1 autorizada y aplicada** (3 tablas aditivas: `informes_seg_semanal`,
  `informes_seg_actividades`, `informes_seg_fotos`).
- **`index.html`**: pantalla nueva en Seguridad — el técnico añade fecha+actividad+
  contratista+foto en un tap; el informe de la semana se resuelve solo en el backend por
  fecha, nunca se "abre" a mano.
- **`panel.html`**: pantalla de revisión/cierre por obra y semana — ver actividad diaria con
  fotos agrupadas por día, completar los tres bloques de texto libre, cerrar el informe, y
  botones para generar PDF (imprimible, mismo patrón que el resto de la app) o `.docx`.
- **`worker.js` — primera dependencia npm real de este Worker** (`docx`, monolítico hasta
  ahora, sin imports). Probado antes de usarlo: `Packer.toBuffer()` falla en el runtime real
  de Workers ("nodebuffer is not supported by this platform", usa `Buffer` de Node);
  `Packer.toArrayBuffer()` sí funciona, verificado con `wrangler dev` local con tabla e
  imagen embebida antes de tocar el Worker real. Las fotos se embeben de verdad (bytes
  reales descargados de R2), no como enlaces.
- **Pipeline de deploy actualizado**: `package.json`/`package-lock.json` dejan de estar
  ignorados en la raíz (excepción documentada en `.gitignore`, mismo patrón que
  `alejandra-agente`), y `deploy-worker.yml` instala dependencias (`npm ci`) antes de
  desplegar — sin este paso, el Worker no habría podido empaquetar `docx` en CI.
- **Verificado en vivo de extremo a extremo contra producción** (empresa de prueba): creada
  actividad+foto por API, informe recuperado agrupado por día, texto libre guardado, `.docx`
  descargado y verificado byte a byte (cabecera, tabla día/foto con imagen real incrustada,
  otros puntos como líneas separadas — `unzip`+lectura de `word/document.xml`). Tarjeta del
  módulo confirmada visible en `index.html`. El botón de PDF no se pudo verificar con un clic
  real en esta sesión (el navegador de pruebas bloquea el popup si no viene de un gesto real
  de usuario) — reutiliza el mismo patrón exacto (`window.open`+`document.write`+`print()`)
  ya probado y en producción en `segRegImprimir`, así que el riesgo es bajo, pero queda como
  única verificación pendiente con un clic real.
- Siguiente acción exacta: ninguna urgente. Pendiente sin decidir: si conviene borrar los
  datos de prueba de este informe en la empresa demo (informe #1, empresa_id=5) — se dejaron
  a propósito, mismo criterio que el resto de datos de prueba de esa empresa.

Estado (actualizado 2026-08-12, noche): **CATALOGO-PROVEEDORES-01** completada — Adrián pidió
cargar los catálogos de Hilti/Pemsa/Würth; en vez de una tabla estática con referencias
inventadas, el ayudante de Pedidos recibió la tool `buscar_web` ya existente (prioriza las
webs oficiales de esos tres proveedores) y sigue permitiendo descripción manual si no
encuentra nada fiable. Probado en vivo: pedida una referencia real de Hilti por delegación,
buscó de verdad en hilti.es, encontró `HIT-RE 500 V3` y avisó explícitamente de que la web
muestra la V4 como versión actual en vez de inventar cuál es la correcta. Hilti/Pemsa/Würth
dados de alta en `proveedores_gestion` (Levitec, empresa_id=1). De paso, bug real corregido:
el autorrelleno de email al enviar un pedido por correo (`panel.html`) consultaba una tabla
sin columna email, roto en silencio desde siempre — ahora consulta `proveedores_gestion`.
Detalle en `CHANGELOG.md`.

Estado (actualizado 2026-08-12): **`F6.1-AYUDANTES-PEDIDOS` (Fase 1) desplegada, verificada en
producción y confirmada en vivo** — prueba real en Alejandra Office completada (login temporal
en la empresa de prueba, delegación confirmada en `alejandra_trazas`), y de paso se encontró y
corrigió un bug real (`PEDIDOS-AYUDANTE-DEPT-01`: el ayudante dejaba que el modelo inventara el
`departamento` del pedido, invisible luego al filtrar por departamento real) — desplegado,
reverificado, sin pendientes. **`F6.1-AYUDANTES-CORREOS` (Fase 2, piloto Gmail personal)
desplegada** — Director completó Google Cloud Console y creó `TOKEN_ENCRYPTION_KEY`; los dos
Workers desplegados (`alejandra-app-api` run 31594892173, `alejandra-agente` run 31594913990),
`/health` → `healthy` en ambos. **Pendiente solo la prueba real de extremo a extremo** (conectar
Gmail desde Ajustes, delegar lectura/envío en el ayudante de Correos). Ver fichas abajo.

Estado (actualizado 2026-08-11, noche): **No hay ninguna tarea activa, en curso ni
bloqueada.** Última sesión: reorganización de "Trabajadores" en panel.html (plantilla
Levitec vs subcontratas), campos nuevos `categoria`/`empresa` (dos migraciones D1
autorizadas), recorte de foto de perfil, y varios bugs reales encontrados en verificación
en vivo (incluido uno de seguridad: código de fichar en texto plano en la tarjeta
imprimible). Todo desplegado y verificado — detalle completo en `HANDOFF.md`/`CHANGELOG.md`.
**Pendiente sin empezar, pedido explícito de Adrián:** informe de fichajes imprimible
(horas por día/semana/mes, filtrable por empresa) — ver `HANDOFF.md`. **Pendiente sin
decidir:** qué módulos (Hormigonado/Formación/RdP/Actas de Reunión) debería ver cada
departamento de index.html — ver `HANDOFF.md`.

Estado anterior (2026-08-10, tarde): **No hay ninguna tarea activa, en curso ni bloqueada.** **Fix de contaminación de contexto en el chat + auditoría amplia de bugs de esquema (2026-08-10):** un mensaje de contexto viejo (foto de hace días) contaminando turnos nuevos del chat llevó a corregir `construirMessages()` (solo re-adjunta imágenes de la sesión activa, <2h) y, al investigar el error que lo destapó, a una auditoría de 18 bugs más del mismo tipo (`.catch()` silencioso sobre columnas/tablas nunca verificadas contra D1 real) en los dos Workers — dashboard ejecutivo, alertas de cumplimiento, cron de inteligencia de negocio, exportación de datos, generación de informes, vigilancia automática. Todos verificados contra D1 real, corregidos, testeados y desplegados. Detalle completo en `HANDOFF.md`/`PROJECT_STATE.md`/`CHANGELOG.md`. Todas las entradas de este documento están `completada`/`cerrado`/`desplegada y verificada`, incluidas las 14 verticales de ARC-011 fase 3, F-0.2-CFG (secretos por entorno + ensayo + política de rama, 2026-08-04), F-1.1/F-1.2/F-1.3 (Época 1 completa) y F-2.1-MEMORIA-ESCRITURA (Época 2). ARC-014 sigue como riesgo aceptado sin acción de ingeniería (revisada 2026-08-03, sin cambios); **ARC-021** (bypass de despliegue de `alejandra-agente` vía `wrangler deploy` directo) se acepta como práctica habitual, mismo criterio. Trabajo más reciente: SEC-CHAT-CONTEXTO-LEGACY + ADR-0020 rebanada 1 (2026-08-06), F-1.3 núcleo cognitivo v2 en subcarpetas locales, F-2.2 Nexo v1 (ADR-0021), y **ADR-0020 rebanadas 2-7 (2026-08-07):** piloto N0 ampliado a las 36 tools, contexto seguro cerrado, política determinista real, refuerzo N2/N3 (traza sin ampliar permisos) y N1 completo (26 tools, lectura y escritura) bajo el Motor — ver detalle abajo, sección "ADR-0020". Las 7 rebanadas desplegadas y verificadas en producción. **F-4.4 (2026-08-07):** bug real de clasificación de telemetría (100% de tools sin contrato JSON marcadas como error) encontrado al investigar la vertical de F-3.1, corregido y desplegado (`clasificarResultadoTool()`); **F-3.1 en espera de telemetría real de uso** antes de decidir vertical piloto (decisión del Director). **Auditoría y cierre de aislamiento por departamento en Alejandra Office (2026-08-09/10):** tres rondas sucesivas de auditoría (solo lectura) encontraron y cerraron fugas cross-departamento reales — selectores de trabajador (`getTrabajadores`/`getCarnets`), 19 tablas de obra sin columna `departamento` (6 migraciones D1 + `deptGuard` en ~40 endpoints), y finalmente `getReconocimientos`/`getAccidentes` (datos de salud y registro legal de seguridad, restringidos a Seguridad+admins). **No quedan módulos conocidos sin aislar.** Detalle completo en `HANDOFF.md`/`CHANGELOG.md`. **Pendiente sin decisión tomada:** diseñar la revisión humana asíncrona real para N2 (ADR propio, cablear Telegram); N3 sigue fuera del alcance autónomo por mandato de ADR-0006. Dos fixes fuera del roadmap ya cerrados (panel.html PR #76, 2026-08-03; 4 bugs de `index.html` vía sugerencias con foto, 2026-08-04) — detalle en `PROJECT_STATE.md`/`CHANGELOG.md`. No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

## SEC-AGENT-AUDIT-ISOLATION — aislamiento de resúmenes, estado y trazas (2026-08-11)

- Estado: **integrada en `main` (PR #105) — pendiente el despliegue del Worker**
- Prioridad: Crítica
- Rama: `codex/fix-agent-audit-isolation`, fusionada
- Alcance: `recuperar_conversacion` se limita al usuario autenticado; `leer_estado` limita métricas/memoria por empresa y logs por usuario; una traza de decisión no persistida rechaza la tool; Telegram no recibe título ni contenido de incidencias; `compatibility_date` actualizada.
- Exclusiones: no hay migración D1, backfill ni modificación de datos guardados; N2/N3 conservan sus gates existentes.
- Pruebas: `node --check alejandra-agente/worker.js`; `npm --prefix alejandra-agente test` (194/194); `npm --prefix nucleo-cognitivo test` (57/57); `node scripts/check-encoding.js origin/main`; `git diff --check`.
- Siguiente acción exacta: `wrangler deploy` de `alejandra-agente` + comprobación de `/health`, aún no ejecutado en esta sesión — el código está en `main` pero no en producción todavía.

## Fix — TABULATOR-RACE-01 (2026-08-11)

- Estado: **completado, desplegado y verificado en vivo**
- `RangeError: Maximum call stack size exceeded` en Tabulator, encontrado al verificar en
  producción real los fixes de Pedidos (reproducido una vez, no determinista). Causa raíz:
  `visibilitychange` podía relanzar `cargarDashboard()` en paralelo con la carga inicial,
  saturando el hilo justo cuando se creaba `tblPedidos` (`layout:'fitColumns'`).
- Fix: guard de reentrancia en `cargarDashboard()`. Sin relación con otros cambios de hoy.
- Desplegado: Pages (`panel.html`), commit `69d441c`. Probado en Chrome real tras publicar.
- Detalle en `HANDOFF.md`/`CHANGELOG.md`/`PROJECT_STATE.md`.
- Siguiente acción exacta: ninguna.

## Auditoría del módulo de Pedidos de material (2026-08-11)

- Estado: **completada, desplegada y verificada**
- Prioridad: Alta (Almacén no podía ver pedidos de otros departamentos, su función
  documentada; vocabulario de estados roto entre panel/app en cuanto hubiera datos reales)
- 4 bugs reales confirmados y corregidos: `getPedidos` sin `departamento==='almacen'`/
  `isDeptPrivileged` en su chequeo de admin (Almacén/Seguridad nunca veían pedidos ajenos);
  vocabulario de `estado` distinto entre `panel.html` y `worker.js`+`index.html` (alineado
  `panel.html` al correcto); `solicitado_por` siempre `NULL` desde la app móvil (fallback
  añadido); informe semanal subestimaba pedidos pendientes (`'pendiente'` sin
  `'solicitado'`).
- No arreglado, anotado como asimetría de paridad menor (no bug real): falta botón de
  borrar pedidos en `panel.html`; `tabForDept` sin casos especiales para
  almacen/telecom/personal (irrelevante en la práctica).
- Verificación: sintaxis/encoding limpios; tabla `pedidos` vacía en producción en el
  momento de la auditoría (bugs reproducibles, sin manifestarse aún con datos reales).
- Desplegado: `worker.js` (`wrangler deploy`, versión `eda09542-356f-4e97-983e-56482ce0191f`,
  `/health` en verde) + Pages (`panel.html`).
- Detalle completo en `HANDOFF.md`/`CHANGELOG.md`/`PROJECT_STATE.md`.
- Siguiente acción exacta: ninguna urgente.

## Auditoría del módulo Personal en panel.html (2026-08-10)

- Estado: **completada, desplegada y verificada — sin tareas derivadas pendientes**
- Prioridad: Alta (bloqueaba el alta de personal/usuarios desde el panel, uso real inminente)
- Lote principal (commit `31fcc91`, Worker + Pages desplegados): alta de trabajadores/usuarios
  rota por completo (`crearUsuario()` exige `codigo`, los modales mandaban `email`/`password`),
  `getTrabajadores()` sin `obra_nombre`/`email`, Hojas de Tiempo llamando a un endpoint
  inexistente, y 14 modales sin estilo real por clases CSS inexistentes (`modal-box`→`modal`,
  etc.), incluido Formación de Obra.
- Tarea derivada (commit `4cc6463`, ejecutada en sesión aparte por Adrián a partir de una
  sugerencia, verificada en el DOM real antes de publicar y desplegada en Pages, run
  `31434560088`): 9 modales con un bug de estructura distinto — div exterior con
  `class="modal"` en vez de `class="modal-overlay"`, sin backdrop/centrado al abrirse
  (Reconocimiento, Documentación de obra, Permiso de Trabajo, Inspecciones, Subir Foto,
  Transmittal, Entrega, Puntos de Acción, Riesgos). De paso se corrigieron 5 llamadas rotas a
  `cerrarModal('id')` (la función genérica no acepta argumento). Se retiró además un
  comentario `CANARY-TEST-9f3k2` que se había colado en la primera línea del archivo, sin
  relación con el fix, antes de comitear.
- Detalle completo en `HANDOFF.md`/`CHANGELOG.md`/`PROJECT_STATE.md`.
- Siguiente acción exacta: ninguna para este trabajo.

## BUZON-TELEGRAM-01 — aviso en tiempo real + buzón de incidencias (2026-08-10)

- Estado: **completada, desplegada y verificada**
- Prioridad: Media (idea de producto del Director, sin bloquear nada existente)
- Decisiones tomadas con el Director antes de implementar: aviso urgente solo a él (no a
  otros admins); es Alejandra quien decide caso a caso si algo es urgente (no un cron).
- Implementado reutilizando infraestructura existente en `alejandra-agente/worker.js`, sin
  tabla ni tool nueva: `memory_save` (`tipo='error'`, `importancia>=4`) manda ahora Telegram
  inmediato por el canal fijo que el Worker ya usa para sus propios avisos internos, además
  de guardar como siempre en `alejandra_memoria` (el buzón). Nueva regla de prompt en el
  módulo `app` explicando cuándo usarlo.
- Alcance deliberado: solo `alejandra-agente` (habla con usuarios reales); `worker.js` no se
  tocó (su chat lo usa el Director directamente).
- Verificación: `node --check` limpio; `npm --prefix alejandra-agente test` 189/189;
  desplegado (`wrangler deploy`), `/health` en verde, versión coincide de inmediato.
- Detalle completo en `HANDOFF.md`/`CHANGELOG.md`/`PROJECT_STATE.md`.
- Siguiente acción exacta: ninguna. Pendiente de que el uso real confirme si hace falta
  `memory_delete` también en `alejandra-agente` (hoy solo existe en `worker.js` raíz).

## ARC-022 — Control de accesos con quiosco de autofichaje (2026-08-10/11)

- Estado: **implementado y desplegado, incluida migración D1 autorizada — pendiente
  verificación en vivo con login real antes de confiar en él sin supervisión**
- Evolucionó de "tarjeta con QR para fichar" a control de accesos real tras aclarar el
  Director el caso de uso ("que la gente pase su QR cuando entre, no que tú les des y luego
  pases la tarjeta" / "es como un control de accesos"). Decisiones tomadas con él: lector
  USB o Bluetooth indistintamente (ambos emulan teclado); cubre también personal externo
  (no solo usuarios); ficha con foto/nombre/rol/empresa/DNI y aviso solo si algo está
  REALMENTE caducado (reconocimiento médico o carnet).
- Implementado: foto de perfil para usuarios (`index.html`/`panel.html`); tarjeta imprimible
  con QR para usuarios (ambos) y personal externo (`index.html`, único con pantalla de
  gestión); **migración D1 real aplicada** (`ALTER TABLE personal_externo ADD COLUMN
  codigo`, autorización explícita del Director, verificada tras aplicarla); `POST
  /fichajes/scan` generalizado a usuarios+externo con ficha completa en la respuesta;
  **`kiosco.html` nuevo** — pantalla de autofichaje a pantalla completa, login una vez con
  sesión larga, campo siempre reenfocado para lector físico; `index.html` recibió también
  el campo de lector físico dentro del modal de cámara existente. `panel.html` sin tocar en
  esta vuelta (no tiene pantalla de personal externo donde encajase).
- Hallazgo lateral corregido de paso: URL de `jsQR` en cdnjs devolvía 404 desde hacía tiempo
  (biblioteca retirada de cdnjs), rompiendo en silencio el escaneo de QR de bobinas/EPIs/
  herramientas — corregida a jsdelivr.
- Verificación: sintaxis + encoding limpios en todo el lote (`worker.js`, `index.html`,
  `kiosco.html`); migración D1 verificada leyendo el esquema real tras aplicarla; pruebas de
  DOM/navegador completas sobre `index.html` en el primer lote. **`kiosco.html` y
  `panel.html` sin verificación visual en el navegador de pruebas de esta sesión**
  (limitación de la herramienta al navegar a archivos fuera del proyecto en pestañas
  nuevas, no del código) — verificado por sintaxis y revisión manual del diff.
- Desplegado: `worker.js` (`wrangler deploy`) + Pages (`index.html`/`kiosco.html`, un único
  publish para todo el lote) + migración D1 (`wrangler d1 execute --remote`).
- Detalle completo en `HANDOFF.md`/`CHANGELOG.md`/`PROJECT_STATE.md`/`ARCHITECT_BACKLOG.md`
  (ARC-022).
- **Vuelta final (mismo día):** foto de trabajador desde el móvil emparejado — reutiliza el
  mecanismo de escaneo remoto ya existente (`sync_dispositivos`/`sync_eventos`), nuevo
  subtipo `foto_perfil`. `worker.js` (`_procesarScanResultado`) enruta a `usuarios`/
  `personal_externo`; `panel.html` (`rsPedirFotoTrabajador`, botón 📱 junto al avatar);
  `index.html` reenvía `destino_tipo`/`destino_id` sin decidir nada. Sin tabla ni endpoint
  de emparejamiento nuevo. De paso, fix de bug real reportado por Adrián: dos secciones
  "🔺 Seguridad" duplicadas en el sidebar del panel (vista "Todos los departamentos") —
  `construirDirectorioDepartamentos()` creaba un bloque nuevo en vez de usar el ya
  existente. Verificado por sintaxis/encoding; sin dos dispositivos reales emparejados en
  esta sesión de pruebas. Desplegado (Worker + Pages).
- Siguiente acción exacta: ninguna urgente. Pendiente sin decidir: probar el flujo completo
  con login real en Chrome antes de dejar el quiosco funcionando sin supervisión con datos
  de producción; probar la foto por móvil con Adrián citando a un trabajador real; si el
  botón "Salir" del quiosco necesita alguna protección extra; si conviene añadir tarjeta/
  gestión de personal externo y el botón 📱 de foto también a `panel.html`/`index.html`
  Plantilla respectivamente.

## Decisiones del Director — 2026-08-02 (ronda de desbloqueo del roadmap)

- **P-ARCH-002 — aprobada.** El componente de notificaciones temporales queda cerrado; desbloquea la siguiente rebanada de presentación.
- **ARC-014 — riesgo aceptado temporalmente.** Mientras el proyecto tenga un único mantenedor en fase de desarrollo, no se exige revisor distinto del solicitante. Se reabre en cuanto exista producción real o más de un mantenedor. Detalle en `ARCHITECT_BACKLOG.md`. **Revisada el 2026-08-03: el Director confirmó que ninguna de las dos condiciones cambió — sigue sin acción de ingeniería.**
- **ARC-011-FASE3-CHECKLISTS (paso 2, aplicar contra D1) — pospuesta.** No se autoriza todavía; se retoma cuando exista una ventana específica para cambios de esquema con verificación de D1 antes y después, tras completar la validación de la interfaz y del núcleo cognitivo. (Nota: esta postura quedó superada de hecho — el Director autorizó ese mismo paso 2 más tarde el 2026-08-02, ver tabla de completadas.)
- **F-0.2-CFG — pospuesta.** Los secretos se mueven al entorno `production` cuando el proyecto entre en preproducción/producción estable. Mientras tanto se mantiene la configuración a nivel de repositorio; ningún agente debe conocer ni manipular los valores reales. **Revisada el 2026-08-03: el Director pidió moverlos ahora ("muévelos tú"); se declinó ejecutar la acción porque entrar/mover secretos reales de Cloudflare/GitHub es una acción prohibida para cualquier agente (CLAUDE.md, "Los secretos no se leen, imprimen ni versionan"; reglas globales de seguridad de la sesión, categoría "Prohibido"). Sigue pendiente como tarea que solo el Director puede ejecutar personalmente en las UI de Cloudflare/GitHub.**

## Reglas

- Crear una tarea solo cuando esté aprobada para ejecución o revisión inmediata.
- Una tarea activa tiene una única rama y responsable actual.
- Actualizar al iniciar, bloquear, relevar, revisar y completar.

## ARC-021 — Despliegues de `alejandra-agente` sin workflow gobernado (2026-08-07)

- Estado: **cerrado — riesgo de proceso aceptado por el Director como práctica habitual**
- Prioridad: Media
- Hallazgo: dos despliegues de `alejandra-agente` el 2026-08-07 (`a92ec4ce`, `e8fba7ca`) sin `workflow_dispatch` de `deploy-alejandra-agente.yml` asociado — `wrangler deploy` directo, autorizado por el Director por comodidad propia. Detalle en `ARCHITECT_BACKLOG.md` (ARC-021) y `HANDOFF.md`.
- **Decisión del Director (2026-08-07): acepta el atajo como práctica habitual**, mismo criterio y condición de reapertura que ARC-014.
- Siguiente acción exacta: ninguna. Sin trabajo de ingeniería pendiente.

## Auditoría e integración del cerebro de Alejandra Chat (2026-08-06)

### SEC-CHAT-CONTEXTO-LEGACY — Aislamiento fail-closed del prompt

- Estado: **completada, desplegada y verificada**
- Prioridad: Crítica
- Rama de implementación: `codex/agent-n0-production` (integrada por PR #98)
- Objetivo: impedir que el prompt del chat incorpore automáticamente tablas legacy globales sin ámbito de empresa ni usuario.
- Alcance: `buildAnthropicSystemBlocks()` deja de leer `alejandra_ram`, `alejandra_errores`, `alejandra_memoria`, logs e historial; conserva solo módulos estáticos y el catálogo de tools visible. No modifica datos ni permisos.
- Pruebas: `node --check alejandra-agente/worker.js`; `npm --prefix alejandra-agente test` (139/139); `node --test nucleo-cognitivo/test/*.test.js` (36/36); `node scripts/check-encoding.js`; `git diff --check`; CI de PR #98 y [despliegue 31089065117](https://github.com/padilla585projects/Alejandra-APP/actions/runs/31089065117) correctos.
- Verificación posterior: `GET /health` manual devolvió `healthy` (`d1:true`, `r2:true`, versión `6e908ded-5578-405b-9044-37efc06b57ad`).
- Siguiente acción exacta: ninguna para este fix; conservar el fail-closed hasta que una rebanada posterior de contexto seguro esté aprobada.

### ADR-0020 — Integración gradual del Motor de Decisión

- Estado: **completada — rebanadas 1-7** (las siete desplegadas y verificadas en producción)
- Decisión: aceptado por el Director el 2026-08-06; enmiendas 1-6 (rebanadas 2-7) aceptadas el 2026-08-07.
- Alcance implementado: adaptador sin I/O dentro de `nucleo-cognitivo/`; toda invocación N0 ofrecida genera una decisión estructurada y una traza antes de ejecutar; una tool no ofrecida se rechaza. **Rebanada 4:** contexto seguro declarado cumplido (sin código nuevo); política determinista real vía `validarDeclaracionTool()`. **Rebanada 6:** refuerzo N2/N3 — `decidirInvocacionN2N3()` deja traza explícita de una tool N2/N3 ofrecida, pero **siempre** decide `'posponer'`, nunca `'invocar_tool'`; `CONFIRMO BORRADO`/`CONFIRMO MIGRACION` no se tocan. **Rebanada 7:** `decidirInvocacionN1Lectura()` generalizada a `decidirInvocacionN1()` — gobierna TODO N1 (lectura y escritura), no solo lectura; `esInvocacionN1DeLectura()` deja de gatear, pasa a enriquecer la traza (`es_lectura`). El catálogo N1 completo (26 tools) queda bajo el Motor.
- Pruebas: cognitive-core 57/57 (con policy), agente 178/178; `node --check` limpio en los archivos tocados.
- Verificación posterior de rebanada 1: `GET /health` manual devolvió `healthy` (`d1:true`, `r2:true`, versión `6e908ded-5578-405b-9044-37efc06b57ad`) tras desplegar `5352dc5`. Rebanada 3: commit `8039daf`, versión `01e0ea44-a379-497f-a971-c6e8f0ac1471`. Rebanada 4: commit `d725fe3`, versión `a1cc6103-2999-4394-aea8-05d8f373589f`. Rebanada 5: commit `634b86f`, versión `9eaa503b-909a-416e-bf40-1b568e7e2200`. Rebanada 6: commit `634e8a3`, versión `4a814224-2db7-4a2c-b880-fca4e2a5afdb`. **Rebanada 7 (2026-08-07):** commit `c3d9936` (cherry-pick de `50cc822`, creado por error sobre `feat/panel-office-chat-parity` — ver incidente de rama en `HANDOFF.md`), `wrangler deploy` directo, `/health` → `healthy`, versión `3fa2f9e9-f747-44a8-9498-b93d3bf9833e` coincide de inmediato.
- Siguiente acción exacta: decidir si se diseña la revisión humana asíncrona real para N2 (ADR propio, cablear Telegram) — N3 sigue fuera del alcance autónomo por mandato de ADR-0006.

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

### F6.1-AYUDANTES-CORREOS — Ayudante "Correos", piloto Gmail personal vía OAuth

- ID: F6.1-AYUDANTES-CORREOS
- Título: Fase 2 de `F-6.1` (ADR-0022) — ayudante de Correos sobre Gmail personal del
  Director, vía OAuth 2.0 real (no delegación de dominio, esa es exclusiva de Workspace)
- Fase: F-6.1 — Delegación y agentes especializados
- Estado: **desplegada en producción (2026-08-12)** — pendiente solo la prueba real de
  extremo a extremo
- Prioridad: Media
- Rama: `feat/f6.1-ayudante-correos-gmail` (fusionada y borrada)
- Responsable actual: —
- Objetivo: que el ayudante "correos" pueda leer/resumir la bandeja de Gmail del usuario y
  enviar correos desde su cuenta real (no desde un remitente fijo de empresa), con la misma
  barrera de confirmación humana que cualquier acción N2.
- Criterios de aceptación:
  1. ✅ Tabla `gmail_oauth_state` (nonce de un solo uso) y `gmail_oauth_tokens` (refresh_token
     cifrado por usuario) en `worker.js` raíz, patrón `ensureXxxTable()`.
  2. ✅ Cifrado en reposo AES-GCM (`cifrarToken`/`descifrarToken`, clave `TOKEN_ENCRYPTION_KEY`)
     — no había ningún patrón reversible previo en el repo, se construyó de cero.
  3. ✅ Rutas `GET /auth/gmail/url`, `GET /auth/gmail/callback`, `GET /auth/gmail/status`,
     `DELETE /auth/gmail` (worker.js raíz) reutilizando `GOOGLE_OAUTH_CLIENT_ID/SECRET` ya
     existentes, con `access_type=offline`+`prompt=consent` (el login normal no los pide).
  4. ✅ Endpoints internos `POST /internal/gmail/listar`/`enviar` protegidos con
     `AGENT_INTERNAL_SECRET`, llamados desde `alejandra-agente` vía Service Binding `API_WEB`
     (mismo patrón que `generar_plano`/`editar_plano`).
  5. ✅ Tools `leer_gmail` (N0) y `enviar_gmail` (N2) + `AYUDANTES.correos`, deliberadamente
     fuera de `TOOLS_POR_EXPERTO` (solo accesibles vía `delegar_tarea`).
  6. ✅ Barrera humana real `CONFIRMO ENVIO <código>` para `enviar_gmail` — frase y `Set`
     separados de `CONFIRMO BORRADO` (`extraerCodigosConfirmacionEnvio`, hilada por
     `ejecutarToolConTelemetria`/`ejecutarTool` y por el loop interno de `delegar_tarea`).
  7. ✅ UI mínima en `panel.html` (modal "Mi cuenta"): conectar/ver estado/desconectar Gmail,
     mismo patrón que el bloque ya existente de vincular Telegram personal.
  8. ✅ Tests: gating, exclusión de cron, no-oferta directa a Alejandra, extracción de
     `CONFIRMO ENVIO` sin cruzarse con `CONFIRMO BORRADO`, código atado al contenido exacto del
     correo. 207/207 en verde (12 tests nuevos sobre la base de Fase 1).
  9. ✅ Google Cloud Console completado por el Director (Gmail API habilitada, scopes
     `gmail.readonly`/`gmail.send`, test user, redirect URI añadido al cliente OAuth existente)
     y secreto `TOKEN_ENCRYPTION_KEY` creado en el entorno `production`.
  10. ✅ Desplegados los dos Workers: `alejandra-app-api` (run 31594892173) y `alejandra-agente`
      (run 31594913990), `/health` → `healthy` en ambos (`d1:true`, `r2:true`).
  11. **Pendiente**: prueba real de extremo a extremo con la cuenta del Director — conectar
      Gmail desde "Mi cuenta" en `panel.html`, pedirle a Alejandra que delegue "resume mis
      últimos correos" (N0, sin confirmación), pedirle que envíe uno de prueba y confirmar que
      exige `CONFIRMO ENVIO` antes de mandarlo.
- Dependencias: ninguna. Bloqueos: ninguno.
- Archivos principales: `worker.js` (tabla, cifrado, rutas OAuth, endpoints internos),
  `alejandra-agente/worker.js` (tools, ayudante, barrera de confirmación),
  `alejandra-agente/lib.js`/`lib.test.js`, `panel.html` (UI de "Mi cuenta").
- Pruebas: ver criterio de aceptación 8; `/health` verde en los dos Workers tras desplegar.
  Verificación en vivo (criterio 11) pendiente.
- Última actualización: 2026-08-12, noche
- **Prueba real en vivo (2026-08-12, noche), con hallazgos reales encontrados y corregidos:**
  1. **CORREO-AYUDANTE-ROUTING-01**: el primer intento ("resume mis últimos correos") se
     clasificó correctamente como experto `app` (con `delegar_tarea` disponible) pero el
     modelo no lo usó — respondió que Gmail no estaba integrado, inventando que haría falta
     OAuth2 (ya estaba construido). Un segundo intento con otra frase ("revisa mi correo...")
     se clasificó como experto `web` (sin `delegar_tarea` en absoluto) — imposible alcanzar
     el ayudante desde ahí. Dos fixes: regla explícita en `REGEX_ROUTES` (correo/Gmail/
     bandeja de entrada → `app`, determinista) + regla explícita "REGLA DE AYUDANTES" en el
     módulo de prompt `app` instruyendo usar `delegar_tarea` para correo/pedidos en vez de
     inventar que la función no existe. 207/207 tests, desplegado y verificado.
  2. **Tras los fixes, la delegación funcionó de verdad** (confirmado en `alejandra_trazas`):
     `leer_gmail` se invocó y devolvió un error REAL de Google (`Gmail API has not been used
     in project 516059806212 before or it is disabled`) — la Gmail API no está habilitada en
     el proyecto de Google Cloud correcto, un paso distinto de aceptar el consentimiento
     OAuth. Alejandra reportó el error real y los pasos correctos sin inventar nada ni
     pretender poder arreglarlo ella misma. **Pendiente que Adrián habilite la Gmail API en
     Google Cloud Console** (paso manual, en curso con Alejandra guiándolo en el chat).
- **Dos hallazgos más, encontrados justo después de que la delegación empezara a funcionar:**
  3. **CORREO-CREDENCIALES-01**: al recibir el error real de Gmail, el ayudante improvisó un
     flujo de OAuth2 manual y le pidió a Adrián su Client ID/Secret/Refresh Token por chat —
     nunca se pasan a mano (ya configurados/generados automáticamente). Fix: grounding
     explícito en el prompt prohibiendo pedir credenciales.
  4. **AYUDANTE-DETALLE-TECNICO-01**: el error técnico se mostraba igual sin importar el rol.
     Adrián: "Alejandra no puede decir estas cosas a los usuarios, a mí sí". Fix: el prompt
     del ayudante ahora se construye según `esDevVerificado` — detalle técnico completo solo
     para Adrián, frase fija sin tecnicismos para cualquier otro usuario.
  Ambos desplegados (`node --check`/207 tests/encoding limpios en los tres casos).
- Siguiente acción exacta: Adrián habilita la Gmail API en el proyecto de Google Cloud
  correcto (guiado por Alejandra en el chat); tras eso, repetir la prueba de lectura y luego
  la de envío con `CONFIRMO ENVIO`.

### F6.1-AYUDANTES-PEDIDOS — Mecanismo de delegación + ayudante piloto "Pedidos"

- ID: F6.1-AYUDANTES-PEDIDOS
- Título: Fase 1 de `F-6.1` (ADR-0022) — mecanismo de delegación genérico (`delegar_tarea` +
  registro `AYUDANTES`) y primer ayudante piloto sobre pedidos de material
- Fase: F-6.1 — Delegación y agentes especializados (Época 6, abierta 2026-08-12)
- Estado: **desplegada, verificada en producción y confirmada en vivo (2026-08-12)** — sin
  tareas derivadas pendientes
- **Prueba real en Alejandra Office (2026-08-12), completada:** login temporal en la empresa
  de prueba `Constructora Demo S.L.` (empresa_id=5, obra "Nave Industrial Demo") — se le pidió
  a Alejandra delegar la creación de un pedido en el ayudante de Pedidos. Confirmado en
  `alejandra_trazas`: traza `tipo:'decision'` (Motor de Decisión, N1) + traza
  `tipo:'delegacion'` con `empresa_id` correcto, exactamente el criterio de aceptación
  pendiente.
- **Bug real encontrado y corregido en la misma verificación (`PEDIDOS-AYUDANTE-DEPT-01`):**
  el pedido de prueba se creó con `departamento` = el nombre+rol del usuario (texto libre que
  el modelo decidió poner), no un departamento real — invisible para cualquiera que filtrase
  por su departamento real, la misma fuga que `PEDIDOS-ALMACEN-01` cerró el 11/08. Causa: el
  `case 'gestionar_pedido'` (`alejandra-agente/worker.js`) confiaba en `input.departamento` del
  modelo en vez de resolver el departamento real de la sesión, a diferencia de `crearPedido`
  (`worker.js` raíz), que nunca acepta el departamento del cuerpo de la petición. Corregido:
  se resuelve siempre `usuarios.departamento` por `usuario_id`, el campo del input se ignora al
  crear (sigue sirviendo como filtro para listar). 207/207 tests, `node --check` y encoding
  limpios; desplegado (`wrangler deploy`, versión `e2791dc2-1d9a-4734-a47e-c39b0d4f2fb0`),
  `/health` verde, reverificado en vivo: dos pedidos nuevos de prueba (#9, #10) ya salen con
  `departamento='electrico'` (el real de la sesión). Detalle en `CHANGELOG.md`.
- **Login de prueba permanente, a petición explícita de Adrián** ("dejalo usas esto para hacer
  pruebas" — no se borra): usuario id `357`, nombre "Prueba TEMP F6.1", rol `empresa_admin`,
  empresa `Constructora Demo S.L.` (empresa_id=5), login por email
  `temp-f61-test@example.invalid` / contraseña `TempF61Pass_92xQ!` (panel.html usa
  email+contraseña, no código, para roles de oficina). Quedan también 3 pedidos de prueba en
  esa empresa (#8, #9, #10) — datos de prueba deliberados, no limpiar sin pedir antes.
- Prioridad: Media
- Rama: `feat/f6.1-ayudantes-pedidos` (fusionada y borrada)
- Responsable actual: —
- Objetivo: que Alejandra pueda delegar explícitamente en un sub-agente ("ayudante") con un
  subconjunto acotado de tools ya existentes, empezando por un ayudante que gestione pedidos de
  material — sin crear ninguna vía nueva que salte el Motor de Decisión o la confirmación humana.
- Criterios de aceptación:
  1. ✅ `ADR-0022-AYUDANTES-DELEGACION-ACOTADA.md` redactado y aceptado.
  2. ✅ Tool nueva `gestionar_pedido` (crear/listar/actualizar/eliminar sobre `pedidos`, ya
     existente, sin migración D1), metadato ADR-0010 completo, alta en los `Set` de `lib.js`.
  3. ✅ Tool nueva `delegar_tarea` + registro `AYUDANTES.pedidos`, reutilizando
     `llamarAnthropic()`/`evaluarInvocacionCognitiva()` sin atajos de permisos, traza
     `tipo:'delegacion'`.
  4. ✅ Tests en `alejandra-agente/lib.test.js` (gating, exclusión de cron, aislamiento por
     empresa, ausencia de atajos de permisos en `delegar_tarea`) — 5 tests nuevos + 1 test de
     wiring de telemetría actualizado (3→4 paths). 199/199 en verde.
  5. ✅ `node --check` (worker.js/lib.js/lib.test.js), `npm --prefix alejandra-agente test`
     (199/199), `npm --prefix nucleo-cognitivo test` (57/57), `node scripts/check-encoding.js`,
     `git diff --check` — todo limpio.
  6. ✅ Desplegado y verificado: `deploy-alejandra-agente.yml` (run 31582036218), `/health` →
     `healthy` (`d1:true`, `r2:true`, versión `e82751fa-e55f-447e-9311-2d1afe4a53c3`). Los tres
     intentos previos (runs 31579447927, 31580414783, 31581694645) fallaron por
     `CLOUDFLARE_API_TOKEN` inválido/con permisos insuficientes en el entorno `production` —
     incidente resuelto por el Director regenerando el token; sin relación con el código de
     esta tarea. Queda como nota operativa: si vuelve a fallar con
     `Authentication error [code: 10000]` en un despliegue de Workers, revisar primero el
     token antes que el código.
- Dependencias: ninguna (tabla `pedidos` ya existe; sin integraciones externas en esta fase).
- Bloqueos: ninguno.
- Archivos principales: `docs/decisions/ADR-0022-AYUDANTES-DELEGACION-ACOTADA.md`,
  `alejandra-agente/worker.js`, `alejandra-agente/lib.js`, `alejandra-agente/lib.test.js`,
  `MASTER_ROADMAP.md`, `PROJECT_STATE.md`.
- Pruebas: ver criterios de aceptación 5-6, más la prueba real en vivo y el fix descritos
  arriba (`PEDIDOS-AYUDANTE-DEPT-01`).
- Última actualización: 2026-08-12
- Siguiente acción exacta: ninguna — tarea completa, verificada en vivo, sin pendientes.

### ARC-019-ADR0015-IMPLEMENTAR — Clasificación de `sql_query` y barrera de DDL no destructivo

- ID: ARC-019-ADR0015-IMPLEMENTAR
- Título: Implementar la decisión del Director sobre ADR-0015 (subir `sql_query` a N3, extender la barrera humana a `CREATE TABLE`/`CREATE INDEX`)
- Fase: deuda de seguridad (ARC-019), fuera de Épocas — hallazgo propio, no parte del roadmap por fases
- Estado: **completada — fusionada y desplegada en producción (2026-08-04)**
- Prioridad: Alta
- Rama: `feat/adr0015-barrera-ddl-creacion` — fusionada a `main` (PR #85, commit `7672bc4`)
- Responsable actual: —
- Objetivo: cerrar la brecha real detectada en `ADR-0015`: ni `sql_query` ni `run_migration` exigían confirmación humana para `CREATE TABLE`/`CREATE INDEX`, pese a que ADR-0006 dice de `run_migration` que "no es una decisión que Alejandra pueda tomar por su cuenta en ningún caso".
- Criterios de aceptación (decisión del Director, 2026-08-04):
  1. ✅ `sql_query` sube de `nivel_riesgo:'N2'` a `'N3'` (`worker.js`).
  2. ✅ Barrera humana extendida a `CREATE TABLE`/`CREATE INDEX`/`CREATE UNIQUE INDEX` en `sql_query` y `run_migration`, vía nueva `detectarSqlCreacion()`, compartida por las dos tools.
  3. ✅ Frase de confirmación distinta para no destructivo: `CONFIRMO MIGRACION <código>` (`FRASE_CONFIRMACION_MIGRACION`), separada de `CONFIRMO BORRADO`. `extraerCodigosConfirmacion()`/`exigirConfirmacionHumana()` generalizadas para aceptar la frase; verificado que los códigos de una frase no autorizan operaciones de la otra.
  4. ✅ Alcance ampliado a `alejandra-agente`: revisado `escribir_bd`/`consultar_bd`/`configurar_alerta`/`exportar_datos` — **no hay brecha equivalente** (`escribir_bd` ya rechazaba `CREATE`/`DROP`/`ALTER`/`TRUNCATE` de raíz; el resto solo permite `SELECT` vía `validarSoloSelectBD()`). Sin cambios de código ahí — hallazgo de "no hay brecha", no una omisión.
- Dependencias: `ADR-0015` aceptado por el Director (2026-08-04).
- Bloqueos: ninguno.
- Archivos principales: `worker.js` (`detectarSqlCreacion`, `FRASE_CONFIRMACION_MIGRACION`, `extraerCodigosConfirmacion`, `exigirConfirmacionHumana`, casos `sql_query`/`run_migration`, los dos puntos de entrada del bucle de tool-use).
- Pruebas: `node --check worker.js` limpio; verificación manual de `detectarSqlDestructivo()`/`detectarSqlCreacion()` sobre `CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX`, `ALTER TABLE`, `SELECT`, `INSERT`, `DROP TABLE` (cada uno activa la barrera esperada, ninguno se cuela); verificación manual de que las dos frases de confirmación no se cruzan. Sin suite de tests dedicada para `worker.js` raíz (mismo patrón ya documentado para `esDeveloperAgente()`).
- Última actualización: 2026-08-04
- Siguiente acción exacta: ninguna — **desplegado y verificado en producción (2026-08-04).** Fusionado a `main` (PR #85). Autorizado por el Director; run [30939265650](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30939265650), versión `db4a1e20-303a-4a26-9c4e-5bd5a5dacff1`. `/health` → `healthy` (d1:true, r2:true), coincide con `wrangler deployments list`. La barrera `CONFIRMO MIGRACION` para `CREATE TABLE`/`CREATE INDEX` ya está activa en producción.

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
- Rama: `feat/f21-memoria-escritura-adr015` — fusionada a `main` (PR #81, commit `75c1200`)
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
- Siguiente acción exacta: ninguna — **desplegado y verificado en producción (2026-08-04).** Autorizado por el Director; run [30937911736](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30937911736), versión `0f8cff03-d37e-4eb1-a57c-7b37c970b199`. `/health` → `healthy` (d1:true, r2:true), coincide con `wrangler deployments list`.

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
| ADR-0020 | Integración gradual del motor-decision (Piloto N0) | **Aceptado (2026-08-06)** | `decidirInvocacionPilotoN0` y `tieneTrazaSuficiente` en `motor-decision.js`. N0 tools gated (`consultar_personal`, `memory_read`, `consultar_almacen`). N1-N3 siguen con gates existentes. Vivo en 3 call sites (4925, 5097, 5184). Rebanadas 2-4 pendientes (contexto seguro, política determinista, ampliación N1-N3). |
| F-1.2 (interfaces memoria/trazas) | `memory.js` y contrato `registrarTraza()` en `nucleo-cognitivo/` | Completada | PR #20. Interfaces sin persistencia real, mismo patrón que `context-engine.js`/`planner.js`; 20 pruebas en verde. |
| **SEC-CHAT-CONTEXTO-LEGACY** | Aislamiento cross-tenant de `alejandra_memoria` + D1 migration + PR #99 | **Completada (2026-08-06)** | `construirQueryAprendizajesEmpresa()` fail-closed en `lib.js`, `obtenerContextoChat` y `memory_read` scopeados, `autoLearnUpload` fixeado, 7 tests cross-tenant (146/146), `migrate_009` aplicado (169 filas backfill, 0 NULL, 0 mismatches), PR #99 merged (`b04a2ff`), worker `6ed738a8` desplegado, `/health` verificado. fcm_token id=91 DELETE ejecutado (pendiente rotar token en Firebase Console). |
| **Doc updates** | CHANGELOG.md, TASKS.md, PROJECT_STATE.md — actualizar con SEC-CHAT-CONTEXTO-LEGACY, autoLearnUpload fix, fcm_token cleanup, ADR-0020 | **Completada (2026-08-06)** | CHANGELOG.md: 4 entradas nuevas (cross-tenant, migrate_009, fcm_token, autoLearnUpload). TASKS.md: SEC-CHAT-CONTEXTO-LEGACY + ADR-0020. PROJECT_STATE.md: nueva sección "Aislamiento cross-tenant" + "Motor de Decisión — ADR-0020". Pendiente commit. |
| ARC-008-TRAZAS-MIGRACION | Migración D1 de la tabla `alejandra_trazas` | Completada y verificada | PR #21 (declaración) + run 30746110357 (aplicación). Export previo de `alejandra-db` (8,1 MB) antes de aplicar; verificada contra el esquema real tras aplicar. Autorización del Director acotada a la única D1 existente; no se extiende a una futura producción separada. |
| ADR-0014 (implementación) | `registrarTraza()` real + `/health` de tres estados + `GET /admin/trazas`, en los dos Workers | Completada, desplegada y verificada | PR #24 (`alejandra-app-api`, run 30746614977) + PR #25 (`alejandra-agente`, run 30746733097). ARC-013 conectado a `alejandra_trazas`; `/health` verificado en vivo `healthy` en los dos; 110/110 tests del agente en verde. |
| fix/version-fallback-adr0014 | `index.html`: desactivar fallback de versión roto por el cambio de `/health` | Completada | PR #26. `hj.version` pasó a ser un UUID de despliegue; el fallback comparaba contra `APP_VERSION` y habría forzado recargas falsas (patrón de los incidentes de recarga infinita). Corregido en `main`; publicar a Pages sigue siendo un paso de entrega aparte. |
| P-ARCH-002 | Componente compartido de notificaciones temporales | **Aprobada por el Director (2026-08-02)** | `packages/design-system/src/components/toast.js`. API heredada `mostrarToast()` compatible, 12 invocaciones sin cambios, sin backend ni permisos afectados. Evidencia en `docs/architecture/FRONTEND_SLICE_TOAST.md`. Desbloquea la siguiente rebanada de presentación. |
| P-ARCH-003 | Consulta de versión remota (`checkRemoteVersion`) | **Publicada en Pages (2026-08-04, run [30937918388](https://github.com/padilla585projects/Alejandra-APP/actions/runs/30937918388))** | `packages/design-system/src/platform/version-check.js` — función pura, 7/7 pruebas en verde, usada por `index.html` y `panel.html` sin cambiar el banner/toast/recarga de cada uno. Candidato descartado antes: `copyToClipboard` (8 sitios, pero sin usos "reales compatibles" entre sí — cada uno con feedback distinto). De paso, fix real: `pages.yml` nunca copiaba `packages/` a `_site/`, así que `toast.js` (P-ARCH-002) llevaba desde su fusión sirviendo siempre el fallback local en cualquier publicación real de Pages. Evidencia en `docs/architecture/FRONTEND_SLICE_VERSION_CHECK.md`. |
| F-1.2-NUCLEO-ESQUELETO | Esqueleto, contratos e interfaces del núcleo cognitivo | Completada — verificada (2026-08-02) | `nucleo-cognitivo/`: Estado Cognitivo y Policy Engine implementados; Context Engine, Planner y Motor de Decisión como interfaces con error explícito; `memory.js` (ADR-0013 §8) y contrato `registrarTraza()` (ADR-0014 §5) añadidos en PR #20. Los 6 criterios de aceptación verificados contra el código: `node --check nucleo-cognitivo/src/*.js` y `node --test nucleo-cognitivo/test/*.js` (20/20 en verde). Cierra F-1.2 y desbloquea F-1.3. |
| F-1.3-TOOL-REGISTRY-ESQUELETO | Esqueleto y contratos del Tool Registry y Verifier | Completada (2026-08-02) | `nucleo-cognitivo/src/tool-registry.js` (validación pura ADR-0010: `acceso`/`cron`/`nivel_riesgo`, `registrarTool`, `filtrarToolsPorAcceso`, `filtrarToolsParaCron`) y `verifier.js` (nivel determinista real; revisión humana asíncrona y explicabilidad como interfaces con error explícito, ADR-0009; `nivelesRequeridosPara()`). 13 pruebas nuevas, 33/33 en verde. No migra ningún catálogo real de tools — eso es `F-1.3-TOOL-PILOTO-MIGRADA`. |
| F-1.3-TOOL-PILOTO-MIGRADA | Migrar `consultar_personal` como piloto de ADR-0010 | Completada (2026-08-02) | `TOOL_CONSULTAR_PERSONAL` (`alejandra-agente/worker.js`) declara `acceso:'sesion'`, `cron:'permitido'`, `nivel_riesgo:'N0'`. Hallazgo real corregido de paso: esos objetos se enviaban tal cual en `body.tools` de la API de Anthropic (`llamarAnthropic`); se extrajo `toolsParaAnthropic()` a `lib.js` para que solo viajen `name`/`description`/`input_schema`/`cache_control`, protegiendo también a las tools que se migren después. 4 pruebas nuevas en el agente (114/114 en verde) + 1 en `nucleo-cognitivo` que valida la declaración real copiada literalmente. Los tres `Set` de `lib.js` siguen intactos. |
| F-1.3-MIGRAR-RESTO-TOOLS | Migración incremental de ADR-0010 al resto de ambos catálogos | Completada (2026-08-02) | **`alejandra-agente/worker.js`: 69/69 tools** (lotes 2-8, `memory_save`/`memory_read`/`propose_mejora`/`tomar_decision` excluidas a propósito, dominio ADR-0013), 121/121 pruebas en verde. **`worker.js` raíz: 31/34 tools** (`memory_save`/`memory_read`/`memory_delete` excluidas por el mismo motivo) — trabajo repartido entre dos agentes en paralelo (worktrees aislados) más las 8 tools administrativas más sensibles (`sql_query`, `run_migration`, `direct_fix`, `manage_user`, `repo_write_file`, `propose_fix`, `self_audit`, `r2_delete`) revisadas directamente. `run_migration` → `N3` (mandato explícito de ADR-0006/0010). **96/103 tools totales con metadato ADR-0010**, ninguna migración cambia comportamiento observable (los `Set`/gates existentes siguen siendo la fuente de verdad). Tres hallazgos reales corregidos de paso: (1) SQL sin parametrizar en `gestionar_calidad`/`resolver` (agente); (2) fuga de metadato a la API de Anthropic, resuelta con `toolsParaAnthropic()`; (3) **`direct_fix`/`repo_write_file` en `worker.js` raíz afirmaban en su `description` (visible al propio modelo) y en su mensaje de retorno que un commit se despliega automáticamente a Cloudflare/Pages — falso desde F-0.1/ADR-0001 (2026-08-02): ningún workflow se dispara por push a `main`. Corregido para no inducir a Alejandra a creer/decir que un fix ya está en producción cuando solo está commiteado.** Hallazgo anotado sin resolver: `sql_query` permite DDL (`CREATE`/`ALTER`/`DROP`) igual que `run_migration`, con la misma barrera humana pero sin la distinción N3 explícita que ADR-0006 sí le da a `run_migration` — candidato a revisión de ADR aparte. |
| ARC-011-FASE3-LOTE3 | Tercer lote agrupado (23 tablas, 6 verticales) | Completada (2026-08-03) | Ver `ARC-011-FASE3-LOTE3` arriba. Ciclo de 5 pasos cerrado: declarado (PR #70), aplicado (run 30836558620 y siguientes), DDL en runtime retirado (PR #75), verificado en producción (run 30839201968, `/health` healthy, 23 tablas presentes). **Con este lote, las 14 verticales de ARC-011 fase 3 quedan completas.** |
| fix/panel-alejandra-chat-sync-drag-resize | Fix del salto del chat de Alejandra en `panel.html` + mover/redimensionar | Completada (2026-08-03); paridad verificada (2026-08-04) | PR #76. Bug real reportado por Adrián: el sondeo cada 5s repintaba toda la ventana del chat aunque solo hubiera un mensaje nuevo (incluido de otra plataforma, vía `alejandra_historial` compartida). `cargarAlejandraChat()` ahora compara firmas y solo añade mensajes nuevos al final. Único archivo tocado: `panel.html`. Paridad comprobada: `index.html`/`alejandra-panel.html` usan streaming SSE para el chat de Alejandra, no el patrón de sondeo-y-repintado — no necesitan el mismo fix. |
| F-2.1-MEMORIA-ESCRITURA | Exponer escritura de `memoria_gobernada` como tools (`memoria_listar_pendientes`/`memoria_confirmar_candidata`/`memoria_rechazar_candidata`) | Completada, desplegada y verificada (2026-08-04) | PR #81, desplegada en `alejandra-agente` (run 30937911736, versión `0f8cff03-...`). Ver detalle arriba (`F-2.1-MEMORIA-ESCRITURA`). |
| P-ARCH-003 | Consulta de versión remota (`checkRemoteVersion`) | Completada, fusionada y publicada en Pages (2026-08-04) | PR #82 (run 30937918388). Ver tabla de arriba (fila `P-ARCH-003`) y `docs/architecture/FRONTEND_SLICE_VERSION_CHECK.md`. |
| ARC-019-ADR0015-IMPLEMENTAR | Barrera humana para `CREATE TABLE`/`CREATE INDEX` en `sql_query`/`run_migration` (ADR-0015) | Completada, desplegada y verificada (2026-08-04) | PR #85, desplegada en `alejandra-app-api` (run 30939265650, versión `db4a1e20-...`). `sql_query` sube a N3; nueva frase `CONFIRMO MIGRACION`. `alejandra-agente` revisado, sin brecha equivalente. Ver detalle arriba (`ARC-019-ADR0015-IMPLEMENTAR`) y `ARCHITECT_BACKLOG.md` (ARC-019, cerrado). |
| **F-1.3-NUCLEO-SUBCARPETAS** | Reestructurar `nucleo-cognitivo/` en dos subcarpetas locales (`packages/cognitive-core/`, `packages/cognitive-core-policy/`) bundleadas por wrangler | **Completada** (2026-08-07) | Commits `a9b7db1` + `b5f42b1`. Sin paquetes npm. `alejandra-agente/worker.js:54` importa directamente de `packages/cognitive-core/src/motor-decision.js`. `ci.yml` actualizado (`node --check` + `node --test` de ambas subcarretas). Tests: cognitive-core 35/35, cognitive-core-policy 4/4, agente 161/161. |
| **F-2.2-NEXO-V1** | Implementar Nexo v1 (ADR-0021): registro de fuentes, metadata en tools, trazas, telemetría, fallback coordinado | **Completada** (2026-08-07) | `nexo-fuentes.js` (3 fuentes, helpers), metadata `nexo` en `buscar_normativa`/`buscar_precios`, `registrarNexoConsulta()` con validación de fuente registrada, fallback `sugerencia:'buscar_web'`, 7 tests (168/168). Commit `02ea344` desplegado. Migración D1 `migrate_013` aplicada y verificada (tabla `nexo_fuentes_telemetria`, 9 columnas). |
| **ARC-020-R2-N0-CATALOGO** | Ampliar el piloto del Motor de Decisión a todo el catálogo N0 (rebanada 2, ADR-0020 enmienda 1) | **Completada** (2026-08-07) | Análisis de 47 trazas N0 (todas cron/`consultar_bd`). Completado metadato ADR-0010 de 4 tools sin `nivel_riesgo`: `memory_read`(N0), `memory_save`(N1), `propose_mejora`(N1), `tomar_decision`(N2). Test cobertura catálogo N0 completo (36 tools) + rechazo no-ofrecida en `contratos.test.js`. Tests: cognitive-core 37/37, agente 168/168. |
