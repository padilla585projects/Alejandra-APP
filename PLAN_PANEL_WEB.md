# Plan — Alejandra Office (Panel Web de Gestión)

## Concepto
Panel web para trabajo de oficina, complementario a la app móvil de campo.
Mismo worker, misma API, mismo auth. Nuevo archivo `panel.html` en el mismo repo.
Subdominio a elegir (ej. `office.dominio.com` o `panel.dominio.com`).

## Stack
- HTML + CSS + JS vanilla (igual que la app)
- Tabulator.js para tablas interactivas con edición inline, filtros, ordenación, export
- Cloudflare Pages (mismo repo, fichero panel.html)

## Roles nuevos
| Rol | Equivalente | Acceso |
|-----|-------------|--------|
| `jefe_de_obra` | = encargado | Todo lo operativo de sus obras (web) |
| `oficina` | = operario elevado | Ve todo + puede añadir y editar (sin admin) |

## Fases

### FASE 1 — Base, auth, roles, dashboard [PENDIENTE]
- `panel.html` con layout base: sidebar + topbar
- Login con mismo sistema de tokens
- Rol `oficina` y `jefe_de_obra` en D1 + worker (`isOficina`, `isJefeObra`)
- Dashboard: KPIs rápidos (trabajadores activos, equipos avería, incidencias abiertas, pedidos pendientes)
- Mismo sistema de colores/fuentes que la app
- Responsive (desktop first)

### FASE 2 — Personal, fichajes, EPIs, carnets, turnos [PENDIENTE]
- Tabla trabajadores: edición inline, foto
- Tabla fichajes: filtro fecha/trabajador, export CSV/PDF
- Vista semanal de turnos editable
- EPIs asignados: caducidades, alertas visuales
- Carnets: estado, días para caducidad

### FASE 3 — Inventarios Eléctrico [PENDIENTE]
- Bobinas: tabla completa, edición inline, filtros por estado/obra
- PEMP: ITV, revisiones, estado
- Carretillas: igual que PEMP
- Repostajes: histórico, resumen por máquina

### FASE 4 — Seguridad + Herramientas [PENDIENTE]
- Inventario seguridad: EPIs, arneses, extintores, stock, caducidades
- Herramientas: estado, asignación, historial
- Kits de herramientas

### FASE 5 — Obras, incidencias, pedidos, mantenimientos [PENDIENTE]
- Obras: lista con KPIs por obra
- Incidencias: tabla con filtros, cambio de estado inline, fotos
- Pedidos: tabla con estado, proveedor, aprobación
- Mantenimientos y checklists

### FASE 6 — Administración [PENDIENTE]
- Gestión usuarios: crear, editar, cambiar rol, desactivar
- Config empresa: módulos, departamentos, informe semanal
- Gestión obras: crear/cerrar, asignar personal
- Catálogos: tipos cable, proveedores, tipos herramienta, etc.

### FASE 7 — Extras [OPCIONAL]
- Gráficas: horas por trabajador/semana, evolución incidencias, consumo material
- Informes PDF desde el panel
- Búsqueda global
- Notificaciones en tiempo real (polling 30s)

## Decisiones técnicas acordadas
- Los Google Sheets siguen siendo un sync automático aparte, el panel web tiene sus propias tablas
- Panel web es desktop-first (oficina trabaja en PC)
- Subdominio independiente de la app móvil
