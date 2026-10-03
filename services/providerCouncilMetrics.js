"use strict";

const { saveGeneratedAsset, getGeneratedAssets } = require("./db");

const FORECAST_KIND = "provider_council_forecast";
const RESULT_KIND = "provider_council_result";
const MAX_OBSERVATIONS = 2000;
const recordedForecasts = new Set();

function matchIdOf(match = {}) {
  return String(match.id || match.matchId || match.match_id || "").trim();
}

async function recordProviderCouncilForecast(match = {}, council = {}) {
  const matchId = matchIdOf(match);
  const kickoff = Number(match.startTimeUnix || match.start_time_unix || 0);
  if (!matchId || !kickoff || kickoff <= Math.floor(Date.now() / 1000) + 60 || recordedForecasts.has(matchId)) return false;

  recordedForecasts.add(matchId);
  let saved = false;
  try {
    await saveGeneratedAsset({
      kind: FORECAST_KIND,
      page: "match",
      action: "provider_council_forecast",
      label: `Pronostics API avant match ${matchId}`,
      source: "provider-council",
      relatedId: matchId,
      asset: {
        matchId,
        teamHome: String(match.teamHome || ""),
        teamAway: String(match.teamAway || ""),
        league: String(match.league || ""),
        kickoffAt: new Date(kickoff * 1000).toISOString(),
        generatedAt: council.generatedAt || new Date().toISOString(),
        providers: (Array.isArray(council.providers) ? council.providers : []).map((provider) => ({
          name: String(provider.name || "API"),
          status: String(provider.status || "unavailable"),
          error: String(provider.error || ""),
          latencyMs: Number(provider.latencyMs || 0),
          winnerPick: provider.winnerPick || null,
        })),
      },
    });
    saved = true;
    return true;
  } finally {
    if (!saved) recordedForecasts.delete(matchId);
  }
}

function resolveWinnerPick(selection, scoreHome, scoreAway) {
  if (selection === "home") return scoreHome > scoreAway ? "won" : "lost";
  if (selection === "draw") return scoreHome === scoreAway ? "won" : "lost";
  if (selection === "away") return scoreAway > scoreHome ? "won" : "lost";
  return "unknown";
}

async function resolveProviderCouncilForecasts(finishedMatches = []) {
  const [forecasts, priorResults] = await Promise.all([
    getGeneratedAssets(MAX_OBSERVATIONS, FORECAST_KIND),
    getGeneratedAssets(MAX_OBSERVATIONS, RESULT_KIND),
  ]);
  const resolvedIds = new Set(priorResults.map((item) => String(item.relatedId || item.asset?.matchId || "")));
  const finishedById = new Map(
    (Array.isArray(finishedMatches) ? finishedMatches : [])
      .map((match) => [matchIdOf(match), match])
      .filter(([matchId]) => Boolean(matchId))
  );
  let resolvedCount = 0;

  for (const forecast of forecasts) {
    const matchId = String(forecast.relatedId || forecast.asset?.matchId || "");
    if (!matchId || resolvedIds.has(matchId)) continue;
    const finished = finishedById.get(matchId);
    if (!finished) continue;
    const rawScoreHome = finished.scoreHome ?? finished.context?.score1;
    const rawScoreAway = finished.scoreAway ?? finished.context?.score2;
    if (rawScoreHome == null || rawScoreAway == null || rawScoreHome === "" || rawScoreAway === "") continue;
    const scoreHome = Number(rawScoreHome);
    const scoreAway = Number(rawScoreAway);
    if (!Number.isFinite(scoreHome) || !Number.isFinite(scoreAway)) continue;

    const providers = (Array.isArray(forecast.asset?.providers) ? forecast.asset.providers : []).map((provider) => ({
      name: provider.name,
      status: provider.status,
      latencyMs: provider.latencyMs,
      selection: provider.winnerPick?.selection || null,
      probability: provider.winnerPick?.probability ?? null,
      outcome: resolveWinnerPick(provider.winnerPick?.selection, scoreHome, scoreAway),
    }));
    await saveGeneratedAsset({
      kind: RESULT_KIND,
      page: "system",
      action: "resolve_provider_council_forecast",
      label: `Résultat des pronostics API ${matchId}`,
      source: "provider-council",
      relatedId: matchId,
      asset: {
        matchId,
        teamHome: forecast.asset?.teamHome || finished.teamHome || "",
        teamAway: forecast.asset?.teamAway || finished.teamAway || "",
        league: forecast.asset?.league || finished.league || "",
        scoreHome,
        scoreAway,
        kickoffAt: forecast.asset?.kickoffAt || null,
        generatedAt: forecast.asset?.generatedAt || forecast.createdAt || null,
        resolvedAt: new Date().toISOString(),
        providers,
      },
    });
    resolvedIds.add(matchId);
    resolvedCount += 1;
  }
  return { resolved: resolvedCount };
}

async function getProviderCouncilQuality() {
  const [forecasts, results] = await Promise.all([
    getGeneratedAssets(MAX_OBSERVATIONS, FORECAST_KIND),
    getGeneratedAssets(MAX_OBSERVATIONS, RESULT_KIND),
  ]);
  const latestByMatch = new Map();
  for (const forecast of forecasts) {
    const matchId = String(forecast.relatedId || forecast.asset?.matchId || "");
    if (matchId && !latestByMatch.has(matchId)) latestByMatch.set(matchId, forecast);
  }
  const resultByMatch = new Map();
  for (const result of results) {
    const matchId = String(result.relatedId || result.asset?.matchId || "");
    if (matchId && !resultByMatch.has(matchId)) resultByMatch.set(matchId, result);
  }

  const stats = new Map();
  const ensure = (name) => {
    if (!stats.has(name)) stats.set(name, {
      name,
      forecasts: 0,
      apiResponses: 0,
      unavailable: 0,
      failures: 0,
      latencyTotalMs: 0,
      latencySamples: 0,
      wins: 0,
      losses: 0,
    });
    return stats.get(name);
  };

  for (const forecast of latestByMatch.values()) {
    for (const provider of forecast.asset?.providers || []) {
      const row = ensure(provider.name || "API");
      row.forecasts += 1;
      if (provider.status === "ok" || provider.status === "no_markets") row.apiResponses += 1;
      else row.unavailable += 1;
      if (provider.error) row.failures += 1;
      if (Number.isFinite(Number(provider.latencyMs))) {
        row.latencyTotalMs += Number(provider.latencyMs);
        row.latencySamples += 1;
      }
    }
  }
  for (const result of resultByMatch.values()) {
    for (const provider of result.asset?.providers || []) {
      const row = ensure(provider.name || "API");
      if (provider.outcome === "won") row.wins += 1;
      else if (provider.outcome === "lost") row.losses += 1;
    }
  }

  const providers = [...stats.values()].map((row) => {
    const resolved = row.wins + row.losses;
    return {
      name: row.name,
      forecastCount: row.forecasts,
      resolvedCount: resolved,
      wins: row.wins,
      losses: row.losses,
      accuracyPct: resolved ? Number(((row.wins / resolved) * 100).toFixed(1)) : null,
      availabilityPct: row.forecasts ? Number(((row.apiResponses / row.forecasts) * 100).toFixed(1)) : null,
      averageLatencyMs: row.latencySamples ? Math.round(row.latencyTotalMs / row.latencySamples) : null,
      errorCount: row.failures,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    sampleMatches: latestByMatch.size,
    resolvedMatches: resultByMatch.size,
    providers,
    note: "La précision compare les pronostics 1X2 enregistrés avant le coup d’envoi aux scores terminés.",
  };
}

module.exports = {
  getProviderCouncilQuality,
  recordProviderCouncilForecast,
  resolveProviderCouncilForecasts,
};
