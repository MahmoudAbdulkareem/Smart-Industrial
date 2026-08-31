const { query } = require("../db/pool");

async function recordAudit(userId, action, details = null) {
    await query(
        `INSERT INTO audit_logs (user_id, action, details) VALUES (@userId, @action, @details)`,
        { userId: userId || null, action, details: details ? JSON.stringify(details) : null }
    );
}

async function listAuditLogs(limit, offset, userId) {
    const params = { limit, offset };
    let sql = `SELECT al.id, al.user_id, u.name AS user_name, u.email AS user_email, al.action, al.details,
                      FORMAT(al.created_at,'yyyy-MM-ddTHH:mm:ss') AS created_at
               FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id`;
    if (userId) {
        sql += ` WHERE al.user_id = @userId`;
        params.userId = userId;
    }
    sql += ` ORDER BY al.created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;
    return query(sql, params);
}

module.exports = { recordAudit, listAuditLogs };
