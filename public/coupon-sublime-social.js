/**
 * COUP SUBLIME - Social & Community Module
 * Leaderboard, Achievements, Strategy Sharing
 * SOLITAIRE HACK SIGNATURE
 */

class SublimeSocial {
  constructor() {
    this.currentPeriod = 'week';
    this.leaderboardData = [];
    this.userAchievements = [];
    this.strategies = [];
    
    this.init();
  }

  init() {
    this.generateMockData();
    this.setupEventListeners();
    this.renderLeaderboard();
    this.renderAchievements();
    this.renderStrategies();
  }

  generateMockData() {
    // Leaderboard data
    this.leaderboardData = [
      { name: 'PredictionMaster', wins: 45, roi: 156.8, score: 4520 },
      { name: 'LionKing225', wins: 42, roi: 142.3, score: 4180 },
      { name: 'SportPro123', wins: 38, roi: 138.5, score: 3850 },
      { name: 'AbidjanWinner', wins: 35, roi: 125.2, score: 3520 },
      { name: 'FIFAXpert', wins: 32, roi: 118.9, score: 3210 },
      { name: 'BetGuru99', wins: 30, roi: 112.4, score: 2980 },
      { name: 'GoldPredictor', wins: 28, roi: 108.7, score: 2760 },
      { name: 'You', wins: 12, roi: 45.2, score: 1240, isUser: true }
    ];

    // User achievements
    this.userAchievements = [
      { id: 1, icon: '🎯', name: 'Premier Coupon', unlocked: true, desc: 'Genere votre premier coupon' },
      { id: 2, icon: '🔥', name: 'Serie Gagnante', unlocked: true, desc: '3 victoires consecutives' },
      { id: 3, icon: '💎', name: 'Maitre Predictor', unlocked: false, desc: '50 predictions avec 70%+ reussite' },
      { id: 4, icon: '👑', name: 'Legende', unlocked: false, desc: 'Top 3 du classement mondial' },
      { id: 5, icon: '🚀', name: 'High Roller', unlocked: false, desc: 'Mise totale > 100K FCFA' },
      { id: 6, icon: '📊', name: 'Analyste', unlocked: false, desc: '100 analyses effectuees' },
      { id: 7, icon: '🌍', name: 'Global', unlocked: false, desc: 'Predictions sur 5 ligues differentes' },
      { id: 8, icon: '⚡', name: 'Eclair', unlocked: true, desc: 'Generation en moins de 2 secondes' }
    ];

    // Strategies
    this.strategies = [
      { 
        id: 1, 
        author: 'PredictionMaster', 
        avatar: 'PM',
        title: 'Safe & Steady', 
        desc: 'Mise sur les favoris avec cotes 1.2-1.5',
        likes: 245,
        copies: 89,
        winRate: 78.5
      },
      { 
        id: 2, 
        author: 'LionKing225', 
        avatar: 'LK',
        title: 'Aggressive Growth', 
        desc: 'Combinaisons risquees pour gains max',
        likes: 189,
        copies: 67,
        winRate: 45.2
      },
      { 
        id: 3, 
        author: 'SportPro123', 
        avatar: 'SP',
        title: 'Balanced Approach', 
        desc: 'Mix safe/aggressive 60/40',
        likes: 167,
        copies: 54,
        winRate: 62.8
      },
      { 
        id: 4, 
        author: 'AbidjanWinner', 
        avatar: 'AW',
        title: 'Underdog Hunter', 
        desc: 'Detecte les cotes sous-estimees',
        likes: 134,
        copies: 42,
        winRate: 55.3
      }
    ];
  }

  setupEventListeners() {
    // Period tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentPeriod = btn.dataset.period;
        this.renderLeaderboard();
      });
    });

    // Share strategy button
    document.getElementById('shareStrategyBtn')?.addEventListener('click', () => {
      this.shareStrategy();
    });
  }

  renderLeaderboard() {
    const container = document.getElementById('leaderboardList');
    if (!container) return;

    // Sort by score
    const sorted = [...this.leaderboardData].sort((a, b) => b.score - a.score);

    container.innerHTML = sorted.map((player, index) => `
      <div class="leaderboard-item ${player.isUser ? 'user-item' : ''}">
        <div class="leaderboard-rank">${index + 1}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${player.name} ${player.isUser ? '(Vous)' : ''}</div>
          <div class="leaderboard-stats">${player.wins} victoires • ROI ${player.roi}%</div>
        </div>
        <div class="leaderboard-score">${player.score.toLocaleString()} pts</div>
      </div>
    `).join('');
  }

  renderAchievements() {
    const container = document.getElementById('achievementsGrid');
    if (!container) return;

    container.innerHTML = this.userAchievements.map(ach => `
      <div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}" title="${ach.desc}">
        <div class="achievement-icon">${ach.icon}</div>
        <span class="achievement-name">${ach.name}</span>
      </div>
    `).join('');
  }

  renderStrategies() {
    const container = document.getElementById('strategiesList');
    if (!container) return;

    container.innerHTML = this.strategies.map(strat => `
      <div class="strategy-card" data-id="${strat.id}">
        <div class="strategy-avatar">${strat.avatar}</div>
        <div class="strategy-info">
          <div class="strategy-title">${strat.title}</div>
          <div class="strategy-meta">par ${strat.author} • ${strat.winRate}% win rate</div>
        </div>
        <div class="strategy-actions">
          <button class="strategy-btn like-btn" data-id="${strat.id}" title="J'aime">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          <button class="strategy-btn copy-btn" data-id="${strat.id}" title="Copier">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners for strategy buttons
    container.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        this.likeStrategy(id);
      });
    });

    container.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        this.copyStrategy(id);
      });
    });
  }

  likeStrategy(id) {
    const strat = this.strategies.find(s => s.id === id);
    if (strat) {
      strat.likes++;
      this.showToast(`Strategy "${strat.title}" aimee!`, 'success');
    }
  }

  copyStrategy(id) {
    const strat = this.strategies.find(s => s.id === id);
    if (strat) {
      strat.copies++;
      this.showToast(`Strategy "${strat.title}" copiee!`, 'success');
    }
  }

  shareStrategy() {
    const userStrat = {
      id: Date.now(),
      author: 'You',
      avatar: 'YO',
      title: 'Ma Strategie Personnalisee',
      desc: 'Basee sur mes analyses recentes',
      likes: 0,
      copies: 0,
      winRate: 0
    };

    this.strategies.unshift(userStrat);
    this.renderStrategies();
    this.showToast('Votre strategie a ete partagee!', 'success');
  }

  showToast(message, type = 'info') {
    if (window.sublimeApp) {
      window.sublimeApp.showToast(message, type);
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.sublimeSocial = new SublimeSocial();
});

window.SublimeSocial = SublimeSocial;
