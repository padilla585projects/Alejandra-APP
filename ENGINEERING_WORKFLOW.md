# Engineering Workflow — Alejandra 2.0

- Estado: vigente
- Propósito: procedimiento operativo único para cualquier Agente de Ingeniería del Proyecto Alejandra, con independencia del modelo o herramienta utilizada.
- Alcance: tareas documentales, técnicas, de seguridad y de operación dentro del repositorio. No sustituye decisiones de producto o arquitectura.

## Autoridad y fuentes de verdad

La jerarquía documental oficial es:

1. `MASTER_PLAN.md` — visión global y principios.
2. `MASTER_ROADMAP.md` — fases, dependencias y ejecución.
3. ADR — decisiones oficiales.
4. Arquitectura, normas y runbooks — detalle especializado.
5. Código — implementación.

Cada documento tiene una responsabilidad única:

| Necesidad | Fuente oficial |
|---|---|
| Estado real, siguiente objetivo y riesgos activos | `PROJECT_STATE.md` |
| Cola inmediata, responsable y rama de una tarea | `TASKS.md` |
| Relevo reproducible | `HANDOFF.md` |
| Reglas de arquitectura y decisiones | `ARCHITECT_RULES.md` y ADRs |
| Reglas específicas de contribución, seguridad y calidad del repositorio | `AGENTS.md` |
| Proceso operativo común de ingeniería | Este documento |
| Procedimientos de operación aprobados | `docs/runbooks/` |
| Deuda, riesgos y propuestas no aprobadas | `ARCHITECT_BACKLOG.md` y `docs/ideas/` |

Ante contradicción entre fuentes, detenerse, conservar evidencia y solicitar o registrar la resolución mediante ADR o el mecanismo que corresponda. No se resuelve por memoria de un chat ni por inferencia.

## Regla de autonomía de los agentes

La documentación versionada del repositorio es la única fuente oficial de contexto del proyecto.

Los prompts asignan objetivos, no contexto. Antes de comenzar cualquier tarea, el Agente de Ingeniería debe leer la documentación indicada por este flujo de trabajo para comprender el estado del proyecto.

Si la documentación es suficiente, el agente continúa de forma autónoma. Si detecta contradicciones, información insuficiente o bloqueos, se detiene, documenta el problema y propone la corrección mínima necesaria.

No debe improvisar, asumir información no documentada ni solicitar contexto que ya deba existir en el repositorio. Los prompts no son fuentes de verdad ni pueden sustituir la documentación versionada.

## Flujo obligatorio de trabajo

Toda tarea sigue este orden, sin saltar etapas:

```text
Contexto
  ↓
Dependencias
  ↓
Objetivo
  ↓
Alcance
  ↓
Reglas
  ↓
Tareas
  ↓
Validación
  ↓
Entregables
  ↓
Criterios de aceptación
  ↓
Detenerse
```

1. **Contexto.** Leer las fuentes obligatorias y confirmar el estado de Git, la rama y si existe una tarea en curso.
2. **Dependencias.** Identificar ADRs, permisos, accesos, datos, decisiones o tareas previas necesarias. Si una dependencia no está resuelta, detenerse: no improvisar ni ampliar el alcance.
3. **Objetivo.** Expresar un resultado verificable y su valor; no confundirlo con una lista de comandos.
4. **Alcance.** Delimitar archivos, sistemas afectados, exclusiones, riesgos, rollback y autoridad necesaria.
5. **Reglas.** Aplicar `AGENTS.md`, `ARCHITECT_RULES.md`, ADRs y runbooks relevantes. Las operaciones remotas requieren la autorización y el runbook exigidos.
6. **Tareas.** Ejecutar una unidad coherente. Si aparece una alternativa superior o un riesgo arquitectónico, documentarlo y esperar aprobación antes de cambiar el rumbo.
7. **Validación.** Ejecutar las pruebas pertinentes, registrar resultado y justificar expresamente cualquier omisión.
8. **Entregables.** Actualizar código, documentos, ADR, runbook, backlog o idea solo cuando el alcance lo requiera.
9. **Criterios de aceptación.** Verificar cada criterio solicitado con evidencia objetiva antes de declarar el trabajo en revisión.
10. **Continuar o detenerse, según ADR-0007.** Si la siguiente tarea ya está aprobada en `TASKS.md`, el agente **continúa sin pedir autorización**: actualiza el estado y sigue. Se detiene únicamente ante lo que ADR-0007 clasifica como no recuperable —migraciones D1, secretos, borrado de datos— o ante la apertura de una **fase nueva**, que es decisión de producto.

## Inicio obligatorio de una tarea

Antes de editar, todo agente debe leer:

1. `START_HERE.md`
2. `PROJECT_STATE.md`
3. `MASTER_PLAN.md`
4. `MASTER_ROADMAP.md`
5. `TASKS.md`
6. `HANDOFF.md`
7. `AGENTS.md`
8. `ENGINEERING_WORKFLOW.md`
9. ADRs, arquitectura, runbooks y documentación del área afectada

Después debe comprobar rama, cambios locales, conflictos y tarea activa. Los cambios ajenos se preservan. Una tarea no se inicia si existe otra en curso que comparte alcance, rama o dependencia sin resolver.

## Relevo entre agentes

El relevo se registra en `HANDOFF.md`; nunca se deja solo en el chat. Al pausar, bloquear, entregar o completar una tarea, actualizar cuando corresponda:

- `TASKS.md`: identificador, estado, responsable, rama, pruebas y siguiente acción exacta.
- `PROJECT_STATE.md`: estado real, riesgo o bloqueo vigente y siguiente objetivo, si cambian.
- `HANDOFF.md`: fecha, agente, tarea, rama, último commit de implementación, archivos, pruebas y resultados, bloqueos, riesgos, siguiente acción exacta y elementos que no deben tocarse.
- `CHANGELOG.md`: únicamente cambios relevantes para consumidores del repositorio.
- ADR, runbook, backlog, idea y registro documental: solo si el cambio afecta su ámbito.

El último commit se anota con hash corto y mensaje. Un bloqueo describe el hecho observable, impacto, autoridad necesaria y condición exacta para reanudar. La siguiente acción debe ser ejecutable sin interpretar conversaciones anteriores.

## Ramas e integración

- Una tarea principal por rama. No se trabaja directamente sobre `main`.
- Usar nombres `tipo/area-descripcion`, con prefijos `docs/`, `chore/`, `feat/` o `fix/`; en entornos Codex se admite el prefijo operativo `codex/` cuando ya está establecido.
- La rama dura lo que dura una tarea coherente. Si cambia el objetivo, se cierra, se releva o se crea una nueva rama aprobada.
- Integrar solo mediante PR revisable y después de las validaciones exigidas. Un merge bloqueado no autoriza despliegue, migración ni modificación de secretos.
- Cerrar una rama únicamente cuando la tarea haya sido revisada, integrada o descartada con su estado documentado.

## Commits

- Usar formato Conventional Commits: `tipo(área): descripción breve`, por ejemplo `docs(workflow): consolidate engineering process`.
- Cada commit representa una unidad revisable y recuperable.
- Separar commits cuando cambien naturaleza o riesgo: implementación, migración, seguridad, pruebas y documentación no relacionada no se mezclan.
- No dividir artificialmente una modificación inseparable que perdería coherencia o no podría validarse por sí sola.
- Antes de confirmar: revisar archivos staged, diffs, secretos, archivos generados, codificación y pruebas aplicables.

## Pull Requests

Toda PR debe indicar como mínimo:

- objetivo, alcance y exclusiones;
- riesgo, impacto y rollback;
- pruebas ejecutadas, resultados y omisiones justificadas;
- documentación y ADR/runbook actualizados;
- dependencias, aprobaciones o acciones manuales pendientes.

Bloquean un merge: fallos de pruebas requeridas, cambios sin documentación aplicable, contradicción con fuentes oficiales, secretos o artefactos accidentales, falta de autorización, conflictos sin resolver, o una decisión arquitectónica pendiente.

## Fases y tareas

Las fases son hitos grandes que aportan valor real y tienen una definición de aceptación propia. No se crean subfases para fragmentar trabajo administrativo. Los trabajos pequeños se registran como tareas dentro de una fase o como tareas operativas independientes, sin alterar la estructura del roadmap.

Una fase aprobada queda congelada. Mejoras o desviaciones posteriores se registran en el backlog o como idea, y se estudian en la fase que corresponda.

## Plantilla oficial de prompt

Los prompts de trabajo se dirigen a **«Agente de Ingeniería del Proyecto Alejandra»** y no dependen de un modelo concreto.

```text
# PROYECTO ALEJANDRA 2.0
# TAREA — <título>

Actúa como Agente de Ingeniería del Proyecto Alejandra.

## Contexto
<estado verificable, documentos y decisión relacionada>

## Dependencias
<ADRs, permisos, accesos o bloqueos; si falta una, detenerse>

## Objetivo
<resultado verificable>

## Alcance y exclusiones
<qué se modifica y qué no>

## Reglas
<seguridad, arquitectura, producción, autoridad y límites>

## Tareas
<lista ordenada>

## Validación
<pruebas y evidencia exigidas>

## Entregables
<archivos, informe o decisión>

## Criterios de aceptación
<condiciones verificables>

## Cierre
<documentos a actualizar, detenerse y esperar revisión>
```

Esta plantilla aplica la regla de autonomía de los agentes. Un prompt no puede modificar una fase aprobada, una decisión ADR o la jerarquía documental sin el cambio versionado y la aprobación requerida.

## Definición de terminado

Una tarea termina solo si, según corresponda a su alcance:

- código y configuración están completos y revisables;
- pruebas pertinentes están ejecutadas o su omisión queda justificada;
- riesgos, permisos, rollback y pendientes están documentados;
- ADR, runbook, backlog o idea aplicables están actualizados;
- `TASKS.md`, `PROJECT_STATE.md`, `HANDOFF.md`, `CHANGELOG.md`, roadmap y registro documental reflejan la realidad cuando su ámbito cambia;
- se ha entregado para revisión y el agente se ha detenido.

No completar un punto que no aplica no es un fallo, pero debe quedar explícitamente justificado en la entrega.

## Recomendaciones de mejora futura

- Revisar periódicamente que cada fuente mantiene una sola responsabilidad y retirar duplicación que reaparezca.
- Añadir una lista de comprobación de PR reutilizable cuando se adopte una herramienta de PR con plantilla versionada.
- Resolver las discrepancias históricas de estado que puedan existir entre roadmap, ADRs y estado vivo mediante cambios documentados, no mediante este procedimiento.
