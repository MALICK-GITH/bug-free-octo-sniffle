// Database Service - PostgreSQL Integration for FIFA PRO
const { Pool } = require('pg');

const databaseConfig = {
  host: String(process.env.DB_HOST || '').trim(),
  port: Number(process.env.DB_PORT) || 5432,
  database: String(process.env.DB_NAME || '').trim(),
  user: String(process.env.DB_USER || '').trim(),
  password: String(process.env.DB_PASSWORD || '').trim(),
  ssl:
    String(process.env.DB_SSL || 'true').trim().toLowerCase() === 'false'
      ? false
      : { rejectUnauthorized: false },
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};

const databaseEnabled = Boolean(
  databaseConfig.host &&
    databaseConfig.database &&
    databaseConfig.user &&
    databaseConfig.password
);

const pool = databaseEnabled ? new Pool(databaseConfig) : null;

class DatabaseService {
  constructor() {
    this.pool = pool;
    this.enabled = databaseEnabled;
    if (this.enabled) {
      this.init();
    } else {
      console.log('ℹ️ PostgreSQL disabled: configure DB_HOST, DB_NAME, DB_USER and DB_PASSWORD to enable it.');
    }
  }

  async init() {
    if (!this.enabled || !this.pool) return;
    try {
      // Test connection
      const client = await this.pool.connect();
      console.log('✅ Database connected successfully');
      await client.release();
      
      // Create tables if they don't exist
      await this.createTables();
      console.log('✅ Database tables initialized');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
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
      `CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)`
    ];

    for (const query of queries) {
      await this.query(query);
    }
  }

  async query(text, params = []) {
    if (!this.enabled || !this.pool) {
      throw new Error('PostgreSQL database not configured.');
    }
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log(`📊 Query executed in ${duration}ms`);
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
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
    console.log('🔌 Database connection closed');
  }
}

// Create singleton instance
const dbService = new DatabaseService();

module.exports = dbService;
