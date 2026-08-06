import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuthStore } from '../../../store/authStore';
import { ProfileSectionCard } from './ProfileSectionCard';
import { profileInputClass, profileLabelClass } from './profileFormStyles';
import { profileKeys } from '../hooks/profileKeys';
import { cn } from '../../../lib/cn';

const emailSchema = z.object({
  new_email: z.string().email('Introduce un correo válido'),
  password: z.string().min(1, 'Escribe tu contraseña actual'),
});

export function EmailChangeCard({
  currentEmail,
  embedded,
  compact,
}: {
  currentEmail: string;
  embedded?: boolean;
  /** Más denso: rejilla de campos y menos aire (p. ej. sección Seguridad). */
  compact?: boolean;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof emailSchema>) => {
      const { data: body } = await api.patch<{ success: boolean; data: { email: string } }>('/profile/email', values);
      return unwrap<{ email: string }>(body);
    },
    onSuccess: (res) => {
      const prev = useAuthStore.getState().user;
      if (prev) setUser({ ...prev, email: res.email });
      qc.invalidateQueries({ queryKey: profileKeys.all });
      qc.invalidateQueries({ queryKey: profileKeys.activity });
      form.reset();
    },
  });

  const inCls = compact ? cn(profileInputClass, 'py-1.5 text-[12px]') : profileInputClass;

  const inner = (
    <>
      <p
        className={cn(
          'text-zinc-600 dark:text-zinc-500',
          compact ? 'mb-1.5 truncate text-[10px] leading-tight' : 'mb-2 text-xs',
        )}
      >
        <span className="font-medium text-zinc-800 dark:text-zinc-300">Correo actual: </span>
        {currentEmail}
      </p>
      <form
        className={cn(
          'space-y-2',
          compact && 'sm:grid sm:grid-cols-2 sm:items-end sm:gap-x-3 sm:space-y-0',
        )}
        onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
        noValidate
      >
        <div>
          <label className={profileLabelClass} htmlFor="ch-email">
            Nuevo correo
          </label>
          <input id="ch-email" type="email" className={inCls} autoComplete="email" {...form.register('new_email')} />
        </div>
        <div>
          <label className={profileLabelClass} htmlFor="ch-pw">
            Contraseña actual
          </label>
          <input
            id="ch-pw"
            type="password"
            className={inCls}
            autoComplete="current-password"
            {...form.register('password')}
          />
        </div>
        {mutation.isError && (
          <p
            className={cn('text-red-500', compact ? 'sm:col-span-2 text-[10px]' : 'text-xs')}
            role="alert"
          >
            {getApiErrorMessage(mutation.error)}
          </p>
        )}
        {mutation.isSuccess && (
          <p
            className={cn(
              'text-emerald-600 dark:text-emerald-400',
              compact ? 'sm:col-span-2 text-[10px] leading-snug' : 'text-xs',
            )}
            role="status"
          >
            Correo actualizado. Usa el nuevo email la próxima vez que inicies sesión.
          </p>
        )}
        <div
          className={cn(
            compact && 'sm:col-span-2 sm:flex sm:justify-end',
          )}
        >
          <button
            type="submit"
            disabled={mutation.isPending}
            className={cn(
              'rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-white/12 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-800/60',
              compact ? 'w-full px-2.5 py-1 sm:w-auto' : 'w-full px-3 py-1.5',
            )}
          >
            {mutation.isPending ? 'Actualizando…' : 'Cambiar correo'}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) {
    return <div className="min-w-0">{inner}</div>;
  }

  return (
    <ProfileSectionCard
      id="email"
      title="Correo electrónico"
      description="Cambiar el inicio de sesión requiere contraseña actual. Te enviaremos notificaciones al nuevo correo según el producto."
    >
      {inner}
    </ProfileSectionCard>
  );
}
