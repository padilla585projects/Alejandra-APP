package com.padilla585.alejandra;

import org.junit.Test;
import java.util.Collections;
import static org.junit.Assert.*;

public class UpdatePolicyTest {
    @Test public void aceptaSoloApkHttpsDelRepositorioOficial() {
        assertTrue(UpdatePolicy.trustedUrl("https://github.com/padilla585projects/Alejandra-APP/releases/latest/download/alejandra.apk"));
        assertTrue(UpdatePolicy.trustedUrl("https://github.com/padilla585projects/Alejandra-APP/releases/download/app-android-v17/alejandra.apk"));
        for (String url : new String[]{null, "http://github.com/padilla585projects/Alejandra-APP/releases/latest/download/alejandra.apk",
                "https://github.com.evil.test/padilla585projects/Alejandra-APP/releases/latest/download/alejandra.apk",
                "https://user@github.com/padilla585projects/Alejandra-APP/releases/latest/download/alejandra.apk",
                "https://github.com/other/repo/releases/latest/download/alejandra.apk",
                "https://github.com/padilla585projects/Alejandra-APP/releases/latest/download/../alejandra.apk",
                "https://github.com/padilla585projects/Alejandra-APP/releases/latest/download/alejandra.apk?x=1"}) assertFalse(url, UpdatePolicy.trustedUrl(url));
    }
    @Test public void omiteBorradoresPrereleasesYTagsAjenos() {
        assertEquals(17, UpdatePolicy.releaseVersion("app-android-v17", false, false));
        assertEquals(0, UpdatePolicy.releaseVersion("app-android-v17", true, false));
        assertEquals(0, UpdatePolicy.releaseVersion("app-android-v17", false, true));
        for (String tag : new String[]{null,"v9.78","app-android-v0","otro-v17","app-android-v17-rc1","app-android-v999999999999999999999"})
            assertEquals(0, UpdatePolicy.releaseVersion(tag, false, false));
    }
    @Test public void instalaSoloVersionNuevaConPaqueteYFirmaCorrectos() {
        assertTrue(permitida("app", "app", 16, 17, 17, "firma", "firma"));
        assertFalse(permitida("app", "otro", 16, 17, 17, "firma", "firma"));
        assertFalse(permitida("app", "app", 16, 16, 0, "firma", "firma"));
        assertFalse(permitida("app", "app", 16, 15, 0, "firma", "firma"));
        assertFalse(permitida("app", "app", 16, 17, 18, "firma", "firma"));
        assertFalse(permitida("app", "app", 16, 17, 17, "firma", "atacante"));
        assertFalse(UpdatePolicy.canInstall("app", "app", 16, 17, 17, Collections.emptySet(), Collections.emptySet()));
    }
    private boolean permitida(String a, String b, long local, long remote, long expected, String signerA, String signerB) {
        return UpdatePolicy.canInstall(a,b,local,remote,expected,Collections.singleton(signerA),Collections.singleton(signerB));
    }
}
