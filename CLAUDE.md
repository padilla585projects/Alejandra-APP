# CLAUDE.md — Alejandra APP

Guía de arranque para cualquier IA o desarrollador que abra este repositorio.

> ⛔ **Este archivo NO es la fuente de verdad del proyecto.** Es un índice de arranque y una
> referencia técnica de la aplicación existente. La fuente de verdad es la documentación
> versionada descrita abajo. Ante cualquier contradicción entre este archivo y
> `ARCHITECT_RULES.md` / `AGENTS.md` / `MASTER_PLAN.md`, **prevalece la documentación oficial**.

---

## Lectura obligatoria antes de trabajar

Este es el orden de arranque vigente (sustituye al flujo de sesión anterior):

1. `START_HERE.md` — punto de entrada y siguiente paso aprobado
2. `PROJECT_STATE.md` — estado real del proyecto
3. `MASTER_PLAN.md` — visión y principios
4. `MASTER_ROADMAP.md` — fases, dependencias y orden de ejecución
5. `ARCHITECT_RULES.md` y `AGENTS.md` — reglas obligatorias de contribución
6. `ARCHITECT_BACKLOG.md` — riesgos, deuda y decisiones pendientes
7. `HANDOFF.md` y `TASKS.md` — relevo y cola operativa inmediata
8. `docs/decisions/` — ADRs (decisiones oficiales)

Jerarquía documental aprobada: **Master Plan → Master Roadmap → ADR → arquitectura/normas → código.**
Si aparece una contradicción, se detiene el cambio y se resuelve mediante ADR.

### Documentos históricos (NO son estado actual)

`SESION.md`, `ESTADO_APP.txt` e `IDEAS_PENDIENTES.txt` están **archivados de consulta**.
Conservan historial valioso de versiones, incidentes y bugs, pero **no deben usarse como
estado, backlog ni fuente de verdad**. No hace falta actualizarlos.
Ver `docs/DOCUMENTATION-REGISTER.md`.

---

## ¿Qué es este proyecto?

**Alejandra APP** es una PWA de gestión industrial (bobinas, equipos, personal, fichajes,
documentos, incidencias…) para empresas del sector eléctrico/mecánico. Tiene app móvil
(`index.html`) y panel web de oficina (`panel.html`). El backend es un Cloudflare Worker
(`worker.js`) con base de datos D1 (SQLite) y almacenamiento R2.

El agente IA integrado se llama **Alejandra** (Claude via Anthropic API, con herramientas
propias, cron nocturno, Telegram, self-audit y propose_fix).

La visión a largo plazo (Alejandra 2.0 como plataforma de inteligencia operativa) está en
`MASTER_PLAN.md`. **No está implementada**: el Núcleo Cognitivo es un contrato de diseño,
no código existente.

---

## Infraestructura

| Recurso | Valor |
|---|---|
| GitHub | https://github.com/padilla585projects/Alejandra-APP (branch: `main`) |
| App móvil (Pages) | https://padilla585projects.github.io/Alejandra-APP/ |
| Worker API | https://alejandra-app-api.alejandra-app.workers.dev |
| Worker IA | https://alejandra-agente.alejandra-app.workers.dev |
| D1 (BD) | `alejandra-db` — ID: `0c9eccde-78f1-476d-ac68-bf452bec0c62` |
| R2 (archivos) | `alejandra-app-files` |
| Cuenta Cloudflare | `padilla585.projects@gmail.com` — ID: `d65ead2b2967bf68ff3848a36cd7b1b4` |
| Node.js | v24.14.1 |
| Wrangler | v4.x |

> ⚠️ `NUEVA_CUENTA.txt` es referencia histórica local (en `.gitignore`, nunca commitear).
> Los secretos no se leen, imprimen ni versionan. `.env.example` solo contiene marcadores.
>
> 🔑 **¿En otro ordenador?** Los valores viven en:
> - Cloudflare: https://dash.cloudflare.com → Workers → Settings → Variables
> - GitHub Actions: https://github.com/padilla585projects/Alejandra-APP/settings/secrets/actions
> - Listado de variables requeridas: `.env.example`

---

## ⛔ Qué requiere decisión humana

> **Fuente única: `docs/decisions/ADR-0007-AUTONOMIA-DE-AGENTES-EN-DESARROLLO.md`.**
> Lo de aquí es un resumen; ante cualquier duda o contradicción, manda el ADR.

El criterio **no es la categoría de la acción, sino si se puede deshacer**. El código es
reversible; los datos no.

**Autónomo, sin preguntar:** crear ramas, commits, `push`, abrir y fusionar PR con el CI en
verde, ejecutar pruebas, **desplegar Workers** y encadenar tareas ya aprobadas en `TASKS.md`.

**Requiere decisión humana**, porque no hay vuelta atrás razonable:

- **Migraciones contra D1.** Alteran datos reales, y ARC-011 demostró que el esquema no es
  reproducible desde el repositorio: si se corrompe, no hay de dónde restaurarlo.
- **Secretos** en Cloudflare o GitHub. Una exposición no se deshace.
- **`DELETE`, `DROP`, `TRUNCATE` o `UPDATE` masivo.** Se mantiene la barrera
  `CONFIRMO BORRADO` (SEC-08/SEC-09).
- **Borrado en R2.** Los ficheros no tienen copia.
- **Aceptar un ADR** (pasarlo de Propuesto a Aceptado). Redactarlo sí es autónomo; abrir una fase también, si sus dependencias están cerradas — ADR-0007, enmienda 1.

Además, con independencia de la autonomía: **no hacer refactors masivos** ni cambios fuera
del alcance acordado, y **no inventar decisiones** — marcar `PENDIENTE` y pedir aprobación.

Todo despliegue autónomo exige **verificación posterior registrada**.

> ✅ **Entrega segura (F-0.1):** una PR solo ejecuta validaciones; un `push`, incluido a
> `main`, no despliega Pages ni Workers, no ejecuta migraciones D1 y no reescribe secretos.
> Un despliegue exige iniciar el workflow correspondiente, indicar un SHA/tag, introducir su
> confirmación exacta y superar la protección del entorno GitHub `production`.
>
> ADR-0007 permite que un agente **inicie** ese workflow por su cuenta, porque desplegar es
> reversible. Lo que **no** cambia es la aprobación del entorno: sigue siendo humana. Es la
> última barrera real y ARC-014 ya la señala como debilitada.
>
> Ver `docs/decisions/ADR-0001-ENTREGA-DELIBERADA.md`,
> `docs/decisions/ADR-0007-AUTONOMIA-DE-AGENTES-EN-DESARROLLO.md` y
> `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

---

## Flujo de trabajo

1. Leer las fuentes obligatorias de arriba.
2. Comprobar el estado de Git y preservar cambios ajenos.
3. Definir alcance, riesgos, archivos, permisos y validaciones **antes** de editar.
4. Implementar una unidad coherente; no mezclar limpieza, seguridad y funcionalidades sin relación.
5. Ejecutar las pruebas pertinentes y registrar resultado, omisiones y motivo.
6. Actualizar `PROJECT_STATE.md`, `HANDOFF.md`, `CHANGELOG.md` y ADR/runbook cuando corresponda.
7. Entregar para revisión y **tomar la siguiente tarea aprobada de `TASKS.md` sin pedir permiso** (ADR-0007). Se puede **abrir la siguiente fase** si todas sus dependencias están cerradas y sus ADR aceptados (enmienda 1), dejando constancia. **Aceptar un ADR nunca es autónomo.**

Ramas: una tarea principal por rama, con prefijos `docs/`, `chore/`, `feat/`, `fix/` y
formato `tipo/area-descripcion`. Nunca trabajar directamente sobre `main`.

### Verificación antes de commit

```powershell
# Encoding — obligatorio (ver sección CODIFICACIÓN DE ARCHIVOS)
git diff --staged -- "*.html" "*.js" | Select-String -Pattern "Ã|Â|â€|ï»¿"
# Si devuelve ALGO → STOP. Hay corrupción de encoding.
```

```powershell
git add <archivos modificados>   # Nunca "git add -A" a ciegas
git commit -m "tipo: descripción"
```

### Pruebas

```powershell
node --check worker.js
node --check alejandra-agente/worker.js
npm --prefix alejandra-agente test    # 94 tests de políticas y tools
```

Ejecutar la sintaxis de los Workers cuando se modifiquen, y los tests del agente ante
cambios de herramientas o políticas. Añadir pruebas negativas de autorización ante
cambios de seguridad.

---

## Versionado de la app

La app tiene tres marcadores de versión que **deben estar sincronizados entre sí**:
`version.json`, `sw.js` (`alejandra-vX.XX`) e `index.html` (`APP_VERSION`).

```powershell
$v  = (gc version.json | ConvertFrom-Json).v
$sw = [regex]::Match((gc sw.js -Raw), "alejandra-v([^']+)'").Groups[1].Value
$h  = [regex]::Match((gc index.html -Raw), "APP_VERSION = '([^']+)'").Groups[1].Value
if ($v -ne $sw -or $v -ne $h) { Write-Error "DESINCRONIZADO: json=$v sw=$sw html=$h" } else { Write-Host "OK: $v" }
```

> ⛔ Desincronizarlos causó bucles de recarga infinita en producción (incidentes 22/04 y
> 26/04/2026). Si se cambia uno, se cambian los tres.

Subir de versión es una **decisión de entrega**, no un paso automático de cada edición.
Se decide al preparar una entrega aprobada, no al tocar un archivo.

---

## Comandos de diagnóstico (solo lectura)

```powershell
npx wrangler deployments list                    # ver deploys recientes
npx wrangler tail                                # logs en tiempo real
npx wrangler d1 execute alejandra-db --command "SELECT ..." --remote   # requiere autorización
```

> Cualquier comando que **escriba** en D1, R2, Workers o secretos está sujeto a las
> prohibiciones de arriba.

---

## UNA Alejandra, DOS cerebros (CRÍTICO — leer siempre)

> ⚠️ **INCIDENTE 20/07/2026 (SEC-08/SEC-09)**: Se blindó la barrera humana anti-borrado en
> `worker.js` pero el agente de oficina/app web se quedó SIN blindar durante horas, porque
> es **código separado**. Casi se deja un flanco abierto.

Para el usuario existe **una sola Alejandra** (misma personalidad y memoria, comparten BD
D1). Pero por dentro son **DOS workers con código distinto**, y se le habla desde **4 sitios**:

| Sitio desde el que se habla | Worker que responde | Herramienta de escritura | Barrera destructiva |
|---|---|---|---|
| App móvil/PWA (`index.html`) | `alejandra-agente` | `escribir_bd` | ⚖️ Equilibrada (SEC-09) |
| Panel de oficina (`panel.html`, "Alejandra Office") | `alejandra-agente` | `escribir_bd` | ⚖️ Equilibrada (SEC-09) |
| Panel de control standalone (`alejandra-panel.html`, login con Google/token admin) | `alejandra-agente` | `escribir_bd` | ⚖️ Equilibrada (SEC-09) |
| Chat dev del panel + Telegram | `alejandra-app-api` (`worker.js`) | `sql_query`, `run_migration` | 🔒 Estricta (SEC-08) |

> ⚠️ **`alejandra-panel.html` es un frontend aparte**, con su propio parseo del stream SSE
> de `/api/chat/stream` — no reutiliza código de `index.html` ni `panel.html`. Cualquier
> cambio en el formato de eventos SSE (`routing`/`token`/`tool_start`/`tool_end`/`text`/`done`)
> hay que verificarlo en **los tres** frontends de `alejandra-agente`, no solo en los dos
> "grandes". (Incidente 29/07/2026: el evento `token` se añadió en mayo y nunca se implementó
> aquí — la respuesta se generaba bien en el servidor pero no se pintaba nunca.)

**Regla de oro:** toda mejora/fix de **seguridad, tools, permisos o barreras** hay que
aplicarla —o decidir conscientemente que no aplica— en **LOS DOS** workers (`worker.js`
**y** `alejandra-agente/worker.js`). Si solo se toca uno, quedan descompensados (una
Alejandra protegida, la otra no). Antes de cerrar una sesión de seguridad, preguntarse:
*"¿esto también afecta al otro cerebro?"*.

Los dos workers se validan en CI y se despliegan por workflows manuales e independientes. Las
migraciones D1 y la configuración de secretos son operaciones manuales separadas; nunca forman
parte de un despliegue ordinario. Consultar el runbook antes de cualquier acción de producción.

---

## Esquema de base de datos (deuda conocida)

> ⚠️ El esquema real de D1 **no está definido por las migraciones versionadas**. El código
> de producción ejecuta DDL en caliente: `worker.js` contiene ~108 `CREATE TABLE IF NOT EXISTS`
> y ~51 `ALTER TABLE`, muchos silenciados con `.catch(() => {})`. `schema_completo.sql` y los
> ficheros `migrate_*.sql` son **parciales**, no reproducen el esquema real.

Consecuencia práctica: no asumir que una columna existe por estar en un `.sql`, ni que falta
por no estarlo. Verificar contra D1 (con autorización) antes de decidir.
Registrado como deuda en `ARCHITECT_BACKLOG.md`.

---

## CODIFICACIÓN DE ARCHIVOS (CRÍTICO — leer siempre)

> ⛔ **INCIDENTE 13/05/2026**: Los archivos `panel.html` y `worker.js` se corrompieron por
> guardarlos con codificación incorrecta. Costó horas arreglarlo. NUNCA debe volver a ocurrir.

### Reglas obligatorias

1. **Todos los archivos del proyecto son UTF-8 SIN BOM.** No usar UTF-8 with BOM, no usar
   Latin-1, no usar Windows-1252.

2. **NUNCA abrir ni guardar archivos con un editor que no esté configurado en UTF-8.**

3. **Antes de hacer commit, verificar que no hay caracteres corruptos** (comando en la
   sección "Verificación antes de commit").

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

   # INCORRECTO — Set-Content por defecto usa la codificación ANSI del sistema
   # INCORRECTO — Out-File por defecto puede añadir BOM
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
| `alejandra-panel.html` | Panel de control standalone (frontend independiente) |
| `worker.js` | Backend Cloudflare Worker `alejandra-app-api` (API REST + Alejandra "dev" + crons) |
| `alejandra-agente/worker.js` | Worker SEPARADO `alejandra-agente` (Alejandra de la app web/móvil y del panel de oficina). Tiene sus propios `lib.js`/`lib.test.js` |
| `sw.js` | Service Worker (caché offline, push notifications) |
| `version.json` | `{"v":"X.XX"}` — debe coincidir con `sw.js` e `index.html` |
| `wrangler.toml` | Config Cloudflare (bindings D1 y R2) |
| `schema_completo.sql` | Schema de referencia — **parcial**, ver deuda de esquema |
| `migrate_*.sql` | Migraciones versionadas — **parciales**, ver deuda de esquema |
| `.github/workflows/` | CI/CD — objeto de la fase F-0.1 |
| `docs/` | Documentación oficial: ADRs, arquitectura, runbooks, archivo histórico |

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

## Estado actual

El estado vivo del proyecto está en `PROJECT_STATE.md`, `HANDOFF.md` y `TASKS.md`.
