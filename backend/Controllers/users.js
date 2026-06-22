// backend/repositories/userRepository.js
const { query, queryOne } = require("../DataBase/db");

async function findByEmail(email) {
    return queryOne(
        `SELECT id, name, email, password, role, phone_number,
                totp_secret, totp_enabled, is_active, last_login,
                notification_preferences
         FROM users WHERE email = @email`,
        { email }
    );
}

async function findById(id) {
    return queryOne(
        `SELECT id, name, email, password, role, phone_number,
                totp_secret, totp_enabled, is_active, last_login,
                notification_preferences
         FROM users WHERE id = @id`,
        { id }
    );
}

async function getUsersByRole(role) {
    return query(
        `SELECT id, name, email, role, notification_preferences
         FROM users 
         WHERE role = @role 
           AND email IS NOT NULL 
           AND email != ''
           AND is_active = 1`,
        { role }
    );
}

async function getUsersForNotification(severity) {
    let sql = `
        SELECT id, name, email, role, notification_preferences
        FROM users 
        WHERE email IS NOT NULL 
          AND email != ''
          AND is_active = 1
    `;
    
    // For critical alerts, get all maintenance and admin users
    if (severity === 'critical') {
        sql += ` AND role IN ('maintenance_engineer', 'it_admin', 'admin', 'energy_manager')`;
    } else {
        sql += ` AND role IN ('maintenance_engineer', 'it_admin', 'admin', 'energy_manager')`;
    }
    
    return query(sql);
}

async function updateNotificationPreferences(userId, preferences) {
    return query(
        `UPDATE users 
         SET notification_preferences = @preferences
         WHERE id = @userId`,
        { 
            userId, 
            preferences: JSON.stringify(preferences) 
        }
    );
}

async function getNotificationPreferences(userId) {
    const user = await queryOne(
        `SELECT notification_preferences FROM users WHERE id = @userId`,
        { userId }
    );
    
    if (!user || !user.notification_preferences) {
        return {
            email_enabled: true,
            daily_digest: true,
            push_enabled: true,
            severity_filters: {
                critical: true,
                caution: true,
                info: false
            }
        };
    }
    
    try {
        return JSON.parse(user.notification_preferences);
    } catch {
        return {
            email_enabled: true,
            daily_digest: true,
            push_enabled: true,
            severity_filters: {
                critical: true,
                caution: true,
                info: false
            }
        };
    }
}

module.exports = {
    findByEmail,
    findById,
    getUsersByRole,
    getUsersForNotification,
    updateNotificationPreferences,
    getNotificationPreferences
};