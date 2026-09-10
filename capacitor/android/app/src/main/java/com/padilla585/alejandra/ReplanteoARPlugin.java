package com.padilla585.alejandra;

import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.ar.core.ArCoreApk;

/**
 * F3 — Módulo AR nativo del Replanteo (ARCore).
 *
 * F3.0 (esta versión): infraestructura. Expone la DETECCIÓN de compatibilidad ARCore para que la
 * web decida entre el AR nativo y el WebXR de la PWA. `abrirAR` todavía no lanza la sesión AR
 * (llega en F3.1, con la Activity ARCore + SceneView); de momento responde "pendiente" para que la
 * web caiga limpiamente al flujo WebXR actual.
 */
@CapacitorPlugin(name = "ReplanteoAR")
public class ReplanteoARPlugin extends Plugin {

    /** ¿Este dispositivo soporta ARCore? (el HTC U11 no; el Oppo Find X5 Pro sí). */
    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Context ctx = getContext();
            ArCoreApk.Availability av = ArCoreApk.getInstance().checkAvailability(ctx);
            ret.put("supported", av.isSupported());
            ret.put("availability", av.name());
            // isTransient: ARCore aún comprueba/instala; conviene reintentar la consulta.
            ret.put("transient", av.isTransient());
        } catch (Exception e) {
            ret.put("supported", false);
            ret.put("error", e.getMessage());
        }
        call.resolve(ret);
    }

    /**
     * F3.1: abrirá la Activity ARCore, dejará marcar el recorrido y devolverá
     * {puntos_3d, longitud, obstaculos, complementos, fotos}. Aún no implementado.
     */
    @PluginMethod
    public void abrirAR(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("pendiente", true);
        ret.put("mensaje", "El módulo AR nativo está en preparación (F3.1). Usa el AR de la PWA por ahora.");
        call.resolve(ret);
    }
}
