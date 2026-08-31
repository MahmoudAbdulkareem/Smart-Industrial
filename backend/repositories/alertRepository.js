const { query, queryOne } = require("../db/pool");

async function createAlert(assetId, severity, message, triggerContext) {
    const ctx = triggerContext || {};
    const rows = await query(
        `INSERT INTO alerts (
            asset_id, severity, message, created_at,
            wonum, vibration_at_trigger, temperature_at_trigger, pressure_at_trigger, rule_reason
         )
         OUTPUT INSERTED.id AS id
         VALUES (
            @assetId, @severity, @message, GETDATE(),
            @wonum, @vibrationAtTrigger, @temperatureAtTrigger, @pressureAtTrigger, @ruleReason
         )`,
        {
            assetId,
            severity: severity || "info",
            message,
            wonum: ctx.wonum ?? null,
            vibrationAtTrigger: ctx.vibrationAtTrigger ?? null,
            temperatureAtTrigger: ctx.temperatureAtTrigger ?? null,
            pressureAtTrigger: ctx.pressureAtTrigger ?? null,
            ruleReason: ctx.ruleReason ?? null,
        }
    );
    return rows[0]?.id;
}

async function getAlertById(id) {
    return queryOne(`SELECT * FROM alerts WHERE id = @id`, { id });
}

async function listAllAlerts() {
    return query(`
        SELECT a.*, u.name AS acknowledged_by_name, ast.name AS asset_name
        FROM alerts a
        LEFT JOIN users u ON u.id = a.acknowledged_by
        LEFT JOIN assets ast ON ast.id = a.asset_id
        ORDER BY a.created_at DESC
    `);
}

async function listUnacknowledgedSince(windowMinutes) {
    return query(
        `SELECT a.*, ast.name AS asset_name
         FROM alerts a
         LEFT JOIN assets ast ON ast.id = a.asset_id
         WHERE a.created_at >= DATEADD(MINUTE, -@windowMinutes, GETDATE()) AND a.acknowledged = 0
         ORDER BY a.created_at DESC`,
        { windowMinutes }
    );
}

async function recentUnacknowledgedForAsset(assetId, minutes) {
    return query(
        `SELECT id FROM alerts WHERE asset_id = @assetId AND acknowledged = 0
         AND created_at > DATEADD(MINUTE, -@minutes, GETDATE())`,
        { assetId, minutes }
    );
}

async function acknowledgeAlert(id, userId) {
    await query(
        `UPDATE alerts SET acknowledged=1, acknowledged_by=@userId, acknowledged_at=GETDATE() WHERE id=@id`,
        { id, userId }
    );
    return queryOne(
        `SELECT a.*, u.name AS acknowledged_by_name FROM alerts a
         LEFT JOIN users u ON u.id = a.acknowledged_by WHERE a.id = @id`,
        { id }
    );
}

module.exports = {
    createAlert,
    getAlertById,
    listAllAlerts,
    listUnacknowledgedSince,
    recentUnacknowledgedForAsset,
    acknowledgeAlert,
};
