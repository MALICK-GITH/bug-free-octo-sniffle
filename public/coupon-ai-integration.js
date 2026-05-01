// AI Integration for Coupon Generation
class CouponAIIntegration {
  constructor() {
    this.isInitialized = false;
    this.currentGeneration = null;
    this.aiEngine = null;
    this.confidenceCalculator = null;
    
    this.init();
  }

  async init() {
    console.log('🤖 Initializing AI Coupon Integration...');
    
    // Wait for AI components to be ready
    await this.waitForAIComponents();
    
    // Initialize AI engine
    if (window.advancedCouponEngine) {
      this.aiEngine = window.advancedCouponEngine;
    }
    
    // Initialize confidence calculator
    if (window.aiConfidenceCalculator) {
      this.confidenceCalculator = window.aiConfidenceCalculator;
    }
    
    // Setup UI integration
    this.setupUIIntegration();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup real-time updates
    this.setupRealTimeUpdates();
    
    this.isInitialized = true;
    console.log('✅ AI Coupon Integration Ready');
  }

  async waitForAIComponents() {
    const maxWaitTime = 5000; // 5 seconds max wait
    const startTime = Date.now();
    
    while ((!window.advancedCouponEngine || !window.aiConfidenceCalculator) && 
           Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!window.advancedCouponEngine) {
      console.warn('⚠️ Advanced Coupon Engine not available');
    }
    
    if (!window.aiConfidenceCalculator) {
      console.warn('⚠️ AI Confidence Calculator not available');
    }
  }

  setupUIIntegration() {
    // Add AI controls to the UI
    this.addAIControls();
    
    // Add AI confidence display
    this.addAIConfidenceDisplay();
    
    // Add AI insights panel
    this.addAIInsightsPanel();
    
    // Add AI recommendation box
    this.addAIRecommendationBox();
    
    // Add AI status indicators
    this.addAIStatusIndicators();
  }

  addAIControls() {
    const controlsSection = document.querySelector('.controls');
    if (!controlsSection) return;

    // Create AI controls container
    const aiControls = document.createElement('div');
    aiControls.className = 'ai-controls';
    aiControls.innerHTML = `
      <div class="ai-controls-header">
        <span class="ai-controls-title">Contrôles IA</span>
        <button id="toggleAI" class="ai-toggle-btn">🤖 Activer IA</button>
      </div>
      
      <div class="ai-control-group">
        <label class="ai-control-label">Mode d'analyse</label>
        <div class="ai-control-options">
          <div class="ai-control-option selected" data-mode="enhanced">
            <span class="ai-control-option-label">Avancé</span>
            <span class="ai-control-option-value">ML + Patterns</span>
          </div>
          <div class="ai-control-option" data-mode="conservative">
            <span class="ai-control-option-label">Conservateur</span>
            <span class="ai-control-option-value">Haute sécurité</span>
          </div>
          <div class="ai-control-option" data-mode="aggressive">
            <span class="ai-control-option-label">Agressif</span>
            <span class="ai-control-option-value">Max gain</span>
          </div>
        </div>
      </div>
      
      <div class="ai-control-group">
        <label class="ai-control-label">Profondeur d'analyse</label>
        <div class="ai-control-options">
          <div class="ai-control-option selected" data-depth="deep">
            <span class="ai-control-option-label">Profonde</span>
            <span class="ai-control-option-value">10 facteurs</span>
          </div>
          <div class="ai-control-option" data-depth="medium">
            <span class="ai-control-option-label">Moyenne</span>
            <span class="ai-control-option-value">6 facteurs</span>
          </div>
          <div class="ai-control-option" data-depth="shallow">
            <span class="ai-control-option-label">Rapide</span>
            <span class="ai-control-option-value">3 facteurs</span>
          </div>
        </div>
      </div>
      
      <div class="ai-control-group">
        <label class="ai-control-label">Confiance minimale</label>
        <div class="ai-control-options">
          <div class="ai-control-option" data-min-confidence="50">
            <span class="ai-control-option-label">Standard</span>
            <span class="ai-control-option-value">50%</span>
          </div>
          <div class="ai-control-option selected" data-min-confidence="65">
            <span class="ai-control-option-label">Élevée</span>
            <span class="ai-control-option-value">65%</span>
          </div>
          <div class="ai-control-option" data-min-confidence="75">
            <span class="ai-control-option-label">Très élevée</span>
            <span class="ai-control-option-value">75%</span>
          </div>
        </div>
      </div>
    `;

    // Insert AI controls after existing controls
    const existingControls = controlsSection.querySelector('.actions');
    if (existingControls) {
      controlsSection.insertBefore(aiControls, existingControls);
    } else {
      controlsSection.appendChild(aiControls);
    }

    // Setup AI control event listeners
    this.setupAIControlListeners();
  }

  addAIConfidenceDisplay() {
    const primaryGrid = document.querySelector('.primary-grid');
    if (!primaryGrid) return;

    // Create AI confidence display
    const confidenceDisplay = document.createElement('div');
    confidenceDisplay.className = 'ai-confidence-display';
    confidenceDisplay.innerHTML = `
      <div class="ai-confidence-header">
        <span class="ai-confidence-title">Confiance IA</span>
        <span class="ai-confidence-score" id="aiConfidenceScore">--</span>
      </div>
      <div class="ai-confidence-meters">
        <div class="confidence-meter">
          <div class="confidence-meter-label">Performance historique</div>
          <div class="confidence-meter-bar">
            <div class="confidence-meter-fill" id="historicalMeter"></div>
          </div>
          <div class="confidence-meter-value" id="historicalValue">--</div>
        </div>
        <div class="confidence-meter">
          <div class="confidence-meter-label">Analyse temps réel</div>
          <div class="confidence-meter-bar">
            <div class="confidence-meter-fill" id="realtimeMeter"></div>
          </div>
          <div class="confidence-meter-value" id="realtimeValue">--</div>
        </div>
        <div class="confidence-meter">
          <div class="confidence-meter-label">Reconnaissance patterns</div>
          <div class="confidence-meter-bar">
            <div class="confidence-meter-fill" id="patternsMeter"></div>
          </div>
          <div class="confidence-meter-value" id="patternsValue">--</div>
        </div>
      </div>
    `;

    // Insert confidence display in primary grid
    primaryGrid.appendChild(confidenceDisplay);
  }

  addAIInsightsPanel() {
    const primaryGrid = document.querySelector('.primary-grid');
    if (!primaryGrid) return;

    // Create AI insights panel
    const insightsPanel = document.createElement('div');
    insightsPanel.className = 'ai-insights-panel';
    insightsPanel.innerHTML = `
      <div class="ai-insights-header">
        <span class="ai-insights-title">Insights IA</span>
        <button id="refreshInsights" class="ai-refresh-btn">🔄</button>
      </div>
      <div class="ai-insights-grid">
        <div class="insight-item">
          <div class="insight-label">Précision moyenne</div>
          <div class="insight-value" id="avgAccuracy">--</div>
          <div class="insight-trend stable">Stable</div>
        </div>
        <div class="insight-item">
          <div class="insight-label">Taux de succès</div>
          <div class="insight-value" id="successRate">--</div>
          <div class="insight-trend up">+12%</div>
        </div>
        <div class="insight-item">
          <div class="insight-label">Facteur clé</div>
          <div class="insight-value" id="keyFactor">Timing</div>
          <div class="insight-trend stable">Principal</div>
        </div>
        <div class="insight-item">
          <div class="insight-label">Risque calculé</div>
          <div class="insight-value" id="calculatedRisk">--</div>
          <div class="insight-trend down">-5%</div>
        </div>
      </div>
    `;

    // Insert insights panel in primary grid
    primaryGrid.appendChild(insightsPanel);
  }

  addAIRecommendationBox() {
    const primaryGrid = document.querySelector('.primary-grid');
    if (!primaryGrid) return;

    // Create AI recommendation box
    const recommendationBox = document.createElement('div');
    recommendationBox.className = 'ai-recommendation';
    recommendationBox.innerHTML = `
      <div class="ai-recommendation-header">
        <span class="ai-recommendation-icon">🎯</span>
        <span class="ai-recommendation-title">Recommandation IA</span>
      </div>
      <div class="ai-recommendation-text" id="aiRecommendationText">
        Générez un coupon pour recevoir une recommandation personnalisée basée sur l'analyse avancée.
      </div>
      <div class="ai-recommendation-metrics">
        <div class="recommendation-metric">
          <div class="recommendation-metric-label">Confiance</div>
          <div class="recommendation-metric-value" id="recommendationConfidence">--</div>
        </div>
        <div class="recommendation-metric">
          <div class="recommendation-metric-label">Mise suggérée</div>
          <div class="recommendation-metric-value" id="recommendedStake">--</div>
        </div>
      </div>
    `;

    // Insert recommendation box in primary grid
    primaryGrid.appendChild(recommendationBox);
  }

  addAIStatusIndicators() {
    const controlsSection = document.querySelector('.controls');
    if (!controlsSection) return;

    // Create AI status indicators
    const statusIndicators = document.createElement('div');
    statusIndicators.className = 'ai-status-indicators';
    statusIndicators.innerHTML = `
      <div class="ai-status-indicator" id="mlStatus">
        <span class="ai-status-dot"></span>
        <span>ML Models</span>
      </div>
      <div class="ai-status-indicator" id="realtimeStatus">
        <span class="ai-status-dot"></span>
        <span>Temps réel</span>
      </div>
      <div class="ai-status-indicator" id="patternsStatus">
        <span class="ai-status-dot"></span>
        <span>Patterns</span>
      </div>
      <div class="ai-status-indicator" id="confidenceStatus">
        <span class="ai-status-dot"></span>
        <span>Confiance</span>
      </div>
    `;

    // Insert status indicators after controls
    controlsSection.appendChild(statusIndicators);
  }

  setupAIControlListeners() {
    // AI mode selection
    document.querySelectorAll('[data-mode]').forEach(option => {
      option.addEventListener('click', (e) => {
        this.selectAIOption(e.target.closest('.ai-control-option'), 'mode');
      });
    });

    // Analysis depth selection
    document.querySelectorAll('[data-depth]').forEach(option => {
      option.addEventListener('click', (e) => {
        this.selectAIOption(e.target.closest('.ai-control-option'), 'depth');
      });
    });

    // Minimum confidence selection
    document.querySelectorAll('[data-min-confidence]').forEach(option => {
      option.addEventListener('click', (e) => {
        this.selectAIOption(e.target.closest('.ai-control-option'), 'min-confidence');
      });
    });

    // AI toggle
    const toggleBtn = document.getElementById('toggleAI');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.toggleAI();
      });
    }

    // Refresh insights
    const refreshBtn = document.getElementById('refreshInsights');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshAIInsights();
      });
    }
  }

  selectAIOption(element, type) {
    // Remove selected class from siblings
    const siblings = element.parentElement.querySelectorAll('.ai-control-option');
    siblings.forEach(sibling => sibling.classList.remove('selected'));
    
    // Add selected class to clicked element
    element.classList.add('selected');
    
    // Store selection
    this.aiSettings = this.aiSettings || {};
    this.aiSettings[type] = element.dataset[type];
    
    // Update AI engine settings
    this.updateAISettings();
  }

  toggleAI() {
    const toggleBtn = document.getElementById('toggleAI');
    const isAIEnabled = toggleBtn.textContent.includes('Activer');
    
    if (isAIEnabled) {
      toggleBtn.textContent = '🤖 Désactiver IA';
      toggleBtn.classList.add('active');
      this.enableAI();
    } else {
      toggleBtn.textContent = '🤖 Activer IA';
      toggleBtn.classList.remove('active');
      this.disableAI();
    }
  }

  enableAI() {
    // Enable AI features
    this.isAIEnabled = true;
    
    // Update UI to show AI features
    document.querySelectorAll('.ai-confidence-display, .ai-insights-panel, .ai-recommendation').forEach(el => {
      el.style.display = 'block';
    });
    
    // Update generate button to use AI
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.textContent = '🤖 Générer avec IA';
      generateBtn.classList.add('ai-enhanced');
    }
    
    console.log('🤖 AI Features Enabled');
  }

  disableAI() {
    // Disable AI features
    this.isAIEnabled = false;
    
    // Hide AI features
    document.querySelectorAll('.ai-confidence-display, .ai-insights-panel, .ai-recommendation').forEach(el => {
      el.style.display = 'none';
    });
    
    // Reset generate button
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.textContent = 'Générer Coupon';
      generateBtn.classList.remove('ai-enhanced');
    }
    
    console.log('🤖 AI Features Disabled');
  }

  updateAISettings() {
    if (!this.aiEngine) return;
    
    // Update AI engine with new settings
    const settings = {
      mode: this.aiSettings.mode || 'enhanced',
      depth: this.aiSettings.depth || 'deep',
      minConfidence: parseInt(this.aiSettings['min-confidence']) || 65
    };
    
    this.aiEngine.updateSettings(settings);
  }

  setupEventListeners() {
    // Enhanced generate button listener
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', async (e) => {
        if (this.isAIEnabled) {
          await this.generateAICoupon(e);
        }
      });
    }

    // Listen for coupon generation events
    document.addEventListener('couponGenerated', (e) => {
      this.onCouponGenerated(e.detail);
    });

    // Listen for validation events
    document.addEventListener('couponValidated', (e) => {
      this.onCouponValidated(e.detail);
    });
  }

  async generateAICoupon(event) {
    if (!this.isInitialized || !this.aiEngine) {
      console.warn('AI not ready, falling back to standard generation');
      return;
    }

    try {
      // Show loading state
      this.showAILoadingState();
      
      // Get generation options
      const options = this.getGenerationOptions();
      
      // Generate coupon with AI
      const coupon = await this.aiEngine.generateAdvancedCoupon(options);
      
      // Update UI with AI-generated coupon
      this.updateUIWithAICoupon(coupon);
      
      // Hide loading state
      this.hideAILoadingState();
      
      // Trigger coupon generated event
      document.dispatchEvent(new CustomEvent('couponGenerated', {
        detail: { coupon, source: 'ai' }
      }));
      
    } catch (error) {
      console.error('AI Coupon generation failed:', error);
      this.showAIError(error.message);
      this.hideAILoadingState();
    }
  }

  getGenerationOptions() {
    // Get current form values
    const size = parseInt(document.getElementById('sizeInput')?.value) || 3;
    const riskProfile = document.getElementById('riskSelect')?.value || 'balanced';
    const league = document.getElementById('leagueSelect')?.value || 'all';
    
    return {
      size,
      riskProfile,
      league,
      useML: true,
      usePatterns: true,
      useRealTime: true,
      aiMode: this.aiSettings?.mode || 'enhanced',
      analysisDepth: this.aiSettings?.depth || 'deep',
      minConfidence: parseInt(this.aiSettings?.['min-confidence']) || 65
    };
  }

  showAILoadingState() {
    // Show AI-specific loading states
    const progressContainer = document.querySelector('.ai-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'block';
      this.animateAIProgress();
    }
    
    // Update status indicators
    this.updateStatusIndicator('mlStatus', 'active', 'Analyse ML...');
    this.updateStatusIndicator('realtimeStatus', 'active', 'Temps réel...');
    this.updateStatusIndicator('patternsStatus', 'active', 'Patterns...');
    this.updateStatusIndicator('confidenceStatus', 'inactive', 'En attente');
  }

  hideAILoadingState() {
    // Hide loading states
    const progressContainer = document.querySelector('.ai-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
    
    // Update status indicators
    this.updateStatusIndicator('mlStatus', 'active', 'ML Actif');
    this.updateStatusIndicator('realtimeStatus', 'active', 'Temps réel actif');
    this.updateStatusIndicator('patternsStatus', 'active', 'Patterns actif');
    this.updateStatusIndicator('confidenceStatus', 'active', 'Confiance calculée');
  }

  animateAIProgress() {
    let progress = 0;
    const progressBar = document.querySelector('.ai-progress-fill');
    const progressText = document.querySelector('.ai-progress-text');
    
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      
      if (progressText) {
        progressText.textContent = `Analyse IA en cours... ${Math.round(progress)}%`;
      }
    }, 200);
  }

  updateUIWithAICoupon(coupon) {
    // Update confidence display
    this.updateConfidenceDisplay(coupon);
    
    // Update insights panel
    this.updateInsightsPanel(coupon);
    
    // Update recommendation box
    this.updateRecommendationBox(coupon);
    
    // Store current generation
    this.currentGeneration = coupon;
  }

  updateConfidenceDisplay(coupon) {
    if (!coupon.metrics) return;
    
    // Update main confidence score
    const confidenceScore = document.getElementById('aiConfidenceScore');
    if (confidenceScore) {
      confidenceScore.textContent = coupon.metrics.averageConfidence || '--';
    }
    
    // Update individual meters
    this.updateConfidenceMeter('historicalMeter', 'historicalValue', coupon.metrics.historicalConfidence || 0);
    this.updateConfidenceMeter('realtimeMeter', 'realtimeValue', coupon.metrics.realtimeConfidence || 0);
    this.updateConfidenceMeter('patternsMeter', 'patternsValue', coupon.metrics.patternConfidence || 0);
  }

  updateConfidenceMeter(meterId, valueId, value) {
    const meter = document.getElementById(meterId);
    const valueElement = document.getElementById(valueId);
    
    if (meter && valueElement) {
      const percentage = Math.max(0, Math.min(100, value));
      meter.style.width = `${percentage}%`;
      valueElement.textContent = `${Math.round(percentage)}%`;
      
      // Update meter color based on value
      meter.className = 'confidence-meter-fill';
      if (percentage >= 80) {
        meter.classList.add('high');
      } else if (percentage >= 60) {
        meter.classList.add('medium');
      } else {
        meter.classList.add('low');
      }
    }
  }

  updateInsightsPanel(coupon) {
    if (!coupon.insights) return;
    
    // Update insights values
    const avgAccuracy = document.getElementById('avgAccuracy');
    if (avgAccuracy) {
      avgAccuracy.textContent = `${coupon.insights.avgAccuracy || '--'}%`;
    }
    
    const successRate = document.getElementById('successRate');
    if (successRate) {
      successRate.textContent = `${coupon.insights.successRate || '--'}%`;
    }
    
    const keyFactor = document.getElementById('keyFactor');
    if (keyFactor) {
      keyFactor.textContent = coupon.insights.keyFactor || '--';
    }
    
    const calculatedRisk = document.getElementById('calculatedRisk');
    if (calculatedRisk) {
      calculatedRisk.textContent = `${coupon.insights.calculatedRisk || '--'}%`;
    }
  }

  updateRecommendationBox(coupon) {
    if (!coupon.recommendation) return;
    
    // Update recommendation text
    const recommendationText = document.getElementById('aiRecommendationText');
    if (recommendationText) {
      recommendationText.textContent = coupon.recommendation.reason || 'Recommandation IA générée';
    }
    
    // Update recommendation metrics
    const recommendationConfidence = document.getElementById('recommendationConfidence');
    if (recommendationConfidence) {
      recommendationConfidence.textContent = `${coupon.recommendation.confidence || '--'}%`;
    }
    
    const recommendedStake = document.getElementById('recommendedStake');
    if (recommendedStake) {
      recommendedStake.textContent = `${coupon.recommendation.suggestedStake || '--'}€`;
    }
    
    // Update recommendation box class based on recommendation
    const recommendationBox = document.querySelector('.ai-recommendation');
    if (recommendationBox) {
      recommendationBox.className = 'ai-recommendation';
      
      switch (coupon.recommendation.recommendation) {
        case 'STRONG_BUY':
          recommendationBox.classList.add('strong-buy');
          break;
        case 'BUY':
          recommendationBox.classList.add('buy');
          break;
        case 'CONSIDER':
          recommendationBox.classList.add('consider');
          break;
        case 'CAUTIOUS':
          recommendationBox.classList.add('cautious');
          break;
        case 'AVOID':
          recommendationBox.classList.add('avoid');
          break;
      }
    }
  }

  updateStatusIndicator(indicatorId, status, text) {
    const indicator = document.getElementById(indicatorId);
    if (indicator) {
      const dot = indicator.querySelector('.ai-status-dot');
      const textSpan = indicator.querySelector('span:last-child');
      
      if (status === 'active') {
        indicator.classList.add('active');
        indicator.classList.remove('inactive');
        if (dot) dot.classList.add('active');
      } else {
        indicator.classList.add('inactive');
        indicator.classList.remove('active');
        if (dot) dot.classList.remove('active');
      }
      
      if (textSpan) {
        textSpan.textContent = text;
      }
    }
  }

  refreshAIInsights() {
    // Refresh AI insights
    if (this.confidenceCalculator) {
      this.confidenceCalculator.refreshAnalysis();
    }
    
    // Show refresh animation
    const refreshBtn = document.getElementById('refreshInsights');
    if (refreshBtn) {
      refreshBtn.style.transform = 'rotate(360deg)';
      setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
      }, 500);
    }
  }

  onCouponGenerated(event) {
    const { coupon, source } = event.detail;
    
    if (source === 'ai' && this.isAIEnabled) {
      // Process AI-generated coupon
      this.processAIGeneratedCoupon(coupon);
    }
  }

  onCouponValidated(event) {
    const { validation } = event.detail;
    
    if (this.isAIEnabled) {
      // Update AI insights based on validation
      this.updateAIInsightsFromValidation(validation);
    }
  }

  processAIGeneratedCoupon(coupon) {
    // Process AI-generated coupon
    console.log('🤖 AI Generated Coupon:', coupon);
    
    // Update AI metrics
    this.updateAIMetrics(coupon);
    
    // Store AI performance data
    this.storeAIPerformance(coupon);
  }

  updateAIMetrics(coupon) {
    // Update AI performance metrics
    if (!coupon.metrics) return;
    
    // This would typically send data to analytics
    const metrics = {
      timestamp: Date.now(),
      confidence: coupon.metrics.averageConfidence,
      risk: coupon.metrics.calculatedRisk,
      recommendation: coupon.recommendation?.recommendation,
      generationTime: coupon.generationTime,
      aiMode: this.aiSettings?.mode || 'enhanced'
    };
    
    console.log('📊 AI Metrics:', metrics);
  }

  storeAIPerformance(coupon) {
    // Store AI performance for learning
    try {
      const performance = {
        coupon: coupon,
        timestamp: Date.now(),
        settings: this.aiSettings,
        result: null // To be updated after validation
      };
      
      // Store in localStorage or send to server
      const existing = JSON.parse(localStorage.getItem('ai_performance_log') || '[]');
      existing.push(performance);
      
      // Keep only last 100 entries
      if (existing.length > 100) {
        existing.splice(0, existing.length - 100);
      }
      
      localStorage.setItem('ai_performance_log', JSON.stringify(existing));
    } catch (error) {
      console.warn('Failed to store AI performance:', error);
    }
  }

  updateAIInsightsFromValidation(validation) {
    // Update AI insights based on validation results
    if (validation.success) {
      this.updateStatusIndicator('confidenceStatus', 'active', 'Validé avec succès');
    } else {
      this.updateStatusIndicator('confidenceStatus', 'inactive', 'Validation échouée');
    }
  }

  showAIError(message) {
    // Show AI error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'ai-error-message';
    errorDiv.innerHTML = `
      <div class="ai-error-header">⚠️ Erreur IA</div>
      <div class="ai-error-text">${message}</div>
      <button class="ai-error-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    // Add to page
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentElement) {
        errorDiv.remove();
      }
    }, 5000);
  }

  setupRealTimeUpdates() {
    // Setup real-time confidence updates
    setInterval(() => {
      if (this.isAIEnabled && this.confidenceCalculator) {
        this.updateRealTimeConfidence();
      }
    }, 5000); // Update every 5 seconds
  }

  updateRealTimeConfidence() {
    // Update real-time confidence based on current matches
    const matches = document.querySelectorAll('.match-card');
    
    matches.forEach(match => {
      const matchId = match.dataset.matchId;
      if (matchId) {
        // Calculate real-time confidence for this match
        const confidence = this.calculateRealTimeMatchConfidence(match);
        
        // Update match UI with confidence
        this.updateMatchConfidenceUI(match, confidence);
      }
    });
  }

  calculateRealTimeMatchConfidence(match) {
    // Calculate real-time confidence for a specific match
    const odds = this.extractMatchOdds(match);
    const confidence = this.confidenceCalculator.calculateMatchConfidence(match, {
      useRealTime: true,
      useHistorical: true
    });
    
    return confidence;
  }

  extractMatchOdds(match) {
    // Extract odds from match element
    const oddsElements = match.querySelectorAll('.odd-box strong');
    const odds = [];
    
    oddsElements.forEach(element => {
      const odd = parseFloat(element.textContent);
      if (!isNaN(odd)) odds.push(odd);
    });
    
    return odds;
  }

  updateMatchConfidenceUI(match, confidence) {
    // Update match UI with confidence information
    const confidenceElement = match.querySelector('.match-confidence');
    
    if (confidenceElement) {
      confidenceElement.textContent = `${Math.round(confidence.confidence)}%`;
      confidenceElement.className = `match-confidence ${confidence.confidence >= 75 ? 'high' : confidence.confidence >= 60 ? 'medium' : 'low'}`;
    }
  }
}

// Initialize AI integration when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.couponAIIntegration = new CouponAIIntegration();
    });
  } else {
    window.couponAIIntegration = new CouponAIIntegration();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CouponAIIntegration;
}
