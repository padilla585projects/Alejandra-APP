# Backlog arquitectónico — Alejandra 2.0

- Actualizado: 2026-08-01
- Foundation: v0.1 congelada como línea base, sin bloqueos documentales activos (COH-001 y COH-002 cerrados)

## Cómo usarlo

Cada ítem conserva estado, evidencia, impacto, alternativas y fase/ADR de destino. Un ítem aprobado se enlaza a especificación, ADR y PR; no se implementa desde este documento.

## Ítems abiertos

| ID | Estado | Tema | Impacto | Evidencia / siguiente decisión |
|---|---|---|---|---|
| ARC-001 | ADR redactado — pendiente de decisión | Modelo de riesgo y aprobación humana | Alto | ADR-0003 fija evaluación obligatoria; faltaban umbrales, responsables y catálogo de acciones. **ADR-0006 redactado el 2026-08-02** con el catálogo real de capacidades de Alejandra y una propuesta de cuatro niveles por reversibilidad y alcance. Contiene 5 preguntas que solo el Director puede responder; la de mayor impacto es si `run_migration` sale del agente, porque hoy permite alterar el esquema saltándose el circuito de F-0.1. Es el primer dominó: desbloquea ADR-0004 y con él F-1.1. |
| ARC-002 | Pendiente | Gobierno de memoria | Alto | Definir privacidad, tenant, procedencia, confianza, caducidad, corrección y borrado. Requiere ADR y compliance. |
| ARC-003 | Investigación | Definición de Nexo | Alto | Alcance no aprobado: integración, orquestación o producto. No diseñar/implementar sin decisión. |
| ARC-004 | Pendiente | QA y verificación independiente | Alto | Determinar controles deterministas, revisión humana, métricas y trazas. |
| ARC-005 | Mitigado | Promoción deliberada a producción | Crítico | ADR-0001 aceptado e integrado (PR #9, 2026-08-02): CI, despliegues, migraciones y secretos separados; workflows antiguos retirados; `main` protegida; entorno `production` con revisor requerido. Pendiente mover los secretos a nivel de entorno y el ensayo en vacío. La mitigación cubre solo las migraciones lanzadas por workflow, no el DDL que el propio Worker ejecuta en producción: ver ARC-011. |
| ARC-006 | Pendiente | Catálogo de tools y matriz de permisos | Alto | Herramientas sensibles y D1/R2 compartidos exigen contratos y pruebas negativas. |
| ARC-007 | Investigación | Fronteras de dominio y extracción incremental | Medio | Monolitos actuales; elegir vertical piloto tras contratos y pruebas. |
| ARC-008 | Pendiente | Observabilidad y métricas cognitivas | Medio | Definir coste, confianza, calidad, degradación, trazas y retención. Incluye un endpoint de salud real: los `GET /health` actuales devuelven 200 sin comprobar D1/R2 y con versión escrita a mano, por lo que F-0.1 tuvo que retirar los healthchecks automáticos de despliegue (ver runbook). |
| ARC-009 | Cerrado | Precedencia documental / Libro Maestro | Alto | COH-001 cerrado por ADR-0005: `MASTER_PLAN.md` es la referencia versionada y el original quedó archivado sin autoridad normativa. |
| ARC-010 | Cerrado | Estado del contrato cognitivo | Alto | COH-002 cerrado por ADR-0002: contrato cognitivo aceptado como arquitectura objetivo; implementación bloqueada por dependencias explícitas. |
| ARC-011 | Verificado (fases 1 y 2) | Esquema D1 definido por DDL en tiempo de ejecución | Crítico | **105 de 150 tablas existen solo porque el código las crea** y **27 tablas de producción no las declara nadie** (incluidas `empresas`, `fichajes`, `incidencias`): el esquema no es reproducible desde el repositorio. El contraste con D1 real destapó **3 bugs activos** por `ALTER` silenciados que nunca se aplicaron: `planos.circuitos_json`, `inventario_seg.ubicacion` (el fix de SEG-01 nunca funcionó) y `empresas.retencion_config` (retención RGPD inoperante). Análisis y acciones propuestas en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`. Fase 3: ADR, migrador único y retirada del DDL en runtime por verticales. |
| ARC-012 | Resuelto | Tres columnas ausentes en producción por DDL silenciado | Alto | **Arreglado el 2026-08-02.** `planos.circuitos_json`, `inventario_seg.ubicacion` (cierra SEG-01 de verdad) y `empresas.retencion_config` (restaura la retención RGPD) aplicadas por el workflow manual y verificadas contra el esquema real. Runs 30722027660, 30722072138 y 30722103191. Queda abierta la causa raíz en ARC-013. |
| ARC-013 | Corregido en código — pendiente de despliegue | `catch` vacíos ocultan fallos de DDL | Alto | Causa raíz de ARC-012. **Corregido el 2026-08-02** (`eb772ee`): se introduce `runDDL()`, que nunca lanza pero registra por `console.error` todo error que no sea el duplicado esperado. 41 llamadas en `worker.js` y 7 en `alejandra-agente/worker.js` (regla de los dos cerebros). El alcance real era mayor que el estimado aquí: los 18 contados eran solo `ALTER`, pero los `CREATE TABLE` silenciados son la misma clase de riesgo. Se añade `ddlPaso()` para `runMigrations()`, donde el defecto era peor —cada paso etiquetaba cualquier error como «ya existe», dándole al operador un visto bueno falso— y ahora distingue aplicada / ya existía / ERROR (10 pasos). **No surte efecto hasta desplegar `worker.js`**, que es decisión del Director. El registro va a `console.error`: visible en `wrangler tail` y Workers Logs, sin persistencia ni alerta — eso depende de ARC-008. |
| ARC-015 | Parcialmente corregido | El esquema que se le describe a Alejandra no coincide con el real | Alto | El bloque `SCHEMA BASE DE DATOS` del prompt de `worker.js` (75 tablas) se escribió de memoria, no leyendo los `CREATE`. Alejandra genera SQL contra columnas que no existen. **Corregidas las 8 tablas cuyo `CREATE` vive en `worker.js`** y por tanto es autoritativo: `turnos`, `historial_mantenimientos`, `checklist_plantillas`, `checklist_registros`, `fotos_obra`, `docs_notas`, `login_attempts`, `vincular_tokens`. Se documentó además que `checklist_plantillas` y `checklists_plantillas` son **tablas distintas**, no una errata, y se añadieron al prompt las dos que faltaban. **Pendiente:** las ~29 tablas restantes solo se pueden verificar consultando D1, igual que ARC-011 fase 2 — el análisis estático no basta, porque las 27 tablas huérfanas no tienen `CREATE` en ninguna parte. Requiere autorización de consulta de metadatos. |
| ARC-016 | Corregido en código — pendiente de despliegue | Chat anónimo del agente alcanzaba datos de cualquier empresa | **Crítico** | `/api/chat` y `/api/chat/stream` aceptan peticiones sin sesión por diseño, pero sin sesión el `empresa_id` salía del body **sin verificar**, así que el acotamiento por empresa lo elegía quien llamaba. 34 tools quedaban fuera de `TOOLS_REQUIEREN_SESION`, entre ellas las de datos de obra, inventario, documentos y proveedores, las `gestionar_*` que escriben, y las de GitHub que exponen código privado. Además `normalizarUsuarioId` resolvía un **nombre** a la cuenta real, de modo que un anónimo con `usuario_id:"Adrian"` obtenía su id y con él se le inyectaban al prompt sus 10 últimos mensajes privados —y podía escribir en su historial—, saltándose el control que sí tiene `/api/chat/history`. Corregido el 2026-08-02: gateo de las 34 tools, identidad anónima con prefijo `anon:` que no puede colisionar con un id real, y `empresa_id` del body ignorado sin sesión. 5 pruebas negativas nuevas (90/90). El chat anónimo sigue funcionando para consultas técnicas. **Sin efecto hasta desplegar el agente.** |
| ARC-017 | Corregido en código — pendiente de despliegue | El cron del agente ejecuta el modelo con privilegios de desarrollador | **Crítico** | **Corregido el 2026-08-02.** El flag `esDevVerificado` NO se puede bajar sin más: `puedeNotificarUsuario` depende de él y el cron sí necesita avisar a cualquier usuario. La barrera correcta es la lista de tools — lo que no se le ofrece al modelo, no lo puede invocar. Se añade `TOOLS_PROHIBIDAS_CRON` (9 tools) y `esInvocacionCron()`, que detecta al cron por identidad (`system`/`cron`), no por un flag que haya que acordarse de pasar. El cron pasa de 69 a 60 tools: pierde `ejecutar_deploy`, `rollback`, `patch_codigo`, `github_escribir`, `nexus_manage`, `test_endpoint`, `escribir_bd`, `configurar_alerta` y `tomar_decision`; conserva lectura, análisis y avisos. Sus escrituras deterministas (`tareas_alejandra`, `alejandra_ram`) van por SQL directo y no se ven afectadas. El usuario normal con sesión mantiene sus 62 tools, sin regresión. 4 pruebas negativas nuevas (94/94). Queda N0–N1 en términos de ADR-0006, que era la pregunta 3. **Sin efecto hasta desplegar el agente.** |
| ARC-014 | Pendiente | La aprobación de entorno no frena a un agente con token de administración | Medio | Detectado al aplicar ARC-012: el entorno `production` exige revisor, pero un agente que use un token con permisos de administración puede aprobar su propio despliegue vía API. La barrera protege frente a automatismos accidentales, no frente a un actor con ese token. Evaluar `prevent_self_review`, revisores distintos del solicitante o un token de menor privilegio para agentes. |
| ARC-018 | Detectado — pendiente de decisión | Worker y bucket R2 huérfanos, sin documentar, con seguridad desactualizada | **Alto** | Auditoría remota de Cloudflare (F-0.2, 2026-08-02): la cuenta tiene un **tercer Worker**, `alejandra-worker`, y un **segundo bucket R2**, `alejandra-files` (el documentado es `alejandra-app-files`), ninguno mencionado en `CLAUDE.md`. Analizado el código de `alejandra-worker` (6911 líneas): es un **fork abandonado de `worker.js`**, snapshot entre el 05/05 y el 06/05/2026, justo antes de que se integrara la IA — confirmado por ausencia de `ANTHROPIC_API_KEY`/tools y presencia de 3 restos de `env.R2` que un commit posterior limpió. Sin tocar desde el 05/05 (casi 3 meses). **Tiene rutas de escritura completas y alcanzables** (login, INSERT/UPDATE/DELETE sobre las tablas de negocio, subida/borrado en R2) con una postura de seguridad estrictamente más débil que la actual: CORS abierto a cualquier origen, sin cabeceras de seguridad, sin ninguna de las mejoras SEC-01 a SEC-15. **No confirmado, y es la pregunta crítica:** si su binding `DB` apunta a la misma `alejandra-db` de producción — eso lo convertiría en un segundo punto de escritura sin parchear sobre datos reales. No verificable con las herramientas de solo lectura disponibles; hace falta el dashboard de Cloudflare. Prueba de vida: `alejandra-worker.alejandra-app.workers.dev` devuelve 404, igual que cabría esperar de `preview_urls: false` — no concluyente sobre si sigue accesible por otra ruta. **No se ha tocado**: la autorización del Director cubría lectura de metadatos, no borrar ni desactivar recursos. |

## Criterio de priorización

Primero se resuelven bloqueos de coherencia, riesgos críticos de seguridad/producción y límites de permisos/datos; después modularidad/optimización. Ninguna prioridad sustituye aprobación explícita.

## Revisión de Fase 2

No se ha añadido alcance funcional fuera del Motor de Decisión. Las dependencias detectadas durante el diseño ya estaban registradas en ARC-001, ARC-003, ARC-004 y ARC-006; no se crean decisiones nuevas hasta la revisión de ADR-0004.

## Referencia de planificación

`MASTER_ROADMAP.md` organiza el orden y las dependencias globales. Este backlog conserva riesgos, deuda y decisiones pendientes; no duplica fases ni tareas inmediatas.

## Actualización de F-0.1

ARC-005 queda mitigado en los workflows versionados: CI, despliegue, D1 y secretos están separados. Permanece pendiente la validación remota y la configuración manual de los entornos `production` y `github-pages`, protección de `main` y mínimo privilegio de secretos/tokens.

### Alcance real de F-0.1 respecto al esquema (ARC-011)

Debe quedar registrado sin ambigüedad qué resuelve y qué no resuelve esta fase:

| F-0.1 | Alcance |
|---|---|
| ✅ Controla | Las migraciones ejecutadas por GitHub Actions: manuales, una a una, con confirmación, entorno protegido y sin `\|\| echo` que oculte fallos. |
| ❌ No elimina | Los cambios de esquema que `worker.js` ejecuta por su cuenta en producción, fuera de todo workflow y de toda aprobación. |
| ❌ No resuelve | La divergencia entre el esquema versionado (`schema_completo.sql` + 24 `migrate_*.sql`) y el esquema creado dinámicamente desde código. |

Consecuencia: la promoción deliberada a producción está mitigada **para el código**, no para el
esquema. Un despliegue aprobado puede seguir alterando la estructura de D1 sin que nadie lo
apruebe, porque el DDL viaja dentro del propio Worker.

### Trabajo futuro obligatorio (no pertenece a F-0.1)

1. **Inventariar** todos los `CREATE TABLE`, `ALTER TABLE` y demás cambios de esquema ejecutados
   desde código, en ambos Workers, con ubicación, tabla afectada y si están silenciados.
2. **Contrastar** ese inventario con el esquema real de D1 mediante consulta autorizada de solo
   lectura, y con las migraciones versionadas, para obtener la divergencia efectiva.
3. **Convertirlos progresivamente** en migraciones versionadas, idempotentes y verificables, con
   un migrador único, orden explícito y registro de aplicación.
4. **Retirar el DDL en runtime** solo después de que su equivalente versionado esté aplicado y
   verificado, vertical por vertical, nunca en bloque.
5. Requiere ADR propio antes de tocar código.

Este refactor **no se ejecuta dentro de F-0.1**. F-0.1 se limita a dejar el riesgo registrado,
acotado y con la migración 008 bloqueada para que no se dispare por accidente.
