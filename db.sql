-- ═══════════════════════════════════════════════════════════════════════════
--  SmartDashboard — Schema + Rich Seed Data
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE SmartDashboard;
GO
USE SmartDashboard;
GO

-- ── Tables ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    name           NVARCHAR(100) NOT NULL,
    email          NVARCHAR(150) NOT NULL UNIQUE,
    password       NVARCHAR(255) NOT NULL,
    role           NVARCHAR(50)  NOT NULL,
    phone_number   NVARCHAR(30)  NULL,
    totp_secret    NVARCHAR(100) NULL,
    totp_enabled   BIT           NOT NULL DEFAULT 0,
    is_active      BIT           NOT NULL DEFAULT 1,
    created_at     DATETIME      NOT NULL DEFAULT GETDATE(),
    last_login     DATETIME      NOT NULL DEFAULT GETDATE(),
    deactivated_at DATETIME      NULL
);
GO

CREATE TABLE assets (
    id           NVARCHAR(25)  PRIMARY KEY,
    name         NVARCHAR(100) NOT NULL,
    type         NVARCHAR(50)  NOT NULL,
    location     NVARCHAR(50)  NOT NULL,
    install_date DATE          NOT NULL,
    created_at   DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE sensor_readings (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    asset_id     NVARCHAR(25) NOT NULL REFERENCES assets(id),
    vibration    FLOAT        NOT NULL,
    temperature  FLOAT        NOT NULL,
    pressure     FLOAT        NOT NULL,
    health_score FLOAT        NOT NULL,
    rul          FLOAT        NOT NULL,
    mtbf         FLOAT        NOT NULL,
    status       NVARCHAR(25) NOT NULL,
    recorded_at  DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE alerts (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    asset_id        NVARCHAR(25)  NOT NULL REFERENCES assets(id),
    severity        NVARCHAR(25)  NOT NULL,
    message         NVARCHAR(500) NOT NULL,
    acknowledged    BIT           NOT NULL DEFAULT 0,
    acknowledged_by INT           NULL REFERENCES users(id),
    acknowledged_at DATETIME      NULL,
    created_at      DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE work_orders (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    wonum       NVARCHAR(50)  NOT NULL UNIQUE,
    asset_id    NVARCHAR(25)  NOT NULL REFERENCES assets(id),
    description NVARCHAR(500) NOT NULL,
    priority    NVARCHAR(25)  NOT NULL DEFAULT 'High',
    status      NVARCHAR(25)  NOT NULL DEFAULT 'WAPPR',
    created_by  NVARCHAR(100) NULL,
    created_at  DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE energy_metrics (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    zone             NVARCHAR(50) NOT NULL,
    pue              FLOAT        NOT NULL,
    eer              FLOAT        NOT NULL,
    co2_emissions    FLOAT        NOT NULL,
    electricity_kwh  FLOAT        NULL DEFAULT 0,
    electricity_base FLOAT        NULL DEFAULT 400,
    water_lpm        FLOAT        NULL DEFAULT 0,
    water_base       FLOAT        NULL DEFAULT 60,
    gas_m3h          FLOAT        NULL DEFAULT 0,
    gas_base         FLOAT        NULL DEFAULT 18,
    recorded_at      DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

CREATE TABLE thresholds (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    asset_id   NVARCHAR(25)  NOT NULL REFERENCES assets(id),
    metric     NVARCHAR(50)  NOT NULL,
    value      FLOAT         NOT NULL,
    updated_at DATETIME      NOT NULL DEFAULT GETDATE(),
    UNIQUE (asset_id, metric)
);
GO

CREATE TABLE audit_logs (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NULL REFERENCES users(id),
    action     NVARCHAR(100) NOT NULL,
    details    NVARCHAR(MAX) NULL,
    created_at DATETIME      NOT NULL DEFAULT GETDATE()
);
GO

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_sensor_asset  ON sensor_readings(asset_id, recorded_at DESC);
CREATE INDEX idx_alerts_active ON alerts(acknowledged, created_at DESC);
CREATE INDEX idx_metrics_zone  ON energy_metrics(zone, recorded_at DESC);
CREATE INDEX idx_audit_user    ON audit_logs(user_id, created_at DESC);
GO

-- ── Purge procedure ───────────────────────────────────────────────────────────
CREATE PROCEDURE usp_PurgeSensorReadings @DaysToKeep INT = 30
AS BEGIN
    DELETE FROM sensor_readings WHERE recorded_at < DATEADD(DAY, -@DaysToKeep, GETDATE());
END
GO

-- ═══════════════════════════════════════════════════════════════════════════
--  SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Users (passwords hashed by seed.js on first run) ─────────────────────────
INSERT INTO users (name, email, password, role, phone_number, is_active, last_login) VALUES
('Ahmed Ben Ali',    'maintenance@dashboard.com', 'PLACEHOLDER', 'maintenance_engineer', '+216 71 234 567', 1, GETDATE()),
('Sara Mansouri',    'energy@dashboard.com',      'PLACEHOLDER', 'energy_manager',       '+216 71 345 678', 1, GETDATE()),
('Youssef El Fassi', 'itadmin@dashboard.com',     'PLACEHOLDER', 'it_admin',             '+216 71 456 789', 1, GETDATE());
GO

-- ── Assets ────────────────────────────────────────────────────────────────────
INSERT INTO assets (id, name, type, location, install_date) VALUES
('AST-001', 'Compressor Unit A', 'Compressor', 'Zone 1', '2019-03-15'),
('AST-002', 'Pump Station B',    'Pump',       'Zone 2', '2020-07-22'),
('AST-003', 'Conveyor Belt C',   'Conveyor',   'Zone 3', '2018-11-10'),
('AST-004', 'HVAC Unit D',       'HVAC',       'Zone 1', '2021-01-05'),
('AST-005', 'Motor Drive E',     'Motor',      'Zone 4', '2017-06-30');
GO

DECLARE @h INT = 168; 

WHILE @h >= 1
BEGIN
    DECLARE @t DATETIME = DATEADD(HOUR, -@h, GETDATE());
    DECLARE @dayFrac FLOAT = CAST(DATEPART(HOUR, @t) AS FLOAT) / 24.0;
    DECLARE @shiftFactor FLOAT = 1.0 + 0.06 * SIN(@dayFrac * 3.14159);
    DECLARE @prog FLOAT = CAST(168 - @h AS FLOAT) / 168.0;

    INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at) VALUES
    ('AST-001',
     ROUND(1.10 + @prog * 0.18 + (CHECKSUM(NEWID()) % 100) * 0.0006, 2),
     ROUND((44.0 + @prog * 1.5 + (CHECKSUM(NEWID()) % 100) * 0.05) * @shiftFactor, 1),
     ROUND(2.60 + (CHECKSUM(NEWID()) % 100) * 0.006, 2),
     ROUND(91.0 - @prog * 3.0 + (CHECKSUM(NEWID()) % 100) * 0.04 - 0.5, 1),
     ROUND(490.0 - @prog * 20.0 + (CHECKSUM(NEWID()) % 100) * 0.3, 1),
     ROUND(3200 - @prog * 180 + (CHECKSUM(NEWID()) % 100) * 1.5, 0),
     'healthy', @t);

    INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at) VALUES
    ('AST-002',
     ROUND(2.80 + @prog * 0.45 + (CHECKSUM(NEWID()) % 100) * 0.0012, 2),
     ROUND((60.0 + @prog * 2.5 + (CHECKSUM(NEWID()) % 100) * 0.08) * @shiftFactor, 1),
     ROUND(2.85 + (CHECKSUM(NEWID()) % 100) * 0.009, 2),
     ROUND(60.0 - @prog * 6.0 + (CHECKSUM(NEWID()) % 100) * 0.06 - 0.5, 1),
     ROUND(68.0 - @prog * 8.0 + (CHECKSUM(NEWID()) % 100) * 0.25, 1),
     ROUND(1850 - @prog * 220 + (CHECKSUM(NEWID()) % 100) * 1.0, 0),
     CASE WHEN (60.0 - @prog * 6.0) >= 50 THEN 'caution' ELSE 'caution' END, @t);

    INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at) VALUES
    ('AST-003',
     ROUND(6.80 + @prog * 1.20 + (CHECKSUM(NEWID()) % 100) * 0.0020, 2),
     ROUND((73.0 + @prog * 5.0 + (CHECKSUM(NEWID()) % 100) * 0.15) * @shiftFactor, 1),
     ROUND(2.30 - @prog * 0.20 + (CHECKSUM(NEWID()) % 100) * 0.010, 2),
     ROUND(36.0 - @prog * 5.0 + (CHECKSUM(NEWID()) % 100) * 0.08 - 0.5, 1),
     ROUND(12.0 - @prog * 5.0 + (CHECKSUM(NEWID()) % 100) * 0.15, 1),
     ROUND(620 - @prog * 150 + (CHECKSUM(NEWID()) % 100) * 0.7, 0),
     CASE WHEN (36.0 - @prog * 5.0) < 35 THEN 'critical' ELSE 'caution' END, @t);

    INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at) VALUES
    ('AST-004',
     ROUND(0.85 + @prog * 0.12 + (CHECKSUM(NEWID()) % 100) * 0.0004, 2),
     ROUND((46.0 + @prog * 1.0 + (CHECKSUM(NEWID()) % 100) * 0.04) * @shiftFactor, 1),
     ROUND(2.70 + (CHECKSUM(NEWID()) % 100) * 0.005, 2),
     ROUND(78.0 - @prog * 2.5 + (CHECKSUM(NEWID()) % 100) * 0.04 - 0.3, 1),
     ROUND(415.0 - @prog * 15.0 + (CHECKSUM(NEWID()) % 100) * 0.3, 1),
     ROUND(2800 - @prog * 100 + (CHECKSUM(NEWID()) % 100) * 1.2, 0),
     'healthy', @t);

    INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status, recorded_at) VALUES
    ('AST-005',
     ROUND(3.80 + @prog * 0.65 + (CHECKSUM(NEWID()) % 100) * 0.0014, 2),
     ROUND((68.0 + @prog * 3.5 + (CHECKSUM(NEWID()) % 100) * 0.10) * @shiftFactor, 1),
     ROUND(2.40 + (CHECKSUM(NEWID()) % 100) * 0.008, 2),
     ROUND(48.0 - @prog * 6.0 + (CHECKSUM(NEWID()) % 100) * 0.06 - 0.4, 1),
     ROUND(52.0 - @prog * 10.0 + (CHECKSUM(NEWID()) % 100) * 0.2, 1),
     ROUND(1100 - @prog * 170 + (CHECKSUM(NEWID()) % 100) * 0.8, 0),
     CASE WHEN (48.0 - @prog * 6.0) >= 45 THEN 'caution' ELSE 'caution' END, @t);

    SET @h = @h - 1;
END
GO

DECLARE @eh INT = 168;
WHILE @eh >= 1
BEGIN
    DECLARE @et DATETIME = DATEADD(HOUR, -@eh, GETDATE());
    DECLARE @eHour INT   = DATEPART(HOUR, @et);
  
    DECLARE @eFactor FLOAT =
        CASE
            WHEN @eHour BETWEEN 8  AND 18 THEN 1.0  + (@eHour - 8)  * 0.015
            WHEN @eHour BETWEEN 19 AND 21 THEN 0.88 + (21 - @eHour) * 0.04
            ELSE 0.65 + (@eHour % 6) * 0.015
        END;
    DECLARE @eNoise FLOAT = 1.0 + ((CHECKSUM(NEWID()) % 100) - 50) * 0.002;

    INSERT INTO energy_metrics (zone, pue, eer, co2_emissions, electricity_kwh, electricity_base, water_lpm, water_base, gas_m3h, gas_base, recorded_at) VALUES
    ('Zone 1',
     ROUND(1.10 + (1.0 - @eFactor) * 0.30 + (CHECKSUM(NEWID()) % 100) * 0.0008, 3),
     ROUND(3.20 + @eFactor * 0.55 + (CHECKSUM(NEWID()) % 100) * 0.003, 2),
     ROUND(400 * @eFactor * @eNoise * 0.45, 1),
     ROUND(400 * @eFactor * @eNoise, 1), 400,
     ROUND(60  * @eFactor * @eNoise, 1), 60,
     ROUND(18  * @eFactor * @eNoise, 2), 18, @et);

    INSERT INTO energy_metrics (zone, pue, eer, co2_emissions, electricity_kwh, electricity_base, water_lpm, water_base, gas_m3h, gas_base, recorded_at) VALUES
    ('Zone 2',
     ROUND(1.15 + (1.0 - @eFactor) * 0.28 + (CHECKSUM(NEWID()) % 100) * 0.0009, 3),
     ROUND(3.05 + @eFactor * 0.45 + (CHECKSUM(NEWID()) % 100) * 0.003, 2),
     ROUND(380 * @eFactor * @eNoise * 0.45, 1),
     ROUND(380 * @eFactor * @eNoise, 1), 380,
     ROUND(55  * @eFactor * @eNoise, 1), 55,
     ROUND(16  * @eFactor * @eNoise, 2), 16, @et);

    INSERT INTO energy_metrics (zone, pue, eer, co2_emissions, electricity_kwh, electricity_base, water_lpm, water_base, gas_m3h, gas_base, recorded_at) VALUES
    ('Zone 3',
     ROUND(1.08 + (1.0 - @eFactor) * 0.35 + (CHECKSUM(NEWID()) % 100) * 0.0007, 3),
     ROUND(3.50 + @eFactor * 0.60 + (CHECKSUM(NEWID()) % 100) * 0.003, 2),
     ROUND(420 * @eFactor * @eNoise * 0.45, 1),
     ROUND(420 * @eFactor * @eNoise, 1), 420,
     ROUND(65  * @eFactor * @eNoise, 1), 65,
     ROUND(20  * @eFactor * @eNoise, 2), 20, @et);

    INSERT INTO energy_metrics (zone, pue, eer, co2_emissions, electricity_kwh, electricity_base, water_lpm, water_base, gas_m3h, gas_base, recorded_at) VALUES
    ('Zone 4',
     ROUND(1.22 + (1.0 - @eFactor) * 0.25 + (CHECKSUM(NEWID()) % 100) * 0.0010, 3),
     ROUND(2.85 + @eFactor * 0.40 + (CHECKSUM(NEWID()) % 100) * 0.003, 2),
     ROUND(360 * @eFactor * @eNoise * 0.45, 1),
     ROUND(360 * @eFactor * @eNoise, 1), 360,
     ROUND(50  * @eFactor * @eNoise, 1), 50,
     ROUND(15  * @eFactor * @eNoise, 2), 15, @et);

    SET @eh = @eh - 1;
END
GO

INSERT INTO alerts (asset_id, severity, message, acknowledged, acknowledged_at, created_at) VALUES
('AST-003', 'critical', 'Health score critical (31/100) — predictive maintenance required immediately', 0, NULL, DATEADD(HOUR, -2,  GETDATE())),
('AST-003', 'critical', 'Anomaly detected — vibration 8.42 mm/s exceeds safe operating limit',          0, NULL, DATEADD(HOUR, -14, GETDATE())),
('AST-002', 'caution',  'Vibration rising (3.45 mm/s) — trend indicates bearing wear',                  0, NULL, DATEADD(HOUR, -5,  GETDATE())),
('AST-005', 'caution',  'Temperature approaching upper limit (74.8 °C) — check cooling',                0, NULL, DATEADD(HOUR, -8,  GETDATE())),
('AST-003', 'critical', 'Health score dropped below 35 — RUL estimated at 9 days',                      1, DATEADD(HOUR, -36, GETDATE()), DATEADD(HOUR, -48, GETDATE())),
('AST-002', 'caution',  'Pressure variance detected on Pump Station B — check inlet valve',             1, DATEADD(HOUR, -70, GETDATE()), DATEADD(HOUR, -72, GETDATE())),
('AST-005', 'caution',  'Vibration trend increasing on Motor Drive E — schedule inspection',             1, DATEADD(HOUR,-118, GETDATE()), DATEADD(HOUR,-120, GETDATE())),
('AST-001', 'caution',  'Brief temperature spike (58.2 °C) on Compressor A — resolved automatically',   1, DATEADD(HOUR,-142, GETDATE()), DATEADD(HOUR,-144, GETDATE()));
GO

INSERT INTO work_orders (wonum, asset_id, description, priority, status, created_by, created_at) VALUES
('WO-2026-0041', 'AST-003', 'Urgent: replace conveyor drive belt and inspect bearings — health score at 31/100, RUL estimated 3–5 days. Visual inspection required before next shift.', 'Critical', 'INPRG', 'Ahmed Ben Ali',    DATEADD(HOUR,  -6, GETDATE())),
('AUTO-001',     'AST-003', '[Rule Engine] Critical health score (33/100) detected — RUL: 4.2 days. Automatic work order generated.', 'High', 'APPR',  'System (Auto)',    DATEADD(HOUR, -14, GETDATE())),
('WO-2026-0040', 'AST-002', 'Pump Station B — investigate rising vibration (3.45 mm/s). Check impeller balance and bearing clearances. Schedule during next planned shutdown.', 'High',     'WAPPR', 'Ahmed Ben Ali',    DATEADD(HOUR,  -5, GETDATE())),
('WO-2026-0039', 'AST-005', 'Motor Drive E cooling inspection — temperature trending toward 75 °C. Clean heat exchanger fins and verify coolant flow rate.', 'Medium',   'WAPPR', 'Ahmed Ben Ali',    DATEADD(HOUR,  -8, GETDATE())),
('WO-2026-0038', 'AST-002', 'Pump B quarterly maintenance — lubricate bearings, check seal integrity, flush suction strainer.', 'Medium', 'COMP',  'Ahmed Ben Ali',    DATEADD(DAY,   -4, GETDATE())),
('WO-2026-0037', 'AST-004', 'HVAC Unit D — replace air filters (6-month schedule), check refrigerant pressure, clean condenser coils.', 'Low',    'COMP',  'Ahmed Ben Ali',    DATEADD(DAY,   -5, GETDATE())),
('WO-2026-0036', 'AST-001', 'Compressor A annual inspection — valve check, cylinder liner measurement, safety relief valve test.', 'Medium', 'COMP',  'Ahmed Ben Ali',    DATEADD(DAY,   -6, GETDATE())),
('WO-2026-0035', 'AST-003', 'Conveyor Belt C — re-align belt tracking, check tensioner spring, lubricate tail pulley bearings.', 'High',    'COMP',  'Ahmed Ben Ali',    DATEADD(DAY,   -7, GETDATE())),
('WO-2026-0034', 'AST-005', 'Motor Drive E — check coupling alignment, test overload relay settings, thermographic inspection.', 'Medium', 'CAN',   'Ahmed Ben Ali',    DATEADD(DAY,   -6, GETDATE()));
GO

INSERT INTO thresholds (asset_id, metric, value) VALUES
('AST-001', 'health_score', 50),   
('AST-001', 'vibration',    2.5),  
('AST-001', 'temperature',  65.0), 
('AST-002', 'health_score', 45),
('AST-002', 'vibration',    5.0),
('AST-002', 'temperature',  80.0),
('AST-003', 'health_score', 30),   
('AST-003', 'vibration',   10.0),
('AST-003', 'temperature',  95.0),
('AST-004', 'health_score', 50),
('AST-004', 'vibration',    2.0),
('AST-004', 'temperature',  60.0),
('AST-005', 'health_score', 40),
('AST-005', 'vibration',    6.5),
('AST-005', 'temperature',  88.0);
GO

INSERT INTO audit_logs (user_id, action, details, created_at) VALUES
(3, 'LOGIN_SUCCESS',              '{"email":"itadmin@dashboard.com","ip":"192.168.1.45"}',                          DATEADD(MINUTE, -15, GETDATE())),
(1, 'LOGIN_SUCCESS',              '{"email":"maintenance@dashboard.com","ip":"192.168.1.22"}',                      DATEADD(MINUTE, -45, GETDATE())),
(1, 'WORKORDER_CREATED',          '{"wonum":"WO-2026-0041","asset_id":"AST-003","priority":"Critical"}',             DATEADD(HOUR,   -6,  GETDATE())),
(1, 'WORKORDER_STATUS_UPDATED',   '{"wonum":"WO-2026-0041","status":"INPRG"}',                                      DATEADD(HOUR,   -5,  GETDATE())),
(1, 'ALERT_ACKNOWLEDGED',         '{"alert_id":5,"asset_id":"AST-003","severity":"critical"}',                      DATEADD(HOUR,  -36,  GETDATE())),
(2, 'LOGIN_SUCCESS',              '{"email":"energy@dashboard.com","ip":"192.168.1.31"}',                           DATEADD(HOUR,   -2,  GETDATE())),
(2, 'THRESHOLD_UPDATED',          '{"asset_id":"AST-003","metric":"health_score","value":30}',                      DATEADD(HOUR,   -2,  GETDATE())),
(2, 'REPORT_DOWNLOADED',          '{"format":"excel","generated_at":"today"}',                                      DATEADD(HOUR,   -1,  GETDATE())),
(3, 'WORKORDER_STATUS_UPDATED',   '{"wonum":"WO-2026-0038","status":"COMP"}',                                       DATEADD(DAY,    -4,  GETDATE())),
(1, 'WORKORDER_STATUS_UPDATED',   '{"wonum":"WO-2026-0036","status":"COMP"}',                                       DATEADD(DAY,    -6,  GETDATE()));
GO

PRINT 'SmartDashboard — schema, 7 days history, and seed data loaded successfully.';
GO
