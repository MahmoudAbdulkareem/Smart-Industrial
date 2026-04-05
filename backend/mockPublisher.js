// mockPublisher.js — simulates 5 IoT sensors publishing to MQTT broker
// Run this in a separate terminal: node mockPublisher.js
// Publishes vibration, temperature, pressure for each asset every 10 seconds
// Corresponds to step 1 of the sequence diagram:
//   MQTT publish: sensor_readings/{asset_id}/{type}

const mqtt = require("mqtt");

const BROKER_URL = "mqtt://localhost:1883";
const INTERVAL   = 10000; // publish every 10 seconds

const assets = [
  { id: "AST-001", name: "Compressor Unit A", baseVib: 1.2, baseTemp: 45 },
  { id: "AST-002", name: "Pump Station B",    baseVib: 3.1, baseTemp: 62 },
  { id: "AST-003", name: "Conveyor Belt C",   baseVib: 7.8, baseTemp: 78 },
  { id: "AST-004", name: "HVAC Unit D",       baseVib: 1.5, baseTemp: 48 },
  { id: "AST-005", name: "Motor Drive E",     baseVib: 4.2, baseTemp: 71 },
];

function rand(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function vary(base, range) {
  return parseFloat((base + rand(-range, range)).toFixed(2));
}

const client = mqtt.connect(BROKER_URL);

client.on("connect", () => {
  console.log("[Publisher] Connected to MQTT broker at", BROKER_URL);
  console.log("[Publisher] Publishing sensor readings every 10 seconds...\n");

  // Publish immediately on connect, then repeat every 10 seconds
  publishAll();
  setInterval(publishAll, INTERVAL);
});

function publishAll() {
  const time = new Date().toLocaleTimeString();
  console.log(`[Publisher] Publishing at ${time}`);

  assets.forEach(asset => {
    const vibration   = vary(asset.baseVib,  0.5);
    const temperature = vary(asset.baseTemp, 3.0);
    const pressure    = rand(1.2, 4.5);

    // Publish each sensor type as a separate MQTT message
    // Topic format: sensor_readings/{asset_id}/{type}
    client.publish(`sensor_readings/${asset.id}/vibration`,   String(vibration));
    client.publish(`sensor_readings/${asset.id}/temperature`, String(temperature));
    client.publish(`sensor_readings/${asset.id}/pressure`,    String(pressure));

    console.log(
      `  ${asset.id} (${asset.name}): ` +
      `vib=${vibration} mm/s, temp=${temperature}°C, pres=${pressure} bar`
    );
  });
  console.log("");
}

client.on("error", err => {
  console.error("[Publisher] Error:", err.message);
  console.error("Make sure Mosquitto broker is running: mosquitto -v");
});
