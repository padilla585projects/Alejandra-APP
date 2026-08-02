# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agentes que entregan: Codex y Claude, Agentes de Ingeniería
- Trabajo entregado: F-0.1/F-0.1-R (entrega segura), GOV-001 (proceso de ingeniería), ARC-011 fases 1-2 (inventario de esquema), ARC-012 (tres columnas ausentes), ARC-013/015/016/017 (desplegados en producción), F-0.2 (completada), ARC-018 (Worker/bucket R2 huérfanos borrados), ADR-0007 y su enmienda 1, y los siete ADR de Época 1 (`ADR-0004`, `ADR-0006`, `ADR-0008`, `ADR-0009`, `ADR-0010`, `ADR-0011`, `ADR-0013`, `ADR-0014`) — **todos aceptados por el Director el 2026-08-02**
- Estado: Época 0 cerrada salvo `F-0.2-CFG` (secretos por entorno) y `ARC-014` (decisión pendiente). **Época 1 abierta y sin ADR propuesto pendiente**: `ADR-0004` aceptado, F-1.1 cerrada; F-1.2 en curso, ampliable con las interfaces de memoria (ADR-0013) y trazas (ADR-0014), ambos aceptados con modificaciones.
- PRs integradas: #9 (F-0.1), #10 (ARC-011), #11 (ARC-012)

## Qué está terminado

**F-0.1 — Entrega segura.** CI, despliegues, publicación de Pages, migraciones D1 y configuración de secretos son cinco flujos independientes. Ningún push o merge activa producción desde los workflows versionados. Cada promoción exige iniciar el workflow a mano, indicar un `ref` y escribir una confirmación exacta.

**F-0.1-R — Activación en remoto.** El P0 está neutralizado en producción: workflows antiguos desactivados, CI verde, entorno `production` con revisor requerido, `main` protegida.

**GOV-001 — Proceso de ingeniería.** `ENGINEERING_WORKFLOW.md` es el procedimiento operativo único.

**ADR-0007 — Autonomía por reversibilidad**, con su enmienda 1 (apertura autónoma de fases cuando todas sus dependencias y ADR están cerrados). Es el ADR que permite las sesiones largas de trabajo autónomo desde entonces.

**ARC-011 fases 1-2 — Inventario del esquema D1 (PR #10).** El esquema de producción no se puede reconstruir desde el repositorio: 105 de 150 tablas existen solo porque el código las crea, 27 tablas reales no las declara nadie. Informe en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`.

**ARC-012 — Tres columnas ausentes, arregladas y verificadas (PR #11).** `planos.circuitos_json`, `inventario_seg.ubicacion` (cierra SEG-01 de verdad) y `empresas.retencion_config` (restaura la retención RGPD).

**ARC-013, ARC-015, ARC-016, ARC-017 — desplegados en producción.** Los dos Workers están desplegados y respondiendo (`alejandra-app-api` `a5ccf770`, `alejandra-agente` `a67353ec`). El DDL en runtime ya no falla en silencio; el chat anónimo del agente ya no alcanza datos de otra empresa; el cron ya no ejecuta con privilegios de desarrollador; el esquema descrito a Alejandra está corregido en las 8 tablas cuyo `CREATE` es autoritativo en el código.

**F-0.2 — Inventario remoto, calidad y contratos base (completada 2026-08-02).** Catálogo de 544 rutas con su autorización, 0 sin proteger; inventario de bindings/secretos limpio; cuatro validaciones en CI (encoding, versiones, autorización de rutas, secretos declarados); auditoría remota de Cloudflare en solo lectura, con el esquema de Alejandra verificado contra D1 real (ARC-015 cerrado) y un hallazgo nuevo (**ARC-018**, resuelto el mismo día: Worker y bucket R2 huérfanos borrados).

**Siete ADR de Época 1 — todos aceptados el 2026-08-02:**

| ADR | Resuelve | Decisión |
|---|---|---|
| `ADR-0006` | ARC-001 | Matriz de riesgo N0–N3. `run_migration` pasa a capacidad administrativa fuera del alcance autónomo, sujeta a autorización explícita |
| `ADR-0008` | ARC-003 | Nexo = capa de integración con sistemas externos (interpretación A) |
| `ADR-0009` | ARC-004 | QA en tres niveles: determinista, revisión humana asíncrona, explicabilidad (deuda hasta F-4.1) |
| `ADR-0010` | ARC-006 | Catálogo de tools: `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool |
| `ADR-0011` | ARC-011 fase 3 | Aceptado como estrategia: migrador por vertical, empezando por `checklists`, con manifiesto versionado |
| `ADR-0004` | Motor de Decisión y modos cognitivos | Aceptado como arquitectura objetivo. Cierra F-1.1 |
| `ADR-0013` | ARC-002 | Aceptado con modificaciones: memoria opt-in, candidatas pendientes de validación para inferencias, caducidad 6/12 meses, aprobación por rol para memoria compartida, supresión real sin versión archivada |
| `ADR-0014` | ARC-008 | Aceptado con modificaciones: tabla `alejandra_trazas` en D1, retención 30/90 días, minimización obligatoria, endpoint único en `alejandra-app-api`, `/health` de tres estados. Migración autorizada solo en desarrollo/pruebas |

Consecuencia: ARC-001, ARC-002, ARC-003, ARC-004, ARC-006 y ARC-008 quedan cerrados en `ARCHITECT_BACKLOG.md`.

## Qué está pendiente

- **P-ARCH-002 — componente compartido de presentación, en revisión.** P-ARCH-001 (salud del panel) fue aprobado. Se extrajo la primitiva de notificaciones temporales a `packages/design-system`, manteniendo las 12 invocaciones, iconos, cierre, caducidad y fallback. No llama a backend ni trata permisos. Evidencia, pruebas y rollback: `docs/architecture/FRONTEND_SLICE_TOAST.md`. No ampliar hasta revisión del Director.

- **F-1.2, núcleo cognitivo, en curso — ampliada.** `ADR-0004` aceptado, F-1.1 cerrada. `nucleo-cognitivo/` construido como paquete aislado (Estado Cognitivo, Policy Engine, interfaces de Context Engine/Planner/Motor de Decisión). Con ADR-0013/0014 aceptados, se amplió (PR #20) con la interfaz `memory.js` y el contrato `registrarTraza()` — ambos sin persistencia real. La tabla `alejandra_trazas` ya está aplicada y verificada (ARC-008-TRAZAS-MIGRACION); nada escribe en ella todavía. No integrado en `worker.js` ni `alejandra-agente/worker.js`.
- **ARC-011 fase 3, trabajo de código** — declarar la migración `.sql` del vertical `checklists` (autónomo); aplicarla contra D1 sigue exigiendo autorización del Director.
- **ARC-014 — la aprobación de entorno no frena a un token de administración.** Evaluar `prevent_self_review`, revisores distintos del solicitante, o un token de menor privilegio para agentes.
- **Secretos aún a nivel de repositorio (`F-0.2-CFG`).** Moverlos al entorno `production` exige reintroducir los valores a mano: la API no los expone.
- **Ensayo de confirmación errónea** sobre un workflow de producción: debe salir `skipped`.
- **`usuario_obras` no existe en producción**, pese a estar declarada en código y en `migrate_roles_multiobra.sql`. Comprobar qué depende de ella antes de aplicar nada.

## Riesgos abiertos

- **ARC-011 fase 3.** Estrategia aceptada (ADR-0011); implementación por vertical, empezando por `checklists`, al ritmo del roadmap. Cada aplicación real contra D1 exige autorización aparte.
- **`run_migration`.** Sigue siendo una vía de divergencia del esquema hasta que su gating en código refleje la clasificación N3 de ADR-0006/0010.
- **ARC-005** mitigado solo para el código, no para el esquema, y pendiente de validación remota.
- Migraciones de raíz sin manifiesto único (lo resuelve la implementación de ADR-0011).
- La migración de `alejandra_trazas` (ADR-0014) está autorizada solo en desarrollo/pruebas; aplicarla en una futura producción exige autorización aparte.

## Próximo trabajo autónomo

Con `memory.js`, `registrarTraza()` y `alejandra_trazas` ya en pie, el siguiente trabajo real
de F-1.2 es de alcance mayor y toca código de producción: implementar `registrarTraza()` en
cada Worker (regla de los dos cerebros) y `GET /admin/trazas` en `alejandra-app-api` (ADR-0014
§3/§5) — fuera del aislamiento actual del núcleo, conviene acordar su alcance explícito antes
de abrirlo. En paralelo, ARC-011 fase 3 sigue con su paso 1 completo (`migrate_checklists.sql`);
aplicarla contra D1 sigue exigiendo autorización del Director.

## Otras acciones pendientes del Director

**`F-0.2-CFG`** — recrear los secretos de Cloudflare en el entorno `production`. Exige
manejar los valores reales, que la API no expone.

**`ARC-014`** — decidir cómo separar la aprobación de entorno del token que lanza el despliegue.

**P-ARCH-002 — revisar la rebanada de notificaciones.** No bloquea el backend ni el Núcleo
Cognitivo; sí bloquea la siguiente extracción de frontend hasta que se revise su evidencia.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers sin verificación posterior registrada.
- No ejecutar migraciones D1 remotas (incluida la del vertical `checklists`, aunque se declare en código).
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No integrar `nucleo-cognitivo/` en `worker.js` ni `alejandra-agente/worker.js`.
- No persistir memoria ni trazas reales sin aplicar antes la migración D1 correspondiente con autorización explícita (la de trazas ya autorizada, pero solo en desarrollo/pruebas).
- No aplicar la migración de `alejandra_trazas` contra una futura producción sin autorización aparte.
- No aceptar nuevas revisiones de ningún ADR por cuenta propia si aparece una contradicción.
- No ampliar la migración de presentación más allá de P-ARCH-002 hasta su revisión.
