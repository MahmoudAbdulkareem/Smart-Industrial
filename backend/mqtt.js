// mqtt.js — MQTT listener
// Subscribes to all sensor topics and saves readings to SQL Server
// This replaces the approach of generating readings when API is called
// Corresponds to steps 1 and 2 of the sequence diagram:
//   Step 1: MQTT publish sensor_readings/{asset_id}/{type}
//   Step 2: INSERT sensor_reading (asset_id, value, timestamp)

const mqttLib = require("mqtt");
const { query } = require("./db");

const BROKER_URL = "mqtt://localhost:1883";
const TOPIC      = "sensor_readings/#"; // subscribe to all asset/type topics

// Holds the latest reading per asset until all 3 sensor types arrive
// then inserts one complete row to SQL Server
const pendingReadings = {};

function getStatus(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "caution";
  return "critical";
}

function computeHealthScore(vibration, temperature, pressure) {
  // Simple formula — in Sprint S4 this is replaced by Python ML
  // Higher vibration and temperature = lower health score
  const vibScore  = Math.max(0, 100 - (vibration   * 12));
  const tempScore = Math.max(0, 100 - ((temperature - 35) * 1.2));
  const presScore = pressure >= 1.2 && pressure <= 4.5 ? 100 : 60;
  return parseFloat(((vibScore + tempScore + presScore) / 3).toFixed(1));
}

async function saveReading(assetId, sensors) {
  const score  = computeHealthScore(
    sensors.vibration,
    sensors.temperature,
    sensors.pressure
  );
  const rul    = parseFloat((score * 0.9 + Math.random() * 10).toFixed(1));
  const mtbf   = parseFloat((200 + Math.random() * 100).toFixed(1));
  const status = getStatus(score);

  try {
    await query(
      `INSERT INTO sensor_readings
         (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status)
       VALUES
         (@asset_id, @vibration, @temperature, @pressure,
          @health_score, @rul, @mtbf, @status)`,
      {
        asset_id:     assetId,
        vibration:    sensors.vibration,
        temperature:  sensors.temperature,
        pressure:     sensors.pressure,
        health_score: score,
        rul,
        mtbf,
        status,
      }
    );
    console.log(`[MQTT] Saved reading for ${assetId} — score: ${score} (${status})`);

    // Auto-create alert if critical and no recent unacknowledged alert exists
    if (status === "critical") {
      const existing = await query(
        `SELECT id FROM alerts
         WHERE asset_id = @asset_id
           AND acknowledged = 0
           AND created_at > DATEADD(minute, -30, GETDATE())`,
        { asset_id: assetId }
      );
      if (existing.length === 0) {
        await query(
          `INSERT INTO alerts (asset_id, severity, message)
           VALUES (@asset_id, 'critical', @message)`,
          {
            asset_id: assetId,
            message:  `Health score critical (${score}) — predictive maintenance required`,
          }
        );
        console.log(`[MQTT] Auto-alert created for ${assetId}`);
      }
    }
  } catch (err) {
    console.error(`[MQTT] Failed to save reading for ${assetId}:`, err.message);
  }
}

function startMqttListener() {
  const client = mqttLib.connect(BROKER_URL);

  client.on("connect", () => {
    console.log("[MQTT] Connected to broker at", BROKER_URL);
    client.subscribe(TOPIC, err => {
      if (err) console.error("[MQTT] Subscribe error:", err.message);
      else     console.log("[MQTT] Subscribed to", TOPIC);
    });
  });

  client.on("message", async (topic, message) => {
    // Topic format: sensor_readings/{asset_id}/{type}
    // e.g. sensor_readings/AST-001/vibration
    const parts = topic.split("/");
    if (parts.length !== 3) return;

    const [, assetId, sensorType] = parts;
    const value = parseFloat(message.toString());

    if (isNaN(value)) return;

    // Accumulate sensor values for this asset
    if (!pendingReadings[assetId]) {
      pendingReadings[assetId] = {};
    }
    pendingReadings[assetId][sensorType] = value;

    // Once we have all 3 sensor types, save to SQL Server
    const r = pendingReadings[assetId];
    if (r.vibration !== undefined &&
        r.temperature !== undefined &&
        r.pressure !== undefined) {
      await saveReading(assetId, { ...r });
      delete pendingReadings[assetId]; // reset for next cycle
    }
  });

  client.on("error", err => {
    console.error("[MQTT] Error:", err.message);
  });

  client.on("close", () => {
    console.log("[MQTT] Connection to broker closed");
  });

  return client;
}

module.exports = { startMqttListener };
