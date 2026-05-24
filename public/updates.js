const updatesFeed = document.getElementById("updatesFeed");
const updatesStats = document.getElementById("updatesStats");
const updatesCount = document.getElementById("updatesCount");
const updatesStatus = document.getElementById("updatesStatus");
const latestUpdateCard = document.getElementById("latestUpdateCard");
const refreshUpdatesBtn = document.getElementById("refreshUpdatesBtn");

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return dateFormatter.format(date);
}

function splitHighlights(value) {
  if (!value) return [];
  return String(value)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function updateStatus(message, tone = "neutral") {
  if (!updatesStatus) return;
  updatesStatus.textContent = message || "";
  updatesStatus.dataset.tone = tone;
}

function summarizeItems(items = []) {
  const total = items.length;
  const latest = items[0] || null;
  const pinned = items.filter((item) => item.pinned).length;
  const categories = new Set(items.map((item) => item.category).filter(Boolean)).size;
  const lastCategory = latest?.category || "Vision produit";
  return {
    total,
    latest,
    pinned,
    categories,
    lastCategory,
  };
}

function renderStats(items = []) {
  const summary = summarizeItems(items);

  updatesStats.innerHTML = `
    <article class="update-stat">
      <span>Chronologie</span>
      <strong>${summary.total}</strong>
      <em>Versions conservees depuis le lancement</em>
    </article>
    <article class="update-stat">
      <span>Derniere version</span>
      <strong>${summary.latest ? escapeHtml(summary.latest.version || summary.latest.title) : "-"}</strong>
      <em>${summary.latest ? escapeHtml(formatDate(summary.latest.createdAt)) : "Aucune publication"}</em>
    </article>
    <article class="update-stat">
      <span>Signal fort</span>
      <strong>${summary.pinned}</strong>
      <em>Mises en avant qui definissent la direction du site</em>
    </article>
    <article class="update-stat">
      <span>Angles couverts</span>
      <strong>${summary.categories}</strong>
      <em>${escapeHtml(summary.lastCategory)} comme derniere couleur editoriale</em>
    </article>
  `;
}

function renderLatestUpdate(update) {
  if (!latestUpdateCard) return;
  if (!update) {
    latestUpdateCard.innerHTML = `
      <div class="empty-callout">
        <p class="latest-update-empty">Aucune mise a jour enregistree pour le moment.</p>
        <p class="latest-update-empty">Ajoute une premiere version pour faire vivre le journal produit.</p>
      </div>
    `;
    return;
  }

  latestUpdateCard.innerHTML = renderUpdateCard(update, true);
}

function renderUpdateCard(update, featured = false) {
  const highlights = Array.isArray(update.highlights) ? update.highlights : splitHighlights(update.highlights);
  const highlightList = highlights.length
    ? `<ul class="update-highlights">${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const category = update.category ? `<span class="update-chip is-soft">${escapeHtml(update.category)}</span>` : "";
  const pinned = update.pinned ? '<span class="update-chip">En avant</span>' : "";
  const version = update.version ? `<span class="update-chip">${escapeHtml(update.version)}</span>` : "";

  return `
    <article class="update-card${featured ? " is-pinned" : ""}">
      <div class="update-card-head">
        <div>
          <h3 class="update-card-title">${escapeHtml(update.title)}</h3>
          <p class="update-card-summary">${escapeHtml(update.summary || "")}</p>
        </div>
        <div class="update-card-meta">
          ${version}
          ${category}
          ${pinned}
        </div>
      </div>
      <div class="update-card-meta">
        <span>${escapeHtml(update.author || "Equipe produit")}</span>
        <span>${escapeHtml(formatDate(update.createdAt))}</span>
      </div>
      ${update.details ? `<p class="update-card-summary">${escapeHtml(update.details)}</p>` : ""}
      ${highlightList}
    </article>
  `;
}

function renderFeed(items = []) {
  if (!updatesFeed) return;
  if (!items.length) {
    updatesFeed.innerHTML = `
      <article class="update-card update-card-empty">
        <p class="update-empty">Aucune mise a jour n'a encore ete publiee.</p>
      </article>
    `;
    if (updatesCount) updatesCount.textContent = "0 entree";
    return;
  }

  updatesFeed.innerHTML = items.map((item) => renderUpdateCard(item)).join("");
  if (updatesCount) {
    updatesCount.textContent = `${items.length} entree${items.length > 1 ? "s" : ""}`;
  }
}

async function loadUpdates() {
  updateStatus("Chargement de l'historique editorial...", "neutral");
  refreshUpdatesBtn.disabled = true;

  try {
    const response = await fetch("/api/updates?limit=50");
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    renderStats(items);
    renderLatestUpdate(items[0] || null);
    renderFeed(items);
    updateStatus(items.length ? "Journal produit synchronise." : "Le journal est vide pour l'instant.", "success");
  } catch (error) {
    renderStats([]);
    renderLatestUpdate(null);
    renderFeed([]);
    updateStatus(`Impossible de charger l'historique: ${error.message}`, "error");
  } finally {
    refreshUpdatesBtn.disabled = false;
  }
}

refreshUpdatesBtn?.addEventListener("click", () => {
  loadUpdates().catch(() => null);
});

loadUpdates().catch((error) => {
  updateStatus(`Erreur au chargement initial: ${error.message}`, "error");
});
