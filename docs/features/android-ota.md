# OTA del binario Android — candidata 1.17

Fecha: 2026-10-01. Tarea ANDROID-OTA-01. Rama codex/android-ota, base e0cb294.
Estado: implementación integrada #336; bootstrap 1.17 instalado en Oppo el 01/10.
Consulta de versión sin downgrade verificada; descarga/salto OTA reales pendientes.

## Objetivo y alcance

Adrián solicita OTA para la suite Android. El código ya contaba con aviso web de una
release nueva y descarga manual AppUpdatePlugin, aunque el runbook decía que no había
actualizador nativo. Se completa ese mecanismo existente: GitHub Releases,
DownloadManager e instalador Android. No se adopta Play Store, OTA de bundles JS,
backend nuevo ni arquitectura del ADR-0026. La PWA permanece sin cambios.

## Flujo

1. Al abrir/volver a MainActivity se recupera primero la descarga persistida y se
   comprueba la release estable si han pasado 6 h desde una respuesta válida. Sin
   conexión/fallo de API no bloquea la suite y puede reintentar al volver.
2. Solo releases no borrador/no prerelease con tag app-android-vN, versión superior
   y asset oficial alejandra.apk. No descarga ni instala candidatas no publicadas.
3. Descarga automática exclusivamente Wi-Fi, sin roaming. DownloadManager continúa
   tras cerrar el proceso. Una petición manual desde Ajustes permite datos móviles;
   si la OTA estaba esperando Wi-Fi, se sustituye por la descarga manual solicitada.
4. ID de descarga, versión esperada y modo se persisten. El broadcast es solo aviso:
   se consulta el estado real, se exige éxito y se inspecciona APK. Si no llega el aviso
   o el proceso desaparece, el siguiente resume recupera el resultado.
5. Se exige paquete propio, versión superior/coincidente con release cuando se conoce
   y mismos certificados firmantes. No se ofrece instalar APK vacía/incompleta, otra
   app, otra firma, versión antigua/igual o distinta de los metadatos esperados.
6. Se ofrece «Instalar / Más tarde» únicamente con la suite en primer plano, sin
   interrumpir ReplanteoARActivity u otra app. La oferta pide guardar el trabajo antes
   de instalar. Más tarde no insiste dentro de esa sesión; Ajustes permite retomarla.
7. Si falta permiso para instalar desde Alejandra, abre Ajustes Android; al volver
   tras concederlo recupera la oferta. Android siempre controla la instalación.
   Cancelar conserva la descarga. Al detectar que la versión ya está instalada, limpia
   solo el archivo/registro de actualización propio, nunca datos de la suite.

El contrato JS descargarEInstalar conserva {ok:true}; ahora confirma descarga preparada,
no instalación consumada. Los fallos posteriores aparecen mediante mensaje nativo.
La lógica OTA nativa funciona independientemente de que la página remota cargue.

## Bootstrap y publicación

Hace falta instalar **una vez** la candidata 1.17 para añadir el nuevo código nativo;
las APK anteriores no pueden adquirir este mecanismo mediante una recarga web.
La 1.17 incorpora también AR #335. El artefacto 1.16 de la tarea anterior queda como
referencia histórica, sustituido por 1.17 para la validación conjunta.

Última estable comprobada: app-android-v15, asset alejandra.apk. **No se publica 1.17
estable hasta validar AR y OTA en dispositivo.** No prueba una actualización futura
el mero hecho de compilar o consultar una release anterior. Tras validarla publicar
con el runbook de APK y verificar hash de descarga pública y firma.

Rollback: revertir implementación y publicar una corrección con versionCode mayor.
No instalar un downgrade automático ni desinstalar/borrar almacenamiento.
Rotación de la clave de firma queda fuera de alcance: la política exige firmantes
actuales iguales y nunca introduce claves o secretos nuevos.

## Validación

- UpdatePolicyTest: 3 pruebas que incluyen orígenes maliciosos/HTTP/otro repositorio,
  rutas manipuladas, prereleases/drafts/tags ajenos/overflow, versiones iguales/antiguas,
  metadatos discordantes, paquete/firma incorrectos y ausencia de firmantes.
- testDebugUnitTest y assembleRelease; ejecutar también regresiones AR existentes.
  CI ya compila Android y ejecuta estos tests. Sin Workers/IA modificados.
- Comprobar en Oppo: arranque offline, conexión Wi-Fi, versión igual/no downgrade,
  nueva versión estable de prueba firmada, descarga duplicada, cierre del proceso y
  reentrada, volver desde AR, cola Wi-Fi/petición manual con datos, permiso rechazado
  y concedido, Más tarde, cancelación del instalador y actualización conservando datos.
- La prueba de salto entre versiones exige dos APK de pruebas firmadas y metadatos
  controlados, sin publicar una falsa actualización a usuarios. Validar ese circuito
  en dispositivo antes de dar por comprobada la OTA. No usar datos productivos de prueba.

Fuentes: [DownloadManager](https://developer.android.com/reference/android/app/DownloadManager),
[firmantes APK](https://developer.android.com/reference/android/content/pm/SigningInfo),
[permiso del instalador](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls()).

## Artefacto candidato

Implementación 3ca7c02. APK final versión 17/1.17, compilada y firma release verificada.
SHA-256: `D43DC62500DFBDE4700B0FB116B9D88101561F4B7F9255D7D838DA1599C63983`.
Resultado local: política OTA 3/3, superficies/accesorios 5/5 y overlay 6/6.
Instalada por ADB Wi-Fi el 01/10; Ajustes reconoce build17 y no propone estable15.
Después se corrige el canvas nativo en fbff4d8; ese binario sustituye a este hash histórico.
No publicada como estable; actualización real entre versiones continúa pendiente.
