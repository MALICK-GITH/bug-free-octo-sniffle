let allMatches = [];
let currentModeLabel = "";
let currentMatchMode = "upcoming";
const previousOddsByMatch = new Map();
const STRONG_ODD_CHANGE_PERCENT = 9;
const ODD_ALERT_COOLDOWN_MS = 90 * 1000;
const oddAlertLastShown = new Map();
const LOW_DATA_MODE_KEY = "fc25_low_data_mode_v1";
const WATCHLIST_KEY = "fc25_watchlist_v1";
const WATCHLIST_SNAPSHOT_KEY = "fc25_watchlist_snapshot_v1";
const TEAM_LOGO_CACHE_KEY = "fc25_team_logo_cache_v1";
const TEAM_LOGO_API_URL = "https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=";
const FRONTEND_VERSION = "2026.03.30-r3";
let lastFetchedAt = null;
const WELCOME_MODAL_KEY = "fc25_welcome_modal_v1";
const DENICHEUR_HISTORY_KEY = "fc25_denicheur_history_v1";
const DENICHEUR_FULL_OPTION_KEY = "fc25_denicheur_full_option_v1";
let denicheurPreviousFocus = null;
let denicheurBodyScrollY = 0;
const teamLogoMemoryCache = new Map();
let lastLoadRequestId = 0;

const TEAM_NAME_ALIASES = {
  "barcelone": "Barcelona",
  "manchester city": "Manchester City",
  "manchester united": "Manchester United",
  "bayern munich": "Bayern Munich",
  "bayern munchen": "Bayern Munich",
  "paris sg": "Paris Saint-Germain",
  "psg": "Paris Saint-Germain",
  "inter": "Inter",
  "milano": "Inter",
  "milan": "AC Milan",
  "naples": "Napoli",
  "atletico madrid": "Atletico Madrid",
  "real madrid cf": "Real Madrid",
  "west ham united": "West Ham United",
  "brighton et hove albion": "Brighton",
  "wolverhampton wanderers": "Wolverhampton Wanderers",
  "as monaco": "Monaco",
};

function siteLog(level, message, meta) {
  if (!window.SiteLogger || typeof window.SiteLogger[level] !== "function") return;
  window.SiteLogger[level](message, meta);
}

function shouldLockDenicheurScroll() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function lockDenicheurBackgroundScroll() {
  if (!shouldLockDenicheurScroll()) return;
  if (document.body.classList.contains("denicheur-scroll-locked")) return;
  denicheurBodyScrollY = window.scrollY || window.pageYOffset || 0;
  document.body.classList.add("denicheur-scroll-locked");
  document.body.style.position = "fixed";
  document.body.style.top = `-${denicheurBodyScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockDenicheurBackgroundScroll() {
  if (!document.body.classList.contains("denicheur-scroll-locked")) return;
  document.body.classList.remove("denicheur-scroll-locked");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, denicheurBodyScrollY);
}

function formatTime(unixSeconds) {
  if (!unixSeconds) return "Heure non disponible";
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatOdd(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function scoreText(score) {
  if (!score || typeof score !== "object" || Object.keys(score).length === 0) return "Score: -";
  const h = score.S1 ?? score.SA ?? score.H ?? score.Home ?? "?";
  const a = score.S2 ?? score.SB ?? score.A ?? score.Away ?? "?";
  return `Score: ${h}-${a}`;
}

function extractScore(score) {
  if (!score || typeof score !== "object") return { home: "?", away: "?" };
  const home = score.S1 ?? score.SA ?? score.H ?? score.Home ?? "?";
  const away = score.S2 ?? score.SB ?? score.A ?? score.Away ?? "?";
  return { home, away };
}

function teamBadge(name) {
  const clean = String(name || "").trim();
  if (!clean) return "??";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTeamLookupKey(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getCanonicalTeamName(name) {
  const key = normalizeTeamLookupKey(name);
  return TEAM_NAME_ALIASES[key] || String(name || "").trim();
}

function readTeamLogoCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAM_LOGO_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function saveTeamLogoCache(cache) {
  localStorage.setItem(TEAM_LOGO_CACHE_KEY, JSON.stringify(cache || {}));
}

function getCachedTeamLogo(name) {
  const key = normalizeTeamLookupKey(name);
  if (!key) return null;
  if (teamLogoMemoryCache.has(key)) return teamLogoMemoryCache.get(key);
  const disk = readTeamLogoCache();
  const value = disk[key] || null;
  if (value) teamLogoMemoryCache.set(key, value);
  return value;
}

function setCachedTeamLogo(name, url) {
  const key = normalizeTeamLookupKey(name);
  if (!key || !url) return;
  teamLogoMemoryCache.set(key, url);
  const disk = readTeamLogoCache();
  disk[key] = url;
  saveTeamLogoCache(disk);
}

function buildKnownTeamLogoMap(matches = []) {
  const map = new Map();
  (matches || []).forEach((match) => {
    const homeName = String(match?.teamHome || "").trim();
    const awayName = String(match?.teamAway || "").trim();
    const homeLogo = String(match?.teamHomeLogo || "").trim();
    const awayLogo = String(match?.teamAwayLogo || "").trim();
    if (homeName && homeLogo) map.set(normalizeTeamLookupKey(homeName), homeLogo);
    if (awayName && awayLogo) map.set(normalizeTeamLookupKey(awayName), awayLogo);
  });
  return map;
}

function getKnownTeamLogo(name, knownLogos = new Map()) {
  const key = normalizeTeamLookupKey(name);
  if (!key) return null;
  return knownLogos.get(key) || getCachedTeamLogo(name) || null;
}

function sanitizeMatchLogos(match, knownLogos = new Map()) {
  return {
    ...match,
    teamHomeLogo: getKnownTeamLogo(match?.teamHome, knownLogos),
    teamAwayLogo: getKnownTeamLogo(match?.teamAway, knownLogos),
  };
}

async function fetchDirectTeamLogo(teamName) {
  const cached = getCachedTeamLogo(teamName);
  if (cached) return cached;

  const canonicalName = getCanonicalTeamName(teamName);
  if (!canonicalName) return null;

  try {
    const response = await fetch(`${TEAM_LOGO_API_URL}${encodeURIComponent(canonicalName)}`, {
      cache: "force-cache",
    });
    if (!response.ok) return null;
    const data = await response.json();
    const teams = Array.isArray(data?.teams) ? data.teams : [];
    if (!teams.length) return null;

    const exactKey = normalizeTeamLookupKey(canonicalName);
    const exact = teams.find((team) => normalizeTeamLookupKey(team?.strTeam) === exactKey);
    const picked = exact || teams[0];
    const badge = String(picked?.strBadge || picked?.strTeamBadge || "").trim();
    if (!badge) return null;

    setCachedTeamLogo(teamName, badge);
    setCachedTeamLogo(canonicalName, badge);
    return badge;
  } catch (_error) {
    return null;
  }
}

async function hydrateDirectTeamLogos(matches = []) {
  const uniqueTeams = Array.from(
    new Set(
      (matches || [])
        .flatMap((match) => [match?.teamHome, match?.teamAway])
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    )
  );

  await Promise.all(
    uniqueTeams.map(async (teamName) => {
      const currentLogo = getCachedTeamLogo(teamName);
      if (currentLogo) {
        matches.forEach((match) => {
          if (String(match?.teamHome || "").trim() === teamName && !match.teamHomeLogo) {
            match.teamHomeLogo = currentLogo;
          }
          if (String(match?.teamAway || "").trim() === teamName && !match.teamAwayLogo) {
            match.teamAwayLogo = currentLogo;
          }
        });
        return;
      }
      const logoUrl = await fetchDirectTeamLogo(teamName);
      if (!logoUrl) return;
      matches.forEach((match) => {
        if (String(match?.teamHome || "").trim() === teamName) {
          match.teamHomeLogo = logoUrl;
        }
        if (String(match?.teamAway || "").trim() === teamName) {
          match.teamAwayLogo = logoUrl;
        }
      });
    })
  );
}

function createTeamLogo(name, logoUrl, fallbackUrl, isAway = false) {
  const fallback = teamBadge(name);
  const safeName = escapeHtml(name);
  const awayClass = isAway ? " away" : "";
  if (!logoUrl) {
    return `<div class="team-logo logo-fallback${awayClass}"><span class="team-logo-fallback">${fallback}</span></div>`;
  }
  const safeFallbackUrl = fallbackUrl ? ` data-fallback-src="${escapeHtml(fallbackUrl)}"` : "";
  return `
    <div class="team-logo${awayClass}">
      <img class="team-logo-img" src="${logoUrl}" alt="Logo ${safeName}" loading="lazy"${safeFallbackUrl} />
      <span class="team-logo-fallback">${fallback}</span>
    </div>
  `;
}

function createStat(title, value) {
  const el = document.createElement("article");
  el.className = "stat-box";
  el.innerHTML = `<small>${title}</small><strong>${value}</strong>`;
  return el;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isLowDataModeEnabled() {
  return localStorage.getItem(LOW_DATA_MODE_KEY) === "1";
}

function setLowDataMode(value) {
  localStorage.setItem(LOW_DATA_MODE_KEY, value ? "1" : "0");
  document.body.classList.toggle("low-data", Boolean(value));
}

function loadWatchlistIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
    return Array.isArray(raw) ? raw.map((id) => String(id)) : [];
  } catch (_error) {
    return [];
  }
}

function saveWatchlistIds(ids) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(Array.from(new Set((ids || []).map((id) => String(id))))));
}

function isInWatchlist(matchId) {
  return loadWatchlistIds().includes(String(matchId || ""));
}

function toggleWatchlist(matchId) {
  const id = String(matchId || "");
  if (!id) return false;
  const ids = loadWatchlistIds();
  const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
  saveWatchlistIds(next);
  return next.includes(id);
}

function readWatchlistSnapshots() {
  try {
    const parsed = JSON.parse(localStorage.getItem(WATCHLIST_SNAPSHOT_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function saveWatchlistSnapshots(snapshots) {
  localStorage.setItem(WATCHLIST_SNAPSHOT_KEY, JSON.stringify(snapshots || {}));
}

function matchTimelineLabel(match) {
  const mins = minutesToStart(match);
  if (mins < 0) return "En jeu";
  if (mins <= 10) return "Imminent";
  if (mins <= 45) return "Fenetre forte";
  if (mins <= 120) return "A surveiller";
  return "Plus tard";
}

function watchlistSignal(match) {
  const reliability = Number(match?.reliabilityScore || 0);
  const drifts = trendFlagCount(match);
  const mins = minutesToStart(match);
  if (reliability >= 78 && drifts === 0 && mins >= 0 && mins <= 45) return "Signal premium";
  if (reliability >= 68 && drifts <= 1) return "Signal stable";
  if (drifts >= 2) return "Marche nerveux";
  return "Suivi prudent";
}

function buildMatchVisualScores(match) {
  const quality = clamp(Math.round(Number(match?.reliabilityScore || 0)), 5, 99);
  const stability = clamp(
    Math.round(stabilityFromTrend(match?.trend) * 0.72 + depthScoreFromBets(match?.betsCount) * 0.28),
    5,
    99
  );
  const potential = clamp(Math.round(estimatedSuccessProbability(match) * 1.55 + 6), 5, 99);
  const mins = minutesToStart(match);
  const timing =
    mins < 0
      ? 52
      : mins <= 12
      ? 96
      : mins <= 45
      ? 88
      : mins <= 120
      ? 72
      : 58;
  return {
    quality,
    stability,
    potential,
    timing,
    overall: clamp(Math.round(quality * 0.36 + stability * 0.28 + potential * 0.22 + timing * 0.14), 5, 99),
  };
}

function metricTone(score) {
  if (score >= 80) return "high";
  if (score >= 62) return "mid";
  return "low";
}

function renderVisualScoreStrip(match) {
  const metrics = buildMatchVisualScores(match);
  const rows = [
    ["Qualite", metrics.quality],
    ["Stabilite", metrics.stability],
    ["Potentiel", metrics.potential],
    ["Timing", metrics.timing],
  ];
  return `
    <div class="visual-score-strip" aria-label="Lecture rapide du match">
      ${rows
        .map(
          ([label, value]) => `
            <article class="visual-score-card tone-${metricTone(value)}">
              <span>${label}</span>
              <strong>${value}</strong>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderFrontlineStatus() {
  const host = document.getElementById("frontlineUpdateStatus");
  const footerTag = document.getElementById("appVersionTag");
  if (footerTag) footerTag.textContent = `Version front ${FRONTEND_VERSION}`;
  if (!host) return;

  const storedVersion = localStorage.getItem("fc25_front_version_seen");
  const firstSeen = localStorage.getItem("fc25_front_version_first_seen");
  const isFreshVersion = storedVersion !== FRONTEND_VERSION;

  if (!firstSeen || isFreshVersion) {
    localStorage.setItem("fc25_front_version_first_seen", new Date().toISOString());
  }
  localStorage.setItem("fc25_front_version_seen", FRONTEND_VERSION);

  host.innerHTML = `
    <div class="frontline-update-card ${isFreshVersion ? "is-fresh" : ""}">
      <div class="frontline-update-copy">
        <p class="frontline-update-kicker">Versioning intelligent</p>
        <strong>Front ${FRONTEND_VERSION}</strong>
        <span>${isFreshVersion ? "Nouvelle version locale active. Si besoin, recharge une seule fois." : "Version synchronisee. Le site reste stable sur mobile et PC."}</span>
      </div>
      <button type="button" class="frontline-update-btn" id="frontlineReloadBtn">Verifier maintenant</button>
    </div>
  `;

  const btn = document.getElementById("frontlineReloadBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("fc25:manual-update-check"));
    });
  }
}

function renderWatchlistPanel(matches = []) {
  const host = document.getElementById("watchlistPanel");
  if (!host) return;

  const ids = loadWatchlistIds();
  if (!ids.length) {
    host.innerHTML = `
      <div class="watchlist-shell watchlist-empty">
        <div>
          <p class="watchlist-kicker">Watchlist intelligente</p>
          <h2>Surveille tes matchs forts</h2>
          <p>Ajoute une rencontre depuis une carte pour suivre sa stabilite, son timing et les alertes de drift sans quitter l'accueil.</p>
        </div>
      </div>
    `;
    return;
  }

  const rows = ids
    .map((id) => matches.find((match) => String(match?.id) === id))
    .filter(Boolean)
    .slice(0, 6);

  if (!rows.length) {
    host.innerHTML = `
      <div class="watchlist-shell watchlist-empty">
        <div>
          <p class="watchlist-kicker">Watchlist intelligente</p>
          <h2>Watchlist en attente</h2>
          <p>Les matchs suivis ne sont pas encore revenus dans le flux. Ils reapparaitront automatiquement des que l'API les remontera.</p>
        </div>
      </div>
    `;
    return;
  }

  host.innerHTML = `
    <div class="watchlist-shell">
      <div class="watchlist-head">
        <div>
          <p class="watchlist-kicker">Watchlist intelligente</p>
          <h2>Suivi prioritaire</h2>
          <p>Les matchs ajoutes ici remontent en premier quand la confiance baisse, quand le kickoff approche ou quand le marche devient instable.</p>
        </div>
        <span class="watchlist-count">${rows.length} suivi(s)</span>
      </div>
      <div class="watchlist-grid">
        ${rows
          .map((match) => {
            const metrics = buildMatchVisualScores(match);
            return `
              <article class="watchlist-card">
                <div class="watchlist-card-head">
                  <strong>${escapeHtml(match.teamHome)} vs ${escapeHtml(match.teamAway)}</strong>
                  <span>${escapeHtml(match.league || "Ligue virtuelle")}</span>
                </div>
                <div class="watchlist-mini-score">
                  <span>Indice ${metrics.overall}</span>
                  <span>${watchlistSignal(match)}</span>
                  <span>${matchTimelineLabel(match)}</span>
                </div>
                <div class="watchlist-actions">
                  <a class="watchlist-link" href="/match.html?id=${encodeURIComponent(match.id)}">Ouvrir le detail</a>
                  <button type="button" class="watchlist-remove-btn" data-watchlist-remove="${escapeHtml(match.id)}">Retirer</button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  host.querySelectorAll("[data-watchlist-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleWatchlist(button.getAttribute("data-watchlist-remove"));
      renderWatchlistPanel(allMatches);
      renderMatches();
    });
  });
}

function updateWatchlistAlerts(matches = []) {
  const ids = loadWatchlistIds();
  if (!ids.length) return;

  const previousSnapshots = readWatchlistSnapshots();
  const nextSnapshots = {};

  ids.forEach((id) => {
    const match = (matches || []).find((item) => String(item?.id) === id);
    const previous = previousSnapshots[id];
    if (!match) {
      if (previous) nextSnapshots[id] = previous;
      return;
    }

    const current = {
      home: normalizeOdd(match?.odds1x2?.home),
      draw: normalizeOdd(match?.odds1x2?.draw),
      away: normalizeOdd(match?.odds1x2?.away),
      reliability: Number(match?.reliabilityScore || 0),
      startTimeUnix: Number(match?.startTimeUnix || 0),
      updatedAt: Date.now(),
    };

    if (previous) {
      const homeChange = changePercent(previous.home, current.home);
      const reliabilityDrop = previous.reliability - current.reliability;
      const mins = minutesToStart(match);

      if (homeChange != null && homeChange >= STRONG_ODD_CHANGE_PERCENT) {
        pushOddAlert(`Watchlist: ${match.teamHome} vs ${match.teamAway} bouge fort sur le 1 (${homeChange.toFixed(1)}%).`);
      }
      if (reliabilityDrop >= 8) {
        pushOddAlert(`Watchlist: la confiance baisse sur ${match.teamHome} vs ${match.teamAway} (${current.reliability}%).`);
      }
      if (mins >= 0 && mins <= 10 && Number(previous.startTimeUnix || 0) !== current.startTimeUnix) {
        pushOddAlert(`Watchlist: ${match.teamHome} vs ${match.teamAway} entre dans la fenetre immediate.`);
      }
    }

    nextSnapshots[id] = current;
  });

  saveWatchlistSnapshots(nextSnapshots);
}

function initWelcomeModal() {
  const modal = document.getElementById("welcomeModal");
  if (!modal) return;
  const closeBtn = document.getElementById("welcomeClose");
  const hideToggle = document.getElementById("welcomeHide");
  const stored = localStorage.getItem(WELCOME_MODAL_KEY);
  if (stored === "hidden") return;
  modal.classList.remove("hidden");

  const close = () => {
    if (hideToggle?.checked) localStorage.setItem(WELCOME_MODAL_KEY, "hidden");
    modal.classList.add("hidden");
  };
  if (closeBtn) closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
}

function computeReliabilityScore(match) {
  const h = Number(match?.odds1x2?.home);
  const d = Number(match?.odds1x2?.draw);
  const a = Number(match?.odds1x2?.away);
  const hasOdds = [h, d, a].every((x) => Number.isFinite(x) && x > 1);

  let marketClarity = 45;
  if (hasOdds) {
    const ph = 1 / h;
    const pd = 1 / d;
    const pa = 1 / a;
    const total = ph + pd + pa;
    const maxProb = Math.max(ph, pd, pa) / total;
    marketClarity = maxProb * 100;
  }

  const trendFlags = ["home", "draw", "away"].filter((k) => match?.trend?.[k]).length;
  const volatilityPenalty = trendFlags * 7;
  const mode = classifyMatch(match);
  const statusBonus = mode === "upcoming" ? 8 : mode === "live" ? -6 : -14;

  const nowSec = Math.floor(Date.now() / 1000);
  const start = Number(match?.startTimeUnix || 0);
  const minsToStart = start > nowSec ? (start - nowSec) / 60 : -1;
  const timingBonus = minsToStart > 0 && minsToStart <= 45 ? 8 : minsToStart > 45 ? 4 : 0;

  const betCount = Number(match?.betsCount || 0);
  const marketDepth =
    betCount >= 60 ? 14 : betCount >= 40 ? 10 : betCount >= 25 ? 6 : betCount >= 10 ? 2 : -6;

  let freshness = 0;
  if (match?.fetchedAt) {
    const ageSec = Math.max(0, (Date.now() - Date.parse(match.fetchedAt)) / 1000);
    freshness =
      ageSec <= 30 ? 12 : ageSec <= 90 ? 8 : ageSec <= 180 ? 5 : ageSec <= 300 ? 2 : -6;
  }

  const oddsBonus = hasOdds ? 8 : -6;
  const raw =
    32 +
    marketClarity * 0.45 +
    timingBonus +
    statusBonus +
    marketDepth +
    freshness +
    oddsBonus -
    volatilityPenalty;
  return Math.round(clamp(raw, 10, 99));
}

function oddsValueScore(odds1x2) {
  const h = Number(odds1x2?.home);
  const d = Number(odds1x2?.draw);
  const a = Number(odds1x2?.away);
  if (!(h > 0 && d > 0 && a > 0)) return 50;
  const inv = 1 / h + 1 / d + 1 / a;
  const margin = inv - 1;
  return clamp(100 - (margin / 0.15) * 100, 0, 100);
}

function depthScoreFromBets(betsCount) {
  const b = Number(betsCount || 0);
  if (b >= 80) return 100;
  if (b >= 50) return 85;
  if (b >= 30) return 70;
  if (b >= 15) return 55;
  return 35;
}

function stabilityFromTrend(trend) {
  const n = ["home", "draw", "away"].filter((k) => trend?.[k]).length;
  if (n === 0) return 100;
  if (n === 1) return 75;
  if (n === 2) return 45;
  return 25;
}

function timingScoreForFinder(match) {
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Number(match?.startTimeUnix || 0);
  const mins = start > nowSec ? (start - nowSec) / 60 : -1;
  if (mins < 0) return 40;
  if (mins <= 8) return 88;
  if (mins <= 45) return 96;
  if (mins <= 120) return 80;
  return 58;
}

function trendFlagCount(match) {
  return ["home", "draw", "away"].filter((k) => match?.trend?.[k]).length;
}

function computeFinderScore(match) {
  const rel = clamp(Number(match.reliabilityScore || 0), 0, 100);
  const value = oddsValueScore(match?.odds1x2);
  const depth = depthScoreFromBets(match?.betsCount);
  const stab = stabilityFromTrend(match?.trend);
  const time = timingScoreForFinder(match);
  const n = trendFlagCount(match);
  const raw = rel * 0.5 + stab * 0.22 + depth * 0.14 + value * 0.08 + time * 0.06 - n * 7;
  return Math.round(clamp(raw, 12, 100));
}

function conservativeDenicheurRank(match) {
  const rel = Number(match.reliabilityScore || 0);
  const fin = Number(match.finderScore || 0);
  const n = trendFlagCount(match);
  return rel * 0.52 + fin * 0.4 - n * 11 - (n >= 2 ? 14 : 0);
}

function prudentDenicheurScore(match) {
  const rel = Number(match.reliabilityScore || 0);
  const fin = Number(match.finderScore || 0);
  const n = trendFlagCount(match);
  return Math.round(clamp(rel * 0.5 + fin * 0.35 - n * 8, 12, 88));
}

function minutesToStart(match) {
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Number(match?.startTimeUnix || 0);
  return start > nowSec ? (start - nowSec) / 60 : -1;
}

function maxImpliedFavoritePercent(match) {
  const h = Number(match?.odds1x2?.home);
  const d = Number(match?.odds1x2?.draw);
  const a = Number(match?.odds1x2?.away);
  if (!(h > 0 && d > 0 && a > 0)) return null;
  const ih = 1 / h;
  const id = 1 / d;
  const ia = 1 / a;
  const sum = ih + id + ia;
  if (sum <= 0) return null;
  return Math.round((Math.max(ih, id, ia) / sum) * 100);
}

function estimatedSuccessProbability(match) {
  const finder = clamp(Number(match.finderScore || 0), 0, 100);
  const market = maxImpliedFavoritePercent(match);
  const n = trendFlagCount(match);
  const marginHaircut = 0.84;
  if (market == null) {
    return Math.round(clamp(finder * 0.55 - 10 - n * 5, 5, 55));
  }
  const adjM = market * marginHaircut;
  const raw = 0.16 * adjM + 0.34 * finder - n * 5 - 12;
  return Math.round(clamp(raw, 4, 58));
}

const DENICHEUR_TARGET_MIN = 10;
const DENICHEUR_WINDOW_MIN = 5;

function isDenicheurFullOption() {
  const el = document.getElementById("denicheurFullOption");
  return Boolean(el?.checked);
}

function initDenicheurFullOption() {
  const el = document.getElementById("denicheurFullOption");
  if (!el) return;
  const stored = localStorage.getItem(DENICHEUR_FULL_OPTION_KEY);
  if (stored === "1") el.checked = true;
  el.addEventListener("change", () => {
    localStorage.setItem(DENICHEUR_FULL_OPTION_KEY, el.checked ? "1" : "0");
  });
}

function refineDenicheurCandidatePool(pool, baseNote, fullMode) {
  const withOdds = pool.filter((m) => maxImpliedFavoritePercent(m) != null);
  const work = withOdds.length ? withOdds : pool;
  let searchNote = baseNote;

  if (fullMode) {
    searchNote += " Option complete (choisir au mieux): criteres renforces.";
    const depthOk = (m) => Number(m.betsCount || 0) >= 22;
    let filtered = work.filter(
      (m) =>
        trendFlagCount(m) === 0 &&
        depthOk(m) &&
        Number(m.reliabilityScore || 0) >= 72 &&
        Number(m.finderScore || 0) >= 62
    );
    if (filtered.length) {
      searchNote += " Niveau max: liquidite + fiabilite + cotes figees.";
      return { pool: filtered, searchNote };
    }
    filtered = work.filter(
      (m) =>
        trendFlagCount(m) === 0 &&
        depthOk(m) &&
        Number(m.reliabilityScore || 0) >= 68 &&
        Number(m.finderScore || 0) >= 58
    );
    if (filtered.length) {
      searchNote += " Niveau eleve: marche solide sans mouvement sur 1X2.";
      return { pool: filtered, searchNote };
    }
    filtered = work.filter(
      (m) =>
        trendFlagCount(m) === 0 &&
        Number(m.reliabilityScore || 0) >= 66 &&
        Number(m.finderScore || 0) >= 56 &&
        Number(m.betsCount || 0) >= 15
    );
    if (filtered.length) {
      searchNote += " Niveau renforce: minimum de profondeur et tres bonne fiabilite.";
      return { pool: filtered, searchNote };
    }
    searchNote +=
      " Aucun match ne valide l'option complete sur cette fenetre — decoche l'option ou actualise plus tard.";
    return { pool: [], searchNote };
  }

  let filtered = work.filter(
    (m) =>
      trendFlagCount(m) === 0 &&
      Number(m.reliabilityScore || 0) >= 65 &&
      Number(m.finderScore || 0) >= 56
  );
  if (filtered.length) {
    searchNote += " Mode strict: cotes stables + bonne fiabilite.";
    return { pool: filtered, searchNote };
  }
  filtered = work.filter(
    (m) =>
      trendFlagCount(m) <= 1 &&
      Number(m.reliabilityScore || 0) >= 58 &&
      Number(m.finderScore || 0) >= 52
  );
  if (filtered.length) {
    searchNote += " Mode prudent: peu de mouvement sur les cotes.";
    return { pool: filtered, searchNote };
  }
  filtered = work.filter((m) => trendFlagCount(m) <= 2);
  if (filtered.length) {
    searchNote += " Moins de choix tres propres: niveau intermediaire.";
    return { pool: filtered, searchNote };
  }
  searchNote += " Attention: marche volatile — reste tres prudent.";
  return { pool: work, searchNote };
}

function pickDenicheurMatch(matches) {
  const fullMode = isDenicheurFullOption();
  const upcoming = (matches || []).filter((m) => classifyMatch(m) === "upcoming");
  const strict = upcoming.filter((m) => {
    const mt = minutesToStart(m);
    return mt >= DENICHEUR_TARGET_MIN - DENICHEUR_WINDOW_MIN && mt <= DENICHEUR_TARGET_MIN + DENICHEUR_WINDOW_MIN;
  });
  let pool = strict;
  let searchNote = "Fenetre cible: ~10 min apres coup d'envoi (entre 5 et 15 min).";
  if (!pool.length) {
    pool = upcoming.filter((m) => {
      const mt = minutesToStart(m);
      return mt >= 4 && mt <= 25;
    });
    searchNote = "Aucun match dans 5-15 min: recherche elargie entre 4 et 25 min.";
  }
  if (!pool.length) {
    pool = upcoming.filter((m) => {
      const mt = minutesToStart(m);
      return mt > 0 && mt <= 180;
    });
    searchNote = "Aucun match proche: meilleur choix parmi les matchs a venir sous 3 h.";
  }
  if (!pool.length) {
    return { match: null, searchNote: "Aucun match a venir disponible." };
  }
  const refined = refineDenicheurCandidatePool(pool, searchNote, fullMode);
  if (!refined.pool.length) {
    return { match: null, searchNote: refined.searchNote };
  }
  const sorted = [...refined.pool].sort((a, b) => {
    const ra = conservativeDenicheurRank(a) + (fullMode ? Number(a.reliabilityScore || 0) * 0.05 : 0);
    const rb = conservativeDenicheurRank(b) + (fullMode ? Number(b.reliabilityScore || 0) * 0.05 : 0);
    if (rb !== ra) return rb - ra;
    return Number(a.startTimeUnix || 0) - Number(b.startTimeUnix || 0);
  });
  return { match: sorted[0], searchNote: refined.searchNote };
}

function pushDenicheurHistory(entry) {
  try {
    const raw = localStorage.getItem(DENICHEUR_HISTORY_KEY);
    let list = [];
    try {
      const parsed = JSON.parse(raw || "[]");
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
    list.unshift({
      id: entry.id,
      teamHome: entry.teamHome,
      teamAway: entry.teamAway,
      prob: entry.prob,
      taux: entry.taux,
      at: Date.now(),
    });
    localStorage.setItem(DENICHEUR_HISTORY_KEY, JSON.stringify(list.slice(0, 3)));
  } catch {}
}

function renderDenicheurHistoryHtml() {
  try {
    const raw = localStorage.getItem(DENICHEUR_HISTORY_KEY);
    const list = JSON.parse(raw || "[]");
    if (!Array.isArray(list) || list.length === 0) return "";
    const rows = list.slice(0, 3).map((h) => {
      const t = h.at
        ? new Date(h.at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "";
      return `<li><span class="denicheur-hist-teams">${escapeHtml(h.teamHome)} vs ${escapeHtml(h.teamAway)}</span> — proba ${h.prob}% / confiance ${h.taux}% <small>${t}</small></li>`;
    });
    return `
      <div class="denicheur-history">
        <h3 class="denicheur-history-title">Derniers choix (memoire locale)</h3>
        <ul class="denicheur-history-list">${rows.join("")}</ul>
      </div>`;
  } catch {
    return "";
  }
}

function getFocusableElements(root) {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
}

function setDenicheurModalLoading(isLoading) {
  const btn = document.getElementById("denicheurLaunchBtn");
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    if (!btn.dataset.prevLabel) btn.dataset.prevLabel = btn.textContent.trim();
    btn.textContent = "Recherche en cours...";
  } else {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    if (btn.dataset.prevLabel) btn.textContent = btn.dataset.prevLabel;
  }
}

function closeDenicheurModal() {
  const modal = document.getElementById("denicheurModal");
  if (!modal) return;
  unlockDenicheurBackgroundScroll();
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  const prev = denicheurPreviousFocus;
  denicheurPreviousFocus = null;
  if (prev && typeof prev.focus === "function" && document.body.contains(prev)) {
    try {
      prev.focus();
    } catch {}
  } else {
    document.getElementById("denicheurLaunchBtn")?.focus();
  }
}

function renderDenicheurModalContent(match, searchNote) {
  const mt = Math.round(minutesToStart(match));
  const prob = estimatedSuccessProbability(match);
  const taux = prudentDenicheurScore(match);
  const rel = Math.round(clamp(Number(match.reliabilityScore || 0), 0, 99));
  const marketHint = maxImpliedFavoritePercent(match);
  const marketAdj = marketHint == null ? null : Math.round(marketHint * 0.84);
  const detailUrl = `/match.html?id=${encodeURIComponent(match.id)}`;

  return `
    <p class="denicheur-intro">Voici le match que le <strong>denicheur</strong> a choisi pour toi.</p>
    <p class="denicheur-method">
      <strong>Methode (prudente):</strong> fenetre ~10 min puis filtres sur <strong>fiabilite</strong> et <strong>cotes stables</strong>
      (moins de mouvement). Le tri favorise la securite des donnees plutot que le rendement affiche. Les pourcentages sont
      <strong>volontairement bas</strong> (marge bookmaker + incertitude) — aucun gain garanti.
      ${isDenicheurFullOption() ? "<br /><strong>Option complete:</strong> criteres ultra stricts (liquidite + scores hauts + 1X2 fixes) au moment du clic." : ""}
    </p>
    <p class="denicheur-search-note">${escapeHtml(searchNote)}</p>
    <div class="denicheur-match-block">
      <p class="denicheur-league">${escapeHtml(match.league || "Ligue")}</p>
      <p class="denicheur-teams">${escapeHtml(match.teamHome)} <span class="denicheur-vs">vs</span> ${escapeHtml(match.teamAway)}</p>
      <p class="denicheur-kick">Coup d'envoi: ${formatTime(match.startTimeUnix)} · dans environ <strong>${mt}</strong> min</p>
      <div class="denicheur-odds-mini">
        <span>1 ${formatOdd(match.odds1x2?.home)}</span>
        <span>X ${formatOdd(match.odds1x2?.draw)}</span>
        <span>2 ${formatOdd(match.odds1x2?.away)}</span>
      </div>
    </div>
    <div class="denicheur-metrics">
      <div class="denicheur-metric">
        <span class="denicheur-metric-label">Probabilite de succes (conservatrice)</span>
        <strong class="denicheur-metric-value">${prob}%</strong>
        <small class="denicheur-metric-hint">Favori marche brut ~${marketHint != null ? `${marketHint}%` : "N/A"}, ajuste ~${marketAdj != null ? `${marketAdj}%` : "N/A"} + penalite si cotes mouvantes.</small>
      </div>
      <div class="denicheur-metric">
        <span class="denicheur-metric-label">Confiance prudente (denicheur)</span>
        <strong class="denicheur-metric-value denicheur-accent">${taux}%</strong>
        <small class="denicheur-metric-hint">Melange fiabilite ${rel}% et score interne, abaisse si volatilite 1X2.</small>
      </div>
    </div>
    <p class="denicheur-disclaimer">Indicatif, pari responsable — rien n'est garanti. Reserve aux majeurs selon ta legislation.</p>
    ${renderDenicheurHistoryHtml()}
    <a class="denicheur-detail-btn" href="${detailUrl}">Voir le detail predictions</a>
  `;
}

function focusDenicheurModal() {
  const modal = document.getElementById("denicheurModal");
  const closeBtn = document.getElementById("denicheurModalClose");
  const card = modal?.querySelector(".denicheur-card");
  const focusables = getFocusableElements(card);
  if (focusables.length) {
    (closeBtn && focusables.includes(closeBtn) ? closeBtn : focusables[0]).focus();
  }
}

function onDenicheurModalKeydown(event) {
  const modal = document.getElementById("denicheurModal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeDenicheurModal();
    return;
  }
  if (event.key !== "Tab") return;
  const card = modal.querySelector(".denicheur-card");
  const focusables = getFocusableElements(card);
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function openDenicheurModal() {
  const modal = document.getElementById("denicheurModal");
  const body = document.getElementById("denicheurModalBody");
  if (!modal || !body) return;
  denicheurPreviousFocus = document.activeElement;
  setDenicheurModalLoading(true);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  lockDenicheurBackgroundScroll();
  body.innerHTML = '<p class="denicheur-loading">Recherche en cours...</p>';
  requestAnimationFrame(() => focusDenicheurModal());

  try {
    await loadMatches();
  } catch (error) {
    body.innerHTML = `<p class="denicheur-error">Impossible de charger les matchs: ${escapeHtml(error.message)}</p>`;
    setDenicheurModalLoading(false);
    requestAnimationFrame(() => focusDenicheurModal());
    return;
  }

  const { match, searchNote } = pickDenicheurMatch(allMatches);
  if (!match) {
    body.innerHTML = `<p class="denicheur-error">${escapeHtml(searchNote)} Actualise la page ou reessaie plus tard.</p>`;
    setDenicheurModalLoading(false);
    requestAnimationFrame(() => focusDenicheurModal());
    return;
  }

  const prob = estimatedSuccessProbability(match);
  const taux = prudentDenicheurScore(match);
  pushDenicheurHistory({
    id: match.id,
    teamHome: match.teamHome,
    teamAway: match.teamAway,
    prob,
    taux,
  });

  body.innerHTML = renderDenicheurModalContent(match, searchNote);
  setDenicheurModalLoading(false);
  requestAnimationFrame(() => focusDenicheurModal());
}

function initDenicheurModal() {
  const modal = document.getElementById("denicheurModal");
  const btn = document.getElementById("denicheurLaunchBtn");
  const closeBtn = document.getElementById("denicheurModalClose");
  if (!modal || !btn) return;

  btn.addEventListener("click", () => {
    openDenicheurModal();
  });
  if (closeBtn) closeBtn.addEventListener("click", () => closeDenicheurModal());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDenicheurModal();
  });
  document.addEventListener("keydown", onDenicheurModalKeydown);
}

function uniqueLeagues(matches) {
  const map = new Map();
  matches.forEach((match) => {
    const league = String(match.league || "").trim();
    if (league && !map.has(league.toLowerCase())) map.set(league.toLowerCase(), league);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "fr"));
}

function normalizeText(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function classifyMatch(match) {
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Number(match?.startTimeUnix || 0);
  const statusCode = Number(match?.statusCode || 0);
  const info = normalizeText(match?.infoText || "");
  const status = normalizeText(match?.statusText || "");
  const phase = normalizeText(match?.phase || "");

  const isFinishedByText =
    status.includes("termine") ||
    phase.includes("termine") ||
    info.includes("termine");

  const isUpcomingBySignal =
    statusCode === 128 ||
    info.includes("avant le debut") ||
    status.includes("debut dans");

  const isLiveByText =
    phase.includes("mi-temps") ||
    status.includes("minute") ||
    status.includes("mi-temps") ||
    info.includes("1ere mi-temps") ||
    info.includes("2eme mi-temps");

  if (isFinishedByText) return "finished";
  if (isUpcomingBySignal && start > nowSec) return "upcoming";
  if (isLiveByText) return "live";
  if (start > nowSec) return "upcoming";
  return "live";
}

function populateLeagueFilter(matches) {
  const select = document.getElementById("leagueSelect");
  const currentValue = select.value || "all";
  const leagues = uniqueLeagues(matches);

  select.innerHTML = '<option value="all">Toutes les ligues</option>';
  leagues.forEach((league) => {
    const option = document.createElement("option");
    option.value = league;
    option.textContent = league;
    select.appendChild(option);
  });

  if ([...select.options].some((opt) => opt.value === currentValue)) {
    select.value = currentValue;
  }
}

function createMatchCard(match, index) {
  const card = document.createElement("article");
  card.className = "match-card";
  card.style.animationDelay = `${Math.min(index * 0.04, 0.6)}s`;
  const score = extractScore(match.score);
  const status = match.statusText || "A venir";
  const useFinder = currentMatchMode === "finder" && Number(match.finderScore || 0) > 0;
  const quality = useFinder ? prudentDenicheurScore(match) : Number(match.reliabilityScore || 0);
  const qualityLabel = useFinder ? "Prudent" : "Qualite";
  const qualityClass = quality >= 75 ? "quality-high" : quality >= 60 ? "quality-mid" : "quality-low";
  const watchlisted = isInWatchlist(match.id);
  const visualScores = renderVisualScoreStrip(match);

  const detailLink = document.createElement("a");
  detailLink.className = "detail-btn";
  detailLink.href = `/match.html?id=${encodeURIComponent(match.id)}`;
  detailLink.textContent = "Detail predictions";

  card.innerHTML = `
    <div class="league-row">
      <p class="league">${match.league || "Ligue virtuelle"}</p>
      <div class="league-badges">
        <button
          type="button"
          class="watch-toggle ${watchlisted ? "active" : ""}"
          data-watch-id="${escapeHtml(match.id)}"
          aria-pressed="${watchlisted ? "true" : "false"}"
          aria-label="${watchlisted ? "Retirer de la watchlist" : "Ajouter a la watchlist"}"
        >
          ${watchlisted ? "Suivi actif" : "Suivre"}
        </button>
        <span class="reliability-pill ${qualityClass}">${qualityLabel} ${quality}%</span>
        <span class="status-pill">${status}</span>
      </div>
    </div>
    <div class="scoreboard">
      <div class="team-col">
        ${createTeamLogo(match.teamHome, match.teamHomeLogo, match.teamHomeLogoFallback)}
        <p class="team-name">${match.teamHome}</p>
      </div>
      <div class="score-center">${score.home} - ${score.away}</div>
      <div class="team-col">
        ${createTeamLogo(match.teamAway, match.teamAwayLogo, match.teamAwayLogoFallback, true)}
        <p class="team-name">${match.teamAway}</p>
      </div>
    </div>
    ${visualScores}
    <div class="odds-row">
      <div class="odd-box ${match.trend?.home || ""}"><span>${match.teamHome}</span><strong>${formatOdd(match.odds1x2?.home)}</strong></div>
      <div class="odd-box ${match.trend?.draw || ""}"><span>Nul</span><strong>${formatOdd(match.odds1x2?.draw)}</strong></div>
      <div class="odd-box ${match.trend?.away || ""}"><span>${match.teamAway}</span><strong>${formatOdd(match.odds1x2?.away)}</strong></div>
    </div>
    <p class="kickoff">Coup d'envoi: ${formatTime(match.startTimeUnix)} | ${scoreText(match.score)}</p>
  `;

  card.appendChild(detailLink);
  card.querySelectorAll(".team-logo-img").forEach((img) => {
    img.addEventListener("error", () => {
      const wrapper = img.closest(".team-logo");
      const fallbackSrc = img.getAttribute("data-fallback-src");
      if (fallbackSrc && img.src !== fallbackSrc) {
        img.src = fallbackSrc;
        img.removeAttribute("data-fallback-src");
        return;
      }
      if (wrapper) wrapper.classList.add("logo-fallback");
    });
  });
  const watchBtn = card.querySelector("[data-watch-id]");
  if (watchBtn) {
    watchBtn.addEventListener("click", () => {
      const active = toggleWatchlist(match.id);
      watchBtn.classList.toggle("active", active);
      watchBtn.setAttribute("aria-pressed", active ? "true" : "false");
      watchBtn.setAttribute("aria-label", active ? "Retirer de la watchlist" : "Ajouter a la watchlist");
      watchBtn.textContent = active ? "Suivi actif" : "Suivre";
      renderWatchlistPanel(allMatches);
    });
  }
  return card;
}

function normalizeOdd(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function diffTrend(previous, next) {
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return "";
  const diff = next - previous;
  if (Math.abs(diff) < 0.001) return "";
  return diff < 0 ? "odd-up" : "odd-down";
}

function changePercent(previous, next) {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= 0) return null;
  return Math.abs(((next - previous) / previous) * 100);
}

function pushOddAlert(message) {
  const wrap = document.getElementById("oddAlerts");
  if (!wrap) return;
  const card = document.createElement("article");
  card.className = "odd-alert-card";
  card.textContent = message;
  wrap.appendChild(card);
  setTimeout(() => {
    card.classList.add("out");
    setTimeout(() => card.remove(), 420);
  }, 3800);
}

function enrichWithTrend(matches) {
  const alerts = [];
  const enriched = (matches || []).map((match) => {
    const key = String(match.id);
    const prev = previousOddsByMatch.get(key) || {};
    const next = {
      home: normalizeOdd(match?.odds1x2?.home),
      draw: normalizeOdd(match?.odds1x2?.draw),
      away: normalizeOdd(match?.odds1x2?.away),
    };
    previousOddsByMatch.set(key, next);

    const checks = [
      ["1", prev.home, next.home],
      ["X", prev.draw, next.draw],
      ["2", prev.away, next.away],
    ];

    for (const [label, oldOdd, newOdd] of checks) {
      const pct = changePercent(oldOdd, newOdd);
      if (pct == null || pct < STRONG_ODD_CHANGE_PERCENT) continue;
      const dir = newOdd < oldOdd ? "baisse" : "hausse";
      const alertKey = `${key}:${label}:${dir}`;
      const now = Date.now();
      const last = oddAlertLastShown.get(alertKey) || 0;
      if (now - last < ODD_ALERT_COOLDOWN_MS) continue;
      oddAlertLastShown.set(alertKey, now);
      alerts.push(
        `${match.teamHome} vs ${match.teamAway}: cote ${label} en ${dir} forte (${pct.toFixed(1)}%)`
      );
    }

    const trend = {
      home: diffTrend(prev.home, next.home),
      draw: diffTrend(prev.draw, next.draw),
      away: diffTrend(prev.away, next.away),
    };
    const enriched = {
      ...match,
      trend,
      fetchedAt: lastFetchedAt,
      reliabilityScore: computeReliabilityScore({ ...match, trend, fetchedAt: lastFetchedAt }),
    };
    return {
      ...enriched,
      finderScore: computeFinderScore(enriched),
    };
  });
  if (alerts.length) {
    setTimeout(() => alerts.forEach((msg) => pushOddAlert(msg)), 120);
  }
  return enriched;
}

function renderLeagueHeatmap(matches) {
  const wrap = document.getElementById("leagueHeatmap");
  if (!wrap) return;
  const upcoming = (matches || []).filter((m) => classifyMatch(m) === "upcoming");
  const byLeague = new Map();

  upcoming.forEach((m) => {
    const key = String(m.league || "Ligue inconnue");
    const item = byLeague.get(key) || { league: key, count: 0, reliabilitySum: 0, volatility: 0 };
    item.count += 1;
    item.reliabilitySum += Number(m.reliabilityScore || 0);
    item.volatility += ["home", "draw", "away"].filter((k) => m?.trend?.[k]).length;
    byLeague.set(key, item);
  });

  const rows = Array.from(byLeague.values())
    .map((x) => {
      const avgReliability = x.count ? x.reliabilitySum / x.count : 0;
      const volAvg = x.count ? x.volatility / x.count : 0;
      const stability = clamp(Math.round(avgReliability - volAvg * 8 + Math.log2(x.count + 1) * 7), 5, 99);
      return {
        ...x,
        avgReliability: Math.round(avgReliability),
        stability,
      };
    })
    .sort((a, b) => b.stability - a.stability)
    .slice(0, 8);

  if (!rows.length) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = `
    <div class="heatmap-head">
      <h2>Heatmap Ligues Temps Reel</h2>
      <span>Tri stabilite IA</span>
    </div>
    <div class="heatmap-grid">
      ${rows
        .map(
          (r) => `
          <article class="heat-row">
            <div class="heat-line">
              <strong>${escapeHtml(r.league)}</strong>
              <span>Stabilite ${r.stability}%</span>
            </div>
            <div class="heat-bar"><i style="width:${r.stability}%"></i></div>
            <small>${r.count} matchs a venir | Fiabilite moyenne ${r.avgReliability}%</small>
          </article>
        `
        )
        .join("")}
    </div>
  `;
}

function renderMatchFinder(matches) {
  const grid = document.getElementById("finderGrid");
  const badge = document.getElementById("finderBadge");
  if (!grid) return;

  const upcoming = (matches || []).filter((m) => classifyMatch(m) === "upcoming");
  const sorted = [...upcoming].sort((a, b) => {
    const ra = conservativeDenicheurRank(a);
    const rb = conservativeDenicheurRank(b);
    if (rb !== ra) return rb - ra;
    return Number(a.startTimeUnix || 0) - Number(b.startTimeUnix || 0);
  });
  const top = sorted.slice(0, 6);

  if (badge) {
    badge.textContent = top.length ? `${top.length} pepite(s)` : "Aucune pepite";
  }

  if (!top.length) {
    grid.innerHTML = `<p class="finder-empty">Aucun match a venir pour le denicheur pour le moment.</p>`;
    return;
  }

  grid.innerHTML = top
    .map((m, i) => {
      const score = prudentDenicheurScore(m);
      const sc = score >= 68 ? "finder-high" : score >= 52 ? "finder-mid" : "finder-low";
      return `
      <article class="finder-row">
        <span class="finder-rank">#${i + 1}</span>
        <div class="finder-main">
          <strong>${escapeHtml(m.teamHome)} vs ${escapeHtml(m.teamAway)}</strong>
          <small>${escapeHtml(m.league || "Ligue")} · ${formatTime(m.startTimeUnix)}</small>
        </div>
        <span class="finder-pill ${sc}">${score}</span>
        <a class="finder-link" href="/match.html?id=${encodeURIComponent(m.id)}">Detail</a>
      </article>`;
    })
    .join("");
}

function buildSiteCommandMetrics(matches = []) {
  const upcoming = (matches || []).filter((m) => classifyMatch(m) === "upcoming");
  const live = (matches || []).filter((m) => classifyMatch(m) === "live");
  const sorted = [...upcoming].sort((a, b) => {
    const ra = conservativeDenicheurRank(a);
    const rb = conservativeDenicheurRank(b);
    return rb - ra;
  });
  const top = sorted.slice(0, 3);
  const avgReliability = upcoming.length
    ? Math.round(upcoming.reduce((acc, match) => acc + Number(match.reliabilityScore || 0), 0) / upcoming.length)
    : 0;
  const stableCount = upcoming.filter((m) => trendFlagCount(m) === 0).length;
  const qualityIndex = clamp(
    Math.round(avgReliability * 0.58 + (upcoming.length ? (stableCount / upcoming.length) * 100 : 0) * 0.26 + (live.length ? 72 : 58) * 0.16),
    5,
    99
  );
  return { upcoming, live, top, avgReliability, stableCount, qualityIndex };
}

function renderSiteCommandCenter(matches = []) {
  const host = document.getElementById("siteCommandCenter");
  if (!host) return;

  const metrics = buildSiteCommandMetrics(matches);
  const topRows = metrics.top.length
    ? metrics.top
        .map((match, index) => {
          const finder = prudentDenicheurScore(match);
          return `
            <article class="command-pick-card">
              <div class="command-pick-rank">#${index + 1}</div>
              <div class="command-pick-main">
                <strong>${escapeHtml(match.teamHome)} vs ${escapeHtml(match.teamAway)}</strong>
                <span>${escapeHtml(match.league || "Ligue")} | ${formatTime(match.startTimeUnix)}</span>
              </div>
              <div class="command-pick-metrics">
                <span>Fiabilite ${Number(match.reliabilityScore || 0)}%</span>
                <span>Denicheur ${finder}</span>
              </div>
              <a class="command-pick-link" href="/match.html?id=${encodeURIComponent(match.id)}">Ouvrir</a>
            </article>
          `;
        })
        .join("")
    : `<p class="command-empty">Aucun pick fort detecte pour le moment.</p>`;

  const statusTone =
    metrics.qualityIndex >= 78 ? "command-good" : metrics.qualityIndex >= 62 ? "command-mid" : "command-low";
  const statusLabel =
    metrics.qualityIndex >= 78 ? "Flux premium" : metrics.qualityIndex >= 62 ? "Flux exploitable" : "Flux prudent";

  host.innerHTML = `
    <div class="command-head">
      <div>
        <p class="command-kicker">Pilotage intelligent</p>
        <h2>Centre de Commande</h2>
        <p class="command-copy">Un seul endroit pour lire la qualite globale du flux, le parcours ideal et les meilleurs matchs a ouvrir maintenant.</p>
      </div>
      <div class="command-score ${statusTone}">
        <span>Indice global</span>
        <strong>${metrics.qualityIndex}/100</strong>
        <small>${statusLabel}</small>
      </div>
    </div>
    <div class="command-grid">
      <article class="command-card">
        <strong>Parcours conseille</strong>
        <p>1. Choisir un mode. 2. Ouvrir un detail match. 3. Construire le coupon. 4. Valider puis exporter.</p>
      </article>
      <article class="command-card">
        <strong>Sante du flux</strong>
        <p>${metrics.upcoming.length} matchs a venir, ${metrics.live.length} en cours, fiabilite moyenne ${metrics.avgReliability}%.</p>
      </article>
      <article class="command-card">
        <strong>Stabilite marche</strong>
        <p>${metrics.stableCount} matchs a venir sont sans drift visible fort sur les 3 issues principales.</p>
      </article>
    </div>
    <div class="command-subhead">
      <strong>Top ouvertures recommandees</strong>
      <span>Detail match -> coupon -> validation</span>
    </div>
    <div class="command-picks">${topRows}</div>
  `;
}

function renderMatches() {
  const subTitle = document.getElementById("subTitle");
  const matchesWrap = document.getElementById("matches");
  const emptyState = document.getElementById("emptyState");
  const leagueSelect = document.getElementById("leagueSelect");
  const selectedLeague = leagueSelect.value;

  const byLeague =
    selectedLeague === "all"
      ? allMatches
      : allMatches.filter((match) => match.league === selectedLeague);

  let filtered;
  let effectiveMode = currentMatchMode;
  if (currentMatchMode === "turbo") {
    filtered = byLeague
      .filter((match) => classifyMatch(match) === "upcoming")
      .sort((a, b) => {
        const ra = Number(a.reliabilityScore || 0);
        const rb = Number(b.reliabilityScore || 0);
        if (rb !== ra) return rb - ra;
        return Number(a.startTimeUnix || 0) - Number(b.startTimeUnix || 0);
      })
      .slice(0, 10);
  } else if (currentMatchMode === "finder") {
    filtered = byLeague
      .filter((match) => classifyMatch(match) === "upcoming")
      .sort((a, b) => {
        const ra = conservativeDenicheurRank(a);
        const rb = conservativeDenicheurRank(b);
        if (rb !== ra) return rb - ra;
        return Number(a.startTimeUnix || 0) - Number(b.startTimeUnix || 0);
      });
  } else {
    filtered = byLeague.filter((match) => classifyMatch(match) === currentMatchMode);
  }

  // UX fallback: when upcoming is empty, show live matches instead of a blank board.
  if (currentMatchMode === "upcoming" && filtered.length === 0) {
    const liveFallback = byLeague.filter((match) => classifyMatch(match) === "live");
    if (liveFallback.length > 0) {
      filtered = liveFallback;
      effectiveMode = "live";
    }
  }

  const leagueLabel = selectedLeague === "all" ? "toutes ligues" : `ligue: ${selectedLeague}`;
  const modeLabel =
    effectiveMode === "upcoming"
      ? "A venir"
      : effectiveMode === "turbo"
      ? "Turbo Top 10"
      : effectiveMode === "finder"
      ? "Denicheur"
      : effectiveMode === "live"
      ? "En cours"
      : "Termines";
  subTitle.textContent = `${filtered.length} match(s) (${leagueLabel}, ${modeLabel}) - ${currentModeLabel}`;
  renderSiteCommandCenter(byLeague);
  renderWatchlistPanel(allMatches);

  matchesWrap.innerHTML = "";
  emptyState.classList.toggle("hidden", filtered.length > 0);
  if (filtered.length > 0) {
    filtered.forEach((match, index) => matchesWrap.appendChild(createMatchCard(match, index)));
    activateAmbientOddsPulse(matchesWrap);
  }
}

function activateAmbientOddsPulse(root) {
  const boxes = Array.from(root.querySelectorAll(".odd-box"));
  if (!boxes.length) return;
  boxes.forEach((b) => b.classList.remove("odd-live"));
  const sampleCount = Math.min(3, boxes.length);
  for (let i = 0; i < sampleCount; i += 1) {
    const idx = Math.floor(Math.random() * boxes.length);
    boxes[idx].classList.add("odd-live");
  }
}

async function loadMatches() {
  const requestId = ++lastLoadRequestId;
  const subTitle = document.getElementById("subTitle");
  const statsWrap = document.getElementById("stats");
  const emptyState = document.getElementById("emptyState");
  const updatedAt = document.getElementById("updatedAt");

  subTitle.textContent = "Chargement en cours...";
  statsWrap.innerHTML = "";
  emptyState.classList.add("hidden");

  try {
    const res = await fetch("/api/matches", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || data.message || "Reponse API invalide");

    if (requestId !== lastLoadRequestId) return;

    const payload = data?.data && typeof data.data === "object" ? data.data : data;
    const meta = data?.meta && typeof data.meta === "object" ? data.meta : {};
    const knownLogos = buildKnownTeamLogoMap(allMatches);
    const rawMatches = Array.isArray(payload.matches)
      ? payload.matches.map((match) => sanitizeMatchLogos(match, knownLogos))
      : Array.isArray(data.matches)
        ? data.matches.map((match) => sanitizeMatchLogos(match, knownLogos))
        : [];
    lastFetchedAt = meta.fetchedAt || data.fetchedAt || null;
    allMatches = enrichWithTrend(rawMatches);
    updateWatchlistAlerts(allMatches);
    const filterMode = payload.filterMode || data.filterMode || "unknown";
    const mode = filterMode === "keyword-penalty" ? "filtre mot-cle" : "fallback groupe gr=285";
    currentModeLabel = `mode: ${mode}`;

    statsWrap.appendChild(createStat("Total API", payload.totalFromApi ?? data.totalFromApi ?? "-"));
    statsWrap.appendChild(createStat("Sport 85", payload.totalSport85 ?? data.totalSport85 ?? "-"));
    statsWrap.appendChild(createStat("Penalty", payload.totalPenalty ?? data.totalPenalty ?? "-"));
    statsWrap.appendChild(createStat("Ligues", uniqueLeagues(allMatches).length));

    populateLeagueFilter(allMatches);
    renderSiteCommandCenter(allMatches);
    renderFrontlineStatus();
    renderWatchlistPanel(allMatches);
    renderLeagueHeatmap(allMatches);
    renderMatchFinder(allMatches);
    renderMatches();
    updatedAt.textContent = lastFetchedAt
      ? `Derniere mise a jour: ${new Date(lastFetchedAt).toLocaleString("fr-FR")}`
      : "";
    hydrateDirectTeamLogos(allMatches).then(() => {
      if (requestId !== lastLoadRequestId) return;
      renderWatchlistPanel(allMatches);
      renderMatchFinder(allMatches);
      renderMatches();
    });
    siteLog("log", "home_matches_loaded", { count: allMatches.length, mode: filterMode });
  } catch (error) {
    subTitle.textContent = "Erreur de chargement";
    emptyState.classList.remove("hidden");
    emptyState.textContent = `Erreur: ${error.message}`;
    updatedAt.textContent = "";
    siteLog("error", "home_matches_load_failed", { message: error.message });
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadMatches);
document.getElementById("leagueSelect").addEventListener("change", renderMatches);
const lowDataToggle = document.getElementById("lowDataToggle");
if (lowDataToggle) {
  const enabled = isLowDataModeEnabled();
  lowDataToggle.checked = enabled;
  setLowDataMode(enabled);
  lowDataToggle.addEventListener("change", () => {
    setLowDataMode(Boolean(lowDataToggle.checked));
  });
} else {
  setLowDataMode(isLowDataModeEnabled());
}
document.querySelectorAll(".match-mode").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentMatchMode = btn.dataset.mode || "upcoming";
    document.querySelectorAll(".match-mode").forEach((b) => b.classList.toggle("active", b === btn));
    renderMatches();
  });
});
loadMatches();
setInterval(() => {
  const wrap = document.getElementById("matches");
  if (wrap) activateAmbientOddsPulse(wrap);
}, 2300);
initWelcomeModal();
initDenicheurModal();
initDenicheurFullOption();

function registerHomeSiteControl() {
  window.SiteControl = {
    page: "home",
    actions: [
      "refresh_matches",
      "set_mode_upcoming",
      "set_mode_live",
      "set_mode_finished",
      "set_mode_turbo",
      "set_mode_finder",
      "set_league",
      "open_coupon_page",
      "open_denicheur_modal",
      "open_match_first",
      "set_low_data",
    ],
    execute(name, payload = {}) {
      const action = String(name || "").toLowerCase();
      if (action === "refresh_matches") return loadMatches();
      if (action === "set_mode_upcoming") {
        currentMatchMode = "upcoming";
        document.querySelectorAll(".match-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === "upcoming"));
        renderMatches();
        return true;
      }
      if (action === "set_mode_live") {
        currentMatchMode = "live";
        document.querySelectorAll(".match-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === "live"));
        renderMatches();
        return true;
      }
      if (action === "set_mode_finished") {
        currentMatchMode = "finished";
        document.querySelectorAll(".match-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === "finished"));
        renderMatches();
        return true;
      }
      if (action === "set_mode_turbo") {
        currentMatchMode = "turbo";
        document.querySelectorAll(".match-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === "turbo"));
        renderMatches();
        return true;
      }
      if (action === "set_mode_finder") {
        currentMatchMode = "finder";
        document.querySelectorAll(".match-mode").forEach((b) => b.classList.toggle("active", b.dataset.mode === "finder"));
        renderMatches();
        return true;
      }
      if (action === "set_league") {
        const select = document.getElementById("leagueSelect");
        const league = String(payload?.league || payload?.value || "all");
        if (select) {
          const exists = Array.from(select.options).some((o) => o.value === league);
          select.value = exists ? league : "all";
          renderMatches();
          return true;
        }
        return false;
      }
      if (action === "open_coupon_page") {
        window.location.href = "/coupon.html";
        return true;
      }
      if (action === "open_denicheur_modal") {
        openDenicheurModal();
        return true;
      }
      if (action === "open_match_first") {
        const first = (allMatches || []).find((m) => m?.id);
        if (first?.id) {
          window.location.href = `/match.html?id=${encodeURIComponent(first.id)}`;
          return true;
        }
        return false;
      }
      if (action === "set_low_data") {
        const desired = typeof payload?.enabled === "boolean" ? payload.enabled : !isLowDataModeEnabled();
        const toggle = document.getElementById("lowDataToggle");
        if (toggle) toggle.checked = Boolean(desired);
        setLowDataMode(Boolean(desired));
        return true;
      }
      return false;
    },
  };
}

registerHomeSiteControl();
renderFrontlineStatus();
