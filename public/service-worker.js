/**
 * Service Worker - ONE-DELUX PWA
 * Cache offline et performance optimisée
 */

const CACHE_NAME = 'one-delux-v1';
const STATIC_CACHE = 'one-delux-static-v1';
const DYNAMIC_CACHE = 'one-delux-dynamic-v1';
const API_CACHE = 'one-delux-api-v1';

// Assets statiques à mettre en cache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/coupon.html',
  '/suivre.html',
  '/gallery.html',
  '/mode-emploi.html',
  '/updates.html',
  '/about.html',
  '/developpeur.html',
  '/styles.css',
  '/mobile.css',
  '/mobile-optimizations.css',
  '/mobile-ultra-premium.css',
  '/gallery-mobile.css',
  '/theme-system.css',
  '/global-enhancements.css',
  '/pages-luxe.css',
  '/unified-system.css',
  '/signature.css',
  '/site-embellishment.css',
  '/updates.css',
  '/site-api.js',
  '/database-api.js',
  '/gallery.js',
  '/mobile-menu.js',
  '/global-ui-shell.js',
  '/browser-sync.js',
  '/icon-192.svg',
  '/icon-512.svg',
  '/manifest.webmanifest'
];

// Installation du service worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation en cours...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Mise en cache des assets statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation terminée');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Erreur lors de l\'installation:', error);
      })
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation en cours...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[Service Worker] Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation terminée');
        return self.clients.claim();
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer les requêtes vers d'autres origines
  if (url.origin !== self.location.origin) {
    return;
  }

  // Stratégie pour les assets statiques (CSS, JS, images)
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Stratégie pour les pages HTML
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Stratégie pour les API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiCacheStrategy(request));
    return;
  }

  // Stratégie par défaut
  event.respondWith(networkFirst(request));
});

// Cache First - Priorité au cache
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Erreur cacheFirst:', error);
    return new Response('Offline - Contenu non disponible', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First - Priorité au réseau
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache...');
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback pour les pages HTML
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    return new Response('Offline - Contenu non disponible', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// API Cache Strategy - Cache court terme pour les API
async function apiCacheStrategy(request) {
  try {
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Vérifier si le cache a moins de 30 secondes
      const cachedDate = cachedResponse.headers.get('date');
      if (cachedDate) {
        const cacheAge = Date.now() - new Date(cachedDate).getTime();
        if (cacheAge < 30000) { // 30 secondes
          return cachedResponse;
        }
      }
    }

    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      // Copier la réponse et ajouter un header de date
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('date', new Date().toUTCString());
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(request, modifiedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Erreur apiCacheStrategy:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { status: 503 });
  }
}

// Background Sync pour les actions offline
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

// Sync des favoris
async function syncFavorites() {
  try {
    // Implémenter la logique de sync des favoris
    console.log('[Service Worker] Sync des favoris');
  } catch (error) {
    console.error('[Service Worker] Erreur sync favorites:', error);
  }
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification reçue');
  
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle mise à jour ONE-DELUX',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explorer',
        icon: '/icon-96.png'
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/icon-96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('ONE-DELUX', options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message reçu:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => cache.addAll(event.data.urls))
    );
  }
});
