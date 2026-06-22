require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mqtt  = require("mqtt");
const { query } = require("../DataBase/db");

const BROKER_URL  = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const INTERVAL_MS = 10000;

const DRIFT = {
    "AST-001": { vibDrift: 0.002,  tempDrift: 0.02,  presNoise: 0.05 },  
    "AST-002": { vibDrift: 0.015,  tempDrift: 0.05,  presNoise: 0.10 },  
    "AST-003": { vibDrift: 0.045,  tempDrift: 0.15,  presNoise: 0.12 },  
    "AST-004": { vibDrift: 0.001,  tempDrift: 0.01,  presNoise: 0.04 },  
    "AST-005": { vibDrift: 0.020,  tempDrift: 0.08,  presNoise: 0.09 },  
};

const state = {};

function noise(range) {
    return (Math.random() * 2 - 1) * range;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, parseFloat(val.toFixed(2))));
}

async function loadLatestFromDB() {
    const rows = await query(`
        SELECT s.asset_id, s.vibration, s.temperature, s.pressure
        FROM sensor_readings s
        INNER JOIN (
            SELECT asset_id, MAX(recorded_at) AS latest
            FROM sensor_readings
            GROUP BY asset_id
        ) latest ON s.asset_id = latest.asset_id AND s.recorded_at = latest.latest
    `);

    for (const row of rows) {
        state[row.asset_id] = {
            vibration:   row.vibration,
            temperature: row.temperature,
            pressure:    row.pressure,
        };
        console.log(`[DBPublisher] Loaded ${row.asset_id}: vib=${row.vibration} temp=${row.temperature} pres=${row.pressure}`);
    }

    console.log(`[DBPublisher] Loaded ${rows.length} assets cleanly from database state.\n`);
}

function nextReading(assetId) {
    const s = state[assetId];
    const d = DRIFT[assetId] || { vibDrift: 0.005, tempDrift: 0.02, presNoise: 0.08 };

    const vibration   = clamp(s.vibration   + d.vibDrift  + noise(d.vibDrift  * 1.5), 0.05, 25.0);
    const temperature = clamp(s.temperature + d.tempDrift + noise(d.tempDrift * 2.0), 15.0, 125.0);
    const pressure    = clamp(s.pressure    + noise(d.presNoise),                             0.20, 8.0);

    state[assetId] = { vibration, temperature, pressure };

    return { vibration, temperature, pressure };
}

async function publish(client) {
    console.log(`[DBPublisher] Syncing Broker Stream — ${new Date().toLocaleTimeString()}`);

    for (const assetId of Object.keys(state)) {
        const r = nextReading(assetId);

        client.publish(`sensor_readings/${assetId}/vibration`,   r.vibration.toFixed(2));
        client.publish(`sensor_readings/${assetId}/temperature`,  r.temperature.toFixed(1));
        client.publish(`sensor_readings/${assetId}/pressure`,     r.pressure.toFixed(2));

        console.log(
            `  ${assetId}: vib=${r.vibration.toFixed(2)} mm/s` +
            `  temp=${r.temperature.toFixed(1)}°C` +
            `  pres=${r.pressure.toFixed(2)} bar`
        );
    }
    console.log("");
}

async function main() {
    console.log("[DBPublisher] Initializing engine — pulling reference vectors from SQL Server...");

    try {
        await loadLatestFromDB();
    } catch (err) {
        console.error("[DBPublisher] Database handshake failure during init phase:", err.message);
        process.exit(1);
    }

    if (Object.keys(state).length === 0) {
        console.error("[DBPublisher] Critical Error: Empty table context. Verify your database seeds.");
        process.exit(1);
    }

    const client = mqtt.connect(BROKER_URL);

    client.on("connect", () => {
        console.log("[DBPublisher] Handshake complete. Connected to MQTT broker at:", BROKER_URL);
        console.log("[DBPublisher] Live streaming telemetry channels every", INTERVAL_MS / 1000, "seconds.");
        publish(client);
        setInterval(() => publish(client), INTERVAL_MS);
    });

    client.on("error", (err) => {
        console.error("[DBPublisher] Mosquitto socket runtime disruption:", err.message);
    });
}

main();