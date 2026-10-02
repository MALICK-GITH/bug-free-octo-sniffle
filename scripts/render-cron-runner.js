const { setTimeout: sleep } = require("node:timers/promises");

const BASE_URL = String(process.env.CRON_BASE_URL || "http://127.0.0.1:3029").trim().replace(/\/+$/, "");
const CRON_SECRET = String(process.env.CRON_SECRET || "").trim();
const MAX_ATTEMPTS = Math.max(1, Number(process.env.CRON_RETRIES || 3));
const REQUEST_TIMEOUT_MS = Math.max(5_000, Number(process.env.CRON_TIMEOUT_MS || 90_000));
const DEFAULT_DELAY_MS = Math.max(0, Number(process.env.CRON_RETRY_DELAY_MS || 2_500));

function buildUrl(pathname, query = {}) {
  const url = new URL(pathname, `${BASE_URL}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  if (CRON_SECRET) {
    url.searchParams.set("key", CRON_SECRET);
  }
  return url;
}

async function requestJson(url, label) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": `one-delux-cron-runner/${label}`,
        },
        signal: controller.signal,
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch (_error) {
        payload = { raw: text };
      }

      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
        throw new Error(message);
      }

      if (payload?.success === false) {
        throw new Error(payload?.error?.message || payload?.message || "Cron response marked as failed");
      }

      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(DEFAULT_DELAY_MS * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error(`Cron request failed for ${label}`);
}

async function runCommand(action) {
  const normalized = String(action || "").trim().toLowerCase();
  if (!BASE_URL) {
    throw new Error("CRON_BASE_URL manquant");
  }
  if (!CRON_SECRET) {
    throw new Error("CRON_SECRET manquant");
  }

  const commands = {
    learn: {
      label: "learn",
      url: buildUrl("/api/cron/learn", { dryRun: "0", debug: "0" }),
    },
    capture: {
      label: "capture",
      url: buildUrl("/api/cron/snapshots/capture"),
    },
    push: {
      label: "push",
      url: buildUrl("/api/cron/push/instant"),
    },
    dedupe: {
      label: "dedupe",
      url: buildUrl("/api/cron/finished-matches/dedupe", { execute: "1" }),
    },
    health: {
      label: "health",
      url: buildUrl("/api/health"),
    },
  };

  if (normalized === "all") {
    const sequence = ["capture", "learn", "push", "dedupe"];
    const results = [];
    for (const step of sequence) {
      const result = await requestJson(commands[step].url, commands[step].label);
      results.push({ step, result });
    }
    return { action: "all", results };
  }

  const command = commands[normalized];
  if (!command) {
    throw new Error(`Action cron inconnue: ${action}`);
  }

  return requestJson(command.url, command.label);
}

async function main() {
  const action = process.argv[2] || "learn";
  const startedAt = new Date().toISOString();
  console.log(JSON.stringify({ level: "info", action, baseUrl: BASE_URL, startedAt }, null, 2));

  try {
    const result = await runCommand(action);
    console.log(JSON.stringify({ level: "info", action, success: true, result }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", action, success: false, message: error.message }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "error", success: false, message: error.message }, null, 2));
  process.exit(1);
});
