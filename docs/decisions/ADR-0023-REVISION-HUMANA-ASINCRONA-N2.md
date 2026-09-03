# ADR-0023 — Revisión humana asíncrona real para acciones N2

- Identificador: ADR-0023
- Fecha: 2026-09-03
- Estado: **Propuesto**
- Decisores: `PENDIENTE` (Director del Proyecto)
- Depende de: ADR-0006 (niveles N0-N3), ADR-0009 (tres niveles de verificación),
  ADR-0020 (Motor de Decisión, rebanada 6), ADR-0022 (ayudantes)
- Resuelve: el pendiente "sin decisión tomada" de ARC-020 (`ARCHITECT_BACKLOG.md`)

## Contexto

### Lo que los ADR ya fijan

ADR-0006 clasifica cada tool por reversibilidad. **N2** es "escritura amplia o difícil de
deshacer, o que sale de la organización", y exige "confirmación humana explícita". ADR-0009
concreta *cómo*: para N2 el nivel de verificación es la **revisión humana asíncrona** — "una
acción se ejecuta pero queda pendiente de confirmación antes de tener efecto irreversible".
El ejemplo en producción que cita es `alejandra_fixes` con botón de Telegram. El Director
decidió (ADR-0009, pregunta 2) que esas revisiones van a `DEV_CHAT_ID` "hasta que exista
más de un revisor humano".

ADR-0020 rebanada 6 cableó `decidirInvocacionN2N3()` en el Motor de Decisión: para toda
tool N2/N3 devuelve siempre `decision: 'posponer'` con `permitida: true`. Es decir, **deja
traza pero no bloquea**: la tool se ejecuta igualmente y la barrera real sigue viviendo
dentro de cada `case`. La función del paquete aislado que debería pedir la revisión,
`solicitarRevisionHumanaAsincrona()` (`nucleo-cognitivo/packages/cognitive-core/src/verifier.js`),
es un stub que lanza un error, porque "depende del canal Telegram real, fuera de este paquete".

### Cómo se protege N2 hoy, de verdad

| Mecanismo | Dónde | Cómo funciona | Limitación |
|---|---|---|---|
| `CONFIRMO BORRADO <código>` | los dos Workers | código = hash de la sentencia exacta; el humano lo escribe en el chat; se extrae del mensaje real (`extraerCodigosConfirmacion`) | síncrono: exige al humano delante, en esa conversación |
| `CONFIRMO MIGRACION <código>` | los dos Workers | igual, para DDL (ADR-0015) | igual |
| `CONFIRMO ENVIO <código>` | `alejandra-agente` (`enviar_gmail`, `programar_correo`) | código = hash de `para+asunto+cuerpo`; Set separado (`codigosConfirmadosEnvio`) | igual, y **demostrado frágil** (abajo) |
| Botón de Telegram | `worker.js` raíz | `alejandra_fixes` → mensaje a `DEV_CHAT_ID` con `fix_apply:<id>` / `fix_reject:<id>` | solo para fixes de código; solo Adrián; ver hallazgo lateral |
| Motor de Decisión | `alejandra-agente` | `decidirInvocacionN2N3()` → `'posponer'`, `permitida: true` | traza únicamente, no bloquea |

Tools N2 declaradas hoy (`nivel_riesgo: 'N2'`):

- `alejandra-agente/worker.js` (12): `tomar_decision`, `enviar_gmail`, `programar_correo`,
  `escribir_bd`, `enviar_email`, `enviar_telegram_informe`, `github_escribir`,
  `test_endpoint`, `rollback`, `patch_codigo`, `nexus_manage`, `exportar_datos`.
- `worker.js` raíz (8): `list_tables`, `network_sync`, `network_send`, `network_join`,
  `fetch_url`, `r2_delete`, `manage_user`, `repo_write_file`.

### Evidencia de que el mecanismo síncrono no basta

Verificación en vivo de `TAREAS-PROGRAMADAS-01` (2026-09-01, `HANDOFF.md`): en una
conversación larga el modelo pidió el mismo `CONFIRMO ENVIO` dos veces sin procesarlo,
después generó un código distinto, y llegó a afirmar que "no puede aceptar códigos que no
generó en esta conversación" sin reintentar la tool. Solo salió adelante con una instrucción
muy directa. La consecuencia práctica fue añadir un formulario en `panel.html` para crear
tareas sin pasar por el chat — es decir, ya se está rodeando la barrera por otra vía porque
la barrera falla, y esa vía nueva no está gobernada por ningún ADR.

Además, el diseño síncrono tiene un límite estructural que ADR-0006 ya señaló: "para el
cron, la única barrera posible es *no poder*". Cualquier flujo donde Alejandra prepara algo y
el humano no está delante (ayudantes con `delegar_tarea`, gestión automática de correos,
tareas programadas) no puede usar una frase en el chat.

### Infraestructura que ya existe y se puede reutilizar

- **Cola persistente ejecutada por cron:** `tareas_programadas` (migrada el 2026-09-01) +
  `ejecutarTareasProgramadas()` en el cron `*/5 * * * *` de `alejandra-agente`. Es
  exactamente el patrón "guardar ahora, ejecutar después" que necesita una revisión
  asíncrona. Estados `pendiente/enviada/cancelada/error`, `LIMIT 20` por tick, nunca deja
  una fila sin marcar.
- **Botones inline de Telegram + callbacks:** `worker.js` raíz ya envía mensajes con
  `inline_keyboard` y procesa `callback_query` (`apr`/`rej` de usuarios, `idea_*`,
  `herr_disp`, `fix_apply`/`fix_reject`), con `_tgAnswerCQ()` y `_tgEditMsg()` para retirar
  los botones tras actuar.
- **Canal interno agente → raíz:** service binding `API_WEB` +
  `POST /internal/telegram/enviar` (resuelve `usuarios.telegram_id`; hoy solo texto, sin
  botones).
- **Traza:** `registrarTraza()` (ADR-0014) ya está en los dos Workers.
- **Pantalla de panel:** "🕐 Mis Tareas Programadas" (`panel.html`) con `GET`/`POST`/`DELETE
  /tareas-programadas` — lista, crea y cancela filas de una cola por usuario.

### Restricción de infraestructura

Workers Free limita a **5 cron triggers por cuenta**. Hoy: `worker.js` raíz 2, `alejandra-agente`
2 (`0 5,8,11,14,17,19 * * *` y `*/5 * * * *`), `canai-worker` 1. **No hay hueco para un cron
nuevo**; cualquier ejecución diferida debe colgar del `*/5` que ya existe.

### Hallazgo lateral encontrado al analizar (por verificar, no decidido aquí)

`worker.js` raíz tiene **dos** manejadores del webhook de Telegram: `handleTelegramWebhook()`
en `/telegram-webhook` (el único que procesa `fix_apply`/`fix_reject`) y `telegramWebhook()`
en `/telegram/webhook` (procesa `apr`/`rej`/`idea_*`/`herr_disp`, **no** los fixes). La
función que registra el webhook en Telegram (`setupTelegramWebhook()`, expuesta en
`/admin/setup-telegram-webhook`) apunta a `/telegram/webhook`. Si el webhook real está donde
el código lo registra, **el botón "Aplicar fix" de `alejandra_fixes` — el único ejemplo de
revisión asíncrona "ya en producción" que cita ADR-0009 — no funciona desde mayo**. Ambos
manejadores conviven desde v5.38 (2026-05-04). Verificarlo exige `getWebhookInfo` con el
token del bot (secreto: solo el Director). Ninguno de los dos manejadores comprueba
`callback_query.from.id` contra `DEV_CHAT_ID`; se apoyan en el secreto del webhook y en que
los botones solo se envían a ese chat.

## Decisión (propuesta)

Implementar la revisión humana asíncrona como una **cola persistente en D1 con tres canales de
aprobación equivalentes y un único ejecutor**, empezando por un **piloto de dos tools**.

### 1. Cola `acciones_pendientes` (migración D1, autorización humana)

| Columna | Sentido |
|---|---|
| `id` | PK |
| `usuario_id`, `empresa_id` | quién lo pidió; aislamiento por empresa como el resto |
| `worker` | `'agente'` \| `'api'` — qué Worker posee la tool y la ejecutará |
| `tool` | nombre de la tool N2 |
| `input` | JSON con los argumentos **exactos** que se ejecutarán; nunca se re-derivan del modelo |
| `resumen` | texto para el humano ("Enviar a X, asunto Y") |
| `codigo` | el mismo hash que hoy (`codigoConfirmacionOp`), para que la frase de chat siga valiendo |
| `estado` | `pendiente` → `aprobada` \| `rechazada` \| `caducada`; `aprobada` → `ejecutada` \| `error` |
| `solicitado_at`, `caduca_at`, `decidido_at`, `decidido_por`, `canal_decision` | auditoría; `canal_decision` ∈ `chat`/`telegram`/`panel` |
| `ejecutado_at`, `resultado`, `error_msg` | resultado real |
| `traza_id` | enlace a `alejandra_trazas` |

Toda transición se hace con `UPDATE ... WHERE id=? AND estado='<origen>'` para que dos
aprobaciones simultáneas o un doble clic no ejecuten dos veces.

### 2. Flujo

1. Alejandra invoca una tool N2 del piloto **sin** código confirmado en el mensaje humano.
2. En vez de devolver solo el texto "PENDIENTE DE CONFIRMACIÓN", la tool **inserta la fila**
   en `acciones_pendientes` y registra traza. Devuelve al modelo el mismo texto de hoy, con
   el código, más "también puedes aprobarlo desde Telegram o desde el panel".
3. Se notifica al revisor por Telegram con dos botones (`n2_ok:<id>` / `n2_no:<id>`) si tiene
   Telegram vinculado. Si no, la fila sigue visible en el panel.
4. Aprobación por cualquiera de los tres canales, todos equivalentes:
   - **Chat:** el humano escribe `CONFIRMO ENVIO <código>` como hoy. La tool encuentra la
     fila por `codigo`, la marca `aprobada` y la ejecuta en el mismo turno (comportamiento
     actual, sin cambios visibles para el usuario).
   - **Telegram:** el callback marca `aprobada`, retira los botones y edita el mensaje.
     **No ejecuta nada**: el ejecutor es el cron.
   - **Panel:** nueva pestaña "Pendientes de aprobar" en "Mis Tareas Programadas", con
     `POST /acciones-pendientes/:id/aprobar` y `/rechazar` bajo `getAuth` real.
5. **Ejecutor único:** el cron `*/5` de `alejandra-agente` procesa las filas `aprobada` con
   `worker='agente'` igual que `ejecutarTareasProgramadas()` (mismo `LIMIT 20`, mismo
   "nunca dejar una fila sin marcar"). Reutiliza el `case` de la tool con un flag interno de
   "ya aprobada", en vez de duplicar la lógica de envío.
6. **Caducidad:** el mismo cron marca `caducada` lo que pase de `caduca_at` y avisa al
   solicitante. Una caducada nunca se ejecuta.

### 3. Piloto: `enviar_gmail` y `programar_correo`

Son las dos tools donde la fragilidad está demostrada, comparten código y frase, viven en un
solo Worker y su efecto (un correo desde el Gmail del usuario) es de ámbito personal. Las
otras 10 tools N2 del agente y las 8 del raíz **no cambian**: siguen con sus barreras
actuales. Ampliar el piloto a otra tool es una enmienda a este ADR, tool por tool, como se
hizo en ADR-0020.

N3 queda **fuera**, por mandato de ADR-0006: "no es una decisión que Alejandra pueda tomar por
su cuenta en ningún caso".

### 4. Motor de Decisión y paquete aislado

- `decidirInvocacionN2N3()` no cambia: `'posponer'` pasa a significar exactamente lo que
  hace la cola. Para las tools del piloto, `permitida: true` sigue siendo correcto porque la
  propia tool es quien encola en vez de ejecutar.
- `solicitarRevisionHumanaAsincrona()` deja de ser un stub que lanza: pasa a ser una función
  **pura** que construye y valida la solicitud (`{tool, input, resumen, codigo, caduca_at}`)
  y devuelve `{nivel: 'revision_humana_asincrona', aprobado: false, solicitud}`. La I/O
  (INSERT, Telegram) sigue en cada Worker, coherente con `registrarExplicabilidad()`.

### 5. Requisitos de seguridad, no negociables

- El callback de Telegram comprueba `callback_query.from.id` contra el `telegram_id` del
  revisor guardado en la fila, no solo contra el chat. Hoy ningún callback lo hace.
- El código sigue atado a los argumentos exactos (`para+asunto+cuerpo`); un cambio en el
  cuerpo invalida la aprobación.
- El modelo nunca puede aprobar: el estado solo cambia desde un mensaje humano real, un
  callback de Telegram verificado o una sesión real de panel. Un ayudante (ADR-0022) tampoco.
- El cron ejecuta solo `aprobada`; nunca crea N2 (regla de ADR-0006 intacta).
- Traza en cada transición (`solicitada`, `aprobada`, `rechazada`, `ejecutada`, `caducada`).

### 6. Qué NO resuelve

- No amplía qué tools pueden ejecutarse: solo cambia **cómo** se confirma.
- No sustituye `CONFIRMO BORRADO`/`CONFIRMO MIGRACION`: las tools que los usan quedan igual.
- No decide quién revisa cuando haya varios revisores por empresa (ADR-0009 lo deja para
  "cuando llegue el caso"; ver pregunta 2).
- No corrige el hallazgo lateral del webhook: es un bug a verificar y arreglar aparte, pero
  es **prerrequisito** para fiarse del canal Telegram.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Mantener solo las frases de chat y reforzar el prompt | Descartada: ya se probó una instrucción más directa el 2026-09-01 y el fallo es estructural (turnos largos, humano ausente); el formulario del panel es la prueba de que se está rodeando |
| Ejecutar la acción dentro del callback de Telegram | Descartada: el callback vive en `worker.js` raíz y las tools del piloto en `alejandra-agente`; obligaría a duplicar la lógica de envío en el otro cerebro o a un salto entre Workers dentro de un webhook con límite de tiempo |
| Cron nuevo dedicado a la cola | Descartada: límite de 5 triggers por cuenta ya alcanzado; se reutiliza el `*/5` existente |
| Durable Objects / Queues de Cloudflare | Descartada: plan Free, y añadiría un tercer lugar donde vive estado cuando D1 + cron ya resuelven el caso |
| Aprobación automática si nadie responde en X horas | Descartada: ADR-0006 — "una confirmación automática no es una confirmación". Lo que caduca se anula, nunca se ejecuta |
| Migrar las 12 tools N2 del agente de golpe | Descartada: radio de impacto; mismo criterio de rebanadas que ADR-0020 |
| Piloto con `escribir_bd` en vez de correo | Descartada: `escribir_bd` ya tiene `CONFIRMO BORRADO` (SEC-09) funcionando y sin fallos registrados; el correo es donde duele |
| Cola con tres canales y ejecutor único en el cron | **Propuesta.** Reutiliza todo lo que existe (tabla-patrón, cron, botones, panel, traza), un solo sitio ejecuta, y el humano elige el canal |

## Consecuencias

**Si se acepta:**

- **Migración D1** (`acciones_pendientes`): requiere autorización humana explícita en el
  momento de aplicarla (ADR-0007). Se entrega como `migrate_acciones_pendientes.sql` y se
  verifica contra el esquema real tras aplicarla, como `tareas_programadas`.
- **Código:** `alejandra-agente/worker.js` (los dos `case` del piloto, `ejecutarAccionesAprobadas()`
  en el cron `*/5`, `POST /internal/telegram/enviar` gana `botones` opcional), `worker.js` raíz
  (callbacks `n2_ok`/`n2_no` con verificación de `from.id`, endpoints de panel), `panel.html`
  (pestaña nueva), `verifier.js` (función pura + tests). **Regla "dos cerebros":** las 8 tools
  N2 de `worker.js` raíz se quedan conscientemente con SEC-08; se deja constancia aquí de
  que la asimetría es deliberada y temporal.
- **Pruebas:** contrato de `solicitarRevisionHumanaAsincrona()` (cognitive-core), pruebas
  negativas: modelo intentando aprobar, callback desde otro `from.id`, doble aprobación,
  aprobación de una fila caducada, cuerpo modificado tras aprobar. Verificación en vivo
  obligatoria por los tres canales, comprobando el estado en D1 y la recepción real, no el
  texto del chat (lección de `GESTION-AUTO-CORREOS-01`).
- **Operativa:** una acción pendiente es visible y cancelable por su dueño en el panel;
  las caducadas avisan. El cron `*/5` gana una segunda responsabilidad, dentro del mismo
  presupuesto de tiempo.
- **Seguridad:** cierra de paso la ausencia de verificación de `from.id` en callbacks (solo
  para los nuevos; extenderla a `apr`/`rej`/`fix_apply` es un fix aparte, recomendado).

**Si se rechaza:** N2 sigue dependiendo de que el humano esté delante y de que el modelo
gestione bien el código; el formulario del panel seguirá siendo la vía real y no gobernada.

## Preguntas abiertas para el Director

1. **¿Se acepta el piloto** con `enviar_gmail` y `programar_correo`? *Recomendación: sí.*
2. **¿Quién revisa?** ADR-0009 fijó `DEV_CHAT_ID`, pero aquí la acción es de ámbito personal
   (el Gmail del propio usuario). *Recomendación:* el **solicitante** revisa lo suyo; la
   regla de `DEV_CHAT_ID` se mantiene para tools de ámbito de sistema (`patch_codigo`,
   `rollback`, `escribir_bd`…) cuando entren en el piloto. Es una enmienda a ADR-0009, no
   una contradicción.
3. **¿Se mantiene la frase de chat** como tercer canal? *Recomendación: sí* — no rompe nada
   y es la vía natural cuando el humano sí está delante.
4. **Caducidad.** *Recomendación:* 24 h; para `programar_correo`, el mínimo entre 24 h y la
   hora programada.
5. **Autorizar la migración D1** cuando llegue el momento (no ahora).
6. **Verificar el webhook de Telegram** (`getWebhookInfo` con el token) y decidir si se
   corrige antes de implementar. *Recomendación:* verificar primero; si está en
   `/telegram/webhook`, unificar los dos manejadores en uno solo es un fix previo y aparte.

Hasta que este ADR pase a **Aceptado** no se toca código ni D1 (ADR-0007: aceptar un ADR nunca
es autónomo).

## Referencias

- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md`
- `docs/decisions/ADR-0009-ALCANCE-DE-QA-Y-VERIFICACION.md`
- `docs/decisions/ADR-0020-INTEGRACION-GRADUAL-MOTOR-DECISION.md` — enmienda 5 (rebanada 6)
- `docs/decisions/ADR-0022-AYUDANTES-DELEGACION-ACOTADA.md`
- `nucleo-cognitivo/packages/cognitive-core/src/verifier.js` — `solicitarRevisionHumanaAsincrona()`
- `nucleo-cognitivo/packages/cognitive-core/src/motor-decision.js` — `decidirInvocacionN2N3()`
- `alejandra-agente/worker.js` — `case 'enviar_gmail'`, `case 'programar_correo'`,
  `ejecutarTareasProgramadas()`, `scheduled()`
- `worker.js` — `handleTelegramWebhook()`, `telegramWebhook()`, `setupTelegramWebhook()`,
  `internalTelegramEnviar()`
- `migrate_tareas_programadas.sql`
- `HANDOFF.md` — "TAREAS-PROGRAMADAS-01" (2026-09-01), evidencia de la fragilidad
- `ARCHITECT_BACKLOG.md` — ARC-020
