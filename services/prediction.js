/**
 * Moteur de Prédiction Avancé - Inspiré de penaltyS
 * Utilise le Kelly Criterion et l'Expected Value pour les prédictions
 */

const { genererPredictionUnifiee } = require('./unifiedPrediction');
const { evaluateMatch } = require('./extraPowerFilter');

// Mock data pour les statistiques d'équipe (fallback)
const MOCK_TEAM_STATS = {
  // 12 équipes populaires avec stats réalistes
  'real madrid': { wins: 14, draws: 5, losses: 3, goalsFor: 45, goalsAgainst: 22, recentForm: ['W','W','D','W','L'] },
  'fc barcelona': { wins: 13, draws: 6, losses: 3, goalsFor: 42, goalsAgainst: 24, recentForm: ['W','D','W','W','D'] },
  'manchester united': { wins: 12, draws: 4, losses: 6, goalsFor: 38, goalsAgainst: 28, recentForm: ['W','L','W','D','W'] },
  'liverpool fc': { wins: 13, draws: 5, losses: 4, goalsFor: 40, goalsAgainst: 25, recentForm: ['W','W','L','W','D'] },
  'bayern munich': { wins: 15, draws: 4, losses: 3, goalsFor: 48, goalsAgainst: 20, recentForm: ['W','W','W','D','W'] },
  'paris saint-germain': { wins: 14, draws: 5, losses: 3, goalsFor: 46, goalsAgainst: 23, recentForm: ['W','D','W','W','L'] },
  'juventus fc': { wins: 12, draws: 6, losses: 4, goalsFor: 36, goalsAgainst: 24, recentForm: ['D','W','W','L','W'] },
  'ac milan': { wins: 11, draws: 5, losses: 6, goalsFor: 35, goalsAgainst: 27, recentForm: ['W','L','D','W','W'] },
  'chelsea fc': { wins: 12, draws: 4, losses: 6, goalsFor: 37, goalsAgainst: 26, recentForm: ['L','W','W','D','W'] },
  'arsenal fc': { wins: 13, draws: 5, losses: 4, goalsFor: 39, goalsAgainst: 24, recentForm: ['W','W','D','W','L'] },
  'inter milan': { wins: 12, draws: 5, losses: 5, goalsFor: 38, goalsAgainst: 26, recentForm: ['W','D','W','L','W'] },
  'atletico madrid': { wins: 11, draws: 6, losses: 5, goalsFor: 34, goalsAgainst: 23, recentForm: ['D','W','L','W','D'] }
};

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
 * Récupère les statistiques d'une équipe (avec fallback sur mock data)
 */
function getTeamStats(teamName) {
  const normalized = normalizeText(teamName);
  return MOCK_TEAM_STATS[normalized] || {
    wins: 10,
    draws: 5,
    losses: 5,
    goalsFor: 30,
    goalsAgainst: 25,
    recentForm: ['W','D','W','L','D']
  };
}

/**
 * Calcule le score de forme d'une équipe
 * W = +3, D = +1, L = -1
 */
function calculateFormScore(form) {
  if (!Array.isArray(form) || form.length === 0) return 0.5;
  const points = { 'W': 3, 'D': 1, 'L': -1 };
  const sum = form.reduce((acc, r) => acc + (points[r] || 0), 0);
  return clamp((sum + 5) / 15, 0, 1);
}

/**
 * Calcule la force d'une équipe
 * Win Rate (40%) + Goal Diff (30%) + Recent Form (30%)
 */
function calculateTeamStrength(stats) {
  const totalGames = stats.wins + stats.draws + stats.losses;
  const winRate = totalGames > 0 ? stats.wins / totalGames : 0.5;
  const goalDiff = stats.goalsFor - stats.goalsAgainst;
  const normalizedGoalDiff = clamp(goalDiff / 30, -1, 1);
  const formScore = calculateFormScore(stats.recentForm);
  
  const strength = (winRate * 0.4) + ((normalizedGoalDiff + 1) / 2 * 0.3) + (formScore * 0.3);
  return clamp(strength, 0, 1);
}

/**
 * Calcule les probabilités de victoire
 */
function calculateProbabilities(homeStrength, awayStrength, homeAdvantage = 0.15) {
  const adjustedHomeStrength = clamp(homeStrength + homeAdvantage, 0, 1);
  const totalStrength = adjustedHomeStrength + awayStrength;
  
  const homeWinProb = totalStrength > 0 ? adjustedHomeStrength / totalStrength : 0.5;
  const awayWinProb = totalStrength > 0 ? awayStrength / totalStrength : 0.5;
  const drawProb = 0.1; // Penalty a rarement de match nul
  
  // Normaliser pour que la somme = 1
  const total = homeWinProb + awayWinProb + drawProb;
  return {
    homeWin: homeWinProb / total,
    awayWin: awayWinProb / total,
    draw: drawProb / total
  };
}

/**
 * Calcule l'Expected Value (EV)
 * EV = (probability * odds) - 1
 */
function calculateExpectedValue(probability, odds) {
  return (probability * odds) - 1;
}

/**
 * Kelly Criterion simplifié pour calculer la mise
 * stake = clamp(kelly * 100, 1, 8) - Max 8% du bankroll
 */
function calculateKellyStake(ev, odds, probability) {
  const edge = Math.max(ev, 0);
  const kelly = (edge / (odds - 1)) * probability;
  return clamp(kelly * 100, 1, 8);
}

/**
 * Moteur de prédiction principal
 */
class PredictionEngine {
  constructor() {
    this.homeAdvantage = 0.15; // 15% avantage domicile
  }

  /**
   * Calcule une prédiction complète pour un match
   */
  calculatePrediction(match) {
    const homeStats = getTeamStats(match.homeTeam);
    const awayStats = getTeamStats(match.awayTeam);
    
    const homeStrength = calculateTeamStrength(homeStats);
    const awayStrength = calculateTeamStrength(awayStats);
    
    const probabilities = calculateProbabilities(homeStrength, awayStrength, this.homeAdvantage);
    
    // Calculer l'EV pour chaque option
    const homeEV = calculateExpectedValue(probabilities.homeWin, match.odds?.homeWin || 1.8);
    const awayEV = calculateExpectedValue(probabilities.awayWin, match.odds?.awayWin || 2.0);
    const drawEV = calculateExpectedValue(probabilities.draw, match.odds?.draw || 0);
    
    // Sélectionner le pari avec le meilleur EV positif
    let recommendedBet = null;
    let maxEV = -Infinity;
    
    if (homeEV > maxEV && homeEV > 0) {
      maxEV = homeEV;
      recommendedBet = {
        type: 'home_win',
        description: `Victoire ${match.homeTeam}`,
        odds: match.odds?.homeWin || 1.8,
        probability: probabilities.homeWin,
        ev: homeEV,
        stake: calculateKellyStake(homeEV, match.odds?.homeWin || 1.8, probabilities.homeWin)
      };
    }
    
    if (awayEV > maxEV && awayEV > 0) {
      maxEV = awayEV;
      recommendedBet = {
        type: 'away_win',
        description: `Victoire ${match.awayTeam}`,
        odds: match.odds?.awayWin || 2.0,
        probability: probabilities.awayWin,
        ev: awayEV,
        stake: calculateKellyStake(awayEV, match.odds?.awayWin || 2.0, probabilities.awayWin)
      };
    }
    
    // Si aucun EV positif, choisir le résultat le plus probable
    if (!recommendedBet) {
      if (probabilities.homeWin > probabilities.awayWin) {
        recommendedBet = {
          type: 'home_win',
          description: `Victoire ${match.homeTeam}`,
          odds: match.odds?.homeWin || 1.8,
          probability: probabilities.homeWin,
          ev: homeEV,
          stake: 2 // Mise conservatrice par défaut
        };
      } else {
        recommendedBet = {
          type: 'away_win',
          description: `Victoire ${match.awayTeam}`,
          odds: match.odds?.awayWin || 2.0,
          probability: probabilities.awayWin,
          ev: awayEV,
          stake: 2
        };
      }
    }
    
    // Calculer les paris alternatifs (max 3)
    const alternativeBets = this.calculateAlternativeBets(match, probabilities, recommendedBet);
    
    // Calculer la confiance globale
    const confidence = this.calculateConfidence(probabilities, maxEV, recommendedBet);
    
    // Générer le reasoning
    const reasoning = this.generateReasoning(homeStrength, awayStrength, probabilities, recommendedBet);
    
    return {
      matchId: match.id,
      recommendedBet,
      alternativeBets,
      confidence,
      reasoning,
      riskLevel: this.determineRiskLevel(confidence, recommendedBet.ev),
      expectedValue: recommendedBet.ev,
      probabilities,
      teamStrength: { home: homeStrength, away: awayStrength }
    };
  }

  /**
   * Calcule les paris alternatifs
   */
  calculateAlternativeBets(match, probabilities, recommendedBet) {
    const alternatives = [];
    
    // Option 1: L'autre résultat 1X2
    if (recommendedBet.type === 'home_win' && match.odds?.awayWin) {
      alternatives.push({
        type: 'away_win',
        description: `Victoire ${match.awayTeam}`,
        odds: match.odds.awayWin,
        probability: probabilities.awayWin,
        ev: calculateExpectedValue(probabilities.awayWin, match.odds.awayWin),
        stake: 1
      });
    } else if (recommendedBet.type === 'away_win' && match.odds?.homeWin) {
      alternatives.push({
        type: 'home_win',
        description: `Victoire ${match.homeTeam}`,
        odds: match.odds.homeWin,
        probability: probabilities.homeWin,
        ev: calculateExpectedValue(probabilities.homeWin, match.odds.homeWin),
        stake: 1
      });
    }
    
    // Option 2: Over/Under basé sur la forme défensive
    const homeStats = getTeamStats(match.homeTeam);
    const awayStats = getTeamStats(match.awayTeam);
    const avgGoalsConceded = (homeStats.goalsAgainst + awayStats.goalsAgainst) / 2;
    
    if (avgGoalsConceded > 2.5) {
      alternatives.push({
        type: 'over_2_5',
        description: 'Plus de 2.5 buts',
        odds: 1.85,
        probability: 0.55,
        ev: 0.0175,
        stake: 1.5
      });
    } else {
      alternatives.push({
        type: 'under_2_5',
        description: 'Moins de 2.5 buts',
        odds: 1.9,
        probability: 0.52,
        ev: -0.012,
        stake: 1
      });
    }
    
    return alternatives.slice(0, 3);
  }

  /**
   * Calcule le niveau de confiance
   */
  calculateConfidence(probabilities, ev, recommendedBet) {
    let confidence = 50;
    
    // Basé sur la probabilité du pari recommandé
    const recProb = recommendedBet.probability;
    confidence += (recProb - 0.5) * 40;
    
    // Basé sur l'EV
    if (ev > 0.1) confidence += 15;
    else if (ev > 0.05) confidence += 10;
    else if (ev > 0) confidence += 5;
    else confidence -= 10;
    
    // Basé sur la différence de probabilité
    const probDiff = Math.abs(probabilities.homeWin - probabilities.awayWin);
    confidence += probDiff * 20;
    
    return clamp(confidence, 0, 100);
  }

  /**
   * Détermine le niveau de risque
   */
  determineRiskLevel(confidence, ev) {
    if (confidence >= 75 && ev > 0.1) return 'low';
    if (confidence >= 60 && ev > 0) return 'medium';
    return 'high';
  }

  /**
   * Génère le reasoning explicatif
   */
  generateReasoning(homeStrength, awayStrength, probabilities, recommendedBet) {
    const reasons = [];
    
    reasons.push(`Force domicile: ${(homeStrength * 100).toFixed(1)}%`);
    reasons.push(`Force extérieur: ${(awayStrength * 100).toFixed(1)}%`);
    reasons.push(`Probabilité victoire recommandée: ${(recommendedBet.probability * 100).toFixed(1)}%`);
    reasons.push(`Expected Value: ${(recommendedBet.ev * 100).toFixed(2)}%`);
    
    if (recommendedBet.ev > 0.1) {
      reasons.push('Value betting détecté - EV positif significatif');
    } else if (recommendedBet.ev > 0) {
      reasons.push('Légère value détectée');
    } else {
      reasons.push('Pas de value significative - pari basé sur probabilité');
    }
    
    return reasons;
  }
}

// Instance singleton
const predictionEngine = new PredictionEngine();

module.exports = {
  PredictionEngine,
  predictionEngine,
  getTeamStats,
  calculateTeamStrength,
  calculateProbabilities,
  calculateExpectedValue,
  calculateKellyStake
};
