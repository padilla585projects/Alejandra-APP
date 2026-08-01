# Master Plan — Alejandra 2.0

- Versión: 1.0
- Estado: vigente
- Propósito: visión global y principios de producto/arquitectura

## Jerarquía documental aprobada

1. `MASTER_PLAN.md`: visión global y principios.
2. `MASTER_ROADMAP.md`: fases, dependencias y ejecución.
3. ADR: decisiones oficiales.
4. Arquitectura y normas: detalle especializado.
5. Código: implementación.

Si existe contradicción, se detiene el cambio y se resuelve mediante ADR. Ningún documento se declara superior de forma aislada.

## Qué es Alejandra

Alejandra es una Plataforma de Inteligencia Operativa Empresarial. Su propósito es comprender el contexto autorizado de una organización, colaborar con las personas, aportar criterio técnico y operativo, proponer acciones verificables y ejecutar solo acciones autorizadas.

No es únicamente un chatbot, un ERP ni una aplicación aislada. La IA, las herramientas, la memoria, el conocimiento y los modelos son componentes de una arquitectura que debe conservar identidad, seguridad y capacidad de evolución.

## Visión y misión

La visión es una compañera digital confiable que pueda incorporarse a organizaciones, comprender su documentación, procesos, herramientas y organización, y ayudar a las personas a trabajar mejor. La misión es generar valor continuo sin sacrificar rigor, permisos, privacidad ni control humano.

## Principios

- Pensar antes de actuar; comprender antes de responder; verificar antes de ejecutar.
- Ser útil y correcta antes que rápida o impresionante.
- Reconocer límites, incertidumbre y necesidad de ayuda.
- Separar conocimiento, memoria, estado temporal y evidencia.
- Mantener una identidad común con contexto y permisos específicos por empresa.
- Diseñar capacidades independientes, versionables, instalables y revocables sin acoplarlas al núcleo.
- Registrar decisiones, herramientas, acciones, errores, costes y tiempos relevantes.
- Aplicar seguridad, privacidad, RGPD, AI Act, trazabilidad y mínimo privilegio desde el diseño.
- Evolucionar mediante cambios pequeños, pruebas, rollback y documentación.

## Horizonte arquitectónico

El núcleo cognitivo incluirá componentes con responsabilidades independientes: Planner, Context Engine, NEXUS, Nexo, Memory, Policy Engine, Verifier, QA, Capability Registry, Tool Registry y Estado Cognitivo. Agentes, MCP, integraciones, plugins, skills y marketplace se desarrollarán solo cuando los registros, permisos, observabilidad y ADRs correspondientes los habiliten.

## Autoridad y evolución

El Director define visión y decisiones finales; el Arquitecto del Proyecto mantiene coherencia global; el Arquitecto Técnico analiza implementación, calidad, riesgos y alternativas. La memoria oficial reside en documentación versionada, no en chats, personas ni modelos.

El contenido histórico original se conserva en `docs/archive/LIBRO-MAESTRO-ORIGINAL.txt` como referencia de trazabilidad. Este documento normalizado es la referencia vigente.
