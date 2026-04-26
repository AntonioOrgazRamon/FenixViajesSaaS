import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';

const schema = z.object({
  email: z.string().email(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  password: z.string().min(8).optional().or(z.literal('')),
  phone: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export function CompanyUserNewPage() {
  const navigate = useNavigate();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  const m = useMutation({
    mutationFn: async (v: Form) => {
      await api.post('/users', {
        email: v.email,
        firstName: v.firstName,
        lastName: v.lastName,
        role: 'COMPANY_USER',
        password: v.password || undefined,
        phone: v.phone || undefined,
      });
    },
    onSuccess: () => navigate('/app/users'),
  });

  return (
    <div className="w-full min-w-0">
      <Link to="/app/users" className="text-sm text-amber-400 hover:underline">
        ← Usuarios
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Nuevo usuario</h1>
      <form className="mt-6 space-y-4 rounded-xl border border-white/[0.08] bg-zinc-900/40 p-6" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        <div>
          <label className="text-sm text-zinc-400">Email</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('email')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-zinc-400">Nombre</label>
            <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('firstName')} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Apellidos</label>
            <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('lastName')} />
          </div>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Contraseña (opcional; si vacía, se genera)</label>
          <input type="password" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('password')} />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Teléfono</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('phone')} />
        </div>
        {m.isError && <p className="text-sm text-red-400">{getApiErrorMessage(m.error)}</p>}
        <button type="submit" disabled={m.isPending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">
          {m.isPending ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>
    </div>
  );
}
