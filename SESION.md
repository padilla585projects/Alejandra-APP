================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 06/05/2026
**Versión tras última sesión:** v5.53 + Alejandra IA integrada
**Worker desplegado:** 7d4380d (con memoria, historial, tools completas)
**GitHub:** en sync ✅ — GitHub Actions deploy activo y funcionando

---

## RESUMEN SESIÓN 06/05/2026 (Fix GitHub Pages deploy + verificación chat IA web)

### Qué se hizo:
- **GitHub Pages roto**: build tipo `legacy` (Jekyll) se quedaba colgada en 0ms sin error
  · El `.nojekyll` añadido en sesión anterior no fue suficiente
  · Diagnóstico via API GitHub: `status: errored`, `build_type: legacy`
- **Fix definitivo**: cambiado a `build_type: workflow` (GitHub Actions)
  · Creado `.github/workflows/pages.yml` — deploy automático en cada push a main
  · Solo sube archivos frontend (index.html, panel.html, sw.js, iconos) — excluye worker.js (700KB+)
  · `cancel-in-progress: true` — no se acumula cola de builds
  · Deploy en ~30 segundos tras cada push ✅
- **Chat IA web verificado**: botón 🤖 visible y endpoint /dev/ai-chat respondiendo correctamente
  · Probado con token real de D1 — respuesta OK de claude-sonnet-4-6
- **Pendientes anteriores resueltos**: chat flotante panel.html ✅, pestaña IA index.html ✅

### Estado final:
- GitHub Pages: ✅ desplegando via GitHub Actions
- Chat IA web (panel.html): ✅ funcionando
- Chat IA Telegram: ✅ (no tocado, estaba OK)
- Worker: sin cambios (7d4380d)

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
