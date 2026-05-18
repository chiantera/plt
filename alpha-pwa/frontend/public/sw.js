const CACHE = 'plt-v3';

// Cache app shell on install
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(['/', './index.html'])
        .catch(() => {}) // non-fatal if offline during install
    )
  );
});

// Take control immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for API, cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API calls — always live
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for static assets (JS, CSS, fonts, images)
  if (e.request.destination === 'script' ||
      e.request.destination === 'style' ||
      e.request.destination === 'font' ||
      e.request.destination === 'image') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Network-first for navigation (HTML) — fall back to cached index
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => { caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match('./index.html'))
    );
  }
});
