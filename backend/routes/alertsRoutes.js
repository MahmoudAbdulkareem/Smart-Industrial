const express = require("express");
const router = express.Router();
const alertsController = require("../controllers/alertsController");
const { requireAuth } = require("../middleware/auth");

router.post("/", requireAuth, alertsController.createAlert);
router.post("/test", requireAuth, alertsController.testNotifications);
router.patch("/:id/acknowledge", requireAuth, alertsController.acknowledge);
router.get("/", requireAuth, alertsController.listAll);

module.exports = router;
