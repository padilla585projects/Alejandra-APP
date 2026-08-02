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
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción, no las migraciones versionadas. Fases 1 y 2 verificadas. **Fase 3 con ADR redactado** (`ADR-0011`, propuesto): migración por vertical, empezando por `checklists`, con manifiesto de estado. Pendiente de decisión.
- **ARC-018 (alto, nuevo):** la auditoría remota de Cloudflare del 2026-08-02 encontró un Worker huérfano (`alejandra-worker`, fork abandonado de `worker.js` de mayo, sin las mejoras SEC-01 a SEC-15, con rutas de escritura completas y alcanzables) y un bucket R2 no documentado (`alejandra-files`). No se ha confirmado si comparten datos con producción, ni se han tocado — la autorización cubría lectura de metadatos, no borrar recursos.
- **ARC-014 (medio):** la aprobación del entorno `production` se concedió con la misma credencial que lanzó el workflow. Un agente con token de administración puede aprobar su propio despliegue: la barrera cubre el error accidental, no la intención.
- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- ARC-008: no existe un endpoint de salud que verifique dependencias reales.
- Migraciones raíz carecen de manifiesto único (ver propuesta en ADR-0011).
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Decisiones pendientes del Director

Cinco ADR redactados y **propuestos**, esperando decisión. Ninguno implica trabajo adicional del agente hasta ser aceptados — es la frontera que fija ADR-0007: redactar es autónomo, aceptar no.

| ADR | Resuelve | Qué decide |
|---|---|---|
| `ADR-0006` | ARC-001 | Matriz de riesgo N0–N3; si `run_migration` sale del alcance del agente. Primer dominó — desbloquea ADR-0004 y F-1.1 |
| `ADR-0008` | ARC-003 | Qué es «Nexo»: tres interpretaciones mutuamente excluyentes |
| `ADR-0009` | ARC-004 | Alcance de QA: tres niveles de verificación, generalizando lo que ya existe (SEC-08/SEC-09) |
| `ADR-0010` | ARC-006 | Catálogo de tools: el nivel de acceso pasa a ser metadato declarado, no listas externas que se olvidan |
| `ADR-0011` | ARC-011 fase 3 | Migrador por vertical y manifiesto de migraciones aplicadas |

Además: **`F-0.2-CFG`** (secretos por entorno), **ARC-018** (worker/bucket huérfanos) y **ARC-014** (autoaprobación de despliegue) — ninguno requiere ADR, pero sí decisión.

## Siguiente objetivo

No hay tarea de ingeniería pendiente sin decisión previa. El trabajo autónomo de Época 0 está agotado hasta que el Director resuelva alguno de los cinco ADR de arriba — aceptarlos es lo único que desbloquea la Época 1.
