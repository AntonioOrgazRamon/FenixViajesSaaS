import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import type { UserDetail } from '../../../types/domain';

const schema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  firstName: z.string().min(2).optional().or(z.literal('')),
  lastName: z.string().min(2).optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED']).optional(),
  phone: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export function CompanyUserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  const { data, isLoading } = useQuery<UserDetail>({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: UserDetail }>(`/users/${id}`);
      return unwrap(body);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      email: data.email,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      status: data.status as Form['status'],
      phone: data.phone ?? '',
    });
  }, [data, form]);

  const m = useMutation({
    mutationFn: async (v: Form) => {
      const payload: Record<string, unknown> = {};
      if (v.email) payload.email = v.email;
      if (v.firstName) payload.firstName = v.firstName;
      if (v.lastName) payload.lastName = v.lastName;
      if (v.status) payload.status = v.status;
      if (v.phone !== undefined) payload.phone = v.phone || null;
      await api.patch(`/users/${id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', id] });
      navigate(`/app/users/${id}`);
    },
  });

  if (!id) return null;
  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="w-full min-w-0">
      <Link to={`/app/users/${id}`} className="text-sm text-amber-400 hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Editar usuario</h1>
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
          <label className="text-sm text-zinc-400">Estado</label>
          <select className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('status')}>
            <option value="">—</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="LOCKED">LOCKED</option>
            <option value="DELETED">DELETED</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Teléfono</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('phone')} />
        </div>
        {m.isError && <p className="text-sm text-red-400">{getApiErrorMessage(m.error)}</p>}
        <button type="submit" disabled={m.isPending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">
          Guardar
        </button>
      </form>
    </div>
  );
}
