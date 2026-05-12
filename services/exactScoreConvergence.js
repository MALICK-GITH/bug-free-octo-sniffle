const { getLeagueProfile, scoreMarketAgainstProfile } = require("./leagueProfiles");

const SCORES = [
  { score: "0-0", g1: 0, g2: 0, total: 0 },
  { score: "1-0", g1: 1, g2: 0, total: 1 },
  { score: "0-1", g1: 0, g2: 1, total: 1 },
  { score: "1-1", g1: 1, g2: 1, total: 2 },
  { score: "2-0", g1: 2, g2: 0, total: 2 },
  { score: "0-2", g1: 0, g2: 2, total: 2 },
  { score: "2-1", g1: 2, g2: 1, total: 3 },
  { score: "1-2", g1: 1, g2: 2, total: 3 },
  { score: "2-2", g1: 2, g2: 2, total: 4 },
  { score: "3-0", g1: 3, g2: 0, total: 3 },
  { score: "0-3", g1: 0, g2: 3, total: 3 },
  { score: "3-1", g1: 3, g2: 1, total: 4 },
  { score: "1-3", g1: 1, g2: 3, total: 4 },
  { score: "3-2", g1: 3, g2: 2, total: 5 },
  { score: "2-3", g1: 2, g2: 3, total: 5 },
  { score: "3-3", g1: 3, g2: 3, total: 6 },
  { score: "4-0", g1: 4, g2: 0, total: 4 },
  { score: "0-4", g1: 0, g2: 4, total: 4 },
  { score: "4-1", g1: 4, g2: 1, total: 5 },
  { score: "1-4", g1: 1, g2: 4, total: 5 },
];

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

function softmax(values, temperature = 1) {
  const list = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
  if (!list.length) return [];
  const safeTemperature = Math.max(0.1, Number(temperature) || 1);
  const maxValue = Math.max(...list);
  const exps = list.map((value) => Math.exp((value - maxValue) / safeTemperature));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map((value) => value / sum);
}

function calculPoids(cote) {
  if (!Number.isFinite(cote) || cote <= 0) return 0;
  return 1 / cote;
}

function exactScoreMatchesBias(score, bias) {
  if (!bias || !score || typeof score !== "string") return true;
  const parts = score.split("-").map((part) => Number(part));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return false;
  const [homeGoals, awayGoals] = parts;
  const totalGoals = homeGoals + awayGoals;

  if (bias.outcome === "home" && homeGoals <= awayGoals) return false;
  if (bias.outcome === "away" && awayGoals <= homeGoals) return false;
  if (bias.outcome === "draw" && homeGoals !== awayGoals) return false;
  if (bias.total === "over" && totalGoals <= 2) return false;
  if (bias.total === "under" && totalGoals > 2) return false;

  // Vérification des biais spécifiques aux équipes
  if (bias.teamSpecific) {
    const { team, type, line } = bias.teamSpecific;
    if (team === "home") {
      if (type === "under" && homeGoals > line) return false;
      if (type === "over" && homeGoals <= line) return false;
    } else if (team === "away") {
      if (type === "under" && awayGoals > line) return false;
      if (type === "over" && awayGoals <= line) return false;
    }
  }

  return true;
}

function inferBiasFromRecommendation(recommendation = "", homeTeam = "", awayTeam = "") {
  const text = normalizeText(recommendation);
  const homeTeamNorm = normalizeText(homeTeam);
  const awayTeamNorm = normalizeText(awayTeam);
  if (!text) return null;
  const bias = {};

  if (text.includes("1x") || text.includes("victoire eq1") || text.includes("domicile")) bias.outcome = "home";
  else if (text.includes("x2") || text.includes("victoire eq2") || text.includes("exterieur")) bias.outcome = "away";
  else if (text.includes("12")) bias.outcome = "draw";
  else if (text.includes("nul")) bias.outcome = "draw";

  if (text.includes("plus") || text.includes("over")) bias.total = "over";
  if (text.includes("moins") || text.includes("under")) bias.total = "under";

  // Détection spécifique des totaux d'équipe
  if (homeTeamNorm && text.includes("total") && text.includes(homeTeamNorm)) {
    bias.teamSpecific = {
      team: "home",
      type: text.includes("moins") || text.includes("under") ? "under" : "over",
      line: extractLineFromRecommendation(text)
    };
  } else if (awayTeamNorm && text.includes("total") && text.includes(awayTeamNorm)) {
    bias.teamSpecific = {
      team: "away",
      type: text.includes("moins") || text.includes("under") ? "under" : "over",
      line: extractLineFromRecommendation(text)
    };
  }

  return bias.outcome || bias.total || bias.teamSpecific ? bias : null;
}

function extractLineFromRecommendation(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : null;
}

function buildExactScoreBias(prediction = {}, homeTeam = "", awayTeam = "") {
  const masterRecommendation = String(prediction?.maitre?.decision_finale?.pari_choisi || "").trim();
  const fallbackRecommendation = String(prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari || "").trim();
  return inferBiasFromRecommendation(masterRecommendation || fallbackRecommendation, homeTeam, awayTeam);
}

function scoreCompatibility(score, marketKey, favori) {
  if (!favori) return 0;

  switch (marketKey) {
    case "1x2":
      if (favori === "eq1_gagne") return score.g1 > score.g2 ? 1 : -1;
      if (favori === "nul") return score.g1 === score.g2 ? 1 : -1;
      if (favori === "eq2_gagne") return score.g2 > score.g1 ? 1 : -1;
      break;
    case "double_chance":
      if (favori === "1X") return score.g1 >= score.g2 ? 1 : -1;
      if (favori === "12") return score.g1 !== score.g2 ? 1 : -1;
      if (favori === "X2") return score.g2 >= score.g1 ? 1 : -1;
      break;
    case "over_under_05":
      if (favori === "over") return score.total > 0 ? 1 : -1;
      if (favori === "under") return score.total === 0 ? 1 : -1;
      break;
    case "over_under_15":
      if (favori === "over") return score.total > 1 ? 1 : -1;
      if (favori === "under") return score.total <= 1 ? 1 : -1;
      break;
    case "over_under_25":
      if (favori === "over") return score.total > 2 ? 1 : -1;
      if (favori === "under") return score.total <= 2 ? 1 : -1;
      break;
    case "over_under_35":
      if (favori === "over") return score.total > 3 ? 1 : -1;
      if (favori === "under") return score.total <= 3 ? 1 : -1;
      break;
    case "over_under_45":
      if (favori === "over") return score.total > 4 ? 1 : -1;
      if (favori === "under") return score.total <= 4 ? 1 : -1;
      break;
    case "btts":
      if (favori === "oui") return score.g1 > 0 && score.g2 > 0 ? 1 : -1;
      if (favori === "non") return score.g1 === 0 || score.g2 === 0 ? 1 : -1;
      break;
    case "hcap_eq1_minus05":
      if (favori === "eq1_gagne") return score.g1 > score.g2 ? 1 : -1;
      if (favori === "eq2_gagne") return score.g1 <= score.g2 ? 1 : -1;
      break;
    case "hcap_eq1_minus15":
      if (favori === "eq1_gagne") return score.g1 >= score.g2 + 2 ? 1 : -1;
      if (favori === "eq2_gagne") return score.g1 < score.g2 + 2 ? 1 : -1;
      break;
    case "hcap_eq2_minus05":
      if (favori === "eq2_gagne") return score.g2 > score.g1 ? 1 : -1;
      if (favori === "eq1_gagne") return score.g2 <= score.g1 ? 1 : -1;
      break;
    case "hcap_eq2_minus15":
      if (favori === "eq2_gagne") return score.g2 >= score.g1 + 2 ? 1 : -1;
      if (favori === "eq1_gagne") return score.g2 < score.g1 + 2 ? 1 : -1;
      break;
    case "eq1_buts_over_05":
      if (favori === "over") return score.g1 >= 1 ? 1 : -1;
      if (favori === "under") return score.g1 === 0 ? 1 : -1;
      break;
    case "eq1_buts_over_15":
      if (favori === "over") return score.g1 >= 2 ? 1 : -1;
      if (favori === "under") return score.g1 <= 1 ? 1 : -1;
      break;
    case "eq1_buts_over_25":
      if (favori === "over") return score.g1 >= 3 ? 1 : -1;
      if (favori === "under") return score.g1 <= 2 ? 1 : -1;
      break;
    case "eq2_buts_over_05":
      if (favori === "over") return score.g2 >= 1 ? 1 : -1;
      if (favori === "under") return score.g2 === 0 ? 1 : -1;
      break;
    case "eq2_buts_over_15":
      if (favori === "over") return score.g2 >= 2 ? 1 : -1;
      if (favori === "under") return score.g2 <= 1 ? 1 : -1;
      break;
    case "eq2_buts_over_25":
      if (favori === "over") return score.g2 >= 3 ? 1 : -1;
      if (favori === "under") return score.g2 <= 2 ? 1 : -1;
      break;
    case "mi_temps":
      if (favori === "eq1_gagne") return score.g1 > score.g2 ? 1 : -1;
      if (favori === "nul") return score.g1 === score.g2 ? 1 : -1;
      if (favori === "eq2_gagne") return score.g2 > score.g1 ? 1 : -1;
      break;
    case "mt_ft": {
      const [, ft] = String(favori).split("_");
      if (ft === "1") return score.g1 > score.g2 ? 1 : -1;
      if (ft === "X") return score.g1 === score.g2 ? 1 : -1;
      if (ft === "2") return score.g2 > score.g1 ? 1 : -1;
      break;
    }
    case "score_exact":
      return favori === score.score ? 1 : -1;
    default:
      break;
  }

  return 0;
}

function normalizeMarketLabel(market = {}) {
  const code = market?.code || {};
  const label = normalizeText(market?.nom || "");
  const g = Number(code.g);
  const t = Number(code.t);
  const line = Number(code.line);
  const odd = parseNumber(market?.cote, 0);

  if (!(odd > 0)) return null;

  if (g === 1) {
    if (t === 1) return { key: "1x2", favori: "eq1_gagne", weight: calculPoids(odd), label };
    if (t === 2) return { key: "1x2", favori: "nul", weight: calculPoids(odd), label };
    if (t === 3) return { key: "1x2", favori: "eq2_gagne", weight: calculPoids(odd), label };
  }

  if (g === 8) {
    if (t === 4) return { key: "double_chance", favori: "1X", weight: calculPoids(odd), label };
    if (t === 5) return { key: "double_chance", favori: "12", weight: calculPoids(odd), label };
    if (t === 6) return { key: "double_chance", favori: "X2", weight: calculPoids(odd), label };
  }

  if (g === 17) {
    const key = line <= 0.5 ? "over_under_05" : line <= 1.5 ? "over_under_15" : line <= 2.5 ? "over_under_25" : line <= 3.5 ? "over_under_35" : "over_under_45";
    if (t === 9) return { key, favori: "over", weight: calculPoids(odd), label };
    if (t === 10) return { key, favori: "under", weight: calculPoids(odd), label };
  }

  if (g === 15) {
    const key = line <= 0.5 ? "eq1_buts_over_05" : line <= 1.5 ? "eq1_buts_over_15" : "eq1_buts_over_25";
    if (t === 11) return { key, favori: "over", weight: calculPoids(odd), label };
    if (t === 12) return { key, favori: "under", weight: calculPoids(odd), label };
  }

  if (g === 62) {
    const key = line <= 0.5 ? "eq2_buts_over_05" : line <= 1.5 ? "eq2_buts_over_15" : "eq2_buts_over_25";
    if (t === 13) return { key, favori: "over", weight: calculPoids(odd), label };
    if (t === 14) return { key, favori: "under", weight: calculPoids(odd), label };
  }

  if (g === 19) {
    if (t === 180) return { key: "pair_impar", favori: "pair", weight: calculPoids(odd), label };
    if (t === 181) return { key: "pair_impar", favori: "impair", weight: calculPoids(odd), label };
  }

  if (g === 2 && (t === 7 || t === 8) && Number.isFinite(line)) {
    const lineKey = line <= 0.5 ? "05" : "15";
    const key = t === 7 ? `hcap_eq1_minus${lineKey}` : `hcap_eq2_minus${lineKey}`;
    const favori = t === 7 ? "eq1_gagne" : "eq2_gagne";
    return { key, favori, weight: calculPoids(odd), label };
  }

  if (/^\d-\d$/.test(label)) {
    return { key: "score_exact", favori: label.replace(/\s+/g, ""), weight: calculPoids(odd), label };
  }

  if (label.includes("score exact")) {
    const scoreMatch = label.match(/(\d)\s*[-:]\s*(\d)/);
    if (scoreMatch) {
      return { key: "score_exact", favori: `${scoreMatch[1]}-${scoreMatch[2]}`, weight: calculPoids(odd), label };
    }
  }

  return null;
}

function groupHandicaps(markets) {
  const buckets = new Map();
  for (const market of markets) {
    const code = market?.code || {};
    const g = Number(code.g);
    const t = Number(code.t);
    const line = Number(code.line);
    if (g !== 2 || !Number.isFinite(line) || !(t === 7 || t === 8)) continue;
    const key = `${g}-${line}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(market);
  }
  return buckets;
}

function buildMarketRecords(markets = []) {
  const records = [];
  const handicapBuckets = groupHandicaps(markets);
  const exactScores = [];

  for (const market of markets) {
    const normalized = normalizeMarketLabel(market);
    if (!normalized) continue;

    if (normalized.key === "score_exact") {
      exactScores.push({
        score: normalized.favori,
        odd: parseNumber(market.cote, 0),
        weight: normalized.weight,
        label: normalized.label,
      });
      continue;
    }

    if (normalized.key.startsWith("hcap_")) {
      continue;
    }

    if (normalized.key === "pair_impar") {
      continue;
    }

    records.push({
      key: normalized.key,
      favori: normalized.favori,
      weight: normalized.weight,
      label: normalized.label,
      odd: parseNumber(market.cote, 0),
    });
  }

  for (const [, bucket] of handicapBuckets) {
    if (bucket.length < 2) continue;
    const sorted = bucket
      .map((market) => ({
        market,
        odd: parseNumber(market.cote, 0),
        code: market?.code || {},
      }))
      .filter((item) => item.odd > 0)
      .sort((a, b) => a.odd - b.odd);
    if (!sorted.length) continue;

    const best = sorted[0];
    const line = Number(best.code.line);
    const key = best.code.t === 7 ? (line <= 0.5 ? "hcap_eq1_minus05" : "hcap_eq1_minus15") : line <= 0.5 ? "hcap_eq2_minus05" : "hcap_eq2_minus15";
    const favori = best.code.t === 7 ? "eq1_gagne" : "eq2_gagne";
    records.push({
      key,
      favori,
      weight: calculPoids(best.odd),
      label: normalizeText(best.market.nom || ""),
      odd: best.odd,
    });
  }

  if (exactScores.length) {
    const sortedExact = exactScores.sort((a, b) => a.odd - b.odd).slice(0, 12);
    for (const item of sortedExact) {
      records.push({
        key: "score_exact",
        favori: item.score,
        weight: calculPoids(item.odd),
        label: item.label,
        odd: item.odd,
      });
    }
  }

  return records;
}

function buildExactScoreConvergence({
  bettingMarkets = [],
  prediction = null,
  league = "",
  leagueProfile = null,
  bias = null,
  homeTeam = "",
  awayTeam = "",
} = {}) {
  const profile = leagueProfile || getLeagueProfile(league);
  if (profile?.exactScoreAllowed === false) return null;

  const records = buildMarketRecords(bettingMarkets).filter((market) => market.weight > 0);
  if (!records.length) return null;

  const activeWeight = records.reduce((sum, market) => sum + market.weight, 0) || 1;
  const marketCount = records.length;
  const biasFromPrediction = bias || buildExactScoreBias(prediction || {}, homeTeam, awayTeam);

  const ranked = SCORES.map((score) => {
    let votesPour = 0;
    let votesContre = 0;
    let scorePondere = 0;
    const detail = [];

    for (const market of records) {
      const vote = scoreCompatibility(score, market.key, market.favori);
      if (vote === 1) {
        votesPour += 1;
        const profileMultiplier = profile ? clamp(1 + scoreMarketAgainstProfile(profile, market.label) * 0.01, 0.82, 1.18) : 1;
        const weighted = market.weight * profileMultiplier;
        scorePondere += weighted;
        detail.push({ marche: market.label, favori: market.favori, cote: market.odd, vote: "coherent", poids: weighted });
      } else if (vote === -1) {
        votesContre += 1;
        const profileMultiplier = profile ? clamp(1 + scoreMarketAgainstProfile(profile, market.label) * 0.005, 0.88, 1.12) : 1;
        const weighted = market.weight * profileMultiplier;
        scorePondere -= weighted;
        detail.push({ marche: market.label, favori: market.favori, cote: market.odd, vote: "contradictoire", poids: weighted });
      }
    }

    const aligned = exactScoreMatchesBias(score.score, biasFromPrediction);
    const alignmentBonus = biasFromPrediction ? activeWeight * (aligned ? 0.08 : -0.03) : 0;
    scorePondere += alignmentBonus;

    return {
      score: score.score,
      g1: score.g1,
      g2: score.g2,
      total: score.total,
      votes_pour: votesPour,
      votes_contre: votesContre,
      ecart: votesPour - votesContre,
      score_pondere: Number(scorePondere.toFixed(6)),
      detail,
      aligned,
    };
  });

  ranked.sort((a, b) => {
    if (a.aligned !== b.aligned) return a.aligned ? -1 : 1;
    if (b.score_pondere !== a.score_pondere) return b.score_pondere - a.score_pondere;
    if (b.votes_pour !== a.votes_pour) return b.votes_pour - a.votes_pour;
    return a.votes_contre - b.votes_contre;
  });

  const probabilities = softmax(
    ranked.map((item) => item.score_pondere),
    biasFromPrediction ? 0.85 : 1.05
  );
  const rankedWithProbability = ranked.map((item, index) => ({
    ...item,
    probability: Number((probabilities[index] || 0).toFixed(6)),
  }));

  const top = rankedWithProbability[0];
  const confidence = clamp(Math.round((top?.probability || 0) * 100), 0, 100);
  const topSlice = rankedWithProbability.slice(0, 5);
  const scoreWeightSum = topSlice.reduce((sum, item) => sum + (item.probability || 0), 0) || 1;
  const homeLambda = topSlice.reduce((sum, item) => sum + item.g1 * (item.probability || 0), 0) / scoreWeightSum;
  const awayLambda = topSlice.reduce((sum, item) => sum + item.g2 * (item.probability || 0), 0) / scoreWeightSum;
  const totalGoals = homeLambda + awayLambda;

  const fitScore = clamp(Math.round(50 + (top?.score_pondere || 0) * 18 + (biasFromPrediction ? 6 : 0)), 18, 96);
  const marketSupport = clamp(Math.round((top?.votes_pour || 0) / Math.max(marketCount, 1) * 100), 0, 100);
  const reliability = clamp(Math.round(confidence * 0.55 + marketSupport * 0.25 + fitScore * 0.2), 20, 95);
  const overLines = [0.5, 1.5, 2.5, 3.5, 4.5].map((line) => ({
    line,
    prob: Number(rankedWithProbability.reduce((sum, item) => sum + (item.total > line ? item.probability || 0 : 0), 0).toFixed(6)),
  }));
  const bttsProb = Number(
    (
      rankedWithProbability.reduce((sum, item) => sum + (item.g1 > 0 && item.g2 > 0 ? item.probability || 0 : 0), 0)
    ).toFixed(6)
  );

  return {
    ranked: rankedWithProbability,
    primary: rankedWithProbability[0],
    alternatives: rankedWithProbability.slice(1, 4),
    reliability,
    fitScore,
    marketSupport,
    totalGoals: Number(totalGoals.toFixed(3)),
    homeLambda: Number(homeLambda.toFixed(3)),
    awayLambda: Number(awayLambda.toFixed(3)),
    overLines,
    bttsProb: Number.isFinite(bttsProb) ? Number(bttsProb.toFixed(6)) : null,
    activeMarketCount: marketCount,
    activeMarketWeight: Number(activeWeight.toFixed(6)),
    bias: biasFromPrediction,
    method: "convergence-v2",
  };
}

module.exports = {
  SCORES,
  buildExactScoreConvergence,
  buildExactScoreBias,
  inferBiasFromRecommendation,
  exactScoreMatchesBias,
};
