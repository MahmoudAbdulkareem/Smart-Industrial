const { query, queryOne } = require("../db/pool");

async function logNotification(userId, alertId, channel, status, error = null) {
    return query(
        `INSERT INTO notification_logs (user_id, alert_id, channel, status, error, sent_at)
         VALUES (@userId, @alertId, @channel, @status, @error, GETDATE())`,
        { userId, alertId, channel, status, error: error ? JSON.stringify(error) : null }
    );
}

async function getNotificationLogs(userId, limit) {
    return query(
        `SELECT TOP (@limit) nl.*, a.message AS alert_message, a.severity AS alert_severity
         FROM notification_logs nl
         LEFT JOIN alerts a ON a.id = nl.alert_id
         WHERE nl.user_id = @userId
         ORDER BY nl.sent_at DESC`,
        { userId, limit: limit || 50 }
    );
}

async function getNotificationStats(userId) {
    return queryOne(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
         FROM notification_logs WHERE user_id = @userId`,
        { userId }
    );
}

module.exports = { logNotification, getNotificationLogs, getNotificationStats };
