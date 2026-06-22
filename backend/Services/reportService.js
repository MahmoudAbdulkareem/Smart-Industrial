
const { getEnergyHistory, getLatestEnergyData } = require("./energyService");
const { query } = require("../DataBase/db");

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtDateTime(d = new Date()) {
    return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildExcel(zones, history, assets) {
    const cell = (val, type = "String") =>
        `<Cell><Data ss:Type="${type}">${String(val).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</Data></Cell>`;
    const row  = (cells) => `<Row>${cells.join("")}</Row>`;

    const summaryRows = [
        row([cell("Zone"), cell("Electricity (kWh)",), cell("Baseline (kWh)"), cell("Water (L/min)"), cell("Gas (m³/h)"), cell("PUE"), cell("EER"), cell("CO₂ (kg/h)")]),
        ...zones.map(z => row([
            cell(z.zone),
            cell(z.electricity_kwh,  "Number"),
            cell(z.electricity_base, "Number"),
            cell(z.water_lpm,        "Number"),
            cell(z.water_base,       "Number"),
            cell(z.pue,              "Number"),
            cell(z.eer,              "Number"),
            cell(z.co2_emissions,    "Number"),
        ])),
    ];

    const histRows = [
        row([cell("Time"), cell("Zone"), cell("Electricity (kWh)"), cell("Baseline (kWh)"), cell("PUE"), cell("CO₂ (kg/h)")]),
        ...history.map(h => row([
            cell(h.hour_label),
            cell(h.zone),
            cell(h.electricity_kwh,  "Number"),
            cell(h.electricity_base, "Number"),
            cell(h.pue,              "Number"),
            cell(h.co2_emissions,    "Number"),
        ])),
    ];

    const assetRows = [
        row([cell("Asset ID"), cell("Name"), cell("Status"), cell("Health Score"), cell("RUL (days)"), cell("MTBF (hrs)"), cell("Last Update")]),
        ...assets.map(a => row([
            cell(a.id),
            cell(a.name),
            cell(a.status),
            cell(a.healthScore, "Number"),
            cell(a.rul,         "Number"),
            cell(a.mtbf,        "Number"),
            cell(a.lastUpdate || ""),
        ])),
    ];

    return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Energy Summary">
    <Table>${summaryRows.join("")}</Table>
  </Worksheet>
  <Worksheet ss:Name="24h History">
    <Table>${histRows.join("")}</Table>
  </Worksheet>
  <Worksheet ss:Name="Asset Health">
    <Table>${assetRows.join("")}</Table>
  </Worksheet>
</Workbook>`;
}

function buildHtmlReport(zones, history, assets, generated) {
    const avg = (arr, key) =>
        arr.length ? parseFloat((arr.reduce((s,r) => s+(r[key]||0), 0)/arr.length).toFixed(2)) : 0;

    const totalElec = zones.reduce((s,z) => s+(z.electricity_kwh||0), 0).toFixed(1);
    const totalCo2  = zones.reduce((s,z) => s+(z.co2_emissions||0),  0).toFixed(1);
    const avgPue    = avg(zones, "pue");
    const avgEer    = avg(zones, "eer");

    const criticalCount = assets.filter(a => a.status === "critical").length;
    const cautionCount  = assets.filter(a => a.status === "caution").length;
    const healthyCount  = assets.filter(a => a.status === "healthy").length;

    const zoneRows = zones.map(z => `
        <tr>
            <td>${z.zone}</td>
            <td>${z.electricity_kwh} / ${z.electricity_base}</td>
            <td>${z.water_lpm} / ${z.water_base}</td>
            <td>${z.gas_m3h} / ${z.gas_base}</td>
            <td>${z.pue}</td>
            <td>${z.eer}</td>
            <td>${z.co2_emissions}</td>
        </tr>`).join("");

    const assetRows = assets.map(a => `
        <tr>
            <td>${a.id}</td>
            <td>${a.name}</td>
            <td class="status-${a.status}">${a.status.toUpperCase()}</td>
            <td>${a.healthScore}/100</td>
            <td>${a.rul} days</td>
            <td>${a.mtbf} hrs</td>
        </tr>`).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Smart Dashboard — Energy Report</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a2332; margin: 40px; }
  h1   { font-size: 22px; color: #1d6fcc; border-bottom: 2px solid #1d6fcc; padding-bottom: 8px; }
  h2   { font-size: 15px; color: #374151; margin-top: 28px; margin-bottom: 8px; }
  .meta { font-size: 11px; color: #6b7a99; margin-bottom: 24px; }
  .kpi-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .kpi { background: #f0f6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 18px; min-width: 120px; text-align: center; }
  .kpi .val { font-size: 22px; font-weight: 800; color: #1d6fcc; }
  .kpi .lbl { font-size: 10px; color: #6b7a99; text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th    { background: #f0f4f8; padding: 7px 10px; text-align: left; font-size: 11px; color: #374151; border: 1px solid #e2e8f0; }
  td    { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; }
  tr:nth-child(even) td { background: #f9fbff; }
  .status-healthy  { color: #15803d; font-weight: 700; }
  .status-caution  { color: #b45309; font-weight: 700; }
  .status-critical { color: #b91c1c; font-weight: 700; }
  .footer { margin-top: 32px; font-size: 10px; color: #9aa5b4; border-top: 1px solid #e2e8f0; padding-top: 10px; }
</style>
</head>
<body>
<h1>Smart Dashboard — Energy & Asset Report</h1>
<div class="meta">Generated: ${generated} &nbsp;|&nbsp; Reporting period: Last 24 hours</div>

<h2>KPI Summary</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="val">${totalElec}</div><div class="lbl">Total Electricity (kWh)</div></div>
  <div class="kpi"><div class="val">${totalCo2}</div><div class="lbl">Total CO₂ (kg/h)</div></div>
  <div class="kpi"><div class="val">${avgPue}</div><div class="lbl">Avg PUE</div></div>
  <div class="kpi"><div class="val">${avgEer}</div><div class="lbl">Avg EER</div></div>
  <div class="kpi"><div class="val" style="color:#15803d">${healthyCount}</div><div class="lbl">Healthy Assets</div></div>
  <div class="kpi"><div class="val" style="color:#b45309">${cautionCount}</div><div class="lbl">Caution Assets</div></div>
  <div class="kpi"><div class="val" style="color:#b91c1c">${criticalCount}</div><div class="lbl">Critical Assets</div></div>
</div>

<h2>Energy by Zone</h2>
<table>
  <thead><tr>
    <th>Zone</th><th>Electricity kWh / Baseline</th><th>Water L/min / Baseline</th>
    <th>Gas m³/h / Baseline</th><th>PUE</th><th>EER</th><th>CO₂ kg/h</th>
  </tr></thead>
  <tbody>${zoneRows}</tbody>
</table>

<h2>Asset Health Status</h2>
<table>
  <thead><tr>
    <th>Asset ID</th><th>Name</th><th>Status</th><th>Health Score</th><th>RUL</th><th>MTBF</th>
  </tr></thead>
  <tbody>${assetRows}</tbody>
</table>

<div class="footer">
  Smart Dashboard ML Service v2.0 &nbsp;|&nbsp; Auto-generated report &nbsp;|&nbsp; ${generated}
</div>
</body>
</html>`;
}
async function generateExcelReport() {
    const [zones, history, assets] = await Promise.all([
        getLatestEnergyData(),
        getEnergyHistory(),
        getAssetHealth(),
    ]);
    return buildExcel(zones, history, assets);
}

async function generateHtmlReport() {
    const [zones, history, assets] = await Promise.all([
        getLatestEnergyData(),
        getEnergyHistory(),
        getAssetHealth(),
    ]);
    return buildHtmlReport(zones, history, assets, fmtDateTime());
}

async function getAssetHealth() {
    try {
        const rows = await query(`
            SELECT a.id, a.name,
                   s.health_score AS healthScore, s.rul, s.mtbf, s.status,
                   s.recorded_at AS lastUpdate
            FROM assets a
            CROSS APPLY (
                SELECT TOP 1 * FROM sensor_readings WHERE asset_id = a.id ORDER BY recorded_at DESC
            ) s
            ORDER BY a.id
        `);
        return rows || [];
    } catch {
        return [];
    }
}

module.exports = { generateExcelReport, generateHtmlReport };
