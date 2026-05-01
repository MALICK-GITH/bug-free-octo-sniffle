// Advanced Coupon Generation Engine - Enhanced Power & Confidence
class AdvancedCouponEngine {
  constructor() {
    this.mlModel = null;
    this.confidenceThresholds = {
      ultra_safe: 85,
      safe: 75,
      balanced: 65,
      aggressive: 55,
      ultra_aggressive: 45
    };
    this.riskMultipliers = {
      ultra_safe: 0.8,
      safe: 1.0,
      balanced: 1.2,
      aggressive: 1.5,
      ultra_aggressive: 2.0
    };
    this.confidenceBoosters = new Map();
    this.marketAnalyzer = new MarketAnalyzer();
    this.predictionEngine = new PredictionEngine();
    this.bankrollOptimizer = new BankrollOptimizer();
    
    this.init();
  }

  async init() {
    console.log('🚀 Advanced Coupon Engine Initializing...');
    
    // Initialize ML model
    await this.initializeMLModel();
    
    // Load historical data
    await this.loadHistoricalData();
    
    // Setup real-time monitoring
    this.setupRealTimeMonitoring();
    
    // Initialize confidence boosters
    this.initializeConfidenceBoosters();
    
    console.log('✅ Advanced Coupon Engine Ready');
  }

  async initializeMLModel() {
    try {
      // Load pre-trained model weights
      const modelResponse = await fetch('/api/ml/model-weights');
      if (modelResponse.ok) {
        this.mlModel = await modelResponse.json();
        console.log('🧠 ML Model loaded successfully');
      }
    } catch (error) {
      console.warn('⚠️ ML Model not available, using fallback logic');
      this.mlModel = this.createFallbackModel();
    }
  }

  createFallbackModel() {
    return {
      weights: {
        confidence: 0.35,
        timing: 0.25,
        stability: 0.20,
        correlation: 0.15,
        momentum: 0.05
      },
      predict: (features) => {
        // Enhanced prediction algorithm
        const confidence = features.confidence * 0.35;
        const timing = features.timing * 0.25;
        const stability = features.stability * 0.20;
        const correlation = (100 - features.correlation) * 0.15;
        const momentum = features.momentum * 0.05;
        
        return Math.min(99, confidence + timing + stability + correlation + momentum);
      }
    };
  }

  async loadHistoricalData() {
    try {
      const response = await fetch('/api/history/performance');
      if (response.ok) {
        const data = await response.json();
        this.historicalData = data;
        this.analyzePatterns();
      }
    } catch (error) {
      console.warn('⚠️ Historical data not available');
      this.historicalData = [];
    }
  }

  analyzePatterns() {
    // Analyze winning patterns
    this.patterns = {
      timeOfDay: this.analyzeTimePatterns(),
      dayOfWeek: this.analyzeDayPatterns(),
      leaguePerformance: this.analyzeLeaguePatterns(),
      oddsRanges: this.analyzeOddsPatterns()
    };
  }

  analyzeTimePatterns() {
    const timeStats = new Map();
    
    for (const entry of this.historicalData) {
      const hour = new Date(entry.timestamp).getHours();
      const timeSlot = this.getTimeSlot(hour);
      
      if (!timeStats.has(timeSlot)) {
        timeStats.set(timeSlot, { wins: 0, total: 0 });
      }
      
      const stats = timeStats.get(timeSlot);
      stats.total++;
      if (entry.success) stats.wins++;
    }
    
    return timeStats;
  }

  analyzeDayPatterns() {
    const dayStats = new Map();
    
    for (const entry of this.historicalData) {
      const day = new Date(entry.timestamp).getDay();
      const dayName = this.getDayName(day);
      
      if (!dayStats.has(dayName)) {
        dayStats.set(dayName, { wins: 0, total: 0 });
      }
      
      const stats = dayStats.get(dayName);
      stats.total++;
      if (entry.success) stats.wins++;
    }
    
    return dayStats;
  }

  analyzeLeaguePatterns() {
    const leagueStats = new Map();
    
    for (const entry of this.historicalData) {
      const league = entry.league || 'Unknown';
      
      if (!leagueStats.has(league)) {
        leagueStats.set(league, { wins: 0, total: 0, avgOdds: 0 });
      }
      
      const stats = leagueStats.get(league);
      stats.total++;
      if (entry.success) stats.wins++;
      stats.avgOdds = (stats.avgOdds + (entry.odds || 0)) / 2;
    }
    
    return leagueStats;
  }

  analyzeOddsPatterns() {
    const oddsRanges = {
      '1.0-1.5': { wins: 0, total: 0 },
      '1.5-2.0': { wins: 0, total: 0 },
      '2.0-2.5': { wins: 0, total: 0 },
      '2.5+': { wins: 0, total: 0 }
    };
    
    for (const entry of this.historicalData) {
      const odds = entry.odds || 0;
      const range = this.getOddsRange(odds);
      
      oddsRanges[range].total++;
      if (entry.success) oddsRanges[range].wins++;
    }
    
    return oddsRanges;
  }

  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  getDayName(day) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[day];
  }

  getOddsRange(odds) {
    if (odds < 1.5) return '1.0-1.5';
    if (odds < 2.0) return '1.5-2.0';
    if (odds < 2.5) return '2.0-2.5';
    return '2.5+';
  }

  setupRealTimeMonitoring() {
    // Monitor live odds changes
    this.oddsMonitor = setInterval(() => {
      this.updateOddsConfidence();
    }, 5000); // Update every 5 seconds
    
    // Monitor market conditions
    this.marketMonitor = setInterval(() => {
      this.analyzeMarketConditions();
    }, 30000); // Update every 30 seconds
  }

  updateOddsConfidence() {
    const liveMatches = document.querySelectorAll('.match-card[data-live="true"]');
    
    liveMatches.forEach(match => {
      const matchId = match.dataset.matchId;
      const currentOdds = this.extractCurrentOdds(match);
      
      if (this.previousOdds && this.previousOdds.has(matchId)) {
        const previousOdds = this.previousOdds.get(matchId);
        const volatility = this.calculateVolatility(previousOdds, currentOdds);
        
        // Update confidence based on volatility
        this.updateMatchConfidence(matchId, volatility);
      }
      
      this.previousOdds = this.previousOdds || new Map();
      this.previousOdds.set(matchId, currentOdds);
    });
  }

  extractCurrentOdds(matchElement) {
    const oddsElements = matchElement.querySelectorAll('.odd-box strong');
    const odds = [];
    
    oddsElements.forEach(element => {
      const odd = parseFloat(element.textContent);
      if (!isNaN(odd)) odds.push(odd);
    });
    
    return odds;
  }

  calculateVolatility(previousOdds, currentOdds) {
    if (!previousOdds || !currentOdds || previousOdds.length !== currentOdds.length) {
      return 0;
    }
    
    let totalVolatility = 0;
    for (let i = 0; i < previousOdds.length; i++) {
      const change = Math.abs(currentOdds[i] - previousOdds[i]) / previousOdds[i];
      totalVolatility += change;
    }
    
    return totalVolatility / previousOdds.length;
  }

  updateMatchConfidence(matchId, volatility) {
    let confidenceAdjustment = 0;
    
    if (volatility > 0.05) confidenceAdjustment = -10; // High volatility
    else if (volatility > 0.02) confidenceAdjustment = -5; // Medium volatility
    else if (volatility < 0.01) confidenceAdjustment = 5; // Stable odds
    
    this.confidenceBoosters.set(matchId, confidenceAdjustment);
  }

  analyzeMarketConditions() {
    // Analyze overall market conditions
    const marketConditions = {
      volatility: this.calculateMarketVolatility(),
      liquidity: this.assessMarketLiquidity(),
      sentiment: this.analyzeMarketSentiment(),
      pressure: this.detectMarketPressure()
    };
    
    // Adjust generation strategy based on conditions
    this.adjustStrategyForConditions(marketConditions);
  }

  calculateMarketVolatility() {
    // Calculate overall market volatility
    const allOdds = this.getAllCurrentOdds();
    if (allOdds.length < 2) return 0;
    
    let totalVolatility = 0;
    for (let i = 1; i < allOdds.length; i++) {
      const change = Math.abs(allOdds[i] - allOdds[i-1]) / allOdds[i-1];
      totalVolatility += change;
    }
    
    return totalVolatility / (allOdds.length - 1);
  }

  assessMarketLiquidity() {
    // Assess market liquidity based on odds patterns
    const odds = this.getAllCurrentOdds();
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    
    // Higher average odds typically indicate lower liquidity
    if (avgOdds > 2.5) return 'low';
    if (avgOdds > 2.0) return 'medium';
    return 'high';
  }

  analyzeMarketSentiment() {
    // Analyze market sentiment based on odds movements
    const sentimentScore = this.calculateSentimentScore();
    
    if (sentimentScore > 0.1) return 'bullish';
    if (sentimentScore < -0.1) return 'bearish';
    return 'neutral';
  }

  detectMarketPressure() {
    // Detect market pressure indicators
    const pressure = this.calculateMarketPressure();
    
    if (pressure > 0.8) return 'high';
    if (pressure > 0.5) return 'medium';
    return 'low';
  }

  adjustStrategyForConditions(conditions) {
    // Adjust generation strategy based on market conditions
    this.currentStrategy = {
      riskAdjustment: 1.0,
      confidenceThreshold: 65,
      timingWeight: 0.25,
      stabilityWeight: 0.20
    };
    
    // Adjust for volatility
    if (conditions.volatility > 0.05) {
      this.currentStrategy.riskAdjustment *= 0.8;
      this.currentStrategy.confidenceThreshold += 10;
    }
    
    // Adjust for liquidity
    if (conditions.liquidity === 'low') {
      this.currentStrategy.confidenceThreshold += 15;
      this.currentStrategy.timingWeight += 0.1;
    }
    
    // Adjust for sentiment
    if (conditions.sentiment === 'bearish') {
      this.currentStrategy.riskAdjustment *= 0.9;
      this.currentStrategy.confidenceThreshold += 5;
    }
    
    // Adjust for pressure
    if (conditions.pressure === 'high') {
      this.currentStrategy.confidenceThreshold += 10;
      this.currentStrategy.stabilityWeight += 0.1;
    }
  }

  async generateAdvancedCoupon(options = {}) {
    const {
      size = 3,
      riskProfile = 'balanced',
      league = 'all',
      useML = true,
      usePatterns = true,
      useRealTime = true
    } = options;

    console.log(`🎫 Generating Advanced Coupon: ${size} picks, ${riskProfile} risk`);

    try {
      // Get available matches
      const matches = await this.getAvailableMatches(league);
      
      // Filter and score matches using advanced algorithms
      const scoredMatches = await this.scoreMatches(matches, {
        riskProfile,
        useML,
        usePatterns,
        useRealTime
      });
      
      // Select optimal combination
      const selectedMatches = this.selectOptimalCombination(scoredMatches, size, riskProfile);
      
      // Calculate advanced metrics
      const metrics = this.calculateAdvancedMetrics(selectedMatches, riskProfile);
      
      // Generate coupon with enhanced confidence
      const coupon = {
        selections: selectedMatches,
        metrics,
        confidence: this.calculateOverallConfidence(selectedMatches, metrics),
        riskProfile,
        generatedAt: new Date().toISOString(),
        strategy: this.currentStrategy,
        marketConditions: this.getCurrentMarketConditions()
      };
      
      // Validate and optimize
      const optimizedCoupon = await this.validateAndOptimizeCoupon(coupon);
      
      console.log('✅ Advanced Coupon Generated', optimizedCoupon);
      return optimizedCoupon;
      
    } catch (error) {
      console.error('❌ Advanced Coupon Generation Failed:', error);
      throw error;
    }
  }

  async getAvailableMatches(league) {
    try {
      const response = await fetch(`/api/matches?league=${league}&include=upcoming,live`);
      const data = await response.json();
      
      if (!data.success || !data.matches) {
        throw new Error('Failed to fetch matches');
      }
      
      return data.matches.filter(match => 
        match.startTimeUnix > Math.floor(Date.now() / 1000) + 300 // 5 minutes minimum
      );
      
    } catch (error) {
      console.error('Error fetching matches:', error);
      return [];
    }
  }

  async scoreMatches(matches, options) {
    const scoredMatches = [];
    
    for (const match of matches) {
      const score = await this.calculateMatchScore(match, options);
      scoredMatches.push({
        ...match,
        score,
        confidence: score.confidence,
        risk: score.risk,
        value: score.value
      });
    }
    
    // Sort by score (highest first)
    return scoredMatches.sort((a, b) => b.score - a.score);
  }

  async calculateMatchScore(match, options) {
    let score = 0;
    let confidence = 50;
    let risk = 0.5;
    let value = 1.0;
    
    // Base confidence from API
    confidence = Number(match.confiance) || 50;
    
    // ML prediction if available
    if (options.useML && this.mlModel) {
      const mlPrediction = this.mlModel.predict({
        confidence: match.confiance,
        timing: this.getTimingScore(match),
        stability: match.stabilityScore || 50,
        correlation: this.calculateCorrelationRisk(match),
        momentum: this.calculateMomentum(match)
      });
      
      confidence = (confidence + mlPrediction) / 2;
      score += mlPrediction * 2;
    }
    
    // Pattern analysis if enabled
    if (options.usePatterns && this.patterns) {
      const patternScore = this.calculatePatternScore(match);
      confidence = (confidence + patternScore) / 2;
      score += patternScore * 1.5;
    }
    
    // Real-time adjustments if enabled
    if (options.useRealTime) {
      const realtimeScore = this.calculateRealTimeScore(match);
      confidence = (confidence + realtimeScore) / 2;
      score += realtimeScore * 1.2;
    }
    
    // Risk assessment
    risk = this.calculateRiskScore(match, options.riskProfile);
    
    // Value calculation
    value = this.calculateValueScore(match, confidence, risk);
    
    // Final score calculation
    score += confidence * 0.4 + (100 - risk * 100) * 0.3 + value * 0.3;
    
    return {
      score: Math.round(score),
      confidence: Math.round(confidence),
      risk: Math.round(risk * 100),
      value: Math.round(value * 100)
    };
  }

  getTimingScore(match) {
    const startTime = match.startTimeUnix;
    const now = Math.floor(Date.now() / 1000);
    const minutesToStart = Math.max(0, (startTime - now) / 60);
    
    // Optimal timing: 10-60 minutes
    if (minutesToStart >= 10 && minutesToStart <= 60) return 100;
    if (minutesToStart >= 5 && minutesToStart <= 120) return 80;
    if (minutesToStart >= 2 && minutesToStart <= 180) return 60;
    return 30;
  }

  calculateCorrelationRisk(match) {
    // Simplified correlation risk calculation
    const league = match.league || '';
    const odds = [match.odd1, match.odd2, match.oddX].filter(o => o && o > 1);
    
    if (odds.length < 2) return 50;
    
    // Higher correlation in lower leagues
    const leagueRisk = this.patterns.leaguePerformance?.get(league);
    const leagueWinRate = leagueRisk ? (leagueRisk.wins / leagueRisk.total) : 0.5;
    
    // Calculate odds correlation
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    const variance = odds.reduce((sum, odd) => sum + Math.pow(odd - avgOdds, 2), 0) / odds.length;
    
    return Math.min(80, Math.max(20, leagueWinRate * 100 + variance * 10));
  }

  calculateMomentum(match) {
    // Calculate momentum based on recent odds movements
    const matchId = match.matchId;
    const recentMovements = this.getRecentOddsMovements(matchId);
    
    if (!recentMovements || recentMovements.length < 2) return 50;
    
    // Positive momentum (odds decreasing for favorites)
    const momentum = recentMovements.reduce((acc, movement, index) => {
      if (index === 0) return acc;
      return acc + (movement.direction === 'down' ? 10 : -5);
    }, 0);
    
    return Math.max(0, Math.min(100, 50 + momentum));
  }

  calculatePatternScore(match) {
    let score = 0;
    
    // Time pattern
    const hour = new Date(match.startTimeUnix * 1000).getHours();
    const timeSlot = this.getTimeSlot(hour);
    const timePattern = this.patterns.timeOfDay?.get(timeSlot);
    
    if (timePattern) {
      const winRate = timePattern.wins / timePattern.total;
      score += winRate * 30;
    }
    
    // Day pattern
    const day = new Date(match.startTimeUnix * 1000).getDay();
    const dayName = this.getDayName(day);
    const dayPattern = this.patterns.dayOfWeek?.get(dayName);
    
    if (dayPattern) {
      const winRate = dayPattern.wins / dayPattern.total;
      score += winRate * 20;
    }
    
    // League pattern
    const league = match.league;
    const leaguePattern = this.patterns.leaguePerformance?.get(league);
    
    if (leaguePattern) {
      const winRate = leaguePattern.wins / leaguePattern.total;
      score += winRate * 25;
    }
    
    return Math.min(100, score);
  }

  calculateRealTimeScore(match) {
    let score = 0;
    
    // Confidence booster from real-time monitoring
    const booster = this.confidenceBoosters.get(match.matchId) || 0;
    score += booster;
    
    // Market conditions adjustment
    const conditions = this.getCurrentMarketConditions();
    
    if (conditions.volatility < 0.02) score += 15; // Stable market
    if (conditions.liquidity === 'high') score += 10; // High liquidity
    if (conditions.sentiment === 'bullish') score += 5; // Positive sentiment
    if (conditions.pressure === 'low') score += 10; // Low pressure
    
    return Math.max(0, Math.min(100, score));
  }

  calculateRiskScore(match, riskProfile) {
    const baseRisk = this.calculateBaseRisk(match);
    const profileMultiplier = this.riskMultipliers[riskProfile] || 1.0;
    
    return Math.min(1.0, Math.max(0.0, baseRisk * profileMultiplier));
  }

  calculateBaseRisk(match) {
    let risk = 0.5;
    
    // Confidence-based risk
    const confidence = Number(match.confiance) || 50;
    risk += (100 - confidence) / 200;
    
    // Timing-based risk
    const timingScore = this.getTimingScore(match);
    risk += (100 - timingScore) / 400;
    
    // Stability-based risk
    const stability = Number(match.stabilityScore) || 50;
    risk += (100 - stability) / 300;
    
    return Math.min(1.0, Math.max(0.0, risk));
  }

  calculateValueScore(match, confidence, risk) {
    // Calculate expected value
    const odds = [match.odd1, match.odd2, match.oddX].filter(o => o && o > 1);
    if (odds.length === 0) return 0;
    
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    const impliedProbability = 1 / avgOdds;
    const actualProbability = confidence / 100;
    
    const value = actualProbability - impliedProbability;
    return Math.max(-1, Math.min(2, value * 100));
  }

  selectOptimalCombination(scoredMatches, size, riskProfile) {
    const threshold = this.confidenceThresholds[riskProfile] || 65;
    
    // Filter by confidence threshold
    const qualified = scoredMatches.filter(match => match.confidence >= threshold);
    
    // If not enough qualified matches, lower threshold
    const finalMatches = qualified.length >= size ? qualified : 
      scoredMatches.filter(match => match.confidence >= threshold - 15).slice(0, size * 2);
    
    // Use genetic algorithm for optimal combination
    return this.geneticOptimization(finalMatches, size, riskProfile);
  }

  geneticOptimization(matches, size, riskProfile) {
    const populationSize = 50;
    const generations = 100;
    const mutationRate = 0.1;
    
    let population = this.initializePopulation(matches, size, populationSize);
    
    for (let generation = 0; generation < generations; generation++) {
      // Evaluate fitness
      population = population.map(individual => ({
        ...individual,
        fitness: this.evaluateFitness(individual, riskProfile)
      }));
      
      // Selection
      population = this.selection(population);
      
      // Crossover
      population = this.crossover(population);
      
      // Mutation
      population = this.mutation(population, matches, mutationRate);
    }
    
    // Return best individual
    return population.sort((a, b) => b.fitness - a.fitness)[0].genes;
  }

  initializePopulation(matches, size, populationSize) {
    const population = [];
    
    for (let i = 0; i < populationSize; i++) {
      const individual = {
        genes: this.selectRandomMatches(matches, size),
        fitness: 0
      };
      population.push(individual);
    }
    
    return population;
  }

  selectRandomMatches(matches, size) {
    const shuffled = [...matches].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, size);
  }

  evaluateFitness(individual, riskProfile) {
    const genes = individual.genes;
    
    // Calculate combined confidence
    const avgConfidence = genes.reduce((sum, gene) => sum + gene.confidence, 0) / genes.length;
    
    // Calculate risk score
    const avgRisk = genes.reduce((sum, gene) => sum + gene.risk, 0) / genes.length;
    
    // Calculate value score
    const avgValue = genes.reduce((sum, gene) => sum + gene.value, 0) / genes.length;
    
    // Calculate diversity
    const diversity = this.calculateDiversity(genes);
    
    // Fitness function
    const fitness = 
      avgConfidence * 0.4 + 
      (100 - avgRisk) * 0.3 + 
      avgValue * 0.2 + 
      diversity * 0.1;
    
    return fitness;
  }

  calculateDiversity(genes) {
    const leagues = new Set();
    const timeSlots = new Set();
    
    for (const gene of genes) {
      leagues.add(gene.league);
      const hour = new Date(gene.startTimeUnix * 1000).getHours();
      timeSlots.add(this.getTimeSlot(hour));
    }
    
    return (leagues.size / genes.length) * 50 + (timeSlots.size / genes.length) * 50;
  }

  selection(population) {
    // Tournament selection
    const tournamentSize = 5;
    const selected = [];
    
    for (let i = 0; i < population.length; i++) {
      const tournament = [];
      
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }
      
      tournament.sort((a, b) => b.fitness - a.fitness);
      selected.push(tournament[0]);
    }
    
    return selected;
  }

  crossover(population) {
    const newPopulation = [];
    
    for (let i = 0; i < population.length; i += 2) {
      const parent1 = population[i];
      const parent2 = population[i + 1] || population[0];
      
      const crossoverPoint = Math.floor(Math.random() * parent1.genes.length);
      
      const child1 = {
        genes: [
          ...parent1.genes.slice(0, crossoverPoint),
          ...parent2.genes.slice(crossoverPoint)
        ],
        fitness: 0
      };
      
      const child2 = {
        genes: [
          ...parent2.genes.slice(0, crossoverPoint),
          ...parent1.genes.slice(crossoverPoint)
        ],
        fitness: 0
      };
      
      newPopulation.push(child1, child2);
    }
    
    return newPopulation;
  }

  mutation(population, matches, mutationRate) {
    return population.map(individual => {
      if (Math.random() < mutationRate) {
        const geneIndex = Math.floor(Math.random() * individual.genes.length);
        const newGene = matches[Math.floor(Math.random() * matches.length)];
        
        individual.genes[geneIndex] = newGene;
      }
      
      return individual;
    });
  }

  calculateAdvancedMetrics(selectedMatches, riskProfile) {
    const metrics = {
      totalConfidence: 0,
      averageConfidence: 0,
      minConfidence: 100,
      maxConfidence: 0,
      totalRisk: 0,
      averageRisk: 0,
      expectedValue: 0,
      diversificationScore: 0,
      timingScore: 0,
      stabilityScore: 0,
      marketConditionScore: 0
    };
    
    for (const match of selectedMatches) {
      metrics.totalConfidence += match.confidence;
      metrics.totalRisk += match.risk;
      metrics.expectedValue += match.value;
      metrics.minConfidence = Math.min(metrics.minConfidence, match.confidence);
      metrics.maxConfidence = Math.max(metrics.maxConfidence, match.confidence);
    }
    
    const count = selectedMatches.length;
    metrics.averageConfidence = metrics.totalConfidence / count;
    metrics.averageRisk = metrics.totalRisk / count;
    metrics.expectedValue = metrics.expectedValue / count;
    
    // Advanced metrics
    metrics.diversificationScore = this.calculateDiversity(selectedMatches);
    metrics.timingScore = this.calculateTimingScore(selectedMatches);
    metrics.stabilityScore = this.calculateStabilityScore(selectedMatches);
    metrics.marketConditionScore = this.calculateMarketConditionScore(selectedMatches);
    
    return metrics;
  }

  calculateOverallConfidence(selectedMatches, metrics) {
    // Weighted confidence calculation
    const baseConfidence = metrics.averageConfidence;
    
    // Boosters
    const diversityBooster = metrics.diversificationScore / 100 * 10;
    const timingBooster = metrics.timingScore / 100 * 15;
    const stabilityBooster = metrics.stabilityScore / 100 * 10;
    const marketBooster = metrics.marketConditionScore / 100 * 15;
    
    // Risk adjustment
    const riskPenalty = metrics.averageRisk * 100 * 20;
    
    const totalConfidence = baseConfidence + diversityBooster + timingBooster + 
                         stabilityBooster + marketBooster - riskPenalty;
    
    return Math.max(0, Math.min(99, Math.round(totalConfidence)));
  }

  async validateAndOptimizeCoupon(coupon) {
    // Validate coupon integrity
    const validation = await this.validateCouponIntegrity(coupon);
    
    if (!validation.isValid) {
      throw new Error(`Coupon validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Optimize based on validation feedback
    const optimized = await this.optimizeBasedOnValidation(coupon, validation);
    
    return optimized;
  }

  async validateCouponIntegrity(coupon) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Check minimum confidence
    const minConfidence = Math.min(...coupon.selections.map(s => s.confidence));
    if (minConfidence < 50) {
      validation.isValid = false;
      validation.errors.push('Minimum confidence too low');
    }
    
    // Check correlation risk
    const correlationRisk = this.calculateCorrelationRisk(coupon.selections);
    if (correlationRisk > 70) {
      validation.warnings.push('High correlation risk detected');
    }
    
    // Check timing
    const timingIssues = this.validateTiming(coupon.selections);
    if (timingIssues.length > 0) {
      validation.warnings.push(...timingIssues);
    }
    
    return validation;
  }

  async optimizeBasedOnValidation(coupon, validation) {
    let optimized = { ...coupon };
    
    // Apply optimizations based on validation
    if (validation.warnings.includes('High correlation risk detected')) {
      optimized = await this.reduceCorrelation(optimized);
    }
    
    if (validation.warnings.some(w => w.includes('timing'))) {
      optimized = await this.optimizeTiming(optimized);
    }
    
    return optimized;
  }

  async reduceCorrelation(coupon) {
    // Replace correlated matches with alternatives
    const optimized = { ...coupon };
    const correlationMatrix = await this.buildCorrelationMatrix(coupon.selections);
    
    // Find and replace highly correlated pairs
    for (let i = 0; i < coupon.selections.length; i++) {
      for (let j = i + 1; j < coupon.selections.length; j++) {
        const correlation = correlationMatrix[i][j];
        
        if (correlation > 0.8) {
          // Replace one of the correlated matches
          const replacement = await this.findAlternativeMatch(coupon.selections[j]);
          if (replacement) {
            optimized.selections[j] = replacement;
          }
        }
      }
    }
    
    return optimized;
  }

  async optimizeTiming(coupon) {
    // Optimize match timing for better confidence
    const optimized = { ...coupon };
    
    // Sort by optimal timing
    optimized.selections = optimized.selections.sort((a, b) => {
      const timingA = this.getTimingScore(a);
      const timingB = this.getTimingScore(b);
      return timingB - timingA;
    });
    
    return optimized;
  }

  getCurrentMarketConditions() {
    return {
      volatility: this.calculateMarketVolatility(),
      liquidity: this.assessMarketLiquidity(),
      sentiment: this.analyzeMarketSentiment(),
      pressure: this.detectMarketPressure(),
      timestamp: new Date().toISOString()
    };
  }

  initializeConfidenceBoosters() {
    // Initialize confidence boosters based on various factors
    this.confidenceBoosters.set('market_stability', 0);
    this.confidenceBoosters.set('historical_performance', 0);
    this.confidenceBoosters.set('real_time_momentum', 0);
    this.confidenceBoosters.set('pattern_matching', 0);
  }
}

// Supporting classes
class MarketAnalyzer {
  constructor() {
    this.marketData = new Map();
    this.volatilityHistory = [];
  }

  analyze(marketData) {
    // Advanced market analysis
    this.marketData.set('timestamp', Date.now());
    this.marketData.set('data', marketData);
    
    return {
      volatility: this.calculateVolatility(marketData),
      trend: this.detectTrend(marketData),
      support: this.findSupportLevels(marketData),
      resistance: this.findResistanceLevels(marketData)
    };
  }

  calculateVolatility(data) {
    // Calculate market volatility
    const prices = data.map(d => d.price || d.odds);
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  detectTrend(data) {
    // Detect market trend using linear regression
    const prices = data.map(d => d.price || d.odds);
    if (prices.length < 2) return 'neutral';
    
    const n = prices.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = prices.reduce((a, b) => a + b, 0);
    const sumXY = prices.reduce((sum, price, i) => sum + price * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    if (slope > 0.01) return 'bullish';
    if (slope < -0.01) return 'bearish';
    return 'neutral';
  }

  findSupportLevels(data) {
    // Find support levels
    const prices = data.map(d => d.price || d.odds);
    const supports = [];
    
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] < prices[i-1] && prices[i] < prices[i+1]) {
        supports.push(prices[i]);
      }
    }
    
    return supports;
  }

  findResistanceLevels(data) {
    // Find resistance levels
    const prices = data.map(d => d.price || d.odds);
    const resistances = [];
    
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i-1] && prices[i] > prices[i+1]) {
        resistances.push(prices[i]);
      }
    }
    
    return resistances;
  }
}

class PredictionEngine {
  constructor() {
    this.models = new Map();
    this.ensemble = new Ensemble();
  }

  async predict(features) {
    // Use ensemble of models for prediction
    const predictions = [];
    
    for (const [name, model] of this.models) {
      try {
        const prediction = await model.predict(features);
        predictions.push({ model: name, prediction, confidence: prediction.confidence });
      } catch (error) {
        console.warn(`Model ${name} prediction failed:`, error);
      }
    }
    
    return this.ensemble.combine(predictions);
  }
}

class Ensemble {
  combine(predictions) {
    // Combine predictions from multiple models
    if (predictions.length === 0) return { confidence: 50, prediction: 'neutral' };
    
    // Weighted average based on confidence
    const totalWeight = predictions.reduce((sum, p) => sum + p.confidence, 0);
    const weightedPrediction = predictions.reduce((sum, p) => 
      sum + (p.prediction * p.confidence), 0) / totalWeight;
    
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    
    return {
      confidence: avgConfidence,
      prediction: weightedPrediction
    };
  }
}

class BankrollOptimizer {
  constructor() {
    this.strategies = new Map();
    this.performance = new Map();
  }

  optimize(coupon, bankroll, riskProfile) {
    // Optimize bankroll allocation
    const strategy = this.selectOptimalStrategy(riskProfile);
    const allocation = this.calculateAllocation(coupon, bankroll, strategy);
    
    return {
      strategy,
      allocation,
      expectedReturn: this.calculateExpectedReturn(allocation, coupon),
      risk: this.calculateRisk(allocation, coupon)
    };
  }

  selectOptimalStrategy(riskProfile) {
    // Select optimal strategy based on risk profile
    const strategies = {
      safe: 'kelly_criterion',
      balanced: 'fixed_fractional',
      aggressive: 'martingale_light'
    };
    
    return strategies[riskProfile] || 'fixed_fractional';
  }

  calculateAllocation(coupon, bankroll, strategy) {
    // Calculate optimal allocation based on strategy
    switch (strategy) {
      case 'kelly_criterion':
        return this.kellyCriterion(coupon, bankroll);
      case 'fixed_fractional':
        return this.fixedFractional(bankroll, 0.05); // 5% of bankroll
      case 'martingale_light':
        return this.martingaleLight(bankroll, coupon.length);
      default:
        return { stake: bankroll / coupon.length, picks: coupon.length };
    }
  }

  kellyCriterion(coupon, bankroll) {
    // Kelly Criterion calculation
    const avgOdds = coupon.reduce((sum, pick) => sum + (pick.cote || 1), 0) / coupon.length;
    const winProbability = coupon.reduce((sum, pick) => sum + (pick.confidence || 50), 0) / coupon.length / 100;
    const kellyFraction = (avgOdds * winProbability - 1) / (avgOdds - 1);
    
    const stake = Math.max(0.01, Math.min(0.25, kellyFraction)) * bankroll;
    
    return { stake, picks: coupon.length, method: 'kelly' };
  }

  fixedFractional(bankroll, fraction) {
    return { 
      stake: bankroll * fraction, 
      picks: Math.floor(bankroll / (bankroll * fraction)), 
      method: 'fixed_fractional' 
    };
  }

  martingaleLight(bankroll, picks) {
    // Light martingale with safety limits
    const baseStake = bankroll / (picks * 10); // Conservative base
    const maxStake = bankroll * 0.1; // Maximum 10% of bankroll
    
    return { 
      stake: Math.min(baseStake * 1.5, maxStake), 
      picks, 
      method: 'martingale_light' 
    };
  }

  calculateExpectedReturn(allocation, coupon) {
    // Calculate expected return
    const avgOdds = coupon.reduce((sum, pick) => sum + (pick.cote || 1), 0) / coupon.length;
    const winProbability = coupon.reduce((sum, pick) => sum + (pick.confidence || 50), 0) / coupon.length / 100;
    
    return allocation.stake * avgOdds * winProbability;
  }

  calculateRisk(allocation, coupon) {
    // Calculate risk metrics
    const maxLoss = allocation.stake;
    const volatility = this.calculateVolatility(coupon);
    
    return {
      maxLoss,
      volatility,
      riskOfRuin: this.calculateRiskOfRuin(allocation.stake, coupon)
    };
  }

  calculateVolatility(coupon) {
    // Calculate coupon volatility
    const odds = coupon.map(p => p.cote || 1);
    const avgOdds = odds.reduce((a, b) => a + b, 0) / odds.length;
    const variance = odds.reduce((sum, odd) => sum + Math.pow(odd - avgOdds, 2), 0) / odds.length;
    
    return Math.sqrt(variance);
  }

  calculateRiskOfRuin(stake, coupon) {
    // Calculate risk of ruin
    const avgOdds = coupon.reduce((sum, pick) => sum + (pick.cote || 1), 0) / coupon.length;
    const winProbability = coupon.reduce((sum, pick) => sum + (pick.confidence || 50), 0) / coupon.length / 100;
    
    const losingStreakProbability = Math.pow(1 - winProbability, 10); // 10 consecutive losses
    return losingStreakProbability * 100;
  }
}

// Initialize the advanced engine
if (typeof window !== 'undefined') {
  window.advancedCouponEngine = new AdvancedCouponEngine();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AdvancedCouponEngine, MarketAnalyzer, PredictionEngine, BankrollOptimizer };
}
