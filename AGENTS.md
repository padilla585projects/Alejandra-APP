# Reglas obligatorias de contribución — Alejandra 2.0

Este archivo es de lectura obligatoria para cualquier IA, desarrollador o herramienta que cambie el repositorio.

## Filosofía

La continuidad, seguridad y trazabilidad prevalecen sobre la rapidez. Se evoluciona mediante cambios pequeños, reversibles y documentados. La regla de autonomía y de contexto vive exclusivamente en `ENGINEERING_WORKFLOW.md`; el historial de un chat nunca sustituye la documentación del repositorio.

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

- **Autonomía: ver ADR-0007**, que es la fuente única. En resumen: el código es reversible y el agente actúa solo (ramas, commits, push, PR, merge con CI en verde, pruebas, despliegue de Workers y encadenar tareas ya aprobadas). Los datos no lo son y exigen decisión humana: **migraciones D1, secretos, `DELETE`/`DROP`/`TRUNCATE`/`UPDATE` masivo y borrado en R2**. Abrir una **fase nueva** sí es autónomo si todas sus dependencias están cerradas y sus ADR aceptados (ADR-0007, enmienda 1); **aceptar** un ADR nunca lo es.
- Todo despliegue autónomo exige verificación posterior registrada. Desplegar sin comprobar no es autonomía.
- No hacer refactors masivos, borrados no justificados ni cambios funcionales fuera de alcance.
- No inventar decisiones: marcar `PENDIENTE` y solicitar la aprobación necesaria.
- No usar el estado de un chat como sustituto de los documentos del repositorio.

## Definición de terminado

Aplicar la definición de terminado de `ENGINEERING_WORKFLOW.md`, además de las comprobaciones
específicas de este archivo.
