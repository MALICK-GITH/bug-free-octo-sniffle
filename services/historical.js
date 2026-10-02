/**
 * Moteur Historique - Inspiré de penaltyS
 * Analyse des patterns historiques et règles de décision
 */

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
 * Normalisation des noms de ligues
 */
function normalizeLeagueName(leagueName) {
  const normalized = normalizeText(leagueName);
  
  // Normalisation des versions FIFA
  const versionMap = {
    'fc26': 'FC26',
    'fc25': 'FC25',
    'fc24': 'FC24',
    'fifa23': 'FIFA23',
    'fifa22': 'FIFA22',
    'fifa18': 'FIFA18'
  };
  
  for (const [key, value] of Object.entries(versionMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  // Normalisation des modes de jeu
  if (normalized.includes('5x5') || normalized.includes('5 x 5')) return 'FC25_5x5_RUSH';
  if (normalized.includes('4x4') || normalized.includes('4 x 4')) return 'FC24_4x4';
  if (normalized.includes('3x3') || normalized.includes('3 x 3')) return 'FC25_3x3';
  if (normalized.includes('1x1') || normalized.includes('1 x 1')) return 'FC25_1x1';
  
  // Normalisation des championnats
  if (normalized.includes('champions') || normalized.includes('ligue des champions')) return 'CHAMPIONS';
  if (normalized.includes('europe') || normalized.includes('europa') || normalized.includes('euro')) return 'EUROPE';
  if (normalized.includes('espagne') || normalized.includes('la liga')) return 'ESPAGNE';
  if (normalized.includes('angleterre') || normalized.includes('premier')) return 'ANGLETERRE';
  if (normalized.includes('allemagne') || normalized.includes('bundesliga')) return 'ALLEMAGNE';
  if (normalized.includes('italie') || normalized.includes('serie')) return 'ITALIE';
  if (normalized.includes('france') || normalized.includes('ligue 1')) return 'FRANCE';
  
  return normalized.toUpperCase();
}

/**
 * Normalisation des options de pari
 */
function normalizeBetOption(optionName) {
  const normalized = normalizeText(optionName);
  
  if (normalized.includes('handicap')) return 'handicap';
  if (normalized.includes('1x2') || normalized === '1' || normalized === 'x' || normalized === '2') return '1x2';
  if (normalized.includes('double') && (normalized.includes('chance') || normalized.includes('opportunite'))) return 'double_chance';
  if (normalized.includes('total') && normalized.includes('plus') || normalized.includes('over')) return 'total_over';
  if (normalized.includes('total') && normalized.includes('moins') || normalized.includes('under')) return 'total_under';
  if (normalized.includes('equipe') && (normalized.includes('plus') || normalized.includes('over'))) return 'team_total_over';
  if (normalized.includes('equipe') && (normalized.includes('moins') || normalized.includes('under'))) return 'team_total_under';
  
  return normalized;
}

/**
 * Calcul du score historique (0-100)
 */
function calculateHistoricalScore(league, option, odds) {
  let score = 50;
  
  const normalizedLeague = normalizeLeagueName(league);
  const normalizedOption = normalizeBetOption(option);
  
  // Bonus selon la version FIFA
  const leagueBonus = {
    'FC26': 20,
    'FC25': 20,
    'FC25_5x5_RUSH': 25,
    'FC24_4x4': 15,
    'FC24': 12,
    'FIFA23': 10,
    'FIFA22': 8,
    'FIFA18': 5
  };
  
  score += leagueBonus[normalizedLeague] || 0;
  
  // Bonus selon le type de pari
  const optionBonus = {
    'handicap': 18,
    'team_total_over': 14,
    '1x2': 10,
    'total_over': 8,
    'total_under': 8,
    'double_chance': -15
  };
  
  score += optionBonus[normalizedOption] || 0;
  
  // Bonus selon la cote
  if (odds >= 2.20 && odds <= 2.99) {
    score += 18;
  } else if (odds >= 1.80 && odds <= 1.99) {
    score += 12;
  } else if (odds >= 1.50 && odds <= 1.79) {
    score += 5;
  }
  
  // Pénalités pour certaines configurations
  if (normalizedOption === 'total_over' && odds >= 5.5) {
    score -= 28; // Over très élevé risqué
  }
  
  if (normalizedOption === 'handicap' && odds < -2.5) {
    score -= 20; // Handicap très négatif risqué
  }
  
  return clamp(score, 0, 100);
}

/**
 * Construction du moteur de décision
 */
function buildDecisionEngine(rows, totalValidated, opts = {}) {
  const config = {
    minScore: 75,
    moderateScore: 85,
    ...opts
  };
  
  const decisions = rows.map(row => {
    const score = calculateHistoricalScore(row.league, row.option, row.odds);
    
    let decision;
    if (score >= config.moderateScore) {
      decision = 'SAFE';
    } else if (score >= config.minScore) {
      decision = 'MODERATE';
    } else {
      decision = 'NO_PLAY';
    }
    
    return {
      ...row,
      score,
      decision,
      normalizedLeague: normalizeLeagueName(row.league),
      normalizedOption: normalizeBetOption(row.option)
    };
  });
  
  // Statistiques
  const stats = {
    total: decisions.length,
    safe: decisions.filter(d => d.decision === 'SAFE').length,
    moderate: decisions.filter(d => d.decision === 'MODERATE').length,
    noPlay: decisions.filter(d => d.decision === 'NO_PLAY').length,
    averageScore: decisions.reduce((sum, d) => sum + d.score, 0) / decisions.length
  };
  
  return {
    decisions,
    stats,
    config
  };
}

/**
 * Analyse des patterns par ligue
 */
function analyzeLeaguePatterns(decisions) {
  const leagueGroups = {};
  
  decisions.forEach(decision => {
    const league = decision.normalizedLeague;
    if (!leagueGroups[league]) {
      leagueGroups[league] = {
        total: 0,
        safe: 0,
        moderate: 0,
        noPlay: 0,
        averageScore: 0
      };
    }
    
    leagueGroups[league].total++;
    leagueGroups[league].safe += decision.decision === 'SAFE' ? 1 : 0;
    leagueGroups[league].moderate += decision.decision === 'MODERATE' ? 1 : 0;
    leagueGroups[league].noPlay += decision.decision === 'NO_PLAY' ? 1 : 0;
    leagueGroups[league].averageScore += decision.score;
  });
  
  // Calculer les moyennes
  Object.keys(leagueGroups).forEach(league => {
    const group = leagueGroups[league];
    group.averageScore = group.averageScore / group.total;
    group.safeRate = (group.safe / group.total) * 100;
  });
  
  return leagueGroups;
}

/**
 * Analyse des patterns par type de pari
 */
function analyzeOptionPatterns(decisions) {
  const optionGroups = {};
  
  decisions.forEach(decision => {
    const option = decision.normalizedOption;
    if (!optionGroups[option]) {
      optionGroups[option] = {
        total: 0,
        safe: 0,
        moderate: 0,
        noPlay: 0,
        averageScore: 0
      };
    }
    
    optionGroups[option].total++;
    optionGroups[option].safe += decision.decision === 'SAFE' ? 1 : 0;
    optionGroups[option].moderate += decision.decision === 'MODERATE' ? 1 : 0;
    optionGroups[option].noPlay += decision.decision === 'NO_PLAY' ? 1 : 0;
    optionGroups[option].averageScore += decision.score;
  });
  
  // Calculer les moyennes
  Object.keys(optionGroups).forEach(option => {
    const group = optionGroups[option];
    group.averageScore = group.averageScore / group.total;
    group.safeRate = (group.safe / group.total) * 100;
  });
  
  return optionGroups;
}

/**
 * Recommandation basée sur l'historique
 */
function getHistoricalRecommendation(league, option, odds, historicalData) {
  if (!historicalData || historicalData.decisions.length === 0) {
    return {
      recommendation: 'NO_DATA',
      score: 50,
      confidence: 0,
      reason: 'Pas de données historiques disponibles'
    };
  }
  
  const score = calculateHistoricalScore(league, option, odds);
  const normalizedLeague = normalizeLeagueName(league);
  const normalizedOption = normalizeBetOption(option);
  
  // Trouver des décisions similaires
  const similarDecisions = historicalData.decisions.filter(d => 
    d.normalizedLeague === normalizedLeague && 
    d.normalizedOption === normalizedOption
  );
  
  if (similarDecisions.length > 0) {
    const avgSimilarScore = similarDecisions.reduce((sum, d) => sum + d.score, 0) / similarDecisions.length;
    const safeCount = similarDecisions.filter(d => d.decision === 'SAFE').length;
    const confidence = (safeCount / similarDecisions.length) * 100;
    
    let recommendation;
    if (score >= 85 && confidence >= 70) {
      recommendation = 'STRONG_PLAY';
    } else if (score >= 75 && confidence >= 60) {
      recommendation = 'MODERATE_PLAY';
    } else if (score >= 65 && confidence >= 50) {
      recommendation = 'CAUTIOUS_PLAY';
    } else {
      recommendation = 'NO_PLAY';
    }
    
    return {
      recommendation,
      score,
      confidence,
      similarDecisions: similarDecisions.length,
      avgSimilarScore,
      reason: `Basé sur ${similarDecisions.length} décisions similaires`
    };
  }
  
  // Pas de décisions similaires, utiliser le score brut
  let recommendation;
  if (score >= 85) {
    recommendation = 'MODERATE_PLAY';
  } else if (score >= 75) {
    recommendation = 'CAUTIOUS_PLAY';
  } else {
    recommendation = 'NO_PLAY';
  }
  
  return {
    recommendation,
    score,
    confidence: 50,
    similarDecisions: 0,
    reason: 'Pas de décisions similaires, basé sur le score brut'
  };
}

module.exports = {
  normalizeLeagueName,
  normalizeBetOption,
  calculateHistoricalScore,
  buildDecisionEngine,
  analyzeLeaguePatterns,
  analyzeOptionPatterns,
  getHistoricalRecommendation
};
