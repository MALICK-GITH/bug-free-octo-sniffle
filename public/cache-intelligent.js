/**
 * SOLITFIFPRO225 - Cache Intelligent System
 * Refresh auto toutes les 5 minutes + Indicateur "Live"
 */

class IntelligentCache {
  constructor(options = {}) {
    this.refreshInterval = options.refreshInterval || 5 * 60 * 1000; // 5 minutes
    this.cacheKey = options.cacheKey || 'solitfifpro_matches_cache';
    this.version = options.version || '1.0';

    this.cache = {
      data: null,
      timestamp: null,
      version: this.version
    };

    this.refreshTimer = null;
    this.isRefreshing = false;
    this.changeIndicators = new Map(); // Stocke les indicateurs de changement

    this.init();
  }

  init() {
    this.loadFromStorage();
    this.createLiveIndicator();
    this.startAutoRefresh();
    this.setupVisibilityChange();
  }

  /**
   * Crée l'indicateur "Live" dans l'interface
   */
  createLiveIndicator() {
    // Cherche si l'indicateur existe déjà
    if (document.querySelector('.live-indicator')) return;

    const indicator = document.createElement('div');
    indicator.className = 'live-indicator';
    indicator.innerHTML = `
      <span class="live-pulse"></span>
      <span class="live-text">Live</span>
      <span class="last-update">Mis à jour: --:--</span>
    `;
    indicator.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(0, 242, 122, 0.1);
      border: 1px solid rgba(0, 242, 122, 0.3);
      border-radius: 20px;
      font-size: 0.85rem;
      color: var(--text-accent);
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 1000;
      backdrop-filter: blur(10px);
    `;

    // Ajoute les styles CSS
    const styles = document.createElement('style');
    styles.textContent = `
      .live-indicator .live-pulse {
        width: 8px;
        height: 8px;
        background: var(--primary-light);
        border-radius: 50%;
        animation: livePulse 2s infinite;
      }
      
      @keyframes livePulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
      }
      
      .live-indicator.refreshing .live-pulse {
        animation: spin 1s linear infinite;
        border-radius: 0;
        background: transparent;
        border: 2px solid var(--primary-light);
        border-top-color: transparent;
        width: 12px;
        height: 12px;
      }
      
      .live-indicator .last-update {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-left: 4px;
      }
      
      .live-indicator .live-text {
        font-weight: 600;
      }
      
      /* Indicateurs de changement de côtes */
      .odd-change-up {
        animation: changeUp 2s ease;
      }
      
      .odd-change-down {
        animation: changeDown 2s ease;
      }
      
      @keyframes changeUp {
        0%, 100% { background: inherit; }
        50% { background: rgba(0, 242, 122, 0.3); }
      }
      
      @keyframes changeDown {
        0%, 100% { background: inherit; }
        50% { background: rgba(255, 100, 100, 0.3); }
      }
    `;
    document.head.appendChild(styles);

    document.body.appendChild(indicator);
    this.liveIndicator = indicator;
  }

  /**
   * Met à jour l'heure de dernière mise à jour
   */
  updateLastUpdateTime() {
    if (!this.liveIndicator) return;

    const lastUpdate = this.liveIndicator.querySelector('.last-update');
    if (lastUpdate) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      lastUpdate.textContent = `Mis à jour: ${timeStr}`;
    }
  }

  /**
   * Démarre le refresh automatique
   */
  startAutoRefresh() {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Refresh toutes les 5 minutes
    this.refreshTimer = setInterval(() => {
      this.refreshData();
    }, this.refreshInterval);

    // Premier refresh après 30 secondes
    setTimeout(() => this.refreshData(), 30000);
  }

  /**
   * Arrête le refresh automatique
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Rafraîchit les données
   */
  async refreshData() {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.showRefreshingState();

    try {
      // Récupère les nouvelles données
      const newData = await this.fetchData();

      // Compare avec les anciennes données
      const changes = this.detectChanges(this.cache.data, newData);

      // Met à jour le cache
      this.cache.data = newData;
      this.cache.timestamp = Date.now();
      this.saveToStorage();

      // Met à jour l'UI
      this.updateUI(newData, changes);
      this.updateLastUpdateTime();

      // Notifie les changements
      if (changes.length > 0) {
        this.notifyChanges(changes);
      }

    } catch (error) {
      console.error('Erreur lors du refresh:', error);
    } finally {
      this.isRefreshing = false;
      this.hideRefreshingState();
    }
  }

  /**
   * Récupère les données depuis l'API réelle /api/matches
   */
  async fetchData() {
    try {
      const res = await fetch('/api/matches', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.error?.details || data?.message || 'API Error');
      }
      const payload = data?.data && typeof data.data === 'object' ? data.data : data;
      return Array.isArray(payload?.matches) ? payload.matches : Array.isArray(data?.matches) ? data.matches : [];
    } catch (error) {
      console.warn('IntelligentCache: Erreur fetch, utilisation cache:', error);
      return this.cache.data || [];
    }
  }

  /**
   * Détecte les changements entre anciennes et nouvelles données
   */
  detectChanges(oldData, newData) {
    const changes = [];

    if (!oldData || !newData) return changes;

    newData.forEach(newMatch => {
      const oldMatch = oldData.find(m => m.id === newMatch.id);

      if (oldMatch) {
        const newOdds = newMatch.odds1x2 || {};
        const oldOdds = oldMatch.odds1x2 || {};

        // Compare les côtes 1X2
        ['home', 'draw', 'away'].forEach(type => {
          const newVal = Number(newOdds[type]);
          const oldVal = Number(oldOdds[type]);

          if (newVal && oldVal && Math.abs(newVal - oldVal) > 0.001) {
            changes.push({
              matchId: newMatch.id,
              type: 'odd',
              oddType: type,
              oldValue: oldVal,
              newValue: newVal,
              direction: newVal > oldVal ? 'up' : 'down'
            });
          }
        });

        // Compare le score si match en cours
        const newScore = JSON.stringify(newMatch.score);
        const oldScore = JSON.stringify(oldMatch.score);
        if (newScore !== oldScore) {
          changes.push({
            matchId: newMatch.id,
            type: 'score',
            oldValue: oldMatch.score,
            newValue: newMatch.score
          });
        }
      }
    });

    return changes;
  }

  /**
   * Met à jour l'interface utilisateur
   */
  updateUI(data, changes) {
    // Déclenche l'événement pour app.js
    window.dispatchEvent(new CustomEvent('fc25:matches-refreshed', {
      detail: { matches: data, changes, source: 'intelligentCache' }
    }));

    // Affiche les changements de côtes
    changes.forEach(change => {
      this.showChangeIndicator(change);
    });
  }

  /**
   * Affiche un indicateur visuel de changement
   */
  showChangeIndicator(change) {
    if (change.type !== 'odd') return;

    // Trouve la carte par ID dans les liens de détail
    const allCards = document.querySelectorAll('.match-card');
    let targetCard = null;

    allCards.forEach(card => {
      const detailLink = card.querySelector('.detail-btn');
      if (detailLink && detailLink.href.includes(change.matchId)) {
        targetCard = card;
      }
    });

    if (!targetCard) return;

    const index = change.oddType === 'home' ? 0 : change.oddType === 'draw' ? 1 : 2;
    const oddBoxes = targetCard.querySelectorAll('.odd-box');
    const oddBox = oddBoxes[index];

    if (oddBox) {
      const direction = change.direction === 'up' ? 'odd-change-up' : 'odd-change-down';
      oddBox.classList.add(direction);
      const valueElement = oddBox.querySelector('strong');
      if (valueElement) valueElement.textContent = change.newValue.toFixed(3);
      setTimeout(() => oddBox.classList.remove(direction), 2000);
    }
  }

  /**
   * Notifie les changements
   */
  notifyChanges(changes) {
    const oddChanges = changes.filter(c => c.type === 'odd');

    if (oddChanges.length > 0 && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('ONE-DELUX', {
          body: `${oddChanges.length} côte(s) mise(s) à jour`,
          icon: '/icon-192.svg'
        });
      }
    }
  }

  /**
   * Affiche l'état de rafraîchissement
   */
  showRefreshingState() {
    if (this.liveIndicator) {
      this.liveIndicator.classList.add('refreshing');
      const text = this.liveIndicator.querySelector('.live-text');
      if (text) text.textContent = 'Mise à jour...';
    }
  }

  /**
   * Cache l'état de rafraîchissement
   */
  hideRefreshingState() {
    if (this.liveIndicator) {
      this.liveIndicator.classList.remove('refreshing');
      const text = this.liveIndicator.querySelector('.live-text');
      if (text) text.textContent = 'Live';
    }
  }

  /**
   * Sauvegarde le cache dans localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
    } catch (e) {
      console.warn('Impossible de sauvegarder le cache:', e);
    }
  }

  /**
   * Charge le cache depuis localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.cacheKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Vérifie la version
        if (parsed.version === this.version) {
          this.cache = parsed;
          return true;
        }
      }
    } catch (e) {
      console.warn('Impossible de charger le cache:', e);
    }
    return false;
  }

  /**
   * Vérifie si le cache est valide
   */
  isCacheValid(maxAge = 10 * 60 * 1000) {
    if (!this.cache.timestamp) return false;
    const age = Date.now() - this.cache.timestamp;
    return age < maxAge;
  }

  /**
   * Récupère les données du cache
   */
  getData() {
    return this.cache.data;
  }

  /**
   * Vide le cache
   */
  clearCache() {
    this.cache = {
      data: null,
      timestamp: null,
      version: this.version
    };
    localStorage.removeItem(this.cacheKey);
  }

  /**
   * Gère le changement de visibilité de la page
   */
  setupVisibilityChange() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Page cachée - arrête le refresh
        this.stopAutoRefresh();
      } else {
        // Page visible - redémarre le refresh
        this.startAutoRefresh();
        // Vérifie si le cache est vieux
        if (!this.isCacheValid()) {
          this.refreshData();
        }
      }
    });
  }

  /**
   * Demande la permission pour les notifications
   */
  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * Détruit l'instance proprement
   */
  destroy() {
    this.stopAutoRefresh();
    if (this.liveIndicator) {
      this.liveIndicator.remove();
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntelligentCache;
}

// Initialisation auto
if (typeof window !== 'undefined') {
  window.intelligentCache = new IntelligentCache();
}
