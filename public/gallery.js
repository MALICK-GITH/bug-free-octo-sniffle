// Gallery Page - Dedicated page for generated media

const GENERATED_MEDIA_LIMIT = 200;
let generatedMediaFilter = "all";

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
  if (kind === "image" || fileName.match(/\.(png|jpg|jpeg|gif|webp)$/)) return "image";
  return "image";
}

function buildMediaThumbnailDataUri(item = {}) {
  const kind = getMediaKind(item);
  const fileName = String(item?.fileName || item?.file_name || "").trim();
  
  if (kind === "pdf") {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
        <rect width="100" height="100" fill="#1e293b" rx="8"/>
        <path d="M30 25h40v50H30z" fill="#3b82f6" opacity="0.2"/>
        <path d="M35 30h30v40H35z" fill="#3b82f6" opacity="0.4"/>
        <text x="50" y="55" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="sans-serif">PDF</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
      <rect width="100" height="100" fill="#1e293b" rx="8"/>
      <circle cx="50" cy="50" r="20" fill="#3b82f6" opacity="0.3"/>
      <text x="50" y="55" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="sans-serif">IMG</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function mediaMatchesFilter(item = {}, filter = "all") {
  const kind = getMediaKind(item);
  const normalized = String(filter || "all").toLowerCase();
  return normalized === "all" || normalized === kind;
}

function renderGeneratedMediaFilters(items = []) {
  const counts = items.reduce(
    (acc, item) => {
      const kind = getMediaKind(item);
      acc.all += 1;
      acc[kind] += 1;
      return acc;
    },
    { all: 0, image: 0, pdf: 0 }
  );

  return `
    <div class="generated-media-toolbar">
      <div class="generated-media-toolbar-copy">
        <p class="watchlist-kicker">Médias générés</p>
        <h2>Galerie d'exports</h2>
        <p>Miniatures instantanées, filtres rapides et accès direct à la page source pour garder le flux sous contrôle.</p>
      </div>
      <div class="generated-media-filter-group" role="tablist" aria-label="Filtrer les médias générés">
        ${[
          ["all", "Tous", counts.all],
          ["image", "Images", counts.image],
          ["pdf", "PDF", counts.pdf],
        ]
          .map(([value, label, count]) => `
            <button
              type="button"
              class="generated-media-filter ${generatedMediaFilter === value ? "active" : ""}"
              data-media-filter="${value}"
              aria-pressed="${generatedMediaFilter === value ? "true" : "false"}"
            >
              <span>${label}</span>
              <strong>${count}</strong>
            </button>
          `)
          .join("")}
      </div>
    </div>
  `;
}

function renderGeneratedMediaCards(items = []) {
  return items
    .map((item, index) => {
      const href = normalizeMediaHref(item?.page || "");
      const kind = getMediaKind(item);
      const format = String(item?.format || (kind === "pdf" ? "PDF" : "IMG")).toUpperCase();
      const createdAt = item?.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR") : "Date inconnue";
      const title = String(item?.label || item?.action || "Média").trim();
      const action = String(item?.action || kind).trim();
      const source = String(item?.source || "archive").trim();
      const fileName = String(item?.fileName || item?.file_name || "").trim();
      const relatedId = String(item?.relatedId || "").trim();
      const thumb = buildMediaThumbnailDataUri(item);
      const openLabel = href ? "Ouvrir source" : "Archive locale";
      return `
        <article class="generated-media-card" data-media-kind="${kind}" data-media-index="${index}">
          <div class="generated-media-thumb" role="button" tabindex="0" data-media-view="${index}" aria-label="Agrandir ${escapeHtml(title)}">
            <img src="${thumb}" alt="Miniature ${escapeHtml(title)}" loading="lazy" />
            <div class="generated-media-thumb-badge">${escapeHtml(format)}</div>
          </div>
          <div class="generated-media-card-body">
            <div class="watchlist-card-head">
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(action)}</span>
            </div>
            <div class="generated-media-pills">
              <span>${escapeHtml(createdAt)}</span>
              <span>${escapeHtml(source)}</span>
              <span>${escapeHtml(fileName || "sans-fichier")}</span>
            </div>
            <div class="generated-media-meta">
              <span>${escapeHtml(relatedId || "sans-id")}</span>
              <span>${escapeHtml(kind.toUpperCase())}</span>
            </div>
            <div class="generated-media-actions">
              <button type="button" class="generated-media-open generated-media-view-btn" data-media-view="${index}">Aperçu plein écran</button>
              ${href ? `<a class="generated-media-open" href="${href}">${openLabel}</a>` : '<span class="generated-media-open is-static">Archive</span>'}
              <button type="button" class="generated-media-copy" data-media-copy="${escapeHtml(fileName || title)}">Copier titre</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function ensureGeneratedMediaLightbox() {
  let lightbox = document.getElementById("generatedMediaLightbox");
  if (lightbox) return lightbox;

  lightbox = document.createElement("div");
  lightbox.id = "generatedMediaLightbox";
  lightbox.className = "generated-media-lightbox hidden";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="generated-media-lightbox-backdrop"></div>
    <div class="generated-media-lightbox-content">
      <button type="button" class="generated-media-lightbox-close" aria-label="Fermer">×</button>
      <div class="generated-media-lightbox-image"></div>
      <div class="generated-media-lightbox-info"></div>
    </div>
  `;
  document.body.appendChild(lightbox);

  const close = () => {
    lightbox.classList.add("hidden");
    lightbox.setAttribute("aria-hidden", "true");
  };

  lightbox.querySelector(".generated-media-lightbox-close").addEventListener("click", close);
  lightbox.querySelector(".generated-media-lightbox-backdrop").addEventListener("click", close);
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return lightbox;
}

function openGeneratedMediaLightbox(item = {}) {
  const lightbox = ensureGeneratedMediaLightbox();
  const imageContainer = lightbox.querySelector(".generated-media-lightbox-image");
  const infoContainer = lightbox.querySelector(".generated-media-lightbox-info");

  const kind = getMediaKind(item);
  const title = String(item?.label || item?.action || "Média").trim();
  const createdAt = item?.createdAt ? new Date(item.createdAt).toLocaleString("fr-FR") : "Date inconnue";
  const source = String(item?.source || "archive").trim();
  const fileName = String(item?.fileName || item?.file_name || "").trim();

  if (kind === "pdf") {
    imageContainer.innerHTML = `<div class="generated-media-lightbox-placeholder">PDF: ${escapeHtml(fileName)}</div>`;
  } else {
    imageContainer.innerHTML = `<img src="${item?.dataUrl || ""}" alt="${escapeHtml(title)}" />`;
  }

  infoContainer.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(createdAt)}</p>
    <p>${escapeHtml(source)}</p>
    <p>${escapeHtml(fileName)}</p>
  `;

  lightbox.classList.remove("hidden");
  lightbox.setAttribute("aria-hidden", "false");
}

function loadGeneratedMediaFilter() {
  try {
    const stored = localStorage.getItem("generatedMediaFilter");
    if (stored) return stored;
  } catch {}
  return "all";
}

function saveGeneratedMediaFilter(filter) {
  try {
    localStorage.setItem("generatedMediaFilter", filter);
  } catch {}
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

    if (!items.length) {
      host.innerHTML = `
        <div class="generated-media-shell">
          ${renderGeneratedMediaFilters([])}
          <div class="watchlist-shell watchlist-empty generated-media-empty">
            <div>
              <p class="watchlist-kicker">Médias générés</p>
              <h2>Galerie vide pour l'instant</h2>
              <p>Quand une image ou un PDF sera produit depuis coupon, match ou Telegram, il apparaîtra automatiquement ici.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    host.innerHTML = `
      <div class="generated-media-shell">
        ${renderGeneratedMediaFilters(items)}
        <div class="generated-media-hero">
          <div class="generated-media-hero-copy">
            <p class="watchlist-kicker">Bibliothèque temps réel</p>
            <h3>Chaque export est archivé et rendu visible dans un flux premium.</h3>
            <p>Tu retrouves ici les images et PDF produits depuis n'importe quelle page, avec miniatures, filtre, source et accès direct.</p>
          </div>
          <div class="generated-media-hero-stats">
            <span>${items.length} total</span>
            <strong>${mediaItems.length} affiché(s)</strong>
            <small>${generatedMediaFilter === "all" ? "Vue complète" : generatedMediaFilter.toUpperCase()}</small>
          </div>
        </div>
        <div class="generated-media-grid">
          ${renderGeneratedMediaCards(mediaItems)}
        </div>
      </div>
    `;

    host.querySelectorAll("[data-media-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextFilter = String(button.getAttribute("data-media-filter") || "all");
        generatedMediaFilter = nextFilter;
        saveGeneratedMediaFilter(nextFilter);
        renderGeneratedMediaPanel();
      });
    });

    host.querySelectorAll("[data-media-copy]").forEach((button) => {
      button.addEventListener("click", async () => {
        const text = String(button.getAttribute("data-media-copy") || "").trim();
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "Copié";
          setTimeout(() => {
            button.textContent = "Copier titre";
          }, 1100);
        } catch {
          button.textContent = "Erreur copie";
          setTimeout(() => {
            button.textContent = "Copier titre";
          }, 1100);
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
  } catch (_error) {
    host.innerHTML = `
      <div class="generated-media-shell">
        ${renderGeneratedMediaFilters([])}
        <div class="watchlist-shell watchlist-empty generated-media-empty">
          <div>
            <p class="watchlist-kicker">Médias générés</p>
            <h2>Archive indisponible</h2>
            <p>La lecture de l'historique média a échoué, mais la génération continue de fonctionner.</p>
          </div>
        </div>
      </div>
    `;
  }
}

// Initialize gallery on page load
document.addEventListener("DOMContentLoaded", () => {
  renderGeneratedMediaPanel();
});

// Refresh gallery when new media is generated
window.addEventListener("fc25:generated-media", () => {
  if (document.getElementById("generatedMediaPanel")) {
    renderGeneratedMediaPanel();
  }
});

Object.defineProperty(window, "GeneratedMediaPanel", {
  configurable: false,
  enumerable: true,
  writable: false,
  value: {
    refresh: renderGeneratedMediaPanel,
  },
});
