# Master Roadmap — Alejandra 2.0

- Versión: 0.1 (borrador para revisión humana y arquitectónica)
- Fecha: 2026-08-01 — **sincronizado 2026-08-07** (ver nota abajo)
- Estado: activo; no autoriza implementación por sí mismo
- Propietario: Director del Proyecto
- Custodia técnica: Arquitecto del Proyecto y Arquitecto Técnico

## Sincronización 2026-08-07

Este documento no se había actualizado desde el 2026-08-04. Deltas frente al estado real (`PROJECT_STATE.md`/`TASKS.md`, fuente viva):

- **F-2.2 — Nexo v1: completa** (2026-08-07, ADR-0021), no "Investigación" como decía la ficha original. Ver detalle en su sección abajo.
- **F-4.1 — Observabilidad: parcialmente adelantada** fuera de esta fase formal, sin ADR propio de F-4.1: `registrarTraza()`/`GET /admin/trazas` (ADR-0014, 2026-08-02), dashboard de trazas en `admin.html` y telemetría de uso de tools (`F-4.4`, 2026-08-07). Sigue "Pendiente" en el sentido estricto del roadmap (sin `trace_id`/spans/evaluaciones/reproducciones), pero la base de observabilidad ya no es cero.
- **ADR-0020 — Integración gradual del Motor de Decisión (2026-08-06/07):** iniciativa fuera de la lista de fases de este roadmap, activa sobre la Época 1 ya cerrada (F-1.1/F-1.2/F-1.3). Tres rebanadas completadas: piloto N0 (rebanada 1, ampliado a las 36 tools en rebanada 2), piloto N1 de lectura con `verificar_deploy` (rebanada 3, enmienda 2). Ver `ARCHITECT_BACKLOG.md` (ARC-020) y `docs/decisions/ADR-0020-INTEGRACION-GRADUAL-MOTOR-DECISION.md`.
- **ARC-021 (2026-08-07):** riesgo de proceso (bypass del workflow de despliegue vía `wrangler deploy` directo) aceptado como práctica habitual por el Director. No afecta a ninguna fase de este roadmap.
- La cadena de dependencias (`F-2.1 → F-3.1 → F-3.2 → F-4.1 → ...`) sigue siendo la que ordena qué fase formal abrir después. **F-3.1 (Herramientas semánticas) es la siguiente fase sin abrir**, con dependencias (F-1.3, F-2.1, ARC-006) cerradas — pendiente de elegir vertical piloto antes de empezar.

## Propósito, alcance y uso

Este es el mapa global de construcción: qué se construirá, en qué orden, con qué dependencias y qué evidencia cierra cada fase. No sustituye `PROJECT_STATE.md` (estado presente), `TASKS.md` (cola inmediata), `ARCHITECT_BACKLOG.md` (riesgos/deuda/propuestas) ni los ADR (decisiones oficiales).

Alcance: arquitectura, diseño, implementación, pruebas, despliegue y validación de Alejandra 2.0. No asigna fechas cerradas: los tamaños son aproximaciones relativas (`XS`–`XL`). Un elemento `PENDIENTE` no es una decisión aprobada.

## Referencias obligatorias y actualización

Antes de trabajar: `START_HERE.md`, `PROJECT_STATE.md`, `HANDOFF.md`, `AGENTS.md`, `ARCHITECT_RULES.md`, `ARCHITECT_BACKLOG.md`, ADRs, documentación 00–09, arquitectura, ideas y runbooks.

Tras aprobar/cerrar una fase, actualizar este documento, `PROJECT_STATE.md`, `ARCHITECT_BACKLOG.md`, `CHANGELOG.md`, `HANDOFF.md`, ADRs aplicables y `docs/DOCUMENTATION-REGISTER.md`. Solo Director/Arquitecto del Proyecto aprueban fases; cualquier miembro puede proponer cambios mediante ADR/idea. Una conversación no modifica este roadmap: requiere cambio versionado y aprobación documentada.

## Principios técnicos incorporados del plan histórico

El plan histórico queda preservado en `docs/archive/PLAN-EVOLUCION-ALEJANDRA-COMPLETO.md`. Su contenido único se incorpora como restricciones de ejecución: preservar capacidades multidisciplinares; usar evidencia recuperable, reglas y cálculos deterministas sin reducir el sistema a RAG; tratar web/OCR/documentos como contenido no confiable; mantener aislamiento por empresa/obra; separar memoria de conocimiento; sustituir SQL libre de forma gradual por tools semánticas; usar planos con modelo estructurado y revisión; y construir observabilidad con trazas, auditoría, costes y reproducciones seguras. Estas restricciones se concretan en F-1 a F-4 y no son implementación aprobada.

## Estado real al crear el roadmap

| Elemento | Estado verificable |
|---|---|
| Fase 0 — auditoría | Completada documentalmente. |
| Fase 0.5 — continuidad | Completada documentalmente. |
| Foundation v0.1 | Aprobada. COH-001 cerrado por ADR-0005 y COH-002 por ADR-0002; sin bloqueos de coherencia abiertos. |
| Fase 1 — contrato cognitivo | Documentada; ADR-0002 **aceptado** como arquitectura objetivo. ARC-001/003/004/002/008 cerrados el 2026-08-02 (ADR-0006/0008/0009/0010/0013/0014); ADR-0004 también aceptado, cierra F-1.1. |
| Fase 2 — motor/modos | Documentada; ADR-0004 **aceptado** (2026-08-02), cierra F-1.1. |
| Núcleo Cognitivo | F-1.2 completada y verificada (2026-08-02); F-1.3 (Tool Registry/Verifier) abierta, esqueleto en curso. No integrado en producción. |
| Entrega segura | **F-0.1 integrada y activa en remoto** (PR #9, 2026-08-02): workflows antiguos retirados, `main` protegida, entorno `production` con revisor requerido. El P0 está neutralizado. Queda mover los secretos a nivel de entorno (`F-0.2-CFG`). |
| Esquema D1 | **ARC-011 fases 1 y 2 verificadas** (PR #10): 105 de 150 tablas existen solo porque el código las crea y 27 tablas reales no las declara nadie; el esquema **no es reproducible desde el repositorio**. ARC-012 resuelto (PR #11): las 3 columnas que faltaban se aplicaron y verificaron. ARC-013 corregido en código (`eb772ee`), pendiente de despliegue. Fase 3 pendiente, exige ADR propio. |
| Auditoría remota GitHub | Realizada 2026-08-02 en solo lectura. Sus cinco hallazgos quedaron corregidos al activar F-0.1, salvo los secretos, que siguen a nivel de repositorio. |
| Auditoría remota Cloudflare | **Realizada el 2026-08-02**, solo lectura autorizada por el Director. Workers, D1, R2, KV y secretos (solo nombres) inventariados. Esquema de Alejandra verificado contra D1 real: 57/60 correcto (ARC-015 cerrado). Ningún secreto ni binding sin declarar. Hallazgo: Worker y bucket R2 huérfanos sin documentar (ARC-018), pendiente de decisión — no tocados. Cierra la última tarea pendiente de F-0.2. |
| ADR de Época 1 (ARC-001/002/003/004/006/008/011-fase3) | **Los ocho aceptados el 2026-08-02**: ADR-0006 (matriz de riesgo N0–N3, `run_migration` capacidad administrativa), ADR-0008 (Nexo = interpretación A, capa de integración), ADR-0009 (QA en tres niveles), ADR-0010 (catálogo de tools con metadato de acceso), ADR-0011 (migrador por vertical, aceptado como estrategia — implementación al ritmo del roadmap), ADR-0004 (Motor de Decisión, cierra F-1.1), ADR-0013 (gobierno de memoria, con modificaciones) y ADR-0014 (observabilidad y trazas, con modificaciones, implementado y desplegado). Ningún ADR de Época 1 queda `Propuesto`. |

## Épocas y fases

### Época 0 — Fundación y entrega segura

**F-0.1 — Separación de CI, despliegue y migraciones**

- Estado/prioridad/tamaño: **Integrada y activa en remoto (PR #9, 2026-08-02)** / Crítica / M.
- Objetivo y valor: separar integración de producción para evitar despliegues y migraciones accidentales.
- Alcance/fuera: workflows, entornos, runbooks y validaciones; no cambia funcionalidades ni infraestructura de negocio.
- Dependencias/bloqueantes/paralelo: ADR-0001 (aceptado) y acceso administrativo a GitHub; puede ir en paralelo con F-0.2, no con despliegues no aprobados.
- Referencias/ADR/módulos: auditoría, plan de PRs, ADR-0001, `docs/runbooks/CI-CD-Y-MIGRACIONES.md`; GitHub Actions/Workers/D1.
- Áreas/migraciones: `.github/workflows`, runbooks; sin migración funcional prevista. `migrate_008` se desbloqueó y se aplicó el 2026-08-02: el bloqueo partía de leer código sin contrastar con el esquema real, y la migración era el arreglo (ver ARC-012).
- Riesgos/compliance/pruebas: interrupción de entrega; mínimo privilegio y aprobación; CI, promoción manual y rollback documentado. Los healthchecks automáticos de Workers se retiraron por diseño: `GET /health` no distingue desplegado de operativo (ver ARC-008); Pages sí conserva verificación de versión servida.
- Aceptación/recuperación/entregables: `main` no despliega por sí solo; promoción identificable y migración explícita; rollback a artefacto sano; workflow y runbook aprobados.
- Estado de aceptación: **cumplido en repositorio y en remoto**. Validado además en la práctica: las tres migraciones de ARC-012 fueron el primer uso real del circuito y quedaron en `waiting` hasta aprobación del entorno. Salvedad registrada en ARC-014: la aprobación puede concederla la misma credencial que lanzó el workflow. Healthcheck automático post-despliegue reincorporado (PR #36, 2026-08-02).
- Resultado/siguiente: Entrega segura v0.2; habilita F-0.2 y cualquier cambio funcional.

**F-0.2 — Inventario remoto, calidad y contratos base**

- Estado/prioridad/tamaño: **Completada (2026-08-02)** / Alta / L.
- Objetivo y valor: conocer recursos reales y establecer pruebas/contratos para evolucionar sin regresiones.
- Alcance/fuera: auditoría de solo lectura, inventario de bindings/secretos/migraciones, CI de calidad y catálogo de rutas; no cambia datos/producción.
- Dependencias/bloqueantes/paralelo: F-0.1 para evitar despliegue; acceso remoto autorizado; paralelo limitado con diseño UX.
- Referencias/ADR/módulos: auditoría, PR-02 a PR-04, ARC-006; Workers, D1/R2, frontends.
- Áreas/migraciones: scripts, tests, docs; migraciones solo se inventarían si evidencia exige corrección aprobada.
- Riesgos/compliance/pruebas: exposición de metadatos; secretos minimizados; pruebas de contrato y negativas de autorización.
- Aceptación/recuperación/entregables: inventario verificable y CI sin CD; revertir scripts/documentación; habilita implementaciones seguras.
- Estado de aceptación: **cumplido**. Catálogo de 544 rutas con autorización (0 sin proteger tras corregir `PUT /sesion/departamento`), inventario de bindings/secretos limpio, cuatro validaciones en CI (encoding, versiones, autorización de rutas, secretos declarados), y auditoría remota de Cloudflare en solo lectura (Workers/D1/R2/KV/secretos) con un hallazgo nuevo registrado (ARC-018, pendiente de decisión del Director, no bloquea el cierre de la fase).

### Época 1 — Núcleo Cognitivo

**F-1.1 — Aprobar contrato cognitivo y Motor de Decisión**

- Estado/prioridad/tamaño: **Completada (2026-08-02)** / Crítica / S.
- Objetivo y valor: resolver ADR-0002/0004 y sus preguntas antes de código.
- Alcance/fuera: decisiones de diseño, riesgo, modos y límites; no implementación.
- Dependencias/bloqueantes/paralelo: ~~ARC-001, ARC-003, ARC-004, ARC-006~~ **cerrados el 2026-08-02** por ADR-0006/0008/0009/0010, todos aceptados. ~~ADR-0004~~ **aceptado el 2026-08-02** como arquitectura objetivo. Puede ir en paralelo con F-0.1 documental.
- Estado de aceptación: **cumplido**. ADR-0002 y ADR-0004 aceptados; abre F-1.2.
- Referencias/ADR/módulos: ADN, Arquitectura Cognitiva, Motor de Decisión; ADR-0002/0003/0004.
- Áreas/migraciones: docs/decisions y backlog; ninguna migración.
- Riesgos/compliance/pruebas: autonomía ambigua; revisión arquitectónica de coherencia; evidencia de aprobación ADR.
- Aceptación/recuperación/entregables: ADRs resueltos y bloqueos convertidos en fases; reversión documental mediante ADR sustituto; habilita F-1.2.

**F-1.2 — Estado Cognitivo, Planner, Context Engine y Policy Engine**

- Estado/prioridad/tamaño: **Completada y verificada (2026-08-02)** / Crítica / XL.
- Objetivo y valor: implementar las bases que deciden con contexto y permisos verificables.
- Alcance/fuera: contratos, extracción incremental, pruebas y trazas mínimas; no memoria compartida, Nexo ni agentes.
- Dependencias/bloqueantes/paralelo: F-0.1, F-0.2, F-1.1 — **las tres completadas**; paralelo parcial con UX transversal (independiente de P-1, ver Época transversal).
- Referencias/ADR/módulos: Arquitectura Cognitiva, Motor, ADR-0002/0003/0004; Worker IA y contratos compartidos.
- Áreas/migraciones: `nucleo-cognitivo/` (paquete nuevo, aislado, no integrado en `worker.js` ni `alejandra-agente/worker.js`); `PENDIENTE` migraciones solo tras modelo de estado aprobado.
- Riesgos/compliance/pruebas: bypass de tenant/política; unitarias, integración y negativas de permiso; rollback por ruta/feature flag. **ARC-002 (ADR-0013) y ARC-008 (ADR-0014) aceptados con modificaciones el 2026-08-02**: el esqueleto puede ampliarse con las interfaces de `memory.js` y el helper `registrarTraza()`, pero la persistencia real exige además la migración D1 correspondiente (autorizada solo en desarrollo/pruebas para ARC-008; ARC-002 sigue el migrador de ADR-0011) y no se activa en producción por esta tarea.
- Aceptación/recuperación/entregables: una ruta piloto decide sin alterar permisos y conserva compatibilidad; diseño de rollback y pruebas publicadas; habilita F-1.3.
- Estado de aceptación: **cumplido y verificado (2026-08-02)**: `nucleo-cognitivo/` con Estado Cognitivo (efímero, sin persistencia), Policy Engine (clasificación de riesgo N0–N3 de ADR-0006, sin acceso a sesión real), Context Engine, Planner y Motor de Decisión (interfaces con forma de datos, sin implementación — pendientes de dependencias reales), `memory.js` (ADR-0013) y contrato `registrarTraza()` (ADR-0014). Memory, Nexo, Capability/Tool Registry, Verifier y QA quedaron **fuera** de este entregable: pertenecen a F-1.3/F-2.1/F-2.2. Los 6 criterios de aceptación se verificaron contra el código: `node --check` y `node --test nucleo-cognitivo/test/*.js` (20/20 en verde). Habilita F-1.3.

**F-1.3 — Capability/Tool Registry, Verifier y QA**

- Estado/prioridad/tamaño: **Completada (2026-08-02)** — esqueleto del Tool Registry/Verifier, piloto de migración (`consultar_personal`) y migración incremental del resto del catálogo (96/103 tools, 7 excluidas a propósito por ser dominio ADR-0013) completados. Cierra F-1.3 y, con ella, la Época 1 (F-1.1/F-1.2/F-1.3 completas). / Alta / L.
- Objetivo y valor: declarar capacidades y verificar resultados antes de responder/ejecutar.
- Alcance/fuera: registro, contrato de tools, verificación/QA inicial; no marketplace ni plugins.
- Dependencias/bloqueantes/paralelo: F-1.2, ARC-004, ARC-006; paralelo con F-2.1 solo documental.
- Referencias/ADR/módulos: ADR-0003/0004; tools IA y políticas.
- Áreas/migraciones: registry, tests, observabilidad; `PENDIENTE` persistencia.
- Riesgos/compliance/pruebas: falsa validación/acciones sensibles; controles deterministas, pruebas negativas y revisión humana.
- Aceptación/recuperación/entregables: tool piloto declarada, autorizada y verificada (hecho); retirada de los `Set`/gates existentes por feature flag **pendiente** — ADR-0010 exige convivencia del metadato nuevo con los gates actuales hasta que se decida retirarlos, no forma parte de "migrar el catálogo". Habilita Núcleo Cognitivo v1.

### Época 2 — Conocimiento y Memoria

**F-2.1 — Gobierno de memoria y conocimiento**

- Estado/prioridad/tamaño: **Lectura y escritura completas y desplegadas (2026-08-04, ADR-0007 enmienda 1)** — dependencias (F-1.1, ARC-002) cerradas vía ADR-0004/ADR-0013; modelo y contrato de gobierno aceptados por el Director (ADR-0013, con modificaciones). Esquema `migrate_memoria_gobernada.sql` declarado **y aplicado contra D1** (run `30758423450`, 2026-08-02); tabla `memoria_gobernada` en producción. **Lectura:** `consultarMemoria()` en los dos Workers + `memoria_consultar` (solo lectura, `nivel_riesgo:'N0'`, en `alejandra-agente/worker.js`), con traza `memoria_consulta` por cada consulta (ARC-008 §8). **Escritura, decisión del Director (2026-08-04, "Exponer como tools nuevas"):** `memoria_listar_pendientes` (N0, disponible al cron), `memoria_confirmar_candidata`/`memoria_rechazar_candidata` (N1, excluidas del cron a propósito), gate de rol `encargado`+ (`esEncargadoOSuperior()`), `empresa_id` siempre de sesión. Hallazgo real corregido antes de exponer: `confirmarCandidata()`/`rechazarCandidata()` filtraban solo por `id`/`estado`, sin `empresa_id` (mismo patrón de fuga que ARC-016). Desplegado y verificado en producción (PR #81, run 30937911736). / Crítica / XL.
- Objetivo y valor: separar memoria, conocimiento, estado temporal y fuentes para evitar fugas/degradación.
- Alcance/fuera: modelo de autoridad, vigencia, procedencia, relaciones, backlinks, contradicciones e ingesta segura; no aprendizaje autónomo amplio.
- Dependencias/bloqueantes/paralelo: F-1.1 y ARC-002; paralelo documental con F-1.3.
- Referencias/ADR/módulos: ADN, Arquitectura Cognitiva, compliance; Memory/Context Engine/D1/R2; ADR-0013.
- Áreas/migraciones: esquema declarado y aplicado (`migrate_memoria_gobernada.sql`); registrado en `migrate_manifiesto.json` como `aplicada: true`.
- Riesgos/compliance/pruebas: RGPD, multiempresa, contenido inyectado; aislamiento, retención, borrado y pruebas IDOR — cubiertas por las 15 pruebas de `construirConsultaMemoriaGobernada()` (lectura) más 2 nuevas de sesión obligatoria/exclusión de cron (escritura), 138/138 en verde.
- Aceptación/recuperación/entregables: política y modelo aprobados (hecho, ADR-0013); recuperación híbrida limitada y auditada (hecho, lectura y escritura, ambas con traza); rollback/retención documentados (caducidad 6/12 meses de ADR-0013, sin borrado real todavía documentado como rollback); habilita F-2.2. **Declarada completa** — lectura y escritura desplegadas, sin decisión pendiente del Director sobre este entregable.

**F-2.2 — Nexo v1**

- Estado/prioridad/tamaño: **Completa (2026-08-07, ADR-0021)** / Alta / XL.
- Objetivo y valor: definir e implementar coordinación entre fuentes/módulos solo tras aclarar su propósito.
- Alcance/fuera: definición, ADR y vertical piloto; no multiagente general.
- Dependencias/bloqueantes/paralelo: F-2.1, ARC-003 — ambas cerradas.
- Referencias/ADR/módulos: Arquitectura Cognitiva, ARC-003; `ADR-0021` (Nexo = capa de integración con fuentes externas, interpretación A de ADR-0008).
- Áreas/migraciones: `nexo-fuentes.js` (registro de 3 fuentes piloto), metadata `nexo` en `buscar_normativa`/`buscar_precios`, `nucleo-cognitivo/packages/cognitive-core/src/nexo.js`; `migrate_013_nexo_fuentes_telemetria.sql` aplicada y verificada en D1 de producción.
- Riesgos/compliance/pruebas: acoplamiento y autoridad difusa; 7 tests de contrato en `lib.test.js` (168/168 en verde en el momento del cierre).
- Aceptación/recuperación/entregables: **cumplido.** Extensivo, no reemplazante: cableado sobre tools existentes (`buscar_normativa`/`buscar_precios`), con fallback coordinado (`sugerencia:'buscar_web'`) y traza+telemetría por consulta (`registrarNexoConsulta()`). Habilita conocimiento operacional.

### Época 3 — Herramientas y trabajo operativo

**F-3.1 — Herramientas semánticas y reglas deterministas**

- Estado/prioridad/tamaño: Pendiente / Alta / XL.
- Objetivo y valor: sustituir progresivamente SQL libre por operaciones con intención, permisos y validación.
- Alcance/fuera: tools semánticas, cálculos deterministas, motor de reglas y estado de obra consolidado; no reemplazo masivo.
- Dependencias/bloqueantes/paralelo: F-1.3, F-2.1, ARC-006; paralelo con F-4.1.
- Referencias/ADR/módulos: Tool Registry, ADR-0003; Workers/D1.
- Áreas/migraciones: endpoints/services/migraciones por vertical `PENDIENTE`.
- Riesgos/compliance/pruebas: regresión de negocio; contratos, autorización, migración y rollback por vertical.
- Aceptación/recuperación/entregables: una familia de tools sustituida sin pérdida de contrato; habilita F-3.2.

**F-3.2 — Ingeniería técnica y planos estructurados v1**

- Estado/prioridad/tamaño: Pendiente / Media / XL.
- Objetivo y valor: herramientas multidisciplinares y revisiones de planos estructurados.
- Alcance/fuera: cálculo verificable, modelo de plano y revisión; no CAD/BIM completo.
- Dependencias/bloqueantes/paralelo: F-3.1, QA y conocimiento técnico; paralelo limitado con UX.
- Referencias/ADR/módulos: Arquitectura Cognitiva; R2/planos/tools.
- Áreas/migraciones: `PENDIENTE` contrato de plano y metadatos.
- Riesgos/compliance/pruebas: seguridad técnica/resultados erróneos; verificadores, datos de ejemplo, revisión humana.
- Aceptación/recuperación/entregables: Planos v1 verificables y reversibles; habilita hito Planos v1.

### Época 4 — Observabilidad y control

**F-4.1 — Observabilidad, evaluación y DevTools seguros**

- Estado/prioridad/tamaño: **Parcialmente adelantada, fase formal sin abrir con ADR propio** / Alta / L.
- Objetivo y valor: trazabilidad reproducible de decisiones, costes, salud y calidad.
- Alcance/fuera: `trace_id`, spans, logs estructurados, auditoría, métricas, evaluaciones, reproducciones seguras y DevTools; no exponer secretos/datos.
- Dependencias/bloqueantes/paralelo: F-0.1, F-0.2 — cerradas.
- Referencias/ADR/módulos: ARC-004/008, ADR-0014; Workers, IA, CI.
- Áreas/migraciones: tabla `alejandra_trazas` (ADR-0014) aplicada; `trace_id` presente en `registrarTraza()`.
- Riesgos/compliance/pruebas: retención/PII/coste; redacción y minimización ya implementadas en `registrarTraza()`.
- Aceptación/recuperación/entregables: **adelantado sin declarar la fase formal cerrada.** Ya cumplido: `registrarTraza()`/`GET /admin/trazas` (ADR-0014, 2026-08-02), dashboard de trazas en `admin.html` (F-4.1 parcial, 2026-08-06), telemetría de uso de tools por empresa/tool (`F-4.4`, 2026-08-07, `/api/admin/metrics/tools`). Pendiente para cerrar F-4.1 de verdad: costes, evaluaciones automáticas y reproducciones seguras — no hay ADR ni criterio de aceptación formal todavía, decisión aparte.

### Época 5 — Capacidades instalables

**F-5.1 — Skills, plugins, adaptadores y MCP gobernados**

- Estado/prioridad/tamaño: Pendiente / Media / XL.
- Objetivo y valor: instalar capacidades compatibles, versionadas y con permisos explícitos.
- Alcance/fuera: manifiesto, ciclo instalar/desinstalar, compatibilidad, permisos y versiones; no tienda pública hasta validación.
- Dependencias/bloqueantes/paralelo: F-1.3, F-4.1, ARC-006; paralelo con investigación de integraciones.
- Referencias/ADR/módulos: Capability Registry; `PENDIENTE` ADR de extensibilidad.
- Áreas/migraciones: paquetes/registry `PENDIENTE`.
- Riesgos/compliance/pruebas: supply chain/plugin inseguro; firma, sandbox, compatibilidad y rollback.
- Aceptación/recuperación/entregables: capacidad piloto instalable/desinstalable y auditada; habilita Capacidades Instalables v1.

### Época 6 — Agentes e integraciones

**F-6.1 — Delegación y agentes especializados**

- Estado/prioridad/tamaño: Pendiente / Media / XL.
- Objetivo y valor: delegar trabajo con bandeja, límites y supervisión.
- Alcance/fuera: arquitectura multiagente, delegación y cola; no autonomía abierta.
- Dependencias/bloqueantes/paralelo: F-1.3, F-2.2, F-4.1, F-5.1; ARC-003/004 resueltos.
- Referencias/ADR/módulos: Motor de Decisión, Nexo; `PENDIENTE` ADR.
- Áreas/migraciones: `PENDIENTE`.
- Riesgos/compliance/pruebas: bucles, costes y permisos; límites, simulación, trazas y kill switch.
- Aceptación/recuperación/entregables: un agente delegado en tarea acotada y cancelable; habilita Agentes v1.

**F-6.2 — Integraciones empresariales**

- Estado/prioridad/tamaño: Pendiente / Media / XL.
- Objetivo y valor: correo, documentos, Microsoft 365, GitHub, ERP, CAD/BIM, IoT y otros adaptadores conforme a valor probado.
- Alcance/fuera: un adaptador por vez; no integración masiva ni control de ordenador por defecto.
- Dependencias/bloqueantes/paralelo: F-5.1, F-6.1 si delegada; proveedores y contratos externos.
- Riesgos/compliance/pruebas: credenciales, GDPR, disponibilidad; sandbox, mínimos permisos, mocks y rollback.
- Aceptación/recuperación/entregables: adaptador aprobado, auditable, revocable; habilita Plataforma Empresarial v1 progresiva.

### Época 7 — Inteligencia empresarial proactiva

**F-7.1 — Eventos, recomendaciones y aprendizaje supervisado**

- Estado/prioridad/tamaño: Pendiente / Media / XL.
- Objetivo y valor: detectar tendencias/carencias y proponer mejoras operativas explicables.
- Alcance/fuera: eventos, objetivos, recomendaciones, reflexión con revisión; no autoaprendizaje de políticas ni acciones no solicitadas.
- Dependencias/bloqueantes/paralelo: F-2.1, F-4.1, F-6.1; compliance y métricas aprobadas.
- Riesgos/compliance/pruebas: automatización insegura/sesgo/coste; simulación, aprobación, métricas y kill switch.
- Aceptación/recuperación/entregables: recomendación trazable y supervisada; habilita Inteligencia Proactiva v1.

### Época transversal — Producto, UX, seguridad y compliance

**P-1 — Arquitectura de la capa de presentación**

- Estado/prioridad/tamaño: **P-ARCH-001 y P-ARCH-002 aprobados; P-ARCH-003 en revisión** / Alta / M.
- Objetivo/alcance: separar de forma gradual la presentación de la lógica de negocio mediante aplicaciones de campo, oficina, administración y conversación, features aisladas, sistema de diseño y clientes de API; no implementa aún el refactor.
- Dependencias/bloqueantes/paralelo: `ADR-0012` aceptado y P-ARCH-001/P-ARCH-002 aprobados. La ampliación queda bloqueada hasta revisar P-ARCH-003; es independiente de `ADR-0004` y puede continuar en paralelo con Workers, motor de decisión y núcleo cognitivo sin cambiar sus contratos unilateralmente.
- Pruebas/aceptación: piloto de un vertical, compatibilidad funcional, revisión de accesibilidad/responsive y rollback por PR. Referencias: `docs/architecture/FRONTEND_ARCHITECTURE.md`, `docs/architecture/FRONTEND_PILOT_SYSTEM_HEALTH.md`, `docs/architecture/FRONTEND_SLICE_TOAST.md` y `docs/architecture/FRONTEND_SLICE_VERSION_CHECK.md`.

**T-1 — Calidad transversal**

- Estado/prioridad/tamaño: Continua / Crítica / continua.
- Objetivo/alcance: UX/UI, móvil, accesibilidad, RGPD, AI Act, privacidad, multiempresa, mínimo privilegio, rendimiento, costes y mantenibilidad en cada fase.
- Dependencias/paralelo: aplica a todas; no es una fase que habilite bypasses.
- Pruebas/aceptación: requisitos no funcionales, amenazas, accesibilidad y rendimiento definidos por cada ficha; ninguna fase cierra sin evidencia proporcional.

## Dependencias, paralelismo y camino crítico

```text
F-0.1 Entrega segura → F-0.2 Calidad/contratos → F-1.1 Decisiones aprobadas
→ F-1.2 Estado/Planner/Context/Policy → F-1.3 Registries/Verifier/QA
→ F-2.1 Memoria/conocimiento → F-3.1 Tools semánticas → F-3.2 Planos
→ F-4.1 Observabilidad → F-5.1 Capacidades → F-6.1 Agentes → F-7.1 Proactividad
```

| Puede ir en paralelo | Condición de seguridad |
|---|---|
| F-0.1 y diseño F-1.1 | Ninguno despliega ni cambia contratos. |
| F-0.2 y T-1 | Áreas separadas; inventario remoto solo lectura. |
| F-1.3 y diseño F-2.1 | Sin suponer persistencia/permiso futuro. |
| F-3.1 y F-4.1 | Contrato común de trazas acordado antes de integrar. |
| F-5.1 e investigación F-6.2 | Sin acceso a proveedores/productivo. |
| P-1 y backend/núcleo cognitivo | Solo consume contratos publicados; no cambia Workers, dominio ni autorización. |

Bloqueantes arquitectónicos: ADR-0001, ADR-0002, ADR-0004, ADR-0006, ADR-0008, ADR-0009, ADR-0010, ADR-0011 (como estrategia), ADR-0013 y ADR-0014 (con modificaciones) aceptados. ARC-001, 002, 003, 004, 006 y 008 cerrados el 2026-08-02; ningún ADR de Época 1 queda propuesto. ARC-005 está mitigado localmente y requiere validación remota; ARC-009 y ARC-010 están cerrados. Bloqueantes de seguridad: controles remotos de despliegue, permisos de tokens, aislamiento D1/R2 y retención. Dependencias externas: acceso GitHub/Cloudflare solo lectura, proveedores IA, cumplimiento/asesoría, contratos de integraciones y presupuesto de observabilidad.

## Estrategia de ramas y relevo

- Una tarea principal por rama; prefijos: `docs/`, `chore/`, `feat/`, `fix/`, con formato `tipo/area-descripcion`.
- El responsable, rama, alcance y siguiente paso viven en `TASKS.md` y `HANDOFF.md`; no duplicar tareas activas.
- Una rama no mezcla cambios funcionales, migraciones y refactors no relacionados. Un PR se crea al tener criterios, pruebas, rollback y documentación preparados.
- Relevo: actualizar TASKS/HANDOFF, dejar estado reproducible, pruebas y bloqueos; el siguiente agente revisa fuentes obligatorias antes de editar.
- Conflictos: detener cambios solapados, comparar intención/ADR, conservar la decisión aprobada y escalar conflicto arquitectónico al Director/Arquitecto.
- Integración: CI aprobada, revisión, riesgos/rollback explícitos, ADR/documentación actualizados y sin despliegue implícito.

## Contrato de TASKS.md

`TASKS.md` será la cola inmediata, no el roadmap. No contiene tareas ficticias. Cada entrada usa: `ID`, `Título`, `Fase`, `Estado`, `Prioridad`, `Rama`, `Responsable actual`, `Objetivo`, `Criterios de aceptación`, `Dependencias`, `Bloqueos`, `Archivos principales`, `Pruebas`, `Última actualización`, `Siguiente acción exacta`. Estados: pendiente, lista, en curso, bloqueada, en revisión, aprobada, completada, cancelada.

## Registro inicial de riesgos globales

| Riesgo | Prob. | Impacto | Mitigación | Fase/responsable |
|---|---:|---:|---|---|
| Alcance excesivo/fases gigantes | Alta | Alto | Fichas acotadas, ADR y PR pequeño | Todas / Arquitecto Técnico |
| Prompts monolíticos y acoplamiento IA | Alta | Alto | Contratos, módulos, evaluaciones | F-1 / Arquitecto |
| Proveedor IA/costes/contexto excesivo | Media | Alto | Abstracción, presupuesto, trazas | F-1, F-4 / Director |
| Pruebas insuficientes/deuda monolítica | Alta | Alto | F-0.2, contratos y regresión | F-0 / Arquitecto Técnico |
| Fuga multiempresa o datos personales | Media | Crítico | Policy, mínimo privilegio, IDOR, RGPD | Todas / Seguridad |
| Automatización o aprendizaje inseguro | Media | Crítico | ADR-0003, aprobación, supervisión | F-1, F-7 / Arquitecto |
| Plugins/agentes incompatibles | Media | Alto | Registry, sandbox, compatibilidad | F-5, F-6 / Arquitecto |
| Despliegue/migración accidental sin rollback | Alta | Crítico | ADR-0001, promoción deliberada | F-0.1 / Director |
| Documentación desactualizada/conflicto agentes | Media | Alto | Reglas, roadmap, handoff, PR | Todas / Equipo |
| RGPD/AI Act incumplido | Media | Crítico | Privacy by design, asesoría/evidencia | T-1 / Compliance |

## Hitos verificables

| Hito | Criterio |
|---|---|
| Foundation v0.1 | Documentación fundacional y ADR-0003 aprobados, coherencia registrada. |
| Entrega segura v0.2 | CI separada de CD, promoción y rollback aprobados. |
| Núcleo Cognitivo v1 | F-1.2/F-1.3 con decisión, permisos, verificación y QA probados. |
| Nexo v1 | Propósito aprobado y coordinación reversible auditada. |
| Herramientas Semánticas v1 | Familia piloto sustituye SQL libre con contratos y permisos. |
| Planos v1 | Plano estructurado con revisión y verificador. |
| Observabilidad v1 | Trazas, coste, salud y evaluación segura visibles. |
| Cerebro de Alejandra v1 | Decisiones reproducibles y operables mediante DevTools seguros. |
| Capacidades Instalables v1 | Capacidad firmada/compatible, instalable y revocable. |
| Agentes v1 | Delegación acotada, supervisada y cancelable. |
| Plataforma Empresarial v1 | Integración empresarial aprobada, segura y operativa. |

## Contradicciones, simplificaciones y preguntas abiertas

- COH-001 y COH-002 quedaron resueltos el 2026-08-01 por ADR-0005 y ADR-0002 respectivamente.
- Simplificación recomendada: validar un vertical por época antes de generalizar; evitar reescribir los dos Workers o crear Marketplace/multiagente antes de registries, permisos y observabilidad.
- Preguntas: definición de Nexo, matriz de riesgo/aprobación, alcance de QA, Motor de Decisión, gobierno de memoria y observabilidad/trazas quedaron resueltas el 2026-08-02 por ADR-0008, ADR-0006, ADR-0009, ADR-0004, ADR-0013 y ADR-0014. Sigue abierto: fuentes de conocimiento y métricas de éxito. Todas están enlazadas al backlog o ADRs, no se asumen resueltas. ADR-0001, ADR-0002, ADR-0004, ADR-0006, ADR-0008, ADR-0009, ADR-0010, ADR-0011 (estrategia), ADR-0013 y ADR-0014 ya están aceptados.
