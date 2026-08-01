# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

Foundation v0.1 aprobada. F-0.1 está **cerrada localmente**: CI, CD, secretos y migraciones quedan separados en los workflows versionados y ningún push o merge activa producción.

**Activa en producción desde el 2026-08-02** (PR #9): workflows antiguos retirados, `main` protegida y entorno `production` con revisor requerido. Queda mover los secretos a nivel de entorno. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

**Completar la configuración remota de entrega segura** — tarea `F-0.2-CFG` en `TASKS.md`, detalle en `HANDOFF.md`.

No iniciar el Núcleo Cognitivo ni abrir fases nuevas.
