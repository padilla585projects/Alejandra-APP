# Handoff — Alejandra 2.0

- Fecha: 2026-08-01
- Agente que entrega: Codex, Arquitecto Técnico
- Tarea: F-0.1 — Entrega segura
- Estado: implementación local completada; en revisión y validación remota pendiente
- Rama: `codex/foundation-close`
- Último commit de implementación: `a59a2c5` — `chore(ci): separate validation deployment and migrations`

## Objetivo realizado

Se separaron CI, despliegues, migraciones D1 y configuración de secretos sin ejecutar ninguna acción sobre producción. La PR valida; los workflows de producción requieren inicio manual, SHA/tag explícito, confirmación textual y entorno protegido.

## Cambios realizados

- Se creó `ci.yml` para validación sin credenciales de producción.
- Pages, API Worker y Agent Worker se convirtieron en workflows manuales separados.
- Las migraciones D1 del agente se extrajeron a `migrate-d1-agent.yml` con selector cerrado.
- La escritura de secretos se retiró de los despliegues; el workflow manual independiente usa carga masiva y no imprime valores.
- Se formalizó `migrate_008_plano_circuitos.sql` en el runbook, sin aplicarla.
- Se actualizaron ADR-0001, `CLAUDE.md`, estado, backlog, roadmap, registro documental y changelog.

## Archivos modificados

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-worker.yml`
- `.github/workflows/deploy-alejandra-agente.yml`
- `.github/workflows/pages.yml`
- `.github/workflows/migrate-d1-agent.yml`
- `.github/workflows/setup-secrets.yml`
- `docs/runbooks/CI-CD-Y-MIGRACIONES.md`
- `docs/decisions/ADR-0001-ENTREGA-DELIBERADA.md`
- `CLAUDE.md`, `TASKS.md`, `START_HERE.md`, `PROJECT_STATE.md`, `CHANGELOG.md`, `ARCHITECT_BACKLOG.md`, `MASTER_ROADMAP.md`, `docs/DOCUMENTATION-REGISTER.md`

## Pruebas ejecutadas

- YAML válido en los seis workflows.
- Política de triggers revisada: solo `ci.yml` responde a PR/push; los workflows de producción solo tienen `workflow_dispatch`.
- `node --check worker.js`: correcto.
- `node --check alejandra-agente/worker.js`: correcto.
- `npm --prefix alejandra-agente test`: 85/85 tests correctos.
- `git diff --check`: correcto.

## Problemas, bloqueos y riesgos

- No hay autenticación GitHub local; no se pudo inspeccionar ni configurar protecciones de rama, aprobadores o secretos de entorno.
- La protección efectiva requiere configurar `production` para Workers, D1 y secretos; Pages exige además `github-pages`.
- Las migraciones de raíz siguen sin manifiesto único. La migración 008 no es idempotente y no tiene rollback automático.
- No se desplegó, no se ejecutó migración remota y no se modificó ningún secreto real.

## Siguiente acción exacta

Revisar los commits de esta rama. Con acceso administrativo a GitHub, proteger `main`, configurar revisores y secretos por entorno, y abrir una PR para confirmar que solo ejecuta CI. No ejecutar ningún workflow manual de producción durante esa validación.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers.
- No ejecutar migraciones D1 remotas, incluida la 008.
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo ni funcionalidades ajenas a F-0.1.
