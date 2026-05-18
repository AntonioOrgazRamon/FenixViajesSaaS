import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, type AppRole } from '../store/authStore';

export function RequireRole({ roles, children }: { roles: AppRole[]; children?: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-500 dark:bg-[#09090b]">
        <p className="text-sm">Cargando sesión…</p>
      </div>
    );
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  if (children != null) {
    return <>{children}</>;
  }

  return <Outlet />;
}
