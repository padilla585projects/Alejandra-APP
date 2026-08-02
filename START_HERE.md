# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

Foundation v0.1 aprobada. F-0.1 está **cerrada localmente**: CI, CD, secretos y migraciones quedan separados en los workflows versionados y ningún push o merge activa producción.

**Activa en producción desde el 2026-08-02** (PR #9): workflows antiguos retirados, `main` protegida y entorno `production` con revisor requerido. Queda mover los secretos a nivel de entorno. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

**ARC-011 fases 1 y 2 completadas** (PR #10): el esquema real de D1 está inventariado y contrastado contra el código. 105 de 150 tablas existen solo porque el código las crea y 27 tablas de producción no las declara nadie. El contraste destapó **3 bugs activos** por `ALTER` silenciados.

**ARC-012 resuelto** (PR #11): las tres columnas ausentes se aplicaron por el workflow manual y se verificaron contra el esquema real. Fue el primer uso real del circuito de entrega segura, y funcionó. Quedan abiertos **ARC-013** (causa raíz: 18 `catch` vacíos) y **ARC-014** (un token de administración puede aprobar su propio despliegue).

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

**ARC-013 — sustituir los 18 `catch` vacíos de DDL por registro de error** (tarea `ARC-013` en `TASKS.md`). Es la causa raíz de ARC-012: mientras siga, cada `ALTER` fallido creará un bug silencioso más. El cambio de código se puede preparar y validar; **el despliegue de `worker.js` requiere autorización aparte**.

En paralelo, y solo por el Director: **`F-0.2-CFG`**, mover los secretos al entorno `production`. Requiere manejar los valores reales.

No iniciar el Núcleo Cognitivo ni abrir fases nuevas. ARC-011 fase 3 (migrador único y retirada del DDL en runtime) exige ADR propio y no está autorizada.
