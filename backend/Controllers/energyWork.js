require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

process.env.JWT_SECRET = process.env.JWT_SECRET || "smartdashboard_dev_secret_2026_fallback";

const express = require('express');
const router = express.Router();
const { query, queryOne } = require("../DataBase/db");
const { requireAuth, requireRole } = require("../MiddleWare/auth");

// ==========================================
// ENERGY AUDIT MANAGEMENT
// ==========================================

// POST /api/energy/audit - Create energy audit work order
router.post('/audit', requireAuth, requireRole('energy_manager'), async (req, res) => {
    try {
        const { title, description, priority, assetId, zoneId, scheduledDate, estimatedSavings } = req.body;
        
        // Validate required fields
        if (!title || !description) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title and description are required' 
            });
        }

        // Generate work order ID
        const countResult = await queryOne("SELECT COUNT(*) as count FROM energy_audits");
        const count = countResult?.count || 0;
        const workOrderId = `EA-${String(count + 1).padStart(4, '0')}`;
        
        // Insert audit
        await query(`
            INSERT INTO energy_audits (
                work_order_id, title, description, priority, status, 
                created_by, asset_id, zone_id, scheduled_date, 
                estimated_savings, created_at, updated_at
            ) VALUES (
                @workOrderId, @title, @description, @priority, 'pending',
                @createdBy, @assetId, @zoneId, @scheduledDate,
                @estimatedSavings, GETDATE(), GETDATE()
            )
        `, {
            workOrderId,
            title,
            description,
            priority: priority || 'medium',
            createdBy: req.user.id,
            assetId: assetId || null,
            zoneId: zoneId || null,
            scheduledDate: scheduledDate || null,
            estimatedSavings: estimatedSavings || 0
        });

        // Get the created audit
        const audit = await queryOne(`
            SELECT ea.*, u.name as created_by_name, u.email as created_by_email
            FROM energy_audits ea
            LEFT JOIN users u ON u.id = ea.created_by
            WHERE ea.work_order_id = @workOrderId
        `, { workOrderId });

        // Log activity
        await query(`
            INSERT INTO audit_logs (user_id, action, details) 
            VALUES (@userId, 'CREATE_ENERGY_AUDIT', @details)
        `, {
            userId: req.user.id,
            details: JSON.stringify({ workOrderId, title, priority })
        });

        // Emit socket event
        if (global.io) {
            global.io.emit('energy:audit:created', audit);
        }

        res.status(201).json({
            success: true,
            data: audit,
            message: `Energy audit work order ${workOrderId} created successfully`
        });

    } catch (error) {
        console.error('[Energy Audit] Create error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create energy audit work order' 
        });
    }
});

// GET /api/energy/audit - Get all energy audits
router.get('/audit', requireAuth, async (req, res) => {
    try {
        const { status, priority, zoneId, assetId, startDate, endDate } = req.query;
        let sql = `
            SELECT ea.*, 
                   u.name as created_by_name, u.email as created_by_email,
                   a.name as asset_name, a.location as asset_location,
                   z.name as zone_name
            FROM energy_audits ea
            LEFT JOIN users u ON u.id = ea.created_by
            LEFT JOIN assets a ON a.id = ea.asset_id
            LEFT JOIN zones z ON z.id = ea.zone_id
            WHERE 1=1
        `;
        const params = {};

        if (status) {
            sql += ` AND ea.status = @status`;
            params.status = status;
        }
        if (priority) {
            sql += ` AND ea.priority = @priority`;
            params.priority = priority;
        }
        if (zoneId) {
            sql += ` AND ea.zone_id = @zoneId`;
            params.zoneId = zoneId;
        }
        if (assetId) {
            sql += ` AND ea.asset_id = @assetId`;
            params.assetId = assetId;
        }
        if (startDate) {
            sql += ` AND ea.created_at >= @startDate`;
            params.startDate = new Date(startDate);
        }
        if (endDate) {
            sql += ` AND ea.created_at <= @endDate`;
            params.endDate = new Date(endDate);
        }

        sql += ` ORDER BY ea.created_at DESC`;

        const audits = await query(sql, params);
        res.json({ success: true, data: audits });

    } catch (error) {
        console.error('[Energy Audit] Fetch error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch energy audits' 
        });
    }
});

// GET /api/energy/audit/:id - Get single audit
router.get('/audit/:id', requireAuth, async (req, res) => {
    try {
        const audit = await queryOne(`
            SELECT ea.*, 
                   u.name as created_by_name, u.email as created_by_email,
                   a.name as asset_name, a.location as asset_location,
                   z.name as zone_name
            FROM energy_audits ea
            LEFT JOIN users u ON u.id = ea.created_by
            LEFT JOIN assets a ON a.id = ea.asset_id
            LEFT JOIN zones z ON z.id = ea.zone_id
            WHERE ea.id = @id
        `, { id: parseInt(req.params.id) });

        if (!audit) {
            return res.status(404).json({ 
                success: false, 
                message: 'Audit not found' 
            });
        }

        res.json({ success: true, data: audit });

    } catch (error) {
        console.error('[Energy Audit] Fetch single error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch energy audit' 
        });
    }
});

// PUT /api/energy/audit/:id - Update audit
router.put('/audit/:id', requireAuth, requireRole('energy_manager'), async (req, res) => {
    try {
        const { status, assignedTo, findings, priority, scheduledDate, estimatedSavings } = req.body;
        const id = parseInt(req.params.id);

        // Check if audit exists
        const audit = await queryOne("SELECT * FROM energy_audits WHERE id = @id", { id });
        if (!audit) {
            return res.status(404).json({ 
                success: false, 
                message: 'Audit not found' 
            });
        }

        // Build update query
        const updates = [];
        const params = { id };

        if (status) {
            updates.push("status = @status");
            params.status = status;
            if (status === 'completed') {
                updates.push("completed_date = GETDATE()");
            }
        }
        if (assignedTo) {
            updates.push("assigned_to = @assignedTo");
            params.assignedTo = assignedTo;
        }
        if (priority) {
            updates.push("priority = @priority");
            params.priority = priority;
        }
        if (scheduledDate) {
            updates.push("scheduled_date = @scheduledDate");
            params.scheduledDate = new Date(scheduledDate);
        }
        if (estimatedSavings !== undefined) {
            updates.push("estimated_savings = @estimatedSavings");
            params.estimatedSavings = estimatedSavings;
        }
        if (findings) {
            updates.push("findings = @findings");
            params.findings = JSON.stringify(findings);
        }

        updates.push("updated_at = GETDATE()");

        if (updates.length > 0) {
            await query(`
                UPDATE energy_audits 
                SET ${updates.join(', ')} 
                WHERE id = @id
            `, params);
        }

        // Get updated audit
        const updated = await queryOne(`
            SELECT ea.*, u.name as created_by_name 
            FROM energy_audits ea
            LEFT JOIN users u ON u.id = ea.created_by
            WHERE ea.id = @id
        `, { id });

        // Log activity
        await query(`
            INSERT INTO audit_logs (user_id, action, details) 
            VALUES (@userId, 'UPDATE_ENERGY_AUDIT', @details)
        `, {
            userId: req.user.id,
            details: JSON.stringify({ 
                auditId: id, 
                workOrderId: audit.work_order_id,
                updates: req.body 
            })
        });

        // Emit socket event
        if (global.io) {
            global.io.emit('energy:audit:updated', updated);
        }

        res.json({
            success: true,
            data: updated,
            message: `Audit ${audit.work_order_id} updated successfully`
        });

    } catch (error) {
        console.error('[Energy Audit] Update error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update energy audit' 
        });
    }
});

// DELETE /api/energy/audit/:id - Cancel audit
router.delete('/audit/:id', requireAuth, requireRole('energy_manager'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        // Check if audit exists
        const audit = await queryOne("SELECT * FROM energy_audits WHERE id = @id", { id });
        if (!audit) {
            return res.status(404).json({ 
                success: false, 
                message: 'Audit not found' 
            });
        }

        // Soft delete - mark as cancelled
        await query(`
            UPDATE energy_audits 
            SET status = 'cancelled', updated_at = GETDATE() 
            WHERE id = @id
        `, { id });

        // Log activity
        await query(`
            INSERT INTO audit_logs (user_id, action, details) 
            VALUES (@userId, 'CANCEL_ENERGY_AUDIT', @details)
        `, {
            userId: req.user.id,
            details: JSON.stringify({ 
                auditId: id, 
                workOrderId: audit.work_order_id 
            })
        });

        // Emit socket event
        if (global.io) {
            global.io.emit('energy:audit:cancelled', { 
                id, 
                workOrderId: audit.work_order_id 
            });
        }

        res.json({
            success: true,
            message: `Audit ${audit.work_order_id} cancelled successfully`
        });

    } catch (error) {
        console.error('[Energy Audit] Cancel error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to cancel energy audit' 
        });
    }
});


// ==========================================
// ENERGY SCHEDULING MANAGEMENT
// ==========================================

// DELETE /api/energy/schedule/:id - Archive an energy schedule
router.delete('/schedule/:id', requireAuth, requireRole('energy_manager'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        // Check if schedule exists
        const existing = await queryOne("SELECT * FROM energy_schedules WHERE id = @id", { id });
        if (!existing) {
            return res.status(404).json({ 
                success: false, 
                message: 'Schedule not found' 
            });
        }

        // Soft delete - mark as archived
        await query(`
            UPDATE energy_schedules 
            SET status = 'archived', updated_at = GETDATE() 
            WHERE id = @id
        `, { id });

        // Log activity
        await query(`
            INSERT INTO audit_logs (user_id, action, details) 
            VALUES (@userId, 'ARCHIVE_ENERGY_SCHEDULE', @details)
        `, {
            userId: req.user.id,
            details: JSON.stringify({ 
                scheduleId: id, 
                name: existing.name 
            })
        });

        // Emit socket event
        if (global.io) {
            global.io.emit('energy:schedule:archived', { 
                id, 
                name: existing.name 
            });
        }

        res.json({
            success: true,
            message: `Schedule "${existing.name}" archived successfully`
        });

    } catch (error) {
        console.error('[Energy Schedule] Archive error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to archive energy schedule' 
        });
    }
});

module.exports = router;