# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-09-04
- Estado (2026-09-04): **Cerradas las dos verificaciones pendientes: SYNC-SELECT-01 y el
  quiosco de ARC-022. Las dos pasan. Sin cambios de código, esquema ni versión, y sin tocar
  D1.** SYNC-SELECT-01 ya estaba desplegado (PR #142 → `f4f6f5c`, run `33794071508`) y los
  tres escenarios se comprobaron contra el `panel.html` de producción; el quiosco se verificó
  en navegador por primera vez desde el 11/08/2026 (KIOSCO-FOCUS-01, los tres caminos de
  escaneo, las dos redes de seguridad de KIOSCO-02-FIX y el ciclo QR `panel.html` → `jsQR`).
  Queda solo la mitad de servidor del quiosco (`POST /verificar` y `POST /fichajes/scan` con
  un código real: exige un código de acceso o la sesión de Adrián) y el hallazgo **ARC-024**,
  sin decidir: el fichaje se registra en la obra del trabajador, no en la del quiosco. Detalle
  en `HANDOFF.md`.
- Estado (2026-09-03, noche, continuación 3): **ADR-0023, verificación del Web Push a
  Chrome con matiz honesto:** `/internal/push/enviar` se ejecuta y limpia suscripciones
  muertas de verdad (confirmado con `wrangler tail`), pero no se pudo ver la notificación
  del sistema en la prueba porque Adrián tenía otra pestaña de la app abierta a la vez —
  `sw.js` omite el aviso a propósito en ese caso (no es un bug). Falta que Adrián confirme
  con la app cerrada del todo. Detalle en `HANDOFF.md`.
- Estado (2026-09-03, noche, continuación 2): **ADR-0023 ampliado a usuarios sin Telegram:
  aviso por push (solicitud/caducidad/resultado) y pantalla "Pendientes de aprobar" en la
  app móvil (Ajustes → Sesión), desplegado (agente + Pages 9.31), 230/230 tests.** **Verificado en vivo (Chrome real de Adrián, app móvil `index.html` 9.31 con su sesión):** la sección aparece en Ajustes → Sesión con el historial; petición por chat desde la app (`usuario_id` = nombre, el agente resuelve el id real por el token) → `enviar_gmail` PENDIENTE (`C84FA9`) → la sección muestra la acción con badge 1 y botones → clic real en Aprobar (con `confirm()` auto-aceptado solo en la prueba) → fila #6 `aprobada` → cron a las 12:45:05 UTC → `ejecutada`, `resultado='ok'` → correo "Prueba ADR-0023 app movil" en la bandeja real (conector de Gmail, fecha 2026-09-03T12:45:05Z). Matiz anotado: la aprobación desde la app queda con `canal_decision='panel'` (endpoint compartido; distinguir `app` sería un cambio menor). El push a Adrián se envió (tiene token FCM en `alejandra_memoria`) pero no se pudo observar desde aquí: pendiente de que Adrián confirme si le llegó al móvil.
  Detalle en `CHANGELOG.md`/`HANDOFF.md`.
- Estado (2026-09-03, noche, continuación): **ADR-0023 verificado END-TO-END en los tres
  canales, incluido Telegram y el envío real desde el Gmail de Adrián** (botón Aprobar en su
  Telegram real → cron → correo recibido en su bandeja a las 12:20:05 UTC, comprobado con
  su conector de Gmail). Por el camino, dos bugs reales de producción en `worker.js` raíz
  encontrados y corregidos: la Alejandra dev de Telegram llevaba rota por el metadato
  ADR-0010 enviado a la API de Anthropic, y la vinculación de Telegram era inalcanzable
  (ruta del webhook + rama dev antes que `/start`). Tests 228/228. Sin pendientes de
  ADR-0023. Detalle en `HANDOFF.md`/`CHANGELOG.md`.
- Estado (2026-09-03, noche): **ADR-0023 en producción y verificado en vivo (canales chat y
  panel, caducidad, idempotencia) contra D1 real; migración autorizada y aplicada; los dos
  Workers y Pages (9.30) desplegados.** De la verificación salió y se corrigió un bug de
  prompt del ayudante "correos" (rechazaba la frase de confirmación aunque la tool la
  valida). **Queda para Adrián:** vincular Telegram y probar el botón + el envío real desde
  su Gmail (nadie más tiene ambas cosas). Detalle en `HANDOFF.md`/`CHANGELOG.md`.
- Estado (2026-09-03, tarde): **ADR-0023 ACEPTADO por el Director (seis recomendaciones tal
  cual) e implementado en código; pendiente migración D1 (autorización humana), despliegue
  y verificación en vivo.** Cola `acciones_pendientes`, verifier puro, encolado en
  `enviar_gmail`/`programar_correo`, ejecutor único en el cron `*/5`, callbacks de Telegram
  con verificación de `from.id`, endpoints y bloque "Pendientes de aprobar" en el panel
  (v9.30). De paso, los dos manejadores del webhook de Telegram del raíz delegan en un
  procesador único (el hallazgo lateral deja de depender de qué ruta esté registrada). Tests
  226/226 + 54/54 + 4/4. Detalle en `CHANGELOG.md`/`HANDOFF.md`.
- Estado (2026-09-03, continuación): **ADR-0023 redactado — revisión humana asíncrona real
  para N2 (Propuesto, pendiente de decisión del Director).** Cierra el "pendiente sin
  decisión" de ARC-020. Propone una cola `acciones_pendientes` en D1 (migración, con
  autorización), tres canales de aprobación equivalentes (frase de chat como hoy, botón de
  Telegram, pestaña nueva en "Mis Tareas Programadas") y un ejecutor único en el cron `*/5`
  ya existente de `alejandra-agente` (no cabe otro: 5 triggers por cuenta). Piloto acotado a
  `enviar_gmail`/`programar_correo`, donde la fragilidad del `CONFIRMO ENVIO` por chat
  quedó demostrada el 2026-09-01. Seis preguntas abiertas con recomendación. **Hallazgo
  lateral, por verificar con el token del bot:** el webhook de Telegram que registra el
  código no atiende los botones de `alejandra_fixes` (ver `ARCHITECT_BACKLOG.md`, ARC-020).
  No se toca código ni D1 hasta que el ADR pase a Aceptado. Ver
  `docs/decisions/ADR-0023-REVISION-HUMANA-ASINCRONA-N2.md`.
- Estado (2026-09-03): **TAREAS-PROGRAMADAS-01 cerrada del todo — Alejandra programa
  correos y recordatorios a hora exacta.** Tools `programar_correo`/
  `programar_recordatorio`/`listar_tareas_programadas`/`cancelar_tarea_programada` en
  `alejandra-agente/worker.js`, cron de 5 min, tabla `tareas_programadas` (migrada),
  endpoints `GET`/`POST`/`DELETE /tareas-programadas` en `worker.js`, pantalla "🕐 Mis
  Tareas Programadas" con formulario "+ Nueva tarea" en `panel.html` (v9.29). El cron
  chocó con el límite de 5 cron triggers por CUENTA de Workers Free (resuelto liberando el
  de `apex-worker`, decisión de Adrián). En la verificación en vivo apareció y se corrigió
  un bug real (token push no encontrado por tipo de `usuario_id` en el `bind()`), y el
  flujo de confirmación `CONFIRMO ENVIO` por chat se mostró frágil en conversaciones
  largas — por eso existe el formulario directo del panel. El único punto que quedó sin
  verificar el 2026-09-01 (recepción real del correo programado) lo confirmó Adrián el
  2026-09-03: llegó a su bandeja de `padilla585@gmail.com`. Sin pendientes. Detalle en
  `HANDOFF.md`/`CHANGELOG.md`.
- Estado (2026-09-01): **GESTION-AUTO-CORREOS-01 — Alejandra administra el correo
  (categoriza+archiva+marca leído sin preguntar en cada sincronización; enviar sigue
  exigiendo confirmación humana, sin cambios), verificado end-to-end tras encontrar y
  arreglar tres bugs reales encadenados:** (1) routing — la regex de "ingeniería" atrapaba
  la palabra suelta "bandeja" (de "bandeja portacables"), así que un mensaje sobre
  gestionar el correo con "en mi bandeja" perdía acceso a `delegar_tarea` y el modelo,
  sin la tool, llegó a **inventarse correos ficticios 3 veces** (se autodetectó al 4º
  intento); (2) `leer_gmail` no incluía el `gmail_id` real, así que `categorizar_correos`
  fallaba siempre (404, id inventado); (3) el ayudante se paraba con un texto de
  transición y nunca llegaba a llamar a la tool. Verificado consultando D1 directamente
  (no el texto del chat): 5/5 correos gestionados, categorías coherentes. Detalle en
  `HANDOFF.md`/`TASKS.md`.
- Estado (2026-08-31, continuación): **CORREOS-PANEL-01 cerrada — Gmail real reconectado y
  verificado de extremo a extremo.** Encontrado y arreglado de paso un bug real:
  `GMAIL_OAUTH_SCOPES` no pedía scope de email, por eso la cuenta se guardaba como
  "(sin email)" (y el `ON CONFLICT` de `gmail_cuentas` nunca deduplicaba con NULL). Tras el
  fix y la reconexión de Adrián: `POST /correos/sincronizar` →
  `{ok:true,nuevos:5,total:10}`, "Organizar con Alejandra" leyó correos reales y devolvió
  un resumen priorizado con datos concretos. Matiz sin decidir: ese mismo prompt no llamó a
  `categorizar_correos` (no persiste etiqueta por correo) — pendiente de que Adrián diga si
  quiere que también lo haga. Detalle en `HANDOFF.md`/`TASKS.md`.
- Estado (2026-08-29, continuación): **Fallback de Anthropic no cubría el tope de uso
  (solo "sin saldo"), y `/health` no detectaba ningún fallo real de Anthropic.**
  Verificando en vivo la nueva tool de conflictos, el chat falló con el error crudo de
  Anthropic ("reached your specified API usage limits") en vez de caer al fallback de
  GPT-4o ya existente — ese mecanismo solo reconocía el texto "credit balance is too
  low". Adrián ya resolvió el saldo real; corregido el código para que ambos casos
  activen el mismo fallback+aviso. Además, `/health` nunca comprobaba Anthropic en
  absoluto — extendido `determinarEstadoSalud()` (3er parámetro, compatible) para
  reflejar un fallo reciente (consulta `alejandra_logs`, sin gastar cuota real). 4 tests
  nuevos, 211/211 en total. Pendiente de commit/deploy. Ver `CHANGELOG.md`.
- Estado (2026-08-29, continuación): **"Ingeniera en condiciones" — detección de
  conflictos entre disciplinas (`detectar_conflictos_disciplinas`).** Investigado antes
  de diseñar: sin datos geométricos/BIM (planos son SVG 2D, no 3D), un clash detection
  real no es posible hoy. Alcance honesto elegido: cruzar `documentos_obra`,
  `incidencias` e `ncrs_obra` (las únicas 3 tablas con `departamento` real) por
  coincidencia de palabras clave entre disciplinas distintas, dejando explícito que es
  heurística de texto, no confirmación de conflicto real. Verificado con 6 casos
  aislados, encontrados y corregidos 2 bugs reales antes de desplegar (fragmentación de
  palabras acentuadas por NFD sin limpiar; stopwords solo en singular dejaban pasar
  plurales como falsos positivos). 207/207 tests. Pendiente de commit/deploy. Ver
  `CHANGELOG.md`.
- Estado (2026-08-29, continuación): **"Ingeniera en condiciones" — checklists de
  inspección personalizados por chat (`gestionar_checklist`).** Adrián eligió esta idea
  de la lista de 7 aprobada antes. Investigando se encontró que la infraestructura ya
  existía completa en `worker.js` (NEW-55 QA/QC, plantillas + ejecuciones + NCR
  automática) sin ninguna tool de chat que la usara. Añadida `gestionar_checklist` en
  `alejandra-agente/worker.js` (mismo patrón que `gestionar_calidad`, acceso directo a
  `env.DB` compartida) con 5 acciones: listar/crear plantillas, listar/iniciar/actualizar
  ejecuciones — la fusión de resultados por descripción evita perder respuestas de turnos
  anteriores al rellenar una inspección en varios mensajes. Verificado con 11 casos
  aislados de la lógica de fusión/stats. 207/207 tests. Pendiente de commit/deploy.
  **Deuda anotada, no corregida aquí:** ningún tool del agente filtra por departamento
  (solo worker.js/panel.html lo hacen) — afecta a todos los tools de datos, no solo a
  este; requiere tocar la firma de `ejecutarTool`/`ejecutarToolConTelemetria`. Ver
  `CHANGELOG.md`.
- Estado (2026-08-29, continuación): **DEPT-AGENTE-01 — cerrada la deuda de arriba:
  `gestionar_calidad` y `gestionar_checklist` ya filtran por departamento vía chat.**
  `departamento`/`rol` de la sesión verificada viajan ahora hasta `ejecutarTool`/
  `ejecutarToolConTelemetria` (incluida la recursión de `delegar_tarea`). Nuevo helper
  `puedeVerTodosLosDepartamentos(rol, departamento)` en `lib.js`, mismo criterio que
  `isDeptPrivileged()` de `worker.js`. De paso, cerrado un IDOR no detectado en el
  análisis inicial (`iniciar_ejecucion`/`actualizar_ejecucion` de `gestionar_checklist`
  aceptaban un id de otro departamento sin comprobarlo). 211/211 tests (207 + 4 nuevos).
  Resto de tools de datos del agente (más allá de estas dos) sin auditar todavía — ver
  `CHANGELOG.md`.
- Estado (2026-08-31): **DEPT-AGENTE-01 — fusionada, desplegada y verificada en vivo**
  (PR #129). Con dos usuarios de prueba reales de departamentos distintos y datos
  sembrados en D1: un usuario de `mecanico` no ve la deficiencia/plantilla de `electrico`
  por chat, mientras el de `electrico` sí ve la suya (el filtro no es overly-restrictive);
  el IDOR de `iniciar_ejecucion`/`actualizar_ejecucion` confirmado cerrado (referenciar por
  número el id de otro departamento devuelve "No encuentro..." y no modifica el registro).
  `alejandra-agente` redesplegado (`wrangler deploy`, `/health` → `healthy`). Datos/
  usuarios de prueba borrados al terminar. Detalle en `CHANGELOG.md`.
- Estado (2026-08-29, continuación): **Tercer hallazgo de la revisión — sesión real de
  Adrián lleva 24h+ sin validar, `anon:3` en producción, causa raíz sin confirmar.**
  Investigando `anon:3` en `alejandra_historial` (28/08) apareció una conversación real
  de ~3 min (11:58-12:01, incidencia real de sondas Vaisala) ocurrida enteramente en modo
  anónimo. Cruzado con `sesiones`: su sesión real (id 290, NO caducada, `expires_at` a más
  de un mes) dejó de encontrar fila válida en `getAuth()` desde las 07:53:52 de ese día —
  `last_used` nunca se actualizó desde entonces, sin sesión nueva creada después. La
  salvaguarda `sesionPareceCaducada()` ya existente debería haber avisado, pero no había
  forma de diagnosticar DESPUÉS por qué el token dejó de validar. Añadida traza de
  diagnóstico (SESION-TRANSPARENTE-02, en los dos Workers, no bloqueante, sin exponer el
  token) para que la próxima vez sea correlacionable. **Causa raíz sin determinar —
  pendiente de que Adrián confirme si vio el aviso de sesión caducada ese día y si ha
  vuelto a iniciar sesión con normalidad.** 207/207 tests. Pendiente de commit/deploy. Ver
  `CHANGELOG.md`.
- Estado (2026-08-29, continuación): **Segundo hallazgo de la revisión — Alejandra
  ignoraba un "sí" corto del usuario y repetía su oferta en vez de actuar.**
  `alejandra_historial` id2759→id2760 (usuario 3, 28/08 07:50): Alejandra había ofrecido
  generar un esquema pidiendo un dato opcional; el usuario confirmó corto ("Si por
  favot") sin darlo; en vez de generar igualmente (el dato no era obligatorio para la
  tool) o preguntar solo por lo que faltaba, repitió casi palabra por palabra su propia
  explicación anterior terminando con la misma pregunta — ignoró la confirmación por
  completo, sin ninguna traza para ese turno. La salvaguarda existente ("plan diferido
  sin ejecutar") no lo cazaba: ese patrón detecta anuncios de acción no ejecutados
  ("voy a proceder a..."), no preguntas repetidas ignorando una respuesta ya dada.
  Añadida una detección hermana (ALEJANDRA-CONFIRMACION-01) en los mismos dos puntos del
  código: confirmación corta del usuario + respuesta sin tool_use que reoferta con otra
  pregunta → fuerza una continuación pidiendo ejecutar ya o preguntar solo por el dato
  imprescindible. Verificado con 6 casos aislados (el real + negativos para evitar
  falsos positivos con mensajes largos/no confirmatorios). 207/207 tests. Pendiente de
  commit/deploy. Ver `CHANGELOG.md`.
- Estado (2026-08-29): **Revisión del comportamiento real de Alejandra — falso positivo
  encontrado y corregido en `verificarAccionesAfirmadas()`.** Adrián pidió revisar cómo
  se había comportado Alejandra con sus peticiones reales de un día concreto. Reconstruido
  `alejandra_historial`+`alejandra_trazas` reales (usuario 3, 2026-08-28 07:46-07:52, solo
  lectura): un esquema se generó de verdad, dos turnos después falló el envío por Telegram
  de forma legítima (sin chat_id) — pero la respuesta de ESE turno, que citaba
  correctamente el enlace YA real del esquema anterior, fue sustituida entera por "No
  llegué a generar ningún esquema" (falso), porque el propio fix de ayer
  (ALEJANDRA-ESQUEMA-02) no distinguía "URL nueva/inventada" de "URL ya real de un turno
  anterior". Provocó una regeneración redundante cuando el usuario respondió "Hazlo de
  nuevo". Corregido: `verificarAccionesAfirmadas()` recibe ahora `messages` (la
  conversación ya reconstruida) y solo marca alucinación si la URL es realmente nueva Y la
  tool no se llamó este turno. Verificado con 5 casos aislados reproduciendo el escenario
  real exacto, todos correctos. 207/207 tests. Pendiente de commit/deploy. Ver
  `CHANGELOG.md`. Otros dos hallazgos de la misma revisión, aún sin investigar: (1) en
  id2759→id2760 el usuario aceptó una oferta ("Si por favot") y Alejandra repitió el mismo
  texto explicativo en vez de generar el esquema o repreguntar el dato que faltaba —mismo
  patrón que un problema ya señalado antes en sesiones anteriores; (2) aparece `anon:3`
  en el historial del 28/08 (12 mensajes) — posible recurrencia de SESION-TRANSPARENTE-01,
  por confirmar si es distinto del caso ya cubierto.
- Estado (2026-08-27): **`calcular_cable`/`calcular_proteccion` con tabla real ITC-BT-19
  por método de instalación.** Adrián pidió una "verificación doble" para cálculos
  críticos — investigando se encontró que el cálculo base ya era código determinista
  pero aproximado (una sola tabla, sin distinguir método de instalación pese a
  recibirlo, sin factores de corrección por temperatura/agrupamiento, tabla duplicada y
  distinta entre las dos tools). Verificadas las cifras reales contra dos fuentes
  independientes (Guía-BT-19 del Ministerio + Cables RCT, coinciden exactamente),
  validado contra el ejemplo de cálculo oficial del propio documento (53,9A, coincide
  exacto). Nueva tabla por método (B1 tubo, E bandeja/aire, enterrado), factores de
  corrección por temperatura y agrupamiento reales, tabla deduplicada entre las dos
  tools. Aluminio/PVC quedan fuera de esta pasada (avisado explícitamente). 207/207
  tests. Pendiente de commit/deploy. Ver `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Retirado `memoria_gobernada` — código sin
  generador de candidatas, bloqueado por ADR-0002.** Adrián pidió terminar la migración
  pendiente (mover `alejandra_memoria` → `memoria_gobernada`). Investigando antes de
  tocar nada se encontró que era la dirección equivocada: `memoria_gobernada` es una cola
  de candidatas máquina→aprobación humana con lógica ya escrita (incluso 4 tools
  invocables por el modelo), pero **nada en el repo inserta filas ahí** (0 generador, 0
  filas reales), y `ADR-0002-NUCLEO-COGNITIVO-V1.md` deja su implementación
  explícitamente **bloqueada**. Informado de esto, Adrián decidió retirar el código (no
  migrar, no construir el flujo ahora). Quitadas las 4 funciones + 4 tools + case
  handlers + helper de rol huérfano en los dos Workers; tabla NO borrada (queda vacía,
  requiere `CONFIRMO BORRADO` para eso). `alejandra_memoria` (180 notas reales) se queda
  como único sistema de memoria real. 207/207 tests. Pendiente de commit/deploy. Ver
  `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Compatibilidad CAD real — Parte 3 (migración D1)
  aplicada, plan completo (1-3) cerrado.** Adrián autorizó explícitamente ("dale") la
  migración pendiente de la Parte 2. Aplicada en producción
  (`migrate_planos_import.sql`, verificado con `PRAGMA table_info`): columnas `origen`,
  `archivo_original_key`, `anotaciones_svg` en `planos`. Código actualizado para usar las
  columnas reales en vez del `metadatos` JSON provisional de la Parte 2. Badge "📥 DXF"
  añadido en `panel.html` para planos importados. Versión → 9.25. Ver `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Compatibilidad CAD real — Parte 2 (importar/leer
  DXF) implementada, pendiente de desplegar.** `dxf-parser` como segunda dependencia npm
  real del Worker raíz (verificado con `wrangler deploy --dry-run`, empaqueta sin
  errores). Nuevo endpoint `POST /planos/importar-dxf`, dos tools nuevas
  (`importar_plano_dxf`/`analizar_plano_dxf`) conectadas también al guardián
  anti-alucinación de ayer, y botón "Importar DXF" en `panel.html`. Almacenamiento vía
  `metadatos` JSON en la tabla `planos` existente, sin migración D1 todavía (Parte 3,
  columnas dedicadas + capa de anotaciones, sigue pendiente de autorización explícita).
  Verificado con un DXF de prueba real (5 tipos de entidad, sin NaN). Versión → 9.24.
  Ver `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Compatibilidad CAD real — Parte 1 (exportar DXF)
  cerrada, plan completo aprobado.** Adrián: "quiero que Alejandra sea la mejor" — tanto
  generando CAD real como leyendo/anotando DWG/DXF de terceros. Investigado y planificado
  con `EnterPlanMode` (plan en `C:\Users\Adrian\.claude\plans\radiant-moseying-diffie.md`):
  Parte 1 (arreglar `descargarDxfPlano()` en `panel.html`, que perdía en silencio los 41
  símbolos IEC reales al exportar por no resolver `<use>`/`<path>`) ya implementada y
  verificada contra un plano real (ID 21, sin NaN, símbolos incluidos). Parte 2 (importar
  DXF real subido, con `dxf-parser` server-side) y Parte 3 (migración D1 en `planos`, con
  autorización explícita pendiente) diseñadas pero no implementadas todavía. DWG binario
  nativo fuera de alcance (formato propietario sin parser libre — se pide exportar a DXF).
  Versión → 9.23. Ver `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Nuevo sub-tema "Alta Tensión" para Ingeniería.**
  Adrián pidió un experto de Alta Tensión (celdas, aparamenta, maniobra) — implementado
  como sub-tema `ie_alta_tension` (mismo patrón de carga condicional que el resto de
  `ie_*`, no un experto nuevo aparte): normativa RD 337/2014+ITC-RAT, tipos de celda,
  aislamiento, protecciones ANSI, las 5 reglas de oro, mantenimiento. Detección por
  palabra clave probada en aislado, sin falsos positivos. 207/207 tests. Pendiente de
  commit/deploy. Ver `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Branding "sin IA" en la app + barra de progreso +
  rotación de modelos en planos.** Sobre la marcha mientras se probaba el visor de
  planos: (1) Adrián pidió quitar todas las menciones de "IA" en `index.html` — hecho,
  "Planos IA"→"Planos" y similares, `panel.html` NO tocado en esta pasada (pedido
  específico "en la app"); (2) pidió una barra de progreso reutilizable para esperas
  largas — nuevo componente CSS aplicado a las 5 pantallas de espera de IA en móvil
  (generar plano, editar circuitos, OCR de partes/bobinas/albaranes); (3) probando
  "Generar plano" en producción falló de verdad con "Saldo de IA insuficiente" — bug real:
  la cascada de `_generarPlanoInterno` (`worker.js`) solo probaba un modelo gratis de
  OpenRouter antes de Anthropic, sin más opciones si Anthropic fallaba. Corregido:
  rota por 3 modelos gratis antes y después de Anthropic. El chat principal
  (`alejandra-agente/worker.js`) ya tenía cascada robusta, verificado, no tocado.
  Versión → 9.15. Pendiente de commit/deploy. Ver `CHANGELOG.md`.
- Estado (2026-08-26, continuación): **Visor de Planos IA en la app móvil — zoom,
  legibilidad, borrar, editar circuitos.** Adrián probó el apartado de planos de
  ingeniería en `index.html` y encontró: zoom descentrado (bug real, `transform:scale()`
  no cambia el tamaño de layout — cambiado a `zoom`, probado en aislado que el scroll
  crece con el zoom), descripción confusa/pequeña (reorganizada, 13px), y sin borrar ni
  editar. Añadido borrar (reutiliza `DELETE /planos/:id`) y, tras preguntarle a Adrián
  el alcance, edición de circuitos vía modal (reutiliza `PUT /planos/:id/circuitos`, ya
  usado por `panel.html`) — sin editor de dibujo, que se queda solo en el panel. De paso,
  al revisar `generar_plano`/`editar_plano` para el fix de ayer se encontró que ninguna
  de las dos estaba en `toolsEscritura` de `verificarAccionesAfirmadas()` (falso positivo
  real sobre planos legítimos) y que el patrón `/api/planos/` de ayer no correspondía a
  ningún formato de enlace real — corregido, separada la detección esquema/plano.
  Versión → 9.14. 207/207 tests. Pendiente de commit/deploy. Ver `CHANGELOG.md`.
- Estado (2026-08-26): **Alejandra seguía inventando esquemas — corregido a nivel de
  código, no solo de prompt.** Probando en producción con sesión real: un esquema pedido
  justo después de otro que sí se generó de verdad, Alejandra respondió "esquema
  generado y guardado" con dos enlaces `/api/esquemas/view/...` con formato real pero que
  daban 404 — `herramientas_usadas: []`, cero trazas, imitó el formato de su propio éxito
  anterior sin ejecutar la tool. La función `verificarAccionesAfirmadas()` ya existía
  para este tipo de caso pero tenía dos huecos: sus patrones no cubrían "esquema/informe
  generado" (solo "código desplegado"), y en el canal real (`procesarConNEXUSStream`) no
  se llamaba en absoluto — solo en el bucle sin streaming. Añadida detección directa de
  URL de esquema/plano sin la tool correspondiente (máxima fiabilidad, sustituye la
  respuesta completa) y conectada antes de `send()` en las dos ramas de envío único; en
  streaming token a token en vivo (no se puede deshacer lo ya mostrado) se corrige al
  menos el historial guardado y se manda un aviso de corrección en el chat. Verificado
  con el caso real reproducido (sustituye correctamente) y con el caso legítimo (pasa
  intacto, sin falso positivo). 207/207 tests. Pendiente de commit/deploy. Ver
  `CHANGELOG.md`.
- Estado (2026-08-25, continuación): **Panel de memoria estilo Obsidian en Alejandra
  Office — solo desarrollador.** Nueva sección 🧠 Memoria (Obsidian) en `panel.html`
  (lista + backlinks clicables + crear nota), backend nuevo `/api/memoria/*` en
  `alejandra-agente/worker.js` protegido con sesión real + `esDeveloperAgente()`.
  Verificado end-to-end en producción (curl con token real: `memory_save` con
  `enlaces_a`, backlink confirmado en ambos sentidos, datos de prueba borrados después)
  y en el navegador antes de comitear (encontrado y corregido un bug real: `getSession()`
  no existe en `panel.html`, solo la variable `SESSION`). Versión → 9.09. Pendiente de
  commit/deploy final. Ver `CHANGELOG.md`.
- Estado (2026-08-25, continuación): **Memoria enlazada estilo Obsidian — Parte 1 del
  plan, autorizada y aplicada.** Adrián dio el ok explícito para la migración D1.
  Corrección de diseño real encontrada al verificar contra el código antes de migrar: el
  plan asumía `memoria_gobernada` como base, pero esa tabla está vacía y sin ningún
  `INSERT` en todo el repo — `memory_save`/`memory_read` (las tools que de verdad se
  usan) siempre han escrito/leído `alejandra_memoria`. Migración aplicada sobre
  `alejandra_memoria` en su lugar: columna `slug` + tabla `memoria_enlaces` con backlinks
  en ambos sentidos. `memory_save`/`memory_read` extendidos en los DOS workers (misma D1)
  con `enlaces_a` y notas relacionadas. Pendiente, no tocado hoy: endpoint de exportación
  a vault Obsidian real, y la migración de filas `alejandra_memoria`→`memoria_gobernada`
  (deliberadamente aparte). Pendiente de commit/deploy + verificación funcional contra
  producción. Ver `CHANGELOG.md`.
- Estado (2026-08-25, continuación): **SESION-TRANSPARENTE-01 — desplegado.** El chat de
  Alejandra se degradaba a modo anónimo en silencio cuando el token no validaba, sin
  avisar (a diferencia de `apiCall()`, que fuerza relogin ante un 401). Arreglado: nuevo
  evento `sesion_invalida`, consumido en `index.html`/`panel.html` — deja terminar la
  respuesta y avisa/relogin al final. Versión de la app → 9.08. Ver `CHANGELOG.md`.
- Estado (2026-08-25): **Auditoría a fondo del cerebro de Alejandra — EN CURSO, Parte 2
  completa.** Adrián, tras revisar una conversación real donde Alejandra repitió
  respuestas, preguntó lo mismo dos veces y afirmó un diagnóstico técnico inventado
  ("no such column: modelo") como hecho confirmado sin haberlo comprobado, pidió una
  auditoría completa ("audita el cerebro de alejandra a fondo... quiero que alejandra
  sea mas efectiva... mas inteligente") y luego un plan concreto para arreglarlo
  ("prepárame el plan de Obsidian, arreglamos los errores de control de flujo, ahi que
  adelgazar esos promps"). Plan aprobado con tres partes, en
  `C:\Users\Adrian\.claude\plans\radiant-moseying-diffie.md`:
  - **Parte 0 (ya cerrada antes del plan formal):** regla de honestidad técnica en los
    dos workers (nunca afirmar un diagnóstico exacto sin verificarlo en la misma
    conversación), fix de renderizado Markdown al reabrir el chat (index.html/panel.html
    perdían negritas/enlaces al recargar historial — solo la respuesta en vivo los
    tenía), PEMP-FILTRO-01 (vocabulario de filtro "Activas" no aplicaba a PEMP/
    carretillas) y PEMP-GUARDAR-01 (carrera async en el select de obra al editar un PEMP
    ponía `obra_id:null` en silencio), generalización de generación de esquemas más allá
    de motores eléctricos, y sección "DISCIPLINA DE TRABAJO" en el prompt base de los
    dos cerebros (verificar antes de afirmar, preparar contenido completo antes de
    ejecutar una tool, comprobar el resultado real, avisar con transparencia si algo
    falla — a petición explícita de Adrián: "las mismas practicas que un agente de
    codigo"). Todo desplegado y verificado.
  - **Parte 2 (control de flujo) — COMPLETA, pendiente de commit/deploy final:** los 4
    bugs "de riesgo medio" del informe de auditoría (rastro de tool perdido en el
    fallback a modelos gratis, falta de transparencia si la última tool de un turno
    falla sin más reintentos, campos obligatorios poco visibles en
    `gestionar_tarea`/`rfi`/`oc`/`pedido`, y doble llamada al modelo por turno en
    `procesarConNEXUSStream`). Detalle completo en `CHANGELOG.md`. 207/207 tests.
  - **Parte 3 (adelgazar prompts) — COMPLETA y ampliada, pendiente de commit/deploy
    final.** Bloque PRL extraído de `base`/`app` a `prl_seguridad` (carga condicional,
    mismo patrón que `seguridad_no_auth`); `ingenieria_electrica` dividido en sus 4
    secciones (`ie_normativa`/`ie_calculos`/`ie_control`/`ie_esquemas`) con carga por
    sub-tema. Ampliación pedida en la misma sesión: Adrián — "que cada departamento
    tenga su ingeniería... nivel de Alejandra para que sea experta en todos los
    departamentos". De los 12 departamentos reales de la app, 7 con oficio técnico
    propio (mecánicas, telecom, control/CPD, obra civil, albañilería, pintura,
    carpintería) reciben ahora su propio módulo experto (normativa española real +
    cálculos + buenas prácticas, mismo nivel que el eléctrico), cargado por el
    departamento real de sesión del usuario (`sesionAuth.departamento`, ya existía en
    `getAuth` pero no se usaba en el chat) + detección por palabra clave del oficio de
    otro departamento. Detalle completo en `CHANGELOG.md`. 207/207 tests.
  - **Parte 1 (memoria enlazada estilo Obsidian) — NO EMPEZADA.** Requiere migración D1
    aditiva (`ALTER TABLE memoria_gobernada ADD COLUMN slug` + tabla nueva
    `memoria_enlaces`) — **necesita autorización explícita de Adrián antes de
    aplicarla**, no tocar sin pedirla primero. Diseño completo en el plan.
  - Ver el plan completo para el detalle de cada parte y el criterio de verificación.
- Estado (2026-08-19, confirmado por Adrián en su móvil real): **Sondas CPD en el móvil —
  cerrado, sin pendientes.** Tras las rondas 1-2 (abajo), Adrián siguió probando de forma
  activa y encontró tres cosas más, las tres corregidas, desplegadas y verificadas en
  producción: (1) el layout del editor de plano nunca tuvo un alto real —
  `screenCpdPlanoDetalle` no tenía las clases `flex-screen`/`height:100%` que sí tiene el
  resto de pantallas de `index.html`, así que el plano se dimensionaba solo por su
  contenido en vez de ocupar el espacio disponible (bug estructural desde que se creó la
  pantalla, no algo introducido en esta ronda); (2) `touch-action:pan-y` solo dejaba
  desplazar el plano en vertical — con el zoom por ancho real, el plano también se hace
  más ancho que la pantalla y ese eje estaba bloqueado del todo, cambiado a `pan-x
  pan-y`, más zoom con gesto de pellizco (dos dedos, anclado al punto medio, ignorado
  mientras hay una sonda en arrastre); (3) el botón de generar informe nunca se había
  portado al móvil (existía solo en Office, con `window.open()`) — añadido con vista
  interna en un modal (mismo patrón que el informe de Telecom Racks), y tras probarlo con
  un plano real de 41 sondas, marcadores reducidos y tabla simplificada a #/Nombre/Nº
  serie. Confirmado por Adrián: "vale mucho mejor, ahora si". Detalle completo en
  `CHANGELOG.md` (varias entradas del 2026-08-19) y `HANDOFF.md`.
- Estado (2026-08-19, 2ª ronda): **Sondas CPD en el móvil — el fix de la 1ª ronda (abajo)
  no era suficiente.** Se verificó con un plano de prueba (1 sonda, sin densidad) y pasó,
  pero Adrián lo probó con un plano real y denso ("Modelo Liquid Cooling 1") y encontró
  el bug de verdad: "cuando pulso en una sonda para moverla saltan las opciones del
  navegador". `-webkit-touch-callout:none` solo frena iOS Safari; en Android/Chrome el
  mantener-pulsado dispara su propio menú contextual (`contextmenu`) que gana la carrera
  al timer de arrastre de 350ms si no se cancela explícitamente — causa real de "no se
  pueden reubicar". Corregido con `preventDefault()` en `contextmenu`. También: zoom
  cambiado de `transform:scale()` a ancho real (el transform + `overflow:auto` daba
  problemas de arrastre al ampliar), y marcador bajado de 40px a 30px (a 40px se solapaban
  en un plano denso). Lección para próximas verificaciones de gestos táctiles: un
  navegador de pruebas sin chrome nativo de Android/iOS no reproduce el menú contextual
  ni el solape real de un plano con muchas sondas — hace falta probar en el dispositivo
  real o con un dataset de prueba realista, no solo 1-2 elementos.
- Estado (2026-08-19, 1ª ronda): **Sondas CPD en el móvil (departamento Control) — mismo
  tipo de fix de usabilidad que Racks (abajo).** Adrián: "el plano se ve pequeño y las
  sondas no se puden reubicar". Se porta el zoom que ya tenía Office (＋/－/↺), marcador
  de sonda subido de 26px a 40px, y tolerancia de movimiento durante la pulsación larga
  subida de 8 a 16px. Verificado con un plano de prueba mínimo — insuficiente, ver ronda
  2 arriba.
- Estado (2026-08-19): **Racks en el móvil — usabilidad real corregida tras pruebas de
  Adrián con el dedo.** Reportó de golpe: rack pequeño, "los modulos no se pueden mover,
  esta la opcion pero no funciona", llenado por defecto arriba-abajo, agujeros de
  montaje visibles, y 3 módulos nuevos (Ventilación, Pasacables, Pantalla 4U). Se
  encontraron y corrigieron DOS bugs reales al investigar el reporte de "no funciona":
  (1) al móvil le faltaba `flex-direction:column-reverse` en el contenedor de filas —
  mostraba la U1 arriba en vez de abajo, al revés de un rack real (Office ya lo tenía
  bien); (2) tocar el propio módulo en modo "mover" lo confirmaba en su misma posición
  (el backend lo acepta al excluirse del choque), pareciendo que no pasaba nada. El hueco
  vacío ahora escala su altura con su nº real de U en vez de una banda fija (un rack
  vacío arranca alto de verdad y crece al montar módulos), chasis más ancho, y toque
  mínimo de 44px. Colocar ya no depende de la precisión del toque: monta el módulo
  pegado al techo del hueco tocado. Tres módulos nuevos con `tipo` propio en el backend
  (`ventilacion`/`pasacables`/`pantalla`, sin puertos de red) en los dos frontends.
  Detalle completo en `CHANGELOG.md`.
- Estado (2026-08-18, continuación final): **Racks/Cuadros v2 portados a la app móvil
  (`index.html`), toca-y-toca — completo, desplegado y verificado.** Cierra la ronda de
  hoy: el mismo diagrama de rack y los cuadros de campo v2 que se construyeron en Office
  ahora también funcionan en móvil, con arrastre sustituido por "toca una plantilla/módulo
  → toca el hueco" (más viable con el dedo en pantalla pequeña — decisión de Adrián tras
  planteársela). Paleta en hoja inferior en vez de barra horizontal. Cuadros dentro del
  IDF con componentes en carril DIN (ahí, sin toca-y-toca: se añaden al final y se
  reordenan con flechas, el orden no tiene restricción física real). De paso: arreglada
  una regresión real (creación de cuadro en móvil mandaba campos que el backend ya no usa,
  creaba cuadros sin componentes en silencio), repuesto el campo Ubicación perdido al
  reestructurar el formulario de cuadro (móvil y Office), e iconos de puerto RJ45/fibra en
  móvil. Verificando en producción con viewport móvil real se encontró y corrigió un bug
  de condición de carrera (el modal de edición se abría antes de que el caché tuviera el
  elemento recién creado). Probado de extremo a extremo con datos de prueba reales,
  borrados al terminar. La app móvil llega así a paridad completa con Office en Telecom.
  Sin pendientes de esta ronda. Detalle completo en `CHANGELOG.md`.
- Estado (2026-08-18, continuación): **TELECOM-CUADRO-02 — código completo y desplegado
  (Worker + Pages), migración D1 PENDIENTE de aplicar.** Continuación directa de
  TELECOM-ELEVACION-01 (abajo): Adrián recordó que faltaba "el otro modelo... cuadro
  exterior donde podiamos elegir un switch gestionado" y pidió el mismo tratamiento visual
  ("al igual que los IDF... mismo estilo que con los IDF no?"). Los cuadros de campo (antes
  pantalla propia a nivel de obra) se mueven dentro del IDF y pasan de "un switch" a una
  caja IP65 con componentes sueltos en carril DIN (switch/fuente/POE/hub de fibra/
  personalizado), arrastrables igual que los racks. Vínculo real por fibra: IDF → panel de
  fibra → puerto libre concreto, que queda ocupado con el nombre del cuadro. Backend
  completo (2 tablas nuevas + 1 columna, endpoints, validación) y frontend completo
  (paleta, diagrama, drag, modal en cascada) escritos, verificados con `node --check` y sin
  corrupción de encoding, comprometidos y desplegados a producción.
  ⚠️ **La migración D1 no se ha podido aplicar**: el clasificador de seguridad del modo
  automático bloqueó los `wrangler d1 execute` (no las reglas del proyecto, que ya lo
  tenían autorizado tras confirmar por lectura que las tablas afectadas estaban vacías).
  Los 3 comandos exactos están en `migrate_telecom_cuadros_v2.sql` y en el mensaje del
  commit `c8642b6`. Hasta que se ejecuten, crear/editar un cuadro de campo o sus
  componentes dará error 500; el resto de la app (incluido el diagrama de racks) no se ve
  afectado — la carga de cuadros dentro del IDF falla en silencio y esa sección
  simplemente no aparece. Detalle completo en `HANDOFF.md`/`TASKS.md`/`CHANGELOG.md`.
- Estado (2026-08-18): **TELECOM-ELEVACION-01 completada, desplegada y verificada —
  diagrama visual de rack con arrastrar-y-soltar (Racks/Cableado, Office).** Adrián:
  "quiero darle una vuelta al tema racks en telecom... lo quiero hacer mas visual todo".
  La vista de un rack pasa de lista plana a diagrama de elevación real (armario de pie o
  de pared, filas U de abajo a arriba); paleta de plantillas de módulo (Cisco, Ubiquiti,
  Panduit/genérico, personalizado) arrastrable al armario para montarlas, reutilizando el
  mismo patrón pointerdown/pointermove/pointerup y el zoom ya probados en Sondas CPD.
  Clic en un módulo montado entra directo a su gestión de puertos, ya existente. El IDF
  muestra sus racks lado a lado compartiendo suelo, no apilados ("cuando haya dos quiero
  verlos juntos"). Dos tipos de rack (pared 12U / pie 42U por defecto, ≈1,86m real —
  Adrián: "aquí se utilizan rack de 1,80mts"), cada uno con su propio dibujo. Backend:
  columnas aditivas `altura_u`/`tipo` en `telecom_racks` y `pos_u_inicio`/`pos_u_altura`
  en `telecom_patch_panels`, con validación de solape/límites en servidor (409). Diseño
  visual iterado con Adrián antes de tocar código (mockups vía herramienta de
  prototipado, 3 rondas de feedback: grounding físico del rack, racks lado a lado, escala
  real). Verificado en producción con datos de prueba (creados y borrados en la misma
  sesión): rack de cada tipo con altura correcta, colisión de módulos rechazada con 409,
  reposición por arrastre, clic en módulo → puertos. Pendiente para otra ronda: portar a
  `index.html` (app móvil), igual que Correos. Detalle completo en
  `HANDOFF.md`/`TASKS.md`/`CHANGELOG.md`.
- Estado (2026-08-17): **CORREOS-PANEL-01 completada, desplegada y verificada — pendiente
  solo que Adrián pruebe en vivo la sincronización real con su Gmail** (planificada con
  `EnterPlanMode`/`AskUserQuestion` antes de tocar código: sin permisos nuevos de Google,
  "organizar" es una categoría propia de la app; pensada para cualquier usuario con Gmail
  conectado). De paso, **`BUGFIX-CACHE-PROMPT-01`**: bug real encontrado investigando un
  aviso de Anthropic sobre baja tasa de acierto de caché de prompts que Alejandra había
  diagnosticado mal — dentro del bucle de `delegar_tarea`, la 2ª+ llamada a Anthropic
  perdía la regla de `esDevVerificado` (rompía el caché Y reabría parcialmente una fuga de
  detalle técnico cerrada esta misma sesión). Cerrados también dos pendientes antiguos:
  informe de fichajes imprimible (`INFORMES-FICHAJES-01`) y Almacén viendo material de
  todos los departamentos desde el móvil (`ALMACEN-FILTRO-MOVIL-01`). Detalle completo en
  `HANDOFF.md`/`TASKS.md`/`CHANGELOG.md`.
- Estado (2026-08-17, continuación): **CORREOS-PANEL-01 expandido con pruebas en vivo de
  Adrián** — borrar correo (confirmación, distinto de archivar), selección múltiple por
  checkbox, adjuntos al redactar (hasta 20MB), y **varias cuentas de Gmail con cambio
  rápido entre ellas** ("yo me refería a tener dos cuentas a la vez e ir cambiando una a
  otra rápido" — tabla nueva `gmail_cuentas`, migración aditiva autorizada) con aviso de
  correo nuevo para las dos cuentas. Dos bugs reales encontrados por Adrián probando el
  envío en producción, corregidos y verificados: el botón de redactar decía "Guardar" en
  vez de "Enviar", y adjuntar un archivo real rompía el envío ("Maximum call stack size
  exceeded" — `_b64u()` con spread sobre buffers grandes). Después, a raíz de un
  "arregla esto" sobre un modal de Racks/Cableado, **`TELECOM-NAV-01`**: los modales de
  IDF/Rack/Módulo/Puerto de esa sección no tenían padding interior (contenido pegado al
  borde) y el auto-refresh de 60s de la página reseteaba la navegación a la lista de IDFs
  sin mirar en qué nivel estaba el usuario — guardar un puerto podía devolver a la lista de
  IDFs en vez de a la vista de Puertos. Los dos corregidos, desplegados y verificados en
  vivo contra producción con datos de prueba (creados y borrados en la misma sesión).
  Detalle completo en `HANDOFF.md`/`TASKS.md`/`CHANGELOG.md`.
- Estado (2026-08-17, noche): **TELECOM-NAV-01, ronda de hardening antes de datos reales.**
  Adrián: "vamos a empezar a meter datos de verdad y no puede fallar". Auditoría del módulo
  Racks/Cableado completo (backend + los dos frontends): el backend permitía borrar
  IDF/rack/patch panel/cuadro por API a cualquier usuario del departamento telecom, aunque
  ambos frontends ya restringían el botón a roles responsables — cerrado, alineando el
  backend con esa misma lista de roles. Nombre y campos de puerto sin límite de longitud
  (a diferencia del resto de campos del módulo) — alineados a 160/1000 caracteres, backend
  y frontend. Confirmación de borrado de patch panel/cuadro ahora avisa cuántos puertos
  tienen datos reales antes de confirmar. Verificado en producción con un usuario de
  prueba operario/telecom real (DELETE bloqueado con 403; con rol autorizado, 200; nombre
  de 200 caracteres rechazado con 400). Sin pendientes.
- Estado (2026-08-17, noche — toque profesional): a petición de Adrián, verificado en vivo
  el flujo completo (crear IDF→Rack→Módulo→Puerto en los dos frontends, navegación
  correcta en cada guardado) y aplicadas mejoras visuales: conteos por nivel (racks por
  IDF, módulos por rack), icono según tipo real de módulo (cobre/fibra/switch), breadcrumb
  con ruta completa en Puertos, y celdas de puerto de tamaño fijo en el informe (antes se
  hacían enormes en páginas anchas — "son demasiado grandes"). Verificado en producción
  con datos de prueba, borrados al terminar. Sin pendientes.
- Estado (2026-08-17, noche — Informe Semanal de Seguridad): ronda completa a raíz de una
  captura de Adrián (título del topbar roto en 3 líneas, solapado con el contenido —
  `.topbar-title` sin `white-space:nowrap`, fix global) y de pedir revisar el informe de
  Seguridad: botón "✏️ Plantilla" que nunca abría el modal (`GET /mi-empresa` sin
  `ok:true`); tres huecos de paridad app/panel cerrados en Office (iniciar informe de
  semana nueva, editar actividad ya guardada, añadir foto extra a una actividad
  existente); pie de foto con título, visible en el `.docx` y en la impresión (migración
  D1 autorizada: `informes_seg_fotos.titulo`). Verificado en producción con un informe
  completo de prueba en los dos frontends. Sin pendientes.
- Estado (2026-08-17, noche — OBRA-AUTO-01): "las obras se deben de detectar solas en el
  panel no? los usuarios ya tienen obras asignadas". Causa raíz: `GET /obras` da 403 a
  encargado/operario a propósito (decisión ya tomada antes, el backend de cada endpoint
  ya fuerza su obra de sesión), pero `cargarObrasPanel()` no manejaba ese error con
  gracia y abortaba silenciosamente — dejando 130+ selectores de obra del panel vacíos
  para estos roles, y rompiendo también un mecanismo que ya ocultaba 4 selectores
  especiales por el mismo motivo. Arreglado el manejo del error y extendido el criterio
  de "ocultar si no puede elegir de verdad" a la función genérica compartida. Verificado
  en producción con un usuario de prueba `encargado` (selector oculto) y con la cuenta
  admin (selector poblado normalmente). Sin pendientes.
- Estado (2026-08-17, noche — Correos): "porque no ahí la opción de marcar como leídos" /
  "entonces nunca se quita las notificaciones" — solo existía leído/no-leído correo a
  correo; nuevo botón "✅ Marcar leídos" en la barra de selección múltiple de "Mis
  Correos". Verificado en producción (badge de 1→0 tras seleccionar y marcar, datos de
  prueba sembrados directamente en D1 y borrados al terminar). Sin pendientes.
- Estado (2026-08-17, noche — Sondas CPD): "vamos a arreglar la función de sondas salas" —
  mismo patrón de bug ya visto en Telecom (padding-cero en los modales de plano/sonda +
  auto-refresh de 60s que sacaba al usuario del plano en el que trabajaba) confirmado
  también aquí, mismo fix. Además, a petición de Adrián: quitado el ancho máximo
  artificial del plano (900px fijo, mientras su contenedor no lo tenía — "el plano es
  demasiado pequeño y al colocar las sondas no caben") y añadidos controles de zoom
  ＋/－/↺ ("podemos hacer que se pueda ampliar el plano"). Verificado en producción con
  datos de prueba reales (zoom 900px→1350px al 150%, posición de sonda calculada
  correctamente con el zoom aplicado). Sin pendientes.
- Estado (2026-08-17, noche — muñeco de EPIs): "los chalecos son amarillos o naranjas,
  pero no verdes. Las botas también, suelen ser negras o grises" — el color de estado
  (ok/caduca/caducado) pintaba el relleno de la prenda en el muñeco de dotación; ahora el
  relleno usa el color real de cada EPI y el estado se indica en el borde. Mismo fix en
  `panel.html` e `index.html`. Verificado en producción con EPIs de prueba reales
  (chaleco activo → naranja + borde verde; botas caducadas → negro + borde rojo). Sin
  pendientes.
- Estado (2026-08-13/14): **Sesión larga de repaso manual de la app junto a Adrián,
  completada y desplegada.** "Vamos a revisar la app que tiene cosillas que arreglar" →
  cuatro bugs reales encontrados navegando `panel.html` en vivo (pestañas de Documentos
  ignorando el departamento del topbar, dashboard con 4 KPIs sin actualizar,
  `delegar_tarea` sin feedback en el chat, botón de scan remoto visible sin móvil
  conectado) → compatibilidad con la plataforma CAE externa Nalanda (ficha + pictogramas
  de oficios/máquinas, investigado que no tiene API pública) → repaso departamento por
  departamento del menú de `index.html` contra la curación ya existente en `panel.html`
  (Control, Ingeniería, Obra Civil y sus 3 subtrades, Almacén; tarjeta "Alejandra IA"
  redundante eliminada; RdP/Hormigonado/Formación reasignados a Seguridad/Obra Civil/
  Personal) → ronda de mejoras al Informe Semanal de Seguridad a raíz de que una técnica
  real (Katy) no entendía el flujo (navegación por semanas, editar actividades, cerrar y
  generar el documento final también desde el móvil, crear/borrar informes enteros desde
  Office). Todo verificado por sintaxis/encoding; la mayoría además en vivo en el
  navegador contra producción. Ver secciones dedicadas más abajo y detalle completo en
  `TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`. **Pendiente sin decidir, explícito:** que
  Almacén vea material de otros departamentos desde el móvil (como ya hace en
  `panel.html`); plantilla del documento final del Informe Semanal editable por el
  usuario; agrupación Obra Civil sin verificar en vivo (Levitec no tiene esos
  departamentos activos).
- Estado (2026-08-13, tarde): **BOTONES-FEEDBACK-01 completada, desplegada y verificada** —
  ~95 botones "Guardar" sin feedback visual en `index.html`/`panel.html`/`alejandra-panel.html`
  (helper `conBoton()`), a raíz de que Adrián generó 3 entradas duplicadas al pulsar varias
  veces el guardado del informe semanal de Seguridad. Encontrado durante la auditoría un bug
  crítico independiente ya corregido por separado: `apiCall()` perdía el body en 24 llamadas
  de 7 módulos por pasarle 3 argumentos en vez de 2 — casi 7 semanas de pérdida silenciosa de
  datos en producción desde el 24/06/2026. Ver sección dedicada más abajo.
- Estado (2026-08-13): **INFORMES-SEG-SEMANAL-01 completada, desplegada y verificada en
  producción** — informe interno semanal de Seguridad y Salud Laboral por obra, calcado de
  la plantilla real de Levitec, con generación real de documento final (PDF y `.docx`).
  Primera dependencia npm real de `worker.js` (`docx`); pipeline de deploy actualizado
  (`npm ci`). Ver sección dedicada más abajo.
- Estado (2026-08-12, noche): **F6.1-AYUDANTES-PEDIDOS y F6.1-AYUDANTES-CORREOS verificados
  en vivo en producción**, con varios bugs reales encontrados y corregidos en la propia
  verificación (ver sección dedicada más abajo). Único pendiente real: Adrián habilita la
  Gmail API en el proyecto de Google Cloud correcto (paso manual, en curso).
- Estado: F-0.1 **integrada y activa en remoto**. ARC-011 fases 1 y 2 completadas; ARC-012 resuelto con tres migraciones aplicadas y verificadas. **ARC-011 fase 3 completa: las 14 verticales tienen el ciclo de 5 pasos de ADR-0011 cerrado** (los ocho de los dos primeros lotes más los seis del tercer lote, desplegados y verificados el 2026-08-03, run 30839201968). No queda ninguna tarea de ingeniería activa de ARC-011. Se corrigió un bug real del chat de Alejandra en `panel.html` (PR #76, paridad verificada: no afecta a `index.html`/`alejandra-panel.html`). **`F-0.2-CFG` (secretos al entorno `production`) ejecutada por el Director el 2026-08-04**, con verificación previa de un despliegue exitoso; ver sección dedicada más abajo. **Época 2 (F-2.1) con lectura y escritura de `memoria_gobernada` desplegadas y verificadas (2026-08-04, PR #81).** **`ADR-0015`/ARC-019 aceptado, implementado, desplegado y verificado (2026-08-04, PR #85):** `sql_query` sube a N3; `CREATE TABLE`/`CREATE INDEX` exige confirmación humana (`CONFIRMO MIGRACION`) en `sql_query`/`run_migration`. **`P-ARCH-003` (consulta de versión remota) fusionada y publicada en Pages (2026-08-04, PR #82).** No queda ninguna tarea de ingeniería activa sin decisión del Director pendiente.

## Repaso guiado de Alejandra Office — 4 bugs reales encontrados en vivo (2026-08-12/13)

Cuatro fixes independientes encontrados navegando `panel.html` en producción junto a
Adrián, sin agenda previa: pestañas de Documentos ignorando el departamento elegido por
un admin en el topbar (`DOCS-TABS-DEPT-02`); dashboard principal con Trabajadores
activos/Obras activas/Equipos averiados/Alertas de stock sin actualizar nunca, por campos
que el backend no mandaba o mandaba con otro nombre (`DASHBOARD-KPIS-VACIOS-01`);
`delegar_tarea` (ayudante de Correos, entre otros) sin ningún evento SSE mientras
trabajaba — el chat se quedaba en "Pensando" en silencio (`DELEGACION-SSE-01`); botón de
scan remoto en Office visible siempre aunque no hubiera móvil conectado, pulsarlo solo
producía un error (`FAB-SCAN-OCULTO-01`). Los cuatro desplegados y verificados. Detalle
completo en `TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`.

## COMPAT-CAE-01 — compatibilidad con plataformas CAE externas (Nalanda) (2026-08-13)

Adrián: "tenemos otra app que gestiona documentación de trabajadores y genera tarjetas...
necesitamos ser compatibles con ellos" — investigado antes de tocar código que Nalanda
(la plataforma en cuestión, confirmada por una foto de la tarjeta real de Adrián) no
publica API ni spec abierta; es un puente manual, no integración automática. Ficha
imprimible con Oficios/Máquinas habilitadas (mismas categorías que la tarjeta real de
Nalanda) y pictogramas en la tarjeta con QR existente. Nuevo endpoint
`/trabajador-documentacion` (carnets+EPIs+reconocimiento médico sin detalle clínico,
mismo nivel de acceso que Reconocimientos). Detalle completo en `TASKS.md`/`HANDOFF.md`/
`CHANGELOG.md`.

## APP-REPASO-DEPARTAMENTOS-01 — repaso departamento por departamento del menú móvil (2026-08-13/14)

Adrián: "vamos departamento por departamento" — cruzado el menú genérico de `index.html`
contra la curación real ya existente en `panel.html`, confirmando cada cambio antes de
aplicarlo. Control pierde PEMP/Carretillas (departamento de monitorización de salas CPD,
sin maquinaria); Ingeniería se deja como está (paridad completa con su sección técnica de
Office queda fuera de alcance); Obra Civil/Albañilería/Pintura/Carpintería confirmadas
sin cambios (ya tenían el menú completo) y agrupadas visualmente bajo una tarjeta "Obra
Civil" (sin jerarquía real en el dato — se evaluó y se descartó por riesgo sobre el
aislamiento por departamento); Almacén reducido a solo material+pedidos. De paso: bug de
flexbox en las tarjetas del selector (chevron empujado fuera con nombres largos), tarjeta
"Alejandra IA" redundante eliminada de todos los departamentos (el botón central de la
barra inferior ya lleva al chat desde cualquier pantalla), y RdP/Hormigonado/Formación —
sin ningún criterio de pertenencia por departamento, pendiente ya anotado sin decidir —
reasignados a Seguridad/Obra Civil/Personal. Detalle completo en `TASKS.md`/`HANDOFF.md`/
`CHANGELOG.md`.

## INFORMES-SEG-CIERRE-01 — gestión completa del Informe Semanal en los dos frontends (2026-08-13)

Katy (técnico real) probó el Informe Semanal recién construido y no entendía el flujo
("no veo el botón para generar informe" / "tampoco se pueden editar o agregar más a un
informe del día anterior"). Adrián: "arréglalo tú todo". Añadida navegación por semanas
anteriores y edición de actividades ya guardadas (antes solo crear/borrar); cerrar el
informe y generar el documento final (Word/PDF) también desde `index.html` (antes solo
desde Office); crear y borrar informes semanales enteros desde `panel.html` (antes solo
existía la creación desde el móvil, y no se podía borrar ningún informe en ningún sitio);
placeholders de ejemplo en los 3 campos de texto libre del cierre, que ni Adrián tenía
del todo claros. Pendiente explícito y aparte: plantilla del documento final editable por
el usuario. Detalle completo en `TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`.

## BOTONES-FEEDBACK-01 — feedback en ~95 botones + bug crítico de datos (2026-08-13, tarde)

Adrián probó el informe semanal de Seguridad, el guardado tardó y pulsó varias veces —
generó 3 entradas duplicadas. Escalado a "necesitamos feedback en los botones... en toda la
suite" y "lanza varios agentes para ver lo de los botones en toda la app". Tres agentes de
exploración auditaron los tres frontends en paralelo y encontraron ~95 sitios sin indicio de
"en curso". Fix: helper `conBoton(btn, fn, textoOcupado)` por archivo, aplicado con un
cambio de una línea por sitio. Colateral: durante la misma auditoría se encontró y corrigió
por separado (commit `7d83661`, antes que este backlog) un bug crítico de pérdida silenciosa
de datos — `apiCall()` con 3 argumentos en vez de 2 en 24 llamadas de 7 módulos, casi 7
semanas en producción desde el 24/06/2026. Ambos desplegados en Pages y verificados. Detalle
completo en `TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`.

## INFORMES-SEG-SEMANAL-01 — informe interno semanal de Seguridad (2026-08-13)

Adrián: "es un informe a nivel interno para los técnicos de cada obra, tengo una plantilla...
por si de alguna manera podemos facilitar hacerlo al técnico". Calcado de la plantilla Word
real de Levitec. Migración D1 de 3 tablas autorizada explícitamente. Técnico captura
actividad+contratista+foto desde `index.html` (el informe de la semana se resuelve solo por
fecha); Seguridad revisa/cierra desde `panel.html` y genera PDF o `.docx` real. Primera
dependencia npm de `worker.js` (`docx`, generado con `Packer.toArrayBuffer()` — probado antes
de usarlo que `toBuffer()` falla en el runtime real de Workers). Pipeline de deploy
actualizado (`package.json`/lockfile trackeados, `npm ci` en `deploy-worker.yml`). Probado en
vivo de extremo a extremo contra producción, incluida verificación byte a byte del `.docx`
generado. Detalle completo en `TASKS.md`/`HANDOFF.md`/`CHANGELOG.md`.

## Verificación en vivo de F-6.1 (Pedidos + Correos) — hallazgos y fixes (2026-08-12, noche)

Sesión de verificación real en producción (login de prueba en empresa demo para Pedidos; sesión
real del Director para Correos) que encontró y corrigió una cadena de bugs reales, todos
desplegados y documentados en `TASKS.md`/`CHANGELOG.md`/`HANDOFF.md`:

1. **PEDIDOS-AYUDANTE-DEPT-01**: el ayudante de Pedidos dejaba que el modelo inventara el
   `departamento` del pedido en vez de usar el de la sesión real — el pedido quedaba invisible
   al filtrar por departamento. Corregido: se resuelve siempre desde `usuarios.departamento`.
2. **CATALOGO-PROVEEDORES-01/02**: a petición del Director, Hilti/Pemsa/Würth dados de alta como
   proveedores; el ayudante de Pedidos recibió la tool `buscar_web` (en vez de una tabla estática
   de referencias inventadas) para buscar productos reales cuando no los conoce. De paso, fix de
   un bug real: el autorrelleno de email al enviar un pedido por correo consultaba una tabla sin
   columna email, roto en silencio desde siempre.
3. **CORREO-AYUDANTE-ROUTING-01**: Alejandra negaba tener acceso a Gmail pese a que el ayudante
   de Correos ya estaba desplegado y conectado — dos causas reales: mensajes sobre correo se
   clasificaban a veces como experto `web` (sin `delegar_tarea` disponible), y aun clasificados
   correctamente como `app`, el modelo no usaba la tool y respondía inventando que faltaba
   implementar OAuth2. Fix: regla determinista de enrutamiento + regla explícita de prompt.
4. **CHAT-SCROLL-INICIAL-01**: el chat ✨ de `panel.html` no bajaba al último mensaje al abrirlo
   (parecía "no guardar el historial"). Publicado en Pages.
5. **CORREO-CREDENCIALES-01 / AYUDANTE-DETALLE-TECNICO-01**: tras empezar a funcionar la
   delegación, un error real de Gmail (API sin habilitar en el proyecto de Google Cloud) llevó
   al ayudante a improvisar un flujo de OAuth2 manual pidiendo credenciales por chat — corregido
   con grounding explícito. Además, ese detalle técnico se mostraba igual a cualquier rol —
   Director: "Alejandra no puede decir estas cosas a los usuarios, a mí sí" — ahora el prompt del
   ayudante se construye según `esDevVerificado`: detalle técnico completo solo para el Director,
   frase fija sin tecnicismos para cualquier otro usuario.

**Pendiente real, único bloqueo:** el Director habilita la Gmail API en el proyecto de Google
Cloud correcto (`console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=516059806212`)
— paso manual, en curso. Una vez habilitada, repetir la prueba de lectura y la de envío
(`CONFIRMO ENVIO`).

### F-6.1 Fase 2 — Ayudante de Correos, piloto Gmail personal — contexto de construcción

Piloto sobre la cuenta Gmail personal del Director (decisión explícita: de los tres proveedores
posibles — Workspace, Microsoft 365, IMAP genérico — se probó primero con la cuenta personal,
vía OAuth 2.0 real con `access_type=offline`; la delegación a nivel de dominio queda para un
piloto Workspace futuro). Se construyó de cero un flujo OAuth **separado** del login por Google
existente (que solo pide `access_type=online` y nunca obtiene `refresh_token`), un cifrado en
reposo AES-GCM para el `refresh_token` (no había ningún patrón reversible previo en el repo), y
una barrera de confirmación humana `CONFIRMO ENVIO <código>` para `enviar_gmail` — frase y `Set`
separados de `CONFIRMO BORRADO`, mismo criterio que `CONFIRMO MIGRACION` en `worker.js` raíz, para
que un código de una frase nunca autorice la operación de la otra. Detalle completo en
`TASKS.md` (`F6.1-AYUDANTES-CORREOS`).

## F-6.1 — Ayudantes: delegación acotada (2026-08-12, ADR-0022)

A petición del Director ("que Alejandra tenga ayudantes para administrar los flujos de trabajo,
ella como coordinadora que delega") se abre `F-6.1`, hasta ahora `Pendiente`. La sesión revisó dos
proyectos externos del Director (Nexus Core/Agent, GetawayAgentes) sin adoptar ninguno tal cual:
se toma la idea de delegación de GetawayAgentes pero no su arquitectura de gateway separado
(Durable Objects, registro/ciclo de vida de agentes), que duplicaría el Tool Registry y el Motor
de Decisión ya existentes; de Nexus Core se descartan explícitamente navegador interno, control
de PC y modo Auto por contradecir `ADR-0007` (reversibilidad).

`ADR-0022-AYUDANTES-DELEGACION-ACOTADA.md` reabre de forma acotada la interpretación C de
`ADR-0008` (rechazada en 2026-08-02): un "ayudante" es una invocación explícita de Alejandra a un
sub-agente con tools ya existentes del catálogo, bajo las mismas barreras N0-N3, traza y
aislamiento por `empresa_id` que cualquier tool directa — nunca autonomía abierta ni instalación
de capacidades nuevas. Documenta además la excepción de dependencia `F-5.1` (gobierna
capacidades externas nuevas, no aplica a delegar sobre el catálogo propio) y dos correcciones de
alcance surgidas en la conversación: WhatsApp es el canal de empresa por usuario (nunca WhatsApp
personal — se descartó explícitamente por riesgo real de delito, art. 197 CP), y la futura
asesoría legal/financiera informa y redacta, nunca ejecuta sin confirmación humana.

**Piloto Fase 1 en curso:** mecanismo de delegación genérico (tool `delegar_tarea` + registro
`AYUDANTES`) y ayudante "Pedidos" sobre la tabla `pedidos` ya existente, sin integraciones
externas ni migración D1. Fases 2-5 (Correos, WhatsApp Business, asesoría legal/financiera,
rutinas programadas + reflexión periódica) quedan documentadas en el ADR como roadmap, cada una
con su propia decisión antes de empezar — mismo patrón que ARC-011 y Nexo v1. Ver `TASKS.md`.

## Fix — TABULATOR-RACE-01 (2026-08-11)

Encontrado al verificar en vivo los fixes de Pedidos: `RangeError: Maximum call stack size
exceeded` en Tabulator, reproducido una vez en Chrome real. Causa raíz: un listener de
`visibilitychange` podía relanzar `cargarDashboard()` mientras la carga inicial seguía en
curso, saturando el hilo principal justo cuando se creaba `tblPedidos` por primera vez
(`layout:'fitColumns'`), lo que hacía que Tabulator se reentrara a sí mismo. Guard de
reentrancia añadido; no relacionado con ningún cambio de esta sesión. Verificado en vivo
tras desplegar (Pages, commit `69d441c`). Detalle en `HANDOFF.md`.

## Auditoría del módulo de Pedidos de material (2026-08-11)

## Auditoría del cerebro de Alejandra — correcciones de aislamiento (2026-08-11)

La nueva auditoría confirmó mejoras reales en el Motor de Decisión (N0/N1 con decisión previa y trazas), pero detectó cuatro defectos: `recuperar_conversacion` podía devolver resúmenes de otros usuarios; `leer_estado` exponía métricas globales a cualquier sesión; una traza de decisión que fallara al persistir no bloqueaba la tool; y `memory_save` remitía título/contenido de incidencias a Telegram. El fix `SEC-AGENT-AUDIT-ISOLATION` limita los resúmenes al `usuario_id` autenticado, acota estado/memoria por tenant y logs por usuario, hace fail-closed la traza de decisión y reduce Telegram a una notificación sin contenido. No requiere migración D1 ni modifica datos existentes. También actualiza la `compatibility_date` del Worker a `2026-08-11`.

A petición de Adrián, mismo criterio que Personal/Fichajes. 4 bugs reales confirmados y
corregidos: **Almacén (y Seguridad) nunca veían pedidos de otros departamentos** pese a ser
su función documentada (`getPedidos` no incluía `departamento==='almacen'`/
`isDeptPrivileged` en su chequeo de admin, a diferencia de todos los demás módulos de
inventario); **vocabulario de estados distinto entre panel.html
(`pendiente/aprobado/entregado`) y worker.js+index.html (`pendiente/solicitado/recibido`)**
— un pedido gestionado desde un lado quedaba huérfano en el otro (sin icono, sin botones de
gestión); **`solicitado_por` siempre `NULL`** para pedidos creados desde la app móvil (sin
fallback al usuario autenticado); **informe semanal por email subestimaba pedidos
pendientes** (solo contaba `'pendiente'`, no `'solicitado'`). Alineado `panel.html` al
vocabulario ya correcto de `worker.js`/`index.html` (no al revés). Verificado por
sintaxis/encoding; tabla `pedidos` vacía en producción en el momento de la auditoría, así
que los bugs eran reproducibles pero no se habían manifestado aún con datos reales.
Desplegado (Worker + Pages). Detalle completo en `HANDOFF.md`.

## ARC-022, cierre de la sesión — foto por móvil + fix de sidebar duplicado (2026-08-11)

Última vuelta: "hacer foto con el móvil" para la ficha de un trabajador, reutilizando al
100% el mecanismo de escaneo remoto ya existente (`sync_dispositivos`/`sync_eventos`, sin
QR ni WebSocket, emparejamiento implícito por `usuario_id`) — nuevo subtipo `foto_perfil`
tanto en `worker.js` (`_procesarScanResultado`) como en `panel.html`
(`rsPedirFotoTrabajador`, botón 📱 junto al avatar) e `index.html` (reenvío de
`destino_tipo`/`destino_id` en el resultado). Además, fix de un bug real reportado por
Adrián: dos secciones "🔺 Seguridad" duplicadas en el sidebar del panel cuando un admin ve
"Todos los departamentos" (el directorio de departamentos creaba un bloque nuevo en vez de
usar el ya existente). Verificado por sintaxis/encoding; sin verificación visual en
navegador con dos dispositivos reales (queda pendiente probarlo con Adrián). Desplegado
(Worker + Pages). Detalle completo en `HANDOFF.md`.

## ARC-022 — control de accesos completo con quiosco de autofichaje (2026-08-11)

Evolucionó de "tarjeta con QR para fichar" a un control de accesos real tras aclarar Adrián
el caso de uso: una pantalla fija donde cada trabajador pasa su propio QR al entrar, no un
encargado escaneando una a una. Estado final: foto de perfil para usuarios (backend ya
listo, solo faltaba UI) en `index.html`/`panel.html`; tarjeta imprimible con QR (foto+nombre,
tamaño CR80) para usuarios (ambos frontends) y para personal externo (`index.html`, único
sitio con pantalla de gestión de personal externo); **migración D1 real aplicada con
autorización explícita del Director** (`ALTER TABLE personal_externo ADD COLUMN codigo`,
verificada contra el esquema tras aplicarla); `POST /fichajes/scan` generalizado para
resolver el código contra usuarios O personal externo, devolviendo una ficha completa (foto,
rol/departamento, DNI si es externo, empresa, y aviso si hay reconocimiento médico o carnet
caducado); **`kiosco.html`, archivo nuevo** — pantalla de autofichaje a pantalla completa,
login una vez con sesión larga, campo siempre reenfocado para lector USB/Bluetooth (ambos
funcionan igual, emulan teclado), pensada para dejar en un monitor de entrada; `index.html`
también recibió el mismo campo de lector físico dentro del modal de cámara ya existente.
`panel.html` se dejó fuera de esta vuelta (no tiene pantalla de gestión de personal externo
donde encajase). De paso se corrigió un bug lateral real: la URL de `jsQR` en cdnjs devolvía
404 desde hacía tiempo, rompiendo en silencio el escaneo de QR de bobinas/EPIs/herramientas
— corregida a jsdelivr. Verificado por sintaxis/encoding en todo el lote y por DOM/navegador
en `index.html`; `kiosco.html`/`panel.html` no se pudieron verificar visualmente en el
navegador de pruebas de esta sesión (limitación de la herramienta, no del código).
Desplegado (Worker + Pages, incluida la migración D1). Detalle completo en `HANDOFF.md`.

## BUZON-TELEGRAM-01 — aviso en tiempo real + buzón de incidencias (2026-08-10)

Implementadas las dos ideas de producto que Adrián planteó esta sesión: aviso a él por
Telegram casi en tiempo real cuando Alejandra tope con un problema real ayudando a un
usuario, y un buzón donde vaya anotando incidencias/sugerencias para repasar más tarde.
Reutiliza infraestructura ya existente en `alejandra-agente/worker.js` (sin tabla ni tool
nueva): la tool `memory_save` ya guardaba `tipo='error'` en `alejandra_memoria`; ahora,
si además `importancia>=4` (algo que bloquea a un usuario real ahora mismo), manda también
un Telegram por el canal fijo que este Worker ya usa para sus propios avisos internos.
Nueva "REGLA DE INCIDENCIAS" en el prompt para que Alejandra sepa cuándo usarlo. Alcance
deliberado: solo `alejandra-agente` (donde ella habla con usuarios reales); `worker.js` no
se tocó (su chat lo usa Adrián directamente, no necesita avisarse a sí mismo). Verificado
(`node --check`, 189/189 tests) y desplegado (`wrangler deploy`, `/health` en verde).
Detalle completo en `HANDOFF.md`.

## Auditoría del módulo Personal en panel.html (2026-08-10)

A petición de Adrián ("revisa todo lo referente a Personal, todos sus subdepartamentos, que
los wizard funcionen y estén al mismo estilo de la app") se auditaron los sub-módulos de la
sección Personal del panel de oficina (Trabajadores, Fichajes, Hojas de Tiempo, Turnos,
Ausencias y Permisos, Horarios de Obra, Formación de Obra, EPIs). Fichajes ya se había
auditado a fondo un día antes (ver sección "Fichajes" más abajo). Bugs encontrados y
corregidos (commit `31fcc91`, desplegado: Worker + Pages):

- `crearUsuario()` (`worker.js`) exige `nombre`+`codigo` (login por código, no por
  email/contraseña) y nunca lee `email`/`password`. Los modales "+ Nuevo trabajador"
  (Personal) y "+ Nuevo usuario" (Usuarios) mandaban `email`/`password` y fallaban SIEMPRE
  al crear — el alta de personal desde el panel estaba completamente rota. Fix: ambos
  modales piden ahora `codigo`; el email queda como campo opcional que se guarda con un PUT
  posterior.
- `getTrabajadores()` no seleccionaba `obra_nombre` ni `email` pese a que la tabla de
  Personal del panel ya tenía esas columnas — quedaban siempre vacías. Se añadió un `LEFT
  JOIN` con `obras` y `u.email` al SELECT.
- Hojas de Tiempo (`poblarTrabajadoresTs()`) llamaba a `/personal`, endpoint que no existe
  en el router (solo `/personal/trabajadores`, `/personal/semana`, `/personal/mes`) — el
  selector de trabajador quedaba siempre vacío, imposible crear un Parte de Horas.
- Bug de estilo más amplio de lo esperado: las clases `modal-box`, `modal-head`,
  `modal-foot` y `modal-content` (usadas dentro de un `modal-overlay` correcto) **no tenían
  CSS definido en ningún sitio** — las clases reales del sistema de diseño son `modal`,
  `modal-header`, `modal-footer`. Afectaba a 14 modales del panel, incluido Formación de
  Obra (Personal). Se corrigieron los 14 renombrando a la clase real.
- 3 selects/input del toolbar de Ausencias y Permisos con `border:1px solid #ccc`
  hardcoded rompían el tema oscuro — pasados a `var(--border)`.

**Cerrado el mismo día:** se detectó un bug de estilo distinto y más grave en otros 9
modales (Reconocimiento, Documentación de obra, Permiso de Trabajo, Inspecciones, Subir
Foto, Transmittal, Entrega, Puntos de Acción, Riesgos) — el div exterior usaba `class="modal"`
en vez de `class="modal-overlay"`, así que no tenían fondo oscuro ni centrado al abrirse.
Corregido en una sesión aparte (iniciada por Adrián desde una sugerencia), verificado contra
el DOM real antes de publicar (backdrop/centrado/cierre-al-clicar-fuera confirmados en los 9)
y desplegado en Pages (commit `4cc6463`, run `31434560088`). Detalle completo en `HANDOFF.md`.

Adrián planteó además dos ideas de producto sin implementar aún: (1) que Alejandra le avise
por Telegram casi en tiempo real cuando se tope con un problema real (tool que falla,
permiso que falta, dato que no cuadra); (2) un "buzón" de incidencias/sugerencias donde
Alejandra vaya anotando cosas para repasar más tarde, en vez de o además de avisar en
caliente. Sin decisión de alcance ni implementación todavía.

## Contaminación de contexto en el chat + auditoría de bugs de esquema (2026-08-10)

Adrián reportó que Alejandra respondía en la app con contenido de una conversación de hace
días (un esquema eléctrico) al pedir un cambio de rol de usuario, con `analizar_foto_obra`
invocada sin que nadie lo pidiera. Causa raíz: `construirMessages()` (`alejandra-agente/worker.js`)
reconstruía como imagen real cualquier adjunto dentro de los últimos 10 mensajes del historial,
sin límite de antigüedad. Fix: solo se reconstruye si el mensaje es de la sesión activa (<2h);
fuera de ese margen se trata como texto y se retira la referencia a la key de R2. Verificado en
producción desde Chrome real (sesión de Adrián): una pregunta nueva ya no arrastra contexto viejo.

Al probar el fix se detectó un error de columna en una consulta de `consultar_bd`, lo que llevó a
una **auditoría amplia** (dos agentes Explore en paralelo, uno por Worker) del mismo patrón:
consultas envueltas en `.catch()` que devuelven "sin resultados" en vez de propagar el error,
sobre columnas/tablas nunca verificadas contra el esquema real de D1. **18 bugs de este tipo
encontrados y corregidos en total** (todos verificados contra D1 real antes de tocar código,
varios candidatos descartados por resultar correctos):

- `worker.js`: dashboard ejecutivo por obra (presupuesto siempre en 0€, hitos retrasados siempre
  en 0, valor de órdenes de cambio siempre en 0€), alerta de seguros/CAE de subcontratas que
  nunca se había disparado, `PendingUsersWatcher` y `diagnosticar_usuario` (columna `aprobado`
  inexistente — el flujo real de aprobación es el alta por Google, `google_pending`).
- `alejandra-agente/worker.js`: bloque de "inteligencia de negocio" del cron (obras activas,
  gastos de la semana — dos bugs), monitorización de errores del sistema, detección de
  anomalías, tendencias semanales, predicción de agotamiento de stock, **el bug real detrás del
  mensaje "undefined%" que Adrián ya había visto en el chat** (un consumidor que quedó
  desactualizado tras un fix anterior del 01/08), `exportar_datos` (4 de 5 tipos daban error real
  al usarse) y `generar_informe` (las 5 secciones del informe salían vacías).

Aclaración importante hecha a Adrián: esto es un problema de **datos de negocio del cron**
(esquema no verificado, arrastrado desde ARC-011), no del **Motor de Decisión** (ADR-0020),
que es un sistema aparte, probado (57-183 tests en verde) y verificado en vivo el mismo día sin
problemas. Detalle completo, commits y versiones desplegadas en `HANDOFF.md`.

## Auditoría de Alejandra Chat — aislamiento de contexto (2026-08-06)

La auditoría detectó que el constructor del prompt consultaba memoria, reglas, historial y métricas legacy globales sin `empresa_id` ni `usuario_id`. El fix `SEC-CHAT-CONTEXTO-LEGACY` desactiva esas lecturas de forma fail-closed: el prompt conserva módulos estáticos y las tools visibles, mientras que la memoria gobernada continúa disponible únicamente mediante su tool acotada por sesión. No se modifica ningún dato.

`ADR-0020-INTEGRACION-GRADUAL-MOTOR-DECISION.md` fue **aceptado por el Director el 2026-08-06**. La rebanada 1 integra el Motor de Decisión solo para tools N0: una tool ofrecida recibe decisión/traza previa y una no ofrecida se rechaza. N1-N3 conservan los gates existentes. El cambio se integró mediante PR #98 y se desplegó con el [run 31089065117](https://github.com/padilla585projects/Alejandra-APP/actions/runs/31089065117) sobre `5352dc5`; la comprobación manual posterior de `GET /health` devolvió `healthy` (`d1:true`, `r2:true`, versión `6e908ded-5578-405b-9044-37efc06b57ad`). **Enmienda 1 (2026-08-07):** la rebanada 2 amplió el piloto a todo el catálogo N0 (36 tools) — ver sección "Motor de Decisión (ADR-0020)" al final de este documento.

## Sondas CPD — nuevo módulo (2026-08-05, rama `feat/sondas-cpd`)

Módulo del departamento eléctrico para colocar sondas de temperatura/humedad/presión
diferencial sobre el plano de una sala de CPD (3 zonas, cada una con su pasillo caliente),
en `index.html` y `panel.html` (paridad de frontales). Barra de herramientas con un icono
por tipo (colocar sin diálogo, doble tap/clic para editar); modelo de datos genérico
(`plano_elementos`: categoría+tipo, pensado para cámaras/control de acceso a futuro sobre el
mismo editor). Backend nuevo en `worker.js` (`/cpd/planos`, `/cpd/sondas`,
`/cpd/sondas/:id/lecturas`); tablas autoprovisionadas en runtime con el mismo patrón que el
resto del esquema (`_ensureCpdTables`, ver "Esquema de datos" más abajo) — no requirió
migración D1 manual. Detalle completo en `CHANGELOG.md`.

Desplegado (Worker + Pages) desde la rama para pruebas en producción, con aprobación del
entorno `production` del Director en cada despliegue, tal como exige ADR-0007. Verificado
en Chrome real en los dos frontales (táctil y ratón).

**Resuelto (2026-08-09/10, v9.05):** se creó el departamento "Control" dedicado y Sondas
CPD se movió ahí en ambos frontales (ya no vive en Eléctrico ni de forma temporal). De paso
se encontraron y corrigieron varios bugs reales de aislamiento por departamento (server-side
y en el sidebar de `panel.html`) — ver `HANDOFF.md` y `CHANGELOG.md` para el detalle
completo. Fusionado a `main` (PR #104) y desplegado (Worker + Pages, healthcheck en verde).

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

- **ARC-021 (riesgo de proceso, aceptado por el Director como práctica habitual, 2026-08-07):** `wrangler deploy` directo contra `alejandra-agente`, sin pasar por `deploy-alejandra-agente.yml`, autorizado por el Director por comodidad propia. Mismo criterio y condición de reapertura que ARC-014 (producción real con impacto en terceros, o más de un mantenedor). Detalle en `ARCHITECT_BACKLOG.md` (ARC-021) y `HANDOFF.md`. Sin acción de ingeniería pendiente.
- **Resuelto (2026-08-04, `F-0.2-CFG`):** los secretos ya no están a nivel de repositorio. El Director los recreó en el entorno `production` (2026-08-03) y borró la copia de repositorio (2026-08-04), tras verificar con un despliegue exitoso. Ver sección dedicada más abajo. Quedan sin fecha el ensayo de confirmación errónea y la política de rama de `github-pages` (criterios menores de la tarea original).
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

Todas las decisiones planteadas hasta el 2026-08-04 quedaron resueltas: **P-ARCH-002** aprobada;
**ARC-014** aceptada como riesgo temporal (revisada sin cambios el 2026-08-03); **`F-0.2-CFG`**
completada (secretos movidos, ensayo probado, política de rama ampliada); **ARC-011 fase 3**
completa (14/14 verticales); **escritura de `memoria_gobernada`** decidida y desplegada
("Exponer como tools nuevas"); **`ADR-0015`/ARC-019** aceptado e implementado. Lo único abierto
es decisión exclusiva del Director: definir la siguiente rebanada de presentación tras
P-ARCH-003. Detalle en `TASKS.md` y `ARCHITECT_BACKLOG.md`.

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

## ARC-011 fase 3 — tercer lote, ciclo completo (2026-08-03)

**Paso 4 (desplegar y verificar) cerrado para el tercer lote:** el Director aprobó el entorno
`production` (run `30839201968`, versión `400421b4-06dd-4943-93d1-2c422c9b4f6a`), `/health`
healthy, las 23 tablas del lote verificadas presentes tras retirar el DDL en runtime. **Con
esto, las 14 verticales de ARC-011 fase 3 quedan con el ciclo de 5 pasos de ADR-0011 completo
en su totalidad.** No queda ninguna tarea de ingeniería activa de ARC-011. Ver `TASKS.md`
(`ARC-011-FASE3-LOTE3`).

**F-0.2-CFG — checklist de referencia creada (2026-08-03) y ejecutada por el Director
(2026-08-04).** Sin tarea de ingeniería activa y tras declinar ejecutar F-0.2-CFG directamente
(acción prohibida para cualquier agente), se preparó
`docs/runbooks/CHECKLIST-F02-CFG-SECRETOS-ENTORNO.md`: procedimiento exacto y los 5 nombres de
variable (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`,
`OPENAI_API_KEY`, `ADMIN_TOKEN`), sin ningún valor real. **El Director lo ejecutó él mismo:**
creó los 5 en el entorno `production` el 2026-08-03 (18:32-18:46), lo verificó con un
despliegue exitoso inmediatamente después (`Deploy API Worker`, run `30843489418`, 18:56 —
éxito confirma que el job resolvió los secretos desde el entorno) y, el 2026-08-04, borró la
copia de nivel repositorio. Confirmado en solo lectura tras el borrado (`gh secret list`,
nunca valores): repositorio vacío, entorno `production` con los 5 intactos. Ningún agente leyó
ni tocó valores reales. Quedan sin fecha dos criterios menores de la tarea original: el ensayo
de confirmación errónea sobre un workflow de producción y la política de rama de
`github-pages`.

## Fix — salto del chat de Alejandra en `panel.html` (2026-08-03)

**Bug real reportado por Adrián**, corregido en PR
[#76](https://github.com/padilla585projects/Alejandra-APP/pull/76): el chat de Alejandra en
`panel.html` sondeaba `alejandra_historial` cada 5 s y repintaba toda la ventana en cada
sondeo, aunque solo hubiera un mensaje nuevo — como esa tabla se comparte a propósito entre
app/panel/Telegram, un mensaje de otra plataforma disparaba el repintado completo en plena
conversación ("saltan los mensajes de antes actualizándose"). `cargarAlejandraChat()` ahora
compara firmas (`created_at`+`rol`+`contenido`) contra el servidor y solo añade mensajes
nuevos al final, sin rehacer lo ya pintado. De paso se añadió mover/redimensionar la ventana
del chat. Único archivo tocado: `panel.html`. **Paridad verificada (2026-08-04):** el patrón
del bug es exclusivo de este widget FAB. `index.html` y `alejandra-panel.html` usan streaming
SSE para el chat de Alejandra (sin sondeo de historial con repintado), y sus `setInterval`
cercanos hacen otra cosa (visibilidad de botón / sincronización incremental de eventos). Ningún
cambio adicional necesario.

## Fix — 4 bugs reales de la app móvil reportados con foto (2026-08-04)

**Bug real reportado por Adrián**, vía el sistema de sugerencias con foto de la app (sugerencias
#209/#211/#212/#213/#214, tabla `sugerencias` en D1). Diagnóstico contra las capturas adjuntas y
el código real, no contra `IDEAS_PENDIENTES.txt` (archivo histórico, no backlog activo):

- **#213 — "No funciona Formación en obra":** `formacionCargarMobile()`, y también los módulos
  de RdP (Registro Diario de Prevención) y Registro de Hormigonado, llamaban a `apiFetch()`, una
  función que **nunca existió** en `index.html` (solo `apiCall`/`apiCallRaw`) — los tres módulos
  de Seguridad estaban rotos de raíz desde que se crearon, no solo Formación. `panel.html` sí
  tiene el alias (`const apiFetch = apiRaw`) desde su creación — la falta era exclusiva de
  `index.html`. Fix: `const apiFetch = apiCall;`.
- **#214 — "el filtro de proveedor desaparece":** al filtrar Bobinas por proveedor,
  `renderStock()` repoblaba `#stockProvSelect`/`#stockTipoSelect` usando solo los ítems ya
  filtrados por el backend — quedaba una única opción (la elegida) y el resto de proveedores
  parecían haber desaparecido. Fix: se quita esa repoblación; el catálogo completo ya lo puebla
  `cargarCatalogos()` una vez al cargar.
- **#212 — "no se puede subir foto a incidencias":** al crear una incidencia nueva (sin guardar
  aún) y elegir una foto, el `onchange` disparaba un aviso de error ("guarda la incidencia
  primero"), aunque `_guardarIncidenciaBase()` ya subía esas mismas fotos al guardar — no estaba
  roto, pero parecía. Fix: vista previa local "pendiente" en vez de un error.
- **#211 — "Falta el nombre de la empresa" al guardar Departamentos activos:** ya estaba
  corregido en producción desde v8.84 (30/07/2026, ver `ESTADO_APP.txt`); el reporte (28/07) es
  anterior a ese fix. Sin cambios de código, solo confirmado que sigue resuelto.
- **#209 — "Error sincro Google Sheets":** el endpoint `/sync-sheets` sí existe en `worker.js` —
  el mensaje de la app afirmaba lo contrario. Fix: se muestra el error real devuelto por el
  servidor en vez de ese mensaje fijo incorrecto; la causa raíz original de la sincronización (no
  diagnosticable sin ver el error real) queda visible la próxima vez que falle.

Único archivo tocado: `index.html` (no aplica a `panel.html`/`alejandra-agente` — módulos y
patrón de filtro exclusivos de la app móvil). Sintaxis verificada (`node --check worker.js`
limpio, sin tocarlo; los 3 bloques `<script>` de `index.html` parsean con `new Function()` sin
error). Fuera del roadmap de Alejandra 2.0 (Núcleo Cognitivo), mismo criterio que el fix de
`panel.html` de 2026-08-03.

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

**Hallazgo resuelto (2026-08-04, `ADR-0015`/ARC-019):** `sql_query` permitía DDL
(`CREATE`/`ALTER`/`DROP`) con la misma barrera humana (`CONFIRMO BORRADO`) que `run_migration`,
sin la distinción N3 explícita, y ninguna de las dos tools exigía confirmación para `CREATE
TABLE`/`CREATE INDEX`. Decisión del Director: `sql_query` sube a N3; se extiende la barrera a
`CREATE` con frase distinta (`CONFIRMO MIGRACION`); `alejandra-agente` revisado, sin brecha
equivalente. Implementado, desplegado y verificado (PR #85, run 30939265650). Ver sección
dedicada más abajo.

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

**Escritura sobre `memoria_gobernada` — decidida y desplegada (2026-08-04).** El Director
decidió "Exponer como tools nuevas": `memoria_listar_pendientes` (N0, disponible al cron),
`memoria_confirmar_candidata`/`memoria_rechazar_candidata` (N1, excluidas del cron a propósito
— aprobar una candidata sin humano delante contradice la validación que exige ADR-0013 §3).
Gate de rol `encargado`+ nuevo (`esEncargadoOSuperior()`), `empresa_id` siempre de sesión. Antes
de exponerlas se corrigió un hallazgo real: `confirmarCandidata()`/`rechazarCandidata()`
filtraban solo por `id`/`estado`, sin `empresa_id` (mismo patrón de fuga que ARC-016) —
corregido antes de exponer nada. 138/138 pruebas en verde. Desplegado y verificado en
producción (PR #81, run 30937911736, `/health` healthy). Ver `TASKS.md`
(`F-2.1-MEMORIA-ESCRITURA`).

## Arquitectura de presentación

`ADR-0012` fue aceptado el 2026-08-02. La arquitectura vigente
`docs/architecture/FRONTEND_ARCHITECTURE.md` define aplicaciones, features, sistema de diseño
y clientes API. P-ARCH-001 (indicador de salud) fue aprobado. **P-ARCH-002 (componente
compartido de notificaciones temporales) fue aprobado por el Director el 2026-08-02** — su
evidencia está en `docs/architecture/FRONTEND_SLICE_TOAST.md`. No es dependencia del Núcleo
Cognitivo y avanza en paralelo con backend/motor de decisión. **P-ARCH-003 (consulta de versión
remota compartida) implementada, fusionada y publicada en Pages (2026-08-04)** —
`packages/design-system/src/platform/version-check.js`, usada por `index.html` y `panel.html`
sin cambiar su banner/toast/recarga. De paso se corrigió que `pages.yml` nunca copiaba
`packages/` a `_site/`, así que `toast.js` (P-ARCH-002) llevaba desde su fusión sirviendo su
fallback local en cualquier publicación real. Evidencia en
`docs/architecture/FRONTEND_SLICE_VERSION_CHECK.md`. Queda desbloqueada la siguiente rebanada
de presentación (aún sin definir ni abrir).

## Aislamiento cross-tenant de `alejandra_memoria` — SEC-CHAT-CONTEXTO-LEGACY

### Contexto y hallazgos (2026-08-06)

**Producción `alejandra_memoria`:** tiene `usuario_id TEXT` (default `'system'`), pero **NO tiene
`empresa_id`**. La raíz es que `migrate_003_fix_schema.sql` ejecuta `CREATE TABLE IF NOT EXISTS`
— la tabla preexistente del root migration (`migrate_alejandra_memoria.sql`) no define esa
columna, así que el AGENTE nunca la creó. `wrangler.toml` no tiene `[migrations]`, por lo que
los scripts DDL se aplican manualmente.

**`PRAGMA table_info('alejandra_memoria')` en productiva:**
`id` INTEGER (pk), `tipo` TEXT (notnull, default `'contexto'`), `canal` TEXT (default
`'general'`), `titulo` TEXT (notnull), `contenido` TEXT (notnull), `importancia` INTEGER (default
1), `created_at` TEXT, `updated_at` TEXT, `usuario_id` TEXT (default `'system'`).
**Sin `empresa_id` column.**

**`PRAGMA table_info('usuarios')`:** `id` INTEGER (pk), `empresa_id` INTEGER (default 1), 6
tenants en productiva.

**Distribución de 169 filas:** 137 `system`/NULL + 142 especiales + 0 anónimas + 24 resolubles
(`usuario_id ∈ {'2','3','4'}|empadronado` — users reales) + 3 no resolubles (`'2'`, `'encargado_juan'`).
Join SQLite aplica integer affinity correctamente (`'3' = 3` → `usuarios.empresa_id = 1`).

### Implementación

1. **`construirQueryAprendizajesEmpresa()`** (`lib.js`): helper SQL con `WHERE empresa_id = ?`
   (fail-closed: si falta, `WHERE 1=0`). Exportado para `obtenerContextoChat`.

2. **`obtenerContextoChat`** (`worker.js`): reemplaza la query global por la del helper (line
   ~11509). `memory_read` (line ~6498) scopeado por `empresa_id` de sesión.

3. **Writes scopeados:** `memory_save`, `propose_mejora`, `tomar_decision`, `autoLearnChat`,
   `ejecutarReflexion` — todos bindean `empresa_id` from session.

4. **`incluirAprendizajes`** unificado: `experto !== 'simple'` en lugar de `experto === 'lucia'`
   (elimina asimetría app/panel).

5. **Tests cross-tenant:** 7 tests (146/146). `construirQueryAprendizajesEmpresa` — fail-closed
   sin empresa_id, query correcta con empresa_id.

6. **Migración D1 `migrate_009_memoria_empresa_id.sql`:** `ALTER TABLE ADD COLUMN empresa_id TEXT`
   + backfill 169 filas: 24 real→`usuarios.empresa_id` (0 mismatches), 145→`'system'`, 0 anon.
   Aplicada contra D1 productiva.

7. **PR #99** merged (`b04a2ff`). Worker `6ed738a8` desplegado. `/health` verificado.

8. **fcm_token cleanup:** id=91 DELETE ejecutado (token `fri7sTTOSfu21hjxXCg7nS:APA91b...`
   almacenado en tabla equivocada). **Pendiente: rotar token en Firebase Console.**

9. **`autoLearnUpload` fix** (`worker.js:11684`): bindea `empresa_id` from session (committed
   `25c879d`, deployed `6ed738a8`).

### Estado

- **Aislamiento completado y desplegado.** 0 fuga cross-tenant verificada en D1 productiva.
- fcm_token rotación manual pendiente (Firebase Console).
- Tabla `alejandra_memoria` sigue sin `empresa_id` como columna real en D1 — el `empresa_id` se
  almacena en el contenido JSON de cada fila, no como columna. Esto es correcto: la tabla es un
  almacén de documentos flexibles.

## Motor de Decisión — ADR-0020

### Estado: Aceptado (2026-08-06); reestructurado en subcarpetas locales (2026-08-07)

`nucleo-cognitivo/packages/cognitive-core/src/motor-decision.js` (154 líneas):
`decidirInvocacionPilotoN0` (N0 gate), `tieneTrazaSuficiente`, `decidir()` stub
(necesita Context Engine + Planner).

**Piloto N0 vivo** en 3 call sites de `worker.js`. N0 tools gated:
`consultar_personal`, `memory_read`, `consultar_almacen`. N1-N3 siguen con gates existentes.

**Rebanada 2 (2026-08-07, ADR-0020 enmienda 1):** piloto ampliado a **todo el catálogo
N0** (36 tools), no solo `consultar_bd`. Análisis de trazas N0 (47 decisiones, 100% cron
`consultar_bd`) confirmó el mecanismo. Completado metadato ADR-0010 de 4 tools sin
`nivel_riesgo`: `memory_read` (N0), `memory_save` (N1), `propose_mejora` (N1),
`tomar_decision` (N2; cron `prohibido` en las 3 de escritura). Cobertura de test del
catálogo N0 completo en `cognitive-core/test/contratos.test.js`.

**Subcarpetas locales (2026-08-07):** núcleo dividido en
`packages/cognitive-core/` y `packages/cognitive-core-policy/` (sin paquetes npm).
`alejandra-agente/worker.js:54` importa directamente del subpaquete
(`../nucleo-cognitivo/packages/cognitive-core/src/motor-decision.js`),
bundleado por wrangler.

**Rebanada 3 (2026-08-07, enmienda 2):** piloto de tools N1 de lectura.
`registrarExplicabilidad()` (`verifier.js`) gana implementación real sin I/O
(valida motivos/evidencia con contenido, no solo presencia — salda la deuda de
F-1.2/ADR-0009 apoyada en que F-4.1 ya está en producción).
`decidirInvocacionN1Lectura()` (`motor-decision.js`) exige sesión + esa
explicabilidad. De las 26 tools N1 del catálogo, solo `verificar_deploy` es de
solo lectura confirmada — el resto mezcla lectura/escritura por `accion`
(`gestionar_*`) y queda fuera hasta clasificar por invocación (pendiente, sin
decisión tomada). `TOOLS_N1_LECTURA_PILOTO` (`alejandra-agente/lib.js`) es la
allowlist, hoy con ese único elemento. N1 de escritura, N2 y N3 sin cambios.
Tests: cognitive-core 42/42, cognitive-core-policy 4/4, agente 172/172.
**Sin desplegar todavía.**

**Rebanada 4 (2026-08-07, enmienda 3):** cierra los dos puntos que quedaban
del ADR original. Contexto seguro se declara cumplido (ya satisfecho por
`SEC-CHAT-CONTEXTO-LEGACY` + `memoria_consultar`, sin código nuevo). Política
determinista real: `motor-decision.js` reutiliza `validarDeclaracionTool()`
(ADR-0010) para rechazar una tool candidata al piloto (N0 o N1 lectura) con
metadato ausente/inválido, en vez de asumirla disponible — sin ampliar qué
tools gobierna el Motor (el filtro de `nivel_riesgo` sigue yendo primero).
Con esto los 4 puntos originales de ADR-0020 quedan resueltos. Tests:
cognitive-core 45/45, cognitive-core-policy 4/4, agente 172/172. **Sin
desplegar todavía.**

**Rebanada 5 (2026-08-07, enmienda 4):** clasificación N1 por invocación.
Auditados los `case` de las 6 tools CRUD compuestas (`gestionar_tarea/rfi/oc/
acta/calidad`, `historico_materiales`): `listar`/`resumen`/`consultar`/
`comparar` son puro `SELECT`, el resto escribe. `esInvocacionN1DeLectura()`
(`lib.js`) decide por tool+`accion`, fail-closed ante acción desconocida.
`evaluarInvocacionCognitiva()` recibe `input` y gobierna estas invocaciones
igual que `verificar_deploy`, sin tocar ningún gate legacy existente. Tests:
cognitive-core 45/45, cognitive-core-policy 4/4, agente 177/177. **Desplegado y verificado
(2026-08-07):** commit `634b86f`, `wrangler deploy` directo, `/health` →
`healthy`, versión `9eaa503b-909a-416e-bf40-1b568e7e2200`.

**Rebanada 6 (2026-08-07, enmienda 5):** refuerzo N2/N3, sin ampliar
permisos. `decidirInvocacionN2N3()` deja traza explícita de una tool N2/N3
ofrecida, pero **siempre** decide `'posponer'`, nunca `'invocar_tool'` —
`CONFIRMO BORRADO`/`CONFIRMO MIGRACION` no se tocan, siguen siendo la única
barrera real. Antes, N2/N3 eran invisibles para el Motor; ahora quedan
trazadas sin que ningún permiso cambie. Tests: cognitive-core 50/50,
cognitive-core-policy 4/4, agente 178/178. **Desplegado y verificado
(2026-08-07):** commit `634e8a3`, `wrangler deploy` directo, `/health` →
`healthy`, versión `4a814224-2db7-4a2c-b880-fca4e2a5afdb`.

**Rebanada 7 (2026-08-07, enmienda 6):** N1 se amplía a escritura.
`decidirInvocacionN1Lectura()` generalizada a `decidirInvocacionN1()` —
ADR-0009 exige el mismo `explicabilidad` para todo N1 sin distinguir
lectura/escritura; la restricción anterior era cautela de pilotaje, no un
límite de ADR-0006 (N1 = "reversible, acotado" por definición).
`esInvocacionN1DeLectura()` deja de gatear, pasa a enriquecer la traza
(`es_lectura`). El Motor gobierna ahora el catálogo N1 completo (26 tools),
sin cambiar ningún gate legacy (sesión, `empresa_id`, IDOR de cada `case`).
Tests: cognitive-core 57/57 (con policy), agente 178/178. **Desplegado y
verificado (2026-08-07):** commit `c3d9936` (cherry-pick tras un incidente
de rama, ver `HANDOFF.md`), `wrangler deploy` directo, `/health` →
`healthy`, versión `3fa2f9e9-f747-44a8-9498-b93d3bf9833e`.

Con esto las 7 rebanadas de ADR-0020 quedan desplegadas y verificadas en
producción; el catálogo N0+N1 completo opera bajo el Motor de Decisión.

**Pendientes ADR-0020:** diseñar revisión humana asíncrona real para N2
(requiere ADR propio, cablear el canal de Telegram — cambio mayor, no
autónomo); N3 sigue fuera del alcance autónomo por mandato de ADR-0006. Ver
`ARCHITECT_BACKLOG.md` (ARC-020) y `TASKS.md`.

## Bug de telemetría F-4.4 y aislamiento por departamento en Alejandra Office (2026-08-07/10)

- **F-4.4 (2026-08-07):** investigando qué vertical elegir para F-3.1 (herramientas semánticas), se auditaron las trazas `feature_usage` reales en D1 y se detectó que el 100% se clasificaban como "error" — incluidas ejecuciones correctas. Causa: la clasificación buscaba un contrato JSON `"ok"` que la mayoría de tools no devuelve. Fix: `clasificarResultadoTool()` (función pura en `alejandra-agente/lib.js`), desplegado y verificado. Detalle en `HANDOFF.md`. **F-3.1 queda a la espera de telemetría real de uso** (las trazas hasta ahora son del cron) antes de decidir la vertical piloto — decisión del Director ("esperamos").
- **Aislamiento por departamento en Alejandra Office (2026-08-09/10):** a raíz de un reporte de Adrián sobre fugas en desplegables entre departamentos, tres auditorías sucesivas (agentes Explore, solo lectura) sobre `worker.js`/`panel.html` encontraron y cerraron, en orden: (1) `getTrabajadores`/`getCarnets` + reorden de departamentos (Control/Telecom tras Eléctrico); (2) 19 tablas de obra sin columna `departamento` (6 migraciones D1 + `deptGuard` en ~40 endpoints, ciclo de 5 pasos de ADR-0011) más `getObsSeguridad`/`getToolboxTalks` restringidos a Seguridad; (3) `getReconocimientos` (datos de salud) y `getAccidentes` (registro legal de seguridad), última fuga real encontrada, restringidos a Seguridad+admins. **No quedan módulos conocidos sin aislar.** Un incidente de proceso propio (ALTER directo sin workflow) fue autorreportado y aceptado como caso puntual, sin extender el bypass a futuras migraciones D1. Detalle completo, commits y versiones desplegadas en `HANDOFF.md` y `CHANGELOG.md`.
