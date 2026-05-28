/**
 * Service Worker - ONE-DELUX PWA
 * Cache offline et performance optimisee
 */

const CACHE_NAME = 'one-delux-v2';
const STATIC_CACHE = 'one-delux-static-v2';
const DYNAMIC_CACHE = 'one-delux-dynamic-v2';
const API_CACHE = 'one-delux-api-v2';

const CACHE_CONFIG = {
  maxSize: 50 * 1024 * 1024,
  maxEntries: 1000,
  staleWhileRevalidate: true,
  cacheWarming: true,
  networkAware: true
};

const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/mobile.css',
  '/mobile-optimizations.css',
  '/mobile-ultra-premium.css',
  '/theme-system.css',
  '/global-enhancements.css',
  '/site-api.js',
  '/database-api.js',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.webmanifest'
];

const SECONDARY_ASSETS = [
  '/coupon.html',
  '/suivre.html',
  '/gallery.html',
  '/mode-emploi.html',
  '/updates.html',
  '/about.html',
  '/developpeur.html',
  '/gallery-mobile.css',
  '/pages-luxe.css',
  '/unified-system.css',
  '/signature.css',
  '/site-embellishment.css',
  '/updates.css',
  '/gallery.js',
  '/mobile-menu.js',
  '/global-ui-shell.js',
  '/browser-sync.js'
];

const STATIC_ASSETS = [...CRITICAL_ASSETS, ...SECONDARY_ASSETS];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation en cours...');
  event.waitUntil(
    (async () => {
      try {
        if (CACHE_CONFIG.cacheWarming) {
          const cache = await caches.open(STATIC_CACHE);
          await cache.addAll(CRITICAL_ASSETS);
          setTimeout(async () => {
            try {
              await cache.addAll(SECONDARY_ASSETS);
            } catch (error) {
              console.warn('[Service Worker] Erreur cache secondaire:', error);
            }
          }, 1000);
        } else {
          const cache = await caches.open(STATIC_CACHE);
          await cache.addAll(STATIC_ASSETS);
        }
        return self.skipWaiting();
      } catch (error) {
        console.error('[Service Worker] Erreur lors de l installation:', error);
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation en cours...');
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && cacheName !== API_CACHE) {
              return caches.delete(cacheName);
            }
            return Promise.resolve();
          })
        );
        await cleanupCache(DYNAMIC_CACHE);
        await cleanupCache(API_CACHE);
        return self.clients.claim();
      } catch (error) {
        console.error('[Service Worker] Erreur lors de l activation:', error);
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (request.destination === 'style' || request.destination === 'script' || request.destination === 'image') {
    event.respondWith(CACHE_CONFIG.staleWhileRevalidate ? staleWhileRevalidate(request) : cacheFirst(request));
    return;
  }
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiCacheStrategy(request));
    return;
  }
  event.respondWith(networkFirst(request));
});

async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse.clone());
      await cleanupCacheIfNeeded(DYNAMIC_CACHE);
    }
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Erreur cacheFirst:', error);
    return new Response('Offline - Contenu non disponible', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function staleWhileRevalidate(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    const fetchPromise = fetch(request)
      .then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          await cache.put(request, networkResponse.clone());
          await cleanupCacheIfNeeded(DYNAMIC_CACHE);
        }
        return networkResponse;
      })
      .catch((error) => {
        console.error('[Service Worker] Erreur fetch SWR:', error);
      });
    return cachedResponse || (await fetchPromise);
  } catch (error) {
    console.error('[Service Worker] Erreur staleWhileRevalidate:', error);
    return new Response('Offline - Contenu non disponible', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse.clone());
      await cleanupCacheIfNeeded(DYNAMIC_CACHE);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/');
      if (offlinePage) return offlinePage;
    }
    return new Response('Offline - Contenu non disponible', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function apiCacheStrategy(request) {
  try {
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      const cachedDate = cachedResponse.headers.get('date');
      if (cachedDate) {
        const cacheAge = Date.now() - new Date(cachedDate).getTime();
        if (cacheAge < 30000) return cachedResponse;
      }
    }
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('date', new Date().toUTCString());
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      await cache.put(request, modifiedResponse);
      await cleanupCacheIfNeeded(API_CACHE);
    }
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Erreur apiCacheStrategy:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

async function cleanupCache(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > CACHE_CONFIG.maxEntries) {
      const keysToDelete = keys.slice(0, keys.length - CACHE_CONFIG.maxEntries);
      await Promise.all(keysToDelete.map((key) => cache.delete(key)));
    }
  } catch (error) {
    console.error('[Service Worker] Erreur cleanupCache:', error);
  }
}

async function cleanupCacheIfNeeded(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length >= CACHE_CONFIG.maxEntries) {
      await cleanupCache(cacheName);
    }
  } catch (error) {
    console.error('[Service Worker] Erreur cleanupCacheIfNeeded:', error);
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

async function syncFavorites() {
  try {
    console.log('[Service Worker] Sync des favoris');
  } catch (error) {
    console.error('[Service Worker] Erreur sync favorites:', error);
  }
}

self.addEventListener('push', (event) => {
  let parsed = {};
  let fallbackText = 'Nouvelle mise a jour ONE-DELUX';
  if (event.data) {
    const rawText = event.data.text();
    fallbackText = rawText || fallbackText;
    try {
      parsed = JSON.parse(rawText || '{}');
    } catch (_error) {
      parsed = {};
    }
  }

  const title = String(parsed?.title || 'ONE-DELUX');
  const body = String(parsed?.body || fallbackText || 'Nouvelle mise a jour ONE-DELUX');
  const url = String(parsed?.url || '/');

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        url,
        payload: parsed || null
      },
      actions: [
        { action: 'explore', title: 'Explorer', icon: '/icon-96.png' },
        { action: 'close', title: 'Fermer', icon: '/icon-96.png' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'explore') {
    const targetUrl = event.notification?.data?.url || '/';
    event.waitUntil(clients.openWindow(targetUrl));
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(caches.open(DYNAMIC_CACHE).then((cache) => cache.addAll(event.data.urls)));
  }
});
