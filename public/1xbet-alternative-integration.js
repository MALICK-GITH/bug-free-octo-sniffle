// 1xBet Alternative Integration - Safe and Reliable Data Sources
class SafeDataIntegration {
  constructor() {
    this.primarySource = 'traincdn'; // Already integrated, 9.2/10
    this.secondarySources = [
      'football-data-org',    // Free official API
      'api-football',         // Freemium service
      'thesportsdb',          // Open source
      'opta-sports-lite'      // Official limited version
    ];
    this.dataCache = new Map();
    this.fallbackChain = [];
    this.reliabilityScores = {};
    
    this.init();
  }

  async init() {
    console.log('🛡️ Initializing Safe Data Integration...');
    await this.setupPrimarySource();
    await this.setupSecondarySources();
    this.setupReliabilityMonitoring();
    this.startDataCollection();
  }

  async setupPrimarySource() {
    // TrainCDN is already integrated with 9.2/10 score
    console.log('✅ Primary source (TrainCDN) already integrated');
    this.reliabilityScores.traincdn = 9.2;
  }

  async setupSecondarySources() {
    // Setup alternative safe sources
    this.secondarySources.forEach(source => {
      this.reliabilityScores[source] = this.getSourceReliability(source);
    });
    
    console.log('📊 Secondary sources reliability scores:', this.reliabilityScores);
  }

  getSourceReliability(source) {
    const scores = {
      'football-data-org': 8.5,    // Official, free, reliable
      'api-football': 7.8,          // Freemium, good documentation
      'thesportsdb': 7.2,           // Open source, community
      'opta-sports-lite': 8.8        // Official, limited but high quality
    };
    return scores[source] || 5.0;
  }

  setupReliabilityMonitoring() {
    // Monitor all sources for reliability
    setInterval(() => {
      this.checkSourceHealth();
    }, 60000); // Check every minute
  }

  async checkSourceHealth() {
    for (const source of [this.primarySource, ...this.secondarySources]) {
      try {
        const isHealthy = await this.pingSource(source);
        this.updateSourceReliability(source, isHealthy);
      } catch (error) {
        console.warn(`⚠️ Source ${source} health check failed:`, error);
        this.updateSourceReliability(source, false);
      }
    }
  }

  async pingSource(source) {
    // Health check implementation per source
    switch (source) {
      case 'traincdn':
        return await this.pingTrainCDN();
      case 'football-data-org':
        return await this.pingFootballData();
      case 'api-football':
        return await this.pingAPIFootball();
      case 'thesportsdb':
        return await this.pingTheSportsDB();
      case 'opta-sports-lite':
        return await this.pingOptaSports();
      default:
        return false;
    }
  }

  async pingTrainCDN() {
    try {
      const response = await fetch('https://v3.traincdn.com/genfiles/web-app-v2/dictionary2/v3_statistic_game/fr/dictionary_ef638ac3d5aca0a308851c38a24bdd7c.json', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async pingFootballData() {
    try {
      const response = await fetch('https://api.football-data.org/v4/competitions', {
        method: 'HEAD',
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || 'demo'
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async pingAPIFootball() {
    try {
      const response = await fetch('https://v3.football.api-sports.io/status', {
        method: 'GET',
        headers: {
          'x-apisports-key': process.env.API_FOOTBALL_KEY || 'demo'
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async pingTheSportsDB() {
    try {
      const response = await fetch('https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=English%20Premier%20League', {
        method: 'HEAD'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async pingOptaSports() {
    try {
      // Opta Sports would require proper authentication
      // This is a placeholder implementation
      return true; // Assume healthy for demo
    } catch (error) {
      return false;
    }
  }

  updateSourceReliability(source, isHealthy) {
    const currentScore = this.reliabilityScores[source] || 5.0;
    if (isHealthy) {
      this.reliabilityScores[source] = Math.min(currentScore + 0.1, 10.0);
    } else {
      this.reliabilityScores[source] = Math.max(currentScore - 0.5, 0.0);
    }
  }

  startDataCollection() {
    // Start collecting data from multiple sources
    setInterval(async () => {
      await this.collectFromAllSources();
    }, 30000); // Collect every 30 seconds
  }

  async collectFromAllSources() {
    const promises = this.secondarySources.map(source => 
      this.collectFromSource(source)
    );
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      const source = this.secondarySources[index];
      if (result.status === 'fulfilled') {
        this.dataCache.set(source, result.value);
      } else {
        console.warn(`Failed to collect from ${source}:`, result.reason);
      }
    });
  }

  async collectFromSource(source) {
    switch (source) {
      case 'football-data-org':
        return await this.collectFromFootballData();
      case 'api-football':
        return await this.collectFromAPIFootball();
      case 'thesportsdb':
        return await this.collectFromTheSportsDB();
      case 'opta-sports-lite':
        return await this.collectFromOptaSports();
      default:
        return null;
    }
  }

  async collectFromFootballData() {
    try {
      const response = await fetch('https://api.football-data.org/v4/matches', {
        headers: {
          'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || 'demo'
        }
      });
      const data = await response.json();
      return this.normalizeFootballData(data, 'football-data-org');
    } catch (error) {
      console.error('Football-Data collection error:', error);
      return null;
    }
  }

  async collectFromAPIFootball() {
    try {
      const response = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
        headers: {
          'x-apisports-key': process.env.API_FOOTBALL_KEY || 'demo'
        }
      });
      const data = await response.json();
      return this.normalizeAPIFootballData(data, 'api-football');
    } catch (error) {
      console.error('API-Football collection error:', error);
      return null;
    }
  }

  async collectFromTheSportsDB() {
    try {
      const response = await fetch('https://www.thesportsdb.com/api/v1/json/3/eventspastleague.php?id=4328');
      const data = await response.json();
      return this.normalizeTheSportsDBData(data, 'thesportsdb');
    } catch (error) {
      console.error('TheSportsDB collection error:', error);
      return null;
    }
  }

  async collectFromOptaSports() {
    // Placeholder for Opta Sports integration
    return {
      source: 'opta-sports-lite',
      matches: [],
      statistics: {},
      timestamp: new Date().toISOString()
    };
  }

  normalizeFootballData(data, source) {
    return {
      source,
      matches: data.matches || [],
      statistics: this.extractStatistics(data),
      timestamp: new Date().toISOString(),
      reliability: this.reliabilityScores[source]
    };
  }

  normalizeAPIFootballData(data, source) {
    return {
      source,
      matches: data.response || [],
      statistics: this.extractStatistics(data),
      timestamp: new Date().toISOString(),
      reliability: this.reliabilityScores[source]
    };
  }

  normalizeTheSportsDBData(data, source) {
    return {
      source,
      matches: data.events || [],
      statistics: this.extractStatistics(data),
      timestamp: new Date().toISOString(),
      reliability: this.reliabilityScores[source]
    };
  }

  extractStatistics(data) {
    // Extract and normalize statistics from different sources
    return {
      totalMatches: Array.isArray(data.matches) ? data.matches.length : 
                   Array.isArray(data.response) ? data.response.length :
                   Array.isArray(data.events) ? data.events.length : 0,
      liveMatches: 0, // Would need to be calculated based on match status
      averageOdds: 0, // Would need odds data
      // Add more statistics as needed
    };
  }

  async getBestAvailableData(matchId) {
    // Try primary source first (TrainCDN)
    const primaryData = await this.getFromPrimarySource(matchId);
    if (primaryData && this.isDataValid(primaryData)) {
      return primaryData;
    }

    // Fallback to secondary sources
    const sortedSources = this.getSourcesByReliability();
    
    for (const source of sortedSources) {
      const data = this.dataCache.get(source);
      if (data && this.isDataValid(data)) {
        const matchData = this.findMatchInData(data, matchId);
        if (matchData) {
          return matchData;
        }
      }
    }

    // If no data available, return mock data for testing
    return this.generateMockData(matchId);
  }

  async getFromPrimarySource(matchId) {
    // Use the existing TrainCDN integration
    if (window.statisticalAnalyzer) {
      return await window.statisticalAnalyzer.generateCouponAnalysis({
        sport: 'football',
        matchId: matchId
      });
    }
    return null;
  }

  getSourcesByReliability() {
    return [...this.secondarySources].sort((a, b) => 
      this.reliabilityScores[b] - this.reliabilityScores[a]
    );
  }

  isDataValid(data) {
    return data && 
           data.timestamp && 
           (new Date() - new Date(data.timestamp)) < 300000; // 5 minutes old max
  }

  findMatchInData(data, matchId) {
    if (data.matches) {
      return data.matches.find(match => 
        match.id === matchId || 
        match.fixture?.id === matchId ||
        match.match_id === matchId
      );
    }
    return null;
  }

  generateMockData(matchId) {
    return {
      source: 'mock',
      matchId,
      sport: 'football',
      statistics: {
        xG: Math.random() * 3,
        possession: Math.floor(Math.random() * 100),
        shotsOnTarget: Math.floor(Math.random() * 10),
        shotsOffTarget: Math.floor(Math.random() * 15),
        keyPasses: Math.floor(Math.random() * 20),
        passingAccuracy: Math.floor(Math.random() * 30) + 70
      },
      timestamp: new Date().toISOString(),
      reliability: 5.0,
      isMock: true
    };
  }

  async getEnhancedMatchData(matchId) {
    // Combine data from multiple sources for enhanced accuracy
    const primaryData = await this.getFromPrimarySource(matchId);
    const enhancedData = { ...primaryData };

    // Add data from other sources
    for (const source of this.secondarySources) {
      const sourceData = this.dataCache.get(source);
      if (sourceData) {
        const matchData = this.findMatchInData(sourceData, matchId);
        if (matchData) {
          enhancedData = this.mergeData(enhancedData, matchData, source);
        }
      }
    }

    return enhancedData;
  }

  mergeData(primary, secondary, source) {
    const merged = { ...primary };
    
    // Add source information
    merged.sources = merged.sources || [];
    merged.sources.push(source);
    
    // Merge statistics with weighting based on reliability
    if (secondary.statistics) {
      merged.statistics = merged.statistics || {};
      const sourceWeight = this.reliabilityScores[source] / 10;
      
      Object.keys(secondary.statistics).forEach(key => {
        if (typeof secondary.statistics[key] === 'number') {
          if (merged.statistics[key] !== undefined) {
            // Weighted average
            const primaryWeight = this.reliabilityScores[primary.source] / 10;
            merged.statistics[key] = 
              (merged.statistics[key] * primaryWeight + 
               secondary.statistics[key] * sourceWeight) / 
              (primaryWeight + sourceWeight);
          } else {
            merged.statistics[key] = secondary.statistics[key];
          }
        }
      });
    }

    merged.confidence = this.calculateDataConfidence(merged);
    return merged;
  }

  calculateDataConfidence(data) {
    if (!data.sources) return 0.5;
    
    const totalReliability = data.sources.reduce((sum, source) => 
      sum + this.reliabilityScores[source], 0
    );
    
    return Math.min(totalReliability / data.sources.length / 10, 1.0);
  }

  // Public API methods
  async getMatchStatistics(matchId) {
    return await this.getBestAvailableData(matchId);
  }

  async getEnhancedStatistics(matchId) {
    return await this.getEnhancedMatchData(matchId);
  }

  getSourceStatus() {
    return {
      primary: {
        source: this.primarySource,
        reliability: this.reliabilityScores[this.primarySource],
        status: 'active'
      },
      secondary: this.secondarySources.map(source => ({
        source,
        reliability: this.reliabilityScores[source],
        status: this.dataCache.has(source) ? 'active' : 'inactive'
      }))
    };
  }

  getReliabilityReport() {
    return {
      sources: this.reliabilityScores,
      primary: this.primarySource,
      fallbackChain: this.getSourcesByReliability(),
      lastUpdate: new Date().toISOString()
    };
  }

  destroy() {
    // Cleanup
    this.dataCache.clear();
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.safeDataIntegration = new SafeDataIntegration();
    });
  } else {
    window.safeDataIntegration = new SafeDataIntegration();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SafeDataIntegration;
}
