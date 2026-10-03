package com.padilla585.alejandra.ar;

import org.junit.Test;
import static org.junit.Assert.*;

/** Mismos casos que scripts/replanteo-trazado.test.cjs (paridad APK ↔ PWA, repl3d.js). */
public class TrazadoGeometriaTest {
    private static final float E = 1e-5f;

    @Test public void elPlanoForzadoUsaLaNormalDetectadaSoloSiEsDeEseTipo() {
        assertArrayEquals(new float[]{0, -1, 0}, TrazadoGeometria.normalDeTipo("techo", null, new float[]{0, 0, -1}), E);
        assertArrayEquals(new float[]{0, 1, 0}, TrazadoGeometria.normalDeTipo("suelo", new float[]{0, 0, 1}, null), E);
        // Una normal de suelo no vale para un tramo de pared: horizontal hacia la cámara.
        float[] pared = TrazadoGeometria.normalDeTipo("pared", new float[]{0, 1, 0}, new float[]{0.2f, -0.1f, -1});
        assertEquals(0f, pared[1], E);
        assertTrue(pared[2] > 0.9f);
        float[] real = TrazadoGeometria.normalDeTipo("pared", new float[]{0.1f, 0, 1}, new float[]{0, 0, -1});
        assertTrue("si es de verdad una pared, se usa su normal", real[0] > 0.09f);
    }

    @Test public void forzarAlTechoAunqueLaProfundidadCaigaSobreUnaInstalacion() {
        float[] cam = {0, 1.5f, 0}, plano = {0.3f, 2.5f, -1}, n = {0, -1, 0};
        float[] raro = {0.8f, 2.1f, -1.2f};
        float[] q = TrazadoGeometria.forzarAPlano(plano, n, raro, cam);
        assertEquals(2.5f, q[1], E);
        // Misma dirección en la que apuntaba el usuario.
        float k = (q[1] - cam[1]) / (raro[1] - cam[1]);
        assertEquals(cam[0] + (raro[0] - cam[0]) * k, q[0], E);
        assertEquals(cam[2] + (raro[2] - cam[2]) * k, q[2], E);
        // Sin hit ni profundidad basta el rayo central.
        assertEquals(2.5f, TrazadoGeometria.forzarAPlano(plano, n, new float[]{0, 2, -1}, cam)[1], E);
        // Rayo casi paralelo: perpendicular, nunca a kilómetros.
        float[] rasante = TrazadoGeometria.forzarAPlano(plano, n, new float[]{5, 1.55f, 0}, cam);
        assertArrayEquals(new float[]{5, 2.5f, 0}, rasante, E);
        // Contacto (sin cámara): perpendicular.
        assertArrayEquals(new float[]{1, 2.5f, -1}, TrazadoGeometria.forzarAPlano(plano, n, new float[]{1, 2.45f, -1}, null), E);
    }

    @Test public void pegarATechoSinSaltarAUnPlanoLejano() {
        float[] r = TrazadoGeometria.pegar(new float[]{0.4f, 2.1f, -1.5f}, new float[]{0, 2.5f, -1}, new float[]{0, -1, 0}, TrazadoGeometria.MAX_PEGAR_M);
        assertArrayEquals(new float[]{0.4f, 2.5f, -1.5f}, new float[]{r[0], r[1], r[2]}, E);
        assertNull(TrazadoGeometria.pegar(new float[]{0, 0.2f, 0}, new float[]{0, 2.5f, -1}, new float[]{0, -1, 0}, TrazadoGeometria.MAX_PEGAR_M));
        assertNull(TrazadoGeometria.pegar(new float[]{0, Float.NaN, 0}, new float[]{0, 2.5f, -1}, new float[]{0, -1, 0}, 1.5f));
    }

    @Test public void esquivarUnaInstalacionSinDespegarseDelTecho() {
        float[][] centros = {{1, 2.45f, -1}};
        float[] radios = {0.3f};
        float[] q = TrazadoGeometria.esquivar(new float[]{1.1f, 2.5f, -1}, new float[]{0, -1, 0}, centros, radios, 0.05f);
        assertNotNull(q);
        assertEquals("sigue en el techo", 2.5f, q[1], E);
        float dx = q[0] - 1, dy = q[1] - 2.45f, dz = q[2] + 1;
        assertTrue("fuera de radio + margen", Math.sqrt(dx * dx + dy * dy + dz * dz) >= 0.35f - 1e-4f);
        assertTrue("hacia el lado en el que ya estaba", q[0] > 1.1f);
        assertNull(TrazadoGeometria.esquivar(new float[]{3, 2.5f, -1}, new float[]{0, -1, 0}, centros, radios, 0.05f));
    }

    @Test public void elCuaternionDelAnclaPoneSuEjeYEnLaNormal() {
        float[][] normales = {{0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {1, 0, 0}, {0.6f, 0, -0.8f}};
        for (float[] n : normales) {
            float[] q = TrazadoGeometria.quatDesdeNormal(n);
            float x = q[0], y = q[1], z = q[2], w = q[3];
            // Columna Y de la rotación: misma fórmula que normalDeQuat en index.html/overlay.html.
            float[] eje = {2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)};
            assertArrayEquals(n, eje, E);
        }
    }

    @Test public void unToqueEligeElPuntoMasCercanoVisible() {
        float[] pantalla = {100, 100, Float.NaN, Float.NaN, 300, 300};
        assertEquals(2, TrazadoGeometria.puntoMasCercano(pantalla, 290, 310, 70));
        assertEquals(0, TrazadoGeometria.puntoMasCercano(pantalla, 120, 90, 70));
        assertEquals(-1, TrazadoGeometria.puntoMasCercano(pantalla, 600, 600, 70));
    }
}
