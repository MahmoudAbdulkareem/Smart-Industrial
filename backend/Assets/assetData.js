const { query, queryOne } = require("../DataBase/db");

function rand(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function getStatus(score) {
    if (score >= 70) return "healthy";
    if (score >= 40) return "caution";
    return "critical";
}

const baseScores = {
    "AST-001": 88,
    "AST-002": 54,
    "AST-003": 31,
    "AST-004": 76,
    "AST-005": 42,
};

async function recordAndGetReadings() {
    const assets = await query("SELECT * FROM assets");
    const readings = [];

    for (const asset of assets) {
        const base        = baseScores[asset.id] || 50;
        const healthScore = parseFloat(Math.max(0, Math.min(100, base + rand(-3, 3))).toFixed(1));
        const rul         = parseFloat((healthScore * 0.9 + rand(0, 10)).toFixed(1));
        const mtbf        = parseFloat((200 + rand(0, 100)).toFixed(1));
        const status      = getStatus(healthScore);
        const vibration   = rand(0.5, 5.0);
        const temperature = rand(35, 80);
        const pressure    = rand(1.2, 4.5);

        await query(
            `INSERT INTO sensor_readings
               (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status)
             VALUES
               (@asset_id, @vibration, @temperature, @pressure, @health_score, @rul, @mtbf, @status)`,
            { asset_id: asset.id, vibration, temperature, pressure, health_score: healthScore, rul, mtbf, status }
        );

        readings.push({
            id: asset.id,
            name: asset.name,
            location: asset.location,
            healthScore,
            rul,
            mtbf,
            status,
            anomalyDetected: healthScore < 40,
            sensors: { vibration, temperature, pressure },
        });
    }

    return readings;
}

async function getLatestReadings() {
    const rows = await query(`
        SELECT r.asset_id, a.name, a.location,
               r.health_score, r.rul, r.mtbf, r.status,
               r.vibration, r.temperature, r.pressure, r.recorded_at
        FROM sensor_readings r
        INNER JOIN assets a ON a.id = r.asset_id
        INNER JOIN (
            SELECT asset_id, MAX(recorded_at) AS latest
            FROM sensor_readings
            GROUP BY asset_id
        ) latest ON latest.asset_id = r.asset_id AND latest.latest = r.recorded_at
    `);

    return rows.map(r => ({
        id:             r.asset_id,
        name:           r.name,
        location:       r.location,
        healthScore:    parseFloat(r.health_score),
        rul:            parseFloat(r.rul),
        mtbf:           parseFloat(r.mtbf),
        status:         r.status,
        anomalyDetected: parseFloat(r.health_score) < 40,
        sensors: {
            vibration:   parseFloat(r.vibration),
            temperature: parseFloat(r.temperature),
            pressure:    parseFloat(r.pressure),
        },
    }));
}

async function getAlerts() {
    const rows = await query(`
        SELECT al.id, al.asset_id, a.name AS asset_name,
               al.severity, al.message, al.acknowledged, al.created_at
        FROM alerts al
        INNER JOIN assets a ON a.id = al.asset_id
        ORDER BY al.created_at DESC
    `);

    return rows.map(r => ({
        id:           r.id,
        assetId:      r.asset_id,
        asset:        r.asset_name,
        severity:     r.severity,
        message:      r.message,
        acknowledged: r.acknowledged === true || r.acknowledged === 1,
        time:         timeAgo(r.created_at),
    }));
}

async function acknowledgeAlert(alertId) {
    await query("UPDATE alerts SET acknowledged = 1, acknowledged_at = GETDATE() WHERE id = @id", { id: alertId });
}

async function saveWorkOrder(wo) {
    await query(
        `INSERT INTO work_orders (wonum, asset_id, description, status, created_by)
         VALUES (@wonum, @asset_id, @description, @status, @created_by)`,
        { wonum: wo.wonum, asset_id: wo.assetId, description: wo.description, status: wo.status, created_by: wo.createdBy }
    );
}

function timeAgo(date) {
    const diff = Math.floor((Date.now() - new Date(date)) / 60000);
    if (diff < 1)  return "just now";
    if (diff < 60) return `${diff} min ago`;
    return `${Math.floor(diff / 60)}h ago`;
}

module.exports = { recordAndGetReadings, getLatestReadings, getAlerts, acknowledgeAlert, saveWorkOrder };
