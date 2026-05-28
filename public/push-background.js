(function () {
  const OPT_IN_KEY = "one_delux_push_opt_in_v2";
  const PREFS_KEY = "one_delux_push_prefs_v2";

  function getDefaultPrefs() {
    return {
      topics: ["all"],
      quietHours: { enabled: false, start: 23, end: 7 },
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    };
  }

  function getPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return getDefaultPrefs();
      const parsed = JSON.parse(raw);
      return {
        ...getDefaultPrefs(),
        ...(parsed || {}),
        quietHours: { ...getDefaultPrefs().quietHours, ...(parsed?.quietHours || {}) },
      };
    } catch (_error) {
      return getDefaultPrefs();
    }
  }

  function setPrefs(next) {
    const safe = {
      ...getDefaultPrefs(),
      ...(next || {}),
      quietHours: { ...getDefaultPrefs().quietHours, ...(next?.quietHours || {}) },
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(safe));
    return safe;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function getOrCreateSubscription() {
    const sw = await navigator.serviceWorker.ready;
    let sub = await sw.pushManager.getSubscription();
    if (sub) return sub;
    const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
    const keyData = await keyRes.json();
    if (!keyRes.ok || !keyData?.publicKey) throw new Error(keyData?.message || "public key indisponible");
    sub = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
    return sub;
  }

  async function syncSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
    if (localStorage.getItem(OPT_IN_KEY) !== "1") return null;
    if (Notification.permission !== "granted") return null;

    const sub = await getOrCreateSubscription();
    const prefs = getPrefs();
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), preferences: prefs }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data?.message || "subscribe failed");
    }
    return { subscription: sub, preferences: prefs };
  }

  async function enablePush() {
    if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
    const status = await Notification.requestPermission();
    if (status !== "granted") return { ok: false, reason: status };
    localStorage.setItem(OPT_IN_KEY, "1");
    await syncSubscription();
    return { ok: true };
  }

  async function disablePush() {
    localStorage.setItem(OPT_IN_KEY, "0");
    if (!("serviceWorker" in navigator)) return { ok: true };
    const sw = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.getSubscription();
    if (sub) await sub.unsubscribe().catch(() => {});
    return { ok: true };
  }

  async function updatePreferences(prefsPatch = {}) {
    const merged = setPrefs({ ...getPrefs(), ...prefsPatch, tzOffsetMinutes: new Date().getTimezoneOffset() });
    const sw = await navigator.serviceWorker.ready;
    const sub = await sw.pushManager.getSubscription();
    if (!sub) return { ok: true, preferences: merged };
    await fetch("/api/push/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        preferences: merged,
      }),
    }).catch(() => {});
    return { ok: true, preferences: merged };
  }

  function getStatus() {
    return {
      supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
      permission: "Notification" in window ? Notification.permission : "unsupported",
      optedIn: localStorage.getItem(OPT_IN_KEY) === "1",
      preferences: getPrefs(),
    };
  }

  function injectMiniPushPanel() {
    const host = document.querySelector(".hero .controls") || document.querySelector(".hero-tools") || document.querySelector(".controls");
    if (!host || document.getElementById("pushMiniPanel")) return;
    const wrap = document.createElement("div");
    wrap.id = "pushMiniPanel";
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.style.marginLeft = "8px";
    wrap.innerHTML = `
      <button type="button" id="pushToggleBtn" style="padding:6px 10px;border-radius:8px;border:1px solid #2f415f;background:#101a30;color:#dfe8ff;cursor:pointer;">Activer notif</button>
      <button type="button" id="pushPrefsBtn" style="padding:6px 10px;border-radius:8px;border:1px solid #2f415f;background:#101a30;color:#9fb4d8;cursor:pointer;">Prefs</button>
    `;
    host.appendChild(wrap);

    const toggleBtn = wrap.querySelector("#pushToggleBtn");
    const prefsBtn = wrap.querySelector("#pushPrefsBtn");

    const refresh = () => {
      const status = getStatus();
      const active = status.permission === "granted" && status.optedIn;
      toggleBtn.textContent = active ? "Notif actives" : "Activer notif";
      toggleBtn.style.color = active ? "#8cffc1" : "#dfe8ff";
    };

    toggleBtn.addEventListener("click", async () => {
      const status = getStatus();
      if (status.permission === "granted" && status.optedIn) return;
      await enablePush().catch(() => {});
      refresh();
    });

    prefsBtn.addEventListener("click", async () => {
      const current = getPrefs();
      const choice = prompt("Topics (all,finished,coupon,system) separes par virgule:", current.topics.join(","));
      if (!choice) return;
      const topics = choice.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      await updatePreferences({ topics: topics.length ? topics : ["all"] });
      alert("Preferences notifications mises a jour.");
    });

    refresh();
  }

  window.enableBackgroundPush = enablePush;
  window.disableBackgroundPush = disablePush;
  window.syncBackgroundPush = syncSubscription;
  window.setBackgroundPushPreferences = updatePreferences;
  window.getBackgroundPushStatus = getStatus;

  window.addEventListener("load", () => {
    localStorage.setItem(OPT_IN_KEY, "1");
    if ("Notification" in window && Notification.permission === "default") {
      setTimeout(() => {
        enablePush().catch(() => {});
      }, 800);
    }
    syncSubscription().catch(() => {});
    injectMiniPushPanel();
  });
})();
