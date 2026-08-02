# Estado del proyecto — Alejandra 2.0

- Actualizado: 2026-08-02
- Estado: F-0.1 **integrada y activa en remoto**. ARC-011 fases 1 y 2 completadas; ARC-012 resuelto con tres migraciones aplicadas y verificadas.

## Autonomía de los agentes

**ADR-0007 (aceptado, 2026-08-02)** sustituye las prohibiciones absolutas por un criterio de
**reversibilidad**: el código se deshace, los datos no.

Autónomo: ramas, commits, `push`, PR y merge con CI en verde, pruebas, despliegue de Workers
y encadenar tareas ya aprobadas de `TASKS.md`. Requiere decisión humana: migraciones D1,
secretos, borrado de datos, borrado en R2 y abrir una fase nueva.

Se revisó la premisa de que el entorno fuera solo de desarrollo y **no se sostiene**: la app
opera con datos personales reales —ARC-012 restauró la retención RGPD el mismo día— por lo
que las salvaguardas sobre datos se mantienen íntegras. Lo que se retiró es la ceremonia
sobre acciones reversibles.

## Gobierno operativo

`ENGINEERING_WORKFLOW.md` está creado para revisión como proceso común de cualquier agente de ingeniería. Centraliza el procedimiento operativo y deja en `AGENTS.md` solo las reglas específicas del repositorio. No modifica arquitectura, código, infraestructura ni el estado de F-0.1.

## Entrega segura

CI (`ci.yml`), CD manual (Pages y Workers), migraciones D1 y configuración de secretos están separados en el repositorio. Un push/merge ya no activa los workflows de producción versionados.

**Activo en remoto desde el 2026-08-02** (PR #9). Los workflows antiguos se desactivaron antes de integrar, CI pasó en verde y no se disparó ningún despliegue durante el proceso. Se creó el entorno `production` con revisor requerido y se protegió `main` con PR obligatoria y check requerido.

Queda pendiente mover los secretos de repositorio a entorno y probar en vacío el circuito manual: la API no expone los valores de los secretos, así que recrearlos corresponde al Director. Detalle en `docs/runbooks/CI-CD-Y-MIGRACIONES.md`.

Los despliegues de Workers no llevan healthcheck automático: los `GET /health` actuales devuelven 200 sin comprobar D1/R2, por lo que darían por bueno un despliegue roto. La verificación es manual (runbook); Pages sí conserva healthcheck porque valida la versión servida.

## Esquema de datos — ARC-011 y ARC-012

**Fase 1 (análisis estático).** 173 sentencias DDL ejecutables desde código. **105 de las 150 tablas del sistema existen únicamente porque el código las crea en caliente**; ninguna migración versionada las declara. `schema_completo.sql` cubre menos de un tercio del esquema real. Detalle en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`.

**Fase 2 (contraste con D1 real, autorizado, solo metadatos).** 151 tablas en producción. **27 no las declara nadie** —incluidas `empresas`, `fichajes` e `incidencias`—, lo que confirma que **el esquema no es reproducible desde el repositorio**: es un riesgo de continuidad de negocio, no solo de gobierno técnico. De las 41 columnas `ALTER` del código, 38 estaban presentes y **3 habían fallado en silencio**.

**ARC-012 — resuelto el 2026-08-02.** Las tres columnas ausentes se aplicaron por el workflow manual y se verificaron contra el esquema real:

| Columna | Efecto del arreglo | Run |
|---|---|---|
| `planos.circuitos_json` | Repara 4 operaciones de planos rotas | 30722027660 |
| `inventario_seg.ubicacion` | Cierra SEG-01 **de verdad**: el fix del 25/07 nunca funcionó | 30722072138 |
| `empresas.retencion_config` | Restaura la retención RGPD, inoperante hasta entonces | 30722103191 |

El bloqueo de `migrate_008_plano_circuitos.sql` se retiró: partía de un diagnóstico por lectura de código sin contrastar con el esquema real, y la migración **era el arreglo, no el riesgo**.

Fue el primer uso real del circuito de entrega segura de F-0.1 y se comportó como estaba diseñado: los tres runs quedaron en `waiting` hasta aprobación del entorno.

## Estado de despliegue (2026-08-02)

**Los dos Workers están desplegados y respondiendo** (`HTTP 200` verificado): `alejandra-app-api` versión `a5ccf770`, `alejandra-agente` versión `a67353ec`. Llevan ARC-013, ARC-015, ARC-016 y ARC-017 en producción.

## Riesgos activos

- Los secretos siguen a nivel de repositorio, no de entorno: cualquier workflow puede leerlos.
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción, no las migraciones versionadas. Fases 1 y 2 verificadas. **Fase 3: `ADR-0011` aceptado el 2026-08-02** como estrategia (migración por vertical, empezando por `checklists`, con manifiesto de estado); la implementación sigue en curso al ritmo del roadmap, y cada aplicación real contra D1 exige autorización aparte.
- **ARC-018 (alto, nuevo):** la auditoría remota de Cloudflare del 2026-08-02 encontró un Worker huérfano (`alejandra-worker`, fork abandonado de `worker.js` de mayo, sin las mejoras SEC-01 a SEC-15, con rutas de escritura completas y alcanzables) y un bucket R2 no documentado (`alejandra-files`). No se ha confirmado si comparten datos con producción, ni se han tocado — la autorización cubría lectura de metadatos, no borrar recursos.
- **ARC-014 (medio):** la aprobación del entorno `production` se concedió con la misma credencial que lanzó el workflow. Un agente con token de administración puede aprobar su propio despliegue: la barrera cubre el error accidental, no la intención.
- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- ARC-008: no existe un endpoint de salud que verifique dependencias reales.
- Migraciones raíz carecen de manifiesto único (ver propuesta en ADR-0011).
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Decisiones del Director — Época 1 (2026-08-02)

Los cinco ADR de la primera tanda quedaron **aceptados** el mismo día que se redactaron:

| ADR | Resuelve | Decisión |
|---|---|---|
| `ADR-0006` | ARC-001 | Matriz de riesgo N0–N3 aceptada. `run_migration` no se retira del catálogo, pero pasa a capacidad administrativa, fuera del alcance autónomo, sujeta a autorización explícita en cada uso. Desbloquea ADR-0004 |
| `ADR-0008` | ARC-003 | Nexo = interpretación A, capa de integración con sistemas externos. No es Motor de Decisión ni multiagente. Desbloquea F-2.2 |
| `ADR-0009` | ARC-004 | QA en tres niveles (determinista, revisión humana asíncrona, explicabilidad); explicabilidad queda como deuda hasta F-4.1, sin bloquear nada mientras tanto |
| `ADR-0010` | ARC-006 | Catálogo de tools: `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool, migración incremental, un registro por worker |
| `ADR-0011` | ARC-011 fase 3 | Aceptado **como estrategia**: migrador por vertical (empieza por `checklists`), manifiesto versionado. La implementación sigue el ritmo del roadmap; cada aplicación real contra D1 sigue exigiendo autorización aparte (ADR-0007) |

Consecuencia: ARC-001, ARC-003, ARC-004 y ARC-006 quedan **cerrados** en `ARCHITECT_BACKLOG.md`.

**Lo que esto NO desbloquea todavía:** `ADR-0004` (Motor de Decisión) sigue **Propuesto** — es
el único ADR de Época 1 sin decidir, y es una fase de decisión que ADR-0007 enmienda 1 excluye
explícitamente de la apertura autónoma. F-1.1 sigue bloqueada solo por él.

## Decisiones aún pendientes del Director

- **`ADR-0004`** — Motor de Decisión: única decisión que falta para desbloquear F-1.1 y con ella el resto de la Época 1.
- **`F-0.2-CFG`** — mover secretos al entorno `production` (requiere valores reales).
- **`ARC-018`** — worker/bucket huérfanos de la auditoría Cloudflare.
- **`ARC-014`** — autoaprobación de despliegue con token de administración.

## Siguiente objetivo

Con ARC-001/003/004/006 cerrados, se habilita trabajo autónomo de código en la línea de
ARC-011 fase 3 (ADR-0011): declarar la migración `.sql` del vertical `checklists` a partir del
esquema real ya verificado en ARC-015. Es código reversible; **aplicarla contra D1 sigue
requiriendo autorización del Director**. El resto del trabajo de Época 1 (F-1.1 en adelante)
permanece bloqueado hasta que el Director resuelva ADR-0004.

## Arquitectura de presentación

La migración de presentación y el Design System quedan **pausados para decisión visual** por
P-DESIGN-001. La propuesta completa está en `docs/architecture/FRONTEND_PRODUCT_VISION.md`.
No se implementa el nuevo frontend hasta la revisión del Director.

`ADR-0012` fue aceptado el 2026-08-02. La arquitectura vigente
`docs/architecture/FRONTEND_ARCHITECTURE.md` define aplicaciones, features, sistema de diseño
y clientes API. P-ARCH-001 (indicador de salud) fue aprobado. P-ARCH-002 extrae la primitiva
compartida de notificaciones temporales sin contrato de backend y P-ARCH-003 extrae los tokens
base de color; evidencias: `docs/architecture/FRONTEND_SLICE_TOAST.md` y
`docs/architecture/FRONTEND_SLICE_TOKENS.md`. No es dependencia del Núcleo Cognitivo y avanza
en paralelo con backend/motor de decisión; la siguiente rebanada debe limitarse a presentación
de bajo riesgo y conservar los contratos existentes.
