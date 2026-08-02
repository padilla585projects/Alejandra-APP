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

## Riesgos activos

- Los secretos siguen a nivel de repositorio, no de entorno: cualquier workflow puede leerlos.
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción, no las migraciones versionadas. Fases 1 y 2 verificadas; **fase 3 pendiente** (ADR, migrador único, declaración de las 27 tablas huérfanas y retirada del DDL en runtime por verticales).
- **ARC-013 (alto):** los 18 `ALTER` en runtime llevan `catch` vacío, así que un fallo no deja rastro. Tres de dieciocho ya habían fallado sin que nadie lo supiera. Es la causa raíz de ARC-012 y exige desplegar `worker.js`.
- **ARC-015 (alto):** el bloque `SCHEMA BASE DE DATOS` del prompt de `worker.js` describe columnas que no existen, así que Alejandra genera SQL que falla. Corregidas las 8 tablas con `CREATE` autoritativo en `worker.js`; las ~29 restantes exigen consulta de metadatos a D1 porque las 27 huérfanas no tienen `CREATE` en el repositorio.
- **ARC-014 (medio):** la aprobación del entorno `production` se concedió con la misma credencial que lanzó el workflow. Un agente con token de administración puede aprobar su propio despliegue: la barrera cubre el error accidental, no la intención.
- `usuario_obras` está declarada en código y en `.sql` pero **no existe** en producción: `migrate_roles_multiobra.sql` nunca se aplicó. Pendiente comprobar de qué depende antes de actuar.
- ARC-005 queda mitigado en los workflows versionados, pendiente de validación remota.
- ARC-008: no existe un endpoint de salud que verifique dependencias reales.
- Migraciones raíz carecen de manifiesto único y no se automatizan.
- Núcleo Cognitivo y Motor de Decisión siguen documentados, no implementados.

## Siguiente objetivo

**ARC-013 — retirar la supresión de errores del DDL en runtime.** Mientras el patrón siga, cada `ALTER` fallido creará un bug silencioso más. El cambio de código se prepara y valida en rama; el despliegue de `worker.js` requiere autorización explícita aparte.

En paralelo, solo por el Director: **`F-0.2-CFG`** (secretos por entorno y ensayo en vacío del circuito manual), porque exige manejar los valores reales.

Después: ARC-011 fase 3 con ADR propio, y resolver ADR-0004 antes de implementar el Núcleo Cognitivo.
