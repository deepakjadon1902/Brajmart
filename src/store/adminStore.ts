import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminStore {
  isAdminAuthenticated: boolean;
  adminEmail: string | null;
  adminLogin: (email: string, password: string) => boolean;
  adminLogout: () => void;
}

const ADMIN_CREDENTIALS = {
  email: 'deepakjadon1907@gmail.com',
  password: 'deepakjadon1907@',
};

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      isAdminAuthenticated: false,
      adminEmail: null,
      adminLogin: (email, password) => {
        if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
          set({ isAdminAuthenticated: true, adminEmail: email });
          return true;
        }
        return false;
      },
      adminLogout: () => set({ isAdminAuthenticated: false, adminEmail: null }),
    }),
    { name: 'brajmart-admin' }
  )
);
