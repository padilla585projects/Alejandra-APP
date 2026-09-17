package com.padilla585.alejandra.ar;

/**
 * REPL-AR-NATIVO-COMP-01 (17/09/2026): mismas keys/nombres que REPL_COMPLEMENTOS en repl3d.js
 * (PWA) -- solo para llenar el selector nativo (Spinner) de qué complemento colocar. La
 * geometría real la dibuja threeOverlay (ver REPL-AR-OVERLAY-01 en ReplanteoARActivity), que ya
 * carga repl3d.js tal cual -- si se añade un accesorio nuevo ahí, añadir aquí también su
 * key/nombre para que aparezca en el selector nativo; si no, sigue pudiéndose colocar desde la PWA.
 */
final class ReplComplementosNativo {
    final String key;
    final String nombre;

    private ReplComplementosNativo(String key, String nombre) {
        this.key = key; this.nombre = nombre;
    }

    static final ReplComplementosNativo[] CATALOGO = {
        new ReplComplementosNativo("enchufe",         "🔌 Enchufe schuko"),
        new ReplComplementosNativo("interruptor",     "💡 Interruptor"),
        new ReplComplementosNativo("conmutador",      "💡 Conmutador"),
        new ReplComplementosNativo("doble",           "💡 Doble interruptor"),
        new ReplComplementosNativo("pulsador",        "🔘 Pulsador"),
        new ReplComplementosNativo("regulador",       "🎚 Regulador"),
        new ReplComplementosNativo("rj45",             "🌐 Toma de red RJ45"),
        new ReplComplementosNativo("tv",               "📺 Toma de TV"),
        new ReplComplementosNativo("caja_mecanismo",   "⬜ Caja de mecanismo"),
        new ReplComplementosNativo("caja_registro",    "📦 Caja de registro"),
        new ReplComplementosNativo("cuadro",           "🗄 Cuadro eléctrico"),
        new ReplComplementosNativo("luminaria",        "💡 Luminaria"),
    };
}
