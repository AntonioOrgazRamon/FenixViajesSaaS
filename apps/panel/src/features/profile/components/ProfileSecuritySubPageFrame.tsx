import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { PROFILE_SECTION_SECURITY_HREF } from '../sections/profileSectionTypes';
import { cn } from '../../../lib/cn';

type Props = {
  title: string;
  /** Si se omite, no se muestra el párrafo bajo el título. */
  description?: string;
  /** Contenido encima del título a la derecha (p. ej. acción) */
  headerAction?: ReactNode;
  maxWidthClass?: string;
  children: ReactNode;
  /** Clase extra en el contenedor del card principal */
  cardClassName?: string;
};

/**
 * Marca común para subpáginas bajo Cuenta → Seguridad (contraseña, dispositivos).
 * Navegación hacia atrás discreta; cabecera con título y descripción.
 */
export function ProfileSecuritySubPageFrame({
  title,
  description,
  headerAction,
  maxWidthClass = 'max-w-xl',
  children,
  cardClassName,
}: Props) {
  return (
    <div className={cn('w-full min-w-0', maxWidthClass)}>
      <Link
        to={PROFILE_SECTION_SECURITY_HREF}
        className="group mb-4 inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition hover:text-amber-700 dark:text-zinc-400 dark:hover:text-amber-300"
      >
        <ChevronLeft
          className="h-4 w-4 shrink-0 transition group-hover:-translate-x-0.5"
          strokeWidth={2}
          aria-hidden
        />
        <span>Seguridad</span>
      </Link>

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/40 shadow-sm dark:border-white/[0.08] dark:bg-zinc-950/40',
          'ring-1 ring-black/5 dark:ring-white/5',
          cardClassName,
        )}
      >
        <div className="border-b border-zinc-200/70 bg-gradient-to-br from-white/90 to-amber-50/30 px-4 py-4 dark:from-zinc-900/90 dark:to-amber-950/20 dark:border-white/[0.06] sm:px-5 sm:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <h1
                className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white"
                style={{ fontFamily: '"Syne", system-ui, sans-serif' }}
              >
                {title}
              </h1>
              {description ? (
                <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              ) : null}
            </div>
            {headerAction ? <div className="shrink-0 sm:pt-0.5">{headerAction}</div> : null}
          </div>
        </div>
        <div className="bg-white/50 px-4 py-5 dark:bg-zinc-950/25 sm:px-5 sm:py-6">{children}</div>
      </div>
    </div>
  );
}
