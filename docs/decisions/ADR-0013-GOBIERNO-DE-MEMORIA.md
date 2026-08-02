# ADR-0013 — Gobierno de memoria

- Identificador: ADR-0013
- Fecha: 2026-08-02
- Estado: **Propuesto**
- Decisores: `PENDIENTE` (Director del Proyecto)
- Resuelve: ARC-002
- Desbloquea: activación del componente `Memory` en `nucleo-cognitivo/` (fuera del esqueleto actual de F-1.2)

## Contexto

`ARCHITECT_BACKLOG.md` (ARC-002) bloquea explícitamente que `nucleo-cognitivo/` active un
componente `Memory` de memoria persistente: *"Definir privacidad, tenant, procedencia,
confianza, caducidad, corrección y borrado. Requiere ADR y compliance."* El esqueleto
construido en F-1.2 (autorizado por ADR-0004) respeta ese bloqueo de forma literal:
`nucleo-cognitivo/README.md` dice *"No se construye ni como interfaz para no sugerir que el
diseño de privacidad ya existe"*, y `nucleo-cognitivo/src/index.js` no exporta ningún módulo
de memoria.

Lo único que existe hoy es **Estado Cognitivo** (`nucleo-cognitivo/src/estado-cognitivo.js`),
que es deliberadamente lo contrario de memoria: vive en memoria de proceso, se descarta con
la tarea, y su propio comentario de cabecera dice *"No responsabilidad: ser memoria
persistente ni fuente de verdad"* y *"esto es lo que permite construirlo ya, sin esperar a
ARC-002 [...] no hay nada aquí que gobernar porque no persiste"*. Cualquier decisión de este
ADR que reintroduzca persistencia en Estado Cognitivo estaría deshaciendo esa premisa de
diseño; por eso este ADR trata Estado Cognitivo y Memory como dos contratos distintos y no
propone fusionarlos.

`04-MOTOR-DE-DECISION.md` ya asume que Memory existe como concepto: la salida
`consultar_memoria` es una de las 11 salidas controladas del Motor de Decisión, y su tabla de
rutas de decisión dice *"Recuerdo autorizado, vigente y relevante → Consultar memoria con
procedencia y confianza"*. Es decir, la arquitectura objetivo ya exige que un recuerdo
recuperado traiga procedencia y confianza como propiedades de primera clase, no como
metadato opcional. Este ADR tiene que producir un contrato que satisfaga esa exigencia antes
de que Memory pueda existir como código.

**Restricciones que ya operan sobre cualquier propuesta:**

- **Aislamiento por tenant.** Todo el resto de la app opera con `empresa_id` como frontera de
  acceso (roles en `CLAUDE.md`: `superadmin` cruza empresas, el resto no). ARC-016 (corregido
  el 2026-08-02) fue justamente un incidente de fuga de `empresa_id` en el chat anónimo del
  agente — un componente de memoria mal aislado sería la misma clase de fallo con datos que,
  además, persisten.
- **El esquema real de D1 no está gobernado por migraciones versionadas** (ARC-011,
  `CLAUDE.md` sección "Esquema de base de datos"). Cualquier tabla nueva para memoria debe
  pasar por el migrador único de ADR-0011 (empezando por el vertical `checklists`, ver
  ADR-0011), no por un `CREATE TABLE IF NOT EXISTS` más en caliente en `worker.js` o
  `alejandra-agente/worker.js` — eso repetiría exactamente el patrón que ARC-011/ARC-013
  identificó como causa raíz de columnas y tablas silenciosamente ausentes o divergentes.
- **RGPD ya es una preocupación activa del proyecto**, no hipotética: ARC-012 (resuelto el
  2026-08-02) restauró `empresas.retencion_config`, que estaba inoperante desde su creación
  porque la columna nunca llegó a existir en producción (`ALTER TABLE` silenciado con
  `.catch(() => {})`). Una propuesta de memoria persistente que no defina retención y borrado
  con el mismo nivel de detalle repetiría ese incidente, esta vez sobre un componente nuevo en
  lugar de uno ya en producción.
- **Regla de los dos cerebros** (`CLAUDE.md`): si Memory llega a activarse, la pregunta "¿esto
  aplica también al otro cerebro?" se vuelve obligatoria en cualquier PR de implementación,
  porque `worker.js` y `alejandra-agente/worker.js` son código separado que comparte la misma
  D1.
- **Decisiones sin trazabilidad suficiente.** `nucleo-cognitivo/src/motor-decision.js` exige
  que toda decisión traiga `evidencia` y `confianza` entre sus campos de traza obligatorios
  (`CAMPOS_TRAZA_OBLIGATORIOS`), pero esa persistencia/consulta real de trazas depende de
  ARC-008, que sigue abierto y que otro ADR está resolviendo en paralelo. Este ADR no
  resuelve ARC-008; solo asume que, cuando exista, un recuerdo consultado deberá poder
  aparecer como parte de la `evidencia` de una decisión trazada. Se referencia como
  dependencia, no se duplica aquí.

## Qué es "memoria" en este contexto (y qué no es)

Para evitar la ambigüedad que ya causó que Estado Cognitivo tuviera que aclarar en su propia
cabecera que no es memoria, este ADR fija la distinción de forma explícita:

| | Estado Cognitivo (ya implementado) | Memory (lo que este ADR propone) |
|---|---|---|
| Ciclo de vida | Una tarea. Se crea con `crearEstadoCognitivo` y se descarta al terminar. | Cruza tareas, sesiones y, si se autoriza, cruza incluso conversaciones distintas del mismo usuario/empresa. |
| Almacenamiento | Memoria de proceso (objeto JS). No toca D1, R2 ni disco. | Persistente, en D1, acotado por tenant. |
| Contenido | Fase, riesgo, plan, evidencias y confianza **de la tarea en curso**. | Hechos, preferencias, correcciones o resúmenes que se consideran útiles **más allá** de la tarea en la que se originaron. |
| Gobierno | Ninguno necesario — no hay nada que gobernar porque no persiste (su propio diseño lo dice). | Exactamente lo que ARC-002 pide: privacidad, tenant, procedencia, confianza, caducidad, corrección, borrado. |
| Consumidor en el Motor de Decisión | Entrada implícita de cada paso del ciclo. | Salida controlada explícita: `consultar_memoria` (una de las 11 de `SALIDAS_VALIDAS` en `motor-decision.js`). |

Memory, tal como lo define este ADR, es **memoria semántica de largo plazo sobre una
empresa/tenant**: hechos operativos que vale la pena recordar entre tareas (p. ej. "el
almacén B siempre tiene el código de obra distinto al de fábrica" o una corrección que un
`encargado` hizo sobre una respuesta previa de Alejandra). No es historial de chat en bruto
(eso ya existe hoy, sin este ADR, en las tablas de conversación) ni es un caché de
rendimiento. Un dato de memoria que no sobrevive a una revisión de "¿por qué seguimos
recordando esto y desde cuándo?" no debería estar en Memory.

## Decisión

Se propone un contrato de Memory con siete elementos obligatorios. Esta decisión fija el
contrato y los principios; **no fija el esquema SQL final ni activa código** — eso requiere,
además de la aceptación de este ADR, pasar por el migrador único de ADR-0011 y la
autorización de migración contra D1 que `CLAUDE.md` exige para cualquier cambio de esquema.

### 1. Privacidad — por defecto, nada se recuerda

Memory es **opt-in por tipo de dato, no opt-out**. Ningún dato pasa a memoria persistente
solo por haber aparecido en una conversación o en una tool. Se propone una lista blanca
explícita de categorías de recuerdo permitidas (empezando deliberadamente estrecha: hechos
operativos declarados como "recordar esto" por un usuario con rol `encargado` o superior, y
correcciones explícitas sobre respuestas previas de Alejandra), y todo lo que no encaje en la
lista blanca no se persiste, aunque el modelo lo considere relevante. Esto invierte la carga
de la prueba respecto a cómo funciona hoy el historial de chat (que sí guarda todo por
defecto): Memory es un componente nuevo y no hereda ese comportamiento.

Dato explícitamente excluido de la lista blanca inicial: cualquier campo que ya se trate como
sensible en otras partes del sistema (nóminas, datos médicos de incidencias, DNI/NIF), aunque
aparezca de forma incidental en una conversación. Ampliar la lista blanca es una decisión de
ADR posterior o enmienda de este, no una que Memory pueda tomar por sí sola.

### 2. Aislamiento por tenant (empresa)

Todo registro de Memory lleva `empresa_id` obligatorio, no nulo, y toda consulta de Memory
está acotada por el `empresa_id` de la sesión que pregunta — el mismo principio que ya rige
el resto de la app y que ARC-016 demostró que puede fallar si no se aplica en cada punto de
entrada, no solo en la mayoría. `consultar_memoria` en el Motor de Decisión debe recibir la
identidad/tenant como parte obligatoria de su entrada, igual que ya lo exige
`04-MOTOR-DE-DECISION.md` para el resto de las salidas ("Entradas: [...] identidad/sesión").

Un recuerdo nunca cruza de una empresa a otra, incluida la sesión `superadmin`: si un
`superadmin` consulta memoria mientras opera sobre la empresa A, solo debe ver memoria de la
empresa A, igual que ya ocurre con el resto de sus vistas acotadas por la empresa elegida.
Esto es más estricto que el resto del sistema de roles (donde `superadmin` puede *elegir*
cruzar de empresa cambiando de contexto) porque un recuerdo mal aislado no se puede
deshacer una vez visto — mismo criterio de reversibilidad que ya usa ADR-0006 para clasificar
riesgo.

### 3. Procedencia del dato

Todo recuerdo declara de dónde salió, con al menos estos campos:

- `origen`: quién o qué lo generó — un `usuario_id` concreto, `system` (derivado
  automáticamente, p. ej. de un patrón repetido), o una tool.
- `tarea_id` o `conversacion_id` de origen, cuando exista, para poder rastrear el recuerdo
  hasta la interacción que lo produjo.
- `fecha_creacion`.
- `metodo`: `declarado` (un usuario pidió explícitamente "recuerda esto"),
  `corregido` (nació de una corrección sobre algo que Alejandra dijo mal) o `inferido`
  (el sistema lo dedujo de un patrón; requiere confianza inicial más baja, ver punto 4).

Un recuerdo `inferido` sin `origen` rastreable no debería persistir — es exactamente el tipo
de "decisión sin trazabilidad suficiente" que `motor-decision.js` ya está diseñado para
rechazar en el resto del ciclo.

### 4. Confianza

Cada recuerdo tiene una `confianza` explícita en el mismo sentido que ya usa el Motor de
Decisión (campo de traza obligatorio en `CAMPOS_TRAZA_OBLIGATORIOS`), no un número
inventado ad hoc para Memory. Se propone:

- Recuerdos `declarado` o `corregido` por un humano con rol `encargado` o superior: confianza
  alta por defecto.
- Recuerdos `inferido`: confianza media o baja, y deben poder degradarse (nunca subir solo
  por repetirse sin verificación — repetición no es lo mismo que confirmación).
- La confianza de un recuerdo consultado se propaga como parte de la `evidencia` de la
  decisión que lo usa; `tieneTrazaSuficiente()` en `motor-decision.js` ya exige que
  `confianza` y `evidencia` estén presentes, así que Memory no introduce un campo nuevo, sino
  que alimenta uno que el contrato del Motor de Decisión ya declaró obligatorio.

### 5. Caducidad

Todo recuerdo lleva `caduca_en` (nunca `NULL` indefinido por defecto — indefinido debe ser
una elección explícita, no la ausencia de una). Se propone una caducidad por defecto corta
(orden de meses, a definir por el Director al aceptar) salvo que un humano la extienda
explícitamente al declarar el recuerdo. Un recuerdo caducado no se borra automáticamente de
inmediato (para permitir auditoría/recuperación en la ventana de retención general de la
empresa, ver punto 6), pero deja de ser consultable por `consultar_memoria` desde su fecha de
caducidad.

Esto es deliberadamente más conservador que `empresas.retencion_config` (que hoy solo cubre
retención general de datos operativos): la caducidad de Memory es más corta porque un
recuerdo mal fundado que seguimos usando activamente es peor que un dato operativo antiguo
que simplemente ya no se consulta.

### 6. Corrección y rectificación

Un recuerdo nunca se sobrescribe en el sitio (`UPDATE` destructivo sobre el contenido). Se
versiona: corregir un recuerdo crea una nueva versión con `version_anterior_id` apuntando a
la versión sustituida, y la versión anterior queda marcada `sustituido`, no borrada, salvo que
el usuario pida explícitamente el borrado (punto 7). Esto:

- Da a cualquier usuario un derecho de rectificación operativo (RGPD art. 16) sin perder la
  trazabilidad de que existió una versión anterior y por qué cambió.
- Evita que una corrección se pierda si dos correcciones llegan casi a la vez — el patrón ya
  usado implícitamente por el propio Estado Cognitivo, que también trata sus cambios como
  "un nuevo valor, no una mutación" (`actualizarEstadoCognitivo` documenta explícitamente que
  "no muta el original").

### 7. Borrado (alineado con RGPD)

Se distinguen dos vías, con la misma barrera que el resto del sistema ya usa para lo
irreversible:

- **Borrado por caducidad/retención general**: automatizable, pero sujeto a la misma barrera
  `CONFIRMO BORRADO` (SEC-08/SEC-09) si el volumen o el alcance lo justifica según ADR-0006 —
  un borrado masivo de recuerdos es N2 como mínimo, nunca una operación silenciosa de fondo.
- **Borrado por derecho de supresión (RGPD art. 17, "derecho al olvido")**: un trabajador o
  empresa puede pedir el borrado de lo que Memory tiene sobre él/ella. Este borrado es
  **inmediato y real** (no un "sustituido" versionado como en el punto 6) precisamente porque
  el derecho de supresión existe para dejar de existir, no para quedar archivado con otro
  nombre. Debe quedar registrado *que* se ejecutó un borrado por derecho de supresión (fecha,
  alcance, quién lo solicitó) sin registrar *el contenido borrado* — el mismo patrón que ya
  usa el proyecto para no reconstruir accidentalmente lo que se pidió eliminar.
- Ninguna de las dos vías es responsabilidad del propio agente Alejandra en autonomía: borrar
  memoria sobre datos reales de personas cae bajo "Borrado en R2" / "`DELETE` masivo" del
  criterio ya vigente en `CLAUDE.md` — requiere decisión humana porque no hay vuelta atrás
  razonable, con la única precisión de que aquí la "vuelta atrás razonable" para el derecho de
  supresión es, por diseño, que no la haya.

### 8. Contrato que necesitaría `nucleo-cognitivo/` para consumir Memory

Cuando (y solo cuando) este ADR se acepte y su esquema pase por el migrador único de
ADR-0011, `nucleo-cognitivo/` necesitaría un módulo `memory.js` con una forma equivalente a
la de `policy-engine.js` (función pura, sin acceso directo a D1 desde el núcleo cognitivo, tal
como ya hace `context-engine.js` al declararse "interfaz" en vez de implementar acceso real):

- `consultarMemoria({ empresaId, consulta, filtros })` → lista de recuerdos, cada uno con
  `contenido`, `origen`, `confianza`, `fecha_creacion`, `caduca_en` — es decir, exactamente lo
  que la salida `consultar_memoria` del Motor de Decisión necesita para alimentar `evidencia`
  y `confianza` en `tieneTrazaSuficiente()`.
- Ningún recuerdo devuelto sin `confianza` explícita — un recuerdo sin confianza no debe poder
  usarse como evidencia, por la misma razón que hoy una decisión sin `evidencia` no puede
  considerarse trazada.
- El módulo debe fallar igual que las interfaces actuales (lanzar error explícito, no un stub
  silencioso) mientras la persistencia real no exista — coherente con el criterio que
  `nucleo-cognitivo/README.md` ya documenta para `context-engine.js` y `planner.js`.
- Este contrato depende de que ARC-008 resuelva cómo se persisten y consultan trazas en
  general; hasta entonces, `consultar_memoria` puede recuperar el recuerdo pero la decisión
  que lo use seguiría sin trazabilidad suficiente en el sentido más amplio de ARC-008. Ese
  ADR hermano (en redacción paralela) es quien debe cerrar esa pieza; este ADR no la resuelve
  ni la da por resuelta.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| No construir Memory; dejar que el historial de chat existente haga ese papel | Descartada: el historial de chat no tiene caducidad, confianza, ni corrección — es log, no memoria gobernada. Reutilizarlo tal cual perpetuaría el problema que ARC-002 señala, solo que sin nombrarlo. |
| Memory opt-out (todo se recuerda salvo que se marque como privado) | Descartada: invierte la carga de la prueba en la dirección equivocada para datos de trabajadores reales; una empresa que nunca configura nada terminaría con memoria persistente por defecto sin haberlo decidido. |
| Persistencia en KV o R2 en vez de D1 | Descartada por ahora: rompería el aislamiento por tenant que ya se implementa con consultas acotadas por `empresa_id` en D1, y añadiría un tercer almacén al gobierno de memoria en vez de reutilizar el que ya tiene reglas de acceso por rol. No se descarta para siempre, pero requeriría su propio ADR si se propone. |
| Borrado siempre versionado (nunca destructivo, ni para el derecho de supresión) | Descartada: contradice el propósito del derecho de supresión RGPD; "sustituido pero conservado" no es borrado. |
| Un único nivel de confianza fijo para todo recuerdo, sin distinguir `declarado`/`corregido`/`inferido` | Descartada: perdería precisamente la señal que el Motor de Decisión necesita para decidir cuánto pesar un recuerdo frente a evidencia fresca. |

## Consecuencias

**Si se acepta:**

- ARC-002 queda cerrado en cuanto a diseño; queda abierta su implementación, que requiere
  además: (a) el esquema real pase por el migrador único de ADR-0011, (b) autorización
  explícita de migración contra D1 (`CLAUDE.md`), y (c) que ARC-008 avance lo suficiente para
  que un recuerdo consultado pueda aparecer con trazabilidad completa en una decisión.
- `nucleo-cognitivo/` puede empezar a construir `memory.js` como interfaz (igual que
  `context-engine.js` y `planner.js` hoy), sin que eso implique tráfico real ni datos reales
  todavía — el mismo patrón de "esqueleto sin activación" que F-1.2 ya usó.
- La regla de los dos cerebros aplica desde el primer código real: cualquier implementación de
  escritura o lectura de Memory en `alejandra-agente/worker.js` o `worker.js` debe decidir
  conscientemente si también aplica al otro, no solo a uno.
- Aparece trabajo de compliance no trivial: hay que decidir el plazo exacto de caducidad por
  defecto y el procedimiento operativo del derecho de supresión (a quién se le pide, cómo se
  verifica la identidad de quien lo pide), que este ADR deja como `PENDIENTE` para el Director.

**Si se rechaza o se pospone:** Memory sigue fuera del esqueleto de `nucleo-cognitivo/`
indefinidamente, `consultar_memoria` sigue siendo una salida declarada pero inalcanzable del
Motor de Decisión, y el sistema sigue dependiendo únicamente del historial de chat sin
gobierno como sustituto de facto de memoria — que es el statu quo actual, sin cambio de
riesgo en ninguna dirección.

## Preguntas que solo el Director puede responder

1. **¿Se acepta la lista blanca opt-in de categorías de recuerdo** (punto 1), o se prefiere un
   criterio distinto para decidir qué entra en Memory?
2. **¿Qué plazo de caducidad por defecto es razonable** para un recuerdo `inferido` frente a
   uno `declarado`/`corregido`? Este ADR propone "orden de meses" pero no fija un número.
3. **¿Quién puede declarar memoria** — cualquier usuario sobre sus propios datos, o hace falta
   `encargado` hacia arriba, igual que N2 en ADR-0006?
4. **¿El derecho de supresión (punto 7) requiere verificación de identidad adicional**, o basta
   con el rol/sesión ya autenticada del sistema?
5. **¿Se acepta que Memory dependa de D1 y del migrador único de ADR-0011**, o se prefiere
   evaluar un almacén separado antes de construir nada?

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-002, ARC-008, ARC-011, ARC-012, ARC-016
- `docs/architecture/04-MOTOR-DE-DECISION.md` — salida `consultar_memoria`, campos de traza
- `nucleo-cognitivo/README.md` y `nucleo-cognitivo/src/estado-cognitivo.js` — por qué Estado
  Cognitivo no es memoria y no depende de este ADR
- `nucleo-cognitivo/src/motor-decision.js` — `CAMPOS_TRAZA_OBLIGATORIOS`,
  `tieneTrazaSuficiente()`
- `docs/decisions/ADR-0002-NUCLEO-COGNITIVO-V1.md` — Memory como componente del contrato
  cognitivo objetivo
- `docs/decisions/ADR-0004-MOTOR-DE-DECISION-Y-MODOS.md` — arquitectura objetivo que asume
  Memory
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md` — niveles N0–N3 usados para
  clasificar quién declara/borra memoria
- `docs/decisions/ADR-0011-MIGRADOR-UNICO-Y-RETIRADA-DDL-RUNTIME.md` — vía obligatoria para
  cualquier esquema nuevo de Memory
- `migrate_empresas_retencion.sql` — precedente de retención RGPD ya en producción
- `CLAUDE.md` — "Esquema de base de datos (deuda conocida)", "UNA Alejandra, DOS cerebros",
  "Qué requiere decisión humana"
- ARC-008 — dependencia pendiente, ADR hermano en redacción paralela sobre trazabilidad
