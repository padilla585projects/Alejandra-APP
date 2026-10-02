package com.padilla585.alejandra.ar;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

/** ADR-0027: misma lógica que repl3d.js (probada en scripts/replanteo-escaneo.test.cjs). */
public class EscaneoEntornoTest {
    // Cámara en (0, 1.5, 0) mirando a -Z, proyección de 60° y aspecto 4:3 (column-major).
    private static float[] pose() {
        return new float[]{1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1.5f, 0, 1};
    }
    private static float[] proj() {
        float f = (float) (1 / Math.tan(Math.toRadians(30))), n = 0.05f, fa = 50f, a = 4f / 3f;
        return new float[]{f / a, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0};
    }

    @Test public void suficienteConYSinIA() {
        assertFalse(EscaneoEntorno.suficiente(0, 0, true, 2));
        assertTrue(EscaneoEntorno.suficiente(1, 3, true, 9));
        assertTrue("pared lisa: la IA ya ve la sala", EscaneoEntorno.suficiente(0, 5, true, 15));
        assertFalse(EscaneoEntorno.suficiente(1, 0, false, 30));
        assertTrue(EscaneoEntorno.suficiente(2, 0, false, 1));
    }

    @Test public void rayoProyeccionYCorteSonCoherentes() {
        float[] view = EscaneoEntorno.invertir(pose());
        assertNotNull(view);
        float[] p = {0.4f, 1.9f, -3f};
        float[] uv = EscaneoEntorno.proyectar(view, proj(), p);
        assertNotNull(uv);
        assertTrue(uv[0] > 0.5f && uv[1] < 0.5f);
        float[] r = EscaneoEntorno.rayo(pose(), proj(), uv[0], uv[1]);
        float t = EscaneoEntorno.cortar(r, new float[]{0, 1.5f, -3}, new float[]{0, 0, 1}, 8f);
        assertTrue(t > 0);
        assertArrayEquals(p, new float[]{r[0] + r[3] * t, r[1] + r[4] * t, r[2] + r[5] * t}, 1e-3f);
        assertNull("detrás de la cámara", EscaneoEntorno.proyectar(view, proj(), new float[]{0, 1.5f, 2}));
        assertEquals(-1f, EscaneoEntorno.cortar(r, new float[]{0, 1.5f, 3}, new float[]{0, 0, 1}, 8f), 0f);
    }

    @Test public void laIADescartaMueblesConMayoria() {
        Map<String, Integer> v = new HashMap<>();
        assertFalse(EscaneoEntorno.excluido(v));
        v.put("suelo", 1); v.put("mueble", 3);
        assertTrue(EscaneoEntorno.excluido(v));
        v.put("suelo", 4);
        assertFalse(EscaneoEntorno.excluido(v));
    }

    @Test public void avisoSobreInstalacionExistente() {
        assertTrue(EscaneoEntorno.cercana(new float[]{0.3f, 2, -3}, new float[]{0, 2, -3}, 0.2f));
        assertFalse(EscaneoEntorno.cercana(new float[]{1.5f, 2, -3}, new float[]{0, 2, -3}, 0.2f));
    }
}
