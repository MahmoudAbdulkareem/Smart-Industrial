// server.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
process.env.JWT_SECRET = process.env.JWT_SECRET || "smartdashboard_dev_secret_2026_fallback";

const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");

const { initSocket } = require("./services/socketService");
const { startMqttListener } = require("./services/mqttService");
const { startBroadcastLoop } = require("./services/broadcastService");
const energyService = require("./services/energyService");
const maximoService = require("./services/maximoService");
const { query } = require("./db/pool");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const assetsRoutes = require("./routes/assetsRoutes");
const energyRoutes = require("./routes/energyRoutes");
const maximoRoutes = require("./routes/maximoRoutes");
const alertsRoutes = require("./routes/alertsRoutes");
const chatRoutes = require("./routes/chatRoutes");
const usersRoutes = require("./routes/usersRoutes");
const mlRoutes = require("./routes/mlRoutes");
const thresholdsRoutes = require("./routes/thresholdsRoutes");
const auditRoutes = require("./routes/auditRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const workorderRoutes = require("./routes/workordersRoutes");
const intelligenceRoutes = require("./routes/intelligenceRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes"); // NEW
const demoRoutes = require("./routes/demoRoutes");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 30, validate: { xForwardedForHeader: false } }));

// Socket.io
const io = initSocket(server);
global.io = io;

// Health check
app.get("/", (req, res) => res.json({ ok: true, status: "Smart Dashboard API" }));
app.get("/api/status", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ============================================
// REGISTER ROUTES
// ============================================
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetsRoutes);
app.use("/api/energy", energyRoutes);
app.use("/api/workorders", workorderRoutes);
app.use("/api/maximo", maximoRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/thresholds", thresholdsRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/intelligence", intelligenceRoutes);
app.use("/api/maintenance", maintenanceRoutes); // NEW - For Predictive Calendar & Anomaly Playground
app.use("/api/demo", demoRoutes); // Real MQTT-backed failure injector for live demos

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// Cron jobs
cron.schedule("0 * * * *", () => energyService.ensureEnergySchema().catch(() => {}));
cron.schedule("30 2 * * *", () => query("EXEC usp_PurgeSensorReadings @DaysToKeep = 30").catch(() => {}));
cron.schedule("*/5 * * * *", () => maximoService.retryPendingSyncs().catch(() => {}));
cron.schedule("*/2 * * * *", () => maximoService.pullStatusUpdates().catch((err) => console.error("[cron] pullStatusUpdates failed:", err.message)));

// Start server
server.listen(PORT, async () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`  - /api/workorders/metrics`);
    console.log(`  - /api/maximo/test-connection`);
    console.log(`  - /api/intelligence/export`);
    console.log(`  - /api/maintenance/predictions`);
    console.log(`  - /api/maintenance/anomaly-data`);
    console.log(`\n⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await energyService.ensureEnergySchema();
    startBroadcastLoop();
    try {
        startMqttListener();
    } catch (error) {
        console.error("MQTT listener failed to start:", error.message);
    }
});