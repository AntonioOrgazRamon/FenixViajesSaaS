export function ProfilePageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-hidden>
      <div className="h-7 w-40 animate-pulse rounded bg-zinc-200/80 dark:bg-white/10" />
      <p className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-zinc-200/50 dark:bg-white/5" />
      <div
        className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-2xl border border-zinc-200/70 bg-zinc-50/40 sm:flex-row dark:border-white/[0.07] dark:bg-zinc-900/20"
        style={{ minHeight: 180 }}
      >
        <div className="flex gap-1 border-b border-zinc-200/70 p-1.5 sm:w-[13.5rem] sm:flex-col sm:border-b-0 sm:border-r dark:border-white/[0.07]">
          {Array.from({ length: 11 }).map((_, i) => (
            <div
              key={i}
              className="h-8 min-w-[10.25rem] flex-none animate-pulse rounded-lg bg-zinc-200/50 sm:min-w-0 sm:w-full dark:bg-white/10"
            />
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1 border-t border-zinc-200/70 p-4 dark:border-white/[0.07] sm:border-t-0 sm:border-l">
          <div className="h-4 w-1/2 max-w-xs animate-pulse rounded bg-zinc-200/70 dark:bg-white/10" />
          <div className="mt-2 h-3 w-3/4 max-w-sm animate-pulse rounded bg-zinc-200/45 dark:bg-white/5" />
          <div className="mt-4 h-40 w-full max-w-2xl animate-pulse rounded-xl bg-zinc-200/50 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );
}
