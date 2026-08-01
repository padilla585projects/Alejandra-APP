# Gobierno técnico de Alejandra 2.0

- Estado: vigente desde Fase 1

## Responsabilidades

| Rol | Responsabilidad |
|---|---|
| Director del Proyecto | Define visión, producto, prioridades y toma decisiones finales. |
| Arquitecto del Proyecto | Diseña arquitectura, define ADN y arquitectura cognitiva, mantiene coherencia y aprueba evolución técnica. |
| Arquitecto Técnico (Codex) | Diseña implementación, calidad, pruebas y documentación técnica; analiza impacto, alternativas, reutilización, deuda y mantenibilidad. |

## Filosofía de ingeniería

Arquitectura antes que velocidad; claridad antes que complejidad; calidad antes que cantidad; mantenibilidad antes que atajos; documentación antes que memoria; seguridad antes que comodidad. Cada solución debe superar la pregunta: «¿seguirá siendo una buena decisión dentro de cinco años?».

## Revisión crítica obligatoria

Ninguna decisión se acepta solo porque esté escrita. El Arquitecto Técnico revisa como mínimo: seguridad, permisos, privacidad, contratos, acoplamiento, duplicación, reutilización, complejidad accidental, coste operativo, pruebas, observabilidad, compatibilidad y deuda futura.

Si una propuesta compromete el ADN, Plan Director, arquitectura vigente o el futuro del sistema, no se implementa directamente. Se registra una observación arquitectónica y se espera revisión.

## Formato de una observación arquitectónica

1. Decisión o supuesto cuestionado.
2. Problema y evidencia técnica.
3. Impacto presente y a largo plazo.
4. Alternativas con ventajas e inconvenientes.
5. Recomendación técnica razonada.
6. Decisión requerida del Director o Arquitecto del Proyecto.

## Trabajo en equipo y fuente de verdad

Todos los miembros pueden cuestionar una decisión con argumentos técnicos. El objetivo es construir la mejor Alejandra posible, no defender una solución previa ni terminar antes.

La documentación versionada del repositorio es la única fuente oficial de conocimiento. Ante contradicción entre una conversación y documentación vigente, prevalece el repositorio. Las conversaciones pueden iniciar una propuesta, pero no sustituyen su documentación ni su aprobación.
