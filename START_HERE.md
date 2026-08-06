# Alejandra 2.0 — empezar aquí

La documentación versionada del repositorio es la fuente oficial.

## Estado actual

Foundation v0.1 aprobada. **F-0.1 activa en producción desde el 2026-08-02** (PR #9): workflows
antiguos retirados, `main` protegida, entorno `production` con revisor requerido. **F-0.2-CFG
completada (2026-08-04):** secretos ya movidos al entorno `production`, ensayo de confirmación
errónea probado (`skipped`), política de rama de `github-pages` ampliada a tags. Detalle en
`docs/runbooks/CI-CD-Y-MIGRACIONES.md`. Healthcheck automático post-despliegue reincorporado
(PR #36).

**ARC-011 fases 1-2 verificadas** (PR #10); **ARC-012 resuelto** (PR #11); **ARC-013, 015, 016,
017 corregidos, desplegados y verificados en producción.** **ARC-011 fase 3 completa: las 14
verticales tienen el ciclo de 5 pasos de ADR-0011 cerrado** (declarar, aplicar, retirar DDL en
runtime, verificar en producción, registrar en manifiesto) — no queda ninguna tarea de
ingeniería activa de ARC-011. **ARC-018 resuelto** (worker/bucket R2 huérfanos borrados).
**ARC-014**: riesgo aceptado temporalmente por el Director mientras haya un único mantenedor,
revisado sin cambios el 2026-08-03. **ARC-019 resuelto** (`ADR-0015` aceptado e implementado el
2026-08-04): `sql_query` sube a N3; `CREATE TABLE`/`CREATE INDEX` exige confirmación humana
(`CONFIRMO MIGRACION <código>`) en `sql_query`/`run_migration`, desplegado y verificado.

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
paquete aislado, en cada Worker). **Excepción acotada por ADR-0020 (2026-08-06):** el adaptador
del Worker IA usa `decidirInvocacionPilotoN0()` para tools N0 ofrecidas y el rechazo de tools no
ofrecidas; no integra Context Engine, Planner, memoria propia ni los flujos N1–N3. PR #98
desplegada y verificada por el run 31089065117 (`/health` manual: `healthy`, D1/R2 disponibles).

**F-1.3 completada** (2026-08-02): Tool Registry (ADR-0010) y Verifier (ADR-0009) migrados a
todo el catálogo real de tools de los dos Workers (96/103, 7 excluidas a propósito). Cierra la
Época 1 completa.

**Época 2 (gobierno de memoria) — lectura y escritura completas y desplegadas.** Esquema
`memoria_gobernada` aplicado (ADR-0013). Lectura: `memoria_consultar` (N0, solo
`alejandra-agente`). **Escritura, decisión del Director (2026-08-04, "Exponer como tools
nuevas"):** `memoria_listar_pendientes` (N0), `memoria_confirmar_candidata`/
`memoria_rechazar_candidata` (N1, excluidas del cron), gate de rol `encargado`+, desplegadas y
verificadas en producción (PR #81). `memory.js` de `nucleo-cognitivo/` sigue sin persistencia
propia (la real vive en cada Worker), y el paquete sigue sin integrarse en ningún Worker.

**Presentación:** `ADR-0012` aceptado. P-ARCH-001 y P-ARCH-002 aprobados. **P-ARCH-003**
(consulta de versión remota compartida, `packages/design-system`) implementada, fusionada y
**publicada en Pages (2026-08-04)**. Queda sin definir ni abrir la siguiente rebanada.

No queda ninguna tarea de ingeniería activa sin decisión del Director pendiente.

**Migraciones D1 aplicadas (2026-08-02):** el Director autorizó en chat el paso 2 de
`migrate_checklists.sql` (ARC-011 fase 3) y `migrate_memoria_gobernada.sql` (F-2.1), sobre la
única D1 existente. Ambas verificadas columna por columna antes y después; ver `HANDOFF.md` y
`migrate_manifiesto.json`. **Vertical `checklists` completo:** el ciclo de 5 pasos de
ADR-0011 quedó cerrado el mismo día (DDL en runtime retirado, `worker.js` desplegado y
verificado en producción sin él) — plantilla probada para el próximo vertical.

## Lectura obligatoria

1. `MASTER_PLAN.md`, `MASTER_ROADMAP.md` y `PROJECT_STATE.md`
2. `TASKS.md`, `HANDOFF.md`, `AGENTS.md` y `ENGINEERING_WORKFLOW.md`
3. `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md` y ADRs relacionados
4. Arquitectura, runbooks y documentación del área afectada

## Siguiente paso

Con `F-0.2-CFG`, las 14 verticales de ARC-011 fase 3, la escritura de `memoria_gobernada`
(F-2.1), `P-ARCH-003` y `ADR-0015`/ARC-019 cerrados y desplegados, **no queda ninguna tarea de
ingeniería activa.** Lo único abierto son decisiones exclusivas del Director:

- **Definir la siguiente rebanada de presentación** tras P-ARCH-003 (aún sin proponer).
- **ARC-014** — revisar si cambian sus condiciones de reapertura (más de un mantenedor o
  producción real).
- **Siguiente rebanada del Motor de Decisión** — analizar las trazas N0 del piloto antes de
  proponerla. Sigue prohibido ampliar la integración a Context Engine, Planner, memoria propia o
  N1–N3 sin una nueva decisión explícita.

No ampliar la integración acotada de ADR-0020 ni activar memoria persistente propia en
`nucleo-cognitivo/`.
