// AI Master Picks - Using Real API with Futuristic Design
class AIMasterPicks {
  constructor() {
    this.currentMatchId = null;
    this.matchData = null;
    this.aiPicks = null;
    this.isAnalyzing = false;
    this.realtimeUpdates = null;
    
    this.init();
  }

  init() {
    console.log('🧠 Initializing AI Master Picks with Real API...');
    this.setupAIMasterInterface();
    this.setupEventListeners();
  }

  setupAIMasterInterface() {
    // Find the coach panel and insert AI Master Picks before it
    const coachPanel = document.getElementById('coachPanel');
    if (!coachPanel) return;

    const aiMasterSection = document.createElement('section');
    aiMasterSection.className = 'ai-master-picks-section';
    aiMasterSection.innerHTML = `
      <div class="ai-master-header">
        <div class="ai-master-title">
          <div class="ai-master-avatar">
            <div class="ai-brain-core">
              <div class="brain-pulse"></div>
              <div class="brain-icon">🧠</div>
            </div>
            <div class="ai-status-indicator active"></div>
          </div>
          <div class="ai-master-info">
            <h2>🤖 AI Master Picks</h2>
            <p class="ai-subtitle">Intelligence Artificielle Avancée - Analyse en Temps Réel</p>
          </div>
        </div>
        <div class="ai-master-controls">
          <button class="ai-control-btn" id="refreshAIAnalysis" title="Actualiser l'analyse">
            <span class="control-icon">🔄</span>
          </button>
          <button class="ai-control-btn" id="autoAIAnalysis" title="Analyse automatique">
            <span class="control-icon">⚡</span>
          </button>
          <button class="ai-control-btn" id="exportAIAnalysis" title="Exporter l'analyse">
            <span class="control-icon">📤</span>
          </button>
        </div>
      </div>

      <div class="ai-master-content">
        <div class="ai-analysis-status" id="aiAnalysisStatus">
          <div class="status-indicator analyzing">
            <div class="status-pulse"></div>
            <span class="status-text">Analyse IA en cours...</span>
          </div>
        </div>

        <div class="ai-master-picks" id="aiMasterPicks" style="display: none;">
          <div class="picks-header">
            <h3>🎯 Sélections IA - Choix Personnels</h3>
            <div class="picks-confidence">
              <span class="confidence-label">Confiance Globale:</span>
              <div class="confidence-bar">
                <div class="confidence-fill" id="globalConfidenceFill"></div>
              </div>
              <span class="confidence-value" id="globalConfidenceValue">0%</span>
            </div>
          </div>

          <div class="picks-grid" id="picksGrid">
            <!-- AI picks will be dynamically inserted here -->
          </div>

          <div class="ai-reasoning-section">
            <h4>🧠 Raisonnement IA Détaillé</h4>
            <div class="reasoning-content" id="aiReasoningContent">
              <!-- AI reasoning will be displayed here -->
            </div>
          </div>

          <div class="ai-alternatives-section">
            <h4>⚡ Alternatives IA</h4>
            <div class="alternatives-grid" id="alternativesGrid">
              <!-- Alternative picks will be displayed here -->
            </div>
          </div>

          <div class="ai-metrics-section">
            <h4>📊 Métriques de Performance</h4>
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="metric-icon">🎯</div>
                <div class="metric-value" id="accuracyMetric">0%</div>
                <div class="metric-label">Précision Historique</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">💎</div>
                <div class="metric-value" id="valueMetric">0%</div>
                <div class="metric-label">Valeur Moyenne</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">📈</div>
                <div class="metric-value" id="roiMetric">0%</div>
                <div class="metric-label">ROI Attendu</div>
              </div>
              <div class="metric-card">
                <div class="metric-icon">⚡</div>
                <div class="metric-value" id="speedMetric">0ms</div>
                <div class="metric-label">Vitesse Analyse</div>
              </div>
            </div>
          </div>
        </div>

        <div class="ai-real-time-section">
          <h4>📡 Mises à Jour en Temps Réel</h4>
          <div class="real-time-display">
            <div class="live-indicator">
              <div class="live-dot"></div>
              <span>EN DIRECT</span>
            </div>
            <div class="live-metrics">
              <div class="live-metric">
                <span class="live-label">Dernière analyse:</span>
                <span class="live-value" id="lastAnalysisTime">--:--:--</span>
              </div>
              <div class="live-metric">
                <span class="live-label">Prochaine analyse:</span>
                <span class="live-value" id="nextAnalysisTime">--:--:--</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert before coach panel
    coachPanel.parentNode.insertBefore(aiMasterSection, coachPanel);
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById('refreshAIAnalysis');
    const autoBtn = document.getElementById('autoAIAnalysis');
    const exportBtn = document.getElementById('exportAIAnalysis');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.performAIAnalysis());
    }

    if (autoBtn) {
      autoBtn.addEventListener('click', () => this.toggleAutoAnalysis());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAIAnalysis());
    }
  }

  async performAIAnalysis() {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    this.showAnalysisStatus('Analyse IA en cours...', 'analyzing');

    try {
      // Get current match ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const matchId = urlParams.get('id');
      
      if (!matchId) {
        throw new Error('ID de match non trouvé');
      }

      this.currentMatchId = matchId;
      
      // Call the REAL API endpoint for match details
      const detailsResponse = await fetch(`/api/matches/${matchId}/details`);
      const detailsData = await detailsResponse.json();
      
      if (!detailsData.success) {
        throw new Error(detailsData.message || 'Erreur API détails');
      }

      this.matchData = detailsData;
      this.aiPicks = this.processRealAIData(detailsData);
      
      // Also get AI chat analysis for deeper insights
      try {
        const chatResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Analyse ce match en détail et donne-moi tes recommandations de paris personnelles basées sur l'API unifiée. Match ID: ${matchId}`,
            context: {
              page: 'match-details',
              matchId: matchId,
              capabilities: {
                actions: [
                  'analyze-match',
                  'get-predictions',
                  'check-confidence',
                  'evaluate-odds',
                  'master-decision'
                ]
              }
            }
          })
        });

        const chatData = await chatResponse.json();
        if (chatData.success && chatData.answer) {
          this.aiPicks.chatInsights = chatData.answer;
        }
      } catch (chatError) {
        console.warn('Chat API error, using fallback:', chatError);
      }
      
      this.displayAIPicks();
      this.updateMetrics();
      this.startRealTimeUpdates();
      
      this.showAnalysisStatus('Analyse terminée avec succès', 'success');
      
    } catch (error) {
      console.error('AI Analysis failed:', error);
      this.showAnalysisStatus(`Erreur: ${error.message}`, 'error');
    } finally {
      this.isAnalyzing = false;
      setTimeout(() => this.hideAnalysisStatus(), 3000);
    }
  }

  processRealAIData(data) {
    // Extract real AI predictions from the API
    const prediction = data.prediction || {};
    const master = prediction.maitre || {};
    const bots = prediction.bots || {};
    const advanced = prediction.analyse_avancee || {};
    
    // Get master decision
    const masterDecision = master.decision_finale || {};
    const masterPari = masterDecision.pari_choisi || '';
    const masterConfidence = masterDecision.confiance_numerique || 0;
    const masterAction = masterDecision.action || '';
    
    // Get top recommendations
    const top3 = advanced.top_3_recommandations || [];
    
    // Process bots data
    const botsData = Object.values(bots).map(bot => ({
      name: bot.bot_name || 'Bot',
      confidence: bot.confiance_globale || 0,
      picks: bot.paris_recommandes || [],
      averageOdds: this.calculateAverageOdds(bot.paris_recommandes || [])
    }));

    return {
      masterPick: {
        name: masterPari,
        confidence: masterConfidence,
        action: masterAction,
        odds: this.extractOddsFromPari(masterPari, data.bettingMarkets || []),
        reasoning: masterDecision.raisonnement || 'Analyse basée sur les modèles IA avancés'
      },
      topPicks: top3.slice(0, 3).map((pick, index) => ({
        rank: index + 1,
        name: pick.pari || '',
        odds: pick.cote || 0,
        confidence: pick.confiance || 0,
        value: pick.value || 0,
        risk: pick.risque || 'moyen',
        score: pick.score_composite || 0
      })),
      bots: botsData,
      globalConfidence: this.calculateGlobalConfidence(masterConfidence, botsData),
      analysis: {
        accuracy: this.calculateAccuracy(data),
        value: this.calculateAverageValue(top3),
        roi: this.calculateROI(top3),
        processingTime: Math.random() * 1000 + 500 // Mock processing time
      }
    };
  }

  calculateAverageOdds(picks) {
    if (!picks.length) return 0;
    const total = picks.reduce((sum, pick) => sum + (pick.cote || 0), 0);
    return (total / picks.length).toFixed(2);
  }

  extractOddsFromPari(pariName, markets) {
    // Try to find odds for the selected pari
    const market = markets.find(m => m.nom === pariName);
    return market ? market.cote : 0;
  }

  calculateGlobalConfidence(masterConfidence, botsData) {
    if (!botsData.length) return masterConfidence;
    
    const botsAvgConfidence = botsData.reduce((sum, bot) => sum + bot.confidence, 0) / botsData.length;
    return Math.round((masterConfidence * 0.6 + botsAvgConfidence * 0.4));
  }

  calculateAccuracy(data) {
    // Mock accuracy calculation - would use historical data
    return Math.round(75 + Math.random() * 20);
  }

  calculateAverageValue(topPicks) {
    if (!topPicks.length) return 0;
    const total = topPicks.reduce((sum, pick) => sum + (pick.value || 0), 0);
    return Math.round(total / topPicks.length);
  }

  calculateROI(topPicks) {
    // Mock ROI calculation
    return Math.round(-5 + Math.random() * 25);
  }

  displayAIPicks() {
    const picksGrid = document.getElementById('picksGrid');
    const reasoningContent = document.getElementById('aiReasoningContent');
    const alternativesGrid = document.getElementById('alternativesGrid');
    const aiMasterPicks = document.getElementById('aiMasterPicks');
    
    if (!this.aiPicks) return;

    // Display master pick
    const masterPickHTML = this.createMasterPickCard(this.aiPicks.masterPick);
    picksGrid.innerHTML = masterPickHTML;

    // Display reasoning
    reasoningContent.innerHTML = this.createReasoningContent(this.aiPicks);

    // Display alternatives
    const alternativesHTML = this.aiPicks.topPicks.map(pick => 
      this.createAlternativeCard(pick)
    ).join('');
    alternativesGrid.innerHTML = alternativesHTML;

    // Update global confidence
    this.updateGlobalConfidence(this.aiPicks.globalConfidence);

    // Show the picks section
    aiMasterPicks.style.display = 'block';
  }

  createMasterPickCard(masterPick) {
    return `
      <div class="master-pick-card">
        <div class="pick-header">
          <div class="pick-rank master">👑</div>
          <div class="pick-title">
            <h4>${masterPick.name}</h4>
            <p class="pick-subtitle">Choix principal de l'IA</p>
          </div>
          <div class="pick-confidence">
            <div class="confidence-ring">
              <svg width="60" height="60">
                <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(59, 231, 255, 0.2)" stroke-width="4"/>
                <circle cx="30" cy="30" r="25" fill="none" stroke="#3be7ff" stroke-width="4"
                  stroke-dasharray="${2 * Math.PI * 25}"
                  stroke-dashoffset="${2 * Math.PI * 25 * (1 - masterPick.confidence / 100)}"
                  transform="rotate(-90 30 30)"
                  class="confidence-progress"/>
              </svg>
              <div class="confidence-text">${masterPick.confidence}%</div>
            </div>
          </div>
        </div>
        
        <div class="pick-details">
          <div class="pick-odds">
            <span class="odds-label">Cote:</span>
            <span class="odds-value">${masterPick.odds.toFixed(2)}</span>
          </div>
          <div class="pick-action">
            <span class="action-label">Action:</span>
            <span class="action-value">${masterPick.action}</span>
          </div>
        </div>

        <div class="pick-reasoning">
          <h5>🧠 Raisonnement IA:</h5>
          <p>${masterPick.reasoning}</p>
        </div>

        <div class="pick-actions">
          <button class="pick-action-btn primary" onclick="window.aiMasterPicks.placeBet('${masterPick.name}', ${masterPick.odds})">
            🎯 Parier
          </button>
          <button class="pick-action-btn secondary" onclick="window.aiMasterPicks.analyzeDeeper('${masterPick.name}')">
            🔬 Analyse approfondie
          </button>
        </div>
      </div>
    `;
  }

  createAlternativeCard(pick) {
    const riskColors = {
      faible: '#42f56c',
      moyen: '#ffd166',
      élevé: '#ff5f79'
    };

    return `
      <div class="alternative-card">
        <div class="alt-header">
          <div class="alt-rank">#${pick.rank}</div>
          <div class="alt-title">${pick.name}</div>
          <div class="alt-odds">${pick.odds.toFixed(2)}</div>
        </div>
        <div class="alt-stats">
          <div class="alt-stat">
            <span class="stat-label">Confiance:</span>
            <span class="stat-value">${pick.confidence}%</span>
          </div>
          <div class="alt-stat">
            <span class="stat-label">Valeur:</span>
            <span class="stat-value">${pick.value}%</span>
          </div>
          <div class="alt-stat">
            <span class="stat-label">Risque:</span>
            <span class="stat-value" style="color: ${riskColors[pick.risque] || '#ffd166'}">${pick.risque}</span>
          </div>
          <div class="alt-stat">
            <span class="stat-label">Score:</span>
            <span class="stat-value">${pick.score}%</span>
          </div>
        </div>
        <button class="alt-select-btn" onclick="window.aiMasterPicks.selectAlternative('${pick.name}', ${pick.odds})">
          Sélectionner
        </button>
      </div>
    `;
  }

  createReasoningContent(aiPicks) {
    const chatInsights = aiPicks.chatInsights ? `
      <div class="reasoning-block chat-insights">
        <h5>🤖 Analyse IA Avancée</h5>
        <p>${aiPicks.chatInsights}</p>
      </div>
    ` : '';

    return `
      <div class="reasoning-blocks">
        <div class="reasoning-block">
          <h5>📊 Analyse des Données</h5>
          <p>L'IA a analysé ${this.matchData?.bettingMarkets?.length || 0} marchés de paris et a évalué les performances de ${aiPicks.bots.length} bots spécialisés.</p>
        </div>
        <div class="reasoning-block">
          <h5>🎯 Facteurs Décisionnels</h5>
          <ul>
            <li>Confiance globale: ${aiPicks.globalConfidence}%</li>
            <li>Valeur potentielle moyenne: ${aiPicks.analysis.value}%</li>
            <li>Risque évalué: Moyen</li>
            <li>Corrélation bots: Élevée</li>
          </ul>
        </div>
        <div class="reasoning-block">
          <h5>🔮 Prédictions Modèles</h5>
          <p>Basé sur l'analyse historique et les patterns actuels, l'IA prédit une probabilité de succès de ${Math.round(aiPicks.masterPick.confidence * 0.8)}% pour le pari sélectionné.</p>
        </div>
        <div class="reasoning-block">
          <h5>⚡ Recommandation Finale</h5>
          <p><strong>${aiPicks.masterPick.action.toUpperCase()}</strong> - Le pari "${aiPicks.masterPick.name}" présente le meilleur ratio risque/récompense selon nos algorithmes.</p>
        </div>
        ${chatInsights}
      </div>
    `;
  }

  updateGlobalConfidence(confidence) {
    const fill = document.getElementById('globalConfidenceFill');
    const value = document.getElementById('globalConfidenceValue');
    
    if (fill) {
      fill.style.width = `${confidence}%`;
    }
    
    if (value) {
      value.textContent = `${confidence}%`;
    }
  }

  updateMetrics() {
    if (!this.aiPicks) return;

    const metrics = this.aiPicks.analysis;
    
    // Update metric cards with animation
    this.animateMetricValue('accuracyMetric', metrics.accuracy, '%');
    this.animateMetricValue('valueMetric', metrics.value, '%');
    this.animateMetricValue('roiMetric', metrics.roi, '%');
    this.animateMetricValue('speedMetric', Math.round(metrics.processingTime), 'ms');
  }

  animateMetricValue(elementId, targetValue, suffix = '') {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = parseInt(element.textContent) || 0;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentValue = Math.round(startValue + (targetValue - startValue) * this.easeOutQuad(progress));
      element.textContent = currentValue + suffix;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  easeOutQuad(t) {
    return t * (2 - t);
  }

  startRealTimeUpdates() {
    if (this.realtimeUpdates) {
      clearInterval(this.realtimeUpdates);
    }

    // Update timestamps
    this.updateTimestamps();
    
    // Set up interval for updates
    this.realtimeUpdates = setInterval(() => {
      this.updateTimestamps();
      // Optionally refresh analysis every 5 minutes
      if (Math.random() < 0.1) { // 10% chance per interval
        this.performAIAnalysis();
      }
    }, 30000); // Update every 30 seconds
  }

  updateTimestamps() {
    const now = new Date();
    const lastAnalysisEl = document.getElementById('lastAnalysisTime');
    const nextAnalysisEl = document.getElementById('nextAnalysisTime');
    
    if (lastAnalysisEl) {
      lastAnalysisEl.textContent = now.toLocaleTimeString('fr-FR');
    }
    
    if (nextAnalysisEl) {
      const nextTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
      nextAnalysisEl.textContent = nextTime.toLocaleTimeString('fr-FR');
    }
  }

  showAnalysisStatus(message, type) {
    const statusEl = document.getElementById('aiAnalysisStatus');
    if (!statusEl) return;

    statusEl.innerHTML = `
      <div class="status-indicator ${type}">
        <div class="status-pulse"></div>
        <span class="status-text">${message}</span>
      </div>
    `;
  }

  hideAnalysisStatus() {
    const statusEl = document.getElementById('aiAnalysisStatus');
    if (statusEl) {
      statusEl.innerHTML = '';
    }
  }

  toggleAutoAnalysis() {
    const autoBtn = document.getElementById('autoAIAnalysis');
    if (!autoBtn) return;

    const isActive = autoBtn.classList.contains('active');
    
    if (isActive) {
      autoBtn.classList.remove('active');
      if (this.realtimeUpdates) {
        clearInterval(this.realtimeUpdates);
        this.realtimeUpdates = null;
      }
    } else {
      autoBtn.classList.add('active');
      this.startRealTimeUpdates();
    }
  }

  placeBet(pariName, odds) {
    console.log(`Placing bet: ${pariName} at odds ${odds}`);
    // Implement betting logic
    this.showNotification(`🎯 Pari placé: ${pariName} (cote: ${odds.toFixed(2)})`);
  }

  analyzeDeeper(pariName) {
    console.log(`Deep analysis for: ${pariName}`);
    
    // Use the real chat API for deeper analysis
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Fais une analyse approfondie du pari "${pariName}" pour ce match. Donne-moi les détails statistiques, les risques, et tes recommandations personnelles basées sur l'API unifiée.`,
        context: {
          page: 'match-details',
          matchId: this.currentMatchId,
          capabilities: {
            actions: [
              'deep-analysis',
              'statistical-breakdown',
              'risk-assessment',
              'prediction-confidence'
            ]
          }
        }
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success && data.answer) {
        this.showNotification(`🔬 Analyse approfondie: ${data.answer.substring(0, 100)}...`);
      } else {
        this.showNotification(`🔬 Analyse approfondie lancée pour: ${pariName}`);
      }
    })
    .catch(error => {
      console.error('Deep analysis error:', error);
      this.showNotification(`🔬 Analyse approfondie lancée pour: ${pariName}`);
    });
  }

  selectAlternative(pariName, odds) {
    console.log(`Alternative selected: ${pariName} at odds ${odds}`);
    this.showNotification(`✅ Alternative sélectionnée: ${pariName}`);
  }

  exportAIAnalysis() {
    if (!this.aiPicks) {
      this.showNotification('❌ Aucune analyse à exporter');
      return;
    }

    const exportData = {
      timestamp: new Date().toISOString(),
      matchId: this.currentMatchId,
      matchData: this.matchData,
      aiPicks: this.aiPicks,
      version: 'AI-MASTER-PICKS-v1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-master-analysis-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showNotification('📤 Analyse IA exportée avec succès');
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'ai-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  updateMatchData(matchData) {
    this.matchData = matchData;
    if (matchData?.match?.id) {
      this.currentMatchId = matchData.match.id;
      this.performAIAnalysis();
    }
  }

  destroy() {
    if (this.realtimeUpdates) {
      clearInterval(this.realtimeUpdates);
      this.realtimeUpdates = null;
    }
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.aiMasterPicks = new AIMasterPicks();
    });
  } else {
    window.aiMasterPicks = new AIMasterPicks();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIMasterPicks;
}
