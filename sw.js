// Cambia este número cada vez que actualices la app
const CACHE = 'alejandra-v3.2';

self.addEventListener('install', e => {
  // Activa el nuevo SW inmediatamente sin esperar a que cierren las tabs
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // 1. Borra TODAS las cachés antiguas
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      // 2. Toma control de todas las tabs abiertas → dispara controllerchange
      .then(() => self.clients.claim())
      // 3. Notifica a todas las tabs para que recarguen
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ tipo: 'SW_ACTUALIZADO', cache: CACHE })))
  );
});

// Siempre va a internet primero, caché solo si no hay conexión
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
