# ADR-0004 — Motor de Decisión y modos cognitivos v1.0

- Identificador: ADR-0004
- Fecha: 2026-08-01
- Estado: Propuesto
- Decisores: Director y Arquitecto del Proyecto — `PENDIENTE`

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

La implementación queda bloqueada hasta resolver ARC-001, ARC-003, ARC-004 y ARC-006 aplicables. Los modos no son permisos ni funcionalidades activas.

## Referencias

- `docs/architecture/04-MOTOR-DE-DECISION.md`
- ADR-0003
- `ARCHITECT_BACKLOG.md`
