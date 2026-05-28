const GENERATED_MEDIA_LIMIT = 200;
let generatedMediaFilter = "all";
let selectedMediaIds = new Set();

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function normalizeMediaHref(page = "") {
  const normalized = String(page || "").trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("http")) return normalized;
  return `/${normalized}`;
}

function getMediaKind(item = {}) {
  const kind = String(item?.kind || item?.type || "").toLowerCase();
  const fileName = String(item?.fileName || item?.file_name || "").toLowerCase();
  if (kind === "pdf" || fileName.endsWith(".pdf")) return "pdf";
  if (kind === "image" || /\.(png|jpg|jpeg|gif|webp|svg)$/.test(fileName)) return "image";
  return "image";
}

function canRegenerateMedia(item = {}) {
  const action = String(item?.action || "").toLowerCase();
  const hasAsset = Boolean(item?.asset && typeof item.asset === "object");
  if (!hasAsset) return false;
  return ["download_coupon_image", "send_telegram_image", "send_telegram_pack_image", "download_match_image"].includes(action);
}

function getMediaRenderRequest(item = {}) {
  const action = String(item?.action || "").toLowerCase();
  const asset = item?.asset && typeof item.asset === "object" ? item.asset : null;
  if (!asset) return null;
  if (action === "download_match_image") {
    return { endpoint: "/api/match/image", payload: { match: asset?.match || asset, format: "png" }, fallback: "match.png" };
  }
  if (["download_coupon_image", "send_telegram_image", "send_telegram_pack_image"].includes(action)) {
    return { endpoint: "/api/coupon/image", payload: { ...asset, format: "png" }, fallback: "coupon.png" };
  }
  return null;
}

function buildMediaThumbnailDataUri(item = {}) {
  const kind = getMediaKind(item);
  const text = kind === "pdf" ? "PDF" : "IMG";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#1e293b" rx="8"/><text x="50" y="56" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="sans-serif">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mediaMatchesFilter(item = {}, filter = "all") {
  const kind = getMediaKind(item);
  return filter === "all" || kind === filter;
}

function renderGeneratedMediaFilters(items = []) {
  const counts = items.reduce((acc, item) => {
    const kind = getMediaKind(item);
    acc.all += 1;
    acc[kind] += 1;
    return acc;
  }, { all: 0, image: 0, pdf: 0 });

  return `
    <div class="generated-media-toolbar">
      <div class="generated-media-filter-group" role="tablist" aria-label="Filtrer les medias">
        ${[["all", "Tous", counts.all], ["image", "Images", counts.image], ["pdf", "PDF", counts.pdf]].map(([value, label, count]) => `
          <button type="button" class="generated-media-filter ${generatedMediaFilter === value ? "active" : ""}" data-media-filter="${value}">
            <span>${label}</span><strong>${count}</strong>
          </button>
        `).join("")}
      </div>
      <div class="generated-media-actions-group">
        <button type="button" id="selectAllMedia">${selectedMediaIds.size ? "Deselectionner tout" : "Selectionner tout"}</button>
        <button type="button" id="deleteSelectedMedia" ${selectedMediaIds.size ? "" : "disabled"}>Supprimer (${selectedMediaIds.size})</button>
        <button type="button" id="deleteAllMedia">Supprimer tout</button>
      </div>
    </div>
  `;
}

function renderGeneratedMediaCards(items = []) {
  return items.map((item, index) => {
    const href = normalizeMediaHref(item?.page || "");
    const kind = getMediaKind(item);
    const title = String(item?.label || item?.action || "Media");
    const createdAt = item?.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR") : "Date inconnue";
    const thumb = buildMediaThumbnailDataUri(item);
    const canDownload = canRegenerateMedia(item);
    const isSelected = selectedMediaIds.has(item.id);
    return `
      <article class="generated-media-card ${isSelected ? "selected" : ""}">
        <input type="checkbox" class="media-select-checkbox" data-media-id="${item.id}" ${isSelected ? "checked" : ""} />
        <div class="generated-media-thumb" role="button" tabindex="0" data-media-view="${index}">
          <img src="${thumb}" alt="Miniature ${escapeHtml(title)}" />
        </div>
        <div class="generated-media-card-body">
          <strong>${escapeHtml(title)}</strong>
          <div>${escapeHtml(createdAt)} | ${escapeHtml(kind.toUpperCase())}</div>
          <div class="generated-media-actions">
            <button type="button" data-media-view="${index}">Apercu</button>
            ${canDownload ? `<button type="button" data-media-download="${index}">Telecharger</button>` : (href ? `<a href="${href}">Ouvrir source</a>` : `<span>Archive</span>`)}
            <button type="button" data-media-delete="${item.id}">Supprimer</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function ensureGeneratedMediaLightbox() {
  let lightbox = document.getElementById("generatedMediaLightbox");
  if (lightbox) return lightbox;
  lightbox = document.createElement("div");
  lightbox.id = "generatedMediaLightbox";
  lightbox.className = "generated-media-lightbox hidden";
  lightbox.innerHTML = `<div class="generated-media-lightbox-backdrop"></div><div class="generated-media-lightbox-panel"><button type="button" class="generated-media-lightbox-close">X</button><div class="generated-media-lightbox-preview"></div></div>`;
  document.body.appendChild(lightbox);
  const close = () => {
    if (lightbox.dataset.blobUrl) {
      URL.revokeObjectURL(lightbox.dataset.blobUrl);
      delete lightbox.dataset.blobUrl;
    }
    lightbox.classList.add("hidden");
  };
  lightbox.querySelector(".generated-media-lightbox-close").addEventListener("click", close);
  lightbox.querySelector(".generated-media-lightbox-backdrop").addEventListener("click", close);
  return lightbox;
}

async function openGeneratedMediaLightbox(item = {}) {
  const lightbox = ensureGeneratedMediaLightbox();
  const preview = lightbox.querySelector(".generated-media-lightbox-preview");
  const kind = getMediaKind(item);
  if (kind === "pdf") {
    preview.innerHTML = `<div>PDF: ${escapeHtml(String(item?.fileName || "fichier.pdf"))}</div>`;
  } else {
    const request = getMediaRenderRequest(item);
    if (!request) {
      preview.innerHTML = `<div>Image non disponible pour cet element.</div>`;
    } else {
      preview.innerHTML = `<div>Chargement...</div>`;
      try {
        const response = await fetch(request.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request.payload),
        });
        if (!response.ok) {
          preview.innerHTML = `<div>Impossible de charger l'image.</div>`;
        } else {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          lightbox.dataset.blobUrl = url;
          preview.innerHTML = `<img src="${url}" alt="Apercu media" />`;
        }
      } catch {
        preview.innerHTML = `<div>Erreur de chargement.</div>`;
      }
    }
  }
  lightbox.classList.remove("hidden");
}

function loadGeneratedMediaFilter() {
  try { return localStorage.getItem("generatedMediaFilter") || "all"; } catch { return "all"; }
}
function saveGeneratedMediaFilter(filter) {
  try { localStorage.setItem("generatedMediaFilter", filter); } catch {}
}

async function renderGeneratedMediaPanel() {
  const host = document.getElementById("generatedMediaPanel");
  if (!host) return;
  generatedMediaFilter = loadGeneratedMediaFilter();

  try {
    const res = await fetch(`/api/media/history?limit=${GENERATED_MEDIA_LIMIT}`, { cache: "no-store" });
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const mediaItems = items.filter((item) => mediaMatchesFilter(item, generatedMediaFilter));
    window.__generatedMediaItems = mediaItems;

    host.innerHTML = `
      <div class="generated-media-shell">
        ${renderGeneratedMediaFilters(items)}
        <div class="generated-media-grid">${renderGeneratedMediaCards(mediaItems)}</div>
      </div>
    `;

    host.querySelectorAll("[data-media-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        generatedMediaFilter = String(button.getAttribute("data-media-filter") || "all");
        saveGeneratedMediaFilter(generatedMediaFilter);
        renderGeneratedMediaPanel();
      });
    });

    document.getElementById("selectAllMedia")?.addEventListener("click", () => {
      if (selectedMediaIds.size === mediaItems.length) selectedMediaIds.clear();
      else mediaItems.forEach((item) => selectedMediaIds.add(item.id));
      renderGeneratedMediaPanel();
    });

    document.getElementById("deleteSelectedMedia")?.addEventListener("click", async () => {
      if (!selectedMediaIds.size) return;
      if (!confirm(`Supprimer ${selectedMediaIds.size} media(s) ?`)) return;
      const response = await fetch("/api/media/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedMediaIds) }),
      });
      const result = await response.json();
      if (result.success) {
        selectedMediaIds.clear();
        renderGeneratedMediaPanel();
      } else {
        alert("Suppression impossible.");
      }
    });

    document.getElementById("deleteAllMedia")?.addEventListener("click", async () => {
      if (!items.length) return;
      if (!confirm(`Supprimer tous les ${items.length} medias ?`)) return;
      const response = await fetch("/api/media/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: items.map((item) => item.id) }),
      });
      const result = await response.json();
      if (result.success) {
        selectedMediaIds.clear();
        renderGeneratedMediaPanel();
      } else {
        alert("Suppression impossible.");
      }
    });

    host.querySelectorAll(".media-select-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const mediaId = Number(e.target.getAttribute("data-media-id"));
        if (e.target.checked) selectedMediaIds.add(mediaId);
        else selectedMediaIds.delete(mediaId);
      });
    });

    host.querySelectorAll("[data-media-delete]").forEach((button) => {
      button.addEventListener("click", async () => {
        const mediaId = Number(button.getAttribute("data-media-delete"));
        if (!confirm("Supprimer ce media ?")) return;
        const response = await fetch(`/api/media/history/${mediaId}`, { method: "DELETE" });
        const result = await response.json();
        if (result.success) {
          selectedMediaIds.delete(mediaId);
          renderGeneratedMediaPanel();
        } else {
          alert("Suppression impossible.");
        }
      });
    });

    host.querySelectorAll("[data-media-view]").forEach((button) => {
      const open = () => {
        const index = Number(button.getAttribute("data-media-view"));
        const item = Array.isArray(window.__generatedMediaItems) ? window.__generatedMediaItems[index] : null;
        if (item) openGeneratedMediaLightbox(item);
      };
      button.addEventListener("click", open);
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    host.querySelectorAll("[data-media-download]").forEach((button) => {
      button.addEventListener("click", async () => {
        const index = Number(button.getAttribute("data-media-download"));
        const item = Array.isArray(window.__generatedMediaItems) ? window.__generatedMediaItems[index] : null;
        const request = getMediaRenderRequest(item || {});
        if (!request) return;
        try {
          const response = await fetch(request.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request.payload),
          });
          if (!response.ok) {
            alert("Telechargement impossible.");
            return;
          }
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = item?.fileName || request.fallback;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch {
          alert("Erreur de telechargement.");
        }
      });
    });
  } catch {
    host.innerHTML = `<div class="generated-media-shell"><p>Archive media indisponible.</p></div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderGeneratedMediaPanel();
});

window.addEventListener("fc25:generated-media", () => {
  if (document.getElementById("generatedMediaPanel")) renderGeneratedMediaPanel();
});

Object.defineProperty(window, "GeneratedMediaPanel", {
  configurable: false,
  enumerable: true,
  writable: false,
  value: { refresh: renderGeneratedMediaPanel },
});
