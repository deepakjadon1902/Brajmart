import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoreSettings {
  storeName: string;
  tagline: string;
  currency: string;
  freeShippingThreshold: number;
  shippingFee: number;
  notifications: { orders: boolean; users: boolean; payments: boolean; stock: boolean };
}

interface SettingsStore {
  settings: StoreSettings;
  updateSettings: (partial: Partial<StoreSettings>) => void;
  updateNotifications: (key: string, value: boolean) => void;
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
    }),
    { name: 'brajmart-settings' }
  )
);
