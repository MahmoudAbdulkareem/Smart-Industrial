/**
 * ═══════════════════════════════════════════════════════════════
 * api.test.js  —  Backend API Test Suite (Jest + Supertest)
 * ═══════════════════════════════════════════════════════════════
 *
 * WHAT THIS FILE DOES:
 *   42 tests across 17 describe() blocks covering every endpoint
 *   category: status, auth, RBAC, assets, alerts, work orders,
 *   energy, thresholds, reports, users, audit, chatbot, 404.
 *
 * WHY MOCK EVERYTHING?
 *   Tests must run WITHOUT a real SQL Server, ML service, or SMTP
 *   server. jest.mock() replaces each module with a fake version
 *   we control — so tests are fast (no network calls), deterministic
 *   (same result every time), and runnable in CI/CD without infrastructure.
 *
 * HOW TO RUN:
 *   cd backend
 *   npm test
 */

// ═══════════════════════════════════════════════════════════════
// MOCK SETUP — must come BEFORE importing server.js
// ═══════════════════════════════════════════════════════════════
// jest.mock(path, factory) replaces every `require(path)` call
// throughout the codebase with the object returned by factory().
// This must execute before server.js (and its requires) run,
// which is why these calls are at the top of the file — Jest
// hoists jest.mock() calls to the top of the file automatically.

// ── Mock the database layer ─────────────────────────────────────────────────
// Every db function returns a Jest mock function (jest.fn()).
// .mockResolvedValue(x) makes the mock return a Promise that resolves to x.
// Individual tests can override this with .mockResolvedValueOnce(y)
// to control what a SPECIFIC call returns.
jest.mock("../DataBase/db", () => ({
    getPool:  jest.fn().mockResolvedValue({}),
    query:    jest.fn().mockResolvedValue([]),
    queryOne: jest.fn().mockResolvedValue(null),
}));

// ── Mock the email notification service ──────────────────────────────────────
// All three functions resolve to true — tests don't need real emails sent.
jest.mock("../Services/notificationService", () => ({
    sendDeactivationWarning: jest.fn().mockResolvedValue(true),
    sendAccountDeletedEmail: jest.fn().mockResolvedValue(true),
    sendCriticalAlert:       jest.fn().mockResolvedValue(true),
}));

// ── Mock the energy service ───────────────────────────────────────────────────
jest.mock("../Services/energyService", () => ({
    writeEnergySnapshot: jest.fn().mockResolvedValue(true),
    getLatestEnergyData: jest.fn().mockResolvedValue([
        { zone: "Zone 1", electricity_kwh: 120, electricity_base: 120, water_lpm: 40, gas_m3h: 8, pue: 1.2, eer: 4.0, co2_emissions: 28 },
        { zone: "Zone 2", electricity_kwh: 95,  electricity_base: 95,  water_lpm: 35, gas_m3h: 6, pue: 1.1, eer: 4.2, co2_emissions: 22 },
    ]),
    getEnergyHistory: jest.fn().mockResolvedValue([
        { zone: "Zone 1", electricity_kwh: 120, electricity_base: 120, pue: 1.2, co2_emissions: 28, hour_label: "00:00" },
    ]),
}));

// ── Mock the report service ───────────────────────────────────────────────────
// generatePdfReport returns a Buffer (matching the real Puppeteer output type).
jest.mock("../Services/reportService", () => ({
    generateExcelReport: jest.fn().mockResolvedValue("<xml/>"),
    generateHtmlReport:  jest.fn().mockResolvedValue("<html></html>"),
    generatePdfReport:   jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4")),
}));

// ── Mock the asset data controller ────────────────────────────────────────────
jest.mock("../Controllers/assetData", () => ({
    computeMtbf:          jest.fn().mockResolvedValue(720),
    getLatestReadings:    jest.fn().mockResolvedValue([
        {
            id: "AST-001", name: "Compressor Unit A", type: "Compressor", location: "Zone 1",
            healthScore: 88, rul: 398, mtbf: 804, status: "healthy",
            vibration: 1.2, temperature: 45, pressure: 2.5,
        },
        {
            id: "AST-003", name: "Conveyor Belt C", type: "Conveyor", location: "Zone 3",
            healthScore: 22, rul: 9, mtbf: 276, status: "critical",
            vibration: 9.4, temperature: 92, pressure: 2.1,
        },
    ]),
    recordAndGetReadings: jest.fn().mockResolvedValue([]),
    getAlerts:            jest.fn().mockResolvedValue([
        { id: 1, asset_id: "AST-003", asset_name: "Conveyor Belt C", severity: "critical", message: "High vibration", acknowledged: 0, created_at: new Date() },
    ]),
    acknowledgeAlert:     jest.fn().mockResolvedValue(true),
    saveWorkOrder:        jest.fn().mockResolvedValue({ wonum: "WO-12345" }),
}));

// ── Mock node-cron ─────────────────────────────────────────────────────────────
// Prevents cron.schedule() from actually starting timers during tests
// (which would keep Jest's process alive and cause "did not exit" warnings).
jest.mock("node-cron", () => ({
    schedule: jest.fn(),
}));

// ── Mock the MQTT listener ────────────────────────────────────────────────────
// Prevents server.js from attempting a real MQTT connection during tests.
jest.mock("../Controllers/mqtt", () => ({
    startMqttListener: jest.fn(),
}));

// ── Suppress console output during tests ──────────────────────────────────────
// Keeps test output clean — we don't need to see "[Cron] ..." logs etc.
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});
jest.spyOn(console, "warn").mockImplementation(() => {});

// ═══════════════════════════════════════════════════════════════
// IMPORTS — after mocks are registered
// ═══════════════════════════════════════════════════════════════
const db        = require("../DataBase/db");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const request   = require("supertest");

// ── Import the Express app ────────────────────────────────────────────────────
// beforeAll() runs once before any test in this file.
// Setting env vars here ensures server.js uses our test JWT secret
// (matching the secret used in makeToken() below).
let app;
beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret-32chars-minimum!!";
    process.env.DB_SERVER  = "localhost";
    process.env.PORT       = "0";  // not used since require.main !== module
    // require() AFTER setting env vars and registering all mocks above.
    // Because server.js checks `if (require.main === module)`, importing
    // it here does NOT start an HTTP server — only exports { app, server }.
    ({ app } = require("../Connection/server"));
});

// ── Cleanup after all tests ────────────────────────────────────────────────────
afterAll(async () => {
    // Give any pending async operations (Socket.IO cleanup) time to settle.
    await new Promise(resolve => setTimeout(resolve, 200));
});

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * makeToken(payload) — generates a valid JWT for test requests.
 * Default payload represents a maintenance_engineer; tests override
 * fields (e.g. { role: "it_admin" }) to test different roles.
 */
function makeToken(payload = {}) {
    return jwt.sign(
        {
            id: 1,
            name: "Test User",
            email: "test@test.com",
            role: "maintenance_engineer",
            ...payload,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
    );
}

/**
 * makeHashedUser(role) — builds a fake user row with a bcrypt-hashed
 * password "password123". Used to mock db.queryOne() in login tests.
 */
async function makeHashedUser(role = "maintenance_engineer") {
    const hashedPassword = await bcrypt.hash("password123", 10);
    return {
        id: 1,
        name: "Test User",
        email: "test@test.com",
        password: hashedPassword,
        role,
        is_active: true,
        totp_enabled: false,
        totp_secret: null,
    };
}

// ═══════════════════════════════════════════════════════════════
// 1. SERVER STATUS
// ═══════════════════════════════════════════════════════════════
describe("GET /api/status", () => {
    it("returns 200 with status ok", async () => {
        const res = await request(app).get("/api/status");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("status", "ok");
        expect(res.body).toHaveProperty("version");
        expect(res.body).toHaveProperty("uptime");
    });
});

// ═══════════════════════════════════════════════════════════════
// 2. AUTHENTICATION — LOGIN
// ═══════════════════════════════════════════════════════════════
describe("POST /api/auth/login", () => {

    it("returns 400 if email or password missing", async () => {
        const res = await request(app).post("/api/auth/login").send({ email: "a@b.com" });
        expect(res.status).toBe(400);
    });

    it("returns 401 if user not found", async () => {
        // mockResolvedValueOnce: the NEXT call to queryOne returns null.
        db.queryOne.mockResolvedValueOnce(null);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "nobody@test.com", password: "wrong" });

        expect(res.status).toBe(401);
    });

    it("returns 403 if account is inactive", async () => {
        const user = await makeHashedUser();
        user.is_active = false;
        db.queryOne.mockResolvedValueOnce(user);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@test.com", password: "password123" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/inactive/i);
    });

    it("returns 401 if password is wrong", async () => {
        const user = await makeHashedUser();
        db.queryOne.mockResolvedValueOnce(user);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@test.com", password: "wrongpassword" });

        expect(res.status).toBe(401);
    });

    it("returns requiresTotpSetup when 2FA not yet configured", async () => {
        const user = await makeHashedUser();
        user.totp_enabled = false;
        db.queryOne.mockResolvedValueOnce(user);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@test.com", password: "password123" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("requiresTotpSetup", true);
        expect(res.body).toHaveProperty("setupToken");
    });

    it("returns requiresTotp when 2FA is enabled", async () => {
        const user = await makeHashedUser();
        user.totp_enabled = true;
        user.totp_secret  = "JBSWY3DPEHPK3PXP";
        db.queryOne.mockResolvedValueOnce(user);

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test@test.com", password: "password123" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("requiresTotp", true);
        expect(res.body).not.toHaveProperty("token");
    });
});

// ═══════════════════════════════════════════════════════════════
// 3. AUTHENTICATION — TOTP VERIFY
// ═══════════════════════════════════════════════════════════════
describe("POST /api/auth/verify-totp", () => {

    it("returns 400 if email or token missing", async () => {
        const res = await request(app).post("/api/auth/verify-totp").send({ email: "a@b.com" });
        expect(res.status).toBe(400);
    });

    it("returns 401 if no pending login session exists", async () => {
        const res = await request(app)
            .post("/api/auth/verify-totp")
            .send({ email: "neverlogged@test.com", token: "123456" });

        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/no pending/i);
    });
});

// ═══════════════════════════════════════════════════════════════
// 4. GET /api/auth/me
// ═══════════════════════════════════════════════════════════════
describe("GET /api/auth/me", () => {

    it("returns 401 without Authorization header", async () => {
        const res = await request(app).get("/api/auth/me");
        expect(res.status).toBe(401);
    });

    it("returns 401 with invalid/malformed token", async () => {
        const res = await request(app)
            .get("/api/auth/me")
            .set("Authorization", "Bearer not-a-real-token");
        expect(res.status).toBe(401);
    });

    it("returns 200 with valid token and user data", async () => {
        const token = makeToken();
        db.queryOne.mockResolvedValueOnce({
            id: 1, name: "Test User", email: "test@test.com",
            role: "maintenance_engineer", is_active: true, totp_enabled: true,
        });

        const res = await request(app)
            .get("/api/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("email", "test@test.com");
    });

    it("returns 403 if account has been deactivated since token was issued", async () => {
        const token = makeToken();
        db.queryOne.mockResolvedValueOnce({
            id: 1, name: "Test User", email: "test@test.com",
            role: "maintenance_engineer", is_active: false, totp_enabled: true,
        });

        const res = await request(app)
            .get("/api/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════
// 5. RBAC — ROLE GUARDS
// ═══════════════════════════════════════════════════════════════
describe("RBAC — role guards", () => {

    it("GET /api/users returns 403 for maintenance_engineer", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .get("/api/users")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it("GET /api/users returns 200 for it_admin", async () => {
        const token = makeToken({ role: "it_admin" });
        db.query.mockResolvedValueOnce([
            { id: 1, name: "Admin", email: "admin@test.com", role: "it_admin", is_active: true },
        ]);

        const res = await request(app)
            .get("/api/users")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/audit-logs returns 403 for energy_manager", async () => {
        const token = makeToken({ role: "energy_manager" });
        const res = await request(app)
            .get("/api/audit-logs")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it("POST /api/thresholds returns 403 for maintenance_engineer (requires energy_manager)", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .post("/api/thresholds")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-001", metric: "vibration", value: 8 });
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════
// 6. ASSET HEALTH
// ═══════════════════════════════════════════════════════════════
describe("GET /api/assets/health", () => {

    it("returns 401 without token", async () => {
        const res = await request(app).get("/api/assets/health");
        expect(res.status).toBe(401);
    });

    it("returns an array of assets with valid token", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/assets/health")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it("every asset has healthScore between 0 and 100", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/assets/health")
            .set("Authorization", `Bearer ${token}`);

        for (const asset of res.body) {
            expect(asset.healthScore).toBeGreaterThanOrEqual(0);
            expect(asset.healthScore).toBeLessThanOrEqual(100);
        }
    });

    it("every asset has a valid status value", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/assets/health")
            .set("Authorization", `Bearer ${token}`);

        const validStatuses = ["healthy", "caution", "critical"];
        for (const asset of res.body) {
            expect(validStatuses).toContain(asset.status);
        }
    });
});

// ═══════════════════════════════════════════════════════════════
// 7. ALERTS
// ═══════════════════════════════════════════════════════════════
describe("GET /api/alerts", () => {

    it("returns an array of alerts", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/alerts")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]).toHaveProperty("severity");
        expect(res.body[0]).toHaveProperty("message");
    });
});

describe("PATCH /api/alerts/:id/acknowledge", () => {

    it("returns 403 for energy_manager role", async () => {
        const token = makeToken({ role: "energy_manager" });
        const res = await request(app)
            .patch("/api/alerts/1/acknowledge")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it("returns 400 for non-numeric alert ID", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .patch("/api/alerts/abc/acknowledge")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 404 if alert does not exist", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce(null);  // alert not found

        const res = await request(app)
            .patch("/api/alerts/999/acknowledge")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it("returns 200 when acknowledging an existing alert", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce({ id: 1 });  // alert exists

        const res = await request(app)
            .patch("/api/alerts/1/acknowledge")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════
// 8. WORK ORDERS
// ═══════════════════════════════════════════════════════════════
describe("GET /api/workorders", () => {

    it("returns an array of work orders", async () => {
        const token = makeToken();
        db.query.mockResolvedValueOnce([
            { id: 1, wonum: "WO-001", asset_id: "AST-003", asset_name: "Conveyor Belt C", status: "WAPPR", priority: "High" },
        ]);

        const res = await request(app)
            .get("/api/workorders")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe("POST /api/workorders", () => {

    it("returns 400 if assetId or description missing", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .post("/api/workorders")
            .set("Authorization", `Bearer ${token}`)
            .send({ description: "Missing asset ID" });
        expect(res.status).toBe(400);
    });

    it("returns 400 for invalid priority value", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce({ id: "AST-001", name: "Compressor Unit A" });

        const res = await request(app)
            .post("/api/workorders")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-001", description: "Test", priority: "Super-Urgent" });
        expect(res.status).toBe(400);
    });

    it("returns 404 if asset does not exist", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce(null);  // asset not found

        const res = await request(app)
            .post("/api/workorders")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-999", description: "Test", priority: "High" });
        expect(res.status).toBe(404);
    });

    it("returns 201 when work order is created successfully", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce({ id: "AST-001", name: "Compressor Unit A" });

        const res = await request(app)
            .post("/api/workorders")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-001", description: "Vibration check", priority: "High" });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("workOrder");
        expect(res.body.workOrder.wonum).toMatch(/^WO-/);
    });

    it("returns 403 for energy_manager", async () => {
        const token = makeToken({ role: "energy_manager" });
        const res = await request(app)
            .post("/api/workorders")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-001", description: "Test", priority: "Medium" });
        expect(res.status).toBe(403);
    });
});

describe("PATCH /api/workorders/:id/status", () => {

    it("returns 400 for an invalid status value", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .patch("/api/workorders/1/status")
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "DELETED" });
        expect(res.status).toBe(400);
    });

    it("returns 404 if work order does not exist", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce(null);

        const res = await request(app)
            .patch("/api/workorders/999/status")
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "INPRG" });
        expect(res.status).toBe(404);
    });

    it("returns 200 for a valid status transition", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        db.queryOne.mockResolvedValueOnce({ id: 1, wonum: "WO-001", status: "WAPPR" });

        const res = await request(app)
            .patch("/api/workorders/1/status")
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "INPRG" });
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════
// 9. ENERGY
// ═══════════════════════════════════════════════════════════════
describe("GET /api/energy", () => {

    it("returns 401 without token", async () => {
        const res = await request(app).get("/api/energy");
        expect(res.status).toBe(401);
    });

    it("returns zones, summary, and history for energy_manager", async () => {
        const token = makeToken({ role: "energy_manager" });
        const res = await request(app)
            .get("/api/energy")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("zones");
        expect(res.body).toHaveProperty("summary");
        expect(res.body).toHaveProperty("history");
    });

    it("allows any authenticated role to view energy data", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .get("/api/energy")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});

describe("GET /api/energy/history", () => {

    it("returns 200 with history array", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/energy/history")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// 10. THRESHOLDS
// ═══════════════════════════════════════════════════════════════
describe("POST /api/thresholds", () => {

    it("returns 400 if required fields are missing", async () => {
        const token = makeToken({ role: "energy_manager" });
        const res = await request(app)
            .post("/api/thresholds")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-001" });  // missing metric and value
        expect(res.status).toBe(400);
    });

    it("returns 200 when threshold is saved for energy_manager", async () => {
        const token = makeToken({ role: "energy_manager" });
        const res = await request(app)
            .post("/api/thresholds")
            .set("Authorization", `Bearer ${token}`)
            .send({ assetId: "AST-001", metric: "vibration", value: 8.0 });
        expect(res.status).toBe(200);
    });
});

describe("GET /api/thresholds", () => {

    it("returns an array of thresholds", async () => {
        const token = makeToken();
        db.query.mockResolvedValueOnce([
            { asset_id: "AST-001", metric: "vibration", value: 8.0 },
        ]);

        const res = await request(app)
            .get("/api/thresholds")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════
// 11. REPORTS
// ═══════════════════════════════════════════════════════════════
describe("GET /api/reports/energy", () => {

    it("returns 401 without token", async () => {
        const res = await request(app).get("/api/reports/energy");
        expect(res.status).toBe(401);
    });

    it("returns HTML by default", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/reports/energy")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/html/);
    });

    it("returns Excel for ?format=excel", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/reports/energy?format=excel")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/excel/);
    });

    it("returns PDF for ?format=pdf", async () => {
        const token = makeToken();
        const res = await request(app)
            .get("/api/reports/energy?format=pdf")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/pdf/);
    });
});

// ═══════════════════════════════════════════════════════════════
// 12. USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════
describe("POST /api/users", () => {

    it("returns 403 for non-admin", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New", email: "new@test.com", role: "maintenance_engineer", password: "Pass123" });
        expect(res.status).toBe(403);
    });

    it("returns 400 if required fields missing", async () => {
        const token = makeToken({ role: "it_admin" });
        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ email: "new@test.com" });  // missing name, role, password
        expect(res.status).toBe(400);
    });

    it("returns 400 for invalid role", async () => {
        const token = makeToken({ role: "it_admin" });
        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New", email: "new@test.com", role: "ceo", password: "Pass123" });
        expect(res.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
        const token = makeToken({ role: "it_admin" });
        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New", email: "not-an-email", role: "maintenance_engineer", password: "Pass123" });
        expect(res.status).toBe(400);
    });

    it("returns 409 if email already exists", async () => {
        const token = makeToken({ role: "it_admin" });
        db.queryOne.mockResolvedValueOnce({ id: 5, email: "exists@test.com" });

        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New", email: "exists@test.com", role: "maintenance_engineer", password: "Pass123" });
        expect(res.status).toBe(409);
    });

    it("returns 400 for password shorter than 6 chars", async () => {
        const token = makeToken({ role: "it_admin" });
        db.queryOne.mockResolvedValueOnce(null);  // email not taken

        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New", email: "new@test.com", role: "maintenance_engineer", password: "abc" });
        expect(res.status).toBe(400);
    });

    it("returns 201 for a valid new user", async () => {
        const token = makeToken({ role: "it_admin" });
        db.queryOne.mockResolvedValueOnce(null);  // email not taken

        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New User", email: "newuser@test.com", role: "maintenance_engineer", password: "Pass1234" });
        expect(res.status).toBe(201);
    });
});

describe("PATCH /api/users/:id/toggle-active", () => {

    it("returns 400 when admin tries to deactivate themselves", async () => {
        const token = makeToken({ role: "it_admin", id: 5 });
        const res = await request(app)
            .patch("/api/users/5/toggle-active")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 404 if target user does not exist", async () => {
        const token = makeToken({ role: "it_admin", id: 1 });
        db.queryOne.mockResolvedValueOnce(null);

        const res = await request(app)
            .patch("/api/users/999/toggle-active")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it("returns 400 when trying to deactivate another admin", async () => {
        const token = makeToken({ role: "it_admin", id: 1 });
        db.queryOne.mockResolvedValueOnce({ id: 2, name: "Other Admin", email: "admin2@test.com", role: "it_admin", is_active: true });

        const res = await request(app)
            .patch("/api/users/2/toggle-active")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 200 when deactivating a non-admin user", async () => {
        const token = makeToken({ role: "it_admin", id: 1 });
        db.queryOne.mockResolvedValueOnce({ id: 2, name: "Eng", email: "eng@test.com", role: "maintenance_engineer", is_active: true });

        const res = await request(app)
            .patch("/api/users/2/toggle-active")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.is_active).toBe(0);  // 0 = deactivated
    });
});

describe("DELETE /api/users/:id", () => {

    it("returns 400 when deleting yourself", async () => {
        const token = makeToken({ role: "it_admin", id: 1 });
        const res = await request(app)
            .delete("/api/users/1")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .delete("/api/users/2")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it("returns 400 when deleting another admin", async () => {
        const token = makeToken({ role: "it_admin", id: 1 });
        db.queryOne.mockResolvedValueOnce({ id: 2, role: "it_admin", email: "admin2@test.com" });

        const res = await request(app)
            .delete("/api/users/2")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it("returns 200 for valid deletion", async () => {
        const token = makeToken({ role: "it_admin", id: 1 });
        db.queryOne.mockResolvedValueOnce({ id: 2, role: "maintenance_engineer", email: "eng@test.com" });

        const res = await request(app)
            .delete("/api/users/2")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});

// ═══════════════════════════════════════════════════════════════
// 13. AUDIT LOG
// ═══════════════════════════════════════════════════════════════
describe("GET /api/audit-logs", () => {

    it("returns 403 for non-admin", async () => {
        const token = makeToken({ role: "maintenance_engineer" });
        const res = await request(app)
            .get("/api/audit-logs")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it("returns paginated results for it_admin", async () => {
        const token = makeToken({ role: "it_admin" });
        db.query.mockResolvedValueOnce([
            { id: 1, action: "LOGIN_SUCCESS", user_name: "Ali", created_at: new Date() },
        ]);

        const res = await request(app)
            .get("/api/audit-logs?page=1&limit=20")
            .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("page", 1);
        expect(res.body).toHaveProperty("data");
    });
});

// ═══════════════════════════════════════════════════════════════
// 14. CHATBOT PROXY
// ═══════════════════════════════════════════════════════════════
describe("POST /api/chatbot", () => {

    it("returns 401 without token", async () => {
        const res = await request(app)
            .post("/api/chatbot")
            .send({ history: [{ role: "user", content: "hello" }] });
        expect(res.status).toBe(401);
    });

    it("returns 400 if 'history' is missing", async () => {
        const token = makeToken();
        const res = await request(app)
            .post("/api/chatbot")
            .set("Authorization", `Bearer ${token}`)
            .send({ message: "hello" });  // wrong field name
        expect(res.status).toBe(400);
    });

    it("returns 503 when GEMINI_API_KEY is not configured", async () => {
        delete process.env.GEMINI_API_KEY;
        const token = makeToken();
        const res = await request(app)
            .post("/api/chatbot")
            .set("Authorization", `Bearer ${token}`)
            .send({ history: [{ role: "user", content: "hello" }] });
        expect(res.status).toBe(503);
    });
});

// ═══════════════════════════════════════════════════════════════
// 15. SWAGGER DOCS
// ═══════════════════════════════════════════════════════════════
describe("GET /api/docs.json", () => {

    it("returns the OpenAPI spec as JSON", async () => {
        const res = await request(app).get("/api/docs.json");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("openapi");
        expect(res.body).toHaveProperty("paths");
    });
});

// ═══════════════════════════════════════════════════════════════
// 16. 404 HANDLER
// ═══════════════════════════════════════════════════════════════
describe("404 handler", () => {

    it("returns 404 with error message for unknown routes", async () => {
        const res = await request(app).get("/api/this-route-does-not-exist");
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty("error", "Not Found");
    });
});

// ═══════════════════════════════════════════════════════════════
// 17. ROOT ENDPOINT
// ═══════════════════════════════════════════════════════════════
describe("GET /", () => {

    it("returns service info", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("message");
        expect(res.body).toHaveProperty("status", "running");
    });
});
