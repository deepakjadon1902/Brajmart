import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  avatar?: string;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { fullName: string; email: string; password: string; mobile?: string }) => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, _password) => {
        // Mock login — accepts any valid email
        const user: User = {
          id: crypto.randomUUID(),
          fullName: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          email,
        };
        set({ user, isAuthenticated: true });
        return true;
      },
      register: async (data) => {
        const user: User = {
          id: crypto.randomUUID(),
          fullName: data.fullName,
          email: data.email,
          mobile: data.mobile,
        };
        set({ user, isAuthenticated: true });
        return true;
      },
      logout: () => set({ user: null, isAuthenticated: false }),
      updateProfile: (data) => set((state) => ({
        user: state.user ? { ...state.user, ...data } : null,
      })),
    }),
    { name: 'brajmart-auth' }
  )
);
