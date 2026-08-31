const alertRepository = require("../repositories/alertRepository");
const notificationService = require("../services/notificationService");

async function createAlert(req, res) {
    try {
        const { assetId, assetName, severity, message } = req.body;
        if (!assetId || !message) return res.status(400).json({ success: false, message: "Asset ID and message are required" });

        const alertId = await alertRepository.createAlert(assetId, severity, message);
        const alert = await alertRepository.getAlertById(alertId);

        await notificationService.sendAlertNotification(alert, assetName || assetId);
        if (global.io) global.io.emit("alert:new", alert);

        res.status(201).json({ success: true, data: alert, message: "Alert created and notifications sent" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to create alert" });
    }
}

async function testNotifications(req, res) {
    try {
        const windowMinutes = parseInt(req.body.windowMinutes || process.env.ALERT_WINDOW_MINUTES || "15", 10);
        const alerts = await alertRepository.listUnacknowledgedSince(windowMinutes);

        if (!alerts.length) {
            return res.json({ success: true, message: `No new unacknowledged alerts in the last ${windowMinutes} minute(s).` });
        }

        await Promise.all(alerts.map((alert) => notificationService.sendAlertNotification(alert, alert.asset_name || alert.asset_id)));
        if (global.io) alerts.forEach((alert) => global.io.emit("alert:new", alert));

        res.json({ success: true, message: `Sent email notifications for ${alerts.length} new alert(s).`, count: alerts.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || "Failed to send test notification" });
    }
}

async function acknowledge(req, res) {
    try {
        const id = parseInt(req.params.id);
        const alert = await alertRepository.acknowledgeAlert(id, req.user.id);
        if (global.io) global.io.emit("alert:acknowledged", alert);
        res.json({ success: true, data: alert, message: "Alert acknowledged" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to acknowledge alert" });
    }
}

async function listAll(req, res) {
    try {
        res.json(await alertRepository.listAllAlerts());
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch alerts" });
    }
}

module.exports = { createAlert, testNotifications, acknowledge, listAll };
