# ADR-0028 — Pool de IA propio con respaldo obligatorio

- Identificador: ADR-0028
- Fecha: 2026-10-03
- Estado: **Aceptado — por el Director en chat el 03/10/2026**
- Decisores: Director del Proyecto (Adrián)
- Depende de: ADR-0007 (autonomía de agentes), ADR-0010 (catálogo de tools), regla «dos
  cerebros» de `CLAUDE.md`
- Implementación: `alejandra-agente/ai-pool.js` (cliente único para los dos workers),
  `alejandra-agente/ai-pool.test.js`, `scripts/ai-benchmark/pool.mjs`; banco de casos
  `scripts/ai-benchmark/casos-alejandra.json` (+ `banco-alejandra.mjs`,
  `herramientas-agente.mjs`, `banco-alejandra.test.mjs`); contexto del oficio
  `CONTEXTO_DOMINIO_INSTALADORA` en `alejandra-agente/lib.js` (+ `alejandra-agente/dominio.test.js`);
  métricas de producción `scripts/ai-benchmark/metricas-produccion.mjs` (+ `.test.mjs`)

## Contexto

Alejandra paga por token en cada mensaje aunque muchas llamadas son tareas pequeñas: el
router de intención (Haiku en cada mensaje que no resuelve la regex), el experto «simple»
(saludos y charla), los crons de monitorización y de compactación, la búsqueda web
(gpt-4o-mini con `web_search_preview` en el agente, Tavily en el worker de Telegram) y la
cadena de respaldo cuando Anthropic cae (Grok-4 → OpenRouter gratis → gpt-4o, de pago).

Adrián tiene en casa un pool de IA (gateway compatible OpenAI sobre Proxmox, expuesto por
Tailscale Funnel en `https://pve1.tail2c5046.ts.net`) con `qwen3.6:35b-a3b`, `prisma:1.0` y
`gemma4:e4b` (más `qwen2.5:1.5b/0.5b`, pequeños y lentos, que no se usan), y herramientas de
búsqueda y lectura web. Coste marginal por token: cero. Decisión en chat (03/10/2026):
pasar al pool lo que pueda hacer, para pagar menos, **siempre con respaldo** y **apagado
hasta que él configure el secreto**.

## Decisión

1. **Enrutado automático en código, no una tool.** El pool se intenta primero en puntos
   concretos del código y, ante cualquier problema, se sigue por el camino de hoy. Alejandra
   no «decide» usar el pool: no hay tool nueva ni cambio de prompt.
2. **Apagado por defecto.** Sin el secreto `AI_POOL_KEY` no se hace ninguna llamada ni se
   escribe ninguna línea de log nueva. `AI_POOL_ENABLED="0"` lo apaga aunque haya clave.
   `AI_POOL_URL` (opcional, solo HTTPS) cambia el host; por defecto es la constante
   `AI_POOL_URL_DEFECTO`. Se eligió constante + override en lugar de `[vars]` en
   `wrangler.toml` porque un bloque `[vars]` reemplaza en cada `wrangler deploy` las
   variables de texto del panel y ninguno de los dos workers lo tiene hoy.
3. **Respaldo obligatorio y rápido.** Timeout por uso con `AbortController` (router 8 s,
   experto simple 12 s, respaldo de Anthropic 25 s, búsqueda 10 s, lectura 15 s, tareas en
   segundo plano 25 s, crons 120 s para absorber la carga en frío). Respaldo inmediato ante:
   timeout, error de red, cualquier HTTP no 2xx (incluidos 503 `model_unavailable`, 503
   `request_too_long_for_devices`, 429, 401/403, 422, 502), JSON roto, respuesta vacía o
   con formato inesperado. Circuito abierto por isolate: tras 3 fallos seguidos se salta el
   pool 5 minutos.
4. **Un solo cliente para los dos cerebros.** `alejandra-agente/ai-pool.js` lo importan
   `alejandra-agente/worker.js` y `worker.js` (como ya hace con `lib.js`).

### Alcance — qué pasa al pool

| Uso | Antes | Ahora (si hay clave) | Dónde |
|---|---|---|---|
| a) Router de intención del agente | Haiku | pool `alejandra:1.0` (JSON) → Haiku | `clasificarConHaiku` |
| a) Router NEXUS (Telegram) | Haiku | pool `alejandra:1.0` (JSON) → Haiku | `nexusRoute` en `worker.js` |
| b) Experto «simple» | OpenRouter gratis → Haiku | pool `alejandra:1.0` (con tools) → OpenRouter → Haiku | `llamarExperto` |
| b) Cron modo normal | Haiku | pool → Haiku | `scheduled` del agente |
| b) Crons de destilación y compactación | OpenRouter → Haiku | pool → OpenRouter → Haiku | `llamarTextoGratisConFallbackHaiku` |
| b) Resumen de conversación | Haiku | pool → Haiku | resumen en segundo plano del agente |
| c) `buscar_web` del agente | gpt-4o-mini | pool `/v1/tools/search` (+ `/v1/tools/read` si no hay extractos) → gpt-4o-mini | `buscarWebOpenAI` |
| c) `web_search` de Telegram | Tavily | pool `/v1/tools/search` → Tavily | `executeAITool` en `worker.js` |
| d) Cadena cuando cae Anthropic | (Gemini si hay imagen) → Grok → OpenRouter → gpt-4o | (Gemini si hay imagen) → **pool** → Grok → OpenRouter → gpt-4o | `llamarGPT4oFallback` |
| e) Adjunto PDF > 4,5 MB del chat | Gemini | pool `/v1/tools/document` → Gemini | `buildUserContentWithAdjuntos` del agente |
| e) Adjunto Excel (.xlsx) del chat | Gemini | pool `/v1/tools/document` → Gemini | `buildUserContentWithAdjuntos` del agente |
| e) Adjunto Word (.docx) del chat | aviso «[Archivo adjunto…]» | pool `/v1/tools/document` → el mismo aviso | `buildUserContentWithAdjuntos` del agente |
| e) Tool `ver_archivo` (PDF, .xlsx, .docx) | heurística de cadenas del PDF / solo metadatos | pool `/v1/tools/document` → lo mismo de antes | `ver_archivo` del agente |

Con el experto «simple», si el pool ya dio el texto final sin tools, el streaming de cierre
no vuelve a llamar a Haiku (esa segunda llamada anularía el ahorro).

Todos los usos de chat del pool de la tabla (router, router NEXUS, experto simple, crons,
resumen, cadena de respaldo y reescritura de la consulta de búsqueda) piden el **mismo modelo**,
`alejandra:1.0` (ver la sección siguiente).

### Modelo `alejandra:1.0` (03/10/2026)

La sesión del pool ha creado un modelo propio, `alejandra:1.0`: un **alias** que aparece en
`/openai/v1/models` con `"resolves_to"`. Hoy resuelve a `qwen3.6:35b-a3b` (maneja tools); si
ese no está cargado, a `prisma:1.0` (rápido en JSON, pero **no** devuelve `tool_calls`).

- **Un solo nombre en el código**: la constante `AI_POOL_MODELO = 'alejandra:1.0'` de
  `ai-pool.js`, y `modeloPool(env)` la aplica a todos los usos. Override opcional sin desplegar:
  variable de texto `AI_POOL_MODEL` en el panel de cada worker (un valor con caracteres raros
  se ignora). Qué hay detrás del alias lo decide el pool con los datos del banco de casos
  (§Medición), sin tocar código aquí. Un test impide que los workers vuelvan a fijar a mano un
  modelo concreto (`prisma:1.0`, `qwen3.6:35b-a3b`, `gemma4:e4b`).
- **Modelo real**: la cabecera de respuesta `X-AI-Pool-Model` dice qué modelo respondió de
  verdad; manda sobre el campo `model` del cuerpo (que puede repetir el alias). Se registra en
  la métrica (`modeloReal`) y en `alejandra_token_uso` (`ai_pool:<modelo real>`).
- **Tolerancia a un alias sin tools**: si una petición lleva tools, el alias resolvió a un
  modelo sin tools (cabecera `prisma…`) y la respuesta no trae `tool_calls`, se descarta →
  respaldo, motivo `modelo_real_sin_tools` (ese texto no ha podido consultar nada y podría
  inventar datos). No cuenta para el circuito: el pool sí respondió. Si se pide
  explícitamente un modelo sin tools con tools, ni se llama (`modelo_sin_tools`). Los usos sin
  tools (routers, crons, resumen, reescritura) aceptan cualquier modelo real.
- `/no_think` se añade para `qwen3*` y para el alias (que hoy es qwen3.6); si resuelve a prisma
  es una línea inocua más del prompt.

**No pasa al pool:** los expertos Sonnet con tools, el experto `asistente` de Telegram
(Haiku con tools de notificación y red; `worker.js` no tiene conversión de tools
Anthropic↔OpenAI y el canal dev es el de mayor privilegio), planos SVG, Gemini (OCR, partes,
albaranes, matrículas), notas de voz, Cloud Vision, el escaneo AR (visión, ADR-0027) y
cualquier llamada con imágenes.

### Contexto del oficio y glosario en todos los prompts (POOL-GLOSARIO-01, 03/10/2026)

En el banco `c01d880` (router/simple/tools: qwen3.6 21/7/30, gemma4 20/8/18, prisma 21/3/23)
qwen3.6 y prisma explicaron el **diferencial como el de un coche**: el prompt del experto simple
(y el del banco) decía «gestión de obra de Constructora Demo» pero no que la empresa es una
instaladora. Desde ahora una constante única, `CONTEXTO_DOMINIO_INSTALADORA` (`lib.js`), con una
línea de contexto («empresa instaladora —eléctrica, mecánica, telecomunicaciones y control— en
obra; nunca automoción») y un **glosario de 15 términos** (diferencial 30/300 mA, magnetotérmico,
selectividad, REBT/ITC-BT, cuadro eléctrico, acometida/CGP, sección y caída de tensión, bobina,
bandeja portacables, IP/IK, replanteo, parte de trabajo, albarán, PEMP, EPI), va en:

- **agente**: módulo NEXUS `dominio`, dentro de `L0_MODULES` (el bloque con `cache_control`, que
  no cambia entre turnos) y en los **7 expertos** (`simple` incluido, que es lo que se manda al
  pool y a la cadena de respaldo), el prompt de reflexión del cron y el ayudante de pedidos;
- **Telegram** (`worker.js`): `buildNexusPrompt` lo inserta tras `base` en los 5 expertos, en el
  bloque cacheado;
- **banco**: en el `system` de todos los casos `experto_simple` y `experto_tools` (no en el
  router, que usa el prompt exacto del clasificador), y en `sistemaSimple`/`sistemaRespaldo`.

Coste: **1 461 caracteres** (~400 tokens) más por mensaje, en la parte cacheada del prompt de
Anthropic (lectura de caché) y sin coste en el pool. El router no lo lleva (clasifica, no
explica). `alejandra-agente/dominio.test.js` comprueba que todos los expertos de los dos
cerebros lo cargan, que está en L0 y que no pasa de 1 600 caracteres.

### Contrato del pool (confirmado por la sesión del pool, 03/10/2026)

Común: `Authorization: Bearer <AI_POOL_KEY>`, `Content-Type: application/json`. Cuerpos
**estrictos**: un campo desconocido → 422, así que el cliente solo manda campos del contrato.

- `POST /openai/v1/chat/completions` — compatible OpenAI, **sin streaming** (`stream:true` →
  400), cuerpo ≤ 2 MB. `response_format: {"type":"json_object"}` soportado (qwen3.6 ~2,5 s,
  prisma ~0,7 s). Tools formato OpenAI **solo con `qwen3.6:35b-a3b`** (prisma devuelve
  `tool_calls: null`). `model` = `alejandra:1.0` (alias); cabecera de respuesta
  `X-AI-Pool-Model` = modelo real. El cliente manda `model`, `messages`, `max_tokens` y, según el caso,
  `temperature`, `response_format`, `tools` (nunca `stream` ni `tool_choice`). Con qwen3 se
  añade `/no_think` al prompt de sistema y se quita cualquier `<think>…</think>` de la
  respuesta (a confirmar si el gateway ya desactiva el razonamiento; es inocuo si sí).
- `POST /v1/tools/search` — `{"query": 2–300 car., "results": 1–10, "since"?}` (también
  admite `read` 0–5 y `question`, que **no** se usan: `read>0` tarda de decenas de segundos a
  1–2 min). `since` (opcional, añadido por la sesión del pool el 03/10/2026) es el filtro de
  fecha de DuckDuckGo: `"day"|"week"|"month"|"year"`; el cliente solo lo manda si es uno de
  esos cuatro valores (cualquier otro valor ni se envía). Respuesta
  `{"query","results":[{"title","url","snippet",…}],"devices","took_s"}`. `results: []` → se
  trata como respaldo. 502 `{"detail"}` tras 3 intentos → respaldo.
- Campo `model` de la respuesta de chat: desde el 03/10/2026 es el **nombre** del modelo
  (`"prisma:1.0"`), no una ruta de fichero. El cliente acepta las dos formas
  (`normalizarNombreModeloPool`: de una ruta se queda el último segmento sin `.gguf`), y es lo
  que se registra como `ai_pool:<modelo>`.

### Consulta corta para la búsqueda (03/10/2026)

QA real: a «Busca en internet cuál es la última versión estable de Node.js y dime solo el
número.» se mandó esa frase entera como `query` y DuckDuckGo devolvió Node 22.11 (obsoleto);
con «Node.js latest LTS version» el primer resultado es el correcto (24.11.0). Por eso, antes
de `/v1/tools/search`, `prepararConsultaBusqueda` (en `ai-pool.js`, usado por los dos
cerebros: `buscarWebOpenAI` del agente —tool `buscar_web` y prefetch `query_web` del router—
y `web_search` de Telegram):

1. Si la petición ya es corta (≤6 palabras y sin muletillas) se usa tal cual, sin IA.
2. Si no, el modelo del pool (`alejandra:1.0`; antes `prisma:1.0`) con
   `response_format: json_object` y timeout de 4 s la convierte en
   `{"query": "...", "since": null|"day"|"week"|"month"|"year"}` (inglés para temas técnicos,
   software y normas internacionales; español para temas locales: empresas, normativa
   española, precios en España). La salida se valida estrictamente (solo esas dos claves,
   2–120 caracteres, ≤12 palabras, `since` del contrato).
3. Si el pool falla o la salida no vale: respaldo determinista sin IA (quita muletillas como
   «busca en internet», «dime», «por favor», signos y palabras vacías, recorta a 10 palabras,
   `since` por palabras clave: «última versión», «actual», «vigente», «precio», año actual →
   `year`; «noticias», «hoy», «esta semana» → `month`).

Los respaldos de pago (gpt-4o-mini `web_search_preview`, Tavily) reciben la petición
**original**: los dos entienden lenguaje natural (gpt-4o-mini es un modelo que además usa los
matices como «dime solo el número»; Tavily está pensado para consultas de agentes) y así se
comportan exactamente igual que antes del pool. Métrica: uso `buscar_web_consulta`
(`ok`/`respaldo`+motivo/`omitido` por consulta corta o circuito, `ms`), sin contenido.
- `POST /v1/tools/read` — `{"url": http(s) 8–2000, "summarize": false}`. Respuesta
  `{"url","final_url","status","title","text","device","summary","took_s"}`; si no pudo
  bajarla, 200 `{"url","error","device","took_s"}` sin `text` → fallo.
- `POST /v1/tools/document` (servicio nuevo de la sesión del pool, 03/10/2026) —
  `{"filename":"albaran.pdf","data":"<base64>"}` (≤ 20 MB) o `{"object_id":"obj_…"}`, más
  `"max_chars"` opcional (1000–200000). Formatos: PDF con texto, `.xlsx` (valores), `.docx`,
  CSV y texto. Respuesta `{"type","pages","text" (Markdown con tablas),"tables":[{"page","rows"}],
  "sheets":[{"name","rows"}],"needs_ocr":[páginas escaneadas sin texto],"truncated","chars","took_s"}`,
  0,2–0,5 s en CPU; 422 con motivo ante error. **No hace OCR.** El cliente
  (`poolLeerDocumento` en `ai-pool.js`) manda solo `filename` (último segmento de la key, sin
  la ruta R2 con ids), `data` y `max_chars`; nunca usa `object_id`. Timeout 15 s.

### Documentos (POOL-DOCUMENTOS-01, 03/10/2026)

Reglas de `poolLeerDocumento` (devuelve `null` = camino de siempre):

1. **Imágenes nunca**: fotos de albaranes, partes semanales, matrículas, escaneos remotos y
   análisis de fotos siguen con Gemini/Cloud Vision. Un MIME `image/*` (o vídeo/audio) o una
   extensión de imagen → `null` sin llamar; también `.xls` binario y cualquier formato fuera
   del contrato.
2. **Solo documentos con texto**: si la respuesta trae `needs_ocr` no vacío (todas **o parte**
   de las páginas escaneadas) o el texto útil tiene menos de 20 caracteres, el **documento
   entero** va por el camino de siempre. No se trocea por páginas: los Workers no tienen con
   qué partir un PDF y mezclar dos vías daría huecos o duplicados; todo o nada es lo sencillo y
   correcto. Estos casos no abren el circuito (el pool respondió bien).
3. **> 20 MB** → directo al respaldo, sin llamar (métrica `omitido`, motivo `demasiado_grande`).
4. **422** (fichero que el pool no puede leer) → respaldo **sin** contar para el circuito;
   timeout, 5xx o red → respaldo y sí cuentan.
5. Métrica `AIPOOL_METRICA` uso `documento` (ok / respaldo + motivo `needs_ocr`,
   `texto_corto`, `sin_texto`, `http_422`, `timeout`… / omitido), sin contenido ni nombre.

Dónde se usa (solo en `alejandra-agente/worker.js`; ver la tabla de Alcance, fila e):

- Adjuntos del chat (`buildUserContentWithAdjuntos`): PDF > 4,5 MB y `.xlsx` → pool → Gemini;
  `.docx` → pool → aviso de siempre. Los **PDF ≤ 4,5 MB siguen yendo nativos a Claude**
  (bloque `document`): Claude ve también dibujos, planos vectoriales y páginas escaneadas,
  cosa que el texto del pool no da; cambiar eso sería otra decisión, medida antes.
- Tool `ver_archivo`: PDF → pool → heurística de cadenas de siempre; `.xlsx`/`.docx` → pool →
  el mensaje de siempre. El formato del texto devuelto por la tool no cambia (mismas
  cabeceras y recortes de 6 000 / 8 000 caracteres).
- **No** pasan por el pool: `analizar_archivo` y `marcar_plano` (piden a Gemini que *analice*
  o responda una pregunta sobre el fichero, no que extraiga texto), CSV/texto (se leen tal
  cual, sin IA) y todos los escaneos de imagen.
- `worker.js` (Telegram, «el otro cerebro»): revisado y **no aplica** — no extrae texto de
  documentos (el webhook solo trata texto, voz y fotos; `/scan-parte`, `/scan-bobinas`,
  `/scan-devolucion-bobinas`, el escaneo remoto, el OCR de matrículas y la identificación del
  replanteo son todos de imagen). Si algún día lee PDF/Excel, debe usar el mismo
  `poolLeerDocumento` del módulo compartido.

El cliente sigue siendo tolerante con la *forma de la respuesta* (`snippet`/`content`/`text`,
`results`/`data`/array raíz, `{"error"}` o `{"detail"}`) por si el gateway evoluciona.

## Privacidad

Datos de empresa (mensajes de chat, historial para resumir, datos de crons) pasan a viajar a
un servidor doméstico expuesto a internet por Tailscale Funnel.

- **Solo HTTPS**: un `AI_POOL_URL` que no empiece por `https://` desactiva el pool.
- **Minimizar datos**: el pool recibe exactamente lo que ya recibía el proveedor de pago al
  que sustituye, nunca más; no se le manda nada con imágenes ni nada de las rutas excluidas.
- **Sin registrar contenido**: en el Worker solo se registran uso, modelo, resultado, motivo,
  latencia y tokens (test que lo comprueba).
- **Lado del pool — confirmado por la sesión del pool el 03/10/2026**:
  - la pasarela no registra las peticiones;
  - el Core guarda solo metadatos (proyecto, modelo, equipo, tiempos, tokens), no contenido;
  - el panel del pool ya no guarda el texto de las búsquedas;
  - la lectura de páginas (`/v1/tools/read`) anota solo el dominio;
  - los documentos (`/v1/tools/document`) reciben el mismo fichero que antes iba a Gemini,
    nunca imágenes. **Excepción consciente**: en `ver_archivo` el PDF/Excel/Word antes se leía
    solo dentro del Worker y ahora viaja al pool (mismo nivel de confianza que el resto de usos
    del pool; quitar `AI_POOL_KEY` lo revierte). Se manda solo el nombre del fichero (sin la
    ruta R2) y la métrica no lleva ni nombre ni contenido;
  - **DuckDuckGo sí ve la consulta** de búsqueda (es el buscador): por eso se le manda una
    consulta corta de palabras clave, no la frase entera del usuario;
  - Tailscale Funnel solo publica el puerto 443 hacia la pasarela, con las rutas de cliente y
    clave obligatoria; Proxmox y las interfaces de administración no son accesibles desde
    internet.
- La clave vive solo como secreto de Cloudflare (`AI_POOL_KEY`), nunca en el repositorio.

## Medición (cómo comparar rendimiento y eficacia)

Adrián (03/10/2026): «probaremos todo con el pool y compararemos rendimiento y eficacia».

**En producción, sin filas D1 nuevas por petición** (incidente D1-ESCRITURAS-01):

1. Cada uso del pool emite una línea `AIPOOL_METRICA {"uso","proveedor":"ai_pool","modelo",
   "modeloReal","resultado":"ok|respaldo|omitido","motivo","ms"}` (`modelo` = lo pedido, el
   alias; `modeloReal` = cabecera `X-AI-Pool-Model`, `null` si el pool no respondió). Verla con
   `npx wrangler tail alejandra-agente --format json | findstr AIPOOL_METRICA` (o en Workers
   Logs). `resultado=respaldo` = se usó el camino de antes; `motivo` dice por qué (`timeout`,
   `model_unavailable`, `request_too_long_for_devices`, `http_429`, `formato_invalido`,
   `sin_resultados`, `modelo_real_sin_tools`, …); `omitido` = circuito abierto.
2. Agregados por isolate en `GET /api/admin/metrics/ai-pool` del agente (token admin): el
   `modelo` pedido y, por uso, `ok/respaldo/omitido`, `tasaExito`, `motivosRespaldo`,
   `msMedioOk`, `p50MsOk`, `p95MsOk`, `modelosReales` (cuántas respuestas dio cada modelo
   real), y el estado del circuito. Es una muestra (un isolate), no el total.
3. Coste y volumen: las llamadas del agente que ya registraban tokens en
   `alejandra_token_uso` ahora registran `modelo='ai_pool:<modelo real>'` con `proveedor='ai_pool'`
   y `coste_usd=0` **en la misma fila** que antes escribía Haiku/gpt-4o-mini (no se añaden
   filas). Comparar `SUM(coste_usd)` y `COUNT(*)` por `proveedor` antes/después de activar.
4. **Workers Analytics Engine (opcional, no es D1)**: si el worker tiene el binding
   `AI_POOL_AE`, cada uso del pool escribe además un punto (`fijarSumideroMetricasPool`, en
   `ai-pool.js`; los dos workers lo fijan en `fetch` y `scheduled`) con solo metadatos:
   `blobs = [uso, resultado, motivo, modelo pedido, modelo real, worker]`,
   `doubles = [ms (-1 sin dato), 1]`, `indexes = [uso]`. Da los **motivos de respaldo con
   histórico**, que D1 no tiene. El binding está **comentado** en `alejandra-agente/wrangler.toml`:
   no está verificado que la cuenta (Workers Free) tenga Analytics Engine y un binding no
   disponible haría fallar el despliegue. Sin binding no se escribe nada (test).
   `scripts/inventario-entorno.js` lo trata como binding opcional.

#### Cómo leer las métricas: `scripts/ai-benchmark/metricas-produccion.mjs`

Solo lectura; nunca imprime contenido de mensajes (ni lo pide: de D1 solo agrega `tipo`,
`proveedor`, `modelo`, recuentos, tokens y coste; de tail y AE, solo los campos de la métrica).

| Fuente | Comando | Qué da | Qué necesita |
|---|---|---|---|
| `d1` (defecto) | `node scripts/ai-benchmark/metricas-produccion.mjs --horas 48` (o `--desde "2026-10-04 08:00"`) | Turnos resueltos por el pool por uso (`tipo` → uso) y modelo real (`ai_pool:<modelo>`); llamadas a Haiku del router en la misma ventana = **proxy de respaldo** (cada clasificación por Haiku es un mensaje que el pool no clasificó: respaldo, circuito abierto o pool apagado; los resueltos por regex no escriben fila); Sonnet/gpt aparte; coste | `wrangler login` y la autorización de lectura de D1 de `CLAUDE.md`. Un único `SELECT … GROUP BY` sobre `alejandra_token_uso` |
| `tail` | `… --fuente tail --minutos 15` | ok/respaldo/omitido, **motivos**, modelos reales y p50/p95 por uso, de las líneas `AIPOOL_METRICA` mientras escucha | `wrangler login` |
| `ae` | `… --fuente ae --horas 168` | Lo mismo que tail pero histórico (ponderado por `_sample_interval`) | Binding `AI_POOL_AE` activado y desplegado + `CF_API_TOKEN` con permiso *Account → Account Analytics → Read* (lo crea Adrián; ningún agente) |

`--json` devuelve el agregado en JSON. `chat_stream` mezcla expertos: en esa fila, `pool` = experto
simple resuelto por el pool, `haiku` = simple por su respaldo y `otros` = expertos Sonnet.

**Benchmark controlado** (workflow manual «Compare AI models (synthetic pilot)», opción
`pool`, o `node scripts/ai-benchmark/pool.mjs`): mismos casos sintéticos para el pool y para
lo de hoy, con el **mismo cliente y los mismos timeouts** que producción.

| Tarea | Pool | Contra | Acierto = |
|---|---|---|---|
| router | `alejandra:1.0`, `prisma:1.0` y `qwen3.6` | Haiku | etiqueta == esperada (14 casos etiquetados, mismo prompt de producción vía `lib.js`) |
| simple | `alejandra:1.0` y `qwen3.6` | Haiku | respuesta en español que cumple el patrón del caso, ≤ 1200 car., sin tokens de tool fugados |
| buscar_web | `/v1/tools/search` | gpt-4o-mini web, Tavily | resultados contienen la fuente/término esperado |
| respaldo | `alejandra:1.0` y `qwen3.6` con tools | Grok-4, gpt-4o | llama a la tool correcta, o responde texto sin tool cuando toca |
| banco | `alejandra:1.0`, `qwen3.6` y `prisma:1.0` | Haiku, gpt-4o | reglas del banco de casos (abajo) |

Cada fila del pool guarda `modeloReal` (cabecera `X-AI-Pool-Model`) y el informe muestra, por
candidato, qué modelos reales respondieron: así se ve a qué resolvió el alias en cada pasada.
`BENCHMARK_TAREAS=banco` (o `router,banco`…) limita las tareas.

### Banco de casos de Alejandra (`scripts/ai-benchmark/casos-alejandra.json`)

92 casos (v3, 03/10/2026; 60 hasta v2) en el formato pedido por la sesión del pool para elegir
con datos qué modelo hay detrás de `alejandra:1.0`: 21 de **router** (las 7 etiquetas de
`ETIQUETAS_CLASIFICADOR_INTENCION`, con casos difíciles: saludos, imperativos y enclíticos,
hechos que implican registrar datos, correo → `app` y no `web`, electricidad/REBT/PLC →
`ingenieria`, `web`, `tecnico`, `reflexion`, `completo`), 8 de **experto simple** (charla y
preguntas generales, algunos con tools a mano que NO deben usarse) y 31 de **experto con tools**
(partes y fichajes, cuadrantes, bobinas, materiales, albaranes, pedidos —vía `delegar_tarea`
al ayudante de pedidos—, obras y tareas, incidencias, replanteos, memoria, planos —solo
selección de `generar_plano` + `tipo`, sin SVG—, cálculo, normativa, `buscar_web`, correo y
recordatorios).

```json
[{ "id": "tools-18-replanteo-detalle", "tipo": "experto_tools",
   "mensajes": [{ "role": "system", "content": "…" }, { "role": "user", "content": "Enséñame el detalle del replanteo 7" }],
   "tools": [ /* esquemas OpenAI function reales: consultar_replanteos, comparar_replanteo_pedido, consultar_bd */ ],
   "esperado": { "herramienta": "consultar_replanteos", "argumentos": { "replanteo_id": 7 } } }]
```

- **Banco v3 (03/10/2026): 32 casos más difíciles**, todos sintéticos:
  - `multi-*` (10): **varios turnos** con el resultado de una herramienta ya devuelto, en formato
    OpenAI — `{"role":"assistant","content":"","tool_calls":[{"id","type":"function","function":
    {"name","arguments"}}]}` y `{"role":"tool","tool_call_id","content"}` —; el modelo debe hacer la
    **segunda llamada correcta** (p. ej. `consultar_replanteos` → `comparar_replanteo_pedido` con
    `replanteo_id` 12; `consultar_personal` → `consultar_bd` de `partes_trabajo`; `consultar_bd` →
    `escribir_bd` UPDATE de la incidencia 88) o **responder con el dato** (`respuesta_contiene` con
    el valor devuelto: 12 fichajes, 137 m de bobina, 63 % de avance, 15:00 del viernes…), o
    preguntar si el resultado es ambiguo (dos «Mario»).
  - `error-*` (7): **errores de herramienta y recuperación**, con los mensajes REALES del agente
    (generados con `validarScopeEmpresaBD`: falta `empresa_id`, falta `departamento`, empresa
    equivocada; «Sin resultados»; placeholders de D1; búsqueda caída; barrera `CONFIRMO BORRADO`):
    se espera reintentar bien, decir que no hay datos sin inventarlos o mostrar el código sin dar
    la acción por hecha.
  - `ambigua-*` (7): lo correcto es **preguntar** (`respuesta_contiene` con «¿» y los términos de
    la pregunta; a veces `respuesta_no_contiene` para no sugerir valores), con herramientas a mano.
  - `sin-tool-*` (8): **no debe usar herramientas** aunque las tenga; miden el glosario
    (selectividad, IP65, PEMP, CGP, bandeja portacables, caída de tensión, parte vs albarán).
- **«No usar herramientas»**: el formato del pool no tiene campo para eso; se expresa con
  `{"respuesta_contiene": [...]}` (y `respuesta_no_contiene`). **Nuestro runner además suspende si
  la respuesta llama a una herramienta** (`tool_innecesaria`), igual que si fuga sintaxis de tools;
  el evaluador del pool solo mira el texto. **Propuesta a la sesión del pool**: añadir
  `{"sin_herramienta": true}` a `esperado` (combinable con `respuesta_contiene`) para que
  `bench_alejandra.py` puntúe igual que el nuestro.
- **Conversación completa**: cada caso lleva su `system`. Los de router usan el prompt REAL del
  clasificador (`SYSTEM_CLASIFICADOR_INTENCION` + el sufijo JSON del cliente del pool); los de
  experto, un prompt de sistema condensado (el de producción ocupa decenas de miles de
  caracteres) con el contexto de la empresa demo.
- **Tools reales**: los esquemas salen de `alejandra-agente/worker.js` (`const TOOL_X`,
  convertidos a formato OpenAI como hace `_anthropicToolsToOpenAI`), solo las relevantes en cada
  caso (≤ 8, con distractores plausibles), nunca el catálogo entero. Tras cambiar una tool:
  `node scripts/ai-benchmark/herramientas-agente.mjs --refrescar`. El test falla si una tool
  del banco ya no existe o cambian sus campos obligatorios.
- **Evaluación** (`banco-alejandra.mjs`, igual para el pool y para cualquier proveedor):
  `etiqueta` exacta; `respuesta_contiene` = texto sin tool_calls ni sintaxis de tools fugada que
  contiene cada elemento (alternativas con `|`, sin mayúsculas ni tildes); `herramienta` = la
  primera tool llamada, y cada clave de `argumentos` presente: números/booleanos iguales, textos
  «contiene», lista de textos = todos (p. ej. la SQL de `consultar_bd` debe nombrar la tabla y
  filtrar por `empresa_id`). Las claves no listadas son libres.
- **Anonimizado**: contexto realista de la empresa demo (Constructora Demo S.L., `empresa_id`
  5, obra «Nave Industrial Demo», `obra_id` 14), con personas y proveedores inventados
  («Encargado Ficticio», «Mario Ficticio», «Suministros Ficticios»). Ningún nombre, teléfono,
  DNI, email ni dirección real; el test lo comprueba con patrones.
- **Validación en CI** (`banco-alejandra.test.mjs`): ids únicos, tipos válidos, 60–100 casos con
  los tres tipos y las 7 etiquetas, la tool esperada está en `tools` del caso, cada argumento
  esperado existe en el esquema y encaja con su tipo/enum, y el evaluador (aciertos y fallos).
  v3: glosario en todos los `system` de experto, turnos con tools bien formados
  (`validarTurnosConTools`: ids únicos, cada `tool` responde a una llamada previa de una tool del
  caso con argumentos JSON; el último mensaje es del usuario o de una tool), errores = mensajes
  reales, último mensaje único por caso, y la conversión a Anthropic del runner local
  (`mensajesOpenAIaAnthropic`: `tool_calls` → `tool_use`, `tool` → `tool_result`) para Haiku.

**Ampliar el banco en el futuro con turnos buenos del historial (no implementado, solo
descrito).** Dónde están hoy los turnos:

- `alejandra_historial` (D1 compartida): pares `user`/`assistant` con `canal`, `contenido`
  (≤ 4000 car.), `usuario_id` y `created_at`; el agente los escribe en `guardarMensajeChat`
  (`alejandra-agente/worker.js`) y recorta a los 200 últimos por usuario; `worker.js` escribe
  ahí los turnos de Telegram y de su canal `web`, sin `usuario_id`. No guarda qué tools se llamaron
  ni con qué argumentos, ni `empresa_id` (se deduce del usuario).
- `alejandra_trazas` (`registrarTraza`, ADR-0014): una traza `feature_usage` por tool ejecutada
  (`tool`, `ok`, error recortado) y trazas `decision`, con `empresa_id`, `usuario_id`,
  `trace_id` y `resumen`/`detalle_json` **ya redactados** (sin emails/teléfonos ni cuerpo de la
  conversación).
- `alejandra_token_uso`: modelo/proveedor/tokens por llamada, sin contenido.
- `chat_mensajes` es el chat de equipo entre personas de la app, **no** el historial de
  Alejandra: no se usa.

Un exportador futuro (con autorización del Director, solo lectura de D1 y solo de la empresa
demo o de turnos con consentimiento) emparejaría cada mensaje `user` de `alejandra_historial`
con la primera traza `feature_usage` con `ok=1` del mismo `usuario_id` en los segundos
siguientes (tool correcta = «turno bueno»), reconstruiría los argumentos a mano o desde la
respuesta, y **anonimizaría antes de escribir nada en el repo**: nombres de personas y
proveedores por ficticios, sin emails, teléfonos, DNI, matrículas ni direcciones, ids de
empresa/obra reales sustituidos por los de la empresa demo, y revisión humana caso por caso.
Nunca se copia contenido real de otra empresa al repositorio.

Sin `AI_POOL_KEY` el pool sale como `omitido_sin_clave` (no es fallo); igual cada proveedor
sin su secreto. Resultado en el artefacto `ai-model-comparison`, carpeta `pool/`:
`report.md` (tabla) y `results.json` (fila por llamada).

**Cómo leerlo:**

- `% acierto` es sobre llamadas *medidas*; un timeout o 503 del pool cuenta como fallo (en
  producción habría sido respaldo, o sea, misma respuesta que hoy pero con la latencia del
  timeout añadida).
- `p50/p95` es latencia HTTP total de las llamadas completadas. Para el router importa el
  p95: si supera ~2 s, el pool empeora la experiencia aunque acierte.
- `Coste USD` es estimado por tarifa (el pool cuenta 0, sin electricidad); `USD/acierto` es
  la métrica para decidir. «N/D» = sin medición, no cero.
- Ejecutar 2–3 repeticiones y una vez «en caliente» (tras una primera pasada): la carga en
  frío del pool (20–120 s) debe verse en la primera repetición y no en las siguientes.
- Criterio orientativo para mantener un uso en el pool: acierto ≥ al de lo actual menos 5
  puntos y p95 dentro del timeout del uso. Si no, `AI_POOL_ENABLED="0"` o retirar ese uso.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Pool como tool que Alejandra decide usar | Descartada por Adrián: el modelo de pago tendría que decidirlo (ya pagas el turno) y añade un paso no determinista. |
| Pool sin respaldo | Descartada: es un servidor doméstico (cortes de luz/red, carga en frío, GPU compartida). |
| Más modelos gratis de OpenRouter | Ya existe y se mantiene detrás del pool; pool compartido entre usuarios con 429 frecuentes. |
| Workers AI de Cloudflare | Coste por uso y modelos distintos; no aprovecha el hardware ya pagado. |
| `[vars]` en `wrangler.toml` para la URL | Descartada: reemplazaría en cada deploy las variables de texto del panel. |
| Mover también Sonnet con tools / planos / visión | Fuera de alcance: calidad no medida (ver «Dirección futura»). |

## Consecuencias

- **Coste**: router, simple, crons, búsqueda y la cadena de respaldo pasan a coste 0 cuando el
  pool responde. Sin pool, coste igual que hoy.
- **Latencia**: en el peor caso (pool colgado) se suma el timeout del uso hasta que el
  circuito se abre (3 fallos) y luego 5 min sin pool. Con carga en frío, el interactivo cae al
  respaldo — correcto.
- **Calidad**: un router que acierta menos manda mensajes al experto equivocado. Se valida
  formato (si no es una etiqueta válida → Haiku), no semántica; para eso está el benchmark.
- **Seguridad**: las tools que pida el pool en el experto simple o en la cadena de respaldo
  pasan por exactamente los mismos filtros (`evaluarInvocacionCognitiva`, barreras SEC-08/09)
  que las de cualquier otro proveedor; el pool no ve tools que el experto no tenga.
- **Operación**: una línea de log nueva por uso, solo con el pool activo; un endpoint admin
  nuevo de solo lectura (`/api/admin/metrics/ai-pool`).
- **Pruebas**: `alejandra-agente/ai-pool.test.js` (sin clave → 0 llamadas; pool OK → se usa;
  503 `model_unavailable`/`request_too_long_for_devices`, 429/401/422/502 → respaldo
  inmediato; timeout → respaldo; respuesta mal formada → respaldo; circuito abierto tras 3
  fallos; métricas sin contenido; coste 0; los dos workers importan el mismo cliente; alias
  `alejandra:1.0` en todos los usos, override `AI_POOL_MODEL`, modelo real por cabecera en
  registro y métrica, alias resuelto a prisma con tools → respaldo `modelo_real_sin_tools` sin
  abrir el circuito), `scripts/ai-benchmark/pool.test.mjs` (incluido el banco con un pool
  simulado), `scripts/ai-benchmark/banco-alejandra.test.mjs`,
  `alejandra-agente/dominio.test.js` (glosario en todos los expertos de los dos cerebros;
  sumidero de Analytics Engine sin contenido y sin efecto sin binding) y
  `scripts/ai-benchmark/metricas-produccion.test.mjs` (solo `SELECT` agregado sin columnas
  personales, tail solo con campos de métrica, AE sin token = sin llamadas). Ninguna llamada real.

## Activación y rollback

Activar (Adrián, cuando el pool esté listo; no lo hace ningún agente):

```powershell
npx wrangler secret put AI_POOL_KEY --name alejandra-agente
npx wrangler secret put AI_POOL_KEY --name alejandra-app-api
```

Para el benchmark del workflow, el mismo secreto `AI_POOL_KEY` en el entorno GitHub
`production`.

Métricas históricas con motivos (opcional, Adrián): descomentar el bloque
`[[analytics_engine_datasets]]` (`AI_POOL_AE` → `alejandra_ai_pool`) de
`alejandra-agente/wrangler.toml` y desplegar; crear un token de API con *Account → Account
Analytics → Read* y usarlo como `CF_API_TOKEN` al ejecutar `metricas-produccion.mjs --fuente ae`.
Si el despliegue falla por el binding, volver a comentarlo (tail y D1 siguen funcionando). Desplegar ambos workers por el workflow manual habitual (los secretos ya
existentes no cambian).

**Rollback** (cualquiera de los tres, sin desplegar código):

- Apagado inmediato: variable de texto `AI_POOL_ENABLED = 0` en el panel de cada worker.
- Cambiar de modelo sin desplegar: variable de texto `AI_POOL_MODEL` (p. ej.
  `qwen3.6:35b-a3b`) en el panel de cada worker; quitarla vuelve al alias `alejandra:1.0`.
- Total: `npx wrangler secret delete AI_POOL_KEY --name <worker>` → todo vuelve exactamente a
  como estaba antes de este ADR (cero llamadas al pool).
- Código: revertir el PR; no hay migraciones ni datos que deshacer.

## Dirección futura (no implementada)

Adrián quiere, más adelante, mover al pool también **herramientas** de Alejandra (por
ejemplo, la generación de planos y otras), de modo que Alejandra solo las invoque cuando las
necesite y el trabajo pesado lo haga el pool. Nada de eso forma parte de este ADR. Cada
herramienta que se quiera mover exigirá: (1) medir su calidad con el benchmark frente a lo
actual antes de moverla, (2) su propio cambio y su propio ADR, y (3) mantener el mismo
principio de respaldo obligatorio y apagado por defecto.

## Referencias

- `CLAUDE.md` — «UNA Alejandra, DOS cerebros»; incidente D1-ESCRITURAS-01.
- `docs/features/comparacion-modelos-ia.md` — piloto sintético existente.
- `.github/workflows/ai-model-benchmark.yml` — workflow manual de comparación.
