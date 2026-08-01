# Handoff — Alejandra 2.0

- Fecha: 2026-08-02
- Agente que entrega: Codex, Arquitecto Técnico
- Tarea: GOV-001 — Engineering Workflow
- Estado: documentación creada; en revisión
- Rama: `codex/foundation-close` — sin push, sin merge
- Último commit de implementación: `96417a5` — correcciones finales de CI de F-0.1

## Objetivo realizado

Se creó `ENGINEERING_WORKFLOW.md` como procedimiento único de trabajo para cualquier Agente de Ingeniería del Proyecto Alejandra, sin depender del modelo utilizado y sin cambiar código, arquitectura o infraestructura.

## Cambios realizados

- Se consolidó el flujo obligatorio desde contexto hasta detención.
- Se definieron lectura inicial, relevo, ramas, commits, PRs, fases, plantilla de prompt y definición de terminado.
- Se asignó una fuente única a cada clase de norma para evitar duplicidad.
- `AGENTS.md` conserva reglas específicas del repositorio y remite al proceso operativo común.
- `START_HERE.md` y el registro documental enlazan el nuevo documento.

## Archivos modificados

- `ENGINEERING_WORKFLOW.md`
- `AGENTS.md`
- `START_HERE.md`
- `TASKS.md`
- `PROJECT_STATE.md`
- `HANDOFF.md`
- `CHANGELOG.md`
- `docs/DOCUMENTATION-REGISTER.md`

## Validación realizada

- Revisión de jerarquía y enlaces documentales.
- Revisión de solapamientos: proceso común en `ENGINEERING_WORKFLOW.md`; reglas específicas del repositorio en `AGENTS.md`; arquitectura en `ARCHITECT_RULES.md` y ADRs.
- No se modificaron archivos funcionales, workflows, secretos, infraestructura ni producción.

## Bloqueos y riesgos

- Se detectó una discrepancia histórica en `MASTER_ROADMAP.md`: algunas referencias siguen describiendo ADRs como propuestos y F-0.1 como riesgo activo, mientras `PROJECT_STATE.md`, `HANDOFF.md` y ADRs posteriores reflejan un estado más reciente. No se corrigió automáticamente por requerir una decisión documental explícita.
- F-0.1 sigue pendiente de validación remota y configuración de GitHub; GOV-001 no modifica ese alcance.

## Siguiente acción exacta

Revisar y aprobar `ENGINEERING_WORKFLOW.md`. Decidir mediante cambio documentado cómo normalizar las referencias históricas de estado en `MASTER_ROADMAP.md`; no iniciar una nueva fase ni ejecutar acciones remotas.

## No tocar sin nueva autorización

- No desplegar Pages ni Workers.
- No ejecutar migraciones D1 remotas, incluida la 008.
- No modificar secretos, bindings, Cloudflare, D1, R2 ni producción.
- No iniciar el Núcleo Cognitivo ni funcionalidades ajenas a tareas aprobadas.
