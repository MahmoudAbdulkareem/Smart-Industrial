CREATE DATABASE SmartDashboard;
GO

USE SmartDashboard;
GO

CREATE TABLE users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    name          NVARCHAR(100)  NOT NULL,
    email         NVARCHAR(150)  NOT NULL UNIQUE,
    password_hash NVARCHAR(255)  NOT NULL,
    role          NVARCHAR(50)   NOT NULL,
    created_at    DATETIME       DEFAULT GETDATE()
);
GO

CREATE TABLE assets (
    id           NVARCHAR(20)  PRIMARY KEY,
    name         NVARCHAR(100) NOT NULL,
    type         NVARCHAR(50)  NOT NULL,
    location     NVARCHAR(50)  NOT NULL,
    install_date DATE          NOT NULL,
    created_at   DATETIME      DEFAULT GETDATE()
);
GO

CREATE TABLE sensor_readings (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    asset_id     NVARCHAR(20)  NOT NULL REFERENCES assets(id),
    type         NVARCHAR(50)  NOT NULL,
    value        FLOAT         NOT NULL,
    unit         NVARCHAR(20)  NOT NULL,
    recorded_at  DATETIME      DEFAULT GETDATE()
);
GO

CREATE TABLE health_scores (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    asset_id          NVARCHAR(20)  NOT NULL REFERENCES assets(id),
    health_score      FLOAT         NOT NULL,
    rul               FLOAT         NOT NULL,
    mtbf              FLOAT         NOT NULL,
    anomaly_detected  BIT           NOT NULL DEFAULT 0,
    status            NVARCHAR(20)  NOT NULL,
    computed_at       DATETIME      DEFAULT GETDATE()
);
GO

CREATE TABLE alerts (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    asset_id         NVARCHAR(20)  NOT NULL REFERENCES assets(id),
    severity         NVARCHAR(20)  NOT NULL,
    message          NVARCHAR(500) NOT NULL,
    acknowledged     BIT           NOT NULL DEFAULT 0,
    acknowledged_by  INT           REFERENCES users(id),
    acknowledged_at  DATETIME      NULL,
    created_at       DATETIME      DEFAULT GETDATE()
);
GO

CREATE TABLE work_orders (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    wonum       NVARCHAR(50)  NOT NULL UNIQUE,
    asset_id    NVARCHAR(20)  NOT NULL REFERENCES assets(id),
    description NVARCHAR(500) NOT NULL,
    priority    NVARCHAR(20)  NOT NULL DEFAULT 'HIGH',
    status      NVARCHAR(20)  NOT NULL DEFAULT 'WAPPR',
    created_by  INT           REFERENCES users(id),
    created_at  DATETIME      DEFAULT GETDATE()
);
GO

CREATE TABLE energy_readings (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    zone         NVARCHAR(50)  NOT NULL,
    type         NVARCHAR(30)  NOT NULL,
    actual       FLOAT         NOT NULL,
    baseline     FLOAT         NOT NULL,
    unit         NVARCHAR(20)  NOT NULL,
    recorded_at  DATETIME      DEFAULT GETDATE()
);
GO

CREATE INDEX idx_sensor_asset    ON sensor_readings(asset_id, recorded_at DESC);
CREATE INDEX idx_health_asset    ON health_scores(asset_id, computed_at DESC);
CREATE INDEX idx_alerts_active   ON alerts(acknowledged, created_at DESC);
CREATE INDEX idx_energy_zone     ON energy_readings(zone, recorded_at DESC);
GO

INSERT INTO users (name, email, password_hash, role) VALUES
('Ahmed Ben Ali', 'maintenance@dashboard.com', 'PLACEHOLDER', 'maintenance_engineer'),
('Sara Mansouri', 'energy@dashboard.com',      'PLACEHOLDER', 'energy_manager'),
('IT Admin', 'itadmin@dashboard.com', 'PLACEHOLDER', 'it_admin');
GO

INSERT INTO assets (id, name, type, location, install_date) VALUES
('AST-001', 'Compressor Unit A', 'Compressor', 'Zone 1', '2019-03-15'),
('AST-002', 'Pump Station B',    'Pump',       'Zone 2', '2020-07-22'),
('AST-003', 'Conveyor Belt C',   'Conveyor',   'Zone 3', '2018-11-10'),
('AST-004', 'HVAC Unit D',       'HVAC',       'Zone 1', '2021-01-05'),
('AST-005', 'Motor Drive E',     'Motor',      'Zone 4', '2017-06-30');
GO

INSERT INTO sensor_readings (asset_id, type, value, unit) VALUES
('AST-001', 'vibration', 1.2, 'mm/s'), ('AST-001', 'temperature', 52.3, 'C'), ('AST-001', 'pressure', 2.8, 'bar'),
('AST-002', 'vibration', 3.1, 'mm/s'), ('AST-002', 'temperature', 61.0, 'C'), ('AST-002', 'pressure', 3.2, 'bar'),
('AST-003', 'vibration', 7.8, 'mm/s'), ('AST-003', 'temperature', 74.5, 'C'), ('AST-003', 'pressure', 1.9, 'bar'),
('AST-004', 'vibration', 0.9, 'mm/s'), ('AST-004', 'temperature', 44.2, 'C'), ('AST-004', 'pressure', 2.1, 'bar'),
('AST-005', 'vibration', 4.5, 'mm/s'), ('AST-005', 'temperature', 78.9, 'C'), ('AST-005', 'pressure', 3.8, 'bar');
GO

INSERT INTO health_scores (asset_id, health_score, rul, mtbf, anomaly_detected, status) VALUES
('AST-001', 88.0, 79.2, 200.0, 0, 'healthy'),
('AST-002', 54.0, 48.6, 245.0, 0, 'caution'),
('AST-003', 31.0, 27.9, 290.0, 1, 'critical'),
('AST-004', 76.0, 68.4, 335.0, 0, 'healthy'),
('AST-005', 42.0, 37.8, 380.0, 0, 'caution');
GO

INSERT INTO alerts (asset_id, severity, message) VALUES
('AST-003', 'critical', 'Health score critical — predictive maintenance required immediately'),
('AST-002', 'caution',  'Vibration levels rising — monitor closely'),
('AST-005', 'caution',  'Temperature approaching upper operational limit');
GO

INSERT INTO energy_readings (zone, type, actual, baseline, unit) VALUES
('Zone 1', 'electricity', 138.5, 120.0, 'kWh'),
('Zone 1', 'water',       47.2,  45.0,  'L/min'),
('Zone 1', 'gas',         31.8,  30.0,  'm3/h'),
('Zone 2', 'electricity', 115.0, 120.0, 'kWh'),
('Zone 2', 'water',       43.0,  45.0,  'L/min'),
('Zone 3', 'electricity', 156.0, 120.0, 'kWh'),
('Zone 4', 'electricity', 109.5, 120.0, 'kWh');
GO