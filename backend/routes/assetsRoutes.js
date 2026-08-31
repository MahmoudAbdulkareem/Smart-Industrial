const express = require("express");
const router = express.Router();
const assetsController = require("../controllers/assetsController");
const { requireAuth } = require("../middleware/auth");

router.get("/health", requireAuth, assetsController.getHealthOverview);
router.get("/health/history", requireAuth, assetsController.getFleetHealthHistory);
router.get("/anomalies", requireAuth, assetsController.getActiveAnomalies);
router.get("/:assetId/telemetry", requireAuth, assetsController.getTelemetryHistory);
router.get("/:assetId/inferences", requireAuth, assetsController.getInferenceHistory);

module.exports = router;
