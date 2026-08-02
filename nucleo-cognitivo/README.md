# Núcleo cognitivo — esqueleto, contratos e interfaces

- Estado: F-1.2 iniciada (2026-08-02), primer entregable
- No integrado en `worker.js` ni en `alejandra-agente/worker.js`. No recibe tráfico real.
- Autorizado por: `ADR-0004` (aceptado como arquitectura objetivo) y `ADR-0002` (contrato del
  núcleo cognitivo). Alcance fijado por el Director al aceptar ADR-0004: construir el
  esqueleto, sin activar memoria persistente sensible ni tomar decisiones sin trazabilidad
  suficiente.

## Qué hay aquí

| Módulo | Estado | Por qué |
|---|---|---|
| `estado-cognitivo.js` | **Implementado** | Estado efímero (objeto en memoria de proceso). No persiste nada, así que no depende de ARC-002. |
| `policy-engine.js` | **Implementado (parcial)** | Clasificación de riesgo N0–N3 según la matriz de `ADR-0006`, como función pura sobre un `nivel_riesgo` **ya declarado** — nunca inferido, tal como exige ADR-0006. No lee sesión, permisos ni datos reales. |
| `context-engine.js` | Interfaz | Requiere acceso real a D1 acotado por tenant. Fuera de alcance hasta que se decida cómo extraerlo de forma segura. |
| `planner.js` | Interfaz | Depende de Context Engine y Policy Engine reales. |
| `motor-decision.js` | Interfaz + contrato de traza | Coordina los anteriores (ADR-0004). Fija los campos de traza obligatorios de `docs/architecture/04-MOTOR-DE-DECISION.md`, pero no implementa la decisión real: sin eso, cualquier decisión sería una decisión sin trazabilidad suficiente, que el Director excluyó explícitamente. Además fija el contrato de la dependencia inyectada `registrarTraza()` que `decidir()` aceptará cuando se implemente, sin romper el aislamiento actual (ADR-0014 §5). |
| `memory.js` | Interfaz + constantes puras | Contrato exacto de `ADR-0013-GOBIERNO-DE-MEMORIA.md` §8: `consultarMemoria`, `listarCandidatasPendientes`, `confirmarCandidata` y `rechazarCandidata` lanzan porque la persistencia real (D1, migrador de ADR-0011) no existe todavía. Las categorías de la lista blanca, los valores de `metodo`/`estado` y `caducidadPorDefecto()` sí son lógica pura ya calculable, igual que `policy-engine.js` sobre metadato declarado. |

## Qué NO hay aquí, y por qué

- **Persistencia de Memory.** `memory.js` fija el contrato (ADR-0013), pero ninguna de sus
  funciones de consulta o escritura tiene implementación real: requiere el esquema de
  `alejandra_trazas`-equivalente para Memory pasando por el migrador único de ADR-0011 y la
  autorización de migración contra D1 que exige `CLAUDE.md`.
- **Persistencia y consulta de trazas.** `registrarTraza()` es solo un contrato inyectable en
  `motor-decision.js` (ADR-0014 §5); escribir realmente en `alejandra_trazas` es trabajo de
  cada Worker, fuera de este paquete.
- **Nexo, Capability/Tool Registry, Verifier, QA.** Pertenecen a fases no abiertas (F-1.3,
  F-2.1, F-2.2). `MASTER_ROADMAP.md` acota F-1.2 a Estado Cognitivo, Planner, Context Engine
  y Policy Engine; el Motor de Decisión se añade porque es quien los coordina (ADR-0004).
- **Persistencia de trazas.** Bloqueado por `ARC-008` (observabilidad). El contrato del Motor
  de Decisión exige la *forma* de los campos de traza (`tieneTrazaSuficiente()`), no su
  almacenamiento ni consulta.

## Por qué las interfaces lanzan un error en vez de devolver un stub silencioso

Un stub que devuelve `null` u `{}` puede pasar desapercibido en un caller real y producir una
decisión sin fundamento. Lanzar un error explícito, citando la dependencia que falta, hace
imposible que este esqueleto se use por accidente como si fuera una implementación real.

## Pruebas

```bash
node --check nucleo-cognitivo/src/*.js
node --test nucleo-cognitivo/test
```

## Referencias

- `docs/decisions/ADR-0004-MOTOR-DE-DECISION-Y-MODOS.md`
- `docs/decisions/ADR-0002-NUCLEO-COGNITIVO-V1.md`
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md`
- `docs/decisions/ADR-0013-GOBIERNO-DE-MEMORIA.md` — contrato de `memory.js` (§8)
- `docs/decisions/ADR-0014-OBSERVABILIDAD-Y-TRAZAS.md` — contrato de `registrarTraza()` (§5)
- `docs/architecture/04-MOTOR-DE-DECISION.md`
- `docs/03-ARQUITECTURA-COGNITIVA.md`
- `MASTER_ROADMAP.md` — F-1.2
