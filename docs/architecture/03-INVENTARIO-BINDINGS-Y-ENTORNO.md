# Inventario de bindings y entorno

Fuente: `wrangler.toml`, `alejandra-agente/wrangler.toml` y referencias `env.*` en código. No se han leído valores reales.

| Recurso | Worker web | Worker IA | Uso observado |
|---|---:|---:|---|
| D1 `DB` / `alejandra-db` | Sí | Sí | Datos de negocio, historial, memoria y configuración. |
| R2 `FILES` / `alejandra-app-files` | Sí | Sí | Documentos, fotos, planos y artefactos. |
| Service `API_WEB` | No | Sí | Llamada interna agente → API web. |
| KV `RATE_LIMIT_KV` | No | Sí | Límite de tasa y caché de coste. |
| Cron | 2 diarios | 6 diarios | Tareas programadas. |

Secretos detectados por referencia: credenciales de IA, GitHub/Cloudflare, Telegram, Google, Firebase/FCM, Resend, VAPID, administración y secreto interno. `.env.example` los enumera sin valores reales.

## Pendientes obligatorios antes de cambios de infraestructura

- Confirmar qué secretos pertenecen a cada Worker y retirar referencias no usadas.
- Verificar permisos mínimos de tokens GitHub y Cloudflare.
- Documentar rotación, propietario, fecha de revisión y procedimiento de revocación.
- Acordar clasificación y retención de objetos R2, incluyendo `customMetadata` y controles de acceso.
