import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  reviewCount: number;
  badge?: 'new' | 'bestseller' | 'combo' | 'exclusive' | null;
  tags?: string[];
  inStock: boolean;
  soldCount: number;
  description: string;
}

const productSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  image: { type: String, required: true },
  category: { type: String, required: true },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  badge: { type: String, enum: ['new', 'bestseller', 'combo', 'exclusive', null], default: null },
  tags: { type: [String], default: [] },
  inStock: { type: Boolean, default: true },
  soldCount: { type: Number, default: 0 },
  description: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model<IProduct>('Product', productSchema);
