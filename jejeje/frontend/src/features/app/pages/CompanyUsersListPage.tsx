import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Paginated, UserListItem } from '../../../types/domain';
import {
  appInputBorder,
  appPageTitle,
  appTableBody,
  appTableCellMuted,
  appTableCellSoft,
  appTableCellStrong,
  appTableHead,
  appTableRow,
  appTableWrap,
} from '../../../lib/appTable';
import { cn } from '../../../lib/cn';

export function CompanyUsersListPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery<Paginated<UserListItem>>({
    queryKey: ['users', 'company', page],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: { page, pageSize: 12 },
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
          <p className="text-sm text-zinc-600 dark:text-zinc-500">Miembros de tu empresa.</p>
        </div>
        <div className="flex gap-2">
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
      </div>
      <div className={appTableWrap}>
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
                <td className={cn('px-4 py-3', appTableCellSoft)}>{u.role}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{u.status}</td>
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
      <div className="mt-4 flex justify-between text-sm text-zinc-600 dark:text-zinc-500">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
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
