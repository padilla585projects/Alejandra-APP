// Cambia este número cada vez que actualices la app
const CACHE = 'alejandra-v7.10';

self.addEventListener('install', e => {
  self.skipWaiting();
});

// La página puede pedirle al SW que se active si está en espera
self.addEventListener('message', e => {
  if (e.data?.tipo === 'SKIP_WAITING') self.skipWaiting();
});

// ── Push notifications de Alejandra IA (solo developer) ─────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'Alejandra', body: e.data?.text() || '' }; }
  const title = data.title || 'Alejandra';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'alejandra-ia',
    renotify: true,
    data: { url: data.url || '/panel.html' },
    vibrate: [200, 100, 200]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/panel.html';
  const navTo = e.notification.data?.navTo || null;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Buscar ventana ya abierta con la app
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (navTo) client.postMessage({ tipo: 'NOTIF_NAV', navTo });
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
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

// Navegación (HTML): SIEMPRE al servidor real (cache:'no-store' bypasses HTTP cache)
// + cachear respuesta para offline. Esto evita que el browser sirva HTML viejo
// desde su propia HTTP cache (bug de "actualiza y vuelve a la anterior").
// Resto de recursos: red primero, caché como fallback offline
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
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

