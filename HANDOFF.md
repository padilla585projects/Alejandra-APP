# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agentes que entregan: Codex (implementación) y Claude (revisión y cierre), Arquitecto Técnico
- Tarea: F-0.1 — Entrega segura
- Estado: **cerrada localmente**; validación remota y configuración manual de GitHub pendientes
- Rama: `codex/foundation-close` — **sin push, sin merge**
- Commits: `a59a2c5` (workflows), `6d5d98c` (documentación), `96417a5` (correcciones finales de CI), más el commit de documentación de este cierre

## Objetivo realizado

Se separaron CI, despliegues, migraciones D1 y configuración de secretos sin ejecutar ninguna acción sobre producción. La PR valida; los workflows de producción requieren inicio manual, SHA/tag explícito, confirmación textual y entorno protegido.

## Cambios realizados

- Se creó `ci.yml` para validación sin credenciales de producción.
- Pages, API Worker y Agent Worker se convirtieron en workflows manuales separados.
- Las migraciones D1 del agente se extrajeron a `migrate-d1-agent.yml` con selector cerrado.
- La escritura de secretos se retiró de los despliegues; el workflow manual independiente usa carga masiva y no imprime valores.
- Se actualizaron ADR-0001, `CLAUDE.md`, estado, backlog, roadmap, registro documental y changelog.

### Correcciones del cierre (revisión)

- **Healthchecks automáticos retirados** de los despliegues de Workers. `GET /health` existe y es público en ambos, sin credenciales ni efectos secundarios, pero devuelve 200 sin comprobar D1/R2 y con la versión escrita a mano en el agente: no distingue Worker desplegado de Worker operativo. Sustituidos por verificación manual en el runbook. El de Pages se conserva porque valida la versión servida.
- **`migrate_008_plano_circuitos.sql` bloqueada**: fuera del selector y rechazada por un guard explícito. `worker.js:24646` ya crea `planos.circuitos_json` en runtime, así que aplicarla fallaría por columna duplicada. El fichero se conserva.
- **ARC-011 registrado** como riesgo crítico, con el alcance real de F-0.1 delimitado y el inventario de DDL en runtime como trabajo futuro obligatorio con ADR propio.
- ARC-005 matizado; ARC-008 ampliado con la carencia de endpoint de salud real.
- Correcciones previas ya integradas: entorno de Pages devuelto a `github-pages` (obligatorio para `deploy-pages@v4`), precheck de sincronía de versiones y `node --check` antes de desplegar la API.

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
- Las migraciones de raíz siguen sin manifiesto único. La migración 008 no es idempotente, está bloqueada y no tiene rollback automático.
- **ARC-011 (crítico):** el esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción, no las migraciones versionadas. F-0.1 no lo resuelve ni pretende resolverlo.
- **El estado real de D1 no se ha verificado.** Todo lo afirmado sobre el esquema procede de lectura de código, no de consulta a la base de datos. Requiere autorización.
- No se desplegó, no se ejecutó migración remota y no se modificó ningún secreto real.

## Siguiente acción exacta

Revisar los cuatro commits de esta rama. Antes de nada, **verificar que existe el secret `CLOUDFLARE_ACCOUNT_ID`** en GitHub: tres workflows dependen ahora de él y antes el ID iba escrito en el YAML.

Después, con acceso administrativo: proteger `main`, crear el entorno `production` con revisores, comprobar `github-pages`, y abrir una PR para confirmar que solo ejecuta CI. Antes del merge, desactivar manualmente los workflows antiguos desde la UI de Actions para garantizar que la integración no dispara ningún despliegue. No ejecutar ningún workflow manual de producción durante esa validación.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers.
- No ejecutar migraciones D1 remotas, incluida la 008.
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo ni funcionalidades ajenas a F-0.1.
