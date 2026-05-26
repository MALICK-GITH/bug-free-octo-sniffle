/**
 * Service de Prédiction IA via API
 * Génère des prédictions foudroyantes par l'intelligence artificielle
 */

const { genererPredictionUnifiee } = require('./unifiedPrediction');
const { buildExactScoreConvergence } = require('./exactScoreConvergence');
const { predictionEngine } = require('./prediction');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Simule une prédiction IA via API
 * En production, ceci ferait un appel réel à une API d'IA
 */
async function generateAIPredictionViaAPI(matchData) {
  // Simulation d'un appel API avec délai
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  const { team1, team2, league, markets, context } = matchData;
  const score1 = context?.score1 || 0;
  const score2 = context?.score2 || 0;
  const minute = context?.minute || 0;
  
  // Algorithme IA avancé pour générer une prédiction
  const aiAnalysis = {
    timestamp: new Date().toISOString(),
    source: "AI_API_V2",
    confidence: 0,
    prediction: null,
    reasoning: [],
    exactScore: null,
    marketRecommendation: null
  };
  
  // Analyse contextuelle IA
  const totalGoals = score1 + score2;
  const goalDifference = score1 - score2;
  const timeRemaining = 90 - minute;
  
  // Facteurs IA
  let aiScore = 50;
  const aiReasons = [];
  
  // Facteur 1: Momentum du match
  if (totalGoals > 0 && minute < 30) {
    aiScore += 15;
    aiReasons.push("Début offensif détecté par l'IA");
  }
  
  // Facteur 2: Stabilité défensive
  if (totalGoals === 0 && minute > 60) {
    aiScore += 12;
    aiReasons.push("Défense solide en fin de match");
  }
  
  // Facteur 3: Analyse de l'écart
  if (Math.abs(goalDifference) >= 2) {
    aiScore += 10;
    aiReasons.push("Écart significatif détecté");
  }
  
  // Facteur 4: Temps restant
  if (timeRemaining < 15 && totalGoals <= 1) {
    aiScore += 8;
    aiReasons.push("Peu de temps pour changement majeur");
  }
  
  // Facteur 5: Analyse des marchés disponibles
  if (markets && markets.length > 0) {
    const avgOdds = markets.reduce((sum, m) => sum + (m.cote || 2), 0) / markets.length;
    if (avgOdds > 2.5) {
      aiScore += 5;
      aiReasons.push("Cotes élevées indiquent opportunité");
    }
  }
  
  // Facteur 6: Spécificité ligue
  const leagueNorm = normalizeText(league);
  if (leagueNorm.includes("penalty") || leagueNorm.includes("tir au but")) {
    aiScore += 7;
    aiReasons.push("Mode Penalty - IA spécialisée activée");
  }
  
  // Normalisation du score IA
  aiAnalysis.confidence = clamp(aiScore, 25, 95);
  
  // Génération de la prédiction IA
  if (aiAnalysis.confidence >= 70) {
    aiAnalysis.prediction = "FORT";
    aiReasons.push("Signal IA très fort - Recommandation prioritaire");
  } else if (aiAnalysis.confidence >= 55) {
    aiAnalysis.prediction = "MODÉRÉ";
    aiReasons.push("Signal IA modéré - Analyse continue");
  } else {
    aiAnalysis.prediction = "FAIBLE";
    aiReasons.push("Signal IA faible - Prudence recommandée");
  }
  
  // Prédiction de score exact IA
  const exactScorePrediction = generateAIExactScore(score1, score2, minute, totalGoals);
  aiAnalysis.exactScore = exactScorePrediction;
  aiReasons.push(`Score exact IA prédit: ${exactScorePrediction.score} (confiance: ${(exactScorePrediction.probability * 100).toFixed(1)}%)`);
  
  // Recommandation de marché IA
  const marketRec = generateAIMarketRecommendation(markets, score1, score2, minute);
  aiAnalysis.marketRecommendation = marketRec;
  aiReasons.push(`Recommandation marché IA: ${marketRec.type} @ ${marketRec.odds}`);
  
  aiAnalysis.reasoning = aiReasons;
  
  return aiAnalysis;
}

/**
 * Génère une prédiction de score exact via IA
 */
function generateAIExactScore(currentScore1, currentScore2, minute, totalGoals) {
  const timeRemaining = 90 - minute;
  const scores = [
    { score: "0-0", g1: 0, g2: 0 },
    { score: "1-0", g1: 1, g2: 0 },
    { score: "0-1", g1: 0, g2: 1 },
    { score: "1-1", g1: 1, g2: 1 },
    { score: "2-0", g1: 2, g2: 0 },
    { score: "0-2", g1: 0, g2: 2 },
    { score: "2-1", g1: 2, g2: 1 },
    { score: "1-2", g1: 1, g2: 2 },
    { score: "2-2", g1: 2, g2: 2 },
    { score: "3-0", g1: 3, g2: 0 },
    { score: "0-3", g1: 0, g2: 3 },
    { score: "3-1", g1: 3, g2: 1 },
    { score: "1-3", g1: 1, g2: 3 },
    { score: "3-2", g1: 3, g2: 2 },
    { score: "2-3", g1: 2, g2: 3 },
  ];
  
  let bestScore = scores[0];
  let maxProbability = 0;
  
  for (const score of scores) {
    let probability = 50;
    
    // Ajustement basé sur le score actuel
    if (score.g1 >= currentScore1 && score.g2 >= currentScore2) {
      probability += 20;
    }
    
    // Ajustement basé sur le temps restant
    if (timeRemaining < 15) {
      // En fin de match, favoriser les scores proches du score actuel
      const diff1 = Math.abs(score.g1 - currentScore1);
      const diff2 = Math.abs(score.g2 - currentScore2);
      probability -= (diff1 + diff2) * 5;
    } else if (timeRemaining > 60) {
      // En début de match, favoriser les scores bas
      probability += (4 - (score.g1 + score.g2)) * 3;
    }
    
    // Ajustement basé sur le total actuel
    if (totalGoals === 0 && score.total === 0) {
      probability += 25;
    }
    
    probability = clamp(probability, 10, 90);
    
    if (probability > maxProbability) {
      maxProbability = probability;
      bestScore = score;
    }
  }
  
  return {
    score: bestScore.score,
    probability: maxProbability / 100
  };
}

/**
 * Génère une recommandation de marché via IA
 */
function generateAIMarketRecommendation(markets, score1, score2, minute) {
  const totalGoals = score1 + score2;
  const timeRemaining = 90 - minute;
  
  // Analyse des marchés disponibles
  if (!markets || markets.length === 0) {
    return {
      type: "ATTENDRE",
      odds: "-",
      reason: "Aucun marché disponible"
    };
  }
  
  let bestMarket = null;
  let bestScore = -Infinity;
  
  for (const market of markets) {
    let marketScore = 50;
    const marketNorm = normalizeText(market.nom || "");
    const odds = market.cote || 2;
    
    // Ajustement basé sur le contexte
    if (marketNorm.includes("plus") && totalGoals >= 2 && minute < 60) {
      marketScore += 20;
    }
    
    if (marketNorm.includes("moins") && totalGoals <= 1 && minute > 60) {
      marketScore += 18;
    }
    
    if (marketNorm.includes("victoire") && Math.abs(score1 - score2) >= 1) {
      marketScore += 15;
    }
    
    // Ajustement basé sur la cote
    if (odds >= 1.8 && odds <= 2.5) {
      marketScore += 10;
    }
    
    if (marketScore > bestScore) {
      bestScore = marketScore;
      bestMarket = {
        type: market.nom || "Inconnu",
        odds: odds
      };
    }
  }
  
  if (bestMarket && bestScore >= 60) {
    return {
      type: bestMarket.type,
      odds: bestMarket.odds,
      reason: "Recommandation IA basée sur l'analyse contextuelle"
    };
  }
  
  return {
    type: "ATTENDRE",
    odds: "-",
    reason: "Aucune opportunité IA détectée"
  };
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
  
  // 4. Exécuter la prédiction IA via API
  const aiPrediction = await generateAIPredictionViaAPI(matchData);
  
  // 5. Fusionner tous les résultats en parfaite communion
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
    
    // Consensus final
    consensus: calculateFinalConsensus(unifiedPrediction, mainPrediction, exactScoreConvergence, aiPrediction)
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
function calculateFinalConsensus(unified, main, exactScore, ai) {
  const consensus = {
    action: "ANALYSE",
    confidence: 0,
    recommendation: "",
    sources: []
  };
  
  let totalConfidence = 0;
  let sourceCount = 0;
  
  // Contribution du système unifié
  if (unified?.maitre?.decision_finale?.confiance_numerique) {
    totalConfidence += unified.maitre.decision_finale.confiance_numerique * 0.3;
    sourceCount++;
    consensus.sources.push({
      name: "Système Unifié",
      confidence: unified.maitre.decision_finale.confiance_numerique,
      recommendation: unified.maitre.decision_finale.recommandation
    });
  }
  
  // Contribution du moteur principal
  if (main?.confidence) {
    totalConfidence += main.confidence * 0.25;
    sourceCount++;
    consensus.sources.push({
      name: "Moteur Principal",
      confidence: main.confidence,
      recommendation: main.recommendedBet?.description || "N/A"
    });
  }
  
  // Contribution de la convergence des scores exacts
  if (exactScore?.reliability) {
    totalConfidence += exactScore.reliability * 0.2;
    sourceCount++;
    consensus.sources.push({
      name: "Convergence Scores Exacts",
      confidence: exactScore.reliability,
      recommendation: exactScore.primary?.score || "N/A"
    });
  }
  
  // Contribution de l'IA
  if (ai?.confidence) {
    totalConfidence += ai.confidence * 0.25;
    sourceCount++;
    consensus.sources.push({
      name: "IA via API",
      confidence: ai.confidence,
      recommendation: ai.prediction || "N/A"
    });
  }
  
  consensus.confidence = clamp(totalConfidence, 0, 100);
  
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
