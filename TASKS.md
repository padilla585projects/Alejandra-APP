# TASKS — Cola operativa inmediata

Estado: contrato vacío. No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

## Reglas

- Crear una tarea solo cuando esté aprobada para ejecución o revisión inmediata.
- Una tarea activa tiene una única rama y responsable actual.
- Actualizar al iniciar, bloquear, relevar, revisar y completar.

## Plantilla

```text
ID:
Título:
Fase:
Estado: pendiente | lista | en curso | bloqueada | en revisión | aprobada | completada | cancelada
Prioridad:
Rama:
Responsable actual:
Objetivo:
Criterios de aceptación:
Dependencias:
Bloqueos:
Archivos principales:
Pruebas:
Última actualización:
Siguiente acción exacta:
```

## F-0.1 — Entrega segura

- ID: F-0.1
- Título: Separación segura de CI, despliegues, secretos y migraciones D1
- Fase: Fundación técnica
- Estado: en revisión
- Prioridad: P0
- Rama: `codex/foundation-close`
- Responsable actual: Codex
- Objetivo: separar validación, publicación, despliegues, migraciones D1 y configuración de secretos sin modificar producción.
- Criterios de aceptación: PR solo valida; push no altera producción; Workers y Pages se despliegan solo de forma explícita; migraciones y secretos son operaciones explícitas independientes; pruebas locales completas y documentación actualizada.
- Dependencias: protección y revisores del entorno GitHub `production`, protección de `main` y secretos de entorno, que requieren intervención con acceso administrativo.
- Bloqueos: no hay autenticación GitHub disponible para verificar o configurar controles remotos. No bloquea los cambios versionados.
- Archivos principales: `.github/workflows/`, `CLAUDE.md`, ADR-0001 y runbook de CI/CD/migraciones.
- Pruebas: YAML de los seis workflows válido; `node --check` válido para ambos Workers; 85/85 tests del agente superados; validación remota pendiente.
- Última actualización: 2026-08-01
- Siguiente acción exacta: revisar los commits de F-0.1, configurar controles remotos de GitHub y validar una PR sin desplegar.
