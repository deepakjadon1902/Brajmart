import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SocialLinks {
  instagram: string;
  facebook: string;
  youtube: string;
  whatsapp: string;
}

interface AnnouncementBar {
  enabled: boolean;
  messages: string[];
}

interface StoreSettings {
  storeName: string;
  tagline: string;
  currency: string;
  freeShippingThreshold: number;
  shippingFee: number;
  notifications: { orders: boolean; users: boolean; payments: boolean; stock: boolean };
  // New fields
  storeEmail: string;
  storePhone: string;
  storeAddress: string;
  socialLinks: SocialLinks;
  announcementBar: AnnouncementBar;
  maintenanceMode: boolean;
  taxRate: number;
  minOrderAmount: number;
  maxOrderQuantity: number;
  deliveryEtaMinDays: number;
  deliveryEtaMaxDays: number;
  codEnabled: boolean;
  upiEnabled: boolean;
  cardEnabled: boolean;
  storeLogo: string;
  favicon: string;
  metaTitle: string;
  metaDescription: string;
}

interface SettingsStore {
  settings: StoreSettings;
  updateSettings: (partial: Partial<StoreSettings>) => void;
  updateNotifications: (key: string, value: boolean) => void;
  updateSocialLinks: (key: string, value: string) => void;
  updateAnnouncementMessages: (messages: string[]) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: {
        storeName: 'BrajMart',
        tagline: 'From Braj, With Love 🙏',
        currency: 'INR',
        freeShippingThreshold: 499,
        shippingFee: 49,
        notifications: { orders: true, users: true, payments: true, stock: false },
        storeEmail: 'support@brajmart.com',
        storePhone: '+91 9876543210',
        storeAddress: 'Vrindavan, Mathura, Uttar Pradesh 281121, India',
        socialLinks: { instagram: '', facebook: '', youtube: '', whatsapp: '' },
        announcementBar: {
          enabled: true,
          messages: [
            '🎉 Grand Opening Sale — Up to 60% Off!',
            '🚚 Free Shipping on orders above ₹499',
            '🙏 Authentic Products Direct from Vrindavan Temples',
          ],
        },
        maintenanceMode: false,
        taxRate: 0,
        minOrderAmount: 0,
        maxOrderQuantity: 10,
        deliveryEtaMinDays: 3,
        deliveryEtaMaxDays: 7,
        codEnabled: true,
        upiEnabled: true,
        cardEnabled: true,
        storeLogo: '',
        favicon: '',
        metaTitle: 'BrajMart — Authentic Vrindavan Products',
        metaDescription: 'Shop authentic devotional products, prasadam, books, and more from the sacred land of Vrindavan.',
      },
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      updateNotifications: (key, value) =>
        set((s) => ({
          settings: {
            ...s.settings,
            notifications: { ...s.settings.notifications, [key]: value },
          },
        })),
      updateSocialLinks: (key, value) =>
        set((s) => ({
          settings: {
            ...s.settings,
            socialLinks: { ...s.settings.socialLinks, [key]: value },
          },
        })),
      updateAnnouncementMessages: (messages) =>
        set((s) => ({
          settings: {
            ...s.settings,
            announcementBar: { ...s.settings.announcementBar, messages },
          },
        })),
    }),
    { name: 'brajmart-settings' }
  )
);
