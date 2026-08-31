import os
import pickle
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SmartDashboard ML Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.getenv("MODEL_PATH", "model.pkl")
SCALER_PATH = os.getenv("SCALER_PATH", "scaler.pkl")
RUL_MODEL_PATH = os.getenv("RUL_MODEL_PATH", "rul_model.pkl")
RUL_SCALER_PATH = os.getenv("RUL_SCALER_PATH", "rul_scaler.pkl")

model = None
scaler = None
rul_model = None
rul_scaler = None


def load_artifacts():
    global model, scaler, rul_model, rul_scaler
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
    if os.path.exists(SCALER_PATH):
        with open(SCALER_PATH, "rb") as f:
            scaler = pickle.load(f)
    if os.path.exists(RUL_MODEL_PATH):
        with open(RUL_MODEL_PATH, "rb") as f:
            rul_model = pickle.load(f)
    if os.path.exists(RUL_SCALER_PATH):
        with open(RUL_SCALER_PATH, "rb") as f:
            rul_scaler = pickle.load(f)


load_artifacts()


class PredictRequest(BaseModel):
    asset_id: str
    vibration: float = 0.0
    temperature: float = 0.0
    rms: float = 0.0
    kurtosis: float = 0.0
    peak_to_peak: float = 0.0
    pressure: float = 0.0


def degradation_from_score(anomaly_score):
    normalized = max(0.0, min(1.0, (0.5 - anomaly_score)))
    if normalized >= 0.80:
        return "CRITICAL"
    if normalized >= 0.55:
        return "WARNING"
    return "NORMAL"


def health_score_from_anomaly_score(anomaly_score):
    normalized = max(0.0, min(1.0, anomaly_score + 0.5))
    return round(normalized * 100, 1)


@app.get("/health")
def health():
    return {
        "status": "ok" if model is not None else "degraded",
        "model_loaded": model is not None,
        "rul_model_loaded": rul_model is not None,
    }


@app.post("/predict")
def predict(request: PredictRequest):
    feature_vector = np.array([[
        request.vibration,
        request.temperature,
        request.rms,
        request.kurtosis,
        request.peak_to_peak,
    ]])

    if model is None or scaler is None:
        fallback_score = -0.1 if request.vibration > 4.0 or request.temperature > 90 else 0.1
        return {
            "asset_id": request.asset_id,
            "anomaly_score": fallback_score,
            "anomaly_detected": fallback_score < 0,
            "degradation_state": degradation_from_score(fallback_score),
            "health_score": health_score_from_anomaly_score(fallback_score),
            "rul": None,
            "status": degradation_from_score(fallback_score).lower(),
            "source": "fallback_heuristic",
        }

    scaled_vector = scaler.transform(feature_vector)
    anomaly_score = float(model.score_samples(scaled_vector)[0])
    prediction = int(model.predict(scaled_vector)[0])
    degradation_state = degradation_from_score(anomaly_score)

    rul_hours = None
    if rul_model is not None and rul_scaler is not None:
        rul_feature_vector = np.array([[0.0, anomaly_score]])
        rul_scaled = rul_scaler.transform(rul_feature_vector)
        rul_hours = float(rul_model.predict(rul_scaled)[0])

    return {
        "asset_id": request.asset_id,
        "anomaly_score": anomaly_score,
        "anomaly_detected": prediction == -1,
        "degradation_state": degradation_state,
        "health_score": health_score_from_anomaly_score(anomaly_score),
        "rul": rul_hours,
        "status": degradation_state.lower(),
        "source": "model",
    }
