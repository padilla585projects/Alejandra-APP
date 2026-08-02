# Rebanada P-ARCH-010 — Estado de error compartido

- Estado: Implementada
- Alcance: seis vistas de solo lectura del panel de conversación

La primitiva de error centraliza el marcado y escape de seis capturas de error existentes. Se
conservan el prefijo «Error:», el mensaje, el color vigente mediante alias semántico y el fallback
local. No modifica la recuperación, las llamadas HTTP, permisos ni datos.

Rollback: revertir el commit restaura los seis fragmentos locales.
