# BrajMart Backend

Node.js + Express + MySQL backend for BrajMart e-commerce platform.

## Setup

1. Copy `.env.example` to `.env` and add your MySQL credentials and JWT secret
2. Run `npm install`
3. (Optional for local testing) Create `uploads/` directory: `mkdir uploads`
4. Add Cloudinary credentials to `.env` if you want permanent deployed image storage.
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

### Payments
- `GET /api/payments` — All payments (admin)
- `POST /api/payments` — Record payment (auth)
- `PUT /api/payments/:id` — Update status (admin)

### Settings
- `GET /api/settings` — Get store settings (public)
- `PUT /api/settings` — Update settings (admin)

### Upload
- `POST /api/upload` — Upload image (auth, max 1MB)
