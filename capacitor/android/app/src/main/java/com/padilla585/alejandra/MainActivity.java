package com.padilla585.alejandra;

import android.content.Intent;
import android.os.Bundle;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReplanteoARPlugin.class);  // F3 — módulo AR nativo
        registerPlugin(AppUpdatePlugin.class);    // ACTUALIZAR-APK-UN-TOQUE-01 — instalador directo de OTA
        registerPlugin(TtsPlugin.class);          // VOZ-NATIVA-01 — texto a voz nativo (Android TTS)
        super.onCreate(savedInstanceState);
        // BARRA-ESTADO-SOLAPA-01 (17/09/2026): Adrián -- "la barra superior está encima de la
        // app" (el reloj del sistema tapaba el logo de la cabecera). La cabecera (index.html)
        // ya usa padding-top: env(safe-area-inset-top) para dejar hueco a la barra de estado,
        // pero ese valor CSS depende de que el WebView reciba el WindowInset real -- si por lo
        // que sea llega en 0 (Capacitor's StatusBar.setOverlaysWebView activa el modo edge-to-
        // edge desde JS, pero no hay garantía de que el inset ya esté listo la primera vez que
        // el CSS lo lee), el resultado es justo este solape. En vez de depender solo de eso, se
        // manda también la altura real de la barra de estado como variable CSS nativa
        // (--native-status-bar-h) cada vez que cambian los insets (arranque, rotación...);
        // index.html la usa como red de seguridad con max(), no sustituye a env().
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            int topPx = insets.getInsets(WindowInsetsCompat.Type.systemBars()).top;
            float density = getResources().getDisplayMetrics().density;
            float topDp = density > 0 ? topPx / density : 0;
            String js = "document.documentElement.style.setProperty('--native-status-bar-h','" + topDp + "px')";
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> {
                    try { getBridge().getWebView().evaluateJavascript(js, null); } catch (Exception ignored) {}
                });
            }
            return insets;
        });
        // Accesos directos del icono (mantener pulsado): el intent trae el extra
        // shortcut_action. La Activity es singleTask, así que en la práctica casi
        // siempre se reutiliza la instancia existente y esto llega por onNewIntent
        // (WebView ya cargado, sin carrera). Este caso de arranque en frío es el
        // peor escenario -- la app recién empieza a cargar la URL remota -- por eso
        // el retraso: best-effort, si falla el usuario simplemente llega a Home.
        String action = getIntent() != null ? getIntent().getStringExtra("shortcut_action") : null;
        if (action != null) {
            final String a = action;
            getWindow().getDecorView().postDelayed(() -> dispatchShortcutAction(a), 1500);
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String action = intent != null ? intent.getStringExtra("shortcut_action") : null;
        if (action != null) dispatchShortcutAction(action);
    }

    // "action" solo puede venir de los 3 valores fijos declarados en res/xml/shortcuts.xml
    // (no es entrada de usuario), así que concatenarlo en el JS es seguro.
    private void dispatchShortcutAction(String action) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final String js = "window.dispatchEvent(new CustomEvent('alejandraShortcut',{detail:{action:'" + action + "'}}));";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
