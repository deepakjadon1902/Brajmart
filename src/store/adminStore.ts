import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminLogin, setAuthToken } from '@/lib/api';

interface AdminStore {
  isAdminAuthenticated: boolean;
  adminEmail: string | null;
  token: string | null;
  adminLogin: (email: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      isAdminAuthenticated: false,
      adminEmail: null,
      token: null,
      adminLogin: async (email, password) => {
        try {
          const res: any = await adminLogin({ email, password });
          setAuthToken(res.token);
          set({ isAdminAuthenticated: true, adminEmail: email, token: res.token });
          return true;
        } catch {
          return false;
        }
      },
      adminLogout: () => {
        setAuthToken('');
        set({ isAdminAuthenticated: false, adminEmail: null, token: null });
      },
    }),
    {
      name: 'brajmart-admin',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.token) {
          setAuthToken(state.token);
          return;
        }
        if (state.isAdminAuthenticated) {
          // Prevent "logged in" state without token
          state.isAdminAuthenticated = false;
          state.adminEmail = null;
        }
      },
    }
  )
);
