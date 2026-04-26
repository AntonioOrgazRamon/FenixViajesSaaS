import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import {
  appInputBorder,
  appPageTitle,
  appTableBody,
  appTableCellMuted,
  appTableHead,
  appTableRow,
  appTableWrap,
} from '../../../lib/appTable';
import { cn } from '../../../lib/cn';

type LogRow = {
  id: string;
  action: string;
  createdAt: string;
  result: string | null;
  actorUser: { email: string; firstName: string | null; lastName: string | null } | null;
  company: { name: string } | null;
};

type Page = { total: number; page: number; pageSize: number; data: LogRow[] };

const actionClass = 'font-mono text-xs text-amber-800 dark:text-amber-200/90';

export function SuperAuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery<Page>({
    queryKey: ['audit', page],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Page }>('/audit-logs', {
        params: { page, pageSize: 30 },
      });
      return unwrap(body);
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error) return <p className="text-sm text-red-400">Error al cargar auditoría.</p>;

  return (
    <div>
      <h1 className={appPageTitle}>Auditoría</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">Registro global de acciones.</p>
      <div className={appTableWrap}>
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className={appTableHead}>
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Acción</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Resultado</th>
            </tr>
          </thead>
          <tbody className={appTableBody}>
            {data?.data.map((row) => (
              <tr key={row.id} className={appTableRow}>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{new Date(row.createdAt).toLocaleString()}</td>
                <td className={cn('px-4 py-3', actionClass)}>{row.action}</td>
                <td className={cn('px-4 py-3', 'text-zinc-700 dark:text-zinc-400')}>{row.actorUser?.email ?? '—'}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{row.company?.name ?? '—'}</td>
                <td className={cn('px-4 py-3', appTableCellMuted)}>{row.result ?? '—'}</td>
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
