// routes/maximoRoutes.js
const express = require("express");
const router = express.Router();
const maximoController = require("../controllers/maximoController");
const { requireAuth, requireRole } = require("../middleware/auth");

// OSLC endpoints
router.get("/oslc/os/mxapiwo", requireAuth, maximoController.listWorkOrders);
router.get("/oslc/os/mxapiwo/:wonum", requireAuth, maximoController.getWorkOrder);
router.post("/oslc/os/mxapiwo", requireAuth, maximoController.receiveMifPayload);

// Work Order Management
router.post("/work-orders", requireAuth, maximoController.createWorkOrder);

// Asset Management
router.get("/assets", requireAuth, maximoController.getAssets);

// Sync management
router.get("/sync/pending", requireAuth, requireRole("it_admin"), maximoController.listPendingSyncs);
router.get("/sync/recent", requireAuth, requireRole("it_admin"), maximoController.listRecentSyncs);
router.patch("/sync/:id", requireAuth, requireRole("it_admin"), maximoController.updateSyncStatus);
router.post("/sync/retry", requireAuth, requireRole("it_admin"), maximoController.retrySyncs);
router.post("/sync/:id/retry", requireAuth, requireRole("it_admin"), maximoController.retrySingleSync);
router.post("/sync/pull-status", requireAuth, requireRole("it_admin"), maximoController.pullStatusUpdates);

// Sync assets endpoint
router.post("/sync-assets", requireAuth, requireRole("it_admin"), maximoController.syncAssets);

// Connection test
router.get("/test-connection", maximoController.testConnection);

module.exports = router;