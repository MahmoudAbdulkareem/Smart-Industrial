import os
import numpy as np
import pandas as pd

OUTPUT_PATH = os.getenv("DATASET_OUTPUT_PATH", "bearing_telemetry_dataset.csv")
SAMPLES_PER_DAY = 144
RUN_DAYS = 34
START_TIMESTAMP = pd.Timestamp("2003-10-22 12:06:24")

# Vibration Velocity severity zones — ISO 10816-3, Class I/II small-medium
# rotating machinery (mm/s RMS). Must stay in sync with
# backend/config/isoVibrationZones.js — that file is the source of truth for
# the rule engine and frontend; this generator targets the same bands so a
# demo/generated dataset actually walks Healthy -> Caution -> Critical.
#   Zone A (Good):        0.0 – 1.4 mm/s
#   Zone B (Allowable):   1.4 – 2.8 mm/s
#   Zone C (Tolerable):   2.8 – 4.5 mm/s
#   Zone D (Unacceptable): > 4.5 mm/s
VIBRATION_WARN_MM_S = 2.8
VIBRATION_MAX_MM_S = 4.5

ASSET_PROFILES = {
    # asset_type drives which channel dominates the failure signature, per the
    # rule-engine's per-asset-type thresholds (rotating/thermal/hydraulic).
    # baseline_vibration_mm_s: healthy operating point (Zone A/B, ~0.5-1.2 mm/s).
    # peak_vibration_mm_s: value reached once the asset is deep in Zone D at
    # end of run, i.e. what an untreated critical alert escalates to.
    "AST-001": {"baseline_vibration_mm_s": 0.6, "peak_vibration_mm_s": 6.5, "failure_onset_day": 19, "failure_sharpness": 3.2, "seed": 101,
                "asset_type": "ROTATING_EQUIPMENT", "baseline_temp": 58, "baseline_pressure": 6.0},
    "AST-002": {"baseline_vibration_mm_s": 0.75, "peak_vibration_mm_s": 7.2, "failure_onset_day": 13, "failure_sharpness": 3.6, "seed": 202,
                "asset_type": "ROTATING_EQUIPMENT", "baseline_temp": 55, "baseline_pressure": 7.0},
    "AST-003": {"baseline_vibration_mm_s": 0.5, "peak_vibration_mm_s": 5.8, "failure_onset_day": 16, "failure_sharpness": 3.0, "seed": 303,
                "asset_type": "ROTATING_EQUIPMENT", "baseline_temp": 50, "baseline_pressure": 5.5},
    "AST-004": {"baseline_vibration_mm_s": 0.65, "peak_vibration_mm_s": 6.0, "failure_onset_day": 15, "failure_sharpness": 3.4, "seed": 404,
                "asset_type": "THERMAL_PROCESS",    "baseline_temp": 70, "baseline_pressure": 8.0},
    "AST-005": {"baseline_vibration_mm_s": 0.55, "peak_vibration_mm_s": 6.8, "failure_onset_day": 21, "failure_sharpness": 3.1, "seed": 505,
                "asset_type": "ROTATING_EQUIPMENT", "baseline_temp": 56, "baseline_pressure": 6.5},
}


def simulate_asset(asset_id, profile, timestamps):
    rng = np.random.default_rng(profile["seed"])
    total_samples = len(timestamps)
    day_index = np.arange(total_samples) / SAMPLES_PER_DAY

    onset = profile["failure_onset_day"]
    sharpness = profile["failure_sharpness"]
    degradation = 1.0 / (1.0 + np.exp(-sharpness * (day_index - onset - 8)))
    degradation = degradation / degradation.max()

    # ── Vibration Velocity (mm/s RMS) — the value actually shown on the
    # dashboard and evaluated against ISO 10816 zones. Interpolates from a
    # healthy baseline (Zone A/B) up to a peak deep in Zone D as degradation
    # progresses, with a slow seasonal wobble and measurement noise on top. ──
    baseline_v = profile["baseline_vibration_mm_s"]
    peak_v = profile["peak_vibration_mm_s"]
    vib_seasonal = 0.04 * baseline_v * np.sin(2 * np.pi * day_index)
    vib_noise = rng.normal(0, baseline_v * 0.08, total_samples)
    vibration = baseline_v + (peak_v - baseline_v) * degradation + vib_seasonal + vib_noise
    vibration = np.clip(vibration, 0.15, None).round(3)

    # ── Internal unitless bearing-signal RMS — feeds the Isolation Forest
    # feature set (kurtosis, peak-to-peak) in pipeline/anomaly_pipeline.py.
    # Kept separate from the displayed mm/s vibration on purpose: this is a
    # normalized rolling-window statistic, not a physical unit, and rescaling
    # it would silently change the trained model's feature distribution. ──
    internal_baseline_rms = 0.08
    seasonal = 0.03 * internal_baseline_rms * np.sin(2 * np.pi * day_index)
    trend = internal_baseline_rms * (1.0 + 6.0 * degradation)
    noise = rng.normal(0, internal_baseline_rms * 0.06, total_samples)
    rms = np.clip(trend + seasonal + noise, 0.02, None)

    kurtosis_baseline = rng.normal(3.0, 0.15, total_samples)
    kurtosis = kurtosis_baseline + degradation * rng.uniform(4.0, 9.0, total_samples)

    peak_to_peak = rms * rng.uniform(3.5, 5.5, total_samples) * (1.0 + 0.5 * degradation)

    # ── Temperature: rises with friction/degradation (bearing/motor heating). ──
    temp_noise = rng.normal(0, 1.2, total_samples)
    temp_daily_cycle = 2.0 * np.sin(2 * np.pi * day_index)  # ambient day/night swing
    temperature = profile["baseline_temp"] + temp_daily_cycle + degradation * rng.uniform(28, 40) + temp_noise
    temperature = np.clip(temperature, profile["baseline_temp"] - 5, None)

    # ── Pressure: drifts as seals/bearings wear; thermal assets are pressure-heavy. ──
    pressure_gain = rng.uniform(4.5, 6.5) if profile["asset_type"] == "THERMAL_PROCESS" else rng.uniform(2.5, 4.0)
    pressure_noise = rng.normal(0, 0.15, total_samples)
    pressure = profile["baseline_pressure"] + degradation * pressure_gain + pressure_noise
    pressure = np.clip(pressure, 0.5, None)

    frame = pd.DataFrame({
        "asset_id": asset_id,
        "recorded_at": timestamps,
        "vibration": vibration.round(5),
        "temperature": temperature.round(2),
        "pressure": pressure.round(3),
        "rms": rms.round(5),
        "kurtosis": kurtosis.round(5),
        "peak_to_peak": peak_to_peak.round(5),
    })
    return frame


def generate():
    total_samples = SAMPLES_PER_DAY * RUN_DAYS
    timestamps = pd.date_range(start=START_TIMESTAMP, periods=total_samples, freq="10min")

    frames = []
    for asset_id, profile in ASSET_PROFILES.items():
        frames.append(simulate_asset(asset_id, profile, timestamps))

    dataset = pd.concat(frames, ignore_index=True)
    dataset = dataset.sort_values(["asset_id", "recorded_at"]).reset_index(drop=True)
    dataset.to_csv(OUTPUT_PATH, index=False)
    print(f"Generated {len(dataset)} rows across {len(ASSET_PROFILES)} assets -> {OUTPUT_PATH}")


if __name__ == "__main__":
    generate()
