const { query, queryOne } = require("../DataBase/db");

const ZONES = [
    { zone: "Zone 1", elec_base: 400, water_base: 60, gas_base: 18 },
    { zone: "Zone 2", elec_base: 380, water_base: 55, gas_base: 16 },
    { zone: "Zone 3", elec_base: 420, water_base: 65, gas_base: 20 },
    { zone: "Zone 4", elec_base: 360, water_base: 50, gas_base: 15 },
];

function rand(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generateSnapshot(zoneConfig, timeOfDay = null) {
    const hour = timeOfDay !== null ? timeOfDay : new Date().getHours();
    
    let timeFactor = 1.0;
    if (hour >= 9 && hour <= 17) {
        timeFactor = 1.15; 
    } else if (hour >= 22 || hour <= 5) {
        timeFactor = 0.7; 
    } else {
        timeFactor = 0.9; 
    }
    
    const elec = rand(
        zoneConfig.elec_base * 0.7 * timeFactor, 
        zoneConfig.elec_base * 1.1 * timeFactor
    );
    const water = rand(
        zoneConfig.water_base * 0.7 * timeFactor, 
        zoneConfig.water_base * 1.1 * timeFactor
    );
    const gas = rand(
        zoneConfig.gas_base * 0.75 * timeFactor, 
        zoneConfig.gas_base * 1.08 * timeFactor
    );
    
    const pue = parseFloat((1.05 + (1.0 - Math.min(1.0, elec / zoneConfig.elec_base)) * 0.4).toFixed(3));
    const eer = parseFloat((2.8 + (elec / zoneConfig.elec_base) * 1.2).toFixed(2));
    const co2 = parseFloat((elec * 0.45).toFixed(1));
    
    return {
        zone: zoneConfig.zone,
        electricity_kwh: Math.max(50, Math.min(600, elec)),
        electricity_base: zoneConfig.elec_base,
        water_lpm: Math.max(20, Math.min(100, water)),
        water_base: zoneConfig.water_base,
        gas_m3h: Math.max(5, Math.min(35, gas)),
        gas_base: zoneConfig.gas_base,
        pue: Math.max(1.0, Math.min(2.0, pue)),
        eer: Math.max(2.0, Math.min(5.0, eer)),
        co2_emissions: co2,
    };
}


async function writeEnergySnapshot() {
    try {
        for (const zoneConfig of ZONES) {
            const snap = generateSnapshot(zoneConfig);
            await query(`
                INSERT INTO energy_metrics
                    (zone, pue, eer, co2_emissions, electricity_kwh, electricity_base,
                     water_lpm, water_base, gas_m3h, gas_base, recorded_at)
                VALUES
                    (@zone, @pue, @eer, @co2, @elec_kwh, @elec_base,
                     @water_lpm, @water_base, @gas_m3h, @gas_base, GETDATE())
            `, {
                zone: snap.zone,
                pue: snap.pue,
                eer: snap.eer,
                co2: snap.co2_emissions,
                elec_kwh: snap.electricity_kwh,
                elec_base: snap.electricity_base,
                water_lpm: snap.water_lpm,
                water_base: snap.water_base,
                gas_m3h: snap.gas_m3h,
                gas_base: snap.gas_base,
            });
        }
        console.log(`[Energy] Snapshot written for ${ZONES.length} zones at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
        console.error("[Energy] Failed to write snapshot:", err.message);
    }
}

async function getLatestEnergyData() {
    try {
        const rows = await query(`
            SELECT e.*
            FROM energy_metrics e
            INNER JOIN (
                SELECT zone, MAX(recorded_at) AS latest
                FROM energy_metrics
                GROUP BY zone
            ) latest ON e.zone = latest.zone AND e.recorded_at = latest.latest
            ORDER BY e.zone
        `);

        if (!rows || rows.length === 0) {
            console.log("[Energy] No data in DB, generating live snapshot");
            return ZONES.map(zc => generateSnapshot(zc));
        }

        return rows.map(r => ({
            zone: r.zone,
            electricity_kwh: parseFloat(r.electricity_kwh) || rand(280, 400),
            electricity_base: parseFloat(r.electricity_base) || 400,
            water_lpm: parseFloat(r.water_lpm) || rand(44, 66),
            water_base: parseFloat(r.water_base) || 60,
            gas_m3h: parseFloat(r.gas_m3h) || rand(12, 18),
            gas_base: parseFloat(r.gas_base) || 18,
            pue: parseFloat(r.pue) || 1.35,
            eer: parseFloat(r.eer) || 3.8,
            co2_emissions: parseFloat(r.co2_emissions) || 157,
            recorded_at: r.recorded_at,
        }));
    } catch (err) {
        console.error("[Energy] Error getting latest data:", err.message);
        return ZONES.map(zc => generateSnapshot(zc));
    }
}


async function getEnergyHistory() {
    try {
        const rows = await query(`
            SELECT 
                zone,
                -- FIX: renamed to 'hour' so frontend dataKey="hour" matches directly
                FORMAT(recorded_at, 'HH:mm') AS hour,
                recorded_at,
                electricity_kwh,
                electricity_base,
                pue,
                co2_emissions,
                water_lpm,
                gas_m3h
            FROM energy_metrics
            WHERE recorded_at >= DATEADD(HOUR, -24, GETDATE())
            ORDER BY zone, recorded_at ASC
        `);

        if (!rows || rows.length === 0) {
            const history = [];
            const now = new Date();
            
            for (let i = 23; i >= 0; i--) {
                const ts = new Date(now.getTime() - i * 3600000);
                const hourStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                for (const zoneConfig of ZONES) {
                    const snap = generateSnapshot(zoneConfig, ts.getHours());
                    history.push({
                        zone: zoneConfig.zone,
                        hour: hourStr,
                        recorded_at: ts,
                        electricity_kwh: snap.electricity_kwh,
                        electricity_base: snap.electricity_base,
                        pue: snap.pue,
                        co2_emissions: snap.co2_emissions,
                        water_lpm: snap.water_lpm,
                        gas_m3h: snap.gas_m3h,
                    });
                }
            }
            return history;
        }

        return rows.map(r => ({
            zone: r.zone,
            hour: r.hour,   
            recorded_at: r.recorded_at,
            electricity_kwh: parseFloat(r.electricity_kwh),
            electricity_base: parseFloat(r.electricity_base),
            pue: parseFloat(r.pue),
            co2_emissions: parseFloat(r.co2_emissions),
            water_lpm: parseFloat(r.water_lpm),
            gas_m3h: parseFloat(r.gas_m3h),
        }));
    } catch (err) {
        console.error("[Energy] Error getting history:", err.message);
        return [];
    }
}


function generateRealtimeEnergyUpdate() {
    const zones = ZONES.map(zc => generateSnapshot(zc));
    
    const n = zones.length;
    const avg = (key) => parseFloat((zones.reduce((s, z) => s + (z[key] || 0), 0) / n).toFixed(2));

    const now = new Date();
    const hourStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    return {
        current: avg("electricity_kwh"),
        baseline: avg("electricity_base"),
        water: { 
            current: avg("water_lpm"), 
            baseline: avg("water_base") 
        },
        gas: { 
            current: avg("gas_m3h"), 
            baseline: avg("gas_base") 
        },
        kpis: { 
            pue: avg("pue"), 
            eer: avg("eer"), 
            co2: avg("co2_emissions") 
        },
        latestHistoryPoint: {
            hour: hourStr,
            actual: avg("electricity_kwh"),
            baseline: avg("electricity_base"),
        },
        timestamp: now.toISOString(),
        zones: zones
    };
}

module.exports = { 
    writeEnergySnapshot, 
    getLatestEnergyData, 
    getEnergyHistory,
    generateRealtimeEnergyUpdate,
    ZONES 
};