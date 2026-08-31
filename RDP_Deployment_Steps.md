# RDP Deployment & Verification Steps — Predictive Maintenance Dashboard

Covers what's built and fixed so far: vibration mm/s + ISO 10816 zones, severity-weighted
Maximo priority, and the Maximo asset schema fix + Work Order Status Tracker Modal.
Run everything below **on the RDP box**, in this order. Each numbered step includes a
verification check — don't move to the next step until that check passes.

---

## 0. Before you start

- Copy the whole `Main Final Project/Full Project` folder onto the RDP machine (e.g.
  `C:\apps\smartdashboard`).
- **Security note:** `.env` in this project has real credentials committed in plaintext
  (DB password, SMTP password, Maximo API key, a Gemini key). Before this goes anywhere
  beyond your own RDP box, rotate those and move `.env` out of version control.
- You'll need, installed on the RDP box: **SQL Server** (or SQL Server Express), **Node.js
  18+**, **Python 3.10+**, and a local **MQTT broker** (Mosquitto).
- Open 4 separate terminal windows (PowerShell or cmd) — you'll leave one process running
  in each: **SQL setup (one-time)**, **ML service**, **Backend**, **Frontend**. A 5th,
  optional, for the MQTT telemetry replay.

---

## 1. SQL Server — schema setup

Open SQL Server Management Studio (or `sqlcmd`) connected to your instance, and run these
**in this exact order** (the new Maximo alignment migration depends on tables created by
the ones before it):

```
1. sql/base_schema.sql
2. sql/schema_extension.sql
3. sql/migration_module_alignment.sql
4. sql/migration_maximo_asset_alignment.sql   <-- new, from this pass
```

Via `sqlcmd`:
```powershell
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\base_schema.sql
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\schema_extension.sql
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\migration_module_alignment.sql
sqlcmd -S localhost -U dashboarduser -P "<your DB password from .env>" -i sql\migration_maximo_asset_alignment.sql
```

**✅ Verify:**
```sql
SELECT id, name, site_id, status FROM assets;              -- site_id/status should be populated, not NULL
SELECT asset_id, assetnum, siteid, status FROM maximo_assets; -- one row per asset in `assets`
```
If `maximo_assets.assetnum` still equals the local ID (e.g. `AST-001`) for a real asset,
update it now to your actual Maximo asset number:
```sql
UPDATE maximo_assets SET assetnum = 'YOUR-REAL-MAXIMO-ASSETNUM' WHERE asset_id = 'AST-001';
```
This now actually matters — before this pass's fix, the code never read this table.

---

## 2. Dataset generation + ML service

```powershell
cd ml-service
pip install -r requirements.txt --break-system-packages
pip install fastapi uvicorn pydantic matplotlib --break-system-packages   # not in requirements.txt yet
python dataset\generate_dataset.py        # regenerates bearing_telemetry_dataset.csv (mm/s vibration)
python dataset\ingest_dataset.py          # loads it into telemetry_raw
python pipeline\anomaly_pipeline.py       # populates ml_inference_results, seeds any critical work orders
python train.py                           # produces model.pkl / scaler.pkl / rul_model.pkl / rul_scaler.pkl
uvicorn main:app --port 8000
```
Leave this terminal running.

**✅ Verify:**
- Terminal shows `Uvicorn running on http://127.0.0.1:8000`.
- Open `http://localhost:8000/docs` in a browser — FastAPI's Swagger UI should load.
- `python dataset\generate_dataset.py` output should mention `24480 rows across 5 assets`
  (or similar) with no errors.

---

## 3. MQTT broker

If Mosquitto isn't already running as a Windows service, start it with the project's config:
```powershell
mosquitto -c mosquitto\mosquitto.conf -v
```
**✅ Verify:** terminal logs `Opening ipv4 listen socket on port 1883` with no errors.

---

## 4. Backend (Node/Express)

```powershell
cd backend
npm install
npm start
```
**✅ Verify:**
- Terminal shows `Server running on http://localhost:5000`.
- `http://localhost:5000/api/assets/health` in a browser returns a JSON array of 5 assets,
  each with `sensors.vibration` in the **0.4 – 7 mm/s range** (not 0.05–0.7) and a
  `siteId` field.
- `http://localhost:5000/api/maximo/sync/recent` returns `[]` or an array (not an error) —
  confirms the enriched query and the new `maximo_assets`-based mapping code load without
  throwing.

---

## 5. (Optional) Replay telemetry onto MQTT

In a 5th terminal:
```powershell
cd backend
npm run publish
```
This streams the generated dataset onto the MQTT broker at a steady interval so the MQTT
Live Monitor view has live traffic to show.

---

## 6. Frontend (React)

```powershell
cd frontend
npm install
npm start
```
Opens `http://localhost:3000`.

**✅ Verify each view:**

| View | What to check |
|---|---|
| **Operational Dashboard** | 5 assets shown, vibration values read in mm/s, none stuck at the old 0.05–0.7 range |
| **ML Dashboard → Analytics tab** | Vibration vs. Temperature scatter chart shows the new shaded ISO 10816 zone bands (green→red) with a legend underneath |
| **ML Dashboard → Prediction Tool** | Move the Vibration slider — status should flip to "Caution" at 2.8 mm/s and "Critical" at 4.5 mm/s, not 4/7 |
| **MQTT Live Monitor** | Live messages appear once step 5's publisher is running |
| **Work Orders** | Click **📋 Sync Log Tracker** (next to "Sync Assets") — the new modal should open, list sync log rows, and let you expand a row to see raw JSON request/response |
| **Work Orders → Sync Assets** | Click it — should return a toast like "Refreshed N mapped asset(s) from Maximo" (not "X new, Y updated", which was the old broken response shape) |

---

## 7. Maximo connectivity check

```
GET http://localhost:5000/api/maximo/test-connection
```
(Or click whatever "Test Maximo Connection" control exists in Settings/Admin.)

**✅ Verify:**
- If `MAXIMO_BASE_URL`/`MAXIMO_API_KEY` in `.env` point at a real, reachable Maximo, this
  returns `{ configured: true, connected: true, ... }`.
- If Maximo isn't reachable from the RDP box's network (common — `10.10.10.196` is an
  internal address, confirm the RDP box can actually route to it), you'll get
  `connected: false` — that's a network/firewall issue on the RDP host, not a code issue.
  The app is designed to run in **local-only mode** without Maximo reachable (work orders
  queue in `maximo_sync_log` as `PENDING` and the Sync Log Tracker modal will show them
  as such — that's expected, not broken).

## 8. Trigger a real end-to-end critical alert (optional smoke test)

Manually push one asset's telemetry into critical range to confirm the whole chain — rule
engine → local work order → Maximo sync log → tracker modal — fires correctly:
```sql
INSERT INTO telemetry_raw (asset_id, vibration, temperature, pressure, recorded_at)
VALUES ('AST-001', 5.5, 90, 10, GETUTCDATE());   -- 5.5 mm/s is past the 4.5 mm/s critical line
```
Then check the **Work Orders** view — a new `AUTOMATED: Critical...` work order should
appear within a few seconds (or after the next rule-engine evaluation cycle), and it should
show up in the **Sync Log Tracker** modal with `direction: OUTBOUND`.
