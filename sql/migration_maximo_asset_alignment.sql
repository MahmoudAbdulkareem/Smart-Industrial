-- ═══════════════════════════════════════════════════════════════════════
--  Migration: IBM Maximo Asset Model Alignment
--  Run once against the existing SmartDashboard database, after
--  base_schema.sql, schema_extension.sql, and migration_module_alignment.sql.
--  Safe to re-run: every change is guarded by an existence check.
--
--  Context: backend/services/maximoService.js previously read/wrote a table
--  called `maximo_asset_mappings` that was never created anywhere — every
--  asset-resolution call for outbound work orders silently failed and fell
--  back to sending the local AST-00x ID as the Maximo `assetnum`. That code
--  has been fixed to use the real `maximo_assets` table (schema_extension.sql)
--  instead. This migration:
--    1. Adds the fields IBM Maximo's asset model expects but the local
--       `assets` table was missing (site_id, status, properties/spec set).
--    2. Backfills those fields from `maximo_assets` where a mapping exists.
--    3. Ensures every asset seeded in `assets` has a `maximo_assets` row,
--       so resolveMaximoAssetnum() always has something to find.
-- ═══════════════════════════════════════════════════════════════════════
USE SmartDashboard;
GO

-- ── 1. site_id on the local asset model (Maximo: SITEID) ───────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'site_id')
BEGIN
    ALTER TABLE assets ADD site_id NVARCHAR(20) NULL;
END
GO

-- ── 2. status on the local asset model (Maximo: STATUS, e.g. OPERATING /
--      NOT READY / DECOMMISSIONED) — previously only tracked inside
--      maximo_assets and never on the asset itself, so nothing local could
--      answer "is this asset in service" without a join. ────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'status')
BEGIN
    ALTER TABLE assets ADD status NVARCHAR(25) NOT NULL DEFAULT 'OPERATING';
END
GO

-- ── 3. properties on the local asset model (Maximo: ASSETSPEC attribute
--      set) — free-form JSON so asset-type-specific attributes (e.g. rated
--      RPM, bearing spec, refrigerant type) can be attached without a
--      schema change per asset type. ────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('assets') AND name = 'properties')
BEGIN
    ALTER TABLE assets ADD properties NVARCHAR(MAX) NULL; -- JSON
END
GO

-- ── 4. Backfill site_id / status on `assets` from the existing
--      maximo_assets mapping, where one already exists. ─────────────────
UPDATE a
SET a.site_id = ma.siteid,
    a.status  = ma.status
FROM assets a
INNER JOIN maximo_assets ma ON ma.asset_id = a.id
WHERE a.site_id IS NULL OR a.site_id <> ma.siteid OR a.status <> ma.status;
GO

-- Any asset still without a site_id (no maximo_assets row at all) gets the
-- default site so the column is never NULL going forward.
UPDATE assets SET site_id = 'BEDFORD' WHERE site_id IS NULL;
GO

-- ── 5. Ensure every local asset has a maximo_assets row, so
--      resolveMaximoAssetnum() in maximoService.js always finds a match
--      instead of falling back to "send the local ID and hope Maximo
--      accepts it". Uses the local id as a placeholder assetnum — replace
--      with real Maximo asset numbers per the README before going live:
--        UPDATE maximo_assets SET assetnum = 'REAL-ASSET-NUM' WHERE asset_id = 'AST-001';
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO maximo_assets (asset_id, assetnum, siteid, status, description)
SELECT a.id, a.id, 'BEDFORD', 'OPERATING', a.name
FROM assets a
LEFT JOIN maximo_assets ma ON ma.asset_id = a.id
WHERE ma.id IS NULL;
GO
