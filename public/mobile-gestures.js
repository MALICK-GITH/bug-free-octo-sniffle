/**
 * SOLITFIFPRO225 - Mobile Gestures System
 * Swipe gauche/droite, Pull-to-refresh, Double-tap
 */

class MobileGestures {
  constructor(options = {}) {
    this.swipeThreshold = options.swipeThreshold || 50;
    this.pullThreshold = options.pullThreshold || 80;
    this.doubleTapDelay = options.doubleTapDelay || 300;

    this.touchStart = { x: 0, y: 0, time: 0 };
    this.touchEnd = { x: 0, y: 0, time: 0 };
    this.lastTap = 0;
    this.isPulling = false;
    this.pullStartY = 0;

    this.callbacks = {
      onSwipeLeft: options.onSwipeLeft || (() => { }),
      onSwipeRight: options.onSwipeRight || (() => { }),
      onPullToRefresh: options.onPullToRefresh || (() => { }),
      onDoubleTap: options.onDoubleTap || (() => { }),
      onSwipeMatch: options.onSwipeMatch || (() => { }) // Callback spécifique pour les matchs
    };

    this.init();
  }

  init() {
    this.setupGlobalGestures();
    this.setupPullToRefresh();
    this.setupDoubleTap();
    this.setupMatchSwipe();
    this.createPullIndicator();
  }

  /**
   * Crée l'indicateur visuel de pull-to-refresh
   */
  createPullIndicator() {
    if (document.querySelector('.pull-indicator')) return;

    const indicator = document.createElement('div');
    indicator.className = 'pull-indicator';
    indicator.innerHTML = `
      <div class="pull-spinner"></div>
      <span class="pull-text">Tirez pour rafraîchir</span>
    `;
    indicator.style.cssText = `
      position: fixed;
      top: -60px;
      left: 0;
      right: 0;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-glow);
      transition: transform 0.3s ease;
      z-index: 999;
      backdrop-filter: blur(10px);
    `;

    // Styles CSS
    const styles = document.createElement('style');
    styles.textContent = `
      .pull-indicator.pulling {
        transform: translateY(60px);
      }
      
      .pull-indicator.refreshing {
        transform: translateY(60px);
      }
      
      .pull-indicator.refreshing .pull-spinner {
        animation: spin 1s linear infinite;
      }
      
      .pull-indicator .pull-spinner {
        width: 20px;
        height: 20px;
        border: 2px solid var(--border-subtle);
        border-top-color: var(--primary-light);
        border-radius: 50%;
      }
      
      .pull-indicator .pull-text {
        font-size: 0.9rem;
        color: var(--text-secondary);
      }
      
      .pull-indicator.ready .pull-text {
        color: var(--primary-light);
        font-weight: 600;
      }
      
      /* Animations pour les swipe */
      .match-card.swiping-left {
        transform: translateX(-30px);
        transition: transform 0.2s ease;
      }
      
      .match-card.swiping-right {
        transform: translateX(30px);
        transition: transform 0.2s ease;
      }
      
      .match-card.swiped-left {
        animation: swipeLeftOut 0.3s ease forwards;
      }
      
      .match-card.swiped-right {
        animation: swipeRightOut 0.3s ease forwards;
      }
      
      @keyframes swipeLeftOut {
        to {
          transform: translateX(-100%);
          opacity: 0;
        }
      }
      
      @keyframes swipeRightOut {
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
      
      /* Effet de ripple pour double-tap */
      .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(0, 242, 122, 0.4);
        transform: scale(0);
        animation: rippleEffect 0.6s linear;
        pointer-events: none;
      }
      
      @keyframes rippleEffect {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(styles);

    document.body.appendChild(indicator);
    this.pullIndicator = indicator;
  }

  /**
   * Configure les gestes globaux (swipe gauche/droite)
   */
  setupGlobalGestures() {
    document.addEventListener('touchstart', (e) => {
      this.touchStart.x = e.changedTouches[0].screenX;
      this.touchStart.y = e.changedTouches[0].screenY;
      this.touchStart.time = new Date().getTime();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      this.touchEnd.x = e.changedTouches[0].screenX;
      this.touchEnd.y = e.changedTouches[0].screenY;
      this.touchEnd.time = new Date().getTime();

      this.handleSwipe();
    }, { passive: true });
  }

  /**
   * Gère le swipe global
   */
  handleSwipe() {
    const diffX = this.touchEnd.x - this.touchStart.x;
    const diffY = this.touchEnd.y - this.touchStart.y;
    const diffTime = this.touchEnd.time - this.touchStart.time;

    // Vérifie si c'est un mouvement horizontal
    if (Math.abs(diffX) > Math.abs(diffY)) {
      // Vérifie la vitesse (swipe rapide)
      const velocity = Math.abs(diffX) / diffTime;

      if (Math.abs(diffX) > this.swipeThreshold || velocity > 0.5) {
        if (diffX < 0) {
          // Swipe gauche
          this.callbacks.onSwipeLeft();
        } else {
          // Swipe droit
          this.callbacks.onSwipeRight();
        }
      }
    }
  }

  /**
   * Configure le pull-to-refresh
   */
  setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isAtTop = false;

    document.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isAtTop = window.scrollY === 0;
      this.isPulling = isAtTop;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this.isPulling) return;

      currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;

      if (pullDistance > 0 && window.scrollY === 0) {
        // Empêche le scroll normal
        e.preventDefault();

        // Met à jour l'indicateur visuel
        const pullPercent = Math.min(pullDistance / this.pullThreshold, 1);
        const translateY = Math.min(pullDistance * 0.5, 60);

        if (this.pullIndicator) {
          this.pullIndicator.style.transform = `translateY(${translateY}px)`;

          if (pullPercent >= 1) {
            this.pullIndicator.classList.add('ready');
            this.pullIndicator.querySelector('.pull-text').textContent = 'Relâchez pour rafraîchir';
          } else {
            this.pullIndicator.classList.remove('ready');
            this.pullIndicator.querySelector('.pull-text').textContent = 'Tirez pour rafraîchir';
          }
        }
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      if (!this.isPulling) return;

      const pullDistance = currentY - startY;

      if (pullDistance >= this.pullThreshold && window.scrollY === 0) {
        // Déclenche le refresh
        this.triggerPullToRefresh();
      } else {
        // Réinitialise l'indicateur
        this.resetPullIndicator();
      }

      this.isPulling = false;
    }, { passive: true });
  }

  /**
   * Déclenche le pull-to-refresh
   */
  triggerPullToRefresh() {
    if (this.pullIndicator) {
      this.pullIndicator.classList.add('refreshing');
      this.pullIndicator.querySelector('.pull-text').textContent = 'Rafraîchissement...';
    }

    // Appelle le callback
    this.callbacks.onPullToRefresh();

    // Réinitialise après 2 secondes
    setTimeout(() => {
      this.resetPullIndicator();
    }, 2000);
  }

  /**
   * Réinitialise l'indicateur de pull
   */
  resetPullIndicator() {
    if (this.pullIndicator) {
      this.pullIndicator.style.transform = 'translateY(-60px)';
      this.pullIndicator.classList.remove('ready', 'refreshing');
      this.pullIndicator.querySelector('.pull-text').textContent = 'Tirez pour rafraîchir';
    }
  }

  /**
   * Configure le double-tap
   */
  setupDoubleTap() {
    document.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - this.lastTap;

      if (tapLength < this.doubleTapDelay && tapLength > 0) {
        // Double-tap détecté
        this.handleDoubleTap(e);
        e.preventDefault();
      }

      this.lastTap = currentTime;
    }, { passive: false });
  }

  /**
   * Gère le double-tap
   */
  handleDoubleTap(e) {
    const target = e.target;

    // Crée l'effet de ripple
    this.createRipple(e);

    // Vérifie si on a tapé sur un match
    const matchCard = target.closest('.match-card');
    if (matchCard) {
      const matchId = matchCard.dataset.matchId;
      this.callbacks.onDoubleTap({
        type: 'match',
        matchId: matchId,
        element: matchCard
      });

      // Ajoute la classe selected
      matchCard.classList.toggle('selected');
    } else {
      this.callbacks.onDoubleTap({
        type: 'general',
        element: target
      });
    }
  }

  /**
   * Crée l'effet de ripple
   */
  createRipple(e) {
    const touch = e.changedTouches[0];
    const ripple = document.createElement('div');
    ripple.className = 'ripple';

    const size = 50;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (touch.clientX - size / 2) + 'px';
    ripple.style.top = (touch.clientY - size / 2) + 'px';

    document.body.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  }

  /**
   * Configure le swipe sur les cartes de match
   */
  setupMatchSwipe() {
    const matchCards = document.querySelectorAll('.match-card');

    matchCards.forEach(card => {
      let startX = 0;
      let currentX = 0;
      let isSwiping = false;

      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
      }, { passive: true });

      card.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;

        currentX = e.touches[0].clientX;
        const diffX = currentX - startX;

        // Effet visuel de swipe
        if (Math.abs(diffX) > 10) {
          card.style.transform = `translateX(${diffX * 0.3}px)`;

          if (diffX > 0) {
            card.classList.add('swiping-right');
            card.classList.remove('swiping-left');
          } else {
            card.classList.add('swiping-left');
            card.classList.remove('swiping-right');
          }
        }
      }, { passive: true });

      card.addEventListener('touchend', (e) => {
        if (!isSwiping) return;

        const diffX = currentX - startX;
        const matchId = card.dataset.matchId;

        // Réinitialise le style
        card.style.transform = '';
        card.classList.remove('swiping-left', 'swiping-right');

        if (Math.abs(diffX) > this.swipeThreshold) {
          if (diffX > 0) {
            // Swipe droit - ajouter aux favoris
            card.classList.add('swiped-right');
            this.callbacks.onSwipeMatch({
              matchId: matchId,
              direction: 'right',
              action: 'favorite',
              element: card
            });

            // Animation de confirmation
            this.showSwipeFeedback(card, '⭐ Ajouté aux favoris', 'right');
          } else {
            // Swipe gauche - supprimer/masquer
            card.classList.add('swiped-left');
            this.callbacks.onSwipeMatch({
              matchId: matchId,
              direction: 'left',
              action: 'dismiss',
              element: card
            });

            this.showSwipeFeedback(card, '🗑️ Masqué', 'left');
          }

          // Supprime la carte après l'animation
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }

        isSwiping = false;
      }, { passive: true });
    });
  }

  /**
   * Affiche un feedback visuel après le swipe
   */
  showSwipeFeedback(card, message, direction) {
    const feedback = document.createElement('div');
    feedback.className = 'swipe-feedback';
    feedback.textContent = message;
    feedback.style.cssText = `
      position: absolute;
      ${direction === 'right' ? 'right' : 'left'}: 20px;
      top: 50%;
      transform: translateY(-50%);
      background: ${direction === 'right' ? 'var(--primary-gradient)' : 'rgba(255, 100, 100, 0.9)'};
      color: ${direction === 'right' ? 'var(--bg-deep)' : '#fff'};
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      z-index: 10;
      animation: fadeInOut 2s ease forwards;
    `;

    card.style.position = 'relative';
    card.appendChild(feedback);

    setTimeout(() => {
      feedback.remove();
    }, 2000);
  }

  /**
   * Met à jour les callbacks
   */
  setCallbacks(newCallbacks) {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  /**
   * Détruit l'instance
   */
  destroy() {
    if (this.pullIndicator) {
      this.pullIndicator.remove();
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MobileGestures;
}

// Initialisation auto
if (typeof window !== 'undefined') {
  window.mobileGestures = new MobileGestures({
    onSwipeLeft: () => {
      // Swipe global gauche - navigation vers coupon
      window.location.href = '/coupon.html';
    },
    onSwipeRight: () => {
      // Swipe global droit - navigation vers mode d'emploi
      window.location.href = '/mode-emploi.html';
    },
    onPullToRefresh: () => {
      // Déclenche le refresh des données via intelligentCache
      if (window.intelligentCache) {
        window.intelligentCache.refreshData();
      }
      // Déclenche aussi l'event pour app.js
      window.dispatchEvent(new CustomEvent('fc25:manual-refresh'));
    },
    onDoubleTap: (data) => {
      if (data.type === 'match' && data.matchId) {
        // Navigation vers le détail du match
        window.location.href = `/match.html?id=${encodeURIComponent(data.matchId)}`;
      }
    },
    onSwipeMatch: (data) => {
      if (data.action === 'favorite' && data.matchId) {
        // Ajoute/retire des favoris via la fonction globale de app.js
        if (typeof toggleWatchlist === 'function') {
          toggleWatchlist(data.matchId);
          // Re-render pour refléter le changement
          if (typeof renderMatches === 'function') renderMatches();
          if (typeof renderWatchlistPanel === 'function') renderWatchlistPanel(window.allMatches);
        }
      } else if (data.action === 'dismiss' && data.matchId) {
        // Masque temporairement le match
        const card = data.element;
        if (card) {
          card.style.opacity = '0.3';
          card.dataset.dismissed = 'true';
        }
      }
    }
  });
}
