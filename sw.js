const CACHE_NAME = 'cloudmusic-v1';
const ASSETS = ['./', './index.html', './script.js', './style.css', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
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

    // 只接管同源请求；CDN / API 请求直接走网络，避免缓存干扰
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
