// Service Worker for 天運 PWA
const CACHE_NAME = 'chunwoon-v2.7.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/favicon.svg',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap'
];

// Install - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback to main page for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background sync for future features
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-fortune') {
    // Future: sync user data when back online
  }
});

// Push notifications for future features
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || '天運', {
      body: data.body || '오늘의 운세가 도착했습니다!',
      icon: '/icons/icon-192.svg',
      badge: '/icons/favicon.svg',
      tag: 'fortune-notification'
    });
  }
});
