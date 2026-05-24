const helmet = require("helmet");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getRequestOrigin(req) {
  const origin = String(req.get("origin") || "").trim();
  if (origin) return origin;

  const referer = String(req.get("referer") || "").trim();
  if (!referer) return "";

  try {
    return new URL(referer).origin;
  } catch (_error) {
    return "";
  }
}

function getHostOrigin(req) {
  const host = String(req.get("host") || "").trim();
  if (!host) return "";

  const protocol = req.secure ? "https" : "http";
  return `${protocol}://${host}`;
}

function createHelmetMiddleware({ reportOnly = false } = {}) {
  return helmet({
    contentSecurityPolicy: {
      reportOnly,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  });
}

function requestTimingLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });

  next();
}

function csrfProtection({ allowedOrigins = [] } = {}) {
  const allowlist = new Set(allowedOrigins.filter(Boolean));

  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }

    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin) {
      return next();
    }

    const hostOrigin = getHostOrigin(req);
    if (allowlist.has(requestOrigin) || (hostOrigin && requestOrigin === hostOrigin)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Requete bloquee par la protection CSRF.",
    });
  };
}

module.exports = {
  createHelmetMiddleware,
  csrfProtection,
  requestTimingLogger,
};
