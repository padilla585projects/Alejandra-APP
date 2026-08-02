# Rebanada P-ARCH-012 — Controles base con tokens semánticos

- Estado: Implementada
- Alcance: campo `.inp` y botón primario `.btn-acc`

Los controles reutilizados en login, configuración, modales y formularios conservan sus valores
resueltos actuales. Fondo, borde, texto, foco, radio y espaciado se expresan como tokens
semánticos, sin cambiar marcado, eventos, validación ni autorización.

Rollback: revertir el commit restaura las variables directas.
