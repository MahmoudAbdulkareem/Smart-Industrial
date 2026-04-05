const sql = require("mssql");

// Test 1 — Windows Auth with instance name
async function test1() {
  try {
    await sql.connect({
      server: "localhost\\SQLEXPRESS",
      database: "SmartDashboard",
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false,
      },
    });
    console.log("TEST 1 WORKED — localhost\\SQLEXPRESS");
    await sql.close();
  } catch (e) {
    console.log("TEST 1 FAILED:", e.message);
  }
}

// Test 2 — dot notation
async function test2() {
  try {
    await sql.connect({
      server: ".\\SQLEXPRESS",
      database: "SmartDashboard",
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false,
      },
    });
    console.log("TEST 2 WORKED — .\\SQLEXPRESS");
    await sql.close();
  } catch (e) {
    console.log("TEST 2 FAILED:", e.message);
  }
}

// Test 3 — with port 1433
async function test3() {
  try {
    await sql.connect({
      server: "localhost",
      port: 1433,
      database: "SmartDashboard",
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false,
      },
    });
    console.log("TEST 3 WORKED — localhost:1433");
    await sql.close();
  } catch (e) {
    console.log("TEST 3 FAILED:", e.message);
  }
}

// Test 4 — SQL Login (create this user first in SSMS)
async function test4() {
  try {
    await sql.connect({
      server: "localhost\\SQLEXPRESS",
      database: "SmartDashboard",
      user: "sa",
      password: "YourPassword",
      options: {
        trustServerCertificate: true,
        encrypt: false,
      },
    });
    console.log("TEST 4 WORKED — sa login");
    await sql.close();
  } catch (e) {
    console.log("TEST 4 FAILED:", e.message);
  }
}

async function main() {
  await test1();
  await test2();
  await test3();
  console.log("\nDone. Tell me which tests passed.");
}

main();