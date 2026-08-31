// controllers/maximoController.js
const maximoService = require("../services/maximoService");
const maximoClient = require("../services/maximoClient");

async function testConnection(req, res) {
    if (!maximoClient.isConfigured()) {
        return res.status(400).json({ configured: false, error: "MAXIMO_BASE_URL and MAXIMO_API_KEY not set in .env" });
    }
    try {
        const response = await maximoClient.testConnection();
        res.json({ configured: true, connected: true, sample: response });
    } catch (error) {
        res.status(502).json({ configured: true, connected: false, error: error.message, detail: error.body || null });
    }
}

async function pullStatusUpdates(req, res) {
    try {
        const result = await maximoService.pullStatusUpdates();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function retrySyncs(req, res) {
    try {
        const result = await maximoService.retryPendingSyncs();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function retrySingleSync(req, res) {
    try {
        const result = await maximoService.retrySingleSync(parseInt(req.params.id));
        res.json(result);
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

async function getWorkOrder(req, res) {
    try {
        const workOrder = await maximoService.getWorkOrder(req.params.wonum);
        if (!workOrder) return res.status(404).json({ error: "Not found" });
        res.json(workOrder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function createWorkOrder(req, res) {
    try {
        const workOrderData = req.body;
        
        if (!workOrderData.assetId || !workOrderData.description) {
            return res.status(400).json({ 
                error: "assetId and description are required" 
            });
        }
        
        console.log('Creating work order with data:', workOrderData);
        
        const result = await maximoService.createLocalWorkOrder({
            assetId: workOrderData.assetId,
            description: workOrderData.description,
            priority: workOrderData.priority || 2,
            createdBy: req.user?.name || "SYSTEM",
            siteId: workOrderData.siteId || process.env.MAXIMO_SITE_ID || "BEDFORD",
        });
        
        console.log('Work order created:', result);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating work order:', error);
        res.status(500).json({ error: error.message });
    }
}

// Get assets from Maximo
async function getAssets(req, res) {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        
        if (!maximoClient.isConfigured()) {
            return res.json([]);
        }
        
        const assets = await maximoClient.fetchAssets(limit);
        res.json(assets);
    } catch (error) {
        console.error('Error fetching assets:', error.message);
        res.json([]);
    }
}

// Sync assets from Maximo to local database
async function syncAssets(req, res) {
    try {
        if (!maximoClient.isConfigured()) {
            return res.status(400).json({ 
                error: "Maximo is not configured. Set MAXIMO_BASE_URL and MAXIMO_API_KEY in .env" 
            });
        }
        
        const result = await maximoService.syncAssetsFromMaximo();
        res.json(result);
    } catch (error) {
        console.error('Error syncing assets:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack 
        });
    }
}

async function receiveMifPayload(req, res) {
    try {
        const payload = req.body;
        if (!payload?.wonum || !payload?.assetnum) {
            return res.status(400).json({ error: "wonum and assetnum required in MIF payload" });
        }
        const workOrder = await maximoService.createLocalWorkOrder({
            assetId: payload.assetnum,
            description: payload.description || "Externally sourced work order",
            priority: payload.priority,
            createdBy: payload.reportedby || "MAXIMO_MIF",
        });
        res.status(201).json(workOrder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function listPendingSyncs(req, res) {
    try {
        res.json(await maximoService.listPendingSyncs());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function listRecentSyncs(req, res) {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        res.json(await maximoService.listRecentSyncs(limit));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateSyncStatus(req, res) {
    try {
        const { id } = req.params;
        const { syncStatus, responsePayload, errorMessage } = req.body;
        await maximoService.updateSyncStatus(parseInt(id), syncStatus, responsePayload, errorMessage);
        res.json({ updated: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { 
    listWorkOrders, 
    getWorkOrder, 
    receiveMifPayload, 
    listPendingSyncs, 
    listRecentSyncs, 
    updateSyncStatus, 
    testConnection, 
    retrySyncs,
    retrySingleSync,
    pullStatusUpdates,
    createWorkOrder,
    getAssets,
    syncAssets,
};