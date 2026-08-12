# ADR-0022 — Ayudantes: delegación acotada sobre el catálogo existente

- Identificador: ADR-0022
- Fecha: 2026-08-12
- Estado: **Aceptado** (2026-08-12)
- Decisores: Director del Proyecto

## Contexto

`ADR-0008` (2026-08-02) presentó tres interpretaciones de "Nexo" y el Director eligió la
interpretación A (capa de integración). La interpretación C —"coordinación multiagente"— quedó
**rechazada explícitamente** por prematura, remitida a `F-6.1 — Delegación y agentes
especializados` (`MASTER_ROADMAP.md`), que sigue `Pendiente`.

El 2026-08-12 el Director pidió retomar esa idea: que Alejandra actúe como coordinadora y delegue
trabajo en "ayudantes" especializados por flujo de trabajo (empezando por pedidos de material y
correo, con WhatsApp de empresa y una asesoría legal/financiera acotada como próximos pasos). La
sesión revisó dos proyectos externos del Director como referencia —Nexus Core/Agent y
GetawayAgentes— sin adoptar ninguno de los dos tal cual: GetawayAgentes resuelve delegación con un
gateway aparte (Durable Objects, registro y ciclo de vida de agentes, WebSocket), lo que
duplicaría el sistema de permisos que Alejandra ya tiene; Nexus Core aporta ideas puntuales
(rutinas programadas, reflexión periódica) pero también capacidades que contradicen el principio
de reversibilidad de `ADR-0007` (navegador interno, control de PC, modo Auto de encadenado
autónomo) y que no se adoptan.

Las razones que llevaron a rechazar la interpretación C en `ADR-0008` (Tool Registry sin migrar,
sin observabilidad) ya no aplican del todo: `F-1.3` (Tool Registry, ADR-0010) y `F-2.2` (Nexo v1,
ADR-0021) están cerradas; `F-4.1` (Observabilidad) está parcialmente adelantada vía
`registrarTraza()`/`GET /admin/trazas` (ADR-0014). El roadmap formal encadena `F-6.1` detrás de
`F-5.1` ("Skills, plugins, adaptadores y MCP gobernados"), que no ha empezado. `F-5.1` gobierna
instalar **capacidades externas nuevas** (plugins/MCP de terceros); lo que resuelve este ADR es
delegación sobre capacidades que **ya existen** en el catálogo de tools de `alejandra-agente`, así
que no depende de esa maquinaria. Se documenta como excepción razonada, no como salto silencioso.

Durante la sesión se descartó expresamente una variante de la idea original: leer el WhatsApp
**personal** de un empleado. El secreto de las comunicaciones (art. 18.3 CE) protege también a la
otra parte de cualquier conversación, que nunca da consentimiento a que Alejandra la lea, y el
art. 197 del Código Penal puede considerar delito la interceptación de comunicaciones sin
autorización de ambas partes. El Director confirmó que se trata del **WhatsApp de empresa** (una
línea de trabajo por usuario, distinta de la personal) — mismo fundamento que ya cubre el bot de
Telegram existente, donde el canal es de la empresa y todo el mundo sabe que Alejandra participa.

## Decisión

Se abre `F-6.1` con alcance acotado: un **ayudante** es una invocación explícita, hecha por
Alejandra dentro de una conversación ya autenticada, de un sub-agente con un system prompt propio
y un subconjunto **fijo y ya existente** del catálogo de tools de `alejandra-agente/worker.js`.
Nunca instala capacidades nuevas ni encadena pasos sin que Alejandra decida cada uno dentro de la
misma conversación (sin modo Auto).

Contrato de un ayudante:

1. **Mismas barreras N0-N3 que cualquier tool directa.** Cualquier tool que un ayudante invoque
   internamente pasa por `evaluarInvocacionCognitiva()` (Motor de Decisión, ADR-0020) exactamente
   igual que si Alejandra la llamara sin delegar. Un ayudante nunca genera ni satisface su propia
   confirmación humana — el código de confirmación (`CONFIRMO BORRADO`/`CONFIRMO
   MIGRACION`/futuro `CONFIRMO ENVIO`) debe salir del mensaje real del humano en la conversación.
2. **Misma traza (ADR-0014).** Cada delegación registra `tipo:'delegacion'` vía
   `registrarTraza()`, además de las trazas de decisión que ya generan las tools que use por
   dentro.
3. **Mismo aislamiento por `empresa_id`.** `empresa_id` se resuelve de la sesión
   (`resolverEid()`), nunca del input del modelo ni del ayudante.
4. **Metadato ADR-0010 completo** en cada tool nueva que un ayudante use, y alta en los `Set` de
   `alejandra-agente/lib.js` (la migración de ADR-0010 sigue siendo incremental).
5. **Alcance de Worker**: los ayudantes viven en `alejandra-agente/worker.js` (cara a usuarios
   reales de la app/panel), no en `worker.js` raíz (chat de desarrollo de Adrián). Decisión de
   alcance consciente, no un fix de seguridad sujeto a la regla de paridad de "dos cerebros".

Decisiones de producto que quedan fijadas para las fases siguientes (no implementadas en este
ADR, documentadas aquí para que guíen su diseño):

- **WhatsApp**: canal de empresa, una línea por usuario (no un número central). Requiere alta de
  cada línea en Meta Business y sus credenciales — secretos, solo el Director puede
  crearlos/gestionarlos, mismo criterio que `F-0.2-CFG`.
- **Correo**: bandeja de empresa por usuario (no una bandeja central), usando la columna
  `usuarios.email` ya existente como identificador. El login de la app sigue siendo por código,
  sin cambios — el email es un dato del usuario, nunca un credential de sesión.
- **Asesoría legal/financiera**: informa y redacta (extensión de Nexo v1, `ADR-0021`); ninguna
  acción que compromete a la empresa (pago, contrato, declaración) se ejecuta sin la confirmación
  humana que ya exige el nivel de riesgo correspondiente. No se crea un nivel de autonomía nuevo.

Primer entregable bajo este ADR: mecanismo de delegación genérico (tool `delegar_tarea` +
registro `AYUDANTES`) y el ayudante piloto **"Pedidos"**, sobre la tabla `pedidos` ya existente,
sin integraciones externas.

## Alternativas consideradas

| Alternativa | Motivo para elegir o descartar |
|---|---|
| Gateway multiagente aparte (patrón GetawayAgentes: Durable Objects, registro/ciclo de vida de agentes, WebSocket) | Descartada: duplica el Tool Registry, el Motor de Decisión y las trazas que ya existen; crea una segunda superficie de permisos que gobernar. |
| Adoptar capacidades de Nexus Agent sin filtrar (modo Auto, navegador interno, control de PC, MCP autoinstalable) | Descartada: son capacidades de un agente que opera el ordenador de un desarrollador; contradicen `ADR-0007` (reversibilidad) y el modelo N0-N3 ya construido. |
| Esperar a cerrar `F-5.1` antes de abrir `F-6.1` | Descartada para este alcance: `F-5.1` gobierna capacidades externas nuevas; delegar sobre el catálogo propio ya existente no depende de ella. Se revisará si una fase futura de ayudantes necesita instalar algo externo. |
| Delegación acotada dentro del sistema de permisos existente (elegida) | Reutiliza Tool Registry, Motor de Decisión, trazas y confirmación humana ya construidos; permite empezar por un piloto de bajo riesgo (Pedidos) antes de tocar integraciones externas (correo, WhatsApp). |

## Consecuencias

- Reabre parcialmente `ADR-0008` (interpretación C), con un alcance mucho más estrecho que el
  descartado en 2026-08-02: sin bandeja de tareas entre agentes, sin agentes persistentes, sin
  comunicación agente-a-agente — solo invocación explícita punto a punto desde Alejandra.
- `F-6.1` pasa de `Pendiente` a **en curso**, con la excepción de dependencia `F-5.1` documentada
  arriba.
- Cada tool nueva que un ayudante use exige el mismo trabajo de gating que cualquier tool N1-N3
  existente (metadato + `Set` de `lib.js` + pruebas de aislamiento) — no hay atajo.
- Se identificó de paso, al revisar `enviar_email` para el futuro ayudante de Correos (Fase 2, no
  parte de este entregable), que esa tool no tiene hoy ninguna barrera de confirmación humana
  pese a ser N2 — queda anotado como deuda a cerrar antes de que un ayudante pueda dispararla.
- Riesgos: un ayudante mal acotado (tools de más, prompt demasiado abierto) podría ampliar de
  facto el radio de acción de una sesión sin que el Motor de Decisión lo detecte si el metadato de
  alguna tool nueva quedara mal declarado — mitigado por `validarDeclaracionTool()` (fail-closed
  ante metadato inválido) y por mantener cada ayudante con un catálogo de tools mínimo y explícito.

## Referencias

- `ADR-0008-DEFINICION-DE-NEXO.md` — interpretación C, rechazada en 2026-08-02, reabierta aquí de forma acotada.
- `ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md` — niveles N0-N3 que un ayudante debe respetar sin excepción.
- `ADR-0007` (autonomía de agentes, ver `CLAUDE.md`) — principio de reversibilidad, motivo para no adoptar modo Auto/control de PC/navegador interno de Nexus Core.
- `ADR-0009-VERIFICACION-INDEPENDIENTE-QA.md`, `ADR-0010-CATALOGO-DE-TOOLS.md` — Tool Registry y QA que un ayudante reutiliza sin cambios.
- `ADR-0013-GOBIERNO-DE-MEMORIA.md`, `ADR-0014` — trazas y memoria gobernada que un ayudante hereda.
- `ADR-0020-INTEGRACION-GRADUAL-MOTOR-DECISION.md` — Motor de Decisión que gatea cualquier tool interna de un ayudante.
- `ADR-0021-NEXO-V1-CAPA-INTEGRACION.md` — patrón de extensión que sigue la futura asesoría legal/financiera (Fase 4).
- `MASTER_ROADMAP.md` — `F-6.1`, pasa de `Pendiente` a en curso.
