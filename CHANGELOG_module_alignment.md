# 🔄 Module Alignment Refactor — Changelog

> Full changelog of the SmartDashboard module alignment work — backend, frontend, database, and Maximo integration.

---

## 📑 Table of Contents

- [Scope](#-scope)
- [7. Maximo Asset Schema Alignment + WO Status Tracker Modal](#7-maximo-asset-schema-alignment--wo-status-tracker-modal)
- [6. Vibration Velocity (mm/s RMS) + Severity-Weighted Maximo Priority](#6-vibration-velocity-mms-rms--severity-weighted-maximo-priority)
- [5. Live 3-Sensor MQTT Pipeline + Recalibrated Rule Engine](#5-live-3-sensor-mqtt-pipeline--recalibrated-rule-engine)
- [4. Bidirectional Maximo Status Sync](#4-bidirectional-maximo-status-sync)
- [3. Frontend Modules](#3-frontend-modules)
- [2. Backend — Core System Philosophy](#2-backend--core-system-philosophy)
- [1. Database Migration](#1-database-migration)
- [Not Yet Done / Flagged for Next Phase](#-not-yet-done--flagged-for-next-phase)

---

## 🎯 Scope

Per priority: **frontend modules first**, backend touched only where needed to feed them real data.

> ⚠️ Run `sql/migration_module_alignment.sql` against your existing SmartDashboard database before deploying.

---

## 7. Maximo Asset Schema Alignment + WO Status Tracker Modal

> *This pass — the biggest bug fix in the refactor.*

### 🐛 Critical bug found and fixed

| Item | Detail |
|------|--------|
| **Where** | `backend/services/maximoService.js` — 7 places |
| **What** | Read/wrote a table `maximo_asset_mappings` that **never existed** in `sql/` |
| **Effect** | Every call silently failed and fell back to sending the *local* asset ID (`AST-001`) as the Maximo `assetnum` |
| **Real table** | `maximo_assets` (from `sql/schema_extension.sql`) |
| **Fix** | All affected functions now read/write `maximo_assets` |

**Affected functions:** `getAssetMapping`, `saveAssetMapping`, `resolveMaximoAssetnum`'s cache, `createPlaceholderAsset`, `syncAssetsFromMaximo`

### 🐛 `ensureAssetExists()` was also broken

- **Before:** Inserted into `assets` using columns that **don't exist** (`asset_id`, `assetnum`, `description`, `siteid`)
- **Real schema:** `id, name, type, location, install_date`
- **Result:** Every insert threw, masked by a misleading *"Assets table may not exist"* log
- **Fix:** Rewritten to correctly create a row in `assets` (if missing) + a mapping row in `maximo_assets` (if missing)

### 🔧 `syncAssetsFromMaximo()` redesigned

| Before | After |
|--------|-------|
| Imported **every** Maximo asset as a brand-new local asset | Only refreshes `maximo_assets` rows already mapped to our local assets |
| Would flood the DB with unrelated assets | Reports unmatched Maximo assets as `unmatched` |
| Instead of refreshing the 5 real monitored assets (AST-001..005) | Keeps the 5 real monitored assets clean |

### 🗄️ Local Asset model aligned to Maximo

**Migration:** `sql/migration_maximo_asset_alignment.sql`

Added to `assets`:
- `site_id` — Maximo `SITEID`
- `status` — Maximo asset `STATUS` (e.g. `OPERATING`)
- `properties` — JSON, for free-form attribute-set Maximo models via `ASSETSPEC`

> 💡 **Migration backfills** both from any existing mapping and guarantees a `maximo_assets` row exists for every asset, so `resolveMaximoAssetnum()` always has something to find.

> 🔗 `site_id` is now also returned by `GET /api/assets/health` (`telemetryRepository.getAssetHealthOverview`).

### ⚖️ Maximo priority is severity-weighted, not hardcoded

- `evaluateAndDispatch()` computes **Priority 1 / 2 / 3** from how many channels breach their max limit and by how much
- Passes it through to `maximoService.createLocalWorkOrder()`
- *(See §6 for full detail)*

### 🆕 Work Order Status Tracker Modal

**File:** `frontend/src/components/WorkOrderSyncTrackerModal.js`

The dedicated modal the spec asked for — separate from the inline sync summary in `WorkOrdersView.js`.

| Feature | Detail |
|---------|--------|
| **Shows** | Every Maximo sync log entry (WONUM, sync status, WO status, priority, asset, direction, created date, last attempt) |
| **Searchable / filterable** | ✅ |
| **Expandable row** | Reveals raw request and response JSON payloads |
| **Per-row retry** | For failed syncs |
| **Wired in via** | New **📋 Sync Log Tracker** button next to "Sync Assets" in `WorkOrdersView.js` |

**Backing endpoint:** `GET /api/maximo/sync/recent` (`maximoService.listRecentSyncs`)

- Enriched to join `maximo_workorders` for wonum/priority/status/created date
- Now actually returns `request_payload` / `response_payload` (previously omitted entirely)

### 🚧 Not yet done in this pass

- Tracker modal's labels are **hardcoded English** — flagged for i18n phase
- `assets.properties` (JSON) is schema-ready, but **nothing writes to it yet**
- Populating asset-type-specific specs (rated RPM, bearing spec, etc.) is a good candidate for the next asset-schema pass

---

## 6. Vibration Velocity (mm/s RMS) + Severity-Weighted Maximo Priority

### 🐛 Root cause: three different "vibration" scales coexisted

| Source | Scale |
|--------|-------|
| Dataset generator | Unitless RMS value (0.05–0.7) |
| Rule engine thresholds | Hand-calibrated to that same unitless scale (0.20/0.45) |
| Frontend What-if Simulator (`MLDashboardView.js`) | **mm/s** with caution >4, critical >7 |
| Original seed data (`sql/base_schema.sql`) | **mm/s** — 8.42 / 3.45 in seeded alerts |

> ❌ **None of the three agreed with each other.**

### ✅ New single source of truth

**File:** `backend/config/isoVibrationZones.js`

ISO 10816-3 Zone boundaries in mm/s RMS:

| Zone | Range | Meaning |
|------|-------|---------|
| 🟢 **A** | < 1.4 | Good |
| 🟡 **B** | 1.4 – 2.8 | Allowable |
| 🟠 **C** | 2.8 – 4.5 | Tolerable |
| 🔴 **D** | > 4.5 | Unacceptable |

**Constants:**
- `VIBRATION_WARN_MM_S = 2.8`
- `VIBRATION_MAX_MM_S = 4.5`

### 📊 Dataset regeneration

**File:** `ml-service/dataset/generate_dataset.py`

- Vibration now generated **directly in mm/s RMS** per asset
- Interpolates from healthy baseline (~0.5–0.9 mm/s, Zone A/B) up to peak deep in Zone D (5.8–7.2 mm/s)
- Follows each asset's existing **sigmoid degradation curve**
- Demo data now walks **Healthy → Caution → Critical** on a real, physically meaningful scale

> 💡 The internal unitless bearing-signal RMS (used only as an Isolation Forest feature input — rolling-window std/kurtosis/peak-to-peak) is kept **separate and untouched**. It's a normalized statistic, not a physical unit, and retraining/rescaling it would silently shift the existing model's feature distribution.

✅ Regenerated `bearing_telemetry_dataset.csv` with the new values.

### ⚙️ Rule engine update

**File:** `backend/services/ruleEngineService.js`

- Vibration thresholds per asset type now read from the **shared ISO config** instead of the old unitless numbers

### ⚖️ Maximo priority is no longer hardcoded

| Priority | Condition |
|----------|-----------|
| **1** | ≥2 channels past their max limit **OR** the worst channel is ≥40% over its limit |
| **2** | Single-channel breach **OR** MTBF-driven critical with no hard sensor breach |

`evaluateAndDispatch()` passes this through to `maximoService.createLocalWorkOrder()` instead of the previous flat `priority: 1`.

### 🎨 Frontend alignment

**File:** `MLDashboardView.js`

- What-if Simulator's vibration status thresholds, slider bands, and preset values now aligned to the same **2.8 / 4.5 mm/s** bands (previously an unrelated 4/7 guess)
- Added **ISO 10816 zone overlay** (Good / Allowable / Tolerable / Unacceptable shaded bands + legend) to the Vibration vs. Temperature scatter chart on the Analytics tab

### 🚧 Not yet done in this pass

- Same ISO zone overlay should also be added to `HealthView.js` and `MqttMonitorView.js`'s vibration trend charts (requirement #3)
- `frontend/src/context/LanguageContext.js` needs `isoZoneGood/Allowable/Tolerable/Unacceptable` keys in EN + FR so the zone legend translates (requirement #4)

---

## 5. Live 3-Sensor MQTT Pipeline + Recalibrated Rule Engine

### 📡 Dataset

- Previously had **no temperature or pressure at all** (pure vibration bearing-rig data)
- Missing a profile for `AST-005` entirely
- **Now:** `generate_dataset.py` synthesizes all three channels — vibration, temperature, pressure — correlated with the same per-asset degradation curve, for all 5 assets

### 📤 Publisher fix

**File:** `publisher.js`

| Before | After |
|--------|-------|
| Loaded temperature into memory but never published it | ✅ Publishes temperature |
| Never touched pressure at all | ✅ Publishes pressure |

All three channels now flow live over:

```
telemetry/{assetId}/{vibration|temperature|pressure}
```

### ⚖️ Rule engine recalibration

- Original thresholds assumed ISO-10816-style mm/s vibration
- This dataset's vibration channel is **unitless RMS on a 0.05–0.7 scale**
- Recalibrated all three channels' warn/max bands against the actual generated data
- ✅ Validated the Healthy → Caution → Critical progression lines up with each asset's configured failure-onset day

### 📥 Ingest fix

**File:** `ingest_dataset.py`

- Now writes **real** temperature/pressure
- Previously hardcoded `NULL` for temperature and omitted pressure entirely

---

## 4. Bidirectional Maximo Status Sync

### 🔄 Pull direction (Maximo → Dashboard)

**File:** `services/maximoService.js` — new `pullStatusUpdates()`

- Polls every **open, already-synced** local work order against Maximo (`GET /oslc/os/mxapiwo`)
- Updates the local `status` (+ emits `workorder:updated`) when it's changed
- Example: an engineer moving a WO to `APPR` / `INPRG` / `COMP` inside Maximo now shows up on the dashboard without anyone touching our UI

**Runs:**
- Automatically every **2 minutes** via cron (`server.js`)
- On demand via the new **⬇ Pull status from Maximo** button in *Work Orders & Maximo Sync* (`POST /api/maximo/sync/pull-status`, `it_admin` only)

### 📤 Push direction (Dashboard → Maximo)

- **Previously broken too:** changing a WO's status from our own dashboard only updated the local DB — it never told Maximo
- `updateWorkOrderStatus()` now **also pushes the change outward**
- Best-effort, logged in `maximo_sync_log`, doesn't block the local update if Maximo is unreachable

### 🆕 `CLOSE` status added

- Was missing from the API's allow-list and the frontend's transition map
- It's a real terminal Maximo status that can now come back through the pull sync

---

## 3. Frontend Modules

> *The requested priority.*

### 📊 Module A — `KpiCards.js` (rewritten)

- Fleet Health Index
- Maximo Sync %
- Auto-WOs-today
- Total Energy Load
- Real fleet-health-vs-energy trend chart (recharts)
- Asset status breakdown bar

### 💚 Module B — `HealthView.js`

- Added MTBF-remaining bar
- Rule engine's breach reasons inline on each asset card
- Asset num now shown (`ASSETNUM`)

### 🚨 Module E — `AlertsPanel.js` (rewritten)

Dual-pane list/detail layout:

| Pane | Content |
|------|---------|
| **Left** | Filterable list by severity / asset |
| **Right** | Exact sensor telemetry at trigger time, threshold visuals, and a direct link to the auto-created Maximo WO |

### 🛠️ Module F — `WorkOrdersView.js`

- Merged with the old `MaximoSyncPanel` (now removed) into one view
- Origin badges: `AUTO-CRITICAL` / `AUTO-ML` / `MANUAL`
- Per-row sync status + one-click retry
- Retry-all
- Connection banner

### 🐛 Real bug fixed

| Before | After |
|--------|-------|
| Sent `wo.id` (a field that **didn't exist** in the API response) | Uses `wonum` consistently, matching the OSLC/Maximo business key |
| Status changes silently failed | ✅ Status changes work |

### 🚧 Modules C & D

- **Module C (Energy)** and **Module D (ML prediction tool)** — left as-is beyond what already worked
- `MLDashboardView.js` already reads `sensors.vibration/temperature/pressure` correctly, so it benefits from the backend fix
- Its preset/asset-type sensitivity logic wasn't reworked in this pass

---

## 2. Backend — Core System Philosophy

### 🧠 New: `services/ruleEngineService.js`

The MTBF-weighted, 3-state (**Healthy / Caution / Critical**) rule engine described in the spec:

- Per-asset-type thresholds: **rotating equipment / thermal / hydraulic**
- Automatic Work Order dispatch on Critical (`AUTO_CRITICAL_ALERT`, priority 1)
- Automatic Work Order dispatch on high ML failure probability / low RUL (`AUTO_ML_PREDICTION`)

### 📨 `services/mqttService.js`

- Now calls the rule engine on **every live reading** and actually raises a work order
- **Previously:** only logged an alert — no WO was ever auto-created on a live anomaly

### 🔗 `services/maximoService.js`

- Work orders now carry `generateType`
- Added `retrySingleSync` + `POST /api/maximo/sync/:id/retry` for one-click per-row retry

### 📈 `repositories/telemetryRepository.js`

`getAssetHealthOverview()` now returns:

- `sensors: { vibration, temperature, pressure }`
- `mtbf`, `mtbfRemainingPct`
- `assetnum`, `assetType`
- Rule-engine `status` / `ruleReasons`

> 💡 This is the shape the frontend (`HealthView`, `KpiCards`, `MLDashboardView`) already expected but wasn't receiving — **a real pre-existing bug from an earlier backend rebuild.**

### 🌐 New endpoints

- `GET /assets/health/history`
- `GET /energy/history`

Both power the Module A trend chart with **real data** instead of a fabricated series.

### 🤖 `ml-service/pipeline/anomaly_pipeline.py`

- Now tags its own auto-created work orders `AUTO_ML_PREDICTION`
- Origin badges are correct regardless of which path (live MQTT or batch pipeline) created the WO

---

## 1. Database Migration

**File:** `sql/migration_module_alignment.sql`

### 🆕 Columns added

| Table | Column | Purpose |
|-------|--------|---------|
| `telemetry_raw` | `pressure` | Third sensor channel (was vibration/temperature only) |
| `assets` | `mtbf_hours` | MTBF-weighting input |
| `assets` | `total_run_hours` | MTBF-weighting input |
| `maximo_workorders` | `generate_type` | `AUTO_CRITICAL_ALERT` / `AUTO_ML_PREDICTION` / `MANUAL` |
| `alerts` | `wonum` | Link to the WO it raised |
| `alerts` | `vibration_at_trigger` | What triggered it |
| `alerts` | `temperature_at_trigger` | What triggered it |
| `alerts` | `pressure_at_trigger` | What triggered it |
| `alerts` | `rule_reason` | What triggered it |

### 📥 Backfills

- Pressure (derived placeholder — wire a real pressure sensor feed when available)
- Plausible MTBF/runtime numbers for the 5 demo assets

---

## 🚧 Not Yet Done / Flagged for Next Phase

| Item | Where | Notes |
|------|-------|-------|
| **ISO zone overlay** | `HealthView.js`, `MqttMonitorView.js` | Add same overlay as `MLDashboardView.js` for UI harmonization (req #3) |
| **i18n keys** | `frontend/src/context/LanguageContext.js` | Add `isoZoneGood/Allowable/Tolerable/Unacceptable` in EN + FR (req #4) |
| **Tracker modal labels** | `WorkOrderSyncTrackerModal.js` | Hardcoded English — flagged for i18n phase |
| **`assets.properties` writes** | Backend | Schema-ready but nothing writes to it yet |
| **Asset-type-specific specs** | Backend | Populate rated RPM, bearing spec, etc. (next asset-schema pass) |
| **Real pressure telemetry** | `mqttService.js` | Currently backfilled/derived — wire a real pressure channel on the MQTT topic |

---

<div align="center">

**✅ End of changelog**

</div>
