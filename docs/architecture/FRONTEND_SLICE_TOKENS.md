# Rebanada P-ARCH-003 — Tokens base del sistema de diseño

- Estado: Implementada y validada
- Alcance: solo presentación del panel de conversación

Los doce tokens de color que estaban definidos en el bloque CSS monolítico de `alejandra-panel.html` pasan a `packages/design-system/src/tokens/base.css`. La página carga ese recurso antes de sus estilos locales y conserva los mismos nombres y valores, por lo que las 299 referencias existentes a `var(--...)` no cambian.

No modifica HTML funcional, JavaScript, backend, datos, permisos ni responsive. Rollback: revertir el commit devuelve el bloque `:root` al HTML y elimina el enlace. Validación: inventario de los doce tokens, comprobación de orden de carga, encoding y `git diff --check`.
