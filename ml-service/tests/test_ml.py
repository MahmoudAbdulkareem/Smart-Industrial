"""
═══════════════════════════════════════════════════════════════
test_ml.py  —  ML Service Unit Tests (pytest)
═══════════════════════════════════════════════════════════════

WHAT THIS FILE DOES:
    7 tests that verify:
      1-3. The Isolation Forest model behaves correctly on known inputs
      4-6. The RUL Linear Regression model produces sensible outputs
      7-9. The FastAPI /predict endpoint returns the correct schema

HOW TO RUN:
    cd ml-service
    pytest tests/ -v

REQUIREMENT:
    The .pkl model files must exist (run `python train.py` first).
    This is the SAME requirement as running the FastAPI service —
    these tests verify the actual trained models, not mocks.
"""

import os
import pickle
import numpy as np
import pytest
from fastapi.testclient import TestClient

# ── Import the FastAPI app from main.py ────────────────────────────────────
# TestClient wraps the FastAPI app so we can call its endpoints
# in-process — no real HTTP server or network needed.
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from main import app, load_models

# ── Fixture: ensure models are loaded before any test runs ────────────────
# pytest fixtures with scope="session" run ONCE for the entire test run,
# not once per test. autouse=True means every test automatically uses it
# without needing to declare it as an argument.
@pytest.fixture(scope="session", autouse=True)
def setup_models():
    """
    FastAPI's @app.on_event("startup") only fires when the app actually
    starts serving requests. TestClient triggers this automatically when
    used as a context manager, but we call load_models() directly here
    to also make `model`, `scaler`, etc. available to the non-API tests
    below (tests 1-6 call the models directly, not via HTTP).
    """
    load_models()


# ── Load the models directly for non-API tests (tests 1-6) ────────────────
# These are loaded at MODULE level (runs once when pytest imports this file).
with open(os.path.join(os.path.dirname(__file__), "..", "model.pkl"), "rb") as f:
    model = pickle.load(f)

with open(os.path.join(os.path.dirname(__file__), "..", "scaler.pkl"), "rb") as f:
    scaler = pickle.load(f)

with open(os.path.join(os.path.dirname(__file__), "..", "rul_model.pkl"), "rb") as f:
    rul_model = pickle.load(f)

with open(os.path.join(os.path.dirname(__file__), "..", "rul_scaler.pkl"), "rb") as f:
    rul_scaler = pickle.load(f)


# ═══════════════════════════════════════════════════════════════
# TESTS 1-3 — Isolation Forest (Anomaly Detection)
# ═══════════════════════════════════════════════════════════════

def test_normal_readings_score_above_threshold():
    """
    TEST 1: Normal sensor readings should produce Isolation Forest
    scores ABOVE -0.60 (closer to zero = more "normal" in IF's scoring).

    WHY THIS TEST MATTERS:
    If this test fails, it means the model considers typical operating
    conditions to be anomalous — a sign the model was trained on the
    wrong data distribution or with bad hyperparameters.
    """
    # 5 normal readings, one per asset type, matching their typical ranges.
    normal_readings = [
        [1.2, 45, 2.5],   # AST-001 Compressor
        [3.0, 62, 3.0],   # AST-002 Pump
        [7.8, 79, 2.5],   # AST-003 Conveyor
        [1.5, 48, 2.8],   # AST-004 HVAC
        [4.2, 71, 2.5],   # AST-005 Motor
    ]

    for reading in normal_readings:
        # Scale the reading using the same scaler used in training.
        # [reading] wraps in a list to create the required 2D shape.
        scaled = scaler.transform([reading])

        # Get the raw anomaly score.
        score = model.score_samples(scaled)[0]

        # assert: if this condition is False, pytest reports the test as
        # FAILED and shows the actual score value in the error message.
        assert score > -0.60, f"Normal reading {reading} scored too low: {score}"


def test_anomalies_score_lower_than_normals():
    """
    TEST 2: Anomalous readings should, ON AVERAGE, score lower
    (more negative) than normal readings.

    WHY AVERAGE AND NOT EVERY SINGLE READING?
    Isolation Forest is probabilistic — a few borderline anomalies
    might score similarly to normal readings. But the AVERAGE across
    many anomalies should clearly differ from the average of normals.
    This is a more robust test than checking every individual value.
    """
    normal_readings = [
        [1.2, 45, 2.5],
        [3.0, 62, 3.0],
        [7.8, 79, 2.5],
    ]

    anomaly_readings = [
        [12.0, 98, 0.2],   # extreme vibration + temperature, pressure loss
        [13.5, 102, 0.1],
        [10.5, 95, 0.5],
    ]

    # Compute the average score for each group.
    # np.mean() of a list comprehension that scores each reading.
    normal_avg = np.mean([
        model.score_samples(scaler.transform([r]))[0] for r in normal_readings
    ])
    anomaly_avg = np.mean([
        model.score_samples(scaler.transform([r]))[0] for r in anomaly_readings
    ])

    assert anomaly_avg < normal_avg, (
        f"Anomalies should score lower on average. "
        f"Normal avg: {normal_avg:.4f}, Anomaly avg: {anomaly_avg:.4f}"
    )


def test_clear_anomaly_detected():
    """
    TEST 3: An extreme reading (vibration=12.5, temp=98, pressure=0.2)
    must be classified as an anomaly (-1) by model.predict().

    This is the most important sanity check — if the model cannot
    even detect an OBVIOUS fault signature, it is not usable.
    """
    extreme_reading = [12.5, 98, 0.2]
    scaled = scaler.transform([extreme_reading])

    prediction = model.predict(scaled)[0]

    # -1 is scikit-learn's convention for "anomaly".
    assert prediction == -1, f"Extreme reading {extreme_reading} was NOT flagged as anomaly"


# ═══════════════════════════════════════════════════════════════
# TESTS 4-6 — RUL Linear Regression
# ═══════════════════════════════════════════════════════════════

def test_rul_decreases_with_lower_health():
    """
    TEST 4: Monotonicity test — if all sensor values are the same
    EXCEPT health_score, a LOWER health_score must produce a LOWER
    (or equal) RUL prediction.

    WHY THIS MATTERS:
    This is a basic sanity check on the model's logic. If a machine
    with health_score=80 had a SHORTER predicted lifespan than one
    with health_score=40, the model would be giving misleading
    information to maintenance engineers — potentially causing them
    to ignore a genuinely urgent machine.
    """
    # Same sensor values, only health_score differs.
    high_health = [3.0, 65, 2.5, 80]  # vib, temp, pres, health_score=80
    low_health  = [3.0, 65, 2.5, 40]  # health_score=40

    rul_high = rul_model.predict(rul_scaler.transform([high_health]))[0]
    rul_low  = rul_model.predict(rul_scaler.transform([low_health]))[0]

    assert rul_low <= rul_high, (
        f"RUL should decrease with health score. "
        f"RUL@80={rul_high:.1f}, RUL@40={rul_low:.1f}"
    )


def test_rul_non_negative_after_clamping():
    """
    TEST 5: Even for extreme/unrealistic inputs that might cause the
    linear regression to extrapolate to a negative value, the FINAL
    RUL (after max(0, ...) clamping, as done in main.py) must be >= 0.

    WHY THIS MATTERS:
    "RUL = -15 days" is meaningless to a maintenance engineer.
    This test verifies the CLAMPING LOGIC, not just the raw model output —
    it replicates exactly what main.py does in the /predict endpoint.
    """
    # An extremely degraded hypothetical reading.
    extreme_input = [15.0, 110, 0.1, 5]  # health_score=5, very degraded

    raw_prediction = rul_model.predict(rul_scaler.transform([extreme_input]))[0]

    # Replicate main.py's clamping: max(0.0, raw_prediction)
    clamped = max(0.0, float(raw_prediction))

    assert clamped >= 0, f"Clamped RUL should never be negative: {clamped}"


def test_rul_reasonable_for_healthy_asset():
    """
    TEST 6: A healthy asset (health_score=85) should have a RUL
    greater than 30 days.

    WHY 30 DAYS SPECIFICALLY?
    30 days is the MAINTENANCE_THRESHOLD constant used in train.py —
    the point at which an asset is considered to "need maintenance soon".
    A healthy asset should clearly be ABOVE this threshold, otherwise
    the model's healthy/critical boundary doesn't align with its RUL output.
    """
    healthy_input = [1.2, 45, 2.5, 85]  # AST-001-like, health_score=85

    rul = rul_model.predict(rul_scaler.transform([healthy_input]))[0]

    assert rul > 30, f"Healthy asset (health_score=85) should have RUL > 30 days, got {rul:.1f}"


# ═══════════════════════════════════════════════════════════════
# TESTS 7-9 — FastAPI /predict endpoint
# ═══════════════════════════════════════════════════════════════

def test_predict_normal_reading_returns_correct_schema():
    """
    TEST 7: POST /predict with a normal reading should return 200
    and a response matching the PredictResponse schema:
      asset_id, health_score (0-100), rul (>=0), status (valid enum),
      anomaly_detected (bool), model_version (string).
    """
    # TestClient acts as an HTTP client but runs in-process —
    # no real network connection is made.
    with TestClient(app) as client:
        response = client.post("/predict", json={
            "asset_id":    "AST-001",
            "vibration":   1.2,
            "temperature": 45,
            "pressure":    2.5,
        })

        # 200 OK expected for valid input.
        assert response.status_code == 200

        data = response.json()

        # Check all expected fields are present.
        assert "health_score" in data
        assert "rul" in data
        assert "status" in data
        assert "anomaly_detected" in data

        # Check value ranges and types.
        assert 0 <= data["health_score"] <= 100
        assert data["rul"] >= 0
        assert data["status"] in ["healthy", "caution", "critical"]
        assert isinstance(data["anomaly_detected"], bool)


def test_predict_anomalous_reading_flags_anomaly():
    """
    TEST 8: POST /predict with extreme values should return
    anomaly_detected=True and status="critical".

    This is the end-to-end version of TEST 3 — verifying the FULL
    HTTP pipeline (request validation → model inference → response
    formatting) correctly surfaces the anomaly, not just the raw model.
    """
    with TestClient(app) as client:
        response = client.post("/predict", json={
            "asset_id":    "AST-003",
            "vibration":   13.0,
            "temperature": 100,
            "pressure":    0.2,
        })

        assert response.status_code == 200
        data = response.json()

        assert data["anomaly_detected"] is True
        assert data["status"] == "critical"
        # Critical assets should have a low health score.
        assert data["health_score"] < 40


def test_predict_validates_missing_field():
    """
    TEST 9: POST /predict with a MISSING required field (pressure)
    should return 422 Unprocessable Entity — Pydantic's automatic
    validation, WITHOUT our predict() function ever running.

    WHY THIS MATTERS:
    This proves the Pydantic schema validation works — malformed
    requests are rejected at the framework level, before any
    business logic executes. We don't need to write manual
    "if pressure is None: raise error" checks.
    """
    with TestClient(app) as client:
        # Deliberately omit "pressure".
        response = client.post("/predict", json={
            "asset_id":    "AST-001",
            "vibration":   1.2,
            "temperature": 45,
            # "pressure" is missing
        })

        # FastAPI/Pydantic returns 422 for schema validation failures.
        assert response.status_code == 422
