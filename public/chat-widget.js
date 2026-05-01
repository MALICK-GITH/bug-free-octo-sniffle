(function initChatWidget() {
  const key = "fc25_chat_history_v1";
  const GLOBAL_REFRESH_KEY_MATCH = "fc25_page_refresh_minutes_v1";
  const GLOBAL_REFRESH_KEY_COUPON = "fc25_coupon_refresh_minutes_v1";
  const GLOBAL_REFRESH_DEFAULT_MIN = 5;
  const AUTO_REFRESH_ENABLED = false;

  function getGlobalRefreshMinutes() {
    const fromMatch = Number(localStorage.getItem(GLOBAL_REFRESH_KEY_MATCH));
    const fromCoupon = Number(localStorage.getItem(GLOBAL_REFRESH_KEY_COUPON));
    const raw = Number.isFinite(fromMatch)
      ? fromMatch
      : Number.isFinite(fromCoupon)
        ? fromCoupon
        : GLOBAL_REFRESH_DEFAULT_MIN;
    return Math.max(1, Math.min(60, raw));
  }

  function startGlobalAutoRefresh() {
    if (window.__globalAutoRefreshStarted) return;
    window.__globalAutoRefreshStarted = true;
    if (!AUTO_REFRESH_ENABLED) return;

    const hasDedicatedTimer =
      Boolean(document.getElementById("refreshMinutesInput")) ||
      Boolean(document.getElementById("refreshMinutesCouponInput"));
    if (hasDedicatedTimer) return;

    const ms = getGlobalRefreshMinutes() * 60 * 1000;
    setInterval(() => {
      if (document.visibilityState === "visible") {
        window.location.reload();
      }
    }, ms);
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(key);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(key, JSON.stringify(history.slice(-36)));
    } catch {
      // Ignore storage issues.
    }
  }

  function toHistoryPayload(history) {
    return history
      .slice(-12)
      .map((item) => ({
        role: item?.role === "user" ? "user" : "assistant",
        text: String(item?.text || "").trim().slice(0, 700),
      }))
      .filter((item) => item.text);
  }

  function createUI() {
    const fab = document.createElement("button");
    fab.className = "chat-fab";
    fab.type = "button";
    fab.textContent = "AI";
    fab.setAttribute("aria-label", "Ouvrir l assistant IA");

    const panel = document.createElement("section");
    panel.className = "chat-panel chat-hidden";
    panel.innerHTML = `
      <div class="chat-head">
        <span>SOLITAIRE AI - assistant unifie</span>
        <div class="chat-head-actions">
          <button type="button" class="chat-clear">Effacer</button>
          <button type="button" class="chat-close">X</button>
        </div>
      </div>
      <div class="chat-context-banner">Historique partage entre accueil, details et coupon.</div>
      <div class="chat-log" id="chatLog"></div>
      <form class="chat-form" id="chatForm">
        <textarea class="chat-input" id="chatInput" placeholder="Demande une action, une analyse ou une question generale..." enterkeyhint="send"></textarea>
        <button class="chat-send" type="submit">Envoyer</button>
      </form>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const log = panel.querySelector("#chatLog");
    const form = panel.querySelector("#chatForm");
    const input = panel.querySelector("#chatInput");
    const closeBtn = panel.querySelector(".chat-close");
    const clearBtn = panel.querySelector(".chat-clear");
    let busy = false;
    let history = loadHistory();

    function render() {
      log.innerHTML = history
        .map((item) => {
          const html =
            item.role === "assistant"
              ? window.SolitaireAIClient.renderRichText(item.text)
              : `<p>${window.SolitaireAIClient.escapeHtml(item.text)}</p>`;
          return `<div class="chat-msg ${item.role === "user" ? "chat-user" : "chat-ai"}">${html}</div>`;
        })
        .join("");
      log.scrollTop = log.scrollHeight;
    }

    function openChat() {
      panel.classList.remove("chat-hidden");
      log.scrollTop = log.scrollHeight;
      window.requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    }

    function push(role, text) {
      history.push({ role, text: String(text || "") });
      saveHistory(history);
      render();
    }

    if (!history.length) {
      push(
        "assistant",
        "Je te suis sur tout le site. Tu peux demander une action, une analyse match, un coupon, une recherche rapide ou une question generale."
      );
    } else {
      render();
    }

    fab.addEventListener("click", openChat);
    closeBtn.addEventListener("click", () => panel.classList.add("chat-hidden"));
    clearBtn.addEventListener("click", () => {
      history = [];
      saveHistory(history);
      push("assistant", "Historique efface. On repart sur une nouvelle session.");
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      const message = String(input.value || "").trim();
      if (!message) return;
      input.value = "";
      push("user", message);
      busy = true;

      try {
        const data = await window.SolitaireAIClient.sendMessage({
          message,
          history: toHistoryPayload(history),
        });
        push("assistant", data.answer || "Aucune reponse.");
        if (Array.isArray(data.actions) && data.actions.length) {
          await window.SolitaireAIClient.applyActions(data.actions);
        }
      } catch (error) {
        push("assistant", `Erreur: ${error.message}`);
      } finally {
        busy = false;
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!busy) {
          form.requestSubmit();
        }
      }
    });
  }

  function init() {
    startGlobalAutoRefresh();
    createUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
