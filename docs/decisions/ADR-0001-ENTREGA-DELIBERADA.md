# ADR-0001 — Entrega deliberada, separada de integración

- Estado: Propuesto
- Fecha: 2026-08-01
- Decisores: `PENDIENTE`

## Contexto

Los workflows versionados despliegan GitHub Pages y Workers Cloudflare al hacer push a `main`. El workflow del agente también ejecuta migraciones D1 remotas. Esta topología convierte integrar código en producción, dificulta la revisión y contradice la regla de Fase 0 de no desplegar automáticamente.

## Decisión propuesta

Separar CI y CD. Todo PR y `main` ejecutarán únicamente validaciones. La promoción a producción será un workflow manual o una aprobación de entorno GitHub, con artefacto/commit identificado, prechecks, migraciones explícitas y healthcheck. Las migraciones no ignorarán fallos inesperados.

## Alternativas

1. Mantener el modelo actual: descartada; el riesgo operativo es alto.
2. Desplegar desde cada PR: descartada por ampliar superficie y coste.
3. CI separado + promoción manual aprobada: propuesta; proporciona trazabilidad y rollback operativo.

## Consecuencias

- Requiere cambiar workflows, runbooks y permisos de GitHub/Cloudflare en una PR dedicada.
- Añade un paso de aprobación, intencionadamente.
- No modifica funcionalidad de usuarios.

## Adopción y rollback

Primero se verificará CI sin despliegue. Después se habilitará promoción manual para un commit concreto. El rollback será promover el último artefacto/commit sano documentado; D1 requiere estrategia específica por migración.
