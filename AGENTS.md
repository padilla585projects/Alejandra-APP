# Reglas obligatorias de contribución — Alejandra 2.0

Este archivo es de lectura obligatoria para cualquier IA, desarrollador o herramienta que cambie el repositorio.

## Filosofía

La continuidad, seguridad y trazabilidad prevalecen sobre la rapidez. Se evoluciona mediante cambios pequeños, reversibles y documentados. El repositorio y sus documentos vigentes son la única fuente de verdad; el historial de un chat nunca lo es.

## Flujo de trabajo

`ENGINEERING_WORKFLOW.md` es la fuente operativa única para inicio, alcance, relevo, ramas,
commits, PRs, fases y definición de terminado. Este archivo conserva únicamente las reglas
específicas de contribución, seguridad y calidad del repositorio.

## Reglas de ingeniería y calidad

- `worker.js` es el Worker web; `alejandra-agente/worker.js` es el Worker IA. Comparten D1 y R2.
- Todo acceso a datos debe autenticar, autorizar y limitar empresa, departamento y propiedad antes de operar.
- Las herramientas IA deben tener esquema validado, privilegio mínimo, trazabilidad y pruebas de rechazo.
- No duplicar reglas de negocio sin justificarlo; documentar una fuente de verdad temporal si aún no se puede extraer.
- Una migración D1 debe ser ordenada, revisable, idempotente cuando sea posible y contar con mitigación/rollback documentado.
- Los secretos no se leen, imprimen ni versionan. `.env.example` solo contiene marcadores.
- Mantener UTF-8 y no añadir archivos generados, credenciales o datos de producción al repositorio.

## Pruebas y revisión

- Ejecutar sintaxis de los Workers cuando se modifiquen.
- Ejecutar `npm --prefix alejandra-agente test` para cambios del agente, herramientas o sus políticas.
- Añadir pruebas unitarias de políticas y negativas de autorización ante cambios de seguridad.
- Explicar en la revisión: objetivo, alcance, riesgo, pruebas, rollback, documentación y elementos pendientes.

## Prohibiciones

- No desplegar, ejecutar migraciones remotas, alterar Cloudflare/D1/R2/GitHub ni modificar producción sin autorización explícita y runbook aprobado.
- No hacer refactors masivos, borrados no justificados ni cambios funcionales fuera de alcance.
- No inventar decisiones: marcar `PENDIENTE` y solicitar la aprobación necesaria.
- No usar el estado de un chat como sustituto de los documentos del repositorio.

## Definición de terminado

Aplicar la definición de terminado de `ENGINEERING_WORKFLOW.md`, además de las comprobaciones
específicas de este archivo.
