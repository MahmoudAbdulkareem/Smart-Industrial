const bcrypt = require("bcryptjs");
const { query } = require("../DataBase/db");

async function seed() {
    const users = [
        { email: "maintenance@dashboard.com", password: "maintenance123" },
        { email: "energy@dashboard.com",      password: "energy123" },
        { email: "itadmin@dashboard.com",     password: "itadmin123" },
    ];
    for (const u of users) {
        const hash = bcrypt.hashSync(u.password, 10);
        await query("UPDATE users SET password = @hash WHERE email = @email", { hash, email: u.email });
        console.log("Password set for", u.email);
    }
    console.log("Seeding complete.");
    process.exit(0);
}

seed().catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
