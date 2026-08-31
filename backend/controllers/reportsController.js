const reportService = require("../services/reportService");

async function downloadEnergyReport(req, res) {
    try {
        const format = (req.query.format || "html").toLowerCase();
        const date = new Date().toISOString().slice(0, 10);

        if (format === "excel" || format === "xlsx") {
            res.setHeader("Content-Type", "application/vnd.ms-excel");
            res.setHeader("Content-Disposition", `attachment; filename="energy-report-${date}.xls"`);
            return res.send(await reportService.generateExcelReport());
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="energy-report-${date}.html"`);
        res.send(await reportService.generateHtmlReport());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = { downloadEnergyReport };
