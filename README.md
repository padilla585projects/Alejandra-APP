# Alejandra — Inventario · Maquinaria · Control

PWA mobile-first para gestionar bobinas de cable, plataformas elevadoras (PEMP) y carretillas en obras de construcción.

## ¿Qué hace?

- Registra entradas y salidas de activos por escaneo **QR** o lectura **OCR** de etiquetas
- Controla el estado y los movimientos de cada activo por obra
- Gestiona **revisiones e ITV** de maquinaria con alertas de vencimiento
- Sincroniza automáticamente con **Google Sheets**
- Funciona **offline** gracias al Service Worker
- En Desarrollo

## Roles

**Super Admin** · **Encargado** · **Operario** — con permisos diferenciados por obra.

## Stack

Vanilla JS · Cloudflare Workers · Cloudflare D1 (SQLite) · Google Gemini · Google Vision API · jsQR

## Deploy

- **Frontend:** GitHub Pages (rama `main`)
- **Backend:** Cloudflare Workers (`wrangler deploy`)
- **DB:** Cloudflare D1


## ⚠️ Licencia

Este software es propietario.

No está permitido copiar, modificar ni distribuir este código sin autorización expresa del autor.

## 👤 Autor

Adrián Padilla
Padilla585.projects@gmail.com
2026
