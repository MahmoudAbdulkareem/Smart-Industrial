// routes/intelligenceRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { requireAuth, requireRole } = require("../middleware/auth");
const workOrderIntelligence = require("../services/workOrderIntelligenceService");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const validTypes = ['text/csv', 'application/json', 'text/plain'];
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (validTypes.includes(file.mimetype) || ['csv', 'json'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and JSON files are allowed'));
        }
    }
});

/**
 * Export work order dataset
 */
router.get("/export", requireAuth, async (req, res) => {
    try {
        const { format = 'csv' } = req.query;
        const result = await workOrderIntelligence.downloadDataset(format);
        
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.content);
    } catch (error) {
        console.error('[Export] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Upload dataset for ML training
 */
router.post("/upload", requireAuth, requireRole("it_admin"), upload.single('file'), async (req, res) => {
    try {
        console.log('[Upload] Received file upload request');
        
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        
        console.log(`[Upload] File: ${req.file.originalname}, Size: ${req.file.size} bytes`);
        
        const result = await workOrderIntelligence.uploadDataset(req.file);
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('[Upload] Error:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

/**
 * Find similar work orders and solutions
 */
router.post("/find-solutions", requireAuth, async (req, res) => {
    try {
        const { description } = req.body;
        
        if (!description) {
            return res.status(400).json({ error: "Description is required" });
        }
        
        const result = await workOrderIntelligence.findSimilarWorkOrders(description);
        res.json(result);
    } catch (error) {
        console.error("[Intelligence] Find solutions error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Predict resolution time
 */
router.post("/predict-resolution", requireAuth, async (req, res) => {
    try {
        const workOrder = req.body;
        const prediction = await workOrderIntelligence.predictResolutionTime(workOrder);
        res.json(prediction);
    } catch (error) {
        console.error("[Intelligence] Predict resolution error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate AI solution
 */
router.post("/generate-solution", requireAuth, async (req, res) => {
    try {
        const workOrder = req.body;
        const solution = await workOrderIntelligence.generateAISolution(workOrder);
        res.json(solution);
    } catch (error) {
        console.error("[Intelligence] Generate AI solution error:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get model status
 */
router.get("/model-status", requireAuth, async (req, res) => {
    try {
        const status = workOrderIntelligence.getModelStatus();
        res.json(status);
    } catch (error) {
        console.error("[Intelligence] Model status error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;