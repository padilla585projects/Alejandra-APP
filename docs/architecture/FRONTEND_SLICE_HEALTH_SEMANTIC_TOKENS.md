# Rebanada P-ARCH-006 — Salud con tokens semánticos

- Estado: Implementada
- Alcance: indicador de solo lectura ya aislado

El indicador de salud del panel de conversación conserva exactamente su contrato `GET /health`,
su texto y su comportamiento silencioso ante error. Solo sustituye las referencias visuales de
éxito y error por `--color-success` y `--color-danger`, aliases de la paleta vigente.

Rollback: revertir el commit restaura `--green` y `--red`. No cambia la API, autorización,
datos ni navegación.
