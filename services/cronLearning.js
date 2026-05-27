const { getTrackedMatches, saveGeneratedAsset } = require("./db");

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyPredictionOutcome(match = {}) {
  const prediction = match?.prediction || {};
  const master = prediction?.maitre?.decision_finale || {};
  const selected = normalizeText(
    master?.pari_choisi ||
      prediction?.decision_consensus?.primary?.pari ||
      prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari ||
      ""
  );
  const status = normalizeText(match?.status || "");
  const scoreHome = Number(match?.scoreHome ?? 0) || 0;
  const scoreAway = Number(match?.scoreAway ?? 0) || 0;
  const totalGoals = scoreHome + scoreAway;

  if (status !== "finished" && status !== "termine") {
    return {
      state: "pending",
      reason: "match_not_finished",
      selected,
    };
  }

  if (!selected) {
    return {
      state: "unknown",
      reason: "missing_prediction",
      selected,
    };
  }

  if (selected.includes("1x")) {
    return { state: scoreHome >= scoreAway ? "won" : "lost", reason: "double_chance_1x", selected };
  }
  if (selected.includes("x2")) {
    return { state: scoreAway >= scoreHome ? "won" : "lost", reason: "double_chance_x2", selected };
  }
  if (selected.includes("12")) {
    return { state: scoreHome !== scoreAway ? "won" : "lost", reason: "double_chance_12", selected };
  }
  if (selected === "x" || selected.includes("nul")) {
    return { state: scoreHome === scoreAway ? "won" : "lost", reason: "draw", selected };
  }
  if (selected.startsWith("1") || selected.includes("victoire domicile") || selected.includes("home")) {
    return { state: scoreHome > scoreAway ? "won" : "lost", reason: "home_win", selected };
  }
  if (selected.startsWith("2") || selected.includes("victoire exter") || selected.includes("away")) {
    return { state: scoreAway > scoreHome ? "won" : "lost", reason: "away_win", selected };
  }

  const over = selected.match(/(?:plus de|over)\s*(\d+(?:[.,]\d+)?)/);
  if (over) {
    return {
      state: totalGoals > Number(over[1].replace(",", ".")) ? "won" : "lost",
      reason: "over_total",
      selected,
    };
  }

  const under = selected.match(/(?:moins de|under)\s*(\d+(?:[.,]\d+)?)/);
  if (under) {
    return {
      state: totalGoals < Number(under[1].replace(",", ".")) ? "won" : "lost",
      reason: "under_total",
      selected,
    };
  }

  return {
    state: "unknown",
    reason: "unsupported_market",
    selected,
  };
}

function groupSummary(rows = [], keyFn = () => "unknown") {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) {
      map.set(key, { key, total: 0, won: 0, lost: 0, unknown: 0 });
    }
    const bucket = map.get(key);
    bucket.total += 1;
    if (row.outcome.state === "won") bucket.won += 1;
    else if (row.outcome.state === "lost") bucket.lost += 1;
    else bucket.unknown += 1;
  }
  return Array.from(map.values())
    .map((item) => ({
      ...item,
      winRate: item.won + item.lost > 0 ? Number(((item.won / (item.won + item.lost)) * 100).toFixed(2)) : null,
    }))
    .sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
}

function computeLearningReport(matches = []) {
  const analysed = matches.map((match) => ({
    matchId: match.matchId,
    league: String(match.league || "unknown").trim() || "unknown",
    status: String(match.status || "").trim().toLowerCase(),
    confidence:
      Number(
        match?.prediction?.maitre?.decision_finale?.confiance_numerique ??
          match?.prediction?.decision_consensus?.primary?.confidence ??
          0
      ) || 0,
    market:
      match?.prediction?.maitre?.decision_finale?.pari_choisi ||
      match?.prediction?.decision_consensus?.primary?.pari ||
      null,
    outcome: classifyPredictionOutcome(match),
  }));

  const finished = analysed.filter((row) => row.status === "finished" || row.status === "termine");
  const resolved = finished.filter((row) => row.outcome.state === "won" || row.outcome.state === "lost");
  const won = resolved.filter((row) => row.outcome.state === "won").length;
  const lost = resolved.filter((row) => row.outcome.state === "lost").length;

  const highConfidence = resolved.filter((row) => row.confidence >= 75);
  const highConfidenceWon = highConfidence.filter((row) => row.outcome.state === "won").length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      trackedMatches: analysed.length,
      finishedMatches: finished.length,
      resolvedPredictions: resolved.length,
      won,
      lost,
      pending: analysed.length - finished.length,
      unresolved: finished.length - resolved.length,
      globalWinRate: resolved.length ? Number(((won / resolved.length) * 100).toFixed(2)) : null,
      highConfidenceCount: highConfidence.length,
      highConfidenceWinRate:
        highConfidence.length ? Number(((highConfidenceWon / highConfidence.length) * 100).toFixed(2)) : null,
    },
    byLeague: groupSummary(resolved, (row) => row.league),
    byMarket: groupSummary(resolved, (row) => row.market || "unknown"),
    recentResolved: resolved.slice(0, 20).map((row) => ({
      matchId: row.matchId,
      league: row.league,
      market: row.market,
      confidence: row.confidence,
      outcome: row.outcome.state,
      reason: row.outcome.reason,
    })),
  };
}

async function runLearningCron({ dryRun = false } = {}) {
  const trackedMatches = await getTrackedMatches(500);
  const report = computeLearningReport(trackedMatches);

  if (!dryRun) {
    await saveGeneratedAsset({
      kind: "cron_report",
      page: "system",
      action: "cron_learn",
      label: `Cron learning ${report.generatedAt}`,
      fileName: null,
      format: "json",
      mimeType: "application/json",
      source: "cron-job.org",
      relatedId: "cron_learn",
      asset: report,
    });
  }

  return {
    ok: true,
    dryRun,
    report,
  };
}

module.exports = {
  runLearningCron,
};
