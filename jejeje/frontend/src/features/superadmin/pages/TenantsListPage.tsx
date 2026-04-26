import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Company, Paginated } from '../../../types/domain';
import { useState } from 'react';
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

export function TenantsListPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery<Paginated<Company>>({
    queryKey: ['companies', page],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: { page, pageSize: 10 },
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
          <p className="text-sm text-zinc-600 dark:text-zinc-500">Tenants registrados en la plataforma.</p>
        </div>
        <Link
          to="/superadmin/tenants/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
        >
          Nueva empresa
        </Link>
      </div>
      <div className={appTableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={appTableHead}>
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className={appTableBody}>
            {data?.data.map((c) => (
              <tr key={c.id} className={appTableRow}>
                <td className={cn('px-4 py-3', appTableCellStrong)}>{c.name}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{c.slug}</td>
                <td className={cn('px-4 py-3', appTableCellSoft)}>{c.status}</td>
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
      <div className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-500">
        <span>
          Página {data?.page} de {Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 10)))}
        </span>
        <div className="flex gap-2">
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
    </div>
  );
}
