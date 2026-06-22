"""
═══════════════════════════════════════════════════════════════
train.py  —  Machine Learning Training Pipeline
═══════════════════════════════════════════════════════════════

WHAT THIS FILE DOES:
    1. Generates synthetic sensor data for 5 industrial assets
       (compressor, pump, conveyor, HVAC, motor) + 100 anomalies
    2. Trains an Isolation Forest for anomaly detection
    3. Trains a Linear Regression model for RUL (Remaining Useful
       Life) prediction
    4. Evaluates both models with proper train/test splits
    5. Saves all 4 trained objects as .pkl files for the FastAPI
       service to load at startup

WHY SYNTHETIC DATA?
    Real SINORFI sensor data is under an NDA that was not finalized
    during this project. Public datasets (NASA C-MAPSS) model jet
    engines — a completely different sensor profile than industrial
    compressors, pumps, and conveyors. The synthetic data here follows
    physically realistic degradation rates derived from maintenance
    literature, making it a reasonable approximation for a prototype.

REPRODUCIBILITY:
    np.random.seed(42) ensures running this script twice produces
    IDENTICAL .pkl files. Without this, every run would generate
    slightly different models, making debugging and grading harder.
"""

import numpy as np
import pickle
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    confusion_matrix, classification_report,
)

# ── Fix the random seed for full reproducibility ───────────────────────────
# Every np.random call below will produce the same sequence of numbers
# every time this script runs.
np.random.seed(42)

print("=" * 60)
print("  Smart Dashboard — ML Training Pipeline v2.0")
print("=" * 60)


# ═══════════════════════════════════════════════════════════════
# PART 1 — ISOLATION FOREST (Anomaly Detection)
# ═══════════════════════════════════════════════════════════════

print("\n[1/4] Generating synthetic sensor dataset...")

# ── Generate 400 "normal" readings per asset ───────────────────────────────
# np.column_stack([...]) combines three 1D arrays into one 2D array
# where each row is [vibration, temperature, pressure].
#
# np.random.uniform(low, high, n) draws n random floats between low and high.
#
# Each asset has a DIFFERENT operating range, mimicking real machine types:
n = 400

# AST-001 Compressor Unit A — low vibration, moderate temperature.
ast001 = np.column_stack([
    np.random.uniform(0.6, 1.8, n),    # vibration mm/s
    np.random.uniform(41, 49, n),       # temperature °C
    np.random.uniform(1.2, 4.5, n),     # pressure bar
])

# AST-002 Pump Station B — moderate vibration, higher temperature.
ast002 = np.column_stack([
    np.random.uniform(2.5, 3.7, n),
    np.random.uniform(58, 66, n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-003 Conveyor Belt C — high vibration, highest temperature
# (conveyor motors run hot and vibrate a lot under normal conditions).
ast003 = np.column_stack([
    np.random.uniform(7.0, 8.5, n),
    np.random.uniform(75, 82, n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-004 HVAC Unit D — low vibration (similar to compressor).
ast004 = np.column_stack([
    np.random.uniform(0.9, 2.1, n),
    np.random.uniform(44, 52, n),
    np.random.uniform(1.2, 4.5, n),
])

# AST-005 Motor Drive E — moderate-high vibration and temperature.
ast005 = np.column_stack([
    np.random.uniform(3.6, 4.8, n),
    np.random.uniform(67, 75, n),
    np.random.uniform(1.2, 4.5, n),
])

# ── Generate 100 anomalous readings ────────────────────────────────────────
# Anomalies represent fault conditions: very high vibration AND
# very high temperature AND very low pressure simultaneously.
# This combination is a classic failure signature — e.g. a bearing
# seizing causes vibration and friction (heat) while the seal fails
# (pressure loss).
n_anomaly = 100
anomalies = np.column_stack([
    np.random.uniform(9.5, 14.0, n_anomaly),   # extreme vibration
    np.random.uniform(90, 105, n_anomaly),     # extreme temperature
    np.random.uniform(0.0, 0.8, n_anomaly),    # pressure loss
])

# ── Combine all data ────────────────────────────────────────────────────────
# np.vstack stacks arrays vertically (adds rows).
# normal_data: 5 × 400 = 2000 rows
# all_data: 2000 + 100 = 2100 rows total
normal_data = np.vstack([ast001, ast002, ast003, ast004, ast005])
all_data    = np.vstack([normal_data, anomalies])

# ── Ground truth labels (for EVALUATION ONLY, not training) ────────────────
# Isolation Forest is UNSUPERVISED — it learns patterns from data alone,
# without being told which rows are anomalies. These labels exist purely
# so we can MEASURE how well the unsupervised model did afterwards.
#  +1 = normal, -1 = anomaly  (this is scikit-learn's convention)
y_true = np.array([1] * len(normal_data) + [-1] * n_anomaly)

# ── 80/20 train/test split, stratified by label ─────────────────────────────
# test_size=0.20: 20% of data (420 rows) goes to the test set.
# stratify=y_true: ensures both train and test sets have the SAME
#   proportion of anomalies (5%). Without stratification, a random
#   split could put all 100 anomalies in the training set, leaving
#   zero anomalies to evaluate against.
# random_state=42: same split every time this script runs.
X_train, X_test, y_train, y_test = train_test_split(
    all_data, y_true, test_size=0.20, random_state=42, stratify=y_true
)

print(f"   Dataset: {len(normal_data)} normal + {n_anomaly} anomalies = {len(all_data)} total")
print(f"   Train: {len(X_train)} samples  |  Test: {len(X_test)} samples")

# ── Feature scaling with MinMaxScaler ──────────────────────────────────────
# Without scaling, vibration (range 0-14) and temperature (range 41-105)
# have very different numeric scales. Isolation Forest's random splits
# would be biased toward the feature with the larger range (temperature).
# MinMaxScaler maps every feature to [0, 1] based on the TRAINING data's
# min and max — so all three features contribute equally.
scaler = MinMaxScaler()

# fit_transform() on TRAINING data: learns min/max AND transforms.
X_train_scaled = scaler.fit_transform(X_train)

# transform() on TEST data: uses the SAME min/max learned from training.
# NEVER call fit() on test data — that would "leak" test information
# into the scaler, giving overly optimistic evaluation results.
X_test_scaled = scaler.transform(X_test)


# ── Train the Isolation Forest ──────────────────────────────────────────────
print("\n[2/4] Training Isolation Forest (n_estimators=200, contamination=0.05)...")

model = IsolationForest(
    n_estimators=200,    # 200 random trees — more trees = more stable scores
    contamination=0.05,  # expect 5% of data to be anomalous (matches our 100/2100 ratio)
    random_state=42,     # reproducibility
)

# fit() trains ONLY on X_train_scaled — the model never sees the test set
# during training. This is essential for a fair evaluation afterward.
model.fit(X_train_scaled)

# ── Predict on the held-out test set ───────────────────────────────────────
# model.predict() returns +1 (normal) or -1 (anomaly) for each test sample.
y_pred = model.predict(X_test_scaled)

# ── Evaluation: Confusion Matrix ────────────────────────────────────────────
print("\n--- Isolation Forest Evaluation (held-out 20% test set) ---")

# confusion_matrix(y_true, y_pred, labels=[1, -1]):
#   Rows = true labels, Columns = predicted labels.
#   labels=[1, -1] forces the order: normal first, anomaly second.
cm = confusion_matrix(y_test, y_pred, labels=[1, -1])

# .ravel() flattens the 2x2 matrix into a 1D array of 4 values
# in row-major order: [TN, FP, FN, TP]
#   TN = True Normal  (correctly identified as normal)
#   FP = False Positive (normal wrongly flagged as anomaly)
#   FN = False Negative (anomaly missed, called normal)
#   TP = True Positive (anomaly correctly detected)
tn, fp, fn, tp = cm.ravel()

# ── Compute standard classification metrics ─────────────────────────────────
# Precision: of everything flagged as anomaly, how many were real anomalies?
#   precision = TP / (TP + FP)
precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0

# Recall: of all real anomalies, how many did we catch?
#   recall = TP / (TP + FN)
recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0

# F1-Score: harmonic mean of precision and recall — balances both.
#   f1 = 2 * (precision * recall) / (precision + recall)
f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

# Accuracy: overall fraction of correct predictions.
accuracy = (tp + tn) / len(y_test)

print(f"   Confusion Matrix (rows=true, cols=pred) [normal=+1, anomaly=-1]:")
print(f"                Pred Normal   Pred Anomaly")
print(f"   True Normal    {tn:>7d}        {fp:>7d}")
print(f"   True Anomaly   {fn:>7d}        {tp:>7d}")
print(f"\n   Accuracy : {accuracy:.4f}  ({accuracy*100:.1f}%)")
print(f"   Precision: {precision:.4f}  (of flagged anomalies, fraction that are real)")
print(f"   Recall   : {recall:.4f}  (of real anomalies, fraction we caught)")
print(f"   F1-Score : {f1:.4f}")

# classification_report() prints a formatted table with per-class
# precision, recall, f1, and support (number of samples in each class).
print(classification_report(y_test, y_pred, target_names=["Normal", "Anomaly"], zero_division=0))


# ═══════════════════════════════════════════════════════════════
# PART 2 — LINEAR REGRESSION (RUL Prediction)
# ═══════════════════════════════════════════════════════════════

print("\n[3/4] Building RUL training dataset...")

# ── Asset configuration ─────────────────────────────────────────────────────
# MAINTENANCE_THRESHOLD: health score below which maintenance is required.
MAINTENANCE_THRESHOLD = 30

# ASSET_BASELINES: starting health score for each asset (a "snapshot in time").
ASSET_BASELINES = {
    "AST-001": 88,  # Compressor — currently healthy
    "AST-002": 54,  # Pump — moderate degradation
    "AST-003": 31,  # Conveyor — near the threshold (close to failure)
    "AST-004": 76,  # HVAC — healthy
    "AST-005": 42,  # Motor — moderate degradation
}

# ASSET_SENSORS: baseline sensor values for each asset at 100% health.
ASSET_SENSORS = {
    "AST-001": dict(vib=1.2, temp=45, pres=2.5),
    "AST-002": dict(vib=3.1, temp=62, pres=3.0),
    "AST-003": dict(vib=7.8, temp=79, pres=2.5),
    "AST-004": dict(vib=1.5, temp=48, pres=2.8),
    "AST-005": dict(vib=4.2, temp=71, pres=2.5),
}

# DEGRADATION_RATES: how many health points the asset loses PER DAY.
# These rates were chosen to reflect realistic equipment lifespans:
#   - A compressor (0.12/day) takes ~480 days to degrade 58 points
#   - A conveyor (0.55/day) degrades much faster — high-wear component
DEGRADATION_RATES = {
    "AST-001": 0.12,
    "AST-002": 0.35,
    "AST-003": 0.55,
    "AST-004": 0.15,
    "AST-005": 0.40,
}

# ── Generate a degradation timeline for each asset ──────────────────────────
rul_X, rul_y = [], []  # X = features (vib, temp, pres, health_score), y = RUL in days

for asset_id, baseline in ASSET_BASELINES.items():
    rate = DEGRADATION_RATES[asset_id]
    sens = ASSET_SENSORS[asset_id]

    # How many daily "steps" from baseline down to the threshold?
    # Example: AST-001 (baseline=88, rate=0.12) → (88-30)/0.12 ≈ 483 steps
    # AST-003 (baseline=31, rate=0.55) → (31-30)/0.55 ≈ 1 step (already near failure)
    steps = int((baseline - MAINTENANCE_THRESHOLD) / rate) + 1

    for step in range(steps):
        # ── Health score at this step ────────────────────────────────────────
        # Linear degradation: baseline - (rate × step), plus Gaussian noise
        # (std=1.5) to simulate day-to-day variation. Real degradation is
        # never a perfectly straight line.
        # max(MAINTENANCE_THRESHOLD, ...) prevents scores below the threshold.
        hs = max(MAINTENANCE_THRESHOLD, baseline - rate * step + np.random.normal(0, 1.5))

        # ── Degradation factor (0 = healthy, 1 = at threshold) ────────────────
        # This represents "how far along the degradation curve are we?"
        # Used to scale the sensor values realistically.
        deg = 1 - (hs - MAINTENANCE_THRESHOLD) / max(1, baseline - MAINTENANCE_THRESHOLD)

        # ── Derive sensor values from the degradation factor ──────────────────
        # As deg increases (machine degrades):
        #   - vibration increases by up to 50% (deg * 0.5)
        #   - temperature increases by up to 30% (deg * 0.3)
        #   - pressure decreases by up to 10% (deg * 0.1) — seal wear
        # Small Gaussian noise added to each for realism.
        vib  = sens["vib"]  * (1 + deg * 0.5 + np.random.normal(0, 0.05))
        temp = sens["temp"] * (1 + deg * 0.3 + np.random.normal(0, 0.5))
        pres = sens["pres"] * (1 - deg * 0.1 + np.random.normal(0, 0.05))

        # ── RUL — the target value to predict ──────────────────────────────
        # How many days remain until health score reaches the threshold,
        # given the current health score and the daily degradation rate.
        # max(0, ...) ensures RUL is never negative.
        rul = max(0, (hs - MAINTENANCE_THRESHOLD) / rate)

        # Add this sample to the dataset.
        rul_X.append([vib, temp, pres, hs])
        rul_y.append(rul)

# Convert Python lists to numpy arrays for scikit-learn.
rul_X = np.array(rul_X)
rul_y = np.array(rul_y)

# ── 80/20 train/test split for RUL ──────────────────────────────────────────
# No stratification needed here — RUL is a continuous value, not a class.
rX_train, rX_test, ry_train, ry_test = train_test_split(
    rul_X, rul_y, test_size=0.20, random_state=42
)

# ── Scale RUL features ───────────────────────────────────────────────────────
# Separate scaler from the Isolation Forest scaler — different feature
# space (4 features here vs 3 for IF) and different value ranges.
rul_scaler = MinMaxScaler()
rX_train_scaled = rul_scaler.fit_transform(rX_train)
rX_test_scaled  = rul_scaler.transform(rX_test)

# ── Train the Linear Regression model ───────────────────────────────────────
rul_model = LinearRegression()
rul_model.fit(rX_train_scaled, ry_train)

# ── Predict on both train and test sets ─────────────────────────────────────
# Predicting on train data too lets us check for OVERFITTING:
# if train metrics are much better than test metrics, the model
# memorized the training data instead of learning general patterns.
ry_pred_train = rul_model.predict(rX_train_scaled)
ry_pred_test  = rul_model.predict(rX_test_scaled)

# ── Cross-validation (5-fold) ────────────────────────────────────────────────
# Cross-validation splits the FULL dataset into 5 folds, trains on 4,
# tests on 1, and repeats 5 times (each fold gets to be the test set once).
# This gives a more robust estimate of generalization than a single split.
rul_scaler_cv = MinMaxScaler()
rul_X_full_scaled = rul_scaler_cv.fit_transform(rul_X)

# scoring="neg_mean_absolute_error": scikit-learn convention — cross_val_score
# always maximizes, so error metrics are negated. We negate again (-cv_scores)
# to get back to positive MAE values for display.
cv_scores = cross_val_score(
    LinearRegression(), rul_X_full_scaled, rul_y,
    cv=5, scoring="neg_mean_absolute_error"
)

# ── Evaluation ────────────────────────────────────────────────────────────────
print(f"\n--- RUL Linear Regression Evaluation ---")
print(f"   Dataset: {len(rul_X)} samples across 5 assets")
print(f"   Train: {len(rX_train)}  |  Test: {len(rX_test)}")

print(f"\n   Train set:")
# mean_absolute_error: average of |predicted - actual| in days.
print(f"     MAE  : {mean_absolute_error(ry_train, ry_pred_train):.2f} days")
# mean_squared_error ** 0.5 = RMSE (Root Mean Squared Error) — penalizes
# large errors more heavily than MAE.
print(f"     RMSE : {mean_squared_error(ry_train, ry_pred_train)**0.5:.2f} days")
# r2_score: how much of the variance in the target the model explains.
# 1.0 = perfect, 0.0 = no better than predicting the mean every time.
print(f"     R²   : {r2_score(ry_train, ry_pred_train):.4f}")

print(f"\n   Test set (held-out 20%):")
print(f"     MAE  : {mean_absolute_error(ry_test, ry_pred_test):.2f} days")
print(f"     RMSE : {mean_squared_error(ry_test, ry_pred_test)**0.5:.2f} days")
print(f"     R²   : {r2_score(ry_test, ry_pred_test):.4f}")

print(f"\n   5-Fold Cross-Validation MAE: {-cv_scores.mean():.2f} ± {cv_scores.std():.2f} days")
print(f"   (Per-fold MAE values: {[-round(s, 2) for s in cv_scores]})")


# ═══════════════════════════════════════════════════════════════
# PART 3 — MANUAL VERIFICATION TESTS
# ═══════════════════════════════════════════════════════════════

print("\n[4/4] Running manual verification tests...")

# A small hand-picked set of test cases representing each asset's
# normal operating condition, plus one obviously anomalous reading.
tests = [
    ("AST-001 normal (healthy)",  [1.0,  44,  2.5]),
    ("AST-002 normal (caution)",  [3.0,  62,  3.0]),
    ("AST-003 normal (degraded)", [7.8,  79,  2.5]),
    ("AST-004 normal (healthy)",  [1.5,  48,  2.8]),
    ("AST-005 normal (caution)",  [4.2,  71,  2.5]),
    ("Clear anomaly (critical)",  [12.0, 98,  0.2]),
]

all_raw_scores = []
for label, vals in tests:
    # Scale the test input using the SAME scaler fitted on training data.
    # [vals] wraps the list in another list because scaler.transform()
    # expects a 2D array (shape: 1 row × 3 columns).
    scaled = scaler.transform([vals])

    # score_samples() returns the raw anomaly score (more negative = more anomalous).
    raw_score = model.score_samples(scaled)[0]

    # predict() returns +1 (normal) or -1 (anomaly).
    prediction = model.predict(scaled)[0]

    all_raw_scores.append(raw_score)

    status = "✓ normal" if prediction == 1 else "⚠ ANOMALY"
    print(f"   {label:32s}: score={raw_score:.4f}  →  {status}")

print(f"\n   Score range across test cases: {min(all_raw_scores):.4f} to {max(all_raw_scores):.4f}")
print(f"   (More negative = more anomalous)")


# ═══════════════════════════════════════════════════════════════
# PART 4 — SAVE TRAINED MODELS TO DISK
# ═══════════════════════════════════════════════════════════════

# pickle.dump() serializes a Python object (including all its learned
# weights and internal state) into a binary file. The FastAPI service
# loads these files at startup with pickle.load() — instant predictions
# without retraining.
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)

with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

with open("rul_model.pkl", "wb") as f:
    pickle.dump(rul_model, f)

with open("rul_scaler.pkl", "wb") as f:
    pickle.dump(rul_scaler, f)

print("\n" + "=" * 60)
print("  Models saved: model.pkl, scaler.pkl, rul_model.pkl, rul_scaler.pkl")
print("=" * 60)
