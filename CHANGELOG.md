# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added

- `ADR-0004` aceptado (2026-08-02): arquitectura objetivo del Motor de Decisión. Cierra F-1.1 y abre F-1.2.
- `ADR-0013` aceptado con modificaciones (2026-08-02): gobierno de memoria (ARC-002). Lista blanca de categorías (hechos declarados, preferencias, procedimientos, correcciones); inferencias automáticas solo como candidata pendiente de validación humana; caducidad 6 meses por defecto, 12 para procedimientos empresariales aprobados; memoria personal libre, memoria compartida exige aprobación `encargado`+; derecho de supresión con eliminación real, sin versión archivada, sin verificación extra desde sesión propia autenticada, reforzada si es sensible/amplia/fuera de sesión; D1 vía el migrador de ADR-0011.
- `ADR-0014` aceptado con modificaciones (2026-08-02): observabilidad y trazas (ARC-008). Tabla D1 `alejandra_trazas` compartida por los dos Workers; retención 30 días para trazas de decisión y 90 para errores de DDL/eventos de seguridad, con minimización/redacción obligatoria; un único endpoint `GET /admin/trazas` en `alejandra-app-api`; `/health` con tres estados (`healthy`/`degraded`/`unhealthy`) comprobando D1 y un objeto centinela en R2, versión derivada del SHA de despliegue; migración autorizada solo en el entorno actual de desarrollo/pruebas.
- `nucleo-cognitivo/`: esqueleto y contratos del núcleo cognitivo (Estado Cognitivo, Policy Engine, interfaces de Context Engine/Planner/Motor de Decisión), paquete aislado sin integrar en producción, sin memoria persistente ni decisiones sin trazabilidad.
- CI independiente, workflows manuales de Pages/Workers y migración D1 controlada del agente.
- Runbook de CI/CD y migraciones, con procedimiento de verificación manual post-despliegue.
- Registro operativo de F-0.1 en `TASKS.md`, incluida la migración 008 sin ejecutar.
- ARC-011: riesgo crítico de esquema D1 definido por DDL en tiempo de ejecución, con el inventario de `CREATE TABLE`/`ALTER TABLE` desde código registrado como trabajo futuro obligatorio.
- Precheck de sincronía de versiones antes de publicar Pages, y healthcheck que verifica la versión servida.
- `ENGINEERING_WORKFLOW.md` como procedimiento operativo común e independiente del modelo de IA.
- Regla de autonomía de los agentes: los prompts asignan objetivos y el contexto se obtiene de la documentación versionada.
- Inventario del esquema real de D1 (`docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`), con las dos fases de ARC-011: análisis estático de los dos workers y contraste con producción.
- `runDDL()` en ambos workers: ejecuta DDL en caliente sin lanzar, pero registrando todo error que no sea el duplicado esperado. `ddlPaso()` para `runMigrations()`, que distingue aplicada / ya existía / ERROR.
- ARC-013 y ARC-014 en el backlog, abiertos a raíz del arreglo de ARC-012.
- F-0.2: cuatro scripts de inventario y validación en `scripts/` —rutas y su autorización, encoding, sincronía de versiones, y secretos/bindings/migraciones—, todos de solo lectura y enganchados al job de CI existente. Ninguno contacta con Cloudflare ni lee valores de secretos.
- ADR-0006, ADR-0008, ADR-0009, ADR-0010 y ADR-0011, redactados y **aceptados por el Director el mismo día** (2026-08-02): matriz de riesgo N0–N3 (ARC-001), definición de Nexo como capa de integración (ARC-003), QA en tres niveles (ARC-004), catálogo de tools con metadato de acceso (ARC-006), y migrador por vertical como estrategia (ARC-011 fase 3). Cierran ARC-001, ARC-003, ARC-004 y ARC-006 en el backlog.
- `migrate_checklists.sql`: primer vertical de la migración por fases de ARC-011 (ADR-0011), declara `checklist_plantillas`, `checklist_registros`, `checklists_plantillas` y `checklist_ejecuciones` con el esquema exacto de `worker.js`. Paso 1 (declarar) completo; aplicarla contra D1 exige autorización aparte del Director.
- `migrate_manifiesto.json`: primer manifiesto de migraciones (formato de ADR-0011), con las tres migraciones de ARC-012 ya verificadas y `migrate_checklists.sql` como pendiente de aplicar.

### Removed

- ARC-018 resuelto: `alejandra-worker` (fork huérfano de `worker.js`, CORS abierto, confirmado contra la `alejandra-db` real vía dashboard) borrado de Cloudflare. Su bucket `alejandra-files` contenía 12 fotos únicas de una incidencia real (23/04, obra 1/eléctrico) que nunca llegaron a `alejandra-app-files`; migradas y verificadas por tamaño idéntico antes de vaciar y borrar el bucket. Ambos recursos ya no existen en la cuenta.

### Changed

- ADR-0001 aceptado: un push o merge ya no activa producción desde los workflows versionados; secretos, Pages y D1 quedan desacoplados del despliegue ordinario.
- `migrate_008_plano_circuitos.sql` estuvo bloqueada unas horas por un diagnóstico incorrecto —se supuso que `worker.js` ya creaba la columna— y se **desbloqueó y aplicó** el 2026-08-02 al comprobar contra el esquema real que la columna no existía. La migración era el arreglo, no el riesgo.
- Los despliegues de Workers pierden el healthcheck automático: `GET /health` no comprueba D1/R2 ni acredita la versión desplegada, así que un 200 podía dar por bueno un despliegue roto. Se sustituye por verificación manual documentada y queda registrado en ARC-008.
- ARC-005 se matiza: la mitigación cubre las migraciones lanzadas por workflow, no el DDL que ejecuta el propio Worker.
- Auditoría remota de GitHub en solo lectura: `main` sin protección, entorno `production` inexistente, `github-pages` limitado a `main`, secretos a nivel de repositorio y workflows antiguos aún activos. El runbook sustituye los `PENDIENTE` por el estado real.
- F-0.1 activada en remoto (PR #9): workflows antiguos desactivados antes de integrar, CI verde sin disparar ningún despliegue, entorno `production` creado con revisor requerido y `main` protegida con PR obligatoria y check requerido. Queda mover los secretos a nivel de entorno.
- Consolidación documental: `MASTER_ROADMAP.md` refleja ADR-0001/0002 aceptados y COH-001/COH-002 cerrados. `TASKS.md` y `HANDOFF.md` mantienen la cola inmediata y el relevo.
- ARC-012 resuelto: `planos.circuitos_json`, `inventario_seg.ubicacion` y `empresas.retencion_config` aplicadas por el workflow manual y verificadas contra el esquema real. Cierra SEG-01 de verdad —el fix del 25/07 nunca llegó a funcionar— y restaura la retención RGPD, que estaba inoperante.
- ARC-013: se retira la supresión de errores del DDL en runtime en los dos workers (48 llamadas a `runDDL`, 10 pasos a `ddlPaso`). No cambia comportamiento observable —el helper nunca lanza— pero un `no such table` deja de ser invisible. Requiere despliegue de `worker.js` para surtir efecto.
- Puesta al día del estado tras las PR #10 y #11: `START_HERE.md`, `PROJECT_STATE.md`, `HANDOFF.md`, `TASKS.md`, `MASTER_ROADMAP.md` y `ARCHITECT_BACKLOG.md` seguían reflejando solo hasta la PR #9.
- `PUT /sesion/departamento` comprobaba que el header `X-Token` existiera, pero no que la sesión fuese real ni que no hubiera caducado, y devolvía `ok:true` aunque no actualizara ninguna fila. El `UPDATE` está acotado por token, así que no permitía tocar la sesión de otro, pero una sesión ya caducada podía seguir cambiando su departamento —cosa que el resto de endpoints impide desde SEC-08/SEC-09—. Detectado por el catálogo de rutas de F-0.2.
- Sin cambios de datos ni despliegues. Los cambios de código son de observabilidad, de corrección del prompt y de esa comprobación de sesión.
