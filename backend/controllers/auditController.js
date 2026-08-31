const auditService = require("../services/auditService");

async function listAuditLogs(req, res) {
    try {
        const limit = Math.min(parseInt(req.query.limit || 100), 500);
        const offset = parseInt(req.query.offset || 0);
        const userId = req.query.userId ? parseInt(req.query.userId) : null;
        res.json(await auditService.listAuditLogs(limit, offset, userId));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { listAuditLogs };
