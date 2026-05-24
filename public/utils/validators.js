/**
 * SOLITFIFPRO225 - Validators Module
 * Fonctions de validation
 * SOLITAIRE HACK SIGNATURE
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
  
  isFunction: (val) => typeof val === 'function',
  
  isEmpty: (val) => {
    if (val == null) return true;
    if (typeof val === 'string') return val.trim() === '';
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object') return Object.keys(val).length === 0;
    return false;
  },
  
  isOddValid: (odd) => {
    if (!validators.isNumber(odd)) return false;
    return odd >= 1.01 && odd <= 1000;
  },
  
  isMatchValid: (match) => {
    return validators.isObject(match) && 
           match.id && 
           match.home_team && 
           match.away_team;
  }
};

export default validators;
