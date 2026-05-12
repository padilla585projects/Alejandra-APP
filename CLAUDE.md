# CLAUDE.md — Alejandra APP

Lee este archivo SIEMPRE al inicio de cada sesión. Es la guía de arranque para cualquier ordenador.

---

## ¿Qué es este proyecto?

**Alejandra APP** es una PWA de gestión industrial (bobinas, equipos, personal, fichajes, documentos, incidencias…) para empresas del sector eléctrico/mecánico. Tiene app móvil (`index.html`) y panel web de oficina (`panel.html`). El backend es un Cloudflare Worker (`worker.js`) con base de datos D1 (SQLite) y almacenamiento R2.

El agente IA integrado se llama **Alejandra** (Claude Sonnet via Anthropic API, con herramientas propias, cron nocturno, Telegram, self-audit y propose_fix).

---

## Infraestructura

| Recurso | Valor |
|---|---|
| GitHub | https://github.com/padilla585projects/Alejandra-APP (branch: `main`) |
| App móvil (Pages) | https://padilla585projects.github.io/Alejandra-APP/ |
| Worker API | https://alejandra-app-api.alejandra-app.workers.dev |
| D1 (BD) | `alejandra-db` — ID: `0c9eccde-78f1-476d-ac68-bf452bec0c62` |
| R2 (archivos) | `alejandra-app-files` |
| Cuenta Cloudflare | `padilla585.projects@gmail.com` — ID: `d65ead2b2967bf68ff3848a36cd7b1b4` |
| Node.js | v24.14.1 |
| Wrangler | v4.84.1 (autenticado, usa `wrangler.toml` automáticamente) |

> ⚠️ Credenciales en `NUEVA_CUENTA.txt` (local, en `.gitignore`, nunca commitear).

---

## AL INICIO DE CADA SESIÓN (obligatorio)

```powershell
# 1. Situarse en la carpeta correcta
cd "C:\Users\Adrian\Downloads\Alejandra APP\Alejandra APP"

# 2. Sincronizar con GitHub
git pull
git status        # debe decir "up to date with 'origin/main'"
git log --oneline -3

# 3. Leer el estado actual
# → SESION.md        (¿está LIBRE o EN CURSO?)
# → IDEAS_PENDIENTES.txt  (bugs y features pendientes)
# → ESTADO_APP.txt   (versión actual, historial, reglas)
```

Si `SESION.md` dice **EN CURSO**: otro chat está trabajando. Coordinarse antes de empezar.

**Actualizar `SESION.md` a EN CURSO** con fecha y qué se va a hacer antes de tocar código.

---

## AL FINAL DE CADA SESIÓN (obligatorio)

### 1. Verificar que las 3 versiones están sincronizadas ANTES del push

```powershell
$v  = (gc version.json | ConvertFrom-Json).v
$sw = [regex]::Match((gc sw.js -Raw), "alejandra-v([^']+)'").Groups[1].Value
$h  = [regex]::Match((gc index.html -Raw), "APP_VERSION = '([^']+)'").Groups[1].Value
if ($v -ne $sw -or $v -ne $h) { Write-Error "DESINCRONIZADO: json=$v sw=$sw html=$h" } else { Write-Host "OK: $v" }
```

> ⛔ Si no coinciden → **NO hacer push**. Corregirlo primero.
> Este error causó bucles de recarga infinita en producción (incidentes 22/04 y 26/04/2026).

### 2. Commit y push

```powershell
git add <archivos modificados>   # Nunca "git add -A" a ciegas
git commit -m "feat/fix: descripción — vX.XX"
git push
```

### 3. Actualizar los archivos de estado

- `version.json` → `{"v":"X.XX"}`
- `ESTADO_APP.txt` → añadir entrada en HISTORIAL DE VERSIONES
- `IDEAS_PENDIENTES.txt` → marcar resueltos con `[✓ HECHO vX.XX]`
- `SESION.md` → estado LIBRE + resumen de lo hecho

### 4. Si se tocó `worker.js` → desplegar

```powershell
npx wrangler deploy
# Verificar que el deploy incluye bindings DB y FILES
```

---

## Comandos útiles

```powershell
# Desplegar worker (siempre via wrangler.toml, NO --name manual)
npx wrangler deploy

# Ver deploys recientes
npx wrangler deployments list

# Consultar D1
npx wrangler d1 execute alejandra-db --command "SELECT * FROM bobinas LIMIT 5"

# Ver logs del worker en tiempo real
npx wrangler tail
```

---

## Reglas de código

- **Explicar el plan técnico y esperar confirmación del usuario ANTES de tocar código.**
- Subir versión en cada cambio funcional (incluso si solo cambia el frontend).
- Los 3 archivos de versión (`version.json`, `sw.js`, `index.html`) deben estar siempre sincronizados.
- Deploy del worker: siempre `npx wrangler deploy` (usa `wrangler.toml` → nombre `alejandra-app-api`).
- La app vieja (`Bobinaap` en GitHub) está **CONGELADA**. No tocar, no deployar.

---

## Arquitectura de archivos

| Archivo | Qué es |
|---|---|
| `index.html` | App móvil PWA (toda la lógica frontend en un solo archivo) |
| `panel.html` | Panel web de oficina |
| `worker.js` | Backend Cloudflare Worker (API REST + agente IA Alejandra + crons) |
| `sw.js` | Service Worker (caché offline, push notifications) |
| `version.json` | `{"v":"X.XX"}` — versión actual (debe coincidir con sw.js e index.html) |
| `wrangler.toml` | Config Cloudflare (bindings D1 y R2) |
| `schema_completo.sql` | Schema completo de la BD (referencia) |
| `migrate_*.sql` | Migraciones aplicadas manualmente en D1 |
| `SESION.md` | Estado de la sesión activa (LIBRE / EN CURSO) |
| `ESTADO_APP.txt` | Historial completo de versiones, reglas, infraestructura |
| `IDEAS_PENDIENTES.txt` | Bugs y features pendientes (fuente de verdad para el backlog) |

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| `superadmin` | Todo. Elige empresa + obra + departamento. |
| `empresa_admin` | Su empresa completa. Elige obra + departamento. |
| `encargado` | Su departamento. Obra fija asignada. Código de obra. |
| `operario` | Solo lectura/scan. Obra fija. Código de obra. |
| `jefe_de_obra` | Panel web. Equivale a encargado desde oficina. |
| `oficina` | Panel web. Vista ampliada + puede añadir/editar. |
| `desarrollador` | Acceso a DevTools IA (Alejandra) + push notifications. Solo Adrian. |

---

## Estado actual (última sesión conocida)

- **Versión:** v5.77
- **Fecha:** 12/05/2026
- **Worker:** b44c8a24 ✅ desplegado
- **GitHub:** en sync ✅ (commit 6afdeb0)
- **Últimas features:** Alejandra autonomía Nivel B — direct_fix, run_migration, grep_code, check_deploy_status, CI/CD auto-deploy funcionando

> Para el estado exacto y actualizado, leer `SESION.md` y `ESTADO_APP.txt`.
