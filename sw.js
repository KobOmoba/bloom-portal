// EduBloom — Command Center Service Worker
const CACHE_NAME = 'edubloom-bledubloom-bloom-portal-20260904-20260904';
const SHELL_ASSETS = [
  './',
  './index.html',
  './portal_app.js',
  './style.css',
  './icon-192x192.png',
  './icon-512x512.png',
  './manifest.json',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache partial fail:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip Firestore — it has its own offline persistence
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase.googleapis.com')) {
    return;
  }

  // Network-first for everything, including the app shell — always serve
  // the freshest code when online. Only fall back to cache when the
  // network request itself fails (offline, or a transient drop like the
  // one that broke style.css loading with no recovery on 2026-08-03).
  // ignoreSearch so a cache-busted URL (?v=N) still matches whatever
  // version is cached as a last resort, instead of failing outright.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.destination === 'document') {
          return caches.match('./index.html', { ignoreSearch: true });
        }
      })
  );
});

console.log('[SW] EduBloom Command Center Service Worker loaded ✅');
