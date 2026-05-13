const CACHE = 'edu-bloom-v1';
const FILES = [
    './',
    './index.html',
    './manifest.json',
    './icon-192x192.png'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
