import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentStatus extends Document {
  token: string;
  status: 'paid' | 'pending' | 'failed';
  orderId?: number;
  amount?: number;
  method?: string;
  paymentId?: string;
}

const paymentStatusSchema = new Schema<IPaymentStatus>({
  token: { type: String, required: true, unique: true },
  status: { type: String, enum: ['paid', 'pending', 'failed'], required: true },
  orderId: { type: Number },
  amount: { type: Number },
  method: { type: String },
  paymentId: { type: String },
}, { timestamps: true });

export default mongoose.model<IPaymentStatus>('PaymentStatus', paymentStatusSchema);
