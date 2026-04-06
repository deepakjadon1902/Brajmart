import mongoose, { Document, Schema } from 'mongoose';

export interface ICartItem {
  productId?: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  quantity: number;
  price: number;
}

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  items: ICartItem[];
}

const cartItemSchema = new Schema<ICartItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  image: String,
  quantity: Number,
  price: Number,
}, { _id: false });

const cartSchema = new Schema<ICart>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: [cartItemSchema], default: [] },
}, { timestamps: true });

export default mongoose.model<ICart>('Cart', cartSchema);
