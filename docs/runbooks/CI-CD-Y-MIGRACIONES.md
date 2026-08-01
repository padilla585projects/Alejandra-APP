# Runbook — CI, despliegue y migraciones

## Flujo normal

1. Crear una rama y abrir PR: `ci.yml` ejecuta validaciones sin secretos de producción.
2. Integrar solo tras revisión y CI correcto. Integrar no publica, despliega, migra ni reconfigura secretos.
3. Para producción, iniciar manualmente el workflow correspondiente desde GitHub Actions, indicando un SHA/tag revisado y la confirmación exacta.
4. Cada operación requiere la protección del entorno correspondiente y una aprobación humana. Esta configuración remota es `PENDIENTE` de verificación.

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

### Migración 008 — `migrate_008_plano_circuitos.sql` — BLOQUEADA

**No puede ejecutarse desde el workflow.** Está excluida del selector y, además, rechazada por
un guard explícito en `.github/workflows/migrate-d1-agent.yml`. Doble barrera deliberada.

Motivo:

- `planos.circuitos_json` **ya se crea desde código**: `worker.js:24646`, dentro de
  `_ensurePlanosTable()`, ejecuta `ALTER TABLE planos ADD COLUMN circuitos_json TEXT` silenciado
  con `.catch(() => {})`. El fichero `.sql` duplica ese mismo cambio.
- Ejecutar la 008 **fallaría por columna duplicada** (`duplicate column name: circuitos_json`).
  Al haberse retirado el `|| echo` que enmascaraba errores, ese fallo detendría el workflow —
  correcto, pero evitable no lanzándola.
- **El estado real de producción sigue pendiente de verificación autorizada.** No se ha
  consultado D1 remoto: la afirmación anterior se basa en lectura de código, no en evidencia de
  la base de datos.
- **El fichero se conserva**, no se borra: documenta la intención del cambio y es material para
  el inventario de ARC-011.

La solución definitiva no pertenece a F-0.1, sino al saneamiento del gobierno del esquema D1
(ARC-011): mientras el código siga creando columnas en caliente, cualquier migración versionada
que las duplique estará en conflicto por diseño.

Para desbloquearla en el futuro: eliminar primero el DDL en runtime de `worker.js`, verificar el
esquema real con consulta autorizada de solo lectura, y solo entonces decidir si la 008 debe
aplicarse, reescribirse como idempotente o archivarse como ya aplicada.

Las migraciones de raíz están `PENDIENTE`: no tienen manifiesto/orden único. Aplicarlas solo mediante procedimiento específico aprobado hasta normalizarlas.

## Secretos

`Configure Cloudflare secrets (manual)` es una operación de producción independiente. Requiere `CONFIGURE_AGENT_SECRETS`, la protección del entorno `production` y secretos de GitHub disponibles únicamente en dicho entorno. Configura juntos los nombres existentes `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `ADMIN_TOKEN` mediante `wrangler secret bulk`; no se invoca durante CI, despliegues ni migraciones.

## Configuración manual obligatoria en GitHub

1. Crear o revisar los entornos `production` y `github-pages`.
2. Exigir revisores de despliegue y restringir quién puede iniciar cada entorno.
3. Limitar los secretos de Cloudflare y de aplicación al entorno `production`.
4. Proteger `main`: PR obligatoria, CI obligatorio y prohibir pushes directos.
5. Revisar permisos de `CLOUDFLARE_API_TOKEN` con mínimo privilegio y rotación definida.

## Evidencia de cierre

Antes de aprobar F-0.1, conservar enlace a la PR, SHA validado, resultados de CI, configuración remota revisada y confirmación de que no se ejecutó ningún despliegue ni migración durante esta fase.
