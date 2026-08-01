# Reglas del Arquitecto

- Versión: 1.0
- Estado: Activo

## Objetivo y principio fundamental

Estas reglas definen cómo se toman, documentan y mantienen las decisiones de arquitectura de Alejandra. La arquitectura reside exclusivamente en la documentación versionada del repositorio: nunca en la memoria de las personas, el historial de un chat o un modelo de IA.

## Reglas

1. Toda decisión importante termina documentada; si no lo está, no existe oficialmente.
2. Los prompts son instrucciones temporales, nunca fuente de verdad; prevalece la documentación oficial.
3. Una fase aprobada queda congelada. Las mejoras posteriores se registran en `ARCHITECT_BACKLOG.md` y se estudian en su fase.
4. Antes de una fase se revisan `START_HERE.md`, `PROJECT_STATE.md`, `ARCHITECT_BACKLOG.md`, ADRs pendientes y `HANDOFF.md`.
5. Toda decisión arquitectónica importante genera un ADR como referencia oficial.
6. Todo cambio arquitectónico actualiza estado, backlog, changelog, ADRs y handoff cuando proceda.
7. Ninguna implementación puede contradecir Manifiesto, ADN, Plan Director, Arquitectura Cognitiva o Arquitectura Técnica. Una contradicción detiene el desarrollo.
8. Toda propuesta se clasifica como `Idea`, `Investigación`, `Pendiente`, `Planificada`, `Aprobada`, `En desarrollo`, `Finalizada` o `Descartada` antes de implementarse.
9. La documentación es parte del código: un cambio arquitectónico sin documentación no está terminado.
10. Las decisiones justifican qué, por qué, alternativas, impacto y riesgos.
11. Toda IA actúa con pensamiento crítico: documenta una alternativa superior y espera aprobación antes de aplicarla.
12. Director del Proyecto, Arquitecto del Proyecto y Arquitecto Técnico tienen responsabilidades diferenciadas; las decisiones se fundamentan en argumentos técnicos, no autoridad.
13. Cada decisión responde: «¿seguirá siendo una buena decisión dentro de cinco años?». Si no, se busca alternativa.
14. La arquitectura no optimiza solo el presente: debe facilitar mantenimiento, escalabilidad, modularidad, observabilidad, seguridad y evolución.
15. Antes de cerrar una fase se actualizan `START_HERE.md`, `PROJECT_STATE.md`, `ARCHITECT_BACKLOG.md`, `CHANGELOG.md`, `HANDOFF.md`, ADRs correspondientes y `docs/DOCUMENTATION-REGISTER.md`.

## Filosofía final

Alejandra es una plataforma de inteligencia operativa que debe poder evolucionar durante muchos años. Cada decisión debe acercarla a ese objetivo.
