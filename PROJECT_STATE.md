# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-08-01
- Estado: F-0.1 implementada localmente; validación remota/manual pendiente

## Entrega segura

CI (`ci.yml`), CD manual (Pages y Workers), migraciones D1 y configuración de secretos están separados en el repositorio. Un push/merge ya no activa los workflows de producción versionados. Falta verificar/configurar los entornos `production` y `github-pages`, protección de `main`, revisores y secretos de entorno con acceso GitHub autorizado.

## Riesgos activos

- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- Migraciones raíz carecen de manifiesto único y no se automatizan.
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Siguiente objetivo

Revisión de F-0.1 y configuración manual de GitHub. Después, resolver ADR-0004 antes de implementar el Núcleo Cognitivo.
