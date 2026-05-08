/**
 * SOLITFIFPRO225 - API Client Unifié
 * Core Module - HTTP client avec cache et retry
 * SOLITAIRE HACK SIGNATURE
 */

import { APP_CONFIG, DEBUG } from './config.js';
import { appStore } from './store.js';

/**
 * Classe API Client avec gestion automatique
 */
class ApiClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 10000;
    this.retries = config.retries || 3;
    this.cache = new Map();
  }
  
  async request(endpoint, options = {}) {
    const { 
      method = 'GET', 
      body = null, 
      headers = {},
      useCache = false,
      cacheDuration = APP_CONFIG.cache.maxAge.api,
      signal
    } = options;
    
    const url = `${this.baseUrl}${endpoint}`;
    const cacheKey = `${method}:${url}`;
    
    // Vérifier cache
    if (useCache && method === 'GET') {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        if (DEBUG) console.log('[API] Cache hit:', url);
        return cached.data;
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    
    try {
      appStore.set('isLoading', true);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...headers
        },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Mettre en cache
      if (useCache && method === 'GET') {
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });
      }
      
      return data;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    } finally {
      appStore.set('isLoading', false);
    }
  }
  
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }
  
  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// Instances API
export const oddsApi = new ApiClient(APP_CONFIG.api.oddsApi);
export const sportsDb = new ApiClient(APP_CONFIG.api.sportsDb);

/**
 * Fetch avec retry automatique
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Backoff exponentiel
      }
    }
  }
  
  throw lastError;
}

/**
 * API spécifique pour les matchs
 */
export const matchesApi = {
  async getLive(sport = 'soccer', league = null) {
    const endpoint = `/sports/${sport}/odds/?regions=eu&markets=h2h`;
    return oddsApi.get(endpoint, { useCache: true });
  },
  
  async getTeamLogo(teamName) {
    const endpoint = `/searchteams.php?t=${encodeURIComponent(teamName)}`;
    return sportsDb.get(endpoint, { useCache: true, cacheDuration: 30 * 24 * 60 * 60 * 1000 });
  }
};

/**
 * API pour les coupons/prédictions
 */
export const couponsApi = {
  async generate(params) {
    // Simulation - remplacer par vraie API
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          id: Date.now(),
          predictions: [],
          confidence: 0.85,
          timestamp: new Date().toISOString()
        });
      }, 500);
    });
  }
};
