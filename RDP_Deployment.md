# 🚀 RDP Deployment & Verification Guide

### Predictive Maintenance Dashboard

> Step-by-step deployment and verification for the Predictive Maintenance Dashboard on a remote (RDP) machine.

**What this covers:**
- Vibration (mm/s) + ISO 10816 zones
- Severity-weighted Maximo priority
- Maximo asset schema fix + Work Order Status Tracker Modal

> ⚠️ **Run every command on the RDP box, in order.** Each step has a ✅ **Verify** check — do not move on until it passes.

---

## 📋 Table of Contents

- [0. Before You Start](#0-before-you-start)
- [1. SQL Server — Schema Setup](#1-sql-server--schema-setup)
- [2. Dataset Generation + ML Service](#2-dataset-generation--ml-service)
- [3. MQTT Broker](#3-mqtt-broker)
- [4. Backend (Node/Express)](#4-backend-nodeexpress)
- [5. (Optional) Replay Telemetry onto MQTT](#5-optional-replay-telemetry-onto-mqtt)
- [6. Frontend (React)](#6-frontend-react)
- [7. Maximo Connectivity Check](#7-maximo-connectivity-check)
- [8. End-to-End Critical Alert Smoke Test](#8-end-to-end-critical-alert-smoke-test)

---

## 0. Before You Start

### 📁 Copy the project

Copy the entire `Main Final Project/Full Project` folder onto the RDP machine:

```
C:\apps\smartdashboard
```

### 🔐 Security note

> ⚠️ **`.env` contains real credentials in plaintext** — DB password, SMTP password, Maximo API key, and a Gemini key.
>
> **Before this goes anywhere beyond your RDP box:**
> - Rotate all credentials
> - Move `.env` out of version control

### 🧰 Prerequisites (install on the RDP box)

| Tool | Version |
|------|---------|
| SQL Server (or Express) | Latest |
| Node.js | 18+ |
| Python | 3.10+ |
| Mosquitto (MQTT broker) | Latest |

### 🖥️ Open 4 terminal windows

You'll leave one process running in each:

| # | Terminal | Purpose |
|---|----------|---------|
| 1 | **SQL setup** | One-time schema setup |
| 2 | **ML service** | FastAPI + ML models |
| 3 | **Backend** | Node/Express API |
| 4 | **Frontend** | React dashboard |
| 5 *(optional)* | **MQTT replay** | Telemetry stream publisher |

---

## 1. SQL Server — Schema Setup

Open **SQL Server Management Studio** (or `sqlcmd`) connected to your instance.

> ⚠️ **Run these in this exact order** — the Maximo alignment migration depends on tables created by the earlier scripts.

### 📜 Script order

```
1. sql/base_schema.sql
2. sql/schema_extension.sql
3. sql/migration_module_alignment.sql
4. sql/migration_maximo_asset_alignment.sql   ← new
```

### 💻 Run via `sqlcmd`

```powershell
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\base_schema.sql
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\schema_extension.sql
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\migration_module_alignment.sql
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\migration_maximo_asset_alignment.sql
```

### ✅ Verify

```sql
SELECT id, name, site_id, status FROM assets;
-- site_id and status should be populated, NOT NULL

SELECT asset_id, assetnum, siteid, status FROM maximo_assets;
-- one row per asset in `assets`
```

**Fix if needed:** If `maximo_assets.assetnum` still equals the local ID (e.g. `AST-001`) for a real asset, update it to your actual Maximo asset number:

```sql
UPDATE maximo_assets
SET assetnum = 'YOUR-REAL-MAXIMO-ASSETNUM'
WHERE asset_id = 'AST-001';
```

> 💡 **Why this matters:** Before this pass's fix, the code never read this table. Now it does.

---

## 2. Dataset Generation + ML Service

```powershell
cd ml-service

# Install dependencies
pip install -r requirements.txt --break-system-packages
pip install fastapi uvicorn pydantic matplotlib --break-system-packages

# Generate + ingest dataset
python dataset\generate_dataset.py        # regenerates bearing_telemetry_dataset.csv (mm/s vibration)
python dataset\ingest_dataset.py          # loads it into telemetry_raw

# Run anomaly pipeline + train models
python pipeline\anomaly_pipeline.py       # populates ml_inference_results, seeds critical work orders
python train.py                           # produces model.pkl / scaler.pkl / rul_model.pkl / rul_scaler.pkl

# Start the ML API
uvicorn main:app --port 8000
```

> 🟢 **Leave this terminal running.**

### ✅ Verify

- Terminal shows `Uvicorn running on http://127.0.0.1:8000`
- Open [`http://localhost:8000/docs`](http://localhost:8000/docs) → FastAPI Swagger UI loads
- `python dataset\generate_dataset.py` output mentions `24480 rows across 5 assets` (or similar) with no errors

> 📝 **Note:** `fastapi`, `uvicorn`, `pydantic`, and `matplotlib` are not yet in `requirements.txt`.

---

## 3. MQTT Broker

If Mosquitto isn't already running as a Windows service, start it with the project's config:

```powershell
mosquitto -c mosquitto\mosquitto.conf -v
```

### ✅ Verify

Terminal logs:

```
Opening ipv4 listen socket on port 1883
```

…with no errors.

---

## 4. Backend (Node/Express)

```powershell
cd backend
npm install
npm start
```

### ✅ Verify

| Check | Expected result |
|-------|-----------------|
| Terminal | `Server running on http://localhost:5000` |
| [`/api/assets/health`](http://localhost:5000/api/assets/health) | JSON array of **5 assets**, each with `sensors.vibration` in the **0.4 – 7 mm/s range** (not 0.05–0.7) and a `siteId` field |
| [`/api/maximo/sync/recent`](http://localhost:5000/api/maximo/sync/recent) | `[]` or an array — **not an error** |

> 💡 The second check confirms the enriched query and the new `maximo_assets`-based mapping code load without throwing.

---

## 5. (Optional) Replay Telemetry onto MQTT

In a **5th terminal**:

```powershell
cd backend
npm run publish
```

This streams the generated dataset onto the MQTT broker at a steady interval, so the **MQTT Live Monitor** view has live traffic to show.

---

## 6. Frontend (React)

```powershell
cd frontend
npm install
npm start
```

Opens [`http://localhost:3000`](http://localhost:3000).

### ✅ Verify each view

| View | What to check |
|------|---------------|
| **Operational Dashboard** | 5 assets shown · vibration values read in **mm/s** · none stuck at the old 0.05–0.7 range |
| **ML Dashboard → Analytics tab** | Vibration vs. Temperature scatter chart shows the new shaded **ISO 10816 zone bands** (green → red) with a legend underneath |
| **ML Dashboard → Prediction Tool** | Move the Vibration slider — status should flip to **"Caution" at 2.8 mm/s** and **"Critical" at 4.5 mm/s** (not 4 / 7) |
| **MQTT Live Monitor** | Live messages appear once step 5's publisher is running |
| **Work Orders** | Click **📋 Sync Log Tracker** (next to "Sync Assets") — the modal opens, lists sync log rows, and lets you expand a row to see raw JSON request/response |
| **Work Orders → Sync Assets** | Returns a toast like *"Refreshed N mapped asset(s) from Maximo"* — not the old *"X new, Y updated"* shape |

---

## 7. Maximo Connectivity Check

```
GET http://localhost:5000/api/maximo/test-connection
```

(Or click whatever **Test Maximo Connection** control exists in Settings/Admin.)

### ✅ Verify

| Scenario | Expected result |
|----------|-----------------|
| `MAXIMO_BASE_URL` / `MAXIMO_API_KEY` point at a **real, reachable** Maximo | `{ configured: true, connected: true, ... }` |
| Maximo is **not reachable** from the RDP box's network | `connected: false` — this is a network/firewall issue on the RDP host, **not a code issue** |

> 🌐 **Common gotcha:** `10.10.10.196` is an internal address — confirm the RDP box can actually route to it.
>
> 💡 **Local-only mode:** The app is designed to run **without Maximo reachable**. Work orders queue in `maximo_sync_log` as `PENDING`, and the Sync Log Tracker modal shows them as such — **that's expected, not broken.**

---

## 8. End-to-End Critical Alert Smoke Test (Optional)

Manually push one asset's telemetry into critical range to confirm the whole chain fires correctly:

**Rule engine → local work order → Maximo sync log → tracker modal**

```sql
INSERT INTO telemetry_raw (asset_id, vibration, temperature, pressure, recorded_at)
VALUES ('AST-001', 5.5, 90, 10, GETUTCDATE());
-- 5.5 mm/s is past the 4.5 mm/s critical line
```

### ✅ Verify

1. Open the **Work Orders** view
2. A new `AUTOMATED: Critical...` work order should appear within a few seconds (or after the next rule-engine evaluation cycle)
3. It should show up in the **Sync Log Tracker** modal with `direction: OUTBOUND`

---

<div align="center">

**✅ All steps verified? Your Predictive Maintenance Dashboard is live on the RDP box.**

</div>
