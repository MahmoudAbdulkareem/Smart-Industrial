import os
import json
import uuid
import pyodbc
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_DATABASE = os.getenv("DB_DATABASE", "SmartDashboard")
DB_USER = os.getenv("DB_USER", "dashboarduser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Dashboard@2026")

WINDOW_SIZE = int(os.getenv("ANOMALY_WINDOW_SIZE", "144"))
CONTAMINATION = float(os.getenv("IF_CONTAMINATION", "0.05"))
MODEL_NAME = "telemetry_isolation_forest"
MODEL_VERSION = os.getenv("MODEL_VERSION", "2.0.0")
MAXIMO_SITE_ID = os.getenv("MAXIMO_SITE_ID", "BEDFORD")


def build_connection():
    connection_string = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER},{DB_PORT};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};PWD={DB_PASSWORD};"
        f"TrustServerCertificate=yes;Encrypt=no;"
    )
    return pyodbc.connect(connection_string, autocommit=False)


def ensure_model_registered(connection):
    cursor = connection.cursor()
    cursor.execute(
        "SELECT id FROM ml_model_registry WHERE model_name = ? AND model_version = ?",
        MODEL_NAME, MODEL_VERSION,
    )
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        """
        INSERT INTO ml_model_registry (model_name, model_version, algorithm, artifact_path)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?)
        """,
        MODEL_NAME, MODEL_VERSION, "IsolationForest", "ml-service/pipeline/anomaly_pipeline.py",
    )
    model_id = cursor.fetchone()[0]
    connection.commit()
    return model_id


def load_asset_ids(connection):
    cursor = connection.cursor()
    cursor.execute("SELECT DISTINCT asset_id FROM telemetry_raw")
    return [row[0] for row in cursor.fetchall()]


def load_series(connection, asset_id):
    query = """
        SELECT recorded_at, rms, kurtosis, peak_to_peak
        FROM telemetry_raw
        WHERE asset_id = ?
        ORDER BY recorded_at ASC
    """
    frame = pd.read_sql(query, connection, params=[asset_id])
    frame["recorded_at"] = pd.to_datetime(frame["recorded_at"])
    frame = frame.set_index("recorded_at")
    frame = frame[~frame.index.duplicated(keep="last")].sort_index()
    return frame


def rolling_windows(frame):
    windows = []
    for start in range(0, len(frame) - WINDOW_SIZE + 1, WINDOW_SIZE):
        window = frame.iloc[start:start + WINDOW_SIZE]
        windows.append(window)
    return windows


def infer_seconds_per_row(index):
    if len(index) < 2:
        return 600.0
    diffs = index.to_series().diff().dropna().dt.total_seconds()
    median_diff = float(diffs.median())
    return median_diff if median_diff > 0 else 600.0


def estimate_rul_hours(anomaly_scores, seconds_per_row):
    if len(anomaly_scores) < 2:
        return None
    trend = np.polyfit(np.arange(len(anomaly_scores)), anomaly_scores, 1)[0]
    if trend >= 0:
        return None
    current_score = anomaly_scores[-1]
    remaining = max(current_score - (-1.0), 0)
    hours_per_step = WINDOW_SIZE * seconds_per_row / 3600
    steps_remaining = remaining / abs(trend)
    return float(steps_remaining * hours_per_step)


def classify_degradation(anomaly_score, all_scores):
    percentile = float((all_scores <= anomaly_score).sum()) / len(all_scores)
    if percentile <= CONTAMINATION:
        return "CRITICAL"
    if percentile <= CONTAMINATION * 3:
        return "WARNING"
    return "NORMAL"


def persist_inference(connection, model_id, asset_id, window, anomaly_score, anomaly_flag, degradation_state, rul_hours):
    cursor = connection.cursor()
    cursor.execute(
        """
        INSERT INTO ml_inference_results
            (asset_id, model_id, window_start, window_end, trend_component, seasonal_component,
             residual_component, anomaly_score, anomaly_flag, degradation_state, rul_estimate_hours)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        asset_id, model_id, window.index[0], window.index[-1],
        None, None, float(window["rms"].std()),
        float(anomaly_score), int(anomaly_flag), degradation_state, rul_hours,
    )
    inference_id = cursor.fetchone()[0]
    connection.commit()
    return inference_id


def build_maximo_payload(asset_id, assetnum, inference_id, degradation_state, anomaly_score):
    wonum = f"WO-{uuid.uuid4().hex[:10].upper()}"
    priority = 1 if degradation_state == "CRITICAL" else 2
    payload = {
        "wonum": wonum,
        "assetnum": assetnum,
        "siteid": MAXIMO_SITE_ID,
        "description": f"Automated anomaly detection for asset {asset_id}",
        "worktype": "CM",
        "priority": priority,
        "wopriority": priority,  # Maximo's visible "Priority" field is often bound to
                                  # wopriority rather than priority — send both so it
                                  # populates regardless of the org's field mapping.
        "status": "WAPPR",
        "reportedby": "ML_ANOMALY_SERVICE",
        "failurecode": "ML_DETECTED",
        "anomaly_score": anomaly_score,
        "source_inference_id": inference_id,
    }
    return wonum, payload


def trigger_work_order(connection, asset_id, inference_id, degradation_state, anomaly_score):
    cursor = connection.cursor()
    cursor.execute("SELECT assetnum FROM maximo_assets WHERE asset_id = ?", asset_id)
    row = cursor.fetchone()
    if row is None:
        assetnum = asset_id
        print(f"WARNING: no maximo_assets mapping for {asset_id} — auto-registering with "
              f"assetnum='{assetnum}' as a PLACEHOLDER. This will be rejected by Maximo "
              f"(BMXAA0090E) until you UPDATE maximo_assets SET assetnum='<real>' for this asset_id.")
        cursor.execute(
            "INSERT INTO maximo_assets (asset_id, assetnum, siteid, description) VALUES (?, ?, ?, ?)",
            asset_id, assetnum, MAXIMO_SITE_ID, f"Auto-registered asset {asset_id}",
        )
        connection.commit()
    else:
        assetnum = row[0]

    wonum, payload = build_maximo_payload(asset_id, assetnum, inference_id, degradation_state, anomaly_score)

    cursor.execute(
        """
        INSERT INTO maximo_workorders
            (wonum, asset_id, assetnum, siteid, description, worktype, priority, status,
             reported_by, generate_type, source_inference_id, mif_payload)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        wonum, asset_id, assetnum, payload["siteid"], payload["description"], payload["worktype"],
        payload["priority"], payload["status"], payload["reportedby"], "AUTO_ML_PREDICTION", inference_id, json.dumps(payload),
    )
    workorder_id = cursor.fetchone()[0]

    cursor.execute(
        """
        INSERT INTO maximo_sync_log
            (entity_type, entity_local_id, direction, sync_status, endpoint, request_payload)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        "WORKORDER", workorder_id, "OUTBOUND", "PENDING",
        "/oslc/os/mxapiwo", json.dumps(payload),
    )
    connection.commit()
    return wonum


def process_asset(connection, model_id, asset_id):
    frame = load_series(connection, asset_id)
    if len(frame) < WINDOW_SIZE * 2:
        print(f"Not enough data for asset {asset_id}, skipping")
        return

    seconds_per_row = infer_seconds_per_row(frame.index)
    windows = rolling_windows(frame)
    if not windows:
        return

    feature_matrix = np.array([
        [w["rms"].std(), w["rms"].mean(), w["kurtosis"].mean(), w["peak_to_peak"].mean()]
        for w in windows
    ])

    scaler = StandardScaler()
    scaled_matrix = scaler.fit_transform(feature_matrix)

    model = IsolationForest(n_estimators=200, contamination=CONTAMINATION, random_state=42)
    model.fit(scaled_matrix)

    anomaly_scores = model.score_samples(scaled_matrix)
    predictions = model.predict(scaled_matrix)

    for index, window in enumerate(windows):
        anomaly_score = float(anomaly_scores[index])
        anomaly_flag = predictions[index] == -1
        degradation_state = classify_degradation(anomaly_score, anomaly_scores)
        rul_hours = estimate_rul_hours(anomaly_scores[:index + 1], seconds_per_row)

        inference_id = persist_inference(
            connection, model_id, asset_id, window, anomaly_score, anomaly_flag, degradation_state, rul_hours
        )

        if anomaly_flag and degradation_state in ("WARNING", "CRITICAL"):
            wonum = trigger_work_order(connection, asset_id, inference_id, degradation_state, anomaly_score)
            print(f"Asset {asset_id}: anomaly detected, work order {wonum} created")


def run_pipeline():
    connection = build_connection()
    model_id = ensure_model_registered(connection)
    asset_ids = load_asset_ids(connection)

    for asset_id in asset_ids:
        process_asset(connection, model_id, asset_id)

    connection.close()


if __name__ == "__main__":
    run_pipeline()
