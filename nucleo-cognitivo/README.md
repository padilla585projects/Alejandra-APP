# Núcleo cognitivo — cerebro v2 de Alejandra

- Estado: reestructurado en subcarpetas locales (2026-08-07). Sin paquetes npm: el worker
  importa directamente vía wrangler bundling.
- No integrado en `worker.js` raíz. `alejandra-agente/worker.js` SÍ importa
  `motor-decision` del subpaquete `cognitive-core` (bundleado por wrangler en despliegue).
- Autorizado por: `ADR-0004` (F-1.2) y `ADR-0010`/`ADR-0009` (F-1.3, Tool Registry y Verifier).
  Alcance fijado por el Director: construir esqueleto y contratos, sin activar memoria
  persistente sensible, sin tomar decisiones sin trazabilidad suficiente, y sin migrar el
  catálogo real de tools de ningún Worker.

## Estructura

```
nucleo-cognitivo/
  packages/
    cognitive-core/              # motor de decisión, memoria, tool-registry, verifier, nexo, planner, estado, contexto
      src/ *.js
      index.js                   # re-exporta todos los módulos del core
      test/ *.test.js
    cognitive-core-policy/       # policy-engine N0–N3 (ADR-0006)
      src/policy-engine.js
      src/index.js
      test/policy.test.js
```

Los módulos dentro de cada subpaquete **no tienen dependencias cruzadas** (solo `index.js`
re-exporta). El import que hace el worker es:

```js
// alejandra-agente/worker.js
import { decidirInvocacionPilotoN0, tieneTrazaSuficiente }
  from '../nucleo-cognitivo/packages/cognitive-core/src/motor-decision.js';
```

Wrangler resuelve y bundlea este import en el despliegue — no requiere paso adicional.

## Qué hay aquí

| Módulo | Estado | Por qué |
|---|---|---|
| `estado-cognitivo.js` | **Implementado** | Estado efímero (objeto en memoria de proceso). No persiste nada. |
| `policy-engine.js` | **Implementado (parcial)** | Clasificación de riesgo N0–N3 según ADR-0006, como función pura sobre `nivel_riesgo` **ya declarado** — nunca inferido. No lee sesión ni datos reales. |
| `context-engine.js` | Interfaz | Requiere acceso real a D1 acotado por tenant. Fuera de alcance hasta decidir extracción segura. |
| `planner.js` | Interfaz | Depende de Context Engine y Policy Engine reales. |
| `motor-decision.js` | Interfaz + piloto N0 | `decidirInvocacionPilotoN0()` decide sobre invocaciones N0 trazadas; `decidir()` sigue como stub (necesita Context Engine + Planner). Importado por `alejandra-agente/worker.js`. |
| `memory.js` | **Implementado (dependencia inyectada)** | Contrato ADR-0013 §8: `consultarMemoria`, `listarCandidatasPendientes`, `confirmarCandidata`, `rechazarCandidata` con inyección vía `inyectarMemoria()`. Sin inyección devuelve `[]`/no-op. |
| `tool-registry.js` | **Implementado** | Validación pura ADR-0010 (`acceso`/`cron`/`nivel_riesgo`) + `registrarTool()` + filtrados. No lee el catálogo real de ningún Worker. |
| `verifier.js` | **Implementado (parcial)** | Nivel determinista (ADR-0009) real; revisión humana y explicabilidad como interfaces con error explícito. `nivelesRequeridosPara()`. |

## Pruebas

```bash
# Core (35 tests)
cd nucleo-cognitivo/packages/cognitive-core
node --check src/*.js test/*.js
node --test test/contratos.test.js test/memory.test.js test/tool-registry-verifier.test.js

# Policy (4 tests)
cd ../cognitive-core-policy
node --check src/*.js test/*.js
node --test test/policy.test.js
```

O todo desde el raíz del nucleo:
```bash
cd nucleo-cognitivo
npm test
```

## Referencias

- `docs/decisions/ADR-0004-MOTOR-DE-DECISION-Y-MODOS.md`
- `docs/decisions/ADR-0006-MATRIZ-RIESGO-Y-APROBACION.md`
- `docs/decisions/ADR-0013-GOBIERNO-DE-MEMORIA.md` — contrato de `memory.js` (§8)
- `docs/decisions/ADR-0014-OBSERVABILIDAD-Y-TRAZAS.md` — contrato de `registrarTraza()` (§5)
- `docs/decisions/ADR-0010-CATALOGO-DE-TOOLS-Y-MATRIZ-DE-PERMISOS.md` — contrato de `tool-registry.js`
- `docs/decisions/ADR-0009-ALCANCE-DE-QA-Y-VERIFICACION.md` — contrato de `verifier.js`
- `docs/architecture/04-MOTOR-DE-DECISION.md`
- `docs/03-ARQUITECTURA-COGNITIVA.md`