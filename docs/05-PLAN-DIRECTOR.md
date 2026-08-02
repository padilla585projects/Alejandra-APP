# Plan director

## Estado de ejecución

La auditoría y preparación de Fase 0 están cerradas. La entrega segura está activa en remoto: CI, despliegues, migraciones D1 y secretos son operaciones separadas. El plan ejecutable vigente es `MASTER_ROADMAP.md`; `PROJECT_STATE.md` conserva el estado y los riesgos activos.

## Siguientes puertas de decisión

1. Completar ARC-011 fase 3: migrador por vertical, empezando por `checklists`; la aplicación contra D1 exige autorización humana.
2. Cerrar F-0.2-CFG trasladando secretos al entorno `production` cuando el Director facilite los valores.
3. Resolver ARC-014 para separar la aprobación del entorno de la credencial que inicia el despliegue.
4. Evolucionar F-1.2 únicamente dentro de los contratos y límites aceptados; el núcleo sigue aislado de producción.

No se autoriza por este documento la integración del núcleo en producción ni la implantación de Marketplace, Skills, Plugins, MCP, agentes, QA o capacidades adicionales; requieren la fase, el ADR y la autorización aplicables.
