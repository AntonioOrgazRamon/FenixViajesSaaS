import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuthStore } from '../../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { PanelCard } from '../../../components/ui/PanelCard';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Obligatorio'),
    newPassword: z.string().min(10, 'Mínimo 10 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type Form = z.infer<typeof schema>;

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

  const field =
    'mt-0.5 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-[13px] text-zinc-900 outline-none focus:ring-1 focus:ring-amber-400/30 dark:border-white/10 dark:bg-black/30 dark:text-zinc-100';

  return (
    <div className="w-full min-w-0">
      <p className="mb-2 text-[11px] text-zinc-500">Al guardar se revocan el resto de sesiones activas.</p>
      <PanelCard className="w-full">
        <form className="grid w-full gap-2" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Contraseña actual</label>
            <input type="password" className={field} {...register('currentPassword')} />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Nueva contraseña</label>
            <input type="password" className={field} {...register('newPassword')} />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Confirmar</label>
            <input type="password" className={field} {...register('confirmPassword')} />
            {formState.errors.confirmPassword && (
              <p className="mt-0.5 text-xs text-red-400">{formState.errors.confirmPassword.message}</p>
            )}
          </div>
          {msg && (
            <p className={msg.startsWith('Contraseña actualizada') ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>
              {msg}
            </p>
          )}
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="mt-1 w-full rounded-md bg-amber-500 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {formState.isSubmitting ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </form>
      </PanelCard>
    </div>
  );
}
