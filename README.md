# Smart Industrial Dashboard
**PFE — Mahmoud Abdulkareem | ESPRIT Computer Engineering | 2025–2026**
Predictive Maintenance & Energy Performance Management using IBM Maximo.

---

## First time setup — do this once

### 1. Install backend dependencies
```bash
cd backend
npm install
```

### 2. Fix the user passwords in SQL Server
```bash
cd backend
node fixPasswords.js
```
This updates the hashed passwords in your SQL Server users table.
You can delete fixPasswords.js after running it once.

### 3. Start the backend
```bash
cd backend
node server.js
```
Runs on http://localhost:5000
You should see "Connected to SQL Server — SmartDashboard database"

### 4. Start the frontend (new terminal)
```bash
cd frontend
npm install
npm start
```
Opens http://localhost:3000

---

## Test accounts

| Email | Password | Role |
|---|---|---|
| maintenance@dashboard.com | maintenance123 | Maintenance Engineer |
| energy@dashboard.com | energy123 | Energy Manager |

---

## What each role sees

| Feature | Maintenance Engineer | Energy Manager |
|---|---|---|
| KPI Overview | YES | YES |
| Health View | YES | NO |
| Energy View | NO | YES |
| Alerts (view) | YES | YES |
| Acknowledge Alerts | YES | NO |
| Create Work Orders | YES | NO |
| Configure Thresholds | NO | YES |

---

## Project structure

```
smart-dashboard/
├── backend/
│   ├── server.js        → Express API — all endpoints
│   ├── db.js            → SQL Server connection pool
│   ├── assetData.js     → Read/write assets, readings, alerts, work orders
│   ├── mockData.js      → Energy data (still mocked until Sprint S2 MQTT)
│   ├── users.js         → Find users in SQL Server users table
│   ├── auth.js          → JWT token generation and middleware
│   ├── fixPasswords.js  → One-time script to hash passwords in DB
│   └── package.json
│
└── frontend/
    └── src/
        ├── App.js                  → Auth check, role-based navigation, logout
        ├── index.js                → React entry point
        ├── hooks/
        │   └── useApi.js           → Polling hook with JWT header on every request
        └── components/
            ├── Login.js            → Login form → POST /api/auth/login
            ├── KpiCards.js         → 6 KPI tiles (health + energy summary)
            ├── HealthView.js       → Asset cards, progress bars, Work Order modal
            ├── EnergyView.js       → Recharts area chart, resource badges, thresholds
            └── AlertsPanel.js      → Active alerts, acknowledge → PATCH /api/alerts/:id
```

---

## API endpoints

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | /api/status | No | Any | Health check |
| POST | /api/auth/login | No | Any | Login, returns JWT |
| GET | /api/auth/me | Yes | Any | Get current user |
| GET | /api/assets/health | Yes | Any | Asset health + sensor readings |
| GET | /api/energy | Yes | Any | Energy data + KPIs |
| GET | /api/alerts | Yes | Any | All alerts from DB |
| PATCH | /api/alerts/:id/acknowledge | Yes | Maintenance | Mark alert acknowledged |
| POST | /api/workorders | Yes | Maintenance | Create Work Order → saved to DB |
| GET | /api/workorders | Yes | Any | Work order history |
| POST | /api/thresholds | Yes | Energy | Set alert threshold |

---

## SQL Server database

Database name: SmartDashboard
Connection: localhost\SQLEXPRESS — Windows Authentication

Tables:
- users — login credentials and roles
- assets — the 5 industrial machines
- sensor_readings — one row inserted per asset per API call
- alerts — predictive alerts with acknowledged flag
- work_orders — every work order created through the dashboard
- energy_readings — reserved for Sprint S2 MQTT data

---

## Sprint progress

| Sprint | Weeks | Status | What is done |
|---|---|---|---|
| S0 | W1–W3  | DONE | Environment setup, architecture, GitHub repo |
| S1 | W4–W7  | DONE | Login, JWT, roles, Health View, Energy View, KPI cards, Alerts, SQL Server |
| S2 | W5–W10 | NEXT | MQTT listener, real energy readings into DB |
| S3 | W7–W14 | Upcoming | Real IBM Maximo auth + Work Order via OSLC |
| S4 | W9–W15 | Upcoming | Python ML service, Isolation Forest, FastAPI |
| S5 | W14–W18| Upcoming | Auto Work Order rule engine |
| S6 | W19–W22| Upcoming | PDF/Excel export, CO2 report |
| S7 | W20–W26| Upcoming | End-to-end testing, Swagger docs |
| S8 | W23–W27| Upcoming | PFE report, slides, demo video |

---

## How the data flows

1. User opens localhost:3000
2. App.js checks localStorage for saved user — if none, shows Login
3. User logs in → POST /api/auth/login → bcrypt checks password in SQL Server
4. Backend returns JWT token containing id, name, email, role
5. Token saved to localStorage, role-based navbar renders
6. Every 5-8 seconds useApi hook calls backend endpoints with JWT in header
7. requireAuth middleware verifies token on every protected route
8. Asset health endpoint inserts new sensor_reading row to SQL Server, returns latest per asset
9. Alerts come from SQL Server alerts table
10. Acknowledging an alert → PATCH /api/alerts/:id → sets acknowledged=1 in SQL Server
11. Creating Work Order → POST /api/workorders → saved to work_orders table
