================================================================================
  ALEJANDRA APP — CONTROL DE SESIÓN
  LEER SIEMPRE AL INICIO. ACTUALIZAR AL INICIO Y AL FINAL DE CADA SESIÓN.
================================================================================

## ESTADO ACTUAL

**Sesión:** LIBRE
**Última sesión:** 29/04/2026
**Versión tras última sesión:** v5.22
**Worker desplegado:** v5.22 (getAuth acepta ?token= para imágenes)
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

## RESUMEN SESIÓN 28/04/2026

- v5.20: HOTFIX checklistToggle no expuesto en window (botones ✅/❌ checklist no funcionaban)
- v5.21: NEW-15 Mantenimiento preventivo de equipos completo:
  · Tabla historial_mantenimientos + columnas aviso_mantenimiento/dias_aviso_mant en pemp/carretillas
  · Worker: rutas /mantenimientos (GET/POST/DELETE + adjunto R2)
  · Frontend: botón 🔧 Mant. en tarjetas + modal formulario + historial
  · Edit modal PEMP/carretilla: toggle aviso + días configurables
  · alertasDiarias: respeta toggle y días por equipo
- Bug inicial de pantalla en blanco (era caché del navegador, no código)

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
- **Bug #113** — NFC: problema al añadir objetos/herramientas por NFC

### 🟢 Features pendientes (ver IDEAS_PENDIENTES.txt para detalle)
- NEW-16: Partes de trabajo diarios
- NEW-18, NEW-19, NEW-20, NEW-22… (ver lista completa en IDEAS_PENDIENTES.txt)
