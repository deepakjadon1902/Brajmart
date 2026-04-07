# BrajMart - Full Setup Requirements

This README lists everything you need from your side to make the application fully working (backend + frontend + payments + emails).

## 1) Database (Hostinger MySQL)

Run the schema:
- File: `backend/sql/hostinger_schema.sql`
- Run it inside your Hostinger MySQL database

Required DB env in `backend/.env`:
```
DB_HOST=your_hostinger_mysql_host
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

## 2) Backend Environment

Required:
```
JWT_SECRET=your_super_secret_key
CORS_ORIGIN=http://localhost:8080
FRONTEND_URL=http://localhost:8080
BACKEND_URL=http://localhost:5000
```

Optional (Payments + Email):
```
PAYU_KEY=your_key
PAYU_SALT=your_salt
PAYU_ENV=test   # or live

SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=orders@yourdomain.com

UPI_WEBHOOK_SECRET=your_secret
```

## 3) Admin Access (Separate Admin Table)

Admins are stored in a separate table: `admins`.

Set these in `backend/.env`:
```
ADMIN_EMAIL=deepakjadon1907@gmail.com
ADMIN_PASSWORD=deepakjadon1907@
ADMIN_NAME=Deepak Jadon
ADMIN_FORCE_SINGLE=true
```

Seed admin (creates or updates the admin):
```
npm run seed:admin
```

Admin login URL:
- `/admin/login`

## 4) Frontend Environment

Set this in `frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

## 5) Install + Run

Backend:
```
cd backend
npm install
npm run dev
```

Frontend:
```
cd frontend
npm install
npm run dev
```

## 6) User Flow

- Normal users: register + login (mock Google login is also enabled)
- Admin: login from `/admin/login`

## 7) Notes

- Payments (PayU) will only work if PayU credentials are correct.
- Email notifications will only work if SMTP credentials are correct.
- If DB is not connected, the backend falls back to in-memory mode (not for production).
