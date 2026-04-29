================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 29/04/2026
**Versión tras última sesión:** v5.25
**Worker desplegado:** v5.22 (worker sin cambios en toda la sesión)
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

### 🔴 Prioritario
- **Revisión Google Sheets** — sesión dedicada completa (ver project_sheets_pendiente.md en memory)
  · La integración funciona parcial, hay muchas cosas por revisar y arreglar
  · Requiere sesión dedicada sin mezclar con otras features

### 🟡 Bugs activos (de la DB de sugerencias)
- **Bug #107** — Notificaciones: al pulsar una notificación no navega correctamente a la sección
- **Bug #94**  — Nombre de obra no se muestra bien en la barra de iconos (dept personal/seguridad)
- **Bug #95**  — Formatos de exportación (Excel): algo no funciona bien en algún módulo
- **Bug #184** — Dotación de EPIs por trabajador (Katherine) — feature nueva, sesión dedicada

### 🟢 Features pendientes (ver IDEAS_PENDIENTES.txt para detalle)
- NEW-16: Partes de trabajo diarios
- NEW-18, NEW-19, NEW-20, NEW-22… (ver lista completa en IDEAS_PENDIENTES.txt)
