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

Cada despliegue usa un `ref` explícito. Antes de iniciarlo: confirmar SHA, CI, responsable, healthcheck esperado y rollback. Para revertir, publicar manualmente el último SHA sano mediante el workflow específico.

## Migraciones D1

`Apply Alejandra Agent D1 migration (manual)` es el único workflow versionado que puede aplicar una de las ocho migraciones del agente. Requiere seleccionar el archivo en una lista cerrada, escribir `APPLY_D1_MIGRATION`, revisión de la migración, aprobación del entorno `production` y validación posterior. Nunca ejecutar una migración como paso de despliegue.

### Migración 008 — `migrate_008_plano_circuitos.sql`

La migración 008 queda registrada en el selector, pero **no ha sido ejecutada**. Añade `circuitos_json` a `planos` y no es idempotente. Antes de autorizarla, el responsable debe:

1. confirmar el SHA exacto y revisar el SQL;
2. verificar con consulta remota de solo lectura y autorización que la columna no existe;
3. documentar impacto, ventana, responsable y mitigación;
4. ejecutar únicamente el workflow de migración, no un despliegue;
5. registrar la evidencia posterior y el resultado en el handoff.

El rollback de un `ALTER TABLE ... ADD COLUMN` no se presume: requiere una decisión y procedimiento específico aprobados.

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
