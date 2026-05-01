// Mobile Ultra Interactions - Exceptional Experience for iPhone & All Mobile
class MobileUltraInteractions {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isIOS = this.detectIOS();
    this.isAndroid = this.detectAndroid();
    this.isIPhone = this.detectIPhone();
    this.touchSupport = 'ontouchstart' in window;
    this.hapticSupport = 'vibrate' in navigator;
    
    this.interactions = {
      tapFeedback: true,
      hapticFeedback: true,
      gestureSupport: true,
      swipeNavigation: true,
      pullToRefresh: true,
      pinchToZoom: true,
      doubleTap: true,
      longPress: true
    };

    this.init();
  }

  init() {
    console.log('📱 Initializing Mobile Ultra Interactions...');
    console.log(`Device: ${this.getDeviceInfo()}`);
    
    this.setupTouchInteractions();
    this.setupHapticFeedback();
    this.setupGestureNavigation();
    this.setupPullToRefresh();
    this.setupSwipeGestures();
    this.setupDoubleTap();
    this.setupLongPress();
    this.setupMobileOptimizations();
    this.setupIPhoneSpecific();
    this.setupPerformanceOptimizations();
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

  detectIPhone() {
    return /iPhone/.test(navigator.userAgent);
  }

  getDeviceInfo() {
    const userAgent = navigator.userAgent;
    let deviceInfo = 'Unknown';
    
    if (this.isIPhone) {
      if (/iPhone 15 Pro Max/.test(userAgent)) deviceInfo = 'iPhone 15 Pro Max';
      else if (/iPhone 15 Pro/.test(userAgent)) deviceInfo = 'iPhone 15 Pro';
      else if (/iPhone 15/.test(userAgent)) deviceInfo = 'iPhone 15';
      else if (/iPhone 14 Pro Max/.test(userAgent)) deviceInfo = 'iPhone 14 Pro Max';
      else if (/iPhone 14 Pro/.test(userAgent)) deviceInfo = 'iPhone 14 Pro';
      else if (/iPhone 14/.test(userAgent)) deviceInfo = 'iPhone 14';
      else if (/iPhone 13 Pro Max/.test(userAgent)) deviceInfo = 'iPhone 13 Pro Max';
      else if (/iPhone 13 Pro/.test(userAgent)) deviceInfo = 'iPhone 13 Pro';
      else if (/iPhone 13/.test(userAgent)) deviceInfo = 'iPhone 13';
      else if (/iPhone 12 Pro Max/.test(userAgent)) deviceInfo = 'iPhone 12 Pro Max';
      else if (/iPhone 12 Pro/.test(userAgent)) deviceInfo = 'iPhone 12 Pro';
      else if (/iPhone 12/.test(userAgent)) deviceInfo = 'iPhone 12';
      else deviceInfo = 'iPhone';
    } else if (this.isAndroid) {
      if (/SM-S918B/.test(userAgent)) deviceInfo = 'Samsung Galaxy S24 Ultra';
      else if (/SM-G998B/.test(userAgent)) deviceInfo = 'Samsung Galaxy S23 Ultra';
      else if (/Pixel 8 Pro/.test(userAgent)) deviceInfo = 'Google Pixel 8 Pro';
      else deviceInfo = 'Android';
    }
    
    return deviceInfo;
  }

  setupTouchInteractions() {
    if (!this.touchSupport) return;

    // Enhanced touch feedback
    document.addEventListener('touchstart', (e) => {
      if (this.interactions.tapFeedback) {
        this.addTouchFeedback(e.target);
      }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (this.interactions.tapFeedback) {
        this.removeTouchFeedback(e.target);
      }
    }, { passive: true });

    // Prevent default touch behaviors
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('.no-scroll')) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  addTouchFeedback(element) {
    if (!element || element.classList.contains('touch-feedback')) return;
    
    element.classList.add('touch-feedback');
    element.style.transform = 'scale(0.95)';
    element.style.transition = 'transform 0.1s ease';
  }

  removeTouchFeedback(element) {
    if (!element) return;
    
    element.classList.remove('touch-feedback');
    element.style.transform = 'scale(1)';
    
    setTimeout(() => {
      element.style.transition = '';
    }, 100);
  }

  setupHapticFeedback() {
    if (!this.hapticSupport || !this.interactions.hapticFeedback) return;

    // Haptic feedback for buttons
    document.addEventListener('click', (e) => {
      const element = e.target.closest('button, .btn-generate, .btn-export, .btn-refresh, .odd-box, .theme-switcher-btn');
      if (element) {
        this.triggerHaptic('light');
      }
    });

    // Haptic feedback for successful actions
    window.addEventListener('success', () => {
      this.triggerHaptic('success');
    });

    // Haptic feedback for errors
    window.addEventListener('error', () => {
      this.triggerHaptic('error');
    });
  }

  triggerHaptic(type) {
    if (!this.hapticSupport) return;

    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(50);
        break;
      case 'success':
        navigator.vibrate([10, 50, 10]);
        break;
      case 'error':
        navigator.vibrate([100, 50, 100]);
        break;
      case 'selection':
        navigator.vibrate(15);
        break;
      default:
        navigator.vibrate(20);
    }
  }

  setupGestureNavigation() {
    if (!this.interactions.gestureSupport) return;

    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwiping = false;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const diffX = e.touches[0].clientX - startX;
        const diffY = e.touches[0].clientY - startY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
          isSwiping = true;
          
          // Horizontal swipe
          if (Math.abs(diffX) > 50) {
            if (diffX > 0) {
              this.handleSwipeRight();
            } else {
              this.handleSwipeLeft();
            }
            startX = e.touches[0].clientX;
          }
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      isSwiping = false;
    }, { passive: true });
  }

  handleSwipeLeft() {
    // Navigate to previous theme or page
    const themeSwitcher = document.querySelector('.theme-switcher-btn.active');
    if (themeSwitcher) {
      const prevBtn = themeSwitcher.previousElementSibling;
      if (prevBtn && prevBtn.classList.contains('theme-switcher-btn')) {
        prevBtn.click();
        this.triggerHaptic('selection');
      }
    }
  }

  handleSwipeRight() {
    // Navigate to next theme or page
    const themeSwitcher = document.querySelector('.theme-switcher-btn.active');
    if (themeSwitcher) {
      const nextBtn = themeSwitcher.nextElementSibling;
      if (nextBtn && nextBtn.classList.contains('theme-switcher-btn')) {
        nextBtn.click();
        this.triggerHaptic('selection');
      }
    }
  }

  setupPullToRefresh() {
    if (!this.interactions.pullToRefresh) return;

    let startY = 0;
    let isPulling = false;
    const pullThreshold = 100;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!isPulling || window.scrollY > 0) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && diff < pullThreshold) {
        this.showPullIndicator(diff / pullThreshold);
      } else if (diff >= pullThreshold) {
        e.preventDefault();
        this.showPullIndicator(1);
        this.triggerHaptic('medium');
      }
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (isPulling) {
        isPulling = false;
        this.hidePullIndicator();
        
        // Trigger refresh if threshold was reached
        if (this.pullThresholdReached) {
          this.performRefresh();
          this.triggerHaptic('success');
        }
      }
    }, { passive: true });
  }

  showPullIndicator(progress) {
    let indicator = document.querySelector('.pull-to-refresh-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-to-refresh-indicator';
      indicator.innerHTML = `
        <div class="pull-icon">🔄</div>
        <div class="pull-text">Tirer pour rafraîchir</div>
      `;
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--gradient-primary);
        color: var(--text-primary);
        padding: 1rem 2rem;
        border-radius: 20px;
        font-weight: 600;
        z-index: 10000;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: var(--shadow-xl);
        text-align: center;
      `;
      document.body.appendChild(indicator);
    }

    indicator.style.opacity = progress;
    indicator.style.transform = `translateX(-50%) translateY(${progress * 20}px)`;
    
    if (progress >= 1) {
      this.pullThresholdReached = true;
      indicator.querySelector('.pull-text').textContent = 'Relâcher pour rafraîchir';
      indicator.querySelector('.pull-icon').style.animation = 'spin 1s linear infinite';
    }
  }

  hidePullIndicator() {
    const indicator = document.querySelector('.pull-to-refresh-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.transform = 'translateX(-50%) translateY(0)';
      setTimeout(() => {
        indicator.remove();
      }, 300);
    }
    this.pullThresholdReached = false;
  }

  performRefresh() {
    // Trigger page refresh
    window.location.reload();
  }

  setupSwipeGestures() {
    if (!this.interactions.swipeNavigation) return;

    // Add swipe indicators to interactive elements
    const interactiveElements = document.querySelectorAll('.match-card, .odd-box, .theme-switcher-btn');
    
    interactiveElements.forEach(element => {
      element.style.position = 'relative';
      element.style.overflow = 'hidden';
      
      // Add swipe hint
      const swipeHint = document.createElement('div');
      swipeHint.className = 'swipe-hint';
      swipeHint.innerHTML = '↔️';
      swipeHint.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        opacity: 0;
        transition: opacity 0.3s ease;
        font-size: 1.5rem;
        pointer-events: none;
      `;
      
      element.appendChild(swipeHint);
      
      // Show hint on hover
      element.addEventListener('mouseenter', () => {
        swipeHint.style.opacity = '0.3';
      });
      
      element.addEventListener('mouseleave', () => {
        swipeHint.style.opacity = '0';
      });
    });
  }

  setupDoubleTap() {
    if (!this.interactions.doubleTap) return;

    let lastTap = 0;
    const doubleTapDelay = 300;

    document.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      
      if (tapLength < doubleTapDelay && tapLength > 0) {
        this.handleDoubleTap(e.target);
        this.triggerHaptic('medium');
      }
      
      lastTap = currentTime;
    }, { passive: true });
  }

  handleDoubleTap(element) {
    // Double tap to like/favorite
    const matchCard = element.closest('.match-card');
    if (matchCard) {
      matchCard.classList.toggle('favorited');
      this.showNotification('Match ajouté aux favoris', 'success');
    }
  }

  setupLongPress() {
    if (!this.interactions.longPress) return;

    let pressTimer;
    const longPressDelay = 500;

    document.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        this.handleLongPress(e.target);
        this.triggerHaptic('heavy');
      }, longPressDelay);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      clearTimeout(pressTimer);
    }, { passive: true });

    document.addEventListener('touchmove', () => {
      clearTimeout(pressTimer);
    }, { passive: true });
  }

  handleLongPress(element) {
    // Long press to show context menu
    const matchCard = element.closest('.match-card');
    if (matchCard) {
      this.showContextMenu(matchCard);
    }
  }

  showContextMenu(element) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.mobile-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'mobile-context-menu';
    menu.innerHTML = `
      <div class="context-menu-item" data-action="favorite">
        <span class="menu-icon">⭐</span>
        <span class="menu-text">Ajouter aux favoris</span>
      </div>
      <div class="context-menu-item" data-action="share">
        <span class="menu-icon">📤</span>
        <span class="menu-text">Partager</span>
      </div>
      <div class="context-menu-item" data-action="details">
        <span class="menu-icon">📊</span>
        <span class="menu-text">Voir détails</span>
      </div>
    `;

    menu.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-secondary);
      border: 1px solid var(--border-primary);
      border-radius: 20px;
      padding: 1rem;
      z-index: 10000;
      box-shadow: var(--shadow-xl);
      min-width: 250px;
      backdrop-filter: var(--glass-blur);
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(menu);

    // Add event listeners
    menu.addEventListener('click', (e) => {
      const action = e.target.closest('.context-menu-item')?.dataset.action;
      if (action) {
        this.handleContextMenuAction(action, element);
      }
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (menu.parentNode) {
        menu.remove();
      }
    }, 5000);
  }

  handleContextMenuAction(action, element) {
    switch (action) {
      case 'favorite':
        element.classList.toggle('favorited');
        this.showNotification('Match ajouté aux favoris', 'success');
        break;
      case 'share':
        this.shareMatch(element);
        break;
      case 'details':
        this.showMatchDetails(element);
        break;
    }
  }

  shareMatch(element) {
    // Implement share functionality
    if (navigator.share) {
      navigator.share({
        title: 'FIFA PRO Match',
        text: 'Découvrez ce match sur FIFA PRO',
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      this.showNotification('Lien copié dans le presse-papiers', 'success');
    }
  }

  showMatchDetails(element) {
    // Implement match details view
    this.showNotification('Détails du match en cours de chargement', 'info');
  }

  setupMobileOptimizations() {
    // Optimize viewport for mobile
    this.optimizeViewport();
    
    // Optimize scrolling
    this.optimizeScrolling();
    
    // Optimize images
    this.optimizeImages();
    
    // Optimize fonts
    this.optimizeFonts();
  }

  optimizeViewport() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      if (this.isIPhone) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0, user-scalable=yes, shrink-to-fit=no'
        );
      }
    }
  }

  optimizeScrolling() {
    // Smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Optimize scroll performance
    document.body.style.touchAction = 'pan-y';
    
    // Add scroll indicators
    this.addScrollIndicators();
  }

  addScrollIndicators() {
    const scrollIndicator = document.createElement('div');
    scrollIndicator.className = 'scroll-indicator';
    scrollIndicator.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 4px;
      height: 0;
      background: var(--gradient-primary);
      border-radius: 2px;
      transition: height 0.3s ease;
      z-index: 9999;
      opacity: 0.7;
    `;
    
    document.body.appendChild(scrollIndicator);
    
    // Update scroll indicator
    window.addEventListener('scroll', () => {
      const scrollPercentage = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      scrollIndicator.style.height = `${scrollPercentage}%`;
    });
  }

  optimizeImages() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.imageRendering = 'crisp-edges';
    });
  }

  optimizeFonts() {
    // Optimize font loading
    document.body.style.fontDisplay = 'swap';
    document.body.style.webkitFontSmoothing = 'antialiased';
    document.body.style.mozOsxFontSmoothing = 'grayscale';
    document.body.style.textRendering = 'optimizeLegibility';
  }

  setupIPhoneSpecific() {
    if (!this.isIPhone) return;

    // Add iPhone-specific optimizations
    this.setupIPhoneNotch();
    this.setupIPhoneHomeIndicator();
    this.setupIPhoneGestures();
  }

  setupIPhoneNotch() {
    // Handle iPhone notch
    const safeArea = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-top');
    if (safeArea && safeArea !== '0px') {
      document.body.style.paddingTop = safeArea;
    }
  }

  setupIPhoneHomeIndicator() {
    // Handle iPhone home indicator
    const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom');
    if (safeAreaBottom && safeAreaBottom !== '0px') {
      document.body.style.paddingBottom = safeAreaBottom;
    }
  }

  setupIPhoneGestures() {
    // Setup iPhone-specific gestures
    let startY = 0;
    let isGesturing = false;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        startY = e.touches[0].clientY;
        isGesturing = false;
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        // Detect swipe up from bottom (iPhone gesture)
        if (diff < -50 && currentY > window.innerHeight - 100) {
          e.preventDefault();
          this.handleIPhoneSwipeUp();
          isGesturing = true;
        }
      }
    }, { passive: false });
  }

  handleIPhoneSwipeUp() {
    // Handle iPhone swipe up gesture (go to home)
    this.showNotification('Swipe up detected - Home gesture', 'info');
  }

  setupPerformanceOptimizations() {
    // Hardware acceleration
    this.enableHardwareAcceleration();
    
    // Reduce repaints
    this.optimizeRepaints();
    
    // Memory management
    this.optimizeMemory();
  }

  enableHardwareAcceleration() {
    const elements = document.querySelectorAll('.match-card, .odd-box, .theme-switcher-btn, .btn-generate, .btn-export, .btn-refresh');
    elements.forEach(element => {
      element.style.transform = 'translateZ(0)';
      element.style.willChange = 'transform';
      element.style.backfaceVisibility = 'hidden';
    });
  }

  optimizeRepaints() {
    // Use requestAnimationFrame for smooth animations
    this.rafId = null;
    
    const animate = () => {
      // Animation logic here
      this.rafId = requestAnimationFrame(animate);
    };
    
    // Start animation loop
    this.rafId = requestAnimationFrame(animate);
  }

  optimizeMemory() {
    // Clean up event listeners
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) {
          // Element is not visible, can be cleaned up
          this.cleanupElement(entry.target);
        }
      });
    });

    // Observe all interactive elements
    const elements = document.querySelectorAll('.match-card, .odd-box, .theme-switcher-btn');
    elements.forEach(element => {
      observer.observe(element);
    });
  }

  cleanupElement(element) {
    // Remove event listeners and references
    element.removeEventListener('touchstart', this.touchStartHandler);
    element.removeEventListener('touchend', this.touchEndHandler);
    element.style.transform = '';
    element.style.willChange = '';
  }

  showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.mobile-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `mobile-notification mobile-notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--gradient-primary);
      color: var(--text-primary);
      padding: 1rem 1.5rem;
      border-radius: 20px;
      font-weight: 600;
      z-index: 10001;
      animation: slideInDown 0.3s ease;
      box-shadow: var(--shadow-xl);
      max-width: calc(100vw - 40px);
      text-align: center;
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);

    // Haptic feedback
    this.triggerHaptic(type === 'success' ? 'success' : 'light');
  }

  // Public API methods
  enableInteraction(type) {
    if (this.interactions.hasOwnProperty(type)) {
      this.interactions[type] = true;
    }
  }

  disableInteraction(type) {
    if (this.interactions.hasOwnProperty(type)) {
      this.interactions[type] = false;
    }
  }

  getInteractionStatus() {
    return {
      ...this.interactions,
      deviceInfo: this.getDeviceInfo(),
      touchSupport: this.touchSupport,
      hapticSupport: this.hapticSupport
    };
  }

  destroy() {
    // Clean up all event listeners and references
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    // Remove all dynamically created elements
    const elements = document.querySelectorAll('.pull-to-refresh-indicator, .mobile-context-menu, .scroll-indicator');
    elements.forEach(element => element.remove());
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes slideInDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .mobile-context-menu {
    animation: slideUp 0.3s ease;
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .context-menu-item:hover {
    background: var(--bg-tertiary);
    transform: translateX(5px);
  }

  .menu-icon {
    font-size: 1.2rem;
  }

  .menu-text {
    font-weight: 600;
    color: var(--text-primary);
  }

  .favorited {
    border: 2px solid var(--accent-warning);
    box-shadow: 0 0 10px var(--accent-warning);
  }

  .swipe-hint {
    background: var(--gradient-primary);
    color: var(--text-primary);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;
document.head.appendChild(style);

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.mobileUltraInteractions = new MobileUltraInteractions();
    });
  } else {
    window.mobileUltraInteractions = new MobileUltraInteractions();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileUltraInteractions;
}
