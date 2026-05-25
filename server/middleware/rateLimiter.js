/**
 * Rate Limiter Middleware
 * Protection contre les attaques par force brute et les abus d'API
 */

const rateLimit = require('express-rate-limit');

// Configuration du rate limiter par défaut
const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    error: 'Trop de requêtes. Réessaie dans quelques minutes.'
  },
  handler: (req, res) => {
    console.log('[Rate Limiter] Limite dépassée pour:', req.ip, req.path);
    res.status(429).json({
      success: false,
      error: 'Trop de requêtes. Réessaie dans quelques minutes.'
    });
  }
});

// Rate limiter pour les API sensibles (plus strict)
const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limite chaque IP à 30 requêtes par windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes sur cette action sensible. Réessaie dans quelques minutes.'
  },
  handler: (req, res) => {
    console.log('[Rate Limiter] Limite stricte dépassée pour:', req.ip, req.path);
    res.status(429).json({
      success: false,
      error: 'Trop de requêtes sur cette action sensible. Réessaie dans quelques minutes.'
    });
  }
});

// Rate limiter pour les endpoints de génération de coupons
const couponRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limite chaque IP à 10 génération par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de générations de coupons. Réessaie dans une minute.'
  },
  handler: (req, res) => {
    console.log('[Rate Limiter] Limite coupon dépassée pour:', req.ip);
    res.status(429).json({
      success: false,
      error: 'Trop de générations de coupons. Réessaie dans une minute.'
    });
  }
});

// Rate limiter pour les endpoints d'authentification (si ajouté plus tard)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limite chaque IP à 5 tentatives par windowMs
  skipSuccessfulRequests: true, // Ne pas compter les requêtes réussies
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.'
  },
  handler: (req, res) => {
    console.log('[Rate Limiter] Limite auth dépassée pour:', req.ip);
    res.status(429).json({
      success: false,
      error: 'Trop de tentatives de connexion. Réessaie dans quelques minutes.'
    });
  }
});

// Rate limiter pour les endpoints de chat
const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limite chaque IP à 20 messages par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de messages. Réessaie dans une minute.'
  },
  handler: (req, res) => {
    console.log('[Rate Limiter] Limite chat dépassée pour:', req.ip);
    res.status(429).json({
      success: false,
      error: 'Trop de messages. Réessaie dans une minute.'
    });
  }
});

module.exports = {
  defaultRateLimiter,
  strictRateLimiter,
  couponRateLimiter,
  authRateLimiter,
  chatRateLimiter
};
