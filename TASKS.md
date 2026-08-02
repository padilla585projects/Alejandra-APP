# TASKS — Cola operativa inmediata

Estado: **dos tareas activas** (ARC-013 y F-0.2-CFG). No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

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

### ARC-013 — Retirar la supresión de errores del DDL en runtime

- ID: ARC-013
- Título: Sustituir los 18 `catch` vacíos de DDL por registro de error
- Fase: Época 0 — deuda de esquema (derivada de ARC-011/ARC-012)
- Estado: en revisión — **código completo y verificado; falta desplegar**
- Prioridad: Alta
- Rama: `fix/arc-013-ddl-sin-silenciar` (commit `eb772ee`)
- Responsable actual: Director del Proyecto (solo queda la decisión de despliegue)
- Objetivo: que ningún `ALTER TABLE` ni `CREATE TABLE` ejecutado en runtime pueda fallar sin dejar rastro. Es la causa raíz de ARC-012: tres de dieciocho sentencias ya habían fallado en silencio durante semanas.
- Criterios de aceptación:
  1. Las 18 sentencias DDL con el error suprimido registran el fallo en lugar de tragárselo.
  2. El registro **distingue el caso benigno del real**: `duplicate column name` / `already exists` es el funcionamiento normal del patrón idempotente y no debe generar ruido; cualquier otro error sí.
  3. Un fallo de DDL no interrumpe la petición en curso: el objetivo es observabilidad, no cambiar el comportamiento.
  4. `node --check worker.js` en verde y 85/85 tests del agente sin regresión.
  5. Se revisa si el mismo patrón existe en `alejandra-agente/worker.js` y se aplica —o se descarta motivadamente— también allí. Regla de los dos cerebros.
  6. Nada desplegado.
- Dependencias: ARC-011 fase 2 (inventario verificado, con las 18 ubicaciones localizadas).
- Bloqueos: el arreglo no surte efecto hasta desplegar `worker.js`, y **el despliegue es una decisión aparte del Director**. La tarea entrega el código validado, no la puesta en producción.
- Archivos principales: `worker.js` (41 llamadas), `alejandra-agente/worker.js` (7 llamadas).
- Pruebas: ✅ `node --check` en los dos workers; ✅ 85/85 tests del agente; ✅ barrido que confirma 0 sentencias DDL con el error suprimido; ✅ prueba de la lógica de `runDDL` contra los 5 escenarios de error de D1 y contra un binding roto — no lanza en ninguno.
- Resultado: alcance mayor que el estimado (los 18 del backlog eran solo los `ALTER`; los `CREATE TABLE` silenciados eran la misma clase de riesgo). Se añade `ddlPaso()` para `runMigrations()`, que etiquetaba cualquier error como «ya existe» y le daba al operador un visto bueno falso.
- Última actualización: 2026-08-02
- Siguiente acción exacta: **integrar la rama y desplegar `worker.js`** por el workflow manual. Hasta desplegar, el arreglo no surte efecto en producción. Ver la sección «Lunes» de `HANDOFF.md`.

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
  3. Decidir si `required_approving_review_count` sigue en 1 (exige bypass de administrador al ser un repositorio de un solo mantenedor) o baja a 0.
  4. Decidir si la política de rama de `github-pages` sigue limitada a `main` o se amplía para publicar por tag.
  5. Nada desplegado ni migrado durante la validación.
- Dependencias: F-0.1-R completada; acceso a los valores reales de los secretos.
- Bloqueos: los valores de los secretos no son legibles desde la API; solo el Director puede reintroducirlos.
- Archivos principales: ninguno; es configuración remota.
- Pruebas: verificación en Actions de que el ensayo sale `skipped` y de que no se genera ningún despliegue.
- Última actualización: 2026-08-02
- Siguiente acción exacta: recrear los secretos en el entorno `production` desde Settings → Environments.

## Completadas — pendientes de aprobación

| ID | Título | Estado | Evidencia |
|---|---|---|---|
| F-0.1 | Separación de CI, despliegues, secretos y migraciones D1 | Implementada e integrada | `a59a2c5`, `6d5d98c`, `96417a5`, `cce5224`. Validada: 6/6 YAML, `node --check` ×2, 85/85 tests, 5/5 criterios de entrega segura. |
| F-0.1-R | Activación y validación en GitHub remoto | Completada | PR #9 integrada. Workflows antiguos desactivados antes de integrar; CI verde en `push` y `pull_request`; ningún despliegue disparado; entorno `production` creado con revisor requerido; `main` protegida con PR obligatoria y check requerido. |
| GOV-001 | Consolidación del proceso operativo de ingeniería | Completada; en revisión | `f644a6b`, `80cc1ff`. `ENGINEERING_WORKFLOW.md` como proceso único; `AGENTS.md` conserva solo reglas del repositorio y remite a él. |
| ARC-011 (fases 1-2) | Inventario del esquema D1 y contraste con producción | Completada | PR #10. 173 DDL en código; 105/150 tablas solo existen porque el código las crea; 27 tablas reales sin declarar; 3 `ALTER` fallidos en silencio. Informe en `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md`. Fase 3 pendiente con ADR propio. |
| ARC-012 | Tres columnas ausentes en producción | Completada | PR #11. Runs 30722027660, 30722072138 y 30722103191, verificados contra el esquema real. Cierra SEG-01 de verdad y restaura la retención RGPD. |
