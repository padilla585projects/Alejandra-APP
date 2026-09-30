# Android AR 1.16 — superficies y paridad visual

Fecha: 2026-09-30. Tarea: ANDROID-AR-ESTABILIDAD-01. Rama: codex/android-ar-estabilidad.
Estado: #335 integrado; candidata conjunta 1.17 instalada y verificación física parcial.
Corrección adicional de canvas/contornos fbff4d8; paredes aún sin confirmar.

## Prueba física del 01/10 y corrección del overlay

Oppo CPH2305 por ADB Wi-Fi 192.168.10.53:5555, package propio y Activity AR nativa.
Bootstrap y reemplazos con -r, conservando datos; borradores de PrúébalaAPP sin Guardar.
Se detectó setSize(w,h,false): el buffer DPR 2 definía también el tamaño visible porque
el canvas carecía de dimensiones CSS. Materiales y planos aparecían desplazados.
Regresión reproduce 720 CSS frente a 360 esperados; con tamaño CSS explícito pasa.
Bandeja visible junto a puntos después del arreglo. Bordes usan contorno consecutivo
en lugar de pares de EdgesGeometry; prueba verifica sus vértices y liberación.

- Overlay listo confirmado por funciones JS reales; errores locales solo ubicación.
- Overlay 8/8, superficies Java 5/5, política OTA 3/3 y release correctos.
- Techo sin confirmar rechaza punto. Profundidad aproximada identificada como tal.
- ARCore contó superficies horizontales de suelo/techo, pared se mantuvo 0. No acredita
  que cada plano coincida con una superficie semántica de la habitación.
- Dos puntos y un complemento se exportan a borrador; Fin vuelve a MainActivity.
  Giros de sistema 90°/180° mantienen sesión y render, sin crash del proceso propio;
  se restauraron accelerometer_rotation=1 y user_rotation=0.
- Pendientes: contornos finales en vivo, pared texturada/esquina, dos puntos pegados
  sobre cada superficie, tubo, orientación real del mecanismo y estabilidad en movimiento.
  OTA positiva pendiente. No promover estable ni afirmar paridad física completa.

La hipótesis inicial de sobrescritura de matriz de cámara se descartó: su test también
pasaba sin el cambio propuesto. La corrección integrada es tamaño CSS y contorno.

APK final de revisión 1.17 desde fbff4d8, misma firma release existente.
SHA-256: `2059116B5C576357AAE99FF0A51D0594EDCD802E7E442B4AE55C1419D38FE015`.
Sustituye los hashes históricos de candidata 1.16 y primera candidata OTA 1.17.

## Objetivo y evidencia

Adrián pide reconocer suelo, techo y paredes, apoyar la instalación en la superficie
correcta y aprovechar en la APK el realismo ya disponible en PWA. La 1.15 instalada en
el Oppo CPH2305 no incluía el motor de geometría #322. El cierre WebXR del 18/09 no
demuestra el funcionamiento del binario nativo. La PWA permanece sin cambios.

## Comportamiento implementado

- ARCore conserva detección horizontal/vertical y autofocus. La normal exterior permite
  clasificar pared, suelo y techo; se muestran cantidades de planos confirmados.
- En el panel ✥ se elige automática, pared, suelo o techo. La elección filtra planos:
  no coloca sobre suelo si se pide techo y ese techo no está confirmado.
- Hit sobre plano usa su posición y normal. Un punto o profundidad actuales también
  pueden pegarse al plano más cercano, dentro de su contorno y hasta 15 cm. Se descartan
  planos fusionados o sin tracking. No se extiende un plano infinito fuera de su contorno.
- En automático, profundidad actual sin plano es una aproximación identificada como tal.
  Sin profundidad ni superficie no se inventa distancia de 0,6 m ni reutiliza una lectura
  anterior. Tocar mantiene el contacto explícito a 10 cm; tampoco se presenta como detección.
- La profundidad D_16 se lee little-endian con 16 bits completos. Se filtran valores fuera
  del rango de trabajo 0,1–8 m antes de obtener la mediana de cinco muestras.
- Frente +Z de accesorios alineado con normal +Y de ARCore, tanto en vista como exportación.
  Trazado sigue el refinado de anclas; ajustes incluidos en marcas y medida mostrada.
- Undo/export usan el hilo GL. Actualización de geometría de cámara también con giro 180°;
  se espera al overlay cargado. Se liberan anclas/sesión/WebView y buffers/materiales retirados.
- assets/ar/repl3d.js conserva exactamente el motor y materiales PWA; prueba CI evita
  publicar otra APK con la copia desfasada. No se duplican modelos nuevos en Java.

Fuentes técnicas: [normal de Plane](https://developers.google.com/ar/reference/java/com/google/ar/core/Plane),
[orientación de Point](https://developers.google.com/ar/reference/java/com/google/ar/core/Point.OrientationMode),
[profundidad D_16](https://developers.google.com/ar/reference/java/com/google/ar/core/Frame#acquireDepthImage16Bits()).
Se reutiliza el contrato de quaternion y snap existente de PWA sin editar sus archivos.

## Pruebas y entrega

- node --test scripts/android-ar-overlay.test.cjs: 6/6. Proyección tras resize,
  liberación de instalación/complementos/planos, geometría degenerada y paridad del motor.
- gradlew testDebugUnitTest: SurfaceGeometryTest 5/5, sin errores. Proyección de suelo,
  techo y pared, rechazo de distancia/datos inválidos, clasificación, D_16 y orientación
  del frente de accesorios con giro manual. El test scaffold adicional no acredita AR.
- gradlew assembleRelease: correcto; versión 16/1.16, firma release existente.
  CI incluye compilación Java Android y pruebas; no usa credenciales ni firma de producción.
- La 1.15 abrió sesión ARCore y permitió colocar un punto en borrador. Una 1.16 preliminar
  fue instalada; ADB quedó offline antes de instalar/probar la compilación final de superficies.
  **No hay confirmación visual final de pared/techo/suelo, materiales o rotación.**

Al recuperar ADB: instalar APK final con -r, abrir Alejandra → Replanteo → Nuevo → AR,
comprobar Activity nativa, explorar tres superficies, elegir techo apuntando al suelo
(debe rechazar), trazar dos puntos sobre cada superficie, probar tubo y bandeja y un
mecanismo, moverse para verificar estabilidad y normal, girar 90°/180°, deshacer,
terminar al editor, cancelar y reentrar. No guardar datos de prueba ni editar registros.
Registrar resultado aquí/HANDOFF antes de promover la entrega a estable.

Rollback: revertir cambios nativos. Conservar APK 1.15 y datos de la app; no desinstalar
ni borrar almacenamiento. No hay migraciones, despliegue web o cambios de permisos/datos.

## Límites pendientes

La clasificación es geométrica: un plano horizontal superior de una mesa también puede
clasificarse como suelo/apoyo; no hay interpretación semántica de habitaciones. ARCore
necesita textura, luz y movimiento para confirmar un plano; no se garantiza detectar una
pared o techo lisos desde una imagen inmóvil. El selector filtra el tipo, no bloquea un
plano para todo el tramo. Ángulos rectos, tubos paralelos, edición de cualquier punto,
oclusiones reales e iluminación ambiental no se declaran implementados en esta entrega.
Escaneo + IA y ADR-0026 siguen pendientes. No se cambia el motor compartido ni la PWA.

## Artefacto de revisión

APK 1.16 construida desde b72a137 (implementación 980c5eb); no publicada como estable.
SHA-256: `DB1C5E1BB512AA31F416A158CE35038E5CC1F27A548CD7B171F3AAE06F278AE2`.
Certificado release SHA-256: `047707b5fd0281dacd127ff04a0c2f4eb46c7ed718cbbde841e9398400e3dd8c`.
PR: [#335](https://github.com/padilla585projects/Alejandra-APP/pull/335).
