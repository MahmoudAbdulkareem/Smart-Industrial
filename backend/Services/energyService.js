const { query, queryOne } = require("../db/pool");

async function getLatestEnergyData() {
    return query(`
        SELECT e.*
        FROM energy_metrics e
        INNER JOIN (
            SELECT zone, MAX(recorded_at) AS latest FROM energy_metrics GROUP BY zone
        ) latest ON e.zone = latest.zone AND e.recorded_at = latest.latest
        ORDER BY e.zone
    `);
}

async function getEnergyHistory() {
    return query(`
        SELECT zone, FORMAT(recorded_at, 'HH:mm') AS hour, recorded_at,
               electricity_kwh, electricity_base, pue, co2_emissions, water_lpm, gas_m3h
        FROM energy_metrics
        WHERE recorded_at >= DATEADD(HOUR, -24, GETDATE())
        ORDER BY zone, recorded_at ASC
    `);
}

async function getZones() {
    return query(`
        SELECT id, zone AS name, pue, eer, co2_emissions, electricity_kwh, electricity_base,
               water_lpm, water_base, gas_m3h, gas_base, recorded_at AS updated_at
        FROM energy_metrics
        WHERE recorded_at = (SELECT MAX(recorded_at) FROM energy_metrics e2 WHERE e2.zone = energy_metrics.zone)
        ORDER BY zone
    `);
}

async function upsertZone(name, payload) {
    const existing = await queryOne(`SELECT id FROM energy_metrics WHERE zone = @name`, { name });
    const params = {
        name,
        pue: payload.pue, eer: payload.eer, co2: payload.co2_emissions,
        elec: payload.electricity_kwh, elec_base: payload.electricity_base,
        water: payload.water_lpm, water_base: payload.water_base,
        gas: payload.gas_m3h, gas_base: payload.gas_base,
    };
    if (existing) {
        await query(
            `UPDATE energy_metrics SET pue=@pue, eer=@eer, co2_emissions=@co2,
                electricity_kwh=@elec, electricity_base=@elec_base,
                water_lpm=@water, water_base=@water_base,
                gas_m3h=@gas, gas_base=@gas_base, recorded_at=GETDATE()
             WHERE zone=@name`,
            params
        );
    } else {
        await query(
            `INSERT INTO energy_metrics (zone, pue, eer, co2_emissions, electricity_kwh, electricity_base, water_lpm, water_base, gas_m3h, gas_base)
             VALUES (@name, @pue, @eer, @co2, @elec, @elec_base, @water, @water_base, @gas, @gas_base)`,
            params
        );
    }
    return queryOne(
        `SELECT zone AS name, pue, eer, co2_emissions, electricity_kwh, electricity_base,
                water_lpm, water_base, gas_m3h, gas_base, recorded_at AS updated_at
         FROM energy_metrics WHERE zone=@name
         AND recorded_at = (SELECT MAX(recorded_at) FROM energy_metrics WHERE zone=@name)`,
        { name }
    );
}

async function deleteZone(name) {
    await query(`DELETE FROM energy_metrics WHERE zone = @name`, { name });
}

function averageAcrossZones(zones, key) {
    if (!zones.length) return 0;
    return parseFloat((zones.reduce((sum, z) => sum + (z[key] || 0), 0) / zones.length).toFixed(2));
}

async function buildAggregatedSnapshot() {
    const zones = await getLatestEnergyData();
    return {
        current: averageAcrossZones(zones, "electricity_kwh"),
        baseline: averageAcrossZones(zones, "electricity_base"),
        water: { current: averageAcrossZones(zones, "water_lpm"), baseline: averageAcrossZones(zones, "water_base") },
        gas: { current: averageAcrossZones(zones, "gas_m3h"), baseline: averageAcrossZones(zones, "gas_base") },
        kpis: { pue: averageAcrossZones(zones, "pue"), eer: averageAcrossZones(zones, "eer"), co2: averageAcrossZones(zones, "co2_emissions") },
        zones,
        timestamp: new Date().toISOString(),
    };
}

async function getGoal(userId) {
    return queryOne(
        `SELECT target, deadline, achieved, created_at FROM energy_goals WHERE user_id=@userId ORDER BY created_at DESC`,
        { userId }
    );
}

async function saveGoal(userId, target, deadline) {
    const existing = await queryOne(`SELECT id FROM energy_goals WHERE user_id=@userId AND achieved=0`, { userId });
    if (existing) {
        await query(
            `UPDATE energy_goals SET target=@target, deadline=@deadline, updated_at=GETDATE() WHERE user_id=@userId AND achieved=0`,
            { target, deadline, userId }
        );
    } else {
        await query(`INSERT INTO energy_goals (user_id, target, deadline) VALUES (@userId, @target, @deadline)`, { userId, target, deadline });
    }
}

async function getAlerts(userId) {
    return query(
        `SELECT id, threshold, action, message, active, created_at, acknowledged_at
         FROM energy_alerts WHERE user_id=@userId ORDER BY created_at DESC`,
        { userId }
    );
}

async function createAlert(userId, threshold, action, message) {
    await query(
        `INSERT INTO energy_alerts (user_id, threshold, action, message, active) VALUES (@userId, @threshold, @action, @message, 1)`,
        { userId, threshold, action, message }
    );
}

async function acknowledgeAlert(id, userId) {
    await query(
        `UPDATE energy_alerts SET active=0, acknowledged_at=GETDATE() WHERE id=@id AND user_id=@userId`,
        { id, userId }
    );
}

async function getSchedules(userId) {
    return query(
        `SELECT id, time, action, target, active, created_at FROM energy_schedules WHERE user_id=@userId ORDER BY time`,
        { userId }
    );
}

async function createSchedule(userId, time, action, target) {
    await query(
        `INSERT INTO energy_schedules (user_id, time, action, target, active) VALUES (@userId, @time, @action, @target, 1)`,
        { userId, time, action, target }
    );
}

async function deleteSchedule(id, userId) {
    await query(`DELETE FROM energy_schedules WHERE id=@id AND user_id=@userId`, { id, userId });
}

async function ensureEnergySchema() {
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='energy_goals' AND xtype='U')
        CREATE TABLE energy_goals (
            id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
            target FLOAT NOT NULL, deadline DATE NOT NULL, achieved BIT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT GETDATE(), updated_at DATETIME NOT NULL DEFAULT GETDATE()
        );
    `);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='energy_alerts' AND xtype='U')
        CREATE TABLE energy_alerts (
            id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
            threshold FLOAT NOT NULL, action NVARCHAR(200) NOT NULL, message NVARCHAR(500),
            active BIT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT GETDATE(), acknowledged_at DATETIME NULL
        );
    `);
    await query(`
        IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name='energy_schedules' AND xtype='U')
        CREATE TABLE energy_schedules (
            id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
            time TIME NOT NULL, action NVARCHAR(100) NOT NULL, target NVARCHAR(100),
            active BIT NOT NULL DEFAULT 1, created_at DATETIME NOT NULL DEFAULT GETDATE()
        );
    `);
}

module.exports = {
    getLatestEnergyData,
    getEnergyHistory,
    getZones,
    upsertZone,
    deleteZone,
    buildAggregatedSnapshot,
    getGoal,
    saveGoal,
    getAlerts,
    createAlert,
    acknowledgeAlert,
    getSchedules,
    createSchedule,
    deleteSchedule,
    ensureEnergySchema,
};
