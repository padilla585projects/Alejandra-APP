# ADR-0027 — Escaneo del entorno + IA de visión en tiempo real para el AR del Replanteo

- Identificador: ADR-0027
- Fecha: 2026-10-03
- Estado: **Aceptado — por el Director en chat el 03/10/2026, autorizando su implementación nocturna**
- Decisores: Director del Proyecto (Adrián)
- Depende de: ADR-0024 (replanteo asistido por cámara), ADR-0025 (rediseño cámara+sensores),
  ADR-0026 (AR nativo ARCore en la APK), ADR-0007 (autonomía de agentes)
- Especificación: [`docs/features/replanteo-fondo-informe-escaneo/README.md`](../features/replanteo-fondo-informe-escaneo/README.md)

## Contexto

El AR del Replanteo (PWA WebXR en `index.html` y Activity ARCore nativa en la APK) clasifica
las superficies solo por geometría: vertical/horizontal y, en WebXR, la altura respecto al
móvil. No sabe qué hay de verdad delante. Una mesa cuenta como suelo, una bandeja existente es
"pared" y el operario puede marcar encima de una instalación sin aviso.

El informe de un replanteo AR, además, no tenía foto real del entorno. `_replImagen3DInforme()`
caía a un render sobre rejilla blanca, con la instalación "flotando en el aire". El modo Foto
sí pinta sobre la foto real desde REPL-INFORME-3D-02. Adrián (18/09/2026): "si no escaneamos el
entorno no podemos hacer el informe real de situación". Su visión es esta: un cartel "Escanea
el entorno" **antes** de poder marcar; la IA de visión analiza lo escaneado y realimenta al AR
**en tiempo real mientras se escanea y se marca** ("IA y AR trabajan juntos").

## Decisión

1. **Fase de escaneo obligatoria, pero que nunca bloquea.** Al abrir el AR, en la PWA y en
   la APK, sale el cartel "🔎 Escanea el entorno" con el progreso. Muestra las superficies
   confirmadas, los fotogramas analizados por la IA y las instalaciones vistas. Los
   controles de marcado aparecen al pulsar "Empezar a marcar", que solo se habilita cuando
   el escaneo es suficiente (`_replEscaneoSuficiente` en `repl3d.js` y
   `EscaneoEntorno.suficiente` en Java):
   - con IA: 3 fotogramas analizados y 1 superficie confirmada, o 5 fotogramas y 12 s si
     ARCore no confirma planos en paredes lisas;
   - sin IA: 2 superficies confirmadas.

   "Continuar sin IA" está siempre disponible, para cuando falla la red o la IA. Degrada a
   escaneo solo geométrico; no bloquea.
2. **IA en bucle, con coste acotado.** Cada ~3 s se envía al endpoint nuevo un fotograma
   JPEG reducido a 768 px con su contexto: los planos detectados con id, tipo geométrico,
   posición en la imagen, distancia y altura relativa. El tope es de 40 análisis por sesión
   y el modelo es `claude-haiku-4-5-20251001`. El análisis sigue también durante el marcado
   hasta agotar el cupo.
3. **Dónde vive:** `alejandra-app-api` (`worker.js`). Ahí están la clave de Anthropic, el
   endpoint hermano "¿qué es esto?" (`/replanteos/identificar`), el R2 del tenant (`FILES`)
   y el patrón de auth y departamento de los replanteos. No es una herramienta de Alejandra:
   no tiene memoria, tools ni permisos nuevos. Por eso la regla "dos cerebros" no obliga a
   tocar `alejandra-agente`.
   - `POST /replanteos/escaneo` abre una sesión. Requiere permiso de edición de replanteos y
     fija el departamento con `_replanteoDeptDe`.
   - `POST /replanteos/escaneo/<id>/frame` recibe `{imagen, analizar, guardar, fase, camara:{pose,proj,w,h}, planos}`.
     Devuelve `{analisis, motivo_sin_ia, ia_usados, ia_max, guardado}`.
   - `GET /replanteos/escaneo/<id>` devuelve los metadatos: fotogramas con sus matrices de
     cámara y las instalaciones vistas.
   - `GET /replanteos/escaneo/<id>/frame/<n>` devuelve la imagen.
4. **Formato de la IA:** uso forzado de herramienta (`tool_choice` → `clasificar_entorno`).
   Devuelve:
   - `superficies` por id de plano: pared, suelo, techo, mueble u otro;
   - `instalaciones` con tipo de lista cerrada, etiqueta y bbox 0..1;
   - `zonas`, `calidad` y `resumen`.

   El servidor trata la respuesta como dato no fiable (`_escaneoSanearAnalisis`): enums
   cerrados, ids de plano solo si se enviaron, texto recortado y sin `<>`/controles, cajas
   acotadas y listas con tope. El prompt indica que el texto visible en la escena nunca es
   una instrucción.
5. **Realimentación al AR, en la PWA y en la APK:**
   - Votos por plano. Un plano que la IA ve como mueble u otro, con al menos el 60 % de los
     votos, deja de servir para pegar puntos.
   - En WebXR, la IA decide suelo frente a techo en los planos horizontales, porque allí la
     clasificación es por altura. En la APK la normal de ARCore ya lo distingue y la IA solo
     excluye muebles.
   - Las instalaciones existentes se sitúan en 3D desproyectando el centro de su caja con
     la cámara **del instante de la captura** y cortando el rayo con los planos detectados.
     Se pintan como etiqueta y esfera de alambre (`_replEscaneoEtiqueta` en la PWA y
     `actualizarEscaneoIA` en `overlay.html`). Si el anillo o el punto marcado cae sobre una
     de ellas, se avisa antes y después de marcar.
   - No se actúa por fotograma a 60 fps: la IA ajusta el estado (votos e instalaciones) y el
     render de cada frame lo consulta. Es el camino realista que ya anticipaba la
     especificación.
6. **Fondo real del informe.** Los fotogramas clave se suben a R2 con la matriz de mundo y la
   proyección **reales** de esa vista: hasta 16 al moverse más de 40 cm o 25°, y hasta 4
   "final" al pulsar Fin.
   - El informe elige el fotograma que mejor ve el recorrido (`_replEscaneoMejorFrame`) y
     renderiza la instalación con esa misma cámara encima de la imagen
     (`_replEscaneoComponer`). Así queda donde se marcó, pegada a la pared o al techo
     reales. También dibuja en discontinuo las instalaciones existentes que vio la IA.
   - Superficies: `index.html` (`_replImagen3DInforme`) y `panel.html` (`replOfficeInforme`,
     que carga `repl3d.js` y three.js bajo demanda).
   - Sin escaneo, o si ningún fotograma ve el recorrido, se mantiene el respaldo anterior.
7. **Sin migración D1.** La sesión es un JSON en R2 en
   `e<empresa>/replanteo-escaneo/<id>/sesion.json`, junto a `f<n>.jpg`. El replanteo guarda
   `trazado_json.escaneo_id`, una columna JSON existente cuyo esquema real se comprobó en D1
   el 03/10 en modo solo lectura.
   - Al crear el replanteo se valida que el escaneo sea de la misma empresa y departamento y
     no esté usado. Después se vincula una sola vez, el PATCH no puede cambiarlo y el
     escaneo queda cerrado a nuevos fotogramas.
   - Al borrar el replanteo se borran sus fotogramas, con el mismo criterio que `fotos_json`.

## Coste y límites (aplicados en el SERVIDOR)

- Por sesión: 40 análisis IA y un intervalo mínimo de 2,5 s entre análisis (el cliente envía
  cada 3 s).
- Por usuario y día: 12 sesiones y 300 análisis.
- Los contadores se actualizan con escritura condicional por etag de R2 (compare-and-swap,
  `_escaneoJsonMutar`). Una ráfaga en paralelo no supera el tope: el test envía 8
  simultáneos y solo entra 1.
- Estimación por análisis: imagen de ~768×576 (~600 tokens), contexto y salida de unos 400
  tokens. Una sesión completa son 40 llamadas a Haiku, del orden de céntimos. El servidor
  rechaza imágenes de más de 700 KB.

## Privacidad y aislamiento

- Las imágenes de obra solo se guardan en el R2 del tenant, bajo `e<empresa_id>/…`. La clave
  la construye el servidor con la empresa de la sesión: el cliente nunca aporta una ruta R2.
- Lectura: solo la misma empresa y, si no es privilegiado, el mismo departamento. Es la misma
  regla que `_replanteoDe` ("como si no existiera"). Escritura de fotogramas: solo el
  usuario que abrió la sesión, y solo mientras no esté vinculada a un replanteo.
- Las imágenes se envían a Anthropic (Haiku) solo para clasificar el fotograma; no se guardan
  allí más allá de su política de API. Es el mismo tipo de envío que ya hacía "¿qué es
  esto?" a Gemini.
- Retención: los escaneos abandonados (AR cancelado sin guardar) quedan en R2 bajo
  `replanteo-escaneo/`. **Pendiente (decisión humana):** configurar una regla de ciclo de
  vida de R2 para ese prefijo, por ejemplo 30 días si `replanteo_id` es null. No se aplica
  sin autorización porque es un borrado en R2.

## Alternativas consideradas

- **Una sola foto automática al terminar el AR** (`_replArCapturaCamara`). Era un cambio
  pequeño, pero **Adrián la descartó** (18/09): un solo ángulo no permite el "informe real
  de situación" ni entender el entorno mientras se marca.
- **Análisis puntual al final**, como el actual "¿qué es esto?". Se descarta porque no
  realimenta el AR mientras se marca, que es justo lo que pide la visión.
- **IA por fotograma (60 fps) o en el dispositivo.** Se descarta por coste, latencia y
  batería. El ajuste de estado cada 3 s cubre el caso de uso.
- **Panorama o mosaico cosido, o proyectar fotos sobre los planos.** Queda para el futuro. El
  fotograma con la cámara real ya da un fondo fiel donde se ve el recorrido, con mucho menos
  riesgo.
- **Tabla D1 para sesiones y contadores.** Es más cómodo para consultas, pero exige migración.
  Adrián prefería evitarla, y la escritura condicional de R2 garantiza el límite igual.

## Consecuencias

- El primer uso del AR añade unos segundos de escaneo antes de marcar. Es una decisión de
  producto de Adrián y es saltable con "Continuar sin IA".
- La realimentación depende de la red: sin conexión se degrada a geometría y aun así se
  guardan localmente (PWA) los fotogramas clave para el informe recién hecho.
- "¿Qué es esto?" y "📸" de la PWA capturaban fuera del callback del frame XR. Ahí
  `getViewerPose` lanza error, así que fallaban siempre con "este móvil no da acceso". Ahora
  piden la captura al siguiente frame (`_replArCapturaEnFrame`) y restauran el framebuffer
  de three.js.
- Al crear un replanteo desde la PWA se perdían los complementos colocados en AR hasta el
  siguiente guardado: el POST no los enviaba y el PATCH sí. Se corrige de paso.
- Límites conocidos:
  - la posición 3D de una instalación existente es aproximada: centro de la caja y primer
    plano cortado;
  - la calidad de la clasificación depende de la luz y del encuadre;
  - en WebXR el fondo del informe exige que el móvil dé `camera-access`; sin él no hay
    fotogramas y se usa el respaldo.

## Despliegue y rollback

- Despliegues necesarios, todos manuales según el runbook:
  - Worker API (`worker.js`), con los endpoints nuevos;
  - Pages (`index.html`, `panel.html`, `repl3d.js`), que **requiere subir versión**;
  - APK nueva, por los cambios nativos y `assets/ar/`.

  `alejandra-agente` no cambia. No hay migración D1 ni secretos nuevos: `ANTHROPIC_API_KEY`
  ya existe en el Worker API.
- Orden: primero el Worker; después Pages y la APK. Un cliente nuevo contra un Worker viejo
  recibe 404 al abrir la sesión y degrada a escaneo geométrico. Un cliente viejo contra un
  Worker nuevo no usa nada de esto.
- Rollback: revertir el commit y redesplegar Worker y Pages. La APK anterior (1.17) sigue
  funcionando contra un Worker con o sin estos endpoints. Los objetos ya subidos a R2 quedan
  huérfanos pero aislados por empresa. Si se quiere retirarlos, es un borrado en R2 y
  requiere decisión humana. Los replanteos guardados con `escaneo_id` siguen abriéndose: el
  campo se ignora si no hay endpoint.
