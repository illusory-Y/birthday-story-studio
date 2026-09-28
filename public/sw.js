const CACHE_NAME = 'birthday-story-studio-v2'
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting())) })
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', (event) => { if (event.request.method !== 'GET') return; const url = new URL(event.request.url); if (url.origin !== self.location.origin) return; event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response }).catch(() => caches.match('./index.html')))) })
