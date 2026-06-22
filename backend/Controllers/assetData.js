const { query, queryOne } = require("../DataBase/db");

function calculateHealthScore(vibration, temperature, pressure) {
    const vibScore = Math.max(0, 100 - (vibration * 8));
    const tempScore = Math.max(0, 100 - ((temperature - 20) * 1.5));
    const presScore = pressure >= 1.5 && pressure <= 3.5 ? 100 : Math.max(0, 100 - Math.abs(pressure - 2.5) * 30);
    
    return Math.round((vibScore * 0.4 + tempScore * 0.35 + presScore * 0.25));
}

function getStatusFromScore(score) {
    if (score >= 70) return "healthy";
    if (score >= 40) return "caution";
    return "critical";
}

function calculateRUL(healthScore) {
    return Math.round((healthScore / 100) * 365);
}

function calculateMTBF(assetId) {
    const mtbfBaseline = {
        "AST-001": 720,
        "AST-002": 480,
        "AST-003": 240,
        "AST-004": 840,
        "AST-005": 360
    };
    return mtbfBaseline[assetId] || 500;
}

async function getLatestReadings() {
    try {
        const rows = await query(`
            SELECT 
                a.id, a.name, a.type, a.location,
                s.health_score as healthScore,
                s.rul, s.mtbf, s.status,
                s.vibration, s.temperature, s.pressure,
                s.recorded_at as lastUpdate
            FROM assets a
            CROSS APPLY (
                SELECT TOP 1 *
                FROM sensor_readings
                WHERE asset_id = a.id
                ORDER BY recorded_at DESC
            ) s
            ORDER BY a.id
        `);
        
        if (!rows || rows.length === 0) {
            return getMockReadings();
        }
        
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            location: row.location,
            healthScore: row.healthScore,
            rul: row.rul,
            mtbf: row.mtbf,
            status: row.status,
            vibration: row.vibration,
            temperature: row.temperature,
            pressure: row.pressure,
            sensors: {
                vibration: row.vibration,
                temperature: row.temperature,
                pressure: row.pressure
            },
            lastUpdate: row.lastUpdate
        }));
    } catch (err) {
        console.error("[AssetData] Error getting latest readings:", err.message);
        return getMockReadings();
    }
}

async function recordAndGetReadings() {
    try {
        const assets = await query("SELECT id, name, type, location FROM assets");
        
        if (!assets || assets.length === 0) {
            return getMockReadings();
        }
        
        const results = [];
        
        for (const asset of assets) {
            let vibration, temperature, pressure;
            
            switch(asset.id) {
                case "AST-001":
                    vibration = 2.3 + (Math.random() * 0.5);
                    temperature = 58 + (Math.random() * 2);
                    pressure = 2.4 + (Math.random() * 0.3);
                    break;
                case "AST-002":
                    vibration = 4.5 + (Math.random() * 1.5);
                    temperature = 75 + (Math.random() * 4);
                    pressure = 2.7 + (Math.random() * 0.5);
                    break;
                case "AST-003":
                    vibration = 8.5 + (Math.random() * 2);
                    temperature = 90 + (Math.random() * 5);
                    pressure = 2.0 + (Math.random() * 0.4);
                    break;
                case "AST-004":
                    vibration = 1.4 + (Math.random() * 0.4);
                    temperature = 51 + (Math.random() * 2);
                    pressure = 2.3 + (Math.random() * 0.2);
                    break;
                case "AST-005":
                    vibration = 5.0 + (Math.random() * 1.2);
                    temperature = 83 + (Math.random() * 4);
                    pressure = 2.6 + (Math.random() * 0.4);
                    break;
                default:
                    vibration = 3 + Math.random() * 7;
                    temperature = 60 + Math.random() * 30;
                    pressure = 2 + Math.random() * 2;
            }
            
            vibration = Number(vibration.toFixed(2));
            temperature = Number(temperature.toFixed(1));
            pressure = Number(pressure.toFixed(2));
            
            const healthScore = calculateHealthScore(vibration, temperature, pressure);
            const status = getStatusFromScore(healthScore);
            const rul = calculateRUL(healthScore);
            const mtbf = calculateMTBF(asset.id);
            
            await query(`
                INSERT INTO sensor_readings 
                (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at)
                VALUES 
                (@asset_id, @vibration, @temperature, @pressure, @health_score, @rul, @mtbf, @status, GETDATE())
            `, {
                asset_id: asset.id,
                vibration: vibration,
                temperature: temperature,
                pressure: pressure,
                health_score: healthScore,
                rul: rul,
                mtbf: mtbf,
                status: status
            });
            
            results.push({
                id: asset.id,
                name: asset.name,
                type: asset.type,
                location: asset.location,
                healthScore: healthScore,
                rul: rul,
                mtbf: mtbf,
                status: status,
                vibration: vibration,
                temperature: temperature,
                pressure: pressure,
                sensors: { vibration, temperature, pressure }
            });
        }
        
        return results;
    } catch (err) {
        console.error("[AssetData] Error recording readings:", err.message);
        return getMockReadings();
    }
}

function getMockReadings() {
    return [
        { 
            id: "AST-001", name: "Compressor Unit A", type: "Compressor", location: "Zone 1",
            healthScore: 88, rul: 398, mtbf: 734, status: "healthy",
            vibration: 2.34, temperature: 58.7, pressure: 2.45,
            sensors: { vibration: 2.34, temperature: 58.7, pressure: 2.45 }
        },
        { 
            id: "AST-002", name: "Pump Station B", type: "Pump", location: "Zone 2",
            healthScore: 46, rul: 142, mtbf: 456, status: "caution",
            vibration: 4.87, temperature: 76.3, pressure: 2.89,
            sensors: { vibration: 4.87, temperature: 76.3, pressure: 2.89 }
        },
        { 
            id: "AST-003", name: "Conveyor Belt C", type: "Conveyor", location: "Zone 3",
            healthScore: 22, rul: 33, mtbf: 212, status: "critical",
            vibration: 9.42, temperature: 92.8, pressure: 2.12,
            sensors: { vibration: 9.42, temperature: 92.8, pressure: 2.12 }
        },
        { 
            id: "AST-004", name: "HVAC Unit D", type: "HVAC", location: "Zone 1",
            healthScore: 74, rul: 368, mtbf: 845, status: "healthy",
            vibration: 1.56, temperature: 51.2, pressure: 2.34,
            sensors: { vibration: 1.56, temperature: 51.2, pressure: 2.34 }
        },
        { 
            id: "AST-005", name: "Motor Drive E", type: "Motor", location: "Zone 4",
            healthScore: 36, rul: 72, mtbf: 312, status: "critical",
            vibration: 5.23, temperature: 84.6, pressure: 2.67,
            sensors: { vibration: 5.23, temperature: 84.6, pressure: 2.67 }
        }
    ];
}

async function getAlerts() {
    try {
        const rows = await query(`
            SELECT a.id, a.asset_id, ast.name as asset_name, a.severity, a.message, 
                   a.acknowledged, a.created_at, a.acknowledged_at
            FROM alerts a
            LEFT JOIN assets ast ON ast.id = a.asset_id
            ORDER BY a.created_at DESC
        `);
        
        if (!rows || rows.length === 0) {
            return [
                { id: 1, asset_id: "AST-003", asset_name: "Conveyor Belt C", severity: "critical", 
                  message: "CRITICAL: Health score dropped to 22/100 - Immediate maintenance required", 
                  acknowledged: 0, created_at: new Date(), acknowledged_at: null },
                { id: 2, asset_id: "AST-005", asset_name: "Motor Drive E", severity: "critical", 
                  message: "CRITICAL: Temperature at 84.6°C - Exceeds threshold", 
                  acknowledged: 0, created_at: new Date(Date.now() - 3600000), acknowledged_at: null },
                { id: 3, asset_id: "AST-002", asset_name: "Pump Station B", severity: "caution", 
                  message: "CAUTION: Vibration trending upward - Monitor closely", 
                  acknowledged: 0, created_at: new Date(Date.now() - 7200000), acknowledged_at: null }
            ];
        }
        
        return rows;
    } catch (err) {
        console.error("[AssetData] Error getting alerts:", err.message);
        return [];
    }
}

async function acknowledgeAlert(alertId) {
    try {
        await query(`
            UPDATE alerts 
            SET acknowledged = 1, acknowledged_at = GETDATE() 
            WHERE id = @id
        `, { id: alertId });
        return true;
    } catch (err) {
        console.error("[AssetData] Error acknowledging alert:", err.message);
        throw err;
    }
}

async function saveWorkOrder(workOrder) {
    try {
        await query(`
            INSERT INTO work_orders (wonum, asset_id, description, priority, status, created_by, created_at)
            VALUES (@wonum, @asset_id, @description, @priority, @status, @created_by, GETDATE())
        `, {
            wonum: workOrder.wonum,
            asset_id: workOrder.assetId,
            description: workOrder.description,
            priority: workOrder.priority || "Medium",
            status: workOrder.status || "WAPPR",
            created_by: workOrder.createdBy
        });
        return workOrder;
    } catch (err) {
        console.error("[AssetData] Error saving work order:", err.message);
        throw err;
    }
}

module.exports = {
    recordAndGetReadings,
    getLatestReadings,
    getAlerts,
    acknowledgeAlert,
    saveWorkOrder
};