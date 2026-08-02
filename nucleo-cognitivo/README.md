# Núcleo cognitivo — esqueleto, contratos e interfaces

- Estado: F-1.2 completada y verificada (2026-08-02); F-1.3 iniciada el mismo día, primer
  entregable en curso
- No integrado en `worker.js` ni en `alejandra-agente/worker.js`. No recibe tráfico real.
- Autorizado por: `ADR-0004` (F-1.2) y `ADR-0010`/`ADR-0009` (F-1.3, Tool Registry y Verifier).
  Alcance fijado por el Director: construir esqueleto y contratos, sin activar memoria
  persistente sensible, sin tomar decisiones sin trazabilidad suficiente, y sin migrar el
  catálogo real de tools de ningún Worker.

## Qué hay aquí

| Módulo | Estado | Por qué |
|---|---|---|
| `estado-cognitivo.js` | **Implementado** | Estado efímero (objeto en memoria de proceso). No persiste nada, así que no depende de ARC-002. |
| `policy-engine.js` | **Implementado (parcial)** | Clasificación de riesgo N0–N3 según la matriz de `ADR-0006`, como función pura sobre un `nivel_riesgo` **ya declarado** — nunca inferido, tal como exige ADR-0006. No lee sesión, permisos ni datos reales. |
| `context-engine.js` | Interfaz | Requiere acceso real a D1 acotado por tenant. Fuera de alcance hasta que se decida cómo extraerlo de forma segura. |
| `planner.js` | Interfaz | Depende de Context Engine y Policy Engine reales. |
| `motor-decision.js` | Interfaz + contrato de traza | Coordina los anteriores (ADR-0004). Fija los campos de traza obligatorios de `docs/architecture/04-MOTOR-DE-DECISION.md`, pero no implementa la decisión real: sin eso, cualquier decisión sería una decisión sin trazabilidad suficiente, que el Director excluyó explícitamente. Además fija el contrato de la dependencia inyectada `registrarTraza()` que `decidir()` aceptará cuando se implemente, sin romper el aislamiento actual (ADR-0014 §5). |
| `memory.js` | Interfaz + constantes puras | Contrato exacto de `ADR-0013-GOBIERNO-DE-MEMORIA.md` §8: `consultarMemoria`, `listarCandidatasPendientes`, `confirmarCandidata` y `rechazarCandidata` lanzan porque la persistencia real (D1, migrador de ADR-0011) no existe todavía. Las categorías de la lista blanca, los valores de `metodo`/`estado` y `caducidadPorDefecto()` sí son lógica pura ya calculable, igual que `policy-engine.js` sobre metadato declarado. |
| `tool-registry.js` | **Implementado** | Validación pura de la declaración de una tool (`acceso`/`cron`/`nivel_riesgo`, ADR-0010) y filtrado de un catálogo ya declarado (`filtrarToolsPorAcceso`, `filtrarToolsParaCron`). No lee el catálogo real de ningún Worker ni ejecuta tools. |
| `verifier.js` | **Implementado (parcial)** | Nivel determinista (ADR-0009) real: aplica una condición pura ya provista. Revisión humana asíncrona y explicabilidad son interfaces que lanzan error explícito — dependen de un canal (Telegram, `alejandra_trazas`) que vive en cada Worker, no aquí. `nivelesRequeridosPara()` fija, por función pura, qué niveles exige cada `nivel_riesgo`. |

## Qué NO hay aquí, y por qué

- **Persistencia de Memory.** `memory.js` fija el contrato (ADR-0013), pero ninguna de sus
  funciones de consulta o escritura tiene implementación real: requiere el esquema de
  `alejandra_trazas`-equivalente para Memory pasando por el migrador único de ADR-0011 y la
  autorización de migración contra D1 que exige `CLAUDE.md`.
- **Persistencia y consulta de trazas.** `registrarTraza()` es solo un contrato inyectable en
  `motor-decision.js` (ADR-0014 §5); escribir realmente en `alejandra_trazas` es trabajo de
  cada Worker, fuera de este paquete.
- **Migración del catálogo real de tools.** `tool-registry.js` fija el contrato que ADR-0010
  exige; migrar las 69+34 tools reales de `worker.js`/`alejandra-agente/worker.js` es trabajo
  posterior, incremental y tool por tool (decisión del Director en ADR-0010), fuera de este
  entregable.
- **QA.** Depende de Verifier real (los dos niveles que hoy lanzan error) y de tools ya
  registradas. Ver `docs/decisions/ADR-0009-ALCANCE-DE-QA-Y-VERIFICACION.md`.
- **Nexo.** Pertenece a F-2.2, no abierta.
- **Persistencia de trazas / explicabilidad.** Bloqueado por `ARC-008`. El contrato del Motor
  de Decisión exige la *forma* de los campos de traza (`tieneTrazaSuficiente()`), no su
  almacenamiento ni consulta; ADR-0009 deja explícitamente la explicabilidad como deuda hasta
  F-4.1, sin bloquear ninguna acción mientras tanto.

## Por qué las interfaces lanzan un error en vez de devolver un stub silencioso

Un stub que devuelve `null` u `{}` puede pasar desapercibido en un caller real y producir una
decisión sin fundamento. Lanzar un error explícito, citando la dependencia que falta, hace
imposible que este esqueleto se use por accidente como si fuera una implementación real.

## Pruebas

```bash
node --check nucleo-cognitivo/src/*.js
node --test nucleo-cognitivo/test/contratos.test.js nucleo-cognitivo/test/memory.test.js nucleo-cognitivo/test/tool-registry-verifier.test.js
```

## Referencias

- `docs/decisions/ADR-0004-MOTOR-DE-DECISION-Y-MODOS.md`
- `docs/decisions/ADR-0002-NUCLEO-COGNITIVO-V1.md`
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md`
- `docs/decisions/ADR-0013-GOBIERNO-DE-MEMORIA.md` — contrato de `memory.js` (§8)
- `docs/decisions/ADR-0014-OBSERVABILIDAD-Y-TRAZAS.md` — contrato de `registrarTraza()` (§5)
- `docs/decisions/ADR-0010-CATALOGO-DE-TOOLS-Y-MATRIZ-DE-PERMISOS.md` — contrato de `tool-registry.js`
- `docs/decisions/ADR-0009-ALCANCE-DE-QA-Y-VERIFICACION.md` — contrato de `verifier.js`
- `docs/architecture/04-MOTOR-DE-DECISION.md`
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `MASTER_ROADMAP.md` — F-1.2, F-1.3
