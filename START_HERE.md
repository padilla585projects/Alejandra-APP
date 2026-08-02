# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

Foundation v0.1 aprobada. F-0.1 está **cerrada localmente**: CI, CD, secretos y migraciones quedan separados en los workflows versionados y ningún push o merge activa producción.

**Activa en producción desde el 2026-08-02** (PR #9): workflows antiguos retirados, `main` protegida y entorno `production` con revisor requerido. Queda mover los secretos a nivel de entorno. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

**ARC-011 fases 1 y 2 completadas** (PR #10): el esquema real de D1 está inventariado y contrastado contra el código. 105 de 150 tablas existen solo porque el código las crea y 27 tablas de producción no las declara nadie. El contraste destapó **3 bugs activos** por `ALTER` silenciados.

**ARC-012 resuelto** (PR #11): las tres columnas ausentes se aplicaron por el workflow manual y se verificaron contra el esquema real. Fue el primer uso real del circuito de entrega segura, y funcionó. **ARC-013 corregido y desplegado.** Sigue abierto **ARC-014** (un token de administración puede aprobar su propio despliegue).

**F-0.2 completada** (2026-08-02): catálogo de rutas, CI de calidad y auditoría remota de Cloudflare, con el hallazgo **ARC-018** (worker/bucket huérfanos) pendiente de decisión.

**Seis ADR de Época 1 aceptados** (2026-08-02): `ADR-0004`, `ADR-0006`, `ADR-0008`, `ADR-0009`, `ADR-0010` y `ADR-0011` (este último como estrategia). Cierran ARC-001, ARC-003, ARC-004 y ARC-006, y con `ADR-0004` se cierra **F-1.1**. Se abre **F-1.2**, acotada a esqueleto y contratos del núcleo cognitivo (`nucleo-cognitivo/`), sin activar memoria persistente ni decisiones sin trazabilidad.

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

**ARC-013 ya está desplegado en producción** (ver `PROJECT_STATE.md`). F-0.2 se completó el
2026-08-02 con la auditoría remota de Cloudflare. El Director aceptó el mismo día los cinco
ADR de la primera tanda de Época 1 (`ADR-0006`, `ADR-0008`, `ADR-0009`, `ADR-0010`, `ADR-0011`),
cerrando ARC-001, ARC-003, ARC-004 y ARC-006.

Trabajo autónomo habilitado ahora mismo: **ARC-011 fase 3, vertical `checklists`** —
declarar la migración `.sql` a partir del esquema real ya verificado en ARC-015 (código
reversible). **Aplicarla contra D1 sigue exigiendo autorización explícita del Director.**

**`ADR-0004` aceptado el 2026-08-02**: cierra F-1.1 y abre F-1.2. Primer entregable en curso:
`nucleo-cognitivo/`, paquete aislado con Estado Cognitivo, Policy Engine y las interfaces de
Context Engine, Planner y Motor de Decisión — sin integrarlo en `worker.js` ni
`alejandra-agente/worker.js`. Por restricción expresa del Director: no se activa memoria
persistente sensible (ARC-002 sigue sin ADR) ni se toman decisiones sin trazabilidad
suficiente (ARC-008 sigue abierto). Memory, Nexo, Capability/Tool Registry, Verifier y QA
quedan fuera — son F-1.3/F-2.1/F-2.2, no abiertas.

En paralelo, y solo por el Director: **`F-0.2-CFG`** (secretos al entorno `production`),
**ARC-018** (worker/bucket huérfanos), **ARC-014** (autoaprobación de despliegue), y
**ARC-002**/**ARC-008** (memoria y trazas, condición para ampliar F-1.2).

No integrar `nucleo-cognitivo/` en producción ni activar memoria persistente en él.

**Presentación:** `ADR-0012` fue aceptado. La arquitectura vigente está en
`docs/architecture/FRONTEND_ARCHITECTURE.md`; el piloto de salud P-ARCH-001 fue aprobado.
La rebanada compartida de notificaciones P-ARCH-002 está en revisión: no ampliar hasta revisar
`docs/architecture/FRONTEND_SLICE_TOAST.md`.
