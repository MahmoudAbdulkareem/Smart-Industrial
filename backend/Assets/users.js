const { queryOne } = require("../DataBase/db");

async function findByEmail(email) {
    return queryOne(
        `SELECT id, name, email, password, role, phone_number,
                totp_secret, totp_enabled, is_active, last_login
         FROM users WHERE email = @email`,
        { email }
    );
}

module.exports = { findByEmail };
