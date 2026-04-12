# Smart Industrial Dashboard — PFE 2026

## Quick Start

### 1. Database
Run `setup.sql` in SQL Server Management Studio against your server.
Then seed passwords:
```
cd backend
npm install
npm run seed
```

### 2. Backend
```
cd backend
cp .env.example .env
npm run dev
```
Server starts on port 5000.

### 3. Frontend
```
cd frontend
npm install
npm start
```
App opens at http://localhost:3000

---

## Login Accounts
| Role | Email | Password |
|---|---|---|
| Maintenance Engineer | maintenance@dashboard.com | maintenance123 |
| Energy Manager | energy@dashboard.com | energy123 |
| IT Admin | itadmin@dashboard.com | itadmin123 |

---

## Features
- **Language** — EN/FR toggle on every page, persisted to localStorage
- **Login** — 2-step email OTP verification + QR code login. When SMTP is not configured, the OTP code appears in a yellow banner (dev mode).
- **KPI Overview** — Live asset health + energy KPIs, auto-refresh every 15s
- **Health View** — Per-asset health scores, RUL, MTBF, sensor readings, work order creation
- **Energy View** — Consumption vs baseline with % bars, radial gauges (PUE/EER/CO₂), 24h chart, zone metrics
- **Alerts** — Active/acknowledged alerts with per-asset filtering and pagination
- **User Management** — Full CRUD, role filters, status toggle, deletion countdown badge
- **Auto-deletion** — Accounts deactivated for 24h are automatically deleted by a cron job (runs hourly). Warning emails sent on deactivation and 1h before deletion.

---

## SMTP Setup (optional)
Fill in `.env` with your SMTP credentials to enable real emails.
Without SMTP, the app uses Ethereal (test account) and prints a preview URL to the backend console.
