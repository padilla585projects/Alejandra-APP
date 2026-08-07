# @alejandra/cognitive-core

Motor de decisión v2 ("cerebro v2") de Alejandra — núcleo cognitivo que coordina estado, contexto, planner, motor de decisión, memoria, tool-registry, verifier y nexo.

## Uso

```js
import * as core from '@alejandra/cognitive-core';
// o módulos individuales:
import { decidirInvocacionPilotoN0 } from '@alejandra/cognitive-core/motor-decision';
import { consultarMemoria } from '@alejandra/cognitive-core/memory';
```

## Módulos

- `motor-decision` — Motor de decisión (ADR-0004, ADR-0020)
- `memory` — Gobernanza de memoria inyectable (ADR-0013)
- `tool-registry` — Catálogo de tools y matriz de permisos (ADR-0010)
- `verifier` — Niveles de verificación (ADR-0009)
- `nexo` — Interfaz de fuentes de conocimiento (ADR-0021)
- `estado-cognitivo`, `context-engine`, `planner` — Interfaces del ciclo cognitivo

## Verificación

```bash
npm run verify   # verify_nucleo.sh — valida que src/* se expone por lib.js
npm test
```