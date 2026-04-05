// server.js — Express API server with MQTT listener
// Sprint S1 + S2 complete

const express  = require("express");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");

const { getEnergyData }                           = require("./mockData");
const { findByEmail }                             = require("./users");
const { generateToken, requireAuth, requireRole } = require("./auth");
const { getLatestReadings, getAlerts,
        acknowledgeAlert, saveWorkOrder }          = require("./assetData");
const { startMqttListener }                       = require("./mqtt");

const app  = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Start MQTT listener when server boots
// Connects to Mosquitto broker and subscribes to sensor_readings/#
startMqttListener();

// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────

app.get("/api/status", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    const user = await findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ─────────────────────────────────────────────
// PROTECTED ROUTES
// ─────────────────────────────────────────────

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Asset health — returns latest reading per asset from SQL Server
// Readings are now inserted by the MQTT listener, not generated here
app.get("/api/assets/health", requireAuth, async (req, res) => {
  try {
    const data = await getLatestReadings();

    // If no MQTT readings yet, fall back to generating them
    // so the dashboard never shows empty while waiting for first publish
    if (data.length === 0) {
      const { recordAndGetReadings } = require("./assetData");
      const fallback = await recordAndGetReadings();
      return res.json(fallback);
    }

    res.json(data);
  } catch (err) {
    console.error("Asset health error:", err.message);
    res.status(500).json({ error: "Failed to get asset health" });
  }
});

// Energy data — still mock until real energy meters are connected
app.get("/api/energy", requireAuth, (req, res) => {
  res.json(getEnergyData());
});

// Alerts from SQL Server
app.get("/api/alerts", requireAuth, async (req, res) => {
  try {
    res.json(await getAlerts());
  } catch (err) {
    console.error("Alerts error:", err.message);
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

// Acknowledge alert — maintenance engineer only
app.patch(
  "/api/alerts/:id/acknowledge",
  requireAuth,
  requireRole("maintenance_engineer"),
  async (req, res) => {
    try {
      await acknowledgeAlert(parseInt(req.params.id));
      res.json({ message: "Alert acknowledged" });
    } catch (err) {
      console.error("Acknowledge error:", err.message);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  }
);

// Create Work Order — maintenance engineer only
app.post(
  "/api/workorders",
  requireAuth,
  requireRole("maintenance_engineer"),
  async (req, res) => {
    try {
      const { assetId, description } = req.body;
      if (!assetId || !description) {
        return res.status(400).json({ error: "assetId and description required" });
      }
      const wo = {
        wonum:     "WO-" + Date.now(),
        assetId,
        description,
        status:    "WAPPR",
        createdBy: req.user.name,
        createdAt: new Date().toISOString(),
      };
      await saveWorkOrder(wo);
      console.log(`Work Order ${wo.wonum} created by ${req.user.name}`);
      res.status(201).json(wo);
    } catch (err) {
      console.error("Work order error:", err.message);
      res.status(500).json({ error: "Failed to create work order" });
    }
  }
);

// Work order history
app.get("/api/workorders", requireAuth, async (req, res) => {
  try {
    const { query } = require("./db");
    const rows = await query(`
      SELECT w.id, w.wonum, w.asset_id, a.name AS asset_name,
             w.description, w.status, w.created_by, w.created_at
      FROM work_orders w
      INNER JOIN assets a ON a.id = w.asset_id
      ORDER BY w.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get work orders" });
  }
});

// Configure thresholds — energy manager only
app.post(
  "/api/thresholds",
  requireAuth,
  requireRole("energy_manager"),
  (req, res) => {
    const { assetId, metric, value } = req.body;
    console.log(`Threshold set by ${req.user.name}:`, { assetId, metric, value });
    res.json({ message: "Threshold updated", assetId, metric, value });
  }
);

app.listen(PORT, () => {
  console.log(`\nBackend running on http://localhost:${PORT}`);
  console.log("Test accounts:");
  console.log("  maintenance@dashboard.com / maintenance123");
  console.log("  energy@dashboard.com      / energy123\n");
});
