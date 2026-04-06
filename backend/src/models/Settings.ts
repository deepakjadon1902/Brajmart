import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  storeName: string;
  tagline: string;
  currency: string;
  freeShippingThreshold: number;
  shippingFee: number;
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  taxRate: number;
  minOrderAmount: number;
  maxOrderQuantity: number;
  deliveryEtaMinDays: number;
  deliveryEtaMaxDays: number;
  codEnabled: boolean;
  upiEnabled: boolean;
  cardEnabled: boolean;
  maintenanceMode: boolean;
  metaTitle: string;
  metaDescription: string;
  storeLogo: string;
  favicon?: string;
  upiId?: string;
  upiPayeeName?: string;
  socialLinks: {
    instagram: string;
    facebook: string;
    youtube: string;
    whatsapp: string;
  };
  announcementBar: {
    enabled: boolean;
    messages: string[];
  };
  notifications: {
    orders: boolean;
    users: boolean;
    payments: boolean;
    stock: boolean;
  };
}

const settingsSchema = new Schema<ISettings>({
  storeName: { type: String, default: 'BrajMart' },
  tagline: { type: String, default: 'From Braj, With Love' },
  currency: { type: String, default: 'INR' },
  freeShippingThreshold: { type: Number, default: 499 },
  shippingFee: { type: Number, default: 49 },
  storeEmail: { type: String, default: 'support@brajmart.com' },
  storePhone: { type: String, default: '+91 9876543210' },
  storeAddress: { type: String, default: 'Vrindavan, Mathura, UP 281121, India' },
  taxRate: { type: Number, default: 0 },
  minOrderAmount: { type: Number, default: 0 },
  maxOrderQuantity: { type: Number, default: 10 },
  deliveryEtaMinDays: { type: Number, default: 3 },
  deliveryEtaMaxDays: { type: Number, default: 7 },
  codEnabled: { type: Boolean, default: true },
  upiEnabled: { type: Boolean, default: true },
  cardEnabled: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  metaTitle: { type: String, default: 'BrajMart - Authentic Vrindavan Products' },
  metaDescription: { type: String, default: '' },
  storeLogo: { type: String, default: '' },
  favicon: { type: String, default: '' },
  upiId: { type: String, default: '' },
  upiPayeeName: { type: String, default: 'BrajMart' },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    youtube: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
  },
  announcementBar: {
    enabled: { type: Boolean, default: true },
    messages: [{ type: String }],
  },
  notifications: {
    orders: { type: Boolean, default: true },
    users: { type: Boolean, default: true },
    payments: { type: Boolean, default: true },
    stock: { type: Boolean, default: false },
  },
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', settingsSchema);
