# Smart Dashboard

Complete setup, configuration and feature documentation for the Smart Dashboard application.

---

# Table of Contents

* Project Overview

* Requirements

* Installation

* Running the Project

* Environment Variables

* Database Setup

* Database Migration (2FA)

* Demo Accounts

* Authentication (2FA)

* Reset 2FA (Admin)

* User Roles

* Features

* Energy View

* Health View

* Export Functionality

* Chatbot Integration

* Project Structure

* First Time Setup Checklist

* Troubleshooting

---

# Project Overview

The Smart Dashboard is a web application. It provides system monitoring, energy analytics, user management and reporting tools. The application includes role-based access control, two-factor authentication, exports and an integrated AI chatbot.

The project consists of two parts:

* Backend (Node.js / Express API)

* Frontend (React Dashboard UI)

---

# Requirements

Before running the project you need to install:

* Node.js (version 18 or newer is recommended)

* npm

* SQL Server / existing project database

* Google Authenticator ( app for 2FA)

---

# Installation

To install, clone the repository and install dependencies.

## Backend

```bash

cd backend

npm install

```

## Frontend

```bash

cd frontend

npm install

```

---

# Running the Project

Run the backend and frontend in two terminals.

## Terminal 1. Backend

```bash

cd backend

npm run seed

npm start

```

## Terminal 2. Frontend

```bash

cd frontend

npm start

```

The default ports are:

Backend: [http://localhost:5000](http://localhost:5000)

Frontend: [http://localhost:3000](http://localhost:3000)

---

# Environment Variables

Create a `.env` file inside the frontend folder.

frontend/.env

```bash

REACT_APP_GEMINI_API_KEY=your_api_key_here

```

This key is used for the Smart Dashboard chatbot.

---

# Database Setup

The application uses an existing users table. The seed script creates demo users for testing.

To run use:

```bash

npm run seed

```

This will insert demo accounts.

---

# Database Migration (2FA)

If you are upgrading an existing database run the following SQL:

```sql

ALTER TABLE users ADD totp_secret NVARCHAR(100) NULL;

ALTER TABLE users ADD totp_enabled BIT NOT DEFAULT 0;

GO

```

New columns:

| Column       | Description                          |

| ------------ | ------------------------------------ |

| totp_secret  | Secret used for Google Authenticator

| totp_enabled | Indicates if 2FA is enabled          |

---

# Demo Accounts

After running the seed script:

| Role                 | Email                                                         | Password       |

| -------------------- | ------------------------------------------------------------- | --------------

| Maintenance Engineer | [maintenance@dashboard.com](mailto:maintenance@dashboard.com) | maintenance123 |

| Energy Manager       | [energy@dashboard.com](mailto:energy@dashboard.com)           | energy123      |

| IT Admin             | [itadmin@dashboard.com](mailto:itadmin@dashboard.com)         | itadmin123

On the first login each account will require 2FA setup.

---

# Authentication (Two‑Factor Authentication)

The Smart Dashboard uses Google Authenticator (TOTP) for login security.

## First Login Flow

1. The user enters their email and password.

2. The server validates the credentials.

3. If 2FA is not configured a QR code screen appears.

4. The user scans the QR code with Google Authenticator.

5. The user enters the 6-digit code.

6. 2FA is enabled.

## Subsequent Login Flow

1. Enter email and password.

2. Open the authenticator app.

3. Enter the 6-digit code.

4. Login is successful.

No email or SMS is required.

---

# Install Google Authenticator

Download the app:

Android

[https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2](https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2)

iOS

[https://apps.apple.com/app/google-authenticator/id388497605](https://apps.apple.com/app/google-authenticator/id388497605)

Other supported apps:

* Microsoft Authenticator

* Authy

* 1Password

---

# Reset 2FA (IT Admin)

If a user loses their phone:

1. Login as IT Admin.

2. Go to User Management.

3. Click the user details icon.

4. Click Reset 2FA.

5. Save.

The next login will show the QR setup again.

---

# User Roles

## IT Admin

Permissions:

* Create users

* Edit users

* Activate / deactivate users

* Reset 2FA

* View all dashboards

## Energy Manager

Permissions:

* View energy dashboard

* Export reports

* View analytics

## Maintenance Engineer

Permissions:

* View system health

* Access maintenance data

* Monitor metrics

---

# Features

## Authentication

* Email and password login

* Google Authenticator 2FA

* QR code setup

* Admin reset 2FA

* Secure TOTP verification

## User Management

* Create users

* Edit users

* users

* Phone number field

* Role assignment

* Activate / deactivate user

---

# Energy View

The new redesign includes:

* Improved layout

* Updated charts

* Cleaner UI

* Better filtering

* Export support

---

# Health View

Includes:

* System metrics

* Monitoring panels

* Performance indicators

* Export support

---

# Export Functionality

Available in:

* Energy View

* Health View

Supported formats:

* PDF

* Excel

* CSV

Exports include:

* Tables

* Charts

* Filtered results

* Date range data

---

# Chatbot Integration

The Smart Dashboard includes an AI assistant.

Model:

Gemini 1.5 Flash

Configured using:

frontend/.env

```bash

REACT_APP_GEMINI_API_KEY=your_key_here

```

Capabilities:

* Explain dashboard metrics

* Help navigate UI

* Answer data questions

* Provide help

---

# Project Structure

```bash

smart-dashboard/

backend/

├── controllers/

├── routes/

├── middleware/

├── seed/

└── server.js

frontend/

├── components/

├── pages/

├── services/

└── App.js

README.md

```

---

# First Time Setup Checklist

1. Install backend dependencies.

2. Install frontend dependencies.

3. Run database seed.

4. Start backend.

5. Start frontend.

6. Login using demo account.

7. Scan QR code.

8. Enter 6-digit code.

9. Dashboard is ready.

---

# Troubleshooting

## QR Code not showing

* Ensure backend is running.

* Check totp_enabled = 0.

* Reload login page.

## Invalid authenticator code

* Check phone time sync.

* Wait for code.

* Reset 2FA if needed.

## Cannot login after enabling 2FA

* Reset 2FA, from IT Admin.

* Login again.

---

# Added in This Version

* Google Authenticator 2FA

* QR setup screen

* TOTP verification backend

* Reset 2FA (Admin)

* Phone number field

* Energy view redesign

* Export PDF / Excel / CSV

* Gemini chatbot integration

* Seed demo accounts

---

End of README