================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** EN CURSO
**Última sesión:** 25/05/2026
**Versión actual:** v6.01

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
