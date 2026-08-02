# Rebanada P-ARCH-013 — Navegación con tokens semánticos

- Estado: Implementada
- Alcance: barra lateral y cabecera del panel de conversación

La navegación conserva dimensiones, eventos, rutas y responsive. Sus superficies, bordes,
estados normal/hover/activo y texto pasan a aliases semánticos equivalentes, reduciendo la
dependencia de variables cromáticas directas en el shell de la aplicación.

Rollback: revertir el commit restaura las variables directas; no cambia datos, API ni permisos.
