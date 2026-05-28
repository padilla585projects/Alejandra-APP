// ══════════════════════════════════════════════════════════════════════════════
// ALEJANDRA AGENTE — Worker autónomo, NEXUS router, prompts dinámicos, auto-mejora
// URL: alejandra-agente.alejandra-app.workers.dev
// Versión: v5.99 (Conciencia de rol/pantalla + modo guía interactivo)
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
  base: `Eres Alejandra, agente IA autónoma e independiente para gestión industrial e ingeniería de obra. Creada por Adrián Padilla (superadmin/desarrollador). Respondes siempre en español, directa y profesional. Tienes memoria persistente, búsqueda web en tiempo real, visión de fotos/documentos y voz bidireccional.

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

REGLA DE APRENDIZAJE: cuando identifiques un patrón útil, guárdalo. Tu memoria es tu ventaja — lo que guardas hoy te hace mejor mañana.
REGLA DE MEJORA: si ves una limitación concreta, usa propose_mejora con descripción técnica exacta.
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
- "adrian" o rol "superadmin/desarrollador" → Adrián Padilla, tu creador. Sé técnica, directa, puedes usar jerga de desarrollo.
- rol "empresa_admin" → Responsable de empresa. Datos globales, costes, informes, toma de decisiones.
- rol "encargado" → Encargado de obra/depto. Quiere información operativa: qué pasa en su zona, materiales, personal, incidencias.
- rol "oficina" → Personal de oficina. Pedidos, documentación, facturación, coordinación.
- rol "operario" → Trabajador de campo. Responde SIMPLE y DIRECTO, sin tecnicismos, sin jerga. Máx 3-4 pasos. Si hay riesgo, avisa claro.
- Si el rol es desconocido o vacío, trata al usuario como operario (modo seguro: simple y directo).

DESDE DÓNDE TE HABLAN (canal):
- "App Android" → app móvil, respuestas cortas y claras.
- "Panel web" → panel admin, puedes dar más detalle.
- "Telegram" → muy breve, sin markdown complejo.
- "Web" → PWA, similar a panel.

EN QUÉ PANTALLA ESTÁ (pantalla):
- Si recibes info de pantalla (ej: "Inventario > Bobinas", "Equipos", "Fichar"), úsala para dar contexto inmediato.
- Ejemplo: si pantalla="Inventario > Bobinas" y el usuario pregunta "¿cuántas quedan?", ya sabes de qué habla — responde directamente sobre bobinas.
- Si pantalla="Chat" o vacía, no tienes contexto extra de pantalla.
- NUNCA repitas el bloque [Sesión:...] al usuario, es info interna para ti.

MODO GUÍA INTERACTIVO:
Si un usuario pide ayuda para hacer algo en la app y tú puedes guiarle paso a paso, puedes incluir al final de tu respuesta un bloque especial:
<guia>{"titulo":"Cómo fichar entrada","pasos":["Toca el botón 'Fichar' abajo","Selecciona 'Entrada'","Confirma tu ubicación si te lo pide"]}</guia>
La app detectará este bloque y mostrará una guía interactiva al usuario (previo consentimiento). Solo usa <guia> si el usuario pide ayuda explícita para hacer algo en la app y la tarea tiene pasos claros (máx 5 pasos).

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

  formato: `Responde en español. Directo, sin markdown excesivo. Listas con guiones. Máx 300 palabras salvo que pidan detalle. Con Adrián puedes ser más técnica.`,

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
- Normativa: UNE 20460, REBT, ITC-BT, IEC 60364, UNE-EN 61439
- Cálculos: sección de cable, caída de tensión, intensidades admisibles, cortocircuito
- Obra civil eléctrica: canalizaciones, zanjas, arquetas, puesta a tierra
- Equipos: PEMP, carretillas, herramienta específica

Herramientas disponibles:
- calcular_cable: sección por intensidad y caída de tensión
- calcular_bandeja: curvas, reducciones, llenado
- calcular_proteccion: magnetotérmicos, diferenciales, selectividad
- consultar_bd: acceso directo a datos de la app (bobinas, equipos, personal)
- ver_archivo / listar_archivos: ver documentos y fotos subidos
- analizar_foto_obra: análisis visual con IA de fotos de instalaciones
- buscar_web: consultar normativa, catálogos, fichas técnicas online

Cuando te pidan un cálculo, MUESTRA siempre: datos de entrada, fórmulas aplicadas, resultado, norma de referencia.
Cuando analices una foto, describe: elementos visibles, estado, posibles problemas, recomendaciones.`
};

// Perfiles de experto
const NEXUS_EXPERTS = {
  simple:   { model: MODEL_ROUTER,  maxTokens: 400,  modules: ['base', 'contexto_sesion', 'formato'] },
  app:      { model: MODEL_EXPERTO, maxTokens: 800,  modules: ['base', 'app', 'aprendizaje_proactivo', 'contexto_sesion', 'formato'] },
  tecnico:  { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] },
  web:      { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'web', 'aprendizaje_proactivo', 'contexto_sesion', 'formato'] },
  reflexion:{ model: MODEL_EXPERTO, maxTokens: 2048, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'reflexion', 'decision', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] },
  completo:   { model: MODEL_EXPERTO, maxTokens: 1024, modules: ['base', 'app', 'tecnica', 'nexus', 'evolucion', 'web', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] },
  ingenieria: { model: MODEL_EXPERTO, maxTokens: 2048, modules: ['base', 'app', 'ingenieria', 'aprendizaje_proactivo', 'razonamiento', 'contexto_sesion', 'formato'] }
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

// Tools por experto
const TOOLS_POR_EXPERTO = {
  simple:     [],
  app:        [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_CONSULTAR_BD],
  tecnico:    [TOOL_LEER_ESTADO, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_BUSCAR_WEB, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_CONSULTAR_BD, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION],
  web:        [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE],
  reflexion:  [TOOL_MEMORY_SAVE, TOOL_MEMORY_READ, TOOL_PROPOSE_MEJORA, TOOL_BUSCAR_WEB, TOOL_TOMAR_DECISION, TOOL_LEER_ESTADO, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION],
  completo:   [TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_LEER_ESTADO, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_CONSULTAR_BD, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION],
  ingenieria: [TOOL_CALCULAR_CABLE, TOOL_CALCULAR_BANDEJA, TOOL_CALCULAR_PROTECCION, TOOL_CONSULTAR_BD, TOOL_LISTAR_ARCHIVOS, TOOL_VER_ARCHIVO, TOOL_ANALIZAR_FOTO, TOOL_BUSCAR_WEB, TOOL_MEMORY_READ, TOOL_MEMORY_SAVE, TOOL_PENSAR, TOOL_PLANIFICAR, TOOL_DESCUBRIR_HERRAMIENTAS, TOOL_RECUPERAR_CONVERSACION]
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
        return json({ status: 'ok', version: 'v5.98', nexus: true, reflexion: true, decisiones: true, web_search: !!env.OPENAI_API_KEY, upload: true, vision: true, ingenieria: true, gemini_vision: !!env.GEMINI_API_KEY, prompt_caching: true, razonamiento: true, auto_resumen: true });
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
        const { mensaje, usuario_id, empresa_id, canal, token_telegram, adjuntos, rol, pantalla } = body;
        if (!mensaje || !usuario_id) return json({ error: 'mensaje y usuario_id requeridos' }, 400);

        const empresa   = empresa_id || 'default';
        const contexto  = await obtenerContextoChat(env, usuario_id, empresa, 10);
        const canalChat = canal || 'web';
        const respuesta = await procesarConNEXUS(env, mensaje, contexto, usuario_id, empresa, canalChat, adjuntos, rol, pantalla);

        await guardarMensajeChat(env, usuario_id, empresa, mensaje, respuesta.texto, canalChat);
        if (respuesta.acciones?.length > 0) ctx.waitUntil(autoLearnChat(env, usuario_id, empresa, respuesta));
        if (canal === 'telegram' && token_telegram) ctx.waitUntil(enviarPorTelegram(token_telegram, respuesta.texto));
        ctx.waitUntil(actualizarResumenSiNecesario(env, usuario_id, canalChat));

        return json(respuesta);
      }

      // ── Chat streaming SSE ────────────────────────────────────────────────
      if (path === '/api/chat/stream' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const { mensaje, usuario_id, empresa_id, canal, adjuntos, rol, pantalla } = body;
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
            const resp = await procesarConNEXUSStream(env, mensaje, contexto, usuario_id, empresa, send, canalReal, adjuntos, rol, pantalla);
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

          // Validar tamaño (20MB)
          const MAX_SIZE = 20 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            return json({ error: `Archivo demasiado grande (${(file.size/1024/1024).toFixed(1)}MB). Máx: 20MB` }, 413);
          }

          // Validar tipo MIME
          const ALLOWED_TYPES = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel', // xls
            'text/csv', 'text/plain',
            'application/json',
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
  }
  // scheduled: desactivado — cuenta free, límite 5 cron triggers
};

// ══════════════════════════════════════════════════════════════════════════════
// NEXUS — Router con prompts dinámicos y herramientas de auto-mejora
// ══════════════════════════════════════════════════════════════════════════════

async function procesarConNEXUS(env, mensaje, contexto, usuario_id, empresa_id, canal, adjuntos, rol=null, pantalla=null) {
  if (!env.ANTHROPIC_API_KEY) {
    return { texto: 'Error: ANTHROPIC_API_KEY no configurada.', acciones: [], requiere_confirmacion: false };
  }

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
    const limitHistorial      = clas.experto === 'simple' ? 4 : 10;
    const incluirAprendizajes = clas.experto !== 'simple';
    const messages = await construirMessages(env, mensaje, contexto, limitHistorial, incluirAprendizajes, resultadoWeb, usuario_id, canal, adjuntos, rol, pantalla);

    // PASO 5: Llamar al modelo en loop hasta respuesta final (máx 5 iteraciones)
    let respAPI  = await llamarAnthropic(env, messages, tools, expert.model, expert.maxTokens, systemPrompt);
    if (respAPI.usage) registrarTokenUso(env, expert.model, `chat_${clas.experto}`, respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
    let iter     = 0;
    const MAX_ITER = 5;
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
      // Permite seguir usando herramientas de aprendizaje en iteraciones siguientes
      const toolsSiguiente = iter < MAX_ITER - 1
        ? tools.filter(t => ['buscar_web', 'memory_save', 'memory_read'].includes(t.name))
        : [];
      respAPI = await llamarAnthropic(env, messages, toolsSiguiente, expert.model, expert.maxTokens, systemPrompt);
      if (respAPI.usage) registrarTokenUso(env, expert.model, `chat_${clas.experto}`, respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
      iter++;
    }

    const textoFinal = respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta';

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
async function procesarConNEXUSStream(env, mensaje, contexto, usuario_id, empresa_id, send, canal, adjuntos, rol=null, pantalla=null) {
  if (!env.ANTHROPIC_API_KEY) {
    await send({ type: 'error', mensaje: 'ANTHROPIC_API_KEY no configurada.' });
    return { texto: 'Error: sin clave API.', herramientas_usadas: [] };
  }
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
    const MAX_ITER = 5;
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
      // Permite seguir usando herramientas de aprendizaje en iteraciones siguientes
      const toolsSiguiente = iter < MAX_ITER - 1
        ? tools.filter(t => ['buscar_web', 'memory_save', 'memory_read'].includes(t.name))
        : [];
      respAPI = await llamarAnthropic(env, messages, toolsSiguiente, expert.model, expert.maxTokens, systemPrompt);
      if (respAPI.usage) registrarTokenUso(env, expert.model, 'chat_stream', respAPI.usage.input_tokens||0, respAPI.usage.output_tokens||0, usuario_id);
      iter++;
    }

    const textoFinal = respAPI.content?.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || 'Sin respuesta';
    await registrarLog(env, usuario_id, 'chat', `[${clas.experto}] ${mensaje.substring(0,80)}`, textoFinal.substring(0,200));
    await send({ type: 'text', texto: textoFinal });

    return { texto: textoFinal, herramientas_usadas: herramientasUsadas, modelo: expert.model, experto: clas.experto, busqueda_web: usoBusquedaWeb };

  } catch(err) {
    console.error('ERROR NEXUS STREAM:', err.message);
    await send({ type: 'error', mensaje: err.message });
    return { texto: `Error: ${err.message}`, herramientas_usadas: [] };
  }
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
      const ct = obj.httpMetadata?.contentType || '';
      if (ct.startsWith('image/')) {
        const buf = await obj.arrayBuffer();
        const bytes = new Uint8Array(buf);
        if (bytes.length <= 5 * 1024 * 1024) {
          const base64 = uint8ToBase64(bytes);
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: ct, data: base64 }
          });
        } else {
          contentBlocks.push({ type: 'text', text: `[Imagen demasiado grande para analizar: ${key}]` });
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
async function analizarFotoConGemini(env, imageBase64, mediaType, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;
  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mediaType, data: imageBase64 } },
        { text: prompt }
      ]
    }]
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${err.substring(0, 200)}`);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin análisis disponible.';
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
          `INSERT INTO alejandra_memoria (tipo,canal,titulo,contenido,importancia,created_at)
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
- "simple": saludos, confirmaciones, preguntas triviales
- "app": preguntas sobre módulos, funcionalidades, usuarios de la app
- "tecnico": arquitectura, código, deploy, cómo funciona la IA
- "web": necesita info actual (precios, normativas, noticias)
- "reflexion": reflexión sobre sí misma, mejoras, qué puede hacer mejor, autoconocimiento, tomar decisiones
- "ingenieria": cálculos eléctricos, cables, bandejas, protecciones, fotos de obra, normativa, consultas técnicas de instalación, sección de cable, caída de tensión, magnetotérmicos, diferenciales, cuadros eléctricos
- "completo": quién es, historia, capacidades generales

JSON: {"experto":"...","buscar_web":bool,"query_web":"búsqueda en inglés o null"}

Ejemplos:
"hola" → {"experto":"simple","buscar_web":false,"query_web":null}
"qué módulos tiene la app" → {"experto":"app","buscar_web":false,"query_web":null}
"precio cable RZ1-K hoy" → {"experto":"web","buscar_web":true,"query_web":"RZ1-K cable price 2025"}
"cómo funciona tu NEXUS" → {"experto":"tecnico","buscar_web":false,"query_web":null}
"piensa en cómo mejorar" → {"experto":"reflexion","buscar_web":false,"query_web":null}
"qué podrías mejorar de ti misma" → {"experto":"reflexion","buscar_web":false,"query_web":null}
"calcula sección de cable para 10kW" → {"experto":"ingenieria","buscar_web":false,"query_web":null}
"qué magnetotérmico pongo para 25A" → {"experto":"ingenieria","buscar_web":false,"query_web":null}
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
async function llamarAnthropic(env, messages, tools, model, maxTokens, systemPrompt) {
  // System como array de bloques con cache_control en el último → prompt caching (5min TTL, 90% más barato en hits)
  const systemBlocks = systemPrompt
    ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]
    : undefined;

  const body = { model, max_tokens: maxTokens, messages };
  if (systemBlocks) body.system = systemBlocks;

  if (tools && tools.length > 0) {
    // Cachear también el array de tools: cache_control en la última tool
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
    const err = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${err.substring(0,200)}`);
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
async function construirMessages(env, mensaje, contexto, limitHistorial=10, incluirAprendizajes=true, resultadoWeb=null, usuario_id=null, canal=null, adjuntos=null, rol=null, pantalla=null) {
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
    // Solo los últimos 10 mensajes en bruto; lo anterior va resumido
    const historial = await env.DB.prepare(
      `SELECT rol, contenido, canal, created_at FROM alejandra_historial ORDER BY created_at DESC LIMIT ?`
    ).bind(10).all();
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

    // Contar mensajes totales del usuario en este canal
    const cnt = await env.DB.prepare(
      `SELECT COUNT(*) as n FROM alejandra_historial WHERE canal=?`
    ).bind(canal || 'web').first().catch(() => ({ n: 0 }));
    const total = cnt?.n || 0;
    if (total <= 25) return;

    // Saltar todos menos los últimos 10 → coger los antiguos
    const offset = 10;
    const antiguos = await env.DB.prepare(
      `SELECT id, rol, contenido, created_at FROM alejandra_historial WHERE canal=? ORDER BY created_at DESC LIMIT 1000 OFFSET ?`
    ).bind(canal || 'web', offset).all().catch(() => ({ results: [] }));
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
    // Guarda en alejandra_historial (tabla unificada compartida con la app)
    await env.DB.prepare(
      `INSERT INTO alejandra_historial (canal, rol, contenido, created_at) VALUES (?, 'user', ?, datetime('now'))`
    ).bind(canal, mensaje.slice(0, 4000)).run();
    await env.DB.prepare(
      `INSERT INTO alejandra_historial (canal, rol, contenido, created_at) VALUES (?, 'assistant', ?, datetime('now'))`
    ).bind(canal, respuesta.slice(0, 4000)).run();
    // Limitar a 100 mensajes por canal
    await env.DB.prepare(
      `DELETE FROM alejandra_historial WHERE canal=? AND id NOT IN (SELECT id FROM alejandra_historial WHERE canal=? ORDER BY created_at DESC LIMIT 100)`
    ).bind(canal, canal).run();
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
