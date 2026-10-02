(function initCouponCompetitiveUI() {
  const body = document.body;
  if (!body || !body.classList.contains("coupon-portal")) return;

  const focusBtn = document.getElementById("competitiveFocusBtn");
  const denseBtn = document.getElementById("competitiveDensityBtn");
  const pulseBtn = document.getElementById("competitivePulseBtn");
  const clock = document.getElementById("competitiveClock");

  const totalSel = document.getElementById("compTotalSel");
  const totalOdd = document.getElementById("compTotalOdd");
  const avgConf = document.getElementById("compAvgConf");
  const leagueCount = document.getElementById("compLeagueCount");

  const KEY_FOCUS = "coupon_competitive_focus_v1";
  const KEY_DENSE = "coupon_competitive_dense_v1";
  const KEY_PULSE = "coupon_competitive_pulse_v1";

  function setToggle(btn, cls, enabled) {
    body.classList.toggle(cls, enabled);
    if (btn) btn.classList.toggle("is-active", enabled);
  }

  function bindToggle(btn, cls, key) {
    if (!btn) return;
    const initial = localStorage.getItem(key) === "1";
    setToggle(btn, cls, initial);
    btn.addEventListener("click", () => {
      const next = !body.classList.contains(cls);
      localStorage.setItem(key, next ? "1" : "0");
      setToggle(btn, cls, next);
    });
  }

  bindToggle(focusBtn, "competitive-focus", KEY_FOCUS);
  bindToggle(denseBtn, "competitive-dense", KEY_DENSE);
  bindToggle(pulseBtn, "competitive-pulse", KEY_PULSE);

  function tickClock() {
    if (!clock) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    clock.textContent = `${hh}:${mm}:${ss}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  function parseNumberFromText(text) {
    const n = Number(String(text || "").replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function refreshCompetitiveStats() {
    const result = document.getElementById("result");
    if (!result) return;
    const picks = Array.from(result.querySelectorAll("ol > li"));
    if (totalSel) totalSel.textContent = String(picks.length);

    const confs = picks
      .map((li) => {
        const raw = li.textContent || "";
        const m = raw.match(/confiance\s*:?\s*(\d+(?:[.,]\d+)?)/i);
        return m ? Number(m[1].replace(",", ".")) : null;
      })
      .filter((v) => Number.isFinite(v));
    const avg = confs.length ? (confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(1) : "0.0";
    if (avgConf) avgConf.textContent = `${avg}%`;

    const leagues = new Set();
    let odd = null;
    const metaItems = Array.from(result.querySelectorAll(".meta span"));
    for (const item of metaItems) {
      const txt = item.textContent || "";
      if (/ligue/i.test(txt)) leagues.add(txt.trim());
      if (/cote|odd/i.test(txt)) {
        const maybe = parseNumberFromText(txt);
        if (maybe && maybe > 1) odd = maybe;
      }
    }
    if (leagueCount) leagueCount.textContent = String(leagues.size || 0);
    if (totalOdd) totalOdd.textContent = odd ? odd.toFixed(3) : "-";
  }

  refreshCompetitiveStats();
  const observer = new MutationObserver(refreshCompetitiveStats);
  const resultNode = document.getElementById("result");
  if (resultNode) observer.observe(resultNode, { childList: true, subtree: true, characterData: true });
})();
