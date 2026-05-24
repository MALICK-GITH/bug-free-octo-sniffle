require("dotenv").config();
const { Client } = require("pg");

const config = {
  host: String(process.env.DB_HOST || "").trim(),
  port: Number(process.env.DB_PORT) || 5432,
  database: String(process.env.DB_NAME || "").trim(),
  user: String(process.env.DB_USER || "").trim(),
  password: String(process.env.DB_PASSWORD || "").trim(),
  ssl:
    String(process.env.DB_SSL || "true").trim().toLowerCase() === "false"
      ? false
      : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
};

function hasRequiredDatabaseConfig() {
  return Boolean(config.host && config.database && config.user && config.password);
}

async function testConnection() {
  if (!hasRequiredDatabaseConfig()) {
    console.error(
      "Configuration PostgreSQL incomplete. Renseigne DB_HOST, DB_NAME, DB_USER et DB_PASSWORD dans .env."
    );
    process.exit(1);
  }

  console.log("Test de connexion PostgreSQL...");
  console.log(`   Hote: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Base: ${config.database}`);
  console.log(`   Utilisateur: ${config.user}`);
  console.log(`   SSL: ${config.ssl ? "active" : "desactive"}`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log("Connexion reussie.");

    const result = await client.query("SELECT version()");
    console.log("Version PostgreSQL:", result.rows[0].version);
  } catch (error) {
    console.error("Erreur de connexion:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

testConnection();
