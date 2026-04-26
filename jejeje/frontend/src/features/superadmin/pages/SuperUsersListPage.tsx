import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Company, Paginated, UserListItem } from '../../../types/domain';
import {
  appInputBorder,
  appPageTitle,
  appSelect,
  appTableBody,
  appTableCellMuted,
  appTableCellSoft,
  appTableCellStrong,
  appTableHead,
  appTableRow,
  appTableWrap,
} from '../../../lib/appTable';
import { cn } from '../../../lib/cn';

const roleOptions = [
  { value: '', label: 'Todos' },
  { value: 'SUPER_ADMIN', label: 'Super admin' },
  { value: 'COMPANY_ADMIN', label: 'Admin empresa' },
  { value: 'COMPANY_USER', label: 'Usuario' },
] as const;

const statusOptions = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'LOCKED', label: 'Bloqueado' },
  { value: 'DELETED', label: 'Eliminado' },
] as const;

const shortRole = (r: string) => {
  if (r === 'SUPER_ADMIN') return 'Super';
  if (r === 'COMPANY_ADMIN') return 'Admin emp.';
  if (r === 'COMPANY_USER') return 'Usuario';
  return r;
};

const stLabel = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s;

export function SuperUsersListPage() {
  const [search, setSearch] = useSearchParams();
  const companyId = search.get('companyId') || '';
  const q = (search.get('q') || '').trim();
  const role = search.get('role') || '';
  const status = search.get('status') || '';
  const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
  const pageSize = 15;

  const setParams = useCallback(
    (next: { companyId?: string; q?: string; role?: string; status?: string; page?: number }) => {
      const p = new URLSearchParams(search);
      if (next.companyId !== undefined) (next.companyId ? p.set('companyId', next.companyId) : p.delete('companyId'));
      if (next.q !== undefined) (next.q ? p.set('q', next.q) : p.delete('q'));
      if (next.role !== undefined) (next.role ? p.set('role', next.role) : p.delete('role'));
      if (next.status !== undefined) (next.status ? p.set('status', next.status) : p.delete('status'));
      const np = next.page ?? 1;
      p.set('page', String(np > 0 ? np : 1));
      setSearch(p, { replace: true });
    },
    [search, setSearch],
  );

  const companiesQ = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'all-short', 'super-users'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: { page: 1, pageSize: 200 },
      });
      return unwrap(body);
    },
  });

  const qKey = useMemo(
    () => ['users', 'global', companyId, q, role, status, page],
    [companyId, q, role, status, page],
  );

  const { data, isLoading, error } = useQuery<Paginated<UserListItem>>({
    queryKey: qKey,
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: {
          page,
          pageSize,
          ...(companyId ? { companyId } : {}),
          ...(q ? { q } : {}),
          ...(role ? { role } : {}),
          ...(status ? { status } : {}),
        },
      });
      return unwrap(body);
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error) return <p className="text-sm text-red-400">Error al cargar usuarios.</p>;

  return (
    <div>
      <h1 className={appPageTitle}>Usuarios (global)</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">Filtro por empresa, rol, estado y búsqueda (nombre, email).</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="text-xs text-zinc-600 dark:text-zinc-500">Empresa</label>
          <select
            className={appSelect + ' w-full min-w-[200px] sm:min-w-[220px]'}
            value={companyId}
            onChange={(e) => {
              setParams({ companyId: e.target.value, page: 1 });
            }}
          >
            <option value="">Todas</option>
            {companiesQ.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:min-w-[200px] sm:max-w-md sm:flex-1">
          <label className="text-xs text-zinc-600 dark:text-zinc-500">Buscar (nombre, email)</label>
          <input
            className={cn('mt-1 w-full rounded-lg px-3 py-2 text-sm', appInputBorder)}
            value={q}
            placeholder="Buscar…"
            onChange={(e) => setParams({ q: e.target.value, page: 1 })}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-600 dark:text-zinc-500">Rol</label>
          <select
            className={appSelect + ' w-full min-w-[140px]'}
            value={role}
            onChange={(e) => setParams({ role: e.target.value, page: 1 })}
          >
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-600 dark:text-zinc-500">Estado</label>
          <select
            className={appSelect + ' w-full min-w-[120px]'}
            value={status}
            onChange={(e) => setParams({ status: e.target.value, page: 1 })}
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={appTableWrap + ' mt-4'}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={appTableHead}>
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={appTableBody}>
            {data?.data.map((u) => (
              <tr key={u.id} className={appTableRow}>
                <td className={cn('px-4 py-3', appTableCellStrong)}>{u.email}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>
                  {u.firstName} {u.lastName}
                </td>
                <td className={cn('px-4 py-3 text-xs', appTableCellSoft)}>{u.company?.name ?? '—'}</td>
                <td className={cn('px-4 py-3', appTableCellSoft)}>{shortRole(u.role)}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{stLabel(u.status)}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/superadmin/users/${u.id}`} className="text-amber-700 hover:underline dark:text-amber-400">
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
            onClick={() => setParams({ page: page - 1 })}
            className={cn('rounded px-3 py-1 disabled:opacity-40', appInputBorder)}
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!data || page * data.pageSize >= data.total}
            onClick={() => setParams({ page: page + 1 })}
            className={cn('rounded px-3 py-1 disabled:opacity-40', appInputBorder)}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
