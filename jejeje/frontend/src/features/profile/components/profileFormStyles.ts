import { cn } from '../../../lib/cn';

export const profileLabelClass =
  'text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500';

export const profileInputClass = cn(
  'mt-0.5 w-full rounded-lg border px-2.5 py-2 text-[13px] outline-none transition-shadow',
  'border-zinc-200 bg-white text-zinc-900 shadow-sm',
  'focus:border-amber-400/50 focus:ring-2 focus:ring-amber-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100',
);

export const profileSelectClass = profileInputClass;

export const sectionTitleClass = 'text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

export const sectionDescriptionClass = 'mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500';
