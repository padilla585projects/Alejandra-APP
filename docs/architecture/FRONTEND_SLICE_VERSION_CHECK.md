# Rebanada de presentación P-ARCH-003 — Consulta de versión remota

- Estado: Implementada; en revisión antes de la siguiente rebanada
- Fecha: 2026-08-04
- Dependencia: `ADR-0012` aceptado; P-ARCH-001 y P-ARCH-002 aprobados
- Aplicación inicial: campo (`index.html`) y oficina (`panel.html`)

## Objetivo y alcance

La rebanada extrae la única parte realmente idéntica de `checkVersionAndUpdate()` (`index.html`)
y `_checkPanelVersion()` (`panel.html`): la consulta a `version.json` con anulación de caché y
la comparación contra la versión local embebida. Ahora vive en
`packages/design-system/src/platform/version-check.js`, como función pura `checkRemoteVersion({
currentVersion, fetchImpl?, cacheBust? })` sin efectos secundarios — no toca el DOM, no
desregistra el Service Worker, no borra cachés y no recarga la página.

**Deliberadamente fuera de esta rebanada:** el banner de actualización, el toast, el
desregistro de Service Worker, el borrado de `caches` y la recarga forzada. Esa lógica es
mutación de estado de cliente distinta por aplicación (campo recarga sin aviso a los 3s; oficina
avisa y espera 1,5s) y sigue viviendo, sin cambios de comportamiento, en cada archivo. Extraerla
habría exigido unificar dos flujos hoy distintos — fuera del criterio de bajo riesgo de esta
fase.

## Candidato descartado antes de empezar

Se evaluó primero extraer un `copyToClipboard()` compartido (8 sitios en los tres frontends
usan `navigator.clipboard.writeText`), pero cada sitio usa un mecanismo de feedback distinto
(toast, `alert`, log de desarrollador, cambio de texto del botón) y uno mezcla además
`navigator.share`. `FRONTEND_ARCHITECTURE.md` exige "dos usos reales compatibles" antes de
promover un componente compartido; aquí no lo eran. Descartado a favor de este candidato, que sí
replica el perfil ya validado en P-ARCH-001 (GET simple, sin auth, sin mutación).

## Archivos y contrato

| Archivo | Responsabilidad |
|---|---|
| `packages/design-system/src/platform/version-check.js` | Función pura `checkRemoteVersion()`. Exporta también por `module.exports` para poder probarla con `node --test` sin DOM. |
| `packages/design-system/src/platform/version-check.test.js` | 7 pruebas: coincide, difiere, respuesta no-ok, JSON sin `v`, excepción de red, excepción de parseo, `cacheBust` por defecto. |
| `index.html` | Carga el componente; `checkVersionAndUpdate()` conserva el banner/recarga a los 3s, sin cambios de comportamiento. |
| `panel.html` | Carga el componente; `_checkPanelVersion()` conserva el badge/toast/recarga a los 1,5s, sin cambios de comportamiento. |
| `.github/workflows/pages.yml` | **Corrección de paso:** `packages/` no se copiaba nunca a `_site/` — `toast.js` (P-ARCH-002) llevaba desde su fusión sirviendo siempre el fallback local en cualquier publicación real de Pages, sin que nadie lo notara. Añadido `packages` al bucle de directorios copiados. |

Ningún fallo de la consulta (red caída, respuesta no-ok, JSON sin `v`, excepción de parseo)
dispara nada por sí mismo: `checkRemoteVersion()` siempre devuelve `matches:true` en esos casos,
igual que el `try/catch` vacío que sustituye en ambos archivos — un fallo de esta consulta nunca
debe forzar una recarga.

## Pruebas y evidencia

- `node --check` del componente.
- `node --test packages/design-system/src/platform/version-check.test.js` — 7/7 en verde.
- Verificación de encoding (`Ã|Â|â€|ï»¿`) limpia sobre el diff completo.
- Verificado en el navegador (Browser pane, `file://`) sobre los dos archivos reales: el script
  carga sin error de consola, `AlejandraPresentation.platform.checkRemoteVersion` existe,
  `_checkPanelVersion()` pinta `#panelVersionTag` con la versión local, `checkVersionAndUpdate()`
  corre sin lanzar y no activa `_actualizando` cuando `version.json` coincide con la versión
  local — mismo comportamiento que antes de la rebanada.

## Rollback

Revertir el commit restaura el `fetch`/comparación inline en ambos archivos y quita la etiqueta
`<script src>`; sin cambios de datos, API, configuración ni despliegue. El fix de `pages.yml`
puede revertirse por separado sin afectar a esta rebanada (solo cambia qué se copia a `_site/`
en la próxima publicación manual).

## Reducción verificable de acoplamiento

Antes, dos implementaciones casi idénticas de fetch+comparación vivían por separado en
`index.html` y `panel.html`, sin pruebas automatizadas. Ahora esa lógica vive en un único
archivo con 7 pruebas, y un agente que cambie el criterio de comparación de versión no necesita
tocar el banner, el toast ni la recarga de ninguno de los dos frontends.

No se ampliará esta migración hasta revisar esta evidencia.
