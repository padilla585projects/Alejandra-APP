# Piloto de presentación P-ARCH-001 — Indicador de salud

- Estado: Implementado; pendiente de revisión antes de ampliar la migración
- Fecha: 2026-08-02
- ADR: `ADR-0012` (Aceptado)
- Aplicación: conversación

## Flujo elegido y motivo

Se extrae el **indicador de salud del Worker IA** que aparece en la cabecera del panel de conversación tras iniciar sesión. Es una rebanada representativa del límite presentación → cliente API → Worker, y de riesgo bajo: realiza una única lectura `GET /health`, no usa token, no modifica datos y no controla permisos. El Worker sigue siendo la única autoridad de la respuesta y de cualquier información que entregue.

No se ha extraído el dashboard, chat ni administración porque combinan varias rutas, datos administrativos y renderizado; modificarlos simultáneamente elevaría el riesgo y el acoplamiento de la primera rebanada.

## Alcance exacto

- El panel conserva la misma llamada `GET https://alejandra-agente.alejandra-app.workers.dev/health`.
- La respuesta conserva su interpretación actual: `version` se muestra en `#sideVer`; `status === 'ok'` muestra «● online» en verde y otro valor «● error» en rojo.
- Los errores de red/JSON conservan el comportamiento previo: no cambian la cabecera ni interrumpen el panel.
- No se cambia autenticación, navegación, estilos, dashboard, contrato del Worker, D1/R2, datos ni permisos.

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `apps/conversacion/src/api/agent-client.js` | Cliente de transporte mínimo para `GET /health`. |
| `apps/conversacion/src/features/system-health/index.js` | Feature que solicita y pinta el estado en elementos recibidos. |
| `alejandra-panel.html` | Carga síncrona de los dos módulos y delegación con fallback temporal idéntico al código previo. |
| Este documento y documentos de gobierno | Evidencia, límites y estado de la rebanada. |

## Contrato UI–backend

| Elemento | Contrato |
|---|---|
| Solicitud | `GET {API}/health`, sin cabecera de autorización añadida por la feature. |
| Respuesta consumida | JSON con `status` y `version`; otros campos se ignoran. |
| Éxito | `status === 'ok'` es el único valor que UI representa como online. |
| Error | Rechazo de red o JSON: captura silenciosa, como en el flujo anterior. |
| Autoridad | El Worker decide y expone el estado; la UI solo lo presenta. No concede ni revoca acceso. |

## Pruebas y evidencia

- `node --check` de ambos módulos nuevos y de `alejandra-panel.html` no aplica al ser HTML; se comprueba que los scripts se cargan antes del script existente.
- Prueba unitaria de transporte con `fetch` simulado: verifica que el cliente solicita exactamente `{baseUrl}/health` y devuelve el JSON sin transformación.
- Prueba de feature con DOM y `fetch` simulados: verifica versión, texto y color para `status: ok`; y que una excepción no muta el estado ya visible.
- `scripts/check-encoding.js` y `git diff --check` para el cambio completo.

## Rollback

Revertir el commit de esta rebanada restaura el único `fetchHealth()` previo. Como no hay cambios de datos, API, configuración ni despliegue, el rollback es un revert de Git sin operación remota.

## Reducción verificable de acoplamiento

Antes, transporte, interpretación y mutación de DOM estaban dentro de `alejandra-panel.html`. Ahora el contrato HTTP vive en `api/agent-client.js` y la interpretación/renderizado en `features/system-health/index.js`; la entrada solo compone dependencias y conserva un fallback temporal. Un agente que cambie el cliente o la feature no necesita tocar navegación, chat, dashboard ni autenticación, reduciendo la zona de conflicto a tres archivos explícitos.

No se ampliará esta migración hasta la revisión de esta evidencia.
