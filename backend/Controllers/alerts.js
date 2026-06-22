// backend/routes/alerts.js
const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../DataBase/db');
const { requireAuth } = require('../MiddleWare/auth');
const { sendAlertNotification } = require('../services/notificationService');

// POST /api/alerts - Create a new alert
router.post('/', async (req, res) => {
    try {
        const { assetId, assetName, severity, message, metadata } = req.body;

        if (!assetId || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Asset ID and message are required' 
            });
        }

        // Insert alert
        const result = await query(`
            INSERT INTO alerts (asset_id, severity, message, created_at)
            VALUES (@assetId, @severity, @message, GETDATE())
        `, {
            assetId,
            severity: severity || 'info',
            message
        });

        const alert = await queryOne(
            `SELECT * FROM alerts WHERE id = @id`,
            { id: result.insertId || result.id }
        );

        // Send email notification
        await sendAlertNotification(alert, assetName || assetId);

        // Emit socket event
        if (global.io) {
            global.io.emit('alert:new', alert);
        }

        res.status(201).json({
            success: true,
            data: alert,
            message: 'Alert created and notifications sent'
        });

    } catch (error) {
        console.error('[Alerts] Create error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create alert' 
        });
    }
});

// POST /api/alerts/test - Test notification
router.post('/test', requireAuth, async (req, res) => {
    try {
        const testAlert = {
            id: 'TEST-' + Date.now(),
            asset_id: 'TEST-ASSET',
            severity: 'critical',
            message: '🧪 TEST ALERT: This is a test notification to verify email delivery',
            created_at: new Date()
        };

        await sendAlertNotification(testAlert, 'Test Asset');

        // Also emit socket for UI testing
        if (global.io) {
            global.io.emit('alert:new', {
                ...testAlert,
                id: Date.now()
            });
        }

        res.json({
            success: true,
            message: 'Test notification sent successfully'
        });

    } catch (error) {
        console.error('[Alerts] Test error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to send test notification' 
        });
    }
});

// PATCH /api/alerts/:id/acknowledge - Acknowledge an alert
router.patch('/:id/acknowledge', requireAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user.id;

        await query(`
            UPDATE alerts 
            SET acknowledged = 1, 
                acknowledged_by = @userId, 
                acknowledged_at = GETDATE()
            WHERE id = @id
        `, { id, userId });

        const alert = await queryOne(`
            SELECT a.*, u.name as acknowledged_by_name
            FROM alerts a
            LEFT JOIN users u ON u.id = a.acknowledged_by
            WHERE a.id = @id
        `, { id });

        if (global.io) {
            global.io.emit('alert:acknowledged', alert);
        }

        res.json({
            success: true,
            data: alert,
            message: 'Alert acknowledged'
        });

    } catch (error) {
        console.error('[Alerts] Acknowledge error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to acknowledge alert' 
        });
    }
});

// GET /api/alerts - Get all alerts
router.get('/', requireAuth, async (req, res) => {
    try {
        const alerts = await query(`
            SELECT a.*, 
                   u.name as acknowledged_by_name,
                   ast.name as asset_name
            FROM alerts a
            LEFT JOIN users u ON u.id = a.acknowledged_by
            LEFT JOIN assets ast ON ast.id = a.asset_id
            ORDER BY a.created_at DESC
        `);
        res.json(alerts);
    } catch (error) {
        console.error('[Alerts] Fetch error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch alerts' 
        });
    }
});

module.exports = router;