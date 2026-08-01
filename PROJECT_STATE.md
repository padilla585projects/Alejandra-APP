# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-08-02
- Estado: F-0.1 cerrada localmente; validación remota/manual pendiente. Nada desplegado, migrado ni pusheado.

## Gobierno operativo

`ENGINEERING_WORKFLOW.md` está creado para revisión como proceso común de cualquier agente de ingeniería. Centraliza el procedimiento operativo y deja en `AGENTS.md` solo las reglas específicas del repositorio. No modifica arquitectura, código, infraestructura ni el estado de F-0.1.

## Entrega segura

CI (`ci.yml`), CD manual (Pages y Workers), migraciones D1 y configuración de secretos están separados en el repositorio. Un push/merge ya no activa los workflows de producción versionados. Falta verificar/configurar los entornos `production` y `github-pages`, protección de `main`, revisores y secretos de entorno con acceso GitHub autorizado.

Los despliegues de Workers no llevan healthcheck automático: los `GET /health` actuales devuelven 200 sin comprobar D1/R2, por lo que darían por bueno un despliegue roto. La verificación es manual (runbook); Pages sí conserva healthcheck porque valida la versión servida.

## Riesgos activos

- Existe una discrepancia histórica a revisar en `MASTER_ROADMAP.md`: algunas referencias de estado no reflejan el cierre local documentado de F-0.1 ni los ADR aceptados. No se ha resuelto automáticamente.
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción (~108 `CREATE TABLE IF NOT EXISTS`, ~51 `ALTER TABLE`), no las migraciones versionadas. F-0.1 controla las migraciones del workflow, no las del código.
- `migrate_008_plano_circuitos.sql` queda **bloqueada** en el workflow: la columna ya se crea desde código y aplicarla fallaría por duplicado. El fichero se conserva.
- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- ARC-008: no existe un endpoint de salud que verifique dependencias reales.
- Migraciones raíz carecen de manifiesto único y no se automatizan.
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Siguiente objetivo

Revisión de F-0.1 y configuración manual de GitHub. Después, resolver ADR-0004 antes de implementar el Núcleo Cognitivo. El inventario de DDL en runtime (ARC-011) es trabajo futuro obligatorio y requiere ADR propio; no pertenece a F-0.1.
