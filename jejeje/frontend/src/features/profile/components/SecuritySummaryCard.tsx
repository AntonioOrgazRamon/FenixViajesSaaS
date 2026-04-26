import { Link } from 'react-router-dom';
import { KeyRound, LogOut, Smartphone } from 'lucide-react';
import { ProfileSectionCard } from './ProfileSectionCard';
import { api } from '../../../lib/axios';
import { useAuthStore } from '../../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/cn';

export function SecuritySummaryCard({
  embedded,
  compact,
  inlineLinks,
}: {
  embedded?: boolean;
  compact?: boolean;
  /** Tres acciones en una fila en md+ (más bajo de alto). */
  inlineLinks?: boolean;
}) {
  const logoutStore = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const linkPad = compact ? (inlineLinks ? 'px-2 py-1.5' : 'px-2 py-1') : 'px-3 py-2';
  const icon = cn(inlineLinks && compact ? 'h-3.5 w-3.5' : 'h-4 w-4', 'shrink-0 text-amber-600/90 dark:text-amber-400/90');
  const list = (
    <ul
      className={cn(
        inlineLinks
          ? 'grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-3 sm:gap-2'
          : compact
            ? 'space-y-1 text-[12px]'
            : 'space-y-2 text-[13px]',
      )}
    >
        <li>
          <Link
            to="/profile/password"
            className={cn(
              'group flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/50 transition hover:border-amber-500/30 hover:bg-amber-50/40 dark:border-white/[0.06] dark:bg-zinc-900/20 dark:hover:border-amber-500/25',
              linkPad,
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <KeyRound className={icon} aria-hidden />
              <span className="truncate">Contraseña</span>
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500 group-hover:text-amber-700 dark:group-hover:text-amber-300">→</span>
          </Link>
        </li>
        <li>
          <Link
            to="/profile/sessions"
            className={cn(
              'group flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/50 transition hover:border-amber-500/30 hover:bg-amber-50/40 dark:border-white/[0.06] dark:bg-zinc-900/20 dark:hover:border-amber-500/25',
              linkPad,
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <Smartphone className={icon} aria-hidden />
              <span className="truncate">Dispositivos</span>
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500 group-hover:text-amber-700 dark:group-hover:text-amber-300">→</span>
          </Link>
        </li>
        <li>
          <button
            type="button"
            className={cn(
              'group flex w-full items-center justify-between gap-2 rounded-lg border border-red-200/80 bg-red-50/40 text-left transition hover:border-red-400/40 dark:border-red-500/20 dark:bg-red-500/5 dark:hover:border-red-500/30',
              linkPad,
            )}
            onClick={async () => {
              try {
                await api.post('/auth/logout');
              } catch {
                /* empty */
              }
              logoutStore();
              navigate('/login', { replace: true });
            }}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-red-800 dark:text-red-200">
              <LogOut className={inlineLinks && compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
              <span className="truncate">Cerrar aquí</span>
            </span>
            <span className="shrink-0 text-[10px] text-red-500/80">↵</span>
          </button>
        </li>
      </ul>
  );

  if (embedded) {
    return <div className="min-w-0">{list}</div>;
  }

  return (
    <ProfileSectionCard
      id="security"
      title="Seguridad"
      description="Contraseñas, dispositivos y cierre de sesión. Revisa con qué frecuencia rotas claves y qué dispositivos permanecen activos."
    >
      {list}
    </ProfileSectionCard>
  );
}
