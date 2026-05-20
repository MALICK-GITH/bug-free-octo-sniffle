const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const mysql = require("mysql2/promise");

require("dotenv").config({ path: path.join(process.cwd(), ".env") });

const sqliteFile = path.resolve(process.cwd(), process.env.DB_FILE || "data/app.sqlite");
const sqliteDir = path.dirname(sqliteFile);

if (!fs.existsSync(sqliteDir)) {
  fs.mkdirSync(sqliteDir, { recursive: true });
}

const sqliteDb = new DatabaseSync(sqliteFile);
sqliteDb.exec("PRAGMA journal_mode = WAL;");
sqliteDb.exec("PRAGMA synchronous = NORMAL;");

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS coupon_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    size INTEGER,
    league TEXT,
    risk TEXT,
    source TEXT,
    summary_json TEXT,
    coupon_json TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS coupon_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    drift_threshold REAL,
    status TEXT,
    request_json TEXT,
    report_json TEXT,
    error_text TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS telegram_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    kind TEXT,
    status TEXT,
    message TEXT,
    payload_json TEXT,
    response_json TEXT,
    error_text TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS telegram_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL UNIQUE,
    username TEXT,
    preferences_json TEXT,
    last_coupon_json TEXT,
    last_ladder_json TEXT,
    last_match_id TEXT,
    last_mode TEXT,
    state_json TEXT,
    pending_actions_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS audit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    audit_id TEXT NOT NULL,
    action TEXT,
    payload_json TEXT,
    result_json TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT,
    coupon_id TEXT,
    coupon_json TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT NOT NULL UNIQUE,
    match_ids_json TEXT,
    snapshot_json TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS mobile_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_id TEXT,
    platform TEXT NOT NULL,
    device_id TEXT NOT NULL,
    push_token TEXT,
    app_version TEXT,
    meta_json TEXT,
    UNIQUE(platform, device_id)
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    version TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    details TEXT,
    highlights_json TEXT,
    category TEXT,
    author TEXT,
    pinned INTEGER NOT NULL DEFAULT 0
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    daily_prediction_quota INTEGER NOT NULL DEFAULT 0,
    monthly_prediction_quota INTEGER NOT NULL DEFAULT 0,
    is_unlimited INTEGER NOT NULL DEFAULT 0,
    price_label TEXT,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS auth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    plan_key TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    subscription_status TEXT NOT NULL DEFAULT 'active',
    quota_override_daily INTEGER,
    quota_override_monthly INTEGER,
    last_login_at TEXT,
    last_active TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS prediction_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    match_id TEXT,
    cost_units INTEGER NOT NULL DEFAULT 1,
    plan_key TEXT NOT NULL,
    quota_before INTEGER,
    quota_after INTEGER,
    allowed INTEGER NOT NULL DEFAULT 1,
    meta_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const sqliteSeedPlansStmt = sqliteDb.prepare(`
  INSERT OR IGNORE INTO subscription_plans (
    plan_key, display_name, daily_prediction_quota, monthly_prediction_quota,
    is_unlimited, price_label, description, sort_order, is_active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

[
  ["free", "Free", 3, 30, 0, "Gratuit", "Acces de base avec quota restreint.", 0, 1],
  ["basic", "Basic", 20, 300, 0, "Pack Basic", "Pour les utilisateurs reguliers.", 1, 1],
  ["pro", "Pro", 100, 2000, 0, "Pack Pro", "Pour une activite intensive.", 2, 1],
  ["vip", "VIP", 0, 0, 1, "VIP", "Quota illimite et priorite complete.", 3, 1],
].forEach((values) => sqliteSeedPlansStmt.run(...values));

const sqliteInsertCouponGenerationStmt = sqliteDb.prepare(`
  INSERT INTO coupon_generations (size, league, risk, source, summary_json, coupon_json)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const sqliteInsertCouponValidationStmt = sqliteDb.prepare(`
  INSERT INTO coupon_validations (drift_threshold, status, request_json, report_json, error_text)
  VALUES (?, ?, ?, ?, ?)
`);

const sqliteInsertTelegramLogStmt = sqliteDb.prepare(`
  INSERT INTO telegram_logs (kind, status, message, payload_json, response_json, error_text)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const sqliteUpsertTelegramSessionStmt = sqliteDb.prepare(`
  INSERT INTO telegram_sessions (
    chat_id, username, preferences_json, last_coupon_json, last_ladder_json,
    last_match_id, last_mode, state_json, pending_actions_json, updated_at, last_seen_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(chat_id) DO UPDATE SET
    username = excluded.username,
    preferences_json = excluded.preferences_json,
    last_coupon_json = excluded.last_coupon_json,
    last_ladder_json = excluded.last_ladder_json,
    last_match_id = excluded.last_match_id,
    last_mode = excluded.last_mode,
    state_json = excluded.state_json,
    pending_actions_json = excluded.pending_actions_json,
    updated_at = datetime('now'),
    last_seen_at = datetime('now')
`);

const sqliteSelectTelegramSessionStmt = sqliteDb.prepare(`
  SELECT id, chat_id, username, preferences_json, last_coupon_json, last_ladder_json,
         last_match_id, last_mode, state_json, pending_actions_json,
         created_at, updated_at, last_seen_at
  FROM telegram_sessions
  WHERE chat_id = ?
  LIMIT 1
`);

const sqliteInsertAuditReportStmt = sqliteDb.prepare(`
  INSERT INTO audit_reports (audit_id, action, payload_json, result_json)
  VALUES (?, ?, ?, ?)
`);

const sqliteInsertFavoriteStmt = sqliteDb.prepare(`
  INSERT INTO favorites (user_id, coupon_id, coupon_json)
  VALUES (?, ?, ?)
`);

const sqliteSelectFavoritesStmt = sqliteDb.prepare(`
  SELECT id, created_at, user_id, coupon_id, coupon_json
  FROM favorites
  WHERE user_id = ?
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteSelectCouponHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, size, league, risk, source, summary_json, coupon_json
  FROM coupon_generations
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteSelectTelegramHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, kind, status, message, payload_json, response_json, error_text
  FROM telegram_logs
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteSelectAuditHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, audit_id, action, payload_json, result_json
  FROM audit_reports
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteUpsertWatchlistStmt = sqliteDb.prepare(`
  INSERT INTO watchlists (user_id, match_ids_json, snapshot_json)
  VALUES (?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    match_ids_json = excluded.match_ids_json,
    snapshot_json = excluded.snapshot_json,
    updated_at = datetime('now')
`);

const sqliteSelectWatchlistStmt = sqliteDb.prepare(`
  SELECT id, created_at, updated_at, user_id, match_ids_json, snapshot_json
  FROM watchlists
  WHERE user_id = ?
  LIMIT 1
`);

const sqliteUpsertMobileDeviceStmt = sqliteDb.prepare(`
  INSERT INTO mobile_devices (user_id, platform, device_id, push_token, app_version, meta_json)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(platform, device_id) DO UPDATE SET
    user_id = excluded.user_id,
    push_token = excluded.push_token,
    app_version = excluded.app_version,
    meta_json = excluded.meta_json,
    updated_at = datetime('now'),
    last_seen_at = datetime('now')
`);

const sqliteSelectMobileDeviceStmt = sqliteDb.prepare(`
  SELECT id, created_at, updated_at, last_seen_at, user_id, platform, device_id, push_token, app_version, meta_json
  FROM mobile_devices
  WHERE platform = ? AND device_id = ?
  LIMIT 1
`);

const sqliteInsertUpdateHistoryStmt = sqliteDb.prepare(`
  INSERT INTO update_history (version, title, summary, details, highlights_json, category, author, pinned)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const sqliteSelectUpdateHistoryStmt = sqliteDb.prepare(`
  SELECT id, created_at, version, title, summary, details, highlights_json, category, author, pinned
  FROM update_history
  ORDER BY id DESC
  LIMIT ?
`);

function normalizeKey(value, fallback = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || fallback;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function randomToken(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, 120000, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 3 || parts[0] !== "pbkdf2") return false;
  const [, salt, expected] = parts;
  const actual = crypto.pbkdf2Sync(String(password || ""), salt, 120000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function formatSqliteDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(
    date.getUTCMinutes()
  )}:${pad(date.getUTCSeconds())}`;
}

function parseAuthRow(row) {
  if (!row) return null;
  return {
    ...row,
    quota_override_daily: row.quota_override_daily == null ? null : Number(row.quota_override_daily),
    quota_override_monthly: row.quota_override_monthly == null ? null : Number(row.quota_override_monthly),
    quota_before: row.quota_before == null ? null : Number(row.quota_before),
    quota_after: row.quota_after == null ? null : Number(row.quota_after),
    cost_units: row.cost_units == null ? null : Number(row.cost_units),
    is_unlimited: Boolean(Number(row.is_unlimited)),
    is_active: row.is_active == null ? true : Boolean(Number(row.is_active)),
    daily_prediction_quota: row.daily_prediction_quota == null ? 0 : Number(row.daily_prediction_quota),
    monthly_prediction_quota: row.monthly_prediction_quota == null ? 0 : Number(row.monthly_prediction_quota),
    sort_order: row.sort_order == null ? 0 : Number(row.sort_order),
  };
}

function toPlanRow(row) {
  if (!row) return null;
  return {
    ...row,
    plan_key: row.plan_key,
    display_name: row.display_name,
    daily_prediction_quota: Number(row.daily_prediction_quota) || 0,
    monthly_prediction_quota: Number(row.monthly_prediction_quota) || 0,
    is_unlimited: Boolean(Number(row.is_unlimited)),
    is_active: Boolean(Number(row.is_active)),
    sort_order: Number(row.sort_order) || 0,
  };
}

const mysqlConfig = {
  host: String(process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT) || 3306,
  database: String(process.env.DB_NAME || "").trim(),
  user: String(process.env.DB_USER || "").trim(),
  password: String(process.env.DB_PASSWORD || "").trim(),
};

const mysqlRequested = Boolean(mysqlConfig.host && mysqlConfig.database && mysqlConfig.user && mysqlConfig.password);
let mysqlPool = null;
let mysqlReady = false;
let mysqlInitError = null;
let mysqlInitPromise = null;

function parseJsonSafe(v, fallback = null) {
  if (!v) return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toJson(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function buildSavedOptions(entry = {}) {
  return {
    size: Number(entry.size) || null,
    league: entry.league ? String(entry.league) : null,
    risk: entry.risk ? String(entry.risk) : null,
    source: entry.source ? String(entry.source) : null,
    driftThreshold: Number(entry.driftThreshold) || null,
    status: entry.status ? String(entry.status) : null,
    kind: entry.kind ? String(entry.kind) : null,
    message: entry.message ? String(entry.message) : null,
    action: entry.action ? String(entry.action) : null,
  };
}

function normalizeUserId(value, fallback = "anonymous") {
  const safeValue = String(value || "").trim();
  return safeValue || fallback;
}

function normalizeStringArray(items, limit = 200) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const safeValue = String(item || "").trim();
    if (!safeValue || seen.has(safeValue)) continue;
    seen.add(safeValue);
    output.push(safeValue);
    if (output.length >= limit) break;
  }

  return output;
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function initMySql() {
  if (!mysqlRequested) return false;
  if (mysqlInitPromise) return mysqlInitPromise;

  mysqlInitPromise = (async () => {
    try {
      mysqlPool = mysql.createPool({
        host: mysqlConfig.host,
        port: mysqlConfig.port,
        database: mysqlConfig.database,
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        connectTimeout: 5000,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS coupon_generations (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          size INT NULL,
          league VARCHAR(255) NULL,
          risk VARCHAR(255) NULL,
          source VARCHAR(255) NULL,
          saved_options_json LONGTEXT NULL,
          summary_json LONGTEXT NULL,
          coupon_json LONGTEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS coupon_validations (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          drift_threshold DOUBLE NULL,
          status VARCHAR(100) NULL,
          saved_options_json LONGTEXT NULL,
          request_json LONGTEXT NULL,
          report_json LONGTEXT NULL,
          error_text TEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS telegram_logs (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          kind VARCHAR(100) NULL,
          status VARCHAR(100) NULL,
          message TEXT NULL,
          saved_options_json LONGTEXT NULL,
          payload_json LONGTEXT NULL,
          response_json LONGTEXT NULL,
          error_text TEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS telegram_sessions (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          chat_id VARCHAR(255) NOT NULL,
          username VARCHAR(255) NULL,
          preferences_json LONGTEXT NULL,
          last_coupon_json LONGTEXT NULL,
          last_ladder_json LONGTEXT NULL,
          last_match_id VARCHAR(255) NULL,
          last_mode VARCHAR(80) NULL,
          state_json LONGTEXT NULL,
          pending_actions_json LONGTEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_telegram_sessions_chat_id (chat_id)
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS audit_reports (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          audit_id VARCHAR(255) NOT NULL,
          action VARCHAR(255) NULL,
          saved_options_json LONGTEXT NULL,
          payload_json LONGTEXT NULL,
          result_json LONGTEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS favorites (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id VARCHAR(255) NULL,
          coupon_id VARCHAR(255) NOT NULL,
          coupon_json LONGTEXT NULL
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS watchlists (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          user_id VARCHAR(255) NOT NULL,
          match_ids_json LONGTEXT NULL,
          snapshot_json LONGTEXT NULL,
          UNIQUE KEY uniq_watchlists_user_id (user_id)
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS mobile_devices (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id VARCHAR(255) NULL,
          platform VARCHAR(50) NOT NULL,
          device_id VARCHAR(255) NOT NULL,
          push_token TEXT NULL,
          app_version VARCHAR(120) NULL,
          meta_json LONGTEXT NULL,
          UNIQUE KEY uniq_mobile_devices_platform_device_id (platform, device_id)
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS update_history (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          version VARCHAR(120) NULL,
          title VARCHAR(255) NOT NULL,
          summary TEXT NULL,
          details LONGTEXT NULL,
          highlights_json LONGTEXT NULL,
          category VARCHAR(120) NULL,
          author VARCHAR(255) NULL,
          pinned TINYINT(1) NOT NULL DEFAULT 0
        )
      `);

      mysqlReady = true;
      mysqlInitError = null;
      return true;
    } catch (error) {
      mysqlReady = false;
      mysqlInitError = error;
      return false;
    }
  })();

  return mysqlInitPromise;
}

async function canUseMySql() {
  if (!mysqlRequested) return false;
  if (mysqlReady && mysqlPool) return true;
  return initMySql();
}

async function saveCouponGeneration(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO coupon_generations (size, league, risk, source, saved_options_json, summary_json, coupon_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(entry.size) || null,
        entry.league ? String(entry.league) : null,
        entry.risk ? String(entry.risk) : null,
        entry.source ? String(entry.source) : null,
        toJson(savedOptions, {}),
        toJson(entry.summary || {}, {}),
        toJson(entry.coupon || [], []),
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertCouponGenerationStmt.run(
    Number(entry.size) || null,
    entry.league ? String(entry.league) : null,
    entry.risk ? String(entry.risk) : null,
    entry.source ? String(entry.source) : null,
    toJson(entry.summary || {}, {}),
    toJson(entry.coupon || [], [])
  );
  return result.lastInsertRowid;
}

async function saveCouponValidation(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO coupon_validations (drift_threshold, status, saved_options_json, request_json, report_json, error_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(entry.driftThreshold) || null,
        entry.status ? String(entry.status) : "unknown",
        toJson(savedOptions, {}),
        toJson(entry.request || {}, {}),
        toJson(entry.report || {}, {}),
        entry.error ? String(entry.error) : null,
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertCouponValidationStmt.run(
    Number(entry.driftThreshold) || null,
    entry.status ? String(entry.status) : "unknown",
    toJson(entry.request || {}, {}),
    toJson(entry.report || {}, {}),
    entry.error ? String(entry.error) : null
  );
  return result.lastInsertRowid;
}

async function saveTelegramLog(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO telegram_logs (kind, status, message, saved_options_json, payload_json, response_json, error_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.kind ? String(entry.kind) : "coupon",
        entry.status ? String(entry.status) : "unknown",
        entry.message ? String(entry.message) : null,
        toJson(savedOptions, {}),
        toJson(entry.payload || {}, {}),
        toJson(entry.response || {}, {}),
        entry.error ? String(entry.error) : null,
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertTelegramLogStmt.run(
    entry.kind ? String(entry.kind) : "coupon",
    entry.status ? String(entry.status) : "unknown",
    entry.message ? String(entry.message) : null,
    toJson(entry.payload || {}, {}),
    toJson(entry.response || {}, {}),
    entry.error ? String(entry.error) : null
  );
  return result.lastInsertRowid;
}

async function upsertTelegramSession(entry = {}) {
  const chatId = String(entry.chatId || "").trim();
  if (!chatId) {
    throw new Error("chat_id requis");
  }
  const username = entry.username ? String(entry.username).trim() : null;
  const preferences = normalizeObject(entry.preferences);
  const lastCoupon = normalizeObject(entry.lastCoupon);
  const lastLadder = normalizeObject(entry.lastLadder);
  const lastMatchId = entry.lastMatchId ? String(entry.lastMatchId).trim() : null;
  const lastMode = entry.lastMode ? String(entry.lastMode).trim() : null;
  const state = normalizeObject(entry.state);
  const pendingActions = Array.isArray(entry.pendingActions) ? entry.pendingActions.slice(0, 50) : [];

  if (await canUseMySql()) {
    await mysqlPool.execute(
      `INSERT INTO telegram_sessions (
         chat_id, username, preferences_json, last_coupon_json, last_ladder_json,
         last_match_id, last_mode, state_json, pending_actions_json, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         preferences_json = VALUES(preferences_json),
         last_coupon_json = VALUES(last_coupon_json),
         last_ladder_json = VALUES(last_ladder_json),
         last_match_id = VALUES(last_match_id),
         last_mode = VALUES(last_mode),
         state_json = VALUES(state_json),
         pending_actions_json = VALUES(pending_actions_json),
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP`,
      [
        chatId,
        username,
        toJson(preferences, {}),
        toJson(lastCoupon, {}),
        toJson(lastLadder, {}),
        lastMatchId,
        lastMode,
        toJson(state, {}),
        toJson(pendingActions, []),
      ]
    );
    const [rows] = await mysqlPool.execute(
      `SELECT id, chat_id, username, preferences_json, last_coupon_json, last_ladder_json, last_match_id, last_mode, state_json, pending_actions_json, created_at, updated_at, last_seen_at
       FROM telegram_sessions
       WHERE chat_id = ?
       LIMIT 1`,
      [chatId]
    );
    const row = rows[0];
    return {
      id: row?.id || null,
      chatId: row?.chat_id || chatId,
      username: row?.username || username,
      preferences: parseJsonSafe(row?.preferences_json, {}),
      lastCoupon: parseJsonSafe(row?.last_coupon_json, {}),
      lastLadder: parseJsonSafe(row?.last_ladder_json, {}),
      lastMatchId: row?.last_match_id || lastMatchId,
      lastMode: row?.last_mode || lastMode,
      state: parseJsonSafe(row?.state_json, {}),
      pendingActions: parseJsonSafe(row?.pending_actions_json, []),
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      lastSeenAt: normalizeDate(row?.last_seen_at),
    };
  }

  sqliteUpsertTelegramSessionStmt.run(
    chatId,
    username,
    toJson(preferences, {}),
    toJson(lastCoupon, {}),
    toJson(lastLadder, {}),
    lastMatchId,
    lastMode,
    toJson(state, {}),
    toJson(pendingActions, [])
  );
  const row = sqliteSelectTelegramSessionStmt.get(chatId);
  return {
    id: row?.id || null,
    chatId: row?.chat_id || chatId,
    username: row?.username || username,
    preferences: parseJsonSafe(row?.preferences_json, {}),
    lastCoupon: parseJsonSafe(row?.last_coupon_json, {}),
    lastLadder: parseJsonSafe(row?.last_ladder_json, {}),
    lastMatchId: row?.last_match_id || lastMatchId,
    lastMode: row?.last_mode || lastMode,
    state: parseJsonSafe(row?.state_json, {}),
    pendingActions: parseJsonSafe(row?.pending_actions_json, []),
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    lastSeenAt: row?.last_seen_at || null,
  };
}

async function getTelegramSession(chatId = "") {
  const safeChatId = String(chatId || "").trim();
  if (!safeChatId) return null;

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, chat_id, username, preferences_json, last_coupon_json, last_ladder_json, last_match_id, last_mode, state_json, pending_actions_json, created_at, updated_at, last_seen_at
       FROM telegram_sessions
       WHERE chat_id = ?
       LIMIT 1`,
      [safeChatId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      chatId: row.chat_id,
      username: row.username || null,
      preferences: parseJsonSafe(row.preferences_json, {}),
      lastCoupon: parseJsonSafe(row.last_coupon_json, {}),
      lastLadder: parseJsonSafe(row.last_ladder_json, {}),
      lastMatchId: row.last_match_id || null,
      lastMode: row.last_mode || null,
      state: parseJsonSafe(row.state_json, {}),
      pendingActions: parseJsonSafe(row.pending_actions_json, []),
      createdAt: normalizeDate(row.created_at),
      updatedAt: normalizeDate(row.updated_at),
      lastSeenAt: normalizeDate(row.last_seen_at),
    };
  }

  const row = sqliteSelectTelegramSessionStmt.get(safeChatId);
  if (!row) return null;
  return {
    id: row.id,
    chatId: row.chat_id,
    username: row.username || null,
    preferences: parseJsonSafe(row.preferences_json, {}),
    lastCoupon: parseJsonSafe(row.last_coupon_json, {}),
    lastLadder: parseJsonSafe(row.last_ladder_json, {}),
    lastMatchId: row.last_match_id || null,
    lastMode: row.last_mode || null,
    state: parseJsonSafe(row.state_json, {}),
    pendingActions: parseJsonSafe(row.pending_actions_json, []),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    lastSeenAt: row.last_seen_at || null,
  };
}

async function saveAuditReport(entry = {}) {
  const auditId = entry.auditId ? String(entry.auditId) : `AUD-${Date.now()}`;
  const savedOptions = buildSavedOptions(entry);

  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO audit_reports (audit_id, action, saved_options_json, payload_json, result_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        auditId,
        entry.action ? String(entry.action) : "unknown",
        toJson(savedOptions, {}),
        toJson(entry.payload || {}, {}),
        toJson(entry.result || {}, {}),
      ]
    );
    return { id: result.insertId, auditId };
  }

  const result = sqliteInsertAuditReportStmt.run(
    auditId,
    entry.action ? String(entry.action) : "unknown",
    toJson(entry.payload || {}, {}),
    toJson(entry.result || {}, {})
  );
  return { id: result.lastInsertRowid, auditId };
}

async function getCouponHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, size, league, risk, source, saved_options_json, summary_json, coupon_json
       FROM coupon_generations
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      size: row.size,
      league: row.league,
      risk: row.risk,
      source: row.source,
      savedOptions: parseJsonSafe(row.saved_options_json, {}),
      summary: parseJsonSafe(row.summary_json, {}),
      coupon: parseJsonSafe(row.coupon_json, []),
    }));
  }

  return sqliteSelectCouponHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    size: row.size,
    league: row.league,
    risk: row.risk,
    source: row.source,
    summary: parseJsonSafe(row.summary_json, {}),
    coupon: parseJsonSafe(row.coupon_json, []),
  }));
}

async function getTelegramHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, kind, status, message, saved_options_json, payload_json, response_json, error_text
       FROM telegram_logs
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      kind: row.kind,
      status: row.status,
      message: row.message,
      savedOptions: parseJsonSafe(row.saved_options_json, {}),
      payload: parseJsonSafe(row.payload_json, {}),
      response: parseJsonSafe(row.response_json, {}),
      error: row.error_text || null,
    }));
  }

  return sqliteSelectTelegramHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    kind: row.kind,
    status: row.status,
    message: row.message,
    payload: parseJsonSafe(row.payload_json, {}),
    response: parseJsonSafe(row.response_json, {}),
    error: row.error_text || null,
  }));
}

async function saveFavorite(entry = {}) {
  const userId = entry.userId ? String(entry.userId) : "anonymous";
  const couponId = entry.couponId ? String(entry.couponId) : null;

  if (!couponId) {
    throw new Error("coupon_id requis");
  }

  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO favorites (user_id, coupon_id, coupon_json)
       VALUES (?, ?, ?)`,
      [
        userId,
        couponId,
        toJson(entry.coupon || {}, {})
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertFavoriteStmt.run(
    userId,
    couponId,
    toJson(entry.coupon || {}, {})
  );
  return result.lastInsertRowid;
}

async function getFavorites(userId = "anonymous", limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));
  const safeUserId = normalizeUserId(userId);

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, user_id, coupon_id, coupon_json
       FROM favorites
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [safeUserId, safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      userId: row.user_id,
      couponId: row.coupon_id,
      coupon: parseJsonSafe(row.coupon_json, {}),
    }));
  }

  return sqliteSelectFavoritesStmt.all(safeUserId, safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    userId: row.user_id,
    couponId: row.coupon_id,
    coupon: parseJsonSafe(row.coupon_json, {}),
  }));
}

async function saveWatchlist(entry = {}) {
  const userId = normalizeUserId(entry.userId, "default");
  const matchIds = normalizeStringArray(entry.matchIds || entry.watchlist, 300);
  const snapshot = normalizeObject(entry.snapshot);

  if (await canUseMySql()) {
    await mysqlPool.execute(
      `INSERT INTO watchlists (user_id, match_ids_json, snapshot_json)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         match_ids_json = VALUES(match_ids_json),
         snapshot_json = VALUES(snapshot_json),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, toJson(matchIds, []), toJson(snapshot, {})]
    );
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, updated_at, user_id, match_ids_json, snapshot_json
       FROM watchlists
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    return {
      id: row?.id || null,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      userId: row?.user_id || userId,
      matchIds: parseJsonSafe(row?.match_ids_json, []),
      snapshot: parseJsonSafe(row?.snapshot_json, {}),
    };
  }

  sqliteUpsertWatchlistStmt.run(
    userId,
    toJson(matchIds, []),
    toJson(snapshot, {})
  );
  const row = sqliteSelectWatchlistStmt.get(userId);
  return {
    id: row?.id || null,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    userId: row?.user_id || userId,
    matchIds: parseJsonSafe(row?.match_ids_json, []),
    snapshot: parseJsonSafe(row?.snapshot_json, {}),
  };
}

async function getWatchlist(userId = "default") {
  const safeUserId = normalizeUserId(userId, "default");

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, updated_at, user_id, match_ids_json, snapshot_json
       FROM watchlists
       WHERE user_id = ?
       LIMIT 1`,
      [safeUserId]
    );
    const row = rows[0];
    return {
      id: row?.id || null,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      userId: row?.user_id || safeUserId,
      matchIds: parseJsonSafe(row?.match_ids_json, []),
      snapshot: parseJsonSafe(row?.snapshot_json, {}),
    };
  }

  const row = sqliteSelectWatchlistStmt.get(safeUserId);
  return {
    id: row?.id || null,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    userId: row?.user_id || safeUserId,
    matchIds: parseJsonSafe(row?.match_ids_json, []),
    snapshot: parseJsonSafe(row?.snapshot_json, {}),
  };
}

function getPlanRow(planKey) {
  return sqliteDb.prepare(
    `SELECT id, plan_key, display_name, daily_prediction_quota, monthly_prediction_quota, is_unlimited, price_label, description, sort_order, is_active
     FROM subscription_plans
     WHERE plan_key = ?
     LIMIT 1`
  ).get(normalizeKey(planKey, "free"));
}

function getAuthAdminCount() {
  return sqliteDb.prepare(`SELECT COUNT(*) AS count FROM auth_accounts WHERE role = 'admin'`).get().count || 0;
}

function getAuthUserRowById(userId) {
  return sqliteDb.prepare(
    `SELECT a.*, p.display_name AS plan_name, p.daily_prediction_quota, p.monthly_prediction_quota, p.is_unlimited
     FROM auth_accounts a
     LEFT JOIN subscription_plans p ON p.plan_key = a.plan_key
     WHERE a.user_id = ?
     LIMIT 1`
  ).get(String(userId || "").trim());
}

function getAuthUserRowByEmail(email) {
  return sqliteDb.prepare(
    `SELECT a.*, p.display_name AS plan_name, p.daily_prediction_quota, p.monthly_prediction_quota, p.is_unlimited
     FROM auth_accounts a
     LEFT JOIN subscription_plans p ON p.plan_key = a.plan_key
     WHERE a.email = ?
     LIMIT 1`
  ).get(normalizeEmail(email));
}

function listAuthUserRows(limit = 100) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  return sqliteDb.prepare(
    `SELECT a.*, p.display_name AS plan_name, p.daily_prediction_quota, p.monthly_prediction_quota, p.is_unlimited
     FROM auth_accounts a
     LEFT JOIN subscription_plans p ON p.plan_key = a.plan_key
     ORDER BY a.updated_at DESC
     LIMIT ?`
  ).all(safeLimit).map(parseAuthRow);
}

function getAuthSessionRow(token) {
  return sqliteDb.prepare(
    `SELECT
       s.session_token,
       s.user_id AS session_user_id,
       s.ip_address,
       s.user_agent,
       s.created_at AS session_created_at,
       s.last_seen_at,
       s.expires_at,
       s.revoked_at,
       a.user_id,
       a.email,
       a.username,
       a.role,
       a.plan_key,
       a.status,
       a.subscription_status,
       a.quota_override_daily,
       a.quota_override_monthly,
       a.last_login_at,
       a.last_active,
       a.created_at,
       a.updated_at,
       p.display_name AS plan_name,
       p.daily_prediction_quota,
       p.monthly_prediction_quota,
       p.is_unlimited
     FROM auth_sessions s
     JOIN auth_accounts a ON a.user_id = s.user_id
     LEFT JOIN subscription_plans p ON p.plan_key = a.plan_key
     WHERE s.session_token = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > datetime('now')
     LIMIT 1`
  ).get(String(token || "").trim());
}

function getAuthQuotaStateRow(userId) {
  const user = getAuthUserRowById(userId);
  if (!user) return null;
  const plan = getPlanRow(user.plan_key) || getPlanRow("free");
  const quotaLimit = user.quota_override_daily ?? plan?.daily_prediction_quota ?? 0;
  const unlimited = user.role === "admin" || Boolean(plan?.is_unlimited);
  const startAt = formatSqliteDateTime(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())));
  const endAt = formatSqliteDateTime(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)));
  const summary = sqliteDb.prepare(
    `SELECT
       COUNT(*) AS total_events,
       COALESCE(SUM(CASE WHEN allowed = 1 THEN cost_units ELSE 0 END), 0) AS used_units,
       COALESCE(SUM(CASE WHEN allowed = 0 THEN cost_units ELSE 0 END), 0) AS blocked_units
     FROM prediction_usage
     WHERE user_id = ?
       AND created_at >= ?
       AND created_at < ?`
  ).get(String(userId || "").trim(), startAt, endAt);
  const usedToday = Number(summary?.used_units) || 0;
  const remainingToday = unlimited ? null : Math.max(0, Number(quotaLimit) - usedToday);
  return {
    user,
    plan,
    dailyQuota: unlimited ? null : Number(quotaLimit) || 0,
    usedToday,
    remainingToday,
    unlimited,
    blockedToday: Number(summary?.blocked_units) || 0,
    totalEventsToday: Number(summary?.total_events) || 0,
  };
}

async function getPlans() {
  return sqliteDb.prepare(
    `SELECT id, plan_key, display_name, daily_prediction_quota, monthly_prediction_quota, is_unlimited, price_label, description, sort_order, is_active
     FROM subscription_plans
     WHERE is_active = 1
     ORDER BY sort_order ASC, plan_key ASC`
  ).all().map(toPlanRow);
}

async function getPlan(planKey) {
  return toPlanRow(getPlanRow(planKey));
}

async function getAdminCount() {
  return getAuthAdminCount();
}

async function getAuthUserById(userId) {
  return parseAuthRow(getAuthUserRowById(userId));
}

async function getAuthUserByEmail(email) {
  return parseAuthRow(getAuthUserRowByEmail(email));
}

function verifyAuthPassword(password, storedHash) {
  return verifyPassword(password, storedHash);
}

async function listAuthUsers(limit = 100) {
  return listAuthUserRows(limit);
}

async function saveAuthUser(userData = {}) {
  const email = normalizeEmail(userData.email);
  const username = String(userData.username || "").trim();
  const password = String(userData.password || "").trim();
  const requestedPlanKey = normalizeKey(userData.planKey || "free", "free");
  const roleInput = normalizeKey(userData.role || "user", "user");
  const adminCount = getAuthAdminCount();
  const role = adminCount === 0 ? "admin" : roleInput === "admin" ? "admin" : "user";
  const requestedPlan = getPlanRow(requestedPlanKey);
  const finalPlan = role === "admin" ? "vip" : requestedPlan ? requestedPlan.plan_key : "free";

  if (!email) throw new Error("email requis");
  if (!username) throw new Error("username requis");
  if (!password || password.length < 8) throw new Error("mot de passe trop court");
  if (getAuthUserRowByEmail(email)) throw new Error("email deja utilise");

  const userId = normalizeKey(userData.userId || email.split("@")[0], "user");
  const passwordHash = hashPassword(password);
  sqliteDb.prepare(
    `INSERT INTO auth_accounts (
      user_id, email, username, password_hash, role, plan_key, status, subscription_status,
      quota_override_daily, quota_override_monthly, last_login_at, last_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'active', ?, ?, NULL, datetime('now'), datetime('now'), datetime('now'))`
  ).run(
    userId,
    email,
    username,
    passwordHash,
    role,
    finalPlan,
    userData.quotaOverrideDaily ?? null,
    userData.quotaOverrideMonthly ?? null
  );
  return getAuthUserRowById(userId);
}

async function updateAuthUser(userId, updates = {}) {
  const current = getAuthUserRowById(userId);
  if (!current) throw new Error("utilisateur introuvable");

  const nextUsername = updates.username != null ? String(updates.username).trim() : current.username;
  const nextEmail = updates.email != null ? normalizeEmail(updates.email) : current.email;
  const nextRole = updates.role != null ? normalizeKey(updates.role, current.role) : current.role;
  const requestedPlanKey = updates.planKey != null ? normalizeKey(updates.planKey, current.plan_key) : current.plan_key;
  const nextPlan = getPlanRow(requestedPlanKey) ? requestedPlanKey : current.plan_key;
  const nextStatus = updates.status != null ? normalizeKey(updates.status, current.status) : current.status;
  const nextSubscriptionStatus =
    updates.subscriptionStatus != null ? normalizeKey(updates.subscriptionStatus, current.subscription_status) : current.subscription_status;
  const nextQuotaOverrideDaily = updates.quotaOverrideDaily === undefined ? current.quota_override_daily : updates.quotaOverrideDaily;
  const nextQuotaOverrideMonthly = updates.quotaOverrideMonthly === undefined ? current.quota_override_monthly : updates.quotaOverrideMonthly;
  const nextPasswordHash =
    updates.password && String(updates.password).trim().length >= 8 ? hashPassword(updates.password) : current.password_hash;

  const adminCount = getAuthAdminCount();
  if (current.role === "admin" && nextRole !== "admin" && adminCount <= 1) {
    throw new Error("au moins un administrateur doit rester actif");
  }

  const resolvedPlan = nextRole === "admin" ? "vip" : nextPlan;
  sqliteDb.prepare(
    `UPDATE auth_accounts
     SET email = ?,
         username = ?,
         role = ?,
         plan_key = ?,
         status = ?,
         subscription_status = ?,
         quota_override_daily = ?,
         quota_override_monthly = ?,
         password_hash = ?,
         updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(
    nextEmail,
    nextUsername,
    nextRole,
    resolvedPlan,
    nextStatus,
    nextSubscriptionStatus,
    nextQuotaOverrideDaily,
    nextQuotaOverrideMonthly,
    nextPasswordHash,
    String(userId || "").trim()
  );
  return getAuthUserRowById(userId);
}

async function deleteAuthUser(userId) {
  const current = getAuthUserRowById(userId);
  if (!current) return null;
  if (current.role === "admin" && getAuthAdminCount() <= 1) {
    throw new Error("au moins un administrateur doit rester actif");
  }
  sqliteDb.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).run(String(userId || "").trim());
  sqliteDb.prepare(`DELETE FROM auth_accounts WHERE user_id = ?`).run(String(userId || "").trim());
  return current;
}

async function createAuthSession(userId, { ipAddress = null, userAgent = null, daysValid = 30 } = {}) {
  const token = randomToken(32);
  const validDays = Math.max(1, Number(daysValid) || 30);
  const expiresAt = formatSqliteDateTime(new Date(Date.now() + validDays * 24 * 60 * 60 * 1000));
  sqliteDb.prepare(
    `INSERT INTO auth_sessions (session_token, user_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(token, String(userId || "").trim(), ipAddress, userAgent, expiresAt);
  return { token, session: getAuthSessionRow(token) };
}

async function getAuthSession(token) {
  return parseAuthRow(getAuthSessionRow(token));
}

async function revokeAuthSession(token) {
  sqliteDb.prepare(
    `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE session_token = ?`
  ).run(String(token || "").trim());
  return true;
}

async function revokeAllAuthSessions(userId) {
  sqliteDb.prepare(
    `UPDATE auth_sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL`
  ).run(String(userId || "").trim());
  return true;
}

async function recordPredictionUsage(entry = {}) {
  sqliteDb.prepare(
    `INSERT INTO prediction_usage (user_id, endpoint, match_id, cost_units, plan_key, quota_before, quota_after, allowed, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(entry.userId || "").trim(),
    String(entry.endpoint || "").trim(),
    entry.matchId ? String(entry.matchId).trim() : null,
    Math.max(1, Number(entry.costUnits) || 1),
    normalizeKey(entry.planKey || "free", "free"),
    entry.quotaBefore == null ? null : Number(entry.quotaBefore),
    entry.quotaAfter == null ? null : Number(entry.quotaAfter),
    entry.allowed ? 1 : 0,
    toJson(entry.meta || {}, {})
  );
  return true;
}

async function getPredictionUsageSummary({ userId, startAt = null, endAt = null } = {}) {
  const safeUserId = String(userId || "").trim();
  const start = startAt ? formatSqliteDateTime(startAt) : "0000-01-01 00:00:00";
  const end = endAt ? formatSqliteDateTime(endAt) : "9999-12-31 23:59:59";
  const summary = sqliteDb.prepare(
    `SELECT
       COUNT(*) AS total_events,
       COALESCE(SUM(CASE WHEN allowed = 1 THEN cost_units ELSE 0 END), 0) AS used_units,
       COALESCE(SUM(CASE WHEN allowed = 0 THEN cost_units ELSE 0 END), 0) AS blocked_units
     FROM prediction_usage
     WHERE user_id = ?
       AND created_at >= ?
       AND created_at < ?`
  ).get(safeUserId, start, end);
  return {
    total_events: Number(summary?.total_events) || 0,
    used_units: Number(summary?.used_units) || 0,
    blocked_units: Number(summary?.blocked_units) || 0,
  };
}

async function getAuthQuotaState(userId) {
  return getAuthQuotaStateRow(userId);
}

async function touchAuthSession(token, userId) {
  const safeToken = String(token || "").trim();
  const safeUserId = String(userId || "").trim();
  if (!safeToken || !safeUserId) return;
  sqliteDb.prepare(
    `UPDATE auth_sessions SET last_seen_at = datetime('now') WHERE session_token = ?`
  ).run(safeToken);
  sqliteDb.prepare(
    `UPDATE auth_accounts SET last_active = datetime('now') WHERE user_id = ?`
  ).run(safeUserId);
}

async function registerMobileDevice(entry = {}) {
  const platform = String(entry.platform || "android").trim().toLowerCase() || "android";
  const deviceId = String(entry.deviceId || "").trim();

  if (!deviceId) {
    throw new Error("device_id requis");
  }

  const userId = entry.userId == null ? null : normalizeUserId(entry.userId, "default");
  const pushToken = entry.pushToken ? String(entry.pushToken).trim() : null;
  const appVersion = entry.appVersion ? String(entry.appVersion).trim() : null;
  const meta = normalizeObject(entry.meta);

  if (await canUseMySql()) {
    await mysqlPool.execute(
      `INSERT INTO mobile_devices (user_id, platform, device_id, push_token, app_version, meta_json, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         push_token = VALUES(push_token),
         app_version = VALUES(app_version),
         meta_json = VALUES(meta_json),
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP`,
      [userId, platform, deviceId, pushToken, appVersion, toJson(meta, {})]
    );
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, updated_at, last_seen_at, user_id, platform, device_id, push_token, app_version, meta_json
       FROM mobile_devices
       WHERE platform = ? AND device_id = ?
       LIMIT 1`,
      [platform, deviceId]
    );
    const row = rows[0];
    return {
      id: row?.id || null,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      lastSeenAt: normalizeDate(row?.last_seen_at),
      userId: row?.user_id || userId,
      platform: row?.platform || platform,
      deviceId: row?.device_id || deviceId,
      pushTokenRegistered: Boolean(row?.push_token),
      appVersion: row?.app_version || appVersion,
      meta: parseJsonSafe(row?.meta_json, {}),
    };
  }

  sqliteUpsertMobileDeviceStmt.run(
    userId,
    platform,
    deviceId,
    pushToken,
    appVersion,
    toJson(meta, {})
  );
  const row = sqliteSelectMobileDeviceStmt.get(platform, deviceId);
  return {
    id: row?.id || null,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    lastSeenAt: row?.last_seen_at || null,
    userId: row?.user_id || userId,
    platform: row?.platform || platform,
    deviceId: row?.device_id || deviceId,
    pushTokenRegistered: Boolean(row?.push_token),
    appVersion: row?.app_version || appVersion,
    meta: parseJsonSafe(row?.meta_json, {}),
  };
}

function normalizeUpdateHighlights(value) {
  return normalizeStringArray(value, 20);
}

async function saveUpdateEntry(entry = {}) {
  const record = {
    version: entry.version ? String(entry.version).trim() : null,
    title: entry.title ? String(entry.title).trim() : null,
    summary: entry.summary ? String(entry.summary).trim() : null,
    details: entry.details ? String(entry.details).trim() : null,
    highlights: normalizeUpdateHighlights(entry.highlights),
    category: entry.category ? String(entry.category).trim() : null,
    author: entry.author ? String(entry.author).trim() : null,
    pinned: entry.pinned ? 1 : 0,
  };

  if (!record.title) {
    throw new Error("title requis");
  }

  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO update_history (version, title, summary, details, highlights_json, category, author, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.version,
        record.title,
        record.summary,
        record.details,
        toJson(record.highlights, []),
        record.category,
        record.author,
        record.pinned,
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertUpdateHistoryStmt.run(
    record.version,
    record.title,
    record.summary,
    record.details,
    toJson(record.highlights, []),
    record.category,
    record.author,
    record.pinned
  );
  return result.lastInsertRowid;
}

async function getUpdateHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, version, title, summary, details, highlights_json, category, author, pinned
       FROM update_history
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      version: row.version || null,
      title: row.title || "",
      summary: row.summary || "",
      details: row.details || "",
      highlights: parseJsonSafe(row.highlights_json, []),
      category: row.category || null,
      author: row.author || null,
      pinned: Boolean(row.pinned),
    }));
  }

  return sqliteSelectUpdateHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    version: row.version || null,
    title: row.title || "",
    summary: row.summary || "",
    details: row.details || "",
    highlights: parseJsonSafe(row.highlights_json, []),
    category: row.category || null,
    author: row.author || null,
    pinned: Boolean(row.pinned),
  }));
}

async function getAuditHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, audit_id, action, saved_options_json, payload_json, result_json
       FROM audit_reports
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      auditId: row.audit_id,
      action: row.action,
      savedOptions: parseJsonSafe(row.saved_options_json, {}),
      payload: parseJsonSafe(row.payload_json, {}),
      result: parseJsonSafe(row.result_json, {}),
    }));
  }

  return sqliteSelectAuditHistoryStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    auditId: row.audit_id,
    action: row.action,
    payload: parseJsonSafe(row.payload_json, {}),
    result: parseJsonSafe(row.result_json, {}),
  }));
}

async function getDbStatus() {
  if (await canUseMySql()) {
    const [couponRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM coupon_generations");
    const [validationRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM coupon_validations");
    const [telegramRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM telegram_logs");
    const [telegramSessionRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM telegram_sessions");
    const [auditRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM audit_reports");
    const [updateRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM update_history");
    const [favoriteRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM favorites");
    const [watchlistRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM watchlists");
    const [deviceRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM mobile_devices");
    const [authRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM auth_accounts");
    const [sessionRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM auth_sessions");
    const [planRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM subscription_plans");

    return {
      ok: true,
      mode: "mysql",
      host: mysqlConfig.host,
      database: mysqlConfig.database,
      tables: {
        coupon_generations: Number(couponRows?.[0]?.c) || 0,
        coupon_validations: Number(validationRows?.[0]?.c) || 0,
        telegram_logs: Number(telegramRows?.[0]?.c) || 0,
        telegram_sessions: Number(telegramSessionRows?.[0]?.c) || 0,
        audit_reports: Number(auditRows?.[0]?.c) || 0,
        update_history: Number(updateRows?.[0]?.c) || 0,
        favorites: Number(favoriteRows?.[0]?.c) || 0,
        watchlists: Number(watchlistRows?.[0]?.c) || 0,
        mobile_devices: Number(deviceRows?.[0]?.c) || 0,
        auth_accounts: Number(authRows?.[0]?.c) || 0,
        auth_sessions: Number(sessionRows?.[0]?.c) || 0,
        subscription_plans: Number(planRows?.[0]?.c) || 0,
      },
    };
  }

  const couponCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM coupon_generations").get().c;
  const validationCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM coupon_validations").get().c;
  const telegramCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM telegram_logs").get().c;
  const telegramSessionCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM telegram_sessions").get().c;
  const auditCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM audit_reports").get().c;
  const updateCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM update_history").get().c;
  const favoriteCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM favorites").get().c;
  const watchlistCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM watchlists").get().c;
  const deviceCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM mobile_devices").get().c;
  const authCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM auth_accounts").get().c;
  const sessionCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM auth_sessions").get().c;
  const planCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM subscription_plans").get().c;

  return {
    ok: true,
    mode: "sqlite",
    file: sqliteFile,
    mysqlRequested,
    mysqlError: mysqlInitError ? String(mysqlInitError.message || mysqlInitError) : null,
    tables: {
      coupon_generations: Number(couponCount) || 0,
      coupon_validations: Number(validationCount) || 0,
      telegram_logs: Number(telegramCount) || 0,
      telegram_sessions: Number(telegramSessionCount) || 0,
      audit_reports: Number(auditCount) || 0,
      update_history: Number(updateCount) || 0,
      favorites: Number(favoriteCount) || 0,
      watchlists: Number(watchlistCount) || 0,
      mobile_devices: Number(deviceCount) || 0,
      auth_accounts: Number(authCount) || 0,
      auth_sessions: Number(sessionCount) || 0,
      subscription_plans: Number(planCount) || 0,
    },
  };
}

module.exports = {
  saveCouponGeneration,
  saveCouponValidation,
  saveTelegramLog,
  upsertTelegramSession,
  getTelegramSession,
  saveAuditReport,
  getCouponHistory,
  getTelegramHistory,
  saveUpdateEntry,
  getUpdateHistory,
  getAuditHistory,
  getDbStatus,
  saveFavorite,
  getFavorites,
  saveWatchlist,
  getWatchlist,
  registerMobileDevice,
  getPlans,
  getPlan,
  getAdminCount,
  getAuthUserById,
  getAuthUserByEmail,
  verifyAuthPassword,
  listAuthUsers,
  saveAuthUser,
  updateAuthUser,
  deleteAuthUser,
  createAuthSession,
  getAuthSession,
  revokeAuthSession,
  revokeAllAuthSessions,
  recordPredictionUsage,
  getPredictionUsageSummary,
  getAuthQuotaState,
  touchAuthSession,
};
