// Hors ligne : la coquille de l'app est gardée en cache. Les données (chiffrées) restent dans le stockage de l'app.
const CACHE = 'trousseau-mobile-202611211247';
const FICHIERS = ['./', 'index.html', 'mobile.css', 'mobile.js', 'services.js', 'jsqr.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'ic-anthropic.png', 'ic-github.png', 'ic-gemini.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(l => Promise.all(l.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET') return;   // jamais GitHub ni autre chose
  // Réseau d'abord (mises à jour immédiates), cache si hors ligne.
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./'))));
});

// Notifications envoyées par Trousseau sur le PC (Web Push) : affichées même quand l'app est fermée.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corps: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titre || 'Trousseau', { body: d.corps || '', tag: d.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { for (const c of l) if ('focus' in c) return c.focus(); return self.clients.openWindow('./'); }));
});
