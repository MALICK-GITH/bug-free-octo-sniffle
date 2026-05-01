// Advanced Coupon Features
class CouponAdvancedFeatures {
  constructor() {
    this.currentCoupon = null;
    this.couponHistory = [];
    this.templates = new Map();
    this.analytics = new Map();
    this.shortcuts = new Map();
    
    this.init();
  }

  init() {
    console.log('🎫 Advanced Coupon Features Initializing...');
    
    // Setup advanced UI
    this.setupAdvancedUI();
    
    // Setup templates
    this.setupTemplates();
    
    // Setup analytics
    this.setupAnalytics();
    
    // Setup shortcuts
    this.setupShortcuts();
    
    // Setup auto-save
    this.setupAutoSave();
    
    // Setup collaboration
    this.setupCollaboration();
    
    console.log('✅ Advanced Coupon Features Ready');
  }

  setupAdvancedUI() {
    // Add advanced controls
    this.addAdvancedControls();
    
    // Add template selector
    this.addTemplateSelector();
    
    // Add analytics dashboard
    this.addAnalyticsDashboard();
    
    // Add collaboration panel
    this.addCollaborationPanel();
    
    // Add quick actions toolbar
    this.addQuickActionsToolbar();
    
    // Add advanced preview
    this.addAdvancedPreview();
  }

  setupTemplates() {
    // Initialize built-in templates
    this.templates.set('safe', {
      name: 'Safe Strategy',
      size: 3,
      riskProfile: 'safe',
      minConfidence: 75,
      maxOdds: 2.0,
      leagues: ['premier_league', 'laliga', 'bundesliga'],
      description: 'Conservative approach with high confidence matches'
    });
    
    this.templates.set('balanced', {
      name: 'Balanced Strategy',
      size: 4,
      riskProfile: 'balanced',
      minConfidence: 65,
      maxOdds: 2.5,
      leagues: ['all'],
      description: 'Balanced risk-reward ratio'
    });
    
    this.templates.set('aggressive', {
      name: 'Aggressive Strategy',
      size: 5,
      riskProfile: 'aggressive',
      minConfidence: 55,
      maxOdds: 3.5,
      leagues: ['all'],
      description: 'High risk high reward approach'
    });
    
    this.templates.set('tournament', {
      name: 'Tournament Special',
      size: 6,
      riskProfile: 'balanced',
      minConfidence: 70,
      maxOdds: 3.0,
      leagues: ['champions_league', 'europa_league'],
      description: 'Specialized for tournament matches'
    });
  }

  setupAnalytics() {
    // Initialize analytics tracking
    this.analytics.set('generation_count', 0);
    this.analytics.set('success_rate', 0);
    this.analytics.set('avg_confidence', 0);
    this.analytics.set('avg_odds', 0);
    this.analytics.set('popular_templates', new Map());
    this.analytics.set('generation_times', []);
  }

  setupShortcuts() {
    // Setup keyboard shortcuts
    this.shortcuts.set('Ctrl+G', () => this.generateQuickCoupon());
    this.shortcuts.set('Ctrl+T', () => this.applyTemplate('balanced'));
    this.shortcuts.set('Ctrl+S', () => this.saveCoupon());
    this.shortcuts.set('Ctrl+L', () => this.loadLastCoupon());
    this.shortcuts.set('Ctrl+E', () => this.exportCoupon());
    this.shortcuts.set('Ctrl+R', () => this.resetForm());
    this.shortcuts.set('Ctrl+A', () => this.analyzeCoupon());
    this.shortcuts.set('Ctrl+H', () => this.showHistory());
  }

  setupAutoSave() {
    // Auto-save form data
    const formInputs = document.querySelectorAll('.controls input, .controls select');
    formInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.saveFormData();
      });
    });
    
    // Auto-save coupon data
    const saveInterval = setInterval(() => {
      if (this.currentCoupon) {
        this.saveCurrentCoupon();
      }
    }, 30000); // Auto-save every 30 seconds
  }

  setupCollaboration() {
    // Setup real-time collaboration
    this.collaborationRoom = null;
    this.collaborationUsers = new Map();
    
    // Initialize WebSocket connection for collaboration
    this.initializeCollaboration();
  }

  // UI Methods
  addAdvancedControls() {
    const controlsSection = document.querySelector('.controls');
    if (!controlsSection) return;

    const advancedControls = document.createElement('div');
    advancedControls.className = 'advanced-controls';
    advancedControls.innerHTML = `
      <div class="advanced-controls-header">
        <h3>🚀 Advanced Features</h3>
        <button class="toggle-advanced" id="toggleAdvanced">▼</button>
      </div>
      <div class="advanced-controls-content" id="advancedControlsContent">
        <div class="control-group">
          <label class="control-label">
            <span>Quick Template</span>
            <select id="quickTemplateSelect">
              <option value="">Select Template</option>
              <option value="safe">Safe Strategy</option>
              <option value="balanced">Balanced Strategy</option>
              <option value="aggressive">Aggressive Strategy</option>
              <option value="tournament">Tournament Special</option>
            </select>
          </label>
        </div>
        
        <div class="control-group">
          <label class="control-label">
            <span>Smart Mode</span>
            <select id="smartModeSelect">
              <option value="off">Off</option>
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
        </div>
        
        <div class="control-group">
          <label class="control-label">
            <span>Auto-Optimize</span>
            <input type="checkbox" id="autoOptimizeSwitch" />
          </label>
        </div>
        
        <div class="control-group">
          <label class="control-label">
            <span>Live Updates</span>
            <input type="checkbox" id="liveUpdatesSwitch" checked />
          </label>
        </div>
        
        <div class="control-group">
          <label class="control-label">
            <span>Batch Generation</span>
            <input type="number" id="batchCount" min="1" max="10" value="3" />
          </label>
        </div>
        
        <div class="advanced-actions">
          <button class="advanced-btn" id="quickGenerateBtn">Quick Generate</button>
          <button class="advanced-btn" id="batchGenerateBtn">Batch Generate</button>
          <button class="advanced-btn" id="optimizeBtn">Optimize</button>
          <button class="advanced-btn" id="analyzeBtn">Analyze</button>
        </div>
      </div>
    `;

    controlsSection.appendChild(advancedControls);
    this.setupAdvancedControlEvents();
  }

  addTemplateSelector() {
    const primaryGrid = document.querySelector('.primary-grid');
    if (!primaryGrid) return;

    const templateSelector = document.createElement('section');
    templateSelector.className = 'panel panel-main';
    templateSelector.innerHTML = `
      <h3>📋 Template Library</h3>
      <div class="template-grid" id="templateGrid">
        <!-- Templates will be populated here -->
      </div>
      <div class="template-actions">
        <button class="template-btn" id="createTemplateBtn">Create Template</button>
        <button class="template-btn" id="manageTemplatesBtn">Manage Templates</button>
      </div>
    `;

    primaryGrid.appendChild(templateSelector);
    this.populateTemplateGrid();
  }

  addAnalyticsDashboard() {
    const secondaryGrid = document.querySelector('.secondary-grid');
    if (!secondaryGrid) return;

    const analyticsPanel = document.createElement('section');
    analyticsPanel.className = 'panel';
    analyticsPanel.innerHTML = `
      <h3>📊 Analytics Dashboard</h3>
      <div class="analytics-stats" id="analyticsStats">
        <div class="stat-item">
          <span class="stat-label">Total Generated</span>
          <span class="stat-value" id="totalGenerated">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Success Rate</span>
          <span class="stat-value" id="successRate">0%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Confidence</span>
          <span class="stat-value" id="avgConfidence">0%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Odds</span>
          <span class="stat-value" id="avgOdds">0.00</span>
        </div>
      </div>
      <div class="analytics-chart" id="analyticsChart">
        <canvas id="performanceChart"></canvas>
      </div>
      <div class="analytics-actions">
        <button class="analytics-btn" id="exportAnalyticsBtn">Export Data</button>
        <button class="analytics-btn" id="resetAnalyticsBtn">Reset Stats</button>
      </div>
    `;

    secondaryGrid.appendChild(analyticsPanel);
    this.updateAnalytics();
  }

  addCollaborationPanel() {
    const secondaryGrid = document.querySelector('.secondary-grid');
    if (!secondaryGrid) return;

    const collaborationPanel = document.createElement('section');
    collaborationPanel.className = 'panel';
    collaborationPanel.innerHTML = `
      <h3>👥 Collaboration</h3>
      <div class="collaboration-status" id="collaborationStatus">
        <div class="status-item">
          <span class="status-label">Room Status</span>
          <span class="status-value" id="roomStatus">Not Connected</span>
        </div>
        <div class="status-item">
          <span class="status-label">Active Users</span>
          <span class="status-value" id="activeUsers">0</span>
        </div>
      </div>
      <div class="collaboration-actions">
        <button class="collaboration-btn" id="createRoomBtn">Create Room</button>
        <button class="collaboration-btn" id="joinRoomBtn">Join Room</button>
        <button class="collaboration-btn" id="shareCouponBtn">Share Coupon</button>
      </div>
      <div class="collaboration-chat" id="collaborationChat">
        <!-- Chat messages will appear here -->
      </div>
    `;

    secondaryGrid.appendChild(collaborationPanel);
    this.setupCollaborationEvents();
  }

  addQuickActionsToolbar() {
    const page = document.querySelector('.page');
    if (!page) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'quick-actions-toolbar';
    toolbar.innerHTML = `
      <div class="toolbar-header">
        <span class="toolbar-title">⚡ Quick Actions</span>
        <button class="toolbar-toggle" id="toolbarToggle">−</button>
      </div>
      <div class="toolbar-content" id="toolbarContent">
        <div class="toolbar-actions">
          <button class="toolbar-btn" id="quickSaveBtn" title="Save (Ctrl+S)">💾</button>
          <button class="toolbar-btn" id="quickLoadBtn" title="Load (Ctrl+L)">📂</button>
          <button class="toolbar-btn" id="quickExportBtn" title="Export (Ctrl+E)">📤</button>
          <button class="toolbar-btn" id="quickPrintBtn" title="Print">🖨️</button>
          <button class="toolbar-btn" id="quickShareBtn" title="Share">🔗</button>
          <button class="toolbar-btn" id="quickHelpBtn" title="Help">❓</button>
        </div>
        <div class="toolbar-info">
          <span class="info-item">Last saved: <span id="lastSaved">Never</span></span>
          <span class="info-item">Auto-save: <span id="autoSaveStatus">On</span></span>
        </div>
      </div>
    `;

    page.appendChild(toolbar);
    this.setupToolbarEvents();
  }

  addAdvancedPreview() {
    const primaryGrid = document.querySelector('.primary-grid');
    if (!primaryGrid) return;

    const previewPanel = document.createElement('section');
    previewPanel.className = 'panel panel-main';
    previewPanel.innerHTML = `
      <h3>👁️ Advanced Preview</h3>
      <div class="preview-container" id="previewContainer">
        <div class="preview-placeholder">
          <p>Generate a coupon to see the advanced preview</p>
        </div>
      </div>
      <div class="preview-controls">
        <button class="preview-btn" id="preview3DBtn">3D View</button>
        <button class="preview-btn" id="previewPrintBtn">Print Preview</button>
        <button class="preview-btn" id="previewMobileBtn">Mobile Preview</button>
      </div>
    `;

    primaryGrid.appendChild(previewPanel);
  }

  // Event Handlers
  setupAdvancedControlEvents() {
    // Toggle advanced controls
    const toggleBtn = document.getElementById('toggleAdvanced');
    const content = document.getElementById('advancedControlsContent');
    if (toggleBtn && content) {
      toggleBtn.addEventListener('click', () => {
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
        toggleBtn.textContent = content.style.display === 'none' ? '▼' : '▲';
      });
    }

    // Template selection
    const templateSelect = document.getElementById('quickTemplateSelect');
    if (templateSelect) {
      templateSelect.addEventListener('change', (e) => {
        this.applyTemplate(e.target.value);
      });
    }

    // Smart mode
    const smartModeSelect = document.getElementById('smartModeSelect');
    if (smartModeSelect) {
      smartModeSelect.addEventListener('change', (e) => {
        this.setSmartMode(e.target.value);
      });
    }

    // Auto-optimize
    const autoOptimizeSwitch = document.getElementById('autoOptimizeSwitch');
    if (autoOptimizeSwitch) {
      autoOptimizeSwitch.addEventListener('change', (e) => {
        this.setAutoOptimize(e.target.checked);
      });
    }

    // Live updates
    const liveUpdatesSwitch = document.getElementById('liveUpdatesSwitch');
    if (liveUpdatesSwitch) {
      liveUpdatesSwitch.addEventListener('change', (e) => {
        this.setLiveUpdates(e.target.checked);
      });
    }

    // Quick generate
    const quickGenerateBtn = document.getElementById('quickGenerateBtn');
    if (quickGenerateBtn) {
      quickGenerateBtn.addEventListener('click', () => {
        this.generateQuickCoupon();
      });
    }

    // Batch generate
    const batchGenerateBtn = document.getElementById('batchGenerateBtn');
    if (batchGenerateBtn) {
      batchGenerateBtn.addEventListener('click', () => {
        this.generateBatchCoupons();
      });
    }

    // Optimize
    const optimizeBtn = document.getElementById('optimizeBtn');
    if (optimizeBtn) {
      optimizeBtn.addEventListener('click', () => {
        this.optimizeCurrentCoupon();
      });
    }

    // Analyze
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => {
        this.analyzeCurrentCoupon();
      });
    }
  }

  populateTemplateGrid() {
    const templateGrid = document.getElementById('templateGrid');
    if (!templateGrid) return;

    templateGrid.innerHTML = '';
    
    this.templates.forEach((template, key) => {
      const templateCard = document.createElement('div');
      templateCard.className = 'template-card';
      templateCard.innerHTML = `
        <div class="template-header">
          <h4>${template.name}</h4>
          <span class="template-badge">${template.size} matches</span>
        </div>
        <div class="template-details">
          <p>${template.description}</p>
          <div class="template-stats">
            <span>Risk: ${template.riskProfile}</span>
            <span>Min Confidence: ${template.minConfidence}%</span>
            <span>Max Odds: ${template.maxOdds}</span>
          </div>
        </div>
        <div class="template-actions">
          <button class="template-apply-btn" data-template="${key}">Apply</button>
          <button class="template-edit-btn" data-template="${key}">Edit</button>
        </div>
      `;
      
      templateGrid.appendChild(templateCard);
    });

    // Setup template card events
    templateGrid.addEventListener('click', (e) => {
      if (e.target.classList.contains('template-apply-btn')) {
        const templateKey = e.target.dataset.template;
        this.applyTemplate(templateKey);
      } else if (e.target.classList.contains('template-edit-btn')) {
        const templateKey = e.target.dataset.template;
        this.editTemplate(templateKey);
      }
    });
  }

  setupCollaborationEvents() {
    // Create room
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => {
        this.createCollaborationRoom();
      });
    }

    // Join room
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => {
        this.joinCollaborationRoom();
      });
    }

    // Share coupon
    const shareCouponBtn = document.getElementById('shareCouponBtn');
    if (shareCouponBtn) {
      shareCouponBtn.addEventListener('click', () => {
        this.shareCurrentCoupon();
      });
    }
  }

  setupToolbarEvents() {
    // Toggle toolbar
    const toolbarToggle = document.getElementById('toolbarToggle');
    const toolbarContent = document.getElementById('toolbarContent');
    if (toolbarToggle && toolbarContent) {
      toolbarToggle.addEventListener('click', () => {
        toolbarContent.style.display = toolbarContent.style.display === 'none' ? 'block' : 'none';
        toolbarToggle.textContent = toolbarContent.style.display === 'none' ? '+' : '−';
      });
    }

    // Quick save
    const quickSaveBtn = document.getElementById('quickSaveBtn');
    if (quickSaveBtn) {
      quickSaveBtn.addEventListener('click', () => {
        this.saveCoupon();
      });
    }

    // Quick load
    const quickLoadBtn = document.getElementById('quickLoadBtn');
    if (quickLoadBtn) {
      quickLoadBtn.addEventListener('click', () => {
        this.loadLastCoupon();
      });
    }

    // Quick export
    const quickExportBtn = document.getElementById('quickExportBtn');
    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        this.exportCoupon();
      });
    }

    // Quick print
    const quickPrintBtn = document.getElementById('quickPrintBtn');
    if (quickPrintBtn) {
      quickPrintBtn.addEventListener('click', () => {
        this.printCoupon();
      });
    }

    // Quick share
    const quickShareBtn = document.getElementById('quickShareBtn');
    if (quickShareBtn) {
      quickShareBtn.addEventListener('click', () => {
        this.shareCoupon();
      });
    }

    // Quick help
    const quickHelpBtn = document.getElementById('quickHelpBtn');
    if (quickHelpBtn) {
      quickHelpBtn.addEventListener('click', () => {
        this.showHelp();
      });
    }
  }

  // Core Methods
  async generateQuickCoupon() {
    console.log('🚀 Generating quick coupon...');
    
    try {
      // Get current form values
      const formData = this.getFormData();
      
      // Apply smart optimizations
      const optimizedData = await this.optimizeFormData(formData);
      
      // Generate coupon
      const coupon = await this.generateCoupon(optimizedData);
      
      // Update UI
      this.updateCouponUI(coupon);
      
      // Update analytics
      this.updateAnalytics();
      
      // Show success message
      this.showSuccessMessage('Quick coupon generated successfully!');
      
    } catch (error) {
      console.error('Quick coupon generation failed:', error);
      this.showErrorMessage('Failed to generate quick coupon');
    }
  }

  async generateBatchCoupons() {
    console.log('📦 Generating batch coupons...');
    
    try {
      const batchCount = parseInt(document.getElementById('batchCount')?.value) || 3;
      const coupons = [];
      
      for (let i = 0; i < batchCount; i++) {
        const formData = this.getFormData();
        const optimizedData = await this.optimizeFormData(formData, { batchIndex: i });
        const coupon = await this.generateCoupon(optimizedData);
        coupons.push(coupon);
      }
      
      // Display batch results
      this.displayBatchResults(coupons);
      
      // Update analytics
      this.updateAnalytics();
      
      this.showSuccessMessage(`${batchCount} coupons generated successfully!`);
      
    } catch (error) {
      console.error('Batch generation failed:', error);
      this.showErrorMessage('Failed to generate batch coupons');
    }
  }

  applyTemplate(templateKey) {
    const template = this.templates.get(templateKey);
    if (!template) return;
    
    console.log(`📋 Applying template: ${template.name}`);
    
    // Update form fields
    const sizeInput = document.getElementById('sizeInput');
    if (sizeInput) sizeInput.value = template.size;
    
    const riskSelect = document.getElementById('riskSelect');
    if (riskSelect) riskSelect.value = template.riskProfile;
    
    // Apply template-specific settings
    this.applyTemplateSettings(template);
    
    // Show notification
    this.showSuccessMessage(`Template "${template.name}" applied successfully!`);
  }

  async optimizeCurrentCoupon() {
    if (!this.currentCoupon) {
      this.showErrorMessage('No coupon to optimize');
      return;
    }
    
    console.log('⚡ Optimizing current coupon...');
    
    try {
      const optimizedCoupon = await this.optimizeCoupon(this.currentCoupon);
      this.currentCoupon = optimizedCoupon;
      
      // Update UI
      this.updateCouponUI(optimizedCoupon);
      
      this.showSuccessMessage('Coupon optimized successfully!');
      
    } catch (error) {
      console.error('Coupon optimization failed:', error);
      this.showErrorMessage('Failed to optimize coupon');
    }
  }

  analyzeCurrentCoupon() {
    if (!this.currentCoupon) {
      this.showErrorMessage('No coupon to analyze');
      return;
    }
    
    console.log('📊 Analyzing current coupon...');
    
    const analysis = this.analyzeCoupon(this.currentCoupon);
    this.displayCouponAnalysis(analysis);
  }

  // Utility Methods
  getFormData() {
    const formData = {};
    
    // Get all form values
    const inputs = document.querySelectorAll('.controls input, .controls select');
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        formData[input.id] = input.checked;
      } else if (input.type === 'number') {
        formData[input.id] = parseFloat(input.value) || 0;
      } else {
        formData[input.id] = input.value;
      }
    });
    
    return formData;
  }

  async optimizeFormData(formData, options = {}) {
    // Apply smart optimizations based on current settings
    const optimized = { ...formData };
    
    // Apply smart mode optimizations
    const smartMode = document.getElementById('smartModeSelect')?.value;
    if (smartMode && smartMode !== 'off') {
      Object.assign(optimized, this.getSmartModeSettings(smartMode));
    }
    
    // Apply auto-optimizations
    const autoOptimize = document.getElementById('autoOptimizeSwitch')?.checked;
    if (autoOptimize) {
      Object.assign(optimized, await this.getAutoOptimizations(formData, options));
    }
    
    return optimized;
  }

  getSmartModeSettings(mode) {
    const settings = {};
    
    switch (mode) {
      case 'conservative':
        settings.riskProfile = 'safe';
        settings.size = 3;
        settings.minConfidence = 75;
        settings.maxOdds = 2.0;
        break;
      case 'balanced':
        settings.riskProfile = 'balanced';
        settings.size = 4;
        settings.minConfidence = 65;
        settings.maxOdds = 2.5;
        break;
      case 'aggressive':
        settings.riskProfile = 'aggressive';
        settings.size = 5;
        settings.minConfidence = 55;
        settings.maxOdds = 3.5;
        break;
    }
    
    return settings;
  }

  async getAutoOptimizations(formData, options) {
    // AI-powered optimizations
    const optimizations = {};
    
    // Analyze historical performance
    const historicalData = await this.getHistoricalPerformance();
    
    // Optimize based on performance
    if (historicalData.successRate < 50) {
      optimizations.riskProfile = 'safe';
      optimizations.size = Math.min(formData.size, 3);
    } else if (historicalData.successRate > 70) {
      optimizations.riskProfile = 'balanced';
      optimizations.size = Math.min(formData.size + 1, 6);
    }
    
    return optimizations;
  }

  async generateCoupon(formData) {
    // Call the existing coupon generation API
    const response = await fetch('/api/coupon/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate coupon');
    }
    
    return await response.json();
  }

  optimizeCoupon(coupon) {
    // Apply advanced optimizations to existing coupon
    const optimized = { ...coupon };
    
    // Re-order matches by confidence
    if (optimized.selections) {
      optimized.selections.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }
    
    // Calculate optimal stake
    if (optimized.stake) {
      optimized.stake = this.calculateOptimalStake(optimized);
    }
    
    return optimized;
  }

  analyzeCoupon(coupon) {
    const analysis = {
      confidence: this.calculateOverallConfidence(coupon),
      risk: this.calculateRiskLevel(coupon),
      value: this.calculateExpectedValue(coupon),
      recommendations: this.generateRecommendations(coupon),
      metrics: this.calculateMetrics(coupon)
    };
    
    return analysis;
  }

  calculateOverallConfidence(coupon) {
    if (!coupon.selections || !coupon.selections.length) return 0;
    
    const totalConfidence = coupon.selections.reduce((sum, selection) => 
      sum + (selection.confidence || 0), 0);
    
    return Math.round(totalConfidence / coupon.selections.length);
  }

  calculateRiskLevel(coupon) {
    // Calculate risk level based on various factors
    let risk = 0;
    
    // Odds risk
    const avgOdds = this.calculateAverageOdds(coupon);
    risk += avgOdds > 2.5 ? 30 : avgOdds > 2.0 ? 20 : 10;
    
    // Time risk
    const timeRisk = this.calculateTimeRisk(coupon);
    risk += timeRisk;
    
    // Correlation risk
    const correlationRisk = this.calculateCorrelationRisk(coupon);
    risk += correlationRisk;
    
    return Math.min(100, risk);
  }

  calculateExpectedValue(coupon) {
    // Calculate expected value
    const avgOdds = this.calculateAverageOdds(coupon);
    const confidence = this.calculateOverallConfidence(coupon) / 100;
    
    return Math.round((avgOdds * confidence - 1) * 100);
  }

  generateRecommendations(coupon) {
    const recommendations = [];
    const confidence = this.calculateOverallConfidence(coupon);
    const risk = this.calculateRiskLevel(coupon);
    
    if (confidence < 60) {
      recommendations.push('Consider increasing confidence threshold');
    }
    
    if (risk > 70) {
      recommendations.push('High risk detected - consider safer options');
    }
    
    if (coupon.selections && coupon.selections.length > 6) {
      recommendations.push('Consider reducing number of selections');
    }
    
    return recommendations;
  }

  calculateMetrics(coupon) {
    return {
      totalSelections: coupon.selections?.length || 0,
      averageOdds: this.calculateAverageOdds(coupon),
      totalOdds: this.calculateTotalOdds(coupon),
      potentialPayout: this.calculatePotentialPayout(coupon),
      riskLevel: this.calculateRiskLevel(coupon),
      confidenceLevel: this.calculateOverallConfidence(coupon)
    };
  }

  // UI Update Methods
  updateCouponUI(coupon) {
    this.currentCoupon = coupon;
    
    // Update result panel
    const resultPanel = document.getElementById('result');
    if (resultPanel) {
      resultPanel.innerHTML = this.generateCouponHTML(coupon);
    }
    
    // Update preview
    this.updatePreview(coupon);
    
    // Enable action buttons
    this.enableActionButtons();
  }

  generateCouponHTML(coupon) {
    if (!coupon.selections || !coupon.selections.length) {
      return '<p>No selections in coupon</p>';
    }
    
    let html = '<div class="coupon-content">';
    html += '<h4>Generated Coupon</h4>';
    html += '<div class="coupon-selections">';
    
    coupon.selections.forEach((selection, index) => {
      html += `
        <div class="selection-item">
          <span class="selection-index">${index + 1}</span>
          <span class="selection-teams">${selection.teamHome} vs ${selection.teamAway}</span>
          <span class="selection-odds">${selection.cote}</span>
          <span class="selection-confidence">${selection.confidence}%</span>
        </div>
      `;
    });
    
    html += '</div>';
    html += `<div class="coupon-summary">
      <span>Total Odds: ${this.calculateTotalOdds(coupon).toFixed(2)}</span>
      <span>Confidence: ${this.calculateOverallConfidence(coupon)}%</span>
    </div>`;
    html += '</div>';
    
    return html;
  }

  updatePreview(coupon) {
    const previewContainer = document.getElementById('previewContainer');
    if (!previewContainer) return;
    
    previewContainer.innerHTML = this.generatePreviewHTML(coupon);
  }

  generatePreviewHTML(coupon) {
    return `
      <div class="preview-coupon">
        <div class="preview-header">
          <h4>Coupon Preview</h4>
          <div class="preview-meta">
            <span>${new Date().toLocaleString()}</span>
            <span>${coupon.selections?.length || 0} selections</span>
          </div>
        </div>
        <div class="preview-content">
          ${this.generateCouponHTML(coupon)}
        </div>
      </div>
    `;
  }

  enableActionButtons() {
    const buttons = [
      'validateBtn', 'sendTelegramBtn', 'downloadPdfBtn', 
      'sendTelegramImageBtn', 'printA4Btn'
    ];
    
    buttons.forEach(buttonId => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.disabled = false;
      }
    });
  }

  // Analytics Methods
  updateAnalytics() {
    const totalGenerated = this.analytics.get('generation_count') || 0;
    const successRate = this.analytics.get('success_rate') || 0;
    const avgConfidence = this.analytics.get('avg_confidence') || 0;
    const avgOdds = this.analytics.get('avg_odds') || 0;
    
    // Update UI
    const totalElement = document.getElementById('totalGenerated');
    if (totalElement) totalElement.textContent = totalGenerated;
    
    const successElement = document.getElementById('successRate');
    if (successElement) successElement.textContent = `${successRate}%`;
    
    const confidenceElement = document.getElementById('avgConfidence');
    if (confidenceElement) confidenceElement.textContent = `${avgConfidence}%`;
    
    const oddsElement = document.getElementById('avgOdds');
    if (oddsElement) oddsElement.textContent = avgOdds.toFixed(2);
    
    // Update chart
    this.updatePerformanceChart();
  }

  updatePerformanceChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    
    // Simple chart implementation
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = 200;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw simple line chart
    const data = this.analytics.get('generation_times') || [];
    if (data.length < 2) return;
    
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue;
    
    ctx.strokeStyle = '#3be7ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    data.forEach((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - minValue) / range) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }

  // Storage Methods
  saveFormData() {
    const formData = this.getFormData();
    localStorage.setItem('coupon_form_data', JSON.stringify(formData));
  }

  loadFormData() {
    const saved = localStorage.getItem('coupon_form_data');
    if (saved) {
      const formData = JSON.parse(saved);
      
      // Restore form values
      Object.entries(formData).forEach(([key, value]) => {
        const element = document.getElementById(key);
        if (element) {
          if (element.type === 'checkbox') {
            element.checked = value;
          } else {
            element.value = value;
          }
        }
      });
    }
  }

  saveCurrentCoupon() {
    if (!this.currentCoupon) return;
    
    this.currentCoupon.savedAt = new Date().toISOString();
    localStorage.setItem('current_coupon', JSON.stringify(this.currentCoupon));
    
    // Update last saved time
    const lastSaved = document.getElementById('lastSaved');
    if (lastSaved) {
      lastSaved.textContent = new Date().toLocaleTimeString();
    }
  }

  loadLastCoupon() {
    const saved = localStorage.getItem('current_coupon');
    if (saved) {
      this.currentCoupon = JSON.parse(saved);
      this.updateCouponUI(this.currentCoupon);
      this.showSuccessMessage('Last coupon loaded successfully!');
    } else {
      this.showErrorMessage('No saved coupon found');
    }
  }

  // Utility Methods
  calculateAverageOdds(coupon) {
    if (!coupon.selections || !coupon.selections.length) return 1;
    
    const totalOdds = coupon.selections.reduce((sum, selection) => 
      sum + (selection.cote || 1), 0);
    
    return totalOdds / coupon.selections.length;
  }

  calculateTotalOdds(coupon) {
    if (!coupon.selections || !coupon.selections.length) return 1;
    
    return coupon.selections.reduce((product, selection) => 
      product * (selection.cote || 1), 1);
  }

  calculatePotentialPayout(coupon) {
    const totalOdds = this.calculateTotalOdds(coupon);
    const stake = coupon.stake || 1000;
    return Math.round(stake * totalOdds);
  }

  calculateOptimalStake(coupon) {
    // Kelly Criterion implementation
    const avgOdds = this.calculateAverageOdds(coupon);
    const confidence = this.calculateOverallConfidence(coupon) / 100;
    const bankroll = coupon.bankroll || 25000;
    
    const kellyFraction = (avgOdds * confidence - 1) / (avgOdds - 1);
    const safeFraction = Math.max(0.01, Math.min(0.25, kellyFraction));
    
    return Math.round(bankroll * safeFraction);
  }

  // Notification Methods
  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }

  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
        <span class="notification-text">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  // Collaboration Methods
  async initializeCollaboration() {
    // Initialize WebSocket connection for real-time collaboration
    try {
      // This would connect to a WebSocket server
      console.log('👥 Collaboration initialized');
    } catch (error) {
      console.warn('Collaboration not available:', error);
    }
  }

  async createCollaborationRoom() {
    // Create a new collaboration room
    const roomId = this.generateRoomId();
    this.collaborationRoom = roomId;
    
    // Update UI
    this.updateCollaborationStatus('Room Created', roomId);
    
    // Show room details
    this.showSuccessMessage(`Room created: ${roomId}`);
  }

  async joinCollaborationRoom() {
    // Join an existing collaboration room
    const roomId = prompt('Enter room ID:');
    if (!roomId) return;
    
    this.collaborationRoom = roomId;
    
    // Update UI
    this.updateCollaborationStatus('Joined Room', roomId);
    
    // Show success message
    this.showSuccessMessage(`Joined room: ${roomId}`);
  }

  shareCurrentCoupon() {
    if (!this.currentCoupon) {
      this.showErrorMessage('No coupon to share');
      return;
    }
    
    // Generate shareable link
    const shareUrl = `${window.location.origin}?coupon=${btoa(JSON.stringify(this.currentCoupon))}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.showSuccessMessage('Coupon share link copied to clipboard!');
    }).catch(() => {
      this.showErrorMessage('Failed to copy share link');
    });
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  updateCollaborationStatus(status, details = '') {
    const roomStatus = document.getElementById('roomStatus');
    const activeUsers = document.getElementById('activeUsers');
    
    if (roomStatus) {
      roomStatus.textContent = status;
    }
    
    if (activeUsers) {
      activeUsers.textContent = details || '0';
    }
  }

  // Help Methods
  showHelp() {
    const helpContent = `
      <h3>Coupon Generator Help</h3>
      <h4>Keyboard Shortcuts:</h4>
      <ul>
        <li><kbd>Ctrl+G</kbd> - Generate coupon</li>
        <li><kbd>Ctrl+T</kbd> - Apply template</li>
        <li><kbd>Ctrl+S</kbd> - Save coupon</li>
        <li><kbd>Ctrl+L</kbd> - Load last coupon</li>
        <li><kbd>Ctrl+E</kbd> - Export coupon</li>
        <li><kbd>Ctrl+R</kbd> - Reset form</li>
        <li><kbd>Ctrl+A</kbd> - Analyze coupon</li>
        <li><kbd>Ctrl+H</kbd> - Show history</li>
      </ul>
      <h4>Features:</h4>
      <ul>
        <li>📋 Template Library - Pre-configured strategies</li>
        <li>🤖 Smart Mode - AI-powered optimizations</li>
        <li>⚡ Quick Actions - Fast access to common tasks</li>
        <li>📊 Analytics Dashboard - Performance tracking</li>
        <li>👥 Collaboration - Real-time sharing</li>
        <li>👁️ Advanced Preview - Multiple view modes</li>
      </ul>
    `;
    
    this.showHelpModal(helpContent);
  }

  showHelpModal(content) {
    const modal = document.createElement('div');
    modal.className = 'help-modal';
    modal.innerHTML = `
      <div class="help-content">
        <div class="help-header">
          <h3>Help & Documentation</h3>
          <button class="help-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="help-body">
          ${content}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // Placeholder methods for features to be implemented
  async getHistoricalPerformance() {
    // This would fetch historical performance data
    return {
      successRate: 65,
      avgConfidence: 70,
      avgOdds: 2.1,
      popularTemplates: new Map([['balanced', 45], ['safe', 30], ['aggressive', 25]])
    };
  }

  displayBatchResults(coupons) {
    const resultPanel = document.getElementById('result');
    if (!resultPanel) return;
    
    let html = '<div class="batch-results">';
    html += '<h4>Batch Generation Results</h4>';
    
    coupons.forEach((coupon, index) => {
      html += `
        <div class="batch-item">
          <h5>Coupon ${index + 1}</h5>
          ${this.generateCouponHTML(coupon)}
        </div>
      `;
    });
    
    html += '</div>';
    resultPanel.innerHTML = html;
  }

  displayCouponAnalysis(analysis) {
    const panel = document.getElementById('validation');
    if (!panel) return;
    
    panel.innerHTML = `
      <div class="analysis-results">
        <h4>Coupon Analysis</h4>
        <div class="analysis-metrics">
          <div class="metric">
            <span class="metric-label">Overall Confidence:</span>
            <span class="metric-value">${analysis.confidence}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Risk Level:</span>
            <span class="metric-value">${analysis.risk}%</span>
          </div>
          <div class="metric">
            <span class="metric-label">Expected Value:</span>
            <span class="metric-value">${analysis.value}%</span>
          </div>
        </div>
        <div class="recommendations">
          <h5>Recommendations:</h5>
          <ul>
            ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  // Additional utility methods
  resetForm() {
    const inputs = document.querySelectorAll('.controls input, .controls select');
    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else if (input.type === 'number') {
        input.value = input.defaultValue;
      } else {
        input.value = '';
      }
    });
    
    this.showSuccessMessage('Form reset successfully!');
  }

  exportCoupon() {
    if (!this.currentCoupon) {
      this.showErrorMessage('No coupon to export');
      return;
    }
    
    const dataStr = JSON.stringify(this.currentCoupon, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `coupon_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    this.showSuccessMessage('Coupon exported successfully!');
  }

  printCoupon() {
    if (!this.currentCoupon) {
      this.showErrorMessage('No coupon to print');
      return;
    }
    
    window.print();
    this.showSuccessMessage('Print dialog opened!');
  }

  calculateTimeRisk(coupon) {
    // Calculate time-based risk
    let risk = 0;
    
    if (coupon.selections) {
      coupon.selections.forEach(selection => {
        const minutesToStart = this.getMinutesToStart(selection);
        if (minutesToStart < 10) risk += 15;
        else if (minutesToStart < 30) risk += 5;
      });
    }
    
    return risk;
  }

  calculateCorrelationRisk(coupon) {
    // Calculate correlation risk between selections
    if (!coupon.selections || coupon.selections.length < 2) return 0;
    
    // Simple correlation calculation
    let risk = 0;
    const leagues = new Set();
    
    coupon.selections.forEach(selection => {
      if (selection.league) {
        if (leagues.has(selection.league)) {
          risk += 10;
        }
        leagues.add(selection.league);
      }
    });
    
    return risk;
  }

  getMinutesToStart(selection) {
    const startTime = selection.startTimeUnix || selection.startTime;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (startTime - now) / 60);
  }
}

// Initialize advanced features
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.couponAdvancedFeatures = new CouponAdvancedFeatures();
    });
  } else {
    window.couponAdvancedFeatures = new CouponAdvancedFeatures();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CouponAdvancedFeatures;
}
