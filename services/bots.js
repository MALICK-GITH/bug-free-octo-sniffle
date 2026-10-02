/**
 * Système Multi-Bots - Inspiré de penaltyS
 * 5 bots spécialisés pour l'analyse des paris
 */

const { getLeagueProfile, scoreMarketAgainstProfile } = require('./leagueProfiles');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Bot Unifié - Analyse globale
 */
function analyserPariUnifie(pari, team1, team2, league, score1, score2, minute) {
  let confiance = 50;
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);
  const leagueProfile = getLeagueProfile(league);

  // Bonus pour équipes offensives
  const offensiveTeams = ['arsenal', 'manchester city', 'psg', 'real madrid', 'barcelona', 'liverpool'];
  if (offensiveTeams.some(t => normalizeText(team1).includes(t))) confiance += 8;
  if (offensiveTeams.some(t => normalizeText(team2).includes(t))) confiance += 8;

  // Bonus pour cotes dans la range optimale
  if (cote >= 1.8 && cote <= 2.2) confiance += 12;

  // Bonus pour minute avancée
  if (minute > 70) confiance += 8;

  // Analyse spécifique par type de pari
  if (nom.includes('plus') && nom.includes('total')) {
    if (score1 + score2 >= 2 && minute < 60) confiance += 15;
  } else if (nom.includes('moins') && nom.includes('total')) {
    if (score1 + score2 <= 1 && minute > 60) confiance += 15;
  } else if (nom.includes('pair') || nom.includes('impair')) {
    const total = score1 + score2;
    const wantsPair = nom.includes('pair') && !nom.includes('impair');
    const isPair = total % 2 === 0;
    confiance += wantsPair === isPair ? 16 : -6;
    if (minute >= 70) confiance += 6;
  }

  // Profil de ligue
  confiance += scoreMarketAgainstProfile(leagueProfile, nom) * 0.35;

  return clamp(confiance, 5, 95);
}

/**
 * Bot IA - Patterns et adaptation minute
 */
function analyserPariIA(pari, team1, team2, league, score1, score2, minute) {
  let confiance = 55;
  const nom = normalizeText(pari.nom);
  const total = score1 + score2;
  const leagueProfile = getLeagueProfile(league);

  // Analyse des totaux
  if (nom.includes('total')) {
    if (nom.includes('plus')) {
      if (total >= 1 && minute < 45) confiance += 20;
      else if (total === 0 && minute > 70) confiance -= 20;
    } else if (nom.includes('moins')) {
      if (total <= 1 && minute > 60) confiance += 18;
    }
  }

  // Analyse pair/impair
  if (nom.includes('pair') || nom.includes('impair')) {
    const wantsPair = nom.includes('pair') && !nom.includes('impair');
    const isPair = total % 2 === 0;
    if (minute <= 20) confiance += 5;
    if (minute >= 70) confiance += 8;
    confiance += wantsPair === isPair ? 10 : -8;
  }

  // Bonus Arsenal pour over
  if ((normalizeText(team1).includes('arsenal') || normalizeText(team2).includes('arsenal')) && nom.includes('plus')) {
    confiance += 12;
  }

  // Profil de ligue
  confiance += scoreMarketAgainstProfile(leagueProfile, nom) * 0.3;

  return clamp(confiance, 5, 95);
}

/**
 * Bot Probabilités - Calculs probabilistes purs
 */
function analyserPariProbabilites(pari, team1, team2, league, score1, score2, minute) {
  let confiance = 50;
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);

  // Probabilité implicite de la cote
  const impliedProb = 1 / cote;

  // Estimation basée sur le score actuel
  let estimatedProb = 0.5;
  const total = score1 + score2;

  if (nom.includes('plus') && nom.includes('total')) {
    estimatedProb = total >= 2 ? 0.65 : 0.35;
  } else if (nom.includes('moins') && nom.includes('total')) {
    estimatedProb = total <= 1 ? 0.65 : 0.35;
  } else if (nom.includes('victoire') || nom === '1' || nom === '2') {
    // Simplification pour 1X2
    estimatedProb = 0.5 + (score1 - score2) * 0.05;
  }

  // Bonus si probabilité estimée > probabilité implicite
  if (estimatedProb > impliedProb) {
    const diff = (estimatedProb - impliedProb) * 100;
    confiance += diff * 0.5;
  } else {
    confiance -= (impliedProb - estimatedProb) * 30;
  }

  // Ajustement selon la minute
  if (minute > 60) {
    confiance += 5; // Plus de certitude en fin de match
  }

  return clamp(confiance, 5, 95);
}

/**
 * Bot Value - Détection de value betting
 */
function calculerValue(pari, team1, team2, league, score1, score2, minute) {
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);

  // Probabilité implicite
  const impliedProb = 1 / cote;

  // Estimation de probabilité (simplifiée)
  let estimatedProb = 0.5;
  const total = score1 + score2;

  if (nom.includes('plus') && nom.includes('total')) {
    estimatedProb = total >= 2 ? 0.6 : 0.4;
  } else if (nom.includes('moins') && nom.includes('total')) {
    estimatedProb = total <= 1 ? 0.6 : 0.4;
  } else if (nom === '1' || nom.includes('victoire') && normalizeText(team1).includes('domicile')) {
    estimatedProb = 0.55;
  } else if (nom === '2' || nom.includes('victoire') && normalizeText(team2).includes('exterieur')) {
    estimatedProb = 0.45;
  }

  // Calcul de la value
  const value = ((estimatedProb - impliedProb) / impliedProb) * 100;

  // Confiance basée sur la value
  let confiance = 50;
  if (value >= 20) confiance += 30;
  else if (value >= 15) confiance += 25;
  else if (value >= 10) confiance += 20;
  else if (value >= 5) confiance += 10;
  else if (value < 0) confiance -= 15;

  return clamp(confiance, 5, 95);
}

/**
 * Bot Statistique - Analyse statistique avancée
 */
function analyserPariStat(pari, team1, team2, league, score1, score2, minute) {
  let confiance = 50;
  const nom = normalizeText(pari.nom);
  const cote = parseNumber(pari.cote, 2);
  const total = score1 + score2;

  // Hash d'équipe pour variation (simplifié)
  const teamHash = (normalizeText(team1).length + normalizeText(team2).length) % 10;
  confiance += teamHash * 0.5;

  // Analyse selon le type de pari
  if (nom.includes('total')) {
    if (nom.includes('plus')) {
      // Plus probable si score bas et minute faible
      if (total <= 1 && minute < 30) confiance += 15;
      if (total >= 3 && minute < 60) confiance += 10;
    } else if (nom.includes('moins')) {
      // Plus probable si score haut et minute forte
      if (total >= 3 && minute > 60) confiance += 15;
      if (total <= 1 && minute > 70) confiance += 10;
    }
  }

  // Analyse 1X2
  if (nom === '1' || nom.includes('victoire')) {
    if (score1 > score2) confiance += 12;
    if (score1 === score2 && minute < 30) confiance += 5;
  } else if (nom === '2') {
    if (score2 > score1) confiance += 12;
    if (score1 === score2 && minute < 30) confiance += 5;
  }

  // Ajustement selon la cote
  if (cote >= 1.5 && cote <= 2.0) confiance += 8;
  if (cote > 3.0) confiance -= 10;

  return clamp(confiance, 5, 95);
}

/**
 * Maître Pronostics - Consensus des bots
 */
function genererConsensus(pari, team1, team2, league, score1, score2, minute) {
  const predictions = [
    { bot: 'unifie', confiance: analyserPariUnifie(pari, team1, team2, league, score1, score2, minute), seuil: 60 },
    { bot: 'ia', confiance: analyserPariIA(pari, team1, team2, league, score1, score2, minute), seuil: 65 },
    { bot: 'probabilites', confiance: analyserPariProbabilites(pari, team1, team2, league, score1, score2, minute), seuil: 55 },
    { bot: 'value', confiance: calculerValue(pari, team1, team2, league, score1, score2, minute), seuil: 55 },
    { bot: 'statistique', confiance: analyserPariStat(pari, team1, team2, league, score1, score2, minute), seuil: 58 }
  ];

  // Compter les bots qui recommandent le pari
  const botsAgree = predictions.filter(p => p.confidence >= p.seuil).length;
  const averageConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

  // Déterminer le niveau de recommandation
  let recommendation = 'MISE PRUDENTE';
  if (averageConfidence >= 80 && botsAgree >= 4) {
    recommendation = 'MISE FORTE RECOMMANDEE';
  } else if (averageConfidence >= 70 && botsAgree >= 3) {
    recommendation = 'MISE RECOMMANDEE';
  } else if (averageConfidence >= 60 && botsAgree >= 3) {
    recommendation = 'MISE MODEREE';
  } else if (averageConfidence >= 50 && botsAgree >= 2) {
    recommendation = 'MISE PRUDENTE';
  } else {
    recommendation = 'PAS DE MISE RECOMMANDEE';
  }

  return {
    predictions,
    botsAgree,
    averageConfidence: Math.round(averageConfidence),
    recommendation,
    consensus: botsAgree >= 3 // Consensus = 3+/5 bots d'accord
  };
}

/**
 * Analyse multi-bots pour un match complet
 */
function analyserMatchMultiBots(match, markets) {
  const team1 = match.homeTeam;
  const team2 = match.awayTeam;
  const league = match.league;
  const score1 = match.score?.home || 0;
  const score2 = match.score?.away || 0;
  const minute = match.minute || 0;

  // Analyser chaque marché
  const marketAnalyses = markets.map(market => {
    const consensus = genererConsensus(market, team1, team2, league, score1, score2, minute);
    return {
      market: market.nom,
      cote: market.cote,
      ...consensus
    };
  });

  // Trouver le meilleur marché selon le consensus
  const bestMarket = marketAnalyses
    .filter(m => m.consensus)
    .sort((a, b) => b.averageConfidence - a.averageConfidence)[0];

  return {
    marketAnalyses,
    bestMarket,
    totalMarkets: markets.length,
    consensusMarkets: marketAnalyses.filter(m => m.consensus).length
  };
}

module.exports = {
  analyserPariUnifie,
  analyserPariIA,
  analyserPariProbabilites,
  calculerValue,
  analyserPariStat,
  genererConsensus,
  analyserMatchMultiBots
};
