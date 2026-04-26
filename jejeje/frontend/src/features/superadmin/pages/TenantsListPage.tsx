import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Company, Paginated } from '../../../types/domain';
import {
  appFilterBar,
  appFilterLabel,
  appInputBorder,
  appInputFilter,
  appPageTitle,
  appSelectFilter,
  appTableBody,
  appTableCellMuted,
  appTableCellSoft,
  appTableCellStrong,
  appTableHead,
  appTableRow,
  appTableWrap,
} from '../../../lib/appTable';
import { cn } from '../../../lib/cn';

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'DELETED', label: 'Eliminado' },
] as const;

const stLabel = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s;

function toNonNegInt(s: string): number | undefined {
  if (!s || !s.trim()) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function TenantsListPage() {
  const [search, setSearch] = useSearchParams();
  const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
  const pageSize = 10;
  const q = (search.get('q') || '').trim();
  const status = search.get('status') || '';
  const leadsMin = (search.get('leadsMin') || '').trim();
  const leadsMax = (search.get('leadsMax') || '').trim();
  const usersMin = (search.get('usersMin') || '').trim();
  const usersMax = (search.get('usersMax') || '').trim();

  const applySearch = useCallback(
    (next: Record<string, string>) => {
      setSearch((prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (v === '') p.delete(k);
          else p.set(k, v);
        }
        return p;
      }, { replace: true });
    },
    [setSearch],
  );

  const setFilters = useCallback(
    (next: Record<string, string>) => {
      setSearch((prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (v === '') p.delete(k);
          else p.set(k, v);
        }
        p.set('page', '1');
        return p;
      }, { replace: true });
    },
    [setSearch],
  );

  const queryKey = useMemo(
    () => ['companies', 'super', page, q, status, leadsMin, leadsMax, usersMin, usersMax] as const,
    [page, q, status, leadsMin, leadsMax, usersMin, usersMax],
  );

  const { data, isLoading, error } = useQuery<Paginated<Company>>({
    queryKey: [...queryKey],
    queryFn: async () => {
      const lMin = toNonNegInt(leadsMin);
      const lMax = toNonNegInt(leadsMax);
      const uMin = toNonNegInt(usersMin);
      const uMax = toNonNegInt(usersMax);
      const { data: body } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: {
          page,
          pageSize,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
          ...(lMin != null ? { leadsMin: lMin } : {}),
          ...(lMax != null ? { leadsMax: lMax } : {}),
          ...(uMin != null ? { usersMin: uMin } : {}),
          ...(uMax != null ? { usersMax: uMax } : {}),
        },
      });
      return unwrap(body);
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error) return <p className="text-sm text-red-400">Error al cargar empresas.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={appPageTitle}>Empresas</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-500">Filtra por nombre, slug, estado y rangos de leads o usuarios.</p>
        </div>
        <Link
          to="/superadmin/tenants/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Nueva empresa
        </Link>
      </div>

      <div className={cn(appFilterBar, 'mt-3')}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-2">
          <div className="min-w-0 flex-1 sm:min-w-0 sm:max-w-xs">
            <label className={appFilterLabel} htmlFor="t-q">
              Nombre o slug
            </label>
            <input
              id="t-q"
              className={appInputFilter}
              value={q}
              placeholder="p. ej. acme, slug…"
              onChange={(e) => setFilters({ q: e.target.value })}
            />
          </div>
          <div className="w-full min-w-0 sm:w-28 sm:flex-none">
            <label className={appFilterLabel} htmlFor="t-st">
              Estado
            </label>
            <select
              id="t-st"
              className={appSelectFilter}
              value={status}
              onChange={(e) => setFilters({ status: e.target.value })}
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={appFilterLabel}>Leads</label>
            <div className="flex gap-1.5">
              <input
                className={cn(appInputFilter, 'w-16 sm:w-20')}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Mín"
                value={leadsMin}
                onChange={(e) => setFilters({ leadsMin: e.target.value })}
                aria-label="Leads mínimo"
              />
              <input
                className={cn(appInputFilter, 'w-16 sm:w-20')}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Máx"
                value={leadsMax}
                onChange={(e) => setFilters({ leadsMax: e.target.value })}
                aria-label="Leads máximo"
              />
            </div>
          </div>
          <div>
            <label className={appFilterLabel}>Usuarios</label>
            <div className="flex gap-1.5">
              <input
                className={cn(appInputFilter, 'w-16 sm:w-20')}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Mín"
                value={usersMin}
                onChange={(e) => setFilters({ usersMin: e.target.value })}
                aria-label="Usuarios mínimo"
              />
              <input
                className={cn(appInputFilter, 'w-16 sm:w-20')}
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Máx"
                value={usersMax}
                onChange={(e) => setFilters({ usersMax: e.target.value })}
                aria-label="Usuarios máximo"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={appTableWrap + ' mt-4'}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={appTableHead}>
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3">Usuarios</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={appTableBody}>
            {data?.data.map((c) => (
              <tr key={c.id} className={appTableRow}>
                <td className={cn('px-4 py-3', appTableCellStrong)}>{c.name}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{c.slug}</td>
                <td className={cn('px-4 py-3', appTableCellSoft)}>{stLabel(c.status)}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{c.leadsCount ?? '—'}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{c.usersCount ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/superadmin/tenants/${c.id}`} className="text-amber-700 hover:underline dark:text-amber-400">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-500">
        <span>
          {data != null
            ? `Mostrando ${Math.min((page - 1) * data.pageSize + 1, data.total)} – ${Math.min(
                page * data.pageSize,
                data.total,
              )} de ${data.total}`
            : '—'}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => applySearch({ page: String(page - 1) })}
            className={cn('rounded px-3 py-1 disabled:opacity-40', appInputBorder)}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!data || page * data.pageSize >= data.total}
            onClick={() => applySearch({ page: String(page + 1) })}
            className={cn('rounded px-3 py-1 disabled:opacity-40', appInputBorder)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
