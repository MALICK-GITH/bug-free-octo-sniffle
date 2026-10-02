const SCORE_LEAGUE_URL = "https://score-league-api.lovable.app/api/public/predict";
const AI_FIFA_GURU_URL = "https://ai-fifa-guru.lovable.app/api/public/predict";
const PARITY_AI_URL = "https://fifa-ai-trainer.lovable.app/api/public/predict";
const FURY_X1_URL = "https://fury-insight-api.lovable.app/api/public/v1/predict";
const CACHE_TTL_MS = 30 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MIN_PROVIDERS_FOR_CONSENSUS = 2;
const cache = new Map();

function numberOrNull(value) {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : null;
}

function normalizeProbability(value) {
  const probability = numberOrNull(value);
  if (probability == null || probability < 0) return null;
  const normalized = probability > 1 && probability <= 100 ? probability / 100 : probability;
  return normalized <= 1 ? normalized : null;
}

function normalizeLine(value) {
  const line = numberOrNull(value);
  return line == null ? null : Number(line.toFixed(2));
}

function normalizeScore(value) {
  const score = String(value || "").trim().replace(/:/g, "-");
  return /^\d{1,2}-\d{1,2}$/.test(score) ? score : null;
}

function add(rows, family, selection, probability, line = null) {
  const normalizedProbability = normalizeProbability(probability);
  if (normalizedProbability == null || !selection) return;
  const normalizedLine = family === "teamTotal" && typeof line === "string" && line.includes("|")
    ? (() => {
      const [team, value] = line.split("|");
      const parsed = normalizeLine(value);
      return parsed == null ? null : `${team}|${parsed}`;
    })()
    : normalizeLine(line);
  rows.push({
    family,
    selection: String(selection),
    line: normalizedLine,
    probability: normalizedProbability,
    key: `${family}|${String(selection)}|${normalizedLine == null ? "" : normalizedLine}`,
  });
}

function addOutcomes(rows, family, outcomes, aliases = {}) {
  for (const [selection, probability] of Object.entries(outcomes || {})) {
    add(rows, family, aliases[selection] || selection, probability);
  }
}

function addTotals(rows, family, values, team = null) {
  const entries = Array.isArray(values)
    ? values.map((item) => [item?.line, item])
    : Object.entries(values || {});
  for (const [rawLine, item] of entries) {
    const line = normalizeLine(item?.line ?? rawLine);
    if (line == null) continue;
    if (family === "totalGoals") {
      add(rows, family, "over", item?.over, line);
      add(rows, family, "under", item?.under, line);
    } else if (family === "teamTotal") {
      add(rows, family, "over", item?.over, `${team}|${line}`);
      add(rows, family, "under", item?.under, `${team}|${line}`);
    }
  }
}

function addTeamTotals(rows, values) {
  for (const team of ["home", "away"]) {
    addTotals(rows, "teamTotal", values?.[team], team);
  }
}

function addHandicaps(rows, values) {
  const entries = Array.isArray(values)
    ? values.map((item) => [item?.line, item])
    : Object.entries(values || {});
  for (const [rawLine, item] of entries) {
    const line = normalizeLine(item?.line ?? rawLine);
    if (line == null) continue;
    add(rows, "handicap", "home", item?.home, line);
    add(rows, "handicap", "draw", item?.draw, line);
    add(rows, "handicap", "away", item?.away, line);
  }
}

function addScores(rows, values) {
  for (const item of Array.isArray(values) ? values : []) {
    const score = normalizeScore(item?.score);
    if (score) add(rows, "exactScore", score, item?.probability);
  }
}

function normalizeScoreLeague(data) {
  const rows = [];
  addOutcomes(rows, "winner", data?.winner, { home: "home", draw: "draw", away: "away" });
  addOutcomes(rows, "doubleChance", data?.doubleChance, {
    homeOrDraw: "1X", homeOrAway: "12", drawOrAway: "X2",
    "1X": "1X", "12": "12", X2: "X2",
  });
  addTotals(rows, "totalGoals", data?.totalGoals?.overUnder);
  addOutcomes(rows, "btts", data?.btts, { yes: "yes", no: "no" });
  addOutcomes(rows, "parity", data?.parity, { even: "even", odd: "odd" });
  addScores(rows, data?.exactScore?.top);
  return { rows, model: data?.modelInfo || null, expectedGoals: data?.expectedGoals || null };
}

function normalizeAiFifaGuru(data) {
  const prediction = Array.isArray(data?.predictions) ? data.predictions[0] : null;
  if (!prediction) throw new Error(data?.error?.code || "NO_PREDICTION");
  const rows = [];
  addOutcomes(rows, "winner", prediction?.markets?.matchWinner);
  addOutcomes(rows, "doubleChance", prediction?.markets?.doubleChance);
  addOutcomes(rows, "btts", prediction?.markets?.bothTeamsToScore);
  addTotals(rows, "totalGoals", prediction?.markets?.totals);
  addTeamTotals(rows, prediction?.markets?.teamTotals);
  addHandicaps(rows, prediction?.markets?.handicaps);
  addScores(rows, prediction?.markets?.correctScore);
  return {
    rows,
    model: {
      trainedMatches: data?.trainedMatches || null,
      leagueMatched: prediction?.leagueMatched ?? null,
      recommendation: prediction?.recommendation || null,
    },
    expectedGoals: prediction?.expectedGoals || null,
  };
}

function normalizeParityAi(data) {
  const prediction = data?.prediction;
  if (!prediction) throw new Error(data?.error?.code || "NO_PREDICTION");
  const rows = [];
  addOutcomes(rows, "winner", prediction?.result?.probabilities);
  addOutcomes(rows, "doubleChance", prediction?.result?.doubleChance);
  addOutcomes(rows, "btts", prediction?.result?.bothTeamsToScore);
  addTotals(rows, "totalGoals", prediction?.totalGoals?.lines);
  addTeamTotals(rows, prediction?.teamTotals);
  addHandicaps(rows, prediction?.handicap);
  addOutcomes(rows, "parity", prediction?.parity?.probabilities);
  addScores(rows, prediction?.correctScore);
  return { rows, model: prediction?.model || null, expectedGoals: prediction?.expectedGoals || null };
}

function normalizeFuryX1(data) {
  const prediction = data?.prediction;
  if (!data?.success || !prediction) throw new Error(data?.error?.code || "NO_PREDICTION");
  const rows = [];
  addOutcomes(rows, "winner", prediction?.["1x2"]);
  addOutcomes(rows, "doubleChance", prediction?.doubleChance);
  addOutcomes(rows, "btts", prediction?.btts);
  addOutcomes(rows, "drawNoBet", prediction?.drawNoBet);
  addOutcomes(rows, "cleanSheet", prediction?.cleanSheet);
  addOutcomes(rows, "winToNil", prediction?.winToNil);
  addOutcomes(rows, "parity", prediction?.oddEven);
  addTotals(rows, "totalGoals", prediction?.overUnder);
  addTeamTotals(rows, prediction?.teamTotals);
  addHandicaps(rows, prediction?.handicap);
  addScores(rows, prediction?.exactScore?.scores);
  return {
    rows,
    model: {
      ...data?.model,
      ensemble: data?.ensemble || null,
      dataQuality: data?.dataQuality || null,
      confidence: data?.confidence ?? null,
    },
    expectedGoals: prediction?.expectedGoals || null,
  };
}

function buildMarketLines(markets = []) {
  const lines = new Set();
  for (const market of markets) {
    const code = market?.code || {};
    if ([15, 17, 62].includes(Number(code.g)) && code.line != null && Number.isFinite(Number(code.line))) {
      lines.add(Number(code.line));
    }
  }
  if (lines.size === 0) {
    for (let line = 1.5; line <= 9.5; line += 1) lines.add(line);
  }
  return [...lines].sort((a, b) => a - b);
}

function makeBookmakerEvent(match = {}, event = {}, markets = []) {
  const raw = event && typeof event === "object" ? event : {};
  return {
    I: raw.I ?? match.id ?? null,
    SI: raw.SI ?? match.sportId ?? 85,
    S: raw.S ?? match.startTimeUnix ?? null,
    L: raw.L ?? match.league ?? "",
    LI: raw.LI ?? raw.LId ?? null,
    CN: raw.CN ?? null,
    CE: raw.CE ?? null,
    O1: raw.O1 ?? match.teamHome ?? "",
    O2: raw.O2 ?? match.teamAway ?? "",
    O1I: raw.O1I ?? null,
    O2I: raw.O2I ?? null,
    E: Array.isArray(raw.E) ? raw.E : markets.map((market) => ({
      T: market?.code?.t,
      G: market?.code?.g,
      P: market?.code?.line,
      C: market?.cote,
    })).filter((item) => item.T != null && item.G != null),
    AE: Array.isArray(raw.AE) ? raw.AE : [],
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_error) {
      throw new Error(`INVALID_JSON_${response.status}`);
    }
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function requestProvider(name, request, normalize) {
  const startedAt = Date.now();
  try {
    const raw = await request();
    const normalized = normalize(raw);
    return {
      name,
      status: normalized.rows.length ? "ok" : "no_markets",
      latencyMs: Date.now() - startedAt,
      model: normalized.model || null,
      expectedGoals: normalized.expectedGoals || null,
      predictionCount: normalized.rows.length,
      markets: normalized.rows,
    };
  } catch (error) {
    const reason = error?.name === "AbortError" ? "TIMEOUT" : String(error?.message || "PROVIDER_ERROR").split(/[\s:]/)[0];
    return {
      name,
      status: "unavailable",
      latencyMs: Date.now() - startedAt,
      error: reason,
      predictionCount: 0,
      markets: [],
    };
  }
}

function providerRequests(match, event, markets) {
  const lines = buildMarketLines(markets);
  const bookmakerEvent = makeBookmakerEvent(match, event, markets);
  const home = String(bookmakerEvent.O1 || "").trim();
  const away = String(bookmakerEvent.O2 || "").trim();
  const league = String(bookmakerEvent.L || "").trim();
  const id = String(bookmakerEvent.I || `${home}-${away}`);
  const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const scoreLeague = requestProvider("Score League", () => fetchJson(SCORE_LEAGUE_URL, json({ league, home, away, lines })), normalizeScoreLeague);
  const aiFifaGuru = requestProvider("AI FIFA Guru", () => fetchJson(AI_FIFA_GURU_URL, json({ home, away, league })), normalizeAiFifaGuru);
  const parityUrl = new URL(PARITY_AI_URL);
  parityUrl.searchParams.set("home", home);
  parityUrl.searchParams.set("away", away);
  if (league) parityUrl.searchParams.set("league", league);
  const parityAi = requestProvider("FIFA AI Trainer", () => fetchJson(parityUrl.toString()), normalizeParityAi);
  const furyX1 = requestProvider("Fury X1", () => fetchJson(FURY_X1_URL, json({ source: "one-delux", match: bookmakerEvent })), normalizeFuryX1);
  return [scoreLeague, aiFifaGuru, parityAi, furyX1];
}

function groupKey(market) {
  if (market.family === "totalGoals") return `${market.family}|${market.line}`;
  if (market.family === "teamTotal") {
    const [team, line] = String(market.line || "").split("|");
    return `${market.family}|${team}|${line}`;
  }
  if (market.family === "handicap") return `${market.family}|${market.line}`;
  return market.family;
}

function describeGroup(key) {
  const [family, team, line] = String(key).split("|");
  if (family === "totalGoals") return { family, line: Number(team) };
  if (family === "teamTotal") return { family, team, line: Number(line) };
  if (family === "handicap") return { family, line: Number(team) };
  return { family };
}

function buildMarketConsensus(providers) {
  const grouped = new Map();
  for (const provider of providers) {
    for (const market of provider.markets) {
      const key = groupKey(market);
      if (!grouped.has(key)) grouped.set(key, new Map());
      const byProvider = grouped.get(key);
      if (!byProvider.has(provider.name)) byProvider.set(provider.name, []);
      byProvider.get(provider.name).push(market);
    }
  }

  const consensus = [];
  for (const [key, byProvider] of grouped) {
    const selections = new Map();
    const providerPicks = [];
    for (const [providerName, rows] of byProvider) {
      const best = [...rows].sort((a, b) => b.probability - a.probability)[0];
      if (best) providerPicks.push({ provider: providerName, selection: best.selection });
      for (const row of rows) {
        if (!selections.has(row.selection)) selections.set(row.selection, []);
        selections.get(row.selection).push({ provider: providerName, probability: row.probability });
      }
    }

    const outcomes = [...selections.entries()].map(([selection, rows]) => {
      const probability = rows.reduce((sum, row) => sum + row.probability, 0) / rows.length;
      return {
        selection,
        probability: Number(probability.toFixed(4)),
        fairOdds: Number((1 / probability).toFixed(3)),
        providers: rows.map((row) => row.provider),
        providerCount: rows.length,
      };
    }).sort((a, b) => b.probability - a.probability);
    const recommended = outcomes[0] || null;
    const agreementCount = recommended
      ? providerPicks.filter((pick) => pick.selection === recommended.selection).length
      : 0;
    consensus.push({
      key,
      ...describeGroup(key),
      providersCount: byProvider.size,
      recommendedSelection: recommended?.selection || null,
      recommendationProbability: recommended?.probability ?? null,
      agreementCount,
      agreementPct: byProvider.size ? Number(((agreementCount / byProvider.size) * 100).toFixed(1)) : 0,
      outcomes,
    });
  }
  return consensus.sort((a, b) => a.family.localeCompare(b.family) || Number(a.line || 0) - Number(b.line || 0));
}

function bookmakerSelection(market = {}) {
  const { g, t, line } = market?.code || {};
  if (Number(g) === 1 && [1, 2, 3].includes(Number(t))) {
    return { family: "winner", selection: ({ 1: "home", 2: "draw", 3: "away" })[Number(t)] };
  }
  if (Number(g) === 8 && [4, 5, 6].includes(Number(t))) {
    return { family: "doubleChance", selection: ({ 4: "1X", 5: "12", 6: "X2" })[Number(t)] };
  }
  if ([17, 15, 62].includes(Number(g)) && [9, 10, 11, 12, 13, 14].includes(Number(t))) {
    const family = Number(g) === 17 ? "totalGoals" : "teamTotal";
    const team = Number(g) === 15 ? "home" : Number(g) === 62 ? "away" : null;
    const side = [9, 11, 13].includes(Number(t)) ? "over" : "under";
    return { family, team, line: normalizeLine(line), selection: side };
  }
  if (Number(g) === 2 && [7, 8].includes(Number(t))) {
    return { family: "handicap", line: normalizeLine(line), selection: Number(t) === 7 ? "home" : "away" };
  }
  if (Number(g) === 19 && [180, 181].includes(Number(t))) {
    return { family: "parity", selection: Number(t) === 180 || Number(g) === 180 ? "even" : "odd" };
  }
  if ([180, 181].includes(Number(t))) {
    return { family: "btts", selection: Number(t) === 180 ? "yes" : "no" };
  }
  return null;
}

function marketKeyFromSelection(selection) {
  if (selection.family === "totalGoals") return `${selection.family}|${selection.line}`;
  if (selection.family === "teamTotal") return `${selection.family}|${selection.team}|${selection.line}`;
  if (selection.family === "handicap") return `${selection.family}|${selection.line}`;
  return selection.family;
}

function buildBookmakerRecommendations(markets, marketConsensus) {
  const consensusByKey = new Map(marketConsensus.map((market) => [market.key, market]));
  const picks = [];
  for (const market of markets) {
    const selection = bookmakerSelection(market);
    if (!selection) continue;
    const consensus = consensusByKey.get(marketKeyFromSelection(selection));
    if (!consensus || consensus.providersCount < MIN_PROVIDERS_FOR_CONSENSUS) continue;
    const outcome = consensus.outcomes.find((item) => item.selection === selection.selection);
    if (!outcome) continue;
    const offeredOdds = numberOrNull(market.cote);
    if (offeredOdds == null) continue;
    const edge = offeredOdds * outcome.probability - 1;
    picks.push({
      market: market.nom,
      family: selection.family,
      selection: selection.selection,
      line: selection.line ?? null,
      offeredOdds,
      probability: outcome.probability,
      fairOdds: outcome.fairOdds,
      edge: Number(edge.toFixed(4)),
      providersCount: outcome.providerCount,
      agreementPct: consensus.agreementPct,
      consensusAligned: consensus.recommendedSelection === selection.selection,
      eligibleOdds: offeredOdds >= 1.5,
      recommendation: offeredOdds >= 1.5 && edge > 0.02 && consensus.recommendedSelection === selection.selection
        ? "value"
        : "no-value",
    });
  }
  return picks.sort((a, b) => b.edge - a.edge || b.agreementPct - a.agreementPct);
}

function makeCacheKey(match, event, markets) {
  return JSON.stringify([
    match?.id || event?.I || "",
    match?.teamHome || event?.O1 || "",
    match?.teamAway || event?.O2 || "",
    match?.league || event?.L || "",
    (markets || []).map((market) => [market?.code?.g, market?.code?.t, market?.code?.line, market?.cote]),
  ]);
}

async function calculateCouncil(match, event, markets) {
  const providerResults = await Promise.all(providerRequests(match, event, markets));
  const providers = providerResults.map(({ markets: _markets, ...provider }) => provider);
  const marketConsensus = buildMarketConsensus(providerResults);
  const bookmakerMarkets = buildBookmakerRecommendations(markets, marketConsensus);
  const playablePicks = bookmakerMarkets.filter((pick) => pick.recommendation === "value");
  return {
    generatedAt: new Date().toISOString(),
    minOfferedOdds: 1.5,
    minProvidersForConsensus: MIN_PROVIDERS_FOR_CONSENSUS,
    providers,
    marketConsensus,
    bookmakerMarkets,
    playablePicks,
    summary: {
      providersConfigured: providerResults.length,
      providersAvailable: providers.filter((provider) => provider.status === "ok").length,
      marketsPredicted: marketConsensus.length,
      bookmakerMarketsEligible: bookmakerMarkets.filter((pick) => pick.eligibleOdds).length,
      valuePicks: playablePicks.length,
    },
  };
}

async function predictWithProviderCouncil(match = {}, event = {}, markets = []) {
  const key = makeCacheKey(match, event, markets);
  const current = cache.get(key);
  if (current && Date.now() - current.createdAt < CACHE_TTL_MS) return current.promise;

  const promise = calculateCouncil(match, event, markets).catch((error) => ({
    generatedAt: new Date().toISOString(),
    minOfferedOdds: 1.5,
    minProvidersForConsensus: MIN_PROVIDERS_FOR_CONSENSUS,
    providers: [],
    marketConsensus: [],
    bookmakerMarkets: [],
    playablePicks: [],
    summary: { providersConfigured: 4, providersAvailable: 0, marketsPredicted: 0, bookmakerMarketsEligible: 0, valuePicks: 0 },
    error: String(error?.message || "COUNCIL_ERROR"),
  }));
  cache.set(key, { createdAt: Date.now(), promise });
  if (cache.size > 200) {
    for (const [cacheKey, item] of cache) {
      if (Date.now() - item.createdAt >= CACHE_TTL_MS) cache.delete(cacheKey);
    }
    while (cache.size > 200) cache.delete(cache.keys().next().value);
  }
  return promise;
}

module.exports = {
  MIN_PROVIDERS_FOR_CONSENSUS,
  predictWithProviderCouncil,
};
