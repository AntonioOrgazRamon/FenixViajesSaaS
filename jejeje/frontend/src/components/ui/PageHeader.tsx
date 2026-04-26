import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-col gap-2 border-b border-zinc-200/90 pb-3 dark:border-white/[0.06] sm:mb-4 sm:flex-row sm:items-end sm:justify-between sm:pb-3.5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white sm:text-xl"
          style={{ fontFamily: '"Syne", system-ui, sans-serif' }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 w-full text-xs leading-snug text-zinc-600 dark:text-zinc-500 sm:text-[13px]">{description}</p>
        )}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
