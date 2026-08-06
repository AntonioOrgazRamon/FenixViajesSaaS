import { PanelCard } from '../../../components/ui/PanelCard';
import { useProfileActivityQuery } from '../hooks/useProfileActivityQuery';
import { formatDateTime } from '../lib/accountLabels';
import { labelForAuditAction } from '../lib/profileActivityLabels';
import { cn } from '../../../lib/cn';

export function ProfileActivity({ language }: { language: 'es' | 'en' }) {
  const { data, isLoading, isError, error, refetch } = useProfileActivityQuery();

  if (isLoading) {
    return (
      <div className="min-w-0 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-200/50 dark:bg-white/10" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {String((error as Error)?.message ?? 'No se pudo cargar la actividad.')}
        <button type="button" className="ml-2 underline" onClick={() => refetch()}>
          Reintentar
        </button>
      </p>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Aún no hay eventos de seguridad registrados (accesos, correo, contraseña o avatar). Inicia sesión o realiza
          cambios en la cuenta para ver el historial aquí.
        </p>
      </PanelCard>
    );
  }

  return (
    <PanelCard className="min-w-0" padding="p-0">
      <ul className="divide-y divide-zinc-200/80 text-[13px] dark:divide-white/[0.06]">
        {items.map((row) => (
          <li key={row.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{labelForAuditAction(row.action)}</p>
              <p className="text-[11px] text-zinc-500 tabular-nums">
                {formatDateTime(row.createdAt, language)}
                {row.result && row.result !== 'SUCCESS' ? ` · ${row.result}` : ''}
              </p>
              {row.ipAddress ? (
                <p className="mt-0.5 truncate text-[10px] text-zinc-500" title={row.userAgent ?? undefined}>
                  IP {row.ipAddress}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                'shrink-0 self-start rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                row.result === 'FAILURE' || row.result === 'ERROR'
                  ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200'
                  : 'bg-emerald-100/80 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200',
              )}
            >
              {row.result}
            </span>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}
