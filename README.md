# SmartDashboard — Predictive Maintenance & Energy Performance Platform

> Enterprise-grade industrial monitoring platform combining IoT telemetry, machine learning, energy analytics, and IBM Maximo integration.

## Overview

SmartDashboard is a full-stack Industry 4.0 platform built to monitor industrial assets, detect anomalies, estimate Remaining Useful Life (RUL), manage energy consumption, and automate maintenance workflows through IBM Maximo integration.

### Core Capabilities

- Real-time industrial telemetry monitoring
- Isolation Forest anomaly detection
- Remaining Useful Life (RUL) prediction
- Asset health scoring
- Energy performance management
- MQTT-based data streaming
- SQL Server analytics platform
- IBM Maximo MIF integration
- Automated work-order generation
- Role-based administration

---

## Architecture

```text
React Frontend
      │
      ▼
Node.js + Express API
      │
 ┌────┴────┐
 ▼         ▼
SQL     MQTT
Server  Broker
 │
 ▼
FastAPI ML Service
 │
 ▼
IBM Maximo
```

---

## Technology Stack

| Layer | Technologies |
|---------|------------|
| Frontend | React, Recharts |
| Backend | Node.js, Express |
| Database | Microsoft SQL Server |
| Messaging | MQTT (Mosquitto) |
| ML | Python, FastAPI, Scikit-Learn |
| Auth | JWT |
| Realtime | Socket.IO |
| Integration | IBM Maximo MIF |

---

## Project Structure

```text
backend/
frontend/
ml-service/
sql/
mosquitto/
```

---

## Machine Learning Pipeline

### Inputs

- Vibration
- Temperature
- Pressure

### Features

- RMS Mean
- RMS Standard Deviation
- Kurtosis Mean
- Peak-to-Peak Mean

### Outputs

- Anomaly Score
- Health Score
- Degradation State
- Remaining Useful Life (RUL)

### Asset States

| State | Meaning |
|---------|---------|
| NORMAL | Healthy |
| WARNING | Degrading |
| CRITICAL | Immediate attention required |

---

## Installation

### 1. Create Database

Run:

```sql
sql/base_schema.sql
sql/schema_extension.sql
```

### 2. Install ML Service

```bash
cd ml-service
pip install -r requirements.txt
pip install matplotlib
```

### 3. Load Dataset

```bash
python dataset/ingest_dataset.py
```

or

```bash
python ingestion/ims_ingest.py
```

### 4. Run Anomaly Processing

```bash
python pipeline/anomaly_pipeline.py
```

### 5. Train Models

```bash
python train.py
```

### 6. Start ML API

```bash
uvicorn main:app --port 8000
```

### 7. Start Backend

```bash
cd backend
npm install
npm start
```

### 8. Start MQTT Broker

```bash
mosquitto -c mosquitto/mosquitto.conf
```

### 9. Replay Telemetry

```bash
npm run publish
```

### 10. Start Frontend

```bash
cd frontend
npm install
npm start
```

---

## IBM Maximo Integration

Supports:

### Local Mode

- No external dependencies
- Local work-order storage
- Ideal for development and demonstrations

### Real Maximo Mode

Configure:

```env
MAXIMO_BASE_URL=https://your-maximo-instance/maximo
MAXIMO_API_KEY=your-api-key
MAXIMO_SITE_ID=SITEID
```

Features:

- Automatic work-order synchronization
- Retry queue
- Connection monitoring
- Sync history tracking
- Admin control panel

---

## User Roles

### Maintenance Engineer

- Asset monitoring
- Work-order management
- Failure investigation

### Energy Manager

- Energy KPI monitoring
- Sustainability reporting
- Consumption analysis

### IT Administrator

- User management
- System configuration
- Maximo integration management

---

## Key Improvements

- Real SQL-backed telemetry pipeline
- Isolation Forest anomaly detection
- RUL prediction engine
- Unified MQTT publisher
- Real IBM Maximo integration
- Maximo Sync dashboard
- Clean layered architecture
- Repository + Service patterns
- Real-time WebSocket updates

---

## API Overview

### Assets

```http
GET /api/assets
GET /api/assets/health
```

### Energy

```http
GET /api/energy/*
```

### Work Orders

```http
GET /api/workorders
POST /api/workorders
```

### Alerts

```http
GET /api/alerts
```

### Users

```http
GET /api/users
```

### Maximo

```http
GET /api/maximo/test-connection
GET /api/maximo/sync/recent
POST /api/maximo/sync/retry
```

---

## Academic Context

Developed as a Smart Industrial Dashboard for predictive maintenance and energy performance management, demonstrating Industry 4.0 concepts through IoT integration, machine learning, enterprise asset management, and operational analytics.

## License

Educational, research, and demonstration purposes.
