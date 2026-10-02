"use strict";

const fs = require("fs");
const path = require("path");

const MODEL_DIR = path.join(process.cwd(), "data", "training");
const PENALTY_MODEL_DIR = path.join(MODEL_DIR, "penalty-leagues");
const MODEL_PREFIX = "model-finished-matches-";
const PENALTY_MODEL_PREFIX = "model-penalty-";
const PINNED_GLOBAL_MODEL_FILE = String(process.env.TRAINED_GLOBAL_MODEL_FILE || "").trim();
let modelCache = { path: null, mtimeMs: 0, model: null };
let penaltyModelCache = { byLeague: new Map(), byPath: new Map() };

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function detectPenaltySegment(leagueValue) {
  const league = normalizeText(leagueValue);
  if (league.includes("fc 24") || league.includes("fc24")) return "fc24_penalty";
  if (league.includes("fc 25") || league.includes("fc25")) return "fc25_penalty";
  if (league.includes("fc 26") || league.includes("fc26")) return "fc26_penalty";
  return "global_penalty";
}

function detectPenaltyLeagueModelKey(leagueValue) {
  const league = normalizeText(leagueValue);
  if (!league.includes("penalty")) return null;
  if (league.includes("fc 24") || league.includes("fc24")) return "fc24_penalty";
  if (league.includes("fc 25") || league.includes("fc25")) return "fc25_penalty";
  if (league.includes("fc 26") || league.includes("fc26")) return "fc26_penalty";
  if (league.includes("fifa23")) return "fifa23_penalty";
  return "penalty";
}

function weightedPick(counts) {
  let best = null;
  for (const [k, v] of Object.entries(counts || {})) {
    const n = Number(v) || 0;
    if (!best || n > best.v) best = { k, v: n };
  }
  return best ? best.k : "draw";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeOutcomeDistribution(input = {}) {
  const home = Math.max(0.0001, Number(input.home) || 0.0001);
  const draw = Math.max(0.0001, Number(input.draw) || 0.0001);
  const away = Math.max(0.0001, Number(input.away) || 0.0001);
  const sum = home + draw + away;
  return {
    home: home / sum,
    draw: draw / sum,
    away: away / sum,
  };
}

function computeDynamicOutcomeDistribution({ leagueResult = {}, scoreHome = 1, scoreAway = 1 }) {
  const base = normalizeOutcomeDistribution({
    home: Number(leagueResult.home) || 0.34,
    draw: Number(leagueResult.draw) || 0.32,
    away: Number(leagueResult.away) || 0.34,
  });

  const delta = Number(scoreHome) - Number(scoreAway);
  const absDelta = Math.abs(delta);
  const direction = delta === 0 ? 0 : delta > 0 ? 1 : -1;

  // Shift probabilities with team-level edge while preserving league priors.
  const edgeBoost = clamp(absDelta * 0.06, 0, 0.34);
  let home = base.home;
  let draw = base.draw;
  let away = base.away;

  if (direction > 0) {
    home += edgeBoost;
    away -= edgeBoost * 0.85;
  } else if (direction < 0) {
    away += edgeBoost;
    home -= edgeBoost * 0.85;
  }

  // When teams are close, keep higher draw likelihood.
  const closeness = clamp(1 - absDelta / 3, 0, 1);
  draw += 0.12 * closeness;
  home -= 0.06 * closeness;
  away -= 0.06 * closeness;

  return normalizeOutcomeDistribution({ home, draw, away });
}

function toPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n * 100));
}

function findLatestModelPath() {
  if (PINNED_GLOBAL_MODEL_FILE) {
    const pinnedPath = path.isAbsolute(PINNED_GLOBAL_MODEL_FILE)
      ? PINNED_GLOBAL_MODEL_FILE
      : path.join(MODEL_DIR, PINNED_GLOBAL_MODEL_FILE);
    if (fs.existsSync(pinnedPath)) return pinnedPath;
  }
  if (!fs.existsSync(MODEL_DIR)) return null;
  const files = fs
    .readdirSync(MODEL_DIR)
    .filter((name) => name.startsWith(MODEL_PREFIX) && name.endsWith(".json"))
    .sort((a, b) => {
      const pa = path.join(MODEL_DIR, a);
      const pb = path.join(MODEL_DIR, b);
      const sa = fs.statSync(pa).mtimeMs;
      const sb = fs.statSync(pb).mtimeMs;
      return sb - sa;
    });
  if (!files.length) return null;
  return path.join(MODEL_DIR, files[0]);
}

function getPenaltyModelPathsByLeague() {
  if (!fs.existsSync(PENALTY_MODEL_DIR)) return new Map();
  const files = fs
    .readdirSync(PENALTY_MODEL_DIR)
    .filter((name) => name.startsWith(PENALTY_MODEL_PREFIX) && name.endsWith(".json"))
    .sort((a, b) => {
      const pa = path.join(PENALTY_MODEL_DIR, a);
      const pb = path.join(PENALTY_MODEL_DIR, b);
      const sa = fs.statSync(pa).mtimeMs;
      const sb = fs.statSync(pb).mtimeMs;
      return sb - sa;
    });
  const byLeague = new Map();
  for (const fileName of files) {
    const withoutPrefix = fileName.slice(PENALTY_MODEL_PREFIX.length);
    const leagueKey = withoutPrefix.replace(/-\d+\.json$/i, "").trim();
    if (!leagueKey || byLeague.has(leagueKey)) continue;
    byLeague.set(leagueKey, path.join(PENALTY_MODEL_DIR, fileName));
  }
  return byLeague;
}

function loadPenaltyModelByLeague(leagueKey) {
  if (!leagueKey) return null;
  const byLeague = getPenaltyModelPathsByLeague();
  penaltyModelCache.byLeague = byLeague;
  const modelPath = byLeague.get(leagueKey) || null;
  if (!modelPath) return null;
  const stat = fs.statSync(modelPath);
  const cached = penaltyModelCache.byPath.get(modelPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.model) {
    return { model: cached.model, path: modelPath };
  }
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  penaltyModelCache.byPath.set(modelPath, { mtimeMs: stat.mtimeMs, model });
  return { model, path: modelPath };
}

function loadLatestModel() {
  const modelPath = findLatestModelPath();
  if (!modelPath) return null;
  const stat = fs.statSync(modelPath);
  if (modelCache.path === modelPath && modelCache.mtimeMs === stat.mtimeMs && modelCache.model) {
    return modelCache.model;
  }
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  if (!model || typeof model !== "object") {
    throw new Error("modele invalide (structure vide)");
  }
  if (!model.priors || typeof model.priors !== "object") {
    throw new Error("modele invalide (priors manquants)");
  }
  modelCache = { path: modelPath, mtimeMs: stat.mtimeMs, model };
  return model;
}

function roundScore(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function predictFromTrainedModel(input = {}) {
  try {
    const penaltyLeagueModelKey = detectPenaltyLeagueModelKey(input.league);
    const penaltyLoaded = loadPenaltyModelByLeague(penaltyLeagueModelKey);
    const model = penaltyLoaded?.model || loadLatestModel();
    if (!model) {
      return {
        available: false,
        reason: "no_model_file",
      };
    }

    const leagueKey = normalizeText(input.league);
    const homeKey = normalizeText(input.teamHome || input.homeTeam);
    const awayKey = normalizeText(input.teamAway || input.awayTeam);

    const league = model?.leagues?.[leagueKey] || null;
    const segmentKey = detectPenaltySegment(input.league);
    const segment = model?.segments?.[segmentKey] || model?.segments?.global_penalty || null;
    const home = model?.teams?.[homeKey] || null;
    const away = model?.teams?.[awayKey] || null;
    const priors = model?.priors || {};

    const leagueResult = league?.result || segment?.result || priors?.result || { home: 0.34, draw: 0.32, away: 0.34 };

    const baseHome = Number(league?.score?.home ?? segment?.score?.home ?? priors?.score?.home ?? 1.2);
    const baseAway = Number(league?.score?.away ?? segment?.score?.away ?? priors?.score?.away ?? 1.2);
    const homeAdj = home ? (Number(home.for || 0) - Number(home.against || 0)) * 0.25 : 0;
    const awayAdj = away ? (Number(away.for || 0) - Number(away.against || 0)) * 0.25 : 0;
    const scoreHome = roundScore(baseHome + homeAdj - awayAdj * 0.15);
    const scoreAway = roundScore(baseAway + awayAdj - homeAdj * 0.15);

    const resultDist = computeDynamicOutcomeDistribution({
      leagueResult,
      scoreHome,
      scoreAway,
    });
    const predResult = weightedPick(resultDist);

    const confidence = toPercent(resultDist?.[predResult]);
    const modelFile = penaltyLoaded?.path
      ? path.basename(penaltyLoaded.path)
      : modelCache.path
        ? path.basename(modelCache.path)
        : null;

    return {
      available: true,
      source: "trained-finished-matches-model",
      modelVersion: model?.version || "1.0.0",
      modelFile,
      modelScope: penaltyLoaded?.path ? "penalty-league" : "global",
      trainedAt: model?.trainedAt || null,
      recommendation: predResult,
      confidence: Number(confidence.toFixed(2)),
      exactScore: `${scoreHome}-${scoreAway}`,
      scoreHome,
      scoreAway,
      distribution: {
        home: Number((toPercent(resultDist.home)).toFixed(2)),
        draw: Number((toPercent(resultDist.draw)).toFixed(2)),
        away: Number((toPercent(resultDist.away)).toFixed(2)),
      },
      coverage: {
        leagueKnown: Boolean(league),
        segmentKey,
        segmentKnown: Boolean(segment),
        homeKnown: Boolean(home),
        awayKnown: Boolean(away),
      },
    };
  } catch (error) {
    // Reset cache in case of transient corrupted model load to avoid sticky failures.
    modelCache = { path: null, mtimeMs: 0, model: null };
    return {
      available: false,
      reason: "predict_error",
      error: error.message,
    };
  }
}

module.exports = {
  predictFromTrainedModel,
};
