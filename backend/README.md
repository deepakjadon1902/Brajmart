# BrajMart Backend

Node.js + Express + MySQL backend for BrajMart e-commerce platform.

## Setup

1. Copy `.env.example` to `.env` and add your MySQL credentials and JWT secret
2. Run `npm install`
3. (Optional for local testing) Create `uploads/` directory: `mkdir uploads`
4. Add ImageKit credentials to `.env` if you want permanent deployed image storage.
5. Run `npm run dev` (development) or `npm start` (production)

## API Endpoints

### Auth
- `POST /api/auth/register` — Register user
- `POST /api/auth/login` — Login
- `POST /api/auth/google` — Google OAuth
- `GET /api/auth/me` — Get profile (auth required)

### Products
- `GET /api/products` — List all (query: `category`, `search`, `badge`)
- `GET /api/products/:slug` — Get by slug
- `POST /api/products` — Create (admin)
- `PUT /api/products/:id` — Update (admin)
- `DELETE /api/products/:id` — Delete (admin)

### Categories
- `GET /api/categories` — List all
- `POST /api/categories` — Create (admin)
- `PUT /api/categories/:id` — Update (admin)
- `DELETE /api/categories/:id` — Delete (admin)

### Orders
- `GET /api/orders/my` — User's orders (auth)
- `GET /api/orders` — All orders (admin)
- `GET /api/orders/track/:orderId` — Track by numeric ID (public)
- `POST /api/orders` — Create order (auth)
- `PUT /api/orders/:id/status` — Update status (admin)

### DTDC Tracking
- `GET /api/orders/dtdc/track/:lookup` - Live DTDC tracking for dispatched DTDC orders (public)
- `GET /api/orders/admin/dtdc/track/:lookup` - Live DTDC tracking lookup (admin)
- `POST /api/orders/admin/dtdc/pincode` - DTDC origin/destination pincode serviceability check (admin)

Environment variables:
- `DTDC_USERNAME` - DTDC API username
- `DTDC_PASSWORD` - DTDC API password
- `DTDC_ENV` - `production` or `staging` (defaults to `production`)
- `DTDC_ORIGIN_PINCODE` - Store pickup/origin pincode for pincode checks
- `DTDC_TRACKING_URL` - Optional production tracking URL override
- `DTDC_PINCODE_URL` - Optional pincode API URL override

### Payments
- `GET /api/payments` — All payments (admin)
- `POST /api/payments` — Record payment (auth)
- `PUT /api/payments/:id` — Update status (admin)

### Settings
- `GET /api/settings` — Get store settings (public)
- `PUT /api/settings` — Update settings (admin)

### Upload
- `POST /api/upload` — Upload image (auth, max 1MB)
