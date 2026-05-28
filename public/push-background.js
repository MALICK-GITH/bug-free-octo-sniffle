(function () {
  const STORAGE_KEY = "one_delux_push_opt_in_v1";

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function ensureSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (localStorage.getItem(STORAGE_KEY) !== "1") return;
    if (Notification.permission !== "granted") return;

    const sw = await navigator.serviceWorker.ready;
    let sub = await sw.pushManager.getSubscription();
    if (!sub) {
      const keyRes = await fetch("/api/push/public-key", { cache: "no-store" });
      const keyData = await keyRes.json();
      if (!keyRes.ok || !keyData?.publicKey) return;
      sub = await sw.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      });
    }
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub }),
    });
  }

  async function requestAndEnableBackgroundPush() {
    if (!("Notification" in window)) return false;
    const status = await Notification.requestPermission();
    if (status !== "granted") return false;
    localStorage.setItem(STORAGE_KEY, "1");
    await ensureSubscription();
    return true;
  }

  window.enableBackgroundPush = requestAndEnableBackgroundPush;
  window.syncBackgroundPush = ensureSubscription;

  window.addEventListener("load", () => {
    ensureSubscription().catch(() => {});
  });
})();

