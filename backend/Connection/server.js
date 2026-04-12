const express  = require("express");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");
const cron     = require("node-cron");

const { getEnergyData }                                                    = require("../Assets/mockData");
const { findByEmail }                                                      = require("../Assets/users");
const { generateToken, requireAuth, requireRole }                          = require("../MiddleWare/auth");
const { recordAndGetReadings, getLatestReadings, getAlerts, acknowledgeAlert, saveWorkOrder } = require("../Assets/assetData");
const { sendOTPEmail, sendDeactivationWarning, sendAccountDeletedEmail }   = require("../Assets/emailService");
const { query, queryOne } = require("../DataBase/db");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const otpStore = new Map();
const qrStore  = new Map();

app.get("/api/status", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await findByEmail(email);
        if (!user) return res.status(401).json({ error: "Invalid email or password" });
        if (!user.is_active) return res.status(403).json({ error: "Account is inactive. Contact an administrator." });

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid email or password" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { code: otp, expiresAt: Date.now() + 600_000 });

        sendOTPEmail(email, user.name, otp).catch(err => console.error("OTP email error:", err.message));

        const isDev = !process.env.SMTP_HOST;
        res.json({ requiresOTP: true, email, ...(isDev && { devOTP: otp }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during login" });
    }
});

app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: "Email and OTP required" });

        const entry = otpStore.get(email);
        if (!entry)                   return res.status(401).json({ error: "No pending OTP for this email" });
        if (Date.now() > entry.expiresAt) { otpStore.delete(email); return res.status(401).json({ error: "OTP expired. Please log in again." }); }
        if (entry.code !== otp.trim()) return res.status(401).json({ error: "Invalid OTP code" });

        otpStore.delete(email);

        const user = await findByEmail(email);
        await query("UPDATE users SET last_login = GETDATE() WHERE id = @id", { id: user.id });

        const token = generateToken(user);
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during OTP verification" });
    }
});

app.post("/api/auth/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await findByEmail(email);
        if (!user || !user.is_active) return res.status(404).json({ error: "User not found or inactive" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { code: otp, expiresAt: Date.now() + 600_000 });
        sendOTPEmail(email, user.name, otp).catch(() => {});

        const isDev = !process.env.SMTP_HOST;
        res.json({ message: "OTP resent", ...(isDev && { devOTP: otp }) });
    } catch (err) {
        res.status(500).json({ error: "Failed to resend OTP" });
    }
});

app.post("/api/auth/qr-generate", (req, res) => {
    const token  = "qr_" + Math.random().toString(36).slice(2) + Date.now();
    const expiry = Date.now() + 120_000;
    qrStore.set(token, { expiresAt: expiry, approved: false });
    res.json({ token, expiresAt: expiry });
});

app.get("/api/auth/qr-approve", requireAuth, async (req, res) => {
    const { token } = req.query;
    const entry = qrStore.get(token);
    if (!entry || Date.now() > entry.expiresAt) return res.status(400).send("<h2>QR code expired or invalid.</h2>");
    const user = await findByEmail(req.user.email);
    entry.approved = true;
    entry.jwt  = generateToken(user);
    entry.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.send("<h2>Login approved. You can close this tab.</h2>");
});

app.get("/api/auth/qr-status", (req, res) => {
    const { token } = req.query;
    const entry = qrStore.get(token);
    if (!entry)                       return res.status(404).json({ error: "Token not found" });
    if (Date.now() > entry.expiresAt) { qrStore.delete(token); return res.status(410).json({ error: "Expired" }); }
    if (entry.approved) {
        const { jwt: jwtToken, user } = entry;
        qrStore.delete(token);
        return res.json({ approved: true, token: jwtToken, user });
    }
    res.json({ approved: false });
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.get("/api/assets/health", requireAuth, async (req, res) => {
    try {
        let data = await getLatestReadings();
        if (!data || data.length === 0) data = await recordAndGetReadings();
        res.json(data);
    } catch (err) {
        console.error("GET /api/assets/health error:", err);
        res.status(500).json({ error: "Failed to get asset health: " + err.message });
    }
});

app.get("/api/energy", requireAuth, (req, res) => res.json(getEnergyData()));

app.get("/api/energy/metrics/latest", requireAuth, async (req, res) => {
    try {
        const rows = await query(`
            SELECT zone,
                   AVG(pue)           AS pue,
                   AVG(eer)           AS eer,
                   AVG(co2_emissions) AS co2_emissions
            FROM energy_metrics
            WHERE recorded_at >= DATEADD(HOUR, -24, GETDATE())
            GROUP BY zone
            ORDER BY zone
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get energy metrics" });
    }
});

app.post("/api/energy/metrics", requireAuth, requireRole("energy_manager"), async (req, res) => {
    try {
        const { zone, pue, eer, co2_emissions } = req.body;
        if (!zone || pue == null || eer == null || co2_emissions == null)
            return res.status(400).json({ error: "zone, pue, eer and co2_emissions are required" });

        await query(
            "INSERT INTO energy_metrics (zone, pue, eer, co2_emissions) VALUES (@zone, @pue, @eer, @co2)",
            { zone, pue: parseFloat(pue), eer: parseFloat(eer), co2: parseFloat(co2_emissions) }
        );
        const created = await queryOne(
            `SELECT TOP 1 id, zone, pue, eer, co2_emissions, FORMAT(recorded_at,'yyyy-MM-ddTHH:mm:ss') AS recorded_at
             FROM energy_metrics WHERE zone = @zone ORDER BY recorded_at DESC`,
            { zone }
        );
        res.status(201).json(created);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to record energy metrics" });
    }
});

app.get("/api/alerts", requireAuth, async (req, res) => {
    try { res.json(await getAlerts()); }
    catch (err) { res.status(500).json({ error: "Failed to get alerts" }); }
});

app.patch("/api/alerts/:id/acknowledge", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try { await acknowledgeAlert(parseInt(req.params.id)); res.json({ message: "Alert acknowledged" }); }
    catch (err) { res.status(500).json({ error: "Failed to acknowledge alert" }); }
});

app.post("/api/workorders", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const { assetId, description } = req.body;
        if (!assetId || !description) return res.status(400).json({ error: "assetId and description required" });
        const wo = { wonum: "WO-" + Date.now(), assetId, description, status: "WAPPR", createdBy: req.user.name };
        await saveWorkOrder(wo);
        res.status(201).json(wo);
    } catch (err) {
        res.status(500).json({ error: "Failed to create work order" });
    }
});

app.get("/api/workorders", requireAuth, async (req, res) => {
    try {
        const rows = await query(`
            SELECT w.id, w.wonum, w.asset_id, a.name AS asset_name,
                   w.description, w.priority, w.status, w.created_by, w.created_at
            FROM work_orders w
            INNER JOIN assets a ON a.id = w.asset_id
            ORDER BY w.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to get work orders" });
    }
});

app.post("/api/thresholds", requireAuth, requireRole("energy_manager"), (req, res) => {
    const { assetId, metric, value } = req.body;
    res.json({ message: "Threshold updated", assetId, metric, value });
});

app.get("/api/users", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const rows = await query(`
            SELECT id, name, email, role, is_active,
                   FORMAT(created_at,     'yyyy-MM-ddTHH:mm:ss') AS created_at,
                   FORMAT(last_login,     'yyyy-MM-ddTHH:mm:ss') AS last_login,
                   FORMAT(deactivated_at, 'yyyy-MM-ddTHH:mm:ss') AS deactivated_at
            FROM users ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load users" });
    }
});

app.get("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const user = await queryOne(
            `SELECT id, name, email, role, is_active,
                    FORMAT(created_at, 'yyyy-MM-ddTHH:mm:ss') AS created_at,
                    FORMAT(last_login, 'yyyy-MM-ddTHH:mm:ss') AS last_login
             FROM users WHERE id = @id`,
            { id: parseInt(req.params.id) }
        );
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: "Failed to get user" });
    }
});

app.post("/api/users", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const { name, email, role, password } = req.body;
        if (!name || !email || !role || !password)
            return res.status(400).json({ error: "name, email, role and password are required" });

        const validRoles = ["maintenance_engineer", "energy_manager", "it_admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email format" });

        const exists = await queryOne("SELECT id FROM users WHERE email = @email", { email });
        if (exists) return res.status(409).json({ error: "Email already in use" });

        const hashed = bcrypt.hashSync(password, 10);
        await query(
            "INSERT INTO users (name, email, password, role, last_login, is_active) VALUES (@name, @email, @hash, @role, GETDATE(), 1)",
            { name, email, hash: hashed, role }
        );
        const created = await queryOne(
            `SELECT id, name, email, role, is_active,
                    FORMAT(created_at, 'yyyy-MM-ddTHH:mm:ss') AS created_at,
                    FORMAT(last_login, 'yyyy-MM-ddTHH:mm:ss') AS last_login
             FROM users WHERE email = @email`,
            { email }
        );
        res.status(201).json(created);
    } catch (err) {
        res.status(500).json({ error: "Failed to create user" });
    }
});

app.put("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, email, role, password } = req.body;
        if (!name || !email || !role) return res.status(400).json({ error: "name, email and role are required" });

        const validRoles = ["maintenance_engineer", "energy_manager", "it_admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

        const existing = await queryOne("SELECT id FROM users WHERE id = @id", { id });
        if (!existing) return res.status(404).json({ error: "User not found" });

        const dupe = await queryOne("SELECT id FROM users WHERE email = @email AND id <> @id", { email, id });
        if (dupe) return res.status(409).json({ error: "Email already in use" });

        if (password) {
            await query(
                "UPDATE users SET name = @name, email = @email, role = @role, password = @hash WHERE id = @id",
                { name, email, role, hash: bcrypt.hashSync(password, 10), id }
            );
        } else {
            await query("UPDATE users SET name = @name, email = @email, role = @role WHERE id = @id", { name, email, role, id });
        }

        const updated = await queryOne(
            `SELECT id, name, email, role, is_active,
                    FORMAT(created_at, 'yyyy-MM-ddTHH:mm:ss') AS created_at,
                    FORMAT(last_login, 'yyyy-MM-ddTHH:mm:ss') AS last_login
             FROM users WHERE id = @id`,
            { id }
        );
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: "Failed to update user" });
    }
});

app.patch("/api/users/:id/toggle-active", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (req.user.id === id) return res.status(400).json({ error: "Cannot change your own active status" });

        const target = await queryOne("SELECT id, role, is_active, name, email FROM users WHERE id = @id", { id });
        if (!target) return res.status(404).json({ error: "User not found" });
        if (target.role === "it_admin") return res.status(400).json({ error: "Cannot change active status of an IT Admin" });

        const newState = target.is_active ? 0 : 1;
        if (newState === 0) {
            await query("UPDATE users SET is_active = 0, deactivated_at = GETDATE() WHERE id = @id", { id });
            sendDeactivationWarning(target.email, target.name, 24).catch(() => {});
        } else {
            await query("UPDATE users SET is_active = 1, deactivated_at = NULL WHERE id = @id", { id });
        }
        res.json({ id, is_active: newState });
    } catch (err) {
        res.status(500).json({ error: "Failed to toggle user status" });
    }
});

app.delete("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (req.user.id === id) return res.status(400).json({ error: "Cannot delete your own account" });

        const target = await queryOne("SELECT id, role, name, email FROM users WHERE id = @id", { id });
        if (!target) return res.status(404).json({ error: "User not found" });
        if (target.role === "it_admin") return res.status(400).json({ error: "Cannot delete an IT Admin account" });

        await query("DELETE FROM users WHERE id = @id", { id });
        sendAccountDeletedEmail(target.email, target.name).catch(() => {});
        res.json({ message: "User deleted", id });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete user" });
    }
});

app.get("/api/users/inactive-check", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const rows = await query(`
            SELECT id, name, email, role, is_active,
                   FORMAT(last_login, 'yyyy-MM-ddTHH:mm:ss') AS last_login
            FROM users
            WHERE (last_login IS NULL OR last_login < DATEADD(MONTH, -6, GETDATE()))
              AND is_active = 1
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to check inactive users" });
    }
});

app.post("/api/users/mark-inactive", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        await query(`
            UPDATE users
            SET is_active = 0, deactivated_at = GETDATE()
            WHERE (last_login IS NULL OR last_login < DATEADD(MONTH, -6, GETDATE()))
              AND is_active = 1 AND role <> 'it_admin'
        `);
        res.json({ message: "Inactive users marked successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to mark inactive users" });
    }
});

cron.schedule("0 * * * *", async () => {
    try {
        const toDelete = await query(`
            SELECT id, name, email FROM users
            WHERE is_active = 0
              AND deactivated_at IS NOT NULL
              AND deactivated_at <= DATEADD(HOUR, -24, GETDATE())
              AND role <> 'it_admin'
        `);
        for (const u of toDelete) {
            await query("DELETE FROM users WHERE id = @id", { id: u.id });
            sendAccountDeletedEmail(u.email, u.name).catch(() => {});
            console.log("Auto-deleted inactive user:", u.email);
        }
        const soonToDelete = await query(`
            SELECT id, name, email FROM users
            WHERE is_active = 0
              AND deactivated_at IS NOT NULL
              AND deactivated_at <= DATEADD(HOUR, -23, GETDATE())
              AND deactivated_at >  DATEADD(HOUR, -24, GETDATE())
              AND role <> 'it_admin'
        `);
        for (const u of soonToDelete) {
            sendDeactivationWarning(u.email, u.name, 1).catch(() => {});
        }
    } catch (err) {
        console.error("Cron auto-delete error:", err.message);
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
