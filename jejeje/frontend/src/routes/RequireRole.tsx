import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type AppRole } from '../store/authStore';

export function RequireRole({ roles }: { roles: AppRole[] }) {
  const user = useAuthStore((s) => s.user);

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
