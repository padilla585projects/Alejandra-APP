# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agentes que entregan: Codex y Claude, Agentes de Ingeniería
- Trabajo entregado: F-0.1 (entrega segura) y GOV-001 (proceso de ingeniería), consolidados
- Estado: **F-0.1 integrada en `main` y activa en remoto**; queda configuración de secretos por entorno
- Rama: `codex/foundation-close`, integrada mediante PR #9
- Commits: `966ad7c`, `a59a2c5`, `6d5d98c`, `96417a5`, `cce5224`, `f644a6b`, `a21e630`, `7f2031b`, `80cc1ff`

## Qué está terminado

**F-0.1 — Entrega segura.** CI, despliegues, publicación de Pages, migraciones D1 y configuración de secretos son cinco flujos independientes. Ningún push o merge activa producción desde los workflows versionados. Cada promoción exige iniciar el workflow a mano, indicar un `ref` y escribir una confirmación exacta.

- `ci.yml` valida en PR y ramas distintas de `main`, sin secretos ni wrangler.
- Los 5 workflows de producción solo declaran `workflow_dispatch`.
- `d1 execute` existe únicamente en `migrate-d1-agent.yml`, con selector cerrado.
- Sin `|| echo`, `|| true` ni `continue-on-error` en ningún workflow.
- La escritura de secretos salió del despliegue y valida que ningún valor esté vacío.
- `migrate_008_plano_circuitos.sql` **bloqueada**: fuera del selector y rechazada por un guard, porque `worker.js:24646` ya crea esa columna en runtime. El fichero se conserva.
- Healthchecks automáticos de Workers **retirados por diseño**: `GET /health` devuelve 200 sin comprobar D1/R2, así que daría por bueno un despliegue roto. Verificación manual en el runbook. Pages sí conserva healthcheck porque valida la versión servida.
- Pages incorpora precheck de sincronía de `version.json` / `sw.js` / `index.html`.

**GOV-001 — Proceso de ingeniería.** `ENGINEERING_WORKFLOW.md` es el procedimiento operativo único, independiente del modelo de IA. `AGENTS.md` conserva solo las reglas específicas del repositorio y remite a él.

**Decisiones cerradas.** ADR-0001 (entrega deliberada) y ADR-0002 (contrato cognitivo, como arquitectura objetivo con implementación bloqueada) aceptados. ADR-0005 cierra COH-001/ARC-009; ADR-0002 cierra COH-002/ARC-010. Foundation v0.1 sin bloqueos de coherencia.

**F-0.1-R — Activación en remoto (2026-08-02).** El P0 está neutralizado en producción.

| Acción | Resultado |
|---|---|
| Workflows antiguos desactivados antes de integrar | ✅ los 4 en `disabled_manually` |
| Rama publicada y PR #9 abierta | ✅ |
| CI ejecutado | ✅ `SUCCESS` en `push` y en `pull_request` |
| Despliegues disparados durante el proceso | ✅ ninguno |
| Entorno `production` | ✅ creado con `required_reviewers` |
| Protección de `main` | ✅ PR obligatoria, check `Syntax and agent tests`, rama al día, sin force-push ni borrado |
| PR integrada | ✅ |

## Qué está pendiente

- **Secretos aún a nivel de repositorio.** Moverlos al entorno `production` exige reintroducir los valores a mano: la API no los expone. No borrarlos del repositorio hasta haberlos verificado en el entorno.
- **Ensayo de confirmación errónea** sobre un workflow de producción: debe salir `skipped`. No pudo hacerse antes del merge porque `workflow_dispatch` no aparece hasta estar en la rama por defecto.
- **`required_approving_review_count` está en 1.** Al ser un repositorio de un solo mantenedor, GitHub no permite auto-aprobar: el merge exige el bypass de administrador (`enforce_admins` está en `false` precisamente para conservar esa vía). Decidir si se mantiene o baja a 0.
- **Política de rama de `github-pages`** limitada a `main`: publicar desde un tag fallaría. Decidir si se amplía.
- Auditoría remota de Cloudflare: pendiente.

## Riesgos abiertos

- **ARC-011 (crítico).** El esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción (~108 `CREATE TABLE IF NOT EXISTS`, ~51 `ALTER TABLE`), no las migraciones versionadas. F-0.1 controla las migraciones del workflow, no las del código. El inventario y su conversión a migraciones versionadas es trabajo futuro obligatorio con ADR propio.
- **El estado real de D1 no está verificado.** Todo lo afirmado sobre el esquema procede de leer código, no de consultar la base de datos.
- **ARC-005** mitigado solo para el código, no para el esquema, y pendiente de validación remota.
- **ARC-008.** No existe endpoint de salud con dependencias reales; sin él no se pueden reincorporar los healthchecks.
- Migraciones de raíz sin manifiesto único.
- ADR-0004 sigue propuesto; el Núcleo Cognitivo no puede iniciarse.

## Siguiente acción exacta

**Recrear los secretos de Cloudflare en el entorno `production`** desde Settings → Environments → production (tarea `F-0.2-CFG` en `TASKS.md`). Retirarlos del nivel de repositorio solo después de verificarlos allí.

Requiere manejar los valores reales, por lo que corresponde al Director del Proyecto.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers.
- No ejecutar migraciones D1 remotas, incluida la 008.
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo ni abrir fases nuevas.
- No reescribir los commits ya creados en esta rama.
