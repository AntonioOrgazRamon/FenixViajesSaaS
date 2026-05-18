import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPin, Mail, Phone } from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import type { LeadListItem } from '../../../types/domain';
import { cn } from '../../../lib/cn';
import { appFilterLabel, appInputBorder, appInputFilter, appSelectFilter } from '../../../lib/appTable';

type ListResponse = {
  items: LeadListItem[];
  total: number;
  page: number;
  page_size: number;
};

const statusLabels: Record<string, string> = {
  PENDING_REVIEW: 'Pendiente de revisión',
  NEW: 'Nuevo',
  QUALIFYING: 'Cualificando',
  QUALIFIED: 'Cualificado',
  CONTACTED: 'Contactado',
  WAITING: 'En espera',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
  ARCHIVED: 'Archivado',
};

function statusChip(status: string) {
  return (
    <span className="rounded-md border border-cyan-500/25 bg-cyan-500/[0.12] px-2 py-0.5 text-[11px] font-medium text-cyan-950 dark:text-cyan-100">
      {statusLabels[status] ?? status}
    </span>
  );
}

function LeadInspector({ row, onClose }: { row: LeadListItem; onClose?: () => void }) {
  const name = row.fullName || [row.email, row.phone].filter(Boolean).join(' · ') || 'Sin nombre';
  const travelDate = row.travel?.travelDate
    ? new Date(row.travel.travelDate).toLocaleDateString('es-ES')
    : '—';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-zinc-200/80 pb-3 dark:border-white/[0.06]">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Seleccionado</p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>
          {statusChip(row.status)}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.05]"
          >
            Cerrar
          </button>
        ) : null}
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <MapPin className="h-3 w-3" strokeWidth={2} />
            Destino
          </dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{row.travel?.destination ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Fecha viaje</dt>
          <dd className="mt-0.5 tabular-nums text-zinc-800 dark:text-zinc-200">{travelDate}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <Mail className="h-3 w-3" strokeWidth={2} />
            Email
          </dt>
          <dd className="mt-0.5 break-all text-zinc-800 dark:text-zinc-200">{row.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <Phone className="h-3 w-3" strokeWidth={2} />
            Teléfono
          </dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{row.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Asignado</dt>
          <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
            {row.assignedUser
              ? `${row.assignedUser.firstName} ${row.assignedUser.lastName}`.trim() || row.assignedUser.email
              : '—'}
          </dd>
        </div>
      </dl>
      <div className="mt-auto border-t border-zinc-200/80 pt-4 dark:border-white/[0.06]">
        <Link
          to={`/leads/${row.id}`}
          className="flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 transition-[filter] hover:brightness-105"
        >
          Abrir ficha completa
        </Link>
        <p className="mt-2 text-center text-[11px] text-zinc-500">Atajo · propuesta IA en la ficha</p>
      </div>
    </div>
  );
}

export function LeadsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const assignedUserId = searchParams.get('assigned_user_id')?.trim() ?? '';
  const createdByUserId = searchParams.get('created_by_user_id')?.trim() ?? '';

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [assignedUserId, createdByUserId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const clearUserFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('assigned_user_id');
    next.delete('created_by_user_id');
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const userFilterSummary =
    assignedUserId && createdByUserId
      ? 'Filtros de usuario: asignado y creador.'
      : assignedUserId
        ? 'Mostrando leads asignados a este usuario.'
        : createdByUserId
          ? 'Mostrando leads creados por este usuario.'
          : '';

  const query = useQuery<ListResponse>({
    queryKey: ['leads', page, search, status, assignedUserId, createdByUserId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      if (assignedUserId) params.set('assigned_user_id', assignedUserId);
      if (createdByUserId) params.set('created_by_user_id', createdByUserId);
      const { data } = await api.get<{ success: boolean; data: ListResponse }>(`/leads?${params.toString()}`);
      return unwrap(data);
    },
  });

  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  }, [rows]);

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null;

  const displayName = (r: LeadListItem) =>
    r.fullName || [r.email, r.phone].filter(Boolean).join(' · ') || '—';

  const displayTravelDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES');
  };

  return (
    <div className="w-full min-w-0">
      <PageHeader
        title="Leads"
        description="Vista tipo inbox: lista densa, inspector lateral en escritorio y acceso rápido a la ficha con propuesta IA."
      />

      {userFilterSummary ? (
        <div
          className="mb-4 flex flex-col gap-3 rounded-xl border border-cyan-200/80 bg-cyan-50/90 px-4 py-3 text-sm text-cyan-950 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-50 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p className="min-w-0 leading-snug">{userFilterSummary}</p>
          <button
            type="button"
            onClick={clearUserFilters}
            className="shrink-0 rounded-lg border border-cyan-300/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-cyan-900 shadow-sm hover:bg-white dark:border-cyan-400/30 dark:bg-zinc-900/80 dark:text-cyan-100 dark:hover:bg-zinc-900"
          >
            Quitar filtro de usuario
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="min-w-0 flex-1 space-y-4">
          <PanelCard className="mb-0" padding="p-2.5 sm:p-3.5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-2.5">
              <div className="min-w-0 flex-1 sm:min-w-0 sm:max-w-sm">
                <label className={appFilterLabel} htmlFor="ld-search">
                  Buscar
                </label>
                <input
                  id="ld-search"
                  className={appInputFilter}
                  placeholder="Nombre, email, teléfono…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="w-full min-w-0 sm:w-40 sm:flex-none">
                <label className={appFilterLabel} htmlFor="ld-st">
                  Estado
                </label>
                <select
                  id="ld-st"
                  className={appSelectFilter}
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
            {query.isError && <p className="p-6 text-sm text-red-500">No se pudieron cargar los leads.</p>}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <p className="p-6 text-sm text-zinc-500">
                {search.trim() || status || assignedUserId || createdByUserId
                  ? 'Sin resultados con los filtros actuales.'
                  : 'Aún no hay leads.'}
              </p>
            )}
            {!query.isLoading && rows.length > 0 && (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1020px] text-left text-sm">
                  <thead className="border-b border-zinc-200/90 bg-zinc-50/95 text-[11px] uppercase tracking-wider text-zinc-600 dark:border-white/[0.08] dark:bg-black/25 dark:text-zinc-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Nombre</th>
                      <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Destino</th>
                      <th className="hidden md:table-cell px-3 py-2.5 font-medium sm:px-4 sm:py-3">Fecha</th>
                      <th className="hidden lg:table-cell px-3 py-2.5 font-medium sm:px-4 sm:py-3">Plazas</th>
                      <th className="hidden xl:table-cell px-3 py-2.5 font-medium sm:px-4 sm:py-3">Correo</th>
                      <th className="px-3 py-2.5 font-medium sm:px-4 sm:py-3">Estado</th>
                      <th className="hidden lg:table-cell px-3 py-2.5 font-medium sm:px-4 sm:py-3">Entrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const active = r.id === selectedId;
                      return (
                        <tr
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedId(r.id);
                            }
                          }}
                          className={cn(
                            'cursor-pointer border-b border-zinc-200/50 transition-colors dark:border-white/[0.04]',
                            active
                              ? 'bg-cyan-500/[0.09] dark:bg-cyan-500/[0.12]'
                              : 'hover:bg-zinc-50/90 dark:hover:bg-white/[0.03]',
                          )}
                        >
                          <td className="px-3 py-2.5 font-medium text-zinc-900 dark:text-zinc-100 sm:px-4 sm:py-3">
                            <Link
                              to={`/leads/${r.id}`}
                              className={cn(
                                'rounded-sm underline-offset-2 hover:underline',
                                active ? 'text-cyan-800 dark:text-cyan-200' : 'text-zinc-900 hover:text-cyan-700 dark:text-zinc-200 dark:hover:text-cyan-300',
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {displayName(r)}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3">
                            {r.travel?.destination ?? '—'}
                          </td>
                          <td className="hidden md:table-cell px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 tabular-nums">
                            {displayTravelDate(r.travel?.travelDate)}
                          </td>
                          <td className="hidden lg:table-cell px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3 tabular-nums">
                            {r.travel?.seats != null ? r.travel.seats : '—'}
                          </td>
                          <td className="hidden xl:table-cell px-3 py-2.5 text-zinc-600 dark:text-zinc-400 sm:px-4 sm:py-3">
                            {r.email ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 sm:px-4 sm:py-3">{statusChip(r.status)}</td>
                          <td className="hidden lg:table-cell px-3 py-2.5 text-xs text-zinc-500 sm:px-4 sm:py-3 tabular-nums">
                            {new Date(r.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
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

          {selected ? (
            <PanelCard className="xl:hidden" padding="p-4">
              <LeadInspector row={selected} onClose={() => setSelectedId(null)} />
            </PanelCard>
          ) : null}
        </div>

        {selected ? (
          <aside className="hidden w-[19rem] shrink-0 xl:block">
            <PanelCard className="sticky top-4 h-[calc(100vh-7.5rem)] overflow-y-auto" padding="p-4">
              <LeadInspector row={selected} />
            </PanelCard>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
