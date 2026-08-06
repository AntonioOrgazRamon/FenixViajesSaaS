import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Company } from '../../../types/domain';
import { getApiErrorMessage } from '../../../lib/errors';
import { useEffect } from 'react';

const schema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
});

type Form = z.infer<typeof schema>;

export function TenantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  const { data, isLoading } = useQuery<Company>({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Company }>(`/superadmin/companies/${id}`);
      return unwrap(body);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data) form.reset({ name: data.name, slug: data.slug });
  }, [data, form]);

  const m = useMutation({
    mutationFn: async (v: Form) => {
      await api.patch(`/superadmin/companies/${id}`, v);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', id] });
      navigate(`/superadmin/tenants/${id}`);
    },
  });

  if (!id) return null;
  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;

  return (
    <div className="w-full min-w-0">
      <Link to={`/superadmin/tenants/${id}`} className="text-sm text-amber-400 hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Editar empresa</h1>
      <form className="mt-6 space-y-4 rounded-xl border border-white/[0.08] bg-zinc-900/40 p-6" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        <div>
          <label className="text-sm text-zinc-400">Nombre</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('name')} />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Slug</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('slug')} />
        </div>
        {m.isError && <p className="text-sm text-red-400">{getApiErrorMessage(m.error)}</p>}
        <button type="submit" disabled={m.isPending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">
          Guardar
        </button>
      </form>
    </div>
  );
}
