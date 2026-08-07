# OPEN TASK SUMMARY — Handoff

Estado del repositorio para el siguiente chat. Repo: `padilla585projects/Alejandra-APP`.
Working tree debe estar limpio. Todo fusionado en `origin/main`.

Últimos commits (más reciente primero):
```
b03e369  feat(ARC-020): rebanada 2 — ampliar piloto del Motor de Decision a todo el catalogo N0 (ADR-0020 enmienda 1)
5641de9  chore(F-2.2): aplicar y verificar migracion D1 nexo_fuentes_telemetria (ADR-0021)
02ea344  feat(f-2.2): implementar Nexo v1 (ADR-0021) — capa de integracion con fuentes externas
d6eb154  fix(f-1.3): retirar approach npm — nucleo v2 como subcarpetas locales bundleadas por wrangler
b5f42b1  docs: registrar reestructura del nucleo cognitivo v2 en documentacion de proyecto
a9b7db1  feat(f-1.3): publicar nucleo-cognitivo v2 (luego retirado el approach npm en d6eb154)
```

## Estado de despliegues

### Worker `alejandra-agente` (Cloudflare)
| Worker | Versión (id despliegue) | Estado |
|--------|-------------------------|--------|
| `alejandra-agente` | `e8fba7ca-b38a-401d-b0ca-94703fd6dddd` (rebanada 2 ARC-020) | ✅ healthy (`/health`: healthy, d1:true, r2:true) |

Desplegado con `wrangler deploy` tras el commit `b03e8a` y verificado `/health`.

## Pruebas (todas en verde)
```
cd nucleo-cognitivo/packages/cognitive-core        → npm test = 37 pass (0 fail)
cd nucleo-cognitivo/packages/cognitive-core-policy → npm test = 4 pass  (0 fail)
alejandra-agente                                   → npx vitest run = 168 pass (0 fail)
```
No se usa npm como gestor de paquetes del proyecto; wrangler bundlea los imports
de `nucleo-cognitivo/packages/*` directamente (sin paquetes públicos).

## Pendientes (requieren humano / Director)

### Rebanada 3 de ARC-020 — verificadores N1 de lectura (siguiente paso)
- ADR-0020 enmienda 1 (rebanada 2) completada: el piloto gobierna las 36 tools N0.
- **Siguiente:** implementar verificadores de lectura N1 en
  `nucleo-cognitivo/packages/cognitive-core/src/verifier.js` (hoy `verificarDeterminista`
  acepta una condición pura; `solicitarRevisionHumanaAsincrona`/`registrarExplicabilidad`
  lanzan error /ADR-0009/ por diseño) y activar N1 de solo lectura bajo el Motor con
  pruebas de rechazo (tenant, rol, tool sin metadato, riesgo, ausencia de traza).
- Requiere ADR/enmienda + aprobación del Director antes de ampliar alcance.

### Migraciones D1 pendientes en manofiesto
- `migrate_manifiesto.json` → verificar que todas las migraciones aplicadas están
  registradas con `aplicada: true`. Nexo (`migrate_013`) ya aplicada y verificada.

### Temporales de esta sesión (no dejar en repo)
- `alejandra-agente/_n0_scan.cjs` (escáner temporal) fue eliminado tras su uso.

## Notas operativas
- El proyecto **no usa npm** como enfoque de paquetes: el núcleo es código local
  bundleado por wrangler (commits `a9b7db1` + `b5f42b1` + `d6eb154`). No recuperar
  el enfoque `@alejandra/cognitive-core` registrado en `a9b7db1`.
- La D1 **`alejandra-db`** de producción (id `0c9eccde-...`) tiene el esquema completo
  del worker (trazas, memoria, nexos, etc.). Las queries `wrangler d1 execute` REQUIEREN
  `--remote` para ver producción; sin `--remote` se ve la base local de desarrollo
  (está casi vacía).
- ADMIN_TOKEN (GitHub secrets vs `wrangler secret put`) sigue sin sincronizar → el
  workflow `validate-trazas.yml` da 403 (ARC-014). El endpoint 403 es correcto
  (protegido). Healthcheck pasa OK.

## Comandos de interés
```bash
# Pruebas
npm --prefix alejandra-agente test                       # (vitest) 168/168
node --test nucleo-cognitivo/packages/cognitive-core    # 37/37
node --test nucleo-cognitivo/packages/cognitive-core-policy/test  # 4/4

# Despliegue del worker (no requiere git)
cd alejandra-agente && npx wrangler deploy

# Verificación producción
curl -s https://alejandra-agente.alejandra-app.workers.dev/health

# D1 producción (¡USAR --remote!)
cd alejandra-agente && npx wrangler d1 execute alejandra-db --remote --command "SELECT ..."

# Git
git pull --rebase origin main && git push origin main
```

Vea también: `HANDOFF.md` (cronológico), `PROJECT_STATE.md`, `ARCHITECT_BACKLOG.md`,
`TASKS.md`, `docs/decisions/ADR-0020-...`, `docs/decisions/ADR-0021-...`,
`CHANGELOG.md`.

---
Fuentes de verdad: `HANDOFF.md` (documento cronológico vivo), `TASKS.md`, este
`OPEN_TASK_SUMMARY.md`.