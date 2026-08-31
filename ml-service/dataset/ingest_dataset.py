import os
import pandas as pd
import pyodbc
from datetime import datetime

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_DATABASE = os.getenv("DB_DATABASE", "SmartDashboard")
DB_USER = os.getenv("DB_USER", "dashboarduser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Dashboard@2026")

DATASET_PATH = os.getenv("DATASET_PATH", "dataset/bearing_telemetry_dataset.csv")
BATCH_SIZE = int(os.getenv("INGEST_BATCH_SIZE", "5000"))
SOURCE_LABEL = "GENERATED_SYNTHETIC_BEARING"


def build_connection():
    connection_string = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER},{DB_PORT};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};PWD={DB_PASSWORD};"
        f"TrustServerCertificate=yes;Encrypt=no;"
    )
    connection = pyodbc.connect(connection_string, autocommit=False)
    return connection


def ensure_assets_exist(connection, asset_ids):
    cursor = connection.cursor()
    for asset_id in asset_ids:
        cursor.execute("SELECT COUNT(1) FROM assets WHERE id = ?", asset_id)
        exists = cursor.fetchone()[0]
        if not exists:
            cursor.execute(
                """
                INSERT INTO assets (id, name, type, location, install_date)
                VALUES (?, ?, ?, ?, ?)
                """,
                asset_id, f"Bearing Rig {asset_id}", "Bearing", "Test Rig", datetime.utcnow().date(),
            )
    connection.commit()


def insert_rows(connection, rows):
    if not rows:
        return
    cursor = connection.cursor()
    cursor.fast_executemany = True
    cursor.executemany(
        """
        INSERT INTO telemetry_raw
            (asset_id, source_dataset, channel, vibration, temperature, pressure, rms, kurtosis, peak_to_peak, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    connection.commit()


def run_ingestion():
    if not os.path.exists(DATASET_PATH):
        print(f"Dataset file not found: {DATASET_PATH}")
        print("Run 'python dataset/generate_dataset.py' first, or set DATASET_PATH to an existing CSV.")
        return

    dataset = pd.read_csv(DATASET_PATH, parse_dates=["recorded_at"])
    has_temperature = "temperature" in dataset.columns
    has_pressure = "pressure" in dataset.columns
    connection = build_connection()
    ensure_assets_exist(connection, dataset["asset_id"].unique().tolist())

    buffer = []
    total_rows = 0
    for row in dataset.itertuples(index=False):
        buffer.append((
            row.asset_id,
            SOURCE_LABEL,
            "primary",
            float(row.vibration),
            float(row.temperature) if has_temperature and pd.notna(row.temperature) else None,
            float(row.pressure) if has_pressure and pd.notna(row.pressure) else None,
            float(row.rms),
            float(row.kurtosis),
            float(row.peak_to_peak),
            row.recorded_at.to_pydatetime(),
        ))
        total_rows += 1

        if len(buffer) >= BATCH_SIZE:
            insert_rows(connection, buffer)
            buffer = []
            print(f"Inserted {total_rows} rows so far...")

    insert_rows(connection, buffer)
    connection.close()
    print(f"Ingestion complete. Total rows inserted: {total_rows}")


if __name__ == "__main__":
    run_ingestion()
