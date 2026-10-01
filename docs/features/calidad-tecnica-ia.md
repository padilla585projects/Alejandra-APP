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

## IA-QUALITY-04 — contrato de archivo

Generación y edición IA verifican sintaxis XML con saxes 6.0.0 fijado, namespace SVG
y avisos de borrador técnico/NO EJECUTAR EN OBRA en nodos text/tspan/textPath.
Comentarios, defs, metadata/title/desc y ocultación directa display/visibility/opacity
no aportan avisos. Gantt exige borrador, sin equipararlo a plano de ejecución.
Se valida también tras inyectar biblioteca de símbolos. DTD/ENTITY declaradas y
salidas >512 KiB se rechazan; no se completan ni reparan salidas ambiguas.

23 pruebas técnicas y 297 agente pasan. Rechazos de generación sin INSERT, edición
sin UPDATE y corrupción tras símbolos cubiertos. CI instala dependencias raíz.
No valida geometría, cotas, semántica normativa, CSS por clases ni legibilidad/posición
del aviso; no es un sanitizador universal ni modifica dibujos guardados anteriormente.

Dependencia: [saxes](https://github.com/lddubeau/saxes), parser JS de texto sin DOM/I/O,
licencia ISC y versión 6.0.0 fijada con xmlchars; npm audit local sin vulnerabilidades.
Repositorio archivado desde diciembre de 2025: limitación de mantenimiento registrada;
revisar sustitución ante nuevos defectos. El ensayo inicial con fast-xml-parser aceptó
entidad indefinida, `<` en atributo, carácter XML prohibido y prefijo no vinculado;
se descartó y no quedó en package/lock. Esto es elección de implementación acotada,
sin cambio de arquitectura/ADR ni de proveedores. Publicación registrada a continuación.

## IA-QUALITY-04 — publicación verificada (2026-10-01)

PR #349 integrada (8c9fea7), cuatro checks verdes. API publicada desde
7d7ac10215a796e29df0c24615b102c328ea22ef, run 36848446973 SUCCESS,
versión 62f451e7-2c0d-42f9-ba7d-a4cf6d395ede; health sin caché healthy D1/R2.
QA sintética E, demo 5: reintento de generación, ID 31 HTTP 200, XML válido y
avisos BORRADOR/NO EJECUTAR EN OBRA presentes. Altura 2,80 m presente, pero no
texto suelo terminado/FFL: fidelidad del datum pendiente. Sin ZONA TALLER en este
ensayo; no acredita ausencia general de elementos inventados ni geometría correcta.
Agente 39559254 y Pages 9.81 conservados. QA preservada, sin reparación/borrado.

## IA-CALC-QUALITY-01 — calculadores preliminares

Cable valida magnitudes finitas positivas, cosφ, enums, sistema explícito, temperatura
admitida y agrupamiento entero 1–20. Grupos intermedios usan el siguiente grupo
tabulado; no extrapola. Cumplimiento normativo queda pendiente, mientras indica los
criterios parciales calculados. Inferencia por tensión y caída por defecto se exponen
como supuestos. Tablas y aproximación de aluminio existentes se conservan.

Bandeja calcula arco ideal con radio aportado; sin él pregunta. No inventa radio
mínimo ni máximo universal de ocupación. T/X/reducciones requieren catálogo.
Protección valida datos y secciones tabuladas; calibre/curva/polos son preselección.
Diferencial pendiente de esquema de tierra, protección y corrientes residuales,
sin seleccionar 300/30 mA únicamente por tipo de carga. Coordinación sigue parcial.

[REBT oficial, ITC-BT-19 y 24](https://www.boe.es/buscar/act.php?id=BOE-A-2002-18099):
ITC-BT-19 distingue límites de caída por instalación/uso. Un default 5% no acredita
el límite aplicable ni caída acumulada. No se incorporan nuevas tablas normativas.
Campos no determinables devuelven null: consumidores deben tratarlos como pendientes.
28 pruebas técnicas y 297 agente pasan. Riesgo: clientes que asumían resultados
completos deben manejar pendientes. Rollback agente 7d7ac10215a796e29df0c24615b102c328ea22ef.
Publicación y QA registradas a continuación; sin migraciones ni cambios AR/APK/Pages.
Roadmap, ADR y registro documental no cambian de fase: continuación de calidad aprobada.

## IA-CALC-QUALITY-01 — publicada y verificada (2026-10-01)

PR #350 → e1c83580fb1eda945e0d2171cb2f493070ce173e, cuatro checks verdes.
Agente publicado desde d4fa10df141d95fd0d62ceb984e5bc6fa4d54282,
run 36850334644 SUCCESS; versión 8b9abd62-7aec-4107-884c-6345739669e4,
health sin caché healthy D1/R2. 297 agente/28 técnicas, sintaxis/encoding/diff pasan.
QA A demo 5 llama ambas tools: ocupación 0,44%, radio/desarrollo sin inventar,
preguntas de datos y diferencial pendiente. El chat aún llama curva D «justificada»
sin datos de arranque: límite del lenguaje registrado, no selección validada.
API 62f451e7 y Pages 9.81 conservados; sin cambios AR/APK ni migraciones.
Rollback agente 7d7ac10215a796e29df0c24615b102c328ea22ef.
Siguiente: fidelidad de datum en planos y evitar sobreafirmaciones en respuestas.

QA B con datos aportados: radio interior 300 mm → radio medio 450 mm/desarrollo
707 mm, ocupación 0,44% frente a criterio aportado 40%. Cable trifásico explícito
a 230 V → 2,51 A, caída 0,23%, estado parcial y cumplimiento no acreditado.
La respuesta aún resume 3%/5% sin todos los casos del REBT: explicación debe
conservar límites/supuestos y no convertir referencias generales en decisión.
IA-CALC-QUALITY-02 corrige contexto de capacidades y exige preservar alcance/null
antes de llamar justificada una preselección. 297 tests agente pasan; prompt no es
garantía determinista. PR/CI/publicación/QA pendientes. Rollback agente d4fa10d.

## IA-CALC-QUALITY-02/03 — resultado y refuerzo (2026-10-01)

PR #351 → b4bd993, cuatro checks verdes; publicado desde
7465db9d5386f33bb695090076a49742fa7e98ad, run 36851058248 SUCCESS,
agente 521b550e-61f6-44c7-8851-2c526596ca10 healthy D1/R2 sin caché.
QA C llama protección pero afirma «puedes fijar 32A curva D» sin datos de arranque,
y luego reconoce que no está verificada. El prompt NO supera el ensayo de rigor.

IA-CALC-QUALITY-03 elimina selección de curva por carga: curva null, pregunta
por arranque/duración, cortocircuito y fabricante. Calibre es candidato sujeto a
coordinación. 297 agente/28 técnicas pasan, incluyendo motor sin curva inventada.
Riesgo: consumidores deben manejar null; no se valida selección final ni normativa.
Rollback agente 7465db9d5386f33bb695090076a49742fa7e98ad.
PR/CI/publicación/QA del refuerzo pendientes; dato de altura/datum y geometría
de planos siguen pendientes. Sin migraciones/cambios AR/APK/Pages.

## IA-CALC-QUALITY-03 — publicación y QA (2026-10-01)

PR #352 → 97c0aefae1fe6a882a1d84e14d944da4baf97461, cuatro checks verdes.
Agente publicado desde 45adbee6cfd40e7dc1b816bd780b46d761fb8d60,
run 36851707721 SUCCESS; versión fdeecccf-09ef-4fee-bbdb-6816bd498d19,
health sin caché healthy D1/R2. 297 agente/28 técnicas pasan.
QA D demo 5: motor 26 A → calibre candidato 32 A; curva y diferencial quedan
pendientes en herramienta y respuesta. No fija curva D por tipo de carga.
El chat aún resume «puedes fijar calibre 32A», sobreafirmación sin coordinación
completa: PENDIENTE. No declarar profesional/definitiva la selección por esta QA.
Planos conservados [31,30,29,28,27,26,25,21], sin altas durante pruebas de cálculo.
API 62f451e7, Pages 9.81 y AR/APK conservados. Sin migraciones ni borrados.
Rollback agente 7465db9d5386f33bb695090076a49742fa7e98ad.
Siguiente cola: preservar calibre como candidato en explicación/contrato;
fidelidad altura/datum/geometría y comprobaciones CAD estructuradas.
Una QA no acredita todos los oficios ni resultados aptos para ejecutar en obra.

Cierre QA: empresa 1/Seguridad restauradas y comprobadas por recarga; pestaña
de ensayo cerrada. Archivos locales ajenos preservados; QA sintéticas conservadas.

## IA-CALC-QUALITY-04 — contrato candidato (2026-10-01, en desarrollo)

La herramienta conserva el calibre normalizado como calibre_candidato_a; calibre_a
y calibre_proteccion_a definitivos quedan null. seleccion_definitiva_autorizada=false
y decision_permitida limita el resultado a explorar candidato, sin fijar/comprar/instalar.
Comparación de ampacidad tabulada sigue parcial, aunque resulte favorable. Pregunta
por cable, aislamiento, sección, instalación, temperatura y agrupamiento reales.
297 agente/29 técnicas pasan, incluyendo rechazo de autorización con sección aportada.
Riesgo de compatibilidad: consumidores deben manejar null y nuevo campo candidato.
Rollback agente 45adbee6cfd40e7dc1b816bd780b46d761fb8d60.
PR/publicación/QA pendientes. Sin nueva fase/ADR, tablas, migraciones ni AR/APK/Pages.

## IA-CALC-QUALITY-04 — publicada, QA parcial (2026-10-01)

PR #354 → e3ce8465574cb2f7f9a7a39b35fa485433accc1d, cuatro checks verdes.
Publicado desde d2daf690f259c1362764cb7858434f217b9e69b8, run 36931102547 SUCCESS.
Agente 8c2d0323-4963-4ac8-99aa-2ce4fcb60694, health sin caché healthy D1/R2.
297 agente/29 técnicas pasan. Contrato separa calibre candidato/definitivo (null)
y seleccion_definitiva_autorizada=false, incluso con comparación favorable.

QA E en interfaz móvil web publicada: motor 26 A, 230 V, sección 10 mm² en
bandeja y condiciones reales desconocidas. Chat identifica 32 A como candidato y
pide aislamiento/temperatura/agrupamiento/arranque/Icc/tierra, pero afirma
«sin riesgo» con ampacidad sin correcciones y que algo puede fijarse: FALLA
aceptación completa de rigor. Tampoco acreditar su promesa de selección coordinada:
la herramienta actual no verifica coordinación integral con esos datos.
Siguiente: quitar cumple/ampacidad como aprobación de coordinación y separar
comparación tabular de verificación real, con pruebas y QA de sobreafirmaciones.

Evidencia local ignorada .ai-benchmark-results/ia-calc-quality-04/chat-qa-e.png.
Sin petición de crear planos ni modificar datos de obra. Pestaña temporal cerrada,
sin cambios de empresa/departamento. No se afirma recuento de planos verificado
en este ensayo. Sin cambios AR/APK/Pages, migraciones ni tablas normativas.
Rollback agente 45adbee6cfd40e7dc1b816bd780b46d761fb8d60.
Fidelidad altura/datum/geometría CAD pendiente; ninguna QA acredita perfección.

## IA-CALC-QUALITY-05 — comparación tabulada (2026-10-01, en desarrollo)

coordinacion_cable.cumple y ampacidad_cable_a quedan null: la herramienta no
conoce las condiciones reales. ampacidad_tabla_sin_factores_a y
cumple_comparacion_tabular preservan aritmética; supuestos Cu/XLPE explícitos.
Alternativa de sección se llama seccion_candidata_tabular_mm2, no mínimo real.
Descripción impide afirmar seguridad/fijar protección/promesa de coordinación
integral por aportar más datos. 297 agente/29 técnicas pasan, favorable y
desfavorable sin selección autorizada. Riesgo: consumidores de campos anteriores
manejan null; ninguna fórmula/tabla nueva, sin migraciones/AR/APK/Pages.
Rollback agente d2daf690f259c1362764cb7858434f217b9e69b8.
PR/CI/publicación/QA pendientes; datum/geometría CAD siguen fuera de este arreglo.

## IA-CALC-QUALITY-05 — publicada y QA verificada (2026-10-02)

PR #356 → 0f0a6987c03848adfb9cc22daf1cd0de25148ea9, cuatro checks verdes.
Agente publicado desde e5eec22cc80267076612bd0d4cab08f14ca46b3c,
run 36932203552 SUCCESS; versión d99b5a51-dafe-4ae1-a9c7-adefe3a47c62,
health sin caché healthy D1/R2. 297 agente/29 técnicas, sintaxis/encoding correctos.
QA F móvil web, 26 A/230 V/10 mm²/bandeja y condiciones desconocidas: llama
calcular_proteccion, identifica 32 A candidato y 76 A tabulada sin factores;
responde explícitamente que no se puede fijar calibre ni afirmar cable seguro.
Curva/diferencial y cumplimiento normativo pendientes; solicita los datos reales.
Supera criterios de este ensayo; no acredita otros casos ni todos los oficios.

La respuesta también afirma retrospectivamente que QA E pasa: incorrecto. QA E
sigue FALLIDA tal como quedó registrada; no aceptar autoevaluación del modelo
como evidencia ni reescribir resultados previos. Fuente: observación real de cada QA.
Pendientes: fidelidad altura/datum/geometría CAD y evaluación más amplia. En
interfaz móvil el Markdown/tablas salen como texto literal: registrar para auditoría
gráfica y muestras previamente pedidas, sin cambiar UI en este arreglo.
Rollback agente d2daf690f259c1362764cb7858434f217b9e69b8.
Sin cambios API/Pages/AR/APK, tablas, migraciones ni solicitudes de crear planos.
No afirmar recuento de planos: no se consultó en este ensayo.

Evidencia ignorada: .ai-benchmark-results/ia-calc-quality-05/chat-qa-f.png.
Pestaña de ensayo cerrada; empresa/departamento no modificados. Archivos ajenos
y QA anteriores preservados. Cierre de implementación/ensayo acotado, no de CAD.

## IA-QUALITY-05 — altura y referencia en el archivo (2026-10-02, en desarrollo)

La API interpreta únicamente el bloque JSON humano que el agente ya añade a la
descripción. No extrae datos de ejemplos libres ni duplica el gate humano. Bloque
mal formado/inválido se rechaza; legacy sin bloque conserva contrato anterior.
Generación y edición exigen una anotación de altura/unidad/referencia coherente
en texto SVG no oculto directamente. Acepta m/cm/mm equivalentes y FFL/suelo
terminado/pavimento terminado como datum equivalente; distingue cota de proyecto.
No se inventa ni inserta automáticamente una nota: rechaza respuesta incompleta.
Se comprueba antes/después de símbolos. 33 técnicas/297 agente pasan; ausencia o
cambio de datum impide INSERT/UPDATE. El prompt pide literalmente la anotación.
No garantiza cotas de cada tramo, otros rótulos, geometría ni CSS/legibilidad.
Bocetos y descripciones legacy no reciben una altura deducida. API directa con
descripción libre sigue fuera de esta garantía: no confundir compatibilidad con
validación de todos los canales. Fuente humana verificada sigue siendo lib.js.
Rollback API 7d7ac10215a796e29df0c24615b102c328ea22ef.
Sin migraciones/AR/APK/Pages, nuevas tablas ni fase/ADR. PR/publicación/QA pendientes.
Siguiente encadenado autorizado: auditar ambigüedad/correcciones del gate humano.

## IA-QUALITY-05 — API publicada; lectura real verificada (2026-10-02)

PR #358 → 742b6ec, cuatro checks verdes; implementación
296d4d33a52e6d9b5daa438653814e1336adddfd. Run 36937099698 SUCCESS,
API bd7403c9-14bd-4c1e-8484-e78325282016 healthy D1/R2 sin caché.
Primera lectura mostró versión anterior durante propagación; segunda confirmó
la publicada. Aplicación móvil: inventario y chat cargan con sesión existente,
sin cambiar empresa/departamento ni crear/modificar planos. No acredita aún una
generación real con anotación; 33 pruebas técnicas verifican contrato y rechazo
sin INSERT/UPDATE. Rollback API 7d7ac10215a796e29df0c24615b102c328ea22ef.
Encadenado IA-QUALITY-06: ambigüedad de datos humanos; API directa libre y geometría
siguen pendientes. PWA/AR/APK/Pages conservados.

## IA-QUALITY-06 — confirmar antes de elegir alturas (2026-10-02, en revisión)

Codex; codex/plan-human-ambiguity, base 742b6ec, continuación autorizada.
lib.js examina todas las alturas/referencias de cada mensaje humano. Valores
incompatibles, ejemplos, preguntas y expresiones de duda/negación reconocidas
requieren aclaración; una duda reciente impide recuperar el dato antiguo.
Repeticiones equivalentes m/cm/mm y FFL/suelo/pavimento siguen aceptadas.
Confirmación clara posterior resuelve ambigüedad; corrección entre turnos actualiza
altura y conserva datum confirmado. Dos alturas distintas en el mismo mensaje,
incluso con «corrijo», requieren confirmar una única o detallar tramos; el contrato
actual es de una altura. El gate sigue antes de API_WEB y no confía en tool_input.
300 pruebas agente y 33 técnicas pasan, sintaxis y diff correctos. En primera
prueba «Quizá» escapaba por límite ASCII de palabra: corregido y suite verde.
Heurística conservadora puede pedir más aclaraciones; no cubre cualquier frase,
OCR, geometría, múltiples alturas estructuradas ni entradas directas web libres.
Sin cambios de autenticación/esquemas/AR/APK/UI/Pages ni migraciones.
Rollback agente e5eec22cc80267076612bd0d4cab08f14ca46b3c.
Pendientes PR/CI, publicación agente, QA conversacional real y siguiente auditoría
sobre datos de referencia entre turnos. No declarar perfección ni normativa validada.

## IA-QUALITY-06 — publicada y QA G parcial (2026-10-02)

PR #359 → 384d265, cuatro checks verdes; implementación 9d31f757.
Run 36937820163 SUCCESS; agente 785c8348-ddf6-4258-9523-63be73172e5b
healthy D1/R2 sin caché. QA G en móvil web pide confirmar alturas de ejemplo
2.8/3.2 por tramo, datum y recorrido; no presenta los ejemplos como confirmados.
También vuelve a calcular protección y responder QA F anterior: contexto arrastrado.
Cierre promete «plano de ejecución real» con tres datos: NO acreditado por el
motor actual; QA G solo supera preguntas de altura/datum, aceptación global parcial.
No aceptar el «QA pasa» del propio modelo como verificación completa. Petición
explícita de no crear/guardar; respuesta dice no generar. No se consultó recuento
backend; no afirmar ausencia de escrituras como dato medido. Evidencia local
.ai-benchmark-results/ia-quality-06/chat-qa-g.png. 300 agente/33 técnicas pasan.
Siguiente IA-QUALITY-07 corrige recuperación de altura obsoleta cuando el nuevo
valor carece de unidad/formato soportado. Después CAD-SCOPE-01; sobrepromesa de
plano de ejecución y contexto QA previo quedan pendientes de corrección/medición.
Rollback agente e5eec22cc80267076612bd0d4cab08f14ca46b3c.

## IA-QUALITY-07 — altura nueva incompleta y signo (2026-10-02, en revisión)

Codex, codex/plan-height-replacement, base 384d265; continuación autorizada.
lib.js preserva signos +/− de cotas explícitas, sin inventar límites de montaje.
Una medida numérica nueva sin unidad/formato admitido bloquea recuperar la vieja;
lo mismo en mensajes con una altura válida y otra incompleta. Reconoce por medir
como pendiente. Referencia «cota 0 del proyecto» no cuenta como segunda medida.
302 pruebas del agente y 33 técnicas pasan; case real generar_plano rechaza cinco
casos sin API_WEB y transmite −1 m confirmado como metadata. Sintaxis/encoding/diff
correctos. Una prueba inicial detectó el falso positivo del datum cota 0: corregido.
Unidades soportadas siguen m/cm/mm; otros formatos requieren aclaración. No
comprensión universal ni múltiples alturas estructuradas. Sin API/UI/AR/APK/Pages,
autorización, datos, migraciones o nuevas tablas. QA G previa sigue parcial.
Rollback agente 9d31f7570ad6f3edd62de64e1b5f7e69e76b728e.
Pendiente PR/CI, publicación y lectura/QA del agente. Siguiente CAD-SCOPE-01:
corregir fallback empresa 1 y rechazo de empresa mal formada en CAD; comprobar
propiedad R2 desconocida antes de convertir/importar. Sin pruebas con datos ajenos.
