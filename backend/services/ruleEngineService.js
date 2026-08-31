// services/ruleEngineService.js
//
// Dynamic rule engine for asset health, per the Maximo domain-model spec:
//   - Strict 3-state categorisation: Healthy / Caution / Critical
//   - Uses the three physical sensor channels (vibration, temperature, pressure)
//   - Weights the result by how close the asset is to its MTBF
//   - Automatically dispatches a Maximo Work Order when an asset goes Critical
//
// This module is intentionally decoupled from any one ingestion path (MQTT,
// ML inference, or a periodic poll can all call `evaluateAsset` /
// `maybeAutoDispatch`) so the same rules apply everywhere in the system.

const { queryOne } = require("../db/pool");
const maximoService = require("./maximoService");
const alertRepository = require("../repositories/alertRepository");
const { VIBRATION_WARN_MM_S, VIBRATION_MAX_MM_S } = require("../config/isoVibrationZones");

// ── Operating-limit table per asset type (spec §4-D) ───────────────────
// warn = 1st-stage warning threshold, max = safety / critical limit.
// Vibration is now Vibration Velocity in mm/s RMS, aligned with ISO 10816-3
// Zone B/C and C/D boundaries (config/isoVibrationZones.js is the single
// source of truth — do not hand-edit these numbers here, change them there).
// ml-service/dataset/generate_dataset.py generates telemetry on this same
// mm/s scale so the rule engine, the dataset, and the frontend all agree.
const THRESHOLDS = {
    ROTATING_EQUIPMENT: {
        vibration:   { warn: VIBRATION_WARN_MM_S, max: VIBRATION_MAX_MM_S },  // mm/s RMS
        temperature: { warn: 75,   max: 95 },    // °C
        pressure:    { warn: 9,    max: 11.5 },  // bar
    },
    THERMAL_PROCESS: {
        // Thermal/process equipment tolerates slightly more vibration before
        // it's the dominant failure mode (temperature/pressure lead instead).
        vibration:   { warn: 3.0, max: 4.8 },
        temperature: { warn: 85,   max: 100 },
        pressure:    { warn: 10,   max: 13 },
    },
    HYDRAULIC_SYSTEM: {
        vibration:   { warn: 2.8, max: 4.3 },
        temperature: { warn: 80,   max: 100 },
        pressure:    { warn: 12,   max: 18 },
    },
};
const DEFAULT_THRESHOLDS = THRESHOLDS.ROTATING_EQUIPMENT;

// Cool-down so we don't spam a new WO on every single reading.
const AUTO_WO_COOLDOWN_MINUTES = 30;

function thresholdsFor(assetType) {
    return THRESHOLDS[assetType] || DEFAULT_THRESHOLDS;
}

/**
 * Core rule engine: returns { status, healthScore, mtbfRemainingPct, reasons[] }
 * for a single reading, given the asset's MTBF/runtime context.
 */
function evaluateAsset({ vibration, temperature, pressure, mtbfHours, totalRunHours, assetType }) {
    const t = thresholdsFor(assetType);
    const reasons = [];

    const mtbfRemainingPct = mtbfHours > 0
        ? Math.max(0, Math.min(100, ((mtbfHours - (totalRunHours || 0)) / mtbfHours) * 100))
        : 100;

    let anyMax = false;
    let anyWarn = false;
    let maxBreachCount = 0;
    let worstOverMaxRatio = 0; // how far past the max limit, e.g. 1.5x -> severe

    const checks = [
        ["vibration", vibration],
        ["temperature", temperature],
        ["pressure", pressure],
    ];

    for (const [label, value] of checks) {
        if (value === null || value === undefined) continue;
        const band = t[label];
        if (value >= band.max) {
            anyMax = true;
            maxBreachCount += 1;
            worstOverMaxRatio = Math.max(worstOverMaxRatio, value / band.max);
            reasons.push(`${label} ${value} exceeded max safety limit (${band.max})`);
        } else if (value >= band.warn) {
            anyWarn = true;
            reasons.push(`${label} ${value} exceeded 1st-stage warning threshold (${band.warn})`);
        }
    }

    // Maximo work-order priority (1 = highest/emergency ... 5 = lowest), derived
    // from how far past the safety limit the reading is and how many channels
    // are breaching at once — not a flat Priority 1 for every Critical event.
    //   >=2 channels over max, OR >40% over the worst single limit -> Priority 1
    //   any single channel over max                                -> Priority 2
    //   MTBF-driven critical with no hard sensor breach             -> Priority 2
    let maximoPriority = 3;
    if (anyMax) {
        maximoPriority = (maxBreachCount >= 2 || worstOverMaxRatio >= 1.4) ? 1 : 2;
    }

    const mtbfCritical = mtbfRemainingPct < 5;   // essentially at end of life
    const mtbfCaution = mtbfRemainingPct < 15;   // spec: MTBF remaining < 15% => Caution

    let status = "Healthy";
    if (anyMax || mtbfCritical) {
        status = "Critical";
        if (mtbfCritical && !anyMax) {
            reasons.push(`MTBF remaining ${mtbfRemainingPct.toFixed(1)}% is critically low`);
            maximoPriority = Math.min(maximoPriority, 2); // MTBF end-of-life alone is at least Priority 2
        }
    } else if (anyWarn || mtbfCaution) {
        status = "Caution";
        if (mtbfCaution && !anyWarn) reasons.push(`MTBF remaining ${mtbfRemainingPct.toFixed(1)}% is below 15%`);
    }

    // Health baseline lowered as MTBF is consumed, then nudged by sensor margin.
    let healthScore = Math.round(40 + 0.6 * mtbfRemainingPct);
    if (anyMax) healthScore = Math.min(healthScore, 25);
    else if (anyWarn) healthScore = Math.min(healthScore, 65);
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
        status,
        healthScore,
        mtbfRemainingPct: parseFloat(mtbfRemainingPct.toFixed(1)),
        reasons,
        maximoPriority: status === "Critical" ? maximoPriority : null,
    };
}

async function getAssetMtbfContext(assetId) {
    const row = await queryOne(
        `SELECT id, name, type, mtbf_hours AS mtbfHours, total_run_hours AS totalRunHours
         FROM assets WHERE id = @assetId`,
        { assetId }
    );
    return row;
}

function mapAssetType(dbType) {
    if (!dbType) return "ROTATING_EQUIPMENT";
    const t = dbType.toUpperCase();
    if (t.includes("HVAC") || t.includes("THERMAL") || t.includes("HEAT")) return "THERMAL_PROCESS";
    if (t.includes("HYDRAULIC") || t.includes("PRESS") || t.includes("PIPE")) return "HYDRAULIC_SYSTEM";
    return "ROTATING_EQUIPMENT";
}

/**
 * Given a fresh sensor reading, evaluate against the rule engine and, when the
 * asset is Critical, automatically raise a Maximo Work Order (idempotent per
 * cool-down window) tagged AUTO_CRITICAL_ALERT / PRIORITY 1.
 *
 * Returns the evaluation result plus (if created) the new work order.
 */
async function evaluateAndDispatch(assetId, sensors, opts = {}) {
    const context = await getAssetMtbfContext(assetId);
    const assetType = mapAssetType(context?.type);

    const evaluation = evaluateAsset({
        vibration: sensors.vibration,
        temperature: sensors.temperature,
        pressure: sensors.pressure,
        mtbfHours: context?.mtbfHours ?? 8760,
        totalRunHours: context?.totalRunHours ?? 0,
        assetType,
    });

    let workOrder = null;
    let alert = null;

    if (evaluation.status === "Critical") {
        const recent = await alertRepository.recentUnacknowledgedForAsset(assetId, AUTO_WO_COOLDOWN_MINUTES);
        const shouldDispatch = recent.length === 0 || opts.force;

        if (shouldDispatch) {
            const reasonText = evaluation.reasons.join("; ") || "Critical threshold breach";
            workOrder = await maximoService.createLocalWorkOrder({
                assetId,
                description: `AUTOMATED: Critical Vibration/Temperature/Pressure Anomaly Detected — ${reasonText}`,
                priority: evaluation.maximoPriority || 1,
                createdBy: "RULE_ENGINE",
                generateType: "AUTO_CRITICAL_ALERT",
            });

            const alertId = await alertRepository.createAlert(assetId, "critical", `Critical asset state — ${reasonText}`, {
                wonum: workOrder.wonum,
                vibrationAtTrigger: sensors.vibration ?? null,
                temperatureAtTrigger: sensors.temperature ?? null,
                pressureAtTrigger: sensors.pressure ?? null,
                ruleReason: reasonText,
            });
            alert = await alertRepository.getAlertById(alertId);

            const io = global.io;
            if (io) {
                io.emit("alert:new", alert);
                io.emit("workorder:created", workOrder);
            }
        }
    } else if (evaluation.status === "Caution") {
        // Caution states are surfaced via health:update / alerts list but do not
        // dispatch a work order — only Critical breaches do (spec §4-B).
    }

    return { evaluation, workOrder, alert };
}

/**
 * Predictive path (Module D): called by the ML proxy result handler. If the
 * failure probability is high or RUL is short, auto-dispatch a WO tagged
 * AUTO_ML_PREDICTION, independent of the raw-threshold rule engine above.
 */
async function evaluateMlPredictionAndDispatch(assetId, prediction, opts = {}) {
    const failureProbability = prediction.failure_probability ?? prediction.anomaly_score ?? 0;
    const rulHours = prediction.rul_estimate_hours;
    const highProbability = failureProbability > 0.8;
    const shortRul = typeof rulHours === "number" && rulHours < 48;

    if (!highProbability && !shortRul) return { dispatched: false };

    const recent = await alertRepository.recentUnacknowledgedForAsset(assetId, AUTO_WO_COOLDOWN_MINUTES);
    if (recent.length > 0 && !opts.force) return { dispatched: false };

    const rootCause = prediction.root_cause || prediction.degradation_state || "Predicted failure mode";
    const reasonText = shortRul
        ? `RUL ${Math.round(rulHours)}h below 48h threshold — root cause: ${rootCause}`
        : `Failure probability ${(failureProbability * 100).toFixed(1)}% — root cause: ${rootCause}`;

    const workOrder = await maximoService.createLocalWorkOrder({
        assetId,
        description: `AUTOMATED: ML Failure Prediction — ${reasonText}`,
        priority: 1,
        createdBy: "ML_PREDICTION_SERVICE",
        generateType: "AUTO_ML_PREDICTION",
    });

    const alertId = await alertRepository.createAlert(assetId, "critical", `Predictive alert — ${reasonText}`, {
        wonum: workOrder.wonum,
        ruleReason: reasonText,
    });
    const alert = await alertRepository.getAlertById(alertId);

    const io = global.io;
    if (io) {
        io.emit("alert:new", alert);
        io.emit("workorder:created", workOrder);
    }

    return { dispatched: true, workOrder, alert };
}

module.exports = {
    evaluateAsset,
    evaluateAndDispatch,
    evaluateMlPredictionAndDispatch,
    thresholdsFor,
    mapAssetType,
};
