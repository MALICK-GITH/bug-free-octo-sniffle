// Advanced Search and Filter System - Integrated Design
class MatchAdvancedSearch {
  constructor() {
    this.searchHistory = [];
    this.filters = {
      leagues: [],
      oddsRange: { min: 1.0, max: 10.0 },
      confidenceRange: { min: 0, max: 100 },
      riskLevel: 'all',
      timeRange: 'all',
      matchStatus: 'all',
      valueRange: { min: 0, max: 100 }
    };
    this.sortOptions = {
      field: 'confidence',
      direction: 'desc'
    };
    
    this.init();
  }

  init() {
    console.log('🔍 Initializing Advanced Search...');
    this.setupSearchInterface();
    this.setupEventListeners();
    this.loadSearchHistory();
  }

  setupSearchInterface() {
    // Create advanced search panel
    const searchPanel = document.createElement('div');
    searchPanel.className = 'advanced-search-panel';
    searchPanel.innerHTML = `
      <div class="search-header">
        <div class="search-title">
          <h3>🔍 Recherche Avancée</h3>
          <button class="toggle-btn" id="toggleSearchBtn">
            <span class="toggle-icon">▼</span>
          </button>
        </div>
        <div class="search-actions">
          <button class="search-action-btn" id="saveSearchBtn" title="Sauvegarder la recherche">
            <span>💾</span>
          </button>
          <button class="search-action-btn" id="resetSearchBtn" title="Réinitialiser">
            <span>🔄</span>
          </button>
        </div>
      </div>
      
      <div class="search-content" id="searchContent">
        <div class="search-bar">
          <div class="search-input-container">
            <input 
              type="text" 
              id="searchInput" 
              placeholder="Rechercher des matchs, équipes, ligues..."
              autocomplete="off"
            >
            <button class="search-btn" id="performSearchBtn">
              <span>🔍</span>
            </button>
          </div>
          <div class="search-suggestions" id="searchSuggestions"></div>
        </div>

        <div class="filters-section">
          <div class="filter-group">
            <h4>📊 Filtres de Cotes</h4>
            <div class="range-filter">
              <label>Cotes minimales</label>
              <div class="range-inputs">
                <input type="number" id="minOdds" min="1.0" max="10.0" step="0.1" value="1.0">
                <span>-</span>
                <input type="number" id="maxOdds" min="1.0" max="10.0" step="0.1" value="10.0">
              </div>
              <div class="range-slider">
                <input type="range" id="oddsRangeSlider" min="1.0" max="10.0" step="0.1" value="5.5">
              </div>
            </div>
          </div>

          <div class="filter-group">
            <h4>🎯 Confiance et Valeur</h4>
            <div class="range-filter">
              <label>Confiance IA</label>
              <div class="range-inputs">
                <input type="number" id="minConfidence" min="0" max="100" value="0">
                <span>%</span>
                <input type="number" id="maxConfidence" min="0" max="100" value="100">
                <span>%</span>
              </div>
              <div class="range-slider">
                <input type="range" id="confidenceRangeSlider" min="0" max="100" value="50">
              </div>
            </div>
            <div class="range-filter">
              <label>Valeur potentielle</label>
              <div class="range-inputs">
                <input type="number" id="minValue" min="0" max="100" value="0">
                <span>%</span>
                <input type="number" id="maxValue" min="0" max="100" value="100">
                <span>%</span>
              </div>
            </div>
          </div>

          <div class="filter-group">
            <h4>⚡ Options Rapides</h4>
            <div class="quick-filters">
              <button class="quick-filter-btn" data-filter="high-value">
                💎 Haute valeur (>70%)
              </button>
              <button class="quick-filter-btn" data-filter="safe-bet">
                🛡️ Paris sûr (>80% confiance)
              </button>
              <button class="quick-filter-btn" data-filter="aggressive">
                🔥 Aggressif (cotes >3.0)
              </button>
              <button class="quick-filter-btn" data-filter="live">
                📡 En direct
              </button>
            </div>
          </div>

          <div class="filter-group">
            <h4>🏆 Ligues et Compétitions</h4>
            <div class="league-filters" id="leagueFilters">
              <div class="league-search">
                <input type="text" id="leagueSearchInput" placeholder="Rechercher une ligue...">
              </div>
              <div class="league-list" id="leagueList">
                <!-- Leagues will be populated dynamically -->
              </div>
            </div>
          </div>

          <div class="filter-group">
            <h4>📅 Temps et Statut</h4>
            <div class="time-filters">
              <select id="timeRange">
                <option value="all">Toutes les périodes</option>
                <option value="today">Aujourd'hui</option>
                <option value="tomorrow">Demain</option>
                <option value="week">Cette semaine</option>
                <option value="weekend">Week-end</option>
              </select>
              <select id="matchStatus">
                <option value="all">Tous les statuts</option>
                <option value="upcoming">À venir</option>
                <option value="live">En direct</option>
                <option value="finished">Terminés</option>
              </select>
            </div>
          </div>
        </div>

        <div class="sort-section">
          <h4>📋 Tri des Résultats</h4>
          <div class="sort-controls">
            <select id="sortField">
              <option value="confidence">Confiance IA</option>
              <option value="value">Valeur potentielle</option>
              <option value="odds">Cotes</option>
              <option value="time">Heure de début</option>
              <option value="league">Ligue</option>
            </select>
            <button class="sort-direction-btn" id="sortDirectionBtn">
              <span class="sort-icon">↓</span>
            </button>
          </div>
        </div>

        <div class="search-results">
          <div class="results-header">
            <h4>📊 Résultats de la recherche</h4>
            <div class="results-stats">
              <span id="resultsCount">0 matchs trouvés</span>
              <button class="export-results-btn" id="exportResultsBtn">
                📤 Exporter
              </button>
            </div>
          </div>
          <div class="results-list" id="resultsList">
            <!-- Search results will be displayed here -->
          </div>
        </div>
      </div>
    `;

    // Insert search panel at the top of the page
    const main = document.querySelector('main');
    if (main) {
      main.insertBefore(searchPanel, main.firstChild);
    }

    this.setupRangeSliders();
    this.populateLeagues();
  }

  setupEventListeners() {
    // Search toggle
    const toggleBtn = document.getElementById('toggleSearchBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSearchPanel());
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    const performSearchBtn = document.getElementById('performSearchBtn');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
      searchInput.addEventListener('keydown', (e) => this.handleSearchKeydown(e));
    }
    
    if (performSearchBtn) {
      performSearchBtn.addEventListener('click', () => this.performSearch());
    }

    // Filter inputs
    this.setupFilterListeners();

    // Quick filters
    document.querySelectorAll('.quick-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => this.applyQuickFilter(btn.dataset.filter));
    });

    // Sort controls
    const sortField = document.getElementById('sortField');
    const sortDirectionBtn = document.getElementById('sortDirectionBtn');
    
    if (sortField) {
      sortField.addEventListener('change', () => this.updateSort());
    }
    
    if (sortDirectionBtn) {
      sortDirectionBtn.addEventListener('click', () => this.toggleSortDirection());
    }

    // Action buttons
    const saveSearchBtn = document.getElementById('saveSearchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    
    if (saveSearchBtn) {
      saveSearchBtn.addEventListener('click', () => this.saveSearch());
    }
    
    if (resetSearchBtn) {
      resetSearchBtn.addEventListener('click', () => this.resetFilters());
    }
    
    if (exportResultsBtn) {
      exportResultsBtn.addEventListener('click', () => this.exportResults());
    }

    // League search
    const leagueSearchInput = document.getElementById('leagueSearchInput');
    if (leagueSearchInput) {
      leagueSearchInput.addEventListener('input', (e) => this.filterLeagues(e.target.value));
    }
  }

  setupFilterListeners() {
    // Range inputs
    const rangeInputs = ['minOdds', 'maxOdds', 'minConfidence', 'maxConfidence', 'minValue', 'maxValue'];
    rangeInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('change', () => this.updateFilters());
      }
    });

    // Range sliders
    const oddsSlider = document.getElementById('oddsRangeSlider');
    const confidenceSlider = document.getElementById('confidenceRangeSlider');
    
    if (oddsSlider) {
      oddsSlider.addEventListener('input', (e) => this.updateOddsRange(e.target.value));
    }
    
    if (confidenceSlider) {
      confidenceSlider.addEventListener('input', (e) => this.updateConfidenceRange(e.target.value));
    }

    // Select inputs
    const timeRange = document.getElementById('timeRange');
    const matchStatus = document.getElementById('matchStatus');
    
    if (timeRange) {
      timeRange.addEventListener('change', () => this.updateFilters());
    }
    
    if (matchStatus) {
      matchStatus.addEventListener('change', () => this.updateFilters());
    }
  }

  setupRangeSliders() {
    // Setup dual-handle range sliders for better UX
    this.setupDualRangeSlider('odds', 1.0, 10.0, 0.1);
    this.setupDualRangeSlider('confidence', 0, 100, 1);
  }

  setupDualRangeSlider(name, min, max, step) {
    // This would implement a dual-handle range slider
    // For now, using single slider with automatic range calculation
    console.log(`Setting up ${name} range slider: ${min}-${max} step ${step}`);
  }

  populateLeagues() {
    const leagueList = document.getElementById('leagueList');
    if (!leagueList) return;

    // Mock leagues data - replace with real data
    const leagues = [
      { name: 'Premier League', country: 'Angleterre', count: 10 },
      { name: 'La Liga', country: 'Espagne', count: 8 },
      { name: 'Bundesliga', country: 'Allemagne', count: 9 },
      { name: 'Serie A', country: 'Italie', count: 7 },
      { name: 'Ligue 1', country: 'France', count: 6 },
      { name: 'Eredivisie', country: 'Pays-Bas', count: 5 },
      { name: 'Primeira Liga', country: 'Portugal', count: 4 },
      { name: 'Champions League', country: 'Europe', count: 12 }
    ];

    leagueList.innerHTML = leagues.map(league => `
      <label class="league-checkbox">
        <input type="checkbox" value="${league.name}" data-count="${league.count}">
        <span class="league-info">
          <span class="league-name">${league.name}</span>
          <span class="league-country">${league.country}</span>
          <span class="league-count">${league.count} matchs</span>
        </span>
      </label>
    `).join('');

    // Add event listeners
    leagueList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateFilters());
    });
  }

  toggleSearchPanel() {
    const content = document.getElementById('searchContent');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (content.classList.contains('expanded')) {
      content.classList.remove('expanded');
      toggleIcon.textContent = '▼';
    } else {
      content.classList.add('expanded');
      toggleIcon.textContent = '▲';
    }
  }

  handleSearchInput(e) {
    const query = e.target.value.toLowerCase();
    const suggestions = document.getElementById('searchSuggestions');
    
    if (query.length < 2) {
      suggestions.innerHTML = '';
      return;
    }

    // Generate suggestions based on query
    const mockSuggestions = this.generateSuggestions(query);
    
    suggestions.innerHTML = mockSuggestions.map(suggestion => `
      <div class="suggestion-item" data-type="${suggestion.type}" data-value="${suggestion.value}">
        <span class="suggestion-icon">${suggestion.icon}</span>
        <span class="suggestion-text">${suggestion.text}</span>
        <span class="suggestion-meta">${suggestion.meta}</span>
      </div>
    `).join('');

    // Add click handlers
    suggestions.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('searchInput').value = item.dataset.value;
        suggestions.innerHTML = '';
        this.performSearch();
      });
    });
  }

  generateSuggestions(query) {
    // Mock suggestions - replace with real data
    const allSuggestions = [
      { type: 'team', value: 'Manchester United', text: 'Manchester United', icon: '⚽', meta: 'Premier League' },
      { type: 'team', value: 'Real Madrid', text: 'Real Madrid', icon: '⚽', meta: 'La Liga' },
      { type: 'league', value: 'Premier League', text: 'Premier League', icon: '🏆', meta: 'Angleterre' },
      { type: 'league', value: 'Champions League', text: 'Champions League', icon: '🏆', meta: 'Europe' },
      { type: 'match', value: 'Manchester vs Liverpool', text: 'Manchester vs Liverpool', icon: '🥊', meta: 'Aujourd\'hui 20:00' }
    ];

    return allSuggestions.filter(s => 
      s.text.toLowerCase().includes(query) || 
      s.value.toLowerCase().includes(query)
    ).slice(0, 5);
  }

  handleSearchKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.performSearch();
    } else if (e.key === 'Escape') {
      document.getElementById('searchSuggestions').innerHTML = '';
    }
  }

  async performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    
    if (!query && !this.hasActiveFilters()) {
      this.showNoResultsMessage();
      return;
    }

    console.log('🔍 Performing search:', query, this.filters);
    
    // Show loading state
    this.showSearchLoading();
    
    try {
      // Simulate search API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const results = this.generateSearchResults(query);
      this.displayResults(results);
      
      // Add to search history
      this.addToSearchHistory(query);
      
    } catch (error) {
      console.error('Search failed:', error);
      this.showSearchError(error.message);
    }
  }

  generateSearchResults(query) {
    // Mock search results - replace with real API call
    const mockResults = [
      {
        id: '1',
        teams: 'Manchester United vs Liverpool',
        league: 'Premier League',
        time: 'Aujourd\'hui 20:00',
        confidence: 85,
        value: 72,
        odds: { home: 2.10, draw: 3.40, away: 3.20 },
        risk: 'Moyen',
        status: 'upcoming'
      },
      {
        id: '2', 
        teams: 'Real Madrid vs Barcelona',
        league: 'La Liga',
        time: 'Demain 21:00',
        confidence: 78,
        value: 68,
        odds: { home: 1.85, draw: 3.60, away: 4.20 },
        risk: 'Faible',
        status: 'upcoming'
      },
      {
        id: '3',
        teams: 'Bayern Munich vs Dortmund',
        league: 'Bundesliga',
        time: 'Hier 18:30',
        confidence: 92,
        value: 85,
        odds: { home: 1.45, draw: 4.80, away: 6.50 },
        risk: 'Faible',
        status: 'finished'
      }
    ];

    // Filter results based on query and active filters
    return mockResults.filter(result => {
      const matchesQuery = !query || 
        result.teams.toLowerCase().includes(query.toLowerCase()) ||
        result.league.toLowerCase().includes(query.toLowerCase());
      
      const matchesFilters = this.matchesFilters(result);
      
      return matchesQuery && matchesFilters;
    });
  }

  matchesFilters(result) {
    // Check if result matches all active filters
    const { oddsRange, confidenceRange, valueRange, riskLevel, timeRange, matchStatus } = this.filters;
    
    // Odds filter
    const avgOdds = (result.odds.home + result.odds.draw + result.odds.away) / 3;
    if (avgOdds < oddsRange.min || avgOdds > oddsRange.max) return false;
    
    // Confidence filter
    if (result.confidence < confidenceRange.min || result.confidence > confidenceRange.max) return false;
    
    // Value filter
    if (result.value < valueRange.min || result.value > valueRange.max) return false;
    
    // Risk filter
    if (riskLevel !== 'all' && result.risk !== riskLevel) return false;
    
    // Status filter
    if (matchStatus !== 'all' && result.status !== matchStatus) return false;
    
    return true;
  }

  displayResults(results) {
    const resultsList = document.getElementById('resultsList');
    const resultsCount = document.getElementById('resultsCount');
    
    resultsCount.textContent = `${results.length} match${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}`;
    
    if (results.length === 0) {
      resultsList.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-text">Aucun résultat trouvé pour votre recherche</div>
          <div class="no-results-hint">Essayez d'ajuster vos filtres ou votre recherche</div>
        </div>
      `;
      return;
    }

    resultsList.innerHTML = results.map(result => `
      <div class="search-result-item" data-id="${result.id}">
        <div class="result-header">
          <h4 class="result-teams">${result.teams}</h4>
          <div class="result-league">${result.league}</div>
        </div>
        <div class="result-time">${result.time}</div>
        <div class="result-stats">
          <div class="result-stat">
            <span class="stat-label">Confiance</span>
            <span class="stat-value">${result.confidence}%</span>
          </div>
          <div class="result-stat">
            <span class="stat-label">Valeur</span>
            <span class="stat-value">${result.value}%</span>
          </div>
          <div class="result-stat">
            <span class="stat-label">Risque</span>
            <span class="stat-value risk-${result.risk.toLowerCase()}">${result.risk}</span>
          </div>
        </div>
        <div class="result-odds">
          <span class="odd-item">1: ${result.odds.home}</span>
          <span class="odd-item">X: ${result.odds.draw}</span>
          <span class="odd-item">2: ${result.odds.away}</span>
        </div>
        <div class="result-actions">
          <button class="result-action-btn" onclick="window.location.href='/match.html?id=${result.id}'">
            📊 Voir détails
          </button>
          <button class="result-action-btn" onclick="window.searchSystem.addToFavorites('${result.id}')">
            🔖 Favoris
          </button>
        </div>
      </div>
    `).join('');
  }

  applyQuickFilter(filterType) {
    console.log('⚡ Applying quick filter:', filterType);
    
    // Reset other filters first
    this.resetFilters();
    
    switch (filterType) {
      case 'high-value':
        this.filters.valueRange = { min: 70, max: 100 };
        this.filters.confidenceRange = { min: 60, max: 100 };
        break;
      case 'safe-bet':
        this.filters.confidenceRange = { min: 80, max: 100 };
        this.filters.riskLevel = 'Faible';
        break;
      case 'aggressive':
        this.filters.oddsRange = { min: 3.0, max: 10.0 };
        break;
      case 'live':
        this.filters.matchStatus = 'live';
        break;
    }
    
    this.updateFilterUI();
    this.performSearch();
  }

  updateFilterUI() {
    // Update UI to reflect current filters
    const minValue = document.getElementById('minValue');
    const maxValue = document.getElementById('maxValue');
    const minConfidence = document.getElementById('minConfidence');
    const maxConfidence = document.getElementById('maxConfidence');
    
    if (minValue) minValue.value = this.filters.valueRange.min;
    if (maxValue) maxValue.value = this.filters.valueRange.max;
    if (minConfidence) minConfidence.value = this.filters.confidenceRange.min;
    if (maxConfidence) maxConfidence.value = this.filters.confidenceRange.max;
  }

  updateFilters() {
    // Update filter values from UI
    this.filters.oddsRange = {
      min: parseFloat(document.getElementById('minOdds')?.value) || 1.0,
      max: parseFloat(document.getElementById('maxOdds')?.value) || 10.0
    };
    
    this.filters.confidenceRange = {
      min: parseInt(document.getElementById('minConfidence')?.value) || 0,
      max: parseInt(document.getElementById('maxConfidence')?.value) || 100
    };
    
    this.filters.valueRange = {
      min: parseInt(document.getElementById('minValue')?.value) || 0,
      max: parseInt(document.getElementById('maxValue')?.value) || 100
    };
    
    this.filters.timeRange = document.getElementById('timeRange')?.value || 'all';
    this.filters.matchStatus = document.getElementById('matchStatus')?.value || 'all';
    
    // Update selected leagues
    const selectedLeagues = Array.from(document.querySelectorAll('.league-checkbox input:checked'))
      .map(cb => cb.value);
    this.filters.leagues = selectedLeagues;
    
    // Auto-perform search with delay
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.performSearch(), 300);
  }

  updateOddsRange(value) {
    const mid = parseFloat(value);
    const range = 2.0;
    
    this.filters.oddsRange = {
      min: Math.max(1.0, mid - range),
      max: Math.min(10.0, mid + range)
    };
    
    document.getElementById('minOdds').value = this.filters.oddsRange.min.toFixed(1);
    document.getElementById('maxOdds').value = this.filters.oddsRange.max.toFixed(1);
    
    this.updateFilters();
  }

  updateConfidenceRange(value) {
    const mid = parseInt(value);
    const range = 20;
    
    this.filters.confidenceRange = {
      min: Math.max(0, mid - range),
      max: Math.min(100, mid + range)
    };
    
    document.getElementById('minConfidence').value = this.filters.confidenceRange.min;
    document.getElementById('maxConfidence').value = this.filters.confidenceRange.max;
    
    this.updateFilters();
  }

  updateSort() {
    const field = document.getElementById('sortField')?.value || 'confidence';
    this.sortOptions.field = field;
    this.performSearch();
  }

  toggleSortDirection() {
    const btn = document.getElementById('sortDirectionBtn');
    const icon = btn.querySelector('.sort-icon');
    
    if (this.sortOptions.direction === 'desc') {
      this.sortOptions.direction = 'asc';
      icon.textContent = '↑';
    } else {
      this.sortOptions.direction = 'desc';
      icon.textContent = '↓';
    }
    
    this.performSearch();
  }

  filterLeagues(query) {
    const leagues = document.querySelectorAll('.league-checkbox');
    const lowerQuery = query.toLowerCase();
    
    leagues.forEach(league => {
      const name = league.querySelector('.league-name')?.textContent.toLowerCase() || '';
      const country = league.querySelector('.league-country')?.textContent.toLowerCase() || '';
      
      const matches = name.includes(lowerQuery) || country.includes(lowerQuery);
      league.style.display = matches ? 'block' : 'none';
    });
  }

  hasActiveFilters() {
    return this.filters.leagues.length > 0 ||
           this.filters.oddsRange.min > 1.0 ||
           this.filters.oddsRange.max < 10.0 ||
           this.filters.confidenceRange.min > 0 ||
           this.filters.confidenceRange.max < 100 ||
           this.filters.valueRange.min > 0 ||
           this.filters.valueRange.max < 100 ||
           this.filters.timeRange !== 'all' ||
           this.filters.matchStatus !== 'all';
  }

  resetFilters() {
    // Reset all filters to default values
    this.filters = {
      leagues: [],
      oddsRange: { min: 1.0, max: 10.0 },
      confidenceRange: { min: 0, max: 100 },
      riskLevel: 'all',
      timeRange: 'all',
      matchStatus: 'all',
      valueRange: { min: 0, max: 100 }
    };
    
    // Reset UI
    document.getElementById('minOdds').value = 1.0;
    document.getElementById('maxOdds').value = 10.0;
    document.getElementById('minConfidence').value = 0;
    document.getElementById('maxConfidence').value = 100;
    document.getElementById('minValue').value = 0;
    document.getElementById('maxValue').value = 100;
    document.getElementById('timeRange').value = 'all';
    document.getElementById('matchStatus').value = 'all';
    
    // Clear league selections
    document.querySelectorAll('.league-checkbox input').forEach(cb => cb.checked = false);
    
    // Clear search input
    document.getElementById('searchInput').value = '';
    document.getElementById('searchSuggestions').innerHTML = '';
  }

  saveSearch() {
    const searchData = {
      query: document.getElementById('searchInput').value,
      filters: this.filters,
      timestamp: new Date().toISOString()
    };
    
    this.searchHistory.unshift(searchData);
    this.searchHistory = this.searchHistory.slice(0, 10); // Keep only last 10
    
    localStorage.setItem('match_search_history', JSON.stringify(this.searchHistory));
    this.showToast('💾 Recherche sauvegardée');
  }

  loadSearchHistory() {
    try {
      const saved = localStorage.getItem('match_search_history');
      if (saved) {
        this.searchHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }

  addToFavorites(matchId) {
    const favorites = JSON.parse(localStorage.getItem('match_favorites') || '[]');
    if (!favorites.includes(matchId)) {
      favorites.push(matchId);
      localStorage.setItem('match_favorites', JSON.stringify(favorites));
      this.showToast('🔖 Ajouté aux favoris');
    } else {
      this.showToast('📌 Déjà dans les favoris');
    }
  }

  exportResults() {
    const results = document.querySelectorAll('.search-result-item');
    if (results.length === 0) {
      this.showToast('📭 Aucun résultat à exporter');
      return;
    }

    // Generate CSV export
    let csv = 'Équipes,Ligue,Heure,Confiance,Valeur,Risque,Cote Domicile,Cote Nul,Cote Extérieur\n';
    
    results.forEach(item => {
      const teams = item.querySelector('.result-teams')?.textContent || '';
      const league = item.querySelector('.result-league')?.textContent || '';
      const time = item.querySelector('.result-time')?.textContent || '';
      const confidence = item.querySelector('.result-stat:nth-child(1) .stat-value')?.textContent || '';
      const value = item.querySelector('.result-stat:nth-child(2) .stat-value')?.textContent || '';
      const risk = item.querySelector('.result-stat:nth-child(3) .stat-value')?.textContent || '';
      const odds = Array.from(item.querySelectorAll('.odd-item')).map(odd => odd.textContent.split(': ')[1]).join(',');
      
      csv += `"${teams}","${league}","${time}",${confidence},${value},"${risk}",${odds}\n`;
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `match-search-results-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showToast('📤 Résultats exportés');
  }

  showSearchLoading() {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `
      <div class="search-loading">
        <div class="loading-spinner">🔍</div>
        <div class="loading-text">Recherche en cours...</div>
      </div>
    `;
  }

  showNoResultsMessage() {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">Entrez une recherche ou appliquez des filtres</div>
        <div class="no-results-hint">Utilisez la barre de recherche ou les filtres ci-dessus</div>
      </div>
    `;
  }

  showSearchError(message) {
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = `
      <div class="search-error">
        <div class="error-icon">❌</div>
        <div class="error-text">Erreur lors de la recherche</div>
        <div class="error-message">${message}</div>
      </div>
    `;
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'search-toast';
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

  destroy() {
    // Cleanup
    clearTimeout(this.searchTimeout);
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.searchSystem = new MatchAdvancedSearch();
    });
  } else {
    window.searchSystem = new MatchAdvancedSearch();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MatchAdvancedSearch;
}
