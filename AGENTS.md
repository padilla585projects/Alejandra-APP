# Reglas obligatorias de contribución — Alejandra 2.0

Este archivo es de lectura obligatoria para cualquier IA, desarrollador o herramienta que cambie el repositorio.

## Filosofía

La continuidad, seguridad y trazabilidad prevalecen sobre la rapidez. Se evoluciona mediante cambios pequeños, reversibles y documentados. El repositorio y sus documentos vigentes son la única fuente de verdad; el historial de un chat nunca lo es.

## Flujo de trabajo

1. Leer `START_HERE.md`, `PROJECT_STATE.md`, `HANDOFF.md` y la documentación del área.
2. Comprobar estado de Git y preservar cambios ajenos.
3. Definir alcance, riesgos, archivos, permisos y validaciones antes de editar.
4. Implementar una unidad coherente; no mezclar limpieza, seguridad y funcionalidades sin relación.
5. Ejecutar las pruebas pertinentes y registrar resultado, omisiones y motivo.
6. Actualizar `PROJECT_STATE.md`, `HANDOFF.md`, `CHANGELOG.md` y ADR/runbook/idea cuando corresponda.
7. Entregar para revisión. No continuar a una nueva fase sin autorización explícita.

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

Un trabajo termina solo cuando el alcance está completo, no rompe contratos conocidos, las pruebas acordadas están ejecutadas o justificadamente omitidas, riesgos/rollback están documentados, `PROJECT_STATE.md` y `HANDOFF.md` reflejan la realidad y la revisión requerida ha sido solicitada.
