USE SmartDashboard;
GO

CREATE TABLE telemetry_raw (
    id              BIGINT IDENTITY(1,1) NOT NULL,
    asset_id        NVARCHAR(25)   NOT NULL REFERENCES assets(id),
    source_dataset  NVARCHAR(50)   NOT NULL,
    channel         NVARCHAR(50)   NOT NULL,
    vibration       FLOAT          NULL,
    temperature     FLOAT          NULL,
    rms             FLOAT          NULL,
    kurtosis        FLOAT          NULL,
    peak_to_peak    FLOAT          NULL,
    recorded_at     DATETIME2(3)   NOT NULL,
    ingested_at     DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_telemetry_raw PRIMARY KEY NONCLUSTERED (id)
);
GO

CREATE CLUSTERED INDEX CIX_telemetry_raw_recorded_at
    ON telemetry_raw (recorded_at, asset_id);
GO

CREATE NONCLUSTERED INDEX IX_telemetry_raw_asset
    ON telemetry_raw (asset_id, recorded_at)
    INCLUDE (vibration, temperature, rms, kurtosis, peak_to_peak);
GO

CREATE TABLE ml_model_registry (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    model_name    NVARCHAR(100) NOT NULL,
    model_version NVARCHAR(50)  NOT NULL,
    algorithm     NVARCHAR(50)  NOT NULL,
    trained_at    DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    artifact_path NVARCHAR(300) NULL,
    is_active     BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UQ_ml_model_registry UNIQUE (model_name, model_version)
);
GO

CREATE TABLE ml_inference_results (
    id                BIGINT IDENTITY(1,1) NOT NULL,
    asset_id          NVARCHAR(25)  NOT NULL REFERENCES assets(id),
    model_id          INT           NOT NULL REFERENCES ml_model_registry(id),
    window_start      DATETIME2(3)  NOT NULL,
    window_end        DATETIME2(3)  NOT NULL,
    trend_component   FLOAT         NULL,
    seasonal_component FLOAT        NULL,
    residual_component FLOAT        NULL,
    anomaly_score     FLOAT         NOT NULL,
    anomaly_flag      BIT           NOT NULL DEFAULT 0,
    degradation_state NVARCHAR(25)  NOT NULL DEFAULT 'NORMAL',
    rul_estimate_hours FLOAT        NULL,
    created_at        DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ml_inference_results PRIMARY KEY NONCLUSTERED (id)
);
GO

CREATE CLUSTERED INDEX CIX_ml_inference_results_window
    ON ml_inference_results (window_end, asset_id);
GO

CREATE NONCLUSTERED INDEX IX_ml_inference_results_anomaly
    ON ml_inference_results (anomaly_flag, asset_id, window_end);
GO

CREATE TABLE maximo_assets (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    asset_id         NVARCHAR(25)   NOT NULL UNIQUE REFERENCES assets(id),
    assetnum         NVARCHAR(50)   NOT NULL UNIQUE,
    siteid           NVARCHAR(20)   NOT NULL DEFAULT 'LOCAL',
    orgid            NVARCHAR(20)   NOT NULL DEFAULT 'LOCALORG',
    status           NVARCHAR(25)   NOT NULL DEFAULT 'OPERATING',
    assettype        NVARCHAR(50)   NULL,
    description      NVARCHAR(300)  NULL,
    last_synced_at   DATETIME2(3)   NULL
);
GO

CREATE TABLE maximo_workorders (
    id               BIGINT IDENTITY(1,1) PRIMARY KEY,
    wonum            NVARCHAR(50)   NOT NULL UNIQUE,
    asset_id         NVARCHAR(25)   NOT NULL REFERENCES assets(id),
    assetnum         NVARCHAR(50)   NOT NULL,
    siteid           NVARCHAR(20)   NOT NULL DEFAULT 'LOCAL',
    description      NVARCHAR(500)  NOT NULL,
    worktype         NVARCHAR(25)   NOT NULL DEFAULT 'CM',
    priority         INT            NOT NULL DEFAULT 2,
    status           NVARCHAR(25)   NOT NULL DEFAULT 'WAPPR',
    reported_by      NVARCHAR(100)  NOT NULL DEFAULT 'ML_ANOMALY_SERVICE',
    source_inference_id BIGINT      NULL REFERENCES ml_inference_results(id),
    mif_payload      NVARCHAR(MAX)  NOT NULL,
    created_at       DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE NONCLUSTERED INDEX IX_maximo_workorders_asset
    ON maximo_workorders (asset_id, created_at);
GO

CREATE TABLE maximo_sync_log (
    id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_type    NVARCHAR(25)   NOT NULL,
    entity_local_id BIGINT        NOT NULL,
    direction      NVARCHAR(10)   NOT NULL DEFAULT 'OUTBOUND',
    sync_status    NVARCHAR(20)   NOT NULL DEFAULT 'PENDING',
    endpoint       NVARCHAR(300)  NULL,
    request_payload  NVARCHAR(MAX) NULL,
    response_payload NVARCHAR(MAX) NULL,
    error_message  NVARCHAR(1000) NULL,
    attempted_at   DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    completed_at   DATETIME2(3)   NULL
);
GO

CREATE NONCLUSTERED INDEX IX_maximo_sync_log_status
    ON maximo_sync_log (sync_status, attempted_at);
GO
