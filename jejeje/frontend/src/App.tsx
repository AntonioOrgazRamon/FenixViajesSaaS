import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProfileLayout } from './features/profile/ProfileLayout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthBootstrap } from './providers/AuthBootstrap';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { GuestRoute } from './routes/GuestRoute';
import { RequireRole } from './routes/RequireRole';
import { AppShell } from './components/layout/AppShell';
import { useAuthStore, defaultPathForRole } from './store/authStore';

import { LoginPage } from './features/auth/pages/LoginPage';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { ProfilePage } from './features/profile/pages/ProfilePage';
import { ChangePasswordPage } from './features/profile/pages/ChangePasswordPage';
import { SessionsPage } from './features/sessions/pages/SessionsPage';

import { NotFoundPage } from './features/system/pages/NotFoundPage';
import { ForbiddenPage } from './features/system/pages/ForbiddenPage';
import { SessionExpiredPage } from './features/system/pages/SessionExpiredPage';
import { TenantSuspendedPage } from './features/system/pages/TenantSuspendedPage';
import { UserBlockedPage } from './features/system/pages/UserBlockedPage';

import { SuperAdminDashboardPage } from './features/superadmin/pages/SuperAdminDashboardPage';
import { TenantsListPage } from './features/superadmin/pages/TenantsListPage';
import { TenantNewPage } from './features/superadmin/pages/TenantNewPage';
import { TenantDetailPage } from './features/superadmin/pages/TenantDetailPage';
import { TenantEditPage } from './features/superadmin/pages/TenantEditPage';
import { SuperUsersListPage } from './features/superadmin/pages/SuperUsersListPage';
import { SuperUserDetailPage } from './features/superadmin/pages/SuperUserDetailPage';
import { SuperUserEditPage } from './features/superadmin/pages/SuperUserEditPage';
import { SuperAuditLogsPage } from './features/superadmin/pages/SuperAuditLogsPage';
import { SuperUserSessionsPage } from './features/superadmin/pages/SuperUserSessionsPage';

import { CompanyDashboardPage } from './features/app/pages/CompanyDashboardPage';
import { CompanyUsersListPage } from './features/app/pages/CompanyUsersListPage';
import { CompanyUserNewPage } from './features/app/pages/CompanyUserNewPage';
import { CompanyAdminNewPage } from './features/app/pages/CompanyAdminNewPage';
import { CompanyUserDetailPage } from './features/app/pages/CompanyUserDetailPage';
import { CompanyUserEditPage } from './features/app/pages/CompanyUserEditPage';
import { CompanyAuditLogsPage } from './features/app/pages/CompanyAuditLogsPage';
import { CompanyUserSessionsPage } from './features/app/pages/CompanyUserSessionsPage';
import { AppHomePage } from './features/app/pages/AppHomePage';
import { LeadsListPage } from './features/leads/pages/LeadsListPage';
import { LeadDetailPage } from './features/leads/pages/LeadDetailPage';
import { TravelCatalogPage } from './features/travel/pages/TravelCatalogPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RootRedirect() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (!token) return <Navigate to="/login" replace />;
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-500 dark:bg-[#09090b]">
        <p className="text-sm">Cargando sesión…</p>
      </div>
    );
  }
  return <Navigate to={defaultPathForRole(user.role)} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            </Route>

            <Route path="/session-expired" element={<SessionExpiredPage />} />
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/tenant-suspended" element={<TenantSuspendedPage />} />
            <Route path="/user-blocked" element={<UserBlockedPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/profile" element={<ProfileLayout />}>
                  <Route index element={<ProfilePage />} />
                  <Route path="password" element={<ChangePasswordPage />} />
                  <Route path="sessions" element={<SessionsPage />} />
                </Route>
                <Route path="/change-password" element={<Navigate to="/profile/password" replace />} />
                <Route path="/sessions" element={<Navigate to="/profile/sessions" replace />} />

                <Route element={<RequireRole roles={['SUPER_ADMIN']} />}>
                  <Route path="/superadmin/dashboard" element={<SuperAdminDashboardPage />} />
                  <Route path="/superadmin/tenants" element={<TenantsListPage />} />
                  <Route path="/superadmin/tenants/new" element={<TenantNewPage />} />
                  <Route path="/superadmin/tenants/:id" element={<TenantDetailPage />} />
                  <Route path="/superadmin/tenants/:id/edit" element={<TenantEditPage />} />
                  <Route path="/superadmin/users" element={<SuperUsersListPage />} />
                  <Route path="/superadmin/users/:id" element={<SuperUserDetailPage />} />
                  <Route path="/superadmin/users/:id/edit" element={<SuperUserEditPage />} />
                  <Route path="/superadmin/users/:id/sessions" element={<SuperUserSessionsPage />} />
                  <Route path="/superadmin/audit-logs" element={<SuperAuditLogsPage />} />
                  <Route path="/superadmin/travel" element={<TravelCatalogPage />} />
                </Route>

                <Route element={<RequireRole roles={['COMPANY_ADMIN', 'COMPANY_USER']} />}>
                  <Route path="/leads" element={<LeadsListPage />} />
                  <Route path="/leads/:id" element={<LeadDetailPage />} />
                  <Route path="/app/users" element={<CompanyUsersListPage />} />
                  <Route
                    path="/app/users/new"
                    element={
                      <RequireRole roles={['COMPANY_ADMIN']}>
                        <CompanyUserNewPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/app/admins/new"
                    element={
                      <RequireRole roles={['COMPANY_ADMIN']}>
                        <CompanyAdminNewPage />
                      </RequireRole>
                    }
                  />
                  <Route path="/app/users/:id" element={<CompanyUserDetailPage />} />
                </Route>

                <Route element={<RequireRole roles={['COMPANY_ADMIN']} />}>
                  <Route path="/app/dashboard" element={<CompanyDashboardPage />} />
                  <Route path="/app/travel" element={<TravelCatalogPage />} />
                  <Route path="/app/users/:id/edit" element={<CompanyUserEditPage />} />
                  <Route path="/app/users/:id/sessions" element={<CompanyUserSessionsPage />} />
                  <Route path="/app/audit-logs" element={<CompanyAuditLogsPage />} />
                </Route>

                <Route element={<RequireRole roles={['COMPANY_USER']} />}>
                  <Route path="/app/home" element={<AppHomePage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
