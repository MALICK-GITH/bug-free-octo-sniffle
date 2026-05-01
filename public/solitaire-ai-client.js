(function initSolitaireAIClient() {
  const pendingActionsKey = "fc25_pending_site_actions_v1";

  function compactText(value, max = 180) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderRichText(value) {
    const text = String(value || "").trim();
    if (!text) return "<p>Aucune reponse.</p>";

    const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
    return blocks
      .map((block) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.every((line) => /^[-•*]\s+/.test(line))) {
          return `<ul>${lines
            .map((line) => `<li>${escapeHtml(line.replace(/^[-•*]\s+/, ""))}</li>`)
            .join("")}</ul>`;
        }
        return `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`;
      })
      .join("");
  }

  function buildPageSnapshot() {
    const page = window.location.pathname || "/";
    const title = compactText(document.querySelector("h1")?.textContent || "");
    const enabledButtons = Array.from(document.querySelectorAll("button"))
      .filter((button) => !button.disabled)
      .map((button) => compactText(button.textContent, 40))
      .filter(Boolean)
      .slice(0, 16);

    if (page.includes("coupon")) {
      const selections = Array.from(document.querySelectorAll("#result ol li"))
        .slice(0, 8)
        .map((line) => compactText(line.textContent, 120));
      return {
        pageType: "coupon",
        title,
        selections,
        validation: compactText(document.getElementById("validation")?.textContent || "", 220),
        enabledButtons,
      };
    }

    if (page.includes("match")) {
      return {
        pageType: "match",
        title,
        subtitle: compactText(document.getElementById("sub")?.textContent || "", 180),
        master: compactText(document.getElementById("master")?.textContent || "", 220),
        enabledButtons,
      };
    }

    return {
      pageType: "other",
      title,
      enabledButtons,
    };
  }

  function collectCouponParams() {
    return {
      size: Number(document.getElementById("sizeInput")?.value || 0) || null,
      league: document.getElementById("leagueSelect")?.value || "all",
      risk: document.getElementById("riskSelect")?.value || "balanced",
      stake: Number(document.getElementById("stakeInput")?.value || 0) || null,
      bankroll: Number(document.getElementById("bankrollInput")?.value || 0) || null,
      autoMode: Boolean(document.getElementById("autoCouponSwitch")?.checked),
    };
  }

  function buildContext(overrides = {}) {
    const params = new URLSearchParams(window.location.search);
    const context = {
      page: window.location.pathname,
      matchId: params.get("id") || "",
      league: document.getElementById("leagueSelect")?.value || "",
      realtime: {
        now: Date.now(),
        online: navigator.onLine,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        title: document.querySelector("h1")?.textContent?.trim() || "",
      },
      capabilities: {
        pageControl: Boolean(window.SiteControl),
        actions: Array.isArray(window.SiteControl?.actions) ? window.SiteControl.actions : [],
      },
      pageSnapshot: buildPageSnapshot(),
    };

    if ((window.location.pathname || "").includes("coupon")) {
      context.couponParams = collectCouponParams();
    }

    return { ...context, ...overrides };
  }

  async function applyAction(action) {
    if (!action || typeof action !== "object") return false;
    const type = String(action.type || "");

    if (type === "open_page" && action.target) {
      const nextActions = Array.isArray(action.nextActions) ? action.nextActions : [];
      if (nextActions.length) {
        sessionStorage.setItem(pendingActionsKey, JSON.stringify(nextActions));
      }
      window.location.href = String(action.target);
      return true;
    }

    if (type === "refresh_page") {
      window.location.reload();
      return true;
    }

    if (type === "set_coupon_form") {
      const sizeInput = document.getElementById("sizeInput");
      const riskSelect = document.getElementById("riskSelect");
      const leagueSelect = document.getElementById("leagueSelect");
      if (sizeInput && action.size) sizeInput.value = String(action.size);
      if (riskSelect && action.risk) riskSelect.value = String(action.risk);
      if (leagueSelect && action.league) leagueSelect.value = String(action.league);
      return true;
    }

    if (type === "site_control" || type === "run_site_action") {
      const controller = window.SiteControl;
      if (controller && typeof controller.execute === "function") {
        await controller.execute(action.name || action.action || "", action.payload || {});
        return true;
      }
    }

    return false;
  }

  async function applyActions(actions) {
    const list = Array.isArray(actions) ? actions : [];
    for (let index = 0; index < list.length; index += 1) {
      const action = list[index];
      if (String(action?.type || "") === "open_page") {
        const rest = list.slice(index + 1);
        if (rest.length) {
          action.nextActions = rest;
        }
        await applyAction(action);
        return;
      }
      await applyAction(action);
    }
  }

  async function runPendingActions() {
    const raw = sessionStorage.getItem(pendingActionsKey);
    if (!raw) return;
    sessionStorage.removeItem(pendingActionsKey);
    try {
      const actions = JSON.parse(raw);
      await applyActions(actions);
    } catch {
      // Ignore invalid pending actions.
    }
  }

  async function sendMessage({ message, history = [], context = {} }) {
    const payload = {
      message: String(message || "").trim(),
      history: Array.isArray(history) ? history : [],
      context: buildContext(context),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "Erreur chat");
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  window.SolitaireAIClient = {
    escapeHtml,
    renderRichText,
    buildContext,
    collectCouponParams,
    sendMessage,
    applyActions,
    runPendingActions,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runPendingActions, { once: true });
  } else {
    runPendingActions();
  }
})();
