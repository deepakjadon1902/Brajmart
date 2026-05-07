# Order Tracking System Implementation

## Overview
This document describes the complete implementation of the Order Tracking System with unique 6-digit tracking IDs and shipping service selection.

## Features Implemented

### 1. **Unique 6-Digit Tracking IDs**
- Each order receives a randomly generated 6-digit unique tracking ID (e.g., `543821`)
- Generated automatically when order is created
- Stored in database with UNIQUE constraint to prevent duplicates
- User can track order using either Order ID or Tracking ID

### 2. **Shipping Service Selection**
- Admin can select one of 5 shipping services:
  - DTDC
  - Shree Maruti
  - Delhivery
  - India Post
  - Ekart
- Displayed on order details for both customer and admin
- Updated from admin panel when changing order status

### 3. **Database Schema Updates**

#### New Columns Added to `orders` table:
```sql
-- 6-digit unique tracking ID
tracking_id VARCHAR(6) UNIQUE NULL

-- Shipping service selection
shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart') NULL
```

#### New Index:
```sql
INDEX idx_orders_tracking_id (tracking_id)
```

## Backend Changes

### File: `src/routes/orders.ts`

#### New Function:
```typescript
const generateUniqueTrackingId = async (): Promise<string> => {
  let trackingId: string;
  let attempts = 0;
  do {
    trackingId = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
    if (attempts > 10) throw new Error('Unable to generate unique tracking ID');
  } while (await dbQuery('SELECT 1 FROM orders WHERE tracking_id = ? LIMIT 1', [trackingId]).then(rows => rows.length > 0));
  return trackingId;
};
```

#### Updated `mapOrderRow()`:
- Added `shippingService` field to order response

#### Updated `POST /orders`:
- Generates unique 6-digit tracking ID automatically
- Sets `shipping_service` to NULL initially (admin can set later)

#### Updated `GET /track/:orderId`:
- Existing endpoint remains unchanged (tracks by Order ID)

#### New Endpoint: `GET /orders/track-by-id/:trackingId`
- Tracks order by 6-digit Tracking ID
- Returns full order details

#### Updated `PUT /orders/:id/status`:
- Now accepts optional `shippingService` parameter
- Admin can update shipping service while updating status
- Only updates `shipping_service` if provided

## Frontend Changes

### File: `lib/api.ts`

#### New Function:
```typescript
export const trackOrderById = (trackingId: string) =>
  getJson(`/orders/track-by-id/${trackingId}`);
```

#### Updated Function:
```typescript
export const updateOrderStatus = (id: string, payload: { 
  status: string; 
  note?: string; 
  shippingService?: string // NEW
}) =>
  getJson<Record<string, any>>(`/orders/${id}/status`, { method: 'PUT', body: payload });
```

### File: `pages/TrackOrderPage.tsx`

#### Updated Features:
- Can now search by either Order ID (numeric) or Tracking ID (6-digit)
- Updated placeholder: "Enter Order ID or Tracking ID"
- Smart detection: tries Tracking ID first, then Order ID
- Shows tracking ID and shipping service in results
- Added `useSearchParams` to support direct links

#### New Functionality:
```typescript
const handleTrack = async (e: React.FormEvent) => {
  e.preventDefault();
  const input = orderId.trim();
  
  let found;
  // Try tracking by tracking ID first
  try {
    found = await trackOrderById(input);
  } catch {
    // If not found, try by order ID if numeric
    const numeric = input.replace(/\D/g, '');
    if (numeric && numeric === input) {
      found = await trackOrder(numeric);
    } else {
      throw new Error('Order not found');
    }
  }
  setOrder(found);
};
```

### File: `pages/ProfileOrdersPage.tsx`

#### Updated Features:
- Displays Tracking ID (clickable, links to track order page)
- Shows Shipping Service if assigned
- Click tracking ID to automatically track that order

### File: `pages/admin/AdminOrders.tsx`

#### New Features:
- Shipping service dropdown in order detail modal
- Can select/change shipping service for any order
- Updates in real-time

#### Updated Functionality:
```typescript
const shippingServices = ['DTDC', 'Shree Maruti', 'Delhivery', 'India Post', 'Ekart'];

const handleStatusUpdate = async (orderId: string, status: OrderStatus, shippingService?: string) => {
  const payload: any = { status, note: `Status updated to ${status}` };
  if (shippingService) payload.shippingService = shippingService;
  const updated: any = await updateOrderStatusApi(orderId, payload);
  // ...
};
```

## User Workflows

### Customer Workflow:

1. **Place Order**
   - Order placed successfully
   - Unique 6-digit tracking ID generated automatically
   - Shown in order confirmation

2. **Track Order (Option 1 - Using Tracking ID)**
   - Go to Track Order page
   - Enter 6-digit Tracking ID (e.g., `543821`)
   - View order status and shipping service
   - See live status updates

3. **Track Order (Option 2 - Using Order ID)**
   - Go to Track Order page
   - Enter Order ID (numeric, e.g., `10001`)
   - View order details (backwards compatible)

4. **View My Orders**
   - Go to My Orders page
   - See Tracking ID for each order
   - Click Tracking ID to jump to Track Order page
   - See assigned Shipping Service
   - View order status and history

### Admin Workflow:

1. **View All Orders**
   - Orders Management page shows all orders
   - Search by Order ID or Customer Name

2. **Update Order Status & Shipping Service**
   - Open order detail modal
   - Select Shipping Service from dropdown (DTDC, Shree Maruti, etc.)
   - Select new Status (confirmed → processing → shipped → etc.)
   - Changes applied immediately

3. **Order History**
   - See status history timeline
   - See when and how order status changed

## Migration Steps

### Step 1: Update Database Schema
Run the migration script:
```bash
mysql -u your_user -p your_database < backend/sql/migrate_orders_schema.sql
```

Or manually execute in MySQL Workbench:
```sql
ALTER TABLE orders 
ADD COLUMN tracking_id VARCHAR(6) UNIQUE NULL,
ADD COLUMN shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart') NULL;

CREATE INDEX idx_orders_tracking_id ON orders(tracking_id);
```

### Step 2: Rebuild Backend
```bash
cd backend
npm run build
```

### Step 3: Deploy Updates
```bash
npm run start
```

### Step 4: Test in Frontend
```bash
cd frontend
npm run dev
```

## API Endpoints

### Track Order by Order ID
```
GET /orders/track/:orderId
Response:
{
  orderId: 10001,
  trackingId: "543821",
  status: "shipped",
  shippingService: "DTDC",
  items: [...],
  total: 5000,
  estimatedDelivery: "2026-05-15",
  statusHistory: [...]
}
```

### Track Order by Tracking ID
```
GET /orders/track-by-id/:trackingId
Response: (same as above)
```

### Update Order Status & Shipping Service
```
PUT /orders/:id/status
Body: {
  status: "shipped",
  note: "Order shipped",
  shippingService: "DTDC"  // optional
}
```

## Database Schema

### Orders Table Update
```sql
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  items JSON NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('confirmed','processing','shipped','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'confirmed',
  customer_name VARCHAR(255) NULL,
  customer_email VARCHAR(255) NULL,
  shipping_address JSON NOT NULL,
  billing_address JSON NOT NULL,
  payment_method VARCHAR(100) NOT NULL,
  tracking_id VARCHAR(6) UNIQUE NULL,  -- NEW: 6-digit unique tracking ID
  shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart') NULL,  -- NEW
  estimated_delivery DATETIME NULL,
  status_history JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user_id (user_id),
  INDEX idx_orders_tracking_id (tracking_id),  -- NEW
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Security Considerations

1. **Unique Constraint**: Tracking IDs have UNIQUE constraint to prevent duplicates
2. **Retry Logic**: Generation function has max 10 attempts to prevent infinite loops
3. **Access Control**: 
   - Customers can track any order by tracking ID (no authentication needed)
   - Customers can only update their own orders via My Orders page
   - Admins only via authenticated admin panel

## Testing Checklist

- [ ] Create new order → Verify 6-digit tracking ID generated
- [ ] Track by Tracking ID → Verify order found
- [ ] Track by Order ID → Verify order found (backward compatible)
- [ ] Admin: Set shipping service → Verify displays on track page
- [ ] Admin: Update status → Verify shipping service persists
- [ ] My Orders page → Verify tracking ID clickable and links to track page
- [ ] Track page from My Orders → Verify pre-populates tracking ID
- [ ] Multiple orders → Verify all have unique tracking IDs
- [ ] Database migration → Verify schema updated without errors

## Notes

- Tracking IDs are 6-digit random numbers (100000-999999)
- No conflicts with Order IDs (which are auto-increment database IDs like 10001)
- Customers don't need login to track orders
- Admins can track all orders from admin panel
- Shipping service updated independently from status
- All changes backward compatible with existing orders
