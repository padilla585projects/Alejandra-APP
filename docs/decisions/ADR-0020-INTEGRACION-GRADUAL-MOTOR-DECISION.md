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
- **Enmienda 1 — Rebanada 2 (2026-08-07):** el piloto se amplía a **todo el
  catálogo N0** del Worker (36 tools), no solo a `consultar_bd`. Análisis de
  trazas N0 (47 decisiones, todas de cron/`consultar_bd`) mostró que el mecanismo
  funciona pero solo se había ejercitado una tool. Se completa el metadato
  ADR-0010 de 4 tools que carecían de `nivel_riesgo`: `memory_read` (N0),
  `memory_save` (N1), `propose_mejora` (N1), `tomar_decision` (N2, puede
  auto-aplicar `agente_config`). `memory_save`/`propose_mejora`/`tomar_decision`
  se declaran `cron: 'prohibido'` (coherente con TOOLS_PROHIBIDAS_CRON) y
  `acceso: 'sesion'` (ya estaban en TOOLS_REQUIEREN_SESION). Se añade cobertura
  de test del catálogo N0 completo (aceptación + traza) y rechazo de N0 no
  ofrecida en `cognitive-core/test/contratos.test.js`.
- **Enmienda 2 — Rebanada 3 (2026-08-07):** se activan verificadores de lectura
  N1 bajo el Motor. `verifier.js` gana una implementación real de
  `registrarExplicabilidad()` (sin I/O): valida que una decisión trae
  razonamiento real (`motivos` no vacíos, `evidencia` con contenido), no solo
  campos presentes — salda la deuda que dejaba como stub desde 2026-08-02,
  apoyada en que F-4.1 (`registrarTraza()`, `GET /admin/trazas`) ya está en
  producción. `motor-decision.js` gana `decidirInvocacionN1Lectura()`, que
  exige además sesión autenticada y el nivel `explicabilidad` que
  `nivelesRequeridosPara('N1')` fija (ADR-0009).
  **Alcance deliberadamente estrecho:** de las 26 tools N1 del catálogo real,
  solo `verificar_deploy` es de solo lectura confirmada (su `case` únicamente
  consulta la API de GitHub Actions, sin `env.DB`/`env.R2` mutantes). El resto
  mezcla lectura y escritura por parámetro `accion` (`gestionar_tarea/rfi/oc/
  acta/calidad`) o escribe sin más — clasificarlas exige gobernar por
  invocación, no por tool, una decisión de diseño aparte que queda pendiente
  (ver `ARCHITECT_BACKLOG.md`, ARC-020). `TOOLS_N1_LECTURA_PILOTO` (`lib.js`)
  es la allowlist curada, hoy con un único elemento. N1 de escritura, N2 y N3
  no se tocan — siguen con sus gates actuales. 4 tests nuevos de contrato en
  `contratos.test.js`, 2 de `verifier.js` reescritos, 4 de wiring en
  `lib.test.js` (cognitive-core 42/42, cognitive-core-policy 4/4, agente
  172/172).
- **Enmienda 3 — Rebanada 4 (2026-08-07):** cierra los dos puntos que quedaban
  del alcance original de esta decisión.
  - **Punto 1, contexto seguro: declarado cumplido, sin código nuevo.** Ya
    satisfecho por trabajo previo no atado formalmente a esta rebanada:
    `SEC-CHAT-CONTEXTO-LEGACY` (2026-08-06) saca las tablas legacy globales del
    prompt; `memoria_consultar` es N0, aislada por `empresa_id` de sesión (nunca
    del input) y deja traza `memoria_consulta` en cada llamada.
  - **Punto 3, política determinista: implementada, alcance acotado.**
    `motor-decision.js` reutiliza `validarDeclaracionTool()` (`tool-registry.js`,
    ADR-0010) como comprobación estructural sin I/O: una tool candidata al
    piloto (N0 o N1 lectura) con `acceso`/`cron`/`nivel_riesgo` ausente o
    inválido se rechaza (`criterio_salida: 'metadato_invalido'`), en vez de
    asumirse disponible. El filtro de `nivel_riesgo` sigue yendo primero a
    propósito: una tool fuera del piloto no empieza a rechazarse por su
    metadato solo porque este ADR ahora lo valida — eso ampliaría el alcance
    sin decisión explícita. Punto 2 (decisión previa) y punto 4 (piloto N0) ya
    estaban resueltos desde la rebanada 1.
  - Tests: 3 nuevos de contrato (rechazo por metadato incompleto/inválido en
    N0 y N1 lectura), cognitive-core 45/45, agente 172/172 sin cambios (ningún
    tool real del catálogo pierde disponibilidad).
- **Enmienda 4 — Rebanada 5 (2026-08-07):** clasificación N1 POR INVOCACIÓN,
  no por tool. Auditados los `case` de las 6 tools CRUD compuestas
  (`gestionar_tarea/rfi/oc/acta/calidad`, `historico_materiales`):
  `listar`/`resumen`/`consultar`/`comparar` solo ejecutan `SELECT` (alguna con
  un `CREATE TABLE IF NOT EXISTS` idempotente de bootstrap, no escritura de
  negocio); el resto de acciones escribe. `esInvocacionN1DeLectura(toolName,
  input)` (`lib.js`) decide por invocación: tool entera en
  `TOOLS_N1_LECTURA_PILOTO` (`verificar_deploy`) o `input.accion` en la
  allowlist de lectura de esa tool (`ACCIONES_N1_LECTURA_POR_TOOL`) —
  fail-closed ante `accion` ausente, desconocida o tool no clasificada.
  `evaluarInvocacionCognitiva()` (`worker.js`) recibe ahora `input` y usa esta
  función en vez del chequeo estático anterior; los 3 call sites pasan
  `tb.input`. El resto del comportamiento de `decidirInvocacionN1Lectura()`
  (sesión, explicabilidad, metadato) no cambia — solo cambia qué invocaciones
  llegan a evaluarse. Tests: 6 nuevos (clasificación tool entera/acción de
  lectura/acción de escritura/fail-closed + auditoría automática de los 6
  `case` reales contra `ACCIONES_N1_LECTURA_POR_TOOL`), agente 177/177.
- Las rebanadas posteriores requerirán actualizar `TASKS.md`, `PROJECT_STATE.md`,
  `HANDOFF.md`, el backlog y esta decisión antes de ampliar alcance.
- El despliegue no está autorizado por este ADR; exige el runbook y verificación
  posterior aplicables.

## Referencias

- Auditoría de Alejandra Chat, 2026-08-06.
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `docs/architecture/04-MOTOR-DE-DECISION.md`
- `ADR-0003`, `ADR-0004`, `ADR-0006`, `ADR-0009`, `ADR-0010`, `ADR-0013`, `ADR-0014`.
