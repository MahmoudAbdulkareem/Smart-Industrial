CREATE DATABASE SmartDashboard;
GO

USE SmartDashboard;
GO

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
    id            INT IDENTITY(1,1) PRIMARY KEY,
    zone          NVARCHAR(50) NOT NULL,
    pue           FLOAT        NOT NULL,
    eer           FLOAT        NOT NULL,
    co2_emissions FLOAT        NOT NULL,
    recorded_at   DATETIME     NOT NULL DEFAULT GETDATE()
);
GO

CREATE INDEX idx_sensor_asset  ON sensor_readings(asset_id, recorded_at DESC);
CREATE INDEX idx_alerts_active ON alerts(acknowledged, created_at DESC);
CREATE INDEX idx_metrics_zone  ON energy_metrics(zone, recorded_at DESC);
GO

INSERT INTO users (name, email, password, role, is_active, last_login) VALUES
('Ahmed Ben Ali',    'maintenance@dashboard.com', 'PLACEHOLDER', 'maintenance_engineer', 1, GETDATE()),
('Sara Mansouri',    'energy@dashboard.com',      'PLACEHOLDER', 'energy_manager',       1, GETDATE()),
('Youssef El Fassi', 'itadmin@dashboard.com',     'PLACEHOLDER', 'it_admin',             1, GETDATE());
GO

INSERT INTO assets (id, name, type, location, install_date) VALUES
('AST-001', 'Compressor Unit A', 'Compressor', 'Zone 1', '2019-03-15'),
('AST-002', 'Pump Station B',    'Pump',       'Zone 2', '2020-07-22'),
('AST-003', 'Conveyor Belt C',   'Conveyor',   'Zone 3', '2018-11-10'),
('AST-004', 'HVAC Unit D',       'HVAC',       'Zone 1', '2021-01-05'),
('AST-005', 'Motor Drive E',     'Motor',      'Zone 4', '2017-06-30');
GO

INSERT INTO sensor_readings (asset_id, vibration, temperature, pressure, health_score, rul, mtbf, status) VALUES
('AST-001', 1.2, 52.3, 2.8, 88.0, 79.2, 248.5, 'healthy'),
('AST-002', 3.1, 61.0, 3.2, 54.0, 48.6, 213.2, 'caution'),
('AST-003', 7.8, 74.5, 1.9, 31.0, 27.9, 267.4, 'critical'),
('AST-004', 0.9, 44.2, 2.1, 76.0, 68.4, 301.1, 'healthy'),
('AST-005', 4.5, 78.9, 3.8, 42.0, 37.8, 289.6, 'caution');
GO

INSERT INTO alerts (asset_id, severity, message) VALUES
('AST-003', 'critical', 'Health score critical — predictive maintenance required immediately'),
('AST-002', 'caution',  'Vibration levels rising — monitor closely'),
('AST-005', 'caution',  'Temperature approaching upper operational limit');
GO

INSERT INTO energy_metrics (zone, pue, eer, co2_emissions) VALUES
('Zone 1', 1.25, 3.50, 148.0),
('Zone 2', 1.35, 2.90, 172.0),
('Zone 3', 1.15, 3.80, 131.0),
('Zone 4', 1.42, 2.60, 195.0);
GO

