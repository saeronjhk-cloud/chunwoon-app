// Service Worker for 天運 PWA
const CACHE_NAME = 'chunwoon-v3.23.0';
const EXTRA_ASSETS = ['/js/tarot.js', '/js/chat.js', '/js/toss-pay.js', '/js/disclaimer.js'];
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/favicon.svg',
  'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300;400;600;700&family=Noto+Sans+KR:wght@300;400;500;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // /api/* 와 Toss SDK는 캐싱하지 않음 — 항상 네트워크
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.hostname === 'js.tosspayments.com' || url.hostname === 'api.tosspayments.com') {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.url.startsWith('http')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-fortune') {}
});

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
