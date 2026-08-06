import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Info, KeyRound, Lock } from 'lucide-react';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuthStore } from '../../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/cn';
import { ProfileSecuritySubPageFrame } from '../components/ProfileSecuritySubPageFrame';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe la contraseña actual'),
    newPassword: z.string().min(10, 'Mínimo 10 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas nuevas no coinciden',
    path: ['confirmPassword'],
  });

type Form = z.infer<typeof schema>;

const field = cn(
  'h-10 w-full rounded-lg border bg-white px-3 text-[14px] outline-none transition',
  'border-zinc-200/90 text-zinc-900 placeholder:text-zinc-400',
  'hover:border-zinc-300/90 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20',
  'dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-amber-400/40',
);

const label = 'mb-1 block text-[12px] font-medium text-zinc-700 dark:text-zinc-300';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [msg, setMsg] = useState<string | null>(null);
  const { register, handleSubmit, formState, reset } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setMsg(null);
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      reset();
      setMsg('Contraseña actualizada. Debes volver a iniciar sesión.');
      logout();
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (e) {
      setMsg(getApiErrorMessage(e));
    }
  };

  return (
    <ProfileSecuritySubPageFrame
      title="Cambiar contraseña"
      description="Protege tu cuenta con una clave que no reutilices en otros servicios. Al guardar, se cerrarán el resto de dispositivos."
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex gap-3 rounded-xl border border-amber-200/50 bg-amber-500/5 p-3.5 dark:border-amber-500/20 dark:bg-amber-500/[0.08]">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700/80 dark:text-amber-300/90"
            strokeWidth={1.8}
            aria-hidden
          />
          <p className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            Tras guardar correctamente, deberás iniciar sesión otra vez en <strong>este</strong> navegador. El resto de
            aparatos quedará desconectado hasta que entren con la clave nueva.
          </p>
        </div>

        <div>
          <label className={label} htmlFor="cp-current">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
              Contraseña actual
            </span>
          </label>
          <input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            className={field}
            placeholder="••••••••"
            {...register('currentPassword')}
          />
        </div>

        <div className="space-y-4 rounded-xl border border-dashed border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-white/10 dark:bg-zinc-900/30 sm:p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            <KeyRound className="h-3.5 w-3.5" aria-hidden />
            Nueva clave
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="cp-new">
                Nueva contraseña
              </label>
              <input
                id="cp-new"
                type="password"
                autoComplete="new-password"
                className={field}
                placeholder="Mín. 10 caracteres"
                {...register('newPassword')}
              />
            </div>
            <div>
              <label className={label} htmlFor="cp-confirm">
                Repetir contraseña
              </label>
              <input
                id="cp-confirm"
                type="password"
                autoComplete="new-password"
                className={field}
                placeholder="Misma clave otra vez"
                {...register('confirmPassword')}
              />
              {formState.errors.confirmPassword && (
                <p className="mt-1.5 text-[12px] text-red-600 dark:text-red-400" role="alert">
                  {formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {msg && (
          <div
            className={cn(
              'rounded-lg border px-3 py-2.5 text-[13px] leading-snug',
              msg.startsWith('Contraseña actualizada')
                ? 'border-emerald-200/80 bg-emerald-500/5 text-emerald-900 dark:border-emerald-500/20 dark:text-emerald-200'
                : 'border-red-200/80 bg-red-500/5 text-red-800 dark:border-red-500/25 dark:text-red-200',
            )}
            role={msg.startsWith('Contraseña') ? 'status' : 'alert'}
          >
            {msg}
          </div>
        )}

        <div className="pt-1">
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="h-11 w-full rounded-xl bg-amber-500 text-[15px] font-semibold text-zinc-950 shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500/50 disabled:opacity-50"
          >
            {formState.isSubmitting ? 'Aplicando cambio…' : 'Actualizar y cerrar otras sesiones'}
          </button>
        </div>
      </form>
    </ProfileSecuritySubPageFrame>
  );
}
