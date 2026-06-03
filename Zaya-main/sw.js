/**
 * Zaya Service Worker
 * Basic caching and fetch handling for offline support.
 */

const CACHE_NAME = 'zaya-assets-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/changelog.html',
  '/lib/css/style.css',
  '/lib/js/app.js',
  '/assets/zaya.svg',
  '/lib/fonts/themify.woff'
];

// Install event: Cache initial assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-first falling back to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Let browser-internal schemes (e.g., chrome-extension) pass through
  if (event.request.url.startsWith('chrome-extension:') || event.request.url.startsWith('file:')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone it to cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try the cache
        return caches.match(event.request);
      })
  );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'GET_CACHE_SIZE':
      caches.open(CACHE_NAME).then((cache) => {
        cache.keys().then((keys) => {
          event.ports[0].postMessage({ cacheSize: keys.length });
        });
      });
      break;
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        console.log('[SW] Cache cleared');
      });
      break;
    default:
      console.log('[SW] Received unknown message:', event.data);
  }
});
