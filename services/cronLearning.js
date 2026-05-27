const { getPenaltyMatches, getMatchPredictionDetails } = require("./liveFeed");
const { saveGeneratedAsset } = require("./db");

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFinishedMatch(match = {}) {
  const statusCode = Number(match?.statusCode || 0);
  const statusText = normalizeText(match?.statusText || match?.status || "");
  const phase = normalizeText(match?.phase || "");
  if (statusCode === 3) return true;
  if (statusText.includes("termine")) return true;
  if (phase.includes("termine")) return true;
  return false;
}

function classifyOutcome({ selected, scoreHome, scoreAway }) {
  const pick = normalizeText(selected);
  const totalGoals = Number(scoreHome || 0) + Number(scoreAway || 0);

  if (!pick) return { state: "unknown", reason: "missing_prediction" };

  if (pick.includes("1x")) return { state: scoreHome >= scoreAway ? "won" : "lost", reason: "double_chance_1x" };
  if (pick.includes("x2")) return { state: scoreAway >= scoreHome ? "won" : "lost", reason: "double_chance_x2" };
  if (pick.includes("12")) return { state: scoreHome !== scoreAway ? "won" : "lost", reason: "double_chance_12" };
  if (pick === "x" || pick.includes("nul")) return { state: scoreHome === scoreAway ? "won" : "lost", reason: "draw" };
  if (pick.startsWith("1") || pick.includes("victoire domicile") || pick.includes("home")) {
    return { state: scoreHome > scoreAway ? "won" : "lost", reason: "home_win" };
  }
  if (pick.startsWith("2") || pick.includes("victoire exter") || pick.includes("away")) {
    return { state: scoreAway > scoreHome ? "won" : "lost", reason: "away_win" };
  }

  const over = pick.match(/(?:plus de|over)\s*(\d+(?:[.,]\d+)?)/);
  if (over) return { state: totalGoals > Number(over[1].replace(",", ".")) ? "won" : "lost", reason: "over_total" };
  const under = pick.match(/(?:moins de|under)\s*(\d+(?:[.,]\d+)?)/);
  if (under) return { state: totalGoals < Number(under[1].replace(",", ".")) ? "won" : "lost", reason: "under_total" };

  return { state: "unknown", reason: "unsupported_market" };
}

function summarizeBy(rows = [], keySelector = () => "unknown") {
  const buckets = new Map();
  for (const row of rows) {
    const key = keySelector(row) || "unknown";
    if (!buckets.has(key)) buckets.set(key, { key, total: 0, won: 0, lost: 0, unknown: 0 });
    const bucket = buckets.get(key);
    bucket.total += 1;
    if (row.outcome.state === "won") bucket.won += 1;
    else if (row.outcome.state === "lost") bucket.lost += 1;
    else bucket.unknown += 1;
  }
  return Array.from(buckets.values())
    .map((entry) => ({
      ...entry,
      winRate: entry.won + entry.lost > 0 ? Number(((entry.won / (entry.won + entry.lost)) * 100).toFixed(2)) : null,
    }))
    .sort((a, b) => b.total - a.total || String(a.key).localeCompare(String(b.key)));
}

async function buildLearningRows(limit = 300) {
  const payload = await getPenaltyMatches();
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const statusCounts = matches.reduce((acc, match) => {
    const key = isFinishedMatch(match)
      ? "finished"
      : normalizeText(match?.statusText || match?.status || match?.phase || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const finished = matches.filter((match) => isFinishedMatch(match)).slice(0, limit);

  const rows = [];
  for (const match of finished) {
    try {
      const details = await getMatchPredictionDetails(match.id);
      const resolved = details?.match || match;
      const prediction = details?.prediction || {};
      const selected =
        prediction?.maitre?.decision_finale?.pari_choisi ||
        prediction?.decision_consensus?.primary?.pari ||
        prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari ||
        "";
      const scoreHome = Number(resolved?.scoreHome ?? resolved?.context?.score1 ?? 0) || 0;
      const scoreAway = Number(resolved?.scoreAway ?? resolved?.context?.score2 ?? 0) || 0;
      rows.push({
        matchId: String(resolved?.id || match.id || ""),
        league: String(resolved?.league || "unknown"),
        market: selected || null,
        confidence:
          Number(
            prediction?.maitre?.decision_finale?.confiance_numerique ??
              prediction?.decision_consensus?.primary?.confidence ??
              0
          ) || 0,
        outcome: classifyOutcome({ selected, scoreHome, scoreAway }),
      });
    } catch (_error) {
      continue;
    }
  }
  return {
    rows,
    diagnostics: {
      fetchedAt: payload?.fetchedAt || new Date().toISOString(),
      filterMode: payload?.filterMode || "unknown",
      totalFromFeed: matches.length,
      finishedInFeed: finished.length,
      statusCounts,
      sampleFinishedMatchIds: finished.slice(0, 10).map((m) => String(m?.id || "")),
      sampleStatuses: matches.slice(0, 12).map((m) => ({
        id: m?.id || null,
        status: m?.status || null,
        statusText: m?.statusText || null,
        phase: m?.phase || null,
        statusCode: m?.statusCode ?? null,
      })),
    },
  };
}

function buildReport(rows = []) {
  const resolved = rows.filter((row) => row.outcome.state === "won" || row.outcome.state === "lost");
  const won = resolved.filter((row) => row.outcome.state === "won").length;
  const lost = resolved.filter((row) => row.outcome.state === "lost").length;

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      analysedMatches: rows.length,
      resolvedPredictions: resolved.length,
      won,
      lost,
      globalWinRate: resolved.length ? Number(((won / resolved.length) * 100).toFixed(2)) : null,
    },
    byLeague: summarizeBy(resolved, (row) => row.league),
    byMarket: summarizeBy(resolved, (row) => row.market || "unknown"),
    recentResolved: resolved.slice(0, 20),
  };
}

async function runLearningCron({ dryRun = false, debug = false } = {}) {
  const { rows, diagnostics } = await buildLearningRows(300);
  const report = buildReport(rows);

  if (!dryRun) {
    await saveGeneratedAsset({
      kind: "cron_report",
      page: "system",
      action: "cron_learn",
      label: `Cron learning ${report.generatedAt}`,
      format: "json",
      mimeType: "application/json",
      source: "cron-job.org",
      relatedId: "cron_learn",
      asset: {
        ...report,
        scope: "mixed-penalty-regular",
        diagnostics,
      },
    });
  }

  return {
    ok: true,
    dryRun,
    report: {
      ...report,
      scope: "mixed-penalty-regular",
      diagnostics: debug ? diagnostics : undefined,
    },
  };
}

module.exports = {
  runLearningCron,
};
