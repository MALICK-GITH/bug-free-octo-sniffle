// Enhanced Denicheur Interactive Features
class DenicheurEnhanced {
  constructor() {
    this.isActive = false;
    this.currentMatches = [];
    this.selectedMatches = new Set();
    this.filterSettings = {
      confidence: 50,
      oddsMin: 1.5,
      oddsMax: 3.5,
      leagues: [],
      timeWindow: 60
    };
    
    this.init();
  }

  init() {
    console.log('🎯 Enhanced Denicheur Initializing...');
    
    // Setup UI enhancements
    this.setupUIEnhancements();
    
    // Setup interactive features
    this.setupInteractiveFeatures();
    
    // Setup real-time updates
    this.setupRealTimeUpdates();
    
    // Setup filters
    this.setupFilters();
    
    // Setup animations
    this.setupAnimations();
    
    // Setup mobile optimizations
    this.setupMobileOptimizations();
    
    console.log('✅ Enhanced Denicheur Ready');
  }

  setupUIEnhancements() {
    // Enhanced CTA button
    const ctaBtn = document.getElementById('denicheurLaunchBtn');
    if (ctaBtn) {
      // Add loading state
      ctaBtn.addEventListener('click', (e) => {
        this.handleDenicheurLaunch(e);
      });
    }

    // Enhanced option checkbox
    const fullOption = document.getElementById('denicheurFullOption');
    if (fullOption) {
      fullOption.addEventListener('change', (e) => {
        this.handleFullOptionChange(e);
      });
    }

    // Add progress indicator
    this.addProgressIndicator();
    
    // Add stats display
    this.addStatsDisplay();
    
    // Add filter controls
    this.addFilterControls();
  }

  setupInteractiveFeatures() {
    // Setup match selection
    this.setupMatchSelection();
    
    // Setup match comparison
    this.setupMatchComparison();
    
    // Setup quick actions
    this.setupQuickActions();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup tooltips
    this.setupTooltips();
  }

  setupRealTimeUpdates() {
    // Setup live updates for matches
    this.setupLiveMatchUpdates();
    
    // Setup confidence updates
    this.setupConfidenceUpdates();
    
    // Setup odds updates
    this.setupOddsUpdates();
    
    // Setup countdown timers
    this.setupCountdownTimers();
  }

  setupFilters() {
    // Setup confidence filter
    this.setupConfidenceFilter();
    
    // Setup odds filter
    this.setupOddsFilter();
    
    // Setup league filter
    this.setupLeagueFilter();
    
    // Setup time filter
    this.setupTimeFilter();
    
    // Setup quick filters
    this.setupQuickFilters();
  }

  setupAnimations() {
    // Setup entrance animations
    this.setupEntranceAnimations();
    
    // Setup hover effects
    this.setupHoverEffects();
    
    // Setup loading animations
    this.setupLoadingAnimations();
    
    // Setup success animations
    this.setupSuccessAnimations();
  }

  setupMobileOptimizations() {
    // Setup touch gestures
    this.setupTouchGestures();
    
    // Setup swipe actions
    this.setupSwipeActions();
    
    // Setup pull-to-refresh
    this.setupPullToRefresh();
    
    // Setup haptic feedback
    this.setupHapticFeedback();
  }

  // UI Enhancement Methods
  addProgressIndicator() {
    const heroRow = document.querySelector('.denicheur-hero-row');
    if (!heroRow) return;

    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'denicheur-progress-indicator';
    progressIndicator.innerHTML = `
      <div class="progress-header">
        <span class="progress-title">Recherche en cours...</span>
        <span class="progress-percentage" id="progressPercentage">0%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="progress-details">
        <span class="progress-step" id="progressStep">Initialisation...</span>
        <span class="progress-time" id="progressTime">00:00</span>
      </div>
    `;

    heroRow.appendChild(progressIndicator);
    this.progressIndicator = progressIndicator;
    this.progressIndicator.style.display = 'none';
  }

  addStatsDisplay() {
    const finderSection = document.querySelector('.match-finder');
    if (!finderSection) return;

    const statsDisplay = document.createElement('div');
    statsDisplay.className = 'denicheur-stats-display';
    statsDisplay.innerHTML = `
      <div class="stats-header">
        <h3>Statistiques du Denicheur</h3>
        <button class="stats-toggle" id="statsToggle">📊</button>
      </div>
      <div class="stats-content" id="statsContent">
        <div class="stat-item">
          <span class="stat-label">Matchs analysés</span>
          <span class="stat-value" id="matchesAnalyzed">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Matchs qualifiés</span>
          <span class="stat-value" id="matchesQualified">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Confiance moyenne</span>
          <span class="stat-value" id="avgConfidence">0%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Temps de recherche</span>
          <span class="stat-value" id="searchTime">00:00</span>
        </div>
      </div>
    `;

    finderSection.insertBefore(statsDisplay, finderSection.querySelector('.finder-grid'));
    this.statsDisplay = statsDisplay;
  }

  addFilterControls() {
    const finderSection = document.querySelector('.match-finder');
    if (!finderSection) return;

    const filterControls = document.createElement('div');
    filterControls.className = 'denicheur-filter-controls';
    filterControls.innerHTML = `
      <div class="filter-header">
        <h3>Filtres avancés</h3>
        <button class="filter-toggle" id="filterToggle">🔍</button>
      </div>
      <div class="filter-content" id="filterContent">
        <div class="filter-group">
          <label class="filter-label">
            Confiance minimale
            <input type="range" id="confidenceFilter" min="0" max="100" value="50" step="5">
            <span class="filter-value" id="confidenceValue">50%</span>
          </label>
        </div>
        <div class="filter-group">
          <label class="filter-label">
            Cotes minimales
            <input type="range" id="oddsMinFilter" min="1" max="5" value="1.5" step="0.1">
            <span class="filter-value" id="oddsMinValue">1.5</span>
          </label>
        </div>
        <div class="filter-group">
          <label class="filter-label">
            Cotes maximales
            <input type="range" id="oddsMaxFilter" min="1" max="10" value="3.5" step="0.1">
            <span class="filter-value" id="oddsMaxValue">3.5</span>
          </label>
        </div>
        <div class="filter-group">
          <label class="filter-label">
            Fenêtre de temps (minutes)
            <input type="range" id="timeFilter" min="10" max="180" value="60" step="10">
            <span class="filter-value" id="timeValue">60</span>
          </label>
        </div>
        <div class="filter-actions">
          <button class="filter-btn primary" id="applyFilters">Appliquer</button>
          <button class="filter-btn" id="resetFilters">Réinitialiser</button>
        </div>
      </div>
    `;

    finderSection.insertBefore(filterControls, finderSection.querySelector('.finder-grid'));
    this.filterControls = filterControls;
    this.setupFilterEvents();
  }

  setupFilterEvents() {
    // Confidence filter
    const confidenceFilter = document.getElementById('confidenceFilter');
    const confidenceValue = document.getElementById('confidenceValue');
    if (confidenceFilter && confidenceValue) {
      confidenceFilter.addEventListener('input', (e) => {
        confidenceValue.textContent = `${e.target.value}%`;
      });
    }

    // Odds min filter
    const oddsMinFilter = document.getElementById('oddsMinFilter');
    const oddsMinValue = document.getElementById('oddsMinValue');
    if (oddsMinFilter && oddsMinValue) {
      oddsMinFilter.addEventListener('input', (e) => {
        oddsMinValue.textContent = e.target.value;
      });
    }

    // Odds max filter
    const oddsMaxFilter = document.getElementById('oddsMaxFilter');
    const oddsMaxValue = document.getElementById('oddsMaxValue');
    if (oddsMaxFilter && oddsMaxValue) {
      oddsMaxFilter.addEventListener('input', (e) => {
        oddsMaxValue.textContent = e.target.value;
      });
    }

    // Time filter
    const timeFilter = document.getElementById('timeFilter');
    const timeValue = document.getElementById('timeValue');
    if (timeFilter && timeValue) {
      timeFilter.addEventListener('input', (e) => {
        timeValue.textContent = `${e.target.value} min`;
      });
    }

    // Apply filters
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.applyFilters();
      });
    }

    // Reset filters
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetFilters();
      });
    }

    // Toggle filters
    const filterToggle = document.getElementById('filterToggle');
    const filterContent = document.getElementById('filterContent');
    if (filterToggle && filterContent) {
      filterToggle.addEventListener('click', () => {
        filterContent.style.display = filterContent.style.display === 'none' ? 'block' : 'none';
      });
    }
  }

  // Event Handlers
  async handleDenicheurLaunch(e) {
    const btn = e.target;
    
    if (btn.disabled) return;
    
    // Disable button
    btn.disabled = true;
    btn.textContent = 'Recherche en cours...';
    
    // Show progress
    this.showProgress();
    
    try {
      // Start denicheur process
      await this.startDenicheurProcess();
      
      // Show results
      this.showResults();
      
    } catch (error) {
      console.error('Denicheur error:', error);
      this.showError(error.message);
    } finally {
      // Re-enable button
      btn.disabled = false;
      btn.textContent = 'Lancer le denicheur (match ~10 min)';
      
      // Hide progress
      this.hideProgress();
    }
  }

  handleFullOptionChange(e) {
    const isFullMode = e.target.checked;
    
    // Update UI based on mode
    const hint = document.querySelector('.denicheur-hero-hint');
    if (hint) {
      if (isFullMode) {
        hint.textContent = 'Mode strict activé: recherche uniquement des matchs avec fiabilité maximale, liquidité élevée et cotes stables.';
        hint.style.borderColor = '#42f56c';
      } else {
        hint.textContent = 'Mode standard: recherche équilibrée avec assouplissements pour plus d\'opportunités.';
        hint.style.borderColor = '#3be7ff';
      }
    }
    
    // Update filter settings
    this.filterSettings.strictMode = isFullMode;
    
    // Apply new settings
    this.applyFilters();
  }

  // Denicheur Process
  async startDenicheurProcess() {
    console.log('🎯 Starting denicheur process...');
    
    const startTime = Date.now();
    let progress = 0;
    
    // Step 1: Initialize
    this.updateProgress(10, 'Initialisation de la recherche...');
    await this.delay(500);
    
    // Step 2: Fetch matches
    this.updateProgress(20, 'Récupération des matchs...');
    const matches = await this.fetchMatches();
    this.updateProgress(40, `${matches.length} matchs trouvés`);
    await this.delay(500);
    
    // Step 3: Analyze matches
    this.updateProgress(60, 'Analyse des matchs...');
    const analyzedMatches = await this.analyzeMatches(matches);
    this.updateProgress(80, `${analyzedMatches.length} matchs analysés`);
    await this.delay(500);
    
    // Step 4: Apply filters
    this.updateProgress(90, 'Application des filtres...');
    const filteredMatches = this.filterMatches(analyzedMatches);
    await this.delay(500);
    
    // Step 5: Generate results
    this.updateProgress(100, 'Génération des résultats...');
    this.currentMatches = filteredMatches;
    
    const endTime = Date.now();
    const searchTime = Math.round((endTime - startTime) / 1000);
    
    // Update stats
    this.updateStats({
      matchesAnalyzed: matches.length,
      matchesQualified: filteredMatches.length,
      avgConfidence: this.calculateAvgConfidence(filteredMatches),
      searchTime: searchTime
    });
    
    console.log(`✅ Denicheur completed: ${filteredMatches.length} qualified matches in ${searchTime}s`);
    
    return filteredMatches;
  }

  async fetchMatches() {
    try {
      const response = await fetch('/api/matches/upcoming');
      const data = await response.json();
      return data.matches || [];
    } catch (error) {
      console.error('Failed to fetch matches:', error);
      return [];
    }
  }

  async analyzeMatches(matches) {
    // Simulate analysis with enhanced scoring
    return matches.map(match => ({
      ...match,
      confidence: this.calculateConfidence(match),
      value: this.calculateValue(match),
      risk: this.calculateRisk(match),
      liquidity: this.calculateLiquidity(match),
      stability: this.calculateStability(match)
    }));
  }

  filterMatches(matches) {
    return matches.filter(match => {
      // Apply confidence filter
      if (match.confidence < this.filterSettings.confidence) return false;
      
      // Apply odds filters
      const avgOdds = this.calculateAverageOdds(match);
      if (avgOdds < this.filterSettings.oddsMin || avgOdds > this.filterSettings.oddsMax) return false;
      
      // Apply time filter
      const minutesToStart = this.getMinutesToStart(match);
      if (minutesToStart > this.filterSettings.timeWindow) return false;
      
      // Apply strict mode filters
      if (this.filterSettings.strictMode) {
        if (match.liquidity < 80) return false;
        if (match.stability < 75) return false;
        if (match.risk > 30) return false;
      }
      
      return true;
    });
  }

  // Utility Methods
  calculateConfidence(match) {
    // Enhanced confidence calculation
    let confidence = 50;
    
    // Base confidence from API
    if (match.confiance) {
      confidence += match.confiance * 0.3;
    }
    
    // Time factor
    const minutesToStart = this.getMinutesToStart(match);
    if (minutesToStart >= 10 && minutesToStart <= 60) {
      confidence += 15;
    } else if (minutesToStart >= 5 && minutesToStart <= 120) {
      confidence += 10;
    }
    
    // Odds stability
    const odds = this.extractOdds(match);
    const oddsVariance = this.calculateOddsVariance(odds);
    if (oddsVariance < 0.05) {
      confidence += 10;
    }
    
    return Math.min(99, Math.round(confidence));
  }

  calculateValue(match) {
    const odds = this.extractOdds(match);
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    const confidence = this.calculateConfidence(match) / 100;
    
    return Math.round((avgOdds * confidence - 1) * 100);
  }

  calculateRisk(match) {
    let risk = 20;
    
    // Time risk
    const minutesToStart = this.getMinutesToStart(match);
    if (minutesToStart < 10) risk += 20;
    else if (minutesToStart < 30) risk += 10;
    
    // Odds risk
    const odds = this.extractOdds(match);
    const oddsVariance = this.calculateOddsVariance(odds);
    risk += oddsVariance * 100;
    
    // League risk
    if (match.league && match.league.includes('lower')) {
      risk += 15;
    }
    
    return Math.min(80, Math.round(risk));
  }

  calculateLiquidity(match) {
    // Simulate liquidity calculation
    let liquidity = 70;
    
    // League factor
    if (match.league && match.league.includes('premier')) {
      liquidity += 20;
    } else if (match.league && match.league.includes('championship')) {
      liquidity += 10;
    }
    
    // Time factor
    const minutesToStart = this.getMinutesToStart(match);
    if (minutesToStart >= 30 && minutesToStart <= 90) {
      liquidity += 10;
    }
    
    return Math.min(95, liquidity);
  }

  calculateStability(match) {
    // Simulate stability calculation
    let stability = 75;
    
    // Odds stability
    const odds = this.extractOdds(match);
    const oddsVariance = this.calculateOddsVariance(odds);
    if (oddsVariance < 0.02) {
      stability += 15;
    } else if (oddsVariance < 0.05) {
      stability += 5;
    }
    
    // Time stability
    const minutesToStart = this.getMinutesToStart(match);
    if (minutesToStart >= 20 && minutesToStart <= 60) {
      stability += 10;
    }
    
    return Math.min(95, stability);
  }

  calculateAverageOdds(match) {
    const odds = this.extractOdds(match);
    return odds.reduce((a, b) => a + b, 0) / odds.length;
  }

  calculateOddsVariance(odds) {
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    const variance = odds.reduce((sum, odd) => sum + Math.pow(odd - avgOdds, 2), 0) / odds.length;
    return Math.sqrt(variance) / avgOdds;
  }

  calculateAvgConfidence(matches) {
    if (!matches.length) return 0;
    const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0);
    return Math.round(totalConfidence / matches.length);
  }

  getMinutesToStart(match) {
    const startTime = match.startTimeUnix || match.startTime;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, Math.floor((startTime - now) / 60));
  }

  extractOdds(match) {
    const odds = [];
    if (match.odd1) odds.push(match.odd1);
    if (match.odd2) odds.push(match.odd2);
    if (match.oddX) odds.push(match.oddX);
    return odds.filter(o => o && o > 1);
  }

  // UI Methods
  showProgress() {
    if (this.progressIndicator) {
      this.progressIndicator.style.display = 'block';
      this.progressIndicator.classList.add('slide-in');
    }
  }

  hideProgress() {
    if (this.progressIndicator) {
      this.progressIndicator.classList.add('slide-out');
      setTimeout(() => {
        this.progressIndicator.style.display = 'none';
        this.progressIndicator.classList.remove('slide-in', 'slide-out');
      }, 300);
    }
  }

  updateProgress(percentage, step) {
    if (!this.progressIndicator) return;
    
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStep = document.getElementById('progressStep');
    const progressTime = document.getElementById('progressTime');
    
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
    if (progressStep) progressStep.textContent = step;
    if (progressTime) {
      const elapsed = Math.floor((Date.now() - this.progressStartTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      progressTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  showResults() {
    // Display results in finder grid
    const finderGrid = document.getElementById('finderGrid');
    if (!finderGrid) return;
    
    finderGrid.innerHTML = '';
    
    this.currentMatches.forEach((match, index) => {
      const matchElement = this.createMatchElement(match, index);
      finderGrid.appendChild(matchElement);
    });
    
    // Update badge
    const finderBadge = document.getElementById('finderBadge');
    if (finderBadge) {
      finderBadge.textContent = `${this.currentMatches.length} matchs`;
    }
    
    // Animate results
    this.animateResults();
  }

  createMatchElement(match, index) {
    const element = document.createElement('div');
    element.className = 'denicheur-match-block';
    element.innerHTML = `
      <div class="denicheur-match-teams">${match.teamHome} vs ${match.teamAway}</div>
      <div class="denicheur-match-details">
        <div class="denicheur-match-detail">
          <strong>Ligue:</strong> ${match.league || 'N/A'}
        </div>
        <div class="denicheur-match-detail">
          <strong>Début:</strong> ${this.formatTime(match.startTimeUnix)}
        </div>
        <div class="denicheur-match-detail">
          <strong>Confiance:</strong> ${match.confidence}%
        </div>
        <div class="denicheur-match-detail">
          <strong>Valeur:</strong> ${match.value}%
        </div>
      </div>
      <div class="denicheur-match-odds">
        ${this.extractOdds(match).map(odd => `<span class="denicheur-odd">${odd.toFixed(2)}</span>`).join('')}
      </div>
      <div class="denicheur-match-confidence">
        <div class="denicheur-confidence-label">Indice de confiance</div>
        <div class="denicheur-confidence-value">${match.confidence}%</div>
      </div>
      <div class="denicheur-match-actions">
        <button class="denicheur-action-btn" onclick="window.denicheurEnhanced.selectMatch(${index})">Sélectionner</button>
        <button class="denicheur-action-btn primary" onclick="window.denicheurEnhanced.analyzeMatch(${index})">Analyser</button>
      </div>
    `;
    
    return element;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  animateResults() {
    const matches = document.querySelectorAll('.denicheur-match-block');
    matches.forEach((match, index) => {
      setTimeout(() => {
        match.classList.add('fade-in');
      }, index * 100);
    });
  }

  updateStats(stats) {
    const elements = {
      matchesAnalyzed: document.getElementById('matchesAnalyzed'),
      matchesQualified: document.getElementById('matchesQualified'),
      avgConfidence: document.getElementById('avgConfidence'),
      searchTime: document.getElementById('searchTime')
    };
    
    Object.entries(elements).forEach(([key, element]) => {
      if (element && stats[key] !== undefined) {
        element.textContent = key === 'searchTime' ? 
          `${stats[key]}s` : 
          stats[key];
      }
    });
  }

  showError(message) {
    // Show error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'denicheur-error';
    errorDiv.innerHTML = `
      <div class="error-content">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${message}</span>
        <button class="error-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }

  // Filter Methods
  applyFilters() {
    if (this.currentMatches.length === 0) return;
    
    const filtered = this.filterMatches(this.currentMatches);
    this.showFilteredResults(filtered);
  }

  resetFilters() {
    // Reset filter values
    this.filterSettings = {
      confidence: 50,
      oddsMin: 1.5,
      oddsMax: 3.5,
      leagues: [],
      timeWindow: 60,
      strictMode: this.filterSettings.strictMode
    };
    
    // Reset UI
    const confidenceFilter = document.getElementById('confidenceFilter');
    const oddsMinFilter = document.getElementById('oddsMinFilter');
    const oddsMaxFilter = document.getElementById('oddsMaxFilter');
    const timeFilter = document.getElementById('timeFilter');
    
    if (confidenceFilter) {
      confidenceFilter.value = 50;
      document.getElementById('confidenceValue').textContent = '50%';
    }
    if (oddsMinFilter) {
      oddsMinFilter.value = 1.5;
      document.getElementById('oddsMinValue').textContent = '1.5';
    }
    if (oddsMaxFilter) {
      oddsMaxFilter.value = 3.5;
      document.getElementById('oddsMaxValue').textContent = '3.5';
    }
    if (timeFilter) {
      timeFilter.value = 60;
      document.getElementById('timeValue').textContent = '60 min';
    }
    
    // Apply reset
    this.showResults();
  }

  showFilteredResults(matches) {
    const finderGrid = document.getElementById('finderGrid');
    if (!finderGrid) return;
    
    finderGrid.innerHTML = '';
    
    matches.forEach((match, index) => {
      const matchElement = this.createMatchElement(match, index);
      finderGrid.appendChild(matchElement);
    });
    
    // Update badge
    const finderBadge = document.getElementById('finderBadge');
    if (finderBadge) {
      finderBadge.textContent = `${matches.length} matchs (filtrés)`;
    }
  }

  // Interactive Methods
  selectMatch(index) {
    const match = this.currentMatches[index];
    if (!match) return;
    
    if (this.selectedMatches.has(index)) {
      this.selectedMatches.delete(index);
    } else {
      this.selectedMatches.add(index);
    }
    
    // Update UI
    this.updateSelectionUI();
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  analyzeMatch(index) {
    const match = this.currentMatches[index];
    if (!match) return;
    
    // Show detailed analysis
    this.showMatchAnalysis(match);
  }

  showMatchAnalysis(match) {
    // Create analysis modal
    const modal = document.createElement('div');
    modal.className = 'denicheur-analysis-modal';
    modal.innerHTML = `
      <div class="analysis-content">
        <div class="analysis-header">
          <h3>Analyse détaillée</h3>
          <button class="analysis-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="analysis-body">
          <div class="analysis-teams">${match.teamHome} vs ${match.teamAway}</div>
          <div class="analysis-grid">
            <div class="analysis-item">
              <span class="analysis-label">Confiance</span>
              <span class="analysis-value">${match.confidence}%</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">Valeur</span>
              <span class="analysis-value">${match.value}%</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">Risque</span>
              <span class="analysis-value">${match.risk}%</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">Liquidité</span>
              <span class="analysis-value">${match.liquidity}%</span>
            </div>
            <div class="analysis-item">
              <span class="analysis-label">Stabilité</span>
              <span class="analysis-value">${match.stability}%</span>
            </div>
          </div>
          <div class="analysis-recommendation">
            <div class="recommendation-label">Recommandation</div>
            <div class="recommendation-value">${this.getRecommendation(match)}</div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  getRecommendation(match) {
    if (match.confidence >= 80 && match.risk <= 20) {
      return '⭐ Fortement recommandé';
    } else if (match.confidence >= 70 && match.risk <= 30) {
      return '✅ Recommandé';
    } else if (match.confidence >= 60 && match.risk <= 40) {
      return '⚠️ À considérer';
    } else {
      return '❌ Non recommandé';
    }
  }

  updateSelectionUI() {
    const matches = document.querySelectorAll('.denicheur-match-block');
    matches.forEach((match, index) => {
      if (this.selectedMatches.has(index)) {
        match.classList.add('selected');
      } else {
        match.classList.remove('selected');
      }
    });
  }

  // Utility Methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize enhanced denicheur
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.denicheurEnhanced = new DenicheurEnhanced();
    });
  } else {
    window.denicheurEnhanced = new DenicheurEnhanced();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DenicheurEnhanced;
}
