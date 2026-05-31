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

function sanitizeLeagueKey(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
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

function trainSingleLeague(leagueName, rows) {
  const splitAt = Math.max(1, Math.floor(rows.length * 0.8));
  const train = rows.slice(0, splitAt);
  const valid = rows.slice(splitAt);

  const teamStats = {};
  const global = { home: 0, draw: 0, away: 0, count: 0, scoreHome: 0, scoreAway: 0 };

  for (const m of train) {
    const homeKey = normalizeText(m.teamHome);
    const awayKey = normalizeText(m.teamAway);
    const y = buildLabel(m.scoreHome, m.scoreAway);

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
    scope: "penalty-league",
    league: leagueName,
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
    teams: {},
  };

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
  for (const m of valid) {
    const hk = normalizeText(m.teamHome);
    const ak = normalizeText(m.teamAway);
    const hs = model.teams[hk] || null;
    const as = model.teams[ak] || null;

    const resultDist = model.priors.result;
    const predResult = weightedPick(resultDist) || "draw";

    const baseHome = model.priors.score.home;
    const baseAway = model.priors.score.away;
    const homeAdj = hs ? (hs.for - hs.against) * 0.25 : 0;
    const awayAdj = as ? (as.for - as.against) * 0.25 : 0;
    const predHome = Math.max(0, Math.round(baseHome + homeAdj - awayAdj * 0.15));
    const predAway = Math.max(0, Math.round(baseAway + awayAdj - homeAdj * 0.15));

    const actualResult = buildLabel(m.scoreHome, m.scoreAway);
    if (predResult === actualResult) correctResult += 1;
    maeHome += Math.abs(predHome - m.scoreHome);
    maeAway += Math.abs(predAway - m.scoreAway);
  }

  return {
    model,
    metrics: {
      resultAccuracy: valid.length ? correctResult / valid.length : null,
      scoreMaeHome: valid.length ? maeHome / valid.length : null,
      scoreMaeAway: valid.length ? maeAway / valid.length : null,
    },
  };
}

function run() {
  const csvPathArg = process.argv[2];
  if (!csvPathArg) {
    console.error("Usage: node scripts/train-penalty-leagues.js <path-to-csv>");
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
    if (!normalizeText(league).includes("penalty")) continue;

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

  const rows = Array.from(byMatch.values()).sort((a, b) => {
    const ta = Date.parse(a.finishedAt || "") || 0;
    const tb = Date.parse(b.finishedAt || "") || 0;
    return ta - tb;
  });

  const grouped = {};
  for (const row of rows) {
    const leagueKey = normalizeText(row.league);
    if (!grouped[leagueKey]) grouped[leagueKey] = [];
    grouped[leagueKey].push(row);
  }

  const outDir = path.join(process.cwd(), "data", "training", "penalty-leagues");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const summary = [];

  for (const [leagueKey, leagueRows] of Object.entries(grouped)) {
    if (leagueRows.length < 20) continue;
    const leagueName = leagueRows[0]?.league || leagueKey;
    const { model, metrics } = trainSingleLeague(leagueName, leagueRows);
    const safeKey = sanitizeLeagueKey(leagueKey) || "penalty";
    const modelPath = path.join(outDir, `model-penalty-${safeKey}-${stamp}.json`);
    fs.writeFileSync(modelPath, JSON.stringify(model, null, 2), "utf8");
    summary.push({
      league: leagueName,
      key: safeKey,
      rows: leagueRows.length,
      modelPath,
      metrics,
    });
  }

  const reportPath = path.join(outDir, `report-penalty-leagues-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCsv: csvPath,
        rowsRaw: parsed.length - 1,
        rowsPenaltyAfterDedupe: rows.length,
        leaguesTrained: summary.length,
        models: summary,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        success: true,
        reportPath,
        leaguesTrained: summary.length,
        rowsPenaltyAfterDedupe: rows.length,
      },
      null,
      2
    )
  );
}

run();
