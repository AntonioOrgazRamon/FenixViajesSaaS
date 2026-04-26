import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Company } from '../../../types/domain';
import { getApiErrorMessage } from '../../../lib/errors';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<Company>({
    queryKey: ['company', id],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Company }>(`/superadmin/companies/${id}`);
      return unwrap(body);
    },
    enabled: !!id,
  });

  const suspend = useMutation({
    mutationFn: () => api.post(`/superadmin/companies/${id}/suspend`, { reason: 'Suspendido desde panel' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  });
  const reactivate = useMutation({
    mutationFn: () => api.post(`/superadmin/companies/${id}/reactivate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', id] }),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/superadmin/companies/${id}`, { data: { reason: 'Borrado lógico desde panel' } }),
    onSuccess: () => navigate('/superadmin/tenants'),
  });

  if (!id) return null;
  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error || !data) return <p className="text-sm text-red-400">Empresa no encontrada.</p>;

  return (
    <div>
      <Link to="/superadmin/tenants" className="text-sm text-amber-400 hover:underline">
        ← Empresas
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{data.name}</h1>
          <p className="text-sm text-zinc-500">{data.slug}</p>
          <p className="mt-2 text-sm text-zinc-400">Estado: {data.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/superadmin/tenants/${id}/edit`}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
          >
            Editar
          </Link>
          {data.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => suspend.mutate()}
              disabled={suspend.isPending}
              className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
            >
              Suspender
            </button>
          )}
          {data.status === 'SUSPENDED' && (
            <button
              type="button"
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              Reactivar
            </button>
          )}
          {data.status !== 'DELETED' && (
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Borrar empresa (lógico) y revocar sesiones?')) remove.mutate();
              }}
              disabled={remove.isPending}
              className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
      {(suspend.isError || reactivate.isError || remove.isError) && (
        <p className="mt-4 text-sm text-red-400">
          {getApiErrorMessage(suspend.error || reactivate.error || remove.error)}
        </p>
      )}
    </div>
  );
}
