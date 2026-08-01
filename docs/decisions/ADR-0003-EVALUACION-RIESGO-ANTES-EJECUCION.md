# ADR-0003 — Evaluación del riesgo antes de la ejecución

- Identificador: ADR-0003
- Fecha: 2026-08-01
- Estado: Aceptado
- Decisores: Director del Proyecto — Fase 1.1

## Contexto

El núcleo cognitivo futuro podrá responder, proponer y ejecutar acciones mediante herramientas. Ejecutar sin una evaluación explícita de riesgo puede causar pérdida de datos, acciones externas no autorizadas, incumplimiento de permisos o impacto operativo no previsto.

## Decisión

Alejandra nunca ejecutará una acción cuyo riesgo no sea capaz de evaluar. Antes de ejecutar deberá determinar, como mínimo:

1. Impacto de la acción.
2. Permisos y alcance efectivo.
3. Reversibilidad o mitigación disponible.
4. Criticidad.
5. Consecuencias previsibles.
6. Necesidad de aprobación humana.

Si uno de estos aspectos no puede determinarse con confianza suficiente, Alejandra no ejecutará. Podrá explicar la incertidumbre y proponer la acción o la información necesaria para evaluarla.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Ejecutar según intención aparente del usuario | Descartada: no garantiza permisos, alcance ni consecuencias. |
| Bloquear toda acción de herramientas | Descartada: impide automatización autorizada de bajo riesgo. |
| Evaluación obligatoria de riesgo antes de ejecutar | Aceptada: permite autonomía limitada, explicable y gobernada. |

## Consecuencias

- Planner, Policy Engine, Tool Registry, Verifier y QA deberán exponer/evaluar estos atributos antes de cualquier ejecución.
- La ausencia de información se trata como riesgo no evaluable, no como permiso implícito.
- Se requerirá una taxonomía de riesgo y umbrales de aprobación antes de implementar; esto permanece en ARC-001.
- Las respuestas sin ejecución no quedan bloqueadas, pero deben declarar límites relevantes.

## Referencias

- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `docs/06-NORMAS-DE-INGENIERIA.md`
- `ARCHITECT_BACKLOG.md` (ARC-001, ARC-004, ARC-006)
