import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Building2,
  ClipboardList,
  FlaskConical,
  Files,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Search,
  Shield,
  Sparkles,
  Target,
  Upload,
  UserCircle,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { api } from '../../lib/axios';
import { useAuthStore, type AppRole } from '../../store/authStore';
import { UserAvatarView } from '../../lib/userAvatarView';
import { SidebarThemeToggle } from './SidebarThemeToggle';
import { CommandPalette } from './CommandPalette';

function roleLabel(role: AppRole | undefined): string {
  if (role === 'SUPER_ADMIN') return 'Super admin';
  if (role === 'COMPANY_ADMIN') return 'Admin empresa';
  return 'Usuario';
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
    isActive
      ? 'bg-cyan-500/[0.12] text-cyan-950 shadow-sm dark:bg-cyan-500/[0.14] dark:text-cyan-50 dark:shadow-none'
      : 'text-zinc-600 hover:bg-zinc-100/90 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100',
  );

const subNavClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors',
    isActive
      ? 'bg-zinc-200/90 text-zinc-900 dark:bg-white/[0.08] dark:text-zinc-100'
      : 'text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-800 dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-zinc-300',
  );

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };
type NavSection = { title: string; items: NavItem[] };

const superNavSections: NavSection[] = [
  {
    title: 'Operaciones',
    items: [
      { to: '/superadmin/dashboard', label: 'Inicio', icon: LayoutDashboard },
      { to: '/superadmin/tenants', label: 'Empresas', icon: Building2 },
      { to: '/superadmin/users', label: 'Usuarios', icon: Users },
    ],
  },
  {
    title: 'Catálogo y contenidos',
    items: [
      { to: '/travel/library', label: 'Biblioteca de viajes', icon: BookOpen },
      { to: '/proposals/library', label: 'Biblioteca de propuestas', icon: Files },
      { to: '/superadmin/travel', label: 'Importación PDF (catálogo)', icon: FileText },
      { to: '/travel/import', label: 'Importación JSON (viajes)', icon: Upload },
    ],
  },
  {
    title: 'Inteligencia',
    items: [{ to: '/travel/recommendation-playground', label: 'Laboratorio de recomendación', icon: FlaskConical }],
  },
  {
    title: 'Administración',
    items: [{ to: '/superadmin/audit-logs', label: 'Auditoría', icon: ClipboardList }],
  },
];

const adminNavSections: NavSection[] = [
  {
    title: 'Ventas y CRM',
    items: [
      { to: '/app/dashboard', label: 'Inicio', icon: LayoutDashboard },
      { to: '/leads', label: 'Leads', icon: Target },
    ],
  },
  {
    title: 'Catálogo y contenidos',
    items: [
      { to: '/travel/library', label: 'Biblioteca de viajes', icon: BookOpen },
      { to: '/proposals/library', label: 'Biblioteca de propuestas', icon: Files },
      { to: '/app/travel', label: 'Importación PDF (catálogo)', icon: FileText },
      { to: '/travel/import', label: 'Importación JSON (viajes)', icon: Upload },
    ],
  },
  {
    title: 'Inteligencia',
    items: [
      { to: '/app/motor', label: 'Motor de recomendación', icon: Radar },
      { to: '/app/ia', label: 'IA y costes', icon: Activity },
    ],
  },
  {
    title: 'Equipo y seguridad',
    items: [
      { to: '/app/users', label: 'Usuarios', icon: Users },
      { to: '/app/users/new', label: 'Nuevo usuario', icon: UserPlus },
      { to: '/app/admins/new', label: 'Nuevo administrador', icon: Shield },
      { to: '/app/audit-logs', label: 'Auditoría', icon: ClipboardList },
    ],
  },
];

const companyUserNavSections: NavSection[] = [
  {
    title: 'Ventas',
    items: [
      { to: '/app/home', label: 'Inicio', icon: Home },
      { to: '/leads', label: 'Leads', icon: Target },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/travel/library', label: 'Biblioteca de viajes', icon: BookOpen },
      { to: '/proposals/library', label: 'Biblioteca de propuestas', icon: Files },
    ],
  },
  {
    title: 'Inteligencia',
    items: [{ to: '/app/motor', label: 'Motor de recomendación', icon: Radar }],
  },
  {
    title: 'Equipo',
    items: [{ to: '/app/users', label: 'Equipo', icon: Users }],
  },
];

function navSectionsForRole(r: AppRole | undefined): NavSection[] {
  if (r === 'SUPER_ADMIN') return superNavSections;
  if (r === 'COMPANY_ADMIN') return adminNavSections;
  return companyUserNavSections;
}

const shellAside =
  'flex w-[15.5rem] shrink-0 flex-col border-r backdrop-blur-xl ' +
  'border-zinc-200/90 bg-white/95 ' +
  'dark:border-zinc-800/90 dark:bg-[#0c0d10]/[0.98]';

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logoutStore = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    // If we render directly on desktop with stale state, unlock immediately.
    if (media.matches) setMobileOpen(false);

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logoutStore();
    navigate('/login', { replace: true });
  };

  const profileSubLinks: {
    to: string;
    label: string;
    end?: boolean;
    icon: typeof UserCircle;
  }[] = [
    { to: '/profile', label: 'Cuenta', end: true, icon: UserCircle },
  ];

  const navSections = navSectionsForRole(role);
  const endMatch = (to: string) =>
    to === '/app/users' ||
    to === '/superadmin/users' ||
    to === '/app/travel' ||
    to === '/superadmin/travel' ||
    to === '/travel/import' ||
    to === '/travel/recommendation-playground' ||
    to === '/travel/library' ||
    to === '/proposals/library';

  const NavBlock = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              {section.title}
            </p>
            <nav className="flex flex-col gap-0.5" aria-label={section.title}>
              {section.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={endMatch(to)}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      navLinkClass({ isActive }),
                      '[&>svg]:opacity-70 [&[aria-current=page]>svg]:text-cyan-600 dark:[&[aria-current=page]>svg]:text-cyan-300',
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </div>

      <div className="my-5 h-px bg-zinc-200/90 dark:bg-white/[0.06]" aria-hidden />

      <div>
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          Cuenta
        </p>
        <nav className="flex flex-col gap-0.5">
          {profileSubLinks.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) => cn(subNavClass({ isActive }), '[&>svg]:opacity-65')}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );

  const brandTitle = 'truncate text-[15px] font-bold tracking-tight text-zinc-900 dark:text-white';
  const brandSub = 'text-[11px] text-zinc-500 dark:text-zinc-500';

  return (
    <div className="flex h-svh max-h-svh min-h-0 flex-col overflow-hidden bg-zinc-50 text-zinc-900 antialiased dark:bg-[#0b0c0f] dark:text-zinc-100">
      <CommandPalette role={role} />
      <div className="flex min-h-0 flex-1">
        <aside className={cn('relative hidden h-full min-h-0 lg:flex', shellAside)}>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent dark:via-cyan-500/15"
            aria-hidden
          />

          <div className="border-b border-zinc-200/90 px-4 pb-4 pt-5 dark:border-white/[0.06]">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200/90 bg-zinc-50 text-[11px] font-bold text-cyan-700 shadow-sm dark:border-white/10 dark:bg-zinc-900/90 dark:text-cyan-300/95"
                style={{ fontFamily: 'var(--font-mono)' }}
                aria-hidden
              >
                {'</>'}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={brandTitle} style={{ fontFamily: 'var(--font-display)' }}>
                  jejeje
                </p>
                <p className={brandSub}>Copiloto comercial</p>
              </div>
            </div>

            <div
              className={cn(
                'mt-4 flex items-center gap-3 rounded-2xl border p-3',
                'border-zinc-200/90 bg-zinc-50/90 shadow-sm',
                'dark:border-white/[0.07] dark:bg-black/20 dark:shadow-none',
              )}
            >
              {user ? <UserAvatarView user={user} size="md" className="border border-zinc-200/80 dark:border-white/10" /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium leading-snug text-zinc-800 dark:text-zinc-200">{user?.email}</p>
                <span
                  className={cn(
                    'mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    'border-zinc-200/90 bg-white text-zinc-600',
                    'dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-400',
                  )}
                >
                  {roleLabel(role)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-3 pt-1">
            <NavBlock />
          </div>

          <div className="space-y-3 border-t border-zinc-200/90 p-4 dark:border-white/[0.06] dark:bg-black/10">
            <SidebarThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                'text-zinc-600 hover:bg-red-50 hover:text-red-700',
                'dark:text-zinc-400 dark:hover:bg-red-500/[0.12] dark:hover:text-red-300',
              )}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-85" />
              Cerrar sesión
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header
            className={cn(
              'sticky top-0 z-30 hidden items-center justify-between gap-4 border-b px-4 py-2.5 backdrop-blur-xl lg:flex',
              'border-zinc-200/80 bg-white/90 dark:border-white/[0.06] dark:bg-[#0b0c10]/85',
            )}
          >
            <button
              type="button"
              onClick={() => (window as unknown as { __openCommandPalette?: () => void }).__openCommandPalette?.()}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                'border-zinc-200/90 bg-zinc-50/80 text-zinc-500 hover:border-cyan-500/25 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-zinc-500 dark:hover:bg-white/[0.05]',
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 truncate">Buscar o navegar…</span>
              <kbd className="hidden shrink-0 rounded border border-zinc-200/80 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-white/10 dark:bg-black/30 dark:text-zinc-600 sm:inline">
                ⌘K
              </kbd>
            </button>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-600">
              <Sparkles className="h-3.5 w-3.5 text-cyan-500/80" strokeWidth={1.75} />
              <span className="hidden xl:inline">IA en contexto</span>
            </div>
          </header>

          <header
            className={cn(
              'sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-md lg:hidden',
              'border-zinc-200/90 bg-white/90',
              'dark:border-white/[0.06] dark:bg-zinc-950/90',
            )}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn(
                'flex h-11 min-h-[44px] w-11 min-w-[44px] cursor-pointer items-center justify-center rounded-xl border text-zinc-700',
                'border-zinc-200/90 bg-white hover:bg-zinc-50',
                'dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-white/5',
              )}
              aria-expanded={mobileOpen}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-bold text-zinc-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
                jejeje
              </p>
              <p className="truncate text-[10px] text-zinc-500">{roleLabel(role)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="min-h-11 min-w-[3rem] cursor-pointer rounded-xl px-3 py-2.5 text-sm font-medium text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-400/95"
            >
              Salir
            </button>
          </header>

          <div
            className={cn('fixed inset-0 z-40 lg:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')}
            aria-hidden={!mobileOpen}
          >
            <button
              type="button"
              className={cn(
                'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 dark:bg-black/60',
                mobileOpen ? 'opacity-100' : 'opacity-0',
              )}
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            />
            <div
              className={cn(
                'absolute left-0 top-0 flex h-full w-[min(90vw,18rem)] flex-col border-r shadow-2xl transition-transform duration-300 ease-out',
                shellAside,
                mobileOpen ? 'translate-x-0' : '-translate-x-full',
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200/90 px-4 py-4 dark:border-white/[0.06]">
                <div className="flex min-w-0 items-center gap-2">
                  {user ? <UserAvatarView user={user} size="sm" className="border border-zinc-200/80 dark:border-white/10" /> : null}
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-bold text-zinc-900 dark:text-white" style={{ fontFamily: 'var(--font-display)' }}>
                      Menú
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">{user?.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                <NavBlock onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="space-y-3 border-t border-zinc-200/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-white/[0.06]">
                <SidebarThemeToggle />
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>

          <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_50%_at_50%_-15%,rgba(34,211,238,0.06),transparent)] opacity-90 dark:opacity-100"
              aria-hidden
            />
            <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-4 lg:px-4 lg:py-5">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
