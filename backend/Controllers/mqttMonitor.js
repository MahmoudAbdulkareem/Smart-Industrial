
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mqtt = require("mqtt");

const BROKER_URL = process.env.MQTT_BROKER_URL ;

const client = mqtt.connect(BROKER_URL, { clientId: "mqtt-monitor-" + Date.now() });

const stats = {
    total:      0,
    byAsset:    {},
    byType:     {},
    startTime:  Date.now(),
    lastPrint:  Date.now(),
};

const C = {
    reset:  "\x1b[0m",
    dim:    "\x1b[2m",
    green:  "\x1b[32m",
    yellow: "\x1b[33m",
    cyan:   "\x1b[36m",
    red:    "\x1b[31m",
    blue:   "\x1b[34m",
    bold:   "\x1b[1m",
};

function colorForSensor(type) {
    if (type === "vibration")   return C.yellow;
    if (type === "temperature") return C.red;
    if (type === "pressure")    return C.cyan;
    return C.reset;
}

client.on("connect", () => {
    console.log(C.bold + "\n[MQTT Monitor] Connected to MQTT Broker  " +  C.reset);
    console.log(C.dim + "Subscribed to all topics (#)" + C.reset);
    client.subscribe("#", (err) => {
        if (err) console.error("[MQTT Monitor] Subscribe error:", err.message);
    });
});

client.on("message", (topic, message) => {
    const value    = message.toString();
    const parts    = topic.split("/");
    const time     = new Date().toLocaleTimeString();
    stats.total++;

    if (parts[0] === "sensor_readings" && parts.length === 3) {
        const assetId   = parts[1];
        const sensorType = parts[2];
        const numVal    = parseFloat(value);
        const color     = colorForSensor(sensorType);

        if (!stats.byAsset[assetId]) stats.byAsset[assetId] = 0;
        stats.byAsset[assetId]++;

        if (!stats.byType[sensorType]) stats.byType[sensorType] = 0;
        stats.byType[sensorType]++;

        let unit = "";
        let warn = "";
        if (sensorType === "vibration") {
            unit = "mm/s";
            if (numVal > 8)  warn = C.red + " ⚠ HIGH" + C.reset;
        } else if (sensorType === "temperature") {
            unit = "°C";
            if (numVal > 85) warn = C.red + " ⚠ HIGH" + C.reset;
        } else if (sensorType === "pressure") {
            unit = "bar";
            if (numVal < 1.0 || numVal > 5.0) warn = C.yellow + " ⚠ OUT OF RANGE" + C.reset;
        }

        console.log(
            C.dim + `[${time}]` + C.reset +
            ` ${C.blue}${assetId}${C.reset}` +
            ` ${C.dim}/${C.reset}` +
            `${color}${sensorType.padEnd(12)}${C.reset}` +
            ` → ` +
            C.bold + value.padStart(7) + C.reset +
            ` ${C.dim}${unit}${C.reset}` +
            warn
        );
    } else {
        console.log(
            C.dim + `[${time}]` + C.reset +
            ` ${C.green}${topic}${C.reset} → ${value}`
        );
    }

    if (stats.total % 15 === 0) {
        const elapsed  = ((Date.now() - stats.startTime) / 1000).toFixed(0);
        const rate     = (stats.total / elapsed).toFixed(1);
        console.log(
            C.dim + "─".repeat(70) + "\n" +
            `  Stats: ${stats.total} messages | ${rate} msg/s | ${elapsed}s running\n` +
            "  By asset: " +
            Object.entries(stats.byAsset).map(([k,v]) => `${k}:${v}`).join("  ") + "\n" +
            "─".repeat(70) + C.reset
        );
    }
});

client.on("error", (err) => {
    console.error(C.red + "[MQTT Monitor] Error: " + err.message + C.reset);
});

client.on("disconnect", () => {
    console.log(C.yellow + "[MQTT Monitor] Disconnected from broker" + C.reset);
});

process.on("SIGINT", () => {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
    console.log(
        "\n" + C.bold + "[MQTT Monitor] Session summary" + C.reset + "\n" +
        C.dim + "─".repeat(40) + C.reset + "\n" +
        `  Total messages : ${stats.total}\n` +
        `  Duration       : ${elapsed}s\n` +
        `  Avg rate       : ${(stats.total / elapsed).toFixed(1)} msg/s\n` +
        `  By sensor type :\n` +
        Object.entries(stats.byType).map(([k,v]) => `    ${k.padEnd(12)}: ${v}`).join("\n") + "\n" +
        C.dim + "─".repeat(40) + C.reset
    );
    client.end();
    process.exit(0);
});
