/**
 * SOLITFIFPRO225 - Global Service Worker
 * Phase 2: Offline support, cache intelligent pour tout le site
 * SOLITAIRE HACK SIGNATURE
 */

const CACHE_NAME = 'sfc25-global-v3';
const STATIC_CACHE = 'sfc25-static-v3';
const IMAGE_CACHE = 'sfc25-images-v1';
const API_CACHE = 'sfc25-api-v1';

// Ressources critiques à précharger
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/coupon.html',
  '/coupon-sublime.html',
  '/match.html',
  '/about.html',
  '/developpeur.html',
  '/auth.html',
  '/auth.css',
  '/auth.js',
  '/mode-emploi.html',
  '/styles.css',
  '/global-enhancements.css',
  '/global-ui-shell.js',
  '/mobile.css',
  '/signature.css',
  '/app.js',
  '/web-vitals.js',
  '/manifest.webmanifest',
  '/icon-192.svg',
  '/icon-512.svg'
];

// Installation: Précache les ressources critiques
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Pre-caching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Pre-cache failed:', err))
  );
});

// Activation: Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          const expectedCaches = [STATIC_CACHE, IMAGE_CACHE, API_CACHE, CACHE_NAME];
          if (!expectedCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Stratégies de cache
const CacheStrategies = {
  // Cache First: Pour les ressources statiques
  async cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    try {
      const networkResponse = await fetch(request);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    } catch (error) {
      console.error('[SW] Cache first failed:', error);
      throw error;
    }
  },

  // Network First: Pour les données API
  async networkFirst(request, cacheName, timeout = 5000) {
    const cache = await caches.open(cacheName);

    try {
      const networkResponse = await Promise.race([
        fetch(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);

      cache.put(request, networkResponse.clone());
      return networkResponse;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) {
        console.log('[SW] Serving from cache (offline)');
        return cached;
      }
      throw error;
    }
  },

  // Stale While Revalidate: Pour les données qui peuvent être légèrement obsolètes
  async staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const networkPromise = fetch(request).then(response => {
      cache.put(request, response.clone());
      return response;
    }).catch(err => {
      console.warn('[SW] Network fetch failed:', err);
      return null;
    });

    return cached || networkPromise;
  },

  // Network Only: Pour les données toujours fraîches
  async networkOnly(request) {
    return fetch(request);
  }
};

// Gestion des requêtes fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Strategy routing
  let strategy = null;

  // API calls (The Odds API, SportsDB)
  if (url.hostname.includes('the-odds-api.com') ||
    url.hostname.includes('thesportsdb.com')) {
    strategy = () => CacheStrategies.networkFirst(request, API_CACHE, 3000);
  }
  // Static assets (JS, CSS)
  else if (url.pathname.match(/\.(js|css)$/)) {
    strategy = () => CacheStrategies.cacheFirst(request, STATIC_CACHE);
  }
  // Images
  else if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/)) {
    strategy = () => CacheStrategies.cacheFirst(request, IMAGE_CACHE);
  }
  // HTML pages
  else if (url.pathname.match(/\.(html|htm)$/) || url.pathname === '/') {
    strategy = () => CacheStrategies.staleWhileRevalidate(request, STATIC_CACHE);
  }
  // Fonts
  else if (url.pathname.match(/\.(woff|woff2|ttf|otf|eot)$/)) {
    strategy = () => CacheStrategies.cacheFirst(request, STATIC_CACHE);
  }

  if (strategy) {
    event.respondWith(strategy());
  }
});

// Background Sync pour les actions en attente
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  } else if (event.tag === 'sync-coupons') {
    event.waitUntil(syncCoupons());
  }
});

async function syncFavorites() {
  // Synchroniser les favoris stockés localement
  console.log('[SW] Syncing favorites...');
}

async function syncCoupons() {
  // Synchroniser les coupons en attente
  console.log('[SW] Syncing coupons...');
}

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nouvelle notification',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: 'sfc25-notification',
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'close', title: 'Fermer' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('SOLITFIFPRO225', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.openWindow('/')
    );
  }
});

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});
