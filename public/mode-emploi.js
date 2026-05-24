(function initGuideAccordion() {
  const mobile = window.matchMedia("(max-width: 700px)");
  const panels = Array.from(document.querySelectorAll(".panel"));

  function buildPanel(panel) {
    if (!mobile.matches) {
      panel.classList.remove("is-collapsible", "collapsed");
      const body = panel.querySelector(":scope > .panel-body");
      if (body) {
        while (body.firstChild) panel.appendChild(body.firstChild);
        body.remove();
      }
      return;
    }

    const h2 = panel.querySelector(":scope > h2");
    if (!h2) return;
    if (panel.querySelector(":scope > .panel-body")) return;

    panel.classList.add("is-collapsible");
    const body = document.createElement("div");
    body.className = "panel-body";
    while (h2.nextSibling) {
      body.appendChild(h2.nextSibling);
    }
    panel.appendChild(body);
  }

  function bindPanel(panel, index) {
    const h2 = panel.querySelector(":scope > h2");
    if (!h2 || h2.dataset.bindAccordion === "1") return;
    h2.dataset.bindAccordion = "1";
    if (mobile.matches && index > 0) panel.classList.add("collapsed");
    h2.addEventListener("click", () => {
      if (!mobile.matches) return;
      panel.classList.toggle("collapsed");
    });
  }

  function refresh() {
    panels.forEach((panel) => buildPanel(panel));
    panels.forEach((panel, index) => bindPanel(panel, index));
  }

  refresh();
  mobile.addEventListener("change", refresh);
})();

(function initFifaVirtualConvergence() {
  const mount = document.getElementById("fifaVirtualConvergenceMount");
  if (!mount) return;

  const SCORES = [
    { score: "0-0", g1: 0, g2: 0, total: 0 },
    { score: "1-0", g1: 1, g2: 0, total: 1 },
    { score: "0-1", g1: 0, g2: 1, total: 1 },
    { score: "1-1", g1: 1, g2: 1, total: 2 },
    { score: "2-0", g1: 2, g2: 0, total: 2 },
    { score: "0-2", g1: 0, g2: 2, total: 2 },
    { score: "2-1", g1: 2, g2: 1, total: 3 },
    { score: "1-2", g1: 1, g2: 2, total: 3 },
    { score: "2-2", g1: 2, g2: 2, total: 4 },
    { score: "3-0", g1: 3, g2: 0, total: 3 },
    { score: "0-3", g1: 0, g2: 3, total: 3 },
    { score: "3-1", g1: 3, g2: 1, total: 4 },
    { score: "1-3", g1: 1, g2: 3, total: 4 },
    { score: "3-2", g1: 3, g2: 2, total: 5 },
    { score: "2-3", g1: 2, g2: 3, total: 5 },
    { score: "3-3", g1: 3, g2: 3, total: 6 },
    { score: "4-0", g1: 4, g2: 0, total: 4 },
    { score: "0-4", g1: 0, g2: 4, total: 4 },
    { score: "4-1", g1: 4, g2: 1, total: 5 },
    { score: "1-4", g1: 1, g2: 4, total: 5 },
  ];

  const EXAMPLE_INPUTS = {
    cote_victoire_eq1: 1.8,
    cote_nul: 3.5,
    cote_victoire_eq2: 4.2,
    cote_1X: 1.2,
    cote_12: 1.35,
    cote_X2: 1.9,
    cote_over_05: 1.1,
    cote_under_05: 6.0,
    cote_over_15: 1.4,
    cote_under_15: 2.9,
    cote_over_25: 2.1,
    cote_under_25: 1.7,
    cote_over_35: 3.5,
    cote_under_35: 1.25,
    cote_over_45: 6.0,
    cote_under_45: 1.1,
    cote_btts_oui: 1.9,
    cote_btts_non: 1.85,
    cote_hcap_eq1_minus05: 2.0,
    cote_hcap_eq1_plus05: 1.8,
    cote_hcap_eq1_minus15: 3.2,
    cote_hcap_eq1_plus15: 1.35,
    cote_hcap_eq2_minus05: 2.1,
    cote_hcap_eq2_plus05: 1.75,
    cote_hcap_eq2_minus15: 3.5,
    cote_hcap_eq2_plus15: 1.3,
    cote_eq1_over_05: 1.55,
    cote_eq1_under_05: 2.4,
    cote_eq1_over_15: 2.8,
    cote_eq1_under_15: 1.45,
    cote_eq1_over_25: 5.0,
    cote_eq1_under_25: 1.15,
    cote_eq2_over_05: 1.9,
    cote_eq2_under_05: 1.85,
    cote_eq2_over_15: 3.2,
    cote_eq2_under_15: 1.35,
    cote_eq2_over_25: 6.0,
    cote_eq2_under_25: 1.1,
    cote_mt_eq1: 2.2,
    cote_mt_nul: 2.1,
    cote_mt_eq2: 3.8,
    cote_mt_ft_1_1: 4.5,
    cote_mt_ft_1_X: 8.5,
    cote_mt_ft_1_2: 14.0,
    cote_mt_ft_X_1: 7.0,
    cote_mt_ft_X_X: 5.5,
    cote_mt_ft_X_2: 9.0,
    cote_mt_ft_2_1: 16.0,
    cote_mt_ft_2_X: 12.0,
    cote_mt_ft_2_2: 18.0,
    "cote_score_exact_1-0": 5.5,
    "cote_score_exact_0-1": 7.0,
    "cote_score_exact_1-1": 6.0,
    "cote_score_exact_2-0": 8.5,
    "cote_score_exact_0-0": 9.5,
  };

  const MARKET_GROUPS = [
    {
      title: "Resultat final",
      key: "1x2",
      open: true,
      options: [
        { id: "cote_victoire_eq1", label: "Victoire eq1", code: "eq1_gagne" },
        { id: "cote_nul", label: "Nul", code: "nul" },
        { id: "cote_victoire_eq2", label: "Victoire eq2", code: "eq2_gagne" },
      ],
    },
    {
      title: "Double chance",
      key: "double_chance",
      options: [
        { id: "cote_1X", label: "1X", code: "1X" },
        { id: "cote_12", label: "12", code: "12" },
        { id: "cote_X2", label: "X2", code: "X2" },
      ],
    },
    {
      title: "Total buts 0.5",
      key: "over_under_05",
      options: [
        { id: "cote_over_05", label: "Over 0.5", code: "over" },
        { id: "cote_under_05", label: "Under 0.5", code: "under" },
      ],
    },
    {
      title: "Total buts 1.5",
      key: "over_under_15",
      options: [
        { id: "cote_over_15", label: "Over 1.5", code: "over" },
        { id: "cote_under_15", label: "Under 1.5", code: "under" },
      ],
    },
    {
      title: "Total buts 2.5",
      key: "over_under_25",
      options: [
        { id: "cote_over_25", label: "Over 2.5", code: "over" },
        { id: "cote_under_25", label: "Under 2.5", code: "under" },
      ],
    },
    {
      title: "Total buts 3.5",
      key: "over_under_35",
      options: [
        { id: "cote_over_35", label: "Over 3.5", code: "over" },
        { id: "cote_under_35", label: "Under 3.5", code: "under" },
      ],
    },
    {
      title: "Total buts 4.5",
      key: "over_under_45",
      options: [
        { id: "cote_over_45", label: "Over 4.5", code: "over" },
        { id: "cote_under_45", label: "Under 4.5", code: "under" },
      ],
    },
    {
      title: "BTTS",
      key: "btts",
      options: [
        { id: "cote_btts_oui", label: "BTTS oui", code: "oui" },
        { id: "cote_btts_non", label: "BTTS non", code: "non" },
      ],
    },
    {
      title: "Handicap equipe 1 -0.5",
      key: "handicap_eq1_minus05",
      options: [
        { id: "cote_hcap_eq1_minus05", label: "Eq1 -0.5", code: "eq1_gagne" },
        { id: "cote_hcap_eq1_plus05", label: "Eq1 +0.5", code: "eq2_gagne" },
      ],
    },
    {
      title: "Handicap equipe 1 -1.5",
      key: "handicap_eq1_minus15",
      options: [
        { id: "cote_hcap_eq1_minus15", label: "Eq1 -1.5", code: "eq1_gagne" },
        { id: "cote_hcap_eq1_plus15", label: "Eq1 +1.5", code: "eq2_gagne" },
      ],
    },
    {
      title: "Handicap equipe 2 -0.5",
      key: "handicap_eq2_minus05",
      options: [
        { id: "cote_hcap_eq2_minus05", label: "Eq2 -0.5", code: "eq2_gagne" },
        { id: "cote_hcap_eq2_plus05", label: "Eq2 +0.5", code: "eq1_gagne" },
      ],
    },
    {
      title: "Handicap equipe 2 -1.5",
      key: "handicap_eq2_minus15",
      options: [
        { id: "cote_hcap_eq2_minus15", label: "Eq2 -1.5", code: "eq2_gagne" },
        { id: "cote_hcap_eq2_plus15", label: "Eq2 +1.5", code: "eq1_gagne" },
      ],
    },
    {
      title: "Buts equipe 1 0.5",
      key: "eq1_buts_over_05",
      options: [
        { id: "cote_eq1_over_05", label: "Over 0.5", code: "over" },
        { id: "cote_eq1_under_05", label: "Under 0.5", code: "under" },
      ],
    },
    {
      title: "Buts equipe 1 1.5",
      key: "eq1_buts_over_15",
      options: [
        { id: "cote_eq1_over_15", label: "Over 1.5", code: "over" },
        { id: "cote_eq1_under_15", label: "Under 1.5", code: "under" },
      ],
    },
    {
      title: "Buts equipe 1 2.5",
      key: "eq1_buts_over_25",
      options: [
        { id: "cote_eq1_over_25", label: "Over 2.5", code: "over" },
        { id: "cote_eq1_under_25", label: "Under 2.5", code: "under" },
      ],
    },
    {
      title: "Buts equipe 2 0.5",
      key: "eq2_buts_over_05",
      options: [
        { id: "cote_eq2_over_05", label: "Over 0.5", code: "over" },
        { id: "cote_eq2_under_05", label: "Under 0.5", code: "under" },
      ],
    },
    {
      title: "Buts equipe 2 1.5",
      key: "eq2_buts_over_15",
      options: [
        { id: "cote_eq2_over_15", label: "Over 1.5", code: "over" },
        { id: "cote_eq2_under_15", label: "Under 1.5", code: "under" },
      ],
    },
    {
      title: "Buts equipe 2 2.5",
      key: "eq2_buts_over_25",
      options: [
        { id: "cote_eq2_over_25", label: "Over 2.5", code: "over" },
        { id: "cote_eq2_under_25", label: "Under 2.5", code: "under" },
      ],
    },
    {
      title: "Mi-temps",
      key: "mi_temps",
      options: [
        { id: "cote_mt_eq1", label: "Eq1 MT", code: "eq1_gagne" },
        { id: "cote_mt_nul", label: "Nul MT", code: "nul" },
        { id: "cote_mt_eq2", label: "Eq2 MT", code: "eq2_gagne" },
      ],
    },
    {
      title: "Mi-temps / Final",
      key: "mt_ft",
      options: [
        { id: "cote_mt_ft_1_1", label: "1/1", code: "1_1" },
        { id: "cote_mt_ft_1_X", label: "1/X", code: "1_X" },
        { id: "cote_mt_ft_1_2", label: "1/2", code: "1_2" },
        { id: "cote_mt_ft_X_1", label: "X/1", code: "X_1" },
        { id: "cote_mt_ft_X_X", label: "X/X", code: "X_X" },
        { id: "cote_mt_ft_X_2", label: "X/2", code: "X_2" },
        { id: "cote_mt_ft_2_1", label: "2/1", code: "2_1" },
        { id: "cote_mt_ft_2_X", label: "2/X", code: "2_X" },
        { id: "cote_mt_ft_2_2", label: "2/2", code: "2_2" },
      ],
    },
    {
      title: "Score exact",
      key: "score_exact",
      options: SCORES.map((item) => ({
        id: `cote_score_exact_${item.score}`,
        label: item.score,
        code: item.score,
      })),
    },
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInput(option) {
    const value = EXAMPLE_INPUTS[option.id];
    const defaultValue = value != null ? ` value="${escapeHtml(value)}"` : "";
    return `
      <div class="algo-field">
        <label for="${option.id}">${escapeHtml(option.label)}</label>
        <input id="${option.id}" name="${option.id}" type="number" min="0" step="0.01" placeholder="0.00"${defaultValue} />
      </div>
    `;
  }

  function renderGroup(group) {
    return `
      <details class="algo-group"${group.open ? " open" : ""}>
        <summary>${escapeHtml(group.title)}</summary>
        <div class="algo-grid">
          ${group.options.map(renderInput).join("")}
        </div>
      </details>
    `;
  }

  function readOdd(values, key) {
    const raw = values.get(key);
    const odd = Number(raw);
    return Number.isFinite(odd) && odd > 0 ? odd : null;
  }

  function calculPoids(cote) {
    if (!Number.isFinite(cote) || cote <= 0) return 0;
    return 1 / cote;
  }

  function pickFavorite(group, values) {
    const candidates = group.options
      .map((option, index) => ({
        ...option,
        odd: readOdd(values, option.id),
        index,
      }))
      .filter((item) => item.odd != null);

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.odd - b.odd || a.index - b.index);
    const favorite = candidates[0];

    return {
      key: group.key,
      title: group.title,
      favoriteCode: favorite.code,
      favoriteLabel: favorite.label,
      favoriteOdd: favorite.odd,
      weight: calculPoids(favorite.odd),
      options: candidates,
    };
  }

  function compatibilite(score, marketKey, favori) {
    if (!favori) return 0;

    switch (marketKey) {
      case "1x2":
        if (favori === "eq1_gagne") return score.g1 > score.g2 ? 1 : -1;
        if (favori === "nul") return score.g1 === score.g2 ? 1 : -1;
        if (favori === "eq2_gagne") return score.g2 > score.g1 ? 1 : -1;
        break;
      case "double_chance":
        if (favori === "1X") return score.g1 >= score.g2 ? 1 : -1;
        if (favori === "12") return score.g1 !== score.g2 ? 1 : -1;
        if (favori === "X2") return score.g2 >= score.g1 ? 1 : -1;
        break;
      case "over_under_05":
        if (favori === "over") return score.total > 0 ? 1 : -1;
        if (favori === "under") return score.total === 0 ? 1 : -1;
        break;
      case "over_under_15":
        if (favori === "over") return score.total > 1 ? 1 : -1;
        if (favori === "under") return score.total <= 1 ? 1 : -1;
        break;
      case "over_under_25":
        if (favori === "over") return score.total > 2 ? 1 : -1;
        if (favori === "under") return score.total <= 2 ? 1 : -1;
        break;
      case "over_under_35":
        if (favori === "over") return score.total > 3 ? 1 : -1;
        if (favori === "under") return score.total <= 3 ? 1 : -1;
        break;
      case "over_under_45":
        if (favori === "over") return score.total > 4 ? 1 : -1;
        if (favori === "under") return score.total <= 4 ? 1 : -1;
        break;
      case "btts":
        if (favori === "oui") return score.g1 > 0 && score.g2 > 0 ? 1 : -1;
        if (favori === "non") return score.g1 === 0 || score.g2 === 0 ? 1 : -1;
        break;
      case "handicap_eq1_minus05":
        if (favori === "eq1_gagne") return score.g1 > score.g2 ? 1 : -1;
        if (favori === "eq2_gagne") return score.g1 <= score.g2 ? 1 : -1;
        break;
      case "handicap_eq1_minus15":
        if (favori === "eq1_gagne") return score.g1 >= score.g2 + 2 ? 1 : -1;
        if (favori === "eq2_gagne") return score.g1 < score.g2 + 2 ? 1 : -1;
        break;
      case "handicap_eq2_minus05":
        if (favori === "eq2_gagne") return score.g2 > score.g1 ? 1 : -1;
        if (favori === "eq1_gagne") return score.g2 <= score.g1 ? 1 : -1;
        break;
      case "handicap_eq2_minus15":
        if (favori === "eq2_gagne") return score.g2 >= score.g1 + 2 ? 1 : -1;
        if (favori === "eq1_gagne") return score.g2 < score.g1 + 2 ? 1 : -1;
        break;
      case "eq1_buts_over_05":
        if (favori === "over") return score.g1 >= 1 ? 1 : -1;
        if (favori === "under") return score.g1 === 0 ? 1 : -1;
        break;
      case "eq1_buts_over_15":
        if (favori === "over") return score.g1 >= 2 ? 1 : -1;
        if (favori === "under") return score.g1 <= 1 ? 1 : -1;
        break;
      case "eq1_buts_over_25":
        if (favori === "over") return score.g1 >= 3 ? 1 : -1;
        if (favori === "under") return score.g1 <= 2 ? 1 : -1;
        break;
      case "eq2_buts_over_05":
        if (favori === "over") return score.g2 >= 1 ? 1 : -1;
        if (favori === "under") return score.g2 === 0 ? 1 : -1;
        break;
      case "eq2_buts_over_15":
        if (favori === "over") return score.g2 >= 2 ? 1 : -1;
        if (favori === "under") return score.g2 <= 1 ? 1 : -1;
        break;
      case "eq2_buts_over_25":
        if (favori === "over") return score.g2 >= 3 ? 1 : -1;
        if (favori === "under") return score.g2 <= 2 ? 1 : -1;
        break;
      case "mi_temps":
        if (favori === "eq1_gagne") return score.g1 > score.g2 ? 1 : -1;
        if (favori === "nul") return score.g1 === score.g2 ? 1 : -1;
        if (favori === "eq2_gagne") return score.g2 > score.g1 ? 1 : -1;
        break;
      case "mt_ft": {
        const [, ft] = String(favori).split("_");
        if (ft === "1") return score.g1 > score.g2 ? 1 : -1;
        if (ft === "X") return score.g1 === score.g2 ? 1 : -1;
        if (ft === "2") return score.g2 > score.g1 ? 1 : -1;
        break;
      }
      case "score_exact":
        return favori === score.score ? 1 : -1;
      default:
        break;
    }

    return 0;
  }

  function predictScore(values) {
    const markets = MARKET_GROUPS.map((group) => pickFavorite(group, values)).filter(Boolean);
    const results = [];

    for (const score of SCORES) {
      let votesPour = 0;
      let votesContre = 0;
      let scorePondere = 0;
      const detail = [];

      for (const market of markets) {
        const vote = compatibilite(score, market.key, market.favoriteCode);
        if (vote === 1) {
          votesPour += 1;
          scorePondere += market.weight;
          detail.push({
            marche: market.title,
            favori: market.favoriteLabel,
            cote: market.favoriteOdd,
            vote: "coherent",
            poids: market.weight,
          });
        } else if (vote === -1) {
          votesContre += 1;
          scorePondere -= market.weight;
          detail.push({
            marche: market.title,
            favori: market.favoriteLabel,
            cote: market.favoriteOdd,
            vote: "contradictory",
            poids: market.weight,
          });
        }
      }

      results.push({
        score: score.score,
        votes_pour: votesPour,
        votes_contre: votesContre,
        ecart: votesPour - votesContre,
        score_pondere: Number(scorePondere.toFixed(6)),
        detail,
      });
    }

    results.sort((a, b) => b.score_pondere - a.score_pondere || b.votes_pour - a.votes_pour || a.votes_contre - b.votes_contre);
    return results;
  }

  function calculConfiance(results) {
    if (!results.length) {
      return { confiance: 0, niveau: "SIGNAL FAIBLE" };
    }

    const meilleur = results[0].score_pondere;
    const sommeTotale = results.reduce((acc, item) => acc + Math.abs(item.score_pondere), 0);

    if (sommeTotale === 0) {
      return { confiance: 0, niveau: "SIGNAL FAIBLE" };
    }

    const confiance = Math.max(0, (meilleur / sommeTotale) * 100);

    let niveau = "SIGNAL FAIBLE";
    if (confiance >= 75) niveau = "SIGNAL TRES FORT";
    else if (confiance >= 60) niveau = "SIGNAL FORT";
    else if (confiance >= 40) niveau = "SIGNAL MODERE";

    return {
      confiance: Number(confiance.toFixed(1)),
      niveau,
    };
  }

  function renderResults(results) {
    const top3 = results.slice(0, 3);
    const confidence = calculConfiance(results);

    return `
      <div class="algo-result-card">
        <div class="algo-result-head">
          <div>
            <div class="algo-result-score">${escapeHtml(top3[0]?.score || "Aucun score")}</div>
            <div class="algo-result-meta">
              Top 3: ${escapeHtml(top3.map((item) => item.score).join(" | ") || "-")}
            </div>
          </div>
          <div class="algo-confidence">${escapeHtml(confidence.niveau)} | ${confidence.confiance.toFixed(1)}%</div>
        </div>
        <div class="algo-detail">
          <div class="algo-result-meta">
            Votes du leader: ${top3[0]?.votes_pour || 0} pour, ${top3[0]?.votes_contre || 0} contre, ecart ${top3[0]?.ecart || 0},
            score pondere ${top3[0]?.score_pondere?.toFixed(3) || "0.000"}
          </div>
          <div class="grid">
            ${top3
              .map(
                (item, index) => `
                  <article class="mini">
                    <h3>Score ${index + 1}</h3>
                    <p><strong>${escapeHtml(item.score)}</strong></p>
                    <p>Votes: ${item.votes_pour} pour / ${item.votes_contre} contre</p>
                    <p>Ecart: ${item.ecart}</p>
                    <p>Score pondere: ${item.score_pondere.toFixed(3)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
          <div>
            <strong>Details du score leader</strong>
            <ul>
              ${(top3[0]?.detail || [])
                .map(
                  (item) =>
                    `<li>${escapeHtml(item.marche)} -> ${escapeHtml(item.favori)} @ ${Number(item.cote).toFixed(2)} : ${escapeHtml(item.vote)} (${item.poids.toFixed(3)})</li>`
                )
                .join("") || "<li>Aucun marche actif</li>"}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  function renderForm() {
    mount.innerHTML = `
      <div class="algo-shell">
        <div class="algo-summary">
          <p>
            Renseigne uniquement les marches disponibles. Les marches absents restent ignores automatiquement.
            Le score exact est traite comme un marche separe avec le score candidat le moins cote comme favori.
          </p>
          <div class="algo-actions">
            <button type="button" class="algo-button" id="algoFillDemo">Charger l'exemple</button>
            <button type="button" class="algo-button secondary" id="algoReset">Reinitialiser</button>
            <button type="submit" class="algo-button secondary">Calculer</button>
          </div>
        </div>
        <form class="algo-form" id="algoForm">
          ${MARKET_GROUPS.map(renderGroup).join("")}
        </form>
        <div class="algo-results" id="algoResults" aria-live="polite"></div>
      </div>
    `;
  }

  function fillExample(form) {
    for (const [key, value] of Object.entries(EXAMPLE_INPUTS)) {
      const field = form.elements.namedItem(key);
      if (field) field.value = value;
    }
  }

  function clearForm(form) {
    for (const element of Array.from(form.elements)) {
      if (!element.name) continue;
      element.value = "";
    }
  }

  renderForm();

  const form = mount.querySelector("#algoForm");
  const resultsBox = mount.querySelector("#algoResults");
  const fillBtn = mount.querySelector("#algoFillDemo");
  const resetBtn = mount.querySelector("#algoReset");

  function updateResults() {
    const values = new FormData(form);
    const results = predictScore(values);
    resultsBox.innerHTML = renderResults(results);
  }

  function debounce(fn, delay = 120) {
    let timerId = null;
    const debounced = (...args) => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        timerId = null;
        fn(...args);
      }, delay);
    };
    debounced.cancel = () => {
      if (timerId) clearTimeout(timerId);
      timerId = null;
    };
    return debounced;
  }

  const scheduleResultsUpdate = debounce(updateResults, 150);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    scheduleResultsUpdate.cancel();
    updateResults();
  });

  form.addEventListener("input", scheduleResultsUpdate);

  fillBtn.addEventListener("click", () => {
    scheduleResultsUpdate.cancel();
    fillExample(form);
    updateResults();
  });

  resetBtn.addEventListener("click", () => {
    scheduleResultsUpdate.cancel();
    clearForm(form);
    updateResults();
  });

  window.FifaVirtualConvergence = {
    SCORES,
    predictScore,
    calculConfiance,
  };

  updateResults();
})();
