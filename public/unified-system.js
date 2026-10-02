(function initUnifiedSystem() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  document.documentElement.dataset.unifiedSystem = "ready";

  window.dispatchEvent(
    new CustomEvent("solitfifpro:unified-system-ready", {
      detail: {
        ready: true,
        version: "2026.04.18",
      },
    })
  );
})();
