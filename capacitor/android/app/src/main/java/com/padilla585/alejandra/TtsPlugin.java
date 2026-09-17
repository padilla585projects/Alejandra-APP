package com.padilla585.alejandra;

import android.speech.tts.TextToSpeech;

import java.util.Locale;
import java.util.UUID;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * VOZ-NATIVA-01 (17/09/2026): Adrian -- "la voz hay que arreglarla también". La voz de
 * Alejandra (iaSpeak/alejandraHablar en index.html) usa window.speechSynthesis (Web Speech
 * Synthesis API) -- en el WebView de Android esa API es poco fiable: getVoices() suele devolver
 * vacío o sin voces en español hasta que el propio Android TTS ya se inicializó por otra vía, a
 * diferencia de Chrome de escritorio donde siempre hay voces. Este plugin usa el motor de Texto
 * a Voz nativo de Android (android.speech.tts.TextToSpeech, el mismo que usan Google Maps o
 * cualquier app con lectura en voz alta) en vez de depender del WebView -- fiable en cualquier
 * dispositivo con TTS de Android configurado (todos los que tengan Google, que son todos los
 * soportados por esta app).
 */
@CapacitorPlugin(name = "Tts")
public class TtsPlugin extends Plugin {

    private TextToSpeech tts;
    private boolean listo = false;

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("es", "ES"));
                // Si no hay español de España instalado, cualquier variante de español sirve
                // (mejor que fallar en silencio o hablar en inglés).
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(new Locale("es"));
                }
                listo = true;
            }
        });
    }

    @PluginMethod
    public void hablar(PluginCall call) {
        String texto = call.getString("texto");
        if (texto == null || texto.isEmpty() || !listo) { call.resolve(); return; }
        float rate = call.getFloat("rate", 1.0f);
        float pitch = call.getFloat("pitch", 1.0f);
        tts.setSpeechRate(rate);
        tts.setPitch(pitch);
        String utteranceId = UUID.randomUUID().toString();
        // Recorta igual que el límite que ya tenía alejandraHablar() en la web (500 car.) --
        // evita lecturas eternas de una respuesta larga del chat.
        String recortado = texto.length() > 500 ? texto.substring(0, 500) : texto;
        tts.speak(recortado, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
        call.resolve();
    }

    @PluginMethod
    public void detener(PluginCall call) {
        if (tts != null) { try { tts.stop(); } catch (Exception ignored) {} }
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { try { tts.shutdown(); } catch (Exception ignored) {} }
        super.handleOnDestroy();
    }
}
