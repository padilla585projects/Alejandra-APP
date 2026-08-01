# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- CI independiente, workflows manuales de Pages/Workers y migración D1 controlada del agente.
- Runbook de CI/CD y migraciones, con procedimiento de verificación manual post-despliegue.
- Registro operativo de F-0.1 en `TASKS.md`, incluida la migración 008 sin ejecutar.
- ARC-011: riesgo crítico de esquema D1 definido por DDL en tiempo de ejecución, con el inventario de `CREATE TABLE`/`ALTER TABLE` desde código registrado como trabajo futuro obligatorio.
- Precheck de sincronía de versiones antes de publicar Pages, y healthcheck que verifica la versión servida.
- `ENGINEERING_WORKFLOW.md` como procedimiento operativo común e independiente del modelo de IA.

### Changed

- ADR-0001 aceptado: un push o merge ya no activa producción desde los workflows versionados; secretos, Pages y D1 quedan desacoplados del despliegue ordinario.
- `migrate_008_plano_circuitos.sql` queda bloqueada: fuera del selector y rechazada por un guard explícito, porque `worker.js:24646` ya crea esa columna en runtime. El fichero se conserva.
- Los despliegues de Workers pierden el healthcheck automático: `GET /health` no comprueba D1/R2 ni acredita la versión desplegada, así que un 200 podía dar por bueno un despliegue roto. Se sustituye por verificación manual documentada y queda registrado en ARC-008.
- ARC-005 se matiza: la mitigación cubre las migraciones lanzadas por workflow, no el DDL que ejecuta el propio Worker.
- Sin cambios funcionales, de datos ni despliegues.
