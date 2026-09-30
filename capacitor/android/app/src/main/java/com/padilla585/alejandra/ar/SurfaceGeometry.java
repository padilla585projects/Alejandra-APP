package com.padilla585.alejandra.ar;

/** Geometría en metros, independiente de Android para probar el pegado a superficies. */
final class SurfaceGeometry {
    static final float MAX_SNAP_M = 0.15f;

    static float[] project(float[] point, float[] center, float[] normal) {
        float d = 0;
        for (int i = 0; i < 3; i++) d += (point[i] - center[i]) * normal[i];
        if (!Float.isFinite(d) || Math.abs(d) > MAX_SNAP_M) return null;
        return new float[]{point[0] - d * normal[0], point[1] - d * normal[1], point[2] - d * normal[2]};
    }

    static String type(float normalY) {
        return normalY > 0.7f ? "suelo" : normalY < -0.7f ? "techo" : "pared";
    }

    static int depthMm(short raw) { return raw & 0xffff; }

    static float[] complementQuaternion(float[] q, float giro) {
        float h = 0.70710678f;
        // q * Rx(-90°), después giro local sobre el frente +Z del mecanismo.
        float[] base = multiply(q, new float[]{-h,0,0,h});
        return multiply(base, new float[]{0,0,(float)Math.sin(giro/2),(float)Math.cos(giro/2)});
    }

    private static float[] multiply(float[] a, float[] b) {
        return new float[]{
            a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
            a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
            a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
            a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]};
    }
}
