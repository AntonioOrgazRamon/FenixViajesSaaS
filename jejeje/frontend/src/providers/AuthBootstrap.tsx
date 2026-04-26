import { useEffect } from 'react';
import { api } from '../lib/axios';
import { unwrap } from '../lib/api';
import { useAuthStore, type AuthUser } from '../store/authStore';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
        if (!cancelled) setUser(unwrap(data));
      } catch {
        if (!cancelled) logout();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setUser, logout]);

  return <>{children}</>;
}
