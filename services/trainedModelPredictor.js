"use strict";

const fs = require("fs");
const path = require("path");

const MODEL_DIR = path.join(process.cwd(), "data", "training");
const MODEL_PREFIX = "model-finished-matches-";
let modelCache = { path: null, mtimeMs: 0, model: null };

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function weightedPick(counts) {
  let best = null;
  for (const [k, v] of Object.entries(counts || {})) {
    const n = Number(v) || 0;
    if (!best || n > best.v) best = { k, v: n };
  }
  return best ? best.k : "draw";
}

function toPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n * 100));
}

function findLatestModelPath() {
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

function loadLatestModel() {
  const modelPath = findLatestModelPath();
  if (!modelPath) return null;
  const stat = fs.statSync(modelPath);
  if (modelCache.path === modelPath && modelCache.mtimeMs === stat.mtimeMs && modelCache.model) {
    return modelCache.model;
  }
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  modelCache = { path: modelPath, mtimeMs: stat.mtimeMs, model };
  return model;
}

function roundScore(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function predictFromTrainedModel(input = {}) {
  try {
    const model = loadLatestModel();
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
    const home = model?.teams?.[homeKey] || null;
    const away = model?.teams?.[awayKey] || null;
    const priors = model?.priors || {};

    const resultDist = league?.result || priors?.result || { home: 0.34, draw: 0.32, away: 0.34 };
    const predResult = weightedPick(resultDist);

    const baseHome = Number(league?.score?.home ?? priors?.score?.home ?? 1.2);
    const baseAway = Number(league?.score?.away ?? priors?.score?.away ?? 1.2);
    const homeAdj = home ? (Number(home.for || 0) - Number(home.against || 0)) * 0.25 : 0;
    const awayAdj = away ? (Number(away.for || 0) - Number(away.against || 0)) * 0.25 : 0;
    const scoreHome = roundScore(baseHome + homeAdj - awayAdj * 0.15);
    const scoreAway = roundScore(baseAway + awayAdj - homeAdj * 0.15);

    const confidence = toPercent(resultDist?.[predResult]);
    const modelFile = modelCache.path ? path.basename(modelCache.path) : null;

    return {
      available: true,
      source: "trained-finished-matches-model",
      modelVersion: model?.version || "1.0.0",
      modelFile,
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
        homeKnown: Boolean(home),
        awayKnown: Boolean(away),
      },
    };
  } catch (error) {
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

