import os
import pickle
import numpy as np
import pyodbc
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler
from sklearn.linear_model import LinearRegression

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_DATABASE = os.getenv("DB_DATABASE", "SmartDashboard")
DB_USER = os.getenv("DB_USER", "dashboarduser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Dashboard@2026")


def build_connection():
    connection_string = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER},{DB_PORT};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};PWD={DB_PASSWORD};"
        f"TrustServerCertificate=yes;Encrypt=no;"
    )
    return pyodbc.connect(connection_string, autocommit=True)


def load_training_matrix(connection):
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT vibration, temperature, rms, kurtosis, peak_to_peak
        FROM telemetry_raw
        WHERE vibration IS NOT NULL AND rms IS NOT NULL
        """
    )
    rows = cursor.fetchall()
    matrix = np.array([[r[0] or 0, r[1] or 0, r[2] or 0, r[3] or 0, r[4] or 0] for r in rows], dtype=float)
    return matrix


def load_rul_training_data(connection):
    cursor = connection.cursor()
    cursor.execute(
        """
        SELECT residual_component, anomaly_score, rul_estimate_hours
        FROM ml_inference_results
        WHERE rul_estimate_hours IS NOT NULL
        """
    )
    rows = cursor.fetchall()
    features = np.array([[r[0] or 0, r[1] or 0] for r in rows], dtype=float)
    targets = np.array([r[2] for r in rows], dtype=float)
    return features, targets


def train_anomaly_model(matrix):
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(matrix)
    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    model.fit(scaled)
    return model, scaler


def train_rul_model(features, targets):
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(features)
    model = LinearRegression()
    model.fit(scaled, targets)
    return model, scaler


def run_training():
    connection = build_connection()
    matrix = load_training_matrix(connection)

    if len(matrix) < 50:
        print("Not enough telemetry rows to train. Run the ingestion script first.")
        return

    model, scaler = train_anomaly_model(matrix)
    with open("model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open("scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    features, targets = load_rul_training_data(connection)
    if len(features) >= 20:
        rul_model, rul_scaler = train_rul_model(features, targets)
        with open("rul_model.pkl", "wb") as f:
            pickle.dump(rul_model, f)
        with open("rul_scaler.pkl", "wb") as f:
            pickle.dump(rul_scaler, f)
    else:
        print("Not enough ml_inference_results rows for RUL model, run stl_anomaly.py first.")

    connection.close()
    print(f"Training complete on {len(matrix)} telemetry rows.")


if __name__ == "__main__":
    run_training()
