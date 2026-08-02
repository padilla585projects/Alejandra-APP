# Rebanada P-ARCH-011 — Tarjetas con tokens semánticos

- Estado: Implementada
- Alcance: tarjeta base y tarjeta de estadística

Las clases reutilizadas `.card` y `.stat-card` conservan geometría y valores resueltos; pasan a
usar superficie, borde, radio, espaciado y texto semánticos. La tarjeta existe en dashboard,
historial, configuración y varias vistas de operación, por lo que esta rebanada reduce cambios
repetidos futuros sin modificar marcado, datos o lógica.

Rollback: revertir el commit restaura las variables directas.
