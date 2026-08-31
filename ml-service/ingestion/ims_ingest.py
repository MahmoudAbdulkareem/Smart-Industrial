import os
import sys
import glob
import numpy as np
import pandas as pd
import pyodbc
from datetime import datetime, timedelta

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_DATABASE = os.getenv("DB_DATABASE", "SmartDashboard")
DB_USER = os.getenv("DB_USER", "dashboarduser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Dashboard@2026")

IMS_DATASET_ROOT = os.getenv("IMS_DATASET_ROOT", "./data/1st_test")
BATCH_SIZE = int(os.getenv("INGEST_BATCH_SIZE", "5000"))

CHANNEL_TO_ASSET = {
    0: "AST-001",
    1: "AST-002",
    2: "AST-003",
    3: "AST-004",
}

SAMPLING_INTERVAL_SECONDS = 10


def build_connection():
    connection_string = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER},{DB_PORT};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};PWD={DB_PASSWORD};"
        f"TrustServerCertificate=yes;Encrypt=no;"
    )
    connection = pyodbc.connect(connection_string, autocommit=False)
    connection.cursor().fast_executemany = True
    return connection


def parse_file_timestamp(file_name):
    return datetime.strptime(file_name, "%Y.%m.%d.%H.%M.%S")


def compute_features(signal_array):
    rms_value = float(np.sqrt(np.mean(np.square(signal_array))))
    mean_value = float(np.mean(signal_array))
    std_value = float(np.std(signal_array)) or 1e-9
    kurtosis_value = float(np.mean((signal_array - mean_value) ** 4) / (std_value ** 4))
    peak_to_peak_value = float(np.max(signal_array) - np.min(signal_array))
    return rms_value, kurtosis_value, peak_to_peak_value


def build_rows_for_file(filepath):
    file_name = os.path.basename(filepath)
    base_timestamp = parse_file_timestamp(file_name)
    raw = pd.read_csv(filepath, sep="\t", header=None)

    rows = []
    for channel_index, asset_id in CHANNEL_TO_ASSET.items():
        if channel_index >= raw.shape[1]:
            continue
        signal_array = raw.iloc[:, channel_index].to_numpy(dtype=float)
        rms_value, kurtosis_value, peak_to_peak_value = compute_features(signal_array)
        recorded_at = base_timestamp
        rows.append((
            asset_id,
            "NASA_IMS",
            f"channel_{channel_index}",
            float(np.mean(np.abs(signal_array))),
            None,
            rms_value,
            kurtosis_value,
            peak_to_peak_value,
            recorded_at,
        ))
    return rows


def insert_rows(connection, rows):
    if not rows:
        return
    cursor = connection.cursor()
    cursor.fast_executemany = True
    cursor.executemany(
        """
        INSERT INTO telemetry_raw
            (asset_id, source_dataset, channel, vibration, temperature, rms, kurtosis, peak_to_peak, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    connection.commit()


def ensure_assets_exist(connection):
    cursor = connection.cursor()
    for asset_id in CHANNEL_TO_ASSET.values():
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


def run_ingestion():
    if not os.path.isdir(IMS_DATASET_ROOT):
        print(f"Dataset directory not found: {IMS_DATASET_ROOT}")
        sys.exit(1)

    connection = build_connection()
    ensure_assets_exist(connection)

    files = sorted(glob.glob(os.path.join(IMS_DATASET_ROOT, "*")))
    if not files:
        print(f"No IMS data files found under {IMS_DATASET_ROOT}")
        sys.exit(1)

    buffer = []
    processed_files = 0
    for filepath in files:
        try:
            rows = build_rows_for_file(filepath)
        except Exception as error:
            print(f"Skipping unreadable file {filepath}: {error}")
            continue

        buffer.extend(rows)
        processed_files += 1

        if len(buffer) >= BATCH_SIZE:
            insert_rows(connection, buffer)
            buffer = []

        if processed_files % 100 == 0:
            print(f"Processed {processed_files}/{len(files)} files")

    insert_rows(connection, buffer)
    connection.close()
    print(f"Ingestion complete. Files processed: {processed_files}")


if __name__ == "__main__":
    run_ingestion()
