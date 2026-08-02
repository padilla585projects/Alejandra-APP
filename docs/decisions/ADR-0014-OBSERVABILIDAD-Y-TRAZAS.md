# ADR-0014 — Observabilidad y trazas

- Identificador: ADR-0014
- Fecha: 2026-08-02
- Estado: **Propuesto**
- Decisores: `PENDIENTE` (Director del Proyecto)
- Resuelve: ARC-008
- Desbloquea: que `nucleo-cognitivo/motor-decision.js` pueda registrar y consultar
  trazas reales (parte de F-1.2 en adelante); reincorporar healthchecks automáticos
  de despliegue (ver runbook `docs/runbooks/CI-CD-Y-MIGRACIONES.md`)

## Contexto

ARC-008 ("Observabilidad y métricas cognitivas", Pendiente, impacto Medio en
`ARCHITECT_BACKLOG.md`) agrupa dos problemas concretos, no uno abstracto:

**1. El Motor de Decisión exige la forma de la traza, pero no hay dónde guardarla.**
`nucleo-cognitivo/src/motor-decision.js` ya declara los campos obligatorios:

```js
export const CAMPOS_TRAZA_OBLIGATORIOS = Object.freeze([
  'decision', 'motivos', 'evidencia', 'confianza', 'riesgo', 'permisos_efectivos',
  'modo', 'criterio_salida',
]);
```

y `tieneTrazaSuficiente()` (motor-decision.js:38-41) valida estructuralmente que una
decisión traiga esos ocho campos. Pero el propio comentario del archivo (motor-decision.js:22-24)
dice que "ARC-008 (observabilidad) sigue abierto: esto fija la FORMA que debe tener una
decisión, no implementa su persistencia ni consulta real". `docs/architecture/04-MOTOR-DE-DECISION.md`
("Trazabilidad", línea 20) deja el formato/retención como `PREGUNTA ABIERTA` explícitamente, y
sus "Riesgos y preguntas abiertas" (línea 134) repiten: "QA independiente, trazas y métricas de
confianza siguen pendientes (ARC-004/ARC-008)". `decidir()` (motor-decision.js:47-52) ni siquiera
está implementada todavía — este ADR no depende de que lo esté, pero cualquier implementación
futura necesitará saber dónde escribir antes de poder registrar una sola decisión real.

**2. Ya hay una traza de producción que solo vive en logs efímeros.** ARC-013
(`ARCHITECT_BACKLOG.md`, "Corregido en código — pendiente de despliegue") introdujo `runDDL()`
y `ddlPaso()`, que **nunca lanzan** pero registran por `console.error` todo error de DDL que no
sea el duplicado esperado (41 llamadas en `worker.js`, 7 en `alejandra-agente/worker.js`, regla
de los dos cerebros de `CLAUDE.md`). El propio ítem lo dice: "El registro va a `console.error`:
visible en `wrangler tail` y Workers Logs, sin persistencia ni alerta — eso depende de ARC-008."
`wrangler tail` solo muestra logs mientras está conectado, y Workers Logs de Cloudflare tiene
retención acotada por el plan — ninguno de los dos es un lugar donde un humano o un futuro
Verifier pueda preguntar "¿qué `ALTER TABLE` falló la semana pasada?".

**3. `GET /health` no comprueba nada real, y eso ya costó algo concreto.** Ambos Workers
exponen un endpoint público sin efectos secundarios:

- `worker.js:4878` — `if (path === '/health' && method === 'GET') return json({ ok: true, ts: Date.now() });`
  No consulta D1 ni R2: respondería 200 con la base de datos caída.
- `alejandra-agente/worker.js:2516-2518` — devuelve flags de presencia de secretos
  (`web_search: !!env.OPENAI_API_KEY`, etc.) y un campo `version` **escrito a mano** (`'6.14'`),
  que la propia cabecera del archivo (líneas 8-13) documenta que ya se desincronizó una vez
  (v6.13 en la cabecera vs `6.12` en `/health`). Tampoco toca D1 ni R2.

El runbook `docs/runbooks/CI-CD-Y-MIGRACIONES.md` (líneas 24-42) ya documenta la consecuencia:
F-0.1 tuvo que **retirar los healthchecks automáticos de despliegue** porque un 200 de estos
endpoints "daría luz verde a un despliegue roto, que es peor que no comprobar nada", y fija
explícitamente que "reincorporar healthchecks automáticos requiere primero un endpoint de salud
que verifique dependencias reales (D1, R2 y bindings) y exponga la versión desplegada de forma
derivada, no escrita a mano. Registrado en ARC-008." Este ADR es esa decisión pendiente.

**Restricción de partida:** este documento no cambia código. `worker.js` y
`alejandra-agente/worker.js` no se tocan; `nucleo-cognitivo/` no se toca. Diseña el contrato de
persistencia, retención, consulta y el endpoint de salud para que, una vez aceptado, la
implementación (código de los dos workers + una migración D1 nueva) sea un trabajo aparte y
explícito, sujeto a las mismas barreras que cualquier cambio de esquema (`CLAUDE.md`, sección
"Qué requiere decisión humana": las migraciones contra D1 exigen decisión humana).

## Decisión

Se propone lo siguiente. Ninguna parte se aplica hasta que este ADR se acepte y, en el caso de
la tabla D1, hasta que además se ejecute la migración correspondiente por el workflow manual con
autorización explícita (`CLAUDE.md`).

### 1. Un almacén de trazas en D1, compartido por los dos Workers

D1 sobre KV, por dos motivos concretos:

- Las trazas necesitan filtrarse por `tenant`/`empresa`, `worker`, `tipo` y rango de fechas —
  consultas relacionales, no lecturas por clave. KV no ofrece eso sin mantener índices a mano.
- `CLAUDE.md` ya establece que los dos Workers "comparten BD D1" para la memoria de Alejandra;
  reutilizar el mismo D1 (`alejandra-db`) para trazas no añade un recurso nuevo que sincronizar,
  solo una tabla nueva en un sitio que ya comparten.

Esquema propuesto (a concretar en la migración, no en este ADR):

```sql
CREATE TABLE IF NOT EXISTS alejandra_trazas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  worker TEXT NOT NULL,              -- 'api' | 'agente'
  tipo TEXT NOT NULL,                -- 'decision' | 'ddl_error' | ... (extensible)
  empresa_id TEXT,                   -- aislamiento por tenant; NULL si no aplica (p.ej. DDL)
  usuario_id TEXT,
  resumen TEXT NOT NULL,             -- una línea legible, para listar sin parsear el JSON
  detalle_json TEXT NOT NULL         -- JSON con los campos específicos del tipo
);
CREATE INDEX IF NOT EXISTS idx_trazas_ts   ON alejandra_trazas(ts);
CREATE INDEX IF NOT EXISTS idx_trazas_tipo ON alejandra_trazas(tipo, ts);
```

`tipo` es un discriminador deliberado en vez de columnas separadas por caso de uso:

- `tipo = 'decision'` → `detalle_json` trae exactamente los ocho campos de
  `CAMPOS_TRAZA_OBLIGATORIOS` (`decision`, `motivos`, `evidencia`, `confianza`, `riesgo`,
  `permisos_efectivos`, `modo`, `criterio_salida`), sin transformarlos — la tabla no reinterpreta
  el contrato del Motor de Decisión, solo lo persiste tal cual.
- `tipo = 'ddl_error'` → `detalle_json` trae lo que hoy solo va a `console.error` en `runDDL()`/
  `ddlPaso()` (sentencia, tabla/columna afectada, mensaje de error, si era el paso de una
  migración o un `CREATE TABLE IF NOT EXISTS`/`ALTER TABLE` en caliente).

Esto responde a la pregunta del paso 5 del encargo: **sí, las trazas de ARC-013 necesitan un
destino persistente distinto de los logs efímeros de Cloudflare**, y es este mismo almacén, no
uno aparte — evita crear dos sistemas de trazas cuando uno con un discriminador basta.

### 2. Retención: 30 días en crudo, sin agregación automática en esta fase

D1 no es un almacén de logs de largo plazo (cuota de fila y de tamaño de base de datos del
plan de Cloudflare). Se propone:

- Purga por antigüedad: un paso más en el cron nocturno ya existente en `worker.js` que borra
  `DELETE FROM alejandra_trazas WHERE ts < datetime('now', '-30 days')`.
- Sin agregación/rollup automático en esta fase: agregar mal (medias sobre datos que ya no
  existen, por ejemplo) es peor que no agregar. Si en el futuro se necesita retención más larga
  para métricas, es una decisión aparte con su propio ADR, no una extensión silenciosa de este.
- 30 días es una propuesta de partida, no un valor probado: es una pregunta abierta para el
  Director (ver más abajo) si el volumen real de trazas (sobre todo `tipo='decision'` cuando el
  Motor de Decisión esté implementado) lo hace inviable antes de 30 días.

### 3. Consulta: un endpoint de solo lectura, no un panel nuevo

Se propone un endpoint `GET /admin/trazas` en cada Worker (mismo patrón que las rutas de
desarrollador existentes), con los mismos filtros de acceso que ya protegen las tools
`TOOLS_SOLO_DEV_VERIFICADO` (`alejandra-agente/lib.js`) y el chat dev de `worker.js`: exige
identidad de desarrollador verificada, nunca el cron. Parámetros: `tipo`, `worker`, `desde`,
`hasta`, `empresa_id`, `limit` (con tope máximo fijo en servidor, no solo por defecto). Devuelve
filas tal cual, sin agregación. Construir un dashboard visual sobre esto es trabajo aparte
(quedaría en `TASKS.md` si se acepta este ADR) — aquí solo se decide que la consulta existe y
por dónde se hace, no su interfaz visual.

### 4. El endpoint de salud real

`GET /health` pasa a comprobar dependencias reales, con presupuesto de tiempo acotado para no
convertir el healthcheck en un cuello de botella:

- **D1**: `SELECT 1` (o equivalente mínimo) contra el binding `DB`, con `AbortSignal.timeout()`
  corto (propuesta: 1500 ms).
- **R2**: una operación de lectura barata contra el binding correspondiente (`FILES` en
  `worker.js`, el que aplique en `alejandra-agente/worker.js`) — `head()` sobre una clave
  conocida y estable, no un `list()` completo del bucket. Mismo presupuesto de tiempo.
- **Versión**: derivada, no escrita a mano. Propuesta: inyectar el SHA corto de commit como
  variable en tiempo de build/despliegue (Cloudflare Workers soporta variables de compilación vía
  `wrangler`), de forma que el número que devuelve `/health` sea el mismo que aparece en
  `wrangler deployments list` — así se corrige la causa exacta del desajuste v6.13/`6.12` que ya
  documenta la cabecera de `alejandra-agente/worker.js` (líneas 8-13).
- **Respuesta**: `200` solo si D1 y R2 responden dentro del presupuesto; `503` con
  `{ ok: false, d1: bool, r2: bool, version }` si alguna falla o hace timeout. Sigue siendo
  público y sin efectos secundarios, igual que hoy — no se le añade autenticación ni escritura.
- Una vez desplegado este cambio en ambos Workers, `docs/runbooks/CI-CD-Y-MIGRACIONES.md` debe
  actualizarse para reincorporar el healthcheck automático post-despliegue que F-0.1 retiró, y
  la función `_checkearSaludPostDeploy()` de `worker.js` (que ya llama a `/health` tras un
  `propose_fix` aplicado, líneas 3861-3868) pasa a ser una verificación real en vez de comprobar
  solo que el Worker responde.

Esto es una decisión de diseño, no la implementación: cambiar `worker.js` y
`alejandra-agente/worker.js` para que `/health` haga estas comprobaciones es trabajo de código
posterior a la aceptación de este ADR, fuera del alcance de este documento.

### 5. El helper que necesita `motor-decision.js`, sin romper el aislamiento actual

Hoy `nucleo-cognitivo/` es deliberadamente un esqueleto sin I/O: `decidir()` lanza porque
Context Engine y Planner "siguen siendo interfaces sin implementar" (motor-decision.js:8-10), y
nada en el paquete escribe en D1. Ese aislamiento no debe romperse como efecto colateral de
resolver ARC-008.

Se propone que, cuando `decidir()` se implemente (fuera del alcance de este ADR), reciba una
dependencia inyectada `registrarTraza(decision)` — no que `motor-decision.js` importe un cliente
de D1 directamente. El contrato mínimo:

```js
/**
 * @param {object} decision - debe cumplir tieneTrazaSuficiente(decision)
 * @returns {Promise<void>}
 */
async function registrarTraza(decision) { /* implementación real, fuera del núcleo */ }
```

- `motor-decision.js` sigue sin saber si existe D1, KV o nada; solo exige, vía
  `tieneTrazaSuficiente()` (ya existente), que la decisión traiga los ocho campos antes de
  pasarla al helper.
- Cada Worker (`worker.js`, `alejandra-agente/worker.js`) implementa su propio
  `registrarTraza()` que escribe en `alejandra_trazas` con `tipo='decision'` — mismo patrón de
  "registro independiente por worker" que ADR-0010 ya adoptó para el catálogo de tools, por la
  misma razón de "dos cerebros".
- Hasta que este ADR se acepte y la migración se aplique, la única implementación válida de
  `registrarTraza()` es una que no persiste nada (no-op o `console.error`, igual que hoy) —
  ninguna implementación de esa dependencia puede escribir en D1 antes de que la tabla exista y
  el ADR esté aceptado.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Dejar las trazas solo en `console.error`/Workers Logs | Descartada: es el estado actual y es exactamente lo que ARC-008 y ARC-013 señalan como insuficiente — sin persistencia ni consulta estructurada, nadie puede auditar decisiones pasadas ni errores de DDL. |
| KV para las trazas | Descartada: las consultas necesarias son por rango de fecha, tipo y tenant — relacionales. KV obligaría a mantener índices secundarios a mano, más trabajo que usar el D1 que ya comparten los dos Workers. |
| Un almacén de trazas externo (servicio de logging de terceros) | Descartada por ahora: añade una dependencia y un coste nuevos para un problema que D1 ya resuelve a la escala actual del proyecto. No se descarta para el futuro si el volumen lo justifica, pero sería un ADR aparte. |
| Tabla separada por tipo de traza (`alejandra_trazas_decision`, `alejandra_trazas_ddl`, ...) | Descartada: multiplica migraciones y consultas por cada tipo nuevo de traza que aparezca. Una tabla con discriminador `tipo` y `detalle_json` cubre ambos casos de hoy y admite tipos futuros sin migración nueva. |
| Retención indefinida | Descartada: D1 tiene cuotas de tamaño por plan; retener todo para siempre es una promesa que no se puede sostener sin decidirlo explícitamente y con presupuesto. |
| Que `nucleo-cognitivo/motor-decision.js` escriba directamente en D1 | Descartada: rompería el aislamiento actual del esqueleto (sin I/O, sin bindings) y acoplaría el núcleo cognitivo a un Worker concreto antes de que Context Engine/Planner existan. La inyección de `registrarTraza()` mantiene la responsabilidad de persistencia fuera del núcleo. |
| `/health` autenticado o con más efectos secundarios | Descartada: el runbook exige que siga siendo público y sin efectos secundarios; el problema nunca fue el acceso, fue que no comprobaba nada real. |

## Consecuencias

**Si se acepta:**

- Hace falta una migración D1 nueva (tabla `alejandra_trazas`) por el workflow manual
  `Apply Alejandra Agent D1 migration`, con autorización explícita del Director — no autónoma,
  conforme a `CLAUDE.md`.
- `worker.js` y `alejandra-agente/worker.js` necesitan cambios de código: el nuevo `/health` real
  en los dos (regla de los dos cerebros), el endpoint `GET /admin/trazas` en los dos, y cambiar
  `runDDL()`/`ddlPaso()` (ARC-013) para que, además de `console.error`, escriban una fila
  `tipo='ddl_error'`. Cada uno es trabajo de implementación posterior, fuera de este ADR.
- El paso de purga por 30 días añade una operación más al cron nocturno; hay que verificar que
  no compite en tiempo con las tareas que ya corren ahí.
- Una vez desplegado el `/health` real, `docs/runbooks/CI-CD-Y-MIGRACIONES.md` debe actualizarse
  para reincorporar el healthcheck automático de despliegue que F-0.1 retiró — ese runbook cita
  explícitamente a este ADR (ARC-008) como condición.
- `nucleo-cognitivo/motor-decision.js` puede, cuando se implemente `decidir()`, registrar trazas
  reales vía el helper `registrarTraza()` sin haber roto su aislamiento actual mientras tanto.

**Si se rechaza o se pospone:**

- ARC-008 sigue abierto y sigue bloqueando que el Motor de Decisión tome decisiones con
  trazabilidad real, aunque `tieneTrazaSuficiente()` siga validando la forma.
- Los healthchecks automáticos de despliegue siguen retirados (el runbook ya lo documenta como
  la situación actual, no cambia nada respecto a hoy).
- Los errores de DDL de ARC-013 siguen visibles solo en `wrangler tail`/Workers Logs, sin
  persistencia ni forma de consultarlos después de que expiren.

## Preguntas que solo el Director puede responder

1. **¿Se acepta D1 (tabla `alejandra_trazas` compartida, discriminada por `tipo`) como destino de
   las trazas**, o se prefiere KV, un tercero, o tablas separadas por tipo?
2. **¿30 días de retención en crudo es razonable**, o hace falta un periodo distinto según el
   volumen real, sobre todo para `tipo='decision'` una vez que el Motor de Decisión esté activo?
3. **¿El endpoint `GET /admin/trazas` debe existir en los dos Workers desde el principio**, o
   basta con uno mientras el Motor de Decisión no esté implementado en ninguno de los dos?
4. **¿Se acepta el diseño de `/health` real (D1 + R2 con timeout corto, versión derivada del
   SHA de despliegue)**, o falta comprobar algo más antes de dar luz verde a un despliegue?
5. **¿Se autoriza ya la migración D1 de `alejandra_trazas`** en cuanto este ADR se acepte, o
   queda como una autorización aparte y posterior, igual que cualquier otra migración?

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-008, ARC-013, ARC-004, ARC-011
- `docs/architecture/04-MOTOR-DE-DECISION.md` — campos de traza obligatorios y preguntas
  abiertas de formato/retención
- `nucleo-cognitivo/src/motor-decision.js` — `CAMPOS_TRAZA_OBLIGATORIOS`, `tieneTrazaSuficiente()`
- `docs/runbooks/CI-CD-Y-MIGRACIONES.md` — retirada de healthchecks automáticos en F-0.1 y su
  condición de reincorporación
- `worker.js:4878` — `GET /health` actual (API)
- `worker.js:3861-3868` — `_checkearSaludPostDeploy()`, que hoy solo comprueba que el Worker
  responde, no que esté operativo
- `alejandra-agente/worker.js:2516-2518` — `GET /health` actual (agente), versión escrita a mano
- `docs/decisions/ADR-0004-MOTOR-DE-DECISION-Y-MODOS.md` — el contrato que exige la traza
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md` — niveles de riesgo N0-N3 citados
- `docs/decisions/ADR-0010-CATALOGO-DE-TOOLS-Y-MATRIZ-DE-PERMISOS.md` — precedente de "registro
  independiente por worker" por la regla de los dos cerebros
- `CLAUDE.md` — barrera humana sobre migraciones D1, y regla de "UNA Alejandra, DOS cerebros"
