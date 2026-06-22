// backend/server.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.JWT_SECRET = process.env.JWT_SECRET || "smartdashboard_dev_secret_2026_fallback";
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001";
process.env.MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
process.env.ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000/predict";
process.env.PORT = process.env.PORT || "5000";

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const cron = require("node-cron");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const path = require("path");

const { writeEnergySnapshot, getLatestEnergyData, getEnergyHistory } = require("../Services/energyService");
const { generateExcelReport, generateHtmlReport } = require("../Services/reportService");
const { findByEmail } = require("../Controllers/users");
const { generateToken, requireAuth, requireRole } = require("../MiddleWare/auth");
const { recordAndGetReadings, getLatestReadings, getAlerts, acknowledgeAlert, saveWorkOrder } = require("../Controllers/assetData");
const { query, queryOne } = require("../DataBase/db");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(s => s.trim())
    : ["http://localhost:3000", "http://localhost:3001"];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(null, true);
    },
    credentials: true,
}));
app.use(express.json());

// ── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: "Too many requests from this IP, please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
});
app.use("/api/auth", authLimiter);

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
    transports: ["websocket", "polling"],
});

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        next(new Error("Invalid token"));
    }
});

io.on("connection", socket => {
    console.log(`[WS] ${socket.user?.email || 'Unknown'} connected (${socket.id})`);
    socket.on("disconnect", () => console.log(`[WS] ${socket.user?.email || 'Unknown'} disconnected`));
});

global.io = io;

// ── Email Notification Service ──────────────────────────────────────────────
let emailTransporter = null;

function getEmailTransporter() {
    if (!emailTransporter) {
        const isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
        if (!isConfigured) {
            console.warn('[Email] SMTP not configured. Set SMTP_USER and SMTP_PASS in .env');
            return null;
        }
        emailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: { rejectUnauthorized: false }
        });
        console.log('[Email] Transporter initialized');
    }
    return emailTransporter;
}

async function sendAlertEmail(alert, assetName) {
    console.log('[Email] sendAlertEmail called for alert:', alert);
    console.log('[Email] Alert ID:', alert.id, 'Type:', typeof alert.id);
    
    // Make sure alert.id is a number
    const alertId = parseInt(alert.id);
    if (isNaN(alertId)) {
        console.error('[Email] Invalid alert ID - not a number:', alert.id);
        return;
    }
    
    const transporter = getEmailTransporter();
    if (!transporter) {
        console.log('[Email] Transporter not available, would send to:', {
            alertId: alertId,
            severity: alert.severity,
            message: alert.message
        });
        return;
    }

    try {
        // Get recipients - maintenance engineers and admins
        const recipients = await query(`
            SELECT id, name, email FROM users 
            WHERE email IS NOT NULL AND email != '' AND is_active = 1
            AND role IN ('maintenance_engineer', 'it_admin', 'admin', 'energy_manager')
        `);

        console.log(`[Email] Found ${recipients.length} recipients`);

        if (recipients.length === 0) {
            console.log('[Email] No recipients found');
            return;
        }

        const severityColors = {
            critical: { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', label: '🚨 CRITICAL' },
            caution: { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', label: '⚠️ CAUTION' },
            info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', label: 'ℹ️ INFO' }
        };
        const colors = severityColors[alert.severity?.toLowerCase()] || severityColors.info;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1a2332; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
                    .header h2 { margin: 0; color: ${colors.text}; }
                    .details { background: #f8faff; padding: 16px; border-radius: 8px; margin: 16px 0; }
                    .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
                    .detail-row:last-child { border-bottom: none; }
                    .label { color: #6b7a99; font-weight: 600; }
                    .value { color: #1a2332; }
                    .action-box { background: #f0fdf4; padding: 12px; border-radius: 6px; margin: 16px 0; border: 1px solid #bbf7d0; }
                    .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px; font-size: 11px; color: #9aa5b4; text-align: center; }
                    .button { display: inline-block; padding: 10px 20px; background: #1d6fcc; color: white; text-decoration: none; border-radius: 6px; }
                    .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; background: ${colors.bg}; color: ${colors.text}; border: 1px solid ${colors.border}; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>${colors.label}</h2>
                    </div>
                    <h3 style="margin-top: 0;">Alert Notification</h3>
                    <div class="details">
                        <div class="detail-row"><span class="label">📋 Alert ID</span><span class="value">#${alertId}</span></div>
                        <div class="detail-row"><span class="label">🏷️ Asset</span><span class="value"><strong>${assetName || alert.asset_id || 'Unknown'}</strong></span></div>
                        <div class="detail-row"><span class="label">📊 Severity</span><span class="value"><span class="severity-badge">${(alert.severity || 'INFO').toUpperCase()}</span></span></div>
                        <div class="detail-row"><span class="label">📝 Message</span><span class="value">${alert.message}</span></div>
                        <div class="detail-row"><span class="label">⏰ Time</span><span class="value">${new Date(alert.created_at || alert.time).toLocaleString()}</span></div>
                    </div>
                    <div class="action-box">
                        <strong>💡 Recommended Action:</strong>
                        ${alert.severity?.toLowerCase() === 'critical' 
                            ? 'Immediate attention required. Please investigate and take corrective action immediately.'
                            : alert.severity?.toLowerCase() === 'caution'
                            ? 'Please review this alert and take appropriate action if needed.'
                            : 'This is an informational alert for your awareness.'}
                    </div>
                    
                    <div class="footer">
                        <p>This is an automated notification from Smart Industrial Monitor.</p>
                        <p>© ${new Date().getFullYear()} SmartDashboard. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Send to each recipient
        let sentCount = 0;
        let failCount = 0;
        
        for (const user of recipients) {
            try {
                console.log(`[Email] Sending to ${user.email} (${user.name})`);
                
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || 'noreply@smartdashboard.com',
                    to: user.email,
                    subject: `🚨 ${(alert.severity || 'ALERT').toUpperCase()}: ${alert.message.slice(0, 50)}${alert.message.length > 50 ? '...' : ''}`,
                    html: htmlContent
                });
                
                // Log notification - use the integer ID
                await query(`
                    INSERT INTO notification_logs (user_id, alert_id, channel, status, sent_at)
                    VALUES (@userId, @alertId, 'email', 'sent', GETDATE())
                `, { 
                    userId: user.id, 
                    alertId: alertId
                });
                
                console.log(`[Email] ✅ Alert sent to ${user.email}`);
                sentCount++;
            } catch (err) {
                console.error(`[Email] ❌ Failed to send to ${user.email}:`, err.message);
                failCount++;
                try {
                    await query(`
                        INSERT INTO notification_logs (user_id, alert_id, channel, status, error, sent_at)
                        VALUES (@userId, @alertId, 'email', 'failed', @error, GETDATE())
                    `, { 
                        userId: user.id, 
                        alertId: alertId,
                        error: err.message 
                    });
                } catch (logErr) {
                    console.error('[Email] Failed to log notification:', logErr.message);
                }
            }
        }
        
        console.log(`[Email] Summary: ${sentCount} sent, ${failCount} failed`);

    } catch (error) {
        console.error('[Email] Error sending alert:', error);
    }
}

// ── Broadcast Functions ──────────────────────────────────────────────────────
let broadcastCounter = 0;

async function broadcastHealthUpdate() {
    try {
        const healthData = await getLatestReadings();
        if (healthData && healthData.length > 0) {
            healthData.forEach(asset => {
                const sensorData = {
                    assetId: asset.id,
                    healthScore: asset.healthScore,
                    rul: asset.rul,
                    status: asset.status,
                    sensors: asset.sensors || {
                        vibration: asset.vibration || 2.5,
                        temperature: asset.temperature || 60,
                        pressure: asset.pressure || 2.5
                    },
                    timestamp: new Date().toISOString()
                };
                io.emit("sensor:reading", sensorData);
            });
            broadcastCounter++;
            if (broadcastCounter % 5 === 0) {
                console.log(`[Real-time] Health update sent for ${healthData.length} assets`);
            }
        }
    } catch (err) {
        console.error("[Real-time] Health broadcast error:", err.message);
    }
}

async function broadcastEnergyUpdate() {
    try {
        const zones = await getLatestEnergyData();
        
        if (zones && zones.length > 0) {
            const n = zones.length;
            const avg = (key) => parseFloat((zones.reduce((s, z) => s + (z[key] || 0), 0) / n).toFixed(2));
            
            const variation = () => 0.92 + (Math.random() * 0.16);
            
            const energyUpdate = {
                current: Math.round(avg("electricity_kwh") * variation() * 10) / 10,
                baseline: Math.round(avg("electricity_base") * 10) / 10,
                water: { 
                    current: Math.round(avg("water_lpm") * variation() * 10) / 10, 
                    baseline: Math.round(avg("water_base") * 10) / 10
                },
                gas: { 
                    current: Math.round(avg("gas_m3h") * variation() * 10) / 10, 
                    baseline: Math.round(avg("gas_base") * 10) / 10
                },
                kpis: { 
                    pue: Math.round(avg("pue") * variation() * 100) / 100, 
                    eer: Math.round(avg("eer") * variation() * 100) / 100, 
                    co2: Math.round(avg("co2_emissions") * variation() * 10) / 10
                },
                timestamp: new Date().toISOString()
            };
            
            energyUpdate.current = Math.max(250, Math.min(500, energyUpdate.current));
            energyUpdate.kpis.pue = Math.max(1.1, Math.min(1.8, energyUpdate.kpis.pue));
            energyUpdate.kpis.eer = Math.max(3.0, Math.min(4.5, energyUpdate.kpis.eer));
            energyUpdate.kpis.co2 = Math.max(100, Math.min(250, energyUpdate.kpis.co2));
            
            io.emit("energy:update", energyUpdate);
        }
    } catch (err) {
        console.error("[Real-time] Energy broadcast error:", err.message);
    }
}

// ── Scheduled Broadcasts ────────────────────────────────────────────────────
setInterval(() => {
    broadcastHealthUpdate();
    broadcastEnergyUpdate();
}, 7000);

setTimeout(() => {
    broadcastHealthUpdate();
    broadcastEnergyUpdate();
    console.log("[Real-time] Initial broadcasts sent");
}, 2000);

// ── Audit Function ──────────────────────────────────────────────────────────
async function audit(userId, action, details = null) {
    try {
        await query(
            "INSERT INTO audit_logs (user_id, action, details) VALUES (@user_id, @action, @details)",
            { user_id: userId || null, action, details: details ? JSON.stringify(details) : null }
        );
    } catch (err) {
        console.error("[Audit] Failed to log:", err.message);
    }
}

// ── TOTP Stores ─────────────────────────────────────────────────────────────
const pendingTotp = new Map();
const qrStore = new Map();

// ── Routes ──────────────────────────────────────────────────────────────────

// Health check
app.get("/", (req, res) => res.json({ ok: true, status: "Smart Dashboard API" }));
app.get("/api/status", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Auth Routes ──────────────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Email and password required" });

        const user = await findByEmail(email);
        if (!user) return res.status(401).json({ error: "Invalid email or password" });
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
        if (!pending) return res.status(401).json({ error: "No pending login. Please log in again." });
        if (Date.now() > pending.expiresAt) { pendingTotp.delete(email); return res.status(401).json({ error: "Session expired." }); }
        const user = await findByEmail(email);
        if (!user || !user.totp_secret) return res.status(401).json({ error: "TOTP not configured" });
        const valid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: "base32", token: token.trim().replace(/\s/g, ""), window: 1 });
        if (!valid) { await audit(user.id, "TOTP_FAILED", { email }); return res.status(401).json({ error: "Invalid authenticator code." }); }
        pendingTotp.delete(email);
        await query("UPDATE users SET last_login = GETDATE() WHERE id = @id", { id: user.id });
        await audit(user.id, "LOGIN_SUCCESS");
        const jwtToken = generateToken(user);
        res.json({ token: jwtToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { console.error(err); res.status(500).json({ error: "Server error during TOTP verification" }); }
});

app.post("/api/auth/totp-setup", async (req, res) => {
    try {
        const { setupToken } = req.body;
        if (!setupToken) return res.status(400).json({ error: "Setup token required" });
        let decoded;
        try { decoded = jwt.verify(setupToken, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: "Setup token invalid or expired." }); }
        if (decoded.purpose !== "totp_setup") return res.status(401).json({ error: "Invalid setup token" });
        const user = await queryOne("SELECT id, name, email, totp_enabled FROM users WHERE id = @id", { id: decoded.id });
        if (!user) return res.status(404).json({ error: "User not found" });
        const secret = speakeasy.generateSecret({ name: `Smart Dashboard (${user.email})`, issuer: "Smart Dashboard", length: 20 });
        await query("UPDATE users SET totp_secret = @secret, totp_enabled = 0 WHERE id = @id", { secret: secret.base32, id: user.id });
        const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
        res.json({ secret: secret.base32, qrDataUrl, otpauthUrl: secret.otpauth_url });
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to generate TOTP setup" }); }
});

app.post("/api/auth/totp-enable", async (req, res) => {
    try {
        const { setupToken, token } = req.body;
        if (!setupToken || !token) return res.status(400).json({ error: "setupToken and token required" });
        let decoded;
        try { decoded = jwt.verify(setupToken, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: "Setup token invalid or expired." }); }
        if (decoded.purpose !== "totp_setup") return res.status(401).json({ error: "Invalid setup token" });
        const user = await queryOne("SELECT id, name, email, role, totp_secret FROM users WHERE id = @id", { id: decoded.id });
        if (!user || !user.totp_secret) return res.status(400).json({ error: "No TOTP secret found. Start setup again." });
        const valid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: "base32", token: token.trim().replace(/\s/g, ""), window: 1 });
        if (!valid) return res.status(401).json({ error: "Code is incorrect." });
        await query("UPDATE users SET totp_enabled = 1, last_login = GETDATE() WHERE id = @id", { id: user.id });
        await audit(user.id, "TOTP_ENABLED");
        const jwtToken = generateToken(user);
        res.json({ token: jwtToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to enable TOTP" }); }
});

app.post("/api/users/:id/reset-totp", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await query("UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = @id", { id });
        await audit(req.user.id, "TOTP_RESET", { target_user_id: id });
        res.json({ message: "TOTP reset." });
    } catch (err) { res.status(500).json({ error: "Failed to reset TOTP" }); }
});

app.post("/api/auth/qr-generate", (req, res) => {
    const token = "qr_" + Math.random().toString(36).slice(2) + Date.now();
    const expiry = Date.now() + 120000;
    qrStore.set(token, { expiresAt: expiry, approved: false });
    res.json({ token, expiresAt: expiry });
});

app.get("/api/auth/qr-approve", requireAuth, async (req, res) => {
    const { token } = req.query;
    const entry = qrStore.get(token);
    if (!entry || Date.now() > entry.expiresAt) return res.status(400).send("<h2>QR code expired or invalid.</h2>");
    const user = await findByEmail(req.user.email);
    entry.approved = true;
    entry.jwt = generateToken(user);
    entry.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    await audit(user.id, "QR_LOGIN");
    res.send("<h2>Login approved. You can close this tab.</h2>");
});

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

// ── Asset Routes ─────────────────────────────────────────────────────────────
app.get("/api/assets/health", requireAuth, async (req, res) => {
    try {
        let data = await getLatestReadings();
        if (!data || data.length === 0) data = await recordAndGetReadings();
        res.json(data);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to get asset health: " + err.message }); }
});

// ── Energy Routes ────────────────────────────────────────────────────────────
app.get("/api/energy", requireAuth, async (req, res) => {
    try {
        const zones = await getLatestEnergyData();
        const history = await getEnergyHistory();

        const n = zones.length || 1;
        const avg = (key) => parseFloat((zones.reduce((s, z) => s + (z[key] || 0), 0) / n).toFixed(2));

        const current = avg("electricity_kwh");
        const baseline = avg("electricity_base");
        const water = { current: avg("water_lpm"), baseline: avg("water_base") };
        const gas = { current: avg("gas_m3h"), baseline: avg("gas_base") };
        const kpis = { pue: avg("pue"), eer: avg("eer"), co2: avg("co2_emissions") };

        const byHour = {};
        history.forEach(r => {
            const key = r.hour_label;
            if (!byHour[key]) byHour[key] = { hour: key, actual: 0, baseline: 0, count: 0 };
            byHour[key].actual += (r.electricity_kwh || 0);
            byHour[key].baseline += (r.electricity_base || baseline);
            byHour[key].count += 1;
        });
        const histArray = Object.values(byHour)
            .sort((a, b) => a.hour.localeCompare(b.hour))
            .map(h => ({
                hour: h.hour,
                actual: parseFloat((h.actual / h.count).toFixed(2)),
                baseline: parseFloat((h.baseline / h.count).toFixed(2)),
            }));

        res.json({ current, baseline, water, gas, kpis, history: histArray, zones });
    } catch (err) {
        console.error("GET /api/energy error:", err);
        res.status(500).json({ error: "Failed to get energy data" });
    }
});

app.get("/api/energy/history", requireAuth, async (req, res) => {
    try { res.json(await getEnergyHistory()); }
    catch (err) { res.status(500).json({ error: "Failed to get energy history" }); }
});
// ── Alerts Routes ──────────────────────────────────────────────────────────────
// ── Alerts Routes ──────────────────────────────────────────────────────────────

// TEST: Create a test alert with email notification
app.post("/api/alerts/test", requireAuth, async (req, res) => {
    console.log('🔔 [Alerts] Test endpoint called');
    console.log('📝 Request body:', req.body);
    console.log('👤 User:', req.user?.email || 'Unknown');
    
    try {
        const { assetId, severity, message } = req.body;
        
        console.log('📊 Creating test alert with:', { assetId, severity, message });
        
        // Insert the alert into the database
        const result = await query(`
            INSERT INTO alerts (asset_id, severity, message, created_at)
            VALUES (@assetId, @severity, @message, GETDATE())
        `, {
            assetId: assetId || 'TEST-ASSET',
            severity: severity || 'critical',
            message: message || '🧪 This is a test notification from SmartDashboard. Email delivery is working!'
        });
        
        console.log('📊 Insert result:', result);
        
        // Get the auto-generated ID - handle different return formats
        let alertId;
        if (result && result.insertId) {
            alertId = result.insertId;
        } else if (result && result.id) {
            alertId = result.id;
        } else if (result && result.recordset && result.recordset[0] && result.recordset[0].id) {
            alertId = result.recordset[0].id;
        } else {
            // If we can't get the ID, get the most recent alert for this asset
            const latest = await queryOne(`
                SELECT TOP 1 id FROM alerts 
                WHERE asset_id = @assetId 
                ORDER BY created_at DESC
            `, { assetId: assetId || 'TEST-ASSET' });
            
            if (latest) {
                alertId = latest.id;
            } else {
                throw new Error('Could not retrieve created alert ID');
            }
        }
        
        console.log('📊 Alert ID retrieved:', alertId);
        
        // Get the full alert with the integer ID
        const alert = await queryOne(
            `SELECT * FROM alerts WHERE id = @id`,
            { id: alertId }
        );

        if (!alert) {
            throw new Error('Failed to retrieve created alert');
        }

        console.log('✅ Test alert created with ID:', alert.id);

        // Send email notification with the real alert object
        console.log('📧 Attempting to send email...');
        await sendAlertEmail(alert, assetId || 'Test Asset');
        console.log('✅ Email sent successfully');

        // Emit socket event for real-time UI update
        if (global.io) {
            console.log('📡 Emitting socket event...');
            global.io.emit('alert:new', alert);
            console.log('✅ Socket event emitted');
        }

        res.json({
            success: true,
            message: 'Test notification sent successfully! Check your email.',
            data: alert
        });
        
        console.log('✅ Response sent successfully');
    } catch (err) {
        console.error('❌ [Alerts] Test error:', err);
        console.error('❌ Error stack:', err.stack);
        res.status(500).json({ 
            success: false, 
            error: err.message || 'Failed to send test notification'
        });
    }
});

// Get all alerts
app.get("/api/alerts", requireAuth, async (req, res) => {
    try { 
        const alerts = await getAlerts();
        res.json(alerts); 
    } catch (err) { 
        console.error('[Alerts] Fetch error:', err);
        res.status(500).json({ error: "Failed to get alerts" }); 
    }
});

// Acknowledge alert
app.patch("/api/alerts/:id/acknowledge", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const alertId = parseInt(req.params.id);
        if (isNaN(alertId)) {
            return res.status(400).json({ error: "Invalid alert ID" });
        }
        await acknowledgeAlert(alertId);
        await audit(req.user.id, "ALERT_ACKNOWLEDGED", { alert_id: alertId });
        if (global.io) {
            global.io.emit("alert:acknowledged", { alertId, by: req.user.name });
        }
        res.json({ message: "Alert acknowledged" });
    } catch (err) { 
        console.error('[Alerts] Acknowledge error:', err);
        res.status(500).json({ error: "Failed to acknowledge alert" }); 
    }
});

// Get all alerts
app.get("/api/alerts", requireAuth, async (req, res) => {
    try { 
        const alerts = await getAlerts();
        res.json(alerts); 
    } catch (err) { 
        console.error('[Alerts] Fetch error:', err);
        res.status(500).json({ error: "Failed to get alerts" }); 
    }
});

// Acknowledge alert
app.patch("/api/alerts/:id/acknowledge", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const alertId = parseInt(req.params.id);
        if (isNaN(alertId)) {
            return res.status(400).json({ error: "Invalid alert ID" });
        }
        await acknowledgeAlert(alertId);
        await audit(req.user.id, "ALERT_ACKNOWLEDGED", { alert_id: alertId });
        if (global.io) {
            global.io.emit("alert:acknowledged", { alertId, by: req.user.name });
        }
        res.json({ message: "Alert acknowledged" });
    } catch (err) { 
        console.error('[Alerts] Acknowledge error:', err);
        res.status(500).json({ error: "Failed to acknowledge alert" }); 
    }
});

// Get all alerts
app.get("/api/alerts", requireAuth, async (req, res) => {
    try { 
        const alerts = await getAlerts();
        res.json(alerts); 
    } catch (err) { 
        console.error('[Alerts] Fetch error:', err);
        res.status(500).json({ error: "Failed to get alerts" }); 
    }
});

// Acknowledge alert
app.patch("/api/alerts/:id/acknowledge", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const alertId = parseInt(req.params.id);
        await acknowledgeAlert(alertId);
        await audit(req.user.id, "ALERT_ACKNOWLEDGED", { alert_id: alertId });
        if (global.io) {
            global.io.emit("alert:acknowledged", { alertId, by: req.user.name });
        }
        res.json({ message: "Alert acknowledged" });
    } catch (err) { 
        console.error('[Alerts] Acknowledge error:', err);
        res.status(500).json({ error: "Failed to acknowledge alert" }); 
    }
});

// ── Work Order Routes ────────────────────────────────────────────────────────
app.post("/api/workorders", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const { assetId, description } = req.body;
        if (!assetId || !description) return res.status(400).json({ error: "assetId and description required" });
        const wo = { wonum: "WO-" + Date.now(), assetId, description, status: "WAPPR", createdBy: req.user.name };
        await saveWorkOrder(wo);
        await audit(req.user.id, "WORKORDER_CREATED", { wonum: wo.wonum, assetId });
        io.emit("workorder:created", wo);
        res.status(201).json(wo);
    } catch (err) { res.status(500).json({ error: "Failed to create work order" }); }
});

app.get("/api/workorders", requireAuth, async (req, res) => {
    try {
        const rows = await query(`
            SELECT w.id, w.wonum, w.asset_id, a.name AS asset_name,
                   w.description, w.priority, w.status, w.created_by, w.created_at
            FROM work_orders w INNER JOIN assets a ON a.id = w.asset_id
            ORDER BY w.created_at DESC
        `);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: "Failed to get work orders" }); }
});

app.patch("/api/workorders/:id/status", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { status } = req.body;
        const valid = ["WAPPR","APPR","INPRG","WMATL","COMP","CAN"];
        if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });
        const wo = await queryOne("SELECT id, wonum, asset_id FROM work_orders WHERE id = @id", { id });
        if (!wo) return res.status(404).json({ error: "Work order not found" });
        await query("UPDATE work_orders SET status = @status WHERE id = @id", { status, id });
        await audit(req.user.id, "WORKORDER_STATUS_UPDATED", { wonum: wo.wonum, status });
        io.emit("workorder:updated", { id, wonum: wo.wonum, status });
        res.json({ id, wonum: wo.wonum, status });
    } catch (err) { res.status(500).json({ error: "Failed to update work order status" }); }
});

// ── Threshold Routes ────────────────────────────────────────────────────────
app.post("/api/thresholds", requireAuth, requireRole("energy_manager"), async (req, res) => {
    try {
        const { assetId, metric, value } = req.body;
        if (!assetId || !metric || value === undefined)
            return res.status(400).json({ error: "assetId, metric and value required" });
        const existing = await queryOne("SELECT id FROM thresholds WHERE asset_id = @assetId AND metric = @metric", { assetId, metric });
        if (existing) {
            await query("UPDATE thresholds SET value = @value, updated_at = GETDATE() WHERE asset_id = @assetId AND metric = @metric", { value, assetId, metric });
        } else {
            await query("INSERT INTO thresholds (asset_id, metric, value) VALUES (@assetId, @metric, @value)", { assetId, metric, value });
        }
        await audit(req.user.id, "THRESHOLD_SET", { assetId, metric, value });
        res.json({ message: "Threshold saved", assetId, metric, value });
    } catch (err) { res.status(500).json({ error: "Failed to save threshold" }); }
});

app.get("/api/thresholds", requireAuth, async (req, res) => {
    try { res.json(await query("SELECT asset_id, metric, value, updated_at FROM thresholds ORDER BY asset_id, metric")); }
    catch (err) { res.status(500).json({ error: "Failed to get thresholds" }); }
});

// ── Audit Log Routes ────────────────────────────────────────────────────────
app.get("/api/audit-logs", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 100), 500);
        const offset = parseInt(req.query.offset || 0);
        const userId = req.query.userId ? parseInt(req.query.userId) : null;
        let sql = `
            SELECT al.id, al.user_id, u.name AS user_name, u.email AS user_email,
                   al.action, al.details,
                   FORMAT(al.created_at, 'yyyy-MM-ddTHH:mm:ss') AS created_at
            FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
        `;
        const params = {};
        if (userId) { sql += " WHERE al.user_id = @userId"; params.userId = userId; }
        sql += ` ORDER BY al.created_at DESC OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
        res.json(await query(sql, params));
    } catch (err) { res.status(500).json({ error: "Failed to get audit logs" }); }
});

// ── User Management Routes ──────────────────────────────────────────────────
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
        if (!name || !email || !role || !password) return res.status(400).json({ error: "name, email, role and password required" });
        const validRoles = ["maintenance_engineer", "energy_manager", "it_admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Invalid email format" });
        const exists = await queryOne("SELECT id FROM users WHERE email = @email", { email });
        if (exists) return res.status(409).json({ error: "Email already in use" });
        const hashed = bcrypt.hashSync(password, 10);
        await query("INSERT INTO users (name, email, password, role, phone_number, last_login, is_active) VALUES (@name, @email, @hash, @role, @phone, GETDATE(), 1)",
            { name, email, hash: hashed, role, phone: phone_number || null });
        const created = await queryOne(USER_SELECT + " WHERE email = @email", { email });
        await audit(req.user.id, "USER_CREATED", { target_email: email, role });
        res.status(201).json(created);
    } catch (err) { res.status(500).json({ error: "Failed to create user" }); }
});

app.put("/api/users/:id", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, email, role, password, phone_number } = req.body;
        if (!name || !email || !role) return res.status(400).json({ error: "name, email and role required" });
        const validRoles = ["maintenance_engineer", "energy_manager", "it_admin"];
        if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });
        const existing = await queryOne("SELECT id FROM users WHERE id = @id", { id });
        if (!existing) return res.status(404).json({ error: "User not found" });
        const dupe = await queryOne("SELECT id FROM users WHERE email = @email AND id <> @id", { email, id });
        if (dupe) return res.status(409).json({ error: "Email already in use" });
        if (password) {
            await query("UPDATE users SET name=@name, email=@email, role=@role, password=@hash, phone_number=@phone WHERE id=@id",
                { name, email, role, hash: bcrypt.hashSync(password, 10), phone: phone_number || null, id });
        } else {
            await query("UPDATE users SET name=@name, email=@email, role=@role, phone_number=@phone WHERE id=@id",
                { name, email, role, phone: phone_number || null, id });
        }
        await audit(req.user.id, "USER_UPDATED", { target_user_id: id });
        res.json(await queryOne(USER_SELECT + " WHERE id = @id", { id }));
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
        } else {
            await query("UPDATE users SET is_active = 1, deactivated_at = NULL WHERE id = @id", { id });
        }
        await audit(req.user.id, newState === 0 ? "USER_DEACTIVATED" : "USER_REACTIVATED", { target_user_id: id });
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
        await audit(req.user.id, "USER_DELETED", { target_email: target.email });
        res.json({ message: "User deleted", id });
    } catch (err) { res.status(500).json({ error: "Failed to delete user" }); }
});

app.get("/api/users/inactive-check", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        res.json(await query(`
            SELECT id, name, email, role, phone_number, is_active,
                   FORMAT(last_login, 'yyyy-MM-ddTHH:mm:ss') AS last_login
            FROM users
            WHERE (last_login IS NULL OR last_login < DATEADD(MONTH, -6, GETDATE())) AND is_active = 1
        `));
    } catch (err) { res.status(500).json({ error: "Failed to check inactive users" }); }
});

app.post("/api/users/mark-inactive", requireAuth, requireRole("it_admin"), async (req, res) => {
    try {
        await query(`UPDATE users SET is_active = 0, deactivated_at = GETDATE()
            WHERE (last_login IS NULL OR last_login < DATEADD(MONTH, -6, GETDATE()))
              AND is_active = 1 AND role <> 'it_admin'`);
        await audit(req.user.id, "BULK_MARK_INACTIVE");
        res.json({ message: "Inactive users marked successfully" });
    } catch (err) { res.status(500).json({ error: "Failed to mark inactive users" }); }
});

// ── Energy Report Export ────────────────────────────────────────────────────
app.get("/api/reports/energy", requireAuth, async (req, res) => {
    try {
        const fmt = (req.query.format || "html").toLowerCase();
        if (fmt === "excel" || fmt === "xlsx" || fmt === "xls") {
            const xml = await generateExcelReport();
            const date = new Date().toISOString().slice(0, 10);
            res.setHeader("Content-Type", "application/vnd.ms-excel");
            res.setHeader("Content-Disposition", `attachment; filename="energy-report-${date}.xls"`);
            return res.send(xml);
        }
        const html = await generateHtmlReport();
        const date = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="energy-report-${date}.html"`);
        return res.send(html);
    } catch (err) {
        console.error("Report error:", err.message);
        res.status(500).json({ error: "Failed to generate report" });
    }
});

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    console.log('404 - Not Found:', req.method, req.url);
    res.status(404).json({ error: "Not Found" });
});

// ── Cron Jobs ───────────────────────────────────────────────────────────────
cron.schedule("0 * * * *", async () => {
    try { await writeEnergySnapshot(); }
    catch (err) { console.error("[Cron] Energy snapshot failed:", err.message); }
});

cron.schedule("30 2 * * *", async () => {
    try {
        await query("EXEC usp_PurgeSensorReadings @DaysToKeep = 30");
        console.log("[Cron] sensor_readings purge complete");
    } catch (err) { console.error("[Cron] Purge failed:", err.message); }
});

cron.schedule("0 * * * *", async () => {
    try {
        const toDelete = await query(`
            SELECT id, name, email, phone_number FROM users
            WHERE is_active = 0 AND deactivated_at IS NOT NULL
              AND deactivated_at <= DATEADD(HOUR, -24, GETDATE()) AND role <> 'it_admin'`);
        for (const u of toDelete) {
            await query("DELETE FROM users WHERE id = @id", { id: u.id });
            await audit(null, "USER_AUTO_DELETED", { email: u.email });
        }
    } catch (err) { console.error("Cron error:", err.message); }
});

// ── Rule Engine ─────────────────────────────────────────────────────────────
cron.schedule("*/5 * * * *", async () => {
    try {
        const criticalAssets = await query(`
            SELECT a.id, a.name, s.health_score, s.rul, s.status
            FROM assets a
            CROSS APPLY (
                SELECT TOP 1 * FROM sensor_readings WHERE asset_id = a.id ORDER BY recorded_at DESC
            ) s
            WHERE s.status = 'critical'
        `);
        for (const asset of (criticalAssets || [])) {
            const recent = await query(
                `SELECT TOP 1 id FROM work_orders
                 WHERE asset_id = @asset_id AND created_at > DATEADD(HOUR, -24, GETDATE())`,
                { asset_id: asset.id }
            );
            if (recent && recent.length > 0) continue;
            const wonum = "AUTO-" + Date.now();
            const desc = `[Rule Engine] Critical health (${asset.health_score}/100) — RUL: ${asset.rul} days`;
            await query(
                `INSERT INTO work_orders (wonum, asset_id, description, priority, status, created_by, created_at)
                 VALUES (@wonum, @asset_id, @description, @priority, @status, @created_by, GETDATE())`,
                { wonum, asset_id: asset.id, description: desc, priority: "High", status: "WAPPR", created_by: "Rule Engine" }
            );

            const alert = {
                id: 'AUTO-' + Date.now(),
                asset_id: asset.id,
                severity: 'critical',
                message: `Critical health score (${asset.health_score}/100) detected - RUL: ${asset.rul} days`,
                created_at: new Date()
            };

            await sendAlertEmail(alert, asset.name || asset.id);

            io.emit("workorder:created", { wonum, assetId: asset.id, description: desc, status: "WAPPR", createdBy: "Rule Engine" });
            io.emit("alert:new", alert);
            console.log(`[Rule Engine] Auto WO ${wonum} created for ${asset.id}`);
        }
    } catch (err) { console.error("[Rule Engine] Error:", err.message); }
});

// ── Start Server ────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 Real-time updates every 7 seconds`);
    console.log(`🔌 Socket.IO ready for connections`);
    console.log(`📧 Email notifications ${process.env.SMTP_USER ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

// ── MQTT Listener ───────────────────────────────────────────────────────────
const { startMqttListener } = require("../Controllers/mqtt");
startMqttListener();