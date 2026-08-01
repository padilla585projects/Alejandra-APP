# ADR-0002 — Contrato del núcleo cognitivo v1.0

- Identificador: ADR-0002
- Fecha: 2026-08-01
- Estado: Aceptado como arquitectura objetivo; implementación bloqueada
- Decisores: Director del Proyecto
- Cierra: COH-002, ARC-010

## Contexto

La Fase 1 documenta un núcleo cognitivo objetivo formado por ciclo operativo, políticas, contexto, memoria, planificación, registros de capacidad/tools, verificación y QA. La implementación actual no contiene aún estos límites como componentes independientes.

## Decisión

Se adoptan `docs/02-ADN.md` y `docs/03-ARQUITECTURA-COGNITIVA.md` como **contrato de diseño v1.0**
para toda evolución futura del núcleo. Ninguna implementación puede contradecirlos: si aparece
una contradicción, se detiene el desarrollo y se resuelve mediante ADR.

La aceptación es de **arquitectura objetivo**, no de autorización para construir. La
implementación permanece **bloqueada** hasta que se resuelvan, mediante decisión documentada:

| Bloqueo | Registro | Desbloquea |
|---|---|---|
| Entrega segura (CI/CD, migraciones, secretos) | ARC-005 / ADR-0001 / fase F-0.1 | Cualquier cambio funcional |
| Evaluación de riesgo: taxonomía y umbrales | ARC-001 (ADR-0003 fija el principio, no los umbrales) | Policy Engine, ejecución de tools |
| Gobierno de memoria y conocimiento | ARC-002 | Memory, Context Engine |
| Definición de Nexo | ARC-003 | Coordinación entre módulos |
| QA y verificación independiente | ARC-004 | Verifier, QA |

Adicionalmente, el catálogo de tools y la matriz de permisos (ARC-006) condicionan cualquier
ejecución real. Levantar un bloqueo exige un ADR propio; ninguno decae por antigüedad.

Esta decisión cierra COH-002: el contrato cognitivo congelado es el de este ADR. La mención de
`docs/02-ADN.md` a una «Fase 1 aprobada por producto» debe leerse como aprobación del contrato
de diseño, no de su construcción.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Implementar directamente sobre NEXUS actual | Descartada: consolida acoplamiento y presupone decisiones pendientes. |
| Dejar el contrato en estado propuesto indefinidamente | Descartada: mantiene COH-002 abierto y bloquea incluso el diseño posterior sin aportar seguridad. |
| Aceptar el contrato y bloquear la implementación por dependencias explícitas | **Aceptada**: congela una referencia estable, permite avanzar en F-0.1 y hace verificable qué falta para construir. |
| Reescribir el agente completo | Descartada: riesgo elevado y contradice evolución incremental. |

## Consecuencias

- Existe una referencia versionada y estable contra la que revisar cualquier propuesta futura.
- La implementación del núcleo sigue pospuesta; el trabajo inmediato es F-0.1 (entrega segura).
- COH-002 y ARC-010 quedan cerrados; los bloqueos pasan a ser dependencias explícitas y
  auditables en lugar de una ambigüedad sobre el estado del contrato.
- Se reduce el riesgo de autonomía sin gobierno: aceptar el diseño no autoriza ejecución.
- No cambia código, infraestructura, datos ni producción.

## Referencias

- `docs/02-ADN.md`
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `ARCHITECT_BACKLOG.md`
- `docs/architecture/05-GOBIERNO-TECNICO.md`
