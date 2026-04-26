import { create } from 'zustand';

export type AppRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'COMPANY_USER';

export type UserAvatar = {
  type: 'uploaded' | 'default';
  url: string | null;
  initials: string;
  backgroundColor: string;
  textColor: string;
  shape: 'circle' | 'rounded' | 'square';
};

export type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export type ProfilePreferencesClient = {
  notifyProduct: boolean;
  notifySecurity: boolean;
  notifyBilling: boolean;
  marketingOptIn: boolean;
};

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  companyId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Nombre mostrado en la UI (opcional) */
  displayName?: string | null;
  phone?: string | null;
  locale?: string | null;
  timezone?: string | null;
  timeFormat?: '24h' | '12h' | null;
  dateFormat?: 'dmy' | 'mdy' | 'ymd' | 'locale' | null;
  company?: { id: string; name: string; status: CompanyStatus } | null;
  accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'DELETED';
  lastLoginAt?: string | null;
  createdAt?: string;
  /** Compat: misma URL pública que `avatar.url` si la foto es subida */
  avatar_url?: string | null;
  avatar?: UserAvatar | null;
  language?: 'es' | 'en';
  theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  has_google_linked?: boolean;
  auth_provider?: string;
  /** ISO; último cambio de contraseña (auditoría). */
  lastPasswordChangeAt?: string | null;
  /** Preferencias persistidas (notificaciones, etc.). */
  profilePreferences?: ProfilePreferencesClient;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken?: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('token'),
  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    set({
      user,
      token: accessToken,
      refreshToken: refreshToken ?? null,
      isAuthenticated: true,
    });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
  },
}));

export function defaultPathForRole(role: AppRole): string {
  if (role === 'SUPER_ADMIN') return '/superadmin/dashboard';
  if (role === 'COMPANY_ADMIN') return '/app/dashboard';
  return '/app/home';
}
