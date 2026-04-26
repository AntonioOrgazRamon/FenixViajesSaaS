import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { PanelCard } from '../../../components/ui/PanelCard';

type SessionRow = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
};

type PageData = { total: number; page: number; pageSize: number; data: SessionRow[] };

export function SessionsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<PageData>({
    queryKey: ['sessions', 1],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: PageData }>('/sessions', { params: { page: 1, pageSize: 50 } });
      return unwrap(body);
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/sessions/${id}/revoke`, {});
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando sesiones…</p>;
  if (error) return <p className="text-sm text-red-400">{getApiErrorMessage(error)}</p>;

  return (
    <div className="w-full min-w-0">
      <p className="mb-2 text-[11px] text-zinc-500">Revoca dispositivos que ya no uses.</p>
      <PanelCard padding="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="border-b border-white/[0.06] bg-zinc-950/50 text-[10px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-2 py-2">Dispositivo</th>
                <th className="px-2 py-2">IP</th>
                <th className="px-2 py-2">Creada</th>
                <th className="px-2 py-2">Estado</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
            {data?.data.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.02]">
                <td className="px-2 py-1.5 text-zinc-300">{s.deviceName || s.userAgent?.slice(0, 48) || '—'}</td>
                <td className="px-2 py-1.5 text-zinc-500">{s.ipAddress || '—'}</td>
                <td className="px-2 py-1.5 text-zinc-500 tabular-nums">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="px-2 py-1.5">
                  {s.revokedAt ? (
                    <span className="text-red-400/90">Revocada</span>
                  ) : (
                    <span className="text-emerald-400/90">Activa</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">
                  {!s.revokedAt && (
                    <button
                      type="button"
                      onClick={() => revoke.mutate(s.id)}
                      disabled={revoke.isPending}
                      className="cursor-pointer text-[11px] font-medium text-amber-400 hover:underline disabled:opacity-50"
                    >
                      Revocar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </PanelCard>
      {revoke.isError && <p className="mt-2 text-xs text-red-400">{getApiErrorMessage(revoke.error)}</p>}
    </div>
  );
}
