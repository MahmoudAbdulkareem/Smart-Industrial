const express = require("express");
const router = express.Router();
const thresholdsController = require("../controllers/thresholdsController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, thresholdsController.listThresholds);
router.post("/", requireAuth, requireRole("energy_manager"), thresholdsController.setThreshold);

module.exports = router;
