# ADR-0007 — Autonomía de los Agentes de Ingeniería

- Identificador: ADR-0007
- Fecha: 2026-08-02
- Estado: Aceptado
- Decisores: Director del Proyecto
- Sustituye: la formulación absoluta de las prohibiciones en `CLAUDE.md` y `AGENTS.md`, y el paso 10 («Detenerse») de `ENGINEERING_WORKFLOW.md`
- Relacionado: ADR-0001 (entrega deliberada), ADR-0006 (matriz de riesgo, propuesto)

## Contexto

F-0.1 introdujo un conjunto de prohibiciones absolutas —no desplegar, no migrar, no tocar
secretos, no continuar a la siguiente tarea sin autorización— pensadas para proteger una
producción futura de Alejandra 2.0.

En la práctica han producido un efecto no buscado: un Agente de Ingeniería se detiene
después de **cada** unidad de trabajo, aunque la tarea siguiente ya esté aprobada en
`TASKS.md` y aunque la acción pendiente sea trivialmente reversible. El resultado es que
las sesiones largas de trabajo autónomo son imposibles, y el coste recae sobre el Director,
que tiene que autorizar paso a paso.

**Precisión necesaria sobre el estado del proyecto.** Alejandra 2.0 —el Núcleo Cognitivo—
no existe: es diseño, no código. Pero la aplicación actual **sí está desplegada y opera con
datos reales**: `worker.js:6357` documenta un fallo que dejó *«el reset de contraseña roto
en producción para cualquier usuario»*, y ARC-012 restauró el 2026-08-02 la política de
retención RGPD, que estaba inoperante. Hay fichajes, DNI y datos personales de terceros.

Por tanto la frontera útil **no es «desarrollo contra producción»**, que llevaría a relajar
salvaguardas sobre datos reales. Es:

> **El código es reversible. Los datos no.**

## Decisión

La autonomía se determina por la **capacidad real de recuperación**, no por la categoría de
la acción. Dos niveles:

### Autónomo — sin autorización previa

El agente ejecuta y deja constancia. No pregunta.

| Acción | Por qué es recuperable |
|---|---|
| Crear ramas, commits, `push` | Nada llega a ejecutarse; se revierte con git |
| Abrir PR y fusionarla con CI en verde | El check `Syntax and agent tests` es obligatorio; revertir es un commit |
| Ejecutar pruebas y validaciones | Sin efectos |
| **Desplegar Workers** | Atómico: si el bundle no compila, la versión anterior sigue sirviendo. No toca datos. Rollback = redesplegar el SHA anterior |
| Encadenar tareas **ya aprobadas** de `TASKS.md` | Trabajo de ingeniería dentro de un alcance decidido |

### Requiere decisión humana

No por ceremonia, sino porque **no hay vuelta atrás razonable**.

| Acción | Por qué no es recuperable |
|---|---|
| **Migraciones D1** | Alteran datos reales. Y ARC-011 demostró que el esquema **no es reproducible desde el repositorio**: si una migración corrompe el esquema, no hay fuente desde la que restaurarlo |
| **Secretos** | Su exposición no se deshace. Rotarlos exige coordinación externa |
| `DELETE`, `DROP`, `TRUNCATE`, `UPDATE` masivo | Pérdida de datos de terceros. Mantiene la barrera `CONFIRMO BORRADO` (SEC-08/SEC-09) |
| Borrado en R2 | Los ficheros no tienen copia |
| **Abrir una fase nueva del roadmap** | Es una decisión de producto, no de ingeniería. Encadenar tareas aprobadas sí es autónomo; abrir una fase, no |

## Alternativas consideradas

| Alternativa | Motivo |
|---|---|
| Declarar el entorno «de desarrollo» y relajar todo | **Descartada: la premisa es falsa.** Hay datos personales reales bajo RGPD. Relajar las salvaguardas de datos por considerarlo un entorno de pruebas sería un error de hecho, no de criterio |
| Mantener las prohibiciones absolutas | Descartada: bloquean trabajo reversible y trasladan al Director un coste que no aporta seguridad |
| Autonomía por lista de comandos permitidos | Descartada: frágil. Una lista se queda obsoleta y da falsa confianza — el mismo defecto que ARC-013 |
| **Autonomía por reversibilidad** | **Elegida.** El criterio es comprobable en revisión: ¿se deshace esto? ¿queda constancia? |

## Consecuencias

- El Agente de Ingeniería puede sostener sesiones largas: leer estado, tomar la siguiente
  tarea aprobada, implementarla, validarla, integrarla, desplegar y continuar.
- **Sigue deteniéndose** ante datos, secretos y fases nuevas — que es donde su criterio no
  puede sustituir al del Director.
- Todo despliegue autónomo exige **verificación posterior registrada**. Desplegar sin
  comprobar no es autonomía, es dejar de mirar.
- La protección del entorno GitHub `production` **se mantiene**. Es la última barrera real
  y ARC-014 ya la señala como debilitada; retirarla la eliminaría del todo.

## Verificación

Un agente puede encadenar tareas del roadmap sin autorización por paso; y ni las
migraciones, ni los secretos, ni el borrado de datos son alcanzables sin decisión humana.

## Referencias

- `ENGINEERING_WORKFLOW.md` — flujo operativo, que aplica este ADR
- `AGENTS.md`, `CLAUDE.md` — reglas del repositorio, que remiten aquí
- `ARCHITECT_BACKLOG.md` — ARC-011 (esquema no reproducible), ARC-014 (autoaprobación)
- `docs/runbooks/CI-CD-Y-MIGRACIONES.md`
