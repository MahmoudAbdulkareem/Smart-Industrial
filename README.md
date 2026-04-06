# Smart Industrial Dashboard

**PFE — Mahmoud Abdulkareem | ESPRIT Computer Engineering | 2025–2026**
Predictive Maintenance & Energy Performance Management using IBM Maximo

---

# First time setup 

## 1. Install backend dependencies

```bash
cd backend
npm install
```

## 2. Fix the user passwords in SQL Server

```bash
cd backend
node fixPasswords.js
```

This script updates the hashed passwords in the SQL Server `users` table.
You only need to run it once. You can delete `fixPasswords.js` afterwards.

## 3. Start the backend

```bash
cd backend
node server.js
```

Backend runs on:
http://localhost:5000

If everything is correct you should see:

```
Connected to SQL Server — SmartDashboard database
```

## 4. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm start
```

Frontend opens automatically at:
http://localhost:3000

---

# Test accounts - Examples ( Changeable )

| Email                                                         | Password       | Role                 |
| ------------------------------------------------------------- | -------------- | -------------------- |
| [maintenance@dashboard.com](mailto:maintenance@dashboard.com) | maintenance123 | Maintenance Engineer |
| [energy@dashboard.com](mailto:energy@dashboard.com)           | energy123      | Energy Manager       |

---

# What each role sees ( Protected Routes )

| Feature              | Maintenance Engineer | Energy Manager |
| -------------------- | -------------------- | -------------- |
| KPI Overview         | YES                  | YES            |
| Health View          | YES                  | NO             |
| Energy View          | NO                   | YES            |
| Alerts (view)        | YES                  | YES            |
| Acknowledge Alerts   | YES                  | NO             |
| Create Work Orders   | YES                  | NO             |
| Configure Thresholds | NO                   | YES            |

---

# Project structure

```
smart-dashboard/
│
├── backend/
│   ├── server.js        → Express API (all endpoints)
│   ├── db.js            → SQL Server connection
│   ├── assetData.js     → Assets, readings, alerts, work orders
│   ├── mockData.js      → Energy data (temporary mock)
│   ├── users.js         → Users table queries
│   ├── auth.js          → JWT auth middleware
│   ├── fixPasswords.js  → One-time password hashing script
│   └── package.json
│
└── frontend/
    └── src/
        ├── App.js
        ├── index.js
        │
        ├── hooks/
        │   └── useApi.js
        │
        └── components/
            ├── Login.js
            ├── KpiCards.js
            ├── HealthView.js
            ├── EnergyView.js
            └── AlertsPanel.js
```

### Component description

* **App.js** → authentication check, role navigation, logout
* **useApi.js** → polling hook with JWT header
* **Login.js** → login form (`POST /api/auth/login`)
* **KpiCards.js** → KPI tiles (health + energy summary)
* **HealthView.js** → asset cards + work order modal
* **EnergyView.js** → charts + thresholds
* **AlertsPanel.js** → alerts list + acknowledge action

---

# API endpoints

| Method | Endpoint                    | Auth | Role        | Description          |
| ------ | --------------------------- | ---- | ----------- | -------------------- |
| GET    | /api/status                 | No   | Any         | API health check     |
| POST   | /api/auth/login             | No   | Any         | Login and return JWT |
| GET    | /api/auth/me                | Yes  | Any         | Current user         |
| GET    | /api/assets/health          | Yes  | Any         | Asset health data    |
| GET    | /api/energy                 | Yes  | Any         | Energy KPIs          |
| GET    | /api/alerts                 | Yes  | Any         | All alerts           |
| PATCH  | /api/alerts/:id/acknowledge | Yes  | Maintenance | Acknowledge alert    |
| POST   | /api/workorders             | Yes  | Maintenance | Create work order    |
| GET    | /api/workorders             | Yes  | Any         | Work order history   |
| POST   | /api/thresholds             | Yes  | Energy      | Set thresholds       |

---

# SQL Server database

Database name:

```
SmartDashboard
```

Connection:

```
localhost\SQLEXPRESS
Windows Authentication
```

### Tables

* **users** → login credentials and roles
* **assets** → industrial machines
* **sensor_readings** → asset sensor values
* **alerts** → predictive alerts
* **work_orders** → created work orders
* **energy_readings** → reserved for MQTT data (S2)

---

# Sprint progress

| Sprint | Weeks   | Status   | Description                  |
| ------ | ------- | -------- | ---------------------------- |
| S0     | W1–W3   | DONE     | Project setup, architecture  |
| S1     | W4–W7   | DONE (semi)   | Auth, roles, dashboard views |
| S2     | W5–W10  | NEXT     | MQTT energy ingestion        |
| S3     | W7–W14  | Upcoming | IBM Maximo integration       |
| S4     | W9–W15  | Upcoming | Python ML anomaly detection  |
| S5     | W14–W18 | Upcoming | Auto work order engine       |
| S6     | W19–W22 | Upcoming | PDF / Excel export           |
| S7     | W20–W26 | Upcoming | Testing + Swagger docs       |
| S8     | W23–W27 | Upcoming | Report + demo                |

---

---
