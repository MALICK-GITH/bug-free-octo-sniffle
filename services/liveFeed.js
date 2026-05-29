const API_URL =
  "https://1xbet.com/service-api/LiveFeed/Get1x2_VZip?sports=85&count=200&lng=fr&gr=285&mode=4&country=96&getEmpty=true&virtualSports=true&noFilterBlockEvent=true";
const { genererPredictionUnifiee, detectBetType } = require("./unifiedPrediction");
const { evaluateMatch } = require("./extraPowerFilter");
const { getLeagueProfile, getLeagueProfileSummary, scoreMarketAgainstProfile, weightExactScoreProbability } = require("./leagueProfiles");
const { buildExactScoreConvergence, buildExactScoreBias, exactScoreMatchesBias } = require("./exactScoreConvergence");
const { normalizeExactScoreSignal, buildExactScoreAttachment } = require("../public/exactScoreSignal");
const { predictionEngine } = require("./prediction");
const { analyserMatchMultiBots } = require("./bots");
const { getHistoricalRecommendation } = require("./historical");
const { getPenaltyTournaments } = require("./tournaments");
const { predictFromTrainedModel } = require("./trainedModelPredictor");

const PENALTY_KEYWORDS = [
  "penalty",
  "penalties",
  "tir au but",
  "tirs au but",
  "shootout",
  "penaltis",
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toMatchText(event) {
  return normalizeText(
    [
      event.L,
      event.LE,
      event.LR,
      event.N,
      event.O1,
      event.O2,
      event.TN,
      event.SN,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isPenaltyEvent(event) {
  const text = toMatchText(event);
  return PENALTY_KEYWORDS.some((word) => text.includes(normalizeText(word)));
}

function extractOneXTwo(event) {
  const source = Array.isArray(event.E) ? event.E : [];
  const oneXTwo = source.filter((item) => Number(item.G) === 1);
  const pick = (type) => {
    const outcome = oneXTwo.find((item) => Number(item.T) === type);
    return outcome?.C ?? null;
  };
  return {
    home: pick(1),
    draw: pick(2),
    away: pick(3),
  };
}

function toLogoProxyUrl(fileName) {
  const clean = String(fileName || "").trim();
  if (!clean) return null;
  return `/api/logo/${encodeURIComponent(clean)}`;
}

function toTeamBadgeUrl(teamName) {
  const clean = String(teamName || "").trim();
  return `/api/team-badge?name=${encodeURIComponent(clean || "Equipe")}`;
}

function toTeamCdnLogoUrl(teamId) {
  const id = Number(teamId);
  return Number.isFinite(id) && id > 1 ? `https://1xbet.com/sfiles/logo_teams/${id}.png` : null;
}

function parseScoreContext(event) {
  const fs = event?.SC?.FS || {};
  const score1 = Number(fs.S1 ?? fs.H ?? fs.Home ?? fs.SA ?? 0) || 0;
  const score2 = Number(fs.S2 ?? fs.A ?? fs.Away ?? fs.SB ?? 0) || 0;

  let minute = 0;
  const cps = String(event?.SC?.CPS || "");
  const matchMinute = cps.match(/^(\d{1,2})/);
  if (matchMinute) {
    minute = Number(matchMinute[1]) || 0;
  }

  return { score1, score2, minute };
}

function formatLine(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function translateBetOption(g, t, line, event) {
  const home = event.O1 || "Equipe 1";
  const away = event.O2 || "Equipe 2";
  const p = formatLine(line);

  if (g === 1) {
    if (t === 1) return `1 - Victoire ${home}`;
    if (t === 2) return "X - Match nul";
    if (t === 3) return `2 - Victoire ${away}`;
  }

  if (g === 8) {
    if (t === 4) return `1X - ${home} ou nul`;
    if (t === 5) return "12 - Pas de match nul";
    if (t === 6) return `X2 - ${away} ou nul`;
  }

  if (g === 2) {
    if (t === 7) return `Handicap ${home} (${p || "0"})`;
    if (t === 8) return `Handicap ${away} (${p || "0"})`;
  }

  if (g === 17) {
    if (t === 9) return `Plus de ${p || "?"} buts`;
    if (t === 10) return `Moins de ${p || "?"} buts`;
  }

  if (g === 15) {
    if (t === 11) return `Total ${home} - Plus de ${p || "?"}`;
    if (t === 12) return `Total ${home} - Moins de ${p || "?"}`;
  }

  if (g === 62) {
    if (t === 13) return `Total ${away} - Plus de ${p || "?"}`;
    if (t === 14) return `Total ${away} - Moins de ${p || "?"}`;
  }

  if (g === 19) {
    if (t === 180) return "Total Pair/Impair - Pair";
    if (t === 181) return "Total Pair/Impair - Impair";
  }

  return `Marche ${g}/${t}${p ? ` (${p})` : ""}`;
}

function extractAllBets(event) {
  const direct = Array.isArray(event?.E) ? event.E : [];
  const alternativeGroups = Array.isArray(event?.AE) ? event.AE : [];
  const alternative = alternativeGroups.flatMap((group) => (Array.isArray(group?.ME) ? group.ME : []));
  const all = [...direct, ...alternative];
  const map = new Map();

  for (const row of all) {
    const g = Number(row?.G);
    const t = Number(row?.T);
    const line = Number(row?.P);
    const cote = Number(row?.C);
    if (!Number.isFinite(cote) || cote <= 1) continue;
    const key = `${g}-${t}-${Number.isFinite(line) ? line : "na"}-${cote}`;
    if (map.has(key)) continue;
    const nom = translateBetOption(g, t, line, event);
    map.set(key, {
      key,
      nom,
      cote,
      code: { g, t, line: Number.isFinite(line) ? line : null },
      type: detectBetType(nom),
    });
  }

  return [...map.values()];
}

function normalizeMarketLabel(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toFairProbability(odd) {
  const n = Number(odd);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

function normalizeBinaryFairProbability(yesOdd, noOdd, fallback = null) {
  const py = toFairProbability(yesOdd);
  const pn = toFairProbability(noOdd);
  if (!(py > 0 && pn > 0)) return fallback;
  const sum = py + pn;
  return py / sum;
}

function extractLineNumber(label) {
  const match = String(label || "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function collectMarketSignals(markets = []) {
  const overLines = [];
  const underByLine = new Map();
  const overByLine = new Map();
  let bttsYes = null;
  let bttsNo = null;

  for (const market of markets) {
    const label = normalizeMarketLabel(market?.nom);
    const odd = Number(market?.cote);
    if (!(odd > 1)) continue;

    const line = extractLineNumber(label);
    const isOver = label.includes("plus de") || label.includes("over ");
    const isUnder = label.includes("moins de") || label.includes("under ");
    const isBttsYes =
      label.includes("les deux equipes marquent oui") ||
      label.includes("both teams to score yes") ||
      label.includes("btts yes");
    const isBttsNo =
      label.includes("les deux equipes marquent non") ||
      label.includes("both teams to score no") ||
      label.includes("btts no");

    if (isBttsYes) bttsYes = odd;
    if (isBttsNo) bttsNo = odd;
    if (line == null) continue;
    if (isOver) overByLine.set(line, odd);
    if (isUnder) underByLine.set(line, odd);
  }

  const allLines = [...new Set([...overByLine.keys(), ...underByLine.keys()])].sort((a, b) => a - b);
  for (const line of allLines) {
    const overOdd = overByLine.get(line);
    const underOdd = underByLine.get(line);
    const fairProb = normalizeBinaryFairProbability(overOdd, underOdd);
    if (fairProb != null) {
      overLines.push({ line, prob: fairProb, overOdd: Number(overOdd || 0), underOdd: Number(underOdd || 0) });
    }
  }

  return {
    overLines,
    bttsProb: normalizeBinaryFairProbability(bttsYes, bttsNo),
    bttsYesOdd: bttsYes,
    bttsNoOdd: bttsNo,
  };
}

function impliedProbabilitiesFromOdds(odds1x2 = {}) {
  const home = Number(odds1x2?.home);
  const draw = Number(odds1x2?.draw);
  const away = Number(odds1x2?.away);
  if (!(home > 0 && draw > 0 && away > 0)) {
    return { home: 33.3, draw: 33.3, away: 33.4 };
  }
  const ph = 1 / home;
  const pd = 1 / draw;
  const pa = 1 / away;
  const sum = ph + pd + pa || 1;
  return {
    home: (ph / sum) * 100,
    draw: (pd / sum) * 100,
    away: (pa / sum) * 100,
  };
}

function poissonPmf(lambda, k) {
  if (!(lambda >= 0) || k < 0) return 0;
  let acc = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) acc *= lambda / i;
  return acc;
}

function buildPoissonTable(lambda, maxGoals = 8) {
  const values = [];
  let sum = 0;
  for (let goals = 0; goals < maxGoals; goals += 1) {
    const p = poissonPmf(lambda, goals);
    values.push(p);
    sum += p;
  }
  values.push(Math.max(0, 1 - sum));
  return values;
}

function computeScoreMatrix(homeLambda, awayLambda, maxGoals = 8) {
  const homeTable = buildPoissonTable(homeLambda, maxGoals);
  const awayTable = buildPoissonTable(awayLambda, maxGoals);
  const matrix = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;

  for (let h = 0; h < homeTable.length; h += 1) {
    for (let a = 0; a < awayTable.length; a += 1) {
      const probability = homeTable[h] * awayTable[a];
      matrix.push({ home: h, away: a, probability });
      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;
      if (h > 0 && a > 0) btts += probability;
    }
  }

  matrix.sort((left, right) => right.probability - left.probability);
  return { matrix, homeWin, draw, awayWin, btts, totalLambda: homeLambda + awayLambda };
}

function probabilityOverLine(matrix, line) {
  const threshold = Math.floor(Number(line) || 0) + 1;
  return matrix.reduce((acc, item) => acc + (item.home + item.away >= threshold ? item.probability : 0), 0);
}

function evaluateScoreLoss(homeLambda, awayLambda, target, signals) {
  const model = computeScoreMatrix(homeLambda, awayLambda);
  let loss =
    Math.pow(model.homeWin - target.home, 2) * 2.4 +
    Math.pow(model.draw - target.draw, 2) * 2.2 +
    Math.pow(model.awayWin - target.away, 2) * 2.4;

  for (const line of signals.overLines) {
    const predicted = probabilityOverLine(model.matrix, line.line);
    loss += Math.pow(predicted - line.prob, 2) * (line.line === 2.5 ? 2.3 : 1.5);
  }

  if (signals.bttsProb != null) {
    loss += Math.pow(model.btts - signals.bttsProb, 2) * 2;
  }

  return { loss, model };
}

function findBestExactScoreModel(match, markets = []) {
  const target = impliedProbabilitiesFromOdds(match?.odds1x2 || {});
  const fairTarget = {
    home: target.home / 100,
    draw: target.draw / 100,
    away: target.away / 100,
  };
  const signals = collectMarketSignals(markets);
  let best = null;

  for (let homeLambda = 0.4; homeLambda <= 4.6; homeLambda += 0.16) {
    for (let awayLambda = 0.3; awayLambda <= 4.2; awayLambda += 0.16) {
      const candidate = evaluateScoreLoss(homeLambda, awayLambda, fairTarget, signals);
      if (!best || candidate.loss < best.loss) {
        best = { ...candidate, homeLambda, awayLambda };
      }
    }
  }

  if (!best) return null;

  let refined = best;
  for (let homeLambda = Math.max(0.2, best.homeLambda - 0.25); homeLambda <= best.homeLambda + 0.25; homeLambda += 0.04) {
    for (let awayLambda = Math.max(0.2, best.awayLambda - 0.25); awayLambda <= best.awayLambda + 0.25; awayLambda += 0.04) {
      const candidate = evaluateScoreLoss(homeLambda, awayLambda, fairTarget, signals);
      if (candidate.loss < refined.loss) {
        refined = { ...candidate, homeLambda, awayLambda };
      }
    }
  }

  return { ...refined, signals, fairTarget };
}

function buildExactScoreProjection(match, bettingMarkets = [], prediction = null) {
  const leagueProfile = getLeagueProfile(match?.league);
  if (leagueProfile?.exactScoreAllowed === false) {
    return null;
  }

  const projection = findBestExactScoreModel(match, bettingMarkets);
  const bias = buildExactScoreBias(prediction || {});
  const convergence = buildExactScoreConvergence({
    bettingMarkets,
    prediction,
    league: match?.league,
    leagueProfile,
    bias,
  });
  if (!projection && !convergence) return null;

  const context = match?.context && typeof match.context === "object" ? match.context : {};
  const minute = Number(context.minute || 0);
  const currentHome = Number(context.score1 || 0);
  const currentAway = Number(context.score2 || 0);
  const remainingFactor = minute > 0 ? clamp((90 - minute) / 90, 0.25, 1) : 1;
  const homeLambda = projection
    ? currentHome + projection.homeLambda * remainingFactor
    : convergence?.homeLambda != null
      ? currentHome + convergence.homeLambda * remainingFactor
      : currentHome;
  const awayLambda = projection
    ? currentAway + projection.awayLambda * remainingFactor
    : convergence?.awayLambda != null
      ? currentAway + convergence.awayLambda * remainingFactor
      : currentAway;
  const finalModel = computeScoreMatrix(homeLambda, awayLambda);

  const weightedScores = finalModel.matrix
    .map((item) => ({
      home: item.home,
      away: item.away,
      probability: weightExactScoreProbability(leagueProfile, item.home + item.away, item.probability),
    }))
    .filter((item) => Number.isFinite(item.probability) && item.probability >= 0);
  const fallbackTopScores = weightedScores
    .map((item) => ({
      score: `${item.home}-${item.away}`,
      probability: item.probability,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 4);
  const convergenceTopScores = convergence?.ranked?.length
    ? convergence.ranked.map((item) => ({
        score: item.score,
        probability: Number(item.probability || 0),
        votes_pour: item.votes_pour,
        votes_contre: item.votes_contre,
        ecart: item.ecart,
        score_pondere: item.score_pondere,
        detail: item.detail,
        aligned: item.aligned,
      }))
    : null;
  const sourceScores = convergenceTopScores || fallbackTopScores;
  const sourceTotal = sourceScores.reduce((sum, item) => sum + Math.max(Number(item.probability) || 0, 0), 0) || 1;
  const topScores = sourceScores
    .map((item) => ({
      ...item,
      probability: Math.max(Number(item.probability) || 0, 0) / sourceTotal,
    }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 4);
  const primary = topScores[0];
  const alternatives = topScores.slice(1, 4);
  const confidenceBase = Number(prediction?.maitre?.decision_finale?.confiance_numerique || 60);
  const marketSupport = convergence?.marketSupport != null
    ? convergence.marketSupport
    : clamp(
        Math.min(100, (projection?.signals?.overLines?.length || 0) * 18 + (projection?.signals?.bttsProb != null ? 18 : 0) + 36) +
          Math.max(-12, Math.min(12, scoreMarketAgainstProfile(leagueProfile, "score exact"))),
        0,
        100
      );
  const fitScore = convergence?.fitScore != null ? convergence.fitScore : clamp(Math.round(100 - (projection?.loss || 0) * 260), 18, 96);
  const reliability = convergence?.reliability != null
    ? convergence.reliability
    : clamp(
        Math.round(fitScore * 0.44 + confidenceBase * 0.34 + marketSupport * 0.22 + Number(leagueProfile?.reliabilityBoost || 0)),
        20,
        95
      );
  const totalGoals = convergence?.totalGoals != null ? convergence.totalGoals : homeLambda + awayLambda;
  const intensity =
    totalGoals >= 4.2 ? "match tres ouvert" : totalGoals >= 3 ? "match ouvert" : totalGoals >= 2.2 ? "match equilibre" : "match ferme";
  const edge =
    homeLambda - awayLambda >= 0.45
      ? "avantage domicile"
      : awayLambda - homeLambda >= 0.45
        ? "avantage exterieur"
        : "equilibre entre les deux equipes";
  const hasConvergence = Boolean(convergence?.ranked?.length);
  const hasBias = Boolean(bias);
  const primaryAligned = hasConvergence && convergence?.ranked?.[0]?.aligned != null ? Boolean(convergence.ranked[0].aligned) : null;
  const signalMeta = normalizeExactScoreSignal(
    {
      primary,
      alternatives,
      reliability,
      fitScore,
      marketSupport,
      totalGoals,
      homeLambda,
      awayLambda,
      overLines: convergence?.overLines || projection?.signals?.overLines || [],
      bttsProb: convergence?.bttsProb != null ? convergence.bttsProb : projection?.signals?.bttsProb ?? null,
      method: convergence ? convergence.method : "poisson-odds-market-v1",
      coherence: {
        badgeTone: hasConvergence ? (hasBias ? (primaryAligned === false ? "watch" : "good") : "neutral") : "neutral",
        recommendation: String(
          prediction?.maitre?.decision_finale?.pari_choisi || prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari || ""
        ),
      },
      provenance: {
        source: hasConvergence ? "convergence" : "poisson",
        usedConvergence: hasConvergence,
        hasBias: hasConvergence && hasBias,
        aligned: hasConvergence ? primaryAligned : null,
        method: convergence ? convergence.method : "poisson-odds-market-v1",
      },
    },
    { bias, hasConvergence, hasBias: hasConvergence && hasBias, aligned: hasConvergence ? primaryAligned : null }
  );
  const coherenceTone = hasConvergence ? (hasBias ? (primaryAligned ? "good" : "watch") : "neutral") : "neutral";
  const coherenceLabel = !hasConvergence
    ? "Score modele"
    : hasBias
      ? primaryAligned
        ? "Aligne avec la reco"
        : "Reco en divergence"
      : "Convergence active";
  const biasNote = !hasConvergence
    ? "Projection issue du modele fallback."
    : hasBias
      ? primaryAligned
        ? "Convergence active et bias de recommandation aligne."
        : "Convergence active mais bias de recommandation en divergence."
      : "Projection issue du moteur de convergence sans biais de recommandation.";
  const exactScore = buildExactScoreAttachment(
    {
      primary,
      alternatives,
      reliability,
      fitScore,
      marketSupport,
      totalGoals,
      homeLambda,
      awayLambda,
      overLines: convergence?.overLines || projection?.signals?.overLines || [],
      bttsProb: convergence?.bttsProb != null ? convergence.bttsProb : projection?.signals?.bttsProb ?? null,
      method: convergence ? convergence.method : "poisson-odds-market-v1",
      coherence: {
        badgeTone: coherenceTone,
        badgeLabel: coherenceLabel,
        reason: biasNote,
        recommendation: String(
          prediction?.maitre?.decision_finale?.pari_choisi || prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari || ""
        ),
      },
      provenance: signalMeta.provenance,
    },
    { bias, hasConvergence, hasBias, aligned: primaryAligned }
  );

  return {
    ...exactScore,
    predictions: topScores,
    signal: signalMeta.signal,
    normalizedSignal: signalMeta.normalized,
    leagueProfile: getLeagueProfileSummary(leagueProfile),
    narrative: `${intensity}, ${edge}. ${biasNote} Projection issue d'un moteur ${hasConvergence ? "de convergence" : "fallback"}${(convergence?.overLines || projection?.signals?.overLines || []).length ? " multi-marches" : ""}${(convergence?.bttsProb != null ? convergence.bttsProb : projection?.signals?.bttsProb) != null ? " + BTTS" : ""}.`,
  };
}

function simplifyEvent(event) {
  const context = parseScoreContext(event);
  const homeLogoFile = Array.isArray(event?.O1IMG) ? event.O1IMG[0] : null;
  const awayLogoFile = Array.isArray(event?.O2IMG) ? event.O2IMG[0] : null;
  const homeCdnLogo = toTeamCdnLogoUrl(event?.O1I);
  const awayCdnLogo = toTeamCdnLogoUrl(event?.O2I);
  const homeBadge = toTeamBadgeUrl(event.O1 || "Equipe 1");
  const awayBadge = toTeamBadgeUrl(event.O2 || "Equipe 2");
  const homeProxy = toLogoProxyUrl(homeLogoFile);
  const awayProxy = toLogoProxyUrl(awayLogoFile);
  return {
    id: event.I,
    teamHome: event.O1 || "Equipe 1",
    teamAway: event.O2 || "Equipe 2",
    teamHomeLogo: homeCdnLogo || homeProxy || homeBadge,
    teamAwayLogo: awayCdnLogo || awayProxy || awayBadge,
    teamHomeLogoFallback: homeBadge,
    teamAwayLogoFallback: awayBadge,
    teamHomeLogoCdn: homeCdnLogo,
    teamAwayLogoCdn: awayCdnLogo,
    teamHomeLogoFile: homeLogoFile || null,
    teamAwayLogoFile: awayLogoFile || null,
    league: event.L || event.LE || "Competition virtuelle",
    startTimeUnix: Number(event.S) || null,
    sportId: Number(event.SI) || null,
    statusText: event.SC?.SLS || event.SC?.I || "En attente",
    infoText: event.SC?.I || "",
    statusCode: Number(event.SC?.GS) || null,
    phase: event.SC?.CPS || "",
    score: event.SC?.FS || {},
    context,
    odds1x2: extractOneXTwo(event),
    betsCount: extractAllBets(event).length,
  };
}

function impliedOneXTwoPercents(odds = {}) {
  const h = Number(odds?.home);
  const d = Number(odds?.draw);
  const a = Number(odds?.away);
  if (![h, d, a].every((x) => Number.isFinite(x) && x > 1)) {
    return { home: 0, draw: 0, away: 0 };
  }
  const ih = 1 / h;
  const id = 1 / d;
  const ia = 1 / a;
  const sum = ih + id + ia || 1;
  return {
    home: (ih / sum) * 100,
    draw: (id / sum) * 100,
    away: (ia / sum) * 100,
  };
}

function parseConsensusBots(prediction) {
  const raw = String(prediction?.maitre?.analyse_bots?.consensus || "");
  const match = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return 0;
  return Number(match[1]) || 0;
}

function inferPickSide(pari, teamHome, teamAway) {
  const p = normalizeText(pari || "");
  const home = normalizeText(teamHome || "");
  const away = normalizeText(teamAway || "");
  if (away && p.includes(away)) return "AWAY";
  if (home && p.includes(home)) return "HOME";
  if (p.startsWith("2 ") || p.includes(" victoire ") || p.includes("x2")) return "AWAY";
  if (p.startsWith("1 ") || p.includes("1x")) return "HOME";
  return "HOME";
}

function syntheticFluxSeries(base, momentum, swings = [0, 2, 4, 6, 4, 2, 0, -1, 1, 2]) {
  return swings.map((s, i) => clamp(base + momentum * (i / (swings.length - 1)) + s, 0, 100));
}

function buildExtraFilterInput(details, pickedPari) {
  const action = String(details?.prediction?.maitre?.decision_finale?.action || "");
  const confidence = Number(details?.prediction?.maitre?.decision_finale?.confiance_numerique || 0);
  const consensusBots = parseConsensusBots(details?.prediction);
  const implied = impliedOneXTwoPercents(details?.match?.odds1x2 || {});
  const ctx = details?.match?.context || {};
  const s1 = Number(ctx.score1 || 0);
  const s2 = Number(ctx.score2 || 0);
  const minute = Number(ctx.minute || 0);

  const homeMomentum = clamp((s1 - s2) * 3 + (minute > 45 ? 2 : 0), -12, 12);
  const awayMomentum = clamp((s2 - s1) * 3 + (minute > 45 ? 2 : 0), -12, 12);
  const drawBase = clamp(implied.draw - Math.abs(s1 - s2) * 2 - (minute > 70 ? 4 : 0), 3, 45);

  return {
    confidence,
    consensusBots,
    winHome: Number(implied.home.toFixed(1)),
    winAway: Number(implied.away.toFixed(1)),
    action,
    pickSide: inferPickSide(pickedPari, details?.match?.teamHome, details?.match?.teamAway),
    homeFlux: syntheticFluxSeries(implied.home, homeMomentum),
    awayFlux: syntheticFluxSeries(implied.away, awayMomentum),
    zoneNull: syntheticFluxSeries(drawBase, -Math.abs(homeMomentum - awayMomentum) / 2, [0, 1, 1, 0, -1, -2, -1, 0, 1, 0]),
  };
}

function isStrictUpcomingEvent(event, nowSec) {
  const start = Number(event?.S);
  if (!Number.isFinite(start) || start <= nowSec) return false;

  const gs = Number(event?.SC?.GS);
  const info = normalizeText(event?.SC?.I || "");
  const sls = normalizeText(event?.SC?.SLS || "");
  const cps = normalizeText(event?.SC?.CPS || "");

  const preByCode = gs === 128;
  const preByInfo = info.includes("avant le debut") || info.includes("avant le debut du jeu");
  const preBySls = sls.includes("debut dans");
  const inPlayMarkers =
    cps.includes("mi-temps") ||
    cps.includes("1ere mi-temps") ||
    cps.includes("2eme mi-temps") ||
    cps.includes("jeu termine") ||
    info.includes("match termine");

  if (inPlayMarkers) return false;
  return preByCode || preByInfo || preBySls;
}

function schemaOf(value, depth = 2) {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      sample: value.length > 0 ? schemaOf(value[0], depth - 1) : null,
    };
  }
  if (typeof value !== "object") return { type: typeof value };
  if (depth <= 0) return { type: "object" };
  const entries = {};
  for (const key of Object.keys(value).slice(0, 50)) {
    entries[key] = schemaOf(value[key], depth - 1);
  }
  return {
    type: "object",
    keys: Object.keys(value),
    props: entries,
  };
}

async function fetchLiveFeedRaw() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(API_URL, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getPenaltyMatches() {
  const payload = await fetchLiveFeedRaw();
  const events = Array.isArray(payload?.Value) ? payload.Value : [];
  const sportEvents = events.filter((event) => Number(event?.SI) === 85);
  
  // Debug: Log all league names from sport 85
  console.log('[DEBUG] Total sport 85 events:', sportEvents.length);
  const leagues = [...new Set(sportEvents.map(e => e.L || e.LE || 'Unknown'))];
  console.log('[DEBUG] Leagues found:', leagues);
  
  const penaltyOnly = sportEvents.filter(isPenaltyEvent);
  console.log('[DEBUG] Penalty events found:', penaltyOnly.length);
  if (penaltyOnly.length > 0) {
    console.log('[DEBUG] Penalty event leagues:', [...new Set(penaltyOnly.map(e => e.L || e.LE))]);
  }
  
  // Combiner les deux sources: penalty + non-penalty
  // Limiter à un mélange équilibré
  const nonPenalty = sportEvents.filter(e => !isPenaltyEvent(e));
  const maxPenalty = Math.min(penaltyOnly.length, 50);
  const maxNonPenalty = Math.min(nonPenalty.length, 50);
  
  // Debug: Log status codes for penalty vs non-penalty
  console.log('[DEBUG] Penalty status codes:', penaltyOnly.slice(0, 5).map(e => ({
    league: e.L || e.LE,
    statusCode: e.SC?.GS,
    statusText: e.SC?.SLS,
    phase: e.SC?.CPS
  })));
  console.log('[DEBUG] Non-penalty status codes:', nonPenalty.slice(0, 5).map(e => ({
    league: e.L || e.LE,
    statusCode: e.SC?.GS,
    statusText: e.SC?.SLS,
    phase: e.SC?.CPS
  })));
  
  const selected = [
    ...nonPenalty.slice(0, maxNonPenalty),
    ...penaltyOnly.slice(0, maxPenalty)
  ];
  
  const filterMode = "mixed-penalty-regular";

  return {
    fetchedAt: new Date().toISOString(),
    totalFromApi: events.length,
    totalSport85: sportEvents.length,
    totalPenalty: penaltyOnly.length,
    filterMode,
    matches: selected.map(simplifyEvent),
  };
}

async function getMatchPredictionDetails(matchId) {
  const payload = await fetchLiveFeedRaw();
  const events = Array.isArray(payload?.Value) ? payload.Value : [];
  const found = events.find((event) => String(event?.I) === String(matchId));
  if (!found) {
    throw new Error("Match introuvable dans le flux actuel.");
  }
  const details = buildMatchPredictionDetails(found);
  const pickedPari = details?.prediction?.maitre?.decision_finale?.pari_choisi || "";
  const evalInput = buildExtraFilterInput(details, pickedPari);
  const extraFilter = evaluateMatch(evalInput, { totalMatches: events.length }, { minMatches: 50 });
  return {
    ...details,
    extraPowerFilter: extraFilter,
  };
}

function buildMatchPredictionDetails(event) {
  const match = simplifyEvent(event);
  const bets = extractAllBets(event);
  const leagueProfile = getLeagueProfile(match.league);
  const prediction = genererPredictionUnifiee({
    team1: match.teamHome,
    team2: match.teamAway,
    league: match.league,
    context: match.context,
    bets,
  });
  const exactScoreProjection = buildExactScoreProjection(match, bets, prediction);
  const exactScore = buildExactScoreAttachment(exactScoreProjection, {
    bias: buildExactScoreBias(prediction || {}),
    hasConvergence: Boolean(exactScoreProjection?.method && exactScoreProjection.method !== "poisson-odds-market-v1"),
  });
  const trainedModelPrediction = predictFromTrainedModel({
    teamHome: match.teamHome,
    teamAway: match.teamAway,
    league: match.league,
  });
  if (trainedModelPrediction?.available) {
    applyTrainedModelFusion(prediction, bets, trainedModelPrediction);
  }

  return {
    match,
    bettingMarkets: bets,
    prediction,
    trainedModelPrediction,
    exactScore,
    exactScoreAvailable: Boolean(exactScore),
    leagueProfile: getLeagueProfileSummary(leagueProfile),
  };
}

function applyTrainedModelFusion(prediction = {}, bets = [], trained = {}) {
  const master = prediction?.maitre?.decision_finale || {};
  const outcome = String(trained?.recommendation || "").toLowerCase();
  const market = pickOutcomeMarketFromBets(bets, outcome);
  if (!market) return;

  const baseConfidence = Number(master?.confiance_numerique || master?.confidence || 0);
  const trainedConfidence = Number(trained?.confidence || 0);
  const fusedConfidence = clamp(Math.max(baseConfidence * 0.7 + trainedConfidence * 0.6, trainedConfidence), 0, 99);

  const fusedDecision = {
    ...master,
    pari_choisi: market.nom,
    cote: Number(market.cote || master?.cote || 0),
    confidence: Number(fusedConfidence.toFixed(1)),
    confiance_numerique: Number(fusedConfidence.toFixed(1)),
    action: fusedConfidence >= 62 ? "MISE RECOMMANDEE" : (master?.action || "SURVEILLER"),
    recommandation: `FUSION MODELE ENTRAINE + MAITRE (${outcome.toUpperCase() || "N/A"})`,
    moteur: "TRAINED-FUSION-1.0",
  };

  prediction.maitre = prediction.maitre || {};
  prediction.maitre.originalDecision = prediction.maitre.originalDecision || master;
  prediction.maitre.decision_finale = fusedDecision;
  prediction.trainedFusion = {
    enabled: true,
    modelSource: trained?.source || "trained-finished-matches-model",
    modelFile: trained?.modelFile || null,
    outcome,
    exactScore: trained?.exactScore || null,
    marketUsed: market.nom,
    confidence: fusedDecision.confiance_numerique,
  };
}

function pickOutcomeMarketFromBets(bets = [], outcome = "") {
  const rows = Array.isArray(bets) ? bets : [];
  const outcomeKey = String(outcome || "").toLowerCase();
  const byOutcomeLabel =
    outcomeKey === "home"
      ? ["1 - victoire", "1 - "]
      : outcomeKey === "away"
        ? ["2 - victoire", "2 - "]
        : ["x - match nul", "x - "];

  const foundDirect = rows.find((m) => {
    const low = normalizeText(m?.nom || "");
    return byOutcomeLabel.some((p) => low.startsWith(normalizeText(p)));
  });
  if (foundDirect) return foundDirect;

  // fallback: double chance markets aligned with trained side
  if (outcomeKey === "home") {
    return rows.find((m) => normalizeText(m?.nom || "").includes("1x")) || null;
  }
  if (outcomeKey === "away") {
    return rows.find((m) => normalizeText(m?.nom || "").includes("x2")) || null;
  }
  return rows.find((m) => normalizeText(m?.nom || "").includes("match nul")) || null;
}

function riskConfig(profile = "balanced") {
  const key = normalizeText(profile);
  if (key === "safe") {
    return { minOdd: 1.2, maxOdd: 1.7, minConfidence: 62, slope: 8 };
  }
  if (key === "aggressive") {
    return { minOdd: 1.55, maxOdd: 3.2, minConfidence: 45, slope: 6 };
  }
  return { minOdd: 1.3, maxOdd: 2.25, minConfidence: 50, slope: 11 };
}

function pickCouponOption(details, profile = "balanced") {
  const cfg = riskConfig(profile);
  const master = details?.prediction?.maitre?.decision_finale || {};
  const consensus = details?.prediction?.decision_consensus || {};
  const consensusPrimary =
    normalizeText(profile) === "safe" && consensus?.alternatives?.prudent
      ? consensus.alternatives.prudent
      : consensus?.primary;
  const top = details?.prediction?.analyse_avancee?.top_3_recommandations || [];
  const marketByName = new Map((details?.bettingMarkets || []).map((m) => [m.nom, m]));
  const leagueProfile = getLeagueProfile(details?.match?.league);
  const exactScore = details?.exactScore || null;
  const exactScoreSignal = Number.isFinite(Number(exactScore?.signal))
    ? Number(exactScore.signal)
    : normalizeExactScoreSignal(exactScore, {
        bias: buildExactScoreBias(details?.prediction || {}),
        hasConvergence: Boolean(exactScore?.provenance?.usedConvergence),
        hasBias: Boolean(exactScore?.provenance?.hasBias),
        aligned: exactScore?.provenance?.aligned,
      }).signal;

  const consensusMarket = consensusPrimary ? marketByName.get(consensusPrimary.pari) : null;
  if (
    consensusMarket &&
    Number.isFinite(Number(consensusPrimary.confidence)) &&
    Number(consensusPrimary.confidence) >= cfg.minConfidence &&
    consensusMarket.cote >= cfg.minOdd &&
    consensusMarket.cote <= cfg.maxOdd
  ) {
    return {
      pari: consensusMarket.nom,
      cote: consensusMarket.cote,
      confiance: clamp(
        Number(consensusPrimary.confidence) +
          scoreMarketAgainstProfile(leagueProfile, consensusMarket.nom) * 0.28 +
          exactScoreSignal,
        0,
        100
      ),
      source: normalizeText(profile) === "safe" && consensus?.alternatives?.prudent ? "CONSENSUS_SAFE" : "CONSENSUS",
      probability: consensusPrimary.probability,
      value: consensusPrimary.value,
      risk: consensusPrimary.risk,
    };
  }

  const masterMarket = marketByName.get(master.pari_choisi);
  if (
    masterMarket &&
    Number.isFinite(master.confiance_numerique) &&
    master.confiance_numerique >= cfg.minConfidence &&
    masterMarket.cote >= cfg.minOdd &&
    masterMarket.cote <= cfg.maxOdd
  ) {
    return {
      pari: masterMarket.nom,
      cote: masterMarket.cote,
      confiance: clamp(
        master.confiance_numerique +
          scoreMarketAgainstProfile(leagueProfile, masterMarket.nom) * 0.35 +
          exactScoreSignal,
        0,
        100
      ),
      source: "MAITRE",
    };
  }

  const bestTop = top
    .filter((x) => Number.isFinite(x?.cote) && x.cote >= cfg.minOdd && x.cote <= cfg.maxOdd)
    .map((entry) => ({
      ...entry,
      score_composite:
        Number(entry.score_composite || 0) +
        scoreMarketAgainstProfile(leagueProfile, entry.pari) * 0.3 +
        exactScoreSignal,
    }))
    .sort((a, b) => b.score_composite - a.score_composite)[0];
  if (bestTop) {
    return {
      pari: bestTop.pari,
      cote: bestTop.cote,
      confiance: clamp(Number(bestTop.score_composite || 50), 0, 100),
      source: "TOP3",
    };
  }

  const fallback = (details?.bettingMarkets || [])
    .filter((m) => m.cote >= cfg.minOdd && m.cote <= cfg.maxOdd)
    .map((market) => ({
      ...market,
      score_profile: scoreMarketAgainstProfile(leagueProfile, market.nom),
    }))
    .sort((a, b) => (b.score_profile || 0) - (a.score_profile || 0) || a.cote - b.cote)[0];
  if (!fallback) return null;
  return {
    pari: fallback.nom,
    cote: fallback.cote,
    confiance: clamp(45 + (fallback.score_profile || 0) * 0.5, 0, 100),
    source: "FALLBACK",
  };
}

function normalizeLeague(value) {
  return normalizeText(String(value || "").trim());
}

async function getCouponSelection(size = 3, league = "all", profile = "balanced", minStartMinutes = 0) {
  const payload = await fetchLiveFeedRaw();
  const nowSec = Math.floor(Date.now() / 1000);
  const events = Array.isArray(payload?.Value) ? payload.Value : [];
  const sportEvents = events.filter((event) => Number(event?.SI) === 85);
  const penaltyOnly = sportEvents.filter(isPenaltyEvent);
  const sourceEvents = penaltyOnly.length > 0 ? penaltyOnly : sportEvents;
  const selectedLeague = normalizeLeague(league);
  const eventsFiltered =
    selectedLeague && selectedLeague !== "all"
      ? sourceEvents.filter((e) => normalizeLeague(e?.L || e?.LE || "") === selectedLeague)
      : sourceEvents;
  const minStartSec = Math.max(0, Number(minStartMinutes) || 0) * 60;
  const upcomingEvents = eventsFiltered.filter((e) => {
    if (!isStrictUpcomingEvent(e, nowSec)) return false;
    const start = Number(e?.S || 0);
    return start > nowSec + minStartSec;
  });

  const allDetails = upcomingEvents.map((event) => buildMatchPredictionDetails(event));
  const cfg = riskConfig(profile);
  const filterMeta = { totalMatches: sourceEvents.length };
  const filterActive = filterMeta.totalMatches >= 50;
  const candidates = allDetails
    .map((details) => {
      const option = pickCouponOption(details, profile);
      if (!option) return null;
      const filterInput = buildExtraFilterInput(details, option.pari);
      const extraFilter = evaluateMatch(filterInput, filterMeta, { minMatches: 50 });
      if (filterActive && !extraFilter.playable) return null;
      const anchor = profile === "safe" ? 1.45 : profile === "aggressive" ? 2.2 : 1.7;
      const leagueProfileScore = scoreMarketAgainstProfile(details?.leagueProfile || getLeagueProfile(details.match.league), option.pari);
      const safetyScore =
        option.confiance -
        Math.abs(option.cote - anchor) * cfg.slope +
        (extraFilter.score || 0) * 0.22 +
        leagueProfileScore * 0.5;
      return {
        matchId: details.match.id,
        teamHome: details.match.teamHome,
        teamAway: details.match.teamAway,
        league: details.match.league,
        startTimeUnix: details.match.startTimeUnix,
        statusText: details.match.statusText || "",
        infoText: details.match.infoText || "",
        statusCode: details.match.statusCode ?? null,
        phase: details.match.phase || "",
        pari: option.pari,
        cote: option.cote,
        confiance: Number(option.confiance.toFixed(1)),
        source: option.source,
        exactScore: details.exactScoreAvailable ? details.exactScore : null,
        exactScoreAvailable: Boolean(details.exactScoreAvailable),
        extraFilter,
        safetyScore: Number(safetyScore.toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.safetyScore - a.safetyScore);

  const wanted = Math.max(1, Math.min(parseInt(String(size), 10) || 3, 12));
  const picks = candidates.slice(0, wanted);
  const combinedOdd =
    picks.length > 0 ? Number(picks.reduce((acc, p) => acc * p.cote, 1).toFixed(3)) : null;
  const avgConfidence =
    picks.length > 0
      ? Number((picks.reduce((acc, p) => acc + p.confiance, 0) / picks.length).toFixed(1))
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    requestedMatches: wanted,
    availableCandidates: candidates.length,
    totalUpcomingMatches: upcomingEvents.length,
    leagueFilter: league || "all",
    riskProfile: profile,
    minStartMinutes: Math.max(0, Number(minStartMinutes) || 0),
    extraFilter: {
      active: filterActive,
      totalMatches: filterMeta.totalMatches,
      minMatches: 50,
      rule: filterActive ? "PLAY uniquement" : "FILTER_LOCKED (<50)",
    },
    coupon: picks,
    summary: {
      totalSelections: picks.length,
      combinedOdd,
      averageConfidence: avgConfidence,
    },
    riskConfig: cfg,
    warning:
      "Aucune combinaison n'est garantie gagnante. Ce coupon est une optimisation algorithmique.",
  };
}

function computeSelectionConfidence(details, selectionPari) {
  const target = String(selectionPari || "");
  const master = details?.prediction?.maitre?.decision_finale || {};
  const leagueProfile = getLeagueProfile(details?.match?.league);
  const exactScore = details?.exactScore || null;
  const exactBias = buildExactScoreBias(details?.prediction || {});
  const exactSignal = Number.isFinite(Number(exactScore?.signal))
    ? Number(exactScore.signal)
    : normalizeExactScoreSignal(exactScore, {
        bias: exactBias,
        hasConvergence: Boolean(exactScore?.provenance?.usedConvergence),
        hasBias: Boolean(exactBias),
        aligned:
          exactScore?.provenance?.aligned ?? (exactScore?.primary?.score ? exactScoreMatchesBias(exactScore.primary.score, exactBias) : null),
      }).signal;
  if (master.pari_choisi === target) {
    return clamp(Number(master.confiance_numerique || 0) + scoreMarketAgainstProfile(leagueProfile, target) * 0.4 + exactSignal, 0, 100);
  }

  let best = 0;
  const bots = Object.values(details?.prediction?.bots || {});
  for (const bot of bots) {
    for (const p of bot?.paris_recommandes || []) {
      if (String(p?.nom || "") === target) {
        best = Math.max(best, Number(p?.confiance || 0));
      }
    }
  }
  return clamp(Number(best || 0) + scoreMarketAgainstProfile(leagueProfile, target) * 0.4 + exactSignal, 0, 100);
}

async function validateCouponTicket(ticket, options = {}) {
  const driftThreshold = Number(options?.driftThresholdPercent) > 0 ? Number(options.driftThresholdPercent) : 6;
  const nowSec = Math.floor(Date.now() / 1000);
  const selections = Array.isArray(ticket?.selections) ? ticket.selections : [];

  if (selections.length === 0) {
    return {
      validatedAt: new Date().toISOString(),
      status: "TICKET_A_CORRIGER",
      summary: { total: 0, ok: 0, toFix: 0 },
      issues: [{ code: "EMPTY_TICKET", message: "Aucune selection fournie." }],
      validatedSelections: [],
    };
  }

  const payload = await fetchLiveFeedRaw();
  const events = Array.isArray(payload?.Value) ? payload.Value : [];
  const eventsById = new Map(events.map((e) => [String(e?.I), e]));
  const validatedSelections = [];
  const issues = [];

  for (const sel of selections) {
    const matchId = String(sel?.matchId || "");
    const event = eventsById.get(matchId);
    if (!event) {
      validatedSelections.push({
        matchId,
        status: "invalid",
        reason: "MATCH_NOT_FOUND",
      });
      issues.push({ code: "MATCH_NOT_FOUND", matchId, message: `Match ${matchId} introuvable.` });
      continue;
    }

    const details = buildMatchPredictionDetails(event);
    const match = details.match;
    const selectedPari = String(sel?.pari || "");
    const selectedOdd = Number(sel?.cote);
    const market = (details.bettingMarkets || []).find((m) => String(m.nom) === selectedPari);
    const currentOdd = market ? Number(market.cote) : null;
    const started = !isStrictUpcomingEvent(event, nowSec);

    let driftPct = null;
    let driftExceeded = false;
    if (Number.isFinite(selectedOdd) && selectedOdd > 0 && Number.isFinite(currentOdd) && currentOdd > 0) {
      driftPct = Number((Math.abs(((currentOdd - selectedOdd) / selectedOdd) * 100)).toFixed(2));
      driftExceeded = driftPct > driftThreshold;
    }

    const confidence = computeSelectionConfidence(details, selectedPari);
    const recommended = pickCouponOption(details);
    const exactBias = buildExactScoreBias(details?.prediction || {});
    const exactScoreAttachment = buildExactScoreAttachment(details.exactScore, {
      bias: exactBias,
      hasConvergence: Boolean(details?.exactScore?.provenance?.usedConvergence),
      hasBias: Boolean(exactBias),
      aligned: details?.exactScore?.provenance?.aligned,
    });
    const shouldReplace =
      started ||
      !market ||
      driftExceeded ||
      confidence < 50;

    const status = shouldReplace ? "replace" : "ok";
    const reasonCodes = [];
    if (started) reasonCodes.push("MATCH_ALREADY_STARTED");
    if (!market) reasonCodes.push("MARKET_UNAVAILABLE");
    if (driftExceeded) reasonCodes.push("ODD_DRIFT");
    if (confidence < 50) reasonCodes.push("LOW_CONFIDENCE");

    const row = {
      matchId,
      teams: `${match.teamHome} vs ${match.teamAway}`,
      league: match.league,
      status,
      selected: {
        pari: selectedPari,
        odd: Number.isFinite(selectedOdd) ? selectedOdd : null,
      },
      current: {
        pari: market?.nom || null,
        odd: Number.isFinite(currentOdd) ? currentOdd : null,
      },
      confidence: Number(confidence.toFixed(1)),
      driftPercent: driftPct,
      reasonCodes,
      recommendation: recommended
        ? {
            pari: recommended.pari,
            odd: recommended.cote,
            confidence: Number(recommended.confiance?.toFixed ? recommended.confiance.toFixed(1) : recommended.confiance),
            source: recommended.source,
            exactScore: recommended.exactScore || exactScoreAttachment,
          }
        : null,
      exactScore: exactScoreAttachment,
      exactScoreAvailable: Boolean(details.exactScoreAvailable),
    };

    validatedSelections.push(row);
    if (status !== "ok") {
      issues.push({
        code: reasonCodes[0] || "REPLACE_REQUIRED",
        matchId,
        message: `${row.teams}: correction recommandee (${reasonCodes.join(", ") || "raison inconnue"}).`,
      });
    }
  }

  const ok = validatedSelections.filter((x) => x.status === "ok").length;
  const toFix = validatedSelections.length - ok;
  return {
    validatedAt: new Date().toISOString(),
    status: toFix === 0 ? "TICKET_OK" : "TICKET_A_CORRIGER",
    driftThresholdPercent: driftThreshold,
    summary: {
      total: validatedSelections.length,
      ok,
      toFix,
    },
    issues,
    validatedSelections,
  };
}

async function getStructure() {
  const payload = await fetchLiveFeedRaw();
  const firstEvent =
    Array.isArray(payload?.Value) && payload.Value.length > 0 ? payload.Value[0] : null;

  return {
    fetchedAt: new Date().toISOString(),
    topLevelKeys: Object.keys(payload || {}),
    notes: {
      listField: "Value",
      eventId: "I",
      teams: "O1/O2",
      league: "L (LE/LR variantes langue)",
      scoreBlock: "SC",
      oneXTwoMarkets: "E avec G=1, T=1|2|3, cote dans C",
    },
    schema: {
      payload: schemaOf(payload, 2),
      firstEvent: schemaOf(firstEvent, 2),
      firstMarketE: schemaOf(firstEvent?.E?.[0] || null, 2),
      scoreSC: schemaOf(firstEvent?.SC || null, 2),
    },
  };
}

/**
 * Nouvelle fonction de prédiction avancée utilisant le moteur penaltyS
 */
async function getAdvancedPrediction(matchId) {
  const payload = await fetchLiveFeedRaw();
  const events = Array.isArray(payload?.Value) ? payload.Value : [];
  const found = events.find((event) => String(event?.I) === String(matchId));
  
  if (!found) {
    throw new Error("Match introuvable dans le flux actuel.");
  }

  const match = simplifyEvent(found);
  const bets = extractAllBets(found);
  
  // Utiliser le nouveau moteur de prédiction avancé
  const advancedPrediction = predictionEngine.calculatePrediction({
    id: match.id,
    homeTeam: match.teamHome,
    awayTeam: match.teamAway,
    odds: match.odds1x2,
    startTime: match.startTimeUnix,
    status: match.statusText
  });

  // Analyser avec le système multi-bots
  const botsAnalysis = analyserMatchMultiBots(match, bets);

  // Obtenir la recommandation historique
  const historicalRec = getHistoricalRecommendation(
    match.league,
    advancedPrediction.recommendedBet.type,
    advancedPrediction.recommendedBet.odds,
    null // Pas de données historiques pour l'instant
  );

  return {
    match,
    bettingMarkets: bets,
    advancedPrediction,
    botsAnalysis,
    historicalRecommendation: historicalRec,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Récupérer les tournois FIFA Penalty
 */
async function getTournamentsList() {
  try {
    const tournaments = await getPenaltyTournaments({ penaltyOnly: true, days: 7 });
    return {
      success: true,
      tournaments,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tournaments: [],
      fetchedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  API_URL,
  fetchLiveFeedRaw,
  getPenaltyMatches,
  getStructure,
  getMatchPredictionDetails,
  getCouponSelection,
  validateCouponTicket,
  isStrictUpcomingEvent,
  getAdvancedPrediction,
  getTournamentsList,
};
