// randomDataGenerator.js
const { query } = require("./config/db");

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

function generateAndSaveData() {
  const time = new Date().toLocaleTimeString();
  console.log(`[Random Generator] Publishing at ${time}`);

  assets.forEach(async (asset) => {
    const vibration = vary(asset.baseVib, 0.5);
    const temperature = vary(asset.baseTemp, 3.0);
    const pressure = rand(1.2, 4.5);

    try {
      await query(`
        INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, recorded_at)
        VALUES (@asset_id, @vibration, @temperature, @pressure, GETDATE())
      `, {
        asset_id: asset.id,
        vibration,
        temperature,
        pressure
      });

      console.log(
        `  ${asset.id} (${asset.name}): ` +
        `vib=${vibration} mm/s, temp=${temperature}°C, pres=${pressure} bar`
      );
    } catch (err) {
      console.error(`  Error saving ${asset.id}:`, err.message);
    }
  });

  console.log("");
}

console.log("[Random Generator] Started – generating sensor data every 10 seconds\n");
setInterval(generateAndSaveData, 10000);

generateAndSaveData();