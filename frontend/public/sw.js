/**
 * Sanjivani — Service Worker (Phase 7: PWA & Offline Application Shell)
 *
 * Caching Strategy:
 * - App Shell & Static Assets: Stale-While-Revalidate / Cache-First for static JS, CSS, SVG, HTML.
 * - API Calls (/api/*): STRICTLY EXCLUDED from Service Worker CacheStorage.
 *   Private health records, auth tokens, and signed URLs are NEVER stored in public CacheStorage.
 *   All private offline data is managed exclusively via user-partitioned IndexedDB.
 */

const CACHE_NAME = 'sanjivani-shell-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// Install Event: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Cleanup outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Serve cached shell for navigation and static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER intercept or cache backend API requests or external services
  if (url.pathname.startsWith('/api') || url.origin !== self.location.origin) {
    return;
  }

  // 2. Navigation requests (HTML document): Network-first with offline fallback to /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = await cache.match('/index.html');
        return cachedIndex || new Response('Offline: Sanjivani Application Shell unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
    return;
  }

  // 3. Static assets (JS, CSS, fonts, SVG): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, nothing to do if already handled by cache
      });

      return cachedResponse || fetchPromise;
    })
  );
});
