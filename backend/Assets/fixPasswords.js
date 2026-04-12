
const bcrypt = require("bcryptjs");
const { query } = require("../DataBase/db");

async function fix() {
  const h1 = bcrypt.hashSync("maintenance123", 10);
  const h2 = bcrypt.hashSync("energy123", 10);
  const h3 = bcrypt.hashSync("itadmin123", 10);


  await query(
    "UPDATE users SET password = @pw WHERE email = @email",
    { pw: h1, email: "maintenance@dashboard.com" }
  );
  console.log("Updated maintenance@dashboard.com");

  await query(
    "UPDATE users SET password = @pw WHERE email = @email",
    { pw: h2, email: "energy@dashboard.com" }
  );
  console.log("Updated energy@dashboard.com");

  await query(
    "UPDATE users SET password = @pw WHERE email = @email",
    { pw: h3, email: "itadmin@dashboard.com" }
  );
  console.log("Updated itadmin@dashboard.com");



  console.log("Done — passwords are now correctly hashed.");
  process.exit(0);
}

fix().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
