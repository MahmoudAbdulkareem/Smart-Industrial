const express = require("express");
const router = express.Router();
const mlController = require("../controllers/mlController");
const { requireAuth } = require("../middleware/auth");

router.post("/predict", requireAuth, mlController.predict);
router.get("/health", requireAuth, mlController.health);

module.exports = router;
