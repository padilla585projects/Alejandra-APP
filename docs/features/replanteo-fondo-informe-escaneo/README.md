# Idea pendiente — escaneo del entorno + IA en tiempo real para el AR del Replanteo

Estado: **sin implementar, sin ADR, planificar aparte** (decisión explícita de Adrián,
18/09/2026 noche — ver `TASKS.md`). No confundir con
`docs/features/replanteo-instalacion-realista/README.md` (esa es sobre que la instalación
quede PEGADA a la pared en el AR en vivo con lo que WebXR ya detecta; esta es sobre añadir un
escaneo previo asistido por IA que mejore esa detección de base, y de paso resuelve también el
fondo del informe).

## La visión completa de Adrián (18/09/2026, noche)

Ampliada en la misma sesión, en sus palabras: al abrir el Replanteo en modo AR debería salir
**un cartel pidiendo "escanea el entorno" ANTES de poder marcar puntos** — solo cuando la app
detecta que el escaneo está hecho, aparecen los controles para marcar la instalación. Ese
escaneo no es solo para tener una foto de fondo bonita: **también debe servir para que el AR
sepa identificar qué es pared, qué es suelo, qué es techo y qué son instalaciones ya
existentes** (más allá de la clasificación geométrica actual de `frame.detectedPlanes`, que
solo distingue vertical/horizontal por altura, sin saber qué hay de verdad ahí). Lo escaneado
se pasaría por IA (visión) para que analice el entorno y devuelva esa información, y esa
información realimenta al AR **en tiempo real, mientras se sigue escaneando/marcando** —
"IA y AR trabajan juntos en tiempo real", no un análisis puntual al final como hace hoy "¿qué
es esto?" (`replArIdentificar()`, que el usuario dispara a mano sobre un solo punto).

## El problema original que lo disparó (fondo del informe)

## El problema

`_replImagen3DInforme()` (`index.html`) ya renderiza la instalación 3D sobre la foto real del
sitio cuando el replanteo viene del modo **Foto** (`REPL-INFORME-3D-02`, 17/09/2026, ya
resuelto). Pero un replanteo hecho en **AR** no tiene ninguna foto real del entorno — solo un
plano cenital sintético generado por `_replArPlano()` (cuadrícula de 1 m sobre fondo negro, sin
relación visual con el sitio) — así que su informe cae al respaldo genérico: la instalación
sobre una rejilla blanca, "en el aire". Adrián, viendo el informe de una de sus pruebas de
hoy: "sigue saliendo con el fondo blanco en el aire, cuando dijimos de renderizarlo con el
fondo real del replanteo".

## La idea de Adrián

"Creo que una opción es escanear el entorno con la cámara y hacer un render mientras hacemos
el replanteo." — en vez de una sola foto, reconstruir el entorno real (paredes, techo, objetos
alrededor) a partir de lo que la cámara ve DURANTE la sesión AR, y usar eso como fondo del
informe (y potencialmente también de la vista "Ver en 3D").

Insistió en que no es un capricho de acabado: **"si no escaneamos el entorno no podemos hacer
el informe real de situación"** — una foto única (o ninguna) no basta para que el informe
muestre de verdad cómo queda la instalación en el sitio; hace falta el entorno reconstruido
para que el render sea representativo, no solo bonito.

## Lo que ya existe y se podría reutilizar

- WebXR con `camera-access` (ya pedido como `optionalFeature` en `replArIniciar()`) da acceso a
  frames reales de la cámara durante la sesión — ya se usa para "¿qué es esto?"
  (`_replArCapturaCamara()`, `replArIdentificar()`), que captura UN frame puntual y lo manda a
  visión por IA.
- `frame.detectedPlanes` (usado desde hoy para `PLANO-SNAP-01`) ya da la posición y normal de
  cada plano detectado — un punto de partida geométrico si se quisiera proyectar fotos sobre los
  planos reales en vez de solo mostrarlas planas.

## Por qué la versión "IA y AR en tiempo real" es aún más grande

- Requiere un **flujo nuevo de "fase de escaneo" obligatoria** antes de marcar puntos: pantalla/
  cartel de guía, detectar cuándo el escaneo es "suficiente" (¿cuántos frames? ¿cuánto se ha
  movido el móvil? ¿qué cobertura de la sala?), y solo entonces desbloquear el trazado.
- Requiere **llamadas a IA de visión en bucle mientras se escanea** (no una vez al final como
  "¿qué es esto?" hoy) -- implica latencia, coste por llamada, y decidir cada cuánto se manda un
  frame nuevo sin saturar la sesión ni al usuario.
- La realimentación "en tiempo real" al AR es la parte más incierta: hoy `frame.detectedPlanes`
  ya clasifica vertical/horizontal por geometría pura (sin IA) -- llevar la respuesta de un
  modelo de visión (que llega con latencia de red) hasta afectar el hit-test/snap de CADA frame
  (60 fps) no es trivial; más realista sería que la IA ajuste una vez por escaneo (p. ej. "esto
  de aquí es una bandeja existente, no la marques como pared") en vez de por frame.
- Sigue sin resolver por sí sola la fusión en un entorno coherente para el fondo del informe
  (ver alternativas de abajo) -- son dos problemas relacionados pero distintos: identificar QUÉ
  hay (pared/suelo/techo/instalación existente) y reconstruir CÓMO se ve (el fondo del render).

## Por qué es un cambio de más calado (no una tarea de hoy)

- Capturar frames sueltos es fácil (ya existe el mecanismo); **fusionarlos en un entorno
  coherente** (panorama, mosaico proyectado sobre los planos detectados, o una nube de puntos
  texturizada) es un problema bastante más grande — no hay nada parecido hoy en el código.
- Alternativas de complejidad creciente, sin decidir cuál:
  1. **Varias fotos sueltas** guardadas durante la sesión (como ya hace `fotosDoc` para
     documentación) y elegir/mostrar la más relevante como fondo — más simple, resultado más
     pobre (solo un ángulo).
  2. **Proyectar las fotos capturadas sobre los planos detectados** (`frame.detectedPlanes`) para
     un fondo más envolvente — bastante más trabajo de render.
  3. **Panorama/mosaico** cosiendo varios frames — la opción más completa y la más cara de
     construir bien (alineación, exposición, costuras).
- Afecta al mismo archivo compartido que las otras mejoras de hoy (`repl3d.js`/
  `_replImagen3DInforme()` en `index.html`) y a cómo se guarda un replanteo AR (¿un campo nuevo
  de "fondo"? ¿varias fotos? — decisión de esquema, aunque sea DDL en caliente, no migración).

## Alternativa descartada por Adrián (más simple, para referencia)

Capturar automáticamente **una sola foto** con `_replArCapturaCamara()` al terminar el AR —
mismo patrón que ya usa "¿qué es esto?", cambio pequeño y contenido (un campo nuevo en el
backend + usarla de fondo en el informe, igual que ya hace el modo Foto). Adrián la vio y
prefirió ir directamente a la opción de escanear el entorno completo, así que esta queda
descartada como pendiente propio, pero documentada aquí porque podría ser un primer paso
intermedio razonable si el escaneo completo se ve demasiado grande al planificarlo.

## Siguiente paso

Nada implementado todavía. Cuando se retome: decidir con Adrián cuál de las alternativas de
arriba (o la foto única simple) encaja mejor, y si merece su propio ADR dado que toca el
esquema de datos del replanteo.
