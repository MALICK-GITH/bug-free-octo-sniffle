// Cache Control Panel UI
class CacheControlPanel {
  constructor() {
    this.isVisible = true;
    this.isMinimized = false;
    this.cacheManager = null;
    this.updateInterval = null;
    
    this.init();
  }

  async init() {
    console.log('🎛️ Cache Control Panel Initializing...');
    
    // Wait for cache manager
    await this.waitForCacheManager();
    
    // Create UI
    this.createCachePanel();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start real-time updates
    this.startRealTimeUpdates();
    
    console.log('✅ Cache Control Panel Ready');
  }

  async waitForCacheManager() {
    const maxWaitTime = 5000;
    const startTime = Date.now();
    
    while (!window.cacheManager && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (window.cacheManager) {
      this.cacheManager = window.cacheManager;
    } else {
      console.warn('⚠️ Cache Manager not available');
    }
  }

  createCachePanel() {
    // Create main container
    const panel = document.createElement('div');
    panel.className = 'cache-manager-container';
    panel.innerHTML = `
      <div class="cache-manager-header">
        <div class="cache-manager-title">Cache Manager</div>
        <div class="cache-manager-controls">
          <button class="cache-control-btn" id="minimizeCacheBtn" title="Minimize">－</button>
          <button class="cache-control-btn" id="closeCacheBtn" title="Close">✕</button>
        </div>
      </div>
      
      <div class="cache-stats-display">
        <div class="cache-stat-item">
          <span class="cache-stat-label">Cache Hits</span>
          <span class="cache-stat-value" id="cacheHits">0</span>
        </div>
        <div class="cache-stat-item">
          <span class="cache-stat-label">Cache Misses</span>
          <span class="cache-stat-value" id="cacheMisses">0</span>
        </div>
        <div class="cache-stat-item">
          <span class="cache-stat-label">Hit Rate</span>
          <span class="cache-stat-value" id="hitRate">0%</span>
        </div>
        <div class="cache-stat-item">
          <span class="cache-stat-label">Cache Size</span>
          <span class="cache-stat-value" id="cacheSize">0 MB</span>
        </div>
      </div>
      
      <div class="cache-size-visualization">
        <div class="cache-size-bar">
          <div class="cache-size-fill" id="cacheSizeFill"></div>
        </div>
        <div class="cache-size-text">
          <span>Used: <span class="cache-size-percentage" id="cacheSizePercentage">0%</span></span>
          <span>Total: <span id="cacheTotalSize">50 MB</span></span>
        </div>
      </div>
      
      <div class="cache-status-indicators">
        <div class="cache-status-indicator" id="cacheApiStatus">
          <span class="cache-status-dot"></span>
          <span>Cache API</span>
        </div>
        <div class="cache-status-indicator" id="compressionStatus">
          <span class="cache-status-dot"></span>
          <span>Compression</span>
        </div>
        <div class="cache-status-indicator" id="serviceWorkerStatus">
          <span class="cache-status-dot"></span>
          <span>Service Worker</span>
        </div>
      </div>
      
      <div class="cache-actions">
        <button class="cache-action-btn" id="refreshCacheBtn">
          🔄 Refresh Cache
        </button>
        <button class="cache-action-btn" id="cleanupCacheBtn">
          🧹 Auto Cleanup
        </button>
        <button class="cache-action-btn" id="aggressiveCleanupBtn">
          ⚡ Aggressive Cleanup
        </button>
        <button class="cache-action-btn danger" id="clearCacheBtn">
          🗑️ Clear All Cache
        </button>
      </div>
      
      <div class="cache-progress-container" id="cacheProgressContainer" style="display: none;">
        <div class="cache-progress-bar">
          <div class="cache-progress-fill" id="cacheProgressFill"></div>
        </div>
        <div class="cache-progress-text" id="cacheProgressText">Processing...</div>
      </div>
      
      <div class="cache-details" id="cacheDetails">
        <div class="cache-detail-item">
          <span class="cache-detail-key">Cache Name:</span>
          <span class="cache-detail-value" id="cacheName">-</span>
        </div>
        <div class="cache-detail-item">
          <span class="cache-detail-key">Cache Version:</span>
          <span class="cache-detail-value" id="cacheVersion">-</span>
        </div>
        <div class="cache-detail-item">
          <span class="cache-detail-key">Max Size:</span>
          <span class="cache-detail-value" id="maxCacheSize">-</span>
        </div>
        <div class="cache-detail-item">
          <span class="cache-detail-key">Last Cleanup:</span>
          <span class="cache-detail-value" id="lastCleanup">-</span>
        </div>
        <div class="cache-detail-item">
          <span class="cache-detail-key">API Available:</span>
          <span class="cache-detail-value" id="apiAvailable">-</span>
        </div>
      </div>
    `;

    // Add to page
    document.body.appendChild(panel);
    
    // Store references
    this.panel = panel;
    this.elements = {
      hits: document.getElementById('cacheHits'),
      misses: document.getElementById('cacheMisses'),
      hitRate: document.getElementById('hitRate'),
      size: document.getElementById('cacheSize'),
      sizeFill: document.getElementById('cacheSizeFill'),
      sizePercentage: document.getElementById('cacheSizePercentage'),
      totalSize: document.getElementById('cacheTotalSize'),
      apiStatus: document.getElementById('cacheApiStatus'),
      compressionStatus: document.getElementById('compressionStatus'),
      serviceWorkerStatus: document.getElementById('serviceWorkerStatus'),
      progressContainer: document.getElementById('cacheProgressContainer'),
      progressFill: document.getElementById('cacheProgressFill'),
      progressText: document.getElementById('cacheProgressText'),
      cacheName: document.getElementById('cacheName'),
      cacheVersion: document.getElementById('cacheVersion'),
      maxCacheSize: document.getElementById('maxCacheSize'),
      lastCleanup: document.getElementById('lastCleanup'),
      apiAvailable: document.getElementById('apiAvailable')
    };
  }

  setupEventListeners() {
    // Minimize button
    const minimizeBtn = document.getElementById('minimizeCacheBtn');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        this.toggleMinimize();
      });
    }

    // Close button
    const closeBtn = document.getElementById('closeCacheBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hide();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshCacheBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshCache();
      });
    }

    // Cleanup button
    const cleanupBtn = document.getElementById('cleanupCacheBtn');
    if (cleanupBtn) {
      cleanupBtn.addEventListener('click', () => {
        this.performCleanup(false);
      });
    }

    // Aggressive cleanup button
    const aggressiveBtn = document.getElementById('aggressiveCleanupBtn');
    if (aggressiveBtn) {
      aggressiveBtn.addEventListener('click', () => {
        this.performCleanup(true);
      });
    }

    // Clear cache button
    const clearBtn = document.getElementById('clearCacheBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearCache();
      });
    }

    // Listen for cache events
    document.addEventListener('cacheCleanup', (event) => {
      this.onCacheCleanup(event.detail);
    });

    // Listen for storage events
    window.addEventListener('storage', (event) => {
      if (event.key === 'fifapro_cache_stats') {
        this.updateStats();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'h':
            event.preventDefault();
            this.toggleVisibility();
            break;
          case 'm':
            event.preventDefault();
            this.toggleMinimize();
            break;
          case 'r':
            event.preventDefault();
            this.refreshCache();
            break;
        }
      }
    });
  }

  startRealTimeUpdates() {
    // Update stats every 5 seconds
    this.updateInterval = setInterval(() => {
      this.updateStats();
    }, 5000);
  }

  async updateStats() {
    if (!this.cacheManager) return;

    try {
      const info = await this.cacheManager.getCacheInfo();
      
      // Update basic stats
      if (this.elements.hits) {
        this.elements.hits.textContent = info.hits || 0;
      }
      
      if (this.elements.misses) {
        this.elements.misses.textContent = info.misses || 0;
      }
      
      if (this.elements.hitRate) {
        this.elements.hitRate.textContent = `${info.hitRate || 0}%`;
      }
      
      if (this.elements.size) {
        this.elements.size.textContent = this.formatSize(info.currentSize || 0);
      }
      
      // Update size visualization
      this.updateSizeVisualization(info);
      
      // Update status indicators
      this.updateStatusIndicators(info);
      
      // Update details
      this.updateDetails(info);
      
    } catch (error) {
      console.warn('⚠️ Failed to update cache stats:', error);
    }
  }

  updateSizeVisualization(info) {
    if (!this.elements.sizeFill || !this.elements.sizePercentage) return;
    
    const percentage = Math.max(0, Math.min(100, (info.currentSize / info.maxSize) * 100));
    
    // Update fill bar
    this.elements.sizeFill.style.width = `${percentage}%`;
    
    // Update color based on percentage
    this.elements.sizeFill.className = 'cache-size-fill';
    if (percentage >= 90) {
      this.elements.sizeFill.classList.add('error');
    } else if (percentage >= 75) {
      this.elements.sizeFill.classList.add('warning');
    }
    
    // Update percentage text
    this.elements.sizePercentage.textContent = `${Math.round(percentage)}%`;
    
    // Update total size
    if (this.elements.totalSize) {
      this.elements.totalSize.textContent = this.formatSize(info.maxSize);
    }
    
    // Update size value color
    if (this.elements.size) {
      this.elements.size.className = 'cache-stat-value';
      if (percentage >= 90) {
        this.elements.size.classList.add('error');
      } else if (percentage >= 75) {
        this.elements.size.classList.add('warning');
      }
    }
  }

  updateStatusIndicators(info) {
    // Cache API status
    if (this.elements.apiStatus) {
      this.elements.apiStatus.className = 'cache-status-indicator active';
      if (info.isAPIAvailable) {
        this.elements.apiStatus.querySelector('.cache-status-dot').classList.add('active');
      }
    }
    
    // Compression status
    if (this.elements.compressionStatus) {
      this.elements.compressionStatus.className = 'cache-status-indicator active';
      if (info.compressionEnabled) {
        this.elements.compressionStatus.querySelector('.cache-status-dot').classList.add('active');
      }
    }
    
    // Service Worker status
    if (this.elements.serviceWorkerStatus) {
      this.elements.serviceWorkerStatus.className = 'cache-status-indicator';
      if ('serviceWorker' in navigator) {
        this.elements.serviceWorkerStatus.classList.add('active');
        this.elements.serviceWorkerStatus.querySelector('.cache-status-dot').classList.add('active');
      }
    }
  }

  updateDetails(info) {
    if (this.elements.cacheName) {
      this.elements.cacheName.textContent = info.name || '-';
    }
    
    if (this.elements.cacheVersion) {
      this.elements.cacheVersion.textContent = info.version || '-';
    }
    
    if (this.elements.maxCacheSize) {
      this.elements.maxCacheSize.textContent = this.formatSize(info.maxSize || 0);
    }
    
    if (this.elements.lastCleanup) {
      const lastCleanup = info.lastCleanup ? new Date(info.lastCleanup).toLocaleString() : '-';
      this.elements.lastCleanup.textContent = lastCleanup;
    }
    
    if (this.elements.apiAvailable) {
      this.elements.apiAvailable.textContent = info.isAPIAvailable ? 'Yes' : 'No';
    }
  }

  async refreshCache() {
    if (!this.cacheManager) return;
    
    this.showProgress('Refreshing cache...');
    
    try {
      // Force refresh of cache info
      await this.cacheManager.loadCacheStats();
      await this.updateStats();
      
      this.hideProgress();
      this.showNotification('Cache refreshed successfully', 'success');
      
    } catch (error) {
      this.hideProgress();
      this.showNotification('Failed to refresh cache', 'error');
      console.error('❌ Cache refresh failed:', error);
    }
  }

  async performCleanup(aggressive = false) {
    if (!this.cacheManager) return;
    
    const action = aggressive ? 'Aggressive cleanup' : 'Auto cleanup';
    this.showProgress(`${action} in progress...`);
    
    try {
      await this.cacheManager.performAutoCleanup(aggressive);
      await this.updateStats();
      
      this.hideProgress();
      this.showNotification(`${action} completed`, 'success');
      
    } catch (error) {
      this.hideProgress();
      this.showNotification(`Cleanup failed: ${error.message}`, 'error');
      console.error('❌ Cleanup failed:', error);
    }
  }

  async clearCache() {
    if (!this.cacheManager) return;
    
    if (!confirm('Are you sure you want to clear all cache? This action cannot be undone.')) {
      return;
    }
    
    this.showProgress('Clearing cache...');
    
    try {
      await this.cacheManager.clear();
      await this.updateStats();
      
      this.hideProgress();
      this.showNotification('Cache cleared successfully', 'success');
      
    } catch (error) {
      this.hideProgress();
      this.showNotification(`Failed to clear cache: ${error.message}`, 'error');
      console.error('❌ Cache clear failed:', error);
    }
  }

  showProgress(text) {
    if (this.elements.progressContainer && this.elements.progressText) {
      this.elements.progressContainer.style.display = 'block';
      this.elements.progressText.textContent = text;
      
      // Animate progress bar
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 90) {
          progress = 90;
          clearInterval(progressInterval);
        }
        
        if (this.elements.progressFill) {
          this.elements.progressFill.style.width = `${progress}%`;
        }
      }, 200);
      
      // Store interval ID for cleanup
      this.progressInterval = progressInterval;
    }
  }

  hideProgress() {
    if (this.elements.progressContainer) {
      this.elements.progressContainer.style.display = 'none';
    }
    
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    
    if (this.elements.progressFill) {
      this.elements.progressFill.style.width = '0%';
    }
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `cache-notification cache-notification-${type}`;
    notification.innerHTML = `
      <div class="cache-notification-content">
        <span class="cache-notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="cache-notification-text">${message}</span>
        <button class="cache-notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? 'linear-gradient(145deg, rgba(66, 245, 108, 0.95), rgba(66, 245, 108, 0.98))' : 
                    type === 'error' ? 'linear-gradient(145deg, rgba(255, 95, 121, 0.95), rgba(255, 95, 121, 0.98))' : 
                    'linear-gradient(145deg, rgba(59, 231, 255, 0.95), rgba(59, 231, 255, 0.98))'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 10001;
      font-size: 0.9rem;
      font-weight: 600;
      max-width: 400px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  toggleVisibility() {
    this.isVisible = !this.isVisible;
    
    if (this.isVisible) {
      this.panel.classList.remove('hidden');
    } else {
      this.panel.classList.add('hidden');
    }
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    
    if (this.isMinimized) {
      this.panel.classList.add('minimized');
      if (this.elements.minimizeCacheBtn) {
        this.elements.minimizeCacheBtn.textContent = '□';
        this.elements.minimizeCacheBtn.title = 'Maximize';
      }
    } else {
      this.panel.classList.remove('minimized');
      if (this.elements.minimizeCacheBtn) {
        this.elements.minimizeCacheBtn.textContent = '－';
        this.elements.minimizeCacheBtn.title = 'Minimize';
      }
    }
  }

  hide() {
    this.isVisible = false;
    this.panel.classList.add('hidden');
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onCacheCleanup(detail) {
    // Handle cleanup events from cache manager
    console.log('🧹 Cache cleanup event received:', detail);
    this.updateStats();
  }

  // Public API
  show() {
    this.isVisible = true;
    this.panel.classList.remove('hidden');
  }

  destroy() {
    // Clean up
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.panel && this.panel.parentElement) {
      this.panel.remove();
    }
  }
}

// Initialize cache control panel when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.cacheControlPanel = new CacheControlPanel();
    });
  } else {
    window.cacheControlPanel = new CacheControlPanel();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CacheControlPanel;
}
