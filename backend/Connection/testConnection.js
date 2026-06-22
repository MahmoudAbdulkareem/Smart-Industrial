const sql = require("mssql");

async function test1() {
  try {
    await sql.connect({
      server: "localhost\\SQLEXPRESS",
      database: "SmartDashboard",
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false,
        bcrypt: true,
      },
    });
    console.log("TEST 1 WORKED — localhost\\SQLEXPRESS");
    await sql.close();
  } catch (e) {
    console.log("TEST 1 FAILED:", e.message);
  }
}

async function test2() {
  try {
    await sql.connect({
      server: ".\\SQLEXPRESS",
      database: "SmartDashboard",
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false,
        bcyrpt: true,
      },
    });
    console.log("TEST 2 WORKED — .\\SQLEXPRESS");
    await sql.close();
  } catch (e) {
    console.log("TEST 2 FAILED:", e.message);
  }
}

async function main() {
  await test1();
  await test2();
  console.log("\nDone. Tell me which tests passed.");
}

main();