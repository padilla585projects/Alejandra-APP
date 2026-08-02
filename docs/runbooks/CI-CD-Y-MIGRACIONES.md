# Runbook — CI, despliegue y migraciones

## Flujo normal

1. Crear una rama y abrir PR: `ci.yml` ejecuta validaciones sin secretos de producción.
2. Integrar solo tras revisión y CI correcto. Integrar no publica, despliega, migra ni reconfigura secretos.
3. Para producción, iniciar manualmente el workflow correspondiente desde GitHub Actions, indicando un SHA/tag revisado y la confirmación exacta.
4. Cada operación requiere la protección del entorno correspondiente y una aprobación humana. El entorno `production` exige revisor desde el 2026-08-02: ver «Estado remoto».

> ⚠️ Un workflow que solo declara `workflow_dispatch` **no aparece en la interfaz de Actions hasta que está en la rama por defecto**.

> ⚠️ Si la confirmación se escribe mal, el job aparece como **`skipped`** (gris), no como fallo. No confundirlo con un despliegue realizado.

## Despliegues

- API: `Deploy API Worker (manual)` con `DEPLOY_API_WORKER`, entorno `production`.
- Agente: `Deploy Alejandra Agent Worker (manual)` con `DEPLOY_ALEJANDRA_AGENT`, entorno `production`; ejecuta tests antes de desplegar.
- Pages: `Publish GitHub Pages (manual)` con `PUBLISH_GITHUB_PAGES`, entorno GitHub obligatorio `github-pages`.

Cada despliegue usa un `ref` explícito. Antes de iniciarlo: confirmar SHA, CI, responsable, verificación esperada y rollback. Para revertir, publicar manualmente el último SHA sano mediante el workflow específico.

### Verificación tras desplegar (manual, obligatoria)

**Los workflows de Workers todavía no ejecutan un healthcheck automático.** No es porque el
endpoint sea superficial: desde ADR-0014, `GET /health` es público, no tiene efectos
secundarios, comprueba D1 y el objeto centinela de R2, y devuelve `estado` (`healthy`,
`degraded` o `unhealthy`) junto con la versión derivada del despliegue.

Por ahora la verificación sigue siendo manual y obligatoria: tras desplegar, el responsable
debe consultar `/health`, confirmar que el estado es `healthy`, realizar una lectura real desde
la aplicación y registrar ambos resultados en el handoff. `degraded` exige investigación antes
de dar el despliegue por bueno; `unhealthy` exige rollback o mitigación.

Pages sí conserva healthcheck automático: comprueba que `/version.json` sirve la versión
publicada, lo que sí distingue publicado de operativo.

El endpoint ya cumple los requisitos para automatizar la comprobación. Incorporarla a los
workflows es una tarea posterior y separada: debe tratar `degraded` como advertencia y
`unhealthy` como bloqueo, y conservar la verificación posterior registrada.

## Migraciones D1

`Apply Alejandra Agent D1 migration (manual)` es el único workflow versionado que puede aplicar una migración del agente. Requiere seleccionar el archivo en una lista cerrada, escribir `APPLY_D1_MIGRATION`, revisión de la migración, aprobación del entorno `production` y validación posterior. Nunca ejecutar una migración como paso de despliegue.

> ⚠️ **Este workflow no es el único mecanismo que altera el esquema.** `worker.js` ejecuta DDL
> en producción por su cuenta (ver ARC-011). Controlar este workflow no controla el esquema.

### Migración 008 — `migrate_008_plano_circuitos.sql` — APLICADA (2026-08-02)

**Desbloqueada el 2026-08-02.** Estuvo excluida del selector durante unas horas por un
diagnóstico incorrecto: se supuso que `worker.js:24646` ya había creado `planos.circuitos_json`
y que aplicarla fallaría por columna duplicada.

La consulta al esquema real (ARC-011 fase 2) demostró lo contrario: **la columna no existe**.
El `ALTER` en runtime falla en silencio por su `.catch(() => {})`, y las cuatro operaciones que
usan esa columna (`worker.js:26073`, `26092`, `26124`, `26216`) están rotas en producción.

Se aplicó el 2026-08-02 (run 30722027660) junto con `migrate_inventario_seg_ubicacion.sql`
(30722072138) y `migrate_empresas_retencion.sql` (30722103191). Las tres columnas quedaron
verificadas contra el esquema real.

> 📌 Lección: un bloqueo basado en lectura de código, sin contrastar con el esquema real, puede
> impedir precisamente el arreglo que hacía falta. Antes de bloquear una migración, verificar.

### Circuito validado en la práctica

Las tres migraciones anteriores fueron el primer uso real del flujo manual. Comportamiento
observado, útil como referencia:

1. `workflow_dispatch` con `ref`, fichero y confirmación exacta.
2. El paso de verificación vuelca el contenido del `.sql` en el log antes de aplicarlo, de modo
   que queda constancia de qué se ejecutó exactamente.
3. El job queda en **`waiting`** hasta que alguien aprueba el entorno `production`. La barrera
   funciona.
4. Tras aprobar, `wrangler` aplica la migración y el log registra las queries ejecutadas.

> ⚠️ La aprobación puede concederse con la misma credencial que lanzó el workflow. Un agente con
> token de administración puede aprobar su propio despliegue: la protección de entorno cubre el
> error accidental, no la intención. Ver ARC-014.

### Migraciones de raíz

El workflow acepta desde el 2026-08-02 migraciones de ambos directorios, indicadas por su ruta
relativa a la raíz del repositorio. Ambos Workers comparten `alejandra-db`, así que un único
flujo cubre las dos familias.

En el selector solo figuran las migraciones **revisadas**. Las históricas de raíz siguen sin
manifiesto ni orden único y no se han incorporado: aplicarlas requiere revisarlas una a una y
añadirlas explícitamente. No dar por hecho que estén aplicadas — la verificación de ARC-011
demostró que `migrate_roles_multiobra.sql` (`usuario_obras`) nunca lo estuvo.

## Secretos

`Configure Cloudflare secrets (manual)` es una operación de producción independiente. Requiere `CONFIGURE_AGENT_SECRETS`, la protección del entorno `production` y secretos de GitHub disponibles únicamente en dicho entorno. Configura juntos los nombres existentes `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `ADMIN_TOKEN` mediante `wrangler secret bulk`; no se invoca durante CI, despliegues ni migraciones.

## Estado remoto

Configurado el 2026-08-02 durante la activación de F-0.1 (PR #9).

| Elemento | Estado | Nota |
|---|---|---|
| Protección de `main` | ✅ PR obligatoria, 1 aprobación, check requerido `Syntax and agent tests`, rama al día, sin force-push ni borrado | `enforce_admins` en `false` a propósito, para conservar una vía de emergencia. |
| Entorno `production` | ✅ Existe con `required_reviewers` | Todo despliegue, migración o cambio de secretos exige aprobación explícita. |
| Entorno `github-pages` | ✅ Existe, política de rama: **solo `main`** | Publicar desde un tag fallaría: el workflow acepta cualquier `ref`, pero el entorno no. |
| Pages | ✅ `build_type: workflow`, HTTPS forzado | El entorno debe llamarse `github-pages`; renombrarlo rompe la publicación. |
| Secretos | ⚠️ Los cinco existen, pero **a nivel de repositorio, no de entorno** | Cualquier workflow puede leerlos. Pendiente de mover. |
| Workflows antiguos | ✅ Desactivados manualmente antes de integrar | Sustituidos por las versiones manuales. |

> ⚠️ Con 1 aprobación requerida y un solo mantenedor, GitHub no permite auto-aprobar: el merge exige el bypass de administrador. Es una fricción conocida, no un fallo.

## Configuración manual pendiente

1. **Recrear los secretos en el entorno `production`** y retirarlos del nivel de repositorio **solo después** de verificarlos allí. La API no expone sus valores, así que debe hacerlo una persona.
2. **Ensayo en vacío**: lanzar un workflow de producción con la confirmación mal escrita y comprobar que el job sale `skipped`.
3. Decidir si `required_approving_review_count` sigue en 1 o baja a 0.
4. Decidir si la política de rama de `github-pages` se amplía para publicar por tag.
5. Revisar permisos de `CLOUDFLARE_API_TOKEN` con mínimo privilegio y rotación definida.

## Evidencia de cierre

Antes de aprobar F-0.1, conservar enlace a la PR, SHA validado, resultados de CI, configuración remota revisada y confirmación de que no se ejecutó ningún despliegue ni migración durante esta fase.
