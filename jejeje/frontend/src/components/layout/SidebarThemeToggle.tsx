import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import { type ThemePreference } from '../../lib/theme';
import { useAuthStore } from '../../store/authStore';
import { useUpdateThemePreference, getThemeUpdateErrorMessage } from '../../features/profile/hooks/useUpdateThemePreference';

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'SYSTEM', label: 'Sistema', icon: Monitor },
  { value: 'LIGHT', label: 'Claro', icon: Sun },
  { value: 'DARK', label: 'Oscuro', icon: Moon },
];

export function SidebarThemeToggle() {
  const user = useAuthStore((s) => s.user);
  const mutation = useUpdateThemePreference();
  const err = mutation.isError ? getThemeUpdateErrorMessage(mutation.error) : null;

  const current = user?.theme ?? 'SYSTEM';

  if (!user) return null;

  return (
    <div className="w-full min-w-0">
      <div
        className={cn('flex rounded-xl p-1', 'bg-zinc-200/80 dark:bg-white/[0.06]')}
        role="group"
        aria-label="Tema de la interfaz"
      >
        {options.map(({ value, label, icon: Icon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              title={label}
              aria-pressed={active}
              disabled={mutation.isPending}
              onClick={() => {
                if (value !== current) mutation.mutate(value);
              }}
              className={cn(
                'flex flex-1 cursor-pointer items-center justify-center rounded-lg py-2 transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/60',
                active
                  ? 'bg-white text-amber-700 shadow-sm dark:bg-zinc-800 dark:text-amber-300'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300',
                mutation.isPending && 'opacity-60',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>
      {err && (
        <p className="mt-1.5 text-center text-[10px] text-red-500 dark:text-red-400" role="status">
          {err}
        </p>
      )}
    </div>
  );
}
