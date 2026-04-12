const sql = require("mssql");

const config = {
    server:   process.env.DB_SERVER   || "localhost",
    port:     parseInt(process.env.DB_PORT || "63990"),
    database: process.env.DB_DATABASE || "SmartDashboard",
    user:     process.env.DB_USER     || "dashboarduser",
    password: process.env.DB_PASSWORD || "Dashboard@2026",
    options: {
        trustServerCertificate: true,
        enableArithAbort:       true,
        encrypt:                false,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 30000,
    requestTimeout:    30000,
};

let pool = null;

async function getPool() {
    if (!pool) {
        pool = await sql.connect(config);
        console.log("Connected to SQL Server — SmartDashboard");
    }
    return pool;
}

async function query(text, params = {}) {
    const p = await getPool();
    const req = p.request();
    for (const [k, v] of Object.entries(params)) req.input(k, v);
    const result = await req.query(text);
    return result.recordset;
}

async function queryOne(text, params = {}) {
    const rows = await query(text, params);
    return rows[0] || null;
}

module.exports = { query, queryOne, sql };
