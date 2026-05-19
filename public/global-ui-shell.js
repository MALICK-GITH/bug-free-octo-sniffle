(function () {
  const MOBILE_BREAKPOINT = 760;
  let accountChip = null;
  let fetchWrapped = false;

  function currentPageKey() {
    const path = window.location.pathname || "/";
    if (path === "/" || path.endsWith("/index.html")) return "home";
    if (path.includes("coupon")) return "coupon";
    if (path.includes("match")) return "match";
    if (path.includes("mode-emploi")) return "guide";
    if (path.includes("updates")) return "updates";
    if (path.includes("suivre")) return "follow";
    if (path.includes("auth")) return "auth";
    if (path.includes("admin")) return "admin";
    if (path.includes("about")) return "about";
    if (path.includes("developpeur")) return "dev";
    return "other";
  }

  function buildBottomNav() {
    if (document.querySelector(".global-bottom-nav")) return;
    const page = currentPageKey();
    const items = [
      { key: "home", href: "/", label: "Accueil" },
      { key: "coupon", href: "/coupon.html", label: "Coupon" },
      { key: "guide", href: "/mode-emploi.html", label: "Guide" },
      { key: "updates", href: "/updates.html", label: "Mises a jour" },
      { key: "follow", href: "/suivre.html", label: "Suivi" },
      { key: "auth", href: "/auth.html", label: "Compte" },
      { key: "admin", href: "/admin.html", label: "Admin" },
      { key: "about", href: "/about.html", label: "Studio" },
      { key: "dev", href: "/developpeur.html", label: "Support" },
    ];

    const nav = document.createElement("nav");
    nav.className = "global-bottom-nav";
    nav.setAttribute("aria-label", "Navigation principale");
    nav.innerHTML = items
      .map((item) => {
        const active = item.key === page ? " active" : "";
        return `<a class="global-bottom-link${active}" href="${item.href}"><span>${item.label}</span></a>`;
      })
      .join("");
    document.body.appendChild(nav);
  }

  function buildAccountChip() {
    if (document.querySelector(".global-account-chip")) return;

    const chip = document.createElement("a");
    chip.className = "global-account-chip";
    chip.href = "/auth.html";
    chip.setAttribute("aria-live", "polite");
    chip.innerHTML = `
      <span class="global-account-chip__label">Compte</span>
      <strong class="global-account-chip__title">Connexion</strong>
      <em class="global-account-chip__meta">Quota en lecture...</em>
    `;
    document.body.appendChild(chip);
    accountChip = chip;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (!payload || payload.success === false) throw new Error(payload?.error?.message || "auth");
        const user = payload.authenticated ? payload.user : null;
        const quota = payload.quota || null;
        const planLabel = user?.planKey || "free";
        const remaining = quota?.unlimited ? "illimite" : quota?.remainingToday ?? 0;
        chip.href = user?.role === "admin" ? "/admin.html" : "/auth.html";
        chip.innerHTML = user
          ? `
            <span class="global-account-chip__label">${user.role === "admin" ? "Admin" : "Compte"}</span>
            <strong class="global-account-chip__title">${user.username || user.email || "Profil"}</strong>
            <em class="global-account-chip__meta">${quota?.unlimited ? "Quota illimite" : `${remaining} quota(s) restants`} · ${planLabel}</em>
          `
          : `
            <span class="global-account-chip__label">Compte</span>
            <strong class="global-account-chip__title">Connexion</strong>
            <em class="global-account-chip__meta">Ouvre ton espace et ton quota</em>
          `;
      })
      .catch(() => {
        chip.innerHTML = `
          <span class="global-account-chip__label">Compte</span>
          <strong class="global-account-chip__title">Connexion</strong>
          <em class="global-account-chip__meta">Acces au suivi et au quota</em>
        `;
      });
  }

  function updateAccountChip(payload = {}) {
    if (!accountChip) return;
    const user = payload?.authenticated ? payload.user : null;
    const quota = payload?.quota || null;
    const planLabel = user?.planKey || "free";
    const remaining = quota?.unlimited ? "illimite" : quota?.remainingToday ?? 0;
    accountChip.href = user?.role === "admin" ? "/admin.html" : "/auth.html";
    accountChip.innerHTML = user
      ? `
        <span class="global-account-chip__label">${user.role === "admin" ? "Admin" : "Compte"}</span>
        <strong class="global-account-chip__title">${user.username || user.email || "Profil"}</strong>
        <em class="global-account-chip__meta">${quota?.unlimited ? "Quota illimite" : `${remaining} quota(s) restants`} · ${planLabel}</em>
      `
      : `
        <span class="global-account-chip__label">Compte</span>
        <strong class="global-account-chip__title">Connexion</strong>
        <em class="global-account-chip__meta">Acces au suivi et au quota</em>
      `;
  }

  function installFetchObserver() {
    if (fetchWrapped || typeof window.fetch !== "function") return;
    const originalFetch = window.fetch.bind(window);
    fetchWrapped = true;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const request = args[0];
        const requestUrl = typeof request === "string" ? request : request?.url || "";
        const isAuthRelated =
          requestUrl.includes("/api/auth/me") ||
          requestUrl.includes("/api/auth/login") ||
          requestUrl.includes("/api/auth/register") ||
          requestUrl.includes("/api/auth/logout") ||
          requestUrl.includes("/api/predictions") ||
          requestUrl.includes("/api/coupon") ||
          requestUrl.includes("/api/coupon/generate") ||
          requestUrl.includes("/api/coupon/validate") ||
          requestUrl.includes("/api/matches/") ||
          requestUrl.includes("/api/coupon/ladder") ||
          requestUrl.includes("/api/coupon/multi");

        if (isAuthRelated && response && typeof response.clone === "function") {
          response
            .clone()
            .json()
            .then((payload) => {
              if (requestUrl.includes("/api/auth/logout")) {
                updateAccountChip({ authenticated: false });
                return;
              }
              if (payload && typeof payload === "object" && ("authenticated" in payload || "auth" in payload)) {
                updateAccountChip(payload.auth && typeof payload.auth === "object" ? { authenticated: Boolean(payload.auth?.user), ...payload.auth } : payload);
              }
            })
            .catch(() => null);
        }
      } catch (_error) {}
      return response;
    };
  }

  function disableLegacyBottomBars() {
    const quickBar = document.getElementById("quickMobileBar");
    if (quickBar) {
      quickBar.setAttribute("hidden", "hidden");
      quickBar.setAttribute("aria-hidden", "true");
      quickBar.style.display = "none";
    }
  }

  function markRevealTargets() {
    const selectors = [
      ".hero",
      ".controls",
      ".panel",
      ".match-card",
      ".watchlist-card",
      ".finder-row",
      ".heat-row",
      ".command-card",
      ".command-pick-card",
      ".coupon-quick-card",
      ".hero-metric-card",
      ".guide-highlight",
      ".mini",
      ".portal-card",
    ];

    document.querySelectorAll(selectors.join(",")).forEach((el, index) => {
      if (el.hasAttribute("data-reveal")) return;
      el.setAttribute("data-reveal", "");
      el.style.setProperty("--reveal-delay", `${Math.min(index * 35, 360)}ms`);
    });
  }

  function observeReveals() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
  }

  function enableMobileAccordions() {
    const isMobile = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
    const page = currentPageKey();
    if (!isMobile) return;

    const panelSelectors =
      page === "coupon"
        ? ["#healthPanel", "#alertsPanel", "#multiResult", "#ladderPanel", "#bankrollPanel", "#postTicketPanel", "#historyPanel", "#serverHistoryPanel", "#oddsJournalPanel", "#performancePanel", "#watchlistPanel", "#ticketComparePanel"]
        : page === "match"
        ? ["#coachPanel", ".analytics-panel", ".insight-panel", ".exact-score-panel", "#bots", "#top3", "#markets"]
        : page === "guide"
        ? [".panel"]
        : [];

    if (!panelSelectors.length) return;

    document.querySelectorAll(panelSelectors.join(",")).forEach((panel, index) => {
      if (!(panel instanceof HTMLElement)) return;
      if (panel.dataset.accordionReady === "1") return;
      const title = panel.querySelector("h2, h3");
      if (!title) return;

      panel.dataset.accordionReady = "1";
      panel.classList.add("mobile-accordion");
      const contentNodes = Array.from(panel.children).filter((child) => child !== title);
      if (!contentNodes.length) return;

      const body = document.createElement("div");
      body.className = "mobile-accordion-body";
      contentNodes.forEach((node) => body.appendChild(node));
      panel.appendChild(body);

      title.classList.add("mobile-accordion-trigger");
      title.setAttribute("tabindex", "0");
      title.setAttribute("role", "button");

      const shouldCollapse = page === "guide" ? index > 1 : index > 0;
      if (shouldCollapse) panel.classList.add("is-collapsed");

      const toggle = () => {
        panel.classList.toggle("is-collapsed");
        title.setAttribute("aria-expanded", panel.classList.contains("is-collapsed") ? "false" : "true");
      };

      title.setAttribute("aria-expanded", shouldCollapse ? "false" : "true");
      title.addEventListener("click", toggle);
      title.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle();
      });
    });
  }

  function upgradeThemeSwitcher() {
    const switcher = document.querySelector(".global-theme-switcher");
    if (!switcher) return;
    switcher.classList.add("global-theme-switcher--premium");
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-global.js").catch(() => null);
  }

  function init() {
    document.body.classList.add(`page-${currentPageKey()}`);
    disableLegacyBottomBars();
    buildBottomNav();
    buildAccountChip();
    installFetchObserver();
    registerServiceWorker();
    markRevealTargets();
    observeReveals();
    enableMobileAccordions();
    upgradeThemeSwitcher();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
