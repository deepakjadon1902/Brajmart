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

## 4) Image Uploads

Set these in `backend/.env` to store optimized uploads in ImageKit:
```
UPLOAD_PROVIDER=imagekit
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
IMAGEKIT_FOLDER=/brajmart
IMAGEKIT_UPLOAD_MAX_WIDTH=2000
IMAGEKIT_UPLOAD_QUALITY=82
```

ImageKit setup checklist:
- ImageKit dashboard -> Developer options -> API keys:
  - Use **Standard keys** for the backend upload API.
  - `IMAGEKIT_PUBLIC_KEY` = Standard Public Key
  - `IMAGEKIT_PRIVATE_KEY` = Standard Private Key
  - `IMAGEKIT_URL_ENDPOINT` = URL-endpoint, for example `https://ik.imagekit.io/your_id`
  - Do not use Restricted keys unless the restricted key is explicitly allowed
    to upload/manage media.
- ImageKit dashboard -> Media library:
  - Create/use folder `brajmart` (the env value should stay `/brajmart`)
- Backend hosting environment:
  - Add the same ImageKit variables to Hostinger/backend env, not only local `.env`
  - Restart the Node backend after changing env variables
- Admin verification:
  - Log in as admin, then request `GET /api/upload/status`
  - Expected result: `provider` is `imagekit` and `imagekitConfigured` is `true`
- Upload verification:
  - Upload a logo/product/category/hero image from admin
  - The saved DB URL should start with `https://ik.imagekit.io/...`
  - It should not start with `http://localhost...` or `/uploads/...`

Audit old local image URLs:
```
cd backend
npm run audit:images
```

Migrate old local image URLs when the matching files still exist in
`backend/uploads`:
```
cd backend
npm run migrate:images:imagekit
npm run audit:images
```

If phpMyAdmin still shows `localhost` in fields such as `settings.store_logo`,
upload that image again from the admin panel after ImageKit is configured, then
click **Save Settings**. The old local URL in the database should be replaced by
an ImageKit URL.

## 5) Frontend Environment

Set this in `frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
```

For production, set the deployed backend API URL in the frontend hosting
environment before building:
```
VITE_API_URL=https://your-backend-domain.example.com/api
VITE_API_BASE_URL=https://your-backend-domain.example.com/api
VITE_SITE_URL=https://www.brajmart.com
API_BASE_URL=https://your-backend-domain.example.com/api
```

This is SEO-critical because the build-time sitemap generator uses that API to
include live product, category, subcategory, and blog URLs.

## 6) Install + Run

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

## 7) User Flow

- Normal users: register + login (mock Google login is also enabled)
- Admin: login from `/admin/login`

## 8) Notes

- Payments (PayU) will only work if PayU credentials are correct.
- Email notifications will only work if SMTP credentials are correct.
- DB is required. Backend will not run without a valid database connection.
