// Cambia este número cada vez que actualices la app
const CACHE = 'alejandra-v4.11';

self.addEventListener('install', e => {
  self.skipWaiting();
});

// La página puede pedirle al SW que se active si está en espera
self.addEventListener('message', e => {
  if (e.data?.tipo === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
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
