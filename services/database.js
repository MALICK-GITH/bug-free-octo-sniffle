// Database Service - PostgreSQL Integration for FIFA PRO
const dns = require("dns");
const { execFile } = require("child_process");
const { Pool } = require('pg');
const crypto = require("crypto");
const path = require("path");
const fallbackDb = require("./db");

require("dotenv").config({ path: path.join(process.cwd(), ".env") });

function trimEnv(value) {
  return String(value || '').trim();
}

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

function isSslDisabled() {
  return trimEnv(process.env.DB_SSL).toLowerCase() === 'false';
}

function preferIpv6Lookup(hostname, options, callback) {
  const ipv6Options = typeof options === "object" && options ? { ...options, family: 6 } : { family: 6 };
  dns.lookup(hostname, ipv6Options, (ipv6Error, address, family) => {
    if (!ipv6Error) {
      callback(null, address, family);
      return;
    }

    const ipv4Options = typeof options === "object" && options ? { ...options, family: 4 } : { family: 4 };
    dns.lookup(hostname, ipv4Options, (ipv4Error, address4, family4) => {
      if (!ipv4Error) {
        callback(null, address4, family4);
        return;
      }

      callback(ipv6Error || ipv4Error);
    });
  });
}

function buildDatabaseConfig() {
  const connectionString = trimEnv(
    process.env.DATABASE_URL ||
      process.env.SUPABASE_DATABASE_URL ||
      process.env.DB_URL ||
      ''
  );

  const common = {
    max: Number(process.env.DB_POOL_MAX) || 20,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 2000,
  };

  if (connectionString) {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(connectionString);
    } catch (_error) {
      return null;
    }

    const database = String(parsedUrl.pathname || "")
      .replace(/^\/+/, "")
      .trim();

    if (!(parsedUrl.hostname && database && parsedUrl.username && parsedUrl.password)) {
      return null;
    }

    return {
      ...common,
      host: parsedUrl.hostname,
      port: Number(parsedUrl.port) || 5432,
      database,
      user: decodeURIComponent(parsedUrl.username),
      password: decodeURIComponent(parsedUrl.password),
      lookup: preferIpv6Lookup,
      ssl: isSslDisabled() ? false : { rejectUnauthorized: false },
    };
  }

  const host = trimEnv(process.env.DB_HOST);
  const database = trimEnv(process.env.DB_NAME);
  const user = trimEnv(process.env.DB_USER);
  const password = trimEnv(process.env.DB_PASSWORD);

  if (!(host && database && user && password)) {
    return null;
  }

  return {
    ...common,
    host,
    port: Number(process.env.DB_PORT) || 5432,
    database,
    user,
    password,
    lookup: preferIpv6Lookup,
    ssl: isSslDisabled() ? false : { rejectUnauthorized: false },
  };
}

const databaseConfig = buildDatabaseConfig();
const databaseEnabled = Boolean(databaseConfig);
let pool = null;

async function resolveDatabaseHost(config) {
  const host = String(config?.host || "").trim();
  if (!host || /^[\d.]+$/.test(host) || host.includes(":") || host === "localhost") {
    return config;
  }

  try {
    const resolved6 = await dns.promises.lookup(host, { family: 6 });
    return { ...config, host: resolved6.address };
  } catch (_ipv6Error) {
    try {
      const resolved4 = await dns.promises.lookup(host, { family: 4 });
      return { ...config, host: resolved4.address };
    } catch (_ipv4Error) {
      const resolveWithNslookup = () =>
        new Promise((resolve) => {
          execFile(
            "nslookup",
            [host],
            { timeout: 5000, windowsHide: true },
            (error, stdout) => {
              if (error) {
                resolve(null);
                return;
              }
              const lines = String(stdout || "")
                .trim()
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean);
              const ipv6Line = [...lines].reverse().find((line) => /^[0-9a-f:]+$/i.test(line) && line.includes(":"));
              if (ipv6Line) {
                resolve(ipv6Line);
                return;
              }
              const addrLine = [...lines].reverse().find((line) => /^Address:\s+/i.test(line));
              resolve(addrLine ? addrLine.replace(/^Address:\s+/i, "").trim() : null);
            }
          );
        });

      const ipv6 = await resolveWithNslookup();
      if (ipv6) {
        return { ...config, host: ipv6 };
      }

      return config;
    }
  }
}

class DatabaseService {
  constructor() {
    this.pool = pool;
    this.enabled = databaseEnabled;
    this.useFallback = false;
    this.initError = null;
    if (this.enabled) {
      this.initPromise = this.init();
    } else {
      this.initPromise = Promise.resolve(false);
      console.log('PostgreSQL disabled: configure DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD.');
    }
  }

  async init() {
    if (!this.enabled) return;
    try {
      if (!this.pool) {
        const resolvedConfig = await resolveDatabaseHost(databaseConfig);
        this.pool = new Pool(resolvedConfig);
        pool = this.pool;
      }

      // Test connection
      const client = await this.pool.connect();
      console.log('Database connected successfully');
      await client.release();
      
      // Create tables if they don't exist
      await this.createTables();
      console.log('Database tables initialized');
    } catch (error) {
      this.initError = error;
      this.useFallback = true;
      console.error('Database connection failed:', error);
    }
  }

  async createTables() {
    const queries = [
      // Matches table
      `CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        match_id VARCHAR(50) UNIQUE NOT NULL,
        team1 VARCHAR(100) NOT NULL,
        team2 VARCHAR(100) NOT NULL,
        league VARCHAR(100) NOT NULL,
        score1 INTEGER DEFAULT 0,
        score2 INTEGER DEFAULT 0,
        minute INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'upcoming',
        odds JSONB,
        prediction JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Coupons table
      `CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        coupon_id VARCHAR(50) UNIQUE NOT NULL,
        user_id VARCHAR(50),
        matches JSONB NOT NULL,
        stake DECIMAL(10,2) DEFAULT 0,
        total_odds DECIMAL(10,2) DEFAULT 0,
        potential_win DECIMAL(10,2) DEFAULT 0,
        risk_profile VARCHAR(20) DEFAULT 'balanced',
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Predictions table
      `CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        match_id VARCHAR(50) NOT NULL,
        prediction_type VARCHAR(50) NOT NULL,
        prediction_data JSONB NOT NULL,
        confidence DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE
      )`,

      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        username VARCHAR(50),
        email VARCHAR(100),
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Analytics table
      `CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB NOT NULL,
        user_id VARCHAR(50),
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        plan_key VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        daily_prediction_quota INTEGER NOT NULL DEFAULT 0,
        monthly_prediction_quota INTEGER NOT NULL DEFAULT 0,
        is_unlimited BOOLEAN NOT NULL DEFAULT FALSE,
        price_label VARCHAR(100),
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS auth_accounts (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(80) UNIQUE NOT NULL,
        email VARCHAR(160) UNIQUE NOT NULL,
        username VARCHAR(80) NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'user',
        plan_key VARCHAR(50) NOT NULL DEFAULT 'free',
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        subscription_status VARCHAR(30) NOT NULL DEFAULT 'active',
        quota_override_daily INTEGER,
        quota_override_monthly INTEGER,
        last_login_at TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(128) UNIQUE NOT NULL,
        user_id VARCHAR(80) NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS prediction_usage (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(80) NOT NULL,
        endpoint VARCHAR(160) NOT NULL,
        match_id VARCHAR(80),
        cost_units INTEGER NOT NULL DEFAULT 1,
        plan_key VARCHAR(50) NOT NULL,
        quota_before INTEGER,
        quota_after INTEGER,
        allowed BOOLEAN NOT NULL DEFAULT TRUE,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Cache table
      `CREATE TABLE IF NOT EXISTS cache (
        id SERIAL PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Create indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_matches_match_id ON matches(match_id)`,
      `CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league)`,
      `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)`,
      `CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status)`,
      `CREATE INDEX IF NOT EXISTS idx_coupons_created_at ON coupons(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_key ON cache(cache_key)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON auth_accounts(email)`,
      `CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_id ON auth_accounts(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(session_token)`,
      `CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_prediction_usage_user_id_created_at ON prediction_usage(user_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_prediction_usage_endpoint_created_at ON prediction_usage(endpoint, created_at)`
    ];

    for (const query of queries) {
      await this.query(query);
    }

    await this.query(
      `INSERT INTO subscription_plans (plan_key, display_name, daily_prediction_quota, monthly_prediction_quota, is_unlimited, price_label, description, sort_order, is_active)
       VALUES
         ('free', 'Free', 3, 60, FALSE, '0', 'Acces de base avec quota limite.', 1, TRUE),
         ('basic', 'Basic', 20, 400, FALSE, 'starter', 'Plan d''entree avec quota quotidien confortable.', 2, TRUE),
         ('pro', 'Pro', 100, 2000, FALSE, 'pro', 'Plan avance pour clients actifs.', 3, TRUE),
         ('vip', 'VIP', 999999, 999999, TRUE, 'vip', 'Plan illimite pour administration ou clients premium.', 4, TRUE)
       ON CONFLICT (plan_key) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         daily_prediction_quota = EXCLUDED.daily_prediction_quota,
         monthly_prediction_quota = EXCLUDED.monthly_prediction_quota,
         is_unlimited = EXCLUDED.is_unlimited,
         price_label = EXCLUDED.price_label,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP`
    );
  }

  async query(text, params = []) {
    if (!this.enabled) {
      throw new Error('PostgreSQL database not configured.');
    }
    if (!this.pool && this.initPromise) {
      await this.initPromise;
    }
    if (!this.pool) {
      throw new Error('PostgreSQL database not configured.');
    }
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`📊 Query executed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Match operations
  async saveMatch(matchData) {
    const query = `
      INSERT INTO matches (match_id, team1, team2, league, score1, score2, minute, status, odds, prediction)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (match_id) DO UPDATE SET
        team1 = EXCLUDED.team1,
        team2 = EXCLUDED.team2,
        league = EXCLUDED.league,
        score1 = EXCLUDED.score1,
        score2 = EXCLUDED.score2,
        minute = EXCLUDED.minute,
        status = EXCLUDED.status,
        odds = EXCLUDED.odds,
        prediction = EXCLUDED.prediction,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      matchData.match_id,
      matchData.team1,
      matchData.team2,
      matchData.league,
      matchData.score1 || 0,
      matchData.score2 || 0,
      matchData.minute || 0,
      matchData.status || 'upcoming',
      JSON.stringify(matchData.odds || {}),
      JSON.stringify(matchData.prediction || {})
    ];

    return await this.query(query, values);
  }

  async getMatch(matchId) {
    const query = 'SELECT * FROM matches WHERE match_id = $1';
    const result = await this.query(query, [matchId]);
    return result.rows[0];
  }

  async getMatches(filters = {}) {
    let query = 'SELECT * FROM matches WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.league && filters.league !== 'all') {
      query += ` AND league = $${paramIndex}`;
      params.push(filters.league);
      paramIndex++;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.limit) {
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(filters.limit);
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  // Coupon operations
  async saveCoupon(couponData) {
    const query = `
      INSERT INTO coupons (coupon_id, user_id, matches, stake, total_odds, potential_win, risk_profile, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      couponData.coupon_id,
      couponData.user_id || 'anonymous',
      JSON.stringify(couponData.matches),
      couponData.stake || 0,
      couponData.total_odds || 0,
      couponData.potential_win || 0,
      couponData.risk_profile || 'balanced',
      couponData.status || 'pending'
    ];

    return await this.query(query, values);
  }

  async getCoupons(userId = null) {
    let query = 'SELECT * FROM coupons';
    const params = [];

    if (userId) {
      query += ' WHERE user_id = $1 ORDER BY created_at DESC';
      params.push(userId);
    } else {
      query += ' ORDER BY created_at DESC LIMIT 50';
    }

    const result = await this.query(query, params);
    return result.rows;
  }

  // Prediction operations
  async savePrediction(predictionData) {
    const query = `
      INSERT INTO predictions (match_id, prediction_type, prediction_data, confidence)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      predictionData.match_id,
      predictionData.prediction_type,
      JSON.stringify(predictionData.prediction_data),
      predictionData.confidence || 0
    ];

    return await this.query(query, values);
  }

  async getPredictions(matchId) {
    const query = 'SELECT * FROM predictions WHERE match_id = $1 ORDER BY created_at DESC';
    const result = await this.query(query, [matchId]);
    return result.rows;
  }

  // Analytics operations
  async trackEvent(eventType, eventData, userId = null, ipAddress = null, userAgent = null) {
    const query = `
      INSERT INTO analytics (event_type, event_data, user_id, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    const values = [
      eventType,
      JSON.stringify(eventData),
      userId,
      ipAddress,
      userAgent
    ];

    return await this.query(query, values);
  }

  async getAnalytics(eventType = null, limit = 100) {
    let query = 'SELECT * FROM analytics';
    const params = [];

    if (eventType) {
      query += ' WHERE event_type = $1';
      params.push(eventType);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await this.query(query, params);
    return result.rows;
  }

  // Cache operations
  async setCache(key, value, ttlSeconds = 3600) {
    const query = `
      INSERT INTO cache (cache_key, cache_value, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '${ttlSeconds} seconds')
      ON CONFLICT (cache_key) DO UPDATE SET
        cache_value = EXCLUDED.cache_value,
        expires_at = EXCLUDED.expires_at
    `;
    
    return await this.query(query, [key, JSON.stringify(value)]);
  }

  async getCache(key) {
    const query = `
      SELECT cache_value FROM cache 
      WHERE cache_key = $1 AND expires_at > NOW()
    `;
    
    const result = await this.query(query, [key]);
    if (result.rows.length > 0) {
      return result.rows[0].cache_value;
    }
    return null;
  }

  async clearCache(pattern = null) {
    if (pattern) {
      const query = 'DELETE FROM cache WHERE cache_key LIKE $1';
      return await this.query(query, [pattern]);
    } else {
      const query = 'DELETE FROM cache';
      return await this.query(query);
    }
  }

  // Settings operations
  async getSetting(key) {
    const query = 'SELECT value FROM settings WHERE key = $1';
    const result = await this.query(query, [key]);
    return result.rows.length > 0 ? result.rows[0].value : null;
  }

  async setSetting(key, value, description = null) {
    const query = `
      INSERT INTO settings (key, value, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        description = EXCLUDED.description,
        updated_at = CURRENT_TIMESTAMP
    `;
    
    return await this.query(query, [key, JSON.stringify(value), description]);
  }

  async getPlans() {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getPlans();
    }
    const result = await this.query(
      `SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY sort_order ASC, plan_key ASC`
    );
    return result.rows;
  }

  async getPlan(planKey) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getPlan(planKey);
    }
    const result = await this.query(
      `SELECT * FROM subscription_plans WHERE plan_key = $1 LIMIT 1`,
      [normalizeKey(planKey, "free")]
    );
    return result.rows[0] || null;
  }

  async getAdminCount() {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getAdminCount();
    }
    const result = await this.query(`SELECT COUNT(*)::int AS count FROM auth_accounts WHERE role = 'admin'`);
    return Number(result.rows?.[0]?.count) || 0;
  }

  async getAuthUserById(userId) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getAuthUserById(userId);
    }
    const result = await this.query(
      `SELECT * FROM auth_accounts WHERE user_id = $1 LIMIT 1`,
      [String(userId || "").trim()]
    );
    return result.rows[0] || null;
  }

  async getAuthUserByEmail(email) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getAuthUserByEmail(email);
    }
    const result = await this.query(
      `SELECT * FROM auth_accounts WHERE email = $1 LIMIT 1`,
      [normalizeEmail(email)]
    );
    return result.rows[0] || null;
  }

  verifyAuthPassword(password, storedHash) {
    return verifyPassword(password, storedHash);
  }

  async listAuthUsers(limit = 100) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.listAuthUsers(limit);
    }
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const result = await this.query(
      `SELECT a.*, p.display_name AS plan_name, p.daily_prediction_quota, p.monthly_prediction_quota, p.is_unlimited
       FROM auth_accounts a
       LEFT JOIN subscription_plans p ON p.plan_key = a.plan_key
       ORDER BY a.updated_at DESC
       LIMIT $1`,
      [safeLimit]
    );
    return result.rows;
  }

  async saveAuthUser(userData = {}) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.saveAuthUser(userData);
    }
    const email = normalizeEmail(userData.email);
    const username = String(userData.username || "").trim();
    const password = String(userData.password || "").trim();
    const requestedPlanKey = normalizeKey(userData.planKey || "free", "free");
    const roleInput = normalizeKey(userData.role || "user", "user");
    const adminCount = await this.getAdminCount();
    const role = adminCount === 0 ? "admin" : roleInput === "admin" ? "admin" : "user";
    const requestedPlan = await this.getPlan(requestedPlanKey);
    const finalPlan = role === "admin" ? "vip" : requestedPlan ? requestedPlan.plan_key : "free";

    if (!email) {
      throw new Error("email requis");
    }
    if (!username) {
      throw new Error("username requis");
    }
    if (!password || password.length < 8) {
      throw new Error("mot de passe trop court");
    }

    const existing = await this.getAuthUserByEmail(email);
    if (existing) {
      throw new Error("email deja utilise");
    }

    const userId = normalizeKey(userData.userId || email.split("@")[0], "user");
    const passwordHash = hashPassword(password);
    const result = await this.query(
      `INSERT INTO auth_accounts (user_id, email, username, password_hash, role, plan_key, status, subscription_status, quota_override_daily, quota_override_monthly)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', 'active', $7, $8)
       RETURNING *`,
      [
        userId,
        email,
        username,
        passwordHash,
        role,
        finalPlan,
        userData.quotaOverrideDaily ?? null,
        userData.quotaOverrideMonthly ?? null,
      ]
    );
    return result.rows[0] || null;
  }

  async updateAuthUser(userId, updates = {}) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.updateAuthUser(userId, updates);
    }
    const current = await this.getAuthUserById(userId);
    if (!current) {
      throw new Error("utilisateur introuvable");
    }

    const nextUsername = updates.username != null ? String(updates.username).trim() : current.username;
    const nextEmail = updates.email != null ? normalizeEmail(updates.email) : current.email;
    const nextRole = updates.role != null ? normalizeKey(updates.role, current.role) : current.role;
    const requestedPlanKey = updates.planKey != null ? normalizeKey(updates.planKey, current.plan_key) : current.plan_key;
    const nextPlan = (await this.getPlan(requestedPlanKey)) ? requestedPlanKey : current.plan_key;
    const nextStatus = updates.status != null ? normalizeKey(updates.status, current.status) : current.status;
    const nextSubscriptionStatus =
      updates.subscriptionStatus != null ? normalizeKey(updates.subscriptionStatus, current.subscription_status) : current.subscription_status;
    const nextQuotaOverrideDaily =
      updates.quotaOverrideDaily === undefined ? current.quota_override_daily : updates.quotaOverrideDaily;
    const nextQuotaOverrideMonthly =
      updates.quotaOverrideMonthly === undefined ? current.quota_override_monthly : updates.quotaOverrideMonthly;
    const nextPasswordHash =
      updates.password && String(updates.password).trim().length >= 8
        ? hashPassword(updates.password)
        : current.password_hash;
    const adminCount = await this.getAdminCount();
    if (current.role === "admin" && nextRole !== "admin" && adminCount <= 1) {
      throw new Error("au moins un administrateur doit rester actif");
    }
    const resolvedPlan = nextRole === "admin" ? "vip" : nextPlan;

    const result = await this.query(
      `UPDATE auth_accounts
       SET email = $2,
           username = $3,
           role = $4,
           plan_key = $5,
           status = $6,
           subscription_status = $7,
           quota_override_daily = $8,
           quota_override_monthly = $9,
           password_hash = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING *`,
      [
        String(userId || "").trim(),
        nextEmail,
        nextUsername,
        nextRole,
        resolvedPlan,
        nextStatus,
        nextSubscriptionStatus,
        nextQuotaOverrideDaily,
        nextQuotaOverrideMonthly,
        nextPasswordHash,
      ]
    );
    return result.rows[0] || null;
  }

  async deleteAuthUser(userId) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.deleteAuthUser(userId);
    }
    const current = await this.getAuthUserById(userId);
    if (!current) {
      return null;
    }
    const adminCount = await this.getAdminCount();
    if (current.role === "admin" && adminCount <= 1) {
      throw new Error("au moins un administrateur doit rester actif");
    }
    await this.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [String(userId || "").trim()]);
    const result = await this.query(`DELETE FROM auth_accounts WHERE user_id = $1 RETURNING *`, [
      String(userId || "").trim(),
    ]);
    return result.rows[0] || null;
  }

  async createAuthSession(userId, { ipAddress = null, userAgent = null, daysValid = 30 } = {}) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.createAuthSession(userId, { ipAddress, userAgent, daysValid });
    }
    const token = randomToken(32);
    const result = await this.query(
      `INSERT INTO auth_sessions (session_token, user_id, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 day'))
       RETURNING *`,
      [token, String(userId || "").trim(), ipAddress, userAgent, Math.max(1, Number(daysValid) || 30)]
    );
    return { token, session: result.rows[0] || null };
  }

  async getAuthSession(token) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getAuthSession(token);
    }
    const result = await this.query(
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
       WHERE s.session_token = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       LIMIT 1`,
      [String(token || "").trim()]
    );
    return result.rows[0] || null;
  }

  async revokeAuthSession(token) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.revokeAuthSession(token);
    }
    await this.query(
      `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE session_token = $1`,
      [String(token || "").trim()]
    );
    return true;
  }

  async revokeAllAuthSessions(userId) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.revokeAllAuthSessions(userId);
    }
    await this.query(
      `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
      [String(userId || "").trim()]
    );
    return true;
  }

  async touchAuthSession(token, userId) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.touchAuthSession(token, userId);
    }
    const safeToken = String(token || "").trim();
    const safeUserId = String(userId || "").trim();
    if (!safeToken || !safeUserId) return;
    await this.query(`UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE session_token = $1`, [safeToken]);
    await this.query(`UPDATE auth_accounts SET last_active = CURRENT_TIMESTAMP WHERE user_id = $1`, [safeUserId]);
  }

  async recordPredictionUsage(entry = {}) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.recordPredictionUsage(entry);
    }
    const result = await this.query(
      `INSERT INTO prediction_usage (user_id, endpoint, match_id, cost_units, plan_key, quota_before, quota_after, allowed, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        String(entry.userId || "").trim(),
        String(entry.endpoint || "").trim(),
        entry.matchId ? String(entry.matchId).trim() : null,
        Math.max(1, Number(entry.costUnits) || 1),
        normalizeKey(entry.planKey || "free", "free"),
        entry.quotaBefore == null ? null : Number(entry.quotaBefore),
        entry.quotaAfter == null ? null : Number(entry.quotaAfter),
        Boolean(entry.allowed),
        JSON.stringify(entry.meta || {}),
      ]
    );
    return result.rows[0] || null;
  }

  async getPredictionUsageSummary({ userId, startAt = null, endAt = null } = {}) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getPredictionUsageSummary({ userId, startAt, endAt });
    }
    const clauses = [`user_id = $1`];
    const params = [String(userId || "").trim()];
    let idx = 2;

    if (startAt) {
      clauses.push(`created_at >= $${idx}`);
      params.push(startAt);
      idx += 1;
    }
    if (endAt) {
      clauses.push(`created_at < $${idx}`);
      params.push(endAt);
      idx += 1;
    }

    const result = await this.query(
      `SELECT
         COUNT(*)::int AS total_events,
         COALESCE(SUM(CASE WHEN allowed THEN cost_units ELSE 0 END), 0)::int AS used_units,
         COALESCE(SUM(CASE WHEN NOT allowed THEN cost_units ELSE 0 END), 0)::int AS blocked_units
       FROM prediction_usage
       WHERE ${clauses.join(" AND ")}`,
      params
    );
    return result.rows[0] || { total_events: 0, used_units: 0, blocked_units: 0 };
  }

  async getAuthQuotaState(userId) {
    if (this.useFallback || !this.pool) {
      return fallbackDb.getAuthQuotaState(userId);
    }
    const user = await this.getAuthUserById(userId);
    if (!user) return null;
    const plan = await this.getPlan(user.plan_key);
    const quotaLimit = user.quota_override_daily ?? plan?.daily_prediction_quota ?? 0;
    const unlimited = user.role === "admin" || Boolean(plan?.is_unlimited);

    const today = new Date();
    const startAt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
    const summary = await this.getPredictionUsageSummary({ userId, startAt, endAt });
    const usedToday = Number(summary.used_units) || 0;
    const remainingToday = unlimited ? null : Math.max(0, Number(quotaLimit) - usedToday);

    return {
      user,
      plan,
      dailyQuota: unlimited ? null : Number(quotaLimit) || 0,
      usedToday,
      remainingToday,
      unlimited,
      blockedToday: Number(summary.blocked_units) || 0,
      totalEventsToday: Number(summary.total_events) || 0,
    };
  }

  // User operations
  async saveUser(userData) {
    const query = `
      INSERT INTO users (user_id, username, email, preferences)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        email = EXCLUDED.email,
        preferences = EXCLUDED.preferences,
        last_active = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    const values = [
      userData.user_id,
      userData.username,
      userData.email,
      JSON.stringify(userData.preferences || {})
    ];

    return await this.query(query, values);
  }

  async getUser(userId) {
    const query = 'SELECT * FROM users WHERE user_id = $1';
    const result = await this.query(query, [userId]);
    return result.rows[0];
  }

  async getDbStatus() {
    if (!this.enabled || this.useFallback || !this.pool) {
      const fallbackStatus = await fallbackDb.getDbStatus();
      return {
        ok: false,
        mode: "postgres",
        status: "degraded",
        timestamp: new Date().toISOString(),
        database: "fallback-sqlite",
        fallback: fallbackStatus,
        error: this.initError ? String(this.initError.message || this.initError) : "PostgreSQL unavailable",
      };
    }

    try {
      const [authRows] = await this.pool.query("SELECT COUNT(*) AS c FROM auth_accounts");
      const [sessionRows] = await this.pool.query("SELECT COUNT(*) AS c FROM auth_sessions");
      const [planRows] = await this.pool.query("SELECT COUNT(*) AS c FROM subscription_plans");
      const [usageRows] = await this.pool.query("SELECT COUNT(*) AS c FROM prediction_usage");

      return {
        ok: true,
        mode: "postgres",
        status: "connected",
        timestamp: new Date().toISOString(),
        database: "connected",
        tables: {
          auth_accounts: Number(authRows?.[0]?.c) || 0,
          auth_sessions: Number(sessionRows?.[0]?.c) || 0,
          subscription_plans: Number(planRows?.[0]?.c) || 0,
          prediction_usage: Number(usageRows?.[0]?.c) || 0,
        },
      };
    } catch (error) {
      return {
        ok: false,
        mode: "postgres",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  // Health check
  async healthCheck() {
    if (!this.enabled || !this.pool) {
      return {
        status: 'disabled',
        timestamp: new Date().toISOString(),
        database: 'not_configured',
      };
    }
    try {
      const result = await this.query('SELECT 1 as health');
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Close connection
  async close() {
    if (!this.pool) return;
    await this.pool.end();
    console.log('Database connection closed');
  }
}

// Create singleton instance
const dbService = new DatabaseService();

module.exports = dbService;
