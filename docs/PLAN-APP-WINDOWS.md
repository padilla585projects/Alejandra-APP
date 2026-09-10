# Plan — App de Windows de Alejandra Office (Tauri)

> Estado: **borrador para revisar** (2026-09-10). Implementa ADR-0026 (parte Windows). **No es
> migración**: empaqueta el MISMO panel web (`panel.html`) como app de escritorio; la web y la PWA
> siguen vivas; mismo backend. Reversible.

## Objetivo
Sacar un **ejecutable/instalador de Windows** de **Alejandra Office** (el panel de oficina,
`panel.html`) como app de escritorio ligera con **Tauri (WebView2 + Rust)**, **reutilizando el
frontend y el backend actuales** (Cloudflare Workers/D1/R2), y dejando **margen para herramientas
de escritorio futuras** (diálogos de fichero nativos, impresión avanzada, multi-ventana,
integración con el SO) que la web sola no da.

## Principio de diseño
- **La lógica de negocio NO se duplica**: sigue en el panel web (`panel.html`) y en el backend. La
  parte nativa (Rust) solo aporta lo que el navegador no puede (diálogos de SO, impresión, ficheros
  locales, bandeja del sistema, auto-update de escritorio).
- **Contrato web ↔ nativo estrecho**: el panel llama a comandos Tauri concretos (`window.__TAURI__`)
  solo cuando de verdad hace falta lo nativo; si no está en Tauri (navegador normal), cae al
  comportamiento web actual. Nada del panel deja de funcionar fuera de la app.

## Arquitectura
```
Alejandra Office.exe (Tauri)
 ├── WebView2 (Edge Chromium del sistema): el panel web (panel.html) — mismo panel, mismo backend
 │     └── window.__TAURI__.* solo para lo nativo (guardar/abrir fichero, imprimir, etc.)
 ├── Núcleo Rust (src-tauri): ventana, menús, comandos nativos, updater, firma
 └── Backend SIN cambios: la API Workers con getAuth; el panel habla con ella igual que en la web
```

### ¿Web remota o empaquetada?
- **Opción A (recomendada): cargar el panel remoto** (Pages) en la WebView (`build.devUrl` /
  `app.windows[].url` a la URL de producción). Ventaja: **auto-actualiza como la PWA** (un cambio del
  panel llega sin re-publicar el .exe). Coste: necesita conexión (aceptable en oficina). WebView2 es
  Chromium → sin las limitaciones del WebView de Android; el panel no usa WebXR, así que no hay
  bloqueo técnico.
- **Opción B: panel empaquetado** dentro del .exe (`dist/` con copia de `panel.html`). Ventaja:
  arranque sin conexión. Coste: cada cambio del panel exige re-publicar el instalador.
- Decisión sugerida: **A** (remoto) para F1 — es lo que menos fricción añade y respeta "una sola
  fuente de verdad del panel". Se puede pasar a B más adelante si se quiere modo offline.

## Requisitos de toolchain (⚠️ instalación en la máquina de Adrián — decisión humana)
Hoy la máquina tiene **Node v24** y **WebView2 Runtime 152.x** (✓, lo que Tauri necesita en
runtime). **Falta**, y hay que instalarlo para compilar:
1. **Rust** vía `rustup` (`https://rustup.rs`) — instala `rustc`/`cargo` (toolchain por defecto
   `stable-x86_64-pc-windows-msvc`). ~varios cientos de MB.
2. **Visual Studio C++ Build Tools** (workload "Desktop development with C++", incluye el linker
   MSVC y el Windows SDK) — **descarga grande (~2–6 GB)**. Es lo que ahora mismo falta (el `link.exe`
   del PATH es el de Git, no el de MSVC).
   - Alternativa sin Visual Studio: toolchain **GNU** (`rustup default stable-x86_64-pc-windows-gnu`
     + MinGW-w64). Más ligero pero menos estándar para Tauri/firma; se prefiere MSVC salvo problema.
3. **Tauri CLI**: `npm i -D @tauri-apps/cli` (dev dependency del proyecto, se usa con `npx tauri`).

> Estas instalaciones (1 y 2) cambian el sistema de Adrián y no son triviales de deshacer → **no se
> hacen de forma autónoma**. Adrián decide: las instala él, o autoriza que las instale la sesión.
> Todo lo que **no** requiere el toolchain (estructura del proyecto, `tauri.conf.json`, `Cargo.toml`,
> iconos, scripts npm, docs) sí se puede dejar preparado antes, para que compilar sea un solo paso.

## Estructura del proyecto (propuesta)
```
tauri/                      (nuevo, análogo a capacitor/)
 ├── package.json           scripts: "tauri:dev", "tauri:build"; devDep @tauri-apps/cli
 ├── src-tauri/
 │    ├── Cargo.toml        crate de la app (tauri, tauri-build)
 │    ├── tauri.conf.json   identifier com.padilla585.alejandra-office, ventana, updater, bundle
 │    ├── build.rs
 │    ├── icons/            .ico/.png generados con `tauri icon`
 │    └── src/main.rs       arranque + comandos nativos (mínimos en F1)
 └── .gitignore             target/, node_modules/, *.msi, *.exe, firmas
```
`tauri.conf.json` (F1) apunta la ventana a la URL de producción del panel
(`https://padilla585projects.github.io/Alejandra-APP/panel.html`), tamaño inicial razonable,
título "Alejandra Office". Bundle: **MSI + NSIS** (instalador Windows). Sin secretos en el cliente.

## Contrato nativo (crece por fases, F1 mínimo)
- **F1:** ninguno imprescindible — solo mostrar el panel en ventana de escritorio. (Verifica que el
  panel entero funciona igual dentro de WebView2.)
- **F2 (herramientas de escritorio):** comandos Tauri para **guardar/abrir fichero nativo** (export
  de informes/PDF a una ruta elegida), **imprimir**, **abrir enlaces en el navegador del sistema**.
- **F3:** **auto-update** de escritorio (Tauri updater, requiere firmar releases), bandeja del
  sistema, multi-ventana si hace falta.

## Fases
- **F1** — Andamiaje + APK-equivalente de escritorio: proyecto `tauri/`, `tauri.conf.json` al panel
  remoto, `cargo tauri build` → **.msi/.exe** que abre Alejandra Office. Prueba: instalar y abrir en
  Windows; el panel funciona igual que en el navegador (login, chat SSE de Office, secciones).
- **F2** — Comandos nativos de fichero/impresión (lo que la oficina pida primero).
- **F3** — Auto-update firmado + integración SO.
- Cada fase, su prueba en Windows real antes de comprometer la siguiente.

## Verificación (registrada, ADR-0007)
- `cargo tauri build` sin errores; instalar el .msi y abrir; comprobar que **todo el panel** carga en
  WebView2 (login, las 3 vías del chat de `alejandra-agente` NO aplican aquí salvo el panel;
  verificar el stream SSE del chat de Office dentro de WebView2 — es Chromium, debería ir igual).
- Sin cambios de backend ni de versión de la PWA (esto no toca `panel.html` salvo, si acaso, detección
  `window.__TAURI__` para F2).

## Riesgos
- **Toolchain pesado** (VS Build Tools) — mitigado: se instala una vez; alternativa GNU si molesta.
- **WebView2 en equipos de oficina** — el Runtime ya venía con Windows 11 (confirmado 152.x aquí);
  el bundle de Tauri puede incluir el bootstrapper por si algún equipo no lo tiene.
- **Firma del instalador** — para auto-update (F3) y para no asustar a SmartScreen; decisión/coste
  aparte (certificado). En F1 se puede distribuir sin firmar (el usuario acepta el aviso).
- **Login/estado** — WebView2 tiene su propio perfil; la sesión del panel vive donde ya vive
  (localStorage/cookies del origin de Pages). Verificar persistencia entre reinicios.

## Referencias
- ADR-0026 (multi-plataforma; Windows = Tauri). `docs/PLAN-APP-ANDROID.md` (gemelo de Android).
- `panel.html` (Alejandra Office), `worker.js` / `alejandra-agente/worker.js` (backend, sin cambios).
- Tauri v2 (WebView2 + Rust), rustup, VS C++ Build Tools.
