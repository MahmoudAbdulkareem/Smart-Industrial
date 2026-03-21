// Mock data simulating IBM Maximo Monitor API responses

const assets = [
  { id: "AST-001", name: "Compressor Unit A", location: "Zone 1" },
  { id: "AST-002", name: "Pump Station B",    location: "Zone 2" },
  { id: "AST-003", name: "Conveyor Belt C",   location: "Zone 3" },
  { id: "AST-004", name: "HVAC Unit D",       location: "Zone 1" },
  { id: "AST-005", name: "Motor Drive E",     location: "Zone 4" },
];

function rand(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

function getStatus(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "caution";
  return "critical";
}

function getAssetHealth() {
  const baseScores = [88, 54, 31, 76, 42];
  return assets.map((asset, i) => {
    const score = parseFloat(Math.max(0, Math.min(100, baseScores[i] + rand(-3, 3))).toFixed(1));
    return {
      ...asset,
      healthScore: score,
      status: getStatus(score),
      rul: parseFloat((score * 0.9 + rand(0, 10)).toFixed(1)),   // days
      mtbf: parseFloat((200 + i * 45 + rand(-10, 10)).toFixed(1)), // hours
      sensors: {
        vibration:   rand(0.5, 5.0),   // mm/s
        temperature: rand(35, 80),     // °C
        pressure:    rand(1.2, 4.5),   // bar
      },
    };
  });
}

function getEnergyData() {
  const baseline = 120; // kWh
  return {
    baseline,
    current: parseFloat((baseline * rand(0.85, 1.45)).toFixed(1)),
    water:   { current: rand(38, 58), baseline: 45 },
    gas:     { current: rand(22, 48), baseline: 30 },
    kpis: {
      pue: rand(1.15, 1.85),
      eer: rand(2.8, 4.2),
      co2: rand(42, 78),
    },
    history: Array.from({ length: 24 }, (_, h) => ({
      hour: `${String(h).padStart(2, "0")}:00`,
      actual:   parseFloat((baseline * (0.7 + Math.sin(h / 4) * 0.3 + rand(-0.05, 0.25))).toFixed(1)),
      baseline: parseFloat((baseline * (0.8 + Math.sin(h / 4) * 0.2)).toFixed(1)),
    })),
  };
}

function getAlerts() {
  return [
    { id: "ALT-001", asset: "Conveyor Belt C",  severity: "critical", message: "Health score critical — maintenance required",      time: "12 min ago" },
    { id: "ALT-002", asset: "Pump Station B",   severity: "caution",  message: "Vibration rising — monitor closely",                 time: "35 min ago" },
    { id: "ALT-003", asset: "Motor Drive E",    severity: "caution",  message: "Temperature approaching upper limit",                time: "1h ago" },
  ];
}

module.exports = { getAssetHealth, getEnergyData, getAlerts };
