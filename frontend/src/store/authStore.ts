import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { googleLogin, loginUser, registerUser, setAuthToken, updateMyProfile } from '@/lib/api';

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
  token: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (data: { fullName: string; email: string; password: string; mobile?: string }) => Promise<{ ok: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<{ ok: boolean; message?: string }>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      login: async (email, _password) => {
        try {
          const res: any = await loginUser({ email, password: _password });
          setAuthToken(res.token);
          const user: User = {
            id: res.user.id,
            fullName: res.user.name,
            email: res.user.email,
            authProvider: 'email',
          };
          set({ user, isAuthenticated: true, token: res.token });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Login failed' };
        }
      },
      register: async (data) => {
        try {
          const res: any = await registerUser({ name: data.fullName, email: data.email, password: data.password });
          if (res?.token) {
            setAuthToken(res.token);
            const user: User = {
              id: res.user.id,
              fullName: res.user.name,
              email: res.user.email,
              mobile: data.mobile,
              authProvider: 'email',
            };
            set({ user, isAuthenticated: true, token: res.token });
            return { ok: true };
          }
          return { ok: true, message: res?.message || 'Verification email sent' };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Registration failed' };
        }
      },
      loginWithGoogle: async () => {
        try {
          const mockGooglePayload = {
            name: 'Krishna Devotee',
            email: 'devotee@gmail.com',
            googleId: crypto.randomUUID(),
            avatar: 'https://ui-avatars.com/api/?name=Krishna+Devotee&background=f59e0b&color=fff',
          };
          const res: any = await googleLogin(mockGooglePayload);
          setAuthToken(res.token);
          const user: User = {
            id: res.user.id,
            fullName: res.user.name,
            email: res.user.email,
            avatar: mockGooglePayload.avatar,
            authProvider: 'google',
          };
          set({ user, isAuthenticated: true, token: res.token });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Google login failed' };
        }
      },
      logout: () => {
        setAuthToken('');
        set({ user: null, isAuthenticated: false, token: null });
      },
      updateProfile: async (data) => {
        try {
          const res: any = await updateMyProfile({
            fullName: data.fullName || '',
            email: data.email || '',
            mobile: data.mobile || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
          });
          const user: User = {
            id: res._id || res.id,
            fullName: res.name || data.fullName || '',
            email: res.email || data.email || '',
            mobile: res.phone || data.mobile || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            authProvider: 'email',
          };
          set({ user });
          return { ok: true };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Profile update failed' };
        }
      },
    }),
    {
      name: 'brajmart-auth',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.token) {
          setAuthToken(state.token);
          return;
        }
        if (state.isAuthenticated) {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
        }
      },
    }
  )
);
