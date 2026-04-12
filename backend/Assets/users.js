const { queryOne } = require("../DataBase/db");

async function findByEmail(email) {
    return queryOne(
        "SELECT id, name, email, password, role, is_active, last_login FROM users WHERE email = @email",
        { email }
    );
}

module.exports = { findByEmail };
