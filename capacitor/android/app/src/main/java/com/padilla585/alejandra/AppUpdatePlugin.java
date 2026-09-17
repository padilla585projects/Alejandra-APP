package com.padilla585.alejandra;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * ACTUALIZAR-APK-UN-TOQUE-01 (17/09/2026): Adrian, tras encontrar que el HTC y el Oppo llevaban
 * semanas sin recibir ninguna actualizacion (BUG-APK-DEBUG-FIRMA-01, firma incompatible) --
 * "tenemos que hacer que siempre se actualice a la ultima version". Android no permite una
 * actualizacion de verdad silenciosa fuera de Play Store (el usuario SIEMPRE tiene que confirmar
 * la instalacion, es una barrera de seguridad del sistema que no se puede saltar), pero el camino
 * de hoy (checkNativeAppUpdate -> banner -> Browser.open -> Chrome descarga -> notificacion ->
 * tocarla -> instalador) tiene demasiados pasos en los que perderse. Este plugin descarga el .apk
 * con el DownloadManager del sistema (fiable, reintentos, notificacion de progreso nativa) y, en
 * cuanto termina, lanza DIRECTAMENTE el instalador -- un solo toque real ("Instalar") en vez de
 * cinco pasos.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String NOMBRE_FICHERO = "alejandra-update.apk";

    @PluginMethod
    public void descargarEInstalar(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) { call.reject("Falta la URL del .apk"); return; }

        Context ctx = getContext();
        // Descarga anterior a medias (p.ej. la app se cerro): se sustituye sin arrastrar un
        // fichero corrupto o a medio bajar de un intento previo.
        File destino = new File(ctx.getExternalFilesDir(null), NOMBRE_FICHERO);
        if (destino.exists()) { try { destino.delete(); } catch (Exception ignored) {} }

        DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) { call.reject("DownloadManager no disponible"); return; }

        DownloadManager.Request req;
        try {
            req = new DownloadManager.Request(Uri.parse(url));
        } catch (Exception e) {
            call.reject("URL de descarga inválida: " + e.getMessage());
            return;
        }
        req.setTitle("Alejandra — actualización");
        req.setDescription("Descargando la última versión");
        req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        req.setDestinationInExternalFilesDir(ctx, null, NOMBRE_FICHERO);
        req.setMimeType("application/vnd.android.package-archive");
        req.setAllowedOverMetered(true);
        req.setAllowedOverRoaming(true);

        final long downloadId;
        try {
            downloadId = dm.enqueue(req);
        } catch (Exception e) {
            call.reject("No se pudo iniciar la descarga: " + e.getMessage());
            return;
        }

        BroadcastReceiver receptor = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (id != downloadId) return;
                try { context.unregisterReceiver(this); } catch (Exception ignored) {}

                if (!destino.exists() || destino.length() == 0) {
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("error", "La descarga no se completó");
                    call.resolve(ret);
                    return;
                }
                try {
                    Uri contentUri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", destino);
                    Intent instalar = new Intent(Intent.ACTION_VIEW);
                    instalar.setDataAndType(contentUri, "application/vnd.android.package-archive");
                    instalar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    ctx.startActivity(instalar);
                    JSObject ret = new JSObject();
                    ret.put("ok", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    JSObject ret = new JSObject();
                    ret.put("ok", false);
                    ret.put("error", e.getMessage());
                    call.resolve(ret);
                }
            }
        };
        IntentFilter filtro = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.registerReceiver(ctx, receptor, filtro, ContextCompat.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(receptor, filtro);
        }
    }
}
