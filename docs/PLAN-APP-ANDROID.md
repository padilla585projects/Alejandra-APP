# Plan — App Android de la suite (Capacitor + módulo AR nativo ARCore)

> Estado: **borrador para revisar** (2026-09-10). Implementa ADR-0026. **No es migración**:
> empaqueta la MISMA web como app Android; la PWA sigue viva; mismo backend. Reversible.

## Objetivo
Sacar un **.apk de la suite** (inventario, CPD, pedidos, replanteo…) con **acceso completo al
móvil** (cámara, ficheros, sensores, GPS, segundo plano, notificaciones) y un **AR nativo (ARCore)**
para el replanteo, **reutilizando el código web y el backend actuales** (Cloudflare Workers/D1/R2).
El chat Android sigue siendo la app Flutter `alejandra-ia`, aparte.

## Principio de diseño
- **La lógica de negocio NO se duplica**: sigue en la web (`index.html`) y en el backend. La parte
  nativa solo aporta lo que el navegador no puede (AR real, grabar, sensores finos, offline).
- **Contrato web ↔ nativo estrecho**: el AR nativo recibe {elemento, params} y devuelve
  {puntos_3d, obstáculos, complementos, fotos, vídeo}; la web construye el replanteo y lo guarda
  con los endpoints que YA existen (ADR-0025). Si el módulo nativo falla, la web cae al AR/PWA actual.

## Arquitectura
```
APK (Capacitor)
 ├── WebView: la suite web (index.html) — misma app, mismo backend
 │     └── llama a plugins Capacitor (cámara, ficheros, sensores, push…)
 │     └── para replantear en AR: window.Replanteo.abrirAR(...)  ──►
 ├── Plugin nativo "ReplanteoAR" (Kotlin + ARCore)
 │     └── Activity AR: hit-test, planos, anclajes, oclusión, grabar; ◄── devuelve JSON+media
 └── Firebase (push) — opcional, como en la app del chat
```

### ¿Web remota o empaquetada?
- **Opción A (recomendada): web empaquetada** dentro del APK (`www/`), con **comprobación de versión**
  contra `/version` (OTA que ya existe) para avisar/actualizar. Ventaja: **offline** real y arranque
  rápido; el AR no depende de Chrome. Coste: cada cambio de la web requiere re-publicar el APK **o**
  cargar la web remota para las partes no-AR.
- **Opción B: cargar la web remota** (Pages) en el WebView. Ventaja: auto-actualiza como la PWA.
  Coste: necesita conexión y el WebView del sistema **no da WebXR** (por eso el AR va nativo igualmente).
- Decisión sugerida: **A** para tener offline + control, con actualización de assets vía `/version`.

## Plugins nativos (acceso completo al móvil)
Oficiales de Capacitor: **Camera, Filesystem, Geolocation, Motion** (IMU: nivel/brújula/giro),
**Network, Preferences** (sesión), **Share, App, Device, Haptics, Push Notifications** (Firebase).
Propio: **ReplanteoAR** (ARCore).

## El módulo AR nativo (ReplanteoAR)
- **ARCore** en Kotlin (Sceneform está descontinuado → usar ARCore + render propio con OpenGL/filament,
  o **Unity AR Foundation** exportado como librería si preferimos editor visual). Recomendación:
  **ARCore nativo Kotlin** (sin Unity) para APK ligero y control directo.
- Capacidades objetivo (lo que la web no puede): **anclas estables**, **detección de planos**
  suelo/pared/techo, **oclusión** (que un pilar tape la bandeja), **grabación de vídeo del AR**,
  medición con menos deriva, y colocar la instalación/complementos anclados.
- **Reutiliza el render**: la geometría (tubo con grapas/cajas, Rejiband/escalera/chapa, quiebro) ya
  está definida; se porta el mismo criterio a la escena nativa. El cálculo de material se queda en el
  backend (no cambia).
- **Devuelve** a la web: `puntos_3d`, `obstaculos` (con tipo/acción), `complementos`, `fotos`, `vídeo`
  → la web guarda con los endpoints de ADR-0025 (`/replanteos`, `/foto-doc`, `/video`).

## Autenticación y datos
- El **login lo sigue haciendo la web** (mismo flujo); la sesión se guarda con Preferences.
- Todas las llamadas van al **mismo API** con `getAuth` + aislamiento por departamento (DEPT-01). Sin
  cambios de backend.

## Build, versión y distribución
- **Android Studio** + proyecto Capacitor; **keystore** para firmar (guardar fuera del repo).
- Versionado: alinear `versionName` con la versión de la app (hoy 9.x) y `versionCode` incremental.
- Distribución: **sideload (APK)** para pruebas en obra; **Play Store** (AAB) cuando esté maduro.
- El backend y sus workflows de despliegue **no cambian**.

## Fases (cada una probada en el HTC U11 por ADB antes de seguir)
1. **F1 — Shell Capacitor**: proyecto Capacitor cargando la suite (empaquetada) → APK que abre la app,
   login y navegación. Sin AR nativo aún (AR usa la web como hoy). *Entregable: APK instalable de la suite.*
2. **F2 — Plugins nativos**: cámara, ficheros, sensores (IMU), red, preferences, share, push. La
   "Cámara en directo" y las fotos pasan a nativo (mejor que `getUserMedia`).
3. **F3 — ReplanteoAR (ARCore)**: plugin nativo con planos + anclaje + oclusión + grabar; contrato de
   ida/vuelta con la web; sustituye al WebXR en la app.
4. **F4 — Offline + OTA**: assets empaquetados con actualización por `/version`; funcionamiento sin
   cobertura y sincronización al recuperar red.

## Riesgos y mitigaciones
- **WebView ≠ Chrome** (WebXR no disponible en WebView del sistema) → el AR **debe** ser nativo en F3;
  hasta entonces, para AR se usa la PWA en Chrome. Probar CSS/JS de la suite en el WebView de Android.
- **Tooling nuevo** (Android Studio, Kotlin, ARCore, firma) en un proyecto hoy 100% web → curva y
  pipeline de build nuevos; empezar por F1 (bajo riesgo) para montar el circuito.
- **Firma/secretos**: keystore y credenciales fuera del repo; no meter secretos en el cliente.
- **Fragmentación ARCore**: no todos los Android tienen ARCore/planos/depth → degradar con elegancia
  (como ya hace la web) y avisar.

## Qué NO hace este plan
- No abandona la PWA ni el panel web. No toca el backend. No decide "migrar del todo" (futuro).
- No incluye la app del chat (`alejandra-ia`, Flutter) — es independiente.

## Primer paso concreto propuesto
Montar **F1** en una carpeta nueva del repo (p. ej. `android/` con el proyecto Capacitor) que cargue la
suite y genere un APK de prueba, y verificarlo en el HTC. Sin tocar `index.html`/`worker.js`.
