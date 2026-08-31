require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mqtt = require("mqtt");
const { query } = require("../db/pool");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const INTERVAL_MS = parseInt(process.env.PUBLISH_INTERVAL_MS || "10000");

const telemetryHistory = {};
const telemetryCursor = {};
const energyHistory = {};
const energyCursor = {};

async function loadTelemetryHistory() {
    const rows = await query(`
        SELECT asset_id, vibration, temperature, pressure, rms, kurtosis, peak_to_peak, recorded_at
        FROM telemetry_raw
        ORDER BY asset_id, recorded_at ASC
    `);

    for (const row of rows) {
        if (!telemetryHistory[row.asset_id]) {
            telemetryHistory[row.asset_id] = [];
            telemetryCursor[row.asset_id] = 0;
        }
        telemetryHistory[row.asset_id].push({
            vibration: row.vibration,
            temperature: row.temperature,
            pressure: row.pressure,
            rms: row.rms,
            kurtosis: row.kurtosis,
            peak_to_peak: row.peak_to_peak,
        });
    }

    for (const assetId of Object.keys(telemetryHistory)) {
        console.log(`  [Telemetry] Loaded ${telemetryHistory[assetId].length} real readings for ${assetId}`);
    }
}

async function loadEnergyHistory() {
    const rows = await query(`
        SELECT zone, electricity_kwh, electricity_base, water_lpm, water_base,
               gas_m3h, gas_base, pue, eer, co2_emissions, recorded_at
        FROM energy_metrics
        ORDER BY zone, recorded_at ASC
    `);

    for (const row of rows) {
        if (!energyHistory[row.zone]) {
            energyHistory[row.zone] = [];
            energyCursor[row.zone] = 0;
        }
        energyHistory[row.zone].push({
            electricity: row.electricity_kwh,
            electricity_base: row.electricity_base,
            water: row.water_lpm,
            water_base: row.water_base,
            gas: row.gas_m3h,
            gas_base: row.gas_base,
            pue: row.pue,
            eer: row.eer,
            co2: row.co2_emissions,
        });
    }

    for (const zone of Object.keys(energyHistory)) {
        console.log(`  [Energy] Loaded ${energyHistory[zone].length} real readings for ${zone}`);
    }
}

function nextFrom(historyMap, cursorMap, key) {
    const series = historyMap[key];
    const index = cursorMap[key] % series.length;
    cursorMap[key] += 1;
    return series[index];
}

function publishTelemetry(client) {
    for (const assetId of Object.keys(telemetryHistory)) {
        const reading = nextFrom(telemetryHistory, telemetryCursor, assetId);
        if (reading.rms !== null && reading.rms !== undefined) client.publish(`telemetry/${assetId}/rms`, String(reading.rms));
        if (reading.vibration !== null && reading.vibration !== undefined) client.publish(`telemetry/${assetId}/vibration`, String(reading.vibration));
        if (reading.temperature !== null && reading.temperature !== undefined) client.publish(`telemetry/${assetId}/temperature`, String(reading.temperature));
        if (reading.pressure !== null && reading.pressure !== undefined) client.publish(`telemetry/${assetId}/pressure`, String(reading.pressure));
        if (reading.kurtosis !== null && reading.kurtosis !== undefined) client.publish(`telemetry/${assetId}/kurtosis`, String(reading.kurtosis));
        if (reading.peak_to_peak !== null && reading.peak_to_peak !== undefined) client.publish(`telemetry/${assetId}/peak_to_peak`, String(reading.peak_to_peak));
        console.log(`  [Telemetry] ${assetId}: vib=${reading.vibration} temp=${reading.temperature} pressure=${reading.pressure} rms=${reading.rms}`);
    }
}

function publishEnergy(client) {
    const allData = [];
    for (const zone of Object.keys(energyHistory)) {
        const data = nextFrom(energyHistory, energyCursor, zone);
        allData.push({ zone, ...data });

        client.publish(`energy/${zone}/electricity`, String(data.electricity));
        client.publish(`energy/${zone}/water`, String(data.water));
        client.publish(`energy/${zone}/gas`, String(data.gas));
        client.publish(`energy/${zone}/pue`, String(data.pue));
        client.publish(`energy/${zone}/eer`, String(data.eer));
        client.publish(`energy/${zone}/co2`, String(data.co2));

        console.log(`  [Energy] ${zone}: elec=${data.electricity} water=${data.water} gas=${data.gas} PUE=${data.pue}`);
    }

    if (!allData.length) return;
    const average = (key) => allData.reduce((sum, z) => sum + (z[key] || 0), 0) / allData.length;
    const aggregated = {
        current: average("electricity"),
        baseline: average("electricity_base"),
        water: { current: average("water"), baseline: average("water_base") },
        gas: { current: average("gas"), baseline: average("gas_base") },
        kpis: { pue: average("pue"), eer: average("eer"), co2: average("co2") },
        timestamp: new Date().toISOString(),
        zones: allData,
    };
    client.publish("energy/aggregated", JSON.stringify(aggregated));
}

function publishAll(client) {
    console.log(`[Publisher] Replaying real data — ${new Date().toLocaleTimeString()}`);
    publishTelemetry(client);
    publishEnergy(client);
    console.log("");
}

async function main() {
    console.log("[Publisher] Loading real telemetry and energy history from SQL Server...");
    await loadTelemetryHistory();
    await loadEnergyHistory();

    if (!Object.keys(telemetryHistory).length && !Object.keys(energyHistory).length) {
        console.error("[Publisher] No data found in telemetry_raw or energy_metrics.");
        console.error("Run the dataset ingestion script and/or seed energy_metrics first.");
        process.exit(1);
    }

    const client = mqtt.connect(BROKER_URL);
    client.on("connect", () => {
        console.log("[Publisher] Connected to broker:", BROKER_URL);
        publishAll(client);
        setInterval(() => publishAll(client), INTERVAL_MS);
    });
    client.on("error", (error) => console.error("[Publisher]", error.message));
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
