const telemetryRepository = require("../repositories/telemetryRepository");
const energyService = require("./energyService");

function getIo() {
    return global.io || null;
}

async function broadcastAssetHealth() {
    const io = getIo();
    if (!io) return;
    const assets = await telemetryRepository.getAssetHealthOverview();
    assets.forEach((asset) => {
        io.emit("sensor:reading", {
            assetId: asset.id,
            healthScore: asset.healthScore,
            rul: asset.rul,
            status: asset.status,
            degradationState: asset.degradationState,
            mtbfRemainingPct: asset.mtbfRemainingPct,
            sensors: asset.sensors,
            timestamp: new Date().toISOString(),
        });
    });
}

async function broadcastEnergy() {
    const io = getIo();
    if (!io) return;
    const snapshot = await energyService.buildAggregatedSnapshot();
    if (snapshot.zones.length) {
        io.emit("energy:update", snapshot);
    }
}

function startBroadcastLoop(intervalMs = 7000) {
    setTimeout(() => {
        broadcastAssetHealth().catch(() => {});
        broadcastEnergy().catch(() => {});
    }, 2000);
    setInterval(() => {
        broadcastAssetHealth().catch(() => {});
        broadcastEnergy().catch(() => {});
    }, intervalMs);
}

module.exports = { startBroadcastLoop, broadcastAssetHealth, broadcastEnergy };
