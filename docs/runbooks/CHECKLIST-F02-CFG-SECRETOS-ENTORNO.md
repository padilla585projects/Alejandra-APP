# Checklist — F-0.2-CFG: mover secretos al entorno `production`

> Tarea administrativa exclusiva del Director. Ningún agente debe ejecutar estos pasos ni leer,
> imprimir o versionar los valores reales (CLAUDE.md, "Prohibido"; reglas globales de
> seguridad de la sesión). Este documento solo describe el procedimiento y los nombres de
> variable — sin ningún valor real.

## Contexto (verificado en solo lectura, 2026-08-03)

- Estado actual: **5 secretos a nivel de repositorio** (`gh secret list`): `ADMIN_TOKEN`,
  `ANTHROPIC_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OPENAI_API_KEY`.
- Entorno `production` ya existe en GitHub (creado 2026-08-01, protegido con revisor
  requerido: `padilla585projects`), pero **no tiene ningún secreto propio todavía**
  (`gh secret list --env production` vacío).
- Los tres workflows que consumen secretos (`deploy-worker.yml`, `deploy-alejandra-agente.yml`,
  `migrate-d1-agent.yml`, `setup-secrets.yml`) ya declaran `environment: production` en su job,
  así que en cuanto un secreto exista a nivel de entorno con el mismo nombre, GitHub lo
  resuelve automáticamente sin tocar el YAML — la migración es solo mover el secreto de sitio,
  no cambiar workflows.
- `.env.example` es la referencia completa de variables (sin valores) para los dos Workers.

## Parte 1 — Secretos de GitHub Actions (los que ya existen a nivel de repo)

Para cada uno de los 5, en GitHub (`Settings → Environments → production → Environment
secrets → Add secret`, o `gh secret set NOMBRE --env production` pegando el valor real desde tu
gestor de contraseñas):

- [ ] `CLOUDFLARE_API_TOKEN`
- [ ] `CLOUDFLARE_ACCOUNT_ID`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `ADMIN_TOKEN`

Después de crear los 5 a nivel de entorno:

- [ ] Confirmar que aparecen con `gh secret list --env production` (esto sí es solo lectura,
      no expone valores).
- [ ] Borrar los 5 del nivel de repositorio (`Settings → Secrets and variables → Actions →
      Repository secrets`, o `gh secret delete NOMBRE`). Hazlo **después** de confirmar que la
      copia en el entorno funciona (paso de verificación más abajo), no antes.

> Nota: un secreto de **entorno** solo es visible para jobs cuyo workflow declare
> `environment: production` (los 4 workflows de despliegue/migración/secretos ya lo hacen). Un
> secreto de **repositorio** es visible para cualquier workflow del repo, incluido CI en cada
> push a cualquier rama. Mover estas 5 claves reales al entorno reduce su exposición a
> exactamente los 4 flujos que las necesitan y que ya exigen tu aprobación manual.

## Parte 2 — Verificación tras mover (antes de borrar del repositorio)

- [ ] Lanzar `setup-secrets.yml` (`workflow_dispatch`, confirmación
      `CONFIGURE_AGENT_SECRETS`) y aprobar el entorno `production` cuando lo pida — si los
      secretos de entorno están bien puestos, el job los resuelve igual que antes.
- [ ] Alternativa más ligera si no quieres tocar Cloudflare secrets todavía: lanzar
      `deploy-worker.yml` o `deploy-alejandra-agente.yml` normalmente (con su confirmación
      exacta) — si el job llega a "Deploy with Wrangler" sin error de autenticación, confirma
      que `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` se resolvieron bien desde el entorno.
- [ ] Solo después de una ejecución exitosa, borrar los 5 secretos del nivel de repositorio
      (paso final de la Parte 1).

## Parte 3 — Secretos de los Workers en Cloudflare (aparte de GitHub Actions)

Esto es un sistema distinto: son los secrets que cada Worker lee en tiempo de ejecución
(`env.ANTHROPIC_API_KEY`, etc. dentro de `worker.js`/`alejandra-agente/worker.js`), no los que
usa GitHub Actions para desplegar. **No están afectados por la Parte 1** — ya viven en
Cloudflare, no en GitHub, y Cloudflare no tiene un concepto de "entorno" separado del propio
Worker en este plan. F-0.2-CFG, tal como está definida en `CLAUDE.md`/`HANDOFF.md`, se refiere
a los secretos de **GitHub Actions** (Parte 1); esta parte es solo referencia por si en algún
momento quieres auditar también el lado de Cloudflare.

- [ ] (Opcional, fuera de alcance de F-0.2-CFG) Revisar en el dashboard de Cloudflare
      (`Workers → alejandra-app-api → Settings → Variables and Secrets` y lo mismo para
      `alejandra-agente`) que cada secreto de `.env.example` está presente y sin duplicados
      obsoletos (p.ej. las dos variables "legacy" marcadas en el archivo:
      `FIREBASE_SERVER_KEY`, `GETAWAY_TOKEN`).

## Cuándo hacerlo

Según `CLAUDE.md`/`HANDOFF.md`: cuando el proyecto entre en fase de preproducción/producción
estable. Revisado el 2026-08-03: sigue pospuesto por decisión tuya; este documento queda listo
para cuando decidas ejecutarlo.
