import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type AppRole } from '../store/authStore';

export function RequireRole({ roles, children }: { roles: AppRole[]; children?: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  if (children != null) {
    return <>{children}</>;
  }

  return <Outlet />;
}
