package com.padilla585.alejandra;

import java.net.URI;
import java.util.Set;

/** Política única de origen, versiones y firma para actualizaciones de la suite. */
final class UpdatePolicy {
    static final String API = "https://api.github.com/repos/padilla585projects/Alejandra-APP/releases/latest";
    static final String PREFIX = "/padilla585projects/Alejandra-APP/releases/";

    static long releaseVersion(String tag, boolean draft, boolean prerelease) {
        if (draft || prerelease || tag == null || !tag.matches("app-android-v[1-9][0-9]*")) return 0;
        try { return Long.parseLong(tag.substring("app-android-v".length())); }
        catch (NumberFormatException e) { return 0; }
    }

    static boolean trustedUrl(String value) {
        try {
            URI uri = new URI(value);
            String path = uri.getRawPath();
            return "https".equals(uri.getScheme()) && "github.com".equals(uri.getHost())
                    && uri.getUserInfo() == null && uri.getPort() == -1
                    && uri.getRawQuery() == null && uri.getRawFragment() == null
                    && (path.equals(PREFIX + "latest/download/alejandra.apk")
                        || path.matches(PREFIX + "download/app-android-v[1-9][0-9]*/alejandra\\.apk"));
        } catch (Exception e) { return false; }
    }

    static boolean canInstall(String localPackage, String remotePackage, long local, long remote,
                              long expected, Set<String> localSigners, Set<String> remoteSigners) {
        return localPackage != null && localPackage.equals(remotePackage)
                && remote > local && (expected == 0 || expected == remote)
                && localSigners != null && !localSigners.isEmpty()
                && localSigners.equals(remoteSigners);
    }
}
