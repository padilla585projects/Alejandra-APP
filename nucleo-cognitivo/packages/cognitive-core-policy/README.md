# @alejandra/cognitive-core-policy

Política de aprobación del núcleo cognitivo de Alejandra — clasificación de riesgo N0–N3 (ADR-0006) que decide qué aprobación exige una acción y si el cron puede ejecutarla.

## Uso

```js
import { evaluarAccion, permitidoParaCron } from '@alejandra/cognitive-core-policy';
// o vía el entry principal:
import * as policy from '@alejandra/cognitive-core-policy';
policy.policyEngine.evaluarAccion({ nivel_riesgo: 'N0' });
```

## API

- `evaluarAccion(accion)` — evalúa una acción con `nivel_riesgo` declarado (N0–N3)
- `permitidoParaCron(accion)` — true solo para N0 y N1 (cron sin humano)

El nivel de riesgo **siempre** debe ser declarado por el catálogo de tools (ADR-0010); este módulo nunca lo infiere.

## Verificación

```bash
npm run verify   # verify_nucleo.sh — valida que src/* se expone por lib.js
npm test
```