const { query, queryOne } = require("../db/pool");

const SELECT_FIELDS = `id, name, email, role, phone_number, totp_enabled, is_active,
    FORMAT(created_at,'yyyy-MM-ddTHH:mm:ss') AS created_at,
    FORMAT(last_login,'yyyy-MM-ddTHH:mm:ss') AS last_login,
    FORMAT(deactivated_at,'yyyy-MM-ddTHH:mm:ss') AS deactivated_at`;

async function findByEmail(email) {
    return queryOne(
        `SELECT id, name, email, password, role, phone_number,
                totp_secret, totp_enabled, is_active, last_login, notification_preferences
         FROM users WHERE email = @email`,
        { email }
    );
}

async function findById(id) {
    return queryOne(`SELECT ${SELECT_FIELDS} FROM users WHERE id = @id`, { id });
}

async function findByIdWithSecret(id) {
    return queryOne(
        `SELECT id, name, email, role, totp_secret, totp_enabled FROM users WHERE id = @id`,
        { id }
    );
}

async function listAll() {
    return query(`SELECT ${SELECT_FIELDS} FROM users ORDER BY created_at DESC`);
}

async function emailInUse(email, excludeId) {
    if (excludeId) {
        return queryOne(`SELECT id FROM users WHERE email = @email AND id <> @excludeId`, { email, excludeId });
    }
    return queryOne(`SELECT id FROM users WHERE email = @email`, { email });
}

async function createUser({ name, email, passwordHash, role, phoneNumber }) {
    await query(
        `INSERT INTO users (name, email, password, role, phone_number, last_login, is_active)
         VALUES (@name, @email, @passwordHash, @role, @phoneNumber, GETDATE(), 1)`,
        { name, email, passwordHash, role, phoneNumber: phoneNumber || null }
    );
    return queryOne(`SELECT ${SELECT_FIELDS} FROM users WHERE email = @email`, { email });
}

async function updateUser(id, { name, email, role, passwordHash, phoneNumber }) {
    if (passwordHash) {
        await query(
            `UPDATE users SET name=@name, email=@email, role=@role, password=@passwordHash, phone_number=@phoneNumber WHERE id=@id`,
            { id, name, email, role, passwordHash, phoneNumber: phoneNumber || null }
        );
    } else {
        await query(
            `UPDATE users SET name=@name, email=@email, role=@role, phone_number=@phoneNumber WHERE id=@id`,
            { id, name, email, role, phoneNumber: phoneNumber || null }
        );
    }
    return queryOne(`SELECT ${SELECT_FIELDS} FROM users WHERE id = @id`, { id });
}

async function toggleActive(id, isActive) {
    if (isActive) {
        await query(`UPDATE users SET is_active=1, deactivated_at=NULL WHERE id=@id`, { id });
    } else {
        await query(`UPDATE users SET is_active=0, deactivated_at=GETDATE() WHERE id=@id`, { id });
    }
}

async function deleteUser(id) {
    await query(`DELETE FROM users WHERE id=@id`, { id });
}

async function setLastLogin(id) {
    await query(`UPDATE users SET last_login=GETDATE() WHERE id=@id`, { id });
}

async function setTotpSecret(id, secret) {
    await query(`UPDATE users SET totp_secret=@secret, totp_enabled=0 WHERE id=@id`, { id, secret });
}

async function enableTotp(id) {
    await query(`UPDATE users SET totp_enabled=1, last_login=GETDATE() WHERE id=@id`, { id });
}

async function resetTotp(id) {
    await query(`UPDATE users SET totp_secret=NULL, totp_enabled=0 WHERE id=@id`, { id });
}

async function getUsersForNotification(severity) {
    return query(
        `SELECT id, name, email, role, notification_preferences
         FROM users
         WHERE email IS NOT NULL AND email != '' AND is_active = 1
           AND role IN ('maintenance_engineer','it_admin','admin','energy_manager')`
    );
}

module.exports = {
    findByEmail,
    findById,
    findByIdWithSecret,
    listAll,
    emailInUse,
    createUser,
    updateUser,
    toggleActive,
    deleteUser,
    setLastLogin,
    setTotpSecret,
    enableTotp,
    resetTotp,
    getUsersForNotification,
};
