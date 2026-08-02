# Alejandra 2.0

![Alejandra 2.0 — operación industrial, obra e inteligencia artificial](docs/assets/alejandra-hero.png)

> Plataforma de gestión industrial y de obra con inteligencia artificial, PWA y arquitectura multiempresa.

PWA de gestión industrial y de obra para empresas del sector eléctrico/mecánico: inventario de maquinaria, personal, documentación, calidad y seguimiento de obra — con un **agente de IA propio (Alejandra)** integrado en toda la plataforma.

Tres frontends sobre el mismo backend:
- **App móvil** (`index.html`) — para operarios y encargados en campo: escaneo QR/OCR, fichajes, incidencias, partes de trabajo, chat con Alejandra.
- **Panel de oficina** (`panel.html`) — para gestión completa de obra: dashboards, documentación, calidad, subcontratas, planos técnicos generados por IA.
- **Panel de control** (`alejandra-panel.html`) — frontend independiente con login Google/token de administrador, para supervisión y DevTools del agente.

> Estado del repositorio: la plataforma opera con dos Workers, D1 y R2; los despliegues y las migraciones son manuales y separados de CI. El núcleo cognitivo existe como paquete aislado de contratos y todavía no recibe tráfico real. Consulta [START_HERE.md](START_HERE.md) para el estado vivo y [la documentación](docs/README.md) para las fuentes oficiales.

## ¿Qué hace?

| Campo | Oficina | IA integrada |
|---|---|---|
| Operación | Inventario, personal, documentación y calidad | Consulta información autorizada en lenguaje natural |
| Obra | Planificación, compras, subcontratas y planos | Genera y ayuda a revisar planos técnicos |
| Seguridad | Roles, empresa, departamento y propiedad | Tools con esquemas, mínimo privilegio y trazabilidad |

**Inventario y maquinaria**
- Entradas/salidas de bobinas de cable, plataformas elevadoras (PEMP) y carretillas por escaneo **QR** o lectura **OCR** de etiquetas
- Revisiones e **ITV** de maquinaria con alertas de vencimiento
- Inventario de material de **Seguridad** (EPIs, arneses, conos, vallas…) y repostajes

**Personal y RRHH**
- Fichajes y control de asistencia, turnos, partes de trabajo
- Carnés, reconocimientos médicos y formación
- Gestión de personal por obra y departamento

**Documentación y calidad**
- Carpetas y documentos por departamento (con control de acceso por empresa/departamento)
- Incidencias, RFIs, no conformidades (NCR), ITP, punch list, control de calidad
- Actas de reunión, transmittals, submittals, permisos de trabajo, inspecciones

**Gestión de obra (panel de oficina)**
- Presupuestos, órdenes de compra, órdenes de cambio, certificaciones
- Cronograma, hitos, fases, calendario de obra
- Subcontratas, contactos y visitas de obra, entregas de material
- Registro medioambiental, gestión de residuos, cierre de obra

**Alejandra — agente de IA integrado**
- Chat conversacional (Claude Sonnet) disponible en la app móvil y el panel, con **historial privado por usuario**
- Genera **planos técnicos** (unifilares, eléctricos, de bandejas, plantas industriales) con simbología IEC y colores normativos REBT, editables por chat
- Consulta datos de la propia empresa (bobinas, personal, obras…) en lenguaje natural
- Visión por IA (OCR de etiquetas, lectura de fotos de cuadros eléctricos)
- Notificaciones push y resúmenes automáticos vía **Telegram**
- Cron nocturno de auto-auditoría y sugerencias de mejora

**Otros**
- Sincronización con **Google Sheets**
- Funciona **offline** gracias al Service Worker (PWA instalable)
- Arquitectura **multi-tenant**: aislamiento estricto de datos por empresa y por departamento

## Roles

| Rol | Acceso |
|---|---|
| `superadmin` | Todo. Elige empresa, obra y departamento. |
| `empresa_admin` | Su empresa completa. |
| `encargado` | Su departamento, obra fija asignada. |
| `operario` | Solo lectura/escaneo, obra fija. |
| `jefe_de_obra` / `oficina` | Panel web de gestión de obra. |
| `desarrollador` | Acceso a herramientas de IA/DevTools de Alejandra. |

## Departamentos

⚡ Eléctrico · 🔧 Mecánicas · 🔺 Seguridad · 👷 Personal · 🏗️ Obra Civil · 🧱 Albañilería · 🎨 Pintura · 🪟 Carpintería · 🌐 Telecomunicaciones · 📦 Almacén · 📐 Oficina técnica

## Arquitectura

- **Frontend:** PWA en JS vanilla (`index.html` móvil, `panel.html` oficina), sin frameworks ni build step
- **Backend:** dos Cloudflare Workers conectados por Service Binding — `alejandra-app-api` (API principal + lógica de negocio) y `alejandra-agente` (chat de IA para todos los usuarios)
- **Base de datos:** Cloudflare D1 (SQLite)
- **Almacenamiento:** Cloudflare R2 (documentos, fotos, planos)
- **IA:** Anthropic Claude (chat, generación de planos) + Google Gemini (OCR, visión)

### Operación y seguridad

- Los dos Workers comparten D1 y R2, pero mantienen código y registros de herramientas independientes.
- El acceso a datos está acotado por identidad, empresa, departamento y propiedad; las herramientas de IA aplican esquemas, privilegio mínimo y trazabilidad.
- `GET /health` comprueba D1 y R2 en ambos Workers y comunica `healthy`, `degraded` o `unhealthy`. El API principal ofrece además `GET /admin/trazas` para `superadmin` y `desarrollador`.
- CI valida el repositorio en cada PR; publicar Pages, desplegar cada Worker, aplicar migraciones D1 y configurar secretos son flujos manuales independientes. Integrar una PR no publica ni modifica datos.

### Núcleo cognitivo

`nucleo-cognitivo/` contiene el esqueleto aislado de Estado Cognitivo, Policy Engine y los contratos de Context Engine, Planner, Motor de Decisión y Memory. No está integrado en los Workers ni persiste memoria. Su alcance, restricciones y pruebas están documentados en [nucleo-cognitivo/README.md](nucleo-cognitivo/README.md).

## Stack

Vanilla JS · Cloudflare Workers · Cloudflare D1 (SQLite) · Cloudflare R2 · Anthropic Claude API · Google Gemini (OCR/visión) · jsQR

## Deploy

- **App móvil, panel de oficina y panel de control (GitHub Pages):** https://padilla585projects.github.io/Alejandra-APP/
- **Backend principal:** Cloudflare Workers (`alejandra-app-api`)
- **Backend del agente IA:** Cloudflare Workers (`alejandra-agente`)
- **BD:** Cloudflare D1 (`alejandra-db`)

Los procedimientos de despliegue, verificación y migración están en [docs/runbooks/CI-CD-Y-MIGRACIONES.md](docs/runbooks/CI-CD-Y-MIGRACIONES.md). No ejecutes migraciones ni despliegues de producción desde instrucciones de esta portada.

## Documentación

- [Empezar aquí](START_HERE.md): estado, límites y siguiente trabajo.
- [Estado del proyecto](PROJECT_STATE.md): despliegues, riesgos y decisiones vigentes.
- [Plan y roadmap](MASTER_PLAN.md): visión, fases y dependencias.
- [ADRs](docs/decisions/README.md): decisiones de arquitectura aceptadas.
- [Runbooks](docs/runbooks/README.md): operación reproducible.

## ⚠️ Licencia

Este software es propietario.

No está permitido copiar, modificar ni distribuir este código sin autorización expresa del autor.

## 👤 Autor

Adrián Padilla
padilla585.projects@gmail.com
2026
