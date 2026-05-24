/**
 * SOLITFIFPRO225 - Utils Module
 * Fonctions utilitaires partagées
 * SOLITAIRE HACK SIGNATURE
 */

/**
 * Formate une cote numérique
 * @param {number} value - Valeur à formater
 * @returns {string} Valeur formatée ou '-'
 */
export function formatOdd(value) {
  return typeof value === 'number' ? value.toFixed(3) : '-';
}

/**
 * Formate un timestamp Unix en date/heure locale
 * @param {number} unixSeconds - Timestamp en secondes
 * @returns {string} Date formatée
 */
export function formatTime(unixSeconds) {
  if (!unixSeconds) return 'Heure non disponible';
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formate une date relative (il y a X minutes)
 * @param {Date|number} date - Date à formater
 * @returns {string} Texte relatif
 */
export function formatRelativeTime(date) {
  const now = new Date();
  const then = date instanceof Date ? date : new Date(date);
  const diff = Math.floor((now - then) / 1000);
  
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

/**
 * Extrait le score d'un objet
 * @param {Object} score - Objet score
 * @returns {Object} {home, away}
 */
export function extractScore(score) {
  if (!score || typeof score !== 'object') return { home: '?', away: '?' };
  const home = score.S1 ?? score.SA ?? score.H ?? score.Home ?? '?';
  const away = score.S2 ?? score.SB ?? score.A ?? score.Away ?? '?';
  return { home, away };
}

/**
 * Formate le score en texte
 * @param {Object} score - Objet score
 * @returns {string} Texte formaté
 */
export function scoreText(score) {
  const { home, away } = extractScore(score);
  return `Score: ${home}-${away}`;
}

/**
 * Debounce - Limite l'exécution d'une fonction
 * @param {Function} fn - Fonction à limiter
 * @param {number} delay - Délai en ms
 * @returns {Function} Fonction debounced
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle - Limite la fréquence d'exécution
 * @param {Function} fn - Fonction à limiter
 * @param {number} limit - Limite en ms
 * @returns {Function} Fonction throttled
 */
export function throttle(fn, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Génère un ID unique
 * @returns {string} ID unique
 */
export function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clone profond un objet
 * @param {Object} obj - Objet à cloner
 * @returns {Object} Clone
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Groupe un tableau par une clé
 * @param {Array} array - Tableau à grouper
 * @param {string} key - Clé de groupement
 * @returns {Object} Objet groupé
 */
export function groupBy(array, key) {
  return array.reduce((acc, item) => {
    const group = item[key] || 'unknown';
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});
}

/**
 * Filtre unique - supprime les doublons
 * @param {Array} array - Tableau
 * @param {string} key - Clé d'unicité (optionnel)
 * @returns {Array} Tableau sans doublons
 */
export function unique(array, key = null) {
  if (!key) return [...new Set(array)];
  const seen = new Set();
  return array.filter(item => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * Calcule la moyenne d'un tableau
 * @param {Array<number>} values - Valeurs
 * @returns {number} Moyenne
 */
export function average(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Formate un nombre avec séparateurs
 * @param {number} num - Nombre
 * @returns {string} Nombre formaté
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Tronque un texte
 * @param {string} text - Texte
 * @param {number} maxLength - Longueur max
 * @returns {string} Texte tronqué
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Échappe le HTML
 * @param {string} html - HTML à échapper
 * @returns {string} HTML échappé
 */
export function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Validation helpers
 */
export const validators = {
  isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isValidUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  isNumber: (val) => typeof val === 'number' && !isNaN(val),
  isString: (val) => typeof val === 'string',
  isObject: (val) => typeof val === 'object' && val !== null && !Array.isArray(val),
  isArray: (val) => Array.isArray(val),
  isEmpty: (val) => {
    if (val == null) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
  }
};

// Aliases pour compatibilité
export const formatOdds = formatOdd;
export const formatDate = formatTime;
export const getScore = extractScore;
