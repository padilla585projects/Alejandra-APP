================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 07/05/2026
**Versión tras última sesión:** v5.65 (worker e75da22b — watchdog autónomo en crons)
**Worker desplegado:** e75da22b ✅
**GitHub:** en sync ✅ — commit 3fd7241

---

## RESUMEN SESIÓN 07/05/2026 — v5.64 (auto-diagnóstico chat IA)

### Qué se hizo:

**v5.64 — Chat IA auto-recuperable:**
- **Timeout 25s** en `_callAI` (AbortController) — si Anthropic no responde en 25s el worker devuelve error legible en lugar de que Cloudflare corte la conexión a los 30s y deje el frontend colgado
- **Timeout 25s en frontend** (panel.html + index.html) — AbortController en el fetch del chat: mensaje ⏱️ amigable en lugar de spinner eterno
- **Auto-saneado de historial corrupto**: antes de cada llamada a Anthropic, si todos los mensajes del historial son del mismo rol → borra automáticamente + notifica por Telegram + guarda en memoria
- **Catch mejorado en worker**: distingue AbortError (timeout) de otros errores; ambos tipos se guardan en `alejandra_memoria` y los timeouts mandan alerta Telegram
- **Endpoint `/dev/ai-status`**: devuelve estado del historial (sano/corrupto), errores recientes de memoria, total memorias
- **Botón 🩺 Diagnóstico** en panel DevTools → Agente IA: muestra estado del chat en un alert, ofrece limpiar si detecta corrupción

### Estado final:
- Worker: 70134293 ✅
- GitHub: commit cf6a44b ✅
- Versión: v5.64

---

## RESUMEN SESIÓN 07/05/2026 — hotfix (agente no contestaba)

### Qué se hizo:

**Fix crítico — historial web corrupto:**
- Diagnóstico: `alejandra_historial` tenía 40 mensajes `rol='user'` y 0 `rol='assistant'`
- Causa: el INSERT del assistant se hacía sin `await` justo antes de `return json()` → el worker terminaba antes de que el INSERT completara
- Los mensajes de usuario sí se guardaban porque el INSERT se hacía ANTES del AI call (segundos de margen)
- Consecuencia: msgs array con solo user messages → Anthropic API rechaza (consecutive user messages inválido) → ciclo vicioso
- **Fix 1:** `await env.DB.prepare(...assistant INSERT...).run()` — espera confirmación antes de devolver respuesta
- **Fix 2:** Filtro de seguridad `rawHist.filter((m,i) => i===0 || m.role !== rawHist[i-1].role)` — elimina consecutivos del mismo rol al construir msgs
- **D1:** `DELETE FROM alejandra_historial WHERE canal='web'` — limpiados los 40 mensajes corruptos
- Worker desplegado: 8b48fb37

### Estado final:
- Worker: 8b48fb37 ✅
- GitHub: commit 732f16c ✅
- Historial: limpio, listo para empezar desde cero

---

## RESUMEN SESIÓN 07/05/2026 — continuación (v5.59→v5.63)

### Qué se hizo:

**v5.60 — Fixes IA chat (app + panel web):**
- navIABtn visible para superadmin en bottom nav
- Botón flotante 🤖 en panel.html: fix condición showAIBtn (usaba devNav.style.display que siempre era '')
- IA chat app: botón ← para cerrar + 🗑️ para borrar historial
- Historial IA persistente en localStorage (app y panel) — no se pierde al cerrar
- Fix getApiUrl → getAPI() (ReferenceError que rompía todo el IIFE de IA)
- Fix SyntaxError template literal en aiSend de panel.html (backticks perdidos)
- version.json: fix — no se copiaba al _site en pages.yml (banner nunca aparecía)
- pages.yml: auto-genera version.json desde APP_VERSION en index.html al hacer deploy

**v5.61 — Fix crons subrequests:**
- syncSheets/syncPedidos/syncRRHH distribuidos uno por cron (7am/18pm/23pm)
- Antes corrían todos juntos (>50 subrequests) → ahora cada slot tiene <35

**v5.62 — Retry rate limit frontend:**
- iaSend (app) y aiSend (panel): retry silencioso con historial reducido
  (40→10→4→0 mensajes) antes de mostrar cualquier error

**v5.63 — Alejandra aprende de errores:**
- devAIChat (worker): retry rate limit en el servidor con historial reducido
  + autoLearn automático al detectar el error (guarda en alejandra_memoria)
- System prompt: aprendizaje OBLIGATORIO tras cada tool use — memory_save es
  mandatorio (hecho/error/aprendizaje según el caso), no opcional

### Estado final:
- Worker: 50e260b ✅ (en deploy)
- GitHub: en sync ✅
- Versión: v5.63

---

## RESUMEN SESIÓN 07/05/2026 — completa (Alejandra autónoma v5.54→v5.58)

### Qué se hizo:

**v5.54 — Base autónoma:**
- Visión: read_suggestion_image + adjuntar imágenes en panel y Telegram
- Tavily: web_search real con answer sintetizada (TAVILY_API_KEY en secrets)
- propose_fix: stagea fix en D1 + Telegram [✅ Aplicar] [❌ Ignorar]
- fix_apply/fix_confirm: lógica de aplicar con commit a GitHub
- fix_revert: sustitución inversa new→old con commit revert
- runAutonomousReview: cron nocturno 23:00 UTC

**v5.55 — Seguridad horaria:**
- Cron review movido a 23:00 UTC (01:00 AM España) — fuera de horario obra
- fix_apply bloqueado 07:00-19:00 España → doble confirmación obligatoria
- fix_snooze: posponer para esta noche

**v5.56 — Trazabilidad:**
- _ejecutarFix: botón [↩️ Revertir] tras aplicar
- fix_revert callback: sustitución inversa automática
- System prompt: FLUJO OBLIGATORIO — leer archivo antes de proponer

**v5.57 — Control total:**
- Health check 90s post-deploy: auto-revert si el worker no responde
- Cron 07:00 UTC: recordatorio matutino si hay fixes pendientes > 12h
- Panel DevTools → sección Agente IA: tabla de fixes + toggle pausar/activar
- /parar, /activar, /estado_agente comandos Telegram
- isAgentePausado() bloquea cron review y propose_fix cuando pausado
- alejandra_config D1: key/value para estado del agente
- /health endpoint público para health checks
- /alejandra-fixes GET: historial de fixes (superadmin)
- /alejandra-agente-toggle POST: pausar/activar desde panel

**v5.58 — Reinicio:**
- /reiniciar comando Telegram: borra historial + reactiva
- /alejandra-agente-restart POST: mismo desde panel web
- Botón 🔄 Reiniciar en DevTools

### Estado final:
- Worker: 4184bb2 ✅
- D1: alejandra_config ✅, alejandra_fixes.commit_sha ✅
- GitHub: en sync ✅

---

## RESUMEN SESIÓN 07/05/2026 — tarde (Alejandra autónoma v5.54)

### Qué se hizo:

**Revisión y mejora del agente IA (v5.53 → v5.54):**
- max_tokens 8192, herramientas paralelas con Promise.all, SQL parametrizado en memory_read
- repo_read_file con paginación line_start/line_end + total_lines devuelto

**Búsqueda web real (Tavily):**
- web_search reemplaza DuckDuckGo por Tavily API (api.tavily.com/search, POST)
- Devuelve: answer sintetizada + lista de resultados title/url/content
- TAVILY_API_KEY subido a Cloudflare secrets

**Visión / análisis de imágenes:**
- read_suggestion_image: lee sugerencia de D1, descarga imagen de R2, devuelve array [{type:'text'},{type:'image',base64}]
- Panel web: botón 📎 en chat IA → preview de imagen → enviada como base64 al worker
- Telegram: fotos enviadas al bot → descargadas via Telegram API → pasadas como visión a Claude
- tool_result acepta array con imágenes (Anthropic API lo soporta nativamente)

**Alejandra autónoma con supervisión:**
- propose_fix: nueva tool → guarda fix en alejandra_fixes → envía Telegram con [✅ Aplicar] [❌ Ignorar]
- fix_apply callback: lee archivo GitHub, reemplaza old→new, commit automático, actualiza sugerencia
- fix_reject callback: marca fix como ignorado
- runAutonomousReview(): cron 07:00 UTC — lee sugerencias/errores/pendientes, lanza agente Claude
- sendTelegramConBotonesTo(): variante con chatId configurable
- CREATE TABLE alejandra_fixes en D1 (creada manualmente)

### Estado final:
- Worker: e34cf08 ✅ desplegado via GitHub Actions
- GitHub: en sync ✅
- D1: tabla alejandra_fixes creada ✅
- Cron 07:00 UTC: runAutonomousReview activo ✅

---

## RESUMEN SESIÓN 06/05/2026 — tarde (Alejandra IA v2 — repo, aprendizaje, UI chat)

### Qué se hizo:

**Fix GitHub Pages (build rota):**
- Build tipo `legacy` se quedaba colgada en 0ms — cambiado a `build_type: workflow`
- Creado `.github/workflows/pages.yml` — deploy automático en cada push (~30s)
- Solo sube frontend (index.html, panel.html, sw.js, iconos) — excluye worker.js

**Acceso al repo para Alejandra:**
- Tools nuevas: `repo_read_file`, `repo_list_dir`, `repo_write_file`
- GITHUB_TOKEN configurado como secret en el worker
- Creado `.github/workflows/deploy-worker.yml` — al modificar worker.js → auto-deploy a CF (~1min)
- CLOUDFLARE_API_TOKEN (AlejandraChat-IA) creado y guardado en GitHub Secrets

**Sistema de aprendizaje activo:**
- Tipos de memoria: `aprendizaje` + `error` (además de hecho/pendiente/contexto/aviso)
- `autoLearn()` — función que guarda automáticamente sin bloquear
- Auto-guardado: errores SQL, cambios SQL, archivos leídos, commits hechos/fallidos
- System prompt instruye aprendizaje activo: qué guardar y cuándo

**System prompt completo (`buildAlejandraSystemPrompt()`):**
- Función compartida entre Telegram y Web
- Incluye: infraestructura CF, estructura repo, archivos, CI/CD, módulos, schema DB, tools, reglas de aprendizaje

**UI del chat flotante (panel.html):**
- Botón ⛶ pantalla completa (toggle) + scroll automático al fondo
- Botón ⧉ ventana nueva — carga la conversación actual, sincroniza de vuelta al padre
- Si ya hay una ventana abierta, la enfoca en vez de crear otra
- Quitado mensaje de bienvenida largo

### Estado final:
- GitHub Pages: ✅ GitHub Actions
- Worker auto-deploy: ✅ al modificar worker.js
- Chat IA web: ✅ con pantalla completa, ventana nueva, sin intro
- Alejandra aprende: ✅ de errores, aciertos y código que lee
- Worker: 16e9ed5

---

## RESUMEN SESIÓN 06/05/2026 (v5.53 — Registro empresa desde web + wizard dept+submódulos + gestión usuarios)

- **FASE 1 (v5.51)**: Wizard registro empresa ampliado con departamentos expandibles + submódulos
- **FASE 2 (panel.html)**: Registro de empresa público desde login del panel web
- **FASE 3 (v5.52)**: Gestión completa de usuarios desde panel web
- **FASE 4 (v5.53)**: Config dept+submódulos desde panel web → sync con app
- Worker: e8e2ecb8 ✅  GitHub: en sync ✅

---

## AL INICIAR UNA SESIÓN — reemplaza esta sección con:

```
**Sesión:** EN CURSO
**Inicio:** DD/MM/YYYY HH:MM
**Trabajando en:** [qué se va a hacer]
**Basado en versión:** vX.XX
```

Y antes de tocar nada, ejecuta:
  1. git pull  (en esta carpeta — Alejandra APP)
  2. Leer ESTADO_APP.txt → sección HISTORIAL para ver últimos cambios
  3. Leer IDEAS_PENDIENTES.txt → para no duplicar trabajo

---

## AL TERMINAR UNA SESIÓN — reemplaza esta sección con:

```
**Sesión:** LIBRE
**Última sesión:** DD/MM/YYYY
**Versión tras última sesión:** vX.XX
**Worker desplegado:** vX.XX (ID: xxxxxxxx)
**GitHub:** en sync ✅ / PENDIENTE DE PUSH ⚠️
```

Y antes de cerrar, obligatorio:
  1. git add + git commit + git push
  2. Actualizar ESTADO_APP.txt (versión, fecha, changelog)
  3. Actualizar IDEAS_PENDIENTES.txt (marcar resueltos)
  4. Volver a poner este archivo en estado LIBRE con el resumen
