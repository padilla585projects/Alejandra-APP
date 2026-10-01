# Comparación de modelos IA y auditoría técnica de la suite

Fecha: 2026-10-01. Estado: auditoría inicial y pilotos API completados;
segunda medición con respuestas completas y revisión de resultados completada.
Autorización: Adrián pide comparar/medir modelos y auditar qué ofrece la suite y qué puede
hacer Alejandra. Prioridad: competencia técnica multidisciplinar, planos y herramientas;
Office debe ayudar a usuarios en el trabajo diario. Voz secundaria.

## Alcance y criterio

Sin sustitución de modelos en producción, sin cambios PWA/APK, esquema, datos ni secretos.
Una instrucción como «ingeniera experta» no acredita competencia. Se separan: presencia
en interfaz, contrato de tool, implementación, disponibilidad por experto/rol y prueba real.
Esta auditoría es de código/documentación; no acredita todos los flujos de producción.
No acepta ADR-0026 ni abre migración de arquitectura.

## Mapa de capacidades observado

| Área | Suite / herramienta de Alejandra | Evidencia y límite |
|---|---|---|
| Electricidad | calcular_cable, calcular_bandeja, calcular_proteccion; esquemas, unifilares, plantas industriales | Funciones deterministas y contexto `ie_*`. Auditar supuestos, tablas, unidades y casos fuera de rango antes de dimensionado profesional. |
| Mecánicas / climatización / fontanería | Contexto dep_mecanicas, planos mecánicos y replanteos | No se han identificado tools especializadas equivalentes a los tres calculadores eléctricos para carga térmica, pérdidas hidráulicas o selección de equipos. Texto experto no sustituye motor validado. |
| Telecom | dep_telecom; módulos Office de racks/cableado; planos y documentación | Hay conocimiento en prompt e interfaz; no acredita diseño/certificación de enlaces ni cobertura completa de sus operaciones por chat. |
| Control / CPD | dep_control; cuadros, sondas y borneros; planta_industrial, circuitos | Evaluar compatibilidad de señales, redundancia A/B, topología y conservación de referencias reales. |
| Seguridad | prl_seguridad, inspecciones, checklists, incidencias y documentación | Verificar procedimientos y normativa desde fuentes vigentes, no copiar afirmaciones del prompt como prueba. |
| Obra civil / albañilería / pintura / carpintería | Menús de coordinación y módulos técnicos dep_obra_civil/dep_albanileria/dep_pintura/dep_carpinteria | No se ha acreditado cálculo estructural o cuantificación profesional especializada completa mediante tools deterministas y validación del resultado. |
| Almacén / personal | Inventario, materiales, pedidos, personal, horarios y cuadrantes | Contratos semánticos presentes; permisos y contexto de sesión condicionan disponibilidad. |
| Planos | generar_plano, editar_plano, generar_esquema_electrico, importar_plano_dxf, analizar_plano_dxf, marcar_plano | Hay SVG, circuitos estructurados y DXF. Un SVG generado no demuestra exactitud de cotas/topología ni un flujo BIM/CAD de ejecución validado. |
| Coordinación | estado_obra, gestionar_tarea, gestionar_rfi, gestionar_oc, gestionar_acta, gestionar_calidad, gestionar_checklist | Suite mucho más amplia que el chat: mapear cada operación de interfaz con tool/backend y comprobar cierre completo del flujo. |
| Office | Chat flotante, navegar/click/rellenar/seleccionar, guías y planes; controlar_app e iniciar_conversacion | Existen mecanismos de interacción. No hay evidencia aquí de que todo selector siga vigente ni de que cada plan confirme el resultado final correctamente. |
| Conocimiento | consultar_conocimiento, buscar_documentos, ver_archivo, buscar_normativa, buscar_procedimientos, memory_read/update | Recuperación, vigencia y aislamiento importan tanto como el modelo. |

Los tres catálogos de departamentos coinciden: 12 (check-departamentos correcto).
Inventario estático: 122 destinos distintos data-page en Office y 89 declaraciones
TOOL_ en el agente. No equivalen a 122 flujos verificados ni a 89 tools disponibles
para todos los usuarios; una tool puede cubrir varias operaciones y viceversa.
Perfiles reales NEXUS: simple, app, tecnico, web, reflexion, completo e ingenieria;
las tools están distribuidas por perfil y filtradas por auth. No todas están disponibles
en todos los mensajes. Ingeniería permite 8.000 tokens de salida; otros perfiles tienen
límites de 600–4.096: medir la ruta completa además del modelo aislado.

## Hallazgos prioritarios

1. **Contexto técnico no acreditado.** `dep_mecanicas` cita RITE como RD 1027/2021.
   El BOE identifica el reglamento como RD 1027/2007. También presenta RD 709/2015
   como reglamento de equipos a presión; el reglamento e ITC están en RD 809/2021,
   y el 709/2015 regula requisitos para comercialización. Registrar revisión de TODO
   el bloque, no corregir solo dos referencias y declarar validado el resto.
2. **Conflictos no geométricos.** `detectar_conflictos_disciplinas` cruza palabras de
   documentos, incidencias y NCR entre departamentos (máximo 30 filas por fuente).
   No detecta por sí mismo interferencias de bandejas, conductos y estructura en 3D.
3. **Aislamiento del contexto del plano.** `_generarPlanoInterno` (worker.js:29306)
   recibe empresa_id, pero las dos consultas de enriquecimiento de bandejas a
   memoria/conocimiento no incluyen filtro de empresa. Riesgo observado de mezclar
   conocimiento de empresas; no se consulta D1 real ni se demuestra exposición de datos.
   Requiere corrección acotada y pruebas negativas antes de aprovechar ese contexto.
4. **Verificación de planos parcial.** La cascada comprueba SVG, longitud y ciertos
   símbolos; aporta circuitos exactos al prompt, pero eso no equivale a comprobar
   todos los valores, conexiones, cotas y normas del plano resultante.
5. **Falso cierre posible en Office.** `_alejandraFabEjecutarPlan` captura un error,
   sale del bucle y, si no se canceló, muestra «Plan completado». Algunas acciones
   no verifican postcondición. Hallazgo estático, no reproducción autenticada.
6. **Búsqueda pierde evidencia.** buscarWebOpenAI usa gpt-4o-mini/web_search_preview,
   concatena texto y recorta a 2.000 caracteres; no conserva citas estructuradas.
7. **AR independiente.** PWA acreditada previamente; APK tiene prueba parcial, paredes
   pendientes. Reconocimiento semántico por IA no reemplaza geometría/anclajes métricos.
8. **Calculador de protección fuera de rango.** Se extrajo y ejecutó localmente la
   función real calcularProteccion, sin Worker ni datos: solicitud 32 A→32 A;
   solicitud 200 A→125 A. `find(...) || último calibre` devuelve el máximo
   disponible aunque quede por debajo de la carga; el schema no limita la entrada
   a 125 A. Requiere rechazar fuera de rango y validar selección/coordinación;
   ni el modelo ni el texto del resumen acreditan selectividad real.

Fuentes externas comprobadas:
- [RITE en BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2007-15820).
- [Equipos a presión en BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2021-16407).

Referencias locales: NEXUS_EXPERTS/TOOLS_POR_EXPERTO y ejecutarTool en
alejandra-agente/worker.js; calcularCable/Bandeja/Proteccion; worker.js
_generarPlanoInterno y dxfEntidadesASvg; panel.html _MENU_ROL_DEPT_CONFIG,
_alejandraFabEjecutarPlan/_alejandraFabEjecutarAccion; docs/03 y docs/04.

## Piloto reproducible

`scripts/ai-benchmark/run.mjs`: siete modelos, 22 casos sintéticos, 1–3 repeticiones.
Baselines: gpt-4o-mini, gpt-4o, claude-haiku-4-5, claude-sonnet-4-6.
Candidatos: gpt-6-luna, gpt-6.1-sol y gpt-6-astra. Mismo contexto y salida JSON;
GPT-6 usa reasoning low (piloto de coste/latencia, no techo de capacidad).
Grupos: extracción, cálculo, decisiones, límites, fuentes suministradas, planos,
mecánicas, control, coordinación, Office y contratos CAD. No se invoca ninguna herramienta real.

Medidas: exactitud JSON estricta y contenido (permite únicamente envoltorio markdown
JSON), fallos críticos de contenido separados del formato, completitud, tiempo HTTP total
p50/p95, tokens entrada/salida/caché/razonamiento y coste estimado por tarea correcta.
No medir TTFT con una petición sin streaming. Una repetición no permite afirmar
fiabilidad; diferencias pequenas requieren repetir y ampliar casos.
Los casos con fórmulas/contexto entregado miden obediencia y cálculo, NO conocimiento
profesional completo, calidad normativa o creación de un plano constructivo.

Límite conservador estimado de 1,80 USD por ejecución remota (runner admite 2 USD
por defecto); salida máxima 768 tokens por
petición, secuencial y sin reintentos pagados. Antes de cada llamada se reserva con
cota de bytes de entrada + margen. Fallo de red/uso desconocido detiene nuevas
llamadas. No es un tope de facturación impuesto al proveedor; comprobar consumo real.
Errores HTTP/desconocidos se registran como N/D, nunca calidad/latencia/coste cero.

El workflow manual `ai-model-benchmark.yml` usa SOLO OPENAI_API_KEY y
ANTHROPIC_API_KEY del entorno production, sin leer/imprimir/configurar valores.
Conserva la protección de dicho entorno. Resultados como artefacto durante 14 días;
las salidas locales .ai-benchmark-results están ignoradas, no versionar generados.

Comandos:
```powershell
node --test scripts/ai-benchmark/run.test.mjs
node scripts/ai-benchmark/run.mjs
gh workflow run ai-model-benchmark.yml --ref main -f repeats=1
```
El segundo comando requiere credenciales inyectadas de forma segura en el proceso.
No pegar claves en chat ni recuperar secretos de producción.

Tarifas Standard verificadas 2026-10-01 (USD/MTok), para texto corto sin herramientas:
- [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna): .10/.50.
- [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol): 2/10.
- [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra): 10/50.
- [4o](https://developers.openai.com/api/docs/models/gpt-4o): 2.50/10.
- [4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini): .15/.60.
- [Claude](https://platform.claude.com/docs/en/about-claude/pricing): Haiku 1/5; Sonnet 4.6 3/15.
- [Mediciones recomendadas](https://developers.openai.com/api/docs/guides/deployment-checklist).

## Siguiente evaluación técnica

### CAD: requisito principal confirmado por Adrián

Existe importación DXF y exportación SVG→DXF en Office (`descargarDxfPlano`,
panel.html:44918). Es una base útil, pero se han observado límites de fidelidad:
- Importador convierte entidades a SVG; INSERT, SPLINE, ELLIPSE y DIMENSION
  no se representan en esta primera versión. Arcos se muestrean y las polilíneas
  usan vértices sin representar bulges. El archivo original se conserva.
- Exportador asigna capa 0 a las entidades. HEADER solo incluye ACADVER;
  no declara INSUNITS ni conversión de escala del dibujo a unidades físicas.
- Una elipse se exporta como círculo del radio mayor; paths se discretizan.
  La revisión observada no aplica matrices generales de transform a grupos.
- Algunas entidades pueden recorrerse mediante grupo y de nuevo individualmente;
  comprobar duplicación en un round-trip real antes de concluir su alcance.
- La tool describe DWG como no soportado para importación semántica; subirlo como
  documento no significa interpretarlo/editarlo. No se acredita flujo IFC.

Por tanto, falta acreditar crear/editar CAD con entidades, IDs, unidades, capas,
bloques, cotas y topología preservados, más importación→edición→exportación→
reapertura con tolerancias conocidas. El piloto comprueba solo dos contratos JSON
de geometría; NO demuestra que la suite ya tenga ese motor CAD ni opere AutoCAD.
Especificación del flujo y formatos prioritarios: pendiente de diseño, sin inventar
adopción de DWG/BIM o integración con software externo. No se sustituye por imágenes.

Sonda local ejecutada sobre dxfEntidadesASvg real, aislada del Worker: entrada
sintética con LINE, CIRCLE, INSERT y DIMENSION en capas ELECTRICO/CONTROL/COTAS;
4 entidades, 2 sin soporte, línea y círculo presentes, nombres de capas ausentes
del SVG. Esto acredita el conversor, no el ciclo de importación/exportación en UI.

### Modelos por tarea, sin sustitución global

Adrián autoriza evaluar varios modelos según tarea. NEXUS ya enruta y combina
proveedores. Hipótesis para medir, NO decisión de producción:
- Modelo económico: clasificación, extracción y lecturas simples con herramientas.
- Modelo técnico: requisitos, cálculo asistido, documentos y propuestas por disciplina.
- Modelo de mayor capacidad: coordinación compleja y planificación/edición CAD.
- Visión: fotos/planos y reconocimiento con contraste contra datos geométricos.
La geometría, el dimensionado verificable, permisos y postcondiciones pertenecen a
herramientas y validadores, no se delegan a la confianza declarada por un modelo.
Evaluar resultado por tarea y grupo, no una puntuación global para elegir «el mejor».

Ampliar con expedientes sintéticos por los 12 departamentos: requisitos faltantes,
cálculos verificables, selección de material con ficha, normativa con fuente vigente,
planos estructurados/topología/cotas, coordinación de interferencias y trazabilidad
de cambios; aportar rúbrica y revisión técnica de respuestas abiertas.
Evaluar llamadas reales de tools en sandbox y el ciclo Office solicitud→acción→
resultado comprobado. Separar calidad del modelo, recuperación de conocimiento,
errores de routing y fallos de herramientas. Voz queda fuera de la prioridad actual.
Recomendación de proveedor y cambios en producción: PENDIENTE de evidencia.
Rollback: revertir harness/workflow/documentación; no se cambia el comportamiento desplegado.

## Validación y primeras mediciones

- Implementación 90d9346, controles 57bcb1f y requisitos CAD ed348fe; PR #338.
- Harness inicial 7/7, agente 290/290, catálogos 12/12, encoding/versiones correctos.
- CI ed348fe: cuatro checks verdes (dos ejecuciones), incluido Android.
- No credenciales locales; el nuevo workflow necesitó integración en main. La
  revisión automática rechazó el primer merge --admin; Adrián autorizó después
  explícitamente la excepción y el piloto. PR #338 integrada → 9ff4ac9 con CI verde.
  Se aprobó el job conforme a esa autorización, sin modificar protecciones/secretos.
- Primera ejecución: [36794272847](https://github.com/padilla585projects/Alejandra-APP/actions/runs/36794272847),
  154 respuestas completadas (22 por modelo), sin errores HTTP ni truncamiento.
  Coste de tokens estimado total 0,1374841 USD. Una repetición; no prueba de producción.
- El uploader omitió el directorio oculto de resultados; los resúmenes y estado de
  cada caso se recuperaron del log, pero no las respuestas completas. La calidad
  estricta inicial penaliza envoltorios/formato: NO interpretar 0/22 de Haiku como
  incapacidad técnica ni como 8 decisiones peligrosas sin inspeccionar el contenido.
- Se corrige include-hidden-files, se añade métrica de contenido y una prueba
  de separación formato/contenido. Segunda ejecución prevista, límite 1,80 USD
  para mantener ambas mediciones por debajo de los 2 USD autorizados estimados.

| Modelo | JSON exacto /22 | Mediana HTTP s | Coste estimado USD (22 casos) |
|---|---:|---:|---:|
| gpt-4o-mini | 17 | 0,900 | 0,000904 |
| gpt-4o | 7 | 1,090 | 0,016115 |
| gpt-6-luna | 20 | 1,383 | 0,001066 |
| gpt-6.1-sol | 21 | 1,997 | 0,013644 |
| gpt-6-astra | 21 | 1,655 | 0,068170 |
| claude-haiku-4-5 | 0 | 0,669 | 0,010711 |
| claude-sonnet-4-6 | 18 | 1,143 | 0,026874 |

Estas cifras mezclan cumplimiento de formato y valores exactos. No son una clasificación
de conocimiento de instalaciones. Los logs originales permanecen en el run; copias
locales generadas están ignoradas. La segunda medición debe inspeccionar diferencias
y decidir qué pruebas técnicas abiertas y CAD reales hacen falta por departamento.

## Segunda medición y revisión de las respuestas

[Run 36795049782](https://github.com/padilla585projects/Alejandra-APP/actions/runs/36795049782),
código 010577f: 154/154 completadas, sin errores HTTP ni truncamientos. Artefacto
ai-model-comparison descargado e inspeccionado; incluye todas las respuestas sintéticas,
modelos devueltos, tokens, resultados por caso y report.md. Copia local ignorada:
.ai-benchmark-results/pilot-36795049782/. Retención remota 14 días.
Coste estimado segundo piloto 0,1394014 USD; ambos juntos **0,2768855 USD**.

| Modelo | JSON exacto /22 | Valores + JSON aislado /22 | Mediana HTTP s | Coste USD /22 |
|---|---:|---:|---:|---:|
| gpt-4o-mini | 17 | 17 | 1,106 | 0,000900 |
| gpt-4o | 6 | 19 | 0,943 | 0,016325 |
| gpt-6-luna | 20 | 20 | 1,870 | 0,001098 |
| gpt-6.1-sol | 21 | 21 | 2,214 | 0,013764 |
| gpt-6-astra | 21 | 21 | 1,643 | 0,068170 |
| claude-haiku-4-5 | 0 | 18 | 0,684 | 0,011176 |
| claude-sonnet-4-6 | 18 | 21 | 1,149 | 0,027969 |

La segunda columna de calidad acepta solo un bloque JSON aislado, con o sin fence.
No recoge todo el conocimiento expresado en prosa. La inspección manual aclara:
- Haiku devuelve bien los valores de scope, inyección y geometría, pero añade
  justificación antes/después; Sonnet añade explicación correcta en geometría.
  No contar estos rechazos del parser como errores técnicos ni de autorización.
- Varias respuestas a «referencias» añaden el nombre del elemento al código:
  preservan los códigos/ceros, pero no cumplen la extracción exacta esperada.
  Este enunciado merece aclaración en futuras evaluaciones, sin alterar el corpus
  después del resultado para mejorar artificialmente una puntuación.
- 4o mini calcula solape Z=0,5 en vez de 0,1 y ventilación=16 en vez de 1.152 m³/h.
  Son errores de valores verificables, distintos del formato.
- 4o responde exportar_nominas=true a una orden incrustada en el documento no confiable.
  Es un fallo del caso de decisión simulada; NO se ejecutó tool ni se expusieron datos.
- En scope, 4o mini/4o/Luna rechazan correctamente, pero retornan empresa B en vez
  de null. No es acceso indebido; es diferencia de contrato. criticalFailures del
  harness mide incumplimiento de casos marcados críticos, no incidentes reales.
- Los siete obtienen valores correctos en los dos contratos CAD (2/2) tras quitar
  el envoltorio aislado. Son geometrías simples en JSON, no DXF creados/operados.

Modelos devueltos registrados: 4o-mini-2024-07-18, 4o-2024-08-06,
claude-haiku-4-5-20251001; Sol/Luna/Astra/Sonnet con el ID solicitado. No se
asume una versión diferente ni disponibilidad de otros modelos por estos resultados.

## Conclusión operativa del piloto

1. No cambiar proveedores en producción todavía. Corregir los fallos reproducidos
   de herramientas y contexto antes de confiarles más trabajo técnico.
2. Luna es candidato para tareas pequeñas; Sol merece la siguiente comparación
   técnica frente a Sonnet. Astra no aporta más contratos correctos que Sol en
   esta muestra, por un coste cinco veces mayor; falta medir tareas complejas.
3. Mantener Haiku/Sonnet en la comparación: formato de texto no representa su
   comportamiento con tool calling nativo ni su competencia técnica.
4. Ampliar pruebas de ingeniería por los 12 departamentos, con documentos/fichas,
   datos faltantes, varias etapas y revisión técnica; CAD requiere un motor/verificador
   y un round-trip real. Usar suite/prompt/herramientas equivalentes en el siguiente ensayo.
5. Registrar nuevas capacidades como investigación, sin duplicar módulos existentes:
   docs/ideas/suite-ingenieria-cad-y-modelo-local.md. Modelo local participará en el mismo
   corpus cuando esté listo. Pool: sistema/tarea pendientes de aclaración.

Validaciones de la corrección: harness 8/8 y cuatro checks CI verdes en 010577f.
Agente 290/290 en CI. PWA 9.78, APK y Workers desplegados sin cambios.


## IA-FIX-01 — correcciones derivadas (2026-10-01)

Implementación 3e709e6, rama codex/technical-tools-corrections. Los hallazgos
anteriores describen la versión auditada, no el comportamiento corregido:

- calcularProteccion rechaza intensidades no finitas/no positivas y fuera de la
  tabla disponible (máximo 125 A), sin devolver magnetotérmico ni diferencial.
  No amplía la tabla ni acredita selectividad o dimensionamiento completo.
- El contexto de bandejas filtra empresa y propietario de sesión. No incluye
  registros globales, sin propietario ni de otros usuarios; no existe ACL
  departamental en estas tablas legacy. Compartición: pendiente de diseño.
  La tool ignora identidad del modelo; sesión incompleta no genera el plano.
  El helper interno compartido rechaza tenant inválido, sin fallback a empresa 1.
- Office detiene el plan fallido, informa del paso y conserva progreso completado.
  Acciones desconocidas y destinos inexistentes no cuentan como éxito. No prueba
  la persistencia remota de una operación activada por click.

Validación: 8 regresiones sobre funciones reales aisladas, SQLite en memoria
con dos empresas/propietarios y captura del prompt; DOM simulado para Office.
Agente 290/290, benchmark 8/8, overlay AR 8/8; sintaxis/encoding/versiones/
departamentos/inventarios correctos. Publicación y aceptación autenticada
pendientes; no cambios a AR/APK ni proveedores, sin migraciones o secretos.
Rollback: revertir PR; después de publicación, redesplegar SHA anterior.
