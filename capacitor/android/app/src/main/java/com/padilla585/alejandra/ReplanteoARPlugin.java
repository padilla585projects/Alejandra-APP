package com.padilla585.alejandra;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.ar.core.ArCoreApk;
import com.padilla585.alejandra.ar.ReplanteoARActivity;

/**
 * F3 — Módulo AR nativo del Replanteo (ARCore).
 * F3.0: detección de compatibilidad. F3.1: abre la Activity ARCore, se marca el recorrido y
 * devuelve {ok, puntos:[{x,y,z}], longitud}. La web (index.html) lo usa si isSupported() y cae al
 * WebXR de la PWA si no. El render 3D realista de la instalación llega en F3.2.
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
            ret.put("transient", av.isTransient());
        } catch (Exception e) {
            ret.put("supported", false);
            ret.put("error", e.getMessage());
        }
        call.resolve(ret);
    }

    /** Abre la sesión AR nativa; al terminar devuelve el trazado 3D a la web. */
    @PluginMethod
    public void abrirAR(PluginCall call) {
        Intent intent = new Intent(getContext(), ReplanteoARActivity.class);
        startActivityForResult(call, intent, "arResultado");
    }

    @ActivityCallback
    private void arResultado(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() == Activity.RESULT_OK && data != null) {
            ret.put("ok", true);
            try { ret.put("puntos", new JSArray(data.getStringExtra("puntos") != null ? data.getStringExtra("puntos") : "[]")); }
            catch (Exception e) { ret.put("puntos", new JSArray()); }
            ret.put("longitud", data.getDoubleExtra("longitud", 0));
        } else {
            ret.put("ok", false);
            if (data != null && data.getStringExtra("error") != null) ret.put("error", data.getStringExtra("error"));
            else ret.put("cancelado", true);
        }
        call.resolve(ret);
    }
}
