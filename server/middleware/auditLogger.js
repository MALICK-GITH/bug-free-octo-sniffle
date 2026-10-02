/**
 * Audit Logger Middleware
 * Logger toutes les actions sensibles pour la sécurité
 */

const { saveAuditReport } = require("../../services/db");

// Actions sensibles à logger
const SENSITIVE_ACTIONS = [
  'coupon/generate',
  'coupon/validate',
  'favorite/add',
  'favorite/remove',
  'watchlist/add',
  'watchlist/remove',
  'telegram/session',
  'mobile/register',
  'patterns/report'
];

function auditLogger(action) {
  return async (req, res, next) => {
    const originalSend = res.send;
    const startTime = Date.now();
    
    // Intercepter la réponse
    res.send = function(data) {
      const duration = Date.now() - startTime;
      
      // Logger l'action si elle est sensible
      if (SENSITIVE_ACTIONS.includes(action)) {
        logSensitiveAction(req, res, action, duration, data);
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
}

async function logSensitiveAction(req, res, action, duration, responseData) {
  try {
    const auditData = {
      action: action,
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'Unknown',
      timestamp: new Date().toISOString(),
      duration: duration,
      statusCode: res.statusCode,
      success: responseData && responseData.success !== false
    };
    
    // Logger dans la console pour le développement
    console.log('[Audit Logger]', JSON.stringify(auditData));
    
    // Sauvegarder dans la base de données
    await saveAuditReport(auditData);
  } catch (error) {
    console.error('[Audit Logger] Erreur lors du logging:', error);
  }
}

// Middleware pour logger toutes les requêtes API
function apiRequestLogger(req, res, next) {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: duration,
      ip: req.ip || req.connection.remoteAddress
    };
    
    console.log('[API Request]', JSON.stringify(logData));
  });
  
  next();
}

// Middleware pour détecter les activités suspectes
function suspiciousActivityDetector(req, res, next) {
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script>/i, // XSS attempt
    /union.*select/i, // SQL injection attempt
    /drop.*table/i, // SQL injection attempt
    /eval\(/i, // Code injection attempt
    /document\.cookie/i, // Cookie theft attempt
  ];
  
  const checkSuspicious = (obj) => {
    if (!obj) return false;
    const str = JSON.stringify(obj);
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  if (checkSuspicious(req.query) || checkSuspicious(req.body)) {
    console.warn('[Suspicious Activity] Pattern détecté:', {
      ip: req.ip,
      path: req.path,
      query: req.query,
      body: req.body
    });
    
    // Logger l'activité suspecte
    logSensitiveAction(req, res, 'suspicious_activity', 0, { 
      success: false, 
      reason: 'Suspicious pattern detected' 
    });
  }
  
  next();
}

module.exports = {
  auditLogger,
  apiRequestLogger,
  suspiciousActivityDetector
};
