import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function PanelCard({
  children,
  className,
  padding = 'p-3 sm:p-4',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm backdrop-blur-sm transition-shadow duration-300',
        'border-zinc-200/90 bg-white/90 shadow-zinc-200/40 hover:border-zinc-300/90',
        'dark:border-white/[0.07] dark:bg-zinc-900/45 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset,0_12px_40px_-18px_rgba(0,0,0,0.55)] dark:hover:border-white/[0.09]',
        padding,
        className,
      )}
    >
      {children}
    </div>
  );
}
