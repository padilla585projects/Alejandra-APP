# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agentes que entregan: Codex y Claude, Agentes de Ingeniería
- Trabajo entregado: F-0.1 (entrega segura) y GOV-001 (proceso de ingeniería), consolidados
- Estado: **implementado localmente; pendiente de integración y validación remota**
- Rama: `codex/foundation-close` — **sin push, sin merge, sin despliegue**
- Commits: `966ad7c`, `a59a2c5`, `6d5d98c`, `96417a5`, `cce5224`, `f644a6b` y la consolidación del 2026-08-02

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

## Qué está pendiente

**F-0.1 no es efectiva en producción.** La rama no está integrada, así que los cuatro workflows antiguos siguen activos en GitHub con sus disparadores por `push`. El riesgo P0 sigue vivo en el remoto.

Auditoría remota de GitHub (2026-08-02, solo lectura, nada modificado):

| Elemento | Estado real |
|---|---|
| Protección de `main` | ❌ No protegida (HTTP 404), sin rulesets |
| Entorno `production` | ❌ No existe; los workflows lo crearían sin reglas de aprobación |
| Entorno `github-pages` | ✅ Existe, política de rama limitada a `main` |
| Pages | ✅ `build_type: workflow`, HTTPS forzado |
| Secretos | ✅ Los 5 existen, pero a nivel de repositorio, no de entorno |
| Workflows en remoto | ⚠️ Los 4 antiguos siguen activos |

Auditoría remota de Cloudflare: pendiente.

## Riesgos abiertos

- **ARC-011 (crítico).** El esquema real de D1 lo define DDL ejecutado desde `worker.js` en producción (~108 `CREATE TABLE IF NOT EXISTS`, ~51 `ALTER TABLE`), no las migraciones versionadas. F-0.1 controla las migraciones del workflow, no las del código. El inventario y su conversión a migraciones versionadas es trabajo futuro obligatorio con ADR propio.
- **El estado real de D1 no está verificado.** Todo lo afirmado sobre el esquema procede de leer código, no de consultar la base de datos.
- **ARC-005** mitigado solo para el código, no para el esquema, y pendiente de validación remota.
- **ARC-008.** No existe endpoint de salud con dependencias reales; sin él no se pueden reincorporar los healthchecks.
- Migraciones de raíz sin manifiesto único.
- ADR-0004 sigue propuesto; el Núcleo Cognitivo no puede iniciarse.

## Siguiente acción exacta

**Activar y validar F-0.1 en GitHub remoto mediante rama y PR segura** (tarea `F-0.1-R` en `TASKS.md`).

Empezar por: desactivar manualmente los 4 workflows antiguos en Actions → cada workflow → `···` → *Disable workflow*, y después abrir la PR de `codex/foundation-close` hacia `main`. Requiere acceso administrativo a GitHub.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers.
- No ejecutar migraciones D1 remotas, incluida la 008.
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo ni abrir fases nuevas.
- No reescribir los commits ya creados en esta rama.
