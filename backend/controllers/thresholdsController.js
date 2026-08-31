const { query, queryOne } = require("../db/pool");
const auditService = require("../services/auditService");

async function listThresholds(req, res) {
    try {
        res.json(await query(`SELECT asset_id, metric, value, updated_at FROM thresholds ORDER BY asset_id, metric`));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function setThreshold(req, res) {
    try {
        const { assetId, metric, value } = req.body;
        const existing = await queryOne(`SELECT id FROM thresholds WHERE asset_id=@assetId AND metric=@metric`, { assetId, metric });
        if (existing) {
            await query(`UPDATE thresholds SET value=@value, updated_at=GETDATE() WHERE asset_id=@assetId AND metric=@metric`, { assetId, metric, value });
        } else {
            await query(`INSERT INTO thresholds (asset_id, metric, value) VALUES (@assetId, @metric, @value)`, { assetId, metric, value });
        }
        await auditService.recordAudit(req.user.id, "THRESHOLD_SET", { assetId, metric, value });
        res.json({ assetId, metric, value });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { listThresholds, setThreshold };
