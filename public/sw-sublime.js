/**
 * COUP SUBLIME - Service Worker PWA
 * Cache intelligent, offline mode, background sync
 * SOLITAIRE HACK SIGNATURE
 */

const CACHE_NAME = 'sublime-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/coupon-sublime.html',
  '/coupon-sublime.css',
  '/coupon-sublime.js',
  '/coupon-sublime-three.js',
  '/coupon-sublime-social.js',
  '/coupon-sublime-ar.js',
  '/coupon-sublime-blockchain.js'
];

const API_CACHE = 'sublime-api-cache-v1';
const IMAGE_CACHE = 'sublime-image-cache-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME &&
            cacheName !== API_CACHE &&
            cacheName !== IMAGE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls - Network first, then cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images - Cache first, then network
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Static assets - Cache first
  if (STATIC_ASSETS.includes(url.pathname) ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html')) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Default - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// Cache strategies
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    return new Response('Offline - Resource not cached', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-predictions') {
    event.waitUntil(syncPredictions());
  }
});

async function syncPredictions() {
  // Sync pending predictions when back online
  const db = await openDB('sublime-db', 1);
  const pending = await db.getAll('pending');

  for (const item of pending) {
    try {
      await fetch('/api/predictions', {
        method: 'POST',
        body: JSON.stringify(item),
        headers: { 'Content-Type': 'application/json' }
      });
      await db.delete('pending', item.id);
    } catch (error) {
      console.error('[SW] Sync failed for item:', item.id);
    }
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'sublime-notification',
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('COUP SUBLIME', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.openWindow('/coupon-sublime.html')
    );
  }
});

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// IndexedDB helper
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id' });
      }
    };
  });
}
