// Coupon Page Mobile Tools & Enhancements
class CouponMobileTools {
  constructor() {
    this.isMobile = this.detectMobile();
    this.isAndroid = this.detectAndroid();
    this.touchStartY = 0;
    this.isPulling = false;
    this.currentPanel = 'result';
    
    this.init();
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  detectAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  init() {
    if (!this.isMobile) return;

    console.log('🎫 Coupon Mobile Tools Active');

    // Android safe mode: keep page interactions native and avoid gesture overlays
    // that can cause misplaced touch targets on some WebView/browser combos.
    if (this.isAndroid) {
      document.body.classList.add('mobile-safe-mode');
      this.setupMobileNotifications();
      return;
    }

    this.setupTouchGestures();
    this.setupMobileShortcuts();
    this.setupQuickActions();
    this.setupMobilePanels();
    this.setupProgressiveEnhancement();
    this.setupMobileNotifications();
  }

  setupTouchGestures() {
    // Swipe between panels
    let startX = 0;
    let currentPanelIndex = 0;
    const panels = ['result', 'validation', 'healthPanel', 'alertsPanel'];

    document.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;

      if (Math.abs(diff) > 50) { // Minimum swipe distance
        if (diff > 0) {
          // Swipe left - next panel
          currentPanelIndex = Math.min(currentPanelIndex + 1, panels.length - 1);
        } else {
          // Swipe right - previous panel
          currentPanelIndex = Math.max(currentPanelIndex - 1, 0);
        }
        
        this.showPanel(panels[currentPanelIndex]);
      }
    }, { passive: true });
  }

  setupMobileShortcuts() {
    // Add floating action button for quick access
    const fab = document.createElement('div');
    fab.className = 'mobile-fab';
    fab.innerHTML = `
      <button class="fab-main" aria-label="Actions rapides">
        <span>⚡</span>
      </button>
      <div class="fab-menu">
        <button class="fab-item" data-action="generate">Générer</button>
        <button class="fab-item" data-action="validate">Valider</button>
        <button class="fab-item" data-action="telegram">Telegram</button>
        <button class="fab-item" data-action="pdf">PDF</button>
      </div>
    `;
    
    document.body.appendChild(fab);

    // FAB toggle
    const fabMain = fab.querySelector('.fab-main');
    const fabMenu = fab.querySelector('.fab-menu');
    
    fabMain.addEventListener('click', () => {
      fabMenu.classList.toggle('show');
      fabMain.classList.toggle('active');
    });

    // FAB actions
    fab.querySelectorAll('.fab-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        this.executeQuickAction(action);
        fabMenu.classList.remove('show');
        fabMain.classList.remove('active');
      });
    });

    // Close FAB when clicking outside
    document.addEventListener('click', (e) => {
      if (!fab.contains(e.target)) {
        fabMenu.classList.remove('show');
        fabMain.classList.remove('active');
      }
    });
  }

  setupQuickActions() {
    // Add quick action buttons to panels
    const panels = document.querySelectorAll('.panel');
    
    panels.forEach(panel => {
      const quickActions = document.createElement('div');
      quickActions.className = 'panel-quick-actions';
      quickActions.innerHTML = `
        <button class="quick-action" data-action="refresh" title="Actualiser">
          🔄
        </button>
        <button class="quick-action" data-action="copy" title="Copier">
          📋
        </button>
        <button class="quick-action" data-action="share" title="Partager">
          📤
        </button>
      `;
      
      panel.appendChild(quickActions);
    });

    // Handle quick actions
    document.querySelectorAll('.quick-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const panel = btn.closest('.panel');
        this.handleQuickAction(action, panel);
      });
    });
  }

  setupMobilePanels() {
    // Optimize panel content for mobile
    const panels = document.querySelectorAll('.panel');
    
    panels.forEach(panel => {
      // Add mobile-specific class
      panel.classList.add('mobile-optimized');
      
      // Add pull-to-refresh indicator
      const pullIndicator = document.createElement('div');
      pullIndicator.className = 'panel-pull-indicator';
      pullIndicator.innerHTML = '↓ Tirer pour actualiser';
      panel.appendChild(pullIndicator);
      
      // Setup pull-to-refresh for this panel
      this.setupPanelPullToRefresh(panel, pullIndicator);
    });
  }

  setupPanelPullToRefresh(panel, indicator) {
    let startY = 0;
    let isPulling = false;

    panel.addEventListener('touchstart', (e) => {
      if (panel.scrollTop === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });

    panel.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      
      if (diff > 0 && panel.scrollTop === 0) {
        e.preventDefault();
        indicator.style.transform = `translateY(${Math.min(diff / 2, 50)}px)`;
        indicator.style.opacity = Math.min(diff / 100, 1);
        
        if (diff > 100) {
          indicator.textContent = '↑ Relâcher pour actualiser';
          indicator.classList.add('ready');
        }
      }
    }, { passive: false });

    panel.addEventListener('touchend', () => {
      if (isPulling) {
        indicator.style.transform = 'translateY(0)';
        indicator.style.opacity = '0';
        
        if (indicator.classList.contains('ready')) {
          this.refreshPanel(panel);
        }
        
        indicator.classList.remove('ready');
        indicator.textContent = '↓ Tirer pour actualiser';
        isPulling = false;
      }
    }, { passive: true });
  }

  setupProgressiveEnhancement() {
    // Check device capabilities and enhance accordingly
    const hasTouch = 'ontouchstart' in window;
    const hasVibration = 'vibrate' in navigator;
    const hasBattery = 'getBattery' in navigator;
    const hasNetwork = 'connection' in navigator;

    if (hasTouch) {
      document.body.classList.add('touch-device');
    }

    if (hasVibration) {
      this.setupHapticFeedback();
    }

    if (hasBattery) {
      this.setupBatteryOptimization();
    }

    if (hasNetwork) {
      this.setupNetworkOptimization();
    }
  }

  setupHapticFeedback() {
    // Add haptic feedback to important actions
    const importantButtons = document.querySelectorAll('#generateBtn, #validateBtn, #sendTelegramBtn');
    
    importantButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (navigator.vibrate) {
          navigator.vibrate(50); // Short vibration
        }
      });
    });
  }

  setupBatteryOptimization() {
    navigator.getBattery().then(battery => {
      const updateBatteryStatus = () => {
        if (battery.level < 0.2) {
          document.body.classList.add('low-battery');
          this.reduceAnimations();
        } else {
          document.body.classList.remove('low-battery');
          this.restoreAnimations();
        }
      };

      battery.addEventListener('levelchange', updateBatteryStatus);
      updateBatteryStatus();
    });
  }

  setupNetworkOptimization() {
    const connection = navigator.connection;
    const updateNetworkStatus = () => {
      const effectiveType = connection.effectiveType;
      
      document.body.classList.remove('network-slow', 'network-fast');
      
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        document.body.classList.add('network-slow');
        this.enableLowDataMode();
      } else if (effectiveType === '4g') {
        document.body.classList.add('network-fast');
        this.enableHighDataMode();
      }
    };

    connection.addEventListener('change', updateNetworkStatus);
    updateNetworkStatus();
  }

  setupMobileNotifications() {
    // Request notification permission for mobile
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('✅ Notifications autorisées');
        }
      });
    }
  }

  showPanel(panelId) {
    // Hide all panels
    document.querySelectorAll('.panel').forEach(panel => {
      panel.classList.remove('active');
    });
    
    // Show selected panel
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) {
      targetPanel.classList.add('active');
      targetPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.currentPanel = panelId;
    }
  }

  executeQuickAction(action) {
    switch (action) {
      case 'generate':
        document.getElementById('generateBtn')?.click();
        break;
      case 'validate':
        document.getElementById('validateBtn')?.click();
        break;
      case 'telegram':
        document.getElementById('sendTelegramBtn')?.click();
        break;
      case 'pdf':
        document.getElementById('downloadPdfBtn')?.click();
        break;
    }
  }

  handleQuickAction(action, panel) {
    switch (action) {
      case 'refresh':
        this.refreshPanel(panel);
        break;
      case 'copy':
        this.copyPanelContent(panel);
        break;
      case 'share':
        this.sharePanelContent(panel);
        break;
    }
  }

  refreshPanel(panel) {
    // Add loading state
    panel.classList.add('mobile-loading-panel');
    
    // Trigger refresh based on panel type
    if (panel.id === 'result') {
      document.getElementById('generateBtn')?.click();
    } else if (panel.id === 'validation') {
      document.getElementById('validateBtn')?.click();
    }
    
    // Remove loading state after delay
    setTimeout(() => {
      panel.classList.remove('mobile-loading-panel');
    }, 2000);
  }

  copyPanelContent(panel) {
    const content = panel.textContent || '';
    navigator.clipboard.writeText(content).then(() => {
      this.showToast('Contenu copié !');
    });
  }

  sharePanelContent(panel) {
    const content = panel.textContent || '';
    const title = panel.querySelector('h3')?.textContent || 'Coupon';
    
    if (navigator.share) {
      navigator.share({
        title: title,
        text: content
      });
    } else {
      this.showToast('Partage non supporté sur cet appareil');
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'mobile-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  reduceAnimations() {
    document.documentElement.style.setProperty('--animation-duration', '0.1s');
    document.body.classList.add('reduced-motion');
  }

  restoreAnimations() {
    document.documentElement.style.removeProperty('--animation-duration');
    document.body.classList.remove('reduced-motion');
  }

  enableLowDataMode() {
    document.body.classList.add('low-data-mode');
    // Disable non-essential features
    document.querySelectorAll('.bg-grid').forEach(el => el.style.display = 'none');
  }

  enableHighDataMode() {
    document.body.classList.remove('low-data-mode');
    // Enable all features
    document.querySelectorAll('.bg-grid').forEach(el => el.style.display = '');
  }
}

// Initialize mobile tools when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.couponMobileTools = new CouponMobileTools();
    });
  } else {
    window.couponMobileTools = new CouponMobileTools();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CouponMobileTools;
}
