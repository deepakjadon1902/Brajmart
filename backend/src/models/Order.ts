import mongoose, { Document, Schema } from 'mongoose';
import Counter from './Counter';

export interface IOrderItem {
  productId?: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  quantity: number;
  price: number;
}

export interface IAddress {
  fullName: string;
  mobile: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export interface IOrder extends Document {
  orderId: number;
  userId?: mongoose.Types.ObjectId;
  items: IOrderItem[];
  total: number;
  status: 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  customerName?: string;
  customerEmail?: string;
  shippingAddress: IAddress;
  billingAddress: IAddress;
  paymentMethod: string;
  trackingId?: string;
  estimatedDelivery?: Date;
  statusHistory: Array<{ status: string; date: Date; note: string }>;
}

const addressSchema = new Schema<IAddress>({
  fullName: String,
  mobile: String,
  street: String,
  city: String,
  state: String,
  pincode: String,
}, { _id: false });

const orderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  image: String,
  quantity: Number,
  price: Number,
}, { _id: false });

const statusHistorySchema = new Schema({
  status: String,
  date: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

const orderSchema = new Schema<IOrder>({
  orderId: { type: Number, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'confirmed',
  },
  customerName: { type: String },
  customerEmail: { type: String },
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  paymentMethod: { type: String, required: true },
  trackingId: String,
  estimatedDelivery: Date,
  statusHistory: [statusHistorySchema],
}, { timestamps: true });

orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      'orderId',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderId = counter.seq;
    this.trackingId = `BM${this.orderId}`;
    if (!this.estimatedDelivery) {
      this.estimatedDelivery = new Date(Date.now() + 5 * 86400000);
    }
    if (!this.statusHistory || this.statusHistory.length === 0) {
      this.statusHistory = [{ status: this.status, date: new Date(), note: 'Order placed successfully' }];
    }
  }
  next();
});

export default mongoose.model<IOrder>('Order', orderSchema);
