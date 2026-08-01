# Informe de auditoría técnica — Fase 0

Fecha: 2026-08-01. Alcance: revisión estática local, configuración versionada, historial Git y pruebas locales. No se han consultado ni modificado recursos de producción, D1, R2, Cloudflare ni GitHub remoto.

## Estado general

El proyecto está operativo y contiene una base funcional amplia. Hay dos Workers Cloudflare, dos frontends estáticos, D1/R2 compartidos y una capa IA avanzada. La principal limitación para evolucionar es organizativa: responsabilidades, prompts, rutas y documentación se concentran en archivos muy grandes y no existe una separación inequívoca entre integración, dominio, infraestructura y operación.

Validación ejecutada: `node --check` en ambos Workers y `npm --prefix alejandra-agente test`: 85/85 pruebas correctas. No hay una suite equivalente para el Worker principal ni para los frontends.

## Arquitectura y activos

| Área | Evidencia | Evaluación |
|---|---|---|
| Frontend | `index.html`, `panel.html`, `alejandra-panel.html`, `sw.js` | Vanilla JS sin build; directo pero de gran tamaño. |
| API | `worker.js` (≈26.280 líneas) | Router y lógica de muchos dominios en un monolito. |
| IA | `alejandra-agente/worker.js` (≈11.133 líneas), `lib.js`, 85 tests | NEXUS, prompts y tools concentrados; parte de políticas extraídas y probadas. |
| Datos | D1 `alejandra-db`; migraciones raíz y `alejandra-agente/` | Esquema/migraciones repartidos entre raíz y subproyecto. |
| Archivos | R2 `alejandra-app-files` | Binding compartido; requiere política formal de propiedad/retención. |
| Límite de tasa | KV `RATE_LIMIT_KV` | Solo declarado en el Worker IA. |
| Enlace interno | Service Binding `API_WEB` | Buen uso para evitar salto HTTP entre Workers. |
| Entrega | 4 workflows GitHub Actions | Despliegue directo con push a `main`; riesgo alto. |

## Fortalezas

- Producto funcional con dominios de obra, inventario, personal, calidad y documentación ya integrados.
- D1/R2 y Service Binding declarados explícitamente en Wrangler.
- Controles de autorización y defensas de seguridad ya presentes; `lib.test.js` cubre políticas críticas de tools y SQL.
- Migraciones SQL versionadas y scripts de predespliegue/seguridad existentes.
- Documentación operativa histórica abundante (`SESION.md`, `ESTADO_APP.txt`, `IDEAS_PENDIENTES.txt`, `OPERACION_PROYECTO.md`).

## Debilidades y deuda técnica

- Monolitos de frontend y backend: alto acoplamiento, navegación y cambios difíciles de revisar.
- No hay límites formales por dominio, contrato de API ni catálogo de endpoints/herramientas.
- Prompts, herramientas, acceso a proveedores y lógica de ejecución coexisten en el Worker IA.
- Migraciones repartidas y workflow que ejecuta migraciones remotas tolerando fallos mediante `|| echo`; puede ocultar una migración fallida.
- El Worker principal no declara dependencias ni una suite de pruebas versionada (su `package.json` raíz está ignorado).
- Documentación histórica tiene solapamientos, es extensa y aparece con mojibake en varias fuentes visibles; no hay fuente de verdad por tipo de decisión.
- No se aprecia un pipeline de calidad para frontend/API (lint, pruebas de integración, análisis de dependencias o contrato).

## Riesgos priorizados

| Prioridad | Riesgo | Evidencia | Mitigación propuesta |
|---|---|---|---|
| P0 | Despliegue no deliberado | workflows despliegan al hacer push a `main` | Separar CI y CD con promoción manual/aprobada; ADR previo. |
| P0 | Cambios de D1 parcialmente ocultos | migraciones remotas con `|| echo` | Migrador con registro, precheck y parada ante errores no idempotentes. |
| P1 | Superficie sensible del agente | tools de BD, GitHub, Cloudflare, mensajería y archivos | Matriz de permisos, auditoría y pruebas de autorización por tool. |
| P1 | Regresión por acoplamiento | Workers/frontends monolíticos | Extraer verticales pequeños con contratos y pruebas. |
| P1 | Fuga multiempresa/R2 | D1 y R2 compartidos, claves manejadas por tools | Política de propiedad de objeto y pruebas IDOR sistemáticas. |
| P2 | Secretos y configuración dispersos | muchos secretos y dos Workers | Inventario de secretos/bindings y rotación documentada. |
| P2 | Observabilidad insuficiente | no se evidencia SLO, alertas o trazas centralizadas | Runbooks y mínimos de logs/métricas antes de ampliar IA. |
| P2 | Dependencia de proveedores IA | Anthropic/OpenAI/Gemini/OpenRouter/xAI | Contratos de proveedor, coste, fallback y privacidad. |

## Duplicidades y módulos potencialmente obsoletos

- Hay dos conjuntos de migraciones: raíz y `alejandra-agente/`; se debe clasificar su propiedad antes de moverlos.
- Existen tres superficies HTML con funciones potencialmente solapadas (`panel.html`, `alejandra-panel.html`, `admin.html`); `PENDIENTE` inventario de uso y URL activa.
- Persisten documentos de estado, ideas, referencias y sesiones con propósito solapado. Se conservan; la nueva taxonomía evita seguir ampliando esta dispersión.
- `worker_deploy_result.txt` está ignorado; los scripts y archivos de despliegue históricos deben etiquetarse como vigentes o archivados en una futura PR, sin borrar ahora.

## Mejoras prioritarias

1. Aprobar ADR-0001 y eliminar el despliegue automático de `main` en una PR aislada.
2. Crear inventario de rutas, tools, bindings, secretos y migraciones con propietario y prueba.
3. Establecer una base de CI sin despliegue: sintaxis, unitarias, seguridad y contrato mínimo.
4. Diseñar extracción incremental por dominio, empezando por una ruta de bajo riesgo.
5. Formalizar retención, auditoría y autorización de D1/R2/IA.

## Límites del informe

No se verificaron secretos reales, permisos activos en Cloudflare/GitHub, contenido actual de D1/R2, configuración de GitHub Environments, dominios, logs ni estado remoto de despliegues. Todo ello queda `PENDIENTE` de auditoría con acceso de solo lectura y autorización explícita.
