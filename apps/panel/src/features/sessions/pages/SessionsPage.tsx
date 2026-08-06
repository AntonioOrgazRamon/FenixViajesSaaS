import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Monitor, RefreshCw, Shield } from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { confirmAction, notifySuccess } from '../../../lib/swal';
import { deviceLabelFromUserAgent } from '../../../lib/userAgentLabel';
import { ProfileSecuritySubPageFrame } from '../../profile/components/ProfileSecuritySubPageFrame';
import { cn } from '../../../lib/cn';

type SessionRow = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  isCurrent?: boolean;
};

type PageData = {
  total: number;
  page: number;
  pageSize: number;
  currentSessionId: string;
  data: SessionRow[];
};

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200/70 bg-white/60 px-3 py-2.5 text-center dark:border-white/[0.08] dark:bg-zinc-900/40">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

export function SessionsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<PageData>({
    queryKey: ['sessions', 1],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: PageData }>('/sessions', {
        params: { page: 1, pageSize: 50 },
      });
      return unwrap(body);
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/sessions/${id}/revoke`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.post<{ success: boolean; data: { message: string } }>(
        '/sessions/revoke-others',
        {},
      );
      return unwrap<{ message: string }>(body);
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      await notifySuccess('Otras sesiones cerradas');
    },
  });

  if (isLoading) {
    return (
      <ProfileSecuritySubPageFrame maxWidthClass="max-w-3xl" title="Dispositivos y sesiones">
        <div className="space-y-3 animate-pulse" aria-hidden>
          <div className="h-2.5 w-1/2 rounded bg-zinc-200/50 dark:bg-white/10" />
          <div className="h-20 rounded-xl bg-zinc-200/30 dark:bg-white/5" />
          <div className="h-20 rounded-xl bg-zinc-200/30 dark:bg-white/5" />
        </div>
      </ProfileSecuritySubPageFrame>
    );
  }

  if (error) {
    return (
      <ProfileSecuritySubPageFrame
        maxWidthClass="max-w-3xl"
        title="Dispositivos y sesiones"
        description="No se pudo completar la petición. Puedes reintentar desde Cuenta."
      >
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {getApiErrorMessage(error)}
        </p>
      </ProfileSecuritySubPageFrame>
    );
  }

  const rows = data?.data ?? [];
  const active = rows.filter((r) => !r.revokedAt);
  const othersActive = active.filter((r) => !r.isCurrent).length;
  const totalHist = data?.total ?? active.length;

  return (
    <ProfileSecuritySubPageFrame
      maxWidthClass="max-w-3xl"
      title="Dispositivos y sesiones"
      description="Cada ficha es un inicio de sesión guardado. «Este» indica el navegador en el que estás ahora."
      headerAction={
        <button
          type="button"
          onClick={() => {
            void (async () => {
              const ok = await confirmAction({
                title: 'Cerrar otras sesiones',
                text: 'Se cerrarán los otros dispositivos. El navegador actual seguirá conectado.',
                confirmText: 'Sí, cerrar',
                cancelText: 'Cancelar',
                icon: 'warning',
              });
              if (ok) revokeOthers.mutate();
            })();
          }}
          disabled={revokeOthers.isPending || othersActive === 0}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-3.5 py-2 text-[12px] font-semibold text-zinc-800 shadow-sm transition hover:border-amber-400/50 hover:bg-amber-50/50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10"
        >
          {revokeOthers.isPending ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Shield className="h-3.5 w-3.5 opacity-80" aria-hidden />
          )}
          Cerrar otras
        </button>
      }
    >
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatPill label="Sesiones activas" value={active.length} />
        <StatPill
          label="Otras (no este)"
          value={othersActive === 0 ? '0' : othersActive}
        />
        <StatPill label="Total (historial)" value={totalHist} />
      </div>

      {revokeOthers.isError && (
        <p
          className="mb-4 rounded-lg border border-red-200/60 bg-red-500/5 px-3 py-2.5 text-[13px] text-red-700 dark:border-red-500/20 dark:text-red-300"
          role="alert"
        >
          {getApiErrorMessage(revokeOthers.error)}
        </p>
      )}
      {revokeOthers.isSuccess && (
        <p
          className="mb-4 rounded-lg border border-emerald-200/60 bg-emerald-500/5 px-3 py-2.5 text-[13px] text-emerald-800 dark:border-emerald-500/20 dark:text-emerald-200"
          role="status"
        >
          {revokeOthers.data?.message}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">No hay sesiones que mostrar.</p>
      ) : (
        <ul className="space-y-2" aria-label="Listado de sesiones">
          {rows.map((s) => {
            const { short, full } = deviceLabelFromUserAgent(s.userAgent, s.deviceName);
            return (
              <li
                key={s.id}
                className={cn(
                  'overflow-hidden rounded-xl border border-zinc-200/80 bg-white/50 transition dark:border-white/[0.08] dark:bg-zinc-900/25',
                  s.isCurrent && 'border-amber-300/50 ring-1 ring-amber-500/15 dark:border-amber-500/25',
                )}
              >
                <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Monitor
                        className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      {s.isCurrent && (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                          Este
                        </span>
                      )}
                      {s.revokedAt && (
                        <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-white/10">Cerrada</span>
                      )}
                    </div>
                    <p
                      className="text-[15px] font-medium leading-snug text-zinc-900 dark:text-zinc-100"
                      title={full}
                    >
                      {short}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                      <span className="inline-flex items-center gap-1.5" title="IP">
                        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                        {s.ipAddress || '—'}
                      </span>
                      <span className="tabular-nums" title="Última actividad">
                        {formatWhen(s.lastSeenAt ?? s.createdAt)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 justify-end sm:min-w-[7.5rem] sm:pl-2">
                    {!s.revokedAt && !s.isCurrent && (
                      <button
                        type="button"
                        onClick={() => revoke.mutate(s.id)}
                        disabled={revoke.isPending}
                        className="inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-50/80 text-[12px] font-semibold text-zinc-800 transition hover:border-amber-300/50 hover:bg-amber-50/30 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-800/50 dark:text-zinc-200 dark:hover:border-amber-500/30"
                      >
                        Cerrar
                      </button>
                    )}
                    {s.isCurrent && (
                      <span className="whitespace-nowrap text-[11px] text-zinc-500">Sesión de esta ventana</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.total > rows.length && (
        <p className="mt-4 text-center text-[11px] text-zinc-500">Mostrando {rows.length} de {data.total} entradas.</p>
      )}

      {revoke.isError && (
        <p
          className="mt-4 rounded-lg border border-red-200/50 bg-red-500/5 px-3 py-2 text-[12px] text-red-600 dark:border-red-500/20 dark:text-red-300"
          role="alert"
        >
          {getApiErrorMessage(revoke.error)}
        </p>
      )}
    </ProfileSecuritySubPageFrame>
  );
}
