# ADR-0024 — Replanteo asistido por cámara (foto primero, AR después)

- Identificador: ADR-0024
- Fecha: 2026-09-04
- Estado: **Propuesto** — redactado tras la decisión verbal de Adrián de 2026-09-04
  («adelante, el catálogo de arranque vale y solo encargados»). Aceptarlo formalmente sigue
  siendo decisión humana (ADR-0007).
- Decisores: Director del Proyecto
- Depende de: ADR-0006 (niveles de riesgo), ADR-0007 (autonomía), ADR-0011 (migraciones por
  vertical), DEPT-01 (aislamiento por departamento)
- Relacionado con: F-3.2 del `MASTER_ROADMAP.md` (ingeniería técnica y planos estructurados)

## Contexto

Adrián pidió una herramienta de **replanteo** dentro de la app móvil: apuntar con la cámara al
techo o a la pared, marcar por dónde va a ir una instalación (bandeja, tubo, canal, tubería,
conducto…), verla "puesta" sobre la imagen real y obtener **la lista de material** necesaria.
Debe ser una pestaña común, «Replanteo», accesible desde cualquier departamento, con el
catálogo de elementos **especializado por departamento**. Solo los **encargados** (y roles
superiores) replantean. Además, el trazado debe poder **sortear instalaciones existentes**:
pasar por debajo, esquivar, o **sujetarse a la instalación existente** en lugar de anclarse
al techo, y esas decisiones cambian el material (codos, tramo extra, abrazaderas en vez de
anclajes).

Restricciones reales del proyecto:

- La app es una PWA (`index.html`). La cámara ya se usa para leer QR (`getUserMedia` +
  `jsQR`), así que el permiso y el flujo de cámara están resueltos; no existe nada de
  seguimiento espacial.
- La mayoría de los encargados usa **Android**. La realidad aumentada con anclaje real
  (WebXR `immersive-ar`, hit-test, depth sensing) está disponible en Chrome Android sobre
  ARCore; en iPhone Safari históricamente no. Es un dato a verificar en dispositivo real
  antes de comprometer la fase AR.
- Regla DEPT-01: ningún departamento ve datos de otro, filtrado en el backend.
- ADR-0011: cada vertical nuevo trae su migración versionada; el DDL en caliente
  (`CREATE TABLE IF NOT EXISTS` al primer uso) es el patrón que todavía usan los verticales
  recientes (Sondas CPD, agosto 2026) para no bloquear la funcionalidad en la aplicación
  manual de la migración. Se reutiliza ese patrón y se deja constancia.

## Decisión

### 1. Una pestaña «Replanteo» común, con catálogo por departamento

- Tarjeta `cardReplanteo` en el home de los departamentos de plantilla `trade`
  (`_DEPTS_CATALOG`), gobernada por la misma configuración de submódulos que las demás
  (`_HOME_TRADE_MODS` en `index.html` y `panel.html`). Oculta a `operario`.
- El catálogo de elementos replanteables se sirve **por departamento** desde el backend
  (`GET /replanteos/catalogo`). Catálogo de arranque (aprobado como base por Adrián):

  | Departamento | Elementos |
  |---|---|
  | Eléctrico | bandeja de rejilla, bandeja de chapa, tubo rígido, tubo corrugado, canal PVC, cable |
  | Telecomunicaciones | bandeja de rejilla, tubo rígido, canaleta, cable UTP / fibra |
  | Mecánicas | tubería (cobre / PPR / multicapa), conducto de clima |
  | Control | cableado de sondas, canal PVC, tubo corrugado |
  | Resto de oficios | medición lineal genérica (tramos, uniones y soportes configurables) |

  Cada elemento lleva sus **reglas de cálculo** (longitud de tramo comercial, uniones por
  tramo, distancia entre soportes, codos por giro, tornillería por soporte, desperdicio).
  Las reglas de arranque son **provisionales** y están marcadas como tal en el código; el
  ajuste con fichas reales de fabricante queda como tarea posterior. Viven en una constante
  del backend (`REPLANTEO_CATALOGO_BASE`) y pueden sobreescribirse por empresa en la tabla
  `replanteo_catalogo` (fase 2, editable desde el panel).

### 2. Un único modelo de replanteo, independiente de cómo se capture

Tabla `replanteos` (`migrate_replanteos.sql`): empresa, obra, departamento, título, elemento
elegido (clave + parámetros: ancho, diámetro…), foto en R2, dimensiones de la foto, escala
(píxeles por metro), **trazado** en JSON (puntos sobre la foto en píxeles naturales +
obstáculos), longitud total, **lista de material** en JSON, estado
(`borrador` → `calculado` → `pedido`), pedido vinculado, autor y fechas.

Cada obstáculo del trazado lleva `tipo` (tubería, conducto, bandeja existente, viga, otro),
`accion` (`debajo` | `esquivar` | `sujetar`) y `dimension_m`. La acción altera el cálculo:

- `debajo`: añade bajada + subida (2 × dimensión) a la longitud y dos codos verticales.
- `esquivar`: añade el desvío lateral (2 × dimensión) y dos codos horizontales.
- `sujetar`: no añade longitud; los soportes de ese tramo pasan a una línea aparte
  «soporte a instalación existente / abrazadera» en vez de anclaje a techo.

La fase AR producirá **el mismo trazado** (puntos en metros proyectados a una captura), de
modo que lista de material, PDF, pedido y consulta de Alejandra se construyen una sola vez.

### 3. El cálculo de material vive solo en el backend

`POST /replanteos/calcular` (sin estado) devuelve la lista a partir de trazado + escala +
elemento; al guardar (`POST`/`PATCH /replanteos`) el servidor **recalcula** y persiste. El
frontend no duplica reglas de negocio (`AGENTS.md`): pide el cálculo con un pequeño retardo
cuando cambia el trazado. Evita que dos clientes (app, panel, futura AR) diverjan.

### 4. Dos fases, la segunda condicionada a una prueba en dispositivo real

- **Fase 1 (esta entrega): replanteo sobre foto.** Foto de la zona, marcar el recorrido con
  el dedo, fijar la escala con una referencia conocida (dos toques + distancia real) o con
  la longitud total conocida, marcar obstáculos con su acción, cálculo, PDF y «Enviar a
  Pedidos» (una línea de pedido por material, `referencia = REPL-<id>`). Funciona en
  cualquier móvil.
- **Fase 2: AR en Android.** Prototipo WebXR (`immersive-ar` + hit-test) en un Android real
  de la plantilla con un tramo largo (~30 m) para medir la deriva del seguimiento. La
  detección automática de obstáculos usa el sensor de profundidad (depth sensing) solo como
  **aviso** («hay algo cruzando el recorrido a X cm»); identificar qué es sigue siendo del
  encargado. Si la deriva no es aceptable, el AR queda para tramos cortos y medición, y la
  foto para el conjunto. Abre su propia tarea y, si cambia el modelo, una enmienda a este ADR.

### 5. Permisos

- Ver: cualquier usuario de la empresa que no sea `operario`, limitado a su departamento
  (los privilegiados de DEPT-01 ven todos).
- Crear, editar, calcular, enviar a pedidos y borrar: `encargado`, `jefe_de_obra`,
  `empresa_admin`, `superadmin`, `desarrollador`. `oficina` solo lectura en esta fase.
- Todo endpoint pasa por `getAuth` y filtra por `empresa_id` y `departamento`.

### Qué no resuelve

- No mide solo: en fase 1 la escala la aporta el encargado.
- No reconoce elementos existentes por visión artificial.
- No edita el catálogo desde el panel (fase 2) ni muestra los replanteos en `panel.html`
  (pendiente, pequeño).
- No sustituye a un plano de ingeniería ni a la medición certificada.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Solo AR en vivo desde el principio | Descartada como primera entrega: excluye iPhone, la deriva a 30 m no está probada y el valor real (material + pedido) no depende del AR. |
| Superposición sobre la cámara en vivo sin seguimiento | Descartada: vistosa en demo, inútil en cuanto se mueve el móvil. |
| App nativa (ARCore/ARKit) | Descartada: rompe el modelo PWA único, duplica frontends y despliegues. |
| Cálculo de material en el frontend | Descartada: duplicaría reglas de negocio en tres clientes (`AGENTS.md`). |
| Reglas de cálculo fijas en código | Elegida como **arranque**, con tabla de sobreescritura por empresa prevista, para no bloquear la fase 1 en una migración y un editor. |

## Consecuencias

- **Beneficio:** el encargado obtiene en obra lista de material y pedido con una foto; el
  mismo modelo alimenta AR, PDF y a Alejandra (`replanteos` entra en la allowlist de
  `consultar_bd` del agente).
- **Coste:** una tabla nueva (`replanteos`, aditiva) y fotos en R2 bajo
  `e<empresa>/replanteo/<obra>/`. Borrar un replanteo borra su foto de R2, igual que en
  Sondas CPD; lo ejecuta el usuario desde su propia pantalla.
- **Riesgo:** cantidades erróneas por reglas de arranque provisionales. Mitigación: la lista
  muestra las reglas aplicadas y el PDF las imprime; ajuste con fichas reales como tarea.
- **Seguridad:** rutas nuevas con `getAuth`, filtro de empresa y departamento, subida
  limitada a imágenes ≤ 20 MB; el script `inventario-rutas.js --check` las verifica en CI.
- **Pruebas:** sintaxis de Workers, tests del agente, comprobación de versión, verificación
  manual en la app publicada con la empresa demo.
- **Operación:** la migración `migrate_replanteos.sql` se aplica cuando Adrián autorice; hasta
  entonces el vertical crea su tabla al primer uso (patrón CPD), sin bloquear.

## Referencias

- `migrate_replanteos.sql`, rutas `/replanteos*` en `worker.js`, pantalla `screenReplanteo` en
  `index.html`.
- Precedente de módulo con foto + elementos sobre imagen: Sondas CPD (`migrate_cpd_sondas.sql`).
- ADR-0007 (autonomía), ADR-0011 (migraciones por vertical), `MASTER_ROADMAP.md` F-3.2.
