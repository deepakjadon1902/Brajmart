# Order Tracking System - Architecture & Flow Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BRAJMART SYSTEM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐              ┌────────────────────────┐  │
│  │   FRONTEND (React)   │              │   BACKEND (Node.js)    │  │
│  ├──────────────────────┤              ├────────────────────────┤  │
│  │                      │              │                        │  │
│  │ 1. Track Order Page  │──────────────│ GET /orders/track-by-  │  │
│  │    - Dual search     │              │     id/:trackingId     │  │
│  │    - Tracking ID     │              │ (NEW)                  │  │
│  │    - Order ID        │              │                        │  │
│  │    - Shipping Svc    │              │ GET /orders/track/     │  │
│  │                      │              │     :orderId           │  │
│  │ 2. My Orders Page    │              │ (EXISTING)             │  │
│  │    - Show Tracking ID│──────────────│                        │  │
│  │    - Clickable       │              │ PUT /orders/:id/status │  │
│  │    - Shipping Svc    │              │     (with service)     │  │
│  │                      │              │                        │  │
│  │ 3. Admin Orders      │              │ POST /orders           │  │
│  │    - Service Select  │──────────────│ (auto-generate ID)     │  │
│  │    - Status Update   │              │                        │  │
│  │    - Modal UI        │              └────────────────────────┘  │
│  │                      │                                           │
│  └──────────────────────┘              ┌────────────────────────┐  │
│          ↓                             │    DATABASE (MySQL)    │  │
│       api.ts                           ├────────────────────────┤  │
│  trackOrder()                          │                        │  │
│  trackOrderById() (NEW)                │ orders table:          │  │
│  updateOrderStatus()                   │  - tracking_id (NEW)   │  │
│  (with shippingService)                │  - shipping_service    │  │
│                                         │    (NEW)               │  │
│                                         │  - status_history      │  │
│                                         │  - ... other columns   │  │
│                                         │                        │  │
│                                         │ INDEX:                 │  │
│                                         │  - idx_tracking_id     │  │
│                                         │    (NEW)               │  │
│                                         │                        │  │
│                                         └────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Order Tracking Flow

```
CUSTOMER PLACES ORDER
        ↓
        │ POST /orders
        ↓
  ┌─────────────────────────────────┐
  │  Backend Generates Order        │
  ├─────────────────────────────────┤
  │ 1. Create order in database     │
  │ 2. Get order ID from DB         │
  │ 3. Call generateTrackingId()    │
  │ 4. Random 6-digit ID generated  │
  │ 5. Verify uniqueness            │
  │ 6. Save tracking ID to DB       │
  │ 7. Return order with tracking ID│
  └─────────────────────────────────┘
        ↓
   RESPONSE:
   {
     orderId: 10001,
     trackingId: "543821",
     status: "confirmed",
     items: [...],
     total: 5000
   }
        ↓
  ┌─────────────────────────────────┐
  │  Send Email to Customer         │
  ├─────────────────────────────────┤
  │ Subject: Order Confirmed        │
  │ Tracking ID: 543821             │
  │ Order ID: 10001                 │
  │ Link: /track-order?orderId=543821
  └─────────────────────────────────┘
        ↓
  CUSTOMER RECEIVES EMAIL
```

---

## 🔍 Search & Tracking Flow

```
CUSTOMER SEARCHES ORDER
        ↓
  ┌─────────────────────────────────┐
  │  Frontend: handleTrack()        │
  ├─────────────────────────────────┤
  │ 1. User enters search term      │
  │    (e.g., "543821" or "10001")  │
  │ 2. Try trackOrderById() first   │
  │ 3. If fails, try trackOrder()   │
  └─────────────────────────────────┘
        ↓
   TRY: GET /orders/track-by-id/543821
        ↓
    ┌─────────────────────────────┐
    │ Backend finds order by      │
    │ tracking_id = "543821"      │
    │ SELECT * FROM orders        │
    │ WHERE tracking_id = "543821"│
    └─────────────────────────────┘
        ↓
   IF NOT FOUND, TRY: GET /orders/track/10001
        ↓
    ┌─────────────────────────────┐
    │ Backend finds order by      │
    │ id = 10001                  │
    │ SELECT * FROM orders        │
    │ WHERE id = 10001            │
    └─────────────────────────────┘
        ↓
   RESPONSE (same for both):
   {
     orderId: 10001,
     trackingId: "543821",
     status: "shipped",
     shippingService: "DTDC",
     items: [...],
     estimatedDelivery: "2026-05-15",
     statusHistory: [...]
   }
        ↓
   DISPLAY ON TRACK PAGE
   ┌──────────────────────────────┐
   │ Order ID: 10001              │
   │ Tracking ID: 543821          │
   │ Shipping: DTDC               │
   │ Status:                      │
   │ [✓] Confirmed               │
   │ [✓] Processing              │
   │ [✓] Shipped                 │
   │ [✓] Out for Delivery        │
   │ [ ] Delivered               │
   │ Est. Delivery: May 15, 2026  │
   └──────────────────────────────┘
```

---

## 👨‍💼 Admin Update Flow

```
ADMIN UPDATES ORDER
        ↓
  Admin opens Orders Management
        ↓
  Clicks on order detail
        ↓
  ┌─────────────────────────────────┐
  │  Admin Panel Modal Opens        │
  ├─────────────────────────────────┤
  │ Current Status: confirmed       │
  │ Current Service: (none)         │
  │                                 │
  │ [Dropdown: Select Service]      │
  │  > DTDC                         │
  │  > Shree Maruti                 │
  │  > Delhivery                    │
  │  > India Post                   │
  │  > Ekart                        │
  │                                 │
  │ [Status Buttons]                │
  │ [confirmed][processing][shipped]│
  │ [...out_for_delivery][delivered]│
  │ [cancelled]                     │
  └─────────────────────────────────┘
        ↓
  Admin selects:
  - Service: DTDC
  - Status: shipped
        ↓
   PUT /orders/10001/status
   {
     "status": "shipped",
     "shippingService": "DTDC",
     "note": "Status updated to shipped"
   }
        ↓
  ┌─────────────────────────────────┐
  │  Backend Updates Order          │
  ├─────────────────────────────────┤
  │ 1. Fetch order by ID            │
  │ 2. Check status changed         │
  │ 3. Add to history:              │
  │    {                            │
  │      status: "shipped",         │
  │      date: "2026-05-07T...",   │
  │      note: "..."                │
  │    }                            │
  │ 4. Update columns:              │
  │    status = "shipped"           │
  │    shipping_service = "DTDC"    │
  │    status_history = [...]       │
  │ 5. Return updated order         │
  └─────────────────────────────────┘
        ↓
   RESPONSE:
   {
     orderId: 10001,
     status: "shipped",
     shippingService: "DTDC",
     statusHistory: [
       {status: "confirmed", date: "...", note: "..."},
       {status: "processing", date: "...", note: "..."},
       {status: "shipped", date: "...", note: "..."}
     ]
   }
        ↓
  ┌─────────────────────────────────┐
  │  Send Update Email              │
  ├─────────────────────────────────┤
  │ To: customer@email.com          │
  │ Subject: Order Shipped          │
  │ Your order #10001 has shipped   │
  │ via DTDC                        │
  │ Tracking: 543821                │
  │ Track: /track-order?orderId=... │
  └─────────────────────────────────┘
        ↓
  ┌─────────────────────────────────┐
  │  Frontend Shows Toast           │
  ├─────────────────────────────────┤
  │ "Order updated successfully"    │
  │                                 │
  │ Order table refreshed           │
  │ Modal updated                   │
  │ Status = shipped ✓              │
  │ Service = DTDC ✓                │
  └─────────────────────────────────┘
```

---

## 📱 Customer View Evolution

```
BEFORE IMPLEMENTATION          AFTER IMPLEMENTATION
────────────────────────────────────────────────────

My Orders:                     My Orders:
┌──────────────┐              ┌──────────────────┐
│ Order ID     │              │ Order ID         │
│ 10001        │              │ 543821           │
│              │              │ (Clickable)      │
│ Status: sent │              │ Service: DTDC    │
│ Total: 5000  │              │ Status: shipped  │
│              │              │ Total: 5000      │
└──────────────┘              └──────────────────┘
     ↓                              ↓
Can't track                    Click ID → Track Page

Track Order Page:              Track Order Page:
┌──────────────┐              ┌──────────────────┐
│ Enter Order  │              │ Enter ID/Tracking│
│ ID           │              │ (auto-filled)    │
│              │              │                  │
│ Status:      │              │ ID: 543821       │
│ sent         │              │ Service: DTDC ✓  │
│              │              │                  │
│ Total: 5000  │              │ Status:          │
└──────────────┘              │ [✓] confirmed   │
                              │ [✓] shipped     │
                              │ [ ] delivered   │
                              │ Est: May 15     │
                              └──────────────────┘
```

---

## 🗄️ Database Schema Evolution

```
BEFORE                          AFTER
──────────────────────────────────────────────

orders table:                   orders table:
┌──────────────┐               ┌──────────────┐
│ id           │               │ id           │
│ user_id      │               │ user_id      │
│ items        │               │ items        │
│ total        │               │ total        │
│ status       │               │ status       │
│ ...          │               │ ...          │
│ tracking_id* │               │ tracking_id* │
│ (BM10001)    │               │ (543821)✓    │
│              │               │              │
│              │               │ shipping_    │
│              │               │ service*✓    │
│              │               │ (DTDC)✓      │
│              │               │              │
│ *VARCHAR(64) │               │ *VARCHAR(6)  │
│ Nullable     │               │ UNIQUE       │
│              │               │              │
│              │               │ INDEX: idx_  │
│              │               │ tracking_id  │
│              │               │              │
└──────────────┘               └──────────────┘
```

---

## 🔐 Security & Data Flow

```
CUSTOMER (No Auth)              ADMIN (Authenticated)
────────────────────────────────────────────────────

GET /track-by-id/543821         GET /orders (admin only)
  └─ Public API                   └─ JWT required
  └─ Anyone can use                └─ Admin verified
  └─ No sensitive data leaks       └─ All orders visible

PUT /orders/:id/status (admin only)
  └─ JWT required
  └─ Admin role verified
  └─ Can update status
  └─ Can update service
```

---

## 📊 Data Model

```
Order Record:
{
  id: 10001,                        // Auto-increment
  user_id: 5,                       // Nullable
  items: [...],                     // JSON array
  total: 5000,                      // Decimal(10,2)
  status: "shipped",                // Enum (5 options)
  customer_name: "John Doe",        // VARCHAR
  customer_email: "john@email.com", // VARCHAR
  shipping_address: {...},          // JSON
  billing_address: {...},           // JSON
  payment_method: "card",           // VARCHAR
  
  // ✅ NEW FIELDS:
  tracking_id: "543821",            // VARCHAR(6) UNIQUE
  shipping_service: "DTDC",         // ENUM (5 options)
  
  estimated_delivery: "2026-05-15", // DATETIME
  status_history: [                 // JSON array
    {
      status: "confirmed",
      date: "2026-05-07T10:00:00Z",
      note: "Order placed successfully"
    },
    {
      status: "shipped",
      date: "2026-05-08T14:30:00Z",
      note: "Status updated to shipped"
    }
  ],
  
  created_at: "2026-05-07T...",     // Timestamp
  updated_at: "2026-05-08T..."      // Timestamp
}
```

---

## 🎯 Component Interaction

```
TrackOrderPage                  ProfileOrdersPage              AdminOrders
──────────────────            ─────────────────              ───────────

Search Input                  Order Card                    Order Table
    ↓                             ↓                            ↓
handleTrack()            Click Tracking ID           Click View Button
    ↓                             ↓                            ↓
Try trackOrderById()     navigate(/track-order)     Open Order Modal
    ↓                       (with ?orderId=...)            ↓
Try trackOrder()               ↓                      Shipping Service
    ↓                    TrackOrderPage renders      Dropdown
Display Results          (pre-filled search)         Status Buttons
    ↓                             ↓                            ↓
Show Tracking ID        Show order details          handleStatusUpdate()
Show Service            Show Shipping Svc           Update Order
Show Timeline           Show Status Timeline        ↓
                                                    Refresh Table
```

---

**This architecture ensures:**
✅ Scalability  
✅ Security  
✅ Performance  
✅ User Experience  
✅ Admin Control  
✅ Data Integrity  

---

**Implementation Complete! ✨**
