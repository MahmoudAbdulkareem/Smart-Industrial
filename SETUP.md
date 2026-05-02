# Smart Dashboard — Setup Guide

## Quick Start

```bash
cd backend   && npm install && npm run seed && npm start
cd frontend  && npm install && npm start
```

---

## 🔐 Two-Factor Authentication (Google Authenticator)

No email needed. Login flow:

1. **Enter email + password** → server verifies credentials
2. **If first login** → QR code screen appears → scan with Google Authenticator
3. **Every subsequent login** → open Authenticator app → enter 6-digit code

### Install Google Authenticator
- iOS: https://apps.apple.com/app/google-authenticator/id388497605
- Android: https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2

### If a user loses their phone (IT Admin)
1. Go to User Management → click ℹ detail on the user
2. Click **"Reset 2FA"**
3. User will be prompted to scan a new QR on their next login

---

## Database Migration (existing databases)

Run these SQL commands if upgrading from a previous version:

```sql
ALTER TABLE users ADD totp_secret  NVARCHAR(100) NULL;
ALTER TABLE users ADD totp_enabled BIT NOT NULL DEFAULT 0;
GO
```

---

## Demo Accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Maintenance Engineer | maintenance@dashboard.com | maintenance123 |
| Energy Manager | energy@dashboard.com | energy123 |
| IT Admin | itadmin@dashboard.com | itadmin123 |

> First login with each account will show the QR setup screen.

---

## Features

| Feature | Status |
|---|---|
| 2FA login via Google Authenticator | ✅ Works out of the box |
| Chatbot (Gemini 1.5 Flash) | ✅ Key in frontend/.env |
| Export PDF / Excel / CSV | ✅ Health + Energy views |
| Phone number on users | ✅ |
| SMS via Twilio | ⚠ Add real Twilio keys |
| Energy View redesign | ✅ |
| IT Admin can reset 2FA | ✅ |
