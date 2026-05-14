================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE — PHASE 1 Alejandra Independencia [PARCIALMENTE EN GITHUB]
**Fecha:** 14/05/2026 (continuación 3)
**Versión app:** v5.86 ✅ (Alejandra Agente integrada)
**Worker principal:** fa32ea52 ✅ (sin cambios)
**GitHub:** Estado mixto — ver detalles abajo
**GitHub Pages:** ✅ reactivado y funcionando

---

## ESTADO DE ARCHIVOS EN GITHUB (main branch)

### ✅ YA EN GITHUB (main):
- `version.json` = v5.86 ✅
- `sw.js` = alejandra-v5.86 ✅
- `alejandra-agente/worker.js` ✅ (stub worker con endpoints)
- `alejandra-agente/wrangler.toml` ✅
- `alejandra-agente/migrate_001_init_schema.sql` ✅
- `.github/workflows/deploy-alejandra-agente.yml` ✅

### ⚠️ EN RAMA claude/check-in-planning-Iu2jI (pendiente merge a main):
- `admin.html` ✅ (panel de control Alejandra Agente, 919 líneas, tema púrpura)

### ❌ SOLO EN LOCAL (pendiente push desde Windows):
- `index.html` con integración Alejandra (botón 🤖, panel, 3 funciones)
  - El archivo es 828KB, demasiado grande para MCP
  - El GitHub tiene versión v5.85 SIN integración Alejandra
- `ESTADO_APP.txt` con historial v5.86

---

## ACCIÓN NECESARIA DESDE WINDOWS

### Paso 1 — Merge rama al main:
```bash
git fetch origin
git checkout main
git merge origin/claude/check-in-planning-Iu2jI   # trae admin.html
```

### Paso 2 — Push local main a GitHub:
```bash
# Desde la carpeta Alejandra-APP en Windows:
git push origin main
```
Esto sube: index.html con botón 🤖, funciones alejandraAbrir/Enviar, y ESTADO_APP.txt

### Paso 3 — GitHub Actions automático:
Tras el push, el workflow `deploy-alejandra-agente.yml` se dispara:
- Despliega alejandra-agente.workers.dev ✅
- Crea tablas D1 con la migración ✅

### Paso 4 — Probar:
```bash
curl https://alejandra-agente.workers.dev/health
# Esperado: {"status":"ok","version":"v5.86"}
```

---

## PHASE 1 — QUÉ ESTÁ HECHO

**✅ Alejandra Agente Worker (`alejandra-agente/`):**
- Endpoints: `POST /api/chat`, `GET /api/admin/config`, `POST /api/admin/config`, `GET /api/admin/logs`, `GET /api/admin/memoria`
- D1 Schema: `chat_alejandra` (memoria), `alejandra_config` (modo), `alejandra_tokens`, `alejandra_logs`, `alejandra_memoria`, `alejandra_alert_cache`
- Chat memory: guarda últimos 500 mensajes con contexto
- Config: modo autonomo/confirmacion + auto_fix toggle + max_iterations
- Crons: 07:00 UTC dailyPulse, 23:00 UTC runAutonomousReview (stubs, Phase 2 los implementa)
- Token inicial: `admin_inicial_setup_alejandra_2026`

**✅ Admin Panel (`admin.html`):**
- Tema púrpura (#8b5cf6) para diferenciar de la app azul
- Dashboard: stats (mensajes, acciones, aprendizajes, modo)
- Config tab: modo autonomo/confirmacion, auto_fix toggle, max_iterations
- Chat tab: chat directo con Alejandra desde el panel
- Logs tab: tabla de audit logs con fecha/acción/estado
- Memory tab: tabla de aprendizajes y contexto de Alejandra
- Auth: `localStorage.alejandra_admin_token` + regen

**✅ Integración App Principal (`index.html` — en local/GitHub pendiente):**
- Botón 🤖 Alejandra en header (línea 590, visible según rol `desarrollador`)
- Panel chat separado: `alejandraPanel` (línea 649, borde púrpura)
- Funciones: `alejandraAbrir()`, `alejandraCargarContexto()`, `alejandraEnviar()`
- Endpoint: `https://alejandra-agente.workers.dev/api/chat`
- `_alejandraAñadirMensaje()` para UI de burbujas

**✅ CI/CD:**
- `.github/workflows/deploy-alejandra-agente.yml`
- Triggers en push a main con paths `alejandra-agente/**`
- Deploy automático a `alejandra-agente.workers.dev` en ~2 min

**✅ Versiones Sincronizadas:**
- version.json = 5.86 ✅
- sw.js cache = alejandra-v5.86 ✅
- index.html APP_VERSION = 5.86 ✅ (solo en local)

---

## PHASE 2 — PRÓXIMOS PASOS (cuando PHASE 1 esté desplegada y probada)

**Opción A — Continuar con worker separado (3 fases):**
1. Conectar `procesarConNEXUS()` a la API real de Anthropic
2. Portear 32 tools (sql_query, direct_fix, github_*, etc) al nuevo worker
3. Implementar runAutonomousReview() con loop LLM real (hasta 15 iteraciones)
4. Telegram bidireccional real, watchers, self-audit

**Opción B — Integrar en worker existente (1 fase, más rápido):**
1. Añadir endpoint `POST /api/alejandra-chat` al worker.js principal
2. Reusar los 32 tools ya existentes sin portearlos
3. Conectar admin.html y chat de la app al worker principal
4. Listo en 1 sesión, con toda la autonoma ya funcional

---

## CI/CD — ESTADO Y GUÍA DE RECUPERACIÓN

**Estado actual (14/05/2026): ✅ FUNCIONANDO**
- Token: `cfut_cLtW...` (creado 14/05/2026, sin expiración)
- Repo: **público** (sin límite de minutos Actions)
- Workflow: `deploy-worker.yml` con wrangler v4
- Cada push a `worker.js` o `wrangler.toml` → deploy automático en ~30s

### Si el CI/CD vuelve a fallar (Authentication error 10000):

**Paso 1 — Crear nuevo API Token en Cloudflare:**
1. Ir a: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Plantilla: **"Edit Cloudflare Workers"** → "Use template"
4. **Añadir permiso extra**: Account > D1 > Edit
5. Account Resources: `Padilla585.projects@gmail.com's Account`
6. **Sin fecha de expiración**
7. "Continue to summary" → "Create Token" → copiar token

**Paso 2 — Actualizar GitHub Secret:**
- Ir a https://github.com/padilla585projects/Alejandra-APP/settings/secrets/actions
- Editar `CLOUDFLARE_API_TOKEN` → pegar el nuevo token

### Deploy manual (si CI/CD no está disponible):
```powershell
$env:PATH = "D:\Descargas\node\node-v22.16.0-win-x64;$env:PATH"
cmd /c "npx wrangler deploy"
# Si el login ha expirado:
cmd /c "npx wrangler login"
```
