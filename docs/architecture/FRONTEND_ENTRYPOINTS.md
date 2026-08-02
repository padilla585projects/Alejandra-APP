# Entradas reales del frontend

| Producto | URL publicada | Entrada | Alcance |
|---|---|---|---|
| Alejandra App móvil | `/` | `index.html` | Campo y PWA. |
| Alejandra Office | `/panel.html` | `panel.html` | Gestión de obra y oficina. |
| Panel de control del agente | `/alejandra-panel.html` | `alejandra-panel.html` | Supervisión y DevTools del agente. |

La migración visual de Office se limita a `panel.html`. El Service Worker usa red con `cache: 'no-store'` para navegaciones y conserva caché solo como fallback offline; una publicación conectada sirve el HTML actualizado.
