/* ── LingoFlow Service Worker ── */

const CACHE_STATIC  = 'lingoflow-static-v2';
const CACHE_RUNTIME = 'lingoflow-runtime-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

/* ── Install: pre-cache static shell ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: purge old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_RUNTIME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: strategy per request type ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Skip browser extensions and chrome-extension requests
  if (!url.protocol.startsWith('http')) return;

  // Don't cache API calls
  if (url.hostname === 'api.deepseek.com') return;

  // —— Static assets: cache-first ——
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetchAndCache(request, CACHE_STATIC))
    );
    return;
  }

  // —— Everything else: stale-while-revalidate ——
  event.respondWith(staleWhileRevalidate(request));
});

/* ── Strategies ── */

function isStaticAsset(url) {
  const path = url.pathname;
  return /\.(png|ico|svg|woff2?|ttf|json)$/.test(path);
}

function fetchAndCache(request, cacheName) {
  return fetch(request).then((response) => {
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  });
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE_RUNTIME).then((cache) =>
    cache.match(request).then((cached) => {
      const networked = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || networked;
    })
  );
}
