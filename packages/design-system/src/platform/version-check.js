// Utilidad de plataforma pura: consulta version.json (con cache-bust) y la
// compara contra la version local. No toca el DOM, no dispara Service Worker,
// caches ni recarga -- eso sigue siendo responsabilidad exclusiva de quien la
// invoque (index.html/panel.html conservan su propio banner, toast y flujo
// de actualizacion forzada, sin cambios). Cualquier fallo de red o de
// contenido se trata como "sin novedad" (matches:true), igual que el
// try/catch vacio que ya usaban las dos implementaciones que sustituye --
// un fallo de esta consulta nunca debe disparar una recarga por su cuenta.
(function registerVersionCheck() {
  async function checkRemoteVersion({ currentVersion, fetchImpl = fetch, cacheBust }) {
    try {
      const bust = cacheBust !== undefined ? cacheBust : Date.now();
      const res = await fetchImpl('version.json?_=' + bust, { cache: 'no-store' });
      if (!res.ok) return { ok: false, remoteVersion: null, matches: true };
      const data = await res.json();
      const remoteVersion = data && data.v ? data.v : null;
      if (!remoteVersion) return { ok: false, remoteVersion: null, matches: true };
      return { ok: true, remoteVersion, matches: remoteVersion === currentVersion };
    } catch {
      return { ok: false, remoteVersion: null, matches: true };
    }
  }

  if (typeof window !== 'undefined') {
    window.AlejandraPresentation = window.AlejandraPresentation || {};
    window.AlejandraPresentation.platform = window.AlejandraPresentation.platform || {};
    window.AlejandraPresentation.platform.checkRemoteVersion = checkRemoteVersion;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { checkRemoteVersion };
  }
})();
