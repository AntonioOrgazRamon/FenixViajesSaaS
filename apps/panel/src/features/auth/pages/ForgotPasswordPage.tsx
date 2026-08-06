import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';

const schema = z.object({
  email: z.string().email('Introduce un correo electrónico válido'),
});

type Form = z.infer<typeof schema>;

const MSG_OK =
  'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.';

export function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      setError(null);
      await api.post('/auth/forgot-password', data);
      setDone(true);
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-semibold text-white">He olvidado mi contraseña</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Introduce tu correo electrónico y, si existe una cuenta asociada, te enviaremos un enlace para restablecer
          tu contraseña. El enlace caduca a los 30 minutos (un solo uso).
        </p>
        {done ? (
          <p className="mt-6 text-sm text-amber-200/90">{MSG_OK}</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label className="text-sm text-zinc-400" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
                disabled={formState.isSubmitting}
                {...register('email')}
              />
              {formState.errors.email && (
                <p className="mt-1 text-xs text-red-400">{formState.errors.email.message}</p>
              )}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="w-full cursor-pointer rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {formState.isSubmitting ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <Link
          to="/login"
          className="mt-6 block text-center text-sm text-amber-400/90 hover:underline"
        >
          Volver al login
        </Link>
      </div>
    </div>
  );
}
