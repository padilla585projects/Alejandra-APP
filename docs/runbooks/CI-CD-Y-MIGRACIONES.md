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

**Los despliegues de Workers no llevan healthcheck automático a propósito.** `GET /health`
existe y es público en ambos Workers, no exige credenciales y no tiene efectos secundarios,
pero **no distingue «Worker desplegado» de «Worker operativo»**:

| Worker | Endpoint | Por qué no sirve como healthcheck |
|---|---|---|
| API (`alejandra-app-api`) | `worker.js:4822` | Devuelve `{ok:true, ts}` constante. No consulta D1 ni R2: respondería 200 con la base de datos caída o los bindings ausentes. |
| Agente (`alejandra-agente`) | `alejandra-agente/worker.js:2493` | Devuelve flags de presencia de secretos, pero tampoco toca D1/R2. Su campo `version` está escrito a mano (`6.14`) y ya se desincronizó una vez (ver cabecera del archivo, v6.13), así que no acredita qué versión se desplegó. |

Un 200 de esos endpoints daría luz verde a un despliegue roto, que es peor que no comprobar
nada. Por eso la verificación es manual: tras desplegar, el responsable debe comprobar una
operación real de lectura contra D1 desde la aplicación y registrar el resultado en el handoff.

Pages sí conserva healthcheck automático: comprueba que `/version.json` sirve la versión
publicada, lo que sí distingue publicado de operativo.

**Reincorporar healthchecks automáticos requiere primero** un endpoint de salud que verifique
dependencias reales (D1, R2 y bindings) y exponga la versión desplegada de forma derivada, no
escrita a mano. Registrado en ARC-008.

## Migraciones D1

`Apply Alejandra Agent D1 migration (manual)` es el único workflow versionado que puede aplicar una migración del agente. Requiere seleccionar el archivo en una lista cerrada, escribir `APPLY_D1_MIGRATION`, revisión de la migración, aprobación del entorno `production` y validación posterior. Nunca ejecutar una migración como paso de despliegue.

> ⚠️ **Este workflow no es el único mecanismo que altera el esquema.** `worker.js` ejecuta DDL
> en producción por su cuenta (ver ARC-011). Controlar este workflow no controla el esquema.

### Migración 008 — `migrate_008_plano_circuitos.sql` — PENDIENTE DE APLICAR

**Desbloqueada el 2026-08-02.** Estuvo excluida del selector durante unas horas por un
diagnóstico incorrecto: se supuso que `worker.js:24646` ya había creado `planos.circuitos_json`
y que aplicarla fallaría por columna duplicada.

La consulta al esquema real (ARC-011 fase 2) demostró lo contrario: **la columna no existe**.
El `ALTER` en runtime falla en silencio por su `.catch(() => {})`, y las cuatro operaciones que
usan esa columna (`worker.js:26073`, `26092`, `26124`, `26216`) están rotas en producción.

**Aplicar la 008 es el arreglo, no el riesgo.** Riesgo bajo: `ADD COLUMN` es aditivo y no toca
filas existentes. Requiere autorización de migración como cualquier otra.

> 📌 Lección: un bloqueo basado en lectura de código, sin contrastar con el esquema real, puede
> impedir precisamente el arreglo que hacía falta. Antes de bloquear una migración, verificar.

Las migraciones de raíz están `PENDIENTE`: no tienen manifiesto/orden único. Aplicarlas solo mediante procedimiento específico aprobado hasta normalizarlas.

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
