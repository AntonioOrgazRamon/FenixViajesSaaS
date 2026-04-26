import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Paginated, UserListItem, Company } from '../../../types/domain';
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

export function SuperUsersListPage() {
  const [params, setParams] = useSearchParams();
  const companyId = params.get('companyId') || '';
  const [page, setPage] = useState(1);

  const companies = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'all-short'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: { page: 1, pageSize: 100 },
      });
      return unwrap(data);
    },
  });

  const { data, isLoading, error } = useQuery<Paginated<UserListItem>>({
    queryKey: ['users', page, companyId],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: { page, pageSize: 15, ...(companyId ? { companyId } : {}) },
      });
      return unwrap(body);
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error) return <p className="text-sm text-red-400">Error al cargar usuarios.</p>;

  return (
    <div>
      <h1 className={appPageTitle}>Usuarios (global)</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">Filtra por empresa si lo necesitas.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-zinc-600 dark:text-zinc-500">Empresa</label>
          <select
            className={appSelect}
            value={companyId}
            onChange={(e) => {
              setPage(1);
              const v = e.target.value;
              if (v) setParams({ companyId: v });
              else setParams({});
            }}
          >
            <option value="">Todas</option>
            {companies.data?.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={appTableWrap}>
        <table className="w-full min-w-[720px] text-left text-sm">
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
                <td className={cn('px-4 py-3', appTableCellSoft)}>{u.role}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{u.status}</td>
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
      <div className="mt-4 flex justify-between text-sm text-zinc-600 dark:text-zinc-500">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className={cn('rounded px-3 py-1 disabled:opacity-40', appInputBorder)}
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={!data || page * data.pageSize >= data.total}
          onClick={() => setPage((p) => p + 1)}
          className={cn('rounded px-3 py-1 disabled:opacity-40', appInputBorder)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
