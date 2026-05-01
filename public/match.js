/* global Chart */
const AUTO_REFRESH_SECONDS = 60;
const DRIFT_THRESHOLD_PERCENT = 8;
const PAGE_REFRESH_STORAGE_KEY = "fc25_page_refresh_minutes_v1";
const DEFAULT_PAGE_REFRESH_MINUTES = 5;
const LOW_DATA_MODE_KEY = "fc25_low_data_mode_v1";
const AUTO_REFRESH_ENABLED = false;

let radarChart = null;
let flowChart = null;
let currentMatchId = null;
let refreshIntervalId = null;
let countdownIntervalId = null;
let pageRefreshIntervalId = null;
let countdown = AUTO_REFRESH_SECONDS;
let previousOdds = null;
let loading = false;
const IS_MOBILE = window.matchMedia("(max-width: 760px)").matches;
let lastDetailsData = null;
let coachModeEnabled = true;
let lowDataEnabled = false;

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function formatOdd(value) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function chartTextColor() {
  return "#d8e7f8";
}

function chartGridColor() {
  return "rgba(255,255,255,0.12)";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isLowDataModeEnabled() {
  return localStorage.getItem(LOW_DATA_MODE_KEY) === "1";
}

function setLowDataMode(value) {
  lowDataEnabled = Boolean(value);
  localStorage.setItem(LOW_DATA_MODE_KEY, lowDataEnabled ? "1" : "0");
  document.body.classList.toggle("low-data", lowDataEnabled);
}

function updateRefreshBadge() {
  const el = document.getElementById("refreshBadge");
  if (!el) return;
  el.textContent = AUTO_REFRESH_ENABLED ? `Auto-refresh dans ${countdown}s` : "Auto-refresh desactive";
}

function getPageRefreshMinutes() {
  const raw = Number(localStorage.getItem(PAGE_REFRESH_STORAGE_KEY));
  if (!Number.isFinite(raw)) return DEFAULT_PAGE_REFRESH_MINUTES;
  return Math.max(1, Math.min(60, raw));
}

function setPageRefreshMinutes(value) {
  const safe = Math.max(1, Math.min(60, Number(value) || DEFAULT_PAGE_REFRESH_MINUTES));
  localStorage.setItem(PAGE_REFRESH_STORAGE_KEY, String(safe));
  return safe;
}

function startPageRefreshTimer(minutes) {
  if (pageRefreshIntervalId) {
    clearInterval(pageRefreshIntervalId);
    pageRefreshIntervalId = null;
  }
  if (!AUTO_REFRESH_ENABLED) return;
  const ms = Math.max(1, Number(minutes) || DEFAULT_PAGE_REFRESH_MINUTES) * 60 * 1000;
  pageRefreshIntervalId = setInterval(() => {
    window.location.reload();
  }, ms);
}

function setMatchTelegramButtonEnabled(enabled) {
  const btn = document.getElementById("sendMatchTelegramBtn");
  const btnImageTelegram = document.getElementById("sendMatchTelegramImageBtn");
  const pdfBtn = document.getElementById("downloadMatchPdfBtn");
  const imageBtn = document.getElementById("downloadMatchImageBtn");
  const exportBtn = document.getElementById("exportAllMatchBtn");
  if (btn) btn.disabled = !enabled;
  if (btnImageTelegram) btnImageTelegram.disabled = !enabled;
  if (pdfBtn) pdfBtn.disabled = !enabled;
  if (imageBtn) imageBtn.disabled = !enabled;
  if (exportBtn) exportBtn.disabled = !enabled;
}

function notifyAction(title, detail = "") {
  const sub = document.getElementById("sub");
  if (sub) sub.textContent = detail || title;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body: detail || "Action terminee" });
    } catch {}
  }
}

function startAutoRefresh() {
  if (!AUTO_REFRESH_ENABLED) {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    refreshIntervalId = null;
    countdownIntervalId = null;
    updateRefreshBadge();
    return;
  }
  if (!refreshIntervalId) {
    refreshIntervalId = setInterval(() => {
      countdown = AUTO_REFRESH_SECONDS;
      updateRefreshBadge();
      loadData("auto");
    }, AUTO_REFRESH_SECONDS * 1000);
  }
  if (!countdownIntervalId) {
    countdownIntervalId = setInterval(() => {
      countdown = Math.max(0, countdown - 1);
      updateRefreshBadge();
    }, 1000);
  }
}

function impliedProbabilities(odds1x2) {
  const home = toNumber(odds1x2?.home, 0);
  const draw = toNumber(odds1x2?.draw, 0);
  const away = toNumber(odds1x2?.away, 0);
  if (!(home > 0 && draw > 0 && away > 0)) return { home: 33.3, draw: 33.3, away: 33.4 };
  const ph = 1 / home;
  const pd = 1 / draw;
  const pa = 1 / away;
  const sum = ph + pd + pa;
  return {
    home: Number(((ph / sum) * 100).toFixed(2)),
    draw: Number(((pd / sum) * 100).toFixed(2)),
    away: Number(((pa / sum) * 100).toFixed(2)),
  };
}

function extractOdds(match) {
  return {
    home: toNumber(match?.odds1x2?.home, 0),
    draw: toNumber(match?.odds1x2?.draw, 0),
    away: toNumber(match?.odds1x2?.away, 0),
  };
}

function computeDrift(previous, next) {
  if (!previous) return [];
  const labels = {
    home: "Victoire domicile (1)",
    draw: "Match nul (X)",
    away: "Victoire exterieur (2)",
  };
  const drifts = [];
  for (const key of ["home", "draw", "away"]) {
    const oldVal = toNumber(previous[key], 0);
    const newVal = toNumber(next[key], 0);
    if (oldVal <= 0 || newVal <= 0) continue;
    const pct = Math.abs(((newVal - oldVal) / oldVal) * 100);
    if (pct >= DRIFT_THRESHOLD_PERCENT) {
      drifts.push({
        label: labels[key],
        oldVal,
        newVal,
        pct: Number(pct.toFixed(1)),
      });
    }
  }
  return drifts;
}

function renderDriftAlert(drifts) {
  const box = document.getElementById("driftAlert");
  if (!box) return;
  if (!drifts.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  const rows = drifts
    .map((d) => `<li>${d.label}: ${formatOdd(d.oldVal)} -> ${formatOdd(d.newVal)} (${d.pct}%)</li>`)
    .join("");
  box.classList.remove("hidden");
  box.innerHTML = `
    <h2 class="drift-title">Alerte Drift Cotes</h2>
    <ul class="drift-list">${rows}</ul>
  `;
}

function renderMaster(master, analyse) {
  const el = document.getElementById("master");
  el.innerHTML = `
    <h2>Decision Finale (Maitre)</h2>
    <div class="grid2">
      <div class="box"><strong>Pari choisi</strong><div>${master.pari_choisi || "Aucun"}</div></div>
      <div class="box"><strong>Action</strong><div>${master.action || "AUCUNE"}</div></div>
      <div class="box"><strong>Confiance</strong><div>${master.confiance_numerique ?? 0}%</div></div>
      <div class="box"><strong>Consensus bots</strong><div>${analyse.consensus || "N/A"}</div></div>
    </div>
  `;
}

function renderBots(bots) {
  const el = document.getElementById("bots");
  const rows = Object.values(bots || [])
    .map((b) => {
      const picks = Array.isArray(b.paris_recommandes)
        ? b.paris_recommandes
            .map((p) => `<li>${p.nom} | cote ${formatOdd(Number(p.cote))} | confiance ${p.confiance ?? 0}%</li>`)
            .join("")
        : "";
      return `
      <div class="box">
        <strong>${b.bot_name}</strong>
        <div>Confiance globale: ${b.confiance_globale || 0}%</div>
        <div>Top paris: ${Array.isArray(b.paris_recommandes) ? b.paris_recommandes.length : 0}</div>
        <ul>${picks || "<li>Aucun pari retenu</li>"}</ul>
      </div>
    `;
    })
    .join("");
  el.innerHTML = `<h2>Confiance des Bots</h2><div class="grid2">${rows || "<div class='box'>Aucun bot</div>"}</div>`;
}

function renderTop3(list) {
  const el = document.getElementById("top3");
  const li = (list || [])
    .map((x) => `<li>${x.pari} | cote ${formatOdd(x.cote)} | score ${x.score_composite}% | value ${x.value}% | risque ${x.risque}</li>`)
    .join("");
  el.innerHTML = `<h2>Top 3 Recommandations</h2><ul>${li || "<li>Aucune recommandation</li>"}</ul>`;
}

function renderMarkets(markets) {
  const el = document.getElementById("markets");
  const li = (markets || [])
    .slice(0, 50)
    .map((m) => `<li>${m.nom} | cote ${formatOdd(m.cote)} | type ${m.type}</li>`)
    .join("");
  el.innerHTML = `<h2>Marches Analyses</h2><ul>${li || "<li>Aucun marche</li>"}</ul>`;
}

function buildCoachLines(data) {
  const match = data?.match || {};
  const prediction = data?.prediction || {};
  const selection = pickSingleSelectionFromDetails(data);
  const marketCount = Array.isArray(data?.bettingMarkets) ? data.bettingMarkets.length : 0;
  const probs = impliedProbabilities(match?.odds1x2 || {});
  const master = prediction?.maitre?.decision_finale || {};
  const confidence = Number(selection?.confiance || master?.confiance_numerique || 0);
  const minToStart = Math.max(0, Math.floor((Number(match?.startTimeUnix || 0) - Math.floor(Date.now() / 1000)) / 60));
  const risk =
    confidence >= 74 ? "Risque faible" : confidence >= 60 ? "Risque moyen" : "Risque eleve";
  const line = Number(selection?.cote || 0);
  const side =
    String(selection?.pari || "").includes("Plus de") || String(selection?.pari || "").includes("Moins de")
      ? "marche total"
      : "issue principale";

  const lines = [
    `Le pari recommande est "${selection?.pari || master?.pari_choisi || "Aucun"}" car la confiance actuelle est ${confidence.toFixed(
      1
    )}% (${risk}).`,
    `La cote ${line > 0 ? line.toFixed(3) : "-"} reste dans une zone exploitable pour un ${side}.`,
    `Probabilites implicites: domicile ${probs.home.toFixed(1)}%, nul ${probs.draw.toFixed(1)}%, exterieur ${probs.away.toFixed(1)}%.`,
    `Le match ${minToStart <= 0 ? "semble deja demarre" : `demarre dans environ ${minToStart} min`} et ${marketCount} marches sont disponibles.`,
    `Regle coach: valide le ticket seulement si la cote ne derive pas fortement et si la confiance reste au-dessus de 60%.`,
  ];
  return lines;
}

function renderCoachPanel(data) {
  const panel = document.getElementById("coachPanel");
  const content = document.getElementById("coachContent");
  if (!panel || !content) return;
  if (!coachModeEnabled) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const lines = buildCoachLines(data);
  content.innerHTML = `<ol class="coach-list">${lines.map((x) => `<li class="coach-note">${x}</li>`).join("")}</ol>`;
}

function renderInsightDeck(data) {
  const grid = document.getElementById("insightGrid");
  if (!grid) return;

  const selection = pickSingleSelectionFromDetails(data);
  const match = data?.match || {};
  const master = data?.prediction?.maitre?.decision_finale || {};
  const top = data?.prediction?.analyse_avancee?.top_3_recommandations?.[0] || null;
  const probs = impliedProbabilities(match?.odds1x2 || {});
  const confidence = Number(selection?.confiance || master?.confiance_numerique || 0);
  const startInMinutes = Math.max(
    0,
    Math.floor((Number(match?.startTimeUnix || 0) - Math.floor(Date.now() / 1000)) / 60)
  );
  const driftTag = previousOdds ? computeDrift(previousOdds, extractOdds(match)).length : 0;

  const cards = [
    {
      title: "Pick phare",
      text: `${selection?.pari || master?.pari_choisi || "Aucun pick propre"} | confiance ${confidence.toFixed(1)}%`,
    },
    {
      title: "Lecture rapide",
      text: `Domicile ${probs.home.toFixed(1)}% | Nul ${probs.draw.toFixed(1)}% | Exterieur ${probs.away.toFixed(1)}%`,
    },
    {
      title: "Timing",
      text: startInMinutes > 0 ? `Coup d'envoi estime dans ${startInMinutes} min.` : "Le match semble proche du direct ou deja lance.",
    },
    {
      title: "A surveiller",
      text: driftTag ? `${driftTag} drift(s) detecte(s) sur les cotes.` : `Top valeur: ${top?.pari || "stable pour le moment"}`,
    },
  ];

  grid.innerHTML = cards
    .map(
      (card) => `
        <article class="insight-card">
          <strong>${card.title}</strong>
          <p>${card.text}</p>
        </article>
      `
    )
    .join("");
}

function normalizeMarketLabel(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toFairProbability(odd) {
  const n = Number(odd);
  if (!Number.isFinite(n) || n <= 1) return null;
  return 1 / n;
}

function normalizeBinaryFairProbability(yesOdd, noOdd, fallback = null) {
  const py = toFairProbability(yesOdd);
  const pn = toFairProbability(noOdd);
  if (!(py > 0 && pn > 0)) return fallback;
  const sum = py + pn;
  return py / sum;
}

function extractLineNumber(label) {
  const match = String(label || "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
}

function collectMarketSignals(markets = []) {
  const grouped = new Map();
  for (const market of markets) {
    const label = normalizeMarketLabel(market?.nom);
    grouped.set(label, market);
  }

  const overLines = [];
  const underByLine = new Map();
  const overByLine = new Map();
  let bttsYes = null;
  let bttsNo = null;

  for (const market of markets) {
    const label = normalizeMarketLabel(market?.nom);
    const odd = Number(market?.cote);
    if (!(odd > 1)) continue;

    const line = extractLineNumber(label);
    const isOver = label.includes("plus de") || label.includes("over ");
    const isUnder = label.includes("moins de") || label.includes("under ");
    const isBttsYes =
      label.includes("les deux equipes marquent oui") ||
      label.includes("both teams to score yes") ||
      label.includes("btts yes");
    const isBttsNo =
      label.includes("les deux equipes marquent non") ||
      label.includes("both teams to score no") ||
      label.includes("btts no");

    if (isBttsYes) bttsYes = odd;
    if (isBttsNo) bttsNo = odd;
    if (line == null) continue;
    if (isOver) overByLine.set(line, odd);
    if (isUnder) underByLine.set(line, odd);
  }

  const allLines = [...new Set([...overByLine.keys(), ...underByLine.keys()])].sort((a, b) => a - b);
  for (const line of allLines) {
    const overOdd = overByLine.get(line);
    const underOdd = underByLine.get(line);
    const fairProb = normalizeBinaryFairProbability(overOdd, underOdd);
    if (fairProb != null) {
      overLines.push({ line, prob: fairProb, overOdd: Number(overOdd || 0), underOdd: Number(underOdd || 0) });
    }
  }

  return {
    overLines,
    bttsProb: normalizeBinaryFairProbability(bttsYes, bttsNo),
    bttsYesOdd: bttsYes,
    bttsNoOdd: bttsNo,
  };
}

function poissonPmf(lambda, k) {
  if (!(lambda >= 0) || k < 0) return 0;
  let acc = Math.exp(-lambda);
  for (let i = 1; i <= k; i += 1) acc *= lambda / i;
  return acc;
}

function buildPoissonTable(lambda, maxGoals = 8) {
  const values = [];
  let sum = 0;
  for (let goals = 0; goals < maxGoals; goals += 1) {
    const p = poissonPmf(lambda, goals);
    values.push(p);
    sum += p;
  }
  values.push(Math.max(0, 1 - sum));
  return values;
}

function computeScoreMatrix(homeLambda, awayLambda, maxGoals = 8) {
  const homeTable = buildPoissonTable(homeLambda, maxGoals);
  const awayTable = buildPoissonTable(awayLambda, maxGoals);
  const matrix = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;

  for (let h = 0; h < homeTable.length; h += 1) {
    for (let a = 0; a < awayTable.length; a += 1) {
      const probability = homeTable[h] * awayTable[a];
      matrix.push({ home: h, away: a, probability });
      if (h > a) homeWin += probability;
      else if (h === a) draw += probability;
      else awayWin += probability;
      if (h > 0 && a > 0) btts += probability;
    }
  }

  matrix.sort((left, right) => right.probability - left.probability);
  return { matrix, homeWin, draw, awayWin, btts, totalLambda: homeLambda + awayLambda };
}

function probabilityOverLine(matrix, line) {
  const threshold = Math.floor(Number(line) || 0) + 1;
  return matrix.reduce((acc, item) => acc + (item.home + item.away >= threshold ? item.probability : 0), 0);
}

function evaluateScoreLoss(homeLambda, awayLambda, target, signals) {
  const model = computeScoreMatrix(homeLambda, awayLambda);
  let loss =
    Math.pow(model.homeWin - target.home, 2) * 2.4 +
    Math.pow(model.draw - target.draw, 2) * 2.2 +
    Math.pow(model.awayWin - target.away, 2) * 2.4;

  for (const line of signals.overLines) {
    const predicted = probabilityOverLine(model.matrix, line.line);
    loss += Math.pow(predicted - line.prob, 2) * (line.line === 2.5 ? 2.3 : 1.5);
  }

  if (signals.bttsProb != null) {
    loss += Math.pow(model.btts - signals.bttsProb, 2) * 2;
  }

  return { loss, model };
}

function findBestExactScoreModel(match, markets = []) {
  const target = impliedProbabilities(match?.odds1x2 || {});
  const fairTarget = {
    home: target.home / 100,
    draw: target.draw / 100,
    away: target.away / 100,
  };
  const signals = collectMarketSignals(markets);
  let best = null;

  for (let homeLambda = 0.4; homeLambda <= 4.6; homeLambda += 0.16) {
    for (let awayLambda = 0.3; awayLambda <= 4.2; awayLambda += 0.16) {
      const candidate = evaluateScoreLoss(homeLambda, awayLambda, fairTarget, signals);
      if (!best || candidate.loss < best.loss) {
        best = { ...candidate, homeLambda, awayLambda };
      }
    }
  }

  if (!best) return null;

  let refined = best;
  for (let homeLambda = Math.max(0.2, best.homeLambda - 0.25); homeLambda <= best.homeLambda + 0.25; homeLambda += 0.04) {
    for (let awayLambda = Math.max(0.2, best.awayLambda - 0.25); awayLambda <= best.awayLambda + 0.25; awayLambda += 0.04) {
      const candidate = evaluateScoreLoss(homeLambda, awayLambda, fairTarget, signals);
      if (candidate.loss < refined.loss) {
        refined = { ...candidate, homeLambda, awayLambda };
      }
    }
  }

  return { ...refined, signals, fairTarget };
}

function buildExactScoreProjection(data) {
  const match = data?.match || {};
  const markets = Array.isArray(data?.bettingMarkets) ? data.bettingMarkets : [];
  const projection = findBestExactScoreModel(match, markets);
  if (!projection) return null;

  const topScores = projection.model.matrix.slice(0, 4).map((item) => ({
    score: `${item.home}-${item.away}`,
    probability: item.probability,
  }));
  const primary = topScores[0];
  const alternatives = topScores.slice(1, 4);
  const confidenceBase = Number(data?.prediction?.maitre?.decision_finale?.confiance_numerique || 60);
  const marketSupport = Math.min(100, projection.signals.overLines.length * 18 + (projection.signals.bttsProb != null ? 18 : 0) + 36);
  const fitScore = clamp(Math.round(100 - projection.loss * 260), 18, 96);
  const reliability = clamp(Math.round(fitScore * 0.44 + confidenceBase * 0.34 + marketSupport * 0.22), 20, 95);
  const totalGoals = projection.homeLambda + projection.awayLambda;
  const intensity =
    totalGoals >= 4.2 ? "match tres ouvert" : totalGoals >= 3 ? "match ouvert" : totalGoals >= 2.2 ? "match equilibre" : "match ferme";
  const edge =
    projection.homeLambda - projection.awayLambda >= 0.45
      ? "avantage domicile"
      : projection.awayLambda - projection.homeLambda >= 0.45
        ? "avantage exterieur"
        : "equilibre entre les deux equipes";

  return {
    primary,
    alternatives,
    reliability,
    fitScore,
    marketSupport,
    totalGoals,
    homeLambda: projection.homeLambda,
    awayLambda: projection.awayLambda,
    overLines: projection.signals.overLines,
    bttsProb: projection.signals.bttsProb,
    narrative: `${intensity}, ${edge}. Projection issue d'un moteur multi-signaux (1X2${projection.signals.overLines.length ? " + totals" : ""}${projection.signals.bttsProb != null ? " + BTTS" : ""}).`,
  };
}

function renderExactScorePanel(data) {
  const host = document.getElementById("exactScorePanel");
  if (!host) return;
  const projection = buildExactScoreProjection(data);
  if (!projection) {
    host.innerHTML = "<p>Projection score exact indisponible pour ce match.</p>";
    return;
  }

  const reliabilityTone =
    projection.reliability >= 78 ? "exact-score-elite" : projection.reliability >= 64 ? "exact-score-strong" : "exact-score-watch";
  const totalLine = projection.totalGoals.toFixed(2);
  const bttsText =
    projection.bttsProb == null ? "BTTS non exploitable" : `BTTS oui estime a ${(projection.bttsProb * 100).toFixed(1)}%`;

  host.innerHTML = `
    <div class="exact-score-imperial ${reliabilityTone}">
      <div class="exact-score-crown">
        <span class="exact-score-kicker">Projection Premium</span>
        <div class="exact-score-mainline">
          <div class="exact-score-primary">
            <strong>Score principal</strong>
            <div class="exact-score-value">${projection.primary.score}</div>
            <small>Probabilite modelisee ${(projection.primary.probability * 100).toFixed(1)}%</small>
          </div>
          <div class="exact-score-reliability">
            <span>Fiabilite renforcee</span>
            <strong>${projection.reliability}/100</strong>
            <small>Fit ${projection.fitScore}/100 | support marches ${projection.marketSupport}/100</small>
          </div>
        </div>
      </div>
      <div class="exact-score-grid">
        <article class="exact-score-card">
          <strong>Scenarios proches</strong>
          <div class="exact-score-alt-list">
            ${projection.alternatives
              .map(
                (item) => `
                  <span class="exact-score-alt">${item.score}<small>${(item.probability * 100).toFixed(1)}%</small></span>
                `
              )
              .join("")}
          </div>
        </article>
        <article class="exact-score-card">
          <strong>Moteur buts attendus</strong>
          <p>Domicile ${projection.homeLambda.toFixed(2)} | Exterieur ${projection.awayLambda.toFixed(2)} | total ${totalLine}</p>
        </article>
        <article class="exact-score-card">
          <strong>Lecture terrain</strong>
          <p>${projection.narrative}</p>
        </article>
        <article class="exact-score-card">
          <strong>Validation marches</strong>
          <p>${bttsText}${projection.overLines.length ? ` | ligne total cle: ${projection.overLines[0].line}` : ""}</p>
        </article>
      </div>
      <div class="exact-score-note">
        Projection analytique haute precision, a lire comme scenario dominant et non comme certitude absolue.
      </div>
    </div>
  `;
}

function pickSingleSelectionFromDetails(data) {
  const match = data?.match || {};
  const prediction = data?.prediction || {};
  const bettingMarkets = Array.isArray(data?.bettingMarkets) ? data.bettingMarkets : [];
  const master = prediction?.maitre?.decision_finale || {};
  const marketByName = new Map(bettingMarkets.map((m) => [String(m.nom), m]));

  let pari = String(master.pari_choisi || "").trim();
  let cote = pari ? Number(marketByName.get(pari)?.cote) : NaN;
  let confiance = Number(master.confiance_numerique || 0);

  if (!pari || !Number.isFinite(cote)) {
    const top = prediction?.analyse_avancee?.top_3_recommandations || [];
    const best = top.find((x) => Number.isFinite(Number(x?.cote)));
    if (best) {
      pari = String(best.pari || "");
      cote = Number(best.cote);
      confiance = Number(best.score_composite || confiance || 55);
    }
  }

  if (!pari || !Number.isFinite(cote)) {
    const fallback = bettingMarkets.find((m) => Number.isFinite(Number(m?.cote)));
    if (fallback) {
      pari = String(fallback.nom || "");
      cote = Number(fallback.cote);
      confiance = Math.max(confiance, 50);
    }
  }

  if (!pari || !Number.isFinite(cote)) return null;

  return {
    matchId: match.id,
    teamHome: match.teamHome,
    teamAway: match.teamAway,
    league: match.league,
    pari,
    cote,
    confiance: Number.isFinite(confiance) ? Number(confiance.toFixed(1)) : 55,
  };
}

function couponSummary(coupon) {
  const totalSelections = coupon.length;
  const combinedOdd = totalSelections ? Number(coupon.reduce((acc, x) => acc * Number(x.cote || 1), 1).toFixed(3)) : null;
  const averageConfidence = totalSelections
    ? Number((coupon.reduce((acc, x) => acc + Number(x.confiance || 0), 0) / totalSelections).toFixed(1))
    : 0;
  return { totalSelections, combinedOdd, averageConfidence };
}

async function sendCurrentMatchToTelegram() {
  const btn = document.getElementById("sendMatchTelegramBtn");
  if (!lastDetailsData) return;

  const selection = pickSingleSelectionFromDetails(lastDetailsData);
  if (!selection) {
    document.getElementById("sub").textContent = "Selection Telegram impossible pour ce match.";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Envoi...";
  }

  try {
    const payload = {
      coupon: [selection],
      summary: couponSummary([selection]),
      riskProfile: "single-match",
    };
    const res = await fetch("/api/coupon/send-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || data?.message || "Erreur Telegram");
    }
    notifyAction("Coupon envoye", "Ticket 1 match envoye sur Telegram.");
  } catch (error) {
    document.getElementById("sub").textContent = `Erreur Telegram: ${error.message}`;
  } finally {
    if (btn) {
      btn.textContent = "Envoyer Telegram";
      setMatchTelegramButtonEnabled(Boolean(lastDetailsData));
    }
  }
}

async function sendCurrentMatchImageToTelegram() {
  const btn = document.getElementById("sendMatchTelegramImageBtn");
  if (!lastDetailsData) return;
  const selection = pickSingleSelectionFromDetails(lastDetailsData);
  if (!selection) {
    document.getElementById("sub").textContent = "Selection Telegram image impossible pour ce match.";
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Envoi image...";
  }

  try {
    const payload = {
      coupon: [selection],
      summary: couponSummary([selection]),
      riskProfile: "single-match",
      sendImage: true,
      imageFormat: "png",
    };
    const res = await fetch("/api/coupon/send-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) throw new Error(data?.error || data?.message || "Erreur Telegram image");
    notifyAction("Coupon envoye", "Image du ticket match envoyee sur Telegram.");
  } catch (error) {
    document.getElementById("sub").textContent = `Erreur Telegram image: ${error.message}`;
  } finally {
    if (btn) {
      btn.textContent = "Telegram Image";
      setMatchTelegramButtonEnabled(Boolean(lastDetailsData));
    }
  }
}

async function exportMatchAllInOne() {
  const btn = document.getElementById("exportAllMatchBtn");
  if (!lastDetailsData) return;
  const selection = pickSingleSelectionFromDetails(lastDetailsData);
  if (!selection) {
    document.getElementById("sub").textContent = "Export 1-clic impossible: aucune selection fiable.";
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  if (Number(lastDetailsData?.match?.startTimeUnix || 0) <= now) {
    document.getElementById("sub").textContent = "Export 1-clic bloque: match deja demarre.";
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Export en cours...";
  }
  try {
    const payload = {
      coupon: [selection],
      summary: couponSummary([selection]),
      riskProfile: "single-match",
      imageFormat: "png",
    };
    const tgRes = await fetch("/api/coupon/send-telegram-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const tgData = await tgRes.json();
    if (!tgRes.ok || !tgData?.success) {
      throw new Error(tgData?.error || tgData?.message || "Erreur pack Telegram");
    }
    await downloadCurrentMatchImage();
    await downloadCurrentMatchPdf();
    notifyAction("Coupon envoye", "Export 1-clic termine: Telegram + Image + PDF.");
  } catch (error) {
    document.getElementById("sub").textContent = `Erreur export 1-clic: ${error.message}`;
  } finally {
    if (btn) {
      btn.textContent = "Export 1-Clic";
      setMatchTelegramButtonEnabled(Boolean(lastDetailsData));
    }
  }
}

async function downloadCurrentMatchPdf() {
  if (!lastDetailsData) return;
  const selection = pickSingleSelectionFromDetails(lastDetailsData);
  if (!selection) {
    document.getElementById("sub").textContent = "Selection PDF impossible pour ce match.";
    return;
  }

  try {
    const payload = {
      coupon: [selection],
      summary: couponSummary([selection]),
      riskProfile: "single-match",
    };
    const endpoints = ["/api/coupon/pdf", "/api/pdf/coupon", "/api/download/coupon"];
    let blob = null;
    let lastErr = "Erreur PDF";
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        blob = await res.blob();
        break;
      }
      const text = await res.text();
      if (String(text).includes("Route API introuvable")) {
        lastErr = "Serveur ancien actif. Redemarre npm start puis recharge la page.";
      } else {
        lastErr = text || `HTTP ${res.status}`;
      }
    }
    if (!blob) throw new Error(lastErr);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match-ticket-${selection.matchId}-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyAction("Coupon envoye", "PDF match telecharge.");
  } catch (error) {
    document.getElementById("sub").textContent = `Erreur PDF: ${error.message}`;
  }
}

async function downloadCurrentMatchImage() {
  if (!lastDetailsData) return;
  const selection = pickSingleSelectionFromDetails(lastDetailsData);
  if (!selection) {
    document.getElementById("sub").textContent = "Selection image impossible pour ce match.";
    return;
  }

  try {
    const payload = {
      coupon: [selection],
      summary: couponSummary([selection]),
      riskProfile: "single-match",
      format: "png",
    };
    const endpoints = ["/api/coupon/image"];
    let blob = null;
    let lastErr = "Erreur image";
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        blob = await res.blob();
        break;
      }
      const text = await res.text();
      lastErr = text || `HTTP ${res.status}`;
    }
    if (!blob) throw new Error(lastErr);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `match-ticket-${selection.matchId}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyAction("Coupon envoye", "Image match telechargee.");
  } catch (error) {
    document.getElementById("sub").textContent = `Erreur image: ${error.message}`;
  }
}

function computeMatchModel(data) {
  const match = data.match || {};
  const prediction = data.prediction || {};
  const bots = Object.values(prediction.bots || {});
  const probs = impliedProbabilities(match.odds1x2);

  const avgBotConfidence =
    bots.length > 0
      ? Number((bots.reduce((acc, b) => acc + toNumber(b.confiance_globale, 0), 0) / bots.length).toFixed(2))
      : 0;
  const masterConfidence = toNumber(prediction?.maitre?.decision_finale?.confiance_numerique, 0);

  const marketCount = Array.isArray(data.bettingMarkets) ? data.bettingMarkets.length : 0;
  const odds = extractOdds(match);
  const oddsMean = ((odds.home || 0) + (odds.draw || 0) + (odds.away || 0)) / 3 || 1;
  const volatility = previousOdds
    ? Number(
        (
          (Math.abs(odds.home - previousOdds.home) +
            Math.abs(odds.draw - previousOdds.draw) +
            Math.abs(odds.away - previousOdds.away)) /
          3
        ).toFixed(3)
      )
    : 0;

  const homePower = clamp(probs.home * 0.52 + masterConfidence * 0.22 + avgBotConfidence * 0.16, 8, 96);
  const awayPower = clamp(probs.away * 0.52 + (100 - masterConfidence) * 0.22 + avgBotConfidence * 0.16, 8, 96);
  const drawGrip = clamp(probs.draw * 1.35 + (odds.draw < 4 ? 8 : 0), 4, 65);
  const valuePulse = clamp((marketCount / 160) * 100 + (100 / oddsMean) * 8, 5, 100);
  const driftPulse = clamp(volatility * 100, 0, 100);

  const axis = ["Attaque", "Controle", "Forme", "Precision", "Discipline", "Momentum"];
  const homeProfile = [
    clamp(homePower * 0.94, 8, 99),
    clamp(homePower * 0.87 + drawGrip * 0.1, 8, 99),
    clamp(avgBotConfidence * 0.95, 8, 99),
    clamp((100 / Math.max(1.05, odds.home)) * 1.2, 8, 99),
    clamp(72 - driftPulse * 0.28 + probs.home * 0.24, 8, 99),
    clamp(homePower - driftPulse * 0.42 + (masterConfidence - 50) * 0.35, 8, 99),
  ];
  const awayProfile = [
    clamp(awayPower * 0.94, 8, 99),
    clamp(awayPower * 0.87 + drawGrip * 0.1, 8, 99),
    clamp((100 - avgBotConfidence) * 0.4 + 44, 8, 99),
    clamp((100 / Math.max(1.05, odds.away)) * 1.2, 8, 99),
    clamp(72 - driftPulse * 0.28 + probs.away * 0.24, 8, 99),
    clamp(awayPower - driftPulse * 0.42 + (50 - masterConfidence) * 0.35, 8, 99),
  ];

  const timeline = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
  const confFactor = (avgBotConfidence + masterConfidence) / 200;
  const waveAmp = clamp(6 + driftPulse * 0.08 + confFactor * 5, 4, 18);
  const homeFlow = timeline.map((m) =>
    clamp(
      probs.home + Math.sin((m / 90) * Math.PI * 2) * waveAmp + (m > 45 ? 2.2 : 0) + (masterConfidence - 50) * 0.05,
      3,
      93
    )
  );
  const awayFlow = timeline.map((m) =>
    clamp(
      probs.away + Math.cos((m / 90) * Math.PI * 1.7) * waveAmp + (m > 60 ? 1.8 : 0) + (50 - masterConfidence) * 0.05,
      3,
      93
    )
  );
  const drawFlow = timeline.map((_, i) => clamp(100 - homeFlow[i] - awayFlow[i], 2, 45));

  return {
    axis,
    homeProfile,
    awayProfile,
    timeline,
    homeFlow,
    awayFlow,
    drawFlow,
    kpis: {
      homeWin: probs.home,
      awayWin: probs.away,
      valuePulse,
      driftPulse,
    },
  };
}

function renderKpis(model) {
  const el = document.getElementById("kpiGrid");
  if (!el) return;
  el.innerHTML = `
    <div class="kpi"><small>Win Home</small><strong>${model.kpis.homeWin.toFixed(1)}%</strong></div>
    <div class="kpi"><small>Win Away</small><strong>${model.kpis.awayWin.toFixed(1)}%</strong></div>
    <div class="kpi"><small>Value Pulse</small><strong>${model.kpis.valuePulse.toFixed(1)}</strong></div>
    <div class="kpi"><small>Drift Pulse</small><strong>${model.kpis.driftPulse.toFixed(1)}</strong></div>
  `;
}

function makeGlowGradient(ctx, colorStart, colorEnd) {
  const g = ctx.createLinearGradient(0, 0, 0, 340);
  g.addColorStop(0, colorStart);
  g.addColorStop(1, colorEnd);
  return g;
}

function renderNeuralCharts(data) {
  const analyticsPanel = document.querySelector(".analytics-panel");
  if (analyticsPanel) analyticsPanel.classList.toggle("hidden", lowDataEnabled);
  if (lowDataEnabled) return;
  const radarCanvas = document.getElementById("chartRadar");
  const flowCanvas = document.getElementById("chartFlow");
  if (!radarCanvas || !flowCanvas || !window.Chart) return;

  const model = computeMatchModel(data);
  renderKpis(model);

  if (radarChart) {
    try { radarChart.destroy(); } catch {}
  }
  if (flowChart) {
    try { flowChart.destroy(); } catch {}
  }

  radarChart = new Chart(radarCanvas, {
    type: "radar",
    data: {
      labels: model.axis,
      datasets: [
        {
          label: data.match?.teamHome || "Equipe 1",
          data: model.homeProfile,
          borderColor: "#5fd2ff",
          backgroundColor: "rgba(95, 210, 255, 0.24)",
          borderWidth: 2,
        },
        {
          label: data.match?.teamAway || "Equipe 2",
          data: model.awayProfile,
          borderColor: "#ff7b7b",
          backgroundColor: "rgba(255, 123, 123, 0.2)",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          angleLines: { color: "rgba(255,255,255,0.13)" },
          grid: { color: "rgba(255,255,255,0.12)" },
          pointLabels: { color: chartTextColor() },
          ticks: { display: false },
        },
      },
      plugins: {
        legend: { labels: { color: chartTextColor() } },
      },
    },
  });

  const flowCtx = flowCanvas.getContext("2d");
  if (!flowCtx) return;
  const gradHome = makeGlowGradient(flowCtx, "rgba(83, 206, 255, 0.5)", "rgba(83, 206, 255, 0.02)");
  const gradAway = makeGlowGradient(flowCtx, "rgba(255, 109, 109, 0.42)", "rgba(255, 109, 109, 0.01)");

  flowChart = new Chart(flowCanvas, {
    type: "line",
    data: {
      labels: model.timeline,
      datasets: [
        {
          label: `${data.match?.teamHome || "Home"} flux`,
          data: model.homeFlow,
          borderColor: "#53ceff",
          backgroundColor: gradHome,
          fill: true,
          pointRadius: IS_MOBILE ? 0 : 2,
          tension: 0.34,
          borderWidth: 2.4,
        },
        {
          label: `${data.match?.teamAway || "Away"} flux`,
          data: model.awayFlow,
          borderColor: "#ff6d6d",
          backgroundColor: gradAway,
          fill: true,
          pointRadius: IS_MOBILE ? 0 : 2,
          tension: 0.34,
          borderWidth: 2.4,
        },
        {
          label: "Zone Nul",
          data: model.drawFlow,
          borderColor: "#ffd479",
          borderDash: [7, 4],
          fill: false,
          pointRadius: 0,
          tension: 0.28,
          borderWidth: 1.7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: IS_MOBILE ? false : { duration: 420 },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { color: chartTextColor(), callback: (v) => `${v}%` },
          grid: { color: chartGridColor() },
        },
        x: {
          ticks: { color: chartTextColor(), callback: (v) => `${model.timeline[v]}'` },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
      plugins: {
        legend: { labels: { color: chartTextColor() } },
        tooltip: {
          enabled: !IS_MOBILE,
          callbacks: {
            title: (items) => `${items?.[0]?.label || 0} min`,
            label: (ctx) => `${ctx.dataset.label}: ${toNumber(ctx.parsed?.y, 0).toFixed(1)}%`,
          },
        },
      },
    },
  });
}

async function loadData(trigger = "manual") {
  if (loading || !currentMatchId) return;
  loading = true;
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(currentMatchId)}/details`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || data.message || "Erreur API");

    const match = data.match || {};
    lastDetailsData = data;
    setMatchTelegramButtonEnabled(true);
    document.getElementById("title").textContent = `${match.teamHome} vs ${match.teamAway}`;
    document.getElementById("sub").textContent = `${match.league} | marche(s): ${data.bettingMarkets?.length || 0}${trigger === "auto" ? " | mise a jour auto" : ""}`;

    renderMaster(data.prediction?.maitre?.decision_finale || {}, data.prediction?.maitre?.analyse_bots || {});
    renderCoachPanel(data);
    renderNeuralCharts(data);
    renderInsightDeck(data);
    renderExactScorePanel(data);
    renderBots(data.prediction?.bots || {});
    renderTop3(data.prediction?.analyse_avancee?.top_3_recommandations || []);
    renderMarkets(data.bettingMarkets || []);

    const currentOdds = extractOdds(match);
    const drifts = computeDrift(previousOdds, currentOdds);
    renderDriftAlert(drifts);
    previousOdds = currentOdds;
    if (window.aiCoach && typeof window.aiCoach.updateMatchContext === "function") {
      window.aiCoach.updateMatchContext(match);
    }
  } catch (error) {
    lastDetailsData = null;
    setMatchTelegramButtonEnabled(false);
    document.getElementById("title").textContent = "Erreur de chargement";
    document.getElementById("sub").textContent = error.message;
    console.error("Erreur match.js:", error);
  } finally {
    loading = false;
  }
}

function init() {
  currentMatchId = qs("id");
  if (!currentMatchId) {
    setMatchTelegramButtonEnabled(false);
    document.getElementById("title").textContent = "Match non specifie";
    document.getElementById("sub").textContent = "Ajoute ?id=...";
    return;
  }
  countdown = AUTO_REFRESH_SECONDS;
  updateRefreshBadge();
  const refreshInput = document.getElementById("refreshMinutesInput");
  if (refreshInput) {
    const defaultMin = getPageRefreshMinutes();
    refreshInput.value = String(defaultMin);
    refreshInput.disabled = !AUTO_REFRESH_ENABLED;
    refreshInput.title = AUTO_REFRESH_ENABLED ? "" : "Le rafraichissement automatique est desactive pour proteger le chat IA.";
    startPageRefreshTimer(defaultMin);
    refreshInput.addEventListener("change", () => {
      const v = setPageRefreshMinutes(refreshInput.value);
      refreshInput.value = String(v);
      startPageRefreshTimer(v);
    });
  } else {
    startPageRefreshTimer(getPageRefreshMinutes());
  }
  const coachToggle = document.getElementById("coachModeToggle");
  if (coachToggle) {
    coachToggle.checked = true;
    coachToggle.addEventListener("change", () => {
      coachModeEnabled = Boolean(coachToggle.checked);
      if (lastDetailsData) renderCoachPanel(lastDetailsData);
    });
  }
  const lowDataToggle = document.getElementById("lowDataToggle");
  if (lowDataToggle) {
    const enabled = isLowDataModeEnabled();
    lowDataToggle.checked = enabled;
    setLowDataMode(enabled);
    lowDataToggle.addEventListener("change", () => {
      setLowDataMode(Boolean(lowDataToggle.checked));
      if (lastDetailsData) renderNeuralCharts(lastDetailsData);
    });
  } else {
    setLowDataMode(isLowDataModeEnabled());
  }
  setMatchTelegramButtonEnabled(false);
  if ("Notification" in window && Notification.permission === "default") {
    try {
      Notification.requestPermission();
    } catch {}
  }
  const sendBtn = document.getElementById("sendMatchTelegramBtn");
  if (sendBtn) sendBtn.addEventListener("click", sendCurrentMatchToTelegram);
  const sendImageBtn = document.getElementById("sendMatchTelegramImageBtn");
  if (sendImageBtn) sendImageBtn.addEventListener("click", sendCurrentMatchImageToTelegram);
  const pdfBtn = document.getElementById("downloadMatchPdfBtn");
  if (pdfBtn) pdfBtn.addEventListener("click", downloadCurrentMatchPdf);
  const imageBtn = document.getElementById("downloadMatchImageBtn");
  if (imageBtn) imageBtn.addEventListener("click", downloadCurrentMatchImage);
  const exportAllBtn = document.getElementById("exportAllMatchBtn");
  if (exportAllBtn) exportAllBtn.addEventListener("click", exportMatchAllInOne);
  loadData("manual");
  startAutoRefresh();
}

init();

function registerMatchSiteControl() {
  window.SiteControl = {
    page: "match",
    actions: [
      "refresh_match_data",
      "send_match_telegram_text",
      "send_match_telegram_image",
      "download_match_image",
      "download_match_pdf",
      "export_match_all",
      "toggle_coach_mode",
      "set_refresh_minutes",
      "set_low_data",
    ],
    async execute(name, payload = {}) {
      const action = String(name || "").toLowerCase();
      if (action === "refresh_match_data") return loadData("manual");
      if (action === "send_match_telegram_text") return sendCurrentMatchToTelegram();
      if (action === "send_match_telegram_image") return sendCurrentMatchImageToTelegram();
      if (action === "download_match_image") return downloadCurrentMatchImage();
      if (action === "download_match_pdf") return downloadCurrentMatchPdf();
      if (action === "export_match_all") return exportMatchAllInOne();
      if (action === "toggle_coach_mode") {
        const desired = typeof payload?.enabled === "boolean" ? payload.enabled : !coachModeEnabled;
        coachModeEnabled = Boolean(desired);
        const toggle = document.getElementById("coachModeToggle");
        if (toggle) toggle.checked = coachModeEnabled;
        if (lastDetailsData) renderCoachPanel(lastDetailsData);
        return true;
      }
      if (action === "set_refresh_minutes") {
        const m = setPageRefreshMinutes(payload?.minutes);
        const input = document.getElementById("refreshMinutesInput");
        if (input) input.value = String(m);
        startPageRefreshTimer(m);
        return true;
      }
      if (action === "set_low_data") {
        const desired = typeof payload?.enabled === "boolean" ? payload.enabled : !isLowDataModeEnabled();
        const toggle = document.getElementById("lowDataToggle");
        if (toggle) toggle.checked = Boolean(desired);
        setLowDataMode(Boolean(desired));
        if (lastDetailsData) renderNeuralCharts(lastDetailsData);
        return true;
      }
      return false;
    },
  };
}

registerMatchSiteControl();
