import { useParams, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';
import { useState } from 'react';

export function CompanyUserSessionsPage() {
  const { id } = useParams<{ id: string }>();
  const [msg, setMsg] = useState<string | null>(null);

  const revokeAll = useMutation({
    mutationFn: async () => {
      await api.post(`/sessions/user/${id}/revoke`, {});
    },
    onSuccess: () => setMsg('Sesiones revocadas para este usuario.'),
    onError: (e) => setMsg(getApiErrorMessage(e)),
  });

  if (!id) return null;

  return (
    <div className="w-full min-w-0">
      <Link to={`/app/users/${id}`} className="text-sm text-amber-400 hover:underline">
        ← Usuario
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">Sesiones</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Revoca todas las sesiones activas de este usuario (por ejemplo, tras un incidente de seguridad).
      </p>
      <button
        type="button"
        onClick={() => revokeAll.mutate()}
        disabled={revokeAll.isPending}
        className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20 disabled:opacity-50"
      >
        {revokeAll.isPending ? 'Revocando…' : 'Revocar todas las sesiones'}
      </button>
      {msg && <p className="mt-4 text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
