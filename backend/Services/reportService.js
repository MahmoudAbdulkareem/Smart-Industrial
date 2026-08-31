const energyService = require("./energyService");
const telemetryRepository = require("../repositories/telemetryRepository");

function pad(value) {
    return String(value).padStart(2, "0");
}

function formatDateTime(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cell(value, type = "String") {
    return `<Cell><Data ss:Type="${type}">${String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Data></Cell>`;
}

function row(cells) {
    return `<Row>${cells.join("")}</Row>`;
}

function buildExcelReport(zones, history, assets) {
    const summaryRows = [
        row([cell("Zone"), cell("Electricity kWh"), cell("Baseline kWh"), cell("Water L/min"), cell("Gas m3/h"), cell("PUE"), cell("EER"), cell("CO2 kg/h")]),
        ...zones.map((z) => row([
            cell(z.zone), cell(z.electricity_kwh, "Number"), cell(z.electricity_base, "Number"),
            cell(z.water_lpm, "Number"), cell(z.gas_m3h, "Number"), cell(z.pue, "Number"),
            cell(z.eer, "Number"), cell(z.co2_emissions, "Number"),
        ])),
    ];

    const assetRows = [
        row([cell("Asset ID"), cell("Name"), cell("Status"), cell("Health Score"), cell("RUL Hours"), cell("Last Update")]),
        ...assets.map((a) => row([
            cell(a.id), cell(a.name), cell(a.status), cell(a.healthScore ?? "", "Number"),
            cell(a.rul ?? "", "Number"), cell(a.lastUpdate || ""),
        ])),
    ];

    return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Energy Summary"><Table>${summaryRows.join("")}</Table></Worksheet>
<Worksheet ss:Name="Asset Health"><Table>${assetRows.join("")}</Table></Worksheet>
</Workbook>`;
}

function buildHtmlReport(zones, assets, generatedAt) {
    const totalElectricity = zones.reduce((sum, z) => sum + (z.electricity_kwh || 0), 0).toFixed(1);
    const criticalCount = assets.filter((a) => a.status === "critical").length;
    const cautionCount = assets.filter((a) => a.status === "caution").length;
    const healthyCount = assets.filter((a) => a.status === "healthy").length;

    const zoneRows = zones.map((z) => `<tr><td>${z.zone}</td><td>${z.electricity_kwh}</td><td>${z.pue}</td><td>${z.co2_emissions}</td></tr>`).join("");
    const assetRows = assets.map((a) => `<tr><td>${a.id}</td><td>${a.name}</td><td>${a.status}</td><td>${a.healthScore ?? "n/a"}</td></tr>`).join("");

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Energy Report</title>
<style>body{font-family:Arial;font-size:12px;margin:40px;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ddd;padding:6px;}</style>
</head><body>
<h1>Smart Dashboard — Energy & Asset Report</h1>
<p>Generated: ${generatedAt}</p>
<p>Healthy: ${healthyCount} | Caution: ${cautionCount} | Critical: ${criticalCount} | Total Electricity: ${totalElectricity} kWh</p>
<h2>Energy by Zone</h2><table><tr><th>Zone</th><th>kWh</th><th>PUE</th><th>CO2</th></tr>${zoneRows}</table>
<h2>Asset Health</h2><table><tr><th>ID</th><th>Name</th><th>Status</th><th>Health</th></tr>${assetRows}</table>
</body></html>`;
}

async function generateExcelReport() {
    const [zones, assets] = await Promise.all([energyService.getLatestEnergyData(), telemetryRepository.getAssetHealthOverview()]);
    return buildExcelReport(zones, [], assets);
}

async function generateHtmlReport() {
    const [zones, assets] = await Promise.all([energyService.getLatestEnergyData(), telemetryRepository.getAssetHealthOverview()]);
    return buildHtmlReport(zones, assets, formatDateTime());
}

module.exports = { generateExcelReport, generateHtmlReport };
