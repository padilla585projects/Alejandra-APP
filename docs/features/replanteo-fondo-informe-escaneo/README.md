# Idea pendiente — el informe 3D de un replanteo AR sale "flotando en el aire"

Estado: **sin implementar, sin ADR, planificar aparte** (decisión explícita de Adrián,
18/09/2026 noche — ver `TASKS.md`). No confundir con
`docs/features/replanteo-instalacion-realista/README.md` (esa es sobre que la instalación
quede PEGADA a la pared en el AR en vivo; esta es sobre el FONDO del informe imprimible).

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
