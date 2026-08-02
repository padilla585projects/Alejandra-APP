# Rebanada P-ARCH-009 — Estado de carga compartido

- Estado: Implementada
- Alcance: dashboard, gastos, memoria y logs

Una primitiva de carga escapada sustituye cuatro mensajes de carga de vistas de solo lectura. Las
funciones mantienen las mismas llamadas HTTP, orden de carga, mensajes y fallback local si el
componente no carga. Solo se centraliza el marcado visual y el token de texto secundario.

Rollback: revertir el commit restaura los cuatro fragmentos locales. No cambia backend, datos,
permisos ni navegación.
