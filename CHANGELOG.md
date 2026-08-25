# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added (2026-08-25 — Cerebro de Alejandra: adelgazar prompts + un módulo experto por departamento, Parte 3 de la auditoría)

Parte 3 del plan aprobado ("adelgazar esos prompts") más una ampliación real pedida
durante la sesión: Adrián, viendo que sólo electricidad tenía conocimiento experto —
"lo mismo para los demás departamentos, por ejemplo Mecánicas... nivel de Alejandra para
que sea experta en todos los departamentos". Investigado el catálogo real de la app
(`_DEPTS_CATALOG`, `panel.html`/`index.html`): 12 departamentos, de los que 7 tienen un
oficio técnico propio con normativa/cálculos reales (los otros 5 son gestión —
seguridad ya cubierto por PRL, personal/almacén/ingeniería sin un cuerpo técnico
distinto). Confirmado el alcance con Adrián antes de escribir el contenido (7
departamentos con oficio real; carga por departamento de sesión + palabras clave).

**Adelgazado (sin contenido nuevo, solo reorganizado con carga condicional):**
- Bloque PRL de `base` (~7.400 caracteres, cargado antes en TODOS los mensajes de TODOS
  los usuarios) y el de tablas PRL de `app` (~2.900) extraídos a un módulo nuevo
  `prl_seguridad` (10.290 caracteres), cargado solo si el mensaje o la pantalla activa
  mencionan seguridad/PRL/riesgos/EPIs/incidencias — mismo patrón que `seguridad_no_auth`
  (único precedente de carga condicional que ya existía). `base` baja de ~12.079 a 5.110
  caracteres, `app` de ~10.736 a 8.118 — para un mensaje sin relación con seguridad.
- `ingenieria_electrica` (~18.827 caracteres, un solo bloque) dividido en sus 4 secciones
  ya delimitadas por separadores `═══`: `ie_normativa`, `ie_calculos`, `ie_control`,
  `ie_esquemas`. Detección por palabras clave (esquema/dibuja → esquemas; PLC/SCADA/
  variador → control; sección de cable/cortocircuito → cálculos; ITC-BT/REBT →
  normativa). Fail-open (cargar las 4) solo para el experto `ingenieria` — donde el
  router ya decidió que el mensaje es de electricidad, así que "sin coincidencia" es
  ambigüedad real; fail-closed para `app` — donde la mayoría de mensajes NO son de
  electricidad y los que sí lo son ya se enrutan a `ingenieria` antes de llegar aquí.

**Nuevo — un módulo experto por departamento** (`dep_mecanicas`, `dep_telecom`,
`dep_control`, `dep_obra_civil`, `dep_albanileria`, `dep_pintura`, `dep_carpinteria`,
cada uno 6.800-11.500 caracteres, normativa española real + cálculos + buenas prácticas,
mismo nivel de detalle y tono que el módulo eléctrico ya existente): mecánicas
(RITE/CTE-HS4-HS5/legionela, cálculos de carga térmica y bombas), telecom (ISO/IEC
11801/TIA-568, distancias de cobre y presupuesto óptico — alineado con la terminología
real de las tablas `telecom_racks`/`telecom_cuadros_campo`), control/CPD (TIA-942/ASHRAE
TC9.9, PUE y redundancia N+1/2N — alineado con el módulo Sondas CPD), obra civil
(CTE-DB-SE-C/EHE-08, cálculo de zapatas), albañilería (CTE-DB-HR, sistemas Pladur/Knauf
por Rw/REI), pintura (ISO 12944, rendimiento m²/l y espesores EPS/EPH), carpintería
(CTE-DB-HE1/UNE-EN 14351-1, transmitancia térmica Um). Redactados en paralelo por
agentes especializados, uno por departamento, con la misma consigna de estilo/rigor que
el módulo eléctrico existente.

**Carga**: `sesionAuth.departamento` (tabla `sesiones`, ya lo devolvía `getAuth` pero no
se usaba en el chat) se pasa ahora a `procesarConNEXUS`/`Stream` — el módulo del
departamento real del usuario se carga siempre (para los expertos `app`/`ingenieria`,
los que ya tenían conocimiento técnico de dominio), y además se detecta por palabra
clave si el mensaje menciona el oficio de OTRO departamento (ej. un electricista
preguntando por fontanería) — nunca se cargan los 7 a la vez.

207/207 tests. `node --check` limpio. Sin migración D1 — es contenido de prompt, seguro
de iterar/revertir. Queda solo la Parte 1 del plan (memoria enlazada estilo Obsidian,
migración D1 pendiente de autorización explícita).

### Fixed (2026-08-25 — Cerebro de Alejandra: 4 bugs de control de flujo, Parte 2 de la auditoría)

Continuación directa de la auditoría del mismo día (ver entradas de abajo). Los cuatro
arreglos "de riesgo medio" del informe, los que tocan el propio bucle de llamadas al
modelo en vez de solo el prompt:

1. **El resguardo a modelos gratuitos perdía el rastro de qué tool se había intentado.**
   `_agenteMsgsToOpenAI` descartaba en silencio cualquier turno `assistant` que solo
   tuviera un bloque `tool_use` sin texto — si Anthropic fallaba a mitad del bucle de
   tools y el sistema caía al fallback (Grok/OpenRouter/GPT-4o), ese modelo de repuesto
   ni siquiera sabía que se había intentado una herramienta. Ahora se sintetiza una línea
   descriptiva del intento en vez de descartarlo.
2. **Si la última tool de un turno fallaba justo cuando ya no quedaban más intentos**
   (las tools se retiran a propósito en la penúltima iteración para forzar una respuesta
   de texto), el modelo respondía como si no hubiera pasado nada — el mismo patrón de
   fondo que motivó la regla de "TRANSPARENCIA SI FALLA" en el prompt, pero sin
   cobertura a nivel de código para este caso límite. Ahora se inyecta una instrucción
   dirigida solo a esa llamada final para que reconozca el fallo y avise que va a
   reintentarlo, antes de responder con lo que sí tenga. Aplicado en los dos bucles
   (`procesarConNEXUS` y `procesarConNEXUSStream`).
3. **`gestionar_tarea`/`gestionar_rfi`/`gestionar_oc`/`gestionar_pedido`** no dejaban ver
   de un vistazo qué campo hace falta para cada acción — la validación en tiempo real ya
   daba buenos mensajes de error, pero el modelo lo descubría a base de fallar primero.
   Reforzada la primera línea de la `description` de cada tool con el campo obligatorio
   por acción (p. ej. `crear` exige `titulo`, `actualizar`/`completar`/`eliminar` exigen
   el id).
4. **Cada turno de `procesarConNEXUSStream` llamaba al modelo dos veces** cuando el
   bucle de tools ya había hecho al menos una llamada real: el bucle en sí no va en
   streaming, y al terminar se hacía una llamada NUEVA en streaming, desde cero, con el
   mismo `messages`, solo para la respuesta visible — el texto que ya había devuelto la
   última llamada del bucle se tiraba. Coste doble y una fuente de inconsistencia real
   (el modelo no es determinista: la segunda llamada podía "decidir" algo distinto de la
   primera). Ahora, si el bucle ya usó una tool y la última llamada ya devolvió texto
   final completo (sin `tool_use` pendiente), ese texto se envía directamente — mismo
   patrón que ya usaba el caso de cliente desconectado/timeout. Cuando el bucle no llegó
   a usar ninguna tool se mantiene la llamada de streaming real sin cambios, porque es la
   que trae la salvaguarda de recuperar un `tool_use` "alucinado" en texto plano por un
   modelo gratis de repuesto — no es redundante en ese caso.

207/207 tests en verde. Pendiente de esta misma auditoría: Parte 1 (memoria enlazada
estilo Obsidian, requiere migración D1 con autorización explícita) y Parte 3 (adelgazar
`base`/`app`/`ingenieria_electrica` con carga condicional por sub-tema) — ver
`PROJECT_STATE.md`.

### Fixed (2026-08-25 — Auditoría a fondo del cerebro de Alejandra: informe + 4 correcciones mecánicas)

Adrián, tras revisar una conversación real con Alejandra donde repitió texto de un turno
anterior, preguntó lo mismo dos veces seguidas y afirmó como hecho confirmado un
diagnóstico técnico que en realidad aún no había comprobado: "audita el cerebro de
alejandra a fondo... quiero que alejandra sea mas efectiva y capaz de todo, mas
inteligente". Auditoría con 4 agentes en paralelo (arquitectura de prompts, catálogo de
tools, enrutado/fallback de modelos, memoria/contexto) sobre `alejandra-agente/worker.js`
completo, publicada como informe. De los 6 arreglos "listos para aplicar", 4 mecánicos
reales aplicados hoy: `obtenerContextoChat` ignoraba el `limit` real en dos queries
(usaba el literal `10` siempre); `limitHistorial` no coincidía entre
`procesarConNEXUS`(3/6) y `procesarConNEXUSStream`(4/10) pese a un comentario que decía
que ya estaban unificados; las 13 llamadas a `registrarTokenUso` eran fire-and-forget sin
`await` (registro de coste/modelo perdible si el Worker cortaba tras responder); y un
comentario obsoleto sobre el nº de iteraciones del bucle. Dos candidatos descartados tras
revisión más de cerca por no ser arreglos reales (ver el commit `b0d5c0f`). 207/207 tests.

### Fixed (2026-08-25 — Alejandra deja de inventar diagnósticos técnicos + PEMP-FILTRO-01/PEMP-GUARDAR-01)

Revisando una conversación real de Adrián con Alejandra en la app móvil: repitió texto
idéntico de un turno anterior en vez de responder a la pregunta actual, preguntó dos
veces seguidas por lo mismo (entrega por Telegram) como si la respuesta de Adrián no
hubiera registrado, y — lo más grave — afirmó un error SQL exacto ("no such column:
modelo") como hecho confirmado en la MISMA frase donde decía que todavía iba a revisar
la estructura real de la tabla. Verificado por grep en los dos workers: no existe
ninguna columna `pemp.modelo` en el código — diagnóstico fabricado, probable confusión
con `herramientas.modelo` (tabla distinta). Añadida "REGLA DE HONESTIDAD TÉCNICA" a los
dos cerebros (`alejandra-agente/worker.js` y `worker.js`): un diagnóstico técnico
concreto no se afirma como hecho sin haber ejecutado de verdad la tool de verificación
correspondiente en esa misma conversación.

De paso, Adrián reportó dos bugs reales de PEMP: **PEMP-FILTRO-01** — los botones de
filtro de stock (`fTodos`/`fActiva`/`fDevuelta`) están pensados para bobinas
(`estado IN ('activa','devuelta')`), pero PEMP/carretillas usan
`Disponible`/`Averiada`/`devuelta` — el filtro "Activas" en PEMP no devolvía nada real.
Corregido enviando al backend solo `estado=devuelta` (el único valor real compartido) y
filtrando "activa" en cliente por exclusión. **PEMP-GUARDAR-01** — "la pantalla de
editar pemp falla, no te deja guardar... hay que salir de la app y volver": el `<select>`
de obra (solo superadmin) se rellena de forma asíncrona tras abrir el modal; si se
pulsaba Guardar antes de que resolviera, `value=""` (placeholder "Cargando...") se
confundía con "— Sin obra —" real y mandaba `obra_id:null`, borrando el valor real en
silencio. Reproducido y corregido en producción contra un PEMP de prueba: el select
ahora marca `data-ready`, el botón Guardar queda deshabilitado mientras carga, y
`obra_id` nunca se envía si la carga de obras falló.

### Changed (2026-08-19 — Informe de Sondas CPD: menos amontonado, tabla más simple)

Adrián, probando el informe con un plano real de 41 sondas: "el plano se ve muy junto
todo" y "quitar muchas opciones de las sondas, con el nombre y el numero de serie es
suficiente". En los dos frontends (móvil y Office): marcadores del plano reducidos de
22px a 15px y el plano se muestra más ancho (900px→1300px, a pantalla completa en
impresión) para que los círculos se amontonen menos en un plano denso real; tabla
reducida a `#`/Nombre/Nº serie (antes también Zona/Temp/Hum/ΔP/Última lectura) — de paso
deja de pedir la última lectura de cada sonda por separado (antes hasta 41 peticiones en
paralelo solo para columnas que ya no se muestran).

### Added (2026-08-19 — Sondas CPD móvil: botón de informe, ausente desde siempre)

Adrián, tras confirmar que ya funcionaba el mover/zoom: "no veo el boton de generar
informe". Existía en Office (`cpdOfficeGenerarInforme`) pero nunca se portó a
`index.html` — no era una regresión de esta ronda, simplemente nunca se construyó en
móvil. Además, la versión de Office usa `window.open()`, poco fiable en un navegador
móvil real (bloqueadores de pop-up) y saca al usuario de la app. Nuevo botón 📄 en la
cabecera del plano; el informe se abre en un modal con `<iframe>` interno (mismo patrón
ya usado en el informe de Telecom Racks), con plano + marcadores numerados + tabla de
sondas con su última lectura, imprimible desde dentro de la app.

### Added (2026-08-19 — Sondas CPD móvil: mover el plano a los lados + zoom con pellizco)

Adrián probando en real, dos avisos más: "sigue sin funcionar el poder mover el mapa con
el zoom puesto... derecha e izquierda no se mueve", y "deberia de hacer zoom tambien con
gestos en pantalla, la gente esta acostumbrada a eso".

- `#cpdPlanoWrap` tenía `touch-action:pan-y` (solo desplazamiento vertical) — con el zoom
  por ancho real (ronda anterior) el plano también se hace más ancho que la pantalla, y
  ese eje estaba completamente bloqueado. Cambiado a `pan-x pan-y`.
- Zoom con gesto de pellizco (dos dedos), anclado al punto medio entre ambos como
  cualquier app de fotos o mapas — se recalcula el scroll del contenedor al cambiar el
  zoom para que ese punto se quede fijo bajo los dedos en vez de saltar. Se ignora
  mientras hay una sonda en arrastre (gesto de un solo dedo) para no interferir.

### Fixed (2026-08-19 — Sondas CPD móvil: el plano seguía viéndose pequeño)

Adrián probó en su teléfono real la ronda anterior (zoom + fix de arrastre): "las sondas
siguen igual" / "el plano sigue viendose pequeño". El bug de arrastre en sí estaba
resuelto — el problema real era que los controles de zoom (＋/－/↺) se habían añadido
como una fila propia entera en la cabecera, en una pantalla ya apretada: el plano visible
quedaba MÁS pequeño que antes de tener zoom, no más grande. Cabecera comprimida a una
sola fila (pista + selector), y el zoom pasa a flotar encima del propio plano (posición
absoluta, esquina inferior derecha) en vez de restar altura.

**Causa raíz real, encontrada verificando en producción**: a `screenCpdPlanoDetalle` le
faltaban la clase `flex-screen` y `height:100%` que sí tienen el resto de pantallas de
`index.html` (`screenDept`, `screenHome`, `screenDocs`…) — sin ellas, `.screen.active`
aplica `display:block` (no `flex`), así que esta pantalla nunca tuvo un alto real de
100%: el contenedor del plano se dimensionaba solo por su contenido. No es un bug
introducido por el zoom de esta ronda — ya existía desde que se creó la pantalla; el
zoom en posición absoluta solo lo dejó en evidencia (medido a 0px de alto). Añadidas
ambas.

### Changed (2026-08-19 — Icono de Ventilación: aspas en el selector, tapa+termostato montado)

Adrián, tras aprobar una muestra: "el icono de ventilacion puede ser unas aspas, pero el
frontal en el rack seria la tapa negra con el termostato en el centro". El selector de
tipo (`_telecomIconoModulo`) mantiene las aspas — más reconocible eligiendo qué montar.
Nueva función `_telecomIconoModuloMontado`/`_telecomOfficeIconoModuloMontado`, usada solo
en la vista de elevación del rack y en la lista "sin colocar": misma tapa plana que
Pasacables, con la pantalla del termostato digital en el centro.

### Added (2026-08-19 — Iconos de módulo de rack en SVG, accesorios "directos", fuera del informe)

Adrián, viendo el rack en un móvil real: los módulos "BMS"/"Seguridad" (tipo switch)
salían con un icono roto (caja vacía) — 🖧 no tiene glifo en la fuente emoji de ese
Android. Además pidió que Pasacables/Ventilación se monten sin pedir rellenar nada
("son directos") y no salgan en el informe de cableado ("ese es relleno").

- **Iconos de módulo pasados de emoji a SVG de línea propio** (móvil y Office): no
  dependen de qué fuente de emoji tenga el dispositivo. `width/height:1em` para heredar
  el tamaño de texto de cada sitio donde ya se pintaban, igual que un emoji.
- **Icono de Pasacables ajustado con foto real de referencia** (Panduit) — Adrián: "de
  frente se ve como una tapa negra con el logo", no un rizo de cable ni los dedos-guía
  que solo se ven en la foto de ángulo del producto.
- **Pasacables/Ventilación se montan sin abrir el modal de datos** al colocarlos (no
  tienen puertos ni campos técnicos que completar), en vez de forzar "completa sus
  datos" como el resto de módulos.
- **Excluidos del informe de cableado** (`telecomGenerarInformeIdf`/
  `telecomOfficeInformeIdf`): son accesorios físicos del rack, no equipo de red.

### Fixed (2026-08-19 — Sondas CPD en el móvil, 2ª ronda: probado con un plano real y denso)

El primer intento (más abajo) se probó solo con 1-2 sondas de prueba. Adrián lo probó
con un plano real ("Modelo Liquid Cooling 1", decenas de sondas juntas) y reportó de
golpe: "con esto asi no se puede trabajar en el movil... los iconos muy grandes,el
plano muy pequeño... y cuando lo amplias no se puede mover", y luego, más concreto:
"cuando pulso en una sonda para moverla saltan las opciones del navegador".

- **Bug real encontrado**: `-webkit-touch-callout:none` (ronda 1) solo frena el menú de
  mantener-pulsado de iOS Safari. En Android/Chrome, mantener pulsado dispara su PROPIO
  menú contextual (evento `contextmenu`) salvo que se cancele explícitamente — ganaba la
  carrera contra el timer de 350ms del arrastre, así que el gesto nunca llegaba a
  armarse. Esta es la causa real de "no se pueden reubicar". Añadido
  `el.addEventListener('contextmenu', e => e.preventDefault())` al marcador.
- **Zoom cambiado de `transform:scale()` a ancho real** del canvas (% del contenedor).
  El transform combinado con el `overflow:auto` del contenedor daba problemas reales de
  arrastre al ampliar; con ancho real no hay transform de por medio, mismo cálculo de
  posición (`getBoundingClientRect()`) sin casos especiales.
- **Marcador de sonda bajado de 40px (ronda 1) a 30px**: 40px se veía bien con 2-3 sondas
  de prueba pero en un plano real y denso se solapaban entre sí. El zoom es la
  herramienta para separar un grupo denso, no el tamaño del marcador.

### Fixed (2026-08-19 — Sondas CPD en el móvil: plano pequeño y sondas que no se movían)

Adrián, sobre el departamento de Control en la app: "el plano se ve pequeño y las sondas
no se puden reubicar, ahi que hacerlo mas comodo para la pantalla del movil" — mismo
patrón que el bug de racks de más arriba: sin forma de ampliar el plano, mover una sonda
con precisión con el dedo era casi imposible.

- **Zoom** (＋/－/↺, igual que ya tenía Office): antes el plano solo ocupaba el ancho de
  pantalla sin forma de ampliarlo. El cálculo de posición de las sondas sigue funcionando
  igual con el zoom aplicado (usa `getBoundingClientRect()`, que ya refleja el tamaño
  visual tras el `transform:scale()`).
- **Marcador de sonda subido de 26px a 40px** — toque real, no cursor de ratón.
- **`-webkit-touch-callout:none` en el marcador**: en iOS Safari, mantener pulsado un
  punto sin esto dispara el menú nativo de "guardar imagen" ANTES de que llegue el timer
  de arrastre (350ms) — cancela el gesto en seco. Probablemente la causa real de "no se
  pueden reubicar" en un iPhone real.
- **Tolerancia de movimiento durante la pulsación larga subida de 8px a 16px** — un dedo
  tiembla más que un ratón durante los 350ms de espera.

### Fixed (2026-08-19 — Racks en el móvil: usabilidad real tras probarlo a mano)

Adrián probó de verdad crear un rack y montar módulos en el móvil y reportó varios
problemas de golpe: "el rack es pequeño... si metemos mas modulos que se amplie solo",
"los modulos no se pueden mover, esta la opcion pero no funciona", y pidió que el
llenado por defecto vaya de arriba a abajo (los nº de U siguen contándose desde abajo,
como en un rack real), que un módulo se vea ocupando su 1U real ("3 agujeros de
tornillo"), y dos módulos nuevos: Ventilación y Pasacables, más un módulo de pantalla
de 4U.

- **Bug real encontrado investigando "no funciona"**: el contenedor de filas del rack en
  `index.html` no tenía `flex-direction:column-reverse` (sí lo tiene `panel.html`) —
  mostraba la U1 arriba en vez de abajo, al revés de un rack real y de Office. Corregido;
  ahora los dos frontends coinciden.
- **Segundo bug real encontrado**: tocar el propio módulo mientras estaba en "modo mover"
  lo confirmaba en su misma posición actual (el backend lo acepta al excluirse a sí mismo
  del choque) — parecía "no pasa nada" con un toast de éxito de fondo. Ahora tocar el
  módulo que se está moviendo cancela, y tocar cualquier OTRO módulo montado avisa que hay
  que tocar un hueco libre en vez de fallar en silencio.
- **Rack pequeño**: el hueco vacío tenía una banda de altura fija sin importar cuántas U
  representaba — un rack de 42U vacío se veía tan bajo como un hueco de 1U, justo al
  revés de lo pedido. Ahora la altura del hueco escala con su nº real de U, así un rack
  vacío arranca alto de verdad y crece según se monta contenido (un módulo ocupa más
  altura por U que un hueco vacío). Chasis más ancho (200/240px según pared/pie, antes
  130/150). Altura mínima de módulo y botón "↕ Reposicionar" subida a 44px — tamaño de
  toque real, no el de un cursor de ratón.
- **Colocación de arriba a abajo**: tocar un hueco ya no calcula la fila proporcional al
  punto exacto del toque (frágil en una banda de pocos px) — monta el módulo pegado al
  techo del hueco tocado, así el primer módulo de un rack vacío cae arriba del todo y
  cada toque siguiente sigue llenando hacia abajo. Mismo criterio en Office al soltar
  sobre un hueco grande (antes usaba 1U fijo para los módulos nuevos sin mirar su propia
  altura, lo que rompía el módulo de pantalla de 4U al arrastrarlo).
- **Agujeros de montaje**: cada módulo colocado (móvil y Office) lleva ahora una tira de
  puntos en el borde izquierdo, agrupados de 3 en 3 por cada U que ocupa.
- **Tres módulos nuevos** (móvil y Office, con icono y color propios): 🌀 Ventilación y
  ➰ Pasacables (1U, sin puertos de red), 🖥️ Módulo de pantalla (4U, sin puertos de red).
  Backend: `worker.js` acepta `tipo` = `ventilacion`/`pasacables`/`pantalla` en
  patch panels, con `num_puertos = 0` (sin crear puertos). Tocar/hacer clic en un módulo
  sin puertos abre su edición directa en vez de una rejilla de puertos vacía.

### Added (2026-08-18 — Racks/Cuadros v2 en la app móvil, toca-y-toca)

- **Port completo a `index.html`** de todo lo construido hoy en Office (diagrama de rack,
  cuadros de campo v2). Adrián: "vamos a hacerlo en el móvil también... por el tema de la
  pantalla pequeña... que sea fácil". En vez de arrastrar (impreciso con el dedo en una
  pantalla pequeña), se usa **toca-y-toca**: tocas una plantilla de la paleta (o un módulo
  ya montado) → entra en "modo colocar" → tocas el hueco del rack donde va. La paleta se
  abre en una hoja inferior en vez de una barra horizontal con scroll. Mismo diseño de
  segmentos que Office (huecos vacíos comprimidos, módulos con altura autoajustable).
- **Cuadros de campo**: dentro del IDF (no ya en pantalla aparte a nivel de obra), con
  componentes en carril DIN. Ahí sin toca-y-toca — el orden no tiene restricción física
  real como las U de un rack — los componentes se añaden al final tocando la paleta y se
  reordenan con flechas ◀▶, más simple con el pulgar.
- **Regresión real corregida de paso**: la creación de cuadro en móvil todavía mandaba
  marca/modelo/num_puertos (que el backend dejó de usar hoy con cuadros v2), creando
  cuadros sin componentes en silencio desde el despliegue de esa migración. También se
  había perdido el campo Ubicación al reestructurar el formulario de cuadro (tanto en
  móvil como en Office) — repuesto en los dos.
- **Iconos realistas de puerto** (RJ45/LC fibra) también en la vista de puertos móvil.
- **Bug de condición de carrera encontrado verificando en producción**: al colocar un
  módulo/componente nuevo, el modal de edición se abría antes de que la lista se hubiera
  recargado — `telecomEditarEntidad` encontraba el caché todavía vacío y no hacía nada, en
  silencio. `telecomAbrirRack`/`telecomAbrirCuadro` ahora devuelven la promesa de la carga
  y se esperan con `await` antes de abrir el modal. Verificado en producción con viewport
  móvil (375×812): rack con tipo/altura, módulo colocado y editable, cuadro con vínculo de
  fibra real (puerto queda ocupado con el nombre del cuadro), componentes en carril DIN
  con reordenación, iconos de puerto — todo probado de extremo a extremo con datos de
  prueba, creados y borrados en la misma sesión.

### Added (2026-08-18 — Cuadros de campo v2: caja exterior con componentes, Office)

> ⚠️ **Pendiente antes de usar**: código desplegado (Worker + Pages) pero la migración D1
> no se ha podido aplicar todavía — el clasificador de seguridad del modo automático la
> bloqueó (no las reglas del proyecto, que ya la tenían autorizada). Ejecutar los 3
> comandos de `migrate_telecom_cuadros_v2.sql` contra producción antes de crear/editar
> cuadros de campo; hasta entonces esa parte dará error 500 (el resto de la app, incluidos
> los racks, no se ve afectado — la carga de cuadros dentro del IDF falla en silencio y
> simplemente no muestra la sección).

- **TELECOM-CUADRO-02:** Adrián, retomando el diseño de los racks: "se nos olvido el otro
  modelo que teniamos... cuadro exterior donde podiamos elegir un switch gestionado" →
  "que los metemos en un cuadro electrico adaptado para ello y se cuelga en el exterior (en
  una farola por ejemplo)" → "al igual que los IDF podriamos tener un cuadro de plastico
  exterior dibujado donde meteriamos cosas, por ejemplo el switch, fuente alimentacion,
  fuente POE para camara si necesitara, un hub de fibra tambien etc" → "mismo estilo que
  con los IDF no?". Los cuadros de campo se mueven dentro del IDF (antes vivían en una
  pantalla aparte a nivel de obra, con botón propio "🧰 Cuadros de campo") y pasan de ser
  "un switch con marca/modelo/nº puertos" a ser una caja IP65 dibujada (colgada de una
  farola/pared, con patas/soporte y sombra igual que los racks) que contiene componentes
  sueltos montados en un carril DIN horizontal: switch DIN gestionado (Cisco/Ubiquiti/
  genérico), fuente de alimentación, inyector POE (cámaras), hub de fibra, o personalizado
  en blanco — arrastrables desde una paleta, mismo patrón pointerdown/pointermove/pointerup
  que los racks, pero sin colisión de posición (el orden en el carril es solo visual, con
  índice fraccional para reordenar sin reindexar todo al arrastrar).
- **Vínculo real por fibra:** "ese switch va a un IDF pero con fibra claro" → "asique en el
  IDF se conectaria al panel de fibra" → "que tambien tendriamos que seleccionar las bocas
  para decir que ahi conectado". Antes el cuadro solo apuntaba a "el IDF" en abstracto; ahora
  el modal "Nuevo/editar cuadro" tiene un selector en cascada IDF → panel de fibra de ese
  IDF → puerto libre concreto — al guardar, ese puerto queda marcado ocupado con el nombre
  del cuadro (igual que cualquier otro puerto), y se libera automáticamente si se cambia de
  puerto o se borra el cuadro.
- **Backend:** tablas nuevas `telecom_cuadro_componentes` / `telecom_cuadro_componente_puertos`
  + columna `puerto_conexion_id` en `telecom_cuadros_campo` (migración aditiva; verificado
  antes de migrar que ambas tablas afectadas tenían 0 filas en producción, así que no hace
  falta migrar datos existentes). Endpoints nuevos para componentes/puertos y para listar
  paneles de fibra de un IDF con sus puertos libres (`GET /telecom/paneles-fibra`).
- **Arreglo de paso, encontrado revisando el diagrama de racks del mismo día:** faltaba un
  botón para eliminar un rack/módulo/IDF/cuadro/componente directamente desde su modal de
  edición (antes solo existía en las filas de la lista antigua, y el nuevo diagrama de rack
  no tenía filas) — añadido "🗑 Eliminar" en el pie del modal genérico de Telecom.
- Pendiente para otra ronda: portar todo esto (racks + cuadros v2) a `index.html` (app
  móvil), igual que se hizo con Correos.

### Added (2026-08-18 — Racks/Cableado: diagrama visual con arrastrar-y-soltar, Office)

- **TELECOM-ELEVACION-01:** Adrián: "quiero darle una vuelta al tema racks en telecom... lo
  quiero hacer mas visual todo". La vista de un rack (`panel.html`, Office) deja de ser una
  lista plana de módulos: ahora es un diagrama de elevación real (armario de pie o de
  pared, filas U numeradas de abajo a arriba, como se monta un rack en persona). Una barra
  de herramientas con plantillas de módulo (Cisco, Ubiquiti, Panduit/genérico, más
  "Personalizado" en blanco) se arrastra al armario para montarlos; los ya montados
  también se pueden arrastrar para reposicionarlos. Mismo patrón
  pointerdown/pointermove/pointerup que Sondas CPD (funciona con ratón y touch), con snap a
  fila U en vez de posición libre, y el mismo mecanismo de zoom para leer nombres con
  detalle en racks altos. Al hacer clic en un módulo ya montado se entra directamente a
  gestionar sus puertos (funcionalidad ya existente, sin cambios). El IDF muestra todos sus
  racks lado a lado compartiendo el mismo "suelo" ("cuando haya dos quiero verlos juntos"),
  no apilados.
- **Dos tipos de rack:** "también da la opción de crear rack de pared o de pie" — de pared
  (12U por defecto, dibujado montado en la pared) y de pie (42U por defecto, ≈1,86m real —
  "aquí se utilizan rack de 1,80mts de altura", dibujado de pie con base, patas de
  nivelación y sombra de suelo).
- **Backend:** `telecom_racks` gana columnas `altura_u` y `tipo` (pared/pie, con altura por
  defecto según tipo al crear); `telecom_patch_panels` gana `pos_u_inicio`/`pos_u_altura`.
  El backend valida que la posición de cada módulo quepa en el rack y no se solape con
  otro (409 con mensaje claro) — el resaltado del frontend durante el arrastre es solo
  ayuda visual, la barrera real está en el servidor. Migraciones aditivas: los racks y
  módulos ya existentes quedan con los valores por defecto (`altura_u=42`, `tipo='pie'`,
  módulos sin colocar aparecen en una lista aparte hasta que se arrastran a su sitio).
  Verificado en producción: creación de rack de cada tipo con la altura correcta, colisión
  de módulos rechazada con 409, reposición por arrastre, y clic en módulo montado → vista
  de puertos.
- Pendiente para otra ronda: portar el mismo diagrama visual a `index.html` (app móvil),
  igual que se hizo con Correos.

### Fixed (2026-08-17, noche — muñeco de EPIs)

- **Colores del muñeco de dotación de EPIs sin relación con la prenda real:** Adrián: "al
  seleccionar los EPIs en el muñeco ahí colores que no corresponden con los EPIs
  seleccionados... los chalecos son amarillos o naranjas, pero no verdes. Las botas
  también, suelen ser negras o grises". El color de estado (ok/caduca pronto/caducado)
  pintaba directamente el relleno de cada prenda. Ahora el relleno usa el color real
  aproximado de cada EPI y el estado se indica en el borde (las chips de la lista ya
  dicen el estado en texto). Mismo fix en `panel.html` e `index.html` (código idéntico en
  los dos). Verificado en producción: chaleco activo → relleno naranja + borde verde;
  botas caducadas → relleno negro/gris + borde rojo; sin asignar → gris neutro.

### Fixed / Added (2026-08-17, noche — Sondas CPD)

- **Mismo patrón de bug ya visto en Telecom (TELECOM-NAV-01), confirmado también aquí:**
  los modales "Nuevo plano de sala" y "Sonda" tenían el contenido pegado al borde (0px de
  padding, misma causa: sin la estructura `modal-header`/`modal-body`/`modal-footer`); y el
  auto-refresh de 60s de la página (`SYNC_INTERVALS.cpdSondas`) sacaba al usuario del plano
  en el que estaba trabajando (colocando/arrastrando sondas) de vuelta a la lista de
  planos. Mismo fix: estructura de modal correcta, y el refresco ahora no hace nada con un
  modal de edición abierto, o refresca el mismo plano si el usuario ya está dentro de uno.
- **Plano demasiado pequeño:** Adrián: "el plano es demasiado pequeño y al colocar las
  sondas no caben". El canvas tenía `max-width:900px` fijo en JS mientras su contenedor no
  tenía límite propio — en monitores de oficina anchos sobraba espacio sin usar. Quitado el
  límite.
- **Zoom para ampliar el plano:** Adrián: "podemos hacer que se pueda ampliar el plano para
  colocar las sondas". Controles ＋/－/↺ junto al selector de etiquetas — el cálculo de
  posición de las sondas sigue siendo correcto con cualquier nivel de zoom. Verificado en
  producción: ancho 900px→1350px con zoom al 150%, sonda colocada en la posición exacta
  esperada (30%, 30%).

### Added (2026-08-17, noche — Correos)

- **Marcar leídos en bloque:** Adrián: "porque no ahí la opción de marcar como leídos" /
  "entonces nunca se quita las notificaciones". Solo existía leído/no-leído correo a
  correo (el punto de color); sin una acción en bloque, el badge de correo nuevo se
  quedaba inflado salvo que se abriera cada correo uno a uno. Nuevo botón "✅ Marcar
  leídos" en la barra de selección múltiple, mismo patrón que Categorizar/Archivar/Borrar.
  Verificado en producción: badge de "1" a "0" tras seleccionar y marcar.

### Fixed (2026-08-17, noche — OBRA-AUTO-01)

- **Selector de obra sin poblar en 130+ pantallas del panel, para encargado/operario:**
  Adrián: "la obras se deben de detectar solas en el panel no? los usuarios ya tienen
  obras asignadas". Causa raíz: `GET /obras` exige superadmin/empresa_admin/desarrollador/
  jefe_de_obra (decisión ya tomada en `FILTRO-OBRA-01`, 25/07/2026 — el backend de cada
  endpoint concreto ya fuerza la obra de sesión para el resto de roles), pero
  `cargarObrasPanel()` no manejaba ese 403 con gracia: `_panelObras` se quedaba con el
  objeto de error en vez de un array, su `.map()` lanzaba, y el `catch` vacío abortaba
  TODA la función — incluido el mecanismo que ya ocultaba 4 selectores especiales para
  estos roles. Arreglado el manejo del 403, y extendido el mismo criterio de "ocultar si
  no puede elegir de verdad" a `poblarSelectObras()`, la función genérica usada en más de
  130 pantallas (Fichajes, Tareas, RFIs, Calidad, Presupuestos, Certificaciones...).
  Verificado en producción con un usuario de prueba real (`encargado`): selector oculto;
  con `empresa_admin`: selector poblado normalmente.

### Added (2026-08-17, noche — Informe Semanal de Seguridad)

- **Pie de foto:** columna nueva `informes_seg_fotos.titulo` (migración D1 autorizada).
  Al subir una foto en cualquiera de los tres puntos donde se hace (nueva actividad,
  editar actividad, añadir foto extra) se puede poner un título opcional; sale como pie
  de foto (cursiva, debajo de la imagen) en el `.docx` y en la vista de impresión, y ya se
  ve en la propia app/panel bajo cada miniatura. Nuevo `PUT /informes-seg-fotos/:id` para
  corregirlo después sin rehacer la foto.
- **Paridad app/panel:** tres huecos reales cerrados en `panel.html` (la app ya los
  tenía) — botón "+ Nuevo informe" para arrancar la semana de una obra que aún no tiene
  ninguna actividad (antes solo se listaban semanas ya empezadas desde el móvil); editar
  una actividad ya guardada (antes solo crear/borrar); añadir una foto extra a una
  actividad existente (antes solo al crearla).

### Added (2026-08-17, noche — toque profesional)

- **TELECOM-NAV-01, mejoras visuales:** cada IDF muestra ahora cuántos racks tiene y cada
  rack cuántos módulos, sin entrar (mismo criterio que ya usaba el nivel de módulos con
  ocupados/libres); icono según el tipo real de módulo (🔌 cobre / 🧵 fibra / 🖧 switch) en
  vez del mismo icono siempre; breadcrumb con la ruta completa (IDF › Rack › Módulo) en la
  vista de Puertos, que antes solo mostraba el nombre del módulo actual. Verificado en
  producción tanto en `panel.html` como en `index.html` con datos de prueba reales
  (creados y borrados en la misma verificación).

### Fixed (2026-08-17, noche)

- **Título del topbar se rompía en 3 líneas y se solapaba con el contenido:** Adrián
  (captura, sección Informe Semanal de Seguridad). `.topbar-title` no tenía
  `white-space:nowrap`/`overflow`; con muchos elementos a la derecha (selector empresa,
  obra, departamento, usuario) el título se quedaba sin ancho y se envolvía en vez de
  truncarse con "…" — y como `#topbar` tiene altura fija (68px), el texto desbordado
  quedaba encima del contenido de la página. Fix global (afecta a cualquier título largo
  en cualquier página, no solo esta).
- **Botón "✏️ Plantilla" del Informe Semanal no hacía nada:** `GET /mi-empresa` nunca
  devolvía `ok:true` en su respuesta (solo `{empresa,obras,usuarios}`), pero
  `abrirModalPlantillaInformeSeg()` comprueba `if (!r.ok)` — patrón estándar del resto de
  la API — así que entraba siempre en la rama de error sin abrir el modal, aunque la
  petición funcionara bien.
- **Informe de Telecom — puertos demasiado grandes:** Adrián: "los puertos en los paneles
  cuando se hace el informe salen más grandes... son demasiado grandes". La cuadrícula de
  puertos usaba columnas por fracción de ancho (`repeat(12,1fr)`), así que en una página
  ancha cada celda se hacía enorme, sin importar cuántos puertos tuviera el módulo.
  Cambiado a celdas de tamaño fijo (26×26px), tantas por fila como quepan. Verificado
  midiendo la celda renderizada: antes ~75×75px en un contenedor de 900px, ahora 26×26px
  fijos.

- **TELECOM-NAV-01 (hardening pre-datos-reales):** Adrián, antes de empezar a meter datos
  reales en Racks/Cableado: "no puede fallar". Auditoría completa del módulo (backend +
  los dos frontends): `puedeEliminarTelecom()` era idéntico a `puedeEditarTelecom()` —
  cualquier usuario del departamento telecom podía borrar IDF/rack/patch panel/cuadro por
  API directa, aunque los dos frontends ya ocultaban el botón a todos menos a los roles
  responsables (el propio comentario del código decía esa intención, sin implementarla).
  Alineado con la lista de roles que ya exigían `_telecomOfficePuedeEliminar()`/
  `_telecomPuedeEliminar()`. Además, ni el nombre de IDF/rack/patch panel/cuadro ni los
  campos de un puerto tenían límite de longitud (a diferencia del resto de campos del
  módulo) — alineado a 160/1000 caracteres, backend y frontend. Confirmación de borrado de
  patch panel/cuadro ahora avisa cuántos puertos tienen datos reales antes de confirmar.
  Verificado en producción con un usuario de prueba operario/telecom real (DELETE → 403;
  con empresa_admin → 200; nombre/destino de 200 caracteres → 400).

### Added (2026-08-17)

- **CORREOS-PANEL-01:** página nueva "📧 Mis Correos" en `panel.html` — sincroniza el Gmail
  real del usuario (caché nueva en D1, `gmail_mensajes_cache`), filtra por categoría, marca
  leído/categoriza por correo (dentro de la app, sin permisos nuevos de Google — nunca toca
  el Gmail real), redacta y envía, y "Organizar con Alejandra" delega en el chat real. Nueva
  tool `categorizar_correos` del ayudante "correos". Expandido en la misma sesión, a partir
  de pruebas en vivo de Adrián: borrar correo (con confirmación, distinto de archivar),
  selección múltiple por checkbox para archivar/borrar/categorizar en lote, redactar con
  adjuntos (hasta 20MB) en un modal más grande, y **varias cuentas de Gmail a la vez** con
  cambio rápido entre ellas (tabla nueva `gmail_cuentas`, migración `migrate_gmail_cuentas.sql`
  — sustituye a `gmail_oauth_tokens`, que se queda sin usar) con aviso de correo nuevo para
  las dos cuentas conectadas, mismo patrón que el resto de notificaciones del panel.
- **INFORMES-FICHAJES-01:** informe de fichajes imprimible (horas por día/semana/mes,
  agregado en JS sobre `horas_trabajadas`/`horas_extra`, ya calculadas al crear cada
  fichaje). Botón "📊 Informe" en Fichajes de `panel.html`.
- **ALMACEN-FILTRO-MOVIL-01:** Almacén ve el material de todos los departamentos desde el
  móvil, mismo criterio que ya tenía `panel.html` — filtro opcional por departamento.

### Fixed (2026-08-17)

- **BUGFIX-CACHE-PROMPT-01:** dentro del bucle de `tool_use` de `delegar_tarea`, la 2ª+
  llamada a `llamarAnthropic()` usaba `ayudante.systemPrompt` en vez de `promptAyudante`
  (con la regla `esDevVerificado`) — rompía el caché de prompts de Anthropic entre llamadas
  de la misma delegación y reabría parcialmente la fuga de detalle técnico que cerró
  `AYUDANTE-DETALLE-TECNICO-01`. Encontrado investigando una afirmación de Alejandra al
  usuario que resultó ser falsa (dijo que faltaba `cache_control`, cuando ya estaba bien
  aplicado en los dos Workers). Fix de una línea, 207/207 tests.
- **Compose de correo:** el botón del modal de redactar/responder decía "Guardar" en vez de
  "Enviar" (usaba el modal genérico sin sobreescribir el texto por defecto).
- **Envío de correo con adjuntos — "Maximum call stack size exceeded":** `_b64u()`
  construía el base64 con `String.fromCharCode(...bytes)` vía spread, que revienta el
  límite de argumentos del motor JS para buffers de más de un par de cientos de KB. Solo se
  detectó al adjuntar un archivo real porque antes `_b64u` solo se usaba con buffers
  pequeños (IVs, JWT, claves VAPID). Fix: trocear en bloques de 8KB antes de
  `fromCharCode`. Verificado byte a byte contra `Buffer.toString('base64')`.
- **`getCorreosNuevasTodasCuentas`:** una sola cuenta de Gmail con el token cifrado
  corrupto tumbaba la comprobación de correo nuevo de TODAS las cuentas del usuario
  (`descifrarToken()` lanzaba en vez de fallar solo esa cuenta). Ahora esa cuenta se salta
  con un error legible, el resto sigue funcionando.
- **TELECOM-NAV-01:** en la sección Racks/Cableado de `panel.html`, los modales de
  IDF/Rack/Módulo/Puerto tenían el contenido pegado al borde del modal (0px de padding —
  no usaban la estructura `modal-header`/`modal-body`/`modal-footer` del resto de la app).
  Además, el auto-refresh de 60s de la página (`SYNC_INTERVALS.telecomRacks`) reseteaba
  siempre nivel y contexto de navegación a la lista de IDFs sin mirar en qué nivel estaba
  el usuario — si el refresco caía mientras alguien editaba un puerto, guardar lo devolvía
  a la lista de IDFs en vez de a la vista de Puertos de la que venía. Ahora el refresco
  respeta el nivel actual (o se omite si hay un modal de edición abierto), mismo criterio
  que `SYNC-INV-01` en `index.html`.

### Added (2026-08-13/14)

- **COMPAT-CAE-01:** Adrián — "tenemos otra app [Nalanda] que gestiona documentación de
  trabajadores y genera tarjetas... necesitamos ser compatibles con ellos". Investigado:
  Nalanda no publica API ni formato de QR abiertos, así que es un puente manual, no una
  integración automática. `GET /trabajador-documentacion` nuevo (carnets + EPIs +
  reconocimiento médico, solo apto/no apto sin detalle clínico); `GET /carnets` acepta
  `usuario_id`/`externo_id`. Ficha imprimible A4 en `panel.html` con las mismas dos
  categorías que la tarjeta real de Nalanda (Oficios/Máquinas habilitadas, viendo la
  tarjeta física de Adrián). Tarjeta con QR (`index.html`/`panel.html`) con fila de
  pictogramas de oficios/máquinas.
- **AYUDA-PANTALLA-01:** `panel.html` ya mandaba `pantalla` como texto enriquecido
  (`AYUDA_SECCIONES`, ~90 páginas); `index.html` solo mandaba el id crudo de la pantalla.
  Mismo patrón replicado (`_AYUDA_PANTALLAS`, 31 pantallas) sin tocar el backend — el campo
  `pantalla` siempre fue texto libre en `construirMessages()`, nunca hay comparación exacta
  contra su valor.
- **INFORMES-SEG-CIERRE-01:** paridad completa de gestión del Informe Semanal en los dos
  frontends, más allá de la captura diaria que ya existía (`INFORMES-SEG-SEMANAL-01`,
  2026-08-13 mañana):
  - Navegación por semanas anteriores y edición de actividades ya guardadas (antes solo
    "añadir nueva" o "borrar"; nuevo `PUT /informes-seg/actividad/:id`).
  - `index.html`: botón 📄 en Informe Semanal abre un modal para editar Aspectos
    críticos/Observaciones/Otros puntos, cerrar/reabrir el informe y generar el documento
    final (Word descargando el `.docx` ya generado en el servidor; PDF con la misma
    ventana de impresión que usa el resto de la app) — antes esa parte solo existía en
    Office.
  - `panel.html`: formulario "+ Nueva actividad" dentro del detalle del informe (antes
    solo se podía revisar/cerrar/borrar actividades sueltas, nunca crear una) y botón 🗑
    para borrar un informe semanal entero — nuevo `DELETE /informes-seg/:id` (cascada:
    fotos de R2, `informes_seg_fotos`, `informes_seg_actividades`, la fila del informe).
  - Placeholders de ejemplo en los 3 campos de texto libre del cierre — Adrián: "no
    entiendo bien este informe" / "creo que no queda claro" qué poner ahí.
- **APP-REPASO-DEPARTAMENTOS-01:** repaso departamento por departamento del menú de
  `index.html`, confirmando cada cambio con Adrián antes de aplicarlo:
  - Tarjetas del selector de departamento: `min-width:0` en el contenedor de texto (bug de
    flexbox — sin él, un nombre largo como "Telecomunicaciones" empujaba el chevron fuera
    de la tarjeta en vez de envolver).
  - **Control** (monitorización de salas CPD): quitadas PEMP y Carretillas (no usa
    plataformas elevadoras ni carretillas); confirmado que conserva Herramientas/Pedidos/
    Calendario/Incidencias/Galería/Documentación/Planos/Partes.
  - **Ingeniería**: se deja como está en el móvil (ya sin PEMP/Carretillas) — la paridad
    completa con la sección técnica de `panel.html` (RFIs, Contratos, Submittals...) queda
    fuera de alcance, esas pantallas no existen en el móvil.
  - **Obra Civil/Albañilería/Pintura/Carpintería**: confirmado que se tratan como
    Eléctrico (menú completo, sin Bobinas) — sin cambio de código. Agrupadas visualmente
    bajo una sola tarjeta "Obra Civil" que abre un selector con las 4 opciones (respeta
    los departamentos activos de cada empresa), sin crear jerarquía real en el dato — cada
    una sigue siendo su propio `departamento` plano.
  - **Almacén**: reducido a Bobinas/PEMP/Carretillas/Herramientas/Pedidos ("el almacén es
    solo para material", mismo criterio que `panel.html`), reutilizando
    `_HOME_DEPT_ALLOWED_CARDS` (la lista blanca que ya usaba Telecom). Pendiente aparte,
    más grande: `panel.html` además deja a Almacén ver el material de TODOS los
    departamentos (`filtroDeptModal`) — en el móvil de momento solo ve el suyo.
  - Tarjeta "Alejandra IA" eliminada del listado de módulos en todos los departamentos —
    era 100% redundante con el botón central de la barra inferior (`navIABtn`), que ya
    lleva al chat desde cualquier pantalla para todos los usuarios logados.
  - RdP (Registro Diario de Prevención) reasignado a Seguridad; Hormigonado (registro
    EHE-08) reasignado a Obra Civil; Formación reasignada a Personal (tarjeta nueva en
    `perPanelHome`, reutilizando la pantalla ya existente `navTo('formacion')`). Estaban
    gateadas solo por rol, visibles en todos los departamentos por igual, sin ningún
    criterio de pertenencia — pendiente que ya estaba anotado sin decidir en `TASKS.md`.
    Corrección de bug propio: el primer intento de mostrar RdP en Seguridad vivía en
    `#screenHome`, pero ese departamento navega directo a `#screenSeguridad` y nunca llega
    a mostrar esa pantalla — la tarjeta real se movió a `segPanelHome`.
  - Nombre completo "Registro Diario de Prevención (RdP)" en vez de solo "RdP" en tarjetas
    y modal — Adrián: "RDP no se sabe lo que es".

### Fixed (2026-08-12/13)

- **DOCS-TABS-DEPT-02:** las pestañas de departamento en Documentos (`panel.html`)
  mostraban todos los departamentos aunque un admin tuviera uno concreto elegido en el
  selector del topbar — la excepción de admin ignoraba esa elección. Ahora se filtra por
  `SESSION.departamento` igual para admins y no-admins; solo se muestran todas cuando no
  hay ninguno elegido ("Todos los departamentos").
- **DASHBOARD-KPIS-VACIOS-01:** el dashboard principal de `panel.html` no actualizaba
  Trabajadores activos, Obras activas, Equipos averiados ni Alertas de stock —
  `/obra-dashboard` nunca devolvía `trabajadores_activos` ni `equipos_averiados`, y el
  frontend leía `dash.stock_bajo` cuando el backend manda `alertas_stock`. Trabajadores y
  Obras se calculan ahora en el frontend a partir de `/personal/trabajadores` y
  `/obras-overview` (ya se pedían en la misma carga); Equipos averiados con una query
  nueva en `getObraDashboard` (`LOWER(estado)` para cubrir la mezcla de mayúsculas/
  minúsculas real de D1); Alertas de stock leyendo el campo que el backend sí manda.
- **DELEGACION-SSE-01:** `delegar_tarea` (usado por el ayudante de Correos, entre otros)
  ejecutaba todo su bucle interno (varias llamadas a Claude + tools del ayudante) sin
  emitir ningún evento SSE — el chat se quedaba en "Pensando" en silencio mientras el
  ayudante trabajaba, sin el `tool_start`/`tool_end`/`progreso` que sí tiene el resto de
  tools. Se replica el mismo patrón y se propaga `sendSSE` a las tools del ayudante (antes
  se les pasaba `undefined`).
- **FAB-SCAN-OCULTO-01:** el botón flotante de escaneo remoto en `panel.html` (Office) se
  mostraba siempre, aunque no hubiera ningún móvil emparejado — `rsAbrirScanModal()` solo
  sirve para lanzar un escaneo EN un móvil ya conectado; sin uno, el botón solo producía un
  toast de error. Se oculta ahora junto con su etiqueta mientras no haya un móvil real
  conectado, mismo criterio que ya usa el botón de escaneos pendientes.

### Fixed (2026-08-13, noche)

- **SELECTOR-EMPRESA-ROL-01:** el selector de empresa del topbar de `panel.html` (añadido el
  mismo día, commit `7d83661`) no le aparecía a Adrián. Causa: `getMisEmpresas()`/
  `cambiarEmpresaSesion()` solo reconocían `isDesarrollador` literal, pero su cuenta real
  tiene `rol=superadmin` (no `desarrollador`) y una única fila en `usuarios` — caía en la
  rama de "misma empresa por email" y esa devolvía solo 1 empresa. Verificado antes de tocar
  el código que ampliar a `isSuperadmin` es seguro: solo hay un `superadmin` en toda la base
  (Adrián), y SEC-AUDIT-03 ya impide que un `empresa_admin` se autoasigne o asigne a otros ese
  rol — por diseño ya significa "Todo" (tabla de roles de `CLAUDE.md`), igual que
  `desarrollador`. De paso, se le añadió el rol `desarrollador` como `roles_extra` (sin tocar
  su `rol` principal) para dejar su cuenta alineada con la tabla de roles documentada.

### Fixed (2026-08-13, tarde)

- **BOTONES-FEEDBACK-01:** ~95 botones "Guardar" de toda la suite (`index.html`, `panel.html`,
  `alejandra-panel.html`) sin ningún indicio visual de "en curso" — Adrián probó el informe
  semanal de Seguridad, el guardado tardó, pulsó varias veces y generó 3 entradas duplicadas.
  Escalado explícitamente a auditoría de toda la app con varios agentes en paralelo. Fix: un
  helper `conBoton(btn, fn, textoOcupado)` por archivo (deshabilita el botón + cambia el
  texto + restaura en `finally`), aplicado con un cambio de una línea en el
  `onclick`/`onsubmit` de cada sitio.
- **APICALL-3ARGS-01 (commit `7d83661`, encontrado durante la misma auditoría):** bug crítico
  de pérdida silenciosa de datos — `apiCall(path, options)` solo acepta DOS argumentos, pero
  24 llamadas en 7 módulos (Tareas de obra, Órdenes de Cambio, Actas de Reunión, Control de
  Calidad/Deficiencias, Subcontratas, Presupuesto de obra, RFIs) le pasaban TRES
  (`apiCall(ruta, 'POST', body)`). El método quedaba en GET por defecto y el body se perdía
  entero, mientras la UI mostraba "guardado ✓". Introducido el 24/06/2026 (commit
  `2639128`) — casi 7 semanas en producción sin detectarse. De paso, en el mismo commit:
  selector de empresa en el topbar de `panel.html` (Adrián: "no puedo cambiar de empresa en
  el panel office"), acotado a desarrollador o a un usuario con cuenta propia en otra empresa
  con el mismo email y rol `empresa_admin`/`superadmin` (nunca un `empresa_id` arbitrario del
  cliente, mismo criterio que el hardening SEC-14 de departamento).

### Added (2026-08-13)

- **INFORMES-SEG-SEMANAL-01:** informe interno semanal de Seguridad y Salud Laboral por obra, calcado de la plantilla real de Levitec (S31 Informe semanal). El técnico añade actividad+contratista+foto desde `index.html` durante la semana (el informe se resuelve solo por fecha, nunca se "abre" a mano); Seguridad revisa y cierra desde `panel.html`, rellenando Aspectos críticos/Observaciones/Otros puntos, y genera el documento final como PDF imprimible o `.docx` real y descargable. Primera dependencia npm real de `worker.js` (`docx`, generado con `Packer.toArrayBuffer()` — `toBuffer()` no funciona en el runtime de Workers, usa `Buffer` de Node). Migración D1 de 3 tablas autorizada explícitamente. Pipeline de deploy actualizado (`package.json`/lockfile trackeados, `npm ci` en `deploy-worker.yml`). Probado en vivo de extremo a extremo contra producción.

### Fixed (2026-08-12, noche)

- **CORREO-AYUDANTE-ROUTING-01:** Alejandra negaba tener acceso a Gmail pese a que el ayudante de Correos (F6.1-AYUDANTES-CORREOS) ya estaba desplegado y conectado. Dos causas reales: (1) algunas frases sobre correo se clasificaban como experto `web`, que no tiene `delegar_tarea` en su catálogo de tools — imposible alcanzar el ayudante desde ahí; (2) incluso clasificado correctamente como `app` (con `delegar_tarea` disponible), el modelo no lo usaba y respondía inventando que faltaba implementar OAuth2. Fix: regla determinista en `REGEX_ROUTES` para correo/Gmail/bandeja de entrada → experto `app`, más una regla explícita en el prompt instruyendo usar `delegar_tarea` para correo/pedidos en vez de negar la función.
- **CHAT-SCROLL-INICIAL-01:** el chat ✨ de `panel.html` no bajaba nunca al último mensaje al abrirlo — parecía que "no guardaba el historial" cuando en realidad sí lo cargaba, solo que se quedaba scrolleado arriba del todo. Causa: el auto-scroll comprobaba si el usuario ya estaba cerca del final ANTES de pintar los mensajes, pero al abrir el chat el scroll siempre arranca en 0. Fix: la primera carga tras abrir el chat siempre baja al final; las cargas siguientes (sondeo cada 5s) siguen respetando si el usuario subió a leer mensajes antiguos. Publicado en Pages.
- **CORREO-CREDENCIALES-01:** tras arreglar el enrutamiento, el ayudante de Correos llegó por primera vez a un error real de Gmail (API sin habilitar en el proyecto de Google Cloud) y, en vez de relayarlo, improvisó un flujo de OAuth2 manual pidiéndole a Adrián su Client ID/Secret/Refresh Token por chat — datos que nunca se pasan a mano (ya configurados como secretos del servidor / generados solo al conectar Gmail desde Mi cuenta). Fix: grounding explícito en el prompt del ayudante prohibiendo pedir credenciales.
- **AYUDANTE-DETALLE-TECNICO-01:** el mismo error técnico (mensajes de la API de Google, ID de proyecto de Google Cloud) se mostraba igual sin importar el rol de quien preguntara. Adrián: "Alejandra no puede decir estas cosas a los usuarios, a mí sí" / "no puede decir ni pedir nada respecto al desarrollo de la app". Fix: el prompt del ayudante se construye ahora según `esDevVerificado` — detalle técnico completo solo para Adrián; para cualquier otro usuario, una frase fija sin tecnicismos ("Póngase en contacto con el desarrollador/administrador para solucionar el problema").

### Added

- **CATALOGO-PROVEEDORES-01 (2026-08-12):** Adrián pidió cargar los catálogos de Hilti/Pemsa/Würth (proveedores habituales). En vez de una tabla estática con referencias inventadas, el ayudante de Pedidos de Alejandra recibe la tool `buscar_web` (ya existente) para consultar la referencia real cuando se le pide un material que no conoce, priorizando las webs oficiales de esos tres proveedores; si no encuentra nada fiable, crea el pedido igualmente con la descripción que le dé el humano. Hilti, Pemsa y Würth dados de alta en `proveedores_gestion` (Levitec).

### Fixed

- **CATALOGO-PROVEEDORES-02 (2026-08-12):** el autorrelleno de email al "Enviar pedido por correo" (`panel.html`) buscaba en `/proveedores`, un catálogo simple sin columna `email` en D1 real — llevaba roto en silencio desde que existe el modal. Corregido para consultar `/proveedores-gestion` (Gestión de Proveedores, con alta manual real de email/contacto).

- **PEDIDOS-AYUDANTE-DEPT-01 (2026-08-12):** encontrado al verificar en vivo `F6.1-AYUDANTES-PEDIDOS` — el ayudante de Pedidos (`gestionar_pedido`) confiaba en que el modelo pusiera el `departamento` correcto al crear un pedido (llegó a escribir el nombre+rol del usuario en ese campo). Un pedido con un departamento inventado queda invisible al filtrar por el departamento real, la misma fuga de aislamiento que `PEDIDOS-ALMACEN-01` cerró el 11/08. Corregido: el departamento se resuelve siempre desde la sesión real (`usuarios.departamento` por `usuario_id`), igual que ya hace `crearPedido` en `worker.js` — el modelo deja de poder elegirlo al crear.

- **Tarjeta imprimible con el código/PIN de fichar en texto plano (2026-08-11):** las tres tarjetas imprimibles (index.html × 2, panel.html × 2) mostraban el código bajo el QR — cualquiera que viera o fotografiara la tarjeta podía leerlo y saltarse el QR. Retirado; el QR es ahora el único medio de leerlo desde la tarjeta.

- **TABULATOR-RACE-02 (2026-08-11):** `tblPersonal` (tabla "Trabajadores" de panel.html, nueva esta sesión) entraba en `RangeError: Maximum call stack size exceeded` en casi cualquier navegación limpia a la pantalla, con datos reales presentes (no relacionado con carga vacía). Causa raíz real: era la única tabla del panel que combina `responsiveLayout:'collapse'` con `pagination:'local'` a la vez — el recálculo de columnas ocultas y el pie de página se realimentan entre sí. Un primer intento con `requestAnimationFrame` no lo arregló (no era un problema de timing); quitar `responsiveLayout` sí. De paso, `tblPersonal = null` tras crear una subcontrata forzaba una reconstrucción innecesaria del Tabulator justo durante el cierre del modal, mismo síntoma — ya no hace falta, `cargarPersonal()` usa `replaceData()`.

- **Modal de alta de trabajador sin botón Guardar (2026-08-11):** `abrirModalPersonal()` (selector de tipo empleado/subcontrata) sustituía el footer del modal genérico por solo "Cancelar", y `abrirModal()` nunca lo restauraba — el formulario real que se abre después se quedaba sin botón para guardar. `abrirModal()` reconstruye ahora el footer estándar en cada apertura.

- **Editor de DNI de subcontratas siempre vacío (2026-08-11):** `mutateEditorValue` no es una opción válida de columna en Tabulator 6.3 (warning real en consola) — nunca precargaba el DNI actual al editar. El guardado funcionaba igualmente (lee el valor nuevo, no el viejo). Sustituido por un editor custom real.

- **`guardarCampoPersonal()` (panel.html, tabla Trabajadores) mandaba siempre el PUT a `/usuarios/:id`, incluso para filas de personal_externo** — editar una fila de subcontrata podía tocar a un usuario real con el mismo id numérico. Enruta ahora según `row.tipo`.

- **Cache de foto de perfil (2026-08-11):** `Cache-Control:max-age=86400` cachea por URL exacta; como la URL nunca incluía el `r2_key`, volver a subir una foto no refrescaba el avatar en pantalla hasta pasadas 24h. Añadido `&v=<r2Key>` a las 7 URLs de foto de perfil de los dos frontends.

- **`abrirFormPedido()`/`abrirModalPersonalExt()` (index.html) no autorellenaban la obra al crear un registro nuevo**, solo al editar uno existente — Adrián: "al crear un pedido, debe de autorellenarse la obra sola puesto que ya entraste con obra seleccionada". Auditados todos los selectores de obra de index.html; `pedObra`, `kitObra` y `personalExtObra` no seguían el mismo criterio que el resto (`herrObra`, `fichajeObra`, `feqObra`).

### Added

- **CATEGORIA-PROFESIONAL-01 (2026-08-11):** nueva columna `categoria` (texto libre: Oficial 1ª, Peón, Encargado…) en `usuarios` y `personal_externo` — Adrián: "categoria profesional es diferente de rol, eso si tiene que estar". Distinta del rol de acceso a la app; editable desde la tabla Trabajadores y los formularios de alta. Las tarjetas imprimibles muestran ahora categoría en vez de rol (el rol de acceso a la app no tiene sentido en una tarjeta física).

- **EMPRESA-SUBCONTRATA-01 (2026-08-11):** nueva columna `empresa` en `personal_externo` — Adrián: "cuando sea una subcontrata también tiene que salir en la tarjeta", refiriéndose al nombre de la subcontrata (no Levitec), que solo se podía apuntar antes en el campo libre "notas". La tarjeta de un trabajador externo muestra ahora su propia empresa.

- **TRABAJADORES-TIPO-01 (2026-08-11):** Adrián — "una cosa son los usuarios de la app, que son empleados de la empresa (Levitec) y luego los trabajadores de la obra que son subcontratas... que son los que queremos fichar. ¿Cómo lo organizamos?". La pantalla "Trabajadores" de panel.html separa ahora el alta en dos caminos (empleado con cuenta vs subcontrata con DNI, sin cuenta), con foto+tarjeta para los dos tipos. Dos bugs de backend reales corregidos de paso: `crearPersonalExterno()` no aceptaba `departamento` (se perdía siempre); `getTrabajadores()` no traía `codigo`/`obra_nombre` para personal_externo.

- **RECORTE-FOTO-01 (2026-08-11):** recortador circular con zoom (sin dependencias nuevas) antes de subir una foto de perfil, en index.html y panel.html — Adrián: "podemos añadir una opción de recortar la imagen de la foto del perfil cuando la añadimos".

- **PEDIDO-OBRA-01 (2026-08-11):** tarjeta "Dotación EPIs" movida debajo de "Pedidos" en el menú de cada departamento — Adrián: "no se va a usar mucho".

- **TABULATOR-RACE-01 (2026-08-11):** `RangeError: Maximum call stack size exceeded` en Tabulator, reproducido una vez en producción real al navegar por primera vez a Pedidos. Un listener de `visibilitychange` podía relanzar `cargarDashboard()` mientras la carga inicial seguía en curso, saturando el hilo principal justo cuando se creaba `tblPedidos` con `layout:'fitColumns'`. Guard de reentrancia en `cargarDashboard()`. No relacionado con ningún otro cambio de esta sesión.

- **Auditoría del módulo de Pedidos de material (2026-08-11):** `getPedidos` no dejaba a Almacén/Seguridad ver pedidos de otros departamentos pese a ser su función documentada (`isAdminRole` sin `departamento==='almacen'`/`isDeptPrivileged`, a diferencia del resto de inventario); vocabulario de `estado` distinto entre `panel.html` (`pendiente/aprobado/entregado`) y `worker.js`/`index.html` (`pendiente/solicitado/recibido`) — un pedido gestionado desde un lado quedaba huérfano en el otro; `solicitado_por` siempre `NULL` para pedidos creados desde la app móvil (sin fallback al usuario autenticado, a diferencia de `ordenes_cambio`); informe semanal por email subestimaba pedidos pendientes (solo contaba `'pendiente'`, no `'solicitado'`). Detalle en `HANDOFF.md`.

- **Sidebar de panel.html con dos secciones "🔺 Seguridad" duplicadas (2026-08-11):** `construirDirectorioDepartamentos()` (vista "Todos los departamentos") trataba Seguridad como sección plana genérica a reemplazar, cuando ya tiene su propia sección real (Carnets/Reconocimientos/Permisos/ATS/Accidentes/Registro). El stock de material se inserta ahora dentro de esa sección real en vez de crear un bloque duplicado.

- **jsQR-01 (2026-08-11):** la URL de cdnjs de `jsQR` (`jsQR/1.4.0/jsQR.min.js`) devolvía 404 — la librería ya no está en cdnjs. Rompía en silencio (sin error visible al usuario) el escaneo de QR de bobinas, EPIs y herramientas en `index.html`. Corregida a jsdelivr (`cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js`), verificado que carga y decodifica.

- **Auditoría del módulo Personal en panel.html + 23 modales sin estilo (2026-08-10):** alta de trabajadores/usuarios completamente rota (`crearUsuario()` exige `codigo`, los modales mandaban `email`/`password` y nunca lo mandaban — fallaba SIEMPRE); `getTrabajadores()` sin `obra_nombre`/`email` en el SELECT; Hojas de Tiempo llamando a un endpoint (`/personal`) que no existe en el router; y un bug de estilo más amplio de lo esperado — las clases `modal-box`/`modal-head`/`modal-foot`/`modal-content` no tenían CSS definido en ningún sitio (las reales son `modal`/`modal-header`/`modal-footer`), afectando a 14 modales incluido Formación de Obra. Commit `31fcc91`, desplegado (Worker + Pages).
  - **Tarea derivada (mismo día):** otros 9 modales (Reconocimiento, Documentación de obra, Permiso de Trabajo, Inspecciones, Subir Foto, Transmittal, Entrega, Puntos de Acción, Riesgos) tenían un bug de estructura distinto — div exterior con `class="modal"` en vez de `class="modal-overlay"`, sin fondo oscuro ni centrado al abrirse. Corregido (+ 5 llamadas rotas a `cerrarModal('id')` que no cerraban nada), verificado en el DOM real antes de publicar. Commit `4cc6463`, desplegado (Pages).
  - Detalle completo de ambos lotes en `HANDOFF.md`.

- **Contaminación de contexto de fotos en el chat (2026-08-10):** `construirMessages()` (`alejandra-agente/worker.js`) reconstruía como imagen real cualquier adjunto dentro de los últimos 10 mensajes del historial, sin límite de antigüedad — con conversaciones espaciadas, una foto de hace días seguía "viva" y el modelo respondía sobre ella en turnos sin relación (reportado por el Director: dos respuestas sobre un esquema eléctrico del 06/08 al pedir un cambio de rol el 10/08, con `analizar_foto_obra` invocada de más). Fix: solo se reconstruye la imagen si el mensaje es de la sesión activa (<2h); fuera de ese margen se trata como texto y se retira la referencia a la key de R2. Verificado en producción desde Chrome real.

- **Auditoría de 18 bugs de esquema en `.catch()` silenciosos (2026-08-10):** al investigar el error que destapó el bug anterior, dos agentes Explore en paralelo (uno por Worker) auditaron el mismo patrón — consultas SQL envueltas en un `catch` que devuelve "sin resultados" en vez de propagar el error, sobre columnas/tablas nunca verificadas contra D1 real. Cada hallazgo se verificó contra el esquema real antes de tocar código.
  - `worker.js`: `getObrasOverview`/`getObraDetail` (presupuesto por obra siempre en 0€: `coste_previsto/coste_real` no existen, son `importe_previsto/importe_real`); `getDashboardGlobal` (hitos retrasados siempre en 0: `hitos_obra.retrasado` no existe; valor de órdenes de cambio siempre en 0€: `ordenes_cambio.importe` no existe, es `coste_adicional`); alerta diaria de subcontratas (seguros/CAE por vencer) que nunca se había disparado (`seguro_rc_expiry`/`habilitacion_expiry` no existen, son `seguro_rc_expira`/`cae_expira`); `PendingUsersWatcher` y `diagnosticar_usuario` (`usuarios.aprobado` no existe — el único flujo real de aprobación es el alta por Google, `google_pending`).
  - `alejandra-agente/worker.js`: bloque de "inteligencia de negocio" del cron (obras activas y gastos de la semana — dos bugs más de la misma familia que BOBINAS-STOCK-01/FICHAJES-PROACTIVO-01/EQUIPOS-REVISION-01 del 01/08); monitorización de errores del sistema (`alejandra_logs.tipo` no existe, es `status`); detección de anomalías (tabla `personal` no existe, `fichajes.tipo/hora` no existen; tabla `facturas` no existe en absoluto, se retira esa comprobación); tendencias semanales (mismo bug de `gastos`→`gastos_dietas`); predicción de agotamiento de stock (redefinida con datos reales, igual criterio que BOBINAS-STOCK-01); **el bug real detrás del "undefined%" que el Director ya había visto en el chat** (un consumidor del briefing quedó desactualizado tras el fix del 01/08); `exportar_datos` (4 de 5 tipos daban error real al usarse); `generar_informe` (las 5 secciones del informe salían vacías desde siempre).
  - Verificación: `node --check` limpio en ambos workers; `npm --prefix alejandra-agente test` 183/183. Desplegado y verificado (`/health` en verde) en `alejandra-app-api` y `alejandra-agente`. Detalle completo, commits y versiones en `HANDOFF.md`.

### Added

- **Seguridad del cerebro — aislamiento de conversaciones y trazas (2026-08-11):** `recuperar_conversacion` queda limitado al usuario autenticado; `leer_estado` deja de exponer métricas globales; una decisión cuya traza no se pueda persistir se rechaza; y los avisos de incidencias a Telegram no incluyen contenido de usuarios. Sin migración ni modificación de datos existentes.

- **ARC-022 — foto de trabajador desde el móvil emparejado (2026-08-11):** nuevo subtipo `foto_perfil` en el mecanismo de escaneo remoto ya existente (`sync_dispositivos`/`sync_eventos`, sin QR/WebSocket, emparejamiento implícito por sesión). `worker.js` (`_procesarScanResultado`) enruta la foto a `usuarios`/`personal_externo` según `destino_tipo`/`destino_id`. `panel.html`: botón 📱 junto al avatar (`rsPedirFotoTrabajador`), refresca la tabla solo al recibir el resultado. `index.html`: reenvía `destino_tipo`/`destino_id` en la respuesta sin decidir nada. Reutiliza toda la infraestructura existente, sin tabla ni endpoint de emparejamiento nuevo.

- **ARC-022 — control de accesos con quiosco de autofichaje (2026-08-11):** subida de foto de perfil conectada para `usuarios` (el backend `/foto-perfil/:tipo/:id` ya lo soportaba, solo faltaba la UI) en `index.html`/`panel.html`. Tarjeta imprimible con QR (foto+nombre, tamaño CR80) vía `qrcodejs` (nueva librería vendorizada) para `usuarios` y para `personal_externo`. **Migración D1** (`ALTER TABLE personal_externo ADD COLUMN codigo`, autorizada explícitamente por el Director) para que el personal externo también tenga tarjeta. `POST /fichajes/scan` (`ficharPorCodigo`, `worker.js`) generalizado: resuelve el código contra `usuarios` O `personal_externo`, ficha con las mismas reglas que el alta manual, y devuelve foto/rol/DNI/empresa/avisos de reconocimiento médico o carnet caducado. **`kiosco.html`, archivo nuevo**: pantalla de autofichaje a pantalla completa para dejar en un monitor de entrada con lector USB/Bluetooth (ambos funcionan como teclado). `index.html` recibió también un campo de lector físico dentro del modal de cámara. `panel.html` sin tocar en esta vuelta (no tiene pantalla de personal externo). De paso, `jsQR-01`: la URL de `jsQR` en cdnjs devolvía 404 desde hacía tiempo — corregida a jsdelivr. Detalle en `HANDOFF.md`.

- **BUZON-TELEGRAM-01 — aviso en tiempo real + buzón de incidencias (2026-08-10):** `memory_save` (`alejandra-agente/worker.js`) manda ahora un Telegram inmediato a Adrián (canal fijo ya usado para otros avisos internos) cuando `tipo='error'` e `importancia>=4` — un problema real que bloquea a un usuario ahora mismo — además de guardarlo como siempre en `alejandra_memoria` (el "buzón" que ya se puede repasar más tarde con `memory_read`/preguntándole a Alejandra). Nueva "REGLA DE INCIDENCIAS" en el prompt del módulo `app` para que sepa cuándo usarlo. Sin tabla ni tool nueva — reutiliza infraestructura existente. Alcance: solo `alejandra-agente` (donde habla con usuarios reales), no `worker.js`. Detalle en `HANDOFF.md`.

- **Cierre del aislamiento por departamento en Alejandra Office (2026-08-10):** tercera y última ronda de auditoría (a petición del Director: "revisa que no queden más módulos sin aislar") encontró dos fugas más, ambas restringidas a Seguridad+admins (`isDeptPrivileged`) por no tener columna `departamento` ni FK útil para un filtro por fila:
  - `getReconocimientos`/`crearReconocimiento`/`actualizarReconocimiento`/`eliminarReconocimiento` (`reconocimientos_medicos`): solo bloqueaba `rol==='oficina'`; datos de salud (LPRL art. 22) visibles para cualquier encargado/oficina de la empresa.
  - `getAccidentes`/`crearAccidente`/`actualizarAccidente`/`eliminarAccidente` (`accidentes_incidentes`): sin ningún control de departamento; registro legal de seguridad visible para toda la empresa.
  - Commit `df34fa9`, desplegado (`wrangler deploy`, `/health` → 200). Con esto se cierra el plan de aislamiento por departamento abierto el 2026-08-09.

- **Plan de aislamiento por departamento — 19 tablas de obra (2026-08-10):** tras el reporte inicial de fugas en desplegables, auditoría completa de `worker.js` cruzando cada `get`/`list` contra `isDeptPrivileged()` y el sidebar curado por departamento de `panel.html`. `ordenes_cambio/compra`, `fases_obra`, `hitos_obra`, `plan_semanal`, `instrucciones_obra`, `visitas_obra`, `itp_obra`, `contactos/contratos_obra`, `submittals`, `transmittals_obra`, `ncrs_obra`, `riesgos_obra`, `entregas/consumos/solicitudes_material`, `checklists_plantillas`, `checklist_ejecuciones`: 6 migraciones D1 (`migrate_dept_ingenieria/documental/cambios_calidad/compras_material/checklists.sql` + `migrate_dept_faltantes.sql` correctiva) añaden columna `departamento`; `deptGuard` aplicado a listado/detalle/alta/edición/borrado de las 19, corrigiendo de paso varios IDOR en endpoints de detalle-por-id que no comprobaban departamento. `getObsSeguridad`/`getToolboxTalks` restringidos a Seguridad (`isDeptPrivileged`), decisión del Director sobre casos ambiguos (Diario de obra/Correspondencia quedan transversales). `getRfiDetalle` corrige un IDOR de detalle sin columna nueva. Detalle completo, commits y versiones desplegadas en `HANDOFF.md`.

- **F-4.4 — bug de clasificación de telemetría corregido (2026-08-07):** investigando qué vertical elegir para F-3.1 (herramientas semánticas), se detectó que el 100% de las trazas `feature_usage` en D1 se clasificaban como "error", incluidas ejecuciones correctas, porque la clasificación exigía un contrato JSON `"ok"` que la mayoría de tools no devuelve. Fix: `clasificarResultadoTool(resultado, err)` (función pura, `alejandra-agente/lib.js`) — excepción capturada → error; contrato JSON `"ok"` explícito → se respeta; sin contrato → éxito salvo texto que empiece por `❌`/`Error`. Desplegado y verificado. F-3.1 queda a la espera de telemetría real de uso (no solo cron) antes de decidir vertical piloto.

- **ADR-0020 rebanadas 3-7 — Motor de Decisión gobierna N0+N1 completo (2026-08-07):** cierre incremental del ADR aceptado el 2026-08-06.
  - Rebanada 3 (enmienda 2): `registrarExplicabilidad()` gana implementación real (valida motivos/evidencia con contenido); piloto N1 de solo lectura (`decidirInvocacionN1Lectura()`), inicialmente solo `verificar_deploy`.
  - Rebanada 4 (enmienda 3): contexto seguro declarado cumplido (ya satisfecho por SEC-CHAT-CONTEXTO-LEGACY + `memoria_consultar`); política determinista real vía `validarDeclaracionTool()` (ADR-0010) — una tool candidata con metadato ausente/inválido se rechaza.
  - Rebanada 5 (enmienda 4): clasificación N1 por invocación — `esInvocacionN1DeLectura()` decide por tool+`accion` para las 6 tools CRUD compuestas (`gestionar_tarea/rfi/oc/acta/calidad`, `historico_materiales`); 7 tools con al menos una invocación piloteada.
  - Rebanada 6 (enmienda 5): refuerzo N2/N3 — `decidirInvocacionN2N3()` deja traza explícita pero **siempre** decide `'posponer'`, nunca amplía permisos; `CONFIRMO BORRADO`/`CONFIRMO MIGRACION` no se tocan.
  - Rebanada 7 (enmienda 6): N1 se amplía a escritura — `decidirInvocacionN1Lectura()` generalizada a `decidirInvocacionN1()`, gobierna las 26 tools N1 completas (lectura y escritura), no solo lectura.
  - Las 7 rebanadas desplegadas y verificadas en producción. Tests finales: cognitive-core 57/57 (con policy), agente 178/178. Pendiente sin decidir: revisión humana asíncrona real para N2 (ADR propio); N3 sigue fuera del alcance autónomo (ADR-0006).

- **Departamento Control, EPIs compartido y aislamiento por departamento (2026-08-09/10, v9.05):**
  - Departamento "Control" para Sondas CPD (antes atada a Eléctrico); Racks/Cableado movido a Telecom.
  - "Dotación EPIs" compartido entre todos los departamentos, con muñeco SVG interactivo portado a panel.html.
  - Documentos (panel.html): pestañas por departamento generadas dinámicamente, ya no fijas.
  - Corregidos varios bugs preexistentes de aislamiento por departamento: Sondas CPD/Racks/EPIs sin
    filtro server-side real, Carnets/Reconocimientos/Permisos de Trabajo/ATS sin control de acceso,
    10 páginas financieras sin bloqueo de `operario` en el servidor, y `sidebarToggle()` en panel.html
    exponiendo elementos ocultos por departamento al expandir una sección. Detalle completo en HANDOFF.md.

### Added

- **ARC-020 rebanada 2 — piloto del Motor de Decisión ampliado a todo el catálogo N0 (2026-08-07, ADR-0020 enmienda 1):**
  - Análisis de las 47 trazas N0 en D1 (`alejandra_trazas`): 100% `consultar_bd`, 100% cron — el mecanismo funciona y registra decisión previa estructurada, pero solo una herramienta se había ejercitado.
  - Completado metadato ADR-0010 de 4 tools que carecían de `nivel_riesgo`: `memory_read` (N0), `memory_save` (N1), `propose_mejora` (N1), `tomar_decision` (N2). Las tres últimas se declaran `cron: 'prohibido'` y todas `acceso: 'sesion'`.
  - Cobertura de test del catálogo N0 completo (36 tools) + rechazo de N0 no ofrecida en `cognitive-core/test/contratos.test.js`.
  - Tests: cognitive-core 37/37, cognitive-core-policy 4/4, agente 168/168.

- **F-2.2 Nexo v1 — capa de integración con fuentes externas (ADR-0021, 2026-08-07):** implementado y cableado sobre las tools existentes (`buscar_normativa`, `buscar_precios`) sin crear una tool nueva. Cambios:
  - `alejandra-agente/nexo-fuentes.js`: registro de 3 fuentes piloto (REBT/ITC-BT local, precios distribuidores, web general) con metadato de fiabilidad/TTL/ambito/fallback. Helpers `obtenerFuente()`, `obtenerFuentePorConector()`, `listarFuentes()`.
  - Metadata `nexo` añadido a `buscar_normativa` (fuenteId, fallback: 'buscar_web') y `buscar_precios` en el catálogo ADR-0010.
  - `registrarNexoConsulta()`: registra traza `tipo='nexo_consulta'` (ADR-0014) + INSERT en `nexo_fuentes_telemetria`. Valida que la fuente esté registrada antes de trazar.
  - Fallback coordinado: `buscar_normativa` devuelve `sugerencia:'buscar_web'` cuando obtiene 0 resultados.
  - Migración `migrate_013_nexo_fuentes_telemetria.sql` añadida al workflow `migrate-d1-agent.yml` y al manifiesto (pendiente de aplicar — requiere autorización humana).
  - `nucleo-cognitivo/packages/cognitive-core/src/nexo.js` exporta interfaz `crearNexo()`.
  - 7 tests Nexo añadidos a `lib.test.js` (168/168 en verde).

### Nexo v1 — migración D1 aplicada (2026-08-07)
- **D2a** `migrate_013_nexo_fuentes_telemetria.sql` aplicado contra D1 de producción (`alejandra-db`) vía `wrangler d1 execute`, autorizado por el Director. Tabla `nexo_fuentes_telemetria` creada y verificada (`PRAGMA table_info`: 9 columnas: id, fuente_id, empresa_id, usuario_id, consulta, resultados, latencia_ms, cache_hit, created_at). Manifiesto actualizado (`aplicada: true`).

- **Cerebro v2 — reestructura del núcleo cognitivo en subcarpetas locales (2026-08-07):** `nucleo-cognitivo/` dividido en dos subcarpetas locales (**sin paquetes npm**):
  - `packages/cognitive-core/` — motor de decisión, memoria, tool-registry, verifier, nexo, planner, estado cognitivo y context engine. `src/index.js` re-exporta, 35 pruebas.
  - `packages/cognitive-core-policy/` — policy engine de riesgo N0–N3 (ADR-0006), 4 pruebas.
  `alejandra-agente/worker.js:54` importa `motor-decision` directamente de `packages/cognitive-core/src`; wrangler lo bundlea en despliegue. `ci.yml` actualizado con `node --check` + `node --test` de ambas subcarpetas. Commits `a9b7db1` + `b5f42b1`. No se usa npm en este proyecto.

- **Seguridad del chat — aislamiento de contexto legacy (2026-08-06):** el prompt de Alejandra deja de cargar automáticamente memoria, reglas, historial y métricas globales sin ámbito de empresa ni usuario. La memoria gobernada mantiene su acceso explícito y acotado por sesión mediante tool. No se han modificado datos ni permisos.

- **Aislamiento cross-tenant de `alejandra_memoria` (2026-08-06, SEC-CHAT-CONTEXTO-LEGACY):** `construirQueryAprendizajesEmpresa()` (`lib.js`) genera SQL con `WHERE empresa_id = ?` para inyectar aprendizajes de memoria por empresa. `obtenerContextoChat` usa el helper para reemplazar la query global. `memory_read` scopeado por `empresa_id` de sesión. Writes (`memory_save`, `propose_mejora`, `tomar_decision`, `autoLearnChat`, `ejecutarReflexion`) bindean `empresa_id`. `incluirAprendizajes` unificado a `experto !== 'simple'`. 7 tests cross-tenant añadidos (146/146). PR #99, commit `00972f1`.

- **Migración D1 `migrate_009_memoria_empresa_id.sql` (2026-08-06):** `ALTER TABLE alejandra_memoria ADD COLUMN empresa_id TEXT` + backfill de 169 filas: 24 real-users (`→ usuarios.empresa_id`, 0 mismatches), 145 sentinelas/huérfanos (`→ 'system'`), 0 anon. Aplicada contra D1 productiva (wrangler `--remote`). Verificación: 0 `empresa_id IS NULL`, 0 cross-tenant mismatches.

- **Limpieza fcm_token (2026-08-06):** DELETE `alejandra_memoria WHERE id=91` (token Firebase `fri7sTTOSfu21hjxXCg7nS:APA91b...` almacenado en la tabla equivocada). Ya aislado en tenant `'system'` por el backfill; DELETE eliminó el credencial. **Pendiente: rotar token en Firebase Console.**

- **Fix `autoLearnUpload` — bind `empresa_id` (2026-08-06):** el upload de documentos creaba filas en `alejandra_memoria` con `empresa_id=null` (invisible en contexto scoped). Ahora bindea `empresa_id` desde la sesión (`sesionFcm.empresa_id`). Committed `25c879d`, deployed `6ed738a8`.

- **Cerebro de Alejandra — piloto N0 del Motor de Decisión (2026-08-06):** las tools N0 ofrecidas pasan por una decisión estructurada y una traza previa; cualquier tool no ofrecida se rechaza. Las rutas N1-N3 mantienen sus barreras actuales.
  - Integrado mediante PR #98 y desplegado con éxito en `alejandra-agente` ([run 31089065117](https://github.com/padilla585projects/Alejandra-APP/actions/runs/31089065117), commit `5352dc5`). La verificación manual posterior de `/health` confirmó `healthy`, D1/R2 disponibles y versión `6e908ded-5578-405b-9044-37efc06b57ad`.
- **Sondas CPD (2026-08-05, rama `feat/sondas-cpd`):** nuevo módulo del departamento eléctrico para documentar sondas de temperatura/humedad/presión diferencial sobre el plano de una sala de CPD (sala dividida en 3 zonas, cada una con su pasillo caliente — p.ej. 304.1/304.2/304.3). Editor con drag&drop por pulsación larga + `pointermove` (misma lógica para dedo en `index.html` y ratón en `panel.html`, sin duplicar código táctil/ratón), renombrado, número de serie, zona, registro manual de lecturas y gráfica de tendencia en `<canvas>`. Informe imprimible/PDF desde Alejandra Office (`cpdOfficeGenerarInforme`, mismo patrón `window.open` + `window.print()` que el informe de Racks/Cableado de Telecom). Backend nuevo en `worker.js` (`/cpd/planos`, `/cpd/sondas`, `/cpd/sondas/:id/lecturas`), tablas `cpd_planos`/`cpd_sondas`/`cpd_lecturas` autoprovisionadas en runtime (`_ensureCpdTables`, mismo patrón que `_ensurePlanosTable`); `migrate_cpd_sondas.sql` queda como referencia versionada sin ejecutar. Distinto del módulo "Planos" existente (ese es generativo por IA y de solo lectura — ver F-3.2 del roadmap).
  - **Plantillas de plano:** en vez de subir siempre una foto propia, el modal "Nuevo plano" ofrece dos plantillas seleccionables ("Modelo Liquid Cooling 1/2", `img/cpd-plantillas/*.svg`) construidas como esquema SVG dibujado (no foto): sustituyen a las fotos reales originales, que quedaban giradas y perdían nitidez como fondo del editor. Diseño iterado en vivo con el Director: sala dividida en 3 zonas exactas (1/3 cada una), zona "Liquid Cooling" y "Pasillo Técnico" pegadas a las 4 paredes ocupando todo el alto, hall de acceso con puerta a cada zona, 27 airblocks colgados del techo en línea junto a la pared de las zonas, pasillo caliente dimensionado al ancho de 3 airblocks apilados. `worker.js`: `image/svg+xml` añadido a los mimes permitidos en `crearCpdPlano`.
  - **Elementos de plano genéricos + barra de herramientas (mismo día):** el flujo de colocar una sonda cambia de "tocar el plano → `prompt()` nativo pide el nombre" a una barra de herramientas con un icono por tipo (🌡️ Temp/Hum, 📉 Presión Dif. — catálogo `CPD_TIPOS_ELEMENTO`/`CPD_OFFICE_TIPOS_ELEMENTO`): se arma un tipo, se toca/clica el plano y se coloca sin diálogo, con nombre autogenerado por el backend (`Temp/Hum 3`, numerado). Abrir la ficha pasa de un tap/clic a **doble** tap/clic, para no chocar con el modo de colocar. Modelo de datos generalizado desde ya para poder añadir cámaras/control de acceso sobre el mismo editor sin rehacerlo: tabla `cpd_sondas` → `plano_elementos` (columnas `categoria`+`tipo`+`modelo`+`notas`; el icono se deriva del catálogo JS, no se guarda en BD). La ficha añade modelo/notas y solo muestra lecturas+gráfica si la categoría es `sonda_ambiental`. Nuevo selector "Ver: nombre / nº serie / ambos / nada" para elegir qué se muestra bajo cada icono, persistido en `localStorage` (compartido entre `index.html` y `panel.html` por ser mismo origen).
  - Sin pruebas automatizadas todavía (módulo nuevo de solo UI + CRUD, sin tools de Alejandra involucradas). Verificado manualmente en producción en ambos frontales (Chrome real, `index.html` táctil y `panel.html` con ratón): crear plano con plantilla, armar herramienta, colocar elemento, doble tap/clic abre ficha, editar modelo/nº serie, selector de etiqueta. Pendiente: fusionar a `main`.

- **ARC-011 fase 3, tercer lote agrupado declarado (2026-08-03, PR #70):** las últimas 23 tablas "solo de código" del inventario original de ARC-011 quedaron declaradas (paso 1) en 6 verticales por dominio — `planificacion_produccion`, `finanzas_obra`, `seguridad_cumplimiento`, `relaciones_obra`, `flota`, `nexus_experts` (aparte, dominio distinto). Verbatim contra `worker.js`; verificado contra D1 real que ninguna de las 23 existe todavía en producción. `migrate_manifiesto.json` actualizado (`aplicada: false`). Paso 2 pendiente de autorización del Director. En la misma sesión: ARC-014 revisado sin cambios; F-0.2-CFG — se declinó mover secretos directamente al pedirlo el Director, por ser acción prohibida para cualquier agente.
- **ARC-008 §8 resuelto y F-2.1 paso 3 iniciado (2026-08-02):** `consultarMemoria()` real en los dos Workers (`worker.js`, `alejandra-agente/worker.js`), lee `memoria_gobernada` (empresa, categoría, ámbito, confianza, no caducado, solo `estado='confirmada'`) y registra una traza `memoria_consulta` con los recuerdos devueltos — cierra la trazabilidad completa que ARC-008 §8 exigía antes de activar memoria. `listarCandidatasPendientes()`, `confirmarCandidata()` (traza `memoria_confirmacion`) y `rechazarCandidata()` completan el CRUD sobre `memoria_gobernada` en ambos Workers, sin exponerse aún vía ninguna ruta/tool. `nucleo-cognitivo/src/memory.js` pasa de lanzar error a aceptar las cuatro funciones como dependencia inyectada (`inyectarMemoria()`, mismo patrón que `registrarTraza()` en `motor-decision.js`); sin inyección devuelve `[]`/no-op en vez de lanzar. Ninguno de los dos Workers importa `nucleo-cognitivo/` todavía (sigue prohibido). 5 pruebas nuevas/reescritas en `memory.test.js` (36/36 en verde en `nucleo-cognitivo`); 121/121 en verde en `alejandra-agente`.
- **`memoria_consultar` — decisión del Director (2026-08-02, "Opción A"):** primera tool de lectura sobre `memoria_gobernada`, solo en `alejandra-agente/worker.js` (`nivel_riesgo:'N0'`, `acceso:'sesion'`, `empresa_id` desde la sesión, `categoria` validada contra la lista blanca de ADR-0013 §1, sin escritura/inferencia/candidatas). Tools legadas `memory_save`/`memory_read` intactas; coexistencia de ambos sistemas documentada en `HANDOFF.md` con criterio de migración futura. SQL/binds extraídos a `construirConsultaMemoriaGobernada()` (`alejandra-agente/lib.js`), función pura con 15 pruebas nuevas (aislamiento por tenant, caducidad, confianza, ausencia de resultados cruzados). 136/136 en verde en `alejandra-agente`.
- **Segunda ronda de verificación de DDL silenciado (2026-08-03), sin bugs nuevos:** autorizada por el Director, verificadas contra D1 real las 15 columnas/tabla restantes del inventario de ARC-011 fase 1 (`reset_tokens` ×2, `login_attempts.email`, `auth_nonces`, `partes_trabajo` ×2, `fotos_obra` ×2, `escaneos_remotos.num_albaran`, y los 4 `departamento` restantes). A diferencia de ARC-012 (3/3 bugs), esta ronda no encontró ninguno. Corregido de paso el estado desactualizado de ARC-013 en `ARCHITECT_BACKLOG.md`.
- **ARC-011 fase 3, tercer vertical completo (`calidad`, 2026-08-03):** `migrate_calidad.sql` declara `control_calidad` (NEW-37) y `punch_list` (NEW-44). Ciclo de 5 pasos cerrado el mismo día: aplicada contra D1 (run 30790988608, no-op confirmado), DDL en runtime retirado, verificado en producción tras desplegar `worker.js` (run 30791398680, `/health` healthy). Tercer vertical con el ciclo completo, tras `checklists` y `rfis`.
- **ARC-011 fase 3, cuarto y quinto vertical completos, primer lote agrupado (`tareas_obra` + `actas_reunion`, 2026-08-03):** ante el coste operativo de un despliegue por vertical, se aplicaron ambas migraciones por separado (autorización propia cada una) pero se verificaron en un único despliegue de `worker.js` (run 30799296203, `/health` healthy, 16 columnas de `tareas_obra` y 23 de `actas_reunion` presentes). Mismo ciclo de 5 pasos, misma barrera de autorización por migración D1 — solo se agrupó el paso 4.
- **ARC-011 fase 3, sexto/séptimo/octavo vertical completos, segundo lote agrupado (`ordenes_cambio` + `ordenes_compra`+`oc_lineas` + `proveedores_gestion`, 2026-08-03):** mismo patrón, tres migraciones aplicadas por separado, DDL retirado de las tres, verificadas en un único despliegue (run 30806109041, `/health` healthy, 17+15+8+23 columnas presentes). **Ocho verticales de ARC-011 fase 3 completos en total.** El Director señaló que se estaban encadenando demasiados despliegues (5 en <14h); los próximos lotes se espacian más y agrupan más verticales.

- Healthcheck automático post-despliegue en `deploy-worker.yml` y `deploy-alejandra-agente.yml`: consultan `GET /health` tras desplegar (con reintentos), bloquean el job si el estado es `unhealthy` o no responde, y dejan una advertencia visible si es `degraded`, sin bloquear. Cierra el último pendiente menor de ADR-0014.
- `nucleo-cognitivo/src/tool-registry.js` (F-1.3, ADR-0010): validación pura del metadato `acceso`/`cron`/`nivel_riesgo` que exige toda tool declarada, `registrarTool()` (acumula sin mutar, rechaza duplicados) y el equivalente puro de `filtrarToolsPorAuth()`/`filtrarToolsCron()`. `nucleo-cognitivo/src/verifier.js` (ADR-0009): nivel determinista real; revisión humana asíncrona y explicabilidad como interfaces con error explícito; `nivelesRequeridosPara()`. 13 pruebas nuevas.
- `alejandra-agente/lib.js`: `toolsParaAnthropic()`, whitelist puro que deja pasar solo `name`/`description`/`input_schema`/`cache_control` al construir `body.tools` para la API de Anthropic — necesario antes de poder migrar ninguna tool al metadato de ADR-0010 sin filtrarlo por accidente al proveedor. `TOOL_CONSULTAR_PERSONAL` migrada como piloto (`acceso:'sesion'`, `cron:'permitido'`, `nivel_riesgo:'N0'`), sin cambiar comportamiento observable. 4 pruebas nuevas en el agente (114/114 en verde).
- Lote 2 de la migración ADR-0010 (2026-08-02): 8 tools de solo lectura más (`buscar_documentos`, `buscar_tareas`, `consultar_inventario`, `buscar_precios`, `buscar_procedimientos`, `consultar_punch_list`, `buscar_proveedores`, `consultar_precios`) con `acceso:'sesion'`, `cron:'permitido'`, `nivel_riesgo:'N0'`. 9/103 tools migradas. 1 prueba nueva que verifica el lote completo (115/115 en verde).
- Lote 3 de la migración ADR-0010 (2026-08-02): 7 tools públicas (`buscar_web`, `calcular_cable`, `calcular_bandeja`, `calcular_proteccion`, `pensar`, `planificar`, `buscar_normativa`) con `acceso:'publico'`, `cron:'permitido'`, `nivel_riesgo:'N0'`. 16/103 tools migradas. 1 prueba nueva (116/116 en verde).
- Lote 4 de la migración ADR-0010 (2026-08-02): `gestionar_tarea`, `gestionar_rfi`, `gestionar_oc`, `gestionar_acta`, `gestionar_calidad` y `editar_plano` con `nivel_riesgo:'N1'` (CRUD acotado por `empresa_id`, revisado el código de cada `case` antes de clasificar). `marcar_plano` con `nivel_riesgo:'N0'` — pese al nombre, es solo lectura/análisis, sin escritura en D1. 23/103 tools migradas. 1 prueba nueva (117/117 en verde).
- Lote 5 de la migración ADR-0010 (2026-08-02): 12 tools de solo lectura (`descubrir_herramientas`, `recuperar_conversacion`, `leer_estado`, `consultar_bd`, `listar_archivos`, `ver_archivo`, `consultar_conocimiento`, `ram_read`, `github_listar`, `github_leer`, `github_buscar`, `grep_codigo`) con `nivel_riesgo:'N0'`, verificando que ninguna ejecuta escritura (las 4 de GitHub comparten `case` con `github_escribir`/`patch_codigo`, que sí escriben). 35/103 tools migradas. 1 prueba nueva (118/118 en verde).
- Lote 6 de la migración ADR-0010 (2026-08-02): las 10 tools administrativas más sensibles hasta ahora, revisadas línea a línea. `ejecutar_deploy` con `nivel_riesgo:'N3'` (despliegue directo a Cloudflare, el ejemplo textual de N3 en ADR-0006). `github_escribir`, `patch_codigo`, `rollback` (fuerza el ref de `main`), `test_endpoint` (puede invocar cualquier endpoint propio con cualquier método/body), `nexus_manage` (cambia enrutamiento en vivo) y `escribir_bd` (ya exige "CONFIRMO BORRADO" del humano para DELETE/UPDATE masivo) con `nivel_riesgo:'N2'`. `verificar_deploy` y `configurar_alerta` con `nivel_riesgo:'N1'`. `validar_cambios_bd` con `nivel_riesgo:'N0'` (solo `SELECT`). 45/103 tools migradas. 1 prueba nueva (119/119 en verde).
- Lote 7 de la migración ADR-0010 (2026-08-02): notificaciones y generación de contenido. `enviar_email` y `enviar_telegram_informe` con `nivel_riesgo:'N2'` — salen literalmente de la organización, el ejemplo textual de ADR-0006. `enviar_push`, `iniciar_conversacion`, `controlar_app`, `generar_informe`, `subir_archivo`, `ram_save`, `ram_clear` con `nivel_riesgo:'N1'` — se quedan dentro del ecosistema propio de la app (FCM/comandos acotados por `puedeNotificarUsuario`) o son escritura de un solo archivo/fila. 54/103 tools migradas. 1 prueba nueva (120/120 en verde).
- Lote 8 de la migración ADR-0010 (2026-08-02) — **completa el catálogo de `alejandra-agente/worker.js` (69/69 tools)**: `analizar_foto_obra`/`listar_esquemas`/`estado_obra` con `nivel_riesgo:'N0'`; `generar_esquema_electrico`, `borrar_esquema`, `generar_plano`, `generar_grafico`, `preguntar_usuario`, `generar_documento`, `historico_materiales` con `nivel_riesgo:'N1'`; `exportar_datos` con `nivel_riesgo:'N2'` (exporta sin `LIMIT`, incluye PII de personal). 65/103 tools totales migradas. 2 pruebas nuevas (121/121 en verde).
- Migración ADR-0010 del catálogo de `worker.js` raíz (2026-08-02) — **completa la tarea F-1.3-MIGRAR-RESTO-TOOLS: 96/103 tools totales**. 31/34 tools de `worker.js` migradas (`memory_save`/`memory_read`/`memory_delete` excluidas, dominio ADR-0013); todas `acceso:'dev_verificado'` (único canal real hoy). `run_migration` con `nivel_riesgo:'N3'` (mandato explícito de ADR-0006/0010). `sql_query`, `direct_fix`, `manage_user`, `repo_write_file` con `nivel_riesgo:'N2'`. `self_audit`, `propose_fix` con N0/N1. Trabajo repartido en dos agentes paralelos (worktrees aislados) para las tools de menor riesgo.
- `ADR-0004` aceptado (2026-08-02): arquitectura objetivo del Motor de Decisión. Cierra F-1.1 y abre F-1.2.
- `ADR-0013` aceptado con modificaciones (2026-08-02): gobierno de memoria (ARC-002). Lista blanca de categorías (hechos declarados, preferencias, procedimientos, correcciones); inferencias automáticas solo como candidata pendiente de validación humana; caducidad 6 meses por defecto, 12 para procedimientos empresariales aprobados; memoria personal libre, memoria compartida exige aprobación `encargado`+; derecho de supresión con eliminación real, sin versión archivada, sin verificación extra desde sesión propia autenticada, reforzada si es sensible/amplia/fuera de sesión; D1 vía el migrador de ADR-0011.
- `ADR-0014` aceptado con modificaciones (2026-08-02): observabilidad y trazas (ARC-008). Tabla D1 `alejandra_trazas` compartida por los dos Workers; retención 30 días para trazas de decisión y 90 para errores de DDL/eventos de seguridad, con minimización/redacción obligatoria; un único endpoint `GET /admin/trazas` en `alejandra-app-api`; `/health` con tres estados (`healthy`/`degraded`/`unhealthy`) comprobando D1 y un objeto centinela en R2, versión derivada del SHA de despliegue; migración autorizada solo en el entorno actual de desarrollo/pruebas.
- `nucleo-cognitivo/src/memory.js`: interfaz de Memory (ADR-0013 §8) — `consultarMemoria`, `listarCandidatasPendientes`, `confirmarCandidata`, `rechazarCandidata` (lanzan error explícito, sin persistencia), más las constantes puras de categorías/métodos/estados y `caducidadPorDefecto()`. Contrato `registrarTraza()` fijado en `motor-decision.js` (ADR-0014 §5), como dependencia inyectada sin romper el aislamiento actual. 20 pruebas nuevas.
- `migrate_trazas.sql`: declara y **aplica** (run `30746110357`) la tabla `alejandra_trazas` con el esquema exacto de ADR-0014 §1. Export previo de `alejandra-db` (8,1 MB) y validación posterior contra el esquema real.
- ADR-0014 implementado y desplegado en los dos Workers: `registrarTraza()` real conectado a ARC-013 (`runDDL()`/`ddlPaso()` ahora también persisten `tipo='ddl_error'`, con minimización/redacción de email y teléfono); `/health` rediseñado con tres estados (`healthy`/`degraded`/`unhealthy`), comprobando D1 y un objeto centinela nuevo en R2 (`_healthcheck/centinela.txt`); `GET /admin/trazas` en `alejandra-app-api`. Versión derivada del binding nativo `version_metadata` de Cloudflare. 16 pruebas nuevas en `alejandra-agente` (110/110 en verde).
- `nucleo-cognitivo/`: esqueleto y contratos del núcleo cognitivo (Estado Cognitivo, Policy Engine, interfaces de Context Engine/Planner/Motor de Decisión), paquete aislado sin integrar en producción, sin memoria persistente ni decisiones sin trazabilidad.
- CI independiente, workflows manuales de Pages/Workers y migración D1 controlada del agente.
- Runbook de CI/CD y migraciones, con procedimiento de verificación manual post-despliegue.
- Registro operativo de F-0.1 en `TASKS.md`, incluida la migración 008 sin ejecutar.
- ARC-011: riesgo crítico de esquema D1 definido por DDL en tiempo de ejecución, con el inventario de `CREATE TABLE`/`ALTER TABLE` desde código registrado como trabajo futuro obligatorio.
- Precheck de sincronía de versiones antes de publicar Pages, y healthcheck que verifica la versión servida.
- `ENGINEERING_WORKFLOW.md` como procedimiento operativo común e independiente del modelo de IA.
- Regla de autonomía de los agentes: los prompts asignan objetivos y el contexto se obtiene de la documentación versionada.
- Inventario del esquema real de D1 (`docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`), con las dos fases de ARC-011: análisis estático de los dos workers y contraste con producción.
- `runDDL()` en ambos workers: ejecuta DDL en caliente sin lanzar, pero registrando todo error que no sea el duplicado esperado. `ddlPaso()` para `runMigrations()`, que distingue aplicada / ya existía / ERROR.
- ARC-013 y ARC-014 en el backlog, abiertos a raíz del arreglo de ARC-012.
- F-0.2: cuatro scripts de inventario y validación en `scripts/` —rutas y su autorización, encoding, sincronía de versiones, y secretos/bindings/migraciones—, todos de solo lectura y enganchados al job de CI existente. Ninguno contacta con Cloudflare ni lee valores de secretos.
- ADR-0006, ADR-0008, ADR-0009, ADR-0010 y ADR-0011, redactados y **aceptados por el Director el mismo día** (2026-08-02): matriz de riesgo N0–N3 (ARC-001), definición de Nexo como capa de integración (ARC-003), QA en tres niveles (ARC-004), catálogo de tools con metadato de acceso (ARC-006), y migrador por vertical como estrategia (ARC-011 fase 3). Cierran ARC-001, ARC-003, ARC-004 y ARC-006 en el backlog.
- `migrate_checklists.sql`: primer vertical de la migración por fases de ARC-011 (ADR-0011), declara `checklist_plantillas`, `checklist_registros`, `checklists_plantillas` y `checklist_ejecuciones` con el esquema exacto de `worker.js`. Paso 1 (declarar) completo; aplicarla contra D1 exige autorización aparte del Director.
- `migrate_manifiesto.json`: primer manifiesto de migraciones (formato de ADR-0011), con las tres migraciones de ARC-012 ya verificadas y `migrate_checklists.sql` como pendiente de aplicar.

### Fixed

- `index.html` — 4 bugs reales de la app móvil, reportados por Adrián vía sugerencias con foto (#212, #213, #214) y ya resuelto en producción desde v8.84 (#211): **RdP/Registro de Hormigonado/Formación en Obra** llamaban a una función `apiFetch()` que nunca se había definido en `index.html` (solo existía `apiCall`/`apiCallRaw`) — los tres módulos estaban rotos de raíz desde su creación; añadido el alias `apiFetch = apiCall`. **Filtro de proveedor/tipo de cable en Bobinas:** `renderStock()` repoblaba los `<select>` de proveedor/tipo usando solo los ítems ya filtrados por el backend, dejando una única opción visible tras aplicar cualquier filtro ("los filtros desaparecen"); se quita esa repoblación redundante, el catálogo completo ya lo puebla `cargarCatalogos()`. **Adjuntar foto a una incidencia nueva:** el `onchange` del input de foto mostraba un error ("guarda la incidencia primero") aunque el guardado ya subía esas mismas fotos después — ahora muestra una vista previa local "pendiente" en vez de un error. **Sincronización manual con Google Sheets:** el botón mostraba un mensaje fijo ("el worker no tiene endpoint de sync manual") que era falso — el endpoint `/sync-sheets` existe en `worker.js`; ahora se muestra el error real devuelto por el servidor.
- `worker.js` raíz (`direct_fix`, `repo_write_file`): la `description` de la tool (visible al propio modelo, no solo en el mensaje de retorno) afirmaba que un commit se despliega automáticamente a Cloudflare (~1 min) o GitHub Pages (~30 seg). Falso desde F-0.1/ADR-0001 (2026-08-02): ningún workflow se dispara por push a `main`, el despliegue exige `workflow_dispatch` manual con confirmación y aprobación del entorno `production`. Detectado durante la revisión de código previa a clasificar `nivel_riesgo` (F-1.3). Podía hacer que Alejandra creyera (o le dijera a Adrián) que un fix ya estaba en producción cuando solo estaba commiteado.
- `alejandra-agente/worker.js` (`gestionar_calidad`, acción `resolver`): `notas_resolucion` se interpolaba directo en el SQL (solo escapando comillas simples a mano) en vez de ir por parámetro `?`, el único caso así en las cinco tools `gestionar_*`. Detectado durante la revisión de código previa a clasificar `nivel_riesgo` (F-1.3). Corregido a parámetro, sin cambio de comportamiento observable.
- `index.html`: `checkVersionAndUpdate()` desactiva su *fallback* de versión contra `/health` del agente. Ese campo pasó a ser un id de despliegue de Cloudflare tras ADR-0014 y nunca coincidiría con `APP_VERSION`, lo que habría forzado una recarga en cada uso del *fallback* — mismo patrón que los incidentes de recarga infinita del 22/04 y 26/04. Detectado y corregido en el mismo ciclo que desplegó ADR-0014, antes de afectar a un usuario real.

### Removed

- ARC-018 resuelto: `alejandra-worker` (fork huérfano de `worker.js`, CORS abierto, confirmado contra la `alejandra-db` real vía dashboard) borrado de Cloudflare. Su bucket `alejandra-files` contenía 12 fotos únicas de una incidencia real (23/04, obra 1/eléctrico) que nunca llegaron a `alejandra-app-files`; migradas y verificadas por tamaño idéntico antes de vaciar y borrar el bucket. Ambos recursos ya no existen en la cuenta.

### Changed

- ADR-0001 aceptado: un push o merge ya no activa producción desde los workflows versionados; secretos, Pages y D1 quedan desacoplados del despliegue ordinario.
- `migrate_008_plano_circuitos.sql` estuvo bloqueada unas horas por un diagnóstico incorrecto —se supuso que `worker.js` ya creaba la columna— y se **desbloqueó y aplicó** el 2026-08-02 al comprobar contra el esquema real que la columna no existía. La migración era el arreglo, no el riesgo.
- Los despliegues de Workers pierden el healthcheck automático: `GET /health` no comprueba D1/R2 ni acredita la versión desplegada, así que un 200 podía dar por bueno un despliegue roto. Se sustituye por verificación manual documentada y queda registrado en ARC-008.
- ARC-005 se matiza: la mitigación cubre las migraciones lanzadas por workflow, no el DDL que ejecuta el propio Worker.
- Auditoría remota de GitHub en solo lectura: `main` sin protección, entorno `production` inexistente, `github-pages` limitado a `main`, secretos a nivel de repositorio y workflows antiguos aún activos. El runbook sustituye los `PENDIENTE` por el estado real.
- F-0.1 activada en remoto (PR #9): workflows antiguos desactivados antes de integrar, CI verde sin disparar ningún despliegue, entorno `production` creado con revisor requerido y `main` protegida con PR obligatoria y check requerido. Queda mover los secretos a nivel de entorno.
- Consolidación documental: `MASTER_ROADMAP.md` refleja ADR-0001/0002 aceptados y COH-001/COH-002 cerrados. `TASKS.md` y `HANDOFF.md` mantienen la cola inmediata y el relevo.
- ARC-012 resuelto: `planos.circuitos_json`, `inventario_seg.ubicacion` y `empresas.retencion_config` aplicadas por el workflow manual y verificadas contra el esquema real. Cierra SEG-01 de verdad —el fix del 25/07 nunca llegó a funcionar— y restaura la retención RGPD, que estaba inoperante.
- ARC-013: se retira la supresión de errores del DDL en runtime en los dos workers (48 llamadas a `runDDL`, 10 pasos a `ddlPaso`). No cambia comportamiento observable —el helper nunca lanza— pero un `no such table` deja de ser invisible. Requiere despliegue de `worker.js` para surtir efecto.
- Puesta al día del estado tras las PR #10 y #11: `START_HERE.md`, `PROJECT_STATE.md`, `HANDOFF.md`, `TASKS.md`, `MASTER_ROADMAP.md` y `ARCHITECT_BACKLOG.md` seguían reflejando solo hasta la PR #9.
- `PUT /sesion/departamento` comprobaba que el header `X-Token` existiera, pero no que la sesión fuese real ni que no hubiera caducado, y devolvía `ok:true` aunque no actualizara ninguna fila. El `UPDATE` está acotado por token, así que no permitía tocar la sesión de otro, pero una sesión ya caducada podía seguir cambiando su departamento —cosa que el resto de endpoints impide desde SEC-08/SEC-09—. Detectado por el catálogo de rutas de F-0.2.
- Sin cambios de datos ni despliegues. Los cambios de código son de observabilidad, de corrección del prompt y de esa comprobación de sesión.
