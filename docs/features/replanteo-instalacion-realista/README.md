# Referencia visual — cómo debe verse una instalación en el render 3D del Replanteo

Fotos reales aportadas por Adrián (18/09/2026) para fijar el objetivo de realismo del render
3D compartido (`repl3d.js`, usado por la vista 3D, el informe imprimible, el AR nativo y el AR
WebXR). Comparadas con el render actual (`_replInstal3D`), señalan tres mejoras pendientes,
en este orden de prioridad:

1. **Que la instalación se pegue de verdad a la pared/techo real, nunca "en el aire".**
   Prioridad más alta ("sobre todo que no vuelva en el aire" — Adrián). Parcialmente atacado ya
   por PARED-NORMAL-REAL-01 (orientar contra la normal real cuando se conoce) y por las mejoras
   de profundidad portadas a la PWA el 18/09 (mediana de 5 muestras + ajuste manual de
   acercar/alejar) — pero sigue habiendo margen: cuando WebXR SÍ confirma un plano real
   (`frame.detectedPlanes`) bajo un punto, hoy no se fuerza esa posición contra el plano, se usa
   la pose cruda del hit-test tal cual.
2. **Tramos siempre en ángulo recto** (`ref-02-esquina-pared-techo.jpg`, `ref-03-...jpg`): sube
   vertical por la pared, gira 90° justo en la esquina, sigue horizontal por el techo — nunca en
   diagonal. El trazado actual conecta los puntos marcados en AR con una línea recta tal cual se
   marcaron; cualquier imprecisión de la mano al trazar sale como una diagonal en el render.
3. **Varios tubos/bandejas en paralelo siguiendo el mismo recorrido** (`ref-01-...jpg`: 4-5
   tubos rígidos juntos, mismo camino, mismos giros, separación regular). Hoy `_replInstal3D`
   solo dibuja UN elemento por trazado.

## Notas sueltas de las fotos

- `ref-01-sensores-cpd-pared.jpg`: sondas de temperatura/humedad en CPD — tubo individual
  (cable de sonda) baja recto por la pared, caja de derivación en el cambio de dirección hacia
  el aparato, y aparte un grupo de 4 tubos rígidos en paralelo con abrazadera compartida.
- `ref-02-esquina-pared-techo.jpg`: ejemplo claro de esquina pared→techo en ángulo recto, con
  caja de derivación justo en el cambio de plano.
- `ref-03-bandejas-techo-obra.jpg`: bandejas/tubos por techo en una nave, recorrido recto y
  paralelo a la estructura, apoyos regulares.

## Decisión pendiente relacionada

CODO-SIN-CAJA-AUTO-01 (17/09/2026) quitó la caja automática en cada codo del tubo, porque
Adrián pidió controlar él mismo dónde van las cajas de registro/mecanismo. Las fotos de
referencia SÍ muestran una caja en cada cambio de plano (pared↔techo) — falta decidir si eso
justifica una caja automática solo ahí (no en cada codo intermedio del propio tubo), o si se
mantiene 100% manual. Sin decidir todavía — no se ha implementado nada de esto, es contexto
para cuando se aborde la tarea completa.

## Alcance

Cambio de más calado en el motor de geometría compartido (`repl3d.js`): afecta a la vez a la
vista 3D, el informe imprimible, el AR nativo (APK) y el AR WebXR (PWA). No abordar sin poder
probar en vivo en un dispositivo con ARCore (ver `TASKS.md`).
