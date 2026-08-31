const maximoService = require("../services/maximoService");
const auditService = require("../services/auditService");

async function createWorkOrder(req, res) {
    try {
        const { assetId, description, priority } = req.body;
        if (!assetId || !description) return res.status(400).json({ error: "assetId and description required" });
        const workOrder = await maximoService.createLocalWorkOrder({
            assetId, description, priority, createdBy: req.user.name,
        });
        await auditService.recordAudit(req.user.id, "WORKORDER_CREATED", { wonum: workOrder.wonum, assetId });
        if (global.io) global.io.emit("workorder:created", workOrder);
        res.status(201).json(workOrder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function listWorkOrders(req, res) {
    try {
        res.json(await maximoService.listWorkOrders(req.query.status));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateStatus(req, res) {
    try {
        const { wonum } = req.params;
        const { status } = req.body;
        const validStatuses = ["WAPPR", "APPR", "INPRG", "WMATL", "COMP", "CLOSE", "CAN"];
        if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

        const updated = await maximoService.updateWorkOrderStatus(wonum, status);
        if (!updated) return res.status(404).json({ error: "Not found" });

        await auditService.recordAudit(req.user.id, "WORKORDER_STATUS_UPDATED", { wonum, status });
        if (global.io) global.io.emit("workorder:updated", updated);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { createWorkOrder, listWorkOrders, updateStatus };
