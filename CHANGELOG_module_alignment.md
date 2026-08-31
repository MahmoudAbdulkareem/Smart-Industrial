# Module Alignment Refactor — Changelog

## 7. Maximo Asset Schema Alignment + Work Order Status Tracker Modal (this pass)
- **Critical bug found and fixed:** `backend/services/maximoService.js` read/wrote a
  table called `maximo_asset_mappings` in 7 places (`getAssetMapping`, `saveAssetMapping`,
  `resolveMaximoAssetnum`'s cache, `createPlaceholderAsset`, `syncAssetsFromMaximo`) —
  **that table was never created by any script in `sql/`.** Every call silently failed
  (caught and swallowed) and fell back to sending the *local* asset ID (`AST-001`) as the
  Maximo `assetnum` on every work order, exactly the failure mode the code's own warning
  message described. The real, already-seeded mapping table is `maximo_assets`
  (`sql/schema_extension.sql`) — the documented admin workflow ("edit `maximo_assets.
  assetnum` to your real Maximo numbers") did nothing, because the WO-creation code path
  never queried that table. All affected functions now read/write `maximo_assets`.
- **`ensureAssetExists()` was also broken:** it inserted into `assets` using columns
  (`asset_id`, `assetnum`, `description`, `siteid`) that don't exist on that table (its
  real schema is `id, name, type, location, install_date`) — every insert threw and was
  masked by a misleading "Assets table may not exist" log. Rewritten to correctly create
  a row in `assets` (if missing) and a mapping row in `maximo_assets` (if missing).
- **`syncAssetsFromMaximo()` redesigned:** previously it imported every asset Maximo
  returned as a brand-new local asset keyed by the Maximo `assetnum` — which would have
  flooded the DB with unrelated assets instead of refreshing the 5 real monitored assets
  (AST-001..005). It now only refreshes `maximo_assets` rows that are already mapped to
  one of our local assets, and reports Maximo assets with no local mapping as `unmatched`
  instead of fabricating new local rows for them.
- **Local Asset model aligned to Maximo (`sql/migration_maximo_asset_alignment.sql`):**
  added `assets.site_id` (Maximo `SITEID`), `assets.status` (Maximo asset `STATUS`, e.g.
  `OPERATING`), and `assets.properties` (JSON, for the free-form attribute-set Maximo
  models via `ASSETSPEC`) — none of which existed on the core asset table before, only on
  the secondary `maximo_assets` mapping table. Migration backfills both from any existing
  mapping and guarantees a `maximo_assets` row exists for every asset so
  `resolveMaximoAssetnum()` always has something to find. `site_id` is now also returned
  by `GET /api/assets/health` (`telemetryRepository.getAssetHealthOverview`).
- **Maximo priority is severity-weighted, not hardcoded** (carried over from the vibration
  pass, see §6): `evaluateAndDispatch()` computes Priority 1/2/3 from how many channels
  breach their max limit and by how much, and passes it through to
  `maximoService.createLocalWorkOrder()`.
- **New: Work Order Status Tracker Modal** (`frontend/src/components/
  WorkOrderSyncTrackerModal.js`) — the dedicated modal the spec asked for, separate from
  the inline sync summary already in `WorkOrdersView.js`. Shows every Maximo sync log
  entry (WONUM, sync status, WO status, priority, asset, direction, created date, last
  attempt), searchable/filterable, with an expandable row revealing the raw request and
  response JSON payloads, plus a per-row retry action for failed syncs. Wired in via a new
  "📋 Sync Log Tracker" button next to "Sync Assets" in `WorkOrdersView.js`. Backing
  endpoint `GET /api/maximo/sync/recent` (`maximoService.listRecentSyncs`) was enriched to
  join `maximo_workorders` for wonum/priority/status/created date and to actually return
  `request_payload`/`response_payload`, which it previously omitted entirely.
- **Not yet done in this pass:** the tracker modal's labels are hardcoded English —
  flagged for the i18n phase. `assets.properties` (JSON) is schema-ready but nothing
  writes to it yet; populating asset-type-specific specs (rated RPM, bearing spec, etc.)
  is a good candidate for the next asset-schema pass if useful.

## 6. Vibration Velocity — mm/s (RMS) alignment + severity-weighted Maximo priority
- **Root cause found:** three different "vibration" scales coexisted in the codebase —
  the dataset generator produced an unrelated unitless RMS value (0.05–0.7), the rule
  engine's thresholds were hand-calibrated to that same unitless scale (0.20/0.45), while
  the frontend's What-if Simulator (`MLDashboardView.js`) and the original seed data in
  `sql/base_schema.sql` already assumed **mm/s** with completely different numbers again
  (caution >4, critical >7 in the simulator vs. 8.42 mm/s / 3.45 mm/s in the seeded alerts).
  None of the three agreed with each other.
- **New single source of truth:** `backend/config/isoVibrationZones.js` — ISO 10816-3
  Zone A/B/C/D boundaries in mm/s RMS (Good < 1.4, Allowable 1.4–2.8, Tolerable 2.8–4.5,
  Unacceptable > 4.5). `VIBRATION_WARN_MM_S` = 2.8, `VIBRATION_MAX_MM_S` = 4.5.
- **`ml-service/dataset/generate_dataset.py`** — vibration is now generated directly in
  mm/s RMS per asset, interpolating from a healthy baseline (~0.5–0.9 mm/s, Zone A/B)
  up to a peak deep in Zone D (5.8–7.2 mm/s) along each asset's existing sigmoid
  degradation curve, so the demo data actually walks Healthy → Caution → Critical on a
  real, physically meaningful scale. The internal unitless bearing-signal RMS used only
  as an Isolation Forest feature input (rolling-window std/kurtosis/peak-to-peak) is kept
  separate and untouched, since it's a normalized statistic, not a physical unit, and
  retraining/rescaling it would silently shift the existing model's feature distribution.
  Regenerated `bearing_telemetry_dataset.csv` with the new values.
- **`backend/services/ruleEngineService.js`** — vibration thresholds per asset type now
  read from the shared ISO config instead of the old unitless numbers.
- **Maximo priority is no longer hardcoded to 1 for every Critical alert.** The rule
  engine now derives `maximoPriority` from breach severity: Priority 1 when ≥2 channels
  are past their max limit or the worst channel is ≥40% over its limit; Priority 2 for a
  single-channel breach or an MTBF-driven critical with no hard sensor breach.
  `evaluateAndDispatch()` passes this through to `maximoService.createLocalWorkOrder()`
  instead of the previous flat `priority: 1`.
- **Frontend (`MLDashboardView.js`)** — the What-if Simulator's vibration status
  thresholds, slider bands, and preset values are now aligned to the same 2.8/4.5 mm/s
  bands (previously an unrelated 4/7 guess). Added an **ISO 10816 zone overlay**
  (Good/Allowable/Tolerable/Unacceptable shaded bands + legend) to the Vibration vs.
  Temperature scatter chart on the Analytics tab.
- **Not yet done in this pass** (flagged for the next phase): the same ISO zone overlay
  should also be added to `HealthView.js` and `MqttMonitorView.js`'s vibration trend
  charts for full UI harmonization (requirement #3), and `frontend/src/context/
  LanguageContext.js` needs `isoZoneGood/Allowable/Tolerable/Unacceptable` keys added
  in EN+FR so the zone legend translates (requirement #4).


Scope of this pass (per priority: **frontend modules first**, backend touched only
where needed to feed them real data). Run `sql/migration_module_alignment.sql`
against your existing SmartDashboard database before deploying.

## 1. Database (`sql/migration_module_alignment.sql`)
- `telemetry_raw.pressure` — third sensor channel (was vibration/temperature only).
- `assets.mtbf_hours`, `assets.total_run_hours` — MTBF-weighting inputs.
- `maximo_workorders.generate_type` — `AUTO_CRITICAL_ALERT | AUTO_ML_PREDICTION | MANUAL`.
- `alerts.wonum`, `.vibration_at_trigger`, `.temperature_at_trigger`, `.pressure_at_trigger`, `.rule_reason` —
  lets an alert show exactly what triggered it and link straight to the WO it raised.
- Backfills pressure (derived placeholder — wire a real pressure sensor feed when available)
  and plausible MTBF/runtime numbers for the 5 demo assets.

## 2. Backend — new "core system philosophy" piece
- **`services/ruleEngineService.js`** (new): the MTBF-weighted, 3-state
  (Healthy/Caution/Critical) rule engine described in the spec, with per-asset-type
  thresholds (rotating equipment / thermal / hydraulic) and automatic Work Order
  dispatch on Critical (`AUTO_CRITICAL_ALERT`, priority 1) and on high ML failure
  probability / low RUL (`AUTO_ML_PREDICTION`).
- **`services/mqttService.js`** — now calls the rule engine on every live reading and
  actually raises a work order (previously it only logged an alert — no WO was ever
  auto-created on a live anomaly).
- **`services/maximoService.js`** — work orders now carry `generateType`; added
  `retrySingleSync` + `POST /api/maximo/sync/:id/retry` for one-click per-row retry.
- **`repositories/telemetryRepository.js`** — `getAssetHealthOverview()` now returns
  `sensors: { vibration, temperature, pressure }`, `mtbf`, `mtbfRemainingPct`,
  `assetnum`, `assetType`, and rule-engine `status`/`ruleReasons` — this is the shape
  the frontend (`HealthView`, `KpiCards`, `MLDashboardView`) already expected but
  wasn't receiving (a real pre-existing bug from an earlier backend rebuild).
- Added `GET /assets/health/history` and `GET /energy/history` to power the Module A
  trend chart with real data instead of a fabricated series.
- `ml-service/pipeline/anomaly_pipeline.py` — now tags its own auto-created work
  orders `AUTO_ML_PREDICTION` so origin badges are correct regardless of which path
  (live MQTT or the batch pipeline) created the WO.

## 3. Frontend modules (the requested priority)
- **Module A — `KpiCards.js`**: rewritten. Fleet Health Index, Maximo Sync %,
  Auto-WOs-today, Total Energy Load; a real fleet-health-vs-energy trend chart
  (recharts); asset status breakdown bar.
- **Module B — `HealthView.js`**: added MTBF-remaining bar and the rule engine's
  breach reasons inline on each asset card; asset num now shown (`ASSETNUM`).
- **Module E — `AlertsPanel.js`**: rewritten as the dual-pane list/detail layout —
  left list filterable by severity/asset, right pane shows the exact sensor
  telemetry at trigger time, threshold visuals, and a direct link to the
  auto-created Maximo WO.
- **Module F — `WorkOrdersView.js`**: merged with the old `MaximoSyncPanel`
  (now removed) into one view — origin badges (`AUTO-CRITICAL` / `AUTO-ML` /
  `MANUAL`), per-row sync status + one-click retry, retry-all, connection banner.
- Fixed a real bug: the old Work Orders view sent `wo.id` (a field that didn't
  exist in the API response) to the status-update endpoint, so status changes
  silently failed. Now uses `wonum` consistently, matching the OSLC/Maximo
  business key.

## 4. Bidirectional Maximo status sync (this pass)
- **`services/maximoService.js`** — new `pullStatusUpdates()`: polls every open,
  already-synced local work order against Maximo (`GET /oslc/os/mxapiwo`) and
  updates the local `status` (+ emits `workorder:updated`) when it's changed —
  e.g. an engineer moving a WO to `APPR`/`INPRG`/`COMP` inside Maximo now shows
  up on the dashboard without anyone touching our UI.
- Runs automatically every 2 minutes via cron (`server.js`), or on demand via
  the new **"↓ Pull status from Maximo"** button in Work Orders & Maximo Sync
  (`POST /api/maximo/sync/pull-status`, it_admin only).
- The other direction was previously broken too: changing a WO's status *from
  our own dashboard* only updated the local DB — it never told Maximo.
  `updateWorkOrderStatus()` now also pushes the change outward (best-effort,
  logged in `maximo_sync_log`, doesn't block the local update if Maximo is
  unreachable).
- Added `CLOSE` as a valid status end-to-end (was missing from the API's
  allow-list and the frontend's transition map) since it's a real terminal
  Maximo status that can now come back through the pull sync.

## 5. Live 3-sensor MQTT pipeline + recalibrated rule engine (this pass)
- The dataset previously had **no temperature or pressure at all** (pure
  vibration bearing-rig data) and was missing a profile for `AST-005` entirely.
  `generate_dataset.py` now synthesizes all three channels — vibration,
  temperature, pressure — correlated with the same per-asset degradation curve,
  for all 5 assets.
- `publisher.js` loaded temperature into memory but never actually published it
  over MQTT, and never touched pressure at all — both fixed; all three channels
  now flow live over `telemetry/{assetId}/{vibration|temperature|pressure}`.
- The rule engine's original thresholds assumed ISO-10816-style mm/s vibration
  values; this dataset's vibration channel is unitless RMS on a 0.05–0.7 scale.
  Recalibrated all three channels' warn/max bands against the actual generated
  data and validated the Healthy → Caution → Critical progression lines up with
  each asset's configured failure-onset day.
- `ingest_dataset.py` now writes real temperature/pressure instead of hardcoding
  `NULL` for temperature and omitting pressure entirely.


- **Module C (Energy)** and **Module D (ML prediction tool)** — left as-is beyond
  what already worked; `MLDashboardView.js` already reads `sensors.vibration/
  temperature/pressure` correctly, so it benefits from the backend fix, but its
  preset/asset-type sensitivity logic wasn't reworked in this pass.
- Real pressure telemetry — currently backfilled/derived, not read from a live
  sensor. Wire it in `mqttService.js`'s incoming payload once a real pressure
  channel exists on the MQTT topic.
