const { getLeagueProfile, getLeagueProfileSummary, scoreMarketAgainstProfile } = require("./leagueProfiles");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectMarketFamily(label) {
  const text = normalizeText(label);
  if (text.includes("score exact")) return "EXACT_SCORE";
  if (text.includes("double") || /\b(1x|x2|12)\b/.test(text)) return "DOUBLE_CHANCE";
  if (text.includes("total")) {
    if (text.includes("moins") || text.includes("under")) return "TOTAL_UNDER";
    if (text.includes("plus") || text.includes("over")) return "TOTAL_OVER";
    return "TOTAL";
  }
  if (text.includes("handicap")) return "HANDICAP";
  if (text.includes("pair") || text.includes("impair")) return "PAIR_IMPAIR";
  if (text === "1" || text === "x" || text === "2" || text.includes("victoire") || text.includes("nul")) return "ONE_X_TWO";
  return "OTHER";
}

function familyStability(family) {
  const table = {
    DOUBLE_CHANCE: 18,
    TOTAL_UNDER: 12,
    TOTAL_OVER: 10,
    TOTAL: 8,
    ONE_X_TWO: 6,
    HANDICAP: -3,
    PAIR_IMPAIR: 4,
    EXACT_SCORE: -22,
    OTHER: -4,
  };
  return table[family] ?? 0;
}

function impliedProbability(odd) {
  const cote = parseNumber(odd, 0);
  if (cote <= 1) return 0;
  return clamp(1 / cote, 0.01, 0.99);
}

function collectBotSignals(bots = {}, marketName) {
  const target = String(marketName || "");
  const rows = [];

  for (const [botKey, bot] of Object.entries(bots || {})) {
    for (const pick of bot?.paris_recommandes || []) {
      if (String(pick?.nom || "") !== target) continue;
      rows.push({
        bot: botKey,
        confidence: parseNumber(pick?.confiance, 50),
        type: pick?.type || null,
      });
    }
  }

  const avgConfidence = rows.length
    ? rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length
    : 0;

  return {
    votes: rows.length,
    avgConfidence,
    supporters: rows.map((row) => row.bot),
  };
}

function collectAdvancedSignal(analyseAvancee = {}, marketName) {
  const rows = Array.isArray(analyseAvancee?.analyses_detaillees)
    ? analyseAvancee.analyses_detaillees
    : [];
  const found = rows.find((row) => String(row?.pari || "") === String(marketName || ""));
  if (!found) {
    return {
      score: 0,
      estimatedProbability: null,
      value: 0,
      risk: "INCONNU",
    };
  }

  return {
    score: parseNumber(found.score_composite, 0),
    estimatedProbability: parseNumber(found.probabilite_estimee, 0) / 100,
    value: parseNumber(found.value, 0),
    risk: found.risque || "INCONNU",
  };
}

function estimateProbability({ market, family, botSignal, advancedSignal, profileScore, score1, score2, minute }) {
  const odd = parseNumber(market?.cote, 2);
  const implied = impliedProbability(odd);
  const currentTotal = parseNumber(score1, 0) + parseNumber(score2, 0);
  let estimate = Number.isFinite(advancedSignal.estimatedProbability)
    ? advancedSignal.estimatedProbability
    : implied;

  if (!estimate || estimate <= 0) {
    estimate = implied || 0.5;
  }

  if (botSignal.votes > 0) {
    const botProb = clamp(botSignal.avgConfidence / 100, 0.05, 0.95);
    estimate = estimate * 0.62 + botProb * 0.38;
  }

  if (family === "DOUBLE_CHANCE") estimate += 0.08;
  if (family === "TOTAL_OVER" && currentTotal >= 1 && minute < 55) estimate += 0.04;
  if (family === "TOTAL_UNDER" && currentTotal <= 1 && minute >= 45) estimate += 0.04;
  if (family === "EXACT_SCORE") estimate -= 0.18;
  if (odd > 3) estimate -= 0.08;
  if (odd >= 1.35 && odd <= 2.25) estimate += 0.03;

  estimate += clamp(profileScore, -20, 20) / 500;
  return clamp(estimate, 0.03, 0.94);
}

function classifyDecision(score, valuePercent, probability) {
  if (score >= 82 && valuePercent >= 4 && probability >= 0.48) return "MISE_RECOMMANDEE";
  if (score >= 72 && probability >= 0.43) return "MISE_PRUDENTE";
  if (score >= 62 && valuePercent >= 0) return "SURVEILLER";
  return "EVITER";
}

function riskLabel(score, odd, family) {
  if (family === "EXACT_SCORE" || odd > 3) return "ELEVE";
  if (score >= 78 && odd <= 2.15) return "FAIBLE";
  if (score >= 65 && odd <= 2.7) return "MODERE";
  return "ELEVE";
}

function buildMarketDecision({ market, bots, analyseAvancee, leagueProfile, score1, score2, minute, totalBots }) {
  const name = String(market?.nom || "").trim();
  const odd = parseNumber(market?.cote, 0);
  const family = detectMarketFamily(name);
  const profileScore = scoreMarketAgainstProfile(leagueProfile, name);
  const botSignal = collectBotSignals(bots, name);
  const advancedSignal = collectAdvancedSignal(analyseAvancee, name);
  const probability = estimateProbability({
    market,
    family,
    botSignal,
    advancedSignal,
    profileScore,
    score1,
    score2,
    minute,
  });
  const implied = impliedProbability(odd);
  const valuePercent = implied ? ((probability - implied) / implied) * 100 : 0;
  const voteRatio = totalBots ? botSignal.votes / totalBots : 0;
  const confidence =
    probability * 42 +
    voteRatio * 22 +
    (botSignal.avgConfidence / 100) * 16 +
    clamp(advancedSignal.score, 0, 100) * 0.12 +
    familyStability(family) +
    clamp(profileScore, -25, 25) * 0.3 +
    clamp(valuePercent, -25, 35) * 0.22;

  const decisionScore = clamp(confidence, 0, 100);

  return {
    pari: name,
    cote: odd,
    family,
    probability: Number((probability * 100).toFixed(1)),
    impliedProbability: Number((implied * 100).toFixed(1)),
    value: Number(valuePercent.toFixed(2)),
    confidence: Number(decisionScore.toFixed(1)),
    risk: riskLabel(decisionScore, odd, family),
    action: classifyDecision(decisionScore, valuePercent, probability),
    botVotes: botSignal.votes,
    botSupporters: botSignal.supporters,
    advancedScore: Number(advancedSignal.score.toFixed(1)),
    profileScore: Number(profileScore.toFixed(1)),
    reasons: buildReasons({ family, botSignal, valuePercent, probability, profileScore, decisionScore, odd }),
  };
}

function buildReasons({ family, botSignal, valuePercent, probability, profileScore, decisionScore, odd }) {
  const reasons = [];
  if (botSignal.votes >= 3) reasons.push("Consensus multi-bots fort");
  else if (botSignal.votes >= 1) reasons.push("Appui partiel des bots");
  else reasons.push("Peu de consensus direct");

  if (valuePercent > 8) reasons.push("Value positive detectee contre la cote");
  if (probability >= 0.55) reasons.push("Probabilite estimee favorable");
  if (family === "DOUBLE_CHANCE" || family.startsWith("TOTAL")) reasons.push("Marche plus stable qu'un score exact");
  if (family === "PAIR_IMPAIR") reasons.push("Marche binaire pair/impair, lisible en live");
  if (family === "EXACT_SCORE") reasons.push("Marche exact score: risque structurel eleve");
  if (profileScore > 8) reasons.push("Profil de ligue favorable");
  if (odd > 2.75) reasons.push("Cote elevee, variance plus forte");
  if (decisionScore < 62) reasons.push("Score global insuffisant pour une selection principale");
  return reasons;
}

function chooseAlternative(matrix, predicate, excludedPari) {
  return matrix.find((row) => row.pari !== excludedPari && predicate(row)) || null;
}

function buildConsensusPrediction({ team1, team2, league, context = {}, bets = [], bots = {}, analyseAvancee = {} }) {
  const score1 = parseNumber(context?.score1, 0);
  const score2 = parseNumber(context?.score2, 0);
  const minute = parseNumber(context?.minute, 0);
  const leagueProfile = getLeagueProfile(league);
  const validMarkets = (Array.isArray(bets) ? bets : [])
    .filter((market) => String(market?.nom || "").trim())
    .filter((market) => {
      const odd = parseNumber(market?.cote, 0);
      return odd >= 1.15 && odd <= 6;
    });
  const totalBots = Object.values(bots || {}).filter((bot) => Array.isArray(bot?.paris_recommandes)).length || 5;

  const matrix = validMarkets
    .map((market) =>
      buildMarketDecision({
        market,
        bots,
        analyseAvancee,
        leagueProfile,
        score1,
        score2,
        minute,
        totalBots,
      })
    )
    .sort((a, b) => b.confidence - a.confidence || b.value - a.value || a.cote - b.cote);

  const primary =
    matrix.find((row) => row.action === "MISE_RECOMMANDEE") ||
    matrix.find((row) => row.action === "MISE_PRUDENTE") ||
    matrix[0] ||
    null;

  const safeAlternative = primary
    ? chooseAlternative(
        matrix,
        (row) =>
          row.risk !== "ELEVE" &&
          row.cote <= 2.2 &&
          row.family !== "EXACT_SCORE" &&
          row.confidence >= 58,
        primary.pari
      )
    : null;
  const valueAlternative = primary
    ? chooseAlternative((matrix), (row) => row.value > 4 && row.confidence >= 58, primary.pari)
    : null;
  const aggressiveAlternative = primary
    ? chooseAlternative(
        matrix,
        (row) => row.cote >= 2.2 && row.confidence >= 55 && row.family !== "EXACT_SCORE",
        primary.pari
      )
    : null;

  const finalAction = primary
    ? primary.action
    : "AUCUN_PARI";
  const noBet = !primary || primary.confidence < 58 || primary.action === "EVITER";

  return {
    version: "CONSENSUS-PREDICTOR-1.0",
    generatedAt: new Date().toISOString(),
    match: `${team1} vs ${team2}`,
    league,
    context: { score1, score2, minute },
    action: noBet ? "AUCUN_PARI" : finalAction,
    primary: noBet ? null : primary,
    alternatives: {
      prudent: safeAlternative,
      value: valueAlternative,
      offensif: aggressiveAlternative,
    },
    topMarkets: matrix.slice(0, 8),
    marketCount: matrix.length,
    leagueProfile: getLeagueProfileSummary(leagueProfile),
    behaviour:
      "Toujours proposer une decision principale accompagnee d'une alternative prudente et d'un signal no-bet si la confiance est faible.",
  };
}

function toMasterDecision(consensus, fallbackDecision = {}) {
  const primary = consensus?.primary;
  if (!primary) {
    return {
      ...fallbackDecision,
      action: "AUCUN_PARI",
      raison: "Le moteur de consensus ne valide aucun marche avec assez de confiance.",
      recommandation: "ATTENDRE UNE MEILLEURE OPPORTUNITE",
      moteur: consensus?.version || "CONSENSUS-PREDICTOR-1.0",
    };
  }

  const actionMap = {
    MISE_RECOMMANDEE: "MISE RECOMMANDEE",
    MISE_PRUDENTE: "MISE PRUDENTE",
    SURVEILLER: "SURVEILLER",
  };

  return {
    ...fallbackDecision,
    pari_choisi: primary.pari,
    cote: primary.cote,
    type_pari: primary.family,
    action: actionMap[primary.action] || primary.action,
    niveau_confiance: primary.risk === "FAIBLE" ? "ELEVEE" : primary.risk === "MODERE" ? "MODEREE" : "PRUDENTE",
    confiance_numerique: primary.confidence,
    confidence: primary.confidence,
    recommandation: `CONSENSUS: ${actionMap[primary.action] || primary.action}`,
    probabilite_estimee: primary.probability,
    value: primary.value,
    risque: primary.risk,
    alternative_prudente: consensus?.alternatives?.prudent
      ? {
          pari: consensus.alternatives.prudent.pari,
          cote: consensus.alternatives.prudent.cote,
          confiance: consensus.alternatives.prudent.confidence,
        }
      : null,
    moteur: consensus?.version || "CONSENSUS-PREDICTOR-1.0",
  };
}

module.exports = {
  buildConsensusPrediction,
  toMasterDecision,
  detectMarketFamily,
};
