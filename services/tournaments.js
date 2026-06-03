/**
 * Service Tournois - alimented by the current LiveFeed provider
 * Retrieval and filtering of FIFA penalty tournaments
 */

const axios = require("axios");

const LIVEFEED_TOURNAMENT_API_URL =
  "https://888starz.bet/service-api/LiveFeed/Get1x2_VZip?sports=85&count=1000&lng=fr&gr=789&mode=4&country=96&partner=233&getEmpty=true&virtualSports=true&noFilterBlockEvent=true";
const LIVEFEED_TOURNAMENT_ORIGIN = new URL(LIVEFEED_TOURNAMENT_API_URL).origin;
const LIVEFEED_TOURNAMENT_PAGE_URL = `${LIVEFEED_TOURNAMENT_ORIGIN}/fr/live/football`;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPenaltyTournament(tournament) {
  const keywords = [
    "penalty",
    "penalties",
    "tir au but",
    "tirs au but",
    "shootout",
    "penaltis",
  ];

  const text = normalizeText(tournament?.name || tournament?.league || tournament?.L || tournament?.LE || tournament?.TN || "");
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function extractFifaVersion(tournamentName) {
  const normalized = normalizeText(tournamentName);
  const match = normalized.match(/(fc\s*\d+|fifa\d+|fc\d+\.?)/i);
  return match ? match[0].toUpperCase() : null;
}

function buildTournamentHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    Origin: LIVEFEED_TOURNAMENT_ORIGIN,
    Referer: LIVEFEED_TOURNAMENT_PAGE_URL,
  };
}

function normalizeUnixTime(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (numeric > 1e12) return Math.floor(numeric / 1000);
  return Math.floor(numeric);
}

function toTournamentId(event, fallbackIndex = 0) {
  const rawId =
    event?.TN ||
    event?.LE ||
    event?.L ||
    event?.I ||
    event?.id ||
    event?.matchId ||
    event?.league ||
    event?.competition;
  const normalized = String(rawId || "").trim();
  return normalized || `tournament-${fallbackIndex}`;
}

function collectTournamentRows(payload) {
  if (!payload || typeof payload !== "object") return [];
  const rows = Array.isArray(payload.Value) ? payload.Value : [];
  return rows.filter((row) => row && typeof row === "object");
}

const FALLBACK_TOURNAMENTS = [
  { id: "fc26-penalty", name: "FC26. Penalty", sportId: 85, gamesCount: 120, isPenalty: true, version: "FC26", priority: 10 },
  { id: "fc25-penalty", name: "FC25. Penalty", sportId: 85, gamesCount: 150, isPenalty: true, version: "FC25", priority: 9 },
  { id: "fc24-penalty", name: "FC24. Penalty", sportId: 85, gamesCount: 180, isPenalty: true, version: "FC24", priority: 8 },
  { id: "fifa23-penalty", name: "FIFA23. Penalty", sportId: 85, gamesCount: 200, isPenalty: true, version: "FIFA23", priority: 7 },
  { id: "penalty", name: "Penalty", sportId: 85, gamesCount: 250, isPenalty: true, version: null, priority: 6 },
  { id: "penalty-ancien", name: "Penalty (ancien)", sportId: 85, gamesCount: 300, isPenalty: true, version: null, priority: 5 },
  { id: "fc26-5x5-rush", name: "FC26. 5x5 Rush", sportId: 85, gamesCount: 100, isPenalty: false, version: "FC26", priority: 4 },
  { id: "fc25-4x4", name: "FC25. 4x4", sportId: 85, gamesCount: 110, isPenalty: false, version: "FC25", priority: 3 },
  { id: "fc24-3x3", name: "FC24. 3x3", sportId: 85, gamesCount: 90, isPenalty: false, version: "FC24", priority: 2 },
  { id: "fifa23-1x1", name: "FIFA23. 1x1", sportId: 85, gamesCount: 80, isPenalty: false, version: "FIFA23", priority: 1 },
  { id: "fc26-champions", name: "FC26. Champions", sportId: 85, gamesCount: 60, isPenalty: false, version: "FC26", priority: 3 },
  { id: "fc25-europe", name: "FC25. Europe", sportId: 85, gamesCount: 70, isPenalty: false, version: "FC25", priority: 2 },
  { id: "fc24-espagne", name: "FC24. Espagne", sportId: 85, gamesCount: 65, isPenalty: false, version: "FC24", priority: 2 },
  { id: "fifa23-angleterre", name: "FIFA23. Angleterre", sportId: 85, gamesCount: 55, isPenalty: false, version: "FIFA23", priority: 1 },
  { id: "fifa22-allemagne", name: "FIFA22. Allemagne", sportId: 85, gamesCount: 50, isPenalty: false, version: "FIFA22", priority: 1 },
  { id: "fifa18-italie", name: "FIFA18. Italie", sportId: 85, gamesCount: 45, isPenalty: false, version: "FIFA18", priority: 1 },
  { id: "fc26-france", name: "FC26. France", sportId: 85, gamesCount: 40, isPenalty: false, version: "FC26", priority: 1 },
];

async function fetchTournamentsFromAPI(options = {}) {
  const {
    penaltyOnly = false,
    days = 7,
    sportId = 85,
  } = options;

  const maxAgeSeconds = clamp(Number(days) || 7, 1, 30) * 24 * 60 * 60;
  const nowSeconds = Math.floor(Date.now() / 1000);

  try {
    const response = await axios.get(LIVEFEED_TOURNAMENT_API_URL, {
      headers: buildTournamentHeaders(),
      timeout: 10000,
    });

    const events = collectTournamentRows(response.data);
    const tournamentsById = new Map();

    events.forEach((event, index) => {
      const name = String(event.L || event.LE || event.TN || event.N || event.league || event.competition || "").trim() || "Tournoi";
      const normalizedStart = normalizeUnixTime(event.S ?? event.startTimeUnix ?? event.startTime ?? event.start);
      if (normalizedStart && Math.abs(normalizedStart - nowSeconds) > maxAgeSeconds) {
        return;
      }

      const tournament = {
        id: toTournamentId(event, index),
        name,
        sportId: Number(event.SI || event.sportId || sportId) || sportId,
        gamesCount: 1,
        image: Array.isArray(event.O1IMG) && event.O1IMG.length ? event.O1IMG[0] : Array.isArray(event.O2IMG) && event.O2IMG.length ? event.O2IMG[0] : null,
        isPenalty: isPenaltyTournament(event),
        version: extractFifaVersion(name),
        priority: 0,
      };

      if (penaltyOnly && !tournament.isPenalty) {
        return;
      }

      const existing = tournamentsById.get(tournament.id);
      if (existing) {
        existing.gamesCount += 1;
        existing.priority = Math.max(existing.priority, tournament.priority);
        if (!existing.image && tournament.image) {
          existing.image = tournament.image;
        }
        return;
      }

      tournamentsById.set(tournament.id, tournament);
    });

    const tournaments = Array.from(tournamentsById.values());
    tournaments.sort((a, b) => {
      const versionOrder = { FC26: 10, FC25: 9, FC24: 8, FIFA23: 7, FIFA22: 6, FIFA18: 5 };
      const aVersion = versionOrder[a.version] || 0;
      const bVersion = versionOrder[b.version] || 0;
      return bVersion - aVersion || b.gamesCount - a.gamesCount || a.name.localeCompare(b.name);
    });

    return tournaments;
  } catch (error) {
    console.error("Erreur lors de la recuperation des tournois LiveFeed:", error.message);
    return [];
  }
}

async function getTournaments(options = {}) {
  const {
    penaltyOnly = false,
    days = 7,
    useFallback = true,
  } = options;

  try {
    const tournaments = await fetchTournamentsFromAPI({ penaltyOnly, days });

    if (tournaments.length > 0) {
      return tournaments;
    }

    if (useFallback) {
      console.log("Utilisation des tournois fallback LiveFeed");
      let fallback = FALLBACK_TOURNAMENTS;

      if (penaltyOnly) {
        fallback = fallback.filter((t) => t.isPenalty);
      }

      return fallback;
    }

    return [];
  } catch (error) {
    console.error("Erreur dans getTournaments LiveFeed:", error.message);

    if (useFallback) {
      let fallback = FALLBACK_TOURNAMENTS;

      if (penaltyOnly) {
        fallback = fallback.filter((t) => t.isPenalty);
      }

      return fallback;
    }

    return [];
  }
}

async function getPenaltyTournaments(options = {}) {
  return getTournaments({ ...options, penaltyOnly: true });
}

async function getTournamentById(tournamentId, options = {}) {
  const tournaments = await getTournaments(options);
  return tournaments.find((t) => String(t.id) === String(tournamentId)) || null;
}

async function getTournamentsByVersion(version, options = {}) {
  const tournaments = await getTournaments(options);
  const normalizedVersion = normalizeText(version);
  return tournaments.filter((t) => t.version && normalizeText(t.version) === normalizedVersion);
}

function getTournamentStats(tournaments) {
  const stats = {
    total: tournaments.length,
    penalty: tournaments.filter((t) => t.isPenalty).length,
    nonPenalty: tournaments.filter((t) => !t.isPenalty).length,
    versions: {},
    totalGames: tournaments.reduce((sum, t) => sum + (t.gamesCount || 0), 0),
  };

  tournaments.forEach((t) => {
    if (t.version) {
      stats.versions[t.version] = (stats.versions[t.version] || 0) + 1;
    }
  });

  return stats;
}

module.exports = {
  isPenaltyTournament,
  extractFifaVersion,
  fetchTournamentsFromAPI,
  getTournaments,
  getPenaltyTournaments,
  getTournamentById,
  getTournamentsByVersion,
  getTournamentStats,
  FALLBACK_TOURNAMENTS,
};
