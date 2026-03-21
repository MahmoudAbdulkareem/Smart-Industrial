const express = require("express");
const cors    = require("cors");
const { getAssetHealth, getEnergyData, getAlerts } = require("./mockData");

const app  = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/status", (req, res) => {
  res.json({ ok: true });
});

// Asset health scores + sensor readings
app.get("/api/assets/health", (req, res) => {
  res.json(getAssetHealth());
});

// Energy data
app.get("/api/energy", (req, res) => {
  res.json(getEnergyData());
});

// Alerts
app.get("/api/alerts", (req, res) => {
  res.json(getAlerts());
});

// Create Work Order (simulates Maximo MIF)
app.post("/api/workorders", (req, res) => {
  const { assetId, description } = req.body;
  if (!assetId || !description) {
    return res.status(400).json({ error: "assetId and description required" });
  }
  const wo = {
    wonum:     "WO-" + Date.now(),
    assetId,
    description,
    status:    "WAPPR",
    createdAt: new Date().toISOString(),
  };
  console.log("Work Order created:", wo.wonum);
  res.status(201).json(wo);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log("Endpoints: /api/assets/health  /api/energy  /api/alerts  POST /api/workorders");
});
