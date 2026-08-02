# ADR-0006 — Matriz de riesgo y aprobación humana

- Identificador: ADR-0006
- Fecha: 2026-08-02
- Estado: **Aceptado** (2026-08-02)
- Decisores: Director del Proyecto
- Resuelve: ARC-001
- Desbloquea: ADR-0004 y, con él, F-1.1 y toda la Época 1

## Por qué existe este documento

ADR-0003 fijó que toda acción debe evaluarse antes de ejecutarse, pero no dijo **con qué
umbrales, quién aprueba, ni sobre qué catálogo de acciones**. Sin eso, «evaluar el riesgo»
no es verificable: cada módulo lo interpreta a su manera y no hay forma de comprobar en una
revisión si una acción se clasificó bien.

ARC-001 lleva abierto desde entonces y bloquea ADR-0004, que a su vez bloquea F-1.1 y con
ella toda la Época 1. Es el primer dominó: mientras no se decida, el Núcleo Cognitivo no
puede empezar por gobernanza, no por falta de diseño.

Este ADR **no decide nada por sí mismo**. Presenta el catálogo real de acciones que hoy
puede ejecutar Alejandra y propone una clasificación, para que el Director apruebe,
corrija o rechace. Las preguntas abiertas están al final.

## Contexto: qué puede hacer hoy Alejandra

No es un ejercicio teórico. Estas son las capacidades que ya existen en producción:

| Capacidad | Dónde | Barrera actual |
|---|---|---|
| `escribir_bd` | `alejandra-agente` (app móvil, panel oficina, panel standalone) | ⚖️ Equilibrada (SEC-09) |
| `sql_query` | `worker.js` (chat dev y Telegram) | 🔒 Estricta (SEC-08) |
| `run_migration` | `worker.js` | 🔒 Estricta — **puede crear tablas y columnas en caliente** |
| `propose_fix` | `worker.js` | Propone cambios de código, no los aplica |
| Cron nocturno | `worker.js` | Se ejecuta sin intervención humana |
| Envío por Telegram | `worker.js` | Sale de la organización |

Dos observaciones que condicionan cualquier matriz:

1. **`run_migration` es una vía de divergencia del esquema** que ARC-011 no llegó a
   analizar. Alejandra puede alterar el esquema por decisión propia, y ninguna de las 27
   tablas huérfanas tiene autor conocido: pudieron salir de ahí.
2. **El cron nocturno actúa sin humano delante.** Cualquier umbral que dependa de «pedir
   confirmación» no le aplica: para el cron, la única barrera posible es *no poder*.

## Propuesta: cuatro niveles

La propuesta usa el criterio de **reversibilidad y alcance**, no de «importancia», porque
la reversibilidad sí es comprobable en una revisión.

| Nivel | Criterio | Quién autoriza | Ejemplos |
|---|---|---|---|
| **N0 — Lectura** | No modifica nada | Nadie; basta el permiso de rol y el aislamiento por empresa | Consultas, informes, búsquedas |
| **N1 — Escritura reversible** | Modifica datos de negocio; deshacer es trivial y el alcance es una fila o pocas | El propio usuario, con registro | Crear un parte, asignar bobina, actualizar tarea |
| **N2 — Escritura amplia o difícil de deshacer** | Afecta a muchas filas, a la configuración, o sale de la organización | Confirmación humana **explícita** en el momento | Borrados múltiples, cambio de configuración de empresa, envío de Telegram, `propose_fix` aplicado |
| **N3 — Estructural o irreversible** | Cambia el esquema, permisos, secretos o el estado de producción | Director, con runbook y fuera del flujo del agente | `run_migration`, despliegue, secretos, borrado de tabla |

**Regla propuesta para el cron:** solo puede ejecutar N0 y N1. Nunca N2 ni N3, porque no
hay humano al que pedir confirmación y una confirmación automática no es una confirmación.

**Regla propuesta para `run_migration`:** pasa a N3, es decir, **sale del alcance del
agente**. Hoy es la única capacidad que puede alterar el esquema sin pasar por el circuito
de F-0.1, lo que contradice ADR-0001 en la práctica aunque no en la letra.

## Alternativas consideradas

| Alternativa | Motivo |
|---|---|
| Clasificar por «importancia» o criticidad percibida | Descartada: no es comprobable en revisión y depende del juicio de quien clasifique. |
| Dos niveles (lectura / escritura) | Descartada: mete en el mismo saco crear un parte y ejecutar una migración. |
| Cuatro niveles por reversibilidad y alcance | **Propuesta.** Cada nivel se puede justificar con una pregunta objetiva: ¿cuántas filas? ¿se deshace? ¿sale de la organización? |
| Que el modelo decida el nivel caso por caso | Descartada: convierte la barrera en algo que la propia IA puede razonar para saltarse. El nivel debe ser una propiedad **declarada de la tool**, no una inferencia. |

## Consecuencias

**Si se acepta:**

- Cada tool del catálogo (ARC-006) deberá declarar su nivel como metadato, y una tool sin
  nivel declarado no se puede registrar. Eso hace la matriz verificable en CI.
- `run_migration` habría que retirarla del agente o degradarla a proponer migraciones que
  apruebe un humano. **Es un cambio de comportamiento**, no solo de documentación.
- El cron nocturno habría que auditarlo para comprobar qué nivel usa hoy realmente.
- ADR-0004 queda desbloqueado por su parte de ARC-001; seguirían pendientes ARC-003
  (definición de Nexo), ARC-004 (QA) y ARC-006 (catálogo de tools).

**Si se rechaza o se pospone:** F-1.1 sigue bloqueada y la Época 1 no puede empezar. No es
un bloqueo artificial: sin umbrales acordados, el Motor de Decisión no tendría contra qué
decidir.

## Preguntas que solo el Director puede responder

1. **¿Se acepta el criterio de reversibilidad y alcance**, o se prefiere otro eje?
2. **¿Se acepta retirar `run_migration` del agente?** Es la consecuencia con impacto real
   más inmediato. Hoy es útil precisamente porque salta el circuito lento.
3. **¿El cron queda limitado a N0–N1?** Si se quiere que haga algo de N2, hay que definir
   qué significa «aprobado de antemano» y quién responde si sale mal.
4. **¿Quién puede aprobar N2?** ¿Cualquier usuario sobre sus propios datos, o hace falta un
   rol mínimo (`encargado` hacia arriba)?
5. **¿Qué pasa con lo que ya está en producción sin clasificar?** ¿Se audita antes de
   seguir, o se clasifica según se vaya tocando?

## Decisión (2026-08-02)

El Director acepta la matriz de cuatro niveles (N0–N3) por reversibilidad y alcance, tal
como se propuso, con una precisión sobre la pregunta 2:

- **Criterio de reversibilidad y alcance: aceptado sin cambios.**
- **`run_migration` no se retira del agente**, pero **sale del alcance autónomo**: pasa a
  ser una **capacidad administrativa**, sujeta a **autorización explícita** en cada uso,
  igual que cualquier otra acción N3. La tool sigue existiendo en el catálogo, pero no
  puede invocarse sin esa autorización — no es una decisión que Alejandra pueda tomar por
  su cuenta en ningún caso.
- Las preguntas 3, 4 y 5 quedan resueltas por la propia matriz: el cron limitado a N0–N1
  (sin excepciones abiertas), N2 aprobado por el usuario sobre sus propios datos o por un
  rol `encargado` hacia arriba cuando el alcance excede al propio usuario, y lo que ya está
  en producción se clasifica según se vaya tocando — no se bloquea trabajo para auditar de
  golpe, que sería el mismo error que ADR-0007 ya corrigió.

Consecuencia inmediata: ADR-0004 queda desbloqueado por su dependencia de ARC-001. `run_migration`
queda pendiente de que su gating en código refleje esta clasificación (ARC-006/ADR-0010 es
donde se declara ese metadato); hasta entonces, el criterio es documental y debe respetarse
manualmente.

## Referencias

- ADR-0003 (evaluación de riesgo antes de ejecutar) — este ADR le da los umbrales que le faltaban
- ADR-0004 (Motor de Decisión) — bloqueado en parte por ARC-001
- ADR-0001 (entrega deliberada) — `run_migration` es hoy una excepción práctica a su principio
- `ARCHITECT_BACKLOG.md` — ARC-001, ARC-003, ARC-004, ARC-006, ARC-011
- `docs/architecture/07-INVENTARIO-DDL-RUNTIME.md` — evidencia sobre `run_migration` y las 27 tablas sin autor
- `CLAUDE.md` — barreras SEC-08 y SEC-09, y la regla de los dos cerebros
