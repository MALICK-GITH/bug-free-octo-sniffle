const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const mysql = require("mysql2/promise");
const { Pool } = require("pg");

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
  CREATE TABLE IF NOT EXISTS generated_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    kind TEXT NOT NULL,
    page TEXT,
    action TEXT,
    label TEXT,
    file_name TEXT,
    format TEXT,
    mime_type TEXT,
    source TEXT,
    related_id TEXT,
    asset_json TEXT
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
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL UNIQUE,
    team_home TEXT NOT NULL,
    team_away TEXT NOT NULL,
    league TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming',
    minute INTEGER NOT NULL DEFAULT 0,
    start_time_unix INTEGER,
    score_home INTEGER NOT NULL DEFAULT 0,
    score_away INTEGER NOT NULL DEFAULT 0,
    odds_json TEXT,
    prediction_json TEXT,
    source TEXT,
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS match_score_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    state_hash TEXT NOT NULL,
    team_home TEXT NOT NULL,
    team_away TEXT NOT NULL,
    league TEXT NOT NULL,
    status TEXT NOT NULL,
    minute INTEGER NOT NULL DEFAULT 0,
    score_home INTEGER NOT NULL DEFAULT 0,
    score_away INTEGER NOT NULL DEFAULT 0,
    source TEXT,
    snapshot_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(match_id, state_hash)
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS match_tracking_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracker_key TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'liveFeed',
    status TEXT NOT NULL DEFAULT 'ok',
    live_count INTEGER NOT NULL DEFAULT 0,
    upcoming_count INTEGER NOT NULL DEFAULT 0,
    finished_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    snapshot_json TEXT,
    error_text TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS match_tracking_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracker_key TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    interval_seconds INTEGER NOT NULL DEFAULT 60,
    total_runs INTEGER NOT NULL DEFAULT 0,
    last_started_at TEXT,
    last_completed_at TEXT,
    last_success_at TEXT,
    last_error_at TEXT,
    last_error_text TEXT,
    last_snapshot_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
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

const sqliteUpsertTrackedMatchStmt = sqliteDb.prepare(`
  INSERT INTO matches (
    match_id, team_home, team_away, league, status, minute, start_time_unix,
    score_home, score_away, odds_json, prediction_json, source, last_seen_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(match_id) DO UPDATE SET
    team_home = excluded.team_home,
    team_away = excluded.team_away,
    league = excluded.league,
    status = excluded.status,
    minute = excluded.minute,
    start_time_unix = excluded.start_time_unix,
    score_home = excluded.score_home,
    score_away = excluded.score_away,
    odds_json = excluded.odds_json,
    prediction_json = excluded.prediction_json,
    source = excluded.source,
    last_seen_at = datetime('now'),
    updated_at = datetime('now')
`);

const sqliteInsertMatchTrackingRunStmt = sqliteDb.prepare(`
  INSERT INTO match_tracking_runs (
    tracker_key, source, status, live_count, upcoming_count, finished_count, total_count, snapshot_json, error_text
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const sqliteUpsertMatchTrackingStateStmt = sqliteDb.prepare(`
  INSERT INTO match_tracking_state (
    tracker_key, enabled, interval_seconds, total_runs, last_started_at, last_completed_at,
    last_success_at, last_error_at, last_error_text, last_snapshot_json, updated_at, last_seen_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  ON CONFLICT(tracker_key) DO UPDATE SET
    enabled = excluded.enabled,
    interval_seconds = excluded.interval_seconds,
    total_runs = excluded.total_runs,
    last_started_at = excluded.last_started_at,
    last_completed_at = excluded.last_completed_at,
    last_success_at = excluded.last_success_at,
    last_error_at = excluded.last_error_at,
    last_error_text = excluded.last_error_text,
    last_snapshot_json = excluded.last_snapshot_json,
    updated_at = datetime('now'),
    last_seen_at = datetime('now')
`);

const sqliteSelectMatchTrackingStateStmt = sqliteDb.prepare(`
  SELECT id, tracker_key, enabled, interval_seconds, total_runs, last_started_at, last_completed_at,
         last_success_at, last_error_at, last_error_text, last_snapshot_json, created_at, updated_at, last_seen_at
  FROM match_tracking_state
  WHERE tracker_key = ?
  LIMIT 1
`);

const sqliteSelectMatchTrackingRunsStmt = sqliteDb.prepare(`
  SELECT id, tracker_key, source, status, live_count, upcoming_count, finished_count, total_count,
         snapshot_json, error_text, created_at
  FROM match_tracking_runs
  WHERE tracker_key = ?
  ORDER BY id DESC
  LIMIT ?
`);

const sqliteSelectTrackedMatchesStmt = sqliteDb.prepare(`
  SELECT id, match_id, team_home, team_away, league, status, minute, start_time_unix,
         score_home, score_away, odds_json, prediction_json, source, last_seen_at, created_at, updated_at
  FROM matches
  ORDER BY updated_at DESC
  LIMIT ?
`);

const sqliteSelectTrackedMatchStmt = sqliteDb.prepare(`
  SELECT id, match_id, team_home, team_away, league, status, minute, start_time_unix,
         score_home, score_away, odds_json, prediction_json, source, last_seen_at, created_at, updated_at
  FROM matches
  WHERE match_id = ?
  LIMIT 1
`);

const sqliteInsertMatchScoreHistoryStmt = sqliteDb.prepare(`
  INSERT OR IGNORE INTO match_score_history (
    match_id, state_hash, team_home, team_away, league, status, minute, score_home, score_away, source, snapshot_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const sqliteSelectMatchScoreHistoryStmt = sqliteDb.prepare(`
  SELECT id, match_id, state_hash, team_home, team_away, league, status, minute, score_home, score_away,
         source, snapshot_json, created_at
  FROM match_score_history
  WHERE match_id = ?
  ORDER BY id DESC
  LIMIT ?
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

const sqliteInsertGeneratedAssetStmt = sqliteDb.prepare(`
  INSERT INTO generated_assets (
    kind, page, action, label, file_name, format, mime_type, source, related_id, asset_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const sqliteDeleteGeneratedAssetStmt = sqliteDb.prepare(`
  DELETE FROM generated_assets WHERE id = ?
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

const sqliteSelectGeneratedAssetsStmt = sqliteDb.prepare(`
  SELECT id, created_at, kind, page, action, label, file_name, format, mime_type, source, related_id, asset_json
  FROM generated_assets
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

function trimEnv(value) {
  return String(value || "").trim();
}

function isSslDisabled() {
  return trimEnv(process.env.DB_SSL).toLowerCase() === "false";
}

function buildPostgresConfig() {
  const connectionString = trimEnv(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.DB_URL ||
      ""
  );

  if (connectionString) {
    return {
      connectionString,
      ssl: isSslDisabled() ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 5000,
    };
  }

  return null;
}

const mysqlRequested = Boolean(mysqlConfig.host && mysqlConfig.database && mysqlConfig.user && mysqlConfig.password);
const postgresConfig = buildPostgresConfig();
const postgresRequested = Boolean(postgresConfig);
let mysqlPool = null;
let mysqlReady = false;
let mysqlInitError = null;
let mysqlInitPromise = null;
let postgresPool = null;
let postgresReady = false;
let postgresInitError = null;
let postgresInitPromise = null;

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

function normalizeGeneratedAsset(entry = {}) {
  const kind = String(entry.kind || entry.assetKind || "image").trim().toLowerCase() || "image";
  return {
    kind,
    page: String(entry.page || entry.sourcePage || entry.pagePath || "").trim() || null,
    action: String(entry.action || entry.sourceAction || "").trim() || null,
    label: String(entry.label || entry.title || entry.name || "").trim() || null,
    fileName: String(entry.fileName || entry.file_name || "").trim() || null,
    format: String(entry.format || entry.fileFormat || "").trim().toLowerCase() || null,
    mimeType: String(entry.mimeType || entry.mime_type || "").trim() || null,
    source: String(entry.source || entry.origin || "").trim() || null,
    relatedId: String(entry.relatedId || entry.related_id || entry.matchId || entry.couponId || "").trim() || null,
    asset: normalizeObject(entry.asset || entry.meta || entry.payload || {}),
  };
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
        CREATE TABLE IF NOT EXISTS generated_assets (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          kind VARCHAR(80) NOT NULL,
          page VARCHAR(255) NULL,
          action VARCHAR(255) NULL,
          label VARCHAR(255) NULL,
          file_name VARCHAR(255) NULL,
          format VARCHAR(40) NULL,
          mime_type VARCHAR(120) NULL,
          source VARCHAR(255) NULL,
          related_id VARCHAR(255) NULL,
          asset_json LONGTEXT NULL,
          KEY idx_generated_assets_created_at (created_at),
          KEY idx_generated_assets_kind_created_at (kind, created_at)
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
        CREATE TABLE IF NOT EXISTS matches (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          match_id VARCHAR(255) NOT NULL,
          team_home VARCHAR(255) NOT NULL,
          team_away VARCHAR(255) NOT NULL,
          league VARCHAR(255) NOT NULL,
          status VARCHAR(80) NOT NULL DEFAULT 'upcoming',
          minute INT NOT NULL DEFAULT 0,
          start_time_unix BIGINT NULL,
          score_home INT NOT NULL DEFAULT 0,
          score_away INT NOT NULL DEFAULT 0,
          odds_json LONGTEXT NULL,
          prediction_json LONGTEXT NULL,
          source VARCHAR(120) NULL,
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_matches_match_id (match_id),
          KEY idx_matches_league (league),
          KEY idx_matches_status (status),
          KEY idx_matches_updated_at (updated_at)
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS match_score_history (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          match_id VARCHAR(255) NOT NULL,
          state_hash VARCHAR(255) NOT NULL,
          team_home VARCHAR(255) NOT NULL,
          team_away VARCHAR(255) NOT NULL,
          league VARCHAR(255) NOT NULL,
          status VARCHAR(80) NOT NULL,
          minute INT NOT NULL DEFAULT 0,
          score_home INT NOT NULL DEFAULT 0,
          score_away INT NOT NULL DEFAULT 0,
          source VARCHAR(120) NULL,
          snapshot_json LONGTEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_match_score_history_state (match_id, state_hash),
          KEY idx_match_score_history_match_id_created_at (match_id, created_at)
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS match_tracking_runs (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          tracker_key VARCHAR(120) NOT NULL,
          source VARCHAR(120) NOT NULL DEFAULT 'liveFeed',
          status VARCHAR(40) NOT NULL DEFAULT 'ok',
          live_count INT NOT NULL DEFAULT 0,
          upcoming_count INT NOT NULL DEFAULT 0,
          finished_count INT NOT NULL DEFAULT 0,
          total_count INT NOT NULL DEFAULT 0,
          snapshot_json LONGTEXT NULL,
          error_text TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_match_tracking_runs_tracker_key_created_at (tracker_key, created_at)
        )
      `);

      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS match_tracking_state (
          id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          tracker_key VARCHAR(120) NOT NULL,
          enabled TINYINT(1) NOT NULL DEFAULT 1,
          interval_seconds INT NOT NULL DEFAULT 60,
          total_runs INT NOT NULL DEFAULT 0,
          last_started_at DATETIME NULL,
          last_completed_at DATETIME NULL,
          last_success_at DATETIME NULL,
          last_error_at DATETIME NULL,
          last_error_text TEXT NULL,
          last_snapshot_json LONGTEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_match_tracking_state_tracker_key (tracker_key)
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

async function initPostgres() {
  if (!postgresRequested) return false;
  if (postgresInitPromise) return postgresInitPromise;

  postgresInitPromise = (async () => {
    try {
      postgresPool = new Pool(postgresConfig);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS coupon_generations (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          size INTEGER NULL,
          league TEXT NULL,
          risk TEXT NULL,
          source TEXT NULL,
          saved_options_json JSONB NULL,
          summary_json JSONB NULL,
          coupon_json JSONB NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS coupon_validations (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          drift_threshold DOUBLE PRECISION NULL,
          status TEXT NULL,
          saved_options_json JSONB NULL,
          request_json JSONB NULL,
          report_json JSONB NULL,
          error_text TEXT NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS telegram_logs (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          kind TEXT NULL,
          status TEXT NULL,
          message TEXT NULL,
          saved_options_json JSONB NULL,
          payload_json JSONB NULL,
          response_json JSONB NULL,
          error_text TEXT NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS telegram_sessions (
          id BIGSERIAL PRIMARY KEY,
          chat_id TEXT NOT NULL UNIQUE,
          username TEXT NULL,
          preferences_json JSONB NULL,
          last_coupon_json JSONB NULL,
          last_ladder_json JSONB NULL,
          last_match_id TEXT NULL,
          last_mode TEXT NULL,
          state_json JSONB NULL,
          pending_actions_json JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS audit_reports (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          audit_id TEXT NOT NULL,
          action TEXT NULL,
          saved_options_json JSONB NULL,
          payload_json JSONB NULL,
          result_json JSONB NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS generated_assets (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          kind TEXT NOT NULL,
          page TEXT NULL,
          action TEXT NULL,
          label TEXT NULL,
          file_name TEXT NULL,
          format TEXT NULL,
          mime_type TEXT NULL,
          source TEXT NULL,
          related_id TEXT NULL,
          asset_json JSONB NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS favorites (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT NULL,
          coupon_id TEXT NOT NULL,
          coupon_json JSONB NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS watchlists (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT NOT NULL UNIQUE,
          match_ids_json JSONB NULL,
          snapshot_json JSONB NULL
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS matches (
          id BIGSERIAL PRIMARY KEY,
          match_id TEXT NOT NULL UNIQUE,
          team_home TEXT NOT NULL,
          team_away TEXT NOT NULL,
          league TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'upcoming',
          minute INTEGER NOT NULL DEFAULT 0,
          start_time_unix BIGINT NULL,
          score_home INTEGER NOT NULL DEFAULT 0,
          score_away INTEGER NOT NULL DEFAULT 0,
          odds_json JSONB NULL,
          prediction_json JSONB NULL,
          source TEXT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS match_score_history (
          id BIGSERIAL PRIMARY KEY,
          match_id TEXT NOT NULL,
          state_hash TEXT NOT NULL,
          team_home TEXT NOT NULL,
          team_away TEXT NOT NULL,
          league TEXT NOT NULL,
          status TEXT NOT NULL,
          minute INTEGER NOT NULL DEFAULT 0,
          score_home INTEGER NOT NULL DEFAULT 0,
          score_away INTEGER NOT NULL DEFAULT 0,
          source TEXT NULL,
          snapshot_json JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(match_id, state_hash)
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS match_tracking_runs (
          id BIGSERIAL PRIMARY KEY,
          tracker_key TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'liveFeed',
          status TEXT NOT NULL DEFAULT 'ok',
          live_count INTEGER NOT NULL DEFAULT 0,
          upcoming_count INTEGER NOT NULL DEFAULT 0,
          finished_count INTEGER NOT NULL DEFAULT 0,
          total_count INTEGER NOT NULL DEFAULT 0,
          snapshot_json JSONB NULL,
          error_text TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS match_tracking_state (
          id BIGSERIAL PRIMARY KEY,
          tracker_key TEXT NOT NULL UNIQUE,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          interval_seconds INTEGER NOT NULL DEFAULT 60,
          total_runs INTEGER NOT NULL DEFAULT 0,
          last_started_at TIMESTAMPTZ NULL,
          last_completed_at TIMESTAMPTZ NULL,
          last_success_at TIMESTAMPTZ NULL,
          last_error_at TIMESTAMPTZ NULL,
          last_error_text TEXT NULL,
          last_snapshot_json JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS mobile_devices (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          user_id TEXT NULL,
          platform TEXT NOT NULL,
          device_id TEXT NOT NULL,
          push_token TEXT NULL,
          app_version TEXT NULL,
          meta_json JSONB NULL,
          UNIQUE(platform, device_id)
        )
      `);

      await postgresPool.query(`
        CREATE TABLE IF NOT EXISTS update_history (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          version TEXT NULL,
          title TEXT NOT NULL,
          summary TEXT NULL,
          details TEXT NULL,
          highlights_json JSONB NULL,
          category TEXT NULL,
          author TEXT NULL,
          pinned BOOLEAN NOT NULL DEFAULT FALSE
        )
      `);

      postgresReady = true;
      postgresInitError = null;
      return true;
    } catch (error) {
      postgresReady = false;
      postgresInitError = error;
      return false;
    }
  })();

  return postgresInitPromise;
}

async function canUsePostgres() {
  if (!postgresRequested) return false;
  if (postgresReady && postgresPool) return true;
  return initPostgres();
}

async function saveCouponGeneration(entry = {}) {
  const savedOptions = buildSavedOptions(entry);
  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO coupon_generations (size, league, risk, source, saved_options_json, summary_json, coupon_json)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)
       RETURNING id`,
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
    return result.rows[0]?.id || null;
  }
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
  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO coupon_validations (drift_threshold, status, saved_options_json, request_json, report_json, error_text)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6)
       RETURNING id`,
      [
        Number(entry.driftThreshold) || null,
        entry.status ? String(entry.status) : "unknown",
        toJson(savedOptions, {}),
        toJson(entry.request || {}, {}),
        toJson(entry.report || {}, {}),
        entry.error ? String(entry.error) : null,
      ]
    );
    return result.rows[0]?.id || null;
  }
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
  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO telegram_logs (kind, status, message, saved_options_json, payload_json, response_json, error_text)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
       RETURNING id`,
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
    return result.rows[0]?.id || null;
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO telegram_sessions (
         chat_id, username, preferences_json, last_coupon_json, last_ladder_json,
         last_match_id, last_mode, state_json, pending_actions_json, updated_at, last_seen_at
       ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8::jsonb, $9::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (chat_id) DO UPDATE SET
         username = EXCLUDED.username,
         preferences_json = EXCLUDED.preferences_json,
         last_coupon_json = EXCLUDED.last_coupon_json,
         last_ladder_json = EXCLUDED.last_ladder_json,
         last_match_id = EXCLUDED.last_match_id,
         last_mode = EXCLUDED.last_mode,
         state_json = EXCLUDED.state_json,
         pending_actions_json = EXCLUDED.pending_actions_json,
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP
       RETURNING id, chat_id, username, preferences_json, last_coupon_json, last_ladder_json, last_match_id, last_mode, state_json, pending_actions_json, created_at, updated_at, last_seen_at`,
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
    const row = result.rows[0];
    return {
      id: row?.id || null,
      chatId: row?.chat_id || chatId,
      username: row?.username || username,
      preferences: row?.preferences_json || {},
      lastCoupon: row?.last_coupon_json || {},
      lastLadder: row?.last_ladder_json || {},
      lastMatchId: row?.last_match_id || lastMatchId,
      lastMode: row?.last_mode || lastMode,
      state: row?.state_json || {},
      pendingActions: row?.pending_actions_json || [],
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      lastSeenAt: normalizeDate(row?.last_seen_at),
    };
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, chat_id, username, preferences_json, last_coupon_json, last_ladder_json, last_match_id, last_mode, state_json, pending_actions_json, created_at, updated_at, last_seen_at
       FROM telegram_sessions
       WHERE chat_id = $1
       LIMIT 1`,
      [safeChatId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      chatId: row.chat_id,
      username: row.username || null,
      preferences: row.preferences_json || {},
      lastCoupon: row.last_coupon_json || {},
      lastLadder: row.last_ladder_json || {},
      lastMatchId: row.last_match_id || null,
      lastMode: row.last_mode || null,
      state: row.state_json || {},
      pendingActions: row.pending_actions_json || [],
      createdAt: normalizeDate(row.created_at),
      updatedAt: normalizeDate(row.updated_at),
      lastSeenAt: normalizeDate(row.last_seen_at),
    };
  }
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

function normalizeTrackedMatchEntry(match = {}, extra = {}) {
  const teamHome = String(match.teamHome || match.team1 || match.homeTeam || match.O1 || "").trim();
  const teamAway = String(match.teamAway || match.team2 || match.awayTeam || match.O2 || "").trim();
  const league = String(match.league || extra.league || "").trim() || "unknown";
  const status = String(match.status || extra.status || "upcoming").trim().toLowerCase();
  const minute = Number(match.minute ?? extra.minute ?? 0) || 0;
  const startTimeUnix = Number(match.startTimeUnix ?? match.start_time_unix ?? extra.startTimeUnix ?? 0) || null;
  const scoreHome = Number(match.scoreHome ?? match.score1 ?? match.homeScore ?? 0) || 0;
  const scoreAway = Number(match.scoreAway ?? match.score2 ?? match.awayScore ?? 0) || 0;

  return {
    matchId: String(match.matchId || match.id || match.match_id || extra.matchId || "").trim(),
    teamHome: teamHome || "Equipe 1",
    teamAway: teamAway || "Equipe 2",
    league,
    status,
    minute,
    startTimeUnix,
    scoreHome,
    scoreAway,
    odds: normalizeObject(match.odds || match.odd || {}),
    prediction: normalizeObject(match.prediction || extra.prediction || {}),
    source: String(match.source || extra.source || "liveFeed").trim(),
  };
}

function buildMatchScoreStateHash(match = {}) {
  return [match.status || "unknown", Number(match.minute) || 0, Number(match.scoreHome) || 0, Number(match.scoreAway) || 0].join("|");
}

function buildMatchScoreSnapshot(match = {}, extra = {}) {
  return normalizeObject({
    matchId: match.matchId || extra.matchId || null,
    teamHome: match.teamHome || extra.teamHome || null,
    teamAway: match.teamAway || extra.teamAway || null,
    league: match.league || extra.league || null,
    status: match.status || extra.status || null,
    minute: Number(match.minute) || 0,
    scoreHome: Number(match.scoreHome) || 0,
    scoreAway: Number(match.scoreAway) || 0,
    source: match.source || extra.source || "liveFeed",
    odds: normalizeObject(match.odds || extra.odds || {}),
    prediction: normalizeObject(match.prediction || extra.prediction || {}),
    observedAt: extra.observedAt || new Date().toISOString(),
  });
}

async function saveMatchScoreHistory(entry = {}) {
  const match = normalizeTrackedMatchEntry(entry, entry);
  if (!match.matchId) {
    throw new Error("match_id requis");
  }

  const stateHash = buildMatchScoreStateHash(match);
  const snapshot = buildMatchScoreSnapshot(match, entry.snapshot || entry);

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO match_score_history (
         match_id, state_hash, team_home, team_away, league, status, minute, score_home, score_away, source, snapshot_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       ON CONFLICT (match_id, state_hash) DO NOTHING
       RETURNING id`,
      [
        match.matchId,
        stateHash,
        match.teamHome,
        match.teamAway,
        match.league,
        match.status,
        match.minute,
        match.scoreHome,
        match.scoreAway,
        match.source,
        toJson(snapshot, {}),
      ]
    );
    return {
      matchId: match.matchId,
      stateHash,
      inserted: result.rowCount > 0,
    };
  }
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT IGNORE INTO match_score_history (
         match_id, state_hash, team_home, team_away, league, status, minute, score_home, score_away, source, snapshot_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        match.matchId,
        stateHash,
        match.teamHome,
        match.teamAway,
        match.league,
        match.status,
        match.minute,
        match.scoreHome,
        match.scoreAway,
        match.source,
        toJson(snapshot, {}),
      ]
    );
    return {
      matchId: match.matchId,
      stateHash,
      inserted: Number(result?.affectedRows) > 0,
    };
  }

  const result = sqliteInsertMatchScoreHistoryStmt.run(
    match.matchId,
    stateHash,
    match.teamHome,
    match.teamAway,
    match.league,
    match.status,
    match.minute,
    match.scoreHome,
    match.scoreAway,
    match.source,
    toJson(snapshot, {})
  );
  return {
    matchId: match.matchId,
    stateHash,
    inserted: Number(result?.changes) > 0,
  };
}

async function upsertTrackedMatch(entry = {}) {
  const match = normalizeTrackedMatchEntry(entry);
  if (!match.matchId) {
    throw new Error("match_id requis");
  }

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO matches (
         match_id, team_home, team_away, league, status, minute, start_time_unix,
         score_home, score_away, odds_json, prediction_json, source, last_seen_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (match_id) DO UPDATE SET
         team_home = EXCLUDED.team_home,
         team_away = EXCLUDED.team_away,
         league = EXCLUDED.league,
         status = EXCLUDED.status,
         minute = EXCLUDED.minute,
         start_time_unix = EXCLUDED.start_time_unix,
         score_home = EXCLUDED.score_home,
         score_away = EXCLUDED.score_away,
         odds_json = EXCLUDED.odds_json,
         prediction_json = EXCLUDED.prediction_json,
         source = EXCLUDED.source,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, match_id, team_home, team_away, league, status, minute, start_time_unix, score_home, score_away, odds_json, prediction_json, source, last_seen_at, created_at, updated_at`,
      [
        match.matchId,
        match.teamHome,
        match.teamAway,
        match.league,
        match.status,
        match.minute,
        match.startTimeUnix,
        match.scoreHome,
        match.scoreAway,
        toJson(match.odds, {}),
        toJson(match.prediction, {}),
        match.source,
      ]
    );
    const row = result.rows[0];
    try {
      await saveMatchScoreHistory(match);
    } catch (historyError) {
      console.warn(`Impossible de persister l'historique du score pour ${match.matchId}: ${historyError.message}`);
    }
    return {
      id: row?.id || null,
      matchId: row?.match_id || match.matchId,
      teamHome: row?.team_home || match.teamHome,
      teamAway: row?.team_away || match.teamAway,
      league: row?.league || match.league,
      status: row?.status || match.status,
      minute: Number(row?.minute) || match.minute,
      startTimeUnix: row?.start_time_unix ? Number(row.start_time_unix) : match.startTimeUnix,
      scoreHome: Number(row?.score_home) || match.scoreHome,
      scoreAway: Number(row?.score_away) || match.scoreAway,
      odds: row?.odds_json || {},
      prediction: row?.prediction_json || {},
      source: row?.source || match.source,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      lastSeenAt: normalizeDate(row?.last_seen_at),
    };
  }
  if (await canUseMySql()) {
    await mysqlPool.execute(
      `INSERT INTO matches (
         match_id, team_home, team_away, league, status, minute, start_time_unix,
         score_home, score_away, odds_json, prediction_json, source, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         team_home = VALUES(team_home),
         team_away = VALUES(team_away),
         league = VALUES(league),
         status = VALUES(status),
         minute = VALUES(minute),
         start_time_unix = VALUES(start_time_unix),
         score_home = VALUES(score_home),
         score_away = VALUES(score_away),
         odds_json = VALUES(odds_json),
         prediction_json = VALUES(prediction_json),
         source = VALUES(source),
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        match.matchId,
        match.teamHome,
        match.teamAway,
        match.league,
        match.status,
        match.minute,
        match.startTimeUnix,
        match.scoreHome,
        match.scoreAway,
        toJson(match.odds, {}),
        toJson(match.prediction, {}),
        match.source,
      ]
    );
    const [rows] = await mysqlPool.execute(
      `SELECT id, match_id, team_home, team_away, league, status, minute, start_time_unix, score_home, score_away, odds_json, prediction_json, source, last_seen_at, created_at, updated_at
       FROM matches
       WHERE match_id = ?
       LIMIT 1`,
      [match.matchId]
    );
    const row = rows[0];
    try {
      await saveMatchScoreHistory(match);
    } catch (historyError) {
      console.warn(`Impossible de persister l'historique du score pour ${match.matchId}: ${historyError.message}`);
    }
    return {
      id: row?.id || null,
      matchId: row?.match_id || match.matchId,
      teamHome: row?.team_home || match.teamHome,
      teamAway: row?.team_away || match.teamAway,
      league: row?.league || match.league,
      status: row?.status || match.status,
      minute: Number(row?.minute) || match.minute,
      startTimeUnix: row?.start_time_unix ? Number(row.start_time_unix) : match.startTimeUnix,
      scoreHome: Number(row?.score_home) || match.scoreHome,
      scoreAway: Number(row?.score_away) || match.scoreAway,
      odds: parseJsonSafe(row?.odds_json, {}),
      prediction: parseJsonSafe(row?.prediction_json, {}),
      source: row?.source || match.source,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      lastSeenAt: normalizeDate(row?.last_seen_at),
    };
  }

  sqliteUpsertTrackedMatchStmt.run(
    match.matchId,
    match.teamHome,
    match.teamAway,
    match.league,
    match.status,
    match.minute,
    match.startTimeUnix,
    match.scoreHome,
    match.scoreAway,
    toJson(match.odds, {}),
    toJson(match.prediction, {}),
    match.source
  );
  const row = sqliteSelectTrackedMatchStmt.get(match.matchId);
  try {
    await saveMatchScoreHistory(match);
  } catch (historyError) {
    console.warn(`Impossible de persister l'historique du score pour ${match.matchId}: ${historyError.message}`);
  }
  return {
    id: row?.id || null,
    matchId: row?.match_id || match.matchId,
    teamHome: row?.team_home || match.teamHome,
    teamAway: row?.team_away || match.teamAway,
    league: row?.league || match.league,
    status: row?.status || match.status,
    minute: Number(row?.minute) || match.minute,
    startTimeUnix: row?.start_time_unix ? Number(row.start_time_unix) : match.startTimeUnix,
    scoreHome: Number(row?.score_home) || match.scoreHome,
    scoreAway: Number(row?.score_away) || match.scoreAway,
    odds: parseJsonSafe(row?.odds_json, {}),
    prediction: parseJsonSafe(row?.prediction_json, {}),
    source: row?.source || match.source,
    createdAt: row?.created_at || null,
    updatedAt: row?.updated_at || null,
    lastSeenAt: row?.last_seen_at || null,
  };
}

async function saveMatchTrackingRun(entry = {}) {
  const trackerKey = normalizeKey(entry.trackerKey, "default");
  const snapshot = normalizeObject(entry.snapshot);
  const counts = normalizeObject(entry.counts);
  const status = String(entry.status || (entry.error ? "error" : "ok")).trim().toLowerCase();
  const payload = {
    trackerKey,
    source: String(entry.source || "liveFeed").trim() || "liveFeed",
    status,
    liveCount: Number(counts.live ?? entry.liveCount ?? 0) || 0,
    upcomingCount: Number(counts.upcoming ?? entry.upcomingCount ?? 0) || 0,
    finishedCount: Number(counts.finished ?? entry.finishedCount ?? 0) || 0,
    totalCount: Number(counts.total ?? entry.totalCount ?? 0) || 0,
    snapshot,
    errorText: entry.error ? String(entry.error) : null,
  };

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO match_tracking_runs (
         tracker_key, source, status, live_count, upcoming_count, finished_count, total_count, snapshot_json, error_text
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING id`,
      [
        payload.trackerKey,
        payload.source,
        payload.status,
        payload.liveCount,
        payload.upcomingCount,
        payload.finishedCount,
        payload.totalCount,
        toJson(payload.snapshot, {}),
        payload.errorText,
      ]
    );
    return result.rows[0]?.id || null;
  }
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO match_tracking_runs (
         tracker_key, source, status, live_count, upcoming_count, finished_count, total_count, snapshot_json, error_text
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.trackerKey,
        payload.source,
        payload.status,
        payload.liveCount,
        payload.upcomingCount,
        payload.finishedCount,
        payload.totalCount,
        toJson(payload.snapshot, {}),
        payload.errorText,
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertMatchTrackingRunStmt.run(
    payload.trackerKey,
    payload.source,
    payload.status,
    payload.liveCount,
    payload.upcomingCount,
    payload.finishedCount,
    payload.totalCount,
    toJson(payload.snapshot, {}),
    payload.errorText
  );
  return result.lastInsertRowid;
}

async function upsertMatchTrackingState(entry = {}) {
  const trackerKey = normalizeKey(entry.trackerKey, "default");
  const snapshot = normalizeObject(entry.snapshot);
  const payload = {
    trackerKey,
    enabled: entry.enabled === false ? 0 : 1,
    intervalSeconds: Math.max(10, Number(entry.intervalSeconds) || 60),
    totalRuns: Math.max(0, Number(entry.totalRuns) || 0),
    lastStartedAt: entry.lastStartedAt || null,
    lastCompletedAt: entry.lastCompletedAt || null,
    lastSuccessAt: entry.lastSuccessAt || null,
    lastErrorAt: entry.lastErrorAt || null,
    lastErrorText: entry.lastErrorText ? String(entry.lastErrorText) : null,
    lastSnapshot: snapshot,
  };

  if (await canUsePostgres()) {
    await postgresPool.query(
      `INSERT INTO match_tracking_state (
         tracker_key, enabled, interval_seconds, total_runs, last_started_at, last_completed_at,
         last_success_at, last_error_at, last_error_text, last_snapshot_json, updated_at, last_seen_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (tracker_key) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         interval_seconds = EXCLUDED.interval_seconds,
         total_runs = EXCLUDED.total_runs,
         last_started_at = EXCLUDED.last_started_at,
         last_completed_at = EXCLUDED.last_completed_at,
         last_success_at = EXCLUDED.last_success_at,
         last_error_at = EXCLUDED.last_error_at,
         last_error_text = EXCLUDED.last_error_text,
         last_snapshot_json = EXCLUDED.last_snapshot_json,
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP`,
      [
        payload.trackerKey,
        Boolean(payload.enabled),
        payload.intervalSeconds,
        payload.totalRuns,
        payload.lastStartedAt,
        payload.lastCompletedAt,
        payload.lastSuccessAt,
        payload.lastErrorAt,
        payload.lastErrorText,
        toJson(payload.lastSnapshot, {}),
      ]
    );
    return getMatchTrackingState(trackerKey);
  }
  if (await canUseMySql()) {
    await mysqlPool.execute(
      `INSERT INTO match_tracking_state (
         tracker_key, enabled, interval_seconds, total_runs, last_started_at, last_completed_at,
         last_success_at, last_error_at, last_error_text, last_snapshot_json, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         enabled = VALUES(enabled),
         interval_seconds = VALUES(interval_seconds),
         total_runs = VALUES(total_runs),
         last_started_at = VALUES(last_started_at),
         last_completed_at = VALUES(last_completed_at),
         last_success_at = VALUES(last_success_at),
         last_error_at = VALUES(last_error_at),
         last_error_text = VALUES(last_error_text),
         last_snapshot_json = VALUES(last_snapshot_json),
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP`,
      [
        payload.trackerKey,
        payload.enabled,
        payload.intervalSeconds,
        payload.totalRuns,
        payload.lastStartedAt,
        payload.lastCompletedAt,
        payload.lastSuccessAt,
        payload.lastErrorAt,
        payload.lastErrorText,
        toJson(payload.lastSnapshot, {}),
      ]
    );
    return getMatchTrackingState(trackerKey);
  }

  sqliteUpsertMatchTrackingStateStmt.run(
    payload.trackerKey,
    payload.enabled,
    payload.intervalSeconds,
    payload.totalRuns,
    payload.lastStartedAt,
    payload.lastCompletedAt,
    payload.lastSuccessAt,
    payload.lastErrorAt,
    payload.lastErrorText,
    toJson(payload.lastSnapshot, {})
  );
  return getMatchTrackingState(trackerKey);
}

async function saveMatchTrackingSnapshot(entry = {}) {
  const trackerKey = normalizeKey(entry.trackerKey, "default");
  const matches = Array.isArray(entry.matches) ? entry.matches : [];
  const counts = {
    live: Number(entry.counts?.live) || 0,
    upcoming: Number(entry.counts?.upcoming) || 0,
    finished: Number(entry.counts?.finished) || 0,
    total: Number(entry.counts?.total) || matches.length,
  };
  const snapshot = {
    counts,
    source: String(entry.source || "liveFeed").trim() || "liveFeed",
    fetchedAt: entry.fetchedAt || new Date().toISOString(),
    matches,
  };

  for (const match of matches) {
    await upsertTrackedMatch(match);
  }

  const state = await upsertMatchTrackingState({
    trackerKey,
    enabled: entry.enabled !== false,
    intervalSeconds: entry.intervalSeconds || 60,
    totalRuns: Number(entry.totalRuns) || 0,
    lastStartedAt: entry.lastStartedAt || snapshot.fetchedAt,
    lastCompletedAt: entry.lastCompletedAt || snapshot.fetchedAt,
    lastSuccessAt: entry.lastSuccessAt || snapshot.fetchedAt,
    lastErrorAt: entry.lastErrorAt || null,
    lastErrorText: entry.lastErrorText || null,
    snapshot,
  });

  await saveMatchTrackingRun({
    trackerKey,
    source: snapshot.source,
    status: entry.error ? "error" : "ok",
    counts,
    snapshot,
    error: entry.error || null,
  });

  return {
    state,
    snapshot,
  };
}

async function getMatchTrackingState(trackerKey = "default") {
  const safeKey = normalizeKey(trackerKey, "default");

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, tracker_key, enabled, interval_seconds, total_runs, last_started_at, last_completed_at,
              last_success_at, last_error_at, last_error_text, last_snapshot_json, created_at, updated_at, last_seen_at
       FROM match_tracking_state
       WHERE tracker_key = $1
       LIMIT 1`,
      [safeKey]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      trackerKey: row.tracker_key,
      enabled: Boolean(row.enabled),
      intervalSeconds: Number(row.interval_seconds) || 60,
      totalRuns: Number(row.total_runs) || 0,
      lastStartedAt: normalizeDate(row.last_started_at),
      lastCompletedAt: normalizeDate(row.last_completed_at),
      lastSuccessAt: normalizeDate(row.last_success_at),
      lastErrorAt: normalizeDate(row.last_error_at),
      lastErrorText: row.last_error_text || null,
      lastSnapshot: row.last_snapshot_json || {},
      createdAt: normalizeDate(row.created_at),
      updatedAt: normalizeDate(row.updated_at),
      lastSeenAt: normalizeDate(row.last_seen_at),
    };
  }
  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, tracker_key, enabled, interval_seconds, total_runs, last_started_at, last_completed_at,
              last_success_at, last_error_at, last_error_text, last_snapshot_json, created_at, updated_at, last_seen_at
       FROM match_tracking_state
       WHERE tracker_key = ?
       LIMIT 1`,
      [safeKey]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      trackerKey: row.tracker_key,
      enabled: Boolean(row.enabled),
      intervalSeconds: Number(row.interval_seconds) || 60,
      totalRuns: Number(row.total_runs) || 0,
      lastStartedAt: normalizeDate(row.last_started_at),
      lastCompletedAt: normalizeDate(row.last_completed_at),
      lastSuccessAt: normalizeDate(row.last_success_at),
      lastErrorAt: normalizeDate(row.last_error_at),
      lastErrorText: row.last_error_text || null,
      lastSnapshot: parseJsonSafe(row.last_snapshot_json, {}),
      createdAt: normalizeDate(row.created_at),
      updatedAt: normalizeDate(row.updated_at),
      lastSeenAt: normalizeDate(row.last_seen_at),
    };
  }

  const row = sqliteSelectMatchTrackingStateStmt.get(safeKey);
  if (!row) return null;
  return {
    id: row.id,
    trackerKey: row.tracker_key,
    enabled: Boolean(row.enabled),
    intervalSeconds: Number(row.interval_seconds) || 60,
    totalRuns: Number(row.total_runs) || 0,
    lastStartedAt: row.last_started_at || null,
    lastCompletedAt: row.last_completed_at || null,
    lastSuccessAt: row.last_success_at || null,
    lastErrorAt: row.last_error_at || null,
    lastErrorText: row.last_error_text || null,
    lastSnapshot: parseJsonSafe(row.last_snapshot_json, {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    lastSeenAt: row.last_seen_at || null,
  };
}

async function getMatchTrackingRuns(trackerKey = "default", limit = 20) {
  const key = normalizeKey(trackerKey, "default");
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, tracker_key, source, status, live_count, upcoming_count, finished_count, total_count, snapshot_json, error_text, created_at
       FROM match_tracking_runs
       WHERE tracker_key = $1
       ORDER BY id DESC
       LIMIT $2`,
      [key, safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      trackerKey: row.tracker_key,
      source: row.source,
      status: row.status,
      counts: {
        live: Number(row.live_count) || 0,
        upcoming: Number(row.upcoming_count) || 0,
        finished: Number(row.finished_count) || 0,
        total: Number(row.total_count) || 0,
      },
      snapshot: row.snapshot_json || {},
      error: row.error_text || null,
      createdAt: normalizeDate(row.created_at),
    }));
  }
  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, tracker_key, source, status, live_count, upcoming_count, finished_count, total_count, snapshot_json, error_text, created_at
       FROM match_tracking_runs
       WHERE tracker_key = ?
       ORDER BY id DESC
       LIMIT ?`,
      [key, safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      trackerKey: row.tracker_key,
      source: row.source,
      status: row.status,
      counts: {
        live: Number(row.live_count) || 0,
        upcoming: Number(row.upcoming_count) || 0,
        finished: Number(row.finished_count) || 0,
        total: Number(row.total_count) || 0,
      },
      snapshot: parseJsonSafe(row.snapshot_json, {}),
      error: row.error_text || null,
      createdAt: normalizeDate(row.created_at),
    }));
  }

  return sqliteSelectMatchTrackingRunsStmt.all(key, safeLimit).map((row) => ({
    id: row.id,
    trackerKey: row.tracker_key,
    source: row.source,
    status: row.status,
    counts: {
      live: Number(row.live_count) || 0,
      upcoming: Number(row.upcoming_count) || 0,
      finished: Number(row.finished_count) || 0,
      total: Number(row.total_count) || 0,
    },
    snapshot: parseJsonSafe(row.snapshot_json, {}),
    error: row.error_text || null,
    createdAt: row.created_at,
  }));
}

async function getTrackedMatches(limit = 50) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
  const mapTrackedRow = (row = {}, parser = parseJsonSafe) => ({
    id: row.id,
    matchId: row.match_id,
    teamHome: row.team_home ?? row.team1 ?? null,
    teamAway: row.team_away ?? row.team2 ?? null,
    league: row.league,
    status: row.status,
    minute: Number(row.minute) || 0,
    startTimeUnix: row.start_time_unix ? Number(row.start_time_unix) : null,
    scoreHome: Number(row.score_home ?? row.score1 ?? 0) || 0,
    scoreAway: Number(row.score_away ?? row.score2 ?? 0) || 0,
    odds: parser(row.odds_json ?? row.odds, {}),
    prediction: parser(row.prediction_json ?? row.prediction, {}),
    source: row.source || null,
    createdAt: row.created_at ? normalizeDate(row.created_at) : null,
    updatedAt: row.updated_at ? normalizeDate(row.updated_at) : null,
    lastSeenAt: row.last_seen_at ? normalizeDate(row.last_seen_at) : null,
  });

  if (await canUsePostgres()) {
    // Requête minimale - seulement colonnes garanties d'exister
    const result = await postgresPool.query(
      `SELECT id, match_id, league, status, minute, source, created_at, updated_at, last_seen_at
       FROM matches
       ORDER BY updated_at DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((row) => mapTrackedRow(row, (value, fallback) => value ?? fallback));
  }
  if (await canUseMySql()) {
    // Requête minimale - seulement colonnes garanties d'exister
    const [rows] = await mysqlPool.execute(
      `SELECT id, match_id, league, status, minute, source, created_at, updated_at, last_seen_at
       FROM matches
       ORDER BY updated_at DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => mapTrackedRow(row));
  }

  // SQLite minimal - seulement colonnes garanties d'exister
  const sqliteRows = sqliteDb.prepare(
    `SELECT id, match_id, league, status, minute, source, created_at, updated_at, last_seen_at
     FROM matches
     ORDER BY updated_at DESC
     LIMIT ?`
  ).all(safeLimit);
  return sqliteRows.map((row) => mapTrackedRow(row));
}

async function getMatchScoreHistory(matchId, limit = 120) {
  const safeMatchId = String(matchId || "").trim();
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 120));
  if (!safeMatchId) {
    return [];
  }

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, match_id, state_hash, team_home, team_away, league, status, minute, score_home, score_away, source, snapshot_json, created_at
       FROM match_score_history
       WHERE match_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [safeMatchId, safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      stateHash: row.state_hash,
      teamHome: row.team_home,
      teamAway: row.team_away,
      league: row.league,
      status: row.status,
      minute: Number(row.minute) || 0,
      scoreHome: Number(row.score_home) || 0,
      scoreAway: Number(row.score_away) || 0,
      source: row.source || null,
      snapshot: row.snapshot_json || {},
      createdAt: normalizeDate(row.created_at),
    }));
  }
  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, match_id, state_hash, team_home, team_away, league, status, minute, score_home, score_away, source, snapshot_json, created_at
       FROM match_score_history
       WHERE match_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [safeMatchId, safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      matchId: row.match_id,
      stateHash: row.state_hash,
      teamHome: row.team_home,
      teamAway: row.team_away,
      league: row.league,
      status: row.status,
      minute: Number(row.minute) || 0,
      scoreHome: Number(row.score_home) || 0,
      scoreAway: Number(row.score_away) || 0,
      source: row.source || null,
      snapshot: parseJsonSafe(row.snapshot_json, {}),
      createdAt: normalizeDate(row.created_at),
    }));
  }

  return sqliteSelectMatchScoreHistoryStmt.all(safeMatchId, safeLimit).map((row) => ({
    id: row.id,
    matchId: row.match_id,
    stateHash: row.state_hash,
    teamHome: row.team_home,
    teamAway: row.team_away,
    league: row.league,
    status: row.status,
    minute: Number(row.minute) || 0,
    scoreHome: Number(row.score_home) || 0,
    scoreAway: Number(row.score_away) || 0,
    source: row.source || null,
    snapshot: parseJsonSafe(row.snapshot_json, {}),
    createdAt: row.created_at || null,
  }));
}

async function saveAuditReport(entry = {}) {
  const auditId = entry.auditId ? String(entry.auditId) : `AUD-${Date.now()}`;
  const savedOptions = buildSavedOptions(entry);

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO audit_reports (audit_id, action, saved_options_json, payload_json, result_json)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
       RETURNING id`,
      [
        auditId,
        entry.action ? String(entry.action) : "unknown",
        toJson(savedOptions, {}),
        toJson(entry.payload || {}, {}),
        toJson(entry.result || {}, {}),
      ]
    );
    return { id: result.rows[0]?.id || null, auditId };
  }
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

async function saveGeneratedAsset(entry = {}) {
  const asset = normalizeGeneratedAsset(entry);
  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO generated_assets (
         kind, page, action, label, file_name, format, mime_type, source, related_id, asset_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id`,
      [
        asset.kind,
        asset.page,
        asset.action,
        asset.label,
        asset.fileName,
        asset.format,
        asset.mimeType,
        asset.source,
        asset.relatedId,
        toJson(asset.asset, {}),
      ]
    );
    return result.rows[0]?.id || null;
  }
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO generated_assets (
         kind, page, action, label, file_name, format, mime_type, source, related_id, asset_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        asset.kind,
        asset.page,
        asset.action,
        asset.label,
        asset.fileName,
        asset.format,
        asset.mimeType,
        asset.source,
        asset.relatedId,
        toJson(asset.asset, {}),
      ]
    );
    return result.insertId;
  }

  const result = sqliteInsertGeneratedAssetStmt.run(
    asset.kind,
    asset.page,
    asset.action,
    asset.label,
    asset.fileName,
    asset.format,
    asset.mimeType,
    asset.source,
    asset.relatedId,
    toJson(asset.asset, {})
  );
  return result.lastInsertRowid;
}

async function getGeneratedAssets(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, kind, page, action, label, file_name, format, mime_type, source, related_id, asset_json
       FROM generated_assets
       ORDER BY id DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      kind: row.kind,
      page: row.page || null,
      action: row.action || null,
      label: row.label || null,
      fileName: row.file_name || null,
      format: row.format || null,
      mimeType: row.mime_type || null,
      source: row.source || null,
      relatedId: row.related_id || null,
      asset: row.asset_json || {},
    }));
  }
  if (await canUseMySql()) {
    const [rows] = await mysqlPool.execute(
      `SELECT id, created_at, kind, page, action, label, file_name, format, mime_type, source, related_id, asset_json
       FROM generated_assets
       ORDER BY id DESC
       LIMIT ?`,
      [safeLimit]
    );
    return rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      kind: row.kind,
      page: row.page || null,
      action: row.action || null,
      label: row.label || null,
      fileName: row.file_name || null,
      format: row.format || null,
      mimeType: row.mime_type || null,
      source: row.source || null,
      relatedId: row.related_id || null,
      asset: parseJsonSafe(row.asset_json, {}),
    }));
  }

  return sqliteSelectGeneratedAssetsStmt.all(safeLimit).map((row) => ({
    id: row.id,
    createdAt: row.created_at || null,
    kind: row.kind,
    page: row.page || null,
    action: row.action || null,
    label: row.label || null,
    fileName: row.file_name || null,
    format: row.format || null,
    mimeType: row.mime_type || null,
    source: row.source || null,
    relatedId: row.related_id || null,
    asset: parseJsonSafe(row.asset_json, {}),
  }));
}

async function getCouponHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, size, league, risk, source, saved_options_json, summary_json, coupon_json
       FROM coupon_generations
       ORDER BY id DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      size: row.size,
      league: row.league,
      risk: row.risk,
      source: row.source,
      savedOptions: row.saved_options_json || {},
      summary: row.summary_json || {},
      coupon: row.coupon_json || [],
    }));
  }
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

async function deleteGeneratedAsset(id) {
  const safeId = Number(id);
  if (!safeId || safeId <= 0) return false;

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `DELETE FROM generated_assets WHERE id = $1 RETURNING id`,
      [safeId]
    );
    return result.rowCount > 0;
  }
  if (await canUseMySql()) {
    const [result] = await mysqlPool.execute(
      `DELETE FROM generated_assets WHERE id = ?`,
      [safeId]
    );
    return result.affectedRows > 0;
  }

  const result = sqliteDeleteGeneratedAssetStmt.run(safeId);
  return result.changes > 0;
}

async function deleteGeneratedAssets(ids = []) {
  const safeIds = ids.map(Number).filter(id => id > 0);
  if (!safeIds.length) return 0;

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `DELETE FROM generated_assets WHERE id = ANY($1)`,
      [safeIds]
    );
    return result.rowCount || 0;
  }
  if (await canUseMySql()) {
    const placeholders = safeIds.map(() => '?').join(',');
    const [result] = await mysqlPool.execute(
      `DELETE FROM generated_assets WHERE id IN (${placeholders})`,
      safeIds
    );
    return result.affectedRows || 0;
  }

  let deleted = 0;
  for (const id of safeIds) {
    const result = sqliteDeleteGeneratedAssetStmt.run(id);
    deleted += result.changes;
  }
  return deleted;
}

async function getTelegramHistory(limit = 20) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20));

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, kind, status, message, saved_options_json, payload_json, response_json, error_text
       FROM telegram_logs
       ORDER BY id DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      kind: row.kind,
      status: row.status,
      message: row.message,
      savedOptions: row.saved_options_json || {},
      payload: row.payload_json || {},
      response: row.response_json || {},
      error: row.error_text || null,
    }));
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO favorites (user_id, coupon_id, coupon_json)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id`,
      [userId, couponId, toJson(entry.coupon || {}, {})]
    );
    return result.rows[0]?.id || null;
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, user_id, coupon_id, coupon_json
       FROM favorites
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT $2`,
      [safeUserId, safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      userId: row.user_id,
      couponId: row.coupon_id,
      coupon: row.coupon_json || {},
    }));
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO watchlists (user_id, match_ids_json, snapshot_json, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         match_ids_json = EXCLUDED.match_ids_json,
         snapshot_json = EXCLUDED.snapshot_json,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, created_at, updated_at, user_id, match_ids_json, snapshot_json`,
      [userId, toJson(matchIds, []), toJson(snapshot, {})]
    );
    const row = result.rows[0];
    return {
      id: row?.id || null,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      userId: row?.user_id || userId,
      matchIds: row?.match_ids_json || [],
      snapshot: row?.snapshot_json || {},
    };
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, updated_at, user_id, match_ids_json, snapshot_json
       FROM watchlists
       WHERE user_id = $1
       LIMIT 1`,
      [safeUserId]
    );
    const row = result.rows[0];
    return {
      id: row?.id || null,
      createdAt: normalizeDate(row?.created_at),
      updatedAt: normalizeDate(row?.updated_at),
      userId: row?.user_id || safeUserId,
      matchIds: row?.match_ids_json || [],
      snapshot: row?.snapshot_json || {},
    };
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO mobile_devices (user_id, platform, device_id, push_token, app_version, meta_json, updated_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (platform, device_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         push_token = EXCLUDED.push_token,
         app_version = EXCLUDED.app_version,
         meta_json = EXCLUDED.meta_json,
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP
       RETURNING id, created_at, updated_at, last_seen_at, user_id, platform, device_id, push_token, app_version, meta_json`,
      [userId, platform, deviceId, pushToken, appVersion, toJson(meta, {})]
    );
    const row = result.rows[0];
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
      meta: row?.meta_json || {},
    };
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `INSERT INTO update_history (version, title, summary, details, highlights_json, category, author, pinned)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING id`,
      [
        record.version,
        record.title,
        record.summary,
        record.details,
        toJson(record.highlights, []),
        record.category,
        record.author,
        Boolean(record.pinned),
      ]
    );
    return result.rows[0]?.id || null;
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, version, title, summary, details, highlights_json, category, author, pinned
       FROM update_history
       ORDER BY id DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      version: row.version || null,
      title: row.title || "",
      summary: row.summary || "",
      details: row.details || "",
      highlights: row.highlights_json || [],
      category: row.category || null,
      author: row.author || null,
      pinned: Boolean(row.pinned),
    }));
  }
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

  if (await canUsePostgres()) {
    const result = await postgresPool.query(
      `SELECT id, created_at, audit_id, action, saved_options_json, payload_json, result_json
       FROM audit_reports
       ORDER BY id DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: normalizeDate(row.created_at),
      auditId: row.audit_id,
      action: row.action,
      savedOptions: row.saved_options_json || {},
      payload: row.payload_json || {},
      result: row.result_json || {},
    }));
  }
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
  if (await canUsePostgres()) {
    const tables = [
      "coupon_generations",
      "coupon_validations",
      "telegram_logs",
      "telegram_sessions",
      "matches",
      "match_tracking_runs",
      "match_tracking_state",
      "match_score_history",
      "audit_reports",
      "generated_assets",
      "update_history",
      "favorites",
      "watchlists",
      "mobile_devices",
      "auth_accounts",
      "auth_sessions",
      "subscription_plans",
    ];
    const counts = {};
    for (const table of tables) {
      const exists = await postgresPool.query(`SELECT to_regclass($1) AS table_name`, [table]);
      if (!exists.rows[0]?.table_name) {
        counts[table] = 0;
        continue;
      }
      const result = await postgresPool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
      counts[table] = Number(result.rows[0]?.c) || 0;
    }
    return {
      ok: true,
      mode: "postgres",
      database: "supabase",
      tables: counts,
    };
  }
  if (await canUseMySql()) {
    const [couponRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM coupon_generations");
    const [validationRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM coupon_validations");
    const [telegramRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM telegram_logs");
    const [telegramSessionRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM telegram_sessions");
    const [matchRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM matches");
    const [trackingRunRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM match_tracking_runs");
    const [trackingStateRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM match_tracking_state");
    const [scoreHistoryRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM match_score_history");
    const [auditRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM audit_reports");
    const [generatedAssetRows] = await mysqlPool.query("SELECT COUNT(*) AS c FROM generated_assets");
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
        matches: Number(matchRows?.[0]?.c) || 0,
        match_tracking_runs: Number(trackingRunRows?.[0]?.c) || 0,
        match_tracking_state: Number(trackingStateRows?.[0]?.c) || 0,
        match_score_history: Number(scoreHistoryRows?.[0]?.c) || 0,
        audit_reports: Number(auditRows?.[0]?.c) || 0,
        generated_assets: Number(generatedAssetRows?.[0]?.c) || 0,
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
  const matchCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM matches").get().c;
  const trackingRunCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM match_tracking_runs").get().c;
  const trackingStateCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM match_tracking_state").get().c;
  const scoreHistoryCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM match_score_history").get().c;
  const auditCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM audit_reports").get().c;
  const generatedAssetCount = sqliteDb.prepare("SELECT COUNT(*) AS c FROM generated_assets").get().c;
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
      matches: Number(matchCount) || 0,
      match_tracking_runs: Number(trackingRunCount) || 0,
      match_tracking_state: Number(trackingStateCount) || 0,
      match_score_history: Number(scoreHistoryCount) || 0,
      audit_reports: Number(auditCount) || 0,
      generated_assets: Number(generatedAssetCount) || 0,
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
  upsertTrackedMatch,
  saveMatchTrackingRun,
  upsertMatchTrackingState,
  saveMatchTrackingSnapshot,
  getMatchTrackingState,
  getMatchTrackingRuns,
  getTrackedMatches,
  saveMatchScoreHistory,
  getMatchScoreHistory,
  saveAuditReport,
  saveGeneratedAsset,
  getGeneratedAssets,
  deleteGeneratedAsset,
  deleteGeneratedAssets,
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
