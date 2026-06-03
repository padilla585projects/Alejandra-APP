================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 04/06/2026
**Versión actual:** v6.16

---

## RESUMEN SESIÓN 04/06/2026 — v6.16 Fix panel Alejandra en móvil

### Problema reportado:
Al abrir el chat de Alejandra IA en móvil, "crasea todo y se descoloca todo" — hueco gigante entre el input y la barra de navegación.

### Causa raíz:
`alejandraAbrir()` hacía `panel.style.bottom = nav.offsetHeight + 'px'` para dejar la barra de nav visible debajo. En Android, al abrir el teclado virtual el viewport se encoge. El panel `position:fixed` anclado a ese `bottom` se recalculaba contra el viewport reducido y quedaba descolocado al cerrarse el teclado.

El Chat del equipo (no fallaba) usaba `inset:0` y no tocaba `bottom` → la diferencia era exactamente ese cálculo.

### Fix aplicado (index.html:15037):
- Eliminado `panel.style.bottom = nav.offsetHeight + 'px'`
- Ahora siempre `panel.style.bottom = '0'` → cubre toda la pantalla igual que chatPanel
- Mantenido el `input.focus()` automático (el usuario quería conservarlo)

### Verificado en preview:
- Panel height 812 (pantalla completa), lista flex:1 = 686px, input a 10px del borde (solo padding). Sin hueco.

### Archivos modificados:
- index.html — fix bottom panel + APP_VERSION 6.16
- sw.js — CACHE alejandra-v6.16
- version.json — 6.16

### Deploy:
- GitHub: 21fcd96 → push main ✅
- Worker: sin cambios, no requiere redeploy

### Pendiente para próxima sesión:
- Confirmar que el fix del hueco funciona en móvil real tras auto-actualización a 6.16
- Pendientes anteriores: #196 (dept toggle overlap), #195 (proveedores field), #193 (bajas en fichajes), #197 (Gemini quota), #190 (encargados panel access)
- Push notifications v6.13 todavía sin probar en móvil real

---

## RESUMEN SESIÓN 30/05/2026 (noche) — v6.14 Fix escaneo IA (scan parte/bobinas)

### Problema reportado:
Usuario: "el escaneo de fotos para fichajes y mas cosas... da error siempre"
No tenía mensaje exacto del error, así que se atacó defensivamente.

### Causas identificadas:
1. **Regresión de modelo Gemini**: `callGemini` usaba `gemini-2.0-flash` (sin sufijo dated). El fix v5.96 había cambiado a `gemini-2.0-flash-001` pero se perdió.
2. **`callGemini` abortaba en el primer error**: si una key fallaba con 400/500, no probaba las otras keys ni otros modelos. Solo seguía con 429 (cuota) y 404 (modelo no existe).
3. **Errores genéricos al cliente**: "Error IA Gemini" sin pistas de qué falló realmente.
4. **No detectaba bloqueos de safety**: si Gemini bloqueaba con `finishReason: SAFETY`, devolvía respuesta vacía → "JSON inválido".

### Qué se hizo (worker.js):
- **`callGemini` reescrita** — lista de modelos ampliada: `gemini-2.5-flash` (más reciente), `gemini-2.0-flash-001`, `gemini-2.0-flash`, `gemini-1.5-flash-002`, `gemini-1.5-flash`
- **Prueba TODAS las combinaciones key×modelo** antes de rendirse, no aborta al primer error
- **Detecta respuestas vacías y bloqueos de safety** (`finishReason !== STOP/MAX_TOKENS`) → reintenta con siguiente modelo
- **Errores reales de Gemini llegan al cliente** — incluye `data.error.message` + qué key+modelo falló
- **Nuevo endpoint `/dev/gemini-test`** (solo superadmin/dev) — prueba cada combinación key×modelo con un ping mínimo y devuelve mapa de qué funciona y qué no

### Archivos modificados:
- worker.js — callGemini + devGeminiTest + ruta /dev/gemini-test
- index.html — APP_VERSION '6.14'
- sw.js — CACHE 'alejandra-v6.14'
- version.json — 6.14

### Deploy:
- Worker principal: Version ID `35f5264d-d2d7-4f12-a6f5-2973a244642d` ✅
- GitHub: `beb4f06` → push main ✅
- Versiones sincronizadas (json/sw/html): ✅ OK 6.14

### Pendiente para próxima sesión:
- **Usuario debe probar escaneo de partes/bobinas en la app v6.14** y pegar el error exacto si vuelve a fallar (ahora sí saldrá descriptivo)
- Si el problema persiste, llamar a `GET /dev/gemini-test` con token superadmin para ver qué modelos/keys responden
- Pendientes anteriores: #196 (dept toggle overlap), #195 (proveedores field), #193 (bajas en fichajes), #197 (Gemini quota), #190 (encargados panel access)
- Push notifications v6.13 todavía sin probar en móvil real

---

## RESUMEN SESIÓN 30/05/2026 (tarde) — 7 capacidades nuevas para Alejandra

### Qué se hizo:

Alejandra dio en su última conversación (canal app_android, IDs 593-597) una lista de cosas que necesitaba aprender. Implementadas las 7:

**Nuevas herramientas en alejandra-agente/worker.js:**
1. `buscar_precios` — precios de material en tiempo real con caché 7 días (probado con Prysmian Afumex 3,12€/m ✅)
2. `marcar_plano` — análisis de planos/PDFs con Gemini Vision
3. `generar_documento` — memoria_tecnica, certificado_instalacion, lista_materiales, presupuesto, informe_obra (probado: memoria técnica completa ✅)
4. `buscar_normativa` — REBT/ITC-BT indexada local (31 artículos pre-cargados, probado ITC-BT-19 ✅)
5. `historico_materiales` — registrar/consultar/comparar materiales por obra (probado registrar ✅)
6. `configurar_alerta` — alertas proactivas crear/listar/eliminar/verificar (probado: detectó 2 operarios sin fichar ✅)
7. `exportar_datos` — CSV a R2 para bobinas/personal/fichajes/materiales/gastos/custom

### Tablas nuevas en D1 (alejandra-db):
- precios_materiales (caché 7 días)
- normativa_index (31 entradas: ITC-BT-07/11/19/20/21/22/24/25/28/44)
- materiales_obra (tracking por obra_id)
- alertas_config (3 alertas → ajustadas: 1 funcional `sin_fichaje`, bobina_baja arreglada al esquema real, revision_equipo eliminada por no existir tabla equipos)

### Arquitectura:
- Módulo NEXUS `capacidades_avanzadas` añadido a expertos `completo`, `ingenieria` y `tecnico`
- Array `ADVANCED_TOOLS` con las 7 + reparto por TOOLS_POR_EXPERTO
- Funciones `ensureNewTables`, `seedNormativa`, `seedDefaultAlerts` idempotentes (flag `_tablesEnsured`)
- Se ejecutan al inicio de `procesarConNEXUS` y `procesarConNEXUSStream`

### Archivos modificados:
- alejandra-agente/worker.js (+707 líneas) — commit 154cd12

### Deploy:
- alejandra-agente Version ID: d4226ea1-f538-4ddf-ac81-06fbf5df507c ✅
- GitHub: 154cd12 → push main ✅
- Health endpoint OK

### App Flutter (AlejandraIA) — sesión anterior misma fecha:
- v1.8.0 → tema naranja Alejandra + botón TTS permanente
- APK release compilado (56.9MB) — sin subir a Drive aún
- Commit d65da2c en repo AlejandraIA, pusheado

### Pendiente para próxima sesión:
- Probar las 7 capacidades desde la app Android real (no solo via API)
- Subir APK release a Google Drive si el usuario quiere
- Opcional: crear tabla `equipos` si tiene sentido + reactivar alerta `revision_equipo`
- Opcional: completar pre-carga de normativa con más ITC-BT

---

## RESUMEN SESIÓN 30/05/2026 (mañana) — v6.12-v6.13 (Bugfixes + auto-update + push notifications toda la app)

### Qué se hizo:

**v6.12 — Bugfixes + auto-update PWA:**
- Fix z-index: bottomNav (1060) tapaba botones de modales (z-index 500) → modales subidos a 1100
- Fix chat/panel IA no se cerraba al navegar → _applyScreen cierra ambos paneles
- Fix "Debes estar autenticado" → fallback a nombre cuando usuario_id falta en sesión
- Auto-update PWA: polling version.json cada 5 min + fallback /health en visibilitychange
- Optimización batería: /health solo en visibilitychange, no en polling

**v6.13 — Push notifications en toda la app:**
- Chat interno: push a todos los de la empresa al enviar mensaje (excluye remitente)
- Pedidos: push al crear nuevo pedido y al cambiar estado (recibido/cancelado/etc.)
- Incidencias: push al crear (cualquier gravedad) y al resolver
- Fichajes: push al trabajador cuando se le registra un fichaje
- Mantenimientos: push al registrar mantenimiento
- Nuevos endpoints genéricos: /push/subscribe, /push/vapid-key, /push/broadcast
- Frontend: suscripción push unificada — registra en agente Y worker principal simultáneamente
- Eliminada _registrarPushDeveloper (redundante con push universal)
- pushBroadcast solo para superadmin/desarrollador (notificar a todos manualmente)

### Archivos modificados:
- worker.js — sendPushToUser/Empresa/All + hooks en chat/pedidos/incidencias/fichajes/mantenimientos + endpoints push
- index.html — push unificado, eliminar developer legacy, v6.13
- sw.js — CACHE alejandra-v6.13
- version.json — 6.13

### Deploy:
- Worker principal: d95fd80e ✅ (D1 + R2 bindings + 3 crons)
- GitHub: 0768020 → push main ✅
- Versiones sincronizadas: ✅

### Pendiente:
- Probar push notifications en móvil (aceptar permiso, enviar chat y verificar push)
- Pendientes anteriores: #196 (dept toggle overlap), #195 (proveedores field), #193 (bajas en fichajes), #197 (Gemini quota), #190 (encargados panel access)

---

## RESUMEN SESIÓN 29/05/2026 (7ª) — v6.10-v6.11 (Conversación per-user + automod + push + tasks + sync)

### Qué se hizo:

**v6.10 — Conversación per-user + identidad + automodificación:**
- Historial de chat por usuario_id (no por canal) — columna añadida a alejandra_historial
- Alejandra sabe QUIÉN habla: Adrian como creador/compañero, otros como usuarios
- 6 herramientas de automodificación: repo_read_file, repo_write_file, direct_fix, grep_code, run_migration, check_deploy_status
- GitHub token (AgenteAlejandra, sin expiración) configurado como secret
- Memoria (alejandra_memoria) ahora usa usuario_id en vez de canal

**v6.11 — Push notifications + tareas background + sincronización chat:**
- VAPID auto-provisioning: el agente genera sus propias VAPID keys en D1 al primer uso
- Push notifications: Alejandra puede enviar notificaciones push a cualquier usuario
- 4 nuevas herramientas: enviar_notificacion, crear_tarea_background, ver_tareas, completar_tarea
- Tareas en background con notificación automática al completar
- Historial del chat sincronizado entre dispositivos (carga desde /api/chat/history)
- TODOS los usuarios se suscriben a push de Alejandra (no solo developers)
- Endpoints nuevos en agente: /api/chat/history, /push-subscribe, /push-vapid-key
- Tablas D1 creadas: push_subscriptions, alejandra_tareas

### Archivos modificados:
- alejandra-agente/worker.js (tools, handlers, endpoints, VAPID auto-gen, push crypto)
- index.html (chat sync desde servidor, push suscripción universal, v6.11)
- sw.js (cache v6.11)
- version.json (6.11)

### Estado:
- Worker agente: desplegado ✅ (3646c6fb)
- GitHub: push ✅ (63f34ff)
- Versiones sincronizadas: ✅

---

## RESUMEN SESIÓN 29/05/2026 (6ª) — v6.09 (Unificación chats + agente multicanal consciente)

### Qué se hizo:

**Unificación de todos los chats hacia el agente (v6.08-v6.09):**
- screenIA (chat principal PWA) migrado del viejo endpoint /dev/ai-chat al agente completo (alejandra-agente.workers.dev/api/chat)
- Añadido botón 📎 + upload de archivos en screenIA (imágenes, PDF, Excel, etc.)
- panel.html: ambos chats (aiSend y wSend) migrados al agente
- Todos los frontends ahora usan el mismo backend con NEXUS, tools, Gemini y catálogos

**Fix nav bar bloqueada por chat (v6.08):**
- bottomNav z-index subido de 100 a 1060 (por encima del chat overlay 1050)
- Botón IA en nav ahora cierra el chat si está abierto (toggle)

**Alejandra consciente de su arquitectura (agente/worker.js):**
- System prompt actualizado: canales pwa/panel/telegram con descripciones detalladas
- Nueva sección TU ARQUITECTURA: agente unificado, memoria compartida, multi-plataforma
- Alejandra sabe que es UN SOLO agente con cerebro en alejandra-agente.workers.dev
- Sabe que tiene la misma memoria y herramientas en todos los canales

**Google OAuth mobile redirect (worker.js):**
- Nueva función googleMobileRedirect para deep-link OAuth en apps móviles

### Archivos modificados:
- index.html — screenIA migrado a agente, 📎 upload, nav z-index, toggle IA, v6.09
- panel.html — chats migrados a agente
- sw.js — CACHE alejandra-v6.09
- version.json — 6.09
- alejandra-agente/worker.js — system prompt arquitectura multicanal
- worker.js — googleMobileRedirect

### Deploy:
- GitHub: fd774fd → push main ✅
- Worker agente: 37369b0c ✅
- Worker principal: 2446a8f3 ✅

### Pendiente:
- Usuario debe probar todos los chats en móvil tras limpiar caché
- Test en Android real: plan ejecutable, PDF upload, back button
- Botón Alejandra en barra inferior a veces no registra click
- Revisar permisos de usuarios en Alejandra Office

---

## RESUMEN SESIÓN 29/05/2026 (5ª) — v6.07 (Versión dinámica header + anti-caché)

### Qué se hizo:
- Verificado que producción (GitHub Pages) sirve v6.06/6.07 correctamente con TODAS las mejoras (📎, chat, Gemini).
- Verificado que el agente responde correctamente con catálogos y todas las herramientas.
- Problema: el móvil del usuario tenía una versión muy vieja cacheada de la PWA.
- Header del chat mostraba "v5.88" hardcodeado → ahora muestra APP_VERSION dinámicamente.
- Añadido meta tags Cache-Control/Pragma/Expires al `<head>` para evitar caché agresiva del HTML.
- Bump v6.05 → v6.06 → v6.07 para forzar ciclo de actualización del SW.

### Deploy:
- GitHub: b796c14 → push main ✅
- Workers: sin cambios, no requiere redeploy

### Pendiente:
- Usuario debe borrar caché de Chrome en el móvil para recibir la versión actual
- Probar en Android real tras limpieza de caché
- Botón Alejandra en barra inferior a veces no registra el click
- Revisar permisos de usuarios en Alejandra Office

---

## RESUMEN SESIÓN 29/05/2026 (4ª) — v6.05 (Fix sesión usuario_id + testing producción)

### Qué se hizo:

**Bug crítico detectado y corregido — chat Alejandra no funcionaba en PWA:**
- Al probar en producción con Chrome, el chat de Alejandra no enviaba mensajes.
- Diagnóstico: `alejandraEnviar()` fallaba silenciosamente porque `getSession().usuario_id` era undefined.
- Causa raíz: el endpoint `/verificar` (login por código) no devolvía `usuario_id` ni `empresa_id` en JSON.
- El frontend tampoco guardaba esos campos en sesión al hacer login.
- Fix en worker.js: `/verificar` devuelve usuario_id y empresa_id (login por código + superadmin).
- Fix en index.html: login por código y por email guardan usuario_id y empresa_id en sesión.
- Requiere re-login del usuario para que la sesión se reconstruya con los campos.

**Alejandra como ingeniera con catálogos (continuación sesión 3ª):**
- System prompt base ampliado: marcas habituales del sector (Pemsa, Schneider, Prysmian, ABB, etc.).
- Protocolo de material: busca catálogo del fabricante con buscar_google antes de responder si no conoce un producto.
- Prompt ingeniería actualizado con herramientas buscar_google y analizar_archivo.

**Testing en producción (Chrome via Claude in Chrome):**
- Login por código ✅
- Navegación entre pantallas ✅
- Chat Alejandra: funciona tras el fix ✅ (envía mensaje, recibe respuesta con <guia> renderizada)

### Deploy:
- GitHub: 4f156b6 → push main ✅
- Worker principal: ada9fe4d ✅
- Worker agente: 7be72edc ✅ (catálogos + Gemini handlers)

### Pendiente:
- Probar en Android real: fix back + plan ejecutable + chat con archivos PDF/Excel
- Botón Alejandra en barra inferior a veces no registra el click (funciona con JS directo)
- Revisar permisos de usuarios en Alejandra Office

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
