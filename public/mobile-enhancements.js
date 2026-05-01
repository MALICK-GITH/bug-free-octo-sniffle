// Mobile Enhancements for FIFA PRO
class MobileEnhancer {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isIOS = this.detectIOS();
    this.isAndroid = this.detectAndroid();
    this.networkSpeed = 'unknown';
    this.batteryLevel = null;
    
    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  detectAndroid() {
    return /Android/.test(navigator.userAgent);
  }

  async init() {
    if (!this.isMobile) return;

    console.log('🚀 Mobile Enhancements Active', {
      isIOS: this.isIOS,
      isAndroid: this.isAndroid
    });

    // Initialize mobile features
    this.setupNetworkDetection();
    this.setupBatteryDetection();
    this.setupTouchOptimizations();
    this.setupViewportOptimizations();
    this.setupPerformanceOptimizations();
    this.setupPWAFeatures();
    this.setupPullToRefresh();
    this.setupMobileAccessibility();
  }

  setupNetworkDetection() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.networkSpeed = connection.effectiveType || 'unknown';
      
      connection.addEventListener('change', () => {
        this.networkSpeed = connection.effectiveType;
        this.adjustForNetworkSpeed();
      });

      this.adjustForNetworkSpeed();
    }
  }

  setupBatteryDetection() {
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        this.batteryLevel = battery.level;
        
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.adjustForBatteryLevel();
        });

        this.adjustForBatteryLevel();
      });
    }
  }

  setupTouchOptimizations() {
    // Prevent double-tap zoom on iOS
    if (this.isIOS) {
      let lastTouchEnd = 0;
      document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          e.preventDefault();
        }
        lastTouchEnd = now;
      }, false);
    }

    // Add touch feedback
    document.addEventListener('touchstart', (e) => {
      if (e.target.matches('.odd-box, .match-card, #refreshBtn, .coupon-page-link')) {
        e.target.style.transform = 'scale(0.98)';
      }
    });

    document.addEventListener('touchend', (e) => {
      if (e.target.matches('.odd-box, .match-card, #refreshBtn, .coupon-page-link')) {
        setTimeout(() => {
          e.target.style.transform = '';
        }, 150);
      }
    });
  }

  setupViewportOptimizations() {
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        window.scrollTo(0, 0);
        this.adjustLayoutForOrientation();
      }, 100);
    });

    // Handle virtual keyboard
    if (this.isIOS) {
      window.addEventListener('focusin', (e) => {
        if (e.target.matches('input, select, textarea')) {
          document.body.style.position = 'fixed';
        }
      });

      window.addEventListener('focusout', () => {
        document.body.style.position = '';
      });
    }
  }

  setupPerformanceOptimizations() {
    // Lazy load images
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }

    // Reduce animations on low-end devices
    if (this.isLowEndDevice()) {
      document.documentElement.style.setProperty('--animation-duration', '0.1s');
    }
  }

  setupPWAFeatures() {
    // Install prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install button after delay
      setTimeout(() => {
        this.showInstallPrompt(deferredPrompt);
      }, 5000);
    });

    // Handle app installed
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.hideInstallPrompt();
    });
  }

  setupPullToRefresh() {
    let startY = 0;
    let isPulling = false;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0 && window.scrollY === 0) {
        e.preventDefault();
        this.showPullToRefresh(diff);
      }
    });

    document.addEventListener('touchend', () => {
      if (isPulling) {
        this.hidePullToRefresh();
        if (this.shouldRefresh()) {
          this.refreshContent();
        }
        isPulling = false;
      }
    });
  }

  setupMobileAccessibility() {
    // Increase tap targets for accessibility
    document.querySelectorAll('.odd-box, .match-card').forEach(element => {
      element.style.minHeight = '44px';
      element.style.minWidth = '44px';
    });

    // Add screen reader announcements
    this.setupScreenReaderAnnouncements();
  }

  adjustForNetworkSpeed() {
    const body = document.body;
    body.classList.remove('slow-network', 'fast-network');
    
    if (this.networkSpeed === 'slow-2g' || this.networkSpeed === '2g') {
      body.classList.add('slow-network');
      this.reduceDataUsage();
    } else if (this.networkSpeed === '4g') {
      body.classList.add('fast-network');
    }
  }

  adjustForBatteryLevel() {
    if (this.batteryLevel !== null && this.batteryLevel < 0.2) {
      document.documentElement.style.setProperty('--animation-duration', '0s');
      document.body.classList.add('low-battery');
    }
  }

  adjustLayoutForOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight;
    document.body.classList.toggle('landscape', isLandscape);
    document.body.classList.toggle('portrait', !isLandscape);
  }

  isLowEndDevice() {
    const memory = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency;
    
    return (memory && memory < 4) || (cores && cores < 4);
  }

  reduceDataUsage() {
    // Disable animations
    document.body.style.setProperty('--animation-duration', '0s');
    
    // Reduce image quality
    document.querySelectorAll('img').forEach(img => {
      if (img.src.includes('?')) {
        img.src = img.src.replace(/quality=\d+/, 'quality=50');
      }
    });
  }

  showPullToRefresh(distance) {
    let indicator = document.querySelector('.pull-to-refresh');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-to-refresh';
      indicator.textContent = 'Relâcher pour actualiser';
      document.body.appendChild(indicator);
    }
    
    if (distance > 100) {
      indicator.textContent = 'Relâcher pour actualiser';
      indicator.classList.add('visible');
    }
  }

  hidePullToRefresh() {
    const indicator = document.querySelector('.pull-to-refresh');
    if (indicator) {
      indicator.classList.remove('visible');
    }
  }

  shouldRefresh() {
    const indicator = document.querySelector('.pull-to-refresh');
    return indicator && indicator.classList.contains('visible');
  }

  refreshContent() {
    // Trigger refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.click();
    }
  }

  showInstallPrompt(deferredPrompt) {
    if (document.querySelector('.global-bottom-nav')) return;
    if (document.querySelector('.install-banner')) return;

    // Create install banner
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-banner-content">
        <span>📱 Installez SOLITFIFPRO225</span>
        <button id="installBtn">Installer</button>
        <button id="dismissBtn">Plus tard</button>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    document.getElementById('installBtn').addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        this.hideInstallPrompt();
      });
    });
    
    document.getElementById('dismissBtn').addEventListener('click', () => {
      this.hideInstallPrompt();
    });
  }

  hideInstallPrompt() {
    const banner = document.querySelector('.install-banner');
    if (banner) {
      banner.remove();
    }
  }

  setupScreenReaderAnnouncements() {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'sr-only';
    document.body.appendChild(announcer);
    
    this.announcer = announcer;
  }

  announce(message) {
    if (this.announcer) {
      this.announcer.textContent = message;
      setTimeout(() => {
        this.announcer.textContent = '';
      }, 1000);
    }
  }
}

// Initialize mobile enhancements
if (typeof window !== 'undefined') {
  window.mobileEnhancer = new MobileEnhancer();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileEnhancer;
}
