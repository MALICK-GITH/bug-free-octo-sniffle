// Mobile Complete Optimization - iOS & Android Perfect Display
class MobileCompleteOptimizer {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isIOS = this.detectIOS();
    this.isAndroid = this.detectAndroid();
    this.isStandalone = this.detectStandalone();
    this.orientation = this.getOrientation();
    
    this.init();
  }

  init() {
    console.log('📱 Initializing Mobile Complete Optimizer...');
    console.log(`Device: ${this.isIOS ? 'iOS' : this.isAndroid ? 'Android' : 'Desktop'}`);
    console.log(`Standalone: ${this.isStandalone}`);
    console.log(`Orientation: ${this.orientation}`);

    this.setupViewport();
    this.setupSafeAreas();
    this.setupTouchOptimizations();
    this.setupOrientationHandling();
    this.setupPullToRefresh();
    this.setupMobileNavigation();
    this.setupInputOptimizations();
    this.setupPerformanceOptimizations();
    this.setupAccessibility();
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

  detectStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
  }

  getOrientation() {
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  }

  setupViewport() {
    // Enhanced viewport for mobile
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      if (this.isIOS) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0, user-scalable=yes, shrink-to-fit=no'
        );
      } else if (this.isAndroid) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0, user-scalable=yes'
        );
      }
    }

    // Add mobile-specific meta tags
    this.addMobileMetaTags();
  }

  addMobileMetaTags() {
    const head = document.head;

    // iOS specific meta tags
    if (this.isIOS) {
      this.addMetaTag('apple-mobile-web-app-capable', 'yes');
      this.addMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent');
      this.addMetaTag('apple-mobile-web-app-title', 'FIFA PRO');
      this.addMetaTag('format-detection', 'telephone=no');
    }

    // Android specific meta tags
    if (this.isAndroid) {
      this.addMetaTag('mobile-web-app-capable', 'yes');
      this.addMetaTag('application-name', 'FIFA PRO');
      this.addMetaTag('theme-color', '#0a1628');
    }

    // Universal mobile meta tags
    this.addMetaTag('HandheldFriendly', 'true');
    this.addMetaTag('MobileOptimized', 'width');
  }

  addMetaTag(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
  }

  setupSafeAreas() {
    // iOS Safe Area Support
    if (this.isIOS) {
      document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
      document.documentElement.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
      document.documentElement.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');
      document.documentElement.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');

      // Apply safe area padding to main elements
      this.applySafeAreaPadding();
    }
  }

  applySafeAreaPadding() {
    const elements = [
      '.page',
      '.mobile-header',
      '.mobile-controls',
      '.hero',
      '.controls',
      '.results'
    ];

    elements.forEach(selector => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.paddingTop = `max(1rem, env(safe-area-inset-top))`;
        element.style.paddingBottom = `max(1rem, env(safe-area-inset-bottom))`;
        element.style.paddingLeft = `max(1rem, env(safe-area-inset-left))`;
        element.style.paddingRight = `max(1rem, env(safe-area-inset-right))`;
      }
    });
  }

  setupTouchOptimizations() {
    // Touch event optimizations
    document.addEventListener('touchstart', function() {}, { passive: true });
    document.addEventListener('touchmove', function() {}, { passive: true });

    // Prevent double-tap zoom on iOS
    if (this.isIOS) {
      let lastTouchEnd = 0;
      document.addEventListener('touchend', function(event) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
          event.preventDefault();
        }
        lastTouchEnd = now;
      }, false);
    }

    // Add touch feedback
    this.addTouchFeedback();
  }

  addTouchFeedback() {
    const touchElements = document.querySelectorAll(
      '.btn-generate, .btn-export, .btn-refresh, .odd-box, .filter-btn, .chat-send, .match-card'
    );

    touchElements.forEach(element => {
      element.addEventListener('touchstart', () => {
        element.style.transform = 'scale(0.95)';
        element.style.transition = 'transform 0.1s ease';
      });

      element.addEventListener('touchend', () => {
        element.style.transform = 'scale(1)';
      });
    });
  }

  setupOrientationHandling() {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.orientation = this.getOrientation();
        this.handleOrientationChange();
      }, 100);
    });

    window.addEventListener('resize', () => {
      const newOrientation = this.getOrientation();
      if (newOrientation !== this.orientation) {
        this.orientation = newOrientation;
        this.handleOrientationChange();
      }
    });
  }

  handleOrientationChange() {
    console.log(`🔄 Orientation changed to: ${this.orientation}`);

    // Adjust layout for landscape
    if (this.orientation === 'landscape') {
      document.body.classList.add('landscape-orientation');
      
      // Reduce header height in landscape
      const hero = document.querySelector('.hero');
      if (hero) {
        hero.style.padding = '1rem';
      }

      // Adjust chat height
      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        chatMessages.style.maxHeight = '200px';
      }
    } else {
      document.body.classList.remove('landscape-orientation');
      
      // Restore portrait layout
      const hero = document.querySelector('.hero');
      if (hero) {
        hero.style.padding = '2rem 1rem 1.5rem';
      }

      const chatMessages = document.querySelector('.chat-messages');
      if (chatMessages) {
        chatMessages.style.maxHeight = '300px';
      }
    }
  }

  setupPullToRefresh() {
    let startY = 0;
    let isPulling = false;
    const pullThreshold = 80;

    const page = document.querySelector('.page');
    if (!page) return;

    page.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    });

    page.addEventListener('touchmove', (e) => {
      if (!isPulling) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && window.scrollY === 0) {
        e.preventDefault();
        
        if (diff > pullThreshold) {
          page.classList.add('pulling');
        }

        // Visual feedback
        const indicator = document.querySelector('.pull-to-refresh-indicator');
        if (indicator) {
          indicator.style.transform = `translateX(-50%) translateY(${Math.min(diff - 20, 40)}px)`;
        }
      }
    });

    page.addEventListener('touchend', () => {
      if (!isPulling) return;
      isPulling = false;

      const indicator = document.querySelector('.pull-to-refresh-indicator');
      if (indicator) {
        indicator.style.transform = 'translateX(-50%) translateY(0)';
      }

      if (page.classList.contains('pulling')) {
        page.classList.remove('pulling');
        this.performRefresh();
      }
    });
  }

  performRefresh() {
    console.log('🔄 Performing pull-to-refresh...');
    
    // Show loading state
    this.showMobileNotification('Actualisation en cours...', 'info');

    // Refresh the page or data
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  setupMobileNavigation() {
    // Create mobile navigation if it doesn't exist
    if (!document.querySelector('.mobile-nav')) {
      this.createMobileNavigation();
    }

    // Hide desktop navigation on mobile
    const desktopNav = document.querySelectorAll('.back');
    desktopNav.forEach(link => {
      link.style.display = 'none';
    });
  }

  createMobileNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'mobile-nav';
    nav.innerHTML = `
      <a href="/" class="active">Matchs</a>
      <a href="/coupon.html">Coupon</a>
      <a href="/mode-emploi.html">Guide</a>
      <a href="/about.html">À propos</a>
    `;

    const hero = document.querySelector('.hero');
    if (hero) {
      hero.parentNode.insertBefore(nav, hero.nextSibling);
    }

    // Add active state handling
    nav.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        nav.querySelectorAll('a').forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');
      }
    });
  }

  setupInputOptimizations() {
    // Prevent iOS zoom on input focus
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        if (this.isIOS) {
          input.style.fontSize = '16px';
        }
      });

      input.addEventListener('blur', () => {
        if (this.isIOS) {
          input.style.fontSize = '';
        }
      });
    });

    // Add input type optimizations
    this.optimizeInputTypes();
  }

  optimizeInputTypes() {
    // Number inputs with better mobile experience
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('pattern', '[0-9]*');
    });

    // Add keyboard navigation
    this.setupKeyboardNavigation();
  }

  setupKeyboardNavigation() {
    const focusableElements = document.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    focusableElements.forEach((element, index) => {
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          // Handle tab navigation
          const nextIndex = e.shiftKey ? index - 1 : index + 1;
          const nextElement = focusableElements[nextIndex];
          
          if (nextElement) {
            e.preventDefault();
            nextElement.focus();
          }
        }
      });
    });
  }

  setupPerformanceOptimizations() {
    // Hardware acceleration
    const elements = document.querySelectorAll(
      '.match-card, .odd-box, .hero, .controls, .results'
    );
    
    elements.forEach(element => {
      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'transform';
    });

    // Lazy loading for images
    this.setupLazyLoading();

    // Optimize animations
    this.optimizeAnimations();
  }

  setupLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));
    }
  }

  optimizeAnimations() {
    // Reduce motion for better performance
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  setupAccessibility() {
    // Add ARIA labels
    this.addARIALabels();

    // Focus management
    this.setupFocusManagement();

    // Screen reader optimizations
    this.setupScreenReaderOptimizations();
  }

  addARIALabels() {
    // Add ARIA labels to interactive elements
    const elements = [
      { selector: '.btn-generate', label: 'Générer un coupon' },
      { selector: '.btn-export', label: 'Exporter le coupon' },
      { selector: '.btn-refresh', label: 'Actualiser les données' },
      { selector: '.chat-input', label: 'Message pour l\'IA' },
      { selector: '.chat-send', label: 'Envoyer le message' }
    ];

    elements.forEach(({ selector, label }) => {
      const element = document.querySelector(selector);
      if (element && !element.getAttribute('aria-label')) {
        element.setAttribute('aria-label', label);
      }
    });
  }

  setupFocusManagement() {
    // Add focus visible styles
    const style = document.createElement('style');
    style.textContent = `
      .btn-generate:focus-visible,
      .btn-export:focus-visible,
      .btn-refresh:focus-visible,
      .odd-box:focus-visible,
      .filter-btn:focus-visible,
      .chat-send:focus-visible {
        outline: 2px solid #3be7ff;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  setupScreenReaderOptimizations() {
    // Add live regions for dynamic content
    const results = document.querySelector('.results');
    if (results) {
      results.setAttribute('aria-live', 'polite');
      results.setAttribute('aria-atomic', 'true');
    }

    const chatMessages = document.querySelector('.chat-messages');
    if (chatMessages) {
      chatMessages.setAttribute('aria-live', 'polite');
      chatMessages.setAttribute('aria-atomic', 'false');
    }
  }

  showMobileNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'mobile-notification';
    notification.textContent = message;

    if (type === 'error') {
      notification.style.background = 'linear-gradient(135deg, rgba(255, 95, 121, 0.9), rgba(255, 95, 121, 0.9))';
    } else if (type === 'info') {
      notification.style.background = 'linear-gradient(135deg, rgba(59, 231, 255, 0.9), rgba(59, 231, 255, 0.9))';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Public API methods
  isMobileDevice() {
    return this.isMobile;
  }

  getDeviceInfo() {
    return {
      isMobile: this.isMobile,
      isIOS: this.isIOS,
      isAndroid: this.isAndroid,
      isStandalone: this.isStandalone,
      orientation: this.orientation,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    };
  }

  optimizeForDevice() {
    if (this.isIOS) {
      this.optimizeForIOS();
    } else if (this.isAndroid) {
      this.optimizeForAndroid();
    }
  }

  optimizeForIOS() {
    // iOS specific optimizations
    document.body.classList.add('ios-device');
    
    // Prevent rubber band effect
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.bottom = '0';
    document.body.style.overflow = 'auto';
    document.body.style.webkitOverflowScrolling = 'touch';
  }

  optimizeForAndroid() {
    // Android specific optimizations
    document.body.classList.add('android-device');
    
    // Optimize scrollbar
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar {
        width: 4px;
      }
      ::-webkit-scrollbar-track {
        background: rgba(59, 231, 255, 0.1);
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(59, 231, 255, 0.3);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  destroy() {
    // Cleanup event listeners and optimizations
    document.removeEventListener('touchstart', () => {});
    document.removeEventListener('touchmove', () => {});
    window.removeEventListener('orientationchange', () => {});
    window.removeEventListener('resize', () => {});
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.mobileOptimizer = new MobileCompleteOptimizer();
    });
  } else {
    window.mobileOptimizer = new MobileCompleteOptimizer();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileCompleteOptimizer;
}
