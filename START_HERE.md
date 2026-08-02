# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

Foundation v0.1 aprobada. **F-0.1 activa en producción desde el 2026-08-02** (PR #9): workflows
antiguos retirados, `main` protegida, entorno `production` con revisor requerido. Queda mover
los secretos a nivel de entorno (`F-0.2-CFG`, pospuesta). Detalle en
`docs/runbooks/CI-CD-Y-MIGRACIONES.md`. Healthcheck automático post-despliegue reincorporado
(PR #36).

**ARC-011 fases 1 y 2 verificadas** (PR #10); **ARC-012 resuelto** (PR #11); **ARC-013, 015,
016, 017 corregidos y desplegados en producción.** ARC-011 fase 3 (`ADR-0011`, migrador por
vertical) tiene su paso 1 completo (`migrate_checklists.sql`); aplicarla contra D1 exige
autorización del Director. **ARC-018 resuelto** (worker/bucket R2 huérfanos borrados).
**ARC-014**: riesgo aceptado temporalmente por el Director mientras haya un único mantenedor.

**F-0.2 completada** (2026-08-02): catálogo de rutas, CI de calidad y auditoría remota de
Cloudflare.

**Los ocho ADR de Época 1 aceptados** (2026-08-02): `ADR-0004`, `ADR-0006`, `ADR-0008`,
`ADR-0009`, `ADR-0010`, `ADR-0011` (como estrategia), `ADR-0013` y `ADR-0014` (estos dos con
modificaciones). Ningún ADR de Época 1 queda `Propuesto`. Cierran ARC-001, ARC-002, ARC-003,
ARC-004, ARC-006 y ARC-008, y con `ADR-0004` se cierra **F-1.1**.

**F-1.2 completada y verificada** (2026-08-02): `nucleo-cognitivo/`, paquete aislado con Estado
Cognitivo, Policy Engine, interfaces de Context Engine/Planner/Motor de Decisión, `memory.js`
(ADR-0013) y el contrato `registrarTraza()` (ADR-0014). `registrarTraza()` real, `/health` de
tres estados y `GET /admin/trazas` ya están desplegados en producción (ADR-0014, fuera del
paquete aislado, en cada Worker).

**F-1.3 abierta** (2026-08-02): primer entregable en curso, esqueleto y contratos del Tool
Registry (ADR-0010) y Verifier (ADR-0009), mismo patrón aislado que F-1.2 — ver `TASKS.md`.

**Presentación (P-1):** `ADR-0012` aceptado. P-ARCH-001 y **P-ARCH-002 aprobados** por el
Director. Queda desbloqueada la siguiente rebanada, aún sin definir.

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

Trabajo autónomo en curso: **F-1.3-TOOL-REGISTRY-ESQUELETO** (ver `TASKS.md`) — esqueleto y
contratos del Tool Registry y Verifier, sin integrar en producción ni migrar el catálogo real
de tools de ningún Worker.

En paralelo, sigue pendiente de decisión exclusiva del Director: **`F-0.2-CFG`** (secretos al
entorno `production`), **ARC-014** (reapertura si cambia el número de mantenedores o entra en
producción real), **ARC-011-FASE3-CHECKLISTS paso 2** (aplicar la migración contra D1), y
definir la siguiente rebanada de presentación (P-1) tras P-ARCH-002.

No integrar `nucleo-cognitivo/` en producción ni activar memoria persistente en él.
