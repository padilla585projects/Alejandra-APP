# Propuesta de organización definitiva

Esta es una arquitectura objetivo, no una instrucción de mover archivos ahora. Cada extracción se hará por PR, con pruebas de regresión y compatibilidad.

```text
/
  apps/
    pwa-campo/
    panel-oficina/
  workers/
    api-web/{src,tests,migrations,wrangler.toml}
    agente/{src,tests,migrations,wrangler.toml}
  packages/
    contracts/          # DTOs, errores y contratos compartidos
    authz/              # políticas puras de autorización
    domain/             # reglas puras por dominio, sin fetch/env
  infra/
    cloudflare/         # configuración no secreta y guías
    scripts/            # scripts de verificación reproducibles
  docs/
```

## Reglas de organización

- `apps/` no accede directamente a D1/R2 ni conoce secretos.
- Cada Worker se divide internamente en `http/`, `application/`, `domain/`, `infrastructure/`, `ai/` y `tests/`.
- Prompts: `workers/agente/src/ai/prompts/<modulo>.md` con versión, propósito, entradas y herramientas permitidas. No se extraen aún.
- Tools IA: una definición por archivo, validación de esquema, política de autorización y prueba de permiso negativo.
- Migraciones: una cadena ordenada por base de datos, con manifiesto, estado y dueño; no borrar ni renumerar las existentes.
- DevTools: scripts sin efectos remotos por defecto; los de producción requieren parámetro explícito, confirmación y runbook.
- Pruebas: unitarias junto a políticas/dominio; integración por Worker; regresiones de incidentes de seguridad; smoke manual aprobado para producción.

## Documentación

Los documentos base viven en `docs/`. Las decisiones se registran como ADRs; los procedimientos se versionan como runbooks; las ideas no aprobadas nunca se mezclan con el roadmap comprometido.
