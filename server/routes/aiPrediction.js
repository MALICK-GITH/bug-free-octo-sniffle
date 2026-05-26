/**
 * Routes pour la prédiction IA via API
 * Intégration de tous les systèmes de prédiction en parfaite communion
 */

const { integrateAllPredictionSystems, generateAIPredictionViaAPI } = require("../../services/aiPredictionService");

function registerAIPredictionRoutes(app) {
  /**
   * POST /api/prediction/ai/integrated
   * Intègre tous les systèmes de prédiction en parfaite communion
   * Retourne une prédiction complète avec IA via API
   */
  app.post("/api/prediction/ai/integrated", async (req, res) => {
    try {
      const { team1, team2, league, markets, context, id } = req.body;
      
      if (!team1 || !team2) {
        return res.status(400).json({
          success: false,
          error: "team1 et team2 sont requis"
        });
      }

      const matchData = {
        id: id || `${team1}-${team2}-${Date.now()}`,
        team1,
        team2,
        league: league || "",
        markets: markets || [],
        context: context || { score1: 0, score2: 0, minute: 0 }
      };

      const integratedPrediction = await integrateAllPredictionSystems(matchData);
      
      res.json({
        success: true,
        data: integratedPrediction,
        message: "Prédiction IA intégrée générée avec succès"
      });
    } catch (error) {
      console.error("Erreur dans integrateAllPredictionSystems:", error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/prediction/ai/only
   * Génère uniquement la prédiction IA via API
   * Pour les cas où seule l'IA est nécessaire
   */
  app.post("/api/prediction/ai/only", async (req, res) => {
    try {
      const { team1, team2, league, markets, context } = req.body;
      
      if (!team1 || !team2) {
        return res.status(400).json({
          success: false,
          error: "team1 et team2 sont requis"
        });
      }

      const matchData = {
        team1,
        team2,
        league: league || "",
        markets: markets || [],
        context: context || { score1: 0, score2: 0, minute: 0 }
      };

      const aiPrediction = await generateAIPredictionViaAPI(matchData);
      
      res.json({
        success: true,
        data: aiPrediction,
        message: "Prédiction IA générée avec succès"
      });
    } catch (error) {
      console.error("Erreur dans generateAIPredictionViaAPI:", error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/prediction/ai/status
   * Vérifie le statut du service IA
   */
  app.get("/api/prediction/ai/status", (req, res) => {
    res.json({
      success: true,
      status: "active",
      version: "AI_API_V2",
      features: {
        integrated_predictions: true,
        ai_only_predictions: true,
        exact_score_support: true,
        penalty_league_support: true,
        consensus_calculation: true
      },
      timestamp: new Date().toISOString()
    });
  });
}

module.exports = {
  registerAIPredictionRoutes
};
