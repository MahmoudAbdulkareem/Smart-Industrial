"""
═══════════════════════════════════════════════════════════════
main.py  —  FastAPI ML Prediction Service
═══════════════════════════════════════════════════════════════

WHAT THIS FILE DOES:
    A standalone microservice that loads the 4 trained model files
    at startup and exposes a single prediction endpoint:

        POST /predict
        Body:     { asset_id, vibration, temperature, pressure }
        Response: { health_score, rul, status, anomaly_detected, ... }

    Also exposes:
        GET /          — service info
        GET /health    — checks all 4 models are loaded

WHY A SEPARATE SERVICE (not part of the Node.js backend)?
    1. Different language ecosystem — Python for ML, Node.js for the API.
    2. Independent scaling — if predictions become slow, scale this
       service alone without redeploying the whole backend.
    3. Clear separation of concerns — the Node.js backend doesn't need
       to know HOW health scores are computed, only that it can POST
       sensor values and get a score back.

STARTUP REQUIREMENT:
    The 4 .pkl files (model.pkl, scaler.pkl, rul_model.pkl, rul_scaler.pkl)
    must exist in the same directory. Run `python train.py` first.
"""

import os
import pickle
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Create the FastAPI application ──────────────────────────────────────────
app = FastAPI(
    title="Smart Dashboard ML Service",
    version="2.0.0",
    description="Anomaly detection (Isolation Forest) and RUL prediction (Linear Regression)",
)

# ── CORS middleware ───────────────────────────────────────────────────────────
# Allows the Node.js backend (and, during development, the browser directly)
# to call this service without CORS errors.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # in production restrict to known origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global model variables ────────────────────────────────────────────────────
# Initialized to None. Populated by load_models() on startup.
# Declaring them at module level (rather than inside load_models only)
# means every function in this file can reference them after startup.
model      = None  # Isolation Forest
scaler     = None  # MinMaxScaler for [vibration, temperature, pressure]
rul_model  = None  # Linear Regression for RUL
rul_scaler = None  # MinMaxScaler for [vibration, temperature, pressure, health_score]


# ── ASSET_BOOSTS — per-asset health score calibration offsets ─────────────────
# Different asset types have naturally different "normal" Isolation Forest
# scores because their sensor ranges differ (a conveyor runs hotter than
# a compressor by design, not because it's unhealthy).
# These offsets shift the calibrated health score so that "normal operation"
# for EVERY asset type lands in a similar healthy range (70-95).
#   AST-003 (conveyor, naturally runs hot/vibratey) gets -10
#   AST-001 (compressor, naturally calm) gets +15
ASSET_BOOSTS = {
    "AST-001": 15,   # Compressor — calm baseline, boost up
    "AST-002": 5,    # Pump — moderate baseline
    "AST-003": -10,  # Conveyor — naturally high vibration/temp, reduce boost
    "AST-004": 10,   # HVAC — calm baseline
    "AST-005": 0,    # Motor — neutral baseline
}

# ── Score calibration constants ────────────────────────────────────────────────
# These bounds come from observing the raw Isolation Forest scores on the
# training data (see train.py output). They define the linear mapping
# from raw IF scores to the 0-100 health percentage.
SCORE_MIN = -0.67  # raw score corresponding to 0% health
SCORE_MAX = -0.44  # raw score corresponding to 100% health


# ═══════════════════════════════════════════════════════════════
# Pydantic request/response models
# ═══════════════════════════════════════════════════════════════

class PredictRequest(BaseModel):
    """
    Defines the expected shape of the POST /predict request body.
    FastAPI automatically validates incoming JSON against this model.
    If a field is missing or has the wrong type, FastAPI returns a
    422 Unprocessable Entity error WITHOUT running our function —
    we never have to write manual validation code.
    """
    asset_id:    str    # e.g. "AST-001"
    vibration:   float  # mm/s
    temperature: float  # °C
    pressure:    float  # bar


class PredictResponse(BaseModel):
    """
    Defines the shape of the response. FastAPI uses this to:
      1. Validate that our function returns the right shape
      2. Generate the OpenAPI documentation automatically
    """
    asset_id:         str
    health_score:     float
    rul:              float
    status:           str
    anomaly_detected: bool
    model_version:    str


# ═══════════════════════════════════════════════════════════════
# Startup event — load models from disk
# ═══════════════════════════════════════════════════════════════

@app.on_event("startup")
def load_models():
    """
    Runs ONCE when the FastAPI server starts, before accepting
    any requests ("fail fast" pattern).

    If any .pkl file is missing, raises RuntimeError which PREVENTS
    the server from starting. This is intentional — better to crash
    loudly at startup with a clear message than to silently return
    broken predictions once a request arrives.
    """
    global model, scaler, rul_model, rul_scaler

    # ── Check all 4 files exist before attempting to load any ──────────────
    required_files = ["model.pkl", "scaler.pkl", "rul_model.pkl", "rul_scaler.pkl"]

    # List comprehension: build a list of filenames that DON'T exist.
    missing = [f for f in required_files if not os.path.exists(f)]

    if missing:
        raise RuntimeError(
            f"Missing model files: {missing}. Run 'python train.py' first."
        )

    # ── Load each model file ────────────────────────────────────────────────
    # "with open(...) as f" automatically closes the file afterward,
    # even if an error occurs while reading.
    # pickle.load() deserializes the binary data back into the original
    # Python/scikit-learn object with all its trained parameters intact.
    with open("model.pkl", "rb") as f:
        model = pickle.load(f)

    with open("scaler.pkl", "rb") as f:
        scaler = pickle.load(f)

    with open("rul_model.pkl", "rb") as f:
        rul_model = pickle.load(f)

    with open("rul_scaler.pkl", "rb") as f:
        rul_scaler = pickle.load(f)

    print("[Startup] All 4 ML models loaded successfully.")


# ═══════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root():
    """
    Root endpoint — simple service info.
    Useful for quickly checking the service is reachable.
    """
    return {
        "service": "Smart Dashboard ML Service",
        "version": "2.0.0",
        "status":  "running",
    }


@app.get("/health")
def health_check():
    """
    Health check endpoint — used by Docker's HEALTHCHECK directive
    and by mqtt.js's callMLService() implicitly (via the /predict
    timeout/fallback logic).

    Returns models_loaded: true only if all 4 globals are non-None,
    meaning load_models() ran successfully at startup.
    """
    models_loaded = all([
        model      is not None,
        scaler     is not None,
        rul_model  is not None,
        rul_scaler is not None,
    ])

    return {
        "status":        "ok" if models_loaded else "degraded",
        "models_loaded": models_loaded,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    The core prediction endpoint.

    INPUT (validated by Pydantic):
        { "asset_id": "AST-001", "vibration": 1.2, "temperature": 45, "pressure": 2.5 }

    PROCESSING PIPELINE:
        1. Scale the 3 sensor values with the IF scaler
        2. Run Isolation Forest → raw anomaly score + label
        3. Calibrate raw score → health_score (0-100) with per-asset offset
        4. Scale [vib, temp, pres, health_score] with the RUL scaler
        5. Run Linear Regression → predicted RUL in days
        6. Determine status (healthy/caution/critical) from health_score

    OUTPUT (validated against PredictResponse):
        { "asset_id": "AST-001", "health_score": 87.5, "rul": 398.0,
          "status": "healthy", "anomaly_detected": false, "model_version": "2.0.0" }
    """

    # ── Guard: models must be loaded ────────────────────────────────────────
    # This should never trigger if load_models() succeeded at startup,
    # but it is a defensive check in case something went wrong.
    if model is None or scaler is None or rul_model is None or rul_scaler is None:
        raise HTTPException(status_code=503, detail="Models not loaded")

    # ═══════════════════════════════════════════════════════════
    # STEP 1 — Anomaly detection with Isolation Forest
    # ═══════════════════════════════════════════════════════════

    # Build a 2D numpy array with shape (1, 3) — one row, three columns.
    # scikit-learn ALWAYS expects 2D input, even for a single sample.
    # The double brackets [[...]] create this 2D shape.
    features = np.array([[req.vibration, req.temperature, req.pressure]])

    # Apply the SAME MinMaxScaler that was fitted during training.
    # This maps the raw sensor values to the same [0,1] range the
    # Isolation Forest was trained on.
    scaled_if = scaler.transform(features)

    # model.predict() returns an array; [0] extracts the single value.
    # Result is +1 (normal) or -1 (anomaly).
    prediction = model.predict(scaled_if)[0]

    # model.score_samples() returns the raw anomaly score — a continuous
    # value (typically between -0.7 and -0.4). More negative = more anomalous.
    # We need this raw score (not just the binary label) to calibrate
    # a smooth 0-100 health percentage.
    raw_score = model.score_samples(scaled_if)[0]

    # ═══════════════════════════════════════════════════════════
    # STEP 2 — Calibrate raw score → health_score (0-100)
    # ═══════════════════════════════════════════════════════════

    # Clamp the raw score to the known range [SCORE_MIN, SCORE_MAX].
    # Extreme readings could produce scores outside this range —
    # clamping prevents the health_score from going below 0 or above 100
    # before the asset-specific offset is applied.
    clamped = max(SCORE_MIN, min(SCORE_MAX, raw_score))

    # Linear interpolation (min-max scaling formula):
    #   health_score = (clamped - SCORE_MIN) / (SCORE_MAX - SCORE_MIN) * 100
    # When clamped == SCORE_MIN → health_score = 0
    # When clamped == SCORE_MAX → health_score = 100
    health_score = ((clamped - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100

    # Apply the per-asset calibration offset.
    # .get(req.asset_id, 0): if asset_id is not in ASSET_BOOSTS, default to 0.
    health_score += ASSET_BOOSTS.get(req.asset_id, 0)

    # ── Anomaly override ────────────────────────────────────────────────────
    # If Isolation Forest flagged this as an anomaly (-1) but the calibrated
    # score is still showing "healthy" territory (>30), force it down into
    # the critical range. This ensures anomalies are ALWAYS reflected as
    # critical in the dashboard, even if the calibration math alone
    # wouldn't push it that low.
    if prediction == -1 and health_score > 30:
        # np.random.uniform(10, 30) picks a random value in the critical
        # range — adds slight variation so repeated anomalies don't all
        # show exactly the same score.
        health_score = float(np.random.uniform(10, 30))

    # ── Final clamp and rounding ─────────────────────────────────────────────
    # Ensure health_score is strictly within [0, 100] and round to 1 decimal.
    health_score = max(0.0, min(100.0, round(health_score, 1)))

    # ═══════════════════════════════════════════════════════════
    # STEP 3 — RUL prediction with Linear Regression
    # ═══════════════════════════════════════════════════════════

    # Build the 4-feature input: the 3 raw sensors PLUS the health_score
    # we just computed. Including health_score significantly improves
    # RUL accuracy because it already encodes the combined effect of
    # all three sensors relative to this asset's calibration.
    rul_features = np.array([[req.vibration, req.temperature, req.pressure, health_score]])

    # Scale with the SEPARATE RUL scaler (4 features, different range
    # than the 3-feature IF scaler).
    rul_scaled = rul_scaler.transform(rul_features)

    # Predict RUL in days. [0] extracts the single prediction value.
    # float() converts from numpy float64 to a plain Python float
    # (numpy types don't serialize cleanly to JSON).
    rul_raw = float(rul_model.predict(rul_scaled)[0])

    # Linear regression can occasionally predict negative values for
    # extreme inputs (e.g. very degraded machines). max(0.0, ...) clamps
    # this to zero — "0 days remaining" makes sense, "-15 days" does not.
    rul = round(max(0.0, rul_raw), 1)

    # ═══════════════════════════════════════════════════════════
    # STEP 4 — Determine status from health_score
    # ═══════════════════════════════════════════════════════════

    # Thresholds match the React frontend's color coding:
    #   green (healthy)  >= 70
    #   amber (caution)  40-69
    #   red   (critical) < 40
    if health_score >= 70:
        status = "healthy"
    elif health_score >= 40:
        status = "caution"
    else:
        status = "critical"

    # ═══════════════════════════════════════════════════════════
    # Return the response — FastAPI validates against PredictResponse
    # ═══════════════════════════════════════════════════════════

    return PredictResponse(
        asset_id=req.asset_id,
        health_score=health_score,
        rul=rul,
        status=status,
        # bool(prediction == -1): True if Isolation Forest flagged this
        # as an anomaly (-1), False if normal (+1).
        anomaly_detected=bool(prediction == -1),
        model_version="2.0.0",
    )
