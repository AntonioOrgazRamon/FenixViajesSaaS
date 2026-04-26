import { cn } from '../../../lib/cn';

const variants = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  neutral: 'border-zinc-200/80 bg-zinc-100/80 text-zinc-700 dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200',
} as const;

export function StatusBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        variants[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
