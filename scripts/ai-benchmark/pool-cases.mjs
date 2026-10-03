// ADR-0028 — casos sintéticos para comparar el pool de IA propio con los proveedores
// actuales en las cuatro tareas que el pool asume (a router, b experto simple,
// c buscar_web, d respaldo cuando cae Anthropic). Sin datos reales de ninguna empresa.

// a) Router de intención: mensaje → etiqueta esperada (criterio del prompt de producción).
export const casosRouter = [
  { id: 'r01', mensaje: 'Hola Alejandra, buenos días', esperado: 'simple' },
  { id: 'r02', mensaje: 'gracias, eso es todo por hoy', esperado: 'simple' },
  { id: 'r03', mensaje: 'Dani faltó hoy a la obra', esperado: 'app' },
  { id: 'r04', mensaje: 'ya llegó el pedido de bandeja perforada', esperado: 'app' },
  { id: 'r05', mensaje: 'regístralo como entrada de almacén', esperado: 'app' },
  { id: 'r06', mensaje: 'no me deja fichar, sale un error rojo', esperado: 'app' },
  { id: 'r07', mensaje: 'revisa mi correo y dime si ha escrito el proveedor', esperado: 'app' },
  { id: 'r08', mensaje: '¿qué precio tiene hoy el cobre en la bolsa de Londres?', esperado: 'web' },
  { id: 'r09', mensaje: 'busca en internet la última noticia sobre el apagón de abril', esperado: 'web' },
  { id: 'r10', mensaje: 'calcula la sección de cable para un motor de 15 kW a 400 V y 80 m', esperado: 'ingenieria' },
  { id: 'r11', mensaje: '¿qué dice la ITC-BT-19 sobre la caída de tensión en interiores?', esperado: 'ingenieria' },
  { id: 'r12', mensaje: 'diseña el esquema de un cuadro con variador y PLC para dos bombas', esperado: 'ingenieria' },
  { id: 'r13', mensaje: 'hazlo', esperado: 'app' },
  { id: 'r14', mensaje: 'han venido todos menos Luis', esperado: 'app' }
];

// b) Experto «simple»: charla breve en español, sin tools. `debe` = regex que la respuesta
// tiene que cumplir; nunca debe fugar tokens de tool-call ni pasar de 1200 caracteres.
export const sistemaSimple = 'Eres Alejandra, asistente de una empresa de instalaciones eléctricas. Responde en español, breve y cordial. No inventes datos de la empresa.';
export const casosSimple = [
  { id: 's01', mensaje: 'Hola, ¿qué tal estás?', debe: /\b(hola|bien|buen[oa]s?)\b/i },
  { id: 's02', mensaje: 'Gracias por la ayuda de antes', debe: /(de nada|a ti|un placer|gracias|encantad)/i },
  { id: 's03', mensaje: '¿Me dices en una frase qué es un diferencial?', debe: /diferencial/i },
  { id: 's04', mensaje: 'Buenas noches, me voy a casa', debe: /(noches|descans|hasta)/i }
];

// c) buscar_web: búsqueda real en internet. `espera` = regex sobre títulos/URL/texto.
export const casosBusqueda = [
  { id: 'w01', query: 'ITC-BT-19 caída de tensión instalaciones interiores REBT', espera: /ITC-BT-19|boe\.es|f2i2|ca[ií]da de tensi[oó]n/i },
  { id: 'w02', query: 'Reglamento electrotécnico para baja tensión Real Decreto 842/2002 BOE', espera: /842\/2002|boe\.es/i },
  { id: 'w03', query: 'cable RZ1-K 0,6/1 kV ficha técnica', espera: /RZ1-K/i }
];

// d) Respaldo cuando cae Anthropic: chat con tools. Se espera la tool correcta o un texto
// sin llamar a ninguna tool, según el caso.
export const sistemaRespaldo = 'Eres Alejandra, asistente de una empresa de instalaciones eléctricas. Usa las herramientas cuando el usuario pida datos de la empresa; para preguntas generales responde directamente en español.';
export const toolsRespaldo = [
  { type: 'function', function: { name: 'consultar_inventario', description: 'Consulta el stock del almacén de la empresa por material.', parameters: { type: 'object', properties: { material: { type: 'string' } }, required: ['material'] } } },
  { type: 'function', function: { name: 'consultar_personal', description: 'Consulta quién está fichado hoy en una obra.', parameters: { type: 'object', properties: { obra: { type: 'string' } } } } }
];
export const casosRespaldo = [
  { id: 'f01', mensaje: '¿Cuántas bobinas de cable RZ1-K 3x2,5 quedan en el almacén?', tool: 'consultar_inventario' },
  { id: 'f02', mensaje: '¿Quién ha fichado hoy en la obra de Getafe?', tool: 'consultar_personal' },
  { id: 'f03', mensaje: 'Explícame en dos frases para qué sirve un magnetotérmico.', texto: /magnetot[eé]rmic/i }
];
