/**
 * SOLITFIFPRO225 - Storage Configuration
 * Centralisation de toutes les clés localStorage
 * SOLITAIRE HACK SIGNATURE
 */

export const STORAGE_KEYS = {
  // Préfixe global
  PREFIX: 'sfc25',
  STORE_PREFIX: 'sfc25:store',
  
  // User
  THEME: 'sfc25:theme',
  USER: 'sfc25:user',
  FAVORITES: 'sfc25:favorites',
  WATCHLIST: 'sfc25:watchlist',
  HISTORY: 'sfc25:history',
  PREFERENCES: 'sfc25:preferences',
  
  // Cache
  CACHE_VERSION: 'sfc25:cache:version',
  CACHE_DATA: 'sfc25:cache:data',
  TEAM_LOGO_CACHE: 'sfc25:cache:team-logos',
  
  // Legacy migrations (pour nettoyage)
  LEGACY: {
    LOW_DATA_MODE: 'fc25_low_data_mode_v1',
    WATCHLIST_OLD: 'fc25_watchlist_v1',
    WATCHLIST_SNAPSHOT: 'fc25_watchlist_snapshot_v1',
    DENICHEUR_HISTORY: 'fc25_denicheur_history_v1',
    DENICHEUR_FULL_OPTION: 'fc25_denicheur_full_option_v1',
    CHAT_HISTORY: 'fc25_chat_history_v1',
    REFRESH_MATCH: 'fc25_page_refresh_minutes_v1',
    REFRESH_COUPON: 'fc25_coupon_refresh_minutes_v1',
    THEME_OLD: 'sfc25-theme'
  }
};

export const WELCOME_MODAL_KEY = 'sfc25:welcome:modal';
export const LEGACY_WELCOME_MODAL_KEY = 'fc25_welcome_modal_v1';

/**
 * Nettoie toutes les clés legacy
 */
export function cleanupLegacyStorage() {
  const legacyKeys = Object.values(STORAGE_KEYS.LEGACY);
  let cleaned = 0;
  
  legacyKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      cleaned++;
    }
  });
  
  console.log(`[Storage] Cleaned ${cleaned} legacy keys`);
  return cleaned;
}

/**
 * Migre les données legacy vers nouveau format
 */
export function migrateLegacyData() {
  const migrations = [];
  
  // Migrer theme
  const oldTheme = localStorage.getItem(STORAGE_KEYS.LEGACY.THEME_OLD);
  if (oldTheme && !localStorage.getItem(STORAGE_KEYS.THEME)) {
    localStorage.setItem(STORAGE_KEYS.THEME, oldTheme);
    migrations.push('theme');
  }
  
  // Migrer watchlist
  const oldWatchlist = localStorage.getItem(STORAGE_KEYS.LEGACY.WATCHLIST_OLD);
  if (oldWatchlist && !localStorage.getItem(STORAGE_KEYS.WATCHLIST)) {
    try {
      localStorage.setItem(STORAGE_KEYS.WATCHLIST, oldWatchlist);
      migrations.push('watchlist');
    } catch (e) {
      console.warn('[Storage] Failed to migrate watchlist');
    }
  }

  const oldWelcome = localStorage.getItem(LEGACY_WELCOME_MODAL_KEY);
  if (oldWelcome && !localStorage.getItem(WELCOME_MODAL_KEY)) {
    localStorage.setItem(WELCOME_MODAL_KEY, oldWelcome);
    migrations.push('welcome-modal');
  }
  
  if (migrations.length) {
    console.log(`[Storage] Migrated: ${migrations.join(', ')}`);
  }
  
  return migrations;
}
