const DEFAULT_PORT = 3029;
const DEFAULT_JSON_LIMIT = "1mb";

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  port: parseNumber(process.env.PORT, DEFAULT_PORT),
  maxPortTries: parseNumber(process.env.MAX_PORT_TRIES, 20),
  jsonLimit: String(process.env.JSON_BODY_LIMIT || DEFAULT_JSON_LIMIT).trim(),
  chatRateLimitWindowMs: parseNumber(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000),
  chatRateLimitMax: parseNumber(process.env.CHAT_RATE_LIMIT_MAX, 10),
  heavyPostWindowMs: parseNumber(process.env.HEAVY_POST_WINDOW_MS, 60_000),
  heavyPostMax: parseNumber(process.env.HEAVY_POST_MAX, 40),
  chatIoTimeoutMs: parseNumber(process.env.CHAT_IO_TIMEOUT_MS, 3500),
  chatProviderTimeoutMs: parseNumber(process.env.CHAT_PROVIDER_TIMEOUT_MS, 7000),
  mobileApiVersion: String(process.env.MOBILE_API_VERSION || "2026-04-18-android").trim(),
  androidMinSdk: parseNumber(process.env.ANDROID_MIN_SDK, 26),
  androidTargetSdk: parseNumber(process.env.ANDROID_TARGET_SDK, 35),
  androidPackageName: String(process.env.ANDROID_PACKAGE_NAME || "com.solitairehack.solitfifpro225").trim(),
  allowedOrigins: parseCsv(process.env.ALLOWED_ORIGINS),
  cspReportOnly: String(process.env.CSP_REPORT_ONLY || "0").trim() === "1",
  aiApiUrl: String(process.env.AI_API_URL || process.env.API_URL || "").trim(),
  aiApiKey: String(process.env.AI_API_KEY || "").trim(),
};
