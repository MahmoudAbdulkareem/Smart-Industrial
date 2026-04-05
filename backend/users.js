// users.js — reads users from SQL Server
// Replaces the old hardcoded array

const { queryOne } = require("./db");

async function findByEmail(email) {
  return await queryOne(
    "SELECT id, name, email, password, role FROM users WHERE email = @email",
    { email }
  );
}

async function findById(id) {
  return await queryOne(
    "SELECT id, name, email, password, role FROM users WHERE id = @id",
    { id }
  );
}

module.exports = { findByEmail, findById };
