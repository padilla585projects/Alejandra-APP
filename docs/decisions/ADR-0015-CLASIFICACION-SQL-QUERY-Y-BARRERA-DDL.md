# ADR-0015 — Clasificación de riesgo de `sql_query` y barrera humana para DDL no destructivo

- Identificador: ADR-0015
- Fecha: 2026-08-04
- Estado: **Aceptado (2026-08-04)**
- Decisores: Director del Proyecto
- Resuelve: ARC-019

## Por qué existe este documento

ARC-019 quedó anotado el 2026-08-02, durante `F-1.3-MIGRAR-RESTO-TOOLS`, como pregunta abierta
sin resolver: `sql_query` (`worker.js`, chat dev/Telegram) acepta DDL completo
(`CREATE`/`ALTER`/`DROP`), no solo DML, bajo la misma barrera humana que `run_migration`
(`CONFIRMO BORRADO <código>`). Pero ADR-0006 saca explícitamente `run_migration` del alcance
autónomo del agente, clasificándolo **N3** ("capacidad administrativa, sujeta a autorización
explícita en cada uso... no es una decisión que Alejandra pueda tomar por su cuenta en ningún
caso"), mientras que `sql_query` quedó clasificado **N2** en `F-1.3-MIGRAR-RESTO-TOOLS`, sin que
ningún ADR revisara esa diferencia.

Al releer el código para este ADR apareció un segundo hallazgo, más importante que la etiqueta:
**ninguna de las dos tools exige confirmación humana para `CREATE TABLE` ni `CREATE INDEX`.**
`detectarSqlDestructivo()` (`worker.js:1523-1525`) solo activa la barrera
`exigirConfirmacionHumana()` ante `DROP`/`TRUNCATE`/`ALTER TABLE` o `DELETE`/`UPDATE`:

```js
function detectarSqlDestructivo(sql) {
  if (/^\s*(DROP|TRUNCATE|ALTER\s+TABLE)\b/i.test(sql)) return 'DROP/TRUNCATE/ALTER TABLE';
  // ... WHERE trivialmente-cierto para DELETE/UPDATE ...
}
```

Un `CREATE TABLE IF NOT EXISTS` o `CREATE INDEX` vía `run_migration` o `sql_query` se ejecuta
**sin ninguna barrera**, ni siquiera la de `CONFIRMO BORRADO`. Eso significa que, en el código
tal como está hoy, la frase de ADR-0006 sobre `run_migration` ("no es una decisión que Alejandra
pueda tomar por su cuenta en ningún caso") no se cumple para el caso concreto de crear una tabla
o un índice nuevos: solo hace falta que `ctx.dev===true` (acceso `dev_verificado`, ver
`TOOLS_SOLO_DEV_AITOOL`), la misma barrera de *quién* puede invocar la tool, no de *si cada uso*
requiere autorización explícita.

Este documento no decide nada por sí mismo. Presenta el estado real del código, para que el
Director apruebe, corrija o rechace.

## Contexto: qué puede hacer hoy cada tool

| | `sql_query` | `run_migration` |
|---|---|---|
| Alcance SQL | Libre: `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP` | DDL: `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, `CREATE INDEX`, admite varias sentencias por `;` |
| Acceso | `TOOLS_SOLO_DEV_AITOOL` (`ctx.dev===true`, chat dev/Telegram) | Igual |
| Barrera para `DROP`/`TRUNCATE`/`ALTER TABLE` | `CONFIRMO BORRADO <código>` | Igual (mismo `detectarSqlDestructivo()`) |
| Barrera para `CREATE TABLE`/`CREATE INDEX` | **Ninguna** | **Ninguna** |
| Barrera para `DELETE`/`UPDATE` (incluso con `WHERE`) | `CONFIRMO BORRADO <código>` | No aplica (DDL, no DML) |
| `nivel_riesgo` declarado (ADR-0010) | N2 | N3 |

Dos observaciones:

1. **La diferencia de nivel declarado (N2 vs N3) no se traduce en ninguna diferencia de
   comportamiento.** Ambas tools usan exactamente el mismo `detectarSqlDestructivo()` y el mismo
   `exigirConfirmacionHumana()`. El metadato de ADR-0010 es hoy documental, no ejecutable, para
   este caso concreto — algo que ADR-0006 ya advertía en general ("`run_migration` queda
   pendiente de que su gating en código refleje esta clasificación").
2. **El caso más común de migración —crear una tabla nueva— es precisamente el que no tiene
   barrera.** Las 14 migraciones de ARC-011 fase 3 fueron siempre `CREATE TABLE IF NOT EXISTS`,
   nunca `DROP`/`ALTER`. Si `run_migration` se hubiera usado para ellas en vez del workflow
   manual, ninguna habría pedido confirmación.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Dejar `sql_query` en N2 y no tocar nada | Descartada como respuesta completa: no resuelve que `CREATE TABLE`/`CREATE INDEX` no tengan barrera en ninguna de las dos tools, que es el hallazgo con más impacto real. |
| Subir `sql_query` a N3 (igual que `run_migration`), sin cambiar la barrera de `CREATE`/`ALTER`/`DROP` | Resuelve la inconsistencia de *etiqueta*, no la de *comportamiento*: ambas seguirían sin pedir confirmación para crear tablas. |
| Extender `detectarSqlDestructivo()` para que también capture `CREATE TABLE`/`CREATE INDEX`, exigiendo `CONFIRMO BORRADO` (o una frase equivalente, no necesariamente la misma) antes de ejecutar cualquier DDL, en las dos tools | Resuelve el comportamiento real: ninguna DDL —destructiva o no— se ejecutaría sin que un humano la confirme explícitamente, cumpliendo lo que ADR-0006 ya exige para `run_migration`. Coste: DDL legítimo y frecuente (crear una tabla nueva) pasa a requerir confirmación, más fricción para el propio Adrián en el chat dev. |
| Restringir `run_migration`/DDL de `sql_query` a exigir siempre autorización de una vía distinta al propio chat (p. ej. solo mediante el workflow `Apply D1 migration (manual)`, retirando la capacidad DDL de ambas tools) | Alinea el código con la intención original de ADR-0011 (migrador único). Coste: pierde la utilidad que motivó tener `run_migration` en el catálogo — migraciones rápidas sin pasar por `wrangler`/CI. |

Ninguna alternativa se ha aplicado. Este ADR no cambia comportamiento por sí mismo.

## Consecuencias (si se acepta alguna variante que exija barrera para `CREATE`)

- Cambio de comportamiento observable: crear una tabla o índice vía `run_migration`/`sql_query`
  pasaría a exigir que un humano teclee una confirmación, igual que hoy ocurre con
  `DROP`/`ALTER`/`DELETE`/`UPDATE`.
- Requiere pruebas negativas nuevas en el catálogo del `worker.js` raíz (no tiene suite de tests
  dedicada hoy, a diferencia de `alejandra-agente`, que sí las tiene para su patrón equivalente).
- Ninguna migración real pendiente depende de que `CREATE TABLE` siga sin barrera: las 14
  verticales de ARC-011 fase 3 se aplicaron por el workflow manual, no por `run_migration`.
- Si se decide no tocar el código, debe quedar registrado explícitamente que la frase de
  ADR-0006 ("no es una decisión que Alejandra pueda tomar por su cuenta en ningún caso") se
  interpreta como cubierta por el gate `ctx.dev===true`, no por una confirmación por uso — una
  lectura distinta a la que el propio ADR-0006 parece dar a entender.

## Decisión del Director (2026-08-04)

Las cuatro preguntas se resolvieron así, en el mismo orden:

1. **`sql_query` sube a N3**, igual que `run_migration` — misma capacidad de alterar el esquema,
   misma clasificación.
2. **Se extiende la barrera humana a `CREATE TABLE`/`CREATE INDEX`** en las dos tools. La
   protección N3 deja de ser solo "quién puede invocarla" — pasa a ser también "cada uso
   individual", igual que ya regía para `DROP`/`TRUNCATE`/`ALTER`/`DELETE`/`UPDATE`.
3. **Frase distinta**: `CONFIRMO MIGRACION <código>`, para no mezclar "esto borra datos" con
   "esto crea una tabla" en la cabeza del humano que confirma.
4. **Alcance ampliado a `alejandra-agente`.**

## Implementación (2026-08-04)

**`worker.js` raíz** (`sql_query`, `run_migration`):

- `sql_query` pasa de `nivel_riesgo:'N2'` a `'N3'`.
- Nueva función `detectarSqlCreacion(sql)` (`worker.js:1521-1528`), compartida por las dos
  tools, análoga a `detectarSqlDestructivo()`: detecta `CREATE TABLE`/`CREATE INDEX`/`CREATE
  UNIQUE INDEX` al inicio de la sentencia.
- Nueva constante `FRASE_CONFIRMACION_MIGRACION = 'CONFIRMO MIGRACION'`, junto a la ya existente
  `FRASE_CONFIRMACION_DESTRUCTIVA = 'CONFIRMO BORRADO'`.
- `extraerCodigosConfirmacion(mensajeHumano, frase)` generalizada para aceptar cualquier frase
  (antes hardcodeaba `CONFIRMO BORRADO`); construye el regex escapando la frase dada. Verificado
  a mano que las dos frases no se cruzan: un código confirmado con `CONFIRMO BORRADO` no
  autoriza una operación que pide `CONFIRMO MIGRACION`, y viceversa.
- `exigirConfirmacionHumana(ctx, descriptor, motivo, efecto, frase)` acepta ahora qué frase
  exigir; según la frase, consulta `ctx.codigosConfirmados` (destructivo, comportamiento
  anterior sin cambios) o `ctx.codigosConfirmadosMigracion` (nuevo, para `CREATE`).
- Los dos puntos de entrada del bucle de tool-use (chat dev del panel y Telegram, únicos
  canales que llegan a `executeAITool` con `dev:true`) construyen ahora también
  `codigosConfirmadosMigracion` a partir del mensaje real del humano.
- `sql_query` y `run_migration` comprueban `detectarSqlCreacion()` además de
  `detectarSqlDestructivo()`; si hay creación sin confirmar, bloquean con la frase
  `CONFIRMO MIGRACION`. `ALTER TABLE` sigue cubierto por la barrera destructiva existente (sin
  cambios) — el hueco real era solo `CREATE TABLE`/`CREATE INDEX`.
- Verificado con casos manuales (`CREATE TABLE`, `CREATE INDEX`, `CREATE UNIQUE INDEX`,
  `ALTER TABLE`, `SELECT`, `INSERT`, `DROP TABLE`): cada sentencia activa exactamente la barrera
  esperada, ninguna se cuela sin barrera. `node --check worker.js` limpio. Sin suite de tests
  dedicada para `worker.js` raíz (mismo patrón documentado ya en `F-1.3-MIGRAR-RESTO-TOOLS` para
  `esDeveloperAgente()`).

**`alejandra-agente`** (alcance ampliado, punto 4): revisado el catálogo completo en busca del
mismo tipo de brecha (escritura amplia sin barrera para DDL no destructivo):

- `escribir_bd` (`alejandra-agente/worker.js:7328-7361`) **no tiene la brecha**: rechaza
  explícitamente `DROP`/`ALTER`/`TRUNCATE` (línea 7331) y solo permite sentencias que empiecen
  por `INSERT`/`UPDATE`/`DELETE`/`REPLACE` (línea 7337) — `CREATE` no está en esa lista blanca,
  así que ya se rechaza de raíz, no solo sin barrera.
- `consultar_bd`, `configurar_alerta` y la rama `custom` de `exportar_datos` pasan por
  `validarSoloSelectBD()` — solo `SELECT`, sin capacidad de escritura ni DDL.
- Ningún otro tool del catálogo de `alejandra-agente` ejecuta SQL arbitrario procedente del
  input del modelo; los `CREATE TABLE`/`CREATE INDEX` que aparecen en el archivo son DDL interno
  de migración (`ensureXxxTable()`, `runMigrations()`), no alcanzable desde ningún `tool_input`.
- **Conclusión: no hay cambio de código en `alejandra-agente`** — la revisión confirma que no
  existe la brecha, no que se decidiera ignorarla.

## Referencias

- ADR-0006 (matriz de riesgo) — origen de la clasificación N3 de `run_migration` que este ADR
  contrasta con el código real
- ADR-0010 (catálogo de tools) — origen del metadato `nivel_riesgo` que hoy no se traduce en
  comportamiento distinto entre N2 y N3 para este caso
- ADR-0011 (migrador único) — alternativa de restringir DDL fuera del chat, alineada con su
  estrategia de un único mecanismo de migración
- `ARCHITECT_BACKLOG.md`, ARC-019 — hallazgo original (2026-08-02), sin resolver hasta este ADR
- `worker.js:1521-1544` (`detectarSqlDestructivo`, `exigirConfirmacionHumana`), `worker.js:1583-1612`
  (`sql_query`), `worker.js:2287-2318` (`run_migration`)
