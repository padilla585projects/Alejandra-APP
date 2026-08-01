# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

Foundation v0.1 aprobada. F-0.1 está **cerrada localmente**: CI, CD, secretos y migraciones quedan separados en los workflows versionados y ningún push o merge activa producción.

**Todavía no es efectiva en producción.** La rama no está integrada, así que los workflows antiguos siguen activos en GitHub. Además, la auditoría remota del 2026-08-02 confirmó que `main` no está protegida y que el entorno `production` no existe: hasta configurarlos, la única barrera real es la palabra de confirmación. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

**Activar y validar F-0.1 en GitHub remoto mediante rama y PR segura** — tarea `F-0.1-R` en `TASKS.md`, detalle en `HANDOFF.md`.

No iniciar el Núcleo Cognitivo ni abrir fases nuevas.
