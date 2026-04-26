import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Company, CompanyAuditRow } from '../../../types/domain';
import { getApiErrorMessage } from '../../../lib/errors';
import { PanelCard } from '../../../components/ui/PanelCard';
import { appPageTitle } from '../../../lib/appTable';
import { formatDateTime, labelCompanyStatus } from '../../../lib/userDisplayLabels';
import { labelForAuditAction } from '../../profile/lib/profileActivityLabels';
import { Activity, Building2, Clock3, Pencil, Shield, Trash2, Users } from 'lucide-react';

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

  const recentAudit = data.recentAudit ?? [];

  return (
    <div className="space-y-3">
      <Link to="/superadmin/tenants" className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-400">
        ? Empresas
      </Link>

      <h1 className={appPageTitle}>Ficha de empresa</h1>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50/90 via-white to-amber-50/35 p-4 shadow-sm dark:border-white/[0.08] dark:from-zinc-900/40 dark:via-zinc-950 dark:to-amber-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{data.name}</h2>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-100">
                {labelCompanyStatus(data.status)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{data.slug}</p>
            <p className="mt-1 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{data.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/superadmin/tenants/${id}/edit`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/85 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors duration-200 hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
              Editar
            </Link>
            <Link
              to={`/superadmin/users?companyId=${id}`}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/85 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors duration-200 hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
              Usuarios
            </Link>
            <Link
              to="/superadmin/audit-logs"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/85 px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors duration-200 hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
            >
              <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
              Auditoría
            </Link>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <PanelCard padding="p-3" className="bg-white/65 dark:bg-white/[0.02]">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Usuarios activos</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{data.usersCount ?? 0}</p>
          </PanelCard>
          <PanelCard padding="p-3" className="bg-white/65 dark:bg-white/[0.02]">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Leads abiertos</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{data.leadsCount ?? 0}</p>
          </PanelCard>
          <PanelCard padding="p-3" className="bg-white/65 dark:bg-white/[0.02]">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sesiones activas</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{data.activeSessionCount ?? 0}</p>
          </PanelCard>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <PanelCard padding="p-3.5" className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <Building2 className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" aria-hidden />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Empresa</h2>
          </div>
          <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Estado</dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{labelCompanyStatus(data.status)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Creada</dt>
              <dd className="text-sm text-zinc-900 dark:text-zinc-100">{formatDateTime(data.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Actualizada</dt>
              <dd className="text-sm text-zinc-900 dark:text-zinc-100">{formatDateTime(data.updatedAt)}</dd>
            </div>
          </dl>
        </PanelCard>

        <PanelCard padding="p-3.5" className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <Clock3 className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" aria-hidden />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cadencia</h2>
          </div>
          <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Último usuario creado</dt>
              <dd className="text-sm text-zinc-900 dark:text-zinc-100">{formatDateTime(data.lastUserCreatedAt, 'Sin registros')}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Último lead creado</dt>
              <dd className="text-sm text-zinc-900 dark:text-zinc-100">{formatDateTime(data.lastLeadCreatedAt, 'Sin registros')}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Suspendida</dt>
              <dd className="text-sm text-zinc-900 dark:text-zinc-100">{formatDateTime(data.suspendedAt, 'No')}</dd>
            </div>
          </dl>
        </PanelCard>

        <PanelCard padding="p-3.5" className="min-w-0 xl:col-span-2">
          <div className="mb-2 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">
            <Activity className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" aria-hidden />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Actividad reciente</h2>
          </div>
          {recentAudit.length === 0 ? (
            <p className="border-t border-zinc-200/80 pt-2.5 text-sm text-zinc-500 dark:border-white/[0.08]">
              No hay eventos recientes para esta empresa.
            </p>
          ) : (
            <ul className="space-y-0 border-t border-zinc-200/80 dark:border-white/[0.08]">
              {recentAudit.slice(0, 6).map((row: CompanyAuditRow, idx: number) => (
                <li
                  key={row.id}
                  className={`flex items-center justify-between gap-3 py-2 ${idx < Math.min(recentAudit.length, 6) - 1 ? 'border-b border-zinc-200/60 dark:border-white/[0.06]' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{labelForAuditAction(row.action)}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500">{row.actorRole ?? 'SYSTEM'}</p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">{formatDateTime(row.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <PanelCard padding="p-3.5" className="min-w-0">
        <div className="flex flex-wrap gap-2">
          {data.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => suspend.mutate()}
              disabled={suspend.isPending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors duration-200 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-200"
            >
              <Shield className="h-3.5 w-3.5" aria-hidden />
              Suspender
            </button>
          )}
          {data.status === 'SUSPENDED' && (
            <button
              type="button"
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors duration-200 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-200"
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
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors duration-200 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Eliminar
            </button>
          )}
        </div>

        {(suspend.isError || reactivate.isError || remove.isError) && (
          <p className="mt-3 text-sm text-red-500 dark:text-red-400">
            {getApiErrorMessage(suspend.error || reactivate.error || remove.error)}
          </p>
        )}
      </PanelCard>

      <p className="text-[11px] text-zinc-500">Vista compacta optimizada para aprovechar ancho y reducir scroll vertical.</p>
    </div>
  );
}
