# TASKS — Cola operativa inmediata

Estado: **tareas activas**: F-0.2-CFG (pospuesta, ver decisión del Director), ARC-011-FASE3-CHECKLISTS (paso 2 pospuesto, ver decisión del Director) y F-1.3-TOOL-REGISTRY-ESQUELETO (primer entregable en curso). **F-1.2-NUCLEO-ESQUELETO se verificó completa (2026-08-02)** — sus 6 criterios de aceptación se cumplen y las 20 pruebas pasan (`node --test nucleo-cognitivo/test/*.js`) — y pasa a la tabla de completadas, junto con P-ARCH-002, ARC-008-TRAZAS-MIGRACION y ARC-013. No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

## Decisiones del Director — 2026-08-02 (ronda de desbloqueo del roadmap)

- **P-ARCH-002 — aprobada.** El componente de notificaciones temporales queda cerrado; desbloquea la siguiente rebanada de presentación.
- **ARC-014 — riesgo aceptado temporalmente.** Mientras el proyecto tenga un único mantenedor en fase de desarrollo, no se exige revisor distinto del solicitante. Se reabre en cuanto exista producción real o más de un mantenedor. Detalle en `ARCHITECT_BACKLOG.md`.
- **ARC-011-FASE3-CHECKLISTS (paso 2, aplicar contra D1) — pospuesta.** No se autoriza todavía; se retoma cuando exista una ventana específica para cambios de esquema con verificación de D1 antes y después, tras completar la validación de la interfaz y del núcleo cognitivo.
- **F-0.2-CFG — pospuesta.** Los secretos se mueven al entorno `production` cuando el proyecto entre en preproducción/producción estable. Mientras tanto se mantiene la configuración a nivel de repositorio; ningún agente debe conocer ni manipular los valores reales.

## Reglas

- Crear una tarea solo cuando esté aprobada para ejecución o revisión inmediata.
- Una tarea activa tiene una única rama y responsable actual.
- Actualizar al iniciar, bloquear, relevar, revisar y completar.

## Plantilla

```text
ID:
Título:
Fase:
Estado: pendiente | lista | en curso | bloqueada | en revisión | aprobada | completada | cancelada
Prioridad:
Rama:
Responsable actual:
Objetivo:
Criterios de aceptación:
Dependencias:
Bloqueos:
Archivos principales:
Pruebas:
Última actualización:
Siguiente acción exacta:
```

## TAREAS ACTIVAS

### F-1.3-TOOL-REGISTRY-ESQUELETO — Esqueleto y contratos del Capability/Tool Registry

- ID: F-1.3-TOOL-REGISTRY-ESQUELETO
- Título: Primer entregable de F-1.3 tras cerrar F-1.2
- Fase: Época 1 — Núcleo Cognitivo (F-1.3)
- Estado: en curso
- Prioridad: Alta
- Rama: `feat/f-1.3-tool-registry-esqueleto`
- Responsable actual: Agente de Ingeniería
- Objetivo: declarar, como paquete aislado (mismo patrón que F-1.2: contratos y pruebas, sin integrar en `worker.js` ni `alejandra-agente/worker.js`), el contrato del Tool Registry — validación pura del metadato `acceso`/`cron`/`nivel_riesgo` por tool que fija ADR-0010 — y las interfaces de Verifier según los tres niveles de ADR-0009 (determinista, revisión humana asíncrona, explicabilidad como deuda).
- Criterios de aceptación:
  1. Tool Registry: función pura que valida la forma de una declaración de tool (nombre, descripción, `acceso`, `cron`, `nivel_riesgo` ∈ {N0,N1,N2,N3} de ADR-0006) — sin leer el catálogo real de ninguno de los dos Workers, sin ejecutar tools.
  2. Verifier: interfaz para los tres niveles de ADR-0009; el nivel determinista puede tener implementación real si es función pura sobre datos ya provistos (p. ej. validación de esquema); revisión humana y explicabilidad quedan como interfaz que lanza error explícito, citando la dependencia que falta.
  3. QA: no se construye en esta tarea — depende de Verifier real y de tools ya registradas; ver `docs/decisions/ADR-0009-ALCANCE-DE-QA-Y-VERIFICACION.md`.
  4. Ningún catálogo de tools real de `worker.js` ni `alejandra-agente/lib.js` se migra ni se toca en esta tarea — eso es trabajo posterior, vertical por vertical, no de golpe (mismo principio que ARC-011/ADR-0011).
  5. Pruebas (`node --test`) verifican los puntos 1-2; CI ejecuta `node --check` y las pruebas del paquete.
- Dependencias: F-1.2 completada (2026-08-02); ARC-004 (ADR-0009) y ARC-006 (ADR-0010) cerrados.
- Bloqueos: ninguno para el esqueleto. Migrar el catálogo real de tools de cada Worker al Registry es alcance posterior, fuera de esta tarea.
- Archivos principales: `nucleo-cognitivo/` o paquete nuevo equivalente (a decidir en la implementación, documentando el porqué).
- Pruebas: `node --check` sobre cada módulo; `node --test` sobre el paquete correspondiente.
- Última actualización: 2026-08-02
- Siguiente acción exacta: construir el esqueleto (Tool Registry + Verifier) siguiendo el mismo patrón de interfaces con error explícito que usó F-1.2.

### ARC-011-FASE3-CHECKLISTS — Declarar la migración del vertical `checklists`

- ID: ARC-011-FASE3-CHECKLISTS
- Título: Primer vertical de la migración por fases de ARC-011 (ADR-0011)
- Fase: Época 0 — deuda de esquema (derivada de ARC-011 fase 3)
- Estado: **en revisión — paso 1 (declarar) completo; falta autorización del Director para el paso 2 (aplicar)**
- Prioridad: Media
- Rama: `docs/arc-011-fase3-checklists`
- Responsable actual: Director del Proyecto (autorización para aplicar contra D1)
- Objetivo: declarar en una migración `.sql` versionada el esquema real —ya verificado en ARC-015— de las tablas del vertical `checklists` (`checklist_plantillas`, `checklists_plantillas`, `checklist_registros`, `checklist_ejecuciones`), siguiendo el ciclo de ADR-0011.
- Criterios de aceptación:
  1. ✅ Migración `.sql` idempotente (`CREATE TABLE IF NOT EXISTS`) con el esquema exacto verificado (`migrate_checklists.sql`, con la fuente `worker.js:línea` de cada `CREATE`), no el que el código debería crear.
  2. ✅ No se ejecuta contra D1 en esta tarea: eso es una migración y requiere autorización explícita del Director (ADR-0007).
  3. ✅ El DDL en runtime de este vertical se deja intacto (`worker.js:14196-14221` y `18122-18152`) hasta que la migración esté aplicada y verificada — ADR-0011 prohíbe retirarlo antes.
  4. ✅ Registrada en `migrate_manifiesto.json` (creado, formato de ADR-0011) como `aplicada: false`.
- Dependencias: ADR-0011 aceptado como estrategia (2026-08-02); ARC-013 y ARC-015 ya corregidos.
- Bloqueos: aplicar la migración contra D1 exige decisión del Director.
- Archivos principales: `migrate_checklists.sql` (nuevo), `migrate_manifiesto.json` (nuevo).
- Pruebas: verificación manual de que los 4 `CREATE TABLE IF NOT EXISTS` coinciden columna por columna con los `CREATE` de `worker.js` (14196, 14207, 18122, 18134); `node -e "JSON.parse(...)"` sobre el manifiesto.
- Última actualización: 2026-08-02
- Siguiente acción exacta: **pospuesta por decisión del Director (2026-08-02).** No se inicia el workflow de aplicación hasta que exista una ventana específica para cambios de esquema, con verificación de D1 antes y después, tras completar la validación de la interfaz y del núcleo cognitivo.

### F-0.2-CFG — Completar la configuración remota de entrega segura

- ID: F-0.2-CFG
- Título: Cerrar los controles remotos que F-0.1-R no pudo completar
- Fase: Época 0 — Fundación y entrega segura
- Estado: lista
- Prioridad: Alta
- Rama: `PENDIENTE` — es configuración remota; solo requiere rama si cambia documentación
- Responsable actual: Director del Proyecto (requiere manejar valores de secretos)
- Objetivo: que los secretos de producción queden acotados al entorno `production` y que el circuito manual de despliegue quede probado en vacío.
- Criterios de aceptación:
  1. Los secretos de Cloudflare y de aplicación recreados en el entorno `production` y retirados del nivel de repositorio **solo después** de verificarlos allí.
  2. Ensayo con confirmación errónea sobre un workflow de producción: el job debe salir `skipped`, sin ejecutar.
  3. ✅ **Decidido y aplicado el 2026-08-02: baja a 0.** El Director lo autorizó de forma expresa. Motivo: al ser un repositorio de un solo mantenedor, GitHub no permite auto-aprobar, así que cada merge exigía el bypass de administrador — fricción sin protección real. La protección efectiva sigue siendo el check `Syntax and agent tests` y la aprobación del entorno `production`, ambos intactos. Verificado tras el cambio: PR obligatoria, rama al día, sin force-push ni borrado, todo sin tocar.
  4. Decidir si la política de rama de `github-pages` sigue limitada a `main` o se amplía para publicar por tag.
  5. Nada desplegado ni migrado durante la validación.
- Dependencias: F-0.1-R completada; acceso a los valores reales de los secretos.
- Bloqueos: los valores de los secretos no son legibles desde la API; solo el Director puede reintroducirlos.
- Archivos principales: ninguno; es configuración remota.
- Pruebas: verificación en Actions de que el ensayo sale `skipped` y de que no se genera ningún despliegue.
- Última actualización: 2026-08-02
- Siguiente acción exacta: **pospuesta por decisión del Director (2026-08-02).** Se retoma cuando el proyecto entre en fase estable de preproducción/producción; mientras tanto se mantiene la configuración a nivel de repositorio y ningún agente maneja los valores reales.

## Completadas — pendientes de aprobación

| ID | Título | Estado | Evidencia |
|---|---|---|---|
| F-0.1 | Separación de CI, despliegues, secretos y migraciones D1 | Implementada e integrada | `a59a2c5`, `6d5d98c`, `96417a5`, `cce5224`. Validada: 6/6 YAML, `node --check` ×2, 85/85 tests, 5/5 criterios de entrega segura. |
| F-0.1-R | Activación y validación en GitHub remoto | Completada | PR #9 integrada. Workflows antiguos desactivados antes de integrar; CI verde en `push` y `pull_request`; ningún despliegue disparado; entorno `production` creado con revisor requerido; `main` protegida con PR obligatoria y check requerido. |
| GOV-001 | Consolidación del proceso operativo de ingeniería | Completada; en revisión | `f644a6b`, `80cc1ff`. `ENGINEERING_WORKFLOW.md` como proceso único; `AGENTS.md` conserva solo reglas del repositorio y remite a él. |
| ARC-011 (fases 1-2) | Inventario del esquema D1 y contraste con producción | Completada | PR #10. 173 DDL en código; 105/150 tablas solo existen porque el código las crea; 27 tablas reales sin declarar; 3 `ALTER` fallidos en silencio. Informe en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`. Fase 3: ver ADR-0011 (aceptado como estrategia) y tarea `ARC-011-FASE3-CHECKLISTS`. |
| ARC-012 | Tres columnas ausentes en producción | Completada | PR #11. Runs 30722027660, 30722072138 y 30722103191, verificados contra el esquema real. Cierra SEG-01 de verdad y restaura la retención RGPD. |
| ARC-013 | Retirar la supresión de errores del DDL en runtime | Completada y **desplegada** | `eb772ee` + posteriores. `runDDL()`/`ddlPaso()` en producción en los dos workers (`alejandra-app-api` `a5ccf770`, `alejandra-agente` `a67353ec`). Ningún DDL falla ya en silencio. |
| ARC-015 | Esquema descrito a Alejandra distinto del real | Cerrado | `5c8b2b9` + auditoría remota de Cloudflare. Esquema verificado contra D1 real: 57/60 correcto. |
| F-0.2 | Catálogo de rutas, checks de CI y contratos base | **Completada (2026-08-02)** | `2cc6f5b`, `16dd55d`, `7dcf084`, `42eb2c2`. 544 rutas inventariadas; inventario de bindings/secretos limpio; cuatro validaciones en CI; auditoría remota de Cloudflare cierra la fase. Hallazgo ARC-018 registrado, no bloqueante. |
| ADR-0004 | Motor de Decisión y modos cognitivos v1.0 | **Aceptado (2026-08-02)** | Arquitectura objetivo aceptada. Cierra F-1.1. Autoriza esqueleto/contratos, no activación (memoria/trazas siguen pendientes de ARC-002/ARC-008). |
| ADR-0006 | Matriz de riesgo y aprobación humana (ARC-001) | **Aceptado (2026-08-02)** | `run_migration` pasa a capacidad administrativa fuera del alcance autónomo. Desbloquea ADR-0004. |
| ADR-0008 | Definición de Nexo (ARC-003) | **Aceptado (2026-08-02)** | Nexo = capa de integración con sistemas externos (interpretación A). |
| ADR-0009 | Alcance de QA y verificación (ARC-004) | **Aceptado (2026-08-02)** | Tres niveles de verificación; explicabilidad como deuda hasta F-4.1. |
| ADR-0010 | Catálogo de tools y matriz de permisos (ARC-006) | **Aceptado (2026-08-02)** | `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool. |
| ADR-0011 | Migrador único y retirada del DDL en runtime (ARC-011 fase 3) | **Aceptado como estrategia (2026-08-02)** | Migración por vertical, empezando por `checklists`, al ritmo del roadmap. |
| ADR-0013 | Gobierno de memoria (ARC-002) | **Aceptado con modificaciones (2026-08-02)** | Memoria opt-in, candidatas pendientes de validación para inferencias, caducidad 6/12 meses, aprobación por rol para memoria compartida, supresión real sin versión archivada. |
| ADR-0014 | Observabilidad y trazas (ARC-008) | **Aceptado con modificaciones (2026-08-02)** | Tabla `alejandra_trazas` en D1, retención 30/90 días, minimización obligatoria, endpoint único en `alejandra-app-api`, `/health` de tres estados. |
| F-1.2 (interfaces memoria/trazas) | `memory.js` y contrato `registrarTraza()` en `nucleo-cognitivo/` | Completada | PR #20. Interfaces sin persistencia real, mismo patrón que `context-engine.js`/`planner.js`; 20 pruebas en verde. |
| ARC-008-TRAZAS-MIGRACION | Migración D1 de la tabla `alejandra_trazas` | Completada y verificada | PR #21 (declaración) + run 30746110357 (aplicación). Export previo de `alejandra-db` (8,1 MB) antes de aplicar; verificada contra el esquema real tras aplicar. Autorización del Director acotada a la única D1 existente; no se extiende a una futura producción separada. |
| ADR-0014 (implementación) | `registrarTraza()` real + `/health` de tres estados + `GET /admin/trazas`, en los dos Workers | Completada, desplegada y verificada | PR #24 (`alejandra-app-api`, run 30746614977) + PR #25 (`alejandra-agente`, run 30746733097). ARC-013 conectado a `alejandra_trazas`; `/health` verificado en vivo `healthy` en los dos; 110/110 tests del agente en verde. |
| fix/version-fallback-adr0014 | `index.html`: desactivar fallback de versión roto por el cambio de `/health` | Completada | PR #26. `hj.version` pasó a ser un UUID de despliegue; el fallback comparaba contra `APP_VERSION` y habría forzado recargas falsas (patrón de los incidentes de recarga infinita). Corregido en `main`; publicar a Pages sigue siendo un paso de entrega aparte. |
| P-ARCH-002 | Componente compartido de notificaciones temporales | **Aprobada por el Director (2026-08-02)** | `packages/design-system/src/components/toast.js`. API heredada `mostrarToast()` compatible, 12 invocaciones sin cambios, sin backend ni permisos afectados. Evidencia en `docs/architecture/FRONTEND_SLICE_TOAST.md`. Desbloquea la siguiente rebanada de presentación. |
| F-1.2-NUCLEO-ESQUELETO | Esqueleto, contratos e interfaces del núcleo cognitivo | Completada — verificada (2026-08-02) | `nucleo-cognitivo/`: Estado Cognitivo y Policy Engine implementados; Context Engine, Planner y Motor de Decisión como interfaces con error explícito; `memory.js` (ADR-0013 §8) y contrato `registrarTraza()` (ADR-0014 §5) añadidos en PR #20. Los 6 criterios de aceptación verificados contra el código: `node --check nucleo-cognitivo/src/*.js` y `node --test nucleo-cognitivo/test/*.js` (20/20 en verde). Cierra F-1.2 y desbloquea F-1.3. |
