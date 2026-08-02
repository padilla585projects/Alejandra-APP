# Rebanada de presentación P-ARCH-002 — Notificaciones temporales

- Estado: Implementada; en revisión antes de la siguiente rebanada
- Fecha: 2026-08-02
- Dependencia: `ADR-0012` aceptado; P-ARCH-001 aprobado por el Director
- Aplicación inicial: conversación

## Objetivo y alcance

La rebanada extrae la primitiva visual de notificaciones temporales invocada 12 veces por `alejandra-panel.html`. Antes, creación DOM, iconos, escape, cierre y caducidad estaban acoplados al script global de la aplicación. Ahora residen en `packages/design-system/src/components/toast.js`; la entrada conserva el adaptador `mostrarToast()` y un fallback temporal idéntico si el recurso compartido no carga.

El componente no realiza `fetch`, no consume ni conserva tokens y no lee/escribe datos. Mantiene iconos por tipo, la clase CSS existente, duración de 8 segundos, cierre manual y texto escapado. El botón pasa a tener `type="button"` y etiqueta accesible «Cerrar notificación», sin alterar el flujo funcional.

## Archivos y contrato

| Archivo | Responsabilidad |
|---|---|
| `packages/design-system/src/components/toast.js` | Primitiva de presentación con entrada `{ container, title, message, type, timeoutMs? }`. |
| `alejandra-panel.html` | Carga el componente y delega desde la API heredada `mostrarToast(titulo, mensaje, tipo)`. |
| Este documento | Alcance, pruebas y rollback de la rebanada. |

No existe contrato UI–backend porque esta rebanada no contacta con ningún servicio. La autoridad de Workers y permisos permanece intacta.

## Pruebas, rollback y evidencia

- Prueba aislada con DOM/temporizador simulados: clase, icono, escape, duración, cierre manual y retorno del elemento.
- `node --check` del componente; `scripts/check-encoding.js`; `git diff --check`.
- Rollback: revertir el commit elimina la carga del componente y restaura la implementación local, sin migración, datos, Worker ni despliegue.
- Reducción de acoplamiento: las 12 llamadas conservan una API estable; cambios en estructura, iconos o accesibilidad del toast quedan confinados al componente compartido y no requieren editar sincronización, escaneo ni modales.

No se inicia otra rebanada hasta revisar esta evidencia.
