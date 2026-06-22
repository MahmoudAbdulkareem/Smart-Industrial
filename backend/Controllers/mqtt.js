const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const mqttLib = require("mqtt");
const { query } = require("../DataBase/db");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const TOPIC = "sensor_readings/#";

const ML_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000/predict";

const pendingReadings = {};

function getStatus(score) {
    if (score >= 70) return "healthy";
    if (score >= 40) return "caution";
    return "critical";
}

function getIo() {
    if (global.io) return global.io;
    try {
        const { io } = require("../Controllers/mqtt");
        return io;
    } catch (err) {
        return null;
    }
}

async function callMLService(assetId, sensors) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(ML_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                asset_id: assetId,
                vibration: sensors.vibration,
                temperature: sensors.temperature,
                pressure: sensors.pressure
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`ML service returned ${res.status}`);
        const data = await res.json();
        return {
            healthScore: typeof data.health_score === "number" ? data.health_score : 50,
            anomalyDetected: Boolean(data.anomaly_detected),
            rul: typeof data.rul === "number" ? data.rul : 0,
            status: data.status || "caution",
            source: "ml",
        };
    } catch (err) {

        const vibScore = Math.max(0, 100 - (sensors.vibration * 12));
        const tempScore = Math.max(0, 100 - ((sensors.temperature - 35) * 1.2));
        const presScore = sensors.pressure >= 1.2 && sensors.pressure <= 4.5 ? 100 : 60;
        const score = parseFloat(((vibScore + tempScore + presScore) / 3).toFixed(1));
        return {
            healthScore: score,
            anomalyDetected: score < 40,
            rul: parseFloat((score * 0.9 + Math.random() * 10).toFixed(1)),
            status: getStatus(score),
            source: "fallback",
        };
    }
}

async function saveReading(assetId, sensors) {
    if (!assetId || !sensors ||
        typeof sensors.vibration !== "number" ||
        typeof sensors.temperature !== "number" ||
        typeof sensors.pressure !== "number") {
        return;
    }

    const ml = await callMLService(assetId, sensors);

    try {
        await query(
            `INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status)
             VALUES (@asset_id, @vibration, @temperature, @pressure, @health_score, @rul, @mtbf, @status)`,
            {
                asset_id: assetId,
                vibration: sensors.vibration,
                temperature: sensors.temperature,
                pressure: sensors.pressure,
                health_score: ml.healthScore,
                rul: ml.rul,
                mtbf: parseFloat((200 + Math.random() * 100).toFixed(1)),
                status: ml.status,
            }
        );

        const io = getIo();
        if (io) {

            const sensorData = {
                assetId,
                healthScore: ml.healthScore,
                rul: ml.rul,
                status: ml.status,
                anomalyDetected: ml.anomalyDetected,
                sensors: {
                    vibration: sensors.vibration,
                    temperature: sensors.temperature,
                    pressure: sensors.pressure,
                },

                timestamp: new Date().toISOString(),
            };
            
            io.emit("sensor:reading", sensorData);
            
            io.emit("health:update", { assetId, ...sensorData });
            
            console.log(`[MQTT]  Updated ${assetId}: score=${ml.healthScore} (${ml.status})`);
        }

        if (ml.status === "critical" || ml.anomalyDetected) {
            const existingAlert = await query(
                `SELECT id FROM alerts WHERE asset_id = @asset_id AND acknowledged = 0
                 AND created_at > DATEADD(minute, -30, GETDATE())`,
                { asset_id: assetId }
            );

            if (!existingAlert || existingAlert.length === 0) {
                const severity = ml.anomalyDetected ? "critical" : "caution"; 
                const message = ml.anomalyDetected
                    ? `Anomaly detected — Health Score: ${ml.healthScore} | RUL: ${ml.rul} days`
                    : `Health score critical (${ml.healthScore}) — maintenance required`;

                await query(
                    "INSERT INTO alerts (asset_id, severity, message) VALUES (@asset_id, @severity, @message)",
                    { asset_id: assetId, severity, message }
                );

                if (io) {
                    io.emit("alert:new", { assetId, severity, message, timestamp: new Date().toISOString() });
                }
            }
        }
    } catch (err) {
        console.error(`[MQTT] Failed to save reading for ${assetId}:`, err.message);
    }
}

function startMqttListener() {
    console.log(`[MQTT] Connecting to broker at ${BROKER_URL}...`);
    const client = mqttLib.connect(BROKER_URL, {
        reconnectPeriod: 5000,
        connectTimeout: 30000
    });

    client.on("connect", () => {
        console.log("[MQTT] Connected to broker");
        client.subscribe(TOPIC, (err) => {
            if (err) console.error("[MQTT] Subscribe error:", err.message);
            else console.log("[MQTT] Subscribed to", TOPIC);
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
            if (r.vibration !== undefined && r.temperature !== undefined && r.pressure !== undefined) {
                await saveReading(assetId, { ...r });
                delete pendingReadings[assetId];
            }
        } catch (err) {
            console.error(`[MQTT] Error:`, err.message);
        }
    });

    client.on("error", (err) => console.error("[MQTT] Error:", err.message));
    return client;
}

module.exports = { startMqttListener };