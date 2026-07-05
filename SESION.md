## ESTADO ACTUAL

**Sesion:** LIBRE
**Ultima sesion:** 05/07/2026 -- Modulo de Planos Tecnicos (v7.56, commit 5f2b226).
**Version actual:** App PWA **v7.56** -- commit 5f2b226
**Agente (alejandra-agente):** commit 8aad793 desplegado en main (interruptor dev-bypass
rate-limit/empresa_id, solo desarrollador -- ver continuacion 16 abajo). Incluye tests
automatizados (57 tests, vitest) que corren en el workflow de deploy ANTES de aplicar
migraciones/desplegar -- si fallan, no se despliega.
**Worker raiz + panel.html ("Alejandra Office"):** commit c81c59d -- endpoint
`/alejandra-agente-dev-bypass` y UI de toggles en DevTools (ver continuacion 16).
**App Flutter (alejandra-ia):** commit 014508b -- UI de dev-bypass en Ajustes, visible
solo con rol `desarrollador` (ver continuacion 16).
**Documentacion del agente (ALEJANDRA_AGENTE.txt):** reescrita commit 60ae56e, regla #3
actualizada en 74f686e tras el fix de version, seccion de gating actualizada en e7134e3
tras el fix de configurar_alerta/exportar_datos, y nueva subseccion "INTERRUPTOR
DEV-BYPASS" anadida en continuacion 16. Ver seccion de abajo.

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
