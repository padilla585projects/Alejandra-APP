# ADR-0002 — Contrato del núcleo cognitivo v1.0

- Identificador: ADR-0002
- Fecha: 2026-08-01
- Estado: Propuesto
- Decisores: Arquitecto del Proyecto y Director del Proyecto — `PENDIENTE`

## Contexto

La Fase 1 documenta un núcleo cognitivo objetivo formado por ciclo operativo, políticas, contexto, memoria, planificación, registros de capacidad/tools, verificación y QA. La implementación actual no contiene aún estos límites como componentes independientes.

## Decisión propuesta

Adoptar `docs/02-ADN.md` y `docs/03-ARQUITECTURA-COGNITIVA.md` como contrato de diseño v1.0 para toda evolución futura del núcleo. La implementación quedará bloqueada hasta resolver las preguntas abiertas de riesgo, memoria, Nexo, QA y trazas.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Implementar directamente sobre NEXUS actual | Descartada: consolida acoplamiento y presupone decisiones pendientes. |
| Documentar primero contrato y preguntas abiertas | Propuesta: permite revisión, trazabilidad y extracción incremental. |
| Reescribir el agente completo | Descartada: riesgo elevado y contradice evolución incremental. |

## Consecuencias

Pospone implementación de capacidades del núcleo hasta aprobación. Reduce riesgo de autonomía sin gobierno y crea un punto de referencia versionado. Exige ADRs adicionales para los ítems críticos de `ARCHITECT_BACKLOG.md`.

## Referencias

- `docs/02-ADN.md`
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `ARCHITECT_BACKLOG.md`
- `docs/architecture/05-GOBIERNO-TECNICO.md`
