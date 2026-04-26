import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import type { LeadListItem } from '../../../types/domain';
import { cn } from '../../../lib/cn';
import { appInputBorder, appSelect } from '../../../lib/appTable';

type ListResponse = {
  items: LeadListItem[];
  total: number;
  page: number;
  page_size: number;
};

const statusLabels: Record<string, string> = {
  NEW: 'Nuevo',
  QUALIFYING: 'Cualificando',
  QUALIFIED: 'Cualificado',
  CONTACTED: 'Contactado',
  WAITING: 'En espera',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
  ARCHIVED: 'Archivado',
};

export function LeadsListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const pageSize = 20;

  const query = useQuery<ListResponse>({
    queryKey: ['leads', page, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      const { data } = await api.get<{ success: boolean; data: ListResponse }>(`/leads?${params.toString()}`);
      return unwrap(data);
    },
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const displayName = (r: LeadListItem) =>
    r.fullName || [r.email, r.phone].filter(Boolean).join(' · ') || '—';

  return (
    <div className="w-full min-w-0">
      <PageHeader
        title="Leads"
        description="Captación y seguimiento de oportunidades de tu empresa (multi-tenant)."
      />

      <PanelCard className="mb-6" padding="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs text-zinc-600 dark:text-zinc-500">Buscar</label>
            <input
              className={cn(
                'mt-1 w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/25',
                'border border-zinc-300 bg-white text-zinc-900',
                'dark:border-white/10 dark:bg-black/30 dark:text-zinc-100',
              )}
              placeholder="Nombre, email, teléfono…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-zinc-600 dark:text-zinc-500">Estado</label>
            <select
              className={cn(appSelect, 'mt-1 w-full outline-none focus:ring-2 focus:ring-amber-400/25')}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PanelCard>

      <PanelCard padding="p-0 overflow-hidden">
        {query.isLoading && <p className="p-6 text-sm text-zinc-500">Cargando leads…</p>}
        {query.isError && (
          <p className="p-6 text-sm text-red-400">No se pudieron cargar los leads.</p>
        )}
        {!query.isLoading && !query.isError && rows.length === 0 && (
          <p className="p-6 text-sm text-zinc-500">
            {search.trim() || status ? 'Sin resultados con los filtros actuales.' : 'Aún no hay leads.'}
          </p>
        )}
        {!query.isLoading && rows.length > 0 && (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-zinc-200/90 bg-zinc-50/95 text-xs uppercase tracking-wider text-zinc-600 dark:border-white/[0.08] dark:bg-black/20 dark:text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Nombre / contacto</th>
                  <th className="px-4 py-3 font-medium">Origen</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Prioridad</th>
                  <th className="px-4 py-3 font-medium">Asignado</th>
                  <th className="px-4 py-3 font-medium">Creado</th>
                  <th className="px-4 py-3 font-medium">Último mov.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-b border-zinc-200/60 transition-colors hover:bg-zinc-50/90 dark:border-white/[0.05] dark:hover:bg-white/[0.03]',
                    )}
                    onDoubleClick={() => navigate(`/leads/${r.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-200">{displayName(r)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.source}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                        {statusLabels[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.priority ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {r.assignedUser
                        ? `${r.assignedUser.firstName} ${r.assignedUser.lastName}`.trim() || r.assignedUser.email
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 tabular-nums">
                      {new Date(r.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200/90 px-4 py-3 text-sm text-zinc-600 dark:border-white/[0.08] dark:text-zinc-500">
            <span>
              Página {page} de {totalPages} ({total} leads)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className={cn('rounded-lg px-3 py-1 disabled:opacity-40', appInputBorder, 'text-zinc-800 dark:text-zinc-300')}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                className={cn('rounded-lg px-3 py-1 disabled:opacity-40', appInputBorder, 'text-zinc-800 dark:text-zinc-300')}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </PanelCard>
    </div>
  );
}
