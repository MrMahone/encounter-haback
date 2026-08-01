/* Service Worker: App offline halten, Daten trotzdem frisch ziehen. */

// Name bei jeder Aenderung an den Dateien hochzaehlen - das ist das Signal,
// an dem der Browser merkt, dass es eine neue Fassung gibt.
const CACHE = 'ln-hp-v11';

const SHELL = [
  './',
  'index.html',
  'app.css',
  'app.js',
  'initiative.css',
  'initiative.js',
  'farben.css',
  'farben.js',
  'manifest.webmanifest',
  'data/kreaturen.json',
  'data/encounter.json',
  'data/farben.json',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // JSON: erst Netz (damit Änderungen ankommen), sonst Cache
  if (req.url.includes('/data/')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Rest: erst Cache, im Hintergrund nachladen
  e.respondWith(
    caches.match(req).then((hit) => {
      const netz = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || netz;
    })
  );
});
