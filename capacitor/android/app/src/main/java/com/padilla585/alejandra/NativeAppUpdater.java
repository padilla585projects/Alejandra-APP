package com.padilla585.alejandra;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** OTA de APK por GitHub estable + DownloadManager persistente; instalación consentida. */
final class NativeAppUpdater {
    private final Activity activity;
    private final Context context;
    private final DownloadManager downloads;
    private final SharedPreferences state;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean checking = new AtomicBoolean();
    private volatile boolean foreground, closed;
    private boolean registered;
    private volatile long offeredId = -1;
    private AlertDialog dialog;
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context ctx, Intent intent) {
            if (DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())
                    && intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) == state.getLong("id", -2)) reconcile();
        }
    };

    NativeAppUpdater(Activity activity) {
        this.activity = activity;
        context = activity.getApplicationContext();
        downloads = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        state = context.getSharedPreferences("native_apk_update", Context.MODE_PRIVATE);
        // DownloadProvider puede emitir desde otro UID: comprobar ID y estado real, nunca
        // confiar en el contenido del broadcast para decidir si instalar.
        ContextCompat.registerReceiver(context, receiver,
                new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_EXPORTED);
        registered = true;
    }

    void resume() {
        foreground = true;
        if (state.getBoolean("permission", false)) {
            state.edit().putBoolean("permission", false).apply();
            if (Build.VERSION.SDK_INT < 26 || context.getPackageManager().canRequestPackageInstalls()) offeredId = -1;
        }
        reconcile();
        checkLatest();
    }

    void pause() { foreground = false; }

    void close() {
        closed = true;
        foreground = false;
        if (dialog != null) dialog.dismiss();
        if (registered) { context.unregisterReceiver(receiver); registered = false; }
        worker.shutdownNow();
        // No cancelar DownloadManager: la descarga debe sobrevivir a cerrar la app.
    }

    synchronized boolean download(String url, long expected, boolean automatic) throws Exception {
        if (!UpdatePolicy.trustedUrl(url)) throw new IllegalArgumentException("Origen de actualización no autorizado");
        if (downloads == null) throw new IllegalStateException("Descargas no disponibles");
        if (state.contains("id")) {
            // El usuario pide descargar ahora usando datos: sustituir una OTA que estaba
            // esperando Wi-Fi, conservando las descargas en curso o ya terminadas.
            long existing = state.getLong("id", -1);
            boolean waitingWifi = false;
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (!automatic && state.getBoolean("automatic", false) && cm != null && cm.isActiveNetworkMetered()) {
                try (Cursor cursor = downloads.query(new DownloadManager.Query().setFilterById(existing))) {
                    if (cursor != null && cursor.moveToFirst()) {
                        int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        waitingWifi = status == DownloadManager.STATUS_PENDING || status == DownloadManager.STATUS_PAUSED;
                    }
                }
            }
            if (waitingWifi) forget(existing);
            else { reconcile(); return false; }
        }
        File file = apk();
        if (file.exists() && !file.delete()) throw new IllegalStateException("No se puede preparar la descarga");
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Alejandra — actualización");
        request.setDescription(automatic ? "Descarga automática por Wi-Fi" : "Descargando actualización");
        request.setMimeType("application/vnd.android.package-archive");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalFilesDir(context, null, "alejandra-update.apk");
        request.setAllowedOverRoaming(false);
        request.setAllowedOverMetered(!automatic);
        if (automatic) request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI);
        long id = downloads.enqueue(request);
        // Persistir antes de resolver la llamada: recuperar incluso si el proceso desaparece.
        if (!state.edit().putLong("id", id).putLong("expected", expected).putBoolean("automatic", automatic).commit()) {
            downloads.remove(id);
            throw new IllegalStateException("No se pudo guardar el estado de actualización");
        }
        offeredId = -1;
        reconcile();
        return true;
    }

    private File apk() {
        File dir = context.getExternalFilesDir(null);
        if (dir == null) throw new IllegalStateException("Almacenamiento de actualización no disponible");
        return new File(dir, "alejandra-update.apk");
    }

    private void checkLatest() {
        if (closed || downloads == null || state.contains("id") || !checking.compareAndSet(false, true)) return;
        worker.execute(() -> {
            HttpURLConnection connection = null;
            try {
                long now = System.currentTimeMillis();
                if (now - state.getLong("checked", 0) < 6 * 60 * 60 * 1000L) return;
                ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
                if (cm == null || cm.getActiveNetwork() == null) return;
                connection = (HttpURLConnection) new URL(UpdatePolicy.API).openConnection();
                connection.setConnectTimeout(15000); connection.setReadTimeout(15000);
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("User-Agent", "Alejandra-Android-Updater");
                if (connection.getResponseCode() != 200) return;
                byte[] bytes;
                try (java.io.InputStream in = connection.getInputStream();
                     java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096]; int n;
                    while ((n = in.read(buffer)) != -1) {
                        if (out.size() + n > 262144) return;
                        out.write(buffer, 0, n);
                    }
                    bytes = out.toByteArray();
                }
                if (bytes.length > 262144) return;
                JSONObject release = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
                long version = UpdatePolicy.releaseVersion(release.optString("tag_name"),
                        release.optBoolean("draft"), release.optBoolean("prerelease"));
                if (version <= version(installed())) { state.edit().putLong("checked", now).apply(); return; }
                JSONArray assets = release.optJSONArray("assets");
                if (assets == null) return;
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    if (!"alejandra.apk".equals(asset.optString("name"))) continue;
                    String url = asset.optString("browser_download_url");
                    if (!UpdatePolicy.trustedUrl(url)) return;
                    download(url, version, true);
                    state.edit().putLong("checked", now).apply();
                    return;
                }
            } catch (Exception ignored) {
                // Offline/API no disponible: reintentar al volver, sin bloquear la suite.
            } finally { if (connection != null) connection.disconnect(); checking.set(false); }
        });
    }

    private void reconcile() {
        if (closed || downloads == null) return;
        worker.execute(() -> {
            long id = state.getLong("id", -1);
            if (id < 0) return;
            try (Cursor cursor = downloads.query(new DownloadManager.Query().setFilterById(id))) {
                if (cursor == null || !cursor.moveToFirst()) { forget(id); return; }
                int status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                if (status == DownloadManager.STATUS_FAILED) { forget(id); message("No se pudo descargar la actualización. Puedes reintentarlo desde Ajustes."); return; }
                if (status != DownloadManager.STATUS_SUCCESSFUL) return;
                PackageInfo local = installed();
                PackageInfo remote = context.getPackageManager().getPackageArchiveInfo(apk().getPath(), flags());
                if (remote != null && local.packageName.equals(remote.packageName) && version(remote) <= version(local)) {
                    forget(id); message("No hay una versión más nueva que la instalada."); return;
                }
                if (remote == null || !UpdatePolicy.canInstall(local.packageName, remote.packageName,
                        version(local), version(remote), state.getLong("expected", 0), signers(local), signers(remote))) {
                    forget(id); message("La actualización no es válida para esta app. No se instalará."); return;
                }
                activity.runOnUiThread(() -> offer(id, remote.versionName));
            } catch (Exception e) { message("No se pudo comprobar la actualización. Reintenta desde Ajustes."); }
        });
    }

    private void offer(long id, String version) {
        if (closed || !foreground || activity.isFinishing() || activity.isDestroyed()
                || id != state.getLong("id", -1) || offeredId == id || dialog != null) return;
        offeredId = id;
        dialog = new AlertDialog.Builder(activity).setTitle("Alejandra " + version + " lista")
                .setMessage("La actualización está descargada. Guarda tu trabajo antes de instalarla.")
                .setPositiveButton("Instalar", (d, which) -> install())
                .setNegativeButton("Más tarde", (d, which) -> {})
                .create();
        dialog.setOnDismissListener(d -> dialog = null);
        dialog.show();
    }

    private void install() {
        try {
            if (Build.VERSION.SDK_INT >= 26 && !context.getPackageManager().canRequestPackageInstalls()) {
                state.edit().putBoolean("permission", true).apply();
                activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + context.getPackageName())));
                return;
            }
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk());
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent);
            // Cancelar el instalador no borra la APK; se puede volver desde Ajustes.
        } catch (Exception e) { message("No se pudo abrir el instalador de Android. Reintenta desde Ajustes."); }
    }

    private synchronized void forget(long id) {
        if (id != state.getLong("id", -1)) return;
        downloads.remove(id);
        state.edit().remove("id").remove("expected").remove("permission").remove("automatic").commit();
    }

    private void message(String text) {
        activity.runOnUiThread(() -> { if (!closed && foreground) Toast.makeText(activity, text, Toast.LENGTH_LONG).show(); });
    }
    private PackageInfo installed() throws Exception { return context.getPackageManager().getPackageInfo(context.getPackageName(), flags()); }
    private static int flags() { return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES; }
    private static long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private static Set<String> signers(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
                ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        Set<String> result = new HashSet<>();
        if (signatures != null) for (Signature signature : signatures) {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(signature.toByteArray());
            result.add(android.util.Base64.encodeToString(hash, android.util.Base64.NO_WRAP));
        }
        return result;
    }

    void retryReady() { offeredId = -1; reconcile(); }
}
