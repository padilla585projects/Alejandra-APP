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
    private final Paint linePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint dotBorder = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint reticlePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private float[] pts = new float[0];   // x0,y0,x1,y1... en píxeles; NaN = punto no visible
    private boolean reticleActive = false;

    public OverlayView(Context c) {
        super(c);
        linePaint.setColor(Color.parseColor("#f97316")); linePaint.setStrokeWidth(8f); linePaint.setStyle(Paint.Style.STROKE);
        dotPaint.setColor(Color.parseColor("#f97316"));
        dotBorder.setColor(Color.WHITE); dotBorder.setStyle(Paint.Style.STROKE); dotBorder.setStrokeWidth(4f);
        reticlePaint.setColor(Color.WHITE); reticlePaint.setStyle(Paint.Style.STROKE); reticlePaint.setStrokeWidth(4f);
    }

    public void setPoints(float[] screenPts) { this.pts = screenPts != null ? screenPts : new float[0]; postInvalidate(); }
    public void setReticleActive(boolean a) { this.reticleActive = a; postInvalidate(); }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float cx = getWidth() / 2f, cy = getHeight() / 2f;
        reticlePaint.setColor(reticleActive ? Color.parseColor("#f97316") : Color.WHITE);
        canvas.drawCircle(cx, cy, 26f, reticlePaint);
        canvas.drawCircle(cx, cy, 3f, dotPaint);
        for (int i = 2; i + 1 < pts.length; i += 2) {
            float ax = pts[i - 2], ay = pts[i - 1], bx = pts[i], by = pts[i + 1];
            if (Float.isNaN(ax) || Float.isNaN(bx)) continue;
            canvas.drawLine(ax, ay, bx, by, linePaint);
        }
        for (int i = 0; i + 1 < pts.length; i += 2) {
            float x = pts[i], y = pts[i + 1];
            if (Float.isNaN(x)) continue;
            canvas.drawCircle(x, y, 14f, dotPaint);
            canvas.drawCircle(x, y, 14f, dotBorder);
        }
    }
}
