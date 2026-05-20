import { cn } from './cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  /** CTA ámbar (p. ej. generar propuesta) */
  | 'accent'
  /** Borde ámbar sobre fondo oscuro */
  | 'amberOutline'
  /** Éxito suave (p. ej. vendedor avisado) */
  | 'successSoft'
  /** Botón sobre tarjetas oscuras con borde blanco tenue */
  | 'panelGhost'
  /** Destacado violeta (notificar, enviar) */
  | 'violet'
  /** CTA verde (aprobar, confirmar catálogo) */
  | 'emerald';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'touch';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold transition-[filter,box-shadow,background-color,border-color] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500/55 ' +
  'disabled:pointer-events-none disabled:opacity-45';

const variants: Record<ButtonVariant, string> = {
  primary:
    'rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-600 text-white shadow-md shadow-cyan-900/20 hover:brightness-105 active:brightness-95',
  secondary:
    'rounded-xl border border-zinc-200/90 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.08]',
  ghost:
    'rounded-xl border border-transparent text-zinc-700 hover:bg-zinc-100/90 dark:text-zinc-300 dark:hover:bg-white/[0.06]',
  danger:
    'rounded-xl border border-red-300/80 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/15',
  accent:
    'rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-zinc-950 shadow-md shadow-amber-900/20 hover:brightness-105 active:brightness-95',
  amberOutline:
    'rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15 dark:text-amber-50',
  successSoft:
    'rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15 dark:text-emerald-50',
  panelGhost:
    'rounded-xl border border-white/12 bg-transparent text-zinc-200 hover:bg-white/5 dark:text-zinc-200',
  violet:
    'rounded-xl border border-violet-400/35 bg-violet-600 text-white shadow-sm hover:bg-violet-500 active:brightness-95 dark:bg-violet-600 dark:hover:bg-violet-500',
  emerald:
    'rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-900/20 hover:brightness-105 active:brightness-95',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-11 px-5 py-2.5 text-base',
  /** Áreas táctiles ≥44px en móvil */
  touch: 'min-h-11 min-w-[2.75rem] px-4 py-3 text-sm sm:min-h-10 sm:min-w-0 sm:py-2',
};

/**
 * Clases unificadas para `<button>` o `<Link>` (pasar className={buttonClassName(...)}).
 */
export function buttonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], className);
}
