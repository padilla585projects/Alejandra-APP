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
- Regla de autonomía de los agentes: los prompts asignan objetivos y el contexto se obtiene de la documentación versionada.

### Changed

- ADR-0001 aceptado: un push o merge ya no activa producción desde los workflows versionados; secretos, Pages y D1 quedan desacoplados del despliegue ordinario.
- `migrate_008_plano_circuitos.sql` queda bloqueada: fuera del selector y rechazada por un guard explícito, porque `worker.js:24646` ya crea esa columna en runtime. El fichero se conserva.
- Los despliegues de Workers pierden el healthcheck automático: `GET /health` no comprueba D1/R2 ni acredita la versión desplegada, así que un 200 podía dar por bueno un despliegue roto. Se sustituye por verificación manual documentada y queda registrado en ARC-008.
- ARC-005 se matiza: la mitigación cubre las migraciones lanzadas por workflow, no el DDL que ejecuta el propio Worker.
- Auditoría remota de GitHub en solo lectura: `main` sin protección, entorno `production` inexistente, `github-pages` limitado a `main`, secretos a nivel de repositorio y workflows antiguos aún activos. El runbook sustituye los `PENDIENTE` por el estado real.
- F-0.1 activada en remoto (PR #9): workflows antiguos desactivados antes de integrar, CI verde sin disparar ningún despliegue, entorno `production` creado con revisor requerido y `main` protegida con PR obligatoria y check requerido. Queda mover los secretos a nivel de entorno.
- Consolidación documental: `MASTER_ROADMAP.md` refleja ADR-0001/0002 aceptados, COH-001/COH-002 cerrados y F-0.1 como «implementada localmente — pendiente de integración y validación remota». `TASKS.md` queda con una única tarea activa (`F-0.1-R`) y `HANDOFF.md` integra F-0.1 y GOV-001 con una sola siguiente acción.
- Sin cambios funcionales, de datos ni despliegues.
