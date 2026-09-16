package com.padilla585.alejandra.ar;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.google.ar.core.Anchor;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Point;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.Trackable;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.NotYetAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.ShortBuffer;
import java.util.ArrayList;
import java.util.List;
import android.media.Image;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * F3.1 — Sesión AR nativa (ARCore) para replantear: muestra la cámara, apuntas con el retículo,
 * pulsas "Punto" y coloca una marca anclada en esa superficie; mide la longitud del recorrido y
 * devuelve los puntos 3D a la web (que arma el replanteo con los endpoints ya existentes).
 * Render mínimo (cámara + overlay 2D); la instalación 3D realista llega en F3.2.
 */
public class ReplanteoARActivity extends Activity implements GLSurfaceView.Renderer {

    private static final int RC_CAMERA = 2001;

    private GLSurfaceView surfaceView;
    private OverlayView overlay;
    private TextView infoText;
    private final BackgroundRenderer background = new BackgroundRenderer();

    private Session session;
    private boolean installRequested = false;
    private boolean cameraPermissionRequested = false;

    private int viewportW = 1, viewportH = 1;
    private boolean viewportChanged = false;

    private final List<Anchor> anchors = new ArrayList<>();
    private volatile boolean pendingPoint = false;
    // FASE-A-AR-PAREDES-LISAS-01: modo "Tocar" explícito -- ancla por profundidad/instant
    // placement a corta distancia aunque no haya ninguna superficie reconocida bajo el retículo.
    private volatile boolean pendingContact = false;
    // Última distancia estimada por la Depth API bajo el centro de la pantalla (metros), o -1 si
    // no hay profundidad disponible en este frame. Se usa como approximateDistanceMeters para
    // instant placement -- mucho más preciso que un valor fijo cuando el dispositivo lo soporta.
    private float ultimaProfundidadM = -1f;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // AR-INSETS-01: forzar edge-to-edge explícito en vez de depender del default de
        // targetSdk 35+ -- así el ajuste de insets de abajo funciona igual en cualquier
        // dispositivo/fabricante, no solo en los que ya lo activan por su cuenta.
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        FrameLayout root = new FrameLayout(this);

        surfaceView = new GLSurfaceView(this);
        surfaceView.setPreserveEGLContextOnPause(true);
        surfaceView.setEGLContextClientVersion(2);
        surfaceView.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        surfaceView.setRenderer(this);
        surfaceView.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        root.addView(surfaceView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        overlay = new OverlayView(this);
        root.addView(overlay, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        infoText = new TextView(this);
        infoText.setTextColor(Color.WHITE);
        infoText.setTextSize(15f);
        infoText.setPadding(28, 40, 28, 20);
        infoText.setText("Apunta con el círculo a la superficie y pulsa Punto.");
        infoText.setShadowLayer(6f, 0f, 2f, Color.BLACK);
        root.addView(infoText, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(20, 16, 20, 40);
        FrameLayout.LayoutParams barLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        root.addView(bar, barLp);

        bar.addView(makeBtn("📍 Punto", "#f97316", "#ffffff", 2f, v -> pendingPoint = true));
        // FASE-A-AR-PAREDES-LISAS-01 (16/09/2026): Adrián probando en el HTC -- "no me detecta
        // las paredes blancas... le cuesta mucho". La PWA (WebXR) ya tenía este mismo botón
        // ("📱 Tocar con el móvil (pared lisa)") para anclar por contacto cuando ni el hit-test
        // ni la profundidad enganchan en una superficie lisa/sin textura -- aquí no existía.
        bar.addView(makeBtn("📱 Tocar", "#38bdf8", "#062a3d", 1.6f, v -> pendingContact = true));
        bar.addView(makeBtn("↩", "#ffffff", "#111111", 1f, v -> undo()));
        bar.addView(makeBtn("✖", "#000000", "#ffffff", 1f, v -> { setResult(RESULT_CANCELED); finish(); }));
        bar.addView(makeBtn("✅ Fin", "#22c55e", "#ffffff", 1.4f, v -> terminar()));

        // AR-INSETS-01 (15/09/2026): Adrián probando el AR real -- "no se ven los controles" --
        // y en la captura el texto superior se solapaba con la barra de estado (hora/batería).
        // Android 15+ (targetSdk 35, este proyecto ya compila con compileSdk 36) pinta las
        // apps edge-to-edge POR DEFECTO -- el contenido llega hasta los bordes reales de la
        // pantalla salvo que la Activity reserve hueco ella misma. index.html/MainActivity ya
        // se adaptaron esta semana (StatusBar.setOverlaysWebView + env(safe-area-inset-*) en
        // CSS), pero esta es una Activity nativa APARTE con su propia ventana -- ese fix no la
        // cubre. Sin gestionar los insets, la barra de estado tapaba el texto de arriba y la
        // barra de navegación (gestos/botones) tapaba o dejaba casi sin margen la fila de
        // botones de abajo. Se añade el inset real de systemBars() al padding fijo que ya
        // tenía cada vista, en vez de sustituirlo -- así se conserva el aire visual original.
        final int infoPadL = 28, infoPadT = 40, infoPadR = 28, infoPadB = 20;
        ViewCompat.setOnApplyWindowInsetsListener(infoText, (v, insets) -> {
            int top = insets.getInsets(WindowInsetsCompat.Type.systemBars()).top;
            v.setPadding(infoPadL, infoPadT + top, infoPadR, infoPadB);
            return insets;
        });
        final int barPadL = 20, barPadT = 16, barPadR = 20, barPadB = 40;
        ViewCompat.setOnApplyWindowInsetsListener(bar, (v, insets) -> {
            int bottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;
            v.setPadding(barPadL, barPadT, barPadR, barPadB + bottom);
            return insets;
        });

        setContentView(root);
    }

    private Button makeBtn(String text, String bg, String fg, float weight, View.OnClickListener onClick) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextColor(Color.parseColor(fg));
        b.setBackgroundColor(Color.parseColor(bg));
        b.setOnClickListener(onClick);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, weight);
        lp.setMargins(6, 0, 6, 0);
        b.setLayoutParams(lp);
        return b;
    }

    private void undo() {
        if (!anchors.isEmpty()) { anchors.remove(anchors.size() - 1).detach(); }
    }

    private void terminar() {
        JSONArray arr = new JSONArray();
        double longitud = 0;
        Pose prev = null;
        for (Anchor a : anchors) {
            Pose p = a.getPose();
            try {
                JSONObject o = new JSONObject();
                o.put("x", round3(p.tx())); o.put("y", round3(p.ty())); o.put("z", round3(p.tz()));
                // REPL-AR-NATIVO-01: el quaternion de rotacion del Anchor ya estaba disponible
                // aqui (viene del Pose de ARCore) pero no se enviaba -- sin el, la web no puede
                // saber hacia donde mira la pared/techo en ese punto, solo su posicion. Se manda
                // para que index.html pueda orientar la instalacion segun la superficie real.
                o.put("qx", round3(p.qx())); o.put("qy", round3(p.qy()));
                o.put("qz", round3(p.qz())); o.put("qw", round3(p.qw()));
                arr.put(o);
            } catch (Exception ignored) {}
            if (prev != null) {
                double dx = p.tx() - prev.tx(), dy = p.ty() - prev.ty(), dz = p.tz() - prev.tz();
                longitud += Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            prev = p;
        }
        Intent data = new Intent();
        data.putExtra("puntos", arr.toString());
        data.putExtra("longitud", Math.round(longitud * 100.0) / 100.0);
        setResult(RESULT_OK, data);
        finish();
    }

    private static double round3(double v) { return Math.round(v * 1000.0) / 1000.0; }

    @Override
    protected void onResume() {
        super.onResume();
        if (session == null) {
            try {
                switch (ArCoreApk.getInstance().requestInstall(this, !installRequested)) {
                    case INSTALL_REQUESTED: installRequested = true; return;
                    case INSTALLED: break;
                }
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    if (!cameraPermissionRequested) {
                        cameraPermissionRequested = true;
                        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, RC_CAMERA);
                    }
                    return;
                }
                session = new Session(this);
                Config config = new Config(session);
                config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
                config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
                if (session.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) config.setDepthMode(Config.DepthMode.AUTOMATIC);
                config.setInstantPlacementMode(Config.InstantPlacementMode.LOCAL_Y_UP);
                session.configure(config);
            } catch (UnavailableUserDeclinedInstallationException | UnavailableArcoreNotInstalledException e) {
                fail("Hace falta Google Play Services para RA."); return;
            } catch (UnavailableDeviceNotCompatibleException e) {
                fail("Este dispositivo no es compatible con ARCore."); return;
            } catch (UnavailableApkTooOldException | UnavailableSdkTooOldException e) {
                fail("Actualiza Google Play Services para RA."); return;
            } catch (Exception e) {
                fail("No se pudo iniciar la RA: " + e.getMessage()); return;
            }
        }
        try {
            session.resume();
        } catch (CameraNotAvailableException e) {
            fail("Cámara no disponible."); session = null; return;
        }
        surfaceView.onResume();
        viewportChanged = true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (session != null) {
            surfaceView.onPause();
            session.pause();
        }
    }

    @Override
    public void onRequestPermissionsResult(int rc, @NonNull String[] p, @NonNull int[] r) {
        super.onRequestPermissionsResult(rc, p, r);
        if (rc == RC_CAMERA && (r.length == 0 || r[0] != PackageManager.PERMISSION_GRANTED)) {
            fail("Sin permiso de cámara no se puede replantear en RA.");
        }
    }

    private void fail(String msg) {
        runOnUiThread(() -> {
            Intent data = new Intent();
            data.putExtra("error", msg);
            setResult(RESULT_CANCELED, data);
            finish();
        });
    }

    // ── GLSurfaceView.Renderer ──────────────────────────────────────────────
    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        GLES20.glClearColor(0f, 0f, 0f, 1f);
        background.createOnGlThread();
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int width, int height) {
        GLES20.glViewport(0, 0, width, height);
        viewportW = width; viewportH = height; viewportChanged = true;
    }

    @Override
    public void onDrawFrame(GL10 gl) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        if (session == null) return;
        if (viewportChanged) {
            int rotation = getWindowManager().getDefaultDisplay().getRotation();
            session.setDisplayGeometry(rotation, viewportW, viewportH);
            viewportChanged = false;
        }
        try {
            session.setCameraTextureName(background.getTextureId());
            Frame frame = session.update();
            Camera camera = frame.getCamera();
            background.draw(frame);

            boolean tracking = camera.getTrackingState() == TrackingState.TRACKING;
            ultimaProfundidadM = tracking ? estimarProfundidadCentroM(frame) : -1f;

            if (pendingPoint && tracking) {
                pendingPoint = false;
                colocarEnReticulo(frame);
            } else if (pendingPoint && !tracking) {
                pendingPoint = false;
                runOnUiThread(() -> infoText.setText("Mueve el móvil despacio para que la cámara se sitúe, y vuelve a pulsar Punto."));
            }
            if (pendingContact && tracking) {
                pendingContact = false;
                colocarPorContacto(frame);
            } else if (pendingContact && !tracking) {
                pendingContact = false;
                runOnUiThread(() -> infoText.setText("Mueve el móvil despacio para que la cámara se sitúe, y vuelve a pulsar Tocar."));
            }

            // Proyección de los anclajes a coordenadas de pantalla
            float[] view = new float[16], proj = new float[16], vp = new float[16];
            camera.getViewMatrix(view, 0);
            camera.getProjectionMatrix(proj, 0, 0.1f, 100f);
            Matrix.multiplyMM(vp, 0, proj, 0, view, 0);
            float[] screen = new float[anchors.size() * 2];
            for (int i = 0; i < anchors.size(); i++) {
                Pose p = anchors.get(i).getPose();
                float[] world = {p.tx(), p.ty(), p.tz(), 1f};
                float[] clip = new float[4];
                Matrix.multiplyMV(clip, 0, vp, 0, world, 0);
                if (clip[3] <= 0f) { screen[i * 2] = Float.NaN; screen[i * 2 + 1] = Float.NaN; continue; }
                float ndcx = clip[0] / clip[3], ndcy = clip[1] / clip[3];
                screen[i * 2] = (ndcx * 0.5f + 0.5f) * viewportW;
                screen[i * 2 + 1] = (1f - (ndcy * 0.5f + 0.5f)) * viewportH;
            }
            overlay.setPoints(screen);
            // FASE-A-AR-PAREDES-LISAS-01: retículo de tres estados (ver OverlayView) -- naranja
            // solo cuando hay plano/punto confirmado bajo el círculo, azul cuando eso falla pero
            // instant placement/profundidad podría anclar igualmente (lo que antes no se veía:
            // el usuario pulsaba "Punto" a ciegas y solo se enteraba del fallo después).
            int reticleState = OverlayView.RETICLE_NONE;
            if (tracking) {
                boolean hayHitReal = false;
                for (HitResult h : frame.hitTest(viewportW / 2f, viewportH / 2f)) {
                    Trackable t = h.getTrackable();
                    if ((t instanceof Plane && ((Plane) t).isPoseInPolygon(h.getHitPose())) || t instanceof Point) { hayHitReal = true; break; }
                }
                reticleState = hayHitReal ? OverlayView.RETICLE_HIT : OverlayView.RETICLE_FALLBACK;
            }
            overlay.setReticleState(reticleState);
            actualizarInfo(tracking);
        } catch (CameraNotAvailableException e) {
            fail("Cámara no disponible.");
        } catch (Throwable t) {
            // Un fallo de GL/render no debe cerrar la app en silencio.
        }
    }

    // Profundidad bajo el centro de la pantalla en metros, o -1 si no hay dato disponible este
    // frame (dispositivo sin Depth API, imagen aún no lista, o profundidad inválida ahí).
    private float estimarProfundidadCentroM(Frame frame) {
        try (Image depth = frame.acquireDepthImage16Bits()) {
            int w = depth.getWidth(), h = depth.getHeight();
            Image.Plane plane = depth.getPlanes()[0];
            ShortBuffer buf = plane.getBuffer().asShortBuffer();
            int rowStrideShorts = plane.getRowStride() / 2;
            short raw = buf.get((h / 2) * rowStrideShorts + (w / 2));
            int mm = raw & 0x1FFF; // 13 bits de profundidad en milimetros (formato DEPTH16 de ARCore)
            return mm > 0 ? mm / 1000f : -1f;
        } catch (Exception e) {
            return -1f; // sin Depth API, imagen aun no lista, etc. -- no es un error real
        }
    }

    private void colocarEnReticulo(Frame frame) {
        List<HitResult> hits = frame.hitTest(viewportW / 2f, viewportH / 2f);
        HitResult chosen = null;
        for (HitResult hit : hits) {
            Trackable t = hit.getTrackable();
            if (t instanceof Plane && ((Plane) t).isPoseInPolygon(hit.getHitPose())) { chosen = hit; break; }
            if (t instanceof Point && chosen == null) chosen = hit;
        }
        if (chosen == null && !hits.isEmpty()) chosen = hits.get(0);
        // FASE-A-AR-PAREDES-LISAS-01 (16/09/2026): Adrián -- "no me detecta las paredes
        // blancas... le cuesta mucho". Sin plano/punto confirmado, en vez de rendirse ya
        // mismo, instant placement (ya activado en la config de la sesión) con la distancia
        // real de la Depth API si la hay, o una estimación fija razonable si no -- misma idea
        // que el respaldo por profundidad que ya tenía la PWA (WebXR) para este caso exacto.
        if (chosen == null) {
            float distancia = ultimaProfundidadM > 0 ? ultimaProfundidadM : 2.0f;
            List<HitResult> ip = frame.hitTestInstantPlacement(viewportW / 2f, viewportH / 2f, distancia);
            if (!ip.isEmpty()) chosen = ip.get(0);
        }
        if (chosen == null) {
            runOnUiThread(() -> infoText.setText("Sin superficie ni profundidad bajo el círculo. Acerca el móvil al punto y pulsa 📱 Tocar."));
            return;
        }
        anchors.add(chosen.createAnchor());
    }

    // "Tocar": el móvil está pegado o casi pegado a la superficie -- mismo botón y misma idea
    // que "📱 Tocar con el móvil (pared lisa)" en la PWA (WebXR), para paredes/techos lisos
    // donde ni el hit-test ni una estimación de profundidad a distancia normal enganchan.
    private void colocarPorContacto(Frame frame) {
        List<HitResult> ip = frame.hitTestInstantPlacement(viewportW / 2f, viewportH / 2f, 0.1f);
        if (ip.isEmpty()) {
            runOnUiThread(() -> infoText.setText("No se pudo anclar por contacto. Prueba de nuevo, bien pegado a la superficie."));
            return;
        }
        anchors.add(ip.get(0).createAnchor());
    }

    private void actualizarInfo(boolean tracking) {
        double longitud = 0; Pose prev = null;
        for (Anchor a : anchors) {
            Pose p = a.getPose();
            if (prev != null) {
                double dx = p.tx() - prev.tx(), dy = p.ty() - prev.ty(), dz = p.tz() - prev.tz();
                longitud += Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            prev = p;
        }
        final int n = anchors.size();
        final String lon = String.format(java.util.Locale.US, "%.2f", longitud).replace('.', ',');
        runOnUiThread(() -> {
            if (n == 0) infoText.setText("Apunta con el círculo a la superficie y pulsa Punto.");
            else if (n == 1) infoText.setText("1 punto. Apunta al siguiente y pulsa Punto.");
            else infoText.setText(n + " puntos · " + lon + " m");
        });
    }
}
