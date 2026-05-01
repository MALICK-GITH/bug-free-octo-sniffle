// Mobile Gestures and Touch Interactions - Integrated Design
class MatchMobileGestures {
  constructor() {
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    this.swipeThreshold = 50;
    this.longPressThreshold = 500;
    this.longPressTimer = null;
    this.isLongPress = false;
    
    this.init();
  }

  init() {
    console.log('📱 Initializing Mobile Gestures...');
    this.setupGestures();
    this.setupPullToRefresh();
    this.setupSwipeNavigation();
    this.setupLongPress();
    this.setupPinchZoom();
  }

  setupGestures() {
    // Add touch event listeners to main content
    const page = document.querySelector('.page');
    if (!page) return;

    page.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    page.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    page.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
  }

  handleTouchStart(e) {
    // Store initial touch position
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.isLongPress = false;

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      this.isLongPress = true;
      this.handleLongPress(e);
    }, this.longPressThreshold);
  }

  handleTouchMove(e) {
    // Cancel long press if finger moves
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Prevent default for certain gestures
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = Math.abs(touchX - this.touchStartX);
    const deltaY = Math.abs(touchY - this.touchStartY);

    // Allow vertical scrolling but prevent horizontal swipes on scrollable areas
    if (deltaX > deltaY && deltaX > 20) {
      e.preventDefault();
    }
  }

  handleTouchEnd(e) {
    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.isLongPress) {
      return; // Don't process swipe if it was a long press
    }

    // Store end position
    this.touchEndX = e.changedTouches[0].clientX;
    this.touchEndY = e.changedTouches[0].clientY;

    // Handle swipe
    this.handleSwipe();
  }

  handleSwipe() {
    const deltaX = this.touchEndX - this.touchStartX;
    const deltaY = this.touchEndY - this.touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Check if it's a horizontal swipe
    if (absDeltaX > this.swipeThreshold && absDeltaX > absDeltaY) {
      if (deltaX > 0) {
        this.handleSwipeRight();
      } else {
        this.handleSwipeLeft();
      }
    }
    // Check if it's a vertical swipe
    else if (absDeltaY > this.swipeThreshold && absDeltaY > absDeltaX) {
      if (deltaY > 0) {
        this.handleSwipeDown();
      } else {
        this.handleSwipeUp();
      }
    }
  }

  handleSwipeRight() {
    console.log('👉 Swipe right detected');
    this.showNavigationHint('Précédent');
    
    // Navigate to previous section or page
    const currentSection = this.getCurrentSection();
    if (currentSection) {
      this.navigateToSection('prev');
    } else {
      // Go back to match list
      window.location.href = '/';
    }
  }

  handleSwipeLeft() {
    console.log('👈 Swipe left detected');
    this.showNavigationHint('Suivant');
    
    // Navigate to next section
    const currentSection = this.getCurrentSection();
    if (currentSection) {
      this.navigateToSection('next');
    }
  }

  handleSwipeUp() {
    console.log('👆 Swipe up detected');
    this.showNavigationHint('Défiler vers le haut');
    
    // Scroll to top or show more details
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  handleSwipeDown() {
    console.log('👇 Swipe down detected');
    this.showNavigationHint('Actualiser');
    
    // Trigger pull-to-refresh
    this.triggerPullToRefresh();
  }

  getCurrentSection() {
    const sections = document.querySelectorAll('.panel');
    const viewportCenter = window.innerHeight / 2;
    
    for (let section of sections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= viewportCenter && rect.bottom >= viewportCenter) {
        return section;
      }
    }
    return null;
  }

  navigateToSection(direction) {
    const sections = Array.from(document.querySelectorAll('.panel'));
    const currentSection = this.getCurrentSection();
    
    if (!currentSection) return;
    
    const currentIndex = sections.indexOf(currentSection);
    let targetIndex;
    
    if (direction === 'next') {
      targetIndex = Math.min(currentIndex + 1, sections.length - 1);
    } else {
      targetIndex = Math.max(currentIndex - 1, 0);
    }
    
    const targetSection = sections[targetIndex];
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.highlightSection(targetSection);
    }
  }

  highlightSection(section) {
    section.classList.add('section-highlighted');
    setTimeout(() => {
      section.classList.remove('section-highlighted');
    }, 1000);
  }

  setupPullToRefresh() {
    let startY = 0;
    let isPulling = false;
    let pullDistance = 0;
    const maxPull = 120;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      pullDistance = currentY - startY;
      
      if (pullDistance > 0 && pullDistance < maxPull) {
        e.preventDefault();
        this.showPullIndicator(pullDistance);
      }
    });

    document.addEventListener('touchend', (e) => {
      if (!isPulling) return;
      
      isPulling = false;
      
      if (pullDistance > 80) {
        this.triggerPullToRefresh();
      }
      
      this.hidePullIndicator();
      pullDistance = 0;
    });
  }

  showPullIndicator(distance) {
    let indicator = document.getElementById('pullIndicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'pullIndicator';
      indicator.innerHTML = `
        <div class="pull-icon">🔄</div>
        <div class="pull-text">Relâcher pour actualiser</div>
      `;
      document.body.appendChild(indicator);
    }
    
    const progress = Math.min(distance / 120, 1);
    indicator.style.transform = `translateY(${Math.min(distance, 120)}px) scale(${0.8 + progress * 0.2})`;
    indicator.style.opacity = progress;
  }

  hidePullIndicator() {
    const indicator = document.getElementById('pullIndicator');
    if (indicator) {
      indicator.style.transform = 'translateY(-100px) scale(0.8)';
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 300);
    }
  }

  triggerPullToRefresh() {
    console.log('🔄 Pull to refresh triggered');
    this.showRefreshIndicator();
    
    // Trigger page reload or data refresh
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  showRefreshIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'refreshIndicator';
    indicator.innerHTML = `
      <div class="refresh-spinner">🔄</div>
      <div class="refresh-text">Actualisation...</div>
    `;
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.remove();
    }, 2000);
  }

  setupSwipeNavigation() {
    // Add swipe hints to interactive elements
    const interactiveElements = document.querySelectorAll('.panel, .recommendation-card, .bot-card');
    
    interactiveElements.forEach(element => {
      element.classList.add('swipeable');
      element.addEventListener('mouseenter', () => this.showSwipeHint(element));
      element.addEventListener('mouseleave', () => this.hideSwipeHint(element));
    });
  }

  showSwipeHint(element) {
    if (!this.isMobile()) return;
    
    const hint = document.createElement('div');
    hint.className = 'swipe-hint';
    hint.innerHTML = '↔️ Swipe pour naviguer';
    element.appendChild(hint);
    
    setTimeout(() => {
      hint.remove();
    }, 2000);
  }

  hideSwipeHint(element) {
    const hint = element.querySelector('.swipe-hint');
    if (hint) hint.remove();
  }

  setupLongPress() {
    // Add long press functionality to cards
    const cards = document.querySelectorAll('.recommendation-card, .bot-card, .market-card');
    
    cards.forEach(card => {
      card.addEventListener('touchstart', (e) => this.handleCardTouchStart(e, card), { passive: false });
      card.addEventListener('touchend', (e) => this.handleCardTouchEnd(e, card), { passive: false });
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.showCardContextMenu(card, e);
      });
    });
  }

  handleCardTouchStart(e, card) {
    this.longPressTimer = setTimeout(() => {
      this.showCardContextMenu(card, e);
    }, this.longPressThreshold);
  }

  handleCardTouchEnd(e, card) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  showCardContextMenu(card, event) {
    // Remove existing context menus
    const existingMenu = document.querySelector('.card-context-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'card-context-menu';
    menu.innerHTML = `
      <div class="context-menu-item" data-action="share">
        <span class="menu-icon">📤</span>
        <span class="menu-text">Partager</span>
      </div>
      <div class="context-menu-item" data-action="bookmark">
        <span class="menu-icon">🔖</span>
        <span class="menu-text">Ajouter aux favoris</span>
      </div>
      <div class="context-menu-item" data-action="details">
        <span class="menu-icon">📊</span>
        <span class="menu-text">Voir détails</span>
      </div>
      <div class="context-menu-item" data-action="export">
        <span class="menu-icon">💾</span>
        <span class="menu-text">Exporter</span>
      </div>
    `;

    // Position menu
    const rect = card.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 10}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.zIndex = '1000';

    document.body.appendChild(menu);

    // Add event listeners
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        this.handleContextMenuAction(item.dataset.action, card);
        menu.remove();
      });
    });

    // Close menu when clicking outside
    setTimeout(() => {
      document.addEventListener('click', () => menu.remove(), { once: true });
    }, 100);
  }

  handleContextMenuAction(action, card) {
    console.log(`📱 Context menu action: ${action}`);
    
    switch (action) {
      case 'share':
        this.shareCard(card);
        break;
      case 'bookmark':
        this.bookmarkCard(card);
        break;
      case 'details':
        this.showCardDetails(card);
        break;
      case 'export':
        this.exportCard(card);
        break;
    }
  }

  shareCard(card) {
    if (navigator.share) {
      navigator.share({
        title: 'Match Prediction',
        text: 'Découvrez cette analyse de match !',
        url: window.location.href
      });
    } else {
      this.copyToClipboard(window.location.href);
    }
  }

  bookmarkCard(card) {
    const cardId = card.dataset.id || 'unknown';
    const bookmarks = JSON.parse(localStorage.getItem('match_bookmarks') || '[]');
    
    if (!bookmarks.includes(cardId)) {
      bookmarks.push(cardId);
      localStorage.setItem('match_bookmarks', JSON.stringify(bookmarks));
      this.showToast('🔖 Ajouté aux favoris');
    } else {
      this.showToast('📌 Déjà dans les favoris');
    }
  }

  showCardDetails(card) {
    // Highlight card and scroll to details
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('card-details-highlighted');
    
    setTimeout(() => {
      card.classList.remove('card-details-highlighted');
    }, 2000);
  }

  exportCard(card) {
    const cardData = this.extractCardData(card);
    const blob = new Blob([JSON.stringify(cardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-card-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  setupPinchZoom() {
    let scale = 1;
    let initialDistance = 0;
    
    const charts = document.querySelectorAll('.chart-wrapper canvas');
    
    charts.forEach(chart => {
      chart.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          initialDistance = this.getDistance(e.touches[0], e.touches[1]);
        }
      });
      
      chart.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
          const scaleChange = currentDistance / initialDistance;
          scale = Math.min(Math.max(0.5, scale * scaleChange), 3);
          
          chart.style.transform = `scale(${scale})`;
          initialDistance = currentDistance;
        }
      });
      
      chart.addEventListener('touchend', () => {
        if (scale !== 1) {
          setTimeout(() => {
            chart.style.transform = 'scale(1)';
            scale = 1;
          }, 1000);
        }
      });
    });
  }

  getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  showNavigationHint(direction) {
    const hint = document.createElement('div');
    hint.className = 'navigation-hint';
    hint.innerHTML = `
      <div class="hint-icon">${direction === 'Précédent' ? '👉' : '👈'}</div>
      <div class="hint-text">${direction}</div>
    `;
    
    document.body.appendChild(hint);
    
    setTimeout(() => {
      hint.classList.add('hint-show');
    }, 10);
    
    setTimeout(() => {
      hint.classList.remove('hint-show');
      setTimeout(() => hint.remove(), 300);
    }, 1500);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'mobile-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.showToast('📋 Lien copié');
    }
  }

  extractCardData(card) {
    // Extract relevant data from card for export
    return {
      type: card.className,
      title: card.querySelector('h4')?.textContent || '',
      content: card.textContent,
      timestamp: new Date().toISOString()
    };
  }

  isMobile() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  destroy() {
    // Cleanup event listeners and timers
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.mobileGestures = new MatchMobileGestures();
    });
  } else {
    window.mobileGestures = new MatchMobileGestures();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MatchMobileGestures;
}
