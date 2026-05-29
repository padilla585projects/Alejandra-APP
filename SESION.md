================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 29/05/2026
**Versión actual:** v6.04

---

## RESUMEN SESIÓN 29/05/2026 (3ª) — v6.04 (Gemini + catálogos de fabricantes)

### Qué se hizo:

**Integración Gemini en agente (alejandra-agente/worker.js):**
- callGemini() con rotación de 3 API keys y fallback de modelos (2.0-flash → 1.5-flash-002 → 1.5-flash).
- Nueva tool analizar_archivo: lee Excel, PDF grande, HEIC, CAD vía Gemini.
- Nueva tool buscar_google: Google Search grounding vía Gemini.
- Handlers ejecutarTool para ambas tools.
- PDFs >4.5MB y Excel se leen automáticamente con Gemini en el chat.
- GEMINI_API_KEY_2 y _3 configuradas como secrets en worker agente.

**Alejandra como ingeniera con catálogos:**
- System prompt base ampliado: marcas habituales del sector (Pemsa, Schneider, Prysmian, ABB, etc.).
- Protocolo de material: si no conoce un producto, busca catálogo del fabricante automáticamente con buscar_google antes de responder. Si no encuentra, pregunta al usuario.
- Prompt ingeniería actualizado: buscar_google y analizar_archivo como herramientas, protocolo de datos reales de fabricante.
- Guarda en memoria productos nuevos para futuras consultas.

### Pruebas realizadas (desde Claude Code):
- buscar_google: precio del cobre ✅, normativa REBT 2026 ✅
- ingeniería + catálogos: curva 90° bandeja Pemsa Megaband ✅, magnetotérmico Schneider GV3P32 para motor 15kW ✅
- NEXUS routing correcto: web para búsquedas, ingenieria para cálculos ✅

### Deploy:
- GitHub: d65cf65 → push main ✅
- Worker agente: 7be72edc ✅ (D1 + R2 + 3 Gemini keys)

### Pendiente:
- Probar en Android real: fix back + plan ejecutable + chat con archivos
- Probar upload de Excel y PDF grande desde la PWA (verificar lectura Gemini)

---

## RESUMEN SESIÓN 29/05/2026 — v6.03 (Sync estado + bump PWA)

### Contexto:
- El 28/05 se hicieron cambios desde OTRO ordenador (commits hasta v6.03) que no
  quedaron reflejados en los archivos de estado.
- Al hacer `git pull` se trajeron 9 commits (v5.98 → v6.03) del worker del agente.

### Qué se hizo:
- **Bump app PWA a v6.03** (version.json, sw.js, index.html sincronizados ✅).
  Motivo: el commit `4757e1b` añadió upload de archivos en index.html pero NO subió
  APP_VERSION → la caché del service worker (alejandra-v6.02) no se invalidaba y los
  usuarios PWA no recibían la feature. El bump fuerza el refresco de caché.
- Actualizado SESION.md y ESTADO_APP.txt para reflejar el estado real.

### Estado del deploy (verificado):
- **Worker del agente** (`alejandra-agente`): v6.03 desplegado ✅
  (versión 3d812eab, 2026-05-28 22:53 UTC — auto-deploy CI/CD tras el commit).
- **Worker principal** (`alejandra-app-api`): sin cambios en este lote, no requería redeploy.

### Cambios traídos en el pull (worker del agente, hechos el 28/05 desde otro PC):
- v6.03: fotos en obra — HEIC/HEIF/AVIF, límite 30MB, fix límite Claude 3.7MB, fallback Gemini
- v6.02: optimización tokens — DOM lazy + historial 10→6 + memoria solo expertos
- v6.01: panel envía DOM compacto → selectores reales en `<plan>`
- v6.00: panel acepta `<plan>` ejecutable (Alejandra toma control con consentimiento)
- v5.99: conciencia de rol/pantalla + modo guía interactivo
- v5.98: auto-resumen conversaciones largas + prompt caching + razonamiento
- + aprendizaje proactivo, fix schema alejandra_memoria, upload archivos multicanal

### Pendiente:
- Revisar permisos de usuarios en Alejandra Office (arrastrado de sesiones previas)
- Probar la feature de upload de archivos en PWA tras el refresco de caché

---

## RESUMEN SESIÓN 29/05/2026 (2ª) — v6.04 (Fix back + PDFs + esquema BD + plan ejecutable PWA + Gemini)

### Qué se hizo:

**Fase 1 — Bug navegación (index.html):**
- El chat de Alejandra (alejandraPanel) no se integraba con el historial del navegador.
  El botón atrás físico de Android no cerraba el chat → rompía la app.
- Fix: popstate handler detecta si el panel está abierto y lo cierra. alejandraAbrir()
  empuja estado al historial para capturar el back.

**Fase 2 — Leer documentos (alejandra-agente/worker.js):**
- PDF: soporte nativo Claude (document content block base64, hasta 4.5MB).
- Detección por extensión: .csv→text/csv, .txt→text/plain, .json→application/json,
  .xlsx/.xls→MIME correcto (antes caían como octet-stream y no se leían).
- Excel: mensaje informativo con sugerencia de exportar a CSV o usar ver_archivo.

**Fase 3 — Permisos y acceso (worker.js + index.html):**
- Nueva tool ver_esquema_bd: Alejandra ve todas las tablas y columnas de la BD D1.
- TOOL_ANALIZAR_FOTO + ver_esquema_bd añadidas a expertos app, tecnico y completo.
- La app móvil ahora envía rol, pantalla y dom_actual (DOM compacto, 40 elementos) al worker.

**Fase 4 — Alejandra toma el control (worker.js + index.html):**
- Worker: <plan> habilitado para canal PWA (antes solo Panel web).
- App: parser de <plan> y <guia> en respuestas, strip del bloque antes de mostrar texto.
- Modal de confirmación (Cancelar / Adelante, hazlo) con lista de acciones.
- Ejecución secuencial con overlay de progreso, highlight visual (box-shadow púrpura),
  botón de cancelar en tiempo real.
- Tipos de acción: navegar, click, rellenar, seleccionar, esperar, scroll.
- <guia> paso a paso (visual, no ejecuta) para instrucciones.

**Fase 5 — Integración Gemini (alejandra-agente/worker.js):**
- callGemini() con rotación de 3 API keys y fallback de modelos (2.0-flash → 1.5-flash-002 → 1.5-flash).
- Nueva tool analizar_archivo: lee Excel, PDF grande, HEIC, CAD vía Gemini.
- Nueva tool buscar_google: Google Search grounding vía Gemini.
- PDFs >4.5MB se leen automáticamente con Gemini (fallback tras límite Claude).
- Excel se lee automáticamente con Gemini en el chat (antes solo sugería exportar CSV).
- GEMINI_API_KEY_2 y _3 configuradas como secrets en worker agente.
- Ambas tools añadidas a todos los expertos relevantes en TOOLS_POR_EXPERTO.

### Archivos modificados:
- alejandra-agente/worker.js — PDF, extensiones, ver_esquema_bd, tools ampliadas, <plan> PWA, Gemini
- index.html — fix back, enviar contexto, plan ejecutable, guía, bump v6.04
- sw.js — CACHE alejandra-v6.04
- version.json — 6.04

### Deploy:
- GitHub: 2a087b2 → push main ✅
- Worker agente: 6ff77e59 ✅ (D1 + R2 bindings + 3 Gemini keys)
- Worker principal: sin cambios, no requiere redeploy

### Pendiente:
- Probar en Android real: fix back + plan ejecutable
- Probar upload de PDF y Excel en el chat (verificar lectura Gemini)
- Probar búsqueda Google desde Alejandra

---

## RESUMEN SESIÓN 27/05/2026 (2ª) — v6.02 (Rotación keys Gemini)

### Qué se hizo:
- Nueva función `callGemini()` con rotación automática de 3 API keys
- Si una key da 429 (cuota agotada), prueba la siguiente antes de fallar
- Aplicado en scan-parte, scan-bobinas y OCR de matrículas
- 3 keys configuradas: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3

### Deploy:
- Worker: ef48ca08 ✅
- GitHub: 84d8005 → push main ✅

### Pendiente:
- Revisar permisos de usuarios en Alejandra Office
- Probar escaneo de parte con las nuevas keys

---

## RESUMEN SESIÓN 27/05/2026 — v6.02 (Scan parte multi-imagen + filtro empresas)

### Qué se hizo:

**Scan parte/fichajes — reescritura completa (worker + index.html + panel.html):**
- Worker `scanParte`: prompt mejorado para partes manuscritos con columna EMPRESA, extrae todos los trabajadores con su empresa, multi-imagen hasta 5, chunked base64
- Frontend: multi-archivo con previews + botón eliminar, compresión Canvas (2000px, JPEG 85%), obra automática desde sesión con fallback selector
- Nuevo paso intermedio: modal de selección de empresas detectadas (checkboxes), pre-selecciona la empresa del usuario, solo las seleccionadas pasan a revisión
- Etiqueta azul con empresa visible en tabla de revisión

**Scan bobinas (terminado en sesión anterior, corregido aquí):**
- panel.html: corregidas referencias a `spObra` → `SESSION?.obra_id || spObraSel`
- panel.html: export `spPreviewFile` → `spPreviewFiles`

**Crons Cloudflare:**
- Worker viejo `alejandra-worker` tenía 2 crons ocupando el límite de 5 → eliminados vía API
- Deploy ahora funciona sin error 10072, los 3 crons activos (7:00, 18:00, 23:00 UTC)

### Archivos modificados:
- `worker.js` — scanParte prompt + empresa_parte + empresa_nombre en respuesta
- `index.html` — scan parte reescrito (multi-imagen, empresas, auto obra)
- `panel.html` — scan parte corregido (obra, exports, empresas)

### Deploy:
- Worker: Version 33f8a284 ✅ (3 crons activos)
- GitHub: commit 316004a → push main ✅

### Pendiente:
- Revisar permisos de usuarios en Alejandra Office (mencionado pero no abordado)
- Revisar IDEAS_PENDIENTES.txt para próximos bugs/features

---

## RESUMEN SESIÓN 25/05/2026 — v6.02 (Auditoría completa + fixes)

### Qué se hizo:

**Auditoría completa de Alejandra APP y Alejandra Office:**
- Revisión exhaustiva de worker.js (120+ endpoints), index.html, panel.html, admin.html, alejandra-panel.html, sw.js, manifest.json, schema, agente

**Bugs corregidos:**
- sw.js: rutas de iconos push rotas → `/icon-192.png` (antes apuntaban a `/icons/` que no existe)
- manifest.json: iconos apuntaban al SVG → ahora usan PNGs reales, añadido id/lang/categories/maskable separado
- agente/worker.js: conflicto alejandra_config renombrada a agente_config (schemas incompatibles en la misma D1)
- migrate_003: token hardcodeado 'alejandra2026' eliminado del repo público y rotado en D1
- worker.js: comentario cabecera v5.85 → v6.01

**Mejoras aplicadas:**
- wrangler.toml: compatibility_date 2024 → 2025
- PLAN_PANEL_WEB.md: fases marcadas como [✅ IMPLEMENTADO]
- CLAUDE.md: versión actualizada + sección de dónde buscar credenciales desde otro ordenador
- 20 índices nuevos aplicados en D1 (bobinas, pemp, carretillas, sesiones, usuarios, obras, historial, inventario_seg)
- .env.example creado con los 19 secrets documentados
- schema_completo.sql: nota de desactualización añadida

**Limpieza:**
- query_alberto.js, query_alberto2.js, query_schema.js eliminados

**Token agente rotado:**
- 'alejandra2026' eliminado de D1 y del repo
- Nuevo token (64 chars) en NUEVA_CUENTA.txt y backup en GitHub Secret AGENTE_ADMIN_TOKEN

**Bump:** v6.01 → v6.02 (sw.js, index.html, version.json sincronizados ✅)
**Worker desplegado:** ✅ (error crons 10072 conocido, no afecta)
**GitHub:** ✅ commits f27437a → 31b1dd6

---

## RESUMEN SESIÓN 18/05/2026 — v6.01 (Fix encoding raíz + auto-logout 401 + verificaciones)

### Qué se hizo:

**Fix raíz encoding (v6.00 — worker.js):**
- `atob()` en `repo_read_file` y `direct_fix` devuelve binary string → doble-encoding al re-subir
- Fix: `TextDecoder('utf-8')` convierte bytes a Unicode correcto antes de operar
- Este era el bug que causó semanas de corrupción con caracteres Ã

**Auto-logout en 401 (v6.01 — index.html):**
- Antes: sesión caducada → "Error al cargar empresas" sin explicación
- Ahora: 401 → limpia localStorage + aviso + recarga automática al login
- Aplica en `apiCall` y `apiCallRaw`

**Archivos temporales creados (pueden eliminarse):**
- `D:\Descargas\Alejandra APP\query_alberto.js`
- `D:\Descargas\Alejandra APP\query_alberto2.js`
- `D:\Descargas\Alejandra APP\query_schema.js`

**Verificaciones:**
- App en producción: ✅ v6.01 cargando correctamente (CPD Getafe)
- Login Google en alejandra-panel.html: ✅ funciona
- Login Google en panel.html para Alberto Martínez: ✅ listo (email amartinezc@levitec.es coincide con Google)

### Pendiente:
- Limpiar archivos temporales query_*.js

---

### Qué se hizo:

**Fix raíz del bug de encoding que causó semanas de corrupción:**
- Diagnóstico: `atob()` devuelve binary string (cada byte = 1 char). Al re-codificar con
  `btoa(unescape(encodeURIComponent(...)))`, cada byte se trataba como codepoint Unicode
  y se volvía a encodificar en UTF-8 → doble-encoding → caracteres `Ã` en toda la app.
- Afectaba a DOS sitios en worker.js:
  - `repo_read_file`: la IA veía el contenido corrupto (Ã¡ en vez de á)
  - `direct_fix`: cada patch que tocaba un archivo con acentos corrompía el resto del archivo
- Fix: `TextDecoder('utf-8')` convierte los bytes a Unicode correcto antes de operar.
  El re-encoding `btoa(unescape(encodeURIComponent()))` ya funciona bien sobre Unicode.
- `repo_write_file` no tenía el bug (recibe contenido directo del LLM, no de atob).

### Archivos modificados:
- `worker.js` — fix TextDecoder en repo_read_file y direct_fix (commit 32e142c) + bump v6.00
- `sw.js` — CACHE `alejandra-v6.00`
- `index.html` — APP_VERSION `6.00`
- `version.json` — `{"v":"6.00"}`

### Deploy:
- Worker desplegado: `npx wrangler deploy` ✅ (error crons 10072 conocido, no afecta)
- Push a GitHub main ✅

### Pendiente:
- Probar login con Google en `alejandra-panel.html`

---

## RESUMEN SESIÓN 17/05/2026 — v5.99 (Fix encoding worker.js — 82 sustituciones)

### Qué se hizo:

**Fix encoding worker.js (82 sustituciones):**
- 14 patrones únicos de corrupción identificados y corregidos:
  - 26x `Ã\x93` → Ó (CORRUPCIÓN, GESTIÓN, RECUPERACIÓN, etc.)
  - 19x `Ã\x9A` → Ú (Último, Úsalo, etc.)
  - 9x `Ã\x82·` → · (separadores punto medio en Telegram)
  - 7x `ÃÅ¡` → Ú (triple-encoding residual: ÃÅ¡ltima → Última)
  - 4x `Ã\x82º` → º (Nº Albarán, etc.)
  - 3x `Ã\x83"` → Ó (triple-encoding via cp1252 0x93 normalizado a ASCII `"`)
  - Y más: É, Ñ, ¡, ¿, €, …, •, ×
- 12 líneas restantes con Ã son **intencionales** (ejemplos en descripción de tool `check_encoding` y system prompt)
- Script `fix_worker.js` + `fix_worker2.js` → `worker.fixed.js` → reemplazó `worker.js`
- Sintaxis validada: `node --check` ✅

**Bump a v5.99** (version.json, sw.js, index.html en sync ✅)

### Archivos modificados:
- `worker.js` — fix encoding 82 sustituciones + bump v5.99
- `sw.js` — CACHE `alejandra-v5.99`
- `index.html` — APP_VERSION `5.99`
- `version.json` — `{"v":"5.99"}`

### Deploy:
- Commit: 94035b6 — pusheado a GitHub main
- Worker desplegado: Version ID 80cc82c6 (13:23:39 UTC)
- Error crons (10072): límite 5 crons plan free — **no afecta**, crons existentes siguen activos

### Archivos temporales (pueden eliminarse):
- `fix_worker.js`, `fix_worker2.js`, `worker.fixed.js`, `fix_index2.js`, `index.fixed.html`

### Pendiente:
- Probar login con Google en `alejandra-panel.html` (frontend completo, backend listo)
- Limpiar archivos temporales de encoding

---

## RESUMEN SESIÓN 17/05/2026 — v5.98 (Fix encoding + layout + PWA icons)

### Qué se hizo:

**Fix encoding completo index.html (10,728 sustituciones):**
- Nuevo patrón de corrupción distinto a las capas anteriores:
  - Lead bytes 0xC2-0xF4 → almacenados como Latin-1 U+(byte)
  - Continuation bytes → Â (U+00C2) + carácter cp1252/Latin-1 (Patrón A)
  - Última continuation en algunos casos directa sin Â (Patrón B)
- Script `fix_index2.js`: detecta ambos patrones. 0 líneas corruptas restantes.
- Emojis tab bar (📷, ⚡, ↻, 📡, 💡, 🏢, 🙈…), em-dashes, flechas, ✓, ❌ todos correctos.

**Fix sw.js comments (3 líneas):**
- `estÃ¡` → `está`
- `â€"` → `—`
- `â"€â"€` → `──`

**Bump a v5.98** (version.json, sw.js, index.html en sync ✅)

### Error al cargar empresas:
- Causa: token de sesión caducado en D1. Solución: Ajustes → Cerrar Sesión → volver a iniciar sesión.
- El worker y D1 funcionan correctamente.

### Archivos modificados:
- `index.html` — fix encoding 10,728 sustituciones
- `sw.js` — fix 3 comentarios corruptos
- `version.json` — v5.98

### Fix screenIA layout:
- `#screenIA` estaba después de `#bottomNav` en el DOM → nav aparecía arriba en vez de abajo
- Movido antes del nav + CSS cambiado de `height:100%` a `flex:1`

### Fix PWA icons:
- Creado `icon.svg` con el logo de la app (faltaba, causaba 404 en manifest)
- Añadido `<meta name="mobile-web-app-capable">` (el apple-* estaba deprecated)

### Archivos temporales (pueden eliminarse):
- `fix_index2.js`, `index.fixed.html`

### Deploy:
- Commits: 7d94145, dcdcf11, 4cc7e3a, 91962bc — pusheados a GitHub main
- Worker NO modificado → no se necesita redeploy

### Pendiente:
- worker.js tiene ~79 líneas con patrón Ã en código no-comentario (prompt Alejandra y strings API) — fix encoding pendiente
- Probar login con Google en alejandra-panel.html

---

## RESUMEN SESIÓN 16/05/2026 — v5.97 (Fix encoding index.html + splash + scan-parte)

### Qué se hizo:

**Fix encoding doble en index.html (11.855 sustituciones):**
- index.html tenía doble-corrupción UTF-8 (ÃƒÂX → á/é/ó/ñ…)
- Patrón alternativo para Ó/Ñ/Ú/× (Latin-1 primera capa, cp1252 segunda)
- Splash screen: "GESTIÓN DE OBRA" y "Adrián Padilla" ahora correctos
- Script `fix_index.js` aplicado → v5.96

**Fix splash congelado (stuck on logo):**
- sw.js tenía BOM (EF BB BF) al inicio → eliminado
- Comentarios corruptos en sw.js corregidos
- Bump a v5.97 para forzar ciclo de actualización del service worker

**Fix scan-parte (escaneo fichajes con IA):**
- Causa: `GEMINI_API_KEY` no estaba configurada como secret en Cloudflare → subida
- Modelo: `gemini-2.0-flash` → `gemini-2.0-flash-001`
- Prompt: `ÚNICAMENTE` estaba corrupto → corregido
- v5.96 desplegada con `npx wrangler deploy`

### Archivos modificados:
- `worker.js` — fix scan-parte (v5.96)
- `index.html` — fix encoding doble 11.855 sust. (v5.96 → v5.97)
- `sw.js` — eliminado BOM, fix comentarios (v5.97)
- `version.json` — v5.97

### Pendiente:
- Probar login con Google en panel (Alejandra lo añadió: `alejandra-panel.html`)
- Verificar que splash carga correctamente tras limpiar caché en móvil
- Limpiar archivos temporales si quedan (fix_index.js, etc.)

---

## RESUMEN SESIÓN 16/05/2026 — v5.95 (Fix triple-encoding Telegram)

### Qué se hizo:

**Fix triple-encoding en strings Telegram (211 ocurrencias):**
- Diagnóstico: tras el fix v5.94 (22,810 sustituciones doble-encoding), quedaban 29 líneas Telegram con triple-encoding residual
- Patrón: emojis F0 9F XX YY donde XX=9F→Ÿ(U+0178) se triple-codificaba a Å+¸ (bytes UTF-8 C5 B8 tratados como Latin-1)
- También C1 controls (C2+0x80-0x9F) se dividían en sus bytes UTF-8 individuales
- Script `fix_triple.js` con `corruptOfTriple()`: aplica corrupción cp1252, luego divide chars C5-xx y C2-0x80-9F
- Bug crítico: regex de normalización `/"|"/g` usaba comillas ASCII en vez de U+201C/U+201D → tabla sin match. Corregido.
- 211 ocurrencias corregidas (📦, 📖, 🚜, 🏗, 🗑, 🏷️, 👤, ✅, ⚠️, etc.)
- 0 líneas con triple-encoding restantes
- worker.fixed.js validado (node --check), reemplazó worker.js

### Archivos modificados:
- `worker.js` — fix triple-encoding (211 sustituciones adicionales)
- `version.json`, `sw.js`, `index.html` — bump a v5.95

### Deploy:
- Commit: da4400c — pusheado a GitHub main
- Worker desplegado: Version ID 40266843-1613-41cd-b018-69dd9f79951f

### Pendiente:
- Limpiar archivos temporales: fix_triple.js, worker.fixed.js, fix_encoding.js

---

## RESUMEN SESIÓN 16/05/2026 — v5.81→v5.94 (Fix encoding Telegram)

### Qué se hizo:

**Fix corrupción UTF-8 en mensajes Telegram:**
- Diagnóstico: worker.js tenía corrupción cp1252 double-encoding en emojis y acentos de mensajes Telegram
- Raíz: el archivo fue leído como Windows-1252 y re-guardado como UTF-8, con normalización adicional de 0x93→" y 0x94→" a ASCII "
- El archivo tenía mezcla de strings correctos e incorrectos (no se podía hacer fix byte-level)
- Solución: script `fix_encoding.js` con sustitución pura de strings usando `corruptOf()` para calcular la forma corrupta exacta de cada carácter
- 677 ocurrencias corregidas (acentos, emojis, em-dash, ✅, ❌, ✨, 🟢, 🟠, etc.)
- worker.fixed.js generado, validado (node --check), reemplazó worker.js
- 0 issues de corrupción restantes tras el fix

### Archivos modificados:
- `worker.js` — fix encoding (677 sustituciones)
- `version.json`, `sw.js`, `index.html` — bump a v5.81

### Pendiente:
- Deploy del worker con `npx wrangler deploy`
- Limpiar archivos temporales: fix_encoding.js, check_codepoints.js, worker.fixed.js

---

## RESUMEN SESIÓN 12/05/2026 — v5.77 (Alejandra como ingeniero autónomo)

### Qué se hizo:

**Infraestructura CI/CD:**
- `git pull` al inicio para sincronizar archivos locales con el repo
- Creado `.github/workflows/deploy-worker.yml`: cada push a `worker.js` o `wrangler.toml` → GitHub Actions ejecuta `wrangler deploy` → Cloudflare actualizado en ~1 min (¡esto faltaba desde siempre!)
- GitHub Secrets configurados automáticamente: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` añadidos al repo via gh CLI
- Worker desplegado localmente con `npx wrangler deploy` tras confirmar que el token `cfut_` es válido

**4 tools nuevas de ingeniería en Alejandra:**
- `grep_code(path, pattern, context_lines?)`: busca texto/regex en archivos sin leerlos entero. Esencial para worker.js de 9000+ líneas
- `direct_fix(descripcion, archivo, old_code, new_code, razon)`: aplica patch quirúrgico INMEDIATAMENTE sin esperar aprobación. Hace commit en GitHub, CI/CD despliega. Notifica a Adrián después con [↩️ Revertir]
- `run_migration(sql, descripcion?)`: ejecuta SQL DDL directamente en D1 (CREATE TABLE IF NOT EXISTS, ALTER TABLE, etc.) — ya no necesita wrangler CLI
- `check_deploy_status()`: consulta GitHub Actions API — estado del último deploy, si falló y por qué
