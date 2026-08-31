const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const { requireAuth } = require("../middleware/auth");

router.get("/energy", requireAuth, reportsController.downloadEnergyReport);

module.exports = router;
