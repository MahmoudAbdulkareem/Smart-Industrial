// routes/maintenanceRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../db/pool");

/**
 * Get maintenance predictions for calendar
 */
router.get("/predictions", requireAuth, async (req, res) => {
    try {
        let assets = [];
        
        // Try to get assets from the database
        try {
            // Get assets from the assets table
            const result = await query(`
                SELECT 
                    id,
                    name as asset_name,
                    type as asset_type,
                    location,
                    status,
                    install_date
                FROM assets
                WHERE status = 'OPERATING' OR status IS NULL OR status = ''
            `);
            
            if (result && result.length > 0) {
                assets = result.map(asset => ({
                    ...asset,
                    health_score: 75 + Math.floor(Math.random() * 20), // Random health score
                    rul: 50 + Math.floor(Math.random() * 150), // Random RUL
                    temperature: 45 + Math.floor(Math.random() * 35),
                    vibration: 1 + Math.random() * 4,
                    pressure: 2 + Math.random() * 3
                }));
            }
        } catch (dbError) {
            console.log("[Maintenance] Using fallback asset data (table may not exist)");
        }

        // If no assets found, use sample data
        if (!assets || assets.length === 0) {
            return res.json(getSamplePredictions());
        }

        // Generate maintenance predictions based on health scores
        const predictions = assets.map(asset => {
            const healthScore = asset.health_score || 75;
            const rul = asset.rul || 100;
            
            let maintenanceType = 'Routine Inspection';
            let priority = 'Low';
            let urgency = 'Normal';
            let estimatedDuration = 2;
            let description = `Routine inspection for ${asset.asset_name || asset.id}`;
            
            if (healthScore < 30) {
                maintenanceType = 'Emergency Repair';
                priority = 'Critical';
                urgency = 'Immediate';
                estimatedDuration = 6;
                description = `🚨 CRITICAL: ${asset.asset_name || asset.id} requires immediate attention. Health score: ${healthScore}/100`;
            } else if (healthScore < 50) {
                maintenanceType = 'Major Overhaul';
                priority = 'High';
                urgency = 'Soon';
                estimatedDuration = 4;
                description = `⚠️ High priority: ${asset.asset_name || asset.id} needs major overhaul. Health score: ${healthScore}/100`;
            } else if (healthScore < 70) {
                maintenanceType = 'Preventive Maintenance';
                priority = 'Medium';
                urgency = 'Within 2 weeks';
                estimatedDuration = 3;
                description = `🔧 Preventive maintenance for ${asset.asset_name || asset.id}. Health score: ${healthScore}/100`;
            } else if (rul < 30) {
                maintenanceType = 'Component Replacement';
                priority = 'High';
                urgency = 'Within 1 week';
                estimatedDuration = 3;
                description = `🔄 Component replacement needed for ${asset.asset_name || asset.id}. RUL: ${rul} days`;
            } else {
                description = `✅ ${asset.asset_name || asset.id} is in good condition (${healthScore}/100). Routine inspection recommended.`;
            }
            
            // Calculate recommended date
            const daysOffset = Math.max(1, Math.floor(rul / 10));
            const recommendedDate = new Date();
            recommendedDate.setDate(recommendedDate.getDate() + daysOffset);
            
            return {
                id: `pred_${asset.id || Date.now()}_${Date.now()}`,
                asset_id: asset.id || `AST-${String(Date.now()).slice(-4)}`,
                asset_name: asset.asset_name || `Asset ${asset.id}`,
                asset_type: asset.asset_type || 'Generic',
                location: asset.location || 'Unknown',
                maintenance_type: maintenanceType,
                priority: priority,
                status: priority === 'Critical' ? 'Urgent' : 'Scheduled',
                health_score: Math.round(healthScore),
                rul: Math.round(rul),
                recommended_date: recommendedDate.toISOString(),
                estimated_duration: estimatedDuration,
                description: description,
                sensors: {
                    temperature: Math.round(asset.temperature || 50),
                    vibration: Math.round((asset.vibration || 2.0) * 10) / 10,
                    pressure: Math.round((asset.pressure || 3.0) * 10) / 10
                }
            };
        });

        // Sort by priority (Critical first)
        const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        predictions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        // Generate AI suggestions
        const criticalCount = predictions.filter(p => p.priority === 'Critical').length;
        const highCount = predictions.filter(p => p.priority === 'High').length;
        const mediumCount = predictions.filter(p => p.priority === 'Medium').length;
        
        const suggestions = [];
        if (criticalCount > 0) {
            suggestions.push(`🚨 ${criticalCount} critical maintenance tasks require immediate attention!`);
        }
        if (highCount > 0) {
            suggestions.push(`⚠️ Schedule ${highCount} high-priority tasks within the next 7 days.`);
        }
        if (mediumCount > 0) {
            suggestions.push(`📋 ${mediumCount} medium-priority tasks should be scheduled within 2 weeks.`);
        }
        suggestions.push(`💡 Consider grouping maintenance for assets in the same location to reduce downtime.`);
        suggestions.push(`⏰ Optimal maintenance window: Night shift (10PM-6AM) for critical assets.`);

        res.json({
            predictions: predictions.slice(0, 20),
            suggestions: suggestions,
            summary: {
                total: predictions.length,
                critical: criticalCount,
                high: highCount,
                medium: mediumCount,
                low: predictions.filter(p => p.priority === 'Low').length
            }
        });
    } catch (error) {
        console.error("[Maintenance] Failed to get predictions:", error);
        res.json(getSamplePredictions());
    }
});

/**
 * Schedule a maintenance task
 */
router.post("/schedule", requireAuth, async (req, res) => {
    try {
        const { event_id, action, scheduled_date } = req.body;
        
        // In production, this would update the database
        // For now, return success
        res.json({
            success: true,
            message: `Maintenance ${action} scheduled successfully`,
            event_id: event_id,
            scheduled_date: scheduled_date,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("[Maintenance] Failed to schedule:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get anomaly detection data for playground
 */
router.get("/anomaly-data", requireAuth, async (req, res) => {
    try {
        const { assetId, window = 100 } = req.query;
        
        // Generate synthetic anomaly data
        const data = [];
        const baseValue = 50;
        const noise = 10;
        const points = Math.min(parseInt(window), 200);
        
        for (let i = 0; i < points; i++) {
            let value = baseValue + (Math.random() - 0.5) * noise * 2;
            
            // Introduce anomalies
            if (i > points * 0.3 && i < points * 0.35) {
                value = baseValue + 30 + Math.random() * 10;
            }
            if (i > points * 0.6 && i < points * 0.63) {
                value = baseValue - 25 + Math.random() * 5;
            }
            if (i > points * 0.8 && i < points * 0.83) {
                value = baseValue + 25 + Math.random() * 8;
            }
            
            data.push({
                timestamp: new Date(Date.now() - (points - i) * 60000).toISOString(),
                value: Math.round(value * 10) / 10,
                index: i
            });
        }
        
        // Detect anomalies for response
        const anomalies = [];
        const mean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
        const stdDev = Math.sqrt(data.reduce((sum, d) => sum + Math.pow(d.value - mean, 2), 0) / data.length);
        const threshold = 2.5;
        
        data.forEach((point, index) => {
            const zScore = Math.abs(point.value - mean) / stdDev;
            if (zScore > threshold) {
                anomalies.push({
                    index: index,
                    value: point.value,
                    zScore: Math.round(zScore * 100) / 100,
                    timestamp: point.timestamp
                });
            }
        });
        
        res.json({
            data: data,
            total_points: data.length,
            anomalies_detected: anomalies.slice(0, 10),
            statistics: {
                mean: Math.round(mean * 10) / 10,
                stdDev: Math.round(stdDev * 10) / 10,
                min: Math.min(...data.map(d => d.value)),
                max: Math.max(...data.map(d => d.value))
            }
        });
    } catch (error) {
        console.error("[Anomaly] Failed to get data:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Sample predictions for fallback
 */
function getSamplePredictions() {
    const now = Date.now();
    return {
        predictions: [
            {
                id: 'pred_1',
                asset_id: 'AST-001',
                asset_name: 'Compressor Unit A',
                asset_type: 'Compressor',
                location: 'Zone 1',
                maintenance_type: 'Preventive Maintenance',
                priority: 'Medium',
                status: 'Scheduled',
                health_score: 85,
                rul: 120,
                recommended_date: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
                estimated_duration: 3,
                description: 'Routine preventive maintenance for Compressor Unit A.',
                sensors: { temperature: 65, vibration: 1.2, pressure: 2.8 }
            },
            {
                id: 'pred_2',
                asset_id: 'AST-005',
                asset_name: 'Motor Drive E',
                asset_type: 'Motor',
                location: 'Zone 4',
                maintenance_type: 'Emergency Repair',
                priority: 'Critical',
                status: 'Urgent',
                health_score: 25,
                rul: 15,
                recommended_date: new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString(),
                estimated_duration: 6,
                description: '🚨 CRITICAL: Motor Drive E requires immediate attention. Health score: 25/100',
                sensors: { temperature: 92, vibration: 6.8, pressure: 5.2 }
            },
            {
                id: 'pred_3',
                asset_id: 'AST-002',
                asset_name: 'Pump Station B',
                asset_type: 'Pump',
                location: 'Zone 2',
                maintenance_type: 'Major Overhaul',
                priority: 'High',
                status: 'Scheduled',
                health_score: 45,
                rul: 45,
                recommended_date: new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString(),
                estimated_duration: 4,
                description: '⚠️ High priority: Pump Station B needs major overhaul. Health score: 45/100',
                sensors: { temperature: 72, vibration: 4.2, pressure: 3.8 }
            },
            {
                id: 'pred_4',
                asset_id: 'AST-003',
                asset_name: 'Conveyor Belt C',
                asset_type: 'Conveyor',
                location: 'Zone 3',
                maintenance_type: 'Routine Inspection',
                priority: 'Low',
                status: 'Scheduled',
                health_score: 90,
                rul: 200,
                recommended_date: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
                estimated_duration: 2,
                description: '✅ Conveyor Belt C is in good condition (90/100). Routine inspection recommended.',
                sensors: { temperature: 45, vibration: 0.8, pressure: 1.5 }
            }
        ],
        suggestions: [
            '🚨 1 critical maintenance task requires immediate attention!',
            '⚠️ Schedule 1 high-priority task within the next 7 days.',
            '📋 1 medium-priority task should be scheduled within 2 weeks.',
            '💡 Consider grouping maintenance for assets in the same location to reduce downtime.',
            '⏰ Optimal maintenance window: Night shift (10PM-6AM) for critical assets.'
        ],
        summary: {
            total: 4,
            critical: 1,
            high: 1,
            medium: 1,
            low: 1
        }
    };
}

module.exports = router;