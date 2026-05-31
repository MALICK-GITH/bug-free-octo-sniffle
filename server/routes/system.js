function registerSystemRoutes(app, { startedAt, getDbStatus, dbService }) {
  async function getAuxiliaryPostgresHealth() {
    if (dbService && typeof dbService.healthCheck === "function") {
      return dbService.healthCheck();
    }
    const status = await getDbStatus();
    return {
      status: status?.ok ? "healthy" : "unhealthy",
      database: status?.database || null,
      mode: status?.mode || null,
      fallback: true,
    };
  }

  app.get("/health", async (_req, res) => {
    try {
      const dbHealth = await getDbStatus();
      const postgresHealth = await getAuxiliaryPostgresHealth();
      res.json({
        ok: true,
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        startedAt: new Date(startedAt).toISOString(),
        database: dbHealth,
        auxiliaryPostgres: postgresHealth,
      });
    } catch (error) {
      res.json({
        ok: true,
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        startedAt: new Date(startedAt).toISOString(),
        database: { status: "error", error: error.message },
      });
    }
  });

  app.get("/api/health", async (_req, res) => {
    try {
      const dbHealth = await getDbStatus();
      const postgresHealth = await getAuxiliaryPostgresHealth();
      res.json({
        success: true,
        status: "healthy",
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        database: dbHealth,
        auxiliaryPostgres: postgresHealth,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: "unhealthy",
        error: error.message,
      });
    }
  });
}

module.exports = {
  registerSystemRoutes,
};
