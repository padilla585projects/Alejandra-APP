# Alejandra — Inventario · Maquinaria · Control

PWA mobile-first para gestionar bobinas de cable, plataformas elevadoras (PEMP) y carretillas en obras de construcción.

## ¿Qué hace?

- Registra entradas y salidas de activos por escaneo **QR** o lectura **OCR** de etiquetas
- Controla el estado y los movimientos de cada activo por obra y departamento
- Gestiona **revisiones e ITV** de maquinaria con alertas de vencimiento
- Inventario de material de **Seguridad** (arneses, conos, vallas, etc.)
- Sincroniza automáticamente con **Google Sheets**
- Notificaciones automáticas por **Telegram**
- Funciona **offline** gracias al Service Worker
- Arquitectura **multi-tenant**: aislamiento de datos por empresa

## Roles

**Super Admin** · **Encargado** · **Operario** — con permisos diferenciados por obra y departamento.

## Departamentos

⚡ **Eléctrico** — Bobinas · PEMP · Carretillas  
🔧 **Mecánicas** — PEMP · Carretillas  
🔺 **Seguridad** — Escáner cross-dept · Inventario de material

## Stack

Vanilla JS · Cloudflare Workers · Cloudflare D1 (SQLite) · Google Gemini OCR · jsQR

## Deploy

- **Frontend:** GitHub Pages → https://padilla585projects.github.io/Alejandra-APP/
- **Backend:** Cloudflare Workers (alejandra-app-api)
- **DB:** Cloudflare D1 (alejandra-db)

## ⚠️ Licencia

Este software es propietario.

No está permitido copiar, modificar ni distribuir este código sin autorización expresa del autor.

## 👤 Autor

Adrián Padilla  
padilla585.projects@gmail.com  
2026
