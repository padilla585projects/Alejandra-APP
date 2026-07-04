## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 04/07/2026 — Fix agente: reapertura del hueco en webhooks + aislamiento empresa_id en consultar_bd/escribir_bd
**Versión actual:** App PWA **v7.54** · worker principal deploy ec049cf8 · commit 81f8f1d
**Agente (alejandra-agente):** commit 6d92ce7 desplegado (deploy CI 28708003217, health OK)
---

## RESUMEN SESIÓN 04/07/2026 (continuación 3) — Fix webhook/evento + '/' sin autenticar, aislamiento empresa_id en BD

Tras cerrar la cadena crítica de /api/chat (commit `d357aa7`), Adrián pidió seguir con los dos
pendientes que quedaron documentados abajo. Investigación confirmó ambos como reales y se
arreglaron los dos en el mismo commit (`6d92ce7`, CI `28708003217`, health OK):

### ✅ Corregido: `/webhook/evento` y `/` (getaway) reabrían el hueco de auth
Ambas rutas son alcanzables desde internet sin ningún token/verificación, pero llamaban a
`procesarConNEXUS(...)` omitiendo los argumentos `authOk`/`esDevVerificado` — que por defecto
valían `authOk=true`. Resultado: cualquiera podía hacer POST a `/webhook/evento` con un
`datos` manipulado (inyección de prompt) y, en teoría, el modelo podía invocar
`consultar_bd`/`escribir_bd` como si viniera de una sesión verificada — exactamente el bug
que se acababa de cerrar en `/api/chat`, reabierto por dos rutas que no pasaban por el mismo
filtro. Fix: se pasa explícito `false, false` en ambos call sites, **y además** se cambió el
default de `authOk` en `procesarConNEXUS`/`procesarConNEXUSStream` de `true` a `false`
(fail-safe: cualquier ruta futura que olvide pasarlo queda bloqueada por defecto, no abierta).
Los dos call sites legítimos (`/api/chat`, `/api/chat/stream`, que ya pasaban valores reales
explícitos) y el cron interno de autoreflexión (que ya pasaba `true, true` explícito) no se
ven afectados por el cambio de default.

### ✅ Corregido: `consultar_bd`/`escribir_bd` sin aislamiento por `empresa_id`
Estas dos tools ya exigían sesión válida (`TOOLS_REQUIEREN_SESION`), pero ejecutan SQL libre
generado por el modelo con solo filtros de keywords (SELECT-only / bloqueo de DROP-ALTER-etc);
nada en el código obligaba a que la query estuviera filtrada por la empresa del que llama —
solo una convención en el prompt del sistema, no verificada. Un usuario autenticado de la
empresa A podía, en teoría, pedir una consulta/escritura contra datos de la empresa B.

Fix: nueva función `validarScopeEmpresaBD(query, params, empresaId, esDevVerificado)`:
- Se consultó el esquema real de producción (`wrangler d1 execute ... sqlite_master`) y se
  construyó `TABLAS_EMPRESA_PERMITIDAS`, la lista de las 58 tablas de negocio que sí tienen
  columna `empresa_id` real — **excluyendo a propósito** `sesiones` y `vincular_tokens`
  (tienen `empresa_id` pero contienen tokens de sesión/vinculación: leerlos permitiría
  suplantar a otro usuario de la misma empresa, incluido un admin).
- Cualquier tabla fuera de esa lista (tablas de sistema del propio agente: `alejandra_tokens`,
  `config`, `agente_config`, `reset_tokens`, `auth_nonces`, etc.) queda bloqueada para
  `consultar_bd`/`escribir_bd` salvo `esDevVerificado`.
- Para las tablas permitidas, la query debe filtrar explícitamente por `empresa_id`: si usa un
  literal (`empresa_id = 2`), debe coincidir con la empresa real de la sesión; si usa
  placeholder (`empresa_id = ?`), se calcula su posición y se verifica que el valor bindeado
  en `params[]` coincida; si no filtra por `empresa_id` en absoluto, se rechaza.
- Se bloquea además la columna `password_hash` (tabla `usuarios`) para cualquier no-developer.
- `esDevVerificado` se salta esta capa completa (mismo criterio que `TOOLS_SOLO_DEV_VERIFICADO`).
- El rechazo devuelve un string de error (igual que los demás checks existentes de estas tools),
  visible para el modelo, que puede corregir su query en el siguiente intento.

Verificado con `node --check worker.js` (OK) y diff acotado (90 inserciones, 4 líneas
tocadas, sin cambios fuera de lo descrito). Commit `6d92ce7`, push a `main`, CI
`28708003217` completó con éxito (migración D1, deploy worker, secrets, health check OK).

### Pendiente (no abordado esta sesión, documentado para el futuro)
- El resto de hallazgos 🟠/🟡 de la auditoría original: rate limiting/topes de gasto, retry/backoff
  en 429, SSRF en `test_endpoint`, `/files/<key>` cross-tenant, `/fcm-token` y
  `/api/comandos/pendientes` sin auth, falta de tests, `llamarGPT4oFallback` sin tracking de
  coste, `ALEJANDRA_AGENTE.txt` desactualizado, ~19 tool handlers muertos/duplicados de una
  arquitectura anterior, falta de correlation/trace IDs.
- El aislamiento por `empresa_id` en `consultar_bd`/`escribir_bd` es defensa basada en regex
  (detecta el primer filtro `empresa_id=`/`empresa_id=?` en la query) — no es un parser SQL
  completo. Cubre el caso realista (spoofing de id literal o de placeholder, ausencia total de
  filtro), pero una query muy retorcida con múltiples joins y múltiples filtros `empresa_id`
  en distintas posiciones solo se valida en la primera ocurrencia. Suficiente como defensa en
  profundidad combinada con el resto de capas (gating de sesión + convención de prompt), pero
  no es una garantía matemática — si se quiere blindar del todo, la alternativa sería sustituir
  SQL libre por un query builder estructurado (más trabajo de rediseño).

---

## RESUMEN SESIÓN 04/07/2026 (continuación 2) — Fix ADMIN_TOKEN hardcodeado + cadena crítica sin autenticar

Tras el fix funcional de la sesión anterior, "arreglala" → aclarado con Adrián en dos pasos
("Ambas cosas"): arreglar el `ADMIN_TOKEN` hardcodeado en CI, y además cerrar la cadena crítica
de seguridad sin autenticar documentada como 🔴 abajo.

### ✅ Corregido: `ADMIN_TOKEN` hardcodeado en CI (commit `3622935`)
- `.github/workflows/deploy-alejandra-agente.yml` hacía `echo "alejandra2026" | wrangler secret
  put ADMIN_TOKEN` en cada deploy — deshacía el fix de `migrate_003_fix_schema.sql` que lo había
  quitado "por seguridad" (token público en el historial del repo).
- Generado nuevo token con `openssl rand -hex 32`, guardado en GitHub Actions secrets
  (`gh secret set ADMIN_TOKEN`), el step ahora usa `${{ secrets.ADMIN_TOKEN }}` en vez del literal.
- Seguro de rotar: `/auth/verify-session` ya devolvía `env.ADMIN_TOKEN` dinámicamente — ningún
  cliente tenía el valor viejo hardcodeado.
- Deploy CI `28707154226` ✅ health OK.

### ✅ Corregido: cadena crítica sin autenticar en `/api/chat`/`/api/chat/stream` (commit `d357aa7`)
- **Alcance real, confirmado antes de tocar código**: el routing de experto
  (`clasificarConHaiku`) decide qué tools recibe Claude solo por el *texto* del mensaje, sin
  ninguna comprobación de identidad. Casi todos los expertos (`app`, `tecnico`, `reflexion`,
  `completo`, `ingenieria`) ya incluían `patch_codigo`, `github_escribir`, `ejecutar_deploy`,
  `rollback`, `escribir_bd`, `consultar_bd`. Y ninguno de esos 6 handlers en `ejecutarTool()`
  comprobaba identidad — el único gate existente (`TOOLS_PROTEGIDAS`/`esDeveloperAgente`) protegía
  una generación antigua de nombres de tool (`repo_read_file`, `direct_fix`, `run_migration`...),
  huérfana respecto a los tools peligrosos actuales. Resultado: cualquiera en internet podía
  mandar `POST /api/chat {usuario_id:"adrian", mensaje:"..."}` sin token y, si Claude decidía
  usarlas, conseguir que el agente escribiera/desplegara código o leyera/escribiera la BD
  compartida de todas las empresas.
- **Fix**: `/api/chat` y `/api/chat/stream` ahora llaman a `getAuth()` (ya existía, sin usar por
  el chat — valida `Authorization: Bearer <token>` contra `sesiones`/`ADMIN_TOKEN`) y esa
  identidad **prima** sobre el `usuario_id` del body. Nuevo helper `filtrarToolsPorAuth()`
  (worker.js, tras `TOOLS_POR_EXPERTO`) quita `patch_codigo`/`github_escribir`/`ejecutar_deploy`/
  `rollback` de la lista de tools salvo `esDevVerificado` (identidad real + `esDeveloperAgente`),
  y quita `consultar_bd`/`escribir_bd` salvo `authOk` (cualquier sesión válida). Gating repetido
  también dentro de `ejecutarTool()` (defensa en profundidad, por si algún otro flujo llama la
  tool sin pasar por el filtro de lista).
- El pipeline autónomo de auto-mejora (cron `reflexion`, disparado por `scheduled()` interno, no
  por HTTP) mantiene acceso explícito (`authOk=true, esDevVerificado=true` hardcodeado en esa
  única llamada) porque no es alcanzable por un cliente externo.
- **Compatibilidad**: la app Flutter ya mandaba `Authorization: Bearer <session_token>` — sin
  cambios. El panel PWA (`alejandra-panel.html`) tenía el `adminToken` verificado en memoria
  (requerido para llegar al chat) pero no lo mandaba en `enviarChat()` — parcheado para adjuntarlo.
- `node --check` OK, diff acotado (worker.js: 70 inserciones/16 borrados; panel: 6 líneas).
  Commit `d357aa7`, push → CI `28707537198` desplegó y pasó health check.

### Pendientes (bonus detectado durante la investigación, no corregido aún)
- `/webhook/evento` tiene el mismo patrón de `usuario_id` sin verificar (aunque solo se procesa
  con IA para `eventosCriticos`) — queda naturalmente mitigado por este fix (`esDevVerificado`
  por defecto `false` para cualquier llamada que no pase explícitamente por `/api/chat` con
  token válido), pero no se ha revisado a fondo ese endpoint en sí.
- Scope de empresa en `consultar_bd`/`escribir_bd` (SQL sigue sin filtrar por `empresa_id` del
  llamante) — ahora exige sesión válida, pero un usuario autenticado de la empresa A todavía
  podría consultar/escribir datos de la empresa B si conoce el esquema. No abordado esta sesión.
- Resto de hallazgos 🟠/🟡 de la auditoría original (rate limiting, SSRF en `test_endpoint`,
  `/files/<key>` cross-tenant, tests, `ALEJANDRA_AGENTE.txt` desactualizado, ~19 handlers muertos).

---

## RESUMEN SESIÓN 04/07/2026 (continuación) — Auditoría del agente + fix tools inalcanzables

Petición: "busca mejoras que hacer en el Agente" → se refería a Alejandra IA (el chat/NEXUS),
no a la app Flutter. Auditoría en profundidad de `alejandra-agente/worker.js` (8452 líneas)
vía subagente de investigación, cubriendo seguridad/multi-tenancy, arquitectura de tools,
resiliencia, coste, observabilidad, salud del código, tests y desfase de la documentación.

### Hallazgos (documentados, NO corregidos aún salvo el marcado como hecho abajo)
- 🔴 **Crítico**: `/api/chat`/`/api/chat/stream` sin auth confían en `usuario_id` del cliente;
  `consultar_bd`/`escribir_bd` ejecutan SQL arbitrario sin scope de empresa, alcanzables desde
  ahí sin login; `ejecutar_deploy`/`rollback`/`github_escribir`/`patch_codigo` permiten que
  cualquiera reescriba y despliegue el propio Worker — `esDeveloperAgente()`/`esAdmin` son
  checks por string spoofeables, y `modo:'confirmacion'` es cosmético (no bloquea nada).
- 🟠 Además el workflow de CI (`deploy-alejandra-agente.yml`) **resetea `ADMIN_TOKEN` al valor
  hardcodeado `"alejandra2026"` en cada deploy**, deshaciendo el fix de migrate_003 que lo había
  quitado "por seguridad". Pendiente de decidir con Adrián.
- 🟠 Sin rate limiting/tope de gasto, sin tests, `/files/<key>` cross-tenant, SSRF en
  `test_endpoint`, `/fcm-token` y `/api/comandos/pendientes` sin auth.
- 🟡 `llamarGPT4oFallback` no registra coste; sin retry/backoff en 429; ~19 handlers de tools
  muertos; `ALEJANDRA_AGENTE.txt` desactualizado (tools, expertos, migraciones, crons).

### ✅ Corregido esta sesión: bug funcional — 7 tools de `capacidades_avanzadas` inalcanzables
- `buscar_precios`, `marcar_plano`, `generar_documento`, `buscar_normativa`,
  `historico_materiales`, `configurar_alerta`, `exportar_datos` estaban documentadas en el
  módulo de prompt `capacidades_avanzadas` y tenían su `case` implementado en el switch de
  ejecución, pero **no existía el schema `TOOL_*`** correspondiente ni estaban en
  `TOOLS_POR_EXPERTO` — Claude nunca podía invocarlas de verdad aunque el prompt le decía que
  existían.
- Añadidos los 7 schemas `TOOL_*` (worker.js ~1738) y cableados en `completo` e `ingenieria`
  (ya cargaban el módulo). También se detectó que el experto `tecnico` debía tener
  `capacidades_avanzadas` según una nota anterior de este mismo archivo pero no lo tenía en
  código — añadido módulo + 7 tools también a `tecnico`.
- Verificado que las tablas D1 usadas (`precios_materiales`, `normativa_index`,
  `materiales_obra`, `alertas_config`) ya existen en producción (creadas en sesión anterior).
- `node --check` OK, commit `b8f26ba`, push → CI `deploy-alejandra-agente.yml` (run
  28707002747) desplegó y pasó health check.

### Pendientes
- Decidir con Adrián si/cuándo abordar la cadena crítica de seguridad sin autenticar
  (`/api/chat`, `consultar_bd`/`escribir_bd`, deploy/rollback/github_escribir) y el reset de
  `ADMIN_TOKEN` hardcodeado en CI.
- Reescribir `ALEJANDRA_AGENTE.txt` (desactualizado en casi todos los ejes).
- Limpiar ~19 handlers de tools muertos / duplicados de una arquitectura anterior.

---

## RESUMEN SESIÓN 04/07/2026 — Fix Google OAuth panel.html + v7.54

### Hecho ✅

#### v7.54 — Eliminar card IA redundante del home
- Eliminado `cardAlejandraIA` del home (redundante con botón central del nav)
- `checkIABtn` sigue mostrando botón IA a TODOS los usuarios
- Versiones sincronizadas: json=7.54, sw=7.54, html=7.54 ✅

#### Fix Google OAuth panel.html — redirect completo en lugar de popup
- **Problema**: `doLoginGoogle()` usaba `window.open()` (popup) — muchos navegadores lo bloquean
- **Síntoma**: "cuando hago login me devuelve a la pagina de nuevo sin hacer nada"
- **Solución**: flujo redirect completo Google → worker → panel
  - `panel.html doLoginGoogle()`: hace `window.location.href = data.url` (redirect, no popup)
  - `panel.html init()`: detecta `?panel_nonce=` al volver de Google → llama `check-nonce` una vez → loga
  - `worker.js googleAuthUrl()`: incluye `panel_return` en el state de OAuth
  - `worker.js googleMobileRedirect()`: tras auth exitoso, redirige a `panel_return?panel_nonce=NONCE`
- Worker desplegado: ec049cf8 ✅
- Commit: 81f8f1d ✅

### Pendientes
- Probar el flujo OAuth completo en producción (que Adrian confirme que funciona)

---

## RESUMEN SESIÓN 29/06/2026 — Test ADB + Fixes v7.52/v7.53

### Hecho ✅

#### v7.52 — Fix adjuntos chat Alejandra IA
- **MIME type**: Android cámara enviaba `application/octet-stream` → fix client-side antes del upload
- **Preview imágenes**: Thumbnail 64x64 en zona adjuntos durante subida, luego limpio
- **Enviar sin texto**: Placeholder cambia a "Añade un mensaje o pulsa ↑ para enviar" al adjuntar foto
- **Burbuja rica**: `appendIAMsgRich` muestra miniaturas 180px en burbuja del usuario al enviar
- **Memoria de adjuntos**: `guardarMensajeChat` guarda keys R2 en `alejandra_historial` para contexto futuro
- **canal**: Cambiado de 'pwa' a 'app_android'
- **Worker alejandra-agente**: Deploy 7223953d

#### v7.53 — IA accesible para todos los usuarios
- **Card 🤖 Alejandra IA** en home: `cardAlejandraIA` insertado antes de `cardObraDashboard`
- **setupHomeModules**: Muestra `cardAlejandraIA` a todos los usuarios logados
- **checkIABtn**: Simplificado — muestra botón IA a TODOS, scan siempre oculto en nav central
- **HOME_ORDER**: `cardAlejandraIA` añadida al orden por defecto
- Commits: ecc33d0 (v7.52), a6256a4 (v7.53)

#### Test ADB HTC U11 (29/06/2026) — PASADO ✅
- CDP Chrome DevTools Protocol via ADB port forward 9222
- `version: "7.53"` ✅
- `navIABtn_computed: "flex"` (botón IA visible para todos) ✅
- `navScanBtn_computed: "none"` (scan oculto) ✅
- `setupHomeModules_hasIAFix: true` ✅
- `cardAlejandraIA_visible: "flex"` al llamar setupHomeModules ✅
- Chat IA abrió al pulsar el botón del nav ✅ (screenshot htc_ia1.png)
- `iaSendFn: "exists"` ✅

### Pendiente para próxima sesión
- Probar foto real desde cámara Android → verificar MIME fix + thumbnail + respuesta Alejandra
- Probar como usuario `encargado` (no superadmin) para confirmar IA accesible

---

## RESUMEN SESIÓN 27/06/2026 — NEW-114/115/116 + Móvil + Alejandra IA — v7.50→v7.51

### Hecho ✅

#### Backend worker.js (NEW-114, NEW-115, NEW-116)
- **NEW-114 Escandallo de Precios**: `ensureEscandalloTable` + CRUD (`getEscandallo`, `crearEscandallo`, `actualizarEscandallo`, `eliminarEscandallo`) + rutas `/escandallo-precios`
- **NEW-115 Cronograma de Pagos**: `ensureCronogramaPagosTable` + CRUD (`getCronogramaPagos`, `crearHitoPago`, `actualizarHitoPago`, `eliminarHitoPago`) + rutas `/cronograma-pagos`
- **NEW-116 RdP Registro Diario de Prevención**: `ensureRdpTable` + CRUD + `firmarRdpRegistro` (inmutable por Ley 31/1995) + rutas `/rdp-registros`
- Rutas insertadas antes del bloque NEW-113 Cubicaciones

#### Panel web panel.html (NEW-114/115/116)
- Nav buttons: `escandalloPrecios`, `cronogramaPagos` (nav-finance, ocultos a operario), `rdpRegistros` (todos los roles)
- Páginas con KPI strips + tablas Tabulator: `pageEscandalloPrecios`, `pageCronogramaPagos`, `pageRdpRegistros`
- Modales CRUD completos: `modalEp`, `modalCp`, `modalRdp`
- JS: funciones cargar/nuevo/editar/guardar/eliminar/firmar para los 3 módulos

#### App móvil index.html (RdP, Hormigonado, Formacion)
- Cards de acceso rápido en home: RdP 🛡️, Hormigonado 🏗️, Formación 📚
- Pantallas: `screenRdp`, `screenHormigonado`, `screenFormacion`
- Modales bottom-sheet: `modalRdpMobile` (crear/editar/firmar), `modalHormMobile` (CRUD)
- JS: `rdpCargarMobile`, `rdpGuardar`, `rdpFirmarMobile`, `hormCargarMobile`, `hormGuardar`, `formacionCargarMobile`
- `navTo` y `setupHomeModules` actualizados

#### Alejandra IA (NEXUS_MODULES)
- Nuevo módulo `schema_obra_avanzada` con las 8 tablas NEW-109..116 (schemas + notas legales)
- `app_modulos` actualizado con listado de todos los módulos avanzados de obra
- Expertos `analista` y `autonomo`: incluyen `schema_obra_avanzada` en sus módulos

### Estado final
- worker.js: 726 funciones, 0 dups ✅ | 21,718 líneas ✅
- Versiones sincronizadas: json=7.51, sw=7.51, html=7.51 ✅
- Commit: b81b6d3 | Worker deploy: f6a2f7af ✅

### Pendientes próxima sesión
- Verificar en producción las 3 pantallas móviles (RdP, Hormigonado, Formacion) con datos reales
- Verificar en panel las 3 páginas nuevas (Escandallo, Cronograma, RdP)
- Candidatos NEW-117+: CAPA (Control de Acciones Correctivas), Ensayos END, Informes PDF automáticos

---

## RESUMEN SESIÓN 26/06/2026 (continuación 2) — Auditoría seguridad y consolidación v7.45→v7.49

### Hecho ✅

#### v7.46 — 7 vulnerabilidades críticas corregidas (worker.js)
- getLogs: requiere auth superadmin/desarrollador (antes público)
- eliminarUsuario: SELECT+UPDATE escopado a empresa_id (IDOR)
- editarUsuario: idem + campo roles_extra restringido a superadmin/admin (escalada privilegios)
- deleteCatalogo: DELETE escopado a empresa_id (cross-company deletion)
- getUsuariosPendientes: empresa_admin solo ve pendientes de su empresa
- aprobarUsuarioPendiente: empresa_id forzado desde sesión (no override desde body)

#### v7.47 — Fixes medium + role gating en panel (worker.js + panel.html)
- buscarItemSeg: guard empresa_id añadido
- getEventos: encargado/operario no puede hacer bypass del filtro departamento via query param
- 8 páginas financieras ocultas para rol operario: presupuesto, costesObra, finanzasObra, flujoCaja, facturasProveedor, cobrosCliente, comparativosOferta, globalDashboard

#### v7.48 — Aislamiento departamentos en inventarios (worker.js + panel.html)
- getBobinas, getCarretillas, getHerramientas: roles no-admin no pueden ver otra dept via ?departamento=X
- getIncidencias: mismo fix (isAdminIncidencias)
- KPI icon sizing: placeholder card ajustado a 20px (consistente con el resto)

#### v7.49 — Fix UX modales (panel.html)
- cerrarModal* de los 5 módulos nuevos (Cu/Ar/Fo/Rh/Ls) ahora llaman form.reset() al cerrar
- Evita que re-abrir un modal tras cancelar una edición muestre campos sucios

### Worker.js: 710 funciones, 0 dups | panel.html: 30.906 líneas
### Commits: a16498e (v7.46) → ea69908 (v7.47) → 062776d (v7.48) → f19765c (v7.49)

### Pendiente proxima sesion
1. getPedidos: mismo bypass de departamento via query param (bajo impacto)
2. NEW-114: candidatos → Escandallo de Precios, Libro Rdp, CAPA, Cronograma Pagos, Ensayos END

---

## RESUMEN SESIÓN 26/06/2026 (continuación) — NEW-109 a NEW-113 v7.41→v7.45

### Hecho ✅

- **NEW-109**: Libro de Subcontratación Digital (Ley 32/2006) — v7.41 · commit  · worker - **NEW-110**: Registro de Hormigonado / Concrete Pour Log (EHE-08) — v7.42 · commit  · worker - **NEW-111**: Formación de Obra / Site Training Records (Ley 31/1995 PRL) — v7.43 · commit  · worker - **NEW-112**: Acta de Replanteo / Construction Stakeout (LOE art. 8) — v7.44 · commit  · worker - **NEW-113**: Cubicaciones de Obra / Quantity Takeoff — v7.45 · commit  · worker 
### Worker: 710 funciones, 0 dups ✅ | panel.html: 30.896 líneas ✅

### Próxima sesión — candidatos NEW-114+
1. Escandallo de Precios (desglose material+mano obra+equipo por unidad)
2. Libro de Rdp (Registro Diario de Prevención — distinto de diario de obra)
3. Control de Acciones Correctivas / CAPA
4. Cronograma de Pagos (hitos contractuales — distinto de flujo de caja)
5. Control Calidad Soldadura / Ensayos END específicos

---

## RESUMEN SESIÓN 26/06/2026 — NEW-108 Flota de Vehículos v7.40

### Hecho ✅
- NEW-108: Flota de Vehículos (worker.js + panel.html + rutas) — deploy 8a32b1be, commit d9869c4
- Diagnóstico completo: app tiene +100 módulos ya implementados — actas_reunion, accion_items, transmittals, cae_doc, licencias, catalogo_precios, seguros_obra, solicitudes_material, flujo_caja, certificaciones... todo ya existe
- Se abortó NEW-109 intento actas_reunion (ya existía) — código duplicado limpiado correctamente
- worker.js: 685 funciones, 0 dups, 20538 lineas ✅

### Pendiente próxima sesión — NEW-109
Candidatos genuinamente nuevos (verificar con grep antes de implementar):
1. Libro de Órdenes de Obra (obligatorio Ley 38/1999 España)
2. Análisis de Valor Ganado / Earned Value (EV, PV, AC, SPI, CPI)
3. KPI de Productividad por Operario
4. Muestras de Material / Material Sample Tracking
5. Control de Certificados de Calidad por partida

ANTES de NEW-109: grep -n en worker.js + panel.html para confirmar que no existe ya.

---

## RESUMEN SESIÓN 25/06/2026 — Panel office nivel Procore/Fieldwire (v6.63→v6.65)

### Objetivo
Analizar la app completa y mejorarla hasta nivel de gestión de obra de primer nivel (Procore/Fieldwire/PlanGrid).

### v6.63 — Overhaul panel office (commit 49b0362) ✅
- **5 nuevos módulos en sidebar**: Tareas ✅, RFIs ❓, Órdenes de Cambio 🔄, Actas de Reunión 📝, Control de Calidad 🔍
- Cada módulo: KPI bar + filtros por obra/estado + Tabulator full + modal CRUD completo con select de obra
- `poblarSelectObras(selectId)` async helper (fallback a `window._obrasPanel` || `_panelObras`)
- Dashboard panel extendido: 11 KPIs totales + `dashGridConstruction` (Tareas activas, RFIs abiertas, Deficiencias)
- PAGE_TITLES / PAGE_LOADERS / SYNC_INTERVALS actualizados para los 5 módulos nuevos

### v6.64 — Subcontratas completo (commit 1515605) ✅
- **worker.js**: rutas GET/POST/PUT/DELETE `/subcontratas`, `ensureSubcontratosTable`, alerta cron 30 días seguros+habilitaciones (Telegram por empresa). Deploy 930a0847.
- **panel.html**: página Subcontratas con 3 KPI tiles (total, activas, con alertas), filtro por tipo, Tabulator + modal CRUD
- **index.html**: card módulo `cardSubcontratas` en home, `screenSubcontratas` con 3 filtros, `modalSubcontrata` con todos los campos, funciones `subcCargar/subcFiltrar/renderSubcList/subcNueva/subcEditar/subcGuardar/subcEliminar`
- `cargarObrasPanel` (primera, línea ~3732) actualizada para poblar selects de obras en Presupuesto, Fases y Partes también

### v6.65 — Presupuesto, Fases y Partes Diarios en panel (commit 170ad54) ✅
- **panel.html**: 3 páginas nuevas usando APIs ya existentes en worker.js
  - Presupuesto de Obra: KPIs previsto/real/desviación + gráfico por categoría + Tabulator groupBy categoría
  - Fases de Obra: KPI cards (total/en curso/completadas/avgPct) + phase cards con progress bar + fechas
  - Partes Diarios: Tabulator con fecha/obra/encargado/descripción/nº personal
- No requirió deploy de worker (APIs `/presupuesto-obra`, `/fases-obra`, `/partes-trabajo` ya existían)

### Archivos modificados
- `panel.html` — +1.500 líneas aproximadamente (v6.63→v6.65)
- `index.html` — card + screen + modal + funciones subcontratas (v6.64)
- `worker.js` — CRUD subcontratas + alerta cron (v6.64), deploy 930a0847
- `sw.js` — v6.63→v6.65
- `version.json` — v6.63→v6.65

### Pendientes de esta sesión
- [ ] Continuar mejoras: KPI presupuesto en dashboard principal panel
- [ ] Mejor Gantt visual en panel (timeline CSS con barras apiladas)
- [ ] Correspondencia / cartas formales tracking
- [ ] Hitos de obra con alertas automáticas
- [ ] KPIs diarios de productividad (m2 instalados, unidades, etc.)
- [ ] Informes PDF automáticos
- [ ] Instalar APK v1.9.17 en móvil
- [ ] Añadir email real a Alberto

---

## RESUMEN SESIÓN 24/06/2026 (4ª continuación) — Dashboard con gráficas + Fases de obra + Diario de obra + Alejandra IA potenciada

### Objetivo
Análisis completo de la app y mejora hasta nivel de gestión de obra de primer nivel (Procore/Fieldwire/PlanGrid). Se identificaron 5 gaps críticos y se implementaron los 3 más impactantes. También se potencia Alejandra IA como ventaja diferencial.

### Cambios — commit `b37371f` ✅

**`worker.js` (principal)** · deploy `0df16a74` ✅

1. **`getObraDashboard` extendido**: 2 nuevas queries paralelas — `fichajes_semana` (últimas 8 semanas agrupadas) e `incidencias_tipo` (count por tipo). Devueltos en el JSON para las gráficas.

2. **Nuevas rutas Fases de obra** (`/fases-obra` GET/POST, `/fases-obra/:id` PUT/DELETE):
   - `ensureFasesObraTable` + CRUD completo
   - Tabla `fases_obra`: id, obra_id, empresa_id, nombre, descripcion, fecha_inicio_plan, fecha_fin_plan, fecha_inicio_real, fecha_fin_real, porcentaje, estado, responsable, orden, created_at

3. **Nuevas rutas Diario de obra** (`/diario-obra` GET/POST, `/diario-obra/:id` PUT/DELETE):
   - `ensureDiarioObraTable` + CRUD completo
   - Tabla `diario_obra`: id, obra_id, empresa_id, fecha, clima, temperatura, trabajos, personal_presente, equipos_activos, incidencias_dia, visitantes, observaciones, creado_por, created_at

**`index.html`** · v6.48 ✅

1. **Chart.js CDN** añadido (`chart.js@4.4.3/dist/chart.umd.min.js`)
2. **`modalFaseObra`** (NEW-30): campos nombre/descripcion/fechas/responsable/estado/porcentaje (slider).
3. **`modalDiarioObra`** (NEW-31): campos fecha/clima (selector emojis)/temperatura/trabajos/personal/equipos/incidencias/visitantes/observaciones.
4. **`cargarObraDashboard` reescrita** con 4 pestañas: Resumen · Gráficas · Fases · Diario
5. **Chart.js**: bar chart fichajes/semana (8 sem), doughnut incidencias por tipo, doughnut equipos disponibles vs mantenimiento
6. **Funciones CRUD Fases**: `fasesCargar`, `fasesNueva`, `fasesEditar`, `fasesGuardar`, `fasesEliminar`, `fasesActualizarProgreso` (update inline sin reload)
7. **Funciones CRUD Diario**: `diarioCargar`, `diarioNuevo` (auto-rellena personal desde fichajes del día), `diarioGuardar`, `diarioEliminar`

**`alejandra-agente/worker.js`** · deploy `4fc6c53b` ✅

1. **`TOOL_ESTADO_OBRA`** (nueva): resumen ejecutivo — KPIs actuales, fases con %, últimas 3 entradas del diario, incidencias activas. Añadida a expertos `app` y `completo`.
2. **Handler `case 'estado_obra'`**: 4 queries paralelas D1. Formato narrativo con emojis, alertas fases retrasadas, promedio personal/día.
3. **Módulo `inteligencia_negocio` extendido**: sección v6.48+ con instrucciones para fases, diario y briefing inteligente.

### Workers desplegados
- `alejandra-app-api` → `0df16a74-3c6b-4ee9-bb45-fa9895a5cbec` ✅
- `alejandra-agente` → `4fc6c53b-16eb-471b-853b-182eae6cb3d8` ✅

### Cómo probar
- **Dashboard**: ir a cualquier obra → pestaña Resumen/Gráficas/Fases/Diario
- **Fases**: pestaña Fases → ➕ Nueva fase → guardar → ajustar slider % → actualizar
- **Diario**: pestaña Diario → ➕ Nueva entrada → rellenar clima/trabajos → guardar
- **Alejandra**: "¿Cómo va la obra 1?" → usa `estado_obra` → resumen ejecutivo con fases + diario + KPIs

---
## RESUMEN SESIÓN 24/06/2026 (3ª continuación) — Esquemas IA en docs de obra + explorador archivos

### Cambios — commit `a0033a1` ✅

**`alejandra-agente/worker.js`** · deploy `a77bf132` ✅

1. **`TOOL_GENERAR_ESQUEMA` + parámetro `obra_id`**: si se pasa `obra_id`, tras subir los archivos a R2, hace query a `obras` para sacar `empresa_id` e INSERT en `documentos_obra` (tipo='otro', elaborado_por='Alejandra IA'). El mensaje de respuesta añade "📂 Guardado en documentos de la obra".

2. **`TOOL_LISTAR_ESQUEMAS`** (nueva): consulta `documentos_obra` WHERE `elaborado_por='Alejandra IA'`, con JOIN a `obras` para el nombre. Filtro opcional por `obra_id`. Devuelve `url_viewer` y `url_svg` públicas derivadas del `r2_key`.

3. **`TOOL_BORRAR_ESQUEMA`** (nueva): borra de R2 el `.html` y el `.svg` correspondiente, y el registro en `documentos_obra`. Se puede pasar `documento_id` para búsqueda más rápida.

4. Ambas nuevas tools añadidas a `app`, `completo` e `ingenieria` en `TOOLS_POR_EXPERTO`.

**`worker.js` (principal)** · deploy `1ccf42f8` ✅

1. **`getDocumentosObra`**: nuevo filtro `?elaborado_por=` para separar docs PRL de esquemas IA.
2. **`eliminarDocumentoObra`**: si `r2_key.startsWith('esquemas/')`, borra también de R2 (`.html` + `.svg`) antes de eliminar el registro en BD. Non-fatal (try/catch).

**`index.html`** · v6.47 ✅

1. **`docsCargar()`**: añade `/documentos-obra?obra_id=X&elaborado_por=Alejandra+IA` a las llamadas en paralelo.
2. Sección **"📐 ESQUEMAS IA"** al final del contenido Docs: separador visual, lista de esquemas con botones:
   - 🔗 Abrir (abre `url_viewer` en nueva pestaña)
   - ✏️ Renombrar (`docsEsquemaRenombrar`: prompt + PUT `/documentos-obra/{id}`)
   - 🗑️ Eliminar (`docsEsquemaBorrar`: confirm + DELETE `/documentos-obra/{id}` → borra R2 + BD)
3. Estado vacío actualizado: solo muestra "Sin documentos" si no hay carpetas, archivos, notas NI esquemas.

### Cómo usar

**Para que el esquema aparezca en Docs de la app:**
- "Hazme un esquema de arranque DOL para motor bomba de la obra 5" → Alejandra pedirá confirmación y llamará `generar_esquema_electrico` con `obra_id=5`
- O directamente: "genera el esquema para la obra 5" → Alejandra pasa `obra_id=5`

**Para gestionar esquemas desde la app:**
- Ir a Docs de la obra → sección "📐 ESQUEMAS IA" al final
- 🔗 → abre el visor interactivo (zoom, impresión, marca IEC 60617)
- ✏️ → renombra el título que aparece en la lista
- 🗑️ → elimina de R2 (HTML + SVG) y de la BD

**Para que Alejandra los gestione:**
- "Muéstrame los esquemas de la obra 5" → `listar_esquemas` con `obra_id=5`
- "Borra el esquema del motor bomba" → Alejandra lista + `borrar_esquema` con el `r2_key`

---

## RESUMEN SESIÓN 24/06/2026 (continuación) — Fix DOL SVG server-side + deploy + test E2E

### Problema resuelto
La generación de esquemas DOL fallaba porque el modelo intentaba incrustar el SVG completo (3000-5000 chars) dentro del JSON de la tool call, excediendo `maxTokens`. El modelo solo ejecutaba `pensar` y devolvía "He ejecutado 1 acción(es)" sin generar el esquema.

### Cambios — `alejandra-agente/worker.js` · deploy `6ba9c884` ✅

1. **`TOOL_GENERAR_ESQUEMA` rediseñada con MODO A / MODO B:**
   - **MODO A** (nuevo, recomendado): `tipo` + `componentes: {contactor, motor, guardamotor, ...}` → SVG generado server-side
   - **MODO B** (anterior): `svg_content` con SVG completo manual (para circuitos no estándar)
   - `svg_content` ya NO es `required` — solo `titulo` y `tipo` son obligatorios
   - `componentes` como nuevo campo con 11 subpropiedades documentadas

2. **Instrucción NEXUS actualizada:**
   - Para DOL y arranques estándar → SIEMPRE usar `componentes`, NUNCA `svg_content`
   - Workflow actualizado en 5 pasos explícitos con indicación de modo A/B

### Test E2E verificado ✅
- Routing: `experto: ingenieria` ✅
- Llama `generar_esquema_electrico` 2 veces (potencia_motor + mando_motor) con `componentes` ✅
- 6 archivos creados en R2 `esquemas/` (3 HTML viewer + 3 SVG puro) verificados ✅
- SVG descargado y verificado: 900×660px, IEC 60617, L1/L2/L3, QF1, KM1, RTE1, M1 ✅
- Cálculo automático ITC-BT-47: In=15.2A → cable mín. 2.5mm² Cu ✅

### ✅ IMPLEMENTADO — Compartir esquemas

3 cambios en `alejandra-agente/worker.js`:

1. **Endpoint público `/api/esquemas/view/<archivo>`** — sirve R2 `esquemas/` sin auth → URL directa para descargar/WhatsApp
2. **`enviar_email` + adjunto SVG** — si `r2_key` es `.svg` → adjunta como fichero `image/svg+xml` en Resend; si es `.html` → HTML inline (ya funciona)
3. **`enviar_telegram_informe` + SVG** — si `r2_key` termina en `.svg` → `sendDocument` con MIME `image/svg+xml` (Telegram previsualiza inline)
4. **`generar_esquema_electrico`** — devolver `url_viewer` y `url_svg` públicas en la respuesta del tool
- WhatsApp: el usuario copia la URL pública y la pega (sin API Meta = no hay alternativa)

---

## RESUMEN SESIÓN 24/06/2026 — Alejandra ingeniera eléctrica experta

### Cambios

**alejandra-agente/worker.js** — commit `1a70b5c` · deploy `849a450a` ✅

1. **Módulo NEXUS `ingenieria_electrica`** (+~250 líneas de conocimiento técnico):
   - REBT completo: ITC-BT-01 a BT-51 con valores numéricos reales (secciones, calibres, distancias, límites)
   - Cálculos: sección cable, caída tensión, cortocircuito, motores, iluminación, factor potencia
   - Normativa MT (RD 337/2014), puesta a tierra (TT/TN-S/IT), sistemas de distribución
   - Electrónica e ingeniería de control industrial: PLCs (Siemens/AB/Schneider/Omron), VFDs, arrancadores (DOL/Y-Δ/softstarter), sensores industriales, redes (PROFIBUS/PROFINET/Modbus/CANopen), SCADA/HMI, PID, instrumentación
   - Cuadros EN 61439: tipos, formas de separación, grados IP
   - Instrucciones detalladas para generar SVG con símbolos IEC 60617 (cuadrícula 40px, colores, estructura, tipos de esquema)

2. **Nueva tool `generar_esquema_electrico`**:
   - Alejandra genera el SVG completa con símbolos IEC (el LLM hace el dibujo real)
   - La tool envuelve el SVG en visor HTML con zoom/impresión estilo Alejandra (naranja)
   - Guarda en R2: `esquemas/YYYY-MM-DD_tipo_titulo.html` + `.svg` puro
   - Devuelve ambas claves para compartir por email/Telegram

3. **Análisis de fotos de cuadros eléctricos** — prompt mejorado:
   - Identifica cada componente con tipo, marca, referencia, calibre y función
   - Lista incumplimientos normativos con artículo específico
   - Evalúa riesgos (RD 614/2001)
   - Describe cómo sería el esquema eléctrico de lo que ve

4. **Routing mejorado**:
   - REGEX_ROUTES: añadidas palabras clave (cuadro eléctrico, esquema, PLC, variador, motor eléctrico, transformador, puesta a tierra, arranque, DOL, estrella-triángulo, circuito de mando...)
   - Haiku classifier: instrucción explícita de ruta → `ingenieria` para electricidad/esquemas/control
   - `maxTokens` ingeniería: 2048 → 4096

### Cómo probarlo
- "Hazme un esquema de arranque directo de un motor de 5,5kW" → esquema SVG guardado en R2
- "Qué sección necesita un circuito de 10kW a 400V trifásico con 30m de recorrido?" → cálculo con fórmulas
- "Analiza esta foto" [adjuntar foto de cuadro] → análisis completo de componentes + incumplimientos + esquema sugerido
- "Explícame cómo funciona un arranque estrella-triángulo" → respuesta técnica detallada
- "Qué dice la ITC-BT-47 sobre motores?" → normativa exacta

---

## RESUMEN SESIÓN 23/06/2026 (noche) — RESEND_API_KEY agente + fixes datos D1

### Cambios

**alejandra-agente/worker.js** — sin cambios de código funcional, solo documentación PRL en NEXUS_MODULES.app.
Deploy: `95519a18` ✅

**Secrets:**
- `RESEND_API_KEY` añadida al worker `alejandra-agente` (antes solo estaba en el principal).
- Guardada en `NUEVA_CUENTA.txt`. Ahora `enviar_email` funciona en el agente.

**Fixes de datos en D1 (sin tocar código):**
- ✅ 46 bobinas `estado='activa'` → `estado='disponible'` (estado inválido desde auditoría jun/13)
- ✅ Alberto (id=51, código 98765): `password_hash` generado con PBKDF2. Contraseña temporal = `98765`. Puede hacer login ya.
- ✅ Carretilla A-476326XT (id=2): `fecha_proxima_revision` estaba como string vacío `""` → puesto a NULL. Sin falsas alertas.
- ✅ PEMP 40 y 41 (Tijeras 47107 y 135): reasignados de `obra_id=11` (Edison) a `obra_id=1, obra_nombre='CPD Getafe'` (Levitec). Incoherencia de empresa/obra resuelta.

### Pendientes resueltos
- [x] RESEND_API_KEY en agente
- [x] Bobinas estado 'activa' inválido
- [x] Alberto sin contraseña
- [x] Carretilla A-476326XT fecha vacía
- [x] PEMP 40/41 empresa/obra incoherente

### Sin cambios de versión
No se modificaron archivos de código → versión sigue en 6.46.

---

## RESUMEN SESIÓN 23/06/2026 (tarde) — Informes HTML + Email + Telegram + PRL para Alejandra

### Cambios implementados

**alejandra-agente/worker.js** — 5 edits:

1. **Sistema prompt NEXUS base** — añadidas secciones de PRL y generación de informes. Alejandra ahora es técnico superior en PRL (RD 39/1997, Ley 31/1995, REBT, EPIs, evaluaciones de riesgo, protocolos de emergencia). Sabe generar informes en HTML.

2. **3 nuevas tool definitions** (añadidas tras TOOL_ENVIAR_PUSH):
   - `TOOL_GENERAR_INFORME` — consulta BD (fichajes, incidencias, bobinas, equipos, pedidos) y genera HTML completo en R2.
   - `TOOL_ENVIAR_EMAIL` — envía email via Resend API (soporte para cuerpo libre o informe R2 como HTML inline).
   - `TOOL_ENVIAR_TELEGRAM_INFORME` — envía mensaje o documento HTML via Telegram Bot API (`sendDocument` con multipart).

3. **TOOLS_POR_EXPERTO** — los 3 tools nuevos añadidos a `app`, `completo` e `ingenieria`.

4. **ejecutarTool** — 3 nuevos `case` blocks:
   - `generar_informe`: tipos general/fichajes/personal/incidencias/bobinas/material/equipos/pedidos. Filtrable por obra_id. HTML guardado en `informes/YYYY-MM-DD_tipo_titulo.html` en R2.
   - `enviar_email`: usa `env.RESEND_API_KEY`, from `alejandra@alejandraapp.com`. Si hay `r2_key`, lo carga y lo manda como HTML.
   - `enviar_telegram_informe`: resuelve `chat_id` de `alejandra_memoria` (tipo='telegram_chat_id') si no se pasa explícito. Sube documento con `FormData` multipart.

5. **Funciones helper HTML** (antes de `ejecutarReflexion`):
   - `generarPlantillaInforme()` — template HTML completo con branding naranja Alejandra, header oscuro, tabla CSS responsive, footer.
   - `generarTablaFichajes()`, `generarTablaIncidencias()`, `generarTablaBobinas()`, `generarTablaEquipos()`, `generarTablaPedidos()` — secciones de tabla por tipo.

### Despliegue
- `alejandra-agente` → `2c2447ac` ✅ (345.64 KiB / gzip 90.67 KiB)

### ⚠️ Acción pendiente — RESEND_API_KEY

El secret existe en `alejandra-app-api` pero NO en `alejandra-agente`. Sin él, `enviar_email` devuelve error controlado.

Para añadirlo:
```powershell
cd "D:\Descargas\Alejandra APP\alejandra-agente"
npx wrangler secret put RESEND_API_KEY --name alejandra-agente
# Pegar la clave cuando la pida (la tienes en el panel de Resend o en los secrets del worker principal)
```

### WhatsApp
Requiere aprobación de Meta Business API (no se puede usar libremente). El código framework está en la tool pero se devuelve error informativo hasta que se configure la cuenta.

### Commits pendientes
- `alejandra-agente/worker.js` modificado, sin commit (solo el agente). Hacer git add + commit + push cuando confirmes que funciona.

---

## RESUMEN SESIÓN 23/06/2026 — Fix push notifications (3 bugs) + saludo fresco Alejandra

### Diagnóstico

Al decir "Hola" en la app, Alejandra respondió con contexto técnico del push de 10 días antes.
Análisis completo del flujo push reveló 3 bugs independientes.

### Bug 1 — Alias 'adrian' no existía en BD ✅ ARREGLADO
- CRON y deploys buscan siempre `usuario_id='adrian'` en `alejandra_memoria`
- El token de Adrián estaba guardado como `'3'` pero nunca se copió al alias `'adrian'`
- Fix: INSERT directo en D1 (id=163) + el endpoint `/fcm-token` ya tenía el código para crearlo automáticamente en próximas aperturas de app

### Bug 2 — Tap en notificación con app cerrada no navegaba al chat ✅ ARREGLADO
- Root cause: `getInitialMessage()` se llama en `main()` antes de `runApp()` → `MainShell` no existe → `tabNotifier.value = 0` no tiene listeners → no hace nada
- Además: cuando el usuario navega manualmente a otro tab, `tabNotifier.value` no se actualizaba → `_navigateToChat()` intentaba poner 0 (ya era 0) → sin efecto
- Fix Flutter:
  - `notifications_service.dart`: `getInitialMessage` guarda en `_pendingScreen` en vez de navegar. Método estático `consumePendingNavigation()`.
  - `main.dart` `_onTabChanged`: sincroniza `tabNotifier.value = i` para mantener estado real.
  - `main.dart` `initState` `postFrameCallback`: consume `_pendingScreen` y navega cuando MainShell ya está listo.

### Bug 3 — Alejandra retomaba contexto técnico tras saludo después de días ✅ ARREGLADO
- Root cause: historial cross-canal compartido → al decir "Hola" cargaba conversación del 13/06 sobre el push
- Fix `alejandra-agente/worker.js` en `construirMessages()`: detecta saludo simple + gap >2h → inyecta instrucción de respuesta fresca

### Despliegues
- `alejandra-agente` → `1b92ba3b` ✅
- `alejandra-app-api` → `230a71f8` (redeploy) ✅
- APK v1.9.17+31 → R2 `apk/alejandra_ia_v1.9.17.apk` + `latest` ✅
- OTA `ota/version.json` → version_code=31, version_name=1.9.17, SHA-256=`52B2C9...` ✅

### Commits
- AlejandraIA `66c5d18` — fix(notifications): tap en notif abre chat correctamente v1.9.17+31
- Alejandra-APP `5395dcf` — fix(agente): saludo fresco tras inactividad + alias FCM adrian en BD

### Pendientes
- Instalar v1.9.17 en el móvil (OTA automático o manual desde R2)
- Confirmar que tap en notificación ya navega al chat
- Mejoras para Alejandra (pendientes de pedir en esta sesión)
- Estados bobinas: 46/47 con estado 'activa' inválido → UPDATE a 'disponible'
- Alberto (código 98765): sin email ni password_hash
- Carretilla A-476326XT: fecha_proxima_revision vencida
- PEMP 40/41: decidir reasignación

---

## RESUMEN SESIÓN 13/06/2026 (tarde) — Plan enseñanza Fases 3-5 + fixes autónomos

### Fase 3 — Lectura de código
- Alejandra localizó `crearFichaje` (línea 7398) por sí sola con grep.
- Explicó todos los parámetros, campos y lógica especial (anti-duplicado, cálculo horas, detección retraso).
- Localizó el bug de sábados sin que se lo pidiera → diagnosticó la causa (fichajes pre-parche con horas_extra=0).

### Fase 4 — Fix autónomo de código
- Detectó que "Sí, corrígelos todos" fue enrutado a experto `simple` por NEXUS → sin `escribir_bd`.
- Trazó el clasificador (Capa 1 regex + Capa 2 Haiku), encontró la causa raíz.
- **Fix v1**: lista de 40 verbos imperativos → parcial (no cubría "ponlos").
- Recibió feedback → **Fix v2**: regex de pronombre enclítico `\w+(lo|la|los|las|...)` → cubre todo el español. Además actualizó el prompt de Haiku como segunda red. Deploy verificado.

### Fix de datos — horas_extra sábados/domingos
- **44 fichajes** históricos corregidos: todos los sábados/domingos con horas_extra=0 teniendo horas_trabajadas>0 (pre-parche Task #36). Task #37 cerrado.

### Fase 5 — Auditoría proactiva
- Sin ninguna indicación, auditó 15+ tablas y encontró 11 problemas reales priorizados por impacto.
- Hallazgos críticos: bobinas sin longitud, push roto (case-sensitive), fichaje imposible Yousuf.
- Hallazgos altos: estados bobinas inválidos, carretilla vencida, Alberto sin login, fichaje 18h de prueba.

### Push — pendiente
- Intentó diagnosticar el push pero agotó iteraciones (14-15 tools por turno en búsqueda exploratoria).
- Al darle los datos directamente (fcm_token en memoria y push_subscriptions), la cuenta Anthropic se quedó **sin créditos** → respondió en modo GPT-4o de respaldo.
- Fix pendiente para próxima sesión.

### Pendientes urgentes
1. **⚠️ Recargar créditos Anthropic** (console.anthropic.com → Billing)
2. Fix push: `push_subscriptions` tiene `usuario_id='Adrian'` (mayúscula) vs `'adrian'`. Y `enviarFCM` usa `alejandra_memoria` (token user_id=3 correcto), pero el CRON puede usar `push_subscriptions`.
3. Estados bobinas: 46/47 con estado `'activa'` inválido → UPDATE a `'disponible'`.
4. Alberto (código 98765): sin email ni password_hash → no puede hacer login.
5. Carretilla A-476326XT: fecha_proxima_revision vencida.
6. PEMP 40/41: decidir reasignación.

---

## RESUMEN SESIÓN 13/06/2026 — Plan de enseñanza Alejandra (Fases 1 y 2)

### Contexto
Alejandra fallaba al crear usuarios desde la app: no sabía que `codigo` es NOT NULL UNIQUE, y la regla del módulo `asistente_escaneo` bloqueaba INSERTs sin confirmación explícita. Se aplicó en sesión anterior (commit `44f9d9d`) una instrucción mínima de autonomía en `inteligencia_negocio`. Esta sesión inició el plan de enseñanza progresiva: Alejandra aprende explorando, no por instrucciones hardcodeadas.

### Ejercicios completados

**Ejercicio 1.1 — Mapa de tablas:**
- Listó las 81 tablas de la BD con `sqlite_master`, las organizó por módulo funcional.
- Guardó el mapa en `memory_save` (importancia 4) para consultarlo sin query.

**Ejercicio 1.2 — Schema de usuarios:**
- Usó 6 PRAGMAs (`table_info`, `index_list`, `index_info`) para descubrir constraints.
- Aprendió: `codigo` NOT NULL UNIQUE, `nombre` y `rol` NOT NULL, `empresa_id` default 1.
- Guardó en `memory_save` con importancia 5 (crítico).
- Ahora sabe verificar duplicados con SELECT antes del INSERT.

**Ejercicio 2.1 — Crear y borrar usuario de prueba:**
- Creó "Trabajador Test" (id=59, empresa_id=3) verificando duplicado → INSERT → SELECT de confirmación.
- Borró el usuario de prueba sin que se lo pidieran.

**Ejercicio 2.2 — Tarea real (Edison Montajes):**
- Ronda 1: encontró 11 fichajes huérfanos semana actual, consultó `personal_externo`, creó 10 usuarios (ids 60-69: Sergio, David, Selin, Daniel, Hermenegildo, Robert, Ricardo, Javi, Adrian, Yousuf), reasignó 8 grupos de fichajes.
- Ronda 2: detectó que Javi/Adrian/Yousuf seguían pendientes (personal_externo_ids 11/12/13), los resolvió. **Total: 42 fichajes huérfanos resueltos, 0 restantes en obra 11.**

**Ejercicio final — Repetir la tarea de la foto:**
- Generó tabla completa viernes 12/06 (10 personas) + sábado 13/06 (5 personas).
- Detectó sola: Daniel y Hermenegildo con 0h pese a fichar 5h, sábado horas_extra=0 (bug conocido Task #37), trabajadores ausentes el sábado.
- Intentó recuperar la foto original del chat (`chat_files/3/1781343326178...jpg`).
- Ofreció corregir anomalías sin que se lo pidieran.

### Commits esta sesión
- `44f9d9d` — fix(agente): autonomía personal — explorar BD y aprender ← **ACTUAL** (hecho en sesión anterior, desplegado)

### Sin cambios de código esta sesión
No se modificaron archivos del repo. Toda la actividad fue aprendizaje de Alejandra vía API (ejercicios enviados por panel).

### Pendientes
- **Fase 3 del plan de enseñanza**: Alejandra lee código del worker, explica flujos, detecta funciones.
- **Task #37**: Verificar horas_extra en fichajes de sábado (debería ser 100% extra).
- **Daniel y Hermenegildo**: 0 horas registradas en 12/06 (08:00-13:00 = 5h). Corregir con UPDATE.
- **PEMP 40/41**: decidir reasignación (empresa_id=1 pero obra_id=11 de Edison).
- **v1.9.17**: bugs medios Flutter (Timers, listeners, TTS, scroll).

---

## RESUMEN SESIÓN 12/06/2026 — Cadena fixes chat móvil (#8–#13)

### Contexto
Tras el deploy de v1.9.16+30 (sesión anterior), Adrián reportó que al cerrar la app, Alejandra "deja de hacer lo que la he mandado". Test E2E real desde su móvil (conectado por ADB inalámbrico) descubrió **una cascada de 6 bugs distintos** que solo se manifestaban con la combinación cliente-cierra-app + procesamiento-largo.

### Bugs descubiertos y fixes

**#8 — `ctx.waitUntil` timeout en Cloudflare Workers**
- Síntoma: BD vacía tras cerrar app. Logs: `waitUntil() tasks did not complete within the allowed time after invocation end and have been cancelled`.
- Causa: el waitUntil tiene solo ~30s tras enviar la response. Con 6+ iteraciones de tools se excede.
- Fix: `MAX_ITER=4` para canales móviles + watchdog interno que corta a 22s.

**#9 — Salida del watchdog dejaba `messages` rotos**
- Síntoma: si watchdog cortaba, la siguiente llamada a `llamarAnthropicStream` daba 400.
- Fix: flag `cortadoPorTimeout`. Si activo, NO llamar a Anthropic — devolver resumen parcial.

**#10 — `tool_result` con `tool_use_id='force_respond'` inválido**
- Síntoma: `Anthropic 400: unexpected tool_use_id found in tool_result blocks: force_respond`.
- Causa: el código original (anterior a esta sesión) inyectaba un tool_result con id falso para "forzar" respuesta cuando se acababan iteraciones. Anthropic valida y rechaza.
- Fix: eliminar la inyección. Sin tools en la siguiente llamada, el modelo ya devuelve texto solo.

**#11 — Segunda llamada a `llamarAnthropicStream` se cancelaba**
- Síntoma: respuesta "Sin respuesta" (13c) cuando el cliente cierra.
- Causa: tras el while de tools, se hacía otra llamada a Anthropic en streaming para enviar tokens al cliente. Si el cliente ya cerró, el fetch se cancela y cae al fallback genérico.
- Fix: en canal móvil, NO hacer la segunda llamada. Usar `respAPI.content` del último call del while. Si vacío y hay tools → resumen útil. Nunca "Sin respuesta".

**#12 — `click_action: FLUTTER_NOTIFICATION_CLICK` impedía abrir la app**
- Síntoma: la notif FCM llegaba pero pulsarla no abría la app (la notif desaparecía sin hacer nada).
- Causa: el payload FCM pedía un intent-filter con esa action, pero el `AndroidManifest.xml` no lo tiene.
- Fix: quitar `click_action`. Android usa el launcher por defecto → abre MainActivity → MainShell muestra tab Chat.

**#13 — Modelo gastaba todas las iteraciones consultando sin formular**
- Síntoma: respuesta tipo "He revisado lo que pediste con 3 consultas: • consultar_bd • consultar_bd…" — los tools se ejecutaron pero el modelo no produjo respuesta final útil.
- Fix: cuando `queda < 2`, inyectar un text block en el último `user` message (con tool_results): "[INSTRUCCIÓN FINAL: Es tu turno de responder. Con los datos que ya has obtenido formula la respuesta AHORA en español, clara y directa. NO uses más herramientas.]".

### Verificación E2E con el móvil real
Test final con la pregunta "cuántas PEMP tenemos?":
- ✅ Sin error 400.
- ✅ Push llega con preview real (no "Sin respuesta").
- ✅ Pulsar la notif abre la app y entra al chat (tab 0 — Chat).
- ✅ Adrián confirmó que la notif sí abre el chat ("Se abrió la app y fui al chat").

### Despliegues del worker agente esta sesión
- `586bdb1e` — fix #8 (watchdog).
- `38746a6a` — fix #9 (salir limpio del watchdog).
- `02f6810e` — fix #10 (eliminar force_respond).
- `45ded0b5` — fix #11 (saltar stream en móvil).
- `01db2461` — fix #12 (quitar click_action).
- `12372c61` — fix #13 (instrucción explícita) ← **ACTUAL**.

### Commits
- Alejandra-APP `515f3a6` — fix(agente): cadena de fixes para chat en canal móvil (#8–#13).

### Aprendizajes técnicos clave de la sesión
1. **`ctx.waitUntil` no es ilimitado**: ~30s tras response en Workers. Para tareas más largas hay que usar Queues, Durable Objects o Workflows.
2. **`req.signal` y `writer.write` no son fiables para detectar cliente desconectado en SSE**: `req.signal.aborted` no se dispara y los writes se bufferean. Mejor enviar push siempre y filtrar en el cliente.
3. **`click_action` en FCM requiere intent-filter dedicado**: si no está, la notif no abre nada. Mejor omitirlo y dejar que Android use el launcher.
4. **`tool_use_id` falsos en `tool_result` son rechazados por Anthropic** con 400. No hay forma de "forzar respuesta" por ese path — usar text blocks normales en su lugar.

### Pendientes
- Mejorar calidad respuesta en móvil: a veces sigue gastando MAX_ITER consultando antes de formular. Posible mitigación: subir MAX_ITER a 5–6 + endurecer la instrucción final.
- Bugs medios v1.9.17: Timers/listeners en `background_service.dart`, TTS callbacks acumulados, throttle `_scrollToBottom`.
- Decidir destino de PEMP 40/41 y fichajes 8–15.
- Foreground service 30+ min.
- Probar albarán universal con foto real.

---

## RESUMEN SESIÓN 11/06/2026 (noche-tarde) — Test E2E FCM-cierre-app + fix push siempre v1.9.16+30

---

## RESUMEN SESIÓN 11/06/2026 (noche-tarde) — Test E2E FCM-cierre-app + fix push siempre v1.9.16+30

### Contexto
Tras los 4 fixes Flutter de la sesión anterior, Adrián reportó que **al cerrar la app, Alejandra dejaba de hacer lo que le mandó**. Sospecha del flujo SSE + `ctx.waitUntil`. Prueba E2E vía ADB en el móvil del usuario.

### Test E2E realizado
1. ADB inalámbrico activado en el Oppo (192.168.1.153:5555). Móvil ya tenía v1.9.15+29 instalada vía OTA.
2. Vía `adb shell input tap/text` se envió un mensaje desde la app, se cerró con `am force-stop`, se esperó 90s, se inspeccionó BD y notificaciones.
3. Resultado: la respuesta del asistente sí se guardó en `alejandra_historial` (id 1162) → `ctx.waitUntil` (fix #5) funciona. PERO el FCM nunca llegó al móvil.

### Diagnóstico del bug del FCM
Con `wrangler tail` en vivo:
```
[chat/stream] cierre: clienteDesconectado=false esCanalMovil=true canal=app_android usuario_id=3 respTexto=sí(2c)
```
La condición `clienteDesconectado` quedaba en `false` aunque el cliente real ya había cerrado:
- `writer.write` NO falla cuando el `readable` lado del TransformStream se cierra (Cloudflare bufferea).
- `req.signal.aborted` tampoco se activa fiable para SSE incoming en Workers.
→ El fix #4 no enviaba el push porque la condición no se cumplía.

### Fix aplicado (Fix #7 — push siempre + filtro foreground)
- **Worker `/api/chat/stream`**: enviar SIEMPRE el FCM para canales móviles (`app_android`, `pwa`) cuando hay `respFinal.texto` y `fcm_token`. Sin depender de `clienteDesconectado`. Logs explícitos en console.
- **`enviarFCM(env, token, titulo, cuerpo, extraData)`**: nuevo parámetro `extraData` que se merge con `{tipo, screen}` base. Para chat usa `tipo='chat_respuesta'`.
- **Flutter `notifications_service.dart` `onMessage.listen`**: si `message.data['tipo'] === 'chat_respuesta'` y la app está en foreground → ignorar (la respuesta ya aparece en pantalla via SSE). En background/closed, Android usa el `notification` payload y muestra normal.
- **Fix #6 (req.signal)**: implementado y luego descartado — confirmado que no es fiable en Workers para SSE.

### Verificación final en producción
```
POST /api/chat/stream - Canceled @ 22:48:33
[chat/stream] cierre: esCanalMovil=true canal=app_android usuario_id=3 respTexto=sí(4c) clienteDesconectado=false
[chat/stream] FCM enviado a usuario_id=3: {"ok":true,"status":200,"name":"projects/alejandra-ia-app/messages/0:1781210918878089%4fc7ce384fc7ce38"}
```
Notificación llegó al móvil (icono Alejandra visible en lockscreen, `numPostedByApp=11` vs 10 anterior).

### Versionado y despliegues
- AlejandraIA: v1.9.15+29 → **v1.9.16+30**. APK 57.4 MB. SHA-256 `594568...8fdf98db`.
- Subido a R2 (versionado + latest) + Google Drive + `ota/version.json`.
- `alejandra-agente` deploys: `c942c854` (fix #6) → `b24b75cd` (fix #7 actual).
- `alejandra-app-api` redeploy: `9cba5b4b` (vía build_release.ps1).

### Commits
- AlejandraIA `e95cef1` — feat: filtrar FCM chat_respuesta en foreground.
- Alejandra-APP `84e9c68` — fix(agente): push FCM siempre en canales móviles al terminar chat.
- Alejandra-APP `757e689` (anterior) — fix(agente): ctx.waitUntil en /api/chat/stream.

### Cómo se comporta ahora
| Caso | Comportamiento |
|---|---|
| App abierta + mensaje | SSE normal. Push se filtra en foreground (sin duplicado). |
| Cierras app durante respuesta | Worker termina por `ctx.waitUntil`. Al acabar, push llega. Tocas → abre chat. |
| App cerrada + nuevo mensaje | Push llega. Tocas → abre chat. |

### Pendientes para una v1.9.17
- Cancelar Timers en `background_service.dart` (L179-180): `Timer.periodic` sin guardar referencia → no se pueden parar.
- Cancelar listeners FCM en `notifications_service.dart` (memory leak al re-init).
- Limpiar callbacks TTS para no acumular.
- Throttle `_scrollToBottom` en `chat_screen.dart`.

### Pendientes de sesiones anteriores
- Decidir destino de PEMP 40/41 (Levitec en obra Edison) y fichajes 8–15 (Edison en obra Levitec).
- Foreground service 30+ min.
- Probar albarán universal con foto real.

---

## RESUMEN SESIÓN 11/06/2026 (noche) — Fix 4 bugs críticos AlejandraIA Flutter v1.9.15+29

---

## RESUMEN SESIÓN 11/06/2026 (noche) — Fix 4 bugs críticos AlejandraIA v1.9.15+29

### Contexto
Adrián reporta que AlejandraIA va fatal: se queda pillada pensando, no avisa al cerrar la app, da error al reabrir, no guarda historial. Diagnóstico completo + remediación.

### Causa raíz del bug #1 (historial vacío) — la causó nuestro propio fix de la tarde
La acción 3 de la sesión de la tarde reforzó `/api/chat/history` en el agente para **exigir** `getAuth`. Pero el cliente Flutter (`agent_service.dart` L181) hacía `http.get(uri)` SIN header `Authorization`. Resultado: 401 silencioso → `loadHistory()` devolvía `[]` → al reabrir la app el historial estaba vacío. Reparado abajo.

### Fixes aplicados (AlejandraIA — Flutter)

1. **`agent_service.dart` — Authorization en loadHistory + timeout SSE de inactividad**
   - `loadHistory()`: añadido header `Authorization: Bearer ${_settings.token}`. Detecta 401/403 explícitamente.
   - `sendMessage()`: el `await for` del stream SSE ahora tiene `.timeout(Duration(seconds: 90), onTimeout: sink.addError(TimeoutException))` para detectar cuelgue del servidor entre chunks. Antes el timeout de 60s solo cubría `request.send()` (conectar), no la inactividad intra-chunks → chat se pillaba para siempre.
   - También añadido `Authorization` al request POST de chat/stream por defensa en profundidad.

2. **`chat_screen.dart` — boot ordenado**
   - `initState` ahora: (1) `loadConversations()` siempre primero (datos locales, no depende de red), (2) abrir conversación más reciente si existe, (3) `syncFromServer()` con try/catch, (4) crear nueva solo si tras todo no hay activa. Antes una excepción en sync rompía el resto.

3. **`chat_provider.dart` — await en saveMessage del usuario**
   - `_addUserMessageToUI()` ahora es async y hace `await _db.saveMessage(userMsg)`. Antes era fire-and-forget; si el usuario cerraba la app justo después de enviar, el mensaje quedaba sin persistir.

### Fix lado worker (alejandra-agente)

4. **`/api/chat/stream` — FCM push cuando cliente desconecta**
   - Nueva variable `clienteDesconectado` que se pone a `true` cuando `writer.write` falla (cliente cerró app o perdió red).
   - En el `finally`, si `clienteDesconectado === true` y el canal es móvil (`app_android`/`pwa`/`panel`) y hay respuesta final, lanza `ctx.waitUntil(enviarFCM(env, fcmToken, '💬 Alejandra ha respondido', preview))`.
   - El `fcm_token` se lee de `alejandra_memoria` (tipo='fcm_token').
   - Soluciona el síntoma "cierro la app y no me avisa cuando termina".

### Versionado y despliegues
- AlejandraIA: v1.9.14+28 → **v1.9.15+29**. APK 57.4 MB. SHA-256 `db5e15...62f7e6`.
- Subido a R2 `apk/alejandra_ia_v1.9.15.apk` + `apk/alejandra_ia_latest.apk`.
- `ota/version.json` actualizado (los móviles ya v1.9.15 se actualizarán solos).
- Subido a Google Drive `gdrive:AlejandraIA/AlejandraIA_v1.9.15.apk`.
- `alejandra-app-api` redeploy: `21a9fa24-b1fd-4657-a1c7-e7e02b7229ee`.
- `alejandra-agente` deploy: `5695ef95-3e25-4efe-91a0-6e4014955474`.

### Commits
- AlejandraIA `55b5633` — fix 4 bugs críticos del chat.
- Alejandra-APP `a91cdd8` — FCM cuando cliente SSE desconecta.

### Pendientes
- Instalar v1.9.15 en el móvil (OTA) y validar los 4 síntomas reparados.
- Bugs medios para una v1.9.16: cancelar Timers/listeners en background_service y notifications_service, evitar acumular callbacks de TTS, throttle de `_scrollToBottom`.
- Decidir destino de PEMP 40/41 y fichajes 8–15 (de la sesión de la tarde).
- Foreground service 30+ min.
- Probar albarán universal con foto real.

---

## RESUMEN SESIÓN 11/06/2026 (tarde) — Auditoría multi-tenant + hardening v6.45

### Contexto
Auditoría completa del aislamiento de datos pedida por Adrián: empresa, departamento y rol. Lectura primero, después remediación de los hallazgos.

### Estructura BD descubierta
- 3 empresas: 1=Levitec, 3=Edison Montajes, 4=PruébalaAPP. 6 obras.
- NO existe tabla `departamentos`: es campo TEXT libre repetido en 7 tablas con default `'electrico'`.
- Tablas SIN `departamento`: `inventario_seg`, `epis_asignados`, `materiales_obra`, `fichajes`.
- `materiales_obra` SIN `empresa_id` tampoco.

### Migraciones BD aplicadas (D1 remoto)
- `ALTER materiales_obra ADD empresa_id INTEGER` + back-fill 2 filas desde obras.
- `ALTER inventario_seg ADD departamento TEXT DEFAULT 'seguridad'`.
- `ALTER epis_asignados ADD departamento TEXT DEFAULT 'seguridad'`.
- `ALTER materiales_obra ADD departamento TEXT DEFAULT 'electrico'`.
- `ALTER fichajes ADD departamento TEXT DEFAULT 'electrico'` + back-fill 217 filas (38 desde usuarios, 179 desde personal_externo).
- `ALTER push_subscriptions ADD empresa_id INTEGER` + back-fill 3 filas.
- Fix encoding: 5 filas en `inventario_seg` (Arn�s→Arnés, Retr�ctil→Retráctil).

### Hardening worker.js (principal)
- `moverItemSeg`, `eliminarItemSeg`: `AND empresa_id=?` en SELECT/UPDATE/DELETE (evita cross-empresa).
- `marcarSugerenciaLeida`, `eliminarSugerencia`: idem.
- `crearIncidencia`: valida que `body.departamento` no escale el dept del operario.
- INSERTs de fichajes (×2) y epis_asignados (×1): `departamento` con COALESCE desde usuarios/personal_externo.
- `getIAChatHistory`: valida que `usuario_id` solicitado coincide con sesión (salvo superadmin/desarrollador).

### Hardening alejandra-agente/worker.js
- Nuevo helper `esDeveloperAgente()`: comprueba que el usuario es Adrian o `rol='desarrollador'`.
- Guard al inicio de `ejecutarTool` para las 6 tools auto-mod (`repo_read_file`, `repo_write_file`, `direct_fix`, `grep_code`, `run_migration`, `check_deploy_status`).
- `/api/chat/history`: requiere `getAuth` + `usuario_id` == sesión.
- `/push-subscribe`: requiere auth + valida self-subscribe + resuelve `empresa_id` desde sesión/usuarios.
- `/api/sync/eventos`: añadido filtro `AND (empresa_id=? OR empresa_id IS NULL)`.
- `/api/sync/ping`: idem en SELECT dispositivos.
- INSERTs `materiales_obra` (×2) con `empresa_id` desde sesión + CREATE TABLE actualizado.
- INSERT fichajes parte semanal con `departamento` COALESCE desde personal_externo.

### Hardening alejandra-panel.html
- `login()` branch token: defensa en profundidad — verifica `r.ok`, rechaza 401, valida que la respuesta tenga forma de config (`modo`/`auto_fix`) antes de aceptar el token.

### Hallazgos en datos NO arreglados (decisión pendiente)
- **PEMP 40 y 41** (Tijeras 47107 y 135): `empresa_id=1` (Levitec) pero `obra_id=11` (CPD Getafe de Edison). dept='mecanicas'. Adrián decide qué hacer.
- **Fichajes 8–15** (20/04/2026, registrados por Adrian): `empresa_id=3` (Edison) pero `obra_id=1` (CPD Getafe de Levitec). Personal externo todos de Edison. Probable obra duplicada (Levitec creó obra 1 y Edison creó obra 11 con el mismo nombre).

### Despliegues
- `alejandra-app-api` → Version ID `8e09e329-a51e-4af2-91f2-a743bd6ea682` ✅
- `alejandra-agente` → Version ID `c4d34bcb-d994-4cf1-8e8a-8fafac74edaf` ✅
- Versiones sincronizadas (json/sw/html): ✅ v6.45.
- Encoding verificado limpio en diff: ✅.

### Pendientes
- Decidir destino de PEMP 40/41 y fichajes 8–15.
- Foreground service 30+ min.
- Probar albarán universal con foto real.

---

## RESUMEN SESIÓN 11/06/2026 — Fix Gemini BOM + FCM push reparado

### Cambios implementados

1. **fix(gemini): BOM cleaning en callGemini — worker.js v6.44**
   - `callGemini` del worker principal no limpiaba BOM/whitespace de las keys
   - Causaba 400 silencioso de Google → scan bobinas, partes, OCR, PDF/Excel fallaban
   - Añadida `cleanKey()` igual que en el agente (commit `b799f11` de jun/5 que nunca se portó)
   - Añadido `400` y `403` a la lista de `continue` (igual que agente)
   - Deploy: `aa6d2e3a` — verificado con `/scan-bobinas` real → HTTP 200

2. **fix(fcm): FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY configurados**
   - Los dos secrets del Service Account de Firebase no estaban en el agente worker
   - Sin ellos `getGoogleAccessToken()` fallaba → `enviarFCM()` nunca funcionaba
   - Secrets configurados desde `alejandra-ia-app-firebase-adminsdk-fbsvc-f8437abde1.json`
   - Verificado E2E: Alejandra usó tool `enviar_push` → notificación recibida en el móvil ✅

### Commits
- `101b2f9` — fix(gemini): limpiar BOM en keys + manejar 400/403 — v6.44

### Pendientes
- Foreground service 30+ min
- Probar albarán universal con foto real

---

## RESUMEN SESIÓN 11/06/2026 — Verificación y continuación sesión 10

### Contexto
Sesión de continuación (context limit en sesión 10). Se verificó que todas las implementaciones estaban completas y publicadas.

### Estado verificado ✅
- **AlejandraIA Flutter app** — todos los archivos ya modificados antes de compilar:
  - `message.dart` — 36 tool labels completos
  - `tool_event_card.dart` — expandible con input + preview
  - `chat_provider.dart` — syncFromServer(), cola de mensajes, sin contexto local
  - `chat_input_bar.dart` — siempre habilitado, hint dinámico, icono cola
  - `chat_screen.dart` — syncFromServer en initState, onSend siempre habilitado
- **APK v1.9.14+28** — compilado y en R2 / Google Drive ✅
- **WORKER agente `65b8e87e`** — canal app_android documentado, historial paginado ✅
- **Repos en sync** — AlejandraIA: `1f848f2`, APP: `89db556` ✅
- **SESION.md** — restaurado desde git (tenía corrupción de encoding) y actualizado

### Pendientes (de sesiones anteriores)
- Instalar APK v1.9.14+28 en el móvil y probar historial cross-plataforma
- FCM Push notificaciones (roto desde hace varias sesiones)
- Foreground service 30+ min
- Probar albarán universal con foto real

---

## RESUMEN SESIÓN 10/06/2026 — Streaming chat + fix identidad + optimización tokens

### Cambios implementados

1. **Chat streaming con feedback estilo Claude Code (v6.39)**
   - `alejandraEnviar()` reescrita para usar SSE streaming (`/api/chat/stream`)
   - Feedback visual en tiempo real: chip de routing NEXUS, tool chips con spinner/check, preview colapsable, tokens streaming
   - Info de coste/tokens al final de cada respuesta
   - CSS ya incluido: `.ale-tool`, `.ale-tool-chip`, `.ale-tool-route`, `.ale-stream-bubble`

2. **Fix identidad fragmentada**
   - Función `normalizarUsuarioId()` en worker: unifica "3", "Adrian", "adrian", "3.0", "Adrian (3)" → "3"
   - Migración BD: 86+181+669 filas actualizadas en historial, logs y token_uso
   - Chat ahora es continuo entre PWA, Android y panel web

3. **Fix "Sin respuesta"**
   - Cuando IA usaba tools pero API no devolvía bloque de texto → genera resumen de acciones ejecutadas

4. **Eventos no gastan tokens**
   - `/webhook/evento` ya no procesa con Sonnet. Solo guarda contexto. Solo eventos críticos llaman IA

### Commits
- `84e3420` — feat: chat streaming con feedback de tools estilo Claude Code — v6.39

### Workers desplegados
- `alejandra-agente` → Version ID `7035671c` (streaming + identity + events fix)

---

## RESUMEN SESIÓN 09/06/2026 — Auditoría consumo tokens + optimización cron

### Problema
Adrián se quedó sin saldo de Anthropic en 4 días. Auditoría completa de `alejandra_token_uso`.

### Hallazgos
- **Total gastado:** $14.14 en 25 días (15 may → 8 jun)
- **Top consumidores:** cron system (42%, $5.91) + adrian chat (35%, $4.95)
- **Días pico:** 31 may $4.10 (chat intensivo), 30 may $2.93, 4 jun $1.90
- **Cron gastaba ~$0.85/día** en background: 17 llamadas/día a Sonnet con prompts enormes de business intelligence, incluso en horas sin actividad

### Optimizaciones implementadas
1. **Cron frequency:** de cada hora (17/día) a 6 veces/día → **-65% llamadas**
2. **Pre-filtro:** modo "normal" verifica datos antes de llamar API. Si no hay alertas/anomalías/stock bajo → skip sin gastar tokens
3. **Modelo:** modo normal usa Haiku ($1/$5 Mtok) en vez de Sonnet ($3/$15). Modos importantes (briefing, resumen, reflexión) siguen con Sonnet
4. **Contexto:** cron reduce historial de 4 a 2 mensajes

### Ahorro estimado
- Antes: ~$1.35/día → Después: ~$0.60/día (**ahorro ~55%**)
- Mensual: de ~$40 a ~$18-20

### Commits
- `03f3fa3` — fix: optimizar consumo tokens Alejandra IA — ahorro ~55% diario

### Workers desplegados
- `alejandra-agente` → Version ID `0d59fa4a` (optimización tokens)

---

## RESUMEN SESIÓN 06/06/2026 — Test end-to-end escaneo remoto + 3 bugs críticos

### Bugs descubiertos y arreglados

1. **FAB null reference (panel.html)** — `rsIniciarSync()` hacía `document.getElementById('remoteScanFab').style.display = 'flex'` pero el HTML del FAB está en línea 7652 y el script se ejecuta en línea 6563 → crash → polling nunca arrancaba. Fix: null-safe con fallback `DOMContentLoaded`.

2. **Timestamp ISO vs SQLite (worker.js)** — `syncGetEventos` comparaba `created_at` (formato SQLite `"2026-06-05 17:43:03"` con espacio) con `desde` (formato ISO `"2026-06-05T17:43:34Z"` con T). En SQLite string comparison, espacio (0x20) < T (0x54) → `created_at > desde` **siempre falso** → polling nunca devolvía eventos. Fix: normalizar `desde` con `.replace('T',' ').replace('Z','')` antes de la query.

3. **`usuario_label.trim()` crash (alejandra-agente/worker.js)** — panel.html no envía `usuario_nombre` → `usuarioLabel` tomaba valor de `usuario_id` (número 3) → `.trim()` en número → crash. Fix: `String()` en 3 puntos del código.

### Test end-to-end completado ✅
1. Office abre modal → selecciona "Foto de obra" + contexto "Nave 2 CPD Getafe"
2. Envía `scan_request` → "Esperando al móvil..." con spinner
3. Móvil envía `scan_resultado` con imagen de cuadro eléctrico
4. Polling detecta resultado → cierra modal automáticamente
5. Alejandra IA analiza la imagen → **crea 2 incidencias automáticas** en BD:
   - Interruptores magnetotérmicos OFF (posiciones 4 y 7)
   - Cable suelto en zona inferior derecha
6. Incidencias borradas tras verificación (datos de prueba)

### Commits
- `3de8c2d` — fix: FAB null-safe — v6.38
- `33a40f8` — fix: timestamp ISO vs SQLite en syncGetEventos — v6.38

### Workers desplegados
- `alejandra-app-api` → Version ID `43d2af24` (fix timestamp)
- `alejandra-agente` → Version ID `474b52a1` (fix usuario_label)

### Nota DNS
Pi-hole (192.168.10.100) estaba caído → WiFi cambiado temporalmente a Google DNS (8.8.8.8). Volver a Pi-hole cuando esté en pie.

---

## RESUMEN SESIÓN 05/06/2026 noche — Escaneo remoto: del MVP al producto

### Punto de partida
La sesión anterior dejó el escaneo remoto funcionando en mecánica básica (Office pide foto → móvil la hace → llega al panel). PERO **Alejandra no procesaba la foto** (bug `if tipo === 'scan'` cuando el móvil envía `scan_resultado`) y **no había edición** de datos antes de meter en BD.

### Bugs gordos descubiertos y arreglados
1. **Worker: `if tipo === 'scan'` nunca matcheaba** → móvil envía `scan_resultado` → Alejandra **nunca procesaba ninguna foto**
2. **Worker: `getAuth` buscaba en `usuarios.token_sesion`** (no existe). Real: tabla `sesiones.token`. Todo el sync devolvía 401 silencioso → móvil aparecía como "Sin conectar"
3. **Worker: BOM (U+FEFF) en `GEMINI_API_KEY`, `_2`, `_3`** → 400 silencioso de Google. Limpieza con regex `/^[﻿​\s]+|[﻿​\s]+$/g` en `callGemini`
4. **Worker: BOM en `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`** → btoa() petaba con "Network connection lost". Misma limpieza en `getGoogleAccessToken`. FCM sigue dando `Invalid JWT Signature` — service account probablemente rotado (no resuelto, no necesario por ahora)
5. **Worker: `gemini-2.0-flash` y `gemini-1.5-flash*` deprecados** → 404. Actualizados a `gemini-2.5-flash` / `gemini-flash-latest` / `gemini-2.5-flash-lite`
6. **Worker: `callGemini` devuelve string directo**, pero mi código accedía a `.candidates[0]...` → texto vacío siempre
7. **App: `SyncService` leía `uploadData['key']`** pero `/upload` devuelve `url` → `archivo_key` quedaba vacío en el evento → Gemini nunca disparaba. Cambiado a `url ?? key`
8. **App: SyncService corría con Timer.periodic en isolate UI** → Android suspendía la app → polling moría → notificaciones desaparecían. Movido al `flutter_background_service` (foreground con `FOREGROUND_SERVICE_DATA_SYNC`)
9. **App: scan_request llegaba al background isolate** pero el StreamController estaba en UI isolate (no cruzan isolates). Solucionado con SharedPreferences (`scan_pendiente`) + `recuperarScanPendiente()` al abrir UI

### Features añadidas

#### Pipeline de procesamiento de escaneos (worker)
- `procesarScanConGemini(env, eventoOrigen, archivoKey, subtipo, contexto, sesion)`
- Prompts especializados por subtipo en `SCAN_PROMPTS`:
  - `parte_semanal`: extrae tabla trabajadores × días con horas y firmas
  - `albaran_bobinas`: cabecera + 8 bobinas con matrícula, lote, metros
  - `hoja_bobinas`: tabla manuscrita Levitec
  - `bobina`: bobina individual
  - `factura`: cabecera + líneas con base/iva/total
  - `foto_obra`, `documento`, `plano`
  - **`albaran_universal`** (★ nuevo): clasifica cada línea automáticamente
- Limite 4 MB en bytes raw antes de Gemini

#### Endpoints sync nuevos en agente worker
- `POST /api/sync/evento` — push evento + dispara Gemini fire-and-forget
- `GET /api/sync/eventos?desde=&excluir_origen=` — polling
- `POST /api/sync/ping` — registrar presencia ("app"/"office"/"tablet")
- `GET /api/sync/dispositivos` — quién está conectado
- **`POST /api/sync/confirmar`** — recibe datos editados → inserta en BD según subtipo
- **`GET /files/<key>`** — sirve binario del R2 con auth Bearer (para img en modal)

#### Modal de revisión editable (panel)
Cuando llega `scan_procesado` se abre overlay con:
- Imagen R2 a la izquierda (click=zoom)
- Formulario editable a la derecha — **tabla N filas según subtipo**
- Por subtipo:
  - `parte_semanal`: tabla 22×8 (empresa, nombre, L/M/X/J/V/S con horas+firma)
  - `albaran_universal`: chips de resumen por categoría + tabla con dropdown editable + campos extra dinámicos
  - `albaran_bobinas`, `hoja_bobinas`, `bobina`: tablas específicas
- Botones: Descartar / 💾 Guardar en BD (POST `/api/sync/confirmar`)
- Toasts (📸 recibido, ✅ guardado, ❌ error)

#### Insertadores específicos (worker, distribuyen a tablas reales)
- `insertarParteSemanal` — busca/crea `personal_externo`, calcula fechas L-S desde "25 al 30 de mayo de 2026", crea fila en `fichajes` por cada celda con horas
- `insertarAlbaranBobinas` — N filas en `bobinas` con check de duplicados por matrícula
- `insertarHojaBobinas` — UPSERT en `bobinas` (si existe del albarán, actualiza obra/recogida)
- `insertarBobinaIndividual` — una fila
- **`insertarAlbaranUniversal`** (★) — distribuye por categoría:
  - `bobina_cable` → `bobinas`
  - `material_obra` → `materiales_obra`
  - `epi` → `epis_asignados`
  - `herramienta` → `herramientas`
  - `seguridad` → `inventario_seg`
  - Guarda referencia en `albaranes` (R2 key)

#### App móvil — Notificaciones en pantalla bloqueada
- `flutter_local_notifications` en canal `alejandra_scan_channel` con:
  - `Importance.max`, `Priority.max`
  - `category: call`, `fullScreenIntent: true`, `visibility: public`
  - Sonido + vibración pattern `[0, 200, 100, 200, 100, 400]`
- **MOVIDO al `background_service`** para sobrevivir Doze (foreground service)
- Persistencia `scan_pendiente` en SharedPreferences → UI recupera al abrir

#### App móvil — Galería + Cámara
- Diálogo "Escaneo remoto" muestra DOS botones: 🖼️ Galería + 📷 Cámara
- `SyncService.ejecutarEscaneo(req, source: ImageSource.X)` parametrizado
- Permisos `READ_MEDIA_IMAGES` ya estaban en manifest

### Versionado APK durante la sesión
- 1.9.10+24 — galería + cámara
- 1.9.11+25 — notif local en pantalla bloqueada
- 1.9.12+26 — fix `uploadData['url']` (Gemini no se disparaba)
- 1.9.13+27 — sync en foreground service + albarán universal

### Versionado worker durante la sesión
- 7da66b47 (deep link auth)
- 68ed0101 (sync API inicial)
- ad7cce13 (procesar escaneos + bugs 1-3)
- e90def93 (limpieza endpoints debug)
- 411245a9 — **ACTUAL** — albarán universal + push FCM (no funciona)

### Pendientes/Por probar próxima sesión

1. **PROBAR con foto real de albarán mixto** (cable + cuadros + EPIs) — el albarán universal nunca se probó end-to-end con datos reales. El usuario tiene ejemplos en su móvil
2. **Verificar foreground service sobrevive 30+ min** suspendido. El móvil del usuario se desconectó tras horas (test no concluyente)
3. **FCM Push roto**: las credenciales Firebase tienen "Invalid JWT Signature" tras limpiar BOM. Probablemente service account regenerado. Solución: pedirle al usuario que descargue JSON nuevo desde Firebase Console → Project Settings → Service Accounts → Generate new private key y subirlo con `wrangler secret put FIREBASE_PRIVATE_KEY` + `FIREBASE_CLIENT_EMAIL` (sin BOM, idealmente). No bloquea nada porque las notificaciones funcionan vía polling+foreground
4. **No se probó la inserción real** en BD desde el modal de revisión (todo el end-to-end Gemini → modal → guardar nunca llegó a completar por los bugs)
5. **Tarea pendiente #5 sigue abierta**: "Implementar flujo B: escaneo desde pantallas de la app → Alejandra" (escaneo desde la app móvil, no remoto desde Office). No tocado esta sesión.

### Archivos modificados esta sesión
- `alejandra-agente/worker.js` (MUY tocado) — getAuth fix, procesarScanConGemini, SCAN_PROMPTS×8 incluyendo `albaran_universal`, 5 insertadores, `/api/sync/confirmar`, `/files/<key>`, limpieza BOM Gemini+Firebase, modelos Gemini 2.5, enviarPushScanRequest (FCM, no funciona)
- `alejandra-panel.html` (MUY tocado) — SCAN_TIPOS×8 con `albaran_universal` como primera opción, CATEGORIAS_ALBARAN, FAB 📷, modal revisión + renderers `renderRevParteSemanal`, `renderRevAlbaranUniversal` (con chips + dropdown por línea), `renderRevAlbaranBobinas`, `renderRevHojaBobinas`, `renderRevBobinaIndividual`, recolectores, sección `dispositivos`
- `AlejandraIA/lib/services/sync_service.dart` — NUEVO archivo, modelo SyncStatus, ScanRequest, ejecutarEscaneo con `source: ImageSource`, notif local, scan_pendiente persistente
- `AlejandraIA/lib/services/background_service.dart` — REESCRITO: ping 30s + poll 5s + notif local + scan_pendiente, todo en `_onStart` del foreground service
- `AlejandraIA/lib/main.dart` — instancia SyncService en MainShell, listener scanRequests, `_handleScanRequest` con diálogo Galería/Cámara, `recuperarScanPendiente` en post-frame
- `AlejandraIA/pubspec.yaml` — bump 4 veces (1.9.10→1.9.13)

---

## SESIÓN ANTERIOR — 05/06/2026 — v6.32→v6.37 Chat sync + SW fix + Escaneo remoto (MVP)

### Problemas reportados:
1. "nada sigue en la 28 cada vez que la abro" — móvil atascado en v6.28
2. "no sincroniza el chat tampoco con el de la app" — chat Office ≠ chat móvil
3. "que estes trabajando en el office y escanear con el movil" — escaneo remoto

### v6.32 — Fix Service Worker stale HTML:
- SW `fetch` handler: `cache:'no-store'` en navigate requests
- Browser HTTP cache ya no sirve HTML viejo
- Cache respuesta para offline fallback

### v6.35 — Chat sync entre dispositivos:
- Endpoint `/ia-chat-history` en worker principal
- Busca por usuario_id numérico O nombre (formato mixto en BD)
- panel.html: carga chat desde servidor + fallback localStorage
- index.html: ambos chats sincronizados
- Fix CORS: `Authorization` en allowed headers
- Fix auth: `X-Token` en vez de `Authorization: Bearer`

### v6.36 — Escaneo remoto (Office → Móvil):
- 3 endpoints nuevos: `/sync/ping`, `/sync/evento`, `/sync/eventos`
- Tablas D1: `sync_dispositivos`, `sync_eventos`
- panel.html: FAB flotante 📷 + badge conexión + modal tipo scan + polling
- Worker desplegado ✅

### v6.37 — Escaneo remoto (Móvil receptor):
- Móvil se registra como `app` vía `/sync/ping` cada 30s
- Polling `scan_request` cada 5s (solo primer plano)
- Vibración + modal + auto-abre cámara al recibir solicitud
- Foto comprimida → `scan_resultado` de vuelta a Office
- Flujo completo Office↔Móvil funcionando

### Archivos modificados:
- worker.js — endpoints sync + getIAChatHistory + CORS
- panel.html — chat sync servidor + escaneo remoto completo
- index.html — chat sync + receptor escaneo remoto + v6.37
- sw.js — cache:'no-store' navigate + v6.37
- version.json — 6.37

### Deploy:
- Worker: c88ac1f0 ✅ (D1 + R2)
- GitHub: b737843 → push main ✅
- Versiones sincronizadas: ✅

### Pendiente próxima sesión:
- Probar escaneo remoto end-to-end (Office + móvil real)
- Móvil del usuario puede necesitar limpiar caché PWA (atascado en v6.28)
- Push notifications sin probar en móvil real

---

## RESUMEN SESIÓN 04/06/2026 (tarde) — v6.17→v6.19 Fix chat IA inline pisando pantallas

### Problemas reportados:
1. "el chat se queda a continuación o en medio de las pantallas" — al cambiar de pantallas y darle al botón IA, el chat se quedaba visible encima/dentro de otras pantallas
2. Placeholder del input del chat cortado y desalineado
3. Contador del icono IDEAS estancado en 7

### Debug via ADB + CDP (Chrome DevTools Protocol):
- Conectado al móvil del usuario (48cafad0) por adb
- Forward puerto 9222 → DevTools del Chrome móvil
- Inspección live del DOM mientras el usuario reproducía el bug
- Captura de pantalla via `adb exec-out screencap -p`

### Causa raíz #1 (v6.17):
`<div id="screenIA">` no tenía la clase `.screen`. `_applyScreen()` hace:
```js
document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
```
Como `screenIA` no era `.screen`, NUNCA se le quitaba la clase `active`. Una vez visitada, quedaba "activa" para siempre. La CSS `#screenIA.active{display:flex}` la mantenía visible en mitad de cualquier pantalla.

### Fix v6.17:
- `index.html:3184` → `<div id="screenIA" class="screen flex-screen">`
- Verificado en device: tras visitar IA y navegar a Ajustes → `iaActiveAfterNav: false`, `iaComputedDisplayAfterNav: "none"`. Funciona.

### Causa raíz #2 (v6.18):
Placeholder "Escribe, usa el micrófono o adjunta archivos..." (38 chars) no cabía en el textarea (~140px de ancho con 3 botones al lado).

### Fix v6.18:
- `iaInput` y `alejandraInput` placeholders → "Mensaje"

### Causa raíz #3 (v6.19):
`screenIA` no tenía `style="height:100%"` como las demás flex-screens. Resultado: el chat solo ocupaba la altura de su contenido, dejando hueco vacío entre input y nav.

### Fix v6.19:
- `screenIA` → `style="padding:0;height:100%"`
- Verificado: screenIA height=615, msgs=496, appContent=615. Llena todo.

### Sobre el contador IDEAS (no es bug):
- API `/sugerencias?estado=pendiente` devuelve 7 ideas reales (IDs 201, 204, 205…)
- El badge sí está sincronizado con backend
- Bajará cuando el usuario marque alguna como "✅ Resolver"

### Archivos modificados:
- index.html — clase .screen en screenIA + style height:100% + placeholders + APP_VERSION 6.19
- sw.js — CACHE alejandra-v6.19
- version.json — 6.19

### Deploy:
- v6.17 commit 7650702 → push main ✅
- v6.18 commit 8b51d12 → push main ✅
- v6.19 commit 7f005a4 → push main ✅
- Worker: sin cambios

### Pendiente próxima sesión:
- Confirmar todo OK en uso real
- PWA install icon supuestamente ausente — probablemente porque ya está instalada
- Push notifications v6.13 todavía sin probar en móvil real
- Pendientes anteriores: #196, #195, #193, #197, #190

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
