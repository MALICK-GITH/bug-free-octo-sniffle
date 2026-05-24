const followGrid = document.getElementById("followGrid");
const followStats = document.getElementById("followStats");
const followSubtitle = document.getElementById("followSubtitle");
const refreshFollowBtn = document.getElementById("refreshFollowBtn");

const WATCHLIST_USER_KEY = "fc25_watchlist_user_v1";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "Date inconnue";
  const raw = Number(value);
  const date =
    Number.isFinite(raw) && String(value).trim() !== "" && !String(value).includes("T")
      ? new Date(raw > 1e12 ? raw : raw * 1000)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return dateFormatter.format(date);
}

function getWatchlistUserId() {
  let userId = localStorage.getItem(WATCHLIST_USER_KEY);
  if (userId) return userId;
  const fallback =
    (window.crypto && typeof window.crypto.randomUUID === "function"
      ? `guest-${window.crypto.randomUUID()}`
      : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  localStorage.setItem(WATCHLIST_USER_KEY, fallback);
  return fallback;
}

function extractScore(match = {}) {
  const source = match?.score || match?.context || match || {};
  const home = Number(
    source.S1 ??
      source.score1 ??
      source.scoreHome ??
      source.homeScore ??
      source.H ??
      source.Home ??
      source.score_home ??
      0
  ) || 0;
  const away = Number(
    source.S2 ??
      source.score2 ??
      source.scoreAway ??
      source.awayScore ??
      source.A ??
      source.Away ??
      source.score_away ??
      0
  ) || 0;
  return { home, away };
}

function formatScore(score) {
  return `${Number(score?.home || 0)} - ${Number(score?.away || 0)}`;
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyMatchStatus(match = {}) {
  const statusText = normalizeText(match?.statusText || "");
  const phase = normalizeText(match?.phase || "");
  const statusCode = Number(match?.statusCode || 0);
  if (statusCode === 3 || statusText.includes("termine") || phase.includes("termine")) return "finished";
  if (statusCode === 128 || statusText.includes("debut dans")) return "upcoming";
  if (statusText.includes("minute") || phase.includes("mi temps") || Number(match?.context?.minute || 0) > 0) {
    return "live";
  }
  return "live";
}

function applyScoreHistoryFallback(match = {}, historyLatest = null) {
  if (!historyLatest || typeof historyLatest !== "object") return match;
  const historyScore = {
    home: Number(historyLatest.scoreHome ?? historyLatest.score_home ?? 0) || 0,
    away: Number(historyLatest.scoreAway ?? historyLatest.score_away ?? 0) || 0,
  };
  const matchScore = extractScore(match);
  const shouldReplace =
    historyScore.home !== matchScore.home ||
    historyScore.away !== matchScore.away ||
    (Number(historyLatest.minute || 0) > Number(match?.context?.minute || 0));

  if (!shouldReplace) return match;

  return {
    ...match,
    scoreHome: historyScore.home,
    scoreAway: historyScore.away,
    score: {
      ...(match?.score || {}),
      S1: historyScore.home,
      S2: historyScore.away,
      score1: historyScore.home,
      score2: historyScore.away,
      scoreHome: historyScore.home,
      scoreAway: historyScore.away,
    },
    context: {
      ...(match?.context || {}),
      score1: historyScore.home,
      score2: historyScore.away,
      minute: Number(historyLatest.minute || match?.context?.minute || 0) || 0,
    },
    statusText: historyLatest.status === "finished" ? "Terminé" : historyLatest.status || match?.statusText || "",
    phase: historyLatest.status === "finished" ? "Terminé" : historyLatest.status || match?.phase || "",
    statusCode: historyLatest.status === "finished" ? 3 : match?.statusCode || 0,
    updatedAt: historyLatest.createdAt || historyLatest.created_at || match?.updatedAt || null,
  };
}

async function fetchMatchHistory(matchId) {
  try {
    const response = await fetch(`/api/match/${encodeURIComponent(matchId)}/history?limit=20`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error?.message || payload?.message || "Historique indisponible");
    }
    return payload;
  } catch (_error) {
    return null;
  }
}

function evaluateOutcome(details = {}) {
  const match = details?.match || {};
  const prediction = details?.prediction || {};
  const master = prediction?.maitre?.decision_finale || {};
  const selected = normalizeText(master?.pari_choisi || prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari || "");
  const status = classifyMatchStatus(match);
  const score = extractScore(match);
  const totalGoals = score.home + score.away;

  if (status !== "finished") {
    return {
      state: "pending",
      label: "En cours",
      tone: "warn",
      reason: "Le match n'est pas encore termine.",
    };
  }

  const isWon = (() => {
    if (!selected) return null;
    if (selected.includes("1x")) return score.home >= score.away;
    if (selected.includes("x2")) return score.away >= score.home;
    if (selected.includes("12")) return score.home !== score.away;
    if (selected === "x" || selected.includes("nul")) return score.home === score.away;
    if (selected.startsWith("1") || selected.includes("victoire domicile") || selected.includes("home")) {
      return score.home > score.away;
    }
    if (selected.startsWith("2") || selected.includes("victoire exter") || selected.includes("away")) {
      return score.away > score.home;
    }

    const over = selected.match(/(?:plus de|over)\s*(\d+(?:[.,]\d+)?)/);
    if (over) return totalGoals > Number(over[1].replace(",", "."));
    const under = selected.match(/(?:moins de|under)\s*(\d+(?:[.,]\d+)?)/);
    if (under) return totalGoals < Number(under[1].replace(",", "."));
    return null;
  })();

  if (isWon === true) {
    return {
      state: "won",
      label: "Validee",
      tone: "good",
      reason: "La prediction correspond au score final.",
    };
  }

  if (isWon === false) {
    return {
      state: "lost",
      label: "Perdante",
      tone: "bad",
      reason: "Le score final ne valide pas la prediction.",
    };
  }

  return {
    state: "unknown",
    label: "Termine",
    tone: "warn",
    reason: "Impossible de determiner automatiquement le resultat.",
  };
}

async function fetchWatchlist() {
  const userId = getWatchlistUserId();
  const localIds = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("fc25_watchlist_v1") || "[]");
      return Array.isArray(raw) ? raw.map((id) => String(id)) : [];
    } catch {
      return [];
    }
  })();
  const localSnapshot = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("fc25_watchlist_snapshot_v1") || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  })();

  const response = await fetch(`/api/watchlist?userId=${encodeURIComponent(userId)}&limit=200`, {
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || payload?.message || "Watchlist indisponible");
  }

  const serverIds = Array.isArray(payload?.data?.watchlist) ? payload.data.watchlist.map((id) => String(id)) : [];
  const serverSnapshot = payload?.data?.snapshot && typeof payload.data.snapshot === "object" ? payload.data.snapshot : {};
  if (!serverIds.length && localIds.length) {
    void fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        matchIds: localIds,
        snapshot: localSnapshot,
      }),
    }).catch(() => null);
  }

  return {
    userId,
    ids: serverIds.length ? serverIds : localIds,
    snapshot: Object.keys(serverSnapshot).length ? serverSnapshot : localSnapshot,
    updatedAt: payload?.data?.updatedAt || null,
  };
}

async function fetchMatchDetails(matchId) {
  try {
    const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/details`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message || "Details indisponibles");
    return payload;
  } catch (_error) {
    return null;
  }
}

function renderStats(items = []) {
  const total = items.length;
  const live = items.filter((item) => item.status === "live").length;
  const finished = items.filter((item) => item.status === "finished").length;
  const validated = items.filter((item) => item.outcome.state === "won").length;

  followStats.innerHTML = `
    <article class="follow-stat">
      <span>Suivis</span>
      <strong>${total}</strong>
      <em>Matchs dans la watchlist</em>
    </article>
    <article class="follow-stat">
      <span>En direct</span>
      <strong>${live}</strong>
      <em>Matchs deja lances</em>
    </article>
    <article class="follow-stat">
      <span>Termines</span>
      <strong>${finished}</strong>
      <em>Matchs arrives au score final</em>
    </article>
    <article class="follow-stat">
      <span>Valides</span>
      <strong>${validated}</strong>
      <em>Predictions gagnantes</em>
    </article>
  `;
}

function renderEmpty(message) {
  followGrid.innerHTML = `<article class="follow-empty">${escapeHtml(message)}</article>`;
}

function renderCard(item) {
  const score = formatScore(item.score);
  const outcome = item.outcome;
  const prediction = item.predictionLabel || "Prediction indisponible";
  const statusTone = outcome.tone || "warn";
  const statusLabel = outcome.label || "En attente";
  const statusReason = outcome.reason || "";
  const detailUrl = `/match.html?id=${encodeURIComponent(item.matchId)}`;

  return `
    <article class="follow-card">
      <div class="follow-card-head">
        <div>
          <h3 class="follow-card-title">${escapeHtml(item.homeTeam)} vs ${escapeHtml(item.awayTeam)}</h3>
          <div class="follow-card-meta">
            <span class="follow-chip">${escapeHtml(item.league || "Ligue virtuelle")}</span>
            <span class="follow-chip ${statusTone}">${escapeHtml(statusLabel)}</span>
          </div>
        </div>
        <span class="follow-chip">${escapeHtml(formatDate(item.updatedAt || item.createdAt || item.startTimeUnix || null))}</span>
      </div>

      <div class="follow-chip-row">
        <span class="follow-chip">${escapeHtml(item.statusText || item.phase || item.status || "Statut inconnu")}</span>
        <span class="follow-chip">${escapeHtml(score)}</span>
        <span class="follow-chip">${escapeHtml(prediction)}</span>
      </div>

      <div>
        <p class="follow-section-title">Lecture du suivi</p>
        <ul class="follow-list">
          <li>Score actuel ou final: <strong>${escapeHtml(score)}</strong></li>
          <li>Etat de validation: <strong>${escapeHtml(statusLabel)}</strong></li>
          <li>${escapeHtml(statusReason)}</li>
        </ul>
      </div>

      <div class="follow-result-row">
        <a class="follow-btn" href="${detailUrl}">Ouvrir le detail</a>
        <button type="button" class="follow-btn follow-btn-secondary" data-remove-follow="${escapeHtml(item.matchId)}">Retirer du suivi</button>
      </div>
    </article>
  `;
}

async function removeFollow(matchId) {
  const userId = getWatchlistUserId();
  const response = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      removeMatchId: matchId,
      snapshot: {},
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || payload?.message || "Suppression impossible");
  }

  try {
    const ids = JSON.parse(localStorage.getItem("fc25_watchlist_v1") || "[]");
    if (Array.isArray(ids)) {
      localStorage.setItem("fc25_watchlist_v1", JSON.stringify(ids.filter((id) => String(id) !== String(matchId))));
    }
    const snapshots = JSON.parse(localStorage.getItem("fc25_watchlist_snapshot_v1") || "{}");
    if (snapshots && typeof snapshots === "object") {
      delete snapshots[String(matchId)];
      localStorage.setItem("fc25_watchlist_snapshot_v1", JSON.stringify(snapshots));
    }
  } catch {
    // Local cache is best-effort only.
  }
}

async function loadFollowData() {
  followSubtitle.textContent = "Chargement de la watchlist depuis la base...";
  refreshFollowBtn.disabled = true;

  try {
    const watchlist = await fetchWatchlist();
    const items = await Promise.all(
      watchlist.ids.map(async (matchId) => {
        const details = await fetchMatchDetails(matchId);
        const history = await fetchMatchHistory(matchId);
        const fallback = watchlist.snapshot?.[matchId] || {};
        const historyLatest = history?.data?.latest || history?.latest || history?.data?.history?.[0] || null;
        const match = applyScoreHistoryFallback(details?.match || {}, historyLatest);
        const prediction = details?.prediction || {};
        const status =
          historyLatest?.status === "finished"
            ? "finished"
            : classifyMatchStatus(historyLatest ? { ...match, statusText: historyLatest.status || match.statusText } : match);
        const score = extractScore(match);
        const historyScore = historyLatest ? {
          home: Number(historyLatest.scoreHome ?? historyLatest.score_home ?? 0) || 0,
          away: Number(historyLatest.scoreAway ?? historyLatest.score_away ?? 0) || 0,
        } : null;
        const displayScore =
          historyScore && (historyScore.home !== score.home || historyScore.away !== score.away)
            ? historyScore
            : score;
        return {
          matchId,
          homeTeam: match.teamHome || fallback.teamHome || fallback.homeTeam || "Match suivi",
          awayTeam: match.teamAway || fallback.teamAway || fallback.awayTeam || "",
          league: match.league || fallback.league || "Ligue virtuelle",
          status,
          statusText: match.statusText || fallback.statusText || "",
          phase: match.phase || fallback.phase || "",
          updatedAt: details?.meta?.timestamp || fallback.updatedAt || null,
          createdAt: fallback.createdAt || null,
          score: displayScore,
          predictionLabel:
            prediction?.maitre?.decision_finale?.pari_choisi ||
            prediction?.analyse_avancee?.top_3_recommandations?.[0]?.pari ||
            fallback.predictionLabel ||
            "",
          outcome: evaluateOutcome({
            match,
            prediction,
          }),
        };
      })
    );

    renderStats(items);

    if (!items.length) {
      renderEmpty("Aucun match suivi pour le moment. Retourne sur l'accueil et clique sur 'Suivre' sur une carte.");
      followSubtitle.textContent = "Aucun suivi sauvegarde pour ce profil.";
      return;
    }

    followGrid.innerHTML = items.map(renderCard).join("");
    followSubtitle.textContent = `${items.length} match(s) suivi(s) depuis la base`;

    followGrid.querySelectorAll("[data-remove-follow]").forEach((button) => {
      button.addEventListener("click", async () => {
        const matchId = button.getAttribute("data-remove-follow") || "";
        button.disabled = true;
        try {
          await removeFollow(matchId);
          await loadFollowData();
        } catch (error) {
          followSubtitle.textContent = `Impossible de retirer le match: ${error.message}`;
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    renderStats([]);
    renderEmpty(`Impossible de charger le suivi: ${error.message}`);
    followSubtitle.textContent = "Echec du chargement du suivi.";
  } finally {
    refreshFollowBtn.disabled = false;
  }
}

refreshFollowBtn?.addEventListener("click", () => {
  loadFollowData().catch(() => null);
});

loadFollowData().catch(() => null);
