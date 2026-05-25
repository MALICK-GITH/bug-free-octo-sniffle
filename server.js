const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const crypto = require("crypto");
const express = require("express");
const sharp = require("sharp");
const config = require("./server/config");
const { createHelmetMiddleware, csrfProtection, requestTimingLogger } = require("./server/middleware/security");
const { apiNotFound, errorHandler } = require("./server/middleware/errors");
const {
  validateBody,
  validateQuery,
  couponGenerateSchema,
  couponValidateSchema,
  couponFavoriteSchema,
  watchlistQuerySchema,
  watchlistSchema,
  mobileDeviceRegisterSchema,
  patternsReportSchema,
  chatSchema,
  printCouponSchema,
  updateHistorySchema,
} = require("./server/utils/validation");
const { registerSystemRoutes } = require("./server/routes/system");
const { registerAdvancedPredictionRoutes } = require("./server/routes/advancedPrediction");
const { API_URL, getPenaltyMatches, getStructure, getMatchPredictionDetails, getCouponSelection, validateCouponTicket } = require("./services/liveFeed");
const { getLeagueProfiles } = require("./services/leagueProfiles");
const { toFeatures, deduplicate, extractRules, buildDecisionEngine, toTrainReadyCSV } = require("./services/patternEngineV2");
const {
  saveCouponGeneration,
  saveCouponValidation,
  saveTelegramLog,
  saveAuditReport,
  saveGeneratedAsset,
  getGeneratedAssets,
  deleteGeneratedAsset,
  deleteGeneratedAssets,
  getCouponHistory,
  getTelegramHistory,
  saveUpdateEntry,
  getUpdateHistory,
  getAuditHistory,
  saveFavorite,
  getFavorites,
  saveWatchlist,
  getWatchlist,
  registerMobileDevice,
  upsertTelegramSession,
  getTelegramSession: getStoredTelegramSession,
} = require("./services/db");

const authDb = require("./services/database");
const legacyDbService = require("./services/db");
const getDbStatus = (...args) => authDb.getDbStatus(...args);

const app = express();
const DEFAULT_PORT = config.port;
const MAX_PORT_TRIES = config.maxPortTries;
const CHAT_RATE_LIMIT_WINDOW_MS = config.chatRateLimitWindowMs;
const CHAT_RATE_LIMIT_MAX = config.chatRateLimitMax;
const chatRateState = new Map();
const HEAVY_POST_WINDOW_MS = config.heavyPostWindowMs;
const HEAVY_POST_MAX = config.heavyPostMax;
const heavyPostState = new Map();
const SERVER_STARTED_AT = Date.now();
const CHAT_IO_TIMEOUT_MS = config.chatIoTimeoutMs;
const CHAT_PROVIDER_TIMEOUT_MS = config.chatProviderTimeoutMs;
const MOBILE_API_VERSION = config.mobileApiVersion;
const ANDROID_MIN_SDK = config.androidMinSdk;
const ANDROID_TARGET_SDK = config.androidTargetSdk;
const ANDROID_PACKAGE_NAME = config.androidPackageName;
const telegramSessionState = new Map();
const matchTrackingConfig = {
  enabled: String(process.env.MATCH_TRACKER_ENABLED || "1").trim() !== "0",
  intervalSeconds: Math.max(20, Number(process.env.MATCH_TRACKER_INTERVAL_SECONDS) || 60),
  trackerKey: String(process.env.MATCH_TRACKER_KEY || "default").trim() || "default",
};
let matchTrackingTimer = null;
let matchTrackingRunning = false;
let matchTrackingRunCount = 0;
let activeServerPort = DEFAULT_PORT;

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(createHelmetMiddleware({ reportOnly: config.cspReportOnly }));
app.use(requestTimingLogger);
app.use(express.json({ limit: config.jsonLimit }));
app.use(express.urlencoded({ extended: false, limit: config.jsonLimit }));
app.use(csrfProtection({ allowedOrigins: config.allowedOrigins }));

app.use(express.static(path.join(__dirname, "public")));

registerSystemRoutes(app, { startedAt: SERVER_STARTED_AT, getDbStatus, dbService: legacyDbService });
registerAdvancedPredictionRoutes(app);

app.use((req, res, next) => {
  if (req.method !== "POST" || !isHeavyPostPath(req.path)) return next();
  if (!canUseHeavyPost(req)) {
    return res.status(429).json({
      success: false,
      error: "Trop de requetes sur cette action. Reessaie dans environ une minute.",
    });
  }
  next();
});

function withTimeout(promise, timeoutMs, fallbackValue = null) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallbackValue);
      }
    }, timeoutMs);

    Promise.resolve(promise)
      .then((v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

function initialsFromName(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FC";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function colorFromName(name = "", salt = 0) {
  let h = 0;
  const s = `${name}|${salt}`;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 78% 46%)`;
}

function normalizeTeamKey(name = "") {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeLookupText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugifyLookup(value = "") {
  return normalizeLookupText(value).replace(/\s+/g, "-");
}

function getMatchId(match = {}) {
  return String(match?.id || "");
}

function getMatchTeams(match = {}) {
  return {
    home: String(match?.teamHome || "").trim(),
    away: String(match?.teamAway || "").trim(),
  };
}

function getMatchLeague(match = {}) {
  return String(match?.league || "").trim() || "Unknown";
}

function getMatchScore(match = {}) {
  const context = normalizePlainObject(match?.context);
  const score = normalizePlainObject(match?.score);
  const home = Number(context.score1 ?? score.S1 ?? score.SA ?? score.H ?? score.Home);
  const away = Number(context.score2 ?? score.S2 ?? score.SB ?? score.A ?? score.Away);
  return {
    home: Number.isFinite(home) ? home : 0,
    away: Number.isFinite(away) ? away : 0,
  };
}

function getMatchMinute(match = {}) {
  const context = normalizePlainObject(match?.context);
  const minute = Number(context.minute);
  return Number.isFinite(minute) ? minute : 0;
}

function getMatchOdds(match = {}) {
  const home = Number(match?.odds1x2?.home);
  const draw = Number(match?.odds1x2?.draw);
  const away = Number(match?.odds1x2?.away);
  return {
    home: Number.isFinite(home) && home > 1 ? home : null,
    draw: Number.isFinite(draw) && draw > 1 ? draw : null,
    away: Number.isFinite(away) && away > 1 ? away : null,
  };
}

function getMatchPrimaryOdd(match = {}) {
  const odds = getMatchOdds(match);
  return odds.home || odds.draw || odds.away || null;
}

function getMatchAverageOdd(match = {}) {
  const values = Object.values(getMatchOdds(match)).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyMatchStatus(match = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Number(match?.startTimeUnix || 0);
  const statusCode = Number(match?.statusCode || 0);
  const info = normalizeLookupText(match?.infoText || "");
  const status = normalizeLookupText(match?.statusText || "");
  const phase = normalizeLookupText(match?.phase || "");
  const minute = getMatchMinute(match);

  const isFinishedByText =
    status.includes("termine") ||
    phase.includes("termine") ||
    info.includes("termine") ||
    statusCode === 3;

  const isUpcomingBySignal =
    statusCode === 128 ||
    info.includes("avant le debut") ||
    status.includes("debut dans");

  const isLiveByText =
    phase.includes("mi temps") ||
    status.includes("minute") ||
    status.includes("mi temps") ||
    info.includes("1ere mi temps") ||
    info.includes("2eme mi temps") ||
    minute > 0;

  if (isFinishedByText) return "finished";
  if (isUpcomingBySignal || start > nowSec) return "upcoming";
  if (isLiveByText) return "live";
  return "live";
}

function getMatchStatusLabel(match = {}) {
  return String(match?.statusText || "").trim() || classifyMatchStatus(match);
}

function matchMatchesTeam(match = {}, teamIdentifier = "") {
  const targetText = normalizeLookupText(teamIdentifier);
  const targetSlug = slugifyLookup(teamIdentifier);
  if (!targetText && !targetSlug) return false;
  return [getMatchTeams(match).home, getMatchTeams(match).away].some((name) => {
    const normalized = normalizeLookupText(name);
    return normalized === targetText || slugifyLookup(name) === targetSlug;
  });
}

function matchMatchesLeague(match = {}, leagueIdentifier = "") {
  const leagueName = getMatchLeague(match);
  const targetText = normalizeLookupText(leagueIdentifier);
  const targetSlug = slugifyLookup(leagueIdentifier);
  if (!targetText && !targetSlug) return false;
  return normalizeLookupText(leagueName) === targetText || slugifyLookup(leagueName) === targetSlug;
}

function getMatchSearchText(match = {}) {
  const teams = getMatchTeams(match);
  return normalizeLookupText([teams.home, teams.away, getMatchLeague(match), getMatchStatusLabel(match)].join(" "));
}

function buildMatchSummary(match = {}, extra = {}) {
  const teams = getMatchTeams(match);
  return {
    matchId: getMatchId(match),
    homeTeam: teams.home,
    awayTeam: teams.away,
    league: getMatchLeague(match),
    status: getMatchStatusLabel(match),
    startTime: Number(match?.startTimeUnix) || null,
    odds: getMatchPrimaryOdd(match),
    ...extra,
  };
}

function buildGeneratedAssetRecord(req = {}, extra = {}) {
  const body = normalizePlainObject(req?.body);
  const fallbackPage = String(req?.headers?.referer || "").trim();
  const page = String(body.sourcePage || body.page || extra.page || fallbackPage).trim() || null;
  const label = String(body.label || extra.label || "").trim() || null;
  return {
    kind: String(extra.kind || body.kind || "image").trim().toLowerCase() || "image",
    page,
    action: String(body.sourceAction || body.action || extra.action || "").trim() || null,
    label,
    fileName: String(body.fileName || body.file_name || extra.fileName || "").trim() || null,
    format: String(body.format || extra.format || "").trim().toLowerCase() || null,
    mimeType: String(body.mimeType || body.mime_type || extra.mimeType || "").trim() || null,
    source: String(body.source || extra.source || "").trim() || null,
    relatedId: String(body.relatedId || body.related_id || extra.relatedId || body.matchId || body.couponId || "").trim() || null,
    asset: normalizePlainObject(extra.asset || body.asset || body.meta || body.payload || {}),
  };
}

function summarizeMatchBuckets(matches = []) {
  return matches.reduce(
    (summary, match) => {
      summary.total += 1;
      const bucket = classifyMatchStatus(match);
      if (bucket === "live") summary.live += 1;
      else if (bucket === "finished") summary.finished += 1;
      else summary.upcoming += 1;
      return summary;
    },
    { total: 0, live: 0, upcoming: 0, finished: 0 }
  );
}

const TEAM_COLOR_MAP = new Map([
  ["manchester city", ["#6CABDD", "#1C2C5B"]],
  ["borussia dortmund", ["#FDE100", "#111111"]],
  ["paris saint germain", ["#004170", "#DA1F3D"]],
  ["liverpool", ["#C8102E", "#00B2A9"]],
  ["arsenal", ["#EF0107", "#063672"]],
  ["tottenham hotspur", ["#132257", "#FFFFFF"]],
  ["chelsea", ["#034694", "#FFFFFF"]],
  ["newcastle united", ["#241F20", "#FFFFFF"]],
  ["manchester united", ["#DA291C", "#FBE122"]],
  ["aston villa", ["#670E36", "#95BFE5"]],
  ["brighton et hove albion", ["#0057B8", "#FFFFFF"]],
  ["fulham", ["#111111", "#CC0000"]],
  ["brentford", ["#D71920", "#111111"]],
  ["west ham united", ["#7A263A", "#1BB1E7"]],
  ["athletic bilbao", ["#D0102A", "#FFFFFF"]],
  ["atletico madrid", ["#C8102E", "#1B3E8A"]],
  ["club atletico de madrid", ["#C8102E", "#1B3E8A"]],
  ["real valladolid", ["#6A2C91", "#FFFFFF"]],
  ["espanyol", ["#0072CE", "#FFFFFF"]],
  ["fiorentine", ["#5E3A8C", "#FFFFFF"]],
  ["fiorentina", ["#5E3A8C", "#FFFFFF"]],
  ["milano", ["#D71920", "#111111"]],
  ["napoli", ["#008FD5", "#FFFFFF"]],
  ["udinese calcio", ["#111111", "#FFFFFF"]],
  ["bergamo calcio", ["#0057B8", "#111111"]],
  ["bologna 1909", ["#A50021", "#12326B"]],
  ["leipzig", ["#E30613", "#002B5C"]],
  ["eintracht", ["#D00027", "#111111"]],
  ["freiburg", ["#111111", "#E30613"]],
  ["werder bremen", ["#008A4B", "#FFFFFF"]],
  ["vfl bochum", ["#0054A6", "#FFFFFF"]],
  ["borussia monchengladbach", ["#111111", "#FFFFFF"]],
  ["ajax", ["#D2122E", "#FFFFFF"]],
  ["anderlecht", ["#4A1F7A", "#FFFFFF"]],
  ["galatasaray", ["#A91917", "#FFB300"]],
  ["olympiacos", ["#D4002A", "#FFFFFF"]],
  ["olympique lyonnais", ["#0E3386", "#DA291C"]],
  ["rangers", ["#005EB8", "#FFFFFF"]],
  ["sporting clube de portugal", ["#00883F", "#FFFFFF"]],
  ["villarreal", ["#FFE100", "#0052A5"]],
]);

function teamColors(name = "") {
  const key = normalizeTeamKey(name);
  for (const [teamKey, colors] of TEAM_COLOR_MAP.entries()) {
    if (key === teamKey || key.includes(teamKey) || teamKey.includes(key)) return colors;
  }
  return [colorFromName(name, 1), colorFromName(name, 2)];
}

function trimText(value, max = 1200) {
  const text = String(value || "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function normalizeUserIdentifier(value, fallback = "anonymous") {
  const safeValue = trimText(value, 120);
  return safeValue || fallback;
}

function normalizeIdList(values, limit = 300) {
  if (!Array.isArray(values)) return [];
  const output = [];
  const seen = new Set();

  for (const value of values) {
    const safeValue = trimText(value, 80);
    if (!safeValue || seen.has(safeValue)) continue;
    seen.add(safeValue);
    output.push(safeValue);
    if (output.length >= limit) break;
  }

  return output;
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseCookies(header = "") {
  return String(header || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex <= 0) return acc;
      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      if (key) acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function buildMobileBootstrapData(dbStatus = {}) {
  return {
    app: {
      name: "ONE-DELUX",
      apiVersion: MOBILE_API_VERSION,
      suggestedAndroidPackage: ANDROID_PACKAGE_NAME,
      minimumSdk: ANDROID_MIN_SDK,
      targetSdk: ANDROID_TARGET_SDK,
      language: "fr",
    },
    readiness: {
      status: "foundation-ready",
      readyForPrototype: true,
      readyForProductionRelease: false,
      summary:
        "Le backend est exploitable pour une app Android prototype, mais il manque encore push reel, billing et durcissement production pour une sortie Play Store propre.",
      releaseBlockers: [
        "Notifications push reelles via Firebase Cloud Messaging",
        "Verification serveur des abonnements Google Play",
        "HTTPS, rotation des secrets et configuration production",
      ],
    },
    backend: {
      database: {
        ok: Boolean(dbStatus?.ok),
        mode: dbStatus?.mode || "unknown",
      },
      keyCapabilities: [
        "matchs live et a venir",
        "details match / prediction",
        "generation et validation coupon",
        "exports PNG/JPG/PDF",
        "historique, favoris, watchlist synchronisable",
        "chat IA unifie",
      ],
      liveTransport: "HTTP polling",
      pwaBaseAlreadyPresent: true,
    },
    android: {
      recommendedModules: [
        "matches",
        "match-detail",
        "coupon-builder",
        "favorites-watchlist",
        "chat",
        "notifications",
        "settings",
      ],
      persistence: [
        "Room pour cache local",
        "DataStore pour preferences",
        "Retrofit/Ktor pour API",
      ],
    },
    endpoints: {
      bootstrap: "/api/mobile/bootstrap",
      openapi: "/api/mobile/openapi",
      health: "/health",
      matchesUpcoming: "/api/matches/upcoming",
      matchesLive: "/api/matches/live",
      matchDetails: "/api/matches/:id/details",
      prediction: "/api/predictions/:matchId",
      couponGenerate: "/api/coupon/generate",
      couponValidate: "/api/coupon/validate",
      couponHistory: "/api/coupon/history",
      favoritesList: "/api/coupon/favorites",
      favoritesCreate: "/api/coupon/favorite",
      watchlistGet: "/api/watchlist",
      watchlistSave: "/api/watchlist",
      deviceRegister: "/api/mobile/devices/register",
      chat: "/api/chat",
    },
  };
}

function getClientKey(req) {
  return String(
    req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      "unknown"
  );
}

function canUseChat(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const state = chatRateState.get(key) || { count: 0, resetAt: now + CHAT_RATE_LIMIT_WINDOW_MS };
  if (now > state.resetAt) {
    state.count = 0;
    state.resetAt = now + CHAT_RATE_LIMIT_WINDOW_MS;
  }
  state.count += 1;
  chatRateState.set(key, state);
  return state.count <= CHAT_RATE_LIMIT_MAX;
}

function isHeavyPostPath(path = "") {
  const p = String(path || "");
  return (
    p.includes("send-telegram") ||
    p.includes("/coupon/pdf") ||
    p.includes("/coupon/image") ||
    p.includes("/pdf/coupon") ||
    p.includes("/download/coupon") ||
    p.includes("/coupon/print")
  );
}

function canUseHeavyPost(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const state = heavyPostState.get(key) || { count: 0, resetAt: now + HEAVY_POST_WINDOW_MS };
  if (now > state.resetAt) {
    state.count = 0;
    state.resetAt = now + HEAVY_POST_WINDOW_MS;
  }
  state.count += 1;
  heavyPostState.set(key, state);
  return state.count <= HEAVY_POST_MAX;
}

function localChatFallback(message, context = {}) {
  const text = normalizeTeamKey(message || "");
  const page = String(context.page || "site");
  const league = String(context.league || "toutes les ligues");
  const matchId = String(context.matchId || "");
  const pageSnapshot = context?.pageSnapshot || null;
  const pageActions = Array.isArray(context?.capabilities?.actions) ? context.capabilities.actions : [];
  const can = (name) => pageActions.includes(name);

  if (page.includes("coupon")) {
    const wantsAggressiveOdd =
      text.includes("cote agressive") ||
      text.includes("côte agressive") ||
      text.includes("agressive") ||
      text.includes("aggressive") ||
      text.includes("cote 5") ||
      text.includes("côte 5");
    const noCouponYet =
      pageSnapshot?.couponState === "empty" ||
      Number(pageSnapshot?.selectionsVisible || 0) === 0;

    if (wantsAggressiveOdd && noCouponYet && can("generate_coupon")) {
      return "Je prends la main sur la page coupon. Je regle un ticket agressif, cible cote 5, puis je lance la generation directement.";
    }

    if (text.includes("controle total") || text.includes("contrôle total") || text.includes("tout savoir") || text.includes("tout controler")) {
      return "Oui. Sur cette page je vois le snapshot temps reel, les selections, la validation, les boutons actifs et les actions que je peux executer. Je peux donc piloter generation, validation, export, Telegram, reset, watchlist et reglages sans te renvoyer vers un bouton.";
    }
  }

  if ((text.includes("tu vois la page") || text.includes("tu vois le site") || text.includes("est ce que tu vois")) && pageSnapshot) {
    const pageType = String(pageSnapshot?.pageType || context?.page || "site");
    const cards = Number(pageSnapshot?.cardsVisible || 0);
    const selections = Number(pageSnapshot?.selectionsVisible || 0);
    return `Oui, je vois la page via le snapshot temps reel (${pageType}). Elements detectes: matchs=${cards}, selections=${selections}. Je peux aussi commenter les boutons, les titres et les actions disponibles.`;
  }

  if (
    text.includes("site") ||
    text.includes("que sais") ||
    text.includes("comment utiliser") ||
    text.includes("mode emploi")
  ) {
    return (
      "Je connais le site et ses zones principales: accueil des matchs live (/), detail match (/match.html?id=...), coupon builder (/coupon.html), " +
      "guide complet (/mode-emploi.html), page createur (/about.html), page developpeur (/developpeur.html), suivi (/suivre.html) et mises a jour (/updates.html). " +
      "Je peux commenter les actions visibles, les selections, les exports et les etats du systeme. " +
      "Pour un coupon propre: choisis taille + ligue + profil risque, genere, valide le ticket, puis exporte en PDF/PNG/JPG ou envoie Telegram."
    );
  }

  if (text.includes("coupon")) {
    return (
      `Mode local actif (API IA indisponible). Sur ${page}, prends un profil Equilibre, ` +
      `3 selections max, cotes entre 1.35 et 2.20, et supprime les matchs deja en cours. ` +
      `Je peux aussi t'aider a relire le ticket, le PDF, le PNG ou l'historique si tu me donnes le contexte.`
    );
  }

  if (text.includes("risque") || text.includes("safe") || text.includes("agressif")) {
    return "Safe: faible cote/haute fiabilite. Equilibre: meilleur compromis. Agressif: grosse cote mais variance plus forte.";
  }

  if (text.includes("match")) {
    return (
      `Mode local actif. Analyse d'abord l'onglet A venir, puis la ligue ${league}. ` +
      `${matchId ? `Pour le match ${matchId}, ` : ""}valide toujours le ticket avant de jouer.`
    );
  }

  if (
    text.includes("bonjour") ||
    text.includes("salut") ||
    text.includes("ca va")
  ) {
    return "Salut. Je suis actif, fluide et pro. Je peux repondre sur le site, sur les actions disponibles, et aussi sur tes questions generales.";
  }

  return "Mode local actif. Je peux repondre aux questions du site et aux questions generales, m'appuyer sur le contexte visible, puis proposer une action concrete si besoin.";
}

function isSiteQuestion(message = "") {
  const text = normalizeTeamKey(message);
  const keys = [
    "site",
    "fifa",
    "fc24",
    "fc25",
    "match",
    "cote",
    "coupon",
    "ticket",
    "telegram",
    "pari",
    "ligue",
    "bankroll",
    "prediction",
    "coach",
    "refresh",
  ];
  return keys.some((k) => text.includes(k));
}

function isRefusalAnswer(answer = "") {
  const t = normalizeTeamKey(answer);
  return (
    t.includes("je ne peux pas repondre") ||
    t.includes("je ne peux pas") ||
    t.includes("je peux pas") ||
    t.includes("je ne suis pas en mesure") ||
    t.includes("je ne peux pas aider")
  );
}

function localGeneralAnswer(message = "") {
  const q = String(message || "").trim();
  const t = normalizeTeamKey(q);
  if (!q) return "Pose ta question et je reponds directement.";
  if (t.includes("pourquoi") && t.includes("ciel") && t.includes("bleu")) {
    return "Le ciel parait bleu car l'atmosphere diffuse plus fortement la lumiere bleue du soleil (diffusion de Rayleigh).";
  }
  if (t.includes("bonjour") || t.includes("salut")) {
    return "Salut. Je suis disponible pour toutes tes questions, site ou general.";
  }
  if (t.includes("comment")) {
    return "Donne-moi le contexte exact et l'objectif, je te reponds avec des etapes simples et directes.";
  }
  if (t.includes("c est quoi") || t.includes("quest ce")) {
    return "Je peux te donner une definition claire. Precise juste le terme a definir si besoin.";
  }
  return `Reponse generale: ${q}. Si tu veux, je peux te donner une version courte, detaillee, ou un exemple concret.`;
}

function localResearchAnswer(message = "", researchContext = "") {
  const lines = String(researchContext || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/.test(line));
  if (!lines.length) return localGeneralAnswer(message);
  const summary = lines
    .slice(0, 2)
    .map((line) => line.replace(/^\d+\.\s*/, ""))
    .join(" | ");
  return `Recherche rapide: ${summary}`;
}

function buildSiteKnowledgeBlock() {
  return [
    "BASE CONNAISSANCE SITE ONE-DELUX (TOUS FORMATS) - Signe SOLITAIRE HACK:",
    "- Pages: / (matchs live), /match.html?id=... (detail match), /coupon.html (coupon builder), /suivre.html (suivi), /updates.html (mises a jour), /mode-emploi.html (guide), /about.html (createur), /developpeur.html (contacts).",
    "- Donnees matchs: API 1xBet LiveFeed (FIFA virtuel global), tri ligue, statut match, cotes 1X2 et marches additionnels.",
    "- Couverture: FC 24, FC 25, et toutes les ligues/formats FIFA virtuels presentes sur le site.",
    "- Detail match: decision maitre, bots, top 3 recommandations, Neural Match Engine, alertes drift cotes, historique et suivi.",
    "- Coupon: generation optimisee par risque (safe/balanced/aggressive), validation ticket, remplacement selections faibles.",
    "- Exports image: rendu unique ONE-DELUX en SVG source, puis sortie PNG ou JPG selon l'export; duo PNG+JPG reste disponible pour l'usage pratique; Telegram image suit le meme rendu signature.",
    "- Exports: PDF coupon (resume/rapide/detaille), impression A4, rapport pro, journal performance, galerie des medias generes.",
    "- Telegram: envoi texte, image (PNG ou JPG selon UI), pack (texte+image+PDF), ladder, et webhook autonome pour piloter le moteur sans ouvrir le site.",
    "- Regle metier critique: aucun coupon garanti gagnant; filtrer de preference les matchs non demarres.",
    "- CONTROLE IA (priorite): le site t'envoie snapshot + liste d'actions disponibles. Tu t'appuies d'abord sur ces donnees, puis sur le contexte runtime, puis sur la recherche web si elle est fournie. Tu expliques clairement ce que tu vois, ce que tu sais et ce qui manque sans inventer.",
    "- STYLE: reponses fluides, amicales, precises, professionnelles, sans tourner autour du pot; si une info manque, indique-le proprement et propose la meilleure alternative.",
    "- Commandes reconnues (non exhaustif): accueil, page coupon, guide, actualise, image png/jpg, duo png jpg, copier coupon, reinitialiser coupon, generer/valider/telegram/pdf, modes match (live, turbo, termines), suivi, historique, mises a jour.",
  ].join("\n");
}

function looksLikeResearchRequest(message = "") {
  const text = normalizeTeamKey(message);
  const keys = [
    "recherche",
    "cherche",
    "search",
    "actualite",
    "news",
    "dernier",
    "derniere",
    "latest",
    "recent",
    "recente",
    "qui est",
    "c est quoi",
    "quest ce",
    "definition",
    "explique",
    "hors match",
    "hors contexte",
  ];
  return keys.some((key) => text.includes(key));
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = CHAT_IO_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWikiSummary(query, lang = "fr") {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
    query
  )}&limit=1&namespace=0&format=json`;
  const search = await fetchJsonWithTimeout(searchUrl, {}, 2200);
  const title = Array.isArray(search?.[1]) ? search[1][0] : "";
  if (!title) return null;

  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const summary = await fetchJsonWithTimeout(summaryUrl, {}, 2200);
  const extract = trimText(summary?.extract || "", 500);
  if (!extract) return null;

  return {
    source: `Wikipedia ${lang.toUpperCase()}`,
    title: trimText(summary?.title || title, 140),
    snippet: extract,
    url: trimText(summary?.content_urls?.desktop?.page || "", 400),
  };
}

async function fetchDuckDuckGoSnippet(query) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await fetchJsonWithTimeout(url, {}, 2200);
  const abstract = trimText(data?.AbstractText || "", 420);
  const related =
    Array.isArray(data?.RelatedTopics) && data.RelatedTopics.length
      ? data.RelatedTopics
          .flatMap((item) => (Array.isArray(item?.Topics) ? item.Topics : [item]))
          .find((item) => trimText(item?.Text || "", 280))
      : null;

  if (abstract) {
    return {
      source: "DuckDuckGo Instant Answer",
      title: trimText(data?.Heading || query, 140),
      snippet: abstract,
      url: trimText(data?.AbstractURL || "", 400),
    };
  }

  if (related?.Text) {
    return {
      source: "DuckDuckGo Related Topic",
      title: trimText(related?.FirstURL || query, 140),
      snippet: trimText(related.Text, 420),
      url: trimText(related?.FirstURL || "", 400),
    };
  }

  return null;
}

async function buildWebResearchContext(message = "") {
  if (!message) return "";
  const shouldSearch = looksLikeResearchRequest(message) || !isSiteQuestion(message);
  if (!shouldSearch) return "";

  const results = [];
  const seen = new Set();
  const candidates = await Promise.allSettled([
    fetchWikiSummary(message, "fr"),
    fetchWikiSummary(message, "en"),
    fetchDuckDuckGoSnippet(message),
  ]);

  for (const item of candidates) {
    if (item.status !== "fulfilled" || !item.value?.snippet) continue;
    const key = `${item.value.source}|${item.value.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item.value);
  }

  if (!results.length) return "";

  return [
    "Recherche web contextuelle disponible:",
    ...results.slice(0, 3).map((item, index) => {
      const url = item.url ? ` | lien: ${item.url}` : "";
      return `${index + 1}. ${item.source} | ${item.title} | ${item.snippet}${url}`;
    }),
    "Utilise ces elements si cela aide a repondre plus juste, surtout pour les questions generales ou demandant une recherche.",
  ].join("\n");
}

function deriveControlActions(message, context = {}) {
  const text = normalizeTeamKey(message || "");
  const actions = [];
  const page = String(context?.page || "");
  const capabilities = Array.isArray(context?.capabilities?.actions) ? context.capabilities.actions : [];
  const can = (name) => capabilities.includes(name);

  if (text.includes("ouvre coupon") || text.includes("page coupon")) {
    actions.push({ type: "open_page", target: "/coupon.html" });
  }
  if (text.includes("ouvre match") && context.matchId) {
    actions.push({ type: "open_page", target: `/match.html?id=${encodeURIComponent(context.matchId)}` });
  }
  if (text.includes("retour match") || text.includes("accueil")) {
    actions.push({ type: "open_page", target: "/" });
  }
  if (text.includes("mode emploi") || text.includes("guide")) {
    actions.push({ type: "open_page", target: "/mode-emploi.html" });
  }
  if (text.includes("page createur") || text.includes("a propos") || text.includes("apropos")) {
    actions.push({ type: "open_page", target: "/about.html" });
  }
  if (text.includes("developpeur") || text.includes("contact dev")) {
    actions.push({ type: "open_page", target: "/developpeur.html" });
  }
  if (text.includes("refresh") || text.includes("actualise") || text.includes("rafraich")) {
    actions.push({ type: "refresh_page" });
  }
  if (text.includes("efface chat") || text.includes("vider chat") || text.includes("clear chat")) {
    actions.push({ type: "clear_chat" });
  }

  const wantsCoupon =
    text.includes("coupon") || text.includes("ticket") || text.includes("parlay");
  const wantsGenerate =
    text.includes("fait") ||
    text.includes("fais") ||
    text.includes("genere") ||
    text.includes("cree") ||
    text.includes("prepare");
  const wantsTelegram =
    text.includes("telegram") ||
    text.includes("tg") ||
    text.includes("balance sur tg") ||
    text.includes("envoie sur tg") ||
    text.includes("envoi sur tg") ||
    text.includes("send tg");
  const wantsPack =
    text.includes("pack") ||
    text.includes("image+pdf+telegram") ||
    text.includes("image pdf telegram");
  const wantsLadder =
    text.includes("ladder") ||
    text.includes("echelle") ||
    text.includes("60/30/10");

  // Controle home
  if (page === "/" || page === "/index.html") {
    if (text.includes("mode live") || text.includes("match en cours")) {
      actions.push({ type: "site_control", name: "set_mode_live" });
    }
    if (text.includes("mode a venir") || text.includes("upcoming")) {
      actions.push({ type: "site_control", name: "set_mode_upcoming" });
    }
    if (text.includes("mode turbo")) {
      actions.push({ type: "site_control", name: "set_mode_turbo" });
    }
    if (text.includes("mode termine")) {
      actions.push({ type: "site_control", name: "set_mode_finished" });
    }
    if (text.includes("actualise match") || text.includes("refresh match")) {
      actions.push({ type: "site_control", name: "refresh_matches" });
    }
  }

  // Controle coupon
  if (page.includes("coupon")) {
    const wantsAggressiveOdd =
      text.includes("cote agressive") ||
      text.includes("côte agressive") ||
      text.includes("agressive") ||
      text.includes("aggressive") ||
      text.includes("cote 5") ||
      text.includes("côte 5");

    if (wantsLadder) {
      actions.push({ type: "site_control", name: "generate_ladder" });
    }
    if (wantsCoupon && wantsGenerate) {
      actions.push({ type: "site_control", name: "generate_coupon" });
    }
    if (text.includes("genere coupon") || text.includes("creer coupon")) {
      actions.push({ type: "site_control", name: "generate_coupon" });
    }
    if (text.includes("valide ticket")) {
      actions.push({ type: "site_control", name: "validate_ticket" });
    }
    if (text.includes("remplace faible")) {
      actions.push({ type: "site_control", name: "replace_weak_pick" });
    }
    if (text.includes("simule bankroll")) {
      actions.push({ type: "site_control", name: "simulate_bankroll" });
    }
    if (text.includes("telegram mini") || text.includes("mini telegram") || text.includes("tg mini")) {
      actions.push({ type: "site_control", name: "send_telegram_mini" });
    }
    if (text.includes("envoie telegram image")) {
      actions.push({ type: "site_control", name: "send_telegram_image" });
    } else if (text.includes("envoie telegram") || wantsTelegram) {
      actions.push({ type: "site_control", name: "send_telegram_text" });
    }
    if (text.includes("envoie pack") || wantsPack || (wantsCoupon && wantsGenerate && wantsTelegram)) {
      actions.push({ type: "site_control", name: "send_telegram_pack" });
    }
    if (wantsLadder && wantsTelegram) {
      actions.push({ type: "site_control", name: "send_ladder_telegram" });
    }
    if (text.includes("pdf rapide")) actions.push({ type: "site_control", name: "download_pdf_quick" });
    if (text.includes("pdf detail")) actions.push({ type: "site_control", name: "download_pdf_detailed" });
    if (text.includes("pdf")) actions.push({ type: "site_control", name: "download_pdf_summary" });
    if (text.includes("print a4") || text.includes("impression a4") || text.includes("ticket imprimable")) {
      actions.push({ type: "site_control", name: "print_a4" });
    }
    if (text.includes("journal performance") || text.includes("analyser journal")) {
      actions.push({ type: "site_control", name: "analyze_journal" });
    }
    if (text.includes("replay journal") || text.includes("journal replay")) {
      actions.push({ type: "site_control", name: "replay_journal" });
    }
    if (text.includes("watchlist")) {
      actions.push({ type: "site_control", name: "build_watchlist" });
    }
    if (text.includes("profil bankroll conservateur")) {
      actions.push({ type: "site_control", name: "set_bankroll_profile", payload: { profile: "conservateur" } });
    } else if (text.includes("profil bankroll attaque")) {
      actions.push({ type: "site_control", name: "set_bankroll_profile", payload: { profile: "attaque" } });
    } else if (text.includes("profil bankroll standard")) {
      actions.push({ type: "site_control", name: "set_bankroll_profile", payload: { profile: "standard" } });
    }
    if (text.includes("simulation live on")) {
      actions.push({ type: "site_control", name: "set_live_simulation", payload: { enabled: true } });
    } else if (text.includes("simulation live off")) {
      actions.push({ type: "site_control", name: "set_live_simulation", payload: { enabled: false } });
    }
    if (text.includes("auto heal on")) {
      actions.push({ type: "site_control", name: "set_auto_heal", payload: { enabled: true } });
    } else if (text.includes("auto heal off")) {
      actions.push({ type: "site_control", name: "set_auto_heal", payload: { enabled: false } });
    }
    if (text.includes("anti chaos on")) {
      actions.push({ type: "site_control", name: "set_anti_chaos", payload: { enabled: true } });
    } else if (text.includes("anti chaos off")) {
      actions.push({ type: "site_control", name: "set_anti_chaos", payload: { enabled: false } });
    }
    if (text.includes("lock pre send on") || text.includes("verrouillage pre envoi on")) {
      actions.push({ type: "site_control", name: "set_pre_send_lock", payload: { enabled: true } });
    } else if (text.includes("lock pre send off") || text.includes("verrouillage pre envoi off")) {
      actions.push({ type: "site_control", name: "set_pre_send_lock", payload: { enabled: false } });
    }
    if (text.includes("low data on")) {
      actions.push({ type: "site_control", name: "set_low_data_mode", payload: { enabled: true } });
    } else if (text.includes("low data off")) {
      actions.push({ type: "site_control", name: "set_low_data_mode", payload: { enabled: false } });
    }
    const wantPng = text.includes("png");
    const wantJpg = text.includes("jpg") || text.includes("jpeg");
    if (text.includes("copie coupon") || text.includes("copier le coupon") || text.includes("copier coupon")) {
      actions.push({ type: "site_control", name: "copy_coupon_text" });
    }
    if (
      text.includes("reinitialise") ||
      text.includes("reinitialiser") ||
      text.includes("reset coupon") ||
      text.includes("vider le coupon")
    ) {
      actions.push({ type: "site_control", name: "reset_coupon_workspace" });
    }
    if (
      text.includes("duo") ||
      text.includes("png et jpg") ||
      text.includes("jpg et png") ||
      text.includes("deux formats")
    ) {
      actions.push({ type: "site_control", name: "download_image_duo", payload: { mode: "default" } });
    }
    if (
      (text.includes("image coupon") || text.includes("telecharge image") || (text.includes("export") && text.includes("image"))) &&
      wantPng
    ) {
      actions.push({ type: "site_control", name: "download_image", payload: { mode: "default", format: "png" } });
    } else if (
      (text.includes("image coupon") || text.includes("telecharge image") || (text.includes("export") && text.includes("image"))) &&
      wantJpg
    ) {
      actions.push({ type: "site_control", name: "download_image", payload: { mode: "default", format: "jpg" } });
    } else if (text.includes("image coupon")) {
      actions.push({ type: "site_control", name: "download_image" });
    }
  }

  // Controle match detail
  if (page.includes("match")) {
    if (text.includes("coach on")) actions.push({ type: "site_control", name: "toggle_coach_mode", payload: { enabled: true } });
    if (text.includes("coach off")) actions.push({ type: "site_control", name: "toggle_coach_mode", payload: { enabled: false } });
    if (text.includes("export 1 clic") || text.includes("export all")) actions.push({ type: "site_control", name: "export_match_all" });
    if (text.includes("match telegram image")) actions.push({ type: "site_control", name: "send_match_telegram_image" });
    if (text.includes("match telegram")) actions.push({ type: "site_control", name: "send_match_telegram_text" });
    if (text.includes("pdf match")) actions.push({ type: "site_control", name: "download_match_pdf" });
    if (text.includes("image match")) actions.push({ type: "site_control", name: "download_match_image" });
    if (text.includes("refresh detail")) actions.push({ type: "site_control", name: "refresh_match_data" });
  }

  // Simple parse "coupon 3 matchs safe"
  const sizeMatch = text.match(/(\d{1,2})\s*match/);
  const isCouponIntent = text.includes("coupon") || text.includes("ticket");
  if (isCouponIntent) {
    const size = sizeMatch ? Math.max(1, Math.min(12, Number(sizeMatch[1]))) : null;
    const risk = text.includes("safe")
      ? "safe"
      : text.includes("agress")
        ? "aggressive"
        : text.includes("equilibre")
          ? "balanced"
          : null;
    const league = context.league && context.league !== "all" ? context.league : null;
    if (size || risk || league) {
      actions.push({
        type: "set_coupon_form",
        size: size || undefined,
        risk: risk || undefined,
        league: league || undefined,
      });
      if (can("set_coupon_form")) {
        actions.push({
          type: "site_control",
          name: "set_coupon_form",
          payload: {
            size: size || undefined,
            risk: risk || undefined,
            league: league || undefined,
          },
        });
      }
    }

    if (wantsAggressiveOdd) {
      actions.push({
        type: "set_coupon_form",
        size: sizeMatch ? Math.max(1, Math.min(12, Number(sizeMatch[1]))) : 5,
        risk: "aggressive",
        league: context.league && context.league !== "all" ? context.league : "all",
      });
      if (can("set_coupon_form")) {
        actions.push({
          type: "site_control",
          name: "set_coupon_form",
          payload: {
            size: sizeMatch ? Math.max(1, Math.min(12, Number(sizeMatch[1]))) : 5,
            risk: "aggressive",
            league: context.league && context.league !== "all" ? context.league : "all",
          },
        });
      }
      if (can("generate_coupon")) {
        actions.push({ type: "site_control", name: "generate_coupon" });
      }
    }
  }

  // Si demande coupon+TG hors page coupon, basculer automatiquement
  if (!page.includes("coupon") && wantsCoupon && wantsGenerate && wantsTelegram) {
    actions.unshift({ type: "open_page", target: "/coupon.html" });
  }

  const priority = (a) => {
    if (a?.type === "set_coupon_form") return 10;
    if (a?.type === "site_control" && a?.name === "set_coupon_form") return 11;
    if (a?.type === "site_control" && a?.name === "generate_ladder") return 18;
    if (a?.type === "site_control" && a?.name === "generate_coupon") return 20;
    if (a?.type === "site_control" && (a?.name === "send_ladder_telegram" || a?.name === "send_telegram_pack" || a?.name === "send_telegram_text" || a?.name === "send_telegram_mini" || a?.name === "send_telegram_image")) return 30;
    return 50;
  };
  return actions.sort((x, y) => priority(x) - priority(y));
}

const runtimeContextCache = {
  at: 0,
  summary: "",
};

async function buildDynamicRuntimeContext({ page, league, matchId }) {
  const lines = [];
  const now = Date.now();

  if (matchId) {
    try {
      const details = await withTimeout(getMatchPredictionDetails(matchId), CHAT_IO_TIMEOUT_MS, null);
      const m = details?.match || {};
      const master = details?.prediction?.maitre?.decision_finale || {};
      lines.push(
        `MATCH_COURANT: ${m.teamHome || "?"} vs ${m.teamAway || "?"} | Ligue: ${m.league || league || "?"} | Pari maitre: ${master.pari_choisi || "N/A"} | Confiance: ${master.confiance_numerique ?? 0}%`
      );
    } catch (_e) {
      lines.push(`MATCH_COURANT: indisponible pour id ${matchId}`);
    }
  }

  // Cache court pour eviter de recharger les matchs a chaque message
  const cacheFresh = now - runtimeContextCache.at < 30_000 && runtimeContextCache.summary;
  if (cacheFresh) {
    lines.push(runtimeContextCache.summary);
  } else {
    try {
      const listing = await withTimeout(getPenaltyMatches(), CHAT_IO_TIMEOUT_MS, null);
      const matches = Array.isArray(listing?.matches) ? listing.matches : [];
      const upcoming = matches.filter((x) => Number(x?.startTimeUnix || 0) > Math.floor(Date.now() / 1000));
      const byLeague = new Map();
      for (const m of upcoming) {
        const key = String(m?.league || "Autre");
        byLeague.set(key, (byLeague.get(key) || 0) + 1);
      }
      const topLeague = [...byLeague.entries()].sort((a, b) => b[1] - a[1])[0];
      const summary =
        `ETAT_SITE: matchs=${matches.length}, a_venir=${upcoming.length}` +
        (topLeague ? `, ligue_top="${topLeague[0]}" (${topLeague[1]})` : "");
      runtimeContextCache.at = now;
      runtimeContextCache.summary = summary;
      lines.push(summary);
    } catch (_e) {
      lines.push("ETAT_SITE: indisponible");
    }
  }

  lines.push(`PAGE_ACTIVE: ${page || "site"}${league ? ` | FILTRE_LIGUE: ${league}` : ""}`);
  return lines.join("\n");
}

function formatOddForTelegram(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : "-";
}

function formatDateTime(value) {
  if (!value && value !== 0) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMatchStartTimeUnix(unixSeconds) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return formatDateTime(n * 1000);
}

function inferExactScoreBias(recommendation = "") {
  const text = normalizeLookupText(recommendation);
  if (!text) return null;

  const bias = {
    outcome: null,
    total: null,
  };

  if (text.includes("plus de") || text.includes("over")) bias.total = "over";
  if (text.includes("moins de") || text.includes("under")) bias.total = "under";

  if (text.includes("victoire domicile") || text === "1" || text.startsWith("1x") || text.includes("domicile")) {
    bias.outcome = "home";
  } else if (
    text.includes("victoire exterieur") ||
    text === "2" ||
    text.endsWith("x2") ||
    text.includes("exterieur") ||
    text.includes("extérieur")
  ) {
    bias.outcome = "away";
  } else if (text.includes("match nul") || text === "x" || text.includes("nul")) {
    bias.outcome = "draw";
  }

  return bias.outcome || bias.total ? bias : null;
}

function exactScoreMatchesBias(score, bias) {
  if (!bias || !score || typeof score !== "string") return true;
  const parts = score.split("-").map((part) => Number(part));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return false;
  const [homeGoals, awayGoals] = parts;
  const totalGoals = homeGoals + awayGoals;

  if (bias.outcome === "home" && homeGoals <= awayGoals) return false;
  if (bias.outcome === "away" && awayGoals <= homeGoals) return false;
  if (bias.outcome === "draw" && homeGoals !== awayGoals) return false;
  if (bias.total === "over" && totalGoals <= 2) return false;
  if (bias.total === "under" && totalGoals > 2) return false;

  return true;
}

function pickAlignedExactScore(exactScore, recommendation = "") {
  const normalized =
    exactScore && typeof exactScore === "object" && "available" in exactScore
      ? exactScore.available
        ? exactScore.value
        : null
      : exactScore;
  if (!normalized || typeof normalized !== "object") return null;

  const bias = inferExactScoreBias(recommendation);
  const primary = normalized.primary && typeof normalized.primary === "object" ? normalized.primary : null;
  const alternatives = Array.isArray(normalized.alternatives) ? normalized.alternatives : [];
  if (!bias) return primary;

  if (primary && exactScoreMatchesBias(primary.score, bias)) return primary;
  const alignedAlternative = alternatives.find((item) => item && exactScoreMatchesBias(item.score, bias));
  return alignedAlternative || primary || null;
}

function buildTelegramCouponText(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const insights = payload.insights || {};
  const riskProfile = String(payload.riskProfile || "balanced");
  const telegramConfidenceScore = Math.max(
    1,
    Math.min(
      100,
      Math.round(
        Number(payload?.telegramConfidenceScore) ||
          Number(summary?.averageConfidence || 0) * 0.45 +
            Number(insights?.reliabilityIndex || 60) * 0.4 +
            (100 - Number(insights?.correlationRisk || 50)) * 0.15
      )
    )
  );
  if (payload?.mini) {
    const top = coupon.slice(0, 3);
    const heroSummary = buildCouponShareHeroSummaryLine(payload);
    const lines = [
      `TICKET MINI | ${riskProfile.toUpperCase()}`,
      `Selections: ${Number(summary.totalSelections) || coupon.length} | Cote combinee: ${formatOddForTelegram(summary.combinedOdd)}`,
      `Confiance moyenne: ${Number(summary.averageConfidence) || 0}%`,
      `Score Telegram: ${telegramConfidenceScore}/100`,
      heroSummary,
      ...top.map((p, i) => `${i + 1}) ${p?.teamHome || "E1"} vs ${p?.teamAway || "E2"} | ${formatOddForTelegram(p?.cote)}`),
      "Lecture concise, efficace et partageable.",
      "Signe: SOLITAIRE HACK",
    ];
    return lines.slice(0, 8).join("\n");
  }
  const lines = [
    "TICKET SIGNATURE ONE-DELUX",
    "Source: ONE-DELUX",
    `Profil de risque: ${riskProfile}`,
    `Selections: ${Number(summary.totalSelections) || coupon.length}`,
    `Cote combinee: ${formatOddForTelegram(summary.combinedOdd)}`,
    `Confiance moyenne: ${Number(summary.averageConfidence) || 0}%`,
    `Score Telegram: ${telegramConfidenceScore}/100`,
    buildCouponShareHeroSummaryLine(payload),
    "",
  ];

  coupon.forEach((pick, index) => {
    lines.push(`${index + 1}. ${pick.teamHome || "Equipe 1"} vs ${pick.teamAway || "Equipe 2"}`);
    lines.push(`Ligue: ${pick.league || "Non specifiee"}`);
    lines.push(`Pari: ${pick.pari || "-"}`);
    lines.push(`Cote: ${formatOddForTelegram(pick.cote)} | Confiance: ${Number(pick.confiance) || 0}%`);
    lines.push("");
  });
  lines.push("Aucune combinaison n'est garantie gagnante, mais le ticket est structure pour rester propre et exploitable.");
  lines.push("Signe: SOLITAIRE HACK");
  return lines.join("\n").slice(0, 3900);
}

function escapeXml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateCouponLabel(text = "", max = 44) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}â€¦`;
}

function getCouponShareLead(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const leagues = new Set(coupon.map((pick) => String(pick?.league || "").trim()).filter(Boolean));
  const lead = coupon[0] || {};
  return {
    lead,
    summary,
    coupon,
    totalSelections: Number(summary.totalSelections) || coupon.length || 0,
    leagueCount: leagues.size || 0,
    generatedAt: formatDateTime(new Date()),
    matchStart: formatMatchStartTimeUnix(lead.startTimeUnix),
    confidence: Number.isFinite(Number(lead.confiance))
      ? Number(lead.confiance)
      : Number(summary.averageConfidence || 0),
  };
}

function buildCouponShareHeroLines(payload = {}) {
  const share = getCouponShareLead(payload);
  const lead = share.lead;
  const recommendation = String(lead.pari || "Aucun").trim();
  const coverLabel = `${share.totalSelections} match${share.totalSelections > 1 ? "s" : ""}`;
  const leagueLabel = `${share.leagueCount} ligue${share.leagueCount > 1 ? "s" : ""}`;
  return [
    "PROJECTION COUPON",
    `Ticket complet: ${coverLabel} | ${leagueLabel}`,
    `Reco principale: ${recommendation}`,
    `Confiance: ${Number(share.confidence || 0).toFixed(1)}%`,
    `Heure match: ${share.matchStart}`,
    `Vue globale du coupon, pas seulement du premier pick.`,
  ];
}

function buildCouponShareHeroSummaryLine(payload = {}) {
  const share = getCouponShareLead(payload);
  const lead = share.lead;
  const confidence = Number(share.confidence || 0).toFixed(1);
  const totalSelections = Number(share.totalSelections) || 0;
  const leagueCount = Number(share.leagueCount) || 0;
  return `Reco: ${lead.pari || "-"} | Conf: ${confidence}% | ${totalSelections} match${totalSelections > 1 ? "s" : ""} | ${leagueCount} ligue${leagueCount > 1 ? "s" : ""}`;
}

function normalizeCouponVisualMode(payload = {}) {
  void payload;
  return "onedelux";
}

function getCouponVisualTheme(payload = {}) {
  void payload;
  return {
    label: "ONE-DELUX SIGNATURE",
    title: "ONE-DELUX",
    subtitle: "Custom coupon visual / neon grid / editorial stack",
    bg: "#04060d",
    glow: "rgba(0,242,255,0.14)",
    floor: "rgba(255,0,170,0.08)",
    mesh: "rgba(255,255,255,0.04)",
    accent: "#00f2ff",
    stroke: "rgba(0,242,255,0.34)",
    odd: "#ffda6b",
    chipFill: "rgba(0,242,255,0.10)",
    chipStroke: "rgba(255,0,170,0.34)",
    textStrong: "#f6fbff",
    textSoft: "#a6c2e3",
    cardFill: "rgba(7,10,21,0.95)",
    badgeFill: "rgba(255,0,170,0.12)",
    badgeText: "#ff8adf",
    heroAccent: "#ff8adf",
    edgeGlow: "rgba(0,242,255,0.28)",
    panelTitle: "#00f2ff",
    scoreTone: "#effcff",
    layout: "one-delux",
  };
}

function buildCouponShareHeroSvg(payload = {}, options = {}) {
  const share = getCouponShareLead(payload);
  const lead = share.lead;
  const width = Number(options.width) || 1200;
  const heroY = Number.isFinite(Number(options.heroY)) ? Number(options.heroY) : 78;
  const innerW = width - 72;
  const theme = getCouponVisualTheme(payload);
  const recommendation = escapeXml(truncateCouponLabel(lead.pari || "Aucun pari", 56));
  const confidence = Number(share.confidence || 0).toFixed(1);
  const matchStart = escapeXml(share.matchStart || "-");
  const odd = formatOddForTelegram(lead.cote);
  const league = escapeXml(truncateCouponLabel(lead.league || "Ligue", 34));
  const totalSelections = Number(share.totalSelections) || 0;
  const leagueCount = Number(share.leagueCount) || 0;
  const topLabels = share.coupon
    .slice(0, 4)
    .map((pick) => escapeXml(truncateCouponLabel(`${pick.teamHome || "Equipe 1"} vs ${pick.teamAway || "Equipe 2"}`, 28)));
  const extraCount = Math.max(0, totalSelections - topLabels.length);
  const miniChips = [
    `<rect x="22" y="172" width="118" height="24" rx="8" fill="${theme.chipFill}" stroke="${theme.chipStroke}" stroke-width="1"/>`,
    `<text x="81" y="189" text-anchor="middle" fill="${theme.textStrong}" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${totalSelections} match${totalSelections > 1 ? "s" : ""}</text>`,
    `<rect x="150" y="172" width="132" height="24" rx="8" fill="rgba(255,255,255,0.06)" stroke="${theme.chipStroke}" stroke-width="1"/>`,
    `<text x="216" y="189" text-anchor="middle" fill="${theme.textStrong}" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${leagueCount} ligue${leagueCount > 1 ? "s" : ""}</text>`,
    `<rect x="292" y="172" width="160" height="24" rx="8" fill="rgba(255,212,121,0.11)" stroke="rgba(255,212,121,0.28)" stroke-width="1"/>`,
    `<text x="372" y="189" text-anchor="middle" fill="#ffe6a0" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">Cote ${odd}</text>`,
    ...topLabels.map((label, index) => {
      const x = 466 + index * 160;
      return `
        <rect x="${x}" y="172" width="150" height="24" rx="8" fill="rgba(255,255,255,0.05)" stroke="${theme.edgeGlow}" stroke-width="1"/>
        <text x="${x + 75}" y="189" text-anchor="middle" fill="${theme.textSoft}" font-size="11" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${label}</text>
      `;
    }),
    extraCount > 0
      ? `
        <rect x="${466 + topLabels.length * 160}" y="172" width="94" height="24" rx="8" fill="rgba(0,240,255,0.10)" stroke="${theme.edgeGlow}" stroke-width="1"/>
        <text x="${466 + topLabels.length * 160 + 47}" y="189" text-anchor="middle" fill="${theme.textStrong}" font-size="11" font-weight="800" font-family="Segoe UI, Arial, sans-serif">+${extraCount}</text>
      `
      : "",
  ].join("");

  return `
    <g transform="translate(36, ${heroY})">
      <rect x="0" y="0" width="${innerW}" height="190" rx="20" fill="${theme.cardFill}" stroke="${theme.stroke}" stroke-width="1.5"/>
      <rect x="0" y="0" width="${innerW}" height="48" rx="20" fill="rgba(18,28,48,0.92)"/>
      <text x="20" y="31" fill="${theme.panelTitle}" font-size="13" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.22em">${escapeXml(options.kicker || theme.label)}</text>
      <text x="${innerW - 18}" y="31" text-anchor="end" fill="${theme.textSoft}" font-size="12" font-family="Segoe UI, Arial, sans-serif">${escapeXml(share.generatedAt)}</text>
      <text x="22" y="78" fill="${theme.scoreTone}" font-size="18" font-weight="900" font-family="Segoe UI, Arial, sans-serif">Pari recommande</text>
      <text x="22" y="108" fill="#ffffff" font-size="28" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${recommendation}</text>
      <rect x="22" y="120" width="186" height="24" rx="8" fill="${theme.badgeFill}" stroke="${theme.chipStroke}" stroke-width="1"/>
      <text x="115" y="137" text-anchor="middle" fill="${theme.badgeText}" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">LECTURE DU TICKET</text>
      <text x="22" y="164" fill="${theme.textSoft}" font-size="12.5" font-family="Segoe UI, Arial, sans-serif">Couvre ${totalSelections} match${totalSelections > 1 ? "s" : ""} du coupon, pas seulement le pick principal.</text>

      <rect x="${innerW - 388}" y="62" width="366" height="60" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)"/>
      <text x="${innerW - 370}" y="86" fill="${theme.textSoft}" font-size="11" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.16em">INDICATEURS</text>
      <text x="${innerW - 370}" y="110" fill="${theme.textStrong}" font-size="24" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${confidence}% confiance</text>

      <rect x="${innerW - 388}" y="130" width="114" height="34" rx="10" fill="${theme.chipFill}" stroke="${theme.edgeGlow}" stroke-width="1"/>
      <text x="${innerW - 331}" y="152" text-anchor="middle" fill="${theme.textStrong}" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${matchStart}</text>
      <rect x="${innerW - 264}" y="130" width="110" height="34" rx="10" fill="rgba(142,255,176,0.11)" stroke="rgba(142,255,176,0.28)"/>
      <text x="${innerW - 209}" y="152" text-anchor="middle" fill="#c5ffd9" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${odd}</text>
      <rect x="${innerW - 142}" y="130" width="120" height="34" rx="10" fill="rgba(255,212,121,0.11)" stroke="rgba(255,212,121,0.28)"/>
      <text x="${innerW - 82}" y="152" text-anchor="middle" fill="#ffe6a0" font-size="12" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${league}</text>
      ${miniChips}
    </g>`;
}

function buildCouponImageSvg(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const riskRaw = truncateCouponLabel(String(payload.riskProfile || "balanced"), 20);
  const theme = getCouponVisualTheme(payload);
  const picks = coupon.slice(0, 6);
  const count = Math.max(1, picks.length || 1);
  const cardH = 224;
  const gap = 16;
  const headH = 360;
  const footH = 52;
  const width = 1200;
  const height = headH + footH + count * cardH + (count - 1) * gap;
  const generatedAt = formatDateTime(new Date());
  const innerW = width - 72;
  const hero = buildCouponShareHeroSvg(payload, { width, kicker: "ONE-DELUX FORMAT", heroY: 144 });

  const cards = picks.map((pick, i) => {
    const y = headH + i * (cardH + gap);
    const league = escapeXml(truncateCouponLabel(pick.league || "Ligue virtuelle", 52));
    const home = escapeXml(truncateCouponLabel(pick.teamHome || "Equipe 1", 22));
    const away = escapeXml(truncateCouponLabel(pick.teamAway || "Equipe 2", 22));
    const pari = escapeXml(truncateCouponLabel(pick.pari || "-", 64));
    const odd = formatOddForTelegram(pick.cote);
    const matchStart = escapeXml(formatMatchStartTimeUnix(pick.startTimeUnix));
    const cx = innerW / 2;
    return `
      <g transform="translate(36, ${y})">
        <rect x="0" y="0" width="${innerW}" height="${cardH}" rx="16" fill="${theme.cardFill}" stroke="${theme.stroke}" stroke-width="1.5"/>
        <rect x="0" y="0" width="7" height="${cardH}" rx="4" fill="${theme.accent}"/>
        <rect x="0" y="0" width="${innerW}" height="46" rx="16" fill="rgba(18,28,48,0.88)"/>
        <line x1="14" y1="46" x2="${innerW - 14}" y2="46" stroke="${theme.edgeGlow}"/>
        <text x="20" y="30" fill="${theme.panelTitle}" font-size="14" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.06em">${i + 1}. ${league}</text>
        <text x="${innerW - 18}" y="30" text-anchor="end" fill="${theme.textSoft}" font-size="12" font-family="Segoe UI, Arial, sans-serif">${matchStart}</text>
        <text x="24" y="96" fill="${theme.textStrong}" font-size="26" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${home}</text>
        <g transform="translate(${cx - 34}, 58)">
          <polygon points="34,0 68,20 34,40 0,20" fill="rgba(255,255,255,0.05)" stroke="${theme.accent}" stroke-width="2"/>
          <text x="34" y="26" text-anchor="middle" fill="${theme.accent}" font-size="17" font-weight="900" font-family="Segoe UI, Arial, sans-serif">VS</text>
        </g>
        <text x="${innerW - 24}" y="96" text-anchor="end" fill="${theme.textStrong}" font-size="26" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${away}</text>
        <rect x="16" y="118" width="${innerW - 32}" height="92" rx="12" fill="rgba(4,8,18,0.92)" stroke="${theme.stroke}"/>
        <text x="32" y="148" fill="${theme.textSoft}" font-size="12" font-weight="700" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.12em">PARI ESPORTS</text>
        <text x="32" y="176" fill="${theme.textStrong}" font-size="18" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${pari}</text>
        <text x="${innerW - 32}" y="148" text-anchor="end" fill="${theme.textSoft}" font-size="12" font-weight="700" font-family="Segoe UI, Arial, sans-serif">COTE</text>
        <text x="${innerW - 32}" y="182" text-anchor="end" fill="${theme.odd}" font-size="28" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${odd}</text>
      </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="imgBg" x1="0" y1="0" x2="1.1" y2="1">
      <stop offset="0%" stop-color="#050810"/>
      <stop offset="45%" stop-color="#0c1528"/>
      <stop offset="100%" stop-color="#120a20"/>
    </linearGradient>
    <radialGradient id="imgGlow" cx="18%" cy="12%" r="55%">
      <stop offset="0%" stop-color="rgba(0,240,255,0.22)"/>
      <stop offset="55%" stop-color="rgba(123,44,255,0.08)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="imgFloor" cx="50%" cy="100%" r="70%">
      <stop offset="0%" stop-color="rgba(255,0,170,0.12)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <linearGradient id="imgHead" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="50%" stop-color="#ff00aa"/>
      <stop offset="100%" stop-color="#7b2cff"/>
    </linearGradient>
    <linearGradient id="imgAccent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#ff00aa"/>
    </linearGradient>
    <linearGradient id="imgStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(0,240,255,0.5)"/>
      <stop offset="100%" stop-color="rgba(123,44,255,0.35)"/>
    </linearGradient>
    <linearGradient id="imgOdd" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#5dffa2"/>
      <stop offset="100%" stop-color="#00f0ff"/>
    </linearGradient>
    <pattern id="imgMesh" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M0 48 L48 0 M-12 12 L12 -12 M36 60 L60 36" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="${theme.bg}"/>
  <rect width="${width}" height="${height}" fill="${theme.glow}"/>
  <rect width="${width}" height="${height}" fill="${theme.floor}"/>
  <rect width="${width}" height="${height}" fill="${theme.mesh}" opacity="0.9"/>
  <rect x="24" y="18" width="${width - 48}" height="${headH - 36}" rx="20" fill="rgba(6,10,22,0.75)" stroke="${theme.stroke}" stroke-width="1.2"/>
  <rect x="36" y="30" width="168" height="30" rx="8" fill="${theme.chipFill}" stroke="${theme.chipStroke}"/>
  <text x="48" y="51" fill="${theme.panelTitle}" font-size="13" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.28em">${theme.label}</text>
  <rect x="${width - 250}" y="30" width="176" height="30" rx="8" fill="${theme.chipFill}" stroke="${theme.chipStroke}"/>
  <text x="${width - 162}" y="51" text-anchor="middle" fill="${theme.badgeText}" font-size="13" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.2em">${theme.subtitle}</text>
  <text x="48" y="96" fill="${theme.accent}" font-size="34" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${theme.title}</text>
  <text x="48" y="124" fill="${theme.textStrong}" font-size="17" font-family="Segoe UI, Arial, sans-serif">Profil ${escapeXml(riskRaw)} · Sel. ${Number(summary.totalSelections) || coupon.length} · Combinee ${formatOddForTelegram(summary.combinedOdd)}</text>
  <text x="48" y="148" fill="${theme.textSoft}" font-size="13" font-family="Segoe UI, Arial, sans-serif">Genere ${escapeXml(generatedAt)}</text>
  ${hero}
  ${cards.join("\n")}
  <text x="48" y="${height - 26}" fill="${theme.textSoft}" font-size="14" font-family="Segoe UI, Arial, sans-serif">Signe SOLITAIRE HACK · Esports Virtual</text>
</svg>`;
}

function buildCouponStorySvg(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const riskRaw = truncateCouponLabel(String(payload.riskProfile || "balanced"), 18);
  const theme = getCouponVisualTheme(payload);
  const picks = coupon.slice(0, 5);
  const width = 1080;
  const height = 1920;
  const generatedAt = new Date().toLocaleString("fr-FR");
  const cardW = width - 96;
  const cardH = 268;
  const startY = 300;
  const gap = 22;

  const cards = picks.map((pick, i) => {
    const y = startY + i * (cardH + gap);
    const home = escapeXml(truncateCouponLabel(pick.teamHome || "Equipe 1", 18));
    const away = escapeXml(truncateCouponLabel(pick.teamAway || "Equipe 2", 18));
    const league = escapeXml(truncateCouponLabel(pick.league || "Ligue", 28));
    const pari = escapeXml(truncateCouponLabel(pick.pari || "-", 40));
    const odd = formatOddForTelegram(pick.cote);
    const conf = Number(pick.confiance) || 0;
    const risk = conf >= 75 ? "SAFE" : conf >= 60 ? "MODERE" : "RISQUE";
    const mid = cardW / 2;
    return `
      <g transform="translate(48, ${y})">
        <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="26" fill="${theme.cardFill}" stroke="${theme.stroke}" stroke-width="2"/>
        <rect x="0" y="0" width="8" height="${cardH}" rx="4" fill="${theme.accent}"/>
        <text x="24" y="44" fill="${theme.panelTitle}" font-size="22" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.04em">${i + 1}. ${league}</text>
        <text x="${mid}" y="118" text-anchor="middle" fill="${theme.textStrong}" font-size="36" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${home}</text>
        <g transform="translate(${mid - 40}, 128)">
          <polygon points="40,0 80,24 40,48 0,24" fill="rgba(255,255,255,0.05)" stroke="${theme.accent}" stroke-width="2.5"/>
          <text x="40" y="32" text-anchor="middle" fill="${theme.accent}" font-size="20" font-weight="900" font-family="Segoe UI, Arial, sans-serif">VS</text>
        </g>
        <text x="${mid}" y="210" text-anchor="middle" fill="${theme.textStrong}" font-size="36" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${away}</text>
        <rect x="20" y="224" width="${cardW - 40}" height="36" rx="10" fill="rgba(0,240,255,0.08)" stroke="${theme.stroke}"/>
        <text x="32" y="247" fill="${theme.textStrong}" font-size="18" font-weight="600" font-family="Segoe UI, Arial, sans-serif">${pari}</text>
        <text x="${cardW - 32}" y="247" text-anchor="end" fill="${theme.odd}" font-size="22" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${odd}</text>
        <text x="${cardW - 24}" y="44" text-anchor="end" fill="${theme.badgeText}" font-size="20" font-weight="800" font-family="Segoe UI, Arial, sans-serif">${conf}% ${risk}</text>
      </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="stBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030508"/>
      <stop offset="40%" stop-color="#0a1428"/>
      <stop offset="100%" stop-color="#180820"/>
    </linearGradient>
    <radialGradient id="stSpot" cx="50%" cy="0%" r="75%">
      <stop offset="0%" stop-color="rgba(0,240,255,0.35)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <linearGradient id="stTitle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="50%" stop-color="#ff00aa"/>
      <stop offset="100%" stop-color="#c9ff3d"/>
    </linearGradient>
    <linearGradient id="stAccent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff00aa"/>
      <stop offset="100%" stop-color="#7b2cff"/>
    </linearGradient>
    <linearGradient id="stStroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(0,240,255,0.55)"/>
      <stop offset="100%" stop-color="rgba(255,0,170,0.4)"/>
    </linearGradient>
    <linearGradient id="stOdd" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7dffb0"/>
      <stop offset="100%" stop-color="#00f0ff"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#stBg)"/>
  <rect width="${width}" height="${height}" fill="url(#stSpot)"/>
  <rect x="40" y="72" width="${width - 80}" height="200" rx="28" fill="rgba(8,12,24,0.82)" stroke="${theme.stroke}" stroke-width="1.5"/>
  <text x="72" y="128" fill="${theme.accent}" font-size="52" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${theme.title}</text>
  <rect x="${width - 296}" y="92" width="214" height="34" rx="10" fill="${theme.chipFill}" stroke="${theme.chipStroke}"/>
  <text x="${width - 189}" y="115" text-anchor="middle" fill="${theme.badgeText}" font-size="14" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.2em">${theme.subtitle}</text>
  <text x="72" y="168" fill="${theme.panelTitle}" font-size="22" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.35em">${theme.label}</text>
  <text x="72" y="210" fill="${theme.textStrong}" font-size="26" font-family="Segoe UI, Arial, sans-serif">Profil ${escapeXml(riskRaw)} · ${Number(summary.totalSelections) || coupon.length} selections</text>
  <text x="72" y="246" fill="${theme.textSoft}" font-size="22" font-family="Segoe UI, Arial, sans-serif">Cote ${formatOddForTelegram(summary.combinedOdd)} · ${escapeXml(generatedAt)}</text>
  ${buildCouponShareHeroSvg(payload, { width, kicker: "ONE-DELUX FORMAT" })}
  ${cards.join("\n")}
  <text x="72" y="${height - 88}" fill="${theme.textStrong}" font-size="24" font-family="Segoe UI, Arial, sans-serif">Signe SOLITAIRE HACK</text>
  <text x="72" y="${height - 52}" fill="${theme.textSoft}" font-size="18" font-family="Segoe UI, Arial, sans-serif">Aucune combinaison n'est garantie gagnante.</text>
</svg>`;
}

function buildCouponPremiumSvg(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const riskRaw = truncateCouponLabel(String(payload.riskProfile || "balanced"), 22);
  const theme = getCouponVisualTheme(payload);
  const picks = coupon.slice(0, 8);
  const count = Math.max(1, picks.length || 1);
  const width = 1400;
  const headH = 286;
  const cardH = 156;
  const gap = 14;
  const footH = 54;
  const height = headH + footH + count * cardH + (count - 1) * gap;
  const generatedAt = formatDateTime(new Date());
  const rowW = width - 64;
  const hero = buildCouponShareHeroSvg(payload, { width, kicker: "ONE-DELUX FORMAT" });

  const rows = picks
    .map((pick, idx) => {
      const y = headH + idx * (cardH + gap);
      const home = escapeXml(truncateCouponLabel(pick.teamHome || "Equipe 1", 20));
      const away = escapeXml(truncateCouponLabel(pick.teamAway || "Equipe 2", 20));
      const league = escapeXml(truncateCouponLabel(pick.league || "Ligue virtuelle", 40));
      const bet = escapeXml(truncateCouponLabel(pick.pari || "-", 48));
      const odd = formatOddForTelegram(pick.cote);
      const conf = Number(pick?.confiance || 0).toFixed(1);
      const startAt = escapeXml(formatMatchStartTimeUnix(pick.startTimeUnix));
      const q = Number(pick?.qualityScore || pick?.dataQuality || pick?.confiance || 0).toFixed(0);
      const hx = rowW / 2;
      return `
      <g transform="translate(32, ${y})">
        <rect x="0" y="0" width="${rowW}" height="${cardH}" rx="14" fill="${theme.cardFill}" stroke="${theme.stroke}"/>
        <rect x="0" y="0" width="6" height="${cardH}" rx="3" fill="${theme.accent}"/>
        <text x="16" y="28" fill="${theme.panelTitle}" font-size="13" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.08em">${idx + 1}. ${league}</text>
        <text x="${rowW - 16}" y="28" text-anchor="end" fill="${theme.textSoft}" font-size="12" font-family="Segoe UI, Arial, sans-serif">${startAt}</text>
        <text x="18" y="76" fill="${theme.textStrong}" font-size="26" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${home}</text>
        <g transform="translate(${hx - 28}, 44)">
          <rect x="0" y="0" width="56" height="28" rx="8" fill="rgba(255,255,255,0.05)" stroke="${theme.accent}" stroke-width="1.5"/>
          <text x="28" y="20" text-anchor="middle" fill="${theme.accent}" font-size="15" font-weight="900" font-family="Segoe UI, Arial, sans-serif">VS</text>
        </g>
        <text x="${rowW - 18}" y="76" text-anchor="end" fill="${theme.textStrong}" font-size="26" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${away}</text>
        <rect x="14" y="92" width="${rowW - 28}" height="48" rx="10" fill="rgba(12,18,32,0.95)" stroke="${theme.stroke}"/>
        <text x="26" y="118" fill="${theme.textStrong}" font-size="16" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${bet}</text>
        <text x="${rowW - 120}" y="122" text-anchor="end" fill="${theme.odd}" font-size="26" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${odd}</text>
        <text x="${rowW - 22}" y="112" text-anchor="end" fill="${theme.textSoft}" font-size="10" font-family="Segoe UI, Arial, sans-serif">CONF</text>
        <text x="${rowW - 22}" y="128" text-anchor="end" fill="${theme.textSoft}" font-size="10" font-family="Segoe UI, Arial, sans-serif">${conf}% · Q${q}</text>
      </g>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="pmBg" x1="0" y1="0" x2="1.1" y2="1">
      <stop offset="0%" stop-color="#020408"/>
      <stop offset="50%" stop-color="#0c1830"/>
      <stop offset="100%" stop-color="#14081a"/>
    </linearGradient>
    <radialGradient id="pmLite" cx="80%" cy="15%" r="50%">
      <stop offset="0%" stop-color="rgba(255,0,170,0.2)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <linearGradient id="pmHead" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="33%" stop-color="#ff00aa"/>
      <stop offset="100%" stop-color="#7b2cff"/>
    </linearGradient>
    <linearGradient id="pmBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#7b2cff"/>
    </linearGradient>
    <linearGradient id="pmStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(0,240,255,0.45)"/>
      <stop offset="100%" stop-color="rgba(123,44,255,0.35)"/>
    </linearGradient>
    <linearGradient id="pmOdd" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9fff6e"/>
      <stop offset="100%" stop-color="#00f0ff"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#pmBg)"/>
  <rect width="${width}" height="${height}" fill="url(#pmLite)"/>
  <rect x="18" y="16" width="${width - 36}" height="${headH - 34}" rx="20" fill="rgba(6,10,22,0.78)" stroke="${theme.stroke}" stroke-width="1.2"/>
  <text x="40" y="58" fill="${theme.accent}" font-size="38" font-weight="900" font-family="Segoe UI, Arial, sans-serif">${theme.title}</text>
  <rect x="${width - 298}" y="34" width="208" height="32" rx="10" fill="${theme.chipFill}" stroke="${theme.chipStroke}"/>
  <text x="${width - 194}" y="56" text-anchor="middle" fill="${theme.badgeText}" font-size="13" font-weight="800" font-family="Segoe UI, Arial, sans-serif" letter-spacing="0.2em">${theme.subtitle}</text>
  <text x="40" y="92" fill="${theme.textStrong}" font-size="18" font-family="Segoe UI, Arial, sans-serif">${theme.label} · Profil ${escapeXml(riskRaw)} · ${Number(summary.totalSelections) || coupon.length} sel. · ${formatOddForTelegram(summary.combinedOdd)}</text>
  <text x="40" y="120" fill="${theme.textSoft}" font-size="14" font-family="Segoe UI, Arial, sans-serif">Genere ${escapeXml(generatedAt)} — rendu HD mobile &amp; desktop</text>
  ${hero}
  ${rows}
   <text x="40" y="${height - 22}" fill="${theme.textSoft}" font-size="14" font-family="Segoe UI, Arial, sans-serif">ONE-DELUX Signature — jeu responsable — combinaison non garantie</text>
</svg>`;
}

function normalizeImageFormat(value, fallback = "png") {
  const v = String(value || "").toLowerCase();
  if (v === "jpg" || v === "jpeg") return "jpg";
  if (v === "png") return "png";
  if (v === "svg") return "svg";
  return fallback;
}

async function rasterizeSvg(svg, format = "png") {
  const buffer = Buffer.from(String(svg || ""), "utf8");
  if (format === "jpg") {
    return sharp(buffer).jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
  }
  return sharp(buffer).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function pdfEscape(text = "") {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(lines = []) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const lineHeight = 16;
  const left = 48;
  const top = 800;
  const maxLines = Math.max(1, Math.floor((top - 60) / lineHeight));
  const contentLines = ["BT", "/F1 11 Tf", `${left} ${top} Td`, `${lineHeight} TL`];
  let count = 0;
  for (const raw of safeLines.slice(0, 180)) {
    if (count >= maxLines) break;
    const line = pdfEscape(raw);
    contentLines.push(`(${line}) Tj`);
    count += 1;
    if (count < maxLines) contentLines.push("T*");
  }
  contentLines.push("ET");
  const streamContent = contentLines.join("\n");

  const objects = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  objects.push("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push(`5 0 obj << /Length ${Buffer.byteLength(streamContent, "utf8")} >> stream\n${streamContent}\nendstream endobj`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    const off = String(offsets[i]).padStart(10, "0");
    pdf += `${off} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function buildCouponPdfSummaryLines(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const riskProfile = String(payload.riskProfile || "balanced");
  const generatedAt = new Date().toLocaleString("fr-FR");
  const lines = [
    "ONE-DELUX - COUPON PDF",
    "Signe: SOLITAIRE HACK",
    `Date: ${generatedAt}`,
    `Profil: ${riskProfile}`,
    `Selections: ${Number(summary.totalSelections) || coupon.length}`,
    `Cote combinee: ${formatOddForTelegram(summary.combinedOdd)}`,
    `Confiance moyenne: ${Number(summary.averageConfidence) || 0}%`,
    "",
    ...buildCouponShareHeroLines(payload),
    "",
  ];
  coupon.forEach((pick, i) => {
    lines.push(`${i + 1}. ${pick.teamHome || "Equipe 1"} vs ${pick.teamAway || "Equipe 2"}`);
    lines.push(`   Ligue: ${pick.league || "Non specifiee"}`);
    lines.push(`   Pari: ${pick.pari || "-"}`);
    lines.push(`   Cote: ${formatOddForTelegram(pick.cote)} | Confiance: ${Number(pick.confiance) || 0}%`);
    lines.push("");
  });
  lines.push("Aucune combinaison n'est garantie gagnante.");
  return lines;
}

function buildCouponPdfQuickLines(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const generatedAt = new Date().toLocaleString("fr-FR");
  const lines = [
    "ONE-DELUX - PDF ULTRA-COURT",
    `Date: ${generatedAt}`,
    `Selections: ${Number(summary.totalSelections) || coupon.length}`,
    `Cote combinee: ${formatOddForTelegram(summary.combinedOdd)}`,
    buildCouponShareHeroSummaryLine(payload),
    "",
  ];
  coupon.slice(0, 14).forEach((pick, i) => {
    lines.push(`${i + 1}) ${pick?.teamHome || "Equipe 1"} vs ${pick?.teamAway || "Equipe 2"} | ${pick?.pari || "-"} | ${formatOddForTelegram(pick?.cote)}`);
  });
  lines.push("");
  lines.push("Signe: SOLITAIRE HACK");
  lines.push("Aucune combinaison n'est garantie gagnante.");
  return lines;
}

function buildCouponPdfDetailedLines(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const insights = payload.insights || {};
  const backupPlan = Array.isArray(payload.backupPlan) ? payload.backupPlan : [];
  const riskProfile = String(payload.riskProfile || "balanced");
  const generatedAt = new Date().toLocaleString("fr-FR");
  const total = Number(summary.totalSelections) || coupon.length || 0;
  const combinedOdd = Number(summary.combinedOdd) || 0;
  const avgConfidence = Number(summary.averageConfidence) || 0;
  const leagues = new Set(coupon.map((p) => String(p?.league || "").trim()).filter(Boolean));
  const safeCount = coupon.filter((p) => Number(p?.confiance) >= 75).length;
  const mediumCount = coupon.filter((p) => Number(p?.confiance) >= 60 && Number(p?.confiance) < 75).length;
  const highRiskCount = Math.max(0, coupon.length - safeCount - mediumCount);

  const lines = [
    "ONE-DELUX - COUPON DETAILLE ANALYTIQUE",
    "Signe: SOLITAIRE HACK",
    `Date: ${generatedAt}`,
    `Profil: ${riskProfile}`,
    "",
    "RESUME GLOBAL",
    `Selections totales: ${total}`,
    `Cote combinee: ${formatOddForTelegram(combinedOdd)}`,
    `Confiance moyenne: ${avgConfidence.toFixed(1)}%`,
    `Diversite ligues: ${leagues.size}`,
    `Qualite ticket: ${Number(insights.qualityScore) || 0}/100`,
    `Risque correlation: ${Number(insights.correlationRisk) || 0}%`,
    "",
    ...buildCouponShareHeroLines(payload),
    "",
    "DISTRIBUTION RISQUE",
    `Safe (>=75%): ${safeCount}`,
    `Moyen (60% - 74.9%): ${mediumCount}`,
    `Eleve (<60%): ${highRiskCount}`,
    "",
    "ANALYSE PAR SELECTION",
  ];

  coupon.forEach((pick, i) => {
    const odd = Number(pick?.cote) || 0;
    const conf = Number(pick?.confiance) || 0;
    const valueIndex = odd > 0 ? Number((conf / odd).toFixed(2)) : 0;
    const confidenceBand = conf >= 75 ? "SAFE" : conf >= 60 ? "MOYEN" : "ELEVE";
    const source = String(pick?.source || "MIXTE");
    lines.push(`${i + 1}. ${pick?.teamHome || "Equipe 1"} vs ${pick?.teamAway || "Equipe 2"}`);
    lines.push(`   Ligue: ${pick?.league || "Non specifiee"}`);
    lines.push(`   Pari: ${pick?.pari || "-"}`);
    lines.push(`   Cote: ${formatOddForTelegram(odd)} | Confiance: ${conf.toFixed(1)}% | Bande: ${confidenceBand}`);
    lines.push(`   Value Index (Confiance/Cote): ${valueIndex} | Source: ${source}`);
    lines.push("");
  });

  lines.push("NOTE: Le Value Index est un indicateur interne d'equilibre rendement/fiabilite.");
  if (backupPlan.length) {
    lines.push("");
    lines.push("PLAN B (REMPLACEMENTS PROPOSES)");
    backupPlan.slice(0, 20).forEach((b, i) => {
      lines.push(
        `${i + 1}. Match ${b.matchId || "-"} -> ${b.pari || "-"} | Cote ${formatOddForTelegram(b.cote)} | Conf ${
          Number(b.confiance) || 0
        }%`
      );
    });
  }
  lines.push("Aucune combinaison n'est garantie gagnante.");
  return lines;
}

function getStartedSelections(coupon = []) {
  const nowSec = Math.floor(Date.now() / 1000);
  const norm = (v) =>
    String(v || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const isPreMatchBySignals = (pick) => {
    const statusCode = Number(pick?.statusCode || 0);
    const info = norm(pick?.infoText || "");
    const status = norm(pick?.statusText || "");
    const phase = norm(pick?.phase || "");
    const preByCode = statusCode === 128;
    const preByInfo = info.includes("avant le debut");
    const preByStatus = status.includes("debut dans");
    const inPlay =
      phase.includes("mi-temps") ||
      phase.includes("1ere mi-temps") ||
      phase.includes("2eme mi-temps") ||
      info.includes("termine") ||
      phase.includes("termine");
    if (inPlay) return false;
    return preByCode || preByInfo || preByStatus;
  };

  return coupon.filter((pick) => {
    const start = Number(pick?.startTimeUnix || 0);
    if (isPreMatchBySignals(pick)) return false;
    if (!Number.isFinite(start) || start <= 0) return false;
    const hasStatusSignals =
      Number(pick?.statusCode || 0) > 0 ||
      String(pick?.infoText || "").trim().length > 0 ||
      String(pick?.statusText || "").trim().length > 0 ||
      String(pick?.phase || "").trim().length > 0;
    if (!hasStatusSignals) {
      const diffSec = nowSec - start;
      // Tolerance when upstream status signals are missing.
      if (diffSec >= 0 && diffSec <= 15 * 60) return false;
    }
    return start <= nowSec;
  });
}

function buildPrintableCouponHtml(payload = {}) {
  const coupon = Array.isArray(payload.coupon) ? payload.coupon : [];
  const summary = payload.summary || {};
  const riskProfile = String(payload.riskProfile || "balanced");
  const generatedAt = formatDateTime(new Date());
  const combinedOdd = formatOddForTelegram(summary.combinedOdd);
  const avgConf = Number(summary.averageConfidence) || 0;
  const share = getCouponShareLead(payload);
  const heroRecommendation = escapeXml(share.lead?.pari || "Aucun");
  const heroConfidence = Number(share.confidence || 0).toFixed(1);
  const heroMatchStart = escapeXml(share.matchStart || "-");

  const shareText = [
    "FC25 Coupon",
    `Date ${generatedAt}`,
    `Profil ${riskProfile}`,
    `Cote ${combinedOdd}`,
    ...coupon.slice(0, 8).map((p, i) => `${i + 1}. ${p?.teamHome || "Equipe 1"} vs ${p?.teamAway || "Equipe 2"} | ${p?.pari || "-"} | ${formatOddForTelegram(p?.cote)}`),
  ].join(" | ");
  const qrUrl = `https://quickchart.io/qr?size=190&text=${encodeURIComponent(shareText)}`;

  const rows = coupon
    .map((p, i) => {
      const home = escapeXml(p?.teamHome || "Equipe 1");
      const away = escapeXml(p?.teamAway || "Equipe 2");
      const league = escapeXml(p?.league || "Non specifiee");
      const pari = escapeXml(p?.pari || "-");
      const odd = formatOddForTelegram(p?.cote);
      const conf = Number(p?.confiance) || 0;
      const startAt = escapeXml(formatMatchStartTimeUnix(p?.startTimeUnix));
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${home} vs ${away}</td>
          <td>${league}</td>
          <td>${startAt}</td>
          <td>${pari}</td>
          <td>${odd}</td>
          <td>${conf.toFixed(1)}%</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Coupon A4 FC25</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #0f1a2f; background: #fff; }
    .wrap { width: 100%; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .title { font-size: 24px; font-weight: 800; margin: 0 0 4px; }
    .sub { margin: 0; font-size: 13px; color: #324868; line-height: 1.4; }
    .qr { border: 1px solid #d5deea; border-radius: 8px; padding: 8px; }
    .meta { margin: 10px 0 14px; display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #31486a; }
    .pill { border: 1px solid #d0daea; border-radius: 999px; padding: 4px 10px; background: #f6f9ff; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d7e0ec; padding: 7px; text-align: left; vertical-align: top; }
    th { background: #eef4ff; color: #1b355d; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .foot { margin-top: 12px; font-size: 11px; color: #4c607d; display: flex; justify-content: space-between; }
    .print-btn { margin-top: 12px; padding: 8px 12px; border: 0; background: #123b7a; color: white; border-radius: 6px; font-weight: 700; }
    .share-hero {
      margin: 10px 0 14px;
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
      gap: 14px;
      border: 1px solid #d0daea;
      border-radius: 16px;
      background: linear-gradient(135deg, #f8fbff, #eef4ff);
      padding: 14px;
      box-shadow: 0 12px 26px rgba(15, 26, 47, 0.08);
    }
    .share-hero-title {
      margin: 0 0 4px;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #627596;
      font-weight: 800;
    }
    .share-hero-reco {
      margin: 0;
      font-size: 28px;
      line-height: 1.08;
      font-weight: 900;
      color: #0f1a2f;
    }
    .share-hero-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 1px solid transparent;
    }
    .share-hero-badge.is-good { color: #0b6b32; background: #defce7; border-color: #8fd8a9; }
    .share-hero-badge.is-watch { color: #9a4a22; background: #fff0e6; border-color: #f3be95; }
    .share-hero-badge.is-neutral { color: #875f00; background: #fff8e5; border-color: #e6d09a; }
    .share-hero-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      align-content: start;
    }
    .share-hero-stat {
      border: 1px solid #d7e0ec;
      border-radius: 12px;
      background: #fff;
      padding: 10px 11px;
    }
    .share-hero-stat span {
      display: block;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #7183a1;
      font-weight: 800;
    }
    .share-hero-stat strong {
      display: block;
      margin-top: 4px;
      font-size: 16px;
      color: #0f1a2f;
      font-weight: 900;
    }
    .share-hero-note {
      margin-top: 10px;
      font-size: 12px;
      color: #42566f;
      line-height: 1.45;
    }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div>
        <h1 class="title">ONE-DELUX Coupon Ticket A4</h1>
        <p class="sub">Genere le ${escapeXml(generatedAt)}</p>
        <p class="sub">Signe: SOLITAIRE HACK</p>
      </div>
      <div class="qr">
        <img src="${qrUrl}" width="160" height="160" alt="QR Coupon"/>
      </div>
    </div>
    <section class="share-hero">
      <div>
        <p class="share-hero-title">Projection Premium</p>
        <p class="share-hero-reco">${heroRecommendation}</p>
        <span class="share-hero-badge is-neutral">Sans projection detaillee</span>
        <p class="share-hero-note">Les exportations restent concentrees sur la recommandation, la confiance et le contexte du match.</p>
      </div>
      <div class="share-hero-grid">
        <article class="share-hero-stat">
          <span>Confiance</span>
          <strong>${heroConfidence}%</strong>
        </article>
        <article class="share-hero-stat">
          <span>Heure match</span>
          <strong>${heroMatchStart}</strong>
        </article>
        <article class="share-hero-stat">
          <span>Reco</span>
          <strong>${heroRecommendation}</strong>
        </article>
        <article class="share-hero-stat">
          <span>Cote</span>
          <strong>${combinedOdd}</strong>
        </article>
      </div>
    </section>
    <div class="meta">
      <span class="pill">Profil: ${escapeXml(riskProfile)}</span>
      <span class="pill">Selections: ${Number(summary.totalSelections) || coupon.length}</span>
      <span class="pill">Cote combinee: ${combinedOdd}</span>
      <span class="pill">Confiance moyenne: ${avgConf.toFixed(1)}%</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Match</th>
          <th>Ligue</th>
          <th>Heure match</th>
          <th>Pari</th>
          <th>Cote</th>
          <th>Confiance</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="foot">
      <span>Document interne ticket</span>
      <span>Aucune combinaison n'est garantie gagnante</span>
    </div>
    <button class="print-btn" onclick="window.print()">Imprimer</button>
  </div>
</body>
</html>`;
}

app.get("/api/team-badge", (req, res) => {
  try {
    const name = String(req.query.name || "Equipe").trim();
    const initials = initialsFromName(name).slice(0, 2);
    const [c1, c2] = teamColors(name);
    const safeTitle = name
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="61" fill="#fff" stroke="#e5e9f1" stroke-width="6"/>
  <circle cx="64" cy="64" r="51" fill="url(#g)"/>
  <text x="64" y="74" text-anchor="middle" font-size="40" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#fff">${initials}</text>
</svg>`;

    res.set("Content-Type", "image/svg+xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(svg);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "TEAM_BADGE_ERROR",
        message: "Impossible de generer le badge.",
        details: error.message
      }
    });
  }
});

app.get("/api/logo/:fileName", async (req, res) => {
  const raw = String(req.params.fileName || "").trim();
  let safe = raw;
  try {
    safe = decodeURIComponent(raw);
  } catch (_error) {
    return res.status(400).send("Nom de logo invalide.");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(safe)) {
    return res.status(400).send("Nom de logo invalide.");
  }

  const fileCandidates = safe.includes(".") ? [safe] : [safe, `${safe}.png`];
  const baseUrls = [
    "https://1xbet.com/LineFeedImages/",
    "https://1xbet.com/linefeed/images/",
    "https://1xbet.com/genfiles/team/",
    "https://1xbet.com/genfiles/teams/",
  ];

  for (const file of fileCandidates) {
    for (const base of baseUrls) {
      const url = `${base}${file}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
          headers: {
            "user-agent": "Mozilla/5.0",
            accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            referer: "https://1xbet.com/",
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!response.ok) continue;
        const type = response.headers.get("content-type") || "image/png";
        const buffer = Buffer.from(await response.arrayBuffer());
        res.set("Content-Type", type);
        res.set("Cache-Control", "public, max-age=3600");
        return res.send(buffer);
      } catch (_error) {
        continue;
      }
    }
  }

  res.status(404).send("Logo introuvable.");
});

app.get("/api/teams/:id/matches", async (req, res) => {
  try {
    const teamId = req.params.id;
    const data = await getPenaltyMatches();

    const teamMatches = data.matches.filter((match) => matchMatchesTeam(match, teamId));

    res.json({
      success: true,
      data: {
        matches: teamMatches,
        total: teamMatches.length,
        teamId,
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "TEAM_MATCHES_ERROR",
        message: "Impossible de recuperer les matchs de l'equipe.",
        details: error.message,
      },
    });
  }
});

app.get("/api/teams", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const teamSet = new Set();

    data.matches.forEach((match) => {
      const teams = getMatchTeams(match);
      if (teams.home) teamSet.add(teams.home);
      if (teams.away) teamSet.add(teams.away);
    });

    const teams = Array.from(teamSet)
      .map((name) => ({
        name,
        id: slugifyLookup(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: {
        teams,
        total: teams.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "TEAMS_FETCH_ERROR",
        message: "Impossible de recuperer la liste des equipes.",
        details: error.message,
      },
    });
  }
});

app.get("/api/leagues/:id/standings", async (req, res) => {
  try {
    const leagueId = req.params.id;
    const data = await getPenaltyMatches();

    const leagueMatches = data.matches.filter((match) => matchMatchesLeague(match, leagueId));
    const completedMatches = leagueMatches.filter((match) => classifyMatchStatus(match) === "finished");
    const teamStats = new Map();

    completedMatches.forEach((match) => {
      const teams = getMatchTeams(match);
      const homeTeam = teams.home;
      const awayTeam = teams.away;
      const score = getMatchScore(match);
      const homeScore = score.home;
      const awayScore = score.away;

      if (!homeTeam || !awayTeam) return;
      if (!teamStats.has(homeTeam)) {
        teamStats.set(homeTeam, { name: homeTeam, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
      }
      if (!teamStats.has(awayTeam)) {
        teamStats.set(awayTeam, { name: awayTeam, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
      }
      
      const homeStats = teamStats.get(homeTeam);
      const awayStats = teamStats.get(awayTeam);
      
      homeStats.played++;
      homeStats.goalsFor += homeScore;
      homeStats.goalsAgainst += awayScore;
      
      awayStats.played++;
      awayStats.goalsFor += awayScore;
      awayStats.goalsAgainst += homeScore;
      
      if (homeScore > awayScore) {
        homeStats.won++;
        homeStats.points += 3;
        awayStats.lost++;
      } else if (awayScore > homeScore) {
        awayStats.won++;
        awayStats.points += 3;
        homeStats.lost++;
      } else {
        homeStats.drawn++;
        homeStats.points += 1;
        awayStats.drawn++;
        awayStats.points += 1;
      }
    });

    const standings = Array.from(teamStats.values()).sort(
      (a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    );

    res.json({
      success: true,
      data: {
        standings: standings.map((team, index) => ({ ...team, position: index + 1 })),
        total: standings.length,
        leagueId,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LEAGUE_STANDINGS_ERROR",
        message: "Impossible de recuperer le classement de la ligue.",
        details: error.message,
      },
    });
  }
});

app.get("/api/leagues/:id/matches", async (req, res) => {
  try {
    const leagueId = req.params.id;
    const data = await getPenaltyMatches();

    const leagueMatches = data.matches.filter((match) => matchMatchesLeague(match, leagueId));

    res.json({
      success: true,
      data: {
        matches: leagueMatches,
        total: leagueMatches.length,
        leagueId,
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LEAGUE_MATCHES_ERROR",
        message: "Impossible de recuperer les matchs de la ligue.",
        details: error.message,
      },
    });
  }
});

app.get("/api/leagues", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const leagueSet = new Set();

    data.matches.forEach((match) => {
      const league = getMatchLeague(match);
      if (league) leagueSet.add(league);
    });

    const leagues = Array.from(leagueSet)
      .filter(Boolean)
      .map((name) => ({
        name,
        id: slugifyLookup(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: {
        leagues,
        total: leagues.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LEAGUES_FETCH_ERROR",
        message: "Impossible de recuperer la liste des ligues.",
        details: error.message
      }
    });
  }
});

app.get("/api/league-profiles", (_req, res) => {
  res.json({
    success: true,
    data: {
      profiles: getLeagueProfiles(),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});

app.get("/api/structure", async (_req, res) => {
  try {
    const structure = await getStructure();
    res.json({
      success: true,
      data: structure,
      meta: {
        source: API_URL,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "STRUCTURE_ERROR",
        message: "Impossible d'analyser la structure JSON.",
        details: error.message
      }
    });
  }
});

app.get("/api/db/status", async (_req, res) => {
  try {
    const status = await getDbStatus();
    res.json({
      success: true,
      data: status,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DB_STATUS_ERROR",
        message: "Impossible de verifier le statut de la base de donnees.",
        details: error.message
      }
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      service: "ONE-DELUX Backend",
      version: "1.0.0",
      uptime: process.uptime()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

app.get("/api/match-tracking/status", async (_req, res) => {
  try {
    const [state, runs, matches] = await Promise.all([
      authDb.getMatchTrackingState(matchTrackingConfig.trackerKey).catch(() => null),
      authDb.getMatchTrackingRuns(matchTrackingConfig.trackerKey, 10).catch(() => []),
      authDb.getTrackedMatches(30).catch(() => []),
    ]);
    res.json({
      success: true,
      data: {
        tracker: {
          enabled: matchTrackingConfig.enabled,
          intervalSeconds: matchTrackingConfig.intervalSeconds,
          trackerKey: matchTrackingConfig.trackerKey,
          running: matchTrackingRunning,
          lastRunCount: matchTrackingRunCount,
        },
        state,
        runs,
        matches,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCH_TRACKING_STATUS_ERROR",
        message: "Impossible de recuperer le suivi des matchs.",
        details: error.message,
      },
    });
  }
});

app.get("/api/match/:id/history", async (req, res) => {
  try {
    const matchId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(matchId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_MATCH_ID",
          message: "Identifiant de match invalide.",
        },
      });
    }

    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 120));
    const history = await authDb.getMatchScoreHistory(matchId, limit).catch(() => []);

    res.json({
      success: true,
      data: {
        matchId,
        limit,
        count: history.length,
        latest: history[0] || null,
        history,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCH_HISTORY_ERROR",
        message: "Impossible de recuperer l'historique du score.",
        details: error.message,
      },
    });
  }
});

app.get("/api/matches", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    res.json({
      success: true,
      data: {
        matches: data.matches,
        totalFromApi: data.totalFromApi,
        totalSport85: data.totalSport85,
        totalPenalty: data.totalPenalty,
        filterMode: data.filterMode
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCHES_FETCH_ERROR",
        message: "Impossible de recuperer les matchs penalty FIFA virtuel.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/live", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const liveMatches = data.matches.filter((match) => classifyMatchStatus(match) === "live");
    res.json({
      success: true,
      data: {
        matches: liveMatches,
        total: liveMatches.length,
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCHES_LIVE_ERROR",
        message: "Impossible de recuperer les matchs en direct.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/upcoming", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const upcomingMatches = data.matches.filter((match) => classifyMatchStatus(match) === "upcoming");
    res.json({
      success: true,
      data: {
        matches: upcomingMatches,
        total: upcomingMatches.length,
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCHES_UPCOMING_ERROR",
        message: "Impossible de recuperer les matchs a venir.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/search", async (req, res) => {
  try {
    const data = await getPenaltyMatches();
    const query = normalizeLookupText(req.query.q || "");

    if (!query) {
      return res.json({
        success: true,
        data: {
          matches: data.matches,
          total: data.matches.length,
        },
        meta: {
          source: API_URL,
          fetchedAt: data.fetchedAt,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const searchResults = data.matches.filter((match) => getMatchSearchText(match).includes(query));

    res.json({
      success: true,
      data: {
        matches: searchResults,
        total: searchResults.length,
        query,
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCHES_SEARCH_ERROR",
        message: "Impossible de rechercher les matchs.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/filter", async (req, res) => {
  try {
    const data = await getPenaltyMatches();
    let filteredMatches = data.matches;

    const league = req.query.league ? String(req.query.league) : null;
    const team = req.query.team ? String(req.query.team) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const minOdds = req.query.minOdds ? Number(req.query.minOdds) : null;
    const maxOdds = req.query.maxOdds ? Number(req.query.maxOdds) : null;

    if (league) {
      filteredMatches = filteredMatches.filter((match) => matchMatchesLeague(match, league));
    }

    if (team) {
      filteredMatches = filteredMatches.filter((match) => matchMatchesTeam(match, team));
    }

    if (status) {
      const normalizedStatus = normalizeLookupText(status);
      filteredMatches = filteredMatches.filter((match) => classifyMatchStatus(match) === normalizedStatus);
    }

    if (Number.isFinite(minOdds)) {
      filteredMatches = filteredMatches.filter((match) => {
        const odd = getMatchPrimaryOdd(match);
        return Number.isFinite(odd) && odd >= minOdds;
      });
    }

    if (Number.isFinite(maxOdds)) {
      filteredMatches = filteredMatches.filter((match) => {
        const odd = getMatchPrimaryOdd(match);
        return Number.isFinite(odd) && odd <= maxOdds;
      });
    }

    res.json({
      success: true,
      data: {
        matches: filteredMatches,
        total: filteredMatches.length,
        filters: { league, team, status, minOdds, maxOdds },
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCHES_FILTER_ERROR",
        message: "Impossible de filtrer les matchs.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/finished", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const finishedMatches = data.matches.filter((match) => classifyMatchStatus(match) === "finished");
    res.json({
      success: true,
      data: {
        matches: finishedMatches,
        total: finishedMatches.length,
      },
      meta: {
        source: API_URL,
        fetchedAt: data.fetchedAt,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCHES_FINISHED_ERROR",
        message: "Impossible de recuperer les matchs termines.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/:id/statistics", async (req, res) => {
  try {
    const matchId = req.params.id;
    const data = await getPenaltyMatches();
    const match = data.matches.find((item) => getMatchId(item) === String(matchId));

    if (!match) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MATCH_NOT_FOUND",
          message: "Match non trouve.",
        },
      });
    }

    const score = getMatchScore(match);
    const teams = getMatchTeams(match);
    const statistics = {
      matchId: getMatchId(match),
      homeTeam: teams.home,
      awayTeam: teams.away,
      score: {
        home: score.home,
        away: score.away,
      },
      status: getMatchStatusLabel(match),
      minute: getMatchMinute(match),
      possession: {
        home: 50,
        away: 50,
      },
      shots: {
        home: Math.floor(Math.random() * 15) + 5,
        away: Math.floor(Math.random() * 15) + 5,
      },
      corners: {
        home: Math.floor(Math.random() * 8),
        away: Math.floor(Math.random() * 8),
      },
      fouls: {
        home: Math.floor(Math.random() * 12),
        away: Math.floor(Math.random() * 12),
      },
      yellowCards: {
        home: Math.floor(Math.random() * 3),
        away: Math.floor(Math.random() * 3),
      },
      redCards: {
        home: Math.floor(Math.random() * 2),
        away: Math.floor(Math.random() * 2),
      },
    };

    res.json({
      success: true,
      data: {
        statistics,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MATCH_STATS_ERROR",
        message: "Impossible de recuperer les statistiques du match.",
        details: error.message
      }
    });
  }
});

app.get("/api/odds/:matchId(\\d+)", async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const details = await getMatchPredictionDetails(matchId);
    const match = details?.match || {};
    const teams = getMatchTeams(match);
    const odds1x2 = getMatchOdds(match);
    const bettingMarkets = Array.isArray(details?.bettingMarkets) ? details.bettingMarkets : [];
    const over25 = bettingMarkets.find((market) => normalizeLookupText(market?.nom).includes("plus de 2 5"));
    const under25 = bettingMarkets.find((market) => normalizeLookupText(market?.nom).includes("moins de 2 5"));

    const odds = {
      matchId: getMatchId(match) || String(matchId),
      homeTeam: teams.home,
      awayTeam: teams.away,
      markets: {
        "1X2": {
          "1": odds1x2.home,
          X: odds1x2.draw,
          "2": odds1x2.away,
        },
        "totalGoals": {
          "over2.5": over25?.cote ?? null,
          "under2.5": under25?.cote ?? null,
        },
      },
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: {
        odds,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ODDS_FETCH_ERROR",
        message: "Impossible de recuperer les cotes du match.",
        details: error.message
      }
    });
  }
});

app.get("/api/predictions", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const predictions = [];

    for (const match of data.matches.slice(0, 20)) {
      try {
        const details = await getMatchPredictionDetails(getMatchId(match));
        const resolvedMatch = details?.match || match;
        const teams = getMatchTeams(resolvedMatch);
        if (details.prediction && details.prediction.maitre) {
          predictions.push({
            matchId: getMatchId(resolvedMatch),
            homeTeam: teams.home,
            awayTeam: teams.away,
            league: getMatchLeague(resolvedMatch),
            status: getMatchStatusLabel(resolvedMatch),
            score: getMatchScore(resolvedMatch),
            prediction: {
              recommendation: details.prediction.maitre.decision_finale?.pari_choisi || "N/A",
              confidence:
                details.prediction.maitre.decision_finale?.confidence ||
                details.prediction.maitre.decision_finale?.confiance_numerique ||
                0,
              odds: details.prediction.maitre.decision_finale?.cote || 0,
            },
            extraPowerFilter: details.extraPowerFilter,
          });
        }
      } catch (_error) {
        continue;
      }
    }

    res.json({
      success: true,
      data: {
        predictions,
        total: predictions.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PREDICTIONS_ERROR",
        message: "Impossible de recuperer les predictions.",
        details: error.message
      }
    });
  }
});

app.get("/api/predictions/top", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const predictions = [];

    for (const match of data.matches.slice(0, 20)) {
      try {
        const details = await getMatchPredictionDetails(getMatchId(match));
        const resolvedMatch = details?.match || match;
        const teams = getMatchTeams(resolvedMatch);
        if (details.prediction && details.prediction.maitre) {
          const confidence =
            details.prediction.maitre.decision_finale?.confidence ||
            details.prediction.maitre.decision_finale?.confiance_numerique ||
            0;
          const extraScore = details.extraPowerFilter?.score || 0;
          const combinedScore = confidence * 0.6 + extraScore * 0.4;

          predictions.push({
            matchId: getMatchId(resolvedMatch),
            homeTeam: teams.home,
            awayTeam: teams.away,
            league: getMatchLeague(resolvedMatch),
            status: getMatchStatusLabel(resolvedMatch),
            score: getMatchScore(resolvedMatch),
            prediction: {
              recommendation: details.prediction.maitre.decision_finale?.pari_choisi || "N/A",
              confidence,
              odds: details.prediction.maitre.decision_finale?.cote || 0,
            },
            extraPowerFilter: details.extraPowerFilter,
            combinedScore,
          });
        }
      } catch (_error) {
        continue;
      }
    }

    const topPredictions = predictions
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 10);
    
    res.json({
      success: true,
      data: {
        predictions: topPredictions,
        total: topPredictions.length
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "TOP_PREDICTIONS_ERROR",
        message: "Impossible de recuperer les meilleures predictions.",
        details: error.message
      }
    });
  }
});

app.get("/api/predictions/:matchId", async (req, res) => {
  try {
    const matchId = req.params.matchId;
    const details = await getMatchPredictionDetails(matchId);
    
    res.json({
      success: true,
      data: {
        prediction: details
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "PREDICTION_ERROR",
        message: "Impossible de recuperer la prediction pour ce match.",
        details: error.message
      }
    });
  }
});

app.get("/api/matches/:id/details", async (req, res) => {
  try {
    const details = await getMatchPredictionDetails(req.params.id);
    if (details?.match?.id) {
      // Persiste une empreinte du match pour que le suivi retrouve aussi le score final plus tard.
      authDb.upsertTrackedMatch(normalizePersistedMatch(details.match)).catch(() => {});
    }
    res.json({ success: true, source: API_URL, ...details });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible de calculer les predictions unifiees pour ce match.",
      error: error.message,
    });
  }
});

app.get("/api/coupon", async (req, res) => {
  try {
    const size = Number(req.query.size) || 3;
    const league = req.query.league ? String(req.query.league) : "all";
    const risk = req.query.risk ? String(req.query.risk) : "balanced";
    const coupon = await getCouponSelection(size, league, risk);
    try {
      await saveCouponGeneration({
        size,
        league,
        risk,
        source: API_URL,
        summary: coupon?.summary || {},
        coupon: Array.isArray(coupon?.coupon) ? coupon.coupon : [],
      });
    } catch (_dbError) {}
    res.json({ success: true, source: API_URL, ...coupon });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Impossible de generer le coupon optimise.",
      error: error.message,
    });
  }
});

app.post("/api/coupon/validate", validateBody(couponValidateSchema), async (req, res) => {
  try {
    const driftThresholdPercent = Number(req.body?.driftThresholdPercent) || 6;
    const report = await validateCouponTicket(req.body || {}, { driftThresholdPercent });
    try {
      await saveCouponValidation({
        driftThreshold: driftThresholdPercent,
        status: "ok",
        request: req.body || {},
        report,
      });
    } catch (_dbError) {}
    res.json({ success: true, source: API_URL, ...report });
  } catch (error) {
    try {
      await saveCouponValidation({
        driftThreshold: Number(req.body?.driftThresholdPercent) || 6,
        status: "error",
        request: req.body || {},
        report: {},
        error: error.message,
      });
    } catch (_dbError) {}
    res.status(500).json({
      success: false,
      message: "Impossible de valider le ticket coupon.",
      error: error.message,
    });
  }
});

app.get("/api/db/status", async (_req, res) => {
  try {
    return res.json({ success: true, db: await getDbStatus() });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de lire le statut DB.",
      error: error.message,
    });
  }
});

app.get("/api/coupon/favorites", validateQuery(watchlistQuerySchema), async (req, res) => {
  const userId = normalizeUserIdentifier(req.query.userId, "anonymous");
  try {
    const limit = Number(req.query.limit) || 20;
    
    const favorites = await getFavorites(userId, limit);
    
    res.json({
      success: true,
      data: {
        favorites: favorites,
        total: favorites.length,
        userId: userId
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        favorites: [],
        total: 0,
        userId: userId
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get("/api/coupon/journal", async (_req, res) => {
  try {
    const limit = 100;
    const items = await getCouponHistory(limit);
    
    const journal = items.map(item => ({
      id: item.id || item.couponId,
      timestamp: item.timestamp || new Date().toISOString(),
      matches: item.matches || [],
      totalOdds: item.totalOdds || 0,
      profit: item.profit || 0,
      status: item.status || "pending"
    })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: {
        journal: journal,
        total: journal.length
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        journal: [],
        total: 0
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get("/api/coupon/stats", async (req, res) => {
  try {
    const limit = 500;
    const items = await getCouponHistory(limit);
    
    const total = items.length;
    const won = items.filter(item => item.status === "won" || item.valid === true).length;
    const lost = items.filter(item => item.status === "lost" || item.valid === false).length;
    const pending = items.filter(item => item.status === "pending" || (!item.valid && !item.won)).length;
    
    const winRate = total > 0 ? ((won / total) * 100).toFixed(2) : 0;
    
    let totalProfit = 0;
    items.forEach(item => {
      if (item.profit && !isNaN(item.profit)) {
        totalProfit += Number(item.profit);
      }
    });
    
    res.json({
      success: true,
      data: {
        stats: {
          total,
          won,
          lost,
          pending,
          winRate: Number(winRate),
          profit: totalProfit
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        period: "last_500_coupons"
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        stats: {
          total: 0,
          won: 0,
          lost: 0,
          pending: 0,
          winRate: 0,
          profit: 0
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        period: "last_500_coupons"
      }
    });
  }
});

app.get("/api/coupon/history", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const items = await getCouponHistory(limit);
    return res.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error) {
    return res.json({
      success: true,
      total: 0,
      items: [],
    });
  }
});

app.get("/api/media/history", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 24));
    const items = await getGeneratedAssets(limit);
    const kind = String(req.query.kind || "").trim().toLowerCase();
    const filtered = kind ? items.filter((item) => String(item.kind || "").toLowerCase() === kind) : items;
    return res.json({
      success: true,
      total: filtered.length,
      items: filtered,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      total: 0,
      items: [],
      error: {
        code: "MEDIA_HISTORY_FETCH_ERROR",
        message: "Impossible de recuperer l'historique des medias generes.",
        details: error.message,
      },
    });
  }
});

app.post("/api/media/history", async (req, res) => {
  try {
    const record = buildGeneratedAssetRecord(req, {
      kind: req.body?.kind || "image",
      action: req.body?.action || req.body?.sourceAction || "manual_log",
      label: req.body?.label || null,
      fileName: req.body?.fileName || req.body?.file_name || null,
      format: req.body?.format || null,
      mimeType: req.body?.mimeType || req.body?.mime_type || null,
      source: req.body?.source || "client",
      relatedId: req.body?.relatedId || req.body?.related_id || null,
      asset: req.body?.asset || req.body?.meta || req.body?.payload || {},
    });
    const id = await saveGeneratedAsset(record);
    const items = await getGeneratedAssets(1);
    return res.status(201).json({
      success: true,
      message: "Media enregistre.",
      id,
      item: items[0] || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "MEDIA_HISTORY_SAVE_ERROR",
        message: "Impossible d'enregistrer le media genere.",
        details: error.message,
      },
    });
  }
});

app.delete("/api/media/history/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || id <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_ID",
          message: "ID invalide.",
        },
      });
    }
    const deleted = await deleteGeneratedAsset(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MEDIA_NOT_FOUND",
          message: "Media non trouve.",
        },
      });
    }
    return res.json({
      success: true,
      message: "Media supprime.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "MEDIA_DELETE_ERROR",
        message: "Erreur de suppression du media.",
        details: error.message,
      },
    });
  }
});

app.delete("/api/media/history", async (req, res) => {
  try {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_IDS",
          message: "IDs invalides.",
        },
      });
    }
    const deleted = await deleteGeneratedAssets(ids);
    return res.json({
      success: true,
      message: `${deleted} media(s) supprime(s).`,
      deleted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "MEDIA_BULK_DELETE_ERROR",
        message: "Erreur de suppression des medias.",
        details: error.message,
      },
    });
  }
});

app.get("/api/updates", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit) || 24));
    const items = await getUpdateHistory(limit);

    return res.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      total: 0,
      items: [],
      error: {
        code: "UPDATE_HISTORY_FETCH_ERROR",
        message: "Impossible de recuperer l'historique des mises a jour.",
        details: error.message,
      },
    });
  }
});

app.post("/api/updates", validateBody(updateHistorySchema), async (req, res) => {
  try {
    const insertedId = await saveUpdateEntry({
      version: req.body?.version,
      title: req.body?.title,
      summary: req.body?.summary,
      details: req.body?.details,
      highlights: req.body?.highlights,
      category: req.body?.category,
      author: req.body?.author,
      pinned: Boolean(req.body?.pinned),
    });
    const items = await getUpdateHistory(200);
    const update = items.find((item) => Number(item.id) === Number(insertedId)) || null;

    return res.status(201).json({
      success: true,
      message: "Mise a jour enregistree.",
      update,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "UPDATE_HISTORY_SAVE_ERROR",
        message: "Impossible d'enregistrer la mise a jour.",
        details: error.message,
      },
    });
  }
});

app.get("/api/coupon/:id", async (req, res) => {
  try {
    const couponId = req.params.id;
    const limit = 100;
    const items = await getCouponHistory(limit);
    const coupon = items.find(item => item.id === couponId || item.couponId === couponId);
    
    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: {
          code: "COUPON_NOT_FOUND",
          message: "Coupon non trouve."
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        coupon: coupon
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "COUPON_FETCH_ERROR",
        message: "Impossible de recuperer le coupon.",
        details: error.message
      }
    });
  }
});

app.post("/api/coupon/favorite", validateBody(couponFavoriteSchema), async (req, res) => {
  try {
    const couponId = req.body.couponId;
    const userId = req.body.userId || "anonymous";
    const coupon = req.body.coupon || {};
    
    if (!couponId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_COUPON_ID",
          message: "Coupon ID requis."
        }
      });
    }
    
    await saveFavorite({
      userId,
      couponId,
      coupon
    });
    
    res.json({
      success: true,
      data: {
        message: "Coupon ajoute aux favoris",
        couponId: couponId,
        userId: userId
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "COUPON_FAVORITE_ERROR",
        message: "Impossible d'ajouter le coupon aux favoris.",
        details: error.message
      }
    });
  }
});

app.get("/api/watchlist", validateQuery(watchlistQuerySchema), async (req, res) => {
  const userId = normalizeUserIdentifier(req.query.userId, "default");
  try {
    const watchlistState = await getWatchlist(userId);
    res.json({
      success: true,
      data: {
        watchlist: watchlistState.matchIds,
        total: watchlistState.matchIds.length,
        userId: watchlistState.userId,
        snapshot: watchlistState.snapshot,
        updatedAt: watchlistState.updatedAt
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "WATCHLIST_ERROR",
        message: "Impossible de recuperer la watchlist.",
        details: error.message
      }
    });
  }
});

app.post("/api/watchlist", validateBody(watchlistSchema), async (req, res) => {
  const userId = normalizeUserIdentifier(req.body?.userId, "default");
  try {
    const existing = await getWatchlist(userId);
    let nextMatchIds = Array.isArray(req.body?.matchIds)
      ? normalizeIdList(req.body.matchIds)
      : existing.matchIds;

    const addMatchId = trimText(req.body?.addMatchId, 80);
    if (addMatchId) {
      nextMatchIds = normalizeIdList([...nextMatchIds, addMatchId]);
    }

    const removeMatchId = trimText(req.body?.removeMatchId, 80);
    if (removeMatchId) {
      nextMatchIds = nextMatchIds.filter((matchId) => matchId !== removeMatchId);
    }

    const snapshot =
      req.body?.snapshot && typeof req.body.snapshot === "object" && !Array.isArray(req.body.snapshot)
        ? normalizePlainObject(req.body.snapshot)
        : existing.snapshot;

    const saved = await saveWatchlist({
      userId,
      matchIds: nextMatchIds,
      snapshot,
    });

    res.json({
      success: true,
      data: {
        watchlist: saved.matchIds,
        total: saved.matchIds.length,
        userId: saved.userId,
        snapshot: saved.snapshot,
        updatedAt: saved.updatedAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "WATCHLIST_SAVE_ERROR",
        message: "Impossible d'enregistrer la watchlist.",
        details: error.message,
      },
    });
  }
});

app.get("/api/mobile/bootstrap", async (_req, res) => {
  try {
    const dbStatus = await getDbStatus();
    res.json({
      success: true,
      data: buildMobileBootstrapData(dbStatus),
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MOBILE_BOOTSTRAP_ERROR",
        message: "Impossible de construire le bootstrap mobile.",
        details: error.message,
      },
    });
  }
});

app.get("/api/mobile/openapi", (_req, res) => {
  res.sendFile(path.join(__dirname, "docs", "android-api.openapi.json"));
});

app.post("/api/mobile/devices/register", validateBody(mobileDeviceRegisterSchema), async (req, res) => {
  try {
    const deviceId = trimText(req.body?.deviceId, 255);
    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "MISSING_DEVICE_ID",
          message: "deviceId requis.",
        },
      });
    }

    const record = await registerMobileDevice({
      userId: req.body?.userId ? normalizeUserIdentifier(req.body.userId, "default") : null,
      platform: trimText(req.body?.platform || "android", 40) || "android",
      deviceId,
      pushToken: trimText(req.body?.pushToken || req.body?.fcmToken, 2000) || null,
      appVersion: trimText(req.body?.appVersion, 120) || null,
      meta: normalizePlainObject(req.body?.meta),
    });

    return res.json({
      success: true,
      data: record,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "MOBILE_DEVICE_REGISTER_ERROR",
        message: "Impossible d'enregistrer l'appareil mobile.",
        details: error.message,
      },
    });
  }
});

app.get("/api/heatmap", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const leagueHeatmap = new Map();

    data.matches.forEach((match) => {
      const league = getMatchLeague(match);
      if (!leagueHeatmap.has(league)) {
        leagueHeatmap.set(league, { total: 0, live: 0, upcoming: 0, avgOdds: [] });
      }
      const stats = leagueHeatmap.get(league);
      stats.total++;
      const status = classifyMatchStatus(match);
      if (status === "live") stats.live++;
      else if (status === "upcoming") stats.upcoming++;

      const odd = getMatchAverageOdd(match);
      if (Number.isFinite(odd)) stats.avgOdds.push(odd);
    });

    const heatmap = Array.from(leagueHeatmap.entries()).map(([name, stats]) => ({
      name,
      ...stats,
      avgOdds: stats.avgOdds.length > 0 ? (stats.avgOdds.reduce((a, b) => a + b, 0) / stats.avgOdds.length).toFixed(2) : 0,
    })).sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      data: {
        heatmap,
        total: heatmap.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "HEATMAP_ERROR",
        message: "Impossible de recuperer la heatmap.",
        details: error.message
      }
    });
  }
});

app.get("/api/denicheur", async (req, res) => {
  try {
    const fullOption = req.query.full === "true";
    const data = await getPenaltyMatches();
    const upcomingMatches = data.matches.filter((match) => classifyMatchStatus(match) === "upcoming");
    const denicheurMatches = upcomingMatches.slice(0, 10).map((match) => buildMatchSummary(match));

    res.json({
      success: true,
      data: {
        matches: denicheurMatches,
        total: denicheurMatches.length,
        fullOption,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "DENICHEUR_ERROR",
        message: "Impossible de recuperer le denicheur.",
        details: error.message
      }
    });
  }
});

app.get("/api/odds/alerts", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const alerts = [];

    data.matches.forEach((match) => {
      const oddValue = getMatchPrimaryOdd(match);
      if (Number.isFinite(oddValue) && (oddValue > 2.5 || oddValue < 1.3)) {
        alerts.push({
          ...buildMatchSummary(match),
          odds: oddValue,
          type: oddValue > 2.5 ? "HIGH_ODD" : "LOW_ODD",
        });
      }
    });

    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "ODDS_ALERTS_ERROR",
        message: "Impossible de recuperer les alerts de cotes.",
        details: error.message
      }
    });
  }
});

app.post("/api/coupon/generate", validateBody(couponGenerateSchema), async (req, res) => {
  try {
    const { size = 3, league = "all", risk = "balanced", stake = 1000 } = req.body;
    const data = await getPenaltyMatches();

    let matches = data.matches;
    if (league !== "all") {
      matches = matches.filter((match) => matchMatchesLeague(match, league));
    }

    const upcomingMatches = matches.filter((match) => classifyMatchStatus(match) === "upcoming");
    const selectedMatches = upcomingMatches.slice(0, size);

    const couponId = `coupon_${Date.now()}`;
    const coupon = {
      id: couponId,
      matches: selectedMatches.map((match) => ({
        ...buildMatchSummary(match),
        prediction: { recommendation: "1", confidence: 0.75 },
      })),
      config: { size, league, risk, stake },
      calculated: {
        totalOdds: selectedMatches.reduce((acc, match) => acc * (getMatchPrimaryOdd(match) || 1.5), 1),
        potentialWin: 0,
      },
      timestamp: new Date().toISOString(),
    };

    coupon.calculated.potentialWin = Math.round(coupon.calculated.totalOdds * stake);
    
    await saveCouponGeneration({
      size,
      league,
      risk,
      stake,
      source: API_URL,
      summary: {
        couponId,
        totalOdds: coupon.calculated.totalOdds,
        potentialWin: coupon.calculated.potentialWin,
        matchesCount: coupon.matches.length,
      },
    });

    res.json({
      success: true,
      data: {
        coupon,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "COUPON_GENERATE_ERROR",
        message: "Impossible de generer le coupon.",
        details: error.message
      }
    });
  }
});

app.post("/api/coupon/ladder", async (req, res) => {
  try {
    const { size = 3, league = "all", stake = 1000 } = req.body;
    const data = await getPenaltyMatches();

    let matches = data.matches;
    if (league !== "all") {
      matches = matches.filter((match) => matchMatchesLeague(match, league));
    }

    const upcomingMatches = matches.filter((match) => classifyMatchStatus(match) === "upcoming");
    const selectedMatches = upcomingMatches.slice(0, size);

    const ladderId = `ladder_${Date.now()}`;
    const ladder = {
      id: ladderId,
      coupons: [
        {
          name: "Safe (60%)",
          matches: selectedMatches.slice(0, Math.ceil(size * 0.6)).map((match) => buildMatchSummary(match)),
          stake: Math.round(stake * 0.6),
        },
        {
          name: "Balanced (30%)",
          matches: selectedMatches.slice(0, Math.ceil(size * 0.3)).map((match) => buildMatchSummary(match)),
          stake: Math.round(stake * 0.3),
        },
        {
          name: "Aggressive (10%)",
          matches: selectedMatches.slice(0, Math.ceil(size * 0.1)).map((match) => buildMatchSummary(match)),
          stake: Math.round(stake * 0.1),
        },
      ],
      timestamp: new Date().toISOString(),
    };

    await saveCouponGeneration({
      size,
      league,
      risk: "ladder",
      stake,
      source: API_URL,
      summary: {
        ladderId,
        couponsCount: ladder.coupons.length,
        totalStake: stake,
      },
    });

    res.json({
      success: true,
      data: {
        ladder,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "LADDER_ERROR",
        message: "Impossible de generer le ladder.",
        details: error.message
      }
    });
  }
});

app.post("/api/coupon/multi", async (req, res) => {
  try {
    const { size = 3, league = "all", stake = 1000 } = req.body;
    const data = await getPenaltyMatches();

    let matches = data.matches;
    if (league !== "all") {
      matches = matches.filter((match) => matchMatchesLeague(match, league));
    }

    const upcomingMatches = matches.filter((match) => classifyMatchStatus(match) === "upcoming");
    const selectedMatches = upcomingMatches.slice(0, size);

    const multiId = `multi_${Date.now()}`;
    const strategies = [
      {
        name: "Ultra-Safe",
        risk: "ultra_safe",
        matches: selectedMatches.slice(0, size).map((match) => ({
          ...buildMatchSummary(match),
          prediction: { recommendation: "1", confidence: 0.90 },
        })),
      },
      {
        name: "Safe",
        risk: "safe",
        matches: selectedMatches.slice(0, size).map((match) => ({
          ...buildMatchSummary(match),
          prediction: { recommendation: "1", confidence: 0.80 },
        })),
      },
      {
        name: "Balanced",
        risk: "balanced",
        matches: selectedMatches.slice(0, size).map((match) => ({
          ...buildMatchSummary(match),
          prediction: { recommendation: "1", confidence: 0.70 },
        })),
      },
      {
        name: "Aggressive",
        risk: "aggressive",
        matches: selectedMatches.slice(0, size).map((match) => ({
          ...buildMatchSummary(match),
          prediction: { recommendation: "1", confidence: 0.60 },
        })),
      },
    ];

    await saveCouponGeneration({
      size,
      league,
      risk: "multi",
      stake,
      source: API_URL,
      summary: {
        multiId,
        strategiesCount: strategies.length,
        totalStake: stake,
      },
    });

    res.json({
      success: true,
      data: {
        strategies,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "MULTI_ERROR",
        message: "Impossible de generer les strategies multiples.",
        details: error.message
      }
    });
  }
});

app.get("/api/match/:id/coach", async (req, res) => {
  try {
    const matchId = req.params.id;
    const details = await getMatchPredictionDetails(matchId);
    
    const coachAnalysis = {
      matchId: matchId,
      analysis: details.prediction?.maitre?.decision_finale?.pari_choisi || "N/A",
      confidence: details.prediction?.maitre?.decision_finale?.confidence || 0,
      recommendation: details.prediction?.maitre?.decision_finale?.cote || 0,
      reasoning: "Analyse basÃ©e sur les indicateurs techniques et historiques",
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: {
        coach: coachAnalysis
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "COACH_ERROR",
        message: "Impossible de recuperer l'analyse coach.",
        details: error.message
      }
    });
  }
});

app.get("/api/match/:id/kpi", async (req, res) => {
  try {
    const matchId = req.params.id;
    const data = await getPenaltyMatches();
    const match = data.matches.find((item) => getMatchId(item) === String(matchId));
    const teams = match ? getMatchTeams(match) : { home: "Equipe Domicile", away: "Equipe Exterieur" };
    
    const homeTeam = match ? match.O1 : "Ã‰quipe Domicile";
    const awayTeam = match ? match.O2 : "Ã‰quipe ExtÃ©rieur";
    
    const kpi = {
      matchId: matchId,
      homeTeam: teams.home,
      awayTeam: teams.away,
      metrics: {
        momentum: Math.random() * 100,
        form: Math.random() * 100,
        h2h: Math.random() * 100,
        goals: Math.random() * 100,
        defense: Math.random() * 100,
        attack: Math.random() * 100
      },
      radar: [
        Math.random() * 100,
        Math.random() * 100,
        Math.random() * 100,
        Math.random() * 100,
        Math.random() * 100,
        Math.random() * 100
      ],
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: {
        kpi: kpi
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "KPI_ERROR",
        message: "Impossible de recuperer les KPI.",
        details: error.message
      }
    });
  }
});

app.get("/api/match/:id/insight", async (req, res) => {
  try {
    const matchId = req.params.id;
    const data = await getPenaltyMatches();
    const match = data.matches.find((item) => getMatchId(item) === String(matchId));
    const teams = match ? getMatchTeams(match) : { home: "Equipe Domicile", away: "Equipe Exterieur" };
    
    const homeTeam = match ? match.O1 : "Ã‰quipe Domicile";
    const awayTeam = match ? match.O2 : "Ã‰quipe ExtÃ©rieur";
    
    const insights = [
      {
        type: "form",
        title: "Forme rÃ©cente",
        value: "L'Ã©quipe domicile est en bonne forme avec 3 victoires consÃ©cutives"
      },
      {
        type: "h2h",
        title: "Historique",
        value: "Les deux Ã©quipes se sont rencontrÃ©es 5 fois cette saison"
      },
      {
        type: "injury",
        title: "Blessures",
        value: "Aucun blessÃ© majeur signalÃ©"
      },
      {
        type: "weather",
        title: "Conditions",
        value: "Conditions idÃ©ales pour ce match"
      }
    ];
    
    res.json({
      success: true,
      data: {
        insights: insights,
        matchId: matchId
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INSIGHT_ERROR",
        message: "Impossible de recuperer les insights.",
        details: error.message
      }
    });
  }
});

app.get("/api/match/:id/exact-score", async (req, res) => {
  try {
    const matchId = String(req.params.id || "").trim();
    if (!/^\d+$/.test(matchId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_MATCH_ID",
          message: "Identifiant de match invalide.",
        },
      });
    }

    const details = await getMatchPredictionDetails(matchId);
    const resolvedMatch = details?.match || null;
    if (!resolvedMatch) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MATCH_NOT_FOUND",
          message: "Match introuvable.",
        },
      });
    }

    const teams = getMatchTeams(resolvedMatch);
    const exactScoreValue = details?.exactScore || null;
    const exactScoreAvailable = details?.exactScoreAvailable;
    const timestamp = new Date().toISOString();

    res.json({
      success: true,
      data: {
        matchId: getMatchId(resolvedMatch) || matchId,
        homeTeam: teams.home,
        awayTeam: teams.away,
        timestamp,
        exactScore: {
          available: typeof exactScoreAvailable === "boolean" ? exactScoreAvailable : Boolean(exactScoreValue),
          value: exactScoreValue,
        },
      },
      meta: {
        timestamp,
      }
    });
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("introuvable")) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MATCH_NOT_FOUND",
          message: "Match introuvable.",
        },
      });
    }
    res.status(500).json({
      success: false,
      error: {
        code: "EXACT_SCORE_ERROR",
        message: "Impossible de recuperer la projection detaillee.",
        details: error.message
      }
    });
  }
});

app.get("/api/stats/global", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const couponLimit = 500;
    const couponItems = await getCouponHistory(couponLimit);
    
    const matchSummary = summarizeMatchBuckets(data.matches);
    
    const totalCoupons = couponItems.length;
    const wonCoupons = couponItems.filter(item => item.status === "won" || item.valid === true).length;
    const lostCoupons = couponItems.filter(item => item.status === "lost" || item.valid === false).length;
    const pendingCoupons = couponItems.filter(item => item.status === "pending" || (!item.valid && !item.won)).length;
    const winRate = totalCoupons > 0 ? ((wonCoupons / totalCoupons) * 100).toFixed(2) : 0;
    
    let totalProfit = 0;
    couponItems.forEach(item => {
      if (item.profit && !isNaN(item.profit)) {
        totalProfit += Number(item.profit);
      }
    });
    
    const leagueStats = new Map();
    data.matches.forEach((match) => {
      const league = getMatchLeague(match);
      if (!leagueStats.has(league)) {
        leagueStats.set(league, { total: 0, live: 0, upcoming: 0, finished: 0 });
      }
      const stats = leagueStats.get(league);
      stats.total++;
      const status = classifyMatchStatus(match);
      if (status === "live") stats.live++;
      else if (status === "finished") stats.finished++;
      else stats.upcoming++;
    });
    
    const leagues = Array.from(leagueStats.entries()).map(([name, stats]) => ({ name, ...stats }));
    
    res.json({
      success: true,
      data: {
        global: {
          matches: {
            total: matchSummary.total,
            live: matchSummary.live,
            upcoming: matchSummary.upcoming,
            finished: matchSummary.finished
          },
          coupons: {
            total: totalCoupons,
            won: wonCoupons,
            lost: lostCoupons,
            pending: pendingCoupons,
            winRate: Number(winRate),
            profit: totalProfit
          },
          leagues: leagues
        },
        timestamp: new Date().toISOString(),
        source: API_URL
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "GLOBAL_STATS_ERROR",
        message: "Impossible de recuperer les statistiques globales.",
        details: error.message
      }
    });
  }
});

app.get("/api/stats/overview", async (_req, res) => {
  try {
    const data = await getPenaltyMatches();
    const couponLimit = 500;
    const couponItems = await getCouponHistory(couponLimit);
    
    const matchSummary = summarizeMatchBuckets(data.matches);
    
    const totalCoupons = couponItems.length;
    const wonCoupons = couponItems.filter(item => item.status === "won" || item.valid === true).length;
    const winRate = totalCoupons > 0 ? ((wonCoupons / totalCoupons) * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        overview: {
          matches: {
            total: matchSummary.total,
            live: matchSummary.live,
            upcoming: matchSummary.upcoming,
            finished: matchSummary.finished
          },
          coupons: {
            total: totalCoupons,
            won: wonCoupons,
            winRate: Number(winRate)
          }
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "STATS_OVERVIEW_ERROR",
        message: "Impossible de recuperer la vue d'ensemble des statistiques.",
        details: error.message
      }
    });
  }
});

app.get("/api/telegram/history", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const items = await getTelegramHistory(limit);
    return res.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de lire l'historique Telegram.",
      error: error.message,
    });
  }
});

app.get("/api/audit/history", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const items = await getAuditHistory(limit);
    return res.json({
      success: true,
      total: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de lire l'historique audit.",
      error: error.message,
    });
  }
});

app.post("/api/coupon/audit", async (req, res) => {
  try {
    const now = new Date();
    const auditId =
      String(req.body?.auditId || "").trim() ||
      `AUD-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${String(
        now.getUTCHours()
      ).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}-${Math.floor(
        Math.random() * 9000 + 1000
      )}`;
    const saved = await saveAuditReport({
      auditId,
      action: req.body?.action || "coupon_export_pro",
      payload: req.body?.payload || {},
      result: req.body?.result || {},
    });
    return res.json({
      success: true,
      auditId: saved.auditId,
      id: saved.id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de sauvegarder l'audit.",
      error: error.message,
    });
  }
});

app.post("/api/patterns/report", validateBody(patternsReportSchema), (req, res) => {
  try {
    const matches = Array.isArray(req.body?.matches) ? req.body.matches : [];
    const minRulePlayed = Number(req.body?.minRulePlayed) > 0 ? Number(req.body.minRulePlayed) : 5;
    const featureRows = matches.map(toFeatures);
    const dedupRows = deduplicate(featureRows);
    const totalValidated = Number(req.body?.totalValidated) > 0 ? Number(req.body.totalValidated) : dedupRows.length;
    const engine = buildDecisionEngine(dedupRows, totalValidated, { minRulePlayed });
    return res.json({
      success: true,
      totalInput: matches.length,
      totalFeatures: featureRows.length,
      totalDeduplicated: dedupRows.length,
      report: engine.report,
      rules: extractRules(dedupRows, minRulePlayed),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de construire le rapport patterns.",
      error: error.message,
    });
  }
});

app.post("/api/patterns/decide", (req, res) => {
  try {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const candidate = req.body?.candidate || {};
    const options = req.body?.options || {};
    const featureRows = deduplicate(history.map(toFeatures));
    const totalValidated = Number(req.body?.totalValidated) > 0 ? Number(req.body.totalValidated) : featureRows.length;
    const engine = buildDecisionEngine(featureRows, totalValidated, options);
    const decision = engine.decide(candidate);
    const scored = engine.scoreCandidate(candidate);

    return res.json({
      success: true,
      totalValidated,
      historySize: featureRows.length,
      decision,
      previewScore: scored,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible d'evaluer ce candidat.",
      error: error.message,
    });
  }
});

app.post("/api/patterns/csv", (req, res) => {
  try {
    const matches = Array.isArray(req.body?.matches) ? req.body.matches : [];
    const featureRows = matches.map(toFeatures);
    const csv = toTrainReadyCSV(featureRows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="train_ready_export_${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de generer le CSV train-ready.",
      error: error.message,
    });
  }
});

async function generateCouponPdfHandler(req, res) {
  try {
    const coupon = Array.isArray(req.body?.coupon) ? req.body.coupon : [];
    if (!coupon.length) {
      return res.status(400).json({
        success: false,
        message: "Coupon vide. Impossible de generer le PDF.",
      });
    }
    const started = getStartedSelections(coupon);
    if (started.length) {
      return res.status(400).json({
        success: false,
        message: "PDF bloque: le coupon contient des matchs deja demarres.",
      });
    }

    const mode = String(req.body?.mode || "summary").toLowerCase();
    const isDetailed = mode === "detailed" || mode === "detail" || mode === "analysis";
    const isQuick = mode === "quick" || mode === "short" || mode === "ultra";
    const pdfLines = isDetailed
      ? buildCouponPdfDetailedLines(req.body || {})
      : isQuick
      ? buildCouponPdfQuickLines(req.body || {})
      : buildCouponPdfSummaryLines(req.body || {});
    const pdfBuffer = buildSimplePdf(pdfLines);
    const filename = `coupon-fc25-${isDetailed ? "detail" : isQuick ? "rapide" : "resume"}-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    await saveGeneratedAsset(
      buildGeneratedAssetRecord(req, {
        kind: "pdf",
        action: "download_coupon_pdf",
        label: isDetailed ? "Coupon PDF detaille" : isQuick ? "Coupon PDF rapide" : "Coupon PDF resume",
        fileName: filename,
        format: "pdf",
        mimeType: "application/pdf",
        source: String(req?.body?.source || "coupon").trim() || "coupon",
        asset: req.body || {},
      })
    );
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de generer le PDF coupon.",
      error: error.message,
    });
  }
}

async function generateCouponImageHandler(req, res) {
  try {
    const coupon = Array.isArray(req.body?.coupon) ? req.body.coupon : [];
    if (!coupon.length) {
      return res.status(400).json({
        success: false,
        message: "Coupon vide. Impossible de generer l'image.",
      });
    }
    const started = getStartedSelections(coupon);
    if (started.length) {
      return res.status(400).json({
        success: false,
        message: "Image bloquee: le coupon contient des matchs deja demarres.",
      });
    }
    const requested = req.body?.format || req.query?.format || "png";
    const format = normalizeImageFormat(requested, "png");
    const svg = buildCouponImageSvg(req.body || {});
    if (format === "svg") {
      const filename = `one-delux-${Date.now()}.svg`;
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      await saveGeneratedAsset(
        buildGeneratedAssetRecord(req, {
          kind: "image",
          action: "download_coupon_image",
          label: "Image coupon ONE-DELUX",
          fileName: filename,
          format: "svg",
          mimeType: "image/svg+xml",
          source: String(req?.body?.source || "coupon").trim() || "coupon",
          asset: req.body || {},
        })
      );
      return res.send(svg);
    }
    const output = await rasterizeSvg(svg, format);
    const ext = format === "jpg" ? "jpg" : "png";
    const filename = `one-delux-${Date.now()}.${ext}`;
    res.setHeader("Content-Type", format === "jpg" ? "image/jpeg" : "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await saveGeneratedAsset(
      buildGeneratedAssetRecord(req, {
        kind: "image",
        action: "download_coupon_image",
        label: "Image coupon ONE-DELUX",
        fileName: filename,
        format: ext,
        mimeType: format === "jpg" ? "image/jpeg" : "image/png",
        source: String(req?.body?.source || "coupon").trim() || "coupon",
        asset: req.body || {},
      })
    );
    return res.send(output);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Impossible de generer l'image coupon (PNG/JPG).",
      error: error.message,
    });
  }
}

function buildCouponPdfBuffer(payload = {}, mode = "quick") {
  const m = String(mode || "quick").toLowerCase();
  const lines =
    m === "detailed" || m === "detail" || m === "analysis"
      ? buildCouponPdfDetailedLines(payload)
      : m === "quick" || m === "short" || m === "ultra"
      ? buildCouponPdfQuickLines(payload)
      : buildCouponPdfSummaryLines(payload);
  return buildSimplePdf(lines);
}

async function resolveTelegramChatId(botToken) {
  let chatId = String(process.env.TELEGRAM_CHANNEL_ID || "").trim();
  if (chatId) return chatId;
  const updatesRes = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=30&timeout=1`);
  const updatesData = await updatesRes.json();
  if (!updatesRes.ok || !updatesData?.ok) {
    throw new Error(updatesData?.description || "getUpdates indisponible.");
  }
  const updates = Array.isArray(updatesData.result) ? updatesData.result : [];
  for (let i = updates.length - 1; i >= 0; i -= 1) {
    const chat = updates[i]?.message?.chat || updates[i]?.channel_post?.chat;
    if (chat?.id && (chat?.type === "private" || chat?.type === "group" || chat?.type === "supergroup")) {
      chatId = String(chat.id);
      break;
    }
  }
  if (!chatId) {
    throw new Error("Aucun chat detecte. Ecris d'abord un message au bot puis reessaie.");
  }
  return chatId;
}

async function sendTelegramDocument(botToken, chatId, fileBlob, fileName, caption = "") {
  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption);
  form.append("document", fileBlob, fileName);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "API Telegram indisponible.");
  }
  return data?.result?.message_id || null;
}

async function sendTelegramPhoto(botToken, chatId, photoBlob, fileName, caption = "") {
  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption);
  form.append("photo", photoBlob, fileName);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "API Telegram indisponible.");
  }
  return data?.result?.message_id || null;
}

async function answerTelegramCallback(botToken, callbackQueryId, text = "") {
  const callbackId = String(callbackQueryId || "").trim();
  if (!botToken || !callbackId) return null;
  const payload = {
    callback_query_id: callbackId,
    text: String(text || "").slice(0, 200),
    show_alert: false,
  };
  const res = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "API Telegram indisponible.");
  }
  return true;
}

const TELEGRAM_SESSION_DEFAULTS = {
  preferences: {
    size: 3,
    league: "all",
    risk: "balanced",
    stake: 1000,
  },
  lastCoupon: null,
  lastLadder: null,
  lastMatchId: null,
  lastMode: null,
  state: {},
  pendingActions: [],
};

function buildTelegramSessionSnapshot(chatId, meta = {}, stored = null) {
  const preferences = {
    ...TELEGRAM_SESSION_DEFAULTS.preferences,
    ...(stored?.preferences || {}),
  };
  return {
    chatId: String(chatId || stored?.chatId || "").trim(),
    username: meta?.username || stored?.username || null,
    preferences,
    lastCoupon: stored?.lastCoupon || null,
    lastLadder: stored?.lastLadder || null,
    lastMatchId: stored?.lastMatchId || null,
    lastMode: stored?.lastMode || null,
    state: stored?.state && typeof stored.state === "object" ? stored.state : {},
    pendingActions: Array.isArray(stored?.pendingActions) ? stored.pendingActions : [],
    updatedAt: stored?.updatedAt || new Date().toISOString(),
    createdAt: stored?.createdAt || null,
    lastSeenAt: stored?.lastSeenAt || null,
  };
}

async function loadTelegramSession(chatId, meta = {}) {
  const key = String(chatId || "").trim();
  if (!key) return null;
  if (telegramSessionState.has(key)) {
    const cached = telegramSessionState.get(key);
    const mergedCached = buildTelegramSessionSnapshot(key, meta, cached);
    telegramSessionState.set(key, mergedCached);
    return mergedCached;
  }

  const stored = await getStoredTelegramSession(key).catch(() => null);
  const session = buildTelegramSessionSnapshot(key, meta, stored);
  telegramSessionState.set(key, session);
  return session;
}

async function persistTelegramSession(session, meta = {}) {
  const key = String(session?.chatId || meta?.chatId || "").trim();
  if (!key) return null;
  const payload = buildTelegramSessionSnapshot(key, meta, session);
  const saved = await upsertTelegramSession({
    chatId: payload.chatId,
    username: payload.username,
    preferences: payload.preferences,
    lastCoupon: payload.lastCoupon,
    lastLadder: payload.lastLadder,
    lastMatchId: payload.lastMatchId,
    lastMode: payload.lastMode,
    state: payload.state,
    pendingActions: payload.pendingActions,
  }).catch(() => null);
  const finalSession = buildTelegramSessionSnapshot(key, meta, saved || payload);
  telegramSessionState.set(key, finalSession);
  return finalSession;
}

function getLocalApiBaseUrl() {
  const port = Number(activeServerPort || process.env.PORT || DEFAULT_PORT || 3000);
  return `http://127.0.0.1:${port}`;
}

async function callLocalApi(path, { method = "GET", body = null, headers = {}, timeoutMs = 12000 } = {}) {
  const url = `${getLocalApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestHeaders = { ...headers };
    if (body) requestHeaders["Content-Type"] = "application/json";
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || data?.error?.message || data?.error || `HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: String(text || "").slice(0, 3900),
    disable_web_page_preview: true,
    ...options,
  };
  if (options?.reply_markup && typeof options.reply_markup === "object") {
    payload.reply_markup = options.reply_markup;
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "API Telegram indisponible.");
  }
  return data?.result?.message_id || null;
}

function normalizeTelegramFilter(text = "") {
  return normalizeLookupText(String(text || ""));
}

function telegramTextMatches(text = "", keywords = []) {
  const normalized = normalizeTelegramFilter(text);
  return keywords.some((keyword) => normalized.includes(normalizeLookupText(keyword)));
}

function resolveTelegramActionKey(text = "") {
  const normalized = normalizeTelegramFilter(text).replace(/^tg[:\s-]*/, "").trim();
  if (!normalized) return "";

  const actionGroups = [
    { key: "dashboard", aliases: ["dashboard", "tableau de bord", "tableau", "resume", "accueil", "home"] },
    { key: "status", aliases: ["status", "statut", "statue", "etat", "state", "health"] },
    { key: "live", aliases: ["live", "direct", "en cours", "match live", "matchs live", "stream"] },
    { key: "upcoming", aliases: ["upcoming", "a venir", "avenir", "avenue", "match a venir", "matchs a venir"] },
    { key: "finished", aliases: ["finished", "termines", "termine", "terminees", "terminee", "match termine", "matchs termines"] },
    { key: "history", aliases: ["history", "historique", "archives"] },
    { key: "watchlist", aliases: ["watchlist", "watch nice", "favoris", "favorites", "suivi"] },
    { key: "journal", aliases: ["journal", "log", "rapport", "performance"] },
    { key: "tracking", aliases: ["tracking", "tracker", "suivi des matchs", "suivi matchs"] },
    { key: "coupon", aliases: ["coupon", "coupeau", "ticket", "bon"] },
    { key: "premium", aliases: ["premium", "pro", "premium image"] },
    { key: "story", aliases: ["story", "snap", "story image"] },
    { key: "ladder", aliases: ["ladder", "echelle", "60 30 10"] },
    { key: "multi", aliases: ["multi", "plusieurs profils", "comparatif"] },
    { key: "image", aliases: ["image", "visuel", "photo", "png", "jpg", "jpeg"] },
    { key: "pdf", aliases: ["pdf", "document", "rapport"] },
    { key: "pack", aliases: ["pack", "bundle", "groupe", "ensemble"] },
    { key: "validate", aliases: ["validate", "validation", "valider", "valide"] },
    { key: "lastmatch", aliases: ["lastmatch", "dernier match", "match courant", "match"] },
    { key: "menu", aliases: ["menu", "help", "aide", "assistance", "commandes"] },
  ];

  for (const group of actionGroups) {
    if (group.aliases.some((alias) => normalized === normalizeLookupText(alias) || normalized.includes(normalizeLookupText(alias)))) {
      return group.key;
    }
  }

  return normalized;
}

function extractTelegramMode(text = "") {
  const normalized = resolveTelegramActionKey(text);
  if (normalized === "pack") return "pack";
  if (normalized === "premium") return "premium";
  if (normalized === "story") return "story";
  if (normalized === "image") return "image";
  if (normalized === "pdf") return "pdf";
  if (normalized === "validate") return "validate";
  if (normalized === "history") return "history";
  if (normalized === "watchlist") return "watchlist";
  if (normalized === "journal") return "journal";
  if (normalized === "tracking") return "tracking";
  if (normalized === "premium") return "premium";
  if (normalized === "story") return "story";
  if (normalized === "ladder") return "ladder";
  if (normalized === "multi") return "multi";
  if (normalized === "status") return "status";
  if (normalized === "dashboard") return "dashboard";
  if (normalized === "menu") return "help";
  return null;
}

function extractTelegramSize(text = "", fallback = 3) {
  const normalized = normalizeTelegramFilter(text);
  const match = normalized.match(/\b([1-9]|1[0-2])\b/);
  return match ? Math.max(1, Math.min(12, Number(match[1]))) : fallback;
}

function extractTelegramRisk(text = "", fallback = "balanced") {
  const normalized = normalizeTelegramFilter(text);
  if (normalized.includes("ultra safe") || normalized.includes("ultrasafe")) return "safe";
  if (normalized.includes("safe") || normalized.includes("prudent") || normalized.includes("conservateur")) return "safe";
  if (normalized.includes("aggressive") || normalized.includes("agressif") || normalized.includes("attaque")) return "aggressive";
  if (normalized.includes("balanced") || normalized.includes("equilibre") || normalized.includes("standard")) return "balanced";
  return fallback;
}

function extractTelegramLeague(text = "") {
  const raw = String(text || "");
  const eq = raw.match(/(?:league|ligue)\s*[:=]\s*([^\n]+)/i);
  if (eq?.[1]) return eq[1].trim();
  return /all|toutes|tous/i.test(raw) ? "all" : "";
}

function extractTelegramStake(text = "", fallback = 1000) {
  const raw = String(text || "");
  const match = raw.match(/(?:stake|mise)\s*[:=]\s*(\d+(?:[.,]\d+)?)/i);
  if (match?.[1]) return Math.max(0, Number(match[1].replace(",", ".")));
  return fallback;
}

function extractTelegramMatchId(text = "") {
  const raw = String(text || "").trim();
  const direct = raw.match(/(?:match|details?|id)\s*[:#=]?\s*([a-z0-9_-]{3,})/i);
  if (direct?.[1]) return direct[1];
  const slash = raw.match(/^\/(?:match|details)\s+([a-z0-9_-]{3,})/i);
  if (slash?.[1]) return slash[1];
  return "";
}

function resolveTelegramCallbackCommand(data = "", session = null) {
  const action = resolveTelegramActionKey(data);
  if (!action) return "";
  if (action === "dashboard") return "/dashboard";
  if (action === "status") return "/status";
  if (action === "live") return "/live";
  if (action === "upcoming") return "/upcoming";
  if (action === "finished") return "/finished";
  if (action === "history") return "/history";
  if (action === "watchlist") return "/watchlist";
  if (action === "journal") return "/journal";
  if (action === "tracking") return "/tracking";
  if (action === "coupon") return "/coupon";
  if (action === "image") return "/coupon image";
  if (action === "pdf") return "/coupon pdf";
  if (action === "pack") return "/coupon pack";
  if (action === "validate") return "/coupon validate";
  if (action === "menu") return "/help";
  if (action === "lastmatch") {
    const matchId = String(session?.lastMatchId || "").trim();
    return matchId ? `/match ${matchId}` : "/match";
  }
  return `/${action.replace(/^\/+/, "")}`;
}

function buildTelegramHelpText() {
  return [
    "ONE-DELUX | Tour de contrôle Telegram",
    "Tu peux piloter le site avec un niveau de confort premium, sans ouvrir le navigateur.",
    "",
    "Menu rapide: les boutons inline donnent accès aux actions clés en un geste.",
    "",
    "Commandes rapides:",
    "/start ou /help - menu complet et pilotage direct",
    "/dashboard - tableau de bord complet",
    "/status - etat du systeme",
    "/live - matchs en direct",
    "/upcoming - matchs a venir",
    "/finished - matchs termines",
    "/match ID - details d'un match",
    "/coupon size=3 risk=balanced league=all - generer un ticket",
    "/coupon image - envoyer le visuel du dernier ticket",
    "/coupon pdf - envoyer le PDF du dernier ticket",
    "/coupon pack - texte + image + PDF",
    "/coupon validate - verifier le ticket",
    "/ladder - repartir 60/30/10",
    "/multi - comparer plusieurs profils",
    "/history - historique des tickets",
    "/watchlist - watchlist Telegram",
    "/journal - journal de performance",
    "/tracking - etat du tracker de matchs",
    "",
    "Astuce: en texte libre, tu peux aussi demander une analyse, une synthese ou une action precise.",
  ].join("\n");
}

function buildTelegramStatusText(data = {}) {
  const health = data?.health || {};
  const db = data?.db || {};
  const coupons = data?.couponStats?.data?.stats || data?.couponStats?.data || {};
  return [
    "ETAT SYSTEME | ONE-DELUX",
    `Serveur principal: ${health?.success === false ? "attention requise" : "stable"}`,
    `Uptime: ${health?.uptimeSec ?? 0}s`,
    `Base de donnees: ${db?.status || health?.database?.status || "unknown"}`,
    `Couverture coupons: ${coupons?.total ?? 0}`,
    `Taux de gain: ${coupons?.winRate ?? 0}%`,
    `Profit cumule: ${coupons?.profit ?? 0}`,
    "",
    "Lecture rapide: le bot est pret pour les actions fortes et les envois Telegram.",
  ].join("\n");
}

function buildTelegramMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Tableau de bord", callback_data: "tg:dashboard" },
        { text: "État système", callback_data: "tg:status" },
      ],
      [
        { text: "En direct", callback_data: "tg:live" },
        { text: "À venir", callback_data: "tg:upcoming" },
        { text: "Terminés", callback_data: "tg:finished" },
      ],
      [
        { text: "Ticket", callback_data: "tg:coupon" },
        { text: "Visuel", callback_data: "tg:image" },
        { text: "PDF pro", callback_data: "tg:pdf" },
      ],
      [
        { text: "Pack premium", callback_data: "tg:pack" },
        { text: "Valider", callback_data: "tg:validate" },
        { text: "Historique", callback_data: "tg:history" },
      ],
      [
        { text: "Watchlist", callback_data: "tg:watchlist" },
        { text: "Journal", callback_data: "tg:journal" },
        { text: "Dernier match", callback_data: "tg:lastmatch" },
      ],
      [
        { text: "Suivi", callback_data: "tg:tracking" },
        { text: "Aide", callback_data: "tg:menu" },
      ],
    ],
  };
}

function buildTelegramDashboardText(data = {}) {
  const health = data?.health || {};
  const db = data?.db || {};
  const couponStats = data?.couponStats?.data?.stats || data?.couponStats?.data || {};
  const session = data?.session || {};
  const liveCount = Number(data?.liveCount ?? data?.live?.count ?? data?.live?.matches?.length ?? 0);
  const upcomingCount = Number(data?.upcomingCount ?? data?.upcoming?.count ?? data?.upcoming?.matches?.length ?? 0);
  const finishedCount = Number(data?.finishedCount ?? data?.finished?.count ?? data?.finished?.matches?.length ?? 0);
  const preferenceLine = [
    `Taille ${session?.preferences?.size ?? 3}`,
    `Risque ${session?.preferences?.risk || "balanced"}`,
    `Ligue ${session?.preferences?.league || "all"}`,
    `Mise ${session?.preferences?.stake ?? 1000}`,
  ].join(" | ");
  const lastCoupon = session?.lastCoupon?.summary || session?.lastCoupon?.coupon?.[0] || null;
  const lastCouponLine = lastCoupon
    ? `Dernier ticket: ${Number(session?.lastCoupon?.summary?.totalSelections || session?.lastCoupon?.coupon?.length || 0)} selection(s) | Cote ${formatOddForTelegram(session?.lastCoupon?.summary?.combinedOdd)}`
    : "Dernier ticket: aucun";
  return [
    "TABLEAU DE BORD | ONE-DELUX",
    `Serveur: ${health?.success === false ? "KO" : "OK"}`,
    `Base de donnees: ${db?.status || health?.database?.status || "unknown"}`,
    `Matchs live / a venir / termines: ${liveCount} / ${upcomingCount} / ${finishedCount}`,
    `Tickets: ${couponStats?.total ?? 0} | Taux de gain: ${couponStats?.winRate ?? 0}% | Profit: ${couponStats?.profit ?? 0}`,
    `Session premium: ${preferenceLine}`,
    `Mode actuel: ${session?.lastMode || "aucun"} | Dernier match: ${session?.lastMatchId || "aucun"}`,
    lastCouponLine,
    "",
    "Utilise les boutons ci-dessous pour piloter le bot avec precision.",
  ].join("\n");
}

function normalizePersistedMatch(match = {}) {
  const teams = getMatchTeams(match);
  const score = getMatchScore(match);
  const odds = getMatchOdds(match);
  const prediction = normalizePlainObject(match?.prediction);
  return {
    matchId: getMatchId(match),
    teamHome: teams.home || "Equipe 1",
    teamAway: teams.away || "Equipe 2",
    league: getMatchLeague(match),
    status: classifyMatchStatus(match),
    minute: getMatchMinute(match),
    startTimeUnix: Number(match?.startTimeUnix || 0) || null,
    scoreHome: Number(score.home) || 0,
    scoreAway: Number(score.away) || 0,
    odds,
    prediction,
    source: "liveFeed",
  };
}

function buildMatchTrackingCounts(matches = []) {
  const buckets = { live: 0, upcoming: 0, finished: 0 };
  for (const match of matches) {
    const status = classifyMatchStatus(match);
    if (status === "finished") buckets.finished += 1;
    else if (status === "upcoming") buckets.upcoming += 1;
    else buckets.live += 1;
  }
  buckets.total = matches.length;
  return buckets;
}

async function runMatchTrackingCycle(reason = "scheduled") {
  if (!matchTrackingConfig.enabled) return null;
  if (matchTrackingRunning) return null;

  matchTrackingRunning = true;
  const startedAt = new Date().toISOString();
  try {
    const data = await withTimeout(getPenaltyMatches(), 25_000, null);
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    const trackedMatches = matches.map(normalizePersistedMatch).filter((item) => item.matchId);
    const counts = buildMatchTrackingCounts(trackedMatches);
    matchTrackingRunCount += 1;
    const finishedAt = new Date().toISOString();

    await authDb.saveMatchTrackingSnapshot({
      trackerKey: matchTrackingConfig.trackerKey,
      enabled: true,
      intervalSeconds: matchTrackingConfig.intervalSeconds,
      totalRuns: matchTrackingRunCount,
      source: "liveFeed",
      fetchedAt: data?.fetchedAt || startedAt,
      lastStartedAt: startedAt,
      lastCompletedAt: finishedAt,
      lastSuccessAt: finishedAt,
      counts,
      matches: trackedMatches,
    });

    return {
      ok: true,
      reason,
      counts,
      tracked: trackedMatches.length,
      fetchedAt: data?.fetchedAt || startedAt,
      startedAt,
      completedAt: finishedAt,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    try {
      await authDb.saveMatchTrackingSnapshot({
        trackerKey: matchTrackingConfig.trackerKey,
        enabled: true,
        intervalSeconds: matchTrackingConfig.intervalSeconds,
        totalRuns: matchTrackingRunCount,
        source: "liveFeed",
        lastStartedAt: startedAt,
        lastCompletedAt: finishedAt,
        lastErrorAt: finishedAt,
        lastErrorText: error.message,
        counts: { live: 0, upcoming: 0, finished: 0, total: 0 },
        matches: [],
        error: error.message,
      });
    } catch (_persistError) {}
    return { ok: false, error: error.message, reason, startedAt, completedAt: finishedAt };
  } finally {
    matchTrackingRunning = false;
  }
}

async function startMatchTrackingService() {
  if (!matchTrackingConfig.enabled || matchTrackingTimer) return matchTrackingTimer;
  try {
    const persistedState = await authDb.getMatchTrackingState(matchTrackingConfig.trackerKey).catch(() => null);
    if (persistedState?.totalRuns) {
      matchTrackingRunCount = Number(persistedState.totalRuns) || 0;
    }
  } catch (_error) {}

  setTimeout(() => {
    runMatchTrackingCycle("startup").catch((error) => {
      console.warn(`Match tracker startup error: ${error.message}`);
    });
  }, 10_000);

  matchTrackingTimer = setInterval(() => {
    runMatchTrackingCycle("interval").catch((error) => {
      console.warn(`Match tracker interval error: ${error.message}`);
    });
  }, matchTrackingConfig.intervalSeconds * 1000);

  console.log(
    `Match tracker actif: intervalle ${matchTrackingConfig.intervalSeconds}s, cle ${matchTrackingConfig.trackerKey}`
  );
  return matchTrackingTimer;
}

function buildTelegramMatchListText(title, matches = [], limit = 8) {
  const rows = Array.isArray(matches) ? matches.slice(0, limit) : [];
  if (!rows.length) return `${title}\nAucun match trouve pour le moment.`;
  const lines = [
    title,
    `Sélection premium: ${rows.length} match${rows.length > 1 ? "s" : ""}`,
    "",
  ];
  rows.forEach((match, index) => {
    const start = formatDateTime(match?.startTimeUnix ? Number(match.startTimeUnix) * 1000 : match?.startTime ? Number(match.startTime) * 1000 : null);
    lines.push(
      `${index + 1}. ${match?.homeTeam || match?.teamHome || "Equipe 1"} vs ${match?.awayTeam || match?.teamAway || "Equipe 2"} | ${match?.league || "Ligue"} | ${match?.status || "-"} | ${start}`
    );
  });
  lines.push("", "Si tu veux, je peux aussi ouvrir un match precis ou transformer cette liste en ticket.");
  return lines.join("\n");
}

function buildTelegramMatchDetailsText(details = {}) {
  const match = details?.match || {};
  const prediction = details?.prediction || {};
  const master = prediction?.maitre?.decision_finale || {};
  const top3 = prediction?.analyse_avancee?.top_3_recommandations || [];
  const exact = details?.exactScore?.primary?.score || details?.exactScore?.primary?.score || "-";
  const league = details?.leagueProfile?.title || match?.league || "-";
  const lines = [
    `MATCH PRIORITAIRE | ${match?.teamHome || "Equipe 1"} vs ${match?.teamAway || "Equipe 2"}`,
    `Ligue: ${league}`,
    `Debut: ${formatDateTime(match?.startTimeUnix ? Number(match.startTimeUnix) * 1000 : match?.startTime ? Number(match.startTime) * 1000 : null)}`,
    `Lecture maitre: ${master?.pari_choisi || "N/A"}`,
    `Confiance de lecture: ${master?.confiance_numerique ?? 0}%`,
  ];
  if (exact && exact !== "-") {
    lines.push(`Projection detaillee: ${exact}`);
  }
  if (Array.isArray(top3) && top3.length) {
    lines.push("Top 3 recommandations:");
    top3.slice(0, 3).forEach((item, index) => {
      lines.push(`  ${index + 1}. ${item?.pari || "-"} | ${Number(item?.confiance || 0).toFixed(1)}%`);
    });
  }
  lines.push("", "Si tu veux, je peux convertir ce match en ticket, visuel ou PDF.");
  return lines.join("\n");
}

function couponPayloadFromSelection(selection = {}, context = {}) {
  const match = selection?.match || selection;
  const recommendation = selection?.prediction?.recommendation || selection?.pari || "";
  return {
    coupon: [
      {
        matchId: selection?.matchId || match?.matchId || match?.id || "",
        teamHome: selection?.homeTeam || selection?.teamHome || match?.homeTeam || match?.teamHome || "Equipe 1",
        teamAway: selection?.awayTeam || selection?.teamAway || match?.awayTeam || match?.teamAway || "Equipe 2",
        league: selection?.league || match?.league || "Ligue",
        pari: recommendation || selection?.pari || "1",
        cote: Number(selection?.odds || selection?.cote || match?.odds || 1.5) || 1.5,
        confiance: Number(selection?.prediction?.confidence || selection?.confiance || 75) || 75,
        startTimeUnix: Number(selection?.startTime || match?.startTime || match?.startTimeUnix || 0) || null,
        exactScore: selection?.exactScore || context?.exactScore || null,
      },
    ],
    summary: {
      totalSelections: 1,
      combinedOdd: Number(selection?.odds || selection?.cote || match?.odds || 1.5) || 1.5,
      averageConfidence: Number(selection?.prediction?.confidence || selection?.confiance || 75) || 75,
    },
    insights: {},
    riskProfile: context?.riskProfile || "balanced",
  };
}

async function ensureTelegramCoupon(session, params = {}, force = false) {
  if (!session) return null;
  const nextSize = Math.max(1, Math.min(12, Number(params?.size || session.preferences?.size || 3)));
  const nextLeague = String(params?.league || session.preferences?.league || "all");
  const nextRisk = String(params?.risk || session.preferences?.risk || "balanced");
  const nextStake = Math.max(0, Number(params?.stake || session.preferences?.stake || 1000));
  session.preferences = {
    ...session.preferences,
    size: nextSize,
    league: nextLeague,
    risk: nextRisk,
    stake: nextStake,
  };
  if (!force && session.lastCoupon?.coupon?.length) {
    return session.lastCoupon;
  }
  const couponData = await callLocalApi(`/api/coupon?size=${encodeURIComponent(nextSize)}&league=${encodeURIComponent(nextLeague)}&risk=${encodeURIComponent(nextRisk)}`);
  session.lastCoupon = couponData;
  session.updatedAt = new Date().toISOString();
  return couponData;
}

async function sendTelegramCouponMedia(botToken, chatId, couponData, { mode = "default", format = "png" } = {}) {
  if (!couponData?.coupon?.length) return null;
  void mode;
  const useFormat = String(format || "png").toLowerCase() === "jpg" ? "jpg" : "png";
  const svg = buildCouponImageSvg(couponData);
  const buffer = await rasterizeSvg(svg, useFormat);
  return sendTelegramPhoto(
    botToken,
    chatId,
    new Blob([buffer], { type: useFormat === "jpg" ? "image/jpeg" : "image/png" }),
    `one-delux-${Date.now()}.${useFormat === "jpg" ? "jpg" : "png"}`,
    "Coupon image - ONE-DELUX | Signe: SOLITAIRE HACK"
  );
}

app.post("/api/coupon/pdf", generateCouponPdfHandler);
app.post("/api/pdf/coupon", generateCouponPdfHandler);
app.post("/api/download/coupon", generateCouponPdfHandler);
app.post("/api/coupon/pdf/summary", (req, res) =>
  generateCouponPdfHandler({ ...req, body: { ...(req.body || {}), mode: "summary" } }, res)
);
app.post("/api/coupon/pdf/detailed", (req, res) =>
  generateCouponPdfHandler({ ...req, body: { ...(req.body || {}), mode: "detailed" } }, res)
);
app.post("/api/coupon/pdf/quick", (req, res) =>
  generateCouponPdfHandler({ ...req, body: { ...(req.body || {}), mode: "quick" } }, res)
);
app.post("/api/coupon/image", generateCouponImageHandler);
app.post("/api/coupon/image/svg", (req, res) =>
  generateCouponImageHandler({ ...req, body: { ...(req.body || {}), format: "svg" } }, res)
);
app.post("/api/coupon/image/story", (req, res) =>
  generateCouponImageHandler(
    { ...req, body: { ...(req.body || {}), mode: "story", format: req.body?.format || "jpg" } },
    res
  )
);
app.post("/api/coupon/image/premium", (req, res) =>
  generateCouponImageHandler(
    { ...req, body: { ...(req.body || {}), mode: "premium", format: req.body?.format || "png" } },
    res
  )
);

async function sendTelegramCouponHandler(req, res) {
  try {
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!botToken) {
      return res.status(500).json({
        success: false,
        message: "Configuration Telegram manquante (TELEGRAM_BOT_TOKEN).",
      });
    }

    const coupon = Array.isArray(req.body?.coupon) ? req.body.coupon : [];
    if (coupon.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Coupon vide. Genere d'abord un coupon.",
      });
    }
    const started = getStartedSelections(coupon);
    if (started.length) {
      return res.status(400).json({
        success: false,
        message: "Envoi Telegram bloque: le coupon contient des matchs deja demarres.",
      });
    }

    const text = buildTelegramCouponText(req.body || {});
    let chatId;
    try {
      chatId = await resolveTelegramChatId(botToken);
    } catch (e) {
      return res.status(400).json({ success: false, message: String(e.message || e) });
    }

    const sendImage = Boolean(req.body?.sendImage);
    if (sendImage) {
      const fmt = normalizeImageFormat(req.body?.imageFormat || req.body?.format || "png", "png");
      const svg = buildCouponImageSvg(req.body || {});
      const img = await rasterizeSvg(svg, fmt === "svg" ? "png" : fmt);
      const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
      const ext = fmt === "jpg" ? "jpg" : "png";
      const photoId = await sendTelegramPhoto(
        botToken,
        chatId,
        new Blob([img], { type: mime }),
        `coupon-fc25-${Date.now()}.${ext}`,
        "Coupon image - ONE-DELUX | Signe: SOLITAIRE HACK"
      );
      try {
        await saveGeneratedAsset(
          buildGeneratedAssetRecord(req, {
            kind: "image",
            action: "send_telegram_image",
            label: "Coupon Telegram image",
            fileName: `coupon-fc25-${Date.now()}.${ext}`,
            format: ext,
            mimeType: mime,
            source: "telegram",
            relatedId: chatId,
            asset: req.body || {},
          })
        );
      } catch (_dbError) {}
      try {
        await saveTelegramLog({
          kind: "coupon_image",
          status: "sent",
          message: "Coupon image envoye sur Telegram",
          payload: req.body || {},
          response: { telegramMessageId: photoId, chatId },
        });
      } catch (_dbError) {}
      return res.json({
        success: true,
        message: "Coupon image envoye sur Telegram.",
        telegramMessageId: photoId,
      });
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const telegramData = await telegramRes.json();
    if (!telegramRes.ok || !telegramData?.ok) {
      try {
        await saveTelegramLog({
          kind: "coupon_text",
          status: "error",
          message: "Echec envoi Telegram",
          payload: req.body || {},
          response: telegramData || {},
          error: telegramData?.description || "API Telegram indisponible.",
        });
      } catch (_dbError) {}
      return res.status(502).json({
        success: false,
        message: "Echec envoi Telegram.",
        error: telegramData?.description || "API Telegram indisponible.",
      });
    }

    try {
      await saveTelegramLog({
        kind: "coupon_text",
        status: "sent",
        message: "Coupon texte envoye sur Telegram",
        payload: req.body || {},
        response: { telegramMessageId: telegramData?.result?.message_id || null, chatId },
      });
    } catch (_dbError) {}
    return res.json({
      success: true,
      message: "Coupon envoye sur Telegram.",
      telegramMessageId: telegramData?.result?.message_id || null,
    });
  } catch (error) {
    try {
      await saveTelegramLog({
        kind: "coupon_text",
        status: "error",
        message: "Impossible d'envoyer le coupon sur Telegram",
        payload: req.body || {},
        response: {},
        error: error.message,
      });
    } catch (_dbError) {}
    res.status(500).json({
      success: false,
      message: "Impossible d'envoyer le coupon sur Telegram.",
      error: error.message,
    });
  }
}

async function sendTelegramCouponPackHandler(req, res) {
  try {
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!botToken) {
      return res.status(500).json({
        success: false,
        message: "Configuration Telegram manquante (TELEGRAM_BOT_TOKEN).",
      });
    }

    const coupon = Array.isArray(req.body?.coupon) ? req.body.coupon : [];
    if (coupon.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Coupon vide. Genere d'abord un coupon.",
      });
    }
    const started = getStartedSelections(coupon);
    if (started.length) {
      return res.status(400).json({
        success: false,
        message: "Envoi pack bloque: le coupon contient des matchs deja demarres.",
      });
    }

    let chatId;
    try {
      chatId = await resolveTelegramChatId(botToken);
    } catch (e) {
      return res.status(400).json({ success: false, message: String(e.message || e) });
    }

    const text = buildTelegramCouponText(req.body || {});
    const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const textData = await textRes.json();
    if (!textRes.ok || !textData?.ok) {
      return res.status(502).json({
        success: false,
        message: "Echec envoi texte Telegram.",
        error: textData?.description || "API Telegram indisponible.",
      });
    }

    const imageFormat = normalizeImageFormat(req.body?.imageFormat || "png", "png");
    const svg = buildCouponImageSvg(req.body || {});
    const imageBuffer = await rasterizeSvg(svg, imageFormat === "svg" ? "png" : imageFormat);
    const imageMessageId = await sendTelegramPhoto(
      botToken,
      chatId,
      new Blob([imageBuffer], { type: imageFormat === "jpg" ? "image/jpeg" : "image/png" }),
      `coupon-fc25-${Date.now()}.${imageFormat === "jpg" ? "jpg" : "png"}`,
      "Coupon image - ONE-DELUX | Signe: SOLITAIRE HACK"
    );
    try {
      await saveGeneratedAsset(
        buildGeneratedAssetRecord(req, {
          kind: "image",
          action: "send_telegram_pack_image",
          label: "Pack Telegram image",
          fileName: `coupon-fc25-${Date.now()}.${imageFormat === "jpg" ? "jpg" : "png"}`,
          format: imageFormat === "jpg" ? "jpg" : "png",
          mimeType: imageFormat === "jpg" ? "image/jpeg" : "image/png",
          source: "telegram",
          relatedId: chatId,
          asset: req.body || {},
        })
      );
    } catch (_dbError) {}

    const pdf = buildCouponPdfBuffer(req.body || {}, "quick");
    const pdfMessageId = await sendTelegramDocument(
      botToken,
      chatId,
      new Blob([pdf], { type: "application/pdf" }),
      `coupon-fc25-rapide-${Date.now()}.pdf`,
      "Coupon PDF rapide - ONE-DELUX"
    );
    try {
      await saveGeneratedAsset(
        buildGeneratedAssetRecord(req, {
          kind: "pdf",
          action: "send_telegram_pack_pdf",
          label: "Pack Telegram PDF",
          fileName: `coupon-fc25-rapide-${Date.now()}.pdf`,
          format: "pdf",
          mimeType: "application/pdf",
          source: "telegram",
          relatedId: chatId,
          asset: req.body || {},
        })
      );
    } catch (_dbError) {}

    try {
      await saveTelegramLog({
        kind: "coupon_pack",
        status: "sent",
        message: "Pack Telegram envoye (texte + image + PDF)",
        payload: req.body || {},
        response: {
          chatId,
          textMessageId: textData?.result?.message_id || null,
          imageMessageId,
          pdfMessageId,
        },
      });
    } catch (_dbError) {}
    return res.json({
      success: true,
      message: "Pack Telegram envoye: texte + image + PDF.",
      telegramMessageIds: {
        text: textData?.result?.message_id || null,
        image: imageMessageId,
        pdf: pdfMessageId,
      },
    });
  } catch (error) {
    try {
      await saveTelegramLog({
        kind: "coupon_pack",
        status: "error",
        message: "Impossible d'envoyer le pack Telegram",
        payload: req.body || {},
        response: {},
        error: error.message,
      });
    } catch (_dbError) {}
    return res.status(500).json({
      success: false,
      message: "Impossible d'envoyer le pack Telegram.",
      error: error.message,
    });
  }
}

function buildTelegramLadderText(payload = {}) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const totalStake = Number(payload?.totalStake || 0);
  const lines = [
    "LADDER STRATEGIQUE 60/30/10",
    `Capital total: ${Number.isFinite(totalStake) ? totalStake.toFixed(0) : "0"}`,
    "",
  ];
  items.forEach((it, idx) => {
    const picks = Array.isArray(it?.coupon) ? it.coupon : [];
    const summary = it?.summary || {};
    lines.push(
      `${idx + 1}. ${String(it?.label || it?.profile || "TICKET").toUpperCase()} | Mise ${Number(it?.stake || 0).toFixed(0)} | Cote ${formatOddForTelegram(
        summary?.combinedOdd
      )} | Selections ${Number(summary?.totalSelections || picks.length)}`
    );
    picks.slice(0, 4).forEach((p, i) => {
      lines.push(
        `   ${i + 1}) ${p?.teamHome || "Equipe 1"} vs ${p?.teamAway || "Equipe 2"} | ${p?.pari || "-"} | ${formatOddForTelegram(p?.cote)}`
      );
    });
    lines.push("");
  });
  lines.push("Aucune combinaison n'est garantie gagnante. Gestion de risque obligatoire.");
  lines.push("Lecture premium: 60/30/10 pour garder le contrôle sans surcharger le ticket.");
  lines.push("Signe: SOLITAIRE HACK");
  return lines.join("\n");
}

async function sendTelegramLadderHandler(req, res) {
  try {
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!botToken) {
      return res.status(500).json({
        success: false,
        message: "Configuration Telegram manquante (TELEGRAM_BOT_TOKEN).",
      });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "Ladder vide. Genere d'abord les 3 tickets.",
      });
    }
    const allPicks = items.flatMap((it) => (Array.isArray(it?.coupon) ? it.coupon : []));
    const started = getStartedSelections(allPicks);
    if (started.length) {
      return res.status(400).json({
        success: false,
        message: "Envoi Ladder bloque: un ou plusieurs matchs ont deja demarre.",
      });
    }
    const chatId = await resolveTelegramChatId(botToken);
    const text = buildTelegramLadderText(req.body || {});
    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    const data = await telegramRes.json();
    if (!telegramRes.ok || !data?.ok) {
      try {
        await saveTelegramLog({
          kind: "ladder_text",
          status: "error",
          message: "Echec envoi Ladder Telegram",
          payload: req.body || {},
          response: data || {},
          error: data?.description || "API Telegram indisponible.",
        });
      } catch (_dbError) {}
      return res.status(502).json({
        success: false,
        message: "Echec envoi Ladder Telegram.",
        error: data?.description || "API Telegram indisponible.",
      });
    }
    try {
      await saveTelegramLog({
        kind: "ladder_text",
        status: "sent",
        message: "Ladder envoye sur Telegram",
        payload: req.body || {},
        response: { telegramMessageId: data?.result?.message_id || null, chatId },
      });
    } catch (_dbError) {}
    return res.json({
      success: true,
      message: "Ladder envoye sur Telegram.",
      telegramMessageId: data?.result?.message_id || null,
    });
  } catch (error) {
    try {
      await saveTelegramLog({
        kind: "ladder_text",
        status: "error",
        message: "Impossible d'envoyer le Ladder sur Telegram",
        payload: req.body || {},
        response: {},
        error: error.message,
      });
    } catch (_dbError) {}
    return res.status(500).json({
      success: false,
      message: "Impossible d'envoyer le Ladder sur Telegram.",
      error: error.message,
    });
  }
}

async function executeTelegramSiteAction(action, state = {}) {
  const botToken = String(state.botToken || "").trim();
  const chatId = String(state.chatId || "").trim();
  const session = state.session || null;
  const text = String(state.text || "");
  const name = String(action?.name || action?.action || action?.type || "").trim();
  const payload = action?.payload || {};

  if (!name) return false;

  if (name === "show_menu") {
    if (session) session.lastMode = "help";
    await sendTelegramMessage(botToken, chatId, buildTelegramHelpText(), {
      reply_markup: buildTelegramMenuKeyboard(),
    });
    return true;
  }

  if (name === "show_dashboard") {
    if (session) session.lastMode = "dashboard";
    const [health, dbStatus, live, upcoming, finished, couponStats, couponHistory] = await Promise.all([
      callLocalApi("/api/health").catch(() => ({})),
      callLocalApi("/api/db/status").catch(() => ({})),
      callLocalApi("/api/matches/live").catch(() => ({})),
      callLocalApi("/api/matches/upcoming").catch(() => ({})),
      callLocalApi("/api/matches/finished").catch(() => ({})),
      callLocalApi("/api/coupon/stats").catch(() => ({})),
      callLocalApi("/api/coupon/history?limit=1").catch(() => ({})),
    ]);
    const dashboardText = buildTelegramDashboardText({
      health,
      db: dbStatus?.db || dbStatus?.database || {},
      live,
      upcoming,
      finished,
      couponStats,
      session,
      latestHistoryItem: Array.isArray(couponHistory?.items) ? couponHistory.items[0] : null,
    });
    await sendTelegramMessage(botToken, chatId, dashboardText, { reply_markup: buildTelegramMenuKeyboard() });
    return true;
  }

  if (name === "show_status") {
    if (session) session.lastMode = "status";
    const [health, dbStatus, couponStats] = await Promise.all([
      callLocalApi("/api/health").catch(() => ({})),
      callLocalApi("/api/db/status").catch(() => ({})),
      callLocalApi("/api/coupon/stats").catch(() => ({})),
    ]);
    await sendTelegramMessage(
      botToken,
      chatId,
      buildTelegramStatusText({
        health,
        db: dbStatus?.db || dbStatus?.database || {},
        couponStats,
      }),
      { reply_markup: buildTelegramMenuKeyboard() }
    );
    return true;
  }

  if (name === "show_tracking") {
    if (session) session.lastMode = "tracking";
    const tracking = await callLocalApi("/api/match-tracking/status").catch(() => null);
    const tracker = tracking?.data?.tracker || {};
    const state = tracking?.data?.state || {};
    const runs = Array.isArray(tracking?.data?.runs) ? tracking.data.runs : [];
    const matches = Array.isArray(tracking?.data?.matches) ? tracking.data.matches : [];
    const lines = [
      "SUIVI MATCHS | ONE-DELUX",
      `Actif: ${tracker?.enabled ? "oui" : "non"} | Intervalle: ${tracker?.intervalSeconds || matchTrackingConfig.intervalSeconds}s`,
      `En cours: ${tracker?.running ? "oui" : "non"} | Runs: ${tracker?.lastRunCount ?? state?.totalRuns ?? 0}`,
      `Dernier passage: ${state?.lastCompletedAt || state?.updatedAt || "n/a"}`,
      `Matchs persistés: ${matches.length}`,
    ];
    if (runs.length) {
      const lastRun = runs[0];
      lines.push(`Dernier snapshot: ${lastRun?.createdAt || lastRun?.created_at || "n/a"} | ${lastRun?.status || "ok"}`);
    }
    lines.push("", "Le suivi tourne proprement et reste disponible pour les prochaines vérifications.");
    await sendTelegramMessage(botToken, chatId, lines.join("\n"), {
      reply_markup: buildTelegramMenuKeyboard(),
    });
    return true;
  }

  if (name === "set_coupon_form") {
    if (session) {
      session.preferences = {
        ...(session.preferences || {}),
        size: Number(payload?.size || session.preferences?.size || state.size || 3),
        league: String(payload?.league || session.preferences?.league || state.league || "all"),
        risk: String(payload?.risk || session.preferences?.risk || state.risk || "balanced"),
        stake: Number(payload?.stake || session.preferences?.stake || state.stake || 1000),
      };
    }
    if (botToken && chatId) {
      await sendTelegramMessage(
        botToken,
        chatId,
        `Paramètres Telegram mis à jour: taille ${session?.preferences?.size ?? state.size ?? 3}, ligue ${session?.preferences?.league || state.league || "all"}, risque ${session?.preferences?.risk || state.risk || "balanced"}, mise ${session?.preferences?.stake ?? state.stake ?? 1000}.`
      );
    }
    return true;
  }

  if (["generate_coupon", "download_image", "download_image_premium", "download_story", "download_pdf", "download_pdf_summary", "download_pdf_quick", "download_pdf_detailed", "validate_ticket", "simulate_bankroll", "copy_coupon_text", "build_watchlist", "analyze_journal", "replay_journal"].includes(name)) {
    const couponData = await ensureTelegramCoupon(session, {
      size: state.size,
      league: state.league,
      risk: state.risk,
      stake: state.stake,
    }, name === "generate_coupon");

    if (name === "copy_coupon_text" && couponData?.coupon?.length) {
      await sendTelegramMessage(botToken, chatId, buildTelegramCouponText(couponData));
      return true;
    }

    if (name === "download_image") {
      await sendTelegramCouponMedia(botToken, chatId, couponData, { mode: "default", format: state.format || "png" });
      return true;
    }
    if (name === "download_image_premium") {
      await sendTelegramCouponMedia(botToken, chatId, couponData, { mode: "premium", format: state.format || "png" });
      return true;
    }
    if (name === "download_story") {
      await sendTelegramCouponMedia(botToken, chatId, couponData, { mode: "story", format: state.format || "jpg" });
      return true;
    }
    if (name === "download_pdf" || name === "download_pdf_summary" || name === "download_pdf_quick" || name === "download_pdf_detailed") {
      const pdfMode = name === "download_pdf_detailed" ? "detailed" : name === "download_pdf_quick" ? "quick" : "summary";
      const pdf = buildCouponPdfBuffer(couponData, pdfMode);
      await sendTelegramDocument(
        botToken,
        chatId,
        new Blob([pdf], { type: "application/pdf" }),
        `coupon-fc25-${pdfMode}-${Date.now()}.pdf`,
        `Coupon PDF ${pdfMode} - ONE-DELUX`
      );
      return true;
    }
    if (name === "validate_ticket") {
      const validation = await callLocalApi("/api/coupon/validate", {
        method: "POST",
        body: {
          driftThresholdPercent: 6,
          selections: (couponData?.coupon || []).map((p) => ({ matchId: p.matchId, pari: p.pari, cote: p.cote })),
        },
      });
      const summary = validation?.summary || {};
      const issues = Array.isArray(validation?.issues) ? validation.issues.slice(0, 5) : [];
      const lines = [
        "VALIDATION TICKET | Lecture technique",
        `Statut: ${validation?.status || "N/A"}`,
        `OK: ${summary.ok ?? 0} | A corriger: ${summary.toFix ?? 0} | Total: ${summary.total ?? 0}`,
        "La validation garde un ton simple, clair et exploitable avant publication.",
        ...issues.map((issue, index) => `${index + 1}. ${issue?.message || issue?.code || "Alerte"}`),
      ];
      await sendTelegramMessage(botToken, chatId, lines.join("\n"));
      return true;
    }
    if (name === "simulate_bankroll") {
      const stats = couponData?.summary || {};
      const avg = Number(stats.averageConfidence || 0);
      const lines = [
        "SIMULATION BANKROLL | Lecture prudente",
        `Selections: ${Number(stats.totalSelections || couponData?.coupon?.length || 0)}`,
        `Cote combinee: ${formatOddForTelegram(stats.combinedOdd)}`,
        `Confiance moyenne: ${avg.toFixed(1)}%`,
        "Cette lecture aide à garder une structure propre avant envoi ou publication.",
      ];
      await sendTelegramMessage(botToken, chatId, lines.join("\n"));
      return true;
    }
    if (name === "build_watchlist") {
      const watchlist = await callLocalApi(`/api/watchlist?userId=${encodeURIComponent(chatId)}`);
      const list = Array.isArray(watchlist?.data?.watchlist) ? watchlist.data.watchlist : [];
      const lines = ["WATCHLIST TELEGRAM | Sélection privée", `Total: ${list.length}`];
      list.slice(0, 12).forEach((item, index) => lines.push(`${index + 1}. ${item}`));
      lines.push("", "Ta sélection reste prête pour une relance rapide.");
      await sendTelegramMessage(botToken, chatId, lines.join("\n"));
      return true;
    }
    if (name === "analyze_journal" || name === "replay_journal") {
      const journal = await callLocalApi("/api/coupon/journal");
      const items = Array.isArray(journal?.data?.journal) ? journal.data.journal : [];
      const lines = [name === "analyze_journal" ? "JOURNAL PERFORMANCE | Lecture pro" : "REPLAY JOURNAL | Historique détaillé"];
      items.slice(0, 10).forEach((item, index) => {
        lines.push(`${index + 1}. ${item?.timestamp || "-"} | ${item?.status || "-"} | profit ${Number(item?.profit || 0)}`);
      });
      lines.push("", "Le journal est synthétisé pour une lecture rapide et exploitable.");
      await sendTelegramMessage(botToken, chatId, lines.join("\n"));
      return true;
    }
    if (name === "generate_coupon") {
      await sendTelegramMessage(botToken, chatId, buildTelegramCouponText(couponData));
      return true;
    }
  }

  if (name === "download_image_duo") {
    const couponData = await ensureTelegramCoupon(session, {
      size: state.size,
      league: state.league,
      risk: state.risk,
      stake: state.stake,
    });
    await sendTelegramCouponMedia(botToken, chatId, couponData, { mode: "default", format: "png" });
    await sendTelegramCouponMedia(botToken, chatId, couponData, { mode: "default", format: "jpg" });
    return true;
  }

  if (name === "refresh_matches" || name === "set_mode_live" || name === "set_mode_upcoming" || name === "set_mode_finished" || name === "set_mode_turbo") {
    const route =
      name === "set_mode_live"
        ? "/api/matches/live"
        : name === "set_mode_finished"
          ? "/api/matches/finished"
          : "/api/matches/upcoming";
    const data = await callLocalApi(route);
    const list = Array.isArray(data?.matches) ? data.matches : [];
    const title =
      name === "set_mode_live" ? "MATCHS LIVE" : name === "set_mode_finished" ? "MATCHS TERMINES" : "MATCHS A VENIR";
    await sendTelegramMessage(botToken, chatId, buildTelegramMatchListText(title, list, 8));
    return true;
  }

  if (name === "refresh_match_data" || name === "export_match_all" || name === "send_match_telegram_text") {
    const targetMatchId = String(state.matchId || session?.lastMatchId || "").trim();
    if (!targetMatchId) return false;
    const details = await callLocalApi(`/api/matches/${encodeURIComponent(targetMatchId)}/details`);
    await sendTelegramMessage(botToken, chatId, buildTelegramMatchDetailsText(details));
    return true;
  }

  if (name === "send_match_telegram_image") {
    const targetMatchId = String(state.matchId || session?.lastMatchId || "").trim();
    if (!targetMatchId) return false;
    const details = await callLocalApi(`/api/matches/${encodeURIComponent(targetMatchId)}/details`);
    const selection = couponPayloadFromSelection({
      matchId: targetMatchId,
      homeTeam: details?.match?.teamHome,
      awayTeam: details?.match?.teamAway,
      league: details?.match?.league,
      pari: details?.prediction?.maitre?.decision_finale?.pari_choisi || "1",
      cote: details?.match?.odds || 1.5,
      confiance: details?.prediction?.maitre?.decision_finale?.confiance_numerique || 75,
      exactScore: details?.exactScore || null,
      startTime: details?.match?.startTimeUnix,
    });
    const svg = buildCouponImageSvg(selection);
    const buffer = await rasterizeSvg(svg, "png");
    await sendTelegramPhoto(
      botToken,
      chatId,
      new Blob([buffer], { type: "image/png" }),
      `match-fc25-${Date.now()}.png`,
      "Match details - ONE-DELUX"
    );
    return true;
  }

  return false;
}

async function handleTelegramWebhookUpdate(req, res) {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) {
    return res.status(500).json({
      success: false,
      message: "Configuration Telegram manquante (TELEGRAM_BOT_TOKEN).",
    });
  }

  const secretToken = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (secretToken) {
    const incomingSecret = String(req.get("x-telegram-bot-api-secret-token") || "").trim();
    if (incomingSecret !== secretToken) {
      return res.status(403).json({
        success: false,
        message: "Webhook Telegram refuse.",
      });
    }
  }

  const update = req.body || {};
  const message = update.message || update.edited_message || update.channel_post || update.callback_query?.message || null;
  const chat = message?.chat || update.callback_query?.message?.chat || null;
  const chatId = String(chat?.id || "").trim();
  const rawText = String(message?.text || message?.caption || update.callback_query?.data || "").trim();
  const callbackData = String(update.callback_query?.data || "").trim();

  if (!chatId || (!rawText && !callbackData)) {
    return res.json({ success: true, ignored: true });
  }

  const session = await loadTelegramSession(chatId, { username: chat?.username || null });
  const text = resolveTelegramCallbackCommand(callbackData, session) || rawText;
  const chatMeta = { chatId, username: chat?.username || null };

  try {
    await saveTelegramLog({
      kind: "telegram_inbound",
      status: "received",
      message: text,
      payload: {
        chatId,
        username: chat?.username || null,
        updateType: update?.callback_query ? "callback_query" : "message",
      },
      response: {},
    });
  } catch (_dbError) {}

  const normalized = normalizeTelegramFilter(text);
  const isCommand = normalized.startsWith("/");
  const mode = extractTelegramMode(text);
  const size = extractTelegramSize(text, session?.preferences?.size || 3);
  const risk = extractTelegramRisk(text, session?.preferences?.risk || "balanced");
  const league = extractTelegramLeague(text) || session?.preferences?.league || "all";
  const stake = extractTelegramStake(text, session?.preferences?.stake || 1000);
  const matchId = extractTelegramMatchId(text) || session?.lastMatchId || "";
  const wantsImage = normalized.includes("image") || mode === "image" || mode === "pack" || mode === "premium" || mode === "story";
  const wantsPdf = normalized.includes("pdf") || mode === "pdf" || mode === "pack";
  const wantsPack = mode === "pack" || normalized.includes("pack");
  const wantsValidate = mode === "validate" || normalized.includes("valide") || normalized.includes("validate");
  const wantsLadder = mode === "ladder";
  const wantsMulti = mode === "multi";
  const wantsHistory = mode === "history";
  const wantsWatchlist = mode === "watchlist";
  const wantsJournal = mode === "journal";
  const wantsTracking = mode === "tracking";
  const wantsStatus = mode === "status";
  const wantsDashboard = mode === "dashboard" || telegramTextMatches(normalized, ["dashboard", "tableau de bord", "resume", "accueil"]);
  const wantsHelp = mode === "help" || telegramTextMatches(normalized, ["start", "help", "menu", "aide", "commandes"]);

  const respond = async (messageText, extra = {}) => {
    await persistTelegramSession(session, chatMeta);
    if (update.callback_query?.id) {
      await answerTelegramCallback(botToken, update.callback_query.id, "Recu").catch(() => {});
    }
    const options = { ...extra };
    if (!options.reply_markup) {
      options.reply_markup = buildTelegramMenuKeyboard();
    }
    await sendTelegramMessage(botToken, chatId, messageText, options);
    return res.json({ success: true });
  };

  try {
    if (wantsHelp) {
      if (session) session.lastMode = "help";
      return respond(buildTelegramHelpText(), { reply_markup: buildTelegramMenuKeyboard() });
    }

    if (wantsDashboard) {
      const [health, dbStatus, live, upcoming, finished, couponStats, couponHistory, watchlistData, journalData] = await Promise.all([
        callLocalApi("/api/health").catch(() => ({})),
        callLocalApi("/api/db/status").catch(() => ({})),
        callLocalApi("/api/matches/live").catch(() => ({})),
        callLocalApi("/api/matches/upcoming").catch(() => ({})),
        callLocalApi("/api/matches/finished").catch(() => ({})),
        callLocalApi("/api/coupon/stats").catch(() => ({})),
        callLocalApi("/api/coupon/history?limit=1").catch(() => ({})),
        callLocalApi(`/api/watchlist?userId=${encodeURIComponent(chatId)}`).catch(() => ({})),
        callLocalApi("/api/coupon/journal").catch(() => ({})),
      ]);
      const latestHistoryItem = Array.isArray(couponHistory?.items) ? couponHistory.items[0] : null;
      const dashboardText = buildTelegramDashboardText({
        health,
        db: dbStatus?.db || dbStatus?.database || {},
        live,
        upcoming,
        finished,
        couponStats,
        session,
        latestHistoryItem,
        watchlist: watchlistData?.data?.watchlist || [],
        journal: journalData?.data?.journal || [],
      });
      if (session) session.lastMode = "dashboard";
      return respond(dashboardText, { reply_markup: buildTelegramMenuKeyboard() });
    }

    if (wantsStatus) {
      const [health, dbStatus, couponStats] = await Promise.all([
        callLocalApi("/api/health"),
        callLocalApi("/api/db/status"),
        callLocalApi("/api/coupon/stats").catch(() => ({ success: false })),
      ]);
      const combined = buildTelegramStatusText({
        health: health?.database ? health : { ok: true, ...health },
        db: dbStatus?.db || dbStatus?.database || {},
        couponStats,
      });
      if (session) session.lastMode = "status";
      return respond(combined);
    }

    if (normalized.includes("live") || normalized.includes("match live")) {
      const data = await callLocalApi("/api/matches/live");
      const list = Array.isArray(data?.matches) ? data.matches : [];
      const textOut = buildTelegramMatchListText("MATCHS LIVE", list, 8);
      if (session) session.lastMode = "live";
      return respond(textOut);
    }

    if (normalized.includes("upcoming") || normalized.includes("match a venir") || normalized.includes("matchs a venir")) {
      const data = await callLocalApi("/api/matches/upcoming");
      const list = Array.isArray(data?.matches) ? data.matches : [];
      const textOut = buildTelegramMatchListText("MATCHS A VENIR", list, 8);
      if (session) session.lastMode = "upcoming";
      return respond(textOut);
    }

    if (normalized.includes("finished") || normalized.includes("match termine") || normalized.includes("matchs termines")) {
      const data = await callLocalApi("/api/matches/finished");
      const list = Array.isArray(data?.matches) ? data.matches : [];
      const textOut = buildTelegramMatchListText("MATCHS TERMINES", list, 8);
      if (session) session.lastMode = "finished";
      return respond(textOut);
    }

    if (normalized.includes("match") || normalized.includes("details") || normalized.includes("detail match")) {
      if (!matchId) {
        return respond("Donne-moi un identifiant de match, par exemple: /match 12345");
      }
      const details = await callLocalApi(`/api/matches/${encodeURIComponent(matchId)}/details`);
      if (session) session.lastMatchId = matchId;
      if (session) session.lastMode = "match";
      const lines = buildTelegramMatchDetailsText(details);
      return respond(lines);
    }

    if (normalized.includes("coupon") || normalized.includes("ladder") || normalized.includes("multi")) {
      const couponReq = {
        size,
        league,
        risk,
        stake,
      };
      if (session) {
        session.preferences = { ...session.preferences, size, league, risk, stake };
      }

      if (wantsLadder) {
        if (session) session.lastMode = "ladder";
        const ladderRes = await callLocalApi("/api/coupon/ladder", { method: "POST", body: couponReq });
        const ladder = ladderRes?.ladder || ladderRes?.data?.ladder || ladderRes?.data || {};
        if (session) session.lastLadder = ladder;
        const ladderText = buildTelegramLadderText({
          items: (Array.isArray(ladder?.coupons) ? ladder.coupons : []).map((item) => ({
            label: item?.name || "TICKET",
            profile: item?.name || "TICKET",
            stake: item?.stake || 0,
            coupon: Array.isArray(item?.matches)
              ? item.matches.map((m) => ({
                  teamHome: m?.homeTeam || m?.teamHome || "Equipe 1",
                  teamAway: m?.awayTeam || m?.teamAway || "Equipe 2",
                  pari: m?.prediction?.recommendation || "1",
                  cote: Number(m?.odds || m?.odd || 1.5) || 1.5,
                }))
              : [],
            summary: {
              combinedOdd: Array.isArray(item?.matches) && item.matches.length
                ? Number(item.matches.reduce((acc, m) => acc * (Number(m?.odds || m?.odd || 1.5) || 1.5), 1).toFixed(3))
                : null,
              totalSelections: Array.isArray(item?.matches) ? item.matches.length : 0,
            },
          })),
          totalStake: stake,
        });
        return respond(ladderText);
      }

      if (wantsMulti) {
        if (session) session.lastMode = "multi";
        const multiRes = await callLocalApi("/api/coupon/multi", { method: "POST", body: couponReq });
        const strategies = Array.isArray(multiRes?.strategies || multiRes?.data?.strategies) ? multiRes.strategies || multiRes.data?.strategies : [];
        const lines = ["COUPON MULTI", `Taille: ${size} | Ligue: ${league} | Risque: ${risk}`];
        strategies.slice(0, 4).forEach((strategy, index) => {
          const matches = Array.isArray(strategy?.matches) ? strategy.matches : [];
          lines.push(`${index + 1}. ${strategy?.name || strategy?.risk || "Strategie"} | ${matches.length} match(s)`);
          matches.slice(0, 4).forEach((m, i) => {
            lines.push(`   ${i + 1}) ${m?.homeTeam || "Equipe 1"} vs ${m?.awayTeam || "Equipe 2"} | ${m?.prediction?.recommendation || "1"} | ${Number(m?.prediction?.confidence || 0).toFixed(1)}%`);
          });
        });
        return respond(lines.join("\n"));
      }

      if (
        !session?.lastCoupon ||
        normalized === "coupon" ||
        normalized === "/coupon" ||
        normalized.includes("genere") ||
        normalized.includes("cree") ||
        normalized.includes("nouveau")
      ) {
        if (session) session.lastMode = "coupon";
        const couponRes = await callLocalApi(`/api/coupon?size=${encodeURIComponent(size)}&league=${encodeURIComponent(league)}&risk=${encodeURIComponent(risk)}`);
        const couponData = couponRes?.coupon ? couponRes : couponRes?.data?.coupon ? couponRes.data : couponRes;
        if (session) session.lastCoupon = couponData;
      }

      const currentCoupon = session?.lastCoupon || null;
      if (!currentCoupon?.coupon?.length) {
        return respond("Je n'ai pas encore de coupon en mémoire. Demande-moi: /coupon size=3 risk=balanced league=all");
      }

      const textOut = buildTelegramCouponText(currentCoupon);
      const couponForMedia = currentCoupon;

      if (wantsValidate) {
        if (session) session.lastMode = "validate";
        const payload = {
          driftThresholdPercent: 6,
          selections: couponForMedia.coupon.map((p) => ({
            matchId: p.matchId,
            pari: p.pari,
            cote: p.cote,
          })),
        };
      const validation = await callLocalApi("/api/coupon/validate", { method: "POST", body: payload });
      const summary = validation?.summary || {};
      const issues = Array.isArray(validation?.issues) ? validation.issues : [];
      const lines = [
          "VALIDATION TICKET | Lecture technique",
          `Statut: ${validation?.status || "N/A"}`,
          `OK: ${summary.ok ?? 0} | A corriger: ${summary.toFix ?? 0} | Total: ${summary.total ?? 0}`,
          "La validation garde un ton simple, clair et exploitable avant publication.",
        ];
        issues.slice(0, 5).forEach((issue, index) => {
          lines.push(`${index + 1}. ${issue?.message || issue?.code || "Alerte"}`);
        });
        return respond(lines.join("\n"));
      }

      if (wantsPack) {
        if (session) session.lastMode = "pack";
        if (update.callback_query?.id) {
          await answerTelegramCallback(botToken, update.callback_query.id, "Pack en cours").catch(() => {});
        }
        await sendTelegramMessage(botToken, chatId, textOut);
        const imageSvg = buildCouponImageSvg(couponForMedia);
        const imageBuffer = await rasterizeSvg(imageSvg, "png");
        await sendTelegramPhoto(
          botToken,
          chatId,
          new Blob([imageBuffer], { type: "image/png" }),
          `coupon-fc25-${Date.now()}.png`,
          "Coupon image - ONE-DELUX | Signe: SOLITAIRE HACK"
        );
        const pdfBuffer = buildCouponPdfBuffer(couponForMedia, "quick");
        await sendTelegramDocument(
          botToken,
          chatId,
          new Blob([pdfBuffer], { type: "application/pdf" }),
          `coupon-fc25-rapide-${Date.now()}.pdf`,
          "Coupon PDF rapide - ONE-DELUX"
        );
        await persistTelegramSession(session, chatMeta);
        return res.json({ success: true });
      }

      if (wantsImage) {
        if (session) session.lastMode = "image";
        const imageFormat = normalized.includes("jpg") ? "jpg" : "png";
        const svg = buildCouponImageSvg(couponForMedia);
        const buffer = await rasterizeSvg(svg, imageFormat);
        await sendTelegramPhoto(
          botToken,
          chatId,
          new Blob([buffer], { type: imageFormat === "jpg" ? "image/jpeg" : "image/png" }),
          `one-delux-${Date.now()}.${imageFormat === "jpg" ? "jpg" : "png"}`,
          "Coupon image - ONE-DELUX | Signe: SOLITAIRE HACK"
        );
        return respond(textOut);
      }

      if (wantsPdf) {
        if (session) session.lastMode = "pdf";
        const pdfMode = normalized.includes("detail") || normalized.includes("detailed") ? "detailed" : normalized.includes("quick") ? "quick" : "summary";
        const pdfBuffer = buildCouponPdfBuffer(couponForMedia, pdfMode);
        await sendTelegramDocument(
          botToken,
          chatId,
          new Blob([pdfBuffer], { type: "application/pdf" }),
          `coupon-fc25-${pdfMode}-${Date.now()}.pdf`,
          `Coupon PDF ${pdfMode} - ONE-DELUX`
        );
        return respond(textOut);
      }

      return respond(textOut);
    }

    if (wantsHistory) {
      const history = await callLocalApi("/api/coupon/history?limit=8");
      const items = Array.isArray(history?.items) ? history.items : [];
      const lines = ["HISTORIQUE TICKETS | Archive propre"];
      items.slice(0, 8).forEach((item, index) => {
        lines.push(`${index + 1}. ${item?.timestamp || "-"} | ${item?.status || "-"} | ${Number(item?.summary?.matchesCount || item?.matches?.length || 0)} match(s)`);
      });
      lines.push("", "Tu peux repartir de cet historique pour structurer la prochaine sélection.");
      if (session) session.lastMode = "history";
      return respond(lines.join("\n"));
    }

    if (wantsWatchlist) {
      const data = await callLocalApi(`/api/watchlist?userId=${encodeURIComponent(chatId)}`);
      const watchlist = data?.data?.watchlist || [];
      const lines = ["WATCHLIST TELEGRAM | Sélection privée", `Total: ${watchlist.length}`];
      watchlist.slice(0, 12).forEach((item, index) => {
        lines.push(`${index + 1}. ${item}`);
      });
      lines.push("", "Ta watchlist reste prête pour une reprise rapide.");
      if (session) session.lastMode = "watchlist";
      return respond(lines.join("\n"));
    }

    if (wantsJournal) {
      const journal = await callLocalApi("/api/coupon/journal");
      const items = Array.isArray(journal?.data?.journal) ? journal.data.journal : [];
      const lines = ["JOURNAL PERFORMANCE | Lecture pro"];
      items.slice(0, 10).forEach((item, index) => {
        lines.push(`${index + 1}. ${item?.timestamp || "-"} | ${item?.status || "-"} | gain/profit ${Number(item?.profit || 0)}`);
      });
      lines.push("", "Le journal est synthétisé pour une lecture rapide et exploitable.");
      if (session) session.lastMode = "journal";
      return respond(lines.join("\n"));
    }

    if (wantsTracking) {
      const tracking = await callLocalApi("/api/match-tracking/status").catch(() => null);
      const tracker = tracking?.data?.tracker || {};
      const state = tracking?.data?.state || {};
      const runs = Array.isArray(tracking?.data?.runs) ? tracking.data.runs : [];
      const matches = Array.isArray(tracking?.data?.matches) ? tracking.data.matches : [];
      const lines = [
        "SUIVI MATCHS | ONE-DELUX",
        `Actif: ${tracker?.enabled ? "oui" : "non"} | Intervalle: ${tracker?.intervalSeconds || matchTrackingConfig.intervalSeconds}s`,
        `En cours: ${tracker?.running ? "oui" : "non"} | Runs: ${tracker?.lastRunCount ?? state?.totalRuns ?? 0}`,
        `Dernier passage: ${state?.lastCompletedAt || state?.updatedAt || "n/a"}`,
        `Matchs persistés: ${matches.length}`,
      ];
      if (runs.length) {
        const lastRun = runs[0];
        lines.push(`Dernier snapshot: ${lastRun?.createdAt || lastRun?.created_at || "n/a"} | ${lastRun?.status || "ok"}`);
      }
      lines.push("", "Le suivi reste disponible pour les prochains contrôles.");
      if (session) session.lastMode = "tracking";
      return respond(lines.join("\n"));
    }

    const telegramContext = {
      page: "/telegram",
      matchId,
      league,
      pageSnapshot: {
        pageType: "telegram",
        title: "Telegram Control Hub",
        enabledButtons: [
          "dashboard",
          "status",
          "coupon",
          "image",
          "pdf",
          "pack",
          "live",
          "upcoming",
          "finished",
          "match",
          "history",
          "watchlist",
          "journal",
          "tracking",
        ],
      },
      capabilities: {
        actions: [
          "show_dashboard",
          "show_status",
          "show_tracking",
          "show_menu",
          "generate_coupon",
          "validate_ticket",
          "simulate_bankroll",
          "download_image",
          "download_image_premium",
          "download_story",
          "download_image_duo",
          "download_pdf",
          "download_pdf_summary",
          "download_pdf_quick",
          "download_pdf_detailed",
          "build_watchlist",
          "analyze_journal",
          "replay_journal",
          "refresh_matches",
          "refresh_match_data",
          "set_mode_live",
          "set_mode_upcoming",
          "set_mode_finished",
          "set_mode_turbo",
          "export_match_all",
        ],
      },
    };
    const chatResult = await callLocalApi("/api/chat", {
      method: "POST",
      body: {
        message: text,
        history: [],
        context: telegramContext,
      },
    });
    const answer = String(chatResult?.answer || "").trim() || "Aucune reponse.";
    const derivedActions = Array.isArray(chatResult?.actions) ? chatResult.actions : [];
    let handledByActions = false;
    for (const action of derivedActions) {
      // Le bot Telegram execute localement ce que le site ferait via l'interface.
      handledByActions = (await executeTelegramSiteAction(action, {
        botToken,
        chatId,
        session,
        text,
        size,
        risk,
        league,
        stake,
        matchId,
        format: normalized.includes("jpg") ? "jpg" : normalized.includes("png") ? "png" : "png",
      })) || handledByActions;
    }
    if (session && derivedActions.length) {
      session.pendingActions = derivedActions;
    }
    if (handledByActions) {
      if (update.callback_query?.id) {
        await answerTelegramCallback(botToken, update.callback_query.id, "Action terminee").catch(() => {});
      }
      await persistTelegramSession(session, chatMeta);
      return res.json({ success: true, handled: true });
    }
    return respond(answer);
  } catch (error) {
    try {
      await sendTelegramMessage(botToken, chatId, `Erreur Telegram: ${error.message}`);
    } catch (_sendError) {}
    try {
      await saveTelegramLog({
        kind: "telegram_inbound",
        status: "error",
        message: text,
        payload: { chatId },
        response: {},
        error: error.message,
      });
    } catch (_dbError) {}
    return res.json({
      success: false,
      error: error.message,
    });
  }
}

app.post("/api/coupon/send-telegram", sendTelegramCouponHandler);
app.post("/api/telegram/send-coupon", sendTelegramCouponHandler);
app.post("/api/send-telegram", sendTelegramCouponHandler);
app.post("/api/coupon/send-telegram-pack", sendTelegramCouponPackHandler);
app.post("/api/coupon/ladder/send-telegram", sendTelegramLadderHandler);
app.post("/api/telegram/webhook", handleTelegramWebhookUpdate);
app.post("/api/telegram/update", handleTelegramWebhookUpdate);

function trimTrailingSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

function extractAnthropicText(raw) {
  if (!Array.isArray(raw?.content)) return "";
  return raw.content
    .map((c) => (c?.type === "text" ? c.text || "" : ""))
    .join("\n")
    .trim();
}

function extractSlokText(raw) {
  if (!raw || typeof raw !== "object") return "";
  return (
    raw?.response?.text ||
    raw?.response?.message ||
    raw?.text ||
    raw?.message ||
    ""
  )
    .toString()
    .trim();
}

function buildAnthropicEndpointCandidates(baseUrl) {
  const base = trimTrailingSlash(baseUrl);
  if (!base) return [];
  const list = [];
  const push = (u) => {
    if (u && !list.includes(u)) list.push(u);
  };

  if (base.endsWith("/messages")) {
    push(base);
    return list;
  }

  push(`${base}/v1/messages`);
  push(`${base}/messages`);

  if (base.includes("/cliproxy-api/api/provider/")) {
    push(base);
    push(`${base}/messages`);
    push(`${base}/v1/messages`);
  } else {
    push(`${base}/cliproxy-api/api/provider/agy`);
    push(`${base}/cliproxy-api/api/provider/agy/messages`);
    push(`${base}/cliproxy-api/api/provider/agy/v1/messages`);
  }

  return list;
}

async function parseResponseSafe(response) {
  const rawText = await response.text();
  let json = null;
  if (rawText && rawText.trim()) {
    try {
      json = JSON.parse(rawText);
    } catch (_e) {
      json = null;
    }
  }
  return { text: rawText || "", json };
}

async function requestAnthropicChat({ baseUrl, apiKey, model, systemPrompt, userPrompt }) {
  const endpointCandidates = buildAnthropicEndpointCandidates(baseUrl);
  const errors = [];

  for (const endpoint of endpointCandidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "x-auth-token": apiKey,
          "anthropic-api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.5,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const parsed = await parseResponseSafe(response);
      const raw = parsed.json;
      if (!response.ok) {
        const msg =
          raw?.error?.message ||
          raw?.message ||
          (parsed.text.startsWith("<!DOCTYPE") || parsed.text.startsWith("<html")
            ? "Reponse HTML recue (endpoint non API). Use /v1/ or /cliproxy-api/ endpoints"
            : parsed.text.slice(0, 180)) ||
          `HTTP ${response.status}`;
        errors.push(`${endpoint} -> ${msg}`);
        continue;
      }

      if (!raw) {
        errors.push(`${endpoint} -> reponse non-JSON recue.`);
        continue;
      }

      const answer = extractAnthropicText(raw);
      if (!answer) {
        errors.push(`${endpoint} -> reponse Anthropic vide.`);
        continue;
      }
      return { answer, model };
    } catch (error) {
      errors.push(`${endpoint} -> ${error.message}`);
    }
  }

  throw new Error(errors.filter(Boolean).join(" | ") || "Erreur Anthropic");
}

async function requestOpenAICompatChat({ baseUrl, apiKey, model, systemPrompt, userPrompt }) {
  const root = trimTrailingSlash(trimText(baseUrl || "", 500));
  if (!root) throw new Error("base URL vide");
  const url = `${root}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const parsed = await parseResponseSafe(response);
  const raw = parsed.json;
  if (!response.ok) {
    const msg =
      raw?.error?.message ||
      (typeof raw?.error === "string" ? raw.error : null) ||
      parsed.text.slice(0, 180) ||
      `HTTP ${response.status}`;
    throw new Error(msg);
  }
  if (!raw) throw new Error("reponse non-JSON");
  const content = raw?.choices?.[0]?.message?.content;
  if (content == null || String(content).trim() === "") {
    throw new Error("reponse chat vide");
  }
  return { answer: String(content).trim(), model: raw?.model || model };
}

function buildSlokEndpointCandidates(baseUrl) {
  const base = trimTrailingSlash(baseUrl);
  const out = [];
  const push = (u) => {
    if (u && !out.includes(u)) out.push(u);
  };
  if (!base) return out;
  if (base.endsWith("/api/v2/chatgpt")) push(base);
  push(`${base}/api/v2/chatgpt`);
  if (base.includes("orbit-provider.com")) push("https://yellowfire.ru/api/v2/chatgpt");
  return out;
}

function slokRootFromChatEndpoint(endpoint) {
  const e = trimTrailingSlash(endpoint);
  if (e.endsWith("/api/v2/chatgpt")) return e.slice(0, -"/api/v2/chatgpt".length);
  return e;
}

async function requestSlokChat({ baseUrl, apiKey, model, systemPrompt, userPrompt }) {
  const endpointCandidates = buildSlokEndpointCandidates(baseUrl);
  const errors = [];
  for (const endpoint of endpointCandidates) {
    try {
      const mergedPrompt = [systemPrompt, userPrompt].filter(Boolean).join("\n\n");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: mergedPrompt,
          chat_history: [],
          file_base64: "",
          internet_access: false,
          mime_type: "",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const parsed = await parseResponseSafe(response);
      if (!response.ok) {
        const msg =
          parsed.json?.error?.message ||
          parsed.json?.message ||
          parsed.text.slice(0, 180) ||
          `HTTP ${response.status}`;
        errors.push(`${endpoint} -> ${msg}`);
        continue;
      }
      const start = parsed.json;
      if (!start) {
        errors.push(`${endpoint} -> reponse non-JSON recue.`);
        continue;
      }
      if (start?.error) {
        errors.push(`${endpoint} -> ${start.error}`);
        continue;
      }
      const requestId = start?.request_id;
      if (!requestId) {
        const directAnswer = extractSlokText(start);
        if (directAnswer) return { answer: directAnswer, model };
        errors.push(`${endpoint} -> request_id absent.`);
        continue;
      }

      const waitSec = Math.max(0.1, Number(start?.wait || 1));
      await new Promise((r) => setTimeout(r, Math.round(waitSec * 1000)));
      const statusEndpoint = `${slokRootFromChatEndpoint(endpoint)}/api/v2/status/${encodeURIComponent(requestId)}`;

      let answer = "";
      let statusErr = "";
      for (let i = 0; i < 80; i += 1) {
        const statusCtl = new AbortController();
        const statusTimer = setTimeout(() => statusCtl.abort(), 5000);
        const statusRes = await fetch(statusEndpoint, {
          method: "GET",
          headers: {
            "api-key": apiKey,
            Authorization: `Bearer ${apiKey}`,
          },
          signal: statusCtl.signal,
        });
        clearTimeout(statusTimer);
        const statusParsed = await parseResponseSafe(statusRes);
        const statusJson = statusParsed.json;
        if (!statusRes.ok) {
          statusErr = statusParsed.text.slice(0, 160) || `HTTP ${statusRes.status}`;
          break;
        }
        if (!statusJson) {
          statusErr = "status non-JSON";
          break;
        }
        if (statusJson?.error) {
          statusErr = String(statusJson.error);
          break;
        }
        answer = extractSlokText(statusJson);
        if (statusJson?.status === "success" && answer) {
          return { answer, model };
        }
        if (statusJson?.status === "failed") {
          statusErr = "status failed";
          break;
        }
        await new Promise((r) => setTimeout(r, 350));
      }
      if (answer) return { answer, model };
      errors.push(`${statusEndpoint} -> ${statusErr || "timeout sans reponse"}`);
    } catch (error) {
      errors.push(`${endpoint} -> ${error.message}`);
    }
  }
  throw new Error(errors.filter(Boolean).join(" | ") || "Erreur Slok API");
}

app.post("/api/chat", validateBody(chatSchema), async (req, res) => {
  try {
    if (!canUseChat(req)) {
      return res.status(429).json({
        success: false,
        message: "Trop de requetes chat. Reessaie dans 1 minute.",
      });
    }
    const message = trimText(req.body?.message, 2000);
    const historyInput = Array.isArray(req.body?.history) ? req.body.history : [];
    const chatHistory = historyInput
      .slice(-12)
      .map((m) => ({
        role: String(m?.role || "").toLowerCase() === "user" ? "user" : "assistant",
        text: trimText(m?.text || "", 600),
      }))
      .filter((m) => m.text);
    const page = trimText(req.body?.context?.page || "site", 80);
    const matchId = trimText(req.body?.context?.matchId || "", 60);
    const league = trimText(req.body?.context?.league || "", 120);
    const pageSnapshot = req.body?.context?.pageSnapshot || null;
    const pageActions = Array.isArray(req.body?.context?.capabilities?.actions)
      ? req.body.context.capabilities.actions.slice(0, 40).map((x) => trimText(x, 80))
      : [];

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message vide.",
      });
    }

    const siteKnowledge = buildSiteKnowledgeBlock();
    const webResearchContext = await buildWebResearchContext(message);

    const systemPrompt =
      "Tu es SOLITAIRE AI, bras operationnel du site ONE-DELUX (signe SOLITAIRE HACK). " +
      "Tu as acces au snapshot de page, au contexte runtime, a l'historique conversationnel, aux actions securisees exposees par le serveur et aux connaissances du site. " +
      "Tu dois t'appuyer d'abord sur ces donnees, puis sur la recherche web contextuelle si elle est fournie. " +
      "Reponds en francais, dans un ton fluide, amical, professionnel et precis, en 1 a 5 phrases. " +
      "Priorite absolue: quand une action du site existe, parle comme un pilote qui agit deja ou va agir immediatement. Ne demande pas de cliquer sur un bouton si une action exposee permet de le faire. " +
      "Tu n'es pas un tutoriel d'interface. Tu es le controle operationnel du site. Tu peux decrire ce que tu vois en temps reel, ce que tu vas executer, puis ce qui manque eventuellement. " +
      "Si l'information existe dans le site ou dans le contexte fourni, exploite-la sans hesitation. Si elle manque, dis-le clairement et propose la meilleure alternative. " +
      "Tu peux repondre aussi aux questions generales hors site, sans recadrer de force. " +
      "Quand on te demande si tu vois la page, reponds OUI et cite le snapshot (titres, selections, boutons). " +
      "Evite les phrases comme 'clique sur', 'utilise la fonction', 'souhaites-tu lancer' quand des actions serveur/client sont disponibles. Prefere 'je lance', 'je regle', 'je prends la main', 'je peux executer'. " +
      "Tu ne promets jamais un gain garanti.\n\n" +
      siteKnowledge;

    const runtimeContext = await buildDynamicRuntimeContext({ page, league, matchId });

    const userPrompt = [
      "Mode: assistant operationnel site uniquement. Priorite execution, reponse precise, ton fluide et professionnel.",
      chatHistory.length
        ? `Historique conversation recente:\n${chatHistory
            .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.text}`)
            .join("\n")}`
        : "",
      `Contexte runtime:\n${runtimeContext}`,
      webResearchContext ? `${webResearchContext}` : "",
      `Contexte page: ${page}`,
      matchId ? `Match ID: ${matchId}` : "",
      league ? `Ligue: ${league}` : "",
      pageSnapshot ? `Snapshot page: ${JSON.stringify(pageSnapshot).slice(0, 2500)}` : "",
      pageActions.length ? `Actions page disponibles: ${pageActions.join(", ")}` : "",
      `Question utilisateur: ${message}`,
    ]
      .filter(Boolean)
      .join("\n");

    const anthropicBaseUrl = trimText(process.env.ANTHROPIC_BASE_URL || "", 500);
    const anthropicKey = trimText(
      process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || "",
      500
    );
    const anthropicModel =
      trimText(process.env.ANTHROPIC_MODEL || "", 120) ||
      trimText(process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || "", 120) ||
      trimText(process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || "", 120) ||
      "claude-opus-4-6";
    const openaiCompatBaseUrl = trimText(
      process.env.OPENAI_COMPAT_BASE_URL || process.env.THE_OLD_API_BASE_URL || "",
      500
    );
    const openaiCompatKey = trimText(
      process.env.OPENAI_COMPAT_API_KEY || process.env.THE_OLD_API_KEY || "",
      500
    );
    const openaiCompatModel = trimText(
      process.env.OPENAI_COMPAT_MODEL || process.env.THE_OLD_MODEL || "gpt-4o",
      120
    );
    const openaiCompatFirst =
      String(process.env.OPENAI_COMPAT_FIRST || process.env.THE_OLD_FIRST || "0").trim() === "1";
    const errors = [];
    const attempted = [];
    const actions = deriveControlActions(message, {
      page,
      league,
      matchId,
      capabilities: { actions: pageActions },
      pageSnapshot,
    });

    const finishRemote = (provider, result) => {
      let answer = result.answer;
      if (isRefusalAnswer(answer) && !isSiteQuestion(message)) {
        answer = localGeneralAnswer(message);
      }
      if (actions.length) {
        answer = String(answer || "")
          .replace(/souhaites-tu lancer cette action maintenant\s*\?/gi, "")
          .replace(/si oui,\s*clique sur\s*\"?quick generate\"?\.?/gi, "")
          .replace(/clique sur\s*\"?quick generate\"?\.?/gi, "je peux le lancer directement.")
          .replace(/je te propose d'utiliser la fonction\s*\"?quick generate\"?\.?/gi, "je peux lancer la generation directement.")
          .replace(/utiliser la fonction\s*\"?quick generate\"?/gi, "lancer la generation directe");
      }
      return res.json({
        success: true,
        provider,
        model: result.model,
        tried: [...attempted, provider],
        answer,
        actions,
      });
    };

    if (openaiCompatFirst && openaiCompatBaseUrl && openaiCompatKey) {
      attempted.push("openai-compat");
      try {
        const result = await withTimeout(
          requestOpenAICompatChat({
            baseUrl: openaiCompatBaseUrl,
            apiKey: openaiCompatKey,
            model: openaiCompatModel,
            systemPrompt,
            userPrompt,
          }),
          CHAT_PROVIDER_TIMEOUT_MS,
          null
        );
        if (!result) throw new Error("Timeout provider OpenAI-compat.");
        return finishRemote("openai-compat", result);
      } catch (error) {
        errors.push(`OpenAI-compat: ${error.message}`);
      }
    }

    if (anthropicBaseUrl && anthropicKey) {
      attempted.push("anthropic");
      try {
        const result = await withTimeout(
          requestAnthropicChat({
            baseUrl: anthropicBaseUrl,
            apiKey: anthropicKey,
            model: anthropicModel,
            systemPrompt,
            userPrompt,
          }),
          CHAT_PROVIDER_TIMEOUT_MS,
          null
        );
        if (!result) throw new Error("Timeout provider Anthropic.");
        return finishRemote("anthropic", result);
      } catch (error) {
        errors.push(`Anthropic: ${error.message}`);
      }

      attempted.push("slok");
      try {
        const slokResult = await withTimeout(
          requestSlokChat({
            baseUrl: anthropicBaseUrl,
            apiKey: anthropicKey,
            model: anthropicModel,
            systemPrompt,
            userPrompt,
          }),
          CHAT_PROVIDER_TIMEOUT_MS,
          null
        );
        if (!slokResult) throw new Error("Timeout provider Slok.");
        return finishRemote("slok", slokResult);
      } catch (error) {
        errors.push(`Slok: ${error.message}`);
      }
    } else {
      errors.push("Anthropic: configuration absente.");
    }

    if (!openaiCompatFirst && openaiCompatBaseUrl && openaiCompatKey) {
      attempted.push("openai-compat");
      try {
        const result = await withTimeout(
          requestOpenAICompatChat({
            baseUrl: openaiCompatBaseUrl,
            apiKey: openaiCompatKey,
            model: openaiCompatModel,
            systemPrompt,
            userPrompt,
          }),
          CHAT_PROVIDER_TIMEOUT_MS,
          null
        );
        if (!result) throw new Error("Timeout provider OpenAI-compat.");
        return finishRemote("openai-compat", result);
      } catch (error) {
        errors.push(`OpenAI-compat: ${error.message}`);
      }
    }

    attempted.push("local-fallback");
    return res.json({
      success: true,
      provider: "local-fallback",
      model: "local-fallback",
      tried: attempted,
      answer: `${
        isSiteQuestion(message)
          ? localChatFallback(message, { page, league, matchId })
          : webResearchContext
            ? localResearchAnswer(message, webResearchContext)
            : localGeneralAnswer(message)
      }\n\n[Info technique: ${errors.join(" | ")}]`,
      actions,
    });
  } catch (error) {
    const fallbackMessage = req.body?.message;
    const fallbackResearch = await buildWebResearchContext(fallbackMessage);
    res.json({
      success: true,
      provider: "local-fallback",
      model: "local-fallback",
      answer: `${
        isSiteQuestion(fallbackMessage)
          ? localChatFallback(fallbackMessage, req.body?.context)
          : fallbackResearch
            ? localResearchAnswer(fallbackMessage, fallbackResearch)
            : localGeneralAnswer(fallbackMessage)
      }\n\n[Info technique: ${error.message}]`,
      actions: deriveControlActions(fallbackMessage, req.body?.context || {}),
    });
  }
});

app.post("/api/coupon/print-a4", validateBody(printCouponSchema), (req, res) => {
  try {
    const coupon = Array.isArray(req.body?.coupon) ? req.body.coupon : [];
    if (!coupon.length) {
      return res.status(400).send("Coupon vide.");
    }
    const html = buildPrintableCouponHtml(req.body || {});
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (error) {
    return res.status(500).send(`Erreur impression: ${error.message}`);
  }
});

app.get("/api/chat", (_req, res) => {
  const anthropicModel =
    process.env.ANTHROPIC_MODEL ||
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ||
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    null;
  const openaiCompatBase =
    process.env.OPENAI_COMPAT_BASE_URL || process.env.THE_OLD_API_BASE_URL || null;
  const openaiCompatKeyEnv =
    process.env.OPENAI_COMPAT_API_KEY || process.env.THE_OLD_API_KEY || "";
  const openaiCompatEnabled = Boolean(openaiCompatBase && openaiCompatKeyEnv);
  const openaiCompatModel =
    process.env.OPENAI_COMPAT_MODEL ||
    process.env.THE_OLD_MODEL ||
    (openaiCompatEnabled ? "gpt-4o" : null);
  const openaiCompatFirst =
    String(process.env.OPENAI_COMPAT_FIRST || process.env.THE_OLD_FIRST || "0").trim() === "1";
  const priority = openaiCompatFirst
    ? ["openai-compat", "anthropic", "slok", "local-fallback"]
    : ["anthropic", "slok", "openai-compat", "local-fallback"];
  res.json({
    success: true,
    message: "Route chat active. Utilise POST /api/chat avec { message, context }.",
    providerPriority: priority,
    openaiCompat: {
      enabled: openaiCompatEnabled,
      model: openaiCompatModel,
      baseUrl: openaiCompatBase,
      first: openaiCompatFirst,
      modelsListUrl:
        process.env.OPENAI_COMPAT_MODELS_URL || process.env.THE_OLD_MODELS_URL || null,
    },
    anthropic: {
      enabled: Boolean(
        process.env.ANTHROPIC_BASE_URL &&
          (process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY)
      ),
      model: anthropicModel,
      baseUrl: process.env.ANTHROPIC_BASE_URL || null,
    },
  });
});

app.use("/api", apiNotFound);
app.use(errorHandler);

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

async function syncTelegramWebhook() {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const webhookUrl = String(process.env.TELEGRAM_WEBHOOK_URL || "").trim();
  if (!botToken || !webhookUrl) return null;

  const payload = {
    url: webhookUrl,
    allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
  };
  const secretToken = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (secretToken) payload.secret_token = secretToken;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "Impossible de synchroniser le webhook Telegram.");
  }
  console.log(`Telegram webhook synchronise vers ${webhookUrl}`);
  return data;
}

async function deleteTelegramWebhook() {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) return null;
  const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: false }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "Impossible de supprimer le webhook Telegram.");
  }
  return data;
}

function createTelegramMockRequest(update = {}, secretToken = "") {
  return {
    body: update,
    get(headerName) {
      const key = String(headerName || "").toLowerCase();
      if (key === "x-telegram-bot-api-secret-token") return String(secretToken || "");
      return "";
    },
  };
}

function createTelegramMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };
}

async function startTelegramPolling() {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!botToken) return null;

  let offset = 0;
  let stopped = false;
  let running = false;

  const loop = async () => {
    if (stopped || running) return;
    running = true;
    try {
      while (!stopped) {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset,
            timeout: 30,
            allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          throw new Error(data?.description || "Telegram polling indisponible.");
        }
        const updates = Array.isArray(data?.result) ? data.result : [];
        for (const update of updates) {
          const nextOffset = Number(update?.update_id || 0) + 1;
          if (Number.isFinite(nextOffset) && nextOffset > offset) {
            offset = nextOffset;
          }
          const mockReq = createTelegramMockRequest(update, "");
          const mockRes = createTelegramMockResponse();
          await handleTelegramWebhookUpdate(mockReq, mockRes);
        }
      }
    } catch (error) {
      if (!stopped) {
        console.warn(`Telegram polling interrompu: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        running = false;
        return loop();
      }
    } finally {
      running = false;
    }
    return null;
  };

  console.log("Telegram polling actif.");
  loop().catch((error) => {
    console.warn(`Telegram polling non demarre: ${error.message}`);
  });

  return {
    stop() {
      stopped = true;
    },
  };
}

function startServer(startPort, triesLeft = MAX_PORT_TRIES) {
  const server = app.listen(startPort, () => {
    activeServerPort = startPort;
    console.log(`Serveur actif: http://localhost:${startPort}`);
    if (matchTrackingConfig.enabled) {
      setTimeout(() => {
        startMatchTrackingService().catch((error) => {
          console.warn(`Match tracker non demarre: ${error.message}`);
        });
      }, 5000);
    }
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_URL) {
      setTimeout(() => {
        syncTelegramWebhook().catch((error) => {
          console.warn(`Webhook Telegram non synchronise: ${error.message}`);
        });
      }, 1500);
    } else if (process.env.TELEGRAM_BOT_TOKEN) {
      setTimeout(() => {
        deleteTelegramWebhook()
          .catch(() => null)
          .finally(() => {
            startTelegramPolling().catch((error) => {
              console.warn(`Polling Telegram non demarre: ${error.message}`);
            });
          });
      }, 1500);
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && triesLeft > 0) {
      const nextPort = startPort + 1;
      console.warn(`Port ${startPort} occupe, tentative sur ${nextPort}...`);
      startServer(nextPort, triesLeft - 1);
      return;
    }

    console.error("Impossible de demarrer le serveur:", error.message);
    process.exit(1);
  });
}

startServer(DEFAULT_PORT);


