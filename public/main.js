/**
 * SOLITFIFPRO225 - Main Entry Point
 * Point d'entrée unique de l'application
 * SOLITAIRE HACK SIGNATURE
 */

// Core
import { APP_CONFIG, ENV } from './core/config.js';
import { appStore, userStore, matchesStore, couponsStore } from './core/store.js';
import { oddsApi, sportsDb, matchesApi } from './core/api.js';

// Config
import { STORAGE_KEYS, cleanupLegacyStorage, migrateLegacyData } from './config/storage.js';

// Utils
import { 
  formatOdd, 
  formatTime, 
  formatRelativeTime,
  extractScore, 
  scoreText,
  debounce,
  throttle,
  generateId,
  escapeHtml
} from './utils/index.js';

// Systems (chargés dynamiquement si nécessaire)
let Toast, ThemeSystem, WebVitalsMonitor;

// ============================================
// INITIALIZATION
// ============================================

async function init() {
  console.log(`[SFC25] ${APP_CONFIG.name} v${APP_CONFIG.version}`);
  
  // 1. Migration et cleanup
  migrateLegacyData();
  cleanupLegacyStorage();
  
  // 2. Initialize Theme
  await initTheme();
  
  // 3. Initialize Systems
  await initSystems();
  
  // 4. Initialize UI
  initUI();
  
  // 5. Register Service Worker
  registerServiceWorker();
  
  // 6. Expose global API for legacy compatibility
  exposeGlobalAPI();
  
  console.log('[SFC25] Initialized successfully');
  
  // Dispatch ready event
  window.dispatchEvent(new CustomEvent('sfc25:ready'));
}

async function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || APP_CONFIG.ui.theme.default;
  document.documentElement.setAttribute('data-theme', savedTheme);
  userStore.set('theme', savedTheme);
  
  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      userStore.set('theme', newTheme);
    }
  });
}

async function initSystems() {
  // Load Toast system
  try {
    const module = await import('./toast-system.js');
    Toast = module.default || window.Toast;
  } catch (e) {
    console.warn('[SFC25] Toast system not loaded');
  }
  
  // Load Web Vitals
  try {
    const module = await import('./web-vitals.js');
    WebVitalsMonitor = module.default || window.WebVitalsMonitor;
  } catch (e) {
    console.warn('[SFC25] Web Vitals not loaded');
  }
  
  // Load Theme System
  try {
    const module = await import('./theme-system.js');
    ThemeSystem = module.default || window.ThemeSystem;
  } catch (e) {
    console.warn('[SFC25] Theme system not loaded');
  }
}

function initUI() {
  // Create theme toggle if container exists
  const themeToggleContainer = document.getElementById('theme-toggle-container');
  if (themeToggleContainer && ThemeSystem) {
    ThemeSystem.createToggle(themeToggleContainer);
  }
  
  // Mark page key for CSS
  const path = window.location.pathname;
  const pageKey = getPageKey(path);
  document.body.classList.add(`page-${pageKey}`);
  
  // Initialize reveal animations
  initRevealAnimations();
}

function getPageKey(path) {
  if (path === '/' || path.endsWith('/index.html')) return 'home';
  if (path.includes('coupon')) return 'coupon';
  if (path.includes('match')) return 'match';
  if (path.includes('mode-emploi')) return 'guide';
  if (path.includes('auth')) return 'auth';
  if (path.includes('admin')) return 'admin';
  if (path.includes('about')) return 'about';
  if (path.includes('developpeur')) return 'dev';
  return 'other';
}

function initRevealAnimations() {
  const selectors = [
    '.hero', '.controls', '.panel', '.match-card',
    '.watchlist-card', '.finder-row', '.heat-row'
  ];
  
  const elements = document.querySelectorAll(selectors.join(','));
  elements.forEach((el, index) => {
    el.setAttribute('data-reveal', '');
    el.style.setProperty('--reveal-delay', `${Math.min(index * 35, 360)}ms`);
  });
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    
    elements.forEach((el) => observer.observe(el));
  } else {
    elements.forEach((el) => el.classList.add('is-visible'));
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && APP_CONFIG.features.offlineMode) {
    navigator.serviceWorker.register('/sw-global.js')
      .then((reg) => console.log('[SW] Registered:', reg.scope))
      .catch((err) => console.log('[SW] Failed:', err));
  }
}

function exposeGlobalAPI() {
  // Pour compatibilité avec code legacy
  window.SFC25 = {
    config: APP_CONFIG,
    env: ENV,
    stores: {
      app: appStore,
      user: userStore,
      matches: matchesStore,
      coupons: couponsStore
    },
    api: {
      odds: oddsApi,
      sportsDb,
      matches: matchesApi
    },
    utils: {
      formatOdd,
      formatTime,
      formatRelativeTime,
      extractScore,
      scoreText,
      debounce,
      throttle,
      generateId,
      escapeHtml
    },
    storage: STORAGE_KEYS,
    ui: {
      Toast,
      ThemeSystem,
      WebVitalsMonitor
    }
  };
  
  // Aliases legacy
  window.formatOdd = formatOdd;
  window.formatTime = formatTime;
  window.extractScore = extractScore;
  window.scoreText = scoreText;
  window.debounce = debounce;
}

// ============================================
// BOOT
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
