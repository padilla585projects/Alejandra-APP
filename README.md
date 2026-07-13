# Alejandra APP

PWA de gestión industrial y de obra para empresas del sector eléctrico/mecánico: inventario de maquinaria, personal, documentación, calidad y seguimiento de obra — con un **agente de IA propio (Alejandra)** integrado en toda la plataforma.

Dos frontends sobre el mismo backend:
- **App móvil** (`index.html`) — para operarios y encargados en campo: escaneo QR/OCR, fichajes, incidencias, partes de trabajo, chat con Alejandra.
- **Panel de oficina** (`panel.html`) — para gestión completa de obra: dashboards, documentación, calidad, subcontratas, planos técnicos generados por IA.

## ¿Qué hace?

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

## Stack

Vanilla JS · Cloudflare Workers · Cloudflare D1 (SQLite) · Cloudflare R2 · Anthropic Claude API · Google Gemini (OCR/visión) · jsQR

## Deploy

- **App móvil (GitHub Pages):** https://padilla585projects.github.io/Alejandra-APP/
- **Backend principal:** Cloudflare Workers (`alejandra-app-api`)
- **Backend del agente IA:** Cloudflare Workers (`alejandra-agente`)
- **BD:** Cloudflare D1 (`alejandra-db`)

## ⚠️ Licencia

Este software es propietario.

No está permitido copiar, modificar ni distribuir este código sin autorización expresa del autor.

## 👤 Autor

Adrián Padilla
padilla585.projects@gmail.com
2026
