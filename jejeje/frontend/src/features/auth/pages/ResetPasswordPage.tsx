import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';

const schema = z
  .object({
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] });

type Form = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    if (!token) {
      setError('Falta el token en la URL (?token=…)');
      return;
    }
    try {
      setError(null);
      await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setDone(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100">
      <div className="w-full rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-semibold text-white">Nueva contraseña</h1>
        {done ? (
          <p className="mt-4 text-sm text-amber-200/90">Contraseña actualizada. Ya puedes iniciar sesión.</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm text-zinc-400">Nueva contraseña</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                {...register('newPassword')}
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400">Confirmar</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                {...register('confirmPassword')}
              />
              {formState.errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">{formState.errors.confirmPassword.message}</p>
              )}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              Guardar
            </button>
          </form>
        )}
        <Link to="/login" className="mt-6 block text-center text-sm text-amber-400/90 hover:underline">
          Ir al login
        </Link>
      </div>
    </div>
  );
}
