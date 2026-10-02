/**
 * SOLITFIFPRO225 - State Management Centralisé
 * Core Module - Store réactif avec persistance
 * SOLITAIRE HACK SIGNATURE
 */

import { STORAGE_KEYS } from '../config/storage.js';
import { APP_CONFIG, DEBUG } from './config.js';

/**
 * Crée un store réactif avec Proxy
 */
export function createStore(initialState, options = {}) {
  const { persist = [], name = 'store' } = options;
  
  // Charger depuis localStorage si persisté
  const loadPersisted = () => {
    const loaded = {};
    persist.forEach(key => {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEYS.STORE_PREFIX}:${name}:${key}`);
        if (stored) loaded[key] = JSON.parse(stored);
      } catch (e) {
        if (DEBUG) console.warn(`[Store] Failed to load ${key}:`, e);
      }
    });
    return loaded;
  };
  
  const state = { ...initialState, ...loadPersisted() };
  const listeners = new Set();
  
  // Proxy pour réactivité
  const proxy = new Proxy(state, {
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;
      
      // Sauvegarder si dans persist
      if (persist.includes(prop)) {
        try {
          localStorage.setItem(
            `${STORAGE_KEYS.STORE_PREFIX}:${name}:${prop}`,
            JSON.stringify(value)
          );
        } catch (e) {
          if (DEBUG) console.warn(`[Store] Failed to persist ${prop}:`, e);
        }
      }
      
      // Notifier les listeners
      listeners.forEach(cb => cb(prop, value, oldValue));
      
      return true;
    }
  });
  
  return {
    state: proxy,
    
    subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    
    get(key) {
      return state[key];
    },
    
    set(key, value) {
      proxy[key] = value;
    },
    
    reset() {
      Object.keys(initialState).forEach(key => {
        proxy[key] = initialState[key];
      });
    },
    
    clearPersisted() {
      persist.forEach(key => {
        localStorage.removeItem(`${STORAGE_KEYS.STORE_PREFIX}:${name}:${key}`);
      });
    }
  };
}

// Stores globaux de l'application
export const appStore = createStore({
  isLoading: false,
  error: null,
  online: navigator.onLine,
  version: APP_CONFIG.version
}, { name: 'app' });

export const userStore = createStore({
  theme: APP_CONFIG.ui.theme.default,
  favorites: [],
  watchlist: [],
  history: [],
  preferences: {}
}, { 
  name: 'user',
  persist: ['theme', 'favorites', 'watchlist', 'preferences']
});

export const matchesStore = createStore({
  items: [],
  filtered: [],
  selected: null,
  lastUpdate: null,
  filter: {
    league: null,
    mode: 'upcoming',
    search: ''
  }
}, {
  name: 'matches',
  persist: ['filter']
});

export const couponsStore = createStore({
  items: [],
  active: null,
  generated: [],
  stats: {
    total: 0,
    won: 0,
    lost: 0
  }
}, {
  name: 'coupons',
  persist: ['items', 'stats']
});

// Écouter les changements de connexion
window.addEventListener('online', () => appStore.set('online', true));
window.addEventListener('offline', () => appStore.set('online', false));

if (DEBUG) console.log('[Store] Initialized with', { appStore, userStore, matchesStore, couponsStore });
