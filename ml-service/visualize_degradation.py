import os
import pyodbc
import pandas as pd
import matplotlib.pyplot as plt

DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_DATABASE = os.getenv("DB_DATABASE", "SmartDashboard")
DB_USER = os.getenv("DB_USER", "dashboarduser")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Dashboard@2026")

OUTPUT_DIR = os.getenv("CHART_OUTPUT_DIR", "./degradation_charts")


def build_connection():
    connection_string = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={DB_SERVER},{DB_PORT};"
        f"DATABASE={DB_DATABASE};"
        f"UID={DB_USER};PWD={DB_PASSWORD};"
        f"TrustServerCertificate=yes;Encrypt=no;"
    )
    return pyodbc.connect(connection_string, autocommit=True)


def load_asset_history(connection, asset_id):
    query = """
        SELECT window_end, anomaly_score, degradation_state
        FROM ml_inference_results
        WHERE asset_id = ?
        ORDER BY window_end ASC
    """
    frame = pd.read_sql(query, connection, params=[asset_id])
    frame["window_end"] = pd.to_datetime(frame["window_end"])
    return frame


def plot_asset(frame, asset_id, output_dir):
    fig, ax = plt.subplots(figsize=(10, 4.5))
    ax.plot(frame["window_end"], frame["anomaly_score"], color="#3C6E91", linewidth=1.5, label="Anomaly score")

    warning_rows = frame[frame["degradation_state"] == "WARNING"]
    critical_rows = frame[frame["degradation_state"] == "CRITICAL"]

    ax.scatter(warning_rows["window_end"], warning_rows["anomaly_score"], color="#C9A227", s=60, label="WARNING", zorder=5)
    ax.scatter(critical_rows["window_end"], critical_rows["anomaly_score"], color="#C9705A", s=80, label="CRITICAL", zorder=5)

    ax.set_title(f"{asset_id} — anomaly score over operational run")
    ax.set_xlabel("Window end date")
    ax.set_ylabel("Isolation Forest anomaly score (lower = more anomalous)")
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()

    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, f"{asset_id}_degradation.png")
    fig.savefig(out_path, dpi=160)
    plt.close(fig)
    print(f"Saved {out_path}")


def run():
    connection = build_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT DISTINCT asset_id FROM ml_inference_results")
    asset_ids = [row[0] for row in cursor.fetchall()]

    for asset_id in asset_ids:
        frame = load_asset_history(connection, asset_id)
        if frame.empty:
            continue
        plot_asset(frame, asset_id, OUTPUT_DIR)

    connection.close()


if __name__ == "__main__":
    run()
