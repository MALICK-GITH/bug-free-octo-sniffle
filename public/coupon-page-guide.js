(function initCouponPageGuide() {
  const STORAGE_KEY = "fc25_coupon_simple_mode_v1";
  const ADVANCED_INPUT_IDS = [
    "refreshMinutesCouponInput",
    "autoCouponSwitch",
    "autoCouponIntervalInput",
    "autoCouponQualityInput",
    "autoCouponTelegramSwitch",
    "driftInput",
    "freezeMinutesInput",
    "bankrollProfileSelect",
    "antiCorrelationSwitch",
    "antiChaosSwitch",
    "preSendLockSwitch",
    "liveSimSwitch",
    "autoHealSwitch",
    "lowDataSwitch",
    "watchDeltaInput",
  ];

  const ADVANCED_BUTTON_IDS = [
    "generateLadderBtn",
    "generateMultiBtn",
    "simulateBankrollBtn",
    "printA4Btn",
    "exportProBtn",
    "analyzeJournalBtn",
    "replayJournalBtn",
    "watchlistFromCouponBtn",
  ];

  function markAdvancedFields() {
    ADVANCED_INPUT_IDS.forEach((id) => {
      const element = document.getElementById(id);
      const label = element?.closest("label");
      if (label) label.classList.add("coupon-advanced-field");
    });

    ADVANCED_BUTTON_IDS.forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.classList.add("coupon-advanced-action");
    });
  }

  function setSimpleMode(enabled) {
    document.body.classList.toggle("coupon-simple-mode", enabled);
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");

    const toggle = document.getElementById("toggleCouponSimpleBtn");
    const label = document.getElementById("couponSimpleModeLabel");
    if (toggle) {
      toggle.textContent = enabled ? "Afficher les options avancees" : "Revenir a la vue simple";
    }
    if (label) {
      label.textContent = enabled ? "Vue simple active" : "Vue avancee active";
    }
  }

  function init() {
    markAdvancedFields();
    const toggle = document.getElementById("toggleCouponSimpleBtn");
    const defaultSimpleMode = localStorage.getItem(STORAGE_KEY) !== "0";
    setSimpleMode(defaultSimpleMode);

    if (toggle) {
      toggle.addEventListener("click", () => {
        setSimpleMode(!document.body.classList.contains("coupon-simple-mode"));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
