const energyService = require("../services/energyService");
const auditService = require("../services/auditService");

async function getSummary(req, res) {
    try {
        res.json(await energyService.buildAggregatedSnapshot());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getHistory(req, res) {
    try {
        const rows = await energyService.getEnergyHistory();
        // Aggregate electricity_kwh across zones into one fleet-wide total per hour bucket.
        const byHour = new Map();
        for (const r of rows) {
            const bucket = new Date(r.recorded_at);
            bucket.setMinutes(0, 0, 0);
            const key = bucket.toISOString();
            const existing = byHour.get(key) || { timestamp: key, kw: 0, count: 0 };
            existing.kw += r.electricity_kwh || 0;
            existing.count += 1;
            byHour.set(key, existing);
        }
        const series = Array.from(byHour.values())
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .map(p => ({ timestamp: p.timestamp, kw: parseFloat(p.kw.toFixed(1)) }));
        res.json(series);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getZones(req, res) {
    try {
        res.json(await energyService.getZones());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function upsertZone(req, res) {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: "Zone name required" });
        const updated = await energyService.upsertZone(name, req.body);
        await auditService.recordAudit(req.user.id, "ZONE_UPDATED", { zone: name });
        if (global.io) global.io.emit("energy:zone:updated", updated);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteZone(req, res) {
    try {
        const { name } = req.params;
        await energyService.deleteZone(name);
        await auditService.recordAudit(req.user.id, "ZONE_DELETED", { zone: name });
        if (global.io) global.io.emit("energy:zone:deleted", { zone: name });
        res.json({ message: "Zone deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getGoal(req, res) {
    try {
        res.json(await energyService.getGoal(req.user.id) || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function saveGoal(req, res) {
    try {
        const { target, deadline } = req.body;
        if (!target || !deadline) return res.status(400).json({ error: "Target and deadline required" });
        await energyService.saveGoal(req.user.id, target, deadline);
        await auditService.recordAudit(req.user.id, "GOAL_UPDATED", { target, deadline });
        res.json({ message: "Goal saved" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getAlerts(req, res) {
    try {
        res.json(await energyService.getAlerts(req.user.id));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function createAlert(req, res) {
    try {
        const { threshold, action, message } = req.body;
        if (!threshold || !action) return res.status(400).json({ error: "Threshold and action required" });
        await energyService.createAlert(req.user.id, threshold, action, message);
        await auditService.recordAudit(req.user.id, "ALERT_CREATED", { threshold, action });
        res.json({ message: "Alert created" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function acknowledgeAlert(req, res) {
    try {
        const id = parseInt(req.params.id);
        await energyService.acknowledgeAlert(id, req.user.id);
        await auditService.recordAudit(req.user.id, "ALERT_ACKNOWLEDGED", { alertId: id });
        res.json({ message: "Alert acknowledged" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getSchedules(req, res) {
    try {
        res.json(await energyService.getSchedules(req.user.id));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function createSchedule(req, res) {
    try {
        const { time, action, target } = req.body;
        if (!time || !action) return res.status(400).json({ error: "Time and action required" });
        await energyService.createSchedule(req.user.id, time, action, target);
        await auditService.recordAudit(req.user.id, "SCHEDULE_CREATED", { time, action });
        res.json({ message: "Schedule created" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteSchedule(req, res) {
    try {
        const id = parseInt(req.params.id);
        await energyService.deleteSchedule(id, req.user.id);
        await auditService.recordAudit(req.user.id, "SCHEDULE_DELETED", { scheduleId: id });
        res.json({ message: "Schedule deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getSummary, getHistory, getZones, upsertZone, deleteZone,
    getGoal, saveGoal, getAlerts, createAlert, acknowledgeAlert,
    getSchedules, createSchedule, deleteSchedule,
};
