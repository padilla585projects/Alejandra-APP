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

### 2. Verificar encoding ANTES de commit

```powershell
# Buscar caracteres corruptos en archivos modificados
git diff -- "*.html" "*.js" | Select-String -Pattern "Ã|Â|â€|ï»¿"
# Si sale ALGO → PARAR. Hay corrupción de encoding. Ver sección "CODIFICACIÓN DE ARCHIVOS".
```

### 3. Commit y push

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

## CODIFICACIÓN DE ARCHIVOS (CRÍTICO — leer siempre)

> ⛔ **INCIDENTE 13/05/2026**: Los archivos `panel.html` y `worker.js` se corrompieron por guardarlos con codificación incorrecta. Costó horas arreglarlo. NUNCA debe volver a ocurrir.

### Reglas obligatorias:

1. **Todos los archivos del proyecto son UTF-8 SIN BOM.** No usar UTF-8 with BOM, no usar Latin-1, no usar Windows-1252.

2. **NUNCA abrir ni guardar archivos con un editor que no esté configurado en UTF-8.** Si usas Notepad, VS Code, Notepad++ u otro, verificar que la codificación sea UTF-8 (sin BOM) ANTES de guardar.

3. **Antes de hacer commit, verificar que no hay caracteres corruptos:**
   ```powershell
   # Verificación de encoding — ejecutar SIEMPRE antes de push
   git diff --staged -- "*.html" "*.js" | Select-String -Pattern "Ã|Â|â€|ï»¿"
   # Si devuelve ALGO → STOP. Los archivos están corruptos. NO hacer push.
   ```

4. **Caracteres válidos que SÍ deben aparecer en el código:**
   - Tildes: á, é, í, ó, ú, ñ, ü (en strings de texto español)
   - Emojis: 📊, 💬, 🏢, etc. (en UI)
   - Flechas/decoración: ──, →, ═ (en comentarios)
   - Em-dash: — (en comentarios descriptivos)

5. **Caracteres que NUNCA deben aparecer (indican corrupción):**
   - `Ã` seguido de otro carácter (ej: `Ã³`, `Ã±`, `Ã©`)
   - `Â` suelto (ej: `Â¿`, `Â©`)
   - `â€"`, `â€œ`, `â€™` (em-dash/comillas corruptas)
   - `ï»¿` (BOM corrupta)
   - `Ã¯Â»Â¿` (BOM triplemente corrupta)

6. **Si escribes archivos con PowerShell:**
   ```powershell
   # CORRECTO — UTF-8 sin BOM
   $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
   [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
   
   # INCORRECTO — Set-Content por defecto usa UTF-16 en Windows
   # INCORRECTO — Out-File por defecto añade BOM
   ```

7. **Si se detecta corrupción en un archivo ya commiteado:**
   - Restaurar la última versión limpia: `git show <commit_limpio>:<archivo> > <archivo>`
   - Reaplicar los cambios funcionales manualmente
   - Nunca intentar "arreglar" encoding in-place — siempre restaurar desde la fuente limpia

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

- **Versión:** v6.01
- **Fecha:** 18/05/2026
- **Worker:** desplegado ✅
- **GitHub:** en sync ✅ (ver SESION.md para commit exacto)
- **Últimas features:** Fix raíz encoding (TextDecoder), auto-logout en 401, alejandra-panel.html con Google OAuth

> Para el estado exacto y actualizado, leer `SESION.md` y `ESTADO_APP.txt`.
