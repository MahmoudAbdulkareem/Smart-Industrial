const sql = require("mssql");

const config = {
    server: process.env.DB_SERVER || "localhost",
    port: parseInt(process.env.DB_PORT || "1433"),
    database: process.env.DB_DATABASE || "SmartDashboard",
    user: process.env.DB_USER || "dashboarduser",
    password: process.env.DB_PASSWORD || "Dashboard@2026",
    options: {
        trustServerCertificate: true,
        enableArithAbort: true,
        encrypt: false,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 30000,
    requestTimeout: 30000,
};

let pool = null;
let connecting = null;

async function getPool() {
    if (pool && pool.connected) {
        return pool;
    }
    if (connecting) {
        return connecting;
    }
    connecting = sql.connect(config)
        .then((connectedPool) => {
            pool = connectedPool;
            pool.on("error", () => {
                pool = null;
            });
            connecting = null;
            return pool;
        })
        .catch((error) => {
            connecting = null;
            pool = null;
            throw error;
        });
    return connecting;
}

async function query(text, params = {}) {
    const activePool = await getPool();
    const request = activePool.request();
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

module.exports = { getPool, query, queryOne };
