# Botón atrás jerárquico y marca APP/WEB

Fecha: 2026-10-03. Tareas ANDROID-ATRAS-02 y MARCA-APK-PWA-01. Rama feat/android-atras-y-marca-apk.
Pedido de Adrián del 14/09/2026, confirmado el 03/10.

## Botón atrás

Un solo código (`_manejarBotonAtras` en `index.html`) atiende el evento nativo `backButton`
de `@capacitor/app` en la APK y `popstate` en la PWA. Orden en cada pulsación:

1. Chat de Alejandra o foto ampliada abiertos: se cierran.
2. Capa abierta más alta (`.modal-overlay` o paneles flotantes de Seguridad, chat, Docs...):
   se cierra con su propio cierre (el mismo que tocar el fondo, o su botón ✕/×/Cancelar),
   y solo como último recurso se oculta. Nunca se pulsa un botón por el nombre de su función.
   Quedan fuera a propósito la sesión AR (`replArOverlay`), el asistente de bienvenida y el
   reseteo obligatorio de contraseña.
3. Subnivel interno: carpeta de Docs, pestaña de Seguridad, panel de Personal → su menú.
4. Historial de pantallas (`_navHistory`), salvo en un selector.
5. Jerarquía según rol: pantalla → menú del departamento → selector de departamento →
   selector de empresa (superadmin). empresa_admin termina en el selector de departamento;
   encargado/operario, en el menú de su departamento fijo. Subir a un selector suelta el
   departamento, igual que la píldora de la cabecera.
6. Raíz (también en el login): «Pulsa atrás de nuevo para salir»; la segunda pulsación en
   2,5 s llama a `App.exitApp()` en la APK o deja que el navegador resuelva el atrás en la PWA.

No hace falta APK nueva: el plugin `@capacitor/app` ya estaba en la 1.17 y la APK carga
`index.html` desde Pages.

Límite PWA (Chrome, ajeno a este cambio): las entradas de historial añadidas sin gesto del
usuario se saltan con el botón atrás. Si se pulsa atrás varias veces seguidas sin tocar la
pantalla, la PWA solo captura la primera y después el navegador sale de la pestaña. En la
APK no aplica: el evento nativo llega siempre.

## Marca APP/WEB

Chip bajo el logo de la cabecera: `APP` (verde) dentro de Capacitor, `WEB` (gris) en
PWA/navegador. El anillo verde anterior quedaba tapado por el naranja de superadmin. En
Ajustes → Acerca de, fila «Plataforma» con detalle (`App Android (APK) v1.17 (build 17)`,
`Web · PWA instalada` o `Web · navegador`); el `title` del chip incluye la versión web.

`panel.html` no lleva chip: solo se abre en navegador de escritorio, nunca dentro de la APK,
así que siempre diría WEB y no distinguiría nada.

## Validación

- `node --test scripts/android-atras.test.cjs` (en CI): jerarquía por rol, modales,
  subpaneles, selectores con historial, login y salida PWA.
- APK de prueba (debug, `server.url` local, no publicable) en emulador Pixel_4 y en el
  J5_EEA real, con sesión simulada y API falsa local (sin tocar producción), por
  `KEYCODE_BACK` + CDP: superadmin modal → Ajustes → menú → selector depto → selector
  empresa → aviso → salida al launcher; encargado Ajustes → menú → aviso → salida.
- PWA en Chrome del emulador: empresa_admin modal → Ajustes → menú → selector → aviso,
  tocando la pantalla entre pulsaciones (ver límite PWA).
- Sin probar con sesión real ni contra la API de producción.
