import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import type { Paginated, UserListItem } from '../../../types/domain';
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

const roleFilterOptions = [
  { value: '', label: 'Todos los roles' },
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

const roleLabel = (r: string) =>
  r === 'COMPANY_ADMIN' ? 'Admin' : r === 'COMPANY_USER' ? 'Usuario' : r;

const statusLabel = (s: string) => statusOptions.find((o) => o.value === s)?.label ?? s;

export function CompanyUsersListPage() {
  const selfRole = useAuthStore((s) => s.user?.role);
  const isAdmin = selfRole === 'COMPANY_ADMIN';
  const [search, setSearch] = useSearchParams();
  const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
  const pageSize = 12;
  const q = (search.get('q') || '').trim();
  const role = search.get('role') || '';
  const status = search.get('status') || '';

  const setParams = useCallback(
    (next: { q?: string; role?: string; status?: string; page?: number }) => {
      const p = new URLSearchParams(search);
      if (next.q !== undefined) (next.q ? p.set('q', next.q) : p.delete('q'));
      if (next.role !== undefined) (next.role ? p.set('role', next.role) : p.delete('role'));
      if (next.status !== undefined) (next.status ? p.set('status', next.status) : p.delete('status'));
      const newPage = next.page ?? 1;
      p.set('page', String(newPage > 0 ? newPage : 1));
      setSearch(p, { replace: true });
    },
    [search, setSearch],
  );

  const queryKey = useMemo(
    () => ['users', 'company', page, q, role, status],
    [page, q, role, status],
  );

  const { data, isLoading, error } = useQuery<Paginated<UserListItem>>({
    queryKey,
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: { page, pageSize, ...(q ? { q } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) },
      });
      return unwrap(body);
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error) return <p className="text-sm text-red-400">Error al cargar usuarios.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={appPageTitle}>Usuarios</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-500">Solo miembros de tu empresa. Se puede filtrar y buscar.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link to="/app/users/new" className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
              Nuevo usuario
            </Link>
            <Link
              to="/app/admins/new"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              Nuevo admin
            </Link>
          </div>
        )}
      </div>

      <div className={cn(appFilterBar, 'mt-4')}>
        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-2.5 sm:gap-y-2">
          <div className="min-w-0 flex-1 sm:min-w-0 sm:max-w-sm">
            <label className={appFilterLabel} htmlFor="cu-q">
              Buscar
            </label>
            <input
              id="cu-q"
              className={appInputFilter}
              placeholder="Nombre, email…"
              value={q}
              onChange={(e) => setParams({ q: e.target.value, page: 1 })}
            />
          </div>
          <div className="w-full min-w-0 sm:w-44 sm:flex-none">
            <label className={appFilterLabel} htmlFor="cu-role">
              Rol
            </label>
            <select
              id="cu-role"
              className={appSelectFilter}
              value={role}
              onChange={(e) => setParams({ role: e.target.value, page: 1 })}
            >
              {roleFilterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full min-w-0 sm:w-32 sm:flex-none">
            <label className={appFilterLabel} htmlFor="cu-st">
              Estado
            </label>
            <select
              id="cu-st"
              className={appSelectFilter}
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
      </div>

      <div className={appTableWrap + ' mt-4'}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={appTableHead}>
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nombre</th>
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
                <td className={cn('px-4 py-3', appTableCellSoft)}>{roleLabel(u.role)}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{statusLabel(u.status)}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/app/users/${u.id}`} className="text-amber-700 hover:underline dark:text-amber-400">
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
            ? `${Math.min((page - 1) * data.pageSize + 1, data.total)} – ${Math.min(page * data.pageSize, data.total)} de ${
                data.total
              }`
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
