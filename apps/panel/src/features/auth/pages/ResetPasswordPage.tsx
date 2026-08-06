import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';
import { getPasswordPolicyErrors } from '../../../lib/passwordPolicy';

const schema = z
  .object({
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] })
  .superRefine((d, ctx) => {
    const errs = getPasswordPolicyErrors(d.newPassword);
    if (errs.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newPassword'], message: errs[0]! });
    }
  });

type Form = z.infer<typeof schema>;

const GENERIC_INVALID =
  'El enlace no es válido o ha caducado. Solicita uno nuevo en «He olvidado mi contraseña».';

export function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(!!token);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) {
      setLinkInvalid(true);
      setChecking(false);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.post('/auth/verify-reset-token', { token });
        if (cancel) return;
        if (!data?.data?.valid) {
          setLinkInvalid(true);
        }
      } catch {
        if (!cancel) setLinkInvalid(true);
      } finally {
        if (!cancel) setChecking(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  const onSubmit = async (data: Form) => {
    if (!token) return;
    setError(null);
    try {
      const { data: res } = await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      const message =
        res?.data?.message ?? 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.';
      navigate('/login', { replace: true, state: { message } });
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100">
        <p className="text-sm text-zinc-400">Comprobando enlace…</p>
      </div>
    );
  }

  if (!token || linkInvalid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-8 text-center shadow-xl backdrop-blur">
          <h1 className="text-lg font-semibold text-white">Enlace no disponible</h1>
          <p className="mt-3 text-sm text-zinc-400">{GENERIC_INVALID}</p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-block text-sm text-amber-400/90 hover:underline"
          >
            Pedir un nuevo enlace
          </Link>
          <Link
            to="/login"
            className="mt-3 block text-sm text-zinc-500 hover:text-zinc-300"
          >
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4 py-12 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-900/50 p-8 shadow-xl backdrop-blur">
        <h1 className="text-xl font-semibold text-white">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Requisitos: 8+ caracteres, mayúscula, minúscula, número y un carácter especial. Sin espacios al inicio o
          al final.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div>
            <label className="text-sm text-zinc-400" htmlFor="newPassword">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
              disabled={formState.isSubmitting}
              {...register('newPassword')}
            />
            {formState.errors.newPassword && (
              <p className="mt-1 text-xs text-red-400">{formState.errors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-zinc-400" htmlFor="confirmPassword">
              Repetir contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/30"
              disabled={formState.isSubmitting}
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
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formState.isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
        <Link to="/login" className="mt-6 block text-center text-sm text-amber-400/90 hover:underline">
          Volver al login
        </Link>
      </div>
    </div>
  );
}
