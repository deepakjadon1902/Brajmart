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
  authProvider?: 'email' | 'google';
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: { fullName: string; email: string; password: string; mobile?: string }) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: async (email, _password) => {
        const user: User = {
          id: crypto.randomUUID(),
          fullName: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          email,
          authProvider: 'email',
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
          authProvider: 'email',
        };
        set({ user, isAuthenticated: true });
        return true;
      },
      loginWithGoogle: async () => {
        // Mock Google OAuth — will connect to real provider when DB is connected
        const mockGoogleUser: User = {
          id: crypto.randomUUID(),
          fullName: 'Krishna Devotee',
          email: 'devotee@gmail.com',
          avatar: 'https://ui-avatars.com/api/?name=Krishna+Devotee&background=f59e0b&color=fff',
          authProvider: 'google',
        };
        set({ user: mockGoogleUser, isAuthenticated: true });
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
