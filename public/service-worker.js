/**
 * Service Worker - ONE-DELUX PWA
 * Cache offline et performance optimisée
 */

const CACHE_NAME = 'one-delux-v2';
const STATIC_CACHE = 'one-delux-static-v2';
const DYNAMIC_CACHE = 'one-delux-dynamic-v2';
const API_CACHE = 'one-delux-api-v2';

// Configuration du cache
const CACHE_CONFIG = {
  maxSize: 50 * 1024 * 1024, // 50MB maximum
  maxEntries: 1000, // Maximum 1000 entrées par cache
  staleWhileRevalidate: true, // Activer SWR
  cacheWarming: true, // Activer le préchauffage
  networkAware: true // Adapter selon la qualité du réseau
};

// Assets statiques à mettre en cache (priorité haute)
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

// Assets secondaires (priorité moyenne)
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

// Toutes les assets statiques
const STATIC_ASSETS = [...CRITICAL_ASSETS, ...SECONDARY_ASSETS];

// Installation du service worker avec Cache Warming
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installation en cours...');
  
  event.waitUntil(
    (async () => {
      try {
        // Cache Warming: Charger les assets critiques d'abord
        if (CACHE_CONFIG.cacheWarming) {
          console.log('[Service Worker] Cache Warming - Assets critiques');
          const cache = await caches.open(STATIC_CACHE);
          await cache.addAll(CRITICAL_ASSETS);
          console.log('[Service Worker] Assets critiques mis en cache');
          
          // Charger les assets secondaires en arrière-plan
          setTimeout(async () => {
            try {
              await cache.addAll(SECONDARY_ASSETS);
              console.log('[Service Worker] Assets secondaires mis en cache');
            } catch (error) {
              console.warn('[Service Worker] Erreur cache secondaire:', error);
            }
          }, 1000);
        } else {
          // Charger tous les assets en une fois (ancienne méthode)
          const cache = await caches.open(STATIC_CACHE);
          await cache.addAll(STATIC_ASSETS);
        }
        
        console.log('[Service Worker] Installation terminée');
        return self.skipWaiting();
      } catch (error) {
        console.error('[Service Worker] Erreur lors de l\'installation:', error);
      }
    })()
  );
});

// Activation du service worker avec Cache Size Management
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activation en cours...');
  
  event.waitUntil(
    (async () => {
      try {
        // Nettoyer les anciens caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE && 
                cacheName !== API_CACHE) {
              console.log('[Service Worker] Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
        
        // Nettoyer le cache si nécessaire (Cache Size Management)
        await cleanupCache(DYNAMIC_CACHE);
        await cleanupCache(API_CACHE);
        
        console.log('[Service Worker] Activation terminée');
        return self.clients.claim();
      } catch (error) {
        console.error('[Service Worker] Erreur lors de l\'activation:', error);
      }
    })()
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
    if (CACHE_CONFIG.staleWhileRevalidate) {
      event.respondWith(staleWhileRevalidate(request));
    } else {
      event.respondWith(cacheFirst(request));
    }
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
      await cache.put(request, networkResponse.clone());
      await cleanupCacheIfNeeded(DYNAMIC_CACHE);
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

// Stale While Revalidate - Servir du cache tout en mettant à jour
async function staleWhileRevalidate(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Servir le cache immédiatement
    const fetchPromise = fetch(request).then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        await cache.put(request, networkResponse.clone());
        await cleanupCacheIfNeeded(DYNAMIC_CACHE);
      }
      return networkResponse;
    }).catch((error) => {
      console.error('[Service Worker] Erreur fetch SWR:', error);
    });
    
    // Retourner le cache si disponible, sinon attendre le réseau
    return cachedResponse || (await fetchPromise);
  } catch (error) {
    console.error('[Service Worker] Erreur staleWhileRevalidate:', error);
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
      await cache.put(request, networkResponse.clone());
      await cleanupCacheIfNeeded(DYNAMIC_CACHE);
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

// Cache Size Management - Nettoyer le cache si nécessaire
async function cleanupCache(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > CACHE_CONFIG.maxEntries) {
      // Supprimer les entrées les plus anciennes (LRU)
      const keysToDelete = keys.slice(0, keys.length - CACHE_CONFIG.maxEntries);
      await Promise.all(keysToDelete.map(key => cache.delete(key)));
      console.log(`[Service Worker] Cache ${cacheName} nettoyé: ${keysToDelete.length} entrées supprimées`);
    }
  } catch (error) {
    console.error('[Service Worker] Erreur cleanupCache:', error);
  }
}

// Cleanup si nécessaire (vérifier la taille du cache)
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
