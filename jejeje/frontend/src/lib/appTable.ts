import { cn } from './cn';

/** Contenedor de tabla con soporte claro/oscuro */
export const appTableWrap = cn(
  'mt-6 overflow-x-auto rounded-xl border shadow-sm backdrop-blur-sm',
  'border-zinc-200/90 bg-white/90',
  'dark:border-white/[0.08] dark:bg-zinc-900/40 dark:shadow-none dark:backdrop-blur-none',
);

export const appTableHead = cn(
  'border-b text-xs uppercase',
  'border-zinc-200 bg-zinc-50/95 text-zinc-600',
  'dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-500',
);

export const appTableBody = cn('divide-y', 'divide-zinc-200/70 dark:divide-white/5');

export const appTableRow = cn('transition-colors', 'hover:bg-zinc-50/90 dark:hover:bg-white/[0.02]');

export const appTableCellStrong = cn('font-medium', 'text-zinc-900 dark:text-zinc-200');

export const appTableCellMuted = cn('text-zinc-600 dark:text-zinc-500');

export const appTableCellSoft = cn('text-zinc-600 dark:text-zinc-400');

export const appPageTitle = cn('text-2xl font-semibold', 'text-zinc-900 dark:text-white');

export const appInputBorder = cn(
  'rounded border',
  'border-zinc-300 bg-white text-zinc-900',
  'dark:border-white/10 dark:bg-black/25 dark:text-zinc-100',
);

export const appSelect = cn(
  'mt-1 block rounded-lg border px-3 py-2 text-sm',
  'border-zinc-300 bg-white text-zinc-900',
  'dark:border-white/10 dark:bg-black/40 dark:text-white',
);
