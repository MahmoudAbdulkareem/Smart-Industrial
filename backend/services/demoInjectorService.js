// services/demoInjectorService.js
//
// This does NOT fabricate frontend data or bypass the real pipeline. It opens a real
// MQTT connection and publishes onto the exact topics (`telemetry/{assetId}/{metric}`)
// that services/mqttService.js already subscribes to in production. Every injected
// reading is therefore evaluated by the real ML proxy, the real rule engine, and (when
// thresholds are crossed) results in a real Maximo work order — nothing downstream of
// the broker knows or cares that the values originated from a demo trigger instead of a
// physical sensor.
const mqttLib = require("mqtt");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const TICK_MS = 2000;

// Scenario definitions: starting point + per-tick ramp, bounded at a ceiling.
// Thresholds mirror the ones already enforced by ruleEngineService / mlProxyService.
const SCENARIOS = {
    NORMAL: {
        label: "Normal Run",
        vibration: { start: 1.5, step: 0, ceiling: 1.5, noise: 0.15 },
        temperature: { start: 42, step: 0, ceiling: 42, noise: 0.8 },
    },
    BEARING_WEAR: {
        label: "Bearing Wear Degradation",
        vibration: { start: 1.8, step: 0.28, ceiling: 5.2, noise: 0.15 },
        temperature: { start: 45, step: 1.6, ceiling: 88, noise: 0.8 },
    },
    THERMAL_OVERLOAD: {
        label: "Thermal Overload",
        vibration: { start: 1.6, step: 0.08, ceiling: 3.2, noise: 0.15 },
        temperature: { start: 48, step: 3.4, ceiling: 96, noise: 1.0 },
    },
    IMBALANCE_SPIKE: {
        label: "Imbalance Spike",
        vibration: { start: 2.0, step: 0.55, ceiling: 6.5, noise: 0.25 },
        temperature: { start: 44, step: 0.9, ceiling: 70, noise: 0.8 },
    },
};

let client = null;
const runningTimers = new Map(); // assetId -> { timer, scenario, tick, values }

function getClient() {
    if (!client) {
        client = mqttLib.connect(BROKER_URL, { reconnectPeriod: 3000, connectTimeout: 15000 });
        client.on("error", (err) => console.error("[demoInjectorService] MQTT error:", err.message));
    }
    return client;
}

function gaussianNoise(sigma) {
    // Box-Muller transform for realistic sensor noise, matching the brief's spec.
    const u1 = Math.random() || 1e-9;
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma;
}

function startScenario(assetId, scenarioKey) {
    const scenario = SCENARIOS[scenarioKey];
    if (!scenario) throw new Error(`Unknown scenario: ${scenarioKey}`);

    stopScenario(assetId);
    const mqttClient = getClient();

    const state = {
        scenario: scenarioKey,
        label: scenario.label,
        tick: 0,
        vibration: scenario.vibration.start,
        temperature: scenario.temperature.start,
        startedAt: new Date().toISOString(),
    };

    const timer = setInterval(() => {
        state.tick += 1;
        state.vibration = Math.min(scenario.vibration.ceiling, state.vibration + scenario.vibration.step);
        state.temperature = Math.min(scenario.temperature.ceiling, state.temperature + scenario.temperature.step);

        const vibrationReading = Math.max(0, state.vibration + gaussianNoise(scenario.vibration.noise));
        const temperatureReading = Math.max(0, state.temperature + gaussianNoise(scenario.temperature.noise));

        mqttClient.publish(`telemetry/${assetId}/vibration`, vibrationReading.toFixed(3));
        // A short delay before temperature mirrors the real publisher's per-metric
        // cadence and lets mqttService's 400ms aggregation window merge them into one reading.
        setTimeout(() => {
            mqttClient.publish(`telemetry/${assetId}/temperature`, temperatureReading.toFixed(2));
        }, 120);
    }, TICK_MS);

    runningTimers.set(assetId, { timer, state });
    return state;
}

function stopScenario(assetId) {
    const running = runningTimers.get(assetId);
    if (running) {
        clearInterval(running.timer);
        runningTimers.delete(assetId);
        return true;
    }
    return false;
}

function stopAll() {
    for (const assetId of runningTimers.keys()) stopScenario(assetId);
}

function getStatus() {
    return Array.from(runningTimers.entries()).map(([assetId, running]) => ({
        assetId,
        ...running.state,
    }));
}

function listScenarios() {
    return Object.entries(SCENARIOS).map(([key, s]) => ({ key, label: s.label }));
}

module.exports = { startScenario, stopScenario, stopAll, getStatus, listScenarios };
