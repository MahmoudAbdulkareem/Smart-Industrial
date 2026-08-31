const mlProxyService = require("../services/mlProxyService");

async function predict(req, res) {
    try {
        res.json(await mlProxyService.predict(req.body));
    } catch (error) {
        res.status(503).json({ error: "ML unavailable", detail: error.message });
    }
}

async function health(req, res) {
    try {
        const status = await mlProxyService.checkHealth();
        res.json({ ...status, proxy: "ok" });
    } catch (error) {
        res.status(503).json({ status: "degraded", error: error.message });
    }
}

module.exports = { predict, health };
