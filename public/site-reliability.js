/* Reliability layer: validation, guards, useful logs */
(function () {
  const LOG_KEY = "fc25_ui_runtime_logs_v1";
  const MAX_LOGS = 300;

  function readLogs() {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLogs(logs) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
    } catch {}
  }

  function pushLog(level, message, meta) {
    const logs = readLogs();
    logs.push({
      at: new Date().toISOString(),
      level,
      message: String(message || ""),
      page: location.pathname,
      meta: meta || null,
    });
    writeLogs(logs);
  }

  window.SiteLogger = {
    log(message, meta) {
      pushLog("info", message, meta);
    },
    warn(message, meta) {
      pushLog("warn", message, meta);
    },
    error(message, meta) {
      pushLog("error", message, meta);
    },
    list() {
      return readLogs();
    },
    clear() {
      writeLogs([]);
    },
  };

  window.addEventListener("error", (event) => {
    pushLog("error", event.message || "window_error", {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason && event.reason.message ? event.reason.message : String(event.reason || "unknown_rejection");
    pushLog("error", "unhandled_rejection", { reason });
  });

  function safeBind(id, eventName, handler) {
    const el = document.getElementById(id);
    if (!el) {
      pushLog("warn", "missing_element", { id, eventName });
      return false;
    }
    el.addEventListener(eventName, handler);
    return true;
  }

  function ensureNumericFieldValidation() {
    const rules = [
      { id: "sizeInput", min: 1, max: 12, label: "Nombre de matchs" },
      { id: "stakeInput", min: 100, max: 2000000, label: "Mise simulee" },
      { id: "bankrollInput", min: 1000, max: 100000000, label: "Bankroll initiale" },
      { id: "startAlertInput", min: 1, max: 30, label: "Alerte demarrage" },
      { id: "driftInput", min: 2, max: 25, label: "Seuil drift" },
      { id: "refreshMinutesCouponInput", min: 1, max: 60, label: "Refresh page" },
      { id: "autoCouponIntervalInput", min: 1, max: 120, label: "Intervalle auto-coupon" },
      { id: "autoCouponQualityInput", min: 1, max: 100, label: "Qualite auto-coupon" },
      { id: "freezeMinutesInput", min: 0, max: 30, label: "Freeze ticket" },
      { id: "watchDeltaInput", min: 0.01, max: 2, label: "Watchlist delta cote" },
    ];

    rules.forEach((rule) => {
      const input = document.getElementById(rule.id);
      if (!input) return;
      const hintId = `${rule.id}Hint`;
      let hint = document.getElementById(hintId);
      if (!hint) {
        hint = document.createElement("p");
        hint.id = hintId;
        hint.className = "validation-hint";
        hint.style.display = "none";
        input.parentElement && input.parentElement.appendChild(hint);
      }

      const validate = () => {
        const v = Number(input.value);
        const valid = Number.isFinite(v) && v >= rule.min && v <= rule.max;
        input.classList.toggle("field-invalid", !valid);
        if (!valid) {
          const msg = `${rule.label}: valeur attendue entre ${rule.min} et ${rule.max}.`;
          input.setCustomValidity(msg);
          hint.textContent = msg;
          hint.style.display = "block";
          pushLog("warn", "invalid_field_value", { field: rule.id, value: input.value });
        } else {
          input.setCustomValidity("");
          hint.style.display = "none";
        }
      };

      input.addEventListener("input", validate);
      input.addEventListener("change", validate);
      validate();
    });
  }

  function initQuickBar() {
    const bar = document.getElementById("quickMobileBar");
    if (!bar) return;

    if (document.querySelector(".global-bottom-nav")) {
      bar.remove();
      return;
    }

    document.body.classList.add("has-quick-mobile-bar");

    safeBind("quickRefreshBtn", "click", () => {
      if (typeof window.loadMatches === "function") return window.loadMatches();
      location.reload();
    });
    safeBind("quickCouponBtn", "click", () => {
      location.href = "/coupon.html";
    });
    safeBind("quickDenicheurBtn", "click", () => {
      const btn = document.getElementById("denicheurLaunchBtn");
      if (btn) btn.click();
    });
    safeBind("quickTopBtn", "click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initCouponPriorityActions() {
    const couponSticky = document.querySelector(".sticky-ticket-bar");
    if (couponSticky) {
      couponSticky.setAttribute("aria-label", "Actions prioritaires coupon");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      initQuickBar();
      initCouponPriorityActions();
      ensureNumericFieldValidation();
      pushLog("info", "site_reliability_initialized", { ua: navigator.userAgent });
    } catch (error) {
      pushLog("error", "reliability_init_failed", { message: error && error.message ? error.message : String(error) });
    }
  });
})();
