const sql = require("mssql");

const config = {
  server:   "localhost",
  port:     63990,
  database: "SmartDashboard",
  user:     "dashboarduser",
  password: "Dashboard@2026",
  options: {
    trustServerCertificate: true,
    enableArithAbort:       true,
    encrypt:                false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout:    30000,
};

let pool = null;

async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log("✓ Connected to SQL Server — SmartDashboard");
    } catch (err) {
      console.error("✗ Connection failed:", err.message);
      throw err;
    }
  }
  return pool;
}

async function query(text, params = {}) {
  const p = await getPool();
  const request = p.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  const result = await request.query(text);
  return result.recordset;
}

async function queryOne(text, params = {}) {
  const rows = await query(text, params);
  return rows[0] || null;
}

module.exports = { query, queryOne, sql };
