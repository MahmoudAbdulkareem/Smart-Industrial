const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const { getEnergyData } = require("../Assets/mockData");
const { findByEmail } = require("../Assets/users");
const { generateToken, requireAuth, requireRole } = require("../MiddleWare/auth");
const { getLatestReadings, getAlerts, acknowledgeAlert, saveWorkOrder } = require("../Assets/assetData");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());



// ─────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────


app.get("/api/status", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

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
    res.status(500).json({ error: "Server error during login" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/assets/health", requireAuth, async (req, res) => {
  try {
    let data = await getLatestReadings();

    if (data.length === 0) {
      const { recordAndGetReadings } = require("../Assets/assetData");
      data = await recordAndGetReadings();
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to get asset health" });
  }
});

app.get("/api/energy", requireAuth, (req, res) => {
  res.json(getEnergyData());
});

app.get("/api/alerts", requireAuth, async (req, res) => {
  try {
    res.json(await getAlerts());
  } catch (err) {
    res.status(500).json({ error: "Failed to get alerts" });
  }
});

app.patch(
  "/api/alerts/:id/acknowledge",
  requireAuth,
  requireRole("maintenance_engineer"),
  async (req, res) => {
    try {
      await acknowledgeAlert(parseInt(req.params.id));
      res.json({ message: "Alert acknowledged" });
    } catch (err) {
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  }
);

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
        wonum: "WO-" + Date.now(),
        assetId,
        description,
        status: "WAPPR",
        createdBy: req.user.name,
      };

      await saveWorkOrder(wo);
      res.status(201).json(wo);
    } catch (err) {
      res.status(500).json({ error: "Failed to create work order" });
    }
  }
);

app.get("/api/workorders", requireAuth, async (req, res) => {
  try {
    const { query } = require("../DataBase/db");
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

app.post(
  "/api/thresholds",
  requireAuth,
  requireRole("energy_manager"),
  (req, res) => {
    const { assetId, metric, value } = req.body;
    res.json({ message: "Threshold updated", assetId, metric, value });
  }
);

app.listen(PORT);