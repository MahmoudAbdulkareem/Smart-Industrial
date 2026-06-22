// backend/repositories/alertRepository.js
const { query, queryOne } = require("../DataBase/db");

async function createAlert(alertData) {
    const { assetId, assetName, severity, message, metadata } = alertData;
    
    const result = await query(`
        INSERT INTO alerts (asset_id, asset_name, severity, message, metadata, created_at)
        VALUES (@assetId, @assetName, @severity, @message, @metadata, GETDATE())
    `, {
        assetId,
        assetName: assetName || null,
        severity: severity || 'info',
        message,
        metadata: metadata ? JSON.stringify(metadata) : null
    });
    
    return queryOne(
        `SELECT * FROM alerts WHERE id = @id`,
        { id: result.insertId || result.id }
    );
}

async function getAlertById(id) {
    return queryOne(
        `SELECT * FROM alerts WHERE id = @id`,
        { id }
    );
}

async function getActiveAlerts(assetId = null) {
    let sql = `
        SELECT a.*, u.name as acknowledged_by_name
        FROM alerts a
        LEFT JOIN users u ON u.id = a.acknowledged_by
        WHERE a.acknowledged = 0
    `;
    const params = {};
    
    if (assetId) {
        sql += ` AND a.asset_id = @assetId`;
        params.assetId = assetId;
    }
    
    sql += ` ORDER BY a.created_at DESC`;
    
    return query(sql, params);
}

async function acknowledgeAlert(id, userId) {
    await query(`
        UPDATE alerts 
        SET acknowledged = 1, 
            acknowledged_by = @userId, 
            acknowledged_at = GETDATE()
        WHERE id = @id
    `, { id, userId });
    
    return getAlertById(id);
}

async function getAlertsByDateRange(startDate, endDate) {
    return query(`
        SELECT a.*, 
               u.name as acknowledged_by_name,
               u2.name as created_by_name
        FROM alerts a
        LEFT JOIN users u ON u.id = a.acknowledged_by
        ORDER BY a.created_at DESC
    `, { startDate, endDate });
}

async function getAlertStats() {
    return queryOne(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN acknowledged = 0 THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN severity = 'critical' AND acknowledged = 0 THEN 1 ELSE 0 END) as critical,
            SUM(CASE WHEN severity = 'caution' AND acknowledged = 0 THEN 1 ELSE 0 END) as caution,
            SUM(CASE WHEN severity = 'info' AND acknowledged = 0 THEN 1 ELSE 0 END) as info
        FROM alerts
    `);
}

module.exports = {
    createAlert,
    getAlertById,
    getActiveAlerts,
    acknowledgeAlert,
    getAlertsByDateRange,
    getAlertStats
};