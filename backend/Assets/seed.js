// node seed.js

const bcrypt = require("bcryptjs");
const { query } = require("../DataBase/db");

async function seed() {
  console.log("Seeding user passwords...");

  const users = [
    { email: "maintenance@dashboard.com", password: "maintenance123" },
    { email: "energy@dashboard.com",      password: "energy123"      },
    { email: "itadmin@dashboard.com",      password: "itadmin123"  },
  ];

  for (const user of users) {
    const hash = bcrypt.hashSync(user.password, 10);
    await query(
      "UPDATE users SET password_hash = @hash WHERE email = @email",
      { hash, email: user.email }
    );
    console.log(`Password set for ${user.email}`);
  }

  console.log("Done. You can now log in with:");
  console.log("  maintenance@dashboard.com / maintenance123");
  console.log("  energy@dashboard.com / energy123");
  console.log("  itadmin@dashboard.com / itadmin123");
  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
