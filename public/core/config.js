/**
 * SOLITFIFPRO225 - Configuration Centralisée
 * Core Module - Configuration globale de l'application
 * SOLITAIRE HACK SIGNATURE
 */

export const APP_CONFIG = {
  name: 'SOLITFIFPRO225',
  version: '2026.05.08-r1',
  buildDate: new Date().toISOString(),
  
  api: {
    oddsApi: {
      baseUrl: 'https://api.the-odds-api.com',
      timeout: 10000,
      retries: 3
    },
    sportsDb: {
      baseUrl: 'https://www.thesportsdb.com/api/v1/json/3',
      timeout: 8000,
      retries: 2
    }
  },
  
  cache: {
    maxAge: {
      static: 7 * 24 * 60 * 60 * 1000, // 7 jours
      api: 5 * 60 * 1000, // 5 minutes
      images: 30 * 24 * 60 * 60 * 1000 // 30 jours
    },
    maxItems: 500
  },
  
  ui: {
    animations: {
      enabled: true,
      reducedMotion: false,
      duration: 300
    },
    theme: {
      default: 'dark',
      storageKey: 'sfc25:theme'
    },
    toast: {
      duration: 4000,
      maxToasts: 5
    }
  },
  
  features: {
    aiAssistant: true,
    offlineMode: true,
    pushNotifications: false,
    analytics: true
  }
};

export const ENV = {
  isDevelopment: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
  isProduction: !(location.hostname === 'localhost' || location.hostname === '127.0.0.1'),
  userAgent: navigator.userAgent,
  platform: navigator.platform
};

export const DEBUG = ENV.isDevelopment;
