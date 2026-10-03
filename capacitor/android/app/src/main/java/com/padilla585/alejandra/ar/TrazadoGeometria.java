package com.padilla585.alejandra.ar;

/**
 * Prioridad 4 del trazado realista (03/10/2026): superficie forzada por tramo y edición de
 * cualquier punto ya colocado en el AR nativo. Lógica pura (sin Android, probada en
 * TrazadoGeometriaTest) que replica la de repl3d.js para que APK y PWA decidan igual:
 * _replPlanoForzado, _replForzarAPlano, _replPegarASuperficie, _replEsquivarInstalacion y
 * _replPuntoMasCercano. Si se cambia un umbral aquí, cambiarlo también en repl3d.js.
 *
 * El ángulo recto (prioridad 2) y las líneas en paralelo (prioridad 3) NO se duplican en Java:
 * los pinta y los mide el overlay con el mismo repl3d.js que la PWA (assets/ar/overlay.html).
 */
final class TrazadoGeometria {
    static final float MAX_PEGAR_M = 1.5f;      // REPL_TRAZADO.maxPegarM
    static final float MARGEN_ESQUIVAR_M = 0.05f;

    private TrazadoGeometria() {}

    /**
     * Normal exterior del plano que fija un tramo forzado: la detectada si es de ese tipo; si no,
     * techo = -Y, suelo = +Y, pared = horizontal hacia la cámara (camFwd = hacia dónde mira).
     */
    static float[] normalDeTipo(String tipo, float[] normalDetectada, float[] camFwd) {
        float[] nd = normalizar(normalDetectada);
        if (nd != null && tipo.equals(SurfaceGeometry.type(nd[1]))) return nd;
        if ("techo".equals(tipo)) return new float[]{0, -1, 0};
        if ("suelo".equals(tipo)) return new float[]{0, 1, 0};
        if ("pared".equals(tipo) && camFwd != null) {
            float[] h = {-camFwd[0], 0, -camFwd[2]};
            return dot(h, h) > 1e-4f ? unitario(h) : null;
        }
        return null;
    }

    /**
     * Lleva un punto candidato al plano fijado cortando el rayo cámara→punto con él (donde
     * apuntaba el usuario sobre ESA superficie). Si el rayo es casi paralelo o queda detrás, o no
     * hay cámara, proyección perpendicular.
     */
    static float[] forzarAPlano(float[] planoPos, float[] n, float[] p, float[] cam) {
        if (p == null) return null;
        if (cam != null) {
            float[] dir = {p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]};
            float l = longitud(dir);
            if (l > 1e-4f) {
                for (int i = 0; i < 3; i++) dir[i] /= l;
                float den = dot(dir, n);
                if (Math.abs(den) > 0.15f) {
                    float t = (dot(planoPos, n) - dot(cam, n)) / den;
                    if (t > 0.05f && t < 15f) return new float[]{cam[0] + dir[0] * t, cam[1] + dir[1] * t, cam[2] + dir[2] * t};
                }
            }
        }
        return proyectar(p, planoPos, n);
    }

    static float[] proyectar(float[] p, float[] planoPos, float[] n) {
        float d = (p[0] - planoPos[0]) * n[0] + (p[1] - planoPos[1]) * n[1] + (p[2] - planoPos[2]) * n[2];
        return new float[]{p[0] - d * n[0], p[1] - d * n[1], p[2] - d * n[2]};
    }

    /**
     * "Pegar a techo/pared": proyección perpendicular a un plano detectado hasta maxDist.
     * Devuelve {x, y, z, puntuación} (menor = mejor; penaliza alejarse del centro del parche), o null.
     */
    static float[] pegar(float[] p, float[] centro, float[] normal, float maxDist) {
        float[] n = normalizar(normal);
        if (n == null) return null;
        float d = (p[0] - centro[0]) * n[0] + (p[1] - centro[1]) * n[1] + (p[2] - centro[2]) * n[2];
        if (!Float.isFinite(d) || Math.abs(d) > maxDist) return null;
        float[] q = {p[0] - d * n[0], p[1] - d * n[1], p[2] - d * n[2]};
        float lejos = distancia(q, centro);
        return new float[]{q[0], q[1], q[2], Math.abs(d) + 0.25f * Math.max(0f, lejos - 1.5f)};
    }

    /**
     * "Esquivar instalación": aparta el punto SOBRE su superficie (normal n, puede ser null) hasta
     * quedar a radio + margen de cada instalación existente que lo toque. null si no toca ninguna.
     */
    static float[] esquivar(float[] p, float[] normal, float[][] centros, float[] radios, float margen) {
        float[] n = normalizar(normal);
        float[] q = p.clone();
        boolean movido = false;
        for (int it = 0; it < 4; it++) {
            int peor = -1; float peorD = 0;
            for (int i = 0; i < centros.length; i++) {
                float d = distancia(centros[i], q) - radios[i];
                if (d < margen - 1e-4f && (peor < 0 || d < peorD)) { peor = i; peorD = d; }
            }
            if (peor < 0) break;
            float[] c = centros[peor];
            float r2 = radios[peor] + margen;
            float h = 0;
            float[] base = c.clone();
            if (n != null) {
                h = (c[0] - q[0]) * n[0] + (c[1] - q[1]) * n[1] + (c[2] - q[2]) * n[2];
                base = new float[]{c[0] - h * n[0], c[1] - h * n[1], c[2] - h * n[2]};
            }
            float r = (float) Math.sqrt(Math.max(0, r2 * r2 - h * h));
            float[] v = {q[0] - base[0], q[1] - base[1], q[2] - base[2]};
            if (n != null) { float k = dot(v, n); for (int i = 0; i < 3; i++) v[i] -= k * n[i]; }
            if (dot(v, v) < 1e-8f) {
                if (n != null) v = cruz(n, Math.abs(n[1]) > 0.9f ? new float[]{1, 0, 0} : new float[]{0, 1, 0});
                else v = new float[]{1, 0, 0};
            }
            v = unitario(v);
            q = new float[]{base[0] + v[0] * (r + 1e-3f), base[1] + v[1] * (r + 1e-3f), base[2] + v[2] * (r + 1e-3f)};
            movido = true;
        }
        return movido ? q : null;
    }

    /** Cuaternión (x, y, z, w) que lleva +Y a la normal n (convención de las anclas de ARCore). */
    static float[] quatDesdeNormal(float[] normal) {
        float[] n = normalizar(normal);
        if (n == null) return new float[]{0, 0, 0, 1};
        if (n[1] < -0.9999f) return new float[]{1, 0, 0, 0};   // 180° sobre X: +Y → -Y (techo)
        // cross((0,1,0), n) = (n.z, 0, -n.x); w = 1 + dot((0,1,0), n)
        float x = n[2], z = -n[0], w = 1 + n[1];
        float l = (float) Math.sqrt(x * x + z * z + w * w);
        return new float[]{x / l, 0, z / l, w / l};
    }

    /** Punto en pantalla (pares x,y; NaN = no visible) más cercano a un toque, o -1 si lejos. */
    static int puntoMasCercano(float[] pantalla, float x, float y, float maxPx) {
        int mejor = -1; float mejorD = maxPx;
        for (int i = 0; i + 1 < pantalla.length; i += 2) {
            float px = pantalla[i], py = pantalla[i + 1];
            if (Float.isNaN(px) || Float.isNaN(py)) continue;
            float d = (float) Math.hypot(px - x, py - y);
            if (d < mejorD) { mejorD = d; mejor = i / 2; }
        }
        return mejor;
    }

    private static float dot(float[] a, float[] b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    private static float longitud(float[] a) { return (float) Math.sqrt(dot(a, a)); }
    private static float distancia(float[] a, float[] b) {
        float dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        return (float) Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    private static float[] cruz(float[] a, float[] b) {
        return new float[]{a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]};
    }
    /** Normal válida (misma regla que _replN: longitud² > 0,25) ya unitaria, o null. */
    static float[] normalizar(float[] v) {
        if (v == null) return null;
        float l = longitud(v);
        if (!Float.isFinite(l) || l * l <= 0.25f) return null;
        return new float[]{v[0] / l, v[1] / l, v[2] / l};
    }
    private static float[] unitario(float[] v) {
        float l = longitud(v);
        return l > 1e-9f ? new float[]{v[0] / l, v[1] / l, v[2] / l} : new float[]{1, 0, 0};
    }
}
