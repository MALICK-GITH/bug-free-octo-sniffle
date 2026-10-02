const { getAdvancedPrediction, getTournamentsList } = require("../../services/liveFeed");

function registerAdvancedPredictionRoutes(app) {
  /**
   * GET /api/prediction/advanced/:matchId
   * Récupère une prédiction avancée pour un match spécifique
   * Utilise le moteur de prédiction penaltyS avec Kelly Criterion
   */
  app.get("/api/prediction/advanced/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      
      if (!matchId) {
        return res.status(400).json({
          success: false,
          error: "matchId est requis"
        });
      }

      const prediction = await getAdvancedPrediction(matchId);
      
      res.json({
        success: true,
        data: prediction
      });
    } catch (error) {
      console.error("Erreur dans getAdvancedPrediction:", error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/tournaments
   * Récupère la liste des tournois FIFA Penalty
   */
  app.get("/api/tournaments", async (req, res) => {
    try {
      const result = await getTournamentsList();
      
      res.json(result);
    } catch (error) {
      console.error("Erreur dans getTournamentsList:", error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        tournaments: []
      });
    }
  });

  /**
   * GET /api/tournaments/penalty
   * Récupère uniquement les tournois Penalty
   */
  app.get("/api/tournaments/penalty", async (req, res) => {
    try {
      const result = await getTournamentsList();
      
      // Filtrer uniquement les tournois penalty
      const penaltyTournaments = result.tournaments.filter(t => t.isPenalty);
      
      res.json({
        success: true,
        tournaments: penaltyTournaments,
        total: penaltyTournaments.length,
        fetchedAt: result.fetchedAt
      });
    } catch (error) {
      console.error("Erreur dans getPenaltyTournaments:", error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        tournaments: []
      });
    }
  });
}

module.exports = {
  registerAdvancedPredictionRoutes
};
