# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agentes que entregan: Codex y Claude, Agentes de Ingeniería
- Trabajo entregado: F-0.1/F-0.1-R (entrega segura), GOV-001 (proceso de ingeniería), ARC-011 fases 1-2 (inventario de esquema), ARC-012 (tres columnas ausentes), ARC-013/015/016/017 (desplegados en producción), F-0.2 (completada), ADR-0007 y su enmienda 1, y los cinco ADR de Época 1 (`ADR-0006`, `ADR-0008`, `ADR-0009`, `ADR-0010`, `ADR-0011`) — **todos aceptados por el Director el 2026-08-02**
- Estado: Época 0 cerrada salvo `F-0.2-CFG` (secretos por entorno) y `ARC-018`/`ARC-014` (decisiones pendientes). Época 1 sigue bloqueada solo por `ADR-0004` (Motor de Decisión), el único ADR que no se ha aceptado todavía.
- PRs integradas: #9 (F-0.1), #10 (ARC-011), #11 (ARC-012)

## Qué está terminado

**F-0.1 — Entrega segura.** CI, despliegues, publicación de Pages, migraciones D1 y configuración de secretos son cinco flujos independientes. Ningún push o merge activa producción desde los workflows versionados. Cada promoción exige iniciar el workflow a mano, indicar un `ref` y escribir una confirmación exacta.

**F-0.1-R — Activación en remoto.** El P0 está neutralizado en producción: workflows antiguos desactivados, CI verde, entorno `production` con revisor requerido, `main` protegida.

**GOV-001 — Proceso de ingeniería.** `ENGINEERING_WORKFLOW.md` es el procedimiento operativo único.

**ADR-0007 — Autonomía por reversibilidad**, con su enmienda 1 (apertura autónoma de fases cuando todas sus dependencias y ADR están cerrados). Es el ADR que permite las sesiones largas de trabajo autónomo desde entonces.

**ARC-011 fases 1-2 — Inventario del esquema D1 (PR #10).** El esquema de producción no se puede reconstruir desde el repositorio: 105 de 150 tablas existen solo porque el código las crea, 27 tablas reales no las declara nadie. Informe en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`.

**ARC-012 — Tres columnas ausentes, arregladas y verificadas (PR #11).** `planos.circuitos_json`, `inventario_seg.ubicacion` (cierra SEG-01 de verdad) y `empresas.retencion_config` (restaura la retención RGPD).

**ARC-013, ARC-015, ARC-016, ARC-017 — desplegados en producción.** Los dos Workers están desplegados y respondiendo (`alejandra-app-api` `a5ccf770`, `alejandra-agente` `a67353ec`). El DDL en runtime ya no falla en silencio; el chat anónimo del agente ya no alcanza datos de otra empresa; el cron ya no ejecuta con privilegios de desarrollador; el esquema descrito a Alejandra está corregido en las 8 tablas cuyo `CREATE` es autoritativo en el código.

**F-0.2 — Inventario remoto, calidad y contratos base (completada 2026-08-02).** Catálogo de 544 rutas con su autorización, 0 sin proteger; inventario de bindings/secretos limpio; cuatro validaciones en CI (encoding, versiones, autorización de rutas, secretos declarados); auditoría remota de Cloudflare en solo lectura, con el esquema de Alejandra verificado contra D1 real (ARC-015 cerrado) y un hallazgo nuevo (**ARC-018**: Worker y bucket R2 huérfanos, sin tocar, pendiente de decisión).

**Cinco ADR de Época 1 — todos aceptados el 2026-08-02:**

| ADR | Resuelve | Decisión |
|---|---|---|
| `ADR-0006` | ARC-001 | Matriz de riesgo N0–N3. `run_migration` pasa a capacidad administrativa fuera del alcance autónomo, sujeta a autorización explícita |
| `ADR-0008` | ARC-003 | Nexo = capa de integración con sistemas externos (interpretación A) |
| `ADR-0009` | ARC-004 | QA en tres niveles: determinista, revisión humana asíncrona, explicabilidad (deuda hasta F-4.1) |
| `ADR-0010` | ARC-006 | Catálogo de tools: `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool |
| `ADR-0011` | ARC-011 fase 3 | Aceptado como estrategia: migrador por vertical, empezando por `checklists`, con manifiesto versionado |

Consecuencia: ARC-001, ARC-003, ARC-004 y ARC-006 quedan cerrados en `ARCHITECT_BACKLOG.md`.

## Qué está pendiente

- **P-DESIGN-001 — visión del frontend, en revisión.** La migración de presentación se pausa.
  `docs/architecture/FRONTEND_PRODUCT_VISION.md` define la dirección visual madura y cuenta
  con un mockup representativo. El Director ha confirmado la dirección de centro de control
  operativo y la paleta propuesta como futuro modo claro, manteniendo la identidad cromática
  actual. No extraer más componentes ni construir el frontend nuevo hasta decisión final.

- **P-ARCH-002/P-ARCH-003 — presentación, completadas localmente.** P-ARCH-001 (salud del panel) fue aprobado. P-ARCH-002 extrajo la primitiva de notificaciones a `packages/design-system`, manteniendo 12 invocaciones, iconos, cierre, caducidad y fallback. P-ARCH-003 extrajo los 12 tokens base de color a `packages/design-system/src/tokens/base.css`, sin cambiar sus 299 consumidores. No llaman a backend ni tratan permisos. Evidencias y rollback: `docs/architecture/FRONTEND_SLICE_TOAST.md` y `docs/architecture/FRONTEND_SLICE_TOKENS.md`.

- **`ADR-0004` (Motor de Decisión) — el único ADR de Época 1 sin aceptar.** Es lo único que le falta a F-1.1 para abrirse; es una fase de decisión que ADR-0007 enmienda 1 excluye de la apertura autónoma.
- **ARC-011 fase 3, trabajo de código** — declarar la migración `.sql` del vertical `checklists` (autónomo); aplicarla contra D1 sigue exigiendo autorización del Director.
- **ARC-014 — la aprobación de entorno no frena a un token de administración.** Evaluar `prevent_self_review`, revisores distintos del solicitante, o un token de menor privilegio para agentes.
- **Secretos aún a nivel de repositorio (`F-0.2-CFG`).** Moverlos al entorno `production` exige reintroducir los valores a mano: la API no los expone.
- **ARC-018 — Worker y bucket R2 huérfanos**, detectados en la auditoría de Cloudflare. No confirmado si `alejandra-worker` comparte la misma `alejandra-db` de producción. No se ha tocado.
- **Ensayo de confirmación errónea** sobre un workflow de producción: debe salir `skipped`.
- **`usuario_obras` no existe en producción**, pese a estar declarada en código y en `migrate_roles_multiobra.sql`. Comprobar qué depende de ella antes de aplicar nada.

## Riesgos abiertos

- **ARC-011 fase 3.** Estrategia aceptada (ADR-0011); implementación por vertical, empezando por `checklists`, al ritmo del roadmap. Cada aplicación real contra D1 exige autorización aparte.
- **`run_migration`.** Sigue siendo una vía de divergencia del esquema hasta que su gating en código refleje la clasificación N3 de ADR-0006/0010.
- **ARC-008.** No existe endpoint de salud con dependencias reales; sin él no se pueden reincorporar los healthchecks.
- **ARC-005** mitigado solo para el código, no para el esquema, y pendiente de validación remota.
- Migraciones de raíz sin manifiesto único (lo resuelve la implementación de ADR-0011).
- ARC-002 (gobierno de memoria) sigue sin ADR.

## Próximo trabajo autónomo

Con ARC-001/003/004/006 cerrados y ADR-0011 aceptado como estrategia, el siguiente trabajo
autónomo de Época 0/1 es declarar la migración `.sql` del vertical `checklists` (ARC-011
fase 3, paso 1: código reversible, sin tocar D1). El resto de la Época 1 permanece detenido
hasta que el Director resuelva `ADR-0004`.

## Otras acciones pendientes del Director

**`F-0.2-CFG`** — recrear los secretos de Cloudflare en el entorno `production`. Exige
manejar los valores reales, que la API no expone.

**`ADR-0004` — decidir.** Es ahora el único dominó que falta para abrir F-1.1 y con ella el
resto de la Época 1.

**`ARC-018`** — decidir qué hacer con el Worker y el bucket R2 huérfanos.

**`ARC-014`** — decidir cómo separar la aprobación de entorno del token que lanza el despliegue.

**Presentación — siguiente rebanada.** Puede continuar con un componente reutilizado de verdad
en más de un flujo del panel, sin tocar backend ni el núcleo cognitivo.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers sin verificación posterior registrada.
- No ejecutar migraciones D1 remotas (incluida la del vertical `checklists`, aunque se declare en código).
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo (F-1.2 en adelante).
- No aceptar `ADR-0004` por cuenta propia.
- No extraer un componente que afecte a autorización, llamadas HTTP o lógica de negocio.
