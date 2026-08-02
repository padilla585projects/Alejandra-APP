# ADR-0004 — Motor de Decisión y modos cognitivos v1.0

- Identificador: ADR-0004
- Fecha: 2026-08-01
- Estado: **Aceptado como arquitectura objetivo** (2026-08-02); implementación acotada — ver Decisión
- Decisores: Director del Proyecto

## Contexto

El Núcleo Cognitivo necesita un punto central que determine rutas de decisión antes de definir o ejecutar capacidades especializadas.

## Decisión propuesta

Adoptar `docs/architecture/04-MOTOR-DE-DECISION.md` como diseño v1.0: un Motor de Decisión que coordina modos cognitivos y rutas controladas, sin ejecutar, conceder permisos ni sustituir políticas/verificación/QA.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Decisiones repartidas en cada módulo | Descartada: duplica políticas y dificulta trazabilidad. |
| Motor central con bypass de permisos | Descartada: contradice ADR-0003 y arquitectura cognitiva. |
| Motor coordinador con componentes especializados | Propuesta: separa responsabilidades y permite evolución incremental. |

## Consecuencias

~~La implementación queda bloqueada hasta resolver ARC-001, ARC-003, ARC-004 y ARC-006 aplicables.~~
Los cuatro quedaron resueltos el 2026-08-02 por ADR-0006, ADR-0008, ADR-0009 y ADR-0010. Los
modos no son permisos ni funcionalidades activas.

## Decisión (2026-08-02)

El Director acepta `docs/architecture/04-MOTOR-DE-DECISION.md` como arquitectura objetivo v1.0
del Motor de Decisión, coherente con lo ya fijado por ADR-0002 para el resto del núcleo
cognitivo. Con esto queda cerrada **F-1.1**.

La aceptación autoriza construir **el esqueleto, los contratos y las interfaces** del núcleo
cognitivo — no su activación en producción. Explícitamente, mientras no se resuelvan las
dependencias pendientes:

- **No se activa memoria persistente sensible.** ARC-002 (gobierno de memoria: privacidad,
  procedencia, caducidad, borrado) sigue sin ADR. Cualquier componente de Memory se queda en
  interfaz, sin almacenamiento real.
- **Ninguna decisión se toma sin trazabilidad suficiente.** ARC-008 (observabilidad/trazas)
  sigue abierto — el nivel «Explicabilidad» de ADR-0009 sigue siendo deuda hasta F-4.1. El
  contrato del Motor de Decisión debe exigir, en su propia forma de datos, los campos de traza
  que ya fija `04-MOTOR-DE-DECISION.md` (decisión, motivos, evidencia, confianza, riesgo,
  permisos efectivos, modo, criterio de salida), aunque su persistencia real no exista todavía.
- **Las 5 «Decisiones abiertas» del documento** (selección de modo, umbrales de confianza por
  modo/acción, precedencia entre modos, activación de Emergencia, contrato de
  `activar_colaboracion`) quedan explícitamente sin resolver, para decidirlas con el contexto
  concreto que aparezca al construir F-1.2, no en abstracto ahora.

Alcance de F-1.2 según `MASTER_ROADMAP.md`: Estado Cognitivo, Planner, Context Engine y Policy
Engine. Quedan **fuera** de esta fase — no se construyen ahora — Memory, Nexo, Capability/Tool
Registry, Verifier y QA: pertenecen a F-1.3 y F-2.1/F-2.2, fases que no están abiertas.

## Referencias

- `docs/architecture/04-MOTOR-DE-DECISION.md`
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- ADR-0002 (contrato del núcleo cognitivo), ADR-0003, ADR-0006, ADR-0008, ADR-0009, ADR-0010
- `ARCHITECT_BACKLOG.md`
- `MASTER_ROADMAP.md` — F-1.1, F-1.2
