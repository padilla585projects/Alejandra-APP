package com.padilla585.alejandra;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReplanteoARPlugin.class);  // F3 — módulo AR nativo
        registerPlugin(AppUpdatePlugin.class);    // ACTUALIZAR-APK-UN-TOQUE-01 — instalador directo de OTA
        super.onCreate(savedInstanceState);
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
