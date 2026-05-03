================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 03/05/2026
**Versión tras última sesión:** v5.33
**Worker desplegado:** v5.33 (ID: d224bf85-3013-47b2-be02-04c8c857c877)
**GitHub:** en sync ✅

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
