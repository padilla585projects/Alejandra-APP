package com.padilla585.alejandra.ar;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.widget.ArrayAdapter;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
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

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.FloatBuffer;
import java.nio.ShortBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;
import android.media.Image;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * F3.1 — Sesión AR nativa (ARCore) para replantear: muestra la cámara, apuntas con el retículo,
 * pulsas "Punto" y coloca una marca anclada en esa superficie; mide la longitud del recorrido y
 * devuelve los puntos 3D a la web (que arma el replanteo con los endpoints ya existentes).
 * REPL-AR-OVERLAY-01 (17/09/2026): el render 3D real (trazado + complementos, con la misma
 * geometría por tipo de material que usa la PWA) lo pinta threeOverlay, un WebView transparente
 * superpuesto a la cámara que carga three.js + repl3d.js (ver assets/ar/overlay.html) -- este
 * archivo solo le manda las matrices de cámara reales de ARCore cada frame y el trazado/
 * complementos cuando cambian. No se reimplementa la geometría en Java: se reutiliza tal cual.
 */
public class ReplanteoARActivity extends Activity implements GLSurfaceView.Renderer {

    private static final int RC_CAMERA = 2001;

    private GLSurfaceView surfaceView;
    private WebView threeOverlay;
    private OverlayView overlay;
    private TextView infoText;
    private Spinner compSpinner;
    private volatile int compSeleccionado = 0;
    private volatile String superficieObjetivo = "auto";
    // REPL-SUPERFICIE-FORZADA-01 (03/10/2026, prioridad 4): con Techo/Pared/Suelo el primer punto
    // del tramo fija el plano y los siguientes se fuerzan a él (TrazadoGeometria; paridad con
    // _replArAnclajeForzado de la PWA). Solo se tocan en el hilo GL; cambiar el selector lo suelta.
    private volatile boolean soltarPlanoFijo = false;
    private float[] planoFijoPos = null, planoFijoNormal = null;
    // REPL-ANGULO-RECTO-01 / REPL-PARALELOS-01: diagonal real por tramo y superficie forzada de
    // cada punto (paralelas a `anchors` por índice), líneas en paralelo, y la longitud del
    // recorrido rectificado que devuelve el overlay (repl3d.js); -1 mientras no la haya calculado.
    private final List<Boolean> tramoDiagonal = new ArrayList<>();
    private final List<String> puntoSuperficie = new ArrayList<>();
    private volatile int paralelosN = 1;
    private volatile float huecoParaleloM = 0.03f;
    private volatile double longitudRectificadaM = -1;
    // REPL-EDITAR-PUNTO-01: punto en edición (-1 = ninguno), acción pendiente para el hilo GL y lo
    // que el panel necesita saber de cada punto (se copia en el hilo GL al sincronizar el overlay).
    private volatile int selPunto = -1, nPuntos = 0;
    private volatile String pendingAccionPunto = null;
    private volatile String[] etiquetasPuntos = new String[0];
    private volatile boolean[] diagonalesPuntos = new boolean[0];
    private LinearLayout panelPunto;
    private TextView tituloPunto;
    private Button btnDiagonal;
    private FrameLayout.LayoutParams panelEscaneoLp;
    private interface AlElegir { void elegir(int posicion); }
    private String estadoSuperficie = "Explora suelo, techo y paredes moviendo el móvil despacio.";
    private String resumenPlanos = "Sin planos confirmados";
    private final BackgroundRenderer background = new BackgroundRenderer();

    // Intent de abrirAR(): elemento elegido antes de entrar en AR (mismo elemento_key/params que
    // ya usa el flujo de Foto), para que overlay.html sepa qué tipo de render y ancho aplicar.
    private String elementoKey = "generico_lineal";
    private String elementoParamsJson = "{}";
    // REPL-AR-IDENTIFICAR-01: para llamar a POST /replanteos/identificar con la misma sesión
    // que la web -- ver el comentario junto a ReplanteoARPlugin.abrirAR().
    private String apiBase = "";
    private String authToken = "";
    private final List<String> fotos = new ArrayList<>();
    private final java.util.concurrent.ExecutorService redExecutor = Executors.newSingleThreadExecutor();

    private Session session;
    private boolean installRequested = false;
    private boolean cameraPermissionRequested = false;

    private int viewportW = 1, viewportH = 1;
    private boolean viewportChanged = false;
    private int lastDisplayRotation = -1;
    private volatile boolean overlayReady = false;

    // REPL-AR-AJUSTE-01 (17/09/2026): ox/oy/oz/rotZ son el ajuste fino manual (⬅⬆⬇➡/↻) que se
    // suma a la pose real del Anchor al renderizar/exportar -- igual que _ar.complementos[].pos
    // en la PWA, que también es mutable tras colocar. No se toca el Anchor de ARCore (es
    // inmutable en posición una vez creado); el offset vive aparte y se combina en el momento de
    // pintar/serializar.
    private static final class Complemento {
        final Anchor anchor; final String key;
        float ox = 0, oy = 0, oz = 0;
        float rotZ = 0; // radianes acumulados sobre el eje local Z (mismo eje que gira replArRotarComp en la PWA)
        Complemento(Anchor anchor, String key) { this.anchor = anchor; this.key = key; }
    }
    private final List<Anchor> anchors = new ArrayList<>();
    // REPL-AR-PROFUNDIDAD-MANUAL-01 (17/09/2026): Adrián -- "sigue saliendo al aire la
    // instalación en vez de en la pared" incluso tras la mediana de profundidad + planos de
    // referencia. En paredes blancas lisas ARCore a veces simplemente NO tiene ningún dato de
    // profundidad fiable que usar (ni Depth API ni plano confirmado) -- ahí, adivinar una
    // distancia por software tiene un techo real. La solución que sí funciona siempre: dejar que
    // el usuario corrija la distancia a mano (⬅⬆⬇➡ ya movían complementos; aquí se añade
    // profundidad -- acercar/alejar el PUNTO del trazado a lo largo de hacia dónde mira la
    // cámara). Un offset en metros por punto (paralelo a "anchors" por índice), igual criterio
    // que Complemento.ox/oy/oz -- el Anchor de ARCore no se toca.
    private final List<float[]> puntoOffsets = new ArrayList<>(); // [ox,oy,oz] por punto de anchors
    private final List<Complemento> complementos = new ArrayList<>();
    // REPL-AR-NATIVO-COMP-01: un único historial de acciones (punto de trazado o complemento
    // colocado) para que "↩" deshaga lo último que se hizo, sea de un tipo o del otro -- igual
    // que _ar.ultimoFueComp en la PWA (WebXR).
    private final List<String> accionLog = new ArrayList<>();
    private volatile boolean pendingPoint = false;
    private volatile boolean pendingUndo = false, pendingFinish = false;
    private String ultimaPoseContenido = "";
    // FASE-A-AR-PAREDES-LISAS-01: modo "Tocar" explícito -- ancla por profundidad/instant
    // placement a corta distancia aunque no haya ninguna superficie reconocida bajo el retículo.
    private volatile boolean pendingContact = false;
    // REPL-AR-NATIVO-COMP-01 (17/09/2026): Adrián -- "en la apk faltan los accesorios como
    // cajas, enchufes etc [comparado con la pwa]". pendingComp + colocarComplemento() colocan el
    // complemento elegido en el retículo; threeOverlay (ver REPL-AR-OVERLAY-01) lo dibuja con la
    // geometría real de repl3d.js, no una caja de bulto.
    private volatile boolean pendingComp = false;
    // REPL-AR-AJUSTE-01: ⬅⬆⬇➡ (mover 2 cm relativo a pantalla) y ↻ (girar 15°) del último
    // complemento colocado -- se resuelven en onDrawFrame porque necesitan la pose actual de la
    // cámara (mismo patrón que pendingPoint/pendingContact/pendingComp de arriba).
    private volatile boolean pendingNudge = false;
    private volatile int pendingNudgeDx = 0, pendingNudgeDy = 0, pendingNudgeDepth = 0;
    private volatile boolean pendingRotar = false;
    // RENDIMIENTO-AR-CAMARA-01: contador de frames para el retículo (ver onDrawFrame) -- el
    // hit-test que decide su color se recalcula cada 3 frames en vez de en todos.
    private int frameCount = 0;
    private int reticleStateCache = OverlayView.RETICLE_NONE;
    // REPL-AR-OVERLAY-01: se pone a true cada vez que cambian los puntos/complementos (colocar,
    // deshacer) para que onDrawFrame reconstruya la escena de threeOverlay una sola vez, no en
    // cada frame -- el trazado no cambia entre frames salvo que el usuario toque un botón.
    private volatile boolean contenidoSucio = false;

    // ADR-0027: escaneo del entorno + IA de visión (ver el bloque de métodos más abajo).
    private String departamento = "";
    private String obraId = "";
    private volatile boolean faseEscaneo = true;     // cartel "Escanea el entorno": aún no se marca
    private volatile String escaneoId = null;
    private volatile boolean iaActiva = false, iaPedida = true;
    private volatile int framesIA = 0, iaMax = EscaneoEntorno.MAX_IA;
    private volatile boolean escaneoEnVuelo = false;
    private long ultimoEnvioEscaneo = 0, ultimaUIEscaneo = 0, inicioEscaneo = 0;
    private volatile int fallosEscaneo = 0;
    private volatile String resumenIA = "", motivoSinIA = "";
    private volatile int planosConfirmados = 0;
    private final List<float[]> posesGuardadas = new ArrayList<>();
    private final java.util.IdentityHashMap<Plane, String> planoIds = new java.util.IdentityHashMap<>();
    private int sigPlanoId = 1;
    private final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.ConcurrentHashMap<String, Integer>> votosPlanos = new java.util.concurrent.ConcurrentHashMap<>();
    private final List<InstalacionIA> instalacionesIA = new ArrayList<>();
    private volatile boolean finalizando = false, pendingFinishDirecto = false, terminado = false;
    private volatile String avisoIA = "";
    private LinearLayout panelEscaneo, bottomStackRef;
    private TextView escaneoProgreso, escaneoIA;
    private Button btnEscaneoListo, btnEscaneoSinIA;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // AR-INSETS-01: forzar edge-to-edge explícito en vez de depender del default de
        // targetSdk 35+ -- así el ajuste de insets de abajo funciona igual en cualquier
        // dispositivo/fabricante, no solo en los que ya lo activan por su cuenta.
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // REPL-AR-OVERLAY-01: elemento elegido antes de entrar en AR (ver ReplanteoARPlugin.
        // abrirAR) -- si faltan (build vieja de la web sin este extra, o se abrió sin elemento)
        // se queda con el genérico por defecto, que overlay.html ya sabe dibujar.
        if (getIntent() != null) {
            String k = getIntent().getStringExtra("elemento_key");
            String p = getIntent().getStringExtra("elemento_params");
            if (k != null && !k.isEmpty()) elementoKey = k;
            if (p != null && !p.isEmpty()) elementoParamsJson = p;
            String ab = getIntent().getStringExtra("api_base");
            String tk = getIntent().getStringExtra("token");
            if (ab != null) apiBase = ab;
            if (tk != null) authToken = tk;
            String dp = getIntent().getStringExtra("departamento");
            String ob = getIntent().getStringExtra("obra_id");
            if (dp != null) departamento = dp;
            if (ob != null) obraId = ob;
        }

        FrameLayout root = new FrameLayout(this);

        surfaceView = new GLSurfaceView(this);
        surfaceView.setPreserveEGLContextOnPause(true);
        surfaceView.setEGLContextClientVersion(2);
        surfaceView.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        surfaceView.setRenderer(this);
        surfaceView.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        root.addView(surfaceView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // REPL-AR-OVERLAY-01: WebView transparente encima de la cámara (three.js + repl3d.js,
        // ver assets/ar/overlay.html), debajo del overlay 2D (retículo/puntos) y de los botones
        // -- no necesita recibir toques (todo se maneja con los botones nativos de siempre), así
        // que no interfiere con nada de lo que ya funcionaba.
        threeOverlay = new WebView(this);
        threeOverlay.setBackgroundColor(Color.TRANSPARENT);
        threeOverlay.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        threeOverlay.setClickable(false);
        threeOverlay.setFocusable(false);
        WebSettings ws = threeOverlay.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(false);
        threeOverlay.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR
                        && message.sourceId().startsWith("file:///android_asset/ar/")) {
                    // Registrar ubicación, nunca mensajes que puedan incluir datos recibidos.
                    android.util.Log.e("AlejandraAR", "Error de overlay JS en línea " + message.lineNumber());
                }
                return true;
            }
        });
        threeOverlay.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                if (isFinishing() || isDestroyed()) return;
                view.evaluateJavascript("typeof actualizarCamara === 'function' && typeof actualizarContenido === 'function' && typeof actualizarPlanos === 'function'", result -> {
                    if (isFinishing() || isDestroyed()) return;
                    overlayReady = "true".equals(result);
                    android.util.Log.i("AlejandraAR", overlayReady ? "Overlay 3D listo" : "Overlay 3D no disponible");
                    if (overlayReady) contenidoSucio = true;
                    else estadoSuperficie = "Render 3D no disponible. Sal y vuelve a entrar en AR.";
                });
            }
        });
        root.addView(threeOverlay, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        threeOverlay.loadUrl("file:///android_asset/ar/overlay.html");

        overlay = new OverlayView(this);
        root.addView(overlay, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // REPL-EDITAR-PUNTO-01 (03/10/2026, prioridad 4): tocar un punto ya colocado (no solo el
        // último) lo selecciona para pegarlo a techo/pared, moverlo, esquivar o borrarlo. Los
        // botones están encima y reciben sus toques antes que esta capa.
        final float radioToque = 36 * getResources().getDisplayMetrics().density;
        overlay.setOnTouchListener((v, ev) -> {
            if (ev.getActionMasked() == MotionEvent.ACTION_UP) {
                v.performClick();
                if (!faseEscaneo) {
                    int i = TrazadoGeometria.puntoMasCercano(overlay.getPuntos(), ev.getX(), ev.getY(), radioToque);
                    if (i >= 0) seleccionarPunto(i);
                }
            }
            return true;
        });

        infoText = new TextView(this);
        infoText.setTextColor(Color.WHITE);
        infoText.setTextSize(15f);
        infoText.setPadding(28, 40, 28, 20);
        infoText.setText("Apunta con el círculo a la superficie y pulsa Punto.");
        infoText.setShadowLayer(6f, 0f, 2f, Color.BLACK);
        root.addView(infoText, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        // REPL-AR-NATIVO-COMP-01: fila de complementos, encima de la barra de trazado -- selector
        // del tipo (mismas keys que REPL_COMPLEMENTOS en repl3d.js) + botón para colocarlo en el
        // retículo, igual que el desplegable + "➕ Colocar" que ya tenía el AR de la PWA (WebXR).
        // Las dos filas van dentro del mismo contenedor vertical: como hermanos sueltos con
        // Gravity.BOTTOM cada una en el FrameLayout raíz, se pintarían una encima de la otra.
        LinearLayout bottomStack = new LinearLayout(this);
        bottomStack.setOrientation(LinearLayout.VERTICAL);
        FrameLayout.LayoutParams bottomStackLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        root.addView(bottomStack, bottomStackLp);
        // ADR-0027: los controles de marcado aparecen cuando termina el escaneo.
        bottomStackRef = bottomStack;
        bottomStack.setVisibility(View.GONE);
        panelEscaneo = new LinearLayout(this);
        panelEscaneo.setOrientation(LinearLayout.VERTICAL);
        panelEscaneo.setPadding(28, 22, 28, 28);
        panelEscaneo.setBackgroundColor(Color.parseColor("#dd080c14"));
        TextView tituloEscaneo = new TextView(this);
        tituloEscaneo.setText("🔎 Escanea el entorno");
        tituloEscaneo.setTextColor(Color.WHITE);
        tituloEscaneo.setTextSize(18f);
        panelEscaneo.addView(tituloEscaneo);
        TextView guiaEscaneo = new TextView(this);
        guiaEscaneo.setText("Mueve el móvil despacio enfocando paredes, techo y suelo de la zona del recorrido, y las instalaciones que ya haya. La IA va reconociendo qué es cada cosa.");
        guiaEscaneo.setTextColor(Color.parseColor("#cbd5e1"));
        guiaEscaneo.setTextSize(13f);
        panelEscaneo.addView(guiaEscaneo);
        escaneoProgreso = new TextView(this);
        escaneoProgreso.setTextColor(Color.WHITE);
        escaneoProgreso.setTextSize(13f);
        escaneoProgreso.setPadding(0, 10, 0, 4);
        panelEscaneo.addView(escaneoProgreso);
        escaneoIA = new TextView(this);
        escaneoIA.setTextColor(Color.parseColor("#c4b5fd"));
        escaneoIA.setTextSize(12.5f);
        escaneoIA.setPadding(0, 0, 0, 10);
        panelEscaneo.addView(escaneoIA);
        LinearLayout filaEscaneo = new LinearLayout(this);
        filaEscaneo.setOrientation(LinearLayout.HORIZONTAL);
        panelEscaneo.addView(filaEscaneo, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        btnEscaneoListo = makeBtn("⏳ Escaneando…", "#22c55e", "#ffffff", 2f, v -> escaneoListo());
        btnEscaneoListo.setEnabled(false);
        btnEscaneoListo.setAlpha(0.45f);
        filaEscaneo.addView(btnEscaneoListo);
        btnEscaneoSinIA = makeBtn("Continuar sin IA", "#334155", "#ffffff", 1.3f, v -> { iaActiva = false; iaPedida = false; motivoSinIA = "IA desactivada a mano."; escaneoListo(); });
        filaEscaneo.addView(btnEscaneoSinIA);
        filaEscaneo.addView(makeBtn("✖", "#000000", "#ffffff", 0.6f, v -> { setResult(RESULT_CANCELED); finish(); }));
        panelEscaneoLp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        root.addView(panelEscaneo, panelEscaneoLp);
        final int escPadB = 28;
        ViewCompat.setOnApplyWindowInsetsListener(panelEscaneo, (v, insets) -> {
            androidx.core.graphics.Insets in = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(28 + in.left, 22, 28 + in.right, escPadB + in.bottom);
            return insets;
        });
        inicioEscaneo = System.currentTimeMillis();
        if (!apiBase.isEmpty() && !authToken.isEmpty()) redExecutor.execute(this::iniciarEscaneoRed);
        else motivoSinIA = "Sin sesión de la app: escaneo solo geométrico.";

        // REPL-AR-PANEL-MOD-01 (17/09/2026): Adrián -- "no llenes la pantalla de iconos... con
        // un botón flotante que no moleste". Antes cada función nueva (complementos, ajuste
        // fino, profundidad manual, foto, identificar) añadía su propia fila SIEMPRE visible --
        // 4 filas encima de la barra principal, ocupando media pantalla. Se consolidan todas
        // dentro de un panel plegable (mismo patrón que btnReplArMod/replArPanelMod en la PWA,
        // WebXR), que solo se ve si el usuario lo abre con el botón flotante ✥.
        LinearLayout panelMod = new LinearLayout(this);
        panelMod.setOrientation(LinearLayout.VERTICAL);
        panelMod.setPadding(20, 10, 20, 10);
        panelMod.setBackgroundColor(Color.parseColor("#d9000000"));
        panelMod.setVisibility(View.GONE);
        // GIRO-PANTALLA-AR-01 (03/10/2026): en horizontal el panel ✥ (ahora con más filas) no cabe
        // en ~360 dp de alto y empujaba la barra fuera de la pantalla: se desplaza dentro de un
        // máximo del 45 % del alto en vez de crecer sin límite.
        ScrollView scrollMod = new ScrollView(this) {
            @Override protected void onMeasure(int anchoSpec, int altoSpec) {
                int max = (int) (getResources().getDisplayMetrics().heightPixels * 0.45f);
                super.onMeasure(anchoSpec, MeasureSpec.makeMeasureSpec(max, MeasureSpec.AT_MOST));
            }
        };
        scrollMod.addView(panelMod, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        bottomStack.addView(scrollMod, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // REPL-SUPERFICIE-FORZADA-01: antes solo filtraba planos; ahora además el primer punto del
        // tramo fija el plano y los siguientes se fuerzan a él. Cambiarlo empieza un tramo nuevo.
        Spinner superficieSpinner = crearSpinner(new String[]{"Superficie del tramo: automática",
                "🔒 Forzar pared (fija el plano del 1.er punto)", "🔒 Forzar suelo (fija el plano del 1.er punto)",
                "🔒 Forzar techo (fija el plano del 1.er punto)"}, posicion -> {
            superficieObjetivo = new String[]{"auto", "pared", "suelo", "techo"}[posicion];
            soltarPlanoFijo = true;
        });
        panelMod.addView(superficieSpinner);

        // REPL-PARALELOS-01 (prioridad 3): mismas opciones que el ⚙️ de la PWA.
        LinearLayout parRow = new LinearLayout(this);
        parRow.setOrientation(LinearLayout.HORIZONTAL);
        panelMod.addView(parRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        String[] nombresPar = new String[8];
        for (int k = 1; k <= 8; k++) nombresPar[k - 1] = k == 1 ? "1 línea" : k + " en paralelo";
        final float[] huecos = {0f, 0.01f, 0.02f, 0.03f, 0.05f, 0.08f, 0.1f, 0.15f, 0.2f};
        String[] nombresHueco = new String[huecos.length];
        for (int k = 0; k < huecos.length; k++) nombresHueco[k] = "hueco " + Math.round(huecos[k] * 100) + " cm";
        Spinner parSpinner = crearSpinner(nombresPar, posicion -> { paralelosN = posicion + 1; contenidoSucio = true; });
        Spinner huecoSpinner = crearSpinner(nombresHueco, posicion -> { huecoParaleloM = huecos[posicion]; contenidoSucio = true; });
        huecoSpinner.setSelection(3);
        parRow.addView(parSpinner, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        parRow.addView(huecoSpinner, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        LinearLayout compRow = new LinearLayout(this);
        compRow.setOrientation(LinearLayout.HORIZONTAL);
        compRow.setPadding(0, 0, 0, 8);
        panelMod.addView(compRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        compSpinner = new Spinner(this);
        String[] nombres = new String[ReplComplementosNativo.CATALOGO.length];
        for (int i = 0; i < nombres.length; i++) nombres[i] = ReplComplementosNativo.CATALOGO[i].nombre;
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, nombres);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        compSpinner.setAdapter(adapter);
        compSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) { compSeleccionado = position; }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });
        LinearLayout.LayoutParams spinnerLp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 2.4f);
        compRow.addView(compSpinner, spinnerLp);
        compRow.addView(makeBtn("➕ Colocar", "#a855f7", "#ffffff", 1.3f, v -> pendingComp = true));

        // REPL-AR-AJUSTE-01: mover (2 cm relativo a pantalla) y girar (15°) el último
        // punto/complemento colocado -- mismos ⬅⬆⬇➡/↻ que ya tenía la PWA (WebXR).
        LinearLayout ajusteRow = new LinearLayout(this);
        ajusteRow.setOrientation(LinearLayout.HORIZONTAL);
        ajusteRow.setPadding(0, 0, 0, 8);
        panelMod.addView(ajusteRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        ajusteRow.addView(makeBtn("⬅", "#ffffff", "#111111", 1f, v -> nudge(-1, 0)));
        ajusteRow.addView(makeBtn("⬆", "#ffffff", "#111111", 1f, v -> nudge(0, 1)));
        ajusteRow.addView(makeBtn("⬇", "#ffffff", "#111111", 1f, v -> nudge(0, -1)));
        ajusteRow.addView(makeBtn("➡", "#ffffff", "#111111", 1f, v -> nudge(1, 0)));
        ajusteRow.addView(makeBtn("↻", "#a855f7", "#ffffff", 1f, v -> { pendingRotar = true; }));

        // REPL-AR-PROFUNDIDAD-MANUAL-01: "sigue saliendo al aire la instalación en vez de en la
        // pared" -- corrige a mano la distancia real a la cámara (lo que ⬅⬆⬇➡ no puede
        // arreglar) del último punto/complemento colocado.
        LinearLayout profRow = new LinearLayout(this);
        profRow.setOrientation(LinearLayout.HORIZONTAL);
        profRow.setPadding(0, 0, 0, 8);
        panelMod.addView(profRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        profRow.addView(makeBtn("⏪ Acercar", "#38bdf8", "#062a3d", 1f, v -> nudgeProfundidad(-1)));
        profRow.addView(makeBtn("⏩ Alejar", "#38bdf8", "#062a3d", 1f, v -> nudgeProfundidad(1)));

        // REPL-AR-FOTO-01 / REPL-AR-IDENTIFICAR-01: documentación fotográfica e identificación
        // con IA -- mismos 📸/🔍 que ya tenía la PWA (WebXR), que aquí no existían.
        LinearLayout utilRow = new LinearLayout(this);
        utilRow.setOrientation(LinearLayout.HORIZONTAL);
        panelMod.addView(utilRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        utilRow.addView(makeBtn("📸 Foto", "#ffffff", "#111111", 1f, v -> tomarFoto()));
        utilRow.addView(makeBtn("🔍 Identificar", "#8b5cf6", "#ffffff", 1f, v -> identificarIA()));
        LinearLayout editRow = new LinearLayout(this);
        editRow.setOrientation(LinearLayout.HORIZONTAL);
        editRow.setPadding(0, 8, 0, 0);
        panelMod.addView(editRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        editRow.addView(makeBtn("✏️ Editar cualquier punto", "#facc15", "#111111", 1f, v -> editarPuntos()));

        // REPL-EDITAR-PUNTO-01: panel del punto en edición (se abre tocándolo o con ✏️).
        panelPunto = new LinearLayout(this);
        panelPunto.setOrientation(LinearLayout.VERTICAL);
        panelPunto.setPadding(20, 10, 20, 10);
        panelPunto.setBackgroundColor(Color.parseColor("#e6000000"));
        panelPunto.setVisibility(View.GONE);
        bottomStack.addView(panelPunto, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout filaTitulo = new LinearLayout(this);
        filaTitulo.setOrientation(LinearLayout.HORIZONTAL);
        filaTitulo.setGravity(Gravity.CENTER_VERTICAL);
        panelPunto.addView(filaTitulo, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        filaTitulo.addView(makeBtn("◀", "#ffffff", "#111111", 0.7f, v -> navegarPunto(-1)));
        tituloPunto = new TextView(this);
        tituloPunto.setTextColor(Color.WHITE);
        tituloPunto.setTextSize(13f);
        tituloPunto.setGravity(Gravity.CENTER);
        filaTitulo.addView(tituloPunto, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 2.6f));
        filaTitulo.addView(makeBtn("▶", "#ffffff", "#111111", 0.7f, v -> navegarPunto(1)));
        filaTitulo.addView(makeBtn("✖", "#000000", "#ffffff", 0.7f, v -> seleccionarPunto(-1)));
        LinearLayout filaA = new LinearLayout(this);
        filaA.setOrientation(LinearLayout.HORIZONTAL);
        filaA.setPadding(0, 8, 0, 0);
        panelPunto.addView(filaA, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        filaA.addView(makeBtn("📌 Techo", "#38bdf8", "#062a3d", 1f, v -> accionPunto("techo")));
        filaA.addView(makeBtn("🧱 Pared", "#38bdf8", "#062a3d", 1f, v -> accionPunto("pared")));
        filaA.addView(makeBtn("🎯 Mover", "#f97316", "#ffffff", 1f, v -> accionPunto("mover")));
        LinearLayout filaB = new LinearLayout(this);
        filaB.setOrientation(LinearLayout.HORIZONTAL);
        filaB.setPadding(0, 8, 0, 0);
        panelPunto.addView(filaB, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        filaB.addView(makeBtn("↪ Esquivar", "#facc15", "#111111", 1f, v -> accionPunto("esquivar")));
        btnDiagonal = makeBtn("⟂ Recto", "#ffffff", "#111111", 1f, v -> accionPunto("diagonal"));
        filaB.addView(btnDiagonal);
        filaB.addView(makeBtn("🗑 Borrar", "#ef4444", "#ffffff", 1f, v -> accionPunto("borrar")));

        // Botón flotante que abre/cierra el panel de arriba -- una sola fila siempre visible en
        // vez de las 4 de antes.
        LinearLayout fabRow = new LinearLayout(this);
        fabRow.setOrientation(LinearLayout.HORIZONTAL);
        fabRow.setGravity(Gravity.END);
        fabRow.setPadding(20, 0, 20, 4);
        bottomStack.addView(fabRow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        Button fab = new Button(this);
        fab.setText("✥");
        fab.setAllCaps(false);
        fab.setTextColor(Color.WHITE);
        fab.setBackgroundColor(Color.parseColor("#a855f7"));
        LinearLayout.LayoutParams fabLp = new LinearLayout.LayoutParams(140, ViewGroup.LayoutParams.WRAP_CONTENT);
        fab.setLayoutParams(fabLp);
        fab.setOnClickListener(v -> panelMod.setVisibility(panelMod.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        fabRow.addView(fab);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setPadding(20, 16, 20, 40);
        bottomStack.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        bar.addView(makeBtn("📍 Punto", "#f97316", "#ffffff", 2f, v -> pendingPoint = true));
        // FASE-A-AR-PAREDES-LISAS-01 (16/09/2026): Adrián probando en el HTC -- "no me detecta
        // las paredes blancas... le cuesta mucho". La PWA (WebXR) ya tenía este mismo botón
        // ("📱 Tocar con el móvil (pared lisa)") para anclar por contacto cuando ni el hit-test
        // ni la profundidad enganchan en una superficie lisa/sin textura -- aquí no existía.
        bar.addView(makeBtn("📱 Tocar", "#38bdf8", "#062a3d", 1.6f, v -> pendingContact = true));
        bar.addView(makeBtn("↩", "#ffffff", "#111111", 1f, v -> pendingUndo = true));
        bar.addView(makeBtn("✖", "#000000", "#ffffff", 1f, v -> { setResult(RESULT_CANCELED); finish(); }));
        bar.addView(makeBtn("✅ Fin", "#22c55e", "#ffffff", 1.4f, v -> pendingFinish = true));

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
        // GIRO-PANTALLA-AR-01: en horizontal la barra de navegación y la muesca quedan a un lado;
        // se suman también los insets laterales (antes solo arriba/abajo).
        final int infoPadL = 28, infoPadT = 40, infoPadR = 28, infoPadB = 20;
        ViewCompat.setOnApplyWindowInsetsListener(infoText, (v, insets) -> {
            androidx.core.graphics.Insets in = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(infoPadL + in.left, infoPadT + in.top, infoPadR + in.right, infoPadB);
            return insets;
        });
        final int barPadL = 20, barPadT = 16, barPadR = 20, barPadB = 40;
        ViewCompat.setOnApplyWindowInsetsListener(bar, (v, insets) -> {
            androidx.core.graphics.Insets in = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(barPadL + in.left, barPadT, barPadR + in.right, barPadB + in.bottom);
            return insets;
        });

        setContentView(root);
        ajustarDisposicion(getResources().getConfiguration());
    }

    // GIRO-PANTALLA-AR-01 (03/10/2026): la Activity declara configChanges de orientación/tamaño en
    // el manifest, así que girar NO la recrea: la sesión ARCore, las anclas y el overlay siguen
    // vivos (onSurfaceChanged + setDisplayGeometry en onDrawFrame reajustan cámara y proyección; el
    // WebView recibe 'resize'). Aquí solo se recolocan los paneles para la nueva orientación.
    @Override
    public void onConfigurationChanged(@NonNull Configuration nueva) {
        super.onConfigurationChanged(nueva);
        android.util.Log.i("AlejandraAR", "Giro de pantalla: " + (nueva.orientation == Configuration.ORIENTATION_LANDSCAPE ? "horizontal" : "vertical"));
        ajustarDisposicion(nueva);
        contenidoSucio = true;
    }

    private void ajustarDisposicion(Configuration c) {
        if (panelEscaneo == null || panelEscaneoLp == null) return;
        boolean horizontal = c.orientation == Configuration.ORIENTATION_LANDSCAPE;
        // En horizontal el cartel de escaneo ocupa el lado izquierdo, no toda la anchura.
        panelEscaneoLp.width = horizontal ? (int) (getResources().getDisplayMetrics().widthPixels * 0.62f) : ViewGroup.LayoutParams.MATCH_PARENT;
        panelEscaneoLp.gravity = horizontal ? (Gravity.BOTTOM | Gravity.START) : Gravity.BOTTOM;
        panelEscaneo.setLayoutParams(panelEscaneoLp);
    }

    private Spinner crearSpinner(String[] opciones, AlElegir alElegir) {
        Spinner s = new Spinner(this);
        ArrayAdapter<String> ad = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, opciones);
        ad.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        s.setAdapter(ad);
        s.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(AdapterView<?> parent, View view, int position, long id) { alElegir.elegir(position); }
            @Override public void onNothingSelected(AdapterView<?> parent) {}
        });
        return s;
    }

    // ADR-0027 (paridad con _replArAtras de la PWA): atrás durante el escaneo cancela; con un
    // recorrido ya marcado (>= 2 puntos) hace lo mismo que ✅ Fin, para no perder el trabajo.
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (selPunto >= 0) { seleccionarPunto(-1); return; }   // REPL-EDITAR-PUNTO-01: primero cierra el panel
        if (!faseEscaneo && anchors.size() >= 2 && !finalizando) { pendingFinish = true; return; }
        setResult(RESULT_CANCELED);
        finish();
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
        // REPL-AR-NATIVO-COMP-01: deshace lo ÚLTIMO hecho (punto o complemento), no siempre un
        // punto -- antes de accionLog, "↩" tras colocar un complemento no hacía nada visible
        // (el complemento se quedaba) porque solo miraba la lista de puntos.
        if (accionLog.isEmpty()) return;
        String last = accionLog.remove(accionLog.size() - 1);
        if ("comp".equals(last) && !complementos.isEmpty()) {
            complementos.remove(complementos.size() - 1).anchor.detach();
        } else if (!anchors.isEmpty()) {
            anchors.remove(anchors.size() - 1).detach();
            if (!puntoOffsets.isEmpty()) puntoOffsets.remove(puntoOffsets.size() - 1);
            if (!tramoDiagonal.isEmpty()) tramoDiagonal.remove(tramoDiagonal.size() - 1);
            if (!puntoSuperficie.isEmpty()) puntoSuperficie.remove(puntoSuperficie.size() - 1);
            if (selPunto >= anchors.size()) { selPunto = -1; runOnUiThread(this::actualizarPanelPunto); }
        }
        contenidoSucio = true;
    }

    private void terminar() {
        if (terminado) return;
        terminado = true;
        JSONArray arr = new JSONArray();
        double longitud = 0;
        double[] prev = null;
        for (int i = 0; i < anchors.size(); i++) {
            Pose p = anchors.get(i).getPose();
            float[] off = i < puntoOffsets.size() ? puntoOffsets.get(i) : new float[]{0f, 0f, 0f};
            double px = p.tx() + off[0], py = p.ty() + off[1], pz = p.tz() + off[2];
            try {
                JSONObject o = new JSONObject();
                o.put("x", round3(px)); o.put("y", round3(py)); o.put("z", round3(pz));
                // REPL-AR-NATIVO-01: el quaternion de rotacion del Anchor ya estaba disponible
                // aqui (viene del Pose de ARCore) pero no se enviaba -- sin el, la web no puede
                // saber hacia donde mira la pared/techo en ese punto, solo su posicion. Se manda
                // para que index.html pueda orientar la instalacion segun la superficie real.
                o.put("qx", round3(p.qx())); o.put("qy", round3(p.qy()));
                o.put("qz", round3(p.qz())); o.put("qw", round3(p.qw()));
                // REPL-ANGULO-RECTO-01: d = el tramo que empieza aquí va en diagonal real.
                // REPL-SUPERFICIE-FORZADA-01: s = superficie forzada con la que se marcó.
                if (i < tramoDiagonal.size() && tramoDiagonal.get(i)) o.put("d", true);
                if (i < puntoSuperficie.size() && puntoSuperficie.get(i) != null) o.put("s", puntoSuperficie.get(i));
                arr.put(o);
            } catch (Exception ignored) {}
            if (prev != null) {
                double dx = px - prev[0], dy = py - prev[1], dz = pz - prev[2];
                longitud += Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            prev = new double[]{px, py, pz};
        }
        // REPL-AR-NATIVO-COMP-01: mismo formato de campos (x/y/z/qx/qy/qz/qw) que los puntos de
        // arriba, más "key" -- _replArTerminarNativo() en index.html los traduce al formato
        // {key,x,y,z,q:{...}} que ya usa _repl.complementos (WebXR y cálculo de material).
        JSONArray compArr = new JSONArray();
        for (Complemento c : complementos) {
            Pose p = c.anchor.getPose();
            // REPL-AR-AJUSTE-01: mismo combinado offset+rotación que sincronizarContenidoOverlay
            // -- lo que se ve en el AR es lo que se guarda, no la pose original sin ajustar.
            float[] q = orientacionComplemento(p, c.rotZ);
            try {
                JSONObject o = new JSONObject();
                o.put("key", c.key);
                o.put("x", round3(p.tx() + c.ox)); o.put("y", round3(p.ty() + c.oy)); o.put("z", round3(p.tz() + c.oz));
                o.put("qx", round3(q[0])); o.put("qy", round3(q[1]));
                o.put("qz", round3(q[2])); o.put("qw", round3(q[3]));
                compArr.put(o);
            } catch (Exception ignored) {}
        }
        Intent data = new Intent();
        data.putExtra("puntos", arr.toString());
        data.putExtra("longitud", Math.round(longitud * 100.0) / 100.0);
        data.putExtra("complementos", compArr.toString());
        // REPL-AR-FOTO-01: fotos de documentación tomadas con 📸 durante la sesión.
        data.putExtra("fotos", new JSONArray(fotos).toString());
        // ADR-0027: los fotogramas del escaneo ya están en R2; la web solo necesita el id.
        if (escaneoId != null) data.putExtra("escaneo_id", escaneoId);
        // REPL-PARALELOS-01: líneas en paralelo elegidas en el panel ✥.
        if (paralelosN > 1) {
            try {
                JSONObject par = new JSONObject();
                par.put("n", paralelosN); par.put("hueco_m", (double) huecoParaleloM);
                data.putExtra("paralelos", par.toString());
            } catch (Exception ignored) {}
        }
        runOnUiThread(() -> { setResult(RESULT_OK, data); finish(); });
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
                // REPL-AR-AUTOFOCO-01 (17/09/2026): Adrián -- "tenemos que hacer algo para que
                // detecte paredes suelo y techo". FocusMode nunca se tocaba -- el valor por
                // defecto de ARCore es FIXED (enfoque fijo, calibrado a distancia media, por
                // compatibilidad histórica con apps antiguas), no AUTO. Este es trabajo de
                // replanteo eléctrico/mecánico A CORTA DISTANCIA (a veces <1 m de la pared) --
                // con enfoque fijo esas tomas pueden salir borrosas, y ARCore detecta planos a
                // partir de puntos de esquina/textura en la imagen: una imagen borrosa tiene
                // muchos menos puntos fiables que detectar, sea cual sea el color de la pared.
                // Es un fallo conocido y muy citado de ARCore ("se te olvidó activar AUTO").
                config.setFocusMode(Config.FocusMode.AUTO);
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
    protected void onDestroy() {
        redExecutor.shutdownNow();
        overlayReady = false;
        // onPause ya ha parado el hilo GL: liberar recursos antes de otra sesión.
        for (Anchor anchor : anchors) anchor.detach();
        for (Complemento comp : complementos) comp.anchor.detach();
        anchors.clear();
        complementos.clear();
        puntoOffsets.clear();
        accionLog.clear();
        if (session != null) { session.close(); session = null; }
        if (threeOverlay != null) {
            if (threeOverlay.getParent() instanceof ViewGroup)
                ((ViewGroup) threeOverlay.getParent()).removeView(threeOverlay);
            threeOverlay.stopLoading();
            threeOverlay.destroy();
            threeOverlay = null;
        }
        super.onDestroy();
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
        int rotation = getWindowManager().getDefaultDisplay().getRotation();
        // Un giro de 180° conserva ancho/alto: onSurfaceChanged no siempre se dispara.
        if (viewportChanged || rotation != lastDisplayRotation) {
            session.setDisplayGeometry(rotation, viewportW, viewportH);
            lastDisplayRotation = rotation;
            viewportChanged = false;
        }
        try {
            session.setCameraTextureName(background.getTextureId());
            Frame frame = session.update();
            Camera camera = frame.getCamera();
            background.draw(frame);

            // Las listas de anclas pertenecen al hilo GL, también al deshacer/exportar.
            if (pendingUndo) { pendingUndo = false; undo(); }
            if (pendingFinishDirecto) { pendingFinishDirecto = false; terminar(); return; }
            boolean pedirFin = false;
            if (pendingFinish) { pendingFinish = false; pedirFin = true; }   // ADR-0027: antes, último fotograma clave
            // ADR-0027: durante el escaneo no se marca (los botones están ocultos; por si acaso).
            if (faseEscaneo) { pendingPoint = false; pendingContact = false; pendingComp = false; }
            if (soltarPlanoFijo) { soltarPlanoFijo = false; planoFijoPos = null; planoFijoNormal = null; }

            boolean tracking = camera.getTrackingState() == TrackingState.TRACKING;
            // RENDIMIENTO-AR-CAMARA-01 (17/09/2026): Adrian -- "la camara va a saltos". Antes
            // estimarProfundidadCentroM() (adquiere y lee una imagen de profundidad de ARCore,
            // no es gratis) se llamaba en TODOS los frames, ~30-60 veces por segundo, aunque su
            // resultado solo se usa en el instante en que se pulsa Punto/Tocar/Colocar -- ahora
            // se calcula solo ahi dentro (resolverAnclaje), bajo demanda.

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
            if (pendingComp && tracking) {
                pendingComp = false;
                colocarComplemento(frame);
            } else if (pendingComp && !tracking) {
                pendingComp = false;
                runOnUiThread(() -> infoText.setText("Mueve el móvil despacio para que la cámara se sitúe, y vuelve a pulsar ➕ Colocar."));
            }
            if (pendingNudge) {
                pendingNudge = false;
                aplicarNudge(camera, pendingNudgeDx, pendingNudgeDy, pendingNudgeDepth);
                pendingNudgeDepth = 0;
            }
            if (pendingRotar) {
                pendingRotar = false;
                aplicarRotar();
            }
            if (pendingAccionPunto != null) {
                String accion = pendingAccionPunto;
                pendingAccionPunto = null;
                aplicarAccionPunto(frame, accion, tracking);
            }

            // Proyección de los anclajes a coordenadas de pantalla
            float[] view = new float[16], proj = new float[16], vp = new float[16];
            camera.getViewMatrix(view, 0);
            camera.getProjectionMatrix(proj, 0, 0.1f, 100f);
            Matrix.multiplyMM(vp, 0, proj, 0, view, 0);
            if (pedirFin) iniciarFin(view.clone(), proj.clone());
            tickEscaneo(tracking, view, proj);   // ADR-0027

            // REPL-AR-OVERLAY-01: la cámara de Three.js (en threeOverlay) se sincroniza con la
            // MISMA vista/proyección reales de ARCore -- por eso el trazado/complementos 3D que
            // pinta el WebView encajan exactamente sobre la cámara física. Cada 2 frames (no
            // todos): el puente JS de evaluateJavascript no es gratis y ya se quitó trabajo
            // redundante del render loop una vez (RENDIMIENTO-AR-CAMARA-01), no queremos meter
            // otro causante de saltos por sincronizar más veces de las que hacen falta para que
            // se vea fluido.
            if (overlayReady && frameCount % 2 == 0) sincronizarCamaraOverlay(view, proj);
            if (frameCount % 15 == 0) comprobarPosesContenido();
            if (overlayReady && contenidoSucio) { contenidoSucio = false; sincronizarContenidoOverlay(); }
            // REFERENCIA-PLANOS-AR-01 (17/09/2026): Adrian, probando en una pared blanca lisa --
            // "no detecta bien las paredes... deberia tener referencias para saber colocarlo". El
            // usuario no tenia forma de ver QUE ha detectado ARCore realmente antes de pulsar
            // Punto: si el plano encontrado era pequeno, estaba mal orientado, o ni siquiera era
            // la pared (p.ej. trozo de suelo reflejado), el punto se anclaba igual de "bien" a
            // ojos de la app y el trazado aparecia mal colocado despues, sin pista de por que.
            // Se pintan los planos detectados como rejilla translucida en el overlay -- igual que
            // hacen los ejemplos oficiales de ARCore -- para que el usuario vea la superficie real
            // trackeada antes de marcar nada. Cada 15 frames (no cada frame): la lista de planos
            // cambia poco a poco mientras se escanea, no hace falta al ritmo de camara/contenido.
            if (overlayReady && frameCount % 15 == 0) sincronizarPlanosOverlay();

            float[] screen = new float[anchors.size() * 2];
            for (int i = 0; i < anchors.size(); i++) {
                Pose p = anchors.get(i).getPose();
                float[] off = puntoOffsets.get(i);
                float[] world = {p.tx() + off[0], p.ty() + off[1], p.tz() + off[2], 1f};
                float[] clip = new float[4];
                Matrix.multiplyMV(clip, 0, vp, 0, world, 0);
                if (clip[3] <= 0f) { screen[i * 2] = Float.NaN; screen[i * 2 + 1] = Float.NaN; continue; }
                float ndcx = clip[0] / clip[3], ndcy = clip[1] / clip[3];
                screen[i * 2] = (ndcx * 0.5f + 0.5f) * viewportW;
                screen[i * 2 + 1] = (1f - (ndcy * 0.5f + 0.5f)) * viewportH;
            }
            nPuntos = anchors.size();
            overlay.setPoints(screen);
            // FASE-A-AR-PAREDES-LISAS-01: retículo de tres estados (ver OverlayView) -- naranja
            // solo cuando hay plano/punto confirmado bajo el círculo, azul cuando eso falla pero
            // instant placement/profundidad podría anclar igualmente (lo que antes no se veía:
            // el usuario pulsaba "Punto" a ciegas y solo se enteraba del fallo después).
            // RENDIMIENTO-AR-CAMARA-01: frame.hitTest() para esto NO es gratis -- recalcularlo en
            // cada uno de los 30-60 frames/s solo para el color del retículo era otra causa de los
            // saltos. Cada 3 frames (~10-20 Hz según el dispositivo) sigue siendo instantáneo a la
            // vista y cuesta un tercio.
            frameCount++;
            if (frameCount % 3 == 0) {
                int reticleState = OverlayView.RETICLE_NONE;
                if (tracking) {
                    boolean hayHitReal = false;
                    float[] hitPos = null;
                    for (HitResult h : frame.hitTest(viewportW / 2f, viewportH / 2f)) {
                        Trackable t = h.getTrackable();
                        if (t instanceof Plane && aceptaPlano((Plane) t) && ((Plane) t).isPoseInPolygon(h.getHitPose())) { hayHitReal = true; hitPos = h.getHitPose().getTranslation(); break; }
                    }
                    reticleState = hayHitReal ? OverlayView.RETICLE_HIT : OverlayView.RETICLE_FALLBACK;
                    // ADR-0027: aviso ANTES de pulsar si el círculo cae sobre una instalación existente.
                    String sobre = (!faseEscaneo && hitPos != null) ? instalacionCercana(hitPos) : null;
                    avisoIA = sobre != null ? "⚠ El círculo está sobre una instalación existente: " + sobre : "";
                }
                reticleStateCache = reticleState;
            }
            overlay.setReticleState(reticleStateCache);
            actualizarInfo(tracking);
        } catch (CameraNotAvailableException e) {
            fail("Cámara no disponible.");
        } catch (Throwable t) {
            // Un fallo de GL/render no debe cerrar la app en silencio.
        }
    }

    // Profundidad bajo el centro de la pantalla en metros, o -1 si no hay dato disponible este
    // frame (dispositivo sin Depth API, imagen aún no lista, o profundidad inválida ahí).
    // MEDIANA-PROFUNDIDAD-01 (17/09/2026): un solo texel de la imagen de profundidad es ruidoso
    // -- en superficies lisas/poco texturizadas (pared blanca) es fácil que ese único píxel caiga
    // en un hueco sin dato (0) o en una lectura errática aislada, aunque los píxeles de alrededor
    // sean coherentes. Se muestrea una pequeña cruz de 5 puntos alrededor del centro y se toma la
    // mediana de los válidos -- mismo criterio que cualquier filtro de profundidad básico, barato
    // y sin dependencias nuevas.
    private float estimarProfundidadCentroM(Frame frame) {
        try (Image depth = frame.acquireDepthImage16Bits()) {
            int w = depth.getWidth(), h = depth.getHeight();
            Image.Plane plane = depth.getPlanes()[0];
            ShortBuffer buf = plane.getBuffer().order(ByteOrder.LITTLE_ENDIAN).asShortBuffer();
            int rowStrideShorts = plane.getRowStride() / 2;
            int cx = w / 2, cy = h / 2, r = Math.max(1, Math.min(w, h) / 40);
            int[][] offsets = {{0, 0}, {-r, 0}, {r, 0}, {0, -r}, {0, r}};
            List<Integer> validasMm = new ArrayList<>(offsets.length);
            for (int[] off : offsets) {
                int px = Math.max(0, Math.min(w - 1, cx + off[0]));
                int py = Math.max(0, Math.min(h - 1, cy + off[1]));
                short raw = buf.get(py * rowStrideShorts + px);
                int mm = SurfaceGeometry.depthMm(raw); // D_16 ARCore: 16 bits en milímetros.
                if (mm > 100 && mm < 8000) validasMm.add(mm);
            }
            if (validasMm.isEmpty()) return -1f;
            java.util.Collections.sort(validasMm);
            float m = validasMm.get(validasMm.size() / 2) / 1000f;
            return m;
        } catch (Exception e) {
            return -1f; // sin Depth API, imagen aun no lista, etc. -- no es un error real
        }
    }

    // Una fuente de verdad para filtrar planos al colocar trazado y complementos.
    private boolean aceptaPlano(Plane plane) {
        return plane.getTrackingState() == TrackingState.TRACKING && plane.getSubsumedBy() == null
                && !planoExcluidoPorIA(plane)   // ADR-0027: la IA dice que es un mueble/mesa
                && ("auto".equals(superficieObjetivo) || superficieObjetivo.equals(
                    SurfaceGeometry.type(plane.getCenterPose().getYAxis()[1])));
    }

    private void comprobarPosesContenido() {
        StringBuilder firma = new StringBuilder();
        for (Anchor a : anchors) agregarFirmaPose(firma, a.getPose());
        for (Complemento c : complementos) agregarFirmaPose(firma, c.anchor.getPose());
        String actual = firma.toString();
        if (!actual.equals(ultimaPoseContenido)) { ultimaPoseContenido = actual; contenidoSucio = true; }
    }

    private static void agregarFirmaPose(StringBuilder firma, Pose pose) {
        for (float v : pose.getTranslation()) firma.append(Math.round(v * 1000)).append(',');
        for (float v : pose.getRotationQuaternion()) firma.append(Math.round(v * 1000)).append(',');
        firma.append(';');
    }

    // Pegado también por profundidad, solo dentro del contorno y a <=15 cm del plano.
    private Anchor anclarEnPlano(Pose referencia) {
        Plane mejor = null;
        Pose mejorPose = null;
        float distancia = Float.MAX_VALUE;
        for (Plane plane : session.getAllTrackables(Plane.class)) {
            if (!aceptaPlano(plane)) continue;
            Pose center = plane.getCenterPose();
            float[] projected = SurfaceGeometry.project(referencia.getTranslation(), center.getTranslation(), center.getYAxis());
            if (projected == null) continue;
            Pose pose = new Pose(projected, center.getRotationQuaternion());
            if (!plane.isPoseInPolygon(pose)) continue;
            float[] original = referencia.getTranslation();
            float d = 0;
            for (int i = 0; i < 3; i++) d += (original[i] - projected[i]) * (original[i] - projected[i]);
            if (d < distancia) { distancia = d; mejor = plane; mejorPose = pose; }
        }
        if (mejor == null) return null;
        estadoSuperficie = SurfaceGeometry.type(mejor.getCenterPose().getYAxis()[1]) + " detectado · punto pegado a la superficie";
        return mejor.createAnchor(mejorPose);
    }

    private Anchor resolverAnclaje(Frame frame, boolean contacto) {
        Pose camara = frame.getCamera().getPose();
        if (!contacto) {
            HitResult punto = null;
            for (HitResult hit : frame.hitTest(viewportW / 2f, viewportH / 2f)) {
                Trackable t = hit.getTrackable();
                if (t instanceof Plane && aceptaPlano((Plane) t) && ((Plane) t).isPoseInPolygon(hit.getHitPose())) {
                    Plane plane = (Plane) t;
                    estadoSuperficie = SurfaceGeometry.type(plane.getCenterPose().getYAxis()[1]) + " detectado · punto pegado a la superficie";
                    return plane.createAnchor(new Pose(hit.getHitPose().getTranslation(), plane.getCenterPose().getRotationQuaternion()));
                }
                if (t instanceof Point && t.getTrackingState() == TrackingState.TRACKING
                        && ((Point) t).getOrientationMode() == Point.OrientationMode.ESTIMATED_SURFACE_NORMAL && punto == null) punto = hit;
            }
            if (punto != null) {
                Anchor pegado = anclarEnPlano(punto.getHitPose());
                if (pegado != null) return pegado;
                if ("auto".equals(superficieObjetivo)) {
                    estadoSuperficie = "Superficie estimada por puntos · comprueba la colocación";
                    return punto.createAnchor();
                }
            }
        }
        float metros = contacto ? 0.1f : estimarProfundidadCentroM(frame);
        if (metros <= 0) {
            estadoSuperficie = "Sin superficie confirmada ni profundidad actual. Explora una esquina o usa Tocar.";
            return null;
        }
        // +Y local hacia la cámara: aproximación explícita, nunca una superficie reconocida.
        Pose referencia = camara.compose(Pose.makeTranslation(0, 0, -metros))
                .compose(Pose.makeRotation(0.70710678f, 0, 0, 0.70710678f));
        Anchor pegado = anclarEnPlano(referencia);
        if (pegado != null) return pegado;
        if (!contacto && !"auto".equals(superficieObjetivo)) {
            estadoSuperficie = "Aún no se confirma " + superficieObjetivo + " aquí. Explora su borde o esquina.";
            return null;
        }
        estadoSuperficie = contacto ? "Contacto manual · comprueba la colocación" : "Profundidad aproximada · superficie sin confirmar";
        return session.createAnchor(referencia);
    }

    // REPL-AR-OVERLAY-01: pasa las matrices reales de ARCore a la cámara de Three.js en
    // threeOverlay (ver overlay.html actualizarCamara) -- mismo espacio de coordenadas, no hace
    // falta transformar nada. evaluateJavascript exige hilo de UI; onDrawFrame corre en el hilo
    // de GL, de ahí el runOnUiThread.
    private void sincronizarCamaraOverlay(float[] view, float[] proj) {
        if (threeOverlay == null) return;
        final String js = "actualizarCamara(" + floatArrayJs(view) + "," + floatArrayJs(proj) + ")";
        runOnUiThread(() -> { try { threeOverlay.evaluateJavascript(js, null); } catch (Exception ignored) {} });
    }

    // Reconstruye el trazado + complementos en threeOverlay cuando cambian (no en cada frame).
    private void sincronizarContenidoOverlay() {
        if (threeOverlay == null) return;
        JSONArray path = new JSONArray();
        for (int i = 0; i < anchors.size(); i++) {
            Pose p = anchors.get(i).getPose();
            float[] off = i < puntoOffsets.size() ? puntoOffsets.get(i) : null;
            JSONObject o = new JSONObject();
            try {
                o.put("x", p.tx() + (off != null ? off[0] : 0));
                o.put("y", p.ty() + (off != null ? off[1] : 0));
                o.put("z", p.tz() + (off != null ? off[2] : 0));
                // PARED-NORMAL-REAL-01: el quaternion de la pose real de ARCore (misma
                // convención que terminar() ya mandaba al terminar la sesión) -- overlay.html
                // calcula de ahí la normal real de la superficie para orientar el ancho/grosor
                // de la instalación contra la pared de verdad, no "hacia arriba" genérico. Antes
                // esto solo se mandaba al terminar, nunca durante la vista previa en vivo -- lo
                // que se veía en el AR y lo que salía en el informe no coincidía.
                o.put("qx", p.qx()); o.put("qy", p.qy()); o.put("qz", p.qz()); o.put("qw", p.qw());
                if (i < tramoDiagonal.size() && tramoDiagonal.get(i)) o.put("d", true);   // REPL-ANGULO-RECTO-01
            } catch (Exception ignored) {}
            path.put(o);
        }
        // REPL-EDITAR-PUNTO-01: lo que muestra el panel del punto, copiado aquí (hilo GL, dueño de
        // las anclas) para leerlo sin carreras desde el hilo de UI.
        String[] etiquetas = new String[anchors.size()];
        boolean[] diagonales = new boolean[anchors.size()];
        for (int i = 0; i < anchors.size(); i++) {
            etiquetas[i] = SurfaceGeometry.type(anchors.get(i).getPose().getYAxis()[1]);
            diagonales[i] = i < tramoDiagonal.size() && tramoDiagonal.get(i);
        }
        etiquetasPuntos = etiquetas;
        diagonalesPuntos = diagonales;
        runOnUiThread(this::actualizarPanelPunto);
        // REPL-PARALELOS-01: opciones de render (mismo formato que trazado_json.paralelos).
        JSONObject opciones = new JSONObject();
        if (paralelosN > 1) {
            try {
                JSONObject par = new JSONObject();
                par.put("n", paralelosN); par.put("hueco_m", (double) huecoParaleloM);
                opciones.put("paralelos", par);
            } catch (Exception ignored) {}
        }
        JSONArray comps = new JSONArray();
        for (Complemento c : complementos) {
            Pose p = c.anchor.getPose();
            // REPL-AR-AJUSTE-01: el ajuste manual (⬅⬆⬇➡/↻) se combina aquí con la pose real del
            // Anchor -- ver el comentario junto a la clase Complemento.
            float[] q = orientacionComplemento(p, c.rotZ);
            JSONObject o = new JSONObject();
            try {
                o.put("key", c.key);
                o.put("x", p.tx() + c.ox); o.put("y", p.ty() + c.oy); o.put("z", p.tz() + c.oz);
                o.put("qx", q[0]); o.put("qy", q[1]); o.put("qz", q[2]); o.put("qw", q[3]);
            } catch (Exception ignored) {}
            comps.put(o);
        }
        final String js = "actualizarContenido(" + jsStringLit(path.toString()) + "," + jsStringLit(elementoKey) + ","
                + jsStringLit(elementoParamsJson) + "," + jsStringLit("[]") + "," + jsStringLit(comps.toString()) + ","
                + jsStringLit(opciones.toString()) + ")";
        // REPL-ANGULO-RECTO-01: el overlay devuelve la longitud del recorrido rectificado (repl3d.js),
        // la misma que guardará la PWA -- la APK no duplica en Java la geometría compartida.
        runOnUiThread(() -> {
            try {
                if (threeOverlay != null) threeOverlay.evaluateJavascript(js, valor -> {
                    try { longitudRectificadaM = Double.parseDouble(valor); } catch (Exception e) { longitudRectificadaM = -1; }
                });
            } catch (Exception ignored) {}
        });
    }

    // REFERENCIA-PLANOS-AR-01: manda los planos detectados (posición/orientación real +
    // contorno) al overlay para pintarlos como rejilla translúcida -- ver el porqué junto a la
    // llamada en onDrawFrame. plane.getSubsumedBy() != null se descarta porque ese plano ya se
    // fusionó dentro de otro más grande (seguir pintándolo duplicaría el mismo trozo de pared).
    private void sincronizarPlanosOverlay() {
        if (threeOverlay == null || session == null) return;
        JSONArray planosArr = new JSONArray();
        int paredes = 0, suelos = 0, techos = 0;
        for (Plane p : session.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
            FloatBuffer poly = p.getPolygon();
            if (poly == null || poly.remaining() < 6) continue; // menos de 3 puntos (x,z por punto)
            Pose center = p.getCenterPose();
            String tipo = SurfaceGeometry.type(center.getYAxis()[1]);
            if ("pared".equals(tipo)) paredes++;
            else if ("suelo".equals(tipo)) suelos++;
            else techos++;
            try {
                JSONObject o = new JSONObject();
                o.put("cx", center.tx()); o.put("cy", center.ty()); o.put("cz", center.tz());
                o.put("qx", center.qx()); o.put("qy", center.qy()); o.put("qz", center.qz()); o.put("qw", center.qw());
                o.put("vertical", p.getType() == Plane.Type.VERTICAL);
                o.put("tipo", SurfaceGeometry.type(center.getYAxis()[1]));
                JSONArray pts = new JSONArray();
                poly.rewind();
                while (poly.hasRemaining()) { pts.put(poly.get()); pts.put(poly.get()); }
                o.put("poly", pts);
                planosArr.put(o);
            } catch (Exception ignored) {}
        }
        resumenPlanos = "Pared " + paredes + " · Suelo " + suelos + " · Techo " + techos;
        final String js = "actualizarPlanos(" + jsStringLit(planosArr.toString()) + ")";
        runOnUiThread(() -> { try { threeOverlay.evaluateJavascript(js, null); } catch (Exception ignored) {} });
    }

    private static String floatArrayJs(float[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) { if (i > 0) sb.append(','); sb.append(a[i]); }
        return sb.append(']').toString();
    }

    private static String jsStringLit(String s) {
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    private void colocarEnReticulo(Frame frame) {
        Anchor a = superficieForzada(frame, resolverAnclaje(frame, false), false);
        if (a == null) {
            final String tipo = superficieObjetivo;
            final String msg = !"auto".equals(tipo) && planoFijoPos == null
                    ? "Tramo forzado a " + tipo + ": apunta a un " + tipo + " ya confirmado (o pulsa 📱 Tocar pegado a él) para fijar su plano."
                    : "Sin superficie ni profundidad bajo el círculo. Acerca el móvil al punto y pulsa 📱 Tocar.";
            estadoSuperficie = msg;
            return;
        }
        agregarPunto(a);
        avisarSiSobreInstalacion(a);   // ADR-0027
    }

    private void agregarPunto(Anchor a) {
        anchors.add(a); puntoOffsets.add(new float[]{0f, 0f, 0f}); accionLog.add("punto");
        tramoDiagonal.add(false);
        puntoSuperficie.add("auto".equals(superficieObjetivo) ? null : superficieObjetivo);
        contenidoSucio = true;
    }

    // REPL-SUPERFICIE-FORZADA-01: con superficie forzada, el primer punto del tramo fija el plano y
    // los siguientes se llevan a él (rayo cámara→punto; sin hit ni profundidad, el rayo central).
    // Paridad con _replArAnclajeForzado (index.html). Hilo GL.
    private Anchor superficieForzada(Frame frame, Anchor a, boolean contacto) {
        String tipo = superficieObjetivo;
        if ("auto".equals(tipo)) return a;
        Pose cam = frame.getCamera().getPose();
        float[] camPos = cam.getTranslation(), z = cam.getZAxis();
        float[] fwd = {-z[0], -z[1], -z[2]};
        if (planoFijoPos == null) {
            if (a == null) return null;
            Pose p = a.getPose();
            float[] n = TrazadoGeometria.normalDeTipo(tipo, contacto ? null : p.getYAxis(), fwd);
            if (n == null) return a;
            planoFijoPos = p.getTranslation(); planoFijoNormal = n;
            android.util.Log.i("AlejandraAR", "Plano de " + tipo + " fijado" + (contacto ? " por contacto" : ""));
        }
        float[] cand = a != null ? a.getPose().getTranslation() : new float[]{camPos[0] + fwd[0], camPos[1] + fwd[1], camPos[2] + fwd[2]};
        float[] q = TrazadoGeometria.forzarAPlano(planoFijoPos, planoFijoNormal, cand, contacto ? null : camPos);
        if (q == null) return a;
        if (a != null) {
            float[] t = a.getPose().getTranslation(), y = a.getPose().getYAxis();
            float dx = t[0] - q[0], dy = t[1] - q[1], dz = t[2] - q[2];
            boolean mismaSuperficie = y[0] * planoFijoNormal[0] + y[1] * planoFijoNormal[1] + y[2] * planoFijoNormal[2] > 0.95f;
            if (dx * dx + dy * dy + dz * dz < 0.005f * 0.005f && mismaSuperficie) {
                estadoSuperficie = "🔒 " + tipo + " fijado · punto pegado al plano del tramo";
                return a;   // ya está sobre el plano: se conserva su ancla (sigue el refinado de ARCore)
            }
            a.detach();
        }
        estadoSuperficie = "🔒 Punto forzado al " + tipo + " del tramo";
        return session.createAnchor(new Pose(q, TrazadoGeometria.quatDesdeNormal(planoFijoNormal)));
    }

    // "Tocar": el móvil está pegado o casi pegado a la superficie -- mismo botón y misma idea
    // que "📱 Tocar con el móvil (pared lisa)" en la PWA (WebXR), para paredes/techos lisos
    // donde ni el hit-test ni una estimación de profundidad a distancia normal enganchan.
    private void colocarPorContacto(Frame frame) {
        Anchor a = superficieForzada(frame, resolverAnclaje(frame, true), true);
        if (a == null) {
            estadoSuperficie = "No se pudo anclar por contacto. Prueba de nuevo, bien pegado a la superficie.";
            return;
        }
        agregarPunto(a);
    }

    // ── REPL-EDITAR-PUNTO-01 (03/10/2026, prioridad 4): acción sobre CUALQUIER punto colocado ──
    // Paridad con replArPuntoAccion (index.html). La selección vive en el hilo de UI; la acción se
    // resuelve en el hilo GL (dueño de las anclas), igual que Punto/Tocar/Deshacer.
    private void seleccionarPunto(int i) {
        selPunto = (i >= 0 && i < nPuntos) ? i : -1;
        actualizarPanelPunto();
    }
    private void navegarPunto(int d) {
        int n = nPuntos;
        if (n == 0) return;
        seleccionarPunto(selPunto < 0 ? n - 1 : ((selPunto + d) % n + n) % n);
    }
    private void editarPuntos() {
        if (nPuntos == 0) { estadoSuperficie = "Aún no hay puntos que editar."; return; }
        seleccionarPunto(selPunto >= 0 ? selPunto : nPuntos - 1);
    }
    private void accionPunto(String accion) { if (selPunto >= 0) pendingAccionPunto = accion; }

    // Hilo de UI.
    private void actualizarPanelPunto() {
        if (panelPunto == null) return;
        int i = selPunto, n = nPuntos;
        String[] etiquetas = etiquetasPuntos;
        boolean[] diagonales = diagonalesPuntos;
        if (i < 0 || i >= n) {
            if (i >= n) selPunto = -1;
            panelPunto.setVisibility(View.GONE);
            overlay.setSeleccion(-1);
            return;
        }
        overlay.setSeleccion(i);
        panelPunto.setVisibility(View.VISIBLE);
        tituloPunto.setText("✏️ Punto " + (i + 1) + " de " + n + (i < etiquetas.length ? " · " + etiquetas[i] : ""));
        boolean ultimo = i >= n - 1;
        btnDiagonal.setEnabled(!ultimo);
        btnDiagonal.setAlpha(ultimo ? 0.45f : 1f);
        btnDiagonal.setText(ultimo ? "⟂ —" : (i < diagonales.length && diagonales[i] ? "⟋ Diagonal" : "⟂ Recto"));
    }

    private float[] posPunto(int i) {
        Pose p = anchors.get(i).getPose();
        float[] off = puntoOffsets.get(i);
        return new float[]{p.tx() + off[0], p.ty() + off[1], p.tz() + off[2]};
    }

    private void reemplazarAncla(int i, Anchor nueva, String superficie) {
        anchors.get(i).detach();
        anchors.set(i, nueva);
        puntoOffsets.set(i, new float[]{0f, 0f, 0f});
        puntoSuperficie.set(i, superficie);
    }

    private void borrarPunto(int i) {
        anchors.remove(i).detach();
        puntoOffsets.remove(i);
        tramoDiagonal.remove(i);
        puntoSuperficie.remove(i);
        int k = accionLog.lastIndexOf("punto");
        if (k >= 0) accionLog.remove(k);
    }

    // "Pegar a techo/pared": el plano confirmado de ese tipo más cercano (hasta 1,5 m); si no hay,
    // el plano fijado del tramo si es de ese tipo. Hilo GL.
    private Anchor pegarA(float[] p, String tipo) {
        Plane mejor = null;
        float[] mejorQ = null;
        for (Plane pl : session.getAllTrackables(Plane.class)) {
            if (pl.getTrackingState() != TrackingState.TRACKING || pl.getSubsumedBy() != null || planoExcluidoPorIA(pl)) continue;
            Pose c = pl.getCenterPose();
            if (!tipo.equals(SurfaceGeometry.type(c.getYAxis()[1]))) continue;
            float[] r = TrazadoGeometria.pegar(p, c.getTranslation(), c.getYAxis(), TrazadoGeometria.MAX_PEGAR_M);
            if (r != null && (mejorQ == null || r[3] < mejorQ[3])) { mejor = pl; mejorQ = r; }
        }
        if (mejor != null) return mejor.createAnchor(new Pose(new float[]{mejorQ[0], mejorQ[1], mejorQ[2]}, mejor.getCenterPose().getRotationQuaternion()));
        if (planoFijoPos != null && tipo.equals(SurfaceGeometry.type(planoFijoNormal[1]))) {
            return session.createAnchor(new Pose(TrazadoGeometria.proyectar(p, planoFijoPos, planoFijoNormal), TrazadoGeometria.quatDesdeNormal(planoFijoNormal)));
        }
        return null;
    }

    private void aplicarAccionPunto(Frame frame, String accion, boolean tracking) {
        int i = selPunto;
        if (i < 0 || i >= anchors.size()) return;
        float[] p = posPunto(i);
        String n1 = String.valueOf(i + 1);
        switch (accion) {
            case "borrar":
                borrarPunto(i);
                selPunto = anchors.isEmpty() ? -1 : Math.min(i, anchors.size() - 1);
                estadoSuperficie = "🗑 Punto " + n1 + " borrado.";
                break;
            case "diagonal":
                if (i >= anchors.size() - 1) return;
                boolean d = !tramoDiagonal.get(i);
                tramoDiagonal.set(i, d);
                estadoSuperficie = d ? "⟋ El tramo " + n1 + "→" + (i + 2) + " respeta la diagonal tal cual se marcó."
                        : "⟂ El tramo " + n1 + "→" + (i + 2) + " vuelve al ángulo recto.";
                break;
            case "techo":
            case "pared": {
                Anchor a = pegarA(p, accion);
                if (a == null) { estadoSuperficie = "No hay " + accion + " confirmado a menos de 1,5 m de este punto. Enfoca el " + accion + " y vuelve a intentarlo."; return; }
                float[] t = a.getPose().getTranslation();
                double cm = Math.sqrt((t[0] - p[0]) * (t[0] - p[0]) + (t[1] - p[1]) * (t[1] - p[1]) + (t[2] - p[2]) * (t[2] - p[2])) * 100;
                reemplazarAncla(i, a, accion);
                estadoSuperficie = "📌 Punto " + n1 + " pegado al " + accion + " (se ha movido " + Math.round(cm) + " cm).";
                break;
            }
            case "mover": {
                if (!tracking) { estadoSuperficie = "Mueve el móvil despacio para que la cámara se sitúe y vuelve a pulsar 🎯."; return; }
                Anchor a = superficieForzada(frame, resolverAnclaje(frame, false), false);
                if (a == null) { estadoSuperficie = "Apunta con el círculo a donde debe ir el punto y vuelve a pulsar 🎯."; return; }
                reemplazarAncla(i, a, "auto".equals(superficieObjetivo) ? null : superficieObjetivo);
                estadoSuperficie = "🎯 Punto " + n1 + " movido al círculo.";
                break;
            }
            case "esquivar": {
                float[][] centros; float[] radios; String[] nombres;
                synchronized (instalacionesIA) {
                    int m = instalacionesIA.size();
                    centros = new float[m][]; radios = new float[m]; nombres = new String[m];
                    for (int k = 0; k < m; k++) { InstalacionIA x = instalacionesIA.get(k); centros[k] = new float[]{x.x, x.y, x.z}; radios[k] = x.radio; nombres[k] = x.etiqueta; }
                }
                if (centros.length == 0) { estadoSuperficie = "La IA no ha situado instalaciones existentes en esta sesión: no hay nada que esquivar."; return; }
                float[] q = TrazadoGeometria.esquivar(p, anchors.get(i).getPose().getYAxis(), centros, radios, TrazadoGeometria.MARGEN_ESQUIVAR_M);
                if (q == null) { estadoSuperficie = "Este punto no toca ninguna instalación existente detectada por la IA."; return; }
                Anchor a = session.createAnchor(new Pose(q, anchors.get(i).getPose().getRotationQuaternion()));
                double cm = Math.sqrt((q[0] - p[0]) * (q[0] - p[0]) + (q[1] - p[1]) * (q[1] - p[1]) + (q[2] - p[2]) * (q[2] - p[2])) * 100;
                reemplazarAncla(i, a, puntoSuperficie.get(i));
                estadoSuperficie = "↪ Punto " + n1 + " apartado " + Math.round(cm) + " cm de la instalación existente (sigue sobre su superficie).";
                break;
            }
            default:
                return;
        }
        nPuntos = anchors.size();
        contenidoSucio = true;
    }

    // REPL-AR-NATIVO-COMP-01: coloca el complemento elegido en el spinner sobre el retículo,
    // igual que replArColocarComp() en la PWA (WebXR) -- misma orientación que da el hit-test
    // (alineada a la superficie), sin rotación extra.
    private void colocarComplemento(Frame frame) {
        Anchor a = resolverAnclaje(frame, false);
        if (a == null) {
            runOnUiThread(() -> infoText.setText("Sin superficie ni profundidad bajo el círculo para colocar el complemento."));
            return;
        }
        int idx = Math.max(0, compSeleccionado);
        String key = ReplComplementosNativo.CATALOGO[idx].key;
        complementos.add(new Complemento(a, key));
        accionLog.add("comp");
        contenidoSucio = true;
        avisarSiSobreInstalacion(a);   // ADR-0027
        final String nombre = ReplComplementosNativo.CATALOGO[idx].nombre;
        final int n = complementos.size();
        runOnUiThread(() -> infoText.setText(nombre + " colocado · " + n + " complemento(s). Sigue marcando o pulsa ✅ Fin."));
    }

    private void nudge(int dx, int dy) {
        pendingNudgeDx = dx; pendingNudgeDy = dy; pendingNudgeDepth = 0; pendingNudge = true;
    }

    // REPL-AR-PROFUNDIDAD-MANUAL-01: acercar/alejar el último punto/complemento A LO LARGO DE
    // hacia dónde mira la cámara ahora mismo -- este es el ajuste que de verdad corrige "sale al
    // aire en vez de en la pared" (⬅⬆⬇➡ mueve lateral/vertical en pantalla, pero no corrige la
    // distancia real a la cámara, que es justo lo que falla cuando ARCore no tiene profundidad
    // fiable). dir=+1 aleja, dir=-1 acerca.
    private void nudgeProfundidad(int dir) {
        pendingNudgeDx = 0; pendingNudgeDy = 0; pendingNudgeDepth = dir; pendingNudge = true;
    }

    // REPL-AR-AJUSTE-01/REPL-AR-PROFUNDIDAD-MANUAL-01: mismo criterio que replArNudge() en la
    // PWA -- 2 cm por toque, en el plano derecha/arriba de LA PANTALLA (según hacia dónde mira
    // la cámara ahora), no en el eje propio del objeto -- así "arriba" en el mando siempre es
    // intuitivo sin importar cómo esté orientada la pared/techo. Se extiende aquí (a diferencia
    // de la PWA) a también mover el último PUNTO del trazado, no solo complementos -- y a
    // profundidad (acercar/alejar), que la PWA tampoco tiene -- porque en el AR nativo la
    // profundidad automática puede fallar del todo en superficies lisas (ver el porqué junto a
    // puntoOffsets) y sin esto no había manera de corregirlo.
    private void aplicarNudge(Camera camera, int dx, int dy, int depthDir) {
        // REPL-EDITAR-PUNTO-01: con un punto en edición, ⬅⬆⬇➡ y ⏪⏩ ajustan ESE punto.
        int idxPunto = (selPunto >= 0 && selPunto < puntoOffsets.size()) ? selPunto : -1;
        boolean hayComp = idxPunto < 0 && !accionLog.isEmpty() && "comp".equals(accionLog.get(accionLog.size() - 1)) && !complementos.isEmpty();
        boolean hayPunto = idxPunto >= 0 || (!accionLog.isEmpty() && "punto".equals(accionLog.get(accionLog.size() - 1)) && !puntoOffsets.isEmpty());
        if (!hayComp && !hayPunto) {
            runOnUiThread(() -> infoText.setText("Nada que ajustar todavía -- coloca antes un punto o un complemento."));
            return;
        }
        float[] z = camera.getPose().getZAxis(); // ARCore mira hacia -Z de la cámara
        float fx = -z[0], fy = -z[1], fz = -z[2];
        float flenXZ = (float) Math.sqrt(fx * fx + fz * fz);
        float rfx = flenXZ < 1e-4f ? 0f : fx / flenXZ, rfz = flenXZ < 1e-4f ? -1f : fz / flenXZ;
        // right = normalize(cross((rfx,0,rfz), (0,1,0))) = (-rfz, 0, rfx) -- ya es unitario.
        float rx = -rfz, rz = rfx;
        float paso = 0.02f;
        // REPL-AR-PROFUNDIDAD-PASO-01 (17/09/2026): Adrián -- "no funciona Acercar/Alejar". Sí
        // funcionaba (la prueba en vivo lo confirmó: 2 cm por toque llegó a mover el tubo hasta
        // hacerse visible), pero 2 cm es un paso pensado para afinar ⬅⬆⬇➡, no para corregir el
        // error real de profundidad en una pared sin datos fiables -- ahí el error es de DECENAS
        // de centímetros o metros (recordar la prueba: hicieron falta muchísimos toques para
        // pasar de 2,48 m a 5,73 m de longitud). Con un paso tan pequeño, cada toque individual
        // era invisible y parecía que el botón no hacía nada. Profundidad usa un paso propio,
        // mucho mayor.
        float pasoProf = 0.15f;
        float ox = rx * dx * paso + fx * depthDir * pasoProf;
        float oy = dy * paso + fy * depthDir * pasoProf;
        float oz = rz * dx * paso + fz * depthDir * pasoProf;
        if (hayComp) {
            Complemento c = complementos.get(complementos.size() - 1);
            c.ox += ox; c.oy += oy; c.oz += oz;
        } else {
            float[] off = puntoOffsets.get(idxPunto >= 0 ? idxPunto : puntoOffsets.size() - 1);
            off[0] += ox; off[1] += oy; off[2] += oz;
        }
        contenidoSucio = true;
        // Confirmación visible en cada toque -- sin esto, un ajuste que mueve algo fuera de
        // encuadre (como pasó en la prueba) se siente igual que un botón que no responde.
        if (depthDir != 0) {
            final String txt = depthDir > 0 ? "⏩ Alejado 15 cm" : "⏪ Acercado 15 cm";
            runOnUiThread(() -> infoText.setText(txt));
        }
    }

    private void aplicarRotar() {
        if (complementos.isEmpty()) {
            runOnUiThread(() -> infoText.setText("El giro solo aplica al último complemento colocado."));
            return;
        }
        Complemento c = complementos.get(complementos.size() - 1);
        c.rotZ += (float) (Math.PI / 12); // 15°, mismo paso que replArRotarComp() en la PWA
        contenidoSucio = true;
    }

    private static float[] orientacionComplemento(Pose pose, float giro) {
        return SurfaceGeometry.complementQuaternion(pose.getRotationQuaternion(), giro);
    }

    // REPL-AR-FOTO-01 (17/09/2026): "📸 Foto" documental -- captura lo que se ve ahora mismo
    // (cámara real + trazado 3D superpuesto) para adjuntarlo al informe, igual que replArFoto()
    // en la PWA. GLSurfaceView ES-A SurfaceView, así que PixelCopy.request(SurfaceView,...)
    // (disponible desde API 24, no hace falta la variante "cualquier View" de API 31+) sirve
    // directamente sin plumbing adicional.
    private void tomarFoto() {
        if (viewportW <= 1 || viewportH <= 1) return;
        Bitmap bmp = Bitmap.createBitmap(viewportW, viewportH, Bitmap.Config.ARGB_8888);
        try {
            PixelCopy.request(surfaceView, bmp, resultado -> {
                if (resultado != PixelCopy.SUCCESS) {
                    runOnUiThread(() -> infoText.setText("No se pudo capturar la foto."));
                    return;
                }
                try {
                    ByteArrayOutputStream baos = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.JPEG, 85, baos);
                    String b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                    fotos.add("data:image/jpeg;base64," + b64);
                } catch (Exception ignored) {}
                final int n = fotos.size();
                runOnUiThread(() -> infoText.setText("📸 Foto " + n + " guardada (documentación). Se subirán al terminar y guardar."));
            }, new Handler(Looper.getMainLooper()));
        } catch (Exception e) {
            infoText.setText("No se pudo capturar la foto.");
        }
    }

    // REPL-AR-IDENTIFICAR-01 (17/09/2026): "🔍 Identificar con IA" -- misma idea que
    // replArIdentificar() en la PWA (captura + POST /replanteos/identificar con Gemini), pero
    // capturando con PixelCopy (arriba) en vez del acceso a cámara raw de WebXR, que no aplica
    // aquí. Sin obstáculo automático en el trazado (a diferencia de la PWA): el AR nativo todavía
    // no manda obstaculos_json a la web (ver sincronizarContenidoOverlay/terminar), así que por
    // ahora solo se muestra el resultado -- añadir el obstáculo real queda para cuando se lleve
    // ese campo también al camino nativo.
    private void identificarIA() {
        if (authToken.isEmpty() || apiBase.isEmpty()) {
            infoText.setText("🔍 No se pudo identificar: falta la sesión (reabre el AR desde la app).");
            return;
        }
        if (viewportW <= 1 || viewportH <= 1) return;
        infoText.setText("🔍 Identificando con IA…");
        Bitmap bmp = Bitmap.createBitmap(viewportW, viewportH, Bitmap.Config.ARGB_8888);
        try {
            PixelCopy.request(surfaceView, bmp, resultado -> {
                if (resultado != PixelCopy.SUCCESS) {
                    runOnUiThread(() -> infoText.setText("🔍 No se pudo capturar la cámara."));
                    return;
                }
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bmp.compress(Bitmap.CompressFormat.JPEG, 80, baos);
                String dataUrl = "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                redExecutor.execute(() -> identificarEnRed(dataUrl));
            }, new Handler(Looper.getMainLooper()));
        } catch (Exception e) {
            infoText.setText("🔍 No se pudo capturar la cámara.");
        }
    }

    private void identificarEnRed(String dataUrl) {
        try {
            JSONObject body = new JSONObject();
            body.put("imagen", dataUrl);
            URL url = new URL(apiBase + "/replanteos/identificar");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("X-Token", authToken);
            conn.setDoOutput(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            java.io.InputStream is = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096]; int r;
            while (is != null && (r = is.read(buf)) != -1) out.write(buf, 0, r);
            String respTxt = out.toString("UTF-8");
            if (code < 200 || code >= 300) {
                runOnUiThread(() -> infoText.setText("🔍 Error " + code + " identificando."));
                return;
            }
            JSONObject r2 = new JSONObject(respTxt);
            String etiqueta = r2.optString("etiqueta", "No identificado");
            String tipo = r2.optString("tipo", "");
            String detalle = r2.optString("detalle", "");
            String accion = r2.optString("accion_sugerida", "");
            StringBuilder sb = new StringBuilder("🔍 ").append(etiqueta);
            if (!tipo.isEmpty()) sb.append(" (").append(tipo).append(")");
            if (!detalle.isEmpty()) sb.append(" · ").append(detalle);
            if (!accion.isEmpty()) sb.append(" · sugiero: ").append(accion);
            final String texto = sb.toString();
            runOnUiThread(() -> infoText.setText(texto));
        } catch (Exception e) {
            runOnUiThread(() -> infoText.setText("🔍 " + (e.getMessage() != null ? e.getMessage() : "no se pudo identificar")));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADR-0027 — Escaneo del entorno + IA de visión en tiempo real (03/10/2026)
    // ───────────────────────────────────────────────────────────────────────────
    // Paridad con el AR WebXR de la PWA (index.html, _replArEscaneo*): cartel "Escanea el
    // entorno" antes de poder marcar; cada ~3 s (máx. 40, también limitado en el servidor) un
    // fotograma reducido + los planos de ARCore van a POST /replanteos/escaneo/<id>/frame (IA de
    // visión, Haiku). La respuesta etiqueta planos (y descarta los que son muebles), sitúa las
    // instalaciones existentes en 3D y avisa al marcar encima. Los fotogramas clave quedan en R2
    // con las matrices reales de cámara para el fondo real del informe. Sin red o sin IA:
    // "Continuar sin IA" y escaneo solo geométrico -- nunca bloquea el marcado.
    private static final class InstalacionIA {
        float x, y, z, radio; final String tipo; final String etiqueta; int veces = 1;
        InstalacionIA(float[] p, float radio, String tipo, String etiqueta) { x = p[0]; y = p[1]; z = p[2]; this.radio = radio; this.tipo = tipo; this.etiqueta = etiqueta; }
    }
    private static final class PlanoSnap {
        final String id, tipo; final float[] centro, normal;
        PlanoSnap(String id, String tipo, float[] centro, float[] normal) { this.id = id; this.tipo = tipo; this.centro = centro; this.normal = normal; }
    }

    private String idPlano(Plane p) {
        String id = planoIds.get(p);
        if (id == null) { id = "P" + (sigPlanoId++); planoIds.put(p, id); }
        return id;
    }

    private boolean planoExcluidoPorIA(Plane p) {
        String id = planoIds.get(p);
        return id != null && EscaneoEntorno.excluido(votosPlanos.get(id));
    }

    // Hilo GL: planos confirmados ahora mismo (con su id estable) para contexto/desproyección.
    private List<PlanoSnap> snapshotPlanos() {
        List<PlanoSnap> out = new ArrayList<>();
        if (session == null) return out;
        int confirmados = 0;
        for (Plane p : session.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
            String id = idPlano(p);
            Pose c = p.getCenterPose();
            boolean excluido = EscaneoEntorno.excluido(votosPlanos.get(id));
            if (!excluido) confirmados++;
            if (!excluido && out.size() < 16) out.add(new PlanoSnap(id, SurfaceGeometry.type(c.getYAxis()[1]), c.getTranslation(), c.getYAxis()));
        }
        planosConfirmados = confirmados;
        return out;
    }

    private boolean esFotogramaClave(float[] pose) {
        synchronized (posesGuardadas) {
            if (posesGuardadas.size() >= EscaneoEntorno.MAX_GUARDADOS) return false;
            for (float[] g : posesGuardadas) {
                float dx = pose[12] - g[12], dy = pose[13] - g[13], dz = pose[14] - g[14];
                float dist = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
                // -Z de la cámara (columna 2 negada) = hacia dónde mira
                float dot = pose[8] * g[8] + pose[9] * g[9] + pose[10] * g[10];
                if (dist <= 0.4f && dot > Math.cos(0.45)) return false;
            }
            return true;
        }
    }

    // Hilo GL, cada frame: refresca el cartel y decide si toca capturar/enviar.
    private void tickEscaneo(boolean tracking, float[] view, float[] proj) {
        long ahora = System.currentTimeMillis();
        if (ahora - ultimaUIEscaneo > 500) { ultimaUIEscaneo = ahora; snapshotPlanos(); actualizarUIEscaneo(); }
        if (!tracking || escaneoEnVuelo || finalizando || escaneoId == null) return;
        boolean analizar = iaActiva && framesIA < iaMax;
        long intervalo = analizar ? EscaneoEntorno.INTERVALO_IA_MS : EscaneoEntorno.INTERVALO_CLAVE_MS;
        if (ahora - ultimoEnvioEscaneo < intervalo) return;
        ultimoEnvioEscaneo = ahora;
        float[] pose = new float[16];
        if (!Matrix.invertM(pose, 0, view, 0)) return;
        boolean guardar = esFotogramaClave(pose);
        if (!analizar && !guardar) return;
        capturarYEnviar(view.clone(), proj.clone(), pose, analizar, guardar, faseEscaneo ? "escaneo" : "marcado", null);
    }

    private void capturarYEnviar(float[] view, float[] proj, float[] pose, boolean analizar, boolean guardar, String fase, Runnable alTerminar) {
        if (viewportW <= 1 || viewportH <= 1) { if (alTerminar != null) alTerminar.run(); return; }
        escaneoEnVuelo = true;
        final List<PlanoSnap> planos = snapshotPlanos();
        final int w = viewportW, h = viewportH;
        runOnUiThread(() -> {
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            try {
                PixelCopy.request(surfaceView, bmp, res -> {
                    if (res != PixelCopy.SUCCESS) { escaneoEnVuelo = false; if (alTerminar != null) alTerminar.run(); return; }
                    redExecutor.execute(() -> {
                        try { enviarFrameEscaneo(bmp, view, proj, pose, planos, analizar, guardar, fase); }
                        finally { escaneoEnVuelo = false; if (alTerminar != null) alTerminar.run(); }
                    });
                }, new Handler(Looper.getMainLooper()));
            } catch (Exception e) {
                escaneoEnVuelo = false;
                if (alTerminar != null) alTerminar.run();
            }
        });
    }

    private static JSONArray jsonArr(float[] a) throws Exception {
        JSONArray r = new JSONArray();
        for (float v : a) r.put((double) v);
        return r;
    }

    // Hilo de red.
    private void enviarFrameEscaneo(Bitmap bmp, float[] view, float[] proj, float[] pose, List<PlanoSnap> planos, boolean analizar, boolean guardar, String fase) {
        try {
            float s = Math.min(1f, (float) EscaneoEntorno.LADO_IMAGEN / Math.max(bmp.getWidth(), bmp.getHeight()));
            Bitmap red = s < 1f ? Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * s), Math.round(bmp.getHeight() * s), true) : bmp;
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            red.compress(Bitmap.CompressFormat.JPEG, 72, baos);
            JSONObject camara = new JSONObject();
            camara.put("pose", jsonArr(pose)); camara.put("proj", jsonArr(proj));
            camara.put("w", red.getWidth()); camara.put("h", red.getHeight());
            JSONArray ctx = new JSONArray();
            for (PlanoSnap p : planos) {
                JSONObject o = new JSONObject();
                o.put("id", p.id); o.put("tipo", p.tipo);
                float[] q = EscaneoEntorno.proyectar(view, proj, p.centro);
                if (q != null) { o.put("u", Math.round(q[0] * 100) / 100.0); o.put("v", Math.round(q[1] * 100) / 100.0); o.put("dist_m", Math.round(q[2] * 100) / 100.0); }
                o.put("altura_rel_m", Math.round((p.centro[1] - pose[13]) * 100) / 100.0);
                ctx.put(o);
            }
            JSONObject body = new JSONObject();
            body.put("imagen", "data:image/jpeg;base64," + Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP));
            body.put("analizar", analizar); body.put("guardar", guardar); body.put("fase", fase);
            body.put("camara", camara); body.put("planos", ctx);
            String[] r = httpJson("/replanteos/escaneo/" + escaneoId + "/frame", body);
            int code = Integer.parseInt(r[0]);
            JSONObject j = new JSONObject(r[1].isEmpty() ? "{}" : r[1]);
            if (code < 200 || code >= 300) throw new Exception(j.optString("error", "error " + code));
            fallosEscaneo = 0;
            if (!j.isNull("guardado")) synchronized (posesGuardadas) { posesGuardadas.add(pose); }
            if (j.has("ia_usados")) framesIA = j.optInt("ia_usados", framesIA);
            JSONObject an = j.optJSONObject("analisis");
            if (an != null) aplicarAnalisis(an, pose, proj, planos);
            else if (analizar && !j.isNull("motivo_sin_ia") && j.optString("motivo_sin_ia", "").contains("limite")) {
                iaActiva = false; motivoSinIA = "Límite de análisis IA alcanzado: sigue sin IA.";
            }
        } catch (Exception e) {
            fallosEscaneo++;
            android.util.Log.w("AlejandraAR", "Escaneo: fallo enviando fotograma (" + fallosEscaneo + ")");
            if (fallosEscaneo >= 3 && iaActiva) { iaActiva = false; motivoSinIA = "La IA no responde (red). Continúa sin IA; el escaneo sigue siendo geométrico."; }
        }
    }

    private void aplicarAnalisis(JSONObject an, float[] pose, float[] proj, List<PlanoSnap> planos) {
        JSONArray sup = an.optJSONArray("superficies");
        for (int i = 0; sup != null && i < sup.length(); i++) {
            JSONObject s = sup.optJSONObject(i);
            if (s == null || s.optDouble("confianza", 0.5) < 0.4) continue;
            votosPlanos.computeIfAbsent(s.optString("id"), k -> new java.util.concurrent.ConcurrentHashMap<>())
                    .merge(s.optString("clase"), 1, Integer::sum);
        }
        JSONArray inst = an.optJSONArray("instalaciones");
        for (int i = 0; inst != null && i < inst.length(); i++) {
            JSONObject o = inst.optJSONObject(i);
            JSONArray b = o == null ? null : o.optJSONArray("bbox");
            if (b == null || b.length() != 4 || o.optDouble("confianza", 0.5) < 0.5) continue;
            float x0 = (float) b.optDouble(0), y0 = (float) b.optDouble(1), x1 = (float) b.optDouble(2), y1 = (float) b.optDouble(3);
            float[] r = EscaneoEntorno.rayo(pose, proj, (x0 + x1) / 2, (y0 + y1) / 2);
            if (r == null) continue;
            float mejor = -1;
            for (PlanoSnap p : planos) {
                float t = EscaneoEntorno.cortar(r, p.centro, p.normal, 8f);
                if (t > 0 && (mejor < 0 || t < mejor)) mejor = t;
            }
            if (mejor < 0) continue;  // sin superficie que la sitúe: solo se informa en texto
            float[] ra = EscaneoEntorno.rayo(pose, proj, x0, (y0 + y1) / 2), rb = EscaneoEntorno.rayo(pose, proj, x1, (y0 + y1) / 2);
            float radio = 0.3f;
            if (ra != null && rb != null) {
                double ang = Math.acos(Math.max(-1, Math.min(1, ra[3] * rb[3] + ra[4] * rb[4] + ra[5] * rb[5])));
                radio = (float) Math.max(0.12, Math.min(1.2, Math.tan(ang / 2) * mejor));
            }
            float[] pos = {r[0] + r[3] * mejor, r[1] + r[4] * mejor, r[2] + r[5] * mejor};
            String tipo = o.optString("tipo", "otro"), etiqueta = o.optString("etiqueta", "Instalación");
            synchronized (instalacionesIA) {
                InstalacionIA ya = null;
                for (InstalacionIA c : instalacionesIA) {
                    float dx = c.x - pos[0], dy = c.y - pos[1], dz = c.z - pos[2];
                    if (c.tipo.equals(tipo) && Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.5) { ya = c; break; }
                }
                if (ya != null) {
                    int k = ya.veces;
                    ya.x = (ya.x * k + pos[0]) / (k + 1); ya.y = (ya.y * k + pos[1]) / (k + 1); ya.z = (ya.z * k + pos[2]) / (k + 1);
                    ya.radio = Math.max(ya.radio, radio); ya.veces = k + 1;
                } else if (instalacionesIA.size() < 30) instalacionesIA.add(new InstalacionIA(pos, radio, tipo, etiqueta));
            }
        }
        String res = an.optString("resumen", "");
        String cal = an.optString("calidad", "buena");
        resumenIA = ("oscura".equals(cal) ? "Poca luz: " : "borrosa".equals(cal) ? "Imagen movida, ve más despacio. " : "") + res;
        sincronizarEscaneoOverlay(planos);
    }

    // Etiquetas de la IA en el overlay 3D (paridad con _replArEscaneoPintar de la PWA).
    private void sincronizarEscaneoOverlay(List<PlanoSnap> planos) {
        if (threeOverlay == null || !overlayReady) return;
        try {
            JSONObject o = new JSONObject();
            JSONArray inst = new JSONArray();
            synchronized (instalacionesIA) {
                for (InstalacionIA i : instalacionesIA) {
                    JSONObject x = new JSONObject();
                    x.put("x", i.x); x.put("y", i.y); x.put("z", i.z); x.put("radio", i.radio); x.put("etiqueta", i.etiqueta);
                    inst.put(x);
                }
            }
            JSONArray etq = new JSONArray();
            for (PlanoSnap p : planos) {
                java.util.Map<String, Integer> v = votosPlanos.get(p.id);
                if (v == null || v.isEmpty()) continue;
                boolean excl = EscaneoEntorno.excluido(v);
                JSONObject x = new JSONObject();
                x.put("x", p.centro[0] + p.normal[0] * 0.05f); x.put("y", p.centro[1] + p.normal[1] * 0.05f); x.put("z", p.centro[2] + p.normal[2] * 0.05f);
                x.put("texto", (excl ? "✖ Mueble" : Character.toUpperCase(p.tipo.charAt(0)) + p.tipo.substring(1)));
                x.put("excluida", excl);
                etq.put(x);
            }
            o.put("instalaciones", inst); o.put("planos", etq);
            final String js = "typeof actualizarEscaneoIA === 'function' && actualizarEscaneoIA(" + jsStringLit(o.toString()) + ")";
            runOnUiThread(() -> { try { if (threeOverlay != null) threeOverlay.evaluateJavascript(js, null); } catch (Exception ignored) {} });
        } catch (Exception ignored) {}
    }

    private String instalacionCercana(float[] p) {
        synchronized (instalacionesIA) {
            for (InstalacionIA i : instalacionesIA) if (EscaneoEntorno.cercana(p, new float[]{i.x, i.y, i.z}, i.radio)) return i.etiqueta;
        }
        return null;
    }

    private void avisarSiSobreInstalacion(Anchor a) {
        String e = instalacionCercana(a.getPose().getTranslation());
        if (e != null) estadoSuperficie = "⚠ Marcado sobre una instalación existente (" + e + "). Revisa el recorrido o márcala como obstáculo.";
    }

    private void actualizarUIEscaneo() {
        final boolean escaneando = faseEscaneo;
        final int planos = planosConfirmados, ia = framesIA;
        final boolean activa = iaActiva;
        final double seg = (System.currentTimeMillis() - inicioEscaneo) / 1000.0;
        final boolean ok = EscaneoEntorno.suficiente(planos, ia, activa, seg);
        final int nInst;
        synchronized (instalacionesIA) { nInst = instalacionesIA.size(); }
        final String progreso = "Superficies confirmadas: " + planos + "\nFotogramas analizados por IA: " + ia + (activa ? " / " + iaMax : " (IA desactivada)")
                + (nInst > 0 ? "\nInstalaciones existentes vistas: " + nInst : "");
        final String ia2 = !resumenIA.isEmpty() ? "🧠 " + resumenIA : (activa ? "🧠 Esperando el primer análisis…" : motivoSinIA);
        runOnUiThread(() -> {
            if (panelEscaneo == null) return;
            panelEscaneo.setVisibility(escaneando ? View.VISIBLE : View.GONE);
            if (bottomStackRef != null) bottomStackRef.setVisibility(escaneando ? View.GONE : View.VISIBLE);
            if (!escaneando) return;
            escaneoProgreso.setText(progreso);
            escaneoIA.setText(ia2);
            btnEscaneoListo.setEnabled(ok);
            btnEscaneoListo.setAlpha(ok ? 1f : 0.45f);
            btnEscaneoListo.setText(ok ? "✅ Empezar a marcar" : "⏳ " + EscaneoEntorno.falta(planos, ia, activa));
            btnEscaneoSinIA.setText(activa ? "Continuar sin IA" : "Continuar solo con geometría");
        });
    }

    private void escaneoListo() {
        faseEscaneo = false;
        estadoSuperficie = "Escaneo listo. Apunta al primer punto y pulsa Punto." + (iaActiva ? " La IA sigue mirando mientras marcas." : "");
        android.util.Log.i("AlejandraAR", "Escaneo listo: IA " + framesIA + ", planos " + planosConfirmados);
        actualizarUIEscaneo();
    }

    // Hilo de red: abre la sesión de escaneo en el servidor.
    private void iniciarEscaneoRed() {
        try {
            JSONObject b = new JSONObject();
            b.put("plataforma", "android");
            if (!departamento.isEmpty()) b.put("departamento", departamento);
            if (!obraId.isEmpty()) b.put("obra_id", obraId);
            String[] r = httpJson("/replanteos/escaneo", b);
            int code = Integer.parseInt(r[0]);
            JSONObject j = new JSONObject(r[1].isEmpty() ? "{}" : r[1]);
            if (code >= 200 && code < 300 && j.optString("escaneo_id", "").matches("[a-f0-9]{32}")) {
                iaMax = j.optInt("max_ia", EscaneoEntorno.MAX_IA);
                boolean disp = j.optBoolean("ia_disponible", false);
                iaActiva = disp && iaPedida;
                if (!disp) motivoSinIA = "La IA de visión no está configurada en el servidor. Escaneo solo geométrico.";
                escaneoId = j.getString("escaneo_id");
                android.util.Log.i("AlejandraAR", "Escaneo: sesión abierta, IA " + iaActiva);
            } else {
                motivoSinIA = "IA no disponible: " + j.optString("error", "error " + code) + ". Escaneo solo geométrico.";
                android.util.Log.w("AlejandraAR", "Escaneo: no se pudo abrir sesión (" + code + ")");
            }
        } catch (Exception e) {
            motivoSinIA = "Sin conexión: escaneo solo geométrico. Puedes continuar.";
            android.util.Log.w("AlejandraAR", "Escaneo: sin conexión al abrir sesión");
        }
    }

    private String[] httpJson(String ruta, JSONObject body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(apiBase + ruta).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("X-Token", authToken);
        conn.setDoOutput(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(25000);
        try (OutputStream os = conn.getOutputStream()) { os.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
        int code = conn.getResponseCode();
        java.io.InputStream is = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096]; int n;
        while (is != null && (n = is.read(buf)) != -1) out.write(buf, 0, n);
        return new String[]{String.valueOf(code), out.toString("UTF-8")};
    }

    // Hilo GL: al pulsar Fin, un último fotograma clave (ve la instalación terminada) antes de
    // devolver el resultado. Con tope de tiempo: nunca bloquea el cierre.
    private void iniciarFin(float[] view, float[] proj) {
        if (finalizando) return;
        finalizando = true;
        float[] pose = new float[16];
        if (escaneoId == null || !Matrix.invertM(pose, 0, view, 0)) { pendingFinishDirecto = true; return; }
        runOnUiThread(() -> infoText.setText("Guardando el último fotograma del entorno…"));
        capturarYEnviar(view, proj, pose, false, true, "final", () -> pendingFinishDirecto = true);
        new Handler(Looper.getMainLooper()).postDelayed(() -> pendingFinishDirecto = true, 6000);
    }
    private void actualizarInfo(boolean tracking) {
        double longitud = 0;
        float[] prev = null;
        for (int i = 0; i < anchors.size(); i++) {
            Pose p = anchors.get(i).getPose();
            float[] off = puntoOffsets.get(i);
            float[] pos = {p.tx() + off[0], p.ty() + off[1], p.tz() + off[2]};
            if (prev != null) {
                double dx = pos[0] - prev[0], dy = pos[1] - prev[1], dz = pos[2] - prev[2];
                longitud += Math.sqrt(dx * dx + dy * dy + dz * dz);
            }
            prev = pos;
        }
        final int n = anchors.size();
        // REPL-ANGULO-RECTO-01: lo medido es el recorrido rectificado que calcula el overlay
        // (sube por la pared, gira en la esquina, sigue por el techo); sin overlay, la recta.
        final double lonRect = longitudRectificadaM;
        final boolean rect = overlayReady && n >= 2 && lonRect >= 0;
        final String lon = String.format(java.util.Locale.US, "%.2f", rect ? lonRect : longitud).replace('.', ',')
                + (paralelosN > 1 ? " ×" + paralelosN : "");
        final String estado = tracking ? resumenPlanos + " · Destino: " + superficieObjetivo + "\n" + estadoSuperficie
                : "Buscando posición: mueve el móvil despacio y mejora la luz.";
        // ADR-0027: estado de la IA siempre visible, y el aviso de instalación existente.
        final String ia = (iaActiva ? "🧠 IA " + framesIA + "/" + iaMax : "🧠 sin IA") + (avisoIA.isEmpty() ? "" : "\n" + avisoIA);
        if (finalizando) return;
        runOnUiThread(() -> infoText.setText(estado + "\n" + n + " puntos · " + lon + " m · " + ia));
    }
}
