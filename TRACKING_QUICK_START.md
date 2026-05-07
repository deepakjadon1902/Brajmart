# Quick Start Guide - Order Tracking System

## 🚀 Get Started in 5 Minutes

### For Customers

**How to Track Your Order:**

1. Go to **Track Order** page
2. Enter either:
   - Your **6-digit Tracking ID** (e.g., `543821`) 
   - Your **Order ID** (e.g., `10001`)
3. Click **Search**
4. See your order status and which shipping service is delivering it

**Quick Access from My Orders:**
- Go to **My Orders** 
- Click your order's **Tracking ID**
- Automatically opens track page with order details

---

### For Admins

**How to Update Shipping Service:**

1. Go to **Admin** → **Orders Management**
2. Search for the order
3. Click **View** (eye icon)
4. In the modal:
   - Select **Shipping Service** dropdown (DTDC, Shree Maruti, etc.)
   - Select **Order Status** (confirmed, shipped, etc.)
5. Changes saved automatically ✓

**Shipping Services Available:**
- 🚚 DTDC
- 🚛 Shree Maruti  
- 📦 Delhivery
- 🏤 India Post
- 🎁 Ekart

---

## 🔑 Key Features

| Feature | Details |
|---------|---------|
| **Tracking ID** | 6-digit random number (e.g., `543821`) |
| **Uniqueness** | 100% unique per order |
| **Generation** | Automatic when order placed |
| **Search Methods** | By Tracking ID OR Order ID |
| **Shipping Service** | 5 major courier services supported |
| **Admin Control** | Can assign/change service anytime |
| **Customer View** | Shows in order tracking & My Orders |

---

## 📊 Example Scenarios

### Scenario 1: Customer Makes Order
```
Customer places order for ₹5000
↓
Order created with:
  - Order ID: 10001
  - Tracking ID: 543821 (random 6-digit)
  - Status: confirmed
↓
Email sent with tracking ID
Customer receives: "Your Tracking ID: 543821"
```

### Scenario 2: Admin Ships Order
```
Admin views order #10001 in Orders Management
↓
Selects:
  - Shipping Service: "DTDC"
  - Status: "shipped"
↓
Order updated:
  - Tracking ID: 543821 (DTDC)
  - Status: shipped
↓
Customer receives email:
  "Your order has been shipped via DTDC"
  "Track using ID: 543821"
```

### Scenario 3: Customer Tracks Order
```
Customer visits Track Order page
↓
Enters: "543821"
↓
Sees:
  - Order ID: 10001
  - Status: Shipped → Out for Delivery
  - Shipping Service: DTDC
  - Estimated Delivery: May 15, 2026
  - Status Timeline
```

---

## 🔗 API Endpoints (Developer Reference)

### Track by Tracking ID
```
GET /api/orders/track-by-id/543821
```

### Track by Order ID  
```
GET /api/orders/track/10001
```

### Update Shipping Service (Admin Only)
```
PUT /api/orders/10001/status
{
  "status": "shipped",
  "shippingService": "DTDC"
}
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Order not found" | Check tracking ID/order ID spelling |
| Tracking ID not showing | Refresh page, ensure order placed successfully |
| Can't select shipping service | Verify you're logged in as admin |
| Shipping service not saved | Check that service name is exact (case-sensitive) |

---

## 📱 URL Shortcuts

You can create direct tracking links:

```
# Direct to tracking page with order ID
/track-order?orderId=10001

# Direct to tracking page with tracking ID
/track-order?orderId=543821
```

Perfect for email signatures, SMS, etc.

---

## 📞 Support

**Common Questions:**

Q: Can customers track without logging in?
**A:** Yes! They only need the tracking ID.

Q: What if tracking ID is lost?
**A:** They can use their Order ID instead, but must be logged in.

Q: Can shipping service be changed after shipping?
**A:** Yes, admin can update it anytime.

Q: Are tracking IDs recyclable?
**A:** No, each tracking ID is permanently unique to one order.

---

## ✨ What's New?

✅ Unique 6-digit tracking IDs  
✅ Search by tracking ID OR order ID  
✅ 5 shipping service options  
✅ Admin panel integration  
✅ Real-time updates  
✅ Email integration  
✅ Mobile friendly  

---

## 🎯 Quick Checklist

After deployment, verify:

- [ ] Create test order → receives 6-digit tracking ID
- [ ] Search order by tracking ID → finds it
- [ ] Search order by order ID → finds it (backward compatible)
- [ ] Admin assigns shipping service → saves correctly
- [ ] Customer sees shipping service in My Orders → displays correctly
- [ ] Customer clicks tracking ID → goes to track page
- [ ] Track page shows shipping service → displays correctly
- [ ] Status history shows updates → displays all changes

---

## 📚 Documentation

Full documentation available in:
- `TRACKING_SYSTEM_DOCS.md` - Complete technical guide
- `ORDER_TRACKING_IMPLEMENTATION.md` - Implementation details

---

**Ready to track? You're all set! 🎉**
