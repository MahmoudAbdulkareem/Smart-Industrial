const express = require("express");
const router = express.Router();
const auditController = require("../controllers/auditController");
const { requireAuth, requireRole } = require("../middleware/auth");

router.get("/", requireAuth, requireRole("it_admin"), auditController.listAuditLogs);

module.exports = router;
