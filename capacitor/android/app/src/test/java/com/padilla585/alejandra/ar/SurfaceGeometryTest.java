package com.padilla585.alejandra.ar;

import org.junit.Test;
import static org.junit.Assert.*;

public class SurfaceGeometryTest {
    @Test public void pegaEnSueloTechoYParedSinMoverLasOtrasCoordenadas() {
        assertArrayEquals(new float[]{1,0,2}, SurfaceGeometry.project(new float[]{1,.1f,2}, new float[]{0,0,0}, new float[]{0,1,0}), .00001f);
        assertArrayEquals(new float[]{1,3,2}, SurfaceGeometry.project(new float[]{1,2.9f,2}, new float[]{0,3,0}, new float[]{0,-1,0}), .00001f);
        assertArrayEquals(new float[]{2,1,3}, SurfaceGeometry.project(new float[]{1.9f,1,3}, new float[]{2,0,0}, new float[]{-1,0,0}), .00001f);
    }
    @Test public void noSaltaAUnaSuperficieLejanaNiAceptaDatosInvalidos() {
        assertNull(SurfaceGeometry.project(new float[]{0,.3f,0}, new float[]{0,0,0}, new float[]{0,1,0}));
        assertNull(SurfaceGeometry.project(new float[]{0,Float.NaN,0}, new float[]{0,0,0}, new float[]{0,1,0}));
    }
    @Test public void distingueSuperficiesPorSuNormalExterior() {
        assertEquals("suelo", SurfaceGeometry.type(1));
        assertEquals("techo", SurfaceGeometry.type(-1));
        assertEquals("pared", SurfaceGeometry.type(0));
    }
    @Test public void profundidadArcoreUsaLos16BitsSinConvertirLejanoEnCercano() {
        assertEquals(9000, SurfaceGeometry.depthMm((short)9000));
        assertEquals(65535, SurfaceGeometry.depthMm((short)-1));
        assertEquals(0, SurfaceGeometry.depthMm((short)0));
    }

    @Test public void frenteDelAccesorioSigueNormalDeSueloTechoYParedInclusoAlGirar() {
        float h = (float)Math.sqrt(.5);
        float[][] poses = {{0,0,0,1}, {1,0,0,0}, {h,0,0,h}};
        float[][] normales = {{0,1,0}, {0,-1,0}, {0,0,1}};
        for (int i=0; i<poses.length; i++) {
            for (float giro : new float[]{0, (float)Math.PI/3}) {
                float[] q = SurfaceGeometry.complementQuaternion(poses[i], giro);
                float x=q[0], y=q[1], z=q[2], w=q[3];
                assertArrayEquals(normales[i], new float[]{2*(x*z+w*y), 2*(y*z-w*x), 1-2*(x*x+y*y)}, .00001f);
            }
        }
    }
}
