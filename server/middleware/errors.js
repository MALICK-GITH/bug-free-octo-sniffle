function apiNotFound(_req, res) {
  return res.status(404).json({
    success: false,
    message: "Route API introuvable.",
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number(err.statusCode || err.status || 500);
  const payload = {
    success: false,
    message: err.message || "Erreur serveur inattendue.",
  };

  if (process.env.NODE_ENV !== "production" && err.details) {
    payload.details = err.details;
  }

  if (req.originalUrl && req.originalUrl.startsWith("/api")) {
    return res.status(statusCode).json(payload);
  }

  return res.status(statusCode).send(payload.message);
}

module.exports = {
  apiNotFound,
  errorHandler,
};
