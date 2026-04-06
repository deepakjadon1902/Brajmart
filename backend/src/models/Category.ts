import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  icon: string;
  color: string;
  productCount: number;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true },
  icon: { type: String, required: true },
  color: { type: String, default: '#f59e0b' },
  productCount: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model<ICategory>('Category', categorySchema);
