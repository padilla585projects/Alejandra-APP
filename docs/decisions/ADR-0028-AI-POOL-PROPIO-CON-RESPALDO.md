# ADR-0028 — Pool de IA propio con respaldo obligatorio

- Identificador: ADR-0028
- Fecha: 2026-10-03
- Estado: **Aceptado — por el Director en chat el 03/10/2026**
- Decisores: Director del Proyecto (Adrián)
- Depende de: ADR-0007 (autonomía de agentes), ADR-0010 (catálogo de tools), regla «dos
  cerebros» de `CLAUDE.md`
- Implementación: `alejandra-agente/ai-pool.js` (cliente único para los dos workers),
  `alejandra-agente/ai-pool.test.js`, `scripts/ai-benchmark/pool.mjs`

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
| a) Router de intención del agente | Haiku | pool `prisma:1.0` (JSON) → Haiku | `clasificarConHaiku` |
| a) Router NEXUS (Telegram) | Haiku | pool `prisma:1.0` (JSON) → Haiku | `nexusRoute` en `worker.js` |
| b) Experto «simple» | OpenRouter gratis → Haiku | pool `qwen3.6` (con tools) → OpenRouter → Haiku | `llamarExperto` |
| b) Cron modo normal | Haiku | pool → Haiku | `scheduled` del agente |
| b) Crons de destilación y compactación | OpenRouter → Haiku | pool → OpenRouter → Haiku | `llamarTextoGratisConFallbackHaiku` |
| b) Resumen de conversación | Haiku | pool → Haiku | resumen en segundo plano del agente |
| c) `buscar_web` del agente | gpt-4o-mini | pool `/v1/tools/search` (+ `/v1/tools/read` si no hay extractos) → gpt-4o-mini | `buscarWebOpenAI` |
| c) `web_search` de Telegram | Tavily | pool `/v1/tools/search` → Tavily | `executeAITool` en `worker.js` |
| d) Cadena cuando cae Anthropic | (Gemini si hay imagen) → Grok → OpenRouter → gpt-4o | (Gemini si hay imagen) → **pool** → Grok → OpenRouter → gpt-4o | `llamarGPT4oFallback` |

Con el experto «simple», si el pool ya dio el texto final sin tools, el streaming de cierre
no vuelve a llamar a Haiku (esa segunda llamada anularía el ahorro).

**No pasa al pool:** los expertos Sonnet con tools, el experto `asistente` de Telegram
(Haiku con tools de notificación y red; `worker.js` no tiene conversión de tools
Anthropic↔OpenAI y el canal dev es el de mayor privilegio), planos SVG, Gemini (OCR, partes,
albaranes, matrículas), notas de voz, Cloud Vision, el escaneo AR (visión, ADR-0027) y
cualquier llamada con imágenes.

### Contrato del pool (confirmado por la sesión del pool, 03/10/2026)

Común: `Authorization: Bearer <AI_POOL_KEY>`, `Content-Type: application/json`. Cuerpos
**estrictos**: un campo desconocido → 422, así que el cliente solo manda campos del contrato.

- `POST /openai/v1/chat/completions` — compatible OpenAI, **sin streaming** (`stream:true` →
  400), cuerpo ≤ 2 MB. `response_format: {"type":"json_object"}` soportado (qwen3.6 ~2,5 s,
  prisma ~0,7 s). Tools formato OpenAI **solo con `qwen3.6:35b-a3b`** (prisma devuelve
  `tool_calls: null`). El cliente manda `model`, `messages`, `max_tokens` y, según el caso,
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
2. Si no, `prisma:1.0` con `response_format: json_object` y timeout de 4 s la convierte en
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
   "resultado":"ok|respaldo|omitido","motivo","ms"}`. Verla con
   `npx wrangler tail alejandra-agente --format json | findstr AIPOOL_METRICA` (o en Workers
   Logs). `resultado=respaldo` = se usó el camino de antes; `motivo` dice por qué (`timeout`,
   `model_unavailable`, `request_too_long_for_devices`, `http_429`, `formato_invalido`,
   `sin_resultados`, …); `omitido` = circuito abierto.
2. Agregados por isolate en `GET /api/admin/metrics/ai-pool` del agente (token admin): por
   uso, `ok/respaldo/omitido`, `tasaExito`, `motivosRespaldo`, `msMedioOk`, `p50MsOk`,
   `p95MsOk`, y el estado del circuito. Es una muestra (un isolate), no el total.
3. Coste y volumen: las llamadas del agente que ya registraban tokens en
   `alejandra_token_uso` ahora registran `modelo='ai_pool:<modelo>'` con `proveedor='ai_pool'`
   y `coste_usd=0` **en la misma fila** que antes escribía Haiku/gpt-4o-mini (no se añaden
   filas). Comparar `SUM(coste_usd)` y `COUNT(*)` por `proveedor` antes/después de activar.

**Benchmark controlado** (workflow manual «Compare AI models (synthetic pilot)», opción
`pool`, o `node scripts/ai-benchmark/pool.mjs`): mismos casos sintéticos para el pool y para
lo de hoy, con el **mismo cliente y los mismos timeouts** que producción.

| Tarea | Pool | Contra | Acierto = |
|---|---|---|---|
| router | `prisma:1.0` y `qwen3.6` | Haiku | etiqueta == esperada (14 casos etiquetados, mismo prompt de producción vía `lib.js`) |
| simple | `qwen3.6` | Haiku | respuesta en español que cumple el patrón del caso, ≤ 1200 car., sin tokens de tool fugados |
| buscar_web | `/v1/tools/search` | gpt-4o-mini web, Tavily | resultados contienen la fuente/término esperado |
| respaldo | `qwen3.6` con tools | Grok-4, gpt-4o | llama a la tool correcta, o responde texto sin tool cuando toca |

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
  fallos; métricas sin contenido; coste 0; los dos workers importan el mismo cliente) y
  `scripts/ai-benchmark/pool.test.mjs`. Ninguna llamada real.

## Activación y rollback

Activar (Adrián, cuando el pool esté listo; no lo hace ningún agente):

```powershell
npx wrangler secret put AI_POOL_KEY --name alejandra-agente
npx wrangler secret put AI_POOL_KEY --name alejandra-app-api
```

Para el benchmark del workflow, el mismo secreto `AI_POOL_KEY` en el entorno GitHub
`production`. Desplegar ambos workers por el workflow manual habitual (los secretos ya
existentes no cambian).

**Rollback** (cualquiera de los tres, sin desplegar código):

- Apagado inmediato: variable de texto `AI_POOL_ENABLED = 0` en el panel de cada worker.
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
