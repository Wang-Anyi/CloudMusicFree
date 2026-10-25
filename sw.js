const CACHE_NAME = 'cloudmusic-v8';
const ASSETS = ['./', './index.html', './script.js', './style.css', './manifest.json'];
const OPTIONAL_ASSETS = ['./assets/icon-192.png', './assets/icon-512.png', './assets/favicon.ico'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => Promise.all(
                OPTIONAL_ASSETS.map((url) => cache.add(url).catch(() => {}))
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
});
