// routes/workordersRoutes.js
const express = require("express");
const router = express.Router();
const { query, queryOne } = require("../db/pool");
const { requireAuth, requireRole } = require("../middleware/auth");

// Get work order metrics for dashboard
router.get("/metrics", requireAuth, async (req, res) => {
    try {
        const metrics = await queryOne(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'WAPPR' THEN 1 ELSE 0 END) as waiting_approval,
                SUM(CASE WHEN status = 'APPR' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'INPRG' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'WMATL' THEN 1 ELSE 0 END) as waiting_material,
                SUM(CASE WHEN status = 'COMP' THEN 1 ELSE 0 END) as complete,
                SUM(CASE WHEN status = 'CLOSE' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN status = 'CAN' THEN 1 ELSE 0 END) as cancelled,
                AVG(DATEDIFF(HOUR, created_at, GETUTCDATE())) as avg_hours_open,
                MAX(DATEDIFF(HOUR, created_at, GETUTCDATE())) as max_hours_open
             FROM maximo_workorders
             WHERE created_at > DATEADD(DAY, -30, GETUTCDATE())`
        );
        res.json(metrics || { total: 0 });
    } catch (error) {
        console.error('Failed to get work order metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update work order status
router.patch("/:wonum/status", requireAuth, async (req, res) => {
    try {
        const { wonum } = req.params;
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ error: "status is required" });
        }
        
        const result = await queryOne(
            `UPDATE maximo_workorders 
             SET status = @status, updated_at = GETUTCDATE() 
             OUTPUT INSERTED.* 
             WHERE wonum = @wonum`,
            { wonum, status }
        );
        
        if (!result) {
            return res.status(404).json({ error: "Work order not found" });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Failed to update work order status:', error);
        res.status(500).json({ error: error.message });
    }
});

// List work orders (with optional status filter)
router.get("/", requireAuth, async (req, res) => {
    try {
        const { status } = req.query;
        let queryText = `
            SELECT wo.id, wo.wonum, wo.asset_id AS assetId, a.name AS assetName, 
                   wo.assetnum, wo.siteid, wo.description, wo.worktype, 
                   wo.priority, wo.status, wo.generate_type AS generateType,
                   wo.reported_by AS reportedBy, wo.created_at AS createdAt, 
                   wo.updated_at AS updatedAt
            FROM maximo_workorders wo
            LEFT JOIN assets a ON a.id = wo.asset_id
        `;
        
        const params = [];
        if (status) {
            queryText += ` WHERE wo.status = @status`;
            params.push({ name: 'status', value: status });
        }
        
        queryText += ` ORDER BY wo.created_at DESC`;
        
        const result = await query(queryText, params);
        res.json(result);
    } catch (error) {
        console.error('Failed to list work orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single work order
router.get("/:wonum", requireAuth, async (req, res) => {
    try {
        const { wonum } = req.params;
        const result = await queryOne(
            `SELECT wo.id, wo.wonum, wo.asset_id AS assetId, a.name AS assetName, 
                    wo.assetnum, wo.siteid, wo.description, wo.worktype, 
                    wo.priority, wo.status, wo.generate_type AS generateType,
                    wo.reported_by AS reportedBy, wo.mif_payload AS payload,
                    wo.created_at AS createdAt, wo.updated_at AS updatedAt
             FROM maximo_workorders wo
             LEFT JOIN assets a ON a.id = wo.asset_id
             WHERE wo.wonum = @wonum`,
            { wonum }
        );
        
        if (!result) {
            return res.status(404).json({ error: "Work order not found" });
        }
        
        res.json(result);
    } catch (error) {
        console.error('Failed to get work order:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create work order
router.post("/", requireAuth, requireRole("maintenance_engineer"), async (req, res) => {
    try {
        const { assetId, description, priority, siteId } = req.body;
        
        if (!assetId || !description) {
            return res.status(400).json({ error: "assetId and description are required" });
        }
        
        const result = await require("../services/maximoService").createLocalWorkOrder({
            assetId,
            description,
            priority: priority || 2,
            createdBy: req.user?.name || "SYSTEM",
            siteId: siteId || process.env.MAXIMO_SITE_ID || "BEDFORD",
        });
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Failed to create work order:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;