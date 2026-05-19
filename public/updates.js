const updatesFeed = document.getElementById("updatesFeed");
const updatesStats = document.getElementById("updatesStats");
const updatesCount = document.getElementById("updatesCount");
const updatesStatus = document.getElementById("updatesStatus");
const latestUpdateCard = document.getElementById("latestUpdateCard");
const updateForm = document.getElementById("updateForm");
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

function renderStats(items = []) {
  const total = items.length;
  const latest = items[0] || null;
  const pinned = items.filter((item) => item.pinned).length;
  const categories = new Set(items.map((item) => item.category).filter(Boolean)).size;

  updatesStats.innerHTML = `
    <article class="update-stat">
      <span>Total</span>
      <strong>${total}</strong>
      <em>Entrees dans l'historique</em>
    </article>
    <article class="update-stat">
      <span>Derniere version</span>
      <strong>${latest ? escapeHtml(latest.version || latest.title) : "-"}</strong>
      <em>${latest ? escapeHtml(formatDate(latest.createdAt)) : "Aucune publication"}</em>
    </article>
    <article class="update-stat">
      <span>En avant</span>
      <strong>${pinned}</strong>
      <em>Versions marquees importantes</em>
    </article>
    <article class="update-stat">
      <span>Categorie</span>
      <strong>${categories}</strong>
      <em>Axes de changement differents</em>
    </article>
  `;
}

function renderLatestUpdate(update) {
  if (!latestUpdateCard) return;
  if (!update) {
    latestUpdateCard.innerHTML = '<p class="latest-update-empty">Aucune mise a jour enregistree pour le moment.</p>';
    return;
  }

  latestUpdateCard.innerHTML = renderUpdateCard(update, true);
}

function renderUpdateCard(update, featured = false) {
  const highlights = Array.isArray(update.highlights) ? update.highlights : [];
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
    updatesFeed.innerHTML = '<p class="update-empty">Aucune mise a jour n\'a encore ete publiee.</p>';
    if (updatesCount) updatesCount.textContent = "0 entree";
    return;
  }

  updatesFeed.innerHTML = items.map((item) => renderUpdateCard(item)).join("");
  if (updatesCount) {
    updatesCount.textContent = `${items.length} entree${items.length > 1 ? "s" : ""}`;
  }
}

async function loadUpdates() {
  updateStatus("Chargement de l'historique...", "neutral");
  refreshUpdatesBtn.disabled = true;

  try {
    const response = await fetch("/api/updates?limit=50");
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    renderStats(items);
    renderLatestUpdate(items[0] || null);
    renderFeed(items);
    updateStatus(items.length ? "Historique synchronise." : "Aucune mise a jour enregistree pour l'instant.", "success");
  } catch (error) {
    renderStats([]);
    renderLatestUpdate(null);
    renderFeed([]);
    updateStatus(`Impossible de charger l'historique: ${error.message}`, "error");
  } finally {
    refreshUpdatesBtn.disabled = false;
  }
}

function readFormPayload(form) {
  const formData = new FormData(form);
  return {
    version: String(formData.get("version") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    summary: String(formData.get("summary") || "").trim(),
    details: String(formData.get("details") || "").trim(),
    highlights: splitHighlights(formData.get("highlights")),
    category: String(formData.get("category") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    pinned: formData.get("pinned") === "on",
  };
}

async function submitUpdate(event) {
  event.preventDefault();
  if (!updateForm) return;

  const payload = readFormPayload(updateForm);
  if (!payload.title) {
    updateStatus("Le titre est obligatoire.", "error");
    return;
  }

  updateStatus("Enregistrement en cours...", "neutral");
  const submitButton = updateForm.querySelector('button[type="submit"]');
  if (submitButton instanceof HTMLButtonElement) submitButton.disabled = true;

  try {
    const response = await fetch("/api/updates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok || result?.success === false) {
      throw new Error(result?.error?.message || result?.message || "Echec de l'enregistrement.");
    }

    updateForm.reset();
    const authorField = updateForm.querySelector('input[name="author"]');
    if (authorField instanceof HTMLInputElement) {
      authorField.value = "SOLITAIRE HACK";
    }

    updateStatus(result?.message || "Mise a jour enregistree.", "success");
    await loadUpdates();
  } catch (error) {
    updateStatus(`Impossible d'enregistrer la mise a jour: ${error.message}`, "error");
  } finally {
    if (submitButton instanceof HTMLButtonElement) submitButton.disabled = false;
  }
}

refreshUpdatesBtn?.addEventListener("click", () => {
  loadUpdates().catch(() => null);
});

updateForm?.addEventListener("submit", submitUpdate);

loadUpdates().catch((error) => {
  updateStatus(`Erreur au chargement initial: ${error.message}`, "error");
});
