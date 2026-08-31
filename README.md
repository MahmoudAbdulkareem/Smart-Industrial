# SmartDashboard — Real-Data Industrial Monitoring Platform

Rebuilt against SQL Server with a real (or generated) industrial dataset, a layered Express
backend, an Isolation Forest anomaly detection pipeline, and a local + real IBM Maximo MIF
integration layer.

## Structure

```
backend/
  server.js                  Thin bootstrap: express app, socket.io, cron, mqtt
  db/pool.js                 SQL Server connection pool
  middleware/auth.js         JWT auth + role guards
  routes/                    Express routers (thin, one per domain)
  controllers/               Request handlers
  services/                  Business logic (energy, maximo, maximoClient, notifications,
                              reports, ml proxy, sockets, mqtt, broadcast, audit)
  repositories/               Raw SQL access (users, telemetry, alerts, notification logs)
  scripts/publisher.js        Combined publisher: replays real telemetry_raw + energy_metrics onto MQTT

ml-service/
  main.py                    FastAPI inference endpoint used by backend's mlProxyService
  train.py                   Trains Isolation Forest + RUL regressor on real ingested telemetry
  dataset/generate_dataset.py  Generates a realistic run-to-failure bearing dataset (no download needed)
  dataset/bearing_telemetry_dataset.csv  The generated dataset, ready to ingest
  dataset/ingest_dataset.py  Loads the generated CSV into SQL Server
  ingestion/ims_ingest.py    Alternative: batch-loads the real NASA IMS Bearing dataset instead
  pipeline/anomaly_pipeline.py  Isolation Forest over rolling-window sensor statistics, writes
                             ml_inference_results, auto-creates Maximo work orders on anomalies
  visualize_degradation.py   Generates report-ready anomaly score charts per asset

sql/
  base_schema.sql            Original core schema (users, assets, alerts, work_orders, energy_metrics, chat)
  schema_extension.sql       telemetry_raw, ml_model_registry, ml_inference_results,
                             maximo_assets, maximo_workorders, maximo_sync_log

frontend/                    React app — RUL display fixed, Maximo Sync panel added for IT admins
mosquitto/                   MQTT broker config (unchanged)
```

## Setup

1. Run `sql/base_schema.sql` then `sql/schema_extension.sql` against your `SmartDashboard` database.
2. `cd ml-service && pip install -r requirements.txt --break-system-packages && pip install matplotlib --break-system-packages`
3. Ingest data — pick one:
   - **Generated dataset (fastest, already included):** `python dataset/ingest_dataset.py`
     (re-generate anytime with `python dataset/generate_dataset.py`)
   - **Real NASA IMS dataset:** download it, set `IMS_DATASET_ROOT` to the extracted folder,
     run `python ingestion/ims_ingest.py`
4. Run `python pipeline/anomaly_pipeline.py` to populate `ml_inference_results` and seed Maximo work orders.
5. Optionally run `python visualize_degradation.py` for report-ready charts.
6. Run `python train.py` to produce `model.pkl` / `scaler.pkl` / `rul_model.pkl`, then
   `uvicorn main:app --port 8000`.
7. `cd backend && npm install && npm start`.
8. Start the MQTT broker: `mosquitto -c mosquitto/mosquitto.conf`.
9. Replay real data onto MQTT: `cd backend && npm run publish`.
10. `cd frontend && npm install && npm start`.

## Connecting to a real IBM Maximo instance

By default the project runs entirely in **local mode** — `maximo_workorders` /
`maximo_sync_log` behave like a private mock of Maximo, and nothing leaves your machine.
To push real work orders into an actual Maximo instance:

1. **Get an API key** — in Maximo, as an administrator: **Administration → Work Centers →
   Integration → API Keys → Add API Key**. Pick (or create) a dedicated service user for
   this integration, save, and copy the key immediately — Maximo only shows it once.
2. Set these three variables in `backend/.env`:
   ```
   MAXIMO_BASE_URL=https://your-instance.example.com/maximo
   MAXIMO_API_KEY=your-copied-key
   MAXIMO_SITE_ID=YOURSITE
   ```
   Leaving `MAXIMO_API_KEY` blank keeps the project in local-only mode — nothing changes
   until you fill it in.
3. **Make sure `maximo_assets.assetnum` holds real Maximo asset numbers**, not the local
   `AST-001`-style IDs — Maximo will reject a work order for an asset number it doesn't
   recognize. Update the mapping:
   ```sql
   UPDATE maximo_assets SET assetnum = 'REAL-ASSET-NUM' WHERE asset_id = 'AST-001';
   ```
4. Restart the backend. From then on:
   - Every work order created locally (manually or by the ML pipeline) is pushed to real
     Maximo immediately via `POST /oslc/os/mxapiwo`, using the `apikey` header.
   - If Maximo is briefly unreachable, the attempt is marked `FAILED` in `maximo_sync_log`
     and a cron job (`server.js`, every 5 minutes) automatically retries anything still
     `PENDING`.
   - Test the connection any time: `GET /api/maximo/test-connection` (IT admin only).
   - Manually trigger a retry sweep: `POST /api/maximo/sync/retry` (IT admin only).
   - Check status visually in the frontend under **Management → Maximo Sync** (IT admin role).
5. The ML pipeline (`pipeline/anomaly_pipeline.py`) is unchanged by this — it still just
   writes to `maximo_workorders`/`maximo_sync_log` in SQL Server. The Node backend's retry
   cron job is what actually pushes those rows out to real Maximo, so you don't need to
   touch the Python side at all to go from local-only to fully integrated.

## What changed from the previous version

- **STL decomposition removed from the anomaly pipeline.** `pipeline/anomaly_pipeline.py`
  (replaces `pipeline/stl_anomaly.py`) now runs Isolation Forest directly on rolling-window
  statistics of the raw sensor signal (RMS mean/std, kurtosis mean, peak-to-peak mean) instead
  of first decomposing into trend/seasonal/residual components. `ml_inference_results.residual_component`
  now stores the window's RMS standard deviation (still a meaningful degradation signal);
  `trend_component`/`seasonal_component` are no longer populated (left `NULL` — the schema
  didn't need to change, those columns were already nullable). `train.py` and `main.py`'s RUL
  model were updated to match the smaller feature set. `statsmodels` is no longer a dependency.
- **New IT-admin "Maximo Sync" panel** (`frontend/src/components/MaximoSyncPanel.js`) shows
  live connection status to your real Maximo instance, and the outbound sync queue
  (PENDING/SENT/FAILED counts + recent history), with a manual "retry now" button. Backed by
  two new endpoints: `GET /api/maximo/sync/recent` and the existing `POST /api/maximo/sync/retry`
  / `GET /api/maximo/test-connection`.
- **Real Maximo push integration** — `backend/services/maximoClient.js` talks to a real
  Maximo instance via `apikey` header auth; `maximoService.js` pushes every locally created
  work order automatically when `MAXIMO_BASE_URL`/`MAXIMO_API_KEY` are set, with automatic
  retry for anything that fails.
- A ready-to-use dataset is generated for you — no external download required.
  `ml-service/dataset/generate_dataset.py` produces `bearing_telemetry_dataset.csv`: five
  assets (`AST-001`–`AST-005`), 10-minute cadence, 34-day run, each with a staggered
  sigmoid degradation curve so every asset fails at a different point in the run. All
  three sensor channels are generated — vibration, temperature, and pressure — the
  latter two correlated with the same degradation curve so a failing asset shows a
  coherent story across all three, not just vibration.
  `ml-service/dataset/ingest_dataset.py` loads that CSV into `telemetry_raw`. The real IMS
  ingestion script is still included if you want to switch to it later (vibration-only).
- **`dbPublisher.js` and `dbEnergyPublisher.js` are merged into one file**,
  `backend/scripts/publisher.js`, run with `npm run publish` from `backend/`. It loads every
  real row from `telemetry_raw` and `energy_metrics` and replays them on a loop over MQTT.
- `services/mqttService.js` no longer requires both `vibration` and `temperature` before
  evaluating a reading — it debounces incoming metrics per asset for 400ms and evaluates once
  `vibration` or `rms` is present.
- `repositories/telemetryRepository.js` — health score is derived from the validated
  `degradation_state` band (NORMAL/WARNING/CRITICAL) instead of a raw anomaly-score offset
  that was clipping to 0.
- `frontend/src/components/HealthView.js` — RUL is correctly converted from hours to days for
  display and CSV/Excel export.
- All other synthetic generation (the old random fallback broadcaster in `server.js`) is
  removed in favor of `services/broadcastService.js`, which broadcasts real DB-backed state.
- `server.js` no longer contains business logic — it only wires routers, sockets, and cron jobs.
- `GET /api/assets/health` returns `healthScore`, `degradationState`, and `rul` derived from
  `ml_inference_results`, not from in-memory formulas.

## Frontend

The React app under `frontend/` keeps its original structure. Its API calls to
`/api/assets`, `/api/workorders`, `/api/energy/*`, `/api/alerts`, `/api/chat/*`, `/api/users`
still work against the new backend, since those routes were preserved. A new tab, **Maximo
Sync** (IT admin role only), was added under the Management group. Components that read asset
fields like `healthScore` or `rul` receive real, ML-derived values instead of synthetic ones.
