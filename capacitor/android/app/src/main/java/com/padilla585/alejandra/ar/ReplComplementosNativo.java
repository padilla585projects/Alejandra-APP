package com.padilla585.alejandra.ar;

/**
 * REPL-AR-NATIVO-COMP-01 (17/09/2026): mismas keys/nombres que REPL_COMPLEMENTOS en repl3d.js
 * (PWA) -- las cajas de aquí son una caja "de bulto" que aproxima el tamaño real de cada
 * accesorio, no la geometría detallada (esa la sigue dibujando solo la PWA a partir de la key
 * guardada). Si se añade un accesorio nuevo en repl3d.js, añadir aquí también su key/tamaño/color
 * para que se pueda colocar desde el AR nativo -- si no, sigue pudiéndose colocar desde la PWA.
 */
final class ReplComplementosNativo {
    final String key;
    final String nombre;
    final float w, h, d;   // metros
    final float r, g, b;   // 0..1

    private ReplComplementosNativo(String key, String nombre, float w, float h, float d, int colorHex) {
        this.key = key; this.nombre = nombre; this.w = w; this.h = h; this.d = d;
        this.r = ((colorHex >> 16) & 0xFF) / 255f;
        this.g = ((colorHex >> 8) & 0xFF) / 255f;
        this.b = (colorHex & 0xFF) / 255f;
    }

    static final ReplComplementosNativo[] CATALOGO = {
        new ReplComplementosNativo("enchufe",         "🔌 Enchufe schuko",     0.08f, 0.08f, 0.02f, 0xE8E8E8),
        new ReplComplementosNativo("interruptor",     "💡 Interruptor",        0.08f, 0.08f, 0.02f, 0xFFFFFF),
        new ReplComplementosNativo("conmutador",      "💡 Conmutador",         0.08f, 0.08f, 0.02f, 0xFFFFFF),
        new ReplComplementosNativo("doble",           "💡 Doble interruptor",  0.08f, 0.08f, 0.02f, 0xFFFFFF),
        new ReplComplementosNativo("pulsador",        "🔘 Pulsador",           0.08f, 0.08f, 0.02f, 0xFFFFFF),
        new ReplComplementosNativo("regulador",       "🎚 Regulador",          0.08f, 0.08f, 0.02f, 0xCCCCCC),
        new ReplComplementosNativo("rj45",             "🌐 Toma de red RJ45",   0.08f, 0.08f, 0.02f, 0xDDDDDD),
        new ReplComplementosNativo("tv",               "📺 Toma de TV",         0.08f, 0.08f, 0.02f, 0xDDDDDD),
        new ReplComplementosNativo("caja_mecanismo",   "⬜ Caja de mecanismo",  0.07f, 0.07f, 0.05f, 0xFF8C00),
        new ReplComplementosNativo("caja_registro",    "📦 Caja de registro",   0.10f, 0.10f, 0.05f, 0xD97706),
        new ReplComplementosNativo("cuadro",           "🗄 Cuadro eléctrico",   0.36f, 0.50f, 0.11f, 0xDFE3E8),
        new ReplComplementosNativo("luminaria",        "💡 Luminaria",          0.28f, 0.03f, 0.28f, 0xFFF2CC),
    };

    static ReplComplementosNativo porKey(String key) {
        for (ReplComplementosNativo c : CATALOGO) if (c.key.equals(key)) return c;
        return CATALOGO[0];
    }
}
