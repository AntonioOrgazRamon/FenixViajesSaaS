import { useEffect } from 'react';
import { api } from '../lib/axios';
import { unwrap } from '../lib/api';
import { useAuthStore, type AuthUser } from '../store/authStore';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const setBootstrapping = useAuthStore((s) => s.setBootstrapping);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!token) {
      setBootstrapping(false);
      return;
    }
    setBootstrapping(true);
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
        if (!cancelled) setUser(unwrap(data));
      } catch {
        if (!cancelled) logout();
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, setUser, setBootstrapping, logout]);

  return <>{children}</>;
}
