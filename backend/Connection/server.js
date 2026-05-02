require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const express   = require("express");
const cors      = require("cors");
const bcrypt    = require("bcryptjs");
const cron      = require("node-cron");
const jwt       = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode    = require("qrcode");

const { getEnergyData }                                                      = require("../Assets/mockData");
const { findByEmail }                                                        = require("../Assets/users");
const { generateToken, requireAuth, requireRole }                            = require("../MiddleWare/auth");
const { recordAndGetReadings, getLatestReadings, getAlerts, acknowledgeAlert, saveWorkOrder } = require("../Assets/assetData");
const { query, queryOne } = require("../DataBase/db");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const pendingTotp = new Map();

const qrStore = new Map();

app.get("/api/status", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await findByEmail(email);
        if (!user)          return res.status(401).json({ error: "Invalid email or password" });
        if (!user.is_active) return res.status(403).json({ error: "Account is inactive. Contact an administrator." });

        const valid = bcrypt.compareSync(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid email or password" });

        if (!user.totp_enabled) {
            const setupToken = jwt.sign(
                { id: user.id, email: user.email, purpose: "totp_setup" },
                process.env.JWT_SECRET,
                { expiresIn: "10m" }
            );
            return res.json({ requiresTotpSetup: true, setupToken });
        }

        pendingTotp.set(email, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
        res.json({ requiresTotp: true, email });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during login" });
    }
});

app.post("/api/auth/verify-totp", async (req, res) => {
    try {
        const { email, token } = req.body;
        if (!email || !token) return res.status(400).json({ error: "Email and token required" });

        const pending = pendingTotp.get(email);
        if (!pending)                    return res.status(401).json({ error: "No pending login for this email. Please log in again." });
        if (Date.now() > pending.expiresAt) { pendingTotp.delete(email); return res.status(401).json({ error: "Session expired. Please log in again." }); }

        const user = await findByEmail(email);
        if (!user || !user.totp_secret)  return res.status(401).json({ error: "TOTP not configured for this account" });

        const valid = speakeasy.totp.verify({
            secret:   user.totp_secret,
            encoding: "base32",
            token:    token.trim().replace(/\s/g, ""),
            window:   1,
        });

        if (!valid) return res.status(401).json({ error: "Invalid authenticator code. Make sure your phone clock is correct." });

        pendingTotp.delete(email);
        await query("UPDATE users SET last_login = GETDATE() WHERE id = @id", { id: user.id });

        const jwtToken = generateToken(user);
        res.json({ token: jwtToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error during TOTP verification" });
    }
});

app.post("/api/auth/totp-setup", async (req, res) => {
    try {
        const { setupToken } = req.body;
        if (!setupToken) return res.status(400).json({ error: "Setup token required" });

        let decoded;
        try {
            decoded = jwt.verify(setupToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Setup token invalid or expired. Please log in again." });
        }
        if (decoded.purpose !== "totp_setup") return res.status(401).json({ error: "Invalid setup token" });

        const user = await queryOne("SELECT id, name, email, totp_enabled FROM users WHERE id = @id", { id: decoded.id });
        if (!user) return res.status(404).json({ error: "User not found" });

        const secret = speakeasy.generateSecret({
            name:   `Smart Dashboard (${user.email})`,
            issuer: "Smart Dashboard",
            length: 20,
        });

        await query(
            "UPDATE users SET totp_secret = @secret, totp_enabled = 0 WHERE id = @id",
            { secret: secret.base32, id: user.id }
        );

        const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({
            secret:    secret.base32,
            qrDataUrl,
            otpauthUrl: secret.otpauth_url,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate TOTP setup" });
    }
});

app.post("/api/auth/totp-enable", async (req, res) => {
    try {
        const { setupToken, token } = req.body;
        if (!setupToken || !token) return res.status(400).json({ error: "setupToken and token required" });

        let decoded;
        try {
            decoded = jwt.verify(setupToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ error: "Setup token invalid or expired. Please log in again." });
        }
        if (decoded.purpose !== "totp_setup") return res.status(401).json({ error: "Invalid setup token" });

        const user = await queryOne(
            "SELECT id, name, email, role, totp_secret FROM users WHERE id = @id",
            { id: decoded.id }
        );
        if (!user || !user.totp_secret) return res.status(400).json({ error: "No TOTP secret found. Start setup again." });

        const valid = speakeasy.totp.verify({
            secret:   user.totp_secret,
            encoding: "base32",
            token:    token.trim().replace(/\s/g, ""),
            window:   1,
        });

        if (!valid) return res.status(401).json({ error: "Code is incorrect. Make sure you scanned the QR and your phone clock is synced." });

        await query("UPDATE users SET totp_enabled = 1, last_login = GETDATE() WHERE id = @id", { id: user.id });

        const jwtToken = generateToken(user);
        res.json({
            token: jwtToken,
            user:  { id: user.id, name: user.name, email: user.email, role: user.role },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to enable TOTP" });
    }
});

app.post("/api/users/:id/reset-totp", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await query("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = @id", { id });
        res.json({ message: "TOTP reset. User must set up authenticator on next login." });
    } catch (err) {
        res.status(500).json({ error: "Failed to reset TOTP" });
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

const USER_SELECT = `
    SELECT id, name, email, role, phone_number, totp_enabled, is_active,
           FORMAT(created_at,     'yyyy-MM-ddTHH:mm:ss') AS created_at,
           FORMAT(last_login,     'yyyy-MM-ddTHH:mm:ss') AS last_login,
           FORMAT(deactivated_at, 'yyyy-MM-ddTHH:mm:ss') AS deactivated_at
    FROM users`;

app.get("/api/users", requireAuth, requireRole("it_admin"), async (req, res) => {
    try { res.json(await query(USER_SELECT + " ORDER BY created_at DESC")); }
    catch (err) { res.status(500).json({ error: "Failed to load users" }); }
});

app.get("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const user = await queryOne(USER_SELECT + " WHERE id = @id", { id: parseInt(req.params.id) });
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (err) { res.status(500).json({ error: "Failed to get user" }); }
});

app.post("/api/users", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const { name, email, role, password, phone_number } = req.body;
        if (!name || !email || !role || !password)
            return res.status(400).json({ error: "name, email, role and password are required" });

        const validRoles = ["maintenance_engineer", "energy_manager", "it_admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email format" });

        const exists = await queryOne("SELECT id FROM users WHERE email = @email", { email });
        if (exists) return res.status(409).json({ error: "Email already in use" });

        const hashed = bcrypt.hashSync(password, 10);
        await query(
            "INSERT INTO users (name, email, password, role, phone_number, last_login, is_active) VALUES (@name, @email, @hash, @role, @phone, GETDATE(), 1)",
            { name, email, hash: hashed, role, phone: phone_number || null }
        );
        const created = await queryOne(USER_SELECT + " WHERE email = @email", { email });
        res.status(201).json(created);
    } catch (err) { res.status(500).json({ error: "Failed to create user" }); }
});

app.put("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, email, role, password, phone_number } = req.body;
        if (!name || !email || !role) return res.status(400).json({ error: "name, email and role are required" });

        const validRoles = ["maintenance_engineer", "energy_manager", "it_admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

        const existing = await queryOne("SELECT id FROM users WHERE id = @id", { id });
        if (!existing) return res.status(404).json({ error: "User not found" });

        const dupe = await queryOne("SELECT id FROM users WHERE email = @email AND id <> @id", { email, id });
        if (dupe) return res.status(409).json({ error: "Email already in use" });

        if (password) {
            await query(
                "UPDATE users SET name=@name, email=@email, role=@role, password=@hash, phone_number=@phone WHERE id=@id",
                { name, email, role, hash: bcrypt.hashSync(password, 10), phone: phone_number || null, id }
            );
        } else {
            await query(
                "UPDATE users SET name=@name, email=@email, role=@role, phone_number=@phone WHERE id=@id",
                { name, email, role, phone: phone_number || null, id }
            );
        }

        const updated = await queryOne(USER_SELECT + " WHERE id = @id", { id });
        res.json(updated);
    } catch (err) { res.status(500).json({ error: "Failed to update user" }); }
});

app.patch("/api/users/:id/toggle-active", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (req.user.id === id) return res.status(400).json({ error: "Cannot change your own active status" });

        const target = await queryOne("SELECT id, role, is_active, name, email, phone_number FROM users WHERE id = @id", { id });
        if (!target) return res.status(404).json({ error: "User not found" });
        if (target.role === "it_admin") return res.status(400).json({ error: "Cannot change active status of an IT Admin" });

        const newState = target.is_active ? 0 : 1;
        if (newState === 0) {
            await query("UPDATE users SET is_active = 0, deactivated_at = GETDATE() WHERE id = @id", { id });
            sendDeactivationWarning(target.email, target.name, 24).catch(() => {});
            if (target.phone_number) sendDeactivationSmS(target.phone_number, target.name, 24).catch(() => {});
        } else {
            await query("UPDATE users SET is_active = 1, deactivated_at = NULL WHERE id = @id", { id });
        }
        res.json({ id, is_active: newState });
    } catch (err) { res.status(500).json({ error: "Failed to toggle user status" }); }
});

app.delete("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (req.user.id === id) return res.status(400).json({ error: "Cannot delete your own account" });

        const target = await queryOne("SELECT id, role, name, email, phone_number FROM users WHERE id = @id", { id });
        if (!target) return res.status(404).json({ error: "User not found" });
        if (target.role === "it_admin") return res.status(400).json({ error: "Cannot delete an IT Admin account" });

        await query("DELETE FROM users WHERE id = @id", { id });
        sendAccountDeletedEmail(target.email, target.name).catch(() => {});
        if (target.phone_number) sendAccountDeletedSms(target.phone_number, target.name).catch(() => {});
        res.json({ message: "User deleted", id });
    } catch (err) { res.status(500).json({ error: "Failed to delete user" }); }
});

app.get("/api/users/inactive-check", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const rows = await query(`
            SELECT id, name, email, role, phone_number, is_active,
                   FORMAT(last_login, 'yyyy-MM-ddTHH:mm:ss') AS last_login
            FROM users
            WHERE (last_login IS NULL OR last_login < DATEADD(MONTH, -6, GETDATE()))
              AND is_active = 1
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: "Failed to check inactive users" }); }
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
    } catch (err) { res.status(500).json({ error: "Failed to mark inactive users" }); }
});

cron.schedule("0 * * * *", async () => {
    try {
        const toDelete = await query(`
            SELECT id, name, email, phone_number FROM users
            WHERE is_active = 0 AND deactivated_at IS NOT NULL
              AND deactivated_at <= DATEADD(HOUR, -24, GETDATE())
              AND role <> 'it_admin'
        `);
        for (const u of toDelete) {
            await query("DELETE FROM users WHERE id = @id", { id: u.id });
            sendAccountDeletedEmail(u.email, u.name).catch(() => {});
            if (u.phone_number) sendAccountDeletedSms(u.phone_number, u.name).catch(() => {});
            console.log("Auto-deleted inactive user:", u.email);
        }
        const soonToDelete = await query(`
            SELECT id, name, email, phone_number FROM users
            WHERE is_active = 0 AND deactivated_at IS NOT NULL
              AND deactivated_at <= DATEADD(HOUR, -23, GETDATE())
              AND deactivated_at >  DATEADD(HOUR, -24, GETDATE())
              AND role <> 'it_admin'
        `);
        for (const u of soonToDelete) {
            sendDeactivationWarning(u.email, u.name, 1).catch(() => {});
            if (u.phone_number) sendDeactivationSmS(u.phone_number, u.name, 1).catch(() => {});
        }
    } catch (err) { console.error("Cron auto-delete error:", err.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const { startMqttListener } = require("../Assets/mqtt");
startMqttListener();
