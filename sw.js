// Service worker: app files cached (versioned), index.html network-first, Supabase never cached.
// Bump VERSION whenever any app file changes so phones pick up the new version.

const VERSION = 'fha-v2';
const FILES = [
  './', './index.html', './config.js', './manifest.webmanifest', './css/style.css',
  './js/app.js', './js/router.js', './js/data.js', './js/data-demo.js', './js/data-supabase.js',
  './js/store.js', './js/crypto.js', './js/i18n.js', './js/ui.js', './js/doses.js',
  './js/views-auth.js', './js/views-today.js', './js/views-meds.js', './js/views-pharmacy.js', './js/stock.js', './js/views-family.js',
  './js/views-settings.js', './js/views-admin.js', './js/views-owner.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page asks for this after the user taps "New version, reload"
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Local testing (python -m http.server): always fresh files, no cache
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return;
  // Never cache Supabase (data and auth) or anything from another site except fonts
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  // Pages: network first, so a new index.html is seen as soon as there is a connection
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html')),
    );
    return;
  }
  // Everything else: cache first, then network (and keep a copy)
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && (sameOrigin || isFont)) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
