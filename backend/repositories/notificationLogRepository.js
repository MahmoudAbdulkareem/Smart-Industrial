// backend/repositories/notificationLogRepository.js
const { query, queryOne } = require("../DataBase/db");

async function logNotification(userId, alertId, channel, status, error = null) {
    return query(`
        INSERT INTO notification_logs (user_id, alert_id, channel, status, error, sent_at)
        VALUES (@userId, @alertId, @channel, @status, @error, GETDATE())
    `, {
        userId,
        alertId,
        channel,
        status,
        error: error ? JSON.stringify(error) : null
    });
}

async function getNotificationLogs(userId, limit = 50) {
    return query(`
        SELECT nl.*, 
               a.message as alert_message,
               a.severity as alert_severity
        FROM notification_logs nl
        LEFT JOIN alerts a ON a.id = nl.alert_id
        WHERE nl.user_id = @userId
        ORDER BY nl.sent_at DESC
        LIMIT @limit
    `, { userId, limit });
}

async function getNotificationStats(userId) {
    return queryOne(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
        FROM notification_logs
        WHERE user_id = @userId
    `, { userId });
}

module.exports = {
    logNotification,
    getNotificationLogs,
    getNotificationStats
};