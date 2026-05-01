// Service Worker for Advanced Cache Management
const CACHE_NAME = 'fifapro_cache_v1';
const CACHE_VERSION = '1.0.0';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Cache management
self.addEventListener('install', (event) => {
  console.log('💾 Cache Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Cache Service Worker installed');
      return cache;
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('💾 Cache Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cache Service Worker activated');
    })
  );
});

// Fetch event with cache management
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  // Handle image requests
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    event.respondWith(handleImageRequest(request));
    return;
  }
  
  // Handle static assets
  if (url.pathname.match(/\.(css|js|woff|woff2)$/i)) {
    event.respondWith(handleStaticAsset(request));
    return;
  }
  
  // Default network-first with cache fallback
  event.respondWith(networkFirstWithCache(request));
});

// API request handler
async function handleApiRequest(request) {
  const cacheKey = `api_${request.url}`;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      const responseClone = networkResponse.clone();
      
      // Add cache metadata
      const cacheResponse = new Response(responseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...Object.fromEntries(networkResponse.headers.entries()),
          'Cache-Control': `max-age=${MAX_AGE / 1000}`,
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Key': cacheKey
        }
      });
      
      await cache.put(request, cacheResponse);
      console.log(`💾 Cached API response: ${cacheKey}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`📡 Network failed for API, trying cache: ${cacheKey}`);
    
    // Fallback to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log(`💾 Serving API from cache: ${cacheKey}`);
      return cachedResponse;
    }
    
    // Return error response
    return new Response(JSON.stringify({ error: 'Network unavailable and no cached data' }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Image request handler
async function handleImageRequest(request) {
  const cacheKey = `img_${request.url}`;
  
  try {
    // Try cache first for images
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse)) {
      console.log(`💾 Serving image from cache: ${cacheKey}`);
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      
      // Cache image with longer TTL
      const cacheResponse = new Response(responseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...Object.fromEntries(networkResponse.headers.entries()),
          'Cache-Control': `max-age=${7 * 24 * 60 * 60}`, // 7 days
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Key': cacheKey
        }
      });
      
      await cache.put(request, cacheResponse);
      console.log(`💾 Cached image: ${cacheKey}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`📡 Network failed for image, trying cache: ${cacheKey}`);
    
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return placeholder image
    return new Response('Image not available', { status: 404 });
  }
}

// Static asset handler
async function handleStaticAsset(request) {
  const cacheKey = `static_${request.url}`;
  
  try {
    // Try cache first for static assets
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse)) {
      console.log(`💾 Serving static asset from cache: ${cacheKey}`);
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      
      // Cache static assets with very long TTL
      const cacheResponse = new Response(responseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...Object.fromEntries(networkResponse.headers.entries()),
          'Cache-Control': `max-age=${30 * 24 * 60 * 60}`, // 30 days
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Key': cacheKey
        }
      });
      
      await cache.put(request, cacheResponse);
      console.log(`💾 Cached static asset: ${cacheKey}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`📡 Network failed for static asset, trying cache: ${cacheKey}`);
    
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Network-first with cache fallback
async function networkFirstWithCache(request) {
  const cacheKey = `network_${request.url}`;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      const responseClone = networkResponse.clone();
      
      // Cache successful responses
      const cacheResponse = new Response(responseClone.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...Object.fromEntries(networkResponse.headers.entries()),
          'Cache-Control': `max-age=${MAX_AGE / 1000}`,
          'X-Cache-Timestamp': Date.now().toString(),
          'X-Cache-Key': cacheKey
        }
      });
      
      await cache.put(request, cacheResponse);
      return networkResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`📡 Network failed, trying cache: ${cacheKey}`);
    
    // Fallback to cache
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Utility functions
function isExpired(response) {
  const cacheTimestamp = response.headers.get('X-Cache-Timestamp');
  if (!cacheTimestamp) return false;
  
  const age = Date.now() - parseInt(cacheTimestamp);
  return age > MAX_AGE;
}

// Cache cleanup
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'cache-cleanup') {
    performCacheCleanup(event.data.aggressive);
  }
});

async function performCacheCleanup(aggressive = false) {
  console.log(`🧹 Service Worker performing ${aggressive ? 'aggressive' : 'normal'} cleanup...`);
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    let deletedCount = 0;
    let freedSpace = 0;
    
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      
      const shouldDelete = aggressive ? 
        shouldDeleteAggressive(response) : 
        shouldDeleteNormal(response);
      
      if (shouldDelete) {
        const cacheKey = response.headers.get('X-Cache-Key');
        const size = await getResponseSize(response);
        
        await cache.delete(request);
        deletedCount++;
        freedSpace += size;
        
        console.log(`🗑️ Deleted from cache: ${cacheKey}`);
      }
    }
    
    console.log(`🧹 Cleanup completed: ${deletedCount} items deleted, ${formatBytes(freedSpace)} freed`);
    
    // Notify clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'cache-update',
          action: 'cleanup',
          deletedCount,
          freedSpace,
          timestamp: Date.now()
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Cache cleanup failed:', error);
  }
}

function shouldDeleteNormal(response) {
  const cacheTimestamp = response.headers.get('X-Cache-Timestamp');
  if (!cacheTimestamp) return false;
  
  const age = Date.now() - parseInt(cacheTimestamp);
  
  // Delete if expired
  if (age > MAX_AGE) return true;
  
  // Delete if older than 6 hours for API responses
  const cacheKey = response.headers.get('X-Cache-Key');
  if (cacheKey && cacheKey.startsWith('api_') && age > 6 * 60 * 60 * 1000) return true;
  
  return false;
}

function shouldDeleteAggressive(response) {
  const cacheTimestamp = response.headers.get('X-Cache-Timestamp');
  if (!cacheTimestamp) return false;
  
  const age = Date.now() - parseInt(cacheTimestamp);
  
  // Delete all expired items
  if (age > MAX_AGE) return true;
  
  // Delete items older than 2 hours
  if (age > 2 * 60 * 60 * 1000) return true;
  
  // Delete API responses older than 1 hour
  const cacheKey = response.headers.get('X-Cache-Key');
  if (cacheKey && cacheKey.startsWith('api_') && age > 60 * 60 * 1000) return true;
  
  return false;
}

async function getResponseSize(response) {
  try {
    const clone = response.clone();
    const buffer = await clone.arrayBuffer();
    return buffer.byteLength;
  } catch (error) {
    console.warn('⚠️ Could not determine response size:', error);
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Performance monitoring
self.addEventListener('fetch', (event) => {
  const startTime = Date.now();
  
  event.waitUntil(
    event.response.then(async (response) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Log performance metrics
      console.log(`📊 Request Performance: ${event.request.url} - ${duration}ms`);
      
      // Send performance data to clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'performance-metric',
            url: event.request.url,
            duration,
            cached: response.headers.get('X-Cache-Timestamp') !== null,
            timestamp: Date.now()
          });
        });
      });
      
      return response;
    }).catch(error => {
      console.error('❌ Request failed:', error);
    })
  );
});
