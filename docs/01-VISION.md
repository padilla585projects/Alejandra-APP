# Visión

Alejandra 2.0 aspira a ser el sistema operativo fiable para equipos de obra e instalaciones: un único lugar para operación de campo, gestión de oficina, documentación y asistencia contextual.

La plataforma actual ya cubre inventario, personal, documentación, calidad, planificación y comunicación. La siguiente etapa está consolidando un núcleo bien delimitado antes de añadir Marketplace, Skills, Plugins, MCP, agentes o capacidades cognitivas avanzadas: F-1.2 ya dispone de un esqueleto aislado, pero no está integrado en los Workers ni recibe tráfico real.

## Resultado buscado

- Operación diaria segura para empresas, obras y departamentos.
- Información trazable y accesible desde móvil y oficina.
- IA limitada por identidad, permisos, alcance de datos y registro auditable.
- Un código modular que permita evolucionar sin reescribir la aplicación.

## Estado de la evolución

- La entrega segura está activa: CI, despliegues, migraciones D1 y secretos se operan por flujos separados; integrar una PR no publica ni modifica datos.
- `nucleo-cognitivo/` implementa Estado Cognitivo efímero y Policy Engine, y define contratos para Context Engine, Planner, Motor de Decisión y Memory.
- Memory persistente, Nexo, Capability/Tool Registry, Verifier y QA siguen fuera del alcance implementado. Sus decisiones y dependencias se gobiernan mediante ADRs y el roadmap.

## Pendientes de producto

- `PENDIENTE`: métricas de éxito de negocio y usuarios objetivo priorizados.
- `PENDIENTE`: política de retención de datos y objetivos de disponibilidad.
- `PENDIENTE`: alcance comercial, soporte y modelo de licenciamiento de 2.0.
