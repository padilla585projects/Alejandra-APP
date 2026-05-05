================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 05/05/2026
**Versión tras última sesión:** v5.42 (worker 96d839ef)
**GitHub:** bfa1583 ✅
**Panel web:** https://padilla585projects.github.io/Alejandra-APP/panel.html ✅ FUNCIONA

---

## RESUMEN SESIÓN 05/05/2026 (role audit + fixes v5.42)

- **BUG-R01 (Importante)**: `jefe_de_obra` veía bobinas/PEMP/carretillas/herramientas de TODAS
  las obras cuando no pasaba `obra_id` URL param.
  Causa: `isAdminRole = isSuperadmin || isEmpresaAdmin || isJefeObra` → `obraFilter = null`.
  Fix: split en `isUnrestrictedAdmin` (SA/EA) para obra scope vs `isAdminRole` (incluy JO) para
  dept scope. Aplicado en getBobinas, getPemp, getCarretillas, getHerramientas.
- **BUG-R02 (Menor)**: `isDesarrollador` no se incluía en el return de `getAuth()` vía token.
  Fix: `isDesarrollador: sesion.rol === 'desarrollador'` añadido. Funcional por `isSuperadmin=true`
  pero latente para checks futuros.
- Audit completo de 7 roles: todos OK tras correcciones.
- App bumpeada a v5.42, worker 96d839ef, pusheado ✅.

## RESUMEN SESIÓN 05/05/2026 (inventarios panel — bug fix + filtros dept/obra)

- **Bug crítico**: worker devuelve array crudo pero panel buscaba `r.bobinas`, `r.pemp` etc.
  → tablas siempre vacías. Fix: `toArr(r, key)` acepta ambos formatos sin romper app móvil.
- **Filtros por departamento y obra** en Bobinas, PEMP, Carretillas, Pedidos, Herramientas:
  · Selectores `📁 Todos los depts` y `🏗 Todas las obras` en cada toolbar
  · Admins (SA/EA/JefeObra) ven todos los depts por defecto; operarios solo el suyo
  · `cargarObrasPanel()` rellena los selects al iniciar sesión
  · Columna `Dept.` añadida a todas las tablas con emoji+nombre
- Worker: `a67c0ee8` ✅

## RESUMEN SESIÓN 05/05/2026 (security patch — 4 vulnerabilidades críticas)

- **SEC-13 (CRÍTICO)**: `getAuth()` legacy path aceptaba `X-Rol: superadmin` como suficiente
  para obtener acceso total sin token. Cualquier petición HTTP sin sesión podía enviar esa
  cabecera y pasar como superadmin. Fix: solo `X-Admin-Code` verificado contra `env.ADMIN_CODE`
  concede privilegios en la ruta legacy. `X-Rol` queda como metadata, nunca concede acceso.
- **SEC-08/09**: `/scan`, `/ocr`, `/log POST` eran públicos. Permitía consumir cuota de
  Gemini/Cloud Vision sin autenticar y spamear Telegram con errores falsos. Ahora requieren
  `X-Token` válido en D1.
- **SEC-02**: `getCatalogo/addCatalogo/deleteCatalogo` interpolaban el nombre de tabla en SQL
  sin validación. Añadida `CATALOG_WHITELIST` con 6 tablas permitidas; cualquier otro → 400.
- **UX-06**: `alertasDiarias` mezclaba alertas de todas las empresas sin etiquetar. Ahora
  cada línea lleva `[NombreEmpresa]` para que el superadmin identifique el origen.
- Worker: 6b18efd1-c089-4576-a8f3-fdd7e31208bd ✅

## RESUMEN SESIÓN 05/05/2026 (v5.41 — Sync bidireccional panel ↔ app móvil)

- **Panel (panel.html)**: motor de auto-refresh completo
  · Chip "⟳ hace Xs" en topbar — muestra cuándo fue el último refresh, clic = refresh manual
  · Intervalos configurados por sección: fichajes 20s, dashboard/incidencias/pedidos 30s,
    personal/turnos/bobinas/pemp/carretillas/herramientas/seguridad 60s, mant/repostajes 90s
  · `visibilitychange`: al volver al tab → recarga inmediata + reinicia contador
  · `navTo()` para timers anteriores y arranca el nuevo, evitando acumulación
  · Admin hace un cambio → operario lo ve en ≤ intervalo de la sección
- **App móvil (index.html)**: polling + visibilitychange
  · `_APP_SCREEN_REFRESH`: mapa de funciones de recarga por pantalla activa
  · `_startAppSectionPoll()`: polling automático según `_APP_SECTION_POLL_SECS`
  · `_applyScreen()`: limpia timer anterior y arranca el de la nueva sección
  · `personalSelTab()`: polling fichajes-hoy (tab 0, 30s) y turnos (tab 6, 60s)
  · `visibilitychange`: refresh con debounce 15s al volver a primer plano
  · `window.calCargar` expuesto globalmente (estaba dentro de closure)
- Worker redesplegado: 10fb5cf7-0bf2-48bd-b711-f9c0eac9be5b (incluye fixes de auditoría de sesión anterior)
- GitHub: en sync ✅

---

## RESUMEN SESIÓN 05/05/2026 (auditoría crítica — 7 bugs/vulnerabilidades resueltos)

- **SEC-01 CRÍTICO**: `resetearPass()` usaba SHA-256 puro pero el login usa PBKDF2 →
  cualquier usuario que reseteara su contraseña quedaba bloqueado permanentemente.
  Fix: ahora llama a `hashPassword()` (PBKDF2 con salt, idéntico al alta de usuarios).
- **SEC-03**: SQL injection en `actualizarPedido` — `empresa_id` se interpolaba directamente
  en el SQL. Fix: ahora se usa `?` binding como todos los demás campos.
- **SEC-04**: `devolverBobina/PEMP/Carretilla` creaban registros auto sin `empresa_id` → registros
  huérfanos invisibles para la empresa. Fix: INSERT ahora incluye `empresa_id` de auth.
- **SYNC-01/02**: `syncSheets/syncPedidos` defaulaban a `empresa_id=1`. Fix: todos los handlers
  CRUD pasan `empresa_id` del auth context a la llamada de sync. Afecta bobinas, PEMP,
  carretillas, pedidos, herramientas, kits, inventario seg (crearItemSeg, moverItemSeg,
  editarItemSeg, eliminarItemSeg — 10+ funciones).
- **BUG-01**: panel.html campo email — `onkeydown="if(e.key==='Enter')"` → ReferenceError.
  Fix: `event.key` (la variable implícita en onkeydown inline es `event`, no `e`).
- **BUG-05**: SESSION en panel.html no guardaba `usuario_id` → burbujas de chat nunca marcadas
  como propias ("own"). Fix: worker devuelve `usuario_id` en login email y Google OAuth;
  panel incluye `usuario_id` en SESSION al construirlo.
- **UX-07**: Planificador de turnos mandaba `trabajador_id` pero el worker espera `usuario_id`.
  Fix: corregido en POST body, turnoMap key y actualización optimista.
- Worker redesplegado: 4b13c2c3-2bc8-49ca-b8b2-70b6d2cce786
- GitHub: en sync ✅

## RESUMEN SESIÓN 05/05/2026 (panel web v0.8 — Recuperación de contraseña Resend)

- **Recuperar contraseña** vía email (Resend API):
  · Worker: `POST /recuperar-pass` → genera token hex 32 chars, tabla `reset_tokens` (expira 2h),
    envía email HTML branded con botón naranja vía Resend API
  · Worker: `POST /resetear-pass` → verifica token, actualiza password (SHA-256), invalida sesiones
  · Panel: enlace "¿Olvidaste tu contraseña?" en login, overlay solicitar email con feedback
  · Panel: overlay nueva contraseña (detecta `?reset_token=` en URL al abrir desde email)
  · Resend API key guardada como secret en Cloudflare (`RESEND_API_KEY`) — nunca en código
  · Cuenta Resend registrada con GitHub, sender actual: `onboarding@resend.dev`
- **Pendiente RGPD**: plan de protección de datos para empresas (sesión dedicada)
- Worker ID: 8e7dddec-66c4-43f2-80c3-ce95456c10b2
- GitHub: en sync ✅

## RESUMEN SESIÓN 05/05/2026 (panel web v0.7 — Fases 4-7: DevTools + Fase5 + Admin + Analítica)

- **Fase 4 (continuación)**: DevTools con 18 health checks, DB stats, sesiones activas,
  acciones rápidas (borrar logs/intentos, test Telegram), logs en tiempo real (polling 2s con since_id)
- **Chat mejorado**: identificación de quién escribe + de qué obra + foto de perfil R2 con fallback
- **Fase 5 completa**: Obras (Tabulator + toggle activa, verDetalle modal), Incidencias (KPIs gravedad,
  doble filtro tipo/estado), Pedidos (inline estado, verDetalle), Mantenimientos (registros)
- **Fase 6 completa**: Usuarios (KPIs+inline edit+toggle activo+cambiar pass), Empresa (form completo),
  Informe semanal, secciones superadmin (wizard 3 pasos crear empresa + lista empresas)
- **Fase 7 completa**: Gráficas Chart.js (fichajes/inc/ped/equipos), PDF jsPDF (gráficas+inc+ped),
  Búsqueda global 🔍 topbar con debounce 400ms + resultados agrupados
- **Worker**: /log?since_id, /obras/:id PUT, /graficas, /telegram/test, acciones admin DELETE
- **Commits**: 3 en esta sesión, todos pusheados ✅
- **GitHub**: en sync ✅

## RESUMEN SESIÓN 05/05/2026 (panel web v0.3 — Fases 1/2/3 + roles + chat + notif + logs)

- **Panel web Alejandra Office** — nuevo archivo `panel.html` en el mismo repo/worker
- **Fase 1**: layout sidebar+topbar, login email/pass, dashboard KPIs, todas las páginas stub
- **Fase 2**: turnos grid interactivo, fichajes manuales+KPIs, EPIs modal, carnets modal,
  rol `desarrollador` (acceso total), Google OAuth (botón + callback), 
- **Fase 3**: chat flotante polling 10s, notificaciones badge (stock/pedidos/carnets),
  logs automáticos JS+API con visor admin, PEMP/Carretillas modales, Repostajes sección nueva
- **Roles nuevos**: `jefe_de_obra`, `oficina`, `desarrollador` en worker.js getAuth
- **Worker**: desplegado 3 veces esta sesión, último ID: 48609304
- **GitHub**: en sync ✅
- **Plan guardado**: PLAN_PANEL_WEB.md con fases pendientes (4-7)
- **.gitignore**: añadido (`.wrangler/`, `e1/`...) + historial limpiado con filter-branch

---

## RESUMEN SESIÓN 05/05/2026 (v5.40 — Sugerencias #187/#188/#189)

- **#189 BUG** — `getSesionesActivas` (worker) faltaba `isEmpresaAdmin` en la guarda
  de auth → 403 al pulsar "Ver quién está conectado" como empresa_admin. Frontend
  mostraba el botón pero el backend rechazaba. Fix de una palabra.
- **#187 — Catálogo de departamentos ampliado a 11** (opción C: catálogo cerrado).
  Nuevos: Obra Civil, Albañilería, Pintura, Carpintería, Telecom, Almacén, Oficina.
  `_DEPTS_CATALOG` centraliza icon/name/desc/template. DEPT_INFO + _ALL_DEPTS derivados.
  Cards extras renderizadas dinámicamente en `#extraDeptCards`. MEJ-08 (depts activos)
  ahora muestra los 11 con descripción.
- **#188 — Módulos togglables para TODOS los depts**. Antes solo Seguridad y
  Personal. Trade depts ahora exponen 11 toggles (Bobinas solo en Eléctrico).
  Keys: `home_{dept}_{cardId}`. `_modsParaDept(dept)` decide según template.
  `applyModulosConfig` oculta cards trade según dept activo.
- **WIZARD de crear empresa**: nuevo paso 3 (Departamentos). 11 toggles, todos
  marcados por defecto. Worker `/empresas/registro` acepta `departamentos` y guarda
  como JSON. Cache local rellenado tras registro → app personalizada al primer login.
- Sugerencias #187/#188/#189 marcadas como `resuelto` en D1.
- Worker redesplegado: b433ed71-3614-4ef3-84ce-aa4483f4170b
- Cambios solo en index.html + worker.js + sw.js + version.json

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

---

## RESUMEN SESIÓN 04/05/2026 (v5.38 — NEW-30/31/32/33: PDF, búsqueda global, Telegram personal, fotos perfil)

- NEW-30: PDF incidencias — botón "📄 PDF" en header del módulo, genera tabla con filtros activos
- NEW-31: Búsqueda global — botón 🔍 en header (visible tras login), modal con debounce 350ms
  · Worker: /buscar?q= consulta paralela sobre incidencias/equipos/herramientas/usuarios/pedidos
  · Click en resultado navega directamente a la sección correcta
- NEW-32: Telegram personal via deep link — sin que el usuario sepa su chat_id
  · tabla vincular_tokens (token 8 chars, expira 15 min)
  · Ajustes→Sesión: sección "📱 Notificaciones personales" con estado vinculado/no-vinculado
  · Bot @AlejandraAPP_bot registrado como webhook en /telegram/webhook
  · Carnets y planificador de turnos envían Telegram personal si el usuario está vinculado
- NEW-33: Foto de perfil trabajadores externos — avatar circular en plantilla, admins pueden cambiar
  · R2 key: e{empresa_id}/perfiles/externo/{id}_{ts}.jpg; inicial como fallback
- Bug fix: deploy siempre via `npx wrangler deploy` (wrangler.toml) — se estaba deployando a
  `alejandra-worker` (incorrecto) en vez de `alejandra-app-api` (el que usa el frontend)
- D1 migraciones aplicadas directamente: telegram_id, foto_r2_key en usuarios; foto_r2_key en
  personal_externo; tabla vincular_tokens
- Webhook Telegram registrado: ✅ "Webhook was set"

---

## RESUMEN SESIÓN 04/05/2026 (v5.37 — NEW-28 Comparativa obras + NEW-29 Módulos configurables)

- NEW-28: Comparativa entre obras
  · Worker: GET /comparativa-obras → KPIs por obra activa (SA/EA solo)
    Fichajes hoy, equipos averiados/mant, herramientas fuera, incidencias, pedidos
  · Frontend: pestaña "📊 Comparativa" en Ajustes (oculta para no-SA/EA)
    Tabla responsiva con cifras en rojo/naranja si > 0, botón Actualizar + timestamp
- NEW-29: Módulos configurables por departamento
  · D1: empresas.modulos_config TEXT (migración directa vía wrangler CLI)
  · Worker: GET/PUT /mi-empresa incluyen modulos_config
  · Cards seg/personal tienen data-module="seg_escaner" / "per_fichajes" etc.
  · Ajustes → Empresa: sección "⚙️ Módulos visibles" con checkboxes
    4 módulos seg, 7 módulos personal
  · applyModulosConfig(): aplica config al entrar a home de seg y personal
  · Config persistida en localStorage + D1

## RESUMEN SESIÓN 04/05/2026 (v5.36 — NEW-20 Planificador de turnos)

- Worker: GET/POST/DELETE /turnos con upsert inteligente
- D1: tabla turnos + índice aplicados directamente
- Frontend Panel 6 en Personal:
  · Cuadrícula semanal: filas=trabajadores, columnas=días (L–D) con fechas
  · Navegación entre semanas + botón HOY
  · Celda: clic cicla vacío→Mañana→Tarde→Noche→Libre→vacío
  · Update optimista (UI actualiza antes de respuesta del servidor)
  · Solo admins/encargados pueden editar; operarios ven sin poder cambiar
  · Leyenda de colores en el header del panel

---

## RESUMEN SESIÓN 04/05/2026 (v5.35 — NEW-18 Informe semanal Telegram)

- Función informeSemanal(empresa_id, empresa_nombre, env):
  · Calcula rango semana anterior (lunes–domingo)
  · Datos: fichajes (total + horas + retraso), equipos averiados/mant,
    herramientas fuera, pedidos pendientes, incidencias abiertas, stock bajo
  · Envía resumen formateado por Telegram con <b>bold</b> y <i>italic</i>
- alertasDiarias: punto 0 nuevo — cada mañana verifica empresas con informe activo
  si hoy es su día configurado → llama a informeSemanal
- GET/PUT /mi-empresa: añadidos campos informe_semanal + informe_dia
- Migración D1 ejecutada: empresas.informe_semanal + empresas.informe_dia
- Frontend Ajustes → Empresa: nueva sección "📊 Informe semanal"
  · Toggle activar + selector día + botón guardar con protección doble-submit
- Worker redesplegado (ID: fe8c3fc2-bdab-47ac-bec4-690721b485bc)

---

## RESUMEN SESIÓN 03/05/2026 (v5.34 — Auditoría: robustez manejo de errores)

- Protección doble-submit en guardarEdicion, guardarRepostaje, guardarIncidencia
  · Botón se deshabilita y muestra "Guardando…" mientras espera respuesta
- Validación de formato email en registro de empresa (paso 2)
- try/catch añadido a ~25 funciones frontend sin cobertura de errores de red:
  · chatBorrar, segHerr* (5), funciones add/del catálogo (8), docs borrar (4),
    sugerencias admin (4), guardarEpi, borrarEpi, guardarCarnet, borrarCarnet
- delTipoMatSeg, delTipoHerr, delCatalogo: ahora verifican res.ok antes de recargar
- Corregido tipo de toast 'error' → 'err' en módulos EPI y carnets
- Worker NO redesplegado (cero cambios en worker.js)

---

## RESUMEN SESIÓN 03/05/2026 (v5.33 — NEW-19 Carnets + BUG-94/107/95)

- NEW-19: Carnets y certificaciones completo (worker + D1 + frontend)
  · 18 tipos: PRL básico/medio/superior, PEMP, carretilla, CAE, primeros auxilios, conducir…
  · Panel 5 en Personal con filtros trabajador/estado y badges de caducidad
  · Cron diario envía Telegram cuando un carnet caduca dentro de días_aviso
- BUG-94/107/95: ver sesión anterior

---

## RESUMEN SESIÓN 03/05/2026 (v5.32 — BUG-94/107/95)

- BUG-94: obra label oculta cuando obra_nombre es null → no más "🏗 —" en personal/seguridad
- BUG-107: notif chat pasa data.navTo → SW hace postMessage → app navega al chat
- BUG-95: Excel completo muestra "Sin datos" en vez de error genérico si workbook vacío

---

## RESUMEN SESIÓN 03/05/2026 (v5.31 — Seguridad crítica)

- CRIT-1: Rate limiting en /verificar — 10 intentos máx por IP en 15 min
  · Tabla login_attempts (ip, motivo, created_at) + índice por IP
  · Al login exitoso se borran los intentos de esa IP
  · Devuelve 429 si se supera el límite
- CRIT-2: Token en URL restringido a GET únicamente
  · ?token= en URL solo funciona para GET (imágenes/fotos/docs vía <img src>)
  · POST/PUT/DELETE requieren X-Token en header → token no filtra vía logs/referrer/history
- CRIT-3: Expiración de sesiones (30 días sliding)
  · columna expires_at en sesiones, se pone datetime('now', '+30 days') al crear
  · getAuth rechaza sesiones caducadas, y renueva expires_at en cada request válido
- Worker redesplegado: 2273550a-4d6d-4219-8243-4aa796a83e93
- GitHub actualizado ✅

---

## RESUMEN SESIÓN 03/05/2026 (v5.30 — Mejoras visuales Sheets)

- Bug crítico arreglado: applyTabFormatting acumulaba reglas condicionales
  sin borrar las antiguas → cada sync añadía 13 nuevas → la Sheet se iba
  haciendo más lenta con el tiempo. Ahora la metadata incluye
  conditionalFormats + bandedRanges y se borran antes de re-aplicar.
- Header oscuro con texto blanco centrado (dorado/azul/naranja por dept)
- Banding zebra, filtro automático, bordes finos, wrap en Notas
- Color condicional Estado ahora pinta TODA la fila (antes solo celda)
- Worker redesplegado: f873b057-ec22-4f3d-96c8-f452a771ec0e

---

## RESUMEN SESIÓN 03/05/2026 (v5.29 — Revisión Google Sheets)

- Auditoría completa de la integración con Google Sheets
- Bugs encontrados y arreglados en worker.js:
  · editarBobina/editarPemp/editarCarretilla NO sincronizaban Sheets tras UPDATE → ahora sí
  · moverItemSeg (acción 'editar') NO sincronizaba Seg-Inventario → ahora sí
  · Syncs fire-and-forget (seguridad, pedidos) ahora envueltos en ctx.waitUntil()
  · actualizarPedido sincroniza solo la pestaña del dept afectado (no las 3)
  · Cron diario (07:00 y 18:00) ahora hace syncSheets+syncPedidos completos para resiliencia
  · /sync-sheets y /sync-debug requieren auth (empresa_id / superadmin respectivamente)
  · syncSheetsDebug ahora filtra por empresa_id=1 (antes leía toda la tabla bobinas)
- Worker redesplegado: 142345f6-17c6-40df-8dc5-3a7f8454d5be
- Frontend bumpado a 5.29 por norma de versionado (sin cambios funcionales)

---

## RESUMEN SESIÓN 29/04/2026

- v5.23: BUG-113 — NFC: dos bugs al añadir objetos/herramientas
  · Seg NFC llamaba segBuscarMaquina() en vez de segBuscarCodigo() → ítems de inv seg no se encontraban
  · Herr NFC modo agregar: condición de carrera eliminada — preSerial dentro del .then() de herrCargarSelects()
  · herrAgregarDesdeEscaner: mismo fix sin setTimeout
- v5.24: Modo AÑADIR en escáner de Seguridad
  · Botones ➕ AÑADIR / 🔍 BUSCAR en panel Escáner de Seguridad
  · Modo AÑADIR: NFC/cámara → abre formulario nuevo ítem con código pre-rellenado (para etiquetar arneses, EPIs, etc.)
  · Modo BUSCAR: comportamiento previo
- v5.25: Modo AÑADIR activo por defecto al abrir el escáner de Seguridad
- Worker NO redesplegado (sin cambios en worker.js en toda la sesión)

---

## PENDIENTE PARA LA PRÓXIMA SESIÓN

### 🟡 Bugs activos (de la DB de sugerencias)
- **Bug #107** — Notificaciones: al pulsar una notificación no navega correctamente a la sección
- **Bug #94**  — Nombre de obra no se muestra bien en la barra de iconos (dept personal/seguridad)
- **Bug #95**  — Formatos de exportación (Excel): algo no funciona bien en algún módulo
- **Bug #184** — Dotación de EPIs por trabajador (Katherine) — feature nueva, sesión dedicada

### 🟢 Features pendientes (ver IDEAS_PENDIENTES.txt para detalle)
- NEW-18, NEW-19, NEW-20, NEW-22… (ver lista completa en IDEAS_PENDIENTES.txt)
