# ADR-0020 — Integración gradual y aislada del Motor de Decisión

- Identificador: ADR-0020
- Fecha: 2026-08-06
- Estado: **Aceptado** (2026-08-06)
- Decisores: Director del Proyecto

## Contexto

La auditoría de Alejandra Chat del 2026-08-06 confirma que `nucleo-cognitivo/`
no recibe tráfico real: `Context Engine`, `Planner` y `Motor de Decisión` son
interfaces que fallan de forma explícita. El Worker IA conserva un bucle propio
de modelo → tool → resultado y reglas legacy repartidas.

La misma auditoría detectó un riesgo independiente: `buildAnthropicSystemBlocks()`
consultaba `alejandra_ram`, `alejandra_errores`, `alejandra_memoria`, logs e
historial sin empresa ni usuario y los insertaba como instrucciones de sistema.
El arreglo inmediato es fail-closed: esas fuentes no se incorporan al prompt.
No se modifica ni borra dato alguno.

`ADR-0003`, `ADR-0006`, `ADR-0009`, `ADR-0010`, `ADR-0013` y `ADR-0014` ya
fijan los controles necesarios para una activación gradual. Falta decidir el
contrato de adaptación y la primera rebanada que recibe tráfico.

## Decisión

Activar el núcleo solo mediante un adaptador en `alejandra-agente`, sin I/O
dentro de `nucleo-cognitivo/` y en cuatro rebanadas revisables:

1. **Contexto seguro.** El adaptador recibe identidad, empresa, departamento y
   rol ya autenticados. Solo puede construir contexto de fuentes con procedencia
   y filtros de tenant comprobables. La memoria gobernada se consulta como N0 y
   conserva su traza; las tablas legacy no vuelven al prompt implícitamente.
2. **Decisión previa.** Antes de ejecutar una tool, se crea una decisión
   estructurada con los ocho campos de `CAMPOS_TRAZA_OBLIGATORIOS`; se registra
   mediante la dependencia existente `registrarTraza()`.
3. **Política determinista.** La disponibilidad efectiva se calcula a partir
   del metadato de la tool, sesión y rol verificados. La ausencia de metadato,
   contexto o traza bloquea la ejecución.
4. **Piloto N0.** El primer tráfico real queda limitado a respuesta directa y
   tools N0 de lectura. N1/N2/N3 mantienen los gates actuales hasta tener sus
   verificadores y pruebas de rechazo específicas.

Quedan fuera: reescritura del Worker, modificación de datos/migraciones,
persistencia nueva, cambio de permisos, Nexo y activación de acciones N1-N3
mediante el Motor de Decisión.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Conectar todo el paquete al Worker de una vez | Descartada: mezcla cambios de contexto, memoria, planificación, trazas y ejecución sin un rollback evaluable. |
| Mantener el Worker legacy sin cambios | Descartada: conserva decisiones dispersas y no proporciona el comportamiento esperado. |
| Adaptador incremental con piloto N0 | Elegida: conserva gates probados, permite medir trazas y limita el radio de impacto. |

## Consecuencias

- El arreglo fail-closed reduce contexto disponible temporalmente, pero elimina la
  inyección automática de datos globales no gobernados.
- Cada rebanada exigirá pruebas unitarias y de integración negativas de tenant,
  rol, tool sin metadato, riesgo y ausencia de traza.
- La rebanada 1 queda autorizada: invocaciones N0 ofrecidas por el catálogo pasan
  por el Motor de Decisión y registran una traza estructurada antes de ejecutarse;
  una tool no ofrecida se rechaza. N1-N3 conservan sus gates actuales.
- Las rebanadas posteriores requerirán actualizar `TASKS.md`, `PROJECT_STATE.md`,
  `HANDOFF.md`, el backlog y esta decisión antes de ampliar alcance.
- El despliegue no está autorizado por este ADR; exige el runbook y verificación
  posterior aplicables.

## Referencias

- Auditoría de Alejandra Chat, 2026-08-06.
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `docs/architecture/04-MOTOR-DE-DECISION.md`
- `ADR-0003`, `ADR-0004`, `ADR-0006`, `ADR-0009`, `ADR-0010`, `ADR-0013`, `ADR-0014`.
