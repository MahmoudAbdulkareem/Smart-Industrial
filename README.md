# Smart Industrial Dashboard
PFE — Mahmoud Abdulkareem | ESPRIT 2025–2026

Built up to Journal de Bord Week 2 (Sprint S0 + S1 start).

---

## How to run

### 1 — Start the backend
```bash
cd backend
npm install
npm start
# Runs on http://localhost:5000
```

### 2 — Start the frontend (new terminal)
```bash
cd frontend
npm install
npm start
# Opens http://localhost:3000
```

Both must run at the same time.
The frontend proxies /api/* calls to localhost:5000.

---

## What's inside

### Backend (Node.js / Express)
- `server.js` — Express server with 4 endpoints
- `mockData.js` — Simulates IBM Maximo Monitor API responses

| Endpoint               | Description                          |
|------------------------|--------------------------------------|
| GET /api/assets/health | Asset health scores + sensor data    |
| GET /api/energy        | Energy data + KPIs                   |
| GET /api/alerts        | Active alerts                        |
| POST /api/workorders   | Create a Work Order (Maximo MIF sim) |

### Frontend (React + Recharts)
- `App.js` — Navigation between 3 tabs
- `KpiCards.js` — Summary KPI tiles (avg health, critical count, PUE, EER, CO₂)
- `HealthView.js` — Asset cards with health score bar, RUL, MTBF, sensors, Work Order button
- `EnergyView.js` — Actual vs baseline chart, per-resource badges
- `hooks/useApi.js` — Polling hook (replaces mock setInterval from journal week 2)

---

## Sprint context
- Week 1 (S0): environment setup, architecture, GitHub, backlog
- Week 2 (S1 start): React bootstrap, Health View, Energy View, KPI cards, mock data
