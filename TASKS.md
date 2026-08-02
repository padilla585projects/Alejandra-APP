# TASKS — Cola operativa inmediata

Estado: **dos tareas activas** (F-0.2-CFG y ARC-011-FASE3-CHECKLISTS). ARC-013 ya está desplegado y pasa a la tabla de completadas. No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

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

### P-DESIGN-001 — Visión visual madura de Alejandra

- ID: P-DESIGN-001
- Título: Proponer y decidir la dirección visual antes de construir el nuevo frontend
- Fase: P-DESIGN — visión del frontend
- Estado: aprobada
- Prioridad: Alta
- Rama: `codex/presentation-next`
- Responsable actual: Director del Proyecto para decisión; Arquitectura/Producto para iteraciones solicitadas
- Objetivo: valorar la dirección visual completa de campo, oficina, administración, chat y observabilidad sin cambiar la aplicación.
- Criterios de aceptación: filosofía, identidad, tokens propuestos, navegación, pantallas, estados, responsive y claro/oscuro documentados; mockup representativo disponible; decisión explícita antes de retomar migración.
- Dependencias: ADR-0012 aceptado; migración de presentación pausada por esta fase.
- Bloqueos: ninguno para cimientos reversibles de presentación.
- Archivos principales: `docs/architecture/FRONTEND_PRODUCT_VISION.md`.
- Pruebas: revisión de coherencia con ADR-0012 y arquitectura de presentación; validación visual del mockup.
- Última actualización: 2026-08-02
- Siguiente acción exacta: iniciar desde tokens y componentes sin consumo visual.

### P-ARCH-004 — Tokens semánticos y modo claro preparado

- ID: P-ARCH-004
- Título: Consolidar contratos de color, espaciado, capas y radios del Design System
- Fase: Época transversal — P-1
- Estado: completada
- Prioridad: Alta
- Rama: `codex/presentation-next`
- Responsable actual: Agente de Ingeniería
- Objetivo: preparar tokens semánticos sin alterar la interfaz actual.
- Criterios de aceptación: paleta actual preservada por alias; modo claro aislado y no cargado; sin cambios a entradas HTML ni contratos backend.
- Dependencias: P-DESIGN-001 aprobada; línea base `ui-baseline-2026-08-02` preservada.
- Bloqueos: ninguno para la siguiente rebanada visual de bajo riesgo.
- Archivos principales: `packages/design-system/src/tokens/semantic.css`, `packages/design-system/src/tokens/light.css`.
- Pruebas: inventario de tokens, encoding y diff check.
- Última actualización: 2026-08-02
- Siguiente acción exacta: incorporar los tokens semánticos en una sola superficie de bajo riesgo, conservando la paleta actual por defecto.

### P-ARCH-002/P-ARCH-003 — Primitivas y tokens del sistema de diseño

- ID: P-ARCH-002/P-ARCH-003
- Título: Extraer toast compartido y tokens base de color
- Fase: Época transversal — P-1
- Estado: completada
- Prioridad: Alta
- Rama: `docs/presentacion-arquitectura` (PENDIENTE de integración)
- Responsable actual: Arquitecto del Proyecto; Director del Proyecto para la revisión antes de ampliar
- Objetivo: aislar una primitiva visual reutilizable y tokens sin modificar funcionalidad, backend ni permisos.
- Criterios de aceptación: API heredada compatible, 12 invocaciones sin cambios, escape/cierre/caducidad conservados, accesibilidad del cierre; 12 tokens con los mismos valores; pruebas y rollback por Git.
- Dependencias: `ADR-0012` aceptado; P-ARCH-001 aprobado.
- Bloqueos: ninguno para otra rebanada de presentación de bajo riesgo.
- Archivos principales: `packages/design-system/src/components/toast.js`, `packages/design-system/src/tokens/base.css`, `alejandra-panel.html`, documentación de arquitectura.
- Pruebas: sintaxis del componente, DOM/temporizador simulados, inventario de tokens, encoding y diff check.
- Última actualización: 2026-08-02
- Siguiente acción exacta: elegir un componente utilizado por dos flujos que no dependa de HTTP, autorización ni reglas de negocio.

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
- Siguiente acción exacta: el Director decide si autoriza aplicar `migrate_checklists.sql` contra D1 (paso 2 de ADR-0011) por el workflow manual de migraciones.

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
- Siguiente acción exacta: recrear los secretos en el entorno `production` desde Settings → Environments.

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
| ADR-0006 | Matriz de riesgo y aprobación humana (ARC-001) | **Aceptado (2026-08-02)** | `run_migration` pasa a capacidad administrativa fuera del alcance autónomo. Desbloquea ADR-0004. |
| ADR-0008 | Definición de Nexo (ARC-003) | **Aceptado (2026-08-02)** | Nexo = capa de integración con sistemas externos (interpretación A). |
| ADR-0009 | Alcance de QA y verificación (ARC-004) | **Aceptado (2026-08-02)** | Tres niveles de verificación; explicabilidad como deuda hasta F-4.1. |
| ADR-0010 | Catálogo de tools y matriz de permisos (ARC-006) | **Aceptado (2026-08-02)** | `acceso`/`cron`/`nivel_riesgo` como metadato declarado por tool. |
| ADR-0011 | Migrador único y retirada del DDL en runtime (ARC-011 fase 3) | **Aceptado como estrategia (2026-08-02)** | Migración por vertical, empezando por `checklists`, al ritmo del roadmap. |
