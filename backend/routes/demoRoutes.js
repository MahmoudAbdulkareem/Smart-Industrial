// routes/demoRoutes.js
//
// Presentation "Failure Injector" controls. These endpoints do not synthesize any
// frontend-visible data directly — they start/stop a real MQTT publisher
// (services/demoInjectorService.js) that feeds the exact same ingestion pipeline real
// sensors use, so every effect you see (health score drop, RUL countdown, digital twin
// hotspot, Maximo work order) is the real backend reacting to real (if operator-
// triggered) MQTT messages.
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const demoInjector = require("../services/demoInjectorService");
const { recordAudit } = require("../services/auditService");

router.get("/scenarios", requireAuth, (req, res) => {
    res.json({ scenarios: demoInjector.listScenarios() });
});

router.get("/status", requireAuth, (req, res) => {
    res.json({ running: demoInjector.getStatus() });
});

router.post("/start", requireAuth, requireRole("maintenance_engineer", "it_admin"), async (req, res) => {
    const { assetId, scenario } = req.body || {};
    if (!assetId || !scenario) {
        return res.status(400).json({ error: "assetId and scenario are required" });
    }
    try {
        const state = demoInjector.startScenario(assetId, scenario);
        try {
            await recordAudit(req.user.id, "DEMO_SCENARIO_STARTED", JSON.stringify({ assetId, scenario }));
        } catch { /* audit logging is best-effort */ }
        res.json({ success: true, assetId, state });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post("/stop", requireAuth, requireRole("maintenance_engineer", "it_admin"), async (req, res) => {
    const { assetId } = req.body || {};
    if (!assetId) return res.status(400).json({ error: "assetId is required" });
    const stopped = demoInjector.stopScenario(assetId);
    try {
        await recordAudit(req.user.id, "DEMO_SCENARIO_STOPPED", JSON.stringify({ assetId }));
    } catch { /* audit logging is best-effort */ }
    res.json({ success: true, stopped });
});

module.exports = router;
