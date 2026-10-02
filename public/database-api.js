// Database API Client - Frontend integration for FIFA PRO
class DatabaseAPI {
  constructor() {
    this.baseURL = '/api';
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // Generic API call method
  async apiCall(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      console.log(`🔗 API Call: ${config.method || 'GET'} ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ API Response: ${endpoint}`, data);
      return data;
    } catch (error) {
      console.error(`❌ API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // Cache methods
  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Match methods
  async getMatches(filters = {}) {
    const cacheKey = `matches_${JSON.stringify(filters)}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const params = new URLSearchParams();
    if (filters.league) params.append('league', filters.league);
    if (filters.status) params.append('status', filters.status);
    if (filters.limit) params.append('limit', filters.limit);

    const data = await this.apiCall(`/matches?${params}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async getMatch(matchId) {
    const cacheKey = `match_${matchId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.apiCall(`/matches/${matchId}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async saveMatch(matchData) {
    const data = await this.apiCall('/matches', {
      method: 'POST',
      body: JSON.stringify(matchData)
    });
    
    // Clear cache
    this.cache.clear();
    return data;
  }

  // Coupon methods
  async getCoupons(userId = null) {
    const cacheKey = `coupons_${userId || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const params = userId ? `?userId=${userId}` : '';
    const data = await this.apiCall(`/coupons${params}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async saveCoupon(couponData) {
    const data = await this.apiCall('/coupons', {
      method: 'POST',
      body: JSON.stringify(couponData)
    });
    
    // Clear cache
    this.cache.clear();
    return data;
  }

  // Prediction methods
  async getPredictions(matchId) {
    const cacheKey = `predictions_${matchId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const data = await this.apiCall(`/predictions/${matchId}`);
    this.setCached(cacheKey, data);
    return data;
  }

  async savePrediction(predictionData) {
    const data = await this.apiCall('/predictions', {
      method: 'POST',
      body: JSON.stringify(predictionData)
    });
    
    // Clear cache
    this.cache.clear();
    return data;
  }

  // Analytics methods
  async getAnalytics(eventType = null, limit = 100) {
    const params = new URLSearchParams();
    if (eventType) params.append('eventType', eventType);
    params.append('limit', limit);

    return await this.apiCall(`/analytics?${params}`);
  }

  async trackEvent(eventType, eventData) {
    return await this.apiCall('/analytics', {
      method: 'POST',
      body: JSON.stringify({ eventType, eventData })
    });
  }

  // Cache methods
  async getCache(key) {
    return await this.apiCall(`/cache/${key}`);
  }

  async setCache(key, value, ttl = 3600) {
    return await this.apiCall(`/cache/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value, ttl })
    });
  }

  async clearCache(key = null) {
    if (key) {
      return await this.apiCall(`/cache/${key}`, { method: 'DELETE' });
    } else {
      return await this.apiCall('/cache/*', { method: 'DELETE' });
    }
  }

  // Settings methods
  async getSetting(key) {
    return await this.apiCall(`/settings/${key}`);
  }

  async setSetting(key, value, description = null) {
    return await this.apiCall(`/settings/${key}`, {
      method: 'POST',
      body: JSON.stringify({ value, description })
    });
  }

  // User methods
  async getUser(userId) {
    return await this.apiCall(`/users/${userId}`);
  }

  async saveUser(userData) {
    return await this.apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  // Health check
  async healthCheck() {
    return await this.apiCall('/health');
  }

  // Batch operations
  async saveMultipleMatches(matches) {
    const promises = matches.map(match => this.saveMatch(match));
    return await Promise.all(promises);
  }

  async saveMultipleCoupons(coupons) {
    const promises = coupons.map(coupon => this.saveCoupon(coupon));
    return await Promise.all(promises);
  }

  // Search and filter
  async searchMatches(query, filters = {}) {
    const allMatches = await this.getMatches(filters);
    const searchTerm = query.toLowerCase();
    
    return {
      success: true,
      data: allMatches.data.filter(match => 
        match.team1.toLowerCase().includes(searchTerm) ||
        match.team2.toLowerCase().includes(searchTerm) ||
        match.league.toLowerCase().includes(searchTerm)
      ),
      count: allMatches.data.length
    };
  }

  // Statistics
  async getMatchStats() {
    const matches = await this.getMatches();
    const stats = {
      total: matches.data.length,
      upcoming: matches.data.filter(m => m.status === 'upcoming').length,
      live: matches.data.filter(m => m.status === 'live').length,
      finished: matches.data.filter(m => m.status === 'finished').length,
      leagues: [...new Set(matches.data.map(m => m.league))].length
    };
    
    return { success: true, data: stats };
  }

  async getCouponStats() {
    const coupons = await this.getCoupons();
    const stats = {
      total: coupons.data.length,
      pending: coupons.data.filter(c => c.status === 'pending').length,
      won: coupons.data.filter(c => c.status === 'won').length,
      lost: coupons.data.filter(c => c.status === 'lost').length,
      totalStake: coupons.data.reduce((sum, c) => sum + (c.stake || 0), 0),
      totalWin: coupons.data.reduce((sum, c) => sum + (c.potential_win || 0), 0)
    };
    
    return { success: true, data: stats };
  }

  // Utility methods
  clearAllCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }

  // Export methods
  async exportData(type = 'all') {
    switch (type) {
      case 'matches':
        return await this.getMatches();
      case 'coupons':
        return await this.getCoupons();
      case 'analytics':
        return await this.getAnalytics();
      default:
        const [matches, coupons, analytics] = await Promise.all([
          this.getMatches(),
          this.getCoupons(),
          this.getAnalytics()
        ]);
        
        return {
          success: true,
          data: {
            matches: matches.data,
            coupons: coupons.data,
            analytics: analytics.data,
            exportedAt: new Date().toISOString()
          }
        };
    }
  }
}

// Create singleton instance
const databaseAPI = new DatabaseAPI();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DatabaseAPI;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.DatabaseAPI = DatabaseAPI;
  window.databaseAPI = databaseAPI;
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🗄️ Database API initialized');
    
    // Test connection
    databaseAPI.healthCheck()
      .then(result => {
        console.log('✅ Database health check:', result);
      })
      .catch(error => {
        console.error('❌ Database health check failed:', error);
      });
  });
} else if (typeof window !== 'undefined') {
  console.log('🗄️ Database API initialized');
}
