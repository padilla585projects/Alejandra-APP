# ADR-0001 — Entrega deliberada, separada de integración

- Estado: Aceptado
- Fecha: 2026-08-01
- Decisores: Director del Proyecto — F-0.1

## Contexto

Los workflows anteriores desplegaban Pages y Workers al recibir un push a `main`. El flujo del agente además intentaba ejecutar migraciones D1 remotas y reconfigurar secretos. Integrar código podía modificar producción sin aprobación independiente.

## Decisión

CI, CD y migraciones quedan separados:

- `ci.yml` valida sintaxis y pruebas en PRs y ramas no principales; no usa credenciales de producción.
- API Worker y Agent Worker solo se ejecutan mediante `workflow_dispatch`, con confirmación textual y entorno GitHub `production`. Pages usa su entorno obligatorio `github-pages` con la misma confirmación explícita.
- Las migraciones D1 del agente viven en `migrate-d1-agent.yml`, separadas del despliegue, con selección cerrada y confirmación textual.
- Los secretos siguen siendo una operación manual independiente en `production`; no se reescriben durante un despliegue y el workflow usa carga masiva sin imprimir valores.

## Consecuencias

Un push o merge no puede activar los workflows de Pages, Workers o D1 versionados. La protección efectiva requiere configurar manualmente aprobadores y restricciones en el entorno GitHub `production`, además de protección de rama en `main`.

Las migraciones raíz no se automatizan: requieren un runbook y revisión específica hasta disponer de un manifiesto versionado.

## Referencias

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-worker.yml`
- `.github/workflows/deploy-alejandra-agente.yml`
- `.github/workflows/migrate-d1-agent.yml`
- `docs/runbooks/CI-CD-Y-MIGRACIONES.md`
