================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 06/05/2026
**Versión tras última sesión:** v5.53 + Alejandra IA completa v2
**Worker desplegado:** 16e9ed5 (aprendizaje activo, repo tools, system prompt completo)
**GitHub:** en sync ✅ — GitHub Actions deploy activo (Pages + Worker)

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
