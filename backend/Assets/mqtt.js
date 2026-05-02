
const fetch   = require("node-fetch");
const mqttLib = require("mqtt");
const { query } = require("../DataBase/db");

const BROKER_URL = "mqtt://localhost:1883";
const TOPIC      = "sensor_readings/#";
const ML_URL     = "http://127.0.0.1:8000/predict";

const pendingReadings = {};

function getStatus(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "caution";
  return "critical";
}

async function callMLService(assetId, sensors) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(ML_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_id:    assetId,
        vibration:   sensors.vibration,
        temperature: sensors.temperature,
        pressure:    sensors.pressure,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`ML service returned ${res.status}`);
    const data = await res.json();
    return {
      healthScore:     typeof data.health_score === 'number' ? data.health_score : 50,
      anomalyDetected: Boolean(data.anomaly_detected),
      rul:             typeof data.rul === 'number' ? data.rul : 0,
      status:          data.status || "caution",
      source:          "ml",
    };
  } catch (err) {
    const errMsg = err.name === 'AbortError' ? 'Request timeout' : err.message;
    console.warn(`[MQTT] ML unavailable, using fallback: ${errMsg}`);
    const vibScore  = Math.max(0, 100 - (sensors.vibration   * 12));
    const tempScore = Math.max(0, 100 - ((sensors.temperature - 35) * 1.2));
    const presScore = sensors.pressure >= 1.2 && sensors.pressure <= 4.5 ? 100 : 60;
    const score     = parseFloat(((vibScore + tempScore + presScore) / 3).toFixed(1));
    return {
      healthScore:     score,
      anomalyDetected: score < 40,
      rul:             parseFloat((score * 0.9 + Math.random() * 10).toFixed(1)),
      status:          getStatus(score),
      source:          "fallback",
    };
  }
}


async function autoCreateWorkOrder(assetId, assetName, ml) {
  try {
    if (!assetId || !ml) {
      console.error("[S5] Invalid parameters for work order creation");
      return;
    }
    const existing = await query(
      `SELECT id FROM work_orders
       WHERE asset_id  = @asset_id
         AND created_by = 'AUTO-SYSTEM'
         AND created_at > DATEADD(hour, -1, GETDATE())`,
      { asset_id: assetId }
    );

    if (existing && existing.length > 0) {
      return;
    }

    const wonum = "WO-AUTO-" + Date.now();
    const description =
      `AUTO-GENERATED — Anomaly detected by ML model. ` +
      `Health Score: ${ml.healthScore} | RUL: ${ml.rul} days | ` +
      `Asset: ${assetName} | Source: Isolation Forest`;

    await query(
      `INSERT INTO work_orders (wonum, asset_id, description, status, created_by)
       VALUES (@wonum, @asset_id, @description, @status, @created_by)`,
      {
        wonum,
        asset_id:    assetId,
        description,
        status:      "WAPPR",      
        created_by:  "AUTO-SYSTEM", 
      }
    );



    console.log(
      `[S5] AUTO Work Order ${wonum} created for ${assetId} ` +
      `(score=${ml.healthScore}, anomaly=${ml.anomalyDetected})`
    );
  } catch (err) {
    console.error(`[S5] Failed to auto-create Work Order for ${assetId}:`, err.message);
  }
}

async function saveReading(assetId, sensors) {
  if (!assetId || !sensors || typeof sensors.vibration !== 'number' || typeof sensors.temperature !== 'number' || typeof sensors.pressure !== 'number') {
    console.error("[MQTT] Invalid sensor data");
    return;
  }
  const ml = await callMLService(assetId, sensors);

  try {
    await query(
      `INSERT INTO sensor_readings
         (asset_id, vibration, temperature, pressure,
          health_score, rul, mtbf, status)
       VALUES
         (@asset_id, @vibration, @temperature, @pressure,
          @health_score, @rul, @mtbf, @status)`,
      {
        asset_id:     assetId,
        vibration:    sensors.vibration,
        temperature:  sensors.temperature,
        pressure:     sensors.pressure,
        health_score: ml.healthScore,
        rul:          ml.rul,
        mtbf:         parseFloat((200 + Math.random() * 100).toFixed(1)),
        status:       ml.status,
      }
    );

    console.log(
      `[MQTT] ${assetId}: score=${ml.healthScore} (${ml.status})` +
      ` anomaly=${ml.anomalyDetected} source=${ml.source}`
    );

    if (ml.status === "critical" || ml.anomalyDetected) {
      const existingAlert = await query(
        `SELECT id FROM alerts
         WHERE asset_id    = @asset_id
           AND acknowledged = 0
           AND created_at  > DATEADD(minute, -30, GETDATE())`,
        { asset_id: assetId }
      );

      if (!existingAlert || existingAlert.length === 0) {
        const severity = ml.anomalyDetected ? "critical" : "caution";
        await query(
          `INSERT INTO alerts (asset_id, severity, message)
           VALUES (@asset_id, @severity, @message)`,
          {
            asset_id: assetId,
            severity,
            message: ml.anomalyDetected
              ? `Anomaly detected by ML — Health Score: ${ml.healthScore} | RUL: ${ml.rul} days`
              : `Health score critical (${ml.healthScore}) — maintenance required`,
          }
        );
        console.log(`[MQTT] Auto-alert (${severity}) created for ${assetId}`);
      }

     
      if (ml.anomalyDetected || ml.status === "critical") {
        let assetNameForWO = assetName;
        if (!assetNameForWO) {
          const assets = await query(
            "SELECT name FROM assets WHERE id = @id",
            { id: assetId }
          );
          assetNameForWO = assets && assets[0]?.name ? assets[0].name : assetId;
        }
        await autoCreateWorkOrder(assetId, assetNameForWO, ml);
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
    try {
      const parts = topic.split("/");
      if (parts.length !== 3) return;

      const [, assetId, sensorType] = parts;
      if (!assetId || !sensorType) return;
      const value = parseFloat(message.toString());
      if (isNaN(value) || !isFinite(value)) return;

    if (!pendingReadings[assetId]) pendingReadings[assetId] = {};
    pendingReadings[assetId][sensorType] = value;

    const r = pendingReadings[assetId];
    if (r.vibration  !== undefined &&
        r.temperature !== undefined &&
        r.pressure    !== undefined) {
      await saveReading(assetId, { ...r });
      delete pendingReadings[assetId];
    }
    } catch (err) {
      console.error(`[MQTT] Error processing message on ${topic}:`, err.message);
    }
  });

  client.on("error", err => {
    console.error("[MQTT] Error:", err.message);
  });

  return client;
}

module.exports = { startMqttListener };
