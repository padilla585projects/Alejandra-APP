# Rebanada P-ARCH-004 — Tokens semánticos y modo claro preparado

- Estado: Implementada; sin consumo todavía
- Alcance: cimiento reversible de Design System

Se añaden tokens semánticos que referencian la paleta actual de Alejandra y la definición del
futuro modo claro acordado en P-DESIGN. Ninguna entrada HTML carga aún estos archivos, por lo
que no cambia el aspecto ni el comportamiento actual. La futura migración debe consumir tokens
semánticos; nunca los valores hexadecimales directamente.

Rollback: revertir este commit elimina dos archivos no consumidos. Validación: inventario de
roles, comprobación de que no se modifica ninguna entrada de aplicación, encoding y diff check.
