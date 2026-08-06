import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';

const schema = z.object({
  companyName: z.string().min(2),
  companySlug: z.string().min(2),
  adminEmail: z.string().email(),
  adminFirstName: z.string().min(2),
  adminLastName: z.string().min(2),
  adminPassword: z.string().min(6),
  adminPhone: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export function TenantNewPage() {
  const navigate = useNavigate();
  const form = useForm<Form>({ resolver: zodResolver(schema) });

  const m = useMutation({
    mutationFn: async (v: Form) => {
      await api.post('/superadmin/companies', {
        company: { name: v.companyName, slug: v.companySlug },
        initialAdmin: {
          email: v.adminEmail,
          firstName: v.adminFirstName,
          lastName: v.adminLastName,
          password: v.adminPassword,
          phone: v.adminPhone || undefined,
        },
      });
    },
    onSuccess: () => navigate('/superadmin/tenants'),
  });

  return (
    <div className="w-full min-w-0">
      <Link to="/superadmin/tenants" className="text-sm text-amber-400 hover:underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Nueva empresa</h1>
      <form className="mt-6 space-y-4 rounded-xl border border-white/[0.08] bg-zinc-900/40 p-6" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
        <p className="text-xs font-semibold uppercase text-zinc-500">Empresa</p>
        <div>
          <label className="text-sm text-zinc-400">Nombre</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('companyName')} />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Slug (URL)</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('companySlug')} />
        </div>
        <p className="pt-2 text-xs font-semibold uppercase text-zinc-500">Administrador inicial</p>
        <div>
          <label className="text-sm text-zinc-400">Email</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('adminEmail')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-zinc-400">Nombre</label>
            <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('adminFirstName')} />
          </div>
          <div>
            <label className="text-sm text-zinc-400">Apellidos</label>
            <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('adminLastName')} />
          </div>
        </div>
        <div>
          <label className="text-sm text-zinc-400">Contraseña inicial</label>
          <input type="password" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('adminPassword')} />
        </div>
        <div>
          <label className="text-sm text-zinc-400">Teléfono (opcional)</label>
          <input className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" {...form.register('adminPhone')} />
        </div>
        {m.isError && <p className="text-sm text-red-400">{getApiErrorMessage(m.error)}</p>}
        <button type="submit" disabled={m.isPending} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">
          {m.isPending ? 'Creando…' : 'Crear empresa'}
        </button>
      </form>
    </div>
  );
}
