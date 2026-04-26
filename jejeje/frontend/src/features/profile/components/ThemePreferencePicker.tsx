import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { useUpdateThemePreference, getThemeUpdateErrorMessage } from '../hooks/useUpdateThemePreference';
import type { ThemePreference } from '../../../lib/theme';

const cards: {
  value: ThemePreference;
  label: string;
  hint: string;
  Icon: typeof Sun;
}[] = [
  {
    value: 'SYSTEM',
    label: 'Sistema',
    hint: 'Usa la apariencia de tu dispositivo',
    Icon: Monitor,
  },
  {
    value: 'LIGHT',
    label: 'Claro',
    hint: 'Interfaz luminosa, ideal de día',
    Icon: Sun,
  },
  {
    value: 'DARK',
    label: 'Oscuro',
    hint: 'Menos brillo en sesiones largas',
    Icon: Moon,
  },
];

export function ThemePreferencePicker({ value }: { value: ThemePreference }) {
  const mutation = useUpdateThemePreference();
  const err = mutation.isError ? getThemeUpdateErrorMessage(mutation.error) : null;

  return (
    <div>
      <div
        className="grid gap-2 sm:grid-cols-3"
        role="group"
        aria-label="Apariencia (tema de la interfaz)"
      >
        {cards.map(({ value: v, label, hint, Icon }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                if (v !== value) mutation.mutate(v);
              }}
              aria-pressed={active}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/60',
                active
                  ? 'border-amber-500/50 bg-amber-500/10 shadow-sm dark:border-amber-500/35 dark:bg-amber-500/10'
                  : 'border-zinc-200/90 bg-zinc-50/50 hover:border-zinc-300 dark:border-white/[0.08] dark:bg-zinc-900/30 dark:hover:border-white/[0.12]',
                mutation.isPending && 'opacity-60',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    active ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {label}
                </span>
              </span>
              <span className="text-[10px] leading-snug text-zinc-500 dark:text-zinc-500">{hint}</span>
            </button>
          );
        })}
      </div>
      {err && (
        <p className="mt-2 text-xs text-red-500 dark:text-red-400" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
