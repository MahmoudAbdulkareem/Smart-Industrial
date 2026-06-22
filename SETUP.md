# Smart Dashboard — Setup Guide

## Prerequisites
- Node.js 20+
- Python 3.11+
- SQL Server (or Docker)
- Docker + Docker Compose (optional, for full stack)

---

## Option A — Docker Compose (Recommended)

```bash
# 1. Copy env file
cp .env.example .env
# Edit .env — set DB_SERVER, DB_USER, DB_PASSWORD, JWT_SECRET

# 2. Run database setup (SQL Server must be reachable)
# Connect to SQL Server and run:  db.sql

# 3. Seed passwords
cd backend && npm install && npm run seed && cd ..

# 4. Start everything
docker compose up --build
```

- Frontend:   http://localhost:3000
- Backend:    http://localhost:5000
- ML Service: http://localhost:8000
- MQTT:       localhost:1883

---

## Option B — Local Development

### 1. Database
Connect to SQL Server and run `db.sql` in full.

### 2. ML Service
```bash
cd ml-service
pip install -r requirements.txt
python train.py          # generates *.pkl model files
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Backend
```bash
cd backend
npm install
cp ../.env.example ../.env    # edit as needed
npm run seed                  # sets demo passwords
npm run dev                   # nodemon hot-reload
```

### 4. Frontend
```bash
cd frontend
npm install
npm start                     # runs on http://localhost:3000
```

### 5. MQTT (optional)
```bash
docker run -p 1883:1883 -p 9001:9001 \
  -v $(pwd)/mosquitto/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  eclipse-mosquitto:2
```

---

## Demo Accounts

| Role                  | Email                          | Password         |
|-----------------------|--------------------------------|------------------|
| Maintenance Engineer  | maintenance@dashboard.com      | maintenance123   |
| Energy Manager        | energy@dashboard.com           | energy123        |
| IT Admin              | itadmin@dashboard.com          | itadmin123       |

All accounts require **TOTP setup on first login** (use Google Authenticator).

---

## Environment Variables

See `.env.example` for full list. Key variables:

| Variable          | Description                              | Default                        |
|-------------------|------------------------------------------|--------------------------------|
| `DB_SERVER`       | SQL Server hostname                      | localhost                      |
| `DB_PASSWORD`     | SQL Server password                      | Dashboard@2026                 |
| `JWT_SECRET`      | JWT signing secret (change in prod!)     | —                              |
| `ML_SERVICE_URL`  | ML service predict endpoint              | http://127.0.0.1:8000/predict  |
| `MQTT_BROKER_URL` | MQTT broker URL                          | mqtt://localhost:1883          |
| `SMTP_HOST`       | SMTP server for email notifications      | (Mailtrap fallback)            |
| `GMAIL_USER`      | Gmail address for notifications          | —                              |
| `GMAIL_PASS`      | Gmail app password                       | —                              |

---

## CI/CD

Push to GitHub. The pipeline (`.github/workflows/ci-cd.yml`) will:
1. Run Python ML tests
2. Build the backend Docker image
3. Build the React frontend
4. Run an integration smoke test against the ML service
5. Deploy to staging on merge to `main`

Set these GitHub Secrets: `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`

---

## Architecture

```
Browser (React)
    │  WebSocket + REST
    ▼
Node.js Backend (Express + Socket.IO)
    │  HTTP /predict
    ▼                     ▼
Python ML Service     MQTT Broker
(FastAPI)             (Mosquitto)
    │
IsolationForest + LinearRegression
    │
SQL Server (SmartDashboard)
```

## What the ML service does
- **Anomaly detection**: IsolationForest trained on per-asset normal operating ranges
- **Health score**: Calibrated from the Isolation Forest raw anomaly score (0–100)
- **RUL (Remaining Useful Life)**: Linear regression on simulated degradation trajectories
- All models retrained via `python train.py` — included pre-trained `.pkl` files for immediate startup

