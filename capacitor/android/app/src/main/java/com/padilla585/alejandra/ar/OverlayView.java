package com.padilla585.alejandra.ar;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;

/**
 * Capa 2D sobre el GLSurfaceView: retículo central, puntos colocados, líneas entre ellos.
 * La Activity le pasa las coordenadas de pantalla ya proyectadas desde el mundo 3D de ARCore.
 */
public class OverlayView extends View {
    private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint dotBorder = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint reticlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float[] pts = new float[0];   // x0,y0,x1,y1... en píxeles; NaN = punto no visible
    // FASE-A-AR-PAREDES-LISAS-01 (16/09/2026): antes solo había activo/inactivo (naranja/blanco).
    // Se añade un tercer estado -- azul, mismo color que usa la PWA (WebXR) para su retículo por
    // profundidad -- para que quede claro quEE un "Punto" aquí ancla por instant placement/
    // profundidad, no sobre una superficie confirmada, antes de que el usuario pulse.
    public static final int RETICLE_NONE = 0, RETICLE_HIT = 1, RETICLE_FALLBACK = 2;
    private int reticleState = RETICLE_NONE;

    public OverlayView(Context c) {
        super(c);
        dotPaint.setColor(Color.parseColor("#f97316"));
        dotBorder.setColor(Color.WHITE); dotBorder.setStyle(Paint.Style.STROKE); dotBorder.setStrokeWidth(4f);
        reticlePaint.setColor(Color.WHITE); reticlePaint.setStyle(Paint.Style.STROKE); reticlePaint.setStrokeWidth(4f);
    }

    public void setPoints(float[] screenPts) { this.pts = screenPts != null ? screenPts : new float[0]; postInvalidate(); }
    public void setReticleState(int state) { this.reticleState = state; postInvalidate(); }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float cx = getWidth() / 2f, cy = getHeight() / 2f;
        reticlePaint.setColor(reticleState == RETICLE_HIT ? Color.parseColor("#f97316")
                : reticleState == RETICLE_FALLBACK ? Color.parseColor("#38bdf8") : Color.WHITE);
        canvas.drawCircle(cx, cy, 26f, reticlePaint);
        canvas.drawCircle(cx, cy, 3f, dotPaint);
        // REPL-AR-OVERLAY-01 (17/09/2026): Adrian -- "deberia pintar directamente el tubo no la
        // linea". Antes esta linea 2D plana entre puntos era el unico trazado visible; ahora que
        // threeOverlay pinta el tubo/rejiband/etc. real en 3D (sincronizarContenidoOverlay, mismas
        // matrices de camara que este overlay 2D) esa linea sobraba -- ademas de quedar mal
        // encima del tubo real, si el tubo se veia mal colocado la linea seguia "bien" porque usa
        // los mismos anchors, dando una falsa sensacion de que todo iba fino. Se deja solo el
        // punto/reticula (para saber donde se ha tocado), el tubo real es el trazado.
        for (int i = 0; i + 1 < pts.length; i += 2) {
            float x = pts[i], y = pts[i + 1];
            if (Float.isNaN(x)) continue;
            canvas.drawCircle(x, y, 14f, dotPaint);
            canvas.drawCircle(x, y, 14f, dotBorder);
        }
    }
}
