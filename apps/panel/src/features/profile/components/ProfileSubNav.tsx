import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, UserCircle } from 'lucide-react';
import { PROFILE_SECTION_SECURITY_HREF } from '../sections/profileSectionTypes';

const STEPS: Record<string, { tail: string }> = {
  '/profile/password': { tail: 'Contraseña' },
  '/profile/sessions': { tail: 'Dispositivos y sesiones' },
};

/**
 * Cuenta &gt; Seguridad &gt; (Contraseña | Dispositivos).
 * "Seguridad" enlaza a /profile?section=security.
 */
export function ProfileSubNav() {
  const { pathname } = useLocation();
  const key = Object.keys(STEPS).find((k) => pathname === k || pathname.startsWith(k + '/'));
  if (!key) return null;

  const { tail } = STEPS[key]!;

  return (
    <nav className="mb-2 min-w-0 overflow-x-auto" aria-label="Dónde estás">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-tight text-zinc-500 dark:text-zinc-500">
        <li className="flex shrink-0 items-center gap-1">
          <UserCircle className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          <Link
            to="/profile"
            className="font-medium text-amber-800/95 transition hover:underline dark:text-amber-300/95"
          >
            Cuenta
          </Link>
        </li>
        <li className="flex shrink-0 items-center gap-0.5" aria-hidden>
          <ChevronRight className="h-3 w-3 opacity-45" strokeWidth={2.5} />
        </li>
        <li className="shrink-0">
          <Link
            to={PROFILE_SECTION_SECURITY_HREF}
            className="font-medium text-amber-800/95 transition hover:underline dark:text-amber-300/95"
          >
            Seguridad
          </Link>
        </li>
        <li className="flex shrink-0 items-center gap-0.5" aria-hidden>
          <ChevronRight className="h-3 w-3 opacity-45" strokeWidth={2.5} />
        </li>
        <li className="min-w-0 max-w-full break-words font-medium text-zinc-100" aria-current="page">
          {tail}
        </li>
      </ol>
    </nav>
  );
}
