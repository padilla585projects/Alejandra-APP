# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-08-02
- Estado: F-0.1 **implementada localmente — pendiente de integración y validación remota**. Nada desplegado, migrado ni pusheado.

## Gobierno operativo

`ENGINEERING_WORKFLOW.md` está creado para revisión como proceso común de cualquier agente de ingeniería. Centraliza el procedimiento operativo y deja en `AGENTS.md` solo las reglas específicas del repositorio. No modifica arquitectura, código, infraestructura ni el estado de F-0.1.

## Entrega segura

CI (`ci.yml`), CD manual (Pages y Workers), migraciones D1 y configuración de secretos están separados en el repositorio. Un push/merge ya no activa los workflows de producción versionados.

**Esto todavía no aplica en producción.** La rama no está integrada, de modo que los cuatro workflows antiguos siguen activos en GitHub y el riesgo P0 sigue vivo en el remoto. La auditoría de solo lectura del 2026-08-02 confirmó además que `main` no está protegida, que el entorno `production` no existe y que los secretos están a nivel de repositorio en lugar de entorno. `github-pages` sí existe, con política de rama limitada a `main`. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

Los despliegues de Workers no llevan healthcheck automático: los `GET /health` actuales devuelven 200 sin comprobar D1/R2, por lo que darían por bueno un despliegue roto. La verificación es manual (runbook); Pages sí conserva healthcheck porque valida la versión servida.

## Riesgos activos

- **El P0 sigue vivo en producción** hasta integrar la rama: los workflows antiguos continúan activos en GitHub.
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción (~108 `CREATE TABLE IF NOT EXISTS`, ~51 `ALTER TABLE`), no las migraciones versionadas. F-0.1 controla las migraciones del workflow, no las del código.
- `migrate_008_plano_circuitos.sql` queda **bloqueada** en el workflow: la columna ya se crea desde código y aplicarla fallaría por duplicado. El fichero se conserva.
- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- ARC-008: no existe un endpoint de salud que verifique dependencias reales.
- Migraciones raíz carecen de manifiesto único y no se automatizan.
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Siguiente objetivo

**Activar y validar F-0.1 en GitHub remoto mediante rama y PR segura** (tarea `F-0.1-R`). Es la única tarea activa.

Después: resolver ADR-0004 antes de implementar el Núcleo Cognitivo. El inventario de DDL en runtime (ARC-011) es trabajo futuro obligatorio y requiere ADR propio; no pertenece a F-0.1.
