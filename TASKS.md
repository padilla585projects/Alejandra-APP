# TASKS — Cola operativa inmediata

Estado: **una tarea activa** (F-0.1-R). No contiene tareas ficticias; `MASTER_ROADMAP.md` mantiene el plan global y `ARCHITECT_BACKLOG.md` mantiene deuda/propuestas.

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

## TAREA ACTIVA

### F-0.1-R — Activar y validar F-0.1 en GitHub remoto

- ID: F-0.1-R
- Título: Activar y validar F-0.1 en GitHub remoto mediante rama y PR segura
- Fase: Época 0 — Fundación y entrega segura
- Estado: lista
- Prioridad: P0
- Rama: `codex/foundation-close`
- Responsable actual: `PENDIENTE` — requiere acceso administrativo a GitHub
- Objetivo: que la separación de CI/CD implementada localmente pase a ser efectiva en producción, sin desplegar nada durante el proceso.
- Criterios de aceptación:
  1. Los 4 workflows antiguos desactivados manualmente **antes** de integrar.
  2. PR abierta que ejecute únicamente `ci.yml` y lo supere.
  3. Integración sin que se dispare ningún despliegue (verificado en la pestaña Actions).
  4. `main` protegida: PR obligatoria, `ci.yml` como check requerido, sin push directo.
  5. Entorno `production` creado con revisores requeridos.
  6. Secretos de Cloudflare movidos al entorno `production`.
  7. Ensayo con confirmación errónea: el job sale `skipped`, no ejecuta.
  8. Nada desplegado, migrado ni ningún secreto modificado durante la validación.
- Dependencias: acceso administrativo a GitHub (Settings, Environments, Branch protection).
- Bloqueos: ninguno técnico. El token disponible es de solo lectura para configuración; crear entornos y proteger ramas exige permisos de administración.
- Archivos principales: ninguno — es configuración remota y una PR. No requiere cambios de código.
- Pruebas: las de `ci.yml` en la PR, más la verificación de que ningún workflow de producción se ejecuta.
- Última actualización: 2026-08-02
- Siguiente acción exacta: desactivar manualmente los 4 workflows antiguos en Actions y abrir la PR de `codex/foundation-close` hacia `main`.

## Completadas — pendientes de aprobación

| ID | Título | Estado | Evidencia |
|---|---|---|---|
| F-0.1 | Separación de CI, despliegues, secretos y migraciones D1 | Implementada localmente; en revisión | `a59a2c5`, `6d5d98c`, `96417a5`, `cce5224`. Validada: 6/6 YAML, `node --check` ×2, 85/85 tests, 5/5 criterios de entrega segura. Auditoría remota de GitHub realizada. |
| GOV-001 | Consolidación del proceso operativo de ingeniería | Completada; en revisión | `f644a6b`. `ENGINEERING_WORKFLOW.md` como proceso único; `AGENTS.md` conserva solo reglas del repositorio y remite a él. |

La discrepancia de estado que GOV-001 dejó registrada en `MASTER_ROADMAP.md` quedó resuelta en la consolidación del 2026-08-02: el roadmap refleja ya ADR-0001/0002 aceptados, F-0.1 implementada localmente y la auditoría remota realizada.
