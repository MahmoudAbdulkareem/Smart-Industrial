
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { query } = require("../DataBase/db");

const ML_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000/predict";

const assets = [
  { id: "AST-001", name: "Compressor Unit A", baseVib: 1.2, baseTemp: 45, basePres: 2.5 },
  { id: "AST-002", name: "Pump Station B",    baseVib: 3.1, baseTemp: 62, basePres: 3.0 },
  { id: "AST-003", name: "Conveyor Belt C",   baseVib: 7.8, baseTemp: 78, basePres: 2.5 },
  { id: "AST-004", name: "HVAC Unit D",       baseVib: 1.5, baseTemp: 48, basePres: 2.8 },
  { id: "AST-005", name: "Motor Drive E",     baseVib: 4.2, baseTemp: 71, basePres: 2.5 },
];

function rand(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function vary(base, range) {
  return parseFloat((base + rand(-range, range)).toFixed(2));
}
function getStatus(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "caution";
  return "critical";
}

async function callML(assetId, vibration, temperature, pressure) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(ML_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId, vibration, temperature, pressure }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`ML returned ${res.status}`);
    const d = await res.json();
    return {
      health_score:     typeof d.health_score === "number" ? d.health_score : 50,
      rul:              typeof d.rul          === "number" ? d.rul          : 0,
      status:           d.status || "caution",
      anomaly_detected: Boolean(d.anomaly_detected),
      source:           "ml",
    };
  } catch {
    const vibScore  = Math.max(0, 100 - vibration * 12);
    const tempScore = Math.max(0, 100 - (temperature - 35) * 1.2);
    const presScore = pressure >= 1.2 && pressure <= 4.5 ? 100 : 60;
    const health_score = parseFloat(((vibScore + tempScore + presScore) / 3).toFixed(1));
    return {
      health_score,
      rul:              parseFloat((health_score * 3.65).toFixed(1)),
      status:           getStatus(health_score),
      anomaly_detected: health_score < 30,
      source:           "fallback",
    };
  }
}

async function checkAndCreateAutoWorkOrder(assetId, ml) {
  if (ml.status !== "critical" && !ml.anomaly_detected) return;
  try {
    const recent = await query(
      `SELECT TOP 1 id FROM work_orders
       WHERE asset_id = @asset_id AND created_at > DATEADD(HOUR, -24, GETDATE())`,
      { asset_id: assetId }
    );
    if (recent && recent.length > 0) return;

    const wonum  = "AUTO-" + Date.now();
    const reason = ml.anomaly_detected
      ? `Anomaly detected — Health: ${ml.health_score}/100 | RUL: ${ml.rul} days`
      : `Critical health score: ${ml.health_score}/100 — Maintenance required`;

    await query(
      `INSERT INTO work_orders (wonum, asset_id, description, priority, status, created_by, created_at)
       VALUES (@wonum, @asset_id, @description, @priority, @status, @created_by, GETDATE())`,
      { wonum, asset_id: assetId, description: reason, priority: "High", status: "WAPPR", created_by: "System (Auto)" }
    );

    if (global.io) global.io.emit("workorder:created", { wonum, assetId, description: reason, status: "WAPPR", createdBy: "System (Auto)" });
    console.log(`[Auto WO] Created ${wonum} for ${assetId}`);
  } catch (err) {
    console.error("[Auto WO] Failed:", err.message);
  }
}

async function generateAndSaveData() {
  console.log(`[Mock Publisher] Publishing at ${new Date().toLocaleTimeString()}`);

  for (const asset of assets) {
    const vibration   = vary(asset.baseVib,  0.5);
    const temperature = vary(asset.baseTemp, 3.0);
    const pressure    = vary(asset.basePres, 0.3);
    const ml          = await callML(asset.id, vibration, temperature, pressure);
    const mtbf        = parseFloat((ml.health_score / 100 * 1000).toFixed(1));

    try {
      await query(
        `INSERT INTO sensor_readings
           (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at)
         VALUES (@asset_id, @vibration, @temperature, @pressure, @health_score, @rul, @mtbf, @status, GETDATE())`,
        { asset_id: asset.id, vibration, temperature, pressure, health_score: ml.health_score, rul: ml.rul, mtbf, status: ml.status }
      );

      if (global.io) {
        global.io.emit("sensor:reading", {
          assetId: asset.id, healthScore: ml.health_score, rul: ml.rul, status: ml.status,
          anomalyDetected: ml.anomaly_detected, sensors: { vibration, temperature, pressure },
          timestamp: new Date().toISOString(), source: ml.source,
        });
      }

      await checkAndCreateAutoWorkOrder(asset.id, ml);

      if (ml.status === "critical" || ml.anomaly_detected) {
        const existing = await query(
          `SELECT id FROM alerts WHERE asset_id = @asset_id AND acknowledged = 0 AND created_at > DATEADD(MINUTE, -30, GETDATE())`,
          { asset_id: asset.id }
        );
        if (!existing || existing.length === 0) {
          const severity = ml.anomaly_detected ? "critical" : "caution";
          const message  = ml.anomaly_detected
            ? `Anomaly detected — Health: ${ml.health_score}/100 | RUL: ${ml.rul} days`
            : `Health score critical (${ml.health_score}/100) — maintenance required`;
          await query("INSERT INTO alerts (asset_id, severity, message) VALUES (@asset_id, @severity, @message)", { asset_id: asset.id, severity, message });
          if (global.io) global.io.emit("alert:new", { assetId: asset.id, severity, message, timestamp: new Date().toISOString() });
        }
      }

      console.log(`  ${asset.id}: vib=${vibration} temp=${temperature} → score=${ml.health_score} rul=${ml.rul}d [${ml.source}]`);
    } catch (err) {
      console.error(`  Error saving ${asset.id}:`, err.message);
    }
  }
  console.log("");
}

console.log("[Mock Publisher] Started — ML-powered + auto work orders + auto alerts\n");
setInterval(generateAndSaveData, 7500);
generateAndSaveData();
