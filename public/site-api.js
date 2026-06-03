(function (global) {
  "use strict";

  const DEFAULT_BASE_URL = "/api";

  async function requestJson(path, options = {}) {
    const method = String(options.method || "GET").toUpperCase();
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const response = await fetch(`${DEFAULT_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: "same-origin",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status} for ${path}`);
      error.response = response;
      error.data = data;
      throw error;
    }
    return data;
  }

  const SiteAPI = global.SiteAPI || {
    baseUrl: DEFAULT_BASE_URL,
    requestJson,
    get(path, options) {
      return requestJson(path, { ...(options || {}), method: "GET" });
    },
    post(path, body, options) {
      return requestJson(path, { ...(options || {}), method: "POST", body });
    },
    health() {
      return requestJson("/health");
    },
    apiHealth() {
      return requestJson("/health");
    },
    matchesLive() {
      return requestJson("/matches/live");
    },
    matchesUpcoming() {
      return requestJson("/matches/upcoming");
    },
    matchDetails(matchId) {
      return requestJson(`/matches/${encodeURIComponent(matchId)}/details`);
    },
    couponHistory(limit = 20) {
      return requestJson(`/coupon/history?limit=${encodeURIComponent(limit)}`);
    },
    telegramHistory(limit = 20) {
      return requestJson(`/telegram/history?limit=${encodeURIComponent(limit)}`);
    },
    watchlist(userId = "demo") {
      return requestJson(`/watchlist?userId=${encodeURIComponent(userId)}`);
    },
    mediaHistory(limit = 200) {
      return requestJson(`/media/history?limit=${encodeURIComponent(limit)}`);
    },
    bootstrap() {
      return requestJson("/mobile/bootstrap");
    },
  };

  global.SiteAPI = SiteAPI;
  global.siteApi = global.siteApi || SiteAPI;
})(window);
