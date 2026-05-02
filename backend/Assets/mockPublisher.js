
const { query } = require("../DataBase/db");

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

function getStatus(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "caution";
  return "critical";
}

async function generateAndSaveData() {
  const time = new Date().toLocaleTimeString();
  console.log(`[Mock Publisher] Publishing at ${time}`);

  for (const asset of assets) {
    const vibration    = vary(asset.baseVib, 0.5);
    const temperature  = vary(asset.baseTemp, 3.0);
    const pressure     = rand(1.2, 3.1);
    const health_score = parseFloat(rand(0, 100).toFixed(1));
    const rul          = parseFloat((health_score / 100 * 365).toFixed(1));
    const mtbf         = parseFloat((health_score / 100 * 1000).toFixed(1));
    const status       = getStatus(health_score);  // ← fixed: lowercase

    try {
      await query(`
        INSERT INTO sensor_readings
          (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at)
        VALUES
          (@asset_id, @vibration, @temperature, @pressure, @health_score, @rul, @mtbf, @status, GETDATE())
      `, { asset_id: asset.id, vibration, temperature, pressure, health_score, rul, mtbf, status });

      console.log(
        `  ${asset.id} (${asset.name}): ` +
        `vib=${vibration} mm/s  temp=${temperature}°C  pres=${pressure} bar  ` +
        `score=${health_score}  status=${status}`
      );
    } catch (err) {
      console.error(`  Error saving ${asset.id}:`, err.message);
    }
  }
  console.log("");
}

console.log("[Mock Publisher] Started — generating sensor data every 10 seconds\n");
setInterval(generateAndSaveData, 10000);
generateAndSaveData();
