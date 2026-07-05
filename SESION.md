## ESTADO ACTUAL

**Sesion:** LIBRE
**Ultima sesion:** 05/07/2026 -- Fix version desincronizada del agente (v6.03 cabecera vs
6.12 /health -> ambas ahora v6.13, commit a27d650 + doc a27d650/74f686e). Antes: reescritura
completa de ALEJANDRA_AGENTE.txt (commit 60ae56e, doc-only, sin deploy). Antes de eso: primera
cobertura de tests para alejandra-agente (lib.js + vitest, commit 93d0d3a). PWA panel: fix
errores consola + Google OAuth restaurado (commit 942bde3, ver seccion de abajo).
**Version actual:** App PWA **v7.55** -- commit 942bde3
**Agente (alejandra-agente):** commit a27d650 desplegado en main (deploy CI 28739993149,
health OK, /health ahora devuelve "6.13" -- version propia del agente, ver seccion de abajo).
Incluye tests automatizados (37 tests, vitest) que corren en el workflow
de deploy ANTES de aplicar migraciones/desplegar -- si fallan, no se despliega.
**Documentacion del agente (ALEJANDRA_AGENTE.txt):** reescrita commit 60ae56e, regla #3
actualizada en 74f686e tras el fix de version. Ver seccion de abajo.

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
