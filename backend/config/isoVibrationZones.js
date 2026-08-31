// config/isoVibrationZones.js
//
// Single source of truth for vibration severity in mm/s RMS, aligned with
// ISO 10816-3 Zone A/B/C/D boundaries for small/medium Class I-II rotating
// machinery. Used by:
//   - services/ruleEngineService.js (Healthy/Caution/Critical decisioning)
//   - controllers/assetsController.js (exposes zones to the frontend so the
//     dashboard, ML view, and MQTT monitor all render the same bands)
//
// Zone A (Good):        0.0 – 1.4 mm/s  — newly commissioned condition
// Zone B (Allowable):   1.4 – 2.8 mm/s  — unrestricted long-term operation
// Zone C (Tolerable):   2.8 – 4.5 mm/s  — degraded, restricted operation / plan maintenance
// Zone D (Unacceptable): > 4.5 mm/s     — vibration causes damage, stop and inspect
//
// The 3-state rule engine collapses these into:
//   Healthy  = Zone A + Zone B  (< 2.8 mm/s)
//   Caution  = Zone C           (2.8 – 4.5 mm/s)
//   Critical = Zone D           (> 4.5 mm/s)

const ISO_VIBRATION_ZONES = [
    { id: "good", labelKey: "isoZoneGood", min: 0.0, max: 1.4, color: "#22c55e" },
    { id: "allowable", labelKey: "isoZoneAllowable", min: 1.4, max: 2.8, color: "#84cc16" },
    { id: "tolerable", labelKey: "isoZoneTolerable", min: 2.8, max: 4.5, color: "#f59e0b" },
    { id: "unacceptable", labelKey: "isoZoneUnacceptable", min: 4.5, max: null, color: "#ef4444" },
];

const VIBRATION_WARN_MM_S = 2.8;   // Zone B/C boundary -> Caution
const VIBRATION_MAX_MM_S = 4.5;    // Zone C/D boundary -> Critical

function zoneForVibration(vibrationMmS) {
    if (vibrationMmS === null || vibrationMmS === undefined || Number.isNaN(vibrationMmS)) return null;
    return (
        ISO_VIBRATION_ZONES.find(
            (z) => vibrationMmS >= z.min && (z.max === null || vibrationMmS < z.max)
        ) || ISO_VIBRATION_ZONES[ISO_VIBRATION_ZONES.length - 1]
    );
}

module.exports = {
    ISO_VIBRATION_ZONES,
    VIBRATION_WARN_MM_S,
    VIBRATION_MAX_MM_S,
    zoneForVibration,
};
