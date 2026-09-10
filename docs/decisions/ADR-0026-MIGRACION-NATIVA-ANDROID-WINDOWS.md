# ADR-0026 — Migración a nativo: suite móvil a Android (Capacitor + ARCore) y Alejandra Office a Windows (Tauri)

- Identificador: ADR-0026
- Fecha: 2026-09-10
- Estado: **Propuesto** — decidido verbalmente por Adrián el 2026-09-10 tras investigación de opciones.
  Aceptarlo formalmente sigue siendo decisión humana (ADR-0007).
- Decisores: Director del Proyecto
- Depende de: ADR-0025 (rediseño del Replanteo, el AR es el motivo de ir a nativo), ADR-0007 (autonomía), DEPT-01 (aislamiento)

## Aclaración (Adrián, 2026-09-10): no es un reemplazo, es multi-plataforma

No se "migra" abandonando la web: Capacitor y Tauri **empaquetan la MISMA web** como superficies
adicionales (Android y Windows). **La PWA sigue viva** y Alejandra se usa donde se quiera (web,
Android, Windows) a la vez, con el mismo backend. Cuánto se apoya en lo nativo depende de las
funciones que se metan; **decidir "migrar del todo" o no queda para el futuro**. Por eso el título
dice "migración" pero el alcance real es **empaquetado multi-plataforma incremental y reversible**.

## Contexto

La suite es una **PWA** (`index.html` móvil + `panel.html` oficina) sobre backend Cloudflare
Workers + D1 + R2. Funciona bien, pero el **replanteo AR** (ADR-0025) choca con los límites del
navegador: el vídeo del AR no se puede grabar por web, `camera-access`/anclaje/oclusión son
frágiles, y **WebXR `immersive-ar` solo existe en Chrome/Chromium sobre ARCore**, no en el WebView
del sistema Android. Adrián se plantea pasar a nativo (.apk) "para más control y herramientas", y
llevar **Alejandra Office** (el panel) a una app de Windows.

Dato confirmado (2026-09-10, inspección por ADB del HTC de Adrián + docs): ya existe una app
**Flutter `alejandra-ia`** (`com.adrianpadilla.alejandra_ia`, v1.9.21, Firebase) que es **la versión
Android del CHAT de Alejandra** — documentada en `SESION.md` y con endpoint `/version` OTA. Es una
app **aparte** del alcance de este ADR (no es la suite). `com.example.app_movil` es un experimento
de otro proyecto, sin relación.

## Decisión

### 1. Android — la SUITE (no el chat): Capacitor + módulo AR nativo (ARCore)

- **Condición de Adrián (2026-09-10):** Capacitor vale **siempre que dé acceso COMPLETO al móvil**.
  Se cumple: ese es justo el motivo de elegirlo frente a TWA. Capacitor expone todo lo nativo por
  plugins — **cámara, ficheros/almacenamiento, sensores (IMU/nivel/brújula), GPS, segundo plano,
  notificaciones push, biometría, compartir** — y admite **plugins nativos propios** (aquí, ARCore).
  TWA (Chrome en caja) **no** da ese acceso; por eso no sirve para el objetivo.
- **Envolver la PWA con Capacitor**: la app web actual corre **tal cual** dentro de la app (una sola
  base de código, **mismo backend**), y se gana lo nativo que faltaba fuera del AR (grabar vídeo,
  cámara, ficheros, sensores, offline, notificaciones).
- **Módulo AR nativo con ARCore** para el replanteo (plugin de Capacitor / actividad nativa): anclaje
  estable, **oclusión**, planos fiables, grabación del AR, medición mejor. Devuelve a la web el
  trazado + fotos/vídeo, que se guardan en el **mismo backend** (endpoints de ADR-0025 ya existen).
- Motivo de NO usar solo TWA: TWA (Chrome) mantiene el WebXR actual pero **no** da lo nativo del AR,
  que es justo el objetivo. TWA queda como posible **APK-puente** rápido si se necesita algo instalable
  antes de tener el módulo ARCore.
- Motivo de NO reescribir la suite en Flutter: tiraría toda la PWA (inventario, CPD, pedidos,
  replanteo) que ya funciona. El chat Flutter (`alejandra-ia`) sigue su vida aparte.

### 2. Windows — Alejandra Office (panel): Tauri

- **Tauri (WebView2 + Rust)** para empaquetar el panel como app de escritorio ligera (~5-15 MB, ~5×
  menos RAM que Electron). Elegido sobre "instalar como PWA/MSIX" porque Adrián quiere **margen para
  futuras herramientas de escritorio** (diálogos de fichero nativos, multi-ventana, impresión
  avanzada, integración con el SO), no solo mostrar el panel en una ventana.
- Electron descartado por peso (100-200 MB) y RAM.
- El backend no cambia: Tauri carga el panel (misma web) y habla con la misma API.

### 3. Lo que NO cambia
- **Backend** (Workers/D1/R2) y su API: idéntico para PWA, Capacitor y Tauri.
- **Aislamiento por departamento** (DEPT-01) y toda la lógica de negocio: en el servidor, se reutiliza.
- El **chat Alejandra** en Android sigue siendo la app Flutter `alejandra-ia`, independiente.

## Fases (propuestas)
- **F1** Windows: empaquetar el panel con **Tauri** (prueba pequeña: app de escritorio que carga el
  panel actual). Sin tocar la web.
- **F2** Android: **Capacitor** envolviendo la PWA → APK de la suite (sin AR nativo aún; el AR usa el
  WebView, que puede no dar WebXR → durante F2 el AR se hace con el navegador/PWA como hoy).
- **F3** Android: **módulo AR nativo ARCore** que sustituye al WebXR en la app, devolviendo el trazado.
- Cada fase, su prueba en dispositivo real (HTC U11 por ADB) antes de comprometer la siguiente.

## Consecuencias
- **Beneficio:** el AR gana lo que la web no puede (vídeo, oclusión, anclaje), y Office pasa a ser app
  de escritorio con margen a crecer, **sin reescribir** la suite ni el backend.
- **Coste / tooling nuevo:** entra **Android (Android Studio, Kotlin/Java para el plugin ARCore, firma
  APK)** y **Rust (Tauri, WebView2)** en un proyecto hoy 100% web + workers. Nuevos pipelines de build
  y distribución (Play Store / sideload, instalador Windows).
- **Riesgo:** el WebView del sistema no da WebXR → durante la transición el AR nativo debe estar listo
  antes de quitar el AR web; probar CSS/JS en WebView2 y en el WebView Android (posibles diferencias).
- **Seguridad:** la superficie de red no cambia (misma API con `getAuth`); firmar los binarios; no meter
  secretos en el cliente.

## Alternativas consideradas
| Alternativa | Motivo |
|---|---|
| Android: TWA solo | Mantiene el AR web pero no da lo nativo (el objetivo). Vale como APK-puente. |
| Android: Flutter completo | Reescribir toda la suite; se descarta (el chat Flutter ya cubre su parte). |
| Windows: PWA/MSIX (instalar) | Esfuerzo casi nulo, pero sin margen para herramientas de escritorio nativas → Adrián elige Tauri. |
| Windows: Electron | Pesado (100-200 MB) y más RAM; descartado. |

## Referencias
- ADR-0025 (Replanteo, motiva el AR nativo). `index.html`/`panel.html` (PWA), `worker.js` (API).
- App Flutter del chat: `SESION.md` (alejandra-ia, `/version` OTA), `com.adrianpadilla.alejandra_ia`.
- Investigación 2026: Capacitor vs TWA, WebXR solo en Chrome/ARCore, Tauri vs Electron (bundles y RAM).
