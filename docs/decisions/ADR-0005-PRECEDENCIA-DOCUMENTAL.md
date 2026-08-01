# ADR-0005 — Precedencia documental y normalización del Libro Maestro

- Identificador: ADR-0005
- Fecha: 2026-08-01
- Estado: Aceptado
- Decisores: Director del Proyecto
- Cierra: COH-001, ARC-009

## Contexto

La revisión de coherencia de Foundation v0.1 (`docs/architecture/06-REVISION-COHERENCIA-FOUNDATION-V0.1.md`)
registró COH-001: el «Libro Maestro del Proyecto» se declaraba fuente superior, pero no estaba
versionado en Git, mientras `ARCHITECT_RULES.md` establece que solo la documentación versionada
es oficial. No existía precedencia verificable dentro del repositorio.

Desde entonces el estado ha cambiado de forma material:

1. El contenido original quedó versionado en `docs/archive/LIBRO-MAESTRO-ORIGINAL.txt`.
2. Su contenido normativo se normalizó en `MASTER_PLAN.md`, declarado vigente.
3. `MASTER_PLAN.md` fijó una jerarquía explícita, y `docs/DOCUMENTATION-REGISTER.md` clasificó
   el original como «archivada de consulta».

La contradicción de fondo ya no es la ausencia de versionado, sino la falta de una decisión
formal que declare qué documento manda. Este ADR aporta esa decisión.

Existe además un caso concreto no cubierto: `CLAUDE.md` se carga automáticamente al inicio de
cada sesión de IA y contenía instrucciones operativas (despliegue, migración, versionado y
archivos de estado) que contradecían las reglas vigentes. Un documento que se inyecta por
defecto tiene precedencia de hecho aunque no la tenga de derecho.

## Decisión

**1. Jerarquía documental oficial**, de mayor a menor autoridad:

1. `MASTER_PLAN.md` — visión y principios
2. `MASTER_ROADMAP.md` — fases, dependencias y ejecución
3. ADRs en `docs/decisions/` — decisiones oficiales
4. Arquitectura y normas (`docs/`, `ARCHITECT_RULES.md`, `AGENTS.md`)
5. Código

Ante contradicción, se detiene el cambio y se resuelve mediante ADR. Ningún documento se
declara superior de forma aislada ni por antigüedad.

**2. El Libro Maestro original pierde autoridad normativa.** `docs/archive/LIBRO-MAESTRO-ORIGINAL.txt`
y `docs/archive/PLAN-EVOLUCION-ALEJANDRA-COMPLETO.md` se conservan íntegros como referencia de
trazabilidad. No son fuentes vigentes ni planes ejecutables. Su contenido normativo vive
exclusivamente en `MASTER_PLAN.md` y `MASTER_ROADMAP.md`.

**3. Ningún documento de contexto automático crea autoridad.** `CLAUDE.md`, `AGENTS.md` y
cualquier archivo que una herramienta cargue por defecto quedan subordinados a la jerarquía
anterior. Deben declarar explícitamente que no son fuente de verdad y no pueden contener
instrucciones que contradigan un ADR aceptado. Corregir `CLAUDE.md` en este sentido es parte
de la adopción de este ADR.

**4. La ambición transversal se declara horizonte, no alcance actual.** El Libro Maestro
proyecta una plataforma aplicable a cualquier empresa; `docs/00-MANIFIESTO.md` delimita el
producto presente a gestión industrial y de obra. Ambos son correctos en su plano: el primero
es visión a largo plazo, el segundo es alcance vigente. No es contradicción y no bloquea nada.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Mantener el Libro Maestro como fuente superior versionándolo tal cual | Descartada: su formato no permite revisión granular ni enlaza con ADRs; duplicaría la autoridad de `MASTER_PLAN.md`. |
| Eliminar el Libro Maestro tras normalizarlo | Descartada: destruye trazabilidad del origen del proyecto sin beneficio. |
| Archivar el original y normalizar su contenido en `MASTER_PLAN.md` | **Aceptada**: conserva trazabilidad, elimina la doble autoridad y hace la precedencia verificable dentro del repositorio. |

## Consecuencias

- COH-001 y ARC-009 quedan cerrados. Dejan de bloquear el desarrollo del Núcleo Cognitivo.
- `CLAUDE.md` debe corregirse y mantenerse subordinado; si vuelve a contradecir un ADR, es un
  defecto a corregir, no una fuente alternativa.
- Cualquier documento futuro cargado automáticamente por una herramienta hereda esta regla.
- No cambia código, infraestructura, datos ni producción.

## Adopción y rollback

Adopción: corregir `CLAUDE.md`, actualizar `06-REVISION-COHERENCIA-FOUNDATION-V0.1.md`,
`ARCHITECT_BACKLOG.md`, `PROJECT_STATE.md` y `docs/DOCUMENTATION-REGISTER.md`.

Rollback: sustituir esta decisión por un ADR posterior que declare otra jerarquía. Al ser una
decisión puramente documental, revertirla no afecta al servicio.

## Referencias

- `MASTER_PLAN.md`
- `ARCHITECT_RULES.md`
- `docs/architecture/06-REVISION-COHERENCIA-FOUNDATION-V0.1.md` (COH-001)
- `ARCHITECT_BACKLOG.md` (ARC-009)
- `docs/DOCUMENTATION-REGISTER.md`
