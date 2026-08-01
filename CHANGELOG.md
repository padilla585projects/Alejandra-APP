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
- Inventario del esquema real de D1 (`docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`), con las dos fases de ARC-011: análisis estático de los dos workers y contraste con producción.
- `runDDL()` en ambos workers: ejecuta DDL en caliente sin lanzar, pero registrando todo error que no sea el duplicado esperado. `ddlPaso()` para `runMigrations()`, que distingue aplicada / ya existía / ERROR.
- ARC-013 y ARC-014 en el backlog, abiertos a raíz del arreglo de ARC-012.

### Changed

- ADR-0001 aceptado: un push o merge ya no activa producción desde los workflows versionados; secretos, Pages y D1 quedan desacoplados del despliegue ordinario.
- `migrate_008_plano_circuitos.sql` estuvo bloqueada unas horas por un diagnóstico incorrecto —se supuso que `worker.js` ya creaba la columna— y se **desbloqueó y aplicó** el 2026-08-02 al comprobar contra el esquema real que la columna no existía. La migración era el arreglo, no el riesgo.
- Los despliegues de Workers pierden el healthcheck automático: `GET /health` no comprueba D1/R2 ni acredita la versión desplegada, así que un 200 podía dar por bueno un despliegue roto. Se sustituye por verificación manual documentada y queda registrado en ARC-008.
- ARC-005 se matiza: la mitigación cubre las migraciones lanzadas por workflow, no el DDL que ejecuta el propio Worker.
- Auditoría remota de GitHub en solo lectura: `main` sin protección, entorno `production` inexistente, `github-pages` limitado a `main`, secretos a nivel de repositorio y workflows antiguos aún activos. El runbook sustituye los `PENDIENTE` por el estado real.
- F-0.1 activada en remoto (PR #9): workflows antiguos desactivados antes de integrar, CI verde sin disparar ningún despliegue, entorno `production` creado con revisor requerido y `main` protegida con PR obligatoria y check requerido. Queda mover los secretos a nivel de entorno.
- Consolidación documental: `MASTER_ROADMAP.md` refleja ADR-0001/0002 aceptados y COH-001/COH-002 cerrados. `TASKS.md` y `HANDOFF.md` mantienen la cola inmediata y el relevo.
- ARC-012 resuelto: `planos.circuitos_json`, `inventario_seg.ubicacion` y `empresas.retencion_config` aplicadas por el workflow manual y verificadas contra el esquema real. Cierra SEG-01 de verdad —el fix del 25/07 nunca llegó a funcionar— y restaura la retención RGPD, que estaba inoperante.
- ARC-013: se retira la supresión de errores del DDL en runtime en los dos workers (48 llamadas a `runDDL`, 10 pasos a `ddlPaso`). No cambia comportamiento observable —el helper nunca lanza— pero un `no such table` deja de ser invisible. Requiere despliegue de `worker.js` para surtir efecto.
- Puesta al día del estado tras las PR #10 y #11: `START_HERE.md`, `PROJECT_STATE.md`, `HANDOFF.md`, `TASKS.md`, `MASTER_ROADMAP.md` y `ARCHITECT_BACKLOG.md` seguían reflejando solo hasta la PR #9.
- Sin cambios de datos ni despliegues. El único cambio de código es de observabilidad.
