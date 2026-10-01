# Calidad técnica — IA-QUALITY-01

Fecha: 2026-10-01. Corrección de flujos existentes, sin cambio de proveedores,
arquitectura CAD, datos ni AR. Base ef173a2, rama codex/professional-quality-controls.

## Datos antes de actuar

Antes de generar un plano, recuperar datos ya confirmados o disponibles por herramientas
autorizadas. Preguntar por los faltantes que condicionan el resultado, agrupando preguntas
concretas y explicando su finalidad. En bandejas: unidades, dimensiones, recorrido X/Y,
altura Z y referencia de nivel. No confundir Y con Z. En dimensionado eléctrico:
cargas, alimentación, longitudes y condiciones de instalación, entre otros requisitos
del cálculo concreto. No repetir preguntas ya respondidas.

Solo un boceto preliminar solicitado puede omitir estos datos e identificar pendientes.
Los ejemplos del prompt y el catálogo no son datos del proyecto ni una elección aprobada.
Generación y edición usan la misma política de fidelidad: conservar valores confirmados,
no inventar cumplimiento o firma, no añadir elementos ausentes, cotas coherentes con una
proporción común, textos separados y cajetín de borrador pendiente de revisión.

Esta política guía al modelo; **no es un verificador geométrico ni una barrera determinista
de datos completos**. El formulario directo sigue admitiendo descripciones libres.
No acreditar uso de ejecución, escala de impresión o CAD por el mero éxito de la tool.

## Controles deterministas

- Generar y editar rechazan una respuesta sin cierre SVG. No fabrican el cierre ni
  persisten esa respuesta. El extractor controla el contenedor, no valida todo XML,
  medidas, topología, solapamientos o contenido activo; esos controles siguen pendientes.
- Office preserva cero al rellenar/seleccionar; rechaza campos no editables, tipos
  incompatibles, opciones ausentes/deshabilitadas y clicks deshabilitados. El ejecutor
  ya detiene el plan ante error. No acredita persistencia backend por efectuar un click.
- Chat IA compacto z810 queda sobre FAB z499 y chat equipo z800, bajo los modales.
  Conserva diseño, arrastre y redimensión existentes; sin rediseño de producto.
- CI sincroniza cuatro marcadores: version.json, sw.js, index.html y panel.html.

## Correcciones de mecánicas y fuentes

El RITE se aprobó por RD 1027/2007; oficinas son IDA 2. Para el método por persona,
la tabla 1.4.2.1 establece 12,5 l/s por persona bajo sus condiciones. Se corrige la
confusión con IDA 1 y se remite a las condiciones aplicables antes de fijar valores.
[RITE consolidado — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2007-15820).

RD 809/2021 regula equipos a presión e ITC; RD 709/2015 regula comercialización.
Se retiran periodicidades/presiones universales del párrafo de equipos y se pide
determinar el caso por categoría, fluido, equipo e ITC.
[Reglamento — BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2021-16407),
[Comercialización — BOE](https://www.boe.es/eli/es/rd/2015/07/24/709).

Se retira una estimación térmica que multiplicaba un índice volumétrico por ΔT;
se distinguen transmisión y ventilación con unidades coherentes y cargas latentes.
No se incorpora una herramienta nueva de dimensionado ni se acredita el resto del
módulo mecánico: otros párrafos normativos y fórmulas siguen sujetos a auditoría.

## Validación y entrega

13 regresiones ejecutan funciones de producción aisladas, incluida ausencia de
persistencia ante SVG incompleto; 290 pruebas del agente y 16 de benchmark/AR.
Sintaxis Workers, encoding, versiones, departamentos e inventarios correctos.
Las pruebas de prompts verifican contrato de instrucciones, no comportamiento de
todos los modelos. La comprobación publicada debe registrarse aparte.

Rollback: revertir PR antes de publicar; después, workflows con SHA fijo de la entrega
sana anterior: Workers 33be87e, Pages 00517cf (9.79). Sin migraciones ni secretos.

Pendientes para nivel de ejecución: motor/verificador CAD con unidades, capas,
cotas y round-trip; evaluación de preguntas faltantes y fidelidad por modelo;
auditoría normativa y cálculos por disciplina; postcondiciones Office de negocio;
muestras previas a rediseño gráfico. Propuestas CAD en suite-ingenieria-cad-y-modelo-local.md
mantienen su estado Idea/Investigación; esta corrección no las acepta como arquitectura.

## Publicación 9.80 y seguimiento

- Implementación 158e886, PR #344 integrada → 2716bff, cuatro checks verdes.
- Runs 36802744569/36802746909/36802750034 fallaron en checkout por hash corto;
  ningún despliegue. Reintentos con SHA completo 158e886a4616501128aca727c05b6fc533418908:
  API 36802914715, agente 36802917233, Pages 36802919764: correctos.
- Health manual HTTP 200: API c211748d-362e-4363-a5a1-d76592578b79;
  agente 153de6f2-e292-40b7-9cb1-36f20c7b920f; D1/R2 disponibles.
- Assets panel/index/sw/repl3d/version coinciden por SHA256 normalizado con fuentes.
  Primera lectura index respondió 503 transitorio; segunda HTTP 200 y coincidencia.
- Chrome demo 5 muestra 9.80. Con ambos chats abiertos, IA z810 frente a equipo z800;
  elementFromPoint en centro del envío confirma botón alejandrEnviar. Envío compacto
  de prompt QA vacía input sin ampliar. Resultado de preguntas todavía por registrar.
- Hallazgo adicional: posición guardada FAB IA y663,8/h56 en viewport h687 deja
  parte del botón fuera. Seguimiento acotado: ajustar posición visible al restaurar,
  redimensionar y arrastrar, sin sobrescribir preferencia guardada automáticamente.
  15 regresiones pasan, incluidos restauración oculta y viewport estrecho.

## QA de preguntas: fallo observado, no resuelto por prompt

En 9.80, QA IA-QUALITY-01-B en demo 5 generó ID 27 sin preguntar altura/datum,
y su respuesta añadió radio mínimo 300 mm y separación atribuida a IEC 61537
sin datos aportados. El primer envío quedó sin respuesta visible al cerrarse la
pestaña; no se da por validado. Se retienen los planos QA, sin borrar datos.

IA-QUALITY-02 añade un mínimo determinista a generar_plano de bandejas: altura
con unidad y datum en texto humano original del turno/historial autorizado.
Respuestas de assistant, resúmenes y valores del tool_input no sirven para suplirlos.
Si faltan, devolver DATOS_TECNICOS_FALTANTES con preguntas antes de API_WEB.
Solo un boceto solicitado por el humano permite pendientes. El contexto original
se hereda por rutas normal/stream/reintento/ayudante, sin bloques sintéticos del modelo.
Los valores confirmados se adjuntan al generador como fuente prioritaria.

Limitaciones: formatos no reconocidos requieren aclaración; descarta datos anteriores
ante nuevo trabajo explícito, pero no identifica cambios implícitos de proyecto.
Solo controla altura/datum en bandejas,
no selección/cálculo de soportes ni todos los datos necesarios de cada oficio.
Formulario directo y otros tipos de plano siguen sin esa barrera. La política común
ahora incluye arquitectura/delineación/oficios y exige buscar fuentes verificables
cuando haya dudas; no acredita competencia multidisciplinar por modificar un prompt.

## Cierre 2026-10-01

Pages 9.81 desde 95322273271d30557b677f2aef2d8590b4dccf35, run 36803600664:
correcto. PR #345 integrada → 4eeaebc, cuatro checks verdes. Assets version/panel/
index/sw/repl3d HTTP 200, hashes normalizados coincidentes con fuente revisada.
Chrome: viewport 1536×687, FAB original y663,8 ajustado a y627/h56, dentro de ventana.
Sesión empresa 1/Seguridad restaurada y comprobada; emulación retirada, tab cerrada.
Captura local ignorada .ai-benchmark-results/release-9.81/viewport-restored.png.

Adrián solicita terminar por hoy. IA-QUALITY-02 implementación 400f118 guardada,
295/295 agente y 15/15 técnicas; todavía sin merge/despliegue/verificación real.
La producción conserva la política de 9.80 y su fallo QA observado. Continuar por
HANDOFF mañana; no presentar esa política como garantía de preguntas resuelta.

## Reanudación y QA publicada — IA-QUALITY-02 (2026-10-01)

PR #346 integrada → f9addec01be180a9018e1ba9113a8ddf0703111d. Agente publicado
desde 6da23e76f477e19ac92ead2c8ac8ed792030c0d3, run 36839880273 SUCCESS.
Versión 39559254-382d-4f9d-bf4d-111e4a763915, health sin caché healthy con D1/R2.
Primera lectura sin query devolvió versión anterior; query QA confirmó versión nueva.
297/297 agente, 15/15 técnicas, cuatro checks CI verdes. API y Pages 9.81 conservados.

QA autenticada en empresa demo 5, sin acceso a obras reales:

| Caso | Resultado comprobado |
|---|---|
| A: bandeja 300×60 mm, planta 10×6 m, ruta (2,2)→(8,2)→(8,4), ejecución sin altura/datum | Tool devuelve DATOS_TECNICOS_FALTANTES; chat pregunta valor/unidad y referencia. IDs antes/después [27,26,25,21], no guarda. |
| B: mismo caso, humano confirma 2,8 m sobre suelo terminado | Un plano ID 28; altura confirmada en SVG, radios/soportes pendientes. |
| C: nuevo caso, boceto preliminar explícito sin altura/datum | ID 29; h=PENDIENTE, referencia no especificada, soportes/radios pendientes, BOCETO NO EJECUTAR; no hereda 2,8 m. |

ID 28 HTTP 200 pero XML inválido: línea 206, `x <= viewBoxWidth` dentro de
`<script>` generado para cuadrícula. Chat afirma NO EJECUTAR, texto ausente en SVG.
ID 29 HTTP 200, XML parseable sin errores ni scripts. Ninguno acredita exactitud
geométrica/CAD ni verificación normativa. Ambos se retienen, sin borrar datos.
Captura local ignorada `.ai-benchmark-results/ia-quality-02/boceto.png`.
Continuación acotada IA-QUALITY-03: SVG estático y rechazo de scripts antes de guardar.

IA-QUALITY-03 usa el extractor compartido de generación/edición para rechazar
script (incluido namespace), foreignObject y eventos antes de persistir, sin
eliminarlos ni fabricar un resultado parcial. El prompt exige geometría estática.
18 regresiones técnicas cubren salida dinámica, símbolos pasivos, no INSERT y
edición con lectura limitada a empresa 5/ID 28 sin UPDATE ante rechazo.
Esto no es un sanitizador XML completo: enlaces, XML mal formado sin código,
avisos obligatorios y geometría requieren controles posteriores.
Sesión de QA restaurada y comprobada por recarga: empresa 1/Seguridad.

## Publicación IA-QUALITY-03 — 2026-10-01

PR #347 integrada → 996785d0fa027e468a033dd0a07a342607ee4aa4, cuatro checks verdes,
runs CI 36841013188/36841021135. API publicada desde
2f1270f8683230ef24b9ff84ba1bedaa2858ecaf, run 36841261694 SUCCESS;
versión d1acd691-f13c-4f3f-b1a1-82adbdf36d9a, health sin caché healthy D1/R2.
Agente sigue en 39559254-382d-4f9d-bf4d-111e4a763915 healthy; Pages 9.81 conservada.
No se despliega una APK ni se cambia AR ni proveedor de modelos.

QA D tras publicación: nuevo boceto sintético con altura humana 2,8 m sobre suelo
terminado → ID 30 (un solo nuevo plano). SVG HTTP 200, parser XML sin errores,
scripts/eventos/foreignObject=0, viewBox 0 0 1400 900, aviso literal NO EJECUTAR EN
OBRA y altura confirmada presentes; radios/soportes/cálculo figuran pendientes.
Visor abierto desde Planos IA, captura local ignorada
`.ai-benchmark-results/ia-quality-02/plano-30-estatico.png`.
Revisión visual: añade ZONA TALLER no solicitada; por tanto, sigue sin garantizar
fidelidad completa. No acreditar escala, geometría ni uso en obra por ser XML válido.
