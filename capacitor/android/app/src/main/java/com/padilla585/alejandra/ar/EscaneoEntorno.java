package com.padilla585.alejandra.ar;

import java.util.Map;

/**
 * ADR-0027 — Escaneo del entorno + IA de visión del AR nativo (03/10/2026).
 *
 * Lógica pura (sin Android, probada en EscaneoEntornoTest) que replica la de repl3d.js
 * (REPL_ESCANEO, _replEscaneoSuficiente, _replEscaneoRayo, _replEscaneoCortarPlanos,
 * _replEscaneoCercana) para que la APK y la PWA decidan igual. Si se cambia un umbral aquí,
 * cambiarlo también en repl3d.js (y viceversa). Matrices 4x4 column-major como ARCore/three.js.
 */
final class EscaneoEntorno {
    static final long INTERVALO_IA_MS = 3000;      // un fotograma cada 3 s (límite aprobado por Adrián)
    static final long INTERVALO_CLAVE_MS = 6000;   // sin IA: solo fotogramas clave para el informe
    static final int MAX_IA = 40;                  // tope por sesión; el servidor también lo aplica
    static final int MIN_FRAMES_IA = 3;
    static final int MIN_PLANOS_SIN_IA = 2;
    static final int MAX_GUARDADOS = 16;
    static final int LADO_IMAGEN = 768;
    static final float AVISO_M = 0.25f;

    private EscaneoEntorno() {}

    /** Mismo criterio que _replEscaneoSuficiente() en repl3d.js. */
    static boolean suficiente(int planos, int framesIA, boolean iaActiva, double segundos) {
        if (iaActiva) {
            if (framesIA >= MIN_FRAMES_IA && planos >= 1) return true;
            return framesIA >= MIN_FRAMES_IA + 2 && segundos >= 12;
        }
        return planos >= MIN_PLANOS_SIN_IA;
    }

    static String falta(int planos, int framesIA, boolean iaActiva) {
        if (iaActiva) {
            StringBuilder sb = new StringBuilder("Falta: ");
            if (framesIA < MIN_FRAMES_IA) sb.append(MIN_FRAMES_IA - framesIA).append(" fotograma(s) más para la IA");
            if (planos < 1) sb.append(framesIA < MIN_FRAMES_IA ? " y " : "").append("alguna superficie confirmada");
            return sb.toString();
        }
        return "Falta: " + Math.max(0, MIN_PLANOS_SIN_IA - planos) + " superficie(s) más";
    }

    /**
     * La IA puede descartar un plano que en realidad es un mueble/mesa ("mueble"/"otro" con al
     * menos el 60 % de los votos): deja de servir para pegar puntos. En la APK la normal de
     * ARCore ya distingue suelo (hacia arriba) de techo (hacia abajo), así que aquí la IA no
     * cambia suelo/techo como en WebXR, donde se clasifica por altura.
     */
    static boolean excluido(Map<String, Integer> votos) {
        if (votos == null || votos.isEmpty()) return false;
        int total = 0, mueble = 0;
        for (Map.Entry<String, Integer> e : votos.entrySet()) {
            int n = e.getValue() == null ? 0 : e.getValue();
            total += n;
            if ("mueble".equals(e.getKey()) || "otro".equals(e.getKey())) mueble = Math.max(mueble, n);
        }
        if (total == 0) return false;
        int max = 0;
        for (Integer n : votos.values()) if (n != null && n > max) max = n;
        return mueble == max && mueble >= Math.max(1, total * 0.6);
    }

    /** Rayo de mundo [ox,oy,oz,dx,dy,dz] por (u,v) de la imagen (0..1, v hacia abajo). */
    static float[] rayo(float[] pose, float[] proj, float u, float v) {
        float[] inv = invertir(proj);
        if (inv == null) return null;
        float[] c = mul(inv, new float[]{u * 2 - 1, (1 - v) * 2 - 1, 0.5f, 1});
        if (Math.abs(c[3]) < 1e-9) return null;
        float[] enCamara = {c[0] / c[3], c[1] / c[3], c[2] / c[3], 1};
        float[] w = mul(pose, enCamara);
        float ox = pose[12], oy = pose[13], oz = pose[14];
        float dx = w[0] - ox, dy = w[1] - oy, dz = w[2] - oz;
        float len = (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-9) return null;
        return new float[]{ox, oy, oz, dx / len, dy / len, dz / len};
    }

    /** Distancia t (> 0,1 m y <= maxDist) del rayo al plano, solo cerca de su centro; o -1. */
    static float cortar(float[] r, float[] centro, float[] normal, float maxDist) {
        float den = r[3] * normal[0] + r[4] * normal[1] + r[5] * normal[2];
        if (Math.abs(den) < 1e-4f) return -1;
        float t = ((centro[0] - r[0]) * normal[0] + (centro[1] - r[1]) * normal[1] + (centro[2] - r[2]) * normal[2]) / den;
        if (!(t > 0.1f) || t > maxDist) return -1;
        float px = r[0] + r[3] * t - centro[0], py = r[1] + r[4] * t - centro[1], pz = r[2] + r[5] * t - centro[2];
        return Math.sqrt(px * px + py * py + pz * pz) > 3.5f ? -1 : t;
    }

    /** ¿El punto cae sobre una instalación existente (centro+radio) con el margen de aviso? */
    static boolean cercana(float[] p, float[] centro, float radio) {
        float dx = p[0] - centro[0], dy = p[1] - centro[1], dz = p[2] - centro[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - radio <= AVISO_M;
    }

    /** (u, v) en la imagen de un punto del mundo, o null si queda detrás de la cámara. */
    static float[] proyectar(float[] view, float[] proj, float[] p) {
        float[] c = mul(view, new float[]{p[0], p[1], p[2], 1});
        float dist = -c[2];
        float[] q = mul(proj, c);
        if (!(q[3] > 0) || dist <= 0) return null;
        return new float[]{(q[0] / q[3]) * 0.5f + 0.5f, 1 - ((q[1] / q[3]) * 0.5f + 0.5f), dist};
    }

    static float[] mul(float[] m, float[] v) {
        float[] r = new float[4];
        for (int i = 0; i < 4; i++) r[i] = m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3];
        return r;
    }

    /** Inversa de una 4x4 column-major (Gauss-Jordan), o null si es singular. */
    static float[] invertir(float[] m) {
        double[][] a = new double[4][8];
        for (int r = 0; r < 4; r++) {
            for (int c = 0; c < 4; c++) a[r][c] = m[c * 4 + r];
            a[r][4 + r] = 1;
        }
        for (int col = 0; col < 4; col++) {
            int piv = col;
            for (int r = col + 1; r < 4; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
            if (Math.abs(a[piv][col]) < 1e-12) return null;
            double[] t = a[col]; a[col] = a[piv]; a[piv] = t;
            double d = a[col][col];
            for (int c = 0; c < 8; c++) a[col][c] /= d;
            for (int r = 0; r < 4; r++) {
                if (r == col) continue;
                double f = a[r][col];
                if (f == 0) continue;
                for (int c = 0; c < 8; c++) a[r][c] -= f * a[col][c];
            }
        }
        float[] out = new float[16];
        for (int r = 0; r < 4; r++) for (int c = 0; c < 4; c++) out[c * 4 + r] = (float) a[r][4 + c];
        return out;
    }
}
