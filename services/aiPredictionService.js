/**
 * Service de Prédiction IA via API
 * Génère des prédictions foudroyantes par l'intelligence artificielle
 */

const { genererPredictionUnifiee } = require('./unifiedPrediction');
const { buildExactScoreConvergence } = require('./exactScoreConvergence');
const { predictionEngine } = require('./prediction');
const { predictWithProviderCouncil } = require('./predictionProviderCouncil');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildProviderCouncilPrediction(providerCouncil = {}) {
  const bestValuePick = providerCouncil.playablePicks?.[0] || null;
  const providersAvailable = Number(providerCouncil.summary?.providersAvailable || 0);
  return {
    timestamp: providerCouncil.generatedAt || new Date().toISOString(),
    source: "FOUR_API_CONSENSUS",
    confidence: bestValuePick ? Number((bestValuePick.probability * 100).toFixed(1)) : 0,
    prediction: bestValuePick?.market || null,
    reasoning: bestValuePick
      ? [`Choix retenu par ${bestValuePick.providersCount} API, accord ${bestValuePick.agreementPct}%, avantage estimé ${(bestValuePick.edge * 100).toFixed(1)}%.`]
      : [`Aucun choix de valeur n'a passé les seuils. ${providersAvailable}/4 API ont répondu.`],
    exactScore: null,
    marketRecommendation: bestValuePick ? {
      type: bestValuePick.market,
      odds: bestValuePick.offeredOdds,
      fairOdds: bestValuePick.fairOdds,
      edge: bestValuePick.edge,
    } : null,
    providerCouncil,
  };
}

async function generateAIPredictionViaAPI(matchData = {}) {
  const { id, team1, team2, league, markets } = matchData;
  const providerCouncil = await predictWithProviderCouncil(
    { id, teamHome: team1, teamAway: team2, league },
    { I: id, SI: 85, L: league, O1: team1, O2: team2 },
    Array.isArray(markets) ? markets : []
  );
  return buildProviderCouncilPrediction(providerCouncil);
}
/**
 * Intègre tous les systèmes de prédiction en parfaite communion
 */
async function integrateAllPredictionSystems(matchData) {
  const { team1, team2, league, markets, context } = matchData;
  const score1 = context?.score1 || 0;
  const score2 = context?.score2 || 0;
  const minute = context?.minute || 0;
  
  // 1. Exécuter le système de prédiction unifié
  const unifiedPrediction = genererPredictionUnifiee({
    team1,
    team2,
    league,
    context: { score1, score2, minute },
    bets: markets
  });
  
  // 2. Exécuter le moteur de prédiction principal
  const mainPrediction = predictionEngine.calculatePrediction({
    id: matchData.id || "unknown",
    homeTeam: team1,
    awayTeam: team2,
    odds: extractOddsFromMarkets(markets)
  });
  
  // 3. Exécuter la convergence des scores exacts
  const exactScoreConvergence = buildExactScoreConvergence({
    bettingMarkets: markets,
    prediction: unifiedPrediction,
    league,
    homeTeam: team1,
    awayTeam: team2
  });
  
  // 4. Les quatre API alimentent un seul conseil de consensus partagé.
  const providerCouncil = await predictWithProviderCouncil(
    { id: matchData.id, teamHome: team1, teamAway: team2, league },
    { I: matchData.id, SI: 85, L: league, O1: team1, O2: team2 },
    markets || []
  );

  const aiPrediction = buildProviderCouncilPrediction(providerCouncil);
  
  // 6. Fusionner tous les résultats
  const integratedResult = {
    timestamp: new Date().toISOString(),
    version: "INTEGRATED_PREDICTION_V2",
    match: `${team1} vs ${team2}`,
    league,
    context: { score1, score2, minute },
    
    // Système unifié
    unified: {
      meta: unifiedPrediction.meta,
      maitre: unifiedPrediction.maitre,
      bots: unifiedPrediction.bots
    },
    
    // Moteur principal
    main: mainPrediction,
    
    // Convergence scores exacts
    exactScore: exactScoreConvergence,
    
    // Prédiction IA via API
    ai: aiPrediction,

    // Réunion des providers externes, probabilités et sélections du bookmaker
    providerCouncil,
    
    // Consensus final
    consensus: {
      ...calculateFinalConsensus(unifiedPrediction, mainPrediction, exactScoreConvergence, providerCouncil),
      externalProvidersAvailable: providerCouncil.summary.providersAvailable,
      externalProvidersConfigured: providerCouncil.summary.providersConfigured,
      marketConsensus: providerCouncil.marketConsensus,
      playablePicks: providerCouncil.playablePicks,
    }
  };
  
  return integratedResult;
}

/**
 * Extrait les cotes des marchés
 */
function extractOddsFromMarkets(markets) {
  if (!markets || markets.length === 0) return {};
  
  const odds = {};
  for (const market of markets) {
    const norm = normalizeText(market.nom || "");
    if (norm.includes("victoire") || norm.includes("1") || norm.includes("domicile")) {
      odds.homeWin = market.cote;
    } else if (norm.includes("exterieur") || norm.includes("2")) {
      odds.awayWin = market.cote;
    } else if (norm.includes("nul") || norm.includes("x")) {
      odds.draw = market.cote;
    }
  }
  
  return odds;
}

/**
 * Calcule le consensus final de tous les systèmes
 */
function calculateFinalConsensus(unified, main, exactScore, providerCouncil = {}) {
  const consensus = {
    action: "ANALYSE",
    confidence: 0,
    recommendation: "",
    sources: []
  };
  
  const confidenceContributions = [];
  const addSource = (name, confidence, weight, recommendation) => {
    const score = Number(confidence);
    if (!Number.isFinite(score) || score <= 0) return;
    confidenceContributions.push({ score: Math.max(0, Math.min(100, score)), weight });
    consensus.sources.push({ name, confidence: score, recommendation: recommendation || "N/A" });
  };
  
  // Contribution du système unifié
  addSource("Système Unifié", unified?.maitre?.decision_finale?.confiance_numerique, 0.25, unified?.maitre?.decision_finale?.recommandation);
  
  // Contribution du moteur principal
  addSource("Moteur Principal", main?.confidence, 0.2, main?.recommendedBet?.description);
  
  // Contribution de la convergence des scores exacts
  addSource("Convergence Scores Exacts", exactScore?.reliability, 0.15, exactScore?.primary?.score);
  
  // Contribution de l'IA
  const valuePick = providerCouncil?.playablePicks?.[0] || null;
  const consensusMarket = (providerCouncil?.marketConsensus || [])
    .filter((market) => Number(market.providersCount || 0) >= 2 && market.recommendationProbability != null)
    .sort((a, b) => Number(b.agreementPct || 0) - Number(a.agreementPct || 0))[0];
  const apiProbability = Number(valuePick?.probability ?? consensusMarket?.recommendationProbability ?? 0);
  const apiAgreement = Number(valuePick?.agreementPct ?? consensusMarket?.agreementPct ?? 0);
  const apiConfidence = apiProbability > 0
    ? apiProbability * 100 * 0.7 + apiAgreement * 0.3
    : 0;
  addSource(
    "Consensus des quatre API",
    apiConfidence,
    0.4,
    valuePick?.market || consensusMarket?.recommendedSelection || "Aucun consensus de valeur"
  );

  const totalWeight = confidenceContributions.reduce((sum, item) => sum + item.weight, 0);
  const weightedConfidence = confidenceContributions.reduce((sum, item) => sum + item.score * item.weight, 0);
  consensus.confidence = totalWeight ? clamp(weightedConfidence / totalWeight, 0, 100) : 0;
  
  // Déterminer l'action finale
  if (consensus.confidence >= 75) {
    consensus.action = "MISE FORTE RECOMMANDEE";
    consensus.recommendation = "Consensus élevé - Tous les systèmes alignés";
  } else if (consensus.confidence >= 60) {
    consensus.action = "MISE RECOMMANDEE";
    consensus.recommendation = "Consensus bon - Systèmes majoritairement alignés";
  } else if (consensus.confidence >= 45) {
    consensus.action = "MISE MODEREE";
    consensus.recommendation = "Consensus modéré - Analyse continue";
  } else {
    consensus.action = "ATTENDRE";
    consensus.recommendation = "Consensus faible - Prudence recommandée";
  }
  
  return consensus;
}

module.exports = {
  generateAIPredictionViaAPI,
  integrateAllPredictionSystems,
  calculateFinalConsensus
};
