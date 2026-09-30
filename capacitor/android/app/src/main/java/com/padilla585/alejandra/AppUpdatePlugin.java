package com.padilla585.alejandra;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Contrato existente de la web, con comprobación/descarga OTA independiente de PWA. */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private NativeAppUpdater updater;

    @Override public void load() { updater = new NativeAppUpdater(getActivity()); }
    @Override protected void handleOnResume() { if (updater != null) updater.resume(); }
    @Override protected void handleOnPause() { if (updater != null) updater.pause(); }
    @Override protected void handleOnDestroy() { if (updater != null) updater.close(); }

    @PluginMethod
    public void descargarEInstalar(PluginCall call) {
        try {
            String url = call.getString("url");
            boolean started = updater.download(url, 0, false);
            if (!started) updater.retryReady();
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("estado", started ? "descargando" : "descarga_existente");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("No se pudo preparar la actualización: " + e.getMessage());
        }
    }
}
