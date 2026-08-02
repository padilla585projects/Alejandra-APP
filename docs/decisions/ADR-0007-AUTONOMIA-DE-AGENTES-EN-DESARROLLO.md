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
| Aceptar un ADR | Cambiar un ADR de «Propuesto» a «Aceptado» es la decisión misma. Redactarlo sí es autónomo |

### Enmienda 1 (2026-08-02) — apertura autónoma de fases

Autorizada expresamente por el Director. La redacción original reservaba abrir una fase
nueva para el Director; en la práctica eso detenía al agente aunque todas las dependencias
de la fase estuvieran cerradas, que es precisamente el caso en que ya no hay nada que
decidir.

**El agente puede abrir la siguiente fase del roadmap por su cuenta si, y solo si:**

1. **Todas** las dependencias declaradas en la ficha de esa fase en `MASTER_ROADMAP.md`
   están resueltas y documentadas.
2. Los ADR de los que depende están en estado **Aceptado**. Un ADR redactado pero
   propuesto **no** cuenta.
3. El agente deja constancia escrita de esa comprobación, dependencia por dependencia,
   antes de escribir la primera línea de código.

**Se detiene** si alguna dependencia no está resuelta, si un ADR sigue propuesto, o si al
comprobarlo aparece una contradicción entre documentos.

**Lo que esta enmienda NO cambia:** el agente sigue sin poder **aceptar** un ADR. Por
tanto, una fase cuyo contenido sea tomar decisiones —como F-1.1, que consiste en resolver
ADR-0002 y ADR-0004— sigue requiriendo al Director. La enmienda desbloquea las fases de
**construcción**, no las de **decisión**.

Esto es deliberado: si el agente pudiera aceptar los ADR de los que depende para avanzar,
la condición 2 no sería una condición, sería un trámite que él mismo se firma.

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
