# OPEN TASK SUMMARY — Handoff

Estado del repositorio para el siguiente chat. Repo: `padilla585projects/Alejandra-APP`.
Working tree limpio. Todo fusionado en `origin/main`.

Últimos commits (más reciente primero):
```
2182688  fix(ci): retirar concurrency de pages.yml por run zombie bloqueante
951c0ef  feat(f-4.1): dashboard de trazas en admin.html
f2e041a  feat(f-2.2): Nexo v1 — capa integración fuentes externas (ADR-0021)
527157c  feat(f-4.1): observabilidad — empresa_id en token_uso, purge trazas, trace_id
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
- **Validación end-to-end dashboard trazas con datos reales.** `/api/admin/trazas` responde 403 con token inválido (comportamiento correcto). Para validar con datos: generar token efímero vía `POST /auth/verify-session` con un `session_token` de `superadmin`/`desarrollador` (login Google OAuth). → ARC-014 (único mantenedor) lo impide de forma autónoma.
- **Cross-tenant en trazas.** `/api/admin/trazas` devuelve `empresa_id` pero no filtra server-side (auditoría cross-tenant es intencional para admins; ver HANDOFF.md). Si se requiere scoping, decisión del Director.

## Comandos de interés
```bash
npm --prefix alejandra-agente test            # tests
npm --prefix alejandra-agente run deploy      # despliegue worker (no requiere git)
gh workflow run pages.yml -f ref=main -f confirmation=PUBLISH_GITHUB_PAGES --repo padilla585projects/Alejandra-APP
curl -s https://alejandra-agente.alejandra-app.workers.dev/health | jq
```

Vea también: `HANDOFF.md` (sección cronológica 2026-08-06), `PROJECT_STATE.md`, `ARCHITECT_BACKLOG.md`, `docs/decisions/ADR-0021-NEXO-V1-CAPA-INTEGRACION.md`.

---
Fuentes de verdad: `HANDOFF.md` (documento cronológico vivo) y este `OPEN_TASK_SUMMARY.md`.
