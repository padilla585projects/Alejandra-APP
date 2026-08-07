# OPEN TASK SUMMARY — Handoff

Estado del repositorio para el siguiente chat. Repo: `padilla585projects/Alejandra-APP`.
Working tree limpio. Todo fusionado en `origin/main`.

Últimos commits (más reciente primero):
```
5b1b8ae  ci: validate-trazas con diagnóstico 403 ADMIN_TOKEN mismatch
fad772a  ci: workflow de validación read-only /api/admin/trazas
4d0c9fe  docs(handoff): actualizar para F-2.2/F-4.1/F-4.3 y bloqueo Pages
2182688  fix(ci): retirar concurrency de pages.yml por run zombie
951c0ef  feat(f-4.1): dashboard de trazas en admin.html
f2e041a  feat(f-2.2): Nexo v1 — capa integración fuentes externas
527157c  feat(f-4.1): observabilidad — empresa_id, purge trazas, trace_id
c3f81ca  fix(security): aislamiento cross-tenant en alejandra_conocimiento
```

## Estado de despliegues

### Workers (Cloudflare)
| Worker | Versión (hash) | Estado |
|--------|-----------------|--------|
| `alejandra-agente` | `4d77a3c9` (latest, incluye F-4.1 + F-2.2 + F-4.3) | ✅ healthy (`/`health: estado healthy, todo true) |

`wrangler deploy` no requiere git, por eso los workers se desplegaron antes que los pushes a `origin/main`.

### GitHub Pages
- URL productiva: `https://padilla585projects.github.io/Alejandra-APP/`
- admin.html publicado: HTTP 200, 32 KB, contiene pestaña Trazas verificada.
- Versión publicada: `9.04` (coherente con `sw.js`/`index.html`).

### Bloqueo de Pages resuelto (2026-08-06)
- Causa: `pages.yml` tenía `concurrency: group: github-pages-production` (`cancel-in-progress: false`).
  Un run zombie en estado `waiting` (`31127870147`, no cancelable — 502 persistente) secuestró el grupo,
  dejando pendientes todos los runs nuevos de Pages en `pending`/`waiting`.
- Solución: commit `2182688` retira el bloque de `concurrency`. GitHub Pages admite un deployment
  activo a la vez; el concurrency añadía fragilidad (zombie lock) sin protección.
- Publicación verificada: run `31128197969` → `success`.

## Pruebas
```
npm --prefix alejandra-agente test   → 146 passing (0 failing)
npm --prefix nucleo-cognitivo test →  39 passing (0 failing)
```
Tests de autorización negativa incluidos (token faltante/expirado cross-tenant → 403).

## Pendientes (requieren humano / Director)

### Workflow `validate-trazas.yml` → 403 con ADMIN_TOKEN
- Run `31164176355` falló: el endpoint `/api/admin/trazas` devolvió **403 "No autorizado"** aunque el workflow pasa `secrets.ADMIN_TOKEN` (entorno `production`) como `Authorization: Bearer`.
- **Diagnóstico:** el secret `ADMIN_TOKEN` de GitHub secrets **no coincide** con el `ADMIN_TOKEN` configurado en el worker de Cloudflare (`wrangler secret put`). `verificarAdminToken()` compara con `env.ADMIN_TOKEN` vía `timingSafeEqual` (worker.js:11997) — cualquier desajuste = 403.
- **Healthcheck sí pasa** (HTTP 200, versión `4d77a3c9` healthy). Endpoint protegido correctamente (403 con token inválido).
- Workflow mejorado (commit `5b1b8ae`) para diagnosticar el 403 de forma explícita.
- **Acción:** sincronizar `ADMIN_TOKEN` de GitHub (`gh secret list --env production`) con el de Cloudflare (`wrangler secret list --remote`), o validar el endpoint usando un token efímero de `/auth/verify-session` (login Google OAuth como `superadmin`). → ARC-014.

- **Validación end-to-end con datos reales en UI**: `admin.html` → login Google OAuth como `superadmin` → pestaña Trazas. → ARC-014 (único mantenedor, no hay staging separado).
- **Cross-tenant en trazas**: `/api/admin/trazas` devuelve `empresa_id` pero no filtra server-side (auditoría cross-tenant intencional para admins; ver HANDOFF.md). Si se requiere scoping, decisión del Director.

## Comandos de interés
```bash
npm --prefix alejandra-agente test            # tests → 146/146
npm --prefix nucleo-cognitivo test           # tests → 39/39
npm --prefix alejandra-agente run deploy     # despliegue worker (no requiere git)
gh workflow run pages.yml -f ref=main -f confirmation=PUBLISH_GITHUB_PAGES --repo padilla585projects/Alejandra-APP
gh workflow run validate-trazas.yml -f ref=main -f confirmation=VALIDATE_TRAZAS_ENDPOINT --repo padilla585projects/Alejandra-APP   # requiere aprobacion entorno production
curl -s https://alejandra-agente.alejandra-app.workers.dev/health | jq
```

Vea también: `HANDOFF.md` (sección cronológica 2026-08-06), `PROJECT_STATE.md`, `ARCHITECT_BACKLOG.md`, `docs/decisions/ADR-0021-NEXO-V1-CAPA-INTEGRACION.md`.

---
Fuentes de verdad: `HANDOFF.md` (documento cronológico vivo) y este `OPEN_TASK_SUMMARY.md`.
