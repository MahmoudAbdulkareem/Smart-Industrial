# train.py — trains the Isolation Forest model
# Run once: py train.py

import numpy as np
import pickle
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import MinMaxScaler

np.random.seed(42)

# ── TRAINING DATA ─────────────────────────────────────────────────────
# Built from actual publisher output observed in the terminal:
#
# AST-001 (healthy):  vib 0.7-1.6, temp 42-48, pres 1.3-4.4
# AST-002 (moderate): vib 2.6-3.6, temp 59-65, pres 1.2-4.5
# AST-003 (degraded): vib 7.3-8.3, temp 76-81, pres 1.3-4.5
# AST-004 (healthy):  vib 1.0-2.0, temp 45-51, pres 1.4-4.4
# AST-005 (moderate): vib 3.7-4.7, temp 68-74, pres 1.4-4.4
#
# The model needs to learn that ALL these are "normal for this system"
# so it gives a health score based on how far each reading is from
# its own baseline, not from a single global normal range.

n = 400  # samples per asset

# AST-001 — low vibration, low temp → should score 80-95
ast001 = np.column_stack([
    np.random.uniform(0.6, 1.8, n),
    np.random.uniform(41,  49,  n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-002 — medium vibration, medium temp → should score 60-80
ast002 = np.column_stack([
    np.random.uniform(2.5, 3.7, n),
    np.random.uniform(58,  66,  n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-003 — high vibration, high temp → should score 40-65
# This asset is always running hot — that IS its normal
ast003 = np.column_stack([
    np.random.uniform(7.0, 8.5, n),
    np.random.uniform(75,  82,  n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-004 — low-medium vibration, medium temp → should score 75-90
ast004 = np.column_stack([
    np.random.uniform(0.9, 2.1, n),
    np.random.uniform(44,  52,  n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-005 — medium-high vibration, high temp → should score 50-70
ast005 = np.column_stack([
    np.random.uniform(3.6, 4.8, n),
    np.random.uniform(67,  75,  n),
    np.random.uniform(1.2, 4.5, n),
])

# Clear anomalies — extreme values well outside all asset ranges
n_anomaly = 100
anomalies = np.column_stack([
    np.random.uniform(9.5, 14.0, n_anomaly),
    np.random.uniform(90,  105,  n_anomaly),
    np.random.uniform(0.0, 0.8,  n_anomaly),
])

all_data = np.vstack([ast001, ast002, ast003, ast004, ast005, anomalies])

# ── SCALER ────────────────────────────────────────────────────────────
scaler = MinMaxScaler()
scaled = scaler.fit_transform(all_data)

# ── ISOLATION FOREST ──────────────────────────────────────────────────
model = IsolationForest(
    n_estimators=200,
    contamination=0.05,
    random_state=42,
)
model.fit(scaled)

# ── VERIFY ────────────────────────────────────────────────────────────
tests = [
    ("AST-001 normal",  [1.0,  44,   2.5]),
    ("AST-002 normal",  [3.0,  62,   3.0]),
    ("AST-003 normal",  [7.8,  79,   2.5]),
    ("AST-004 normal",  [1.5,  48,   2.8]),
    ("AST-005 normal",  [4.2,  71,   2.5]),
    ("clear anomaly",   [12.0, 98,   0.2]),
]

print("\nTraining complete.")
print(f"Total samples: {len(all_data)}\n")
print("Score verification:")

all_raw = []
for label, vals in tests:
    s = scaler.transform([vals])
    raw  = model.score_samples(s)[0]
    pred = model.predict(s)[0]
    all_raw.append(raw)
    print(f"  {label:25s}: raw={raw:.4f}  pred={'normal' if pred==1 else 'ANOMALY'}")

print(f"\nRaw score range across tests: {min(all_raw):.4f} to {max(all_raw):.4f}")
print("(Use these values to set score_min and score_max in main.py)")

# ── SAVE ─────────────────────────────────────────────────────────────
with open("model.pkl",  "wb") as f: pickle.dump(model, f)
with open("scaler.pkl", "wb") as f: pickle.dump(scaler, f)

print("\nSaved: model.pkl, scaler.pkl")
