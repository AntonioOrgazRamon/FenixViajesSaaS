import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { api } from '../../lib/axios';
import { unwrap } from '../../lib/api';
import { cn } from '../../lib/cn';
import { writeStoredThemePreference, type ThemePreference } from '../../lib/theme';
import { useAuthStore, type AuthUser } from '../../store/authStore';

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'LIGHT', label: 'Claro', icon: Sun },
  { value: 'DARK', label: 'Oscuro', icon: Moon },
  { value: 'SYSTEM', label: 'Sistema', icon: Monitor },
];

export function SidebarThemeToggle() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (theme: ThemePreference) => {
      const { data } = await api.patch<{ success: boolean; data: AuthUser }>('/profile', { theme });
      return unwrap<AuthUser>(data);
    },
    onSuccess: (data: AuthUser) => {
      const t = data.theme ?? 'SYSTEM';
      writeStoredThemePreference(t);
      const prev = useAuthStore.getState().user;
      if (prev) setUser({ ...prev, ...data });
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const current = user?.theme ?? 'SYSTEM';

  if (!user) return null;

  return (
    <div
      className={cn(
        'flex rounded-xl p-1',
        'bg-zinc-200/80 dark:bg-white/[0.06]',
      )}
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
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(value)}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center rounded-lg py-2 transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/60',
              active
                ? 'bg-white text-amber-700 shadow-sm dark:bg-zinc-800 dark:text-amber-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
