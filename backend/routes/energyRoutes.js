const express = require("express");
const router = express.Router();
const energyController = require("../controllers/energyController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, energyController.getSummary);
router.get("/history", requireAuth, energyController.getHistory);
router.get("/zones", requireAuth, energyController.getZones);
router.post("/zones", requireAuth, requireRole("energy_manager"), energyController.upsertZone);
router.delete("/zones/:name", requireAuth, requireRole("energy_manager"), energyController.deleteZone);

router.get("/goals", requireAuth, energyController.getGoal);
router.post("/goals", requireAuth, requireRole("energy_manager"), energyController.saveGoal);

router.get("/alerts", requireAuth, energyController.getAlerts);
router.post("/alerts", requireAuth, requireRole("energy_manager"), energyController.createAlert);
router.patch("/alerts/:id/acknowledge", requireAuth, energyController.acknowledgeAlert);

router.get("/schedules", requireAuth, energyController.getSchedules);
router.post("/schedules", requireAuth, requireRole("energy_manager"), energyController.createSchedule);
router.delete("/schedules/:id", requireAuth, requireRole("energy_manager"), energyController.deleteSchedule);

module.exports = router;
