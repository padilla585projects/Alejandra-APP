# Referencia visual — cómo debe verse una instalación en el render 3D del Replanteo

Fotos reales aportadas por Adrián (18/09/2026) para fijar el objetivo de realismo del render
3D compartido (`repl3d.js`, usado por la vista 3D, el informe imprimible, el AR nativo y el AR
WebXR). Comparadas con el render actual (`_replInstal3D`), señalan varias mejoras pendientes,
en este orden de prioridad:

1. **Que la instalación se pegue de verdad a la pared/techo real, nunca "en el aire".**
   Prioridad más alta ("sobre todo que no vuelva en el aire" — Adrián). **Cerrada y verificada
   el 18/09:** #319/#320 fuerzan el punto contra el plano real detectado y guardan su normal,
   tanto con hit-test como con profundidad; #322 evita geometría degenerada en esquinas.
   Adrián confirmó el resultado en el Oppo. Se mantienen la mediana de profundidad y el
   ajuste manual; reconocer superficies lisas sigue siendo una limitación conocida.
2. **Tramos siempre en ángulo recto** (`ref-02-esquina-pared-techo.jpg`, `ref-03-...jpg`): sube
   vertical por la pared, gira 90° justo en la esquina, sigue horizontal por el techo — nunca en
   diagonal. El trazado actual conecta los puntos marcados en AR con una línea recta tal cual se
   marcaron; cualquier imprecisión de la mano al trazar sale como una diagonal en el render.
3. **Varios tubos/bandejas en paralelo siguiendo el mismo recorrido** (`ref-01-...jpg`: 4-5
   tubos rígidos juntos, mismo camino, mismos giros, separación regular). Hoy `_replInstal3D`
   solo dibuja UN elemento por trazado.
4. **Modo de superficie forzada + editar un punto ya colocado** (Adrián, 18/09/2026, probando en
   obra: "la bandeja no detecta el techo... baja por debajo de instalaciones y eso no es así").
   Propuesta suya, con sentido: en vez de fiarse frame a frame de lo que detecta ARCore (que
   puede fallar puntualmente y hacer que un punto "caiga" a una altura/plano equivocado, p. ej.
   por debajo de una instalación ya existente), declarar explícitamente la superficie de un
   tramo — Techo / Pared / Suelo — y a partir de ahí FORZAR todos los puntos siguientes a esa
   misma altura/plano (tomada del primer punto confirmado o del plano real detectado en ese
   momento), aunque el hit-test de un frame concreto dé un dato raro. Además, poder tocar
   cualquier punto YA colocado (no solo el último) y aplicarle una acción contextual — "pegar a
   techo", "esquivar instalación", mover, borrar — para corregir sobre la marcha sin rehacer el
   trazado entero. Encaja con el punto 1 (pegado a la superficie real) pero es un mecanismo
   distinto: fijar una restricción explícita en vez de mejorar la estimación automática.

## Revisión nativa del 30/09

La APK 1.15 instalada carecía de #322 y su respaldo de profundidad no hacía el snap
a planos confirmados. La actualización 1.16 aborda ese desfase sin editar la PWA;
ver [pruebas y límites](../android-ar-estabilidad.md). Incluye selección de tipo de
superficie, pero no implementa aún bloqueo de un plano para todo el tramo ni edición
de cualquier punto de la prioridad 4. Validación física final pendiente por ADB offline.

## Prioridades 2-4 + giro de pantalla — implementado el 03/10 (rama feat/replanteo-ar-giro-y-prioridades)

Todo en `repl3d.js` (copia exacta en `assets/ar/`), así que vale a la vez para la vista 3D, el
informe (index.html y panel.html), el AR WebXR y el AR nativo. **SIN VERIFICAR EN VIVO** con un
móvil ARCore real moviéndose: solo pruebas Node/Java y arranque/giro en el emulador ARCore.

- **Ángulo recto (P2)**: `_replOrtogonalizar` usa las normales guardadas por punto. Pared→techo:
  sube perpendicular a la arista, gira en ella y sigue por el techo; desplazamiento a lo largo de
  la arista → la recorre; desvío ≤ 12 cm y < 25° → imprecisión, se endereza. En pared el tramo
  horizontal va por arriba; en techo/suelo usa los ejes de una pared del trazado (sin pared no
  inventa orientación). El trazado guardado no cambia: se rectifica al pintar y medir.
  Diagonal real por tramo: `puntos_3d[i].d = 1` (chips "📐 Tramos" del editor, panel ✏️ del AR).
  La longitud AR guardada es la del recorrido rectificado. El codo queda a 3 cm de las DOS
  superficies (vuelo por vértice, no por tramo).
- **Paralelas (P3)**: `trazado_json.paralelos = { n, hueco_m }` (1-8, hueco 0-20 cm), con
  inglete en cada codo. El servidor multiplica TODO el material por n (**PENDIENTE de decidir**
  si en obra comparten soporte y hay que descontarlo).
- **Superficie forzada (P4)**: Techo/Pared/Suelo por tramo; el primer punto confirmado (o un
  📱 Tocar) fija el plano y los siguientes se cortan con él por el rayo de la cámara, aunque la
  profundidad caiga sobre una instalación existente o no haya dato.
- **Editar cualquier punto (P4)**: tocarlo en pantalla (o ✏️ y ◀ ▶): pegar a techo/pared (plano
  detectado ≤ 1,5 m), mover al anillo, esquivar instalación de la IA (se aparta sobre su
  superficie), diagonal/recto, borrar.
- **Giro vertical↔horizontal**: PWA desbloquea la orientación durante la sesión inmersiva,
  reajusta el destino XR de three.js si cambia el búfer y compacta los paneles (CSS horizontal);
  si Chrome cierra la sesión sola con ≥ 2 puntos, el trazado pasa al editor. APK: la Activity no
  se recrea (configChanges), insets laterales y panel ✥ con scroll.

Limitaciones: los codos que añade el ángulo recto entre pared y techo no se cuentan en el
material (el servidor cuenta giros en la planta 2D); la caja automática en el cambio de plano
sigue sin decidir (abajo).

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
mantiene 100% manual. Sin decidir todavía — prioridades 2–4 no implementadas, es contexto
para cuando se aborde la tarea completa.

## Alcance

Cambio de más calado en el motor de geometría compartido (`repl3d.js`): afecta a la vez a la
vista 3D, el informe imprimible, el AR nativo (APK) y el AR WebXR (PWA). No abordar sin poder
probar en vivo en un dispositivo con ARCore (ver `TASKS.md`).
