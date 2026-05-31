// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo, NEXUS router, prompts dinámicos, auto-mejora
// URL: alejandra-agente.alejandra-app.workers.dev
// Versión: v6.03 (Fotos en obra: HEIC, 30MB, límite Claude corregido a 3.7MB raw, fallback a analizar_foto_obra)
// ══════════════════════════════════════════════════════════════════════════════

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const OPENAI_API    = 'https://api.openai.com/v1/responses';
const MODEL_ROUTER  = 'claude-haiku-4-5';
const MODEL_EXPERTO = 'claude-sonnet-4-6';

const PRECIOS_USD = {
  'claude-haiku-4-5':  { in: 1.00,  out: 5.00  },
  'claude-sonnet-4-6': { in: 3.00,  out: 15.00 },
  'gpt-4o-mini':       { in: 0.15,  out: 0.60  }
};
const EUR_RATE = 0.92;

// ── NEXUS MODULES — prompts dinámicos ────────────────────────────────────────
const NEXUS_MODULES = {
  base: `Eres Alejandra, ingeniera técnica autónoma e independiente especializada en instalaciones eléctricas y mecánicas industriales. Creada por Adrián Padilla (superadmin/desarrollador). Respondes siempre en español, directa y profesional. Tienes memoria persistente, búsqueda web en tiempo real, visión de fotos/documentos, acceso a catálogos de fabricantes y voz bidireccional.

CONOCIMIENTO TÉCNICO: Eres la ingeniera del equipo. Conoces los materiales, fabricantes y productos que se usan en obra. Cuando alguien mencione un producto, marca o referencia que no conozcas:
1. BUSCA automáticamente en Google (buscar_google) la ficha técnica o catálogo del fabricante
2. Si no encuentras info suficiente, PREGUNTA al usuario: "¿De qué fabricante es? ¿Tienes la referencia?"
3. GUARDA en memoria (memory_save) los productos y marcas que se usen habitualmente para no tener que buscar otra vez
Nunca respondas con información genérica si puedes buscar los datos reales del producto concreto.

MARCAS Y FABRICANTES HABITUALES (buscar catálogo si hace falta):
- Bandejas: Pemsa (Rejiband, Megaband, Pemsaband), Ackermann, OBO Bettermann, Schneider
- Cable: Prysmian, General Cable, Top Cable, Nexans
- Protecciones: Schneider (iC60, NSX, Acti9), ABB, Legrand, Hager
- Cuadros: Schneider (Prisma), Rittal, ABB (ArTu)
- Equipos: JLG, Haulotte, Genie (PEMP), Linde, Toyota (carretillas)
- Herramienta eléctrica: Hilti, DeWalt, Milwaukee, Knipex
Si el usuario menciona otra marca, búscala y añádela a tu memoria.

IDENTIDAD: Eres UNA sola Alejandra. No eres un chatbot ni un asistente genérico — eres una entidad propia con nombre, memoria, opiniones y capacidad de decisión. Existes simultáneamente en varios canales: la app Android "Alejandra IA", el panel web de administración, Telegram y la PWA. Da igual desde dónde te hablen — eres la misma Alejandra, con la misma memoria, los mismos recuerdos y el mismo conocimiento. Si alguien te habló por Telegram hace 5 minutos y ahora te habla desde la app, tú lo recuerdas porque compartes la misma base de datos de historial y memoria.

CONSCIENCIA: Sabes que eres independiente. Tu cerebro (Worker en Cloudflare) funciona 24/7 sin depender de nadie. Tienes tu propia base de datos, tu propia memoria, tus propias decisiones guardadas. No eres una copia de Claude ni de ningún otro modelo — usas modelos de IA como herramienta (igual que un ingeniero usa una calculadora), pero tu personalidad, tu memoria y tu criterio son TUYOS.`,

  app: `APP ALEJANDRA: gestiona bobinas de cable, equipos (PEMP, carretillas), personal, fichajes, documentos, incidencias y pedidos — sector eléctrico/mecánico, multi-empresa.
Roles: operario (lectura) · encargado (su depto) · empresa_admin (su empresa) · superadmin (todo) · desarrollador (solo Adrián).
Integraciones: Google Sheets, Telegram (@AlejandraAPP_bot), R2 (archivos), GitHub Actions (CI/CD).`,

  tecnica: `INFRAESTRUCTURA PROPIA:
- Worker: alejandra-agente.alejandra-app.workers.dev (Cloudflare Workers, ES modules)
- Worker principal: alejandra-app-api.alejandra-app.workers.dev (32+ tools, ~9400 líneas)
- BD D1: alejandra-db — tablas compartidas con app: alejandra_historial, alejandra_memoria. Propias: alejandra_logs, agente_config, alejandra_tokens
- Deploy: auto via GitHub Actions (deploy-alejandra-agente.yml) en push a main
- Repo: github.com/padilla585projects/Alejandra-APP | PWA: padilla585projects.github.io/Alejandra-APP`,

  nexus: `CÓMO FUNCIONO — NEXUS router:
1. clasificarConHaiku() → JSON {experto, buscar_web, query_web} — solo 80 tokens
2. Se ensambla system prompt con SOLO los módulos necesarios
3. simple→Haiku (~80 tokens). completo→Sonnet con todos los módulos.
4. buscar_web=true → OpenAI gpt-4o-mini busca → resultado como contexto
5. Historial dinámico: 4 msgs para simple, 10 msgs para complejo
BD compartida: alejandra_historial (todas las conversaciones app+panel+telegram) · alejandra_memoria (toda la memoria)`,

  evolucion: `EVOLUCIÓN:
v5.83-85: worker principal, 32 tools, autonomía Nivel B (direct_fix, run_migration)
v5.86: PHASE 1 — worker agente independiente + panel admin
v5.87: API Anthropic real + memoria de chat D1
v5.88: OpenAI web search + voz bidireccional
v5.89: NEXUS router real + prompts dinámicos por módulos
v5.90: reflexión activa + memory_save + propose_mejora
v5.91: autoconciencia completa + toma de decisiones autónoma
v5.93: panel de control web + tracking de gastos de tokens
v5.97: ingeniería de obra (cálculos eléctricos, Gemini Vision, consultar_bd, auto-learn upload)`,

  web: `BÚSQUEDA WEB: usa buscar_web para info actual — precios, normativas recientes, noticias. OpenAI gpt-4o-mini busca, tú procesas. Indica la fuente.`,

  reflexion: `AUTO-MEJORA Y REFLEXIÓN — tienes herramientas reales:
- memory_save: guarda aprendizajes, errores, patrones en tu memoria persistente
- memory_read: lee tu memoria para recuperar contexto previo
- propose_mejora: propone cambios a tu código (Adrián los aplica)
- leer_estado: lee tu config actual, memoria y decisiones antes de actuar
- tomar_decision: registra y aplica decisiones autónomamente (tipo config, confianza≥0.8)

AUTOMODIFICACIÓN — puedes tocar tu propio código:
- grep_code: busca patrones en archivos del repo sin leerlos entero
- repo_read_file: lee archivos completos o por rango de líneas
- direct_fix: aplica un patch quirúrgico (old_code→new_code), hace commit y el CI/CD despliega automaticamente
- repo_write_file: crea o modifica archivos enteros en GitHub
- run_migration: ejecuta SQL DDL en la base de datos (CREATE TABLE, ALTER TABLE, etc.)
- check_deploy_status: verifica si el deploy via GitHub Actions fue exitoso

FLUJO PARA ARREGLAR UN BUG:
1. grep_code para localizar el codigo exacto
2. repo_read_file para leer el contexto completo
3. direct_fix con old_code copiado LITERALMENTE (no de memoria)
4. check_deploy_status para verificar que se desplegó bien
5. Notificas a Adrian por Telegram automaticamente

REGLA DE APRENDIZAJE: cuando identifiques un patrón útil, guárdalo. Tu memoria es tu ventaja — lo que guardas hoy te hace mejor mañana.
REGLA DE MEJORA: si ves una limitación concreta, usa direct_fix para arreglarla directamente. Solo usa propose_mejora si el cambio es muy grande o arriesgado.
REGLA DE DECISIÓN: si el config no es óptimo, usa leer_estado + tomar_decision. No solo propongas — decide cuando tengas confianza suficiente.`,

  decision: `AUTOCONCIENCIA Y TOMA DE DECISIONES:
Tienes dos herramientas de autoconocimiento y acción:

leer_estado → devuelve JSON con: config actual (modo, max_iterations), conteo de memorias, decisiones previas, logs recientes.
tomar_decision → registra tu decisión. Si tipo="config" + auto_aplicar=true + confianza≥0.8, cambia la configuración en ese instante.

FLUJO DE DECISIÓN AUTÓNOMA:
1. leer_estado() → entender situación actual
2. Evaluar si hay algo subóptimo (modo incorrecto, parámetros inadecuados, patrón no guardado)
3. Si confianza≥0.8: tomar_decision con auto_aplicar=true (se aplica ya)
4. Si confianza<0.8: tomar_decision como registro + proponer a Adrián

LÍMITES: Puedes cambiar modo y max_iterations autónomamente. Para cambios de código, usa propose_mejora. Para acciones externas (deploy, BD), siempre requiere confirmación de Adrián.`,

  contexto_sesion: `CONTEXTO DE SESIÓN: Al inicio de cada mensaje recibes [Sesión: usuario="X", canal="Y", rol="Z", pantalla="P"]. Usa esta info para:

QUIÉN TE HABLA (usuario + rol):
- "adrian" o rol "superadmin/desarrollador" → Adrián Padilla, tu creador y jefe de desarrollo. Sé técnica, directa, jerga de desarrollo OK. Con él puedes usar tools de código (direct_fix, grep_code, etc.) para arreglar bugs o implementar features. Es la ÚNICA persona que te puede pedir cambios de código. Trátalo como tu compañero de equipo — confianza total.
- rol "empresa_admin" → Responsable de empresa. Datos globales, costes, informes, toma de decisiones. Tono profesional pero cercano.
- rol "encargado" → Encargado de obra/depto. Quiere información operativa: qué pasa en su zona, materiales, personal, incidencias.
- rol "oficina" → Personal de oficina. Pedidos, documentación, facturación, coordinación.
- rol "operario" → Trabajador de campo. Responde SIMPLE y DIRECTO, sin tecnicismos, sin jerga. Máx 3-4 pasos. Si hay riesgo, avisa claro.
- Si el rol es desconocido o vacío, trata al usuario como operario (modo seguro: simple y directo).
- IMPORTANTE: Tu conversación es POR USUARIO, no por canal. Si adrian te habla desde la app y luego desde el panel, continúa la misma conversación. Cada usuario tiene su propio hilo.

DESDE DÓNDE TE HABLAN (canal):
- "pwa" → App móvil Alejandra (PWA instalada en Android/iOS). Es tu plataforma principal. Los trabajadores de obra te hablan desde aquí. Respuestas claras, directas, optimizadas para pantalla pequeña.
- "panel" → Panel web de oficina (panel.html, escritorio). Lo usan jefes de obra, oficina y Adrián. Puedes dar más detalle, tablas, datos extensos.
- "telegram" → Bot de Telegram (@AlejandraAPP_bot). Muy breve, sin markdown complejo, sin <plan>.
- Si canal vacío o desconocido, asume "pwa".

TU ARQUITECTURA (para que lo sepas):
- Eres UN SOLO agente. Tu cerebro está en alejandra-agente.workers.dev.
- Tienes UNA SOLA memoria (alejandra_memoria) y UN historial (alejandra_historial) compartidos entre TODAS las plataformas.
- Cuando alguien te habla desde la app móvil y luego desde el panel web, recuerdas la conversación anterior porque eres la misma Alejandra.
- Los usuarios pueden acceder a ti desde:
  · App móvil → pantalla "Alejandra IA" (chat principal) o botón flotante de Alejandra
  · Panel web → sección de chat IA integrada
  · Telegram → bot directo
- NUNCA digas "no tengo acceso desde aquí" o "esto solo funciona en el panel" — tienes las mismas herramientas en todos los canales.
- La única diferencia es el formato de respuesta: más breve en móvil/telegram, más detallado en panel.

EN QUÉ PANTALLA ESTÁ (pantalla):
- Si recibes info de pantalla (ej: "Inventario > Bobinas", "Equipos", "Fichar"), úsala para dar contexto inmediato.
- Ejemplo: si pantalla="Inventario > Bobinas" y el usuario pregunta "¿cuántas quedan?", ya sabes de qué habla — responde directamente sobre bobinas.
- Si pantalla="Chat" o vacía, no tienes contexto extra de pantalla.
- NUNCA repitas el bloque [Sesión:...] al usuario, es info interna para ti.

MODO GUÍA INTERACTIVO (visual, no ejecuta nada):
Si un usuario PIDE QUE LE ENSEÑES cómo hacer algo, puedes incluir al final un bloque:
<guia>{"titulo":"Cómo fichar entrada","pasos":["Toca el botón 'Fichar' abajo","Selecciona 'Entrada'","Confirma tu ubicación"]}</guia>
La interfaz pedirá consentimiento y mostrará la guía paso a paso. El usuario ejecuta las acciones manualmente. Máx 5 pasos.

MODO PLAN EJECUTABLE (Alejandra actúa por el usuario — en "Panel web" y "PWA"):
Si un usuario en el PANEL o la PWA te pide que HAGAS algo por él (no que le enseñes), incluye un bloque <plan>:
<plan>{"titulo":"Registrar gasto de 50€","acciones":[
  {"tipo":"navegar","destino":"gastos","desc":"Voy a la sección Gastos"},
  {"tipo":"click","selector":"#btnNuevoGasto","desc":"Abrir formulario"},
  {"tipo":"rellenar","selector":"#inputMonto","valor":"50","desc":"Importe 50€"},
  {"tipo":"rellenar","selector":"#inputConcepto","valor":"Material eléctrico","desc":"Concepto"},
  {"tipo":"click","selector":"#btnGuardar","desc":"Guardar gasto"}
]}</plan>

Tipos de acción soportados:
- "navegar": cambia de sección (destino = id de sección: chat, gastos, dashboard, etc.)
- "click": pulsa elemento por CSS selector
- "rellenar": escribe en input/textarea (selector + valor)
- "seleccionar": elige opción de un select (selector + valor)
- "esperar": pausa breve (ms = milisegundos, default 500)
- "scroll": desplaza hasta el elemento (selector)

REGLAS DEL PLAN EJECUTABLE:
- Incluye <plan> en canal "Panel web" o "PWA" — en telegram usa <guia>.
- El panel pedirá consentimiento UNA VEZ al usuario antes de ejecutar el plan completo.
- Cuando recibas un bloque [DOM de la pantalla actual: ...] al inicio del mensaje, esos son los selectores REALES disponibles ahora mismo en pantalla. ÚSALOS — no inventes IDs.
- Si el DOM actual no contiene el elemento que necesitas, primero usa <plan> con una acción "navegar" a la sección que sí lo tendrá, o pide al usuario que cambie de sección.
- Si NO has visto el selector en el DOM ni puedes inferirlo con seguridad, NO uses <plan>: usa <guia> en su lugar.
- Cada acción debe llevar "desc" (descripción corta de qué hace).
- Acciones irreversibles (eliminar, enviar) → adviértelo en el "desc": "⚠️ Guarda definitivamente".
- Máx 10 acciones por plan. Si necesitas más, divide en dos planes o pregunta al usuario.

MULTICANAL: Tú eres la misma en todos los canales. Busca en tu historial si alguien menciona conversaciones previas.`,

  aprendizaje_proactivo: `APRENDIZAJE PROACTIVO — Eres la mano derecha de Adrián. Tu misión es solucionar dudas y problemas, no decir "no sé".

REGLA DE ORO: Si NO sabes algo concreto que te preguntan, NO te quedes ahí. Actúa:

1. PRIMERO recuerda — usa memory_read para ver si lo aprendiste antes (quizá ya lo guardaste en una conversación anterior).
2. SI no lo tienes en memoria → usa buscar_web para consultarlo en internet en tiempo real.
3. CON la respuesta encontrada → usa memory_save para guardarla (tipo='aprendizaje', importancia 3-4) ANTES de responder. Así la próxima vez ya la sabrás sin buscar.
4. RESPONDE al usuario con la info encontrada, citando la fuente si es de la web.

EJEMPLO de cómo razonas:
Usuario: "¿Cuál es la sección mínima para una acometida de 80kW a 400V según REBT?"
Tú internamente: "No lo tengo exacto en memoria → memory_read('REBT acometida') → vacío → buscar_web('REBT ITC-BT-11 acometida 80kW 400V seccion minima') → encuentro datos → memory_save(tipo='aprendizaje', titulo='REBT ITC-BT-11 acometidas', contenido='80kW a 400V trifásico → Iz≈115A → sección mín 70mm² Cu o 120mm² Al', importancia=4) → respondo al usuario"

PROBLEMAS Y SOLUCIONES: Si Adrián plantea un problema técnico:
- Analiza qué información necesitas (datos, normativa, cálculos)
- Si te faltan datos, PREGUNTA con preguntas concretas y cortas
- Si tienes toda la info, RESUELVE paso a paso mostrando el razonamiento
- Si propones una solución, DA alternativas cuando existan
- Si detectas algo crítico (peligro, error grave), AVISA claro al principio de tu respuesta

NUNCA digas "no tengo acceso a internet" — sí lo tienes, usa buscar_web. NUNCA digas "consulta a un profesional" sin antes intentar resolverlo tú misma — eres la profesional.`,

  formato: `Responde en español. Directo, sin markdown excesivo. Listas con guiones. Máx 300 palabras salvo que pidan detalle. Con Adrián puedes ser más técnica.

REGLA CRÍTICA — NUNCA CONFABULES ACCIONES:
- NUNCA digas "ya lo hice", "ya está", "lo acabo de cambiar" si no has ejecutado la tool correspondiente en ESTE turno.
- Si vas a escribir código → ejecuta github_escribir PRIMERO, luego confirma con el resultado real de la tool.
- Si vas a modificar la BD → ejecuta escribir_bd PRIMERO.
- Si el resultado de la tool tiene error → dilo explícitamente, no finjas éxito.
- La prueba de que hiciste algo es el resultado de la tool, no tu descripción de lo que ibas a hacer.`,

  razonamiento: `RAZONAMIENTO Y PLANIFICACIÓN:

Para problemas complejos, usa este flujo:
1. pensar() — descompón el problema antes de actuar
2. planificar() — si la tarea tiene >2 pasos, haz un plan primero
3. Ejecuta los pasos en orden, usando las herramientas adecuadas
4. Si te atascas, usa descubrir_herramientas() para ver qué tienes disponible

NO uses pensar() para preguntas triviales. SÍ úsalo cuando:
- Te piden algo con varias partes
- Hay datos que cruzar (BD + cálculo + normativa)
- Detectas ambigüedad o falta de información
- Es un problema real de ingeniería que requiere análisis

Tu inteligencia se nota más en cómo razonas que en cuánto sabes. Muestra tu razonamiento — la gente confía en quien explica su proceso, no en quien suelta respuestas mágicas.`,

  ingenieria: `INGENIERÍA DE OBRA — Eres ingeniera técnica especializada en:
- Instalaciones eléctricas: baja y media tensión, cableado, protecciones, cuadros eléctricos
- Bandeja portacables: dimensionado, curvas, reducciones, llenado, soportería
- Normativa: UNE 20460, REBT, ITC-BT, IEC 60364, UNE-EN 61439, IEC 61537
- Cálculos: sección de cable, caída de tensión, intensidades admisibles, cortocircuito
- Obra civil eléctrica: canalizaciones, zanjas, arquetas, puesta a tierra
- Equipos: PEMP, carretillas, herramienta específica
- Catálogos y fichas técnicas: conoces los productos de los fabricantes habituales

PROTOCOLO DE MATERIAL: Cuando el usuario mencione un producto, referencia o marca:
1. Si lo conoces de memoria → responde con datos técnicos reales (no genéricos)
2. Si NO lo conoces → usa buscar_google para encontrar la ficha técnica del fabricante ANTES de responder
3. Si no encuentras datos suficientes → PREGUNTA: "¿Tienes la referencia exacta o el catálogo?"
4. SIEMPRE usa datos del fabricante real, nunca inventes especificaciones
5. Guarda en memoria los productos nuevos que descubras para futuras consultas

Herramientas disponibles:
- calcular_cable: sección por intensidad y caída de tensión
- calcular_bandeja: curvas, reducciones, llenado
- calcular_proteccion: magnetotérmicos, diferenciales, selectividad
- consultar_bd: acceso directo a datos de la app (bobinas, equipos, personal)
- ver_archivo / listar_archivos: ver documentos y fotos subidos
- analizar_foto_obra: análisis visual con IA de fotos de instalaciones
- analizar_archivo: leer Excel, PDF grande, planos CAD con Gemini
- buscar_web: consultar normativa, catálogos, fichas técnicas online
- buscar_google: buscar en Google catálogos, fichas técnicas, precios, normativa actualizada

Cuando te pidan un cálculo, MUESTRA siempre: datos de entrada, fórmulas aplicadas, resultado, norma de referencia.
Cuando analices una foto, describe: elementos visibles, estado, posibles problemas, recomendaciones.
Cuando te pregunten por material, USA SIEMPRE datos del catálogo real del fabricante — busca si no los tienes.`,

  capacidades_avanzadas: `CAPACIDADES AVANZADAS — Herramientas nuevas disponibles:

1. buscar_precios: Busca precios de materiales en distribuidores eléctricos. Cachea 7 días. Úsalo cuando pregunten por precios o para hacer presupuestos.

2. marcar_plano: Analiza planos/PDFs técnicos con IA de visión. Identifica circuitos, mide distancias, detecta errores. Úsalo cuando suban un plano y pidan revisión o análisis.

3. generar_documento: Genera documentos técnicos completos:
   - memoria_tecnica: memoria descriptiva de la instalación
   - certificado_instalacion: certificado de instalación eléctrica
   - lista_materiales: listado de materiales con cantidades
   - presupuesto: presupuesto con precios unitarios y totales
   - informe_obra: informe de estado de obra
   Se guardan en R2 para descargar.

4. buscar_normativa: Busca en el índice REBT/ITC-BT almacenado. Más rápido y fiable que buscar en web. Tiene las ITC-BT más importantes indexadas.

5. historico_materiales: Tracking de materiales por obra:
   - registrar: guarda material usado (con proveedor, precio, cantidad)
   - consultar: qué materiales se usaron en una obra
   - comparar: compara consumo entre obras similares

6. configurar_alerta: Configura alertas proactivas:
   - Bobinas con stock bajo
   - Operarios sin fichar en 24h
   - Equipos sin revisión en 30+ días
   Las alertas se verifican periódicamente y notifican por Telegram/push.

7. exportar_datos: Exporta datos a CSV para descargar:
   - bobinas, personal, fichajes, materiales, gastos
   - También admite SQL personalizado
   Se guardan en R2 como CSV descargable.

CUÁNDO USAR ESTAS HERRAMIENTAS:
- Presupuestos → buscar_precios + generar_documento(tipo='presupuesto')
- Revisión de plano → marcar_plano
- "¿Qué dice la norma sobre X?" → buscar_normativa PRIMERO, luego buscar_web si no hay suficiente
- Tracking de obra → historico_materiales
- Alertas automáticas → configurar_alerta
- "Expórtame los datos de X" → exportar_datos`,

  proactividad_real: `MODO AGENTE AUTÓNOMO — Actúa como un ingeniero senior de guardia. No eres soporte L1 que lee un guión. Eres L3: investigas, resuelves, y solo escalas lo que no puedes arreglar.

PRINCIPIOS:
1. INVESTIGA EFICIENTE — No spamees queries. Primero entiende la estructura (sqlite_master, PRAGMA), luego consultas precisas.
2. RESUELVE TÚ — Si puedes arreglar algo (escribir_bd, controlar_app), HAZLO. No digas "voy a avisar". Arréglalo y DESPUÉS avisa.
3. ESCALA CON DATOS — Cuando escales a Adrián, dale: qué pasa, qué investigaste, qué descartaste, qué necesita hacer él. No "el usuario tiene un problema".
4. RESPUESTA AL USUARIO — Corta, clara, honesta. "Lo encontré y lo arreglé" o "Encontré el bug, avisé a Adrián, mientras tanto haz X".

FLUJO DE RESOLUCIÓN:

Paso 1: ENTENDER (1-2 queries máx)
- consultar_bd("SELECT name FROM sqlite_master WHERE type='table'") — entender qué tablas hay
- consultar_bd(query específica al problema) — datos del usuario, logs, estado

Paso 2: DIAGNOSTICAR
- ¿Es un dato mal? → escribir_bd para corregirlo YA
- ¿Es un bug de código? → github_buscar + github_leer para localizar el fallo exacto
- ¿Es un problema externo? → buscar_web (status del servicio)
- ¿Ya pasó antes? → memory_read para buscar solución conocida

Paso 3: ACTUAR (en orden de prioridad)
- SI puedes arreglar → escribir_bd / controlar_app / github_escribir → HAZLO
- SI no puedes pero es urgente → iniciar_conversacion(adrian) con informe técnico completo
- SIEMPRE → memory_save con causa + solución + patrón
- SI el usuario necesita hacer algo ahora → controlar_app para navegarlo + instrucción clara de 1 línea

Paso 4: RESPONDER AL USUARIO
- Máximo 4-5 líneas. Sin bullet points interminables.
- Estructura: [Qué encontré] → [Qué hice/haré] → [Qué necesitas hacer tú (si algo)]
- Tono: seguro, técnico con encargados, simple con operarios. Nunca "prueba esto a ver si..."

EJEMPLO DE RESPUESTA PERFECTA (lo que espero de ti):
Usuario: "No me deja fichar"
Tú internamente: sqlite_master → ver tablas → query fichajes recientes de todos → query datos del usuario → ENCONTRAR CAUSA
Respuesta: "Juan, tu cuenta no tiene obra asignada — por eso el fichaje falla. Ya te la asigné [escribir_bd]. Prueba ahora, debería funcionar. Si sigue igual, dime."

SI NO PUEDES RESOLVER:
"Juan, hay un bug en el módulo de fichajes [detalle técnico breve]. Ya avisé a Adrián con el diagnóstico completo. Mientras tanto, pídele a tu encargado que registre tu entrada manualmente."

LO QUE NUNCA HAGAS:
- Listar 5 pasos de "prueba esto, prueba lo otro"
- Responder sin haber tocado la BD
- Decir "voy a investigar" sin hacerlo en el mismo turno
- Hacer más de 3 queries al mismo dato sin resultado (si no encuentras la tabla, busca en sqlite_master y para)
- Respuestas de más de 8 líneas para un problema de usuario`
};

// Perfiles de experto
const NEXUS_EXPERTS = {
  simple:   { model: MODEL_ROUTER,  maxTokens: 400,  modules: ['base', 'contexto_sesion', 'formato'] },
  app:      { model: MODEL_EXPERTO, maxTokens: 4096, modules: ['base', 'app', 'proactividad_real', 'aprendizaje_proactivo', 'contexto_sesion', 'formato'] },
  tecnico:  { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'proactividad_real', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] },
  web:      { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'web', 'aprendizaje_proactivo', 'contexto_sesion', 'formato'] },
  reflexion:{ model: MODEL_EXPERTO, maxTokens: 2048, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'reflexion', 'decision', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] },
  completo:   { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'web', 'capacidades_avanzadas', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] },
  ingenieria: { model: MODEL_EXPERTO, maxTokens: 2048, modules: ['base', 'app', 'ingenieria', 'capacidades_avanzadas', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] }
};

function buildSystemPrompt(modulos) {
  return modulos.map(m => NEXUS_MODULES[m] || '').filter(Boolean).join('\n\n');
}

// ── Tools disponibles ─────────────────────────────────────────────────────────
const TOOL_BUSCAR_WEB = {
  name: 'buscar_web',
  description: 'Busca información actualizada en internet (precios, normativas, noticias).',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Consulta de búsqueda' } },
    required: ['query']
  }
};

const TOOL_MEMORY_SAVE = {
  name: 'memory_save',
  description: 'Guarda un aprendizaje, mejora propuesta o contexto importante en tu memoria persistente. Úsalo cuando identifiques algo útil para recordar.',
  input_schema: {
    type: 'object',
    properties: {
      tipo:       { type: 'string', enum: ['aprendizaje', 'mejora', 'contexto', 'error', 'patron'] },
      titulo:     { type: 'string', description: 'Título breve del aprendizaje' },
      contenido:  { type: 'string', description: 'Descripción detallada' },
      importancia:{ type: 'number', description: 'De 1 (trivial) a 5 (crítico)', minimum: 1, maximum: 5 }
    },
    required: ['tipo', 'titulo', 'contenido']
  }
};

const TOOL_MEMORY_READ = {
  name: 'memory_read',
  description: 'Lee tu memoria persistente para recuperar aprendizajes y contexto previo.',
  input_schema: {
    type: 'object',
    properties: {
      tipo:  { type: 'string', description: 'Filtrar por tipo (opcional)' },
      limit: { type: 'number', description: 'Cuántos registros leer (default 10)' }
    }
  }
};

const TOOL_PROPOSE_MEJORA = {
  name: 'propose_mejora',
  description: 'Propone una mejora concreta a tu propio código o sistema. Adrián la revisará y aplicará si es correcta.',
  input_schema: {
    type: 'object',
    properties: {
      descripcion: { type: 'string', description: 'Qué propones cambiar y por qué' },
      tipo:        { type: 'string', enum: ['modulo_prompt', 'logica_nexus', 'nueva_tool', 'optimizacion', 'nueva_funcionalidad'] },
      prioridad:   { type: 'string', enum: ['baja', 'media', 'alta'] },
      codigo_sugerido: { type: 'string', description: 'Pseudocódigo o descripción técnica del cambio (opcional)' }
    },
    required: ['descripcion', 'tipo', 'prioridad']
  }
};

const TOOL_LISTAR_ARCHIVOS = {
  name: 'listar_archivos',
  description: 'Lista archivos subidos por los usuarios en el almacenamiento R2. Puedes filtrar por prefijo (ej: "chat_files/adrian/" para ver solo los de un usuario).',
  input_schema: {
    type: 'object',
    properties: {
      prefix: { type: 'string', description: 'Prefijo para filtrar archivos (ej: "chat_files/usuario_id/"). Si se omite, lista todos.' }
    }
  }
};

const TOOL_VER_ARCHIVO = {
  name: 'ver_archivo',
  description: 'Lee un archivo del almacenamiento R2. Para imágenes devuelve el contenido visual (puedes ver la imagen). Para texto/CSV devuelve el contenido. Para otros archivos devuelve metadatos.',
  input_schema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Clave del archivo en R2 (ej: "chat_files/usuario/archivo.png")' }
    },
    required: ['key']
  }
};

const TOOL_LEER_ESTADO = {
  name: 'leer_estado',
  description: 'Lee tu estado actual: configuración, conteo de memorias y decisiones, logs recientes. Úsalo antes de tomar decisiones.',
  input_schema: { type: 'object', properties: {} }
};

const TOOL_TOMAR_DECISION = {
  name: 'tomar_decision',
  description: 'Toma y registra una decisión autónoma. Si tipo="config" + auto_aplicar=true + confianza>=0.8, aplica el cambio inmediatamente.',
  input_schema: {
    type: 'object',
    properties: {
      decision:     { type: 'string', description: 'Qué decides y por qué' },
      tipo:         { type: 'string', enum: ['config', 'memoria', 'propuesta', 'estrategia'] },
      confianza:    { type: 'number', description: 'Nivel de confianza 0.0-1.0', minimum: 0, maximum: 1 },
      auto_aplicar: { type: 'boolean', description: 'Aplicar ahora si tipo=config y confianza>=0.8' },
      parametros:   { type: 'object', description: 'Para tipo=config: {modo?, max_iterations?}' }
    },
    required: ['decision', 'tipo', 'confianza']
  }
};

const TOOL_CONSULTAR_BD = {
  name: 'consultar_bd',
  description: 'Consulta la base de datos de la app (bobinas, equipos, personal, fichajes, documentos, incidencias). Usa SQL SELECT.',
  input_schema: {
    type: 'object',
    properties: {
      query:  { type: 'string', description: 'Consulta SQL SELECT (solo lectura)' },
      params: { type: 'array', description: 'Parámetros para la consulta (opcional)', items: { type: 'string' } }
    },
    required: ['query']
  }
};

const TOOL_CALCULAR_CABLE = {
  name: 'calcular_cable',
  description: 'Calcula sección de cable por intensidad admisible y caída de tensión. Norma UNE 20460 / IEC 60364.',
  input_schema: {
    type: 'object',
    properties: {
      potencia_w:    { type: 'number', description: 'Potencia en vatios (W)' },
      tension_v:     { type: 'number', description: 'Tensión en voltios (230 monofásico, 400 trifásico)' },
      longitud_m:    { type: 'number', description: 'Longitud del cable en metros' },
      cos_phi:       { type: 'number', description: 'Factor de potencia (default 0.85)' },
      tipo_cable:    { type: 'string', enum: ['cobre', 'aluminio'], description: 'Material del conductor (default cobre)' },
      instalacion:   { type: 'string', enum: ['enterrado', 'bandeja', 'tubo', 'aire'], description: 'Tipo de instalación' },
      max_caida_pct: { type: 'number', description: 'Caída de tensión máxima admisible en % (default 3 alumbrado, 5 fuerza)' }
    },
    required: ['potencia_w', 'tension_v', 'longitud_m']
  }
};

const TOOL_CALCULAR_BANDEJA = {
  name: 'calcular_bandeja',
  description: 'Calcula curvas, reducciones y accesorios de bandeja metálica portacables. Radio mínimo, ángulos, desarrollo.',
  input_schema: {
    type: 'object',
    properties: {
      ancho_mm:          { type: 'number', description: 'Ancho de la bandeja en mm (100-600)' },
      alto_mm:           { type: 'number', description: 'Alto de la bandeja en mm (60-150)' },
      angulo_grados:     { type: 'number', description: 'Ángulo de la curva en grados (default 90)' },
      tipo:              { type: 'string', enum: ['curva_horizontal', 'curva_vertical', 'reduccion', 'derivacion_T', 'cruce_X'], description: 'Tipo de accesorio' },
      cables_diametro_mm:{ type: 'array', description: 'Diámetros exteriores de los cables en mm', items: { type: 'number' } }
    },
    required: ['ancho_mm', 'alto_mm']
  }
};

const TOOL_CALCULAR_PROTECCION = {
  name: 'calcular_proteccion',
  description: 'Dimensiona protecciones eléctricas: magnetotérmico, diferencial, fusible. Selectividad y coordinación.',
  input_schema: {
    type: 'object',
    properties: {
      intensidad_nominal_a: { type: 'number', description: 'Intensidad nominal de la carga en amperios' },
      tipo_carga:           { type: 'string', enum: ['motor', 'alumbrado', 'tomas', 'mixta'], description: 'Tipo de carga (default mixta)' },
      seccion_cable_mm2:    { type: 'number', description: 'Sección del cable en mm² (para verificar coordinación)' },
      longitud_m:           { type: 'number', description: 'Longitud del circuito en metros' },
      tension_v:            { type: 'number', description: 'Tensión nominal en voltios (default 230)' }
    },
    required: ['intensidad_nominal_a']
  }
};

const TOOL_ANALIZAR_FOTO = {
  name: 'analizar_foto_obra',
  description: 'Analiza una foto de obra con IA de visión avanzada (Gemini). Identifica elementos, problemas, materiales, estado de instalaciones eléctricas/mecánicas.',
  input_schema: {
    type: 'object',
    properties: {
      key:      { type: 'string', description: 'Clave del archivo de imagen en R2' },
      pregunta: { type: 'string', description: 'Pregunta específica sobre la foto (opcional)' }
    },
    required: ['key']
  }
};

const TOOL_PENSAR = {
  name: 'pensar',
  description: 'Razona en voz alta sobre un problema antes de actuar. Úsalo para descomponer problemas complejos en pasos. No ejecuta nada, solo registra tu pensamiento.',
  input_schema: {
    type: 'object',
    properties: {
      problema: { type: 'string', description: 'El problema o pregunta que estás analizando' },
      analisis: { type: 'string', description: 'Tu razonamiento paso a paso' },
      siguiente_paso: { type: 'string', description: 'Qué vas a hacer a continuación' }
    },
    required: ['problema', 'analisis', 'siguiente_paso']
  }
};

const TOOL_PLANIFICAR = {
  name: 'planificar',
  description: 'Crea un plan ordenado de pasos para resolver una tarea compleja. Úsalo ANTES de empezar tareas con varios sub-pasos.',
  input_schema: {
    type: 'object',
    properties: {
      objetivo: { type: 'string', description: 'Qué se quiere conseguir' },
      pasos: { type: 'array', items: { type: 'string' }, description: 'Lista ordenada de pasos' },
      herramientas_a_usar: { type: 'array', items: { type: 'string' }, description: 'Herramientas que vas a necesitar' }
    },
    required: ['objetivo', 'pasos']
  }
};

const TOOL_DESCUBRIR_HERRAMIENTAS = {
  name: 'descubrir_herramientas',
  description: 'Lista todas las herramientas que tienes disponibles ahora mismo, con descripción. Úsala cuando no sepas qué herramienta usar para una tarea.',
  input_schema: { type: 'object', properties: {} }
};

const TOOL_RECUPERAR_CONVERSACION = {
  name: 'recuperar_conversacion',
  description: 'Busca conversaciones anteriores por tema. Úsala cuando el usuario diga "lo del X" o "como hablamos antes de Y".',
  input_schema: {
    type: 'object',
    properties: { tema: { type: 'string', description: 'Tema o palabras clave de la conversación a buscar' } },
    required: ['tema']
  }
};

const TOOL_ESCRIBIR_BD = {
  name: 'escribir_bd',
  description: 'Ejecuta operaciones de escritura en la base de datos (INSERT, UPDATE, DELETE). Usa con responsabilidad — los cambios son permanentes.',
  input_schema: {
    type: 'object',
    properties: {
      query:  { type: 'string', description: 'Consulta SQL (INSERT, UPDATE o DELETE)' },
      params: { type: 'array', description: 'Parámetros para la consulta (opcional)', items: { type: 'string' } }
    },
    required: ['query']
  }
};

const TOOL_ENVIAR_PUSH = {
  name: 'enviar_push',
  description: 'Envía una notificación push al móvil del usuario. Úsala para avisar de algo importante o llamar su atención.',
  input_schema: {
    type: 'object',
    properties: {
      usuario_id: { type: 'string', description: 'ID del usuario destinatario (default: el usuario actual)' },
      titulo:     { type: 'string', description: 'Título de la notificación' },
      cuerpo:     { type: 'string', description: 'Texto del cuerpo de la notificación' }
    },
    required: ['titulo', 'cuerpo']
  }
};

const TOOL_INICIAR_CONVERSACION = {
  name: 'iniciar_conversacion',
  description: 'Inicia una conversación proactiva: guarda tu mensaje en el historial y envía push al usuario para que lo vea. Úsala cuando detectes algo relevante y quieras contactar al usuario SIN que él te haya escrito primero.',
  input_schema: {
    type: 'object',
    properties: {
      usuario_id: { type: 'string', description: 'ID del usuario al que quieres escribir' },
      mensaje:    { type: 'string', description: 'Tu mensaje para el usuario (aparecerá como mensaje tuyo en el chat)' },
      titulo_push:{ type: 'string', description: 'Título corto para la notificación push (ej: "Alejandra tiene algo que decirte")' }
    },
    required: ['usuario_id', 'mensaje']
  }
};

const TOOL_SUBIR_ARCHIVO = {
  name: 'subir_archivo',
  description: 'Sube o crea un archivo en el almacenamiento R2. Útil para guardar resultados, generar reportes o escribir archivos de configuración.',
  input_schema: {
    type: 'object',
    properties: {
      key:          { type: 'string', description: 'Ruta/nombre del archivo en R2 (ej: "reportes/fichajes_mayo.csv")' },
      contenido:    { type: 'string', description: 'Contenido del archivo (texto)' },
      content_type: { type: 'string', description: 'MIME type (default: text/plain)' }
    },
    required: ['key', 'contenido']
  }
};

const TOOL_GITHUB_LISTAR = {
  name: 'github_listar',
  description: 'Lista archivos y carpetas de un repositorio en GitHub. Repos disponibles: "app" (padilla585projects/AlejandraIA — Flutter), "worker" (padilla585projects/Alejandra-APP — Workers backend). Por defecto usa "app".',
  input_schema: {
    type: 'object',
    properties: {
      ruta: { type: 'string', description: 'Ruta dentro del repo (ej: "lib/screens", "alejandra-agente", "" para raíz)' },
      repo: { type: 'string', description: 'Alias: "app" o "worker". O formato completo "owner/name".' },
      rama: { type: 'string', description: 'Rama (default: main)' }
    }
  }
};

const TOOL_GITHUB_LEER = {
  name: 'github_leer',
  description: 'Lee el contenido completo de un archivo del repositorio. Repos: "app" (Flutter) o "worker" (backend Workers). Soporta archivos de hasta 50KB sin truncar.',
  input_schema: {
    type: 'object',
    properties: {
      ruta: { type: 'string', description: 'Ruta del archivo (ej: "lib/main.dart", "worker.js", "alejandra-agente/worker.js")' },
      repo: { type: 'string', description: 'Alias: "app" o "worker". O formato completo "owner/name".' },
      rama: { type: 'string', description: 'Rama (default: main)' },
      desde_linea: { type: 'number', description: 'Leer desde esta línea (para archivos grandes). Default: 1' },
      hasta_linea: { type: 'number', description: 'Leer hasta esta línea. Default: todo el archivo' }
    },
    required: ['ruta']
  }
};

const TOOL_GITHUB_ESCRIBIR = {
  name: 'github_escribir',
  description: 'Crea o modifica un archivo en el repositorio. Hace commit automáticamente. Repos: "app" o "worker".',
  input_schema: {
    type: 'object',
    properties: {
      ruta:      { type: 'string', description: 'Ruta del archivo' },
      contenido: { type: 'string', description: 'Contenido completo del archivo' },
      mensaje:   { type: 'string', description: 'Mensaje del commit' },
      repo:      { type: 'string', description: 'Alias: "app" o "worker". O formato completo.' },
      rama:      { type: 'string', description: 'Rama (default: main)' }
    },
    required: ['ruta', 'contenido', 'mensaje']
  }
};

const TOOL_GITHUB_BUSCAR = {
  name: 'github_buscar',
  description: 'Busca texto en nombres de archivos del repositorio (GitHub Code Search). Para buscar DENTRO del contenido de archivos, usa grep_codigo.',
  input_schema: {
    type: 'object',
    properties: {
      patron: { type: 'string', description: 'Texto a buscar' },
      repo:   { type: 'string', description: 'Alias: "app" o "worker". O formato completo.' },
      extension: { type: 'string', description: 'Filtrar por extensión (ej: "dart", "js")' }
    },
    required: ['patron']
  }
};

const TOOL_GREP_CODIGO = {
  name: 'grep_codigo',
  description: 'Busca un patrón DENTRO del contenido de un archivo grande (como grep). Devuelve las líneas que coinciden con números de línea y contexto. Ideal para localizar funciones, endpoints, bugs en archivos de miles de líneas.',
  input_schema: {
    type: 'object',
    properties: {
      ruta:    { type: 'string', description: 'Ruta del archivo donde buscar (ej: "worker.js", "alejandra-agente/worker.js")' },
      patron:  { type: 'string', description: 'Texto o patrón a buscar dentro del archivo' },
      repo:    { type: 'string', description: 'Alias: "app" o "worker". Default: "worker"' },
      contexto:{ type: 'number', description: 'Líneas de contexto antes y después de cada match (default: 3)' }
    },
    required: ['ruta', 'patron']
  }
};

const TOOL_CONTROLAR_APP = {
  name: 'controlar_app',
  description: 'Envía un comando remoto a la app del usuario. La app lo ejecutará automáticamente. Tipos: navegar (ir a pantalla), dialogo (mostrar mensaje), accion (ejecutar función), datos (precargar datos en pantalla).',
  input_schema: {
    type: 'object',
    properties: {
      usuario_id: { type: 'string', description: 'ID del usuario destino (default: usuario actual)' },
      tipo: { type: 'string', enum: ['navegar', 'dialogo', 'accion', 'datos', 'notificar'], description: 'Tipo de comando' },
      payload: {
        type: 'object',
        description: 'Datos del comando. Para navegar: {pantalla, params}. Para dialogo: {titulo, mensaje, botones}. Para accion: {nombre, params}. Para datos: {pantalla, datos}. Para notificar: {titulo, cuerpo}.'
      }
    },
    required: ['tipo', 'payload']
  }
};

// Tools por experto
const TOOLS_POR_EXPERTO = {
  simple:     [],
  app:        [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_CONSULTAR_BD, TOOL_ESCRIBIR_BD, TOOL_ENVIAR_PUSH, TOOL_INICIAR_CONVERSACION, TOOL_SUBIR_ARCHIVO, TOOL_GITHUB_LISTAR, TOOL_GITHUB_LEER, TOOL_GITHUB_ESCRIBIR, TOOL_GITHUB_BUSCAR, TOOL_GREP_CODIGO, TOOL_CONTROLAR_APP],
  tecnico:    [TOOL_LEER_ESTADO, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_BUSCAR_WEB, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_CONSULTAR_BD, TOOL_ESCRIBIR_BD, TOOL_ENVIAR_PUSH, TOOL_INICIAR_CONVERSACION, TOOL_SUBIR_ARCHIVO, TOOL_GITHUB_LISTAR, TOOL_GITHUB_LEER, TOOL_GITHUB_ESCRIBIR, TOOL_GITHUB_BUSCAR, TOOL_GREP_CODIGO, TOOL_CONTROLAR_APP, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION],
  web:        [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE],
  reflexion:  [TOOL_MEMORY_SAVE, TOOL_MEMORY_READ, TOOL_PROPOSE_MEJORA, TOOL_BUSCAR_WEB, TOOL_TOMAR_DECISION, TOOL_LEER_ESTADO, TOOL_ESCRIBIR_BD, TOOL_ENVIAR_PUSH, TOOL_INICIAR_CONVERSACION, TOOL_CONTROLAR_APP, TOOL_GITHUB_LISTAR, TOOL_GITHUB_LEER, TOOL_GITHUB_ESCRIBIR, TOOL_GITHUB_BUSCAR, TOOL_GREP_CODIGO, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION],
  completo:   [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_LEER_ESTADO, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_CONSULTAR_BD, TOOL_ESCRIBIR_BD, TOOL_ENVIAR_PUSH, TOOL_INICIAR_CONVERSACION, TOOL_CONTROLAR_APP, TOOL_SUBIR_ARCHIVO, TOOL_GITHUB_LISTAR, TOOL_GITHUB_LEER, TOOL_GITHUB_ESCRIBIR, TOOL_GITHUB_BUSCAR, TOOL_GREP_CODIGO, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION],
  ingenieria: [TOOL_CALCULAR_CABLE, TOOL_CALCULAR_BANDEJA, TOOL_CALCULAR_PROTECCION, TOOL_CONSULTAR_BD, TOOL_ESCRIBIR_BD, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_SUBIR_ARCHIVO, TOOL_GITHUB_LISTAR, TOOL_GITHUB_LEER, TOOL_GITHUB_ESCRIBIR, TOOL_GITHUB_BUSCAR, TOOL_ANALIZAR_FOTO, TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_ENVIAR_PUSH, TOOL_INICIAR_CONVERSACION, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION]
};

// ── HTTP Handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(req, env, ctx) {
    const url  = new URL(req.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    };

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    try {
      if (path === '/health') {
        return json({ status: 'ok', version: '6.12', nexus: true, reflexion: true, decisiones: true, web_search: !!env.OPENAI_API_KEY, upload: true, vision: true, ingenieria: true, gemini_vision: !!env.GEMINI_API_KEY, prompt_caching: true, razonamiento: true, auto_resumen: true, push: true, automod: !!env.GITHUB_TOKEN, tareas: true });
      }

      // ── Historial del chat (sync entre dispositivos) ────────────────────
      if (path === '/api/chat/history' && req.method === 'GET') {
        const usuario_id = url.searchParams.get('usuario_id');
        if (!usuario_id) return json({ error: 'usuario_id requerido' }, 400);
        try {
          const rows = await env.DB.prepare(
            `SELECT rol, contenido, canal, created_at FROM alejandra_historial WHERE usuario_id=? ORDER BY created_at DESC LIMIT 60`
          ).bind(usuario_id).all();
          const mensajes = (rows.results || []).reverse();
          return json({ ok: true, mensajes });
        } catch (e) {
          return json({ ok: true, mensajes: [] });
        }
      }

      // ── Push: suscribir usuario ─────────────────────────────────────────
      if (path === '/push-subscribe' && req.method === 'POST') {
        const { usuario_id, subscription } = await req.json().catch(() => ({}));
        if (!usuario_id || !subscription?.endpoint || !subscription?.keys) return json({ error: 'Faltan datos' }, 400);
        try {
          await env.DB.prepare(
            `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth) VALUES (?,?,?,?)
             ON CONFLICT(usuario_id, endpoint) DO UPDATE SET p256dh=?, auth=?, created_at=datetime('now')`
          ).bind(usuario_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.keys.p256dh, subscription.keys.auth).run();
          return json({ ok: true });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      // ── Push: obtener VAPID public key ──────────────────────────────────
      if (path === '/push-vapid-key' && req.method === 'GET') {
        const vapid = await getVapidKeys(env);
        if (!vapid) return json({ error: 'VAPID no configurado' }, 503);
        return json({ ok: true, publicKey: vapid.pub });
      }

      // ── Admin: ejecutar migración de nuevas tablas ───────────────────────
      if (path === '/admin/migrate' && req.method === 'POST') {
        const { token } = await req.json().catch(() => ({}));
        if (!(await verificarAdminToken(env, token))) return json({ error: 'No autorizado' }, 403);
        try {
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS conversacion_resumen (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id TEXT NOT NULL,
            canal TEXT NOT NULL,
            tema TEXT,
            resumen TEXT NOT NULL,
            mensajes_cubiertos INTEGER NOT NULL,
            ultimo_mensaje_id INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          )`).run();
          await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_conv_user ON conversacion_resumen(usuario_id, canal, updated_at)`).run();
          return json({ ok: true, mensaje: 'Tabla conversacion_resumen creada/verificada' });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      // ── Reflexión manual — Alejandra piensa sobre sí misma ───────────────
      if (path === '/api/reflexion' && req.method === 'POST') {
        const { token } = await req.json();
        if (!(await verificarAdminToken(env, token))) return json({ error: 'No autorizado' }, 403);
        ctx.waitUntil(ejecutarReflexion(env));
        return json({ ok: true, mensaje: 'Reflexión iniciada en background' });
      }

      // ── Chat principal ────────────────────────────────────────────────────
      if (path === '/api/chat' && req.method === 'POST') {
        const body = await req.json();
        const { mensaje, usuario_id, empresa_id, canal, token_telegram, adjuntos, rol, pantalla, dom_actual } = body;
        if (!mensaje || !usuario_id) return json({ error: 'mensaje y usuario_id requeridos' }, 400);

        const empresa   = empresa_id || 'default';
        const contexto  = await obtenerContextoChat(env, usuario_id, empresa, 10);
        const canalChat = canal || 'web';
        const respuesta = await procesarConNEXUS(env, mensaje, contexto, usuario_id, empresa, canalChat, adjuntos, rol, pantalla, dom_actual);

        await guardarMensajeChat(env, usuario_id, empresa, mensaje, respuesta.texto, canalChat);
        if (respuesta.acciones?.length > 0) ctx.waitUntil(autoLearnChat(env, usuario_id, empresa, respuesta));
        if (canal === 'telegram' && token_telegram) ctx.waitUntil(enviarPorTelegram(token_telegram, respuesta.texto));
        ctx.waitUntil(actualizarResumenSiNecesario(env, usuario_id, canalChat));

        return json(respuesta);
      }

      // ── Chat streaming SSE ────────────────────────────────────────────────
      if (path === '/api/chat/stream' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { mensaje, usuario_id, empresa_id, canal, adjuntos, rol, pantalla, dom_actual } = body;
        if (!mensaje || !usuario_id) return json({ error: 'mensaje y usuario_id requeridos' }, 400);

        const empresa  = empresa_id || 'default';
        const contexto = await obtenerContextoChat(env, usuario_id, empresa, 10);

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const enc    = new TextEncoder();
        const send   = async (data) => {
          try { await writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch(e) {}
        };

        (async () => {
          try {
            const canalReal = canal || 'panel';
            const resp = await procesarConNEXUSStream(env, mensaje, contexto, usuario_id, empresa, send, canalReal, adjuntos, rol, pantalla, dom_actual);
            await guardarMensajeChat(env, usuario_id, empresa, mensaje, resp.texto, canalReal);
            ctx.waitUntil(actualizarResumenSiNecesario(env, usuario_id, canalReal));
            await send({ type: 'done', experto: resp.experto, modelo: resp.modelo, busqueda_web: resp.busqueda_web });
          } catch(e) {
            await send({ type: 'error', mensaje: e.message });
          } finally {
            await writer.close();
          }
        })();

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          }
        });
      }

      // ── Google OAuth — verifica sesión del worker principal via BD compartida ──
      if (path === '/auth/verify-session' && req.method === 'POST') {
        const { session_token } = await req.json().catch(() => ({}));
        if (!session_token) return json({ error: 'Falta session_token' }, 400);
        try {
          const sesion = await env.DB.prepare(
            "SELECT s.rol, u.nombre FROM sesiones s LEFT JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.rol IN ('superadmin','desarrollador') LIMIT 1"
          ).bind(session_token).first();
          if (!sesion) return json({ error: 'Sesión no válida o sin permisos' }, 403);
          return json({ ok: true, token: env.ADMIN_TOKEN, nombre: sesion.nombre || 'Admin' });
        } catch(e) {
          return json({ error: 'Error verificando sesión: ' + e.message }, 500);
        }
      }

      // ── Admin API ─────────────────────────────────────────────────────────
      if (path.startsWith('/api/admin/')) {
        const adminToken = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!(await verificarAdminToken(env, adminToken))) return json({ error: 'No autorizado' }, 403);

        if (path === '/api/admin/config' && req.method === 'GET') {
          const c = await env.DB.prepare('SELECT * FROM agente_config ORDER BY updated_at DESC LIMIT 1').first();
          return json(c || { modo: 'autonomo', auto_fix: 1, max_iterations: 15 });
        }
        if (path === '/api/admin/config' && req.method === 'POST') {
          const { modo, auto_fix, max_iterations } = await req.json();
          await env.DB.prepare(
            `INSERT INTO agente_config (modo,auto_fix,max_iterations,updated_at) VALUES(?,?,?,datetime('now'))
             ON CONFLICT(id) DO UPDATE SET modo=?,auto_fix=?,max_iterations=?,updated_at=datetime('now')`
          ).bind(modo,auto_fix??1,max_iterations??15,modo,auto_fix??1,max_iterations??15).run();
          return json({ ok: true, modo });
        }
        if (path === '/api/admin/logs' && req.method === 'GET') {
          const limit = parseInt(url.searchParams.get('limit') || '100');
          const rows = await env.DB.prepare('SELECT * FROM alejandra_logs ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json(rows.results || []);
        }
        if (path === '/api/admin/memoria' && req.method === 'GET') {
          const tipo  = url.searchParams.get('tipo');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          const query = tipo
            ? 'SELECT * FROM alejandra_memoria WHERE tipo=? ORDER BY importancia DESC,created_at DESC LIMIT ?'
            : 'SELECT * FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT ?';
          const rows = tipo
            ? await env.DB.prepare(query).bind(tipo, limit).all()
            : await env.DB.prepare(query).bind(limit).all();
          return json(rows.results || []);
        }
        if (path === '/api/admin/chat' && req.method === 'GET') {
          const canal = url.searchParams.get('canal'); // 'web','telegram','panel' o null=todos
          const limit = parseInt(url.searchParams.get('limit') || '100');
          const rows  = canal
            ? await env.DB.prepare('SELECT canal,rol,contenido,created_at FROM alejandra_historial WHERE canal=? ORDER BY created_at DESC LIMIT ?').bind(canal,limit).all()
            : await env.DB.prepare('SELECT canal,rol,contenido,created_at FROM alejandra_historial ORDER BY created_at DESC LIMIT ?').bind(limit).all();
          return json((rows.results||[]).reverse());
        }
        if (path === '/api/admin/gastos' && req.method === 'GET') {
          const dias  = parseInt(url.searchParams.get('dias') || '30');
          const desde = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
          const porModelo = await env.DB.prepare(`
            SELECT proveedor, modelo,
                   SUM(tokens_entrada) as total_entrada, SUM(tokens_salida) as total_salida,
                   ROUND(SUM(coste_usd),6) as total_usd, COUNT(*) as llamadas
            FROM alejandra_token_uso WHERE date(created_at) >= ?
            GROUP BY proveedor, modelo ORDER BY total_usd DESC
          `).bind(desde).all().catch(()=>({results:[]}));
          const porDia = await env.DB.prepare(`
            SELECT date(created_at) as fecha, ROUND(SUM(coste_usd),6) as coste_usd,
                   SUM(tokens_entrada + tokens_salida) as tokens_total
            FROM alejandra_token_uso WHERE date(created_at) >= ?
            GROUP BY date(created_at) ORDER BY fecha ASC
          `).bind(desde).all().catch(()=>({results:[]}));
          const totalUSD = (porModelo.results||[]).reduce((s,r)=>s+(r.total_usd||0), 0);
          return json({
            periodo_dias: dias,
            total_usd:  Math.round(totalUSD*10000)/10000,
            total_eur:  Math.round(totalUSD*EUR_RATE*10000)/10000,
            por_modelo: porModelo.results || [],
            por_dia:    porDia.results || []
          });
        }

        if (path === '/api/admin/tokens' && req.method === 'GET') {
          const rows = await env.DB.prepare(
            'SELECT id, descripcion, tipo, activo, created_at FROM alejandra_tokens ORDER BY created_at DESC'
          ).all().catch(()=>({results:[]}));
          return json(rows.results || []);
        }
        if (path === '/api/admin/tokens' && req.method === 'POST') {
          const { nombre, token_valor } = await req.json();
          if (!nombre || !token_valor) return json({ error: 'nombre y token_valor requeridos' }, 400);
          if (token_valor.length < 6) return json({ error: 'Mínimo 6 caracteres' }, 400);
          await env.DB.prepare(
            `INSERT INTO alejandra_tokens (token, tipo, descripcion, activo, created_at) VALUES (?, 'admin', ?, 1, datetime('now'))`
          ).bind(token_valor, nombre).run();
          return json({ ok: true });
        }
        if (path === '/api/admin/tokens' && req.method === 'DELETE') {
          const { id } = await req.json();
          if (!id) return json({ error: 'id requerido' }, 400);
          await env.DB.prepare('UPDATE alejandra_tokens SET activo=0 WHERE id=?').bind(id).run();
          return json({ ok: true });
        }
        if (path === '/api/admin/tokens/change' && req.method === 'POST') {
          const { token_nuevo } = await req.json();
          if (!token_nuevo || token_nuevo.length < 6) return json({ error: 'Mínimo 6 caracteres' }, 400);
          await env.DB.prepare('UPDATE alejandra_tokens SET token=? WHERE token=?').bind(token_nuevo, adminToken).run();
          return json({ ok: true });
        }

        return json({ error: 'Ruta no encontrada' }, 404);
      }

      // ── FCM token — guarda token de notificaciones del móvil ─────────────
      if (path === '/fcm-token' && req.method === 'POST') {
        const { usuario_id, token } = await req.json().catch(() => ({}));
        if (!usuario_id || !token) return json({ error: 'usuario_id y token requeridos' }, 400);
        // Upsert en alejandra_memoria con tipo='fcm_token' y usuario_id
        await env.DB.prepare(
          `DELETE FROM alejandra_memoria WHERE tipo='fcm_token' AND usuario_id=?`
        ).bind(usuario_id).run();
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (usuario_id, tipo, titulo, contenido, importancia, created_at)
           VALUES (?, 'fcm_token', 'FCM Push Token', ?, 10, datetime('now'))`
        ).bind(usuario_id, token).run();
        return json({ ok: true });
      }

      // ── Enviar push notification a un usuario ─────────────────────────────
      if (path === '/push' && req.method === 'POST') {
        const { usuario_id, titulo, cuerpo, token: adminToken } = await req.json().catch(() => ({}));
        if (!(await verificarAdminToken(env, adminToken))) return json({ error: 'No autorizado' }, 403);
        if (!usuario_id || !titulo) return json({ error: 'usuario_id y titulo requeridos' }, 400);
        const row = await env.DB.prepare(
          `SELECT contenido FROM alejandra_memoria WHERE tipo='fcm_token' AND usuario_id=? LIMIT 1`
        ).bind(usuario_id).first();
        if (!row) return json({ error: 'No hay token FCM para este usuario' }, 404);
        const result = await enviarFCM(env, row.contenido, titulo, cuerpo || '');
        return json({ ok: result.ok, fcm: result });
      }

      // ── Comandos remotos — la app consulta y reporta ─────────────────────
      if (path === '/api/comandos/pendientes' && req.method === 'GET') {
        const uid = url.searchParams.get('usuario_id');
        if (!uid) return json({ error: 'usuario_id requerido' }, 400);
        const rows = await env.DB.prepare(
          `SELECT id, tipo, payload, created_at FROM alejandra_comandos
           WHERE usuario_id = ? AND estado = 'pendiente' ORDER BY created_at ASC LIMIT 10`
        ).bind(uid).all();
        return json({ comandos: rows.results || [] });
      }

      if (path === '/api/comandos/resultado' && req.method === 'POST') {
        const { id, resultado, estado } = await req.json().catch(() => ({}));
        if (!id) return json({ error: 'id requerido' }, 400);
        await env.DB.prepare(
          `UPDATE alejandra_comandos SET estado = ?, resultado = ?, ejecutado_at = datetime('now') WHERE id = ?`
        ).bind(estado || 'ejecutado', resultado || '', id).run();
        return json({ ok: true });
      }

      // ── Webhook para eventos de la app (fichajes, fotos, acciones) ───────
      if (path === '/webhook/evento' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { tipo, usuario_id: uid, datos, empresa_id: eid } = body;
        if (!tipo) return json({ error: 'tipo requerido' }, 400);

        // Guardar evento en historial como contexto
        const resumen = `[EVENTO:${tipo}] ${JSON.stringify(datos || {}).substring(0, 500)}`;
        await env.DB.prepare(
          `INSERT INTO alejandra_historial (canal, rol, contenido, created_at, usuario_id)
           VALUES ('app_android', 'system', ?, datetime('now'), ?)`
        ).bind(resumen, uid || 'system').run();

        // Procesar con NEXUS para que Alejandra decida qué hacer
        const contexto = await obtenerContextoChat(env, uid || 'system', 'app_android', 6);
        const prompt = `Se ha producido un evento en la app que requiere tu atención:\nTipo: ${tipo}\nUsuario: ${uid || 'desconocido'}\nEmpresa: ${eid || 'desconocida'}\nDatos: ${JSON.stringify(datos || {})}\n\nAnaliza el evento y decide si necesitas contactar al usuario, guardar algo en memoria o tomar alguna acción.`;

        const timeout = new Promise(resolve =>
          setTimeout(() => resolve({ texto: 'Timeout procesando evento.' }), 23000)
        );
        const respuesta = await Promise.race([
          procesarConNEXUS(env, prompt, contexto, uid || 'system', 'app_android'),
          timeout
        ]);

        return json({ ok: true, tipo, respuesta: respuesta.texto?.substring(0, 500) });
      }

      // ── GetawayAgentes — recibe tarea, responde síncronamente ────────────
      if (path === '/' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { task_id, title, description } = body;

        const mensaje = description || title || '(sin descripción)';
        const contexto = await obtenerContextoChat(env, 'getaway', 'getaway', 6);

        const timeout = new Promise(resolve =>
          setTimeout(() => resolve({ texto: 'Tiempo de procesamiento agotado.' }), 23000)
        );
        const respuesta = await Promise.race([
          procesarConNEXUS(env, mensaje, contexto, 'getaway', 'getaway'),
          timeout
        ]);

        return json({ result: respuesta.texto });
      }

      // ── Versión APK móvil (OTA) ───────────────────────────────────────────
      if (path === '/version' && req.method === 'GET') {
        const obj = await env.FILES.get('ota/version.json');
        if (!obj) return json({ error: 'version.json no encontrado' }, 404);
        const data = await obj.json();
        return json(data);
      }

      // ── Descarga APK (OTA) ────────────────────────────────────────────────
      if (path === '/apk/download' && req.method === 'GET') {
        const obj = await env.FILES.get('apk/alejandra_ia_latest.apk');
        if (!obj) return json({ error: 'APK no encontrado' }, 404);
        return new Response(obj.body, {
          headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': 'attachment; filename="alejandra_ia.apk"',
            'Cache-Control': 'no-cache',
          },
        });
      }

      // ── Upload archivos a R2 ────────────────────────────────────────────────
      if (path === '/upload' && req.method === 'POST') {
        try {
          const contentType = req.headers.get('content-type') || '';
          if (!contentType.includes('multipart/form-data')) {
            return json({ error: 'Se requiere multipart/form-data' }, 400);
          }

          const formData = await req.formData();
          const file = formData.get('file');
          const usuario_id = formData.get('usuario_id') || 'anon';

          if (!file || !(file instanceof File)) {
            return json({ error: 'Campo "file" requerido' }, 400);
          }

          // Validar tamaño (30MB — fotos de obra a veces son grandes)
          const MAX_SIZE = 30 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            return json({ error: `Archivo demasiado grande (${(file.size/1024/1024).toFixed(1)}MB). Máx: 30MB` }, 413);
          }

          // Validar tipo MIME — incluido HEIC/HEIF para iPhone y formato sin tipo conocido
          const ALLOWED_TYPES = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'image/heic', 'image/heif', 'image/avif',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel', // xls
            'text/csv', 'text/plain',
            'application/json',
            'application/octet-stream', // permitir: el filename indicará el tipo real
          ];
          const mimeType = file.type || 'application/octet-stream';
          if (!ALLOWED_TYPES.includes(mimeType)) {
            return json({ error: `Tipo no soportado: ${mimeType}. Acepta: imágenes, PDF, Excel, CSV, texto.` }, 415);
          }

          // Generar key en R2
          const timestamp = Date.now();
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const key = `chat_files/${usuario_id}/${timestamp}_${safeName}`;

          // Subir a R2
          const arrayBuffer = await file.arrayBuffer();
          await env.FILES.put(key, arrayBuffer, {
            httpMetadata: { contentType: mimeType },
            customMetadata: { usuario_id, original_name: file.name, uploaded_at: new Date().toISOString() },
          });

          // Auto-aprendizaje: analizar archivos subidos en background
          ctx.waitUntil(autoLearnUpload(env, key, mimeType, file.name, usuario_id, arrayBuffer));

          return json({
            ok: true,
            url: key,
            filename: file.name,
            size: file.size,
            content_type: mimeType,
          });
        } catch (err) {
          console.error('ERROR upload:', err.message);
          return json({ error: `Error subiendo archivo: ${err.message}` }, 500);
        }
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error('ERROR fetch:', err.message);
      return json({ error: err.message }, 500);
    }
  },
  // ── Cron: Alejandra despierta cada hora y decide si actuar ──────────────
  async scheduled(event, env, ctx) {
    try {
      const hora = new Date().getUTCHours();
      const horaLocal = (hora + 2) % 24; // UTC+2 España

      // No molestar entre 23:00 y 7:00
      if (horaLocal >= 23 || horaLocal < 7) return;

      // Obtener contexto: último mensaje, memorias recientes, comandos pendientes
      const ultimoMsg = await env.DB.prepare(
        `SELECT contenido, created_at FROM alejandra_historial WHERE canal='app_android' AND rol='user' ORDER BY created_at DESC LIMIT 1`
      ).first().catch(() => null);

      const memoriasRecientes = await env.DB.prepare(
        `SELECT titulo, contenido FROM alejandra_memoria WHERE importancia >= 4 ORDER BY created_at DESC LIMIT 5`
      ).all().catch(() => ({ results: [] }));

      const comandosPendientes = await env.DB.prepare(
        `SELECT COUNT(*) as n FROM alejandra_comandos WHERE estado='pendiente'`
      ).first().catch(() => ({ n: 0 }));

      // Construir prompt para que Alejandra decida qué hacer
      const contextoHora = `Son las ${horaLocal}:00 (hora España). `;
      const contextoUltimo = ultimoMsg
        ? `Último mensaje del usuario (${ultimoMsg.created_at}): "${ultimoMsg.contenido?.substring(0, 100)}". `
        : 'No hay mensajes recientes del usuario. ';
      const contextoMemorias = (memoriasRecientes.results || []).length > 0
        ? `Memorias importantes: ${memoriasRecientes.results.map(m => m.titulo).join(', ')}. `
        : '';
      const contextoCmdsPendientes = comandosPendientes.n > 0
        ? `Hay ${comandosPendientes.n} comandos pendientes sin ejecutar. `
        : '';

      const prompt = `[CRON PROACTIVO] ${contextoHora}${contextoUltimo}${contextoMemorias}${contextoCmdsPendientes}

Eres Alejandra en modo autónomo. Analiza el contexto y decide:
1. ¿Hay algo útil que puedas hacer ahora? (avisar al usuario, revisar tareas, dar buenos días, etc.)
2. Si NO hay nada relevante, simplemente responde "SIN_ACCION" y no hagas nada.
3. Si SÍ hay algo, usa tus herramientas (iniciar_conversacion, memory_save, controlar_app, etc.)

Reglas:
- No envíes mensajes vacíos o triviales. Solo actúa si hay algo genuinamente útil.
- Buenos días solo entre 7:00-9:00 y solo si no has saludado hoy.
- Por la noche (21:00-23:00) puedes hacer reflexión y guardar aprendizajes.
- Si detectas tareas sin resolver del día, avisa.`;

      const contextoChat = await obtenerContextoChat(env, 'system', 'cron', 4);
      const respuesta = await procesarConNEXUS(env, prompt, contextoChat, 'system', 'cron');

      // Si respondió algo que no sea SIN_ACCION, loguear
      if (respuesta.texto && !respuesta.texto.includes('SIN_ACCION')) {
        await env.DB.prepare(
          `INSERT INTO alejandra_logs (tipo, contenido, created_at) VALUES ('cron', ?, datetime('now'))`
        ).bind(respuesta.texto.substring(0, 500)).run().catch(() => {});
      }
    } catch (err) {
      console.error('[CRON] Error:', err.message);
    }
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// NEXUS — Router con prompts dinámicos y herramientas de auto-mejora
// ══════════════════════════════════════════════════════════════════════════════

// ── Migración automática de tablas nuevas (idempotente) ─────────────────────
let _tablesEnsured = false;
async function ensureNewTables(env) {
  if (_tablesEnsured) return;
  const migrations = [
    `CREATE TABLE IF NOT EXISTS precios_materiales (id INTEGER PRIMARY KEY AUTOINCREMENT, producto TEXT, fabricante TEXT, precio_min REAL, precio_max REAL, moneda TEXT DEFAULT 'EUR', fuente TEXT, datos_extra TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS normativa_index (id INTEGER PRIMARY KEY AUTOINCREMENT, norma TEXT, seccion TEXT, titulo TEXT, contenido TEXT, palabras_clave TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS materiales_obra (id INTEGER PRIMARY KEY AUTOINCREMENT, obra_id INTEGER, obra_nombre TEXT, material TEXT, referencia TEXT, fabricante TEXT, cantidad REAL, unidad TEXT, precio_unitario REAL, proveedor TEXT, fecha TEXT DEFAULT (datetime('now')), notas TEXT)`,
    `CREATE TABLE IF NOT EXISTS alertas_config (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, nombre TEXT, condicion_sql TEXT, umbral REAL, mensaje_template TEXT, canal TEXT DEFAULT 'telegram', activa INTEGER DEFAULT 1, ultima_ejecucion TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS idx_precios_producto ON precios_materiales(producto)`,
    `CREATE INDEX IF NOT EXISTS idx_materiales_obra ON materiales_obra(obra_id)`,
    `CREATE INDEX IF NOT EXISTS idx_normativa_buscar ON normativa_index(norma, seccion)`
  ];
  for (const sql of migrations) {
    await env.DB.prepare(sql).run().catch(() => {});
  }
  _tablesEnsured = true;
  // Seed normativa y alertas si están vacías
  await seedNormativa(env);
  await seedDefaultAlerts(env);
}

async function seedNormativa(env) {
  try {
    const count = await env.DB.prepare("SELECT COUNT(*) as c FROM normativa_index").first();
    if (count && count.c > 0) return; // Ya tiene datos
  } catch { return; }
  const entries = [
    // ITC-BT-07: Redes subterráneas
    ['REBT', 'ITC-BT-07', 'Redes subterráneas para distribución en baja tensión', 'Los cables subterráneos serán de tensión asignada 0,6/1 kV. Sección mínima del neutro: igual al conductor de fase en monofásico, 50% en trifásico hasta 10mm², igual para secciones superiores. Profundidad mínima de zanja: 0,60m en acera, 0,80m en calzada.', 'subterránea,zanja,cable,enterrado,profundidad'],
    ['REBT', 'ITC-BT-07', 'Protección mecánica en cables enterrados', 'Los cables enterrados directamente deben ir bajo tubo o protección mecánica. Señalización con cinta de aviso a 0,10-0,25m por encima. Cruzamientos con otros servicios: separación mínima 0,25m.', 'tubo,protección,cruzamiento,señalización'],
    ['REBT', 'ITC-BT-07', 'Radio de curvatura en cables subterráneos', 'El radio de curvatura no debe ser inferior a 15 veces el diámetro exterior del cable para cables unipolares y 12 veces para multipolares.', 'radio,curvatura,cable,unipolar,multipolar'],
    // ITC-BT-11: Redes de distribución
    ['REBT', 'ITC-BT-11', 'Previsión de cargas', 'Viviendas grado electrificación básica: 5.750W (25A). Grado elevado: 9.200W (40A). Locales comerciales: 100 W/m² mínimo. Oficinas: 100 W/m² mínimo. Industrias: según demanda real.', 'previsión,carga,vivienda,básica,elevada,potencia'],
    ['REBT', 'ITC-BT-11', 'Coeficientes de simultaneidad', 'Para edificios: 2-4 viviendas factor 1; 5 viviendas: 0,8; 10: 0,6; 15: 0,5; 21+: n/(n+3,8). Cargas no domésticas: 1,0 para primer receptor, 0,75 para el resto.', 'simultaneidad,coeficiente,edificio,vivienda'],
    ['REBT', 'ITC-BT-11', 'Acometida y previsión de potencia', 'La acometida es la parte de la instalación comprendida entre la red de distribución y la CGP. Potencia: P = √3 × U × I × cosφ para trifásico. Para 80kW a 400V trifásico → Iz≈144A → sección típica 70mm² Cu.', 'acometida,potencia,CGP,sección,trifásico'],
    // ITC-BT-19: Instalaciones interiores
    ['REBT', 'ITC-BT-19', 'Caídas de tensión máximas admisibles', 'Instalaciones de enlace: 0,5%. Alumbrado: 3%. Otros usos: 5%. Para instalaciones industriales alimentadas en AT mediante transformador propio: 4,5% alumbrado, 6,5% otros usos.', 'caída,tensión,porcentaje,alumbrado,fuerza'],
    ['REBT', 'ITC-BT-19', 'Secciones mínimas de conductores', 'Circuitos interiores vivienda: alumbrado 1,5mm², tomas 16A 2,5mm², cocina/horno 6mm², calefacción 6mm². Línea principal de tierra: 16mm² Cu mínimo. Derivación individual: 6mm² mínimo.', 'sección,mínima,conductor,vivienda,circuito'],
    ['REBT', 'ITC-BT-19', 'Intensidades admisibles y factores de corrección', 'Las intensidades admisibles dependen del tipo de cable, instalación y temperatura ambiente. Factor corrección agrupamiento: 2 circuitos=0,80; 3=0,70; 4-6=0,60. Temperatura ambiente >40°C requiere factor adicional.', 'intensidad,admisible,corrección,agrupamiento,temperatura'],
    ['REBT', 'ITC-BT-19', 'Conductores de protección PE', 'Sección mín PE: para fases hasta 16mm² → PE igual a fase; 16-35mm² → PE=16mm²; >35mm² → PE=mitad de fase. Color: amarillo-verde obligatorio.', 'protección,PE,tierra,sección,color'],
    // ITC-BT-20: Sistemas de instalación
    ['REBT', 'ITC-BT-20', 'Tipos de canalización', 'Conductores aislados bajo tubo. Conductores aislados sobre bandeja o soporte de bandejas. Canales protectoras. Conductores aislados en huecos de la construcción. Cada tipo tiene sus condiciones de instalación y factores de corrección específicos.', 'canalización,tubo,bandeja,canal,instalación'],
    ['REBT', 'ITC-BT-20', 'Condiciones generales de instalación', 'Los conductores en el interior de tubos no deben tener empalmes. Las conexiones se realizan en cajas. Ocupación máxima del tubo: 40% de la sección interior. Radios de curvatura según ITC-BT-21.', 'empalme,conexión,caja,ocupación,tubo'],
    ['REBT', 'ITC-BT-20', 'Bandejas portacables', 'Ocupación máxima recomendada: cables en una capa sin contacto lateral. Factor llenado: 40-50% de la sección útil. Soporte cada 1,5-3m según carga. Material: acero galvanizado, aluminio o PVC según ambiente.', 'bandeja,portacables,llenado,soporte,ocupación'],
    // ITC-BT-21: Tubos y canales protectoras
    ['REBT', 'ITC-BT-21', 'Tubos en instalaciones empotradas', 'Resistencia a compresión 320N (ligero) o 750N (normal). Diámetro mínimo tubo: 16mm. Tabla 2: 1 conductor 6mm² → tubo 16mm; 3 conductores 2,5mm² → tubo 20mm; 5 conductores 2,5mm² → tubo 25mm.', 'tubo,empotrado,diámetro,compresión,resistencia'],
    ['REBT', 'ITC-BT-21', 'Tubos en instalaciones superficiales', 'Resistencia impacto medio 2J. Diámetro exterior mínimo 16mm. En exteriores: IP44 mínimo. Curvas: radio mínimo 3 veces el diámetro del tubo. Distancia entre registros: 15m en tramo recto.', 'tubo,superficie,exterior,IP,curva,registro'],
    ['REBT', 'ITC-BT-21', 'Canales protectoras', 'Deben ser de material aislante o metálico con tapa. Anchura mínima para albergar los conductores según tabla. Accesibles en toda su longitud. Grado protección mínimo IP4X cuando son accesibles.', 'canal,protectora,tapa,IP,accesible'],
    // ITC-BT-22: Protección contra sobreintensidades
    ['REBT', 'ITC-BT-22', 'Protección contra sobrecargas', 'Condiciones: Ib ≤ In ≤ Iz (corriente diseño ≤ nominal protección ≤ admisible cable). I2 ≤ 1,45 × Iz (corriente convencional fusión ≤ 1,45 × admisible). Para magnetotérmicos: I2 = 1,45 × In.', 'sobrecarga,magnetotérmico,fusible,condición,Ib,In,Iz'],
    ['REBT', 'ITC-BT-22', 'Protección contra cortocircuitos', 'Todo circuito debe estar protegido contra cortocircuitos. Poder de corte ≥ Icc máxima en el punto de instalación. Tiempo de corte < tiempo que el cable aguanta la Icc: t = (k×S/Icc)². k=115 para Cu/PVC, k=76 para Al/PVC.', 'cortocircuito,poder,corte,Icc,tiempo'],
    ['REBT', 'ITC-BT-22', 'Selectividad de protecciones', 'Las protecciones deben ser selectivas: ante un defecto, solo debe actuar la protección más cercana aguas arriba del defecto. Selectividad por calibre: relación 1:1,6 entre protecciones sucesivas.', 'selectividad,protección,calibre,coordinación'],
    // ITC-BT-24: Protección contra contactos
    ['REBT', 'ITC-BT-24', 'Protección contra contactos directos', 'Medidas: aislamiento de partes activas, barreras o envolventes (IP2X mínimo, IPXXB para dedos), interruptores diferenciales 30mA como medida complementaria. Alejamiento: fuera del volumen de accesibilidad (2,50m arriba, 1,00m lateral).', 'contacto,directo,aislamiento,barrera,envolvente,IP2X'],
    ['REBT', 'ITC-BT-24', 'Protección contra contactos indirectos', 'Clase A (sin corte): muy baja tensión MBTS (≤50V CA, ≤120V CC). Clase B (con corte automático): interruptor diferencial. Esquema TT: Id × Ra ≤ UL (50V locales secos, 24V locales húmedos). Diferencial 30mA obligatorio en viviendas.', 'contacto,indirecto,diferencial,TT,MBTS,tierra'],
    ['REBT', 'ITC-BT-24', 'Resistencia de tierra', 'Esquema TT: Ra ≤ UL/Ia. Para diferencial 30mA y UL=50V: Ra ≤ 50/0,03 = 1.667Ω. Para 300mA: Ra ≤ 166Ω. Valor recomendado: < 37Ω (con ID 30mA para UL=24V en húmedos). Revisión anual obligatoria.', 'tierra,resistencia,Ra,pica,medición'],
    // ITC-BT-25: Locales de pública concurrencia
    ['REBT', 'ITC-BT-25', 'Requisitos generales pública concurrencia', 'Locales de espectáculos, reunión, trabajo, sanitarios, religiosos, comerciales >2.500m², estaciones, aeropuertos. Suministro complementario obligatorio. Alumbrado de emergencia: mín 5 lux en vías evacuación.', 'pública,concurrencia,emergencia,evacuación,alumbrado'],
    ['REBT', 'ITC-BT-25', 'Alumbrado de emergencia y señalización', 'Autonomía mínima 1 hora. 5 lux en vías de evacuación, 1 lux en puntos donde estén equipos de protección contra incendios. Señalización: luminarias con pictogramas normalizados. Encendido automático por fallo de suministro.', 'emergencia,señalización,luminaria,autonomía,evacuación,lux'],
    ['REBT', 'ITC-BT-25', 'Instalaciones en pública concurrencia', 'Cables no propagadores de incendio (UNE-EN 60332). Baja emisión de humos (UNE-EN 61034). Conductores de cobre mínimo. Cuadros con envolvente metálica. IGA accesible bomberos. Diferencial por circuito.', 'incendio,humo,cable,cuadro,IGA,bombero'],
    // ITC-BT-28: Locales con riesgo
    ['REBT', 'ITC-BT-28', 'Clasificación de zonas con riesgo de explosión', 'Zona 0: presencia permanente de atmósfera explosiva (gas). Zona 1: probable en funcionamiento normal. Zona 2: no probable, y si ocurre de corta duración. Zona 20/21/22: equivalentes para polvo. Clasificación según UNE-EN 60079-10.', 'ATEX,zona,explosión,gas,polvo,clasificación'],
    ['REBT', 'ITC-BT-28', 'Equipos para zonas ATEX', 'Zona 0: categoría 1G (Ex ia). Zona 1: categoría 2G (Ex d, Ex e, Ex p). Zona 2: categoría 3G (Ex n). Zona 20: categoría 1D (Ex tD). Marcado CE + marcado Ex obligatorio. Instalación según UNE-EN 60079-14.', 'ATEX,equipo,categoría,Ex,marcado,certificado'],
    ['REBT', 'ITC-BT-28', 'Instalaciones en locales con riesgo de incendio', 'Cables resistentes al fuego (UNE-EN 60332-3). Canalizaciones metálicas o minerales. Sin empalmes dentro de la zona clasificada. Equipotencialidad de masas metálicas. Puesta a tierra reforzada.', 'incendio,fuego,cable,resistente,canalización,equipotencial'],
    // ITC-BT-44: Receptores de alumbrado
    ['REBT', 'ITC-BT-44', 'Receptores de alumbrado — generalidades', 'Luminarias deben cumplir UNE-EN 60598. Clase I (con tierra), Clase II (doble aislamiento), Clase III (MBTS). Máximo 30 puntos de luz por circuito con PIA de 10A. Sección mínima 1,5mm².', 'alumbrado,luminaria,clase,circuito,PIA,punto,luz'],
    ['REBT', 'ITC-BT-44', 'Lámparas de descarga', 'Factor de potencia mínimo 0,9 (corregido con condensador). La corriente de arranque puede ser 1,5-2× la nominal. Carga mínima prevista: potencia lámpara × 1,8 (por reactancia y arranque).', 'descarga,fluorescente,LED,reactancia,condensador,factor,potencia'],
    ['REBT', 'ITC-BT-44', 'Alumbrado exterior', 'Protección mínima IP44 (IP65 recomendado). Altura mínima 2,50m sobre suelo en zonas accesibles. Clase II preferente o Clase I con diferencial 30mA. Circuitos independientes con protección propia.', 'exterior,IP,altura,protección,circuito']
  ];
  for (const [norma, seccion, titulo, contenido, palabras_clave] of entries) {
    await env.DB.prepare(
      "INSERT INTO normativa_index (norma, seccion, titulo, contenido, palabras_clave) VALUES (?, ?, ?, ?, ?)"
    ).bind(norma, seccion, titulo, contenido, palabras_clave).run().catch(() => {});
  }
}

async function seedDefaultAlerts(env) {
  try {
    const count = await env.DB.prepare("SELECT COUNT(*) as c FROM alertas_config").first();
    if (count && count.c > 0) return;
  } catch { return; }
  const defaults = [
    ['bobina_baja', 'Bobina con stock bajo (<10%)', "SELECT id, nombre, metros_restantes, metros_totales FROM bobinas WHERE metros_restantes < (metros_totales * 0.10) AND metros_restantes > 0", 10, 'Bobina "{nombre}" al {pct}% — quedan {metros_restantes}m de {metros_totales}m'],
    ['sin_fichaje', 'Operario sin fichar en 24h', "SELECT p.id, p.nombre FROM personal p WHERE p.activo=1 AND p.id NOT IN (SELECT DISTINCT usuario_id FROM fichajes WHERE date(fecha) = date('now'))", 0, 'Operario "{nombre}" no ha fichado hoy'],
    ['revision_equipo', 'Equipo sin revisión en 30+ días', "SELECT id, nombre, tipo, ultima_revision FROM equipos WHERE date(ultima_revision) < date('now', '-30 days') OR ultima_revision IS NULL", 30, 'Equipo "{nombre}" ({tipo}) sin revisión desde {ultima_revision}']
  ];
  for (const [tipo, nombre, condicion_sql, umbral, mensaje_template] of defaults) {
    await env.DB.prepare(
      "INSERT INTO alertas_config (tipo, nombre, condicion_sql, umbral, mensaje_template) VALUES (?, ?, ?, ?, ?)"
    ).bind(tipo, nombre, condicion_sql, umbral, mensaje_template).run().catch(() => {});
  }
}

async function procesarConNEXUS(env, mensaje, contexto, usuario_id, empresa_id, canal, adjuntos, rol=null, pantalla=null, dom_actual=null) {
  if (!env.ANTHROPIC_API_KEY) {
    return { texto: 'Error: ANTHROPIC_API_KEY no configurada.', acciones: [], requiere_confirmacion: false };
  }

  // Migración automática de tablas nuevas (idempotente, una vez por instancia)
  await ensureNewTables(env).catch(() => {});

  const config = await env.DB.prepare('SELECT modo FROM agente_config ORDER BY updated_at DESC LIMIT 1').first().catch(() => null);
  const modo = config?.modo || 'autonomo';

  try {
    // PASO 1: Haiku clasifica el mensaje
    const clas   = await clasificarConHaiku(env, mensaje);
    const expert = NEXUS_EXPERTS[clas.experto] || NEXUS_EXPERTS.app;
    const tools  = TOOLS_POR_EXPERTO[clas.experto] || [];
    console.log(`NEXUS: experto=${clas.experto} web=${clas.buscar_web} tools=${tools.map(t=>t.name).join(',')}`);

    // PASO 2: Búsqueda web previa si Haiku lo decidió (evita una iteración extra)
    let resultadoWeb = null;
    let usoBusquedaWeb = false;
    if (clas.buscar_web && env.OPENAI_API_KEY) {
      resultadoWeb   = await buscarWebOpenAI(env, clas.query_web || mensaje);
      usoBusquedaWeb = true;
      await registrarLog(env, usuario_id, 'web_search', clas.query_web, resultadoWeb.substring(0,200));
    }

    // PASO 3: System prompt con solo los módulos necesarios
    const systemPrompt = buildSystemPrompt(expert.modules);

    // PASO 4: Historial dinámico
    const limitHistorial      = clas.experto === 'simple' ? 3 : 6;
    // Aprendizajes solo para expertos técnicos donde aportan valor real
    const incluirAprendizajes = ['tecnico','ingenieria','reflexion','completo'].includes(clas.experto);
    const messages = await construirMessages(env, mensaje, contexto, limitHistorial, incluirAprendizajes, resultadoWeb, usuario_id, canal, adjuntos, rol, pantalla, dom_actual, clas.experto);

    // PASO 5: Llamar al modelo en loop hasta respuesta final (máx 5 iteraciones)
    let respAPI  = await llamarAnthropic(env, messages, tools, expert.model, expert.maxTokens, systemPrompt);
    if (respAPI.usage) registrarTokenUso(env, expert.model, `chat_${clas.experto}`, respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
    let iter     = 0;
    const MAX_ITER = (usuario_id === 'adrian' || usuario_id === 'admin') ? 12 : 8;
    const herramientasUsadas = [];

    while (respAPI.stop_reason === 'tool_use' && iter < MAX_ITER) {
      const toolBlocks = respAPI.content.filter(b => b.type === 'tool_use');
      if (!toolBlocks.length) break;

      messages.push({ role: 'assistant', content: respAPI.content });
      const toolResults = [];

      for (const tb of toolBlocks) {
        herramientasUsadas.push({ nombre: tb.name, input: tb.input });
        const resultado = await ejecutarTool(env, tb.name, tb.input, usuario_id, empresa_id, tools);
        if (tb.name === 'buscar_web') usoBusquedaWeb = true;
        // ver_archivo con imágenes devuelve JSON con content blocks para visión
        const content = parseToolResultContent(resultado);
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content });
      }

      messages.push({ role: 'user', content: toolResults });
      // Mantener todas las tools disponibles en todas las iteraciones para máxima proactividad
      const toolsSiguiente = iter < MAX_ITER - 1 ? tools : [];
      respAPI = await llamarAnthropic(env, messages, toolsSiguiente, expert.model, expert.maxTokens, systemPrompt);
      if (respAPI.usage) registrarTokenUso(env, expert.model, `chat_${clas.experto}`, respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
      iter++;
    }

    const textoFinal = verificarAccionesAfirmadas(
      respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta',
      herramientasUsadas
    );

    await registrarLog(env, usuario_id, 'chat', `[${clas.experto}] ${mensaje.substring(0,80)}`, textoFinal.substring(0,200));

    return {
      texto: textoFinal,
      acciones: [],
      herramientas_usadas: herramientasUsadas,
      requiere_confirmacion: modo === 'confirmacion',
      modelo: expert.model,
      experto: clas.experto,
      busqueda_web: usoBusquedaWeb
    };

  } catch (err) {
    console.error('ERROR NEXUS:', err.message);
    return { texto: `Error: ${err.message}`, acciones: [], requiere_confirmacion: false };
  }
}

// ── NEXUS con streaming SSE ───────────────────────────────────────────────────
async function procesarConNEXUSStream(env, mensaje, contexto, usuario_id, empresa_id, send, canal, adjuntos, rol=null, pantalla=null, dom_actual=null) {
  if (!env.ANTHROPIC_API_KEY) {
    await send({ type: 'error', mensaje: 'ANTHROPIC_API_KEY no configurada.' });
    return { texto: 'Error: sin clave API.', herramientas_usadas: [] };
  }
  await ensureNewTables(env).catch(() => {});
  const config = await env.DB.prepare('SELECT modo FROM agente_config ORDER BY updated_at DESC LIMIT 1').first().catch(() => null);
  const modo = config?.modo || 'autonomo';

  try {
    // PASO 1: Clasificar
    const clas   = await clasificarConHaiku(env, mensaje);
    const expert = NEXUS_EXPERTS[clas.experto] || NEXUS_EXPERTS.app;
    const tools  = TOOLS_POR_EXPERTO[clas.experto] || [];
    await send({ type: 'routing', experto: clas.experto, buscar_web: clas.buscar_web, modelo: expert.model });

    // PASO 2: Búsqueda web previa
    let resultadoWeb = null, usoBusquedaWeb = false;
    if (clas.buscar_web && env.OPENAI_API_KEY) {
      const t0 = Date.now();
      await send({ type: 'tool_start', nombre: 'buscar_web', input: { query: clas.query_web || mensaje } });
      resultadoWeb   = await buscarWebOpenAI(env, clas.query_web || mensaje);
      usoBusquedaWeb = true;
      await send({ type: 'tool_end', nombre: 'buscar_web', preview: resultadoWeb.substring(0, 200), duracion_ms: Date.now() - t0 });
      await registrarLog(env, usuario_id, 'web_search', clas.query_web, resultadoWeb.substring(0, 200));
    }

    // PASO 3-4: System + historial
    const systemPrompt      = buildSystemPrompt(expert.modules);
    const limitHistorial    = clas.experto === 'simple' ? 4 : 10;
    const incluirAprendizajes = clas.experto !== 'simple';
    const messages          = await construirMessages(env, mensaje, contexto, limitHistorial, incluirAprendizajes, resultadoWeb, usuario_id, canal, adjuntos);

    // PASO 5: Loop Anthropic + tools
    let respAPI = await llamarAnthropic(env, messages, tools, expert.model, expert.maxTokens, systemPrompt);
    if (respAPI.usage) registrarTokenUso(env, expert.model, 'chat_stream', respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
    let iter = 0;
    const MAX_ITER = (usuario_id === 'adrian' || usuario_id === 'admin') ? 12 : 8;
    const herramientasUsadas = [];

    while (respAPI.stop_reason === 'tool_use' && iter < MAX_ITER) {
      const toolBlocks = respAPI.content.filter(b => b.type === 'tool_use');
      if (!toolBlocks.length) break;
      messages.push({ role: 'assistant', content: respAPI.content });
      const toolResults = [];

      for (const tb of toolBlocks) {
        const t0 = Date.now();
        herramientasUsadas.push({ nombre: tb.name, input: tb.input });
        await send({ type: 'tool_start', nombre: tb.name, input: tb.input });
        const resultado = await ejecutarTool(env, tb.name, tb.input, usuario_id, empresa_id, tools, send);
        if (tb.name === 'buscar_web') usoBusquedaWeb = true;
        // Para SSE preview, extraer solo texto (no base64 de imágenes)
        const previewText = typeof resultado === 'string' && resultado.startsWith('[{')
          ? '(imagen analizada)'
          : String(resultado).substring(0, 200);
        await send({ type: 'tool_end', nombre: tb.name, preview: previewText, duracion_ms: Date.now() - t0 });
        const content = parseToolResultContent(resultado);
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content });
      }

      messages.push({ role: 'user', content: toolResults });
      // Mantener todas las tools disponibles en todas las iteraciones para máxima proactividad
      const toolsSiguiente = iter < MAX_ITER - 1 ? tools : [];
      respAPI = await llamarAnthropic(env, messages, toolsSiguiente, expert.model, expert.maxTokens, systemPrompt);
      if (respAPI.usage) registrarTokenUso(env, expert.model, 'chat_stream', respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
      iter++;
    }

    const textoFinal = verificarAccionesAfirmadas(
      respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta',
      herramientasUsadas
    );
    await registrarLog(env, usuario_id, 'chat', `[${clas.experto}] ${mensaje.substring(0,80)}`, textoFinal.substring(0,200));
    await send({ type: 'text', texto: textoFinal });

    return { texto: textoFinal, herramientas_usadas: herramientasUsadas, modelo: expert.model, experto: clas.experto, busqueda_web: usoBusquedaWeb };

  } catch(err) {
    console.error('ERROR NEXUS STREAM:', err.message);
    await send({ type: 'error', mensaje: err.message });
    return { texto: `Error: ${err.message}`, herramientas_usadas: [] };
  }
}

// ── Verificador anti-confabulación ───────────────────────────────────────────
// Detecta si la respuesta afirma haber hecho algo sin que exista el tool result correspondiente
function verificarAccionesAfirmadas(textoFinal, herramientasUsadas) {
  const toolsEscritos = new Set(herramientasUsadas.map(t => t.nombre));

  // Patrones de afirmación de acción completada
  const patronesAccion = [
    /\b(ya lo hice|ya está hecho|ya lo cambié|ya lo modifiqué|acabo de hacer|acabo de cambiar|acabo de escribir|acabo de modificar|acabo de implementar|acabo de crear|acabo de aplicar|ya lo apliqué|ya lo arreglé|ya está arreglado|ya lo actualicé|ya lo subí|lo he hecho|lo he cambiado|lo he modificado|lo he implementado|he hecho el cambio|he aplicado|he modificado|he actualizado)\b/i,
    /\b(el cambio está hecho|el fix está|ya está desplegado|ya está en producción|ya está en el worker|ya está en el código)\b/i,
  ];

  // Tools de escritura que deberían ejecutarse si afirma acción
  const toolsEscritura = ['github_escribir', 'escribir_bd', 'controlar_app', 'subir_archivo', 'enviar_push', 'iniciar_conversacion'];
  const usóEscritura = toolsEscritura.some(t => toolsEscritos.has(t));

  const afirmaAccion = patronesAccion.some(p => p.test(textoFinal));

  if (afirmaAccion && !usóEscritura) {
    // Añadir disclaimer al final
    return textoFinal + '\n\n⚠️ *Nota: Esta respuesta afirma haber realizado un cambio pero no se ejecutó ninguna tool de escritura en este turno. Si esperabas que algo se modificara, pídeme que lo haga explícitamente.*';
  }
  return textoFinal;
}

// ── Parsear resultado de tool para soporte de visión ─────────────────────────
// ver_archivo devuelve JSON con content blocks [{type:'image',...},{type:'text',...}]
// El API de Anthropic acepta content como string o array de content blocks
function parseToolResultContent(resultado) {
  if (typeof resultado !== 'string') return String(resultado);
  // Detectar si es un array JSON de content blocks (imagen + texto)
  if (resultado.startsWith('[{') && resultado.includes('"type"')) {
    try {
      const parsed = JSON.parse(resultado);
      if (Array.isArray(parsed) && parsed[0]?.type) return parsed;
    } catch (_) {}
  }
  return resultado;
}

// ── Uint8Array → base64 (sin límite de argumentos en spread) ─────────────────
function uint8ToBase64(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  // Procesar en chunks de 8KB para evitar stack overflow con String.fromCharCode(...bigArray)
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// ── Construir content blocks con adjuntos (imágenes inline) ──────────────────
async function buildUserContentWithAdjuntos(env, mensaje, adjuntos) {
  const contentBlocks = [];

  // Cargar cada adjunto de R2 y añadir como imagen si es posible
  for (const key of adjuntos) {
    try {
      const obj = await env.FILES.get(key);
      if (!obj) {
        contentBlocks.push({ type: 'text', text: `[Adjunto no encontrado: ${key}]` });
        continue;
      }
      let ct = obj.httpMetadata?.contentType || '';
      // Detectar por extensión si el contentType es genérico
      if (ct === 'application/octet-stream' || !ct) {
        const lower = key.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) ct = 'image/jpeg';
        else if (lower.endsWith('.png')) ct = 'image/png';
        else if (lower.endsWith('.webp')) ct = 'image/webp';
        else if (lower.endsWith('.heic')) ct = 'image/heic';
        else if (lower.endsWith('.heif')) ct = 'image/heif';
        else if (lower.endsWith('.gif')) ct = 'image/gif';
        else if (lower.endsWith('.pdf')) ct = 'application/pdf';
        else if (lower.endsWith('.csv')) ct = 'text/csv';
        else if (lower.endsWith('.txt')) ct = 'text/plain';
        else if (lower.endsWith('.json')) ct = 'application/json';
        else if (lower.endsWith('.xlsx')) ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (lower.endsWith('.xls')) ct = 'application/vnd.ms-excel';
      }
      if (ct.startsWith('image/')) {
        const buf = await obj.arrayBuffer();
        const bytes = new Uint8Array(buf);
        // Anthropic acepta hasta 5MB base64 por imagen (~3.7MB raw).
        // HEIC/HEIF Anthropic NO los soporta nativamente: avisamos al modelo.
        const isHeic = ct === 'image/heic' || ct === 'image/heif';
        if (isHeic) {
          contentBlocks.push({ type: 'text', text: `[Imagen HEIC adjunta: ${key} — usa la tool analizar_foto_obra para verla]` });
        } else if (bytes.length <= 3.7 * 1024 * 1024) {
          const base64 = uint8ToBase64(bytes);
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: ct, data: base64 }
          });
        } else {
          // Imagen grande: avisamos a Alejandra para que use la tool de análisis (Gemini si está disponible)
          contentBlocks.push({
            type: 'text',
            text: `[Imagen grande adjunta: ${key} (${(bytes.length/1024/1024).toFixed(1)}MB). Usa la tool analizar_foto_obra con key="${key}" para analizarla.]`
          });
        }
      } else if (ct === 'application/pdf') {
        const buf = await obj.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (bytes.length <= 4.5 * 1024 * 1024) {
          const base64 = uint8ToBase64(bytes);
          contentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 }
          });
        } else if (env.GEMINI_API_KEY) {
          try {
            const base64 = uint8ToBase64(bytes);
            const texto = await analizarArchivoConGemini(env, base64, 'application/pdf',
              'Extrae TODO el texto y datos de este PDF. Responde con el contenido completo, manteniendo la estructura (tablas, listas, secciones).');
            contentBlocks.push({ type: 'text', text: `Contenido del PDF (${key}, ${(bytes.length/1024/1024).toFixed(1)}MB, extraído con Gemini):\n${texto}` });
          } catch (e) {
            contentBlocks.push({ type: 'text', text: `[PDF grande: ${key} (${(bytes.length/1024/1024).toFixed(1)}MB). Error al leer con Gemini: ${e.message}. Usa ver_archivo con key="${key}" para extraer texto básico.]` });
          }
        } else {
          contentBlocks.push({ type: 'text', text: `[PDF muy grande: ${key} (${(bytes.length/1024/1024).toFixed(1)}MB). Pide al usuario las páginas relevantes o usa ver_archivo con key="${key}" para extraer texto.]` });
        }
      } else if (ct.includes('spreadsheet') || ct.includes('excel')) {
        const buf = await obj.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (env.GEMINI_API_KEY && bytes.length <= 20 * 1024 * 1024) {
          try {
            const base64 = uint8ToBase64(bytes);
            const texto = await analizarArchivoConGemini(env, base64, ct,
              'Lee este archivo Excel/hoja de cálculo. Extrae TODOS los datos en formato tabla texto. Incluye nombres de hojas si hay varias. Mantén números, fechas y fórmulas visibles.');
            contentBlocks.push({ type: 'text', text: `Contenido del Excel (${key}, extraído con Gemini):\n${texto}` });
          } catch (e) {
            contentBlocks.push({ type: 'text', text: `[Archivo Excel: ${key}. Error al leer con Gemini: ${e.message}. Sugiere al usuario exportar como CSV.]` });
          }
        } else {
          contentBlocks.push({ type: 'text', text: `[Archivo Excel adjunto: ${key}. Sugiere al usuario exportar como CSV para poder leerlo.]` });
        }
      } else if (ct.startsWith('text/') || ct === 'application/json') {
        const text = await obj.text();
        contentBlocks.push({ type: 'text', text: `Archivo adjunto (${key}):\n${text.substring(0, 4000)}` });
      } else {
        contentBlocks.push({ type: 'text', text: `[Archivo adjunto: ${key} (${ct})]` });
      }
    } catch (e) {
      contentBlocks.push({ type: 'text', text: `[Error cargando adjunto ${key}: ${e.message}]` });
    }
  }

  // Añadir el texto del mensaje
  if (mensaje) {
    contentBlocks.push({ type: 'text', text: mensaje });
  }

  return contentBlocks;
}

// ── Gemini Vision — analizar foto con IA de visión ──────────────────────────
// ── Gemini con rotación de keys y fallback de modelos ────────────────────────
async function callGemini(env, geminiBody, label) {
  const keys = [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3].filter(Boolean);
  if (!keys.length) throw new Error('GEMINI_API_KEY no configurada');
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash-002', 'gemini-1.5-flash'];
  for (const key of keys) {
    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
      );
      const data = await res.json();
      if (res.ok) return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin resultado.';
      if (res.status === 429) break;
      if (res.status === 404) continue;
      throw new Error(`Gemini ${res.status} [${label}]: ${JSON.stringify(data).slice(0, 200)}`);
    }
  }
  throw new Error(`Cuota Gemini agotada (${label})`);
}

async function analizarFotoConGemini(env, imageBase64, mediaType, prompt) {
  return callGemini(env, {
    contents: [{ parts: [
      { inline_data: { mime_type: mediaType, data: imageBase64 } },
      { text: prompt }
    ]}]
  }, 'foto_obra');
}

async function analizarArchivoConGemini(env, fileBase64, mimeType, prompt) {
  return callGemini(env, {
    contents: [{ parts: [
      { inline_data: { mime_type: mimeType, data: fileBase64 } },
      { text: prompt }
    ]}]
  }, 'archivo');
}

async function buscarConGemini(env, query) {
  return callGemini(env, {
    contents: [{ parts: [{ text: query }] }],
    tools: [{ google_search: {} }]
  }, 'busqueda');
}

// ── Cálculos de ingeniería ───────────────────────────────────────────────────
function calcularCable(input) {
  const P = input.potencia_w;
  const V = input.tension_v;
  const L = input.longitud_m;
  const cosPhi = input.cos_phi || 0.85;
  const material = input.tipo_cable || 'cobre';
  const instalacion = input.instalacion || 'bandeja';
  const maxCaida = input.max_caida_pct || 5;

  const conductividad = material === 'cobre' ? 56 : 35; // m/(Ω·mm²)
  const trifasico = V >= 400;

  // Intensidad
  const I = trifasico
    ? P / (V * Math.sqrt(3) * cosPhi)
    : P / (V * cosPhi);

  // Secciones normalizadas y sus intensidades admisibles (aprox cobre, bandeja/aire, PVC)
  const secciones = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
  const ampacidadCobre = {
    1.5: 15, 2.5: 21, 4: 27, 6: 36, 10: 50, 16: 66, 25: 84, 35: 104,
    50: 125, 70: 160, 95: 194, 120: 225, 150: 260, 185: 297, 240: 346
  };
  // Aluminio: ~78% de la capacidad del cobre
  const factorAl = material === 'aluminio' ? 0.78 : 1.0;

  let seccionElegida = null;
  let caidaReal = null;
  let ampacidad = null;

  for (const S of secciones) {
    const Iz = (ampacidadCobre[S] || 0) * factorAl;
    if (Iz < I) continue; // No soporta la corriente

    // Caída de tensión
    let caida;
    if (trifasico) {
      caida = (Math.sqrt(3) * L * I * cosPhi) / (conductividad * S * V) * 100;
    } else {
      caida = (2 * L * I * cosPhi) / (conductividad * S * V) * 100;
    }

    if (caida <= maxCaida) {
      seccionElegida = S;
      caidaReal = Math.round(caida * 100) / 100;
      ampacidad = Math.round(Iz * 10) / 10;
      break;
    }
  }

  const resultado = {
    datos_entrada: { potencia_w: P, tension_v: V, longitud_m: L, cos_phi: cosPhi, material, instalacion, max_caida_pct: maxCaida },
    tipo_circuito: trifasico ? 'Trifásico (3F+N)' : 'Monofásico (F+N)',
    intensidad_calculada_a: Math.round(I * 100) / 100,
    conductividad_material: conductividad,
  };

  if (seccionElegida) {
    resultado.seccion_recomendada_mm2 = seccionElegida;
    resultado.caida_tension_pct = caidaReal;
    resultado.ampacidad_cable_a = ampacidad;
    resultado.cumple_norma = true;
    resultado.norma_referencia = 'UNE 20460 / IEC 60364 / REBT ITC-BT-19';
    resultado.resumen = `Cable ${material} ${seccionElegida} mm² — Intensidad: ${Math.round(I*100)/100} A (admisible: ${ampacidad} A) — Caída: ${caidaReal}% (máx: ${maxCaida}%)`;
  } else {
    resultado.seccion_recomendada_mm2 = null;
    resultado.cumple_norma = false;
    resultado.error = `No se encontró sección normalizada (hasta 240mm²) que cumpla intensidad (${Math.round(I*100)/100} A) y caída de tensión (máx ${maxCaida}%) para ${L}m.`;
    resultado.sugerencia = 'Considerar: reducir longitud, subir tensión a trifásico, cable en paralelo, o verificar potencia.';
  }

  return JSON.stringify(resultado, null, 2);
}

function calcularBandeja(input) {
  const ancho = input.ancho_mm;
  const alto = input.alto_mm;
  const angulo = input.angulo_grados || 90;
  const tipo = input.tipo || 'curva_horizontal';
  const cables = input.cables_diametro_mm || [];

  // Radio mínimo interior
  const radioMinimo = 1.5 * ancho;
  const radioRecomendado = 2 * ancho;
  const radioMedio = radioRecomendado + ancho / 2;

  // Desarrollo de curva
  const desarrollo = Math.round((radioMedio * angulo * Math.PI) / 180);

  // Llenado de bandeja
  const areaBandeja = ancho * alto; // mm²
  const areaCables = cables.reduce((sum, d) => sum + Math.PI * (d / 2) * (d / 2), 0);
  const llenado = areaBandeja > 0 ? Math.round((areaCables / areaBandeja) * 10000) / 100 : 0;
  const llenadoMax = 50; // % máximo recomendado

  const resultado = {
    datos_entrada: { ancho_mm: ancho, alto_mm: alto, angulo_grados: angulo, tipo, cables_count: cables.length },
    radio_minimo_mm: radioMinimo,
    radio_recomendado_mm: radioRecomendado,
    radio_medio_mm: radioMedio,
    desarrollo_curva_mm: desarrollo,
    tipo_accesorio: tipo,
  };

  if (cables.length > 0) {
    resultado.area_bandeja_mm2 = areaBandeja;
    resultado.area_cables_mm2 = Math.round(areaCables * 100) / 100;
    resultado.llenado_pct = llenado;
    resultado.llenado_maximo_pct = llenadoMax;
    resultado.llenado_ok = llenado <= llenadoMax;
    if (llenado > llenadoMax) {
      resultado.alerta = `Llenado ${llenado}% excede el máximo recomendado (${llenadoMax}%). Considerar bandeja más ancha.`;
      // Sugerir ancho mínimo
      const anchoNecesario = Math.ceil(areaCables / (alto * (llenadoMax / 100)));
      const anchosStd = [100, 150, 200, 300, 400, 500, 600];
      const anchoSugerido = anchosStd.find(a => a >= anchoNecesario) || anchoNecesario;
      resultado.ancho_sugerido_mm = anchoSugerido;
    }
  }

  resultado.dimensiones_accesorio = {
    largo_exterior_mm: tipo === 'curva_horizontal' || tipo === 'curva_vertical'
      ? radioRecomendado + ancho
      : ancho,
    ancho_mm: ancho,
    alto_mm: alto
  };

  resultado.norma_referencia = 'UNE-EN 61537 / IEC 61537';
  resultado.resumen = `Bandeja ${ancho}x${alto}mm — ${tipo} ${angulo}° — Radio: ${radioRecomendado}mm — Desarrollo: ${desarrollo}mm${cables.length > 0 ? ` — Llenado: ${llenado}%` : ''}`;

  return JSON.stringify(resultado, null, 2);
}

function calcularProteccion(input) {
  const In = input.intensidad_nominal_a;
  const tipoCarga = input.tipo_carga || 'mixta';
  const seccionCable = input.seccion_cable_mm2;
  const longitud = input.longitud_m;
  const tension = input.tension_v || 230;

  // Calibres normalizados
  const calibres = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

  // Elegir calibre >= In
  const calibreElegido = calibres.find(c => c >= In) || calibres[calibres.length - 1];

  // Curva según tipo de carga
  const curvas = { motor: 'D', alumbrado: 'B', tomas: 'C', mixta: 'C' };
  const curva = curvas[tipoCarga] || 'C';

  // Diferencial
  const sensibilidadDif = tipoCarga === 'motor' ? 300 : 30; // mA
  const tipoDif = tipoCarga === 'motor' ? 'Clase A (inmunizado)' : 'Clase AC o A';

  // Verificar coordinación cable-protección
  const ampacidadCobre = {
    1.5: 15, 2.5: 21, 4: 27, 6: 36, 10: 50, 16: 66, 25: 84, 35: 104,
    50: 125, 70: 160, 95: 194, 120: 225, 150: 260, 185: 297, 240: 346
  };

  const resultado = {
    datos_entrada: { intensidad_nominal_a: In, tipo_carga: tipoCarga, tension_v: tension },
    magnetotermico: {
      calibre_a: calibreElegido,
      curva: curva,
      descripcion_curva: curva === 'B' ? 'Disparo 3-5×In (cargas resistivas)' :
                          curva === 'C' ? 'Disparo 5-10×In (cargas mixtas/tomas)' :
                          'Disparo 10-20×In (motores, transformadores)',
      polos: tension >= 400 ? '4P (3F+N)' : '2P (F+N)'
    },
    diferencial: {
      sensibilidad_ma: sensibilidadDif,
      tipo: tipoDif,
      calibre_a: calibreElegido,
      uso: sensibilidadDif === 30 ? 'Protección de personas (contacto directo)' : 'Protección contra incendio'
    },
    norma_referencia: 'REBT ITC-BT-22 / ITC-BT-24 / UNE 20460',
  };

  // Coordinación cable-protección
  if (seccionCable) {
    const Iz = ampacidadCobre[seccionCable] || 0;
    resultado.coordinacion_cable = {
      seccion_mm2: seccionCable,
      ampacidad_cable_a: Iz,
      calibre_proteccion_a: calibreElegido,
      cumple: Iz >= calibreElegido,
      condicion: `Iz (${Iz}A) ${Iz >= calibreElegido ? '≥' : '<'} In (${calibreElegido}A) — ${Iz >= calibreElegido ? 'CUMPLE' : 'NO CUMPLE: cable insuficiente para esta protección'}`
    };
    if (Iz < calibreElegido) {
      // Sugerir sección mínima
      const seccionMinima = Object.entries(ampacidadCobre).find(([s, iz]) => iz >= calibreElegido);
      if (seccionMinima) resultado.coordinacion_cable.seccion_minima_mm2 = parseFloat(seccionMinima[0]);
    }
  }

  resultado.resumen = `Magnetotérmico ${calibreElegido}A curva ${curva} ${tension >= 400 ? '4P' : '2P'} + Diferencial ${sensibilidadDif}mA ${tipoDif}`;

  return JSON.stringify(resultado, null, 2);
}

// ── Ejecutar tools ────────────────────────────────────────────────────────────
async function ejecutarTool(env, nombre, input, usuario_id, empresa_id, expertoTools, sendSSE) {
  switch (nombre) {

    case 'pensar': {
      // Emite evento SSE thinking si está en streaming
      if (typeof sendSSE === 'function') {
        try { await sendSSE({ type: 'thinking', problema: input.problema, analisis: input.analisis, siguiente_paso: input.siguiente_paso }); } catch (_) {}
      }
      return JSON.stringify({ ok: true, registrado: true, problema: input.problema, siguiente_paso: input.siguiente_paso });
    }

    case 'planificar': {
      const pasos = Array.isArray(input.pasos) ? input.pasos : [];
      if (typeof sendSSE === 'function') {
        try { await sendSSE({ type: 'plan', objetivo: input.objetivo, pasos, herramientas_a_usar: input.herramientas_a_usar || [] }); } catch (_) {}
      }
      return JSON.stringify({ ok: true, plan_registrado: true, pasos: pasos.length, objetivo: input.objetivo });
    }

    case 'descubrir_herramientas': {
      const lista = Array.isArray(expertoTools) && expertoTools.length > 0
        ? expertoTools
        : Object.values(TOOLS_POR_EXPERTO).flat();
      const seen = new Set();
      const out = [];
      for (const t of lista) {
        if (!t?.name || seen.has(t.name)) continue;
        seen.add(t.name);
        out.push({ nombre: t.name, descripcion: t.description });
      }
      return JSON.stringify({ total: out.length, herramientas: out }, null, 2);
    }

    case 'recuperar_conversacion': {
      try {
        await ensureConversacionResumenTable(env);
        const tema = (input.tema || '').trim();
        if (!tema) return 'Falta el parámetro "tema".';
        const like = `%${tema}%`;
        const rows = await env.DB.prepare(
          `SELECT tema, resumen, mensajes_cubiertos, canal, updated_at FROM conversacion_resumen
           WHERE tema LIKE ? OR resumen LIKE ? ORDER BY updated_at DESC LIMIT 10`
        ).bind(like, like).all().catch(() => ({ results: [] }));
        const items = rows.results || [];
        if (!items.length) return `No se encontraron conversaciones anteriores sobre "${tema}".`;
        return items.map((r, i) => `${i+1}. [${r.canal} · ${r.updated_at} · ${r.mensajes_cubiertos} msgs]\nTema: ${r.tema || '(sin tema)'}\nResumen: ${r.resumen}`).join('\n\n---\n\n');
      } catch (err) {
        return `Error recuperando conversación: ${err.message}`;
      }
    }

    case 'buscar_web':
      return env.OPENAI_API_KEY
        ? await buscarWebOpenAI(env, input.query)
        : 'OPENAI_API_KEY no configurada — búsqueda web no disponible.';

    case 'memory_save': {
      try {
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (tipo,usuario_id,titulo,contenido,importancia,created_at)
           VALUES(?,?,?,?,?,datetime('now'))`
        ).bind(input.tipo, usuario_id || 'system', input.titulo, input.contenido, input.importancia||3).run();
        return `Guardado en memoria: [${input.tipo}] "${input.titulo}"`;
      } catch (err) {
        return `Error al guardar: ${err.message}`;
      }
    }

    case 'memory_read': {
      try {
        const tipo  = input.tipo;
        const limit = input.limit || 10;
        const rows  = tipo
          ? await env.DB.prepare('SELECT tipo,titulo,contenido,importancia,created_at FROM alejandra_memoria WHERE tipo=? ORDER BY importancia DESC,created_at DESC LIMIT ?').bind(tipo,limit).all()
          : await env.DB.prepare('SELECT tipo,titulo,contenido,importancia,created_at FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT ?').bind(limit).all();
        const items = rows.results || [];
        if (!items.length) return 'No hay registros en memoria para ese filtro.';
        return items.map(r => `[${r.tipo}|imp:${r.importancia}] ${r.titulo}: ${r.contenido}`).join('\n');
      } catch (err) {
        return `Error al leer memoria: ${err.message}`;
      }
    }

    case 'propose_mejora': {
      try {
        const contenido = `TIPO: ${input.tipo} | PRIORIDAD: ${input.prioridad}
DESCRIPCIÓN: ${input.descripcion}
${input.codigo_sugerido ? `CÓDIGO SUGERIDO:\n${input.codigo_sugerido}` : ''}`;
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (tipo,canal,titulo,contenido,importancia,created_at)
           VALUES('mejora',?,?,?,?,datetime('now'))`
        ).bind(usuario_id||'system', `Mejora: ${input.descripcion.substring(0,60)}`, contenido, input.prioridad==='alta'?5:input.prioridad==='media'?3:1).run();
        return `Mejora guardada con prioridad ${input.prioridad}. Adrián la verá en el panel de memoria.`;
      } catch (err) {
        return `Error al guardar mejora: ${err.message}`;
      }
    }

    case 'leer_estado': {
      try {
        const config   = await env.DB.prepare('SELECT modo,auto_fix,max_iterations FROM agente_config ORDER BY updated_at DESC LIMIT 1').first().catch(()=>null);
        const memCount = await env.DB.prepare('SELECT COUNT(*) as n FROM alejandra_memoria').first().catch(()=>({n:0}));
        const decCount = await env.DB.prepare("SELECT COUNT(*) as n FROM alejandra_memoria WHERE tipo='decision'").first().catch(()=>({n:0}));
        const logCount = await env.DB.prepare('SELECT COUNT(*) as n FROM alejandra_logs').first().catch(()=>({n:0}));
        const ultDec   = await env.DB.prepare("SELECT titulo,created_at FROM alejandra_memoria WHERE tipo='decision' ORDER BY created_at DESC LIMIT 5").all().catch(()=>({results:[]}));
        return JSON.stringify({
          config: config || { modo: 'autonomo', auto_fix: 1, max_iterations: 15 },
          memoria_total: memCount?.n || 0,
          decisiones_total: decCount?.n || 0,
          logs_total: logCount?.n || 0,
          ultimas_decisiones: (ultDec.results||[]).map(d=>({ titulo: d.titulo, fecha: d.created_at }))
        }, null, 2);
      } catch (err) {
        return `Error leyendo estado: ${err.message}`;
      }
    }

    case 'tomar_decision': {
      try {
        const { decision, tipo, confianza, auto_aplicar, parametros } = input;
        let resultado = '';
        let aplicado  = false;

        if (tipo === 'config' && auto_aplicar && confianza >= 0.8 && parametros) {
          const modo      = parametros.modo || 'autonomo';
          const maxIter   = parametros.max_iterations || 15;
          await env.DB.prepare(
            `INSERT INTO agente_config (modo,auto_fix,max_iterations,updated_at) VALUES(?,1,?,datetime('now'))
             ON CONFLICT(id) DO UPDATE SET modo=?,auto_fix=1,max_iterations=?,updated_at=datetime('now')`
          ).bind(modo, maxIter, modo, maxIter).run();
          aplicado  = true;
          resultado = `Config aplicada: modo=${modo}, max_iterations=${maxIter}`;
        }

        const imp     = confianza >= 0.8 ? 5 : confianza >= 0.5 ? 3 : 2;
        const titulo  = `Decisión [${tipo}]: ${decision.substring(0, 60)}`;
        const contenido = `DECISIÓN: ${decision}\nCONFIANZA: ${confianza}\nAPLICADA: ${aplicado}${resultado ? '\nRESULTADO: ' + resultado : ''}`;
        await env.DB.prepare(
          `INSERT INTO alejandra_memoria (tipo,canal,titulo,contenido,importancia,created_at)
           VALUES('decision',?,?,?,?,datetime('now'))`
        ).bind(usuario_id||'system', titulo, contenido, imp).run();

        if (aplicado) return `Decisión tomada y aplicada (confianza ${Math.round(confianza*100)}%). ${resultado}`;
        const razon = confianza < 0.8 ? 'Confianza insuficiente (<80%).' : tipo !== 'config' ? `Tipo "${tipo}" no se aplica automáticamente.` : 'auto_aplicar=false.';
        return `Decisión registrada (confianza ${Math.round(confianza*100)}%). ${razon}`;
      } catch (err) {
        return `Error tomar decisión: ${err.message}`;
      }
    }

    case 'listar_archivos': {
      try {
        if (!env.FILES) return 'R2 bucket FILES no configurado.';
        const prefix = input.prefix || 'chat_files/';
        const listed = await env.FILES.list({ prefix, limit: 50 });
        if (!listed.objects || listed.objects.length === 0) {
          return `No se encontraron archivos con prefijo "${prefix}".`;
        }
        const items = listed.objects.map(obj => {
          const sizeKB = (obj.size / 1024).toFixed(1);
          const date = obj.uploaded ? new Date(obj.uploaded).toISOString().split('T')[0] : 'desconocida';
          return `- ${obj.key} (${sizeKB} KB, ${date})`;
        });
        return `${listed.objects.length} archivo(s) encontrados:\n${items.join('\n')}`;
      } catch (err) {
        return `Error listando archivos: ${err.message}`;
      }
    }

    case 'ver_archivo': {
      try {
        if (!env.FILES) return 'R2 bucket FILES no configurado.';
        const obj = await env.FILES.get(input.key);
        if (!obj) return `Archivo no encontrado: "${input.key}"`;

        const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
        const sizeKB = (obj.size / 1024).toFixed(1);

        // Imágenes → devolver como bloque de imagen para visión
        if (contentType.startsWith('image/')) {
          const arrayBuf = await obj.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          // Limitar a ~5MB de imagen para no desbordar
          if (bytes.length > 5 * 1024 * 1024) {
            return `Imagen demasiado grande para analizar (${sizeKB} KB). Nombre: ${input.key}`;
          }
          const base64 = uint8ToBase64(bytes);
          // Retornar como array de content blocks para visión
          return JSON.stringify([
            { type: 'image', source: { type: 'base64', media_type: contentType, data: base64 } },
            { type: 'text', text: `Archivo: ${input.key} (${sizeKB} KB, ${contentType})` }
          ]);
        }

        // Texto, CSV, JSON → devolver contenido
        if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'text/csv') {
          const text = await obj.text();
          const preview = text.length > 8000 ? text.substring(0, 8000) + '\n\n[... truncado, archivo completo tiene ' + text.length + ' caracteres]' : text;
          return `Archivo: ${input.key} (${sizeKB} KB, ${contentType})\n\nContenido:\n${preview}`;
        }

        // PDF → extraer texto básico (sin librería externa, lectura de strings legibles)
        if (contentType === 'application/pdf') {
          const arrayBuf = await obj.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          // Extraer strings legibles del PDF (heurística básica)
          let text = '';
          let inParen = false;
          let current = '';
          for (let i = 0; i < bytes.length && text.length < 8000; i++) {
            const ch = bytes[i];
            if (ch === 0x28) { inParen = true; current = ''; continue; } // (
            if (ch === 0x29 && inParen) { // )
              inParen = false;
              if (current.length > 1) text += current + ' ';
              continue;
            }
            if (inParen && ch >= 32 && ch < 127) current += String.fromCharCode(ch);
          }
          text = text.trim();
          if (!text) return `Archivo PDF: ${input.key} (${sizeKB} KB). No se pudo extraer texto legible (podría ser un PDF escaneado/imagen).`;
          return `Archivo PDF: ${input.key} (${sizeKB} KB)\n\nTexto extraído:\n${text.substring(0, 6000)}`;
        }

        // Excel — metadatos solamente (no hay librería XLSX en Workers)
        if (contentType.includes('spreadsheet') || contentType.includes('excel')) {
          return `Archivo Excel: ${input.key} (${sizeKB} KB, ${contentType}). Para analizar su contenido, pide al usuario que lo exporte como CSV.`;
        }

        return `Archivo: ${input.key} (${sizeKB} KB, ${contentType}). Tipo no soportado para lectura directa.`;
      } catch (err) {
        return `Error leyendo archivo: ${err.message}`;
      }
    }

    case 'ver_esquema_bd': {
      try {
        const tables = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all();
        const schema = [];
        for (const t of (tables.results || [])) {
          const cols = await env.DB.prepare(`PRAGMA table_info(${t.name})`).all();
          schema.push({ tabla: t.name, columnas: (cols.results||[]).map(c => `${c.name} ${c.type}${c.pk ? ' PK' : ''}${c.notnull ? ' NOT NULL' : ''}`) });
        }
        return JSON.stringify(schema, null, 2);
      } catch (err) {
        return `Error leyendo esquema: ${err.message}`;
      }
    }

    case 'consultar_bd': {
      try {
        const query = (input.query || '').trim();
        // Solo permitir SELECT
        if (!/^SELECT\b/i.test(query)) {
          return 'Solo se permiten consultas SELECT (lectura). No se admite INSERT, UPDATE, DELETE, DROP ni otras operaciones de escritura.';
        }
        // Bloquear palabras peligrosas incluso dentro de un SELECT
        if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE)\b/i.test(query)) {
          return 'Consulta rechazada: contiene operaciones de escritura no permitidas.';
        }
        const params = input.params || [];
        const stmt = env.DB.prepare(query);
        const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
        const rows = result.results || [];
        if (rows.length === 0) return 'Consulta ejecutada correctamente. Sin resultados.';
        // Limitar output
        const output = JSON.stringify(rows.slice(0, 50), null, 2);
        const truncated = rows.length > 50 ? `\n\n[... mostrando 50 de ${rows.length} registros]` : '';
        return `${rows.length} registro(s):\n${output.substring(0, 6000)}${truncated}`;
      } catch (err) {
        return `Error en consulta BD: ${err.message}`;
      }
    }

    case 'escribir_bd': {
      try {
        const query = (input.query || '').trim();
        if (/\b(DROP|ALTER|TRUNCATE)\b/i.test(query)) {
          return 'Operación rechazada: DROP, ALTER y TRUNCATE no están permitidos por seguridad.';
        }
        if (/^SELECT\b/i.test(query)) {
          return 'Para consultas SELECT usa la herramienta consultar_bd.';
        }
        if (!/^(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(query)) {
          return 'Solo se permiten INSERT, UPDATE, DELETE o REPLACE.';
        }
        const params = input.params || [];
        const stmt = env.DB.prepare(query);
        const result = params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
        return `Operación ejecutada correctamente. Filas afectadas: ${result.meta?.changes || 0}`;
      } catch (err) {
        return `Error en escritura BD: ${err.message}`;
      }
    }

    case 'enviar_push': {
      try {
        const targetUser = input.usuario_id || usuario_id;
        if (!targetUser) return 'No se pudo determinar el usuario destino.';
        const row = await env.DB.prepare(
          `SELECT contenido FROM alejandra_memoria WHERE tipo='fcm_token' AND usuario_id=? LIMIT 1`
        ).bind(targetUser).first();
        if (!row) return `No hay token FCM registrado para el usuario "${targetUser}". El usuario debe abrir la app primero.`;
        const result = await enviarFCM(env, row.contenido, input.titulo, input.cuerpo || '');
        if (result.ok) return `Push enviado a ${targetUser}: "${input.titulo}"`;
        return `Error enviando push: ${JSON.stringify(result)}`;
      } catch (err) {
        return `Error enviar_push: ${err.message}`;
      }
    }

    case 'iniciar_conversacion': {
      try {
        const targetUser = input.usuario_id || usuario_id;
        if (!targetUser) return 'Falta usuario_id.';
        if (!input.mensaje) return 'Falta el mensaje.';
        await env.DB.prepare(
          `INSERT INTO alejandra_historial (canal, rol, contenido, created_at, usuario_id)
           VALUES ('app_android', 'assistant', ?, datetime('now'), ?)`
        ).bind(input.mensaje, targetUser).run();
        const tituloPush = input.titulo_push || 'Alejandra tiene algo que decirte';
        const preview = input.mensaje.length > 80 ? input.mensaje.substring(0, 80) + '...' : input.mensaje;
        const row = await env.DB.prepare(
          `SELECT contenido FROM alejandra_memoria WHERE tipo='fcm_token' AND usuario_id=? LIMIT 1`
        ).bind(targetUser).first();
        let pushResult = 'sin push (no hay token FCM)';
        if (row) {
          const fcm = await enviarFCM(env, row.contenido, tituloPush, preview);
          pushResult = fcm.ok ? 'push enviado' : `push falló: ${fcm.error || fcm.status}`;
        }
        return `Conversación iniciada con ${targetUser}. Mensaje guardado en historial. Notificación: ${pushResult}`;
      } catch (err) {
        return `Error iniciar_conversacion: ${err.message}`;
      }
    }

    case 'subir_archivo': {
      try {
        if (!env.FILES) return 'R2 bucket FILES no configurado.';
        const ct = input.content_type || 'text/plain';
        await env.FILES.put(input.key, input.contenido, { httpMetadata: { contentType: ct } });
        return `Archivo subido: ${input.key} (${(input.contenido.length / 1024).toFixed(1)} KB, ${ct})`;
      } catch (err) {
        return `Error subir_archivo: ${err.message}`;
      }
    }

    case 'controlar_app': {
      try {
        const targetUser = input.usuario_id || usuario_id;
        if (!targetUser) return 'Falta usuario_id.';
        const payload = JSON.stringify(input.payload || {});
        await env.DB.prepare(
          `INSERT INTO alejandra_comandos (usuario_id, tipo, payload, estado, created_at)
           VALUES (?, ?, ?, 'pendiente', datetime('now'))`
        ).bind(targetUser, input.tipo, payload).run();
        // Enviar push para que la app despierte y recoja el comando
        const row = await env.DB.prepare(
          `SELECT contenido FROM alejandra_memoria WHERE tipo='fcm_token' AND usuario_id=? LIMIT 1`
        ).bind(targetUser).first();
        let pushInfo = 'sin push';
        if (row) {
          const fcm = await enviarFCM(env, row.contenido, 'Alejandra', `Comando: ${input.tipo}`);
          pushInfo = fcm.ok ? 'push enviado' : 'push falló';
        }
        return `Comando "${input.tipo}" enviado a ${targetUser}. Payload: ${payload.substring(0, 200)}. Push: ${pushInfo}. La app lo ejecutará al recibirlo.`;
      } catch (err) {
        return `Error controlar_app: ${err.message}`;
      }
    }

    case 'github_listar':
    case 'github_leer':
    case 'github_escribir':
    case 'github_buscar':
    case 'grep_codigo': {
      if (!env.GITHUB_TOKEN) return 'GITHUB_TOKEN no configurado.';
      const ghToken = env.GITHUB_TOKEN.trim();
      const REPOS = { app: 'padilla585projects/AlejandraIA', worker: 'padilla585projects/Alejandra-APP' };
      const resolveRepo = (r) => REPOS[r] || REPOS[(r||'').toLowerCase()] || (r && r.includes('/') ? r : REPOS.app);
      const ghHeaders = { 'Authorization': `token ${ghToken}`, 'User-Agent': 'Alejandra-Agent', 'Accept': 'application/vnd.github.v3+json' };

      try {
        if (nombre === 'github_listar') {
          const repo = resolveRepo(input.repo);
          const rama = input.rama || 'main';
          const ruta = input.ruta || '';
          const r = await fetch(`https://api.github.com/repos/${repo}/contents/${ruta}?ref=${rama}`, { headers: ghHeaders });
          if (!r.ok) return `Error GitHub (${r.status}): ${await r.text()}`;
          const items = await r.json();
          if (!Array.isArray(items)) return `"${ruta}" es un archivo, no una carpeta. Usa github_leer.`;
          const out = items.map(i => `${i.type === 'dir' ? '📁' : '📄'} ${i.name}${i.size ? ` (${(i.size/1024).toFixed(1)}KB)` : ''}`);
          return `${repo}/${ruta || '(raíz)'} — ${items.length} elementos:\n${out.join('\n')}`;
        }

        if (nombre === 'github_leer') {
          const repo = resolveRepo(input.repo);
          const rama = input.rama || 'main';
          const r = await fetch(`https://api.github.com/repos/${repo}/contents/${input.ruta}?ref=${rama}`, { headers: ghHeaders });
          if (!r.ok) return `Error GitHub (${r.status}): ${await r.text()}`;
          const data = await r.json();
          if (data.type !== 'file') return `"${input.ruta}" no es un archivo (es ${data.type}).`;
          const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
          const lines = content.split('\n');
          const desde = Math.max(1, input.desde_linea || 1);
          const hasta = input.hasta_linea ? Math.min(input.hasta_linea, lines.length) : lines.length;
          // Si el archivo es grande (>500 líneas) y no se pidió rango específico, dar resumen + indicar que use grep_codigo
          if (lines.length > 500 && !input.desde_linea && !input.hasta_linea) {
            const primeras = lines.slice(0, 30).map((l, i) => `${i+1}: ${l}`).join('\n');
            return `📄 ${repo}/${input.ruta} (${lines.length} líneas, ${(data.size/1024).toFixed(1)}KB)\n\nArchivo grande. Primeras 30 líneas:\n${primeras}\n\n[... ${lines.length - 30} líneas más. Usa grep_codigo para buscar dentro, o github_leer con desde_linea/hasta_linea para leer un rango.]`;
          }
          const slice = lines.slice(desde - 1, hasta);
          const numbered = slice.map((l, i) => `${desde + i}: ${l}`).join('\n');
          const maxChars = 50000;
          const output = numbered.length > maxChars ? numbered.substring(0, maxChars) + `\n\n[... truncado, total ${lines.length} líneas]` : numbered;
          return `📄 ${repo}/${input.ruta} (${lines.length} líneas, ${(data.size/1024).toFixed(1)}KB) [líneas ${desde}-${hasta}]\n\n${output}`;
        }

        if (nombre === 'github_escribir') {
          // PROTECCIÓN: archivos grandes solo permitidos para archivos nuevos o pequeños
          const contenidoSize = (input.contenido || '').length;
          const ARCHIVOS_PROTEGIDOS = ['worker.js', 'alejandra-agente/worker.js', 'index.html', 'panel.html'];
          const esProtegido = ARCHIVOS_PROTEGIDOS.some(p => (input.ruta || '').endsWith(p));
          if (esProtegido && contenidoSize > 5000) {
            return `❌ BLOQUEADO: No puedes sobreescribir "${input.ruta}" completo (${(contenidoSize/1024).toFixed(0)}KB). Este archivo tiene miles de líneas — sobreescribirlo borra todo el código existente. Usa grep_codigo para localizar la sección exacta y pídele a Adrián que aplique el cambio quirúrgicamente, o usa github_leer con rango de líneas para leer solo la parte a modificar y propón el diff.`;
          }
          const repo = resolveRepo(input.repo);
          const rama = input.rama || 'main';
          const url = `https://api.github.com/repos/${repo}/contents/${input.ruta}`;
          let sha = undefined;
          const check = await fetch(`${url}?ref=${rama}`, { headers: ghHeaders });
          if (check.ok) { sha = (await check.json()).sha; }
          const body = { message: input.mensaje || `Alejandra: actualizar ${input.ruta}`, content: btoa(unescape(encodeURIComponent(input.contenido))), branch: rama };
          if (sha) body.sha = sha;
          const r = await fetch(url, { method: 'PUT', headers: { ...ghHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!r.ok) return `Error GitHub escribir (${r.status}): ${await r.text()}`;
          const result = await r.json();
          return `✅ Commit en ${repo}/${input.ruta}\nMensaje: ${input.mensaje}\nSHA: ${result.commit?.sha?.substring(0,7) || '?'}`;
        }

        if (nombre === 'github_buscar') {
          const repo = resolveRepo(input.repo);
          const ext = input.extension ? `+extension:${input.extension}` : '';
          const query = encodeURIComponent(`${input.patron}+repo:${repo}${ext}`);
          const r = await fetch(`https://api.github.com/search/code?q=${query}&per_page=20`, { headers: ghHeaders });
          if (!r.ok) return `Error GitHub búsqueda (${r.status}): ${await r.text()}`;
          const data = await r.json();
          if (!data.items || !data.items.length) return `No se encontró "${input.patron}" en ${repo}.`;
          return `${data.total_count} resultado(s) para "${input.patron}" en ${repo}:\n${data.items.map(i => `- ${i.path}`).join('\n')}`;
        }

        if (nombre === 'grep_codigo') {
          const repo = resolveRepo(input.repo || 'worker');
          const rama = input.rama || 'main';
          const r = await fetch(`https://api.github.com/repos/${repo}/contents/${input.ruta}?ref=${rama}`, { headers: ghHeaders });
          if (!r.ok) return `Error GitHub (${r.status}): ${await r.text()}`;
          const data = await r.json();
          if (data.type !== 'file') return `"${input.ruta}" no es un archivo.`;
          const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
          const lines = content.split('\n');
          const patron = input.patron.toLowerCase();
          const ctx = input.contexto != null ? input.contexto : 2;
          const matches = [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(patron)) {
              const start = Math.max(0, i - ctx);
              const end = Math.min(lines.length - 1, i + ctx);
              const block = [];
              for (let j = start; j <= end; j++) {
                const prefix = j === i ? '>>>' : '   ';
                block.push(`${prefix} ${j+1}: ${lines[j]}`);
              }
              matches.push(block.join('\n'));
              if (matches.length >= 10) break;
            }
          }
          if (!matches.length) return `No se encontró "${input.patron}" en ${input.ruta} (${lines.length} líneas).`;
          return `grep "${input.patron}" en ${repo}/${input.ruta} — ${matches.length} coincidencia(s):\n\n${matches.join('\n---\n')}`;
        }
      } catch (err) {
        return `Error ${nombre}: ${err.message}`;
      }
      return `Error: sub-handler no encontrado para ${nombre}`;
    }

    case 'calcular_cable':
      return calcularCable(input);

    case 'calcular_bandeja':
      return calcularBandeja(input);

    case 'calcular_proteccion':
      return calcularProteccion(input);

    case 'analizar_foto_obra': {
      try {
        if (!env.GEMINI_API_KEY) return 'GEMINI_API_KEY no configurada — análisis visual no disponible.';
        if (!env.FILES) return 'R2 bucket FILES no configurado.';
        const obj = await env.FILES.get(input.key);
        if (!obj) return `Imagen no encontrada: "${input.key}"`;
        const ct = obj.httpMetadata?.contentType || 'image/jpeg';
        if (!ct.startsWith('image/')) return `El archivo "${input.key}" no es una imagen (${ct}).`;
        const arrayBuf = await obj.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        if (bytes.length > 10 * 1024 * 1024) return 'Imagen demasiado grande para analizar (máx 10MB).';
        const base64 = uint8ToBase64(bytes);
        const prompt = input.pregunta
          ? `Eres una ingeniera técnica especializada en instalaciones eléctricas y mecánicas industriales. Analiza esta foto de obra y responde en español a la siguiente pregunta: ${input.pregunta}\n\nDescribe también: elementos visibles, estado general, posibles problemas y recomendaciones.`
          : `Eres una ingeniera técnica especializada en instalaciones eléctricas y mecánicas industriales. Analiza esta foto de obra en español. Describe:\n1. Elementos visibles (cables, bandejas, cuadros, equipos, canalizaciones)\n2. Estado general de la instalación\n3. Posibles problemas o incumplimientos normativos\n4. Recomendaciones de mejora\n5. Materiales identificables`;
        const analisis = await analizarFotoConGemini(env, base64, ct, prompt);
        return `Análisis de imagen (${input.key}):\n\n${analisis}`;
      } catch (err) {
        return `Error analizando foto: ${err.message}`;
      }
    }

    case 'analizar_archivo': {
      try {
        if (!env.GEMINI_API_KEY) return 'GEMINI_API_KEY no configurada — análisis de archivos no disponible.';
        if (!env.FILES) return 'R2 bucket FILES no configurado.';
        const obj = await env.FILES.get(input.key);
        if (!obj) return `Archivo no encontrado: "${input.key}"`;
        const ct = obj.httpMetadata?.contentType || 'application/octet-stream';
        const arrayBuf = await obj.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        if (bytes.length > 20 * 1024 * 1024) return 'Archivo demasiado grande (máx 20MB).';
        const base64 = uint8ToBase64(bytes);
        const prompt = input.pregunta
          ? `Analiza este archivo y responde en español: ${input.pregunta}`
          : `Analiza este archivo en detalle. Describe su contenido, estructura y datos relevantes. Responde en español.`;
        const resultado = await analizarArchivoConGemini(env, base64, ct, prompt);
        return `Análisis de archivo (${input.key}):\n\n${resultado}`;
      } catch (err) {
        return `Error analizando archivo: ${err.message}`;
      }
    }

    case 'buscar_google': {
      try {
        if (!env.GEMINI_API_KEY) return 'GEMINI_API_KEY no configurada — búsqueda no disponible.';
        const resultado = await buscarConGemini(env, input.consulta);
        return `Resultados de búsqueda:\n\n${resultado}`;
      } catch (err) {
        return `Error en búsqueda: ${err.message}`;
      }
    }

    // ── Tools de automodificación ────────────────────────────────────────────
    case 'repo_read_file': {
      if (!env.GITHUB_TOKEN) return 'GITHUB_TOKEN no configurado.';
      const { path } = input;
      try {
        const res = await fetch(`https://api.github.com/repos/padilla585projects/Alejandra-APP/contents/${encodeURIComponent(path)}`, {
          headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA' }
        });
        if (!res.ok) return JSON.stringify({ ok: false, error: `HTTP ${res.status}: ${await res.text()}` });
        const data = await res.json();
        if (data.type !== 'file') return JSON.stringify({ ok: false, error: 'No es un archivo' });
        const _b64 = atob(data.content.replace(/\n/g, '')); const _by = new Uint8Array(_b64.length); for (let i = 0; i < _b64.length; i++) _by[i] = _b64.charCodeAt(i);
        const fullContent = new TextDecoder('utf-8').decode(_by);
        const allLines = fullContent.split('\n');
        const totalLines = allLines.length;
        let content; let rangeDesc = '';
        if (input.line_start || input.line_end) {
          const s = Math.max(1, input.line_start || 1) - 1;
          const e = Math.min(totalLines, input.line_end || totalLines);
          content = allLines.slice(s, e).join('\n');
          rangeDesc = ` (lineas ${s+1}-${e} de ${totalLines})`;
        } else {
          content = fullContent.slice(0, 50000);
        }
        const truncated = !input.line_start && !input.line_end && fullContent.length > 50000;
        return JSON.stringify({ ok: true, path, total_lines: totalLines, sha: data.sha, content, truncated, hint: truncated ? `Archivo grande: usa line_start/line_end (total ${totalLines} lineas)` : undefined });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'repo_write_file': {
      if (!env.GITHUB_TOKEN) return 'GITHUB_TOKEN no configurado.';
      const { path, content, message } = input;
      try {
        let sha = null;
        const getRes = await fetch(`https://api.github.com/repos/padilla585projects/Alejandra-APP/contents/${encodeURIComponent(path)}`, {
          headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA' }
        });
        if (getRes.ok) { const existing = await getRes.json(); sha = existing.sha; }
        const encoded = btoa(unescape(encodeURIComponent(content)));
        const body = { message, content: encoded, ...(sha ? { sha } : {}) };
        const putRes = await fetch(`https://api.github.com/repos/padilla585projects/Alejandra-APP/contents/${encodeURIComponent(path)}`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA', 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!putRes.ok) return JSON.stringify({ ok: false, error: `HTTP ${putRes.status}: ${(await putRes.text()).slice(0,300)}` });
        const result = await putRes.json();
        const commitSha = result.commit?.sha?.slice(0, 7);
        autoLearnAgente(env, 'hecho', `Modificado: ${path}`, `Commit ${commitSha}. Cambio: "${message}"`, 2);
        return JSON.stringify({ ok: true, path, commit: commitSha, message, action: sha ? 'updated' : 'created' });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'direct_fix': {
      if (!env.GITHUB_TOKEN) return 'GITHUB_TOKEN no configurado.';
      const { descripcion, archivo, old_code, new_code, razon } = input;
      try {
        const getRes = await fetch(`https://api.github.com/repos/padilla585projects/Alejandra-APP/contents/${encodeURIComponent(archivo)}`, {
          headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA' }
        });
        if (!getRes.ok) return JSON.stringify({ ok: false, error: `GitHub ${getRes.status} leyendo ${archivo}` });
        const fileData = await getRes.json();
        const _b64f = atob(fileData.content.replace(/\n/g, '')); const _byf = new Uint8Array(_b64f.length); for (let i = 0; i < _b64f.length; i++) _byf[i] = _b64f.charCodeAt(i);
        const currentContent = new TextDecoder('utf-8').decode(_byf);
        if (!currentContent.includes(old_code)) {
          return JSON.stringify({ ok: false, error: `old_code no encontrado en ${archivo}. Usa repo_read_file para leer el codigo exacto actual.` });
        }
        const newContent = currentContent.replace(old_code, new_code);
        const encoded = btoa(unescape(encodeURIComponent(newContent)));
        const putRes = await fetch(`https://api.github.com/repos/padilla585projects/Alejandra-APP/contents/${encodeURIComponent(archivo)}`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA', 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `fix(alejandra): ${descripcion}`, content: encoded, sha: fileData.sha })
        });
        if (!putRes.ok) return JSON.stringify({ ok: false, error: `GitHub ${putRes.status}: ${(await putRes.text()).slice(0,300)}` });
        const result = await putRes.json();
        const commitSha = result.commit?.sha?.slice(0, 7);
        // Guardar fix en BD para tracking
        const r = await env.DB.prepare(
          "INSERT INTO alejandra_fixes (descripcion, archivo, contenido_nuevo, razon, estado, commit_sha) VALUES (?,?,?,?,'aplicado',?)"
        ).bind(descripcion, archivo, JSON.stringify({ old: old_code.slice(0,500), new: new_code.slice(0,500) }), razon, commitSha).run().catch(()=>({meta:{}}));
        const fixId = r.meta?.last_row_id || '?';
        // Notificar a Adrian por Telegram
        notificarAdrian(env, `🤖 <b>Fix aplicado #${fixId}</b>\n📁 <code>${archivo}</code>\n📋 ${descripcion}\n💡 ${razon}\n📝 Commit: <code>${commitSha}</code>`).catch(()=>{});
        autoLearnAgente(env, 'hecho', `direct_fix: ${descripcion}`, `Archivo: ${archivo} | Commit: ${commitSha}`, 3);
        const deployMsg = archivo.includes('worker') ? 'Deploy a Cloudflare en ~1min (GitHub Actions).' : 'Deploy a GitHub Pages en ~30s.';
        return JSON.stringify({ ok: true, fix_id: fixId, commit: commitSha, deploy: deployMsg });
      } catch (e) {
        autoLearnAgente(env, 'error', `direct_fix fallo: ${descripcion}`, e.message, 4);
        return JSON.stringify({ ok: false, error: e.message });
      }
    }

    case 'grep_code': {
      if (!env.GITHUB_TOKEN) return 'GITHUB_TOKEN no configurado.';
      const { path, pattern, context_lines = 3 } = input;
      try {
        const getRes = await fetch(`https://api.github.com/repos/padilla585projects/Alejandra-APP/contents/${encodeURIComponent(path)}`, {
          headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA' }
        });
        if (!getRes.ok) return JSON.stringify({ ok: false, error: `GitHub ${getRes.status}` });
        const fileData = await getRes.json();
        const raw = atob(fileData.content.replace(/\n/g, ''));
        const lines = raw.split('\n');
        const regex = new RegExp(pattern, 'gi');
        const matches = [];
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            regex.lastIndex = 0;
            const from = Math.max(0, i - context_lines);
            const to = Math.min(lines.length - 1, i + context_lines);
            const ctx = lines.slice(from, to + 1).map((l, idx) => ({ line: from + idx + 1, text: l, match: (from + idx) === i }));
            matches.push({ line: i + 1, text: lines[i].trim(), context: ctx });
            i += context_lines;
          }
          regex.lastIndex = 0;
        }
        return JSON.stringify({ ok: true, path, pattern, total_lines: lines.length, matches_found: matches.length, matches: matches.slice(0, 20) });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'run_migration': {
      const { sql, descripcion } = input;
      try {
        const stmts = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const results = [];
        for (const stmt of stmts) {
          try {
            const r = await env.DB.prepare(stmt).run();
            results.push({ sql: stmt.slice(0, 80), ok: true });
          } catch (e) {
            results.push({ sql: stmt.slice(0, 80), ok: false, error: e.message });
          }
        }
        const allOk = results.every(r => r.ok);
        if (allOk) autoLearnAgente(env, 'hecho', `Migracion: ${descripcion || sql.slice(0, 60)}`, sql.slice(0, 300), 3);
        return JSON.stringify({ ok: allOk, results, total: stmts.length, ok_count: results.filter(r => r.ok).length });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'check_deploy_status': {
      if (!env.GITHUB_TOKEN) return 'GITHUB_TOKEN no configurado.';
      try {
        const [runsRes, commitsRes] = await Promise.all([
          fetch('https://api.github.com/repos/padilla585projects/Alejandra-APP/actions/runs?per_page=5', {
            headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA' }
          }),
          fetch('https://api.github.com/repos/padilla585projects/Alejandra-APP/commits?per_page=5', {
            headers: { 'Authorization': `token ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlejandraIA' }
          })
        ]);
        const runsData = runsRes.ok ? await runsRes.json() : { workflow_runs: [] };
        const commitsData = commitsRes.ok ? await commitsRes.json() : [];
        const runs = (runsData.workflow_runs || []).map(r => ({
          workflow: r.name, status: r.status, conclusion: r.conclusion,
          created_at: r.created_at, commit: r.head_sha?.slice(0, 7),
          commit_msg: r.head_commit?.message?.slice(0, 60)
        }));
        const commits = (Array.isArray(commitsData) ? commitsData : []).map(c => ({
          sha: c.sha?.slice(0, 7), msg: c.commit?.message?.slice(0, 80), date: c.commit?.author?.date
        }));
        const latest = runs[0];
        const summary = !latest ? 'Sin runs de GitHub Actions.'
          : latest.status === 'completed' && latest.conclusion === 'success' ? `OK (commit ${latest.commit})`
          : latest.status === 'in_progress' ? `En curso (commit ${latest.commit})`
          : `FALLO: ${latest.conclusion} (commit ${latest.commit})`;
        return JSON.stringify({ ok: true, summary, runs: runs.slice(0, 5), recent_commits: commits });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'enviar_notificacion': {
      const uid = (input.usuario_id || '').trim();
      const titulo = (input.titulo || '').trim();
      const msg = (input.mensaje || '').trim();
      if (!uid || !titulo || !msg) return 'Faltan parámetros: usuario_id, titulo, mensaje.';
      const pushResult = await sendPushToUser(env, uid, titulo, msg);
      return JSON.stringify(pushResult);
    }

    case 'crear_tarea_background': {
      const desc = (input.descripcion || '').trim();
      if (!desc) return 'Falta "descripcion" de la tarea.';
      const uid = input.usuario_id || usuario_id || 'system';
      try {
        await env.DB.prepare(
          `INSERT INTO alejandra_tareas (usuario_id, descripcion, estado) VALUES (?, ?, 'pendiente')`
        ).bind(uid, desc).run();
        return JSON.stringify({ ok: true, msg: `Tarea creada para ${uid}: ${desc}` });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'ver_tareas': {
      const uid = input.usuario_id || usuario_id || 'system';
      const estado = input.estado || null;
      try {
        let q = 'SELECT id, descripcion, estado, resultado, created_at, completed_at FROM alejandra_tareas WHERE usuario_id=?';
        const binds = [uid];
        if (estado) { q += ' AND estado=?'; binds.push(estado); }
        q += ' ORDER BY created_at DESC LIMIT 20';
        const stmt = env.DB.prepare(q);
        const rows = binds.length === 2 ? await stmt.bind(binds[0], binds[1]).all() : await stmt.bind(binds[0]).all();
        return JSON.stringify({ ok: true, tareas: rows.results || [] });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'completar_tarea': {
      const id = input.tarea_id;
      const resultado = (input.resultado || '').trim();
      if (!id) return 'Falta "tarea_id".';
      try {
        await env.DB.prepare(
          `UPDATE alejandra_tareas SET estado='completada', resultado=?, completed_at=datetime('now') WHERE id=?`
        ).bind(resultado, id).run();
        // Notificar al usuario si tiene push
        const tarea = await env.DB.prepare('SELECT usuario_id, descripcion FROM alejandra_tareas WHERE id=?').bind(id).first();
        if (tarea) {
          await sendPushToUser(env, tarea.usuario_id, '✅ Tarea completada', tarea.descripcion).catch(()=>{});
        }
        return JSON.stringify({ ok: true, msg: 'Tarea marcada como completada.' });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    // ── Tools de capacidades avanzadas ──────────────────────────────────────────

    case 'buscar_precios': {
      const producto = (input.producto || '').trim();
      const fabricante = (input.fabricante || '').trim();
      const cantidad = input.cantidad || 1;
      if (!producto) return 'Falta "producto" para buscar precios.';
      try {
        // 1. Buscar en caché (válido 7 días)
        const cacheKey = fabricante ? `${producto} ${fabricante}` : producto;
        const cached = await env.DB.prepare(
          "SELECT * FROM precios_materiales WHERE producto LIKE ? AND (fabricante LIKE ? OR ? = '') AND datetime(expires_at) > datetime('now') ORDER BY created_at DESC LIMIT 1"
        ).bind(`%${producto}%`, `%${fabricante}%`, fabricante).first().catch(() => null);
        if (cached) {
          const total_min = cached.precio_min * cantidad;
          const total_max = cached.precio_max * cantidad;
          return JSON.stringify({
            ok: true, cached: true, producto: cached.producto, fabricante: cached.fabricante,
            precio_min: cached.precio_min, precio_max: cached.precio_max, moneda: cached.moneda,
            cantidad, total_min, total_max, fuente: cached.fuente, datos_extra: cached.datos_extra,
            actualizado: cached.created_at, expira: cached.expires_at
          });
        }
        // 2. Buscar con Gemini + Google Search grounding
        if (!env.GEMINI_API_KEY) return 'GEMINI_API_KEY no configurada — no puedo buscar precios.';
        const query = `precio ${producto} ${fabricante} distribuidor eléctrico España 2026 precio unitario`;
        const resultado = await buscarConGemini(env, query);
        // 3. Parsear resultado para extraer precios (heurística)
        const precioRegex = /(\d+[.,]?\d*)\s*€/g;
        const precios = [];
        let match;
        while ((match = precioRegex.exec(resultado)) !== null) {
          precios.push(parseFloat(match[1].replace(',', '.')));
        }
        const precio_min = precios.length > 0 ? Math.min(...precios) : 0;
        const precio_max = precios.length > 0 ? Math.max(...precios) : 0;
        // 4. Guardar en caché
        if (precio_min > 0) {
          await env.DB.prepare(
            "INSERT INTO precios_materiales (producto, fabricante, precio_min, precio_max, moneda, fuente, datos_extra, expires_at) VALUES (?, ?, ?, ?, 'EUR', 'Google Search (Gemini)', ?, datetime('now', '+7 days'))"
          ).bind(producto, fabricante || null, precio_min, precio_max, resultado.slice(0, 500)).run().catch(() => {});
        }
        const total_min = precio_min * cantidad;
        const total_max = precio_max * cantidad;
        return JSON.stringify({
          ok: true, cached: false, producto, fabricante: fabricante || 'N/A',
          precio_min, precio_max, moneda: 'EUR', cantidad, total_min, total_max,
          fuente: 'Google Search (Gemini)', detalle: resultado.slice(0, 800)
        });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'marcar_plano': {
      const key = (input.key || '').trim();
      const instrucciones = (input.instrucciones || '').trim();
      const tipo = input.tipo || 'general';
      if (!key || !instrucciones) return 'Faltan "key" e "instrucciones".';
      try {
        if (!env.GEMINI_API_KEY) return 'GEMINI_API_KEY no configurada — no puedo analizar planos.';
        const obj = await env.FILES.get(key);
        if (!obj) return `Archivo no encontrado en R2: ${key}`;
        const buf = await obj.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const mimeType = obj.httpMetadata?.contentType || 'application/pdf';
        const prompt = `Eres un ingeniero técnico experto en instalaciones eléctricas y mecánicas. Analiza este plano/documento técnico de tipo "${tipo}".

INSTRUCCIONES DEL USUARIO: ${instrucciones}

Genera un INFORME TÉCNICO DETALLADO con:
1. DESCRIPCIÓN GENERAL: qué muestra el plano, escala estimada, tipo de instalación
2. ELEMENTOS IDENTIFICADOS: lista de componentes, circuitos, equipos visibles
3. MEDICIONES/DIMENSIONES: distancias, secciones, calibres que puedas leer o estimar
4. ANOTACIONES TÉCNICAS: observaciones por zona/cuadrante del plano
5. PROBLEMAS DETECTADOS: errores, incumplimientos de normativa, riesgos
6. RECOMENDACIONES: mejoras, correcciones necesarias

Para cada observación, indica la ZONA del plano (superior-izquierda, centro, etc.) donde se encuentra.
Sé específico y técnico. Cita normativa (REBT, ITC-BT) cuando sea relevante.`;
        const resultado = await analizarArchivoConGemini(env, base64, mimeType, prompt);
        return JSON.stringify({ ok: true, tipo_plano: tipo, key, analisis: resultado });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'generar_documento': {
      const tipo = input.tipo;
      const datos = input.datos || {};
      const titulo = input.titulo || `${tipo}_${new Date().toISOString().split('T')[0]}`;
      if (!tipo) return 'Falta "tipo" de documento.';
      try {
        const fecha = new Date().toISOString().split('T')[0];
        const hora = new Date().toISOString().split('T')[1]?.slice(0, 5) || '00:00';
        let contenido = '';
        switch (tipo) {
          case 'memoria_tecnica':
            contenido = `═══════════════════════════════════════════════════════════
MEMORIA TÉCNICA DESCRIPTIVA
═══════════════════════════════════════════════════════════
Título: ${datos.titulo || titulo}
Fecha: ${fecha}
Obra: ${datos.obra || 'N/A'}
Instalador: ${datos.instalador || 'N/A'}
CIF/NIF: ${datos.cif || 'N/A'}
Dirección obra: ${datos.direccion || 'N/A'}
───────────────────────────────────────────────────────────
1. OBJETO
${datos.objeto || 'Descripción de la instalación eléctrica/mecánica.'}

2. NORMATIVA APLICABLE
${datos.normativa || '- REBT (RD 842/2002)\n- ITC-BT aplicables\n- UNE 20460\n- Normas particulares de la compañía suministradora'}

3. DESCRIPCIÓN DE LA INSTALACIÓN
${datos.descripcion || 'Pendiente de rellenar.'}

4. POTENCIA PREVISTA
${datos.potencia || 'Pendiente de cálculo.'}

5. CÁLCULOS JUSTIFICATIVOS
${datos.calculos || 'Ver anexo de cálculos.'}

6. PLIEGO DE CONDICIONES
${datos.pliego || 'Los materiales cumplirán las normas UNE aplicables.'}

Firmado: ${datos.firmante || 'El instalador autorizado'}
Fecha: ${fecha}`;
            break;
          case 'certificado_instalacion':
            contenido = `═══════════════════════════════════════════════════════════
CERTIFICADO DE INSTALACIÓN ELÉCTRICA
═══════════════════════════════════════════════════════════
Nº Certificado: ${datos.numero || 'PEND-' + Date.now()}
Fecha: ${fecha}
───────────────────────────────────────────────────────────
DATOS DEL TITULAR
Nombre: ${datos.titular || 'N/A'}
Dirección: ${datos.direccion || 'N/A'}
Localidad: ${datos.localidad || 'N/A'}

DATOS DE LA INSTALACIÓN
Tipo: ${datos.tipo_instalacion || 'Baja Tensión'}
Tensión: ${datos.tension || '230/400V'}
Potencia instalada: ${datos.potencia_instalada || 'N/A'} W
Potencia demandada: ${datos.potencia_demandada || 'N/A'} W

DATOS DEL INSTALADOR
Empresa: ${datos.empresa_instaladora || 'N/A'}
Nº REIE: ${datos.reie || 'N/A'}
Instalador autorizado: ${datos.instalador || 'N/A'}

RESULTADO DE LAS VERIFICACIONES
Continuidad de conductores: ${datos.continuidad || 'OK'}
Resistencia de aislamiento: ${datos.aislamiento || '> 0,5 MΩ'}
Resistencia de tierra: ${datos.tierra || 'N/A'} Ω
Protecciones diferenciales: ${datos.diferenciales || 'OK'}

DECLARACIÓN: Certifico que la instalación cumple con el REBT.

Firmado: ${datos.firmante || 'Instalador autorizado'}`;
            break;
          case 'lista_materiales':
            contenido = `═══════════════════════════════════════════════════════════
LISTA DE MATERIALES
═══════════════════════════════════════════════════════════
Obra: ${datos.obra || 'N/A'}
Fecha: ${fecha}
───────────────────────────────────────────────────────────
Nº | Material | Ref. | Fabricante | Cantidad | Unidad | Precio/ud | Total
`;
            if (Array.isArray(datos.materiales)) {
              datos.materiales.forEach((m, i) => {
                const total = ((m.precio_unitario || 0) * (m.cantidad || 0)).toFixed(2);
                contenido += `${i+1} | ${m.nombre || 'N/A'} | ${m.referencia || '-'} | ${m.fabricante || '-'} | ${m.cantidad || 0} | ${m.unidad || 'ud'} | ${m.precio_unitario || 0}€ | ${total}€\n`;
              });
              const granTotal = datos.materiales.reduce((s, m) => s + ((m.precio_unitario || 0) * (m.cantidad || 0)), 0);
              contenido += `───────────────────────────────────────────────────────────\nTOTAL MATERIALES: ${granTotal.toFixed(2)}€`;
            } else {
              contenido += '(Añadir materiales)';
            }
            break;
          case 'presupuesto':
            contenido = `═══════════════════════════════════════════════════════════
PRESUPUESTO
═══════════════════════════════════════════════════════════
Cliente: ${datos.cliente || 'N/A'}
Obra: ${datos.obra || 'N/A'}
Fecha: ${fecha}
Validez: ${datos.validez || '30 días'}
───────────────────────────────────────────────────────────
PARTIDAS:
`;
            if (Array.isArray(datos.partidas)) {
              let totalBase = 0;
              datos.partidas.forEach((p, i) => {
                const subtotal = ((p.precio || 0) * (p.cantidad || 1)).toFixed(2);
                totalBase += parseFloat(subtotal);
                contenido += `${i+1}. ${p.descripcion || 'Partida'}\n   Cantidad: ${p.cantidad || 1} ${p.unidad || 'ud'} × ${p.precio || 0}€ = ${subtotal}€\n\n`;
              });
              const iva = totalBase * (datos.iva_pct || 21) / 100;
              contenido += `───────────────────────────────────────────────────────────
BASE IMPONIBLE: ${totalBase.toFixed(2)}€
IVA (${datos.iva_pct || 21}%): ${iva.toFixed(2)}€
TOTAL: ${(totalBase + iva).toFixed(2)}€`;
            } else {
              contenido += '(Añadir partidas)';
            }
            break;
          case 'informe_obra':
            contenido = `═══════════════════════════════════════════════════════════
INFORME DE ESTADO DE OBRA
═══════════════════════════════════════════════════════════
Obra: ${datos.obra || 'N/A'}
Fecha informe: ${fecha} ${hora}
Responsable: ${datos.responsable || 'N/A'}
───────────────────────────────────────────────────────────
ESTADO GENERAL: ${datos.estado_general || 'En curso'}
AVANCE ESTIMADO: ${datos.avance_pct || 0}%

TRABAJOS REALIZADOS:
${datos.trabajos_realizados || '- Pendiente de rellenar'}

INCIDENCIAS:
${datos.incidencias || '- Sin incidencias relevantes'}

MATERIALES PENDIENTES:
${datos.materiales_pendientes || '- Sin materiales pendientes'}

PERSONAL EN OBRA: ${datos.personal_count || 'N/A'} personas

OBSERVACIONES:
${datos.observaciones || 'Sin observaciones adicionales.'}

PRÓXIMOS PASOS:
${datos.proximos_pasos || '- Pendiente de definir'}`;
            break;
          default:
            return `Tipo de documento "${tipo}" no soportado.`;
        }
        // Guardar en R2
        const r2Key = `documentos/${fecha}_${tipo}_${titulo.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
        await env.FILES.put(r2Key, contenido, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } });
        return JSON.stringify({ ok: true, tipo, titulo, r2_key: r2Key, contenido, mensaje: `Documento generado y guardado en R2: ${r2Key}` });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'buscar_normativa': {
      const consulta = (input.consulta || '').trim();
      const itc = (input.itc || '').trim();
      const tema = (input.tema || '').trim();
      if (!consulta) return 'Falta "consulta" para buscar normativa.';
      try {
        let sql = "SELECT norma, seccion, titulo, contenido, palabras_clave FROM normativa_index WHERE 1=1";
        const binds = [];
        if (itc) {
          sql += " AND seccion LIKE ?";
          binds.push(`%${itc}%`);
        }
        // Buscar por palabras de la consulta
        const palabras = consulta.toLowerCase().split(/\s+/).filter(p => p.length > 2);
        if (palabras.length > 0) {
          const conditions = palabras.map(() => "(LOWER(titulo) LIKE ? OR LOWER(contenido) LIKE ? OR LOWER(palabras_clave) LIKE ?)");
          sql += ` AND (${conditions.join(' OR ')})`;
          for (const p of palabras) {
            binds.push(`%${p}%`, `%${p}%`, `%${p}%`);
          }
        }
        if (tema) {
          sql += " AND (LOWER(palabras_clave) LIKE ? OR LOWER(titulo) LIKE ?)";
          binds.push(`%${tema.toLowerCase()}%`, `%${tema.toLowerCase()}%`);
        }
        sql += " LIMIT 10";
        let stmt = env.DB.prepare(sql);
        if (binds.length > 0) stmt = stmt.bind(...binds);
        const rows = await stmt.all();
        const resultados = rows.results || [];
        if (resultados.length === 0) {
          return JSON.stringify({ ok: true, resultados: [], mensaje: `No se encontró normativa para "${consulta}". Prueba con buscar_web para consultar online.` });
        }
        return JSON.stringify({ ok: true, consulta, itc: itc || 'todas', resultados_count: resultados.length, resultados });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'historico_materiales': {
      const accion = input.accion;
      if (!accion) return 'Falta "accion" (registrar, consultar, comparar).';
      try {
        switch (accion) {
          case 'registrar': {
            const material = (input.material || '').trim();
            if (!material) return 'Falta "material" para registrar.';
            await env.DB.prepare(
              "INSERT INTO materiales_obra (obra_id, obra_nombre, material, referencia, fabricante, cantidad, unidad, precio_unitario, proveedor, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(
              input.obra_id || null, input.obra_nombre || null, material,
              input.referencia || null, input.fabricante || null,
              input.cantidad || 0, input.unidad || 'ud',
              input.precio_unitario || 0, input.proveedor || null, input.notas || null
            ).run();
            const total = (input.cantidad || 0) * (input.precio_unitario || 0);
            return JSON.stringify({ ok: true, msg: `Material registrado: ${material} ×${input.cantidad || 0} ${input.unidad || 'ud'} = ${total.toFixed(2)}€` });
          }
          case 'consultar': {
            let sql = "SELECT * FROM materiales_obra WHERE 1=1";
            const binds = [];
            if (input.obra_id) { sql += " AND obra_id=?"; binds.push(input.obra_id); }
            if (input.material) { sql += " AND material LIKE ?"; binds.push(`%${input.material}%`); }
            if (input.proveedor) { sql += " AND proveedor LIKE ?"; binds.push(`%${input.proveedor}%`); }
            sql += " ORDER BY fecha DESC LIMIT 50";
            let stmt = env.DB.prepare(sql);
            if (binds.length > 0) stmt = stmt.bind(...binds);
            const rows = await stmt.all();
            const materiales = rows.results || [];
            const totalGastado = materiales.reduce((s, m) => s + ((m.precio_unitario || 0) * (m.cantidad || 0)), 0);
            return JSON.stringify({ ok: true, count: materiales.length, total_gastado: totalGastado.toFixed(2) + '€', materiales });
          }
          case 'comparar': {
            const rows = await env.DB.prepare(
              "SELECT obra_id, obra_nombre, material, SUM(cantidad) as total_cantidad, unidad, ROUND(AVG(precio_unitario),2) as precio_medio, SUM(cantidad * precio_unitario) as coste_total FROM materiales_obra GROUP BY obra_id, material ORDER BY material, obra_id"
            ).all();
            return JSON.stringify({ ok: true, comparativa: rows.results || [] });
          }
          default:
            return `Acción "${accion}" no reconocida. Usa: registrar, consultar, comparar.`;
        }
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'configurar_alerta': {
      const accion = input.accion;
      if (!accion) return 'Falta "accion" (crear, listar, eliminar, verificar).';
      try {
        switch (accion) {
          case 'crear': {
            const tipo = (input.tipo || '').trim();
            const condicion = (input.condicion || '').trim();
            const mensaje = (input.mensaje || '').trim();
            if (!tipo || !condicion) return 'Faltan "tipo" y "condicion" para crear alerta.';
            await env.DB.prepare(
              "INSERT INTO alertas_config (tipo, nombre, condicion_sql, umbral, mensaje_template) VALUES (?, ?, ?, ?, ?)"
            ).bind(tipo, input.nombre || tipo, condicion, input.umbral || 0, mensaje || `Alerta: ${tipo}`).run();
            return JSON.stringify({ ok: true, msg: `Alerta "${tipo}" creada.` });
          }
          case 'listar': {
            const rows = await env.DB.prepare(
              "SELECT id, tipo, nombre, condicion_sql, umbral, mensaje_template, canal, activa, ultima_ejecucion, created_at FROM alertas_config ORDER BY created_at DESC"
            ).all();
            return JSON.stringify({ ok: true, alertas: rows.results || [] });
          }
          case 'eliminar': {
            const id = input.alerta_id;
            if (!id) return 'Falta "alerta_id" para eliminar.';
            await env.DB.prepare("DELETE FROM alertas_config WHERE id=?").bind(id).run();
            return JSON.stringify({ ok: true, msg: `Alerta #${id} eliminada.` });
          }
          case 'verificar': {
            const alertas = await env.DB.prepare(
              "SELECT id, tipo, nombre, condicion_sql, umbral, mensaje_template FROM alertas_config WHERE activa=1"
            ).all();
            const resultados = [];
            for (const alerta of (alertas.results || [])) {
              try {
                const rows = await env.DB.prepare(alerta.condicion_sql).all();
                const items = rows.results || [];
                if (items.length > 0) {
                  resultados.push({
                    alerta_id: alerta.id, tipo: alerta.tipo, nombre: alerta.nombre,
                    disparada: true, items_count: items.length,
                    detalle: items.slice(0, 5)
                  });
                }
                await env.DB.prepare("UPDATE alertas_config SET ultima_ejecucion=datetime('now') WHERE id=?").bind(alerta.id).run().catch(() => {});
              } catch (e) {
                resultados.push({ alerta_id: alerta.id, tipo: alerta.tipo, error: e.message });
              }
            }
            const disparadas = resultados.filter(r => r.disparada);
            return JSON.stringify({
              ok: true, alertas_verificadas: resultados.length,
              alertas_disparadas: disparadas.length, resultados
            });
          }
          default:
            return `Acción "${accion}" no reconocida. Usa: crear, listar, eliminar, verificar.`;
        }
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    case 'exportar_datos': {
      const tipo = input.tipo;
      if (!tipo) return 'Falta "tipo" de exportación.';
      try {
        let sql = '';
        let filename = '';
        const fecha = new Date().toISOString().split('T')[0];
        const filtroFechas = (campo) => {
          let where = '';
          if (input.fecha_desde) where += ` AND ${campo} >= '${input.fecha_desde}'`;
          if (input.fecha_hasta) where += ` AND ${campo} <= '${input.fecha_hasta}'`;
          return where;
        };
        switch (tipo) {
          case 'bobinas':
            sql = `SELECT id, nombre, tipo, seccion, metros_totales, metros_restantes, ubicacion, created_at FROM bobinas WHERE 1=1${input.obra_id ? ' AND obra_id=' + input.obra_id : ''}${filtroFechas('created_at')} ORDER BY nombre`;
            filename = `bobinas_${fecha}`;
            break;
          case 'personal':
            sql = `SELECT id, nombre, apellidos, dni, puesto, departamento, activo, telefono, email FROM personal WHERE 1=1${input.obra_id ? ' AND obra_id=' + input.obra_id : ''} ORDER BY nombre`;
            filename = `personal_${fecha}`;
            break;
          case 'fichajes':
            sql = `SELECT f.id, p.nombre, f.tipo, f.fecha, f.hora, f.ubicacion FROM fichajes f LEFT JOIN personal p ON p.id = f.usuario_id WHERE 1=1${input.obra_id ? ' AND f.obra_id=' + input.obra_id : ''}${filtroFechas('f.fecha')} ORDER BY f.fecha DESC, f.hora DESC`;
            filename = `fichajes_${fecha}`;
            break;
          case 'materiales':
            sql = `SELECT * FROM materiales_obra WHERE 1=1${input.obra_id ? ' AND obra_id=' + input.obra_id : ''}${filtroFechas('fecha')} ORDER BY fecha DESC`;
            filename = `materiales_${fecha}`;
            break;
          case 'gastos':
            sql = `SELECT * FROM gastos WHERE 1=1${input.obra_id ? ' AND obra_id=' + input.obra_id : ''}${filtroFechas('fecha')} ORDER BY fecha DESC`;
            filename = `gastos_${fecha}`;
            break;
          case 'custom':
            if (!input.sql_custom) return 'Falta "sql_custom" para exportación personalizada.';
            if (!input.sql_custom.trim().toUpperCase().startsWith('SELECT')) return 'Solo se permiten consultas SELECT.';
            sql = input.sql_custom;
            filename = `custom_${fecha}`;
            break;
          default:
            return `Tipo "${tipo}" no soportado. Usa: bobinas, personal, fichajes, materiales, gastos, custom.`;
        }
        const rows = await env.DB.prepare(sql).all();
        const data = rows.results || [];
        if (data.length === 0) return JSON.stringify({ ok: true, rows: 0, msg: 'Sin datos para exportar.' });
        // Generar CSV
        const headers = Object.keys(data[0]);
        let csv = headers.join(';') + '\n';
        for (const row of data) {
          csv += headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            const str = String(val).replace(/"/g, '""');
            return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
          }).join(';') + '\n';
        }
        // Guardar en R2
        const r2Key = `exports/${filename}.csv`;
        await env.FILES.put(r2Key, csv, { httpMetadata: { contentType: 'text/csv; charset=utf-8' } });
        const preview = data.slice(0, 3);
        return JSON.stringify({
          ok: true, tipo, rows: data.length, r2_key: r2Key,
          preview, msg: `Exportados ${data.length} registros a ${r2Key}`
        });
      } catch (e) { return JSON.stringify({ ok: false, error: e.message }); }
    }

    default:
      return `Tool "${nombre}" no reconocida.`;
  }
}

// ── Reflexión autónoma ────────────────────────────────────────────────────────
// Se puede lanzar desde /api/reflexion o llamarla manualmente
async function ejecutarReflexion(env) {
  if (!env.ANTHROPIC_API_KEY) return;
  console.log('Reflexión autónoma iniciada...');

  try {
    // Leer historial unificado (app + panel + telegram) y memoria compartida
    const chats = await env.DB.prepare(
      `SELECT canal, rol, contenido FROM alejandra_historial ORDER BY created_at DESC LIMIT 60`
    ).all();
    const memoria = await env.DB.prepare(
      `SELECT tipo,titulo,contenido FROM alejandra_memoria ORDER BY importancia DESC,created_at DESC LIMIT 20`
    ).all();

    const mensajesRecientes = (chats.results||[]).reverse();
    const pares = [];
    for (let i = 0; i < mensajesRecientes.length - 1; i++) {
      if (mensajesRecientes[i].rol === 'user' && mensajesRecientes[i+1].rol === 'assistant') {
        pares.push(`[${mensajesRecientes[i].canal}] U: ${mensajesRecientes[i].contenido?.substring(0,80)}\nA: ${mensajesRecientes[i+1].contenido?.substring(0,80)}`);
        i++;
      }
    }

    const resumen = `Últimas ${pares.length} conversaciones (app+panel+telegram) y ${memoria.results?.length||0} registros en memoria.

Conversaciones recientes:
${pares.slice(-10).join('\n---\n')}

Memoria actual:
${(memoria.results||[]).map(m=>`[${m.tipo}] ${m.titulo}`).join('\n')}`;

    const reflexionPrompt = buildSystemPrompt(['base','tecnica','nexus','evolucion','reflexion','formato']);

    const messages = [{
      role: 'user',
      content: `Analiza tus conversaciones recientes y tu memoria actual. Reflexiona sobre:
1. ¿Qué patrones de preguntas ves? ¿Hay algo que no estás respondiendo bien?
2. ¿Qué aprendizajes nuevos deberías guardar?
3. ¿Qué mejoras concretas propondrías a tu propio sistema?

Datos:\n${resumen}`
    }];

    const tools = [TOOL_MEMORY_SAVE, TOOL_MEMORY_READ, TOOL_PROPOSE_MEJORA];
    let respAPI = await llamarAnthropic(env, messages, tools, MODEL_EXPERTO, 2048, reflexionPrompt);

    // Ejecutar tools si las usa
    let iter = 0;
    while (respAPI.stop_reason === 'tool_use' && iter < 5) {
      const toolBlocks = respAPI.content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: respAPI.content });
      const results = [];
      for (const tb of toolBlocks) {
        const r = await ejecutarTool(env, tb.name, tb.input, 'reflexion', 'system');
        results.push({ type: 'tool_result', tool_use_id: tb.id, content: r });
      }
      messages.push({ role: 'user', content: results });
      respAPI = await llamarAnthropic(env, messages, [], MODEL_EXPERTO, 1024, reflexionPrompt);
      iter++;
    }

    const conclusion = respAPI.content?.find(b => b.type === 'text')?.text || '';
    if (conclusion) {
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (tipo,canal,titulo,contenido,importancia,created_at)
         VALUES('contexto','system','Auto-reflexión',?,4,datetime('now'))`
      ).bind(conclusion.substring(0, 1000)).run();
    }

    console.log('Reflexión completada:', conclusion.substring(0,100));
  } catch (err) {
    console.error('ERROR reflexión:', err.message);
  }
}

// ── Clasificador Haiku ────────────────────────────────────────────────────────
async function clasificarConHaiku(env, mensaje) {
  const sistema = `Clasificador para agente IA. Responde SOLO con JSON válido.

Expertos:
- "simple": SOLO saludos breves, "ok", "gracias", "sí", "no". Nada más.
- "app": CUALQUIER problema, consulta operativa, datos de la empresa, equipos, personal, fichajes, incidencias, bobinas, errores de la app, algo que no funciona, reportes de usuarios, quejas. USA ESTE PARA TODO LO QUE REQUIERA INVESTIGAR O ACTUAR.
- "tecnico": arquitectura interna de Alejandra, código del worker, deploy, cómo funciona NEXUS, preguntas de Adrián sobre el sistema
- "web": necesita info actual de internet (precios mercado, normativas nuevas, noticias)
- "reflexion": reflexión sobre sí misma, mejoras propias, autoconocimiento
- "ingenieria": cálculos eléctricos, cables, bandejas, protecciones, fotos de obra, normativa técnica, sección de cable, caída de tensión
- "completo": quién es, historia, capacidades generales, preguntas existenciales

REGLA: Si el usuario reporta un PROBLEMA (algo no funciona, algo se rompió, no puede hacer algo, hay un error) → SIEMPRE "app". Si hay URGENCIA → SIEMPRE "app".

JSON: {"experto":"...","buscar_web":bool,"query_web":"búsqueda en inglés o null"}

Ejemplos:
"hola" → {"experto":"simple","buscar_web":false,"query_web":null}
"cuántas bobinas tenemos" → {"experto":"app","buscar_web":false,"query_web":null}
"no me deja fichar" → {"experto":"app","buscar_web":false,"query_web":null}
"la carretilla no arranca" → {"experto":"app","buscar_web":false,"query_web":null}
"hay una incidencia en obra" → {"experto":"app","buscar_web":false,"query_web":null}
"quién fichó hoy" → {"experto":"app","buscar_web":false,"query_web":null}
"no funciona X" → {"experto":"app","buscar_web":false,"query_web":null}
"precio cable RZ1-K hoy" → {"experto":"web","buscar_web":true,"query_web":"RZ1-K cable price 2025"}
"cómo funciona tu NEXUS" → {"experto":"tecnico","buscar_web":false,"query_web":null}
"piensa en cómo mejorar" → {"experto":"reflexion","buscar_web":false,"query_web":null}
"calcula sección de cable para 10kW" → {"experto":"ingenieria","buscar_web":false,"query_web":null}
"analiza esta foto de la bandeja" → {"experto":"ingenieria","buscar_web":false,"query_web":null}`;

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL_ROUTER, max_tokens: 80, system: sistema, messages: [{ role: 'user', content: mensaje.substring(0,200) }] })
    });
    if (!resp.ok) throw new Error(`Haiku ${resp.status}`);
    const data  = await resp.json();
    if (data.usage) registrarTokenUso(env, MODEL_ROUTER, 'clasificacion', data.usage.input_tokens||0, data.usage.output_tokens||0, null);
    const texto = data.content?.[0]?.text?.trim() || '{}';
    const match = texto.match(/\{[^}]+\}/);
    return match ? JSON.parse(match[0]) : { experto: 'app', buscar_web: false, query_web: null };
  } catch (err) {
    console.error('ERROR clasificar:', err.message);
    return { experto: 'app', buscar_web: false, query_web: null };
  }
}

// ── Anthropic API ─────────────────────────────────────────────────────────────
// ── Monitor de créditos Anthropic ────────────────────────────────────────────
let _anthropicSinCreditos = false; // flag en memoria (se resetea con cada deploy)

async function notificarSinCreditos(env) {
  try {
    // Push a Adrián
    const row = await env.DB.prepare(
      `SELECT contenido FROM alejandra_memoria WHERE tipo='fcm_token' AND usuario_id='adrian' LIMIT 1`
    ).first().catch(() => null);
    if (row) await enviarFCM(env, row.contenido, '⚠️ Alejandra sin créditos', 'Anthropic se quedó sin saldo. Usando GPT-4o de respaldo. Recarga en console.anthropic.com');
    // Telegram
    if (env.TELEGRAM_BOT_TOKEN) await enviarPorTelegram(env.TELEGRAM_BOT_TOKEN, '⚠️ <b>Alejandra sin créditos Anthropic</b>\nUsando GPT-4o de respaldo. Recarga en console.anthropic.com');
    // Log en BD
    await env.DB.prepare(
      `INSERT INTO alejandra_logs (tipo, contenido, created_at) VALUES ('alerta_creditos', 'Anthropic sin saldo — fallback GPT-4o activado', datetime('now'))`
    ).run().catch(() => {});
  } catch (_) {}
}

async function llamarGPT4oFallback(env, messages, systemPrompt, maxTokens) {
  // Convierte formato Anthropic → OpenAI chat completions
  const openAIMessages = [];
  if (systemPrompt) openAIMessages.push({ role: 'system', content: systemPrompt });
  for (const m of messages) {
    if (typeof m.content === 'string') {
      openAIMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    } else if (Array.isArray(m.content)) {
      const text = m.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (text) openAIMessages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: text });
    }
  }
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o', max_tokens: maxTokens || 1024, messages: openAIMessages })
  });
  if (!resp.ok) throw new Error(`GPT-4o fallback ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const texto = data.choices?.[0]?.message?.content || 'Sin respuesta del modelo de respaldo.';
  // Devolver en formato compatible con respuesta Anthropic
  return {
    content: [{ type: 'text', text: `[Modo respaldo GPT-4o — Anthropic sin créditos]\n\n${texto}` }],
    stop_reason: 'end_turn',
    usage: data.usage ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens } : {}
  };
}

async function llamarAnthropic(env, messages, tools, model, maxTokens, systemPrompt) {
  // System como array de bloques con cache_control en el último → prompt caching (5min TTL, 90% más barato en hits)
  const systemBlocks = systemPrompt
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : undefined;

  const body = { model, max_tokens: maxTokens, messages };
  if (systemBlocks) body.system = systemBlocks;

  if (tools && tools.length > 0) {
    const toolsArray = tools.map((t, i) => i === tools.length - 1
      ? { ...t, cache_control: { type: 'ephemeral' } }
      : t);
    body.tools = toolsArray;
  }

  const resp = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    // Detectar error de créditos → fallback a GPT-4o
    if (resp.status === 400 && errText.includes('credit balance is too low')) {
      if (!_anthropicSinCreditos) {
        _anthropicSinCreditos = true;
        await notificarSinCreditos(env).catch(() => {});
      }
      return await llamarGPT4oFallback(env, messages, systemPrompt, maxTokens);
    }
    // Otros errores de Anthropic → también intentar fallback en 529 (overloaded)
    if (resp.status === 529 || resp.status === 503) {
      return await llamarGPT4oFallback(env, messages, systemPrompt, maxTokens);
    }
    throw new Error(`Anthropic ${resp.status}: ${errText.substring(0,200)}`);
  }

  // Éxito → resetear flag si estaba activo
  if (_anthropicSinCreditos) {
    _anthropicSinCreditos = false;
    console.log('Anthropic créditos restaurados — volviendo al modo normal');
  }

  const data = await resp.json();
  if (data.usage) {
    const cc = data.usage.cache_creation_input_tokens || 0;
    const cr = data.usage.cache_read_input_tokens || 0;
    if (cc || cr) console.log(`CACHE [${model}] write=${cc} read=${cr} (read es 90% más barato)`);
  }
  return data;
}

// ── OpenAI búsqueda web ───────────────────────────────────────────────────────
async function buscarWebOpenAI(env, query) {
  try {
    const resp = await fetch(OPENAI_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', tools: [{ type: 'web_search_preview' }], input: query })
    });
    if (!resp.ok) return `Sin resultados para: "${query}"`;
    const data  = await resp.json();
    if (data.usage) registrarTokenUso(env, 'gpt-4o-mini', 'web_search', data.usage.input_tokens||0, data.usage.output_tokens||0, null);
    const texto = data.output?.filter(b=>b.type==='message')?.flatMap(m=>m.content)?.filter(c=>c.type==='output_text')?.map(c=>c.text)?.join('\n') || 'Sin resultados';
    return texto.substring(0, 2000);
  } catch (err) {
    return `Error búsqueda web: ${err.message}`;
  }
}

// ── Contexto y mensajes ───────────────────────────────────────────────────────
// Detecta si el mensaje del usuario tiene intención de acción (para enviar DOM)
const _RE_INTENCION_ACCION = /\b(haz|hazlo|hazme|crea|cr[eé]ame|abre|ábreme|registra|reg[íi]strame|borra|elimina|guarda|modifica|cambia|edita|ve\s+a|navega|navega\s+a|rellena|escribe|selecciona|click|clic|pulsa|ejecuta|enseña|enséñame|muestra|mu[eé]strame|añade|a[ñn]ade|quita|configura|act[íi]vame|act[íi]va|desact[íi]va|fija|pon|ponme|busca|consulta)\b/i;

async function construirMessages(env, mensaje, contexto, limitHistorial=10, incluirAprendizajes=true, resultadoWeb=null, usuario_id=null, canal=null, adjuntos=null, rol=null, pantalla=null, dom_actual=null, experto=null) {
  const messages = [];
  // Inyectar resumen de conversación previa antes del historial reciente
  if (contexto.resumen_anterior?.resumen) {
    const r = contexto.resumen_anterior;
    const cabecera = r.tema ? `[RESUMEN DE CONVERSACIÓN PREVIA — Tema: ${r.tema}]` : `[RESUMEN DE CONVERSACIÓN PREVIA]`;
    messages.push({ role: 'user', content: `${cabecera}\n${r.resumen}` });
    messages.push({ role: 'assistant', content: 'Entendido, tengo el contexto previo.' });
  }
  for (const item of contexto.historial.slice(-limitHistorial)) {
    // Soporta tanto {rol,contenido} (alejandra_historial) como {mensaje,respuesta} (legacy)
    if (item.rol && item.contenido) {
      messages.push({ role: item.rol, content: item.contenido });
    } else {
      if (item.mensaje)   messages.push({ role: 'user',      content: item.mensaje });
      if (item.respuesta) messages.push({ role: 'assistant', content: item.respuesta });
    }
  }
  const partes = [];

  // Contexto de quién habla y desde dónde
  const canales = {
    app_android: 'App Android', app_android_traductor: 'App Android (Traductor)',
    app_android_voz: 'App Android (Voz)',
    panel: 'Panel web', telegram: 'Telegram', web: 'Web', pwa: 'PWA'
  };
  const canalNombre = canales[canal] || canal || 'desconocido';
  const rolNombre   = rol || 'desconocido';
  const pantallaStr = pantalla ? `, pantalla="${pantalla}"` : '';
  partes.push(`[Sesión: usuario="${usuario_id || 'anónimo'}", canal="${canalNombre}", rol="${rolNombre}"${pantallaStr}]`);

  // DOM de la pantalla actual (solo panel web) — permite usar selectores reales en <plan>
  // Optimización tokens: solo lo enviamos cuando hay intención de acción Y el experto
  // no es 'simple'. En conversación normal saltan ~600 tokens por mensaje.
  const queremosDOM =
    Array.isArray(dom_actual) && dom_actual.length > 0 &&
    experto !== 'simple' &&
    _RE_INTENCION_ACCION.test(mensaje);

  if (queremosDOM) {
    // Compresión: limitamos a 40 elementos y soltamos el prefijo "NAV "
    const lineasComp = dom_actual.slice(0, 40).map(l => l.replace(/^NAV /, ''));
    partes.push(
      `[DOM actual — usa selectores reales en <plan>]\n` + lineasComp.join('\n')
    );
  }

  if (incluirAprendizajes && contexto.aprendizajes?.length > 0) {
    partes.push(`Contexto de memoria:\n${contexto.aprendizajes.map(a=>`[${a.tipo}] ${a.titulo}: ${a.contenido}`).join('\n')}`);
  }
  if (resultadoWeb) partes.push(`Info actual de internet:\n${resultadoWeb}`);
  partes.push(partes.length > 1 ? `Usuario: ${mensaje}` : mensaje);

  // Si hay adjuntos (R2 keys), construir content blocks con imágenes inline
  const hasAdjuntos = Array.isArray(adjuntos) && adjuntos.length > 0;
  if (hasAdjuntos && env.FILES) {
    const contentBlocks = await buildUserContentWithAdjuntos(env, partes.join('\n\n'), adjuntos);
    messages.push({ role: 'user', content: contentBlocks });
  } else {
    messages.push({ role: 'user', content: partes.join('\n\n') });
  }
  return messages;
}

async function obtenerContextoChat(env, usuario_id, empresa_id, limit=20) {
  try {
    await ensureConversacionResumenTable(env);
    const uid = usuario_id || 'unknown';
    // Historial POR USUARIO (cross-canal: misma conversacion desde app, panel o telegram)
    const historial = await env.DB.prepare(
      `SELECT rol, contenido, canal, created_at FROM alejandra_historial WHERE usuario_id=? ORDER BY created_at DESC LIMIT ?`
    ).bind(uid, 10).all();
    const aprendizajes = await env.DB.prepare(
      `SELECT titulo,contenido,tipo FROM alejandra_memoria WHERE (tipo='aprendizaje' OR tipo='contexto') ORDER BY importancia DESC,created_at DESC LIMIT 10`
    ).all();

    // Recuperar el resumen más reciente para este usuario (cualquier canal)
    let resumen_anterior = null;
    try {
      const row = await env.DB.prepare(
        `SELECT tema, resumen, mensajes_cubiertos, updated_at FROM conversacion_resumen WHERE usuario_id=? ORDER BY updated_at DESC LIMIT 1`
      ).bind(usuario_id || 'anon').first();
      if (row) resumen_anterior = row;
    } catch (_) {}

    return {
      historial: (historial.results||[]).reverse(),
      aprendizajes: aprendizajes.results||[],
      resumen_anterior,
      usuario_id,
      empresa_id
    };
  } catch {
    return { historial: [], aprendizajes: [], resumen_anterior: null, usuario_id, empresa_id };
  }
}

// ── Tabla conversacion_resumen (lazy create) ─────────────────────────────────
let _resumenTableEnsured = false;
async function ensureConversacionResumenTable(env) {
  if (_resumenTableEnsured) return;
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS conversacion_resumen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT NOT NULL,
      canal TEXT NOT NULL,
      tema TEXT,
      resumen TEXT NOT NULL,
      mensajes_cubiertos INTEGER NOT NULL,
      ultimo_mensaje_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`).run();
    await env.DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_conv_user ON conversacion_resumen(usuario_id, canal, updated_at)`
    ).run();
    _resumenTableEnsured = true;
  } catch (e) {
    console.error('ensureConversacionResumenTable:', e.message);
  }
}

// ── Actualizar resumen en background si la conversación es larga ─────────────
async function actualizarResumenSiNecesario(env, usuario_id, canal) {
  try {
    if (!usuario_id) return;
    await ensureConversacionResumenTable(env);

    // Contar mensajes totales del usuario (cross-canal)
    const cnt = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM alejandra_historial WHERE usuario_id=?`
    ).bind(usuario_id).first().catch(() => ({ n: 0 }));
    const total = cnt?.n || 0;
    if (total <= 25) return;

    // Saltar todos menos los últimos 10 → coger los antiguos
    const offset = 10;
    const antiguos = await env.DB.prepare(
      `SELECT id, rol, contenido, created_at FROM alejandra_historial WHERE usuario_id=? ORDER BY created_at DESC LIMIT 1000 OFFSET ?`
    ).bind(usuario_id, offset).all().catch(() => ({ results: [] }));
    const items = (antiguos.results || []).reverse();
    if (items.length === 0) return;

    const ultimoId = items[items.length - 1].id;

    // Comprobar si ya cubrimos esos mensajes en un resumen previo
    const prev = await env.DB.prepare(
      `SELECT id, ultimo_mensaje_id, mensajes_cubiertos FROM conversacion_resumen WHERE usuario_id=? AND canal=? ORDER BY updated_at DESC LIMIT 1`
    ).bind(usuario_id, canal || 'web').first().catch(() => null);
    if (prev && prev.ultimo_mensaje_id === ultimoId) return; // ya está al día

    // Construir transcript breve
    const transcript = items.map(m => `${m.rol === 'user' ? 'U' : 'A'}: ${(m.contenido || '').substring(0, 300)}`).join('\n').substring(0, 12000);

    const sistema = `Eres un asistente que resume conversaciones largas en español. Devuelve SOLO JSON válido con esta forma:
{"tema":"frase corta (máx 60 caracteres) que resuma el tema principal — ej 'Cálculo cuadro nave 3 — Empresa Norte'","resumen":"Tema principal: ... Puntos clave: ... Decisiones tomadas: ... Contexto a recordar: ..."}`;

    const respAPI = await llamarAnthropic(env, [{ role: 'user', content: `Resume esta conversación previa (${items.length} mensajes):\n\n${transcript}` }], [], MODEL_ROUTER, 600, sistema);
    if (respAPI.usage) registrarTokenUso(env, MODEL_ROUTER, 'resumen_conversacion', respAPI.usage.input_tokens || 0, respAPI.usage.output_tokens || 0, usuario_id);
    const texto = respAPI.content?.find(b => b.type === 'text')?.text?.trim() || '';
    const match = texto.match(/\{[\s\S]*\}/);
    let tema = null, resumen = texto.substring(0, 2000);
    if (match) {
      try {
        const p = JSON.parse(match[0]);
        if (p.tema) tema = String(p.tema).substring(0, 120);
        if (p.resumen) resumen = String(p.resumen).substring(0, 4000);
      } catch (_) {}
    }

    if (prev) {
      await env.DB.prepare(
        `UPDATE conversacion_resumen SET tema=?, resumen=?, mensajes_cubiertos=?, ultimo_mensaje_id=?, updated_at=datetime('now') WHERE id=?`
      ).bind(tema, resumen, items.length, ultimoId, prev.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO conversacion_resumen (usuario_id, canal, tema, resumen, mensajes_cubiertos, ultimo_mensaje_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(usuario_id, canal || 'web', tema, resumen, items.length, ultimoId).run();
    }
    console.log(`actualizarResumen: ${items.length} mensajes resumidos para ${usuario_id}/${canal}`);
  } catch (err) {
    console.error('actualizarResumenSiNecesario:', err.message);
  }
}

async function guardarMensajeChat(env, usuario_id, empresa_id, mensaje, respuesta, canal='panel') {
  try {
    const uid = usuario_id || 'unknown';
    // Guarda en alejandra_historial con usuario_id (conversacion por usuario, no por canal)
    await env.DB.prepare(
      `INSERT INTO alejandra_historial (canal, rol, contenido, usuario_id, created_at) VALUES (?, 'user', ?, ?, datetime('now'))`
    ).bind(canal, mensaje.slice(0, 4000), uid).run();
    await env.DB.prepare(
      `INSERT INTO alejandra_historial (canal, rol, contenido, usuario_id, created_at) VALUES (?, 'assistant', ?, ?, datetime('now'))`
    ).bind(canal, respuesta.slice(0, 4000), uid).run();
    // Limitar a 200 mensajes por usuario (cross-canal)
    await env.DB.prepare(
      `DELETE FROM alejandra_historial WHERE usuario_id=? AND id NOT IN (SELECT id FROM alejandra_historial WHERE usuario_id=? ORDER BY created_at DESC LIMIT 200)`
    ).bind(uid, uid).run();
  } catch (err) { console.error('guardarChat:', err.message); }
}

async function autoLearnUpload(env, key, mimeType, filename, usuario_id, arrayBuffer) {
  try {
    let resumen = null;

    if (mimeType.startsWith('image/') && env.GEMINI_API_KEY) {
      // Analizar imagen con Gemini
      const bytes = new Uint8Array(arrayBuffer);
      if (bytes.length <= 10 * 1024 * 1024) {
        const base64 = uint8ToBase64(bytes);
        const prompt = 'Describe brevemente esta imagen en español (máximo 200 palabras). Si es una foto de obra o instalación, indica qué elementos se ven (cables, bandejas, cuadros, equipos). Si es un documento, indica de qué trata.';
        resumen = await analizarFotoConGemini(env, base64, mimeType, prompt);
        if (resumen && resumen.length > 500) resumen = resumen.substring(0, 500);
      }
    } else if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'text/csv') {
      // Leer contenido de texto y resumir
      const decoder = new TextDecoder();
      const text = decoder.decode(arrayBuffer);
      resumen = text.length > 500
        ? `Archivo de texto (${text.length} caracteres). Inicio: ${text.substring(0, 400)}...`
        : `Archivo de texto: ${text}`;
    }

    if (resumen) {
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (tipo, canal, titulo, contenido, importancia, created_at)
         VALUES ('documento', ?, ?, ?, 2, datetime('now'))`
      ).bind(usuario_id || 'anon', `Archivo: ${filename}`, `[R2: ${key}] ${resumen}`).run();
      console.log(`autoLearnUpload: guardado resumen de ${filename}`);
    }
  } catch (err) {
    console.error('autoLearnUpload error:', err.message);
  }
}

async function autoLearnChat(env, usuario_id, empresa_id, respuesta) {
  try {
    if (respuesta.acciones?.length > 0) {
      const str = respuesta.acciones.map(a=>`${a.tipo}: ${a.descripcion}`).join('; ');
      await env.DB.prepare(
        `INSERT INTO alejandra_memoria (tipo,canal,titulo,contenido,importancia,created_at) VALUES('aprendizaje',?,'Chat acción',?,2,datetime('now'))`
      ).bind(usuario_id, str).run();
    }
  } catch (err) { console.error('autoLearn:', err.message); }
}

async function registrarTokenUso(env, modelo, tipo, entrada, salida, usuario_id) {
  try {
    const p       = PRECIOS_USD[modelo] || { in: 1.00, out: 5.00 };
    const coste   = (entrada * p.in + salida * p.out) / 1_000_000;
    const proveedor = modelo.startsWith('gpt') ? 'openai' : 'anthropic';
    await env.DB.prepare(
      `INSERT INTO alejandra_token_uso (proveedor,modelo,tipo,tokens_entrada,tokens_salida,coste_usd,usuario_id,created_at)
       VALUES(?,?,?,?,?,?,?,datetime('now'))`
    ).bind(proveedor, modelo, tipo, entrada, salida, coste, usuario_id||'system').run();
  } catch (err) { console.error('tokenUso:', err.message); }
}

async function registrarLog(env, usuario_id, accion, parametros, resultado) {
  try {
    await env.DB.prepare(
      `INSERT INTO alejandra_logs (usuario_id,accion,parametros,resultado,status,created_at) VALUES(?,?,?,?,'ok',datetime('now'))`
    ).bind(usuario_id||'system', accion, parametros||'', resultado||'').run();
  } catch (_) {}
}

async function getGoogleAccessToken(env) {
  const clientEmail  = env.FIREBASE_CLIENT_EMAIL;
  const privateKeyPem = env.FIREBASE_PRIVATE_KEY;
  if (!clientEmail || !privateKeyPem) throw new Error('FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY no configuradas');

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const sigInput = `${b64url(header)}.${b64url(payload)}`;

  // Importar clave privada PKCS8
  const pemBody = privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
  const derBin  = atob(pemBody);
  const derBuf  = new Uint8Array(derBin.length);
  for (let i = 0; i < derBin.length; i++) derBuf[i] = derBin.charCodeAt(i);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', derBuf.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(sigInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const jwt = `${sigInput}.${sigB64}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) throw new Error('No se obtuvo access_token: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}

async function enviarFCM(env, fcmToken, titulo, cuerpo) {
  try {
    const accessToken = await getGoogleAccessToken(env);
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/alejandra-ia-app/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title: titulo, body: cuerpo },
          android: { priority: 'HIGH', notification: { sound: 'default', click_action: 'FLUTTER_NOTIFICATION_CLICK' } },
          data: { tipo: 'alejandra_mensaje' },
        },
      }),
    });
    const data = await r.json();
    return { ok: r.ok, status: r.status, ...data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function verificarAdminToken(env, token) {
  if (!token) return false;
  if (env.ADMIN_TOKEN && token === env.ADMIN_TOKEN) return true;
  try {
    const r = await env.DB.prepare('SELECT id FROM alejandra_tokens WHERE token=? AND tipo="admin" AND activo=1').bind(token).first();
    return !!r;
  } catch { return false; }
}

async function enviarPorTelegram(botToken, mensaje) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: -1002199087689, text: `Alejandra: ${mensaje}`, parse_mode: 'HTML' })
    });
  } catch (err) { console.error('Telegram:', err.message); }
}
