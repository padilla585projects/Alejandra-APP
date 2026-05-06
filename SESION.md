================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 06/05/2026
**Versión tras última sesión:** v5.53 + Alejandra IA integrada
**Worker desplegado:** 7d4380d (con memoria, historial, tools completas)
**GitHub:** en sync ✅ (.nojekyll añadido — fix GitHub Pages)

---

## RESUMEN SESIÓN 06/05/2026 (Alejandra IA — Telegram + Web + Memoria)

### Qué se hizo:
- **Asistente IA Telegram**: bot @AlejandraAPP_bot responde mensajes privados de Adrián (DEV_CHAT_ID=6965043)
  · Solo accesible al desarrollador (chat ID verificado)
  · Transcripción de notas de voz con Gemini (gratis)
  · Usa claude-sonnet-4-6 via API Anthropic
- **Tools completas**: sql_query (SQL libre), web_search (DuckDuckGo), manage_user, send_notification, app_status, list_tables, r2_list, r2_delete, filter_notifications, memory_save, memory_read, memory_delete
- **Memoria persistente en D1**: tablas alejandra_memoria + alejandra_historial
  · Alejandra guarda automáticamente acciones importantes, pendientes, avisos
  · Historial de conversación por canal (telegram/web) — últimos 50 mensajes
  · Carga memoria al inicio de cada conversación para tener contexto
- **Chat web en panel.html**: botón flotante 🤖 abajo derecha (solo superadmin/desarrollador)
- **Sección IA en index.html**: pestaña "IA" en nav inferior (solo superadmin/desarrollador)
- **Endpoint /dev/ai-chat**: POST autenticado para chat desde web
- **GitHub Pages fix**: añadido .nojekyll para evitar fallos de Jekyll en deploy
  · Los workflows fallaban (#347-#351) — fix aplicado, #352 en queue
- **Secrets configurados**: ANTHROPIC_API_KEY + DEV_CHAT_ID en Cloudflare
- **padilla585.projects@gmail.com** cambiado a rol superadmin

### Pendiente verificar:
- Que GitHub Pages despliege correctamente tras .nojekyll (workflow #352+)
- Verificar chat flotante visible en panel.html tras deploy
- Verificar pestaña IA visible en index.html (requiere login con superadmin)

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
