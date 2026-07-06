## ESTADO ACTUAL

**Sesion:** LIBRE
**Ultima sesion:** 06/07/2026 -- nuevos tipos de plano `unifilar` y `planta_electrica` en
`generar_plano` (solo alejandra-agente, commit 53edc25, deploy CI 28815636221 en verde). Ver
seccion nueva "RESUMEN SESION 06/07/2026 (planos unifilar + planta_electrica)" mas abajo.
Sesion anterior a esta: generar_plano profesional con simbologia IEC + fix critico de
vaciado de SVGs en `_sanearSvgTruncado` (commits 8ad4732 / 5ac8f41, Worker agente Version ID
6f50c3ed-2ae2-4478-af72-43a68fd57b49). Ver seccion "RESUMEN SESION 06/07/2026 (planos IEC +
fix sanitizer)" mas abajo. Sesion anterior a esa: Cascada Gemini para planos + test vision +
fix agente web-search crash (v7.72, commits 101aa9c / 07657d3).
**Version actual:** App PWA **v7.72** -- commit 101aa9c (sin cambios de PWA esta sesion, solo agente)
**Agente (alejandra-agente):** commit **53edc25** desplegado en main -- ver seccion nueva mas
abajo. Antes de eso, commit 5ac8f41 (fix critico sanitizer). Antes de eso, commit 2a18d5b
desplegado en main (fix IDOR en
subir_archivo -- escribia/sobrescribia cualquier key de R2 sin registrar dueno ni
comprobar empresa -- y enviar_notificacion -- codigo huerfano con el mismo patron
IDOR que enviar_push antes de la continuacion 19/20 --, mas el default fail-open
de `authOk` en `ejecutarTool()` cambiado a fail-closed; ver seccion nueva mas abajo,
"continuacion 20" en ALEJANDRA_AGENTE.txt/commit message; aqui numerada continuacion
21 porque el numero 20 ya estaba usado en este archivo para el fix anterior, mismo
dia). Incluye tests automatizados (64 tests, vitest) que corren en el workflow de
deploy ANTES de aplicar migraciones/desplegar -- si fallan, no se despliega.
**Worker raiz + panel.html ("Alejandra Office"):** commit c81c59d -- endpoint
`/alejandra-agente-dev-bypass` y UI de toggles en DevTools (ver continuacion 16). Tambien
c47944d (otro agente) corrigio un bug preexistente de `_planosData` duplicado en
panel.html, detectado durante la QA de esta sesion.
**App Flutter (alejandra-ia):** commit 014508b -- UI de dev-bypass en Ajustes, visible
solo con rol `desarrollador` (ver continuacion 16).
**Documentacion del agente (ALEJANDRA_AGENTE.txt):** reescrita commit 60ae56e, regla #3
actualizada en 74f686e tras el fix de version, seccion de gating actualizada en e7134e3
tras el fix de configurar_alerta/exportar_datos, subseccion "INTERRUPTOR DEV-BYPASS"
anadida en continuacion 16, subseccion "IDOR EN listar_esquemas/borrar_esquema Y
gestionar_tarea" anadida en continuacion 17, subseccion "IDOR/EXFILTRACION
CROSS-EMPRESA EN 5 FAMILIAS MAS" anadida en el commit ff52aea (continuacion 19 en
ese archivo), y subseccion "IDOR EN subir_archivo/enviar_notificacion + authOk
FAIL-CLOSED" anadida en el commit 2a18d5b (continuacion 20 en ese archivo). Ver
seccion de abajo.

---

## RESUMEN SESION 06/07/2026 (planos IEC + fix sanitizer) -- generar_plano profesional + fix critico de vaciado de SVGs

### Peticion de Adrian
"pues ahi que mejorar a alejandra para que los haga bien como una ingeniera profesional /
planos que valgan en obra, que valgan de verdad" (sobre la tool `generar_plano` del chat
movil, alejandra-agente/worker.js). Plan tecnico presentado y confirmado ("si") antes de
tocar codigo: portar la libreria de simbolos IEC ya existente en el worker raiz, inyectarla
en los SVG generados para tipo electrico/bandejas, actualizar esos 2 prompts para prohibir
`<defs>`/`<symbol>` propios y exigir `<use href="#sym-X"/>`, subir max_tokens 8000->16000.
Sin tocar planta/mecanico/gantt. Solo Anthropic (sin cascada Gemini/OpenRouter, a diferencia
del worker raiz).

### Cambios (commit 8ad4732)
- `IEC_SYMBOLS_DEFS` / `IEC_BANDEJA_DEFS`: constantes portadas del worker raiz, insertadas
  antes de `_PLANO_PROMPTS`.
- `_PLANO_PROMPTS.electrico` / `.bandejas`: prohiben `<defs>`/`<symbol>` propios, exigen
  `<use href="#sym-X"/>` con la lista completa de IDs disponibles.
- `_generarPlanoAgente(...)`: migrado de `fetch` crudo (no-streaming) a
  `llamarAnthropicStream(env, [...], 'claude-sonnet-4-6', 16000, systemPrompt, () => {},
  usuario_id)` -- evitaba un 524 de Cloudflare (timeout ~100-125s en generaciones largas
  no-streaming). Inyecta los defs de simbolos en el SVG resultante via regex sobre
  `<svg ...>` para tipo electrico/bandejas. `metadatos` ahora estima tokens con
  `Math.round(svgRaw.length/4)`.
- Sanitizador de SVGs truncados reescrito de un contador ad-hoc de `<g>` a un scanner
  generico de pila de tags (`_sanearSvgTruncado`), para cerrar correctamente cualquier tag
  sin cerrar (no solo `<g>`) cuando Claude corta el SVG a medio generar (ej. plano 18: un
  `<text>` cortado a mitad de contenido causaba XML invalido).

### BUG critico introducido y corregido en la misma sesion (commit 5ac8f41)
El primer `_sanearSvgTruncado` (commit 8ad4732) tenia un fallo de diseno: la raiz `<svg>`
SIEMPRE queda "abierta" en la pila de tags tras recortar el `</svg>` final del string (es
el comportamiento esperado, no una senal de truncamiento) -- pero el codigo trataba
"queda algo en la pila" como sinonimo de "hay un elemento incompleto que descartar",
asi que borraba TODO el contenido del body en cualquier generacion completa/limpia (el
caso normal, no solo el truncado). Descubierto en produccion al hacer el test en vivo:
los planos 19 y 20 (D1) salieron con `svg_data = "\n</svg>"` (7 caracteres, vacios).

Corregido: ahora solo se descarta un tag realmente a medio abrir al final del string (un
`<` sin su `>` de cierre correspondiente); cualquier tag cuya apertura SI completo
(incluida la propia raiz `svg`) nunca se descarta, solo se cierra con su tag de cierre
correspondiente en la pila -- preservando todo el contenido valido, incluido texto
truncado a medio camino (se cierra el `<text>` en el punto de corte en vez de perder ese
fragmento entero).

### Verificacion
- Test local (script Node desechable, no commiteado): caso SVG completo/bien formado ->
  preservado integro sin cambios; caso SVG truncado a medio `<text>` (replicando la
  estructura del plano 18) -> cerrado correctamente sin perder contenido previo.
- `node --check` limpio, grep de corrupcion de encoding limpio antes de cada commit/push.
- Test en vivo via curl contra `/api/chat/stream` (prompt explicito "Usa la tool
  generar_plano (no generar_esquema_electrico)" para evitar que Sonnet eligiera la tool
  competidora `generar_esquema_electrico`): plano ID 21 generado en ~164s sin 524,
  verificado por consulta directa a D1 (`svg_data` = 48131 caracteres, empieza en `<svg
  ...>` y termina en `</svg>` limpio), balance de tags 100% correcto (script Node de
  verificacion), 21 `<use>` referenciando 15 `<symbol>` (a diferencia de un test anterior
  al fix del streaming, plano 18, donde Claude no habia adoptado `<use>` pese a la
  instruccion del prompt -- limitacion conocida, no bloqueante, el contenido seguia siendo
  correcto igualmente). Verificado tambien visualmente: SVG descargado de D1, servido con
  `python -m http.server` local y renderizado en Chrome via MCP -- sin banner de error XML,
  diagrama de cuadro electrico trifasico completo y profesional (IEC 60617, colores
  normalizados IEC 60446, tabla de leyenda/materiales).
- Planos de prueba 19, 20 y 21 (D1 produccion) borrados tras la verificacion (confirmado
  con Adrian via AskUserQuestion antes de borrar) -- eran solo pruebas mias, no datos de
  usuario real.

### Deploy
- `npx wrangler deploy` desde `alejandra-agente/` (unico worker tocado). Version ID
  6f50c3ed-2ae2-4478-af72-43a68fd57b49.
- Commits: `8ad4732` (feature -- simbolos IEC + streaming + sanitizer v1) y `5ac8f41`
  (fix critico -- sanitizer v2, corrige el vaciado). Ambos pusheados a `origin/main`.

### Pendiente / limitacion conocida (no bloqueante)
Claude no siempre adopta `<use href="#sym-X"/>` pese a la instruccion explicita del
prompt (ocurrio en el plano 18, antes de este fix; en el plano 21, ya con el fix, si lo
adopto correctamente). Si vuelve a ocurrir en el futuro, el contenido sigue siendo
visualmente correcto (Claude dibuja los simbolos "a mano" en vez de referenciar la
libreria), asi que no es un fallo funcional, solo una perdida menor de consistencia
visual/tamaño de archivo. No se ha intentado forzarlo mas alla de la instruccion actual
del prompt.

---

## RESUMEN SESION 06/07/2026 (planos unifilar + planta_electrica) -- nuevos tipos de plano en generar_plano

### Peticion de Adrian
Tras probar en vivo el tipo `electrico` (sesion anterior, plano 21): "pero la prueba que
decias tu, ese plano esta bien pero no es el que se usa en obra normalmente. tenemos que
mejorar". Se le pregunto que tipo de documento se usa realmente en obra; respuesta:
"se utiliza es esquema unifilar par conectar cuadros(1) y para planta el 2" -- es decir:
(1) para interconectar cuadros se usa un ESQUEMA UNIFILAR (no el detalle interno de un
cuadro, que es lo que ya hacia `electrico`), y (2) para planta se necesita el plano con
canalizaciones/tomas/luminarias/interruptores (no un plano arquitectonico generico como el
`planta` existente). Plan tecnico completo presentado y confirmado ("Si, adelante") antes
de tocar codigo: dos tipos nuevos, `unifilar` y `planta_electrica`, deliberadamente
distintos de `electrico`/`planta`/`bandejas` para no romper sus usos existentes.

### Cambios (commit 53edc25)
- Nueva libreria de simbolos `IEC_INSTALACION_DEFS` (antes de `_PLANO_PROMPTS`): punto de
  luz de techo, aplique de pared, toma de corriente/Schuko, interruptor simple,
  interruptor conmutado/cruce, caja de derivacion, CGMP (cuadro en vista de planta) --
  todos con `currentColor`, convencion REBT ITC-BT-19/25.
- `_PLANO_PROMPTS.unifilar`: esquema de interconexion Acometida -> CGP -> Cuadro General
  de Distribucion -> sub-cuadros, topologia siempre vertical/horizontal ortogonal, cada
  tramo etiquetado con proteccion de cabecera (magnetotermico+diferencial), tipo/seccion
  de cable y longitud. Reutiliza simbolos ya existentes (`#sym-cgp`/`#sym-cs`/`#sym-scss`
  de `IEC_BANDEJA_DEFS`, `#sym-magnetotermico`/`#sym-diferencial`/`#sym-tierra` de
  `IEC_SYMBOLS_DEFS`) -- no necesitaba simbolos nuevos.
- `_PLANO_PROMPTS.planta_electrica`: plano de planta (mismo estilo de muros que `planta`)
  con canalizaciones ortogonales punteadas, cuadro (`#sym-cgmp`), cajas de derivacion,
  puntos de luz/apliques, tomas de corriente, interruptores -- con conexionado
  obligatorio interruptor->luz (linea curva discontinua fina, distinta de la
  canalizacion de potencia) para que se vea la relacion mando/carga.
- `TOOL_GENERAR_PLANO`: enum ampliado a 7 tipos (`bandejas`, `electrico`, `unifilar`,
  `planta_electrica`, `planta`, `mecanico`, `gantt`), descripcion reescrita explicando la
  diferencia entre `electrico` (circuito interno de UN cuadro), `unifilar` (interconexion
  ENTRE cuadros) y `planta_electrica` (instalacion electrica de planta) vs `planta`
  (generico, sin instalacion).
- `tiposValidos` (case `generar_plano`) y el CHECK de `_ensurePlanosTableAgente` (solo
  cosmetico para instalaciones nuevas, prod ya tiene el CHECK real via migracion)
  actualizados con los 2 tipos nuevos.
- `_generarPlanoAgente`: nuevas ramas de inyeccion de simbolos --
  `unifilar` -> `IEC_SYMBOLS_DEFS` + `IEC_BANDEJA_DEFS`; `planta_electrica` ->
  `IEC_BANDEJA_DEFS` + `IEC_INSTALACION_DEFS`.
- `migrate_006_planos_unifilar_planta_electrica.sql`: amplia el CHECK de `tipo` en la
  tabla `planos` (SQLite no permite ALTER de CHECK directo -- reconstruccion de tabla
  `CREATE TABLE IF NOT EXISTS ... tmp` -> `INSERT ... WHERE id NOT IN (...)` -> `DROP`/
  `RENAME`). Disenada para ser re-ejecutable sin perdida de datos ni duplicados (el
  workflow de deploy relanza TODAS las migraciones en cada push con
  `|| echo "ya aplicada, continuando..."`). Verificada localmente (`--local`, dos
  ejecuciones seguidas) antes de aplicarla a produccion (`--remote`); confirmado que las
  17 filas previas se conservaron intactas.
- `.github/workflows/deploy-alejandra-agente.yml`: nuevo paso que aplica la migracion 006
  (mismo patron que las 5 anteriores).

### Verificacion
- `node --check worker.js` limpio, grep de corrupcion de encoding limpio antes del commit.
- Test en vivo via curl contra `/api/chat/stream` para AMBOS tipos nuevos:
  - `unifilar` (plano de prueba ID 19, ~160s de generacion, sin 524 gracias al streaming
    ya existente): esquema real Acometida -> CGP -> CG -> SC-1, cada tramo con cable
    (tipo/seccion/longitud), protecciones Q1/ID1 con sus specs normativas, panel de
    resumen tecnico numerado, leyenda, cajetin completo (empresa/proyecto/escala/fecha/
    norma/revision). Verificado visualmente (SVG servido con `python -m http.server`
    local + Chrome via MCP): documento correcto y legible, con algun solape cosmetico
    menor de texto (layout de la IA, no un fallo estructural).
  - `planta_electrica` (plano de prueba ID 20, ~167s de generacion): plano de vivienda
    completo (recibidor/salon-comedor/cocina/bano/3 dormitorios/pasillo/trastero/hall)
    con CGD en el recibidor, circuitos de canalizacion en colores distintos por circuito,
    simbolos de punto de luz/toma/interruptor/conmutador/caja de derivacion, leyenda
    completa, cotas exteriores. Exactamente el tipo de documento pedido. Limitacion
    observada (no bloqueante): esta generacion en concreto omitio el bloque de titulo
    (empresa/proyecto) y la flecha norte pese a pedirse en el prompt -- variabilidad
    normal de generacion libre de la IA, mismo tipo de limitacion ya conocida y aceptada
    para `electrico`/`bandejas`.
- Ambos planos de prueba (19 y 20) borrados de D1 produccion tras la verificacion
  (confirmado con Adrian via AskUserQuestion antes de borrar).

### Deploy
- `npx wrangler deploy` manual desde `alejandra-agente/` para probar antes del commit,
  y de nuevo via CI tras el push (mismo resultado, migracion 006 idempotente re-aplicada
  sin error).
- Commit `53edc25`: "feat(agente): nuevos tipos de plano unifilar y planta_electrica en
  generar_plano". Push limpio (fast-forward). Deploy CI `28815636221` en verde (tests ->
  migraciones -> deploy -> health check).

---

## RESUMEN SESION 05/07/2026 (continuacion 20) -- Fix IDOR/exfiltracion cross-empresa en 5 familias de tools mas

Nota de numeracion: en ALEJANDRA_AGENTE.txt y en el mensaje de commit esto se llama
"continuacion 19" (siguiendo la numeracion propia de esa auditoria, que venia de la 14
y la 17). Aqui en SESION.md se numera 20 porque "APEX Agent" ya habia usado los
numeros 18 y 19 el mismo dia para el modulo Planos IA (ver secciones de esas dos mas
abajo) -- dos agentes trabajando en paralelo sobre el mismo repo sin coordinacion de
numeracion entre si. Se deja constancia aqui para que quede claro que no es un error
de duplicado sino dos secuencias independientes.

### Contexto: "seguimos auditando" (tercera pasada)
Siguiente pasada de la disciplina "hacemos todas por orden, pero primero audita" tras
la continuacion 17 (listar_esquemas/borrar_esquema/gestionar_tarea). Se lanzo un
subagente de auditoria sobre el resto de `case` de `ejecutarTool()` en
alejandra-agente/worker.js buscando tools de datos sin aislamiento por empresa_id o sin
comprobacion de propiedad, y CADA hallazgo se reverifico leyendo el codigo fuente
directamente (no solo el resumen del subagente) antes de presentarlo. Se consulto ademas
el esquema real de la base D1 de produccion via `npx wrangler d1 execute alejandra-db
--remote` porque dos tablas referenciadas por `generar_informe` -- `personal` y
`equipos_elevacion` -- resultaron **no existir en absoluto** en produccion.

Se presentaron 5 grupos de hallazgos confirmados via AskUserQuestion. Adrian eligio:
**"Arreglar todo ya, mismo patron que el resto (Recomendado)"** -- arreglar las 5
familias en una sola pasada, mismo patron que continuaciones 14/17 (empresa_id/
ownership real desde la sesion verificada, nunca confiando en input del LLM/usuario;
gateo minimo via TOOLS_REQUIEREN_SESION; tests de regresion; node --check; deploy CI;
documentacion en ambos archivos).

### Hallazgos y fixes (los 5 grupos, todos en worker.js salvo donde se indica)

1. **historico_materiales** (acciones consultar/comparar): sin filtro `empresa_id` en
   absoluto -- exponia (y "comparar" agregaba) el historico de materiales/costes de
   TODAS las empresas a cualquier usuario. La accion "registrar" ademas confiaba en
   `input.empresa_id` (controlable por el LLM/usuario) para decidir la empresa dueña del
   material. Fix: `empresa_id` real de la sesion siempre; override de `input.empresa_id`
   solo permitido si `esDevVerificado`; `AND empresa_id=?` añadido a consultar y
   comparar (bypass solo dev verificado/cron).

2. **generar_informe**: ademas del mismo problema de filtro `empresa_id` ausente en las
   5 subconsultas (fichajes, incidencias, bobinas, equipos, pedidos), `obra_id` se
   concatenaba directamente en el SQL (`` `AND obra_id=${obraId}` ``) -- inyeccion SQL.
   Fix: `obra_id` se valida con `parseInt` y se pasa siempre como parametro bind (`?`);
   se añade `AND empresa_id=?` a las 5 subconsultas (bypass dev verificado/cron); cada
   subconsulta se envuelve en `.catch(() => ({results: []}))` para que una tabla
   rota/inexistente (`personal`, `equipos_elevacion`) no tumbe el informe completo --
   igual que ya hacia la subconsulta de pedidos desde antes.

3. **analizar_archivo / marcar_plano / enviar_email / enviar_telegram_informe**: ninguna
   de las 4 comprobaba `puedeAccederArchivo()` antes de leer/adjuntar/reenviar un
   archivo de R2 -- a diferencia de `ver_archivo`/`listar_archivos`, que ya lo hacian.
   Se podia analizar, anotar tecnicamente (marcar_plano), adjuntar por email o reenviar
   por Telegram el archivo de OTRA empresa conociendo/adivinando su `r2_key`. Fix: las 4
   llaman ahora a `puedeAccederArchivo(env, obj.customMetadata, empresa_id,
   esDevVerificado)` antes de usar el contenido del objeto R2.

4. **crear_tarea_background / ver_tareas / completar_tarea** (tabla `alejandra_tareas`,
   sin columna `empresa_id`, solo `usuario_id`): las dos primeras confiaban en
   `input.usuario_id` para decidir de que usuario son las tareas; `completar_tarea`
   hacia `UPDATE ... WHERE id=?` sin comprobar propiedad -- cualquiera podia completar
   (fijando el "resultado") la tarea de otro usuario adivinando el id autoincremental.
   Fix: `usuario_id` real de sesion siempre salvo override con `esDevVerificado`;
   `completar_tarea` añade `AND usuario_id=?` (bypass dev verificado) y trata "0 filas
   afectadas" como error explicito en vez de falso "completada".

5. **enviar_push / iniciar_conversacion / controlar_app**: las 3 resuelven un "usuario
   destino" (`input.usuario_id || usuario_id`) sin comprobar que ese destino
   perteneciera a la misma empresa que quien llama -- se podia enviar push, iniciar una
   conversacion en nombre de otro usuario, o insertar un comando remoto (enum cerrado:
   navegar/dialogo/toast/vibrar/prefill_chat/enviar_mensaje/abrir_conversacion/
   tomar_foto/recargar/accion/datos/notificar -- no es ejecucion arbitraria) para la app
   de un usuario de OTRA empresa. Fix: nueva funcion `puedeNotificarUsuario(env,
   targetUser, usuario_id, empresa_id, esDevVerificado)` -- permite si el destino es el
   propio llamante (mismo usuario normalizado via `normalizarUsuarioId`), o si target y
   llamante comparten `empresa_id` en la tabla `usuarios`; bypass total con
   `esDevVerificado`.

### Diseño clave: bypass para esDevVerificado en TODOS los fixes
Los 5 grupos bypasan la comprobacion cuando `esDevVerificado=true`, replicando el patron
ya usado en `puedeAccederArchivo()`. Esto es imprescindible porque el cron
(`scheduled()`, se ejecuta 6x/dia) llama a `procesarConNEXUS(...)` con
`esDevVerificado=true` y `empresa_id='cron'` (placeholder no numerico) **a proposito**:
necesita ver y actuar cross-empresa para su monitorizacion automatica (notificar
proactivamente a "adrian", generar briefings agregados de todas las empresas). Sin el
bypass, estos fixes habrian roto esa funcionalidad del cron en silencio.

### Gating (lib.js) y tests
Las 12 tools (`historico_materiales`, `generar_informe`, `analizar_archivo`,
`marcar_plano`, `enviar_email`, `enviar_telegram_informe`, `crear_tarea_background`,
`ver_tareas`, `completar_tarea`, `enviar_push`, `iniciar_conversacion`,
`controlar_app`) se añadieron a `TOOLS_REQUIEREN_SESION` en `lib.js` -- exigen sesion
como minimo (el scope real de empresa_id/usuario_id/propiedad de archivo se aplica en
worker.js). 3 tests nuevos de regresion en `lib.test.js` (59 -> 62 tests, todos verdes).

### Verificacion y deploy
- `node --check` limpio en `worker.js` y `lib.js`.
- `npm test`: 62/62 tests verdes.
- Disciplina de git en repo compartido: antes de cada `git commit`/`push` se hizo
  `git fetch` + `git status` + `git log` para comprobar que no hubiera commits nuevos de
  "APEX Agent" solapando con los archivos tocados (`alejandra-agente/*`) -- sin
  solapamiento esta vez (los commits paralelos de esa sesion, `c97dc67`/`c3f7332`, tocan
  `worker.js` RAIZ + `panel.html` + `SESION.md`, no `alejandra-agente/`).
- Commit `ff52aea`: "fix(agente): IDOR/exfiltracion cross-empresa en 5 familias de
  tools (continuacion 19)". Push limpio (fast-forward, sin conflictos).
- Deploy CI en verde: "Deploy Alejandra Agente Worker" (incluye el paso "Correr tests
  (lib.test.js)" antes de aplicar migraciones/desplegar) y "Deploy to GitHub Pages",
  ambos disparados porque el commit toca `alejandra-agente/**`.
- Documentado tambien en ALEJANDRA_AGENTE.txt (subseccion "IDOR/EXFILTRACION
  CROSS-EMPRESA EN 5 FAMILIAS MAS", conteos de tests actualizados de 59 a 62 en las
  referencias vigentes, lista de TOOLS_REQUIEREN_SESION actualizada, cabecera del
  documento actualizada a continuacion 19/commit ff52aea).

---

## RESUMEN SESION 05/07/2026 (continuacion 21) -- Fix IDOR en subir_archivo/enviar_notificacion + authOk fail-closed

Nota de numeracion: en ALEJANDRA_AGENTE.txt y en el mensaje de commit esto se llama
"continuacion 20" (siguiendo la numeracion propia de esa auditoria, que venia de la 14,
17 y 19). Aqui en SESION.md se numera 21 porque el numero 20 ya estaba usado en la
seccion inmediatamente anterior. Mismo motivo que la nota de la seccion "continuacion 20"
de arriba: dos secuencias de numeracion independientes, sin error de duplicado.

### Contexto: "seguimos auditando" (cuarta pasada)
Mensaje del usuario: "seguimas" (typo de "seguimos"), interpretado segun la disciplina
vigente ("hacemos todas por orden, pero primero audita") como autorizacion para seguir
la auditoria de `ejecutarTool()` en `alejandra-agente/worker.js` mas alla de lo cubierto
en la continuacion 19/20 (arriba). Se lanzo un subagente de auditoria + verificacion
propia leyendo el codigo fuente directamente antes de presentar nada. El subagente
reporto 5 hallazgos; 2 se descartaron como falso positivo (memory_save/memory_read/
propose_mejora sobre `alejandra_memoria`: el propio codigo trae un comentario que
confirma que es, por diseno, una base de conocimiento COMPARTIDA entre todas las
empresas -- no debe llevar `empresa_id`). Los 3 restantes se confirmaron reales y se
presentaron via AskUserQuestion. Adrian eligio: **"Arreglar los 3 ya, mismo patron que
el resto (Recomendado)"**.

### Hallazgos y fixes (los 3, todos en worker.js salvo donde se indica)

1. **subir_archivo**: escribia en CUALQUIER key de R2 (`input.key`, string libre
   influenciable por el usuario/LLM, sin prefijo obligatorio) sin guardar
   `customMetadata.usuario_id` -- por lo que `puedeAccederArchivo()` nunca podia
   determinar el dueno despues -- y sin comprobar si esa key ya pertenecia a OTRA
   empresa antes de SOBRESCRIBIRLA. Alcanzable por cualquier usuario autenticado de
   cualquier empresa (tool ofrecida a los expertos app, tecnico, completo e
   ingenieria). Fix: si la key ya existe, se reutiliza `puedeAccederArchivo(env,
   existente.customMetadata, empresa_id, esDevVerificado)` para bloquear la
   sobrescritura cross-empresa; al escribir se guarda `customMetadata.usuario_id`
   real (antes no se guardaba ninguno).

2. **enviar_notificacion**: codigo huerfano (no tiene definicion de tool ni aparece en
   ningun `TOOLS_POR_EXPERTO` hoy -- no se ofrece a ningun experto), pero el `case`
   seguia siendo alcanzable si algun dia se reconecta o via otro camino; enviaba push a
   CUALQUIER `usuario_id` sin comprobar empresa, mismo patron que `enviar_push` antes
   de la continuacion 19/20. Fix: reutiliza `puedeNotificarUsuario()` igual que
   `enviar_push`/`iniciar_conversacion`/`controlar_app`.

3. **ejecutarTool()**: el parametro `authOk` tenia valor por defecto `true`
   (fail-open). El unico call site que dependia de ese default era
   `ejecutarReflexion()` (no pasaba `authOk`/`esDevVerificado`), lo que trataba
   CUALQUIER tool gateada por `TOOLS_REQUIEREN_SESION` como autenticada dentro de ese
   loop de auto-reflexion -- un gap de defensa en profundidad relevante para prompt
   injection indirecta via el historial de chat que se pasa como contexto al modelo en
   ese loop. Fix: default cambiado a `authOk = false` (fail-closed);
   `ejecutarReflexion()` ahora pasa `false, false` explicitos. Los otros 2 call sites
   de `ejecutarTool` (flujo normal de chat) ya pasaban valores reales explicitos, no se
   ven afectados por el cambio de default.

`subir_archivo` y `enviar_notificacion` se anadieron a `TOOLS_REQUIEREN_SESION` en
`lib.js`. 2 tests nuevos de regresion en `lib.test.js` (62 -> 64 tests, todos verdes).

### Verificacion y deploy
- `node --check` limpio en `worker.js`, `lib.js` y `lib.test.js`.
- `npm test`: 64/64 tests verdes.
- Disciplina de git en repo compartido: `git fetch` + `git status` + `git log` antes
  del commit y de nuevo antes del push, sin commits nuevos de "APEX Agent" solapando.
- Commit `2a18d5b`: "fix(agente): IDOR en subir_archivo/enviar_notificacion +
  fail-closed authOk (continuacion 20)". Push limpio (fast-forward, sin conflictos).
- Deploy CI: "Deploy Alejandra Agente Worker" en verde a la primera. "Deploy to GitHub
  Pages" fallo 2 veces con `Deployment failed, try again later` -- blip transitorio de
  infraestructura de GitHub Pages, nada relacionado con el commit (que solo toca
  `alejandra-agente/**`, ni panel.html ni la PWA). El primer intento de recuperacion
  (`gh run rerun <id> --failed`) fue un error propio: al re-ejecutar solo los pasos
  fallidos, tambien repitio "Upload artifact", produciendo un artifact `github-pages`
  duplicado en el mismo run y un nuevo fallo distinto ("Multiple artifacts... count is
  2"). Correccion: `gh run rerun <id>` SIN `--failed` (rerun completo de todos los
  pasos) -- funciono al segundo intento de rerun completo. Leccion: en un workflow de
  un solo job que sube el artifact Y despliega en el mismo job, usar siempre rerun
  completo, nunca `--failed`, para evitar el artifact duplicado.
- Documentado tambien en ALEJANDRA_AGENTE.txt (subseccion "IDOR EN
  subir_archivo/enviar_notificacion + authOk FAIL-CLOSED", conteos de tests
  actualizados de 62 a 64 en las referencias vigentes, lista de
  TOOLS_REQUIEREN_SESION actualizada, cabecera del documento actualizada a
  continuacion 20/commit 2a18d5b).

---

## RESUMEN SESION 06/07/2026 -- Cascada Gemini planos + vision + fix web-search crash (v7.72)

Retomada la sesion del dia anterior (v7.64 era el ultimo commit en GitHub). Se habian acumulado cambios locales (v7.65-v7.71) sin commitear.

### Cambios implementados (worker.js raiz -- commits 101aa9c)
- **Cascada Gemini→OpenRouter→Anthropic en generacion de planos**: Gemini 2.5 Flash como primario (gratis, ~$0.0008/plano vs $0.128 con Anthropic). OpenRouter Llama-70B como segundo intento (10s timeout). Anthropic como ultimo recurso de pago.
- **Fix constraint D1**: tabla `planos` ahora incluye `'bandejas'` en el CHECK de tipo (migracion aplicada manualmente: CREATE nueva→INSERT SELECT→DROP vieja→RENAME). Planos con tipo bandejas almacenados correctamente.
- **Prompts mejorados**: `bandejas` y `electrico` -- instruccion explicita de NO definir `<defs>` ni `<symbol>` propios (el renderizador los inyecta). Antes el modelo definia sus propias librerias de simbolos.
- **Auto-close SVGs truncados**: si el SVG no termina en `</svg>`, se le anade para que sea parseable.
- **max_tokens 16000 para Anthropic**: antes cortaba a 8192 (exactamente el limite), ahora hay margen.
- **Metadatos correctos**: `proveedor` y `modelo` real guardados en BD (antes siempre decia 'claude-sonnet-4-6').
- **Limpieza thinkingConfig**: eliminado el `thinkingConfig: {thinkingBudget: 0}` que causaba hanging de 25s en Gemini.
- **_cleanGKey**: funcion que limpia BOM/espacios de las claves API de Gemini (via regex con los bytes BOM literales -- falso positivo en el check de encoding pero es codigo intencional).

### Cambios implementados (alejandra-agente -- commit 07657d3)
- **Fix web search crash**: `buscarWebOpenAI()` ahora esta envuelta en try/catch tanto en `procesarConNEXUS` como en `procesarConNEXUSStream`. Antes, si GPT-4o devolvia 429 durante la busqueda web previa, el error propagaba como crash con `{texto: "Error: GPT-4o fallback 429:..."}` y `modelo`/`experto` vacios en la respuesta.

### Tests realizados
- **Plano bandejas**: generado correctamente (ID 9), proveedor=gemini, $0.0008, 47s (Gemini 2.5 Flash con thinking mode activo aunque no se configuro -- comportamiento nativo del modelo free tier). SVG auto-cerrado cuando truncado.
- **Vision (imagen de paisaje)**: funciona correctamente. Flujo: imagen JPEG subida via `/upload` al agente → R2 key pasada como `adjuntos[]` en `/api/chat` → `buildUserContentWithAdjuntos()` la carga de R2 y la convierte a bloque base64 inline → Claude la ve y describe correctamente.
  - Mensaje "Analiza esta imagen...": EXITO -- description completa del paisaje
  - Mensaje "describe detalladamente lo que ves" sin contexto de app: Alejandra rechaza (GPT-4o fallback, respuesta conservadora sin contexto de app industrial)
  - Mensaje con contexto de obra: EXITO tras el fix de web-search
- **Anthropic sin creditos**: Anthropic actualmente sin saldo → fallback automatico a OpenRouter (clave revocada, necesita renovacion) → GPT-4o (funciona pero con rate limits por uso intensivo en las pruebas).

### Estado de infraestructura
- Anthropic: SIN CREDITOS -- recargar en console.anthropic.com
- OpenRouter: CLAVE REVOCADA -- regenerar en openrouter.ai y ejecutar `npx wrangler secret put OPENROUTER_API_KEY` (y `npx wrangler secret put OPENROUTER_API_KEY --name alejandra-agente`)
- Gemini: funcionando para planos (3 claves rotando)
- GPT-4o: funcionando como fallback de vision/chat (rate limits en tests intensivos)

### Commits
- `101aa9c`: feat: Gemini cascade para planos + fix D1 bandejas + prompts mejorados -- v7.72
- `07657d3`: fix: agente -- web search errors no longer crash chat + vision tests confirmed

### Deploy
- Worker raiz: `alejandra-app-api` -- Version ID cd7c8c68
- Agente: `alejandra-agente` -- Version ID 12071624

---

## RESUMEN SESION 05/07/2026 (continuacion 12) -- Reescritura de ALEJANDRA_AGENTE.txt

Siguiente punto de la lista tras la cobertura de tests (continuacion 11). Este archivo
("Leelo SIEMPRE antes de tocar codigo del agente") llevaba desde el 15/05/2026 (v5.93)
sin tocarse.

### Auditoria (re-verificada leyendo worker.js/lib.js/wrangler.toml directamente, no solo
### de memoria de la auditoria anterior)
- Version: cabecera de worker.js dice "v6.03", pero GET /health devuelve "6.12" --
  desincronizados entre si, y ambos muy por delante del "v5.93" del doc.
- NEXUS_MODULES: doc listaba 9 modulos: **20 modulos reales** (`grep -n "^  [a-z_]*:"
  alejandra-agente/worker.js | awk -F: '$1<897'` para la lista vigente).
- NEXUS_EXPERTS: doc listaba 6 expertos, falta el experto `ingenieria` (maxTokens 8000,
  calculos electricos/mecanicos de obra) -- son **7**.
- Tools: doc listaba ~6 ("TODAS LAS HERRAMIENTAS"): **56 tools reales** repartidas de
  forma muy desigual entre expertos (`grep -oP "name: '\K[a-z_0-9]+(?=')"
  alejandra-agente/worker.js | sort -u`).
- Endpoints: doc listaba ~15 rutas: **~38 reales** (conteo exacto via grep, ver el doc
  nuevo). Faltaban por completo /api/sync/*, /api/comandos/*, /webhook/evento,
  /conocimiento*, /files/<key>, /upload, /fcm-token, /push, /auth/verify-session,
  /admin/migrate, etc.
- Precios: tabla no incluia `gpt-4o` (el bug de coste/etiquetado arreglado en 6f5dd3c).
- wrangler.toml: doc decia "Crons: DESACTIVADOS (cuenta free, limite 5 triggers)" --
  llevan meses ACTIVOS (6 disparos/dia, con handler `scheduled()` real en worker.js).
  Tambien faltaba mencionar el KV `RATE_LIMIT_KV` (rate limiting + tope de gasto).
- Arquitectura de DOS workers (app principal `worker.js` raiz con devAIChat/handleDevAI
  vs agente independiente `alejandra-agente/worker.js`): existia en la v5.93 original,
  pero se habia perdido en un borrador intermedio de este mismo trabajo -- se
  restauro y se verifico que el worker.js raiz sigue existiendo y sigue siendo un
  Cloudflare Worker distinto ("alejandra-app-api"), desplegado por
  `deploy-worker.yml`, no por `deploy-alejandra-agente.yml`.
- Cero mencion a los 3 fixes IDOR (tools por auth, scope empresa_id en consultar_bd/
  escribir_bd, aislamiento de archivos R2 por empresa), al anti-SSRF de test_endpoint,
  al rate limiting/tope de gasto diario, ni a la cobertura de tests de la continuacion 11.
- Sistema de prompt en capas L0-L4 (`buildAnthropicSystemBlocks`, cacheado de Anthropic
  para L0/L1) no existia en el doc en absoluto.

### Corregido (commit 60ae56e, doc-only -- NO toca alejandra-agente/**, no dispara el
### workflow de deploy, no requiere health check)
- Reescrito de cabo a rabo manteniendo la estructura de secciones original pero con
  contenido verificado linea por linea contra worker.js/lib.js/wrangler.toml actuales
  (no transcrito de memoria).
- Nueva seccion "GATING DE TOOLS POR AUTENTICACION Y AISLAMIENTO MULTI-EMPRESA":
  documenta las 3 capas de fix IDOR + anti-SSRF + rate limiting, con el porque de
  cada una (para que el proximo chat no repita el mismo bug).
- Nueva seccion "TESTS": explica lib.js/lib.test.js, que vive ahi y por que, y que
  el workflow de deploy corre `npm test` antes de desplegar.
- Nueva seccion "PROMPT EN CAPAS L0-L4": explica el prompt caching de Anthropic
  (L0/L1 estaticos y cacheados vs L2-L4 dinamicos por turno).
- Anti-staleness deliberado: las listas volatiles (modulos, tools, endpoints, tablas)
  ya NO se transcriben integras a mano -- se da un conteo aproximado "a fecha de hoy"
  mas el comando `grep` exacto para obtener la lista real en el momento de la lectura,
  con una nota explicita al principio del archivo pidiendo confiar en el grep si no
  coincide con el conteo escrito.
- Anotado (no corregido, fuera de alcance de este punto de la lista): la
  desincronizacion de version "v6.03" (cabecera) vs "6.12" (/health) -- queda como
  recordatorio en la seccion de reglas para que se corrija la proxima vez que se
  toque cualquiera de los dos.

Siguiente punto de la lista (superado, ver continuacion 13 mas arriba/abajo): Adrian pidio
arreglar la desincronizacion de version anotada arriba, y seguir auditando.

---

## RESUMEN SESION 05/07/2026 (continuacion 13) -- Fix version desincronizada (v6.03 vs 6.12)

Adrian pidio explicitamente arreglar el punto que la continuacion 12 habia dejado solo
anotado (no corregido): la cabecera de `alejandra-agente/worker.js` decia "v6.03" mientras
que `GET /health` devolvia `version: "6.12"`.

### Auditoria de la causa raiz
`git log -p --follow` sobre la cabecera de worker.js muestra una progresion real
v6.00->v6.01->v6.02->v6.03 a lo largo de varios commits genuinos, pero el string
`version: '6.12'` de `/health` no habia cambiado nunca desde que se introdujo. Un grep
del repo completo (`v6.12`, `v6.03`) los encontro tambien en `ESTADO_APP.txt` -- el
changelog **de la PWA**, no del agente -- con una entrada explicita que dice que el bump
de la PWA a v6.03 coincidio con un cambio hecho ese dia "desde otro ordenador (worker del
agente alejandra-agente)". Es decir: ninguno de los dos numeros (ni "v6.03" ni "6.12") fue
nunca un contador propio del agente -- ambos se tomaron prestados en su momento de la
numeracion de la PWA (que ahora va por v7.55, sin ninguna relacion con el agente).

### Corregido (commit a27d650, deploy CI 28739993149, health OK -- confirmado con curl que
### /health ya devuelve "6.13")
- `alejandra-agente/worker.js`: cabecera y `/health` sincronizados a `v6.13` (siguiente
  entero tras el mayor de los dos valores desincronizados). El comentario de cabecera
  ahora explica la causa raiz y deja la regla por escrito: subir el numero en la cabecera
  Y en `/health` a la vez, solo cuando cambie este worker, nunca copiado de la PWA.
- `deploy-alejandra-agente.yml`: se quito el "v6.12" hardcodeado del mensaje de log del
  paso "Verificar health" (quedaria desactualizado en cada bump futuro) -- ahora remite a
  `/health` como fuente de verdad en vez de repetir un numero fijo.
- Cero cambio de comportamiento: solo strings de version y un comentario. Verificado con
  `node --check`, diff revisado (2 archivos, 8 inserciones/3 borrados), deploy CI en verde
  (tests -> migraciones -> deploy -> health check), y confirmado por curl manual tras el
  deploy que `/health` ya reporta `"6.13"`.

### Documentacion (commit 74f686e, doc-only, sin deploy)
- `ALEJANDRA_AGENTE.txt` regla #3 reescrita: ya no describe el problema como pendiente,
  documenta la causa raiz real (numeros prestados de ESTADO_APP.txt) y la regla de
  versionado propio del agente a partir de ahora.

Siguiente punto de la lista: seguir auditando (instruccion "seguimos auditando" de
Adrian, sin un item concreto todavia identificado -- pendiente de una nueva pasada de
auditoria sobre el codigo del agente/PWA para encontrar el siguiente problema real).

---

## RESUMEN SESION 05/07/2026 (continuacion 14) -- Fix IDOR/SQLi critico: configurar_alerta y exportar_datos

Siguiente pasada de auditoria tras la continuacion 13 ("seguimos auditando"). Subagente
de auditoria encontro un hallazgo CRITICO: dos tools quedaban fuera de las 3 capas de
aislamiento multi-empresa ya aplicadas a consultar_bd/escribir_bd. Presentado a Adrian via
AskUserQuestion (regla "auditar antes de arreglar") -- eligio explicitamente: "Arreglar ya,
mismo patron que consultar_bd (Recomendado)".

### Auditoria (confirmada leyendo worker.js directamente, no solo el resumen del subagente)
- `configurar_alerta`: la accion "crear" guardaba un `condicion_sql` arbitrario en
  `alertas_config` SIN validar que fuera un SELECT de solo lectura. La accion "verificar"
  ejecutaba ese SQL guardado tal cual, mas tarde, via `env.DB.prepare(alerta.condicion_sql).all()`
  -- sin ninguna comprobacion en ese momento tampoco. Cualquier sesion (no solo dev) con
  acceso a esta tool podia persistir un UPDATE/DELETE/DROP disfrazado de "condicion de
  alerta" y conseguir que se ejecutara solo, en background, la proxima vez que "verificar"
  corriera (via cron o via el propio modelo).
- `exportar_datos`: NINGUN tipo de exportacion (bobinas/personal/fichajes/materiales/gastos)
  filtraba por `empresa_id` -- cualquier usuario con sesion podia exportar datos de TODAS
  las empresas del sistema, no solo la suya (IDOR puro). Ademas, `obra_id`, `fecha_desde` y
  `fecha_hasta` se concatenaban directamente como string dentro del SQL (sin `bind()`),
  abriendo inyeccion SQL directa por esos 3 campos. El modo "custom" (`sql_custom`) solo
  comprobaba que la query empezara por la palabra "SELECT" (case-insensitive), sin bloquear
  tablas fuera de la allowlist ni columnas sensibles como `password_hash`.
- Verificado contra el D1 de produccion (`wrangler d1 execute --remote`): las tablas
  `personal` y `gastos` referenciadas por `exportar_datos` **no existen** en produccion hoy
  -- esas dos ramas son codigo muerto/roto ahora mismo (fallan con "no such table", no
  explotables actualmente), pero se corrigio igualmente el patron de inyeccion por
  consistencia y por si se crean esas tablas en el futuro. `bobinas`, `fichajes` y
  `materiales_obra` si existen y si tienen columna `empresa_id` real -- estas si eran
  explotables.

### Corregido (commit 8d7ef65, deploy CI 28742618524, health OK)
- `lib.js`: `configurar_alerta` anadida a `TOOLS_SOLO_DEV_VERIFICADO` (igual que
  patch_codigo/rollback/ejecutar_deploy) -- guarda y ejecuta SQL arbitrario, exige el
  mismo nivel de confianza que las tools de codigo/deploy. `exportar_datos` anadida a
  `TOOLS_REQUIEREN_SESION` (el scope real de empresa_id se aplica en worker.js).
- `lib.js`: nueva funcion pura `validarSoloSelectBD(query)`, extraida de la logica que
  ya vivia inline dentro de `consultar_bd` (mismo comportamiento, cero cambio para esa
  tool), para poder compartirla tambien con `configurar_alerta` y `exportar_datos`.
- `worker.js` / `configurar_alerta`: guarda "requiere sesion de desarrollador verificada"
  como defensa en profundidad al inicio del case (por si algun dia se filtra a una ruta
  que no pase por `filtrarToolsPorAuth`). `condicion_sql` se valida con
  `validarSoloSelectBD` tanto en "crear" como, de nuevo, en cada fila al ejecutar
  "verificar" (por si la fila viene de antes de este fix o de una edicion manual en D1).
- `worker.js` / `exportar_datos`: reescrito por completo. Nuevo helper `construirWhere()`
  construye el WHERE de las 5 exportaciones fijas con placeholders + array `params`
  (obra_id, luego `empresa_id` obligatorio salvo `esDevVerificado`, luego fecha_desde/
  fecha_hasta), ejecutado con `stmt.bind(...params).all()`. El modo "custom" ahora pasa
  por `validarSoloSelectBD` + `validarScopeEmpresaBD` (el mismo aislamiento multi-empresa
  que ya protegia a `consultar_bd`), en vez de solo comprobar el prefijo "SELECT".
- `lib.test.js`: 10 tests nuevos (37 -> 47) -- `validarSoloSelectBD` (SELECT valido,
  rechazo sin prefijo SELECT, rechazo con verbo de escritura colado, case-insensitivity,
  input vacio/null/undefined) y nuevas pertenencias de `filtrarToolsPorAuth` para
  `configurar_alerta`/`exportar_datos`. `node --check` limpio en los 3 archivos, diff
  revisado linea a linea, deploy CI en verde (tests -> migracion -> deploy -> health
  check), confirmado por curl manual que `/health` sigue respondiendo (version sin
  cambios, este fix no tocaba el numero de version).

### Documentacion (commit e7134e3, doc-only, sin deploy)
- `ALEJANDRA_AGENTE.txt`: seccion "GATING DE TOOLS..." actualizada con las nuevas
  pertenencias de `configurar_alerta`/`exportar_datos` y con `validarSoloSelectBD` como
  nueva capa compartida; recuento de tests actualizado (37 -> 47) en sus dos referencias;
  cabecera "ultima actualizacion" actualizada a continuacion 14 / commit 8d7ef65.

### Hallazgos #2 y #3 (mismo subagente de auditoria) -- ver continuacion 15 mas abajo
El mismo subagente reporto ademas: hallazgo #2 (`/auth/verify-session` filtra `ADMIN_TOKEN`
en texto plano) y hallazgo #3 (`verificarAdminToken` sin rate limiting propio). Se
presentaron a Adrian por separado (regla "auditar antes de arreglar") y **ya estan
corregidos** -- ver seccion "continuacion 15" justo debajo para el detalle completo.

---

## RESUMEN SESION 05/07/2026 (continuacion 15) -- Fix hallazgos #2/#3: token ADMIN_TOKEN en claro y sin rate limit

Continuacion directa de la continuacion 14 de arriba. Los hallazgos #2 y #3 (mismo
subagente de auditoria, mismo pase sobre `configurar_alerta`/`exportar_datos`) se
presentaron a Adrian via AskUserQuestion. Primera respuesta: "que me recomiendas?" --
se le dio una recomendacion concreta via una segunda pregunta, y eligio explicitamente:
**"Los dos: #3 ya, #2 con token efimero (Recomendado)"**.

### Auditoria
- Hallazgo #2: `POST /auth/verify-session` devolvia `env.ADMIN_TOKEN` (el secreto maestro,
  estatico, sin expirar) en texto plano dentro del JSON de respuesta cada vez que una
  sesion de dev se verificaba correctamente. Si esa respuesta se filtraba (XSS, log,
  sesion interceptada), el atacante se quedaba con un secreto mucho mas duradero que la
  propia sesion robada que lo obtuvo.
- Hallazgo #3: `verificarAdminToken(env, token)` no aplicaba ningun rate limiting propio,
  pese a proteger rutas sensibles (`/admin/migrate`, `/api/admin/*`, `/push`,
  `/api/reflexion`, `/conocimiento`) -- se podia probar tokens repetidamente sin
  throttling.
- Relacionado (descubierto al corregir #2): la columna `expires_at` de `alejandra_tokens`
  existe en el schema desde el principio (migrate_001_init_schema.sql) pero
  `verificarAdminToken` nunca la comprobaba en su query -- un token con fecha de
  expiracion pasada seguia siendo valido para siempre. Habia que arreglarlo primero para
  que los tokens efimeros del fix de #2 caducaran de verdad.

### Corregido
- `worker.js` / `verificarAdminToken(env, token, req)`: ahora recibe `req` (opcional, solo
  para poder leer la IP) y aplica `validarRateLimit()` -- el mismo KV-backed rate limiter
  ya usado en `/api/chat` -- con un bucket propio (`admin-auth:ip:${ip}`) para no
  compartir cupo con el rate limit del chat. Fail-open si KV falla (mismo comportamiento
  que el resto del sistema). Los 5 call sites (`/admin/migrate`, `/conocimiento`,
  `/api/reflexion`, prefijo `/api/admin/`, `/push`) actualizados para pasar `req`.
- `verificarAdminToken`: la query SQL ahora exige
  `(expires_at IS NULL OR expires_at > datetime('now'))` ademas de `activo=1`.
- `worker.js` / `POST /auth/verify-session`: en vez de devolver `env.ADMIN_TOKEN`, genera
  un token efimero propio (`crypto.getRandomValues` + hex, prefijo `eph_`) y lo inserta en
  `alejandra_tokens` (tipo='admin', `expires_at` = ahora + 12 horas), devolviendo ese token
  al llamador. No requiere ningun cambio en `alejandra-panel.html`: el panel ya trataba el
  campo `token` de la respuesta como un bearer opaco (`localStorage.setItem('alej_token',
  d2.token)`), verificado leyendo el HTML directamente antes de tocar nada.
- Limitacion conocida (aceptada, no bloqueante): los tokens efimeros expirados no se
  purgan automaticamente de `alejandra_tokens` -- simplemente dejan de ser validos por el
  chequeo de `expires_at`. Limpieza periodica queda pendiente para el futuro si la tabla
  crece demasiado.

### Incidente operativo: edicion concurrente del mismo repo por otro agente
Al ir a comitear este fix, `git add alejandra-agente/worker.js` dejo tambien
`panel.html` (376 lineas) en el stage sin haberlo tocado. Investigando (`git restore
--staged panel.html`, luego `git status` no mostraba NINGUN cambio pendiente en ningun
archivo) se descubrio que un commit nuevo, `ce6e7d9` ("feat: pagina Planos IA en
panel.html...", autor "APEX Agent <apex@padilla585.dev>", Co-Authored-By Claude Sonnet
4.6), ya estaba en `main` y ya empujado a `origin/main` -- otro agente autonomo trabajando
en paralelo sobre este mismo directorio de trabajo, haciendo una feature no relacionada
(pagina "Planos IA"), habia absorbido sin querer mis cambios de `worker.js` (49 lineas,
confirmadas via `git show ce6e7d9 --stat` y grep de mis propias cadenas de codigo:
`verificarAdminToken(env, token, req)`, `tokenEfimero`) dentro de su propio commit,
probablemente via un `git add -A` o equivalente en su propio proceso de commit.

Como `ce6e7d9` ya estaba pusheado a `origin/main`, reescribirlo violaria la regla de "no
reescribir historial ya pusheado" -- en vez de eso: (1) se verifico que el deploy de ese
commit paso limpio (`gh run watch 28744128734 --exit-status`: tests 47/47, migraciones y
deploy en verde, health check OK), (2) se verifico via curl manual que `/health` responde
correctamente y que `/auth/verify-session` rechaza tokens invalidos sin filtrar
`ADMIN_TOKEN` en el error, y (3) se documento explicitamente en `ALEJANDRA_AGENTE.txt`
(commit `ca8adfe`, doc-only) que el codigo de estos hallazgos vive dentro de `ce6e7d9`
pese a que su mensaje de commit no lo menciona, para que sesiones futuras leyendo `git
log` no se confundan.

**Leccion operativa para el resto de esta sesion y futuras**: este repo esta siendo
editado concurrentemente por al menos otro agente autonomo. A partir de ahora, revisar
`git status` / `git diff --cached` con cuidado extra antes de cada commit, y preferir
`git add <archivo especifico>` en vez de variantes que puedan arrastrar cambios ajenos.

### Documentacion (commit ca8adfe, doc-only, sin deploy)
- `ALEJANDRA_AGENTE.txt`: seccion de autenticacion actualizada para describir
  `verificarAdminToken(env, token, req)` y el chequeo de `expires_at`; nuevo bloque
  explicando ambos fixes y el incidente de commit mezclado con `ce6e7d9`.

Siguiente punto de la lista: seguir con la instruccion "seguimos auditando" para el resto
del sistema -- ningun hallazgo especifico identificado todavia mas alla de este punto.

---

## RESUMEN SESION 05/07/2026 (continuacion 16) -- Interruptor dev-bypass (rate limit / aislamiento empresa_id) solo para el desarrollador

Peticion original de Adrian, al margen de la auditoria de seguridad en curso: "de todas
formas hemos puesto limitaciones a alejandra IA, eso esta bien pero quiero poder activar o
desactivar las limitaciones desde ajustes en algun lado de alejandra office y la app, solo
visible para dev (yo)". Antes de tocar codigo se le pregunto explicitamente el alcance via
tres preguntas (AskUserQuestion), y contesto:
- Alcance: **"Solo a mi (dev verificado) (Recomendado)"** -- nunca debe afectar a otros
  usuarios/empresas.
- Que limitaciones: **"Rate limiting (15 peticiones/min), Aislamiento por empresa_id"** --
  solo estas dos, ninguna otra proteccion (ni las de #13/#15/#16 de la auditoria, ni
  ninguna futura) queda cubierta por este interruptor salvo que se pida explicitamente.
- Auditoria: **"Si, con log detallado (Recomendado)"** -- cada cambio de interruptor debe
  quedar registrado (quien, cuando, que cambio).

### Diseno
Todo el estado vive en una unica fila compartida de D1, tabla `agente_config` (id=1),
usada tanto por el worker raiz (`worker.js`, el que sirve la app movil y panel.html) como
por el worker del agente (`alejandra-agente/worker.js`). Dos columnas nuevas:
`dev_bypass_rate_limit` (INTEGER, default 0 = protegido) y `dev_bypass_empresa_scope`
(INTEGER, default 1 = aislamiento activo -- OJO, el "activado" logico de este interruptor
en concreto es poner la columna a 0, ver `bypassEmpresaActivo` en lib.js). Migracion:
`alejandra-agente/migrate_005_dev_bypass.sql`.

El interruptor SOLO tiene efecto para peticiones donde `auth.isDesarrollador` es `true` --
no `isSuperadmin` (que es mas amplio e incluye admins de empresa) ni `isAdmin`. Via las
cabeceras legacy `X-Admin-Code`, `isDesarrollador` siempre da `false` (solo se concede via
sesion D1 real), asi que no hay forma de colarse por una via antigua. Para cualquier otro
rol/usuario el interruptor es completamente invisible y no cambia su comportamiento.

### Backend -- agente (`alejandra-agente/`)
- `lib.js`: nuevas funciones puras `bypassEmpresaActivo(cfg)` y
  `debeOmitirRateLimitDev(cfg, auth)`, ambas ya cubiertas con tests de regresion en
  `lib.test.js` (10 tests nuevos: 47 -> 57 en total).
- `worker.js` (agente): nueva funcion `leerConfigDevBypass(env)` (lee la fila de
  `agente_config`), aplicada en los puntos donde ya se hacia rate limiting y scoping por
  empresa_id, mas nuevo endpoint `GET/POST /api/admin/dev-bypass` (bajo el sistema
  ADMIN_TOKEN existente del agente, para uso desde `alejandra-panel.html` si hiciera
  falta).
- Verificado: `npm test` (57/57 en verde), `node --check worker.js`, deploy CI
  (`gh run watch ... --exit-status`) en verde, `/health` respondiendo OK tras el deploy.

### Backend -- worker raiz (`worker.js`, commit `c81c59d`)
Nuevo endpoint `GET/POST /alejandra-agente-dev-bypass`, siguiendo el mismo patron ya
existente en `/alejandra-agente-toggle` / `/alejandra-agente-restart`: escribe
DIRECTAMENTE en la D1 compartida (`agente_config`) en vez de hacer un proxy HTTP al worker
del agente. Gateado con `auth.isDesarrollador` (no `isSuperadmin`) devolviendo 403 si no
se cumple. El POST body admite `{campo: 'rate_limit'|'empresa_scope', activo: bool}` y cada
cambio queda registrado via `logActividad(env, {nivel: 'warn', origen:
'panel_dev_bypass', ...})` con el nombre/usuario_id de quien lo cambio, el valor anterior y
el nuevo -- cumple el requisito de "log detallado" pedido por Adrian.

### UI -- panel.html ("Alejandra Office", commit `c81c59d`)
Nueva tarjeta "🔓 Interruptor Dev-Bypass" dentro de la pagina DevTools (`pageDevtools`),
oculta por defecto (`style="display:none"`) y solo mostrada cuando
`SESSION.rol === 'desarrollador'`. Dos filas de toggle (rate limiting, aislamiento
empresa_id) con confirmacion (`confirm()`) antes de activar cualquier bypass, para evitar
un click accidental. JS: `cargarDevBypass()` (anadida al `Promise.all` de
`cargarDevtools()`), `pintarDevBypassBtn()`, `toggleDevBypass(campo)`.

Verificacion de sintaxis: concatenar los `<script>` de panel.html y correr `node --check`
de una vez da un falso positivo (`Identifier '_planosData' has already been declared`) --
`let`/`const` de nivel superior en tags `<script>` separados no colisionan en un navegador
real, solo al concatenarlos artificialmente. Extrayendo y comprobando cada bloque por
separado: los bloques 0 y 1 (donde esta mi codigo) pasan limpios; el bloque 2 SI tiene un
`let _planosData` duplicado real dentro de si mismo, pero es un bug preexistente de la
feature "Planos IA" (commit `ce6e7d9`, nada que ver con este cambio) -- se dejo constancia
via `spawn_task` en vez de arreglarlo aqui, por estar fuera de alcance.

Importante: existen DOS paneles distintos servidos desde este repo -- `panel.html`
("Alejandra Office", el panel principal de la app, autenticado via `SESSION`/`X-Token`
contra el worker raiz) y `alejandra-panel.html` (panel de control especifico del agente,
autenticado via `Authorization: Bearer <token>` contra `/api/admin/*` del propio worker del
agente). La peticion de Adrian ("alejandra office") mapea sin ambiguedad al primero -- el
segundo se dejo intacto.

### UI -- app Flutter (`alejandra-ia`, commit `014508b`)
- `lib/services/admin_service.dart`: nuevos metodos `getDevBypass()` y
  `setDevBypass(String campo, bool activo)`, llamando a los mismos endpoints del worker
  raiz de arriba.
- `lib/screens/settings_screen.dart`: nueva seccion expandible "Dev-Bypass (solo tu)"
  (icono candado abierto), mostrada solo si `_s.userRol == 'desarrollador'`
  (`SettingsService.userRol`, poblado en `auth_service.dart` directamente desde
  `sesion.rol` del backend -- mismo valor que `auth.isDesarrollador` en el worker).
  Confirmacion via `AlertDialog` antes de activar cualquier bypass. Deliberadamente NO se
  toco la seccion "Avanzado" preexistente (URL del backend / borrar cache), porque esa la
  usan tambien testers no-dev y no formaba parte de lo pedido.
- Verificado con `dart analyze`: 0 issues nuevos (1 lint preexistente sin relacion, linea
  598, ya existia antes de este cambio). Este repo no tiene GitHub Actions (los APK se
  compilan a mano con `build_release.ps1`), asi que no hay deploy CI que verificar para
  estos dos archivos.

### Documentacion
`ALEJANDRA_AGENTE.txt` actualizado (commit pendiente en el momento de escribir esto):
cabecera a "continuacion 16", nueva subseccion "INTERRUPTOR DEV-BYPASS" dentro de "GATING
DE TOOLS...", conteo de tests 47->57 en dos sitios, `/api/admin/dev-bypass` anadido a la
lista de endpoints ADMIN, y `migrate_004_rename_agente_config.sql` /
`migrate_005_dev_bypass.sql` anadidos tanto a "MIGRACIONES D1" como a "ESTRUCTURA DE
ARCHIVOS RELEVANTES" (con nota sobre el hueco historico de migrate_004 en el workflow de
CI, ya corregido).

Siguiente punto de la lista: retomar "seguimos auditando" para el resto del sistema (esta
feature fue una peticion intercalada, no parte de la lista de auditoria).

---

## RESUMEN SESION 05/07/2026 (continuacion 19) -- Modulo Planos IA Parte C: editor SVG + imprimir + DXF (v7.57)

Peticion de Adrian tras confirmar la Parte B: "parte C del modulo de planos".
Confirmado plan tecnico con el usuario antes de codificar.

### Backend (worker.js) -- commit c97dc67
- Nueva ruta `PUT /planos/:id/svg` + funcion `actualizarPlanoSvg()`:
  valida que el body tiene `svg_data`, que empieza por `<svg` o `<?xml`,
  y que el plano pertenece a la empresa del usuario antes de actualizar D1.
  Requiere rol != operario.

### Frontend (panel.html) -- commit c97dc67
- CDN interact.js 1.10.27 anadido al bloque de scripts del head.
- CSS `.editor-tool-btn`, `.svg-selected`, `.svg-hover` anadidos.
- Modal visor de plano rediseñado: cabecera mas ancha con boton "Editar",
  "Guardar", "Cancelar edicion", "SVG", "DXF", "Imprimir" y toolbar
  de edicion (oculta por defecto).

#### Editor SVG interactivo
- `activarEditorPlano()` -- activa modo edicion, guarda estado inicial en stack undo
- `cancelarEdicionPlano(silencioso)` -- desactiva y restaura SVG original si no se guardo
- `guardarPlanoEditado()` -- PUT /planos/:id/svg con el SVG actual del DOM
- `setEditorTool(tool)` -- seleccionar/texto/linea/rect/circulo/eliminar
- `_activarInteracciones()` -- registra event listeners en elementos SVG + interact.js drag
  - Seleccionar/Mover: interact.js translada coordenadas segun tag (rect→x/y, circle→cx/cy,
    line→x1/y1/x2/y2, text→x/y, g/path→transform translate)
  - Texto: click en `<text>`/`<tspan>` → input flotante con position:fixed sobre el elemento;
    Enter confirma, Escape cancela, blur confirma con 100ms delay
  - Texto nuevo: click en zona vacia con herramienta Texto → crea `<text>` y abre input
  - Dibujo: mousedown+mousemove+mouseup en el SVG → crea line/rect/circle en tiempo real
  - Eliminar: click en elemento → remove() inmediato
- `editorUndo()` / `editorRedo()` -- stack de hasta 50 snapshots del outerHTML del SVG
- `_onEditorKey()` -- Delete/Backspace elimina seleccionado; Ctrl+Z/Y undo/redo; Ctrl+S guarda
- Color y grosor configurables via inputs en la toolbar

#### Impresion mejorada
- `_abrirVentanaImpresion(svgStr, titulo, tipo)` -- abre ventana limpia con:
  - Cabecera: titulo del plano, tipo (emoji+label), nombre empresa, fecha actual
  - SVG ocupa el 100% del area imprimible
  - Orientacion automatica: detecta si viewBox es mas ancho→landscape, mas alto→portrait
  - CSS @media print: `print-color-adjust:exact` para colores, sin elementos .no-print
  - Boton "Imprimir / Guardar PDF" que se oculta al pulsar (no aparece en el PDF)
- Funciona tanto desde el visor (con ediciones incluidas si las hay) como desde las
  tarjetas del grid (botones "PDF" individuales por plano)

#### Exportacion DXF
- `descargarDxfPlano()` -- conversor SVG→DXF sin librerias externas (~120 lineas):
  - Parsea el SVG con DOMParser (no modifica el DOM real)
  - Lee viewBox para convertir coordenadas (SVG Y↓ → DXF Y↑, inversion H-y)
  - Entidades DXF generadas: LINE (svg line), LWPOLYLINE (rect+polygon+polyline),
    CIRCLE (circle+ellipse≈radio mayor), TEXT (text+tspan)
  - Color: funcion rgb2dxf() mapea colores CSS a indices ACI de AutoCAD (1-7)
  - Formato: header DXF AC1015 + seccion ENTITIES + EOF, descargado como .dxf

### Version
7.56 → 7.57 en version.json + sw.js + index.html
Worker desplegado: Version ID becc34c9-7e35-4098-9929-28ee98a364f2

---

## RESUMEN SESION 05/07/2026 (continuacion 18) -- Modulo Planos IA Parte B: panel.html + test en vivo

Continuacion de la continuacion 14 (backend Planos ya hecho). Se implemento y verifico la
UI completa del modulo de Planos Tecnicos en panel.html.

### Implementacion panel.html (commits ce6e7d9 y ec0b5e3)

#### Nuevo boton en sidebar
- `<button data-page="planos" onclick="navTo('planos')">📐 Planos IA</button>`
- Entrada en PAGE_TITLES (`planos: '📐 Planos Tecnicos IA'`) y PAGE_LOADERS
  (`planos: (...a) => cargarPlanos(...a)`)

#### Fix preexistente: apiFetch no definido
- Varios modulos anteriores (escandallo, cronograma, rdp) llamaban a `apiFetch()` que
  nunca estaba definido en panel.html. Corregido anadiendo `const apiFetch = apiRaw;`
  como alias justo despues de la definicion de `apiRaw`.

#### Nueva pagina `id="pagePlanos"`
- Grid de tarjetas responsive (auto-fill, minmax 300px)
- Filtro por tipo (planta/electrico/mecanico/gantt) y busqueda por titulo
- Modal de generacion: tipo, titulo, descripcion, ejemplo, spinner de espera (20-40s),
  resultado con boton "Ver plano"
- Visor fullscreen con el SVG bruto + botones "Descargar SVG" y "PDF/Imprimir"
- Botones por tarjeta: Ver, descargar SVG, PDF/Imprimir, Eliminar

#### Bugs encontrados y corregidos durante el test
1. `id="planosGrid"` en conflicto con `pagePlanosObra` (preexistente) -> renombrado a
   `id="planosIAGrid"` en HTML y en `getElementById()` de cargarPlanos/renderPlanosGrid
2. Variable `_planosIAData` incorrecta en verPlano() -> corregida a `_planosData`
3. SVG sin atributo `width` se renderizaba a 0x0 dentro del visor -> ahora se detecta
   si tiene `viewBox` pero no `width` y se le pone `width="100%"` + `height="auto"`

### Test en vivo confirmado
- Plano tipo Gantt generado en ~70s para "Nave Industrial"
- Tarjeta aparecio en el grid con badge morado, titulo, descripcion y 4 botones
- Visor mostro SVG completo: cabecera azul oscuro, 4 fases coloreadas, barras con %
  de progreso (100/80/40/0/0/0), linea HOY, hito "ENTREGA FINAL", tabla resumen

### Archivos modificados
- `panel.html` -- pagina Planos IA completa (commits ce6e7d9 + ec0b5e3)

### Proximos pasos opcionales (no iniciados)
- Parte C: editor SVG interactivo en el navegador
- Exportacion DXF/CAD vectorial

---

## RESUMEN SESION 05/07/2026 (continuacion 17) -- Fix IDOR: listar_esquemas/borrar_esquema y gestionar_tarea

Retomada la instruccion "seguimos auditando" tras la feature intercalada del dev-bypass
(continuacion 16). Subagente de auditoria reviso todos los `case` de `ejecutarTool()` en
`alejandra-agente/worker.js` buscando tools de datos SIN aislamiento por empresa_id (las
areas ya auditadas -- consultar_bd/escribir_bd/exportar_datos/configurar_alerta,
/auth/verify-session, verificarAdminToken, el interruptor dev-bypass -- se excluyeron
explicitamente de la busqueda). Cada hallazgo se confirmo leyendo el codigo fuente
directamente (no solo el resumen del subagente), y tambien se confirmo contra el D1 de
produccion que existen 3 empresas activas (Levitec id=1, Edison Montajes id=3, PruebalaAPP
id=4) para verificar que el multi-tenant es real y explotable. Presentado a Adrian via
AskUserQuestion (regla "auditar antes de arreglar") -- eligio explicitamente: **"Arreglar
ya, mismo patron que el resto (Recomendado)"**.

### Auditoria
- `listar_esquemas`/`borrar_esquema` (`alejandra-agente/worker.js`, documentos_obra):
  NINGUNA de las dos queries filtraba por `empresa_id`, y ninguna de las dos tools estaba
  siquiera en `TOOLS_REQUIEREN_SESION` (`lib.js`) -- ni sesion exigian. `listar_esquemas`
  sin `obra_id` devolvia esquemas electricos (titulo, notas, r2_key, obra) de TODAS las
  empresas del sistema. Encadenando el `r2_key`/`documento_id` asi obtenido,
  `borrar_esquema` ejecutaba el DELETE (y el borrado del archivo real en R2) sin
  comprobar en ningun momento que el documento perteneciera a la empresa de quien
  llamaba -- fuga de lectura + borrado destructivo cross-tenant.
- `gestionar_tarea` (accion "actualizar"/"completar"): el `UPDATE tareas_obra SET ...
  WHERE id=?` no incluia `empresa_id`, a diferencia de "crear" (bindea empresa_id) y
  "eliminar" (`WHERE id=? AND empresa_id=?`) en la MISMA tool. Los ids de `tareas_obra`
  son autoincrementales y triviales de recorrer (1, 2, 3...) -- cualquier usuario con
  sesion podia completar, reasignar o repriorizar una tarea de otra empresa sin ninguna
  relacion con ella.

### Corregido (commit fc1fe7b, deploy CI 28748539701, tests+health OK)
- `alejandra-agente/worker.js` / `listar_esquemas`: ambas ramas de la query (con y sin
  `obra_id`) anaden `AND d.empresa_id=?`, bindeado siempre con el `empresa_id` real de
  quien llama.
- `alejandra-agente/worker.js` / `borrar_esquema`: reescrito para hacer primero un
  `SELECT ... WHERE (id=? o r2_key=?) AND empresa_id=?` -- si no hay match, devuelve error
  SIN tocar ni R2 ni la BD. Solo si el documento es realmente de la empresa que llama, se
  borra el archivo de R2 y luego el registro (`DELETE ... WHERE id=? AND empresa_id=?`).
- `alejandra-agente/worker.js` / `gestionar_tarea`: el UPDATE de "actualizar"/"completar"
  ahora exige tambien `AND empresa_id=?`; si `changes` sale en 0 (tarea inexistente o de
  otra empresa) se devuelve un mensaje de error en vez de un falso "actualizada
  correctamente".
- `alejandra-agente/lib.js`: `listar_esquemas` y `borrar_esquema` anadidas a
  `TOOLS_REQUIEREN_SESION` (exigen sesion como minimo, igual que `exportar_datos`).
- `alejandra-agente/lib.test.js`: 2 tests nuevos de regresion para las nuevas
  pertenencias de `TOOLS_REQUIEREN_SESION` (57 -> 59 tests). `node --check` limpio en los
  3 archivos, diff revisado linea a linea, deploy CI en verde (tests -> migracion ->
  deploy -> health check).

### Incidente operativo (de nuevo, edicion concurrente): commits ajenos ya en main
Antes de commitear este fix, `git fetch` + `git status` mostro que "APEX Agent" (el mismo
agente autonomo de la continuacion 15) habia seguido trabajando en paralelo sobre el mismo
directorio: commit `c47944d` corrigio exactamente el bug de `_planosData` duplicado en
`panel.html` que se habia dejado sealado via `spawn_task` en la continuacion 16 (en vez de
arreglarlo entonces, por estar fuera de alcance); y commit `b9c9d94` subio vitest de
`^2.1.9` a `^3.2.6` (junto con vite/esbuild) para cerrar 5 alertas de Dependabot (1
critica, 1 alta, 3 moderadas), sin anadir tests nuevos. Se comprobo que ninguno de los dos
tocaba los archivos de este fix (`alejandra-agente/worker.js`, `lib.js`, `lib.test.js`) y
que `npm test` seguia en 57/57 verde antes de mis 2 tests nuevos -- se hizo `git add` solo
de los 3 archivos propios de este fix, se commiteo encima, y el `git push` publico ambos
commits ajenos junto con el propio sin problema (ya estaban commiteados localmente, solo
faltaba el push).

**Addendum (mismo dia, tras commitear y pushear el commit de documentacion d48d285):** al
hacer `git fetch` + `git log` de verificacion post-push aparecio un TERCER commit ajeno de
"APEX Agent" que no estaba presente al momento del `git status` anterior: `ec0b5e3` ("fix:
planosGrid id conflicto con pagePlanosObra -- renombrar a planosIAGrid, fix visor SVG
width y _planosData alias"), sobre `panel.html`. Y, tras ese, un cuarto commit propio de
ese agente documentando su propio trabajo: `a6c3494` ("docs: SESION.md -- continuacion 18,
Planos IA Parte B completada y testeada"), que edito este mismo archivo (SESION.md) en
paralelo -- incluyo su propia seccion "continuacion 18" (ver arriba) y actualizo el bloque
"ESTADO ACTUAL" al inicio de este archivo. Se confirmo que `ec0b5e3` no tocaba ninguno de
los archivos de este fix (`alejandra-agente/*`) y que el deploy CI de ambos commits ajenos
(`ec0b5e3` y `a6c3494`, ambos "Deploy to GitHub Pages") ya habia corrido en verde antes de
mi propio push, sin conflicto. Es la tercera vez confirmada en esta sesion que "APEX Agent"
edita el mismo directorio de trabajo en paralelo (continuacion 15 fue la primera). No se
trata de un hallazgo de seguridad -- es trabajo de feature/UI de ese otro agente -- se deja
registrado aqui unicamente por disciplina operativa (mismo repo/working directory
compartido, sin coordinacion explicita entre agentes).

Siguiente punto de la lista: seguir con "seguimos auditando" para el resto del sistema --
ningun hallazgo especifico identificado todavia mas alla de este punto.

---

## RESUMEN SESION 05/07/2026 (continuacion 11) -- Primera cobertura de tests para el worker (vitest + lib.js)

Siguiente punto de la lista tras el fix de etiquetado coste/tokens del fallback GPT-4o
(commit 6f5dd3c, ver historial de este archivo en git). Auditoria (subagente): el worker
es un unico archivo de ~8.900 lineas sin router, sin package.json ni framework de test en
alejandra-agente/, y con la logica de auth (getAuth) anidada dentro de fetch() -- nada
exportable para testear de forma aislada. La unica "verificacion" existente hasta ahora
era un curl manual tras cada deploy.

### Corregido (commit 93d0d3a, CI 28739178252, health OK)
- Nuevo modulo `alejandra-agente/lib.js`: extrae las funciones puras (sin D1/KV/fetch) de
  mayor riesgo -- justo las tocadas en los fixes de seguridad de esta sesion:
  - `calcularCosteYProveedor` + `PRECIOS_USD` (el bug de coste/etiquetado del fallback
    GPT-4o arreglado en 6f5dd3c).
  - `extraerTablasQuery` / `validarScopeEmpresaBD` (fix IDOR de consultar_bd/escribir_bd:
    aislamiento por empresa_id).
  - `urlPermitidaTestEndpoint` (allowlist anti-SSRF de test_endpoint).
  - `filtrarToolsPorAuth` (gating de tools por sesion/dev verificado).
  - `esStatusReintentableAnthropic` / `calcularEsperaReintentoMs` (extraidas de
    fetchAnthropicConReintentos, para testear la decision de reintento sin mockear
    fetch/setTimeout reales).
- `worker.js` ahora importa todo esto de `./lib.js` en vez de definirlo inline. Cero
  cambio de comportamiento (verificado con node --check, diff revisado linea a linea, y
  `wrangler deploy --dry-run` confirma que el bundle resuelve el import correctamente).
- Nuevo `alejandra-agente/package.json` + `lib.test.js`: 37 tests con vitest, incluyendo
  regresion del bug de coste de gpt-4o, casos de mismatch de empresa_id (nucleo del fix
  IDOR), bypass de SSRF con subdominios falsos, y la logica de backoff/Retry-After.
- El `.gitignore` raiz ignora `package.json`/`package-lock.json` en todo el repo (regla
  ya existente) -- se anadio una excepcion explicita solo para `alejandra-agente/` para
  poder trackear estos dos archivos nuevos.
- El workflow de deploy (`deploy-alejandra-agente.yml`) ahora instala dependencias
  (`npm ci`) y corre `npm test` ANTES de aplicar migraciones D1 y desplegar -- si los
  tests fallan, el deploy no continua.

### Fuera de alcance (anotado, no bloqueante)
Esto cubre solo las funciones puras extraidas -- no hay tests de integracion de rutas
reales (`/api/chat`, auth, rate limit) ni cobertura de `getAuth`/D1/KV. Queda como mejora
futura usar `@cloudflare/vitest-pool-workers` para tests de integracion via SELF.fetch()
si se decide ampliar cobertura mas adelante.

Siguiente punto de la lista: **documentacion desactualizada de ALEJANDRA_AGENTE.txt**.

---

## RESUMEN SESION 05/07/2026 (continuacion 14) -- Modulo Planos Tecnicos SVG v7.56

### Lo que se hizo
Implementacion completa del modulo de generacion de planos tecnicos SVG via Claude Sonnet.

#### Backend (worker.js) -- commit 5f2b226
- 2 nuevas tools IA en AI_TOOLS: `generar_plano` y `listar_planos`
- 2 nuevos cases en executeAITool switch
- 5 nuevas rutas REST:
  - GET /planos (lista)
  - POST /planos/generar (genera via IA)
  - GET /planos/:id (detalle JSON)
  - GET /planos/:id/svg (SVG raw para visor/descarga)
  - DELETE /planos/:id
- 7 nuevas funciones: _ensurePlanosTable, _PLANO_PROMPTS, _generarPlanoInterno,
  listarPlanosREST, generarPlanoREST, getPlano, getPlanoSvg, eliminarPlano
- Registro automatico de uso de IA en tabla ai_usage
- Prompts de sistema especializados por tipo de plano:
  * planta: arquitectura con paredes, puertas, ventanas, cotas, norte, titulo
  * electrico: esquema IEC con simbolos SVG, colores de fase, bornes numerados
  * mecanico: vistas ortograficas, lineas de centro/ocultas, cotas DIN, BOM
  * gantt: diagrama de barras con fases coloreadas, progreso, hitos, linea HOY

#### Base de datos
- migrate_planos.sql creado y aplicado en produccion con --remote
- Tabla planos: id, empresa_id, usuario_id, tipo, titulo, descripcion, svg_data, metadatos, timestamps
- Indices por empresa_id y (empresa_id, tipo)

#### Versiones
- 7.55 -> 7.56 en version.json, sw.js, index.html

#### Deploy
- Worker desplegado: Version ID 2b46ccec-3fe2-42f7-899a-761bfd8390e5
- D1 migrado: 3 queries, 4 rows written, DB size 2.72 MB

### Pendiente (Parte B y C del modulo)
- panel.html: pagina "Planos" con visor SVG + filtros + boton generar + descarga PDF
- Editor de planos en el navegador (capa de edicion interactiva sobre el SVG)
- Exploracion de API DXF/CAD gratuita para exportacion vectorial avanzada

---

## RESUMEN SESION 05/07/2026 (continuacion 10) -- Fix Google OAuth + errores consola panel.html

### Problema inicial
El login Google OAuth en panel.html habia dejado de funcionar. Causa: se habia cambiado
de enfoque popup (commit 2e8b72d) a redirect completo (commit 81f8f1d). El redirect
requeria que init() detectara el nonce al volver de Google, pero init() estaba en linea
15007, despues de donde crasheaba el bloque 1 (PAGE_LOADERS con ReferenceErrors y
SyntaxErrors).

### Fixes aplicados en sesiones anteriores (aun vigentes)
- commit 4f087c1: corregir _ocData duplicado, NCR_GRAV_COLOR duplicado, tblOC duplicado, lazy wrapper cargarGlobalDashboard
- commit 4baadab: 86 lazy wrappers en PAGE_LOADERS, fix ternario sin else en cargarRendimientos, _cpData -> _cpgData
- commit e587c52: cache-bust CDN GitHub Pages

### Resultado: Google OAuth funciona (verificado en vivo: Adrian - Super Admin logueado)

### Errores de consola corregidos en este commit (942bde3) -- v7.55
1. HEAD /verificar 404: checkConexion() usaba HEAD en /verificar (solo acepta POST)
   -> Cambiado a GET /health (endpoint correcto que siempre devuelve 200)
2. POST /webhook/evento 405: navTo() mandaba fetch('/webhook/evento') con URL relativa
   -> Iba a GitHub Pages (sin API). Eliminado ese bloque -- el worker no tiene ese endpoint
3. SW Cache TypeError: sw.js intentaba cachear peticiones HEAD y POST (Cache API no lo permite)
   -> Ahora solo cachea peticiones GET
4. DevTools DEV_ENDPOINTS: ['HEAD', '/verificar'] -> ['GET', '/health']

### Archivos modificados
- panel.html: checkConexion + navTo + DevTools
- sw.js: solo cachear GET + CACHE = alejandra-v7.55
- version.json: 7.55
- index.html: APP_VERSION = '7.55'
