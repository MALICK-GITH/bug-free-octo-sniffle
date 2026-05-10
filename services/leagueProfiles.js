function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LEAGUE_PROFILES = [
  {
    key: "fc25_champions_league",
    title: "FC 25 / FC 26 Champions League",
    aliases: ["champions league", "fc 25 champions league", "fc 26 champions league", "fc25 champions league"],
    tempo: "45-60 sec",
    offenseStrong: [85, 95],
    offenseWeak: [60, 70],
    volatility: "elevee",
    comeback: "elevee",
    goalCenter: 3.1,
    goalBias: 0.75,
    exactScoreAllowed: true,
    exactScoreWeight: 1.2,
    reliabilityBoost: -2,
    recommendedMarkets: ["over 2.5", "btts oui"],
    avoidMarkets: ["under 1.5", "clean sheet", "martingale", "score exact"],
    note:
      "Script pour l'excitation: buts frequents, clean sheets rares et remontees de score plus probables en fin de match.",
  },
  {
    key: "fc25_ligue_europeenne",
    title: "FC 25 Ligue Europeenne",
    aliases: ["ligue europeenne", "fc 25 ligue europeenne", "fc25 ligue europeenne"],
    tempo: "60-75 sec",
    offenseStrong: [55, 65],
    offenseWeak: [30, 40],
    volatility: "basse",
    comeback: "faible",
    goalCenter: 1.6,
    goalBias: -0.7,
    exactScoreAllowed: true,
    exactScoreWeight: 0.9,
    reliabilityBoost: 4,
    recommendedMarkets: ["under 2.5", "under 3.5", "double chance"],
    avoidMarkets: ["over 3.5", "btts oui", "score exact eleve", "martingale"],
    note: "Script prudent, rythme lent et fins de match fermees.",
  },
  {
    key: "fc25_italy_championship",
    title: "FC 25 Italy Championship",
    aliases: ["italy championship", "fc 25 italy championship", "italy", "italie"],
    tempo: "75-90 sec",
    offenseStrong: [45, 55],
    offenseWeak: [20, 30],
    volatility: "très basse",
    comeback: "très faible",
    goalCenter: 1.3,
    goalBias: -0.85,
    exactScoreAllowed: true,
    exactScoreWeight: 0.82,
    reliabilityBoost: 6,
    recommendedMarkets: ["under 2.5", "under 1.5", "btts non", "score exact 0-0", "score exact 1-0"],
    avoidMarkets: ["over", "btts oui", "martingale"],
    note: "Le script le plus defensif: 0-0 et 1-0 sont des scenarios naturels.",
  },
  {
    key: "fc25_germany_championship",
    title: "FC 25 Championnat d'Allemagne",
    aliases: ["championnat d allemagne", "bundesliga", "fc 25 championnat d allemagne", "fc25 bundesliga"],
    tempo: "45-55 sec",
    offenseStrong: [80, 90],
    offenseWeak: [55, 70],
    volatility: "elevee",
    comeback: "elevee",
    goalCenter: 3.0,
    goalBias: 0.68,
    exactScoreAllowed: true,
    exactScoreWeight: 1.14,
    reliabilityBoost: -1,
    recommendedMarkets: ["over 2.5", "btts oui", "over 3.5"],
    avoidMarkets: ["under 1.5", "martingale agressive"],
    note: "Transitions rapides, defenses poreuses et buts tardifs plus frequents.",
  },
  {
    key: "fc25_england_championship",
    title: "FC 25 Championnat d'Angleterre",
    aliases: ["championnat d angleterre", "premier league", "fc 25 championnat d angleterre", "fc25 premier league"],
    tempo: "50-65 sec",
    offenseStrong: [70, 80],
    offenseWeak: [45, 55],
    volatility: "moyenne",
    comeback: "moyenne",
    goalCenter: 2.3,
    goalBias: 0.25,
    exactScoreAllowed: true,
    exactScoreWeight: 1.0,
    reliabilityBoost: 1,
    recommendedMarkets: ["over 1.5", "victoire favori", "btts oui"],
    avoidMarkets: ["under 0.5", "score exact sans couverture"],
    note: "Profil equilibre, bon terrain d'observation pour les favoris et les buts moderes.",
  },
  {
    key: "fc25_spain_championship",
    title: "FC 25 Championnat d'Espagne",
    aliases: ["championnat d espagne", "la liga", "fc 25 championnat d espagne", "fc25 la liga"],
    tempo: "65-80 sec",
    offenseStrong: [60, 70],
    offenseWeak: [35, 45],
    volatility: "basse",
    comeback: "faible",
    goalCenter: 1.8,
    goalBias: -0.4,
    exactScoreAllowed: true,
    exactScoreWeight: 0.94,
    reliabilityBoost: 3,
    recommendedMarkets: ["under 3.5", "under 2.5", "under 1.5 equipe outsider"],
    avoidMarkets: ["over 4.5", "multi-goals sans analyse"],
    note: "Possession stérile et scores souvent fermes.",
  },
  {
    key: "fc25_world_championship",
    title: "FC 25 / FC 26 Championnat du Monde",
    aliases: ["championnat du monde", "world cup", "fc 25 championnat du monde", "fc26 championnat du monde"],
    tempo: "50-70 sec",
    offenseStrong: [65, 85],
    offenseWeak: [40, 65],
    volatility: "elevee",
    comeback: "tres elevee",
    goalCenter: 2.2,
    goalBias: 0.1,
    exactScoreAllowed: true,
    exactScoreWeight: 0.95,
    reliabilityBoost: -3,
    recommendedMarkets: ["double chance", "under 3.5"],
    avoidMarkets: ["victoire simple sur favori", "score exact", "combinés multiples"],
    note: "Mode surprise: les favoris forts peuvent etre renverses.",
  },
  {
    key: "fc25_conference_3x3",
    title: "FC 25 3x3 Ligue de Conference",
    aliases: ["3x3", "3x3 ligue de conference", "ligue de conference"],
    tempo: "30-40 sec",
    offenseStrong: [95, 95],
    offenseWeak: [95, 95],
    volatility: "extreme",
    comeback: "extreme",
    goalCenter: 8.9,
    goalBias: 1.0,
    exactScoreAllowed: false,
    exactScoreWeight: 0.1,
    reliabilityBoost: -12,
    recommendedMarkets: ["over 4.5", "btts oui"],
    avoidMarkets: ["tout le reste", "martingale"],
    note: "Spectacle pur, score exact peu pertinent.",
  },
  {
    key: "fc25_rush_5x5",
    title: "FC 26 / FC 25 5x5 Rush Superligue",
    aliases: ["5x5", "5x5 rush", "rush superligue", "superligue"],
    tempo: "30-45 sec",
    offenseStrong: [100, 100],
    offenseWeak: [100, 100],
    volatility: "extreme",
    comeback: "extreme",
    goalCenter: 7.8,
    goalBias: 1.0,
    exactScoreAllowed: false,
    exactScoreWeight: 0.1,
    reliabilityBoost: -14,
    recommendedMarkets: ["over 3.5"],
    avoidMarkets: ["tout le reste", "martingale"],
    note: "Futsal virtuel ultra rapide, aucun vrai avantage sur le score exact.",
  },
  {
    key: "penalty_modes",
    title: "Tous les modes Penalty",
    aliases: ["penalty", "penalties", "tir au but", "tirs au but", "shootout", "penaltis"],
    tempo: "quelques secondes",
    offenseStrong: [50, 50],
    offenseWeak: [50, 50],
    volatility: "absolue",
    comeback: "nulle",
    goalCenter: null,
    goalBias: 0,
    exactScoreAllowed: false,
    exactScoreWeight: 0,
    reliabilityBoost: -20,
    recommendedMarkets: [],
    avoidMarkets: ["tout"],
    note: "RNG pur, aucun moteur de score exact utile ici.",
  },
];

function getLeagueProfile(league = "") {
  const target = normalizeText(league);
  if (!target) return null;
  return (
    LEAGUE_PROFILES.find((profile) =>
      profile.aliases.some((alias) => target.includes(normalizeText(alias)) || normalizeText(alias).includes(target))
    ) || null
  );
}

function scoreMarketAgainstProfile(profile, marketName = "") {
  if (!profile) return 0;
  const text = normalizeText(marketName);
  if (!text) return 0;
  let score = 0;
  const recommended = profile.recommendedMarkets.map(normalizeText);
  const avoid = profile.avoidMarkets.map(normalizeText);
  if (recommended.some((item) => text.includes(item))) score += 8;
  if (avoid.some((item) => item !== "tout" && text.includes(item))) score -= 10;
  if (profile.goalBias > 0 && (text.includes("plus") || text.includes("over") || text.includes("btts oui"))) score += 4;
  if (profile.goalBias < 0 && (text.includes("moins") || text.includes("under") || text.includes("btts non"))) score += 4;
  if (profile.exactScoreAllowed === false && text.includes("score exact")) score -= 12;
  return score;
}

function weightExactScoreProbability(profile, totalGoals, probability) {
  if (!profile || !Number.isFinite(Number(probability))) return probability;
  if (profile.exactScoreAllowed === false) return probability;
  const goals = Number(totalGoals);
  const center = Number.isFinite(profile.goalCenter) ? profile.goalCenter : 2.5;
  const bias = Number(profile.goalBias || 0);
  const delta = Number.isFinite(goals) ? goals - center : 0;
  const factor = clamp(1 + delta * bias * 0.12, 0.45, 1.65);
  return Number((Number(probability) * factor).toFixed(6));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLeagueProfileSummary(profile) {
  if (!profile) return null;
  return {
    key: profile.key,
    title: profile.title,
    tempo: profile.tempo,
    offenseStrong: profile.offenseStrong,
    offenseWeak: profile.offenseWeak,
    volatility: profile.volatility,
    comeback: profile.comeback,
    exactScoreAllowed: profile.exactScoreAllowed,
    recommendedMarkets: profile.recommendedMarkets,
    avoidMarkets: profile.avoidMarkets,
    note: profile.note,
  };
}

function getLeagueProfiles() {
  return LEAGUE_PROFILES.map(getLeagueProfileSummary);
}

module.exports = {
  getLeagueProfile,
  getLeagueProfileSummary,
  getLeagueProfiles,
  scoreMarketAgainstProfile,
  weightExactScoreProbability,
};
