(function () {
  const BANNER_ID = "browserSyncBanner";
  const INSTALL_BTN_ID = "installPwaBtn";
  const APP_VERSION = "2026.03.30-r3";
  let deferredInstallPrompt = null;
  let hiddenAt = Date.now();
  let registrationRef = null;

  function ensureBanner() {
    let banner = document.getElementById(BANNER_ID);
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.style.position = "fixed";
    banner.style.right = "12px";
    banner.style.bottom = "12px";
    banner.style.zIndex = "9999";
    banner.style.padding = "8px 12px";
    banner.style.borderRadius = "12px";
    banner.style.border = "1px solid rgba(125,255,173,0.35)";
    banner.style.background = "rgba(9,17,34,0.92)";
    banner.style.color = "#d9f7e8";
    banner.style.fontFamily = "Sora, sans-serif";
    banner.style.fontSize = "12px";
    banner.style.display = "none";
    banner.style.maxWidth = "min(420px, calc(100vw - 24px))";
    document.body.appendChild(banner);
    return banner;
  }

  function showBanner(text, ok, actionLabel, actionHandler) {
    const banner = ensureBanner();
    banner.innerHTML = "";
    const copy = document.createElement("div");
    copy.textContent = text;
    banner.appendChild(copy);
    if (actionLabel && typeof actionHandler === "function") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = actionLabel;
      button.style.marginTop = "8px";
      button.style.border = "1px solid rgba(255,255,255,0.2)";
      button.style.borderRadius = "999px";
      button.style.padding = "8px 12px";
      button.style.cursor = "pointer";
      button.style.background = ok ? "rgba(66,245,108,0.18)" : "rgba(255,122,122,0.16)";
      button.style.color = ok ? "#d9f7e8" : "#ffe3e3";
      button.addEventListener("click", actionHandler, { once: true });
      banner.appendChild(button);
    }
    banner.style.display = "block";
    banner.style.borderColor = ok ? "rgba(125,255,173,0.35)" : "rgba(255,122,122,0.4)";
    banner.style.color = ok ? "#d9f7e8" : "#ffe3e3";
    setTimeout(() => {
      if (banner) banner.style.display = "none";
    }, actionLabel ? 9000 : 3500);
  }

  function announceVersion() {
    const key = "fc25_browser_version_seen";
    const previous = localStorage.getItem(key);
    localStorage.setItem(key, APP_VERSION);
    if (previous && previous !== APP_VERSION) {
      showBanner(`Version ${APP_VERSION} active sur cet appareil.`, true);
    }
  }

  function promptForUpdate(worker) {
    if (!worker) return;
    showBanner("Nouvelle version detectee. Recharge quand tu veux pour l'activer.", true, "Mettre a jour", () => {
      worker.postMessage({ type: "SKIP_WAITING" });
    });
  }

  function bindRegistration(registration) {
    if (!registration) return;
    registrationRef = registration;

    if (registration.waiting) {
      promptForUpdate(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          promptForUpdate(newWorker);
        }
      });
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        bindRegistration(registration);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (document.visibilityState === "visible") {
            window.location.reload();
          }
        });
      } catch (_e) {
        // no-op: app keeps running without SW
      }
    });
  }

  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      addInstallButton();
    });
  }

  function addInstallButton() {
    if (document.getElementById(INSTALL_BTN_ID)) return;
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    if (isMobile || document.querySelector(".global-bottom-nav")) return;

    const btn = document.createElement("button");
    btn.id = INSTALL_BTN_ID;
    btn.type = "button";
    btn.textContent = "Installer App";
    btn.style.position = "fixed";
    btn.style.left = "12px";
    btn.style.bottom = "12px";
    btn.style.zIndex = "9999";
    btn.style.border = "1px solid rgba(59,231,255,0.5)";
    btn.style.background = "rgba(8,22,42,0.94)";
    btn.style.color = "#d8f3ff";
    btn.style.padding = "8px 12px";
    btn.style.borderRadius = "10px";
    btn.style.fontFamily = "Chakra Petch, sans-serif";
    btn.style.fontWeight = "700";
    btn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (_e) {
        // ignore
      }
      deferredInstallPrompt = null;
      btn.remove();
    });
    document.body.appendChild(btn);
  }

  function setupConnectivitySync() {
    window.addEventListener("online", () => showBanner("Connexion retablie. Sync active.", true));
    window.addEventListener("offline", () => showBanner("Mode hors ligne actif.", false));
  }

  function setupVisibilitySync() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const elapsed = Date.now() - hiddenAt;
      const evt = new CustomEvent("fc25:resume-sync", { detail: { elapsedMs: elapsed } });
      window.dispatchEvent(evt);
    });

    window.addEventListener("fc25:resume-sync", () => {
      if (!navigator.onLine) return;
      if (registrationRef && typeof registrationRef.update === "function") {
        registrationRef.update().catch(() => null);
      }
    });

    window.addEventListener("fc25:manual-update-check", async () => {
      if (!navigator.onLine) {
        showBanner("Impossible de verifier maintenant en mode hors ligne.", false);
        return;
      }
      if (registrationRef && typeof registrationRef.update === "function") {
        try {
          await registrationRef.update();
          const waitingWorker = registrationRef.waiting;
          if (waitingWorker) {
            promptForUpdate(waitingWorker);
            return;
          }
          showBanner("Version deja a jour sur cet appareil.", true);
        } catch (_error) {
          showBanner("Verification impossible pour le moment.", false);
        }
      }
    });
  }

  function setupBrowserFusion() {
    announceVersion();
    registerServiceWorker();
    setupInstallPrompt();
    setupConnectivitySync();
    setupVisibilitySync();
  }

  setupBrowserFusion();
})();
