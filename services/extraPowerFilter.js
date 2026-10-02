function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pctToPoints(pct, maxPoints, minPct, maxPct) {
  const x = (pct - minPct) / (maxPct - minPct);
  return clamp(x, 0, 1) * maxPoints;
}

function average(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function areCurvesTooClose(homeFlux, awayFlux, threshold = 6) {
  if (!homeFlux?.length || homeFlux.length !== awayFlux?.length) return true;
  let sumAbs = 0;
  for (let i = 0; i < homeFlux.length; i += 1) {
    sumAbs += Math.abs(homeFlux[i] - awayFlux[i]);
  }
  const meanAbs = sumAbs / homeFlux.length;
  return meanAbs < threshold;
}

function fluxDominanceShare(chosenFlux, otherFlux) {
  if (!chosenFlux?.length || chosenFlux.length !== otherFlux?.length) return 0;
  let above = 0;
  for (let i = 0; i < chosenFlux.length; i += 1) {
    if (chosenFlux[i] > otherFlux[i]) above += 1;
  }
  return above / chosenFlux.length;
}

function isOpponentSurgingLate(opponentFlux, surgeDelta = 10) {
  if (!opponentFlux?.length || opponentFlux.length < 8) return false;
  const n = opponentFlux.length;
  const start = Math.floor(n * 0.75);
  const first = opponentFlux[start];
  const last = opponentFlux[n - 1];
  return last - first >= surgeDelta;
}

function isZoneNullLow(zoneNull, maxAvg = 25) {
  const avg = average(zoneNull);
  if (avg === null) return false;
  return avg <= maxAvg;
}

function consensusPoints(consensus, totalBots = 4, maxPoints = 25) {
  const ratio = clamp(consensus / totalBots, 0, 1);
  return ratio * maxPoints;
}

function winDominancePoints(dominantWinPct, otherWinPct, maxPoints = 30) {
  if (dominantWinPct < 55) return 0;
  if (otherWinPct > 35) return 0;
  return pctToPoints(dominantWinPct, maxPoints, 55, 75);
}

function fluxPoints(share, zoneNullOk, maxPoints = 20) {
  if (share < 0.7) return 0;
  let pts = pctToPoints(share * 100, maxPoints, 70, 90);
  if (!zoneNullOk) pts *= 0.6;
  return pts;
}

function recommendOption({ dominantWinPct, confidence, consensus, fluxShare, zoneNullOk }) {
  if (zoneNullOk && fluxShare >= 0.72 && confidence >= 60 && consensus >= 3) {
    return "TOTAL_BUTS (Over/Under)";
  }
  if (dominantWinPct >= 60 && fluxShare >= 0.75 && confidence >= 60 && consensus >= 3) {
    return "1X2 (V2)";
  }
  if (dominantWinPct >= 68 && fluxShare >= 0.82 && confidence >= 62 && consensus >= 3) {
    return "HANDICAP (prudence)";
  }
  return "NO_CLEAR_OPTION";
}

function evaluateMatch(match, meta, config = {}) {
  const cfg = {
    minMatches: 50,
    minScore: 75,
    totalBots: 4,
    ...config,
  };

  const reasons = [];
  const warnings = [];

  if ((meta?.totalMatches ?? 0) < cfg.minMatches) {
    return {
      status: "FILTER_LOCKED",
      playable: false,
      score: 0,
      reasons: [`Filtre desactive: ${(meta?.totalMatches ?? 0)}/${cfg.minMatches} matchs`],
      recommendation: "COLLECT_MORE_MATCHES",
    };
  }

  if (String(match.action || "").toUpperCase() !== "MISE PRUDENTE") {
    reasons.push("Action != MISE PRUDENTE");
  }

  if ((match.consensusBots ?? 0) < 3) {
    reasons.push("Consensus bots < 3/4");
  }

  if ((match.confidence ?? 0) < 60) {
    reasons.push("Confiance < 60%");
  }

  const pick = (match.pickSide || "").toUpperCase();
  const dominantWinPct = pick === "AWAY" ? match.winAway ?? 0 : match.winHome ?? 0;
  const otherWinPct = pick === "AWAY" ? match.winHome ?? 0 : match.winAway ?? 0;
  const winPts = winDominancePoints(dominantWinPct, otherWinPct, 30);
  if (winPts === 0) reasons.push("Win% pas assez dominant (>=55 et autre <=35 requis)");

  const homeFlux = match.homeFlux || [];
  const awayFlux = match.awayFlux || [];
  const zoneNull = match.zoneNull || [];

  const curvesClose = areCurvesTooClose(homeFlux, awayFlux, 6);
  if (curvesClose) reasons.push("Flux trop colles (match equilibre/chaos)");

  const chosenFlux = pick === "AWAY" ? awayFlux : homeFlux;
  const oppFlux = pick === "AWAY" ? homeFlux : awayFlux;
  const share = fluxDominanceShare(chosenFlux, oppFlux);
  const zoneNullOk = isZoneNullLow(zoneNull, 25);
  if (share < 0.7) reasons.push("Flux dominant < 70%");
  if (!zoneNullOk) warnings.push("Zone Nul pas basse (risque match bloque)");

  const oppSurgeLate = isOpponentSurgingLate(oppFlux, 10);
  if (oppSurgeLate) reasons.push("Remontee adverse en fin de match detectee");

  const confidencePts = pctToPoints(match.confidence ?? 0, 25, 60, 80);
  const consensusPts = consensusPoints(match.consensusBots ?? 0, cfg.totalBots, 25);
  const fluxPts = fluxPoints(share, zoneNullOk, 20);
  const score = Math.round(confidencePts + consensusPts + winPts + fluxPts);

  const baseMustPass =
    String(match.action || "").toUpperCase() === "MISE PRUDENTE" &&
    (match.consensusBots ?? 0) >= 3 &&
    (match.confidence ?? 0) >= 60;

  const playable = baseMustPass && score >= cfg.minScore && reasons.length === 0;
  const recommendation = recommendOption({
    dominantWinPct,
    confidence: match.confidence ?? 0,
    consensus: match.consensusBots ?? 0,
    fluxShare: share,
    zoneNullOk,
  });

  return {
    status: playable ? "PLAY" : "NO_PLAY",
    playable,
    score,
    breakdown: {
      confidencePts: Math.round(confidencePts),
      consensusPts: Math.round(consensusPts),
      winPts: Math.round(winPts),
      fluxPts: Math.round(fluxPts),
      fluxShare: Number(share.toFixed(3)),
      zoneNullAvg: average(zoneNull),
    },
    recommendation,
    reasons,
    warnings,
  };
}

module.exports = {
  evaluateMatch,
};

