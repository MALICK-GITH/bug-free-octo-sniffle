#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  let field = "";
  let row = [];
  let inQuotes = false;

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildLabel(scoreHome, scoreAway) {
  if (scoreHome > scoreAway) return "home";
  if (scoreHome < scoreAway) return "away";
  return "draw";
}

function weightedPick(counts) {
  let best = null;
  for (const [k, v] of Object.entries(counts || {})) {
    if (!best || v > best.v) best = { k, v };
  }
  return best ? best.k : null;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function run() {
  const csvPathArg = process.argv[2];
  if (!csvPathArg) {
    console.error("Usage: node scripts/train-finished-matches.js <path-to-csv>");
    process.exit(1);
  }

  const csvPath = path.resolve(csvPathArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV introuvable: ${csvPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const parsed = parseCsv(raw);
  if (!parsed.length || parsed.length < 2) {
    console.error("CSV vide ou invalide.");
    process.exit(1);
  }

  const header = parsed[0].map((x) => normalizeText(x));
  const idx = {
    matchId: header.indexOf("match_id"),
    teamHome: header.indexOf("team_home"),
    teamAway: header.indexOf("team_away"),
    league: header.indexOf("league"),
    scoreHome: header.indexOf("score_home"),
    scoreAway: header.indexOf("score_away"),
    finishedAt: header.indexOf("finished_at"),
  };

  const required = ["teamHome", "teamAway", "league", "scoreHome", "scoreAway"];
  for (const k of required) {
    if (idx[k] < 0) {
      console.error(`Colonne manquante: ${k}`);
      process.exit(1);
    }
  }

  const byMatch = new Map();
  for (let i = 1; i < parsed.length; i += 1) {
    const row = parsed[i];
    if (!row || !row.length) continue;

    const matchId = idx.matchId >= 0 ? String(row[idx.matchId] || "").trim() : `row-${i}`;
    const teamHome = String(row[idx.teamHome] || "").trim();
    const teamAway = String(row[idx.teamAway] || "").trim();
    const league = String(row[idx.league] || "").trim();
    const scoreHome = toNumber(row[idx.scoreHome], NaN);
    const scoreAway = toNumber(row[idx.scoreAway], NaN);
    const finishedAt = idx.finishedAt >= 0 ? String(row[idx.finishedAt] || "").trim() : "";

    if (!teamHome || !teamAway || !league) continue;
    if (!Number.isFinite(scoreHome) || !Number.isFinite(scoreAway)) continue;

    const key = matchId || `${teamHome}__${teamAway}__${league}__${finishedAt}__${i}`;
    const prev = byMatch.get(key);
    if (!prev) {
      byMatch.set(key, { matchId: key, teamHome, teamAway, league, scoreHome, scoreAway, finishedAt });
      continue;
    }
    const prevTs = Date.parse(prev.finishedAt || "") || 0;
    const nextTs = Date.parse(finishedAt || "") || 0;
    if (nextTs >= prevTs) {
      byMatch.set(key, { matchId: key, teamHome, teamAway, league, scoreHome, scoreAway, finishedAt });
    }
  }

  const data = Array.from(byMatch.values()).sort((a, b) => {
    const ta = Date.parse(a.finishedAt || "") || 0;
    const tb = Date.parse(b.finishedAt || "") || 0;
    return ta - tb;
  });

  if (data.length < 20) {
    console.error(`Dataset trop petit pour entrainement fiable (${data.length} lignes).`);
    process.exit(1);
  }

  const splitAt = Math.max(1, Math.floor(data.length * 0.8));
  const train = data.slice(0, splitAt);
  const valid = data.slice(splitAt);

  const leagueStats = {};
  const teamStats = {};
  const global = { home: 0, draw: 0, away: 0, count: 0, scoreHome: 0, scoreAway: 0 };

  for (const m of train) {
    const leagueKey = normalizeText(m.league);
    const homeKey = normalizeText(m.teamHome);
    const awayKey = normalizeText(m.teamAway);
    const y = buildLabel(m.scoreHome, m.scoreAway);

    if (!leagueStats[leagueKey]) leagueStats[leagueKey] = { home: 0, draw: 0, away: 0, n: 0, gsH: [], gsA: [] };
    leagueStats[leagueKey][y] += 1;
    leagueStats[leagueKey].n += 1;
    leagueStats[leagueKey].gsH.push(m.scoreHome);
    leagueStats[leagueKey].gsA.push(m.scoreAway);

    if (!teamStats[homeKey]) teamStats[homeKey] = { for: [], against: [] };
    if (!teamStats[awayKey]) teamStats[awayKey] = { for: [], against: [] };
    teamStats[homeKey].for.push(m.scoreHome);
    teamStats[homeKey].against.push(m.scoreAway);
    teamStats[awayKey].for.push(m.scoreAway);
    teamStats[awayKey].against.push(m.scoreHome);

    global[y] += 1;
    global.count += 1;
    global.scoreHome += m.scoreHome;
    global.scoreAway += m.scoreAway;
  }

  const model = {
    version: "1.0.0",
    trainedAt: new Date().toISOString(),
    trainSize: train.length,
    validSize: valid.length,
    priors: {
      result: {
        home: global.home / Math.max(1, global.count),
        draw: global.draw / Math.max(1, global.count),
        away: global.away / Math.max(1, global.count),
      },
      score: {
        home: global.scoreHome / Math.max(1, global.count),
        away: global.scoreAway / Math.max(1, global.count),
      },
    },
    leagues: {},
    teams: {},
  };

  for (const [leagueKey, s] of Object.entries(leagueStats)) {
    model.leagues[leagueKey] = {
      n: s.n,
      result: {
        home: s.home / Math.max(1, s.n),
        draw: s.draw / Math.max(1, s.n),
        away: s.away / Math.max(1, s.n),
      },
      score: { home: mean(s.gsH), away: mean(s.gsA) },
    };
  }

  for (const [teamKey, s] of Object.entries(teamStats)) {
    model.teams[teamKey] = {
      n: s.for.length,
      for: mean(s.for),
      against: mean(s.against),
    };
  }

  let correctResult = 0;
  let maeHome = 0;
  let maeAway = 0;
  const perLeague = {};

  for (const m of valid) {
    const lk = normalizeText(m.league);
    const hk = normalizeText(m.teamHome);
    const ak = normalizeText(m.teamAway);
    const ls = model.leagues[lk] || null;
    const hs = model.teams[hk] || null;
    const as = model.teams[ak] || null;

    const resultDist = ls?.result || model.priors.result;
    const predResult = weightedPick(resultDist) || "draw";

    const baseHome = ls?.score?.home ?? model.priors.score.home;
    const baseAway = ls?.score?.away ?? model.priors.score.away;
    const homeAdj = hs ? (hs.for - hs.against) * 0.25 : 0;
    const awayAdj = as ? (as.for - as.against) * 0.25 : 0;
    const predHome = Math.max(0, Math.round(baseHome + homeAdj - awayAdj * 0.15));
    const predAway = Math.max(0, Math.round(baseAway + awayAdj - homeAdj * 0.15));

    const actualResult = buildLabel(m.scoreHome, m.scoreAway);
    if (predResult === actualResult) correctResult += 1;
    maeHome += Math.abs(predHome - m.scoreHome);
    maeAway += Math.abs(predAway - m.scoreAway);

    if (!perLeague[lk]) perLeague[lk] = { n: 0, correct: 0 };
    perLeague[lk].n += 1;
    if (predResult === actualResult) perLeague[lk].correct += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceCsv: csvPath,
    rowsRaw: parsed.length - 1,
    rowsAfterDedupe: data.length,
    split: {
      train: train.length,
      valid: valid.length,
    },
    metrics: {
      resultAccuracy: valid.length ? correctResult / valid.length : null,
      scoreMaeHome: valid.length ? maeHome / valid.length : null,
      scoreMaeAway: valid.length ? maeAway / valid.length : null,
    },
    byLeagueValidation: Object.entries(perLeague)
      .map(([league, s]) => ({
        league,
        n: s.n,
        accuracy: s.n ? s.correct / s.n : null,
      }))
      .sort((a, b) => b.n - a.n),
  };

  const outDir = path.join(process.cwd(), "data", "training");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const modelPath = path.join(outDir, `model-finished-matches-${stamp}.json`);
  const reportPath = path.join(outDir, `report-finished-matches-${stamp}.json`);

  fs.writeFileSync(modelPath, JSON.stringify(model, null, 2), "utf8");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({
    success: true,
    modelPath,
    reportPath,
    metrics: report.metrics,
    rowsAfterDedupe: report.rowsAfterDedupe,
  }, null, 2));
}

run();
