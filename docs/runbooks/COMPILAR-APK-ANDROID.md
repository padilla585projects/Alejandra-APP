# Runbook — Compilar y publicar la APK Android (Capacitor)

Cómo generar un `.apk` release firmado de verdad de la app nativa (`capacitor/android`,
paquete `com.padilla585.alejandra`) y publicarlo para que Adrián lo descargue desde el
móvil. Pensado para que cualquier sesión (Claude Code u otra) pueda hacerlo sin
redescubrir los mismos tropiezos.

> La APK envuelve una PWA servida en vivo (`server.url` en `capacitor.config.json`
> apunta a GitHub Pages) — casi no lleva assets web propios. **Un cambio solo en
> `index.html`/`panel.html`/JS no necesita APK nueva**, se ve en la próxima recarga.
> Recompilar y publicar la APK solo hace falta cuando cambia código **nativo**:
> `capacitor/android/**/*.java`, `AndroidManifest.xml`, plugins Capacitor, iconos/splash,
> `build.gradle`.

## Requisitos previos (una vez por máquina)

- **Keystore de release** ya generado en `C:/Users/Adrian/.android-signing/alejandra-release.keystore`
  y `capacitor/android/keystore.properties` (gitignored, con rutas en `/` no `\` —
  el parser de `Properties` de Java rompe con backslashes).
- **JDK 21**: usar el JBR que trae Android Studio, no un JDK standalone —
  `JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"`. Un JDK 17 suelto falla por
  falta del toolchain Java 21 que piden algunos plugins de Capacitor 8; un JRE sin
  compilador falla directamente.
- Android SDK con `build-tools` instalado (para `apksigner`, verificar la firma).
- `gh` autenticado con permiso para subir assets a Releases del repo.

## Pasos

```bash
# 1. Working tree limpio en el commit exacto que se quiere publicar (normalmente
#    origin/main). Si "main" ya está en uso por otro worktree/sesión, usar otro
#    nombre de rama local apuntando al mismo commit -- NUNCA forzar el checkout de
#    "main" en dos worktrees a la vez.
git fetch origin main --quiet
git checkout -B build/apk-release origin/main

# 2. Sincronizar Capacitor (copia capacitor.config.json + plugins nativos a android/).
#    El warning "Cannot copy web assets... server.url is set" es esperado y no es error.
cd capacitor
npx cap sync android

# 3. Compilar el release firmado
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleRelease
# → capacitor/android/app/build/outputs/apk/release/app-release.apk
```

### Verificar que es un build de RELEASE de verdad (no debug)

```bash
APKSIGNER=$(find "/c/Users/Adrian/AppData/Local/Android/Sdk/build-tools" -name "apksigner.bat" | sort -V | tail -1)
"$APKSIGNER" verify --print-certs app/build/outputs/apk/release/app-release.apk
# Debe salir: CN=Alejandra APP, O=Padilla585 Projects, C=ES
# Si sale un certificado "Android Debug" -- algo fue mal, no publicar esa APK.
```

### Publicar en GitHub Releases

El botón de descarga dentro de la app apunta a
`releases/latest/download/alejandra.apk` — el asset **tiene que llamarse exactamente
`alejandra.apk`** en la release marcada como "Latest".

> ⚠️ **Gotcha real**: `gh release upload <release> ruta/app-release.apk#alejandra.apk`
> NO renombra el asset — el `#texto` es solo una etiqueta de visualización, el nombre
> real del asset sale del nombre de archivo local. Si se sube así, queda un asset
> `app-release.apk` aparte y el `alejandra.apk` viejo se queda sin actualizar. Hay que
> renombrar/copiar el archivo local primero:

```bash
cp app/build/outputs/apk/release/app-release.apk "$TEMP/alejandra.apk"
gh release upload app-android-v5 "$TEMP/alejandra.apk" --clobber   # --clobber para sobrescribir
```

(`app-android-v5` es la release actual marcada "Latest" a fecha de este runbook —
comprobar con `gh release list` cuál lo es antes de subir; si se crea una release nueva,
que quede marcada "Latest" para que la URL de descarga apunte ahí.)

### Verificación posterior (obligatoria)

```bash
sha256sum app/build/outputs/apk/release/app-release.apk
curl -sL -o /tmp/check.apk "https://github.com/padilla585projects/Alejandra-APP/releases/latest/download/alejandra.apk"
sha256sum /tmp/check.apk
# Los dos hashes deben coincidir -- si no, el asset servido no es el que se acaba de subir.
```

## Qué NO hace falta tocar

- `version.json` / `sw.js` / `index.html` (`APP_VERSION`) / `panel.html`
  (`PANEL_APP_VERSION`) — esos cuatro marcadores son solo de la **web/PWA**, no de la
  APK nativa. Un cambio nativo puro (como este runbook) no los toca. Solo subirlos si
  la entrega incluye también cambios web (ver regla en `CLAUDE.md`).
- Instalar la APK por ADB — desde que se arregló la descarga in-app (`FIX-DESCARGA-APK-01`
  + el fix del scope WebAPK), Adrián la descarga e instala él mismo desde el móvil en
  cuanto está publicada. Solo instalar/probar por ADB si él lo pide explícitamente.

## Limitación conocida — sin OTA nativo

Esta app **no tiene actualización automática (OTA) del binario nativo**. La parte
web sí es efectivamente "en vivo" (se sirve desde GitHub Pages en cada carga, sin
rebuild), pero cualquier cambio nativo (como el de este runbook) exige: compilar →
publicar el asset → que Adrián lo descargue e instale a mano. No hay Play Store (que
traería auto-update gratis) ni Capacitor Live Update / Android In-App Updates
configurado. Si en el futuro se vuelve una fricción real, valorarlo como una decisión
de producto aparte (Play Store interno / Firebase App Distribution / Android In-App
Update API) — no está implementado hoy.
