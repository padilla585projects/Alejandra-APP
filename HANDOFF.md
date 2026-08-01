# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agentes que entregan: Codex y Claude, Agentes de Ingeniería
- Trabajo entregado: F-0.1 (entrega segura), GOV-001 (proceso de ingeniería), ARC-011 fases 1-2 (inventario de esquema) y ARC-012 (tres columnas ausentes)
- Estado: **F-0.1 activa en remoto** y **ARC-012 resuelto y verificado**; quedan la configuración de secretos por entorno y la causa raíz ARC-013
- PRs integradas: #9 (F-0.1), #10 (ARC-011), #11 (ARC-012)

## Qué está terminado

**F-0.1 — Entrega segura.** CI, despliegues, publicación de Pages, migraciones D1 y configuración de secretos son cinco flujos independientes. Ningún push o merge activa producción desde los workflows versionados. Cada promoción exige iniciar el workflow a mano, indicar un `ref` y escribir una confirmación exacta.

- `ci.yml` valida en PR y ramas distintas de `main`, sin secretos ni wrangler.
- Los 5 workflows de producción solo declaran `workflow_dispatch`.
- `d1 execute` existe únicamente en `migrate-d1-agent.yml`, con selector cerrado.
- Sin `|| echo`, `|| true` ni `continue-on-error` en ningún workflow.
- La escritura de secretos salió del despliegue y valida que ningún valor esté vacío.
- Healthchecks automáticos de Workers **retirados por diseño**: `GET /health` devuelve 200 sin comprobar D1/R2, así que daría por bueno un despliegue roto. Verificación manual en el runbook. Pages sí conserva healthcheck porque valida la versión servida.
- Pages incorpora precheck de sincronía de `version.json` / `sw.js` / `index.html`.

**GOV-001 — Proceso de ingeniería.** `ENGINEERING_WORKFLOW.md` es el procedimiento operativo único, independiente del modelo de IA. `AGENTS.md` conserva solo las reglas específicas del repositorio y remite a él.

**Decisiones cerradas.** ADR-0001 (entrega deliberada) y ADR-0002 (contrato cognitivo, como arquitectura objetivo con implementación bloqueada) aceptados. ADR-0005 cierra COH-001/ARC-009; ADR-0002 cierra COH-002/ARC-010. Foundation v0.1 sin bloqueos de coherencia.

**F-0.1-R — Activación en remoto.** El P0 está neutralizado en producción.

| Acción | Resultado |
|---|---|
| Workflows antiguos desactivados antes de integrar | ✅ los 4 en `disabled_manually` |
| CI ejecutado | ✅ `SUCCESS` en `push` y en `pull_request` |
| Despliegues disparados durante el proceso | ✅ ninguno |
| Entorno `production` | ✅ creado con `required_reviewers` |
| Protección de `main` | ✅ PR obligatoria, check `Syntax and agent tests`, rama al día, sin force-push ni borrado |

**ARC-011 fases 1 y 2 — Inventario del esquema D1 (PR #10).** Análisis estático de los dos workers contra los 25 `.sql` versionados, y después contraste con el esquema real de D1 (consulta de solo lectura sobre metadatos, autorizada por el Director; no se leyó ningún dato de negocio).

Conclusión central: **el esquema de producción no se puede reconstruir desde el repositorio.** 105 de 150 tablas existen solo porque el código las crea en caliente, y 27 tablas reales —incluidas `empresas`, `fichajes` e `incidencias`— no las declara nadie. Es un riesgo de continuidad de negocio. Informe completo en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`.

**ARC-012 — Tres columnas ausentes, arregladas (PR #11).** El contraste destapó tres `ALTER` silenciados que nunca se aplicaron. Se corrigieron por el workflow manual y se verificaron después contra el esquema real:

| Columna | Qué reparó | Run |
|---|---|---|
| `planos.circuitos_json` | 4 operaciones de planos rotas | 30722027660 |
| `inventario_seg.ubicacion` | SEG-01, cerrado el 25/07/2026 sin haberlo estado nunca | 30722072138 |
| `empresas.retencion_config` | Retención RGPD, inoperante | 30722103191 |

El bloqueo de la migración 008 se retiró: se había decidido leyendo código sin contrastar con el esquema real, y la migración **era el arreglo, no el riesgo**. Lección registrada en el runbook.

Primer uso real del circuito de entrega segura. Se comportó como estaba diseñado: los tres runs quedaron en `waiting` hasta aprobación del entorno.

## Qué está pendiente

- **ARC-013 — causa raíz, sin resolver.** Los 18 `ALTER` en runtime siguen con `catch` vacío. Mientras el patrón continúe, cada DDL fallido crea un bug silencioso más; tres de dieciocho ya habían fallado. Requiere desplegar `worker.js`, por lo que no entró en el arreglo de datos.
- **ARC-014 — la aprobación de entorno no frena a un token de administración.** La barrera detiene automatismos accidentales, no a un actor con ese token. Evaluar `prevent_self_review`, revisores distintos del solicitante, o un token de menor privilegio para agentes.
- **Secretos aún a nivel de repositorio.** Moverlos al entorno `production` exige reintroducir los valores a mano: la API no los expone. No borrarlos del repositorio hasta haberlos verificado en el entorno.
- **Ensayo de confirmación errónea** sobre un workflow de producción: debe salir `skipped`.
- **`required_approving_review_count` está en 1.** Al ser un repositorio de un solo mantenedor, GitHub no permite auto-aprobar: el merge exige el bypass de administrador (`enforce_admins` está en `false` precisamente para conservar esa vía). Decidir si se mantiene o baja a 0.
- **Política de rama de `github-pages`** limitada a `main`: publicar desde un tag fallaría. Decidir si se amplía.
- **`usuario_obras` no existe en producción**, pese a estar declarada en código y en `migrate_roles_multiobra.sql`. Comprobar qué depende de ella antes de aplicar nada.
- Auditoría remota de Cloudflare: pendiente.

## Riesgos abiertos

- **ARC-011 fase 3 (crítico).** Falta el ADR, el migrador único, declarar las 27 tablas huérfanas y retirar el DDL en runtime vertical por vertical, solo cuando su equivalente versionado esté aplicado y verificado. No antes.
- **`run_migration`.** La tool del agente permite crear tablas y columnas en caliente por decisión de Alejandra. Es una vía adicional de divergencia del esquema y no se ha analizado; debe entrar en el ADR de la fase 3.
- **ARC-008.** No existe endpoint de salud con dependencias reales; sin él no se pueden reincorporar los healthchecks.
- **ARC-005** mitigado solo para el código, no para el esquema, y pendiente de validación remota.
- Migraciones de raíz sin manifiesto único.
- ADR-0004 sigue propuesto; el Núcleo Cognitivo no puede iniciarse.

## Lunes — qué tiene que hacer el Director

ARC-013 está **corregido y verificado en local**, pero un arreglo de observabilidad no
sirve de nada sin desplegar. Estos son los pasos, en orden:

1. **Revisar e integrar las dos ramas.** Ninguna está publicada: se dejaron en local a
   propósito, porque publicar es una acción hacia fuera y correspondía decidirla al Director.

   | Rama | Commits | Qué lleva |
   |---|---|---|
   | `docs/estado-arc012-arc014` | `1cc942d` | Solo documentación de estado |
   | `fix/arc-013-ddl-sin-silenciar` | `eb772ee`, `5bedd98`, `5c8b2b9`, `6f95fbf` | ARC-013 (los dos workers), roadmap/backlog/changelog al día y ARC-015 |
   | `feat/f-0.2-inventario-y-contratos` | `2cc6f5b`, `16dd55d` | F-0.2: catálogo de rutas, checks de CI, arreglo de `/sesion/departamento` y ADR-0006 |

   Cada rama sale de la anterior, así que **integrando la última entra todo**.

   ⚠️ La tercera toca `ci.yml`. El job conserva su nombre `Syntax and agent tests` a
   propósito, porque es el check requerido por la protección de `main`: si en alguna
   revisión se renombra, la protección deja de exigir nada.
2. **Desplegar `worker.js`** por su workflow manual, con `ref` del commit aprobado y la
   confirmación exacta. Recordar que la aprobación del entorno la puede conceder la misma
   credencial que lanza el workflow (ARC-014): conviene hacerlo de forma consciente.
3. **Comprobar `wrangler tail` durante unos minutos** y buscar líneas `[DDL]`. Esa es la
   prueba de que el arreglo funciona: si aparece alguna, hay un DDL que lleva fallando en
   silencio y ahora se ve. **Si no aparece ninguna, también es un buen resultado.**
4. `alejandra-agente/worker.js` es un despliegue **independiente**. Los dos workers se
   despliegan por separado; desplegar uno no despliega el otro.

Riesgo del despliegue: bajo. `runDDL()` no lanza en ningún caso —probado también con el
binding roto—, y en éxito y en duplicado se comporta exactamente igual que el código
anterior. Lo único que cambia es que un fallo real deja rastro. El cambio de ARC-015 es
texto del prompt: no toca lógica.

Al desplegar entran además las correcciones de ARC-015, así que conviene **probar a
preguntarle a Alejandra por checklists, turnos o mantenimientos**: son consultas que
antes generaban SQL contra columnas inexistentes.

## Otras acciones pendientes del Director

**`F-0.2-CFG`** — recrear los secretos de Cloudflare en el entorno `production`. Exige
manejar los valores reales, que la API no expone.

**ADR-0006 — decidir.** Redactado y pendiente de tu respuesta. Es el primer dominó de la
Época 1: bloquea ADR-0004, que bloquea F-1.1. Tiene cinco preguntas al final; la de mayor
impacto es si `run_migration` sale del alcance de Alejandra, porque hoy le permite alterar
el esquema saltándose el circuito de F-0.1. Aceptarlo no desbloquea la implementación por
sí solo: seguirían pendientes ARC-003 (definición de Nexo), ARC-004 (QA) y ARC-006
(catálogo de tools), cada uno con su propia decisión.

**ARC-015 — autorizar la consulta de metadatos a D1** para cerrar las ~29 tablas cuyo
esquema descrito a Alejandra no se puede verificar desde el repositorio.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers.
- No ejecutar migraciones D1 remotas.
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo ni abrir fases nuevas.
- No iniciar ARC-011 fase 3 sin su ADR.
