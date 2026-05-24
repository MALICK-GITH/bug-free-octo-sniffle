// AI Confidence Calculator for Enhanced Coupon Generation
class AIConfidenceCalculator {
  constructor() {
    this.confidenceFactors = {
      historical: 0.35,
      realtime: 0.25,
      pattern: 0.20,
      volatility: 0.15,
      momentum: 0.05
    };
    
    this.confidenceBoosters = {
      streak: 0,
      timing: 0,
      league: 0,
      market: 0,
      weather: 0,
      injuries: 0
    };
    
    this.mlPredictions = new Map();
    this.historicalAccuracy = new Map();
    this.confidenceHistory = [];
    
    this.init();
  }

  async init() {
    console.log('🧠 AI Confidence Calculator Initializing...');
    
    // Load ML models
    await this.loadMLModels();
    
    // Load historical accuracy data
    await this.loadHistoricalAccuracy();
    
    // Initialize real-time monitoring
    this.setupRealTimeAnalysis();
    
    console.log('✅ AI Confidence Calculator Ready');
  }

  async loadMLModels() {
    try {
      // Load multiple ML models for ensemble prediction
      const models = ['confidence_v1', 'confidence_v2', 'confidence_v3'];
      
      for (const modelName of models) {
        try {
          const response = await fetch(`/api/ml/models/${modelName}`);
          if (response.ok) {
            const model = await response.json();
            this.mlPredictions.set(modelName, model);
            console.log(`📊 ML Model ${modelName} loaded`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to load model ${modelName}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ ML models not available, using fallback');
    }
  }

  async loadHistoricalAccuracy() {
    try {
      const response = await fetch('/api/history/accuracy');
      if (response.ok) {
        const accuracy = await response.json();
        this.historicalAccuracy = new Map(Object.entries(accuracy));
        console.log('📈 Historical accuracy data loaded');
      }
    } catch (error) {
      console.warn('⚠️ Historical accuracy not available');
    }
  }

  setupRealTimeAnalysis() {
    // Setup real-time confidence monitoring
    setInterval(() => {
      this.updateRealTimeConfidence();
    }, 10000); // Update every 10 seconds
    
    // Setup market condition monitoring
    setInterval(() => {
      this.updateMarketConfidence();
    }, 30000); // Update every 30 seconds
  }

  updateRealTimeConfidence() {
    // Update confidence based on real-time data
    const liveMatches = document.querySelectorAll('.match-card[data-live="true"]');
    
    liveMatches.forEach(match => {
      const matchId = match.dataset.matchId;
      const currentConfidence = this.extractMatchConfidence(match);
      const previousConfidence = this.getPreviousConfidence(matchId);
      
      if (previousConfidence) {
        const trend = this.calculateConfidenceTrend(previousConfidence, currentConfidence);
        this.updateConfidenceTrend(matchId, trend);
      }
      
      this.setPreviousConfidence(matchId, currentConfidence);
    });
  }

  updateMarketConfidence() {
    // Update confidence based on market conditions
    const marketConditions = this.analyzeMarketConditions();
    
    // Update market-based confidence booster
    if (marketConditions.stability > 0.8) {
      this.confidenceBoosters.market = 10;
    } else if (marketConditions.stability > 0.6) {
      this.confidenceBoosters.market = 5;
    } else {
      this.confidenceBoosters.market = 0;
    }
    
    if (marketConditions.liquidity === 'high') {
      this.confidenceBoosters.market += 5;
    }
    
    if (marketConditions.sentiment === 'bullish') {
      this.confidenceBoosters.market += 3;
    }
  }

  analyzeMarketConditions() {
    // Analyze current market conditions
    const allMatches = document.querySelectorAll('.match-card');
    const liveMatches = document.querySelectorAll('.match-card[data-live="true"]');
    
    // Calculate market stability
    const stability = this.calculateMarketStability(allMatches);
    
    // Calculate market liquidity
    const liquidity = this.calculateMarketLiquidity(allMatches);
    
    // Calculate market sentiment
    const sentiment = this.calculateMarketSentiment(liveMatches);
    
    return {
      stability,
      liquidity,
      sentiment,
      volatility: this.calculateMarketVolatility(allMatches)
    };
  }

  calculateMarketStability(matches) {
    // Calculate how stable the market is
    const odds = this.extractAllOdds(matches);
    if (odds.length < 2) return 0.5;
    
    // Calculate odds variance
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    const variance = odds.reduce((sum, odd) => sum + Math.pow(odd - avgOdds, 2), 0) / odds.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower variance = higher stability
    const stability = Math.max(0, Math.min(1, 1 - (standardDeviation / avgOdds)));
    
    return stability;
  }

  calculateMarketLiquidity(matches) {
    // Calculate market liquidity based on odds patterns
    const odds = this.extractAllOdds(matches);
    if (odds.length === 0) return 'medium';
    
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    
    // Lower average odds typically indicate higher liquidity
    if (avgOdds < 1.8) return 'high';
    if (avgOdds < 2.2) return 'medium';
    return 'low';
  }

  calculateMarketSentiment(liveMatches) {
    // Calculate market sentiment from live match movements
    const sentiments = [];
    
    liveMatches.forEach(match => {
      const sentiment = this.extractMatchSentiment(match);
      if (sentiment) sentiments.push(sentiment);
    });
    
    if (sentiments.length === 0) return 'neutral';
    
    const bullish = sentiments.filter(s => s === 'bullish').length;
    const bearish = sentiments.filter(s => s === 'bearish').length;
    
    if (bullish > bearish * 1.5) return 'bullish';
    if (bearish > bullish * 1.5) return 'bearish';
    return 'neutral';
  }

  calculateMarketVolatility(matches) {
    // Calculate market volatility
    const odds = this.extractAllOdds(matches);
    if (odds.length < 2) return 0.1;
    
    // Calculate price changes
    let totalVolatility = 0;
    for (let i = 1; i < odds.length; i++) {
      const change = Math.abs(odds[i] - odds[i-1]) / odds[i-1];
      totalVolatility += change;
    }
    
    return totalVolatility / (odds.length - 1);
  }

  extractAllOdds(matches) {
    const odds = [];
    
    matches.forEach(match => {
      const matchOdds = this.extractMatchOdds(match);
      odds.push(...matchOdds);
    });
    
    return odds.filter(o => o && !isNaN(o));
  }

  extractMatchOdds(match) {
    const oddsElements = match.querySelectorAll('.odd-box strong');
    const odds = [];
    
    oddsElements.forEach(element => {
      const odd = parseFloat(element.textContent);
      if (!isNaN(odd)) odds.push(odd);
    });
    
    return odds;
  }

  extractMatchConfidence(match) {
    // Extract confidence from match element
    const confidenceElement = match.querySelector('.confidence-score');
    if (confidenceElement) {
      return parseFloat(confidenceElement.textContent);
    }
    
    // Fallback: calculate from odds
    const odds = this.extractMatchOdds(match);
    if (odds.length > 0) {
      return this.calculateConfidenceFromOdds(odds);
    }
    
    return 50; // Default confidence
  }

  extractMatchSentiment(match) {
    // Extract sentiment from match indicators
    const sentimentIndicators = match.querySelectorAll('.sentiment-indicator');
    
    for (const indicator of sentimentIndicators) {
      const sentiment = indicator.dataset.sentiment;
      if (sentiment) return sentiment;
    }
    
    // Calculate from odds movements
    const oddsElements = match.querySelectorAll('.odd-box');
    for (const element of oddsElements) {
      if (element.classList.contains('odd-up')) return 'bullish';
      if (element.classList.contains('odd-down')) return 'bearish';
    }
    
    return null;
  }

  calculateConfidenceFromOdds(odds) {
    // Calculate confidence based on odds patterns
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    
    // Lower odds typically indicate higher confidence
    if (avgOdds < 1.5) return 85;
    if (avgOdds < 1.8) return 75;
    if (avgOdds < 2.2) return 65;
    if (avgOdds < 2.8) return 55;
    return 45;
  }

  calculateEnhancedConfidence(match, options = {}) {
    const {
      useML = true,
      useHistorical = true,
      useRealTime = true,
      usePatterns = true
    } = options;

    let confidence = 50; // Base confidence
    const factors = [];

    // Historical performance factor
    if (useHistorical) {
      const historicalFactor = this.calculateHistoricalFactor(match);
      factors.push({ name: 'historical', value: historicalFactor, weight: this.confidenceFactors.historical });
      confidence += historicalFactor * this.confidenceFactors.historical;
    }

    // Real-time factor
    if (useRealTime) {
      const realtimeFactor = this.calculateRealTimeFactor(match);
      factors.push({ name: 'realtime', value: realtimeFactor, weight: this.confidenceFactors.realtime });
      confidence += realtimeFactor * this.confidenceFactors.realtime;
    }

    // Pattern recognition factor
    if (usePatterns) {
      const patternFactor = this.calculatePatternFactor(match);
      factors.push({ name: 'pattern', value: patternFactor, weight: this.confidenceFactors.pattern });
      confidence += patternFactor * this.confidenceFactors.pattern;
    }

    // Volatility factor
    const volatilityFactor = this.calculateVolatilityFactor(match);
    factors.push({ name: 'volatility', value: volatilityFactor, weight: this.confidenceFactors.volatility });
    confidence += volatilityFactor * this.confidenceFactors.volatility;

    // Momentum factor
    const momentumFactor = this.calculateMomentumFactor(match);
    factors.push({ name: 'momentum', value: momentumFactor, weight: this.confidenceFactors.momentum });
    confidence += momentumFactor * this.confidenceFactors.momentum;

    // ML prediction factor
    if (useML && this.mlPredictions.size > 0) {
      const mlFactor = this.calculateMLFactor(match);
      factors.push({ name: 'ml', value: mlFactor, weight: 0.3 });
      confidence += mlFactor * 0.3;
    }

    // Apply confidence boosters
    const totalBooster = Object.values(this.confidenceBoosters).reduce((sum, booster) => sum + booster, 0);
    confidence += totalBooster;

    // Apply risk profile adjustment
    const riskProfile = options.riskProfile || 'balanced';
    confidence = this.applyRiskProfileAdjustment(confidence, riskProfile);

    // Ensure confidence is within bounds
    confidence = Math.max(0, Math.min(99, Math.round(confidence)));

    return {
      confidence,
      factors,
      boosters: { ...this.confidenceBoosters },
      breakdown: this.generateConfidenceBreakdown(confidence, factors)
    };
  }

  calculateHistoricalFactor(match) {
    // Calculate confidence based on historical performance
    const league = match.league || 'Unknown';
    const teamHome = match.teamHome || 'Unknown';
    const teamAway = match.teamAway || 'Unknown';
    
    let factor = 0;
    let count = 0;

    // League historical performance
    const leagueAccuracy = this.historicalAccuracy.get(`league_${league}`);
    if (leagueAccuracy) {
      factor += leagueAccuracy.accuracy;
      count++;
    }

    // Team historical performance
    const homeAccuracy = this.historicalAccuracy.get(`team_${teamHome}`);
    if (homeAccuracy) {
      factor += homeAccuracy.accuracy;
      count++;
    }

    const awayAccuracy = this.historicalAccuracy.get(`team_${teamAway}`);
    if (awayAccuracy) {
      factor += awayAccuracy.accuracy;
      count++;
    }

    return count > 0 ? factor / count : 50;
  }

  calculateRealTimeFactor(match) {
    // Calculate confidence based on real-time data
    const matchId = match.matchId;
    const currentOdds = this.extractMatchOdds(match);
    
    if (currentOdds.length === 0) return 50;

    // Check for odds stability
    const previousOdds = this.getPreviousOdds(matchId);
    if (previousOdds && previousOdds.length === currentOdds.length) {
      let stabilityScore = 0;
      
      for (let i = 0; i < currentOdds.length; i++) {
        const change = Math.abs(currentOdds[i] - previousOdds[i]) / previousOdds[i];
        
        if (change < 0.01) stabilityScore += 25; // Very stable
        else if (change < 0.02) stabilityScore += 15; // Stable
        else if (change < 0.05) stabilityScore += 5; // Somewhat stable
        else stabilityScore -= 10; // Unstable
      }
      
      return Math.max(0, Math.min(100, stabilityScore));
    }

    return 50; // No previous data available
  }

  calculatePatternFactor(match) {
    // Calculate confidence based on pattern recognition
    const patterns = this.identifyPatterns(match);
    let factor = 0;

    for (const pattern of patterns) {
      switch (pattern.type) {
        case 'winning_streak':
          factor += 15;
          break;
        case 'home_advantage':
          factor += 10;
          break;
        case 'underdog_performance':
          factor += 12;
          break;
        case 'league_leader':
          factor += 8;
          break;
        case 'derby_match':
          factor += 5;
          break;
        case 'revenge_match':
          factor += 7;
          break;
      }
    }

    return Math.min(100, factor);
  }

  identifyPatterns(match) {
    // Identify patterns in the match
    const patterns = [];

    // Check for winning streaks
    if (this.isWinningStreak(match)) {
      patterns.push({ type: 'winning_streak', confidence: 0.8 });
    }

    // Check for home advantage
    if (this.isHomeAdvantage(match)) {
      patterns.push({ type: 'home_advantage', confidence: 0.7 });
    }

    // Check for underdog performance
    if (this.isUnderdogPerformance(match)) {
      patterns.push({ type: 'underdog_performance', confidence: 0.6 });
    }

    // Check for league leader
    if (this.isLeagueLeader(match)) {
      patterns.push({ type: 'league_leader', confidence: 0.5 });
    }

    // Check for derby match
    if (this.isDerbyMatch(match)) {
      patterns.push({ type: 'derby_match', confidence: 0.4 });
    }

    // Check for revenge match
    if (this.isRevengeMatch(match)) {
      patterns.push({ type: 'revenge_match', confidence: 0.3 });
    }

    return patterns;
  }

  isWinningStreak(match) {
    // Check if team is on winning streak
    // This would require historical data lookup
    return false; // Placeholder
  }

  isHomeAdvantage(match) {
    // Check if home advantage applies
    return match.isHome === true;
  }

  isUnderdogPerformance(match) {
    // Check if underdog performs well
    const odds = this.extractMatchOdds(match);
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    return avgOdds > 2.0; // Underdog odds
  }

  isLeagueLeader(match) {
    // Check if team is league leader
    return false; // Placeholder
  }

  isDerbyMatch(match) {
    // Check if this is a derby match
    const league = match.league || '';
    return league.includes('derby') || league.includes('rivalry');
  }

  isRevengeMatch(match) {
    // Check if this is a revenge match
    return false; // Placeholder
  }

  calculateVolatilityFactor(match) {
    // Calculate confidence based on volatility analysis
    const matchId = match.matchId;
    const volatility = this.calculateMatchVolatility(matchId);
    
    // Lower volatility = higher confidence
    if (volatility < 0.01) return 20;
    if (volatility < 0.02) return 15;
    if (volatility < 0.05) return 10;
    if (volatility < 0.1) return 5;
    return -10; // High volatility reduces confidence
  }

  calculateMomentumFactor(match) {
    // Calculate confidence based on momentum
    const matchId = match.matchId;
    const momentum = this.calculateMatchMomentum(matchId);
    
    return Math.max(-20, Math.min(20, momentum));
  }

  calculateMLFactor(match) {
    // Calculate confidence using ML predictions
    let totalPrediction = 0;
    let modelCount = 0;

    for (const [modelName, model] of this.mlPredictions) {
      try {
        const features = this.extractMLFeatures(match);
        const prediction = model.predict(features);
        
        totalPrediction += prediction.confidence;
        modelCount++;
      } catch (error) {
        console.warn(`ML model ${modelName} prediction failed:`, error);
      }
    }

    return modelCount > 0 ? totalPrediction / modelCount : 50;
  }

  extractMLFeatures(match) {
    // Extract features for ML prediction
    const odds = this.extractMatchOdds(match);
    const avgOdds = odds.length > 0 ? odds.reduce((a, b) => a + b, 0) / odds.length : 1;
    
    return {
      odds: avgOdds,
      confidence: match.confiance || 50,
      stability: match.stabilityScore || 50,
      timing: this.calculateTimingScore(match),
      league: this.encodeLeague(match.league),
      isLive: match.isLive || false,
      minutesToStart: this.getMinutesToStart(match)
    };
  }

  encodeLeague(league) {
    // Encode league for ML model
    const leagueMap = {
      'premier_league': 1,
      'laliga': 2,
      'bundesliga': 3,
      'serie_a': 4,
      'ligue_1': 5
    };
    
    return leagueMap[league] || 0;
  }

  calculateTimingScore(match) {
    // Calculate timing score
    const minutesToStart = this.getMinutesToStart(match);
    
    if (minutesToStart >= 10 && minutesToStart <= 60) return 100;
    if (minutesToStart >= 5 && minutesToStart <= 120) return 80;
    if (minutesToStart >= 2 && minutesToStart <= 180) return 60;
    return 30;
  }

  getMinutesToStart(match) {
    const startTime = match.startTimeUnix;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (startTime - now) / 60);
  }

  applyRiskProfileAdjustment(confidence, riskProfile) {
    // Apply risk profile adjustment to confidence
    const adjustments = {
      ultra_safe: 1.2,
      safe: 1.1,
      balanced: 1.0,
      aggressive: 0.9,
      ultra_aggressive: 0.8
    };
    
    return confidence * (adjustments[riskProfile] || 1.0);
  }

  generateConfidenceBreakdown(confidence, factors) {
    // Generate detailed confidence breakdown
    const breakdown = {
      total: confidence,
      base: 50,
      adjustments: {}
    };

    for (const factor of factors) {
      breakdown.adjustments[factor.name] = {
        value: factor.value,
        weight: factor.weight,
        contribution: factor.value * factor.weight
      };
    }

    return breakdown;
  }

  // Helper methods
  getPreviousConfidence(matchId) {
    return this.confidenceHistory.find(entry => entry.matchId === matchId);
  }

  setPreviousConfidence(matchId, confidence) {
    this.confidenceHistory = this.confidenceHistory.filter(entry => entry.matchId !== matchId);
    this.confidenceHistory.push({ matchId, confidence, timestamp: Date.now() });
    
    // Keep only last 100 entries
    if (this.confidenceHistory.length > 100) {
      this.confidenceHistory = this.confidenceHistory.slice(-100);
    }
  }

  calculateConfidenceTrend(previous, current) {
    const change = current - previous;
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  updateConfidenceTrend(matchId, trend) {
    // Store confidence trend for analysis
    const trendData = {
      matchId,
      trend,
      timestamp: Date.now()
    };
    
    // This could be stored in a database or sent to analytics
    console.log('Confidence trend updated:', trendData);
  }

  getPreviousOdds(matchId) {
    // Get previous odds for comparison
    // This would typically come from a real-time feed
    return null; // Placeholder
  }

  calculateMatchVolatility(matchId) {
    // Calculate volatility for a specific match
    // This would use historical odds data
    return 0.05; // Placeholder
  }

  calculateMatchMomentum(matchId) {
    // Calculate momentum for a specific match
    // This would use recent performance data
    return 0; // Placeholder
  }

  // Public API methods
  async calculateMatchConfidence(match, options = {}) {
    return this.calculateEnhancedConfidence(match, options);
  }

  async calculateCouponConfidence(selections, options = {}) {
    const confidences = await Promise.all(
      selections.map(selection => this.calculateEnhancedConfidence(selection, options))
    );

    const avgConfidence = confidences.reduce((sum, c) => sum + c.confidence, 0) / confidences.length;
    const minConfidence = Math.min(...confidences.map(c => c.confidence));
    const maxConfidence = Math.max(...confidences.map(c => c.confidence));

    return {
      average: Math.round(avgConfidence),
      minimum: Math.round(minConfidence),
      maximum: Math.round(maxConfidence),
      individual: confidences,
      distribution: this.calculateConfidenceDistribution(confidences),
      risk: this.calculateCouponRisk(confidences),
      recommendation: this.generateCouponRecommendation(confidences, options)
    };
  }

  calculateConfidenceDistribution(confidences) {
    // Calculate confidence distribution
    const ranges = {
      high: confidences.filter(c => c.confidence >= 80).length,
      medium: confidences.filter(c => c.confidence >= 60 && c.confidence < 80).length,
      low: confidences.filter(c => c.confidence < 60).length
    };

    return {
      ...ranges,
      percentages: {
        high: (ranges.high / confidences.length) * 100,
        medium: (ranges.medium / confidences.length) * 100,
        low: (ranges.low / confidences.length) * 100
      }
    };
  }

  calculateCouponRisk(confidences) {
    // Calculate overall coupon risk
    const avgConfidence = confidences.reduce((sum, c) => sum + c.confidence, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c.confidence - avgConfidence, 2), 0) / confidences.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      level: avgConfidence >= 80 ? 'low' : avgConfidence >= 60 ? 'medium' : 'high',
      score: Math.round(100 - avgConfidence),
      volatility: Math.round(standardDeviation),
      consistency: Math.round(100 - standardDeviation)
    };
  }

  generateCouponRecommendation(confidences, options) {
    // Generate recommendation based on confidence analysis
    const avgConfidence = confidences.reduce((sum, c) => sum + c.confidence, 0) / confidences.length;
    const riskProfile = options.riskProfile || 'balanced';

    let recommendation = 'VALID';
    let reason = '';

    if (avgConfidence >= 85) {
      recommendation = 'STRONG_BUY';
      reason = 'Très haute confiance détectée';
    } else if (avgConfidence >= 75) {
      recommendation = 'BUY';
      reason = 'Haute confiance recommandée';
    } else if (avgConfidence >= 65) {
      recommendation = 'CONSIDER';
      reason = 'Confiance modérée, surveiller les évolutions';
    } else if (avgConfidence >= 55) {
      recommendation = 'CAUTIOUS';
      reason = 'Confiance faible, approche prudente recommandée';
    } else {
      recommendation = 'AVOID';
      reason = 'Confiance très faible, éviter le coupon';
    }

    return {
      recommendation,
      reason,
      confidence: Math.round(avgConfidence),
      riskProfile,
      suggestedStake: this.calculateSuggestedStake(avgConfidence, riskProfile)
    };
  }

  calculateSuggestedStake(confidence, riskProfile) {
    // Calculate suggested stake based on confidence and risk profile
    const baseStake = 1000;
    const confidenceMultiplier = confidence / 100;
    
    const riskMultipliers = {
      ultra_safe: 1.5,
      safe: 1.2,
      balanced: 1.0,
      aggressive: 0.8,
      ultra_aggressive: 0.6
    };

    return Math.round(baseStake * confidenceMultiplier * (riskMultipliers[riskProfile] || 1.0));
  }
}

// Initialize the AI confidence calculator
if (typeof window !== 'undefined') {
  window.aiConfidenceCalculator = new AIConfidenceCalculator();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIConfidenceCalculator;
}
