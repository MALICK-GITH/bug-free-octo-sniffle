// Advanced Cache Management System with Auto-Cleanup & Browser Storage
class CacheManager {
  constructor() {
    this.cacheName = 'fifapro_cache_v1';
    this.cacheVersion = '1.0.0';
    this.maxCacheSize = 50 * 1024 * 1024; // 50MB
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = 30 * 60 * 1000; // 30 minutes
    this.compressionEnabled = true;
    
    this.cacheStats = {
      hits: 0,
      misses: 0,
      size: 0,
      lastCleanup: Date.now()
    };
    
    this.init();
  }

  async init() {
    console.log('💾 Cache Manager Initializing...');
    
    try {
      // Initialize cache storage
      await this.initializeCache();
      
      // Setup auto-cleanup
      this.setupAutoCleanup();
      
      // Setup cache monitoring
      this.setupCacheMonitoring();
      
      // Load cache statistics
      await this.loadCacheStats();
      
      // Setup service worker integration
      await this.setupServiceWorkerIntegration();
      
      console.log('✅ Cache Manager Ready');
    } catch (error) {
      console.error('❌ Cache Manager initialization failed:', error);
      this.fallbackToLocalStorage();
    }
  }

  async initializeCache() {
    // Check if Cache API is available
    if ('caches' in window) {
      try {
        this.cache = await caches.open(this.cacheName);
        this.isCacheAPIAvailable = true;
        console.log('💾 Cache API available');
      } catch (error) {
        console.warn('⚠️ Cache API not available, falling back to localStorage');
        this.isCacheAPIAvailable = false;
      }
    } else {
      console.warn('⚠️ Cache API not supported, using localStorage');
      this.isCacheAPIAvailable = false;
    }
    
    // Initialize localStorage fallback
    this.initializeLocalStorage();
  }

  initializeLocalStorage() {
    // Initialize localStorage cache structure
    if (!localStorage.getItem('fifapro_cache_data')) {
      localStorage.setItem('fifapro_cache_data', JSON.stringify({}));
    }
    
    if (!localStorage.getItem('fifapro_cache_metadata')) {
      localStorage.setItem('fifapro_cache_metadata', JSON.stringify({}));
    }
    
    console.log('💾 LocalStorage cache initialized');
  }

  setupAutoCleanup() {
    // Setup periodic cleanup
    setInterval(() => {
      this.performAutoCleanup();
    }, this.cleanupInterval);
    
    // Setup cleanup on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.performAutoCleanup();
      }
    });
    
    // Setup cleanup on memory pressure
    if ('memory' in performance) {
      setInterval(() => {
        const memoryInfo = performance.memory;
        const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        
        if (memoryUsage > 0.8) {
          console.log('🧹 Memory pressure detected, performing cleanup');
          this.performAutoCleanup(true); // Aggressive cleanup
        }
      }, 10000); // Check every 10 seconds
    }
  }

  setupCacheMonitoring() {
    // Monitor cache performance
    setInterval(() => {
      this.updateCacheStats();
      this.logCachePerformance();
    }, 60000); // Update every minute
    
    // Monitor cache size
    setInterval(() => {
      this.checkCacheSize();
    }, 300000); // Check every 5 minutes
  }

  async setupServiceWorkerIntegration() {
    // Register service worker for cache management
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/cache-sw.js');
        console.log('💾 Service Worker registered for cache management');
        
        // Listen for cache updates from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'cache-update') {
            this.handleCacheUpdate(event.data);
          }
        });
      } catch (error) {
        console.warn('⚠️ Service Worker registration failed:', error);
      }
    }
  }

  // Cache operations
  async set(key, data, options = {}) {
    const {
      ttl = this.maxAge,
      priority = 'normal',
      compress = this.compressionEnabled,
      tags = []
    } = options;

    try {
      const cacheEntry = {
        data: compress ? await this.compressData(data) : data,
        timestamp: Date.now(),
        ttl: ttl,
        priority: priority,
        tags: tags,
        compressed: compress,
        size: 0,
        version: this.cacheVersion
      };

      // Calculate size
      cacheEntry.size = this.calculateDataSize(cacheEntry);

      // Store based on available API
      if (this.isCacheAPIAvailable) {
        await this.setCacheAPI(key, cacheEntry);
      } else {
        this.setLocalStorage(key, cacheEntry);
      }

      // Update statistics
      this.cacheStats.size += cacheEntry.size;
      
      console.log(`💾 Cached: ${key} (${this.formatSize(cacheEntry.size)})`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to cache ${key}:`, error);
      return false;
    }
  }

  async get(key) {
    try {
      let cacheEntry;
      
      if (this.isCacheAPIAvailable) {
        cacheEntry = await this.getCacheAPI(key);
      } else {
        cacheEntry = this.getLocalStorage(key);
      }

      if (!cacheEntry) {
        this.cacheStats.misses++;
        return null;
      }

      // Check if expired
      if (this.isExpired(cacheEntry)) {
        await this.delete(key);
        this.cacheStats.misses++;
        return null;
      }

      // Decompress if needed
      let data = cacheEntry.data;
      if (cacheEntry.compressed) {
        data = await this.decompressData(data);
      }

      this.cacheStats.hits++;
      console.log(`💾 Cache hit: ${key}`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to get ${key}:`, error);
      this.cacheStats.misses++;
      return null;
    }
  }

  async delete(key) {
    try {
      if (this.isCacheAPIAvailable) {
        await this.deleteCacheAPI(key);
      } else {
        this.deleteLocalStorage(key);
      }
      
      console.log(`🗑️ Deleted from cache: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete ${key}:`, error);
      return false;
    }
  }

  async clear() {
    try {
      if (this.isCacheAPIAvailable) {
        await this.clearCacheAPI();
      } else {
        this.clearLocalStorage();
      }
      
      // Reset statistics
      this.cacheStats = {
        hits: 0,
        misses: 0,
        size: 0,
        lastCleanup: Date.now()
      };
      
      await this.saveCacheStats();
      console.log('🧹 Cache cleared completely');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      return false;
    }
  }

  // Cache API operations
  async setCacheAPI(key, entry) {
    const request = new Request(`/cache/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.floor(entry.ttl / 1000)}`
      },
      body: JSON.stringify(entry)
    });
    
    const response = new Response(JSON.stringify(entry), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.floor(entry.ttl / 1000)}`
      }
    });
    
    await this.cache.put(request, response);
  }

  async getCacheAPI(key) {
    const request = new Request(`/cache/${key}`);
    const response = await this.cache.match(request);
    
    if (!response) return null;
    
    return await response.json();
  }

  async deleteCacheAPI(key) {
    const request = new Request(`/cache/${key}`);
    await this.cache.delete(request);
  }

  async clearCacheAPI() {
    await this.cache.delete();
    this.cache = await caches.open(this.cacheName);
  }

  // LocalStorage operations
  setLocalStorage(key, entry) {
    const cacheData = JSON.parse(localStorage.getItem('fifapro_cache_data') || '{}');
    const cacheMetadata = JSON.parse(localStorage.getItem('fifapro_cache_metadata') || '{}');
    
    cacheData[key] = entry;
    cacheMetadata[key] = {
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      size: entry.size,
      priority: entry.priority,
      tags: entry.tags
    };
    
    localStorage.setItem('fifapro_cache_data', JSON.stringify(cacheData));
    localStorage.setItem('fifapro_cache_metadata', JSON.stringify(cacheMetadata));
  }

  getLocalStorage(key) {
    const cacheData = JSON.parse(localStorage.getItem('fifapro_cache_data') || '{}');
    return cacheData[key] || null;
  }

  deleteLocalStorage(key) {
    const cacheData = JSON.parse(localStorage.getItem('fifapro_cache_data') || '{}');
    const cacheMetadata = JSON.parse(localStorage.getItem('fifapro_cache_metadata') || '{}');
    
    delete cacheData[key];
    delete cacheMetadata[key];
    
    localStorage.setItem('fifapro_cache_data', JSON.stringify(cacheData));
    localStorage.setItem('fifapro_cache_metadata', JSON.stringify(cacheMetadata));
  }

  clearLocalStorage() {
    localStorage.removeItem('fifapro_cache_data');
    localStorage.removeItem('fifapro_cache_metadata');
    localStorage.removeItem('fifapro_cache_stats');
  }

  // Compression utilities
  async compressData(data) {
    try {
      const jsonString = JSON.stringify(data);
      
      if ('CompressionStream' in window) {
        // Use CompressionStream API if available
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(new TextEncoder().encode(jsonString));
        writer.close();
        
        const chunks = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        return new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
      } else {
        // Fallback to simple compression
        return this.simpleCompress(jsonString);
      }
    } catch (error) {
      console.warn('⚠️ Compression failed, using uncompressed data:', error);
      return data;
    }
  }

  async decompressData(compressedData) {
    try {
      if (compressedData instanceof Uint8Array && 'DecompressionStream' in window) {
        // Use DecompressionStream API if available
        const stream = new DecompressionStream('gzip');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(compressedData);
        writer.close();
        
        const chunks = [];
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) chunks.push(value);
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
        return JSON.parse(new TextDecoder().decode(decompressed));
      } else {
        // Fallback to simple decompression
        return this.simpleDecompress(compressedData);
      }
    } catch (error) {
      console.warn('⚠️ Decompression failed:', error);
      return compressedData;
    }
  }

  simpleCompress(data) {
    // Simple compression for fallback
    return data.replace(/\s+/g, ' ').trim();
  }

  simpleDecompress(data) {
    // Simple decompression for fallback
    return data;
  }

  // Cache management utilities
  isExpired(entry) {
    const now = Date.now();
    return (now - entry.timestamp) > entry.ttl;
  }

  calculateDataSize(entry) {
    // Calculate size of cache entry
    const jsonString = JSON.stringify(entry);
    return new Blob([jsonString]).size;
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Auto-cleanup operations
  async performAutoCleanup(aggressive = false) {
    console.log(`🧹 Performing ${aggressive ? 'aggressive' : 'normal'} cache cleanup...`);
    
    try {
      const cleanupStartTime = Date.now();
      let deletedCount = 0;
      let freedSpace = 0;

      if (this.isCacheAPIAvailable) {
        const result = await this.cleanupCacheAPI(aggressive);
        deletedCount = result.deletedCount;
        freedSpace = result.freedSpace;
      } else {
        const result = this.cleanupLocalStorage(aggressive);
        deletedCount = result.deletedCount;
        freedSpace = result.freedSpace;
      }

      const cleanupTime = Date.now() - cleanupStartTime;
      this.cacheStats.lastCleanup = Date.now();
      
      console.log(`🧹 Cleanup completed: ${deletedCount} items deleted, ${this.formatSize(freedSpace)} freed (${cleanupTime}ms)`);
      
      // Update statistics
      await this.saveCacheStats();
      
      // Trigger cleanup event
      this.dispatchCleanupEvent(deletedCount, freedSpace, cleanupTime);
      
    } catch (error) {
      console.error('❌ Auto-cleanup failed:', error);
    }
  }

  async cleanupCacheAPI(aggressive) {
    const keys = await this.getCacheAPIKeys();
    let deletedCount = 0;
    let freedSpace = 0;

    for (const key of keys) {
      const entry = await this.getCacheAPI(key);
      if (!entry) continue;

      const shouldDelete = aggressive ? 
        this.shouldDeleteAggressive(entry) : 
        this.shouldDeleteNormal(entry);

      if (shouldDelete) {
        await this.deleteCacheAPI(key);
        deletedCount++;
        freedSpace += entry.size;
      }
    }

    return { deletedCount, freedSpace };
  }

  cleanupLocalStorage(aggressive) {
    const cacheData = JSON.parse(localStorage.getItem('fifapro_cache_data') || '{}');
    const cacheMetadata = JSON.parse(localStorage.getItem('fifapro_cache_metadata') || '{}');
    
    let deletedCount = 0;
    let freedSpace = 0;

    for (const [key, entry] of Object.entries(cacheData)) {
      const shouldDelete = aggressive ? 
        this.shouldDeleteAggressive(entry) : 
        this.shouldDeleteNormal(entry);

      if (shouldDelete) {
        delete cacheData[key];
        delete cacheMetadata[key];
        deletedCount++;
        freedSpace += entry.size;
      }
    }

    localStorage.setItem('fifapro_cache_data', JSON.stringify(cacheData));
    localStorage.setItem('fifapro_cache_metadata', JSON.stringify(cacheMetadata));

    return { deletedCount, freedSpace };
  }

  shouldDeleteNormal(entry) {
    const now = Date.now();
    
    // Delete if expired
    if (this.isExpired(entry)) return true;
    
    // Delete if older than max age
    if ((now - entry.timestamp) > this.maxAge) return true;
    
    // Delete if low priority and cache is full
    if (entry.priority === 'low' && this.cacheStats.size > this.maxCacheSize * 0.8) return true;
    
    return false;
  }

  shouldDeleteAggressive(entry) {
    const now = Date.now();
    
    // Delete all expired items
    if (this.isExpired(entry)) return true;
    
    // Delete items older than 6 hours
    if ((now - entry.timestamp) > 6 * 60 * 60 * 1000) return true;
    
    // Delete low priority items older than 2 hours
    if (entry.priority === 'low' && (now - entry.timestamp) > 2 * 60 * 60 * 1000) return true;
    
    // Delete normal priority items older than 4 hours
    if (entry.priority === 'normal' && (now - entry.timestamp) > 4 * 60 * 60 * 1000) return true;
    
    return false;
  }

  async getCacheAPIKeys() {
    const keys = [];
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    
    for (const request of requests) {
      const key = request.url.split('/cache/')[1];
      if (key) keys.push(key);
    }
    
    return keys;
  }

  // Cache statistics
  async loadCacheStats() {
    try {
      const stats = localStorage.getItem('fifapro_cache_stats');
      if (stats) {
        this.cacheStats = JSON.parse(stats);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load cache stats:', error);
    }
  }

  async saveCacheStats() {
    try {
      localStorage.setItem('fifapro_cache_stats', JSON.stringify(this.cacheStats));
    } catch (error) {
      console.warn('⚠️ Failed to save cache stats:', error);
    }
  }

  updateCacheStats() {
    // Calculate hit rate
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;
    
    // Log performance
    console.log(`📊 Cache Stats: Hits: ${this.cacheStats.hits}, Misses: ${this.cacheStats.misses}, Hit Rate: ${hitRate}%, Size: ${this.formatSize(this.cacheStats.size)}`);
  }

  logCachePerformance() {
    // Log detailed performance metrics
    const performance = {
      timestamp: Date.now(),
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100,
      size: this.cacheStats.size,
      maxSize: this.maxCacheSize,
      utilization: (this.cacheStats.size / this.maxCacheSize * 100).toFixed(2),
      lastCleanup: this.cacheStats.lastCleanup
    };
    
    console.log('📈 Cache Performance:', performance);
    
    // Send to analytics if available
    if (window.analytics) {
      window.analytics.track('cache_performance', performance);
    }
  }

  async checkCacheSize() {
    try {
      let totalSize = 0;
      
      if (this.isCacheAPIAvailable) {
        const keys = await this.getCacheAPIKeys();
        for (const key of keys) {
          const entry = await this.getCacheAPI(key);
          if (entry) totalSize += entry.size;
        }
      } else {
        const cacheMetadata = JSON.parse(localStorage.getItem('fifapro_cache_metadata') || '{}');
        for (const entry of Object.values(cacheMetadata)) {
          totalSize += entry.size || 0;
        }
      }
      
      this.cacheStats.size = totalSize;
      
      // Perform cleanup if over limit
      if (totalSize > this.maxCacheSize) {
        console.log('🧹 Cache size limit exceeded, performing cleanup');
        await this.performAutoCleanup(true);
      }
      
    } catch (error) {
      console.error('❌ Failed to check cache size:', error);
    }
  }

  // Event handling
  handleCacheUpdate(data) {
    console.log('📡 Cache update received:', data);
    
    switch (data.action) {
      case 'clear':
        this.clear();
        break;
      case 'delete':
        this.delete(data.key);
        break;
      case 'update':
        this.set(data.key, data.value, data.options);
        break;
    }
  }

  dispatchCleanupEvent(deletedCount, freedSpace, cleanupTime) {
    const event = new CustomEvent('cacheCleanup', {
      detail: {
        deletedCount,
        freedSpace,
        cleanupTime,
        timestamp: Date.now()
      }
    });
    
    document.dispatchEvent(event);
  }

  // Fallback methods
  fallbackToLocalStorage() {
    console.warn('⚠️ Falling back to localStorage only');
    this.isCacheAPIAvailable = false;
    this.initializeLocalStorage();
  }

  // Public API
  async getCacheInfo() {
    return {
      name: this.cacheName,
      version: this.cacheVersion,
      maxSize: this.maxCacheSize,
      currentSize: this.cacheStats.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100,
      lastCleanup: this.cacheStats.lastCleanup,
      isAPIAvailable: this.isCacheAPIAvailable,
      compressionEnabled: this.compressionEnabled
    };
  }

  async getCacheKeys() {
    if (this.isCacheAPIAvailable) {
      return await this.getCacheAPIKeys();
    } else {
      const cacheData = JSON.parse(localStorage.getItem('fifapro_cache_data') || '{}');
      return Object.keys(cacheData);
    }
  }

  async getCacheByTag(tag) {
    const keys = await this.getCacheKeys();
    const taggedItems = [];
    
    for (const key of keys) {
      const entry = this.isCacheAPIAvailable ? 
        await this.getCacheAPI(key) : 
        this.getLocalStorage(key);
      
      if (entry && entry.tags && entry.tags.includes(tag)) {
        taggedItems.push({ key, entry });
      }
    }
    
    return taggedItems;
  }

  async clearByTag(tag) {
    const taggedItems = await this.getCacheByTag(tag);
    let deletedCount = 0;
    
    for (const { key } of taggedItems) {
      await this.delete(key);
      deletedCount++;
    }
    
    console.log(`🧹 Cleared ${deletedCount} items with tag: ${tag}`);
    return deletedCount;
  }

  // Utility methods for specific use cases
  async cacheApiResponse(url, response, ttl = 5 * 60 * 1000) {
    const key = `api_${url}`;
    return await this.set(key, {
      url,
      data: response,
      status: response.status,
      headers: response.headers
    }, { ttl, tags: ['api', 'response'] });
  }

  async getCachedApiResponse(url) {
    const key = `api_${url}`;
    return await this.get(key);
  }

  async cacheImage(url, imageData, ttl = 24 * 60 * 60 * 1000) {
    const key = `img_${url}`;
    return await this.set(key, imageData, { ttl, tags: ['image'] });
  }

  async getCachedImage(url) {
    const key = `img_${url}`;
    return await this.get(key);
  }

  async cacheUserData(key, data, ttl = 7 * 24 * 60 * 60 * 1000) {
    return await this.set(`user_${key}`, data, { ttl, tags: ['user'] });
  }

  async getCachedUserData(key) {
    return await this.get(`user_${key}`);
  }
}

// Initialize cache manager
if (typeof window !== 'undefined') {
  window.cacheManager = new CacheManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheManager;
}
