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
  upiEnabled: boolean;
  cardEnabled: boolean;
  storeLogo: string;
  favicon: string;
  metaTitle: string;
  metaDescription: string;
  heroBadges: string[];
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
        storeName: '',
        tagline: '',
        currency: 'INR',
        freeShippingThreshold: 0,
        shippingFee: 0,
        notifications: { orders: true, users: true, payments: true, stock: false },
        storeEmail: '',
        storePhone: '',
        storeAddress: '',
        socialLinks: { instagram: '', facebook: '', youtube: '', whatsapp: '' },
        announcementBar: { enabled: false, messages: [] },
        maintenanceMode: false,
        taxRate: 0,
        minOrderAmount: 0,
        maxOrderQuantity: 0,
        deliveryEtaMinDays: 0,
        deliveryEtaMaxDays: 0,
        upiEnabled: true,
        cardEnabled: true,
        storeLogo: '',
        favicon: '',
        metaTitle: '',
        metaDescription: '',
        heroBadges: ['??? Temple Authenticated', '?? 100% Organic', '?? Pan-India Delivery'],
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
