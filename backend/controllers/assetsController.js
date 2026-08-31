const telemetryRepository = require("../repositories/telemetryRepository");

async function getHealthOverview(req, res) {
    try {
        res.json(await telemetryRepository.getAssetHealthOverview());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getFleetHealthHistory(req, res) {
    try {
        const hours = req.query.hours ? parseInt(req.query.hours) : 24;
        res.json(await telemetryRepository.getFleetHealthHistory(hours));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getTelemetryHistory(req, res) {
    try {
        const { assetId } = req.params;
        const fromDate = req.query.from || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const toDate = req.query.to || new Date().toISOString();
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        res.json(await telemetryRepository.getTelemetryHistory(assetId, fromDate, toDate, limit));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getInferenceHistory(req, res) {
    try {
        const { assetId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        res.json(await telemetryRepository.getInferenceHistory(assetId, limit));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getActiveAnomalies(req, res) {
    try {
        res.json(await telemetryRepository.getActiveAnomalies());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { getHealthOverview, getFleetHealthHistory, getTelemetryHistory, getInferenceHistory, getActiveAnomalies };
