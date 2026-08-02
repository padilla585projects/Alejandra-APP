# ADR-0009 — Alcance de QA y verificación independiente

- Identificador: ADR-0009
- Fecha: 2026-08-02
- Estado: **Aceptado** (2026-08-02)
- Decisores: Director del Proyecto
- Resuelve: ARC-004
- Desbloquea: F-1.3 («Capability/Tool Registry, Verifier y QA»)

## Contexto

`docs/architecture/CARTA-DEL-ARQUITECTO.md` fija el principio: *«Toda respuesta importante
podrá revisarse. Toda acción importante podrá verificarse. Toda decisión importante deberá
ser explicable.»* Pero no dice **con qué mecanismo**, y `ARCHITECT_BACKLOG.md` lo deja como
pregunta abierta: *«Determinar controles deterministas, revisión humana, métricas y
trazas.»*

Sin resolver esto, F-1.3 no tiene contra qué construirse: «Verifier» y «QA» aparecen en el
diagrama de `04-MOTOR-DE-DECISION.md`, pero como cajas sin contrato.

**Lo que ya existe, sin llamarse QA.** El proyecto no parte de cero:

- `CONFIRMO BORRADO` (SEC-08/SEC-09) es, en la práctica, un verificador determinista: una
  condición objetiva (¿el SQL es destructivo?) que bloquea la ejecución hasta confirmación.
- El healthcheck de Pages que valida la versión servida es una comprobación post-acción.
- `alejandra_fixes` con aprobación por botón de Telegram es una revisión humana asíncrona ya
  en producción.

Ninguno se documentó como «QA»; son soluciones puntuales a incidentes concretos (SEC-08,
SEC-09, el incidente de versiones de abril). ARC-004 pide generalizar el patrón, no
inventarlo desde cero.

## Decisión propuesta: tres niveles de verificación

| Nivel | Qué comprueba | Ejemplo ya existente | Cuándo aplica |
|---|---|---|---|
| **Determinista** | Una condición objetiva y programable: ¿la sentencia es destructiva? ¿el esquema resultante es válido? ¿la respuesta contiene el campo esperado? | `CONFIRMO BORRADO`, `node --check`, el catálogo de rutas de F-0.2 | Siempre que la condición se pueda expresar como código |
| **Revisión humana asíncrona** | Una acción se ejecuta pero queda pendiente de confirmación antes de tener efecto irreversible | `alejandra_fixes` + botón de Telegram | Acciones N2 en términos de ADR-0006 (escritura amplia, envío fuera de la organización) |
| **Explicabilidad** | La decisión queda registrada con su razonamiento, aunque no se bloquee nada | Ninguno existe hoy de forma sistemática | Toda acción N1 en adelante — es el requisito mínimo de «toda decisión importante deberá ser explicable» |

Los tres niveles ya son coherentes con **ADR-0006**: el nivel determinista y la revisión
humana asíncrona son, literalmente, cómo se implementan sus niveles N2/N3 en código.

## Alternativas consideradas

| Alternativa | Motivo |
|---|---|
| QA como componente nuevo, construido desde cero | Descartada: ignora que ya hay tres mecanismos funcionando en producción; duplicaría trabajo |
| Solo revisión humana para todo | Descartada: no escala — es la razón por la que hoy el agente se detenía tras cada acción, el mismo problema que resolvió ADR-0007 |
| Solo controles deterministas | Descartada: hay decisiones (calidad de una respuesta, corrección de un plano) que no se reducen a una condición programable |
| **Tres niveles, generalizando lo que ya existe** | **Elegida.** No inventa mecanismo nuevo; nombra y sistematiza el que ya funciona |

## Consecuencias

- F-1.3 puede especificarse como: registrar, para cada tool nueva del catálogo (ARC-006),
  a qué nivel de verificación está sujeta. Sin eso, F-1.3 no tiene grano de trabajo.
- El nivel «Explicabilidad» es el único de los tres que **no existe hoy**. Requiere
  trazas — que es el terreno de ARC-008 (observabilidad), no de este ADR. Este ADR solo fija
  que debe existir; su forma se decide en la Época 4 (F-4.1).
- No cambia ninguna barrera existente. `CONFIRMO BORRADO` sigue funcionando exactamente
  igual; este ADR solo lo reclasifica como lo que ya es.

## Preguntas para el Director

1. **¿Se acepta esta clasificación en tres niveles**, o hay un cuarto tipo de verificación
   que el Director tenga en mente y que no esté aquí?
2. **¿Quién revisa las asíncronas** cuando no sea Adrián — por ejemplo, si en el futuro hay
   más de un revisor humano? Hoy el botón de Telegram va a un único `DEV_CHAT_ID`.
3. **¿El nivel «Explicabilidad» debe bloquear la acción** hasta que exista la traza, o puede
   quedar como deuda hasta F-4.1? Recomendación: que quede como deuda explícita — bloquear
   ahora repetiría el problema que ADR-0007 acaba de resolver.

## Decisión (2026-08-02)

El Director acepta la clasificación en tres niveles (determinista, revisión humana
asíncrona, explicabilidad) tal como se propuso, sin añadir un cuarto tipo. Se adoptan las
recomendaciones del documento para las preguntas 2 y 3: las revisiones asíncronas siguen
yendo a `DEV_CHAT_ID` hasta que exista más de un revisor humano — ampliar el reparto es
decisión aparte cuando llegue el caso; y el nivel «Explicabilidad» **no bloquea** ninguna
acción mientras no exista traza — queda como deuda explícita hasta F-4.1 (observabilidad),
sin repetir el problema que ADR-0007 ya resolvió.

Consecuencia directa: F-1.3 puede especificarse con el grano de trabajo que este ADR fija —
registrar, por tool, a qué nivel de verificación está sujeta —, en coordinación con
ADR-0010 (catálogo de tools), que es donde ese nivel se declara como metadato.

## Referencias

- `ARCHITECT_BACKLOG.md` — ARC-004, ARC-008
- `docs/architecture/CARTA-DEL-ARQUITECTO.md` — sección 13, «El QA»
- `docs/architecture/04-MOTOR-DE-DECISION.md` — Verifier y QA como cajas del diagrama
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md` — niveles N0-N3 que este ADR implementa
- SEC-08, SEC-09 en `worker.js` / `alejandra-agente/lib.js` — los verificadores deterministas ya en producción
