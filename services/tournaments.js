/**
 * Service Tournois - Inspiré de penaltyS
 * Récupération et filtrage des tournois FIFA Penalty
 */

const axios = require('axios');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vérifie si un tournoi est un tournoi Penalty
 */
function isPenaltyTournament(tournament) {
  const keywords = [
    'penalty',
    'penalties',
    'tir au but',
    'tirs au but',
    'shootout',
    'penaltis'
  ];
  
  const text = normalizeText(tournament.name || tournament.league || '');
  return keywords.some(keyword => text.includes(normalizeText(keyword)));
}

/**
 * Extrait la version FIFA du nom du tournoi
 */
function extractFifaVersion(tournamentName) {
  const normalized = normalizeText(tournamentName);
  const match = normalized.match(/(fc\s*\d+|fifa\d+|fc\d+\.?)/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Fallback tournois pré-configurés
 */
const FALLBACK_TOURNAMENTS = [
  { id: 2952096, name: 'FC26. Penalty', sportId: 85, gamesCount: 120, isPenalty: true, version: 'FC26', priority: 10 },
  { id: 2812138, name: 'FC25. Penalty', sportId: 85, gamesCount: 150, isPenalty: true, version: 'FC25', priority: 9 },
  { id: 2627439, name: 'FC24. Penalty', sportId: 85, gamesCount: 180, isPenalty: true, version: 'FC24', priority: 8 },
  { id: 2551768, name: 'FIFA23. Penalty', sportId: 85, gamesCount: 200, isPenalty: true, version: 'FIFA23', priority: 7 },
  { id: 2334988, name: 'Penalty', sportId: 85, gamesCount: 250, isPenalty: true, version: null, priority: 6 },
  { id: 1939256, name: 'Penalty (ancien)', sportId: 85, gamesCount: 300, isPenalty: true, version: null, priority: 5 },
  { id: 2952097, name: 'FC26. 5x5 Rush', sportId: 85, gamesCount: 100, isPenalty: false, version: 'FC26', priority: 4 },
  { id: 2812139, name: 'FC25. 4x4', sportId: 85, gamesCount: 110, isPenalty: false, version: 'FC25', priority: 3 },
  { id: 2627440, name: 'FC24. 3x3', sportId: 85, gamesCount: 90, isPenalty: false, version: 'FC24', priority: 2 },
  { id: 2551769, name: 'FIFA23. 1x1', sportId: 85, gamesCount: 80, isPenalty: false, version: 'FIFA23', priority: 1 },
  { id: 2952098, name: 'FC26. Champions', sportId: 85, gamesCount: 60, isPenalty: false, version: 'FC26', priority: 3 },
  { id: 2812140, name: 'FC25. Europe', sportId: 85, gamesCount: 70, isPenalty: false, version: 'FC25', priority: 2 },
  { id: 2627441, name: 'FC24. Espagne', sportId: 85, gamesCount: 65, isPenalty: false, version: 'FC24', priority: 2 },
  { id: 2551770, name: 'FIFA23. Angleterre', sportId: 85, gamesCount: 55, isPenalty: false, version: 'FIFA23', priority: 1 },
  { id: 2334989, name: 'FIFA22. Allemagne', sportId: 85, gamesCount: 50, isPenalty: false, version: 'FIFA22', priority: 1 },
  { id: 1939257, name: 'FIFA18. Italie', sportId: 85, gamesCount: 45, isPenalty: false, version: 'FIFA18', priority: 1 },
  { id: 2952099, name: 'FC26. France', sportId: 85, gamesCount: 40, isPenalty: false, version: 'FC26', priority: 1 }
];

/**
 * Récupère les tournois depuis l'API 1xBet
 */
async function fetchTournamentsFromAPI(options = {}) {
  const {
    penaltyOnly = false,
    days = 7,
    sportId = 85,
    ref = '285'
  } = options;

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dateFrom = now - (days * dayMs);
  const dateTo = now + (days * dayMs);

  const url = `https://1xbet.ci/service-api/result/web/api/v2/champs`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': 'https://1xbet.ci',
    'Referer': 'https://1xbet.ci/fr/live/fifa'
  };

  try {
    const response = await axios.get(url, {
      headers,
      params: {
        lng: 'fr',
        ref,
        sportIds: String(sportId),
        dateFrom: Math.floor(dateFrom / 1000),
        dateTo: Math.floor(dateTo / 1000)
      },
      timeout: 10000
    });

    if (response.data && Array.isArray(response.data.Value)) {
      let tournaments = response.data.Value.map(t => ({
        id: t.I || t.id,
        name: t.L || t.name || t.league,
        sportId: t.SI || t.sportId || sportId,
        gamesCount: t.G || t.gamesCount || 0,
        image: t.II || t.image || null,
        isPenalty: isPenaltyTournament(t),
        version: extractFifaVersion(t.L || t.name || t.league),
        priority: 0
      }));

      // Filtrer si penaltyOnly
      if (penaltyOnly) {
        tournaments = tournaments.filter(t => t.isPenalty);
      }

      // Trier par priorité (version FIFA d'abord)
      tournaments.sort((a, b) => {
        const versionOrder = { 'FC26': 10, 'FC25': 9, 'FC24': 8, 'FIFA23': 7, 'FIFA22': 6, 'FIFA18': 5 };
        const aVersion = versionOrder[a.version] || 0;
        const bVersion = versionOrder[b.version] || 0;
        return bVersion - aVersion || b.gamesCount - a.gamesCount;
      });

      return tournaments;
    }

    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération des tournois:', error.message);
    return [];
  }
}

/**
 * Récupère les tournois avec fallback
 */
async function getTournaments(options = {}) {
  const {
    penaltyOnly = false,
    days = 7,
    useFallback = true
  } = options;

  try {
    const tournaments = await fetchTournamentsFromAPI({ penaltyOnly, days });
    
    if (tournaments.length > 0) {
      return tournaments;
    }

    if (useFallback) {
      console.log('Utilisation des tournois fallback');
      let fallback = FALLBACK_TOURNAMENTS;
      
      if (penaltyOnly) {
        fallback = fallback.filter(t => t.isPenalty);
      }
      
      return fallback;
    }

    return [];
  } catch (error) {
    console.error('Erreur dans getTournaments:', error.message);
    
    if (useFallback) {
      let fallback = FALLBACK_TOURNAMENTS;
      
      if (penaltyOnly) {
        fallback = fallback.filter(t => t.isPenalty);
      }
      
      return fallback;
    }

    return [];
  }
}

/**
 * Récupère uniquement les tournois Penalty
 */
async function getPenaltyTournaments(options = {}) {
  return getTournaments({ ...options, penaltyOnly: true });
}

/**
 * Récupère un tournoi par ID
 */
async function getTournamentById(tournamentId, options = {}) {
  const tournaments = await getTournaments(options);
  return tournaments.find(t => t.id === tournamentId) || null;
}

/**
 * Récupère les tournois par version FIFA
 */
async function getTournamentsByVersion(version, options = {}) {
  const tournaments = await getTournaments(options);
  const normalizedVersion = normalizeText(version);
  return tournaments.filter(t => 
    t.version && normalizeText(t.version) === normalizedVersion
  );
}

/**
 * Statistiques sur les tournois
 */
function getTournamentStats(tournaments) {
  const stats = {
    total: tournaments.length,
    penalty: tournaments.filter(t => t.isPenalty).length,
    nonPenalty: tournaments.filter(t => !t.isPenalty).length,
    versions: {},
    totalGames: tournaments.reduce((sum, t) => sum + (t.gamesCount || 0), 0)
  };

  tournaments.forEach(t => {
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
  FALLBACK_TOURNAMENTS
};
