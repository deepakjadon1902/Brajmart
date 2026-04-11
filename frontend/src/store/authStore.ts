import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchMe, loginUser, registerUser, resendOtp, setAuthToken, startGoogleAuth, updateMyProfile, verifyOtp } from '@/lib/api';

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

const pickDefaultAddress = (addresses: any[]) => {
  if (!Array.isArray(addresses) || !addresses.length) return null;
  return addresses.find((a) => a?.isDefault) || addresses[0];
};

const mapUserFromApi = (res: any, fallback?: Partial<User>): User => {
  const addr = pickDefaultAddress(res?.addresses);
  return {
    id: res?._id || res?.id || fallback?.id || '',
    fullName: res?.name || fallback?.fullName || '',
    email: res?.email || fallback?.email || '',
    mobile: addr?.mobile || res?.phone || fallback?.mobile || '',
    address: addr?.street || fallback?.address || '',
    city: addr?.city || fallback?.city || '',
    state: addr?.state || fallback?.state || '',
    pincode: addr?.pincode || fallback?.pincode || '',
    avatar: res?.avatar || fallback?.avatar || '',
    authProvider: fallback?.authProvider || (res?.googleId ? 'google' : 'email'),
  };
};

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  register: (data: { fullName: string; email: string; password: string; mobile?: string }) => Promise<{ ok: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  verifyOtp: (payload: { email: string; otp: string }) => Promise<{ ok: boolean; message?: string }>;
  resendOtp: (payload: { email: string }) => Promise<{ ok: boolean; message?: string }>;
  completeOAuthLogin: (token: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<{ ok: boolean; message?: string }>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
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
          return { ok: true, message: res?.message || 'Verification code sent' };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Registration failed' };
        }
      },
      loginWithGoogle: async () => {
        try {
          startGoogleAuth();
          return { ok: true, message: 'Redirecting to Google...' };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Google login failed' };
        }
      },
      verifyOtp: async (payload) => {
        try {
          const res: any = await verifyOtp(payload);
          if (res?.token && res?.user) {
            setAuthToken(res.token);
            const user: User = {
              id: res.user.id,
              fullName: res.user.name,
              email: res.user.email,
              authProvider: 'email',
            };
            set({ user, isAuthenticated: true, token: res.token });
          }
          return { ok: true, message: res?.message || 'Email verified successfully' };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Verification failed' };
        }
      },
      resendOtp: async (payload) => {
        try {
          const res: any = await resendOtp(payload);
          return { ok: true, message: res?.message || 'Verification code sent' };
        } catch (err: any) {
          return { ok: false, message: err?.message || 'Unable to resend code' };
        }
      },
      completeOAuthLogin: async (token) => {
        try {
          setAuthToken(token);
          const res: any = await fetchMe();
          const user: User = mapUserFromApi(res, { authProvider: res?.googleId ? 'google' : 'email' });
          set({ user, isAuthenticated: true, token });
          return { ok: true };
        } catch (err: any) {
          setAuthToken('');
          return { ok: false, message: err?.message || 'OAuth login failed' };
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
          const currentProvider = get().user?.authProvider;
          const user: User = mapUserFromApi(res, {
            id: res?._id || res?.id || '',
            fullName: data.fullName || '',
            email: data.email || '',
            mobile: data.mobile || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            pincode: data.pincode || '',
            authProvider: currentProvider || 'email',
          });
          set({ user });
          if (res?.emailConflict) {
            return { ok: true, message: 'Profile updated, but this email is already in use. We kept your current email.' };
          }
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
