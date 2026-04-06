import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  orderId: number;
  customerName: string;
  customerEmail: string;
  method: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  transactionId: string;
}

const paymentSchema = new Schema<IPayment>({
  orderId: { type: Number, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  method: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['paid', 'pending', 'failed', 'refunded'], default: 'pending' },
  transactionId: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<IPayment>('Payment', paymentSchema);
